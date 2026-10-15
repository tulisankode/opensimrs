import ZodValidator from "../validations/zod-validator.js";
import PengeluaranUnitValidation from "../validations/pengeluaran-unit-validation.js";
import {uuidv7} from "uuidv7";
import Utils from "../helpers/utils.js";
import PengeluaranUnitRepository from "../repositories/pengeluaran-unit-repository.js";
import PengeluaranUnitItemRepository from "../repositories/pengeluaran-unit-item-repository.js";
import StockMedisRepository from "../repositories/stock-medis-repository.js";
import BadRequestException from "../errors/bad-request-exception.js";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import RiwayatMutasiService from "./riwayat-mutasi-service.js";
import InternalServerException from "../errors/internal-server-exception.js";
import PengeluaranUnitMapper from "../mappers/pengeluaran-unit-mapper.js";
import FarmasiExternalRepository from "../repositories/farmasi-external-repository.js";

export default class PengeluaranUnitService {
    static async getAvailableStock(req, headers) {
        ZodValidator.validate(PengeluaranUnitValidation.GET_AVAILABLE_STOCK, req);
        req.tanggal_pengeluaran = new Date(Number(req.tanggal_pengeluaran));
        const data = await StockMedisRepository.getAllForPengeluaran(req);
        if (data && data.length > 0) {
            const itemUuids = [...new Set(data.map(d => d.item_medis_jenis_stok?.item_medis_uuid).filter(Boolean))];
            let mapItem = new Map();
            if (itemUuids.length > 0) {
                const itemsRes = await FarmasiExternalRepository.getAllItemMedis({ uuid: itemUuids }, headers);
                if(itemsRes) mapItem = new Map(itemsRes.map(i => [i.uuid, i]));
            }
            return PengeluaranUnitMapper.toAvailableStockDTO(data, mapItem);
        }
        return PengeluaranUnitMapper.toAvailableStockDTO(data);
    }

    static async getAll(req, headers) {
        const validatedData = await PengeluaranUnitValidation.GET_ALL.parseAsync(req);
        let result = await PengeluaranUnitRepository.getAll(validatedData);
        if (result && result.data && result.data.length > 0) {
            const lokasiUuids = new Set();
            const jenisStokUuids = new Set();

            result.data.forEach(row => {
                if (row.lokasi_stok_awal_uuid) lokasiUuids.add(row.lokasi_stok_awal_uuid);
                if (row.lokasi_stok_tujuan_uuid) lokasiUuids.add(row.lokasi_stok_tujuan_uuid);
                if (row.jenis_stok_uuid) jenisStokUuids.add(row.jenis_stok_uuid);
            });

            const [lokasiRes, jenisStokRes] = await Promise.all([
                lokasiUuids.size > 0 
                    ? FarmasiExternalRepository.getLokasiStok({ uuid: [...lokasiUuids].join(",") }, headers)
                    : Promise.resolve({ payload: [] }),
                jenisStokUuids.size > 0 
                    ? FarmasiExternalRepository.getJenisStok({ uuid: [...jenisStokUuids] }, headers)
                    : Promise.resolve([])
            ]);

            const mapLokasi = new Map((lokasiRes?.payload || []).map(l => [l.uuid, l]));
            const mapJenisStok = new Map((jenisStokRes || []).map(j => [j.uuid, j]));

            result.data = PengeluaranUnitMapper.toListDTO(result.data, mapLokasi, mapJenisStok);
        } else if (result && result.data) {
            result.data = [];
        }
        return result;
    }

