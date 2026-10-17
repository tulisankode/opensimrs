import { query, satu, sekarang, uuidv7 } from "../../db.js";
import { permintaanSalah } from "../../umum/respons.js";
import { ambilKoneksi } from "./utd-koneksi.js";

// Pemetaan komponen darah, unit, dokter, dan penjamin lokal → kode UTD, per koneksi (KF-7). Satu tabel per jenis
// (bdrs_utd_peta_komponen/unit/dokter/penjamin) karena kode UTD bisa berbeda antar koneksi — lihat migrasi
// 20261017042700-bdrs_utd_bridging.cjs. Konfigurasi per jenis menjaga kode tetap DRY (pola sama dengan
// pacs-peta.js, diadaptasi karena di sini pemetaan dibatasi per koneksi, bukan global per faskes).
const JENIS = {
  komponen: {
    tabel: "bdrs_utd_peta_komponen",
    kolomRef: "komponen_uuid",
    referensi: (faskesUuid) => query(`SELECT uuid, kode, nama FROM bdrs_komponen_darah WHERE faskes_uuid = $1 AND deleted_at IS NULL AND status ORDER BY nama`, [faskesUuid]),
    validasiRef: (faskesUuid, refUuid) => satu(`SELECT uuid FROM bdrs_komponen_darah WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [refUuid, faskesUuid]),
  },
  unit: {
    tabel: "bdrs_utd_peta_unit",
    kolomRef: "lokasi_uuid",
    referensi: (faskesUuid) => query(`SELECT uuid, code AS kode, name AS nama FROM lokasi WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY name`, [faskesUuid]),
    validasiRef: (faskesUuid, refUuid) => satu(`SELECT uuid FROM lokasi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [refUuid, faskesUuid]),
  },
  dokter: {
    tabel: "bdrs_utd_peta_dokter",
    kolomRef: "practitioner_uuid",
    referensi: (faskesUuid) =>
      query(
        `SELECT pr.uuid, TRIM(CONCAT_WS(' ', pg.first_title, pg.name, NULLIF(pg.last_title, ''))) AS nama
           FROM practitioner pr JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid
          WHERE pr.faskes_uuid = $1 AND pr.deleted_at IS NULL AND pr.is_doctor ORDER BY pg.name`,
        [faskesUuid],
      ),
    validasiRef: (faskesUuid, refUuid) => satu(`SELECT uuid FROM practitioner WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [refUuid, faskesUuid]),
  },
  penjamin: {
    tabel: "bdrs_utd_peta_penjamin",
    kolomRef: "penjamin_uuid",
    referensi: (faskesUuid) => query(`SELECT uuid, code AS kode, name AS nama FROM penjamin WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY name`, [faskesUuid]),
    validasiRef: (faskesUuid, refUuid) => satu(`SELECT uuid FROM penjamin WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [refUuid, faskesUuid]),
  },
};

const konfig = (jenis) => {
  const k = JENIS[jenis];
  if (!k) throw permintaanSalah("jenis harus salah satu: komponen, unit, dokter, penjamin");
  return k;
};

export const daftarMapping = async (faskesUuid, jenis, { koneksiUuid, belumDipetakan = false } = {}) => {
  const k = konfig(jenis);
  await ambilKoneksi(faskesUuid, koneksiUuid);
  const [referensi, peta] = await Promise.all([
    k.referensi(faskesUuid),
    query(`SELECT ${k.kolomRef} AS ref_uuid, kode_utd FROM ${k.tabel} WHERE faskes_uuid = $1 AND koneksi_uuid = $2 AND deleted_at IS NULL`, [faskesUuid, koneksiUuid]),
  ]);
  const hasil = referensi.map((r) => ({ ...r, kode_utd: peta.find((p) => p.ref_uuid === r.uuid)?.kode_utd ?? null }));
  return belumDipetakan ? hasil.filter((r) => !r.kode_utd) : hasil;
};

export const simpanMapping = async (faskesUuid, jenis, koneksiUuid, refUuid, kodeUtd) => {
  const k = konfig(jenis);
  await ambilKoneksi(faskesUuid, koneksiUuid);
  const ref = await k.validasiRef(faskesUuid, refUuid);
  if (!ref) throw permintaanSalah(`Data ${jenis} tidak ditemukan di faskes ini`);
  const kode = String(kodeUtd ?? "").trim().slice(0, 50);
  const t = sekarang();
  if (!kode) {
    await query(`UPDATE ${k.tabel} SET deleted_at = $4, updated_at = $4 WHERE faskes_uuid = $1 AND koneksi_uuid = $2 AND ${k.kolomRef} = $3 AND deleted_at IS NULL`, [
      faskesUuid, koneksiUuid, refUuid, t,
    ]);
    return { ref_uuid: refUuid, kode_utd: null };
  }
  const ada = await satu(`SELECT uuid FROM ${k.tabel} WHERE faskes_uuid = $1 AND koneksi_uuid = $2 AND ${k.kolomRef} = $3 AND deleted_at IS NULL`, [faskesUuid, koneksiUuid, refUuid]);
  if (ada) await query(`UPDATE ${k.tabel} SET kode_utd = $2, updated_at = $3 WHERE uuid = $1`, [ada.uuid, kode, t]);
  else await query(`INSERT INTO ${k.tabel} (uuid, faskes_uuid, koneksi_uuid, ${k.kolomRef}, kode_utd, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$6)`, [
    uuidv7(), faskesUuid, koneksiUuid, refUuid, kode, t,
  ]);
  return { ref_uuid: refUuid, kode_utd: kode };
};

/** Mapping satu referensi (null bila belum dipetakan) — dipakai saat membentuk payload bridging. */
export const mappingSatu = async (faskesUuid, jenis, koneksiUuid, refUuid) => {
  if (!refUuid) return null;
  const k = konfig(jenis);
  return satu(`SELECT kode_utd FROM ${k.tabel} WHERE faskes_uuid = $1 AND koneksi_uuid = $2 AND ${k.kolomRef} = $3 AND deleted_at IS NULL`, [faskesUuid, koneksiUuid, refUuid]);
};

/** Mapping balik: kode UTD → komponen_uuid lokal (KT-9: kode komponen kantong harus terpetakan balik). */
export const komponenDariKodeUtd = (faskesUuid, koneksiUuid, kodeUtd) =>
  satu(
    `SELECT komponen_uuid FROM bdrs_utd_peta_komponen WHERE faskes_uuid = $1 AND koneksi_uuid = $2 AND kode_utd = $3 AND deleted_at IS NULL`,
    [faskesUuid, koneksiUuid, String(kodeUtd ?? "").trim()],
  ).then((r) => r?.komponen_uuid ?? null);
