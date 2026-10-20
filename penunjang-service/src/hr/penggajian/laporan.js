import express from "express";
import { query, satu, sisipkan, transaksi } from "../../db.js";
import { kirim, tidakDitemukan, permintaanSalah } from "../../umum/respons.js";
import { SUB, konflik, cekVersi, hash } from "./bersama.js";
import { sen, uang } from "./perhitungan.js";
import { izin, tangani, baca, daftar, ambil, catat, pengguna } from "./dasar.js";
import { validasiFormat } from "./konfigurasi.js";
import { kunci } from "./komponen.js";

const rute = express.Router();
export const pemilikSlip = async (k, req) => {
  const r = await satu(`SELECT a.kepegawaian_uuid FROM hr_akun_pegawai a
    JOIN hr_kepegawaian h ON h.uuid = a.kepegawaian_uuid AND h.faskes_uuid = a.faskes_uuid AND h.deleted_at IS NULL
    JOIN pegawai p ON p.uuid = h.pegawai_uuid AND p.faskes_uuid = h.faskes_uuid AND p.deleted_at IS NULL
    WHERE a.faskes_uuid = $1 AND lower(a.username) = lower($2) AND a.deleted_at IS NULL`, [req.author.faskesUuid, req.author.username], k);
  if (!r) throw tidakDitemukan("Tautan akun pegawai");
  return r.kepegawaian_uuid;
};
const terbit = async (k, f, uuid) => {
  const p = await ambil(k, f, "hr_gaji_periode", uuid);
  const j = await satu(`SELECT jurnal_uuid FROM hr_gaji_jurnal WHERE faskes_uuid = $1 AND periode_uuid = $2 AND status = 'tercatat' AND deleted_at IS NULL`, [f, uuid], k);
  if (p.status !== "dibayar" || !j?.jurnal_uuid) throw tidakDitemukan("Slip terbit");
  return p;
};
const slip = async (k, f, p, pegawaiUuid) => {
  const h = await satu(`SELECT * FROM hr_gaji_hasil WHERE faskes_uuid = $1 AND penghitungan_uuid = $2 AND kepegawaian_uuid = $3 AND deleted_at IS NULL`, [f, p.penghitungan_uuid, pegawaiUuid], k);
  if (!h) throw tidakDitemukan("Slip pegawai");
  const rincian = await query(`SELECT kode, jenis, kategori, nilai FROM hr_gaji_rincian WHERE faskes_uuid = $1 AND hasil_uuid = $2 AND deleted_at IS NULL ORDER BY jenis, kode, uuid`, [f, h.uuid], k);
  const identitas = await satu(`SELECT peg.name AS nama, l.name AS unit FROM hr_kepegawaian s
    JOIN pegawai peg ON peg.uuid = s.pegawai_uuid AND peg.faskes_uuid = s.faskes_uuid AND peg.deleted_at IS NULL
    LEFT JOIN lokasi l ON l.uuid = $3 AND l.faskes_uuid = s.faskes_uuid AND l.deleted_at IS NULL
    WHERE s.faskes_uuid = $1 AND s.uuid = $2 AND s.deleted_at IS NULL`, [f, pegawaiUuid, h.unit_uuid], k);
  return { tahun: p.tahun, bulan: p.bulan, tanggal_bayar: p.tanggal_bayar, ...h, nama: identitas?.nama ?? null, unit: identitas?.unit ?? null, rincian };
};
rute.get("/slip/saya", izin([SUB.slip, "READ"]), baca(async (k, req) => {
  const f = req.author.faskesUuid, milik = await pemilikSlip(k, req);
  // Kolom periode saja; daftar tidak membawa penghasilan pegawai lain.
  return daftar(k, req, "hr_gaji_periode p", `AND status = 'dibayar'
    AND EXISTS (SELECT 1 FROM hr_gaji_jurnal j WHERE j.faskes_uuid = p.faskes_uuid AND j.periode_uuid = p.uuid AND j.status = 'tercatat' AND j.jurnal_uuid IS NOT NULL AND j.deleted_at IS NULL)
    AND EXISTS (SELECT 1 FROM hr_gaji_hasil h WHERE h.faskes_uuid = p.faskes_uuid AND h.penghitungan_uuid = p.penghitungan_uuid AND h.kepegawaian_uuid = $2 AND h.deleted_at IS NULL)`, [milik], "uuid, tahun, bulan, tanggal_bayar");
}));
rute.get("/slip/saya/:periode_uuid", izin([SUB.slip, "READ"]), baca(async (k, req) => {
  if (Object.keys(req.query).some((x) => !["page", "limit"].includes(x))) throw permintaanSalah("Slip pribadi tidak menerima parameter pemilik");
  const milik = await pemilikSlip(k, req);
  return slip(k, req.author.faskesUuid, await terbit(k, req.author.faskesUuid, req.params.periode_uuid), milik);
}));
rute.get("/periode/:uuid/slip/:kepegawaian_uuid", izin([SUB.administratif, "READ"]), baca(async (k, req) => slip(k, req.author.faskesUuid, await terbit(k, req.author.faskesUuid, req.params.uuid), req.params.kepegawaian_uuid)));
rute.get("/rekap", izin([SUB.rekap, "READ"]), baca(async (k, req) => {
  const f = req.author.faskesUuid, p = await ambil(k, f, "hr_gaji_periode", req.query.periode_uuid);
  if (!p.terkunci_pada) throw konflik("Rekap resmi hanya tersedia untuk periode terkunci");
  return query(`SELECT h.unit_uuid, l.name AS unit_nama, count(*) AS jumlah_pegawai, sum(h.bruto)::text AS bruto, sum(h.potongan)::text AS potongan, sum(h.iuran_pemberi_kerja)::text AS iuran_pemberi_kerja, sum(h.bersih)::text AS bersih
    FROM hr_gaji_hasil h LEFT JOIN lokasi l ON l.uuid = h.unit_uuid AND l.faskes_uuid = h.faskes_uuid
    WHERE h.faskes_uuid = $1 AND h.penghitungan_uuid = $2 AND h.deleted_at IS NULL AND ($3::varchar IS NULL OR h.unit_uuid = $3)
    GROUP BY h.unit_uuid, l.name ORDER BY l.name NULLS LAST, h.unit_uuid`, [f, p.penghitungan_uuid, req.query.unit_uuid ?? null], k);
}));
export const csvBank = (spesifikasi, rows) => {
  validasiFormat(spesifikasi);
  const kutip = (v) => {
    let s = String(v ?? "").replace(/[\r\n\t]/g, " ");
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return `"${s.replaceAll('"', '""')}"`;
  };
  const baris = rows.map((r) => spesifikasi.kolom.map((c) => kutip(c === "bersih" && spesifikasi.desimal === "koma" ? r[c].replace(".", ",") : r[c])).join(spesifikasi.pemisah));
  if (spesifikasi.header) baris.unshift(spesifikasi.kolom.map(kutip).join(spesifikasi.pemisah));
  return `${baris.join("\r\n")}\r\n`;
};
rute.post("/periode/:uuid/ekspor-bank", izin([SUB.ekspor, "EKSPOR"]), tangani(async (req, res) => {
  const f = req.author.faskesUuid;
  const hasil = await transaksi(async (k) => {
    await kunci(k, f, "sumber");
    const p = await ambil(k, f, "hr_gaji_periode", req.params.uuid, true); cekVersi(p, req.body ?? {});
    if (!["disetujui", "dibayar"].includes(p.status) || !p.terkunci_pada) throw konflik("Ekspor hanya untuk periode disetujui atau dibayar");
    const format = await ambil(k, f, "hr_gaji_format_bank", req.body?.format_uuid);
    if (format.status !== "disahkan") throw konflik("Format bank belum disahkan");
    const g = await ambil(k, f, "hr_gaji_penghitungan", p.penghitungan_uuid);
    const rows = await query(`SELECT h.kepegawaian_uuid, h.bersih, r.kode_bank, r.nomor_rekening, r.nama_pemilik FROM hr_gaji_hasil h
      JOIN hr_kepegawaian s ON s.uuid = h.kepegawaian_uuid AND s.faskes_uuid = h.faskes_uuid AND s.deleted_at IS NULL
      JOIN pegawai peg ON peg.uuid = s.pegawai_uuid AND peg.faskes_uuid = s.faskes_uuid AND peg.deleted_at IS NULL
      LEFT JOIN hr_gaji_rekening r ON r.kepegawaian_uuid = h.kepegawaian_uuid AND r.faskes_uuid = h.faskes_uuid AND r.status = 'terverifikasi' AND r.deleted_at IS NULL AND r.berlaku_mulai <= $3 AND (r.berlaku_sampai IS NULL OR r.berlaku_sampai > $3)
      WHERE h.faskes_uuid = $1 AND h.penghitungan_uuid = $2 AND h.deleted_at IS NULL ORDER BY h.kepegawaian_uuid`, [f, p.penghitungan_uuid, g.sumber.acuan], k);
    if (rows.length !== p.jumlah_pegawai || new Set(rows.map((r) => r.kepegawaian_uuid)).size !== rows.length || rows.some((r) => !r.nomor_rekening)) throw konflik("Rekening terverifikasi harus tersedia secara tunggal untuk seluruh pegawai");
    const total = uang(rows.reduce((n, r) => n + sen(r.bersih), 0n));
    if (total !== p.bersih) throw konflik("Total ekspor tidak sesuai hasil terkunci");
    const isi = csvBank(format.spesifikasi, rows.map((r) => ({ ...r, referensi: `Gaji ${p.tahun}-${p.bulan}` })));
    const sidik = hash(isi);
    await sisipkan("hr_gaji_ekspor", { faskes_uuid: f, periode_uuid: p.uuid, format_uuid: format.uuid, versi_hitung: p.penghitungan_uuid, hash_berkas: sidik, jumlah_pegawai: rows.length, total, dibuat_oleh: pengguna(req) }, k);
    await catat(k, req, "ekspor_bank", p.uuid, { periodeUuid: p.uuid, sesudah: sidik });
    return { nama: `penggajian-${p.tahun}-${p.bulan}.csv`, tipe: "text/csv;charset=utf-8", isi_base64: Buffer.from(isi, "utf8").toString("base64"), hash: sidik, jumlah_pegawai: rows.length, total };
  });
  kirim(res, hasil, "Ekspor bank dibuat");
}));
export default rute;
