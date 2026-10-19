#!/usr/bin/env node
// Gabungkan fragmen changelog.d/*.md ke CHANGELOG.md bagian [Belum dirilis] (per kategori, urut nomor STD lalu nama),
// lalu hapus fragmennya. Dipakai maintainer saat menyiapkan rilis (docs/kontributor/ALUR-GIT-RILIS.md §6).
//
//   node scripts/gabung-changelog.mjs          # gabungkan & hapus fragmen
//   node scripts/gabung-changelog.mjs --cek    # hanya validasi format fragmen; keluar dengan kode 1 bila ada galat
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { FOLDER_FRAGMEN, gabungKeChangelog, namaFragmenSah, uraiFragmen, urutFragmen } from "./lib/changelog.mjs";

const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const folder = path.join(AKAR, FOLDER_FRAGMEN);
const daftar = fs.existsSync(folder) ? fs.readdirSync(folder).filter((n) => n.endsWith(".md") && n.toLowerCase() !== "readme.md").sort(urutFragmen) : [];

const galat = [];
const fragmen = [];
for (const nama of daftar) {
  if (!namaFragmenSah(nama)) galat.push(`${FOLDER_FRAGMEN}/${nama}: nama berkas hanya boleh huruf, angka, titik, minus, dan garis bawah`);
  const hasil = uraiFragmen(fs.readFileSync(path.join(folder, nama), "utf8"));
  for (const g of hasil.galat) galat.push(`${FOLDER_FRAGMEN}/${nama}: ${g}`);
  fragmen.push({ nama, kategori: hasil.kategori });
}

for (const g of galat) console.log(`✘ ${g}`);
if (galat.length) {
  console.log(`${galat.length} galat format fragmen CHANGELOG.`);
  process.exit(1);
}
if (process.argv.includes("--cek")) {
  console.log(`${fragmen.length} fragmen CHANGELOG valid.`);
  process.exit(0);
}
if (!fragmen.length) {
  console.log(`Tidak ada fragmen di ${FOLDER_FRAGMEN}/.`);
  process.exit(0);
}
const lokasi = path.join(AKAR, "CHANGELOG.md");
fs.writeFileSync(lokasi, gabungKeChangelog(fs.readFileSync(lokasi, "utf8"), fragmen));
for (const { nama } of fragmen) fs.rmSync(path.join(folder, nama));
console.log(`${fragmen.length} fragmen digabung ke CHANGELOG.md [Belum dirilis] dan dihapus: ${fragmen.map((f) => f.nama).join(", ")}`);
