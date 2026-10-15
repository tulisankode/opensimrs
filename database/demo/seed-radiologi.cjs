'use strict';

// Master data demo modul radiologi (penunjang-service), dipanggil seed-demo.cjs per faskes yang modulnya aktif
// dan oleh isi-master-penunjang.cjs untuk faskes yang sudah ada.
// ctx: { ins(tabel, baris) → uuid, satu(sql, params), db, F (spesifikasi faskes katalog-demo), fUuid, base
//        ({ faskes_uuid, created_at, updated_at }), punya(kodeModul), level (1 praktik … 3 RS), penjamin [{uuid,name}],
//        rupiah(n), NOW }. Kembalikan ringkasan singkat (string) untuk dicetak seeder.
//
// Juga: ruang pemeriksaan & alat + jam operasional, persiapan pasien, template expertise bacaan normal, dan petugas
// (radiografer bergelar radiologi / dokter Sp.Rad) — lihat seedOperasional.
//
// IDEMPOTEN: pemeriksaan & paket yang kodenya sudah ada di faskes dilewati (tidak diubah), sehingga aman dijalankan
// ulang pada DB yang sudah terisi.
//
// Kelengkapan alat mengikuti jenis faskes (F.segmen): klinik utama hanya radiografi dasar, panoramik & USG dasar;
// RS kelas D menambah radiografi lanjutan & USG lanjutan; RS kelas C menambah fluoroskopi kontras, mammografi,
// Doppler ekstremitas & CT Scan; RS kelas B/A menambah CT kontras abdomen, Doppler karotis & MRI.
// Harga dasar (Rp) × F.skala, dibulatkan ctx.rupiah. kode_icd9 = ICD-9-CM vol. 3 (null bila tidak pasti).

// Tingkat minimal: 0 klinik utama, 1 RS kelas D, 2 RS kelas C, 3 RS kelas B/A.
const TINGKAT = { klinik_utama: 0, rs_d: 1, rs_c: 2, rs_b: 3, rs_a: 3 };

