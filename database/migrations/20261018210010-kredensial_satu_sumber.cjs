'use strict';

// Tinjauan HR / SDM (STD-0035) — SATU sumber data kredensial staf. STD-0028 (Mutu & Akreditasi) sudah memiliki
// mutu_kredensial (tertaut pegawai Datamaster, berkas, cabut, jejak audit, peringatan 90/30 hari); STD-0035 membuat
// tabel kedua hr_kredensial + hr_berkas sehingga STR/SIP yang sama bisa tercatat dua kali dengan isi berbeda.
// Keputusan: mutu_kredensial menjadi satu-satunya tabel kredensial; HR / SDM › Kredensial dan Mutu › Kredensial Staf
// memakai router yang sama (penunjang-service/src/mutu/kredensial.js) dengan izin modul masing-masing.
//   1. mutu_kredensial dilengkapi kolom rancangan STD-0035: penerbit, status verifikasi (+ catatan, oleh, pada);
//      jenis ditambah sertifikat_kompetensi & lainnya (CHECK diganti, kolom diperlebar ke VARCHAR(30); jenis lama tetap
//      sah). Catatan: hr_kredensial.jenis VARCHAR(20) tidak pernah bisa menyimpan 'sertifikat_kompetensi' (galat 500).
//   2. Data hr_kredensial dipindahkan ke mutu_kredensial dengan uuid yang SAMA (ON CONFLICT DO NOTHING → idempoten):
//      kepegawaian_uuid → pegawai_uuid lewat hr_kepegawaian, tanggal_terbit → tanggal_mulai, status verifikasi ikut,
//      berkas terbaru dari hr_berkas ikut (berkas lain disebut di uraian), baris terhapus lunak tetap terhapus lunak.
//      Satu baris mutu_audit 'migrasi_sdm' per kredensial yang dipindahkan.
//   3. hr_kredensial & hr_berkas TIDAK dihapus (tidak destruktif) dan tidak lagi dipakai aplikasi; diberi COMMENT.

const BERKAS_TERBARU = `
  SELECT DISTINCT ON (b.kredensial_uuid) b.kredensial_uuid, b.data, b.nama_berkas, b.tipe_mime, b.ukuran_bita,
    COUNT(*) OVER (PARTITION BY b.kredensial_uuid) AS jumlah
  FROM hr_berkas b WHERE b.deleted_at IS NULL AND b.jenis_berkas = 'dokumen_kredensial'
  ORDER BY b.kredensial_uuid, b.created_at DESC, b.uuid DESC`;

