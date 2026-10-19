'use strict';

// Skenario demo "ramai banget" untuk Virtual Office & Command Center (development/staging saja).
//
// Mengisi transaksi HARI INI (tanggal lokal Asia/Jakarta) dalam jumlah besar untuk satu faskes demo dengan status
// beragam di semua unit yang dibaca laporan-service/src/virtual-office/sumber.js dan
// laporan-service/src/repositories/command-center-repository.js:
//   antrean admisi (antrian.status_panggilan 0/1/2/4), kunjungan rawat jalan per poli (status_rj 1–5), IGD
//   (status_igd 1 tanpa/dengan asesmen, 2 pulang; sebagian > 4 jam), rawat inap (status_ri 1 menunggu kamar dari
//   IGD/RJ, 3 dirawat dengan bed terisi di room_monitorings, 4 pulang hari ini), order laboratorium (order_status 1/2/3,
//   ada cito), order radiologi (order/valid/diperiksa/selesai, ada cito), resep (order_status 1–5), tagihan
//   (berjalan/ditutup/lunas + payment_history).
// Insert langsung ke PostgreSQL (kredensial .env root seperti seed-demo.cjs), per batch dalam transaksi. Pasien fiktif
// dibuat sendiri (NIK berawalan 9999, HP 080000000000, nama bertanda "(Demo)"). Setiap baris yang dibuat/diubah dicatat
// di tabel jejak `demo_jejak_ramai`, sehingga --bersihkan hanya menghapus data skrip ini.
//
// Pemakaian:
//   node database/demo/seed-ramai.cjs [--faskes RSA] [--intensitas sedang|ramai|sangat-ramai] [--benih 7]
//   node database/demo/seed-ramai.cjs --hidup [--interval 10]   isi awal (bila belum ada) lalu terus memajukan status
//                                                               & menambah kedatangan; berhenti dengan Ctrl+C
//   node database/demo/seed-ramai.cjs --bersihkan               hapus semua baris yang dibuat skrip ini
// Prasyarat: datamaster dari seed-demo.cjs (poli, dokter, IGD, kamar & bed, depo farmasi). Ditolak bila
// NODE_ENV/LINGKUNGAN = production.
const path = require('path');
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
const KODE_FASKES = String(arg('faskes', 'RSA')).toUpperCase();
const NAMA_INTENSITAS = String(arg('intensitas', 'sangat-ramai')).toLowerCase();
const BENIH = Number(arg('benih', 20261020)) || 20261020;
const HIDUP = !!arg('hidup', false);
const INTERVAL = Math.max(3, Number(arg('interval', 10)) || 10);
const BERSIHKAN = !!arg('bersihkan', false);

// Jumlah isi awal & laju kedatangan per 10 detik pada mode --hidup.
const INTENSITAS = {
  sedang: { rj: 100, igd: 15, ri: 12, datangRj: [0, 1], peluangIgd: 0.1 },
  ramai: { rj: 200, igd: 25, ri: 20, datangRj: [0, 2], peluangIgd: 0.2 },
  'sangat-ramai': { rj: 320, igd: 40, ri: 30, datangRj: [1, 3], peluangIgd: 0.35 },
};
// Peluang satu transaksi maju satu status per 10 detik (mode --hidup). Dibuat kecil agar antrean tetap ramai:
// antrean stabil ≈ kedatangan ÷ peluang, sedangkan arus (pasien berjalan & log) mengikuti laju kedatangan.
const LAJU = {
  dipanggil: 0.25, admisi_selesai: 0.5, antre_poli: 0.35, diperiksa: 0.03, pulang_rj: 0.07, rj_ke_ri: 0.03,
  lab: 0.07, rad: 0.08, resep: 0.09, lunas: 0.08, igd_asesmen: 0.15, igd_pulang: 0.03, igd_ke_ri: 0.02,
  ri_bed: 0.12, ri_pulang: 0.008,
};
const N = INTENSITAS[NAMA_INTENSITAS];

const galat = (pesan) => { console.error(pesan); process.exit(1); };
for (const v of [process.env.NODE_ENV, process.env.LINGKUNGAN]) {
  if (/^(production|produksi)$/i.test(String(v ?? '').trim())) galat('Ditolak: skrip data demo tidak boleh dijalankan di lingkungan production.');
}
if (!N) galat(`Intensitas tidak dikenal: ${NAMA_INTENSITAS} (pilih sedang, ramai, atau sangat-ramai).`);
const FK = K.FASKES.find((f) => f.kode === KODE_FASKES);
if (!FK) galat(`Kode faskes demo tidak dikenal: ${KODE_FASKES}. Pilihan: ${K.FASKES.map((f) => f.kode).join(', ')}.`);

