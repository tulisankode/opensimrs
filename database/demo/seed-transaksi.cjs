'use strict';

// Seeder TRANSAKSI demo untuk satu faskes (bawaan: PMD — Praktik dr. Andi Wijaya).
//
// Berbeda dengan seed-demo.cjs (insert datamaster langsung), skrip ini MENDORONG ALUR API SUNGGUHAN seperti yang
// dilakukan layar aplikasi, sehingga data lintas layanan (PostgreSQL, rekam medis MongoDB, tagihan payment-service,
// stok farmasi, antrean) konsisten:
//   1. Pengadaan & penerimaan obat/BMHP ke lokasi stok faskes (inventory-service: PO → verifikasi → penerimaan).
//   2. ±30 pasien fiktif dengan identitas Indonesia yang wajar (~40% BPJS).
//   3. ±60 kunjungan rawat jalan selama 30 hari terakhir: daftar (admisi) → antrean → SOAP Ringkas dokter
//      (asesmen per bagian, tindakan, resep) → resume & discharge → farmasi (telaah, verifikasi, serah)
//      → kasir (bayar & tutup tagihan). Termasuk pasien kontrol ulang dan ~6 kunjungan HARI INI dengan status
//      beragam (selesai, menunggu obat, sedang diperiksa, menunggu).
//   4. Penjualan obat bebas (OTC) di farmasi.
// Karena API memakai waktu "sekarang", setiap episode (kunjungan, PO, penjualan) dicatat per fase lalu SEMUA kolom
// waktu yang ditulis selama fase itu (PostgreSQL & MongoDB) digeser ke tanggal/jam sasaran, termasuk nomor yang
// memuat tanggal (no. registrasi, no. pelayanan, no. antrean, kode invoice). Baris yang dibuat skrip dicatat di
// tabel jejak `demo_jejak_transaksi` agar bisa dihapus lagi dengan --bersihkan (datamaster tidak disentuh).
//
// Prasyarat: datamaster dari seed-demo.cjs dan seluruh layanan backend berjalan (npm run dev).
// Pemakaian:
//   node database/demo/seed-transaksi.cjs [--faskes PMD]          isi data transaksi demo
//   node database/demo/seed-transaksi.cjs --faskes PMD --bersihkan hapus data transaksi yang dibuat skrip ini
// Opsi lain: --hari 30 (rentang hari), --benih <angka> (variasi acak), --dokter <username>, --petugas <username>,
//            --gudang <username>, --apoteker <username>, --kasir <username>. Kata sandi akun dari env DEMO_PASSWORD (bawaan Demo@2026).
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.join(ROOT, '.env') });

// ── Argumen ────────────────────────────────────────────────────────────────────────────────────────────
const arg = (nama, bawaan) => {
  const i = process.argv.indexOf(`--${nama}`);
  if (i < 0) return bawaan;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
};
const KODE_FASKES = String(arg('faskes', 'PMD')).toUpperCase();
const BERSIHKAN = !!arg('bersihkan', false);
const RENTANG_HARI = Math.max(7, Number(arg('hari', 30)) || 30);
const BENIH = Number(arg('benih', 20261014)) || 20261014;
const PASSWORD = process.env.DEMO_PASSWORD || 'Demo@2026';

// ── Alamat API (mengikuti frontend-service/.env; bisa ditimpa variabel lingkungan DEMO_<NAMA>, mis.
//    DEMO_VITE_BASE_ADMISI). .env root tidak dipakai karena sebagian alamat VITE_* di sana berbeda prefiks. ──────
const envFe = (() => {
  try { return dotenv.parse(fs.readFileSync(path.join(ROOT, 'frontend-service', '.env'))); } catch { return {}; }
})();
const alamat = (kunci, bawaan) => (process.env[`DEMO_${kunci}`] || envFe[kunci] || bawaan).replace(/\/+$/, '');
const API = {
  auth: alamat('VITE_BASE_AUTH', 'http://localhost:8083/api/v3/auth'),
  admisi: alamat('VITE_BASE_ADMISI', 'http://localhost:8081/api/v3/admisi'),
  rajal: alamat('VITE_BASE_RAWAT_JALAN', 'http://localhost:8092/api/v3/rawat-jalan').replace(/\/api\/v3\/rawat-jalan$/, '/api/v3/rajal'),
  rm: alamat('VITE_BASE_REKAM_MEDIS', 'http://localhost:8093/api/v3'),
  farmasi: alamat('VITE_BASE_FARMASI', 'http://localhost:8084/api/v3/farmasi'),
  bayar: alamat('VITE_BASE_PEMBAYARAN', 'http://localhost:8089/api/v3/payment'),
  inventory: alamat('VITE_BASE_INVENTORY', 'http://localhost:8086/api/v3/inventory'),
  laporan: alamat('VITE_BASE_DASHBOARD', 'http://localhost:8088/api/v3/laporan'),
  bpjs: alamat('VITE_BASE_BPJS', 'http://localhost:8098/api/v3/bpjs'),
};

// ── Utilitas ───────────────────────────────────────────────────────────────────────────────────────────
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));
const detik = () => Math.floor(Date.now() / 1000);
const WIB = 7 * 3600; // layanan memakai zona waktu server (WIB)
const awalHari = (e) => Math.floor((e + WIB) / 86400) * 86400 - WIB;
const tglIso = (e) => new Date((e + WIB) * 1000).toISOString().slice(0, 10);
const tglDmy = (e) => tglIso(e).split('-').reverse().join('-');
const yymmdd = (e) => tglIso(e).slice(2).replace(/-/g, '');
const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const hariKe = (e) => new Date((e + WIB) * 1000).getUTCDay();
const jam = (hari, hh, mm = 0) => hari + hh * 3600 + mm * 60;
const rupiah = (n) => `Rp${Math.round(n).toLocaleString('id-ID')}`;
const pad = (n, w) => String(n).padStart(w, '0');

