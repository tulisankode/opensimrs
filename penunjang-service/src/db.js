import crypto from "crypto";
import pg from "pg";
import config from "./config.js";

export const pool = new pg.Pool({ ...config.pg, max: 10 });

// Kueri sederhana (pool) atau di dalam transaksi (klien `k` dari transaksi()).
// k null/undefined = di luar transaksi (pool); repositori jadwal dinas meneruskan null untuk pembacaan biasa.
export const query = async (sql, params = [], k) => (await (k ?? pool).query(sql, params)).rows;
export const satu = async (sql, params = [], k) => (await query(sql, params, k))[0] ?? null;

// Jalankan fn(klien) dalam satu transaksi; rollback bila melempar.
export const transaksi = async (fn) => {
  const klien = await pool.connect();
  try {
    await klien.query("BEGIN");
    const hasil = await fn(klien);
    await klien.query("COMMIT");
    return hasil;
  } catch (e) {
    await klien.query("ROLLBACK");
    throw e;
  } finally {
    klien.release();
  }
};

export const sekarang = () => Math.floor(Date.now() / 1000);

export const uuidv7 = () => {
  const b = crypto.randomBytes(16);
  const t = BigInt(Date.now());
  for (let i = 0; i < 6; i++) b[i] = Number((t >> BigInt(8 * (5 - i))) & 255n);
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

// INSERT dari objek; mengembalikan baris baru. Objek/array (bukan Date) disimpan sebagai JSON.
export const sisipkan = async (tabel, baris, k = pool) => {
  const data = { uuid: uuidv7(), created_at: sekarang(), updated_at: sekarang(), ...baris };
  const kolom = Object.keys(data);
  const nilai = kolom.map((c) => (data[c] !== null && typeof data[c] === "object" && !(data[c] instanceof Date) ? JSON.stringify(data[c]) : data[c]));
  return satu(
    `INSERT INTO ${tabel} (${kolom.map((c) => `"${c}"`).join(", ")}) VALUES (${kolom.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`,
    nilai,
    k,
  );
};

// UPDATE per uuid + faskes; kolom undefined diabaikan. Mengembalikan baris setelah diubah (null bila tidak ada).
export const ubah = async (tabel, uuid, faskesUuid, perubahan, k = pool) => {
  const data = Object.fromEntries(Object.entries({ ...perubahan, updated_at: sekarang() }).filter(([, v]) => v !== undefined));
  const kolom = Object.keys(data);
  const nilai = kolom.map((c) => (data[c] !== null && typeof data[c] === "object" && !(data[c] instanceof Date) ? JSON.stringify(data[c]) : data[c]));
  return satu(
    `UPDATE ${tabel} SET ${kolom.map((c, i) => `"${c}" = $${i + 1}`).join(", ")}
      WHERE uuid = $${kolom.length + 1} AND faskes_uuid = $${kolom.length + 2} AND deleted_at IS NULL RETURNING *`,
    [...nilai, uuid, faskesUuid],
    k,
  );
};
