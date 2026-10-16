// Validasi definisi ekstensi tanpa kode (dibuat lewat SIMRS Studio). Fungsi murni → diuji di test/ekstensi.test.js.
// Laporan & template cetak = kueri SELECT tervalidasi yang dijalankan dalam transaksi READ ONLY (lihat ekstensi-service.js).

export const JENIS = ["laporan", "cetak", "formulir"];
export const TIPE_PARAMETER = ["tanggal", "teks", "angka", "pilihan"];
export const TIPE_FIELD = ["teks", "angka", "tanggal", "pilihan", "centang", "paragraf"];
export const FORMAT_KOLOM = ["teks", "angka", "rupiah", "tanggal", "tanggal_waktu"];

const KATA_TERLARANG = [
  "insert", "update", "delete", "merge", "upsert", "drop", "alter", "create", "truncate", "grant", "revoke", "copy", "call", "do",
  "execute", "prepare", "deallocate", "listen", "notify", "unlisten", "vacuum", "analyze", "refresh", "lock", "set", "reset",
  "comment", "security", "into", "returning", "cluster", "reindex", "checkpoint", "discard", "load", "import",
];
// Objek/fungsi sistem & tabel sensitif.
const POLA_TERLARANG = [
  { pola: /\bpg_\w+/i, alasan: "objek/fungsi sistem PostgreSQL (pg_*)" },
  { pola: /\binformation_schema\b/i, alasan: "information_schema" },
  { pola: /\b(dblink\w*|lo_\w+|current_setting|set_config|query_to_xml\w*|xmlparse|txid_\w+)\b/i, alasan: "fungsi sistem" },
  { pola: /\b(users|role|sessions|personal_access_tokens|refresh_tokens)\b/i, alasan: "tabel akun/sesi" },
  { pola: /\bstudio_\w+|\bekstensi\w*/i, alasan: "tabel SIMRS Studio/ekstensi" },
  { pola: /\b\w*(password|passwd|secret|token|api_key|apikey|kunci_api|private_key|client_id)\w*\b/i, alasan: "kolom rahasia" },
];

const NAMA = /^[a-z_][a-z0-9_]{0,59}$/;

// Parameter bernama :nama (bukan cast ::tipe).
export const parameterDalamSql = (sql) => [...new Set([...String(sql).matchAll(/(?<![:\w]):([a-zA-Z_]\w*)/g)].map((m) => m[1]))];

export const validasiSql = (sql, parameter = []) => {
  const galat = [];
  const teks = String(sql ?? "").trim();
  if (!teks) return ["SQL kosong"];
  if (teks.length > 20000) galat.push("SQL terlalu panjang (maks. 20.000 karakter)");
  if (/--|\/\*/.test(teks)) galat.push("Komentar SQL tidak diizinkan");
  if (teks.includes(";")) galat.push("Hanya satu pernyataan; titik koma tidak diizinkan");
  if (!/^(select|with)\b/i.test(teks)) galat.push("SQL harus diawali SELECT atau WITH");
  const kata = new Set(teks.toLowerCase().match(/\b[a-z_]+\b/g) ?? []);
  const terlarang = KATA_TERLARANG.filter((k) => kata.has(k));
  if (terlarang.length) galat.push(`Kata kunci tidak diizinkan: ${terlarang.join(", ").toUpperCase()}`);
  for (const p of POLA_TERLARANG) if (p.pola.test(teks)) galat.push(`Tidak boleh mengakses ${p.alasan}`);
  const dipakai = parameterDalamSql(teks);
  if (!dipakai.includes("faskes_uuid")) galat.push("SQL wajib memfilter faskes dengan parameter :faskes_uuid");
  const dideklarasi = new Set(parameter.map((p) => p.nama));
  const asing = dipakai.filter((p) => p !== "faskes_uuid" && !dideklarasi.has(p));
  if (asing.length) galat.push(`Parameter belum dideklarasikan: ${asing.map((p) => `:${p}`).join(", ")}`);
  return galat;
};

const validasiParameter = (parameter) => {
  const galat = [];
  if (!Array.isArray(parameter)) return ["parameter harus berupa daftar"];
  if (parameter.length > 20) galat.push("Maksimal 20 parameter");
  for (const p of parameter) {
    if (!NAMA.test(p?.nama ?? "") || p.nama === "faskes_uuid") galat.push(`Nama parameter tidak valid: ${p?.nama}`);
    if (!TIPE_PARAMETER.includes(p?.tipe)) galat.push(`Tipe parameter ${p?.nama} harus salah satu: ${TIPE_PARAMETER.join(", ")}`);
    if (p?.tipe === "pilihan" && !(Array.isArray(p.pilihan) && p.pilihan.length)) galat.push(`Parameter ${p?.nama} bertipe pilihan wajib punya daftar pilihan`);
  }
  return galat;
};

