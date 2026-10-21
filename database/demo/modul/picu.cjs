'use strict';

// Transaksi demo PICU. Membuat Ruang PICU dan Ruang Anak baru (lokasi, ruangan, room_monitorings, tarif) sehingga kamar/bed
// yang ada tidak diubah, memetakan bed PICU (picu_tempat_tidur), konfigurasi dokumentasi berlaku + satu draf (picu_konfigurasi),
// lalu episode 60 hari terakhir untuk pasien anak fiktif usia 1 bulan–17 tahun (patients + birth_details): admisi rawat inap,
// perpindahan (perpindahans, riwayat_ruangan), episode (picu_episode), dokumentasi antropometri/observasi/asesmen/keperawatan
// final beserta koreksi (picu_dokumentasi), dan jejak peristiwa (picu_riwayat: masuk, dokumentasi, finalisasi, pindah,
// transfer, pulang). Alur: ruang anak/IGD → perpindahan approve → episode aktif → [pindah bed PICU] → transfer keluar ke ruang
// anak atau pulang. Beberapa episode tetap aktif (dokumen terakhir masih draf) dan satu pasien menunggu penerimaan PICU.
const { buatRuang, petugas, lain } = require('./hdu.cjs');

const JAM = 3600;
const HARI = 86400;
const MENIT = 60;
const JUMLAH = { rs_a: 25, rs_b: 15, rs_c: 10, rs_d: 5 };
const BED = { rs_a: 6, rs_b: 5, rs_c: 4, rs_d: 4 }; // dua bed terakhir = cadangan/isolasi (tujuan pindah), satu sedang perbaikan
const AKTIF = { rs_a: 3, rs_b: 2, rs_c: 1, rs_d: 1 };
const CALON = { rs_a: 1, rs_b: 1 };

