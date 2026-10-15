import ReturSupplierRepository from "../repositories/retur-supplier-repository.js";
import ZodValidator from "../validations/zod-validator.js";
import ReturSupplierValidation from "../validations/retur-supplier-validation.js";
import NotfoundException from "../errors/notfound-exception.js";
import PengadaanBarangService from "./pengadaan-barang-service.js";
import Utils from "../helpers/utils.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import {uuidv7} from "uuidv7";
import {toEpochDate} from "../helpers/date-helper.js";
import InventoryBarangRepository from "../repositories/inventory-barang-repository.js";
import StockMedisRepository from "../repositories/stock-medis-repository.js";
import RiwayatMutasiService from "./riwayat-mutasi-service.js";
import ItemMedisJenisStokRepository from "../repositories/item-medis-jenis-stok-repository.js";
import InternalServerException from "../errors/internal-server-exception.js";
import SettingRepository from "../repositories/setting-repository.js";
import ReturSupplierMapper from "../mappers/retur-supplier-mapper.js";
import FarmasiExternalRepository from "../repositories/farmasi-external-repository.js";

export default class ReturSupplierService {
    static async getAll(payload) {
        const validatedReq = await ReturSupplierValidation.GET_ALL.parseAsync(payload);
        const result = await ReturSupplierRepository.getAll(validatedReq);
        result.data = result.data.map(ReturSupplierMapper.toReturListDTO);
        return result;
    }

    static async getDetail(req) {
        ZodValidator.validate(ReturSupplierValidation.GET_DETAIL, req);
        const result = await ReturSupplierRepository.getDetail(req);
        if (!result) throw new NotfoundException("Data tidak ditemukan");
        return ReturSupplierMapper.toReturDetailDTO(result);
    }

    static async getAvailableFaktur(payload) {
        return await InventoryBarangRepository.getForRetur(payload);
    }

    static async getFakturDetail(req) {
        const result = await InventoryBarangRepository.getDetail(req);
        if (!result) throw new NotfoundException("Data dengan ID ini tidak ditemukan");
        if (result.is_return) throw new NotfoundException("Data ini sudah di retur");
        const mappedData = ReturSupplierMapper.toFakturDetailDTO(result);
        mappedData.petugas_retur = req.petugas_retur;
        return mappedData;
    }

    static async create(req, headers) {
        const validatedData = await ReturSupplierValidation.CREATE.parseAsync(req);

        const pembelian = await PengadaanBarangService.getDetail({
            uuid: validatedData.pembelian_supplier_uuid,
            faskes_uuid: validatedData.faskes_uuid,
        });

        if (!pembelian || !pembelian.uuid) {
            throw new NotfoundException("Data pembelian tidak ditemukan.");
        }

        if (!pembelian.lokasi_stok_uuid) {
            throw new NotfoundException("Lokasi Stok uuid tidak ditemukan di pembelian terkait");
        }

        const transaction = await sequelizeInstance.transaction();

        try {
            let ppnRate = 0;
            if (validatedData.ppn === true) ppnRate = await SettingRepository.getCurrentPpnRate();
            const returHeaderData = {
                ...validatedData,
                uuid: uuidv7(),
                no_retur_supplier: Utils.generate4Code("RTS"),
                lokasi_stok_uuid: pembelian.lokasi_stok_uuid,
                supplier_uuid: pembelian.supplier_uuid,
                status: "retur",
                ppn: ppnRate,
                tanggal_retur: validatedData.tanggal_retur || toEpochDate(Date.now()),
            };

            await ReturSupplierRepository.create(returHeaderData, transaction);

            const returItemsData = validatedData.items.map((item) => ({
                ...item,
                faskes_uuid: validatedData.faskes_uuid,
                retur_supplier_uuid: returHeaderData.uuid,
                item_type: "retur",
            }));

            await ReturSupplierRepository.createItems(returItemsData, transaction);

            await InventoryBarangRepository.changeReturnStatus({uuid: validatedData.pembelian_supplier_uuid}, transaction);

            const konfigurasiHarga = await FarmasiExternalRepository.getKonfigurasiHarga({
                authorization: headers.authorization || headers.Authorization
            });
            
            const mutasiItems = [];
            const itemUuids = returItemsData.map(item => item.item_uuid);
            const jenisItemFilter = pembelian.jenis_item;

            const allMasterItems = await FarmasiExternalRepository.getAllItemMedis(
                { jenis_item: jenisItemFilter }, 
                headers
            );

            const filteredItems = allMasterItems.filter(item => itemUuids.includes(item.uuid));
            const itemDetailMap = new Map(filteredItems.map(item => [item.uuid, item]));

            for (const item of returItemsData) {
                const itemDetail = itemDetailMap.get(item.item_uuid);
                if (!itemDetail) throw new NotfoundException(`Item dengan uuid ${item.item_uuid} tidak ditemukan`);
                
                const affectedStocks = await StockMedisRepository.reduceQuantity({
                    item_medis_uuid: item.item_uuid,
                    jenis_stok_uuid: pembelian.jenis_stok_uuid,
                    quantity: item.qty_retur,
                    metode_pemotongan_stok: konfigurasiHarga.metode_pemotongan_stok,
                    name: itemDetail.name,
                    lokasi_stok_uuid: pembelian.lokasi_stok_uuid
                }, transaction);

                for (const reducedStock of affectedStocks) {
                    mutasiItems.push({
                        item_uuid: item.item_uuid,
                        exp_date: reducedStock.expired_date,
                        stok_awal: reducedStock.previous_stock,
                        stok_mutasi: reducedStock.quantity,
                        jenis_stok_uuid: pembelian.jenis_stok_uuid,
                        lokasi_stok_uuid: pembelian.lokasi_stok_uuid,
                        type: "defisit"
                    });
                }
            }

            await RiwayatMutasiService.create({
                faskes_uuid: validatedData.faskes_uuid,
                sumber_mutasi: "inventory",
                with_check_stock: true,
                petugas: validatedData.petugas_retur,
                code: returHeaderData.no_retur_supplier,
                keterangan: { description: "Retur Supplier" },
                items: mutasiItems
            }, { transaction });

            await transaction.commit();
        } catch (e) {
            await transaction.rollback();
            throw e;
        }
    }

