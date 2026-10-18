import express from "express";
import { query, satu, sisipkan, ubah } from "../db.js";
import { tangani, kirim, wajib, tidakDitemukan, permintaanSalah, Galat, halaman, denganHalaman } from "../umum/respons.js";
import { izinHd } from "../umum/izin.js";
import { nomorBaru } from "../umum/nomor.js";
import { cariKunjungan } from "../umum/kunjungan.js";
import { JENIS_HD, angka, pilihan, ramah, teks } from "./bersama.js";

// Registrasi pasien HD akut/kronis (KF-1/KT-1): terkait pasien faskes (token), kunjungan asal opsional (No. Reg, untuk
// penjamin & tagihan) dan cara bayar. Satu registrasi aktif per pasien; menonaktifkan registrasi tidak menghapus riwayat.
const rute = express.Router();
const izin = (aksi) => izinHd("Registrasi & Jadwal", aksi);

export const KOLOM_REGISTRASI = `r.uuid, r.no_reg_hd, r.jenis, r.no_reg, r.payment_method, r.status, r.catatan, r.alasan_nonaktif, r.dibuat_oleh,
  r.created_at, r.updated_at, r.patient_uuid, p.no_rm, p.name AS nama_pasien, p.gender, bd.birth_date`;
const DARI = `hd_registrasi r JOIN patients p ON p.uuid = r.patient_uuid LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid`;

export const ambilRegistrasi = async (uuid, faskes, k) => {
  const r = await satu(`SELECT ${KOLOM_REGISTRASI} FROM ${DARI} WHERE r.uuid = $1 AND r.faskes_uuid = $2 AND r.deleted_at IS NULL`, [uuid, faskes], k);
  if (!r) throw tidakDitemukan("Registrasi HD");
  return r;
};

// Kunjungan (No. Reg) harus milik pasien yang sama pada faskes ini.
export const validasiKunjungan = async (noReg, patientUuid, faskes) => {
  if (!noReg) return null;
  const kunjungan = await cariKunjungan(String(noReg).trim(), faskes);
  if (!kunjungan) throw tidakDitemukan(`Kunjungan ${noReg}`);
  if (kunjungan.patient_uuid !== patientUuid) throw permintaanSalah(`Kunjungan ${noReg} bukan milik pasien ini`);
  return kunjungan;
};

// Pencarian pasien terdaftar (nama / No. RM), maks. 20.
rute.get(
  "/pasien",
  izin("READ"),
  tangani(async (req, res) => {
    const cari = String(req.query.cari ?? "").trim();
    if (cari.length < 2) return kirim(res, []);
    kirim(
      res,
      await query(
        `SELECT p.uuid, p.no_rm, p.name AS nama, p.gender, bd.birth_date,
                (SELECT r.uuid FROM hd_registrasi r WHERE r.patient_uuid = p.uuid AND r.faskes_uuid = p.faskes_uuid
                    AND r.status = 'aktif' AND r.deleted_at IS NULL LIMIT 1) AS registrasi_aktif_uuid
           FROM patients p LEFT JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid
          WHERE p.faskes_uuid = $1 AND p.deleted_at IS NULL AND p.status AND (p.name ILIKE $2 OR p.no_rm ILIKE $2)
          ORDER BY p.name LIMIT 20`,
        [req.author.faskesUuid, `%${cari}%`],
      ),
    );
  }),
);

