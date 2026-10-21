'use strict';

// PACU / Recovery Room (fitur 'pacu' modul Kamar Operasi): protokol pemantauan faskes (pacu_protokol, versi aktif;
// dipakai ulang bila faskes sudah punya) + episode pemulihan dari jadwal operasi hasil seeder kamar-operasi yang sudah
// tersimpan (laporan operasi bertindakan + laporan anestesi; anestesi lokal/topikal tidak melewati PACU).
// Tabel: pacu_protokol, pacu_episode, pacu_catatan (serah_terima_masuk, pemantauan berkala dengan komponen Aldrete,
// intervensi, asesmen siap/belum_siap, serah_terima_keluar), pacu_riwayat (jejak audit seperti pacu.js), pacu_biaya
// (protokol RS kelas A/B menagihkan biaya PACU terpisah: status 'tertunda' — belum dikirim ke kasir).
// Alur status episode: menunggu_masuk → berada_di_pacu (kedatangan) → dalam_pemantauan → siap_dipindahkan (asesmen
// siap) → selesai (serah terima keluar diterima). Jadwal selesai → episode selesai (waktu mengikuti Aldrete masuk/keluar
// laporan anestesi); operasi hari ini yang pasiennya masih di pemulihan → episode aktif dengan status berjenjang.
const MENIT = 60;

const p = (kode, nama, tipe, wajib, ekstra = {}) => ({ kode, nama, tipe, wajib, ...ekstra });
const PILIHAN_ALDRETE = ['0', '1', '2'];
// Definisi mengikuti contoh protokol di frontend (Komponen/contohProtokolPacu.ts), interval 15 menit.
const definisiProtokol = (segmen) => ({
  nama: 'Pemantauan Pascaanestesi Umum (data demo)',
  interval_pemantauan_detik: 900,
  parameter: [
    p('tekanan_sistolik', 'Tekanan darah sistolik', 'angka', true, { satuan: 'mmHg' }),
    p('tekanan_diastolik', 'Tekanan darah diastolik', 'angka', true, { satuan: 'mmHg' }),
    p('nadi', 'Nadi', 'angka', true, { satuan: 'x/menit' }),
    p('laju_napas', 'Laju napas', 'angka', true, { satuan: 'x/menit' }),
    p('spo2', 'Saturasi oksigen', 'angka', true, { satuan: '%' }),
    p('suhu', 'Suhu', 'angka', false, { satuan: '°C' }),
    p('kesadaran', 'Kesadaran', 'pilihan', true, { pilihan: ['Sadar penuh', 'Bangun bila dipanggil', 'Tidak berespons'] }),
    p('jalan_napas', 'Jalan napas', 'pilihan', true, { pilihan: ['Paten tanpa alat bantu', 'Paten dengan alat bantu', 'Terganggu'] }),
    p('skala_nyeri', 'Skala nyeri', 'angka', true, { satuan: 'skor' }),
    p('mual_muntah', 'Mual/muntah', 'pilihan', true, { pilihan: ['Tidak ada', 'Mual', 'Muntah'] }),
    p('aldrete_aktivitas', 'Aldrete — aktivitas', 'pilihan', false, { pilihan: PILIHAN_ALDRETE }),
    p('aldrete_respirasi', 'Aldrete — respirasi', 'pilihan', false, { pilihan: PILIHAN_ALDRETE }),
    p('aldrete_sirkulasi', 'Aldrete — sirkulasi', 'pilihan', false, { pilihan: PILIHAN_ALDRETE }),
    p('aldrete_kesadaran', 'Aldrete — kesadaran', 'pilihan', false, { pilihan: PILIHAN_ALDRETE }),
    p('aldrete_saturasi', 'Aldrete — saturasi O2', 'pilihan', false, { pilihan: PILIHAN_ALDRETE }),
    p('skor_pemulihan', 'Skor pemulihan (Aldrete)', 'angka', true, { satuan: 'poin' }),
  ],
  kriteria_pindah: [
    p('skor_pemulihan_memenuhi', 'Skor Aldrete ≥ 9', 'boolean', true),
    p('tanda_vital_stabil', 'Tanda vital stabil sesuai protokol', 'boolean', true),
    p('jalan_napas_aman', 'Jalan napas aman', 'boolean', true),
    p('nyeri_terkendali', 'Nyeri terkendali', 'boolean', true),
    p('mual_terkendali', 'Mual/muntah terkendali', 'boolean', true),
  ],
  format_serah_terima: [
    p('ringkasan_kondisi', 'Ringkasan kondisi pasien', 'teks', true),
    p('instruksi_lanjutan', 'Instruksi lanjutan', 'teks', true),
    p('obat_terakhir', 'Obat terakhir diberikan', 'teks', false),
    p('alat_terpasang', 'Alat/kateter terpasang', 'teks', false),
  ],
  biaya: segmen === 'rs_a' || segmen === 'rs_b'
    ? { aktif: true, termasuk_paket: false, layanan_uuid: 'PACU-OBS', nama: 'Observasi Ruang Pemulihan (PACU)', tarif: segmen === 'rs_a' ? 250000 : 200000 }
    : { aktif: true, termasuk_paket: true },
});

