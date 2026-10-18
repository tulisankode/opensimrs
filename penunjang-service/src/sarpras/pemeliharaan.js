import express from "express";
import { query, satu, sisipkan, ubah, sekarang, transaksi } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, permintaanSalah, tidakDitemukan } from "../umum/respons.js";
import { izinSarpras } from "../umum/izin.js";
import {
  FREKUENSI,
  STATUS_JADWAL,
  HARI,
  angkaOpsional,
  awalHariWib,
  cekPilihan,
  epochOpsional,
  epochWajib,
  konflik,
  pelaksanaanTerlambat,
  statusJadwal,
  tanggalBerikutnya,
  teks,
  teksWajib,
  validasiChecklist,
  validasiChecklistHasil,
  wajibPilihan,
} from "./bersama.js";
import { NAMA_PEGAWAI, ambilAset, catatRiwayat, cekPegawai } from "./dasar.js";

// Pemeliharaan preventif (KF-12/KF-13, fitur sarpras_pemeliharaan): jadwal per aset (frekuensi + checklist +
// tanggal berikutnya, disimpan sebagai awal hari WIB), penanda terlambat (KT-14), pelaksanaan sebagai riwayat
// tersendiri (KT-15) yang menghitung ulang tanggal berikutnya dari tanggal pelaksanaan (desain §2.3).
const rute = express.Router();

const PILIH = `j.*, a.kode_inventaris, a.nama AS nama_aset, a.kategori AS kategori_aset, a.status AS status_aset, l.name AS nama_lokasi,
  (SELECT MAX(x.waktu_mulai) FROM sarpras_pelaksanaan_pemeliharaan x WHERE x.jadwal_uuid = j.uuid AND x.deleted_at IS NULL) AS pelaksanaan_terakhir`;
const DARI = `sarpras_jadwal_pemeliharaan j
  JOIN sarpras_aset a ON a.uuid = j.aset_uuid AND a.faskes_uuid = j.faskes_uuid
  LEFT JOIN lokasi l ON l.uuid = a.lokasi_uuid AND l.faskes_uuid = a.faskes_uuid`;

const denganStatus = (j, n = sekarang()) => ({ ...j, status_jatuh_tempo: j.status === "aktif" ? statusJadwal(j.tanggal_berikutnya, n) : null, terlambat: j.status === "aktif" && statusJadwal(j.tanggal_berikutnya, n) === "terlambat" });

const ambilJadwal = async (uuid, faskesUuid, k, kunci = false) => {
  const j = await satu(
    `SELECT * FROM sarpras_jadwal_pemeliharaan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL${kunci ? " FOR UPDATE" : ""}`,
    [String(uuid), faskesUuid],
    k,
  );
  if (!j) throw tidakDitemukan("Jadwal pemeliharaan");
  return j;
};

rute.get(
  "/jadwal",
  izinSarpras("Pemeliharaan", "READ"),
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const q = req.query;
    const n = sekarang();
    const p = [req.author.faskesUuid];
    let w = "j.faskes_uuid = $1 AND j.deleted_at IS NULL";
    if (q.aset_uuid) {
      p.push(String(q.aset_uuid));
      w += ` AND j.aset_uuid = $${p.length}`;
    }
    const status = cekPilihan(q.status || undefined, STATUS_JADWAL, "status");
    if (status) {
      p.push(status);
      w += ` AND j.status = $${p.length}`;
    }
    // terlambat = jadwal aktif yang hari jatuh temponya sebelum hari ini (WIB).
    if (q.terlambat === "true") {
      p.push(awalHariWib(n));
      w += ` AND j.status = 'aktif' AND j.tanggal_berikutnya < $${p.length}`;
    }
    // Jatuh tempo s.d. N hari ke depan (daftar pekerjaan, termasuk yang terlambat).
    if (q.dalam_hari !== undefined && q.dalam_hari !== "") {
      const hari = angkaOpsional(q.dalam_hari, "dalam_hari", { min: 0, maks: 366 });
      p.push(awalHariWib(n) + Math.floor(hari) * HARI);
      w += ` AND j.status = 'aktif' AND j.tanggal_berikutnya <= $${p.length}`;
    }
    if (q.cari) {
      p.push(`%${String(q.cari).trim()}%`);
      w += ` AND (a.nama ILIKE $${p.length} OR a.kode_inventaris ILIKE $${p.length})`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM ${DARI} WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT ${PILIH} FROM ${DARI} WHERE ${w} ORDER BY (j.status = 'aktif') DESC, j.tanggal_berikutnya, a.nama LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows.map((j) => denganStatus(j, n)), total, pg));
  }),
);

