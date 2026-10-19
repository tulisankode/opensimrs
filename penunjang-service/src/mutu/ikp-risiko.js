import express from "express";
import { query, satu, ubah, sisipkan, sekarang, transaksi } from "../db.js";
import { kirim, halaman, denganHalaman, permintaanSalah, tidakDitemukan } from "../umum/respons.js";
import { izinMutu } from "../umum/izin.js";
import { cekPilihan, epochOpsional, konflik, teks, teksWajib } from "./bersama.js";
import { GRADE, STATUS_RISIKO, gradeDariMatriks } from "./ikp-bersama.js";
import { ambilMilik, tanganiMutu } from "./dasar.js";
import { SUB_RISIKO, auditIkp, cekPic, cekUnitIkp, pengaturanFaskes } from "./ikp-dasar.js";

// Register risiko unit (STD-0026, fitur mutu_ikp) — izin "Mutu & Akreditasi › Register Risiko":
//   GET    /ikp/risiko?unit_uuid=&status=&grade=&cari=   daftar risiko (urut skor tertinggi)        READ
//   POST   /ikp/risiko                                    catat risiko (skor & grade dari matriks)   CREATE
//   PUT    /ikp/risiko/:uuid                              ubah / perbarui mitigasi & status           UPDATE
//   DELETE /ikp/risiko/:uuid                              hapus lunak                                  DELETE
// Risiko dapat ditautkan ke laporan insiden (laporan_uuid) milik faskes yang sama; data laporan tidak ikut ditampilkan
// selain nomornya.
const rute = express.Router();
const KOLOM = `r.uuid, r.unit_uuid, un.name AS unit_nama, r.uraian, r.penyebab, r.pengendalian_ada, r.dampak, r.probabilitas, r.skor, r.grade,
  r.rencana_mitigasi, r.pic_pegawai_uuid, TRIM(CONCAT_WS(' ', pg.first_title, pg.name, NULLIF(pg.last_title, ''))) AS pic_nama, r.tenggat, r.status,
  r.laporan_uuid, l.nomor AS laporan_nomor, r.dibuat_oleh, r.created_at, r.updated_at`;
const DARI = `mutu_ikp_risiko r LEFT JOIN lokasi un ON un.uuid = r.unit_uuid LEFT JOIN pegawai pg ON pg.uuid = r.pic_pegawai_uuid
  LEFT JOIN mutu_ikp_laporan l ON l.uuid = r.laporan_uuid`;

const cekLaporan = async (uuid, f, k) => {
  if (uuid === undefined) return undefined;
  if (uuid === null || uuid === "") return null;
  const ada = await satu(`SELECT uuid FROM mutu_ikp_laporan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [String(uuid), f], k);
  if (!ada) throw permintaanSalah("Laporan insiden yang ditautkan tidak ditemukan di faskes ini");
  return ada.uuid;
};
const ambil = async (uuid, f) => {
  const row = await satu(`SELECT ${KOLOM} FROM ${DARI} WHERE r.uuid = $1 AND r.faskes_uuid = $2 AND r.deleted_at IS NULL`, [String(uuid ?? ""), f]);
  if (!row) throw tidakDitemukan("Risiko");
  return row;
};

rute.get(
  "/risiko",
  izinMutu(SUB_RISIKO, "READ"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const q = req.query;
    const hal = halaman(q);
    const params = [f];
    const syarat = ["r.faskes_uuid = $1", "r.deleted_at IS NULL"];
    const tambah = (sql, v) => {
      params.push(v);
      syarat.push(sql.replaceAll("?", `$${params.length}`));
    };
    if (q.unit_uuid) tambah("r.unit_uuid = ?", String(q.unit_uuid));
    const status = cekPilihan(q.status || undefined, STATUS_RISIKO, "status");
    if (status) tambah("r.status = ?", status);
    else if (q.aktif === "true") syarat.push("r.status <> 'ditutup'");
    const grade = cekPilihan(q.grade || undefined, GRADE, "grade");
    if (grade) tambah("r.grade = ?", grade);
    if (q.cari) tambah("(r.uraian ILIKE ? OR un.name ILIKE ?)", `%${String(q.cari).trim()}%`);
    const where = syarat.join(" AND ");
    const rows = await query(`SELECT ${KOLOM} FROM ${DARI} WHERE ${where} ORDER BY r.skor DESC, r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, hal.limit, hal.offset]);
    const total = await satu(`SELECT COUNT(*)::int AS n FROM ${DARI} WHERE ${where}`, params);
    kirim(res, denganHalaman(rows, total?.n, hal));
  }),
);

