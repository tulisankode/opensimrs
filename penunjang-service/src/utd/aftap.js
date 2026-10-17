import express from "express";
import { query, satu, sisipkan, ubah, transaksi } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { GOLONGAN_DARAH, cekPilihan, angkaOpsional, daftarNilai, ramah, teks, waktuOpsional } from "./bersama.js";
import { izinUtd, bolehLihatReaktif } from "../umum/izin.js";

// Aftap (pengambilan darah): hanya dari kunjungan seleksi berstatus "layak" (KF-8); nomor kantong unik per faskes
// (KF-12); status awal kantong selalu "karantina" (KF-11).
const rute = express.Router();

const KOLOM_AFTAP = `a.uuid, a.donor_uuid, a.riwayat_uuid, a.no_kantong, a.volume_ml, a.golongan_darah, a.rhesus,
  a.waktu_mulai, a.waktu_selesai, a.petugas_uuid, a.reaksi_donor, a.catatan_reaksi, a.kegiatan, a.lokasi_mobile,
  a.status_kantong, a.created_at, a.updated_at,
  d.no_donor, d.nama AS nama_donor`;
const JOIN_DONOR = `JOIN utd_donor d ON d.uuid = a.donor_uuid`;

const ambilAftap = (uuid, faskes) =>
  satu(`SELECT ${KOLOM_AFTAP} FROM utd_aftap a ${JOIN_DONOR} WHERE a.uuid = $1 AND a.faskes_uuid = $2 AND a.deleted_at IS NULL`, [uuid, faskes]);

