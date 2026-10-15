export default class PengeluaranUnitMapper {
    static toListDTO(itemData, mapLokasi = new Map(), mapJenisStok = new Map()) {
        if (!itemData) return null;
        if (Array.isArray(itemData)) {
            return itemData.map(item => this.toListDTO(item, mapLokasi, mapJenisStok));
        }

        const jenisStokData = mapJenisStok.get(itemData.jenis_stok_uuid);
        const lokasiTujuanData = mapLokasi.get(itemData.lokasi_stok_tujuan_uuid);
        const lokasiAwalData = mapLokasi.get(itemData.lokasi_stok_awal_uuid);

        const lokasiName = lokasiTujuanData?.name || lokasiAwalData?.name || null;

        return {
            uuid: itemData.uuid,
            no_pengeluaran: itemData.no_pengeluaran,
            tanggal_pengeluaran: itemData.tanggal_pengeluaran,
            jenis_pengeluaran: itemData.jenis_pengeluaran,
            kategori_item: itemData.kategori_item,
            jenis_item: itemData.jenis_item,
            petugas_pengeluaran: itemData.petugas_pengeluaran,
            jenis_stok: jenisStokData?.name ?? null,
            lokasi_stok_akhir: lokasiName,
        };
    }

    static toDetailDTO(itemData, mapLokasi = new Map(), mapJenisStok = new Map(), mapItemMedis = new Map(), mapItemJenisStok = new Map()) {
        if (!itemData) return null;
        const data = itemData.dataValues || itemData;

        const jenisStokData = mapJenisStok.get(data.jenis_stok_uuid);
        const lokasiTujuanData = mapLokasi.get(data.lokasi_stok_tujuan_uuid);
        const lokasiAwalData = mapLokasi.get(data.lokasi_stok_awal_uuid);

        return {
            ...data,
            jenis_stok: jenisStokData?.name ?? null,
            lokasi_stok_akhir: lokasiTujuanData?.name ?? null,
            lokasi_stok_awal: lokasiAwalData?.name ?? null,
            
            items: (data.items || []).map(item => {
                const stockData = item.stok || {};
                const relationData = mapItemJenisStok.get(stockData.item_medis_jenis_stok_uuid);
                const itemMedisUuid = relationData?.item_medis?.uuid;
                const itemName = relationData?.item_medis?.name;
                const masterItem = mapItemMedis.get(itemMedisUuid);
                const satuanName = masterItem?.satuan_penggunaan?.name || null;
                return {
                    name: itemName ?? masterItem?.name ?? "Item Tidak Ditemukan", 
                    qty: item.qty ?? 0,
                    harga_satuan: item.harga_satuan ?? 0,
                    total_harga: (item.qty ?? 0) * (item.harga_satuan ?? 0),
                    exp_date: item.exp_date || stockData.exp_date || null,
                    stok: item.stok_awal_lokasi_pengirim ?? 0,
                    pengeluaran: item.qty ?? 0,
                    satuan: satuanName, 
                    harga: item.harga_satuan ?? 0,
                    total: (item.harga_satuan ?? 0) * (item.qty ?? 0),
                };
            })
        };
    }

    static toAvailableStockDTO(itemData, mapItem = new Map()) {
        if (!itemData) return null;
        if (Array.isArray(itemData)) {
            return itemData.map(item => this.toAvailableStockDTO(item, mapItem));
        }

        console.log("=== DEBUG ITEM DATA ===");
        console.log(JSON.stringify(itemData, null, 2)); 
        console.log("=======================");

        const itemMedisUuid = itemData.item_medis_jenis_stok?.item_medis_uuid;
        const externalItem = itemMedisUuid ? mapItem.get(itemMedisUuid) : null;

        return {
            name: externalItem?.name ?? itemData.item_medis_jenis_stok?.item_medis?.name ?? null,
            uuid: externalItem?.uuid ?? itemData.item_medis_jenis_stok?.item_medis?.uuid ?? null,
            stock_medis_uuid: itemData.uuid ?? itemData.id ?? null, 
            sisa_stok: itemData.sisa_stok ?? 0,
            harga_dasar: itemData.harga_satuan ?? 0,
            exp_date: itemData.exp_date ?? null,
        };
    }
}