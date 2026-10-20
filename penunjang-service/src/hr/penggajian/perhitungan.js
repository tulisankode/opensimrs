import { permintaanSalah } from "../../umum/respons.js";
import { hash, wajibTeks } from "./bersama.js";

// Parameter menerima enam desimal. Pecahan perantara dipertahankan tepat sampai titik pembulatan yang disahkan.
const SKALA = 1000000n;
const BATAS = 999999999999999999n;
export const desimal = (v) => {
  if (typeof v !== "string" || !/^-?\d{1,16}(\.\d{1,6})?$/.test(v)) throw permintaanSalah("Angka wajib berupa string desimal, maksimal enam desimal");
  const [a, b = ""] = v.replace("-", "").split(".");
  return (v.startsWith("-") ? -1n : 1n) * (BigInt(a) * SKALA + BigInt(b.padEnd(6, "0")));
};
export const sen = (v) => {
  if (typeof v !== "string" || !/^-?\d{1,16}(\.\d{1,2})?$/.test(v)) throw permintaanSalah("Nominal wajib berupa string dengan maksimal dua desimal");
  const n = desimal(v) / 10000n;
  if (n > BATAS || n < -BATAS) throw permintaanSalah("Nominal melampaui NUMERIC(18,2)");
  return n;
};
export const uang = (n) => {
  if (n > BATAS || n < -BATAS) throw permintaanSalah("Nominal melampaui NUMERIC(18,2)");
  const a = n < 0n ? -n : n;
  return `${n < 0n ? "-" : ""}${a / 100n}.${String(a % 100n).padStart(2, "0")}`;
};
export const senAman = (v) => {
  const n = sen(v);
  if (n > BigInt(Number.MAX_SAFE_INTEGER) || n < -BigInt(Number.MAX_SAFE_INTEGER)) throw permintaanSalah("Nominal melampaui batas antarmuka Akuntansi");
  return Number(n);
};
export const bulat = (nilai, aturan) => {
  if (!["setengah_ke_atas", "ke_bawah", "ke_atas"].includes(aturan?.metode)) throw permintaanSalah("Metode pembulatan wajib dikonfigurasi");
  const satuan = sen(aturan.satuan);
  if (satuan <= 0n) throw permintaanSalah("Satuan pembulatan harus positif");
  const pecahan = typeof nilai === "bigint" ? { n: nilai, d: 1n } : nilai;
  const pembagi = satuan * 10000n * pecahan.d;
  const tanda = pecahan.n < 0n ? -1n : 1n;
  const a = pecahan.n * tanda;
  let q = a / pembagi;
  const sisa = a % pembagi;
  if (aturan.metode === "setengah_ke_atas" && sisa * 2n >= pembagi || aturan.metode === "ke_atas" && tanda > 0n && sisa || aturan.metode === "ke_bawah" && tanda < 0n && sisa) q++;
  return uang(q * satuan * tanda);
};