rute.get(
  "/",
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "a.faskes_uuid = $1 AND a.deleted_at IS NULL";
    const status = daftarNilai(req.query.status).filter((s) => ["karantina", "karantina_reaktif", "tersedia", "dimusnahkan"].includes(s));
    if (status.length) {
      p.push(status);
      w += ` AND a.status_kantong = ANY($${p.length})`;
    }
    if (req.query.cari) {
      p.push(`%${String(req.query.cari).trim()}%`);
      w += ` AND (a.no_kantong ILIKE $${p.length} OR d.no_donor ILIKE $${p.length} OR d.nama ILIKE $${p.length})`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM utd_aftap a ${JOIN_DONOR} WHERE ${w}`, p)).n;
    const rows = await query(
      `SELECT ${KOLOM_AFTAP} FROM utd_aftap a ${JOIN_DONOR} WHERE ${w} ORDER BY a.created_at DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`,
      p,
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.post(
  "/",
  izinUtd("Aftap", "CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["riwayat_uuid", "no_kantong", "volume_ml"]);
    const faskes = req.author.faskesUuid;
    const volume = angkaOpsional(b.volume_ml, "volume_ml");
    if (!volume || volume <= 0) throw permintaanSalah("volume_ml harus lebih dari 0");

    const t = await transaksi(async (k) => {
      const r = await satu(
        `SELECT r.*, d.golongan_darah AS donor_golongan, d.rhesus AS donor_rhesus FROM utd_donor_riwayat r
           JOIN utd_donor d ON d.uuid = r.donor_uuid
          WHERE r.uuid = $1 AND r.faskes_uuid = $2 AND r.deleted_at IS NULL FOR UPDATE`,
        [b.riwayat_uuid, faskes], k,
      );
      if (!r) throw tidakDitemukan("Kunjungan seleksi");
      if (r.status !== "layak") throw new Galat(409, `Kunjungan seleksi berstatus ${r.status}, aftap hanya dari kunjungan yang layak`);
      const sudahAda = await satu(`SELECT uuid FROM utd_aftap WHERE riwayat_uuid = $1 AND deleted_at IS NULL`, [r.uuid], k);
      if (sudahAda) throw new Galat(409, "Kunjungan seleksi ini sudah memiliki aftap");

      const golongan = b.golongan_darah === undefined ? r.donor_golongan : cekPilihan(b.golongan_darah, GOLONGAN_DARAH, "golongan_darah");
      const rhesus = b.rhesus === undefined ? r.donor_rhesus : cekPilihan(b.rhesus, { positif: 1, negatif: 1 }, "rhesus");
      // Golongan darah/rhesus baru pertama kali diketahui saat aftap: simpan juga ke profil donor.
      if (golongan && !r.donor_golongan) await ubah("utd_donor", r.donor_uuid, faskes, { golongan_darah: golongan }, k);
      if (rhesus && !r.donor_rhesus) await ubah("utd_donor", r.donor_uuid, faskes, { rhesus }, k);

      const waktuMulai = waktuOpsional(b.waktu_mulai, "waktu_mulai");
      const waktuSelesai = waktuOpsional(b.waktu_selesai, "waktu_selesai");
      if (waktuMulai && waktuSelesai && waktuSelesai < waktuMulai) throw permintaanSalah("waktu_selesai tidak boleh sebelum waktu_mulai");
      const aftap = await sisipkan(
        "utd_aftap",
        {
          faskes_uuid: faskes, donor_uuid: r.donor_uuid, riwayat_uuid: r.uuid, no_kantong: String(b.no_kantong).trim(),
          volume_ml: volume, golongan_darah: golongan ?? null, rhesus: rhesus ?? null,
          waktu_mulai: waktuMulai, waktu_selesai: waktuSelesai, petugas_uuid: teks(b.petugas_uuid),
          reaksi_donor: b.reaksi_donor === undefined ? "tidak_ada" : cekPilihan(b.reaksi_donor, { tidak_ada: 1, ringan: 1, sedang: 1, berat: 1 }, "reaksi_donor"),
          catatan_reaksi: teks(b.catatan_reaksi), kegiatan: teks(b.kegiatan), lokasi_mobile: teks(b.lokasi_mobile),
          status_kantong: "karantina", dibuat_oleh: req.author.username ?? null,
        },
        k,
      ).catch((e) => ramah(e, `Nomor kantong ${b.no_kantong} sudah digunakan`));
      return aftap;
    });
    kirim(res, await ambilAftap(t.uuid, faskes), `Aftap kantong ${t.no_kantong} tersimpan (status karantina)`);
  }),
);

// Jejak lengkap satu kantong: donor, riwayat seleksi, hasil IMLTD (disamarkan tanpa izin), & komponen turunannya.
// Dipakai detail aftap dan jejak komponen (KT-6, KF-18).
export const jejakAftap = async (aftapUuid, faskes, req) => {
  const a = await ambilAftap(aftapUuid, faskes);
  if (!a) throw tidakDitemukan("Aftap");
  const [riwayat, imltd, komponen] = await Promise.all([
    satu(`SELECT * FROM utd_donor_riwayat WHERE uuid = $1`, [a.riwayat_uuid]),
    satu(`SELECT * FROM utd_imltd WHERE aftap_uuid = $1 AND deleted_at IS NULL`, [a.uuid]),
    query(
      `SELECT uuid, jenis_komponen, label_unik, volume_ml, golongan_darah, rhesus, tanggal_kedaluwarsa, status, dilepas_oleh, dilepas_pada, created_at
         FROM utd_komponen WHERE aftap_uuid = $1 AND deleted_at IS NULL ORDER BY created_at`,
      [a.uuid],
    ),
  ]);
  let imltdTampil = imltd;
  if (imltd && imltd.status_akhir === "reaktif" && !(await bolehLihatReaktif(req))) {
    await sisipkan("utd_akses_log", {
      faskes_uuid: faskes, aftap_uuid: a.uuid, username: req.author.username ?? null,
      keterangan: `Membuka jejak kantong ${a.no_kantong} tanpa izin Lihat Hasil Reaktif`,
    });
    imltdTampil = { uuid: imltd.uuid, aftap_uuid: imltd.aftap_uuid, status_akhir: "reaktif", disamarkan: true };
  }
  return { ...a, riwayat, imltd: imltdTampil, komponen };
};

rute.get(
  "/:uuid",
  tangani(async (req, res) => kirim(res, await jejakAftap(req.params.uuid, req.author.faskesUuid, req))),
);

export default rute;
