'use strict';

// Master data demo modul mikrobiologi (penunjang-service), dipanggil seed-demo.cjs & isi-master-penunjang.cjs per faskes
// yang modulnya aktif. ctx: { ins(tabel, baris) → uuid, satu(sql, params), db, F (spesifikasi faskes katalog-demo),
// fUuid, base ({ faskes_uuid, created_at, updated_at }), punya(kodeModul), level, penjamin [{uuid,name}], rupiah(n), NOW }.
// Wajib idempoten (lewati kode yang sudah ada). Kembalikan ringkasan singkat (string).
//
// Isi: pemeriksaan (tarif dasar × F.skala), organisme klinis umum, antibiotik (kode WHONET + golongan + potensi disk
// CLSI), serta panel antibiotik standar per kelompok organisme. Panel satu kelompok hanya dibuat bila kelompok tsb.
// belum punya panel (tidak menimpa panel yang sudah disesuaikan faskes).
// Breakpoint (zona/MIC) SENGAJA tidak diisi: nilai berubah tiap edisi CLSI/EUCAST dan wajib ditetapkan oleh Sp.MK/
// laboratorium masing-masing lewat Datamaster Antibiotik. Tanpa breakpoint, interpretasi S/I/R diisi manual.

// Tingkat minimal pemeriksaan: 0 semua faskes bermodul mikrobiologi, 1 RS kelas B/A (rujukan, BSL-2+, alat molekuler).
const TINGKAT = { rs_b: 1, rs_a: 1 };

const SP_UMUM = ['pus', 'swab_luka', 'sputum', 'cairan_tubuh', 'jaringan', 'ujung_kateter', 'bilasan_bronkus', 'swab_telinga', 'swab_mata'];
const SP_TB = ['sputum', 'bilasan_bronkus', 'lcs', 'cairan_tubuh', 'jaringan', 'pus'];

// [kode, nama, jenis, spesimen[], pewarnaan, kultur, ast, harga dasar, TAT hari, metode, tingkat]
const PEMERIKSAAN = [
  ['MB-GRAM', 'Pewarnaan Gram', 'pewarnaan', [...SP_UMUM, 'lcs', 'swab_uretra', 'swab_vagina'], 'gram', false, false, 50000, 1, 'Mikroskopis pewarnaan Gram', 0],
  ['MB-BTA', 'Pewarnaan BTA (Ziehl-Neelsen)', 'pewarnaan', SP_TB, 'bta', false, false, 40000, 1, 'Mikroskopis Ziehl-Neelsen, skala IUATLD', 0],
  ['MB-KOH', 'Sediaan KOH (Jamur)', 'pewarnaan', ['kerokan_kulit', 'swab_vagina', 'sputum', 'swab_telinga', 'jaringan'], 'koh', false, false, 40000, 1, 'Mikroskopis KOH 10–20%', 0],
  ['MB-TINTA', 'Tinta India (Cryptococcus)', 'pewarnaan', ['lcs'], 'tinta_india', false, false, 75000, 1, 'Mikroskopis tinta India', 0],
  ['MB-KS', 'Kultur & Sensitivitas Aerob', 'kultur', [...SP_UMUM, 'swab_tenggorok'], 'gram', true, true, 350000, 3, 'Kultur aerob, identifikasi & uji kepekaan (disk difusi / MIC otomatis)', 0],
  ['MB-KD', 'Kultur Darah & Sensitivitas', 'kultur', ['darah'], 'gram', true, true, 450000, 5, 'Botol kultur darah aerob (sistem otomatis), inkubasi s.d. 5 hari', 0],
  ['MB-KU', 'Kultur Urin & Sensitivitas', 'kultur', ['urin'], null, true, true, 300000, 3, 'Kultur kuantitatif (CFU/mL), identifikasi & uji kepekaan', 0],
  ['MB-KF', 'Kultur Feses (Salmonella/Shigella/Vibrio)', 'kultur', ['feses'], null, true, true, 300000, 3, 'Media selektif & diperkaya enterik', 0],
  ['MB-KLCS', 'Kultur LCS & Sensitivitas', 'kultur', ['lcs'], 'gram', true, true, 450000, 4, 'Kultur aerob LCS + pewarnaan Gram sitospin', 0],
  ['MB-KT', 'Kultur Swab Tenggorok', 'kultur', ['swab_tenggorok', 'swab_nasofaring'], null, true, true, 250000, 3, 'Kultur Streptococcus β-hemolitik & patogen saluran napas atas', 0],
  ['MB-KJ', 'Kultur Jamur', 'kultur', [...SP_UMUM, 'kerokan_kulit', 'urin', 'darah', 'swab_vagina', 'lcs'], 'koh', true, false, 300000, 7, 'Kultur Sabouraud dextrose agar, inkubasi s.d. 7–14 hari', 0],
  ['MB-KJ-AST', 'Kultur & Uji Kepekaan Jamur (Candida)', 'kultur', ['darah', 'urin', 'sputum', 'cairan_tubuh', 'swab_vagina', 'pus'], null, true, true, 500000, 7, 'Identifikasi ragi & uji kepekaan antijamur', 1],
  ['MB-KAN', 'Kultur Anaerob & Sensitivitas', 'kultur', ['pus', 'jaringan', 'cairan_tubuh'], 'gram', true, true, 500000, 5, 'Kultur anaerob (anaerobic jar), identifikasi & uji kepekaan', 1],
  ['MB-KTB', 'Kultur M. tuberculosis & Uji Kepekaan OAT', 'kultur', SP_TB, 'bta', true, true, 600000, 42, 'Kultur cair (MGIT) / Lowenstein-Jensen, uji kepekaan OAT lini pertama', 1],
  ['MB-TCM', 'Tes Cepat Molekuler TB (TCM)', 'molekuler', SP_TB, null, false, false, 450000, 1, 'NAAT Xpert MTB/RIF (deteksi MTB & resistensi rifampisin)', 1],
];

