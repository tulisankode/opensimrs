import express from "express";
import { query, satu, ubah, sisipkan, sekarang, transaksi } from "../db.js";
import { kirim, halaman, denganHalaman, permintaanSalah } from "../umum/respons.js";
import { izinMutu } from "../umum/izin.js";
import { cekPilihan, epochOpsional, teks, teksWajib } from "./bersama.js";
import {
  JENIS_INDIKATOR,
  STATUS_CAPAIAN,
  STATUS_TINDAK_LANJUT,
  bulanDariEpoch,
  rekapPeriode,
  rentangBulan,
  triwulanDariBulan,
  uraiPeriode,
} from "./indikator-bersama.js";
import { ambilMilik, catatAudit, tanganiMutu } from "./dasar.js";
import { ambilIndikator, cekUnit } from "./indikator.js";

// Capaian, tren, laporan, dan tindak lanjut Indikator Mutu (STD-0025) — izin "Mutu & Akreditasi › Indikator Mutu":
//   GET    /indikator/dasbor?periode=YYYY-MM|YYYY-Qn&jenis=&unit_uuid=    capaian semua indikator aktif   READ
//   GET    /indikator/:uuid/tren?dari=YYYY-MM&sampai=YYYY-MM&per=bulan|triwulan&unit_uuid=               READ
//   GET    /indikator/laporan?dari=&sampai=&jenis=&unit_uuid=             baris ekspor (Excel di klien)  EKSPOR
//   GET    /indikator/tindak-lanjut?indikator_uuid=&periode=&status=                                      READ
//   POST   /indikator/tindak-lanjut          analisis & rencana tindak lanjut (capaian periode disalin)  TINDAK LANJUT
//   PUT    /indikator/tindak-lanjut/:uuid    ubah / perbarui status (selesai → hasil evaluasi wajib)     TINDAK LANJUT
//   DELETE /indikator/tindak-lanjut/:uuid    hapus lunak                                                 TINDAK LANJUT
// Capaian resmi hanya dari data TERVALIDASI; data draf/diajukan/dikembalikan hanya dihitung sebagai "menunggu".
const rute = express.Router();
const SUB = "Indikator Mutu";
const KOLOM_REKAP = "uuid, kode, judul, jenis, satuan, target_nilai, arah, target_sumber, frekuensi, sumber_data, aktif";

const dataTervalidasi = (f, awal, akhir, { indikatorUuid = null, unitUuid = null } = {}) =>
  query(
    `SELECT indikator_uuid, unit_uuid, tanggal, periode_bulan, numerator, denominator FROM mutu_indikator_data
      WHERE faskes_uuid = $1 AND deleted_at IS NULL AND status = 'tervalidasi' AND tanggal >= $2 AND tanggal < $3
        AND ($4::varchar IS NULL OR indikator_uuid = $4) AND ($5::varchar IS NULL OR unit_uuid = $5)`,
    [f, awal, akhir, indikatorUuid, unitUuid],
  );
const kelompok = (baris, kunci) => {
  const peta = new Map();
  for (const r of baris) {
    const k = kunci(r);
    if (!peta.has(k)) peta.set(k, []);
    peta.get(k).push(r);
  }
  return peta;
};
const namaUnit = async (f, uuids) => {
  const daftar = [...new Set(uuids.filter(Boolean))];
  if (!daftar.length) return new Map();
  const rows = await query(`SELECT uuid, name FROM lokasi WHERE faskes_uuid = $1 AND uuid = ANY($2::varchar[])`, [f, daftar]);
  return new Map(rows.map((r) => [r.uuid, r.name]));
};
const unitQuery = (v) => (v ? String(v) : null);

