import express from "express";
import { query, satu, sisipkan } from "../db.js";
import { tangani, kirim, permintaanSalah } from "../umum/respons.js";
import { JENIS_LAPORAN, cekPilihan, tanggalValid, tglLokal } from "./bersama.js";
import { bolehLihatReaktif, pastikanIzin } from "../umum/izin.js";

// Pelaporan UTD: rekap donor, produksi, uji saring, distribusi & pemusnahan per periode (KF-33..37). Setiap
// pembentukan laporan dicatat di utd_pelaporan_log agar dapat ditelusuri ke transaksi sumber (KT-16).
const rute = express.Router();

const periode = (q) => {
  if (!q.periode_awal || !q.periode_akhir) throw permintaanSalah("periode_awal dan periode_akhir wajib diisi (YYYY-MM-DD)");
  const awal = tanggalValid(q.periode_awal, "periode_awal");
  const akhir = tanggalValid(q.periode_akhir, "periode_akhir");
  if (akhir < awal) throw permintaanSalah("periode_akhir tidak boleh sebelum periode_awal");
  return { awal, akhir };
};

const rekapDonor = async (faskes, awal, akhir) =>
  satu(
    `SELECT COUNT(*)::int AS jumlah_kunjungan, COUNT(*) FILTER (WHERE status = 'layak')::int AS layak,
            COUNT(*) FILTER (WHERE status = 'tunda')::int AS tunda, COUNT(*) FILTER (WHERE status = 'tolak')::int AS tolak,
            COUNT(*) FILTER (WHERE status = 'proses')::int AS proses, COUNT(DISTINCT donor_uuid)::int AS jumlah_donor
       FROM utd_donor_riwayat WHERE faskes_uuid = $1 AND deleted_at IS NULL AND ${tglLokal("created_at")} BETWEEN $2 AND $3`,
    [faskes, awal, akhir],
  );

const rekapProduksi = async (faskes, awal, akhir) => {
  const [aftap, komponen] = await Promise.all([
    satu(
      `SELECT COUNT(*)::int AS jumlah_aftap, COALESCE(SUM(volume_ml), 0)::int AS total_volume_ml,
              COUNT(*) FILTER (WHERE reaksi_donor <> 'tidak_ada')::int AS jumlah_reaksi
         FROM utd_aftap WHERE faskes_uuid = $1 AND deleted_at IS NULL AND ${tglLokal("created_at")} BETWEEN $2 AND $3`,
      [faskes, awal, akhir],
    ),
    query(
      `SELECT jenis_komponen, COUNT(*)::int AS jumlah FROM utd_komponen
        WHERE faskes_uuid = $1 AND deleted_at IS NULL AND ${tglLokal("created_at")} BETWEEN $2 AND $3
        GROUP BY jenis_komponen ORDER BY jenis_komponen`,
      [faskes, awal, akhir],
    ),
  ]);
  return { ...aftap, per_jenis_komponen: komponen };
};

const rekapUjiSaring = async (faskes, awal, akhir) => {
  const parameter = ["hiv", "hbsag", "hcv", "sifilis"]
    .map((p) => `COUNT(*) FILTER (WHERE ${p}_hasil = 'reaktif')::int AS ${p}_reaktif, COUNT(*) FILTER (WHERE ${p}_hasil = 'non_reaktif')::int AS ${p}_non_reaktif`)
    .join(", ");
  return satu(
    `SELECT COUNT(*)::int AS jumlah_diperiksa, COUNT(*) FILTER (WHERE status_akhir = 'reaktif')::int AS jumlah_reaktif,
            COUNT(*) FILTER (WHERE status_akhir = 'non_reaktif')::int AS jumlah_non_reaktif,
            COUNT(*) FILTER (WHERE status_akhir = 'pending')::int AS jumlah_pending, ${parameter}
       FROM utd_imltd WHERE faskes_uuid = $1 AND deleted_at IS NULL AND ${tglLokal("created_at")} BETWEEN $2 AND $3`,
    [faskes, awal, akhir],
  );
};

