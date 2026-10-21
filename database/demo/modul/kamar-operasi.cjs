'use strict';

// Kamar Operasi: master ruang OK (ok_ruang, bila faskes belum punya) + order operasi (ok_order, ok_order_tindakan) dari
// kunjungan asal fiktif (rawat inap pulang lewat ctx.rawatInap untuk operasi > 4 hari lalu; kunjungan rawat jalan Poli
// selesai untuk operasi baru/akan datang), penjadwalan & tim (ok_jadwal, ok_jadwal_tim), persetujuan tindakan/anestesi
// (inform_consents), pra-operasi, checklist WHO (sign_in/time_out/sign_out), laporan operasi & anestesi.
// Alur status (sama dengan penunjang-service/src/kamar-operasi):
//   order menunggu_jadwal ⇄ perlu_klarifikasi → terjadwal (saat jadwal dibuat; tetap terjadwal setelah jadwal selesai)
//   jadwal terjadwal → selesai (laporan anestesi berisi Aldrete keluar + serah terima) | batal (order kembali menunggu_jadwal)
//   laporan operasi draft → final (setelah checklist lengkap; tagihan_menunggu = komponen tanpa tarif OK-*)
// Segmen waktu: operasi selesai tersebar N hari terakhir, beberapa operasi hari ini masih "terjadwal" (pasien di
// pemulihan — sumber episode PACU), jadwal sisa hari ini & 1–7 hari ke depan, jadwal batal, order menunggu/klarifikasi.
// Semua waktu operasi berada pada satu linimasa tanpa tumpang tindih sehingga tidak ada bentrok ruang/tim.
const crypto = require('crypto');

const MENIT = 60;
const JAM = 3600;
const JUMLAH = { rs_a: 60, rs_b: 45, rs_c: 30, rs_d: 15 };

// Ruang OK bawaan bila faskes belum memiliki master ruang OK.
const RUANG = [
  { kode: 'OK-1', nama: 'Kamar Operasi 1 (Bedah Umum)' },
  { kode: 'OK-2', nama: 'Kamar Operasi 2 (Obstetri & Ginekologi)' },
  { kode: 'OK-3', nama: 'Kamar Operasi 3 (Mata & THT)' },
  { kode: 'OK-4', nama: 'Kamar Operasi Cito' },
];
const JUMLAH_RUANG = { rs_a: 4, rs_b: 3, rs_c: 2, rs_d: 1 };

const GA = 'Anestesi umum (GA-ETT)';
const LMA = 'Anestesi umum (GA-LMA)';
const SAB = 'Anestesi spinal (SAB)';
const SEDASI = 'Sedasi intravena';
const LOKAL = 'Anestesi lokal';
const TOPIKAL = 'Anestesi topikal + blok peribulbar';
const TIVA = 'Anestesi umum (TIVA)';

