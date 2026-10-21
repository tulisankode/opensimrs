// Audit cepat halaman (Asisten Pengembang, opsional — hanya bila diklik): pemeriksaan statis tanpa AI atas berkas
// halaman (komponen Vue + impor lokal) dan berkas backend yang melayani endpoint-nya. Lima aspek:
// fungsional, query, relasi, logika, keamanan. Hasil heuristik bertanda "perlu dicek" — bukan vonis; temuan bisa
// dijadikan permintaan Studio. Rancangan: docs/rancangan/STUDIO-ASISTEN-KONTEKS.md §6a.
import fs from "fs";
import path from "path";
import config from "./config.js";
import { POLA_RAHASIA } from "./kebijakan.js";
import { definisiKelas, imporKelas, periksaPanggilan } from "./audit-lintas.js";

export const ASPEK = ["fungsional", "query", "relasi", "logika", "keamanan"];
// Naikkan setiap aturan berubah; frontend memperingatkan bila studio-service yang berjalan masih versi lama.
export const VERSI_AUDIT = 4;
const URUT_TINGKAT = { tinggi: 0, sedang: 1, rendah: 2 };
const BATAS_BUKTI = 5;
const BATAS_TEMUAN = 80;
const BATAS_BERKAS_FRONTEND = 40;
const BATAS_BERKAS_BACKEND = 15;
const UKURAN_MAKS = 400 * 1024;