// Acak deterministik (mulberry32) agar data dapat diulang sama persis untuk benih yang sama.
let benihAcak = BENIH;
for (const c of KODE_FASKES) benihAcak = (benihAcak * 31 + c.charCodeAt(0)) >>> 0;
const acak = () => {
  benihAcak = (benihAcak + 0x6d2b79f5) >>> 0;
  let t = benihAcak;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const antara = (a, b) => a + Math.floor(acak() * (b - a + 1));
const desimal = (a, b, d = 1) => +(a + acak() * (b - a)).toFixed(d);
const pilih = (arr) => arr[Math.floor(acak() * arr.length)];

// ── PostgreSQL & MongoDB ───────────────────────────────────────────────────────────────────────────────
let db;
const sambungPg = async () => {
  db = new Client({
    host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
  db.on('error', () => {});
  await db.connect();
};
// Kueri dengan percobaan ulang bila koneksi putus sesaat (mis. Postgres di WSL).
const q = async (sql, p = []) => {
  for (let i = 0; ; i++) {
    try {
      return await db.query(sql, p);
    } catch (e) {
      if (i < 5 && /ETIMEDOUT|ECONNRESET|ECONNREFUSED|terminated|not queryable|Connection/i.test(e.message)) {
        await tidur(1000 * (i + 1));
        try { await db.end(); } catch { /* abaikan */ }
        try { await sambungPg(); } catch { /* dicoba lagi */ }
        continue;
      }
      throw e;
    }
  }
};
const satu = async (sql, p = []) => (await q(sql, p)).rows[0];

let mongo;
let mdb;
const sambungMongo = async () => {
  const envRm = dotenv.parse(fs.readFileSync(path.join(ROOT, 'rekamedis-service', '.env')));
  const { MongoClient } = require(require.resolve('mongodb', { paths: [path.join(ROOT, 'rekamedis-service')] }));
  const auth = envRm.MONGO_DB_USERNAME ? `${encodeURIComponent(envRm.MONGO_DB_USERNAME)}:${encodeURIComponent(envRm.MONGO_DB_PASSWORD)}@` : '';
  const uri = `mongodb://${auth}${envRm.MONGO_DB_HOST || '127.0.0.1'}:${envRm.MONGO_DB_PORT || 27017}/${envRm.MONGO_DB_NAME}`
    + (envRm.MONGO_DB_AUTH_SOURCE ? `?authSource=${envRm.MONGO_DB_AUTH_SOURCE}` : '');
  mongo = new MongoClient(uri);
  await mongo.connect();
  mdb = mongo.db(envRm.MONGO_DB_NAME);
};
const keObjectId = (s) => {
  const { ObjectId } = require(require.resolve('mongodb', { paths: [path.join(ROOT, 'rekamedis-service')] }));
  return new ObjectId(String(s));
};

// ── Klien API (meniru axios frontend: body snake_case, header Authorization "Bearer <token>") ───────────────
class GalatApi extends Error {}
const akun = {}; // peran -> { username, token }
const masuk = async (peran) => {
  const a = akun[peran];
  const r = await fetch(`${API.auth}/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: a.username, password: PASSWORD }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.payload?.token) throw new GalatApi(`Login ${a.username} gagal: ${j?.message ?? r.status}`);
  a.token = `Bearer ${j.payload.token}`;
};
// payment-service membatasi 100 permintaan / 5 menit per IP (termasuk panggilan internal antar-layanan dari
// localhost: tagihan tindakan & obat). Panggilan yang mengenai payment-service diberi jeda agar tetap di bawah batas.
const BATAS_BAYAR = Number(process.env.DEMO_BATAS_PAYMENT || 70);
const riwayatBayar = [];
// Sisa kuota menurut payment-service (header x-ratelimit-*). Kuota dihitung per IP dan berlanjut lintas proses, mis. dari
// faskes yang baru selesai di-seed; tanpa ini seeder mengira kuota penuh dan panggilan internal rekamedis→payment kena
// 429 ("Terjadi kesalahan pada kirim data Pembayaran").
const kuotaPayment = { sisa: null, reset: 0 };
const catatKuota = (r) => {
  const sisa = r?.headers?.get('x-ratelimit-remaining');
  if (sisa === null || sisa === undefined) return;
  kuotaPayment.sisa = Number(sisa);
  kuotaPayment.reset = Number(r.headers.get('x-ratelimit-reset')) || 0;
};
const tungguResetKuota = async (alasan) => {
  const tunggu = kuotaPayment.reset * 1000 - Date.now() + 1500;
  if (tunggu > 0) {
    process.stdout.write(` (jeda ${Math.ceil(tunggu / 1000)} dtk: ${alasan})`);
    await tidur(tunggu);
  }
  kuotaPayment.sisa = null;
  riwayatBayar.length = 0;
};
const kenaPayment = (layanan, jalur) => layanan === 'bayar' || /\/rekam-medis\/tindakan|status-verifikasi/.test(jalur);
const aturLajuBayar = async () => {
  // Sisakan ruang untuk panggilan internal layanan lain ke payment-service (tagihan tindakan & obat).
  if (kuotaPayment.sisa !== null && kuotaPayment.sisa < 15) await tungguResetKuota('kuota payment-service menipis');
  for (;;) {
    const kini = Date.now();
    while (riwayatBayar.length && kini - riwayatBayar[0] > 300000) riwayatBayar.shift();
    if (riwayatBayar.length < BATAS_BAYAR) { riwayatBayar.push(kini); return; }
    const tunggu = 300000 - (kini - riwayatBayar[0]) + 500;
    process.stdout.write(` (jeda ${Math.ceil(tunggu / 1000)} dtk: batas laju payment-service)`);
    await tidur(tunggu);
  }
};
// Tunggu sampai kuota limiter payment-service pulih (mis. sisa dari aktivitas sebelumnya) sebelum mulai.
const tungguPaymentSiap = async () => {
  for (let i = 0; i < 12; i++) {
    const r = await fetch(`${API.bayar}/cashier/check`, { headers: { Authorization: akun.kasir.token } }).catch(() => null);
    catatKuota(r);
    // Mulai dengan jendela kuota baru bila sisa kuota tidak cukup untuk laju BATAS_BAYAR.
    if (r && r.status !== 429 && (kuotaPayment.sisa === null || kuotaPayment.sisa >= 100 - 5)) return;
    if (r && kuotaPayment.reset) { await tungguResetKuota('menunggu kuota payment-service pulih'); continue; }
    process.stdout.write(i ? '.' : 'Menunggu batas laju payment-service pulih');
    await tidur(30000);
  }
};
const api = async (peran, metode, layanan, jalur, isi) => {
  if (kenaPayment(layanan, jalur)) await aturLajuBayar();
  for (let coba = 0; ; coba++) {
    let r;
    try {
      r = await fetch(API[layanan] + jalur, {
        method: metode,
        headers: { 'content-type': 'application/json', Authorization: akun[peran].token },
        body: isi === undefined ? undefined : JSON.stringify(isi),
      });
    } catch (e) {
      // layanan sedang dimulai ulang (nodemon) / jaringan sesaat
      if (coba < 8) { await tidur(1500); continue; }
      throw new GalatApi(`${metode} ${layanan}${jalur}: ${e.message}`);
    }
    if (layanan === 'bayar') catatKuota(r);
    if (r.status === 401 && coba < 2) { await masuk(peran); continue; }
    if (r.status === 429 && coba < 8) { process.stdout.write(' (429, menunggu 60 dtk)'); await tidur(60000); continue; }
    const teks = await r.text();
    let j;
    try { j = JSON.parse(teks); } catch { j = teks; }
    if (!r.ok) {
      const pesan = typeof j === 'string' ? j.slice(0, 300) : JSON.stringify(j).slice(0, 800);
      throw new GalatApi(`${metode} ${layanan}${jalur} → ${r.status} ${pesan}`);
    }
    return j;
  }
};
const GET = (peran, l, j) => api(peran, 'GET', l, j);
const POST = (peran, l, j, b = {}) => api(peran, 'POST', l, j, b);
const PUT = (peran, l, j, b = {}) => api(peran, 'PUT', l, j, b);

// ════════════════════════════════════════════════════════════════════════════════════════════════════════
// Katalog data klinis
// ════════════════════════════════════════════════════════════════════════════════════════════════════════
// Baris resep: [kode obat, jumlah, aturan pakai, catatan, dosis?, satuan dosis?, cara pakai?, rute?]
const KASUS = {
  ISPA: {
    dx: ['J06.9'], vital: 'demam',
    keluhan: ['Batuk pilek sejak 3 hari, demam naik turun, tenggorokan terasa gatal', 'Pilek dan batuk kering sejak 2 hari, badan meriang',
      'Batuk berdahak dan hidung tersumbat sejak 4 hari, demam semalam'],
    riwayat: 'Tidak ada riwayat penyakit kronis. Sudah minum obat warung, belum membaik.',
    fisik: ['Faring hiperemis, tonsil T1-T1 tenang. Paru vesikuler, ronkhi -/-, wheezing -/-', 'Mukosa hidung hiperemis, sekret serous. Faring hiperemis ringan. Paru dalam batas normal'],
    resep: [['PCT500', 10, '3X1', 'Diminum bila demam'], ['CTM4', 10, '3X1', 'Sesudah makan'], ['AMB30', 10, '3X1', 'Sesudah makan']],
    anak: [['PCT-SR', 1, '3X1', 'Bila demam, 1 sendok takar (5 ml)', 5, 'ML'], ['OBH-SR', 1, '3X1', '1 sendok takar (5 ml) sesudah makan', 5, 'ML']],
  },
  FARING: {
    dx: ['J02.9'], vital: 'demam',
    keluhan: ['Nyeri menelan sejak 2 hari disertai demam', 'Tenggorokan sakit dan suara serak sejak 3 hari'],
    riwayat: 'Riwayat radang tenggorokan berulang. Alergi obat disangkal.',
    fisik: ['Faring hiperemis, tonsil T2-T2 hiperemis, detritus (-). KGB submandibula teraba kecil, nyeri tekan (+)'],
    resep: [['AMX500', 15, '3X1', 'Dihabiskan, sesudah makan'], ['PCT500', 10, '3X1', 'Bila demam/nyeri'], ['DXM05', 6, '2X1', 'Sesudah makan']],
    anak: [['AMX-SR', 1, '3X1', 'Dihabiskan, 1 sendok takar (5 ml)', 5, 'ML'], ['PCT-SR', 1, '3X1', 'Bila demam, 1 sendok takar (5 ml)', 5, 'ML']],
  },
  COMMONCOLD: {
    dx: ['J00'], vital: 'normal',
    keluhan: ['Pilek, bersin-bersin dan hidung tersumbat sejak kemarin', 'Hidung meler dan badan pegal sejak 2 hari'],
    riwayat: 'Kontak dengan anggota keluarga yang sedang pilek.',
    fisik: ['Konka edema, sekret serous. Faring tenang. Paru vesikuler'],
    resep: [['PCT500', 10, '3X1', 'Bila demam/pusing'], ['CTM4', 10, '3X1', 'Dapat menimbulkan kantuk'], ['VTC50', 10, '1X1', 'Sesudah makan']],
  },
  BRONKITIS: {
    dx: ['J20.9'], vital: 'demam',
    keluhan: ['Batuk berdahak kental sudah 1 minggu, kadang sesak ringan', 'Batuk terus-menerus terutama malam hari sejak 6 hari'],
    riwayat: 'Perokok aktif ±10 batang/hari.',
    fisik: ['Ronkhi basah kasar +/+ di basal paru, wheezing -/-'],
    resep: [['AMB30', 10, '3X1', 'Sesudah makan'], ['SAL2', 10, '3X1', 'Sesudah makan'], ['OBH-SR', 1, '3X1', '1 sendok makan (15 ml)', 15, 'ML']],
    kontrol: { keluhan: 'Kontrol batuk, dahak berkurang, sesak sudah tidak ada', fisik: 'Ronkhi minimal di basal kanan, wheezing -/-',
      resep: [['AMB30', 10, '3X1', 'Sesudah makan']] },
  },
  ASMA: {
    dx: ['J45.9'], vital: 'sesak', keadaan: 'sedang', tindakan: [['T-NEBU', 1]],
    keluhan: ['Sesak napas dan mengi sejak tadi pagi setelah terkena debu', 'Sesak napas kambuh sejak semalam, batuk-batuk'],
    riwayat: 'Riwayat asma sejak kecil, kambuh bila kelelahan atau terpapar debu.',
    fisik: ['Ekspirasi memanjang, wheezing +/+ di seluruh lapang paru, retraksi (-)'],
    resep: [['SAL2', 10, '3X1', 'Sesudah makan'], ['DXM05', 6, '2X1', 'Sesudah makan']],
    kontrol: { keluhan: 'Kontrol asma, sesak sudah berkurang, masih batuk sesekali', fisik: 'Wheezing minimal -/-, ekspirasi normal',
      resep: [['SAL2', 10, '2X1', 'Bila sesak']], tindakan: [], keadaan: 'baik', vital: 'normal' },
  },
  RHINITIS: {
    dx: ['J30.4'], vital: 'normal',
    keluhan: ['Bersin-bersin dan hidung meler tiap pagi sejak 2 minggu', 'Hidung gatal dan berair terutama saat cuaca dingin'],
    riwayat: 'Riwayat alergi debu rumah.',
    fisik: ['Konka inferior edema dan pucat, sekret serous'],
    resep: [['CTZ10', 10, '1X1', 'Diminum malam hari']],
  },
  GASTRITIS: {
    dx: ['K29.7'], vital: 'normal',
    keluhan: ['Nyeri ulu hati, mual dan perut kembung sejak 2 hari, sering telat makan', 'Perih di ulu hati terutama malam hari, kadang mual'],
    riwayat: 'Sering telat makan dan minum kopi.',
    fisik: ['Nyeri tekan epigastrium (+), bising usus normal, hepar/lien tidak teraba'],
    resep: [['OMZ20', 10, '1X1', 'Diminum 30 menit sebelum makan pagi'], ['ANT-DOE', 15, '3X1', 'Dikunyah sebelum makan'], ['DOM10', 10, '3X1', 'Sebelum makan']],
  },
  DISPEPSIA: {
    dx: ['K30'], vital: 'normal',
    keluhan: ['Perut terasa penuh dan begah setelah makan, sering sendawa', 'Cepat kenyang dan mual setelah makan sejak seminggu'],
    riwayat: 'Pola makan tidak teratur.',
    fisik: ['Nyeri tekan epigastrium ringan, timpani, bising usus normal'],
    resep: [['ANT-DOE', 15, '3X1', 'Dikunyah sebelum makan'], ['DOM10', 10, '3X1', 'Sebelum makan']],
  },
  DIARE: {
    dx: ['A09'], vital: 'demam', keadaan: 'sedang',
    keluhan: ['BAB cair 5 kali sejak kemarin, mual, badan lemas', 'Mencret 4 kali hari ini disertai mulas'],
    riwayat: 'Makan makanan pedas di warung kemarin siang.',
    fisik: ['Turgor kulit baik, mata tidak cekung. Bising usus meningkat, nyeri tekan perut (-)'],
    resep: [['ORALIT', 6, 'PRN', 'Larutkan 1 bungkus dalam 200 ml air, minum tiap habis BAB cair', 1, 'SACH'], ['ZNC20', 10, '1X1', 'Diminum 10 hari berturut-turut'], ['PCT500', 6, '3X1', 'Bila demam']],
    anak: [['ORALIT', 6, 'PRN', 'Larutkan 1 bungkus dalam 200 ml air, minum sedikit-sedikit tiap habis BAB cair', 1, 'SACH'], ['ZNC20', 10, '1X1', 'Dilarutkan, 10 hari berturut-turut'], ['PCT-SR', 1, '3X1', 'Bila demam, 1 sendok takar (5 ml)', 5, 'ML']],
  },
  HT: {
    dx: ['I10'], vital: 'ht',
    keluhan: ['Tengkuk terasa berat dan pusing sejak 3 hari', 'Kepala pusing dan tengkuk kaku, tensi di rumah 160'],
    riwayat: 'Riwayat hipertensi sejak 3 tahun, minum obat tidak teratur.',
    fisik: ['Konjungtiva tidak anemis. Jantung: S1 S2 tunggal reguler, murmur (-). Edema tungkai (-)'],
    resep: [['AML5', 30, '1X1', 'Diminum pagi hari, rutin setiap hari']],
    kontrol: { keluhan: 'Kontrol rutin tekanan darah, obat habis. Keluhan pusing sudah berkurang', vital: 'htKontrol',
      fisik: 'Jantung: S1 S2 tunggal reguler. Edema tungkai (-). Kepatuhan minum obat baik', resep: [['AML5', 30, '1X1', 'Diminum pagi hari, rutin setiap hari']] },
  },
  DM: {
    dx: ['E11.9'], vital: 'normal',
    keluhan: ['Sering haus dan sering kencing malam hari, badan mudah lelah', 'Kesemutan di kedua telapak kaki, GDP di rumah 180'],
    riwayat: 'Riwayat kencing manis sejak 2 tahun. Ibu kandung juga menderita DM.',
    fisik: ['Akral hangat, tidak ada luka di kaki, sensibilitas kaki baik. GDS stik 214 mg/dL'],
    resep: [['MTF500', 60, '2X1', 'Sesudah makan pagi dan malam'], ['GLB5', 30, '1X1', '15 menit sebelum makan pagi']],
    kontrol: { keluhan: 'Kontrol gula darah rutin, obat habis. Tidak ada keluhan baru', fisik: 'Akral hangat, luka kaki (-). GDS stik 156 mg/dL',
      resep: [['MTF500', 60, '2X1', 'Sesudah makan pagi dan malam'], ['GLB5', 30, '1X1', '15 menit sebelum makan pagi']] },
  },
  MYALGIA: {
    dx: ['M79.1'], vital: 'normal',
    keluhan: ['Pegal dan nyeri otot bahu serta punggung setelah kerja berat', 'Badan pegal-pegal dan linu sejak 3 hari'],
    riwayat: 'Bekerja mengangkat barang.',
    fisik: ['Nyeri tekan otot trapezius bilateral, gerak sendi bebas, kekuatan otot 5/5'],
    resep: [['IBU400', 10, '3X1', 'Sesudah makan'], ['VTB-CO', 10, '1X1', 'Sesudah makan']],
  },
  LBP: {
    dx: ['M54.5'], vital: 'normal',
    keluhan: ['Nyeri pinggang bawah setelah mengangkat galon kemarin', 'Pinggang kaku dan nyeri saat membungkuk sejak 4 hari'],
    riwayat: 'Tidak ada trauma jatuh. Tidak ada nyeri menjalar ke kaki.',
    fisik: ['Nyeri tekan paravertebra lumbal, Lasegue (-), kekuatan motorik tungkai 5/5'],
    resep: [['ASM500', 10, '3X1', 'Sesudah makan'], ['VTB-CO', 10, '1X1', 'Sesudah makan']],
  },
  GOUT: {
    dx: ['M10.9'], vital: 'normal',
    keluhan: ['Nyeri dan bengkak pada pangkal jempol kaki kanan sejak semalam'],
    riwayat: 'Sering makan jeroan dan emping. Riwayat asam urat tinggi.',
    fisik: ['MTP-1 dekstra edema, hiperemis, hangat dan nyeri tekan (+)'],
    resep: [['IBU400', 10, '3X1', 'Sesudah makan']],
  },
  CEPHALGIA: {
    dx: ['R51'], vital: 'normal',
    keluhan: ['Sakit kepala berdenyut sejak semalam, kurang tidur', 'Kepala terasa berat dan nyeri di kedua pelipis sejak 2 hari'],
    riwayat: 'Sedang banyak pekerjaan, tidur kurang dari 5 jam.',
    fisik: ['Tanda rangsang meningeal (-), pemeriksaan neurologis dalam batas normal'],
    resep: [['ASM500', 10, '3X1', 'Sesudah makan'], ['VTB-CO', 10, '1X1', 'Sesudah makan']],
  },
  ISK: {
    dx: ['N39.0'], vital: 'demam',
    keluhan: ['Nyeri dan anyang-anyangan saat buang air kecil sejak 3 hari', 'BAK terasa panas dan sering namun sedikit-sedikit'],
    riwayat: 'Kurang minum air putih.',
    fisik: ['Nyeri tekan suprapubik (+), nyeri ketok CVA -/-'],
    resep: [['AMX500', 15, '3X1', 'Dihabiskan, sesudah makan'], ['PCT500', 10, '3X1', 'Bila nyeri/demam']],
    kontrol: { keluhan: 'Kontrol, nyeri BAK sudah hilang, obat sudah habis', fisik: 'Nyeri tekan suprapubik (-)', resep: [['VTC50', 10, '1X1', 'Sesudah makan']], vital: 'normal' },
  },
  DERMATITIS: {
    dx: ['L30.9'], vital: 'normal',
    keluhan: ['Gatal dan kemerahan di kedua lengan sejak 4 hari', 'Ruam gatal di leher setelah memakai kalung imitasi'],
    riwayat: 'Kulit sensitif, baru ganti sabun cuci.',
    fisik: ['Makula eritema batas tidak tegas dengan papul dan ekskoriasi di regio antebrachii'],
    resep: [['CTZ10', 10, '1X1', 'Diminum malam hari'], ['DXM05', 10, '3X1', 'Sesudah makan']],
  },
  URTIKARIA: {
    dx: ['L50.9'], vital: 'normal', alergi: ['Makanan', 'Udang dan kerang', 'Biduran gatal'],
    keluhan: ['Biduran gatal di seluruh badan setelah makan seafood', 'Bentol-bentol merah dan gatal sejak tadi siang'],
    riwayat: 'Riwayat alergi makanan laut.',
    fisik: ['Urtika eritema multipel di badan dan ekstremitas, angioedema (-)'],
    resep: [['CTZ10', 10, '1X1', 'Diminum malam hari'], ['DXM05', 10, '3X1', 'Sesudah makan']],
  },
  ABSES: {
    dx: ['L02.9'], vital: 'demam', tindakan: [['T-RWT-LK', 1]],
    keluhan: ['Benjolan bernanah dan nyeri di paha kanan sejak 5 hari', 'Bisul di bokong makin membesar dan nyeri'],
    riwayat: 'Riwayat bisul berulang.',
    fisik: ['Nodul eritema diameter 2 cm dengan fluktuasi (+) dan pus. Dilakukan insisi drainase dan perawatan luka'],
    resep: [['AMX500', 15, '3X1', 'Dihabiskan, sesudah makan'], ['ASM500', 10, '3X1', 'Bila nyeri'], ['GNT-SL', 1, '2X1', 'Oleskan tipis pada luka', 1, 'GR', 'TPK', 'TD'], ['KASA', 5, '1X1', 'Ganti balutan tiap hari', 1, 'PCS', 'TPK', 'TD']],
    kontrol: { keluhan: 'Kontrol luka bekas bisul, nyeri berkurang, pus minimal', fisik: 'Luka bersih, granulasi baik, pus (-). Dilakukan perawatan luka',
      resep: [['GNT-SL', 1, '2X1', 'Oleskan tipis pada luka', 1, 'GR', 'TPK', 'TD'], ['PLS', 5, '1X1', 'Ganti balutan tiap hari', 1, 'PCS', 'TPK', 'TD']], tindakan: [['T-RWT-LK', 1]], vital: 'normal' },
  },
  DEMAM: {
    dx: ['R50.9'], vital: 'demam',
    keluhan: ['Demam sejak kemarin sore, anak rewel dan nafsu makan turun', 'Badan panas sejak 2 hari, sudah diberi obat penurun panas'],
    riwayat: 'Imunisasi dasar lengkap. Tidak ada kejang.',
    fisik: ['Faring hiperemis ringan, tonsil T1-T1. Paru vesikuler. Tanda dehidrasi (-)'],
    resep: [['PCT500', 10, '3X1', 'Bila demam']],
    anak: [['PCT-SR', 1, '4X1', 'Bila demam > 38°C, 1 sendok takar (5 ml)', 5, 'ML'], ['VTC50', 10, '1X1', 'Sesudah makan']],
  },
};

// Pasien fiktif: [gelar, nama, L/P, tgl lahir, tempat lahir, agama, status kawin, nama ibu, BPJS?, kasus...]
// Kasus "KODE@status" = kunjungan HARI INI (selesai | tunggu_obat | diperiksa | menunggu).
const PASIEN = [
  ['Tn. (Tuan)', 'Bambang Sutrisno', 'L', '1971-03-12', 'Surabaya', 'Islam', 'Kawin', 'Sumiati', true, 'HT', 'HT', 'ISPA'],
  ['Ny. (Nyonya)', 'Siti Aminah', 'P', '1968-08-21', 'Lamongan', 'Islam', 'Kawin', 'Rukayah', true, 'HT', 'HT', 'MYALGIA'],
  ['Tn. (Tuan)', 'Hendro Wibowo', 'L', '1966-11-02', 'Madiun', 'Islam', 'Kawin', 'Sri Mulyani', true, 'DM', 'DM'],
  ['Ny. (Nyonya)', 'Endang Sri Wahyuni', 'P', '1963-05-17', 'Kediri', 'Islam', 'Kawin', 'Suwarni', true, 'DM', 'DM', 'GASTRITIS'],
  ['Tn. (Tuan)', 'Slamet Riyadi', 'L', '1958-01-30', 'Surabaya', 'Islam', 'Kawin', 'Painah', true, 'HT', 'HT', 'HT@selesai'],
  ['Tn. (Tuan)', 'Suparman', 'L', '1955-09-09', 'Mojokerto', 'Islam', 'Kawin', 'Sainem', false, 'DM', 'DM'],
  ['Ny. (Nyonya)', 'Maria Magdalena Tjahjono', 'P', '1960-12-24', 'Malang', 'Katolik', 'Cerai Mati', 'Theresia Kusuma', false, 'HT', 'HT', 'LBP'],
  ['Ny. (Nyonya)', 'Sri Rahayu', 'P', '1950-04-11', 'Tuban', 'Islam', 'Cerai Mati', 'Kasmini', true, 'MYALGIA', 'HT'],
  ['Tn. (Tuan)', 'Agus Salim Hidayat', 'L', '1984-07-07', 'Gresik', 'Islam', 'Kawin', 'Hasanah', false, 'CEPHALGIA', 'GASTRITIS@tunggu_obat'],
  ['Ny. (Nyonya)', 'Dewi Kartika Sari', 'P', '1987-02-14', 'Sidoarjo', 'Islam', 'Kawin', 'Wiwik Suryani', false, 'ISK', 'ISK'],
  ['Nn. (Nona)', 'Rina Marlina', 'P', '1992-10-03', 'Jember', 'Islam', 'Belum Kawin', 'Suprihatin', false, 'FARING', 'ISPA@selesai'],
  ['Tn. (Tuan)', 'Yohanes Setiawan', 'L', '1979-06-19', 'Surabaya', 'Kristen', 'Kawin', 'Lidia Hartati', false, 'GOUT', 'LBP'],
  ['Tn. (Tuan)', 'Kevin Wijaya Tanoto', 'L', '1993-01-26', 'Surabaya', 'Buddha', 'Belum Kawin', 'Lily Gunawan', false, 'URTIKARIA'],
  ['Tn. (Tuan)', 'Moch. Ridwan Fauzi', 'L', '1990-03-28', 'Bangkalan', 'Islam', 'Kawin', 'Siti Maimunah', true, 'DIARE', 'COMMONCOLD'],
  ['Sdr. (Saudara)', 'Dimas Arya Pratama', 'L', '1998-08-05', 'Surabaya', 'Islam', 'Belum Kawin', 'Yuli Astutik', false, 'ABSES', 'ABSES'],
  ['Ny. (Nyonya)', 'Lilik Suryani', 'P', '1974-11-15', 'Pasuruan', 'Islam', 'Kawin', 'Sutinah', true, 'DISPEPSIA', 'CEPHALGIA'],
  ['Ny. (Nyonya)', 'Yuliana Kristanti', 'P', '1985-09-22', 'Surabaya', 'Kristen', 'Kawin', 'Ester Sulistyowati', false, 'RHINITIS', 'FARING'],
  ['Nn. (Nona)', 'Fitri Handayani', 'P', '1996-05-09', 'Probolinggo', 'Islam', 'Belum Kawin', 'Musrifah', false, 'DERMATITIS@menunggu'],
  ['Ny. (Nyonya)', 'Nur Hasanah', 'P', '1980-12-01', 'Bangkalan', 'Islam', 'Kawin', 'Aisyah', true, 'GASTRITIS', 'MYALGIA'],
  ['Nn. (Nona)', 'Anisa Rahmawati', 'P', '2003-04-18', 'Surabaya', 'Islam', 'Belum Kawin', 'Ernawati', false, 'ISPA', 'DERMATITIS'],
  ['Sdr. (Saudara)', 'Muhammad Faisal', 'L', '2001-02-27', 'Sumenep', 'Islam', 'Belum Kawin', 'Halimah', false, 'DIARE'],
  ['Tn. (Tuan)', 'Abdul Rochim', 'L', '1975-10-10', 'Pamekasan', 'Islam', 'Kawin', 'Fatimah', false, 'LBP', 'MYALGIA@menunggu'],
  ['Tn. (Tuan)', 'Rudi Hartono', 'L', '1982-06-03', 'Surabaya', 'Islam', 'Kawin', 'Kustiyah', true, 'BRONKITIS', 'BRONKITIS'],
  ['Nn. (Nona)', 'Zahra Amelia Putri', 'P', '2009-01-12', 'Surabaya', 'Islam', 'Belum Kawin', 'Lestari Ningsih', false, 'FARING'],
  ['An. (Anak)', 'Alif Ramadhan', 'L', '2018-06-15', 'Surabaya', 'Islam', 'Belum Kawin', 'Novi Andriani', true, 'ISPA', 'DIARE'],
  ['An. (Anak)', 'Nayla Putri Azzahra', 'P', '2020-02-20', 'Surabaya', 'Islam', 'Belum Kawin', 'Dian Puspitasari', false, 'DEMAM', 'DEMAM@diperiksa'],
  ['An. (Anak)', 'Raka Aditya Nugroho', 'L', '2015-09-01', 'Sidoarjo', 'Islam', 'Belum Kawin', 'Ratna Wulandari', true, 'ASMA', 'ASMA'],
  ['An. (Anak)', 'Keisha Aurelia Santoso', 'P', '2013-03-08', 'Surabaya', 'Kristen', 'Belum Kawin', 'Melinda Halim', false, 'ISPA'],
  ['An. (Anak)', 'Bima Satria Pamungkas', 'L', '2021-11-23', 'Surabaya', 'Islam', 'Belum Kawin', 'Wahyu Kusumaningrum', false, 'DIARE'],
  ['Tn. (Tuan)', 'Ahmad Zainuddin', 'L', '1988-12-05', 'Gresik', 'Islam', 'Kawin', 'Khoiriyah', false, 'URTIKARIA', 'COMMONCOLD'],
];
const KASUS_KRONIS = new Set(['HT', 'DM']);
const DX_SEKUNDER = { 'Hendro Wibowo': ['I10'] }; // komorbid
const OBAT_KRONIS_TAMBAHAN = { 'Hendro Wibowo': [['AML5', 30, '1X1', 'Diminum pagi hari']] };

// Wilayah Surabaya sekitar Gubeng (dipakai bila faskes di Kota Surabaya): kelurahan → [kode pos, nama jalan]
const WILAYAH_SBY = {
  3578081001: ['60281', ['Jl. Gubeng Klingsingan', 'Jl. Kalibokor Gg. II']],
  3578081002: ['60285', ['Jl. Mojo Klanggru Wetan', 'Jl. Karang Menjangan', 'Jl. Kalidami']],
  3578081003: ['60286', ['Jl. Dharmawangsa', 'Jl. Airlangga Gg. Lebar']],
  3578081004: ['60282', ['Jl. Kertajaya Gg. VI', 'Jl. Pucang Anom Timur']],
  3578081005: ['60284', ['Jl. Bratang Binangun', 'Jl. Barata Jaya XIX', 'Jl. Kalibokor Timur']],
  3578081006: ['60283', ['Jl. Pucang Jajar Selatan', 'Jl. Pucang Kerep']],
  3578101002: ['60133', ['Jl. Ploso Timur', 'Jl. Bronggalan Sawah']],
  3578101005: ['60135', ['Jl. Rangkah Buntu', 'Jl. Rangkah VII']],
  3578101006: ['60131', ['Jl. Pacar Keling', 'Jl. Jolotundo Baru']],
  3578091003: ['60117', ['Jl. Klampis Jaya', 'Jl. Klampis Semolo Timur']],
  3578091004: ['60118', ['Jl. Menur Pumpungan', 'Jl. Manyar Kertoadi']],
  3578091006: ['60119', ['Jl. Semolowaru Elok', 'Jl. Semolowaru Tengah']],
  3578261002: ['60116', ['Jl. Manyar Rejo', 'Jl. Manyar Sabrangan']],
  3578261006: ['60114', ['Jl. Kalijudan Taruna', 'Jl. Kalijudan Asri']],
};
const JALAN_UMUM = ['Jl. Melati', 'Jl. Kenanga', 'Jl. Diponegoro', 'Jl. Ahmad Yani', 'Jl. Pahlawan', 'Perum Griya Asri Blok C', 'Jl. Hasanuddin', 'Jl. Raya Desa', 'Jl. Mawar Gg. 3', 'Jl. Kartini'];
const PEMBELI_OTC = [['Ibu Wartini', '081200000001'], ['Pak Joko Susilo', '081200000002'], ['Ibu Lina Wijayanti', '081200000003'],
  ['Mas Fajar', '081200000004'], ['Ibu Sri Wahyuni', '081200000005'], ['Pak Hartono', '081200000006'], ['Mbak Desi', '081200000007'],
  ['Ibu Yayuk', '081200000008'], ['Pak Sugeng', '081200000009'], ['Ibu Rohmah', '081200000010'], ['Mas Andre', '081200000011']];
const PAKET_OTC = [[['PCT500', 10]], [['VTC50', 10], ['PCT500', 10]], [['ANT-DOE', 10]], [['ORALIT', 5]], [['OBH-SR', 1]],
  [['CTM4', 10], ['PCT500', 10]], [['PLS', 10]], [['VTB-CO', 10]], [['ANT-DOE', 10], ['VTC50', 10]], [['PCT-SR', 1]]];

// ════════════════════════════════════════════════════════════════════════════════════════════════════════
// Konteks faskes
// ════════════════════════════════════════════════════════════════════════════════════════════════════════
const K = {};
async function muatKonteks() {
  const f = await satu(`SELECT uuid, name FROM faskes WHERE code = $1 AND deleted_at IS NULL`, [KODE_FASKES]);
  if (!f) throw new Error(`Faskes dengan kode ${KODE_FASKES} tidak ditemukan. Jalankan seed-demo.cjs terlebih dahulu.`);
  K.faskes = f.uuid;
  K.namaFaskes = f.name;
  const profil = await satu(`SELECT fp.code_kabupaten, a.district, a.postal_code FROM faskes_profiles fp LEFT JOIN addresses a ON a.uuid = fp.address_uuid WHERE fp.uuid = $1`, [K.faskes]);
  K.kab = profil?.code_kabupaten;
  K.kodePos = profil?.postal_code || '60000';
  K.kecFaskes = profil?.district;

  // Akun: dokter (RME & resep), petugas (pendaftaran), apoteker (farmasi), kasir (pembayaran), gudang (pengadaan)
  const users = (await q(`SELECT u.username, u.practitioner_uuid, r.code FROM users u JOIN role r ON r.uuid = u.role_uuid
                           WHERE u.faskes_uuid = $1 AND u.deleted_at IS NULL AND u.status`, [K.faskes])).rows;
  const peran = (akhiran) => users.find((u) => akhiran.some((a) => u.code.endsWith(a)))?.username;
  return { users, peran };
}

async function siapkanAkun({ users, peran }) {
  // Jadwal dokter hari ini (pendaftaran hanya menerima jadwal hari ini)
  const dokterUser = arg('dokter', null) || peran(['-OWN']) || users.find((u) => u.code.endsWith('-DOK'))?.username;
  if (!dokterUser) throw new Error('Akun dokter faskes tidak ditemukan (gunakan --dokter <username>)');
  akun.dokter = { username: dokterUser };
  akun.petugas = { username: arg('petugas', null) || peran(['-AST', '-PDF', '-ADM']) || dokterUser };
  akun.gudang = { username: arg('gudang', null) || peran(['-OWN', '-GDG', '-ADM']) || dokterUser };
  // Izin per peran: akun pendaftaran tidak punya izin Farmasi/Pembayaran → apoteker & kasir memakai akun perannya sendiri.
  akun.apoteker = { username: arg('apoteker', null) || peran(['-APT', '-AST', '-ADM']) || akun.petugas.username };
  akun.kasir = { username: arg('kasir', null) || peran(['-KSR', '-AST', '-ADM']) || akun.petugas.username };
  for (const p of ['dokter', 'petugas', 'gudang', 'apoteker', 'kasir']) await masuk(p);
  const praktisiDokter = users.find((u) => u.username === dokterUser)?.practitioner_uuid;

  const jd = (await GET('petugas', 'admisi', '/rawat-jalan/jadwal-dokter')).payload ?? [];
  const hariIni = NAMA_HARI[hariKe(detik())];
  const grup = jd.find((g) => (!praktisiDokter || g.doctor?.uuid === praktisiDokter)
    && (g.jadwal_dokter ?? []).some((j) => j.day === hariIni && j.status === 'aktif'));
  if (!grup) throw new Error(`Dokter ${dokterUser} tidak memiliki jadwal aktif hari ${hariIni}`);
  K.dokter = { uuid: grup.doctor.uuid, nama: grup.doctor.name };
  K.poli = { uuid: grup.poli.uuid, nama: grup.poli.name };
  K.jadwal = Object.fromEntries(grup.jadwal_dokter.filter((j) => j.status === 'aktif').map((j) => [j.day, j.jadwal_dokter_uuid]));
  K.hariPraktik = new Set(Object.keys(K.jadwal));
  const pg = await satu(`SELECT pg.name, pg.first_title FROM practitioner p JOIN pegawai pg ON pg.uuid = p.pegawai_uuid WHERE p.uuid = $1`, [K.dokter.uuid]);
  K.dokter.tampil = [pg?.first_title, pg?.name].filter(Boolean).join(' ');
  const namaStaf = async (username) => (await satu(`SELECT pg.name FROM users u JOIN practitioner p ON p.uuid = u.practitioner_uuid
                           JOIN pegawai pg ON pg.uuid = p.pegawai_uuid WHERE u.username = $1`, [username]))?.name ?? K.dokter.tampil;
  K.namaPetugas = await namaStaf(akun.petugas.username);
  K.namaApoteker = await namaStaf(akun.apoteker.username);
}

async function muatDatamaster() {
  const F = K.faskes;
  K.lokasiStok = await satu(`SELECT uuid, name FROM lokasi_stok WHERE faskes_uuid = $1 AND status AND deleted_at IS NULL
                             ORDER BY (jenis_lokasi = 'depo' AND default_tujuan_order_permintaan LIKE '%1%') DESC, (jenis_lokasi = 'depo') DESC LIMIT 1`, [F]);
  K.jenisStok = (await satu(`SELECT uuid FROM jenis_stok WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY id LIMIT 1`, [F]))?.uuid;
  K.supplier = await satu(`SELECT uuid, code, name FROM master_supplier WHERE faskes_uuid = $1 AND status AND deleted_at IS NULL ORDER BY id LIMIT 1`, [F]);
  const kode = async (tabel, kolom = 'code') => Object.fromEntries((await q(`SELECT ${kolom} AS k, uuid FROM ${tabel} WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [F])).rows.map((r) => [r.k, r.uuid]));
  K.aturan = await kode('aturan_pakai');
  K.cara = await kode('carai_pakai');
  K.satuan = await kode('satuan');
  const tarif = (await q(`SELECT uuid, code, name, grand_total, is_mcu FROM tarif WHERE faskes_uuid = $1 AND jenis_tarif = 'Tindakan' AND status AND deleted_at IS NULL`, [F])).rows;
  K.tarif = Object.fromEntries(tarif.map((t) => [t.code, t]));
  K.tarifKonsultasi = tarif.find((t) => t.code === 'T-KONS-UM') ?? tarif.find((t) => /^konsultasi/i.test(t.name));
  K.penjamin = (await q(`SELECT uuid, code, name FROM penjamin WHERE faskes_uuid = $1 AND status AND deleted_at IS NULL`, [F])).rows;
  K.bpjs = K.penjamin.find((p) => p.code === 'BPJS');
  K.item = {};
  const items = (await q(`
    SELECT i.uuid, i.code, i.name, i.dosis, i.jenis_item, i.isi_kemasan, i.satuan_dosis_uuid, c.satuan_pembelian_uuid,
           h.harga_terakhir, j.jenis_stok_uuid
    FROM item_medis i
    JOIN item_medis_jenis_stok j ON j.item_medis_uuid = i.uuid AND j.deleted_at IS NULL
    LEFT JOIN conversions c ON c.item_medis_uuid = i.uuid AND c.deleted_at IS NULL
    LEFT JOIN harga_item h ON h.item_medis_jenis_stok_uuid = j.uuid AND h.deleted_at IS NULL
    WHERE i.faskes_uuid = $1 AND i.status AND i.deleted_at IS NULL`, [F])).rows;
  for (const it of items) K.item[it.code] = it;
  const kodeDx = [...new Set(Object.values(KASUS).flatMap((k) => k.dx).concat(Object.values(DX_SEKUNDER).flat()))];
  K.dx = Object.fromEntries((await q(`SELECT DISTINCT ON (code) code, uuid, name FROM diagnosis WHERE code = ANY($1) AND deleted_at IS NULL ORDER BY code, id`, [kodeDx])).rows.map((d) => [d.code, d]));
  const kurang = [];
  if (!K.lokasiStok) kurang.push('lokasi stok');
  if (!K.jenisStok) kurang.push('jenis stok');
  if (!K.tarifKonsultasi) kurang.push('tarif konsultasi');
  if (!K.penjamin.length) kurang.push('penjamin');
  if (kurang.length) throw new Error(`Datamaster faskes belum lengkap: ${kurang.join(', ')}`);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════
// Penggeseran waktu (backdating)
// ════════════════════════════════════════════════════════════════════════════════════════════════════════
// Tabel konfigurasi yang tidak boleh ikut digeser walau tersentuh (mis. login memperbarui users).
// audit_trail: append-only (trigger menolak UPDATE/DELETE, STD-0029), jejak audit tetap memakai waktu sebenarnya.
const TIDAK_DIGESER = new Set(['users', 'role', 'faskes', 'faskes_profiles', 'faskes_segmen', 'faskes_modul_override',
  'faskes_fitur_override', 'faskes_modul_riwayat', 'integrations', 'printers', 'demo_jejak_transaksi', 'audit_trail']);
let META;
async function metaTabel() {
  if (META) return META;
  const { rows } = await q(`
    SELECT c.table_name t, c.column_name k, c.data_type tipe
    FROM information_schema.columns c
    JOIN information_schema.tables tb ON tb.table_name = c.table_name AND tb.table_schema = 'public' AND tb.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.table_name IN (SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'faskes_uuid')`);
  const m = {};
  for (const r of rows) {
    if (TIDAK_DIGESER.has(r.t)) continue;
    m[r.t] ??= { tabel: r.t, waktu: [], teks: [], kolom: new Set() };
    m[r.t].kolom.add(r.k);
    if (['integer', 'bigint', 'numeric', 'double precision'].includes(r.tipe) && r.k !== 'id') m[r.t].waktu.push([r.k, 'angka']);
    else if (r.tipe === 'timestamp with time zone' || r.tipe === 'timestamp without time zone') m[r.t].waktu.push([r.k, 'stempel']);
    else if (['character varying', 'text', 'character'].includes(r.tipe) && !r.k.endsWith('uuid') && r.k !== 'uuid') m[r.t].teks.push([r.k, 'teks']);
    else if (r.tipe === 'json' || r.tipe === 'jsonb') m[r.t].teks.push([r.k, r.tipe]);
  }
  META = Object.values(m).filter((x) => x.waktu.length && x.kolom.has('uuid'));
  return META;
}

// Episode = satu rangkaian aksi (kunjungan / PO / penjualan). Setiap fase dimulai pada detik baru sehingga semua
// stempel waktu yang ditulis selama fase dapat dipetakan ke waktu sasaran fase tersebut.
class Episode {
  constructor(nama) { this.nama = nama; this.fase = []; this.akhir = 0; }
  async jalankan(target, fn) {
    while (detik() <= this.akhir) await tidur(100);
    this.fase.push({ s: detik(), t: target });
    try { return await fn(); } finally { this.akhir = detik(); }
  }
  jendela(akhirTotal) {
    return this.fase.map((f, i) => ({ a: f.s, b: i + 1 < this.fase.length ? this.fase[i + 1].s - 1 : akhirTotal, d: f.t == null ? 0 : f.t - f.s }));
  }
}

// Geser semua kolom waktu yang nilainya jatuh di jendela fase (detik, milidetik atau timestamptz) pada seluruh tabel
// faskes; sekaligus catat baris yang DIBUAT dalam episode (created_at di jendela) untuk tabel jejak.
async function geserPostgres(jendela) {
  const LO = Math.min(...jendela.map((w) => w.a));
  const HI = Math.max(...jendela.map((w) => w.b));
  const adaGeser = jendela.some((w) => w.d !== 0);
  const tersentuh = {};
  const baru = [];
  // Satu kueri untuk menemukan tabel yang punya nilai waktu di jendela, agar tidak memproses ±140 tabel satu per satu.
  const semua = await metaTabel();
  const kondisiTabel = (m) => m.waktu.map(([k, jenis]) => (jenis === 'angka'
    ? `("${k}" BETWEEN ${LO} AND ${HI} OR "${k}" BETWEEN ${LO * 1000} AND ${HI * 1000 + 999})`
    : `("${k}" >= to_timestamp(${LO}) AND "${k}" < to_timestamp(${HI + 1}))`)).join(' OR ');
  const aktif = (await q(semua.map((m, i) => `SELECT ${i} AS i WHERE EXISTS (SELECT 1 FROM "${m.tabel}" WHERE faskes_uuid::text = $1 AND (${kondisiTabel(m)}))`)
    .join(' UNION ALL '), [K.faskes])).rows.map((r) => semua[r.i]);
  for (const m of aktif) {
    const kondisi = [];
    const set = [];
    for (const [k, jenis] of m.waktu) {
      const c = `"${k}"`;
      if (jenis === 'angka') {
        kondisi.push(`(${c} BETWEEN ${LO} AND ${HI} OR ${c} BETWEEN ${LO * 1000} AND ${HI * 1000 + 999})`);
        const kasus = jendela.filter((w) => w.d).flatMap((w) => [
          `WHEN ${c} BETWEEN ${w.a} AND ${w.b} THEN ${c} + ${w.d}`,
          `WHEN ${c} BETWEEN ${w.a * 1000} AND ${w.b * 1000 + 999} THEN ${c} + ${w.d * 1000}`]);
        if (kasus.length) set.push(`${c} = CASE ${kasus.join(' ')} ELSE ${c} END`);
      } else {
        kondisi.push(`(${c} >= to_timestamp(${LO}) AND ${c} < to_timestamp(${HI + 1}))`);
        const kasus = jendela.filter((w) => w.d).map((w) => `WHEN ${c} >= to_timestamp(${w.a}) AND ${c} < to_timestamp(${w.b + 1}) THEN ${c} + make_interval(secs => ${w.d})`);
        if (kasus.length) set.push(`${c} = CASE ${kasus.join(' ')} ELSE ${c} END`);
      }
    }
    const created = m.kolom.has('created_at') ? `("created_at" BETWEEN ${LO} AND ${HI} OR "created_at" BETWEEN ${LO * 1000} AND ${HI * 1000 + 999})` : 'false';
    const sumber = `SELECT ctid AS rid, uuid::text AS kunci, ${created} AS baru FROM "${m.tabel}" WHERE faskes_uuid::text = $1 AND (${kondisi.join(' OR ')})`;
    const { rows } = adaGeser && set.length
      ? await q(`WITH pre AS (${sumber} FOR UPDATE) UPDATE "${m.tabel}" t SET ${set.join(', ')} FROM pre WHERE t.ctid = pre.rid RETURNING pre.kunci, pre.baru`, [K.faskes])
      : await q(sumber, [K.faskes]);
    if (!rows.length) continue;
    tersentuh[m.tabel] = rows.map((r) => r.kunci);
    for (const r of rows) if (r.baru) baru.push([m.tabel, r.kunci]);
  }
  return { tersentuh, baru };
}

// Ganti token teks (no. registrasi, no. pelayanan, tanggal) pada baris yang tersentuh episode.
async function gantiTeks(tersentuh, pasangan, khususTabel = {}) {
  const meta = Object.fromEntries((await metaTabel()).map((m) => [m.tabel, m]));
  for (const [tabel, kunci] of Object.entries(tersentuh)) {
    const m = meta[tabel];
    const ganti = [...pasangan, ...(khususTabel[tabel] ?? [])].filter(([a, b]) => a && b && a !== b);
    if (!m?.teks.length || !ganti.length) continue;
    const nilai = ganti.flat(); // parameter $2.. (pasangan cari/ganti); $1 = daftar uuid
    const ekspr = (c) => ganti.reduce((acc, _, i) => `replace(${acc}, $${i * 2 + 2}, $${i * 2 + 3})`, c);
    const set = m.teks.map(([k, tipe]) => {
      const c = tipe === 'teks' ? `"${k}"` : `"${k}"::text`;
      const e = ekspr(c);
      return `"${k}" = ${tipe === 'teks' ? e : `(${e})::${tipe}`}`;
    });
    await q(`UPDATE "${tabel}" SET ${set.join(', ')} WHERE uuid::text = ANY($1)`, [kunci, ...nilai]);
  }
}

// Mongo: geser angka/Date di jendela dan ganti string tanggal hari ini → tanggal sasaran (rekam medis & sesi).
function geserNilai(v, jendela, tanggal) {
  if (v == null) return v;
  if (typeof v === 'number') {
    for (const w of jendela) {
      if (!w.d) continue;
      if (v >= w.a && v <= w.b) return v + w.d;
      if (v >= w.a * 1000 && v <= w.b * 1000 + 999) return v + w.d * 1000;
    }
    return v;
  }
  if (v instanceof Date) {
    const s = Math.floor(v.getTime() / 1000);
    for (const w of jendela) if (w.d && s >= w.a && s <= w.b) return new Date(v.getTime() + w.d * 1000);
    return v;
  }
  if (typeof v === 'string') {
    if (tanggal && tanggal[0] !== tanggal[1] && v.includes(tanggal[0])) return v.split(tanggal[0]).join(tanggal[1]);
    return v;
  }
  if (Array.isArray(v)) return v.map((x) => geserNilai(x, jendela, tanggal));
  if (typeof v === 'object') {
    if (v._bsontype) return v; // ObjectId, Decimal128, dll.
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = k === '_id' ? x : geserNilai(x, jendela, tanggal);
    return o;
  }
  return v;
}
async function geserMongo(jendela, noReg, tanggal) {
  const rm = await mdb.collection('rekam_medises').find({ faskes_uuid: K.faskes, no_reg: noReg }).toArray();
  const baru = [];
  for (const doc of rm) {
    const sesi = (doc.daily_records ?? []).flatMap((r) => r.sessions ?? []);
    const d = geserNilai(doc, jendela, tanggal);
    await mdb.collection('rekam_medises').replaceOne({ _id: doc._id }, d);
    baru.push(['mongo:rekam_medises', String(doc._id)]);
    for (const s of await mdb.collection('sessions').find({ _id: { $in: sesi } }).toArray()) {
      await mdb.collection('sessions').replaceOne({ _id: s._id }, geserNilai(s, jendela, tanggal));
      baru.push(['mongo:sessions', String(s._id)]);
    }
  }
  return baru;
}

// ── Jejak (untuk --bersihkan) ──────────────────────────────────────────────────────────────────────────
async function siapkanJejak() {
  await q(`CREATE TABLE IF NOT EXISTS demo_jejak_transaksi (
    id bigserial PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, tabel varchar(100) NOT NULL, kunci varchar(255) NOT NULL,
    created_at bigint NOT NULL)`);
  await q(`CREATE INDEX IF NOT EXISTS demo_jejak_transaksi_faskes ON demo_jejak_transaksi (faskes_uuid)`);
}
async function catatJejak(baris) {
  const unik = [...new Map(baris.map((b) => [`${b[0]}|${b[1]}`, b])).values()];
  for (let i = 0; i < unik.length; i += 500) {
    const potong = unik.slice(i, i + 500);
    const nilai = [];
    const tempat = potong.map(([t, k], j) => { nilai.push(t, k); return `($1, $${j * 2 + 2}, $${j * 2 + 3}, ${detik()})`; });
    await q(`INSERT INTO demo_jejak_transaksi (faskes_uuid, tabel, kunci, created_at) VALUES ${tempat.join(', ')}`, [K.faskes, ...nilai]);
  }
}

// Selesaikan episode: tunggu tulisan asinkron, geser waktu (bila punya sasaran), catat jejak.
async function tutupEpisode(ep, opsi = {}) {
  await tidur(1200);
  const jendela = ep.jendela(detik() + 1);
  const { tersentuh, baru } = await geserPostgres(jendela);
  const jejak = [...baru];
  if (opsi.setelah) jejak.push(...((await opsi.setelah({ tersentuh, jendela })) ?? []));
  await catatJejak(jejak);
  return { tersentuh, jendela };
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════
// Rencana data
// ════════════════════════════════════════════════════════════════════════════════════════════════════════
const HARI_INI = awalHari(detik());
const umurTahun = (lahir, pada = HARI_INI) => {
  const [y, m, d] = lahir.split('-').map(Number);
  const t = new Date((pada + WIB) * 1000);
  return t.getUTCFullYear() - y - ((t.getUTCMonth() + 1 < m || (t.getUTCMonth() + 1 === m && t.getUTCDate() < d)) ? 1 : 0);
};

async function rencanakanPasien() {
  // Wilayah: kelurahan sekitar faskes (Surabaya: daftar tetap), lainnya acak di kabupaten faskes.
  let wilayah;
  if (K.kab === '3578') {
    wilayah = Object.entries(WILAYAH_SBY).map(([kel, [pos, jalan]]) => ({ kel, pos, jalan }));
  } else {
    const kel = (await q(`SELECT l.code FROM kelurahan l JOIN kecamatan k ON k.code = l.kecamatan_code
                          WHERE k.kabupaten_code = $1 ORDER BY (k.name ILIKE $2) DESC, l.code LIMIT 12`, [K.kab ?? '3578', K.kecFaskes ?? ''])).rows;
    wilayah = kel.map((r) => ({ kel: r.code, pos: K.kodePos, jalan: JALAN_UMUM }));
  }
  const nikDipakai = new Set((await q(`SELECT no_identity FROM patients WHERE faskes_uuid = $1`, [K.faskes])).rows.map((r) => r.no_identity));
  const prefiks = ['0812', '0813', '0821', '0822', '0852', '0857', '0878', '0896', '0838', '0819'];
  return PASIEN.map(([gelar, nama, jk, lahir, tempat, agama, kawin, ibu, bpjs, ...kasus], i) => {
    const w = wilayah[i % wilayah.length];
    const [y, m, d] = lahir.split('-');
    let nik;
    do {
      nik = `${w.kel.slice(0, 6)}${pad(Number(d) + (jk === 'P' ? 40 : 0), 2)}${m}${y.slice(2)}${pad(antara(1, 2999), 4)}`;
    } while (nikDipakai.has(nik));
    nikDipakai.add(nik);
    return {
      gelar, nama, jk, lahir, tempat, agama, kawin, ibu, kasus,
      bpjs: bpjs && !!K.bpjs, kartu: `000${pad(antara(1, 9999999999), 10)}`, kelas: pilih(['kelas3', 'kelas3', 'kelas2', 'kelas1']),
      nik, hp: `${pilih(prefiks)}${pad(antara(1000000, 99999999), 8)}`.slice(0, 12),
      alamat: {
        prov: w.kel.slice(0, 2), city: w.kel.slice(0, 4), district: w.kel.slice(0, 6), village: w.kel,
        rt: pad(antara(1, 9), 3), rw: pad(antara(1, 12), 3), postal_code: w.pos,
        full_address: `${pilih(w.jalan)} No. ${antara(2, 120)}`, country: 'id-ID',
      },
      anak: umurTahun(lahir) < 12,
      uuid: null,
    };
  });
}

// Susun kunjungan: kontrol penyakit kronis tiap ±2 minggu, kontrol kasus akut 3–5 hari, kasus berbeda berjarak 1–3 minggu.
function rencanakanKunjungan(pasien) {
  const kunjungan = [];
  const awal = -RENTANG_HARI + 1;
  const praktik = (h) => K.hariPraktik.has(NAMA_HARI[hariKe(HARI_INI + h * 86400)]) && hariKe(HARI_INI + h * 86400) !== 0; // Minggu tutup
  const geserKeHariPraktik = (h) => {
    for (let i = 0; i < 7; i++) for (const s of [h - i, h + i]) if (s >= awal && s <= -1 && praktik(s)) return s;
    return h;
  };
  for (const p of pasien) {
    const daftar = p.kasus.map((k) => { const [kode, status] = k.split('@'); return { kode, status: status ?? null }; });
    const hari = new Array(daftar.length);
    const jarak = (i) => {
      const a = daftar[i - 1].kode;
      const b = daftar[i].kode;
      if (a === b) return KASUS_KRONIS.has(a) ? antara(13, 16) : antara(3, 5);
      return antara(7, 18);
    };
    if (daftar.at(-1).status) {
      hari[daftar.length - 1] = 0;
      for (let i = daftar.length - 2; i >= 0; i--) hari[i] = geserKeHariPraktik(hari[i + 1] - jarak(i + 1));
    } else {
      let total = 0;
      for (let i = 1; i < daftar.length; i++) total += jarak(i);
      hari[0] = geserKeHariPraktik(antara(awal, Math.max(awal, -1 - total)));
      for (let i = 1; i < daftar.length; i++) hari[i] = geserKeHariPraktik(Math.min(-1, hari[i - 1] + jarak(i)));
    }
    daftar.forEach((k, i) => {
      if (hari[i] < awal) hari[i] = geserKeHariPraktik(awal);
      const sebelum = daftar.slice(0, i).some((x) => x.kode === k.kode);
      kunjungan.push({ pasien: p, kode: k.kode, status: k.status ?? 'selesai', hari: hari[i], kontrol: sebelum, ke: i });
    });
  }
  // Batasi ±4 kunjungan per hari agar wajar untuk praktik sore satu dokter.
  const perHari = {};
  kunjungan.sort((a, b) => a.hari - b.hari || a.ke - b.ke);
  for (const v of kunjungan.filter((x) => x.hari < 0)) {
    while ((perHari[v.hari] ?? 0) >= 4) {
      const alt = [v.hari + 1, v.hari - 1, v.hari + 2, v.hari - 2].find((h) => h >= awal && h <= -1 && praktik(h) && (perHari[h] ?? 0) < 4);
      if (alt === undefined) break;
      v.hari = alt;
    }
    perHari[v.hari] = (perHari[v.hari] ?? 0) + 1;
  }
  // Urutan per pasien tetap kronologis setelah penyesuaian
  for (const p of pasien) {
    const milik = kunjungan.filter((v) => v.pasien === p).sort((a, b) => a.ke - b.ke);
    const hariUrut = milik.map((v) => v.hari).sort((a, b) => a - b);
    milik.forEach((v, i) => {
      v.hari = hariUrut[i];
      if (i > 0 && v.hari <= milik[i - 1].hari && v.hari < 0) v.hari = Math.min(-1, milik[i - 1].hari + 1);
      v.kontrol = milik.slice(0, i).some((x) => x.kode === v.kode);
    });
  }
  kunjungan.sort((a, b) => a.hari - b.hari);

  // Jam kunjungan per hari: praktik sore, dokter memeriksa bergiliran.
  const jamPraktik = (K.jamMulai ?? 17);
  const kelompok = {};
  for (const v of kunjungan.filter((x) => x.hari < 0)) (kelompok[v.hari] ??= []).push(v);
  for (const [h, daftar] of Object.entries(kelompok)) {
    const hari = HARI_INI + Number(h) * 86400;
    let datang = jam(hari, jamPraktik, antara(0, 15));
    let dokterBebas = jam(hari, jamPraktik, 5);
    for (const v of daftar) {
      const periksa = Math.max(datang + antara(4, 12) * 60, dokterBebas + 60);
      const pulang = periksa + antara(7, 14) * 60 + antara(0, 59);
      const verif = pulang + antara(2, 5) * 60 + antara(0, 59);
      const bayar = verif + antara(2, 4) * 60 + antara(0, 59);
      const serah = bayar + antara(2, 4) * 60 + antara(0, 59);
      v.waktu = { daftar: datang + antara(0, 59), periksa, pulang, verif, bayar, serah };
      dokterBebas = pulang;
      datang += antara(12, 35) * 60;
    }
  }
  // Hari ini: urutan status agar antrean terlihat hidup
  const urutStatus = { selesai: 0, tunggu_obat: 1, diperiksa: 2, menunggu: 3 };
  const hariIni = kunjungan.filter((v) => v.hari === 0).sort((a, b) => urutStatus[a.status] - urutStatus[b.status]);
  return [...kunjungan.filter((v) => v.hari < 0), ...hariIni];
}

function isiKlinis(v) {
  const k = KASUS[v.kode];
  const kontrol = v.kontrol && k.kontrol ? { ...k, ...k.kontrol, keluhan: [k.kontrol.keluhan], fisik: [k.kontrol.fisik] } : k;
  const p = v.pasien;
  const umur = umurTahun(p.lahir, HARI_INI + v.hari * 86400);
  const anak = umur < 12;
  // Anak: pakai sediaan anak (sirup) kecuali kasus kontrol punya resep kontrol khusus.
  const pakaiAnak = anak && kontrol.anak && !(v.kontrol && k.kontrol?.resep);
  let resep = pakaiAnak ? kontrol.anak : kontrol.resep;
  if (anak && !pakaiAnak) resep = resep.filter(([kd]) => !['AMX500', 'ASM500', 'IBU400', 'DXM05', 'MTF500', 'GLB5', 'AML5'].includes(kd));
  if (KASUS_KRONIS.has(v.kode) && OBAT_KRONIS_TAMBAHAN[p.nama]) resep = [...resep, ...OBAT_KRONIS_TAMBAHAN[p.nama]];
  resep = resep.filter(([kd]) => K.item[kd]);
  const profil = kontrol.vital ?? 'normal';
  const vital = {
    normal: () => [antara(110, 132), antara(70, 86), antara(72, 92), desimal(36.3, 37.0), antara(16, 20), antara(97, 99)],
    demam: () => [antara(108, 128), antara(68, 84), antara(88, 104), desimal(37.8, 38.9), antara(18, 22), antara(96, 99)],
    ht: () => [antara(150, 172), antara(92, 106), antara(80, 96), desimal(36.4, 36.9), antara(16, 20), antara(96, 99)],
    htKontrol: () => [antara(132, 148), antara(82, 94), antara(74, 88), desimal(36.3, 36.9), antara(16, 20), antara(97, 99)],
    sesak: () => [antara(110, 126), antara(70, 82), antara(102, 118), desimal(36.6, 37.4), antara(26, 32), antara(93, 96)],
  }[profil]();
  if (anak) { vital[0] = antara(90, 108); vital[1] = antara(58, 70); vital[2] += 12; vital[4] += 4; }
  const lk = p.jk === 'L';
  const bb = anak ? +(umur * 2.2 + 9 + desimal(-1.5, 2.5)).toFixed(1) : antara(lk ? 58 : 46, lk ? 86 : 74);
  const tb = anak ? Math.round(umur * 6 + 78 + antara(-3, 4)) : antara(lk ? 160 : 148, lk ? 176 : 164);
  return {
    keluhan: pilih(kontrol.keluhan), riwayat: v.kontrol ? `Kontrol ulang. ${k.riwayat}` : k.riwayat, fisik: pilih(kontrol.fisik),
    dx: [...k.dx, ...(DX_SEKUNDER[p.nama] ?? [])], keadaan: kontrol.keadaan ?? 'baik', alergi: k.alergi ?? null,
    vital, bb, tb, resep, tindakan: kontrol.tindakan ?? k.tindakan ?? [],
  };
}

function rencanakanOtc() {
  const daftar = [];
  const awal = -RENTANG_HARI + 1;
  const jumlah = Math.round(RENTANG_HARI * 0.4);
  for (let i = 0; i < jumlah; i++) {
    let h = antara(awal, -1);
    if (hariKe(HARI_INI + h * 86400) === 0) h = Math.min(-1, h + 1);
    const hari = HARI_INI + h * 86400;
    const [nama, hp] = pilih(PEMBELI_OTC);
    daftar.push({ hari: h, waktu: jam(hari, 17, antara(10, 230)), pembeli: nama, hp, paket: pilih(PAKET_OTC) });
  }
  daftar.push({ hari: 0, waktu: null, pembeli: 'Ibu Wartini', hp: '081200000012', paket: [['PCT500', 10], ['VTC50', 10]] });
  return daftar;
}

// Pengadaan: PO pertama menutup kebutuhan paruh awal + cadangan, PO kedua pertengahan periode.
async function rencanakanPengadaan(kunjungan, otc) {
  const tengah = -Math.floor(RENTANG_HARI / 2);
  const butuh = {};
  const tambah = (kd, n, h) => { butuh[kd] ??= [0, 0]; butuh[kd][h < tengah ? 0 : 1] += n; };
  for (const v of kunjungan) {
    v.klinis = isiKlinis(v);
    if (['selesai', 'tunggu_obat'].includes(v.status)) for (const [kd, n] of v.klinis.resep) tambah(kd, n, v.hari);
  }
  for (const o of otc) for (const [kd, n] of o.paket) tambah(kd, n, o.hari);
  const stok = Object.fromEntries((await q(`
    SELECT i.code, COALESCE(SUM(s.sisa_stok), 0)::int n FROM item_medis i
    JOIN item_medis_jenis_stok j ON j.item_medis_uuid = i.uuid
    LEFT JOIN stock_medis s ON s.item_medis_jenis_stok_uuid = j.uuid AND s.lokasi_stok_uuid = $2 AND s.deleted_at IS NULL
    WHERE i.faskes_uuid = $1 GROUP BY i.code`, [K.faskes, K.lokasiStok.uuid])).rows.map((r) => [r.code, r.n]));
  const po = [[], []];
  for (const [kd, [a, b]] of Object.entries(butuh)) {
    const it = K.item[kd];
    if (!it?.satuan_pembelian_uuid || !it.harga_terakhir) continue;
    const isi = it.isi_kemasan || 1;
    const cadangan = isi > 1 ? 2 * isi : 10; // stok pengaman: 2 kemasan (tablet) / 10 botol-tube
    const sisa = (stok[kd] ?? 0) - a; // stok setelah kebutuhan paruh pertama
    const kemasan1 = Math.ceil(Math.max(0, cadangan - sisa) / isi);
    const kemasan2 = Math.ceil(Math.max(0, b + cadangan - (sisa + kemasan1 * isi)) / isi);
    if (kemasan1 > 0) po[0].push([kd, kemasan1]);
    if (kemasan2 > 0) po[1].push([kd, kemasan2]);
  }
  // Pengadaan awal juga menyetok BMHP tindakan (handscoon, spuit, alcohol swab) yang lazim dibeli rutin.
  for (const kd of ['HSC', 'ALC-SW', 'SPT3']) if (K.item[kd]?.satuan_pembelian_uuid && !po[0].some(([x]) => x === kd)) po[0].push([kd, 1]);
  return [
    { ke: 1, hari: -RENTANG_HARI, item: po[0] },
    { ke: 2, hari: tengah - 1, item: po[1] },
  ].filter((p) => p.item.length);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════
// Langkah API
// ════════════════════════════════════════════════════════════════════════════════════════════════════════
const ringkas = { pasienBaru: 0, kunjungan: 0, resep: 0, tindakan: 0, bayar: 0, pendapatan: 0, otc: 0, po: 0, bpjsTerkirim: 0, perStatus: {} };

async function pengadaan(p) {
  const ep = new Episode(`PO-${p.ke}`);
  const hari = HARI_INI + p.hari * 86400;
  const tPo = jam(hari, 9, antara(5, 40));
  const tTerima = jam(hari + 86400, 10, antara(0, 50));
  const kategori = { obat: [], alkes: [] };
  for (const [kd, n] of p.item) kategori[K.item[kd].jenis_item === 'alkes' ? 'alkes' : 'obat'].push([kd, n]);
  const noFaktur = `FKT/${K.supplier.code}/${tglIso(tTerima).slice(2, 7).replace('-', '')}/${pad(antara(100, 9999), 4)}`;
  const daftarPo = [];
  await ep.jalankan(tPo, async () => {
    for (const [jenis, item] of Object.entries(kategori)) {
      if (!item.length) continue;
      const r = await POST('gudang', 'inventory', '/pengadaan/pembelian-barang', {
        lokasi_stok_uuid: K.lokasiStok.uuid, kategori_item: 'medis', jenis_item: jenis, jenis_stok_uuid: K.jenisStok,
        supplier_uuid: K.supplier.uuid, tanggal_pembelian: tPo, metode_pembelian: p.ke === 1 ? 'tunai' : 'kredit',
        catatan_po: p.ke === 1 ? `Pengadaan rutin awal bulan (${jenis === 'obat' ? 'obat' : 'BMHP'})` : `Restok ${jenis === 'obat' ? 'obat' : 'BMHP'} fast moving`,
        is_cito: false, diskon: 0, materai: 0, ppn: false,
        items: item.map(([kd, n]) => ({ item_uuid: K.item[kd].uuid, qty_order: n, harga_satuan: Math.round(K.item[kd].harga_terakhir * (K.item[kd].isi_kemasan || 1)), satuan_uuid: K.item[kd].satuan_pembelian_uuid })),
      });
      daftarPo.push({ uuid: r.payload.uuid, item });
    }
  });
  await ep.jalankan(tPo + antara(5, 20) * 60, async () => {
    for (const d of daftarPo) await PUT('gudang', 'inventory', `/pengadaan/verifikasi-barang/${d.uuid}`, {});
  });
  await ep.jalankan(tTerima, async () => {
    for (const d of daftarPo) {
      const det = (await GET('gudang', 'inventory', `/pengadaan/pembelian-barang/${d.uuid}`)).payload;
      const batch = [];
      const items = det.items.map((x) => {
        const kd = Object.keys(K.item).find((c) => K.item[c].uuid === x.item_uuid);
        const bulan = antara(14, 30);
        const exp = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + bulan, 28, 5));
        batch.push(`${kd} ${String.fromCharCode(65 + antara(0, 25))}${tglIso(tTerima).slice(2, 4)}${pad(antara(1, 999), 3)}`);
        return { uuid: x.uuid, qty_terima: x.qty_order, exp_date: exp.getTime() };
      });
      await PUT('gudang', 'inventory', `/penerimaan/pembelian/${d.uuid}`, {
        petugas_pengirim: pilih(['Agus Prasetyo', 'Dedi Kurniawan', 'Heri Santoso']), no_faktur: noFaktur, tanggal_faktur: tTerima,
        tanggal_terima: tTerima, no_surat_jalan: `SJ-${yymmdd(tTerima)}-${pad(antara(1, 999), 3)}`,
        catatan_penerimaan: `Diterima lengkap sesuai faktur. Batch: ${batch.join('; ')}`.slice(0, 250), diskon: 0, materai: 0, ppn: false, items,
      });
    }
  });
  await tutupEpisode(ep);
  ringkas.po += daftarPo.length;
}

async function penjualanOtc(o) {
  const ep = new Episode('OTC');
  const stok = (await GET('gudang', 'inventory', `/stok?lokasi_stok_uuid=${K.lokasiStok.uuid}`)).payload ?? [];
  const items = o.paket.map(([kd, n]) => {
    const s = stok.find((x) => x.item_uuid === K.item[kd]?.uuid);
    return s ? { stock_uuid: s.stock_uuid, qty: n, jenis_stok_uuid: K.item[kd].jenis_stok_uuid, satuan_uuid: s.satuan_uuid, diskon: 0, name: s.item_name } : null;
  }).filter(Boolean);
  if (!items.length) return;
  let uuid;
  await ep.jalankan(o.waktu, async () => {
    const kode = (await GET('apoteker', 'farmasi', '/penjualan-obat/code')).payload.code;
    const r = await POST('apoteker', 'farmasi', '/penjualan-obat', {
      lokasi_stok_uuid: K.lokasiStok.uuid, dokter_pemberi_resep: '-', nama_pembeli: o.pembeli, no_hp: o.hp,
      catatan: 'Pembelian obat bebas tanpa resep', tanggal_pembelian: o.waktu ?? detik(), no_transaksi: kode, items,
    });
    uuid = r.payload?.uuid;
  });
  await tutupEpisode(ep, {
    setelah: async () => {
      // Tidak ada API pelunasan penjualan bebas (belum terhubung ke kasir); transaksi lampau ditandai lunas.
      if (o.waktu && uuid) await q(`UPDATE penjualan_obat SET status = 'lunas' WHERE uuid = $1`, [uuid]);
    },
  });
  ringkas.otc++;
}

// Pendaftaran rawat jalan (Pendaftaran Ringkas + isi data lengkap) — payload sama dengan RegisterForm.vue
async function daftar(v) {
  const p = v.pasien;
  const body = {
    patient_data: {
      ...(p.uuid ? { patient_uuid: p.uuid } : {}),
      title: p.gelar, name: p.nama, identity: 'KTP', no_identity: p.nik,
      birth_detail: { birth_place: p.tempat, birth_date: p.lahir }, gender: p.jk === 'L' ? 'Male' : 'Female', phone: p.hp,
      religion: p.agama, language: 'ID', maritial_status: p.kawin, mother_name: p.ibu, status: true, address: p.alamat,
    },
    payment_method: p.bpjs ? 'ASURANSI' : 'TUNAI',
    jadwal_dokter_uuid: K.jadwal[NAMA_HARI[hariKe(detik())]],
    complaint: v.klinis.keluhan.slice(0, 250), note: '', maternity: false,
    ...(p.bpjs ? { insurance: { penjamin_uuid: K.bpjs.uuid, account_number: p.kartu, class_entitle: p.kelas } } : {}),
  };
  const r = (await POST('petugas', 'admisi', '/rawat-jalan', body)).payload;
  if (!p.uuid) { p.uuid = r.patient.uuid; ringkas.pasienBaru++; v.pasienBaru = true; }
  return r;
}

async function asesmen(rm, sesi, key, data) {
  return POST('dokter', 'rm', '/rekam-medis/assessment', { session_uuid: sesi, rekam_medis_uuid: rm, is_latest: true, key, data });
}

// Pemeriksaan dokter lewat SOAP Ringkas (SoapRingkas.vue): RME dibuka → asesmen per bagian → tindakan → resep.
async function periksa(v, rj, lengkap = true) {
  const c = v.klinis;
  await PUT('dokter', 'rajal', `/antrian-call/kunjungan/${rj.uuid}/periksa`, {});
  const rmBaru = (await POST('dokter', 'rm', '/rekam-medis/patient', {
    no_rm: rj.no_rm, no_reg: rj.no_reg, date: tglIso(detik()), pelayanan: 'rj', lokasi_uuid: rj.lokasi.uuid,
    no_pelayanan: rj.no_pelayanan, payment_method: rj.payment_method,
  })).payload;
  const rm = String(rmBaru.rekam_medis_uuid);
  const sesi = String(rmBaru.sessions[0].id);
  const kini = detik();
  await asesmen(rm, sesi, 'anamnesis', { anamnesis: 'Auto Anamnesa', riwayat_keluarga: '', pernah_dirawat: false, keluhan_utama: c.keluhan, riwayat_penyakit: c.riwayat });
  await asesmen(rm, sesi, 'alergi', {
    tingkat_keparahan_alergi: '', efek_samping_alergi: '', tanggal_kejadian_alergi: kini, is_alergi: !!c.alergi,
    pemicu_alergi: c.alergi?.[0] ?? '', nama_alergi: c.alergi?.[1] ?? '', reaksi_alergi: c.alergi?.[2] ?? '',
  });
  const [sis, dia, nadi, suhu, rr, spo2] = c.vital;
  await asesmen(rm, sesi, 'tanda_vital', {
    kriteria_pemantauan: 'Checkup', crt: false, oksigen_tambahan: false, waktu_asesmen: kini, tekanan_darah_sistole: sis,
    tekanan_darah_diastole: dia, frekuensi_nadi: nadi, suhu, frekuensi_nafas: rr, blood_oxygen: spo2,
  });
  await asesmen(rm, sesi, 'antropometri', { berat_badan: c.bb, tinggi_badan: c.tb, imt: +(c.bb / (c.tb / 100) ** 2).toFixed(1) });
  if (!lengkap) return { rm, sesi };
  await asesmen(rm, sesi, 'pemeriksaan_fisik', { keadaan_umum: c.keadaan, pemeriksaan_lainnya: true, ket_pemeriksaan_lainnya: c.fisik, gambar_pemeriksaan_lainnya: '' });
  await asesmen(rm, sesi, 'diagnosis_dokter', c.dx.filter((d) => K.dx[d]).map((d, i) => ({
    diagnosis_uuid: K.dx[d].uuid, diagnosis: K.dx[d].name, diferensial_uuid: '', diferensial: '', tipe: i === 0 ? 'primer' : 'sekunder',
  })));
  // Tindakan: konsultasi dokter + tindakan khusus kasus (nebulizer, perawatan luka)
  const petugas = [{ nama: K.dokter.nama, is_doctor: true, practitioner_uuid: K.dokter.uuid }];
  const daftarTindakan = [[K.tarifKonsultasi.code, 1], ...c.tindakan].map(([kd, n]) => K.tarif[kd] && ({
    tarif_uuid: K.tarif[kd].uuid, nama_tindakan: K.tarif[kd].name, harga_tindakan: K.tarif[kd].grand_total, qty_tindakan: n,
    is_mcu: !!K.tarif[kd].is_mcu, petugas, is_new: true,
  })).filter(Boolean);
  await POST('dokter', 'rm', '/rekam-medis/tindakan', { session_uuid: sesi, data: daftarTindakan });
  ringkas.tindakan += daftarTindakan.length;
  // Resep (DialogOrderObat.vue → farmasi first-order)
  let resep = null;
  if (c.resep.length) {
    await POST('dokter', 'farmasi', '/prescriptions/first-order', {
      no_reg: rj.no_reg, no_rm: rj.no_rm, is_takeaway: false, patient_uuid: rj.patient.uuid, lokasi_stok_uuid: K.lokasiStok.uuid,
      jenis_pelayanan: 'rj', session_uuid: sesi, rekam_medis_uuid: rm, lokasi_uuid: rj.lokasi.uuid, payment_method: rj.payment_method,
      obat: c.resep.map(([kd, n, aturan, catatan, dosis, satuan, cara, rute]) => {
        const it = K.item[kd];
        return {
          medication_qty: n, item_medis_uuid: it.uuid, medication_dose_qty: dosis ?? it.dosis ?? 1,
          medication_dose_satuan_uuid: (satuan && K.satuan[satuan]) || it.satuan_dosis_uuid, medication_period: 'Hari',
          aturan_pakai_uuid: K.aturan[aturan] ?? Object.values(K.aturan)[0], cara_pakai_uuid: K.cara[cara ?? 'ORL'] ?? Object.values(K.cara)[0],
          prescription_notes: catatan ?? '', is_chronic: KASUS_KRONIS.has(v.kode), route: rute ?? 'O',
        };
      }),
    });
    resep = await satu(`SELECT uuid FROM prescriptions WHERE faskes_uuid = $1 AND session_uuid = $2 ORDER BY id DESC LIMIT 1`, [K.faskes, sesi]);
    ringkas.resep++;
  }
  return { rm, sesi, resep: resep?.uuid };
}

async function pulangkan(rm) {
  const kini = detik();
  await PUT('dokter', 'rm', '/rekam-medis/pelayanan/resume', {
    rekam_medis_uuid: rm, pelayanan: 'rj', edukasi: '', edukasi_text: '', kondisi_pasien_pulang: '', status_pulang: 'home',
    status_pulang_keterangan: '', discharge_date: kini, is_internal: false, rujuk_internal: '', rujuk_eksternal: '',
    instruksi_tindak_lanjut: '', tujuan_rujuk: '', tujuan_rujuk_lainnya: '', transport_rujuk: '', transport_rujuk_lainnya: '', instruksi_no_darurat: '',
  });
  await PUT('dokter', 'rm', '/rekam-medis/pelayanan/discharge', { pelayanan: 'rj', rekam_medis_uuid: rm, lokasi_uuid: K.poli.uuid, discharge_date: kini });
}

// Farmasi (DetailPrescription.vue): pilih jenis stok tiap obat → telaah → verifikasi (stok berkurang, tagihan obat)
async function telaahResep(uuid) {
  const d = (await GET('apoteker', 'farmasi', `/prescriptions/${uuid}`)).payload;
  for (const o of d.obat_items) {
    const s = (await GET('apoteker', 'farmasi', `/datamaster/item-medis/available-jenis-stock/${o.item_medis_uuid}?lokasi_stok_uuid=${d.lokasi_stok_uuid}`)).payload ?? [];
    const pilihan = s.find((x) => Number(x.total_stok) >= Number(o.total_obat)) ?? s[0];
    if (!pilihan) throw new Error(`Stok ${o.nama_item} kosong di ${K.lokasiStok.name}`);
    await PUT('apoteker', 'farmasi', `/prescriptions/obat/${o.uuid}/jenis-stok`, { is_racikan: false, jenis_stok_uuid: pilihan.detail_stok.uuid });
  }
  await POST('apoteker', 'farmasi', '/prescriptions/status-telaah', { uuid, petugas_telaah: K.namaApoteker });
}
async function verifikasiResep(uuid) {
  const d = (await GET('apoteker', 'farmasi', `/prescriptions/${uuid}`)).payload;
  await POST('apoteker', 'farmasi', '/prescriptions/status-verifikasi', {
    uuid, items: d.obat_items.filter((o) => !o.is_compound).map((o) => ({ item_uuid: o.uuid, jenis_stok_uuid: o.jenis_stok_uuid })),
  });
  await POST('apoteker', 'farmasi', '/prescriptions/status-siap-diserahkan', { uuid });
}
async function serahkanResep(uuid, v) {
  const p = v.pasien;
  await POST('apoteker', 'farmasi', '/prescriptions/status-diserahkan', {
    uuid, penerima: p.anak ? `${p.ibu} (ibu pasien)` : p.nama, no_hp_penerima: p.hp, petugas_edukasi: K.namaApoteker,
  });
}

// Fitur bayar_shift_kasir aktif: pembayaran butuh shift terbuka. Shift dibuka di dalam fase episode sehingga waktu
// bukanya ikut digeser ke hari sasaran; tutupKasir menutupnya di akhir hari. Tanpa fitur itu shift dibuka otomatis.
async function pastikanShiftKasir() {
  const aktif = await satu(`SELECT 1 FROM cashier_report WHERE faskes_uuid = $1 AND nama_kasir = $2 AND type = 'SHIFT' AND status AND shift_time_closed IS NULL LIMIT 1`,
    [K.faskes, akun.kasir.username]);
  if (!aktif) await POST('kasir', 'bayar', '/cashier/open', { beginning_balance: 500000, shift_type: '1' });
}

// Kasir (TransactionPelayanan.vue): bayar lunas lalu tutup tagihan. BPJS dibayar dengan cara bayar Asuransi.
async function bayar(rj, v) {
  const sb = await satu(`SELECT bill_uuid FROM service_bill WHERE faskes_uuid = $1 AND layanan_uuid = $2 AND deleted_at IS NULL ORDER BY id DESC LIMIT 1`, [K.faskes, rj.uuid]);
  if (!sb) return;
  const bill = (await GET('kasir', 'bayar', `/${sb.bill_uuid}`)).payload;
  const sisa = Math.ceil(Number(bill.remaining_debt ?? bill.grand_total));
  if (sisa <= 0) return;
  let isi;
  if (v.pasien.bpjs) {
    isi = { amount: sisa, payment_type: 'INSURANCE', payment_method: null, note: '', information: `BPJS Kesehatan ${v.pasien.kartu}` };
  } else {
    const metode = pilih(['CASH', 'CASH', 'CASH', 'CASH', 'TRANSFER', 'TRANSFER', 'DEBIT_KREDIT']);
    const uang = metode === 'CASH' ? pilih([Math.ceil(sisa / 5000) * 5000, Math.ceil(sisa / 10000) * 10000, Math.ceil(sisa / 50000) * 50000, 100000 * Math.ceil(sisa / 100000)]) : sisa;
    isi = { amount: uang, payment_type: 'CASH', payment_method: metode, note: '', information: metode === 'TRANSFER' ? 'QRIS' : '' };
  }
  await pastikanShiftKasir();
  await POST('kasir', 'bayar', `/${sb.bill_uuid}/payment`, isi);
  await POST('kasir', 'bayar', `/${sb.bill_uuid}/close`, {});
  ringkas.bayar++;
  ringkas.pendapatan += sisa;
}

let pcareSiap = null;
async function kirimPcare(rj) {
  if (pcareSiap === null) {
    try { pcareSiap = !!(await GET('petugas', 'bpjs', '/pcare/konfigurasi')).payload?.lengkap; } catch { pcareSiap = false; }
  }
  if (!pcareSiap) return;
  try {
    const r = await POST('petugas', 'bpjs', `/pcare/kunjungan/${rj.uuid}/kirim`, {});
    if (r.payload?.status === 'ok') ringkas.bpjsTerkirim++;
  } catch { /* status gagal tercatat di bpjs_pcare_kunjungan; bisa dikirim ulang dari Monitoring BPJS */ }
}

// Nomor harian di masa lalu: urutan per tanggal sasaran
const urutHarian = {};
async function rapikanKunjunganLampau(v, rj, tersentuh) {
  const target = HARI_INI + v.hari * 86400;
  const kini = HARI_INI;
  const urut = (urutHarian[v.hari] = (urutHarian[v.hari] ?? 0) + 1);
  const noReg = `REG${yymmdd(target)}${pad(urut, 4)}`;
  const noPel = `RJ${yymmdd(target)}${pad(urut, 4)}`;
  const noAntrian = rj.no_antrian_poli ? rj.no_antrian_poli.replace(/\d+$/, pad(urut, 3)) : null;
  const jadwal = K.jadwal[NAMA_HARI[hariKe(target)]] ?? rj.jadwal_dokter_uuid;
  await q(`UPDATE rawat_jalans SET jadwal_periksa = $2, jadwal_dokter_uuid = $3, no_antrian_poli = COALESCE($4, no_antrian_poli) WHERE uuid = $1`,
    [rj.uuid, target, jadwal, noAntrian]);
  const blnKini = `/${tglIso(kini).slice(0, 4)}/${tglIso(kini).slice(5, 7)}/`;
  const blnTarget = `/${tglIso(target).slice(0, 4)}/${tglIso(target).slice(5, 7)}/`;
  await gantiTeks(tersentuh, [[rj.no_reg, noReg], [rj.no_pelayanan, noPel], [tglIso(kini), tglIso(target)], [tglDmy(kini), tglDmy(target)]],
    { bills: [[blnKini, blnTarget]] });

  // Antrean poli: kurangi rekap hari ini, tambahkan ke rekap tanggal sasaran
  const tipe = v.pasien.bpjs ? 'jkn' : 'non_jkn';
  const jejak = [];
  const rekapKini = await satu(`SELECT * FROM report_antrian WHERE faskes_uuid = $1 AND jadwal_dokter_uuid = $2 AND tanggal_pelayanan::bigint = $3 AND deleted_at IS NULL`,
    [K.faskes, rj.jadwal_dokter_uuid, kini]);
  if (rekapKini) {
    await q(`UPDATE report_antrian SET no_antrian_terakhir = GREATEST(no_antrian_terakhir - 1, 0),
             jumlah_non_jkn_aktif = GREATEST(jumlah_non_jkn_aktif - 1, 0) WHERE id = $1`, [rekapKini.id]);
  }
  const rekap = await satu(`SELECT id FROM report_antrian WHERE faskes_uuid = $1 AND jadwal_dokter_uuid = $2 AND tanggal_pelayanan::bigint = $3 AND deleted_at IS NULL`,
    [K.faskes, jadwal, target]);
  if (rekap) {
    await q(`UPDATE report_antrian SET no_antrian_terakhir = $2, jumlah_antrian_aktif = jumlah_antrian_aktif, jumlah_${tipe}_aktif = jumlah_${tipe}_aktif + 1 WHERE id = $1`, [rekap.id, urut]);
  } else if (rekapKini) {
    const r = await satu(`INSERT INTO report_antrian (uuid, faskes_uuid, tanggal_pelayanan, jadwal_dokter_uuid, practitioner_name, location_name, kuota,
             no_antrian_terakhir, jumlah_antrian_aktif, created_at, updated_at, kuota_jkn, kuota_non_jkn, jumlah_jkn_aktif, jumlah_non_jkn_aktif)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, 0, $8, $8, $9, $10, $11, $12) RETURNING uuid`,
    [K.faskes, target, jadwal, rekapKini.practitioner_name, rekapKini.location_name, rekapKini.kuota, urut, v.waktu.daftar,
      rekapKini.kuota_jkn, rekapKini.kuota_non_jkn, tipe === 'jkn' ? 1 : 0, tipe === 'jkn' ? 0 : 1]);
    jejak.push(['report_antrian', r.uuid]);
  }
  return { noReg, tanggal: [tglIso(kini), tglIso(target)], jejak };
}

async function prosesKunjungan(v) {
  const lampau = v.hari < 0;
  const W = lampau ? v.waktu : {};
  const ep = new Episode(`RJ ${v.pasien.nama}`);
  let rj;
  let hasil = {};
  try {
    rj = await ep.jalankan(W.daftar, () => daftar(v));
    if (v.status !== 'menunggu') {
      hasil = await ep.jalankan(W.periksa, () => periksa(v, rj, v.status !== 'diperiksa'));
      if (v.status !== 'diperiksa') {
        await ep.jalankan(W.pulang, async () => {
          await pulangkan(hasil.rm);
          if (v.pasien.bpjs) await kirimPcare(rj);
        });
        if (hasil.resep) {
          await ep.jalankan(W.verif, async () => {
            await telaahResep(hasil.resep);
            if (v.status === 'selesai') await verifikasiResep(hasil.resep);
          });
        }
        if (v.status === 'selesai') {
          await ep.jalankan(W.bayar, () => bayar(rj, v));
          if (hasil.resep) await ep.jalankan(W.serah, () => serahkanResep(hasil.resep, v));
        }
      }
    }
  } finally {
    // Selalu geser & catat jejak, juga bila langkah gagal (agar --bersihkan tetap bisa menghapus)
    await tutupEpisode(ep, {
      setelah: async ({ tersentuh, jendela }) => {
        if (!rj) return [];
        const tambahan = [];
        let tanggal = null;
        let noReg = rj.no_reg;
        if (lampau) {
          const r = await rapikanKunjunganLampau(v, rj, tersentuh);
          ({ noReg, tanggal } = r);
          tambahan.push(...r.jejak);
        }
        // Rekam medis MongoDB (rekam_medises & sessions)
        const mg = await geserMongo(lampau ? jendela : [], rj.no_reg, tanggal);
        if (lampau && noReg !== rj.no_reg) {
          await mdb.collection('rekam_medises').updateMany({ faskes_uuid: K.faskes, no_reg: rj.no_reg },
            { $set: { no_reg: noReg, no_pelayanan: noReg.replace(/^REG/, 'RJ') } });
        }
        tambahan.push(...mg);
        // Alamat & detail lahir pasien baru (stempel waktu model admisi tidak selalu "sekarang")
        if (v.pasienBaru) {
          const p = await satu(`SELECT address_uuid, birth_detail_uuid, created_at FROM patients WHERE uuid = $1`, [rj.patient.uuid]);
          for (const [t, u] of [['addresses', p.address_uuid], ['birth_details', p.birth_detail_uuid]]) {
            if (!u) continue;
            await q(`UPDATE "${t}" SET created_at = $2, updated_at = $2 WHERE uuid = $1`, [u, p.created_at]);
            tambahan.push([t, u]);
          }
        }
        return tambahan;
      },
    });
  }
  ringkas.kunjungan++;
  ringkas.perStatus[v.status] = (ringkas.perStatus[v.status] ?? 0) + 1;
}

// Shift kasir (dibuka pastikanShiftKasir atau otomatis saat pembayaran pertama) ditutup setiap akhir hari.
async function tutupKasir(hari, target) {
  const shift = await satu(`SELECT uuid FROM cashier_report WHERE faskes_uuid = $1 AND nama_kasir = $2 AND type = 'SHIFT' AND status AND shift_time_closed IS NULL ORDER BY id DESC LIMIT 1`,
    [K.faskes, akun.kasir.username]);
  if (!shift) return;
  const t = await satu(`SELECT COALESCE(SUM(amount) FILTER (WHERE payment_method = 'CASH'), 0) cash,
                               COALESCE(SUM(amount) FILTER (WHERE payment_method = 'TRANSFER'), 0) transfer,
                               COALESCE(SUM(amount) FILTER (WHERE payment_method = 'DEBIT_KREDIT' OR payment_type = 'INSURANCE'), 0) debit
                        FROM payment_history WHERE kasir_uuid = $1`, [shift.uuid]);
  const ep = new Episode(`Tutup kasir ${tglIso(target)}`);
  await ep.jalankan(target, () => POST('kasir', 'bayar', '/cashier/close', { cash: Number(t.cash), debit: Number(t.debit), transfer: Number(t.transfer) }));
  await tutupEpisode(ep);
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════
// Bersihkan
// ════════════════════════════════════════════════════════════════════════════════════════════════════════
async function bersihkan() {
  const ada = await satu(`SELECT to_regclass('public.demo_jejak_transaksi') t`);
  if (!ada.t) { console.log('Tidak ada jejak transaksi demo.'); return; }
  const jejak = (await q(`SELECT tabel, kunci FROM demo_jejak_transaksi WHERE faskes_uuid = $1`, [K.faskes])).rows;
  if (!jejak.length) { console.log(`Tidak ada transaksi demo tercatat untuk ${KODE_FASKES}.`); return; }
  const per = {};
  for (const j of jejak) (per[j.tabel] ??= new Set()).add(j.kunci);
  const daftar = (t) => [...(per[t] ?? [])];

  // 1. Kembalikan stok yang terpakai resep & penjualan bebas (kecuali stok hasil penerimaan yang ikut dihapus)
  const stokDihapus = new Set(daftar('stock_medis'));
  const kembali = new Map();
  const pakai = (arr) => {
    for (const s of Array.isArray(arr) ? arr : []) {
      if (!s?.stock_medis_uuid || stokDihapus.has(s.stock_medis_uuid)) continue;
      kembali.set(s.stock_medis_uuid, (kembali.get(s.stock_medis_uuid) ?? 0) + Number(s.quantity || 0));
    }
  };
  for (const r of (await q(`SELECT stok_medis_uuides FROM prescription_items WHERE uuid = ANY($1)`, [daftar('prescription_items')])).rows) pakai(r.stok_medis_uuides);
  for (const r of (await q(`SELECT catatan_stok FROM item_penjualan_obat WHERE uuid = ANY($1)`, [daftar('item_penjualan_obat')])).rows) pakai(r.catatan_stok);
  await q('BEGIN');
  try {
    for (const [u, n] of kembali) await q(`UPDATE stock_medis SET sisa_stok = sisa_stok + $2 WHERE uuid = $1`, [u, n]);
    // 2. Hapus baris PostgreSQL (berulang bila ada ketergantungan antar tabel)
    let sisa = Object.keys(per).filter((t) => !t.startsWith('mongo:'));
    let total = 0;
    for (let putaran = 0; sisa.length && putaran < 5; putaran++) {
      const gagal = [];
      for (const t of sisa) {
        try {
          await q('SAVEPOINT s');
          const r = await q(`DELETE FROM "${t}" WHERE faskes_uuid::text = $1 AND uuid::text = ANY($2)`, [K.faskes, daftar(t)]);
          await q('RELEASE SAVEPOINT s');
          total += r.rowCount;
        } catch {
          await q('ROLLBACK TO SAVEPOINT s');
          gagal.push(t);
        }
      }
      sisa = gagal;
    }
    if (sisa.length) throw new Error(`Gagal menghapus: ${sisa.join(', ')}`);
    await q(`DELETE FROM demo_jejak_transaksi WHERE faskes_uuid = $1`, [K.faskes]);
    await q('COMMIT');
    console.log(`PostgreSQL: ${total} baris transaksi dihapus, ${kembali.size} baris stok dikembalikan.`);
  } catch (e) {
    await q('ROLLBACK');
    throw e;
  }
  // 3. MongoDB
  for (const [t, kunci] of Object.entries(per).filter(([t]) => t.startsWith('mongo:'))) {
    const r = await mdb.collection(t.slice(6)).deleteMany({ _id: { $in: [...kunci].map(keObjectId) } });
    console.log(`MongoDB ${t.slice(6)}: ${r.deletedCount} dokumen dihapus.`);
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════
// Utama
// ════════════════════════════════════════════════════════════════════════════════════════════════════════
async function ringkasan() {
  const F = K.faskes;
  const n = async (sql) => Number((await satu(sql, [F])).n);
  const awal = HARI_INI - (RENTANG_HARI - 1) * 86400;
  const pasien = await n(`SELECT count(*) n FROM patients WHERE faskes_uuid = $1 AND deleted_at IS NULL`);
  const bpjs = await n(`SELECT count(DISTINCT ia.patient_uuid) n FROM insurance_accounts ia WHERE ia.faskes_uuid = $1 AND ia.name ILIKE 'BPJS%' AND ia.deleted_at IS NULL`);
  const rj = (await q(`SELECT status_rj, count(*)::int n FROM rawat_jalans WHERE faskes_uuid = $1 AND deleted_at IS NULL GROUP BY 1 ORDER BY 1`, [F])).rows;
  const resep = await n(`SELECT count(*) n FROM prescriptions WHERE faskes_uuid = $1 AND deleted_at IS NULL`);
  const diserahkan = await n(`SELECT count(*) n FROM prescriptions WHERE faskes_uuid = $1 AND order_status = 5 AND deleted_at IS NULL`);
  const tagihan = await satu(`SELECT count(*)::int n, COALESCE(SUM(grand_total), 0) total FROM bills WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [F]);
  const bayarT = (await q(`SELECT payment_type, COALESCE(payment_method::text, '-') m, count(*)::int n, SUM(amount) total FROM payment_history WHERE faskes_uuid = $1 GROUP BY 1, 2 ORDER BY 1, 2`, [F])).rows;
  const otc = await satu(`SELECT count(*)::int n, COALESCE(SUM(total_harga), 0) total FROM penjualan_obat WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [F]);
  const harian = (await q(`SELECT to_char(to_timestamp(tanggal_daftar) AT TIME ZONE 'Asia/Jakarta', 'DD/MM') tgl, count(*)::int n
                           FROM rawat_jalans WHERE faskes_uuid = $1 AND tanggal_daftar >= $2 AND deleted_at IS NULL GROUP BY 1 ORDER BY min(tanggal_daftar)`, [F, awal])).rows;
  const nama = { 0: 'batal', 1: 'booking', 2: 'check-in', 3: 'antri', 4: 'diperiksa', 5: 'selesai' };
  console.log(`\n■ Ringkasan transaksi ${K.namaFaskes} (${KODE_FASKES})`);
  console.log(`  Pasien            : ${pasien} (BPJS ${bpjs}, Umum ${pasien - bpjs}); pasien baru tahap ini ${ringkas.pasienBaru}`);
  console.log(`  Kunjungan RJ      : ${rj.reduce((a, r) => a + r.n, 0)} → ${rj.map((r) => `${nama[r.status_rj] ?? r.status_rj} ${r.n}`).join(', ')}`);
  console.log(`  Resep             : ${resep} (diserahkan ${diserahkan}); tindakan ${ringkas.tindakan}`);
  console.log(`  Tagihan           : ${tagihan.n} senilai ${rupiah(tagihan.total)}`);
  for (const b of bayarT) console.log(`  Pembayaran        : ${b.payment_type}/${b.m} ${b.n} transaksi ${rupiah(b.total)}`);
  console.log(`  Penjualan bebas   : ${otc.n} transaksi ${rupiah(otc.total)}`);
  console.log(`  Pengadaan (PO)    : ${ringkas.po} PO diterima di ${K.lokasiStok.name}`);
  if (ringkas.bpjsTerkirim) console.log(`  BPJS PCare        : ${ringkas.bpjsTerkirim} kunjungan terkirim (mode sesuai bpjs-service)`);
  console.log(`  Kunjungan per hari: ${harian.map((h) => `${h.tgl}:${h.n}`).join(' ')}`);
}

(async () => {
  await sambungPg();
  await sambungMongo();
  const konteks = await muatKonteks();
  await siapkanJejak();
  try {
    if (BERSIHKAN) {
      await bersihkan();
      return;
    }
    const ada = Number((await satu(`SELECT count(*) n FROM demo_jejak_transaksi WHERE faskes_uuid = $1`, [K.faskes])).n);
    if (ada > 0) {
      console.error(`Transaksi demo ${KODE_FASKES} sudah ada (${ada} baris jejak). Jalankan dengan --bersihkan terlebih dahulu.`);
      process.exitCode = 1;
      return;
    }
    await siapkanAkun(konteks);
    await tungguPaymentSiap();
    await muatDatamaster();
    const jadwalHariIni = await satu(`SELECT start_time FROM jadwal_dokter WHERE uuid = $1`, [K.jadwal[NAMA_HARI[hariKe(detik())]]]);
    K.jamMulai = Number(String(jadwalHariIni?.start_time ?? '17:00').slice(0, 2));
    console.log(`Faskes ${K.namaFaskes} — dokter ${K.dokter.tampil} (${akun.dokter.username}), petugas ${akun.petugas.username}, apoteker ${akun.apoteker.username}, kasir ${akun.kasir.username}, gudang ${akun.gudang.username}`);

    const pasien = await rencanakanPasien();
    const kunjungan = rencanakanKunjungan(pasien);
    const otc = rencanakanOtc();
    const po = await rencanakanPengadaan(kunjungan, otc);
    console.log(`Rencana: ${pasien.length} pasien, ${kunjungan.length} kunjungan (${kunjungan.filter((v) => v.hari === 0).length} hari ini), ${otc.length} penjualan bebas, ${po.length} pengadaan.`);
    if (arg('rencana', false)) { // uji kering: tampilkan rencana tanpa memanggil API transaksi
      for (const v of kunjungan) {
        const t = v.waktu ? new Date((v.waktu.daftar + WIB) * 1000).toISOString().slice(0, 16).replace('T', ' ') : 'hari ini        ';
        console.log(`  ${t}  ${NAMA_HARI[hariKe(HARI_INI + v.hari * 86400)].padEnd(6)} ${v.pasien.nama.padEnd(26)} ${v.pasien.bpjs ? 'BPJS' : 'Umum'} ${v.kode}${v.kontrol ? ' (kontrol)' : ''} ${v.status} | ${v.klinis.resep.map((r) => `${r[0]}×${r[1]}`).join(', ')}`);
      }
      for (const p of po) console.log(`  PO #${p.ke} ${tglIso(HARI_INI + p.hari * 86400)}: ${p.item.map(([kd, n]) => `${kd}×${n}`).join(', ')}`);
      return;
    }

    // Semua peristiwa lampau dijalankan berurutan menurut waktu sasaran, lalu peristiwa hari ini.
    const peristiwa = [
      ...po.map((p) => ({ t: jam(HARI_INI + p.hari * 86400, 9), jalan: () => pengadaan(p), label: `Pengadaan #${p.ke}` })),
      ...otc.filter((o) => o.waktu).map((o) => ({ t: o.waktu, jalan: () => penjualanOtc(o), label: 'Penjualan bebas' })),
      ...kunjungan.filter((v) => v.hari < 0).map((v) => ({ t: v.waktu.daftar, jalan: () => prosesKunjungan(v), label: `${v.pasien.nama} (${v.kode})`, v })),
    ];
    // Tutup kasir tiap hari yang ada pembayaran
    const hariBayar = [...new Set(kunjungan.filter((v) => v.hari < 0 && v.status === 'selesai').map((v) => v.hari))];
    for (const h of hariBayar) {
      const terakhir = Math.max(...kunjungan.filter((v) => v.hari === h).map((v) => v.waktu.serah));
      const t = Math.max(terakhir + antara(5, 15) * 60, jam(HARI_INI + h * 86400, 21, antara(0, 20)));
      peristiwa.push({ t, jalan: () => tutupKasir(h, t), label: 'Tutup kasir' });
    }
    peristiwa.sort((a, b) => a.t - b.t);
    let i = 0;
    for (const e of peristiwa) {
      i++;
      process.stdout.write(`\r[${pad(i, 3)}/${peristiwa.length}] ${tglIso(e.t)} ${e.label}`.padEnd(90));
      await e.jalan();
    }
    for (const o of otc.filter((x) => !x.waktu)) await penjualanOtc(o);
    for (const v of kunjungan.filter((x) => x.hari === 0)) {
      process.stdout.write(`\r[hari ini] ${v.pasien.nama} (${v.kode}, ${v.status})`.padEnd(90));
      await prosesKunjungan(v);
    }
    console.log('\nSelesai.');
    await ringkasan();
  } finally {
    await db.end().catch(() => {});
    await mongo.close().catch(() => {});
  }
})().catch((e) => { console.error(`\n${e.stack ?? e.message}`); process.exit(1); });
