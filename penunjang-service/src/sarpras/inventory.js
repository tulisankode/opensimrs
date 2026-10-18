import config from "../config.js";
import { Galat } from "../umum/respons.js";

// Pengurangan stok suku cadang di Gudang & Pengadaan lewat endpoint nyata inventory-service
// POST {inventoryUrl}/stok/reduce (inventory-service/src/routes/stok-routes.js; FEFO/FIFO mengikuti konfigurasi
// harga farmasi). Token pengguna diteruskan apa adanya (faskes & petugas diambil inventory dari token yang sama).
// Gagal (HTTP ≠ 2xx / jaringan) → Galat 502 sehingga transaksi pencatatan suku cadang dibatalkan (KT-10).
export const kurangiStokInventory = async ({ itemUuid, jumlah, lokasiStokUuid, jenisStokUuid, kodeReferensi, keterangan, token }) => {
  let res;
  try {
    res = await fetch(`${config.inventoryUrl}/stok/reduce`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) },
      body: JSON.stringify({
        item_uuid: itemUuid,
        quantity: jumlah,
        lokasi_stok_uuid: lokasiStokUuid,
        jenis_stok_uuid: jenisStokUuid,
        sumber_mutasi: "Sarana & Prasarana",
        kode_referensi: kodeReferensi,
        keterangan: keterangan ? { description: keterangan } : undefined,
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    throw new Galat(502, `Gudang & Pengadaan tidak dapat dihubungi: ${error.message}`);
  }
  let isi = null;
  try {
    isi = await res.json();
  } catch {
    /* respons bukan JSON */
  }
  if (!res.ok) {
    const pesan = isi?.errors?.[0]?.message || isi?.message || `HTTP ${res.status}`;
    throw new Galat(502, `Pengurangan stok di Gudang & Pengadaan gagal: ${pesan}`);
  }
  // Referensi transaksi: stock_medis_uuid batch yang dipotong (respons reduceStock).
  const batch = Array.isArray(isi?.data ?? isi?.payload) ? (isi.data ?? isi.payload) : [];
  return (batch.map((b) => b.stock_medis_uuid).filter(Boolean).join(",") || kodeReferensi).slice(0, 255);
};