// Katalog tindakan per spesialis operator (kode ICD-9-CM & ICD-10 tersedia di referensi nasional).
// durasi menit [min, maks], perdarahan mL [min, maks], cito = peluang order cito, bobot = frekuensi relatif.
const TINDAKAN = [
  { sp: 'Bedah', icd9: '47.09', nama: 'Apendektomi terbuka', kelas: 'sedang', dx: ['K35.8', 'Apendisitis akut'], durasi: [60, 90], darah: [20, 80], cito: 0.7, bobot: 5, anestesi: [SAB, GA],
    langkah: 'Insisi McBurney, identifikasi apendiks, ligasi mesoapendiks dan basis apendiks, apendektomi, kontrol perdarahan, luka ditutup lapis demi lapis.',
    temuan: ['Apendiks hiperemis dan edema, tanpa perforasi', 'Apendiks gangren di ujung distal, tanpa perforasi', 'Apendiks retrosekal meradang, cairan serosa minimal'] },
  { sp: 'Bedah', icd9: '51.23', nama: 'Kolesistektomi laparoskopik', kelas: 'besar', dx: ['K80.2', 'Kolelitiasis'], durasi: [90, 150], darah: [30, 150], cito: 0, bobot: 3, anestesi: [GA],
    langkah: 'Pneumoperitoneum, pemasangan 4 trokar, diseksi segitiga Calot, klipping dan pemotongan duktus serta arteri sistikus, kolesistektomi, evakuasi kandung empedu.',
    temuan: ['Kandung empedu berdinding tebal berisi batu multipel', 'Batu soliter ±2 cm, dinding kandung empedu tidak menebal'] },
  { sp: 'Bedah', icd9: '53.00', nama: 'Herniorafi inguinal unilateral', kelas: 'sedang', dx: ['K40.9', 'Hernia inguinalis lateralis'], durasi: [60, 90], darah: [10, 50], cito: 0.1, bobot: 4, anestesi: [SAB],
    langkah: 'Insisi inguinal, identifikasi dan ligasi tinggi kantong hernia, repair dinding posterior kanalis inguinalis, luka ditutup lapis demi lapis.',
    temuan: ['Kantong hernia indirek berisi omentum, dapat direposisi', 'Kantong hernia indirek berisi usus halus vital'] },
  { sp: 'Bedah', icd9: '86.3', nama: 'Eksisi lipoma', kelas: 'kecil', dx: ['D17.9', 'Lipoma'], durasi: [30, 45], darah: [5, 20], cito: 0, bobot: 3, anestesi: [LOKAL, SEDASI],
    langkah: 'Insisi elips di atas massa, eksisi massa berkapsul secara utuh, hemostasis, jahit kulit.',
    temuan: ['Massa lemak berkapsul ±4 cm, batas tegas', 'Massa lemak lobulated ±6 cm di subkutis'] },
  { sp: 'Bedah', icd9: '85.21', nama: 'Eksisi tumor payudara', kelas: 'kecil', dx: ['D24', 'Fibroadenoma mamae'], durasi: [30, 60], darah: [10, 30], cito: 0, bobot: 2, anestesi: [LMA],
    langkah: 'Insisi sirkumareolar, eksisi massa beserta kapsul, hemostasis, jahit subkutikuler.',
    temuan: ['Massa kenyal berkapsul ±2 cm, mobile', 'Massa padat ±3 cm, batas tegas'] },
  { sp: 'Bedah', icd9: '49.46', nama: 'Hemoroidektomi', kelas: 'sedang', dx: ['I84.9', 'Hemoroid interna derajat III'], durasi: [45, 75], darah: [20, 60], cito: 0, bobot: 2, anestesi: [SAB],
    langkah: 'Posisi litotomi, identifikasi pleksus hemoroid, ligasi pedikel dan eksisi hemoroid, hemostasis.',
    temuan: ['Hemoroid interna pada posisi jam 3, 7, dan 11', 'Hemoroid interna prolaps pada posisi jam 7 dan 11'] },
  { sp: 'Bedah', icd9: '54.11', nama: 'Laparotomi eksplorasi', kelas: 'besar', dx: ['K56.6', 'Ileus obstruktif'], durasi: [120, 180], darah: [100, 400], cito: 0.9, bobot: 2, anestesi: [GA],
    langkah: 'Insisi midline, eksplorasi rongga abdomen, adhesiolisis dan dekompresi usus, cuci rongga abdomen, pasang drain, tutup lapis demi lapis.',
    temuan: ['Adhesi pita menyebabkan obstruksi ileum terminal, usus vital', 'Dilatasi usus halus proksimal akibat bridging adhesi'] },
  { sp: 'Bedah', icd9: '86.22', nama: 'Debridemen luka', kelas: 'kecil', dx: ['L02.4', 'Abses kutan ekstremitas'], durasi: [30, 45], darah: [10, 30], cito: 0.5, bobot: 2, anestesi: [SEDASI, SAB],
    langkah: 'Insisi dan drainase abses, debridemen jaringan nekrotik, irigasi NaCl 0,9%, luka dirawat terbuka dengan kasa.',
    temuan: ['Pus ±20 mL, jaringan nekrotik di dasar luka', 'Abses multilokular dengan pus ±35 mL'] },
  { sp: 'Kandungan', icd9: '74.1', nama: 'Seksio sesarea', kelas: 'besar', dx: ['O34.2', 'Bekas seksio sesarea'], dxAlt: [['O32.1', 'Presentasi bokong']], durasi: [60, 90], darah: [300, 700], cito: 0.5, bobot: 6, anestesi: [SAB],
    langkah: 'Insisi Pfannenstiel, insisi segmen bawah rahim, lahirkan bayi dan plasenta, jahit uterus dua lapis, tutup dinding abdomen lapis demi lapis.',
    temuan: ['Lahir bayi tunggal hidup, plasenta lahir lengkap', 'Lahir bayi tunggal hidup, air ketuban jernih, plasenta lengkap'] },
  { sp: 'Kandungan', icd9: '69.02', nama: 'Kuretase pascaabortus', kelas: 'kecil', dx: ['O03.4', 'Abortus inkomplet'], durasi: [20, 30], darah: [50, 150], cito: 0.6, bobot: 3, anestesi: [SEDASI, TIVA],
    langkah: 'Posisi litotomi, pasang spekulum, dilatasi serviks, kuretase sisa konsepsi hingga bersih, evaluasi perdarahan.',
    temuan: ['Sisa konsepsi ±20 gram, perdarahan minimal setelah kuretase', 'Jaringan sisa konsepsi ±15 gram'] },
  { sp: 'Kandungan', icd9: '68.49', nama: 'Histerektomi total abdominal', kelas: 'besar', dx: ['D25.9', 'Mioma uteri'], durasi: [120, 180], darah: [200, 500], cito: 0, bobot: 1, anestesi: [GA],
    langkah: 'Insisi midline, klem-potong-ikat ligamentum, histerektomi total, tutup puncak vagina, tutup dinding abdomen lapis demi lapis.',
    temuan: ['Uterus membesar sebesar kehamilan 16 minggu, mioma multipel', 'Mioma intramural ±8 cm di korpus uteri'] },
  { sp: 'Kandungan', icd9: '65.29', nama: 'Kistektomi ovarium', kelas: 'sedang', dx: ['N83.2', 'Kista ovarium'], durasi: [60, 120], darah: [50, 150], cito: 0.1, bobot: 2, anestesi: [GA, SAB],
    langkah: 'Insisi Pfannenstiel, identifikasi kista ovarium, enukleasi kista dengan preservasi jaringan ovarium, hemostasis, tutup lapis demi lapis.',
    temuan: ['Kista ovarium kanan ±7 cm berisi cairan serosa', 'Kista ovarium kiri ±6 cm berdinding tipis'] },
  { sp: 'THT', icd9: '28.2', nama: 'Tonsilektomi', kelas: 'sedang', dx: ['J35.0', 'Tonsilitis kronik'], durasi: [45, 60], darah: [20, 80], cito: 0, bobot: 3, anestesi: [GA],
    langkah: 'Pasang mouth gag, diseksi tonsil kanan dan kiri dari fossa tonsilaris, hemostasis dengan ligasi dan kauter bipolar.',
    temuan: ['Tonsil T3-T3 kriptus melebar, detritus positif', 'Tonsil T2-T3 hiperemis dengan kriptus melebar'] },
  { sp: 'THT', icd9: '28.3', nama: 'Adenotonsilektomi', kelas: 'sedang', dx: ['J35.3', 'Hipertrofi adenotonsil'], durasi: [45, 75], darah: [30, 100], cito: 0, bobot: 2, anestesi: [GA],
    langkah: 'Pasang mouth gag, adenoidektomi dengan kuret, tonsilektomi bilateral metode diseksi, hemostasis.',
    temuan: ['Adenoid menutup 2/3 koana, tonsil T3-T3', 'Hipertrofi adenoid dan tonsil T3-T4'] },
  { sp: 'THT', icd9: '21.88', nama: 'Septoplasti', kelas: 'sedang', dx: ['J34.2', 'Deviasi septum nasi'], durasi: [60, 90], darah: [30, 100], cito: 0, bobot: 1, anestesi: [GA],
    langkah: 'Insisi hemitransfiksi, elevasi mukoperikondrium, reseksi bagian septum yang deviasi, reposisi, pasang tampon hidung.',
    temuan: ['Deviasi septum bentuk S dengan spina ke kiri', 'Deviasi septum ke kanan menyumbat meatus medius'] },
  { sp: 'Mata', icd9: '13.41', nama: 'Fakoemulsifikasi + pemasangan IOL', kelas: 'sedang', dx: ['H25.9', 'Katarak senilis'], durasi: [30, 45], darah: [0, 5], cito: 0, bobot: 4, anestesi: [TOPIKAL],
    langkah: 'Insisi kornea, kapsuloreksis, fakoemulsifikasi nukleus, aspirasi korteks, implantasi IOL di kantong kapsul.',
    temuan: ['Katarak nuklear grade 3, kapsul posterior intak', 'Katarak kortikal matur, IOL terpasang sentral'] },
  { sp: 'Mata', icd9: '11.39', nama: 'Eksisi pterigium + graft konjungtiva', kelas: 'kecil', dx: ['H11.0', 'Pterigium'], durasi: [30, 45], darah: [0, 5], cito: 0, bobot: 2, anestesi: [LOKAL],
    langkah: 'Eksisi jaringan pterigium dari kornea, pemasangan autograft konjungtiva dengan lem fibrin.',
    temuan: ['Pterigium grade III nasal', 'Pterigium grade II nasal, kornea jernih setelah eksisi'] },
  { sp: 'Gigi', icd9: '23.19', nama: 'Odontektomi', kelas: 'kecil', dx: ['K01.1', 'Impaksi gigi molar ketiga'], durasi: [45, 90], darah: [10, 50], cito: 0, bobot: 2, anestesi: [GA, LOKAL],
    langkah: 'Insisi flap envelope, pengambilan tulang, pemotongan mahkota gigi impaksi, ekstraksi akar, irigasi, jahit flap.',
    temuan: ['Gigi 38 impaksi mesioangular kelas II posisi B', 'Gigi 48 impaksi horizontal kelas II posisi B'] },
];

