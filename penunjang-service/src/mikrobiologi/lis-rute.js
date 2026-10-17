import express from "express";
import { satu } from "../db.js";
import { tangani, kirim } from "../umum/respons.js";
import { izinMikro } from "../umum/izin.js";
import {
  GalatLis, daftarKoneksi, simpanKoneksi, jadikanBawaan, buatUlangKunciMasuk, hapusKoneksi,
  daftarPemetaan, simpanPemetaan, kirimOrder, statusKirimOrder, daftarKirim, cekStatusOrder, tarikHasil, terimaHasil,
} from "./lis-service.js";
import { dekripsi } from "./lis-kripto.js";

// Bridging LIS Mikrobiologi (STD-0014) — /api/v3/penunjang/mikrobiologi/lis/... (login) dan titik masuk hasil tanpa JWT.
const rute = express.Router();

// --- Konfigurasi koneksi ---------------------------------------------------------------------------------
rute.get("/koneksi", izinMikro("Konfigurasi LIS Mikrobiologi", "LIHAT"), tangani(async (req, res) => kirim(res, await daftarKoneksi(req.author.faskesUuid))));
rute.post("/koneksi", izinMikro("Konfigurasi LIS Mikrobiologi", "KELOLA"), tangani(async (req, res) => kirim(res, await simpanKoneksi(req.author.faskesUuid, null, req.body), "Koneksi LIS Mikrobiologi ditambahkan")));
rute.put("/koneksi/:uuid", izinMikro("Konfigurasi LIS Mikrobiologi", "KELOLA"), tangani(async (req, res) => kirim(res, await simpanKoneksi(req.author.faskesUuid, req.params.uuid, req.body), "Koneksi LIS Mikrobiologi disimpan")));
rute.put("/koneksi/:uuid/bawaan", izinMikro("Konfigurasi LIS Mikrobiologi", "KELOLA"), tangani(async (req, res) => {
  await jadikanBawaan(req.author.faskesUuid, req.params.uuid);
  kirim(res, await daftarKoneksi(req.author.faskesUuid), "LIS Mikrobiologi bawaan diubah");
}));
rute.post("/koneksi/:uuid/kunci-masuk", izinMikro("Konfigurasi LIS Mikrobiologi", "KELOLA"), tangani(async (req, res) => kirim(res, await buatUlangKunciMasuk(req.author.faskesUuid, req.params.uuid), "Kunci masuk baru dibuat")));
rute.delete("/koneksi/:uuid", izinMikro("Konfigurasi LIS Mikrobiologi", "KELOLA"), tangani(async (req, res) => kirim(res, await hapusKoneksi(req.author.faskesUuid, req.params.uuid), "Koneksi LIS Mikrobiologi dihapus")));

// Uji koneksi: periksa keterjangkauan URL registrasi (tanpa mengirim order sungguhan, tanpa membocorkan API key).
rute.post("/koneksi/:uuid/uji", izinMikro("Konfigurasi LIS Mikrobiologi", "KELOLA"), tangani(async (req, res) => {
  const k = await satu(`SELECT url_registrasi, api_key FROM mikro_koneksi_lis WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, req.author.faskesUuid]);
  if (!k) throw new GalatLis(404, "Koneksi LIS Mikrobiologi tidak ditemukan");
  const mulai = Date.now();
  try {
    const resp = await fetch(k.url_registrasi, { method: "OPTIONS", headers: { "x-api-key": dekripsi(k.api_key) ?? "" }, signal: AbortSignal.timeout(8000) });
    kirim(res, { berhasil: resp.status < 500, pesan: `LIS merespons (HTTP ${resp.status})`, waktu_ms: Date.now() - mulai }, "Uji koneksi selesai");
  } catch (error) {
    kirim(res, { berhasil: false, pesan: `LIS tidak dapat dihubungi: ${error.name === "TimeoutError" ? "waktu habis" : error.message}`, waktu_ms: Date.now() - mulai }, "Uji koneksi selesai");
  }
}));

// --- Mapping kode LIS -------------------------------------------------------------------------------------
rute.get("/pemetaan", izinMikro("Mapping LIS Mikrobiologi", "LIHAT"), tangani(async (req, res) => kirim(res, await daftarPemetaan(req.author.faskesUuid, String(req.query.jenis ?? "")))));
rute.put("/pemetaan/:jenis", izinMikro("Mapping LIS Mikrobiologi", "KELOLA"), tangani(async (req, res) => kirim(res, await simpanPemetaan(req.author.faskesUuid, req.params.jenis, req.body?.items ?? []), "Pemetaan kode LIS Mikrobiologi disimpan")));

// --- Kirim order & status pengiriman ----------------------------------------------------------------------
rute.get("/pengiriman", izinMikro("Pengiriman LIS Mikrobiologi", "LIHAT"), tangani(async (req, res) => {
  const { data, pagination } = await daftarKirim(req.author.faskesUuid, req.query);
  res.json({ message: "Data berhasil ditampilkan", payload: data, pagination });
}));
rute.get("/kirim/:orderUuid", izinMikro("Pengiriman LIS Mikrobiologi", "LIHAT"), tangani(async (req, res) => kirim(res, await statusKirimOrder(req.author.faskesUuid, req.params.orderUuid))));
// Dipanggil dari Order Mikrobiologi (tindakan "Validasi & Kirim") maupun Pengiriman LIS Mikrobiologi (Kirim Ulang/Kirim Lagi).
rute.post("/kirim/:orderUuid", izinMikro("Order Mikrobiologi", "VALIDASI"), tangani(async (req, res) => {
  const hasil = await kirimOrder(req.author.faskesUuid, req.params.orderUuid, { koneksiUuid: req.body?.koneksi_uuid, pengguna: req.author.username });
  res.status(hasil.status === "terkirim" ? 200 : 502).json({ message: hasil.pesan, payload: hasil });
}));
rute.post("/kirim/:orderUuid/cek-status", izinMikro("Pengiriman LIS Mikrobiologi", "CEK STATUS"), tangani(async (req, res) => kirim(res, await cekStatusOrder(req.author.faskesUuid, req.params.orderUuid))));

// --- Ambil hasil (tarik manual) ----------------------------------------------------------------------------
rute.post("/tarik/:orderUuid", izinMikro("Pemeriksaan", "INPUT HASIL"), tangani(async (req, res) => {
  const hasil = await tarikHasil(req.author.faskesUuid, req.params.orderUuid);
  kirim(res, hasil, `Hasil LIS Mikrobiologi: ${hasil.pesan}`);
}));

export default rute;

// --- Tanpa login JWT: LIS Mikrobiologi mengirim hasil ke SIMRS (dipasang sebelum middleware otorisasi) ------
// Alamat yang didaftarkan di LIS: http(s)://<host SIMRS>/adam-lis/mikrobiologi/bridging?key=<kunci masuk>
// (atau kirim kunci di header x-api-key). Alias di bawah basePath untuk akses lewat gateway API.
export const ruteMasuk = express.Router();
const terima = tangani(async (req, res) => {
  const kunciAkses = req.get("x-api-key") || req.query.key;
  const hasil = await terimaHasil(kunciAkses ? String(kunciAkses) : "", req.body ?? {});
  res.json({ success: true, message: `Hasil LIS Mikrobiologi diterapkan: ${hasil.pesan}`, payload: hasil });
});
ruteMasuk.post(["/adam-lis/mikrobiologi/bridging", "/api/v3/penunjang/mikrobiologi/lis/hasil"], (req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body) => json(res.statusCode >= 400 ? { success: false, message: body?.message ?? "Galat" } : body);
  return terima(req, res, next);
});
