import express from "express";
import {
  GalatLis, daftarKoneksi, simpanKoneksi, jadikanBawaan, buatUlangKunciMasuk, hapusKoneksi,
  kirimOrder, pratinjauOrder, tarikHasil, statusKirimOrder, daftarKirim, terimaHasil, daftarPemetaanItem, simpanPemetaanItem, daftarPemetaanTarif, simpanPemetaanTarif, daftarPemetaanRef, simpanPemetaanRef,
  tandaiBelumTerdaftar,
} from "./lis-service.js";
import { buatBatch, daftarBatch, detailBatch, hentikanBatch, itemUlang } from "./lis-batch.js";
import { punyaIzin } from "./izin.js";

const apiBase = process.env.API_BASE || "api";
const apiVersion = process.env.API_VERSION || "v3";
const baseUrl = `/${apiBase}/${apiVersion}/lab/lis`;

const tangani = (fn) => (req, res) =>
  fn(req, res).catch((error) => {
    const status = error instanceof GalatLis ? error.status : Number(error?.code) >= 400 && Number(error?.code) < 600 ? Number(error.code) : 500;
    if (status >= 500) console.error("[LIS]", error);
    res.status(status).json({ message: status >= 500 && !(error instanceof GalatLis) ? "Terjadi kesalahan pada server" : error.message });
  });
const kirim = (res, payload, message = "Data berhasil ditampilkan") => res.json({ message, payload });
const fk = (req) => req.author?.faskesUuid;

// --- Dengan login (dipasang setelah middleware otorisasi) ---------------------------------------------
export const ruteLis = express.Router();

ruteLis.get(`${baseUrl}/koneksi`, tangani(async (req, res) => kirim(res, await daftarKoneksi(fk(req)))));
ruteLis.post(`${baseUrl}/koneksi`, tangani(async (req, res) => kirim(res, await simpanKoneksi(fk(req), null, req.body), "Koneksi LIS ditambahkan")));
ruteLis.put(`${baseUrl}/koneksi/:uuid`, tangani(async (req, res) => kirim(res, await simpanKoneksi(fk(req), req.params.uuid, req.body), "Koneksi LIS disimpan")));
ruteLis.put(`${baseUrl}/koneksi/:uuid/bawaan`, tangani(async (req, res) => {
  await jadikanBawaan(fk(req), req.params.uuid);
  kirim(res, await daftarKoneksi(fk(req)), "LIS bawaan diubah");
}));
ruteLis.post(`${baseUrl}/koneksi/:uuid/kunci-masuk`, tangani(async (req, res) => kirim(res, await buatUlangKunciMasuk(fk(req), req.params.uuid), "Kunci masuk baru dibuat")));
ruteLis.delete(`${baseUrl}/koneksi/:uuid`, tangani(async (req, res) => kirim(res, await hapusKoneksi(fk(req), req.params.uuid), "Koneksi LIS dihapus")));

ruteLis.get(`${baseUrl}/pemetaan-item`, tangani(async (req, res) => kirim(res, await daftarPemetaanItem(fk(req)))));
ruteLis.put(`${baseUrl}/pemetaan-item`, tangani(async (req, res) => kirim(res, await simpanPemetaanItem(fk(req), req.body?.items ?? []), "Pemetaan kode LIS disimpan")));
ruteLis.get(`${baseUrl}/pemetaan-tarif`, tangani(async (req, res) => kirim(res, await daftarPemetaanTarif(fk(req)))));
ruteLis.put(`${baseUrl}/pemetaan-tarif`, tangani(async (req, res) => kirim(res, await simpanPemetaanTarif(fk(req), req.body?.items ?? []), "Pemetaan kode tindakan LIS disimpan")));
ruteLis.get(`${baseUrl}/pemetaan-ref`, tangani(async (req, res) => kirim(res, await daftarPemetaanRef(fk(req)))));
ruteLis.put(`${baseUrl}/pemetaan-ref`, tangani(async (req, res) => kirim(res, await simpanPemetaanRef(fk(req), req.body?.items ?? []), "Pemetaan unit, dokter & penjamin LIS disimpan")));

ruteLis.get(`${baseUrl}/kirim`, tangani(async (req, res) => {
  const { data, pagination } = await daftarKirim(fk(req), req.query);
  res.json({ message: "Data berhasil ditampilkan", payload: data, pagination });
}));
ruteLis.get(`${baseUrl}/kirim/:orderUuid`, tangani(async (req, res) => kirim(res, await statusKirimOrder(fk(req), req.params.orderUuid))));
ruteLis.get(`${baseUrl}/kirim/:orderUuid/pratinjau`, tangani(async (req, res) => kirim(res, await pratinjauOrder(fk(req), req.params.orderUuid, { koneksiUuid: req.query.koneksi_uuid || null }))));
// Ambil hasil dari LIS (GET url_hasil koneksi) untuk satu order yang sudah terkirim
ruteLis.post(`${baseUrl}/tarik/:orderUuid`, tangani(async (req, res) => {
  const hasil = await tarikHasil(fk(req), req.params.orderUuid);
  kirim(res, hasil, `Hasil LIS: ${hasil.pesan}`);
}));
ruteLis.post(`${baseUrl}/kirim/:orderUuid`, tangani(async (req, res) => {
  const hasil = await kirimOrder(fk(req), req.params.orderUuid, { koneksiUuid: req.body?.koneksi_uuid, pengguna: req.author?.username });
  res.status(hasil.status === "terkirim" ? 200 : 502).json({ message: hasil.pesan, payload: hasil });
}));

