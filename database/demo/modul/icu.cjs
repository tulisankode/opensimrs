'use strict';

// Seeder demo modul ICU / Intensif (rawat-inap-service, tabel icu_*). Master faskes demo belum punya kamar intensif,
// jadi seeder membuat kamar "Ruang ICU" sendiri (lokasi Room + ruangan + bed + tarif kamar) lalu mengisi:
//   konfigurasi layanan (icu_layanans umum/neuro, icu_layanan_beds, icu_template_versis ditetapkan, riwayat
//   konfigurasi) dan nilai kritis faskes (icu_nilai_kritis);
//   episode: rawat_inaps → riwayat_ruangan (bed bangsal awal) → perpindahans approve bangsal → ICU → icu_perawatans
//   + serah terima masuk → flowsheet observasi (tiap 1–4 jam, maks 40/episode, sebagian dikoreksi berjejak) →
//   intake-output per shift → skor SOFA masuk & harian → dokumentasi klinis harian (template) → serah terima keluar +
//   perpindahans keluar ke bangsal (hidup) atau episode ditutup kondisi_keluar 'meninggal'.
// Sebagian kecil episode masih aktif: pasien baru (Demo) menempati bed ICU milik seeder ini (rawat_inaps status 3,
// bed patient_uuid terisi saat insert), sehingga bed bangsal yang sudah ada tidak diubah.
// Fungsi bantu diekspor lewat `bantu` dan dipakai ulang seeder CCU (episode intensif bersama icu_perawatans.unit).

const JAM = 3600;
const HARI_DTK = 86400;
const batas = (v, min, maks) => Math.max(min, Math.min(maks, v));

// Jumlah per segmen: [episode, aktif, bed].
const JUMLAH = { rs_a: [30, 4, 6], rs_b: [20, 3, 4], rs_c: [12, 2, 3], rs_d: [6, 1, 2] };

// ── Bantu bersama ICU/CCU ─────────────────────────────────────────────────────────────────────────────────

const namaPencatat = (ctx) => {
  const perawat = ctx.M.users.filter((u) => /perawat/.test(u.username));
  return (perawat.length ? ctx.pilih(perawat) : ctx.M.users.length ? ctx.pilih(ctx.M.users) : { username: 'perawat.demo' }).username;
};
const namaDokterUser = (ctx) => {
  const dr = ctx.M.users.filter((u) => /\.dr\./.test(u.username));
  return (dr.length ? ctx.pilih(dr) : { username: namaPencatat(ctx) }).username;
};

// Kamar intensif milik seeder (lokasi Room + ruangan uuid sama + lokasi Bed + room_monitorings + tarif kamar),
// mengikuti pola seed-demo.cjs. Bila kamar berkode sama sudah ada, dipakai apa adanya (tanpa episode aktif).
async function siapkanRuang(ctx, { kode, nama, jumlahBed, harga }) {
  const kodeRuang = `${ctx.F.kode}-${kode}`;
  const ada = await ctx.satu(`SELECT uuid FROM lokasi WHERE faskes_uuid = $1 AND code = $2 AND location_type = 'Room' AND deleted_at IS NULL`, [ctx.faskes, kodeRuang]);
  if (ada) {
    const beds = await ctx.baris(`SELECT uuid, room_uuid, no_bed, patient_uuid FROM room_monitorings
      WHERE faskes_uuid = $1 AND room_uuid = $2 AND deleted_at IS NULL AND type = 'Bed' ORDER BY no_bed`, [ctx.faskes, ada.uuid]);
    return { uuid: ada.uuid, nama, beds, baru: false };
  }
  const contoh = await ctx.satu(`SELECT part_of_uuid, kategori_ruangan_uuid, phone, email, url FROM lokasi
    WHERE faskes_uuid = $1 AND location_type = 'Room' AND pelayanan = 'RI' AND deleted_at IS NULL ORDER BY no_room LIMIT 1`, [ctx.faskes]);
  if (!contoh) throw new Error('Faskes belum punya kamar rawat inap (jalankan npm run db:demo:seed)');
  const maks = await ctx.satu(`SELECT COALESCE(MAX(no_room), 200) AS n FROM lokasi WHERE faskes_uuid = $1 AND location_type = 'Room' AND deleted_at IS NULL`, [ctx.faskes]);
  const noRoom = Number(maks.n) + 1;
  const dibuat = ctx.hariLalu(ctx.HARI + 30);
  const umum = { phone: contoh.phone, email: contoh.email, url: contoh.url, status: true, is_poli: false, pelayanan: 'RI',
    kategori_ruangan_uuid: contoh.kategori_ruangan_uuid, class_code: '1', class_name: 'Kelas 1', created_at: dibuat };
  const kamar = ctx.tambah('lokasi', { ...umum, code: kodeRuang, name: nama, description: nama, location_type: 'Room',
    part_of_uuid: contoh.part_of_uuid, no_room: noRoom });
  ctx.tambah('ruangan', { uuid: kamar.uuid, code: kodeRuang, name: nama, no_room: noRoom, kategori_ruangan_uuid: contoh.kategori_ruangan_uuid,
    kelas_ruangan: 1, status: true, created_at: dibuat });
  const beds = [];
  for (let b = 1; b <= jumlahBed; b++) {
    const lok = ctx.tambah('lokasi', { ...umum, code: `${kodeRuang}-B${b}`, name: `Bed ${b} - ${nama}`, description: `Bed ${b} - ${nama}`,
      location_type: 'Bed', part_of_uuid: kamar.uuid, no_room: b });
    // Objek bed sengaja dikembalikan apa adanya: episode aktif mengisi patient_uuid sebelum insert dijalankan kerangka.
    beds.push(ctx.tambah('room_monitorings', { room_uuid: kamar.uuid, lokasi_uuid: lok.uuid, no_bed: String(b), type: 'Bed',
      status_operasional: 'Tersedia', status: true, patient_uuid: null, created_at: dibuat }));
  }
  const kodeTarif = `TR-${kode}`;
  const tarifAda = await ctx.satu(`SELECT 1 FROM tarif WHERE faskes_uuid = $1 AND code = $2 AND deleted_at IS NULL`, [ctx.faskes, kodeTarif]);
  if (!tarifAda) {
    ctx.tambah('tarif', { jenis_tarif: 'Ruangan', code: kodeTarif, name: `Sewa Kamar ${nama}`, grand_total: harga, mode: 'Single', is_mcu: false,
      lokasi_uuid: kamar.uuid, status: true, tindakan: '[]', unit_pelayanan: JSON.stringify([{ unit_pelayanan: 'Rawat Inap' }]),
      penjamin: JSON.stringify(ctx.M.penjamin.map((p) => ({ penjamin_uuid: p.uuid, penjamin_name: p.name, harga }))), created_at: dibuat });
  }
  return { uuid: kamar.uuid, nama, beds, baru: true };
}

