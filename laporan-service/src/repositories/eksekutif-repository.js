import { QueryTypes } from "sequelize"
import sequelizeInstance from "../config/sequelize-db.js"
import { dateToEpoch, endOfDateToEpoch } from "../helpers/date-helper.js"
import { ZONA_WAKTU } from "../helpers/indikator-eksekutif.js"

// Kueri agregat Dashboard Eksekutif (STD-0034). Aturan bersama:
// - cakupan faskes selalu `faskes_uuid IN (:faskes)`; daftar faskes ditentukan service dari JWT (bukan dari klien);
// - periode: tanggal YYYY-MM-DD dibaca sebagai tanggal lokal (WIB) → epoch detik [awal 00:00:00, akhir 23:59:59];
//   pengelompokan per hari/bulan memakai `AT TIME ZONE` zona laporan;
// - hanya kolom agregat yang dipilih: tidak ada nama/No. RM/NIK pasien pada hasil kueri mana pun;
// - kunjungan batal (status 0) dan baris terhapus (deleted_at) tidak dihitung.
const pilih = (sql, replacements) => sequelizeInstance.query(sql, { replacements, type: QueryTypes.SELECT })
const satu = async (sql, replacements) => (await pilih(sql, replacements))[0] ?? {}

const rentang = ({ faskes, mulai, selesai }) => ({
  faskes,
  mulai,
  selesai,
  awal: dateToEpoch(mulai),
  akhir: endOfDateToEpoch(selesai),
  zona: ZONA_WAKTU,
})

// Tanggal lokal dari kolom epoch detik.
const tanggalLokal = (kolom) => `(to_timestamp(${kolom}) AT TIME ZONE :zona)::date`

// Sumber kunjungan per jenis layanan. `waktu` = kolom penentu periode.
const SUMBER_KUNJUNGAN = {
  kunjungan_rj: { tabel: "rawat_jalans", status: "status_rj", waktu: "x.tanggal_daftar" },
  kunjungan_igd: { tabel: "instalasi_gawat_darurats", status: "status_igd", waktu: "x.tanggal_daftar" },
  kunjungan_ri: { tabel: "rawat_inaps", status: "status_ri", waktu: "COALESCE(x.tanggal_dirawat, x.tanggal_daftar)" },
}
const filterKunjungan = (s) =>
  `x.faskes_uuid IN (:faskes) AND x.deleted_at IS NULL AND COALESCE(x.${s.status}, -1) <> 0 AND ${s.waktu} BETWEEN :awal AND :akhir`

// Bed siap pakai (TT): tipe "Bed" aktif; bed cadangan & box bayi tidak dihitung (posisi saat ini).
const SQL_TT = `SELECT COUNT(*)::int AS tt FROM room_monitorings
  WHERE faskes_uuid IN (:faskes) AND deleted_at IS NULL AND COALESCE(status, true) = true AND type = 'Bed'`

const STATUS_MATI = `('exp-lt48h', 'exp-gt48h')`

export default class EksekutifRepository {
  static async faskesAda(daftarUuid) {
    if (!daftarUuid.length) return []
    return pilih(`SELECT uuid, name FROM faskes WHERE uuid IN (:u) AND deleted_at IS NULL ORDER BY name`, { u: daftarUuid })
  }

  static async kunjungan(p) {
    const r = rentang(p)
    const hitung = (kode) => {
      const s = SUMBER_KUNJUNGAN[kode]
      return `(SELECT COUNT(*)::int FROM ${s.tabel} x WHERE ${filterKunjungan(s)})`
    }
    return satu(
      `SELECT ${hitung("kunjungan_rj")} AS kunjungan_rj, ${hitung("kunjungan_ri")} AS kunjungan_ri, ${hitung("kunjungan_igd")} AS kunjungan_igd`,
      r
    )
  }