// ── Waktu (WIB, tanpa DST) ─────────────────────────────────────────────────────────────────────────────
const WIB = 7 * 3600;
const detik = () => Math.floor(Date.now() / 1000);
const awalHari = (e) => Math.floor((e + WIB) / 86400) * 86400 - WIB;
const tglIso = (e) => new Date((e + WIB) * 1000).toISOString().slice(0, 10);
const yymmdd = (e) => tglIso(e).slice(2).replace(/-/g, '');
const pad = (n, w) => String(n).padStart(w, '0');
const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Acak deterministik (mulberry32) ────────────────────────────────────────────────────────────────────
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
const pilih = (arr) => arr[Math.floor(acak() * arr.length)];
// Pilih kunci berbobot dari objek { nilai: bobot }.
const berbobot = (bobot) => {
  const daftar = Object.entries(bobot);
  let r = acak() * daftar.reduce((a, [, b]) => a + b, 0);
  for (const [k, b] of daftar) if ((r -= b) < 0) return k;
  return daftar[daftar.length - 1][0];
};
const peluang = (p) => acak() < p;
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
const KELUHAN_IGD = ['Nyeri dada', 'Sesak napas', 'Demam tinggi', 'Nyeri perut', 'Luka robek', 'Pusing berat', 'Muntah terus-menerus', 'Kejang'];

// ── PostgreSQL ─────────────────────────────────────────────────────────────────────────────────────────
const db = new Client({
  host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
});
const q = (sql, p = []) => db.query(sql, p);
const baris = async (sql, p = []) => (await q(sql, p)).rows;
const satu = async (sql, p = []) => (await q(sql, p)).rows[0];

// Konteks faskes & datamaster (diisi muatMaster).
const M = { faskes: null, poli: [], dokterPoli: new Map(), igd: null, ruangan: [], depo: {}, urut: 0 };
const nomor = () => ++M.urut;

// Antrean tulis per siklus: { tabel: [baris] } dan jejak [tabel, kunci].
let tulis = {};
let jejak = [];
const tambah = (tabel, data) => {
  (tulis[tabel] ??= []).push({ uuid: uuidv7(), faskes_uuid: M.faskes, ...data });
  const r = tulis[tabel][tulis[tabel].length - 1];
  jejak.push([tabel, r.uuid]);
  return r;
};

async function siapkanJejak() {
  await q(`CREATE TABLE IF NOT EXISTS demo_jejak_ramai (
    id bigserial PRIMARY KEY, faskes_uuid varchar(255) NOT NULL, tabel varchar(100) NOT NULL, kunci varchar(255) NOT NULL,
    created_at bigint NOT NULL)`);
  await q(`CREATE UNIQUE INDEX IF NOT EXISTS demo_jejak_ramai_unik ON demo_jejak_ramai (faskes_uuid, tabel, kunci)`);
}

// Tulis semua baris antrean + jejak dalam satu transaksi (insert multi-baris per 200).
async function simpan(ubah = []) {
  await q('BEGIN');
  try {
    for (const [tabel, daftar] of Object.entries(tulis)) {
      const kolom = [...new Set(daftar.flatMap((r) => Object.keys(r)))];
      for (let i = 0; i < daftar.length; i += 200) {
        const potong = daftar.slice(i, i + 200);
        const nilai = [];
        const tempat = potong.map((r) => `(${kolom.map((k) => { nilai.push(r[k] ?? null); return `$${nilai.length}`; }).join(', ')})`);
        await q(`INSERT INTO "${tabel}" (${kolom.map((k) => `"${k}"`).join(', ')}) VALUES ${tempat.join(', ')}`, nilai);
      }
    }
    for (const [sql, p] of ubah) await q(sql, p);
    await q(`DELETE FROM demo_jejak_ramai WHERE faskes_uuid = $1 AND tabel = '_urut'`, [M.faskes]);
    jejak.push(['_urut', String(M.urut)]);
    for (let i = 0; i < jejak.length; i += 500) {
      const potong = jejak.slice(i, i + 500);
      const nilai = [M.faskes, detik()];
      const tempat = potong.map(([t, k]) => { nilai.push(t, k); return `($1, $${nilai.length - 1}, $${nilai.length}, $2)`; });
      await q(`INSERT INTO demo_jejak_ramai (faskes_uuid, tabel, kunci, created_at) VALUES ${tempat.join(', ')} ON CONFLICT DO NOTHING`, nilai);
    }
    await q('COMMIT');
  } catch (e) {
    await q('ROLLBACK');
    throw e;
  } finally {
    tulis = {};
    jejak = [];
  }
}