// [kode, nama, gram, bentuk, kelompok, kode WHONET (null bila tidak pasti)]
const ORGANISME = [
  ['ECO', 'Escherichia coli', 'negatif', 'batang', 'ENTEROBACTERALES', 'eco'],
  ['KPN', 'Klebsiella pneumoniae', 'negatif', 'batang', 'ENTEROBACTERALES', 'kpn'],
  ['KOX', 'Klebsiella oxytoca', 'negatif', 'batang', 'ENTEROBACTERALES', null],
  ['KAE', 'Klebsiella aerogenes', 'negatif', 'batang', 'ENTEROBACTERALES', null],
  ['ECL', 'Enterobacter cloacae complex', 'negatif', 'batang', 'ENTEROBACTERALES', null],
  ['PMI', 'Proteus mirabilis', 'negatif', 'batang', 'ENTEROBACTERALES', 'pmi'],
  ['PVU', 'Proteus vulgaris', 'negatif', 'batang', 'ENTEROBACTERALES', null],
  ['CFR', 'Citrobacter freundii', 'negatif', 'batang', 'ENTEROBACTERALES', null],
  ['SMA', 'Serratia marcescens', 'negatif', 'batang', 'ENTEROBACTERALES', null],
  ['MMO', 'Morganella morganii', 'negatif', 'batang', 'ENTEROBACTERALES', null],
  ['STY', 'Salmonella Typhi', 'negatif', 'batang', 'ENTEROBACTERALES', null],
  ['SPA', 'Salmonella Paratyphi A', 'negatif', 'batang', 'ENTEROBACTERALES', null],
  ['SHI', 'Shigella spp.', 'negatif', 'batang', 'ENTEROBACTERALES', null],
  ['PAE', 'Pseudomonas aeruginosa', 'negatif', 'batang', 'PSEUDOMONAS', 'pae'],
  ['ABA', 'Acinetobacter baumannii complex', 'negatif', 'kokobasil', 'ACINETOBACTER', 'aba'],
  ['SMAL', 'Stenotrophomonas maltophilia', 'negatif', 'batang', 'NONFERMENTER', null],
  ['BCE', 'Burkholderia cepacia complex', 'negatif', 'batang', 'NONFERMENTER', null],
  ['BPS', 'Burkholderia pseudomallei', 'negatif', 'batang', 'NONFERMENTER', null],
  ['SAU', 'Staphylococcus aureus', 'positif', 'kokus', 'STAPHYLOCOCCUS', 'sau'],
  ['SEP', 'Staphylococcus epidermidis', 'positif', 'kokus', 'STAPHYLOCOCCUS', 'sep'],
  ['SHA', 'Staphylococcus haemolyticus', 'positif', 'kokus', 'STAPHYLOCOCCUS', null],
  ['CONS', 'Staphylococcus koagulase negatif (CoNS)', 'positif', 'kokus', 'STAPHYLOCOCCUS', null],
  ['EFA', 'Enterococcus faecalis', 'positif', 'kokus', 'ENTEROCOCCUS', 'efa'],
  ['EFM', 'Enterococcus faecium', 'positif', 'kokus', 'ENTEROCOCCUS', 'efm'],
  ['SPN', 'Streptococcus pneumoniae', 'positif', 'kokus', 'PNEUMOCOCCUS', 'spn'],
  ['SPY', 'Streptococcus pyogenes (grup A)', 'positif', 'kokus', 'STREPTOCOCCUS', 'spy'],
  ['SAG', 'Streptococcus agalactiae (grup B)', 'positif', 'kokus', 'STREPTOCOCCUS', 'sag'],
  ['SVI', 'Streptococcus grup viridans', 'positif', 'kokus', 'STREPTOCOCCUS', null],
  ['HIN', 'Haemophilus influenzae', 'negatif', 'kokobasil', 'HAEMOPHILUS', null],
  ['NME', 'Neisseria meningitidis', 'negatif', 'kokus', 'LAIN', null],
  ['NGO', 'Neisseria gonorrhoeae', 'negatif', 'kokus', 'LAIN', null],
  ['VCH', 'Vibrio cholerae', 'negatif', 'batang', 'LAIN', null],
  ['BFR', 'Bacteroides fragilis group', 'negatif', 'batang', 'ANAEROB', null],
  ['CPE', 'Clostridium perfringens', 'positif', 'batang', 'ANAEROB', null],
  ['CAL', 'Candida albicans', 'jamur', 'ragi', 'JAMUR', null],
  ['CTR', 'Candida tropicalis', 'jamur', 'ragi', 'JAMUR', null],
  ['CGL', 'Candida glabrata (Nakaseomyces glabratus)', 'jamur', 'ragi', 'JAMUR', null],
  ['CAU', 'Candida auris', 'jamur', 'ragi', 'JAMUR', null],
  ['CNE', 'Cryptococcus neoformans', 'jamur', 'ragi', 'JAMUR', null],
  ['AFU', 'Aspergillus fumigatus', 'jamur', 'kapang', 'JAMUR', null],
  ['MTB', 'Mycobacterium tuberculosis complex', 'bta', 'batang', 'MIKOBAKTERIA', null],
];

