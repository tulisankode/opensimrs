import { toEpochDate } from "../helpers/date-helper.js";

export default class RiwayatTarifMapper {
    static toListDTO(itemData, hargaData) {
        if (!itemData) return null;

        const totalStock = (itemData.stocks || []).reduce((acc, batch) => acc + batch.sisa_stok, 0);
        const latestStockBatch = (itemData.stocks || []).sort((a, b) => b.created_at - a.created_at)[0];

        let hargaItem = null;
        if (hargaData instanceof Map) {
            hargaItem = hargaData.get(itemData.uuid);
        } else if (Array.isArray(hargaData)) {
            hargaItem = hargaData.find(harga => harga.item_medis_jenis_stok_uuid === itemData.uuid);
        }

        const satuanPenggunaan = itemData.item_medis?.satuan_penggunaan?.name || latestStockBatch?.konversi?.satuan_penggunaan || null;
        const satuanPembelian = latestStockBatch?.konversi?.satuan_pembelian || satuanPenggunaan || null;

        return {
            uuid: itemData.uuid,
            item_medis_uuid: itemData.item_medis?.uuid ?? null,
            name: itemData.item_medis?.name ?? "N/A",
            jenis_item: itemData.item_medis?.jenis_item ?? null,
            jenis_stok: itemData.detail_stok?.name ?? null,
            kategori_item: "medis",
            stok: totalStock,
            satuan_pembelian: satuanPembelian,
            satuan_penggunaan: satuanPenggunaan,
            exp_date: latestStockBatch?.exp_date ? toEpochDate(latestStockBatch.exp_date) : "-",
            harga_dasar: hargaItem?.harga_dasar ?? 0,
            hna: hargaItem?.hna ?? 0,
            hja: hargaItem?.harga_terakhir ?? 0,
        };
    }

    static toDetailDTO(itemJenisStok, purchaseHistory, conversions, hargaItem) {
        if (!itemJenisStok || !itemJenisStok.item_medis) return null;

        const { item_medis, detail_stok } = itemJenisStok;

        const formattedHistory = (purchaseHistory ?? []).map((item) => ({
            tanggal: item.created_at,
            exp_date: item.exp_date ? toEpochDate(item.exp_date) : "-",
            harga_dasar: Number(item.harga_satuan || 0),
            hna: item.hna_calculated !== undefined ? item.hna_calculated : Number(item.harga_satuan || 0),
            hja: item.hja_calculated !== undefined ? item.hja_calculated : Number(item.harga_satuan || 0),
            no_po: item.no_po,
        }));

        const latestData = formattedHistory.length > 0 ? formattedHistory[0] : null;

        return {
            kode_item: item_medis?.code,
            kategori_item: "medis",
            jenis_item: item_medis?.jenis_item,
            jenis_stok: detail_stok?.name,
            satuan_penggunaan: item_medis?.satuan_penggunaan?.name,
            harga_dasar: latestData ? latestData.harga_dasar : (hargaItem?.harga_dasar ?? 0),
            hna: latestData ? latestData.hna : (hargaItem?.hna ?? 0),
            hja: latestData ? latestData.hja : (hargaItem?.harga_terakhir ?? 0),
            pabrik: item_medis?.manufacture?.name,
            conversions: conversions ?? [],
            purchase_history: formattedHistory,
        };
    }
}