    static async acceptReplacement(params, body, author) {
        const clientData = {
            uuid: params.uuid,
            ...body
        };
        const validatedClientData = await ReturSupplierValidation.ACCEPT_REPLACEMENT.parseAsync(clientData);

        const payload = {
            ...validatedClientData,
            faskes_uuid: author.faskesUuid,
            petugas_penerima_retur: author.username,
            petugas_penerima_retur_uuid: author.user_uuid
        };

        const searchParams = { uuid: payload.uuid, faskes_uuid: payload.faskes_uuid };
        
        const retur = await ReturSupplierRepository.getDetail(searchParams);
        if (!retur) throw new NotfoundException(`Data retur dengan UUID ${payload.uuid} tidak ditemukan.`);
        

        if (!retur.pembelian_supplier_uuid) {
            throw new InternalServerException("Properti 'pembelian_supplier_uuid' tidak ditemukan pada objek retur.");
        }       

        const pembelian = await PengadaanBarangService.getDetail({ 
            uuid: retur.pembelian_supplier_uuid, 
            faskes_uuid: payload.faskes_uuid 
        });

        if (!pembelian) {
            throw new NotfoundException(`Data pembelian dengan UUID ${retur.pembelian_supplier_uuid} tidak ditemukan.`);
        }

        const transaction = await sequelizeInstance.transaction();

        const updateSupplierReq = {
            uuid: payload.uuid,
            status: "terima",
            jenis_penggantian: payload.type,
            tanggal_penggantian: payload.tanggal_penggantian || toEpochDate(Date.now()),
            petugas_penerima_retur: payload.petugas_penerima_retur,
            petugas_penerima_retur_uuid: payload.petugas_penerima_retur_uuid
        };

        try {
            if (payload.type === "uang") {
                updateSupplierReq.total_pengembalian_uang = payload.harga;
            } else if (payload.type === "barang") {
                const itemsToCreate = payload.items.map((item) => ({
                    ...item,
                    faskes_uuid: payload.faskes_uuid,
                    retur_supplier_uuid: payload.uuid,
                    item_type: "replacement"
                }));

                await ReturSupplierRepository.createItems(itemsToCreate, transaction);

                const itemMedisUuids = payload.items.map(item => item.item_uuid);
                const itemJenisStokList  = await ItemMedisJenisStokRepository.getForPengadaanBarang({
                    item_medis_uuids: itemMedisUuids,
                    jenis_stok_uuid: pembelian.jenis_stok_uuid,
                    faskes_uuid: payload.faskes_uuid,
                });

                const itemJenisStokMap = new Map(
                    itemJenisStokList.map(item => [item.item_medis_uuid, item.uuid])
                );

                const stocks = itemsToCreate.map((item) => {
                    const itemJenisStokUuid = itemJenisStokMap.get(item.item_uuid);
                    if (!itemJenisStokUuid) {
                        throw new InternalServerException(`Konfigurasi jenis stok untuk item ${item.item_uuid} tidak ditemukan.`);
                    }
                    return {
                        ...item,
                        stok: item.qty_retur,
                        sisa_stok: item.qty_retur,
                        item_medis_jenis_stok_uuid: itemJenisStokUuid,
                        lokasi_stok_uuid: pembelian.lokasi_stok_uuid,
                        no_po: pembelian.no_po,
                    };
                });

                await StockMedisRepository.bulkCreate(stocks, transaction);
            }

            await ReturSupplierRepository.update(updateSupplierReq, transaction);

            await transaction.commit();
        } catch (e) {
            await transaction.rollback();
            throw e;
        }
    }
}