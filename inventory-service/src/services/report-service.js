import ReportRepository from "../repositories/report-repository.js";
import ReportValidation from "../validations/report-validation.js";
import ReportMapper from "../mappers/report-mapper.js";
import InventoryBarangRepository from "../repositories/inventory-barang-repository.js";
import HargaItemRepository from "../repositories/harga-item-repository.js";
import FarmasiExternalRepository from "../repositories/farmasi-external-repository.js"; 
import crypto from "crypto";

export default class ReportService {
    static async getExpiredItems(req, headers) {
        const validatedReq = await ReportValidation.GET_EXPIRED.parseAsync(req);
        
        let matchedItemMedisJenisStokUuids = null;
        if (validatedReq.search) {
            try {
                const variants = await FarmasiExternalRepository.getItemMedisJenisStok({
                    faskes_uuid: validatedReq.faskes_uuid,
                }, headers);

                const searchLower = validatedReq.search.toLowerCase();
                const filteredVariants = (variants || []).filter(v => {
                    const itemName = v.item_medis?.name?.toLowerCase() || "";
                    const itemCode = v.item_medis?.code?.toLowerCase() || "";
                    // Cari berdasarkan Nama ATAU Kode
                    return itemName.includes(searchLower) || itemCode.includes(searchLower);
                });
                
                if (filteredVariants.length > 0) {
                    matchedItemMedisJenisStokUuids = filteredVariants.map(v => v.uuid);
                } else {
                    matchedItemMedisJenisStokUuids = [];
                }
            } catch (e) {
                console.error("Gagal search item medis:", e.message);
                matchedItemMedisJenisStokUuids = [];
            }
        }

        const result = await ReportRepository.getExpiredItems(validatedReq, matchedItemMedisJenisStokUuids);
        
        if (result.data.length === 0) return result;

        const itemVariantUuids = new Set();
        const lokasiUuids = new Set();
        const poNumbers = new Set();

        result.data.forEach(row => {
            if (row.item_medis_jenis_stok_uuid) itemVariantUuids.add(row.item_medis_jenis_stok_uuid);
            if (row.lokasi_stok_uuid) lokasiUuids.add(row.lokasi_stok_uuid);
            if (row.no_po) poNumbers.add(row.no_po);
        });

        const [variantsRes, lokasiRes, poMap] = await Promise.all([
            itemVariantUuids.size > 0 
                ? FarmasiExternalRepository.getItemMedisJenisStok({ uuid: [...itemVariantUuids].join(",") }, headers)
                : [],
            lokasiUuids.size > 0
                ? FarmasiExternalRepository.getLokasiStok({ uuid: [...lokasiUuids].join(","), limit: 100 }, headers)
                : Promise.resolve({ payload: [] }),
            InventoryBarangRepository.getManyByNomorPO([...poNumbers], validatedReq.faskes_uuid)
        ]);

        const itemMedisUuids = new Set();
        (variantsRes || []).forEach(v => {
            if (v.item_medis_uuid) itemMedisUuids.add(v.item_medis_uuid);
        });

        let fullItemsRes = [];
        if (itemMedisUuids.size > 0) {
            fullItemsRes = await FarmasiExternalRepository.getAllItemMedis({ 
                uuid: [...itemMedisUuids] 
            }, headers);
        }

        const mapVariant = new Map((variantsRes || []).map(v => [v.uuid, v]));
        const mapLokasi = new Map((lokasiRes?.payload || []).map(l => [l.uuid, l]));
        const mapFullItem = new Map((fullItemsRes || []).map(i => [i.uuid, i])); 
        result.data = result.data.map(stock => 
            ReportMapper.toExpiredListDTO(stock, poMap, mapVariant, mapLokasi, mapFullItem)
        );
        
        return result;
    }

    static async getPersediaan(req, headers) {
        const validatedReq = await ReportValidation.GET_PERSEDIAAN.parseAsync(req);

        let matchedItemMedisJenisStokUuids = null;
        if (validatedReq.search) {
            try {
                const variants = await FarmasiExternalRepository.getItemMedisJenisStok({
                    faskes_uuid: validatedReq.faskes_uuid,
                }, headers);

                const searchLower = validatedReq.search.toLowerCase();
                const filteredVariants = (variants || []).filter(v => {
                    const itemName = v.item_medis?.name?.toLowerCase() || "";
                    const itemCode = v.item_medis?.code?.toLowerCase() || "";
                    return itemName.includes(searchLower) || itemCode.includes(searchLower);
                });
                
                if (filteredVariants.length > 0) {
                    matchedItemMedisJenisStokUuids = filteredVariants.map(v => v.uuid);
                } else {
                    matchedItemMedisJenisStokUuids = [];
                }
            } catch (e) {
                console.error("Gagal search item medis:", e.message);
                matchedItemMedisJenisStokUuids = [];
            }
        }

        const result = await ReportRepository.getPersediaan(validatedReq, matchedItemMedisJenisStokUuids);
        
        if (result.data.length === 0) return result;

        const itemVariantUuids = new Set();
        const lokasiUuids = new Set();
        
        result.data.forEach(row => {
            if (row.item_medis_jenis_stok_uuid) itemVariantUuids.add(row.item_medis_jenis_stok_uuid);
            if (row.lokasi_stok_uuid) lokasiUuids.add(row.lokasi_stok_uuid);
        });

        const [variantsRes, lokasiRes, hargaItemMap] = await Promise.all([
            itemVariantUuids.size > 0 
                ? FarmasiExternalRepository.getItemMedisJenisStok({ uuid: [...itemVariantUuids].join(",") }, headers)
                : [],
            lokasiUuids.size > 0
                ? FarmasiExternalRepository.getLokasiStok({ uuid: [...lokasiUuids].join(","), limit: 100 }, headers)
                : Promise.resolve({ payload: [] }),
            HargaItemRepository.findManyByItemJenisStok([...itemVariantUuids], validatedReq.faskes_uuid)
        ]);

        const itemMedisUuids = new Set();
        (variantsRes || []).forEach(v => {
            if (v.item_medis_uuid) itemMedisUuids.add(v.item_medis_uuid);
        });

        let fullItemsRes = [];
        if (itemMedisUuids.size > 0) {
            fullItemsRes = await FarmasiExternalRepository.getAllItemMedis({ 
                uuid: [...itemMedisUuids] 
            }, headers);
        }

        const mapVariant = new Map((variantsRes || []).map(v => [v.uuid, v]));
        const mapLokasi = new Map((lokasiRes?.payload || []).map(l => [l.uuid, l]));
        const mapFullItem = new Map((fullItemsRes || []).map(i => [i.uuid, i]));

        const initialMappedData = result.data.map(item => 
            ReportMapper.toPersediaanListDTO(item, hargaItemMap, mapVariant, mapLokasi, mapFullItem)
        );

        const mergedDataMap = new Map();

        initialMappedData.forEach(item => {
            const uniqueMergeKey = `${item.uuid}|${item.lokasi}`;
            if (mergedDataMap.has(uniqueMergeKey)) {
                const existing = mergedDataMap.get(uniqueMergeKey);
                existing.stok_akhir += item.stok_akhir;
                existing.total_harga += item.total_harga;
            } else {
                const cleanUniqueId = crypto
                    .createHash("md5")
                    .update(uniqueMergeKey)
                    .digest("hex");
                const newItem = {
                    ...item,
                    original_uuid: item.uuid,
                    uuid: cleanUniqueId
                };
                mergedDataMap.set(uniqueMergeKey, newItem);
            }
        });

        result.data = Array.from(mergedDataMap.values());
        
        return result;
    }
}