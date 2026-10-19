import express from "express";
import { query, satu, transaksi } from "../../db.js";
import { kirim, permintaanSalah, tidakDitemukan } from "../../umum/respons.js";
import { galatIzin, punyaIzin, wajibIzin } from "../../umum/izin.js";
import { dariSen, keSen, konflik } from "../bersama.js";
import { namaPeriode, tanganiAkuntansi } from "../dasar.js";
import { MODUL_IZIN, PROFESI, SUB, refPasien } from "./bersama.js";
import { ambilPeriode, audit } from "./dasar.js";

// Slip & rekap remunerasi (KF-11/KF-12) — hanya dari periode DISETUJUI/DIBAYAR.
//   GET /slip/saya                          periode yang memuat slip pengguna login (akun → users.practitioner_uuid)
//   GET /slip/saya/:periode                 slip milik sendiri (izin Slip › READ); penerima ditentukan dari token,
//                                           bukan parameter — tidak dapat melihat slip orang lain lewat rute ini
//   GET /slip/:periode/:practitioner        slip penerima lain untuk tim remunerasi (izin Rekap › READ)
//   GET /rekap?periode_uuid=&ekspor=xlsx|csv   rekap per unit & profesi + rincian penerima; ekspor butuh Rekap ›
//                                           EKSPOR dan tercatat di Audit Trail (berkas dibuat frontend)
// Rincian slip tidak memuat identitas pasien: hanya penanda anonim per periode (PSN-XXXXXX), jenis layanan, nama
// tindakan, tanggal, dan nilai — tanpa nama, No. RM, No. Registrasi, maupun nomor invoice.
const rute = express.Router();
const SELESAI = ["disetujui", "dibayar"];

const periodeSelesai = async (f, uuid) => {
  const p = await ambilPeriode(undefined, f, uuid);
  if (!SELESAI.includes(p.status)) throw konflik("Slip & rekap hanya tersedia untuk periode yang sudah disetujui");
  return p;
};

// Praktisi yang ditautkan ke akun login (users.practitioner_uuid) di faskes token.
const praktisiSaya = async (req) => {
  const r = await satu(
    `SELECT u.practitioner_uuid FROM users u JOIN practitioner pr ON pr.uuid = u.practitioner_uuid AND pr.faskes_uuid = $2 AND pr.deleted_at IS NULL
      WHERE u.username = $1 AND u.deleted_at IS NULL LIMIT 1`,
    [req.author.username ?? "", req.author.faskesUuid],
  );
  if (!r?.practitioner_uuid) throw tidakDitemukan("Data praktisi yang ditautkan ke akun Anda");
  return r.practitioner_uuid;
};

const susunSlip = async (f, p, practitionerUuid) => {
  const rincian = await satu(`SELECT * FROM remunerasi_rincian WHERE periode_uuid = $1 AND faskes_uuid = $2 AND practitioner_uuid = $3`, [p.uuid, f, practitionerUuid]);
  if (!rincian) throw tidakDitemukan("Slip remunerasi pada periode ini");
  const [item, koreksi] = await Promise.all([
    query(
      `SELECT jenis_layanan, kategori, nama_item, tanggal_layanan, tanggal_lunas, nilai, persen_bp, jaspel, langsung, patient_uuid
         FROM remunerasi_sumber WHERE periode_uuid = $1 AND faskes_uuid = $2 AND pelaksana_uuid = $3 AND status = 'dihitung'
        ORDER BY tanggal_lunas, bill_item_uuid`,
      [p.uuid, f, practitionerUuid],
    ),
    query(
      `SELECT k.nilai, k.alasan, k.created_at, r.nomor AS nomor_rujukan FROM remunerasi_koreksi k LEFT JOIN remunerasi_periode r ON r.uuid = k.rujukan_periode_uuid
        WHERE k.periode_uuid = $1 AND k.faskes_uuid = $2 AND k.practitioner_uuid = $3 AND k.deleted_at IS NULL ORDER BY k.created_at`,
      [p.uuid, f, practitionerUuid],
    ),
  ]);
  return {
    periode: { uuid: p.uuid, nomor: p.nomor, nama: namaPeriode(p.tahun, p.bulan), status: p.status, skema_versi: p.skema_versi, disetujui_pada: p.disetujui_pada, tanggal_bayar: p.tanggal_bayar },
    penerima: { nama: rincian.nama, profesi: rincian.profesi, nama_profesi: PROFESI[rincian.profesi] ?? rincian.profesi, unit: rincian.unit },
    ringkasan: { jumlah_layanan: rincian.jumlah_layanan, nilai_dasar: rincian.nilai_dasar, langsung: rincian.langsung, kebersamaan: rincian.kebersamaan, koreksi: rincian.koreksi, total: rincian.total },
    rumus: rincian.rumus,
    // Identitas pasien diganti penanda anonim; kolom patient_uuid tidak pernah dikirim.
    layanan: item.map(({ patient_uuid, ...i }) => ({ ...i, pasien: refPasien(p.uuid, patient_uuid) })),
    koreksi,
  };
};