  // Komponen Barber-Johnson untuk periode (lihat helpers/indikator-eksekutif.js).
  static async komponenRawatInap(p) {
    const r = rentang(p)
    const dalamPeriode = `keluar BETWEEN CAST(:mulai AS date) AND CAST(:selesai AS date) AND keluar >= masuk`
    const baris = await satu(
      `WITH ri AS (
         SELECT ${tanggalLokal("COALESCE(r.tanggal_dirawat, r.tanggal_daftar)")} AS masuk,
                CASE WHEN r.discharge_date IS NOT NULL THEN ${tanggalLokal("r.discharge_date")} END AS keluar,
                r.status_pulang
           FROM rawat_inaps r
          WHERE r.faskes_uuid IN (:faskes) AND r.deleted_at IS NULL AND COALESCE(r.status_ri, -1) <> 0
            AND COALESCE(r.box_baby, false) = false
            AND COALESCE(r.tanggal_dirawat, r.tanggal_daftar) <= :akhir
            AND (r.discharge_date IS NULL OR r.discharge_date >= :awal)
       )
       SELECT
         COALESCE(SUM(CASE
           WHEN keluar = masuk THEN CASE WHEN masuk BETWEEN CAST(:mulai AS date) AND CAST(:selesai AS date) THEN 1 ELSE 0 END
           ELSE GREATEST(0, LEAST(COALESCE(keluar, CAST(:selesai AS date) + 1), CAST(:selesai AS date) + 1) - GREATEST(masuk, CAST(:mulai AS date)))
         END), 0)::int AS hari_perawatan,
         COUNT(*) FILTER (WHERE ${dalamPeriode})::int AS keluar,
         COALESCE(SUM(GREATEST(keluar - masuk, 1)) FILTER (WHERE ${dalamPeriode}), 0)::int AS lama_dirawat,
         COUNT(*) FILTER (WHERE ${dalamPeriode} AND status_pulang IN ${STATUS_MATI})::int AS mati,
         COUNT(*) FILTER (WHERE ${dalamPeriode} AND status_pulang = 'exp-gt48h')::int AS mati_48
       FROM ri`,
      r
    )
    const { tt } = await satu(SQL_TT, r)
    return { ...baris, tempat_tidur: tt }
  }

  static async waktuTunggu(p) {
    return satu(
      `WITH w AS (
         SELECT (x.tanggal_periksa - COALESCE(x.tanggal_checkin, x.tanggal_daftar)) / 60.0 AS menit
           FROM rawat_jalans x
          WHERE ${filterKunjungan(SUMBER_KUNJUNGAN.kunjungan_rj)} AND x.tanggal_periksa IS NOT NULL
       )
       SELECT COUNT(*) FILTER (WHERE menit BETWEEN 0 AND 1440)::int AS sampel,
              AVG(menit) FILTER (WHERE menit BETWEEN 0 AND 1440) AS rata_rata,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY menit) FILTER (WHERE menit BETWEEN 0 AND 1440) AS median,
              COUNT(*) FILTER (WHERE menit BETWEEN 0 AND 60)::int AS dalam_60_menit,
              COUNT(*) FILTER (WHERE NOT (menit BETWEEN 0 AND 1440))::int AS diabaikan
         FROM w`,
      rentang(p)
    )
  }

