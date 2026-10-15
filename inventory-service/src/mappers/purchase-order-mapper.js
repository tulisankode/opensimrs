export default class PurchaseOrderMapper {
    static toListDTO(poListData) {
        if (!poListData) return null;
        return {
            uuid: poListData.uuid,
            no_po: poListData.no_po,
            status: poListData.status,
            jenis_item: poListData.jenis_item,
            kategori_item: poListData.kategori_item,
            tanggal_pembelian: poListData.tanggal_pembelian,
            petugas_pembuat_po: poListData.petugas_pembuat_po,
            petugas_penerima: poListData.petugas_penerima,
            supplier: poListData.spplr?.name, 
            jenis_stok: poListData.jenis_stok?.name
        };
    }

    static toDetailDTO(poData) {
        if (!poData) return null;
            return {
              uuid: poData.uuid,
              jenis_stok_uuid: poData.jenis_stok_uuid ?? "",
              supplier_uuid: poData.supplier_uuid ?? "",
              lokasi_stok_uuid: poData.lokasi_stok_uuid ?? "",
              no_pembelian: poData.no_po ?? "",
              tanggal_pembelian: poData.tanggal_pembelian ?? 0,
              supplier: poData.spplr?.name ?? "",
              lokasi: poData.lks?.name ?? "",
              jenis_item: poData.jenis_item ?? "",
              payment_method: poData.metode_pembelian ?? "",
              kategori_item: poData.kategori_item ?? "",
              cito: !!poData.isCito,
              jenis_stok: poData.jenis_stok?.name ?? "",
              tanggal_verifikasi: poData.updated_at ?? null,
              tanggal_penerimaan: poData.tanggal_penerimaan ?? "",
              no_faktur: poData.no_faktur ?? "",
              tanggal_faktur: poData.tanggal_faktur ?? "",
              catatan_po: poData.catatan_po ?? "",
              catatan_penerimaan: poData.catatan_penerimaan ?? "",
              alasan_batal: poData.alasan_batal ?? "",
              no_surat_jalan: poData.no_surat_jalan ?? "",
              status: poData.status,
              total_item: poData.total_item ?? 0,
              diskon: poData.diskon ?? 0,
              materai: poData.materai ?? 0,
              ppn: poData.ppn ?? 0,
              grand_total: poData.grand_total ?? 0,
              ongkos_kirim: poData.ongkos_kirim ?? 0,
              petugas_pembuat_po: poData.petugas_pembuat_po ?? "-",
              petugas_verifikasi: poData.petugas_verifikasi ?? "-",
              petugas_penerima: poData.petugas_penerima ?? "-",
              petugas_pengirim: poData.petugas_pengirim ?? "-",
              items: (poData.pbsu || []).map(item => this.toItemDetailDTO(item)),
            };
    }

    static toItemDetailDTO(itemData) {
        if (!itemData) return null;

        const satuanPenggunaan = itemData.item_medis?.satuan_penggunaan?.name ?? itemData.cnvrsn?.satuan_penggunaan ?? "-";
        const satuanPembelian = itemData.cnvrsn?.satuan_pembelian ?? satuanPenggunaan; 

        return {
            uuid: itemData.uuid,
            item_uuid: itemData.item_uuid ?? "",
            nama: itemData.item_medis?.name ?? "",
            qty_order: itemData.qty_order ?? 0,
            qty_terima: itemData.qty_terima ?? 0,
            harga_satuan: itemData.harga_satuan ?? 0,
            total_harga: itemData.total_harga ?? 0,
            exp_date: itemData.exp_date,
            conversion_uuid: itemData.konversi_uuid ?? "",
            satuan_beli_uuid: itemData.cnvrsn?.satuan_pembelian_uuid ?? "",
            satuan_beli_info: {
                 nama_satuan_beli: satuanPembelian,
                 konversi: itemData.cnvrsn?.konversi ?? 0,
                 nama_satuan_pakai: satuanPenggunaan
            },
            satuan_beli_string: `${satuanPembelian}/${itemData.cnvrsn?.konversi ?? ""} ${satuanPenggunaan}`,
        };
    }
}