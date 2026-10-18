import { hitungHashBaris, samarkanRingkasan } from "../../../packages/model-sdk/umum/audit-core.js";
import { uuidv7, sekarang } from "../db.js";

// Menulis baris audit_trail pusat (STD-0029) dari layanan berbasis pg, meniru packages/model-sdk/umum/audit-sequelize.js:
// kunci per faskes (pg_advisory_xact_lock) agar rantai hash tidak bercabang, fungsi hash & penyamaran dari audit-core.js
// (satu sumber dengan layanan Sequelize; image Docker penunjang-service menyalin berkas itu ke /packages, lihat
// Dockerfile). Dipanggil di dalam transaksi `k` yang sama dengan perubahan data. `aksi` wajib salah satu nilai CHECK
// audit_trail_aksi_check (buat, ubah, hapus, baca, ...); jenis tindakan khusus dibedakan lewat `entitas`/ringkasan.
//
// Kegagalan audit TIDAK menggagalkan transaksi utama (STD-0029 KT-19), tetapi galat SQL di PostgreSQL membatalkan
// seluruh transaksi — karena itu penulisan dibungkus SAVEPOINT: bila gagal, hanya bagian audit yang di-rollback dan
// perubahan data tetap di-COMMIT (tanpa savepoint, COMMIT diam-diam menjadi ROLLBACK padahal API melapor berhasil).
export const catatAuditPusat = async (k, { faskesUuid, aksi, entitas, entitasUuid, ringkasan, pengguna }) => {
  await k.query("SAVEPOINT audit_hr");
  try {
    await k.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`audit:${faskesUuid}`]);
    const { rows } = await k.query("SELECT hash_baris FROM audit_trail WHERE faskes_uuid = $1 ORDER BY id DESC LIMIT 1", [faskesUuid]);
    const n = sekarang();
    const baris = {
      uuid: uuidv7(),
      faskes_uuid: faskesUuid,
      waktu_epoch: n,
      pengguna_uuid: null,
      identitas_akun: pengguna ?? null,
      peran: null,
      layanan: "penunjang-service/hr",
      aksi,
      entitas,
      entitas_uuid: entitasUuid ?? null,
      patient_uuid: null,
      ringkasan_perubahan: ringkasan ? samarkanRingkasan(ringkasan) : null,
      alamat_ip: null,
      user_agent: null,
      request_id: null,
      hash_sebelumnya: rows[0]?.hash_baris ?? null,
    };
    baris.hash_baris = hitungHashBaris(baris);
    await k.query(
      `INSERT INTO audit_trail (uuid, faskes_uuid, waktu_epoch, pengguna_uuid, identitas_akun, peran, layanan, aksi, entitas, entitas_uuid,
         patient_uuid, ringkasan_perubahan, alamat_ip, user_agent, request_id, hash_sebelumnya, hash_baris, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $3)`,
      [
        baris.uuid,
        baris.faskes_uuid,
        baris.waktu_epoch,
        baris.pengguna_uuid,
        baris.identitas_akun,
        baris.peran,
        baris.layanan,
        baris.aksi,
        baris.entitas,
        baris.entitas_uuid,
        baris.patient_uuid,
        baris.ringkasan_perubahan ? JSON.stringify(baris.ringkasan_perubahan) : null,
        baris.alamat_ip,
        baris.user_agent,
        baris.request_id,
        baris.hash_sebelumnya,
        baris.hash_baris,
      ],
    );
    await k.query("RELEASE SAVEPOINT audit_hr");
  } catch (error) {
    await k.query("ROLLBACK TO SAVEPOINT audit_hr");
    console.error("[hr] gagal menulis audit_trail:", error.message);
  }
};