  static async keuangan(p) {
    const r = rentang(p)
    const [tagihan, kas, unit, penjamin] = await Promise.all([
      satu(
        `WITH b AS (
           SELECT b.grand_total, b.status,
                  (SELECT COALESCE(SUM(ph.amount), 0) FROM payment_history ph WHERE ph.bill_uuid = b.uuid AND ph.deleted_at IS NULL) AS dibayar
             FROM bills b
            WHERE b.faskes_uuid IN (:faskes) AND b.deleted_at IS NULL AND b.created_at BETWEEN :awal AND :akhir
         )
         SELECT COUNT(*)::int AS jumlah_tagihan, COALESCE(SUM(grand_total), 0)::float AS pendapatan,
                COALESCE(SUM(GREATEST(COALESCE(grand_total, 0) - dibayar, 0)) FILTER (WHERE COALESCE(status, false) = false), 0)::float AS piutang,
                COUNT(*) FILTER (WHERE COALESCE(status, false) = false)::int AS tagihan_belum_lunas
           FROM b`,
        r
      ),
      satu(
        `SELECT COALESCE(SUM(ph.amount), 0)::float AS kas_diterima, COUNT(*)::int AS jumlah_pembayaran
           FROM payment_history ph
          WHERE ph.faskes_uuid IN (:faskes) AND ph.deleted_at IS NULL AND ph.created_at BETWEEN :awal AND :akhir`,
        r
      ),
      EksekutifRepository.pendapatanPer("unit", p),
      EksekutifRepository.pendapatanPer("penjamin", p),
    ])
    return { ...tagihan, ...kas, per_unit: unit, per_penjamin: penjamin }
  }

  // Rincian layanan tagihan (service_bill) per unit/penjamin. Nilai kotor per layanan sebelum diskon/voucher tingkat
  // tagihan, sehingga jumlahnya dapat berbeda dari pendapatan (grand total tagihan).
  static async pendapatanPer(dimensi, p) {
    const label = dimensi === "unit"
      ? `CASE sb.type::text WHEN 'RJ' THEN 'Rawat Jalan' WHEN 'RI' THEN 'Rawat Inap' WHEN 'IGD' THEN 'IGD' WHEN 'OTC' THEN 'Penjualan Bebas (OTC)'
           WHEN 'LAB' THEN 'Laboratorium' WHEN 'FISIO' THEN 'Fisioterapi' ELSE COALESCE(sb.type::text, 'Lainnya') END`
      : `CASE WHEN sb.with_insurance THEN 'Asuransi/Penjamin' ELSE 'Tunai/Umum' END`
    return pilih(
      `SELECT ${label} AS label, COALESCE(SUM(sb.grand_total), 0)::float AS nilai, COUNT(DISTINCT sb.bill_uuid)::int AS jumlah
         FROM service_bill sb JOIN bills b ON b.uuid = sb.bill_uuid
        WHERE b.faskes_uuid IN (:faskes) AND b.deleted_at IS NULL AND sb.deleted_at IS NULL AND b.created_at BETWEEN :awal AND :akhir
        GROUP BY 1 ORDER BY 2 DESC`,
      rentang(p)
    )
  }

  static async sepBpjs(p) {
    return pilih(
      `SELECT CASE s.jenis_pelayanan WHEN '1' THEN 'Rawat Inap' WHEN '2' THEN 'Rawat Jalan' ELSE COALESCE(s.jenis_pelayanan, '-') END AS label,
              COUNT(*)::int AS jumlah
         FROM bpjs_vclaim_sep s
        WHERE s.faskes_uuid IN (:faskes) AND s.status = 'aktif' AND s.tgl_sep BETWEEN CAST(:mulai AS date) AND CAST(:selesai AS date)
        GROUP BY 1 ORDER BY 1`,
      rentang(p)
    )
  }

