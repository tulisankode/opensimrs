import express from "express";
import { query, satu, sekarang, transaksi } from "../db.js";
import { kirim, permintaanSalah } from "../umum/respons.js";
import { izinMutu, punyaIzin, wajibSalahSatu } from "../umum/izin.js";
import { cekPilihan, pilihan, teks } from "./bersama.js";
import { rentangBulan, bulanDariEpoch, uraiBulan } from "./indikator-bersama.js";
import {
  AKIBAT_INSIDEN,
  GRADE,
  JENIS_INSIDEN,
  JENIS_INVESTIGASI,
  KATEGORI_INSIDEN,
  LAYANAN_INSIDEN,
  LEVEL_DAMPAK,
  LEVEL_PROBABILITAS,
  STATUS_INVESTIGASI,
  STATUS_LAPORAN,
  STATUS_RISIKO,
  STATUS_TINDAK_LANJUT,
  TINDAKAN_OLEH,
  URUTAN_GRADE,
  AMBANG_MENDEKATI,
  median,
  susunTren,
  validasiMatriks,
  validasiTenggatInvestigasi,
} from "./ikp-bersama.js";
import { tanganiMutu, NAMA_PEGAWAI } from "./dasar.js";
import { AKSI_IKP, MODUL, SUB, SUB_RISIKO, auditIkp, konfigurasiPengingatLengkap, pengaturanFaskes } from "./ikp-dasar.js";
import { awalHariWib } from "../sarpras/bersama.js";
import laporan from "./ikp-laporan.js";
import proses from "./ikp-proses.js";
import risiko from "./ikp-risiko.js";

// Insiden Keselamatan Pasien (IKP) & manajemen risiko (STD-0026, fitur mutu_ikp) — /api/v3/penunjang/mutu/ikp/...
//   GET /ikp/referensi       pilihan enum, unit, pegawai (peninjau), matriks & tenggat aktif   salah satu izin IKP / Register Risiko
//   GET /ikp/pengaturan      matriks grading, tenggat lapor/investigasi, pengingat              READ / GRADING / PENGATURAN
//   PUT /ikp/pengaturan      ubah (matriks berubah → versi naik; grading lama tetap)            PENGATURAN
//   GET /ikp/dasbor?dari=YYYY-MM&sampai=YYYY-MM&unit_uuid=   rekap & tren                       DASBOR
//   GET /ikp/ekspor?dari=&sampai=&unit_uuid=&format=internal  baris rekap internal (Excel di klien) EKSPOR
//   /ikp/laporan..., /ikp/lampiran/...   laporan insiden (ikp-laporan.js)
//   /ikp/laporan/:uuid/grading|investigasi|tindak-lanjut, /ikp/tindak-lanjut/...   proses (ikp-proses.js)
//   /ikp/risiko...                       register risiko unit (ikp-risiko.js)
// Izin terpisah dari fitur mutu lain: submodul "Insiden Keselamatan Pasien" & "Register Risiko". Rekap & ekspor tidak
// memuat identitas pelapor maupun data pasien. Format pelaporan nasional (SP2KP/KNKP) belum disediakan karena
// spesifikasi resminya belum ditetapkan — tidak dikarang.
const rute = express.Router();
const izinSalahSatu = (...aksi) => wajibSalahSatu(...aksi.map((a) => [MODUL, SUB, a]));
const izinMana = wajibSalahSatu(...AKSI_IKP.map((a) => [MODUL, SUB, a]), [MODUL, SUB_RISIKO, "READ"]);

