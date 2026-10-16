// Alat agen SIMRS Studio — dipakai adaptor API (Anthropic/OpenAI/model lokal) dan server MCP (src/mcp.js).
// Semua alat dibatasi ke direktori kerja item (repo atau worktree). Zona merah tidak dapat ditulis, .env tidak dapat dibaca,
// perintah hanya dari daftar putih, dan skema DB hanya struktur (tanpa data).
import fs from "fs";
import path from "path";
import { execFile, spawn } from "child_process";
import { query } from "../db.js";
import { ZONA_MERAH } from "../kebijakan.js";

const BATAS_KELUARAN = 30000;
const potong = (teks, batas = BATAS_KELUARAN) => (teks.length > batas ? `${teks.slice(0, batas)}\n… (dipotong, ${teks.length - batas} karakter lagi)` : teks);

const relatif = (base, p) => path.relative(base, path.resolve(base, String(p ?? ""))).replace(/\\/g, "/");
const dalamBase = (base, p) => {
  const rel = relatif(base, p);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`Path di luar repo: ${p}`);
  return rel;
};
const rahasia = (rel) => /(^|\/)\.env(\.|$)/.test(rel) && !/\.env\.example$/.test(rel);

const git = (args, cwd) =>
  new Promise((resolve) =>
    execFile("git", ["-c", "safe.directory=*", "-c", "core.quotepath=off", ...args], { cwd, maxBuffer: 20 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) =>
      resolve({ ok: !err, keluaran: stdout || stderr || "" }),
    ),
  );

// Pola glob sederhana (**, *, ?) → RegExp.
export const globKeRegex = (pola) =>
  new RegExp(
    `^${String(pola)
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*\//g, "§§")
      .replace(/\*\*/g, "§")
      .replace(/\*/g, "[^/]*")
      .replace(/\?/g, "[^/]")
      .replace(/§§/g, "(?:.*/)?")
      .replace(/§/g, ".*")}$`,
  );

