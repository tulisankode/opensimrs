export default class ReportMapper {
    static toExpiredListDTO(stock, poMap, mapVariant, mapLokasi, mapFullItem = new Map()) {
        const uuid = stock.uuid || "N/A";
        const lokasiData = mapLokasi.get(stock.lokasi_stok_uuid);
        const variantData = mapVariant.get(stock.item_medis_jenis_stok_uuid);
        const fullItemData = variantData?.item_medis_uuid ? mapFullItem.get(variantData.item_medis_uuid) : null;
        const itemMedisVariant = variantData?.item_medis;
        const detailStok = variantData?.detail_stok;

        const lokasi = lokasiData?.name || "N/A";
        const kodeItem = itemMedisVariant?.code || "N/A";
        const namaItem = itemMedisVariant?.name || "N/A";
        const jenisStok = detailStok?.name || "N/A";
        const jenisItem = fullItemData?.jenis_item || "N/A"; 
        const satuan = fullItemData?.satuan_penggunaan?.name || "N/A"; 
        const poData = poMap.get(stock.no_po);
        const noFaktur = poData?.no_faktur || "N/A";
        const supplier = poData?.spplr?.name || "N/A"; 
        const tglPenerimaan = poData?.tanggal_penerimaan || null;
        const noPembelian = poData?.no_po || stock.no_po || "N/A";
        const hargaSatuan = parseFloat(stock.harga_satuan) || 0;
        const stokAkhir = parseInt(stock.sisa_stok, 10) || 0;

        return {
            uuid: uuid,
            lokasi: lokasi,
            kode_item: kodeItem,
            nama_item: namaItem,
            jenis_stok: jenisStok,
            stok_akhir: stokAkhir,
            no_faktur: noFaktur,
            tgl_expired: stock.exp_date,
            jenis_item: jenisItem,
            satuan: satuan,
            supplier: supplier,
            tgl_penerimaan: tglPenerimaan,
            no_pembelian: noPembelian,
            harga_satuan: hargaSatuan,
            total_harga: stokAkhir * hargaSatuan
        };
    }

    static toPersediaanListDTO(item, hargaItemMap, mapVariant, mapLokasi, mapFullItem = new Map()) {
        const variantData = mapVariant.get(item.item_medis_jenis_stok_uuid);
        const lokasiData = mapLokasi.get(item.lokasi_stok_uuid);
        const hargaData = hargaItemMap.get(item.item_medis_jenis_stok_uuid);
        const fullItemData = variantData?.item_medis_uuid ? mapFullItem.get(variantData.item_medis_uuid) : null;
        const itemMedisVariant = variantData?.item_medis;
        const detailStok = variantData?.detail_stok;
        const stokAkhir = parseInt(item.stok_akhir, 10) || 0;
        const hppRataRata = parseFloat(item.hpp_avg) || 0;
        const jenisItem = fullItemData?.jenis_item || "N/A";
        const satuan = fullItemData?.satuan_penggunaan?.name || "N/A";

        return {
            uuid: item.item_medis_jenis_stok_uuid,
            lokasi: lokasiData?.name || "N/A",
            kode_item: itemMedisVariant?.code || "N/A",
            nama_item: itemMedisVariant?.name || "N/A",
            jenis_stok: detailStok?.name || "N/A",
            stok_akhir: stokAkhir,
            satuan: satuan,         
            kategori_item: "Medis",
            jenis_item: jenisItem,  
            hna: parseFloat(hargaData?.hna) || 0,
            hja: parseFloat(hargaData?.harga_terakhir) || 0,
            total_harga: stokAkhir * hppRataRata
        };
    }
}