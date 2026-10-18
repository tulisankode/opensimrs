import { QueryTypes } from "sequelize";
import { uuidv7 } from "uuidv7";
import moment from "moment";
import { ambilKonteksAudit } from "./audit-context.js";
import {
  DAFTAR_PUTIH_TABEL,
  ambilPatientUuid,
  ambilFaskesUuid,
  samarkanRingkasan,
  hitungHashBaris,
} from "./audit-core.js";

// STD-0029 — Audit Trail terpusat: hook GLOBAL pada instance Sequelize (bukan per model), karena hookModel bersama
// (models/admisi/common/hook-model.js) tidak dipakai semua model & banyak layanan punya model lokal sendiri.

// Menulis satu baris audit dalam transaksi terkunci per faskes, agar rantai hash tidak bercabang saat beberapa
// penulisan terjadi bersamaan (pg_advisory_xact_lock dilepas otomatis saat transaksi selesai).
async function tulisBarisAudit(sequelize, peristiwa) {
  try {
    await sequelize.transaction(async (transaction) => {
      await sequelize.query("SELECT pg_advisory_xact_lock(hashtext(:kunci))", {
        replacements: { kunci: `audit:${peristiwa.faskes_uuid}` },
        transaction,
      });
      const terakhir = await sequelize.query(
        "SELECT hash_baris FROM audit_trail WHERE faskes_uuid = :faskesUuid ORDER BY id DESC LIMIT 1",
        { replacements: { faskesUuid: peristiwa.faskes_uuid }, transaction, type: QueryTypes.SELECT }
      );
      const baris = { ...peristiwa, hash_sebelumnya: terakhir?.[0]?.hash_baris ?? null };
      baris.hash_baris = hitungHashBaris(baris);
      await sequelize.query(
        `INSERT INTO audit_trail
          (uuid, faskes_uuid, waktu_epoch, pengguna_uuid, identitas_akun, peran, layanan, aksi, entitas,
           entitas_uuid, patient_uuid, ringkasan_perubahan, alamat_ip, user_agent, request_id,
           hash_sebelumnya, hash_baris, created_at)
         VALUES (:uuid, :faskes_uuid, :waktu_epoch, :pengguna_uuid, :identitas_akun, CAST(:peran AS jsonb), :layanan,
           :aksi, :entitas, :entitas_uuid, :patient_uuid, CAST(:ringkasan_perubahan AS jsonb), :alamat_ip,
           :user_agent, :request_id, :hash_sebelumnya, :hash_baris, :waktu_epoch)`,
        {
          replacements: {
            ...baris,
            peran: baris.peran ? JSON.stringify(baris.peran) : null,
            ringkasan_perubahan: baris.ringkasan_perubahan ? JSON.stringify(baris.ringkasan_perubahan) : null,
          },
          transaction,
        }
      );
    });
  } catch (error) {
    // Kegagalan audit tidak menggagalkan transaksi utama (bawaan STD-0029, lihat KT-19). Cukup dilaporkan ke konsol
    // operasional; mekanisme antrean/retry/metrik dirancang terpisah.
    console.error("[audit-trail] gagal menulis catatan audit:", error.message);
  }
}

function susunRingkasanPerubahan(instance, aksi) {
  const sesudah = instance.dataValues ?? {};
  if (aksi === "buat") {
    const ringkasan = {};
    for (const [field, nilai] of Object.entries(sesudah)) ringkasan[field] = { lama: null, baru: nilai };
    return samarkanRingkasan(ringkasan);
  }
  const sebelum = instance._previousDataValues ?? {};
  const berubah = typeof instance.changed === "function" ? instance.changed() || [] : Object.keys(sesudah);
  const ringkasan = {};
  for (const field of berubah) {
    if (sebelum[field] === sesudah[field]) continue;
    ringkasan[field] = { lama: sebelum[field] ?? null, baru: sesudah[field] ?? null };
  }
  return Object.keys(ringkasan).length ? samarkanRingkasan(ringkasan) : null;
}

