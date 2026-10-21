'use strict';

// Transaksi demo NICU. Membuat Ruang NICU (inkubator + bed transisi) dan Ruang Perinatologi baru (lokasi, ruangan,
// room_monitorings, tarif) sehingga kamar/bed yang ada tidak diubah, lalu nicu_tempat (jenis & status alat), konfigurasi
// formulir terbit + satu draf (nicu_konfigurasi_versi), dan episode 60 hari terakhir: bayi baru lahir fiktif (patients
// is_new_born + birth_details + registrasi new_borns), admisi rawat inap dari perinatologi, perpindahan (perpindahans,
// riwayat_ruangan), episode (nicu_episode), riwayat penempatan (nicu_penempatan), dokumentasi neonatal/observasi/keperawatan
// (nicu_dokumen) dan koreksinya (nicu_dokumen_revisi).
// Alur: perinatologi → perpindahan approve → episode aktif (penempatan inkubator) → [pindah ke bed transisi] → selesai lewat
// transfer ke perinatologi (perpindahan_keluar) atau pulang (rawat inap status 4). Beberapa episode tetap aktif dan satu bayi
// menunggu penerimaan NICU (perpindahan sudah approve, belum ada episode).
const { buatRuang, petugas, lain, pad2 } = require('./hdu.cjs');

const JAM = 3600;
const HARI = 86400;
const MENIT = 60;
const JUMLAH = { rs_a: 25, rs_b: 15, rs_c: 10, rs_d: 5 };
const TEMPAT = { rs_a: 8, rs_b: 6, rs_c: 5, rs_d: 4 }; // dua tempat terakhir = bed transisi (step-down)
const AKTIF = { rs_a: 3, rs_b: 2, rs_c: 1, rs_d: 1 };
const CALON = { rs_a: 1, rs_b: 1 };
// Berat lahir rata-rata (gram) per usia gestasi (minggu).
const BERAT = { 26: 850, 27: 950, 28: 1100, 29: 1250, 30: 1400, 31: 1550, 32: 1700, 33: 1950, 34: 2150, 35: 2400, 36: 2650, 37: 2900, 38: 3100, 39: 3250, 40: 3400 };

const f = (kode, nama, tipe, satuan, wajib) => ({ kode, nama, tipe, satuan, wajib });
const DEFINISI = {
  neonatal: [f('berat_badan', 'Berat badan', 'angka', 'gram', true), f('panjang_badan', 'Panjang badan', 'angka', 'cm', false),
    f('lingkar_kepala', 'Lingkar kepala', 'angka', 'cm', false), f('usia_gestasi', 'Usia gestasi', 'angka', 'minggu', true),
    f('apgar_menit_1', 'APGAR menit ke-1', 'angka', '', false), f('apgar_menit_5', 'APGAR menit ke-5', 'angka', '', false),
    f('cara_lahir', 'Cara lahir', 'teks', '', false), f('catatan', 'Catatan', 'teks', '', false)],
  observasi: [f('suhu', 'Suhu aksila', 'angka', '°C', true), f('frekuensi_jantung', 'Frekuensi jantung', 'angka', 'x/menit', true),
    f('frekuensi_napas', 'Frekuensi napas', 'angka', 'x/menit', true), f('spo2', 'Saturasi oksigen', 'angka', '%', true),
    f('fio2', 'FiO2', 'angka', '%', false), f('bantuan_napas', 'Bantuan napas', 'teks', '', false),
    f('skor_downes', 'Skor Downes', 'angka', '', false), f('gula_darah', 'Gula darah', 'angka', 'mg/dL', false), f('catatan', 'Catatan', 'teks', '', false)],
  keperawatan: [f('diagnosa', 'Diagnosis keperawatan', 'teks', '', true), f('intervensi', 'Intervensi', 'teks', '', true), f('evaluasi', 'Evaluasi', 'teks', '', false)],
  perkembangan: [f('refleks_hisap', 'Refleks hisap', 'teks', '', true), f('tonus_otot', 'Tonus otot', 'teks', '', false),
    f('interaksi', 'Interaksi dengan orang tua', 'teks', '', false)],
};
const KASUS_CUKUP_BULAN = [
  ['Asfiksia neonatorum sedang', 'Resusitasi VTP 60 detik di kamar bersalin, kini napas spontan dengan nasal kanul.'],
  ['Sepsis neonatorum awitan dini', 'Ampisilin 50 mg/kgBB/12 jam dan gentamisin 4 mg/kgBB/24 jam IV, kultur darah terkirim.'],
  ['Hiperbilirubinemia berat (TSB 21 mg/dL)', 'Fototerapi intensif ganda, hidrasi adekuat, evaluasi bilirubin tiap 6 jam.'],
  ['Transient tachypnea of the newborn', 'Oksigen nasal kanul 1 lpm, puasa sementara, cairan D10% sesuai kebutuhan.'],
  ['Hipoglikemia pada bayi dari ibu diabetes', 'Bolus D10% 2 mL/kgBB lalu infus GIR 6 mg/kg/menit, cek gula darah tiap 1–3 jam.'],
  ['Sindrom aspirasi mekonium', 'CPAP PEEP 6 cmH2O, antibiotik empiris, pemantauan ketat gawat napas.'],
];
const KEPERAWATAN = [
  ['Pola napas tidak efektif', 'Atur posisi ekstensi ringan, pantau retraksi dan SpO2, kelola CPAP sesuai instruksi.', 'Retraksi berkurang, SpO2 dalam target.'],
  ['Risiko hipotermia', 'Pertahankan suhu inkubator netral, minimalkan paparan, metode kanguru saat stabil.', 'Suhu aksila 36,6–37,2 °C.'],
  ['Risiko infeksi', 'Cuci tangan 5 momen, perawatan tali pusat kering, perawatan akses vaskular aseptik.', 'Tidak ada tanda infeksi baru.'],
  ['Defisit nutrisi', 'Minum ASI perah bertahap per OGT, pantau residu lambung dan toleransi minum.', 'Toleransi minum baik, residu minimal.'],
  ['Ikterus neonatus', 'Fototerapi dengan pelindung mata, ubah posisi tiap 3 jam, pantau hidrasi.', 'Kulit tampak kuning berkurang.'],
];

