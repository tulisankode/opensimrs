import express from "express";
import { query, satu, ubah, transaksi, sekarang, uuidv7 } from "../db.js";
import { tangani, kirim, halaman, denganHalaman, tidakDitemukan, permintaanSalah, Galat } from "../umum/respons.js";
import { izinKoding } from "../umum/izin.js";
import { pasien, namaPraktisi } from "../umum/kunjungan.js";
import { resumeRme } from "./rekamedis-client.js";
import {
  ambilKoding, checklistKunjungan, checklistLengkapSemua, diagnosisTerkini, diagnosisUtamaDari, klarifikasiKunjungan,
  klarifikasiTerbuka, prasyaratSiapKlaim, satuKoding, satuKunjunganSumber, tindakanTerkini,
} from "./data.js";
import { bedaDariDiagnosisDokter, validasiDiagnosisInput, validasiTindakanInput } from "./validasi.js";
import { KUNJUNGAN_TIPE, TABEL_KUNJUNGAN, daftarNilai, rentangOpsional, teks, tglLokal } from "./bersama.js";

// Worklist & koding kunjungan — /api/v3/penunjang/koding/...
//   /worklist                 kunjungan RJ/RI/IGD pulang, status koding (belum/proses/siap_klaim), filter
//   /kunjungan/:tipe/:uuid     detail kunjungan + diagnosis dokter pembanding (RME) + koding terkini + kesiapan klaim
//   /kunjungan/:tipe/:uuid/riwayat-koding   riwayat diagnosis & tindakan (semua versi, append-only)
//   PUT  /kunjungan/:tipe/:uuid/koding      simpan versi koding baru (diagnosis ICD-10 + tindakan ICD-9-CM)
//   POST /kunjungan/:tipe/:uuid/finalisasi  tandai siap_klaim bila prasyarat terpenuhi
const rute = express.Router();

// faskes_uuid & status_pulang didorong ke tiap cabang UNION (bukan setelah union) agar dapat memakai indeks tabel
// sumber alih-alih memindai seluruh kunjungan lintas faskes.
const SQL_KUNJUNGAN = (tipe) => `
  SELECT '${tipe}' AS kunjungan_tipe, r.uuid AS kunjungan_uuid, r.no_reg, r.no_rm, r.patient_uuid, r.name,
         r.practitioner_uuid, r.payment_method, r.lokasi_uuid, r.rekam_medis_uuid, r.status_pulang,
         r.discharge_date, r.faskes_uuid
    FROM ${TABEL_KUNJUNGAN[tipe]} r
   WHERE r.faskes_uuid = $1 AND r.deleted_at IS NULL AND r.status_pulang IS NOT NULL AND r.status_pulang <> ''`;

rute.get(
  "/worklist",
  izinKoding("Worklist", "READ"),
  tangani(async (req, res) => {
    const faskes = req.author.faskesUuid;
    const pg = halaman(req.query);
    const jenis = daftarNilai(req.query.jenis_kunjungan).filter((j) => KUNJUNGAN_TIPE.includes(j));
    const tipeList = jenis.length ? jenis : KUNJUNGAN_TIPE;
    const union = tipeList.map((t) => SQL_KUNJUNGAN(t)).join(" UNION ALL ");

    const p = [faskes];
    let w = "k.faskes_uuid = $1 AND k.status_pulang IS NOT NULL AND k.status_pulang <> ''";
    const penjamin = daftarNilai(req.query.penjamin).map(Number).filter(Number.isFinite);
    if (penjamin.length) {
      p.push(penjamin);
      w += ` AND k.payment_method = ANY($${p.length})`;
    }
    if (req.query.lokasi_uuid) {
      p.push(req.query.lokasi_uuid);
      w += ` AND k.lokasi_uuid = $${p.length}`;
    }
    const rentang = req.query.tanggal_pulang_mulai
      ? rentangOpsional({ tanggal_mulai: req.query.tanggal_pulang_mulai, tanggal_selesai: req.query.tanggal_pulang_sampai })
      : null;
    if (rentang) {
      p.push(rentang.mulai, rentang.selesai);
      w += ` AND ${tglLokal("k.discharge_date")} BETWEEN $${p.length - 1} AND $${p.length}`;
    }
    const statusKoding = teks(req.query.status_koding);
    if (statusKoding === "belum") w += ` AND kk.uuid IS NULL`;
    else if (statusKoding === "proses") w += ` AND kk.status = 'proses'`;
    else if (statusKoding === "siap_klaim") w += ` AND kk.status = 'siap_klaim'`;

    const dari = `FROM (${union}) k
      LEFT JOIN koding_kunjungan kk ON kk.faskes_uuid = k.faskes_uuid AND kk.kunjungan_tipe = k.kunjungan_tipe
        AND kk.kunjungan_uuid = k.kunjungan_uuid AND kk.deleted_at IS NULL
      LEFT JOIN lokasi l ON l.uuid = k.lokasi_uuid`;

    const [rows, total] = await Promise.all([
      query(
        `SELECT k.kunjungan_tipe, k.kunjungan_uuid, k.no_reg, k.no_rm, k.name AS nama_pasien, k.payment_method,
                k.lokasi_uuid, l.name AS lokasi_nama, k.discharge_date, k.status_pulang,
                COALESCE(kk.status, 'belum') AS status_koding, kk.uuid AS koding_kunjungan_uuid, kk.finalisasi_at
           ${dari} WHERE ${w} ORDER BY k.discharge_date DESC NULLS LAST LIMIT ${pg.limit} OFFSET ${pg.offset}`,
        p,
      ),
      satu(`SELECT COUNT(*)::int n ${dari} WHERE ${w}`, p),
    ]);
    kirim(res, denganHalaman(rows, total.n, pg));
  }),
);