const pecahan = (n, d = 1n) => {
  if (!d) throw permintaanSalah("Pembagian nol");
  if (d < 0n) { n = -n; d = -d; }
  let a = n < 0n ? -n : n, b = d;
  while (b) [a, b] = [b, a % b];
  n /= a; d /= a;
  if (n > 10n ** 72n || n < -(10n ** 72n) || d > 10n ** 72n) throw permintaanSalah("Angka perantara melampaui batas");
  return { n, d };
};
const banding = (a, b) => a.n * b.d - b.n * a.d;
export const evaluasiEksak = (ekspresi, variabel = {}, definisi = {}) => {
  let jumlah = 0;
  const jalur = new Set();
  const hitung = (e, tingkat = 0) => {
    if (++jumlah > 2000 || tingkat > 32) throw permintaanSalah("Ekspresi terlalu kompleks");
    if (!e || typeof e !== "object" || Array.isArray(e)) throw permintaanSalah("Ekspresi harus berupa objek");
    let hasil;
    if (e.op === "konstanta") hasil = pecahan(desimal(e.nilai));
    else if (e.op === "variabel") {
      const nama = wajibTeks(e.nama, "nama variabel", 80);
      if (jalur.has(nama)) throw permintaanSalah("Referensi rumus siklik");
      if (Object.hasOwn(variabel, nama)) hasil = pecahan(desimal(variabel[nama]));
      else if (Object.hasOwn(definisi, nama)) {
        jalur.add(nama);
        hasil = hitung(definisi[nama], tingkat + 1);
        jalur.delete(nama);
      } else throw permintaanSalah(`Parameter ${nama} tidak tersedia`);
    } else if (e.op === "kondisi") {
      const a = hitung(e.kiri, tingkat + 1), b = hitung(e.kanan, tingkat + 1);
      if (!["lt", "lte", "eq", "gte", "gt"].includes(e.perbandingan)) throw permintaanSalah("Perbandingan tidak didukung");
      const beda = banding(a, b);
      const cocok = { lt: beda < 0n, lte: beda <= 0n, eq: beda === 0n, gte: beda >= 0n, gt: beda > 0n }[e.perbandingan];
      hasil = hitung(cocok ? e.jika : e.selain, tingkat + 1);
    } else if (e.op === "rentang") {
      if (!Array.isArray(e.rentang) || !e.rentang.length || e.rentang.length > 100) throw permintaanSalah("Daftar rentang tidak sah");
      const daftar = e.rentang.map((r) => ({ ...r, min: desimal(r.mulai), maks: r.sampai == null ? null : desimal(r.sampai) }));
      daftar.forEach((r, i) => {
        if (r.maks !== null && r.maks <= r.min || i && (daftar[i - 1].maks === null || daftar[i - 1].maks > r.min)) throw permintaanSalah("Rentang tarif bertumpang tindih atau tidak terurut");
      });
      const x = hitung(e.dasar, tingkat + 1);
      const r = daftar.find((r) => banding(x, pecahan(r.min)) >= 0n && (r.maks === null || banding(x, pecahan(r.maks)) < 0n));
      if (!r) throw permintaanSalah("Dasar tidak tercakup rentang tarif");
      hasil = hitung(r.hasil, tingkat + 1);
    } else {
      if (!["tambah", "kurang", "kali", "bagi", "minimum", "maksimum"].includes(e.op) || !Array.isArray(e.argumen) || e.argumen.length < 2 || e.argumen.length > 100) throw permintaanSalah("Operasi rumus tidak diizinkan");
      const a = e.argumen.map((x) => hitung(x, tingkat + 1));
      hasil = a.slice(1).reduce((v, x) => {
        if (e.op === "tambah") return pecahan(v.n * x.d + x.n * v.d, v.d * x.d);
        if (e.op === "kurang") return pecahan(v.n * x.d - x.n * v.d, v.d * x.d);
        if (e.op === "kali") return pecahan(v.n * x.n, v.d * x.d * SKALA);
        if (e.op === "bagi") return pecahan(v.n * x.d * SKALA, v.d * x.n);
        return e.op === "minimum" ? (banding(v, x) < 0n ? v : x) : (banding(v, x) > 0n ? v : x);
      }, a[0]);
    }
    return hasil;
  };
  return hitung(ekspresi);
};

// Proyeksi bilangan berskala untuk pemeriksaan; penghitungan uang selalu memakai pecahan eksak.
export const evaluasi = (...a) => { const x = evaluasiEksak(...a); return x.n / x.d; };

