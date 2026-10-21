'use strict';

// Seeder demo modul CCU (rawat-inap-service). Episode CCU memakai tabel episode intensif bersama icu_perawatans
// (unit = 'ccu', tanpa layanan/template ICU), jadi seeder ini membuat episodenya sendiri — tidak bergantung pada seeder
// ICU — di kamar "Ruang ICCU" buatan seeder (lokasi Room + ruangan + bed + tarif), memakai fungsi bantu dari icu.cjs.
// Alur per episode: rawat_inaps → riwayat_ruangan (bangsal/IGD) → perpindahans approve ke ICCU → icu_perawatans +
// serah terima masuk → ccu_klinis (sindrom, onset/kontak medis pertama/tiba RS, Killip, EF, faktor risiko) →
// ccu_ekgs serial (EKG IGD sebelum masuk + harian) → ccu_penanda_jantungs serial (hs-troponin I, CK-MB, NT-proBNP,
// kalium) → ccu_skor_risikos (Killip + TIMI STEMI/NSTE) → ccu_intervensis (PCI primer/trombolisis door-to-balloon/
// needle, angiografi, kardioversi, pacu jantung, IABP, RJP) → flowsheet observasi & intake-output → serah terima keluar
// + perpindahan ke bangsal (hidup) atau kondisi_keluar 'meninggal'. Sebagian kecil episode masih aktif di bed ICCU.

const { bantu: B } = require('./icu.cjs');

const { JAM, HARI_DTK, batas } = B;
const MENIT = 60;

// Jumlah per segmen: [episode, aktif, bed].
const JUMLAH = { rs_a: [20, 3, 4], rs_b: [15, 2, 3], rs_c: [8, 1, 2], rs_d: [4, 1, 2] };

// Profil sindrom: bobot kejadian, keparahan, peluang meninggal dasar.
const SINDROM = {
  stemi: { bobot: 30, berat: [0.35, 0.9], mati: 0.1 },
  nstemi: { bobot: 24, berat: [0.25, 0.7], mati: 0.04 },
  angina_tidak_stabil: { bobot: 10, berat: [0.1, 0.35], mati: 0 },
  gagal_jantung_akut: { bobot: 16, berat: [0.35, 0.85], mati: 0.08 },
  aritmia: { bobot: 9, berat: [0.2, 0.6], mati: 0.02 },
  syok_kardiogenik: { bobot: 4, berat: [0.8, 1], mati: 0.45 },
  pasca_pci: { bobot: 5, berat: [0.1, 0.3], mati: 0 },
  emboli_paru: { bobot: 2, berat: [0.4, 0.8], mati: 0.08 },
};
const LOKASI_INFARK = [
  ['Anterior luas (V1–V6, I, aVL)', 'V1–V6, I, aVL', true], ['Anteroseptal (V1–V4)', 'V1–V4', true], ['Inferior (II, III, aVF)', 'II, III, aVF', false],
  ['Inferoposterior (II, III, aVF, V7–V9)', 'II, III, aVF, V7–V9', false], ['Lateral (I, aVL, V5–V6)', 'I, aVL, V5–V6', false],
];
const KILLIP_LABEL = {
  1: 'Kelas I — tanpa tanda gagal jantung', 2: 'Kelas II — ronki/S3, bendungan vena jugularis',
  3: 'Kelas III — edema paru akut', 4: 'Kelas IV — syok kardiogenik',
};
const kategoriTimi = (t) => (t <= 2 ? 'rendah' : t <= 4 ? 'sedang' : 'tinggi');

// QTc Bazett (sama dengan rawat-inap-service/src/services/ccu-skor.js).
const qtc = (qt, hr) => (qt && hr ? Math.round(qt / Math.sqrt(60 / hr)) : null);