export const validasiEkstensi = (e) => {
  const galat = [];
  if (!e || typeof e !== "object") return ["Definisi ekstensi kosong"];
  if (!NAMA.test(e.kode ?? "")) galat.push("kode harus huruf kecil/angka/garis bawah (maks. 60)");
  if (!JENIS.includes(e.jenis)) galat.push(`jenis harus salah satu: ${JENIS.join(", ")}`);
  if (!String(e.nama ?? "").trim()) galat.push("nama wajib diisi");
  if (e.versi && !/^\d+\.\d+\.\d+$/.test(e.versi)) galat.push("versi harus format SemVer, mis. 1.0.0");
  const d = e.definisi ?? {};
  if (e.jenis === "laporan" || e.jenis === "cetak") {
    galat.push(...validasiParameter(d.parameter ?? []));
    galat.push(...validasiSql(d.sql, d.parameter ?? []));
    if (e.jenis === "laporan") {
      if (!Array.isArray(d.kolom) || !d.kolom.length) galat.push("laporan wajib punya daftar kolom");
      for (const k of d.kolom ?? []) {
        if (!k?.field || !k?.label) galat.push("setiap kolom wajib punya field & label");
        if (k?.format && !FORMAT_KOLOM.includes(k.format)) galat.push(`format kolom ${k.field} tidak dikenal`);
      }
    }
    if (e.jenis === "cetak") {
      const blok = d.tata_letak?.blok;
      if (!Array.isArray(blok) || !blok.length) galat.push("template cetak wajib punya tata_letak.blok");
      for (const b of blok ?? []) if (!["teks", "tabel", "tanda_tangan", "garis"].includes(b?.jenis)) galat.push(`jenis blok tidak dikenal: ${b?.jenis}`);
    }
  }
  if (e.jenis === "formulir") {
    if (!String(d.izin_modul ?? "").trim()) galat.push("formulir wajib menyebut izin_modul (modul hak akses yang boleh mengisi)");
    if (!["pasien", "kunjungan"].includes(d.kaitan)) galat.push("kaitan formulir harus pasien atau kunjungan");
    if (!Array.isArray(d.field) || !d.field.length) galat.push("formulir wajib punya field");
    const kode = new Set();
    for (const f of d.field ?? []) {
      if (!NAMA.test(f?.kode ?? "")) galat.push(`kode field tidak valid: ${f?.kode}`);
      if (kode.has(f?.kode)) galat.push(`kode field ganda: ${f?.kode}`);
      kode.add(f?.kode);
      if (!TIPE_FIELD.includes(f?.tipe)) galat.push(`tipe field ${f?.kode} harus salah satu: ${TIPE_FIELD.join(", ")}`);
      if (f?.tipe === "pilihan" && !(Array.isArray(f.pilihan) && f.pilihan.length)) galat.push(`field ${f?.kode} bertipe pilihan wajib punya daftar pilihan`);
    }
  }
  return [...new Set(galat)];
};

// Nilai parameter dari pengguna → replacements (faskes_uuid selalu dari token).
export const siapkanParameter = (definisi, nilai = {}, faskesUuid) => {
  const galat = [];
  const hasil = { faskes_uuid: faskesUuid };
  for (const p of definisi.parameter ?? []) {
    const v = nilai[p.nama];
    const kosong = v === undefined || v === null || v === "";
    if (kosong) {
      if (p.wajib) galat.push(`${p.label ?? p.nama} wajib diisi`);
      hasil[p.nama] = null;
      continue;
    }
    if (p.tipe === "angka" || p.tipe === "tanggal") {
      if (!Number.isFinite(Number(v))) galat.push(`${p.label ?? p.nama} harus angka`);
      hasil[p.nama] = Number(v);
    } else if (p.tipe === "pilihan") {
      if (!p.pilihan.map(String).includes(String(v))) galat.push(`${p.label ?? p.nama} tidak ada di pilihan`);
      hasil[p.nama] = String(v);
    } else {
      hasil[p.nama] = String(v).slice(0, 200);
    }
  }
  return { galat, nilai: hasil };
};

// Isian formulir → objek bersih sesuai field.
export const bersihkanIsian = (definisi, isian = {}) => {
  const galat = [];
  const hasil = {};
  for (const f of definisi.field ?? []) {
    const v = isian[f.kode];
    const kosong = v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length);
    if (kosong) {
      if (f.wajib) galat.push(`${f.label ?? f.kode} wajib diisi`);
      continue;
    }
    if (f.tipe === "angka" || f.tipe === "tanggal") {
      if (!Number.isFinite(Number(v))) galat.push(`${f.label ?? f.kode} harus angka`);
      else hasil[f.kode] = Number(v);
    } else if (f.tipe === "centang") hasil[f.kode] = Boolean(v);
    else if (f.tipe === "pilihan") {
      if (!f.pilihan.map(String).includes(String(v))) galat.push(`${f.label ?? f.kode} tidak ada di pilihan`);
      else hasil[f.kode] = String(v);
    } else hasil[f.kode] = String(v).slice(0, f.tipe === "paragraf" ? 5000 : 500);
  }
  return { galat, isian: hasil };
};
