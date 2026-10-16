import { execFile } from "child_process";
import config from "./config.js";

// Perintah git di repo yang dikembangkan. safe.directory=* agar jalan di Windows tanpa mengubah konfigurasi global.
export const git = (args, { cwd = config.repoDir, izinkanGagal = false } = {}) =>
  new Promise((resolve, reject) => {
    execFile("git", ["-c", "safe.directory=*", "-c", "core.quotepath=off", "-c", "core.longpaths=true", ...args], { cwd, maxBuffer: 50 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      if (err && !izinkanGagal) return reject(new Error((stderr || err.message).trim()));
      resolve({ ok: !err, keluaran: stdout.replace(/\s+$/, ""), galat: stderr.trim() });
    });
  });

export const branchSekarang = async (cwd = config.repoDir) => (await git(["rev-parse", "--abbrev-ref", "HEAD"], { cwd })).keluaran;

// Berkas kotor (status porcelain) → { path: kodeStatus }.
export const statusBerkas = async (cwd = config.repoDir) => {
  const { keluaran } = await git(["status", "--porcelain", "--untracked-files=all"], { cwd });
  const hasil = {};
  for (const baris of keluaran.split("\n").filter(Boolean)) {
    const kode = baris.slice(0, 2);
    let p = baris.slice(3);
    if (p.includes(" -> ")) p = p.split(" -> ")[1];
    hasil[p.replace(/^"|"$/g, "")] = kode.trim();
  }
  return hasil;
};

// Sidik isi berkas kotor (hash-object) untuk membedakan perubahan agen dari perubahan lain yang sudah ada.
// Dipecah per 100 berkas agar baris perintah tidak melampaui batas panjang di Windows.
export const sidikBerkas = async (daftar, cwd = config.repoDir) => {
  const hasil = {};
  for (let i = 0; i < daftar.length; i += 100) {
    const potong = daftar.slice(i, i + 100);
    const { ok, keluaran } = await git(["hash-object", "--no-filters", "--", ...potong], { cwd, izinkanGagal: true });
    if (ok) {
      const hash = keluaran.split("\n");
      potong.forEach((p, j) => (hasil[p] = hash[j] ?? null));
      continue;
    }
    // Ada berkas yang tidak bisa dibaca (mis. folder): sidik satu per satu; gagal = penanda waktu agar tetap terdeteksi berubah.
    for (const p of potong) {
      const r = await git(["hash-object", "--no-filters", "--", p], { cwd, izinkanGagal: true });
      hasil[p] = r.ok ? r.keluaran : `tidak-terbaca-${Date.now()}`;
    }
  }
  return hasil;
};

export const potretKerja = async (cwd = config.repoDir) => {
  const status = await statusBerkas(cwd);
  const ada = Object.keys(status).filter((p) => status[p] !== "D");
  return { status, sidik: await sidikBerkas(ada, cwd) };
};

// Berkas yang berubah sejak potret sebelum agen bekerja.
export const berkasBerubah = (sebelum, sesudah) => {
  const hasil = [];
  for (const [p, kode] of Object.entries(sesudah.status)) {
    if (!(p in sebelum.status)) hasil.push({ path: p, status: kode });
    else if (sebelum.sidik[p] !== sesudah.sidik[p] || sebelum.status[p] !== kode) hasil.push({ path: p, status: kode });
  }
  return hasil;
};

// Patch satu berkas terhadap HEAD (berkas baru: seluruh isi sebagai tambahan).
export const patchBerkas = async (p, status, cwd = config.repoDir) => {
  if (status === "??" || status === "A") {
    const { keluaran } = await git(["diff", "--no-index", "--", "/dev/null", p], { cwd, izinkanGagal: true });
    return keluaran;
  }
  return (await git(["diff", "HEAD", "--", p], { cwd, izinkanGagal: true })).keluaran;
};

export const urlRemote = async (cwd = config.repoDir) => (await git(["remote", "get-url", "origin"], { cwd, izinkanGagal: true })).keluaran;

export const urlRepo = async (cwd = config.repoDir) => {
  const m = (await urlRemote(cwd)).match(/github\.com[:/](.+?)(\.git)?$/);
  return m ? `https://github.com/${m[1]}` : null;
};

// "owner/nama" dari URL remote (GitHub/Gitea, https atau ssh).
export const slugRepo = async (cwd = config.repoDir) => {
  const m = (await urlRemote(cwd)).match(/[:/]([^/:]+\/[^/]+?)(\.git)?$/);
  return m ? m[1] : null;
};

// Nama branch kerja: <jenis>/STD-<nomor>-<ringkasan>
export const namaBranch = (item) => {
  const jenis = { perbaikan: "fix", laporan: "feat", modul: "feat", fitur: "feat" }[item.jenis] ?? "feat";
  const ringkas = item.judul
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .split("-")
    .slice(0, 6)
    .join("-");
  return `${jenis}/STD-${String(item.nomor).padStart(4, "0")}-${ringkas || "perubahan"}`;
};