rute.get(
  "/dasbor",
  izinMutu(SUB, "READ"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const periode = uraiPeriode(req.query.periode || bulanDariEpoch(sekarang()));
    const jenis = cekPilihan(req.query.jenis || undefined, JENIS_INDIKATOR, "jenis");
    const unitUuid = unitQuery(req.query.unit_uuid);
    const indikator = await query(
      `SELECT ${KOLOM_REKAP} FROM mutu_indikator WHERE faskes_uuid = $1 AND deleted_at IS NULL AND aktif = true AND ($2::varchar IS NULL OR jenis = $2) ORDER BY jenis, kode`,
      [f, jenis ?? null],
    );
    const baris = await dataTervalidasi(f, periode.awal, periode.akhir, { unitUuid });
    const perIndikator = kelompok(baris, (r) => r.indikator_uuid);
    const menunggu = new Map(
      (
        await query(
          `SELECT indikator_uuid, COUNT(*) FILTER (WHERE status = 'diajukan')::int AS diajukan,
                  COUNT(*) FILTER (WHERE status IN ('draf', 'dikembalikan'))::int AS draf
             FROM mutu_indikator_data WHERE faskes_uuid = $1 AND deleted_at IS NULL AND status <> 'tervalidasi'
              AND tanggal >= $2 AND tanggal < $3 AND ($4::varchar IS NULL OR unit_uuid = $4) GROUP BY indikator_uuid`,
          [f, periode.awal, periode.akhir, unitUuid],
        )
      ).map((r) => [r.indikator_uuid, r]),
    );
    const tl = new Map(
      (
        await query(
          `SELECT indikator_uuid, COUNT(*)::int AS n FROM mutu_indikator_tindak_lanjut
            WHERE faskes_uuid = $1 AND deleted_at IS NULL AND periode = $2 GROUP BY indikator_uuid`,
          [f, periode.kode],
        )
      ).map((r) => [r.indikator_uuid, r.n]),
    );
    const unitNama = await namaUnit(f, baris.map((r) => r.unit_uuid));
    const hasil = indikator.map((ind) => {
      const rows = perIndikator.get(ind.uuid) ?? [];
      const rekap = rekapPeriode(rows, ind, periode);
      const unit = [...kelompok(rows, (r) => r.unit_uuid ?? "").entries()].map(([u, rr]) => ({
        unit_uuid: u || null,
        unit_nama: u ? unitNama.get(u) ?? "-" : "Tingkat faskes",
        ...rekapPeriode(rr, ind, periode),
      }));
      const jumlahTl = tl.get(ind.uuid) ?? 0;
      return {
        ...ind,
        ...rekap,
        menunggu_validasi: menunggu.get(ind.uuid)?.diajukan ?? 0,
        draf: menunggu.get(ind.uuid)?.draf ?? 0,
        jumlah_tindak_lanjut: jumlahTl,
        perlu_tindak_lanjut: rekap.status === "tidak_tercapai" && jumlahTl === 0,
        unit,
      };
    });
    const hitung = (s) => hasil.filter((h) => h.status === s).length;
    kirim(res, {
      periode,
      ringkasan: {
        total_indikator: hasil.length,
        ...Object.fromEntries(Object.keys(STATUS_CAPAIAN).map((s) => [s, hitung(s)])),
        menunggu_validasi: hasil.reduce((a, h) => a + h.menunggu_validasi, 0),
        perlu_tindak_lanjut: hasil.filter((h) => h.perlu_tindak_lanjut).length,
      },
      indikator: hasil,
    });
  }),
);

// Deret capaian per bulan/triwulan untuk satu indikator (+ per unit).
const susunDeret = (rows, ind, kodePeriode) => {
  const per = kelompok(rows, (r) => r.kunci);
  return kodePeriode.map((kode) => ({ periode: kode, ...rekapPeriode(per.get(kode) ?? [], ind, uraiPeriode(kode)) }));
};