  // Posisi saat ini (tidak bergantung periode): kesiapan akreditasi & kredensial kedaluwarsa (modul Mutu, STD-0028).
  static async mutu({ faskes, hariIni }) {
    const [kesiapan, kred] = await Promise.all([
      satu(
        `SELECT COUNT(e.uuid)::int AS total_elemen,
                COUNT(e.uuid) FILTER (WHERE EXISTS (
                  SELECT 1 FROM mutu_dokumen_elemen de JOIN mutu_dokumen d ON d.uuid = de.dokumen_uuid
                   WHERE de.elemen_uuid = e.uuid AND de.deleted_at IS NULL AND d.deleted_at IS NULL AND d.status = 'disahkan'
                     AND d.faskes_uuid = i.faskes_uuid))::int AS elemen_terbukti
           FROM mutu_instrumen i
           JOIN mutu_bab b ON b.instrumen_uuid = i.uuid AND b.deleted_at IS NULL
           JOIN mutu_standar s ON s.bab_uuid = b.uuid AND s.deleted_at IS NULL
           JOIN mutu_elemen_penilaian e ON e.standar_uuid = s.uuid AND e.deleted_at IS NULL
          WHERE i.faskes_uuid IN (:faskes) AND i.deleted_at IS NULL AND i.aktif = true`,
        { faskes }
      ),
      satu(
        `SELECT COUNT(*)::int AS kredensial_aktif,
                COUNT(*) FILTER (WHERE tanggal_berakhir IS NOT NULL AND tanggal_berakhir < :hariIni)::int AS kredensial_kedaluwarsa
           FROM mutu_kredensial WHERE faskes_uuid IN (:faskes) AND deleted_at IS NULL AND status = 'aktif'`,
        { faskes, hariIni }
      ),
    ])
    return { ...kesiapan, ...kred }
  }

  static async sdm({ faskes }) {
    const [pegawai, { tt }] = await Promise.all([
      satu(
        `SELECT COUNT(*)::int AS jumlah_pegawai,
                COUNT(*) FILTER (WHERE tipe = 1)::int AS nakes,
                COUNT(*) FILTER (WHERE tipe IS DISTINCT FROM 1)::int AS non_nakes
           FROM pegawai WHERE faskes_uuid IN (:faskes) AND deleted_at IS NULL AND COALESCE(status, true) = true`,
        { faskes }
      ),
      satu(SQL_TT, { faskes }),
    ])
    return { ...pegawai, tempat_tidur: tt }
  }

  // Tren kunjungan & pendapatan per hari/bulan (zona laporan). satuan: "day" | "month".
  static async tren(p, satuan) {
    const r = { ...rentang(p), satuan }
    const ember = (kolom) => `to_char(date_trunc(:satuan, to_timestamp(${kolom}) AT TIME ZONE :zona), 'YYYY-MM-DD')`
    const bagian = Object.entries(SUMBER_KUNJUNGAN).map(([kode, s]) =>
      `SELECT ${ember(s.waktu)} AS periode, '${kode}' AS kode, COUNT(*)::float AS nilai FROM ${s.tabel} x WHERE ${filterKunjungan(s)} GROUP BY 1`
    )
    bagian.push(
      `SELECT ${ember("b.created_at")} AS periode, 'pendapatan' AS kode, COALESCE(SUM(b.grand_total), 0)::float AS nilai
         FROM bills b WHERE b.faskes_uuid IN (:faskes) AND b.deleted_at IS NULL AND b.created_at BETWEEN :awal AND :akhir GROUP BY 1`
    )
    return pilih(`${bagian.join(" UNION ALL ")} ORDER BY periode, kode`, r)
  }

