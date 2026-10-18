import crypto from "crypto";
import pg from "pg";
import config from "./config.js";

export const pool = new pg.Pool({ ...config.pg, max: 10 });

export const query = async (sql, params = [], k = pool) => (await k.query(sql, params)).rows;
export const satu = async (sql, params = [], k = pool) => (await query(sql, params, k))[0] ?? null;

// Jalankan fn(klien) dalam satu transaksi.
export const transaksi = async (fn) => {
  const k = await pool.connect();
  try {
    await k.query("BEGIN");
    const hasil = await fn(k);
    await k.query("COMMIT");
    return hasil;
  } catch (e) {
    await k.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    k.release();
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

const nilaiKolom = (v) => (v !== null && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v);

// INSERT dari objek; mengembalikan baris baru. Objek/array disimpan sebagai JSON.
export const sisipkan = async (tabel, baris, k = pool) => {
  const data = { uuid: uuidv7(), created_at: sekarang(), ...baris };
  const kolom = Object.keys(data);
  return satu(
    `INSERT INTO ${tabel} (${kolom.map((c) => `"${c}"`).join(", ")}) VALUES (${kolom.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`,
    kolom.map((c) => nilaiKolom(data[c])),
    k,
  );
};

// UPDATE per uuid (tabel Studio tingkat instalasi, tanpa faskes). Kolom undefined diabaikan.
export const ubah = async (tabel, uuid, perubahan, k = pool) => {
  const data = Object.fromEntries(Object.entries({ ...perubahan, updated_at: sekarang() }).filter(([, v]) => v !== undefined));
  const kolom = Object.keys(data);
  return satu(
    `UPDATE ${tabel} SET ${kolom.map((c, i) => `"${c}" = $${i + 1}`).join(", ")} WHERE uuid = $${kolom.length + 1} RETURNING *`,
    [...kolom.map((c) => nilaiKolom(data[c])), uuid],
    k,
  );
};

// Jejak audit (append-only).
export const audit = (pelaku, aksi, itemUuid = null, rincian = null) =>
  query(`INSERT INTO studio_audit (item_uuid, aksi, pelaku, rincian, waktu) VALUES ($1, $2, $3, $4, $5)`, [
    itemUuid,
    aksi,
    pelaku,
    rincian ? JSON.stringify(rincian) : null,
    sekarang(),
  ]).catch((e) => console.error("[studio] audit gagal", e.message));
