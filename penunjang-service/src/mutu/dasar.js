import { satu, sisipkan, sekarang, uuidv7 } from "../db.js";
import { tangani, permintaanSalah, tidakDitemukan } from "../umum/respons.js";
import { petakanGalatPg } from "./bersama.js";

// Helper basis data bersama modul Mutu & Akreditasi. Semua pencarian selalu disaring faskes_uuid dari token (KF-12);
// rujukan milik faskes lain diperlakukan sebagai "tidak ditemukan".

export const NAMA_PEGAWAI = (alias) => `TRIM(CONCAT_WS(' ', ${alias}.first_title, ${alias}.name, NULLIF(${alias}.last_title, '')))`;

// Seperti tangani(), tetapi galat PostgreSQL yang dikenal (unik, FK, format) dipetakan ke 4xx, bukan 500.
export const tanganiMutu = (fn, pesanUnik) =>
  tangani(async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      throw petakanGalatPg(e, pesanUnik);
    }
  });

// Tanpa kolom berkas (BYTEA) agar respons & audit tidak memuat isi berkas.
export const tanpaBerkas = (row) => {
  if (!row) return row;
  const { berkas, ...sisa } = row;
  return sisa;
};

// INSERT yang mempertahankan Buffer sebagai BYTEA (sisipkan() di db.js menyimpan setiap objek sebagai JSON).
export const sisipkanBerkas = async (tabel, baris, k) => {
  const n = sekarang();
  const data = { uuid: uuidv7(), created_at: n, updated_at: n, ...baris };
  const kolom = Object.keys(data);
  const nilai = kolom.map((c) => {
    const v = data[c];
    return v !== null && typeof v === "object" && !Buffer.isBuffer(v) ? JSON.stringify(v) : v;
  });
  return satu(
    `INSERT INTO ${tabel} (${kolom.map((c) => `"${c}"`).join(", ")}) VALUES (${kolom.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`,
    nilai,
    k,
  );
};

// Jejak audit (KF-13/KT-16): pengguna, waktu, data sebelum/sesudah — ditulis di transaksi yang sama dengan perubahan.
export const catatAudit = (k, req, entitas, uuid, aksi, sebelum, sesudah) =>
  sisipkan(
    "mutu_audit",
    {
      faskes_uuid: req.author.faskesUuid,
      entitas,
      entitas_uuid: uuid,
      aksi,
      data_sebelum: sebelum ? tanpaBerkas(sebelum) : null,
      data_sesudah: sesudah ? tanpaBerkas(sesudah) : null,
      aktor: req.author.username || "-",
    },
    k,
  );

// Baris milik faskes (opsional FOR UPDATE di dalam transaksi); 404 bila tidak ada / milik faskes lain / terhapus.
export const ambilMilik = async (tabel, uuid, faskesUuid, k, { nama = "Data", kunci = false, kolom = "*" } = {}) => {
  const row = await satu(
    `SELECT ${kolom} FROM ${tabel} WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL${kunci ? " FOR UPDATE" : ""}`,
    [String(uuid ?? ""), faskesUuid],
    k,
  );
  if (!row) throw tidakDitemukan(nama);
  return row;
};

// Pegawai aktif Datamaster pada faskes (KT-8, G3) — tidak membuat data induk baru.
export const cekPegawaiAktif = async (uuid, faskesUuid, k) => {
  if (!uuid || typeof uuid !== "string") throw permintaanSalah("pegawai_uuid wajib diisi");
  const p = await satu(
    `SELECT uuid, ${NAMA_PEGAWAI("p")} AS nama FROM pegawai p WHERE p.uuid = $1 AND p.faskes_uuid = $2 AND p.deleted_at IS NULL AND p.status = true`,
    [uuid, faskesUuid],
    k,
  );
  if (!p) throw permintaanSalah("Pegawai tidak ditemukan atau tidak aktif di faskes ini");
  return p;
};

// Practitioner (opsional) harus milik pegawai yang sama dan aktif pada faskes.
export const cekPractitioner = async (uuid, pegawaiUuid, faskesUuid, k) => {
  if (uuid === undefined) return undefined;
  if (uuid === null || uuid === "") return null;
  if (typeof uuid !== "string") throw permintaanSalah("practitioner_uuid tidak valid");
  const p = await satu(
    `SELECT uuid FROM practitioner WHERE uuid = $1 AND faskes_uuid = $2 AND pegawai_uuid = $3 AND deleted_at IS NULL AND status = true`,
    [uuid, faskesUuid, pegawaiUuid],
    k,
  );
  if (!p) throw permintaanSalah("Practitioner tidak ditemukan, tidak aktif, atau bukan milik pegawai tersebut");
  return p.uuid;
};
