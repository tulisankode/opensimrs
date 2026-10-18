import { Galat, permintaanSalah } from "../umum/respons.js";

// Konstanta & helper bersama modul Laundry & Linen (siklus linen kotor → cuci → bersih → distribusi ke ruangan).
//
// Siklus & buku stok (laundry_transaksi_stok, saldo = Σ masuk − Σ keluar; tidak pernah diubah langsung):
//   1. Serah terima kotor dikonfirmasi petugas laundry (≠ penyerah) → KELUAR dari stok ruangan asal sebanyak
//      jumlah yang diterima. Linen kotor lalu menjadi antrean cuci (jumlah diterima − jumlah sudah masuk batch).
//   2. Batch dibentuk dari rincian penerimaan berkategori sama; tahapan pencucian → pengeringan → setrika/lipat
//      berurutan. Saat setrika/lipat selesai → MASUK stok bersih laundry (lokasi_tipe "laundry").
//   3. Distribusi dikirim → KELUAR dari stok bersih laundry; dikonfirmasi ruangan (≠ pengirim) → MASUK stok
//      ruangan sebanyak jumlah yang diterima (selisih tercatat dengan alasan).
//   4. Koreksi hilang/rusak/afkir → KELUAR dengan alasan & pelaku.
// Setiap pengeluaran dikunci per (faskes, lokasi, jenis linen) dengan advisory lock transaksi dan ditolak bila
// melampaui saldo (KF-11/KT-10) — saldo tidak pernah negatif walau transaksi berjalan bersamaan.

export const konflik = (pesan) => new Galat(409, pesan);

// Kategori linen pada rincian penerimaan kotor; kategori berbeda tidak boleh digabung dalam satu batch (KF-7).
export const KATEGORI_LINEN = { biasa: "Biasa", infeksius: "Infeksius", bernoda_berat: "Bernoda Berat" };

export const STATUS_PENERIMAAN = { menunggu_konfirmasi: "Menunggu Konfirmasi", selesai: "Selesai" };

export const STATUS_BATCH = { proses: "Proses", selesai: "Selesai" };
export const TAHAP_BATCH = { pencucian: "Pencucian", pengeringan: "Pengeringan", setrika_lipat: "Setrika/Lipat" };
export const STATUS_TAHAP = { belum: "Belum", berjalan: "Berjalan", selesai: "Selesai" };
export const URUTAN_TAHAP = ["pencucian", "pengeringan", "setrika_lipat"];

export const STATUS_PERMINTAAN = { menunggu: "Menunggu", sebagian: "Sebagian Terpenuhi", selesai: "Selesai", dibatalkan: "Dibatalkan" };
export const STATUS_DISTRIBUSI = { menunggu_konfirmasi: "Menunggu Konfirmasi", selesai: "Selesai" };

export const JENIS_KOREKSI = { hilang: "Hilang", rusak: "Rusak", afkir: "Afkir" };
export const LOKASI_TIPE = { ruangan: "Ruangan", laundry: "Laundry (Stok Bersih)" };

export const pilihan = (obj) => Object.entries(obj).map(([kode, nama]) => ({ kode, nama }));

export const cekPilihan = (nilai, obj, nama) => {
  if (nilai === undefined || nilai === null || nilai === "") return nilai === "" ? null : nilai;
  if (!Object.prototype.hasOwnProperty.call(obj, nilai)) throw permintaanSalah(`${nama} harus salah satu: ${Object.keys(obj).join(", ")}`);
  return nilai;
};

export const teks = (v) => (v === undefined ? undefined : String(v ?? "").trim() || null);

export const angkaOpsional = (v, nama) => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) throw permintaanSalah(`${nama} harus berupa angka`);
  return n;
};

export const angkaWajib = (v, nama) => {
  const n = angkaOpsional(v, nama);
  if (n === undefined || n === null) throw permintaanSalah(`${nama} wajib diisi`);
  return n;
};

export const boolOpsional = (v) => (v === undefined ? undefined : v === true || v === "true" || v === 1 || v === "1");