// Satu rekaman EKG. irama menentukan laju & interval; QT fisiologis terhadap laju (QTc ±400–450 ms, sesekali memanjang).
function ekg(ctx, perawatan, waktu, { irama, laju, st = 'tidak_ada', leadSt = null, q = false, blok = null, interpretasi }) {
  const af = ['fibrilasi_atrium', 'flutter_atrium'].includes(irama);
  const qt = Math.round(410 * Math.sqrt(60 / laju) * ctx.desimal(0.93, ctx.peluang(0.08) ? 1.2 : 1.06, 3));
  return ctx.tambah('ccu_ekgs', {
    perawatan_uuid: perawatan.uuid, waktu_rekam: waktu, irama, laju_jantung: laju,
    interval_pr: af || irama === 'blok_av_3' || irama === 'irama_pacu' ? null : irama === 'blok_av_1' ? ctx.antara(220, 280) : ctx.antara(130, 190),
    durasi_qrs: blok === 'lbbb' || blok === 'rbbb' || irama === 'irama_pacu' ? ctx.antara(130, 165) : ctx.antara(78, 108),
    interval_qt: batas(qt, 100, 800), interval_qtc: qtc(batas(qt, 100, 800), laju),
    aksis: blok === 'lbbb' ? 'deviasi_kiri' : ctx.peluang(0.85) ? 'normal' : ctx.pilih(['deviasi_kiri', 'deviasi_kanan']),
    perubahan_st: st, lead_st: leadSt, gelombang_q: q, blok_cabang: blok ?? 'tidak_ada', interpretasi,
    sumber: 'manual', status_tinjauan: 'terverifikasi', pencatat: B.namaPencatat(ctx), created_at: waktu + ctx.antara(3, 20) * MENIT,
  });
}

// Penanda jantung serial (nilai sesuai sindrom & jam sejak onset).
function penanda(ctx, perawatan, waktu, jenis, nilai, { satuan, batasAtas, lab = true, catatan = null }) {
  return ctx.tambah('ccu_penanda_jantungs', {
    perawatan_uuid: perawatan.uuid, waktu_sampel: waktu, jenis, nilai, satuan, batas_atas: batasAtas,
    sumber: lab ? 'lab' : 'manual', referensi_lab: lab ? `LAB-DM-${ctx.yymmdd(waktu)}-${ctx.pad(ctx.nomor(), 4)}` : null,
    catatan, pencatat: B.namaPencatat(ctx), created_at: waktu + ctx.antara(45, 120) * MENIT,
  });
}

// hs-troponin I (ng/L) menurut jam sejak onset: naik cepat, puncak ±12–24 jam, turun perlahan.
const kurvaTroponin = (sindrom, jam, puncak) => {
  if (sindrom === 'angina_tidak_stabil' || sindrom === 'aritmia' || sindrom === 'pasca_pci') return Math.min(puncak, 4 + jam * 0.4);
  if (sindrom === 'gagal_jantung_akut' || sindrom === 'emboli_paru') return puncak * (0.6 + 0.4 * Math.min(1, jam / 24));
  const naik = Math.min(1, jam / 16);
  const turun = jam > 24 ? Math.exp(-(jam - 24) / 60) : 1;
  return Math.max(6, puncak * naik * naik * turun);
};

