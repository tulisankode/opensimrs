#!/usr/bin/env node
// Cek integritas lintas berkas yang tidak tertangkap cek sintaks/build, tetapi membuat aplikasi rusak setelah
// modul baru diterapkan (temuan nyata SIMRS Studio STD-0006/0008, 2026-10-16):
//   1. Katalog: kode ganda; rute ganda antara modul & fitur (ref_rute unik → migrasi sinkron katalog gagal,
//      modul tetap "Segera").
//   2. Menu navbar: setiap `menu` modul yang tersedia harus ada di templistMenu Header.vue (selain itu menu
//      tidak pernah tampil walau modul aktif); modul tersedia tidak boleh masih tercantum di daftar menu "Segera".
//      Setiap modul wajib punya `bidang` (salah satu URUTAN_BIDANG di Header.vue) dan `instalasi` agar menunya
//      masuk kolom yang benar di panel "Lainnya".
//   3. Migrasi: stempel waktu nama berkas tidak boleh kembar.
//   4. Frontend: tidak boleh ada import "@/main" (import melingkar main → router → halaman → main membuat layar
//      putih "Cannot access 'router' before initialization" saat Vite memuat main.ts dua kali).
//
//   node scripts/cek-integritas.mjs           # keluar dengan kode 1 bila ada pelanggaran
//   node scripts/cek-integritas.mjs --json    # keluaran JSON { lulus, temuan[] } (dipakai SIMRS Studio)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baca = (rel) => fs.readFileSync(path.join(AKAR, rel), "utf8").replace(/\r\n/g, "\n");
const temuan = [];
const salah = (cek, pesan) => temuan.push({ cek, pesan });

// ---------- 1. Katalog ----------
const katalog = JSON.parse(baca("database/data/katalog-modul.json"));
for (const jenis of ["modul", "fitur", "bagian"]) {
  const lihat = new Set();
  for (const x of katalog[jenis] ?? []) {
    if (lihat.has(x.kode)) salah("Katalog", `Kode ${jenis} ganda: ${x.kode}`);
    lihat.add(x.kode);
  }
}
const pemilikRute = new Map();
for (const [jenis, daftar] of [["modul", katalog.modul], ["fitur", katalog.fitur]]) {
  for (const x of daftar ?? []) {
    for (const r of x.rute ?? []) {
      if (pemilikRute.has(r)) salah("Katalog", `Rute ${r} didaftarkan dua kali (${pemilikRute.get(r)} dan ${jenis} ${x.kode}). Modul cukup mendaftarkan awalan (mis. "/icu"); sub-rute milik fitur.`);
      else pemilikRute.set(r, `${jenis} ${x.kode}`);
    }
  }
}

// ---------- 2. Menu navbar ----------
const header = baca("frontend-service/src/components/section/Header.vue");
// Potongan teks dari `awal` sampai penutup blok pertama sesudahnya.
const potong = (awal, penutup) => {
  const i = header.indexOf(awal);
  return i < 0 ? "" : header.slice(i, header.indexOf(penutup, i));
};
const menuNavbar = new Set([...potong("const templistMenu", "\n]);").matchAll(/title:\s*"([^"]+)"/g)].map((m) => m[1]));
const segera = potong("const NAMA_SEGERA", "\n};");
const bidangNavbar = new Set([...potong("const URUTAN_BIDANG", "\n];").matchAll(/"([^"]+)"/g)].map((m) => m[1]));
for (const m of katalog.modul) {
  if (!m.bidang || !m.instalasi) salah("Menu navbar", `Modul ${m.kode} belum punya "bidang" dan/atau "instalasi" di katalog-modul.json — menunya masuk kolom "Lainnya" di panel menu.`);
  else if (!bidangNavbar.has(m.bidang)) salah("Menu navbar", `Modul ${m.kode} memakai bidang "${m.bidang}" yang tidak ada di URUTAN_BIDANG Header.vue. Pilih salah satu: ${[...bidangNavbar].join(", ")}.`);
}
for (const m of katalog.modul.filter((x) => x.tersedia)) {
  for (const judul of m.menu ?? []) {
    if (!menuNavbar.has(judul)) salah("Menu navbar", `Modul ${m.kode} punya menu "${judul}" tetapi tidak ada di templistMenu Header.vue — menu tidak akan tampil walau modul aktif.`);
  }
  if (segera && new RegExp(`\\b${m.kode}:`).test(segera)) salah("Menu navbar", `Modul ${m.kode} sudah tersedia tetapi masih tercantum di NAMA_SEGERA Header.vue — hapus dari daftar menu "Segera".`);
}

// ---------- 3. Migrasi ----------
const stempel = new Map();
for (const f of fs.readdirSync(path.join(AKAR, "database/migrations")).filter((x) => x.endsWith(".cjs"))) {
  const s = f.match(/^(\d{14})-/)?.[1];
  if (!s) continue;
  if (stempel.has(s)) salah("Migrasi", `Stempel waktu kembar ${s}: ${stempel.get(s)} dan ${f}`);
  else stempel.set(s, f);
}

// ---------- 4. Frontend: import @/main ----------
const POLA_MAIN = /\bfrom\s*["'](?:@\/main|(?:\.\.?\/)+main)(?:\.ts)?["']|\bimport\s*\(\s*["']@\/main(?:\.ts)?["']\s*\)/;
const telusur = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) telusur(p);
    else if (/\.(ts|js|vue|tsx)$/.test(e.name) && e.name !== "main.ts") {
      const isi = fs.readFileSync(p, "utf8");
      if (POLA_MAIN.test(isi)) salah("Import melingkar", `${path.relative(AKAR, p).split(path.sep).join("/")} mengimpor "@/main". Pakai "@/utils/aplikasi" (instance app) agar tidak terjadi import melingkar.`);
    }
  }
};
telusur(path.join(AKAR, "frontend-service/src"));

// ---------- hasil ----------
const lulus = temuan.length === 0;
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ lulus, temuan }));
} else {
  for (const t of temuan) console.log(`✘ ${t.cek}: ${t.pesan}`);
  console.log(lulus ? "Cek integritas lulus." : `${temuan.length} pelanggaran integritas.`);
}
process.exit(lulus ? 0 : 1);
