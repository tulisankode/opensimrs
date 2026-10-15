'use strict';

// Master data demo modul Patologi Anatomi (penunjang-service), dipanggil seed-demo.cjs & isi-master-penunjang.cjs per
// faskes yang modulnya aktif. ctx: { ins(tabel, baris) → uuid, satu(sql, params), db, F (spesifikasi faskes katalog-demo),
// fUuid, base ({ faskes_uuid, created_at, updated_at }), punya(kodeModul), level, penjamin [{uuid,name}], rupiah(n), NOW }.
//
// Isi: pemeriksaan PA (histopatologi, sitologi, potong beku, IHK) + tarif, template laporan kasus umum, dan petugas
// (dokter Sp.PA & teknisi/analis histoteknik fiktif; praktisi bergelar Sp.PA di faskes ikut didaftarkan).
// IDEMPOTEN: pemeriksaan (kode), template (nama), petugas (peran + nama) yang sudah ada dilewati.
//
// Kelengkapan mengikuti jenis faskes (F.segmen): RS kelas C (dan segmen lain yang mengaktifkan modul) histopatologi &
// sitologi dasar; RS kelas B menambah LBC, FNAB tuntunan USG, cell block, potong beku & IHK panel payudara; RS kelas A
// menambah IHK diagnostik (pan-CK, LCA, p16). Harga dasar (Rp) × F.skala, dibulatkan ctx.rupiah.
// kode_icd9 = ICD-9-CM vol. 3 "microscopic examination" (hanya diisi bila pasti). TAT dalam hari.

const TINGKAT = { rs_c: 0, rs_b: 1, rs_a: 2 };

// [kode, nama, jenis, kategori, harga dasar, ICD-9-CM, TAT hari, tingkat minimal]
const PEMERIKSAAN = [
  ['PA-HIS-K', 'Histopatologi Biopsi Kecil (≤ 1 cm)', 'histopatologi', 'Biopsi kecil', 150000, null, 5, 0],
  ['PA-HIS-S', 'Histopatologi Biopsi Sedang (1–5 cm)', 'histopatologi', 'Biopsi sedang', 225000, null, 5, 0],
  ['PA-HIS-B', 'Histopatologi Jaringan Besar (> 5 cm)', 'histopatologi', 'Jaringan besar', 325000, null, 7, 0],
  ['PA-HIS-OP', 'Histopatologi Jaringan Operasi Radikal (Mastektomi/Histerektomi/Kolektomi)', 'histopatologi', 'Operasi radikal', 550000, null, 7, 0],
  ['PA-HIS-KUR', 'Histopatologi Kuretase Endometrium', 'histopatologi', 'Biopsi kecil', 175000, null, 5, 0],
  ['PA-HIS-APP', 'Histopatologi Appendiks', 'histopatologi', 'Biopsi sedang', 175000, null, 5, 0],
  ['PA-HIS-KON', 'Konsultasi Slide/Blok Luar (Second Opinion)', 'histopatologi', 'Konsultasi', 250000, null, 5, 0],
  ['SIT-PAP', 'Sitologi Pap Smear Konvensional', 'sitologi', 'Pap smear', 75000, '91.46', 3, 0],
  ['SIT-FNAB', 'FNAB (Biopsi Aspirasi Jarum Halus) + Sitologi', 'sitologi', 'FNAB', 200000, null, 3, 0],
  ['SIT-CAIR', 'Sitologi Cairan Tubuh (Pleura/Asites/Perikard)', 'sitologi', 'Cairan', 150000, null, 3, 0],
  ['SIT-URIN', 'Sitologi Urin', 'sitologi', 'Cairan', 125000, '91.36', 3, 0],
  ['SIT-SPT', 'Sitologi Sputum', 'sitologi', 'Cairan', 100000, '90.46', 3, 0],
  ['SIT-LBC', 'Sitologi Pap Smear Liquid-Based (LBC)', 'sitologi', 'Pap smear', 200000, '91.46', 3, 1],
  ['SIT-FNAB-G', 'FNAB dengan Tuntunan USG + Sitologi', 'sitologi', 'FNAB', 350000, null, 3, 1],
  ['SIT-CB', 'Sitologi Cell Block', 'sitologi', 'Cairan', 175000, null, 5, 1],
  ['FS-INTRA', 'Potong Beku (Frozen Section) Intraoperatif', 'potong_beku', 'Potong beku', 600000, null, 0, 1],
  ['FS-TAMB', 'Potong Beku Tambahan (per Blok/Tepi Sayatan)', 'potong_beku', 'Potong beku', 300000, null, 0, 1],
  ['IHK-ER', 'IHK Estrogen Receptor (ER)', 'ihk', 'Payudara', 450000, null, 7, 1],
  ['IHK-PR', 'IHK Progesteron Receptor (PR)', 'ihk', 'Payudara', 450000, null, 7, 1],
  ['IHK-HER2', 'IHK HER2/neu', 'ihk', 'Payudara', 550000, null, 7, 1],
  ['IHK-KI67', 'IHK Ki-67', 'ihk', 'Proliferasi', 450000, null, 7, 1],
  ['IHK-PANEL-MAM', 'IHK Panel Payudara (ER, PR, HER2, Ki-67)', 'ihk', 'Payudara', 1600000, null, 7, 1],
  ['IHK-CK', 'IHK Pan-Sitokeratin (AE1/AE3)', 'ihk', 'Diagnostik', 400000, null, 7, 2],
  ['IHK-LCA', 'IHK LCA (CD45)', 'ihk', 'Diagnostik', 400000, null, 7, 2],
  ['IHK-P16', 'IHK p16', 'ihk', 'Diagnostik', 450000, null, 7, 2],
];

