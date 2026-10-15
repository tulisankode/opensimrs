import { permintaanSalah } from "../umum/respons.js";
// Helper umum (tanggal lokal, rentang, pesan ramah, nama praktisi) sama dengan Radiologi.
export { NAMA_PRAKTISI, daftarNilai, hariIni, ramah, rentangOpsional, tanggalValid, tglLokal } from "../radiologi/bersama.js";

// Konstanta & helper bersama modul Mikrobiologi Klinik.

// Jenis spesimen (kode → nama). Kode disimpan di mikro_pemeriksaan.spesimen & mikro_order_item.jenis_spesimen.
export const SPESIMEN = {
  darah: "Darah",
  urin: "Urin",
  sputum: "Sputum",
  pus: "Pus",
  swab_luka: "Swab Luka",
  feses: "Feses / Rectal Swab",
  lcs: "Cairan Otak (LCS)",
  cairan_tubuh: "Cairan Tubuh Steril (pleura, asites, sendi)",
  swab_tenggorok: "Swab Tenggorok",
  swab_nasofaring: "Swab Nasofaring",
  bilasan_bronkus: "Bilasan Bronkus (BAL)",
  jaringan: "Jaringan / Biopsi",
  ujung_kateter: "Ujung Kateter",
  swab_vagina: "Swab Vagina / Serviks",
  swab_uretra: "Swab Uretra",
  kerokan_kulit: "Kerokan Kulit / Kuku / Rambut",
  swab_mata: "Swab Mata / Konjungtiva",
  swab_telinga: "Swab Telinga",
  lain: "Lainnya",
};

// Kelompok organisme = panel antibiotik standar (mikro_panel_antibiotik.kelompok).
export const KELOMPOK = {
  ENTEROBACTERALES: "Enterobacterales",
  PSEUDOMONAS: "Pseudomonas aeruginosa",
  ACINETOBACTER: "Acinetobacter spp.",
  NONFERMENTER: "Batang Gram negatif non-fermenter lain",
  STAPHYLOCOCCUS: "Staphylococcus spp.",
  ENTEROCOCCUS: "Enterococcus spp.",
  STREPTOCOCCUS: "Streptococcus spp.",
  PNEUMOCOCCUS: "Streptococcus pneumoniae",
  HAEMOPHILUS: "Haemophilus spp.",
  ANAEROB: "Anaerob",
  JAMUR: "Jamur (Candida/kapang)",
  MIKOBAKTERIA: "Mycobacterium",
  LAIN: "Lainnya",
};

export const GRAM = { positif: "Gram positif", negatif: "Gram negatif", jamur: "Jamur", bta: "Bakteri tahan asam", lain: "Lainnya" };
export const BENTUK = { batang: "Batang", kokus: "Kokus", kokobasil: "Kokobasil", spiral: "Spiral", ragi: "Ragi (yeast)", kapang: "Kapang (mold)", lain: "Lainnya" };
export const JENIS_PEMERIKSAAN = { kultur: "Kultur", pewarnaan: "Pewarnaan / Mikroskopis", molekuler: "Molekuler", serologi: "Serologi / Antigen", lain: "Lainnya" };
export const PEWARNAAN = { gram: "Pewarnaan Gram", bta: "Pewarnaan BTA (Ziehl-Neelsen)", koh: "Sediaan KOH", tinta_india: "Tinta India", lain: "Pewarnaan lain" };
export const STATUS_KULTUR = {
  dalam_proses: "Dalam proses inkubasi",
  tidak_tumbuh: "Tidak tumbuh",
  tumbuh: "Tumbuh",
  kontaminan: "Kontaminan",
  flora_normal: "Flora normal",
};
// Penanda resistensi isolat.
export const PENANDA = {
  ESBL: "Extended-Spectrum β-Lactamase",
  MRSA: "Methicillin-Resistant S. aureus",
  MRCNS: "Methicillin-Resistant CoNS",
  CRE: "Carbapenem-Resistant Enterobacterales",
  CRAB: "Carbapenem-Resistant A. baumannii",
  CRPA: "Carbapenem-Resistant P. aeruginosa",
  VRE: "Vancomycin-Resistant Enterococcus",
  MDR: "Multidrug-Resistant",
  XDR: "Extensively Drug-Resistant",
  PDR: "Pandrug-Resistant",
};

export const STATUS_ORDER = ["order", "valid", "diproses", "selesai", "batal"];
export const STATUS_ITEM = ["menunggu", "diterima", "ditolak", "diproses", "sementara", "selesai"];
export const INTERPRETASI = ["S", "I", "R"];

export const pilihan = (obj) => Object.entries(obj).map(([kode, nama]) => ({ kode, nama }));

export const cekPilihan = (nilai, obj, nama) => {
  if (nilai === undefined || nilai === null || nilai === "") return nilai === "" ? null : nilai;
  if (!obj[nilai]) throw permintaanSalah(`${nama} harus salah satu: ${Object.keys(obj).join(", ")}`);
  return nilai;
};

// Angka opsional (null bila kosong); galat 400 bila bukan angka.
export const angkaOpsional = (v, nama) => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) throw permintaanSalah(`${nama} harus berupa angka`);
  return n;
};

export const teks = (v) => (v === undefined ? undefined : String(v ?? "").trim() || null);

// Nilai MIC dari teks (mis. "<=0.25", ">32", "4") → angka untuk dibandingkan dengan breakpoint.
export const angkaMic = (mic) => {
  const m = /^\s*(<=|>=|<|>|≤|≥)?\s*([0-9]+(?:[.,][0-9]+)?)\s*$/.exec(String(mic ?? ""));
  return m ? { op: m[1] ?? "", n: Number(m[2].replace(",", ".")) } : null;
};

// Interpretasi otomatis dari breakpoint (zona didahulukan bila diisi). Mengembalikan null bila tidak dapat ditentukan.
export const tafsir = ({ zona, mic }, bp) => {
  if (!bp) return null;
  const n = (x) => (x === null || x === undefined || x === "" ? null : Number(x));
  const zs = n(bp.bp_zona_s);
  const zr = n(bp.bp_zona_r);
  if (zona !== null && zona !== undefined && zona !== "" && zs !== null && zr !== null) {
    const z = Number(zona);
    if (z >= zs) return "S";
    if (z <= zr) return "R";
    return "I";
  }
  const ms = n(bp.bp_mic_s);
  const mr = n(bp.bp_mic_r);
  const m = angkaMic(mic);
  if (m && ms !== null && mr !== null) {
    // ">n": nilai sebenarnya ≥ n → pasti R bila n ≥ breakpoint R; "<=n": pasti S bila n ≤ breakpoint S; selain itu tak pasti.
    if ([">", ">=", "≥"].includes(m.op)) return m.n >= mr ? "R" : null;
    if (["<", "<=", "≤"].includes(m.op)) return m.n <= ms ? "S" : null;
    if (m.n <= ms) return "S";
    if (m.n >= mr) return "R";
    return "I";
  }
  return null;
};
