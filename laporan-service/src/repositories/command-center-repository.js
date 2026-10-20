import { QueryTypes } from "sequelize"
import sequelizeInstance from "../config/sequelize-db.js"

// Kueri Command Center (STD-0037). Aturan bersama:
// - cakupan selalu `faskes_uuid = :f` dengan :f dari JWT (service), tidak pernah dari parameter klien;
// - hanya kolom agregat (COUNT/AVG/MAX) yang dipilih: tidak ada nama, No. RM, NIK, atau uuid pasien pada hasil;
// - "hari ini" = [:awal, :akhir] epoch detik tanggal lokal (zona laporan), :now = waktu permintaan;
// - baris terhapus (deleted_at) dan kunjungan batal (status 0) tidak dihitung.
// Definisi lengkap tiap indikator ada di helpers/command-center.js.
const pilih = (sql, replacements, transaction) => sequelizeInstance.query(sql, { replacements, type: QueryTypes.SELECT, transaction })
const satu = async (sql, replacements) => (await pilih(sql, replacements))[0] ?? {}

const TERISI = `(rm.patient_uuid IS NOT NULL OR lower(trim(COALESCE(rm.status_operasional, ''))) = 'penuh')`
const KOSONG = `(rm.patient_uuid IS NULL AND lower(trim(COALESCE(rm.status_operasional, 'tersedia'))) IN ('tersedia', ''))`

export default class CommandCenterRepository {
  // Fitur katalog `command_center` aktif untuk faskes (pola laporan-service/src/virtual-office/akses.js).
  static async fiturAktif(faskes) {
    const [baris] = await pilih(
      `SELECT 1 AS ada FROM ref_fitur f
         LEFT JOIN faskes_segmen s ON s.faskes_uuid = :f
         LEFT JOIN faskes_fitur_override o ON o.faskes_uuid = :f AND o.fitur_kode = f.kode
        WHERE f.kode = 'command_center' AND f.tersedia = true
          AND (f.wajib = true OR COALESCE(o.aktif, NOT EXISTS (
            SELECT 1 FROM preset_segmen_fitur_mati p WHERE p.segmen_kode = s.segmen_kode AND p.fitur_kode = f.kode)))`,
      { f: faskes }
    )
    return Boolean(baris)
  }

  // Bed per ruangan (posisi saat ini). Ruangan nonaktif/terhapus tidak dihitung.
  static async tempatTidur({ f }) {
    return pilih(
      `SELECT rm.room_uuid AS ruangan_uuid,
              COALESCE(r.name, l.name, 'Tanpa ruangan') AS ruangan,
              r.kelas_ruangan AS kelas_kode,
              l.class_name AS kelas_nama,
              COUNT(*) FILTER (WHERE rm.type = 'Bed')::int AS total,
              COUNT(*) FILTER (WHERE rm.type = 'Bed' AND ${TERISI})::int AS terisi,
              COUNT(*) FILTER (WHERE rm.type = 'Bed' AND NOT ${TERISI} AND ${KOSONG})::int AS kosong,
              COUNT(*) FILTER (WHERE rm.type <> 'Bed')::int AS cadangan_total,
              COUNT(*) FILTER (WHERE rm.type <> 'Bed' AND ${TERISI})::int AS cadangan_terisi
         FROM room_monitorings rm
         LEFT JOIN ruangan r ON r.uuid = rm.room_uuid
         LEFT JOIN lokasi l ON l.uuid = rm.room_uuid
        WHERE rm.faskes_uuid = :f AND rm.deleted_at IS NULL AND COALESCE(rm.status, true) = true
          AND r.deleted_at IS NULL AND COALESCE(r.status, true) = true
        GROUP BY rm.room_uuid, r.name, l.name, r.kelas_ruangan, l.class_name
        ORDER BY 2`,
      { f }
    )
  }

  // Kunjungan rawat inap aktif: dirawat (status_ri 3) dan menunggu kamar (status_ri 1) per asal kunjungan.
  static async rawatInap({ f, now }) {
    return satu(
      `SELECT COUNT(*) FILTER (WHERE status_ri = 3)::int AS dirawat,
              COUNT(*) FILTER (WHERE status_ri = 1)::int AS menunggu_kamar,
              COUNT(*) FILTER (WHERE status_ri = 1 AND encounter = 'IGD')::int AS menunggu_kamar_igd,
              MAX(GREATEST(:now - created_at, 0) / 60.0) FILTER (WHERE status_ri = 1 AND encounter = 'IGD') AS menunggu_kamar_igd_terlama_menit,
              AVG(GREATEST(:now - created_at, 0) / 60.0) FILTER (WHERE status_ri = 1 AND encounter = 'IGD') AS menunggu_kamar_igd_rata_menit
         FROM rawat_inaps
        WHERE faskes_uuid = :f AND deleted_at IS NULL AND status_ri IN (1, 3)`,
      { f, now }
    )
  }

