import express from "express";
import config from "../../config.js";
import { query, satu, sisipkan, ubah, transaksi, sekarang } from "../../db.js";
import { kirim } from "../../umum/respons.js";
import { pastikanIzin, wajibIzin, wajibSalahSatu } from "../../umum/izin.js";
import { tanganiMutu } from "../../mutu/dasar.js";
import { catatKredensial } from "../../mutu/penulis-kredensial.js";
import { catatAuditPusat } from "../audit.js";
import { buatLayananPelatihan } from "./layanan.js";
import { buatKueriPelatihan } from "./kueri.js";
import { CAKUPAN, HASIL, KATEGORI, KEHADIRAN, STATUS } from "./validasi.js";
import { siapkanEkspor } from "./ekspor.js";

const rute = express.Router();
const MODUL = "HR / SDM", SUBMODUL = "Pelatihan";
const izin = (aksi) => wajibIzin(MODUL, SUBMODUL, aksi);
const audit = (k, req, aksi, entitas, entitasUuid, ringkasan) => catatAuditPusat(k, {
  faskesUuid: req.author.faskesUuid, aksi, entitas, entitasUuid, ringkasan, pengguna: req.author.username,
});
const layanan = buatLayananPelatihan({ query, satu, sisipkan, ubah, transaksi, sekarang, audit, catatKredensial, maksMb: config.maxUploadMutuMb });
const kueri = buatKueriPelatihan({ query, satu, sekarang, transaksi });
// Hanya server yang menentukan identitas faskes, pelaku, verifikator dan jam yang diakui.
rute.use((req, res, next) => {
  const terlarang = ["faskes_uuid", "dibuat_oleh", "diverifikasi_oleh", "diverifikasi_at", "jam_diakui"];
  if (terlarang.some((kolom) => req.body?.[kolom] !== undefined)) return res.status(400).json({ message: "Identitas faskes, pelaku dan jam diakui ditentukan server" });
  next();
});
const baca = (fn) => tanganiMutu(async (req, res) => kirim(res, await fn(req.author.faskesUuid, req.query, req)));
const tulis = (nama) => tanganiMutu(async (req, res) => {
  if (req.body?.sertifikat || req.body?.kredensial_uuid) await pastikanIzin(req, MODUL, SUBMODUL, "KELOLA SERTIFIKAT");
  kirim(res, await layanan[nama](req), "Data pelatihan berhasil disimpan");
});

rute.get("/referensi", wajibSalahSatu([MODUL, SUBMODUL, "READ"], [MODUL, SUBMODUL, "BACA REKAP"], [MODUL, SUBMODUL, "KELOLA KEBIJAKAN"]), baca(async (f) => ({
  kategori: KATEGORI, kehadiran: KEHADIRAN, hasil: HASIL, status: STATUS, cakupan: CAKUPAN,
  maks_berkas_mb: config.maxUploadMutuMb,
  jenis_pegawai: [{ uuid: "1", nama: "Tenaga kesehatan" }, { uuid: "2", nama: "Tenaga nonkesehatan" }],
  unit: await query(`SELECT uuid, name AS nama FROM lokasi WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY name`, [f]),
})));
rute.get("/pegawai", izin("READ"), baca((f, q) => kueri.pegawai(f, q)));
rute.get("/pegawai/:uuid/sertifikat", izin("KELOLA SERTIFIKAT"), baca((f, q, req) => kueri.sertifikatPegawai(f, req.params.uuid)));
rute.get("/katalog", izin("READ"), baca((f, q) => kueri.daftarKatalog(f, q)));
rute.post("/katalog", izin("KELOLA KATALOG"), tulis("simpanKatalog"));
rute.get("/katalog/:uuid", izin("READ"), baca((f, q, req) => kueri.detailKatalog(f, req.params.uuid)));
rute.put("/katalog/:uuid", izin("KELOLA KATALOG"), tulis("simpanKatalog"));
rute.delete("/katalog/:uuid", izin("KELOLA KATALOG"), tulis("hapusKatalog"));
rute.get("/kegiatan", izin("READ"), baca((f, q) => kueri.daftarKegiatan(f, q)));
rute.post("/kegiatan", izin("KELOLA KEGIATAN"), tulis("simpanKegiatan"));
rute.get("/kegiatan/:uuid", izin("READ"), baca((f, q, req) => kueri.detailKegiatan(f, req.params.uuid)));
rute.put("/kegiatan/:uuid", izin("KELOLA KEGIATAN"), tulis("simpanKegiatan"));
rute.delete("/kegiatan/:uuid", izin("KELOLA KEGIATAN"), tulis("hapusKegiatan"));
rute.post("/kegiatan/:uuid/status", izin("KELOLA KEGIATAN"), tulis("statusKegiatan"));
rute.post("/kegiatan/:uuid/buka-kembali", izin("VERIFIKASI HASIL"), tulis("bukaKegiatan"));
rute.get("/kegiatan/:uuid/peserta", izin("READ"), baca((f, q, req) => kueri.peserta(f, req.params.uuid, q)));
rute.post("/kegiatan/:uuid/peserta", izin("KELOLA PESERTA"), tulis("daftarPeserta"));
rute.delete("/kegiatan/:uuid/peserta/:peserta_uuid", izin("KELOLA PESERTA"), tulis("hapusPeserta"));
rute.put("/kegiatan/:uuid/peserta/:peserta_uuid/hasil", izin("CATAT HASIL"), tulis("catatHasil"));
rute.post("/kegiatan/:uuid/peserta/:peserta_uuid/verifikasi", izin("VERIFIKASI HASIL"), tulis("verifikasi"));
rute.post("/kegiatan/:uuid/peserta/:peserta_uuid/koreksi", izin("VERIFIKASI HASIL"), tulis("koreksi"));
rute.post("/kegiatan/:uuid/peserta/:peserta_uuid/sertifikat", izin("KELOLA SERTIFIKAT"), tulis("sertifikat"));
rute.get("/kebijakan", wajibSalahSatu([MODUL, SUBMODUL, "READ"], [MODUL, SUBMODUL, "BACA REKAP"], [MODUL, SUBMODUL, "KELOLA KEBIJAKAN"]), baca((f, q) => kueri.kebijakan(f, q)));
rute.post("/kebijakan", izin("KELOLA KEBIJAKAN"), tulis("simpanKebijakan"));
rute.get("/rekap", izin("BACA REKAP"), baca((f, q) => kueri.rekap(f, q, "jam")));
rute.get("/rekap/wajib", izin("BACA REKAP"), baca((f, q) => kueri.rekap(f, q, "wajib")));
rute.get("/rekap/sertifikat", izin("BACA REKAP"), baca((f, q) => kueri.rekap(f, q, "sertifikat")));

// Format dipilih eksplisit saat ekspor. Data terotorisasi dibentuk dari kueri yang sama dengan tampilan;
// pustaka Excel/PDF yang sudah tersedia di frontend melakukan pembentukan berkas tanpa mengirim bukti sertifikat.
rute.post("/ekspor", izin("BACA REKAP"), izin("EKSPOR"), tanganiMutu(async (req, res) => {
  const hasil = await siapkanEkspor(req, { transaksi, laporan: kueri.laporan, audit });
  kirim(res, hasil, "Data ekspor pelatihan berhasil disiapkan");
}));

export default rute;