// ── Utilitas teks
const nomorBaris = (isi, indeks) => isi.slice(0, indeks).split("\n").length;
const barisKomentar = (b) => /^\s*(\/\/|\*|\/\*|<!--)/.test(b);
const POLA_UUID = /["'`][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}["'`]/i;

// Kumpulan temuan: judul sama di berkas sama digabung (bukti baris ditumpuk).
const pengumpul = () => {
  const peta = new Map();
  const tambah = (aspek, tingkat, judul, rincian, berkas, baris = null) => {
    const kunci = `${aspek}|${judul}|${berkas ?? ""}`;
    const ada = peta.get(kunci);
    if (ada) {
      if (baris && ada.bukti.length < BATAS_BUKTI && !ada.bukti.some((b) => b.baris === baris)) ada.bukti.push({ berkas, baris });
      ada.jumlah++;
      return;
    }
    peta.set(kunci, { aspek, tingkat, judul, rincian, bukti: berkas ? [{ berkas, baris }] : [], jumlah: 1 });
  };
  return { tambah, hasil: () => [...peta.values()] };
};

// ── Skema basis data: tabel → punya kolom faskes_uuid / deleted_at (schema.sql + migrasi + model SDK).
export const skemaDariTeks = ({ schemaSql = "", migrasi = [], model = [] } = {}) => {
  const tabel = new Map();
  const catat = (nama, badan) => {
    if (!nama) return;
    nama = nama.toLowerCase();
    const ada = tabel.get(nama) ?? { faskes: false, deletedAt: false };
    if (badan != null) {
      ada.faskes ||= /\bfaskes_uuid\b/.test(badan);
      ada.deletedAt ||= /\bdeleted_at\b/.test(badan);
    }
    tabel.set(nama, ada);
  };
  for (const m of schemaSql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?"?(\w+)"? \(([\s\S]*?)\n\);/g)) catat(m[1], m[2]);
  for (const m of schemaSql.matchAll(/CREATE (?:OR REPLACE )?(?:MATERIALIZED )?VIEW (?:public\.)?"?(\w+)"?/g)) catat(m[1], null);
  for (const isi of migrasi) {
    for (const m of isi.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?"?(\w+)"?\s*\(/gi)) {
      const sisa = isi.slice(m.index + m[0].length);
      const akhir = sisa.search(/CREATE TABLE/i);
      catat(m[1], sisa.slice(0, akhir < 0 ? 6000 : Math.min(akhir, 6000)));
    }
    // Tabel dinamis: const tabel = { hr_pola_shift: `kolom…` } + CREATE TABLE IF NOT EXISTS ${nama} (uuid…, faskes_uuid…, deleted_at…)
    // atau dengan awalan & konstanta kolom: CREATE TABLE IF NOT EXISTS hr_gaji_${nama} (…, ${WAKTU}, …)
    const dinamis = isi.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w*)\$\{\w+\}\s*\(([\s\S]{0,800}?)\)`/);
    if (dinamis) {
      const konstanta = new Map([...isi.matchAll(/\bconst\s+([A-Z_][A-Z0-9_]*)\s*=\s*(["'`])([^"'`]*)\2/g)].map((m) => [m[1], m[3]]));
      const umum = dinamis[2].replace(/\$\{(\w+)\}/g, (x, n) => konstanta.get(n) ?? "");
      for (const m of isi.matchAll(/^\s*["']?([a-z][a-z0-9_]+)["']?\s*:\s*`([^`]*)`/gm)) catat(`${dinamis[1]}${m[1]}`, `${m[2]}\n${umum}`);
    }
    for (const m of isi.matchAll(/createTable\(\s*["'](\w+)["']/g)) {
      const sisa = isi.slice(m.index + m[0].length);
      const akhir = sisa.search(/createTable\(/);
      catat(m[1], sisa.slice(0, akhir < 0 ? 6000 : Math.min(akhir, 6000)));
    }
    for (const m of isi.matchAll(/ALTER TABLE (?:IF EXISTS )?(?:ONLY )?(?:public\.)?"?(\w+)"?([^;`]*)/gi)) catat(m[1], m[2]);
    for (const m of isi.matchAll(/addColumn\(\s*["'](\w+)["']\s*,\s*["'](\w+)["']/g)) catat(m[1], m[2]);
    for (const m of isi.matchAll(/CREATE (?:OR REPLACE )?(?:MATERIALIZED )?VIEW (?:IF NOT EXISTS )?(?:public\.)?"?(\w+)"?/gi)) catat(m[1], null);
  }
  for (const isi of model) for (const m of isi.matchAll(/tableName:\s*["'](\w+)["']/g)) catat(m[1], isi);
  return tabel;
};

// ── Pernyataan SQL di dalam string kode (backtick atau kutip satu baris) yang memakai kata kunci SQL huruf besar.
// Pemindai sederhana: template literal bersarang (`… ${xs.map((c) => `${c} = $1`)} WHERE …` dibaca utuh), komentar, dan
// literal regex dilewati. konstanta = string yang disimpan ke konstanta HURUF_BESAR (fragmen, mis. PILIH_SURAT).
const POLA_SQL = /\b(SELECT\b[\s\S]*\bFROM|INSERT INTO|UPDATE\s+[\w."]+\s+SET|DELETE FROM)\b/;
export const pernyataanSql = (isi) => {
  const hasil = [];
  const n = isi.length;
  let i = 0;
  const lewatiKutip = (q) => {
    let teks = "";
    i++;
    while (i < n && isi[i] !== q && isi[i] !== "\n") {
      if (isi[i] === "\\") {
        teks += isi.slice(i, i + 2);
        i += 2;
        continue;
      }
      teks += isi[i++];
    }
    i++;
    return teks;
  };
  const lewatiRegex = () => {
    i++;
    let kelas = false;
    while (i < n && isi[i] !== "\n") {
      if (isi[i] === "\\") i++;
      else if (isi[i] === "[") kelas = true;
      else if (isi[i] === "]") kelas = false;
      else if (isi[i] === "/" && !kelas) break;
      i++;
    }
    i++;
  };
  let bacaTemplate;
  const lewatiEkspresi = () => {
    let dalam = 1;
    while (i < n && dalam) {
      const c = isi[i];
      if (c === "`") {
        i++;
        bacaTemplate();
        continue;
      }
      if (c === '"' || c === "'") {
        lewatiKutip(c);
        continue;
      }
      if (c === "{") dalam++;
      else if (c === "}") dalam--;
      i++;
    }
  };
  bacaTemplate = () => {
    let teks = "";
    while (i < n && isi[i] !== "`") {
      if (isi[i] === "\\") {
        teks += isi.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (isi[i] === "$" && isi[i + 1] === "{") {
        const mulai = i;
        i += 2;
        lewatiEkspresi();
        teks += isi.slice(mulai, i);
        continue;
      }
      teks += isi[i++];
    }
    i++;
    return teks;
  };
  while (i < n) {
    const c = isi[i];
    if (c === "/" && isi[i + 1] === "/") {
      const akhir = isi.indexOf("\n", i);
      i = akhir < 0 ? n : akhir;
      continue;
    }
    if (c === "/" && isi[i + 1] === "*") {
      const akhir = isi.indexOf("*/", i + 2);
      i = akhir < 0 ? n : akhir + 2;
      continue;
    }
    if (c === "/" && /(^|[(,=:[!&|?{};+\-*%<>~^]|\breturn)\s*$/.test(isi.slice(Math.max(0, i - 12), i))) {
      lewatiRegex();
      continue;
    }
    if (c === "`" || c === '"' || c === "'") {
      const mulai = i;
      let sql;
      if (c === "`") {
        i++;
        sql = bacaTemplate();
      } else sql = lewatiKutip(c);
      if (sql.length > 15 && POLA_SQL.test(sql)) {
        const konstanta = /\bconst\s+[A-Z][A-Z0-9_]*\s*=\s*$/.test(isi.slice(Math.max(0, mulai - 60), mulai));
        hasil.push({ sql, baris: nomorBaris(isi, mulai), konstanta });
      }
      continue;
    }
    i++;
  }
  return hasil;
};

const BUKAN_TABEL = new Set(["select", "set", "lateral", "only", "where", "on", "using", "as", "unnest", "generate_series", "now",
  "information_schema", "pg_catalog", "excluded", "values", "jsonb_array_elements", "jsonb_to_recordset", "json_array_elements",
  "jsonb_each", "jsonb_each_text", "jsonb_array_elements_text", "regexp_split_to_table", "string_to_array", "dual", "of", "skip", "nowait"]);
const KATA_KUNCI = new Set(["on", "using", "where", "left", "right", "inner", "outer", "full", "cross", "join", "group", "order",
  "limit", "offset", "natural", "union", "and", "or", "returning", "set", "values", "having", "window", "for"]);

// Tabel yang dirujuk satu pernyataan SQL: { nama, alias, peran: from|join|leftjoin|into|update|delete }.
export const tabelDalamSql = (sql) => {
  const cte = new Set([...sql.matchAll(/(?:\bWITH(?:\s+RECURSIVE)?|,)\s*(\w+)\s+AS\s*(?:MATERIALIZED\s*)?\(/gi)].map((m) => m[1].toLowerCase()));
  const hasil = [];
  const pola = /\b(LEFT\s+(?:OUTER\s+)?JOIN|RIGHT\s+(?:OUTER\s+)?JOIN|FULL\s+(?:OUTER\s+)?JOIN|INNER\s+JOIN|CROSS\s+JOIN|JOIN|DELETE\s+FROM|FROM|INSERT\s+INTO|UPDATE)\s+(?:ONLY\s+)?(?:public\.)?"?([A-Za-z_]\w*)\b"?(?:\s+(?:AS\s+)?"?([A-Za-z_]\w*)\b"?)?/g;
  for (const m of sql.matchAll(pola)) {
    const kata = m[1].toUpperCase().replace(/\s+/g, " ");
    const nama = m[2].toLowerCase();
    // Pemanggilan fungsi (FROM generate_series(…)), EXTRACT(EPOCH FROM kolom), SUBSTRING(x FROM …) — bukan tabel.
    const sisaNama = sql.slice(m.index + m[0].indexOf(m[2], m[1].length) + m[2].length);
    if (kata !== "INSERT INTO" && /^"?\s*\(/.test(sisaNama)) continue;
    if (/^"?\s*\)/.test(sisaNama) || (kata === "FROM" && /\(\s*\w+\s+$/.test(sql.slice(Math.max(0, m.index - 30), m.index)))) continue;
    if (BUKAN_TABEL.has(nama) || cte.has(nama) || /^pg_/.test(nama)) continue;
    let alias = m[3]?.toLowerCase() ?? null;
    if (!alias || KATA_KUNCI.has(alias)) alias = nama;
    const peran = kata.startsWith("LEFT") ? "leftjoin" : kata.includes("JOIN") ? "join" : kata === "INSERT INTO" ? "into" : kata === "UPDATE" ? "update" : kata === "DELETE FROM" ? "delete" : "from";
    hasil.push({ nama, alias, peran });
  }
  return hasil;
};

const klausaWhere = (sql) => {
  const i = sql.search(/\bWHERE\b(?![\s\S]*\bWHERE\b)/);
  if (i < 0) return "";
  const sisa = sql.slice(i + 5);
  const akhir = sisa.search(/\b(GROUP BY|ORDER BY|LIMIT|OFFSET|RETURNING|UNION)\b/);
  return akhir < 0 ? sisa : sisa.slice(0, akhir);
};
// Nama variabel penampung fragmen SQL (huruf kecil, tanpa memandang besar-kecil) atau konstanta HURUF_BESAR (peka huruf).
const POLA_NAMA_FRAGMEN = /^(where\w*|kondisi\w*|filter\w*|klausa\w*|urut\w*|order\w*|limit\w*|batas\w*|sql\w*|kolom\w*|tabel\w*|join\w*|syarat\w*|cari\w*)$/i;
const NAMA_FRAGMEN = { test: (s) => POLA_NAMA_FRAGMEN.test(s) || /^[A-Z][A-Z0-9_]*$/.test(s) };

// ── Pemeriksaan per berkas. jenis: "frontend" | "backend". skema: hasil skemaDariTeks (boleh null).
export const periksaBerkas = ({ path: berkas, isi, jenis }, skema = null, kumpul = pengumpul()) => {
  const { tambah } = kumpul;
  const baris = isi.split("\n");
  const tiapBaris = (pola, fn) => baris.forEach((b, i) => {
    if (!barisKomentar(b) && pola.test(b)) fn(b, i + 1);
  });

  // Umum (frontend & backend)
  baris.forEach((b, i) => {
    if (/\b(TODO|FIXME|HACK)\b/.test(b)) tambah("fungsional", "rendah", "Penanda pekerjaan belum selesai", "Ada TODO/FIXME: perilaku di bagian ini mungkin belum lengkap atau masih ambigu", berkas, i + 1);
  });
  for (const m of isi.matchAll(/catch\s*(\(\s*\w*\s*\))?\s*\{\s*\}/g)) {
    tambah("logika", "sedang", "Galat ditelan diam-diam", "Blok catch kosong: kegagalan tidak dilaporkan ke pengguna maupun log, sehingga data bisa tampak tersimpan padahal gagal", berkas, nomorBaris(isi, m.index));
  }
  tiapBaris(/\.forEach\(\s*async\b/, (b, n) => tambah("logika", "tinggi", "forEach dengan fungsi async", "forEach tidak menunggu await: proses berikutnya/response terkirim sebelum semua langkah selesai dan galatnya tidak tertangkap (pakai for…of atau Promise.all)", berkas, n));
  tiapBaris(/\b(eval|new Function)\s*\(/, (b, n) => tambah("keamanan", "tinggi", "Eksekusi kode dinamis", "eval/new Function membuka celah eksekusi kode", berkas, n));
  for (const r of POLA_RAHASIA) tiapBaris(r.pola, (b, n) => tambah("keamanan", "tinggi", `Rahasia tertanam (${r.nama})`, "Nilai rahasia/alamat server tidak boleh ada di kode publik; pindahkan ke .env atau pengaturan", berkas, n));
  tiapBaris(POLA_UUID, (b, n) => tambah("logika", "rendah", "UUID tertanam di kode", "Nilai UUID literal biasanya data faskes/master tertentu — tidak berlaku di faskes lain (perlu dicek)", berkas, n));

  if (jenis === "frontend") {
    tiapBaris(/(^|[^.\w])(window\.)?(prompt|confirm|alert)\s*\(/, (b, n) => tambah("fungsional", "sedang", "Dialog bawaan peramban", "prompt()/confirm()/alert() tidak seragam dan memblokir; pakai CustomDialog", berkas, n));
    tiapBaris(/((label|placeholder|placeHolder)\s*[=:]\s*(["'])[^"'\n]*\bUUID\b[^"'\n]*\3)|(<label[^>]*>[^<{]*\bUUID\b)/, (b, n) => tambah("fungsional", "sedang", "Pengguna diminta mengetik UUID", "Isian UUID membingungkan pengguna; pakai pilihan berlabel nama", berkas, n));
    tiapBaris(/\bfrom\s*["'](@\/main|(\.\.?\/)+main)(\.ts)?["']/, (b, n) => tambah("fungsional", "tinggi", "Import @/main melingkar", "Mengimpor main.ts dari halaman menyebabkan layar putih; pakai @/utils/aplikasi", berkas, n));
    tiapBaris(/\bv-html\s*=/, (b, n) => tambah("keamanan", "sedang", "v-html", "HTML mentah dari data bisa menjadi celah XSS; pastikan isinya disanitasi atau pakai teks biasa", berkas, n));
    tiapBaris(/console\.(log|info|debug)\(.*\b(token|password|sandi|secret|nik)\b/i, (b, n) => tambah("keamanan", "sedang", "Data sensitif ke console", "Token/sandi/NIK tercetak di console peramban", berkas, n));
    // Data pasien memakai "Laki-laki"/"Perempuan" (baru) maupun "Male"/"Female" (lama): satu bentuk saja → salah tampil.
    tiapBaris(/gender\s*[!=]==?\s*["'](Female|Male)["']|["'](Female|Male)["']\s*[!=]==?\s*[\w.?]*gender/i, (b, n) => tambah("fungsional", "sedang", "Kelamin hanya dicek satu bentuk", "Perbandingan hanya 'Female'/'Male'; pasien baru tersimpan 'Perempuan'/'Laki-laki' sehingga tampil salah — bandingkan kedua bentuk", berkas, n));
    if (/Page\.vue$/.test(berkas) && !/studio:\s*tanpa-toolbar/.test(isi) && !(/<Card\b/.test(isi) && /PageToolbar/.test(isi))) {
      tambah("fungsional", "rendah", "Halaman tanpa Card + PageToolbar", "Pola halaman OpenSIMRS: Card + PageToolbar (judul h1.toolbar-heading) + komponen Custom*", berkas, null);
    }
    return kumpul;
  }

  // Backend
  // Payload diubah ke camelCase lalu disimpan lewat repository: bila atribut model snake_case (nama_layar, tipe_layar),
  // Sequelize diam-diam mengabaikannya sehingga perubahan tidak tersimpan (bug Layar Antrian).
  if (/\btoCamelCase\s*\(/.test(isi) && /\b\w*Repository\.(create|update|bulkCreate|upsert)\w*\s*\(/.test(isi)) {
    const n = nomorBaris(isi, isi.search(/\btoCamelCase\s*\(/));
    tambah("logika", "sedang", "Payload camelCase sebelum disimpan", "Data diubah ke camelCase lalu disimpan lewat repository: pastikan atribut model juga camelCase (atribut snake_case diabaikan Sequelize tanpa galat, sehingga perubahan tidak tersimpan) (perlu dicek)", berkas, n);
  }
  // Join wajib ke alamat/tanggal lahir menyembunyikan pasien yang datanya belum lengkap dari daftar & laporan.
  tiapBaris(/(?<!LEFT\s)(?<!LEFT OUTER\s)\bJOIN\s+(addresses|birth_details)\b/, (b, n) => tambah("relasi", "rendah", "Join wajib ke alamat/tanggal lahir", "INNER JOIN ke addresses/birth_details: pasien tanpa alamat atau tanggal lahir hilang dari hasil — pakai LEFT JOIN bila hanya untuk tampilan (perlu dicek)", berkas, n));
  for (const m of isi.matchAll(/as:\s*["'](address|addresses|birth_detail|birthDetail)["'][^}]{0,200}?required:\s*true|required:\s*true[^}]{0,200}?as:\s*["'](address|addresses|birth_detail|birthDetail)["']/g)) {
    tambah("relasi", "rendah", "Join wajib ke alamat/tanggal lahir", "Include Sequelize required: true ke alamat/tanggal lahir: pasien yang datanya belum lengkap hilang dari daftar & laporan (perlu dicek)", berkas, nomorBaris(isi, m.index));
  }
  // Membaca faskes_uuid dari masukan; menimpanya dari JWT (req.body.faskes_uuid = req.author.faskesUuid) justru benar.
  tiapBaris(/req\.(body|query|params)\??\.faskes_uuid\b(?!\s*=[^=])|\{[^}]*\bfaskes_uuid\b[^}]*\}\s*=\s*req\.(body|query|params)/, (b, n) => tambah("keamanan", "tinggi", "faskes_uuid dari masukan pengguna", "faskes_uuid wajib diambil dari JWT (req.author/req.user), bukan body/query — pengguna bisa membaca/mengubah data faskes lain", berkas, n));
  tiapBaris(/console\.(log|info|debug)\(\s*req\.(body|query|headers)/, (b, n) => tambah("keamanan", "rendah", "Isi permintaan ditulis ke log", "Body/header permintaan bisa berisi data pasien atau token", berkas, n));
  tiapBaris(/(message|pesan|error)\s*:\s*\w+\.stack\b/, (b, n) => tambah("keamanan", "rendah", "Stack trace dikirim ke klien", "Detail internal server ikut ke respons", berkas, n));
  tiapBaris(/Date\.now\(\)(?!\s*\/\s*1000)/, (b, n) => {
    if (!/Math\.(floor|round|trunc)\s*\(\s*Date\.now\(\)\s*\/\s*1000/.test(b) && !/(setTimeout|setInterval|performance|mulai|durasi|selisih|lama|ms\b)/i.test(b)) {
      tambah("logika", "rendah", "Waktu milidetik", "Konvensi OpenSIMRS: waktu disimpan epoch detik (Math.floor(Date.now() / 1000)) — perlu dicek bila nilai ini masuk DB/API", berkas, n);
    }
  });
  if (/\b(router|rute|app)\.(get|post|put|patch|delete)\s*\(/.test(isi) && /(^|\/)(\w+-)?rute?s?\.js$|routes?\//.test(berkas)
    && !/\b(wajib\w*|izin\w*|pastikan\w*|authorize\w*|permission\w*|verif\w*|auth\w*|cekAkses\w*|middleware)\b/i.test(isi)) {
    tambah("keamanan", "rendah", "Rute tanpa pemeriksaan izin terlihat", "Tidak ada middleware login/izin di berkas rute ini — pastikan dipasang di router induk (perlu dicek)", berkas, null);
  }

  const sql = pernyataanSql(isi);
  const tulis = sql.filter((s) => /\b(INSERT INTO|UPDATE\s+[\w."]+\s+SET|DELETE FROM)\b/.test(s.sql));
  if (tulis.length >= 2 && !/transaction|transaksi|\bBEGIN\b|denganTransaksi|sequelize\.transaction/i.test(isi)) {
    tambah("logika", "rendah", "Beberapa penulisan tanpa transaksi", `${tulis.length} perintah tulis di berkas ini tanpa transaksi: bila satu gagal di tengah, data setengah jadi tertinggal (perlu dicek)`, berkas, tulis[0].baris);
  }
  for (const { sql: q, baris: n, konstanta } of sql) {
    if (/[^<]<:[a-zA-Z_]/.test(q)) tambah("query", "tinggi", "Parameter menempel pada \"<\"", "Sequelize tidak mengganti \"<:param\" → syntax error; tulis \"kolom < :param\"", berkas, n);
    if (/\bSELECT\s+\*\s+FROM\b/.test(q)) tambah("query", "rendah", "SELECT *", "Mengambil semua kolom (termasuk kolom sensitif/besar); sebutkan kolom yang dibutuhkan", berkas, n);
    // Fragmen konstanta (const PILIH_SURAT = `SELECT … FROM t`) dilengkapi WHERE/LIMIT di tempat pemakaiannya.
    if (konstanta) continue;
    if (/\bORDER BY\b/.test(q) && !/\b(LIMIT|FETCH FIRST)\b/.test(q) && !/\$\{[^}]*(limit|batas|halaman|page)/i.test(q)) {
      tambah("query", "rendah", "Daftar tanpa batas baris", "Query berurutan tanpa LIMIT: lambat dan berat saat data tumbuh (perlu dicek bila memang sengaja)", berkas, n);
    }
    if (/^\s*(UPDATE\s+[\w."]+\s+SET|DELETE FROM)\b/.test(q) && !/\bWHERE\b/.test(q)) {
      tambah("logika", "tinggi", "UPDATE/DELETE tanpa WHERE", "Perintah mengubah/menghapus seluruh tabel", berkas, n);
    }
    // $${params.length + 1} = nomor parameter posisi ($3), bukan nilai.
    const sisipan = [...q.matchAll(/(\$?)\$\{([^}]*)\}/g)].filter((m) => !m[1]).map((m) => m[2].trim());
    // Fragmen dinamis (WHERE ${kondisi}) bisa sudah memuat faskes_uuid/deleted_at → cek isolasi & soft delete tidak pasti.
    const fragmenDinamis = sisipan.some((s) => {
      const nama = s.match(/^\w+/)?.[0] ?? ""; // kondisi.join(" AND ") → kondisi
      return NAMA_FRAGMEN.test(nama) && !/^tabel\w*$/i.test(nama);
    });
    if (sisipan.length) {
      const liar = sisipan.filter((s) => !NAMA_FRAGMEN.test(s) && !/^[A-Z][A-Z0-9_]*\(/.test(s) &&!/^(\w+\.)*(join|map)\(/.test(s) && !/^[\w.?!\s]+(\?|&&)\s*["'`]/.test(s));
      if (sisipan.some((s) => /\breq\./.test(s))) tambah("keamanan", "tinggi", "Masukan pengguna disisipkan ke SQL", "Nilai dari req disisipkan langsung ke SQL → SQL injection; pakai replacements/parameter", berkas, n);
      // Nama sederhana (${offset}, ${set}, ${c} dari daftar kolom) → rendah; ekspresi anggota/panggilan (${data.nama}) → sedang.
      else if (liar.length) tambah("keamanan", liar.every((s) => /^\w+$/.test(s)) ? "rendah" : "sedang", "Nilai disisipkan ke string SQL", `Sisipan \${${liar.slice(0, 3).join("}, ${")}} di SQL — pastikan bukan masukan pengguna (pakai parameter :nama)`, berkas, n);
    }

    if (!skema) continue;
    const tabel = tabelDalamSql(q);
    const where = klausaWhere(q);
    for (const t of tabel) {
      const info = skema.get(t.nama);
      if (!info) {
        tambah("relasi", "sedang", `Tabel "${t.nama}" tidak dikenal`, "Tidak ditemukan di schema.sql, migrasi, maupun model SDK — salah nama, tabel belum dimigrasi, atau alias/CTE (perlu dicek)", berkas, n);
        continue;
      }
      if (["join", "leftjoin"].includes(t.peran) && info.deletedAt && !new RegExp(`\\b${t.alias}\\.deleted_at\\b`).test(q) && t.alias !== t.nama) {
        tambah("relasi", "rendah", "JOIN ke baris yang sudah dihapus", `JOIN ${t.nama} ${t.alias} tanpa ${t.alias}.deleted_at IS NULL: bila untuk memilih data aktif, baris terhapus ikut tampil; bila untuk nama di riwayat transaksi, ini memang benar (perlu dicek)`, berkas, n);
      }
      if (t.peran === "leftjoin" && where && new RegExp(`\\b${t.alias}\\.\\w+\\s*(=|<>|!=|>|<|\\bIN\\b|\\bLIKE\\b|\\bILIKE\\b)`, "i").test(where)
        && !new RegExp(`\\b${t.alias}\\.\\w+\\s+IS\\s+(NOT\\s+)?NULL`, "i").test(where) && !/\bOR\b/i.test(where)) {
        tambah("relasi", "rendah", "LEFT JOIN berubah menjadi INNER JOIN", `Syarat atas ${t.alias}.* di WHERE membuang baris tanpa pasangan; pindahkan syarat ke ON bila maksudnya tetap menampilkan semua baris (perlu dicek)`, berkas, n);
      }
      if (["from", "update", "delete"].includes(t.peran) && !fragmenDinamis) {
        if (info.faskes && !/\bfaskes_uuid\b/.test(q)) {
          // Akses lewat kunci (id/uuid/username/*_uuid) biasanya memakai baris yang sudah diambil dengan filter faskes
          // → rendah, cukup dicek asal kuncinya. Tanpa kunci & tanpa faskes_uuid → seluruh faskes ikut terbaca/terubah.
          const perKunci = new RegExp(`\\b(${t.alias}\\.)?(id|uuid|username|\\w+_uuid|\\w+_id)\\s*=`).test(where);
          if (perKunci) {
            tambah("keamanan", "rendah", "Akses per kunci tanpa faskes_uuid", `${t.nama} diakses lewat kunci tanpa faskes_uuid: aman bila kunci berasal dari baris yang sudah difilter faskes; berisiko bila kunci langsung dari permintaan (perlu dicek)`, berkas, n);
          } else {
            tambah("keamanan", "tinggi", "Query tanpa isolasi faskes", `${t.nama} punya kolom faskes_uuid tetapi query tidak memfilternya: data faskes lain ikut terbaca/terubah`, berkas, n);
          }
        }
        if (info.deletedAt && t.peran !== "update" && t.peran !== "delete" && !/\bdeleted_at\b/.test(q)) {
          // MAX(...) untuk penomoran memang sering sengaja ikut menghitung baris terhapus.
          const penomoran = /\bMAX\s*\(/i.test(q) && !/\b(COUNT|SUM|AVG)\s*\(/i.test(q);
          tambah("query", penomoran ? "rendah" : "sedang", "Data terhapus ikut terbaca", `${t.nama} memakai soft delete (deleted_at) tetapi query tidak menyaring deleted_at IS NULL${penomoran ? " (MAX untuk penomoran bisa disengaja)" : ""}`, berkas, n);
        }
      }
    }
  }
  return kumpul;
};

// ── Pelacakan endpoint → berkas backend.
const LAYANAN_PREFIX = {
  admisi: "admisi-service", antrian: "antrian-service", auth: "auth-service", bpjs: "bpjs-service", laporan: "laporan-service",
  datamaster: "datamaster-service", farmasi: "farmasi-service", pelayanan: "igd-service", inventory: "inventory-service",
  lab: "lab-service", payment: "payment-service", penunjang: "penunjang-service", "program-puskesmas": "program-puskesmas-service",
  ranap: "rawat-inap-service", "rawat-jalan": "rawat-jalan-service", rajal: "rawat-jalan-service", satusehat: "satusehat-service",
  setting: "setting-service", studio: "studio-service",
};
const LAYANAN_HELPER = {
  Auth: "auth-service", Setting: "setting-service", Datamaster: "datamaster-service", Pembayaran: "payment-service",
  Laboratorium: "lab-service", Lis: "lab-service", Admisi: "admisi-service", Igd: "igd-service", Farmasi: "farmasi-service",
  RawatJalan: "rawat-jalan-service", RekamMedis: "rekamedis-service", RawatInap: "rawat-inap-service", Inventory: "inventory-service",
  Antrian: "antrian-service", Stok: "stok-farmasi-service", Laporan: "laporan-service", SatuSehat: "satusehat-service",
  Bpjs: "bpjs-service", Penunjang: "penunjang-service", Studio: "studio-service", ProgramPuskesmas: "program-puskesmas-service",
};
const segmenStatis = (segmen) => segmen.filter((s) => s && !s.startsWith(":") && !/^[0-9a-f-]{20,}$/i.test(s) && !/^\d+$/.test(s));

// ${uuid} → :p (kurung kurawal bersarang ikut); sisipan kueri (${kueri({...})}) yang menempel di ujung segmen dibuang.
const bersihPath = (p) => {
  let hasil = "";
  for (let i = 0; i < p.length; i++) {
    if (p[i] === "$" && p[i + 1] === "{") {
      let dalam = 1;
      i += 2;
      while (i < p.length && dalam) {
        if (p[i] === "{") dalam++;
        else if (p[i] === "}") dalam--;
        if (dalam) i++;
      }
      hasil += ":p";
    } else hasil += p[i];
  }
  return hasil.split("?")[0].replace(/([^/]):p/g, "$1");
};
const namaInstance = (n) => (n === "baseInstance" ? null : n.startsWith("baseInstance") ? n.slice(12) : n.replace(/Instance$/, "").replace(/^\w/, (x) => x.toUpperCase()));
const POLA_INSTANCE = /\b(baseInstance\w*|settingInstance|authInstance)\b/;

// Pembungkus API lokal, mis. const apiJadwal = async (path, …) => baseInstancePenunjang.request({ url: `/hr/jadwal-dinas${path}` })
// → Map nama → { helper, awalan }.
export const pembungkusDalamKode = (isi) => {
  const hasil = new Map();
  // Konstanta path di berkas yang sama (const basis = "/hr/penggajian") untuk awalan `${basis}${path}`.
  const konstanta = new Map([...isi.matchAll(/\bconst\s+(\w+)\s*=\s*["'`](\/[^"'`$\n]*)["'`]/g)].map((m) => [m[1], m[2]]));
  // const f = async (path) => …, function f(path) …, atau method store Pinia: async baca(path: string) { … }
  const definisi = [...isi.matchAll(/(?:(?:const|function)\s+(\w+)\s*=?\s*(?:async\s*)?(?:function\s*)?|^\s*(?:async\s+)?(\w+))\(\s*(\w+)/gm)];
  for (const [i, m] of definisi.entries()) {
    m[1] ??= m[2];
    m[2] = m[3];
    // Badan fungsi: sampai definisi berikutnya (maks 600 karakter).
    const badan = isi.slice(m.index, Math.min(definisi[i + 1]?.index ?? Infinity, m.index + 600));
    const inst = badan.match(POLA_INSTANCE)?.[1] ?? null;
    const helper = inst ? namaInstance(inst) : badan.match(/\bapi([A-Z][A-Za-z]*?)(?:Get|Post|Put|Patch|Delete)\b/)?.[1] ?? null;
    const mentah = badan.match(new RegExp("`((?:\\$\\{\\w+\\}|[^`$])*?)\\$\\{" + m[2] + "\\}"))?.[1];
    let awalan = mentah?.replace(/\$\{(\w+)\}/g, (x, n) => konstanta.get(n) ?? "\u0000");
    if (awalan != null && (awalan.includes("\u0000") || !awalan.startsWith("/"))) awalan = null;
    if (helper && awalan != null) hasil.set(m[1], { helper, awalan });
  }
  return hasil;
};

// Endpoint di kode frontend (helper apiXxx, instance axios langsung, pembungkus lokal) → { helper, metode, path, baris }.
export const endpointDalamKode = (isi, pembungkus = new Map()) => {
  const hasil = [];
  for (const m of isi.matchAll(/\bapi([A-Z][A-Za-z]*?)(Get|Post|Put|Patch|Delete)(?:NoMessage|Diam)?\s*\(\s*(["'`])(\/[^"'`]*?)\3/g)) {
    hasil.push({ helper: m[1], metode: m[2].toUpperCase(), path: bersihPath(m[4]), baris: nomorBaris(isi, m.index) });
  }
  for (const m of isi.matchAll(/\b(baseInstance\w*|settingInstance|authInstance)\.(get|post|put|patch|delete)\s*\(\s*(["'`])(\/[^"'`]*?)\3/g)) {
    hasil.push({ helper: namaInstance(m[1]), metode: m[2].toUpperCase(), path: bersihPath(m[4]), baris: nomorBaris(isi, m.index) });
  }
  for (const [nama, { helper, awalan }] of pembungkus) {
    const pola = new RegExp("\\b" + nama + "\\(\\s*([\"'`])(\\/?[^\"'`]*?)\\1(?:\\s*,\\s*[\"'](\\w+)[\"'])?", "g");
    for (const m of isi.matchAll(pola)) {
      hasil.push({ helper, metode: (m[3] ?? "get").toUpperCase(), path: bersihPath(awalan + m[2]), baris: nomorBaris(isi, m.index) });
    }
  }
  return hasil;
};

// { layanan, segmen } dari endpoint teramati (/api/v3/<prefix>/...) atau endpoint kode (helper + path relatif).
export const tujuanEndpoint = ({ path: p, helper }) => {
  const seg = String(p ?? "").split("?")[0].split("/").filter(Boolean);
  if (seg[0] === "api" && seg[1] === "v3") {
    const layanan = LAYANAN_PREFIX[seg[2]] ?? null;
    return { layanan, segmen: segmenStatis(layanan ? seg.slice(3) : seg.slice(2)) };
  }
  return { layanan: helper ? LAYANAN_HELPER[helper] ?? null : null, segmen: segmenStatis(seg) };
};

const FOLDER_NETRAL = new Set(["routes", "route", "routers", "router", "rute","controllers", "controller", "services", "service", "repositories", "handlers", "modules", "api"]);
// Skor berkas rute:segmen yang muncul sebagai string rute ("/segmen…") + segmen yang menjadi nama folder.
export const skorBerkasRute = (segmen, berkas) => {
  if (!segmen.length) return [];
  const terakhir = segmen[segmen.length - 1];
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const dinilai = berkas
    .map((b) => {
      // "/jadwal", "/jadwal/:uuid", atau segmen dalam daftar rute dinamis (for (const jenis of ["pola-shift", …]) `/${jenis}`).
      // Segmen terakhir bisa nilai parameter: /vclaim/referensi/poli dilayani "/vclaim/referensi/:jenis".
      const sebelum = segmen[segmen.length - 2];
      const kenaTerakhir = new RegExp(`["'\`]([^"'\`\\n]*\\/)?${esc(terakhir)}(?=["'\`/:])`).test(b.isi)
        || Boolean(sebelum && new RegExp(`["'\`][^"'\`\\n]*\\/${esc(sebelum)}\\/:\\w+["'\`]`).test(b.isi));
      // Folder di bawah src/: yang sama dengan segmen endpoint menambah skor, folder lain menguranginya
      // (hr/jadwal-dinas/rute.js untuk /hr/jadwal-dinas/jadwal, bukan fisioterapi/jadwal.js).
      const folder = b.path.split("/").slice(0, -1);
      const folderModul = folder.slice(folder.indexOf("src") + 1).filter((f) => !FOLDER_NETRAL.has(f));
      const cocokFolder = folderModul.filter((f) => segmen.includes(f)).length;
      // Nama berkas hanya menambah skor (hdu-routes.js untuk /hdu/episode menang atas nicu-routes.js); nama yang tidak
      // cocok tidak mengurangi — surat-router.js memang melayani /general-consent.
      const inti = path.basename(b.path).replace(/\.\w+$/, "").replace(/[-_.](routes?|routers?|rute|controller|service)$/, "");
      const cocokNama = segmen.includes(inti) || inti.split(/[-.]/).some((t) => segmen.includes(t)) ? 1 : 0;
      let skor = 3 * cocokFolder - 2 * (folderModul.length - cocokFolder) + 3 * cocokNama;
      for (const s of segmen) if (new RegExp(`["'\`][^"'\`\\n]*\\/${esc(s)}(?=["'\`/:])`).test(b.isi)) skor += 2;
      return { ...b, skor, kenaTerakhir };
    })
    .filter((b) => b.kenaTerakhir && b.skor > 0 && /\bRouter\s*\(|\.(get|post|put|patch|delete|use|all)\s*\(\s*["'`]\//.test(b.isi));
  if (!dinilai.length) return [];
  const terbaik = Math.max(...dinilai.map((b) => b.skor));
  return dinilai.filter((b) => b.skor === terbaik).slice(0, 2);
};

// ── Baca repo (cache per mtime).
const cacheIsi = new Map();
const baca = (abs) => {
  try {
    const st = fs.statSync(abs);
    if (st.size > UKURAN_MAKS) return null;
    const c = cacheIsi.get(abs);
    if (c?.mtime === st.mtimeMs) return c.isi;
    const isi = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
    cacheIsi.set(abs, { mtime: st.mtimeMs, isi });
    return isi;
  } catch {
    return null;
  }
};
const jelajah = (dir, ekstensi, hasil = []) => {
  let isi = [];
  try {
    isi = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return hasil;
  }
  for (const e of isi) {
    if (["node_modules", "dist", "coverage", ".git", "test", "tests", "__tests__"].includes(e.name)) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) jelajah(abs, ekstensi, hasil);
    else if (ekstensi.test(e.name) && !/\.test\.\w+$/.test(e.name)) hasil.push(abs);
  }
  return hasil;
};
const relatif = (repo, abs) => path.relative(repo, abs).split(path.sep).join("/");

let cacheSkema = { kunci: "", skema: null };
const skemaRepo = (repo) => {
  const dirMigrasi = path.join(repo, "database", "migrations");
  const berkasMigrasi = jelajah(dirMigrasi, /\.(c|m)?js$/);
  const dirModel = path.join(repo, "packages", "model-sdk");
  const berkasModel = jelajah(dirModel, /\.(c|m)?js$/);
  const schema = path.join(repo, "schema.sql");
  let mtime = 0;
  try {
    mtime = fs.statSync(schema).mtimeMs;
  } catch { /* tanpa schema.sql */ }
  const kunci = `${mtime}|${berkasMigrasi.length}|${berkasModel.length}`;
  if (cacheSkema.kunci === kunci) return cacheSkema.skema;
  let schemaSql = "";
  try {
    schemaSql = fs.readFileSync(schema, "utf8").replace(/\r\n/g, "\n");
  } catch { /* abaikan */ }
  const skema = skemaDariTeks({ schemaSql, migrasi: berkasMigrasi.map(baca).filter(Boolean), model: berkasModel.map(baca).filter(Boolean) });
  cacheSkema = { kunci, skema };
  return skema;
};

// Komponen Vue halaman + impor lokalnya (views/components non-Base), maksimal dua tingkat.
const berkasFrontend = (repo, komponen, berkasPeramban = [], ambigu = []) => {
  const akar = path.join(repo, "frontend-service", "src");
  const semua = jelajah(akar, /\.(vue|ts)$/);
  const perNama = new Map();
  for (const abs of semua) {
    const nama = path.basename(abs).replace(/\.(vue|ts)$/, "");
    perNama.set(nama, [...(perNama.get(nama) ?? []), abs]);
  }
  const relevan = (abs) => {
    const r = relatif(akar, abs);
    return /^(views|components|composables|stores)\//.test(r) && !/^stores\/(simrsStudio|modulFaskes|utils|auth\w*|user\w*)\.ts$/.test(r) && !/^components\/(Base|section|icons?)\//.test(r);
  };
  const urai = (dari, spesifik) => {
    const dasar = spesifik.startsWith("@/") ? path.join(akar, spesifik.slice(2)) : spesifik.startsWith(".") ? path.resolve(path.dirname(dari), spesifik) : null;
    if (!dasar) return null;
    for (const c of [dasar, `${dasar}.vue`, `${dasar}.ts`, path.join(dasar, "index.ts")]) {
      try {
        if (fs.statSync(c).isFile()) return c;
      } catch { /* coba berikutnya */ }
    }
    return null;
  };
  // Nama komponen tidak unik (LaporanPage.vue ada di Akuntansi, Ambulans, RawatJalan, …). Urutan penentuan:
  // 1) path berkas dari peramban (__file, mode dev); 2) satu-satunya kandidat; 3) kandidat yang sefolder views/<Modul>
  // dengan komponen lain yang sudah pasti (RawatJalanView → views/RawatJalan/…). Selain itu dilewati (dilaporkan ambigu).
  const dariPeramban = new Set(berkasPeramban.map((p) => {
    const i = String(p).replace(/\\/g, "/").lastIndexOf("frontend-service/src/");
    return i < 0 ? null : path.join(akar, String(p).replace(/\\/g, "/").slice(i + "frontend-service/src/".length));
  }).filter((p) => p && semua.includes(p)));
  const kandidat = (k) => (perNama.get(k) ?? []).filter((abs) => relatif(akar, abs).startsWith("views/") || relevan(abs));
  const pasti = [...dariPeramban];
  const tertunda = [];
  for (const k of komponen) {
    const c = kandidat(k);
    if (c.some((abs) => dariPeramban.has(abs))) continue;
    if (c.length === 1) pasti.push(c[0]);
    else if (c.length > 1) tertunda.push([k, c]);
  }
  const modulPasti = new Set(pasti.map((abs) => relatif(akar, abs).split("/").slice(0, 2).join("/")).filter((f) => f.startsWith("views/")));
  for (const [k, c] of tertunda) {
    const sefolder = c.filter((abs) => modulPasti.has(relatif(akar, abs).split("/").slice(0, 2).join("/")));
    if (sefolder.length === 1) pasti.push(sefolder[0]);
    else ambigu.push(`${k} (${c.length} berkas: ${c.slice(0, 4).map((abs) => relatif(akar, abs)).join(", ")}${c.length > 4 ? ", …" : ""})`);
  }
  const terpilih = new Set();
  let antrean = pasti;
  for (let tingkat = 0; tingkat < 3 && antrean.length; tingkat++) {
    const berikut = [];
    for (const abs of antrean) {
      if (terpilih.has(abs) || terpilih.size >= BATAS_BERKAS_FRONTEND) continue;
      terpilih.add(abs);
      const isi = baca(abs) ?? "";
      for (const m of isi.matchAll(/\bimport\s+(?:[\w{},*\s]+\s+from\s+)?["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g)) {
        const tujuan = urai(abs, m[1] ?? m[2]);
        if (tujuan && relevan(tujuan) && !terpilih.has(tujuan)) berikut.push(tujuan);
      }
    }
    // Store dulu: panggilan API (penghubung ke backend) ada di sana, komponen tampilan menyusul sampai batas.
    antrean = [...new Set(berikut)].sort((a, b) => Number(!relatif(akar, a).startsWith("stores/")) - Number(!relatif(akar, b).startsWith("stores/")));
  }
  return [...terpilih];
};

// Berkas backend untuk endpoint + impor relatifnya (logika & SQL sering di berkas terpisah dari rute).
const berkasLayanan = new Map();
const daftarBerkasLayanan = (repo, layanan) => {
  if (!berkasLayanan.has(layanan)) berkasLayanan.set(layanan, jelajah(path.join(repo, layanan, "src"), /\.(c|m)?js$/));
  return berkasLayanan.get(layanan);
};
const SEMUA_LAYANAN = [...new Set(Object.values(LAYANAN_HELPER))].filter((l) => l !== "studio-service");

const lacakEndpoint = (repo, ep) => {
  const { layanan, segmen } = tujuanEndpoint(ep);
  const kandidat = (layanan ? [layanan] : SEMUA_LAYANAN).flatMap((l) => daftarBerkasLayanan(repo, l))
    .map((abs) => ({ abs, path: relatif(repo, abs), isi: baca(abs) ?? "" }));
  return { layanan, segmen, berkas: skorBerkasRute(segmen, kandidat) };
};
// Router pusat (banyak impor, mis. farmasi-service/src/routes/routes.js): hanya impor yang dipakai pada definisi rute
// endpoint halaman ini — tanpa ini setiap halaman modul mewarisi temuan semua controller (permintaan Farmasi ganda).
const escRegex = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const imporRelatif = (abs, isi, segmen = new Set()) => {
  const impor = [...isi.matchAll(/\bimport\s+([\w{},*\s]+?)\s+from\s+["'](\.{1,2}\/[^"']+)["']|\bfrom\s+["'](\.{1,2}\/[^"']+)["']/g)]
    .map((m) => ({ nama: (m[1] ?? "").replace(/[{}*]|\bas\b/g, " ").split(/[\s,]+/).filter(Boolean), spesifik: m[2] ?? m[3] }));
  let dipakai = impor;
  if (impor.length > 5 && segmen.size) {
    const cari = (pola) => {
      const potongan = [];
      for (const sg of pola) {
        for (const m of isi.matchAll(new RegExp(escRegex(sg) + (sg.endsWith(":") ? "" : "(?=[\"'`/:])"), "g"))) {
          // Definisi rute bisa beberapa baris (path, middleware izin, handler) — sampai pemanggilan rute berikutnya.
          potongan.push(isi.slice(m.index, m.index + 400).split(/\n\s*\w+\.(?:get|post|put|patch|delete|use|all)\s*\(/)[0]);
        }
      }
      return potongan.join("\n");
    };
    // Ujung path lengkap dulu; router bertingkat menulis rute relatif ("/jadwal") → segmen terakhir saja.
    let teks = cari(segmen);
    if (!teks) teks = cari([...segmen].filter((sg) => !sg.endsWith(":")).map((sg) => `/${sg.split("/").pop()}`));
    const cocok = impor.filter((i) => i.nama.some((n) => new RegExp("\\b" + escRegex(n) + "\\b").test(teks)));
    // Handler lewat variabel perantara (const jadwal = buatJadwal(...)) tidak terlacak → pakai semua impor.
    if (cocok.length) dipakai = cocok;
  }
  return dipakai
    .map((i) => path.resolve(path.dirname(abs), i.spesifik))
    .map((p) => (/\.(c|m)?js$/.test(p) ? p : `${p}.js`))
    .filter((p) => fs.existsSync(p) && !/(^|[\\/])(db|config|auth|respons|logger|util(s)?|helpers?)\.(c|m)?js$/.test(p));
};

// ── Audit cepat untuk satu halaman.
// masukan: { path, komponen: [nama], endpoint: [{ metode, path, status }] (teramati di peramban) }
export const auditCepat = ({ komponen = [], berkasKomponen = [], endpoint = [] } = {}, { repo = config.repoDir } = {}) => {
  const kumpul = pengumpul();
  const skema = skemaRepo(repo);

  const ambigu = [];
  const frontend = berkasFrontend(repo, komponen.filter((k) => /^[A-Za-z][\w-]{1,80}$/.test(k)).slice(0, 10),
    berkasKomponen.filter((p) => typeof p === "string").slice(0, 10), ambigu);
  for (const a of ambigu) {
    kumpul.tambah("fungsional", "rendah", "Komponen halaman ambigu (tidak diaudit)", `${a} — nama komponen sama di beberapa modul; jalankan frontend mode dev agar path berkas terbaca`, null);
  }
  const daftarEndpoint = new Map();
  const catatEndpoint = (e, sumber) => {
    const { layanan, segmen } = tujuanEndpoint(e);
    const kunci = `${e.metode ?? ""} ${layanan ?? "?"} /${segmen.join("/")}`;
    const ada = daftarEndpoint.get(kunci) ?? { metode: e.metode ?? null, path: e.path, helper: e.helper ?? null, status: [], sumber: [] };
    if (e.status != null && !ada.status.includes(e.status)) ada.status.push(e.status);
    if (sumber && !ada.sumber.includes(sumber)) ada.sumber.push(sumber);
    daftarEndpoint.set(kunci, ada);
  };
  const pembungkus = new Map(frontend.flatMap((abs) => [...pembungkusDalamKode(baca(abs) ?? "")]));
  for (const abs of frontend) {
    const isi = baca(abs);
    if (!isi) continue;
    const rel = relatif(repo, abs);
    periksaBerkas({ path: rel, isi, jenis: "frontend" }, skema, kumpul);
    for (const e of endpointDalamKode(isi, pembungkus)) catatEndpoint(e, `${rel}:${e.baris}`);
  }
  for (const e of endpoint.slice(0, 60)) {
    if (typeof e?.path === "string" && e.path.startsWith("/")) catatEndpoint({ metode: String(e.metode ?? "").toUpperCase() || null, path: e.path, status: Number.isFinite(Number(e.status)) ? Number(e.status) : null }, null);
  }

  const backend = new Set();
  const segmenRute = new Map(); // berkas rute → segmen endpoint yang dilayaninya
  const hasilEndpoint = [];
  for (const e of [...daftarEndpoint.values()].slice(0, 40)) {
    const lacak = lacakEndpoint(repo, e);
    for (const b of lacak.berkas) {
      if (backend.size < BATAS_BERKAS_BACKEND) backend.add(b.abs);
      // Ujung path endpoint ("/datamaster/satuan"; "/referensi/:" bila segmen terakhir nilai parameter) — segmen tunggal
      // seperti "datamaster" ada di semua rute datamaster sehingga tidak bisa dipakai memilih controller.
      const sg = segmenRute.get(b.abs) ?? new Set();
      const s = lacak.segmen;
      if (s.length >= 2) sg.add(`/${s.slice(-2).join("/")}`).add(`/${s[s.length - 2]}/:`);
      else if (s.length) sg.add(`/${s[0]}`);
      segmenRute.set(b.abs, sg);
    }
    hasilEndpoint.push({ metode: e.metode, path: e.path, layanan: lacak.layanan, status: e.status, sumber: e.sumber.slice(0, 3), berkas: lacak.berkas.map((b) => b.path) });
    const bukti = e.sumber[0]?.split(":") ?? [];
    if (!lacak.berkas.length && lacak.segmen.length) {
      kumpul.tambah("fungsional", "sedang", "Endpoint tidak ditemukan di backend", `${e.metode ?? ""} ${e.path} tidak cocok dengan rute mana pun di ${lacak.layanan ?? "layanan backend"} (perlu dicek: rute dinamis atau salah alamat)`, bukti[0] ?? null, bukti[1] ? Number(bukti[1]) : null);
    }
    for (const s of e.status) {
      // Rute ada di backend → 404 biasanya "data tidak ditemukan/kosong" (layanan lama melempar 404 untuk daftar kosong).
      if (s === 404 && lacak.berkas.length) kumpul.tambah("fungsional", "rendah", "Endpoint menjawab 404 (rute ada)", `${e.metode ?? ""} ${e.path} → 404 padahal rutenya ada di ${lacak.berkas[0]}: kemungkinan daftar kosong dianggap galat (konvensi lama) — halaman sebaiknya menampilkan "belum ada data", bukan galat`, bukti[0] ?? null, bukti[1] ? Number(bukti[1]) : null);
      else if (s === 404 || s === 405) kumpul.tambah("fungsional", "tinggi", "Endpoint menjawab 404/405", `${e.metode ?? ""} ${e.path} → ${s}: halaman memanggil alamat/metode yang tidak ada`, bukti[0] ?? null, bukti[1] ? Number(bukti[1]) : null);
      else if (s >= 500) kumpul.tambah("fungsional", "tinggi", "Endpoint galat server", `${e.metode ?? ""} ${e.path} → ${s}`, bukti[0] ?? null, bukti[1] ? Number(bukti[1]) : null);
      else if (s === 403) kumpul.tambah("fungsional", "sedang", "Endpoint menolak izin (403)", `${e.metode ?? ""} ${e.path} → 403: izin halaman dan izin endpoint tidak selaras`, bukti[0] ?? null, bukti[1] ? Number(bukti[1]) : null);
    }
  }
  // Impor relatif berkas rute (handler/servis/SQL) satu tingkat.
  for (const abs of [...backend]) {
    for (const imp of imporRelatif(abs, baca(abs) ?? "", segmenRute.get(abs))) if (backend.size < BATAS_BERKAS_BACKEND) backend.add(imp);
  }
  for (const abs of backend) {
    const isi = baca(abs);
    if (!isi) continue;
    const rel = relatif(repo, abs);
    periksaBerkas({ path: rel, isi, jenis: "backend" }, skema, kumpul);
    // Lintas berkas: pemanggilan metode statis kelas yang diimpor (repository/service) vs definisinya.
    const impor = new Map();
    for (const i of imporKelas(isi)) {
      const tujuan = path.resolve(path.dirname(abs), i.spesifik);
      const berkas = /\.(c|m)?js$/.test(tujuan) ? tujuan : `${tujuan}.js`;
      const def = definisiKelas(baca(berkas) ?? "");
      if (def && (!i.ekspor || i.ekspor === def.nama)) impor.set(i.nama, def);
    }
    for (const t of periksaPanggilan(isi, impor)) kumpul.tambah("logika", t.tingkat, t.judul, t.rincian, rel, t.baris);
  }

  const temuan = kumpul.hasil()
    .sort((a, b) => URUT_TINGKAT[a.tingkat] - URUT_TINGKAT[b.tingkat] || ASPEK.indexOf(a.aspek) - ASPEK.indexOf(b.aspek))
    .slice(0, BATAS_TEMUAN);
  const ringkasan = Object.fromEntries(ASPEK.map((a) => [a, { tinggi: 0, sedang: 0, rendah: 0 }]));
  for (const t of temuan) ringkasan[t.aspek][t.tingkat]++;
  return {
    versi: VERSI_AUDIT,
    waktu: Math.floor(Date.now() / 1000),
    berkas: { frontend: frontend.map((a) => relatif(repo, a)), backend: [...backend].map((a) => relatif(repo, a)) },
    endpoint: hasilEndpoint,
    ringkasan,
    temuan,
  };
};