// Obat anestesi (dicatat sebagai { catatan } seperti form DialogDetailOperasi).
const OBAT = {
  [GA]: ['Fentanyl 100 mcg IV', 'Propofol 120 mg IV', 'Atracurium 30 mg IV', 'Sevofluran 2 vol% (rumatan)', 'Ondansetron 4 mg IV', 'Ketorolak 30 mg IV'],
  [LMA]: ['Fentanyl 75 mcg IV', 'Propofol 150 mg IV', 'Sevofluran 2 vol% (rumatan)', 'Deksametason 5 mg IV'],
  [TIVA]: ['Midazolam 2 mg IV', 'Fentanyl 50 mcg IV', 'Propofol titrasi 50–100 mg IV'],
  [SAB]: ['Bupivakain 0,5% hiperbarik 12,5 mg intratekal', 'Fentanyl 25 mcg intratekal', 'Ondansetron 4 mg IV', 'Ringer laktat 500 mL (co-loading)'],
  [SEDASI]: ['Midazolam 2 mg IV', 'Fentanyl 50 mcg IV', 'Propofol 30 mg IV'],
  [LOKAL]: ['Lidokain 2% 5 mL + epinefrin 1:200.000 infiltrasi'],
  [TOPIKAL]: ['Tetrakain 0,5% tetes mata', 'Lidokain 2% 4 mL peribulbar'],
};

// Checklist Keselamatan Bedah WHO — sama dengan ITEM_CHECKLIST di penunjang-service/src/kamar-operasi/bersama.js.
const CHECKLIST = {
  sign_in: [
    ['identitas', 'Identitas, lokasi, prosedur, dan persetujuan tindakan telah dikonfirmasi'],
    ['penandaan_lokasi', 'Lokasi operasi telah ditandai'],
    ['mesin_anestesi', 'Mesin dan obat anestesi telah dicek lengkap'],
    ['pulse_oximeter', 'Pulse oximeter terpasang dan berfungsi'],
    ['alergi', 'Riwayat alergi diketahui'],
    ['jalan_napas', 'Risiko jalan napas sulit/aspirasi dinilai, alat/bantuan tersedia'],
    ['risiko_perdarahan', 'Risiko kehilangan darah > 500 mL dinilai, akses & cairan memadai'],
  ],
  time_out: [
    ['konfirmasi_tim', 'Seluruh anggota tim memperkenalkan nama dan peran'],
    ['konfirmasi_identitas', 'Tim mengonfirmasi identitas, lokasi, dan prosedur'],
    ['antisipasi_kritis', 'Antisipasi kejadian kritis telah dibahas (operator/anestesi/perawat)'],
    ['antibiotik_profilaksis', 'Antibiotik profilaksis telah diberikan dalam 60 menit terakhir'],
    ['pencitraan', 'Pencitraan penting yang diperlukan telah ditampilkan'],
  ],
  sign_out: [
    ['nama_prosedur', 'Perawat mengonfirmasi nama prosedur yang tercatat'],
    ['hitung_instrumen', 'Hitung instrumen, kasa, dan jarum telah lengkap dan benar'],
    ['label_spesimen', 'Spesimen telah diberi label dengan benar (termasuk nama pasien)'],
    ['masalah_alat', 'Masalah terkait peralatan yang perlu ditindaklanjuti telah dicatat'],
    ['rencana_pemulihan', 'Operator/anestesi/perawat membahas rencana pemulihan & perawatan pasien'],
  ],
};

const ALASAN_BATAL_JADWAL = [
  'Pasien demam dan batuk pilek saat evaluasi pra-anestesi, operasi ditunda',
  'Hb pra-operasi 8,9 g/dL, perlu koreksi transfusi lebih dahulu',
  'Ruang OK dipakai untuk operasi cito',
  'Pasien belum puasa sesuai instruksi',
  'Tekanan darah 180/110 mmHg, konsultasi Penyakit Dalam lebih dahulu',
];
const ALASAN_BATAL_ORDER = ['Pasien menolak tindakan operasi setelah edukasi', 'Pasien memilih dirujuk ke RS lain atas permintaan keluarga', 'Keluhan membaik dengan terapi konservatif'];
const CATATAN_KLARIFIKASI = ['Hasil laboratorium pra-operasi (darah lengkap, faal hemostasis) belum dilampirkan', 'Mohon lengkapi hasil EKG dan konsul jantung untuk pasien usia > 40 tahun', 'Diagnosis dan rencana tindakan belum sesuai, mohon dikonfirmasi ulang'];

const jamMenit = (t) => new Date((t + 7 * JAM) * 1000).toISOString().slice(11, 16).replace(':', '.');
const poliDokter = (d) => {
  let p = d.poli_pelayanan;
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch { p = []; } }
  return Array.isArray(p) && p[0]?.name ? p[0].name : '';
};
const perempuan = (p) => /^(perempuan|female|p)$/i.test(String(p?.gender ?? ''));