const rekapDistribusi = async (faskes, awal, akhir) => {
  const [distribusi, pemusnahan] = await Promise.all([
    query(
      `SELECT status, COUNT(*)::int AS jumlah FROM utd_distribusi
        WHERE faskes_uuid = $1 AND deleted_at IS NULL AND ${tglLokal("created_at")} BETWEEN $2 AND $3 GROUP BY status`,
      [faskes, awal, akhir],
    ),
    query(
      `SELECT alasan, COUNT(*)::int AS jumlah FROM utd_pemusnahan
        WHERE faskes_uuid = $1 AND deleted_at IS NULL AND ${tglLokal("created_at")} BETWEEN $2 AND $3 GROUP BY alasan`,
      [faskes, awal, akhir],
    ),
  ]);
  return { per_status_distribusi: distribusi, per_alasan_pemusnahan: pemusnahan };
};

// Susun hasil laporan sesuai jenis; "uji_saring" dan bagian uji saring pada "bulanan" memerlukan izin Lihat Hasil Reaktif.
const susunLaporan = async (req, jenis, awal, akhir) => {
  const faskes = req.author.faskesUuid;
  if (jenis === "donor") return { donor: await rekapDonor(faskes, awal, akhir) };
  if (jenis === "produksi") return { produksi: await rekapProduksi(faskes, awal, akhir) };
  if (jenis === "uji_saring") {
    await pastikanIzin(req, "UTD", "Lihat Hasil Reaktif", "READ");
    return { uji_saring: await rekapUjiSaring(faskes, awal, akhir) };
  }
  if (jenis === "distribusi" || jenis === "pemusnahan") return rekapDistribusi(faskes, awal, akhir);
  // bulanan: gabungan lengkap; bagian uji saring disertakan hanya bila berizin, selain itu diberi catatan.
  const bolehReaktif = await bolehLihatReaktif(req);
  const [donor, produksi, distribusi] = await Promise.all([rekapDonor(faskes, awal, akhir), rekapProduksi(faskes, awal, akhir), rekapDistribusi(faskes, awal, akhir)]);
  return {
    donor, produksi, ...distribusi,
    uji_saring: bolehReaktif ? await rekapUjiSaring(faskes, awal, akhir) : null,
    uji_saring_disembunyikan: !bolehReaktif,
  };
};

rute.get(
  "/",
  tangani(async (req, res) => {
    const jenis = cekPilihan(req.query.jenis, JENIS_LAPORAN, "jenis");
    if (!jenis) throw permintaanSalah("jenis wajib diisi");
    const { awal, akhir } = periode(req.query);
    kirim(res, { jenis, periode_awal: awal, periode_akhir: akhir, ...(await susunLaporan(req, jenis, awal, akhir)) });
  }),
);

// Membentuk & mencatat laporan (KF-37): hasil sama dengan GET, ditambah jejak pembentukan yang tersimpan.
rute.post(
  "/",
  tangani(async (req, res) => {
    const jenis = cekPilihan(req.body?.jenis, JENIS_LAPORAN, "jenis");
    if (!jenis) throw permintaanSalah("jenis wajib diisi");
    const { awal, akhir } = periode(req.body ?? {});
    const faskes = req.author.faskesUuid;
    const data = await susunLaporan(req, jenis, awal, akhir);
    const log = await sisipkan("utd_pelaporan_log", {
      faskes_uuid: faskes, jenis_laporan: jenis,
      periode_awal: Math.floor(new Date(`${awal}T00:00:00Z`).getTime() / 1000),
      periode_akhir: Math.floor(new Date(`${akhir}T23:59:59Z`).getTime() / 1000),
      parameter: { periode_awal: awal, periode_akhir: akhir }, dibuat_oleh: req.author.username ?? null,
    });
    kirim(res, { jenis, periode_awal: awal, periode_akhir: akhir, log, ...data }, `Laporan ${JENIS_LAPORAN[jenis]} terbentuk`);
  }),
);

rute.get(
  "/riwayat",
  tangani(async (req, res) => {
    const rows = await query(
      `SELECT * FROM utd_pelaporan_log WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 100`,
      [req.author.faskesUuid],
    );
    kirim(res, rows);
  }),
);

export default rute;
