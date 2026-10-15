export default class PenerimaanReturMapper {
    static toListDTO(items, mapLokasi) {
        return items.map(row => {
            const item = row.toJSON ? row.toJSON() : row;
            
            const lokasiAwal = mapLokasi.get(item.lokasi_stok_awal_uuid);
            const lokasiTujuan = mapLokasi.get(item.lokasi_stok_tujuan_uuid);

            return {
                ...item,
                lokasi_stok_awal: lokasiAwal ? { name: lokasiAwal.name } : null,
                lokasi_stok_tujuan: lokasiTujuan ? { name: lokasiTujuan.name } : null,
            };
        });
    }

    static toDetailDTO(data, mapLokasi, mapItem) {
        // Hydrate Header (Lokasi)
        const lokasiAwal = mapLokasi.get(data.lokasi_stok_awal_uuid);
        const lokasiTujuan = mapLokasi.get(data.lokasi_stok_tujuan_uuid);
        
        data.lokasi_stok_awal = lokasiAwal ? { name: lokasiAwal.name } : null;
        data.lokasi_stok_tujuan = lokasiTujuan ? { name: lokasiTujuan.name } : null;

        // Hydrate Items (Nama & Satuan)
        if (data.items) {
            data.items = data.items.map(item => {
                const masterItem = mapItem.get(item.item_uuid);
                const itemName = masterItem?.name || "-";
                const satuanName = masterItem?.satuan_penggunaan?.name || "";

                return {
                    ...item,
                    name: itemName,
                    // Logika format string dipindah kesini agar Service bersih
                    qty: `${item.qty} ${satuanName}`, 
                    qty_terima: `${item.qty_terima} ${satuanName}`,
                    item_uuid: undefined 
                };
            });
        }

        return data;
    }
}