// --- Kirim / ambil hasil / cek status massal (batch diproses asinkron di server) ------------------------------
// Batch sumber 'mcu' (dipanggil penunjang-service atas nama pengguna) wajib izin MCU › Peserta › KIRIM LIS.
const SUMBER = ["mcu", "lab"];
const wajibIzinSumber = async (req, sumber) => {
  if (sumber === "mcu" && !(await punyaIzin(req.author, "MCU", "Peserta", "KIRIM LIS"))) {
    throw new GalatLis("Akses ditolak: Anda tidak memiliki hak MCU › Peserta › KIRIM LIS", 403);
  }
};
ruteLis.get(`${baseUrl}/batch`, tangani(async (req, res) => {
  const { data, pagination } = await daftarBatch(fk(req), req.query);
  res.json({ message: "Data berhasil ditampilkan", payload: data, pagination });
}));
ruteLis.get(`${baseUrl}/batch/:uuid`, tangani(async (req, res) => kirim(res, await detailBatch(fk(req), req.params.uuid, { denganItem: req.query.item !== "0" }))));
// Body: { sumber: 'mcu', jenis: 'kirim'|'hasil'|'cek', items: [{ order_lab_uuid, ref_uuid }], koneksi_uuid?, opsi: { periksa_now }, judul? }
ruteLis.post(`${baseUrl}/batch`, tangani(async (req, res) => {
  const b = req.body ?? {};
  const sumber = SUMBER.includes(b.sumber) ? b.sumber : "mcu";
  await wajibIzinSumber(req, sumber);
  const batch = await buatBatch({
    faskesUuid: fk(req), pengguna: req.author?.username, sumber, jenis: b.jenis ?? "kirim", items: Array.isArray(b.items) ? b.items : [],
    koneksiUuid: b.koneksi_uuid || null, opsi: b.opsi ?? {}, judul: b.judul ?? null,
  });
  res.status(202).json({ message: `Batch ${batch.jumlah} order diproses di server`, payload: batch });
}));
// Ulangi item gagal / belum diproses (kirim & ambil hasil) atau yang masih tidak pasti (cek status) dari batch selesai.
ruteLis.post(`${baseUrl}/batch/:uuid/ulang`, tangani(async (req, res) => {
  const { batch: induk, items } = await itemUlang(fk(req), req.params.uuid);
  await wajibIzinSumber(req, induk.sumber);
  if (!items.length) throw new GalatLis("Tidak ada item gagal / belum diproses pada batch ini", 409);
  const batch = await buatBatch({
    faskesUuid: fk(req), pengguna: req.author?.username, sumber: induk.sumber, jenis: induk.jenis, items,
    koneksiUuid: req.body?.koneksi_uuid || induk.koneksi_uuid, opsi: req.body?.opsi ?? induk.opsi ?? {}, judul: induk.judul, indukUuid: induk.uuid,
  });
  res.status(202).json({ message: `Kirim ulang ${batch.jumlah} order diproses di server`, payload: batch });
}));
ruteLis.post(`${baseUrl}/batch/:uuid/hentikan`, tangani(async (req, res) => {
  const b = await detailBatch(fk(req), req.params.uuid, { denganItem: false });
  await wajibIzinSumber(req, b.sumber);
  kirim(res, await hentikanBatch(fk(req), req.params.uuid), "Batch dihentikan");
}));
// Order berstatus tidak pasti yang sudah dicek manual di LIS dan memang TIDAK terdaftar → boleh dikirim ulang.
ruteLis.post(`${baseUrl}/kirim-tandai-belum-terdaftar`, tangani(async (req, res) => {
  await wajibIzinSumber(req, SUMBER.includes(req.body?.sumber) ? req.body.sumber : "mcu");
  const orders = (Array.isArray(req.body?.order_lab_uuids) ? req.body.order_lab_uuids : []).map(String).slice(0, 1000);
  const hasil = await tandaiBelumTerdaftar(fk(req), orders, req.author?.username);
  kirim(res, hasil, `${hasil.length} order ditandai belum terdaftar di LIS`);
}));

// --- Tanpa login JWT: LIS mengirim hasil ke SIMRS (dipasang sebelum middleware otorisasi) --------------
// Alamat yang didaftarkan di LIS: http(s)://<host SIMRS>/adam-lis/bridging?key=<kunci masuk>
// (atau kirim kunci di header x-api-key). Alias /api/v3/lab/lis/hasil untuk akses lewat gateway API.
export const ruteMasuk = express.Router();
const terima = tangani(async (req, res) => {
  const kunci = req.get("x-api-key") || req.query.key;
  const hasil = await terimaHasil(kunci ? String(kunci) : "", req.body ?? {});
  res.json({ success: true, message: `Data berhasil Disimpan: ${hasil.pesan}`, payload: hasil.pesan });
});
// format galat sesuai dokumentasi adamLIS: { success: false, message }
ruteMasuk.post(["/adam-lis/bridging", `${baseUrl}/hasil`], (req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body) => json(res.statusCode >= 400 ? { success: false, message: `Data gagal disimpan karena ${body?.message ?? "galat"}` } : body);
  return terima(req, res, next);
});

