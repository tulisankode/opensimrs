export default class KartuStokMutasiMapper {
    static toKartuStokListDTO(itemData, lokasiStokUuid) {
        if (!itemData) return null;
        const totalSisaStock = itemData.stocks?.reduce((acc, stockBatch) => acc + stockBatch.sisa_stok, 0);
        const lokasiStokName = itemData.stocks && itemData.stocks.length > 0
            ? itemData.stocks[0]?.lokasi_stok?.name
            : null;
        return {
            uuid: itemData.uuid,
            nama: itemData.item_medis?.name ?? "N/A",
            kategori: "Medis",
            jenis_stok: itemData.detail_stok?.name ?? null,
            jenis_item: itemData.item_medis?.jenis_item ?? null,
            kategori_obat: itemData.item_medis?.kategori_obat?.name ?? null,
            satuan_obat: itemData.item_medis?.satuan_kemasan?.name ?? null,
            lokasi_stok_uuid: lokasiStokUuid,
            lokasi_stok: lokasiStokName,
            sisa_stok: totalSisaStock ?? 0,
        };
    }

    static toRiwayatMutasiListDTO(itemData, mapItem = new Map(), mapLokasi = new Map(), mapJenisStok = new Map()) {
        if (!itemData) return null;

        // Normalisasi data (handle sequelize instance)
        const data = itemData.dataValues || itemData;

        // Lookup Data Referensi
        const itemDetail = mapItem.get(data.item_uuid);
        const jenisStokDetail = mapJenisStok.get(data.jenis_stok_uuid);
        const lokasiGudangDetail = mapLokasi.get(data.lokasi_stok_uuid);

        // Parsing Keterangan
        const keteranganDesc = typeof data.keterangan === "object" && data.keterangan !== null
            ? data.keterangan.description
            : data.keterangan;

        const lokasiGudangName = lokasiGudangDetail?.name || "Kosong";
        let lokasiAwal = lokasiGudangName;
        let lokasiAkhir = null;
        const detailPengeluaran = data.pengeluaran_detail || itemData.pengeluaran_detail;
        
        if (detailPengeluaran) {
            const uuidTujuan = detailPengeluaran.lokasi_stok_tujuan_uuid;
            const lokasiTujuanDetail = mapLokasi.get(uuidTujuan);
            lokasiAkhir = lokasiTujuanDetail?.name 
                        || detailPengeluaran.nama_tujuan_resolved 
                        || uuidTujuan 
                        || null;
        } else if (data.sumber_mutasi === "inventory") {
            lokasiAwal = lokasiGudangName;
            lokasiAkhir = null;
        }

        const jenisItem = itemDetail?.jenis_item || itemDetail?.kategori_item || "N/A";

        // Arah mutasi ditentukan kolom type; nilai stok_mutasi ada yang ditulis bertanda (pengiriman/pengeluaran
        // unit, stok opname) dan ada yang selalu positif (pelayanan resep, retur), jadi pakai nilai mutlaknya.
        const jumlahMutasi = Math.abs(Number(data.stok_mutasi ?? 0));
        const keluar = data.type === "defisit" || (!data.type && Number(data.stok_mutasi) < 0);
        const stokMasuk = keluar ? 0 : jumlahMutasi;
        const stokKeluar = keluar ? jumlahMutasi : 0;

        return {
            kode_transaksi: data.code,
            sumber_mutasi: data.sumber_mutasi,
            tanggal_mutasi: data.created_at,
            nama_item: itemDetail?.name || "Item Tidak Ditemukan",
            kode_item: itemDetail?.code || "-",
            jenis_item: jenisItem,
            jenis_stok: jenisStokDetail?.name || "-",
            kategori_item: "Medis", 
            exp_date: data.exp_date,
            lokasi_stok_awal: lokasiAwal,
            lokasi_stok_akhir: lokasiAkhir,
            stok_awal: Number(data.stok_awal ?? 0),
            stok_masuk: stokMasuk,
            stok_keluar: stokKeluar,
            sisa_stok: Number(data.stok_awal ?? 0) + stokMasuk - stokKeluar,
            petugas: data.petugas,
            keterangan: keteranganDesc,
        };
    }
}