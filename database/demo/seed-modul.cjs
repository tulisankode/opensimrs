'use strict';

// Seeder TRANSAKSI per modul untuk faskes demo (development/staging saja), agar laporan tiap modul — dan Ekstensi
// SIMRS Studio yang dirakit dari laporan itu — punya data untuk ditampilkan.
//
// Berbeda dengan seed-transaksi.cjs (alur API rawat jalan), skrip ini INSERT LANGSUNG ke PostgreSQL per modul seperti
// seed-ramai.cjs. Setiap modul ada di database/demo/modul/<kode>.cjs dan hanya dijalankan pada faskes yang modul
// katalognya aktif (segmen + override Manajemen Modul). Data fiktif: pasien diambil dari pasien demo faskes itu
// (dibuat bila belum ada, NIK berawalan 9999, HP 080000000000, nama bertanda "(Demo)"), waktu tersebar N hari terakhir.
// Setiap baris yang dibuat dicatat di tabel jejak `demo_jejak_modul` (per faskes + modul), sehingga --bersihkan hanya
// menghapus data skrip ini dan modul yang sudah terisi dilewati (idempoten) kecuali --ulang.
//
// Pemakaian:
//   node database/demo/seed-modul.cjs                              semua tahap, semua faskes demo (sesuai modul aktif)
//   node database/demo/seed-modul.cjs --tahap 1 --faskes RSA        tahap 1 untuk RSUP Dharma Nusantara saja
//   node database/demo/seed-modul.cjs --modul ok,gizi [--ulang]     modul tertentu (--ulang: hapus isi lama lalu isi ulang)
//   node database/demo/seed-modul.cjs --bersihkan [--faskes RSA] [--modul ok]
//   node database/demo/seed-modul.cjs --daftar                      tampilkan modul seeder & faskes yang akan diisi
// Opsi lain: --hari 60 (rentang hari data), --benih <angka> (variasi acak, deterministik).
// Prasyarat: datamaster dari seed-demo.cjs (npm run db:demo:seed). Ditolak bila NODE_ENV/LINGKUNGAN = production.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Client } = require('pg');
const K = require('./katalog-demo.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
require('dotenv').config({ path: path.join(ROOT, '.env') });

// ── Argumen ────────────────────────────────────────────────────────────────────────────────────────────
const arg = (nama, bawaan) => {
  const i = process.argv.indexOf(`--${nama}`);
  if (i < 0) return bawaan;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
};
const daftarArg = (nama) => {
  const v = arg(nama, null);
  return typeof v === 'string' ? v.split(',').map((x) => x.trim()).filter(Boolean) : null;
};
const FASKES_PILIH = daftarArg('faskes')?.map((x) => x.toUpperCase()) ?? null;
const MODUL_PILIH = daftarArg('modul');
const TAHAP = arg('tahap', null);
const HARI = Math.max(7, Number(arg('hari', 60)) || 60);
const BENIH = Number(arg('benih', 20261021)) || 20261021;
const BERSIHKAN = !!arg('bersihkan', false);
const ULANG = !!arg('ulang', false);
const DAFTAR = !!arg('daftar', false);

const galat = (pesan) => { console.error(pesan); process.exit(1); };
for (const v of [process.env.NODE_ENV, process.env.LINGKUNGAN]) {
  if (/^(production|produksi)$/i.test(String(v ?? '').trim())) galat('Ditolak: skrip data demo tidak boleh dijalankan di lingkungan production.');
}

// ── Modul seeder (database/demo/modul/*.cjs) ─────────────────────────────────────────────────────────────
// Bentuk: { kode, nama, tahap, modul: [kode katalog — semua wajib aktif], fitur?: [kode fitur — salah satu aktif],
//           butuh?: [kode seeder lain yang harus jalan lebih dulu], seed: async (ctx) => 'ringkasan' }
const DIR_MODUL = path.join(__dirname, 'modul');
const SEEDER = fs.existsSync(DIR_MODUL)
  ? fs.readdirSync(DIR_MODUL).filter((f) => /^[a-z0-9-]+\.cjs$/.test(f)).map((f) => require(path.join(DIR_MODUL, f)))
  : [];
// Urutkan: tahap, lalu dependensi (butuh) sebelum pemakainya.
const urutkan = (daftar) => {
  const hasil = [];
  const kunjung = (s, jejak = new Set()) => {
    if (hasil.includes(s)) return;
    if (jejak.has(s.kode)) galat(`Dependensi melingkar seeder: ${[...jejak, s.kode].join(' → ')}`);
    jejak.add(s.kode);
    for (const b of s.butuh ?? []) {
      const d = SEEDER.find((x) => x.kode === b);
      if (d) kunjung(d, jejak);
    }
    hasil.push(s);
  };
  [...daftar].sort((a, b) => a.tahap - b.tahap || a.kode.localeCompare(b.kode)).forEach((s) => kunjung(s));
  return hasil.filter((s) => daftar.includes(s) || daftar.some((x) => (x.butuh ?? []).includes(s.kode)));
};

// ── Waktu (WIB) & acak deterministik ─────────────────────────────────────────────────────────────────────
const WIB = 7 * 3600;
const SEKARANG = Math.floor(Date.now() / 1000);
const awalHari = (e) => Math.floor((e + WIB) / 86400) * 86400 - WIB;
const tglIso = (e) => new Date((e + WIB) * 1000).toISOString().slice(0, 10);
const yymmdd = (e) => tglIso(e).slice(2).replace(/-/g, '');
const pad = (n, w) => String(n).padStart(w, '0');

const pembuatAcak = (benih) => {
  let s = benih >>> 0;
  const acak = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const antara = (a, b) => a + Math.floor(acak() * (b - a + 1));
  const pilih = (arr) => arr[Math.floor(acak() * arr.length)];
  const berbobot = (bobot) => {
    const daftar = Object.entries(bobot);
    let r = acak() * daftar.reduce((a, [, b]) => a + b, 0);
    for (const [k, b] of daftar) if ((r -= b) < 0) return k;
    return daftar[daftar.length - 1][0];
  };
  const acakSebagian = (arr, n) => [...arr].sort(() => acak() - 0.5).slice(0, n);
  return { acak, antara, pilih, berbobot, peluang: (p) => acak() < p, acakSebagian, desimal: (a, b, d = 1) => Number((a + acak() * (b - a)).toFixed(d)) };
};
const benihDari = (...teks) => {
  let h = BENIH;
  for (const c of teks.join('|')) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
  return h;
};

const uuidv7 = () => {
  const b = crypto.randomBytes(16);
  const t = BigInt(Date.now());
  for (let i = 0; i < 6; i++) b[i] = Number((t >> BigInt(8 * (5 - i))) & 255n);
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

// ── Nama fiktif ────────────────────────────────────────────────────────────────────────────────────────
const DEPAN_L = ['Adi', 'Bayu', 'Candra', 'Dimas', 'Eko', 'Fajar', 'Galih', 'Hendra', 'Irfan', 'Joko', 'Kurnia', 'Lukman', 'Mahesa', 'Nanda', 'Oki', 'Prasetya', 'Raka', 'Satria', 'Teguh', 'Wahyu'];
const DEPAN_P = ['Ayu', 'Bunga', 'Citra', 'Dewi', 'Endah', 'Fitri', 'Gita', 'Hesti', 'Indah', 'Julia', 'Kartika', 'Laras', 'Maya', 'Nurul', 'Okta', 'Putri', 'Ratna', 'Sinta', 'Tari', 'Wulan'];
const BELAKANG = ['Ramadani', 'Saputra', 'Lestari', 'Wibowo', 'Kusuma', 'Pratama', 'Anggraini', 'Hidayat', 'Permana', 'Rahayu', 'Setiawan', 'Maharani', 'Nugroho', 'Purnama', 'Utami'];

// ── PostgreSQL ─────────────────────────────────────────────────────────────────────────────────────────
const db = new Client({
  host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
});
const q = (sql, p = []) => db.query(sql, p);
const baris = async (sql, p = []) => (await q(sql, p)).rows;
const satu = async (sql, p = []) => (await q(sql, p)).rows[0];

async function siapkanJejak() {
  await q(`CREATE TABLE IF NOT EXISTS demo_jejak_modul (
    id bigserial PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, modul varchar(60) NOT NULL, tabel varchar(100) NOT NULL,
    kunci varchar(255) NOT NULL, created_at bigint NOT NULL)`);
  await q(`CREATE UNIQUE INDEX IF NOT EXISTS demo_jejak_modul_unik ON demo_jejak_modul (faskes_uuid, modul, tabel, kunci)`);
}

// Kolom tiap tabel (cache) untuk pesan galat yang jelas bila seeder memakai kolom yang tidak ada.
const cacheKolom = new Map();
const kolomTabel = async (tabel) => {
  if (!cacheKolom.has(tabel)) {
    const r = await baris(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`, [tabel]);
    if (!r.length) throw new Error(`Tabel "${tabel}" tidak ada di database (migrasi belum dijalankan?)`);
    cacheKolom.set(tabel, new Set(r.map((x) => x.column_name)));
  }
  return cacheKolom.get(tabel);
};

// Modul aktif faskes = preset segmen + inti + override (sama dengan setting-service hitungModulAktif).
async function modulAktifFaskes(fUuid) {
  const seg = await satu(`SELECT segmen_kode FROM faskes_segmen WHERE faskes_uuid = $1`, [fUuid]);
  const dasar = await baris(
    `SELECT m.kode FROM ref_modul m WHERE m.tersedia AND (m.inti OR m.kode IN (SELECT modul_kode FROM preset_segmen_modul WHERE segmen_kode = $1))`,
    [seg?.segmen_kode ?? '']);
  const aktif = new Set(dasar.map((r) => r.kode));
  for (const o of await baris(`SELECT modul_kode, aktif FROM faskes_modul_override WHERE faskes_uuid = $1`, [fUuid])) {
    if (o.aktif) aktif.add(o.modul_kode);
    else aktif.delete(o.modul_kode);
  }
  return aktif;
}
// Fitur aktif = fitur tersedia di ref_fitur, minus yang dimatikan preset segmen, lalu override faskes — selaras dengan
// setting-service (hitungFiturAktif). Fitur wajib selalu aktif. Kelayakan modul induk diperiksa terpisah (s.modul).
async function fiturAktifFaskes(fUuid) {
  const seg = await satu(`SELECT segmen_kode FROM faskes_segmen WHERE faskes_uuid = $1`, [fUuid]);
  const fitur = await baris(`SELECT kode, COALESCE(wajib, false) AS wajib FROM ref_fitur WHERE COALESCE(tersedia, false)`);
  const mati = new Set((await baris(`SELECT fitur_kode FROM preset_segmen_fitur_mati WHERE segmen_kode = $1`, [seg?.segmen_kode ?? ''])).map((r) => r.fitur_kode));
  const aktif = new Set(fitur.filter((x) => !mati.has(x.kode)).map((x) => x.kode));
  for (const o of await baris(`SELECT fitur_kode, aktif FROM faskes_fitur_override WHERE faskes_uuid = $1`, [fUuid])) {
    if (!fitur.some((x) => x.kode === o.fitur_kode)) continue; // fitur belum tersedia tidak bisa dinyalakan override
    if (o.aktif) aktif.add(o.fitur_kode);
    else if (!fitur.find((x) => x.kode === o.fitur_kode)?.wajib) aktif.delete(o.fitur_kode);
  }
  return aktif;
}

const KOLOM_OTOMATIS = Symbol('kolomOtomatis');

// ── Konteks per faskes + modul ─────────────────────────────────────────────────────────────────────────
async function muatMaster(F, fUuid) {
  const M = { faskes: { uuid: fUuid, kode: F.kode, nama: F.nama, segmen: F.segmen } };
  // Nama tenaga kesehatan ada di pegawai (practitioner.pegawai_uuid).
  const nakes = (dokter) => baris(`SELECT pr.uuid, pg.uuid AS pegawai_uuid, TRIM(CONCAT_WS(' ', pg.first_title, pg.name, pg.last_title)) AS name, pr.poli_pelayanan
    FROM practitioner pr JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid AND pg.faskes_uuid = pr.faskes_uuid
    WHERE pr.faskes_uuid = $1 AND pr.deleted_at IS NULL AND COALESCE(pr.is_doctor, false) = $2 ORDER BY pg.name`, [fUuid, dokter]);
  M.dokter = await nakes(true);
  M.nakes = await nakes(false);
  M.pegawai = await baris(`SELECT uuid, name, gender, tipe FROM pegawai WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY name`, [fUuid]);
  M.users = await baris(`SELECT uuid, username, practitioner_uuid FROM users WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY username`, [fUuid]);
  M.poli = await baris(`SELECT uuid, name FROM lokasi WHERE faskes_uuid = $1 AND deleted_at IS NULL AND is_poli = true ORDER BY name`, [fUuid]);
  M.lokasi = await baris(`SELECT uuid, code, name, pelayanan, location_type FROM lokasi WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY name`, [fUuid]);
  M.ruangan = await baris(`SELECT uuid, code, name, kelas_ruangan FROM ruangan WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY name`, [fUuid]);
  // Bed bangsal dari datamaster saja: bed buatan seeder (mis. Ruang ICU/ICCU) dikecualikan agar rujukan tidak menggantung
  // setelah seeder itu dibersihkan; kelas ruangan ikut dimuat untuk pemilihan bed sesuai hak kelas.
  M.bed = await baris(`SELECT b.uuid, b.room_uuid, b.no_bed, b.patient_uuid, r.kelas_ruangan FROM room_monitorings b
      JOIN ruangan r ON r.uuid = b.room_uuid AND r.deleted_at IS NULL
    WHERE b.faskes_uuid = $1 AND b.deleted_at IS NULL AND b.type = 'Bed'
      AND NOT EXISTS (SELECT 1 FROM demo_jejak_modul j WHERE j.faskes_uuid = b.faskes_uuid AND j.tabel = 'room_monitorings' AND j.kunci = b.uuid)
    ORDER BY b.room_uuid, b.no_bed`, [fUuid]);
  M.penjamin = await baris(`SELECT uuid, name FROM penjamin WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY name`, [fUuid]).catch(() => []);
  M.lokasiStok = await baris(`SELECT uuid, name, code FROM lokasi_stok WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY name`, [fUuid]).catch(() => []);
  M.itemMedis = await baris(`SELECT uuid, name, code FROM item_medis WHERE faskes_uuid = $1 AND deleted_at IS NULL ORDER BY name LIMIT 300`, [fUuid]).catch(() => []);
  M.pasien = await pasienLengkap(fUuid);
  // Kode wilayah untuk alamat pasien baru: kelurahan di kabupaten faskes demo (katalog-demo.cjs `kab`).
  const profil = await satu(`SELECT village, postal_code FROM addresses WHERE faskes_uuid = $1 AND village ~ '^[0-9]{10}$' LIMIT 1`, [fUuid]);
  M.kodePos = profil?.postal_code ?? F.kodePos ?? null;
  M.kelurahan = (await baris(`SELECT code FROM kelurahan WHERE code LIKE $1 ORDER BY code LIMIT 60`, [`${String(F.kab ?? profil?.village?.slice(0, 4) ?? '3578')}%`]).catch(() => [])).map((r) => r.code);
  return M;
}
// Pasien yang tampil di daftar & laporan: laporan rawat inap/admisi memakai JOIN wajib ke alamat & tanggal lahir.
const pasienLengkap = (fUuid) => baris(`SELECT p.uuid, p.name, p.no_rm, p.gender, p.birth_detail_uuid, bd.birth_date FROM patients p
    JOIN addresses a ON a.uuid = p.address_uuid AND a.deleted_at IS NULL JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid AND bd.deleted_at IS NULL
  WHERE p.faskes_uuid = $1 AND p.deleted_at IS NULL AND COALESCE(p.is_new_born, false) = false ORDER BY p.created_at DESC LIMIT 400`, [fUuid]);

function buatKonteks(F, M, seeder, aktif) {
  // Penanda seeder di nomor rawat inap: penghitung `urut` mulai dari 0 di tiap seeder, jadi tanpa penanda nomor
  // registrasi buatan seeder berbeda bisa bentrok (unik per faskes).
  const tagSeeder = `D${seeder.kode.replace(/[^a-z0-9]/g, '').slice(0, 4).toUpperCase()}`;
  const r = pembuatAcak(benihDari(F.kode, seeder.kode));
  const tulis = [];          // [tabel, baris] berurutan (urutan insert = urutan hapus terbalik)
  const ubah = [];           // [sql, params] dijalankan setelah insert (mis. mengisi bed)
  let urut = 0;
  const ctx = {
    db, q, baris, satu, M, F, faskes: M.faskes.uuid, modulAktif: aktif.modul, fiturAktif: aktif.fitur,
    ...r, uuidv7, pad, yymmdd, tglIso, awalHari, SEKARANG, HARI, WIB,
    // Waktu acak dalam N hari terakhir pada jam kerja/jaga (epoch detik). hariLalu(0) = hari ini.
    waktu: (minHari = 0, maksHari = HARI - 1, jamMulai = 7, jamSelesai = 21) => {
      const h = r.antara(minHari, maksHari);
      const t = awalHari(SEKARANG) - h * 86400 + r.antara(jamMulai * 3600, jamSelesai * 3600 - 1);
      return Math.min(t, SEKARANG - r.antara(60, 3600));
    },
    hariLalu: (n) => awalHari(SEKARANG) - n * 86400,
    nomor: () => ++urut,
    kode: (awalan, t) => `${awalan}${yymmdd(t ?? SEKARANG)}${pad(++urut, 4)}`,
    // Antrekan satu baris; uuid & faskes_uuid & created_at/updated_at diisi otomatis bila tidak diberikan.
    tambah: (tabel, data, { tanpaUuid = false, tanpaFaskes = false } = {}) => {
      const b = { ...(tanpaUuid ? {} : { uuid: uuidv7() }), ...(tanpaFaskes ? {} : { faskes_uuid: M.faskes.uuid }), ...data };
      // Waktu otomatis ditandai agar dibuang saat simpan bila tabel tidak punya kolomnya (mis. tabel koreksi hanya created_at).
      const otomatis = [];
      if (b.created_at === undefined) { b.created_at = data.updated_at ?? SEKARANG; otomatis.push('created_at'); }
      if (b.updated_at === undefined) { b.updated_at = b.created_at; otomatis.push('updated_at'); }
      if (otomatis.length) Object.defineProperty(b, KOLOM_OTOMATIS, { value: otomatis, enumerable: false });
      tulis.push([tabel, b]);
      return b;
    },
    ubahSetelah: (sql, params = []) => ubah.push([sql, params]),
    pilihDokter: () => (M.dokter.length ? r.pilih(M.dokter) : null),
    pilihNakes: () => (M.nakes.length ? r.pilih(M.nakes) : M.dokter.length ? r.pilih(M.dokter) : null),
    // Pasien demo faskes lengkap dengan alamat & tanggal lahir (dibuat bila belum ada / opsi.baru). Kelamin
    // 'Laki-laki'/'Perempuan' mengikuti data demo lain. opsi: { gender, baru, umur: [min, maks] tahun, waktu }
    pasien: (opsi = {}) => {
      const umurCocok = (p) => {
        if (!opsi.umur || !p.birth_date) return !opsi.umur;
        const th = (SEKARANG - Date.parse(p.birth_date) / 1000) / (365.25 * 86400);
        return th >= opsi.umur[0] && th <= opsi.umur[1];
      };
      const cocok = M.pasien.filter((p) => (!opsi.gender || p.gender === opsi.gender) && umurCocok(p));
      if (cocok.length && !opsi.baru) return r.pilih(cocok);
      const lk = opsi.gender ? opsi.gender === 'Laki-laki' : r.peluang(0.5);
      const t = opsi.waktu ?? SEKARANG;
      const [umurMin, umurMaks] = opsi.umur ?? [18, 80];
      const lahir = new Date((SEKARANG - (umurMin * 365.25 + r.acak() * (umurMaks - umurMin) * 365.25) * 86400) * 1000);
      const lahirIso = lahir.toISOString().slice(0, 10);
      const selisih = Math.floor((SEKARANG * 1000 - lahir.getTime()) / 86400000);
      const kel = M.kelurahan.length ? r.pilih(M.kelurahan) : null;
      const alamat = ctx.tambah('addresses', {
        full_address: `Jl. ${r.pilih(['Melati', 'Mawar', 'Kenanga', 'Diponegoro', 'Sudirman', 'Pahlawan', 'Merdeka', 'Gajah Mada'])} No. ${r.antara(1, 120)}`,
        prov: kel ? kel.slice(0, 2) : '35', city: kel ? kel.slice(0, 4) : '3578', district: kel ? kel.slice(0, 6) : null, village: kel,
        rt: pad(r.antara(1, 12), 3), rw: pad(r.antara(1, 8), 3), postal_code: M.kodePos, country: 'id-ID', created_at: t, updated_at: t,
      });
      const bd = ctx.tambah('birth_details', {
        birth_place: r.pilih(['Surabaya', 'Malang', 'Sidoarjo', 'Gresik', 'Mojokerto', 'Pasuruan', 'Jember']), birth_date: `${lahirIso}T00:00:00Z`,
        age_year: Math.floor(selisih / 365.25), age_month: Math.floor((selisih % 365.25) / 30.44), age_day: Math.floor((selisih % 365.25) % 30.44),
        status: true, created_at: t, updated_at: t,
      });
      const n = r.antara(100000, 999999);
      const anak = umurMaks < 17;
      const p = ctx.tambah('patients', {
        no_rm: `DM${M.faskes.kode}${pad(n, 6)}`, title: anak ? 'An. (Anak)' : lk ? 'Tn. (Tuan)' : 'Ny. (Nyonya)',
        name: `${r.pilih(lk ? DEPAN_L : DEPAN_P)} ${r.pilih(BELAKANG)} (Demo)`, identity: 'NIK',
        no_identity: `9999${pad(r.antara(0, 999999), 6)}${pad(n, 6)}`, gender: lk ? 'Laki-laki' : 'Perempuan', phone: '080000000000',
        birth_detail_uuid: bd.uuid, address_uuid: alamat.uuid, religion: 'Islam', language: 'ID', is_new_born: false, status: true, created_at: t, updated_at: t,
      });
      const salinan = { uuid: p.uuid, name: p.name, no_rm: p.no_rm, gender: p.gender, birth_detail_uuid: bd.uuid, birth_date: bd.birth_date };
      M.pasien.push(salinan);
      return salinan;
    },
    namaFiktif: (lk = r.peluang(0.5)) => `${r.pilih(lk ? DEPAN_L : DEPAN_P)} ${r.pilih(BELAKANG)}`,
    // Episode rawat inap historis yang SUDAH PULANG (status_ri 4) beserta riwayat_ruangan — dipakai modul klinis
    // (ICU/HDU/OK/…) sebagai induk episode. Bed tidak ditandai terisi (episode sudah selesai), jadi tidak mengganggu
    // monitoring kamar. opsi: { pasien, mulai (epoch), lamaHari, encounter: 'IGD'|'RJ'|'RI', bed, keluhan }
    rawatInap: (opsi = {}) => {
      const p = opsi.pasien ?? ctx.pasien();
      const mulai = opsi.mulai ?? ctx.waktu(3, HARI - 1);
      const lama = opsi.lamaHari ?? r.antara(2, 7);
      const bed = opsi.bed ?? (M.bed.length ? r.pilih(M.bed) : null);
      const dirawat = mulai + r.antara(30, 180) * 60;
      const pulang = Math.min(dirawat + lama * 86400 + r.antara(-4, 4) * 3600, SEKARANG - 3600);
      const dokter = opsi.dokter ?? ctx.pilihDokter();
      const ri = ctx.tambah('rawat_inaps', {
        payment_method: r.peluang(0.55) ? 2 : 1, no_reg: ctx.kode(`RI${tagSeeder}`, mulai), patient_uuid: p.uuid, name: p.name, no_rm: p.no_rm,
        gender: p.gender, birth_detail_uuid: p.birth_detail_uuid ?? null, practitioner_uuid: dokter?.uuid ?? null,
        tanggal_daftar: mulai, tanggal_dirawat: dirawat, status_ri: 4, encounter: opsi.encounter ?? r.pilih(['IGD', 'IGD', 'RJ']),
        monitoring_room_uuid: bed?.uuid ?? null, lokasi_uuid: bed?.room_uuid ?? null, no_spri: `SPRI/${tagSeeder}/${yymmdd(mulai)}/${pad(++urut, 5)}`,
        complaint: opsi.keluhan ?? r.pilih(['Demam tinggi', 'Sesak napas', 'Nyeri dada', 'Nyeri perut', 'Rencana operasi', 'Penurunan kesadaran']),
        // Kode yang dibaca resume medis & laporan: status_pulang home/aadvice/other-hfc/oth/exp-*, kondisi SNOMED
        // (359746009 Stabil, 268910001 Perbaikan, 162668006 Tidak Stabil).
        discharge_date: pulang, status_pulang: r.berbobot({ home: 85, aadvice: 4, 'other-hfc': 6, oth: 2, 'exp-gt48h': 2, 'exp-lt48h': 1 }),
        kondisi_pasien_pulang: r.berbobot({ 268910001: 55, 359746009: 40, 162668006: 5 }), no_pelayanan: ctx.kode(`PL${tagSeeder}`, mulai),
        upgrade_class: false, status: true, created_at: mulai, updated_at: pulang, ...(opsi.data ?? {}),
      });
      if (bed) ctx.tambah('riwayat_ruangan', { admission_uuid: ri.uuid, monitoring_ruangan_uuid: bed.uuid, status: true, created_at: dirawat, updated_at: pulang });
      return { ...ri, pasien: p, dokter, bed, mulai, dirawat, pulang };
    },
    // Episode rawat inap yang sudah ada di database (mis. dari seed-ramai/transaksi), status 3 (dirawat) atau 4 (pulang).
    rawatInapAda: (batas = 50) => baris(`SELECT uuid, no_reg, patient_uuid, name, no_rm, gender, practitioner_uuid, monitoring_room_uuid, lokasi_uuid,
        tanggal_daftar, tanggal_dirawat, discharge_date, status_ri FROM rawat_inaps
      WHERE faskes_uuid = $1 AND deleted_at IS NULL AND status_ri IN (3, 4) ORDER BY tanggal_daftar DESC LIMIT $2`, [M.faskes.uuid, batas]),
    log: (...a) => console.log('      ', ...a),
  };
  ctx._tulis = tulis;
  ctx._ubah = ubah;
  return ctx;
}

async function simpanModul(ctx, seeder) {
  const fUuid = ctx.faskes;
  // Validasi kolom lebih dulu → pesan jelas, bukan galat SQL samar.
  for (const [tabel, b] of ctx._tulis) {
    const kol = await kolomTabel(tabel);
    for (const k of b[KOLOM_OTOMATIS] ?? []) if (!kol.has(k)) delete b[k];
    const asing = Object.keys(b).filter((k) => !kol.has(k));
    if (asing.length) throw new Error(`Seeder ${seeder.kode}: kolom tidak ada di ${tabel}: ${asing.join(', ')}`);
  }
  await q('BEGIN');
  try {
    // Insert per tabel berurutan sesuai kemunculan pertama (induk sebelum anak), multi-baris per 200.
    const urutanTabel = [];
    const perTabel = new Map();
    for (const [t, b] of ctx._tulis) {
      if (!perTabel.has(t)) { perTabel.set(t, []); urutanTabel.push(t); }
      perTabel.get(t).push(b);
    }
    const jejak = [];
    for (const t of urutanTabel) {
      const daftar = perTabel.get(t);
      const kolom = [...new Set(daftar.flatMap((b) => Object.keys(b)))];
      for (let i = 0; i < daftar.length; i += 200) {
        const potong = daftar.slice(i, i + 200);
        const nilai = [];
        // Kolom yang tidak diberikan pada suatu baris memakai DEFAULT (bukan NULL), agar kolom NOT NULL ber-default aman
        // walau baris dalam satu tabel tidak seragam.
        const tempat = potong.map((b) => `(${kolom.map((k) => {
          if (!(k in b)) return 'DEFAULT';
          const v = b[k];
          nilai.push(v !== null && typeof v === 'object' && !(v instanceof Date) ? JSON.stringify(v) : v ?? null);
          return `$${nilai.length}`;
        }).join(', ')})`);
        await q(`INSERT INTO "${t}" (${kolom.map((k) => `"${k}"`).join(', ')}) VALUES ${tempat.join(', ')}`, nilai);
      }
      const kunci = (await kolomTabel(t)).has('uuid') ? 'uuid' : 'id';
      for (const b of daftar) if (b[kunci] != null) jejak.push([t, String(b[kunci])]);
    }
    for (const [sql, p] of ctx._ubah) await q(sql, p);
    for (let i = 0; i < jejak.length; i += 500) {
      const potong = jejak.slice(i, i + 500);
      const nilai = [fUuid, seeder.kode, SEKARANG];
      const tempat = potong.map(([t, k]) => { nilai.push(t, k); return `($1, $2, $${nilai.length - 1}, $${nilai.length}, $3)`; });
      await q(`INSERT INTO demo_jejak_modul (faskes_uuid, modul, tabel, kunci, created_at) VALUES ${tempat.join(', ')} ON CONFLICT DO NOTHING`, nilai);
    }
    // Penanda modul sudah diisi (juga untuk modul yang tidak menghasilkan baris).
    await q(`INSERT INTO demo_jejak_modul (faskes_uuid, modul, tabel, kunci, created_at) VALUES ($1, $2, '_selesai', '1', $3) ON CONFLICT DO NOTHING`, [fUuid, seeder.kode, SEKARANG]);
    await q('COMMIT');
    return jejak.length;
  } catch (e) {
    await q('ROLLBACK');
    throw e;
  }
}

// Hapus baris jejak (urutan terbalik: anak dulu). Baris yang diubah lewat ubahSetelah dikembalikan oleh modul lewat `bersihkan`.
async function bersihkanModul(fUuid, kodeModul) {
  const seeder = SEEDER.find((s) => s.kode === kodeModul);
  const jejak = await baris(`SELECT id, tabel, kunci FROM demo_jejak_modul WHERE faskes_uuid = $1 AND modul = $2 AND tabel <> '_selesai' ORDER BY id DESC`, [fUuid, kodeModul]);
  await q('BEGIN');
  try {
    if (seeder?.bersihkan) await seeder.bersihkan({ db, q, baris, satu, faskes: fUuid });
    const perTabel = new Map();
    for (const j of jejak) {
      if (!perTabel.has(j.tabel)) perTabel.set(j.tabel, []);
      perTabel.get(j.tabel).push(j.kunci);
    }
    for (const [t, kunci] of perTabel) {
      const kol = (await kolomTabel(t)).has('uuid') ? 'uuid' : 'id';
      for (let i = 0; i < kunci.length; i += 1000) {
        await q(`DELETE FROM "${t}" WHERE ${kol}::text = ANY($1) AND faskes_uuid = $2`, [kunci.slice(i, i + 1000), fUuid]);
      }
    }
    await q(`DELETE FROM demo_jejak_modul WHERE faskes_uuid = $1 AND modul = $2`, [fUuid, kodeModul]);
    await q('COMMIT');
    return jejak.length;
  } catch (e) {
    await q('ROLLBACK');
    throw e;
  }
}

async function main() {
  await db.connect();
  await siapkanJejak();
  let dipilih = SEEDER.filter((s) => (!MODUL_PILIH || MODUL_PILIH.includes(s.kode)) && (!TAHAP || TAHAP === 'semua' || String(s.tahap) === String(TAHAP)));
  if (MODUL_PILIH) {
    const asing = MODUL_PILIH.filter((m) => !SEEDER.some((s) => s.kode === m));
    if (asing.length) galat(`Modul seeder tidak dikenal: ${asing.join(', ')}. Tersedia: ${SEEDER.map((s) => s.kode).join(', ')}`);
  }
  // Membersihkan/mengisi ulang suatu seeder juga menyentuh seeder pemakainya (butuh), mis. pacu → kamar-operasi:
  // pemakai dibersihkan lebih dulu (FK tanpa CASCADE) lalu diisi ulang setelah induknya.
  if (BERSIHKAN || ULANG) {
    let tambahan = true;
    while (tambahan) {
      tambahan = false;
      for (const s of SEEDER) {
        if (!dipilih.includes(s) && (s.butuh ?? []).some((b) => dipilih.some((d) => d.kode === b))) { dipilih.push(s); tambahan = true; }
      }
    }
  }
  dipilih = urutkan(dipilih);
  const urutBersih = [...dipilih].reverse();
  const faskesDemo = K.FASKES.filter((F) => !FASKES_PILIH || FASKES_PILIH.includes(F.kode));
  const ringkas = [];
  for (const F of faskesDemo) {
    const f = await satu(`SELECT uuid, name FROM faskes WHERE code = $1 AND deleted_at IS NULL`, [F.kode]);
    if (!f) { console.log(`- ${F.kode}: belum ada (jalankan npm run db:demo:seed), dilewati`); continue; }
    // Pengaman: hanya faskes demo (nama sesuai katalog-demo.cjs), bukan faskes nyata yang kebetulan berkode sama.
    if (f.name !== F.nama) { console.log(`- ${F.kode}: bernama "${f.name}", bukan faskes demo "${F.nama}" — dilewati`); continue; }
    const aktif = { modul: await modulAktifFaskes(f.uuid), fitur: await fiturAktifFaskes(f.uuid) };
    const layak = (s) => (s.modul ?? []).every((m) => aktif.modul.has(m)) && (!s.fitur?.length || s.fitur.some((x) => aktif.fitur.has(x)));
    console.log(`\n${F.kode} · ${F.nama}`);
    if (BERSIHKAN || (ULANG && !DAFTAR)) {
      for (const s of urutBersih) {
        const n = await bersihkanModul(f.uuid, s.kode);
        if (n) console.log(`  - ${s.kode}: ${n} baris dihapus`);
      }
      if (BERSIHKAN) continue;
    }
    const M = await muatMaster(F, f.uuid);
    for (const s of dipilih) {
      if (!layak(s)) { if (DAFTAR) console.log(`  · ${s.kode}: modul/fitur tidak aktif`); continue; }
      if (DAFTAR) { console.log(`  ✓ ${s.kode} (tahap ${s.tahap}) ${s.nama}`); continue; }
      const sudah = await satu(`SELECT 1 FROM demo_jejak_modul WHERE faskes_uuid = $1 AND modul = $2 LIMIT 1`, [f.uuid, s.kode]);
      if (sudah) { console.log(`  = ${s.kode}: sudah terisi (pakai --ulang untuk mengisi ulang)`); continue; }
      const ctx = buatKonteks(F, M, s, aktif);
      try {
        const info = await s.seed(ctx);
        const n = await simpanModul(ctx, s);
        console.log(`  + ${s.kode}: ${n} baris${info ? ` — ${info}` : ''}`);
        ringkas.push([F.kode, s.kode, n]);
        // Pasien baru yang dibuat modul ini ikut dipakai modul berikutnya.
        M.pasien = await pasienLengkap(f.uuid);
      } catch (e) {
        console.log(`  ✗ ${s.kode}: ${e.message}`);
        ringkas.push([F.kode, s.kode, 'gagal']);
        process.exitCode = 1;
      }
    }
  }
  if (!BERSIHKAN && !DAFTAR) console.log(`\nSelesai: ${ringkas.filter((x) => x[2] !== 'gagal').length} modul-faskes terisi, ${ringkas.filter((x) => x[2] === 'gagal').length} gagal.`);
  await db.end();
}

main().catch(async (e) => {
  console.error(e);
  try { await db.end(); } catch { /* abaikan */ }
  process.exit(1);
});