export const validasiKonfigurasi = (b) => {
  wajibTeks(b.dasar_aturan, "dasar_aturan", 4000);
  const a = b.aturan, k = b.kebijakan;
  if (!a || !k || !["awal_bulan", "akhir_bulan"].includes(k.tanggal_acuan) || k.kehadiran_tidak_digunakan !== true || !["kena_pajak", "bukan_objek"].includes(k.perlakuan_pajak_jaspel)) throw permintaanSalah("Kebijakan tanggal acuan, perlakuan pajak jaspel, dan ketidaktersediaan Kehadiran wajib ditetapkan; prorata belum didukung");
  if (k.penyaluran_jaspel !== "utuh" || k.waktu_jurnal !== "pembayaran" || k.penerbitan_slip !== "pembayaran_dan_jurnal" || k.pemisahan_tugas !== "wajib" || k.perubahan_tengah_bulan !== "tanggal_acuan") throw permintaanSalah("Kebijakan penyaluran jaspel, waktu jurnal, slip, pemisahan tugas, dan perubahan tengah bulan wajib ditetapkan sesuai kemampuan yang didukung");
  if (a.metode !== "periodik" || a.rekonsiliasi !== "tidak_diperlukan") throw permintaanSalah("Metode atau rekonsiliasi belum didukung; jangan memakai konfigurasi yang memerlukan rekonsiliasi tahunan");
  if (!Array.isArray(a.parameter_wajib) || !Array.isArray(a.potongan) || !Array.isArray(a.iuran_pemberi_kerja)) throw permintaanSalah("Parameter, potongan, dan iuran pemberi kerja wajib ditetapkan");
  if (a.parameter_wajib.length > 100 || a.parameter_wajib.some((p) => typeof p !== "string" || !/^[a-z][a-z0-9_]{0,79}$/.test(p))) throw permintaanSalah("Nama parameter wajib tidak sah");
  const semua = [...a.potongan, ...a.iuran_pemberi_kerja];
  if (semua.some((r) => !r || typeof r !== "object" || Array.isArray(r))) throw permintaanSalah("Setiap aturan wajib berupa objek");
  if (semua.length > 40 || new Set(semua.map((x) => x.kode)).size !== semua.length) throw permintaanSalah("Kode aturan ganda atau terlalu banyak");
  for (const kode of ["bpjs_kesehatan", "bpjs_ketenagakerjaan", "pph21"]) if (!a.potongan.some((x) => x.kode === kode)) throw permintaanSalah(`Aturan ${kode} wajib dikonfigurasi secara eksplisit`);
  for (const r of semua) {
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(r.kode)) throw permintaanSalah("Kode aturan tidak sah");
    wajibTeks(r.dasar_aturan, "dasar aturan potongan");
    if (!["bpjs", "pph21", "potongan_lain"].includes(r.kategori)) throw permintaanSalah("Kategori kewajiban aturan wajib ditetapkan");
    if (r.kode === "pph21" && r.kategori !== "pph21" || ["bpjs_kesehatan", "bpjs_ketenagakerjaan"].includes(r.kode) && r.kategori !== "bpjs") throw permintaanSalah("Kategori aturan wajib sesuai jenis BPJS/PPh 21");
  }
  if (a.iuran_pemberi_kerja.some((r) => r.kategori !== "bpjs")) throw permintaanSalah("Iuran pemberi kerja dasar hanya mendukung kewajiban BPJS");
  bulat(0n, a.pembulatan);
  if (!Array.isArray(b.kasus_uji) || !b.kasus_uji.length || b.kasus_uji.length > 100) throw permintaanSalah("Kasus uji keuangan wajib disertakan");
  for (const u of b.kasus_uji) {
    const hasil = hitungAturan(a, u.parameter);
    if (hash(hasil) !== hash(u.ekspektasi)) throw permintaanSalah("Hasil kasus uji tidak sesuai ekspektasi keuangan");
  }
  return b;
};
export const hitungAturan = (aturan, parameter) => {
  if (!parameter || typeof parameter !== "object" || Array.isArray(parameter)) throw permintaanSalah("Parameter wajib berupa objek desimal");
  for (const p of aturan.parameter_wajib) if (!Object.hasOwn(parameter ?? {}, p)) throw permintaanSalah(`Parameter wajib ${p} belum tersedia`);
  const hasil = {};
  for (const r of [...aturan.potongan, ...aturan.iuran_pemberi_kerja]) {
    hasil[r.kode] = bulat(evaluasiEksak(r.rumus, parameter, aturan.definisi ?? {}), aturan.pembulatan);
    if (sen(hasil[r.kode]) < 0n) throw permintaanSalah("Potongan atau iuran tidak boleh negatif");
  }
  return hasil;
};
