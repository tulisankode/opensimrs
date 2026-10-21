// Konteks asal permintaan dari Asisten Pengembang (tombol mengambang di halaman aplikasi, superadmin + Mode Pengembang):
// halaman, modul/fitur katalog, izin, komponen, galat yang tertangkap, dan hasil cek tampilan. Disaring ketat — hanya
// kunci yang dikenal, teks dipotong, data pribadi ditolak — lalu diteruskan ke prompt setiap tahap bersama entri katalog
// modul terdampak. Rancangan: docs/rancangan/STUDIO-ASISTEN-KONTEKS.md.
import fs from "fs";
import path from "path";
import config from "./config.js";
import { permintaanSalah } from "./respons.js";
import { temukanDataPribadi } from "./kebijakan.js";

const teks = (v, maks = 255) => (v == null || v === "" ? null : String(v).replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, maks) || null);
const angka = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const objek = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);
const BATAS_GALAT = 10;
const BATAS_KOMPONEN = 10;
const BATAS_CEK = 20;
const BATAS_AUDIT = 20;
const ASPEK_AUDIT = ["fungsional", "query", "relasi", "logika", "keamanan"];

// Path halaman tanpa query/hash; segmen UUID/angka panjang diganti agar tidak membawa pengenal data.
export const normalkanPath = (p) =>
  teks(String(p ?? "").split(/[?#]/)[0], 300)
    ?.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":uuid")
    .replace(/\/\d{4,}(?=\/|$)/g, "/:id") ?? null;

export const bersihkanKonteks = (masukan) => {
  const m = objek(masukan);
  if (!m) return null;
  const modul = objek(m.modul), fitur = objek(m.fitur), izin = objek(m.izin);
  const hasil = {
    path: normalkanPath(m.path),
    nama_rute: teks(m.nama_rute, 120),
    modul: modul ? { kode: teks(modul.kode, 60), nama: teks(modul.nama, 120) } : null,
    fitur: fitur ? { kode: teks(fitur.kode, 80), nama: teks(fitur.nama, 160) } : null,
    izin: izin ? { modul: teks(izin.modul, 120), submodul: teks(izin.submodul, 120), aksi: teks(izin.aksi, 60) } : null,
    komponen: (Array.isArray(m.komponen) ? m.komponen : []).map((k) => teks(k, 120)).filter(Boolean).slice(0, BATAS_KOMPONEN),
    // Dialog yang terbuka saat permintaan dibuat (mis. Rekam Medis di atas Rawat Jalan › Poli).
    dialog: objek(m.dialog) ? {
      judul: teks(m.dialog.judul, 120),
      komponen: (Array.isArray(m.dialog.komponen) ? m.dialog.komponen : []).map((k) => teks(k, 120)).filter(Boolean).slice(0, 5),
    } : null,
    galat: (Array.isArray(m.galat) ? m.galat : []).map(objek).filter(Boolean).slice(-BATAS_GALAT).map((g) => ({
      jenis: ["api", "console"].includes(g.jenis) ? g.jenis : "api",
      metode: teks(g.metode, 10),
      path: normalkanPath(g.path),
      status: angka(g.status),
      pesan: teks(g.pesan, 300),
      sumber: teks(g.sumber, 200),
      waktu: angka(g.waktu),
    })),
    cek_tampilan: (Array.isArray(m.cek_tampilan) ? m.cek_tampilan : []).map(objek).filter(Boolean).slice(0, BATAS_CEK).map((c) => ({
      cek: teks(c.cek, 80), lulus: Boolean(c.lulus), rincian: teks(c.rincian, 300),
    })),
    // Temuan Audit cepat yang dipilih pengguna (opsional).
    audit: (Array.isArray(m.audit) ? m.audit : []).map(objek).filter(Boolean).slice(0, BATAS_AUDIT).map((t) => ({
      aspek: ASPEK_AUDIT.includes(t.aspek) ? t.aspek : "fungsional",
      tingkat: ["tinggi", "sedang", "rendah"].includes(t.tingkat) ? t.tingkat : "rendah",
      judul: teks(t.judul, 160),
      rincian: teks(t.rincian, 400),
      bukti: (Array.isArray(t.bukti) ? t.bukti : []).map(objek).filter(Boolean).slice(0, 5)
        .map((b) => ({ berkas: teks(b.berkas, 200), baris: angka(b.baris) })).filter((b) => b.berkas),
    })),
  };
  if (!hasil.path && !hasil.modul?.kode) return null;
  const temuan = temukanDataPribadi(JSON.stringify(hasil));
  if (temuan.length) throw permintaanSalah(`Konteks halaman memuat data yang tampak data pribadi (${temuan.slice(0, 3).join(", ")}); hapus dari pesan galat sebelum dikirim`);
  return hasil;
};

// Ringkasan konteks asal untuk prompt agen.
export const teksKonteksAsal = (k) => {
  if (!k) return "";
  const baris = [
    "Permintaan ini dibuat dari halaman aplikasi berikut (ditangkap otomatis oleh Asisten Pengembang).",
    `- Halaman: ${k.path ?? "-"}${k.nama_rute ? ` (rute \`${k.nama_rute}\`)` : ""}`,
    k.modul?.kode ? `- Modul katalog: ${k.modul.nama ?? "-"} (\`${k.modul.kode}\`)` : null,
    k.fitur?.kode ? `- Fitur katalog: ${k.fitur.nama ?? "-"} (\`${k.fitur.kode}\`)` : null,
    k.izin?.modul ? `- Izin halaman: ${k.izin.modul} › ${k.izin.submodul ?? "-"} › ${k.izin.aksi ?? "READ"}` : null,
    k.dialog?.judul ? `- Dialog yang sedang terbuka: "${k.dialog.judul}"${k.dialog.komponen?.length ? ` (komponen ${k.dialog.komponen.join(", ")})` : ""} — permintaan menyangkut isi dialog ini, bukan halaman di belakangnya` : null,
    k.komponen?.length ? `- Komponen halaman: ${k.komponen.join(", ")}` : null,
  ];
  if (k.galat?.length) {
    baris.push("- Galat yang tertangkap di halaman ini:");
    for (const g of k.galat) baris.push(`  - ${g.jenis === "console" ? "console" : `${g.metode ?? ""} ${g.path ?? ""} → ${g.status ?? "?"}`}: ${g.pesan ?? "-"}${g.sumber ? ` (${g.sumber})` : ""}`);
  }
  const gagal = (k.cek_tampilan ?? []).filter((c) => !c.lulus);
  if (gagal.length) {
    baris.push("- Cek konsistensi tampilan yang belum sesuai:");
    for (const c of gagal) baris.push(`  - ${c.cek}${c.rincian ? `: ${c.rincian}` : ""}`);
  }
  if (k.audit?.length) {
    baris.push("- Temuan Audit cepat (pemeriksaan statis; heuristik — verifikasi di kode sebelum diubah):");
    for (const t of k.audit) {
      const bukti = (t.bukti ?? []).map((b) => `${b.berkas}${b.baris ? `:${b.baris}` : ""}`).join(", ");
      baris.push(`  - [${t.aspek}/${t.tingkat}] ${t.judul}${t.rincian ? ` — ${t.rincian}` : ""}${bukti ? ` (${bukti})` : ""}`);
    }
  }
  baris.push("Gunakan halaman & modul ini sebagai titik awal penelusuran kode; pola halaman lain di modul yang sama menjadi acuan.");
  return baris.filter(Boolean).join("\n");
};

// Entri katalog modul terdampak (kode/nama/instalasi/menu/rute + fitur) dari database/data/katalog-modul.json.
let cacheKatalog = { mtime: 0, isi: null };
const bacaKatalog = () => {
  const berkas = path.join(config.repoDir, "database", "data", "katalog-modul.json");
  try {
    const mtime = fs.statSync(berkas).mtimeMs;
    if (mtime !== cacheKatalog.mtime) cacheKatalog = { mtime, isi: JSON.parse(fs.readFileSync(berkas, "utf8")) };
    return cacheKatalog.isi;
  } catch {
    return null;
  }
};
export const modulKatalog = (rujukan = [], katalog = bacaKatalog()) => {
  if (!katalog?.modul || !rujukan.length) return [];
  const kunci = new Set(rujukan.filter(Boolean).map((r) => String(r).toLowerCase()));
  return katalog.modul.filter((m) => kunci.has(String(m.kode).toLowerCase()) || kunci.has(String(m.nama).toLowerCase()) || (m.menu ?? []).some((x) => kunci.has(String(x).toLowerCase())));
};
export const teksModulKatalog = (rujukan = [], katalog = bacaKatalog()) => {
  const daftar = modulKatalog(rujukan, katalog);
  if (!daftar.length) return "";
  const fitur = katalog?.fitur ?? [];
  return daftar.map((m) => [
    `### ${m.nama} (\`${m.kode}\`)`,
    `- Bidang/instalasi: ${m.bidang ?? "-"} › ${m.instalasi ?? "-"}`,
    `- Menu (nama modul izin): ${(m.menu ?? []).join(", ") || "-"}`,
    `- Rute frontend: ${(m.rute ?? []).join(", ") || "-"}`,
    ...fitur.filter((f) => f.modul === m.kode).map((f) => `- Fitur \`${f.kode}\`: ${f.nama}${f.rute?.length ? ` (rute ${f.rute.join(", ")})` : ""}`),
  ].join("\n")).join("\n\n");
};