module.exports = {
  async up(queryInterface) {
    const sq = queryInterface.sequelize;
    await sq.transaction(async (transaction) => {
      await sq.query(
        `
        ALTER TABLE mutu_kredensial ADD COLUMN IF NOT EXISTS penerbit VARCHAR(255);
        ALTER TABLE mutu_kredensial ADD COLUMN IF NOT EXISTS status_verifikasi VARCHAR(20) NOT NULL DEFAULT 'belum_diverifikasi';
        ALTER TABLE mutu_kredensial ADD COLUMN IF NOT EXISTS catatan_verifikasi TEXT;
        ALTER TABLE mutu_kredensial ADD COLUMN IF NOT EXISTS diverifikasi_oleh VARCHAR(255);
        ALTER TABLE mutu_kredensial ADD COLUMN IF NOT EXISTS diverifikasi_pada BIGINT;
        ALTER TABLE mutu_kredensial DROP CONSTRAINT IF EXISTS mutu_kredensial_status_verifikasi_check;
        ALTER TABLE mutu_kredensial ADD CONSTRAINT mutu_kredensial_status_verifikasi_check
          CHECK (status_verifikasi IN ('belum_diverifikasi', 'terverifikasi', 'ditolak'));
        ALTER TABLE mutu_kredensial DROP CONSTRAINT IF EXISTS mutu_kredensial_jenis_check;
        -- 'sertifikat_kompetensi' (21 karakter) tidak muat di VARCHAR(20): kolom diperlebar (tanpa mengubah isi).
        ALTER TABLE mutu_kredensial ALTER COLUMN jenis TYPE VARCHAR(30);
        ALTER TABLE mutu_kredensial ADD CONSTRAINT mutu_kredensial_jenis_check
          CHECK (jenis IN ('str', 'sip', 'sertifikat', 'sertifikat_kompetensi', 'rkk', 'spk', 'lainnya'));
        CREATE INDEX IF NOT EXISTS mutu_kredensial_verifikasi_idx ON mutu_kredensial (faskes_uuid, status_verifikasi) WHERE deleted_at IS NULL;
        `,
        { transaction }
      );

      const [[ada]] = await sq.query(`SELECT to_regclass('hr_kredensial') IS NOT NULL AS kredensial, to_regclass('hr_berkas') IS NOT NULL AS berkas`, { transaction });
      if (!ada.kredensial) return;
      const berkas = ada.berkas ? `LEFT JOIN (${BERKAS_TERBARU}) b ON b.kredensial_uuid = c.uuid` : '';
      const kolomBerkas = ada.berkas
        ? `b.data, CASE WHEN b.kredensial_uuid IS NULL THEN NULL
             ELSE jsonb_build_object('nama_berkas', b.nama_berkas, 'tipe_mime', b.tipe_mime, 'ukuran_bita', b.ukuran_bita) END,
           CASE WHEN b.jumlah > 1 THEN 'Dipindahkan dari HR / SDM; ' || (b.jumlah - 1) || ' berkas lama tetap tersimpan di arsip hr_berkas.' END`
        : `NULL::bytea, NULL::jsonb, NULL::text`;
      const [pindah] = await sq.query(
        `INSERT INTO mutu_kredensial (uuid, faskes_uuid, pegawai_uuid, practitioner_uuid, jenis, nomor, penerbit, uraian, tanggal_mulai,
           tanggal_berakhir, status, status_verifikasi, catatan_verifikasi, diverifikasi_oleh, diverifikasi_pada, berkas, berkas_info,
           dicatat_oleh, created_at, updated_at, deleted_at)
         SELECT c.uuid, c.faskes_uuid, h.pegawai_uuid, NULL, c.jenis, c.nomor, c.penerbit, x.uraian, c.tanggal_terbit,
           c.tanggal_berakhir, 'aktif', c.status_verifikasi, c.catatan_verifikasi, c.diverifikasi_oleh, c.diverifikasi_pada, x.berkas, x.berkas_info,
           c.dicatat_oleh, c.created_at, c.updated_at, c.deleted_at
         FROM hr_kredensial c
         JOIN hr_kepegawaian h ON h.uuid = c.kepegawaian_uuid AND h.faskes_uuid = c.faskes_uuid
         ${berkas}
         CROSS JOIN LATERAL (SELECT ${kolomBerkas.replace(/\n\s*/g, ' ')}) AS x(berkas, berkas_info, uraian)
         ON CONFLICT (uuid) DO NOTHING
         RETURNING uuid, faskes_uuid`,
        { transaction }
      );
      const n = Math.floor(Date.now() / 1000);
      for (const r of pindah) {
        await sq.query(
          `INSERT INTO mutu_audit (uuid, faskes_uuid, entitas, entitas_uuid, aksi, data_sebelum, data_sesudah, aktor, created_at, updated_at)
           SELECT :uuid, :faskes_uuid, 'kredensial', :entitas_uuid, 'migrasi_sdm', NULL, jsonb_build_object('sumber', 'hr_kredensial'), 'migrasi', :n, :n
           WHERE NOT EXISTS (SELECT 1 FROM mutu_audit WHERE entitas = 'kredensial' AND entitas_uuid = :entitas_uuid AND aksi = 'migrasi_sdm')`,
          { replacements: { uuid: `migrasi-sdm-${r.uuid}`, faskes_uuid: r.faskes_uuid, entitas_uuid: r.uuid, n }, transaction }
        );
      }
      await sq.query(
        `COMMENT ON TABLE hr_kredensial IS 'Tidak dipakai lagi sejak tinjauan STD-0035: data dipindahkan ke mutu_kredensial (satu sumber kredensial staf, migrasi 20261018210010).';
         ${ada.berkas ? `COMMENT ON TABLE hr_berkas IS 'Arsip berkas kredensial STD-0035; berkas terbaru tiap kredensial disalin ke mutu_kredensial.berkas (migrasi 20261018210010).';` : ''}`,
        { transaction }
      );
    });
  },

  async down() {
    // Tidak dikembalikan: kredensial yang dicatat setelah migrasi (termasuk jenis/verifikasi baru) hanya ada di
    // mutu_kredensial. hr_kredensial & hr_berkas tetap utuh sebagai arsip.
  },
};
