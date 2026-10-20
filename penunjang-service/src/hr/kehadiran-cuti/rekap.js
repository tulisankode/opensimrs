import express from "express";
import { query, transaksi, sekarang } from "../../db.js";
import { kirim, tangani, permintaanSalah, tidakDitemukan } from "../../umum/respons.js";
import { wajibIzin } from "../../umum/izin.js";
import { daftarPegawai, buat, ambil, audit } from "./repository.js";
import { statusJadwal, selCsv, bulat } from "./aturan.js";

const rute = express.Router();
const izin = (aksi) => wajibIzin("HR / SDM", "Kehadiran, Cuti & Izin", aksi);
const parameter = (b) => {
  if (typeof b.bulan !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(b.bulan) || Number(b.bulan.slice(0, 4)) < 2000 || Number(b.bulan.slice(0, 4)) > 2100) throw permintaanSalah("Bulan harus berupa YYYY-MM antara tahun 2000 dan 2100");
  return { bulan: b.bulan, unit_uuid: b.unit_uuid ? String(b.unit_uuid) : null, pegawai_uuid: b.pegawai_uuid ? String(b.pegawai_uuid) : null };
};
export const susunRekap = async (req, p, aksi, k) => {
  const f = req.author.faskesUuid, awal = `${p.bulan}-01`;
  const akhir = new Date(Date.UTC(Number(p.bulan.slice(0, 4)), Number(p.bulan.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const pegawai = (await daftarPegawai(req, aksi, k)).filter((h) => (!p.unit_uuid || h.unit_uuid === p.unit_uuid) && (!p.pegawai_uuid || h.uuid === p.pegawai_uuid));
  const hasil = [];
  for (const h of pegawai) {
    const catatan = await query(`SELECT jenis, waktu, tanggal_operasional FROM hr_kehadiran WHERE faskes_uuid = $1 AND kepegawaian_uuid = $2 AND deleted_at IS NULL AND tanggal_operasional BETWEEN $3 AND $4 ORDER BY waktu, uuid`, [f, h.uuid, awal, akhir], k);
    let terbuka = false, tidakLengkap = 0;
    for (const c of catatan) {
      if (c.jenis === "masuk") { if (terbuka) tidakLengkap++; terbuka = true; }
      else { if (!terbuka) tidakLengkap++; terbuka = false; }
    }
    if (terbuka) tidakLengkap++;
    const cuti = await query(`SELECT c.hari, j.nama FROM hr_pengajuan_cuti c JOIN hr_jenis_cuti j ON j.uuid = c.jenis_uuid AND j.faskes_uuid = c.faskes_uuid
      WHERE c.faskes_uuid = $1 AND c.kepegawaian_uuid = $2 AND c.deleted_at IS NULL AND c.status = 'sah' AND c.tanggal_mulai <= $4 AND c.tanggal_selesai >= $3`, [f, h.uuid, awal, akhir], k);
    const jenisCuti = {};
    for (const c of cuti) jenisCuti[c.nama] = (jenisCuti[c.nama] ?? 0) + Object.values(c.hari).flat().filter((d) => d >= awal && d <= akhir).length;
    hasil.push({ pegawai_uuid: h.uuid, nama: h.nama, unit_uuid: h.unit_uuid, hari_kehadiran: new Set(catatan.map((r) => r.tanggal_operasional)).size,
      pasangan_tidak_lengkap: tidakLengkap, cuti_sah: jenisCuti, ...statusJadwal() });
  }
  return hasil;
};
rute.get("/rekap", izin("LIHAT REKAP"), tangani(async (req, res) => {
  const p = parameter(req.query), page = bulat(req.query.page ?? 1, "Halaman", 1), limit = 25;
  const rows = await susunRekap(req, p, "lihat_rekap");
  kirim(res, { items: rows.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: rows.length } });
}));
rute.post("/rekap/ekspor", izin("EKSPOR REKAP"), tangani(async (req, res) => {
  const p = parameter(req.body ?? {});
  if (req.body.format !== "csv") throw permintaanSalah("Format ekspor harus csv");
  kirim(res, await transaksi(async (k) => {
    const r = await buat("hr_kehadiran_ekspor", req, { pemilik: req.author.username, parameter: p, kedaluwarsa: sekarang() + 300 }, k);
    await audit(req, "hr_kehadiran_ekspor", r.uuid, p, k);
    return { uuid: r.uuid, kedaluwarsa: r.kedaluwarsa };
  }), "Ekspor siap diunduh selama lima menit");
}));
rute.get("/rekap/ekspor/:uuid", izin("EKSPOR REKAP"), tangani(async (req, res) => {
  const r = await ambil("hr_kehadiran_ekspor", req.params.uuid, req.author.faskesUuid);
  if (r.pemilik !== req.author.username || Number(r.kedaluwarsa) < sekarang()) throw tidakDitemukan();
  const rows = await susunRekap(req, parameter(r.parameter), "ekspor_rekap");
  const tabel = [["Pegawai", "Unit", "Hari kehadiran", "Pasangan tidak lengkap", "Cuti sah", "Status jadwal"],
    ...rows.map((h) => [h.nama, h.unit_uuid, h.hari_kehadiran, h.pasangan_tidak_lengkap, Object.entries(h.cuti_sah).map(([jenis, n]) => `${jenis}: ${n}`).join("; "), "Tidak tersedia"])];
  res.set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="rekap-kehadiran-${r.parameter.bulan}.csv"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.send("\uFEFF" + tabel.map((r) => r.map(selCsv).join(",")).join("\r\n"));
}));
export default rute;
