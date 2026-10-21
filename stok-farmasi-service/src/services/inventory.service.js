import { inventoryAPI, logger } from "../configurations/index.js";
import ResponseError from "../errors/ResponseError.js";

export default class InventoryService {
  // Rute pengiriman/pengeluaran unit di inventory-service dipasang di bawah /inventory/pengeluaran.
  // Teruskan status & pesan galat dari inventory (mis. stok tidak cukup) agar petugas tahu penyebabnya.
  static _galat(error, pesanDefault) {
    const status = error?.response?.status;
    const data = error?.response?.data;
    const pesan =
      data?.errors?.[0]?.message || data?.message || pesanDefault;
    if (status && status >= 400 && status < 500) {
      return new ResponseError(`${pesanDefault} ${pesan}`.trim(), status);
    }
    return new ResponseError(pesanDefault, 502);
  }

  static async catatPengeluaranUnit(dataMutasi, token) {
    const payload = {
      jenis_pengeluaran: dataMutasi.jenis_pengeluaran,
      jenis_item: dataMutasi.jenis_item,
      kategori_item: dataMutasi.kategori_item,
      jenis_stok_uuid: dataMutasi.jenis_stok_uuid,
      lokasi_stok_awal_uuid: dataMutasi.lokasi_stok_awal_uuid,
      tanggal_pengeluaran: dataMutasi.tanggal_pengeluaran,
      catatan: dataMutasi.catatan,
      items: dataMutasi.items.map((item) => ({
        stock_uuid: item.stock_uuid,
        exp_date: item.exp_date,
        harga_satuan: item.harga_satuan,
        konversi_uuid: item.konversi_uuid,
        qty: item.qty,
      })),
    };

    if (dataMutasi.jenis_pengeluaran === "pengeluaran tanpa permintaan") {
      if (!dataMutasi.lokasi_stok_tujuan_uuid) {
        throw new ResponseError(
          `Lokasi stok tujuan wajib diisi untuk jenis 'pengeluaran tanpa permintaan'.`,
          400
        );
      }
      payload.lokasi_stok_tujuan_uuid = dataMutasi.lokasi_stok_tujuan_uuid;
    } else if (dataMutasi.jenis_pengeluaran === "pemusnahan barang") {
      if (!dataMutasi.jenis_pemusnahan) {
        throw new ResponseError(
          `Jenis pemusnahan wajib diisi untuk 'pemusnahan barang'.`,
          400
        );
      }
      payload.jenis_pemusnahan = dataMutasi.jenis_pemusnahan;
    }

    try {
      await inventoryAPI.post("/inventory/pengeluaran/pengeluaran-unit", payload, {
        headers: { Authorization: token },
      });
    } catch (error) {
      throw InventoryService._galat(error, `Gagal mencatat pengeluaran di layanan inventory.`);
    }
  }

  static async verifikasiPengiriman(permintaanUuid, body, token) {

    try {
      const response = await inventoryAPI.put(
        `/inventory/pengeluaran/pengiriman-unit/verifikasi/${permintaanUuid}`,
        body,
        {
          headers: { Authorization: token },
        }
      );
      return response.data.payload;
    } catch (error) {
      throw InventoryService._galat(error, `Gagal verifikasi pengiriman di layanan inventory.`);
    }
  }

  static async kirimPengiriman(permintaanUuid, body, token) {
    try {
      const response = await inventoryAPI.put(
        `/inventory/pengeluaran/pengiriman-unit/kirim/${permintaanUuid}`,
        body,
        {
          headers: { Authorization: token },
        }
      );
      return response.data.payload;
    } catch (error) {
      throw InventoryService._galat(error, `Gagal kirim pengiriman di layanan inventory.`);
    }
  }

  static async batalPengiriman(permintaanUuid, body, token) {
    try {
      const response = await inventoryAPI.put(
        `/inventory/pengeluaran/pengiriman-unit/batal/${permintaanUuid}`,
        body,
        { headers: { Authorization: token } }
      );
      return response.data.payload || { message: "Pembatalan berhasil" };
    } catch (error) {
      throw InventoryService._galat(error, `Gagal membatalkan pengiriman di layanan inventory.`);
    }
  }
}