rute.get(
  "/registrasi",
  izin("READ"),
  tangani(async (req, res) => {
    const pg = halaman(req.query);
    const p = [req.author.faskesUuid];
    let w = "r.faskes_uuid = $1 AND r.deleted_at IS NULL";
    if (req.query.status) {
      p.push(String(req.query.status));
      w += ` AND r.status = $${p.length}`;
    }
    if (req.query.jenis) {
      p.push(String(req.query.jenis));
      w += ` AND r.jenis = $${p.length}`;
    }
    if (req.query.cari) {
      p.push(`%${String(req.query.cari).trim()}%`);
      w += ` AND (p.name ILIKE $${p.length} OR p.no_rm ILIKE $${p.length} OR r.no_reg_hd ILIKE $${p.length})`;
    }
    const total = (await satu(`SELECT COUNT(*) n FROM ${DARI} WHERE ${w}`, p)).n;
    const rows = await query(`SELECT ${KOLOM_REGISTRASI} FROM ${DARI} WHERE ${w} ORDER BY r.created_at DESC LIMIT ${pg.limit} OFFSET ${pg.offset}`, p);
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.get(
  "/registrasi/:uuid",
  izin("READ"),
  tangani(async (req, res) => kirim(res, await ambilRegistrasi(req.params.uuid, req.author.faskesUuid))),
);

// POST /registrasi { patient_uuid, jenis, no_reg?, payment_method?, catatan? }
rute.post(
  "/registrasi",
  izin("CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["patient_uuid", "jenis"]);
    const f = req.author.faskesUuid;
    const jenis = pilihan(b.jenis, JENIS_HD, "jenis");
    const pasien = await satu(`SELECT uuid FROM patients WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [b.patient_uuid, f]);
    if (!pasien) throw tidakDitemukan("Pasien");
    const kunjungan = await validasiKunjungan(b.no_reg, pasien.uuid, f);
    const ada = await satu(`SELECT no_reg_hd FROM hd_registrasi WHERE patient_uuid = $1 AND faskes_uuid = $2 AND status = 'aktif' AND deleted_at IS NULL`, [pasien.uuid, f]);
    if (ada) throw new Galat(409, `Pasien sudah memiliki registrasi HD aktif (${ada.no_reg_hd})`);
    const baris = await sisipkan("hd_registrasi", {
      faskes_uuid: f,
      patient_uuid: pasien.uuid,
      no_reg_hd: await nomorBaru(f, "HD"),
      jenis,
      no_reg: kunjungan?.no_reg ?? null,
      payment_method: b.payment_method === undefined || b.payment_method === null || b.payment_method === "" ? Number(kunjungan?.payment_method ?? 1) : angka(b.payment_method, "payment_method", { min: 1, bulat: true }),
      status: "aktif",
      catatan: teks(b.catatan),
      dibuat_oleh: req.author.username ?? null,
    }).catch((e) => ramah(e, "Pasien sudah memiliki registrasi HD aktif"));
    kirim(res, await ambilRegistrasi(baris.uuid, f), "Registrasi HD berhasil dibuat");
  }),
);

// PUT /registrasi/:uuid { jenis?, no_reg?, payment_method?, catatan? }
rute.put(
  "/registrasi/:uuid",
  izin("UPDATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    const r = await ambilRegistrasi(req.params.uuid, f);
    if (r.status !== "aktif") throw new Galat(409, "Registrasi HD sudah nonaktif");
    const kunjungan = b.no_reg ? await validasiKunjungan(b.no_reg, r.patient_uuid, f) : null;
    await ubah("hd_registrasi", r.uuid, f, {
      jenis: b.jenis === undefined ? undefined : pilihan(b.jenis, JENIS_HD, "jenis"),
      no_reg: b.no_reg === undefined ? undefined : kunjungan?.no_reg ?? null,
      payment_method: b.payment_method === undefined ? undefined : angka(b.payment_method, "payment_method", { min: 1, bulat: true }),
      catatan: b.catatan === undefined ? undefined : teks(b.catatan),
    });
    kirim(res, await ambilRegistrasi(r.uuid, f), "Registrasi HD diperbarui");
  }),
);

// Nonaktifkan registrasi (mis. pasien pindah/transplantasi/meninggal). Jadwal mendatang yang belum berjalan harus dibatalkan dulu.
rute.post(
  "/registrasi/:uuid/nonaktif",
  izin("BATAL"),
  tangani(async (req, res) => {
    const alasan = teks(req.body?.alasan);
    if (!alasan) throw permintaanSalah("alasan wajib diisi");
    const f = req.author.faskesUuid;
    const r = await ambilRegistrasi(req.params.uuid, f);
    if (r.status !== "aktif") throw new Galat(409, "Registrasi HD sudah nonaktif");
    const aktif = await satu(`SELECT COUNT(*)::int n FROM hd_jadwal WHERE registrasi_uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL AND status IN ('terjadwal','hadir','berjalan')`, [r.uuid, f]);
    if (aktif.n) throw new Galat(409, `Masih ada ${aktif.n} jadwal aktif; batalkan jadwal tersebut sebelum menonaktifkan registrasi`);
    await ubah("hd_registrasi", r.uuid, f, { status: "nonaktif", alasan_nonaktif: alasan });
    kirim(res, await ambilRegistrasi(r.uuid, f), "Registrasi HD dinonaktifkan");
  }),
);

export default rute;