    static async getDetail(req, headers) {
        const validatedData = await PengeluaranUnitValidation.GET_DETAIL.parseAsync(req);
        
        // 1. Ambil Data Lokal (Transaksi & Stok)
        const data = await PengeluaranUnitRepository.getDetail(validatedData.uuid);
        if (!data) throw new BadRequestException("Data not found");

        // 2. Kumpulkan UUID untuk Request ke API External
        const lokasiUuids = new Set();
        if (data.lokasi_stok_awal_uuid) lokasiUuids.add(data.lokasi_stok_awal_uuid);
        if (data.lokasi_stok_tujuan_uuid) lokasiUuids.add(data.lokasi_stok_tujuan_uuid);

        const jenisStokUuid = data.jenis_stok_uuid;
        const itemMedisJenisStokUuids = new Set();
        
        if (data.items && data.items.length > 0) {
            data.items.forEach(item => {
                const stock = item.stok;
                if (stock?.item_medis_jenis_stok_uuid) { 
                    itemMedisJenisStokUuids.add(stock.item_medis_jenis_stok_uuid);
                }
            });
        }

        // 3. Request ke API (Batch 1: Lokasi, Jenis Stok Header, & Item Medis Jenis Stok)
        const [lokasiRes, jenisStokRes, itemJenisStokRes] = await Promise.all([
            lokasiUuids.size > 0 
                ? FarmasiExternalRepository.getLokasiStok({ uuid: [...lokasiUuids].join(",") }, headers)
                : Promise.resolve({ payload: [] }),
            jenisStokUuid 
                ? FarmasiExternalRepository.getJenisStok({ uuid: jenisStokUuid }, headers)
                : Promise.resolve([]),
            // CALL API BARU DISINI
            itemMedisJenisStokUuids.size > 0
                ? FarmasiExternalRepository.getItemMedisJenisStok({ uuid: [...itemMedisJenisStokUuids] }, headers)
                : Promise.resolve([]) 
        ]);
        
        const mapItemJenisStok = new Map((itemJenisStokRes || []).map(i => [i.uuid, i]));
        const itemMedisUuids = new Set();

        itemJenisStokRes.forEach(item => {
            if (item.item_medis?.uuid) {
                itemMedisUuids.add(item.item_medis.uuid);
            }
        });

        const itemsRes = itemMedisUuids.size > 0
            ? await FarmasiExternalRepository.getAllItemMedis({ uuid: [...itemMedisUuids] }, headers)
            : [];

        const mapLokasi = new Map((lokasiRes?.payload || []).map(l => [l.uuid, l]));
        const mapJenisStok = new Map((jenisStokRes || []).map(j => [j.uuid, j]));
        
        // Gunakan optional chaining untuk handle format payload yang mungkin berbeda
        const itemList = Array.isArray(itemsRes) ? itemsRes : (itemsRes?.payload || []);
        const mapItemMedis = new Map(itemList.map(i => [i.uuid, i]));

        // 6. Return ke Mapper dengan Map tambahan
        return PengeluaranUnitMapper.toDetailDTO(data, mapLokasi, mapJenisStok, mapItemMedis, mapItemJenisStok);
    }