// Jadwal episode per bed tanpa tumpang tindih: `aktif` bed terakhir diisi episode yang masih berjalan, sisanya episode
// selesai tersebar merata di rentang HARI (jeda antarepisode disesuaikan agar data tidak menumpuk di awal periode).
function jadwalEpisode(ctx, beds, jumlah, aktif, lamaAcak, rerataLama) {
  const hasil = [];
  const akhir = new Map(beds.map((b) => [b.uuid, ctx.SEKARANG - ctx.antara(3, 8) * JAM]));
  for (const bed of ctx.acakSebagian(beds, Math.min(aktif, beds.length))) {
    const mulai = ctx.SEKARANG - ctx.antara(5, 96) * JAM;
    hasil.push({ bed, mulai, keluar: null });
    akhir.set(bed.uuid, mulai - ctx.antara(4, 30) * JAM);
  }
  const sisa = jumlah - hasil.length;
  const rentang = (ctx.HARI - 1) * HARI_DTK;
  const jeda = Math.max(6 * JAM, 0.85 * (rentang * beds.length - sisa * rerataLama) / Math.max(1, sisa));
  const kursor = new Map(beds.map((b) => [b.uuid, ctx.hariLalu(ctx.HARI - 1) + Math.floor(ctx.acak() * jeda)]));
  let dibuat = 0;
  while (dibuat < sisa) {
    const bed = beds.filter((b) => kursor.get(b.uuid) !== Infinity).sort((a, b) => kursor.get(a.uuid) - kursor.get(b.uuid))[0];
    if (!bed) break;
    const mulai = kursor.get(bed.uuid);
    const ruang = akhir.get(bed.uuid) - mulai;
    if (ruang < 20 * JAM) { kursor.set(bed.uuid, Infinity); continue; }
    const lama = Math.min(lamaAcak(), ruang - ctx.antara(0, 4) * JAM);
    hasil.push({ bed, mulai, keluar: mulai + lama });
    kursor.set(bed.uuid, mulai + lama + Math.round(jeda * (0.4 + ctx.acak() * 1.2)));
    dibuat++;
  }
  return hasil.sort((a, b) => a.mulai - b.mulai);
}

// Bed bangsal (riwayat sebelum/sesudah episode intensif): bed rawat inap selain kamar intensif buatan seeder ICU/CCU.
async function bedBangsal(ctx) {
  const intensif = new Set((await ctx.baris(`SELECT uuid FROM lokasi WHERE faskes_uuid = $1 AND location_type = 'Room' AND code = ANY($2)`,
    [ctx.faskes, [`${ctx.F.kode}-ICU`, `${ctx.F.kode}-ICCU`]])).map((r) => r.uuid));
  const hasil = ctx.M.bed.filter((b) => !intensif.has(b.room_uuid));
  if (!hasil.length) throw new Error('Faskes belum punya bed rawat inap bangsal (jalankan npm run db:demo:seed)');
  return hasil;
}

// Pasien untuk episode: pasien demo yang belum pernah masuk unit intensif & tidak sedang dirawat; episode aktif selalu
// memakai pasien baru agar tidak bentrok dengan admisi lain yang sedang berjalan.
async function pemilihPasien(ctx) {
  const sibuk = new Set((await ctx.baris(`SELECT patient_uuid FROM rawat_inaps WHERE faskes_uuid = $1 AND deleted_at IS NULL AND status_ri <> 4
      UNION SELECT r.patient_uuid FROM icu_perawatans i JOIN rawat_inaps r ON r.uuid = i.rawat_inap_uuid WHERE i.faskes_uuid = $1 AND i.deleted_at IS NULL`,
  [ctx.faskes])).map((r) => r.patient_uuid));
  const calon = ctx.M.pasien.filter((p) => !sibuk.has(p.uuid));
  return (baru) => {
    if (!baru && calon.length) return calon.splice(Math.floor(ctx.acak() * calon.length), 1)[0];
    const p = ctx.pasien({ baru: true });
    sibuk.add(p.uuid);
    return p;
  };
}

// Admisi rawat inap induk episode intensif: masuk bangsal (riwayat_ruangan) → perpindahan approve ke bed intensif →
// (hidup) perpindahan approve kembali ke bangsal lalu pulang; (meninggal) pulang saat episode ditutup; (aktif) status 3.
function admisiIntensif(ctx, { unit, pasien, bangsal, bedBangsal, bedIntensif, masuk, keluar, meninggal, keluhan, dokter }) {
  const daftar = masuk - ctx.antara(2, 40) * JAM - ctx.antara(0, 59) * 60;
  const dirawat = daftar + ctx.antara(20, 90) * 60;
  const aktif = keluar == null;
  const pulang = aktif ? null : meninggal ? keluar : Math.min(keluar + ctx.antara(24, 120) * JAM, ctx.SEKARANG - JAM);
  const bedSesudah = aktif || meninggal ? null : ctx.pilih(bangsal);
  const statusPulang = aktif ? null : meninggal ? (pulang - dirawat < 48 * JAM ? 'exp-lt48h' : 'exp-gt48h') : ctx.peluang(0.92) ? 'home' : 'aadvice';
  const ri = ctx.tambah('rawat_inaps', {
    payment_method: ctx.peluang(0.6) ? 2 : 1, // Awalan per unit: penghitung ctx.kode dimulai ulang per seeder, jadi 'RIDM' saja bisa bentrok antarseeder.
    no_reg: ctx.kode(`RIDM${unit.toUpperCase()}`, daftar), patient_uuid: pasien.uuid, name: pasien.name, no_rm: pasien.no_rm,
    gender: pasien.gender, birth_detail_uuid: pasien.birth_detail_uuid ?? null, practitioner_uuid: dokter?.uuid ?? null,
    tanggal_daftar: daftar, tanggal_dirawat: dirawat, status_ri: aktif ? 3 : 4, encounter: ctx.berbobot({ IGD: 7, RJ: 2, RI: 1 }),
    monitoring_room_uuid: aktif || meninggal ? bedIntensif.uuid : bedSesudah.uuid, lokasi_uuid: bedBangsal.room_uuid,
    no_spri: `SPRI/DM/${unit.toUpperCase()}/${ctx.yymmdd(daftar)}/${ctx.pad(ctx.nomor(), 5)}`, complaint: keluhan,
    discharge_date: pulang, status_pulang: statusPulang,
    kondisi_pasien_pulang: aktif || meninggal ? null : ctx.pilih(['268910001', '268910001', '359746009']),
    status: true, created_at: daftar, updated_at: pulang ?? masuk,
  });
  ctx.tambah('riwayat_ruangan', { admission_uuid: ri.uuid, monitoring_ruangan_uuid: bedBangsal.uuid, status: true, created_at: dirawat, updated_at: masuk });
  const petugas = namaPencatat(ctx);
  const pindahMasuk = ctx.tambah('perpindahans', {
    petugas, admission_ri_uuid: ri.uuid, origin_monitoring_room_uuid: bedBangsal.uuid, destination_monitoring_room_uuid: bedIntensif.uuid,
    waktu_pindah: masuk, keterangan: 'Pindah ke ruang intensif sesuai kriteria masuk', status_pindah: 'approve', status: true,
    created_at: masuk - ctx.antara(10, 50) * 60, updated_at: masuk,
  });
  const pindahKeluar = bedSesudah ? ctx.tambah('perpindahans', {
    petugas, admission_ri_uuid: ri.uuid, origin_monitoring_room_uuid: bedIntensif.uuid, destination_monitoring_room_uuid: bedSesudah.uuid,
    waktu_pindah: keluar, keterangan: 'Kondisi stabil, pindah ke bangsal', status_pindah: 'approve', status: true,
    created_at: keluar - ctx.antara(10, 60) * 60, updated_at: keluar,
  }) : null;
  if (aktif) {
    // Bed intensif milik seeder ini (belum di-insert): ditandai terisi pasien episode aktif.
    bedIntensif.patient_uuid = pasien.uuid;
    bedIntensif.status_operasional = 'Penuh';
    bedIntensif.updated_at = masuk;
  }
  return { ri, pindahMasuk, pindahKeluar };
}

