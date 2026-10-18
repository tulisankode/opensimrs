import express from "express";
import { query, satu, sisipkan, ubah, transaksi, sekarang } from "../db.js";
import { tangani, kirim, wajib, tidakDitemukan, Galat } from "../umum/respons.js";
import { izinHd } from "../umum/izin.js";
import { angka, teks } from "./bersama.js";

// Resep HD (KF-4/KT-4): durasi, QB, QD, sasaran UF, antikoagulan, dialisat, akses vaskular — seluruhnya wajib, dengan
// pembuat & pengesah tercatat. Draft dapat diubah; resep sah tidak diubah (buat resep baru lalu sahkan — resep sah
// sebelumnya otomatis nonaktif agar sesi baru selalu memakai resep sah terbaru). Batas angka hanya kewajaran input.
const rute = express.Router();
const izin = (aksi) => izinHd("Resep HD", aksi);

const KOLOM = ["durasi_menit", "qb_ml_menit", "qd_ml_menit", "uf_goal_ml", "antikoagulan", "dialisat", "akses_vaskular"];

const dataResep = (b, semua) => {
  if (semua) wajib(b, KOLOM);
  const ada = (k) => b[k] !== undefined;
  return {
    durasi_menit: ada("durasi_menit") ? angka(b.durasi_menit, "durasi_menit", { min: 1, maks: 720, bulat: true }) : undefined,
    qb_ml_menit: ada("qb_ml_menit") ? angka(b.qb_ml_menit, "qb_ml_menit", { min: 1, maks: 1000 }) : undefined,
    qd_ml_menit: ada("qd_ml_menit") ? angka(b.qd_ml_menit, "qd_ml_menit", { min: 1, maks: 1500 }) : undefined,
    uf_goal_ml: ada("uf_goal_ml") ? angka(b.uf_goal_ml, "uf_goal_ml", { min: 0, maks: 10000 }) : undefined,
    antikoagulan: ada("antikoagulan") ? teks(b.antikoagulan, 500) : undefined,
    dialisat: ada("dialisat") ? teks(b.dialisat, 500) : undefined,
    akses_vaskular: ada("akses_vaskular") ? teks(b.akses_vaskular, 500) : undefined,
    catatan: ada("catatan") ? teks(b.catatan) : undefined,
  };
};

const ambilResep = async (uuid, faskes, k, kunci = false) => {
  const r = await satu(`SELECT * FROM hd_resep WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL ${kunci ? "FOR UPDATE" : ""}`, [uuid, faskes], k);
  if (!r) throw tidakDitemukan("Resep HD");
  return r;
};

rute.get(
  "/resep",
  izin("READ"),
  tangani(async (req, res) => {
    const p = [req.author.faskesUuid];
    let w = "faskes_uuid = $1 AND deleted_at IS NULL";
    if (req.query.registrasi_uuid) {
      p.push(String(req.query.registrasi_uuid));
      w += ` AND registrasi_uuid = $${p.length}`;
    }
    if (req.query.status) {
      p.push(String(req.query.status));
      w += ` AND status = $${p.length}`;
    }
    kirim(res, await query(`SELECT * FROM hd_resep WHERE ${w} ORDER BY created_at DESC LIMIT 200`, p));
  }),
);

rute.get("/resep/:uuid", izin("READ"), tangani(async (req, res) => kirim(res, await ambilResep(req.params.uuid, req.author.faskesUuid))));

rute.post(
  "/resep",
  izin("CREATE"),
  tangani(async (req, res) => {
    const b = req.body ?? {};
    wajib(b, ["registrasi_uuid"]);
    const f = req.author.faskesUuid;
    const data = dataResep(b, true);
    for (const k of ["antikoagulan", "dialisat", "akses_vaskular"]) if (!data[k]) throw new Galat(400, `${k} wajib diisi`);
    const reg = await satu(`SELECT uuid, status FROM hd_registrasi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [b.registrasi_uuid, f]);
    if (!reg) throw tidakDitemukan("Registrasi HD");
    if (reg.status !== "aktif") throw new Galat(409, "Registrasi HD nonaktif");
    const baris = await sisipkan("hd_resep", { faskes_uuid: f, registrasi_uuid: reg.uuid, ...data, catatan: data.catatan ?? null, status: "draft", dibuat_oleh: req.author.username ?? null });
    kirim(res, baris, "Resep HD disimpan sebagai draf");
  }),
);

rute.put(
  "/resep/:uuid",
  izin("UPDATE"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const data = dataResep(req.body ?? {}, false);
    for (const k of ["antikoagulan", "dialisat", "akses_vaskular"]) if (data[k] === null) throw new Galat(400, `${k} tidak boleh kosong`);
    const hasil = await transaksi(async (k) => {
      const r = await ambilResep(req.params.uuid, f, k, true);
      if (r.status !== "draft") throw new Galat(409, "Hanya resep draf yang dapat diubah; buat resep baru untuk perubahan resep sah");
      return ubah("hd_resep", r.uuid, f, data, k);
    });
    kirim(res, hasil, "Resep HD diperbarui");
  }),
);

rute.post(
  "/resep/:uuid/sahkan",
  izin("SAHKAN"),
  tangani(async (req, res) => {
    const f = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const r = await ambilResep(req.params.uuid, f, k, true);
      if (r.status !== "draft") throw new Galat(409, `Resep berstatus ${r.status}, tidak dapat disahkan`);
      await satu(`SELECT uuid FROM hd_registrasi WHERE uuid = $1 FOR UPDATE`, [r.registrasi_uuid], k);
      const t = sekarang();
      await query(`UPDATE hd_resep SET status = 'nonaktif', updated_at = $3 WHERE registrasi_uuid = $1 AND faskes_uuid = $2 AND status = 'sah' AND deleted_at IS NULL`, [r.registrasi_uuid, f, t], k);
      return ubah("hd_resep", r.uuid, f, { status: "sah", disahkan_oleh: req.author.username ?? null, disahkan_pada: t }, k);
    });
    kirim(res, hasil, "Resep HD disahkan");
  }),
);

export default rute;
