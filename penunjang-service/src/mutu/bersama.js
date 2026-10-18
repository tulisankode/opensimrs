import { Galat, permintaanSalah } from "../umum/respons.js";
import { HARI, awalHariWib, sekarangDetik, validasiBerkas as validasiBerkasUmum } from "../sarpras/bersama.js";

// Konstanta & helper murni modul Mutu & Akreditasi — fitur Dokumen Akreditasi & Kredensial Staf (STD-0028). Tanpa
// database agar dapat diuji unit (test/mutu.test.js). Helper validasi umum (teks, epoch, enum) dipakai ulang dari
// sarpras/bersama.js.
//
// Tanggal (terbit, tinjau ulang, masa berlaku kredensial) disimpan sebagai epoch detik awal hari Asia/Jakarta (WIB).
// Kredensial berlaku sampai akhir hari tanggal_berakhir: "kedaluwarsa" baru berlaku setelah hari itu lewat (WIB),
// sehingga hasilnya tidak bergantung zona waktu server.
export {
  teks,
  teksWajib,
  epochOpsional,
  epochWajib,
  bulatOpsional,
  boolOpsional,
  cekPilihan,
  wajibPilihan,
  pilihan,
  konflik,
  awalHariWib,
  sekarangDetik,
  HARI,
} from "../sarpras/bersama.js";

export const JENIS_DOKUMEN = { kebijakan: "Kebijakan", pedoman: "Pedoman", spo: "SPO", program: "Program", bukti: "Bukti" };
export const STATUS_DOKUMEN = { draf: "Draf", disahkan: "Disahkan", kedaluwarsa: "Kedaluwarsa", dicabut: "Dicabut" };
// Kredensial staf adalah SATU sumber data untuk Mutu & Akreditasi (Kredensial Staf) dan HR / SDM (Kredensial Pegawai):
// keduanya membaca/menulis tabel mutu_kredensial lewat buatRuteKredensial() (kredensial.js). Jenis sertifikat_kompetensi
// & lainnya berasal dari rancangan STD-0035 (data lama hr_kredensial dipindahkan migrasi 20261018210010).
export const JENIS_KREDENSIAL = {
  str: "STR",
  sip: "SIP",
  sertifikat: "Sertifikat Pelatihan",
  sertifikat_kompetensi: "Sertifikat Kompetensi",
  rkk: "RKK",
  spk: "SPK",
  lainnya: "Lainnya",
};
export const STATUS_KREDENSIAL = { aktif: "Aktif", dicabut: "Dicabut" };
// Verifikasi keaslian dokumen (STD-0035 KF-8). Perubahan data inti/berkas mengembalikan status ke belum_diverifikasi.
export const STATUS_VERIFIKASI = { belum_diverifikasi: "Belum Diverifikasi", terverifikasi: "Terverifikasi", ditolak: "Ditolak" };
export const KOLOM_INTI_KREDENSIAL = ["jenis", "nomor", "penerbit", "tanggal_mulai", "tanggal_berakhir", "practitioner_uuid"];
// true bila perubahan menyentuh data inti kredensial (BIGINT dibaca pg sebagai string → dibandingkan sebagai teks).
export const perluVerifikasiUlang = (lama, perubahan) =>
  KOLOM_INTI_KREDENSIAL.some((k) => perubahan?.[k] !== undefined && String(perubahan[k] ?? "") !== String(lama?.[k] ?? ""));
export const MASA_BERLAKU = { aktif: "Berlaku", peringatan_90: "Berakhir ≤ 90 hari", peringatan_30: "Berakhir ≤ 30 hari", kedaluwarsa: "Kedaluwarsa" };

// Status dokumen selalu diubah manual (KF-7: tinjau ulang tidak mencabut otomatis).
// draf → disahkan | dicabut; disahkan → kedaluwarsa | dicabut; kedaluwarsa → dicabut; dicabut final.
export const TRANSISI_DOKUMEN = { draf: ["disahkan", "dicabut"], disahkan: ["kedaluwarsa", "dicabut"], kedaluwarsa: ["dicabut"], dicabut: [] };
export const transisiDokumenSah = (dari, ke) => (TRANSISI_DOKUMEN[dari] ?? []).includes(ke);