// Komponen Aldrete (aktivitas, respirasi, sirkulasi, kesadaran, saturasi; masing-masing 0–2) untuk skor total.
const komponenAldrete = (total) => {
  const k = { aldrete_aktivitas: 2, aldrete_respirasi: 2, aldrete_sirkulasi: 2, aldrete_kesadaran: 2, aldrete_saturasi: 2 };
  let kurang = 10 - total;
  for (const kunci of ['aldrete_aktivitas', 'aldrete_kesadaran', 'aldrete_sirkulasi', 'aldrete_aktivitas', 'aldrete_respirasi', 'aldrete_kesadaran', 'aldrete_saturasi']) {
    if (kurang <= 0) break;
    if (k[kunci] > 0) { k[kunci]--; kurang--; }
  }
  return Object.fromEntries(Object.entries(k).map(([a, b]) => [a, String(b)]));
};

async function seed(ctx) {
  const { M, F } = ctx;
  const f = ctx.faskes;
  const userPerawat = M.users.filter((u) => /perawat/i.test(u.username)).map((u) => u.username);
  const user = () => (userPerawat.length ? ctx.pilih(userPerawat) : M.users[0]?.username ?? 'demo');
  const userLain = (bukan) => (userPerawat.filter((u) => u !== bukan).length ? ctx.pilih(userPerawat.filter((u) => u !== bukan)) : user());

  // ── Protokol aktif (pakai yang sudah ada; bila belum ada, buat versi baru 'pacu_umum' lalu aktifkan) ──
  let protokol = await ctx.satu(`SELECT uuid, kode, nomor_versi, definisi FROM pacu_protokol WHERE faskes_uuid = $1 AND aktif AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`, [f]);
  let protokolBaru = false;
  let riwayatProtokol = () => {};
  if (!protokol) {
    const n = await ctx.satu(`SELECT COALESCE(MAX(nomor_versi), 0) + 1 AS n FROM pacu_protokol WHERE faskes_uuid = $1 AND kode = 'pacu_umum'`, [f]);
    const tBuat = ctx.hariLalu(ctx.HARI + 2) + 9 * 3600;
    const pengaju = user();
    protokol = ctx.tambah('pacu_protokol', {
      kode: 'pacu_umum', nomor_versi: Number(n.n), aktif: true, definisi: definisiProtokol(F.segmen), versi: 2,
      created_by: pengaju, updated_by: pengaju, created_at: tBuat, updated_at: tBuat + 3600,
    });
    // Jejak audit protokol ditambahkan setelah episode: urutan insert kerangka = kemunculan pertama tabel, dan
    // pacu_riwayat ber-episode harus masuk setelah pacu_episode (foreign key).
    riwayatProtokol = () => {
      ctx.tambah('pacu_riwayat', { episode_uuid: null, entitas: 'protokol', entitas_uuid: protokol.uuid, aksi: 'buat_versi', nilai_sebelum: null,
        nilai_sesudah: { kode: protokol.kode, nomor_versi: protokol.nomor_versi, aktif: false, versi: 1 }, alasan: null, created_by: pengaju, created_at: tBuat });
      ctx.tambah('pacu_riwayat', { episode_uuid: null, entitas: 'protokol', entitas_uuid: protokol.uuid, aksi: 'aktifkan', nilai_sebelum: { aktif: false, versi: 1 },
        nilai_sesudah: { aktif: true, versi: 2 }, alasan: null, created_by: pengaju, created_at: tBuat + 3600 });
    };
    protokolBaru = true;
  }
  const def = protokol.definisi;
  const interval = Number(def.interval_pemantauan_detik) || 900;
  const biaya = def.biaya?.aktif && !def.biaya.termasuk_paket ? def.biaya : null;

  // Nilai parameter sesuai definisi protokol (kode yang tidak dikenal diisi nilai netral sesuai tipe).
  const nilaiDari = (daftar, dikenal) => Object.fromEntries((daftar ?? []).filter((d) => d.wajib || dikenal[d.kode] !== undefined).map((d) => {
    let v = dikenal[d.kode];
    if (v === undefined || (d.tipe === 'pilihan' && !d.pilihan.includes(v))) v = d.tipe === 'angka' ? 0 : d.tipe === 'boolean' ? true : d.tipe === 'pilihan' ? d.pilihan[0] : 'Sesuai protokol';
    return [d.kode, v];
  }));

  // ── Jadwal sumber: syarat sama dengan POST /kamar-operasi/pacu (laporan operasi bertindakan + laporan anestesi) ──
  const jadwal = await ctx.baris(`
    SELECT j.uuid, j.status, j.waktu_selesai_aktual::float8 AS aktual, o.sumber, o.no_reg, o.lokasi_asal_uuid, o.diagnosis_nama,
           la.jenis_anestesi, la.aldrete_masuk, la.aldrete_keluar, la.waktu_aldrete_masuk::float8 AS t_masuk, la.waktu_aldrete_keluar::float8 AS t_keluar,
           ot.nama_tindakan, k.uuid AS kunjungan_uuid,
           (SELECT practitioner_uuid FROM ok_jadwal_tim WHERE jadwal_uuid = j.uuid AND peran = 'anestesi' AND deleted_at IS NULL LIMIT 1) AS anestesi_uuid,
           (SELECT practitioner_uuid FROM ok_jadwal_tim WHERE jadwal_uuid = j.uuid AND peran LIKE 'perawat%' AND deleted_at IS NULL LIMIT 1) AS perawat_uuid
      FROM ok_jadwal j
      JOIN ok_order o ON o.uuid = j.order_uuid AND o.faskes_uuid = j.faskes_uuid AND o.deleted_at IS NULL
      JOIN ok_laporan_operasi lp ON lp.jadwal_uuid = j.uuid AND lp.deleted_at IS NULL AND NULLIF(TRIM(lp.tindakan_dilakukan), '') IS NOT NULL
      JOIN ok_laporan_anestesi la ON la.jadwal_uuid = j.uuid AND la.deleted_at IS NULL
      LEFT JOIN LATERAL (SELECT nama_tindakan FROM ok_order_tindakan WHERE order_uuid = o.uuid AND deleted_at IS NULL ORDER BY urutan LIMIT 1) ot ON true
      JOIN LATERAL (
        SELECT uuid FROM rawat_jalans WHERE o.sumber = 'rajal' AND no_reg = o.no_reg AND faskes_uuid = o.faskes_uuid AND deleted_at IS NULL
          AND patient_uuid = o.patient_uuid AND rekam_medis_uuid IS NOT DISTINCT FROM o.rekam_medis_uuid
        UNION ALL SELECT uuid FROM rawat_inaps WHERE o.sumber = 'ranap' AND no_reg = o.no_reg AND faskes_uuid = o.faskes_uuid AND deleted_at IS NULL
          AND patient_uuid = o.patient_uuid AND rekam_medis_uuid IS NOT DISTINCT FROM o.rekam_medis_uuid
        UNION ALL SELECT uuid FROM instalasi_gawat_darurats WHERE o.sumber = 'igd' AND no_reg = o.no_reg AND faskes_uuid = o.faskes_uuid AND deleted_at IS NULL
          AND patient_uuid = o.patient_uuid AND rekam_medis_uuid IS NOT DISTINCT FROM o.rekam_medis_uuid
        LIMIT 1) k ON true
     WHERE j.faskes_uuid = $1 AND j.deleted_at IS NULL AND j.status <> 'batal' AND la.waktu_aldrete_masuk IS NOT NULL
       AND la.waktu_aldrete_masuk <= $2 AND la.jenis_anestesi NOT ILIKE '%lokal%' AND la.jenis_anestesi NOT ILIKE '%topikal%'
       AND NOT EXISTS (SELECT 1 FROM pacu_episode e WHERE e.faskes_uuid = j.faskes_uuid AND e.jadwal_operasi_uuid = j.uuid AND e.deleted_at IS NULL)
     ORDER BY la.waktu_aldrete_masuk`, [f, ctx.SEKARANG]);
  if (!jadwal.length) {
    riwayatProtokol();
    return `${protokolBaru ? 'protokol dibuat; ' : ''}tidak ada jadwal operasi yang memenuhi syarat (jalankan seeder kamar-operasi)`;
  }

  const unitCadangan = M.lokasi.find((l) => l.location_type === 'Room' && l.pelayanan === 'RI') ?? M.lokasi[0];
  const petugasCadangan = M.nakes[0] ?? M.dokter[0];

  // Status episode aktif (jadwal masih terjadwal = pasien belum kembali ke ruangan) menurut lama sejak Aldrete masuk.
  const urutanAktif = ['siap_dipindahkan', 'dalam_pemantauan', 'berada_di_pacu', 'menunggu_masuk'];
  const statusAktif = (tMasuk) => {
    const menit = (ctx.SEKARANG - tMasuk) / MENIT;
    return menit < 8 ? 'menunggu_masuk' : menit < 20 ? 'berada_di_pacu' : menit < 100 ? 'dalam_pemantauan' : 'siap_dipindahkan';
  };

  const hitung = { selesai: 0, aktif: 0, catatan: 0, biaya: 0, dilewati: 0 };
  for (const j of jadwal) {
    const selesai = j.status === 'selesai';
    // Sebagian kecil operasi selesai belum dibuatkan episode (bisa dicoba dari halaman PACU).
    if (selesai && ctx.peluang(0.1)) { hitung.dilewati++; continue; }
    let target = selesai ? 'selesai' : statusAktif(Number(j.t_masuk));
    const unitTujuan = j.lokasi_asal_uuid ?? unitCadangan?.uuid ?? null;
    if (!unitTujuan) continue;
    const penyerahMasuk = j.anestesi_uuid ?? petugasCadangan?.uuid;
    const pelaksana = j.perawat_uuid ?? penyerahMasuk;
    const tMasuk = Number(j.t_masuk);
    const tBuat = tMasuk - ctx.antara(10, 20) * MENIT;
    const tiba = tMasuk - ctx.antara(1, 3) * MENIT;
    const mulaiPantau = tiba + ctx.antara(2, 5) * MENIT;
    // Siap pindah: episode selesai mengikuti Aldrete keluar laporan anestesi; episode aktif beberapa menit lalu.
    let tSiap = selesai ? Number(j.t_keluar) : Math.min(ctx.SEKARANG - ctx.antara(4, 10) * MENIT, mulaiPantau + ctx.antara(75, 95) * MENIT);
    if (target === 'siap_dipindahkan' && tSiap < mulaiPantau + interval) target = 'dalam_pemantauan';
    if (target === 'dalam_pemantauan' && mulaiPantau > ctx.SEKARANG - 60) target = 'berada_di_pacu';
    const tahap = urutanAktif.slice().reverse().concat('selesai');
    const sampai = (s) => tahap.indexOf(target) >= tahap.indexOf(s);

    const pembuat = user();
    const e = ctx.tambah('pacu_episode', {
      jadwal_operasi_uuid: j.uuid, kunjungan_uuid: j.kunjungan_uuid, sumber: { rajal: 'RJ', ranap: 'RI', igd: 'IGD' }[j.sumber],
      protokol_uuid: protokol.uuid, protokol_snapshot: def, status: target, versi: 1, created_by: pembuat, updated_by: pembuat,
      waktu_tiba: null, waktu_mulai_pemantauan: null, waktu_siap_pindah: null, waktu_keluar: null, unit_tujuan_uuid: null,
      created_at: tBuat, updated_at: tBuat,
    });
    let versi = 1;
    let status = 'menunggu_masuk';
    const riwayat = (entitas, entitasUuid, aksi, sebelum, sesudah, t, oleh = pembuat, alasan = null) =>
      ctx.tambah('pacu_riwayat', { episode_uuid: e.uuid, entitas, entitas_uuid: entitasUuid, aksi, nilai_sebelum: sebelum, nilai_sesudah: sesudah, alasan, created_by: oleh, created_at: t });
    const perbarui = (aksi, data, t, oleh) => {
      const sebelum = { status, versi };
      versi++;
      status = data.status ?? status;
      Object.assign(e, data, { versi, updated_by: oleh, updated_at: t });
      riwayat('episode', e.uuid, aksi, sebelum, { status, versi, ...data }, t, oleh);
    };
    const catat = (jenis, t, data, oleh, versiCatatan = 1) => {
      const c = ctx.tambah('pacu_catatan', { episode_uuid: e.uuid, jenis, waktu_kejadian: t, data, versi: versiCatatan, created_by: oleh, updated_by: oleh, created_at: t, updated_at: t });
      riwayat('catatan', c.uuid, 'tambah', null, { jenis, waktu_kejadian: t }, t, oleh);
      hitung.catatan++;
      return c;
    };
    riwayat('episode', e.uuid, 'buat', null, { status: 'menunggu_masuk', versi: 1 }, tBuat);
    if (!sampai('berada_di_pacu')) { hitung.aktif++; continue; }

    // Kedatangan + serah terima masuk dari tim anestesi.
    const penerima = user();
    catat('serah_terima_masuk', tiba, {
      isi: {
        ringkasan_kondisi: `Pasca ${j.nama_tindakan ?? 'operasi'} dengan ${String(j.jenis_anestesi).toLowerCase()}. Aldrete masuk ${j.aldrete_masuk}, hemodinamik stabil.`,
        instruksi_lanjutan: 'Observasi tanda vital tiap 15 menit, oksigen bila SpO2 < 95%, analgetik sesuai instruksi anestesi.',
        obat_terakhir: ctx.pilih(['Ondansetron 4 mg IV', 'Ketorolak 30 mg IV', 'Fentanyl 50 mcg IV']),
        alat_terpasang: ctx.pilih(['Infus RL 20 tpm', 'Infus RL 20 tpm, kateter urine', 'Infus NaCl 0,9% 20 tpm']),
      },
      penyerah_uuid: penyerahMasuk, penerima, waktu_terima: tiba,
    }, penerima);
    perbarui('kedatangan', { waktu_tiba: tiba, status: 'berada_di_pacu' }, tiba, penerima);
    if (!sampai('dalam_pemantauan')) { hitung.aktif++; continue; }
    perbarui('mulai_pemantauan', { waktu_mulai_pemantauan: mulaiPantau, status: 'dalam_pemantauan' }, mulaiPantau, penerima);

    // Pemantauan berkala: skor Aldrete naik dari nilai masuk menuju ≥ 9 saat asesmen siap.
    const akhirPantau = sampai('siap_dipindahkan') ? tSiap - ctx.antara(1, 3) * MENIT : ctx.SEKARANG - ctx.antara(1, 5) * MENIT;
    const titik = [];
    for (let t = mulaiPantau; t < akhirPantau; t += interval) titik.push(t);
    if (sampai('siap_dipindahkan') && (!titik.length || akhirPantau - titik[titik.length - 1] > 5 * MENIT)) titik.push(akhirPantau);
    if (!titik.length) titik.push(mulaiPantau);
    const skorAwal = Math.min(Number(j.aldrete_masuk ?? 7), 8);
    const skorAkhir = sampai('siap_dipindahkan') ? Math.max(9, Number(j.aldrete_keluar ?? 9)) : Math.min(9, skorAwal + 1);
    const mual = ctx.peluang(0.2);
    const ga = /umum/i.test(j.jenis_anestesi);
    const tIntervensi = titik.length > 1 && (mual || ctx.peluang(0.3)) ? titik[0] + ctx.antara(3, 10) * MENIT : null;
    const belumSiap = selesai && titik.length >= 4 && ctx.peluang(0.15) ? titik[Math.floor(titik.length / 2)] + 2 * MENIT : null;
    titik.forEach((t, i) => {
      const fraksi = titik.length === 1 ? 0 : i / (titik.length - 1);
      const skor = Math.round(skorAwal + (skorAkhir - skorAwal) * fraksi);
      const komp = komponenAldrete(skor);
      const nyeri = Math.max(1, ctx.antara(3, 6) - i);
      catat('pemantauan', t, {
        nilai_parameter: nilaiDari(def.parameter, {
          tekanan_sistolik: ctx.antara(105, 138), tekanan_diastolik: ctx.antara(62, 88), nadi: ctx.antara(66, 102), laju_napas: ctx.antara(14, 22),
          spo2: ctx.antara(i === 0 ? 94 : 96, 100), suhu: ctx.desimal(35.9, 36.9, 1),
          kesadaran: komp.aldrete_kesadaran === '2' ? 'Sadar penuh' : komp.aldrete_kesadaran === '1' ? 'Bangun bila dipanggil' : 'Tidak berespons',
          jalan_napas: ga && i === 0 && ctx.peluang(0.4) ? 'Paten dengan alat bantu' : 'Paten tanpa alat bantu',
          skala_nyeri: nyeri, mual_muntah: mual && i <= 1 ? 'Mual' : 'Tidak ada', ...komp, skor_pemulihan: skor,
        }),
        catatan: i === 0 ? 'Pemantauan awal setelah serah terima' : null,
      }, penerima);
      perbarui('pemantauan', {}, t, penerima);
      if (tIntervensi && t < tIntervensi && (i === titik.length - 1 || titik[i + 1] > tIntervensi)) {
        const rincian = mual ? { nama: 'Ondansetron', dosis: '4', satuan: 'mg', rute: 'IV' }
          : ctx.peluang(0.5) ? { nama: 'Ketorolak', dosis: '30', satuan: 'mg', rute: 'IV' } : null;
        const data = rincian
          ? { jenis: 'obat', pelaksana_uuid: pelaksana, rincian, catatan: mual ? 'Pasien mengeluh mual' : 'Nyeri luka operasi skala 5' }
          : ctx.peluang(0.5)
            ? { jenis: 'tindakan', pelaksana_uuid: pelaksana, rincian: { nama: 'Oksigenasi nasal kanul 3 L/menit' }, catatan: 'SpO2 94% saat awal pemantauan' }
            : { jenis: 'bhp', pelaksana_uuid: pelaksana, rincian: { nama: 'Selimut penghangat (blanket warmer)' }, catatan: 'Pasien menggigil' };
        catat('intervensi', tIntervensi, data, penerima);
        perbarui('intervensi', {}, tIntervensi, penerima);
      }
      if (belumSiap && t < belumSiap && (i === titik.length - 1 || titik[i + 1] > belumSiap)) {
        catat('asesmen', belumSiap, {
          hasil_asesmen: `Skor Aldrete ${skor}, pasien masih mengantuk.`, keputusan: 'belum_siap', alasan: 'Skor pemulihan belum memenuhi ambang, lanjutkan pemantauan',
          hasil_kriteria: nilaiDari(def.kriteria_pindah, { skor_pemulihan_memenuhi: false, tanda_vital_stabil: true, jalan_napas_aman: true, nyeri_terkendali: true, mual_terkendali: !mual }),
          unit_tujuan_uuid: null,
        }, penerima);
        perbarui('asesmen', { status: 'dalam_pemantauan', waktu_siap_pindah: null, unit_tujuan_uuid: null }, belumSiap, penerima);
      }
    });
    if (!sampai('siap_dipindahkan')) { hitung.aktif++; continue; }

    // Asesmen siap pindah → serah terima keluar → diterima unit tujuan → selesai.
    const penilai = user();
    catat('asesmen', tSiap, {
      hasil_asesmen: `Skor Aldrete ${skorAkhir}, sadar penuh, tanda vital stabil, nyeri terkendali.`, keputusan: 'siap', alasan: 'Kriteria pindah terpenuhi',
      hasil_kriteria: nilaiDari(def.kriteria_pindah, { skor_pemulihan_memenuhi: true, tanda_vital_stabil: true, jalan_napas_aman: true, nyeri_terkendali: true, mual_terkendali: true }),
      unit_tujuan_uuid: unitTujuan,
    }, penilai);
    perbarui('asesmen', { status: 'siap_dipindahkan', waktu_siap_pindah: tSiap, unit_tujuan_uuid: unitTujuan }, tSiap, penilai);

    const tSerah = Math.min(tSiap + ctx.antara(2, 5) * MENIT, ctx.SEKARANG - 60);
    const kirimSerah = selesai || ctx.peluang(0.5);
    if (kirimSerah) {
      const diterima = selesai;
      const tTerima = tSerah + ctx.antara(2, 4) * MENIT;
      const penerimaUnit = userLain(penilai);
      const isi = {
        ringkasan_kondisi: `Pasca ${j.nama_tindakan ?? 'operasi'}, Aldrete ${skorAkhir}, sadar penuh, tanda vital stabil.`,
        instruksi_lanjutan: j.sumber === 'ranap' ? 'Lanjutkan observasi di ruang rawat, mobilisasi bertahap, diet sesuai instruksi operator.' : 'Observasi di ruang perawatan, edukasi perawatan luka, kontrol ke poli sesuai jadwal.',
        obat_terakhir: mual ? 'Ondansetron 4 mg IV' : 'Ketorolak 30 mg IV',
        alat_terpasang: 'Infus RL 20 tpm',
      };
      const c = catat('serah_terima_keluar', tSerah, {
        unit_tujuan_uuid: unitTujuan, isi: nilaiDari(def.format_serah_terima, isi), penyerah: penilai,
        ...(diterima ? { penerima: penerimaUnit, waktu_terima: tTerima } : {}),
      }, penilai, diterima ? 2 : 1);
      perbarui('serah_terima', {}, tSerah, penilai);
      if (diterima) {
        Object.assign(c, { updated_by: penerimaUnit, updated_at: tTerima });
        riwayat('catatan', c.uuid, 'terima', { versi: 1 }, { versi: 2, penerima: penerimaUnit, waktu_terima: tTerima }, tTerima, penerimaUnit);
        perbarui('terima_serah_terima', {}, tTerima, penerimaUnit);
        const tKeluar = tTerima + ctx.antara(1, 2) * MENIT;
        if (biaya) {
          const b = ctx.tambah('pacu_biaya', {
            episode_uuid: e.uuid, kunci_idempoten: `pacu:${e.uuid}:${biaya.layanan_uuid}`, konfigurasi_snapshot: biaya, status_kirim: 'tertunda',
            referensi_tagihan: null, jumlah_percobaan: 0, kesalahan_terakhir: null, versi: 1, created_by: penilai, created_at: tKeluar,
          });
          riwayat('biaya', b.uuid, 'buat_biaya', null, { status_kirim: 'tertunda', tarif: biaya.tarif }, tKeluar, penilai);
          hitung.biaya++;
        }
        perbarui('selesaikan', { status: 'selesai', waktu_keluar: tKeluar }, tKeluar, penilai);
      }
    }
    if (selesai) hitung.selesai++; else hitung.aktif++;
  }
  riwayatProtokol();
  return `${protokolBaru ? 'protokol pacu_umum aktif dibuat, ' : ''}${hitung.selesai} episode selesai, ${hitung.aktif} aktif, ${hitung.catatan} catatan, `
    + `${hitung.biaya} biaya tertunda, ${hitung.dilewati} operasi selesai tanpa episode`;
}

module.exports = { kode: 'pacu', nama: 'PACU', tahap: 1, modul: ['kamar_operasi'], fitur: ['pacu'], butuh: ['kamar-operasi'], seed };