// Template laporan: [nama, kode pemeriksaan | null, jenis | null, makroskopis, mikroskopis, diagnosis,
//                    ICD-O topografi, ICD-O morfologi, ICD-10, komentar]. "..." = isian sesuai kasus.
const TEMPLATE = [
  ['Pap Smear — NILM', 'SIT-PAP', null,
    'Diterima 1 (satu) slide sediaan apus serviks berlabel identitas pasien, terfiksasi alkohol 95%.',
    'Sediaan adekuat untuk evaluasi; komponen zona transformasi (sel endoservikal/metaplastik) ada.\nTampak sel-sel epitel skuamosa superfisial dan intermediet dengan inti dalam batas normal. Tidak tampak sel atipik, koilosit, maupun sel ganas.\nLatar belakang bersih dengan sedikit sel radang.',
    'Serviks, Pap smear: Negatif untuk lesi intraepitelial atau keganasan (NILM) — Sistem Bethesda 2014.',
    'C53.9', null, null, 'Skrining ulang sesuai program deteksi dini kanker serviks.'],
  ['Pap Smear — ASC-US', 'SIT-PAP', null,
    'Diterima 1 (satu) slide sediaan apus serviks berlabel identitas pasien, terfiksasi alkohol 95%.',
    'Sediaan adekuat untuk evaluasi.\nTampak beberapa sel skuamosa intermediet/superfisial dengan pembesaran inti 2,5–3 kali inti sel intermediet normal, sedikit hiperkromatik, kromatin halus merata. Perubahan tidak memenuhi kriteria LSIL.\nLatar belakang dengan sel radang neutrofil.',
    'Serviks, Pap smear: Atypical squamous cells of undetermined significance (ASC-US) — Sistem Bethesda 2014.',
    'C53.9', null, 'R87.6', 'Disarankan pemeriksaan HPV DNA, atau Pap smear ulang 6–12 bulan / kolposkopi.'],
  ['Appendisitis Akut', 'PA-HIS-APP', null,
    'Diterima 1 (satu) potong jaringan appendiks, panjang ... cm, diameter ... cm. Permukaan serosa hiperemis dengan bercak fibrin. Pada pembelahan lumen berisi ..., dinding menebal. Dicetak dalam 2 kaset (ujung distal dan potongan melintang).',
    'Sediaan jaringan appendiks dengan mukosa sebagian erosif. Tampak sebukan padat sel radang neutrofil transmural, meluas hingga lapisan muskularis propria dan serosa, disertai edema, kongesti pembuluh darah, dan eksudat fibrinopurulen pada serosa. Tidak tampak tanda keganasan.',
    'Appendiks, appendektomi: Appendisitis akut supuratif.',
    'C18.1', null, 'K35.8', null],
  ['Fibroadenoma Mammae', 'PA-HIS-S', null,
    'Diterima 1 (satu) potong jaringan berkapsul, ukuran ... x ... x ... cm, kenyal. Penampang padat, putih keabuan, berlobus, batas tegas. Dicetak seluruhnya dalam ... kaset.',
    'Sediaan tumor jinak berbatas tegas berkapsul, terdiri atas proliferasi komponen epitel dan stroma. Duktus-duktus dilapisi dua lapis sel (epitel dan mioepitel) tanpa atipia, sebagian tertekan stroma membentuk pola intrakanalikuler dan perikanalikuler. Stroma fibrokolagen hiposeluler tanpa mitosis. Tidak tampak tanda keganasan.',
    'Mammae (dekstra/sinistra), eksisi: Fibroadenoma mammae.',
    'C50.9', '9010/0', 'D24', null],
  ['Karsinoma Payudara Invasif NST', 'PA-HIS-OP', null,
    'Diterima 1 (satu) jaringan mastektomi (dekstra/sinistra) berukuran ... x ... x ... cm dengan kulit ... x ... cm dan puting. Pada pembelahan tampak massa padat, putih keabuan, batas tidak tegas, ukuran ... x ... x ... cm, berjarak ... cm dari tepi sayatan dalam. Jaringan aksila berisi ... kelenjar getah bening. Dicetak dalam ... kaset.',
    'Sediaan tumor ganas epitelial tumbuh infiltratif membentuk struktur tubulus (...%), sarang dan lembaran sel. Sel tumor dengan inti pleomorf ..., kromatin kasar, anak inti nyata; mitosis ... /10 LPB. Tampak/tidak tampak invasi limfovaskular. Komponen DCIS: .... Tepi sayatan: .... Kelenjar getah bening: .../... mengandung metastasis.',
    'Mammae (dekstra/sinistra), mastektomi radikal modifikasi:\n- Karsinoma invasif payudara tipe tidak spesifik (NST), derajat histologik ... (Nottingham skor ...).\n- Ukuran tumor ... cm; invasi limfovaskular: ...; tepi sayatan: ....\n- Kelenjar getah bening aksila: .../... mengandung metastasis.\n- pTNM (AJCC edisi 8): pT... pN...',
    'C50.9', '8500/3', 'C50.9', 'Disarankan pemeriksaan imunohistokimia ER, PR, HER2, dan Ki-67 pada blok tumor.'],
  ['Hiperplasia Nodular Prostat (BPH)', 'PA-HIS-B', null,
    'Diterima kepingan-kepingan jaringan prostat hasil TURP, total berat ... gram, putih keabuan, kenyal. Dicetak ... kaset.',
    'Sediaan jaringan prostat dengan proliferasi kelenjar dan stroma fibromuskular membentuk nodul-nodul. Kelenjar dilapisi dua lapis sel (sekretori dan basal) tanpa atipia, sebagian lumen berisi korpora amilasea. Tampak sebukan ringan sel radang limfosit. Tidak tampak tanda keganasan.',
    'Prostat, TURP: Hiperplasia nodular prostat (BPH) disertai prostatitis kronik ringan.',
    'C61.9', null, 'N40', null],
  ['Kolesistitis Kronik dengan Kolelitiasis', 'PA-HIS-S', null,
    'Diterima 1 (satu) kandung empedu, panjang ... cm, dinding menebal ... cm, mukosa ... . Berisi ... buah batu, kuning kehijauan, diameter terbesar ... cm.',
    'Sediaan dinding kandung empedu dengan mukosa sebagian atrofi, tampak sinus Rokitansky-Aschoff, sebukan sel radang limfosit dan sel plasma pada lamina propria hingga lapisan muskularis, disertai fibrosis dinding. Tidak tampak displasia maupun keganasan.',
    'Kandung empedu, kolesistektomi: Kolesistitis kronik dengan kolelitiasis.',
    'C23.9', null, 'K80.1', null],
  ['Leiomioma Uteri', 'PA-HIS-B', null,
    'Diterima 1 (satu) uterus hasil histerektomi, ukuran ... x ... x ... cm, berat ... gram. Pada pembelahan miometrium tampak ... massa berbatas tegas, putih, berpusar (whorled), diameter terbesar ... cm. Endometrium tebal ... mm.',
    'Sediaan tumor jinak mesenkimal berbatas tegas, terdiri atas berkas-berkas sel otot polos tersusun saling menyilang (fasikuler). Inti sel lonjong ujung tumpul, tanpa atipia; mitosis jarang; tidak tampak nekrosis sel tumor. Endometrium fase ....',
    'Uterus, histerektomi: Leiomioma uteri (intramural/submukosa/subserosa).',
    'C54.2', '8890/0', 'D25.9', null],
  ['Kuretase — Hiperplasia Endometrium tanpa Atipia', 'PA-HIS-KUR', null,
    'Diterima kepingan-kepingan jaringan hasil kuretase, total volume ... ml, merah kecoklatan, lunak. Dicetak seluruhnya dalam ... kaset.',
    'Sediaan endometrium dengan kelenjar-kelenjar yang bertambah jumlahnya dengan rasio kelenjar terhadap stroma meningkat, sebagian berdilatasi kistik, bentuk tidak teratur. Epitel kelenjar tanpa atipia inti. Stroma seluler. Tidak tampak tanda keganasan.',
    'Endometrium, kuretase: Hiperplasia endometrium tanpa atipia (WHO 2020).',
    'C54.1', null, 'N85.0', null],
  ['Lipoma', 'PA-HIS-S', null,
    'Diterima 1 (satu) potong jaringan lemak berkapsul tipis, ukuran ... x ... x ... cm, kuning, lunak, berlobus.',
    'Sediaan tumor jinak berkapsul tipis terdiri atas lobulus-lobulus sel lemak matur dengan ukuran relatif seragam, dipisahkan septa fibrosa tipis. Tidak tampak lipoblas maupun atipia.',
    'Jaringan lunak (regio ...), eksisi: Lipoma.',
    'C49.9', '8850/0', 'D17.9', null],
  ['Kista Epidermal', 'PA-HIS-K', null,
    'Diterima 1 (satu) potong jaringan kulit berukuran ... x ... x ... cm. Pada pembelahan tampak kista berisi massa keratin putih kekuningan seperti bubur.',
    'Sediaan dinding kista dilapisi epitel skuamosa berlapis dengan lapisan granular, lumen berisi lamel-lamel keratin. Dinding fibrokolagen dengan sebukan ringan sel radang. Tidak tampak tanda keganasan.',
    'Kulit (regio ...), eksisi: Kista epidermal (kista epidermoid).',
    'C44.9', null, 'L72.0', null],
  ['FNAB Tiroid — Benign (Bethesda II)', 'SIT-FNAB', null,
    'Dilakukan FNAB pada nodul tiroid lobus (dekstra/sinistra) ukuran ... cm, konsistensi kenyal. Aspirat cairan koloid kecoklatan, dibuat ... sediaan apus (Giemsa dan Papanicolaou).',
    'Sediaan mengandung koloid cair cukup banyak, kelompok-kelompok sel folikel tiroid tersusun monolayer (honeycomb), inti bulat seragam, kromatin halus. Tampak makrofag berisi hemosiderin. Tidak tampak sel atipik.',
    'Tiroid (lobus dekstra/sinistra), FNAB: Benign — sesuai nodul koloid / goiter nodosa (Sistem Bethesda kategori II).',
    'C73.9', null, 'E04.1', 'Disarankan evaluasi klinis dan USG berkala.'],
  ['FNAB KGB — Limfadenitis Reaktif', 'SIT-FNAB', null,
    'Dilakukan FNAB pada benjolan regio colli (dekstra/sinistra) ukuran ... cm, kenyal, mobil. Aspirat darah bercampur materi keputihan, dibuat ... sediaan apus.',
    'Sediaan seluler mengandung populasi limfoid polimorf: limfosit kecil matur dominan, sentroblas, imunoblas, sel plasma, dan makrofag tingible body. Tidak tampak granuloma, nekrosis perkijuan, maupun sel ganas.',
    'Kelenjar getah bening (regio colli ...), FNAB: Limfadenitis reaktif (hiperplasia limfoid reaktif).',
    'C77.0', null, 'I88.9', null],
  ['Potong Beku — Tepi Sayatan Bebas Tumor', 'FS-INTRA', null,
    'Diterima jaringan segar tanpa fiksasi berlabel "tepi sayatan ...", ukuran ... x ... x ... cm, putih keabuan.',
    'Sediaan potong beku jaringan ... : tidak tampak sel-sel tumor.',
    'Potong beku, tepi sayatan ...: Bebas tumor.\n(Diagnosis definitif menunggu pemeriksaan sediaan parafin.)',
    null, null, null, 'Hasil potong beku dilaporkan per telepon ke operator pada pukul ... WIB.'],
  ['IHK Panel Payudara — Luminal A', 'IHK-PANEL-MAM', null,
    'Pemeriksaan imunohistokimia pada blok parafin ... kasus PA ... (karsinoma invasif payudara).',
    'ER: positif, ...% sel tumor, intensitas kuat (Allred skor .../8).\nPR: positif, ...% sel tumor, intensitas ... (Allred skor .../8).\nHER2: negatif (skor 0/1+).\nKi-67: ...% (rendah).\nKontrol positif dan negatif sesuai.',
    'Imunohistokimia payudara: ER positif, PR positif, HER2 negatif, Ki-67 rendah — sesuai subtipe molekuler Luminal A.',
    'C50.9', '8500/3', 'C50.9', 'Penilaian HER2 mengikuti panduan ASCO/CAP 2018; ER/PR positif bila ≥ 1% sel tumor terwarnai.'],
];