rute.get(
  "/referensi",
  izinMana,
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const p = await pengaturanFaskes(f);
    // Daftar pegawai (PIC) hanya untuk peninjau/pengelola, bukan setiap pelapor.
    const perluPegawai = (await punyaIzin(req, MODUL, SUB, ["TINDAK LANJUT", "READ"])) || (await punyaIzin(req, MODUL, SUB_RISIKO, ["CREATE", "UPDATE"]));
    kirim(res, {
      jenis_insiden: pilihan(JENIS_INSIDEN),
      kategori_insiden: pilihan(KATEGORI_INSIDEN),
      akibat: pilihan(AKIBAT_INSIDEN),
      layanan: pilihan(LAYANAN_INSIDEN),
      tindakan_oleh: pilihan(TINDAKAN_OLEH),
      status_laporan: pilihan(STATUS_LAPORAN),
      grade: pilihan(GRADE),
      level_dampak: pilihan(LEVEL_DAMPAK),
      level_probabilitas: pilihan(LEVEL_PROBABILITAS),
      jenis_investigasi: pilihan(JENIS_INVESTIGASI),
      status_investigasi: pilihan(STATUS_INVESTIGASI),
      status_tindak_lanjut: pilihan(STATUS_TINDAK_LANJUT),
      status_risiko: pilihan(STATUS_RISIKO),
      unit: await query(`SELECT uuid, code AS kode, name AS nama FROM lokasi WHERE faskes_uuid = $1 AND deleted_at IS NULL AND status = true ORDER BY name`, [f]),
      pegawai: perluPegawai
        ? await query(`SELECT p.uuid, ${NAMA_PEGAWAI("p")} AS nama FROM pegawai p WHERE p.faskes_uuid = $1 AND p.deleted_at IS NULL AND p.status = true ORDER BY p.name`, [f])
        : [],
      pengaturan: { tenggat_lapor_jam: p.tenggat_lapor_jam, tenggat_investigasi_hari: p.tenggat_investigasi_hari, matriks: p.matriks, versi_matriks: p.versi_matriks, bawaan: p.bawaan },
      format_nasional_tersedia: false,
    });
  }),
);

rute.get(
  "/pengaturan",
  izinSalahSatu("READ", "GRADING", "PENGATURAN"),
  tanganiMutu(async (req, res) => {
    const p = await pengaturanFaskes(req.author.faskesUuid);
    kirim(res, { ...p, pengingat_lengkap: konfigurasiPengingatLengkap(p) });
  }),
);

rute.put(
  "/pengaturan",
  izinMutu(SUB, "PENGATURAN"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const b = req.body ?? {};
    const hasil = await transaksi(async (k) => {
      await query(`SELECT pg_advisory_xact_lock(hashtext('mutu_ikp_pengaturan:' || $1))`, [f], k);
      const lama = await pengaturanFaskes(f, k);
      const jam = b.tenggat_lapor_jam === undefined ? lama.tenggat_lapor_jam : Number(b.tenggat_lapor_jam);
      if (!Number.isInteger(jam) || jam < 1 || jam > 720) throw permintaanSalah("tenggat_lapor_jam harus bilangan bulat 1–720");
      const tenggat = b.tenggat_investigasi_hari === undefined ? lama.tenggat_investigasi_hari : validasiTenggatInvestigasi(b.tenggat_investigasi_hari);
      const matriks = b.matriks === undefined ? lama.matriks : validasiMatriks(b.matriks);
      const versi = JSON.stringify(matriks) === JSON.stringify(lama.matriks) ? lama.versi_matriks : lama.versi_matriks + 1;
      const penerima = b.pengingat_penerima === undefined ? lama.pengingat_penerima : teks(b.pengingat_penerima, "pengingat_penerima", 2000) ?? null;
      const kanal = b.pengingat_kanal === undefined ? lama.pengingat_kanal : teks(b.pengingat_kanal, "pengingat_kanal", 100) ?? null;
      const n = sekarang();
      const baru = await satu(
        `INSERT INTO mutu_ikp_pengaturan (faskes_uuid, tenggat_lapor_jam, tenggat_investigasi_hari, matriks, versi_matriks, pengingat_penerima, pengingat_kanal, diubah_oleh, created_at, updated_at)
         VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8, $9, $9)
         ON CONFLICT (faskes_uuid) DO UPDATE SET tenggat_lapor_jam = EXCLUDED.tenggat_lapor_jam, tenggat_investigasi_hari = EXCLUDED.tenggat_investigasi_hari,
           matriks = EXCLUDED.matriks, versi_matriks = EXCLUDED.versi_matriks, pengingat_penerima = EXCLUDED.pengingat_penerima,
           pengingat_kanal = EXCLUDED.pengingat_kanal, diubah_oleh = EXCLUDED.diubah_oleh, updated_at = EXCLUDED.updated_at
         RETURNING *`,
        [f, jam, JSON.stringify(tenggat), JSON.stringify(matriks), versi, penerima, kanal, req.author.username ?? null, n],
        k,
      );
      const ringkas = (x) => ({ tenggat_lapor_jam: x.tenggat_lapor_jam, tenggat_investigasi_hari: x.tenggat_investigasi_hari, matriks: x.matriks, versi_matriks: x.versi_matriks, pengingat_penerima: x.pengingat_penerima, pengingat_kanal: x.pengingat_kanal });
      await auditIkp(k, req, "ikp_pengaturan", f, "ubah_pengaturan", ringkas(lama), ringkas(baru));
      return baru;
    });
    const p = await pengaturanFaskes(f);
    kirim(res, { ...p, pengingat_lengkap: konfigurasiPengingatLengkap(p), versi_berubah: Number(hasil.versi_matriks) }, "Pengaturan IKP tersimpan");
  }),
);

