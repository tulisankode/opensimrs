import sequelizeInstance from "@opensimrs/model-sdk/instance";
import BadRequestException from "../errors/bad-request-exception.js";
import NotfoundException from "../errors/notfound-exception.js";
import InventoryBarangRepository from "../repositories/inventory-barang-repository.js";
import SettingRepository from "../repositories/setting-repository.js";
import HargaItemRepository from "../repositories/harga-item-repository.js"; 
import PenerimaanValidation from "../validations/penerimaan-validation.js";
import {uuidv7} from "uuidv7";
import RiwayatMutasiRepository from "../repositories/riwayat-mutasi-repository.js";
import UserRepository from "../repositories/user-repository.js";
import FarmasiExternalRepository from "../repositories/farmasi-external-repository.js";

export default class PenerimaanBarangService {
    static async createPenerimaan(payload, headers) {
        const transaction = await sequelizeInstance.transaction();
        try {
            // Validasi zod dan validasi bisnis
            const validatedData = await PenerimaanValidation.CREATE_PENERIMAAN_BARANG.parseAsync(payload);
            const purchaseOrder = await this._validatePurchaseOrder(validatedData);
            const petugas = await UserRepository.findByUuid(validatedData.petugas_penerima_uuid);

            // Ambil konfigurasi dari Farmasi API
            const configFarmasi = await FarmasiExternalRepository.getKonfigurasiHarga(headers);
            const isAverageMethod = configFarmasi?.metode_hpp?.toLowerCase() === "average";
    
            // Persiapan data (PPN & Header Payload)
            const ppnRate = await this._getPpnRate(validatedData);
            const dataToUpdateHeader = this._prepareHeaderUpdatePayload(validatedData, ppnRate, petugas.username);

            // Update Header & Item PO
            await InventoryBarangRepository.updateStatusToDiterima(dataToUpdateHeader, transaction);
            await this._updatePurchaseOrderItems(validatedData, purchaseOrder, transaction);

            // Persiapan Data Stok
            const { itemPoMap, itemStokMap, hargaItemMap } = await this._getStockCreationPrerequisites(
                purchaseOrder, 
                validatedData.faskes_uuid
            );

            // Mempersiapkan payload untuk Stok & Harga
            const { itemsToCreateStock, hargaPayloads, mutasiPayloads } = this._prepareStockAndPricePayloads(
                validatedData,
                purchaseOrder,
                itemPoMap,
                itemStokMap,
                hargaItemMap,
                ppnRate,
                isAverageMethod
            );

            // Eksekusi ke Database
            if (itemsToCreateStock.length > 0) {
                await InventoryBarangRepository.bulkCreateStokMedis(itemsToCreateStock, transaction);
            }

            // Menentukan harga item dari stock medis
            if (hargaPayloads.length > 0) {
                await HargaItemRepository.bulkUpdateOrInsertHargaItem(hargaPayloads, transaction);
            }

            // Log ke riwayat mutasi
            if (mutasiPayloads.length > 0) {
                await RiwayatMutasiRepository.bulkCreate(mutasiPayloads, { transaction });
            }
            await transaction.commit();
            return await InventoryBarangRepository.getDetail(validatedData);
        } catch (e) {
            await transaction.rollback();
            throw e;
        }
    }

    // Fungsi helper untuk validasi pembelian barang
    static async _validatePurchaseOrder(validatedData) {
        const purchaseOrder = await InventoryBarangRepository.getDetail(validatedData);
        if (!purchaseOrder) throw new NotfoundException("Data Pengadaan Barang yang akan diterima tidak ditemukan");
        if (purchaseOrder.status !== "verifikasi") {
            throw new BadRequestException([
                {
                    field: "status",
                    message: `Hanya PO dengan status verifikasi yang dapat diterima. Status saat ini: ${purchaseOrder.status}`
                }
            ]);
        }
        return purchaseOrder;
    }

    // Fungsi helper untuk mengaktifkan ppn
    static async _getPpnRate(validatedData) {
        if (validatedData.ppn === true) return await SettingRepository.getCurrentPpnRate(); 
        return 0;
    }