rute.get(
  "/slip/saya",
  wajibIzin(MODUL_IZIN, SUB.slip, "READ"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const pr = await praktisiSaya(req);
    const rows = await query(
      `SELECT p.uuid, p.nomor, p.tahun, p.bulan, p.status, r.total, r.langsung, r.kebersamaan, r.koreksi, p.disetujui_pada, p.tanggal_bayar
         FROM remunerasi_rincian r JOIN remunerasi_periode p ON p.uuid = r.periode_uuid AND p.faskes_uuid = r.faskes_uuid AND p.deleted_at IS NULL
        WHERE r.faskes_uuid = $1 AND r.practitioner_uuid = $2 AND p.status IN ('disetujui', 'dibayar') ORDER BY p.tahun DESC, p.bulan DESC`,
      [f, pr],
    );
    kirim(res, rows.map((r) => ({ ...r, nama: namaPeriode(r.tahun, r.bulan) })));
  }),
);

rute.get(
  "/slip/saya/:periode",
  wajibIzin(MODUL_IZIN, SUB.slip, "READ"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    const pr = await praktisiSaya(req);
    kirim(res, await susunSlip(f, await periodeSelesai(f, req.params.periode), pr));
  }),
);

rute.get(
  "/slip/:periode/:practitioner",
  wajibIzin(MODUL_IZIN, SUB.rekap, "READ"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    kirim(res, await susunSlip(f, await periodeSelesai(f, req.params.periode), String(req.params.practitioner)));
  }),
);

const kelompokkan = (rincian, kunci, label) => {
  const peta = new Map();
  for (const r of rincian) {
    const k = r[kunci] ?? "";
    const g = peta.get(k) ?? { kode: k || null, nama: label(k) || "(tanpa keterangan)", jumlah_penerima: 0, jumlah_layanan: 0, langsung: 0, kebersamaan: 0, koreksi: 0, total: 0 };
    g.jumlah_penerima += 1;
    g.jumlah_layanan += Number(r.jumlah_layanan) || 0;
    for (const c of ["langsung", "kebersamaan", "koreksi", "total"]) g[c] += keSen(r[c]);
    peta.set(k, g);
  }
  return [...peta.values()].sort((a, b) => b.total - a.total).map((g) => ({ ...g, langsung: dariSen(g.langsung), kebersamaan: dariSen(g.kebersamaan), koreksi: dariSen(g.koreksi), total: dariSen(g.total) }));
};

rute.get(
  "/rekap",
  wajibIzin(MODUL_IZIN, SUB.rekap, "READ"),
  tanganiAkuntansi(async (req, res) => {
    const f = req.author.faskesUuid;
    if (!req.query.periode_uuid) throw permintaanSalah("periode_uuid wajib diisi");
    const p = await periodeSelesai(f, req.query.periode_uuid);
    const format = req.query.ekspor;
    if (format !== undefined) {
      if (!["xlsx", "csv"].includes(format)) throw permintaanSalah("ekspor harus xlsx atau csv");
      if (!(await punyaIzin(req, MODUL_IZIN, SUB.rekap, "EKSPOR"))) throw galatIzin(MODUL_IZIN, SUB.rekap, "EKSPOR");
    }
    const rincian = await query(
      `SELECT practitioner_uuid, nama, profesi, unit, jumlah_layanan, nilai_dasar, langsung, kebersamaan, koreksi, total, rumus
         FROM remunerasi_rincian WHERE periode_uuid = $1 AND faskes_uuid = $2 ORDER BY unit NULLS LAST, total DESC, nama`,
      [p.uuid, f],
    );
    if (format) await transaksi((k) => audit(k, req, "ekspor", "remunerasi_rekap", p.uuid, { periode: p.nomor, format, jumlah_penerima: rincian.length, total: p.total }));
    kirim(res, {
      periode: { uuid: p.uuid, nomor: p.nomor, nama: namaPeriode(p.tahun, p.bulan), status: p.status, skema_versi: p.skema_versi, total: p.total, total_langsung: p.total_langsung, total_kebersamaan: p.total_kebersamaan, total_koreksi: p.total_koreksi, disetujui_oleh: p.disetujui_oleh, disetujui_pada: p.disetujui_pada },
      per_unit: kelompokkan(rincian, "unit", (k) => k),
      per_profesi: kelompokkan(rincian, "profesi", (k) => PROFESI[k] ?? k),
      rincian: rincian.map((r) => ({ ...r, nama_profesi: PROFESI[r.profesi] ?? r.profesi })),
    });
  }),
);

export default rute;
