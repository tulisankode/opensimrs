#!/usr/bin/env node
// Menghasilkan tabel katalog Manajemen Modul (segmen, modul, matriks modul × segmen, fitur, bagian)
// dari database/data/katalog-modul.json, lalu menyisipkannya ke docs/MANAJEMEN-MODUL.md di antara penanda
//   <!-- KATALOG:MULAI --> ... <!-- KATALOG:SELESAI -->
//
// Pemakaian (dari root repo):
//   node scripts/dokumen-katalog.mjs          # perbarui dokumen
//   node scripts/dokumen-katalog.mjs --cek    # hanya periksa; keluar dengan kode 1 bila dokumen belum diperbarui
//
// Jalankan ulang setiap kali katalog-modul.json berubah, lalu commit JSON + dokumen bersamaan.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SUMBER = join(ROOT, "database", "data", "katalog-modul.json");
const DOKUMEN = join(ROOT, "docs", "MANAJEMEN-MODUL.md");
const MULAI = "<!-- KATALOG:MULAI -->";
const SELESAI = "<!-- KATALOG:SELESAI -->";

const K = JSON.parse(readFileSync(SUMBER, "utf8"));

// Singkatan kolom segmen agar matriks muat di layar; segmen baru tanpa singkatan memakai kodenya.
const SINGKAT = {
  praktik_mandiri: "PM",
  klinik_pratama: "KP",
  klinik_utama: "KU",
  puskesmas: "PKM",
  rs_d: "RS D",
  rs_c: "RS C",
  rs_b: "RS B",
  rs_a: "RS A",
};

const urut = (a, b) => (a.urutan ?? 0) - (b.urutan ?? 0);
const segmen = [...K.segmen].sort(urut);
const modul = [...K.modul].sort(urut);
const fitur = [...K.fitur].sort(urut);
const bagian = [...K.bagian].sort(urut);
const jenisPoli = [...(K.jenis_poli ?? [])].sort(urut);
const preset = K.preset ?? {};
const presetModul = preset.segmen_modul ?? {};
const fiturMati = preset.fitur_mati ?? {};
const bagianMati = preset.bagian_mati ?? {};

const sel = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
const kode = (s) => (s ? `\`${s}\`` : "–");
const singkat = (k) => SINGKAT[k] ?? k;
const namaModul = new Map(modul.map((m) => [m.kode, m.nama]));
const namaFitur = new Map(fitur.map((f) => [f.kode, f.nama]));
const namaPoli = new Map(jenisPoli.map((p) => [p.kode, p.nama]));

const statusModul = (m) => (m.inti ? "Inti (selalu aktif)" : m.tersedia ? "Tersedia" : "Segera");
const segmenYang = (peta, kodeItem) =>
  segmen.filter((s) => (peta[s.kode] ?? []).includes(kodeItem)).map((s) => singkat(s.kode));
const daftar = (arr) => (arr.length ? arr.join(", ") : "–");

const baris = [];
const tulis = (s = "") => baris.push(s);
const tabel = (kepala, isi) => {
  tulis(`| ${kepala.join(" | ")} |`);
  tulis(`|${kepala.map(() => "---").join("|")}|`);
  for (const r of isi) tulis(`| ${r.map(sel).join(" | ")} |`);
  tulis();
};

tulis("<!-- Bagian ini DIHASILKAN OTOMATIS oleh scripts/dokumen-katalog.mjs dari database/data/katalog-modul.json. -->");
tulis("<!-- Jangan diedit manual: ubah JSON-nya, lalu jalankan `node scripts/dokumen-katalog.mjs`. -->");
tulis();
tulis(
  `Ringkasan katalog saat ini: **${segmen.length} segmen**, **${modul.length} modul** ` +
    `(${modul.filter((m) => m.inti).length} inti, ${modul.filter((m) => !m.tersedia).length} berstatus Segera), ` +
    `**${fitur.length} fitur** (${fitur.filter((f) => !f.tersedia).length} berstatus Segera), dan **${bagian.length} bagian**.`,
);
tulis();

// 1. Segmen
tulis("### A. Segmen faskes");
tulis();
tabel(
  ["Urutan", "Singkatan", "Kode", "Nama", "Gambaran", "Modul bawaan"],
  segmen.map((s) => [s.urutan, singkat(s.kode), kode(s.kode), s.nama, s.ringkas, (presetModul[s.kode] ?? []).length]),
);

// 2. Modul per kelompok
tulis("### B. Daftar modul per kelompok");
tulis();
tulis("Status: **Inti** = selalu aktif di semua faskes · **Tersedia** = bisa dipakai · **Segera** = sudah terdaftar di katalog tetapi belum dibangun (tampil di menu sebagai \"Segera\").");
tulis();
const kelompok = [...new Set(modul.map((m) => m.kelompok))];
for (const g of kelompok) {
  tulis(`#### ${g}`);
  tulis();
  tabel(
    ["Kode", "Nama", "Deskripsi", "Status", "Nama izin (menu)"],
    modul.filter((m) => m.kelompok === g).map((m) => [kode(m.kode), m.nama, m.deskripsi, statusModul(m), daftar(m.menu ?? [])]),
  );
}