rute.get(
  "/laporan",
  izinMutu(SUB, "EKSPOR"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const bulan = rentangBulan(req.query.dari, req.query.sampai);
    const awal = uraiPeriode(bulan[0]).awal;
    const akhir = uraiPeriode(bulan[bulan.length - 1]).akhir;
    const jenis = cekPilihan(req.query.jenis || undefined, JENIS_INDIKATOR, "jenis");
    const unitUuid = unitQuery(req.query.unit_uuid);
    const indikator = await query(
      `SELECT ${KOLOM_REKAP}, definisi_numerator, definisi_denominator, regulasi_acuan FROM mutu_indikator
        WHERE faskes_uuid = $1 AND deleted_at IS NULL AND ($2::varchar IS NULL OR jenis = $2) ORDER BY jenis, kode`,
      [f, jenis ?? null],
    );
    const baris = (await dataTervalidasi(f, awal, akhir, { unitUuid })).map((r) => ({ ...r, kunci: r.periode_bulan }));
    const perIndikator = kelompok(baris, (r) => r.indikator_uuid);
    const unitNama = await namaUnit(f, baris.map((r) => r.unit_uuid));
    const capaian = [];
    const capaianUnit = [];
    for (const ind of indikator) {
      const rows = perIndikator.get(ind.uuid) ?? [];
      if (!ind.aktif && !rows.length) continue;
      for (const d of susunDeret(rows, ind, bulan)) capaian.push({ indikator_uuid: ind.uuid, kode: ind.kode, judul: ind.judul, jenis: ind.jenis, satuan: ind.satuan, target_nilai: ind.target_nilai, arah: ind.arah, ...d });
      for (const [u, rr] of kelompok(rows, (r) => r.unit_uuid ?? "").entries()) {
        for (const d of susunDeret(rr, ind, bulan)) {
          if (!d.denominator && !d.terisi) continue;
          capaianUnit.push({ kode: ind.kode, judul: ind.judul, unit_nama: u ? unitNama.get(u) ?? "-" : "Tingkat faskes", satuan: ind.satuan, target_nilai: ind.target_nilai, arah: ind.arah, ...d });
        }
      }
    }
    const periodeTl = [...new Set([...bulan, ...bulan.map(triwulanDariBulan)])];
    const tindakLanjut = await query(
      `SELECT t.periode, i.kode, i.judul, l.name AS unit_nama, t.capaian, t.target_nilai, t.analisis, t.rencana, t.penanggung_jawab, t.tenggat, t.status, t.hasil_evaluasi
         FROM mutu_indikator_tindak_lanjut t JOIN mutu_indikator i ON i.uuid = t.indikator_uuid AND i.faskes_uuid = t.faskes_uuid
         LEFT JOIN lokasi l ON l.uuid = t.unit_uuid AND l.faskes_uuid = t.faskes_uuid
        WHERE t.faskes_uuid = $1 AND t.deleted_at IS NULL AND t.periode = ANY($2::varchar[]) AND ($3::varchar IS NULL OR i.jenis = $3)
        ORDER BY t.periode, i.kode`,
      [f, periodeTl, jenis ?? null],
    );
    kirim(res, { dari: bulan[0], sampai: bulan[bulan.length - 1], capaian, capaian_unit: capaianUnit, tindak_lanjut: tindakLanjut });
  }),
);

// ── Tindak lanjut (analisis & rencana perbaikan, mis. PDSA)
const KOLOM_TL = `t.uuid, t.faskes_uuid, t.indikator_uuid, t.unit_uuid, t.periode, t.capaian, t.target_nilai, t.analisis, t.rencana,
  t.penanggung_jawab, t.tenggat, t.status, t.hasil_evaluasi, t.dibuat_oleh, t.created_at, t.updated_at`;
const ambilTl = (uuid, f, k, kunci = false) =>
  ambilMilik("mutu_indikator_tindak_lanjut", uuid, f, k, { nama: "Tindak lanjut", kunci, kolom: KOLOM_TL.replace(/\bt\./g, "") });