rute.post(
  "/jadwal",
  izinSarpras("Pemeliharaan", "CREATE JADWAL"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    if (!b.aset_uuid) throw permintaanSalah("aset_uuid wajib diisi");
    const frekuensi = wajibPilihan(b.frekuensi, FREKUENSI, "frekuensi");
    const checklist = validasiChecklist(b.checklist);
    const tanggal = awalHariWib(epochWajib(b.tanggal_berikutnya, "tanggal_berikutnya"));
    const hasil = await transaksi(async (k) => {
      const aset = await ambilAset(b.aset_uuid, f, k, { bisaDikerjakan: true });
      const jadwal = await sisipkan(
        "sarpras_jadwal_pemeliharaan",
        { faskes_uuid: f, aset_uuid: aset.uuid, frekuensi, checklist, tanggal_berikutnya: tanggal, status: "aktif", dibuat_oleh: req.author.username },
        k,
      );
      await catatRiwayat(k, f, aset.uuid, "jadwal_pemeliharaan_dibuat", { jadwal_uuid: jadwal.uuid, frekuensi, tanggal_berikutnya: tanggal }, req.author.username);
      return jadwal;
    });
    kirim(res, denganStatus(hasil), "Jadwal pemeliharaan berhasil dibuat");
  }),
);

// Ubah checklist/tanggal berikutnya; checklist lama pada pelaksanaan terdahulu tidak berubah (disalin per pelaksanaan).
rute.put(
  "/jadwal/:uuid",
  izinSarpras("Pemeliharaan", "UPDATE JADWAL"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    const perubahan = {
      checklist: b.checklist === undefined ? undefined : validasiChecklist(b.checklist),
      tanggal_berikutnya: b.tanggal_berikutnya === undefined ? undefined : awalHariWib(epochWajib(b.tanggal_berikutnya, "tanggal_berikutnya")),
      frekuensi: b.frekuensi === undefined ? undefined : wajibPilihan(b.frekuensi, FREKUENSI, "frekuensi"),
    };
    if (Object.values(perubahan).every((v) => v === undefined)) throw permintaanSalah("Tidak ada perubahan yang dikirim");
    const hasil = await transaksi(async (k) => {
      const lama = await ambilJadwal(req.params.uuid, f, k, true);
      if (lama.status !== "aktif") throw konflik("Jadwal sudah nonaktif");
      const jadwal = await ubah("sarpras_jadwal_pemeliharaan", lama.uuid, f, perubahan, k);
      await catatRiwayat(
        k,
        f,
        lama.aset_uuid,
        "jadwal_pemeliharaan_diubah",
        { jadwal_uuid: lama.uuid, ...Object.fromEntries(Object.entries(perubahan).filter(([, v]) => v !== undefined)) },
        req.author.username,
      );
      return jadwal;
    });
    kirim(res, denganStatus(hasil), "Jadwal pemeliharaan berhasil diperbarui");
  }),
);

rute.patch(
  "/jadwal/:uuid/nonaktifkan",
  izinSarpras("Pemeliharaan", "NONAKTIFKAN JADWAL"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const alasan = teksWajib(req.body?.alasan, "alasan", 2000);
    const hasil = await transaksi(async (k) => {
      const lama = await ambilJadwal(req.params.uuid, f, k, true);
      if (lama.status !== "aktif") throw konflik("Jadwal sudah nonaktif");
      const jadwal = await ubah(
        "sarpras_jadwal_pemeliharaan",
        lama.uuid,
        f,
        { status: "nonaktif", alasan_nonaktif: alasan, dinonaktifkan_oleh: req.author.username, dinonaktifkan_pada: sekarang() },
        k,
      );
      await catatRiwayat(k, f, lama.aset_uuid, "jadwal_pemeliharaan_dinonaktifkan", { jadwal_uuid: lama.uuid, alasan }, req.author.username);
      return jadwal;
    });
    kirim(res, denganStatus(hasil), "Jadwal pemeliharaan dinonaktifkan");
  }),
);