  static async igd({ f, awal, akhir, now }) {
    return satu(
      `SELECT COUNT(*) FILTER (WHERE status_igd = 1)::int AS dirawat,
              COUNT(*) FILTER (WHERE tanggal_daftar BETWEEN :awal AND :akhir)::int AS kedatangan_hari_ini,
              COUNT(*) FILTER (WHERE status_igd = 2 AND discharge_date BETWEEN :awal AND :akhir)::int AS keluar_hari_ini,
              AVG(GREATEST(:now - tanggal_daftar, 0) / 60.0) FILTER (WHERE status_igd = 1) AS rata_lama_dirawat_menit,
              MAX(GREATEST(:now - tanggal_daftar, 0) / 60.0) FILTER (WHERE status_igd = 1) AS terlama_dirawat_menit,
              AVG((discharge_date - tanggal_daftar) / 60.0) FILTER (
                WHERE status_igd = 2 AND discharge_date BETWEEN :awal AND :akhir AND discharge_date >= tanggal_daftar
              ) AS rata_lama_keluar_menit
         FROM instalasi_gawat_darurats
        WHERE faskes_uuid = :f AND deleted_at IS NULL AND status_igd <> 0
          AND (status_igd = 1 OR tanggal_daftar BETWEEN :awal AND :akhir OR discharge_date BETWEEN :awal AND :akhir)`,
      { f, awal, akhir, now }
    )
  }

  // Kedatangan IGD hari ini per jam lokal (0–23) untuk grafik.
  static async kedatanganIgdPerJam({ f, awal, akhir, zona }) {
    return pilih(
      `SELECT EXTRACT(HOUR FROM to_timestamp(tanggal_daftar) AT TIME ZONE :zona)::int AS jam, COUNT(*)::int AS jumlah
         FROM instalasi_gawat_darurats
        WHERE faskes_uuid = :f AND deleted_at IS NULL AND status_igd <> 0 AND tanggal_daftar BETWEEN :awal AND :akhir
        GROUP BY 1 ORDER BY 1`,
      { f, awal, akhir, zona }
    )
  }

  static async antreanPoli({ f, awal, akhir, now }) {
    const mulaiTunggu = `COALESCE(x.tanggal_checkin, x.tanggal_daftar)`
    const tunggu = `((x.tanggal_periksa - ${mulaiTunggu}) / 60.0)`
    const diperiksa = `x.status_rj IN (4, 5) AND x.tanggal_periksa IS NOT NULL AND ${tunggu} BETWEEN 0 AND 1440`
    return pilih(
      `SELECT x.lokasi_uuid AS poli_uuid,
              COALESCE(l.name, 'Tanpa poli') AS poli,
              COUNT(*) FILTER (WHERE x.status_rj = 1)::int AS booking,
              COUNT(*) FILTER (WHERE x.status_rj IN (2, 3))::int AS menunggu,
              COUNT(*) FILTER (WHERE x.status_rj = 4)::int AS dilayani,
              COUNT(*) FILTER (WHERE x.status_rj = 5)::int AS selesai,
              AVG(${tunggu}) FILTER (WHERE ${diperiksa}) AS rata_tunggu_menit,
              COUNT(*) FILTER (WHERE ${diperiksa})::int AS sampel_tunggu,
              MAX(GREATEST(:now - ${mulaiTunggu}, 0) / 60.0) FILTER (WHERE x.status_rj IN (2, 3)) AS terlama_menunggu_menit
         FROM rawat_jalans x
         LEFT JOIN lokasi l ON l.uuid = x.lokasi_uuid
        WHERE x.faskes_uuid = :f AND x.deleted_at IS NULL AND COALESCE(x.status_rj, -1) <> 0
          AND COALESCE(x.jadwal_periksa, x.tanggal_daftar) BETWEEN :awal AND :akhir
        GROUP BY x.lokasi_uuid, l.name
        ORDER BY 4 DESC, 2`,
      { f, awal, akhir, now }
    )
  }