// [kode, nama, modalitas, bagian tubuh, harga dasar, ICD-9-CM, tingkat minimal]
const PEMERIKSAAN = [
  // Radiografi konvensional — dasar
  ['XR-THX-PA', 'Thorax PA', 'XR', 'Dada', 100000, '87.44', 0],
  ['XR-THX-APL', 'Thorax AP/Lateral', 'XR', 'Dada', 150000, '87.49', 0],
  ['XR-THX-LAT', 'Thorax Lateral', 'XR', 'Dada', 90000, '87.49', 0],
  ['XR-BNO', 'BNO (Abdomen Polos)', 'XR', 'Abdomen', 110000, '88.19', 0],
  ['XR-CERV', 'Cervical AP/Lateral', 'XR', 'Vertebra servikal', 130000, '87.22', 0],
  ['XR-LS', 'Lumbosacral AP/Lateral', 'XR', 'Vertebra lumbosakral', 140000, '87.24', 0],
  ['XR-PELV', 'Pelvis AP', 'XR', 'Pelvis', 120000, '88.26', 0],
  ['XR-GENU', 'Genu AP/Lateral', 'XR', 'Lutut', 120000, '88.27', 0],
  ['XR-CUBT', 'Elbow (Cubiti) AP/Lateral', 'XR', 'Siku', 100000, '88.22', 0],
  ['XR-WRIST', 'Wrist (Carpal) AP/Lateral', 'XR', 'Pergelangan tangan', 100000, '88.23', 0],
  ['XR-MANUS', 'Manus AP/Oblik', 'XR', 'Tangan', 100000, '88.23', 0],
  ['XR-ANKLE', 'Ankle AP/Lateral', 'XR', 'Pergelangan kaki', 100000, '88.28', 0],
  ['XR-PEDIS', 'Pedis AP/Oblik', 'XR', 'Kaki', 100000, '88.28', 0],
  ['XR-SKULL', 'Skull AP/Lateral', 'XR', 'Kepala', 120000, '87.17', 0],
  ['XR-WATERS', 'Sinus Paranasal (Waters)', 'XR', 'Sinus paranasal', 110000, '87.16', 0],
  ['XR-NASAL', 'Os Nasal Lateral', 'XR', 'Hidung', 90000, '87.16', 0],
  ['XR-PANO', 'Panoramic Dental', 'XR', 'Gigi & rahang', 150000, '87.12', 0],
  // Radiografi konvensional — lanjutan
  ['XR-THORL', 'Thoracal AP/Lateral', 'XR', 'Vertebra torakal', 130000, '87.23', 1],
  ['XR-ABD3', 'Abdomen 3 Posisi', 'XR', 'Abdomen', 200000, '88.19', 1],
  ['XR-CLAV', 'Clavicula AP', 'XR', 'Klavikula', 100000, '87.43', 1],
  ['XR-SHLD', 'Shoulder AP', 'XR', 'Bahu', 110000, '88.21', 1],
  ['XR-HUMR', 'Humerus AP/Lateral', 'XR', 'Lengan atas', 110000, '88.21', 1],
  ['XR-ANTB', 'Antebrachii AP/Lateral', 'XR', 'Lengan bawah', 100000, '88.22', 1],
  ['XR-HIP', 'Hip (Coxae) AP/Lateral', 'XR', 'Panggul', 120000, '88.26', 1],
  ['XR-FEMR', 'Femur AP/Lateral', 'XR', 'Paha', 120000, '88.27', 1],
  ['XR-CRUR', 'Cruris AP/Lateral', 'XR', 'Tungkai bawah', 110000, '88.27', 1],
  ['XR-CALC', 'Calcaneus Axial/Lateral', 'XR', 'Tumit', 100000, '88.28', 1],
  ['XR-MAND', 'Mandibula PA/Oblik', 'XR', 'Rahang bawah', 110000, '87.16', 1],
  ['XR-MAST', 'Mastoid (Schuller)', 'XR', 'Mastoid', 130000, null, 1],
  // USG
  ['US-ABD', 'USG Abdomen', 'US', 'Abdomen', 200000, '88.76', 0],
  ['US-MAMMAE', 'USG Mammae', 'US', 'Payudara', 180000, '88.73', 0],
  ['US-OBS', 'USG Obstetri', 'US', 'Uterus gravid', 150000, '88.78', 0],
  ['US-GINJAL', 'USG Ginjal', 'US', 'Ginjal', 160000, '88.75', 0],
  ['US-PELV', 'USG Pelvis (Ginekologi)', 'US', 'Pelvis', 170000, '88.79', 0],
  ['US-TIROID', 'USG Tiroid', 'US', 'Leher', 170000, '88.71', 1],
  ['US-URO', 'USG Urologi (Ginjal-Buli)', 'US', 'Traktus urinarius', 180000, '88.75', 1],
  ['US-TESTIS', 'USG Testis (Skrotum)', 'US', 'Skrotum', 180000, '88.79', 1],
  ['US-TV', 'USG Transvaginal', 'US', 'Uterus & adneksa', 200000, '88.79', 1],
  ['US-MSK', 'USG Muskuloskeletal', 'US', 'Sendi & jaringan lunak', 220000, '88.79', 2],
  ['US-DOP-EKS', 'USG Doppler Vaskular Ekstremitas', 'US', 'Pembuluh darah tungkai', 400000, '88.77', 2],
  ['US-DOP-KAR', 'USG Doppler Karotis', 'US', 'Arteri karotis', 450000, '88.71', 3],
  // Fluoroskopi kontras & mammografi
  ['FL-ESOF', 'Esofagografi', 'FL', 'Esofagus', 350000, '87.61', 2],
  ['FL-CIL', 'Colon in Loop', 'FL', 'Kolon', 450000, '87.64', 2],
  ['FL-IVP', 'BNO-IVP', 'FL', 'Traktus urinarius', 450000, '87.73', 2],
  ['FL-HSG', 'Histerosalpingografi (HSG)', 'FL', 'Uterus & tuba', 450000, '87.83', 2],
  ['MG-MAMMO', 'Mammografi Bilateral', 'MG', 'Payudara', 350000, '87.37', 2],
  // CT Scan
  ['CT-KPL', 'CT Scan Kepala tanpa Kontras', 'CT', 'Kepala', 450000, '87.03', 2],
  ['CT-KPL-K', 'CT Scan Kepala dengan Kontras', 'CT', 'Kepala', 750000, '87.03', 2],
  ['CT-SIN', 'CT Scan Sinus Paranasal', 'CT', 'Sinus paranasal', 500000, '87.03', 2],
  ['CT-THX', 'CT Scan Thorax', 'CT', 'Dada', 700000, '87.41', 2],
  ['CT-THX-K', 'CT Scan Thorax dengan Kontras', 'CT', 'Dada', 950000, '87.41', 2],
  ['CT-ABD', 'CT Scan Abdomen tanpa Kontras', 'CT', 'Abdomen', 800000, '88.01', 2],
  ['CT-ABD-K', 'CT Scan Abdomen dengan Kontras', 'CT', 'Abdomen', 1100000, '88.01', 3],
  // MRI
  ['MR-KPL', 'MRI Kepala', 'MR', 'Kepala', 1500000, '88.91', 3],
  ['MR-KPL-K', 'MRI Kepala dengan Kontras', 'MR', 'Kepala', 2200000, '88.91', 3],
  ['MR-CERV', 'MRI Cervical', 'MR', 'Vertebra servikal', 1500000, '88.93', 3],
  ['MR-LUMB', 'MRI Lumbal', 'MR', 'Vertebra lumbal', 1500000, '88.93', 3],
  ['MR-GENU', 'MRI Genu', 'MR', 'Lutut', 1600000, '88.94', 3],
  ['MR-SHLD', 'MRI Shoulder', 'MR', 'Bahu', 1600000, '88.94', 3],
  ['MR-ABD', 'MRI Abdomen', 'MR', 'Abdomen', 2000000, '88.97', 3],
];

