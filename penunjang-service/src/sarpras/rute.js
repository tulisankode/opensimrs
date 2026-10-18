import express from "express";
import { query, satu, sekarang } from "../db.js";
import { tangani, kirim, permintaanSalah } from "../umum/respons.js";
import { izinSarpras, wajibSalahSatu } from "../umum/izin.js";
import {
  FREKUENSI,
  HASIL_KALIBRASI,
  JENIS_UTILITAS,
  KATEGORI_ASET,
  PRIORITAS,
  STATUS_ASET,
  STATUS_JADWAL,
  STATUS_KALIBRASI,
  STATUS_LAPORAN,
  TIPE_BERKAS,
  bulatOpsional,
  pilihan,
} from "./bersama.js";
import config from "../config.js";
import { FITUR_SARPRAS, fiturSarprasAktif, modulKatalogAktif, wajibFiturSarpras } from "./fitur.js";
import { NAMA_PEGAWAI } from "./dasar.js";
import aset from "./aset.js";
import laporanKerusakan from "./laporan-kerusakan.js";
import pemeliharaan from "./pemeliharaan.js";
import kalibrasi from "./kalibrasi.js";
import utilitas from "./utilitas.js";
import laporan from "./laporan.js";

// Sarana dan Prasarana / IPSRS (STD-0022) — /api/v3/penunjang/sarpras/...
//   /referensi                                   lokasi, pegawai, pilihan enum, status fitur, batas berkas
//   /aset, /aset/:uuid/{lokasi|status|riwayat}   register aset (aset.js)
//   /laporan-kerusakan[/:uuid/{tugaskan|status|tutup|suku-cadang|berkas}]  work order perbaikan (laporan-kerusakan.js)
//   /pemeliharaan/jadwal[/:uuid/{nonaktifkan|pelaksanaan|riwayat}]          pemeliharaan preventif (pemeliharaan.js)
//   /kalibrasi[/:uuid/{jadwal|hasil|sertifikat}]  kalibrasi & sertifikat (kalibrasi.js)
//   /utilitas                                    catatan meter utilitas (utilitas.js)
//   /pengaturan                                  ambang peringatan kalibrasi
//   /laporan/*                                   laporan (laporan.js)
// Seluruh rute mensyaratkan modul sarpras aktif untuk faskes (fitur wajib sarpras_aset); pemeliharaan, kalibrasi, &
// utilitas juga mensyaratkan fiturnya aktif (403 bila tidak). Izin diperiksa per rute (Setting › Hak Akses).
const rute = express.Router();
const MODUL = "Sarana dan Prasarana (IPSRS)";

rute.use(wajibFiturSarpras("sarpras_aset"));

rute.get(
  "/referensi",
  wajibSalahSatu(
    [MODUL, "Aset", "READ"],
    [MODUL, "Laporan Kerusakan", "READ"],
    [MODUL, "Pemeliharaan", "READ"],
    [MODUL, "Kalibrasi", "READ"],
    [MODUL, "Utilitas", "READ"],
    [MODUL, "Laporan Sarpras", "READ"],
    [MODUL, "Pengaturan", "READ"],
  ),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const fitur = {};
    for (const kode of FITUR_SARPRAS) fitur[kode] = await fiturSarprasAktif(kode, f);
    kirim(res, {
      lokasi: await query(`SELECT uuid, name AS nama FROM lokasi WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY name`, [f]),
      pegawai: await query(`SELECT pg.uuid, ${NAMA_PEGAWAI("pg")} AS nama FROM pegawai pg WHERE pg.faskes_uuid = $1 AND pg.deleted_at IS NULL ORDER BY pg.name`, [f]),
      kategori_aset: pilihan(KATEGORI_ASET),
      status_aset: pilihan(STATUS_ASET),
      status_laporan: pilihan(STATUS_LAPORAN),
      prioritas: pilihan(PRIORITAS),
      frekuensi: pilihan(FREKUENSI),
      status_jadwal: pilihan(STATUS_JADWAL),
      hasil_kalibrasi: pilihan(HASIL_KALIBRASI),
      status_kalibrasi: pilihan(STATUS_KALIBRASI),
      jenis_utilitas: pilihan(JENIS_UTILITAS),
      fitur,
      inventory_aktif: await modulKatalogAktif("inventory", f),
      berkas: { tipe: Object.keys(TIPE_BERKAS), maks_mb: config.berkasSarprasMaksMb },
    });
  }),
);

rute.get(
  "/pengaturan",
  izinSarpras("Pengaturan", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const row = await satu(`SELECT * FROM sarpras_pengaturan WHERE faskes_uuid = $1`, [f]);
    kirim(res, row ?? { faskes_uuid: f, ambang_kalibrasi_hari: 30, diubah_oleh: null, updated_at: null });
  }),
);

rute.put(
  "/pengaturan",
  izinSarpras("Pengaturan", "UPDATE"),
  tangani(async (req, res) => {
    const ambang = bulatOpsional(req.body?.ambang_kalibrasi_hari, "ambang_kalibrasi_hari", { min: 1, maks: 3650 });
    if (ambang === undefined || ambang === null) throw permintaanSalah("ambang_kalibrasi_hari wajib diisi");
    const n = sekarang();
    const row = await satu(
      `INSERT INTO sarpras_pengaturan (faskes_uuid, ambang_kalibrasi_hari, diubah_oleh, created_at, updated_at) VALUES ($1, $2, $3, $4, $4)
       ON CONFLICT (faskes_uuid) DO UPDATE SET ambang_kalibrasi_hari = EXCLUDED.ambang_kalibrasi_hari, diubah_oleh = EXCLUDED.diubah_oleh, updated_at = EXCLUDED.updated_at
       RETURNING *`,
      [req.author.faskesUuid, ambang, req.author.username, n],
    );
    kirim(res, row, "Pengaturan Sarana & Prasarana berhasil disimpan");
  }),
);

rute.use("/aset", aset);
rute.use("/laporan-kerusakan", laporanKerusakan);
rute.use("/pemeliharaan", wajibFiturSarpras("sarpras_pemeliharaan"), pemeliharaan);
rute.use("/kalibrasi", wajibFiturSarpras("sarpras_kalibrasi"), kalibrasi);
rute.use("/utilitas", wajibFiturSarpras("sarpras_utilitas"), utilitas);
rute.use("/laporan", laporan);

export default rute;