  // Rincian agregat (drill-down). Hanya label dimensi (poli, dokter, ruang, penjamin, bulan, unit) + angka agregat.
  static async rincian(kode, dimensi, p) {
    const r = rentang(p)
    const bulan = (kolom) => `to_char(to_timestamp(${kolom}) AT TIME ZONE :zona, 'YYYY-MM')`
    const penjaminKunjungan = `CASE WHEN COALESCE(x.payment_method, 1) = 1 THEN 'Tunai/Umum' ELSE 'Asuransi/Penjamin' END`
    const dokter = `COALESCE(NULLIF(TRIM(CONCAT_WS(' ', pg.first_title, pg.name, pg.last_title)), ''), 'Tanpa DPJP')`

    if (SUMBER_KUNJUNGAN[kode]) {
      const s = SUMBER_KUNJUNGAN[kode]
      const peta = {
        poli: { label: "COALESCE(l.name, 'Tanpa poli')", join: "LEFT JOIN lokasi l ON l.uuid = x.lokasi_uuid" },
        ruang: { label: "COALESCE(l.name, 'Tanpa ruang')", join: "LEFT JOIN lokasi l ON l.uuid = x.lokasi_uuid" },
        dokter: { label: dokter, join: "LEFT JOIN practitioner pr ON pr.uuid = x.practitioner_uuid LEFT JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid" },
        penjamin: { label: penjaminKunjungan, join: "" },
        bulan: { label: bulan(s.waktu), join: "" },
      }
      const d = peta[dimensi]
      return pilih(
        `SELECT ${d.label} AS label, COUNT(*)::float AS nilai FROM ${s.tabel} x ${d.join}
          WHERE ${filterKunjungan(s)} GROUP BY 1 ORDER BY ${dimensi === "bulan" ? "1" : "2 DESC, 1"}`,
        r
      )
    }
    if (kode === "waktu_tunggu_rj") {
      const s = SUMBER_KUNJUNGAN.kunjungan_rj
      const d = dimensi === "dokter"
        ? { label: dokter, join: "LEFT JOIN practitioner pr ON pr.uuid = x.practitioner_uuid LEFT JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid" }
        : { label: "COALESCE(l.name, 'Tanpa poli')", join: "LEFT JOIN lokasi l ON l.uuid = x.lokasi_uuid" }
      return pilih(
        `WITH w AS (
           SELECT ${d.label} AS label, (x.tanggal_periksa - COALESCE(x.tanggal_checkin, x.tanggal_daftar)) / 60.0 AS menit
             FROM rawat_jalans x ${d.join}
            WHERE ${filterKunjungan(s)} AND x.tanggal_periksa IS NOT NULL
         )
         SELECT label, ROUND(AVG(menit)::numeric, 1)::float AS nilai, COUNT(*)::int AS jumlah
           FROM w WHERE menit BETWEEN 0 AND 1440 GROUP BY 1 ORDER BY 2 DESC, 1`,
        r
      )
    }
    if (kode === "pendapatan") {
      if (dimensi === "bulan") {
        return pilih(
          `SELECT ${bulan("b.created_at")} AS label, COALESCE(SUM(b.grand_total), 0)::float AS nilai, COUNT(*)::int AS jumlah
             FROM bills b WHERE b.faskes_uuid IN (:faskes) AND b.deleted_at IS NULL AND b.created_at BETWEEN :awal AND :akhir
            GROUP BY 1 ORDER BY 1`,
          r
        )
      }
      return EksekutifRepository.pendapatanPer(dimensi, p)
    }
    if (kode === "kas_diterima") {
      const label = dimensi === "bulan" ? bulan("ph.created_at") : "COALESCE(ph.payment_method::text, '-')"
      return pilih(
        `SELECT ${label} AS label, COALESCE(SUM(ph.amount), 0)::float AS nilai, COUNT(*)::int AS jumlah
           FROM payment_history ph
          WHERE ph.faskes_uuid IN (:faskes) AND ph.deleted_at IS NULL AND ph.created_at BETWEEN :awal AND :akhir
          GROUP BY 1 ORDER BY ${dimensi === "bulan" ? "1" : "2 DESC"}`,
        r
      )
    }
    if (kode === "piutang") {
      const label = dimensi === "bulan"
        ? bulan("b.created_at")
        : `CASE WHEN EXISTS (SELECT 1 FROM service_bill sb WHERE sb.bill_uuid = b.uuid AND sb.with_insurance = true) THEN 'Asuransi/Penjamin' ELSE 'Tunai/Umum' END`
      return pilih(
        `SELECT ${label} AS label,
                COALESCE(SUM(GREATEST(COALESCE(b.grand_total, 0) - COALESCE((SELECT SUM(ph.amount) FROM payment_history ph WHERE ph.bill_uuid = b.uuid AND ph.deleted_at IS NULL), 0), 0)), 0)::float AS nilai,
                COUNT(*)::int AS jumlah
           FROM bills b
          WHERE b.faskes_uuid IN (:faskes) AND b.deleted_at IS NULL AND COALESCE(b.status, false) = false AND b.created_at BETWEEN :awal AND :akhir
          GROUP BY 1 ORDER BY ${dimensi === "bulan" ? "1" : "2 DESC"}`,
        r
      )
    }
    if (kode === "sep_bpjs") {
      if (dimensi === "jenis_pelayanan") return EksekutifRepository.sepBpjs(p).then((rows) => rows.map((x) => ({ label: x.label, nilai: x.jumlah })))
      return pilih(
        `SELECT to_char(s.tgl_sep, 'YYYY-MM') AS label, COUNT(*)::float AS nilai
           FROM bpjs_vclaim_sep s
          WHERE s.faskes_uuid IN (:faskes) AND s.status = 'aktif' AND s.tgl_sep BETWEEN CAST(:mulai AS date) AND CAST(:selesai AS date)
          GROUP BY 1 ORDER BY 1`,
        r
      )
    }
    if (kode === "jumlah_pegawai") {
      return pilih(
        `SELECT CASE WHEN tipe = 1 THEN 'Tenaga kesehatan' ELSE 'Non tenaga kesehatan' END AS label, COUNT(*)::float AS nilai
           FROM pegawai WHERE faskes_uuid IN (:faskes) AND deleted_at IS NULL AND COALESCE(status, true) = true
          GROUP BY 1 ORDER BY 1`,
        r
      )
    }
    return null
  }

