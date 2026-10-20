'use strict';

// Integritas episode perawatan intensif lintas modul (ICU, NICU, PICU, HDU) — bagian NICU.
// Fungsi intensif_cek_bentrok() dan pemicu intensif_jaga_icu pada icu_perawatans BERSAMA dengan migrasi PICU
// (integritas_episode_intensif_picu): definisinya identik sehingga urutan penerapan migrasi kedua modul tidak
// berpengaruh. Tabel modul lain diperiksa dinamis (to_regclass) agar migrasi tetap berjalan bila modul itu belum ada.
// Kunci advisory "intensif:bed:<faskes>:<bed>" dan "intensif:pasien:<faskes>:<pasien>" diambil berurutan sehingga
// penerimaan serentak di modul berbeda tidak lolos bersamaan maupun saling mengunci (deadlock).
// HDU hanya diperiksa saat penerimaan NICU/PICU; alur HDU → ICU yang sudah berjalan tidak diubah.

const SQL_BERSAMA = `
  CREATE OR REPLACE FUNCTION intensif_cek_bentrok(p_faskes VARCHAR, p_pasien VARCHAR, p_bed VARCHAR, p_modul TEXT)
  RETURNS TEXT LANGUAGE plpgsql AS $$
  DECLARE kunci TEXT; hasil TEXT;
  BEGIN
    FOR kunci IN SELECT x FROM unnest(ARRAY[
        'intensif:bed:' || p_faskes || ':' || COALESCE(p_bed, ''),
        'intensif:pasien:' || p_faskes || ':' || COALESCE(p_pasien, '')]) AS x ORDER BY x
    LOOP PERFORM pg_advisory_xact_lock(hashtextextended(kunci, 0)); END LOOP;
    IF p_modul <> 'icu' AND to_regclass('public.icu_perawatans') IS NOT NULL THEN
      EXECUTE 'SELECT ''ICU'' FROM icu_perawatans i WHERE i.faskes_uuid = $1 AND i.status = ''aktif'' AND i.deleted_at IS NULL
        AND (i.room_monitoring_uuid = $3 OR EXISTS (SELECT 1 FROM rawat_inaps r WHERE r.uuid = i.rawat_inap_uuid
          AND r.faskes_uuid = $1 AND r.patient_uuid = $2)) LIMIT 1' INTO hasil USING p_faskes, p_pasien, p_bed;
      IF hasil IS NOT NULL THEN RETURN hasil; END IF;
    END IF;
    IF p_modul <> 'nicu' AND to_regclass('public.nicu_episode') IS NOT NULL THEN
      EXECUTE 'SELECT ''NICU'' FROM nicu_episode e WHERE e.faskes_uuid = $1 AND e.status = ''aktif'' AND e.deleted_at IS NULL
        AND (e.pasien_uuid = $2 OR EXISTS (SELECT 1 FROM nicu_penempatan p JOIN nicu_tempat t ON t.uuid = p.tempat_uuid
          AND t.faskes_uuid = p.faskes_uuid WHERE p.episode_uuid = e.uuid AND p.faskes_uuid = $1 AND p.selesai_at IS NULL
          AND p.deleted_at IS NULL AND t.room_monitoring_uuid = $3)) LIMIT 1' INTO hasil USING p_faskes, p_pasien, p_bed;
      IF hasil IS NOT NULL THEN RETURN hasil; END IF;
    END IF;
    IF p_modul <> 'picu' AND to_regclass('public.picu_episode') IS NOT NULL THEN
      EXECUTE 'SELECT ''PICU'' FROM picu_episode e WHERE e.faskes_uuid = $1 AND e.status = ''aktif'' AND e.deleted_at IS NULL
        AND (e.pasien_uuid = $2 OR e.tempat_tidur_uuid = $3) LIMIT 1' INTO hasil USING p_faskes, p_pasien, p_bed;
      IF hasil IS NOT NULL THEN RETURN hasil; END IF;
    END IF;
    IF p_modul IN ('nicu', 'picu') AND to_regclass('public.hdu_episode') IS NOT NULL THEN
      EXECUTE 'SELECT ''HDU'' FROM hdu_episode e WHERE e.faskes_uuid = $1 AND e.status = ''aktif'' AND e.deleted_at IS NULL
        AND (e.pasien_uuid = $2 OR e.room_monitoring_uuid = $3) LIMIT 1' INTO hasil USING p_faskes, p_pasien, p_bed;
      IF hasil IS NOT NULL THEN RETURN hasil; END IF;
    END IF;
    RETURN NULL;
  END;
  $$;
  CREATE OR REPLACE FUNCTION intensif_jaga_icu() RETURNS trigger LANGUAGE plpgsql AS $$
  DECLARE pasien VARCHAR(255); bentrok TEXT;
  BEGIN
    IF NEW.status <> 'aktif' OR NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.status = 'aktif' AND OLD.deleted_at IS NULL
      AND OLD.room_monitoring_uuid IS NOT DISTINCT FROM NEW.room_monitoring_uuid
      AND OLD.rawat_inap_uuid IS NOT DISTINCT FROM NEW.rawat_inap_uuid THEN RETURN NEW; END IF;
    SELECT r.patient_uuid INTO pasien FROM rawat_inaps r WHERE r.uuid = NEW.rawat_inap_uuid AND r.faskes_uuid = NEW.faskes_uuid;
    bentrok := intensif_cek_bentrok(NEW.faskes_uuid, pasien, NEW.room_monitoring_uuid, 'icu');
    IF bentrok IS NOT NULL THEN
      RAISE EXCEPTION 'Pasien atau tempat tidur masih digunakan episode % aktif.', bentrok USING ERRCODE = '23505';
    END IF;
    RETURN NEW;
  END;
  $$;
  DO $$ BEGIN
    IF to_regclass('public.icu_perawatans') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_trigger
        WHERE tgname = 'intensif_jaga_icu_trigger' AND tgrelid = 'icu_perawatans'::regclass) THEN
      CREATE TRIGGER intensif_jaga_icu_trigger BEFORE INSERT OR UPDATE ON icu_perawatans
        FOR EACH ROW EXECUTE FUNCTION intensif_jaga_icu();
    END IF;
  END $$;
`;

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        ${SQL_BERSAMA}
        -- Penempatan NICU aktif tidak boleh memakai pasien/tempat yang masih dipakai episode intensif modul lain.
        CREATE OR REPLACE FUNCTION nicu_jaga_penempatan() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE pasien VARCHAR(255); bed VARCHAR(255); bentrok TEXT;
        BEGIN
          IF NEW.selesai_at IS NOT NULL OR NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
          IF TG_OP = 'UPDATE' AND OLD.selesai_at IS NULL AND OLD.deleted_at IS NULL AND OLD.tempat_uuid = NEW.tempat_uuid THEN RETURN NEW; END IF;
          SELECT e.pasien_uuid INTO pasien FROM nicu_episode e WHERE e.uuid = NEW.episode_uuid AND e.faskes_uuid = NEW.faskes_uuid;
          SELECT t.room_monitoring_uuid INTO bed FROM nicu_tempat t WHERE t.uuid = NEW.tempat_uuid AND t.faskes_uuid = NEW.faskes_uuid;
          bentrok := intensif_cek_bentrok(NEW.faskes_uuid, pasien, bed, 'nicu');
          IF bentrok IS NOT NULL THEN
            RAISE EXCEPTION 'Pasien atau tempat tidur masih digunakan episode % aktif.', bentrok USING ERRCODE = '23505';
          END IF;
          RETURN NEW;
        END;
        $$;
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'nicu_jaga_penempatan_trigger' AND tgrelid = 'nicu_penempatan'::regclass) THEN
            CREATE TRIGGER nicu_jaga_penempatan_trigger BEFORE INSERT OR UPDATE ON nicu_penempatan
              FOR EACH ROW EXECUTE FUNCTION nicu_jaga_penempatan();
          END IF;
        END $$;
        -- Hunian sumber: tempat NICU yang belum siap atau masih dipakai episode NICU lain tidak menerima pasien baru
        -- melalui alur rawat inap. Status alat tidak pernah diubah otomatis oleh perpindahan pasien.
        CREATE OR REPLACE FUNCTION nicu_validasi_hunian_sumber() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.patient_uuid IS NOT NULL AND NEW.patient_uuid IS DISTINCT FROM OLD.patient_uuid THEN
            IF EXISTS (SELECT 1 FROM nicu_tempat t WHERE t.faskes_uuid = NEW.faskes_uuid
                AND t.room_monitoring_uuid = NEW.uuid AND t.deleted_at IS NULL AND t.status_alat <> 'siap') THEN
              RAISE EXCEPTION 'Alat NICU belum siap untuk penempatan.' USING ERRCODE = '23514';
            END IF;
            IF EXISTS (SELECT 1 FROM nicu_penempatan p JOIN nicu_tempat t
                ON t.uuid = p.tempat_uuid AND t.faskes_uuid = p.faskes_uuid AND t.deleted_at IS NULL
                JOIN nicu_episode e ON e.uuid = p.episode_uuid AND e.faskes_uuid = p.faskes_uuid AND e.deleted_at IS NULL
                WHERE p.faskes_uuid = NEW.faskes_uuid AND p.deleted_at IS NULL AND p.selesai_at IS NULL
                  AND t.room_monitoring_uuid = NEW.uuid AND e.pasien_uuid <> NEW.patient_uuid) THEN
              RAISE EXCEPTION 'Tempat masih digunakan episode NICU lain.' USING ERRCODE = '23505';
            END IF;
          END IF;
          RETURN NEW;
        END;
        $$;
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'nicu_validasi_hunian_sumber_trigger' AND tgrelid = 'room_monitorings'::regclass) THEN
            CREATE TRIGGER nicu_validasi_hunian_sumber_trigger BEFORE UPDATE OF patient_uuid ON room_monitorings
              FOR EACH ROW EXECUTE FUNCTION nicu_validasi_hunian_sumber();
          END IF;
        END $$;
      `, { transaction });
    });
  },
  async down() {
    // Pencegahan bentrok dipertahankan selama rekaman episode intensif masih tersedia.
  },
};
