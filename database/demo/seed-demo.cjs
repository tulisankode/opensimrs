'use strict';

// Seeder demo: satu faskes per segmen Manajemen Modul (lihat katalog-demo.cjs), terisolasi per faskes_uuid.
// Isi: profil, segmen, lokasi/poli/kamar, penjamin, pegawai/praktisi/jadwal, role & akun, tarif, farmasi
// (master, harga, stok awal di depo/gudang), layar antrian, master penunjang (laboratorium, fisioterapi, radiologi, MCU). Tanpa transaksi pasien.
// Jalankan setelah reset-demo.cjs:  node database/demo/seed-demo.cjs
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const K = require('./katalog-demo.cjs');
// Master data layanan penunjang (lab-service & penunjang-service), satu berkas per modul.
const { seed: seedLab } = require('./seed-lab.cjs');
const { seed: seedFisioterapi } = require('./seed-fisioterapi.cjs');
const { seed: seedRadiologi } = require('./seed-radiologi.cjs');
const { seed: seedMcu } = require('./seed-mcu.cjs');
const { seed: seedPatologi } = require('./seed-patologi.cjs');
const { seed: seedMikrobiologi } = require('./seed-mikrobiologi.cjs');
const { seed: seedBankDarah } = require('./seed-bank-darah.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
require('dotenv').config({ path: path.join(ROOT, '.env') });
const PASSWORD = process.env.DEMO_PASSWORD || 'Demo@2026';
const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const LEVEL = { praktik_mandiri: 1, klinik_pratama: 2, puskesmas: 2, klinik_utama: 3, rs_d: 3, rs_c: 3, rs_b: 3, rs_a: 3 };
const KELAS = { 'Kelas 1': 1, 'Kelas 2': 2, 'Kelas 3': 3, VIP: 4, VVIP: 5 };
const EXP = '2028-12-31';

// Petugas layanan penunjang (fiktif) — nama dipilih per faskes agar tidak sama di semua faskes.
const NAMA_PENUNJANG = {
  fisioterapis: [['Rina Oktaviani', null, 'S.Tr.Ft', 'Perempuan'], ['Hadi Santoso', null, 'A.Md.Ft', 'Laki-laki'], ['Melati Ayuningtyas', null, 'S.Tr.Ft', 'Perempuan']],
  radiografer: [['Dimas Prasetyo', null, 'A.Md.Rad', 'Laki-laki'], ['Sari Rahmawati', null, 'S.Tr.Rad', 'Perempuan'], ['Bagas Kurniawan', null, 'A.Md.Rad', 'Laki-laki']],
  mcu: [['Laila Safitri', null, null, 'Perempuan'], ['Fadli Ramadhan', null, null, 'Laki-laki'], ['Nadia Putri', null, null, 'Perempuan']],
};
const stafPenunjang = (F) => {
  const i = (F.kode.charCodeAt(0) + F.kode.charCodeAt(2)) % 3;
  return [['fisioterapi', 'fisioterapis'], ['radiologi', 'radiografer'], ['mcu', 'mcu']].map(([modul, peran]) => [modul, peran, NAMA_PENUNJANG[peran][i]]);
};

// Modul katalog → modul permission (auth-service/src/helpers/permission-list.js)
const PERM_MODUL = {
  dashboard: ['Dashboard'], pendaftaran: ['Admisi'], antrian: ['Antrian'], rawat_jalan: ['Rawat Jalan'],
  rawat_inap: ['Rawat Inap'], igd: ['IGD'], farmasi: ['Farmasi', 'STOK'], inventory: ['Inventory'],
  laboratorium: ['Laboratorium'], pembayaran: ['Pembayaran'], datamaster: ['Datamaster'], laporan: ['Laporan'],
  fisioterapi: ['Fisioterapi'], radiologi: ['Radiologi'], mcu: ['MCU'],
  patologi_anatomi: ['Patologi Anatomi'], mikrobiologi: ['Mikrobiologi'], bank_darah: ['Bank Darah RS (BDRS)'],
  program_puskesmas: ['Program Puskesmas'], kamar_operasi: ['Kamar Operasi'], icu: ['ICU'], gizi: ['Gizi'],
  koding_rm: ['Koding Rekam Medis'], cssd: ['CSSD'], utd: ['UTD'], laundry: ['Laundry'], ambulans: ['Manajemen Ambulans'],
  sarpras: ['Sarana dan Prasarana (IPSRS)'], hemodialisa: ['Hemodialisa'], mutu: ['Mutu & Akreditasi'], sdm: ['HR / SDM'],
  akuntansi: ['Akuntansi & Remunerasi'], training: ['Training'],
};

// Beberapa definisi izin memakai nama modul yang sama (mis. Dashboard & Dashboard Eksekutif, Setting & Profile),
// sedangkan permission-sdk hanya membaca entri modul pertama yang cocok → gabungkan menjadi satu entri per modul.
const gabungModul = (daftar) => {
  const hasil = [];
  for (const d of daftar) {
    const ada = hasil.find((m) => m.module === d.module);
    if (!ada) { hasil.push(JSON.parse(JSON.stringify(d))); continue; }
    for (const sm of d.subModules ?? []) if (!ada.subModules.some((x) => x.name === sm.name)) ada.subModules.push(JSON.parse(JSON.stringify(sm)));
  }
  return hasil;
};
const PERAN = {
  admin: { nama: 'Admin Faskes', kode: 'ADM', modul: null },
  dokter: { nama: 'Dokter', kode: 'DOK', modul: ['Rawat Jalan', 'Rawat Inap', 'IGD', 'Laboratorium', 'Patologi Anatomi', 'Mikrobiologi', 'Bank Darah RS (BDRS)', 'Farmasi', 'Radiologi', 'MCU', 'Dashboard'] },
  fisioterapis: { nama: 'Fisioterapis', kode: 'FIS', modul: ['Fisioterapi', 'Dashboard'] },
  radiografer: { nama: 'Radiografer', kode: 'RAD', modul: ['Radiologi', 'Dashboard'] },
  mcu: { nama: 'Petugas MCU', kode: 'MCU', modul: ['MCU', 'Admisi', 'Dashboard'] },
  perawat: { nama: 'Perawat / Bidan', kode: 'PRW', modul: ['Rawat Jalan', 'Rawat Inap', 'IGD', 'Bank Darah RS (BDRS)', 'Dashboard'] },
  admisi: { nama: 'Petugas Pendaftaran', kode: 'PDF', modul: ['Admisi', 'Antrian', 'Dashboard'] },
  apoteker: { nama: 'Apoteker', kode: 'APT', modul: ['Farmasi', 'STOK', 'Dashboard'] },
  kasir: { nama: 'Kasir', kode: 'KSR', modul: ['Pembayaran', 'Laporan', 'Dashboard'] },
  lab: { nama: 'Analis Laboratorium', kode: 'LAB', modul: ['Laboratorium', 'Patologi Anatomi', 'Mikrobiologi', 'Bank Darah RS (BDRS)', 'Dashboard'] },
  gudang: { nama: 'Petugas Gudang Farmasi', kode: 'GDG', modul: ['Inventory', 'STOK', 'Dashboard'] },
  // Praktik mandiri: dokter pemilik mengelola semuanya, dibantu satu asisten.
  pemilik: { nama: 'Dokter Pemilik', kode: 'OWN', modul: null },
  asisten: { nama: 'Asisten Praktik', kode: 'AST', modul: ['Admisi', 'Rawat Jalan', 'Farmasi', 'STOK', 'Pembayaran', 'Dashboard'] },
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
const NOW = Math.floor(Date.now() / 1000);
const rupiah = (n) => Math.round(n / 500) * 500;
const slug = (s) => s.toLowerCase().split(' ')[0].replace(/[^a-z]/g, '');

let db;
const ins = async (tabel, baris) => {
  const data = { uuid: uuidv7(), ...baris };
  const kolom = Object.keys(data);
  const nilai = kolom.map((k) => (data[k] !== null && typeof data[k] === 'object' && !Array.isArray(data[k]) ? JSON.stringify(data[k]) : data[k]));
  await db.query(`INSERT INTO "${tabel}" (${kolom.map((k) => `"${k}"`).join(', ')}) VALUES (${kolom.map((_, i) => `$${i + 1}`).join(', ')})`, nilai);
  return data.uuid;
};
const satu = async (sql, p = []) => (await db.query(sql, p)).rows[0];

// Wilayah: kecamatan & kelurahan pertama yang cocok di kabupaten
async function wilayah(kab, kecNama) {
  const kec = await satu(`SELECT code, name FROM kecamatan WHERE kabupaten_code = $1 ${kecNama ? 'AND name ILIKE $2' : ''} ORDER BY code LIMIT 1`,
    kecNama ? [kab, kecNama] : [kab]);
  if (!kec) throw new Error(`Kecamatan ${kecNama ?? '-'} di ${kab} tidak ditemukan`);
  const kel = await satu(`SELECT code, name FROM kelurahan WHERE kecamatan_code = $1 ORDER BY code LIMIT 1`, [kec.code]);
  return { prov: kab.slice(0, 2), kab, kec, kel };
}

// NIK fiktif 16 digit: kab(4) + kec(2) + tgl lahir (perempuan +40) + urut(4)
let urutNik = 1;
const nik = (kab, tglLahir, gender) => {
  const [y, m, d] = tglLahir.split('-');
  const dd = String(Number(d) + (gender === 'Perempuan' ? 40 : 0)).padStart(2, '0');
  return `${kab}01${dd}${m}${y.slice(2)}${String(urutNik++).padStart(4, '0')}`;
};
const tglLahir = (i) => `${1972 + ((i * 7) % 24)}-${String(1 + ((i * 5) % 12)).padStart(2, '0')}-${String(1 + ((i * 11) % 27)).padStart(2, '0')}`;

async function modulAktif(segmen) {
  const { rows } = await db.query(
    `SELECT m.kode FROM ref_modul m WHERE m.tersedia AND (m.inti OR m.kode IN (SELECT modul_kode FROM preset_segmen_modul WHERE segmen_kode = $1))`,
    [segmen]);
  return rows.map((r) => r.kode);
}

async function seedFaskes(F, mapPermission, superRole) {
  const fUuid = uuidv7();
  const modul = await modulAktif(F.segmen);
  const level = LEVEL[F.segmen];
  const punya = (m) => modul.includes(m);
  const unit = ['Rawat Jalan', ...(punya('igd') ? ['IGD'] : []), ...(punya('rawat_inap') ? ['Rawat Inap'] : [])];
  const permSegmen = new Set([...modul.flatMap((m) => PERM_MODUL[m] ?? []), 'Setting', 'Profile', 'Dashboard']);
  const base = { faskes_uuid: fUuid, created_at: NOW, updated_at: NOW };
  const w = await wilayah(F.kab, F.kec);

  // ── Faskes & profil ──
  await db.query(`INSERT INTO faskes (uuid, code, name, status, client_id, client_secret, created_at, updated_at)
                  VALUES ($1,$2,$3,true,$4,$5,$6,$6)`, [fUuid, F.kode, F.nama, `demo-${F.kode.toLowerCase()}`, `demo-${F.kode.toLowerCase()}`, NOW]);
  const alamatProfil = await ins('addresses', { ...base, full_address: F.alamat, prov: 'JAWA TIMUR', city: F.kabNama,
    district: w.kec.name, village: w.kel.code, rt: '001', rw: '002', postal_code: F.kodePos, country: 'id-ID' });
  await ins('faskes_profiles', { ...base, uuid: fUuid, code: F.kode, name: F.nama, address_uuid: alamatProfil, phone: F.telp,
    email: F.email, website: F.web, url_gmaps: '', code_provinsi: '35', code_kabupaten: F.kab });
  await ins('integrations', { ...base, status_satu_sehat: false });
  await ins('printers', { ...base });
  await db.query(`INSERT INTO faskes_segmen (faskes_uuid, segmen_kode, diubah_oleh, created_at, updated_at) VALUES ($1,$2,'seeder demo',$3,$3)`,
    [fUuid, F.segmen, NOW]);

  // ── Lokasi ──
  const kat = {};
  for (const [kode, nama] of [['POLI', 'Poliklinik'], ['IGD', 'Gawat Darurat'], ['RI', 'Rawat Inap']]) {
    kat[kode] = await ins('kategori_ruangan', { ...base, code: `KR-${kode}`, name: nama, status: true });
  }
  const lok = async (o) => ins('lokasi', { ...base, description: o.name, phone: F.telp, email: F.email, url: F.web,
    status: true, is_poli: false, no_room: 0, pelayanan: 'RJ', kategori_ruangan_uuid: kat.POLI, ...o });
  const site = await lok({ code: `${F.kode}-SITE`, name: F.nama, location_type: 'Site' });
  const gedung = await lok({ code: `${F.kode}-GD1`, name: 'Gedung Utama', location_type: 'Building', part_of_uuid: site });
  const lantai1 = await lok({ code: `${F.kode}-LT1`, name: 'Lantai 1', location_type: 'Level', part_of_uuid: gedung });
  const poli = {};
  for (const [i, [kode, nama, jenis, kdBpjs]] of F.poli.entries()) {
    poli[kode] = { nama, uuid: await lok({ code: `${F.kode}-${kode}`, name: nama, location_type: 'Ward', part_of_uuid: lantai1,
      is_poli: true, code_antrian_poli: kode, jenis_poli: jenis, kd_poli_bpjs: kdBpjs, no_room: i + 1 }) };
  }
  if (F.igd) {
    await lok({ code: `${F.kode}-IGD`, name: 'Instalasi Gawat Darurat', location_type: 'Ward', part_of_uuid: lantai1,
      pelayanan: 'IGD', kategori_ruangan_uuid: kat.IGD, no_room: 90 });
  }

  // ── Penjamin ──
  const penjamin = [{ uuid: await ins('penjamin', { ...base, code: K.PENJAMIN_TUNAI[0], name: K.PENJAMIN_TUNAI[1], status: true }), name: K.PENJAMIN_TUNAI[1] }];
  for (const [kode, nama] of K.PENJAMIN_LAIN) {
    if (kode === 'BPJS' && !punya('bpjs_fktp') && !punya('bpjs_fkrtl')) continue;
    if (kode !== 'BPJS' && level < 3) continue; // asuransi swasta hanya klinik utama & RS
    penjamin.push({ uuid: await ins('penjamin', { ...base, code: kode, name: nama, phone: null, status: true }), name: nama });
  }
  const penjaminJson = JSON.stringify(penjamin.map((p) => ({ penjamin_uuid: p.uuid, penjamin_name: p.name })));

  // ── Rawat inap: kamar (lokasi Room = ruangan, uuid sama) + bed ──
  if (F.rawatInap) {
    const lantai2 = await lok({ code: `${F.kode}-LT2`, name: 'Lantai 2', location_type: 'Level', part_of_uuid: gedung, pelayanan: 'RI', kategori_ruangan_uuid: kat.RI });
    for (const [i, [kode, nama, kelas, jumlahBed, harga]] of F.rawatInap.entries()) {
      const kamar = await lok({ code: `${F.kode}-${kode}`, name: nama, location_type: 'Room', part_of_uuid: lantai2, pelayanan: 'RI',
        kategori_ruangan_uuid: kat.RI, class_code: String(KELAS[kelas]), class_name: kelas, no_room: 200 + i + 1 });
      await ins('ruangan', { ...base, uuid: kamar, code: `${F.kode}-${kode}`, name: nama, no_room: 200 + i + 1,
        kategori_ruangan_uuid: kat.RI, kelas_ruangan: KELAS[kelas], status: true });
      for (let b = 1; b <= jumlahBed; b++) {
        const bed = await lok({ code: `${F.kode}-${kode}-B${b}`, name: `Bed ${b} - ${nama}`, location_type: 'Bed', part_of_uuid: kamar,
          pelayanan: 'RI', kategori_ruangan_uuid: kat.RI, class_code: String(KELAS[kelas]), class_name: kelas, no_room: b });
        await ins('room_monitorings', { ...base, room_uuid: kamar, lokasi_uuid: bed, no_bed: String(b), type: 'Bed', status_operasional: 'Tersedia', status: true });
      }
      const hargaKamar = rupiah(harga);
      await ins('tarif', { ...base, jenis_tarif: 'Ruangan', code: `TR-${kode}`, name: `Sewa Kamar ${nama} (${kelas})`, grand_total: hargaKamar,
        mode: 'Single', is_mcu: false, lokasi_uuid: kamar, status: true, tindakan: '[]',
        unit_pelayanan: JSON.stringify([{ unit_pelayanan: 'Rawat Inap' }]),
        penjamin: JSON.stringify(penjamin.map((p) => ({ penjamin_uuid: p.uuid, penjamin_name: p.name, harga: hargaKamar }))) });
    }
  }

  // ── Pegawai, praktisi, role & akun ──
  const roleUuid = {};
  const buatRole = async (kunci) => {
    if (roleUuid[kunci]) return roleUuid[kunci];
    const p = PERAN[kunci];
    const modulPerm = (p.modul ?? [...permSegmen]).filter((m) => permSegmen.has(m) || m === 'Profile');
    // Sub-modul Setting › Audit Trail (STD-0029) tidak diberikan otomatis ke peran faskes, hanya ke super admin.
    const permissions = JSON.stringify(mapPermission([...new Set([...modulPerm, 'Profile'])])
      .map((m) => (m.module === 'Setting' ? { ...m, subModules: m.subModules.filter((sm) => sm.name !== 'Audit Trail') } : m)));
    roleUuid[kunci] = await ins('role', { ...base, code: `${F.kode}-${p.kode}`, name: p.nama, permissions, status: true });
    roleUuid[`${kunci}:perm`] = permissions;
    return roleUuid[kunci];
  };
  const akun = [];
  let idx = 0;
  const pakaiUsername = new Set();
  const buatUser = async ({ username, peran, praktisi, pegawaiNama }) => {
    let u = username;
    for (let n = 2; pakaiUsername.has(u); n++) u = `${username}${n}`;
    pakaiUsername.add(u);
    const r = await buatRole(peran);
    await ins('users', { ...base, role_uuid: r, practitioner_uuid: praktisi ?? null, username: u, email: `${u}@demo.opensimrs.local`,
      phone: `0812${String(3000000 + idx).padStart(7, '0')}`, password: await bcrypt.hash(PASSWORD, 10), permissions: roleUuid[`${peran}:perm`], status: true });
    akun.push([u, PERAN[peran].nama, pegawaiNama]);
  };
  const buatPegawai = async ([nama, depan, belakang, gender], tipe) => {
    idx++;
    const lahir = tglLahir(idx + F.kode.charCodeAt(0));
    const pegawai = await ins('pegawai', { ...base, name: nama, nik: nik(F.kab, lahir, gender), tipe, first_title: depan,
      last_title: belakang, tanggal_lahir: lahir, gender, status: true });
    return { pegawai, tampil: [depan, nama].filter(Boolean).join(' ') + (belakang ? `, ${belakang}` : '') };
  };

  const dokter = [];
  for (const [i, d] of F.dokter.entries()) {
    const { pegawai, tampil } = await buatPegawai(d, 1);
    const polis = d[4].map((k) => ({ lokasi_uuid: poli[k].uuid, name: poli[k].nama }));
    const kodeAntrian = `D${i + 1}`;
    const praktisi = await ins('practitioner', { ...base, pegawai_uuid: pegawai, sip: `SIP/${F.kode}/${2024 + (i % 2)}/${String(i + 1).padStart(3, '0')}`,
      str: `STR-${String(1000000 + idx * 37).slice(0, 7)}`, code_bpjs: `${F.kode}${String(i + 1).padStart(3, '0')}`, is_doctor: true,
      code_antrian_dokter: kodeAntrian, poli_pelayanan: JSON.stringify(polis), status: true });
    dokter.push({ praktisi, kodeAntrian, polis: d[4] });
    const peran = F.segmen === 'praktik_mandiri' ? 'pemilik' : 'dokter';
    const username = `${F.prefix}.${d[1] === 'drg.' ? 'drg' : 'dr'}.${slug(d[0])}`;
    await buatUser({ username, peran, praktisi, pegawaiNama: tampil });
  }
  for (const [i, s] of F.staf.entries()) {
    const peran = s[4];
    const nakes = ['perawat', 'apoteker', 'lab', 'asisten'].includes(peran);
    const { pegawai, tampil } = await buatPegawai(s, nakes ? 1 : 2);
    const praktisi = await ins('practitioner', { ...base, pegawai_uuid: pegawai, code_bpjs: `${F.kode}S${String(i + 1).padStart(2, '0')}`,
      is_doctor: false, status: true,
      poli_pelayanan: peran === 'perawat' || peran === 'asisten' ? JSON.stringify(Object.values(poli).map((p) => ({ lokasi_uuid: p.uuid, name: p.nama }))) : null });
    await buatUser({ username: `${F.prefix}.${peran === 'admisi' ? 'pendaftaran' : peran}`, peran, praktisi, pegawaiNama: tampil });
  }
  // Petugas layanan penunjang bila modulnya aktif di segmen faskes.
  for (const [modul, peran, staf] of stafPenunjang(F)) {
    if (!punya(modul)) continue;
    const { pegawai, tampil } = await buatPegawai(staf, 1);
    const praktisi = await ins('practitioner', { ...base, pegawai_uuid: pegawai, code_bpjs: `${F.kode}${PERAN[peran].kode}`, is_doctor: false, status: true });
    await buatUser({ username: `${F.prefix}.${peran}`, peran, praktisi, pegawaiNama: tampil });
  }
  if (F.segmen !== 'praktik_mandiri') {
    const { pegawai, tampil } = await buatPegawai(['Administrator Sistem', null, null, 'Laki-laki'], 2);
    const praktisi = await ins('practitioner', { ...base, pegawai_uuid: pegawai, code_bpjs: `${F.kode}ADM`, is_doctor: false, status: true });
    await buatUser({ username: `${F.prefix}.admin`, peran: 'admin', praktisi, pegawaiNama: tampil });
  }

  // ── Jadwal dokter (7 hari; admisi hanya menerima jadwal hari ini) ──
  const [mulai, selesai] = F.jam;
  const menit = (j) => Number(j.slice(0, 2)) * 60 + Number(j.slice(3));
  const kuotaJkn = punya('bpjs_fktp') || punya('bpjs_fkrtl') ? 8 : 0;
  const kuotaNon = F.segmen === 'praktik_mandiri' ? 12 : 22;
  for (const d of dokter) {
    for (const kp of d.polis) {
      for (const hari of HARI) {
        const kuota = kuotaJkn + kuotaNon;
        await ins('jadwal_dokter', { ...base, practitioner_uuid: d.praktisi, lokasi_uuid: poli[kp].uuid, day: hari, start_time: mulai,
          end_time: selesai, kuota, kuota_jkn: kuotaJkn, kuota_non_jkn: kuotaNon, durasi_pelayanan: Math.floor((menit(selesai) - menit(mulai)) / kuota),
          code_antrian_poli: kp, code_antrian_dokter: d.kodeAntrian, status: true });
      }
    }
  }

  // ── Layar antrian ──
  if (punya('antrian')) {
    const teks = JSON.stringify([`Selamat datang di ${F.nama}`, 'Mohon siapkan kartu identitas & kartu BPJS saat dipanggil']);
    await ins('layar_antrian', { ...base, nama_layar: 'Layar Pendaftaran', tipe_layar: 1, judul: 'Antrian Pendaftaran', is_admisi: true, is_poli: false, is_farmasi: false, flash_text: teks, status: true });
    const layarPoli = await ins('layar_antrian', { ...base, nama_layar: 'Layar Poliklinik', tipe_layar: 1, judul: 'Antrian Poliklinik', is_admisi: false, is_poli: true, is_farmasi: false, flash_text: teks, status: true });
    for (const p of Object.values(poli)) await ins('layar_antrian_poli', { faskes_uuid: fUuid, lokasi_uuid: p.uuid, layar_antrian_uuid: layarPoli });
    await ins('layar_antrian', { ...base, nama_layar: 'Layar Farmasi', tipe_layar: 1, judul: 'Antrian Pengambilan Obat', is_admisi: false, is_poli: false, is_farmasi: true, flash_text: teks, status: true });
  }

  // ── Tarif tindakan ──
  const komponen = {};
  for (const [kode, nama] of [['JS', 'Jasa Sarana'], ['JPD', 'Jasa Pelayanan Dokter'], ['JPP', 'Jasa Pelayanan Perawat'], ['JAL', 'Jasa Analis']]) {
    if (kode === 'JAL' && !punya('laboratorium')) continue;
    komponen[kode] = { uuid: await ins('name_tarif_komponen', { ...base, code: kode, name: nama, status: true }), nama };
  }
  for (const [kode, nama, harga, units, minLevel] of K.TINDAKAN) {
    const tersedia = units.filter((u) => unit.includes(u));
    if (minLevel > level || tersedia.length === 0) continue;
    const total = rupiah(harga * F.skala);
    const tindakan = await ins('tindakan', { ...base, code: kode, name: nama, status: true });
    const sarana = rupiah(total * 0.4);
    const komp = [[komponen.JS, sarana], [/^(KONS|VIS|USG|VISUS|EXT|TBL|SCL)/.test(kode) ? komponen.JPD : komponen.JPP, total - sarana]];
    await ins('tarif', { ...base, jenis_tarif: 'Tindakan', code: `T-${kode}`, name: nama, grand_total: total, mode: 'Single', is_mcu: false,
      status: true, penjamin: penjaminJson, unit_pelayanan: JSON.stringify(tersedia.map((u) => ({ unit_pelayanan: u }))),
      tindakan: JSON.stringify([{ tindakan_uuid: tindakan, tindakan_name: nama, total_harga: total,
        komponen_tarif: komp.map(([k, n]) => ({ tarif_komponen_uuid: k.uuid, tarif_komponen_name: k.nama, tarif_per_komponen: n, faskes_uuid: fUuid, tindakan_uuid: tindakan })) }]) });
  }
  if (F.segmen !== 'praktik_mandiri') {
    await ins('general_consent', { ...base, code: 'GC-UMUM', name: 'Persetujuan Umum (General Consent)', isi_surat: K.GENERAL_CONSENT, status: true });
  }

  // ── Farmasi ──
  const sat = {};
  for (const [kode, nama, dosis] of K.SATUAN) sat[kode] = { uuid: await ins('satuan', { ...base, code: kode, name: nama, status: true, satuan_dosis: dosis, editable: false }), nama };
  const bentuk = {};
  for (const [kode, nama] of K.BENTUK_SEDIAAN) bentuk[kode] = await ins('bentuk_sediaan', { ...base, code: kode, name: nama, status: true });
  const kategori = {};
  for (const [kode, nama] of K.KATEGORI_OBAT) kategori[kode] = await ins('kategori_obat', { ...base, code: kode, name: nama, status: true });
  const produsen = [];
  for (const [kode, nama, kab, kodePos, alamat] of K.PRODUSEN) {
    const wp = await wilayah(kab);
    produsen.push(await ins('manufactures', { ...base, code: kode, name: nama, status: true, alamat, kode_pos: kodePos,
      provinsi_code: wp.prov, kabupaten_code: kab, kecamatan_code: wp.kec.code, kelurahan_code: wp.kel.code }));
  }
  const jenisStok = await ins('jenis_stok', { ...base, code: 'UMUM', name: 'Umum', status: true });
  const lokasiStok = [];
  for (const [kode, nama, jenis, tujuan] of F.depo) {
    lokasiStok.push({ uuid: await ins('lokasi_stok', { ...base, code: kode, name: nama, status: true, jenis_lokasi: jenis, default_tujuan_order_permintaan: tujuan }), jenis });
  }
  for (const [kode, nama, unitP, periode, frek] of K.ATURAN_PAKAI) await ins('aturan_pakai', { ...base, code: kode, name: nama, periode_unit: unitP, periode, frekuensi: frek, status: true });
  for (const [kode, cara] of K.CARA_PAKAI) await ins('carai_pakai', { ...base, code: kode, cara_pakai: cara, status: true });
  for (const [nama, jumlah, emb, racik] of K.BENTUK_RACIKAN) await ins('bentuk_racikan', { ...base, nama_bentuk_racikan: nama, jumlah, tarif_embalase: emb, tarif_racik: racik });
  await ins('konfigurasi_harga', { ...base, metode_pemotongan_stok: 'FEFO', metode_hpp: 'average', ppn: 0, margin: level === 1 ? 20 : 25,
    biaya_embalase_racik: true, metode_biaya_racikan: 'paket', petugas: 'seeder demo' });
  for (const [kode, nama, kab, telp, alamat] of K.SUPPLIER) {
    if (F.segmen === 'praktik_mandiri' && kode !== 'APL') continue; // praktik cukup satu PBF langganan
    const wp = await wilayah(kab);
    const sup = await ins('master_supplier', { ...base, code: kode, name: nama, no_tlp: telp, status: true, alamat,
      provinsi_code: wp.prov, kabupaten_code: kab, kecamatan_code: wp.kec.code, kelurahan_code: wp.kel.code });
    await ins('master_supplier_kategori_item', { ...base, supllier_uuid: sup, kategori_item: 'medis' });
  }
  let jumlahObat = 0;
  for (const [i, [kode, nama, bnt, dosis, satDosis, satPakai, isi, satKemasan, kat, harga, jenis, zat, minLevel]] of K.OBAT.entries()) {
    if (minLevel > level) continue;
    jumlahObat++;
    const item = await ins('item_medis', { ...base, code: kode, name: nama, bentuk_sediaan_uuid: bentuk[bnt], dosis, satuan_dosis_uuid: sat[satDosis].uuid,
      isi_kemasan: isi, satuan_kemasan_uuid: sat[satKemasan].uuid, satuan_penggunaan_uuid: sat[satPakai].uuid,
      manufacture_uuid: produsen[jenis === 'alkes' ? 4 : i % 4], jenis_item: jenis, kategori_obat_uuid: kategori[kat],
      ingridients: zat ? JSON.stringify([{ name: zat }]) : null, status: true });
    const imjs = await ins('item_medis_jenis_stok', { ...base, item_medis_uuid: item, jenis_stok_uuid: jenisStok });
    const konversi = await ins('conversions', { ...base, item_medis_uuid: item, satuan_pembelian_uuid: sat[satKemasan].uuid, satuan_pembelian: sat[satKemasan].nama,
      satuan_penggunaan_uuid: sat[satPakai].uuid, satuan_penggunaan: sat[satPakai].nama, konversi: isi, status: true });
    await ins('harga_item', { ...base, item_medis_jenis_stok_uuid: imjs, harga_terakhir: harga, harga_avg: harga, hna: harga, harga_dasar: harga * isi });
    // Stok awal: gudang (bila ada) lebih banyak, tiap depo cukup untuk pelayanan harian.
    for (const ls of lokasiStok) {
      const jumlah = (ls.jenis === 'gudang' ? 20 : (level === 1 ? 2 : 5)) * isi;
      await ins('stock_medis', { ...base, exp_date: EXP, stok: jumlah, sisa_stok: jumlah, konversi_uuid: konversi, item_medis_jenis_stok_uuid: imjs,
        harga_satuan: harga, lokasi_stok_uuid: ls.uuid, no_po: 'SALDO-AWAL' });
    }
  }

  // ── Layanan penunjang: laboratorium (lab-service) & master penunjang-service, satu berkas per modul ──
  // Laboratorium lebih dulu karena paket MCU menunjuk item_pemeriksaan. Ctx yang sama dibangun isi-master-penunjang.cjs.
  const ringkasPenunjang = [];
  const ctx = { ins, satu, db, F, fUuid, base, punya, level, penjamin, rupiah, NOW, komponen };
  for (const [modul, seed] of [['laboratorium', seedLab], ['fisioterapi', seedFisioterapi], ['radiologi', seedRadiologi], ['mcu', seedMcu],
    ['patologi_anatomi', seedPatologi], ['mikrobiologi', seedMikrobiologi], ['bank_darah', seedBankDarah]]) {
    if (punya(modul)) ringkasPenunjang.push(await seed(ctx));
  }

  return { uuid: fUuid, akun, ringkas: [`${F.poli.length} poli, ${F.dokter.length} dokter, ${F.depo.length} lokasi stok, ${jumlahObat} item obat/BMHP`, ...ringkasPenunjang.filter(Boolean)].join(', ') };
}

(async () => {
  const izin = await import(pathToFileURL(path.join(ROOT, 'auth-service', 'src', 'helpers', 'permission-list.js')).href);
  const mapPermission = (daftar) => gabungModul(izin.mapPermission(daftar));
  db = new Client({
    host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  });
  await db.connect();
  const sisa = Number((await satu(`SELECT count(*) n FROM faskes`)).n);
  if (sisa > 0) {
    console.error(`Masih ada ${sisa} faskes. Jalankan reset-demo.cjs --ya dahulu.`);
    process.exit(1);
  }
  await db.query('BEGIN');
  try {
    // Zat aktif (global, tanpa faskes)
    const zat = [...new Set(K.OBAT.map((o) => o[11]).filter(Boolean))];
    for (const [i, nama] of zat.entries()) await ins('ingredients', { code: `ZA${String(i + 1).padStart(3, '0')}`, name: nama, status: true, created_at: NOW, updated_at: NOW });

    const hasil = [];
    for (const F of K.FASKES) hasil.push([F, await seedFaskes(F, mapPermission)]);

    // Superadmin global (role 'super admin' tanpa faskes) — faskes awal = praktik mandiri, berpindah lewat pilih faskes.
    // Semua definisi izin di permission-list.js (termasuk modul baru) — tidak perlu memperbarui daftar manual.
    const permSuper = JSON.stringify(gabungModul(Object.values(izin).filter((v) => v && typeof v === 'object' && v.module && Array.isArray(v.subModules))));
    const roleSuper = await ins('role', { faskes_uuid: null, code: 'SPR-ADM', name: 'super admin', permissions: permSuper, status: true, created_at: NOW, updated_at: NOW });
    await ins('users', { faskes_uuid: hasil[0][1].uuid, role_uuid: roleSuper, username: 'superadmin', email: 'superadmin@demo.opensimrs.local',
      phone: '081200000001', password: await bcrypt.hash(PASSWORD, 10), permissions: permSuper, status: true, created_at: NOW, updated_at: NOW });

    await db.query('COMMIT');
    console.log(`\nSeeder demo selesai. Kata sandi semua akun: ${PASSWORD}\n`);
    console.log('superadmin  (super admin — bisa pindah faskes)');
    for (const [F, r] of hasil) {
      console.log(`\n■ ${F.nama} — segmen ${F.segmen}\n  ${r.ringkas}`);
      for (const [u, peran, nama] of r.akun) console.log(`  ${u.padEnd(22)} ${peran.padEnd(24)} ${nama}`);
    }
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  } finally {
    await db.end();
  }
})().catch((e) => { console.error(e); process.exit(1); });
