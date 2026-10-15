'use strict';

// Mengisi/menambah master data layanan penunjang (laboratorium, dst.) ke faskes demo yang SUDAH ada, tanpa reset DB.
// Untuk tiap faskes di tabel `faskes` yang kodenya ada di katalog-demo (K.FASKES), runner membangun ctx yang sama dengan
// seed-demo.cjs lalu memanggil fungsi seed tiap modul yang aktif, dalam satu transaksi per faskes.
// Fungsi seed yang didaftarkan di MODUL wajib idempoten (lewati kode yang sudah ada) agar runner aman dijalankan ulang.
//
//   node database/demo/isi-master-penunjang.cjs                     # semua faskes demo, semua modul
//   node database/demo/isi-master-penunjang.cjs --faskes KUM,RSA    # hanya faskes tertentu (kode faskes)
//   node database/demo/isi-master-penunjang.cjs --modul laboratorium
//   node database/demo/isi-master-penunjang.cjs --kering            # uji coba: semua transaksi di-ROLLBACK
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');
const K = require('./katalog-demo.cjs');
const { seed: seedLab } = require('./seed-lab.cjs');
const { seed: seedRadiologi } = require('./seed-radiologi.cjs');
const { seed: seedFisioterapi } = require('./seed-fisioterapi.cjs');
const { seed: seedMcu } = require('./seed-mcu.cjs');
const { seed: seedPatologi } = require('./seed-patologi.cjs');
const { seed: seedMikrobiologi } = require('./seed-mikrobiologi.cjs');

// Daftar modul penunjang: [kode modul (ref_modul), fungsi seed]. Tambahkan baris baru di sini untuk modul lain.
const MODUL = [
  ['laboratorium', seedLab],
  ['radiologi', seedRadiologi],
  ['fisioterapi', seedFisioterapi],
  ['mcu', seedMcu], // setelah lab & radiologi: paket MCU menunjuk item lab & Thorax PA
  ['patologi_anatomi', seedPatologi],
  ['mikrobiologi', seedMikrobiologi],
];

const ROOT = path.resolve(__dirname, '..', '..');
require('dotenv').config({ path: path.join(ROOT, '.env') });
// Sama dengan seed-demo.cjs
const LEVEL = { praktik_mandiri: 1, klinik_pratama: 2, puskesmas: 2, klinik_utama: 3, rs_d: 3, rs_c: 3, rs_b: 3, rs_a: 3 };

const uuidv7 = () => {
  const b = crypto.randomBytes(16);
  const t = BigInt(Date.now());
  for (let i = 0; i < 6; i++) b[i] = Number((t >> BigInt(8 * (5 - i))) & 255n);
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
const NOW = Math.floor(Date.now() / 1000);
const rupiah = (n) => Math.round(n / 500) * 500;

const arg = (nama) => {
  const i = process.argv.indexOf(`--${nama}`);
  return i < 0 ? null : process.argv[i + 1] ?? '';
};
const daftar = (s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : null);

let db;
const ins = async (tabel, baris) => {
  const data = { uuid: uuidv7(), ...baris };
  const kolom = Object.keys(data);
  const nilai = kolom.map((k) => (data[k] !== null && typeof data[k] === 'object' && !Array.isArray(data[k]) ? JSON.stringify(data[k]) : data[k]));
  await db.query(`INSERT INTO "${tabel}" (${kolom.map((k) => `"${k}"`).join(', ')}) VALUES (${kolom.map((_, i) => `$${i + 1}`).join(', ')})`, nilai);
  return data.uuid;
};
const satu = async (sql, p = []) => (await db.query(sql, p)).rows[0];

// Modul aktif = modul inti + preset segmen, lalu override per faskes (faskes_modul_override) bila tabelnya ada.
async function modulAktif(fUuid, segmen) {
  const { rows } = await db.query(
    `SELECT m.kode FROM ref_modul m WHERE m.tersedia AND (m.inti OR m.kode IN (SELECT modul_kode FROM preset_segmen_modul WHERE segmen_kode = $1))`,
    [segmen]);
  const aktif = new Set(rows.map((r) => r.kode));
  if ((await satu(`SELECT to_regclass('public.faskes_modul_override') AS t`)).t) {
    const o = await db.query(`SELECT modul_kode, aktif FROM faskes_modul_override WHERE faskes_uuid = $1`, [fUuid]);
    for (const r of o.rows) (r.aktif ? aktif.add(r.modul_kode) : aktif.delete(r.modul_kode));
  }
  return [...aktif];
}

async function bangunCtx(baris, F) {
  const fUuid = baris.uuid;
  const modul = await modulAktif(fUuid, baris.segmen);
  const punya = (m) => modul.includes(m);
  const penjamin = (await db.query(
    `SELECT uuid, name FROM penjamin WHERE faskes_uuid = $1 AND deleted_at IS NULL AND status ORDER BY created_at, code`, [fUuid])).rows;
  const komponen = {};
  for (const r of (await db.query(
    `SELECT DISTINCT ON (code) code, uuid, name FROM name_tarif_komponen WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY code, created_at`,
    [fUuid])).rows) komponen[r.code] = { uuid: r.uuid, nama: r.name };
  const base = { faskes_uuid: fUuid, created_at: NOW, updated_at: NOW };
  // Segmen diambil dari DB (bisa sudah diubah lewat Manajemen Modul), spesifikasi lain dari katalog.
  const Fdb = { ...F, segmen: baris.segmen };
  return { ins, satu, db, F: Fdb, fUuid, base, punya, level: LEVEL[baris.segmen] ?? 3, penjamin, rupiah, NOW, komponen, modul };
}

(async () => {
  const pilihFaskes = daftar(arg('faskes'));
  const pilihModul = daftar(arg('modul'));
  const kering = process.argv.includes('--kering');
  db = new Client({
    host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
  await db.connect();
  let gagal = 0;
  try {
    const { rows: faskes } = await db.query(
      `SELECT f.uuid, f.code, f.name, fs.segmen_kode AS segmen FROM faskes f
         LEFT JOIN faskes_segmen fs ON fs.faskes_uuid = f.uuid
        WHERE f.deleted_at IS NULL ORDER BY f.code`);
    for (const baris of faskes) {
      if (pilihFaskes && !pilihFaskes.includes(baris.code)) continue;
      const F = K.FASKES.find((x) => x.kode === baris.code);
      if (!F || !baris.segmen) {
        console.log(`- ${baris.code} ${baris.name}: dilewati (bukan faskes demo / tanpa segmen)`);
        continue;
      }
      await db.query('BEGIN');
      try {
        const ctx = await bangunCtx(baris, F);
        const ringkas = [];
        for (const [modul, seed] of MODUL) {
          if (pilihModul && !pilihModul.includes(modul)) continue;
          if (!ctx.punya(modul)) { ringkas.push(`${modul}: modul tidak aktif`); continue; }
          ringkas.push(await seed(ctx));
        }
        await db.query(kering ? 'ROLLBACK' : 'COMMIT');
        console.log(`■ ${baris.code} ${baris.name} (${baris.segmen})${kering ? ' [kering]' : ''}\n  ${ringkas.filter(Boolean).join('\n  ')}`);
      } catch (e) {
        await db.query('ROLLBACK');
        gagal++;
        console.error(`✗ ${baris.code} ${baris.name}: ${e.message}`);
      }
    }
  } finally {
    await db.end();
  }
  if (gagal) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
