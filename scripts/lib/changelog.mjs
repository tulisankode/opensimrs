// Fragmen CHANGELOG (changelog.d/<nama>.md): setiap PR/item SIMRS Studio menulis catatan perubahannya di berkas
// sendiri agar PR yang dikerjakan paralel tidak saling konflik di CHANGELOG.md. Maintainer menggabungkan semua
// fragmen ke bagian [Belum dirilis] saat rilis (scripts/gabung-changelog.mjs). Fungsi murni → dipakai juga oleh
// scripts/cek-integritas.mjs dan uji SIMRS Studio.
//
// Format fragmen = isi bagian [Belum dirilis] CHANGELOG, tanpa judul versi:
//   ### Ditambahkan
//   - **Modul Gizi**: … (STD-0031)
//   ### Diperbaiki
//   - …

export const FOLDER_FRAGMEN = "changelog.d";
// Urutan kategori Keep a Changelog versi Bahasa Indonesia (sama dengan CHANGELOG.md).
export const KATEGORI = ["Ditambahkan", "Diubah", "Usang", "Dihapus", "Diperbaiki", "Keamanan"];

// Nama berkas fragmen: STD-0031.md (item SIMRS Studio) atau nama branch dengan "/" diganti "-" (PR manusia),
// mis. feat-123-filter-ruangan.md. README.md di folder yang sama adalah panduan, bukan fragmen.
export const namaFragmenSah = (nama) => /^[A-Za-z0-9][A-Za-z0-9._-]*\.md$/.test(nama) && nama.toLowerCase() !== "readme.md";
export const namaFragmenBranch = (branch) => `${String(branch).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+|-+$/g, "")}.md`;

// Urai satu fragmen → { kategori: { Ditambahkan: [baris…] }, galat: [pesan…] }.
export const uraiFragmen = (teks = "") => {
  const kategori = {};
  const galat = [];
  let aktif = null;
  const baris = String(teks).replace(/\r\n/g, "\n").replace(/^﻿/, "").split("\n");
  baris.forEach((b, i) => {
    const judul = b.match(/^#{1,6}\s+(.*?)\s*$/);
    if (judul) {
      if (!/^###\s/.test(b)) {
        galat.push(`baris ${i + 1}: hanya judul "### <Kategori>" yang boleh dipakai (judul versi ditulis maintainer saat rilis)`);
        aktif = null;
        return;
      }
      if (!KATEGORI.includes(judul[1])) {
        galat.push(`baris ${i + 1}: kategori "${judul[1]}" tidak dikenal — pakai ${KATEGORI.join("/")}`);
        aktif = null;
        return;
      }
      if (kategori[judul[1]]) galat.push(`baris ${i + 1}: kategori "${judul[1]}" ditulis dua kali`);
      aktif = judul[1];
      kategori[aktif] ??= [];
      return;
    }
    if (!b.trim() || /^\s*<!--.*-->\s*$/.test(b)) {
      if (aktif && b.trim() === "" && kategori[aktif].length) kategori[aktif].push("");
      return;
    }
    if (!aktif) {
      galat.push(`baris ${i + 1}: teks di luar bagian "### <Kategori>"`);
      return;
    }
    if (!kategori[aktif].length && !/^- /.test(b)) galat.push(`baris ${i + 1}: entri pertama "${aktif}" harus butir daftar ("- …")`);
    kategori[aktif].push(b);
  });
  for (const k of Object.keys(kategori)) {
    while (kategori[k].at(-1) === "") kategori[k].pop();
    if (!kategori[k].some((b) => /^- /.test(b))) galat.push(`kategori "${k}" kosong`);
  }
  if (!Object.keys(kategori).length && !galat.length) galat.push('fragmen kosong — tulis minimal satu bagian "### <Kategori>" berisi butir "- …"');
  return { kategori, galat };
};

// STD-0002 < STD-0010 < nama lain (urut abjad).
export const urutFragmen = (a, b) => {
  const na = a.match(/^STD-(\d+)\.md$/i)?.[1];
  const nb = b.match(/^STD-(\d+)\.md$/i)?.[1];
  if (na && nb) return Number(na) - Number(nb);
  if (na || nb) return na ? -1 : 1;
  return a.localeCompare(b);
};

// Gabungkan fragmen [{ nama, kategori }] ke bagian [Belum dirilis] CHANGELOG. Entri ditambahkan di akhir kategorinya;
// kategori yang belum ada dibuat sesuai urutan KATEGORI. Akhir baris (LF/CRLF) mengikuti berkas asal.
export const gabungKeChangelog = (teksChangelog, fragmen) => {
  const crlf = teksChangelog.includes("\r\n");
  const baris = teksChangelog.replace(/\r\n/g, "\n").split("\n");
  const awal = baris.findIndex((b) => /^## \[Belum dirilis\]/i.test(b));
  if (awal < 0) throw new Error('CHANGELOG.md tidak punya bagian "## [Belum dirilis]"');
  let akhir = baris.findIndex((b, i) => i > awal && (/^## /.test(b) || /^---\s*$/.test(b)));
  if (akhir < 0) akhir = baris.length;
  const bagian = baris.slice(awal + 1, akhir);
  // Pecah bagian menjadi pembuka (sebelum kategori pertama) + blok per kategori.
  const blok = [];
  const pembuka = [];
  for (const b of bagian) {
    const k = b.match(/^### (.+?)\s*$/)?.[1];
    if (k) blok.push({ kategori: k, baris: [b] });
    else if (blok.length) blok.at(-1).baris.push(b);
    else pembuka.push(b);
  }
  const rapikanEkor = (arr) => {
    while (arr.length && arr.at(-1).trim() === "") arr.pop();
    return arr;
  };
  for (const f of [...fragmen].sort((a, b) => urutFragmen(a.nama, b.nama))) {
    for (const kat of KATEGORI) {
      const isi = f.kategori[kat];
      if (!isi?.length) continue;
      let tujuan = blok.find((x) => x.kategori === kat);
      if (!tujuan) {
        tujuan = { kategori: kat, baris: [`### ${kat}`] };
        const sesudah = blok.findIndex((x) => KATEGORI.indexOf(x.kategori) > KATEGORI.indexOf(kat));
        blok.splice(sesudah < 0 ? blok.length : sesudah, 0, tujuan);
      }
      rapikanEkor(tujuan.baris).push(...isi);
    }
  }
  const tubuh = [];
  const awalan = rapikanEkor([...pembuka]);
  while (awalan.length && awalan[0].trim() === "") awalan.shift();
  if (awalan.length) tubuh.push(...awalan, "");
  blok.forEach((x, i) => {
    if (i) tubuh.push("");
    tubuh.push(...rapikanEkor(x.baris));
  });
  const hasil = [...baris.slice(0, awal + 1), "", ...tubuh, "", ...baris.slice(akhir)];
  return crlf ? hasil.join("\r\n") : hasil.join("\n");
};