// Paket: [kode, nama, deskripsi, faktor harga (× total tarif satuan item yang tersedia), tingkat minimal, kode item].
// Item yang tidak tersedia di faskes dilewati; paket tanpa item tidak dibuat. Harga paket selalu < total satuan.
const PAKET = [
  ['PKT-RAD-CU', 'Paket Check-Up Radiologi', 'Thorax PA dan USG Abdomen untuk pemeriksaan kesehatan berkala.', 0.85, 0, ['XR-THX-PA', 'US-ABD']],
  ['PKT-RAD-KERJA', 'Paket Pra-Kerja', 'Foto Thorax PA untuk syarat melamar kerja / sekolah / visa.', 0.85, 0, ['XR-THX-PA']],
  ['PKT-RAD-HAMIL', 'Paket USG Kehamilan', 'USG obstetri (biometri janin, plasenta, ketuban) dan USG ginjal ibu.', 0.85, 0, ['US-OBS', 'US-GINJAL']],
  ['PKT-RAD-TRAUMA', 'Paket Trauma Ekstremitas', 'Foto sendi ekstremitas atas & bawah pasca cedera / kecelakaan.', 0.8, 0, ['XR-CUBT', 'XR-WRIST', 'XR-GENU', 'XR-ANKLE', 'XR-CRUR', 'XR-ANTB']],
  ['PKT-RAD-PARU', 'Paket Skrining Paru', 'Thorax PA & lateral; RS kelas C ke atas ditambah CT Scan Thorax.', 0.85, 0, ['XR-THX-PA', 'XR-THX-LAT', 'CT-THX']],
  ['PKT-RAD-WANITA', 'Paket Wanita', 'USG mammae dan USG pelvis; RS kelas C ke atas ditambah mammografi.', 0.85, 0, ['US-MAMMAE', 'US-PELV', 'MG-MAMMO']],
  ['PKT-RAD-URO', 'Paket Urologi', 'BNO (abdomen polos) dan USG ginjal untuk evaluasi batu saluran kemih.', 0.85, 0, ['XR-BNO', 'US-GINJAL']],
  ['PKT-RAD-SPINE', 'Paket Nyeri Tulang Belakang', 'Foto vertebra servikal, torakal & lumbosakral.', 0.85, 1, ['XR-CERV', 'XR-THORL', 'XR-LS']],
  ['PKT-RAD-AKUT', 'Paket Akut Abdomen', 'Abdomen 3 posisi dan USG abdomen untuk nyeri perut akut.', 0.85, 1, ['XR-ABD3', 'US-ABD']],
  ['PKT-RAD-PRIA', 'Paket Pria', 'USG urologi (ginjal-buli/prostat) dan USG testis.', 0.85, 1, ['US-URO', 'US-TESTIS']],
  ['PKT-RAD-STROKE', 'Paket Evaluasi Stroke', 'CT Scan kepala, Thorax PA; RS kelas B/A ditambah Doppler karotis.', 0.85, 2, ['CT-KPL', 'XR-THX-PA', 'US-DOP-KAR']],
  ['PKT-RAD-LUTUT', 'Paket Cedera Lutut Olahraga', 'Foto genu dan MRI genu untuk cedera ligamen / meniskus.', 0.85, 3, ['XR-GENU', 'MR-GENU']],
];