  // Target KPI per faskes (tabel dashboard_target_kpi, migrasi 20261018240000).
  static async daftarTarget(faskesUuid) {
    return pilih(
      `SELECT kode, target_min::float AS target_min, target_maks::float AS target_maks, toleransi_persen::float AS toleransi_persen, catatan, diubah_oleh, updated_at
         FROM dashboard_target_kpi WHERE faskes_uuid = :f AND deleted_at IS NULL ORDER BY kode`,
      { f: faskesUuid }
    )
  }

  // Simpan target (upsert per kode); baris tanpa batas min & maks = target dihapus (soft delete).
  static async simpanTarget(faskesUuid, daftar, username, buatUuid) {
    const sekarang = Math.floor(Date.now() / 1000)
    return sequelizeInstance.transaction(async (transaction) => {
      for (const t of daftar) {
        const kosong = t.target_min === null && t.target_maks === null
        const [ada] = await sequelizeInstance.query(
          `SELECT uuid FROM dashboard_target_kpi WHERE faskes_uuid = :f AND kode = :k AND deleted_at IS NULL FOR UPDATE`,
          { replacements: { f: faskesUuid, k: t.kode }, type: QueryTypes.SELECT, transaction }
        )
        if (kosong) {
          if (ada) {
            await sequelizeInstance.query(
              `UPDATE dashboard_target_kpi SET deleted_at = :n, updated_at = :n, diubah_oleh = :u WHERE uuid = :id`,
              { replacements: { n: sekarang, u: username, id: ada.uuid }, transaction }
            )
          }
          continue
        }
        const nilai = { f: faskesUuid, k: t.kode, min: t.target_min, maks: t.target_maks, tol: t.toleransi_persen, c: t.catatan ?? null, u: username, n: sekarang }
        if (ada) {
          await sequelizeInstance.query(
            `UPDATE dashboard_target_kpi SET target_min = :min, target_maks = :maks, toleransi_persen = :tol, catatan = :c,
                    diubah_oleh = :u, updated_at = :n WHERE uuid = :id`,
            { replacements: { ...nilai, id: ada.uuid }, transaction }
          )
        } else {
          await sequelizeInstance.query(
            `INSERT INTO dashboard_target_kpi (uuid, faskes_uuid, kode, target_min, target_maks, toleransi_persen, catatan, diubah_oleh, created_at, updated_at)
             VALUES (:id, :f, :k, :min, :maks, :tol, :c, :u, :n, :n)`,
            { replacements: { ...nilai, id: buatUuid() }, transaction }
          )
        }
      }
    })
  }
}