rute.get(
  "/tindak-lanjut",
  izinMutu(SUB, "READ"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const q = req.query;
    const pg = halaman(q);
    const syarat = ["t.faskes_uuid = $1", "t.deleted_at IS NULL", "i.deleted_at IS NULL"];
    const p = [f];
    if (q.indikator_uuid) syarat.push(`t.indikator_uuid = $${p.push(String(q.indikator_uuid))}`);
    if (q.periode) syarat.push(`t.periode = $${p.push(uraiPeriode(q.periode).kode)}`);
    const status = cekPilihan(q.status || undefined, STATUS_TINDAK_LANJUT, "status");
    if (status) syarat.push(`t.status = $${p.push(status)}`);
    const where = syarat.join(" AND ");
    const dari = `FROM mutu_indikator_tindak_lanjut t JOIN mutu_indikator i ON i.uuid = t.indikator_uuid AND i.faskes_uuid = t.faskes_uuid
      LEFT JOIN lokasi l ON l.uuid = t.unit_uuid AND l.faskes_uuid = t.faskes_uuid`;
    const total = (await satu(`SELECT COUNT(*) n ${dari} WHERE ${where}`, p)).n;
    const rows = await query(
      `SELECT ${KOLOM_TL}, i.kode AS indikator_kode, i.judul AS indikator_judul, i.satuan, i.arah, l.name AS unit_nama
         ${dari} WHERE ${where} ORDER BY t.periode DESC, t.created_at DESC LIMIT $${p.length + 1} OFFSET $${p.length + 2}`,
      [...p, pg.limit, pg.offset],
    );
    kirim(res, denganHalaman(rows, total, pg));
  }),
);

rute.post(
  "/tindak-lanjut",
  izinMutu(SUB, "TINDAK LANJUT"),
  tanganiMutu(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    const periode = uraiPeriode(b.periode);
    const isi = {
      analisis: teksWajib(b.analisis, "analisis", 5000),
      rencana: teksWajib(b.rencana, "rencana", 5000),
      penanggung_jawab: teksWajib(b.penanggung_jawab, "penanggung_jawab", 255),
      tenggat: epochOpsional(b.tenggat, "tenggat") ?? null,
      status: cekPilihan(b.status, STATUS_TINDAK_LANJUT, "status") ?? "rencana",
      hasil_evaluasi: teks(b.hasil_evaluasi, "hasil_evaluasi", 5000) ?? null,
    };
    if (isi.status === "selesai" && !isi.hasil_evaluasi) throw permintaanSalah("hasil_evaluasi wajib diisi bila tindak lanjut selesai");
    const hasil = await transaksi(async (k) => {
      const ind = await ambilIndikator(b.indikator_uuid, f, k);
      const unit = (await cekUnit(b.unit_uuid, f, k)) ?? null;
      // Capaian periode (data tervalidasi saat ini) disalin agar konteks analisis tetap terbaca walau data berubah.
      const rows = await dataTervalidasi(f, periode.awal, periode.akhir, { indikatorUuid: ind.uuid, unitUuid: unit });
      const rekap = rekapPeriode(rows, ind, periode);
      const row = await sisipkan(
        "mutu_indikator_tindak_lanjut",
        { faskes_uuid: f, indikator_uuid: ind.uuid, unit_uuid: unit, periode: periode.kode, capaian: rekap.capaian, target_nilai: ind.target_nilai, ...isi, dibuat_oleh: req.author.username ?? null },
        k,
      );
      await catatAudit(k, req, "indikator_tindak_lanjut", row.uuid, "buat", null, row);
      return row;
    });
    kirim(res, hasil, "Tindak lanjut berhasil disimpan");
  }),
);

