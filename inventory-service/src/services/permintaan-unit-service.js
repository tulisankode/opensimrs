import ZodValidator from "../validations/zod-validator.js";
import PermintaanUnitValidation from "../validations/permintaan-unit-validation.js";
import PermintaanUnitRepository from "../repositories/permintaan-unit-repository.js";
import BadRequestException from "../errors/bad-request-exception.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import PermintaanUnitItemRepository from "../repositories/permintaan-unit-item-repository.js";
import {uuidv7} from "uuidv7";
import Utils from "../helpers/utils.js";
import StockMedisRepository from "../repositories/stock-medis-repository.js";
import RiwayatMutasiService from "./riwayat-mutasi-service.js";
import UserRepository from "../repositories/user-repository.js";
import FarmasiExternalRepository from "../repositories/farmasi-external-repository.js";
import { toEpochDate } from "../helpers/date-helper.js";
import PermintaanUnitMapper from "../mappers/permintaan-unit-mapper.js";

export default class PermintaanUnitService {
    static async getAll(req, headers) {
        ZodValidator.validate(PermintaanUnitValidation.GET_ALL, req);
        let matchedLocationUuids = [];
        
        if (req.search) {
            try {
                const resLocSearch = await FarmasiExternalRepository.getLokasiStok({
                    faskes_uuid: req.faskes_uuid,
                    name: req.search
                }, headers);
                
                const locationsSearch = resLocSearch.payload || [];
                matchedLocationUuids = locationsSearch.map(l => l.uuid);
            } catch (e) {
                console.error("DEBUG: Gagal search lokasi:", e.message);
            }
        }

        const result = await PermintaanUnitRepository.getAll(req, matchedLocationUuids);

        if (result.data && result.data.length > 0) {
            const uuidsToFetch = [
                ...new Set(result.data.map(row => row.lokasi_stok_tujuan_uuid).filter(Boolean))
            ];

            let locationMap = new Map();

            if (uuidsToFetch.length > 0) {
                try {
                    const resLocDetail = await FarmasiExternalRepository.getLokasiStok({
                        faskes_uuid: req.faskes_uuid,
                        limit: 100
                    }, headers);

                    const locationsDetail = resLocDetail.payload || [];
                    locationMap = new Map(locationsDetail.map(l => [l.uuid, l]));
                } catch (e) {
                    console.error("DEBUG: Gagal load detail lokasi:", e.message);
                }
            }

            result.data = PermintaanUnitMapper.toListDTO(result.data, locationMap);
        }
        return result;
    }

    static async getDetail(req, headers) {
        ZodValidator.validate(PermintaanUnitValidation.GET_DETAIL, req);
        const result = await PermintaanUnitRepository.getDetail(req);
        let locations = [];
        let allItems = [];
        let conversionMap = new Map();

        try {
            const [locRes, itemsRes] = await Promise.all([
                FarmasiExternalRepository.getLokasiStok({}, headers),
                FarmasiExternalRepository.getAllItemMedis({}, headers)
            ]);

            locations = locRes?.payload || [];
            allItems = itemsRes || [];

            if (result.items && result.items.length > 0) {
                const conversionPromises = result.items.map(async (item) => {
                    const convList = await FarmasiExternalRepository.getConversionByItem(
                        { item_medis_uuid: item.item_medis_uuid }, 
                        headers
                    );
                    const match = (convList || []).find(c => c.uuid === item.konversi_uuid);
                    return match ? [item.konversi_uuid, match] : null;
                });

                const conversionResults = await Promise.all(conversionPromises);
                conversionMap = new Map(conversionResults.filter(Boolean));
            }
        } catch (e) {
            console.error("DEBUG DETAIL: Error ambil data external", e.message);
        }

        const locationMap = new Map(locations.map(l => [l.uuid, l]));
        const itemMap = new Map(allItems.map(i => [i.uuid, i]));

        return PermintaanUnitMapper.toDetailDTO(result, locationMap, itemMap, conversionMap);
    }