async function seed(ctx) {
  const { M, F } = ctx;
  if (!M.dokter.length) return 'dilewati: faskes belum memiliki dokter';
  const N = JUMLAH[F.segmen] ?? 10;

  // ── Master ruang OK ──
  let ruang = await ctx.baris(`SELECT uuid, kode, nama FROM ok_ruang WHERE faskes_uuid = $1 AND deleted_at IS NULL AND aktif ORDER BY kode`, [ctx.faskes]);
  let ruangBaru = 0;
  if (!ruang.length) {
    const daftar = (JUMLAH_RUANG[F.segmen] ?? 1) === 1 ? [{ kode: 'OK-1', nama: 'Kamar Operasi' }] : RUANG.slice(0, JUMLAH_RUANG[F.segmen]);
    ruang = daftar.map((r) => ctx.tambah('ok_ruang', { ...r, lokasi_uuid: null, jam_mulai: r.kode === 'OK-4' ? '00:00' : '07:00', jam_selesai: r.kode === 'OK-4' ? '23:59' : '21:00', aktif: true, created_at: ctx.hariLalu(ctx.HARI + 5) }));
    ruangBaru = ruang.length;
  }

  // ── Tim: operator per spesialis, dokter anestesi, perawat ──
  const operatorSp = {};
  for (const d of M.dokter) {
    const poli = poliDokter(d);
    for (const sp of ['Bedah', 'Kandungan', 'THT', 'Mata', 'Gigi']) if (poli.includes(sp)) (operatorSp[sp] ??= []).push({ ...d, poliNama: poli, poliUuid: (() => { try { return JSON.parse(d.poli_pelayanan)[0]?.lokasi_uuid; } catch { return null; } })() });
  }
  if (!operatorSp.Bedah) operatorSp.Bedah = [M.dokter[0]];
  const katalog = TINDAKAN.filter((t) => operatorSp[t.sp]?.length);
  const bedahUuid = new Set(Object.values(operatorSp).flat().map((d) => d.uuid));
  const nonBedah = M.dokter.filter((d) => !bedahUuid.has(d.uuid));
  const anestesiPool = nonBedah.filter((d) => /umum/i.test(poliDokter(d))).length ? nonBedah.filter((d) => /umum/i.test(poliDokter(d))) : nonBedah.length ? nonBedah : M.dokter;
  const perawat = M.nakes.filter((n) => /kep|ns\./i.test(n.name)).length ? M.nakes.filter((n) => /kep|ns\./i.test(n.name)) : M.nakes;
  const userDari = (pr) => M.users.find((u) => u.practitioner_uuid && u.practitioner_uuid === pr?.uuid)?.username;
  const userPerawat = M.users.filter((u) => /perawat/i.test(u.username)).map((u) => u.username);
  const userOk = () => (userPerawat.length ? ctx.pilih(userPerawat) : M.users[0]?.username ?? 'demo');
  const bpjs = M.penjamin.find((p) => /bpjs/i.test(p.name));

  // Tarif OK yang sudah dikonfigurasi (tagihan_menunggu meniru bentukTagihan laporan.js).
  const tarifOk = new Set((await ctx.baris(`SELECT code FROM tarif WHERE faskes_uuid = $1 AND code LIKE 'OK-%' AND status AND deleted_at IS NULL`, [ctx.faskes])).map((r) => r.code));
  const lokasiRuangRi = M.lokasi.filter((l) => l.location_type === 'Room' && l.pelayanan === 'RI');
  const poliBedah = M.poli.find((p) => /bedah/i.test(p.name)) ?? M.poli[0];

  // ── Linimasa operasi tanpa tumpang tindih ──
  const sibuk = [];
  const bebas = (mulai, selesai) => !sibuk.some(([a, b]) => mulai < b && selesai > a);
  const slot = (mulai, menit) => {
    let t = mulai;
    while (!bebas(t - 20 * MENIT, t + menit * MENIT + 30 * MENIT)) t += 30 * MENIT;
    sibuk.push([t - 20 * MENIT, t + menit * MENIT + 30 * MENIT]);
    return t;
  };

  // Kategori jumlah.
  const nPulih = Math.max(1, Math.round(N / 15));
  const nHariIni = Math.max(1, Math.round(N / 30));
  const nDatang = Math.max(2, Math.round(N * 0.1));
  const nMenunggu = Math.max(2, Math.round(N * 0.06));
  const nKlarifikasi = Math.max(1, Math.round(N * 0.03));
  const nOrderBatal = Math.max(1, Math.round(N * 0.03));
  const nJadwalBatal = Math.max(1, Math.round(N * 0.07));
  // N ≈ jumlah operasi yang dikerjakan (selesai + di pemulihan); order lain (terjadwal/menunggu/batal) menambah.
  const nSelesai = Math.max(1, N - nPulih - Math.ceil(nJadwalBatal / 2));

  const pilihTindakan = (opsi = {}) => {
    const daftar = katalog.filter((t) => (opsi.cito === undefined ? true : opsi.cito ? t.cito > 0.3 : t.cito < 0.95));
    const bobot = Object.fromEntries(daftar.map((t, i) => [i, t.bobot]));
    return daftar[Number(ctx.berbobot(bobot))];
  };
  const pasienUntuk = (t) => {
    if (t.sp === 'Kandungan') {
      const p = M.pasien.filter(perempuan);
      return p.length ? ctx.pilih(p) : ctx.pasien({ gender: 'Perempuan', baru: true, umur: [20, 45] });
    }
    return ctx.pasien();
  };

  // Kunjungan rawat jalan Poli (selesai) tempat order operasi elektif dibuat.
  const kunjunganRj = (p, dokter, tOrder) => {
    const daftar = tOrder - ctx.antara(40, 120) * MENIT;
    const periksa = tOrder - ctx.antara(5, 20) * MENIT;
    const pulang = Math.min(tOrder + ctx.antara(15, 45) * MENIT, ctx.SEKARANG - 60);
    const lokasi = dokter.poliUuid ?? poliBedah?.uuid ?? null;
    const rj = ctx.tambah('rawat_jalans', {
      payment_method: ctx.peluang(0.55) ? 2 : 1, no_reg: ctx.kode('RJOK', daftar), patient_uuid: p.uuid, name: p.name, no_rm: p.no_rm,
      birth_detail_uuid: p.birth_detail_uuid ?? null, gender: p.gender, practitioner_uuid: dokter.uuid, lokasi_uuid: lokasi,
      tanggal_daftar: daftar, jadwal_periksa: daftar, tanggal_checkin: daftar + 5 * MENIT, tanggal_periksa: periksa, discharge_date: pulang,
      status_rj: 5, status_pulang: 'home', kondisi_pasien_pulang: '359746009', platform: 'loket', maternity: false, complaint: 'Kontrol rencana operasi',
      rekam_medis_uuid: crypto.randomBytes(12).toString('hex'), created_at: daftar, updated_at: pulang,
    });
    return { sumber: 'rajal', uuid: rj.uuid, no_reg: rj.no_reg, rekam_medis_uuid: rj.rekam_medis_uuid, payment_method: rj.payment_method, lokasi_uuid: lokasi };
  };
  // Episode rawat inap (sudah pulang, status_ri 4) sebagai kunjungan asal operasi lampau: ctx.rawatInap dengan DPJP =
  // operator dan rekam_medis_uuid (dipakai persetujuan tindakan & validasi kunjungan episode PACU).
  const kunjunganRi = (p, mulaiOperasi, cito, dokter, ekstraHari = 0) => {
    const mulai = cito ? mulaiOperasi - ctx.antara(3, 6) * JAM : mulaiOperasi - ctx.antara(16, 26) * JAM;
    const rm = crypto.randomBytes(12).toString('hex');
    const ri = ctx.rawatInap({ pasien: p, mulai, lamaHari: ctx.antara(2, 6) + ekstraHari, encounter: cito ? 'IGD' : 'RJ', keluhan: 'Rencana operasi',
      data: { rekam_medis_uuid: rm, practitioner_uuid: dokter.uuid } });
    return { sumber: 'ranap', uuid: ri.uuid, no_reg: ri.no_reg, rekam_medis_uuid: rm, payment_method: ri.payment_method, lokasi_uuid: ri.bed?.room_uuid ?? null, tOrderMin: ri.dirawat };
  };

  let nomor = 0;
  const buatOrder = ({ t, tOrder, p, k, dokter, status, extra = {} }) => {
    const durasi = Math.round(ctx.antara(t.durasi[0], t.durasi[1]) / 15) * 15;
    const [kodeDx, namaDx] = t.dxAlt && ctx.peluang(0.35) ? ctx.pilih(t.dxAlt) : t.dx;
    const o = ctx.tambah('ok_order', {
      no_order: `OK-${ctx.tglIso(tOrder).replace(/-/g, '')}-D${ctx.pad(++nomor, 3)}`, patient_uuid: p.uuid, no_rm: p.no_rm, no_reg: k.no_reg,
      rekam_medis_uuid: k.rekam_medis_uuid, sumber: k.sumber, lokasi_asal_uuid: k.lokasi_uuid, dokter_pengirim_uuid: dokter.uuid,
      payment_method: k.payment_method ?? 1, penjamin_uuid: k.payment_method === 2 ? bpjs?.uuid ?? null : null,
      diagnosis_kode: kodeDx, diagnosis_nama: namaDx, jenis_operasi: extra.cito ? 'cito' : 'elektif', durasi_estimasi_menit: durasi,
      status, catatan_klarifikasi: extra.catatan_klarifikasi ?? null, alasan_batal: extra.alasan_batal ?? null,
      dibuat_oleh: userDari(dokter) ?? 'demo', created_at: tOrder, updated_at: extra.updated_at ?? tOrder,
    });
    ctx.tambah('ok_order_tindakan', { order_uuid: o.uuid, kode_icd9cm: t.icd9, nama_tindakan: t.nama, kelas_operasi: t.kelas, urutan: 1, created_at: tOrder });
    return { ...o, durasi };
  };

  // hindari: praktisi yang sedang bertugas di operasi lain yang waktunya beririsan (operasi paralel hari ini).
  const susunTim = (dokter, mulai, hindari = new Set()) => {
    const bebasTim = (d) => d.uuid !== dokter.uuid && !hindari.has(d.uuid);
    const anestesiBebas = anestesiPool.filter(bebasTim).length ? anestesiPool.filter(bebasTim) : nonBedah.filter(bebasTim);
    const anest = anestesiBebas.length ? ctx.pilih(anestesiBebas) : null;
    const prw = ctx.acakSebagian(perawat.filter((n) => !hindari.has(n.uuid)), 2);
    const tim = [{ pr: dokter, peran: 'operator' }];
    const asisten = anestesiPool.filter((d) => bebasTim(d) && d.uuid !== anest?.uuid);
    if (asisten.length && ctx.peluang(0.35)) tim.push({ pr: ctx.pilih(asisten), peran: 'asisten' });
    if (anest) tim.push({ pr: anest, peran: 'anestesi' });
    if (prw[0]) tim.push({ pr: prw[0], peran: 'perawat_instrumen' });
    if (prw[1]) tim.push({ pr: prw[1], peran: 'perawat_sirkuler' });
    for (const x of tim) hindari.add(x.pr.uuid);
    return tim.map((x) => ({ ...x, created_at: mulai }));
  };

  const pesanTagihan = (t, r, kelas, tim) => {
    const m = [];
    if (!tarifOk.has(`OK-TINDAKAN-${t.icd9}`)) m.push(`Tindakan ${t.nama} (tarif OK-TINDAKAN-${t.icd9} belum dikonfigurasi)`);
    if (!tarifOk.has(`OK-SEWA-${r.kode}`)) m.push(`Sewa ruang ${r.nama} (tarif OK-SEWA-${r.kode} belum dikonfigurasi)`);
    for (const peran of ['operator', 'asisten', 'anestesi']) {
      if (!tim.some((x) => x.peran === peran)) continue;
      const kode = `OK-JASA-${peran.toUpperCase()}-${kelas.toUpperCase()}`;
      if (!tarifOk.has(kode)) m.push(`Jasa ${peran} kelas ${kelas} (tarif ${kode} belum dikonfigurasi)`);
    }
    return m;
  };

  const hitung = { selesai: 0, pemulihan: 0, terjadwal: 0, batal: 0, menunggu: 0, klarifikasi: 0, order_batal: 0, final: 0, draft: 0 };

  // Jadwal + seluruh dokumen sesuai tahap: 'rencana' (belum ada praoperasi), 'praop' (pra-operasi + consent),
  // 'pulih' (operasi selesai, pasien di pemulihan: checklist lengkap, laporan draft, anestesi tanpa Aldrete keluar),
  // 'selesai' (jadwal selesai, laporan final/draft), 'batal'.
  const buatJadwal = ({ o, t, p, dokter, mulai, tahap, tJadwal, alasanBatal, hindari, ruangKe, aldMasukTarget }) => {
    const r = ruangKe !== undefined ? ruang[ruangKe % ruang.length] : t.sp === 'Kandungan' && ruang.length > 1 ? ruang[1] : t.sp === 'Mata' || t.sp === 'THT' || t.sp === 'Gigi' ? ruang[Math.min(2, ruang.length - 1)] : o.jenis_operasi === 'cito' && ruang.length > 3 ? ruang[3] : ruang[0];
    const selesaiRencana = mulai + o.durasi * MENIT;
    const tim = susunTim(dokter, tJadwal, hindari);
    const opMulai = mulai + ctx.antara(0, 20) * MENIT;
    let opSelesai = opMulai + Math.round(o.durasi * ctx.desimal(0.8, 1.2, 2)) * MENIT;
    const jenisAnestesi = ctx.pilih(t.anestesi);
    let aldMasukT = opSelesai + ctx.antara(4, 8) * MENIT;
    // Pasien di pemulihan: Aldrete masuk (tiba di ruang pemulihan) pada waktu sasaran, sebelum sekarang.
    if (aldMasukTarget) {
      aldMasukT = aldMasukTarget;
      opSelesai = Math.max(opMulai + 15 * MENIT, aldMasukT - ctx.antara(3, 6) * MENIT);
    }
    const regional = [LOKAL, TOPIKAL].includes(jenisAnestesi);
    const aldKeluarT = aldMasukT + (regional ? ctx.antara(15, 25) : ctx.antara(40, 95)) * MENIT;
    const aktual = aldKeluarT + ctx.antara(15, 25) * MENIT;
    const status = tahap === 'selesai' ? 'selesai' : tahap === 'batal' ? 'batal' : 'terjadwal';
    const ubahTerakhir = tahap === 'selesai' ? aktual : tahap === 'batal' ? Math.min(mulai - ctx.antara(1, 6) * JAM, ctx.SEKARANG - 600) : tJadwal;
    const j = ctx.tambah('ok_jadwal', {
      order_uuid: o.uuid, ruang_uuid: r.uuid, waktu_mulai: mulai, waktu_selesai: selesaiRencana, status,
      alasan_perubahan: alasanBatal ?? null, serah_terima: null, waktu_selesai_aktual: tahap === 'selesai' ? aktual : null,
      dibuat_oleh: userOk(), created_at: tJadwal, updated_at: Math.max(tJadwal, ubahTerakhir),
    });
    for (const x of tim) ctx.tambah('ok_jadwal_tim', { jadwal_uuid: j.uuid, practitioner_uuid: x.pr.uuid, peran: x.peran, created_at: tJadwal });
    if (tahap === 'batal' || tahap === 'rencana') return j;

    // Persetujuan tindakan & anestesi (inform_consents milik rekam medis order) + pra-operasi.
    const anest = tim.find((x) => x.peran === 'anestesi')?.pr ?? dokter;
    const tPraop = Math.min(Math.max(tJadwal + 10 * MENIT, mulai - ctx.antara(2, 18) * JAM), mulai - 40 * MENIT);
    const consent = (dok, judul, tc) => ctx.tambah('inform_consents', {
      rekam_medis_uuid: o.rekam_medis_uuid, dokter_uuid: dok.uuid, pemberi_informasi: dok.name, penerima: perempuan(p) ? 'Pasien dan suami' : 'Pasien dan keluarga',
      hubungan_keluarga: 'Keluarga', no_hp: '080000000000', gender: p.gender, diagnosis: `${o.diagnosis_kode} ${o.diagnosis_nama}`, tindakan_kedokteran: judul,
      tatacara_tindakan: judul.startsWith('Anestesi') ? `Pembiusan dengan teknik ${jenisAnestesi.toLowerCase()}` : t.langkah,
      risiko_tindakan: judul.startsWith('Anestesi') ? 'Mual, muntah, nyeri kepala, reaksi alergi obat' : 'Perdarahan, infeksi luka operasi, cedera organ sekitar',
      komplikasi: 'Dijelaskan kepada pasien dan keluarga', prognosis: 'Dubia ad bonam', indikasi_tindakan: o.diagnosis_nama, tujuan_tindakan: 'Terapi definitif',
      persetujuan: true, tgl_persetujuan: tc, saksi1: 'Keluarga pasien', saksi2: userOk(), petugas: userDari(dok) ?? userOk(), created_at: tc,
    });
    const c1 = consent(dokter, `Tindakan operasi: ${t.nama}`, tPraop - 30 * MENIT);
    const c2 = consent(anest, `Anestesi: ${jenisAnestesi}`, tPraop - 20 * MENIT);
    const butuhDarah = t.darah[1] >= 300;
    ctx.tambah('ok_praoperasi', {
      jadwal_uuid: j.uuid,
      asesmen_pra_bedah: `Indikasi operasi: ${o.diagnosis_nama}. Rencana ${t.nama}. Status generalis dalam batas normal, hasil laboratorium pra-operasi dalam batas operasi.`,
      asesmen_pra_anestesi: `ASA ${ctx.pilih(['I', 'II', 'II', 'III'])}${o.jenis_operasi === 'cito' ? 'E' : ''}. Mallampati ${ctx.pilih(['I', 'II', 'II'])}. Puasa ${o.jenis_operasi === 'cito' ? `${ctx.antara(4, 6)} jam` : '8 jam'}. Rencana ${jenisAnestesi.toLowerCase()}.`,
      penandaan_lokasi: t.sp === 'Mata' ? `Mata ${ctx.pilih(['kanan', 'kiri'])} ditandai` : ['Bedah', 'THT'].includes(t.sp) && t.icd9 !== '54.11' ? `Lokasi operasi ditandai ${ctx.pilih(['sisi kanan', 'sisi kiri', 'garis tengah'])}` : 'Lokasi operasi ditandai (garis tengah)',
      consent_tindakan_uuid: c1.uuid, consent_anestesi_uuid: c2.uuid,
      kebutuhan_darah: butuhDarah ? `Siapkan PRC ${ctx.antara(1, 2)} kolf, golongan darah sesuai pasien` : 'Tidak perlu persiapan darah',
      petugas: userOk(), created_at: tPraop,
    });
    if (tahap === 'praop') return j;

    // Checklist WHO, laporan anestesi & operasi.
    const item = (tahapC) => CHECKLIST[tahapC].map(([kode, label]) => ({ kode, label, jawaban: true, catatan: '' }));
    ctx.tambah('ok_checklist', { jadwal_uuid: j.uuid, tahap: 'sign_in', item: item('sign_in'), waktu_diisi: opMulai - ctx.antara(8, 15) * MENIT, petugas: userOk(), created_at: opMulai - 10 * MENIT });
    ctx.tambah('ok_checklist', { jadwal_uuid: j.uuid, tahap: 'time_out', item: item('time_out'), waktu_diisi: opMulai - ctx.antara(1, 3) * MENIT, petugas: userOk(), created_at: opMulai - 2 * MENIT });
    ctx.tambah('ok_checklist', { jadwal_uuid: j.uuid, tahap: 'sign_out', item: item('sign_out'), waktu_diisi: opSelesai - ctx.antara(2, 6) * MENIT, petugas: userOk(), created_at: opSelesai - 3 * MENIT });

    const monitoring = [];
    for (let tm = opMulai; tm <= opSelesai; tm += 15 * MENIT) {
      monitoring.push({ catatan: `${jamMenit(tm)} TD ${ctx.antara(100, 135)}/${ctx.antara(60, 85)} mmHg, N ${ctx.antara(68, 98)} x/menit, SpO2 ${ctx.antara(97, 100)}%` });
    }
    const obat = [...(OBAT[jenisAnestesi] ?? [])];
    if (t.icd9 === '74.1') obat.push('Oksitosin 10 IU drip');
    if (!regional) obat.push('Sefazolin 2 g IV (profilaksis)');
    const pulih = tahap === 'pulih';
    const aldMasuk = regional ? ctx.antara(9, 10) : ctx.antara(6, 8);
    ctx.tambah('ok_laporan_anestesi', {
      jadwal_uuid: j.uuid, jenis_anestesi: jenisAnestesi, obat: obat.map((catatan) => ({ catatan })), monitoring,
      aldrete_masuk: aldMasuk, waktu_aldrete_masuk: aldMasukT,
      aldrete_keluar: pulih ? null : ctx.antara(9, 10), waktu_aldrete_keluar: pulih ? null : aldKeluarT,
      serah_terima: pulih ? null : `Pasien sadar, ${ctx.pilih(['tanda vital stabil', 'hemodinamik stabil'])}, nyeri terkontrol. Diserahkan ke ${o.sumber === 'ranap' ? 'ruang rawat inap' : 'ruang perawatan'} bersama ${ctx.pilih(['instruksi pascaoperasi', 'lembar instruksi dokter'])}.`,
      petugas: userDari(anest) ?? userOk(), created_at: opMulai, updated_at: pulih ? aldMasukT : aldKeluarT,
    });
    const final = !pulih && ctx.peluang(mulai < ctx.SEKARANG - 3 * 86400 ? 0.95 : 0.7);
    const revisi = final && ctx.peluang(0.05) ? 1 : 0;
    const darah = ctx.antara(t.darah[0], t.darah[1]);
    const tFinal = Math.min(opSelesai + ctx.antara(1, 5) * JAM, ctx.SEKARANG - 600);
    ctx.tambah('ok_laporan_operasi', {
      jadwal_uuid: j.uuid, diagnosis_pra: `${o.diagnosis_kode} ${o.diagnosis_nama}`, diagnosis_pasca: `${o.diagnosis_kode} ${o.diagnosis_nama}`,
      tindakan_dilakukan: `${t.nama} (ICD-9-CM ${t.icd9}). ${t.langkah}`, temuan: ctx.pilih(t.temuan), kirim_pa: false, pa_order_uuid: null, status_pa: null,
      komplikasi: ctx.peluang(0.93) ? 'Tidak ada' : ctx.pilih(['Perdarahan intraoperatif lebih dari perkiraan, teratasi', 'Hipotensi sesaat setelah induksi, teratasi dengan efedrin']),
      jumlah_perdarahan_ml: darah, status: final ? 'final' : 'draft', revisi, alasan_revisi: revisi ? 'Koreksi jumlah perdarahan sesuai catatan anestesi' : null,
      tagihan_menunggu: final ? pesanTagihan(t, r, t.kelas, tim) : [], difinalisasi_oleh: final ? userDari(dokter) ?? userOk() : null, waktu_finalisasi: final ? tFinal : null,
      dibuat_oleh: userDari(dokter) ?? userOk(), created_at: opSelesai + ctx.antara(5, 20) * MENIT, updated_at: final ? tFinal : opSelesai + 20 * MENIT,
    });
    if (final) hitung.final++; else hitung.draft++;
    if (tahap === 'selesai' && ctx.peluang(0.3)) {
      // Serah terima di jadwal mengikuti catatan laporan anestesi (jadwal.js /selesai).
      ctx.ubahSetelah(`UPDATE ok_jadwal SET serah_terima = (SELECT serah_terima FROM ok_laporan_anestesi WHERE jadwal_uuid = $1) WHERE uuid = $1 AND faskes_uuid = $2`, [j.uuid, ctx.faskes]);
    }
    return j;
  };
  // Semua jadwal selesai menyalin serah terima laporan anestesi (perilaku PATCH /jadwal/:uuid/selesai).
  const salinSerahTerima = () => ctx.ubahSetelah(`UPDATE ok_jadwal j SET serah_terima = a.serah_terima FROM ok_laporan_anestesi a
      WHERE a.jadwal_uuid = j.uuid AND j.faskes_uuid = $1 AND j.status = 'selesai' AND j.serah_terima IS NULL AND a.serah_terima IS NOT NULL`, [ctx.faskes]);

  const dokterUntuk = (t) => ctx.pilih(operatorSp[t.sp]);
  const hariMulai = (h, jamMin = 8, jamMaks = 15) => ctx.hariLalu(h) + ctx.antara(jamMin * 2, jamMaks * 2) * 30 * MENIT;

  // 1) Operasi selesai tersebar N hari terakhir (hari 1..HARI-1).
  const operasiLampau = (h, opsi = {}) => {
    const cito = opsi.cito ?? ctx.peluang(0.22);
    const t = pilihTindakan({ cito });
    const dokter = dokterUntuk(t);
    const p = pasienUntuk(t);
    const isCito = cito && t.cito > 0;
    const mulaiKandidat = isCito ? ctx.hariLalu(h) + ctx.antara(9, 22) * JAM : hariMulai(h);
    const durasiKira = t.durasi[1];
    const mulai = slot(Math.min(mulaiKandidat, ctx.SEKARANG - 26 * JAM), durasiKira + 100);
    const ri = mulai < ctx.SEKARANG - 4 * 86400 || (isCito && mulai < ctx.SEKARANG - 2 * 86400);
    let k; let tOrder;
    if (ri) {
      k = kunjunganRi(p, mulai, isCito, dokter, opsi.ekstraHari ?? 0); // jadwal ulang: rawat inap lebih lama
      tOrder = Math.min(k.tOrderMin + ctx.antara(20, 90) * MENIT, mulai - 90 * MENIT);
    } else {
      tOrder = isCito ? mulai - ctx.antara(2, 4) * JAM : mulai - ctx.antara(2, 8) * 86400 - ctx.antara(1, 5) * JAM;
      k = kunjunganRj(p, dokter, tOrder);
    }
    const tJadwal = isCito ? tOrder + ctx.antara(15, 40) * MENIT : Math.min(tOrder + ctx.antara(2, 30) * JAM, mulai - 3 * JAM);
    const o = buatOrder({ t, tOrder, p, k, dokter, status: opsi.statusOrder ?? 'terjadwal', extra: { cito: isCito, updated_at: tJadwal } });
    return { o, t, p, dokter, mulai, tJadwal, tOrder, k };
  };

  for (let i = 0; i < nSelesai; i++) {
    const h = ctx.antara(1, ctx.HARI - 1);
    const x = operasiLampau(h);
    buatJadwal({ ...x, tahap: 'selesai' });
    hitung.selesai++;
  }

  // 2) Jadwal batal: sebagian dijadwalkan ulang lalu selesai, sebagian order kembali menunggu jadwal (baru-baru ini).
  for (let i = 0; i < nJadwalBatal; i++) {
    const ulang = i % 2 === 0;
    const h = ulang ? ctx.antara(4, ctx.HARI - 3) : ctx.antara(1, 4);
    const x = operasiLampau(h, { cito: false, statusOrder: ulang ? 'terjadwal' : 'menunggu_jadwal', ekstraHari: ulang ? 4 : 0 });
    buatJadwal({ ...x, tahap: 'batal', alasanBatal: ctx.pilih(ALASAN_BATAL_JADWAL) });
    hitung.batal++;
    if (ulang) {
      const mulai2 = slot(x.mulai + ctx.antara(2, 4) * 86400, x.t.durasi[1] + 100);
      if (mulai2 < ctx.SEKARANG - 26 * JAM) {
        buatJadwal({ ...x, mulai: mulai2, tJadwal: x.mulai + ctx.antara(1, 6) * JAM, tahap: 'selesai' });
        hitung.selesai++;
      } else {
        ctx.ubahSetelah(`UPDATE ok_order SET status = 'menunggu_jadwal' WHERE uuid = $1 AND faskes_uuid = $2`, [x.o.uuid, ctx.faskes]);
      }
    }
  }

  // 3) Operasi hari ini yang sudah selesai dikerjakan, pasien masih di pemulihan (jadwal terjadwal). Operasi berjalan
  // paralel di ruang berbeda dengan tim berbeda; Aldrete masuk berjenjang (menit sebelum sekarang) agar episode PACU
  // menampilkan tahap berbeda: baru keluar OK, baru tiba, dalam pemantauan, siap dipindahkan.
  const SASARAN_PULIH = { 1: [70], 2: [70, 135], 3: [14, 70, 135], 4: [5, 14, 70, 135] }[Math.min(nPulih, 4)] ?? [5, 14, 70, 135];
  const timHariIni = new Set();
  const spDipakai = new Set();
  for (let i = 0; i < nPulih; i++) {
    const sasaran = ctx.SEKARANG - ((SASARAN_PULIH[i] ?? 135 + 60 * (i - 3)) + ctx.antara(0, 2)) * MENIT;
    // Operator berbeda tiap operasi paralel: utamakan spesialis yang belum dipakai dan anestesi umum/regional.
    let t = null;
    for (let coba = 0; coba < 20 && !t; coba++) {
      const c = pilihTindakan({ cito: false });
      if (!c.anestesi.some((a) => a !== LOKAL && a !== TOPIKAL)) continue;
      if (!spDipakai.has(c.sp) || coba > 15) t = c;
    }
    t ??= pilihTindakan({ cito: false });
    spDipakai.add(t.sp);
    const dokter = operatorSp[t.sp].find((d) => !timHariIni.has(d.uuid)) ?? dokterUntuk(t);
    const p = pasienUntuk(t);
    const durasi = Math.round((t.durasi[0] + t.durasi[1]) / 2);
    const mulai = sasaran - (durasi + ctx.antara(15, 30)) * MENIT;
    sibuk.push([mulai - 20 * MENIT, sasaran + 10 * MENIT]);
    const tOrder = mulai - ctx.antara(2, 7) * 86400 - ctx.antara(1, 4) * JAM;
    const k = kunjunganRj(p, dokter, tOrder);
    const tJadwal = tOrder + ctx.antara(2, 24) * JAM;
    const o = buatOrder({ t, tOrder, p, k, dokter, status: 'terjadwal', extra: { updated_at: tJadwal } });
    // Teknik anestesi PACU: hindari lokal/topikal (tidak melewati ruang pemulihan).
    const tPulih = { ...t, anestesi: t.anestesi.filter((a) => a !== LOKAL && a !== TOPIKAL).length ? t.anestesi.filter((a) => a !== LOKAL && a !== TOPIKAL) : [SEDASI] };
    buatJadwal({ o, t: tPulih, p, dokter, mulai, tJadwal, tahap: 'pulih', hindari: timHariIni, ruangKe: i, aldMasukTarget: sasaran });
    hitung.pemulihan++;
  }

  // 4) Jadwal sisa hari ini & 1–7 hari ke depan.
  const operasiDepan = (mulaiKandidat, tahap) => {
    const t = pilihTindakan({ cito: false });
    const dokter = dokterUntuk(t);
    const p = pasienUntuk(t);
    const mulai = slot(mulaiKandidat, t.durasi[1] + 100);
    const tOrder = ctx.SEKARANG - ctx.antara(1, 6) * 86400 - ctx.antara(1, 6) * JAM;
    const k = kunjunganRj(p, dokter, tOrder);
    const tJadwal = Math.min(tOrder + ctx.antara(2, 30) * JAM, ctx.SEKARANG - 600);
    const o = buatOrder({ t, tOrder, p, k, dokter, status: 'terjadwal', extra: { updated_at: tJadwal } });
    buatJadwal({ o, t, p, dokter, mulai, tJadwal, tahap });
    hitung.terjadwal++;
  };
  for (let i = 0; i < nHariIni; i++) operasiDepan(ctx.SEKARANG + ctx.antara(2, 5) * JAM, 'praop');
  for (let i = 0; i < nDatang; i++) {
    const h = ctx.antara(1, 7);
    operasiDepan(ctx.hariLalu(-h) + ctx.antara(16, 28) * 30 * MENIT, h <= 2 && ctx.peluang(0.6) ? 'praop' : 'rencana');
  }

  // 5) Order di daftar tunggu: menunggu jadwal (cito didahulukan), perlu klarifikasi, batal.
  const orderTunggu = (status, extra = {}) => {
    const cito = status === 'menunggu_jadwal' && ctx.peluang(0.3);
    const t = pilihTindakan({ cito });
    const dokter = dokterUntuk(t);
    const p = pasienUntuk(t);
    const tOrder = cito ? ctx.SEKARANG - ctx.antara(30, 150) * MENIT : ctx.SEKARANG - ctx.antara(1, status === 'batal' ? 20 : 6) * 86400 - ctx.antara(0, 6) * JAM;
    const k = kunjunganRj(p, dokter, tOrder);
    buatOrder({ t, tOrder, p, k, dokter, status, extra: { cito: cito && t.cito > 0, ...extra, updated_at: Math.min(tOrder + ctx.antara(1, 20) * JAM, ctx.SEKARANG - 300) } });
  };
  for (let i = 0; i < nMenunggu; i++) { orderTunggu('menunggu_jadwal'); hitung.menunggu++; }
  for (let i = 0; i < nKlarifikasi; i++) { orderTunggu('perlu_klarifikasi', { catatan_klarifikasi: ctx.pilih(CATATAN_KLARIFIKASI) }); hitung.klarifikasi++; }
  for (let i = 0; i < nOrderBatal; i++) { orderTunggu('batal', { alasan_batal: ctx.pilih(ALASAN_BATAL_ORDER) }); hitung.order_batal++; }

  salinSerahTerima();
  return `${ruangBaru ? `${ruangBaru} ruang OK baru, ` : ''}${hitung.selesai} selesai (${hitung.final} laporan final, ${hitung.draft} draf), ${hitung.pemulihan} di pemulihan, `
    + `${hitung.terjadwal} terjadwal, ${hitung.batal} jadwal batal, ${hitung.menunggu} menunggu, ${hitung.klarifikasi} klarifikasi, ${hitung.order_batal} order batal`;
}