// Menyusun peristiwa audit dari instance SAAT hook berjalan (sinkron), karena _previousDataValues/changed() sudah
// berubah lagi bila instance yang sama disimpan ulang sebelum transaksi selesai. Null bila tidak perlu dicatat.
function susunPeristiwaModel(layanan, instance, aksiDiusulkan) {
  const tableName =
    typeof instance.constructor?.getTableName === "function" ? instance.constructor.getTableName() : instance.constructor?.tableName;
  const info = DAFTAR_PUTIH_TABEL[tableName];
  if (!info) return null;
  const faskesUuid = ambilFaskesUuid(instance);
  if (!faskesUuid) return null;

  // Soft delete (deletedAt baru terisi lewat UPDATE) dicatat sebagai aksi "hapus", bukan "ubah".
  const deletedAtSebelum = instance._previousDataValues?.deletedAt ?? null;
  const deletedAtSesudah = instance.dataValues?.deletedAt ?? null;
  const aksi = aksiDiusulkan === "ubah" && !deletedAtSebelum && deletedAtSesudah ? "hapus" : aksiDiusulkan;

  const ringkasan = susunRingkasanPerubahan(instance, aksi);
  if (aksi !== "buat" && !ringkasan) return null; // tidak ada perubahan field yang relevan untuk dicatat

  // Perubahan izin/peran dicatat sebagai `ubah_izin`, bukan `ubah` generik (STD-0029 KT-23).
  const aksiAkhir =
    aksi === "ubah" && info.fieldIzin && ringkasan && info.fieldIzin.some((f) => f in ringkasan) ? "ubah_izin" : aksi;

  const konteks = ambilKonteksAudit();
  return {
    uuid: uuidv7(),
    faskes_uuid: faskesUuid,
    waktu_epoch: moment().unix(),
    pengguna_uuid: konteks?.penggunaUuid ?? null,
    identitas_akun: konteks?.username ?? null,
    peran: konteks?.peran ?? null,
    layanan,
    aksi: aksiAkhir,
    entitas: info.entitas,
    entitas_uuid: instance.uuid ?? instance.dataValues?.uuid ?? null,
    patient_uuid: ambilPatientUuid(instance, tableName),
    ringkasan_perubahan: ringkasan,
    alamat_ip: konteks?.alamatIp ?? null,
    user_agent: konteks?.userAgent ?? null,
    request_id: konteks?.requestId ?? null,
  };
}

// Bila perubahan terjadi di dalam transaksi, baris audit ditulis SETELAH transaksi utama commit (afterCommit): koneksi
// transaksi utama sudah kembali ke pool (tidak ada transaksi audit bersarang yang menunggu koneksi kedua — pada beban
// paralel ≥ ukuran pool hal itu membuat pool habis dan permintaan utama gagal timeout), dan perubahan yang di-rollback
// tidak meninggalkan catatan audit palsu. Tanpa transaksi, ditulis langsung.
async function jadwalkanTulis(sequelize, options, peristiwa) {
  let transaksi = options?.transaction;
  while (transaksi?.parent) transaksi = transaksi.parent; // savepoint: tunggu commit transaksi terluar
  if (transaksi && typeof transaksi.afterCommit === "function" && !transaksi.finished) {
    transaksi.afterCommit(() => tulisBarisAudit(sequelize, peristiwa));
    return;
  }
  await tulisBarisAudit(sequelize, peristiwa);
}

async function catatPerubahanModel(sequelize, layanan, instance, aksiDiusulkan, options) {
  // `skipAudit: true` pada opsi operasi (mis. { skipAudit: true } di Model.update/destroy) melewati pencatatan
  // otomatis — dipakai pemanggil yang sudah mencatat peristiwa lebih spesifik sendiri lewat `catatPeristiwaAudit`
  // (mis. `ganti_sandi`, bukan `ubah` generik), agar tidak tercatat dua kali untuk operasi yang sama.
  if (options?.skipAudit) return;
  let peristiwa;
  try {
    peristiwa = susunPeristiwaModel(layanan, instance, aksiDiusulkan);
  } catch (error) {
    console.error("[audit-trail] gagal menyusun catatan audit:", error.message);
    return;
  }
  if (!peristiwa) return;
  await jadwalkanTulis(sequelize, options, peristiwa);
}

// Model.update()/Model.destroy() massal TANPA individualHooks tidak memicu afterUpdate/afterDestroy per baris —
// hanya hook ini, yang hanya menerima `options` (kriteria WHERE), bukan instance baris yang terdampak. Dicatat
// sebagai SATU peristiwa ringkasan per panggilan (bukan per baris, karena baris terdampak & nilai lama tidak
// diketahui di sini): lebih baik tercatat kasar daripada tidak tercatat sama sekali. Jalur yang perlu diff per
// baris lengkap harus memakai `individualHooks: true` (lihat admisi-service/src/repositories/patient-repository.js).
function susunPeristiwaBulk(layanan, model, options, aksi) {
  const tableName = typeof model?.getTableName === "function" ? model.getTableName() : model?.tableName;
  const info = DAFTAR_PUTIH_TABEL[tableName];
  if (!info) return null;
  const where = options?.where ?? {};
  const faskesUuid = where.faskesUuid ?? where.faskes_uuid ?? ambilKonteksAudit()?.faskesUuid ?? null;
  if (!faskesUuid) return null;

  const konteks = ambilKonteksAudit();
  return {
    uuid: uuidv7(),
    faskes_uuid: faskesUuid,
    waktu_epoch: moment().unix(),
    pengguna_uuid: konteks?.penggunaUuid ?? null,
    identitas_akun: konteks?.username ?? null,
    peran: konteks?.peran ?? null,
    layanan,
    aksi,
    entitas: info.entitas,
    entitas_uuid: null,
    patient_uuid: null,
    ringkasan_perubahan: samarkanRingkasan({
      catatan: "Pembaruan/penghapusan massal (Model.update/destroy tanpa individualHooks) — rincian per baris tidak tersedia.",
      kriteria: JSON.stringify(where),
      ...(aksi === "ubah" && options?.attributes ? { field_diubah: Object.keys(options.attributes).join(", ") } : {}),
    }),
    alamat_ip: konteks?.alamatIp ?? null,
    user_agent: konteks?.userAgent ?? null,
    request_id: konteks?.requestId ?? null,
  };
}