const k = (kode, nama, tipe, satuan, wajib) => ({ kode, nama, tipe, satuan, wajib });
const KONFIGURASI = [
  ['antropometri', 'Antropometri anak', [k('berat_badan', 'Berat badan', 'angka', 'kg', true), k('tinggi_badan', 'Panjang/tinggi badan', 'angka', 'cm', true),
    k('lingkar_kepala', 'Lingkar kepala', 'angka', 'cm', false), k('status_gizi', 'Status gizi', 'teks', '', false)]],
  ['observasi', 'Observasi tanda vital PICU', [k('suhu', 'Suhu', 'angka', '°C', true), k('nadi', 'Nadi', 'angka', 'x/menit', true),
    k('napas', 'Frekuensi napas', 'angka', 'x/menit', true), k('sistolik', 'Tekanan darah sistolik', 'angka', 'mmHg', true),
    k('diastolik', 'Tekanan darah diastolik', 'angka', 'mmHg', true), k('spo2', 'Saturasi oksigen', 'angka', '%', true),
    k('gcs', 'GCS', 'angka', '', false), k('skala_nyeri', 'Skala nyeri', 'angka', '0–10', false), k('skor_pews', 'Skor PEWS', 'angka', '', false),
    k('catatan', 'Catatan', 'teks', '', false)]],
  ['asesmen', 'Asesmen harian dokter PICU', [k('diagnosis_kerja', 'Diagnosis kerja', 'teks', '', true), k('masalah_aktif', 'Masalah aktif', 'teks', '', true),
    k('rencana', 'Rencana', 'teks', '', false)]],
  ['keperawatan', 'Asuhan keperawatan PICU', [k('diagnosa', 'Diagnosis keperawatan', 'teks', '', true), k('intervensi', 'Intervensi', 'teks', '', true),
    k('evaluasi', 'Evaluasi', 'teks', '', false)]],
  ['rencana', 'Rencana pemulangan (draf)', [k('tujuan', 'Tujuan perawatan', 'teks', '', true), k('rencana_pulang', 'Rencana pulang', 'teks', '', false)], true],
];
// [diagnosis, keluhan, terapi awal, masalah aktif, usia minimal (bulan), usia maksimal (bulan)]
const KASUS = [
  ['Dengue shock syndrome', 'Demam tinggi', 'Resusitasi kristaloid 20 mL/kgBB lalu 10–7–5 mL/kgBB/jam sesuai protokol, hematokrit tiap 4–6 jam.', 'Syok teratasi, kebocoran plasma', 36, 204],
  ['Pneumonia berat dengan gagal napas', 'Sesak napas', 'HFNC 2 L/kg/menit FiO2 40%, ampisilin 50 mg/kgBB/6 jam + gentamisin IV.', 'Distres napas, kebutuhan oksigen', 1, 204],
  ['Bronkiolitis berat', 'Sesak napas', 'HFNC 2 L/kg/menit, suction berkala, nutrisi via NGT.', 'Distres napas, intake oral kurang', 1, 23],
  ['Status epileptikus', 'Kejang', 'Diazepam IV, fenitoin 20 mg/kgBB loading lalu rumatan, cari etiologi.', 'Kejang berulang, penurunan kesadaran', 6, 204],
  ['Ketoasidosis diabetik', 'Lemas dan muntah', 'Insulin drip 0,05–0,1 U/kgBB/jam, rehidrasi bertahap 48 jam, koreksi kalium.', 'Asidosis metabolik, risiko edema serebri', 60, 204],
  ['Syok sepsis', 'Demam tinggi', 'Bolus kristaloid 2x20 mL/kgBB, norepinefrin 0,1 mcg/kg/menit, sefotaksim IV.', 'Syok, disfungsi organ', 1, 204],
  ['Cedera kepala sedang pasca kecelakaan', 'Penurunan kesadaran', 'Elevasi kepala 30°, manitol 0,5 g/kgBB, analgesik, observasi neurologis.', 'Peningkatan tekanan intrakranial', 36, 204],
  ['Asma serangan berat', 'Sesak napas', 'Nebulisasi salbutamol kontinu, metilprednisolon 1 mg/kgBB/6 jam IV, MgSO4 50 mg/kgBB.', 'Bronkospasme', 36, 204],
  ['Pasca laparotomi atas indikasi invaginasi', 'Rencana operasi', 'Puasa, NGT dekompresi, cairan rumatan, analgesik, antibiotik profilaksis.', 'Nyeri pascaoperasi, keseimbangan cairan', 3, 60],
];
const KEPERAWATAN = [
  ['Pola napas tidak efektif', 'Posisi semi-Fowler, kelola terapi oksigen, suction sesuai kebutuhan.', 'Retraksi berkurang, SpO2 ≥94%.'],
  ['Risiko syok', 'Pantau perfusi, CRT, diuresis per jam, kelola cairan sesuai protokol.', 'CRT <2 detik, diuresis ≥1 mL/kg/jam.'],
  ['Hipertermia', 'Kompres hangat, antipiretik sesuai instruksi, cairan adekuat.', 'Suhu turun menjadi 37,4 °C.'],
  ['Risiko cedera (kejang)', 'Pengaman tempat tidur, posisi miring saat kejang, siapkan antikonvulsan.', 'Tidak ada kejang ulang.'],
  ['Ansietas orang tua', 'Edukasi kondisi anak, libatkan orang tua dalam perawatan.', 'Orang tua tampak lebih tenang.'],
];

// Kelompok usia (bulan) → rentang tanda vital normal anak.
const VITAL = [
  [12, { nadi: [110, 160], napas: [30, 50], sis: [72, 100] }],
  [60, { nadi: [95, 140], napas: [24, 40], sis: [80, 110] }],
  [144, { nadi: [80, 120], napas: [18, 30], sis: [90, 115] }],
  [999, { nadi: [60, 100], napas: [12, 20], sis: [100, 125] }],
];
const bulat = (x, d = 1) => Number(x.toFixed(d));

