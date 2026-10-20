import { inflateRawSync } from "node:zlib";
import { permintaanSalah } from "../../umum/respons.js";
import { wajibTeks } from "./aturan.js";

const batasBaris = 5000;
const cekSel = (v) => {
  if (String(v).length > 2000) throw permintaanSalah("Isi sel melebihi 2.000 karakter");
  return String(v);
};
export const bacaCsv = (isi) => {
  const hasil = [], baris = [];
  let sel = "", kutip = false, tutup = false;
  isi = isi.replace(/^\uFEFF/, "");
  for (let i = 0; i <= isi.length; i++) {
    const c = isi[i];
    if (kutip) {
      if (c === '"' && isi[i + 1] === '"') { sel += '"'; i++; }
      else if (c === '"') { kutip = false; tutup = true; }
      else if (c === undefined) throw permintaanSalah("Kutip CSV tidak ditutup");
      else sel += c;
    } else if (c === '"' && !sel && !tutup) kutip = true;
    else if (c === "," || c === "\n" || c === undefined) {
      baris.push(cekSel(sel.replace(/\r$/, ""))); sel = ""; tutup = false;
      if (c !== ",") {
        if (baris.some((v) => v !== "")) hasil.push([...baris]);
        baris.length = 0;
        if (hasil.length > batasBaris + 1) throw permintaanSalah("Maksimal 5.000 baris data");
      }
    } else {
      if (tutup && c !== "\r") throw permintaanSalah("Pemisah CSV setelah kutip tidak sah");
      if (c === '"') throw permintaanSalah("Kutip CSV harus berada pada awal sel");
      sel += c;
    }
    if (sel.length > 2000 || baris.length > 100) throw permintaanSalah("Batas ukuran sel atau kolom terlampaui");
  }
  return hasil;
};

