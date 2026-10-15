export default class ReturSupplierMapper {
    static toReturListDTO(item) {
        return {
            uuid: item.uuid,
            supplier: item.spplr?.name,
            no_retur_supplier: item.no_retur_supplier,
            tanggal_retur: item.tanggal_retur,
            petugas: item.petugas_retur,
            status: item.status,
            jenis_stok: item.pembelian_barang_supplier?.jenis_stok?.name,
            jenis_item: item.pembelian_barang_supplier?.jenis_item,
            kategori_item: item.pembelian_barang_supplier?.kategori_item,
        };
    }

    static toReturDetailDTO(result) {
        const items = [];
        if (result.items) {
            for (const item of result.items) {
                let shouldAddItem = false;
                if (item.item_type === "retur" && result.status === "retur") {
                    shouldAddItem = true;
                } else if (item.item_type === "replacement" && result.status === "terima") {
                    shouldAddItem = true;
                }

                if (shouldAddItem) {
                    items.push({
                        name: item.item_medis?.name,
                        item_uuid: item.item_uuid,
                        exp_date: item.exp_date,
                        qty: item.qty_retur,
                        konversi: `${item.konversi?.satuan_pembelian ?? "-"}/${item.konversi?.konversi ?? ""} ${item.konversi?.satuan_penggunaan ?? "-"}`,
                        konversi_uuid: item.konversi_uuid,
                        harga: item.harga_satuan
                    });
                }
            }
        }

        let grandTotal = 0;
        if (items.length > 0) {
            const subTotal = items.reduce((acc, item) => acc + (item.qty * item.harga), 0);
            const tax = subTotal * ((result.ppn || 0) / 100);
            grandTotal = subTotal + tax - (result.diskon ?? 0) + (result.materai ?? 0);
        }

        return {
            uuid: result.uuid,
            no_retur_supplier: result.no_retur_supplier,
            status: result.status,
            no_penerimaan: result.pembelian_barang_supplier?.no_po,
            tanggal_penerimaan: result.pembelian_barang_supplier?.tanggal_penerimaan,
            no_faktur: result.pembelian_barang_supplier?.no_faktur,
            tanggal_faktur: result.pembelian_barang_supplier?.tanggal_faktur,
            tanggal_retur: result.tanggal_retur,
            lokasi_gudang: result.pembelian_barang_supplier?.lks?.name,
            alasan_retur: result.alasan_retur,
            catatan: result.catatan,
            supplier: result.spplr?.name,
            jenis_item: result.pembelian_barang_supplier?.jenis_item,
            kategori_item: result.pembelian_barang_supplier?.kategori_item,
            jenis_stok: result.pembelian_barang_supplier?.jenis_stok?.name,
            jenis_pembayaran: result.pembelian_barang_supplier?.metode_pembelian,
            petugas_retur: result.petugas_retur,
            petugas_penerima_penggantian: result.petugas_penerima_retur,
            diskon: result.diskon,
            materai: result.materai,
            ppn: result.ppn,
            grand_total: (items.length > 0) ? grandTotal : (result.total_pengembalian_uang || 0),
            total_item: items.length === 0 ? "-" : `${items.length} item`,
            items,
            jenis_penggantian: result.jenis_penggantian,
            tanggal_penggantian: result.tanggal_penggantian,
            nominal_penggantian: result.total_pengembalian_uang,
        };
    }

    static toFakturDetailDTO(result) {
        return {
            uuid: result.uuid,
            no_faktur: result.no_faktur,
            tanggal_faktur: result.tanggal_faktur,
            no_penerimaan: result.no_po,
            tanggal_penerimaan: result.tanggal_penerimaan,
            supplier: result.spplr?.name || "Nama Supplier Tidak Tersedia",
            lokasi_stok: result.lks?.name,
            lokasi_stok_uuid: result.lokasi_stok_uuid,
            jenis_item: result.jenis_item,
            kategori_item: result.kategori_item,
            jenis_stok: result.jenis_stok?.name,
            metode_pembelian: result.metode_pembelian,
            available_items: result.pbsu?.map(this._mapFakturItem) || []
        };
    }

    static _mapFakturItem(item) {
        const formattedExpDate = item.exp_date
            ? `${String(new Date(item.exp_date).getDate()).padStart(2, "0")}-${String(new Date(item.exp_date).getMonth() + 1).padStart(2, "0")}-${new Date(item.exp_date).getFullYear()}` 
            : null;
        return {
            item_uuid: item.item_uuid,
            name: item.item_medis?.name,
            satuan_beli: `${item.cnvrsn?.satuan_pembelian ?? "-"}/${
                item.cnvrsn?.konversi ?? ""
              } ${item.cnvrsn?.satuan_penggunaan ?? "-"}`,
            satuan_penggunaan: item.cnvrsn?.satuan_penggunaan ?? "-",
            konversi_uuid: item.konversi_uuid,
            exp_date: formattedExpDate,
            qty: item.qty_order,
            harga_satuan: item.harga_satuan,
        };
    }
}