// Petugas fiktif per faskes (peran, nama, SIP). Dokter kedua hanya di RS kelas A.
const PETUGAS = [
  ['dokter', 'dr. Ratna Kusumawardhani, Sp.PA', 'SIP/PA/0117/2026', 0],
  ['dokter', 'dr. Bambang Hartono, M.Ked(PA), Sp.PA', 'SIP/PA/0284/2026', 2],
  ['teknisi', 'Nur Aisyah, A.Md.AK', null, 0],
  ['teknisi', 'Rizky Pratama, S.Tr.Kes', null, 1],
];

const baris = async (ctx, sql, p) => (ctx.db ? (await ctx.db.query(sql, p)).rows : [await ctx.satu(sql, p)].filter(Boolean));

async function seed(ctx) {
  const { ins, F, base, rupiah } = ctx;
  const fUuid = base.faskes_uuid;
  const tingkat = TINGKAT[F.segmen] ?? 0;

  const ada = new Map((await baris(ctx, `SELECT uuid, kode FROM pa_pemeriksaan WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [fUuid])).map((r) => [r.kode, r.uuid]));
  let baru = 0;
  for (const [kode, nama, jenis, kategori, harga, icd9, tat, min] of PEMERIKSAAN) {
    if (min > tingkat || ada.has(kode)) continue;
    const uuid = await ins('pa_pemeriksaan', {
      ...base, kode, nama, jenis, kategori, harga: rupiah(harga * (F.skala ?? 1)), kode_icd9: icd9, tat_hari: tat, status: true,
    });
    ada.set(kode, uuid);
    baru++;
  }

  const templateAda = new Set((await baris(ctx, `SELECT nama FROM pa_template WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [fUuid])).map((r) => r.nama));
  let templateBaru = 0;
  for (const [nama, kode, jenis, makro, mikro, diagnosis, topo, morf, icd10, komentar] of TEMPLATE) {
    if (templateAda.has(nama) || (kode && !ada.has(kode))) continue;
    // Template berlaku per jenis pemeriksaan (mis. fibroadenoma bisa dari biopsi kecil maupun sedang); kode
    // pemeriksaan hanya menentukan apakah template relevan untuk faskes ini.
    const jenisPemeriksaan = kode ? PEMERIKSAAN.find((p) => p[0] === kode)[2] : jenis;
    await ins('pa_template', {
      ...base, nama, jenis: jenisPemeriksaan, pemeriksaan_uuid: null, makroskopis: makro, mikroskopis: mikro,
      diagnosis, icd_o_topografi: topo, icd_o_morfologi: morf, icd10, komentar, status: true,
    });
    templateBaru++;
  }

  // Petugas: praktisi faskes bergelar Sp.PA didaftarkan sebagai dokter; ditambah petugas fiktif bila belum ada.
  const petugasAda = new Set((await baris(ctx, `SELECT peran || ':' || nama AS k FROM pa_petugas WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [fUuid])).map((r) => r.k));
  const praktisiPa = await baris(
    ctx,
    `SELECT pr.uuid, pr.sip, TRIM(CONCAT_WS(' ', pg.first_title, pg.name, NULLIF(pg.last_title, ''))) AS nama
       FROM practitioner pr JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid
      WHERE pr.faskes_uuid = $1 AND pr.deleted_at IS NULL AND pr.is_doctor AND pg.last_title ~* 'Sp\\.?\\s*PA'`,
    [fUuid]);
  let petugasBaru = 0;
  for (const pr of praktisiPa) {
    if (petugasAda.has(`dokter:${pr.nama}`)) continue;
    await ins('pa_petugas', { ...base, practitioner_uuid: pr.uuid, nama: pr.nama, peran: 'dokter', sip: pr.sip ?? null, status: true });
    petugasAda.add(`dokter:${pr.nama}`);
    petugasBaru++;
  }
  for (const [peran, nama, sip, min] of PETUGAS) {
    if (min > tingkat || petugasAda.has(`${peran}:${nama}`)) continue;
    await ins('pa_petugas', { ...base, nama, peran, sip, keterangan: peran === 'dokter' ? 'Dokter spesialis patologi anatomi' : 'Teknisi histoteknik', status: true });
    petugasBaru++;
  }
  return `patologi: +${baru} pemeriksaan, +${templateBaru} template, +${petugasBaru} petugas`;
}

module.exports = { seed };