    static async tolakPermintaan(req) { 
        const validatedInput = await ZodValidator.validate(PermintaanUnitValidation.TOLAK_PERMINTAAN, req);
        // Hanya permintaan milik faskes ini yang belum dikirim yang boleh dibatalkan; setelah dikirim
        // stok sudah berpindah sehingga pembatalan akan membuat status tidak sesuai mutasi stok.
        const permintaan = await PermintaanUnitRepository.getDetail({
            uuid: validatedInput.uuid,
            faskes_uuid: req.faskes_uuid,
        });
        if (["dikirim", "cancel"].includes(permintaan.status)) {
            throw new BadRequestException(`Permintaan dengan status ${permintaan.status} tidak dapat dibatalkan.`);
        }
        const dataToUpdate = {
            uuid: validatedInput.uuid,             
            faskes_uuid: req.faskes_uuid,
            status: "cancel",                         
            alasan_batal_tolak: validatedInput.alasan_batal, 
            petugas_batal_tolak: validatedInput.petugas_batal_tolak,
        };
        await PermintaanUnitRepository.update(dataToUpdate); 
        const responsePayload = {
            uuid: validatedInput.uuid, 
            alasan_batal: validatedInput.alasan_batal, 
            petugas_batal_tolak: validatedInput.petugas_batal_tolak, 
            status: "cancel"
        };
        return responsePayload;
    }