    static async create(req) {
        let validatedData = await PengeluaranUnitValidation.CREATE.parseAsync(req);

        let lokasiStokAwalUuidToUse;
        let lokasiStokTujuanUuidForHeader = null;
        let jenisPemusnahanForHeader = null;

        if (validatedData.jenis_pengeluaran === "pemakaian unit") {
            lokasiStokAwalUuidToUse = validatedData.lokasi_stok_awal_uuid; 
        } else if (validatedData.jenis_pengeluaran === "pemusnahan barang") {
            lokasiStokAwalUuidToUse = validatedData.lokasi_stok_awal_uuid;
            jenisPemusnahanForHeader = validatedData.jenis_pemusnahan;
        } else { 
            lokasiStokAwalUuidToUse = validatedData.lokasi_stok_awal_uuid;
            lokasiStokTujuanUuidForHeader = validatedData.lokasi_stok_tujuan_uuid;
        }

        const transaction = await sequelizeInstance.transaction();

        try {
            const pengeluaranHeader = {
                faskes_uuid: validatedData.faskes_uuid,
                jenis_pengeluaran: validatedData.jenis_pengeluaran,
                jenis_item: validatedData.jenis_item,
                kategori_item: validatedData.kategori_item,
                jenis_stok_uuid: validatedData.jenis_stok_uuid,
                tanggal_pengeluaran: validatedData.tanggal_pengeluaran,
                petugas_pengeluaran: validatedData.petugas_pengeluaran,
                petugas_pengeluaran_uuid: validatedData.petugas_pengeluaran_uuid,
                catatan: validatedData.catatan,
                lokasi_stok_awal_uuid: lokasiStokAwalUuidToUse,
                lokasi_stok_tujuan_uuid: lokasiStokTujuanUuidForHeader,
                jenis_pemusnahan: jenisPemusnahanForHeader,
                uuid: uuidv7(),
                no_pengeluaran: Utils.generate4Code("PGL"),
                total_item: validatedData.items.length,
                total_harga: validatedData.items.reduce((acc, item) => acc + (item.harga_satuan * item.qty), 0),
            };

            const pengeluaranItems = validatedData.items.map((item) => ({
                ...item,
                pengeluaran_unit_uuid: pengeluaranHeader.uuid,
                faskes_uuid: validatedData.faskes_uuid,
                uuid: uuidv7()
            }));

            await PengeluaranUnitRepository.create(pengeluaranHeader, transaction);
            await PengeluaranUnitItemRepository.bulkCreate(pengeluaranItems, transaction);

            const allMutasiItems = []; 
            for (const item of pengeluaranItems) {
                const affectedStocks = await StockMedisRepository.reduceQuantity({
                    stock_medis_uuid: item.stock_uuid, 
                    quantity: item.qty,
                    faskes_uuid: validatedData.faskes_uuid,
                    lokasi_stok_awal_uuid: lokasiStokAwalUuidToUse 
                }, transaction);

                if (!affectedStocks) { 
                    throw new InternalServerException(`Pengurangan stok gagal untuk ${item.stock_uuid}`);
                }

                const stockDataFromSource = affectedStocks;

                const jenisStokFromHeader = validatedData.jenis_stok_uuid;
                const jenisStokFromBatch = stockDataFromSource.item_medis_jenis_stok.jenis_stok_uuid;

                if (jenisStokFromHeader !== jenisStokFromBatch) {
                    throw new BadRequestException("Data tidak cocok");
                }

                allMutasiItems.push({
                    item_uuid: stockDataFromSource.item_medis_jenis_stok.item_medis_uuid,
                    exp_date: stockDataFromSource.exp_date, 
                    stok_awal: stockDataFromSource.previous_stock, 
                    stok_mutasi: item.qty * -1, 
                    jenis_stok_uuid: stockDataFromSource.item_medis_jenis_stok.jenis_stok_uuid,
                    lokasi_stok_uuid: lokasiStokAwalUuidToUse,
                    type: "defisit"
                });

                if (validatedData.jenis_pengeluaran === "pengeluaran tanpa permintaan") {
                    const { previous_stock: targetPreviousStock } = await StockMedisRepository.increaseQuantity({
                        item_uuid: stockDataFromSource.item_medis_jenis_stok.item_medis_uuid,
                        quantity_to_add: item.qty,
                        lokasi_stok_uuid: validatedData.lokasi_stok_tujuan_uuid, 
                        jenis_stok_uuid: stockDataFromSource.item_medis_jenis_stok.jenis_stok_uuid,
                        exp_date: stockDataFromSource.exp_date,
                        harga_satuan: stockDataFromSource.harga_satuan,
                        konversi_uuid: stockDataFromSource.konversi_uuid,
                        faskes_uuid: validatedData.faskes_uuid,
                        no_po: stockDataFromSource.no_po,
                    }, transaction);

                    allMutasiItems.push({
                        item_uuid: stockDataFromSource.item_medis_jenis_stok.item_medis_uuid,
                        exp_date: stockDataFromSource.exp_date,
                        stok_awal: targetPreviousStock, 
                        stok_mutasi: item.qty, 
                        jenis_stok_uuid: stockDataFromSource.item_medis_jenis_stok.jenis_stok_uuid,
                        lokasi_stok_uuid: validatedData.lokasi_stok_tujuan_uuid,
                        type: "surplus"
                    });
                }
            }

            if (allMutasiItems.length > 0) {
                 await RiwayatMutasiService.create({
                    faskes_uuid: validatedData.faskes_uuid,
                    sumber_mutasi: "inventory",
                    petugas: validatedData.petugas_pengeluaran,
                    code: pengeluaranHeader.no_pengeluaran,
                    keterangan: { description: validatedData.jenis_pengeluaran },
                    items: allMutasiItems,
                }, { transaction });
            }

            await transaction.commit();

        } catch (e) {
            await transaction.rollback();
            throw e; 
        }
    }
}