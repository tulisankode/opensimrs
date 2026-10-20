'use strict';

// Integritas episode perawatan intensif lintas modul (ICU, NICU, PICU, HDU) — bagian PICU.
// Fungsi intensif_cek_bentrok() dan pemicu intensif_jaga_icu pada icu_perawatans BERSAMA dengan migrasi NICU
// (integritas_episode_intensif_nicu): definisinya identik sehingga urutan penerapan migrasi kedua modul tidak
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
        -- Episode PICU aktif (penerimaan maupun pindah tempat tidur) tidak boleh memakai pasien/tempat tidur yang masih
        -- dipakai episode intensif modul lain.
        CREATE OR REPLACE FUNCTION picu_jaga_episode() RETURNS trigger LANGUAGE plpgsql AS $$
        DECLARE bentrok TEXT;
        BEGIN
          IF NEW.status <> 'aktif' OR NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
          IF TG_OP = 'UPDATE' AND OLD.status = 'aktif' AND OLD.deleted_at IS NULL
            AND OLD.tempat_tidur_uuid = NEW.tempat_tidur_uuid AND OLD.pasien_uuid = NEW.pasien_uuid THEN RETURN NEW; END IF;
          bentrok := intensif_cek_bentrok(NEW.faskes_uuid, NEW.pasien_uuid, NEW.tempat_tidur_uuid, 'picu');
          IF bentrok IS NOT NULL THEN
            RAISE EXCEPTION 'Pasien atau tempat tidur masih digunakan episode % aktif.', bentrok USING ERRCODE = '23505';
          END IF;
          RETURN NEW;
        END;
        $$;
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'picu_jaga_episode_trigger' AND tgrelid = 'picu_episode'::regclass) THEN
            CREATE TRIGGER picu_jaga_episode_trigger BEFORE INSERT OR UPDATE ON picu_episode
              FOR EACH ROW EXECUTE FUNCTION picu_jaga_episode();
          END IF;
        END $$;
      `, { transaction });
    });
  },
  async down() {
    // Pencegahan bentrok dipertahankan selama rekaman episode intensif masih tersedia.
  },
};
