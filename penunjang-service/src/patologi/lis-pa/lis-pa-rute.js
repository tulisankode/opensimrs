import express from "express";
import { tangani, kirim } from "../../umum/respons.js";
import { wajibFiturPaLis } from "./fitur.js";
import {
  daftarKoneksi, simpanKoneksi, jadikanBawaan, buatUlangKunciMasuk, hapusKoneksi, ujiKoneksi,
  daftarPemetaanPemeriksaan, simpanPemetaanPemeriksaan, daftarPemetaanRef, simpanPemetaanRef, daftarPemetaanHasil, simpanPemetaanHasil,
  kirimKasus, statusKirimKasus, daftarKirim, cekStatusKasus, tarikHasil, terimaHasil, riwayatLaporan,
} from "./lis-pa-service.js";

// Bridging LIS Patologi Anatomi — /api/v3/penunjang/patologi/lis/... (terautentikasi, lihat rute.js patologi).
// Titik masuk push hasil TANPA JWT dipasang terpisah di server.js (lihat ruteMasuk di bawah), sebelum wajibLogin.
const rute = express.Router();
rute.use(wajibFiturPaLis());

rute.get("/koneksi", tangani(async (req, res) => kirim(res, await daftarKoneksi(req.author.faskesUuid))));
rute.post("/koneksi", tangani(async (req, res) => kirim(res, await simpanKoneksi(req.author.faskesUuid, null, req.body), "Koneksi LIS PA ditambahkan")));
rute.put("/koneksi/:uuid", tangani(async (req, res) => kirim(res, await simpanKoneksi(req.author.faskesUuid, req.params.uuid, req.body), "Koneksi LIS PA disimpan")));
rute.put("/koneksi/:uuid/bawaan", tangani(async (req, res) => {
  await jadikanBawaan(req.author.faskesUuid, req.params.uuid);
  kirim(res, await daftarKoneksi(req.author.faskesUuid), "Koneksi bawaan diubah");
}));
rute.post("/koneksi/:uuid/kunci-masuk", tangani(async (req, res) => kirim(res, await buatUlangKunciMasuk(req.author.faskesUuid, req.params.uuid), "Kunci masuk baru dibuat")));
rute.post("/koneksi/:uuid/uji", tangani(async (req, res) => kirim(res, await ujiKoneksi(req.author.faskesUuid, req.params.uuid))));
rute.delete("/koneksi/:uuid", tangani(async (req, res) => kirim(res, await hapusKoneksi(req.author.faskesUuid, req.params.uuid), "Koneksi LIS PA dihapus")));

rute.get("/mapping/pemeriksaan", tangani(async (req, res) => kirim(res, await daftarPemetaanPemeriksaan(req.author.faskesUuid, req.query.koneksi_uuid))));
rute.put("/mapping/pemeriksaan", tangani(async (req, res) => kirim(res, await simpanPemetaanPemeriksaan(req.author.faskesUuid, req.body?.koneksi_uuid, req.body?.items ?? []), "Pemetaan pemeriksaan disimpan")));
rute.get("/mapping/ref", tangani(async (req, res) => kirim(res, await daftarPemetaanRef(req.author.faskesUuid, req.query.koneksi_uuid))));
rute.put("/mapping/ref", tangani(async (req, res) => kirim(res, await simpanPemetaanRef(req.author.faskesUuid, req.body?.koneksi_uuid, req.body?.items ?? []), "Pemetaan unit, dokter & penjamin disimpan")));
rute.get("/mapping/hasil", tangani(async (req, res) => kirim(res, await daftarPemetaanHasil(req.author.faskesUuid, req.query.koneksi_uuid))));
rute.put("/mapping/hasil", tangani(async (req, res) => kirim(res, await simpanPemetaanHasil(req.author.faskesUuid, req.body?.koneksi_uuid, req.body?.items ?? []), "Pemetaan field hasil disimpan")));

rute.get("/kirim", tangani(async (req, res) => {
  const { data, pagination } = await daftarKirim(req.author.faskesUuid, req.query);
  res.json({ message: "Data berhasil ditampilkan", payload: data, pagination });
}));
rute.get("/kirim/:orderItemUuid", tangani(async (req, res) => kirim(res, await statusKirimKasus(req.author.faskesUuid, req.params.orderItemUuid))));
rute.post("/kirim/:orderItemUuid", tangani(async (req, res) => {
  const hasil = await kirimKasus(req.author.faskesUuid, req.params.orderItemUuid, { koneksiUuid: req.body?.koneksi_uuid, pengguna: req.author.username });
  res.status(hasil.status === "terkirim" ? 200 : 502).json({ message: hasil.pesan, payload: hasil });
}));
rute.post("/kirim/:orderItemUuid/cek-status", tangani(async (req, res) => kirim(res, await cekStatusKasus(req.author.faskesUuid, req.params.orderItemUuid))));
rute.post("/tarik/:orderItemUuid", tangani(async (req, res) => {
  const hasil = await tarikHasil(req.author.faskesUuid, req.params.orderItemUuid);
  kirim(res, hasil, `Hasil LIS PA: ${hasil.pesan}`);
}));
rute.get("/riwayat/:orderItemUuid", tangani(async (req, res) => kirim(res, await riwayatLaporan(req.params.orderItemUuid))));

export const ruteLisPa = rute;

// --- Tanpa login JWT: sistem PA mengirim hasil ke SIMRS (dipasang sebelum wajibLogin di server.js) ----------
// Alamat yang didaftarkan di sistem PA tujuan: http(s)://<host SIMRS>/adam-pa-lis/bridging?key=<kunci masuk>
// (atau kirim kunci di header x-api-key). Alias /api/v3/penunjang/patologi/lis/hasil untuk akses lewat gateway API.
export const ruteMasuk = express.Router();
const terima = tangani(async (req, res) => {
  const k = req.get("x-api-key") || req.query.key;
  const hasil = await terimaHasil(k ? String(k) : "", req.body ?? {});
  res.json({ success: true, message: `Data berhasil disimpan: ${hasil.pesan}`, payload: hasil });
});
// format galat sesuai dokumentasi adamLIS: { success: false, message }
ruteMasuk.post(["/adam-pa-lis/bridging", "/api/v3/penunjang/patologi/lis/hasil"], (req, res, next) => {
  const json = res.json.bind(res);
  res.json = (b) => json(res.statusCode >= 400 ? { success: false, message: `Data gagal disimpan karena ${b?.message ?? "galat"}` } : b);
  return terima(req, res, next);
});