export const PERINTAH_DIIZINKAN = [
  /^node --check [\w./@-]+$/,
  /^node --test( [\w./*@-]+)*$/,
  /^npm test$/,
  /^npm --prefix [\w-]+ (run )?test$/,
  /^npm --prefix frontend-service run build-only$/,
  /^npm run docs:katalog$/,
  /^node scripts\/dokumen-katalog\.mjs( --cek)?$/,
  /^git (status|diff|log)( [\w./=:@^~-]+)*$/,
];
export const perintahDiizinkan = (perintah) => PERINTAH_DIIZINKAN.some((r) => r.test(String(perintah).trim()));

const jalankanPerintah = (perintah, cwd, signal) =>
  new Promise((resolve) => {
    const anak = spawn(perintah, { cwd, shell: true, windowsHide: true, signal });
    let keluaran = "";
    const simpan = (d) => (keluaran = (keluaran + d.toString("utf8")).slice(-BATAS_KELUARAN));
    anak.stdout.on("data", simpan);
    anak.stderr.on("data", simpan);
    const batas = setTimeout(() => anak.kill(), 15 * 60 * 1000);
    anak.on("error", (e) => resolve(`Gagal menjalankan: ${e.message}`));
    anak.on("close", (kode) => {
      clearTimeout(batas);
      resolve(`(kode keluar ${kode})\n${keluaran}`);
    });
  });

// Definisi alat: { nama, deskripsi, skema (JSON Schema), mode: "baca" | "tulis", jalankan(args, konteks) }
// konteks: { base (direktori kerja), signal }
export const ALAT = [
  {
    nama: "baca_berkas",
    deskripsi: "Membaca isi berkas teks di repo (path relatif dari root repo). Gunakan mulai/jumlah untuk berkas panjang.",
    skema: { type: "object", properties: { path: { type: "string" }, mulai: { type: "integer", description: "baris awal (1-based)" }, jumlah: { type: "integer" } }, required: ["path"] },
    mode: "baca",
    jalankan: async ({ path: p, mulai = 1, jumlah = 800 }, { base }) => {
      const rel = dalamBase(base, p);
      if (rahasia(rel)) throw new Error("Berkas .env tidak boleh dibaca agen");
      const isi = fs.readFileSync(path.join(base, rel), "utf8").split("\n");
      const awal = Math.max(Number(mulai) || 1, 1);
      const baris = isi.slice(awal - 1, awal - 1 + Math.min(Number(jumlah) || 800, 2000));
      return `${rel} (baris ${awal}–${awal + baris.length - 1} dari ${isi.length})\n${baris.map((b, i) => `${awal + i}\t${b}`).join("\n")}`;
    },
  },
  {
    nama: "cari",
    deskripsi: "Mencari teks/regex di berkas repo yang terlacak git (git grep). Opsional batasi dengan glob path, mis. 'lab-service/**/*.js'.",
    skema: { type: "object", properties: { pola: { type: "string" }, glob: { type: "string" } }, required: ["pola"] },
    mode: "baca",
    jalankan: async ({ pola, glob }, { base }) => {
      const args = ["grep", "-n", "-I", "-E", "--untracked", "-e", String(pola)];
      if (glob) args.push("--", `:(glob)${glob}`);
      const { keluaran } = await git(args, base);
      const baris = keluaran.split("\n").filter((b) => b && !/(^|\/)\.env(\.|:)/.test(b));
      return baris.length ? potong(baris.slice(0, 300).join("\n")) + (baris.length > 300 ? `\n… ${baris.length - 300} hasil lagi` : "") : "Tidak ada hasil.";
    },
  },
  {
    nama: "daftar_berkas",
    deskripsi: "Mendaftar berkas repo yang cocok dengan glob, mis. 'frontend-service/src/views/Laporan/**'.",
    skema: { type: "object", properties: { glob: { type: "string" } }, required: ["glob"] },
    mode: "baca",
    jalankan: async ({ glob }, { base }) => {
      const { keluaran } = await git(["ls-files", "--cached", "--others", "--exclude-standard"], base);
      const re = globKeRegex(glob);
      const hasil = keluaran.split("\n").filter((p) => p && re.test(p) && !rahasia(p));
      return hasil.length ? potong(hasil.slice(0, 500).join("\n")) : "Tidak ada berkas yang cocok.";
    },
  },
  {
    nama: "baca_skema_db",
    deskripsi: "Struktur tabel PostgreSQL OpenSIMRS (kolom, tipe, nullable, default) — TANPA data. Tanpa argumen: daftar tabel.",
    skema: { type: "object", properties: { tabel: { type: "string", description: "nama tabel; boleh beberapa dipisah koma" } } },
    mode: "baca",
    jalankan: async ({ tabel } = {}) => {
      if (!tabel) {
        const rows = await query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`);
        return rows.map((r) => r.table_name).join(", ");
      }
      const nama = String(tabel).split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20);
      const rows = await query(
        `SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = ANY($1) ORDER BY table_name, ordinal_position`,
        [nama],
      );
      if (!rows.length) return "Tabel tidak ditemukan.";
      const per = {};
      for (const r of rows) (per[r.table_name] ??= []).push(`  ${r.column_name} ${r.data_type}${r.is_nullable === "NO" ? " NOT NULL" : ""}${r.column_default ? ` DEFAULT ${r.column_default}` : ""}`);
      return Object.entries(per).map(([t, k]) => `${t}\n${k.join("\n")}`).join("\n\n");
    },
  },
  {
    nama: "baca_katalog",
    deskripsi: "Ringkasan katalog modul OpenSIMRS (segmen, modul, fitur, rute) dari database/data/katalog-modul.json.",
    skema: { type: "object", properties: {} },
    mode: "baca",
    jalankan: async (_, { base }) => {
      const k = JSON.parse(fs.readFileSync(path.join(base, "database/data/katalog-modul.json"), "utf8"));
      const modul = (k.modul ?? []).map((m) => `- ${m.kode} (${m.nama}) ${m.tersedia === false ? "[segera]" : ""} rute: ${(m.rute ?? []).join(", ")}`);
      const fitur = (k.fitur ?? []).map((f) => `- ${f.kode} → modul ${f.modul}: ${f.nama}`);
      return potong(`Segmen: ${(k.segmen ?? []).map((s) => s.kode).join(", ")}\n\nModul:\n${modul.join("\n")}\n\nFitur:\n${fitur.join("\n")}`);
    },
  },
  {
    nama: "tulis_berkas",
    deskripsi: "Menulis (membuat/menimpa) berkas teks di repo. Zona terlarang ditolak.",
    skema: { type: "object", properties: { path: { type: "string" }, isi: { type: "string" } }, required: ["path", "isi"] },
    mode: "tulis",
    jalankan: async ({ path: p, isi }, { base }) => {
      const rel = dalamBase(base, p);
      const zona = ZONA_MERAH.find((z) => z.pola.test(rel));
      if (zona) throw new Error(`Ditolak: ${rel} termasuk zona merah (${zona.alasan})`);
      fs.mkdirSync(path.dirname(path.join(base, rel)), { recursive: true });
      fs.writeFileSync(path.join(base, rel), String(isi), "utf8");
      return `Tersimpan: ${rel} (${String(isi).split("\n").length} baris)`;
    },
  },
  {
    nama: "ganti_teks",
    deskripsi: "Mengganti satu potongan teks yang persis dan unik di berkas (untuk suntingan kecil).",
    skema: { type: "object", properties: { path: { type: "string" }, lama: { type: "string" }, baru: { type: "string" } }, required: ["path", "lama", "baru"] },
    mode: "tulis",
    jalankan: async ({ path: p, lama, baru }, { base }) => {
      const rel = dalamBase(base, p);
      const zona = ZONA_MERAH.find((z) => z.pola.test(rel));
      if (zona) throw new Error(`Ditolak: ${rel} termasuk zona merah (${zona.alasan})`);
      const lengkap = path.join(base, rel);
      const isi = fs.readFileSync(lengkap, "utf8");
      const jumlah = isi.split(String(lama)).length - 1;
      if (jumlah !== 1) throw new Error(jumlah ? `Teks lama muncul ${jumlah} kali; perjelas agar unik` : "Teks lama tidak ditemukan");
      fs.writeFileSync(lengkap, isi.replace(String(lama), () => String(baru)), "utf8");
      return `Diubah: ${rel}`;
    },
  },
  {
    nama: "jalankan_perintah",
    deskripsi: `Menjalankan perintah verifikasi dari daftar putih: node --check <berkas>, node --test, npm test, npm --prefix <layanan> test, npm --prefix frontend-service run build-only, npm run docs:katalog, node scripts/dokumen-katalog.mjs [--cek], git status|diff|log.`,
    skema: { type: "object", properties: { perintah: { type: "string" } }, required: ["perintah"] },
    mode: "tulis",
    jalankan: async ({ perintah }, { base, signal }) => {
      if (!perintahDiizinkan(perintah)) throw new Error(`Perintah tidak diizinkan: ${perintah}`);
      return potong(await jalankanPerintah(String(perintah).trim(), base, signal));
    },
  },
];

export const alatUntukMode = (mode) => ALAT.filter((a) => a.mode === "baca" || mode === "coding");
export const ringkasArgumen = (nama, args = {}) => `${nama} ${args.path ?? args.glob ?? args.pola ?? args.perintah ?? args.tabel ?? ""}`.trim();