// Rentang bulan rekap (default 12 bulan terakhir s.d. bulan berjalan, WIB) → { bulan, awal, akhir }.
const rentangRekap = (q) => {
  const sampai = q.sampai || bulanDariEpoch(sekarang());
  const awalDefault = (() => {
    const [t, b] = sampai.split("-").map(Number);
    const total = t * 12 + (b - 1) - 11;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
  })();
  const bulan = rentangBulan(q.dari || awalDefault, sampai);
  return { bulan, awal: uraiBulan(bulan[0]).awal, akhir: uraiBulan(bulan[bulan.length - 1]).akhir };
};
const BULAN_WIB = (kol) => `to_char(to_timestamp(${kol}) AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM')`;

rute.get(
  "/dasbor",
  izinMutu(SUB, "DASBOR"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const { bulan, awal, akhir } = rentangRekap(req.query);
    const unit = req.query.unit_uuid ? String(req.query.unit_uuid) : null;
    const dasar = `FROM mutu_ikp_laporan l WHERE l.faskes_uuid = $1 AND l.deleted_at IS NULL AND l.waktu_kejadian >= $2 AND l.waktu_kejadian < $3 AND ($4::varchar IS NULL OR l.unit_uuid = $4)`;
    const p = [f, awal, akhir, unit];
    const hitung = (kol) => query(`SELECT ${kol} AS kunci, COUNT(*)::int AS jumlah ${dasar} GROUP BY 1`, p);
    const n = sekarang();
    const [perJenis, perGrade, perStatus, perKategori, perUnit, waktu, trenJenis, trenGrade, tl, investigasi, perhatian] = await Promise.all([
      hitung("l.jenis_insiden"),
      hitung("COALESCE(l.grade, 'belum')"),
      hitung("l.status"),
      hitung("COALESCE(l.kategori_insiden, 'tanpa_kategori')"),
      query(`SELECT l.unit_uuid AS kunci, un.name AS nama, COUNT(*)::int AS jumlah, COUNT(*) FILTER (WHERE l.grade IN ('kuning', 'merah') OR l.jenis_insiden = 'sentinel')::int AS risiko_tinggi
               FROM mutu_ikp_laporan l LEFT JOIN lokasi un ON un.uuid = l.unit_uuid
              WHERE l.faskes_uuid = $1 AND l.deleted_at IS NULL AND l.waktu_kejadian >= $2 AND l.waktu_kejadian < $3 AND ($4::varchar IS NULL OR l.unit_uuid = $4)
              GROUP BY 1, 2 ORDER BY 3 DESC`, p),
      query(`SELECT l.waktu_diketahui, l.waktu_lapor, l.terlambat_lapor ${dasar}`, p),
      query(`SELECT ${BULAN_WIB("l.waktu_kejadian")} AS bulan, l.jenis_insiden AS kunci, COUNT(*)::int AS jumlah ${dasar} GROUP BY 1, 2`, p),
      query(`SELECT ${BULAN_WIB("l.waktu_kejadian")} AS bulan, COALESCE(l.grade, 'belum') AS kunci, COUNT(*)::int AS jumlah ${dasar} GROUP BY 1, 2`, p),
      query(
        `SELECT t.status, COUNT(*)::int AS jumlah,
                COUNT(*) FILTER (WHERE t.status NOT IN ('selesai', 'terverifikasi') AND t.tenggat < $5)::int AS terlambat
           FROM mutu_ikp_tindak_lanjut t JOIN mutu_ikp_laporan l ON l.uuid = t.laporan_uuid
          WHERE t.faskes_uuid = $1 AND t.deleted_at IS NULL AND l.deleted_at IS NULL AND l.waktu_kejadian >= $2 AND l.waktu_kejadian < $3 AND ($4::varchar IS NULL OR l.unit_uuid = $4)
          GROUP BY 1`,
        [...p, awalHariWib(n)],
      ),
      query(
        `SELECT COALESCE(i.jenis, 'belum') AS jenis, COALESCE(i.status, 'belum') AS status, COUNT(*)::int AS jumlah,
                COUNT(*) FILTER (WHERE l.status <> 'ditutup' AND COALESCE(i.status, '') <> 'selesai' AND l.batas_investigasi < $5)::int AS terlambat
           FROM mutu_ikp_laporan l LEFT JOIN mutu_ikp_investigasi i ON i.laporan_uuid = l.uuid AND i.deleted_at IS NULL
          WHERE l.faskes_uuid = $1 AND l.deleted_at IS NULL AND l.grade IS NOT NULL AND l.waktu_kejadian >= $2 AND l.waktu_kejadian < $3 AND ($4::varchar IS NULL OR l.unit_uuid = $4)
          GROUP BY 1, 2`,
        [...p, n],
      ),
      // Pengingat batas waktu di dalam aplikasi (tanpa batas periode): laporan belum diterima unit, investigasi
      // mendekati/lewat batas, dan tindak lanjut lewat tenggat.
      query(
        `SELECT * FROM (
           SELECT l.uuid, l.nomor, un.name AS unit_nama, 'belum_diterima' AS jenis, l.waktu_lapor AS batas
             FROM mutu_ikp_laporan l LEFT JOIN lokasi un ON un.uuid = l.unit_uuid
            WHERE l.faskes_uuid = $1 AND l.deleted_at IS NULL AND l.status IN ('dilaporkan') AND ($2::varchar IS NULL OR l.unit_uuid = $2)
           UNION ALL
           SELECT l.uuid, l.nomor, un.name, CASE WHEN l.batas_investigasi < $3 THEN 'investigasi_terlambat' ELSE 'investigasi_mendekati' END, l.batas_investigasi
             FROM mutu_ikp_laporan l LEFT JOIN lokasi un ON un.uuid = l.unit_uuid
             LEFT JOIN mutu_ikp_investigasi i ON i.laporan_uuid = l.uuid AND i.deleted_at IS NULL
            WHERE l.faskes_uuid = $1 AND l.deleted_at IS NULL AND l.status <> 'ditutup' AND l.batas_investigasi IS NOT NULL
              AND COALESCE(i.status, '') <> 'selesai' AND l.batas_investigasi < $3 + $4 AND ($2::varchar IS NULL OR l.unit_uuid = $2)
           UNION ALL
           SELECT l.uuid, l.nomor, un.name, 'tindak_lanjut_terlambat', t.tenggat
             FROM mutu_ikp_tindak_lanjut t JOIN mutu_ikp_laporan l ON l.uuid = t.laporan_uuid AND l.deleted_at IS NULL
             LEFT JOIN lokasi un ON un.uuid = l.unit_uuid
            WHERE t.faskes_uuid = $1 AND t.deleted_at IS NULL AND t.status NOT IN ('selesai', 'terverifikasi') AND t.tenggat < $5
              AND l.status <> 'ditutup' AND ($2::varchar IS NULL OR l.unit_uuid = $2)
         ) x ORDER BY batas LIMIT 50`,
        [f, unit, n, AMBANG_MENDEKATI, awalHariWib(n)],
      ),
    ]);
    const jam = waktu.map((w) => (Number(w.waktu_lapor) - Number(w.waktu_diketahui)) / 3600);
    const terlambat = waktu.filter((w) => w.terlambat_lapor).length;
    const p2 = await pengaturanFaskes(f);
    kirim(res, {
      periode: { dari: bulan[0], sampai: bulan[bulan.length - 1] },
      ringkasan: {
        total: waktu.length,
        sentinel: perJenis.find((r) => r.kunci === "sentinel")?.jumlah ?? 0,
        risiko_tinggi: perGrade.filter((r) => ["kuning", "merah"].includes(r.kunci)).reduce((s, r) => s + r.jumlah, 0),
        belum_digrading: perGrade.find((r) => r.kunci === "belum")?.jumlah ?? 0,
        terlambat_lapor: terlambat,
        persen_tepat_waktu: waktu.length ? Math.round(((waktu.length - terlambat) / waktu.length) * 1000) / 10 : null,
        median_jam_pelaporan: median(jam),
        tenggat_lapor_jam: p2.tenggat_lapor_jam,
      },
      per_jenis: perJenis,
      per_grade: perGrade,
      per_status: perStatus,
      per_kategori: perKategori,
      per_unit: perUnit,
      tren_jenis: susunTren(trenJenis, bulan, Object.keys(JENIS_INSIDEN)),
      tren_grade: susunTren(trenGrade, bulan, [...URUTAN_GRADE, "belum"]),
      tindak_lanjut: tl,
      investigasi,
      perhatian,
      pengingat_lengkap: konfigurasiPengingatLengkap(p2),
    });
  }),
);

