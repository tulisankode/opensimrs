import express from "express";
import { query, satu, sisipkan, ubah, transaksi, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, wajib, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { izinOk } from "../umum/izin.js";
import { ambilOrder, detailOrder } from "./order.js";
import { peranValid, epoch, tanggalValid, tglLokal } from "./bersama.js";

// Penjadwalan order operasi ke ruang, waktu, dan tim. Konflik ruang/operator diperiksa dalam transaksi dengan
// rentang setengah terbuka [waktu_mulai, waktu_selesai) terhadap jadwal aktif (status <> 'batal') — KF-5/KT-5.
// Penjadwalan ulang mengubah baris ok_jadwal yang sama (riwayat perubahan di alasan_perubahan), bukan baris baru.
const rute = express.Router();

const PILIH_JADWAL = `
  j.uuid, j.order_uuid, j.ruang_uuid, r.kode AS ruang_kode, r.nama AS ruang_nama,
  j.waktu_mulai::float8 AS waktu_mulai, j.waktu_selesai::float8 AS waktu_selesai, j.status,
  j.alasan_perubahan, j.serah_terima, j.waktu_selesai_aktual::float8 AS waktu_selesai_aktual,
  j.dibuat_oleh, j.created_at::float8 AS created_at,
  o.no_order, o.jenis_operasi, o.status AS status_order, o.patient_uuid, o.no_rm, o.diagnosis_nama,
  p.name AS nama_pasien, p.gender`;
const DARI_JADWAL = `
  ok_jadwal j JOIN ok_ruang r ON r.uuid = j.ruang_uuid JOIN ok_order o ON o.uuid = j.order_uuid
  LEFT JOIN patients p ON p.uuid = o.patient_uuid`;

export const timJadwal = (jadwalUuid, k) =>
  query(
    `SELECT t.uuid, t.practitioner_uuid, t.peran,
            TRIM(CONCAT_WS(' ', pg.first_title, pg.name, NULLIF(pg.last_title, ''))) AS nama
       FROM ok_jadwal_tim t LEFT JOIN practitioner pr ON pr.uuid = t.practitioner_uuid
       LEFT JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid
      WHERE t.jadwal_uuid = $1 AND t.deleted_at IS NULL ORDER BY t.created_at`,
    [jadwalUuid],
    k,
  );

export const ambilJadwal = async (uuid, faskesUuid, k) => {
  const j = await satu(`SELECT * FROM ok_jadwal WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ${k ? "FOR UPDATE" : ""}`, [uuid, faskesUuid], k);
  if (!j) throw tidakDitemukan("Jadwal operasi");
  return j;
};

export const detailJadwal = async (uuid, faskesUuid, k) => {
  const j = await satu(`SELECT ${PILIH_JADWAL} FROM ${DARI_JADWAL} WHERE j.uuid = $1 AND j.faskes_uuid = $2`, [uuid, faskesUuid], k);
  if (!j) throw tidakDitemukan("Jadwal operasi");
  return { ...j, tim: await timJadwal(uuid, k) };
};

const siapkanTim = (daftar) => {
  if (!Array.isArray(daftar) || daftar.length === 0) throw permintaanSalah("Tim operasi minimal memiliki satu anggota (operator)");
  const tim = daftar.map((t) => ({ practitioner_uuid: String(t?.practitioner_uuid ?? "").trim(), peran: peranValid(t?.peran) }));
  if (!tim.some((t) => t.peran === "operator")) throw permintaanSalah("Tim operasi wajib memiliki operator");
  if (tim.some((t) => !t.practitioner_uuid)) throw permintaanSalah("practitioner_uuid setiap anggota tim wajib diisi");
  return tim;
};

// Konflik ruang atau anggota tim yang sama pada rentang waktu beririsan (jadwal aktif, bukan `kecuali`).
const cekBentrok = async ({ faskesUuid, ruangUuid, mulai, selesai, tim, kecuali = null }, k) => {
  const bentrokRuang = await satu(
    `SELECT uuid FROM ok_jadwal
      WHERE faskes_uuid = $1 AND ruang_uuid = $2 AND status <> 'batal' AND deleted_at IS NULL
        AND uuid IS DISTINCT FROM $3 AND waktu_mulai < $5 AND waktu_selesai > $4`,
    [faskesUuid, ruangUuid, kecuali, mulai, selesai],
    k,
  );
  if (bentrokRuang) throw new Galat(409, "Ruang OK sudah memiliki jadwal operasi lain pada rentang waktu tersebut");
  for (const t of tim) {
    const bentrokTim = await satu(
      `SELECT jt.uuid FROM ok_jadwal_tim jt JOIN ok_jadwal j ON j.uuid = jt.jadwal_uuid
        WHERE jt.faskes_uuid = $1 AND jt.practitioner_uuid = $2 AND jt.deleted_at IS NULL
          AND j.status <> 'batal' AND j.deleted_at IS NULL AND j.uuid IS DISTINCT FROM $3
          AND j.waktu_mulai < $5 AND j.waktu_selesai > $4`,
      [faskesUuid, t.practitioner_uuid, kecuali, mulai, selesai],
      k,
    );
    if (bentrokTim) throw new Galat(409, `Salah satu anggota tim sudah memiliki jadwal operasi lain pada rentang waktu tersebut`);
  }
};

const tulisTim = async (jadwalUuid, faskesUuid, tim, k) => {
  await query(`DELETE FROM ok_jadwal_tim WHERE jadwal_uuid = $1`, [jadwalUuid], k);
  for (const t of tim) await sisipkan("ok_jadwal_tim", { faskes_uuid: faskesUuid, jadwal_uuid: jadwalUuid, ...t }, k);
};

// ── Daftar & detail ──────────────────────────────────────────────────────────────

// ?tanggal_mulai=&tanggal_selesai=&ruang_uuid=&status=&operator_uuid=&patient_uuid=
// (patient_uuid dipakai juga oleh API baca internal jadwal operasi per pasien — KF-19/KT-19.)
rute.get(
  "/jadwal",
  izinOk("Jadwal OK", "READ"),
  tangani(async (req, res) => {
    const q = req.query;
    const pg = halaman(q);
    const p = [req.author.faskesUuid];
    let w = "j.faskes_uuid = $1 AND j.deleted_at IS NULL";
    const tambah = (nilai, kondisi) => {
      p.push(nilai);
      w += ` AND ${kondisi.replaceAll("$?", `$${p.length}`)}`;
    };
    if (q.tanggal_mulai) tambah(tanggalValid(q.tanggal_mulai), `${tglLokal("j.waktu_mulai")} >= $?::date`);
    if (q.tanggal_selesai) tambah(tanggalValid(q.tanggal_selesai), `${tglLokal("j.waktu_mulai")} <= $?::date`);
    if (q.ruang_uuid) tambah(q.ruang_uuid, "j.ruang_uuid = $?");
    if (q.status) tambah(String(q.status).split(","), "j.status = ANY($?)");
    if (q.operator_uuid) tambah(q.operator_uuid, "EXISTS (SELECT 1 FROM ok_jadwal_tim t WHERE t.jadwal_uuid = j.uuid AND t.practitioner_uuid = $? AND t.deleted_at IS NULL)");
    if (q.patient_uuid) tambah(q.patient_uuid, "o.patient_uuid = $?");
    const total = (await satu(`SELECT COUNT(*) n FROM ${DARI_JADWAL} WHERE ${w}`, p)).n;
    const rows = await query(`SELECT ${PILIH_JADWAL} FROM ${DARI_JADWAL} WHERE ${w} ORDER BY j.waktu_mulai LIMIT ${pg.limit} OFFSET ${pg.offset}`, p);
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.get(
  "/jadwal/:uuid",
  izinOk("Jadwal OK", "READ"),
  tangani(async (req, res) => kirim(res, await detailJadwal(req.params.uuid, req.author.faskesUuid))),
);

// ── Penjadwalan ──────────────────────────────────────────────────────────────────

// POST /orders/:order_uuid/jadwal { ruang_uuid, waktu_mulai, waktu_selesai, tim[] }
rute.post(
  "/orders/:order_uuid/jadwal",
  izinOk("Jadwal OK", "CREATE"),
  tangani(async (req, res) => {
    wajib(req.body, ["ruang_uuid", "waktu_mulai", "waktu_selesai"]);
    const f = req.author.faskesUuid;
    const mulai = epoch(req.body.waktu_mulai);
    const selesai = epoch(req.body.waktu_selesai);
    if (!(selesai > mulai)) throw permintaanSalah("waktu_selesai harus setelah waktu_mulai");
    const tim = siapkanTim(req.body.tim);
    const hasil = await transaksi(async (k) => {
      const o = await ambilOrder(req.params.order_uuid, f, k);
      if (!["menunggu_jadwal", "terjadwal"].includes(o.status)) throw new Galat(409, `Order berstatus ${o.status} tidak dapat dijadwalkan`);
      const ruang = await satu(`SELECT uuid FROM ok_ruang WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL AND aktif`, [req.body.ruang_uuid, f], k);
      if (!ruang) throw tidakDitemukan("Ruang OK (atau sedang tidak aktif)");
      const sudahAda = await satu(`SELECT uuid FROM ok_jadwal WHERE order_uuid = $1 AND status <> 'batal' AND deleted_at IS NULL`, [o.uuid], k);
      if (sudahAda) throw new Galat(409, "Order sudah memiliki jadwal aktif; gunakan jadwal-ulang untuk mengubahnya");
      await cekBentrok({ faskesUuid: f, ruangUuid: req.body.ruang_uuid, mulai, selesai, tim }, k);
      const j = await sisipkan(
        "ok_jadwal",
        { faskes_uuid: f, order_uuid: o.uuid, ruang_uuid: req.body.ruang_uuid, waktu_mulai: mulai, waktu_selesai: selesai, status: "terjadwal", dibuat_oleh: req.author.username ?? null },
        k,
      );
      await tulisTim(j.uuid, f, tim, k);
      await ubah("ok_order", o.uuid, f, { status: "terjadwal" }, k);
      return { jadwal: await detailJadwal(j.uuid, f, k), order: await detailOrder(o.uuid, f, k) };
    });
    kirim(res, hasil, `Jadwal operasi untuk order ${hasil.order.no_order} berhasil dibuat`);
  }),
);

// PATCH /jadwal/:uuid/jadwal-ulang { ruang_uuid, waktu_mulai, waktu_selesai, tim[], alasan }
rute.patch(
  "/jadwal/:uuid/jadwal-ulang",
  izinOk("Jadwal OK", "UPDATE"),
  tangani(async (req, res) => {
    wajib(req.body, ["alasan"]);
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const j = await ambilJadwal(req.params.uuid, f, k);
      if (j.status !== "terjadwal") throw new Galat(409, `Jadwal berstatus ${j.status} tidak dapat dijadwalkan ulang`);
      const ruangUuid = req.body.ruang_uuid ?? j.ruang_uuid;
      const mulai = req.body.waktu_mulai === undefined ? j.waktu_mulai : epoch(req.body.waktu_mulai);
      const selesai = req.body.waktu_selesai === undefined ? j.waktu_selesai : epoch(req.body.waktu_selesai);
      if (!(selesai > mulai)) throw permintaanSalah("waktu_selesai harus setelah waktu_mulai");
      if (req.body.ruang_uuid) {
        const ruang = await satu(`SELECT uuid FROM ok_ruang WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL AND aktif`, [ruangUuid, f], k);
        if (!ruang) throw tidakDitemukan("Ruang OK (atau sedang tidak aktif)");
      }
      const tim = req.body.tim === undefined ? await timJadwal(j.uuid, k) : siapkanTim(req.body.tim);
      await cekBentrok({ faskesUuid: f, ruangUuid, mulai, selesai, tim: tim.map((t) => ({ practitioner_uuid: t.practitioner_uuid })), kecuali: j.uuid }, k);
      await ubah("ok_jadwal", j.uuid, f, { ruang_uuid: ruangUuid, waktu_mulai: mulai, waktu_selesai: selesai, alasan_perubahan: req.body.alasan }, k);
      if (req.body.tim !== undefined) await tulisTim(j.uuid, f, tim, k);
      return detailJadwal(j.uuid, f, k);
    });
    kirim(res, hasil, "Jadwal operasi berhasil diubah");
  }),
);

// PATCH /jadwal/:uuid/batal { alasan } — slot dilepas, order kembali menunggu jadwal (KT-6).
rute.patch(
  "/jadwal/:uuid/batal",
  izinOk("Jadwal OK", "BATAL"),
  tangani(async (req, res) => {
    wajib(req.body, ["alasan"]);
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const j = await ambilJadwal(req.params.uuid, f, k);
      if (j.status !== "terjadwal") throw new Galat(409, `Jadwal berstatus ${j.status} tidak dapat dibatalkan`);
      await ubah("ok_jadwal", j.uuid, f, { status: "batal", alasan_perubahan: req.body.alasan }, k);
      await ubah("ok_order", j.order_uuid, f, { status: "menunggu_jadwal" }, k);
      return { jadwal: await detailJadwal(j.uuid, f, k), order: await detailOrder(j.order_uuid, f, k) };
    });
    kirim(res, hasil, "Jadwal operasi dibatalkan; order kembali ke daftar tunggu");
  }),
);

