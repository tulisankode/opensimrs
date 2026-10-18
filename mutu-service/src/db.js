import crypto from "crypto";
import pg from "pg";
import config from "./config.js";
export const pool = new pg.Pool({ ...config.pg, max: 10 });
export const query = async (sql, params = [], k = pool) => (await k.query(sql, params)).rows;
export const satu = async (sql, params = [], k = pool) => (await query(sql, params, k))[0] ?? null;
export const sekarang = () => Math.floor(Date.now() / 1000);
export const uuidv7 = () => { const b = crypto.randomBytes(16); const t = BigInt(Date.now()); for (let i=0;i<6;i++) b[i]=Number((t>>BigInt(8*(5-i)))&255n); b[6]=(b[6]&15)|112; b[8]=(b[8]&63)|128; const h=b.toString("hex"); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`; };
export const transaksi = async (fn) => { const c=await pool.connect(); try { await c.query("BEGIN"); const x=await fn(c); await c.query("COMMIT"); return x; } catch(e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); } };