// Batas epoch penyaringan masa berlaku relatif terhadap awal hari ini (WIB):
//   kedaluwarsa   : tanggal_berakhir < hariIni
//   peringatan_30 : hariIni ≤ tanggal_berakhir ≤ hariIni + 30 hari
//   peringatan_90 : hariIni + 30 hari < tanggal_berakhir ≤ hariIni + 90 hari
//   aktif         : tanpa tanggal_berakhir atau > hariIni + 90 hari
export const batasMasaBerlaku = (sekarang = sekarangDetik()) => {
  const hariIni = awalHariWib(sekarang);
  return { hariIni, batas30: hariIni + 30 * HARI, batas90: hariIni + 90 * HARI };
};

export const statusMasaBerlaku = (tanggalBerakhir, sekarang = sekarangDetik()) => {
  if (tanggalBerakhir === null || tanggalBerakhir === undefined || tanggalBerakhir === "") return "aktif";
  const { hariIni, batas30, batas90 } = batasMasaBerlaku(sekarang);
  const akhir = awalHariWib(tanggalBerakhir);
  if (akhir < hariIni) return "kedaluwarsa";
  if (akhir <= batas30) return "peringatan_30";
  if (akhir <= batas90) return "peringatan_90";
  return "aktif";
};

// Sisa hari berlaku (0 = berakhir hari ini, negatif = sudah lewat); null bila tanpa batas.
export const sisaHari = (tanggalBerakhir, sekarang = sekarangDetik()) =>
  tanggalBerakhir === null || tanggalBerakhir === undefined || tanggalBerakhir === ""
    ? null
    : Math.round((awalHariWib(tanggalBerakhir) - awalHariWib(sekarang)) / HARI);

// Penyaring SQL masa berlaku untuk kolom `kol`, parameter mulai dari $n → { sql, params }.
export const saringMasaBerlaku = (nilai, kol, n, sekarang = sekarangDetik()) => {
  const { hariIni, batas30, batas90 } = batasMasaBerlaku(sekarang);
  if (nilai === "kedaluwarsa") return { sql: `${kol} < $${n}`, params: [hariIni] };
  if (nilai === "peringatan_30") return { sql: `${kol} BETWEEN $${n} AND $${n + 1}`, params: [hariIni, batas30] };
  if (nilai === "peringatan_90") return { sql: `${kol} > $${n} AND ${kol} <= $${n + 1}`, params: [batas30, batas90] };
  if (nilai === "aktif") return { sql: `(${kol} IS NULL OR ${kol} > $${n})`, params: [batas90] };
  throw permintaanSalah(`masa_berlaku harus salah satu: ${Object.keys(MASA_BERLAKU).join(", ")}`);
};

// "Perlu ditinjau" adalah penanda turunan (KF-7/KT-5): dokumen disahkan yang tanggal tinjau ulangnya sudah tiba
// (hari ini atau lewat, WIB). Tidak mengubah status.
export const perluTinjau = (dokumen, sekarang = sekarangDetik()) =>
  dokumen?.status === "disahkan" &&
  dokumen.tanggal_tinjau_ulang !== null &&
  dokumen.tanggal_tinjau_ulang !== undefined &&
  awalHariWib(dokumen.tanggal_tinjau_ulang) <= awalHariWib(sekarang);

// Versi berikutnya: versi numerik dinaikkan 1 ("2" → "3", "1.4" → "1.5"); selain itu null (wajib diisi pengguna).
export const versiBerikutnya = (versi) => {
  const v = String(versi ?? "").trim();
  if (/^\d+$/.test(v)) return String(Number(v) + 1);
  const m = v.match(/^(.*\.)(\d+)$/);
  return m ? `${m[1]}${Number(m[2]) + 1}` : null;
};

// Persentase kelengkapan bukti (1 desimal); null bila tidak ada elemen.
export const persen = (bukti, total) => (Number(total) > 0 ? Math.round((Number(bukti) / Number(total)) * 1000) / 10 : null);