// PATCH /jadwal/:uuid/selesai — pasien kembali ke ruangan; wajib skor Aldrete keluar + serah terima (KF-14/KT-11/12).
rute.patch(
  "/jadwal/:uuid/selesai",
  izinOk("Jadwal OK", "VALIDASI"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const j = await ambilJadwal(req.params.uuid, f, k);
      if (j.status !== "terjadwal") throw new Galat(409, `Jadwal berstatus ${j.status} tidak dapat diselesaikan`);
      const anestesi = await satu(`SELECT uuid, aldrete_keluar, serah_terima FROM ok_laporan_anestesi WHERE jadwal_uuid = $1 AND deleted_at IS NULL`, [j.uuid], k);
      if (!anestesi || anestesi.aldrete_keluar === null || anestesi.aldrete_keluar === undefined) {
        throw new Galat(409, "Skor Aldrete keluar ruang pemulihan belum diisi pada laporan anestesi");
      }
      const serahTerima = req.body?.serah_terima ?? anestesi.serah_terima;
      if (!serahTerima) throw new Galat(409, "Catatan serah terima ke ruangan wajib diisi");
      if (req.body?.serah_terima && req.body.serah_terima !== anestesi.serah_terima) {
        await ubah("ok_laporan_anestesi", anestesi.uuid, f, { serah_terima: req.body.serah_terima }, k);
      }
      await ubah("ok_jadwal", j.uuid, f, { status: "selesai", waktu_selesai_aktual: sekarang(), serah_terima: serahTerima }, k);
      return detailJadwal(j.uuid, f, k);
    });
    kirim(res, hasil, "Operasi selesai; pasien dikembalikan ke ruangan");
  }),
);

export default rute;