    // Fungsi helper untuk payload yang diupdate sisi frontend
    static _prepareHeaderUpdatePayload(validatedData, ppnRate, petugasPenerimaNama) {
        return {
            uuid: validatedData.uuid,
            faskes_uuid: validatedData.faskes_uuid,
            status: "diterima", 
            tanggal_terima: validatedData.tanggal_terima,
            no_faktur: validatedData.no_faktur,
            tanggal_faktur: validatedData.tanggal_faktur,
            no_surat_jalan: validatedData.no_surat_jalan,
            catatan_penerimaan: validatedData.catatan_penerimaan,
            petugas_pengirim: validatedData.petugas_pengirim,
            petugas_penerima: petugasPenerimaNama,
            petugas_penerima_uuid: validatedData.petugas_penerima_uuid,
            diskon: validatedData.diskon,
            materai: validatedData.materai,
            ppn: ppnRate,
        };
    }

    // Fungsi untuk mengupdate pembelian barang ke database
    static async _updatePurchaseOrderItems(validatedData, purchaseOrder, transaction) {
        if (validatedData.items && validatedData.items.length > 0) {
            const originalItemMap = new Map(purchaseOrder.pbsu.map(item => [item.uuid, item.toJSON()]));
            const itemsToUpdate = validatedData.items.map(item => {
                const originalItem = originalItemMap.get(item.uuid);
                if (!originalItem) {
                    throw new BadRequestException(`Item ${item.uuid} tidak ditemukan di PO.`);
                }
                const { ...restOfOriginalItem } = originalItem;
                return {
                    ...restOfOriginalItem, 
                    qty_terima: item.qty_terima, 
                    exp_date: item.exp_date
                };
            });
            await InventoryBarangRepository.bulkUpdatePurchaseOrderItems(
                itemsToUpdate, 
                validatedData.uuid,
                validatedData.faskes_uuid,
                transaction
            );
        }
    }

    // Fungsi untuk mempersiapkan pembuatan data stok_medis
    static async _getStockCreationPrerequisites(purchaseOrder, faskesUuid) {
        const itemPoMap = new Map();
        const listIdItemMedis = [];
        const items = purchaseOrder.pbsu || [];
        console.log("DEBUG - Jumlah Item di PO (DB):", items.length);
        
        items.forEach(item => {
            itemPoMap.set(item.uuid, item);
            if (item.item_uuid) {
                listIdItemMedis.push(item.item_uuid);
            }
        });

        if (listIdItemMedis.length === 0) {
             return { itemPoMap, itemStokMap: new Map(), hargaItemMap: new Map() };
        }

        const stokDataList = await InventoryBarangRepository.findAllStokByItemAndJenisStok(
            listIdItemMedis, 
            purchaseOrder.jenis_stok_uuid, 
            faskesUuid
        );

        const itemStokMap = new Map();
        const itemMedisJenisStokUuids = [];

        stokDataList.forEach(dataStok => {
            if (dataStok.item_medis_uuid) {
                itemStokMap.set(dataStok.item_medis_uuid, dataStok); 
                itemMedisJenisStokUuids.push(dataStok.uuid);
            }
        });

        const hargaItemMap = await HargaItemRepository.findManyByItemJenisStok(
            itemMedisJenisStokUuids,
            faskesUuid
        );

        return { itemPoMap, itemStokMap, hargaItemMap };
    }