// [kode WHONET, nama, golongan, potensi disk]
const ANTIBIOTIK = [
  ['AMP', 'Ampisilin', 'Penisilin', '10 µg'],
  ['PEN', 'Penisilin G', 'Penisilin', '10 unit'],
  ['OXA', 'Oksasilin', 'Penisilin antistafilokokus', '1 µg'],
  ['AMC', 'Amoksisilin-asam klavulanat', 'Penisilin + penghambat β-laktamase', '20/10 µg'],
  ['SAM', 'Ampisilin-sulbaktam', 'Penisilin + penghambat β-laktamase', '10/10 µg'],
  ['TZP', 'Piperasilin-tazobaktam', 'Penisilin + penghambat β-laktamase', '100/10 µg'],
  ['CZO', 'Sefazolin', 'Sefalosporin generasi I', '30 µg'],
  ['CXM', 'Sefuroksim', 'Sefalosporin generasi II', '30 µg'],
  ['FOX', 'Sefoksitin', 'Sefamisin', '30 µg'],
  ['CTX', 'Sefotaksim', 'Sefalosporin generasi III', '30 µg'],
  ['CRO', 'Seftriakson', 'Sefalosporin generasi III', '30 µg'],
  ['CAZ', 'Seftazidim', 'Sefalosporin generasi III', '30 µg'],
  ['FEP', 'Sefepim', 'Sefalosporin generasi IV', '30 µg'],
  ['CZA', 'Seftazidim-avibaktam', 'Sefalosporin + penghambat β-laktamase', '30/20 µg'],
  ['ATM', 'Aztreonam', 'Monobaktam', '30 µg'],
  ['ETP', 'Ertapenem', 'Karbapenem', '10 µg'],
  ['IPM', 'Imipenem', 'Karbapenem', '10 µg'],
  ['MEM', 'Meropenem', 'Karbapenem', '10 µg'],
  ['GEN', 'Gentamisin', 'Aminoglikosida', '10 µg'],
  ['GEH', 'Gentamisin dosis tinggi (sinergi)', 'Aminoglikosida', '120 µg'],
  ['AMK', 'Amikasin', 'Aminoglikosida', '30 µg'],
  ['STR', 'Streptomisin', 'Aminoglikosida', null],
  ['CIP', 'Siprofloksasin', 'Fluorokuinolon', '5 µg'],
  ['LVX', 'Levofloksasin', 'Fluorokuinolon', '5 µg'],
  ['MFX', 'Moksifloksasin', 'Fluorokuinolon', '5 µg'],
  ['SXT', 'Trimetoprim-sulfametoksazol', 'Penghambat jalur folat', '1,25/23,75 µg'],
  ['NIT', 'Nitrofurantoin', 'Nitrofuran', '300 µg'],
  ['FOS', 'Fosfomisin', 'Fosfonat', '200 µg'],
  ['TCY', 'Tetrasiklin', 'Tetrasiklin', '30 µg'],
  ['DOX', 'Doksisiklin', 'Tetrasiklin', '30 µg'],
  ['MNO', 'Minosiklin', 'Tetrasiklin', '30 µg'],
  ['TGC', 'Tigesiklin', 'Glisilsiklin', '15 µg'],
  ['COL', 'Kolistin', 'Polimiksin', null],
  ['ERY', 'Eritromisin', 'Makrolida', '15 µg'],
  ['AZM', 'Azitromisin', 'Makrolida', '15 µg'],
  ['CLI', 'Klindamisin', 'Linkosamida', '2 µg'],
  ['VAN', 'Vankomisin', 'Glikopeptida', null],
  ['TEC', 'Teikoplanin', 'Glikopeptida', '30 µg'],
  ['LNZ', 'Linezolid', 'Oksazolidinon', '30 µg'],
  ['CHL', 'Kloramfenikol', 'Fenikol', '30 µg'],
  ['RIF', 'Rifampisin', 'Ansamisin', '5 µg'],
  ['MTZ', 'Metronidazol', 'Nitroimidazol', null],
  ['INH', 'Isoniazid', 'Antituberkulosis', null],
  ['EMB', 'Etambutol', 'Antituberkulosis', null],
  ['PZA', 'Pirazinamid', 'Antituberkulosis', null],
  ['FLU', 'Flukonazol', 'Antijamur azol', '25 µg'],
  ['VOR', 'Vorikonazol', 'Antijamur azol', '1 µg'],
  ['AMB', 'Amfoterisin B', 'Antijamur polien', null],
  ['CAS', 'Kaspofungin', 'Antijamur ekinokandin', null],
  ['MIF', 'Mikafungin', 'Antijamur ekinokandin', null],
];