  static async antreanAdmisi({ f, awal, akhir, now }) {
    return satu(
      `SELECT COUNT(*) FILTER (WHERE COALESCE(a.status_panggilan, 0) = 0)::int AS menunggu,
              COUNT(*) FILTER (WHERE a.status_panggilan IN (1, 3))::int AS dilayani,
              COUNT(*) FILTER (WHERE a.status_panggilan = 2)::int AS terlewat,
              COUNT(*) FILTER (WHERE a.status_panggilan = 4)::int AS selesai,
              AVG(GREATEST(:now - a.created_at, 0) / 60.0) FILTER (WHERE COALESCE(a.status_panggilan, 0) = 0) AS rata_menunggu_menit,
              MAX(GREATEST(:now - a.created_at, 0) / 60.0) FILTER (WHERE COALESCE(a.status_panggilan, 0) = 0) AS terlama_menunggu_menit
         FROM antrian a
         JOIN rawat_jalans x ON x.uuid = a.rawat_jalan_uuid AND x.deleted_at IS NULL AND COALESCE(x.status_rj, -1) <> 0
        WHERE a.faskes_uuid = :f AND a.deleted_at IS NULL AND a.pelayanan = 'admisi'
          AND COALESCE(x.jadwal_periksa, x.tanggal_daftar) BETWEEN :awal AND :akhir`,
      { f, awal, akhir, now }
    )
  }

  // ── Ambang (tabel command_center_ambang) ──
  static async daftarAmbang(f) {
    return pilih(
      `SELECT kode, operator, batas_peringatan::float AS batas_peringatan, batas_kritis::float AS batas_kritis, aktif,
              diubah_oleh, updated_at
         FROM command_center_ambang WHERE faskes_uuid = :f AND deleted_at IS NULL ORDER BY kode`,
      { f }
    )
  }

  // Upsert per kode; tanpa batas peringatan & kritis = ambang dihapus (soft delete).
  static async simpanAmbang(f, daftar, username, buatUuid) {
    const sekarang = Math.floor(Date.now() / 1000)
    return sequelizeInstance.transaction(async (transaction) => {
      for (const a of daftar) {
        const [ada] = await pilih(
          `SELECT uuid FROM command_center_ambang WHERE faskes_uuid = :f AND kode = :k AND deleted_at IS NULL FOR UPDATE`,
          { f, k: a.kode }, transaction
        )
        const kosong = a.batas_peringatan === null && a.batas_kritis === null
        if (kosong) {
          if (ada) {
            await sequelizeInstance.query(
              `UPDATE command_center_ambang SET deleted_at = :n, updated_at = :n, diubah_oleh = :u WHERE uuid = :id`,
              { replacements: { n: sekarang, u: username, id: ada.uuid }, transaction }
            )
          }
          continue
        }
        const nilai = { f, k: a.kode, op: a.operator, bp: a.batas_peringatan, bk: a.batas_kritis, aktif: a.aktif, u: username, n: sekarang }
        if (ada) {
          await sequelizeInstance.query(
            `UPDATE command_center_ambang SET operator = :op, batas_peringatan = :bp, batas_kritis = :bk, aktif = :aktif,
                    diubah_oleh = :u, updated_at = :n WHERE uuid = :id`,
            { replacements: { ...nilai, id: ada.uuid }, transaction }
          )
        } else {
          await sequelizeInstance.query(
            `INSERT INTO command_center_ambang (uuid, faskes_uuid, kode, operator, batas_peringatan, batas_kritis, aktif, diubah_oleh, created_at, updated_at)
             VALUES (:id, :f, :k, :op, :bp, :bk, :aktif, :u, :n, :n)`,
            { replacements: { ...nilai, id: buatUuid() }, transaction }
          )
        }
      }
    })
  }

  // ── Peringatan (tabel command_center_peringatan) ──
  // Sinkronkan hasil evaluasi ambang: buka/perbarui peringatan yang dilanggar, tutup (selesai_pada) peringatan aktif
  // yang kodenya dievaluasi tetapi tidak lagi dilanggar. Kode dari sumber yang gagal tidak disentuh.
  // Indeks unik parsial (faskes_uuid, kunci) WHERE selesai_pada IS NULL menjaga satu peringatan aktif per kunci
  // walaupun beberapa layar melakukan polling bersamaan.
  static async sinkronPeringatan(f, pelanggaran, kodeDievaluasi, buatUuid) {
    const n = Math.floor(Date.now() / 1000)
    if (!kodeDievaluasi.length) return
    await sequelizeInstance.transaction(async (transaction) => {
      for (const p of pelanggaran) {
        await sequelizeInstance.query(
          `INSERT INTO command_center_peringatan
             (uuid, faskes_uuid, kunci, kode, sasaran_uuid, sasaran_label, tingkat, operator, batas, satuan, nilai_awal, nilai_terakhir,
              status, mulai_pada, terdeteksi_pada, created_at, updated_at)
           VALUES (:id, :f, :kunci, :kode, :su, :sl, :tingkat, :op, :batas, :satuan, :nilai, :nilai, 'aktif', :n, :n, :n, :n)
           ON CONFLICT (faskes_uuid, kunci) WHERE selesai_pada IS NULL AND deleted_at IS NULL DO UPDATE SET
             nilai_terakhir = EXCLUDED.nilai_terakhir,
             sasaran_label = EXCLUDED.sasaran_label,
             operator = EXCLUDED.operator,
             batas = EXCLUDED.batas,
             status = CASE WHEN command_center_peringatan.tingkat = 'peringatan' AND EXCLUDED.tingkat = 'kritis'
                           THEN 'aktif' ELSE command_center_peringatan.status END,
             tingkat = EXCLUDED.tingkat,
             terdeteksi_pada = EXCLUDED.terdeteksi_pada,
             updated_at = EXCLUDED.updated_at`,
          {
            replacements: {
              id: buatUuid(), f, kunci: p.kunci, kode: p.kode, su: p.sasaran_uuid, sl: p.sasaran_label, tingkat: p.tingkat,
              op: p.operator, batas: p.batas, satuan: p.satuan, nilai: p.nilai, n,
            },
            transaction,
          }
        )
      }
      const aktif = pelanggaran.map((p) => p.kunci)
      await sequelizeInstance.query(
        `UPDATE command_center_peringatan SET selesai_pada = :n, updated_at = :n
          WHERE faskes_uuid = :f AND selesai_pada IS NULL AND deleted_at IS NULL AND kode IN (:kode)
            ${aktif.length ? "AND kunci NOT IN (:aktif)" : ""}`,
        { replacements: { f, n, kode: kodeDievaluasi, aktif }, transaction }
      )
    })
  }