// Usia (tahun, bulan, hari) pada saat tertentu, kalender WIB.
const usia = (lahir, pada) => {
  const a = new Date((lahir + 7 * JAM) * 1000);
  const b = new Date((pada + 7 * JAM) * 1000);
  let y = b.getUTCFullYear() - a.getUTCFullYear();
  let m = b.getUTCMonth() - a.getUTCMonth();
  let d = b.getUTCDate() - a.getUTCDate();
  if (d < 0) { m -= 1; d += new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), 0)).getUTCDate(); }
  if (m < 0) { y -= 1; m += 12; }
  return { age_year: y, age_month: m, age_day: d };
};
const jamWib = (t) => { const d = new Date((t + 7 * JAM) * 1000); return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`; };
const bulat = (x, d = 0) => Number(x.toFixed(d));

module.exports = {
  kode: 'nicu',
  nama: 'NICU',
  tahap: 1,
  modul: ['nicu'],
  seed: async (ctx) => {
    const { M, SEKARANG, antara, pilih, peluang, desimal, berbobot } = ctx;
    const seg = M.faskes.segmen;
    if (!JUMLAH[seg]) return `tidak diisi: NICU hanya untuk rumah sakit (segmen ${seg})`;
    const N = JUMLAH[seg];
    const nTempat = TEMPAT[seg] ?? 4;
    const nAktif = AKTIF[seg] ?? 1;
    const nCalon = CALON[seg] ?? 0;
    if (!M.users.length) throw new Error('User demo belum ada (jalankan npm run db:demo:seed)');
    const perawat = petugas(M, /perawat/);
    const dokter = petugas(M, /\.dr\./);
    const admin = petugas(M, /admin/)[0] ?? M.users[0];
    const awal = SEKARANG - (ctx.HARI + 14) * HARI;

    const nicu = await buatRuang(ctx, { akhiran: 'NICU', nama: 'Ruang NICU', kelas: 'Kelas 1', jumlah: nTempat, harga: 1500000, dibuat: awal });
    const peri = await buatRuang(ctx, { akhiran: 'PERI', nama: 'Ruang Perinatologi', kelas: 'Kelas 2', urutan: 1, jumlah: 6, harga: 450000, dibuat: awal });
    const nUtama = Math.max(nTempat - 2, 1);
    // Tempat utama = inkubator; dua terakhir bed transisi. Satu inkubator sedang dibersihkan, satu bed transisi dipelihara.
    const tempat = nicu.beds.map((bed, i) => {
      const status = i === nUtama - 1 && nUtama > nAktif + nCalon ? 'pembersihan' : i === nTempat - 1 && nTempat > nUtama ? 'pemeliharaan' : 'siap';
      const diubah = status === 'siap' ? null : SEKARANG - antara(2, 20) * JAM;
      return ctx.tambah('nicu_tempat', { unit_uuid: nicu.kamar.uuid, room_monitoring_uuid: bed.uuid, jenis: i < nUtama ? 'inkubator' : 'bed',
        status_alat: status, versi: diubah ? 2 : 1, pencatat: admin.uuid, created_at: awal + JAM, updated_at: diubah ?? awal + JAM });
    });

    // Konfigurasi formulir: tiga jenis terbit (versi 2 setelah penerbitan) + satu draf.
    const konf = {};
    for (const [jenis, draf] of [['neonatal', false], ['observasi', false], ['keperawatan', false], ['perkembangan', true]]) {
      const dibuat = draf ? SEKARANG - antara(3, 10) * HARI : awal + 2 * JAM;
      const terbit = draf ? null : dibuat + antara(1, 3) * HARI;
      konf[jenis] = ctx.tambah('nicu_konfigurasi_versi', { unit_uuid: nicu.kamar.uuid, jenis, definisi: { fields: DEFINISI[jenis] },
        status: draf ? 'draf' : 'terbit', referensi_pengesahan: draf ? null : `SK Direktur No. ${pad2(antara(10, 99))}/SK-DIR/NICU/2026 (Demo)`,
        diterbitkan_oleh: draf ? null : pilih(dokter).uuid, diterbitkan_at: terbit, versi: draf ? 1 : 2, pencatat: admin.uuid,
        created_at: dibuat, updated_at: terbit ?? dibuat });
    }

    const perBed = Math.ceil(N / nUtama);
    const mulaiJendela = SEKARANG - (ctx.HARI - 1) * HARI;
    const slot = Math.floor((SEKARANG - mulaiJendela) / perBed);
    const sibukTransisi = tempat.slice(nUtama).map(() => []);
    const hitung = { aktif: 0, pulang: 0, transfer: 0, pindah: 0, dokumen: 0, revisi: 0 };

    // Bayi fiktif + registrasi kelahiran; nama "By. Ny. <ibu> (Demo)".
    const buatBayi = (lahir, daftar) => {
      const lk = peluang(0.55);
      const ibu = `${ctx.namaFiktif(false)} (Demo)`;
      // Bayi dibuat langsung (bukan ctx.pasien): tanggal lahir tepat, is_new_born, alamat mengikuti ibu.
      const kel = M.kelurahan?.length ? pilih(M.kelurahan) : null;
      const alamat = ctx.tambah('addresses', { full_address: `Jl. ${pilih(['Melati', 'Kenanga', 'Diponegoro', 'Pahlawan', 'Merdeka'])} No. ${antara(1, 120)}`,
        prov: kel ? kel.slice(0, 2) : '35', city: kel ? kel.slice(0, 4) : '3578', district: kel ? kel.slice(0, 6) : null, village: kel,
        rt: ctx.pad(antara(1, 12), 3), rw: ctx.pad(antara(1, 8), 3), postal_code: M.kodePos ?? null, country: 'id-ID', created_at: daftar });
      const bd = ctx.tambah('birth_details', { birth_place: M.faskes.nama, birth_date: new Date(lahir * 1000).toISOString(), ...usia(lahir, SEKARANG),
        status: true, created_at: daftar });
      const n = antara(100000, 999999);
      const p = ctx.tambah('patients', { no_rm: `DM${M.faskes.kode}${ctx.pad(n, 6)}`, title: 'By. (Bayi)', name: `By. Ny. ${ibu}`, identity: 'NIK',
        no_identity: `9999${ctx.pad(antara(0, 999999), 6)}${ctx.pad(n, 6)}`, gender: lk ? 'Laki-laki' : 'Perempuan', phone: '080000000000',
        birth_detail_uuid: bd.uuid, address_uuid: alamat.uuid, mother_name: ibu, religion: 'Islam', language: 'ID', is_new_born: true, status: true,
        created_at: daftar });
      ctx.tambah('new_borns', { identifier_mom: `9999${ctx.pad(antara(0, 999999), 6)}${ctx.pad(antara(0, 999999), 6)}`, name_mom: ibu, name_baby: p.name,
        no_rm_baby: p.no_rm, birth_detail_uuid: bd.uuid, birth_time_baby: jamWib(lahir), gender_baby: p.gender, multiple_birth: false,
        tanggal_daftar: new Date(daftar * 1000).toISOString(), status: true, created_at: daftar });
      return p;
    };
    const admisi = (p, { daftar, dirawat, bed, statusRi, pulang, keluhan }) => ctx.tambah('rawat_inaps', {
      payment_method: peluang(0.7) ? 2 : 1, no_reg: ctx.kode('RIDNICU', daftar), no_pelayanan: ctx.kode('PLDNICU', daftar), upgrade_class: false, patient_uuid: p.uuid, name: p.name, no_rm: p.no_rm, gender: p.gender,
      birth_detail_uuid: p.birth_detail_uuid, practitioner_uuid: ctx.pilihDokter()?.uuid ?? null, tanggal_daftar: daftar, tanggal_dirawat: dirawat,
      status_ri: statusRi, encounter: 'RI', box_baby: true, complaint: keluhan, monitoring_room_uuid: bed.uuid, lokasi_uuid: bed.room_uuid,
      no_spri: `SPRI/DNICU/${ctx.yymmdd(daftar)}/${ctx.pad(ctx.nomor(), 5)}`, discharge_date: pulang ?? null, status_pulang: pulang ? 'home' : null,
      kondisi_pasien_pulang: pulang ? pilih(['268910001', '359746009']) : null, status: true, created_at: daftar, updated_at: pulang ?? dirawat,
    });
    const pindah = (ri, asal, tujuan, waktu, keterangan, oleh) => ctx.tambah('perpindahans', { petugas: oleh.username, admission_ri_uuid: ri.uuid,
      origin_monitoring_room_uuid: asal.uuid, destination_monitoring_room_uuid: tujuan.uuid, waktu_pindah: waktu, keterangan, status_pindah: 'approve',
      status: true, created_at: waktu - antara(10, 40) * MENIT, updated_at: waktu });
    const riwayatRuang = (ri, bed, mulai, selesai) => ctx.tambah('riwayat_ruangan', { admission_uuid: ri.uuid, monitoring_ruangan_uuid: bed.uuid,
      status: true, created_at: mulai, updated_at: selesai ?? mulai });

    // Calon penerimaan: bayi sudah dipindah ke inkubator (perpindahan approve) tetapi belum diterima sebagai episode NICU.
    for (let c = 0; c < nCalon; c++) {
      const bed = nicu.beds[nAktif + c];
      const tiba = SEKARANG - antara(15, 60) * MENIT;
      const lahir = tiba - antara(3, 8) * JAM;
      const daftar = lahir + antara(15, 45) * MENIT;
      const p = buatBayi(lahir, daftar);
      const asal = pilih(peri.beds);
      const ri = admisi(p, { daftar, dirawat: daftar + 15 * MENIT, bed, statusRi: 3, keluhan: 'Bayi prematur, gawat napas' });
      pindah(ri, asal, bed, tiba, 'Rujuk internal ke NICU: gawat napas, butuh CPAP', pilih(perawat));
      riwayatRuang(ri, asal, daftar + 15 * MENIT, tiba);
      riwayatRuang(ri, bed, tiba);
      Object.assign(bed, { patient_uuid: p.uuid, status_operasional: 'Penuh', updated_at: tiba });
    }

    for (let i = 0; i < N; i++) {
      const b = i % nUtama;
      const s = Math.floor(i / nUtama);
      const isAktif = i + nUtama >= N && b < nAktif;
      // Profil bayi: usia gestasi menentukan berat lahir, diagnosis, dan lama rawat.
      const gw = Number(berbobot({ 26: 1, 28: 2, 30: 3, 32: 4, 34: 4, 36: 3, 38: 5, 39: 3 })) + antara(0, 1);
      const bbl = Math.min(4000, Math.max(800, Math.round(BERAT[gw] * desimal(0.85, 1.15, 2) / 10) * 10));
      const prematur = gw < 37;
      const [dx, terapi] = prematur ? [`Bayi prematur ${gw} minggu dengan respiratory distress syndrome`, gw < 32
        ? 'CPAP PEEP 6 cmH2O FiO2 30%, surfaktan 1 dosis (LISA), nutrisi parenteral, kafein sitrat.'
        : 'CPAP PEEP 5 cmH2O FiO2 25%, ASI perah via OGT bertahap, termoregulasi inkubator.'] : pilih(KASUS_CUKUP_BULAN);
      const [a1, a5] = dx.startsWith('Asfiksia') ? [antara(3, 5), antara(6, 7)] : prematur ? [antara(5, 7), antara(7, 8)] : [antara(7, 8), antara(8, 9)];
      const cara = pilih(prematur ? ['Seksio sesarea', 'Spontan pervaginam', 'Seksio sesarea'] : ['Spontan pervaginam', 'Seksio sesarea', 'Ekstraksi vakum']);
      const lamaRawat = (gw < 30 ? antara(8, 11) : gw < 34 ? antara(5, 9) : antara(3, 6)) * HARI + antara(0, 20) * JAM;

      let t1;
      let t2 = null;
      if (isAktif) t1 = SEKARANG - antara(6 * JAM, 5 * HARI);
      else {
        const awalSlot = mulaiJendela + s * slot;
        const batas = Math.min(awalSlot + slot, SEKARANG - 2 * HARI) - 4 * JAM;
        t1 = awalSlot + antara(0, Math.floor(slot * 0.15));
        t2 = Math.min(t1 + lamaRawat, batas);
        if (t2 - t1 < 2 * HARI) t1 = t2 - 2 * HARI;
      }
      const umurMasuk = prematur || dx.startsWith('Asfiksia') || dx.startsWith('Sindrom') ? antara(2, 6) * JAM : antara(24, 96) * JAM;
      const lahir = t1 - umurMasuk;
      const daftar = lahir + antara(15, 45) * MENIT;
      const dirawat = daftar + antara(10, 30) * MENIT;
      const p = buatBayi(lahir, daftar);
      const asal = pilih(peri.beds);
      const bed = nicu.beds[b];
      const ri = admisi(p, { daftar, dirawat, bed, statusRi: isAktif ? 3 : 4, keluhan: dx.split(' dengan ')[0] });
      const perawatMasuk = pilih(perawat);
      const pMasuk = pindah(ri, asal, bed, t1, `Rujuk internal ke NICU: ${dx.toLowerCase()}`, perawatMasuk);
      riwayatRuang(ri, asal, dirawat, t1);
      const masuk = t1 + antara(2, 15) * MENIT;
      const ep = ctx.tambah('nicu_episode', { pasien_uuid: p.uuid, rawat_inap_uuid: ri.uuid, perpindahan_masuk_uuid: pMasuk.uuid, perpindahan_keluar_uuid: null,
        status: 'aktif', masuk_at: masuk, keluar_at: null, versi: 1, pencatat: lain(ctx, perawat, perawatMasuk).uuid,
        serah_terima_masuk: `${dx}. Lahir ${cara.toLowerCase()} usia gestasi ${gw} minggu, BBL ${bbl} g, APGAR ${a1}/${a5}. Terapi berjalan: ${terapi}`,
        serah_terima_keluar: null, created_at: masuk, updated_at: masuk });

      // Penempatan: inkubator, lalu (sebagian) bed transisi saat membaik bila bed itu kosong pada rentang tersebut.
      const akhir = t2 ?? SEKARANG;
      let pen = ctx.tambah('nicu_penempatan', { episode_uuid: ep.uuid, tempat_uuid: tempat[b].uuid, perpindahan_uuid: pMasuk.uuid, mulai_at: masuk,
        selesai_at: null, pencatat: ep.pencatat, created_at: masuk, updated_at: masuk });
      let bedAkhir = bed;
      const rwNicu = riwayatRuang(ri, bed, t1, akhir);
      if (!isAktif && peluang(0.4) && sibukTransisi.length) {
        const tP = masuk + Math.floor((akhir - masuk) * desimal(0.55, 0.75, 2));
        const j = sibukTransisi.findIndex((r) => r.every(([a, z]) => akhir + 2 * JAM < a || tP - 2 * JAM > z));
        if (j >= 0 && akhir - tP > 12 * JAM) {
          sibukTransisi[j].push([tP, akhir]);
          const tujuan = nicu.beds[nUtama + j];
          const pP = pindah(ri, bed, tujuan, tP, 'Pindah ke bed transisi: lepas CPAP, termoregulasi stabil', pilih(perawat));
          const ganti = tP + antara(2, 10) * MENIT;
          Object.assign(pen, { selesai_at: ganti, updated_at: ganti });
          pen = ctx.tambah('nicu_penempatan', { episode_uuid: ep.uuid, tempat_uuid: tempat[nUtama + j].uuid, perpindahan_uuid: pP.uuid, mulai_at: ganti,
            selesai_at: null, pencatat: pilih(perawat).uuid, created_at: ganti, updated_at: ganti });
          Object.assign(ep, { versi: ep.versi + 1, updated_at: ganti });
          Object.assign(rwNicu, { updated_at: tP });
          riwayatRuang(ri, tujuan, tP, akhir);
          bedAkhir = tujuan;
          hitung.pindah += 1;
        }
      }

      // Dokumentasi: neonatal saat masuk & mingguan, observasi tiap ±6 jam (maks 24), keperawatan harian.
      const kd = (k, t, isi, oleh) => {
        if (t > akhir - 5 * MENIT) return null;
        hitung.dokumen += 1;
        return ctx.tambah('nicu_dokumen', { episode_uuid: ep.uuid, konfigurasi_versi_uuid: konf[k].uuid, isi, waktu_pencatatan: t, versi: 1,
          pencatat: oleh.uuid, created_at: Math.min(t + antara(1, 15) * MENIT, akhir), updated_at: Math.min(t + antara(1, 15) * MENIT, akhir) });
      };
      const beratHari = (d) => Math.round(d <= 5 ? bbl * (1 - 0.015 * d) : bbl * 0.925 * (1 + 0.015 * (d - 5)));
      for (let t = masuk + antara(20, 60) * MENIT, w = 0; t < akhir; t += 7 * HARI, w++) {
        const hari = Math.floor((t - lahir) / HARI);
        kd('neonatal', t, { berat_badan: beratHari(hari), usia_gestasi: gw + w, panjang_badan: bulat(desimal(0.95, 1.05, 2) * (gw * 1.2 + 2), 1),
          lingkar_kepala: bulat(desimal(0.95, 1.05, 2) * (gw * 0.85 + 0.5), 1), ...(w === 0 ? { apgar_menit_1: a1, apgar_menit_5: a5, cara_lahir: cara } : {}),
          ...(w === 0 ? {} : { catatan: 'Penimbangan mingguan.' }) }, pilih(dokter));
      }
      const langkah = Math.max(6 * JAM, Math.ceil((akhir - masuk) / 24));
      const obs = [];
      for (let t = masuk + antara(30, 90) * MENIT; t < akhir; t += langkah + antara(-30, 30) * MENIT) {
        const fr = (t - masuk) / Math.max(akhir - masuk, 1);
        const napas = !prematur && !dx.startsWith('Sindrom') && !dx.startsWith('Transient') ? 'Udara ruang'
          : fr < 0.35 ? 'CPAP' : fr < 0.7 ? 'Nasal kanul' : 'Udara ruang';
        const fio2 = napas === 'CPAP' ? antara(25, 40) : napas === 'Nasal kanul' ? antara(23, 30) : 21;
        const isi = { suhu: desimal(36.5, 37.4, 1), frekuensi_jantung: antara(125, 165), frekuensi_napas: prematur && fr < 0.4 ? antara(50, 68) : antara(40, 58),
          spo2: prematur ? antara(90, 95) : antara(94, 99), fio2, bantuan_napas: napas };
        if (napas !== 'Udara ruang') isi.skor_downes = fr < 0.2 ? antara(3, 5) : antara(1, 3);
        if (peluang(0.3) || dx.startsWith('Hipoglikemia')) isi.gula_darah = antara(dx.startsWith('Hipoglikemia') && fr < 0.2 ? 42 : 55, 110);
        const d = kd('observasi', t, isi, pilih(perawat));
        if (d) obs.push(d);
      }
      for (let t = masuk + antara(4, 10) * JAM; t < akhir; t += HARI) {
        const [diagnosa, intervensi, evaluasi] = prematur && t - masuk < 2 * HARI ? KEPERAWATAN[0] : pilih(KEPERAWATAN.slice(1));
        kd('keperawatan', t, { diagnosa, intervensi, evaluasi }, pilih(perawat));
      }
      // Koreksi salah input suhu oleh perawat (revisi tercatat dengan isi sebelum/sesudah).
      if (obs.length > 2 && peluang(0.2)) {
        const d = pilih(obs.slice(0, -1));
        const sebelum = { ...d.isi, suhu: bulat(d.isi.suhu - 4, 1) };
        const tKoreksi = Math.min(d.waktu_pencatatan + antara(20, 90) * MENIT, akhir - MENIT);
        ctx.tambah('nicu_dokumen_revisi', { dokumen_uuid: d.uuid, nomor_revisi: 1, sebelum, sesudah: d.isi,
          alasan: `Salah input suhu (${String(sebelum.suhu).replace('.', ',')} seharusnya ${String(d.isi.suhu).replace('.', ',')} °C).`,
          pencatat: d.pencatat, created_at: tKoreksi, updated_at: tKoreksi });
        Object.assign(d, { versi: 2, updated_at: tKoreksi });
        hitung.revisi += 1;
      }

      if (isAktif) {
        hitung.aktif += 1;
        Object.assign(bed, { patient_uuid: p.uuid, status_operasional: 'Penuh', updated_at: t1 });
        continue;
      }
      // Selesai: transfer ke perinatologi (perpindahan keluar) atau pulang langsung dari NICU.
      const transfer = peluang(0.45);
      const bbAkhir = beratHari(Math.floor((t2 - lahir) / HARI));
      let keluar;
      if (transfer) {
        const tujuan = pilih(peri.beds);
        const pK = pindah(ri, bedAkhir, tujuan, t2, 'Transfer ke perinatologi: stabil, latihan minum oral', pilih(perawat));
        keluar = t2 + antara(5, 30) * MENIT;
        const pulang = Math.min(t2 + antara(1, 3) * HARI, SEKARANG - antara(2, 8) * JAM);
        riwayatRuang(ri, tujuan, t2, pulang);
        Object.assign(ri, { monitoring_room_uuid: tujuan.uuid, lokasi_uuid: tujuan.room_uuid, discharge_date: pulang, status_pulang: 'home',
          kondisi_pasien_pulang: '268910001', updated_at: pulang });
        Object.assign(ep, { perpindahan_keluar_uuid: pK.uuid, serah_terima_keluar: `Kondisi stabil, napas spontan tanpa oksigen, suhu stabil di boks. BB ${bbAkhir} g. Minum ASI 8x per oral/OGT bertahap. Lanjut perawatan perinatologi dan edukasi metode kanguru.` });
        hitung.transfer += 1;
      } else {
        keluar = t2 + antara(10, 90) * MENIT;
        Object.assign(ri, { monitoring_room_uuid: bedAkhir.uuid, lokasi_uuid: bedAkhir.room_uuid, discharge_date: t2, status_pulang: 'home',
          kondisi_pasien_pulang: pilih(['268910001', '359746009']), updated_at: t2 });
        Object.assign(ep, { serah_terima_keluar: `Bayi dipulangkan bersama ibu. BB ${bbAkhir} g, minum ASI langsung kuat, tidak ikterik. Edukasi tanda bahaya, imunisasi hepatitis B dan polio sudah diberikan. Kontrol poli anak 3 hari lagi.` });
        hitung.pulang += 1;
      }
      Object.assign(pen, { selesai_at: keluar, updated_at: keluar });
      Object.assign(ep, { status: 'selesai', keluar_at: keluar, versi: ep.versi + 1, updated_at: keluar });
    }
    return `${N} episode NICU (${hitung.aktif} aktif, ${hitung.pulang} pulang, ${hitung.transfer} transfer, ${hitung.pindah} pindah tempat), `
      + `${nCalon} menunggu penerimaan, ${hitung.dokumen} dokumen, ${hitung.revisi} revisi, ${nTempat} tempat`;
  },
};