// 3. Matriks modul × segmen
tulis("### C. Matriks modul × segmen (preset bawaan)");
tulis();
tulis("✓ = aktif bawaan pada segmen itu · – = tidak aktif bawaan (superadmin tetap bisa menyalakannya per faskes). Modul inti selalu aktif.");
tulis();
tabel(
  ["Modul", "Status", ...segmen.map((s) => singkat(s.kode))],
  modul.map((m) => [
    `${m.nama} (${kode(m.kode)})`,
    m.inti ? "Inti" : m.tersedia ? "Tersedia" : "Segera",
    ...segmen.map((s) => (m.inti || (presetModul[s.kode] ?? []).includes(m.kode) ? "✓" : "–")),
  ]),
);

// 4. Fitur per modul
tulis("### D. Fitur per modul");
tulis();
tulis(
  "Kolom **Wajib**: fitur tidak bisa dimatikan. **Syarat modul**: fitur hanya berfungsi bila modul tersebut aktif. " +
    "**Dimatikan bawaan di**: segmen yang mematikan fitur ini lewat `preset.fitur_mati`; di segmen lain fitur ikut aktif bila modulnya aktif.",
);
tulis();
for (const m of modul) {
  const isi = fitur.filter((f) => f.modul === m.kode);
  if (!isi.length) continue;
  tulis(`#### ${m.nama} (${kode(m.kode)})`);
  tulis();
  tabel(
    ["Kode", "Fitur", "Deskripsi", "Status", "Wajib", "Syarat modul", "Dimatikan bawaan di"],
    isi.map((f) => [
      kode(f.kode),
      f.nama,
      f.deskripsi,
      f.tersedia ? "Tersedia" : "Segera",
      f.wajib ? "Ya" : "–",
      f.modul_syarat ? `${namaModul.get(f.modul_syarat) ?? f.modul_syarat} (${kode(f.modul_syarat)})` : "–",
      daftar(segmenYang(fiturMati, f.kode)),
    ]),
  );
}

// 5. Bagian
tulis("### E. Bagian (unit terkecil)");
tulis();
tulis(
  "Bagian adalah potongan form/daftar di dalam sebuah fitur, mis. satu form asesmen atau satu jenis surat. " +
    "**Khusus poli**: bagian hanya tampil di lokasi berjenis poli tersebut. **Dimatikan bawaan di**: dari `preset.bagian_mati`.",
);
tulis();
for (const kf of [...new Set(bagian.map((b) => b.fitur))]) {
  tulis(`#### ${namaFitur.get(kf) ?? kf} (${kode(kf)})`);
  tulis();
  tabel(
    ["Kode", "Bagian", "Wajib", "Khusus poli", "Syarat modul", "Dimatikan bawaan di"],
    bagian
      .filter((b) => b.fitur === kf)
      .map((b) => [
        kode(b.kode),
        b.nama ?? b.label,
        b.wajib ? "Ya" : "–",
        daftar((b.poli ?? []).map((p) => namaPoli.get(p) ?? p)),
        b.modul_syarat ? `${namaModul.get(b.modul_syarat) ?? b.modul_syarat} (${kode(b.modul_syarat)})` : "–",
        daftar(segmenYang(bagianMati, b.kode)),
      ]),
  );
}

// 6. Jenis poli
if (jenisPoli.length) {
  tulis("### F. Jenis poli");
  tulis();
  tulis("Dipakai untuk membatasi bagian khusus poli (mis. odontogram hanya di poli gigi). Jenis poli diatur pada data lokasi poli.");
  tulis();
  tabel(["Kode", "Nama"], jenisPoli.map((p) => [kode(p.kode), p.nama]));
}

const dok = readFileSync(DOKUMEN, "utf8");
// Ikuti akhir baris dokumen (LF di Linux/CI, CRLF bila git autocrlf aktif di Windows) agar --cek konsisten.
const EOL = dok.includes("\r\n") ? "\r\n" : "\n";
const hasil = baris.join("\n").replace(/\n+$/, "\n").replace(/\n/g, EOL);
const a = dok.indexOf(MULAI);
const b = dok.indexOf(SELESAI);
if (a < 0 || b < 0 || b < a) {
  console.error(`Penanda ${MULAI} / ${SELESAI} tidak ditemukan di ${DOKUMEN}.`);
  process.exit(1);
}
const baru = `${dok.slice(0, a + MULAI.length)}${EOL}${hasil}${dok.slice(b)}`;

if (process.argv.includes("--cek")) {
  if (baru !== dok) {
    console.error("docs/MANAJEMEN-MODUL.md belum sesuai katalog. Jalankan: node scripts/dokumen-katalog.mjs");
    process.exit(1);
  }
  console.log("docs/MANAJEMEN-MODUL.md sudah sesuai katalog.");
} else if (baru === dok) {
  console.log("Tidak ada perubahan: docs/MANAJEMEN-MODUL.md sudah sesuai katalog.");
} else {
  writeFileSync(DOKUMEN, baru);
  console.log(`docs/MANAJEMEN-MODUL.md diperbarui (${segmen.length} segmen, ${modul.length} modul, ${fitur.length} fitur, ${bagian.length} bagian).`);
}