    // Fungsi untuk menyiapkan payload Stock dan harganya
    static _prepareStockAndPricePayloads(validatedData, purchaseOrder, itemPoMap, itemStokMap, hargaItemMap, ppnRate, isAverageMethod) {
        const itemsToCreateStock = [];
        const hargaPayloads = [];
        const mutasiPayloads = [];

        for (const itemDiterima of validatedData.items) {
            // Ambil data PO item
            const poItem = itemPoMap.get(itemDiterima.uuid);
            if (!poItem) continue;

            const stokConfigData = itemStokMap.get(poItem.item_uuid);
            if (!stokConfigData) continue;

            const itemJenisStokUuid = stokConfigData.uuid; 
            if (!itemJenisStokUuid) continue;

            // Parsing jumlah terima di awal & Early Exit jika 0
            const qtyTerimaInput = parseFloat(itemDiterima.qty_terima);
            if (qtyTerimaInput <= 0) continue;

            const rasioKonversi = poItem.konversi || poItem.cnvrsn?.konversi || 1;
            const qtyStokMasuk = qtyTerimaInput * rasioKonversi;

            let hargaBeliPerBox = parseFloat(poItem.harga_satuan);
            if (itemDiterima.harga_satuan_baru) {
                hargaBeliPerBox = parseFloat(itemDiterima.harga_satuan_baru);
            }

            const hargaBeliPerSatuanKecil = hargaBeliPerBox / rasioKonversi;

            // Kalkulasi HPP / Average Cost
            const hargaLamaData = hargaItemMap.get(itemJenisStokUuid);

            // Relasi yang di-include bernama "stocks" (array batch). Sebelumnya dibaca sebagai stock_medis
            // (selalu undefined) sehingga stok lama dianggap 0: HPP rata-rata selalu = harga beli terakhir
            // dan stok_awal kartu stok penerimaan selalu 0.
            const batchAktif = (stokConfigData.stocks || []).filter((s) => !s.deleted_at);
            const stokFisikLama = batchAktif.reduce((acc, s) => acc + Number(s.sisa_stok || 0), 0);
            const stokLokasiLama = batchAktif
                .filter((s) => s.lokasi_stok_uuid === purchaseOrder.lokasi_stok_uuid)
                .reduce((acc, s) => acc + Number(s.sisa_stok || 0), 0);
            const hargaAvgLama = hargaLamaData ? parseFloat(hargaLamaData.harga_avg) : 0;

            let newHargaAvg = 0;

            if (isAverageMethod) {
                const totalValuasiLama = Math.max(0, stokFisikLama) * hargaAvgLama;
                const totalValuasiBaru = qtyStokMasuk * hargaBeliPerSatuanKecil;
                const totalStok = Math.max(0, stokFisikLama) + qtyStokMasuk;
                if (totalStok > 0) {
                    newHargaAvg = (totalValuasiLama + totalValuasiBaru) / totalStok;
                } else {
                    newHargaAvg = hargaBeliPerSatuanKecil;
                }
            } else {
                newHargaAvg = hargaBeliPerSatuanKecil;
            }

            // Payload untuk stock medis
            itemsToCreateStock.push({
                exp_date: new Date(itemDiterima.exp_date),
                stok: qtyStokMasuk,       
                sisa_stok: qtyStokMasuk,  
                konversi_uuid: poItem.konversi_uuid,
                lokasi_stok_uuid: purchaseOrder.lokasi_stok_uuid,
                item_medis_jenis_stok_uuid: itemJenisStokUuid,
                harga_satuan: hargaBeliPerSatuanKecil,
                no_po: purchaseOrder.no_po,
                faskes_uuid: validatedData.faskes_uuid,
            });

            // Payload untuk harga
            hargaPayloads.push({
                item_medis_jenis_stok_uuid: itemJenisStokUuid,
                faskes_uuid: validatedData.faskes_uuid,
                harga_dasar: poItem.harga_satuan, 
                hna: hargaBeliPerSatuanKecil,     
                harga_terakhir: hargaBeliPerSatuanKecil,
                harga_avg: newHargaAvg,
            });

            // Payload untuk riwayat mutasi
            mutasiPayloads.push({
                uuid: uuidv7(),
                faskes_uuid: validatedData.faskes_uuid,
                code: purchaseOrder.no_po,
                item_uuid: poItem.item_uuid,
                exp_date: new Date(itemDiterima.exp_date),
                lokasi_stok_uuid: purchaseOrder.lokasi_stok_uuid,
                jenis_stok_uuid: purchaseOrder.jenis_stok_uuid,
                keterangan: {
                    description: "Penerimaan Barang PO",
                    no_po: purchaseOrder.no_po,
                    no_faktur: validatedData.no_faktur,
                    qty_terima_fisik: qtyTerimaInput,
                },
                petugas: validatedData.petugas_penerima_uuid,
                stok_awal: stokLokasiLama,
                stok_mutasi: qtyStokMasuk,
                sumber_mutasi: "inventory",
                type: "surplus",
            });
        }
        return { itemsToCreateStock, hargaPayloads, mutasiPayloads };
    }
}