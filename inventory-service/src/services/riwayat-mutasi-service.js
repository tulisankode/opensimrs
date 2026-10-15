import ZodValidator from "../validations/zod-validator.js";
import RiwayatMutasiValidation from "../validations/riwayat-mutasi-validation.js";
import RiwayatMutasiRepository from "../repositories/riwayat-mutasi-repository.js";
import StockMedisRepository from "../repositories/stock-medis-repository.js";
import KartuStokMutasiMapper from "../mappers/kartu-stok-mutasi-mapper.js";
import FarmasiExternalRepository from "../repositories/farmasi-external-repository.js";

export default class RiwayatMutasiService {
    static async getAll(req, headers) {
        const validatedReq = await ZodValidator.validate(RiwayatMutasiValidation.GET_ALL, req);
        let matchedItemUuids = null;
        if (validatedReq.search) {
            try {
                const allItems = await FarmasiExternalRepository.getAllItemMedis({
                    faskes_uuid: validatedReq.faskes_uuid
                }, headers);

                const searchLower = validatedReq.search.toLowerCase();
                const filteredItems = (allItems || []).filter(item => 
                    (item.name && item.name.toLowerCase().includes(searchLower)) ||
                    (item.code && item.code.toLowerCase().includes(searchLower))
                );

                if (filteredItems.length > 0) {
                    matchedItemUuids = filteredItems.map(i => i.uuid);
                } else {
                    matchedItemUuids = [];
                }
            } catch (e) {
                console.error("Gagal search item medis:", e.message);
                matchedItemUuids = [];
            }
        }

        // 2. QUERY DATABASE
        const { data: rawData, pagination } = await RiwayatMutasiRepository.getAll(validatedReq, matchedItemUuids);

        if (!rawData || rawData.length === 0) {
            return { pagination, data: [] };
        }
        
        // 3. ENRICHMENT: Kumpulkan UUID
        const itemUuids = new Set();
        const jenisStokUuids = new Set();
        const lokasiUuids = new Set();

        rawData.forEach(row => {
            if (row.item_uuid) itemUuids.add(row.item_uuid);
            if (row.jenis_stok_uuid) jenisStokUuids.add(row.jenis_stok_uuid);
            if (row.lokasi_stok_uuid) lokasiUuids.add(row.lokasi_stok_uuid);

            const detailPengeluaran = row.pengeluaran_detail || row.dataValues?.pengeluaran_detail;
            if (detailPengeluaran?.lokasi_stok_tujuan_uuid) {
                lokasiUuids.add(detailPengeluaran.lokasi_stok_tujuan_uuid);
            }
        });

        // 4. PARALLEL API CALLS
        const [itemsRes, lokasiRes, jenisStokRes] = await Promise.all([
            itemUuids.size > 0 
                ? FarmasiExternalRepository.getAllItemMedis({ uuid: [...itemUuids].join(",") }, headers) 
                : [],
            lokasiUuids.size > 0 
                ? FarmasiExternalRepository.getLokasiStok({ uuid: [...lokasiUuids].join(","), limit: 100 }, headers)
                : { payload: [] },
            jenisStokUuids.size > 0
                ? FarmasiExternalRepository.getJenisStok({ uuid: [...jenisStokUuids].join(",") }, headers) 
                : []
        ]);

        // 5. MAP REFERENSI
        const mapItem = new Map((itemsRes || []).map(i => [i.uuid, i]));
        const mapLokasi = new Map((lokasiRes?.payload || []).map(l => [l.uuid, l]));
        const mapJenisStok = new Map((jenisStokRes || []).map(j => [j.uuid, j]));

        // 6. MAPPING
        const mappedData = rawData.map(item => 
            KartuStokMutasiMapper.toRiwayatMutasiListDTO(item, mapItem, mapLokasi, mapJenisStok)
        );

        return { pagination, data: mappedData };
    }

    static async create(req, options = {}) {
        ZodValidator.validate(RiwayatMutasiValidation.CREATE, req);
        for (const item of req.items) {
            if (item.exp_date && typeof item.exp_date === "string") {
                item.exp_date = new Date(item.exp_date);
            }
        }
        const mutasi = [];
        req.items.forEach((item) => {
            const existingStock = mutasi.find(
                res => res.exp_date === item.exp_date &&
                    res.item_uuid === item.item_uuid &&
                    res.lokasi_stok_uuid === item.lokasi_stok_uuid &&
                    res.jenis_stok_uuid === item.jenis_stok_uuid &&
                    res.type === item.type
            );
            if (existingStock) {
                existingStock.stok_awal += item.stok_awal;
                existingStock.stok_mutasi += item.stok_mutasi;
            } else {
                mutasi.push({
                    ...item,
                    faskes_uuid: req.faskes_uuid,
                    sumber_mutasi: req.sumber_mutasi,
                    petugas: req.petugas,
                    code: req.code,
                    keterangan: req.keterangan,
                });
            }
        });
        if (req.with_check_stock) {
            const stocks = await StockMedisRepository.getForMutasi({
                lokasi_stok_uuids: mutasi.map(item => item.lokasi_stok_uuid),
                item_uuids: mutasi.map(item => item.item_uuid),
                jenis_stok_uuids: mutasi.map(item => item.jenis_stok_uuid),
            });
            mutasi.forEach((item) => {
                const itemISODate = item.exp_date?.toISOString();
                item.stok_awal = 0;
                for (const stock of stocks) {
                    const stockDateObject = stock.exp_date ? new Date(stock.exp_date) : null;
                    const stockISODate = stockDateObject?.toISOString();
                    if (stockISODate === itemISODate &&
                        stock.lokasi_stok_uuid === item.lokasi_stok_uuid &&
                        stock.item_medis_jenis_stok?.item_medis_uuid === item.item_uuid &&
                        stock.item_medis_jenis_stok?.jenis_stok_uuid === item.jenis_stok_uuid) {
                        item.stok_awal += stock.sisa_stok;
                    }
                }
            });
        }
        await RiwayatMutasiRepository.bulkCreate(mutasi, options);
    }
}