// Baris kesiapan per elemen [{ instrumen_*, bab_*, standar_*, elemen_uuid, ada_bukti }] → pohon
// instrumen → bab → standar, masing-masing { total_elemen, elemen_terbukti, persen } (KF-10).
export const susunKesiapan = (baris) => {
  const instrumen = [];
  const cari = (daftar, uuid, buat) => {
    let x = daftar.find((d) => d.uuid === uuid);
    if (!x) daftar.push((x = buat()));
    return x;
  };
  const tambah = (x, ada) => {
    x.total_elemen += 1;
    if (ada) x.elemen_terbukti += 1;
  };
  for (const r of baris) {
    const i = cari(instrumen, r.instrumen_uuid, () => ({ uuid: r.instrumen_uuid, kode: r.instrumen_kode, nama: r.instrumen_nama, total_elemen: 0, elemen_terbukti: 0, bab: [] }));
    if (!r.bab_uuid) continue;
    const b = cari(i.bab, r.bab_uuid, () => ({ uuid: r.bab_uuid, kode: r.bab_kode, nama: r.bab_nama, total_elemen: 0, elemen_terbukti: 0, standar: [] }));
    if (!r.standar_uuid) continue;
    const s = cari(b.standar, r.standar_uuid, () => ({ uuid: r.standar_uuid, kode: r.standar_kode, nama: r.standar_nama, total_elemen: 0, elemen_terbukti: 0 }));
    if (!r.elemen_uuid) continue;
    const ada = r.ada_bukti === true || r.ada_bukti === "t";
    tambah(i, ada);
    tambah(b, ada);
    tambah(s, ada);
  }
  const hitung = (x) => ({ ...x, persen: persen(x.elemen_terbukti, x.total_elemen) });
  return instrumen.map((i) => ({ ...hitung(i), bab: i.bab.map((b) => ({ ...hitung(b), standar: b.standar.map(hitung) })) }));
};

// ── Impor instrumen (CSV): kolom bab_kode,bab_nama,standar_kode,standar_nama,elemen_kode,elemen_uraian
export const KOLOM_IMPOR = ["bab_kode", "bab_nama", "standar_kode", "standar_nama", "elemen_kode", "elemen_uraian"];
export const MAKS_BARIS_IMPOR = 5000;

// Parser CSV sederhana (RFC 4180): pemisah koma atau titik koma (ditentukan dari baris judul), kutip ganda, dan
// baris baru di dalam kutip.
export const uraiCsv = (isi) => {
  const teksCsv = String(isi ?? "").replace(/^﻿/, "");
  const barisPertama = teksCsv.split(/\r?\n/, 1)[0] ?? "";
  const pemisah = (barisPertama.match(/;/g)?.length ?? 0) > (barisPertama.match(/,/g)?.length ?? 0) ? ";" : ",";
  const hasil = [];
  let baris = [];
  let sel = "";
  let kutip = false;
  for (let i = 0; i < teksCsv.length; i++) {
    const c = teksCsv[i];
    if (kutip) {
      if (c === '"' && teksCsv[i + 1] === '"') {
        sel += '"';
        i++;
      } else if (c === '"') kutip = false;
      else sel += c;
    } else if (c === '"') kutip = true;
    else if (c === pemisah) {
      baris.push(sel);
      sel = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && teksCsv[i + 1] === "\n") i++;
      baris.push(sel);
      hasil.push(baris);
      baris = [];
      sel = "";
    } else sel += c;
  }
  if (sel !== "" || baris.length) {
    baris.push(sel);
    hasil.push(baris);
  }
  return hasil.filter((b) => b.some((x) => String(x).trim() !== ""));
};

// CSV → [{ bab_kode, ... }] memakai nama kolom dari baris judul (huruf kecil). 400 bila kolom wajib tidak ada.
export const barisImpor = (isi) => {
  const semua = uraiCsv(isi);
  if (semua.length < 2) throw permintaanSalah("Berkas CSV kosong atau hanya berisi judul kolom");
  const judul = semua[0].map((x) => String(x).trim().toLowerCase());
  const kurang = KOLOM_IMPOR.filter((k) => !judul.includes(k));
  if (kurang.length) throw permintaanSalah(`Kolom CSV wajib tidak ditemukan: ${kurang.join(", ")}`);
  if (semua.length - 1 > MAKS_BARIS_IMPOR) throw permintaanSalah(`Maksimal ${MAKS_BARIS_IMPOR} baris per impor`);
  return semua.slice(1).map((b) => Object.fromEntries(judul.map((k, i) => [k, String(b[i] ?? "").trim()])));
};