// Ruang pemeriksaan & alat: [kode, nama, modalitas[], nama alat, durasi slot (menit), tingkat minimal, jam panjang di RS]
// Ruang dibuat bila salah satu modalitasnya tersedia di faskes. Jam operasional: klinik 08:00–16:00 Senin–Sabtu;
// RS: X-Ray & CT 07:00–21:00 setiap hari (melayani IGD/rawat inap), lainnya 08:00–16:00 Senin–Sabtu.
const RUANG = [
  ['RX1', 'Ruang X-Ray 1', ['XR', 'DX'], 'Unit Radiografi Digital (DR) 500 mA', 10, 0, true],
  ['RX2', 'Ruang X-Ray 2', ['XR', 'DX'], 'Unit Computed Radiography (CR) 300 mA', 10, 2, true],
  ['USG1', 'Ruang USG 1', ['US'], 'USG Color Doppler 4D', 20, 0, false],
  ['USG2', 'Ruang USG 2', ['US'], 'USG Color Doppler', 20, 3, false],
  ['FLUO', 'Ruang Fluoroskopi', ['FL', 'XR'], 'Fluoroskopi Digital (Remote Table)', 45, 2, false],
  ['MAMMO', 'Ruang Mammografi', ['MG'], 'Mammografi Digital', 20, 2, false],
  ['CT', 'Ruang CT Scan', ['CT'], 'CT Scan 64 Slice', 30, 2, true],
  ['MRI', 'Ruang MRI', ['MR'], 'MRI 1,5 Tesla', 45, 3, false],
];

// Persiapan pasien per kode pemeriksaan (dicetak pada slip jadwal). Hanya mengisi yang masih kosong.
const KONTRAS = 'Puasa 4–6 jam sebelum pemeriksaan. Bawa hasil ureum/kreatinin (fungsi ginjal) terbaru. Informasikan riwayat alergi, asma, diabetes (obat metformin), dan kemungkinan hamil.';
const LOGAM_MRI = 'Lepaskan semua benda logam (perhiasan, jam, jepit rambut, gigi palsu lepasan). Informasikan bila memiliki alat pacu jantung, implan logam, klip aneurisma, atau sedang hamil.';
const KK_PENUH = 'Kandung kemih penuh: minum 4–6 gelas air putih 1 jam sebelum pemeriksaan dan tahan berkemih.';
const DADA = 'Lepaskan perhiasan/benda logam di area dada. Pasien wanita informasikan bila sedang/mungkin hamil.';
const PERSIAPAN = {
  'XR-THX-PA': DADA,
  'XR-THX-APL': DADA,
  'XR-THX-LAT': DADA,
  'XR-BNO': 'Malam sebelumnya makan makanan lunak rendah serat. Puasa 6 jam sebelum pemeriksaan bila diminta dokter.',
  'XR-ABD3': 'Informasikan bila sedang/mungkin hamil. Tidak perlu puasa untuk kasus akut.',
  'US-ABD': `Puasa 6–8 jam sebelum pemeriksaan (boleh minum air putih). ${KK_PENUH}`,
  'US-GINJAL': KK_PENUH,
  'US-URO': KK_PENUH,
  'US-PELV': KK_PENUH,
  'US-OBS': 'Usia kehamilan di bawah 14 minggu: kandung kemih penuh (minum 4–6 gelas air putih 1 jam sebelumnya dan tahan berkemih). Bawa buku KIA.',
  'US-TV': 'Kosongkan kandung kemih sebelum pemeriksaan.',
  'FL-ESOF': 'Puasa 6 jam sebelum pemeriksaan.',
  'FL-CIL': 'Diet rendah serat 2 hari sebelumnya, minum obat pencahar sesuai instruksi petugas sehari sebelumnya, puasa 6–8 jam sebelum pemeriksaan.',
  'FL-IVP': 'Bawa hasil ureum/kreatinin maksimal 1 minggu terakhir. Sehari sebelumnya makan makanan rendah serat, minum obat pencahar pukul 20.00, puasa mulai pukul 22.00, kurangi bicara dan tidak merokok.',
  'FL-HSG': 'Dilakukan hari ke-7 s.d. ke-10 siklus haid (setelah haid bersih) dan tidak berhubungan suami-istri sejak hari pertama haid.',
  'MG-MAMMO': 'Dilakukan 7–10 hari setelah hari pertama haid. Jangan memakai deodoran, bedak, atau losion di payudara/ketiak pada hari pemeriksaan.',
  'CT-ABD': 'Puasa 4–6 jam sebelum pemeriksaan.',
  'CT-KPL-K': KONTRAS,
  'CT-THX-K': KONTRAS,
  'CT-ABD-K': KONTRAS,
  'MR-KPL': LOGAM_MRI,
  'MR-CERV': LOGAM_MRI,
  'MR-LUMB': LOGAM_MRI,
  'MR-GENU': LOGAM_MRI,
  'MR-SHLD': LOGAM_MRI,
  'MR-ABD': `Puasa 4–6 jam sebelum pemeriksaan. ${LOGAM_MRI}`,
  'MR-KPL-K': `${LOGAM_MRI} ${KONTRAS}`,
};