// Serah terima masuk/keluar terkonfirmasi.
function serahTerima(ctx, perawatan, perpindahanUuid, jenis, waktu, isi) {
  const pencatat = namaPencatat(ctx);
  return ctx.tambah('icu_serah_terimas', {
    perawatan_uuid: perawatan.uuid, perpindahan_uuid: perpindahanUuid, jenis, ...isi, pencatat,
    waktu_konfirmasi: waktu + ctx.antara(5, 30) * 60, dikonfirmasi_oleh: namaPencatat(ctx), created_at: waktu, updated_at: waktu,
  });
}

// Waktu observasi: interval 1–4 jam (lebih rapat di awal), maksimal 40 per episode, berhenti sebelum keluar/sekarang.
function waktuObservasi(ctx, masuk, keluar) {
  const akhir = (keluar ?? ctx.SEKARANG) - 10 * 60;
  const durasi = akhir - masuk;
  const dasar = Math.max(ctx.pilih([1, 2, 2, 3, 4]) * JAM, durasi / 40);
  const hasil = [];
  for (let t = masuk + ctx.antara(10, 40) * 60; t < akhir && hasil.length < 40; t += Math.round(dasar * (0.85 + ctx.acak() * 0.3))) {
    hasil.push(Math.min(t, akhir));
  }
  return hasil;
}

// Satu set tanda vital dari tingkat keparahan k (0 = stabil, 1 = sangat kritis) dan profil episode.
function tandaVital(ctx, k, profil = {}) {
  const sis = Math.round(batas(128 + (profil.hipertensi ? 25 : 0) - 48 * k + ctx.antara(-9, 9), 68, 210));
  const dia = Math.round(batas(sis * ctx.desimal(0.52, 0.64, 2), 38, 125));
  const nadi = Math.round(batas(80 + 42 * k + (profil.nadiTambah ?? 0) + ctx.antara(-8, 8), 38, 175));
  const suhu = batas(36.7 + (profil.demam ? 1.8 * k : 0.3 * k) + ctx.desimal(-0.4, 0.4), 35.4, 40.2);
  const rr = Math.round(batas(17 + 12 * k + ctx.antara(-2, 2), 10, 40));
  const spo2 = Math.round(batas(98 - 10 * k * (profil.paru ? 1.2 : 0.7) + ctx.desimal(-1.5, 1.5), 80, 100));
  return { tekanan_sistolik: sis, tekanan_diastolik: dia, nadi, suhu: Number(suhu.toFixed(1)), laju_napas: rr, spo2 };
}

// Intake-output per shift 8 jam (dicatat di akhir shift). Keparahan menurunkan diuresis.
function intakeOutput(ctx, perawatan, { masuk, keluar, kParah, ventilasi, bedah }) {
  const akhir = (keluar ?? ctx.SEKARANG) - 15 * 60;
  let n = 0;
  for (let t = masuk + 8 * JAM; t <= akhir + 2 * JAM && n < 30; t += 8 * JAM, n++) {
    const w = Math.min(t, akhir);
    const progres = (w - masuk) / Math.max(JAM, akhir - masuk);
    const k = kParah(progres);
    const catat = (jenis, kategori, ml, keterangan) => ctx.tambah('icu_intake_outputs', {
      perawatan_uuid: perawatan.uuid, waktu_pencatatan: w - ctx.antara(0, 20) * 60, jenis, kategori, jumlah_ml: ml,
      keterangan: keterangan ?? null, pencatat: namaPencatat(ctx), created_at: w, updated_at: w,
    });
    catat('intake', ctx.pilih(['Infus NaCl 0,9%', 'Infus Ringer Laktat', 'Infus Asering']), ctx.antara(4, 10) * 50);
    catat('intake', 'Obat/syringe pump', ctx.antara(4, 15) * 10);
    if (ventilasi || k > 0.6) catat('intake', 'Nutrisi enteral (NGT)', ctx.antara(3, 9) * 50);
    else catat('intake', 'Minum oral', ctx.antara(2, 8) * 50);
    if (ctx.peluang(0.15)) catat('intake', 'Transfusi PRC', ctx.pilih([175, 200, 250]), '1 kantong');
    catat('output', 'Urine (kateter)', Math.round(batas((850 - 650 * k) * ctx.desimal(0.7, 1.3), 30, 1600) / 10) * 10);
    if (ventilasi && ctx.peluang(0.4)) catat('output', 'Residu NGT', ctx.antara(1, 6) * 25);
    if (bedah) catat('output', 'Drain', ctx.antara(1, 12) * 10, ctx.pilih(['Serosanguinus', 'Serous', 'Hemoragis minimal']));
    if (ctx.peluang(0.08)) catat('output', 'Muntah', ctx.antara(1, 4) * 50);
  }
}

// ── Klinis ICU ───────────────────────────────────────────────────────────────────────────────────────────

