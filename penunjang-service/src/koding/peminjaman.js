import express from "express";
import { query, satu, sisipkan, ubah, sekarang } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, permintaanSalah, wajib } from "../umum/respons.js";
import { izinKoding } from "../umum/izin.js";
import { ramah, teks, epoch } from "./bersama.js";

// Peminjaman & pengembalian berkas rekam medis fisik — /api/v3/penunjang/koding/peminjaman/...
// Satu no_rm hanya boleh punya satu peminjaman aktif (indeks unik parsial rm_peminjaman_aktif_uq).
const rute = express.Router();

rute.get(
  "/peminjaman",
  izinKoding("Peminjaman", "READ"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const pg = halaman(req.query);
    const p = [faskes];
    let w = "faskes_uuid = $1 AND deleted_at IS NULL";
    if (req.query.no_rm) {
      p.push(`%${req.query.no_rm}%`);
      w += ` AND no_rm ILIKE $${p.length}`;
    }
    if (req.query.status === "aktif") w += " AND waktu_kembali IS NULL";
    else if (req.query.status === "selesai") w += " AND waktu_kembali IS NOT NULL";
    if (req.query.jatuh_tempo === "terlambat") {
      p.push(sekarang());
      w += ` AND waktu_kembali IS NULL AND rencana_kembali < $${p.length}`;
    } else if (req.query.jatuh_tempo === "h1") {
      p.push(sekarang(), sekarang() + 86400);
      w += ` AND waktu_kembali IS NULL AND rencana_kembali BETWEEN $${p.length - 1} AND $${p.length}`;
    }
    const [rows, total] = await Promise.all([
      query(`SELECT * FROM rm_peminjaman WHERE ${w} ORDER BY waktu_kembali IS NULL DESC, rencana_kembali LIMIT ${pg.limit} OFFSET ${pg.offset}`, p),
      satu(`SELECT COUNT(*)::int n FROM rm_peminjaman WHERE ${w}`, p),
    ]);
    kirim(res, denganHalaman(rows, total.n, pg));
  }),
);

rute.post(
  "/peminjaman",
  izinKoding("Peminjaman", "CREATE"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    wajib(b, ["no_rm", "peminjam", "rencana_kembali"]);
    const rencana = epoch(b.rencana_kembali);
    if (!rencana) throw permintaanSalah("rencana_kembali tidak valid");
    const r = await sisipkan("rm_peminjaman", {
      faskes_uuid: faskes, no_rm: teks(b.no_rm, 50), patient_uuid: teks(b.patient_uuid) ?? null,
      peminjam: teks(b.peminjam, 200), unit: teks(b.unit, 200) ?? null, keperluan: teks(b.keperluan, 200) ?? null,
      catatan: teks(b.catatan) ?? null, waktu_pinjam: sekarang(), rencana_kembali: rencana, petugas_pinjam: req.author.username,
    }).catch((e) => ramah(e, "Berkas rekam medis ini masih dipinjam, kembalikan dahulu sebelum meminjam ulang"));
    kirim(res, r, "Peminjaman berkas tersimpan");
  }),
);

rute.post(
  "/peminjaman/:uuid/pengembalian",
  izinKoding("Peminjaman", "UPDATE"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const p = await satu(`SELECT * FROM rm_peminjaman WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [req.params.uuid, faskes]);
    if (!p) throw permintaanSalah("Peminjaman tidak ditemukan");
    if (p.waktu_kembali) throw permintaanSalah("Peminjaman ini sudah dikembalikan");
    const r = await ubah("rm_peminjaman", p.uuid, faskes, {
      waktu_kembali: sekarang(), petugas_kembali: req.author.username, kondisi_kembali: teks(req.body?.kondisi_kembali) ?? null,
    });
    kirim(res, r, "Pengembalian berkas tercatat");
  }),
);

rute.delete(
  "/peminjaman/:uuid",
  izinKoding("Peminjaman", "HAPUS"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const alasan = teks(req.body?.alasan);
    if (!alasan) throw permintaanSalah("Alasan pembatalan wajib diisi");
    const r = await ubah("rm_peminjaman", req.params.uuid, faskes, { deleted_at: sekarang(), catatan: alasan });
    if (!r) throw permintaanSalah("Peminjaman tidak ditemukan");
    kirim(res, r, "Peminjaman dibatalkan");
  }),
);

export default rute;