async function catatPerubahanBulk(sequelize, layanan, model, options, aksi) {
  if (options?.individualHooks) return; // sudah tercatat per baris lewat afterUpdate/afterDestroy
  if (options?.skipAudit) return; // lihat catatan skipAudit di catatPerubahanModel
  let peristiwa;
  try {
    peristiwa = susunPeristiwaBulk(layanan, model, options, aksi);
  } catch (error) {
    console.error("[audit-trail] gagal menyusun catatan audit massal:", error.message);
    return;
  }
  if (!peristiwa) return;
  await jadwalkanTulis(sequelize, options, peristiwa);
}

const _terpasang = new WeakSet();

/**
 * Memasang hook audit global pada satu instance Sequelize. Aman dipanggil lebih dari sekali pada instance yang sama
 * (mis. beberapa berkas konfigurasi layanan memanggil fungsi ini) — hanya dipasang sekali per instance per proses.
 * @param {import("sequelize").Sequelize} sequelize
 * @param {{ layanan: string }} opsi nama layanan sumber (muncul pada kolom `layanan`)
 */
export function pasangAuditSequelize(sequelize, { layanan } = {}) {
  if (!sequelize || typeof sequelize.addHook !== "function" || _terpasang.has(sequelize)) return sequelize;
  _terpasang.add(sequelize);
  const namaLayanan = layanan || process.env.APPLICATION_MODULE || process.env.API_MODULE || "layanan";

  sequelize.addHook("afterCreate", (instance, options) => catatPerubahanModel(sequelize, namaLayanan, instance, "buat", options));
  sequelize.addHook("afterUpdate", (instance, options) => catatPerubahanModel(sequelize, namaLayanan, instance, "ubah", options));
  sequelize.addHook("afterDestroy", (instance, options) => catatPerubahanModel(sequelize, namaLayanan, instance, "hapus", options));
  // Signature Sequelize v6: afterBulkCreate(instances, options).
  sequelize.addHook("afterBulkCreate", async (instances, options) => {
    for (const instance of instances ?? []) await catatPerubahanModel(sequelize, namaLayanan, instance, "buat", options);
  });
  // Model.update()/destroy() massal tanpa individualHooks: lihat catatan di susunPeristiwaBulk di atas.
  sequelize.addHook("afterBulkUpdate", (options) => catatPerubahanBulk(sequelize, namaLayanan, options?.model, options, "ubah"));
  sequelize.addHook("afterBulkDestroy", (options) => catatPerubahanBulk(sequelize, namaLayanan, options?.model, options, "hapus"));
  return sequelize;
}

/**
 * Mencatat satu peristiwa audit secara eksplisit (login, login_gagal, logout, ubah_izin, baca, ekspor, cetak) untuk
 * layanan yang memakai Sequelize. Konteks (pengguna, IP, user agent, request id) diambil dari `ambilKonteksAudit()`
 * kecuali sudah diisi langsung pada `peristiwa`. Tidak melempar error ke pemanggil — kegagalan audit tidak boleh
 * menggagalkan alur utama (STD-0029 KT-19).
 * @param {import("sequelize").Sequelize} sequelize
 * @param {{
 *   faskes_uuid: string, layanan: string, aksi: string, entitas?: string, entitas_uuid?: string,
 *   patient_uuid?: string, ringkasan_perubahan?: object, identitas_akun?: string, pengguna_uuid?: string,
 * }} peristiwa
 */
export async function catatPeristiwaAudit(sequelize, peristiwa) {
  const konteks = ambilKonteksAudit();
  const faskesUuid = peristiwa.faskes_uuid ?? konteks?.faskesUuid;
  if (!faskesUuid) return;
  await tulisBarisAudit(sequelize, {
    uuid: uuidv7(),
    faskes_uuid: faskesUuid,
    waktu_epoch: moment().unix(),
    pengguna_uuid: peristiwa.pengguna_uuid ?? konteks?.penggunaUuid ?? null,
    identitas_akun: peristiwa.identitas_akun ?? konteks?.username ?? null,
    peran: peristiwa.peran ?? konteks?.peran ?? null,
    layanan: peristiwa.layanan,
    aksi: peristiwa.aksi,
    entitas: peristiwa.entitas ?? null,
    entitas_uuid: peristiwa.entitas_uuid ?? null,
    patient_uuid: peristiwa.patient_uuid ?? null,
    ringkasan_perubahan: peristiwa.ringkasan_perubahan ? samarkanRingkasan(peristiwa.ringkasan_perubahan) : null,
    alamat_ip: peristiwa.alamat_ip ?? konteks?.alamatIp ?? null,
    user_agent: peristiwa.user_agent ?? konteks?.userAgent ?? null,
    request_id: peristiwa.request_id ?? konteks?.requestId ?? null,
  });
}