async function muatMaster() {
  const f = await satu(`SELECT uuid, name FROM faskes WHERE code = $1 AND deleted_at IS NULL`, [KODE_FASKES]);
  if (!f) galat(`Faskes ${KODE_FASKES} belum ada. Jalankan dulu: npm run db:demo:seed`);
  // Pengaman: hanya faskes demo (nama sama dengan katalog-demo.cjs), bukan faskes nyata yang kebetulan berkode sama.
  if (f.name !== FK.nama) galat(`Faskes ${KODE_FASKES} di database bernama "${f.name}", bukan faskes demo "${FK.nama}". Dibatalkan.`);
  M.faskes = f.uuid;
  M.poli = await baris(`SELECT uuid, name, code_antrian_poli kode FROM lokasi
    WHERE faskes_uuid = $1 AND deleted_at IS NULL AND is_poli = true AND COALESCE(status, true) = true ORDER BY no_room, name`, [M.faskes]);
  if (!M.poli.length) galat('Faskes belum punya poli (datamaster demo belum diisi).');
  for (const p of await baris(`SELECT uuid, poli_pelayanan FROM practitioner WHERE faskes_uuid = $1 AND deleted_at IS NULL AND is_doctor = true`, [M.faskes])) {
    let daftar = [];
    try { daftar = typeof p.poli_pelayanan === 'string' ? JSON.parse(p.poli_pelayanan) : p.poli_pelayanan ?? []; } catch { /* abaikan */ }
    for (const x of daftar ?? []) if (x?.lokasi_uuid && !M.dokterPoli.has(x.lokasi_uuid)) M.dokterPoli.set(x.lokasi_uuid, p.uuid);
  }
  M.igd = (await satu(`SELECT uuid FROM lokasi WHERE faskes_uuid = $1 AND deleted_at IS NULL AND pelayanan = 'IGD' AND location_type = 'Ward' LIMIT 1`, [M.faskes]))?.uuid ?? null;
  M.ruangan = await baris(`SELECT uuid, name FROM ruangan WHERE faskes_uuid = $1 AND deleted_at IS NULL AND COALESCE(status, true) = true ORDER BY no_room, name`, [M.faskes]);
  for (const d of await baris(`SELECT uuid, code FROM lokasi_stok WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [M.faskes])) M.depo[d.code] = d.uuid;
  M.depo.rj = M.depo.DRJ ?? Object.values(M.depo)[0];
  M.depo.igd = M.depo.DGD ?? M.depo.rj;
  M.depo.ri = M.depo.DRI ?? M.depo.rj;
  if (!M.depo.rj) galat('Faskes belum punya lokasi stok farmasi (datamaster demo belum diisi).');
  M.urut = await urutTerakhir();
}
// Nomor urut (No. RM, No. Reg, nomor order, dll.) dilanjutkan dari nilai terakhir yang tercatat di jejak.
const urutTerakhir = async () =>
  Number((await satu(`SELECT COALESCE(max(kunci::bigint), 0) n FROM demo_jejak_ramai WHERE faskes_uuid = $1 AND tabel = '_urut'`, [M.faskes])).n);

const bedKosong = () => baris(`SELECT uuid, room_uuid FROM room_monitorings
  WHERE faskes_uuid = $1 AND deleted_at IS NULL AND type = 'Bed' AND COALESCE(status, true) = true AND patient_uuid IS NULL
    AND room_uuid IN (SELECT uuid FROM ruangan WHERE faskes_uuid = $1 AND deleted_at IS NULL AND COALESCE(status, true) = true)
  ORDER BY room_uuid, no_bed`, [M.faskes]);

// ── Pembuat baris ──────────────────────────────────────────────────────────────────────────────────────
const pasienBaru = (t) => {
  const n = nomor();
  const lk = peluang(0.5);
  return tambah('patients', {
    no_rm: `R${pad(n, 7)}`, name: `${pilih(lk ? DEPAN_L : DEPAN_P)} ${pilih(BELAKANG)} (Demo)`, identity: 'NIK',
    no_identity: `9999${pad(antara(0, 999999), 6)}${pad(n % 1000000, 6)}`, gender: lk ? 'Laki-laki' : 'Perempuan',
    phone: '080000000000', created_at: t, updated_at: t,
  });
};
const identitas = (p) => ({ patient_uuid: p.uuid, name: p.name, no_rm: p.no_rm, gender: p.gender });
const noReg = (awalan, t) => `${awalan}R${yymmdd(t)}${pad(nomor(), 5)}`;

const tagihan = (p, t, kondisi) => {
  const total = antara(8, 120) * 5000;
  const b = tambah('bills', {
    patient_uuid: p.uuid, name: p.name, invoice_code: `INV/R/${yymmdd(t)}/${pad(nomor(), 6)}`, bill_code: `BLR${yymmdd(t)}${pad(nomor(), 6)}`,
    status: kondisi === 'lunas', close_bill: kondisi !== 'berjalan', sub_total: total, grand_total: total, ppn: 0, discount: 0,
    created_at: t, updated_at: t,
  });
  if (kondisi === 'lunas') bayar(b, t);
  return b;
};
const bayar = (b, t) => tambah('payment_history', {
  bill_uuid: b.uuid, amount: b.grand_total, payment_type: 'CASH', payment_method: pilih(['CASH', 'CASH', 'DEBIT', 'TRANSFER']),
  status: true, receipt_number: `KWR-${KODE_FASKES}-${yymmdd(t)}-${pad(nomor(), 6)}`, note: 'Data demo ramai', created_at: t, updated_at: t,
});

const orderLab = (k, pelayanan, lokasi, t, status, cito) => tambah('order_lab', {
  no_order: `LBR${yymmdd(t)}${pad(nomor(), 5)}`, noreg: k.no_reg, patient_uuid: k.patient_uuid, no_rm: k.no_rm,
  rekam_medis_date: String(t * 1000), payment_method: k.payment_method, pelayanan, lokasi_uuid: lokasi ?? M.poli[0].uuid,
  dokter_pengirim_uuid: k.practitioner_uuid ?? null, pasien_maternitas: false, tgl_order: String(t * 1000), tgl_pemeriksaan: String(t * 1000),
  cito, status_puasa: false, petugas_order: 'Data demo ramai', order_status: status, created_at: t, updated_at: t,
});
const orderRad = (k, pelayanan, lokasi, t, status, cito) => tambah('rad_order', {
  no_order: `RDR${yymmdd(t)}${pad(nomor(), 5)}`, patient_uuid: k.patient_uuid, no_rm: k.no_rm, no_reg: k.no_reg, sumber: 'rme', pelayanan,
  lokasi_asal_uuid: lokasi ?? null, dokter_pengirim_uuid: k.practitioner_uuid ?? null, payment_method: k.payment_method, cito, tanpa_tagihan: false,
  status, dibuat_oleh: 'Data demo ramai', created_at: t, updated_at: t,
  ...(status === 'selesai' ? { selesai_pada: t } : {}), ...(status !== 'order' ? { divalidasi_pada: t } : {}),
});
const resep = (k, jenis, lokasi, t, status) => tambah('prescriptions', {
  no_resep: `RSR${yymmdd(t)}${pad(nomor(), 5)}`, no_reg: k.no_reg, patient_uuid: k.patient_uuid, no_rm: k.no_rm, order_date: t, order_status: status,
  is_takeaway: false, lokasi_stok_uuid: M.depo[jenis], dokter_order: k.practitioner_uuid ?? 'Data demo ramai', jenis_pelayanan: jenis,
  lokasi_uuid: lokasi ?? M.poli[0].uuid, payment_method: k.payment_method, total_harga: antara(3, 60) * 5000,
  ...(status >= 2 ? { status_telaah: true, waktu_verifikasi: t } : {}), ...(status >= 5 ? { waktu_pemberian: t, penerima: 'Keluarga pasien' } : {}),
  created_at: t, updated_at: t,
});

// Kunjungan rawat jalan + antrean admisi (+ order/resep/tagihan sesuai status).
const POLI_RAMAI = (i) => (i < 3 ? 3 : 1); // poli awal (umum, dalam, anak) lebih ramai
const kunjunganRj = (t0, status, sekarang) => {
  const poliBobot = Object.fromEntries(M.poli.map((p, i) => [i, POLI_RAMAI(i)]));
  const poli = M.poli[Number(berbobot(poliBobot))];
  const p = pasienBaru(t0);
  const checkin = status >= 2 ? Math.min(sekarang - 240, t0 + antara(2, 15) * 60) : null;
  const periksa = status >= 4 ? Math.min(sekarang - 120, checkin + antara(10, 90) * 60) : null;
  const pulang = status >= 5 ? Math.min(sekarang - 60, periksa + antara(10, 40) * 60) : null;
  const n = nomor();
  const k = tambah('rawat_jalans', {
    payment_method: peluang(0.45) ? 2 : 1, no_reg: noReg('RJ', t0), ...identitas(p), no_antrian_admisi: `A${pad(n % 1000, 3)}`,
    no_antrian_poli: `${poli.kode ?? 'P'}-${pad(n % 1000, 3)}`, tanggal_daftar: t0, jadwal_periksa: t0, tanggal_checkin: checkin,
    tanggal_periksa: periksa, discharge_date: pulang, practitioner_uuid: M.dokterPoli.get(poli.uuid) ?? null, lokasi_uuid: poli.uuid,
    platform: pilih(['loket', 'loket', 'mobile']), status_rj: status, complaint: 'Kontrol / keluhan umum', maternity: false,
    ...(status >= 5 ? { status_pulang: 'Pulang' } : {}), created_at: t0, updated_at: pulang ?? periksa ?? checkin ?? t0,
  });
  const panggil = status === 1 ? Number(berbobot({ 0: 75, 1: 15, 2: 10 })) : 4;
  tambah('antrian', {
    patient_uuid: p.uuid, rawat_jalan_uuid: k.uuid, status_panggilan: panggil, pelayanan: 'admisi', jenis_pasien: k.payment_method === 2 ? 'bpjs' : 'umum',
    pasien_baru: false, created_at: t0, updated_at: checkin ?? t0,
  });
  if (status >= 2) tagihan(p, checkin, status < 5 ? 'berjalan' : peluang(0.65) ? 'lunas' : 'ditutup');
  if (status >= 4) {
    const tOrder = periksa + 300;
    if (peluang(0.55)) orderLab(k, 'rajal', poli.uuid, tOrder, status === 4 ? antara(1, 2) : peluang(0.8) ? 3 : 2, peluang(0.1));
    if (peluang(0.22)) orderRad(k, 'rajal', poli.uuid, tOrder, status === 4 ? pilih(['order', 'valid', 'diperiksa']) : pilih(['diperiksa', 'selesai', 'selesai']), peluang(0.1));
    if (peluang(0.8)) resep(k, 'rj', poli.uuid, tOrder, status === 4 ? antara(1, 2) : Number(berbobot({ 3: 2, 4: 2, 5: 6 })));
  }
  return k;
};

const kunjunganIgd = (t0, jenis, sekarang) => {
  const p = pasienBaru(t0);
  const asesmen = jenis !== 'baru' && (jenis !== 'aktif' || peluang(0.55));
  const keluar = jenis === 'pulang' || jenis === 'ke_ri' ? Math.min(sekarang - 60, t0 + antara(60, 240) * 60) : null;
  const k = tambah('instalasi_gawat_darurats', {
    payment_method: peluang(0.4) ? 2 : 1, no_reg: noReg('IG', t0), ...identitas(p), practitioner_uuid: null, tanggal_daftar: t0, tanggal_dirawat: t0,
    maternity: false, status_igd: keluar ? 2 : 1, lokasi_uuid: M.igd, complaint: pilih(KELUHAN_IGD), kondisi_tiba: pilih(['Sadar', 'Lemah', 'Gelisah']),
    transportation: pilih(['Kendaraan pribadi', 'Ambulans', 'Ojek']), rekam_medis_uuid: asesmen ? crypto.randomBytes(12).toString('hex') : null,
    discharge_date: keluar, status_pulang: jenis === 'ke_ri' ? 'Rawat Inap' : keluar ? 'Pulang' : null, created_at: t0, updated_at: keluar ?? t0,
  });
  if (asesmen) {
    const tOrder = t0 + antara(15, 50) * 60;
    if (peluang(0.55)) orderLab(k, 'igd', M.igd, tOrder, keluar ? 3 : antara(1, 3), peluang(0.5));
    if (peluang(0.3)) orderRad(k, 'igd', M.igd, tOrder, keluar ? 'selesai' : pilih(['order', 'valid', 'diperiksa', 'selesai']), peluang(0.4));
    if (peluang(0.6)) resep(k, 'igd', M.igd, tOrder, keluar ? 5 : antara(1, 4));
  }
  tagihan(p, t0, keluar ? (peluang(0.6) ? 'lunas' : 'ditutup') : 'berjalan');
  if (jenis === 'ke_ri') rawatInap(p, k, 'IGD', keluar, 1, null, pilih(M.ruangan)?.uuid ?? null);
  return k;
};

// status 1 = menunggu kamar, 3 = dirawat (bed), 4 = pulang hari ini.
const rawatInap = (p, asal, encounter, t0, status, bed, ruang, pulang = null) => {
  const r = tambah('rawat_inaps', {
    payment_method: asal?.payment_method ?? (peluang(0.5) ? 2 : 1), no_reg: noReg('RI', t0), ...identitas(p), practitioner_uuid: asal?.practitioner_uuid ?? null,
    tanggal_daftar: t0, tanggal_dirawat: status >= 3 ? t0 + antara(30, 180) * 60 : null, status_ri: status, encounter,
    monitoring_room_uuid: bed?.uuid ?? null, lokasi_uuid: bed?.room_uuid ?? ruang, no_spri: `SPRI/R/${yymmdd(t0)}/${pad(nomor(), 5)}`,
    discharge_date: pulang, ...(pulang ? { status_pulang: 'Pulang' } : {}), complaint: asal?.complaint ?? 'Rencana rawat inap',
    created_at: t0, updated_at: pulang ?? t0,
  });
  return r;
};

// ── Isi awal ───────────────────────────────────────────────────────────────────────────────────────────
async function isiAwal() {
  const sekarang = detik();
  const awal = awalHari(sekarang);
  // Kedatangan tersebar sejak pukul 06.00 (atau sejak tengah malam bila skrip dijalankan dini hari).
  const mulai = sekarang - awal > 7 * 3600 ? Math.max(awal + 6 * 3600, sekarang - 12 * 3600) : awal;
  const waktu = (minDurasi = 0) => antara(mulai, Math.max(mulai, sekarang - minDurasi - 120));
  const ubah = [];

  // Rawat jalan.
  const MIN = { 1: 0, 2: 300, 3: 600, 4: 1800, 5: 3600 };
  for (let i = 0; i < N.rj; i++) {
    const s = Number(berbobot({ 1: 10, 2: 8, 3: 24, 4: 12, 5: 46 }));
    kunjunganRj(waktu(MIN[s]), s, sekarang);
  }
  // IGD: aktif (sebagian > 4 jam), pulang, dan pindah ke rawat inap (menunggu kamar).
  for (let i = 0; i < (M.igd ? N.igd : 0); i++) {
    const jenis = berbobot({ aktif: 55, pulang: 25, ke_ri: 20 });
    const lama = jenis === 'aktif' && i % 6 === 0;
    const t0 = lama ? sekarang - antara(250, 540) * 60 : waktu(jenis === 'aktif' ? 0 : 5400);
    kunjunganIgd(t0, jenis, sekarang);
  }
  // Rawat inap: bed terisi (dirawat), pulang hari ini, menunggu kamar dari RJ.
  const bed = await bedKosong();
  const dirawat = Math.min(bed.length, N.ri);
  for (let i = 0; i < dirawat; i++) {
    const b = bed[i];
    const hariIni = peluang(0.35);
    const t0 = hariIni ? waktu(3600) : awal - antara(1, 6) * 86400 + antara(8, 20) * 3600;
    const p = pasienBaru(t0);
    const r = rawatInap(p, null, pilih(['IGD', 'RJ']), t0, 3, b, b.room_uuid);
    ubah.push([`UPDATE room_monitorings SET patient_uuid = $2, status_operasional = 'Penuh', updated_at = $3 WHERE uuid = $1 AND patient_uuid IS NULL`, [b.uuid, p.uuid, sekarang]]);
    jejak.push(['room_monitorings', b.uuid]);
    tagihan(p, Math.max(t0, awal), 'berjalan');
    if (peluang(0.4)) resep(r, 'ri', b.room_uuid, waktu(), antara(1, 5));
    if (peluang(0.3)) orderLab(r, 'ranap', b.room_uuid, waktu(), antara(1, 3), peluang(0.15));
  }
  for (let i = 0; i < (M.ruangan.length ? Math.round(N.ri * 0.15) : 0); i++) {
    const t0 = awal - antara(2, 7) * 86400;
    rawatInap(pasienBaru(t0), null, pilih(['IGD', 'RJ']), t0, 4, null, pilih(M.ruangan)?.uuid ?? null, waktu());
  }
  for (let i = 0; i < (M.ruangan.length ? Math.max(1, Math.round(N.ri * 0.1)) : 0); i++) {
    const t0 = waktu(1800);
    rawatInap(pasienBaru(t0), null, 'RJ', t0, 1, null, peluang(0.5) ? pilih(M.ruangan)?.uuid ?? null : null);
  }
  jejak.push(['_isi_awal', tglIso(sekarang)]);
  const jumlah = Object.fromEntries(Object.entries(tulis).map(([t, d]) => [t, d.length]));
  await simpan(ubah);
  return { ...jumlah, bed_terisi: dirawat };
}

// ── Mode hidup: satu siklus ────────────────────────────────────────────────────────────────────────────
const milikSkrip = (tabel) => `uuid IN (SELECT kunci FROM demo_jejak_ramai WHERE faskes_uuid = $1 AND tabel = '${tabel}')`;
const ambil = (tabel, kondisi, kolom = 'uuid') => baris(`SELECT ${kolom} FROM ${tabel} WHERE faskes_uuid = $1 AND deleted_at IS NULL AND ${milikSkrip(tabel)} AND ${kondisi}`, [M.faskes]);
const sebagian = (daftar, p) => daftar.filter(() => peluang(p));
// Peluang per siklus dari peluang per 10 detik, mengikuti --interval.
const laju = (k) => 1 - Math.pow(1 - LAJU[k], INTERVAL / 10);

async function siklus() {
  const sekarang = detik();
  const awal = awalHari(sekarang);
  const ubah = [];
  const hitung = {};
  const catat = (k, n = 1) => { hitung[k] = (hitung[k] ?? 0) + n; };
  const set = (tabel, uuid, kolom) => {
    const k = Object.keys(kolom);
    ubah.push([`UPDATE ${tabel} SET ${k.map((x, i) => `"${x}" = $${i + 2}`).join(', ')}, updated_at = $${k.length + 2} WHERE uuid = $1`, [uuid, ...Object.values(kolom), sekarang]]);
  };

  // Kedatangan baru: rawat jalan (antre admisi) & IGD.
  const datang = Math.round(antara(N.datangRj[0], N.datangRj[1]) * INTERVAL / 10);
  for (let i = 0; i < datang; i++) kunjunganRj(sekarang, 1, sekarang + 600);
  catat('datang_rj', datang);
  if (M.igd && peluang(1 - Math.pow(1 - N.peluangIgd, INTERVAL / 10))) { kunjunganIgd(sekarang, 'baru', sekarang + 600); catat('datang_igd'); }

  // Antrean admisi: menunggu → dipanggil → selesai (kunjungan check-in + tagihan berjalan); terlewat dipanggil ulang.
  for (const a of sebagian(await ambil('antrian', `status_panggilan IN (0, 2) AND created_at >= ${awal}`, 'uuid'), laju('dipanggil'))) { set('antrian', a.uuid, { status_panggilan: 1 }); catat('admisi_dipanggil'); }
  for (const a of sebagian(await ambil('antrian', `status_panggilan = 1 AND created_at >= ${awal}`, 'uuid, rawat_jalan_uuid, patient_uuid'), laju('admisi_selesai'))) {
    set('antrian', a.uuid, { status_panggilan: 4 });
    if (a.rawat_jalan_uuid) set('rawat_jalans', a.rawat_jalan_uuid, { status_rj: 2, tanggal_checkin: sekarang });
    const p = await satu(`SELECT uuid, name FROM patients WHERE uuid = $1`, [a.patient_uuid]);
    if (p) tagihan(p, sekarang, 'berjalan');
    catat('admisi_selesai');
  }
  // Rawat jalan: check-in → antre poli → diperiksa (order/resep) → pulang (tagihan ditutup); sebagian ke rawat inap.
  const rj = await ambil('rawat_jalans', `status_rj IN (2, 3, 4) AND tanggal_daftar >= ${awal}`, 'uuid, status_rj, no_reg, patient_uuid, name, no_rm, gender, payment_method, practitioner_uuid, lokasi_uuid, complaint');
  for (const k of rj) {
    if (k.status_rj === 2 && peluang(laju('antre_poli'))) { set('rawat_jalans', k.uuid, { status_rj: 3 }); catat('rj_antre_poli'); }
    else if (k.status_rj === 3 && peluang(laju('diperiksa'))) {
      set('rawat_jalans', k.uuid, { status_rj: 4, tanggal_periksa: sekarang });
      if (peluang(0.3)) { orderLab(k, 'rajal', k.lokasi_uuid, sekarang, 1, peluang(0.1)); catat('order_lab'); }
      if (peluang(0.12)) { orderRad(k, 'rajal', k.lokasi_uuid, sekarang, 'order', peluang(0.1)); catat('order_rad'); }
      if (peluang(0.65)) { resep(k, 'rj', k.lokasi_uuid, sekarang, 1); catat('resep'); }
      catat('rj_diperiksa');
    } else if (k.status_rj === 4 && peluang(laju('pulang_rj'))) {
      set('rawat_jalans', k.uuid, { status_rj: 5, discharge_date: sekarang, status_pulang: 'Pulang' });
      if (peluang(laju('rj_ke_ri'))) { rawatInap({ uuid: k.patient_uuid, name: k.name, no_rm: k.no_rm, gender: k.gender }, k, 'RJ', sekarang, 1, null, pilih(M.ruangan)?.uuid ?? null); catat('rj_ke_ri'); }
      catat('rj_pulang');
    }
  }
  for (const b of await ambil('bills', `status = false AND close_bill = false AND created_at >= ${awal} AND patient_uuid IN (
      SELECT patient_uuid FROM rawat_jalans WHERE faskes_uuid = $1 AND status_rj = 5 AND discharge_date >= ${awal})`, 'uuid')) set('bills', b.uuid, { close_bill: true });

  // Penunjang & farmasi.
  for (const o of await ambil('order_lab', `order_status IN (1, 2) AND created_at >= ${awal}`, 'uuid, order_status')) {
    if (peluang(laju('lab'))) { set('order_lab', o.uuid, { order_status: o.order_status + 1 }); catat('lab_maju'); }
  }
  const LANJUT_RAD = { order: 'valid', valid: 'diperiksa', diperiksa: 'selesai' };
  for (const o of await ambil('rad_order', `status IN ('order', 'valid', 'diperiksa') AND created_at >= ${awal}`, 'uuid, status')) {
    if (peluang(laju('rad'))) { set('rad_order', o.uuid, { status: LANJUT_RAD[o.status], ...(o.status === 'diperiksa' ? { selesai_pada: sekarang } : {}) }); catat('rad_maju'); }
  }
  for (const o of await ambil('prescriptions', `order_status BETWEEN 1 AND 4 AND created_at >= ${awal}`, 'uuid, order_status')) {
    if (peluang(laju('resep'))) { set('prescriptions', o.uuid, { order_status: o.order_status + 1, ...(o.order_status === 4 ? { waktu_pemberian: sekarang, penerima: 'Keluarga pasien' } : {}) }); catat('resep_maju'); }
  }
  // Kasir: tagihan ditutup → lunas (+ riwayat pembayaran).
  for (const b of sebagian(await ambil('bills', `status = false AND close_bill = true AND created_at >= ${awal}`, 'uuid, grand_total'), laju('lunas'))) {
    set('bills', b.uuid, { status: true });
    bayar(b, sekarang);
    catat('lunas');
  }
  // IGD: diasesmen → pulang atau pindah rawat inap (menunggu kamar).
  for (const k of await ambil('instalasi_gawat_darurats', `status_igd = 1 AND tanggal_daftar >= ${sekarang - 48 * 3600}`, 'uuid, rekam_medis_uuid, no_reg, patient_uuid, name, no_rm, gender, payment_method, practitioner_uuid, complaint')) {
    if (!k.rekam_medis_uuid) { if (peluang(laju('igd_asesmen'))) { set('instalasi_gawat_darurats', k.uuid, { rekam_medis_uuid: crypto.randomBytes(12).toString('hex') }); catat('igd_diasesmen'); } continue; }
    const r = acak();
    if (r < laju('igd_pulang')) { set('instalasi_gawat_darurats', k.uuid, { status_igd: 2, discharge_date: sekarang, status_pulang: 'Pulang' }); catat('igd_pulang'); }
    else if (r < laju('igd_pulang') + laju('igd_ke_ri')) {
      set('instalasi_gawat_darurats', k.uuid, { status_igd: 2, discharge_date: sekarang, status_pulang: 'Rawat Inap' });
      rawatInap({ uuid: k.patient_uuid, name: k.name, no_rm: k.no_rm, gender: k.gender }, k, 'IGD', sekarang, 1, null, pilih(M.ruangan)?.uuid ?? null);
      catat('igd_ke_ri');
    }
  }
  // Rawat inap: menunggu kamar → dirawat bila ada bed kosong; sebagian pasien dirawat pulang (bed dilepas).
  const kosong = await bedKosong();
  for (const r of await ambil('rawat_inaps', `status_ri = 1`, 'uuid, patient_uuid, lokasi_uuid')) {
    if (!kosong.length || !peluang(laju('ri_bed'))) continue;
    const i = Math.max(0, kosong.findIndex((b) => b.room_uuid === r.lokasi_uuid));
    const [b] = kosong.splice(i, 1);
    set('rawat_inaps', r.uuid, { status_ri: 3, monitoring_room_uuid: b.uuid, lokasi_uuid: b.room_uuid, tanggal_dirawat: sekarang });
    ubah.push([`UPDATE room_monitorings SET patient_uuid = $2, status_operasional = 'Penuh', updated_at = $3 WHERE uuid = $1 AND patient_uuid IS NULL`, [b.uuid, r.patient_uuid, sekarang]]);
    jejak.push(['room_monitorings', b.uuid]);
    catat('ri_dapat_bed');
  }
  for (const r of await ambil('rawat_inaps', `status_ri = 3`, 'uuid, monitoring_room_uuid')) {
    if (!peluang(laju('ri_pulang'))) continue;
    set('rawat_inaps', r.uuid, { status_ri: 4, discharge_date: sekarang, status_pulang: 'Pulang' });
    if (r.monitoring_room_uuid) ubah.push([`UPDATE room_monitorings SET patient_uuid = NULL, status_operasional = 'Tersedia', updated_at = $2 WHERE uuid = $1`, [r.monitoring_room_uuid, sekarang]]);
    catat('ri_pulang');
  }
  await simpan(ubah);
  return hitung;
}

// ── Bersihkan ──────────────────────────────────────────────────────────────────────────────────────────
const URUTAN_HAPUS = ['payment_history', 'bills', 'prescriptions', 'rad_order', 'order_lab', 'antrian', 'rawat_inaps', 'instalasi_gawat_darurats', 'rawat_jalans', 'patients'];
async function bersihkan() {
  const jejakAda = await baris(`SELECT tabel, count(*)::int n FROM demo_jejak_ramai WHERE faskes_uuid = $1 GROUP BY 1`, [M.faskes]);
  if (!jejakAda.length) { console.log(`Tidak ada data demo ramai tercatat untuk ${KODE_FASKES}.`); return {}; }
  const hasil = {};
  await q('BEGIN');
  try {
    // Bed yang pernah diisi skrip dikosongkan hanya bila penghuninya pasien skrip ini.
    const bed = await q(`UPDATE room_monitorings SET patient_uuid = NULL, status_operasional = 'Tersedia', updated_at = $2
      WHERE faskes_uuid = $1 AND uuid IN (SELECT kunci FROM demo_jejak_ramai WHERE faskes_uuid = $1 AND tabel = 'room_monitorings')
        AND patient_uuid IN (SELECT kunci FROM demo_jejak_ramai WHERE faskes_uuid = $1 AND tabel = 'patients')`, [M.faskes, detik()]);
    hasil.bed_dikosongkan = bed.rowCount;
    for (const t of URUTAN_HAPUS) {
      const r = await q(`DELETE FROM "${t}" WHERE faskes_uuid = $1 AND ${milikSkrip(t)}`, [M.faskes]);
      if (r.rowCount) hasil[t] = r.rowCount;
    }
    await q(`DELETE FROM demo_jejak_ramai WHERE faskes_uuid = $1`, [M.faskes]);
    await q('COMMIT');
  } catch (e) {
    await q('ROLLBACK');
    throw e;
  }
  return hasil;
}

// ── Utama ──────────────────────────────────────────────────────────────────────────────────────────────
const ringkas = (o) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(', ') || 'tidak ada perubahan';

(async () => {
  await db.connect();
  try {
    await siapkanJejak();
    await muatMaster();
    console.log(`Faskes ${KODE_FASKES} — ${FK.nama} (${M.poli.length} poli, ${M.ruangan.length} ruangan rawat inap)`);
    if (BERSIHKAN) {
      console.log(`Dihapus: ${ringkas(await bersihkan())}.`);
      return;
    }
    const hariIni = tglIso(detik());
    const isi = await baris(`SELECT kunci FROM demo_jejak_ramai WHERE faskes_uuid = $1 AND tabel = '_isi_awal'`, [M.faskes]);
    if (isi.some((r) => r.kunci === hariIni)) {
      console.log(`Isi awal demo ramai untuk ${hariIni} sudah ada; tidak digandakan.`
        + (HIDUP ? ' Melanjutkan mode hidup.' : ' Jalankan dengan --hidup untuk melanjutkan, atau --bersihkan lalu ulangi.'));
    } else {
      if (isi.length) console.log(`Data demo ramai hari sebelumnya (${isi.map((r) => r.kunci).join(', ')}) dibersihkan dulu: ${ringkas(await bersihkan())}.`);
      console.log(`Isi awal (${NAMA_INTENSITAS}, benih ${BENIH}): ${ringkas(await isiAwal())}.`);
    }
    if (!HIDUP) return;

    let berhenti = false;
    let bangun = null;
    for (const sinyal of ['SIGTERM', 'SIGBREAK']) process.on(sinyal, () => process.emit('SIGINT'));
    process.on('SIGINT', () => { berhenti = true; console.log('\nBerhenti setelah siklus berjalan selesai…'); bangun?.(); });
    console.log(`Mode hidup: siklus tiap ${INTERVAL} detik. Tekan Ctrl+C untuk berhenti.`);
    for (let n = 1; !berhenti; n++) {
      const jam = new Date((detik() + WIB) * 1000).toISOString().slice(11, 19);
      console.log(`[${jam}] siklus ${n}: ${ringkas(await siklus())}`);
      await new Promise((r) => { bangun = r; setTimeout(r, INTERVAL * 1000); });
    }
  } finally {
    await db.end();
  }
})().catch((e) => {
  console.error('Gagal:', e.message);
  process.exit(1);
});
