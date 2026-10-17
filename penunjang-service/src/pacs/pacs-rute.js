import express from "express";
import { tangani, kirim, halaman } from "../umum/respons.js";
import { wajibFiturPacsAktif } from "./izin.js";
import {
  GalatPacs, daftarKoneksi, simpanKoneksi, jadikanBawaan, buatUlangKunciMasuk, hapusKoneksi, ujiKoneksi,
  validasiDanKirimOrder, kirimUlangItem, cekStatusItem, ambilHasilItem, terimaHasil, daftarPengiriman,
} from "./pacs-service.js";
import { daftarMappingTindakan, simpanMappingTindakan, daftarMappingRef, simpanMappingRef, daftarMappingRuang, simpanMappingRuang } from "./pacs-peta.js";

// Bridging PACS/RIS Radiologi — /api/v3/penunjang/radiologi/pacs/... (lihat radiologi/rute.js). Seluruh rute di
// bawah ini dibungkus wajibFiturPacsAktif: saat fitur rad_bridging_pacs nonaktif untuk faskes, permintaan ditolak
// walau dipanggil langsung (lihat Rancangan Teknis STD-0012 KT-1). Galat GalatPacs ditangani sama seperti Galat
// biasa oleh tangani() (umum/respons.js): { message } + status HTTP dari error.status.
const rute = express.Router();
rute.use(wajibFiturPacsAktif);

// ── Koneksi ──────────────────────────────────────────────────────────────────
rute.get("/koneksi", tangani(async (req, res) => kirim(res, await daftarKoneksi(req.author.faskesUuid))));
rute.post("/koneksi", tangani(async (req, res) => kirim(res, await simpanKoneksi(req.author.faskesUuid, null, req.body), "Koneksi PACS ditambahkan")));
rute.put("/koneksi/:uuid", tangani(async (req, res) => kirim(res, await simpanKoneksi(req.author.faskesUuid, req.params.uuid, req.body), "Koneksi PACS disimpan")));
rute.delete("/koneksi/:uuid", tangani(async (req, res) => kirim(res, await hapusKoneksi(req.author.faskesUuid, req.params.uuid), "Koneksi PACS dihapus")));
rute.post("/koneksi/:uuid/bawaan", tangani(async (req, res) => kirim(res, await jadikanBawaan(req.author.faskesUuid, req.params.uuid), "PACS bawaan diubah")));
rute.post("/koneksi/:uuid/kunci-masuk", tangani(async (req, res) => kirim(res, await buatUlangKunciMasuk(req.author.faskesUuid, req.params.uuid), "Kunci masuk baru dibuat")));
rute.post("/koneksi/:uuid/uji", tangani(async (req, res) => kirim(res, await ujiKoneksi(req.author.faskesUuid, req.params.uuid))));

// ── Mapping ──────────────────────────────────────────────────────────────────
rute.get("/mapping/tindakan", tangani(async (req, res) =>
  kirim(res, await daftarMappingTindakan(req.author.faskesUuid, { cari: req.query.cari, belumDipetakan: ["1", "true"].includes(String(req.query.belum_dipetakan)) }))));
rute.put("/mapping/tindakan/:pemeriksaanUuid", tangani(async (req, res) =>
  kirim(res, await simpanMappingTindakan(req.author.faskesUuid, req.params.pemeriksaanUuid, req.body), "Mapping tindakan PACS disimpan")));
rute.get("/mapping/referensi", tangani(async (req, res) => kirim(res, await daftarMappingRef(req.author.faskesUuid))));
rute.put("/mapping/referensi/:jenis/:refUuid", tangani(async (req, res) =>
  kirim(res, await simpanMappingRef(req.author.faskesUuid, req.params.jenis, req.params.refUuid, req.body), "Mapping referensi PACS disimpan")));
rute.get("/mapping/ruang", tangani(async (req, res) =>
  kirim(res, await daftarMappingRuang(req.author.faskesUuid, { cari: req.query.cari, belumDipetakan: ["1", "true"].includes(String(req.query.belum_dipetakan)) }))));
rute.put("/mapping/ruang/:ruangUuid", tangani(async (req, res) =>
  kirim(res, await simpanMappingRuang(req.author.faskesUuid, req.params.ruangUuid, req.body?.ae_title), "AE Title ruang disimpan")));

// ── Pengiriman (riwayat) ──────────────────────────────────────────────────────
rute.get("/pengiriman", tangani(async (req, res) => {
  const pg = halaman(req.query);
  const { data, pagination } = await daftarPengiriman(req.author.faskesUuid, { page: pg.page, limit: pg.limit, status: req.query.status ?? "" });
  res.json({ message: "Data berhasil ditampilkan", payload: data, pagination });
}));

// ── Validasi & kirim order ────────────────────────────────────────────────────
// Koneksi ambigu (>1 koneksi aktif tanpa bawaan) → 409 dengan daftar koneksi (tanpa rahasia) agar petugas memilih.
rute.post("/order/:orderUuid/validasi-kirim", tangani(async (req, res) => {
  try {
    const hasil = await validasiDanKirimOrder(req.author.faskesUuid, req.params.orderUuid, { koneksiUuid: req.body?.koneksi_uuid || null, pengguna: req.author.username, req });
    kirim(res, hasil, `Order ${hasil.order.no_order} divalidasi & terkirim ke ${hasil.koneksi}`);
  } catch (error) {
    if (error instanceof GalatPacs && error.koneksi) return res.status(error.status).json({ message: error.message, payload: { koneksi: error.koneksi } });
    throw error;
  }
}));
rute.post("/order-item/:itemUuid/kirim", tangani(async (req, res) => {
  const hasil = await kirimUlangItem(req.author.faskesUuid, req.params.itemUuid, { koneksiUuid: req.body?.koneksi_uuid || null, pengguna: req.author.username });
  res.status(hasil.status === "terkirim" ? 200 : 502).json({ message: hasil.pesan, payload: hasil });
}));
rute.post("/order-item/:itemUuid/cek-status", tangani(async (req, res) => kirim(res, await cekStatusItem(req.author.faskesUuid, req.params.itemUuid))));
rute.post("/order-item/:itemUuid/ambil-hasil", tangani(async (req, res) => {
  const hasil = await ambilHasilItem(req.author.faskesUuid, req.params.itemUuid);
  kirim(res, hasil, `Hasil PACS: ${hasil.pesan}`);
}));

export default rute;

// ── Tanpa login JWT: PACS/RIS mengirim hasil ke SIMRS (dipasang sebelum middleware otorisasi, server.js) ──────
// Alamat yang didaftarkan di PACS: http(s)://<host penunjang-service>/adam-pacs/bridging?key=<kunci masuk>
// (atau kirim kunci di header x-api-key). Alias /api/v3/penunjang/radiologi/pacs/hasil untuk akses lewat gateway.
// Format galat sesuai dokumentasi (konsisten dengan titik masuk LIS): { success: false, message }.
export const ruteMasuk = express.Router();
ruteMasuk.post(["/adam-pacs/bridging", "/api/v3/penunjang/radiologi/pacs/hasil"], async (req, res) => {
  try {
    const kunci = req.get("x-api-key") || req.query.key;
    const hasil = await terimaHasil(kunci ? String(kunci) : "", req.body ?? {});
    res.json({ success: true, message: hasil.pesan, payload: hasil });
  } catch (error) {
    const status = error instanceof GalatPacs ? error.status : 500;
    if (status >= 500) console.error("[pacs]", error);
    res.status(status).json({ success: false, message: error.message });
  }
});