// Pembaca XLSX terbatas: arsip ZIP tanpa enkripsi, lembar pertama, nilai teks/angka, tanpa evaluasi formula.
// Batas ekspansi diperiksa sebelum dan ketika dekompresi agar arsip kecil tidak menghabiskan memori.
const bukaZip = (buf) => {
  const entri = new Map();
  let ujung = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { ujung = i; break; }
  if (ujung < 0) throw permintaanSalah("Arsip XLSX tidak sah");
  const n = buf.readUInt16LE(ujung + 10);
  let pos = buf.readUInt32LE(ujung + 16), total = 0;
  if (n > 200 || buf.readUInt16LE(ujung + 4) || buf.readUInt16LE(ujung + 6)) throw permintaanSalah("Arsip XLSX terlalu rumit");
  for (let i = 0; i < n; i++) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== 0x02014b50) throw permintaanSalah("Direktori XLSX tidak sah");
    const flags = buf.readUInt16LE(pos + 8), metode = buf.readUInt16LE(pos + 10);
    const padat = buf.readUInt32LE(pos + 20), ukuran = buf.readUInt32LE(pos + 24);
    const namaLen = buf.readUInt16LE(pos + 28), ekstra = buf.readUInt16LE(pos + 30), komentar = buf.readUInt16LE(pos + 32);
    const nama = buf.subarray(pos + 46, pos + 46 + namaLen).toString("utf8");
    const lokal = buf.readUInt32LE(pos + 42);
    total += ukuran;
    if ((flags & 1) || ![0, 8].includes(metode) || ukuran > 8 * 1024 * 1024 || total > 16 * 1024 * 1024 || /vbaProject|externalLinks/i.test(nama) || entri.has(nama)) throw permintaanSalah("Isi atau ukuran XLSX tidak didukung");
    if (lokal + 30 > buf.length || buf.readUInt32LE(lokal) !== 0x04034b50) throw permintaanSalah("Entri XLSX tidak sah");
    const awal = lokal + 30 + buf.readUInt16LE(lokal + 26) + buf.readUInt16LE(lokal + 28);
    if (awal + padat > buf.length) throw permintaanSalah("Isi XLSX terpotong");
    const data = buf.subarray(awal, awal + padat);
    const terbuka = metode === 8 ? inflateRawSync(data, { maxOutputLength: 8 * 1024 * 1024 }) : data;
    if (terbuka.length !== ukuran) throw permintaanSalah("Ukuran entri XLSX berbeda");
    entri.set(nama, terbuka.toString("utf8"));
    pos += 46 + namaLen + ekstra + komentar;
  }
  return entri;
};
const xmlTeks = (s) => s.replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'").replaceAll("&amp;", "&");
const teksNode = (s) => [...s.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => xmlTeks(m[1])).join("");
export const bacaXlsx = (buf) => {
  const zip = bukaZip(buf);
  for (const isi of zip.values()) if (/<!DOCTYPE|<!ENTITY/i.test(isi)) throw permintaanSalah("Deklarasi entitas XML tidak didukung");
  const lembar = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(zip.get("xl/workbook.xml") ?? "")?.[1];
  const relasi = [...(zip.get("xl/_rels/workbook.xml.rels") ?? "").matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]);
  const rel = relasi.find((s) => new RegExp(`\\bId="${lembar?.replace(/[^\w:.-]/g, "")}"`).test(s));
  const target = /\bTarget="([^"]+)"/.exec(rel ?? "")?.[1];
  const path = target?.startsWith("/xl/") ? target.slice(1) : `xl/${target}`;
  if (!target || /\.\.|TargetMode="External"/.test(rel) || !zip.has(path)) throw permintaanSalah("Lembar pertama XLSX tidak ditemukan");
  const kamus = [...(zip.get("xl/sharedStrings.xml") ?? "").matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map((m) => cekSel(teksNode(m[1])));
  const hasil = [];
  for (const row of zip.get(path).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const baris = [];
    for (const cell of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const alamat = /\br="([A-Z]+)\d+"/.exec(cell[1])?.[1];
      if (!alamat) throw permintaanSalah("Alamat sel XLSX wajib tersedia");
      let kolom = 0;
      for (const h of alamat) kolom = kolom * 26 + h.charCodeAt(0) - 64;
      if (kolom > 100) throw permintaanSalah("Maksimal 100 kolom");
      const isi = cell[2] ?? "";
      if (/<f\b/.test(isi)) throw permintaanSalah("Formula pada lembar impor tidak didukung; gunakan nilai teks");
      const nilai = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(isi)?.[1] ?? "";
      baris[kolom - 1] = cekSel(/\bt="s"/.test(cell[1]) ? kamus[Number(nilai)] ?? "" : /\bt="inlineStr"/.test(cell[1]) ? teksNode(isi) : xmlTeks(nilai));
    }
    hasil.push(Array.from({ length: baris.length }, (_, i) => baris[i] ?? ""));
    if (hasil.length > batasBaris + 1) throw permintaanSalah("Maksimal 5.000 baris data");
  }
  return hasil;
};
export const bacaBerkasImpor = (b) => {
  const nama = wajibTeks(b.nama, "Nama berkas", 150);
  if (!/\.(csv|xlsx)$/i.test(nama)) throw permintaanSalah("Berkas harus CSV atau XLSX");
  const base64 = wajibTeks(b.base64, "Isi berkas", 7 * 1024 * 1024);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw permintaanSalah("Isi berkas bukan base64 yang sah");
  const isi = Buffer.from(base64, "base64");
  if (isi.length > 5 * 1024 * 1024) throw permintaanSalah("Ukuran maksimal berkas 5 MB");
  let tabel;
  try { tabel = /\.csv$/i.test(nama) ? bacaCsv(isi.toString("utf8")) : bacaXlsx(isi); }
  catch (e) { if (e.status) throw e; throw permintaanSalah("Berkas XLSX rusak atau tidak didukung"); }
  if (tabel.length < 2) throw permintaanSalah("Berkas harus memiliki header dan baris data");
  const header = tabel.shift();
  if (new Set(header).size !== header.length || header.some((v) => !v)) throw permintaanSalah("Header harus unik dan tidak kosong");
  const pemetaan = b.pemetaan ?? {};
  for (const nama of ["pegawai", "waktu", "jenis"]) if (!header.includes(pemetaan[nama])) throw permintaanSalah(`Pemetaan ${nama} wajib menunjuk nama kolom yang tersedia`);
  return { header, baris: tabel.map((r, i) => ({ nomor_baris: i + 2, nilai: Object.fromEntries(header.map((h, j) => [h, r[j] ?? ""])) })) };
};