rute.get(
  "/kunjungan/:tipe/:uuid",
  izinKoding("Koding", "READ"),
  tangani(async (req, res) => {
    const { tipe, uuid } = req.params;
    const faskes = req.author.faskesUuid;
    const sumber = await satuKunjunganSumber(tipe, uuid, faskes);
    const koding = await ambilKoding(tipe, uuid, faskes, sumber);
    const [p, dpjp, diagnosis, tindakan, checklist, klarifikasi, resume] = await Promise.all([
      pasien(sumber.patient_uuid, faskes),
      namaPraktisi(sumber.practitioner_uuid),
      diagnosisTerkini(koding.uuid, koding.versi_terakhir),
      tindakanTerkini(koding.uuid, koding.versi_terakhir),
      checklistKunjungan(koding.uuid, tipe, faskes),
      klarifikasiKunjungan(koding.uuid),
      resumeRme(sumber.rekam_medis_uuid, tipe, faskes, req.author.token).catch(() => null),
    ]);
    const prasyarat = prasyaratSiapKlaim(diagnosis, checklist, klarifikasi);
    kirim(res, {
      kunjungan: { ...sumber, dpjp_nama: dpjp },
      pasien: p,
      koding,
      diagnosis,
      tindakan,
      checklist,
      klarifikasi,
      diagnosa_dokter: resume?.diagnosaDokter ?? [],
      rme_tersedia: resume !== null,
      siap_klaim: {
        boleh: prasyarat.length === 0,
        diagnosis_utama: Boolean(diagnosisUtamaDari(diagnosis)),
        checklist_lengkap: checklistLengkapSemua(checklist),
        klarifikasi_terbuka: klarifikasiTerbuka(klarifikasi),
      },
    });
  }),
);

rute.get(
  "/kunjungan/:tipe/:uuid/riwayat-koding",
  izinKoding("Koding", "READ"),
  tangani(async (req, res) => {
    const { tipe, uuid } = req.params;
    const koding = await satuKoding(tipe, uuid, req.author.faskesUuid);
    if (!koding) return kirim(res, { diagnosis: [], tindakan: [] });
    const [diagnosis, tindakan] = await Promise.all([
      query(`SELECT * FROM koding_diagnosis WHERE koding_kunjungan_uuid = $1 ORDER BY versi DESC, peran, created_at`, [koding.uuid]),
      query(`SELECT * FROM koding_tindakan WHERE koding_kunjungan_uuid = $1 ORDER BY versi DESC, created_at`, [koding.uuid]),
    ]);
    kirim(res, { diagnosis, tindakan });
  }),
);

