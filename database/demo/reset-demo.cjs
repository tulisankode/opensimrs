'use strict';

// Mengosongkan seluruh data faskes (datamaster + transaksi) di PostgreSQL & rekam medis di MongoDB.
// Referensi nasional (wilayah, ICD, SNOMED, LOINC, odontogram) & katalog Manajemen Modul DIPERTAHANKAN.
// Hanya untuk lingkungan lokal/demo. Wajib dijalankan dengan flag --ya.
//   node database/demo/reset-demo.cjs --ya
const path = require('path');
const fs = require('fs');
const { Client } = require('pg');
const dotenv = require('dotenv');

const ROOT = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.join(ROOT, '.env') });

const DIPERTAHANKAN = new Set([
  'SequelizeMeta',
  'provinsi', 'kabupaten', 'kecamatan', 'kelurahan',
  'diagnosis', 'icd9', 'snomed', 'loinc',
  'gigi', 'item_gigi', 'kategori_gigi', 'oklusi_gigi',
  'ref_jenis_poli', 'ref_segmen', 'ref_modul', 'ref_modul_menu', 'ref_fitur', 'ref_bagian', 'ref_bagian_poli', 'ref_rute',
  'preset_segmen_modul', 'preset_segmen_fitur_mati', 'preset_segmen_bagian_mati',
]);
const KOLEKSI_MONGO = ['rekam_medises', 'sessions', 'catatan_perawats', 'instruksi_medises'];

async function resetPostgres() {
  const db = new Client({
    host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
  await db.connect();
  try {
    const { rows } = await db.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`);
    const kosongkan = rows.map((r) => r.tablename).filter((t) => !DIPERTAHANKAN.has(t));
    const hitungTetap = async () => {
      const h = {};
      for (const t of DIPERTAHANKAN) h[t] = Number((await db.query(`SELECT count(*) n FROM "${t}"`)).rows[0].n);
      return h;
    };
    const sebelum = await hitungTetap();
    await db.query(`TRUNCATE ${kosongkan.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
    const sesudah = await hitungTetap();
    const berubah = Object.keys(sebelum).filter((t) => sebelum[t] !== sesudah[t]);
    if (berubah.length) throw new Error(`Tabel referensi ikut berubah: ${berubah.join(', ')}`);
    console.log(`PostgreSQL: ${kosongkan.length} tabel dikosongkan, ${DIPERTAHANKAN.size} tabel referensi utuh.`);
  } finally {
    await db.end();
  }
}

async function resetMongo() {
  const envRm = dotenv.parse(fs.readFileSync(path.join(ROOT, 'rekamedis-service', '.env')));
  const { MongoClient } = require(require.resolve('mongodb', { paths: [path.join(ROOT, 'rekamedis-service')] }));
  const auth = envRm.MONGO_DB_USERNAME
    ? `${encodeURIComponent(envRm.MONGO_DB_USERNAME)}:${encodeURIComponent(envRm.MONGO_DB_PASSWORD)}@` : '';
  const uri = `mongodb://${auth}${envRm.MONGO_DB_HOST || '127.0.0.1'}:${envRm.MONGO_DB_PORT || 27017}/${envRm.MONGO_DB_NAME}`
    + (envRm.MONGO_DB_AUTH_SOURCE ? `?authSource=${envRm.MONGO_DB_AUTH_SOURCE}` : '');
  const klien = new MongoClient(uri);
  await klien.connect();
  try {
    const db = klien.db(envRm.MONGO_DB_NAME);
    for (const k of KOLEKSI_MONGO) {
      const r = await db.collection(k).deleteMany({});
      console.log(`MongoDB ${k}: ${r.deletedCount} dokumen dihapus.`);
    }
  } finally {
    await klien.close();
  }
}

(async () => {
  if (!process.argv.includes('--ya')) {
    console.error('Reset menghapus seluruh data faskes & transaksi. Jalankan ulang dengan --ya bila yakin (backup dahulu).');
    process.exit(1);
  }
  await resetPostgres();
  await resetMongo();
  console.log('Selesai. Kosongkan juga cache Redis (token sesi) dan login ulang.');
})().catch((e) => { console.error(e); process.exit(1); });