// Diagnosis kerja ICU: jenis menentukan profil tanda vital, ventilasi, layanan (neuro), dan drain.
const DIAGNOSIS = [
  { teks: 'Syok sepsis ec pneumonia komunitas', berat: [0.55, 0.95], vent: 0.6, demam: true, paru: true, vaso: true },
  { teks: 'Gagal napas akut tipe 1 ec ARDS', berat: [0.6, 0.95], vent: 0.95, demam: true, paru: true },
  { teks: 'Pasca laparotomi eksplorasi a.i. peritonitis generalisata', berat: [0.35, 0.8], vent: 0.35, demam: true, bedah: true, vaso: true },
  { teks: 'PPOK eksaserbasi akut dengan gagal napas tipe 2', berat: [0.45, 0.85], vent: 0.5, paru: true },
  { teks: 'Ketoasidosis diabetik', berat: [0.35, 0.7], vent: 0.05, nadiTambah: 8 },
  { teks: 'Syok hipovolemik ec perdarahan saluran cerna atas', berat: [0.4, 0.85], vent: 0.15, nadiTambah: 10 },
  { teks: 'Eklampsia pasca seksio sesarea', berat: [0.3, 0.7], vent: 0.2, hipertensi: true, bedah: true },
  { teks: 'Dengue shock syndrome', berat: [0.4, 0.8], vent: 0.1, demam: true, vaso: true },
  { teks: 'Acute kidney injury dengan hiperkalemia', berat: [0.3, 0.7], vent: 0.05 },
  { teks: 'Pasca operasi reseksi tumor kolon (elektif)', berat: [0.15, 0.45], vent: 0.2, bedah: true },
  { teks: 'Stroke hemoragik dengan penurunan kesadaran', berat: [0.5, 0.95], vent: 0.55, hipertensi: true, neuro: true },
  { teks: 'Pasca kraniotomi evakuasi subdural hematoma', berat: [0.4, 0.85], vent: 0.6, neuro: true, bedah: true },
  { teks: 'Cedera otak berat ec kecelakaan lalu lintas', berat: [0.6, 0.98], vent: 0.8, neuro: true },
  { teks: 'Status epileptikus', berat: [0.4, 0.8], vent: 0.45, neuro: true },
];

// SOFA-1996 — salinan aturan rawat-inap-service/src/services/icu-service.js agar nilai tersimpan konsisten.
const sofa = (p) => {
  const respirasi = p.pao2_fio2 == null ? null : p.pao2_fio2 >= 400 ? 0 : p.pao2_fio2 >= 300 ? 1 : p.pao2_fio2 >= 200 ? 2
    : p.pao2_fio2 >= 100 ? (p.ventilator_dibantu ? 3 : 2) : p.ventilator_dibantu ? 4 : 2;
  const koagulasi = p.trombosit == null ? null : p.trombosit >= 150 ? 0 : p.trombosit >= 100 ? 1 : p.trombosit >= 50 ? 2 : p.trombosit >= 20 ? 3 : 4;
  const hepar = p.bilirubin == null ? null : p.bilirubin < 1.2 ? 0 : p.bilirubin < 2 ? 1 : p.bilirubin < 6 ? 2 : p.bilirubin < 12 ? 3 : 4;
  const kardiovaskular = p.vasopressor === 'norepinefrin' ? 4 : p.vasopressor === 'dopamin_tinggi' ? 3 : p.vasopressor === 'dopamin_rendah' ? 2
    : p.map == null ? null : p.map < 70 ? 1 : 0;
  const g = p.gcs_total;
  const saraf = g == null ? null : g === 15 ? 0 : g >= 13 ? 1 : g >= 10 ? 2 : g >= 6 ? 3 : 4;
  let ginjal = null;
  if (p.kreatinin != null) ginjal = p.kreatinin < 1.2 ? 0 : p.kreatinin < 2 ? 1 : p.kreatinin < 3.5 ? 2 : p.kreatinin < 5 ? 3 : 4;
  if (p.urine_output_ml_hari != null) {
    if (p.urine_output_ml_hari < 200) ginjal = Math.max(ginjal ?? 0, 4);
    else if (p.urine_output_ml_hari < 500) ginjal = Math.max(ginjal ?? 0, 3);
  }
  const skor = { respirasi, koagulasi, hepar, kardiovaskular, saraf_pusat: saraf, ginjal };
  const lengkap = Object.values(skor).every((v) => v !== null);
  return { skor, lengkap, total: lengkap ? Object.values(skor).reduce((a, v) => a + v, 0) : null };
};

// Template klinis ICU (ditetapkan) per layanan: elemen observasi tambahan + dokumen harian + aturan kelengkapan.
const TEMPLATE = {
  umum: {
    kode: 'asesmen_icu_umum', nama: 'Asesmen & Observasi ICU Umum',
    definisi: {
      observasi: [
        { kode_parameter: 'rass', label: 'Richmond Agitation-Sedation Scale', jenis: 'angka', minimum: -5, maksimum: 4, wajib: false },
        { kode_parameter: 'cvp', label: 'Central venous pressure', jenis: 'angka', satuan: 'cmH2O', minimum: 0, maksimum: 30, wajib: false },
      ],
      dokumen: [{
        kode_dokumen: 'asesmen_harian', nama: 'Asesmen Harian Intensivis', elemen: [
          { kode_parameter: 'masalah_utama', label: 'Masalah utama', jenis: 'teks', wajib: true, panjang_maksimum: 1000 },
          { kode_parameter: 'rencana', label: 'Rencana tata laksana', jenis: 'teks', wajib: true, panjang_maksimum: 2000 },
          { kode_parameter: 'risiko_dekubitus', label: 'Risiko dekubitus (Braden)', jenis: 'pilihan', pilihan: ['Rendah', 'Sedang', 'Tinggi'], wajib: false },
          { kode_parameter: 'bundle_vap', label: 'Bundle VAP terpenuhi', jenis: 'boolean', wajib: false },
        ],
      }],
    },
    aturan: [
      { sumber: 'observasi', parameter: ['rass'], cakupan: 'interval', interval_detik: 8 * JAM },
      { sumber: 'dokumentasi', kode_dokumen: 'asesmen_harian', parameter: ['masalah_utama', 'rencana'], cakupan: 'interval', interval_detik: HARI_DTK },
    ],
  },
  neuro: {
    kode: 'asesmen_neuro_icu', nama: 'Asesmen & Observasi Neuro ICU',
    definisi: {
      observasi: [
        { kode_parameter: 'pupil_kanan', label: 'Diameter pupil kanan', jenis: 'angka', satuan: 'mm', minimum: 1, maksimum: 9, wajib: false },
        { kode_parameter: 'pupil_kiri', label: 'Diameter pupil kiri', jenis: 'angka', satuan: 'mm', minimum: 1, maksimum: 9, wajib: false },
        { kode_parameter: 'refleks_cahaya', label: 'Refleks cahaya', jenis: 'pilihan', pilihan: ['Positif', 'Menurun', 'Negatif'], wajib: false },
      ],
      dokumen: [{
        kode_dokumen: 'asesmen_neuro', nama: 'Asesmen Neurologis Harian', elemen: [
          { kode_parameter: 'nihss', label: 'NIHSS', jenis: 'angka', minimum: 0, maksimum: 42, wajib: false },
          { kode_parameter: 'kekuatan_motorik', label: 'Kekuatan motorik', jenis: 'teks', wajib: true, panjang_maksimum: 200 },
          { kode_parameter: 'rencana', label: 'Rencana tata laksana', jenis: 'teks', wajib: true, panjang_maksimum: 2000 },
        ],
      }],
    },
    aturan: [
      { sumber: 'observasi', parameter: ['pupil_kanan', 'pupil_kiri'], cakupan: 'interval', interval_detik: 6 * JAM },
      { sumber: 'dokumentasi', kode_dokumen: 'asesmen_neuro', parameter: ['kekuatan_motorik', 'rencana'], cakupan: 'interval', interval_detik: HARI_DTK },
    ],
  },
};