async function seed(ctx) {
  const [jumlah, aktif, jumlahBed] = JUMLAH[ctx.F.segmen] ?? [4, 1, 2];
  const ruang = await B.siapkanRuang(ctx, { kode: 'ICCU', nama: 'Ruang ICCU', jumlahBed, harga: 1150000 });
  const ambilPasien = await B.pemilihPasien(ctx);
  const bangsal = await B.bedBangsal(ctx);
  const lamaAcak = () => Math.round((Number(ctx.berbobot({ 1: 4, 2: 6, 3: 5, 4: 3, 5: 2, 7: 1 })) * 24 + ctx.antara(-6, 8)) * JAM);
  const jadwal = B.jadwalEpisode(ctx, ruang.beds.filter((b) => !b.patient_uuid), jumlah, ruang.baru ? aktif : 0, lamaAcak, 2.9 * HARI_DTK);
  const operator = ctx.M.dokter.length ? ctx.M.dokter : [{ name: 'dr. Kardiolog (Demo), Sp.JP' }];

  const hitung = { episode: 0, aktif: 0, meninggal: 0, ekg: 0, penanda: 0, intervensi: 0, observasi: 0 };
  for (const j of jadwal) {
    const sindrom = ctx.berbobot(Object.fromEntries(Object.entries(SINDROM).map(([k, v]) => [k, v.bobot])));
    const S = SINDROM[sindrom];
    const berat = ctx.desimal(S.berat[0], S.berat[1], 2);
    const selesai = j.keluar != null;
    const meninggal = selesai && ctx.peluang(S.mati * (berat > 0.7 ? 2 : 1));
    const kParah = (p) => batas(meninggal ? berat * (0.8 + 0.4 * p) : berat * (1 - (selesai ? 0.8 : 0.45) * p), 0.03, 1);
    const pasien = ambilPasien(!selesai);
    const dokter = ctx.pilihDokter();
    const umur = ctx.antara(sindrom === 'aritmia' ? 35 : 42, 82);

    // Garis waktu prarumah sakit & IGD: onset → kontak medis pertama → tiba RS → (reperfusi) → masuk CCU.
    const tiba = j.mulai - ctx.antara(60, sindrom === 'stemi' ? 240 : 600) * MENIT;
    const onset = tiba - ctx.antara(sindrom === 'stemi' ? 60 : 120, sindrom === 'stemi' ? 540 : 1800) * MENIT;
    const fmc = ctx.peluang(0.35) ? tiba - ctx.antara(15, 75) * MENIT : tiba; // sebagian dirujuk dari faskes lain/ambulans
    const killip = sindrom === 'syok_kardiogenik' ? 4 : sindrom === 'gagal_jantung_akut' ? Number(ctx.berbobot({ 2: 4, 3: 5, 4: 1 }))
      : Number(ctx.berbobot({ 1: 7, 2: 2, 3: berat > 0.6 ? 2 : 0.5 }));
    const infark = ['stemi', 'syok_kardiogenik'].includes(sindrom) ? ctx.pilih(LOKASI_INFARK) : null;
    const faktor = ctx.acakSebagian(['hipertensi', 'diabetes', 'dislipidemia', 'merokok', 'riwayat_keluarga', 'obesitas', 'ckd'], ctx.antara(1, 4));

    const { ri, pindahMasuk, pindahKeluar } = B.admisiIntensif(ctx, {
      unit: 'ccu', pasien, bangsal, bedBangsal: ctx.pilih(bangsal), bedIntensif: j.bed, masuk: j.mulai, keluar: j.keluar, meninggal, dokter,
      keluhan: ['gagal_jantung_akut', 'emboli_paru'].includes(sindrom) ? 'Sesak napas' : sindrom === 'aritmia' ? 'Berdebar-debar' : 'Nyeri dada',
    });
    const diagnosis = {
      stemi: `STEMI ${infark?.[0].split(' (')[0].toLowerCase() ?? ''}`.trim(), nstemi: 'NSTEMI', angina_tidak_stabil: 'Angina pektoris tidak stabil',
      gagal_jantung_akut: 'Gagal jantung akut dekompensasi (ADHF)', aritmia: 'Aritmia', syok_kardiogenik: 'Syok kardiogenik ec STEMI',
      pasca_pci: 'Observasi pasca PCI elektif', emboli_paru: 'Emboli paru akut',
    }[sindrom];
    const perawatan = ctx.tambah('icu_perawatans', {
      unit: 'ccu', rawat_inap_uuid: ri.uuid, perpindahan_masuk_uuid: pindahMasuk.uuid, perpindahan_keluar_uuid: pindahKeluar?.uuid ?? null,
      room_monitoring_uuid: j.bed.uuid, ruangan_uuid: ruang.uuid, diagnosis_ringkas: `${diagnosis}, Killip ${killip}`,
      status: selesai ? 'selesai' : 'aktif', kondisi_keluar: selesai ? (meninggal ? 'meninggal' : 'hidup') : null,
      waktu_masuk: j.mulai, waktu_keluar: j.keluar, layanan_kode: null, template_versi_uuid: null,
      dibuat_oleh: B.namaPencatat(ctx), created_at: j.mulai, updated_at: j.keluar ?? j.mulai,
    });
    hitung.episode++;
    if (!selesai) hitung.aktif++;
    if (meninggal) hitung.meninggal++;
    const akhir = j.keluar ?? ctx.SEKARANG;
    const dalamEpisode = (t) => batas(t, j.mulai - 72 * JAM + MENIT, akhir - 10 * MENIT);

    ctx.tambah('ccu_klinis', {
      perawatan_uuid: perawatan.uuid, sindrom, lokasi_infark: infark?.[0] ?? null, waktu_onset: onset, waktu_kontak_medis_pertama: fmc,
      waktu_tiba_rs: tiba, kelas_killip: killip,
      fraksi_ejeksi: ctx.peluang(0.8) ? ctx.desimal(sindrom === 'gagal_jantung_akut' || killip >= 3 ? 18 : 35, sindrom === 'angina_tidak_stabil' ? 65 : 55, 1) : null,
      faktor_risiko: faktor, catatan: ctx.peluang(0.3) ? ctx.pilih(['Riwayat PCI 2 tahun lalu', 'Perokok aktif 1 bungkus/hari', 'Tidak rutin minum obat hipertensi']) : null,
      diubah_oleh: B.namaDokterUser(ctx), created_at: j.mulai + ctx.antara(10, 60) * MENIT,
    });

    // Intervensi utama (menentukan waktu perbaikan EKG/irama).
    let reperfusi = null;
    const tindakan = (jenis, mulai, durasiMenit, hasil, komplikasi = null) => {
      const m = dalamEpisode(mulai);
      hitung.intervensi++;
      return ctx.tambah('ccu_intervensis', {
        perawatan_uuid: perawatan.uuid, jenis, waktu_mulai: m, waktu_selesai: durasiMenit ? Math.min(m + durasiMenit * MENIT, akhir) : null,
        operator: ctx.pilih(operator).name, hasil, komplikasi, catatan: null, pencatat: B.namaPencatat(ctx), created_at: m + 10 * MENIT,
      });
    };
    if (sindrom === 'stemi' || sindrom === 'syok_kardiogenik') {
      const jalur = ctx.berbobot({ pci: 76, lisis: 18, tidak: 6 });
      if (jalur === 'pci') {
        // Door-to-balloon sebagian besar ≤ 90 menit, sebagian terlambat.
        reperfusi = tiba + (ctx.peluang(0.72) ? ctx.antara(45, 90) : ctx.antara(91, 170)) * MENIT;
        tindakan('pci_primer', reperfusi, ctx.antara(40, 95), `Oklusi total ${infark?.[2] ? 'LAD proksimal' : 'RCA media'}, 1 stent DES, aliran TIMI 3`, ctx.peluang(0.08) ? 'No-reflow ringan, teratasi' : null);
      } else if (jalur === 'lisis') {
        reperfusi = tiba + ctx.antara(18, 55) * MENIT;
        tindakan('trombolisis', reperfusi, 60, ctx.peluang(0.75) ? 'Streptokinase 1,5 juta IU; resolusi ST > 50% pada 90 menit' : 'Streptokinase 1,5 juta IU; resolusi ST < 50%, rencana rescue PCI');
      }
      if (sindrom === 'syok_kardiogenik') tindakan('iabp', j.mulai + ctx.antara(20, 120) * MENIT, null, 'IABP 1:1 terpasang, augmentasi baik');
    } else if (sindrom === 'nstemi' && ctx.peluang(0.7)) {
      const m = tiba + ctx.antara(12, 48) * JAM;
      if (m < akhir - JAM) tindakan(ctx.peluang(0.65) ? 'pci' : 'angiografi_koroner', m, ctx.antara(30, 80), ctx.pilih(['Stenosis 90% LCx, 1 stent DES', 'Stenosis 80% LAD media, 1 stent DES', 'Penyakit 3 pembuluh, rencana konsul bedah CABG']));
    } else if (sindrom === 'pasca_pci') {
      tindakan('pci', j.mulai - ctx.antara(30, 120) * MENIT, ctx.antara(40, 80), 'PCI elektif LAD, 2 stent DES, hasil baik');
    }

    // EKG: IGD (sebelum masuk) lalu harian + pascatindakan.
    let ekgAwal;
    const lajuAwal = sindrom === 'aritmia' ? null : Math.round(batas(78 + 40 * berat + ctx.antara(-8, 8), 50, 150));
    if (sindrom === 'aritmia') {
      const ar = ctx.pilih([['fibrilasi_atrium', [120, 165]], ['svt', [170, 210]], ['blok_av_3', [32, 44]], ['vt', [150, 190]], ['flutter_atrium', [130, 150]]]);
      ekgAwal = { irama: ar[0], laju: ctx.antara(ar[1][0], ar[1][1]), interpretasi: { fibrilasi_atrium: 'Fibrilasi atrium respons ventrikel cepat', svt: 'Takikardia supraventrikular', blok_av_3: 'Blok AV total, escape junctional', vt: 'Takikardia ventrikel monomorfik', flutter_atrium: 'Atrial flutter 2:1' }[ar[0]] };
      if (ar[0] === 'blok_av_3') tindakan('pacu_jantung_sementara', j.mulai + ctx.antara(15, 90) * MENIT, ctx.antara(30, 60), 'TPM via vena femoralis, capture baik, rate 70');
      else if (ar[0] === 'vt') tindakan(ctx.peluang(0.5) ? 'kardioversi' : 'defibrilasi', tiba + ctx.antara(10, 40) * MENIT, 10, 'Kardioversi tersinkronisasi 150 J, kembali irama sinus');
      else if (ctx.peluang(0.5)) tindakan('kardioversi', j.mulai + ctx.antara(2, 20) * JAM, 15, 'Kardioversi tersinkronisasi 100 J, kembali irama sinus');
    } else if (sindrom === 'stemi' || sindrom === 'syok_kardiogenik') {
      ekgAwal = { irama: lajuAwal > 100 ? 'sinus_takikardia' : 'sinus', laju: lajuAwal, st: 'elevasi', leadSt: infark[1], q: ctx.peluang(0.4),
        interpretasi: `Elevasi ST ${infark[1]}, sesuai STEMI ${infark[0].split(' (')[0].toLowerCase()}` };
    } else if (sindrom === 'nstemi' || sindrom === 'angina_tidak_stabil') {
      const depresi = sindrom === 'nstemi' ? ctx.peluang(0.75) : ctx.peluang(0.4);
      ekgAwal = { irama: 'sinus', laju: lajuAwal, st: depresi ? 'depresi' : 'tidak_ada', leadSt: depresi ? ctx.pilih(['V4–V6', 'I, aVL, V5–V6', 'II, III, aVF']) : null,
        interpretasi: depresi ? 'Depresi ST horizontal, iskemia subendokardial' : 'Irama sinus, tidak ada perubahan ST bermakna' };
    } else if (sindrom === 'gagal_jantung_akut') {
      const af = ctx.peluang(0.35);
      ekgAwal = { irama: af ? 'fibrilasi_atrium' : 'sinus_takikardia', laju: af ? ctx.antara(105, 140) : Math.max(101, lajuAwal), blok: ctx.peluang(0.2) ? 'lbbb' : null,
        interpretasi: af ? 'Fibrilasi atrium respons cepat, LVH' : 'Sinus takikardia, LVH dengan strain' };
    } else if (sindrom === 'emboli_paru') {
      ekgAwal = { irama: 'sinus_takikardia', laju: ctx.antara(105, 130), blok: ctx.peluang(0.4) ? 'rbbb' : null, interpretasi: 'Sinus takikardia, pola S1Q3T3' };
    } else {
      ekgAwal = { irama: 'sinus', laju: lajuAwal, interpretasi: 'Irama sinus normal, tidak ada perubahan ST akut' };
    }
    ekg(ctx, perawatan, dalamEpisode(tiba + ctx.antara(4, 12) * MENIT), ekgAwal);
    hitung.ekg++;
    const reperfusiBerhasil = reperfusi != null;
    for (let t = Math.max(j.mulai + ctx.antara(1, 3) * JAM, (reperfusi ?? 0) + 90 * MENIT), ke = 0; t < akhir - 20 * MENIT && ke < 6; t += HARI_DTK * ctx.desimal(0.8, 1.1, 2), ke++) {
      const p = (t - j.mulai) / Math.max(JAM, akhir - j.mulai);
      const k = kParah(p);
      const laju = Math.round(batas(72 + 35 * k + ctx.antara(-6, 6), 52, 140));
      let data;
      if (meninggal && p > 0.9) data = { irama: ctx.pilih(['vt', 'vf']), laju: ctx.antara(170, 230), interpretasi: 'Takiaritmia ventrikel menjelang henti jantung' };
      else if (sindrom === 'aritmia') {
        const terkontrol = ekgAwal.irama === 'blok_av_3' ? { irama: ke < 1 ? 'irama_pacu' : 'sinus', laju: ke < 1 ? 70 : laju, interpretasi: ke < 1 ? 'Irama pacu ventrikel, capture 100%' : 'Konduksi AV pulih, irama sinus' }
          : { irama: ctx.peluang(0.7) ? 'sinus' : ekgAwal.irama === 'fibrilasi_atrium' ? 'fibrilasi_atrium' : 'sinus', laju: Math.min(laju, 105), interpretasi: 'Irama terkontrol pascaterapi' };
        data = terkontrol;
      } else if (sindrom === 'stemi' || sindrom === 'syok_kardiogenik') {
        data = { irama: laju > 100 ? 'sinus_takikardia' : 'sinus', laju, st: reperfusiBerhasil && ke > 0 ? 'tidak_ada' : 'elevasi', leadSt: reperfusiBerhasil && ke > 0 ? null : infark[1],
          q: ke > 0 || ekgAwal.q, interpretasi: reperfusiBerhasil ? (ke > 0 ? `Resolusi ST, gelombang Q patologis ${infark[1]}` : `Resolusi ST > 50% pascareperfusi`) : `Elevasi ST persisten ${infark[1]}, evolusi infark` };
      } else if (sindrom === 'nstemi') {
        data = { irama: 'sinus', laju, st: ke === 0 && ekgAwal.st === 'depresi' ? 'depresi' : 'tidak_ada', leadSt: ke === 0 ? ekgAwal.leadSt : null, interpretasi: ke === 0 ? 'Depresi ST menetap' : 'Inversi gelombang T, ST kembali isoelektrik' };
      } else {
        data = { irama: ekgAwal.irama === 'fibrilasi_atrium' && ctx.peluang(0.6) ? 'fibrilasi_atrium' : laju > 100 ? 'sinus_takikardia' : 'sinus', laju, blok: ekgAwal.blok ?? null, interpretasi: 'EKG evaluasi harian, tidak ada iskemia akut baru' };
      }
      ekg(ctx, perawatan, t, data);
      hitung.ekg++;
    }

    // Penanda jantung: troponin & CK-MB serial (0, 3, 6 jam lalu harian), NT-proBNP & kalium saat masuk.
    const puncakTrop = { stemi: ctx.antara(8000, 45000), syok_kardiogenik: ctx.antara(20000, 60000), nstemi: ctx.antara(250, 3500),
      gagal_jantung_akut: ctx.antara(25, 90), emboli_paru: ctx.antara(30, 160) }[sindrom] ?? ctx.antara(4, 18);
    const jamSampel = [0, 3, 6, 24, 48, 72];
    const t0 = tiba + ctx.antara(10, 25) * MENIT;
    for (const jam of jamSampel) {
      const t = t0 + jam * JAM + ctx.antara(-10, 20) * MENIT;
      if (t > akhir - 15 * MENIT) break;
      if (jam > 6 && !['stemi', 'nstemi', 'syok_kardiogenik'].includes(sindrom)) break;
      const jamOnset = (t - onset) / JAM;
      const trop = Math.round(kurvaTroponin(sindrom, jamOnset, puncakTrop) * ctx.desimal(0.9, 1.1, 2));
      penanda(ctx, perawatan, dalamEpisode(t), 'hs_troponin_i', trop, { satuan: 'ng/L', batasAtas: 26, catatan: jam === 0 ? 'Sampel IGD (0 jam)' : null });
      hitung.penanda++;
      if (['stemi', 'nstemi', 'syok_kardiogenik'].includes(sindrom) && jam <= 24) {
        const ckmb = Math.round(batas(12 + (sindrom === 'nstemi' ? 50 : 260) * Math.min(1, jamOnset / 18) * ctx.desimal(0.7, 1.2, 2), 5, 450));
        penanda(ctx, perawatan, dalamEpisode(t), 'ck_mb', ckmb, { satuan: 'U/L', batasAtas: 25 });
        hitung.penanda++;
      }
    }
    if (['gagal_jantung_akut', 'syok_kardiogenik', 'stemi', 'emboli_paru'].includes(sindrom) || ctx.peluang(0.3)) {
      const bnp = sindrom === 'gagal_jantung_akut' ? ctx.antara(2500, 18000) : ctx.antara(150, 2500);
      penanda(ctx, perawatan, dalamEpisode(t0 + 5 * MENIT), 'nt_probnp', bnp, { satuan: 'pg/mL', batasAtas: 300 });
      hitung.penanda++;
    }
    penanda(ctx, perawatan, dalamEpisode(t0 + 5 * MENIT), 'kalium', ctx.desimal(sindrom === 'aritmia' ? 3.1 : 3.4, 5.3, 1), { satuan: 'mmol/L', batasAtas: 5 });
    hitung.penanda++;
    if (sindrom === 'emboli_paru') {
      penanda(ctx, perawatan, dalamEpisode(t0 + 5 * MENIT), 'd_dimer', ctx.antara(1500, 9000), { satuan: 'ng/mL FEU', batasAtas: 500 });
      hitung.penanda++;
    }

    // Skor risiko saat masuk (Killip semua; TIMI STEMI / TIMI UA-NSTEMI sesuai sindrom).
    const waktuSkor = j.mulai + ctx.antara(20, 90) * MENIT;
    ctx.tambah('ccu_skor_risikos', { perawatan_uuid: perawatan.uuid, waktu_penilaian: waktuSkor, jenis: 'killip', parameter: { kelas: killip },
      total_skor: killip, kategori: KILLIP_LABEL[killip], lengkap: true, penilai: B.namaDokterUser(ctx), catatan: null, created_at: waktuSkor + 5 * MENIT });
    if (sindrom === 'stemi' || sindrom === 'syok_kardiogenik') {
      const p = { umur, dm_ht_angina: faktor.includes('diabetes') || faktor.includes('hipertensi'), sistolik: Math.round(batas(130 - 50 * berat + ctx.antara(-10, 10), 70, 190)),
        laju_jantung: ekgAwal.laju, killip, berat_badan: ctx.antara(52, 92), ste_anterior_lbbb: !!infark?.[2],
        waktu_terapi_jam: Number(((reperfusi ?? tiba + 6 * JAM) - onset) / JAM).toFixed(1) * 1 };
      let total = 0;
      if (p.umur >= 75) total += 3; else if (p.umur >= 65) total += 2;
      if (p.dm_ht_angina) total += 1;
      if (p.sistolik < 100) total += 3;
      if (p.laju_jantung > 100) total += 2;
      if (p.killip >= 2) total += 2;
      if (p.berat_badan < 67) total += 1;
      if (p.ste_anterior_lbbb) total += 1;
      if (p.waktu_terapi_jam > 4) total += 1;
      ctx.tambah('ccu_skor_risikos', { perawatan_uuid: perawatan.uuid, waktu_penilaian: waktuSkor, jenis: 'timi_stemi', parameter: p, total_skor: total,
        kategori: kategoriTimi(total), lengkap: true, penilai: B.namaDokterUser(ctx), catatan: null, created_at: waktuSkor + 6 * MENIT });
    } else if (sindrom === 'nstemi' || sindrom === 'angina_tidak_stabil') {
      const p = { usia_lanjut: umur >= 65, tiga_faktor_risiko: faktor.filter((f) => f !== 'obesitas' && f !== 'ckd').length >= 3, pjk_diketahui: ctx.peluang(0.35),
        aspirin_seminggu: ctx.peluang(0.3), angina_berat: ctx.peluang(0.5), deviasi_st: ekgAwal.st === 'depresi', penanda_positif: sindrom === 'nstemi' };
      const total = Object.values(p).filter(Boolean).length;
      ctx.tambah('ccu_skor_risikos', { perawatan_uuid: perawatan.uuid, waktu_penilaian: waktuSkor, jenis: 'timi_nste', parameter: p, total_skor: total,
        kategori: kategoriTimi(total), lengkap: true, penilai: B.namaDokterUser(ctx), catatan: null, created_at: waktuSkor + 6 * MENIT });
    }
    if (meninggal) tindakan('rjp', j.keluar - ctx.antara(25, 45) * MENIT, ctx.antara(20, 40), 'RJP siklus 30:2, adrenalin 1 mg tiap 3–5 menit, ROSC tidak tercapai', 'Meninggal dunia');

    B.serahTerima(ctx, perawatan, pindahMasuk.uuid, 'masuk', j.mulai, {
      kriteria: ['stemi', 'nstemi', 'syok_kardiogenik'].includes(sindrom) ? 'Sindrom koroner akut, pemantauan irama & hemodinamik ketat' : 'Kondisi kardiak akut perlu pemantauan EKG kontinu',
      kondisi: `Killip ${killip}, TD ${ctx.antara(85, 150)}/${ctx.antara(50, 95)} mmHg, nadi ${ekgAwal.laju} x/menit, SpO2 ${ctx.antara(90, 98)}%`,
      tindakan: reperfusi ? 'Reperfusi telah dilakukan (lihat Intervensi Kardiak)' : 'Terapi medikamentosa',
      terapi_berjalan: ctx.pilih(['DAPT aspirin 1x80 mg + tikagrelor 2x90 mg, enoksaparin 2x0,6 mL SC', 'Furosemid drip 5 mg/jam, ISDN 3x5 mg', 'Amiodaron drip 1 mg/menit', 'Heparin drip sesuai aPTT']),
      alergi_relevan: ctx.peluang(0.1) ? 'Alergi kontras iodin (premedikasi)' : 'Tidak ada alergi yang diketahui',
      akses_alat: ['IV line', reperfusi ? 'Sheath radial kanan dilepas, TR band' : null, sindrom === 'syok_kardiogenik' ? 'IABP femoral kiri' : null, 'Monitor EKG kontinu'].filter(Boolean).join(', '),
      tindak_lanjut: 'Pantau irama, keluhan nyeri dada, troponin serial, balans cairan',
    });

    // Flowsheet observasi (tanpa ventilator kecuali syok berat) & intake-output.
    const waktuObs = B.waktuObservasi(ctx, j.mulai, j.keluar);
    for (const w of waktuObs) {
      const p = (w - j.mulai) / Math.max(JAM, akhir - j.mulai);
      const k = kParah(p);
      const vital = B.tandaVital(ctx, k, { paru: sindrom === 'gagal_jantung_akut' || sindrom === 'emboli_paru', hipertensi: faktor.includes('hipertensi') && k < 0.5 });
      const vent = sindrom === 'syok_kardiogenik' && k > 0.7;
      const drip = [];
      if (['stemi', 'nstemi', 'angina_tidak_stabil'].includes(sindrom) && p < 0.5) drip.push({ nama: 'Nitrogliserin', laju: String(ctx.antara(5, 20) * 5), satuan: 'mcg/menit' });
      if (sindrom === 'gagal_jantung_akut' && p < 0.6) drip.push({ nama: 'Furosemid', laju: String(ctx.pilih([5, 10, 20])), satuan: 'mg/jam' });
      if ((sindrom === 'syok_kardiogenik' || killip >= 3) && k > 0.5) drip.push({ nama: 'Dobutamin', laju: String(ctx.antara(3, 10)), satuan: 'mcg/kg/menit' });
      if (sindrom === 'syok_kardiogenik' && k > 0.6) drip.push({ nama: 'Norepinefrin', laju: String(ctx.desimal(0.05, 0.3, 2)), satuan: 'mcg/kg/menit' });
      if (sindrom === 'aritmia' && p < 0.4 && ekgAwal.irama !== 'blok_av_3') drip.push({ nama: 'Amiodaron', laju: String(p < 0.15 ? 1 : 0.5), satuan: 'mg/menit' });
      if (sindrom === 'emboli_paru') drip.push({ nama: 'Heparin', laju: String(ctx.antara(10, 18) * 100), satuan: 'unit/jam' });
      const gE = vent ? ctx.antara(1, 2) : 4;
      const gV = vent ? 1 : k > 0.8 ? 4 : 5;
      const gM = vent ? ctx.antara(4, 5) : 6;
      ctx.tambah('icu_observasis', {
        perawatan_uuid: perawatan.uuid, waktu_pengukuran: w, ...vital, laju_napas: vent ? null : vital.laju_napas,
        gcs_e: gE, gcs_v: gV, gcs_m: gM, gcs_total: gE + gV + gM, skala_nyeri: vent ? null : Math.round(batas(7 * k * (['stemi', 'nstemi', 'angina_tidak_stabil'].includes(sindrom) ? 1 : 0.4) + ctx.antara(-1, 1), 0, 10)),
        ventilator_terpasang: vent, ventilator_mode: vent ? 'AC/VC' : null, ventilator_fio2: vent ? ctx.antara(50, 80) : null, ventilator_peep: vent ? ctx.antara(6, 10) : null,
        ventilator_tidal_volume: vent ? ctx.antara(40, 50) * 10 : null, ventilator_laju_napas: vent ? ctx.antara(14, 20) : null, obat_drip: drip, sumber: 'manual',
        catatan: ctx.peluang(0.1) ? ctx.pilih(['Nyeri dada berkurang', 'Ronki basah basal berkurang', 'Akses radial: tidak ada hematoma', 'Lapor DPJP: ekstrasistol ventrikel sering']) : null,
        pencatat: B.namaPencatat(ctx), dikoreksi: false, revisi: 1, template_versi_uuid: null, parameter_tambahan: [], created_at: w + ctx.antara(1, 15) * MENIT,
      });
      hitung.observasi++;
    }
    B.intakeOutput(ctx, perawatan, { masuk: j.mulai, keluar: j.keluar, kParah, ventilasi: false, bedah: false });

    if (pindahKeluar) {
      B.serahTerima(ctx, perawatan, pindahKeluar.uuid, 'keluar', j.keluar, {
        kriteria: 'Bebas nyeri dada > 24 jam, hemodinamik & irama stabil tanpa obat intravena',
        kondisi: `Sadar, TD ${ctx.antara(105, 135)}/${ctx.antara(65, 85)} mmHg, nadi ${ctx.antara(62, 90)} x/menit irama sinus`,
        terapi_berjalan: ctx.pilih(['DAPT, atorvastatin 1x40 mg, bisoprolol 1x2,5 mg, ramipril 1x2,5 mg', 'Furosemid 1x40 mg oral, spironolakton 1x25 mg', 'Amiodaron 1x200 mg oral, antikoagulan oral']),
        akses_alat: 'IV line perifer', tindak_lanjut: 'Mobilisasi bertahap (rehabilitasi jantung fase I), edukasi faktor risiko, kontrol poli jantung',
      });
    }
  }
  return `${ruang.beds.length} bed ICCU, ${hitung.episode} episode (${hitung.aktif} aktif, ${hitung.meninggal} meninggal), ${hitung.ekg} EKG, ${hitung.penanda} penanda, ${hitung.intervensi} intervensi, ${hitung.observasi} observasi`;
}

module.exports = { kode: 'ccu', nama: 'CCU (Coronary Care Unit)', tahap: 1, modul: ['ccu'], seed };
