import { satu, sisipkan, sekarang } from "../db.js";
import { permintaanSalah, tidakDitemukan } from "../umum/respons.js";
import { konflik } from "./bersama.js";

// Helper basis data bersama modul Sarana & Prasarana. Semua pencarian selalu disaring faskes_uuid dari token (KF-3);
// rujukan lintas faskes diperlakukan sebagai "tidak ditemukan".

export const NAMA_PEGAWAI = (alias) => `TRIM(CONCAT_WS(' ', ${alias}.first_title, ${alias}.name, NULLIF(${alias}.last_title, '')))`;

// Riwayat aset (log, tidak pernah diubah/dihapus — KF-6/KT-15).
export const catatRiwayat = (k, faskesUuid, asetUuid, jenis, data, pengguna) =>
  sisipkan(
    "sarpras_riwayat_aset",
    { faskes_uuid: faskesUuid, aset_uuid: asetUuid, jenis_peristiwa: jenis, data_perubahan: data ?? null, pengguna: pengguna ?? null, waktu_peristiwa: sekarang() },
    k,
  );

export const cekLokasi = async (uuid, faskesUuid, k, nama = "Lokasi") => {
  const l = await satu(`SELECT uuid, name AS nama FROM lokasi WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [String(uuid), faskesUuid], k);
  if (!l) throw permintaanSalah(`${nama} tidak ditemukan pada faskes ini`);
  return l;
};

export const cekPegawai = async (uuid, faskesUuid, k, nama = "Pegawai") => {
  if (uuid === undefined) return undefined;
  if (uuid === null || uuid === "") return null;
  const p = await satu(`SELECT uuid FROM pegawai WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [String(uuid), faskesUuid], k);
  if (!p) throw permintaanSalah(`${nama} tidak ditemukan pada faskes ini`);
  return p.uuid;
};

// Aset milik faskes (opsional dikunci FOR UPDATE di dalam transaksi). `bisaDikerjakan` → tolak aset dihapuskan (KT-22).
export const ambilAset = async (uuid, faskesUuid, k, { kunci = false, bisaDikerjakan = false } = {}) => {
  const a = await satu(
    `SELECT * FROM sarpras_aset WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL${kunci ? " FOR UPDATE" : ""}`,
    [String(uuid ?? ""), faskesUuid],
    k,
  );
  if (!a) throw tidakDitemukan("Aset");
  if (bisaDikerjakan && a.status === "dihapuskan") throw konflik("Aset sudah dihapuskan dan tidak dapat menerima pekerjaan baru");
  return a;
};

export const ambangKalibrasi = async (faskesUuid, k) =>
  Number((await satu(`SELECT ambang_kalibrasi_hari FROM sarpras_pengaturan WHERE faskes_uuid = $1`, [faskesUuid], k))?.ambang_kalibrasi_hari ?? 30);

// Pelanggaran indeks unik (23505) → 409 dengan pesan ramah.
export const tanganiUnik = (pesan) => (e) => {
  if (e?.code === "23505") throw konflik(pesan);
  throw e;
};