// Pelaksanaan: baris jadwal dikunci (FOR UPDATE) agar dua pencatatan bersamaan tidak menghitung jadwal dobel.
// terlambat = dilaksanakan setelah hari jatuh tempo; tanggal berikutnya = frekuensi dari hari pelaksanaan. Pelaksanaan
// susulan yang lebih lama dari pelaksanaan terakhir tidak memundurkan jadwal.
rute.post(
  "/jadwal/:uuid/pelaksanaan",
  izinSarpras("Pemeliharaan", "CATAT PELAKSANAAN"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    const n = sekarang();
    const waktuMulai = epochWajib(b.waktu_mulai, "waktu_mulai");
    const waktuSelesai = epochOpsional(b.waktu_selesai, "waktu_selesai") ?? null;
    if (waktuMulai > n + 300) throw permintaanSalah("waktu_mulai tidak boleh di masa depan");
    if (waktuSelesai && waktuSelesai < waktuMulai) throw permintaanSalah("waktu_selesai tidak boleh sebelum waktu_mulai");
    if (waktuSelesai && waktuSelesai > n + 300) throw permintaanSalah("waktu_selesai tidak boleh di masa depan");
    const isi = {
      checklist_hasil: validasiChecklistHasil(b.checklist_hasil),
      hasil: teks(b.hasil, "hasil", 5000) ?? null,
      catatan: teks(b.catatan, "catatan", 5000) ?? null,
      biaya: angkaOpsional(b.biaya, "biaya", { min: 0, maks: 999999999999 }) ?? null,
    };
    const hasil = await transaksi(async (k) => {
      const j = await ambilJadwal(req.params.uuid, f, k, true);
      if (j.status !== "aktif") throw konflik("Jadwal sudah nonaktif; pelaksanaan tidak dapat dicatat");
      await ambilAset(j.aset_uuid, f, k, { bisaDikerjakan: true });
      const pelaksana = (await cekPegawai(b.pelaksana_uuid, f, k, "Pelaksana")) ?? null;
      const terakhir = Number(
        (await satu(`SELECT MAX(waktu_mulai) m FROM sarpras_pelaksanaan_pemeliharaan WHERE jadwal_uuid = $1 AND deleted_at IS NULL`, [j.uuid], k))?.m ?? 0,
      );
      const pelaksanaan = await sisipkan(
        "sarpras_pelaksanaan_pemeliharaan",
        {
          ...isi,
          faskes_uuid: f,
          jadwal_uuid: j.uuid,
          aset_uuid: j.aset_uuid,
          waktu_mulai: waktuMulai,
          waktu_selesai: waktuSelesai,
          pelaksana_uuid: pelaksana,
          dicatat_oleh: req.author.username,
          jatuh_tempo: j.tanggal_berikutnya,
          terlambat: pelaksanaanTerlambat(waktuMulai, j.tanggal_berikutnya),
        },
        k,
      );
      let jadwal = j;
      if (waktuMulai >= terakhir) {
        jadwal = await ubah("sarpras_jadwal_pemeliharaan", j.uuid, f, { tanggal_berikutnya: tanggalBerikutnya(waktuMulai, j.frekuensi) }, k);
      }
      await catatRiwayat(
        k,
        f,
        j.aset_uuid,
        "pemeliharaan_dilaksanakan",
        { jadwal_uuid: j.uuid, pelaksanaan_uuid: pelaksanaan.uuid, terlambat: pelaksanaan.terlambat, tanggal_berikutnya: jadwal.tanggal_berikutnya },
        req.author.username,
      );
      return { ...pelaksanaan, jadwal: denganStatus(jadwal) };
    });
    kirim(res, hasil, "Pelaksanaan pemeliharaan berhasil dicatat");
  }),
);

rute.get(
  "/jadwal/:uuid/riwayat",
  izinSarpras("Pemeliharaan", "READ"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const j = await ambilJadwal(req.params.uuid, f);
    const pg = halaman(req.query);
    const total = (await satu(`SELECT COUNT(*) n FROM sarpras_pelaksanaan_pemeliharaan WHERE jadwal_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [j.uuid, f])).n;
    const rows = await query(
      `SELECT x.*, ${NAMA_PEGAWAI("pg")} AS nama_pelaksana FROM sarpras_pelaksanaan_pemeliharaan x
         LEFT JOIN pegawai pg ON pg.uuid = x.pelaksana_uuid AND pg.faskes_uuid = x.faskes_uuid
        WHERE x.jadwal_uuid = $1 AND x.faskes_uuid = $2 AND x.deleted_at IS NULL ORDER BY x.waktu_mulai DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      [j.uuid, f],
    );
    kirim(res, { ...denganHalaman(rows, total, pg), jadwal: denganStatus(j) });
  }),
);

export default rute;