// Panel standar per kelompok (urutan tampil laporan).
const PANEL = {
  ENTEROBACTERALES: ['AMP', 'AMC', 'SAM', 'TZP', 'CZO', 'CXM', 'FOX', 'CTX', 'CRO', 'CAZ', 'FEP', 'ATM', 'ETP', 'IPM', 'MEM', 'GEN', 'AMK', 'CIP', 'LVX', 'SXT', 'NIT', 'FOS', 'TGC', 'CHL'],
  PSEUDOMONAS: ['TZP', 'CAZ', 'FEP', 'CZA', 'ATM', 'IPM', 'MEM', 'AMK', 'CIP', 'LVX', 'COL'],
  ACINETOBACTER: ['SAM', 'TZP', 'CAZ', 'FEP', 'IPM', 'MEM', 'GEN', 'AMK', 'CIP', 'LVX', 'SXT', 'MNO', 'TGC', 'COL'],
  NONFERMENTER: ['CAZ', 'MEM', 'SXT', 'LVX', 'MNO', 'CHL'],
  STAPHYLOCOCCUS: ['PEN', 'OXA', 'FOX', 'ERY', 'CLI', 'GEN', 'CIP', 'LVX', 'MFX', 'SXT', 'TCY', 'DOX', 'VAN', 'TEC', 'LNZ', 'RIF', 'NIT', 'CHL'],
  ENTEROCOCCUS: ['AMP', 'PEN', 'GEH', 'VAN', 'TEC', 'LNZ', 'CIP', 'LVX', 'NIT', 'FOS', 'TGC', 'DOX'],
  STREPTOCOCCUS: ['PEN', 'AMP', 'CTX', 'CRO', 'FEP', 'ERY', 'CLI', 'LVX', 'TCY', 'VAN', 'LNZ', 'CHL'],
  PNEUMOCOCCUS: ['OXA', 'PEN', 'CTX', 'CRO', 'MEM', 'ERY', 'CLI', 'LVX', 'MFX', 'SXT', 'TCY', 'VAN', 'LNZ', 'CHL'],
  HAEMOPHILUS: ['AMP', 'AMC', 'CTX', 'CRO', 'MEM', 'AZM', 'CIP', 'LVX', 'SXT', 'CHL'],
  ANAEROB: ['PEN', 'AMC', 'TZP', 'MEM', 'CLI', 'MTZ', 'CHL'],
  JAMUR: ['FLU', 'VOR', 'AMB', 'CAS', 'MIF'],
  MIKOBAKTERIA: ['RIF', 'INH', 'EMB', 'PZA', 'STR', 'LVX', 'MFX', 'AMK'],
};