// Episode PACU (seeder 'pacu') merujuk ok_jadwal tanpa ON DELETE CASCADE: hapus dulu data demo PACU faskes ini agar
// --bersihkan/--ulang kamar-operasi tidak gagal karena foreign key (urutan --bersihkan mengikuti nama berkas).
async function bersihkan({ q, baris, faskes }) {
  const jejak = await baris(`SELECT tabel, kunci FROM demo_jejak_modul WHERE faskes_uuid = $1 AND modul = 'pacu' AND tabel <> '_selesai' ORDER BY id DESC`, [faskes]);
  for (const tabel of ['pacu_biaya', 'pacu_riwayat', 'pacu_catatan', 'pacu_episode', 'pacu_protokol']) {
    const kunci = jejak.filter((j) => j.tabel === tabel).map((j) => j.kunci);
    if (kunci.length) await q(`DELETE FROM ${tabel} WHERE uuid = ANY($1) AND faskes_uuid = $2`, [kunci, faskes]);
  }
  await q(`DELETE FROM demo_jejak_modul WHERE faskes_uuid = $1 AND modul = 'pacu'`, [faskes]);
}

module.exports = { kode: 'kamar-operasi', nama: 'Kamar Operasi', tahap: 1, modul: ['kamar_operasi'], seed, bersihkan };
