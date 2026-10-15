import ItemMedisJenisStokRepository from "../repositories/item-medis-jenis-stok-repository.js";
import StockMedisRepository from "../repositories/stock-medis-repository.js";
import NotfoundException from "../errors/notfound-exception.js";
import HargaItemRepository from "../repositories/harga-item-repository.js";
import RiwayatTarifMapper from "../mappers/riwayat-tarif-mapper.js";
import FarmasiExternalRepository from "../repositories/farmasi-external-repository.js";

export default class RiwayatTarifService {
    static async getAll(req) {
        const result = await StockMedisRepository.getRiwayatTarif(req);
        if (!result.data || result.data.length === 0) return result;
        const itemJenisStokUuids = result.data.map(item => item.uuid);
        const hargaData = await HargaItemRepository.findManyByItemJenisStok(itemJenisStokUuids, req.faskes_uuid);
        result.data = result.data.map(item => RiwayatTarifMapper.toListDTO(item, hargaData));
        return result;
    }

    static async getDetail(req) {
        const itemJenisStok = await ItemMedisJenisStokRepository.getDetailForRiwayatTarif(req);
        if (!itemJenisStok) throw new NotfoundException("Item jenis stok dengan id ini tidak ditemukan");

        const historyOptions = {
            item_medis_jenis_stok_uuid: itemJenisStok.uuid,
            faskes_uuid: req.faskes_uuid,
        };

        // Siapkan parameter untuk API Farmasi
        const conversionParams = {
            item_medis_uuid: itemJenisStok.item_medis_uuid,
            faskes_uuid: req.faskes_uuid,
        };

        // Ambil headers dari request untuk diteruskan (Token Auth)
        const headers = req.headers || {};

        // Gunakan Promise.all untuk eksekusi paralel (DB Inventory & API Farmasi)
        const [purchaseHistory, conversionsRaw, hargaItem, configHarga] = await Promise.all([
            StockMedisRepository.getPurchaseHistory(historyOptions),
            FarmasiExternalRepository.getConversionByItem(conversionParams, headers), 
            HargaItemRepository.findOneByItemJenisStok(itemJenisStok.uuid, req.faskes_uuid),
            FarmasiExternalRepository.getKonfigurasiHarga(headers)
        ]);

        const conversions = conversionsRaw || [];

        const ppnPersenConfig = configHarga?.ppn ? Number(configHarga.ppn) : 0; 
        const marginPersenConfig = configHarga?.margin ? Number(configHarga.margin) : 0;

        const enrichedPurchaseHistory = (purchaseHistory || []).map(row => {
            const rowData = (row && typeof row.toJSON === "function") ? row.toJSON() : row;

            const hargaDasar = Number(row.harga_satuan || 0);
            const diskon = Number(row.diskon_nominal || 0);
            const materai = Number(row.materai_nominal || 0);
            
            let ppnNominal = Number(row.ppn_nominal || 0);
            if (ppnNominal === 0 && ppnPersenConfig > 0) {
                ppnNominal = hargaDasar * (ppnPersenConfig / 100);
            }

            let hna = hargaDasar;
            if (diskon > 0) hna -= diskon;
            hna += ppnNominal; 
            if (materai > 0) hna += materai;
            const marginValue = hna * (marginPersenConfig / 100);
            const hja = hna + marginValue;

            return {
                ...rowData,
                hna_calculated: hna,
                hja_calculated: hja,
            };
        });

        return RiwayatTarifMapper.toDetailDTO(
            itemJenisStok, 
            enrichedPurchaseHistory, 
            conversions, 
            hargaItem
        );
    }
}