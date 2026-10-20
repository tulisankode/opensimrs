// Kutipan panduan pengguna untuk Helpdesk: bagian docs/panduan-pengguna yang paling relevan dengan pertanyaan disertakan
// di pesan sistem ke Gateway. Agen tidak perlu memanggil alat baca berkas (model lokal kecil jarang melakukannya dan
// akhirnya mengarang), dan jawaban lebih cepat karena tidak ada putaran alat.
//
// Pencarian kata kunci sederhana per bagian (judul ## / ###), tanpa layanan tambahan. Folder panduan:
// HELPDESK_PANDUAN_DIR, atau ../docs/panduan-pengguna dari folder layanan (repo dev; di Docker disalin ke /docs).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const folderLayanan = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const folderPanduan = () => process.env.HELPDESK_PANDUAN_DIR || path.resolve(folderLayanan, "../docs/panduan-pengguna");

const BATAS_BAGIAN = 3;
const BATAS_KARAKTER = 7000;
// Kata umum yang tidak membedakan bagian panduan.
const KATA_UMUM = new Set(
  ("yang dan di ke dari untuk dengan pada ini itu atau ada tidak bisa cara bagaimana apa apakah saya kami kita anda " +
    "mau ingin tolong mohon jika bila kalau sudah belum akan dapat agar supaya oleh juga lalu kemudian saat sebagai " +
    "dalam adalah menu halaman aplikasi opensimrs klik tombol oke ok gimana gmn bagaimanakah alurnya untuk").split(" "),
);
const BAGIAN_DILEWATI = /catatan untuk peninjau/i;

// "Rawat Inap" → ["rawat","inap"]; akhiran -nya/-kah dipotong agar "alurnya" cocok dengan "alur".
export const kataKunci = (teks) =>
  String(teks ?? "")
    .toLowerCase()

    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/[\s-]+/)
    .map((k) => k.replace(/(nya|kah|lah)$/u, ""))
    .filter((k) => k.length > 2 && !KATA_UMUM.has(k));

// Pecah satu berkas panduan menjadi bagian per judul ##/###. Judul berkas (#) ikut di jalur judul.
export const pecahBagian = (isi, berkas) => {
  const baris = isi.replace(/\r/g, "").split("\n");
  const judulBerkas = baris.find((b) => b.startsWith("# "))?.slice(2).trim() ?? berkas;
  const hasil = [];
  let h2 = "";
  let saatIni = null;
  const tutup = () => {
    if (saatIni && saatIni.isi.trim() && !BAGIAN_DILEWATI.test(saatIni.judul)) hasil.push({ ...saatIni, isi: saatIni.isi.trim() });
  };
  for (const b of baris) {
    const m = b.match(/^(#{2,3})\s+(.*)$/);
    if (m) {
      tutup();
      if (m[1] === "##") h2 = m[2].trim();
      const judul = m[1] === "##" ? `${judulBerkas} › ${h2}` : `${judulBerkas} › ${h2} › ${m[2].trim()}`;
      saatIni = { berkas, judul, isi: "" };
    } else if (saatIni) saatIni.isi += `${b}\n`;
  }
  tutup();
  return hasil.map((s) => ({ ...s, kataJudul: new Set(kataKunci(s.judul)), kataIsi: kataKunci(s.isi) }));
};

let cache = { folder: null, cap: null, bagian: [] };
const muatIndeks = () => {
  const folder = folderPanduan();
  let daftar;
  try {
    daftar = fs.readdirSync(folder).filter((f) => f.endsWith(".md") && f !== "README.md");
  } catch {
    return [];
  }
  const cap = daftar.map((f) => `${f}:${fs.statSync(path.join(folder, f)).mtimeMs}`).join("|");
  if (cache.folder === folder && cache.cap === cap) return cache.bagian;
  const bagian = daftar.flatMap((f) => pecahBagian(fs.readFileSync(path.join(folder, f), "utf8"), f));
  cache = { folder, cap, bagian };
  return bagian;
};

// Skor bagian: kata kunci di judul bernilai lebih tinggi; kata yang muncul di banyak bagian bernilai rendah (idf);
// bagian dari modul halaman yang sedang dibuka mendapat tambahan.
export const cariBagian = (pertanyaan, { halaman = "", bagian = muatIndeks(), batas = BATAS_BAGIAN } = {}) => {
  const kata = [...new Set(kataKunci(pertanyaan))];
  if (!kata.length || !bagian.length) return [];
  const df = new Map(kata.map((k) => [k, bagian.filter((s) => s.kataJudul.has(k) || s.kataIsi.includes(k)).length]));
  const modulHalaman = String(halaman).toLowerCase().split("/").filter(Boolean)[0] ?? "";
  const skor = bagian.map((s) => {
    let nilai = 0;
    for (const k of kata) {
      const idf = Math.log(1 + bagian.length / (1 + df.get(k)));
      if (s.kataJudul.has(k)) nilai += 3 * idf;
      const tf = s.kataIsi.filter((x) => x === k).length;
      if (tf) nilai += Math.min(tf, 3) * idf;
    }
    // Semua kata kunci muncul di bagian yang sama → lebih relevan daripada kecocokan sebagian.
    if (kata.every((k) => s.kataJudul.has(k) || s.kataIsi.includes(k))) nilai *= 1.5;
    if (modulHalaman && s.berkas.replace(/\.md$/, "") === modulHalaman) nilai *= 1.3;
    return { s, nilai };
  });
  return skor.filter((x) => x.nilai > 0).sort((a, b) => b.nilai - a.nilai).slice(0, batas).map((x) => x.s);
};

// Teks kutipan untuk pesan sistem (dibatasi panjangnya); kosong bila tidak ada yang cocok atau panduan tidak tersedia.
export const kutipanPanduan = (pertanyaan, halaman) => {
  let sisa = BATAS_KARAKTER;
  const potongan = [];
  for (const s of cariBagian(pertanyaan, { halaman })) {
    const isi = s.isi.length > sisa ? `${s.isi.slice(0, sisa)}\n…` : s.isi;
    potongan.push(`### ${s.judul} (panduan-pengguna/${s.berkas})\n${isi}`);
    sisa -= isi.length;
    if (sisa <= 500) break;
  }
  return potongan.join("\n\n");
};