const bacaRisiko = async (b, f, k, baru) => {
  const isi = {
    uraian: baru || b.uraian !== undefined ? teksWajib(b.uraian, "uraian", 5000) : undefined,
    penyebab: teks(b.penyebab, "penyebab", 5000),
    pengendalian_ada: teks(b.pengendalian_ada, "pengendalian_ada", 5000),
    rencana_mitigasi: teks(b.rencana_mitigasi, "rencana_mitigasi", 5000),
    tenggat: epochOpsional(b.tenggat, "tenggat"),
    status: cekPilihan(b.status, STATUS_RISIKO, "status"),
    unit_uuid: baru || b.unit_uuid !== undefined ? await cekUnitIkp(b.unit_uuid, f, k) : undefined,
    pic_pegawai_uuid: await cekPic(b.pic_pegawai_uuid, f, k, false),
    laporan_uuid: await cekLaporan(b.laporan_uuid, f, k),
  };
  if (isi.status === null) isi.status = undefined;
  return isi;
};

rute.post(
  "/risiko",
  izinMutu(SUB_RISIKO, "CREATE"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = req.body ?? {};
    const uuid = await transaksi(async (k) => {
      const isi = await bacaRisiko(b, f, k, true);
      const { skor, grade } = gradeDariMatriks(b.dampak, b.probabilitas, (await pengaturanFaskes(f, k)).matriks);
      const baru = await sisipkan(
        "mutu_ikp_risiko",
        {
          faskes_uuid: f,
          ...Object.fromEntries(Object.entries(isi).map(([c, v]) => [c, v ?? null])),
          status: isi.status ?? "terbuka",
          dampak: Number(b.dampak),
          probabilitas: Number(b.probabilitas),
          skor,
          grade,
          dibuat_oleh: req.author.username ?? null,
        },
        k,
      );
      await auditIkp(k, req, "ikp_risiko", baru.uuid, "buat", null, { unit_uuid: baru.unit_uuid, skor, grade, status: baru.status });
      return baru.uuid;
    });
    kirim(res, await ambil(uuid, f), "Risiko berhasil dicatat");
  }),
);

rute.put(
  "/risiko/:uuid",
  izinMutu(SUB_RISIKO, "UPDATE"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = req.body ?? {};
    await transaksi(async (k) => {
      const lama = await ambilMilik("mutu_ikp_risiko", req.params.uuid, f, k, { nama: "Risiko", kunci: true });
      const isi = await bacaRisiko(b, f, k, false);
      if (b.dampak !== undefined || b.probabilitas !== undefined) {
        const d = b.dampak ?? lama.dampak;
        const p = b.probabilitas ?? lama.probabilitas;
        Object.assign(isi, { dampak: Number(d), probabilitas: Number(p), ...gradeDariMatriks(d, p, (await pengaturanFaskes(f, k)).matriks) });
      }
      const baru = await ubah("mutu_ikp_risiko", lama.uuid, f, isi, k);
      await auditIkp(k, req, "ikp_risiko", lama.uuid, "ubah", { skor: lama.skor, grade: lama.grade, status: lama.status }, { skor: baru.skor, grade: baru.grade, status: baru.status });
    });
    kirim(res, await ambil(req.params.uuid, f), "Risiko berhasil diperbarui");
  }),
);

rute.delete(
  "/risiko/:uuid",
  izinMutu(SUB_RISIKO, "DELETE"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    await transaksi(async (k) => {
      const lama = await ambilMilik("mutu_ikp_risiko", req.params.uuid, f, k, { nama: "Risiko", kunci: true });
      if (lama.status !== "ditutup" && lama.status !== "terbuka") throw konflik("Risiko yang sedang dimitigasi tidak dapat dihapus; tutup risiko terlebih dahulu");
      await query(`UPDATE mutu_ikp_risiko SET deleted_at = $1, updated_at = $1 WHERE uuid = $2`, [sekarang(), lama.uuid], k);
      await auditIkp(k, req, "ikp_risiko", lama.uuid, "hapus", { skor: lama.skor, grade: lama.grade, status: lama.status }, null);
    });
    kirim(res, null, "Risiko dihapus");
  }),
);

export default rute;