    static async verifikasiPermintaan(req, headers) {
        const validatedReq = await ZodValidator.validate(PermintaanUnitValidation.VERIFIKASI_PERMINTAAN, req);
        const dataPetugas = await UserRepository.findByUuid(req.petugas_uuid || validatedReq.petugas_uuid);
        const transaction = await sequelizeInstance.transaction();
        try {
            // Ambil detail permintaan
            const permintaan = await PermintaanUnitRepository.getDetail({
                uuid: validatedReq.uuid,
                faskes_uuid: validatedReq.faskes_uuid,
            });

            // Validasi data permintaan
            if (!permintaan) {
                throw new BadRequestException("Data tidak ditemukan");
            }

            if (permintaan.status !== "request" && permintaan.status !== "request_sebagian") {
                throw new BadRequestException(`Permintaan dengan status ${permintaan.status} tidak dapat diverifikasi.`);
            }

            // Memisahkan item
            const nonUsedItems = [];
            const halfUsedItems = [];
            const usedItems = [];
            permintaan.items.forEach((item) => {
                const selectedItems = validatedReq.item.find((sel) => sel.uuid === item.uuid);
                if (!selectedItems) {
                    nonUsedItems.push({ ...item.dataValues });
                } else {
                    const requestedQty = item.qty_permintaan;
                    const verifiedQty = selectedItems.quantity;
                    if (verifiedQty < requestedQty) {
                        halfUsedItems.push({
                            ...item.dataValues,
                            remainingQty: requestedQty - verifiedQty,
                            qty_pengiriman: verifiedQty,
                            id: undefined,
                        });
                    } else {
                        usedItems.push({ ...item.dataValues, qty_pengiriman: requestedQty });
                    }
                }
            });

            if (usedItems.length === 0 && halfUsedItems.length === 0) {
                throw new BadRequestException(
                    "Verifikasi gagal. Tidak ada item yang diverifikasi sama sekali. Periksa kembali UUID item atau jumlah yang diinput."
                );
            }
            
            // Update item yang sudah diverifikasi sebagian 
            for (const item of halfUsedItems) {
                await PermintaanUnitItemRepository.update({
                    uuid: item.uuid,
                    qty_pengiriman: item.qty_pengiriman,
                }, transaction);
            }

            // Update item yang sudah diverifikasi penuh
            for (const item of usedItems) {
                await PermintaanUnitItemRepository.update({
                    uuid: item.uuid,
                    qty_pengiriman: item.qty_pengiriman,
                }, transaction);
            }

            // Membuat permintaan baru untuk sisa item
            let newPermintaanUuid = null;
            if (nonUsedItems.length > 0 || halfUsedItems.length > 0) {
                const newPermintaanHeader = {
                    ...permintaan.dataValues, 
                    uuid: uuidv7(),
                    no_permintaan: Utils.generate4Code("PRM"),
                    status: "request_sebagian", 
                    petugas_verifikasi: null,
                    petugas_pengiriman: null,
                    catatan_pengiriman: null,
                    medical_stocks: null, 
                    items: undefined,
                };

                delete newPermintaanHeader.items;
                delete newPermintaanHeader.id;

                const createdNewPermintaan = await PermintaanUnitRepository.create(newPermintaanHeader, transaction);
                newPermintaanUuid = createdNewPermintaan.uuid;

                for (const item of nonUsedItems) {
                    await PermintaanUnitItemRepository.update({
                        uuid: item.uuid,
                        permintaan_unit_uuid: newPermintaanUuid,
                        qty_pengiriman: 0, 
                    }, transaction);
                }

                for (const item of halfUsedItems) {
                    await PermintaanUnitItemRepository.create({
                        permintaan_unit_uuid: newPermintaanUuid,
                        item_uuid: item.item_uuid,
                        konversi_uuid: item.konversi_uuid,
                        qty_permintaan: item.remainingQty, 
                        qty_pengiriman: 0, 
                        stok_awal_lokasi_penerima: item.stok_awal_lokasi_penerima,
                        kategori_item: item.kategori_item,
                        uuid: uuidv7(),
                        faskes_uuid: validatedReq.faskes_uuid,
                    }, transaction);
                }
            }

            // Alokasi Stock
            const konfigurasiHarga = await FarmasiExternalRepository.getKonfigurasiHarga({
                authorization: headers.authorization || headers.Authorization
            });
            const allocatedMedicalStocks = [];
            const allUsedItemsForAllocation = [...usedItems, ...halfUsedItems];

            console.log(`\n================ START ALOKASI STOK (${allUsedItemsForAllocation.length} ITEMS) ================`);

            for (const item of allUsedItemsForAllocation) {
                console.log(`\n[DEBUG-KONVERSI] Memproses Item UUID: ${item.item_uuid}`);
                console.log(`[DEBUG-KONVERSI] Qty Verifikasi (Input): ${item.qty_pengiriman}`);
                console.log(`[DEBUG-KONVERSI] Konversi UUID dari Request: ${item.konversi_uuid}`);
                let multiplier = 1;
                try {
                    const conversionList = await FarmasiExternalRepository.getConversionByItem({
                        item_medis_uuid: item.item_uuid,
                        faskes_uuid: validatedReq.faskes_uuid
                    }, headers);
                    console.log(`[DEBUG-KONVERSI] API Farmasi mereturn ${conversionList?.length || 0} data konversi.`);
                    if(conversionList && conversionList.length > 0) {
                        const availableUuids = conversionList.map(c => `${c.satuan_pembelian} (${c.uuid})`).join(", ");
                        console.log(`[DEBUG-KONVERSI] List Konversi Tersedia: ${availableUuids}`);
                    }
                    const selectedConversion = conversionList.find(c => c.uuid === item.konversi_uuid);
                    if (selectedConversion) {
                        console.log(`[DEBUG-KONVERSI] MATCH FOUND! Satuan: ${selectedConversion.satuan_pembelian}, Nilai Konversi: ${selectedConversion.konversi}`);
                        if (selectedConversion.konversi) {
                            multiplier = parseFloat(selectedConversion.konversi);
                        } else {
                            console.log("[DEBUG-KONVERSI] WARNING: Data ditemukan tapi nilai 'konversi' kosong/null/0. Fallback ke 1.");
                        }
                    } else {
                        console.log("[DEBUG-KONVERSI] !!! MATCH NOT FOUND. UUID ${item.konversi_uuid} tidak ada di list Farmasi.");
                        console.log("[DEBUG-KONVERSI] Menggunakan Multiplier Default: 1");
                    }
                } catch (err) {
                    console.error(`DEBUG: Gagal ambil konversi untuk item ${item.item_uuid}`, err.message);
                }

                const realQuantityNeeded = item.qty_pengiriman * multiplier;
                console.log(`[DEBUG-KONVERSI] HASIL AKHIR: ${item.qty_pengiriman} (Input) x ${multiplier} (Rate) = ${realQuantityNeeded} (Butuh Stok)`);

                const allocatedBatches = await StockMedisRepository.findBatchesForAllocation({
                    item_medis_uuid: item.item_uuid,
                    jenis_stok_uuid: permintaan.jenis_stok_uuid, 
                    quantity_needed: realQuantityNeeded, 
                    metode_pemotongan_stok: konfigurasiHarga?.metode_pemotongan_stok || "FEFO",
                    lokasi_stok_uuid: permintaan.lokasi_stok_awal_uuid,
                    faskes_uuid: validatedReq.faskes_uuid
                 }, transaction);

                if (!allocatedBatches || allocatedBatches.length === 0) {
                     throw new BadRequestException(`Stok tidak cukup untuk item ${item.item_medis?.name || item.item_uuid}`);
                 }

                 allocatedMedicalStocks.push(...allocatedBatches);
            }

            const finalStatus = (nonUsedItems.length === 0 && halfUsedItems.length === 0) ? "verified" : "verif_sebagian";

            await PermintaanUnitRepository.update({
                uuid: validatedReq.uuid,
                faskes_uuid: validatedReq.faskes_uuid,
                status: finalStatus,
                petugas_verifikasi: dataPetugas.username,
                petugas_verifikasi_uuid: dataPetugas.uuid,
                waktu_verifikasi: toEpochDate(new Date()),
                total_item: allUsedItemsForAllocation.length, 
                medical_stocks: allocatedMedicalStocks 
            }, transaction);
            await transaction.commit();

            const lokasiBerkurangUuid = permintaan.lokasi_stok_awal_uuid; // Gudang Sumber
            const lokasiBertambahUuid = permintaan.lokasi_stok_tujuan_uuid; // Depo Tujuan

            return { 
                uuid_permintaan_diverifikasi: validatedReq.uuid, 
                status_permintaan: finalStatus, 
                uuid_permintaan_baru: newPermintaanUuid,
                lokasi_sumber_stok_uuid: lokasiBerkurangUuid, 
                lokasi_tujuan_stok_uuid: lokasiBertambahUuid
            };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    static async kirimPermintaan(req) {
        const validatedInput = await ZodValidator.validate(PermintaanUnitValidation.KIRIM_PERMINTAAN, req);
        const dataPetugas = await UserRepository.findByUuid(req.petugas_uuid);
        const transaction = await sequelizeInstance.transaction();
        try {
            const permintaan = await PermintaanUnitRepository.getDetail({
                faskes_uuid: validatedInput.faskes_uuid,
                uuid: validatedInput.uuid
            });

            if (!permintaan) {
                throw new BadRequestException("Data tidak ditemukan");
            }
            if (permintaan.status !== "verified" && permintaan.status !== "verif_sebagian") {
                 throw new BadRequestException(`Permintaan dengan status ${permintaan.status} tidak dapat dikirim.`);
            }
            if (!permintaan.medical_stocks || permintaan.medical_stocks.length === 0) {
                throw new BadRequestException("Alokasi stok medis (medical_stocks) tidak ditemukan dalam data permintaan. Verifikasi mungkin belum selesai.");
            }

            const allMutasiItems = [];
            
            for (const allocatedStock of permintaan.medical_stocks) {
                const lokasiSumberStok = permintaan.lokasi_stok_awal_uuid;

                const reducedStockInfo = await StockMedisRepository.reduceQuantity({
                    stock_medis_uuid: allocatedStock.stock_medis_uuid,
                    quantity: allocatedStock.quantity,
                    faskes_uuid: validatedInput.faskes_uuid,
                    lokasi_stok_awal_uuid: lokasiSumberStok
                }, transaction);

                allMutasiItems.push({
                    item_uuid: reducedStockInfo.item_medis_jenis_stok.item_medis_uuid,
                    exp_date: reducedStockInfo.exp_date,
                    stok_awal: reducedStockInfo.previous_stock,
                    stok_mutasi: allocatedStock.quantity * -1, 
                    jenis_stok_uuid: permintaan.jenis_stok_uuid, 
                    lokasi_stok_uuid: lokasiSumberStok, 
                    type: "defisit"
                });

                const lokasiTujuanStok = permintaan.lokasi_stok_tujuan_uuid;

                const { previous_stock: targetPreviousStock } = await StockMedisRepository.increaseQuantity({
                    item_uuid: reducedStockInfo.item_medis_jenis_stok.item_medis_uuid,
                    quantity_to_add: allocatedStock.quantity, 
                    lokasi_stok_uuid: lokasiTujuanStok, 
                    jenis_stok_uuid: permintaan.jenis_stok_uuid, 
                    exp_date: reducedStockInfo.exp_date,
                    harga_satuan: reducedStockInfo.harga_satuan, 
                    konversi_uuid: reducedStockInfo.konversi_uuid,
                    faskes_uuid: validatedInput.faskes_uuid,
                    no_po: reducedStockInfo.no_po,
                }, transaction);

                allMutasiItems.push({
                    item_uuid: reducedStockInfo.item_medis_jenis_stok.item_medis_uuid,
                    exp_date: reducedStockInfo.exp_date,
                    stok_awal: targetPreviousStock,
                    stok_mutasi: allocatedStock.quantity, 
                    jenis_stok_uuid: permintaan.jenis_stok_uuid, 
                    lokasi_stok_uuid: lokasiTujuanStok, 
                    type: "surplus"
                });
            }

            await PermintaanUnitRepository.update({
                uuid: validatedInput.uuid,
                faskes_uuid: validatedInput.faskes_uuid,
                status: "dikirim",
                petugas_kirim: dataPetugas.username,
                petugas_kirim_uuid: dataPetugas.uuid,
                catatan_pengiriman: validatedInput.catatan_pengiriman
            }, transaction);

            if (allMutasiItems.length > 0) {
                 await RiwayatMutasiService.create({
                    faskes_uuid: validatedInput.faskes_uuid,
                    sumber_mutasi: "inventory",
                    petugas: dataPetugas.username,
                    code: permintaan.no_permintaan, 
                    keterangan: { description: `Pengiriman Permintaan Unit no: ${permintaan.no_permintaan}` },
                    items: allMutasiItems, 
                }, { transaction }); 
            }
            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
}