module.exports = {
  kode: 'picu',
  nama: 'PICU',
  tahap: 1,
  modul: ['picu'],
  seed: async (ctx) => {
    const { M, SEKARANG, antara, pilih, peluang, desimal, berbobot } = ctx;
    const seg = M.faskes.segmen;
    if (!JUMLAH[seg]) return `tidak diisi: PICU hanya untuk rumah sakit (segmen ${seg})`;
    const N = JUMLAH[seg];
    const nBed = BED[seg] ?? 4;
    const nAktif = AKTIF[seg] ?? 1;
    const nCalon = CALON[seg] ?? 0;
    if (!M.users.length) throw new Error('User demo belum ada (jalankan npm run db:demo:seed)');
    const perawat = petugas(M, /perawat/);
    const dokter = petugas(M, /\.dr\./);
    const admin = petugas(M, /admin/)[0] ?? M.users[0];
    const awal = SEKARANG - (ctx.HARI + 14) * HARI;

    const picu = await buatRuang(ctx, { akhiran: 'PICU', nama: 'Ruang PICU', kelas: 'Kelas 1', jumlah: nBed, harga: 1500000, dibuat: awal });
    const anak = await buatRuang(ctx, { akhiran: 'ANAK', nama: 'Ruang Anak', kelas: 'Kelas 2', urutan: 1, jumlah: 6, harga: 375000, dibuat: awal });
    const nUtama = Math.max(nBed - 2, 1);
    for (const bed of picu.beds) ctx.tambah('picu_tempat_tidur', { tempat_tidur_uuid: bed.uuid, dibuat_oleh: admin.uuid, created_at: awal + JAM });
    // Bed cadangan terakhir sedang perbaikan (tidak operasional); tidak pernah ditempati episode aktif.
    if (nBed > nUtama) Object.assign(picu.beds[nBed - 1], { status_operasional: 'Perbaikan', updated_at: SEKARANG - antara(1, 5) * HARI });

    const konf = {};
    for (const [jenis, nama, definisi, draf] of KONFIGURASI) {
      const dibuat = draf ? SEKARANG - antara(2, 8) * HARI : awal + 2 * JAM;
      const sah = draf ? null : dibuat + antara(1, 3) * HARI;
      konf[jenis] = ctx.tambah('picu_konfigurasi', { jenis, nama, definisi, status: draf ? 'draf' : 'berlaku',
        referensi_penetapan: draf ? null : `SK Direktur No. ${antara(10, 99)}/SK-DIR/PICU/2026 (Demo)`, disahkan_oleh: draf ? null : pilih(dokter).uuid,
        disahkan_at: sah, dibuat_oleh: admin.uuid, created_at: dibuat, updated_at: sah ?? dibuat });
    }

    const admisi = (p, { daftar, dirawat, bed, statusRi, keluhan }) => ctx.tambah('rawat_inaps', {
      payment_method: peluang(0.65) ? 2 : 1, no_reg: ctx.kode('RIDPICU', daftar), no_pelayanan: ctx.kode('PLDPICU', daftar), upgrade_class: false, patient_uuid: p.uuid, name: p.name, no_rm: p.no_rm, gender: p.gender,
      birth_detail_uuid: p.birth_detail_uuid, practitioner_uuid: ctx.pilihDokter()?.uuid ?? null, tanggal_daftar: daftar, tanggal_dirawat: dirawat,
      status_ri: statusRi, encounter: peluang(0.7) ? 'IGD' : 'RJ', complaint: keluhan, monitoring_room_uuid: bed.uuid, lokasi_uuid: bed.room_uuid,
      no_spri: `SPRI/DPICU/${ctx.yymmdd(daftar)}/${ctx.pad(ctx.nomor(), 5)}`, status: true, created_at: daftar, updated_at: dirawat,
    });
    const pindah = (ri, asal, tujuan, waktu, keterangan, oleh) => ctx.tambah('perpindahans', { petugas: oleh.username, admission_ri_uuid: ri.uuid,
      origin_monitoring_room_uuid: asal.uuid, destination_monitoring_room_uuid: tujuan.uuid, waktu_pindah: waktu, keterangan, status_pindah: 'approve',
      status: true, created_at: waktu - antara(10, 40) * MENIT, updated_at: waktu });
    const riwayatRuang = (ri, bed, mulai, selesai) => ctx.tambah('riwayat_ruangan', { admission_uuid: ri.uuid, monitoring_ruangan_uuid: bed.uuid,
      status: true, created_at: mulai, updated_at: selesai ?? mulai });
    // Pasien anak fiktif dengan tanggal lahir sesuai usia (bulan) saat masuk.
    const buatAnak = (bulan, masuk, daftar) => {
      // ctx.pasien: alamat + tanggal lahir; umur dihitung terhadap SEKARANG agar usia saat masuk sesuai profil.
      const th = (bulan + 0.4) / 12 + (SEKARANG - masuk) / (365.25 * HARI);
      return ctx.pasien({ baru: true, umur: [th, th + 0.04], waktu: daftar });
    };
    const profil = () => {
      const kel = berbobot({ bayi: 3, balita: 4, anak: 3, remaja: 2 });
      const bulan = kel === 'bayi' ? antara(1, 11) : kel === 'balita' ? antara(12, 59) : kel === 'anak' ? antara(60, 143) : antara(144, 204);
      const kasus = pilih(KASUS.filter(([, , , , min, max]) => bulan >= min && bulan <= max));
      const th = bulan / 12;
      const bb = bulan < 12 ? 3.3 + 0.6 * bulan : th < 6 ? 2 * th + 8 : th < 13 ? (7 * th - 5) / 2 : 40 + (th - 12) * 5;
      const tb = bulan < 12 ? 50 + 2.2 * bulan : th < 13 ? 75 + 6.3 * (th - 1) : 150 + (th - 12) * 3.5;
      return { bulan, kasus, bb: bulat(bb * desimal(0.88, 1.12, 2)), tb: bulat(tb * desimal(0.96, 1.04, 2)), vital: VITAL.find(([batas]) => bulan < batas)[1] };
    };

    // Calon penerimaan: anak sudah dipindah ke bed PICU (perpindahan approve, bed terisi), belum diterima sebagai episode.
    for (let c = 0; c < nCalon; c++) {
      const bed = picu.beds[nAktif + c];
      const tiba = SEKARANG - antara(15, 60) * MENIT;
      const pr = profil();
      const daftar = tiba - antara(3, 10) * JAM;
      const p = buatAnak(pr.bulan, tiba, daftar);
      const asal = pilih(anak.beds);
      const ri = admisi(p, { daftar, dirawat: daftar + 30 * MENIT, bed, statusRi: 3, keluhan: pr.kasus[1] });
      pindah(ri, asal, bed, tiba, `Pindah ke PICU: ${pr.kasus[0].toLowerCase()}`, pilih(perawat));
      riwayatRuang(ri, asal, daftar + 30 * MENIT, tiba);
      riwayatRuang(ri, bed, tiba);
      Object.assign(bed, { patient_uuid: p.uuid, status_operasional: 'Penuh', updated_at: tiba });
    }

    const perBed = Math.ceil(N / nUtama);
    const mulaiJendela = SEKARANG - (ctx.HARI - 1) * HARI;
    const slot = Math.floor((SEKARANG - mulaiJendela) / perBed);
    const sibukCadangan = picu.beds.slice(nUtama).map(() => []);
    const hitung = { aktif: 0, transfer: 0, pulang: 0, pindah: 0, dokumen: 0, koreksi: 0, riwayat: 0 };
    const riwayat = (ep, jenis, waktu, oleh, { referensi = null, asal = null, tujuan = null, alasan }) => {
      hitung.riwayat += 1;
      return ctx.tambah('picu_riwayat', { episode_uuid: ep.uuid, jenis, referensi_uuid: referensi, asal_uuid: asal, tujuan_uuid: tujuan, alasan,
        dibuat_oleh: oleh.uuid, created_at: waktu, updated_at: waktu });
    };

    for (let i = 0; i < N; i++) {
      const b = i % nUtama;
      const s = Math.floor(i / nUtama);
      const isAktif = i + nUtama >= N && b < nAktif;
      const pr = profil();
      const [dx, keluhan, terapi, masalah] = pr.kasus;
      let t1;
      let t2 = null;
      if (isAktif) t1 = SEKARANG - antara(5 * JAM, 3 * HARI);
      else {
        const awalSlot = mulaiJendela + s * slot;
        const batas = Math.min(awalSlot + slot, SEKARANG - 2 * HARI) - 4 * JAM;
        t1 = awalSlot + antara(0, Math.floor(slot * 0.2));
        t2 = Math.min(t1 + antara(36 * JAM, 6 * HARI), batas);
        if (t2 - t1 < 30 * JAM) t1 = t2 - 30 * JAM;
      }
      const daftar = t1 - antara(3 * JAM, 36 * JAM);
      const dirawat = daftar + antara(30, 120) * MENIT;
      const p = buatAnak(pr.bulan, t1, daftar);
      const asal = pilih(anak.beds);
      const bed = picu.beds[b];
      const ri = admisi(p, { daftar, dirawat, bed, statusRi: isAktif ? 3 : 4, keluhan });
      const perawatPengirim = pilih(perawat);
      const pMasuk = pindah(ri, asal, bed, t1, `Pindah ke PICU: ${dx.toLowerCase()}`, perawatPengirim);
      riwayatRuang(ri, asal, dirawat, t1);
      const masuk = t1 + antara(2, 15) * MENIT;
      const penerima = lain(ctx, perawat, perawatPengirim);
      const ep = ctx.tambah('picu_episode', { pasien_uuid: p.uuid, kunjungan_uuid: ri.uuid, tempat_tidur_uuid: bed.uuid, referensi_penerimaan_uuid: pMasuk.uuid,
        sumber_penerimaan: 'rawat_inap', status: 'aktif', versi: 1, waktu_masuk: masuk, waktu_keluar: null, jenis_keluar: null,
        dibuat_oleh: penerima.uuid, created_at: masuk, updated_at: masuk });
      riwayat(ep, 'masuk', masuk, penerima, { referensi: pMasuk.uuid, asal: asal.uuid, tujuan: bed.uuid, alasan: 'Penerimaan melalui perpindahan rawat inap.' });
      const akhir = t2 ?? SEKARANG;
      const rwPicu = riwayatRuang(ri, bed, t1, akhir);
      let bedAkhir = bed;

      // Pindah ke bed cadangan/isolasi PICU (sebagian episode selesai) bila bed itu kosong pada rentang tersebut.
      if (!isAktif && peluang(0.3) && sibukCadangan.length) {
        const tP = masuk + Math.floor((akhir - masuk) * desimal(0.3, 0.6, 2));
        const j = sibukCadangan.findIndex((r) => r.every(([a, z]) => akhir + 2 * JAM < a || tP - 2 * JAM > z));
        if (j >= 0 && akhir - tP > 8 * JAM) {
          sibukCadangan[j].push([tP, akhir]);
          const tujuan = picu.beds[nUtama + j];
          const oleh = pilih(perawat);
          const pP = pindah(ri, bed, tujuan, tP, 'Pindah bed PICU: isolasi kontak', oleh);
          const catat = tP + antara(2, 10) * MENIT;
          riwayat(ep, 'pindah', catat, oleh, { referensi: pP.uuid, asal: bed.uuid, tujuan: tujuan.uuid, alasan: 'Pindah ke bed isolasi kontak sesuai hasil skrining.' });
          Object.assign(rwPicu, { updated_at: tP });
          riwayatRuang(ri, tujuan, tP, akhir);
          Object.assign(ep, { tempat_tidur_uuid: tujuan.uuid, versi: ep.versi + 1, updated_at: catat });
          bedAkhir = tujuan;
          hitung.pindah += 1;
        }
      }

      // Dokumentasi: final (finalisasi oleh dokter/perawat penanggung jawab); pada episode aktif dokumen 8 jam terakhir masih draf.
      const dokumen = [];
      const catat = (jenis, t, isi, oleh, tambahan = {}) => {
        if (t > akhir - 5 * MENIT) return null;
        const dibuat = Math.min(t + antara(1, 20) * MENIT, akhir - MENIT);
        const final = !(isAktif && t > SEKARANG - 8 * JAM);
        const fin = final ? Math.min(dibuat + antara(10, 240) * MENIT, SEKARANG - MENIT) : null;
        const d = ctx.tambah('picu_dokumentasi', { episode_uuid: ep.uuid, konfigurasi_uuid: konf[jenis].uuid, jenis, isi, waktu_catatan: t,
          status: final ? 'final' : 'draf', koreksi_uuid: null, alasan: null, finalisasi_oleh: final ? pilih(dokter).uuid : null, finalisasi_at: fin,
          dibuat_oleh: oleh.uuid, created_at: dibuat, updated_at: fin ?? dibuat, ...tambahan });
        riwayat(ep, tambahan.koreksi_uuid ? 'koreksi_dokumentasi' : 'dokumentasi', dibuat, oleh, { referensi: d.uuid, alasan: tambahan.alasan ?? 'Pencatatan dokumentasi.' });
        if (final) riwayat(ep, 'finalisasi', fin, { uuid: d.finalisasi_oleh }, { referensi: d.uuid, alasan: 'Finalisasi dokumentasi sesuai kewenangan.' });
        hitung.dokumen += 1;
        dokumen.push(d);
        return d;
      };
      catat('antropometri', masuk + antara(20, 60) * MENIT, { berat_badan: pr.bb, tinggi_badan: pr.tb,
        ...(pr.bulan < 24 ? { lingkar_kepala: bulat(35 + 1.1 * Math.min(pr.bulan, 12) + 0.15 * Math.max(pr.bulan - 12, 0)) } : {}),
        status_gizi: pilih(['Gizi baik', 'Gizi baik', 'Gizi kurang', 'Berisiko gizi lebih']) }, pilih(perawat));
      const langkah = Math.max(4 * JAM, Math.ceil((akhir - masuk) / 20));
      const v = pr.vital;
      const neuro = /kejang|Cedera|epileptikus/i.test(dx);
      const obs = [];
      for (let t = masuk + antara(30, 60) * MENIT; t < akhir; t += langkah + antara(-20, 20) * MENIT) {
        const fr = (t - masuk) / Math.max(akhir - masuk, 1);
        const berat = fr < 0.3;
        const sis = antara(v.sis[0], v.sis[1]) - (berat && /syok|sepsis/i.test(dx) ? 15 : 0);
        const isi = { suhu: berat && /Demam|sepsis|Pneumonia|Dengue/i.test(dx + keluhan) ? desimal(37.8, 39.2, 1) : desimal(36.5, 37.4, 1),
          nadi: antara(v.nadi[0], v.nadi[1]) + (berat ? antara(10, 25) : 0), napas: antara(v.napas[0], v.napas[1]) + (berat ? antara(4, 10) : 0),
          sistolik: sis, diastolik: Math.round(sis * desimal(0.55, 0.65, 2)), spo2: berat ? antara(91, 96) : antara(95, 99),
          gcs: neuro && berat ? antara(9, 13) : antara(14, 15), skala_nyeri: antara(berat ? 2 : 0, berat ? 6 : 3), skor_pews: berat ? antara(3, 6) : antara(0, 2) };
        if (berat && peluang(0.3)) isi.catatan = 'Lapor dokter jaga, instruksi dilanjutkan.';
        const d = catat('observasi', t, isi, pilih(perawat));
        if (d) obs.push(d);
      }
      for (let t = masuk + antara(2, 6) * JAM, h = 0; t < akhir; t += HARI, h++) {
        catat('asesmen', t, { diagnosis_kerja: dx, masalah_aktif: h === 0 ? masalah : pilih([masalah, 'Perbaikan klinis, evaluasi kebutuhan perawatan intensif']),
          rencana: h === 0 ? terapi : pilih(['Lanjut terapi, evaluasi laboratorium besok.', 'Rencana pindah ruang anak bila stabil 24 jam.', 'Turunkan dukungan bertahap.']) }, pilih(dokter));
        const [diagnosa, intervensi, evaluasi] = pilih(KEPERAWATAN);
        catat('keperawatan', t + antara(1, 4) * JAM, { diagnosa, intervensi, evaluasi }, pilih(perawat));
      }
      // Koreksi dokumen final: entri baru merujuk koreksi_uuid dengan alasan; dokumen lama tetap tersimpan.
      const finalObs = obs.filter((d) => d.status === 'final' && d.finalisasi_at < akhir - JAM);
      if (finalObs.length > 2 && peluang(0.2)) {
        const asli = pilih(finalObs.slice(0, -1));
        const oleh = { uuid: asli.dibuat_oleh };
        const t = Math.min(asli.finalisasi_at + antara(10, 60) * MENIT, akhir - 30 * MENIT);
        const benar = { ...asli.isi };
        asli.isi = { ...asli.isi, nadi: asli.isi.nadi + 40 }; // yang tercatat semula salah ketik
        const dibuat = t;
        const fin = Math.min(dibuat + antara(10, 60) * MENIT, SEKARANG - MENIT);
        const d = ctx.tambah('picu_dokumentasi', { episode_uuid: ep.uuid, konfigurasi_uuid: konf.observasi.uuid, jenis: 'observasi', isi: benar,
          waktu_catatan: asli.waktu_catatan, status: 'final', koreksi_uuid: asli.uuid, alasan: `Koreksi salah ketik nadi (${asli.isi.nadi} seharusnya ${benar.nadi} x/menit).`,
          finalisasi_oleh: pilih(dokter).uuid, finalisasi_at: fin, dibuat_oleh: oleh.uuid, created_at: dibuat, updated_at: fin });
        riwayat(ep, 'koreksi_dokumentasi', dibuat, oleh, { referensi: d.uuid, alasan: d.alasan });
        riwayat(ep, 'finalisasi', fin, { uuid: d.finalisasi_oleh }, { referensi: d.uuid, alasan: 'Finalisasi dokumentasi sesuai kewenangan.' });
        hitung.koreksi += 1;
      }

      if (isAktif) {
        hitung.aktif += 1;
        Object.assign(bed, { patient_uuid: p.uuid, status_operasional: 'Penuh', updated_at: t1 });
        continue;
      }
      // Penutupan: transfer ke ruang anak (perpindahan keluar) atau pulang langsung setelah pemulangan admisi.
      const oleh = pilih(perawat);
      if (peluang(0.6)) {
        const tujuan = pilih(anak.beds);
        const pK = pindah(ri, bedAkhir, tujuan, t2, 'Transfer ke ruang anak: kondisi stabil', oleh);
        const tutup = t2 + antara(5, 30) * MENIT;
        const pulang = Math.min(t2 + antara(1, 4) * HARI, SEKARANG - antara(2, 8) * JAM);
        riwayatRuang(ri, tujuan, t2, pulang);
        riwayat(ep, 'transfer', tutup, oleh, { referensi: pK.uuid, asal: bedAkhir.uuid, tujuan: tujuan.uuid, alasan: 'Kondisi stabil 24 jam tanpa dukungan intensif, lanjut perawatan ruang anak.' });
        Object.assign(ri, { monitoring_room_uuid: tujuan.uuid, lokasi_uuid: tujuan.room_uuid, discharge_date: pulang, status_pulang: 'home', kondisi_pasien_pulang: '268910001', updated_at: pulang });
        Object.assign(ep, { status: 'selesai', jenis_keluar: 'transfer', waktu_keluar: tutup, versi: ep.versi + 1, updated_at: tutup });
        hitung.transfer += 1;
      } else {
        const tutup = t2 + antara(10, 90) * MENIT;
        riwayat(ep, 'pulang', tutup, oleh, { referensi: ri.uuid, asal: bedAkhir.uuid, alasan: 'Pasien pulang setelah pemulangan admisi rawat inap.' });
        Object.assign(ri, { monitoring_room_uuid: bedAkhir.uuid, lokasi_uuid: bedAkhir.room_uuid, discharge_date: t2, status_pulang: 'home',
          kondisi_pasien_pulang: pilih(['268910001', '359746009']), updated_at: t2 });
        Object.assign(ep, { status: 'selesai', jenis_keluar: 'pulang', waktu_keluar: tutup, versi: ep.versi + 1, updated_at: tutup });
        hitung.pulang += 1;
      }
    }
    return `${N} episode PICU (${hitung.aktif} aktif, ${hitung.transfer} transfer, ${hitung.pulang} pulang, ${hitung.pindah} pindah bed), `
      + `${nCalon} menunggu penerimaan, ${hitung.dokumen} dokumentasi, ${hitung.koreksi} koreksi, ${hitung.riwayat} riwayat, ${nBed} bed`;
  },
};