// Jumlah linen dihitung per unit/lembar (bilangan bulat > 0); berat cucian dicatat terpisah dalam kg (desimal > 0).
export const bulatPositif = (v, nama) => {
  const n = angkaWajib(v, nama);
  if (!Number.isInteger(n) || n <= 0) throw permintaanSalah(`${nama} harus berupa bilangan bulat lebih besar dari nol`);
  return n;
};
export const beratPositif = (v, nama) => {
  const n = angkaWajib(v, nama);
  if (n <= 0 || n > 100000) throw permintaanSalah(`${nama} harus lebih besar dari nol (kg)`);
  return Math.round(n * 1000) / 1000;
};

// Waktu epoch detik opsional (bawaan bila kosong).
export const epochOpsional = (v, nama, bawaan) => {
  const n = angkaOpsional(v, nama);
  if (n === undefined || n === null) return bawaan;
  if (!Number.isInteger(n) || n <= 0) throw permintaanSalah(`${nama} harus berupa waktu epoch detik`);
  return n;
};

// Filter periode ?dari=&sampai= (epoch detik, inklusif) → { dari, sampai } (null bila tidak diisi).
export const periode = (q = {}) => {
  const dari = epochOpsional(q.dari, "dari", null);
  const sampai = epochOpsional(q.sampai, "sampai", null);
  if (dari && sampai && dari > sampai) throw permintaanSalah("Rentang tanggal tidak valid (dari > sampai)");
  return { dari, sampai };
};

// Rincian tidak boleh memuat kunci (mis. jenis linen) yang sama dua kali; diurutkan agar urutan penguncian stok
// selalu sama (mencegah deadlock antartransaksi yang mengunci beberapa jenis linen).
export const rincianUnik = (rincian, kunci, nama = "Rincian") => {
  if (!Array.isArray(rincian) || !rincian.length) throw permintaanSalah(`${nama} wajib diisi`);
  if (rincian.length > 200) throw permintaanSalah(`${nama} maksimal 200 baris`);
  const lihat = new Set();
  for (const r of rincian) {
    const k = String(r?.[kunci] ?? "");
    if (!k) throw permintaanSalah(`${kunci} wajib diisi pada setiap baris ${nama.toLowerCase()}`);
    if (lihat.has(k)) throw permintaanSalah(`${nama} memuat ${kunci} yang sama lebih dari sekali`);
    lihat.add(k);
  }
  return [...rincian].sort((a, b) => String(a[kunci]).localeCompare(String(b[kunci])));
};

// Status permintaan dari jumlah terpenuhi per rincian (distribusi sebagian tetap "sebagian" — KT-11).
export const statusPermintaan = (rincian) => {
  const total = rincian.reduce((s, r) => s + Number(r.jumlah_terpenuhi ?? 0), 0);
  if (rincian.length && rincian.every((r) => Number(r.jumlah_terpenuhi ?? 0) >= Number(r.jumlah_diminta))) return "selesai";
  return total > 0 ? "sebagian" : "menunggu";
};

// Tahap boleh diubah bila tahap sebelumnya sudah selesai dan tahap ini belum selesai (alur maju saja).
export const cekTransisiTahap = (tahapan, tahap, status) => {
  const i = URUTAN_TAHAP.indexOf(tahap);
  if (i < 0) throw permintaanSalah(`tahap harus salah satu: ${URUTAN_TAHAP.join(", ")}`);
  if (!["berjalan", "selesai"].includes(status)) throw permintaanSalah("status tahap harus berjalan atau selesai");
  const kini = tahapan.find((t) => t.tahap === tahap);
  if (!kini) throw permintaanSalah("Tahap batch tidak ditemukan");
  if (kini.status === "selesai") throw konflik(`Tahap ${TAHAP_BATCH[tahap]} sudah selesai`);
  if (kini.status === status) throw konflik(`Tahap ${TAHAP_BATCH[tahap]} sudah berstatus ${STATUS_TAHAP[status]}`);
  if (i > 0 && tahapan.find((t) => t.tahap === URUTAN_TAHAP[i - 1])?.status !== "selesai")
    throw permintaanSalah(`Tahap ${TAHAP_BATCH[URUTAN_TAHAP[i - 1]]} harus diselesaikan terlebih dahulu`);
  return { selesaiBatch: tahap === URUTAN_TAHAP[URUTAN_TAHAP.length - 1] && status === "selesai" };
};