// Konfigurasi layanan ICU (umum aktif; neuro aktif bila bed cukup), pemetaan bed, template ditetapkan, riwayat.
// Baris yang sudah ada (mis. diatur lewat aplikasi) dipakai ulang, tidak ditimpa.
async function siapkanKonfigurasi(ctx, ruang) {
  const t0 = ctx.hariLalu(ctx.HARI + 20);
  const admin = ctx.M.users.find((u) => /admin/.test(u.username))?.username ?? 'superadmin';
  const riwayat = (jenis, entitas, sesudah, alasan, waktu) => {
    const b = ctx.tambah('icu_konfigurasi_riwayats', { jenis_entitas: jenis, entitas_uuid: entitas, nilai_sebelum: null, nilai_sesudah: sesudah,
      alasan, pelaku: admin, created_at: waktu });
    delete b.updated_at; // tabel riwayat hanya punya created_at
  };
  const pakaiNeuro = ruang.baru && ruang.beds.length >= 5;
  const hasil = { layanan: {}, template: {}, bedLayanan: new Map() };
  const adaLayanan = await ctx.baris(`SELECT uuid, kode, aktif FROM icu_layanans WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [ctx.faskes]);
  for (const [kode, nama] of [['umum', 'ICU Umum'], ['neuro', 'Neuro ICU'], ['burn', 'Burn ICU']]) {
    const lama = adaLayanan.find((l) => l.kode === kode);
    if (lama) { hasil.layanan[kode] = { ...lama, lama: true }; continue; }
    const aktif = kode === 'umum' || (kode === 'neuro' && pakaiNeuro);
    const l = ctx.tambah('icu_layanans', { kode, nama, aktif, revisi: aktif && kode !== 'umum' ? 2 : 1, dibuat_oleh: admin,
      diubah_oleh: aktif && kode !== 'umum' ? admin : null, created_at: t0, updated_at: t0 + 2 * HARI_DTK });
    hasil.layanan[kode] = l;
    if (aktif && kode !== 'umum') riwayat('icu_layanans', l.uuid, { kode, aktif: true }, 'Aktivasi layanan Neuro ICU setelah bed, akses, dan template siap', t0 + 2 * HARI_DTK);
  }
  // Template ditetapkan untuk layanan aktif (bila belum ada versi ditetapkan berkode sama).
  for (const kode of ['umum', 'neuro']) {
    const l = hasil.layanan[kode];
    if (!l?.aktif) continue;
    const T = TEMPLATE[kode];
    const lama = await ctx.satu(`SELECT uuid FROM icu_template_versis WHERE faskes_uuid = $1 AND layanan_uuid = $2 AND kode_template = $3
      AND status = 'ditetapkan' AND deleted_at IS NULL ORDER BY nomor_versi DESC LIMIT 1`, [ctx.faskes, l.uuid, T.kode]);
    if (lama) { hasil.template[kode] = { uuid: lama.uuid, ...T }; continue; }
    if (l.lama) continue; // nomor versi bisa bentrok dengan versi yang dibuat lewat aplikasi; lewati.
    const v = ctx.tambah('icu_template_versis', { layanan_uuid: l.uuid, kode_template: T.kode, nomor_versi: 1, nama: T.nama, status: 'ditetapkan',
      definisi: T.definisi, aturan_kelengkapan: T.aturan, revisi: 2, ditetapkan_oleh: namaDokterUser(ctx), waktu_penetapan: t0 + HARI_DTK,
      dibuat_oleh: admin, diubah_oleh: admin, created_at: t0 + 3600, updated_at: t0 + HARI_DTK });
    hasil.template[kode] = { uuid: v.uuid, ...T };
    riwayat('icu_template_versis', v.uuid, { kode_template: T.kode, nomor_versi: 1, status: 'ditetapkan' }, 'Penetapan template klinis oleh komite medik', t0 + HARI_DTK);
  }
  // Pemetaan bed kamar ICU baru: 2 bed terakhir untuk Neuro ICU (bila aktif), sisanya ICU Umum. Berlaku sejak sebelum periode data.
  if (ruang.baru && hasil.layanan.umum && !hasil.layanan.umum.lama) {
    ruang.beds.forEach((bed, i) => {
      const kode = pakaiNeuro && i >= ruang.beds.length - 2 ? 'neuro' : 'umum';
      const lb = ctx.tambah('icu_layanan_beds', { layanan_uuid: hasil.layanan[kode].uuid, room_monitoring_uuid: bed.uuid, ruangan_uuid: ruang.uuid,
        berlaku_mulai: t0 + 2 * HARI_DTK, berlaku_sampai: null, revisi: 1, dibuat_oleh: admin, created_at: t0 + 2 * HARI_DTK });
      hasil.bedLayanan.set(bed.uuid, kode);
      riwayat('icu_layanan_beds', lb.uuid, { room_monitoring_uuid: bed.uuid, layanan_kode: kode }, `Penempatan bed ${bed.no_bed} ke layanan ${kode === 'neuro' ? 'Neuro ICU' : 'ICU Umum'}`, t0 + 2 * HARI_DTK);
    });
  }
  // Nilai kritis faskes (dukungan keputusan pada dasbor intensif; berlaku untuk semua unit intensif faskes).
  const nkAda = new Set((await ctx.baris(`SELECT parameter FROM icu_nilai_kritis WHERE faskes_uuid = $1 AND ruangan_uuid IS NULL AND deleted_at IS NULL`, [ctx.faskes])).map((r) => r.parameter));
  for (const [parameter, satuan, bawah, atas, ket] of [
    ['tekanan_sistolik', 'mmHg', 90, 180, 'Hipotensi/hipertensi berat'], ['tekanan_diastolik', 'mmHg', 40, 110, 'Krisis hipertensi bila > 110'],
    ['nadi', 'x/menit', 50, 130, 'Bradikardia/takikardia bermakna'], ['suhu', '°C', 35.5, 39.0, 'Hipotermia/hiperpireksia'],
    ['spo2', '%', 90, null, 'Desaturasi'],
  ]) {
    if (nkAda.has(parameter)) continue;
    ctx.tambah('icu_nilai_kritis', { parameter, satuan, batas_bawah: bawah, batas_atas: atas, ruangan_uuid: null, keterangan: ket, status: true,
      dibuat_oleh: admin, created_at: t0, updated_at: t0 });
  }
  return hasil;
}

async function seed(ctx) {
  const [jumlah, aktif, jumlahBed] = JUMLAH[ctx.F.segmen] ?? [6, 1, 2];
  if (!ctx.M.bed.length) throw new Error('Faskes belum punya bed rawat inap (jalankan npm run db:demo:seed)');
  const ruang = await siapkanRuang(ctx, { kode: 'ICU', nama: 'Ruang ICU', jumlahBed, harga: 1250000 });
  const konf = await siapkanKonfigurasi(ctx, ruang);
  const ambilPasien = await pemilihPasien(ctx);
  const bedBebas = ruang.beds.filter((b) => !b.patient_uuid);
  const adaNeuro = [...konf.bedLayanan.values()].includes('neuro');
  const bangsal = await bedBangsal(ctx);
  // LOS ICU 1–9 hari (condong 2–5 hari).
  const lamaAcak = () => Math.round((ctx.berbobot({ 1: 3, 2: 5, 3: 5, 4: 4, 5: 3, 6: 2, 7: 1, 9: 1 }) * 24 + ctx.antara(-8, 8)) * JAM);
  const jadwal = jadwalEpisode(ctx, bedBebas, jumlah, ruang.baru ? aktif : 0, lamaAcak, 3.8 * HARI_DTK);

  const hitung = { episode: 0, aktif: 0, meninggal: 0, observasi: 0, sofa: 0, dokumen: 0 };
  for (const j of jadwal) {
    const layanan = konf.bedLayanan.get(j.bed.uuid) ?? 'umum';
    // Bila ada bed Neuro ICU, kasus neurologis hanya ditempatkan di sana; tanpa Neuro ICU semua kasus ke ICU Umum.
    const dx = ctx.pilih(adaNeuro ? DIAGNOSIS.filter((d) => (layanan === 'neuro') === !!d.neuro) : DIAGNOSIS);
    const berat = ctx.desimal(dx.berat[0], dx.berat[1], 2);
    const selesai = j.keluar != null;
    const meninggal = selesai && ctx.peluang(berat > 0.8 ? 0.5 : berat > 0.6 ? 0.25 : 0.05);
    // Keparahan sepanjang episode: membaik bagi yang hidup, memburuk bagi yang meninggal; episode aktif membaik pelan.
    const kParah = (p) => batas(meninggal ? berat * (0.75 + 0.45 * p) : berat * (1 - (selesai ? 0.8 : 0.4) * p), 0.03, 1);
    const ventilasi = ctx.peluang(dx.vent);
    const ventSampai = meninggal ? 1.01 : ctx.desimal(0.35, 0.75, 2); // fraksi episode dengan ventilator (weaning lalu ekstubasi)
    const pasien = ambilPasien(!selesai);
    const dokter = ctx.pilihDokter();
    const { ri, pindahMasuk, pindahKeluar } = admisiIntensif(ctx, {
      unit: 'icu', pasien, bangsal, bedBangsal: ctx.pilih(bangsal), bedIntensif: j.bed, masuk: j.mulai, keluar: j.keluar, meninggal, dokter,
      keluhan: dx.neuro ? 'Penurunan kesadaran' : dx.paru ? 'Sesak napas berat' : dx.bedah ? 'Rencana operasi' : 'Lemas, tampak syok',
    });
    const template = konf.template[layanan] ?? null;
    const perawatan = ctx.tambah('icu_perawatans', {
      unit: 'icu', rawat_inap_uuid: ri.uuid, perpindahan_masuk_uuid: pindahMasuk.uuid, perpindahan_keluar_uuid: pindahKeluar?.uuid ?? null,
      room_monitoring_uuid: j.bed.uuid, ruangan_uuid: ruang.uuid, diagnosis_ringkas: dx.teks, status: selesai ? 'selesai' : 'aktif',
      kondisi_keluar: selesai ? (meninggal ? 'meninggal' : 'hidup') : null, waktu_masuk: j.mulai, waktu_keluar: j.keluar,
      layanan_kode: konf.layanan[layanan] ? layanan : null, template_versi_uuid: template?.uuid ?? null,
      dibuat_oleh: namaPencatat(ctx), created_at: j.mulai, updated_at: j.keluar ?? j.mulai,
    });
    hitung.episode++;
    if (!selesai) hitung.aktif++;
    if (meninggal) hitung.meninggal++;

    serahTerima(ctx, perawatan, pindahMasuk.uuid, 'masuk', j.mulai, {
      kriteria: ventilasi ? 'Gagal napas membutuhkan ventilasi mekanik' : berat > 0.6 ? 'Hemodinamik tidak stabil, butuh vasopresor/pemantauan ketat' : 'Pemantauan ketat pascaoperasi/pascatindakan',
      kondisi: `GCS ${dx.neuro ? ctx.antara(5, 10) : ctx.antara(9, 15)}, TD ${ctx.antara(80, 140)}/${ctx.antara(45, 85)} mmHg, SpO2 ${ctx.antara(86, 97)}%`,
      tindakan: ctx.pilih(['Pemasangan CVC vena subklavia', 'Intubasi ETT no. 7,5 di IGD', 'Resusitasi cairan 30 mL/kg', 'Kateter urine terpasang']),
      terapi_berjalan: ctx.pilih(['Meropenem 3x1 g IV', 'Ceftriaxone 2x2 g IV', 'Insulin drip sesuai protokol', 'Manitol 4x125 mL', 'Omeprazol 2x40 mg IV']),
      alergi_relevan: ctx.peluang(0.15) ? ctx.pilih(['Alergi penisilin', 'Alergi sulfa']) : 'Tidak ada alergi yang diketahui',
      akses_alat: ['IV line', ventilasi ? 'ETT' : null, ctx.peluang(0.6) ? 'CVC' : null, 'Kateter urine', dx.bedah ? 'Drain abdomen' : null].filter(Boolean).join(', '),
      tindak_lanjut: 'Observasi tiap jam, evaluasi analisa gas darah & laboratorium 6 jam',
    });

    // Flowsheet observasi.
    const waktuObs = waktuObservasi(ctx, j.mulai, j.keluar);
    const akhir = (j.keluar ?? ctx.SEKARANG);
    const obsList = [];
    for (const w of waktuObs) {
      const p = (w - j.mulai) / Math.max(JAM, akhir - j.mulai);
      const k = kParah(p);
      const vent = ventilasi && p < ventSampai;
      const vital = tandaVital(ctx, k, dx);
      const sedasi = vent && k > 0.45;
      const gE = sedasi ? ctx.antara(1, 2) : dx.neuro ? Math.round(batas(4 - 3 * k + ctx.antara(-1, 0), 1, 4)) : Math.round(batas(4 - 1.5 * k, 2, 4));
      const gV = vent ? 1 : dx.neuro ? Math.round(batas(5 - 4 * k, 1, 5)) : Math.round(batas(5 - 2 * k, 2, 5));
      const gM = sedasi ? ctx.antara(4, 5) : dx.neuro ? Math.round(batas(6 - 3 * k + ctx.antara(-1, 0), 2, 6)) : Math.round(batas(6 - k, 4, 6));
      const drip = [];
      if (dx.vaso && k > 0.45) drip.push({ nama: 'Norepinefrin', laju: String(ctx.desimal(0.05, 0.1 + 0.3 * k, 2)), satuan: 'mcg/kg/menit' });
      if (sedasi) drip.push({ nama: 'Midazolam', laju: String(ctx.antara(1, 5)), satuan: 'mg/jam' }, { nama: 'Fentanil', laju: String(ctx.pilih([25, 50, 75])), satuan: 'mcg/jam' });
      if (dx.teks.startsWith('Ketoasidosis')) drip.push({ nama: 'Insulin reguler', laju: String(ctx.desimal(2, 6, 1)), satuan: 'unit/jam' });
      if (dx.hipertensi && vital.tekanan_sistolik > 160) drip.push({ nama: 'Nikardipin', laju: String(ctx.desimal(2.5, 10, 1)), satuan: 'mg/jam' });
      const tambahan = [];
      if (template && ctx.peluang(0.9)) {
        if (layanan === 'neuro') {
          const pupil = Number((2.5 + 2.5 * k + ctx.desimal(-0.5, 0.5)).toFixed(1));
          tambahan.push({ kode_parameter: 'pupil_kanan', nilai: batas(pupil, 1, 9) }, { kode_parameter: 'pupil_kiri', nilai: batas(Number((pupil + (k > 0.7 ? ctx.desimal(0, 2) : ctx.desimal(-0.3, 0.3))).toFixed(1)), 1, 9) },
            { kode_parameter: 'refleks_cahaya', nilai: k > 0.8 ? 'Negatif' : k > 0.5 ? 'Menurun' : 'Positif' });
        } else {
          tambahan.push({ kode_parameter: 'rass', nilai: sedasi ? ctx.antara(-4, -2) : ctx.antara(-1, 1) });
          if (ctx.peluang(0.5)) tambahan.push({ kode_parameter: 'cvp', nilai: ctx.antara(4, 14) });
        }
      }
      const o = ctx.tambah('icu_observasis', {
        perawatan_uuid: perawatan.uuid, waktu_pengukuran: w, ...vital,
        laju_napas: vent ? null : vital.laju_napas, gcs_e: gE, gcs_v: gV, gcs_m: gM, gcs_total: gE + gV + gM,
        skala_nyeri: sedasi ? null : ctx.antara(0, k > 0.5 ? 6 : 4),
        ventilator_terpasang: vent, ventilator_mode: vent ? (k > 0.5 ? ctx.pilih(['SIMV', 'AC/VC', 'PC']) : ctx.pilih(['PSIMV', 'CPAP/PS'])) : null,
        ventilator_fio2: vent ? Math.round(batas(30 + 60 * k + ctx.antara(-5, 5), 30, 100)) : null,
        ventilator_peep: vent ? Math.round(batas(5 + 7 * k, 5, 14)) : null, ventilator_tidal_volume: vent ? ctx.antara(38, 52) * 10 : null,
        ventilator_laju_napas: vent ? ctx.antara(12, 20) : null, obat_drip: drip, sumber: 'manual',
        catatan: ctx.peluang(0.12) ? ctx.pilih(['Suction ETT, sekret mukopurulen', 'Mobilisasi miring kanan-kiri', 'Lapor DPJP, advis titrasi vasopresor', 'Pasien tampak gelisah, re-orientasi', 'Balans cairan dievaluasi']) : null,
        pencatat: namaPencatat(ctx), dikoreksi: false, revisi: 1, template_versi_uuid: template?.uuid ?? null, parameter_tambahan: tambahan,
        created_at: w + ctx.antara(1, 15) * 60,
      });
      obsList.push(o);
    }
    hitung.observasi += obsList.length;
    // Koreksi berjejak (±4%): salah ketik nadi/suhu diperbaiki, nilai lama tersimpan di icu_observasi_koreksis.
    for (const o of obsList) {
      if (!ctx.peluang(0.04)) continue;
      const kolom = ctx.pilih(['nadi', 'suhu']);
      const salah = kolom === 'nadi' ? o.nadi + ctx.pilih([-10, 10, 100]) : Number((o.suhu + ctx.pilih([-1, 1])).toFixed(1));
      const waktuKoreksi = o.created_at + ctx.antara(10, 90) * 60;
      o.dikoreksi = true;
      o.revisi = 2;
      o.updated_at = waktuKoreksi;
      const kr = ctx.tambah('icu_observasi_koreksis', { observasi_uuid: o.uuid, nilai_sebelum: { [kolom]: salah }, nilai_sesudah: { [kolom]: o[kolom] },
        alasan: 'Salah input, disesuaikan dengan monitor', pelaku: o.pencatat, created_at: waktuKoreksi });
      delete kr.updated_at;
    }

    intakeOutput(ctx, perawatan, { masuk: j.mulai, keluar: j.keluar, kParah, ventilasi, bedah: dx.bedah });

    // Skor SOFA saat masuk lalu harian.
    for (let t = j.mulai + ctx.antara(1, 4) * JAM, ke = 0; t < akhir - 30 * 60 && ke < 10; t += HARI_DTK, ke++) {
      const p = (t - j.mulai) / Math.max(JAM, akhir - j.mulai);
      const k = kParah(p);
      const vent = ventilasi && p < ventSampai;
      const vital = tandaVital(ctx, k, dx);
      const obsDekat = obsList.reduce((a, o) => (Math.abs(o.waktu_pengukuran - t) < Math.abs((a?.waktu_pengukuran ?? 0) - t) ? o : a), null);
      const param = {
        waktu_penilaian: t,
        pao2_fio2: Math.round(batas(430 - 330 * k * (dx.paru ? 1.1 : 0.7) + ctx.antara(-25, 25), 60, 520)),
        ventilator_dibantu: vent,
        trombosit: Math.round(batas(260 - 210 * k * (dx.teks.startsWith('Dengue') ? 1.3 : 0.8) + ctx.antara(-25, 25), 8, 450)),
        bilirubin: ctx.peluang(0.12) ? null : Number(batas(0.5 + 4 * k * k + ctx.desimal(-0.2, 0.4), 0.2, 15).toFixed(1)),
        map: Math.round((vital.tekanan_sistolik + 2 * vital.tekanan_diastolik) / 3),
        vasopressor: dx.vaso && k > 0.45 ? 'norepinefrin' : k > 0.55 && ctx.peluang(0.3) ? 'dopamin_rendah' : 'tidak_ada',
        gcs_total: obsDekat?.gcs_total ?? 15,
        kreatinin: Number(batas(0.7 + 3.2 * k * k + ctx.desimal(-0.15, 0.3), 0.4, 9).toFixed(2)),
        urine_output_ml_hari: Math.round(batas(2200 - 1900 * k + ctx.antara(-150, 150), 80, 3500)),
      };
      if (ke === 0) param.catatan = 'Penilaian saat masuk ICU';
      const s = sofa(param);
      ctx.tambah('icu_skor_sofas', {
        perawatan_uuid: perawatan.uuid, waktu_penilaian: t, respirasi_skor: s.skor.respirasi, koagulasi_skor: s.skor.koagulasi,
        hepar_skor: s.skor.hepar, kardiovaskular_skor: s.skor.kardiovaskular, saraf_pusat_skor: s.skor.saraf_pusat, ginjal_skor: s.skor.ginjal,
        parameter: param, total_skor: s.total, lengkap: s.lengkap, versi_rumus: 'sofa-1996', penilai: namaDokterUser(ctx),
        catatan: param.catatan ?? (s.lengkap ? null : 'Bilirubin belum tersedia'), created_at: t + ctx.antara(5, 40) * 60,
      });
      hitung.sofa++;
    }

    // Dokumentasi klinis harian sesuai template episode (sesekali terlewat → kelengkapan "belum lengkap").
    if (template) {
      const dok = template.definisi.dokumen[0];
      for (let t = j.mulai + ctx.antara(2, 6) * JAM; t < akhir - 30 * 60; t += HARI_DTK) {
        if (ctx.peluang(0.1)) continue;
        const p = (t - j.mulai) / Math.max(JAM, akhir - j.mulai);
        const k = kParah(p);
        const nilai = layanan === 'neuro' ? [
          { kode_parameter: 'nihss', nilai: Math.round(batas(6 + 26 * k + ctx.antara(-2, 2), 0, 42)) },
          { kode_parameter: 'kekuatan_motorik', nilai: k > 0.6 ? 'Hemiparese dekstra 1/5' : k > 0.35 ? 'Hemiparese dekstra 3/5' : 'Kekuatan 4/5 keempat ekstremitas' },
          { kode_parameter: 'rencana', nilai: k > 0.6 ? 'Head up 30°, target MAP 80–100, evaluasi CT scan ulang' : 'Lanjut neuroproteksi, mulai fisioterapi pasif, rencana pindah bangsal' },
        ] : [
          { kode_parameter: 'masalah_utama', nilai: `${dx.teks}${k > 0.6 ? ', hemodinamik belum stabil' : k > 0.3 ? ', perbaikan klinis' : ', stabil'}` },
          { kode_parameter: 'rencana', nilai: k > 0.6 ? 'Titrasi vasopresor target MAP ≥ 65, kultur darah, evaluasi AGD tiap 6 jam' : k > 0.3 ? 'Weaning ventilator/oksigen, lanjut antibiotik, nutrisi enteral bertahap' : 'Rencana pindah bangsal, mobilisasi bertahap' },
          { kode_parameter: 'risiko_dekubitus', nilai: k > 0.6 ? 'Tinggi' : k > 0.3 ? 'Sedang' : 'Rendah' },
          { kode_parameter: 'bundle_vap', nilai: ventilasi ? ctx.peluang(0.85) : null },
        ];
        const d = ctx.tambah('icu_dokumentasis', { perawatan_uuid: perawatan.uuid, template_versi_uuid: template.uuid, kode_dokumen: dok.kode_dokumen,
          waktu_pencatatan: t, nilai, revisi: 1, pencatat: namaDokterUser(ctx), created_at: t + ctx.antara(5, 30) * 60 });
        hitung.dokumen++;
        if (ctx.peluang(0.05)) {
          const baru = nilai.map((n) => (n.kode_parameter === 'rencana' ? { ...n, nilai: `${n.nilai}; konsul gizi klinik` } : n));
          const waktuKoreksi = d.created_at + ctx.antara(30, 240) * 60;
          const kr = ctx.tambah('icu_dokumentasi_koreksis', { dokumentasi_uuid: d.uuid, nilai_sebelum: nilai, nilai_sesudah: baru,
            alasan: 'Melengkapi rencana tata laksana', pelaku: d.pencatat, created_at: waktuKoreksi });
          delete kr.updated_at;
          d.nilai = baru;
          d.revisi = 2;
          d.updated_at = waktuKoreksi;
        }
      }
    }

    // Serah terima keluar tertaut perpindahan keluar ke bangsal; pasien meninggal tidak punya perpindahan keluar.
    if (pindahKeluar) {
      serahTerima(ctx, perawatan, pindahKeluar.uuid, 'keluar', j.keluar, {
        kriteria: 'Memenuhi kriteria keluar ICU: hemodinamik stabil tanpa vasopresor, napas spontan adekuat',
        kondisi: `Sadar, TD ${ctx.antara(105, 135)}/${ctx.antara(65, 85)} mmHg, nadi ${ctx.antara(70, 95)} x/menit, SpO2 ${ctx.antara(95, 99)}% nasal kanul`,
        terapi_berjalan: ctx.pilih(['Lanjut antibiotik IV hari ke-5', 'Insulin subkutan basal-bolus', 'Diet lunak 1800 kkal']),
        akses_alat: 'IV line perifer',
        tindak_lanjut: 'Observasi tanda vital tiap 4 jam di bangsal, kontrol laboratorium besok pagi',
      });
    }
  }
  return `${ruang.beds.length} bed ICU, ${hitung.episode} episode (${hitung.aktif} aktif, ${hitung.meninggal} meninggal), ${hitung.observasi} observasi, ${hitung.sofa} SOFA, ${hitung.dokumen} dokumentasi`;
}

// Bed milik seeder dihapus kerangka (jejak); tidak ada baris lain yang diubah lewat ubahSetelah.
module.exports = {
  kode: 'icu', nama: 'ICU / Intensif', tahap: 1, modul: ['icu'], seed,
  bantu: { JAM, HARI_DTK, batas, namaPencatat, namaDokterUser, siapkanRuang, jadwalEpisode, pemilihPasien, bedBangsal, admisiIntensif, serahTerima, waktuObservasi, tandaVital, intakeOutput },
};