// Template expertise bacaan normal: [nama (unik per faskes), kode pemeriksaan | null, modalitas | null, hasil, kesan].
// Template berkode pemeriksaan hanya dibuat bila pemeriksaannya tersedia; template modalitas bila modalitasnya ada.
const TEMPLATE = [
  ['Thorax PA — Normal', 'XR-THX-PA', null,
    'Cor: besar dan bentuk normal, CTR < 50%.\nSinus kostofrenikus kanan dan kiri lancip.\nDiafragma kanan dan kiri licin, tidak mendatar.\nPulmo: hilus tidak menebal, corakan bronkovaskular normal, tidak tampak infiltrat, nodul, maupun kavitas.\nTulang-tulang dan jaringan lunak dinding dada yang tervisualisasi intak.',
    'Cor dan pulmo dalam batas normal.'],
  ['Thorax AP/Lateral — Normal', 'XR-THX-APL', null,
    'Cor: besar dan bentuk normal, CTR < 50%.\nSinus kostofrenikus kanan dan kiri lancip, ruang retrosternal dan retrokardial bersih.\nDiafragma kanan dan kiri licin.\nPulmo: hilus tidak menebal, corakan bronkovaskular normal, tidak tampak infiltrat maupun nodul.\nTulang-tulang yang tervisualisasi intak.',
    'Cor dan pulmo dalam batas normal.'],
  ['USG Abdomen — Normal', 'US-ABD', null,
    'Hepar: ukuran normal, tepi tajam, permukaan rata, ekostruktur parenkim homogen, tidak tampak nodul/massa. Vena porta dan vena hepatika tidak melebar. Duktus biliaris intra dan ekstrahepatal tidak melebar.\nKandung empedu: ukuran normal, dinding tidak menebal, tidak tampak batu maupun sludge.\nPankreas: ukuran dan ekostruktur normal, duktus pankreatikus tidak melebar.\nLien: ukuran normal, ekostruktur homogen, tidak tampak nodul.\nGinjal kanan dan kiri: ukuran normal, batas korteks-medula tegas, sistem pelviokalises tidak melebar, tidak tampak batu maupun massa.\nVesika urinaria: terisi cukup, dinding tidak menebal, tidak tampak batu.\nTidak tampak cairan bebas intraabdomen.',
    'Organ-organ intraabdomen yang tervisualisasi dalam batas normal.'],
  ['USG Ginjal — Normal', 'US-GINJAL', null,
    'Ginjal kanan: ukuran normal, batas korteks-medula tegas, ekostruktur korteks normal, sistem pelviokalises tidak melebar, tidak tampak batu, kista, maupun massa.\nGinjal kiri: ukuran normal, batas korteks-medula tegas, ekostruktur korteks normal, sistem pelviokalises tidak melebar, tidak tampak batu, kista, maupun massa.\nVesika urinaria: terisi cukup, dinding tidak menebal, tidak tampak batu maupun massa.',
    'Ginjal kanan, ginjal kiri, dan vesika urinaria dalam batas normal.'],
  ['USG Obstetri — Janin Tunggal Hidup', 'US-OBS', null,
    'Tampak janin tunggal hidup intrauterin, presentasi kepala.\nBiometri: BPD ... mm, HC ... mm, AC ... mm, FL ... mm, sesuai usia kehamilan ... minggu ... hari.\nTaksiran berat janin ... gram.\nDenyut jantung janin (+) ... x/menit, reguler. Gerak janin (+).\nPlasenta berimplantasi di korpus ..., maturitas grade ..., tidak menutupi ostium uteri internum.\nCairan ketuban cukup (SDP ... cm).',
    'Janin tunggal hidup intrauterin, presentasi kepala, sesuai usia kehamilan ... minggu. Plasenta dan ketuban dalam batas normal.'],
  ['USG Pelvis (Ginekologi) — Normal', 'US-PELV', null,
    'Uterus antefleksi, ukuran normal, miometrium homogen, tidak tampak massa maupun nodul.\nEndometrium tidak menebal.\nOvarium kanan dan kiri ukuran normal, tampak beberapa folikel, tidak tampak kista maupun massa.\nTidak tampak cairan bebas di kavum Douglas.',
    'Uterus dan adneksa kanan-kiri dalam batas normal.'],
  ['USG Mammae — Normal (BI-RADS 1)', 'US-MAMMAE', null,
    'Mammae kanan dan kiri: kutis dan subkutis tidak menebal, jaringan fibroglandular tersebar homogen, tidak tampak lesi kistik maupun solid, duktus tidak melebar.\nTidak tampak pembesaran kelenjar getah bening aksila kanan dan kiri.',
    'USG mammae kanan dan kiri dalam batas normal (BI-RADS 1).'],
  ['USG Tiroid — Normal', 'US-TIROID', null,
    'Lobus kanan dan kiri tiroid serta isthmus ukuran normal, ekostruktur homogen, tidak tampak nodul maupun kista.\nVaskularisasi normal pada pemeriksaan Doppler.\nTidak tampak pembesaran kelenjar getah bening colli.',
    'Tiroid dalam batas normal.'],
  ['Cervical AP/Lateral — Normal', 'XR-CERV', null,
    'Alignment vertebra servikal baik, lordosis servikal normal.\nKorpus vertebra C1–C7 bentuk dan densitas normal, tidak tampak fraktur, listesis, maupun osteofit.\nDiskus intervertebralis tidak menyempit.\nPedikel dan prosesus spinosus intak.\nJaringan lunak prevertebral tidak menebal.',
    'Vertebra servikal dalam batas normal.'],
  ['Lumbosacral AP/Lateral — Normal', 'XR-LS', null,
    'Alignment vertebra lumbosakral baik, lordosis lumbal normal.\nKorpus vertebra L1–L5 dan sakrum bentuk dan densitas normal, tidak tampak fraktur, listesis, maupun osteofit.\nDiskus intervertebralis tidak menyempit.\nPedikel dan prosesus spinosus intak. Sendi sakroiliaka kanan dan kiri baik.\nPsoas line kanan dan kiri simetris.',
    'Vertebra lumbosakral dalam batas normal.'],
  ['BNO — Normal', 'XR-BNO', null,
    'Distribusi udara usus normal sampai ke distal, tidak tampak dilatasi usus maupun air-fluid level.\nPsoas line kanan dan kiri simetris.\nKontur ginjal kanan dan kiri normal.\nTidak tampak bayangan radioopak sepanjang proyeksi traktus urinarius.\nTulang-tulang yang tervisualisasi intak.',
    'Foto BNO dalam batas normal; tidak tampak batu radioopak traktus urinarius.'],
  ['Sinus Paranasal (Waters) — Normal', 'XR-WATERS', null,
    'Sinus maksilaris, frontalis, dan etmoidalis kanan dan kiri lusen, tidak tampak penebalan mukosa, perselubungan, maupun air-fluid level.\nSeptum nasi di tengah. Konka tidak membesar.\nTulang-tulang yang tervisualisasi intak.',
    'Sinus paranasal dalam batas normal.'],
  ['Genu AP/Lateral — Normal', 'XR-GENU', null,
    'Alignment sendi genu baik.\nFemur distal, tibia proksimal, fibula proksimal, dan patela bentuk serta densitas normal, tidak tampak fraktur, dislokasi, maupun lesi litik/sklerotik.\nCelah sendi tidak menyempit, tidak tampak osteofit.\nJaringan lunak sekitar sendi tidak tampak kelainan.',
    'Genu dalam batas normal.'],
  ['Mammografi Bilateral — Normal (BI-RADS 1)', 'MG-MAMMO', null,
    'Komposisi payudara: jaringan fibroglandular tersebar (kategori B).\nTidak tampak massa, distorsi arsitektur, asimetri, maupun mikrokalsifikasi mencurigakan.\nKulit dan puting tidak tampak retraksi maupun penebalan.\nTidak tampak pembesaran kelenjar getah bening aksila.',
    'Mammografi bilateral dalam batas normal (BI-RADS 1).'],
  ['CT Scan Kepala tanpa Kontras — Normal', 'CT-KPL', null,
    'Sulkus kortikalis dan fisura Sylvii tidak melebar.\nDiferensiasi substansia grisea dan alba baik.\nTidak tampak lesi hipodens maupun hiperdens patologis intraparenkim.\nSistem ventrikel dan sisterna tidak melebar, tidak tampak pergeseran garis tengah.\nTidak tampak perdarahan ekstra-aksial.\nPons dan serebelum baik.\nTulang kalvaria intak. Sinus paranasal dan mastoid yang tervisualisasi lusen.',
    'CT Scan kepala tanpa kontras dalam batas normal; tidak tampak perdarahan, infark, maupun massa intrakranial.'],
  ['Radiografi Tulang/Sendi — Normal', null, 'XR',
    'Alignment tulang baik.\nTidak tampak fraktur maupun dislokasi.\nDensitas tulang normal, tidak tampak lesi litik maupun sklerotik.\nCelah sendi baik, tidak tampak osteofit.\nJaringan lunak tidak tampak kelainan.',
    'Tidak tampak kelainan radiologis pada tulang dan sendi yang diperiksa.'],
];