rute.put(
  "/tindak-lanjut/:uuid",
  izinMutu(SUB, "TINDAK LANJUT"),
  tanganiMutu(async (req, res) => {
    const b = req.body ?? {};
    const f = req.author.faskesUuid;
    const wajibBila = (k, maks) => (b[k] === undefined ? undefined : teksWajib(b[k], k, maks));
    const perubahan = {
      analisis: wajibBila("analisis", 5000),
      rencana: wajibBila("rencana", 5000),
      penanggung_jawab: wajibBila("penanggung_jawab", 255),
      tenggat: epochOpsional(b.tenggat, "tenggat"),
      status: cekPilihan(b.status, STATUS_TINDAK_LANJUT, "status") ?? undefined,
      hasil_evaluasi: teks(b.hasil_evaluasi, "hasil_evaluasi", 5000),
    };
    const hasil = await transaksi(async (k) => {
      const lama = await ambilTl(req.params.uuid, f, k, true);
      const status = perubahan.status ?? lama.status;
      const evaluasi = perubahan.hasil_evaluasi === undefined ? lama.hasil_evaluasi : perubahan.hasil_evaluasi;
      if (status === "selesai" && !evaluasi) throw permintaanSalah("hasil_evaluasi wajib diisi bila tindak lanjut selesai");
      const row = await ubah("mutu_indikator_tindak_lanjut", lama.uuid, f, perubahan, k);
      await catatAudit(k, req, "indikator_tindak_lanjut", row.uuid, "ubah", lama, row);
      return row;
    });
    kirim(res, hasil, "Tindak lanjut berhasil diubah");
  }),
);

rute.delete(
  "/tindak-lanjut/:uuid",
  izinMutu(SUB, "TINDAK LANJUT"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    await transaksi(async (k) => {
      const lama = await ambilTl(req.params.uuid, f, k, true);
      const n = sekarang();
      await k.query(`UPDATE mutu_indikator_tindak_lanjut SET deleted_at = $1, updated_at = $1 WHERE uuid = $2 AND faskes_uuid = $3`, [n, lama.uuid, f]);
      await catatAudit(k, req, "indikator_tindak_lanjut", lama.uuid, "hapus", lama, null);
    });
    kirim(res, { uuid: req.params.uuid }, "Tindak lanjut berhasil dihapus");
  }),
);

rute.get(
  "/:uuid/tren",
  izinMutu(SUB, "READ"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const ind = await ambilIndikator(req.params.uuid, f);
    const kini = bulanDariEpoch(sekarang());
    const sampai = req.query.sampai || kini;
    const dari = req.query.dari || rentangMundur(sampai, 12);
    const bulan = rentangBulan(dari, sampai);
    const perTriwulan = req.query.per === "triwulan";
    const kodePeriode = perTriwulan ? [...new Set(bulan.map(triwulanDariBulan))] : bulan;
    const awal = uraiPeriode(kodePeriode[0]).awal;
    const akhir = uraiPeriode(kodePeriode[kodePeriode.length - 1]).akhir;
    const unitUuid = unitQuery(req.query.unit_uuid);
    const baris = (await dataTervalidasi(f, awal, akhir, { indikatorUuid: ind.uuid, unitUuid })).map((r) => ({
      ...r,
      kunci: perTriwulan ? triwulanDariBulan(r.periode_bulan) : r.periode_bulan,
    }));
    const unitNama = await namaUnit(f, baris.map((r) => r.unit_uuid));
    const perUnit = [...kelompok(baris, (r) => r.unit_uuid ?? "").entries()].map(([u, rr]) => ({
      unit_uuid: u || null,
      unit_nama: u ? unitNama.get(u) ?? "-" : "Tingkat faskes",
      deret: susunDeret(rr, ind, kodePeriode).map((d) => ({ periode: d.periode, capaian: d.capaian, numerator: d.numerator, denominator: d.denominator })),
    }));
    kirim(res, { indikator: ind, per: perTriwulan ? "triwulan" : "bulan", deret: susunDeret(baris, ind, kodePeriode), per_unit: perUnit });
  }),
);

// "YYYY-MM" mundur n-1 bulan (rentang n bulan berakhir di `sampai`).
const rentangMundur = (sampai, n) => {
  const [t, b] = String(sampai).split("-").map(Number);
  if (!t || !b) throw permintaanSalah("sampai harus berformat YYYY-MM");
  const total = t * 12 + (b - 1) - (n - 1);
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
};

export default rute;