rute.get(
  "/ekspor",
  izinMutu(SUB, "EKSPOR"),
  tanganiMutu(async (req, res) => {
    const f = req.author.faskesUuid;
    const format = req.query.format || "internal";
    if (format !== "internal")
      throw permintaanSalah("Format pelaporan nasional (SP2KP/KNKP) belum tersedia: spesifikasi resminya belum ditetapkan. Gunakan rekap internal.");
    const { bulan, awal, akhir } = rentangRekap(req.query);
    const unit = req.query.unit_uuid ? String(req.query.unit_uuid) : null;
    const jenis = cekPilihan(req.query.jenis_insiden || undefined, JENIS_INSIDEN, "jenis_insiden") ?? null;
    // Tanpa identitas pelapor, data pasien, dan kronologi (isi rahasia).
    const baris = await query(
      `SELECT l.nomor, l.jenis_insiden, l.kategori_insiden, l.layanan, l.akibat, l.waktu_kejadian, l.waktu_diketahui, l.waktu_lapor, l.terlambat_lapor,
              un.name AS unit_nama, l.grade, l.skor, l.status, l.anonim, i.jenis AS jenis_investigasi, i.status AS status_investigasi,
              (SELECT COUNT(*)::int FROM mutu_ikp_tindak_lanjut t WHERE t.laporan_uuid = l.uuid AND t.deleted_at IS NULL) AS jumlah_tindak_lanjut,
              (SELECT COUNT(*)::int FROM mutu_ikp_tindak_lanjut t WHERE t.laporan_uuid = l.uuid AND t.deleted_at IS NULL AND t.status = 'terverifikasi') AS tindak_lanjut_terverifikasi,
              l.ditutup_pada
         FROM mutu_ikp_laporan l LEFT JOIN lokasi un ON un.uuid = l.unit_uuid
         LEFT JOIN mutu_ikp_investigasi i ON i.laporan_uuid = l.uuid AND i.deleted_at IS NULL
        WHERE l.faskes_uuid = $1 AND l.deleted_at IS NULL AND l.waktu_kejadian >= $2 AND l.waktu_kejadian < $3
          AND ($4::varchar IS NULL OR l.unit_uuid = $4) AND ($5::varchar IS NULL OR l.jenis_insiden = $5)
        ORDER BY l.waktu_kejadian`,
      [f, awal, akhir, unit, jenis],
    );
    await transaksi((k) => auditIkp(k, req, "ikp_ekspor", f, "ekspor", null, { dari: bulan[0], sampai: bulan[bulan.length - 1], unit_uuid: unit, jenis_insiden: jenis, jumlah: baris.length }));
    kirim(res, { periode: { dari: bulan[0], sampai: bulan[bulan.length - 1] }, format: "internal", baris });
  }),
);

rute.use(laporan);
rute.use(proses);
rute.use(risiko);

export default rute;