// Ruang, persiapan, template & petugas (idempoten: dicocokkan via kode ruang / kode pemeriksaan / nama template /
// praktisi+peran). `ada` = Map kode pemeriksaan → { uuid, modalitas }, `modalitas` = Set modalitas tersedia.
async function seedOperasional(ctx, tingkat, ada, modalitas) {
  const { ins, base, F } = ctx;
  const fUuid = base.faskes_uuid;
  const rs = String(F.segmen ?? '').startsWith('rs_');

  const ruangAda = new Set((await baris(ctx, `SELECT kode FROM rad_ruang WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [fUuid])).map((r) => r.kode));
  let ruangBaru = 0;
  for (const [kode, nama, mod, alat, durasi, min, jamPanjang] of RUANG) {
    if (min > tingkat || ruangAda.has(kode) || !mod.some((m) => modalitas.has(m))) continue;
    const panjang = rs && jamPanjang;
    await ins('rad_ruang', {
      ...base, kode, nama, modalitas: `{${mod.join(',')}}`, nama_alat: alat,
      jam_buka: panjang ? '07:00' : '08:00', jam_tutup: panjang ? '21:00' : '16:00',
      hari_operasional: panjang ? '{1,2,3,4,5,6,7}' : '{1,2,3,4,5,6}', durasi_slot: durasi, status: true,
    });
    ruangBaru++;
  }

  let persiapan = 0;
  if (ctx.db) {
    for (const [kode, teks] of Object.entries(PERSIAPAN)) {
      if (!ada.has(kode)) continue;
      const r = await ctx.db.query(
        `UPDATE rad_pemeriksaan SET persiapan = $3 WHERE faskes_uuid = $1 AND kode = $2 AND deleted_at IS NULL AND persiapan IS NULL`,
        [fUuid, kode, teks]);
      persiapan += r.rowCount;
    }
  }

  const templateAda = new Set((await baris(ctx, `SELECT nama FROM rad_template WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [fUuid])).map((r) => r.nama));
  let templateBaru = 0;
  for (const [nama, kode, mod, hasil, kesan] of TEMPLATE) {
    if (templateAda.has(nama)) continue;
    if (kode && !ada.has(kode)) continue;
    if (mod && !modalitas.has(mod)) continue;
    const m = kode ? ada.get(kode) : null;
    await ins('rad_template', { ...base, nama, pemeriksaan_uuid: m?.uuid ?? null, modalitas: m?.modalitas ?? mod, hasil, kesan, status: true });
    templateBaru++;
  }

  // Petugas: radiografer = praktisi non-dokter bergelar radiologi (A.Md.Rad / S.Tr.Rad); dokter = dokter bergelar Sp.Rad.
  const kandidat = await baris(
    ctx,
    `SELECT pr.uuid, pr.is_doctor, pg.last_title FROM practitioner pr JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid
      WHERE pr.faskes_uuid = $1 AND pr.deleted_at IS NULL AND pg.last_title ILIKE '%Rad%'`,
    [fUuid]);
  const petugasAda = new Set(
    (await baris(ctx, `SELECT practitioner_uuid || ':' || peran AS k FROM rad_petugas WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [fUuid])).map((r) => r.k));
  let petugasBaru = 0;
  for (const k of kandidat) {
    const peran = k.is_doctor ? (/Sp\.?\s*Rad/i.test(k.last_title) ? 'dokter' : null) : 'radiografer';
    if (!peran || petugasAda.has(`${k.uuid}:${peran}`)) continue;
    await ins('rad_petugas', { ...base, practitioner_uuid: k.uuid, peran, status: true });
    petugasBaru++;
  }
  return `+${ruangBaru} ruang, +${templateBaru} template, +${persiapan} persiapan, +${petugasBaru} petugas`;
}

// Semua baris hasil kueri: pakai ctx.db bila ada, selain itu ctx.satu (satu baris).
const baris = async (ctx, sql, p) => (ctx.db ? (await ctx.db.query(sql, p)).rows : [await ctx.satu(sql, p)].filter(Boolean));

async function seed(ctx) {
  const { ins, F, base, rupiah } = ctx;
  // Dipanggil hanya bila modul radiologi aktif; segmen tanpa radiologi bawaan (praktik/klinik pratama/puskesmas)
  // yang mengaktifkannya lewat Manajemen Modul mendapat tingkat dasar.
  const tingkat = TINGKAT[F.segmen] ?? 0;
  const fUuid = base.faskes_uuid;

  // Pemeriksaan yang sudah ada (per kode) → lewati.
  const ada = new Map(
    (await baris(ctx, `SELECT uuid, kode, modalitas, harga::float8 AS harga FROM rad_pemeriksaan WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [fUuid])).map((r) => [r.kode, r]),
  );
  const modalitas = new Set();
  let baru = 0;
  for (const [kode, nama, mod, bagian, harga, icd9, min] of PEMERIKSAAN) {
    if (min > tingkat) continue;
    modalitas.add(mod);
    if (ada.has(kode)) continue;
    const h = rupiah(harga * (F.skala ?? 1));
    const uuid = await ins('rad_pemeriksaan', { ...base, kode, nama, modalitas: mod, bagian_tubuh: bagian, harga: h, kode_icd9: icd9, status: true });
    ada.set(kode, { uuid, kode, modalitas: mod, harga: h });
    baru++;
  }

  // Paket (dicocokkan via kode).
  const paketAda = new Set((await baris(ctx, `SELECT kode FROM rad_paket WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [fUuid])).map((r) => r.kode));
  let paketBaru = 0;
  for (const [kode, nama, deskripsi, faktor, min, kodeItem] of PAKET) {
    if (min > tingkat || paketAda.has(kode)) continue;
    const isi = kodeItem.map((k) => ada.get(k)).filter(Boolean);
    if (!isi.length) continue;
    const total = isi.reduce((n, i) => n + Number(i.harga), 0);
    const harga = Math.min(rupiah(total * faktor), total - 500);
    const paketUuid = await ins('rad_paket', { ...base, kode, nama, deskripsi, harga, status: true });
    for (const [n, i] of isi.entries()) {
      await ins('rad_paket_item', { ...base, paket_uuid: paketUuid, pemeriksaan_uuid: i.uuid, urutan: n + 1 });
    }
    paketBaru++;
  }

  const operasional = await seedOperasional(ctx, tingkat, ada, modalitas);
  return `Radiologi: ${ada.size} pemeriksaan (+${baru} baru; ${[...modalitas].join('/')}), +${paketBaru} paket, ${operasional}`;
}

module.exports = { seed, PEMERIKSAAN, PAKET, TINGKAT, RUANG, TEMPLATE, PERSIAPAN };