  static async daftarPeringatan(f, { aktif = true, batas = 50 } = {}) {
    return pilih(
      `SELECT uuid, kode, sasaran_label, tingkat, operator, batas::float AS batas, satuan, nilai_awal::float AS nilai_awal,
              nilai_terakhir::float AS nilai_terakhir, status, mulai_pada, terdeteksi_pada, selesai_pada,
              ditinjau_oleh, ditinjau_pada, dieskalasi_oleh, dieskalasi_pada
         FROM command_center_peringatan
        WHERE faskes_uuid = :f AND deleted_at IS NULL AND ${aktif ? "selesai_pada IS NULL" : "selesai_pada IS NOT NULL"}
        ORDER BY ${aktif ? "CASE tingkat WHEN 'kritis' THEN 0 ELSE 1 END, mulai_pada" : "selesai_pada DESC"}
        LIMIT :batas`,
      { f, batas }
    )
  }

  static async tindakanPeringatan(f, daftarUuid) {
    if (!daftarUuid.length) return []
    return pilih(
      `SELECT uuid, peringatan_uuid, jenis, catatan, tujuan, petugas, created_at
         FROM command_center_tindakan
        WHERE faskes_uuid = :f AND deleted_at IS NULL AND peringatan_uuid IN (:u)
        ORDER BY created_at DESC, uuid DESC`,
      { f, u: daftarUuid }
    )
  }

  // Catat tinjauan/eskalasi dalam satu transaksi: baris tindakan (jejak audit) + status peringatan.
  // null = peringatan tidak ditemukan pada faskes token; "selesai" = peringatan sudah ditutup.
  static async catatTindakan(f, peringatanUuid, tindakan, hitungStatus) {
    const n = Math.floor(Date.now() / 1000)
    return sequelizeInstance.transaction(async (transaction) => {
      const [p] = await pilih(
        `SELECT uuid, status, selesai_pada FROM command_center_peringatan
          WHERE uuid = :u AND faskes_uuid = :f AND deleted_at IS NULL FOR UPDATE`,
        { u: peringatanUuid, f }, transaction
      )
      if (!p) return null
      if (p.selesai_pada) return "selesai"
      const status = hitungStatus(p.status, tindakan.jenis)
      await sequelizeInstance.query(
        `INSERT INTO command_center_tindakan (uuid, faskes_uuid, peringatan_uuid, jenis, catatan, tujuan, petugas, petugas_uuid, created_at)
         VALUES (:id, :f, :p, :jenis, :catatan, :tujuan, :petugas, :pu, :n)`,
        {
          replacements: {
            id: tindakan.uuid, f, p: peringatanUuid, jenis: tindakan.jenis, catatan: tindakan.catatan, tujuan: tindakan.tujuan ?? null,
            petugas: tindakan.petugas, pu: tindakan.petugas_uuid ?? null, n,
          },
          transaction,
        }
      )
      const kolom = tindakan.jenis === "eskalasi" ? "dieskalasi" : "ditinjau"
      await sequelizeInstance.query(
        `UPDATE command_center_peringatan SET status = :status, ${kolom}_oleh = :petugas, ${kolom}_pada = :n, updated_at = :n WHERE uuid = :u`,
        { replacements: { status, petugas: tindakan.petugas, n, u: peringatanUuid }, transaction }
      )
      return { uuid: peringatanUuid, status, pada: n }
    })
  }
}
