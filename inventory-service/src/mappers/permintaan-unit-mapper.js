export default class PermintaanUnitMapper {
    static toListDTO(data, locationMap) {
        return data.map(row => {
            const item = row.dataValues || row;
            const locObj = locationMap.get(item.lokasi_stok_tujuan_uuid);
            
            return {
                ...item,
                lokasi_stok_tujuan: locObj ? locObj.name : "-", 
            };
        });
    }

    static toDetailDTO(permintaanData, locationMap, itemMap, conversionMap) {
        const data = permintaanData.toJSON ? permintaanData.toJSON() : permintaanData;

        // 1. Mapping Header (Lokasi Tujuan)
        const lokasiUuid = data.lokasi_stok_tujuan_uuid;
        const lokasiObj = locationMap.get(lokasiUuid);
        data.lokasi_stok_tujuan = lokasiObj ? lokasiObj.name : "-";

        // 2. Mapping Items (Nama Item & String Konversi)
        if (data.items && data.items.length > 0) {
            data.items = data.items.map(item => {
                
                // Ambil data referensi dari Map
                const masterItem = itemMap.get(item.item_medis_uuid);
                const conversionDetail = conversionMap.get(item.konversi_uuid);

                // Default values jika data tidak ditemukan di API
                const namaItem = masterItem ? masterItem.name : "Unknown Item";
                const satuanBeli = conversionDetail?.satuan_pembelian || "?";
                const nilaiKonversi = conversionDetail?.konversi || "?";
                const satuanPakai = conversionDetail?.satuan_penggunaan || "";

                return {
                    ...item,
                    item_medis: namaItem, 
                    konversi: `${satuanBeli}/${nilaiKonversi}`, 
                    stok_awal_lokasi_penerima: `${item.stok_awal_lokasi_penerima} ${satuanPakai}` 
                };
            });
        }

        return data;
    }
}