// Validasi hierarki per baris (G4/KT-2): elemen wajib punya standar induk, standar wajib punya bab induk. Nomor baris
// CSV dihitung dari 2 (baris 1 = judul). Mengembalikan [{ baris, alasan }] untuk baris yang ditolak.
export const validasiHierarkiImpor = (baris) =>
  baris
    .map((r, i) => {
      const alasan = [];
      const isi = (k) => String(r?.[k] ?? "").trim();
      if (!isi("bab_kode") || !isi("bab_nama")) alasan.push("bab_kode dan bab_nama wajib diisi (bab induk)");
      if (!isi("standar_kode") || !isi("standar_nama")) alasan.push("standar_kode dan standar_nama wajib diisi (standar induk)");
      if (!isi("elemen_kode") || !isi("elemen_uraian")) alasan.push("elemen_kode dan elemen_uraian wajib diisi");
      for (const k of ["bab_kode", "standar_kode", "elemen_kode"]) if (isi(k).length > 50) alasan.push(`${k} maksimal 50 karakter`);
      for (const k of ["bab_nama", "standar_nama"]) if (isi(k).length > 255) alasan.push(`${k} maksimal 255 karakter`);
      if (isi("elemen_uraian").length > 5000) alasan.push("elemen_uraian maksimal 5000 karakter");
      return alasan.length ? { baris: i + 2, alasan: alasan.join("; ") } : null;
    })
    .filter(Boolean);

// ── Berkas: dokumen akreditasi PDF saja; kredensial PDF/JPG/PNG (keputusan desain §9.3). Dikirim JSON
// { nama_berkas, tipe_mime, data_base64 }; tipe diperiksa dari isi (magic bytes) & ukuran dibatasi MAX_UPLOAD_MUTU_MB.
export const TIPE_BERKAS_DOKUMEN = ["application/pdf"];
export const TIPE_BERKAS_KREDENSIAL = ["application/pdf", "image/jpeg", "image/png"];
const namaTipe = (t) => ({ "application/pdf": "PDF", "image/jpeg": "JPG", "image/png": "PNG" })[t] ?? t;
export const validasiBerkasMutu = (b, maksMb, tipeDiizinkan) => {
  if (!b || typeof b !== "object" || Array.isArray(b)) throw permintaanSalah("berkas wajib diunggah");
  const tipe = String(b.tipe_mime ?? "").toLowerCase();
  if (!tipeDiizinkan.includes(tipe)) throw permintaanSalah(`Tipe berkas harus ${tipeDiizinkan.map(namaTipe).join("/")}`);
  return validasiBerkasUmum(b, maksMb);
};
export const infoBerkas = (berkas) => ({ nama_berkas: berkas.nama_berkas, tipe_mime: berkas.tipe_mime, ukuran_bita: berkas.ukuran_bita });

// Galat PostgreSQL → status HTTP yang bermakna (bukan 500): unik → 409, FK/format/angka → 400.
export const petakanGalatPg = (e, pesanUnik = "Data dengan kode/nomor yang sama sudah ada") => {
  if (e instanceof Galat || !e?.code) return e;
  if (e.code === "23505") return new Galat(409, pesanUnik);
  if (e.code === "23503") return new Galat(400, "Data rujukan tidak ditemukan");
  if (["22P02", "22003", "22007", "22008", "22001", "23502", "23514"].includes(e.code)) return new Galat(400, "Format data tidak valid");
  return e;
};

// Larik uuid unik (maks 500) dari body; undefined bila tidak dikirim.
export const daftarUuid = (v, nama) => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return [];
  if (!Array.isArray(v)) throw permintaanSalah(`${nama} harus berupa daftar`);
  if (v.length > 500) throw permintaanSalah(`${nama} maksimal 500 butir`);
  return [
    ...new Set(
      v.map((x) => {
        if (typeof x !== "string" || !x.trim() || x.length > 255) throw permintaanSalah(`${nama} berisi nilai tidak valid`);
        return x.trim();
      }),
    ),
  ];
};