// Semua baris hasil kueri: pakai ctx.db bila ada, selain itu ctx.satu (satu baris).
const baris = async (ctx, sql, p) => (ctx.db ? (await ctx.db.query(sql, p)).rows : [await ctx.satu(sql, p)].filter(Boolean));

async function seed(ctx) {
  const { ins, F, base, rupiah } = ctx;
  const fUuid = base.faskes_uuid;
  const tingkat = TINGKAT[F.segmen] ?? 0;

  const kodeAda = async (tabel) => new Map((await baris(ctx, `SELECT uuid, kode FROM ${tabel} WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [fUuid])).map((r) => [r.kode, r.uuid]));

  const pemeriksaanAda = await kodeAda('mikro_pemeriksaan');
  let pBaru = 0;
  for (const [kode, nama, jenis, spesimen, pewarnaan, kultur, ast, harga, tat, metode, min] of PEMERIKSAAN) {
    if (min > tingkat || pemeriksaanAda.has(kode)) continue;
    pemeriksaanAda.set(kode, await ins('mikro_pemeriksaan', {
      ...base, kode, nama, jenis, spesimen, dengan_pewarnaan: pewarnaan, dengan_kultur: kultur, dengan_ast: ast,
      harga: rupiah(harga * (F.skala ?? 1)), tat_hari: tat, metode, status: true,
    }));
    pBaru++;
  }

  const organismeAda = await kodeAda('mikro_organisme');
  let oBaru = 0;
  for (const [kode, nama, gram, bentuk, kelompok, whonet] of ORGANISME) {
    if (organismeAda.has(kode)) continue;
    organismeAda.set(kode, await ins('mikro_organisme', { ...base, kode, nama, gram, bentuk, kelompok, kode_whonet: whonet, status: true }));
    oBaru++;
  }

  const abAda = await kodeAda('mikro_antibiotik');
  let aBaru = 0;
  for (const [kode, nama, golongan, potensi] of ANTIBIOTIK) {
    if (abAda.has(kode)) continue;
    abAda.set(kode, await ins('mikro_antibiotik', { ...base, kode, nama, golongan, potensi_disk: potensi, status: true }));
    aBaru++;
  }

  const panelAda = new Set((await baris(ctx, `SELECT DISTINCT kelompok FROM mikro_panel_antibiotik WHERE faskes_uuid = $1 AND deleted_at IS NULL`, [fUuid])).map((r) => r.kelompok));
  let panelBaru = 0;
  for (const [kelompok, kode] of Object.entries(PANEL)) {
    if (panelAda.has(kelompok)) continue;
    let urutan = 0;
    for (const k of kode) {
      if (!abAda.has(k)) continue;
      await ins('mikro_panel_antibiotik', { ...base, kelompok, antibiotik_uuid: abAda.get(k), urutan: ++urutan });
    }
    panelBaru++;
  }

  return `Mikrobiologi: ${pemeriksaanAda.size} pemeriksaan (+${pBaru}), ${organismeAda.size} organisme (+${oBaru}), ${abAda.size} antibiotik (+${aBaru}), +${panelBaru} panel`;
}

module.exports = { seed, PEMERIKSAAN, ORGANISME, ANTIBIOTIK, PANEL };