rute.put(
  "/kunjungan/:tipe/:uuid/koding",
  izinKoding("Koding", "UPDATE"),
  tangani(async (req, res) => {
    const { tipe, uuid } = req.params;
    const faskes = req.author.faskesUuid;
    const b = req.body ?? {};
    const diagnosisInput = Array.isArray(b.diagnosis) ? b.diagnosis : [];
    const tindakanInput = Array.isArray(b.tindakan) ? b.tindakan : [];
    validasiDiagnosisInput(diagnosisInput);
    validasiTindakanInput(tindakanInput);

    const sumber = await satuKunjunganSumber(tipe, uuid, faskes);
    let resume;
    try {
      resume = await resumeRme(sumber.rekam_medis_uuid, tipe, faskes, req.author.token);
    } catch {
      throw new Galat(502, "Diagnosis dokter pembanding tidak dapat dimuat dari RME, coba lagi");
    }
    const diagnosaDokter = resume?.diagnosaDokter ?? [];
    const kodeDokter = new Set(diagnosaDokter.map((d) => d.diagnosis_uuid));

    const diagnosisUuids = [...new Set(diagnosisInput.map((d) => d.diagnosis_uuid))];
    const masterDiagnosis = await query(`SELECT uuid, code, name FROM diagnosis WHERE uuid = ANY($1) AND deleted_at IS NULL AND status`, [diagnosisUuids]);
    if (masterDiagnosis.length !== diagnosisUuids.length) throw permintaanSalah("Sebagian kode ICD-10 tidak ditemukan atau tidak aktif");

    const icd9Uuids = [...new Set(tindakanInput.map((t) => t.icd9_uuid))];
    const masterIcd9 = icd9Uuids.length ? await query(`SELECT uuid, code, name FROM icd9 WHERE uuid = ANY($1) AND deleted_at IS NULL AND status`, [icd9Uuids]) : [];
    if (masterIcd9.length !== icd9Uuids.length) throw permintaanSalah("Sebagian kode ICD-9-CM tidak ditemukan atau tidak aktif");

    for (const d of diagnosisInput) {
      if (bedaDariDiagnosisDokter(d.diagnosis_uuid, kodeDokter) && !teks(d.alasan)) {
        const m = masterDiagnosis.find((x) => x.uuid === d.diagnosis_uuid);
        throw permintaanSalah(`Diagnosis ${m?.code ?? d.diagnosis_uuid} berbeda dari diagnosis dokter, alasan perubahan wajib diisi`);
      }
    }

    const hasil = await transaksi(async (k) => {
      const koding = await ambilKoding(tipe, uuid, faskes, sumber, k);
      const versi = koding.versi_terakhir + 1;
      for (const d of diagnosisInput) {
        const m = masterDiagnosis.find((x) => x.uuid === d.diagnosis_uuid);
        await query(
          `INSERT INTO koding_diagnosis (uuid, faskes_uuid, koding_kunjungan_uuid, versi, diagnosis_uuid, kode, nama, peran, sumber_dokter_uuid, alasan, koder_uuid, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [uuidv7(), faskes, koding.uuid, versi, m.uuid, m.code, m.name, d.peran, teks(d.sumber_dokter_uuid) ?? null, teks(d.alasan) ?? null, req.author.username, sekarang()],
          k,
        );
      }
      for (const t of tindakanInput) {
        const m = masterIcd9.find((x) => x.uuid === t.icd9_uuid);
        await query(
          `INSERT INTO koding_tindakan (uuid, faskes_uuid, koding_kunjungan_uuid, versi, icd9_uuid, kode, nama, alasan, koder_uuid, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [uuidv7(), faskes, koding.uuid, versi, m.uuid, m.code, m.name, teks(t.alasan) ?? null, req.author.username, sekarang()],
          k,
        );
      }
      return ubah("koding_kunjungan", koding.uuid, faskes, { versi_terakhir: versi, koder_uuid: req.author.username }, k);
    });
    kirim(res, hasil, "Koding tersimpan");
  }),
);

rute.post(
  "/kunjungan/:tipe/:uuid/finalisasi",
  izinKoding("Koding", "UPDATE"),
  tangani(async (req, res) => {
    const { tipe, uuid } = req.params;
    const faskes = req.author.faskesUuid;
    const hasil = await transaksi(async (k) => {
      const koding = await satu(
        `SELECT * FROM koding_kunjungan WHERE faskes_uuid = $1 AND kunjungan_tipe = $2 AND kunjungan_uuid = $3 AND deleted_at IS NULL FOR UPDATE`,
        [faskes, tipe, uuid],
        k,
      );
      if (!koding) throw tidakDitemukan("Koding kunjungan");

      const [diagnosis, checklist, klarifikasi] = await Promise.all([
        diagnosisTerkini(koding.uuid, koding.versi_terakhir, k),
        checklistKunjungan(koding.uuid, tipe, faskes, k),
        klarifikasiKunjungan(koding.uuid, undefined, k),
      ]);
      const prasyarat = prasyaratSiapKlaim(diagnosis, checklist, klarifikasi);
      if (prasyarat.length) throw new Galat(409, prasyarat.join("; "));
      return ubah("koding_kunjungan", koding.uuid, faskes, { status: "siap_klaim", finalisasi_at: sekarang(), koder_uuid: req.author.username }, k);
    });
    kirim(res, hasil, "Kunjungan dinyatakan siap klaim");
  }),
);

export default rute;
