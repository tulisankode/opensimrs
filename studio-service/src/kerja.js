// Direktori kerja item: working tree repo (mode "workspace") atau git worktree terpisah per item (mode "worktree").
import fs from "fs";
import os from "os";
import path from "path";
import config from "./config.js";
import { Galat } from "./respons.js";
import { ubah } from "./db.js";
import { bacaSemua } from "./pengaturan.js";
import { branchSekarang, git, namaBranch } from "./git.js";

export const direktoriKerja = (item) => item?.worktree || config.repoDir;

// Folder worktree: path pendek (batas panjang path Windows) — bawaan <drive temp>/simrs-studio.
// Folder di dalam repo ditolak (salinan kerja akan muncul sebagai berkas baru di repo utama & bisa ikut ter-commit).
export const diDalamRepo = (folder) => {
  const rel = path.relative(path.resolve(config.repoDir), path.resolve(folder));
  return !rel.startsWith("..") && !path.isAbsolute(rel);
};
const akarWorktree = (nilai) =>
  nilai.direktori_worktree && path.isAbsolute(nilai.direktori_worktree) && !diDalamRepo(nilai.direktori_worktree)
    ? nilai.direktori_worktree
    : path.join(path.parse(os.tmpdir()).root, "simrs-studio");

// node_modules tidak ikut worktree; tautkan (junction) dari repo utama agar uji & build berjalan.
// Daftar jalur yang sama dipakai saat menautkan & melepas, agar penghapusan worktree tidak pernah menelusuri isi tautan.
export const jalurTautan = (sumberRepo, tujuan) => {
  const hasil = [];
  const dirs = ["", ...fs.readdirSync(sumberRepo).filter((d) => /-service$/.test(d))];
  if (fs.existsSync(path.join(sumberRepo, "packages"))) for (const p of fs.readdirSync(path.join(sumberRepo, "packages"))) dirs.push(path.join("packages", p));
  for (const rel of dirs) hasil.push({ sumber: path.join(sumberRepo, rel, "node_modules"), target: path.join(tujuan, rel, "node_modules"), induk: path.join(tujuan, rel) });
  return hasil;
};

export const tautkanNodeModules = (tujuan, sumberRepo = config.repoDir) => {
  for (const { sumber, target, induk } of jalurTautan(sumberRepo, tujuan)) {
    if (!fs.existsSync(sumber) || !fs.existsSync(induk)) continue;
    try {
      if (fs.lstatSync(target, { throwIfNoEntry: false })) continue;
      fs.symlinkSync(sumber, target, "junction");
    } catch {
      /* lewati bila tidak bisa ditautkan */
    }
  }
};

// Lepas tautan (hanya bila memang tautan) — isi node_modules repo utama tidak tersentuh.
export const lepasNodeModules = (tujuan, sumberRepo = config.repoDir) => {
  for (const { target } of jalurTautan(sumberRepo, tujuan)) {
    try {
      const st = fs.lstatSync(target, { throwIfNoEntry: false });
      if (st?.isSymbolicLink()) fs.unlinkSync(target);
    } catch {
      /* abaikan */
    }
  }
};

const fetchDasar = async (dasar) => {
  if (dasar.startsWith("origin/")) await git(["fetch", "origin", dasar.slice(7)], { izinkanGagal: true });
};

export const modeLokal = (nilai) => ["lokal", "keduanya"].includes(nilai.mode_rilis ?? "lokal");

// Branch lokal yang dipakai aplikasi RS: pengaturan, atau branch aktif di repo (bila bukan branch item STD-…).
export const branchLokal = async (nilai, item = null) => {
  if (nilai.branch_lokal) return nilai.branch_lokal;
  const aktif = await branchSekarang().catch(() => null);
  if (aktif && aktif !== "HEAD" && !/\/STD-\d+/.test(aktif)) return aktif;
  return item?.branch_asal || "main";
};

// Titik awal branch item: branch lokal (mode lokal/keduanya, agar kustomisasi menumpuk) atau branch dasar (mode PR).
export const branchDasar = async (nilai, item = null) => (modeLokal(nilai) ? branchLokal(nilai, item) : nilai.branch_dasar || "origin/main");

// Siapkan branch kerja & direktori kerja item. Mengembalikan item terbaru.
export const siapkanKerja = async (item) => {
  const { nilai } = await bacaSemua();
  const dasar = await branchDasar(nilai, item);
  const nama = item.branch || namaBranch(item);

  if (nilai.mode_kerja === "worktree" || item.worktree) {
    if (item.worktree && fs.existsSync(item.worktree)) return item;
    const lokasi = path.join(akarWorktree(nilai), `STD-${String(item.nomor).padStart(4, "0")}`);
    fs.mkdirSync(path.dirname(lokasi), { recursive: true });
    await fetchDasar(dasar);
    const ada = (await git(["rev-parse", "--verify", "--quiet", `refs/heads/${nama}`], { izinkanGagal: true })).ok;
    try {
      if (ada) await git(["worktree", "add", lokasi, nama]);
      else await git(["worktree", "add", "--no-track", "-b", nama, lokasi, dasar]);
    } catch (e) {
      throw new Galat(409, `Gagal membuat worktree ${lokasi}: ${e.message}`);
    }
    tautkanNodeModules(lokasi);
    return ubah("studio_item", item.uuid, { branch: nama, branch_asal: null, worktree: lokasi });
  }

  // Mode workspace: berpindah branch di working tree repo (perubahan lain yang belum di-commit ikut terbawa).
  const sekarangBranch = await branchSekarang();
  if (item.branch) {
    if (sekarangBranch !== item.branch) {
      try {
        await git(["switch", item.branch]);
      } catch (e) {
        throw new Galat(409, `Gagal berpindah ke branch ${item.branch}: ${e.message}`);
      }
    }
    return item;
  }
  await fetchDasar(dasar);
  const ada = (await git(["rev-parse", "--verify", "--quiet", `refs/heads/${nama}`], { izinkanGagal: true })).ok;
  try {
    if (ada) await git(["switch", nama]);
    else await git(["switch", "--no-track", "-c", nama, dasar]);
  } catch (e) {
    throw new Galat(409, `Gagal berpindah ke branch ${nama}: ${e.message}. Simpan (commit/stash) perubahan yang bentrok di VS Code lalu coba lagi.`);
  }
  return ubah("studio_item", item.uuid, { branch: nama, branch_asal: sekarangBranch });
};

// Working tree sudah di branch item? (worktree selalu ya)
export const pastikanDiBranch = async (item) => {
  if (!item.branch || item.worktree) return;
  if ((await branchSekarang()) !== item.branch) throw new Galat(409, `Working tree tidak berada di branch item (${item.branch}). Pindah dulu lewat tombol "Buka branch item".`);
};

export const hapusWorktree = async (item) => {
  if (!item.worktree) return;
  lepasNodeModules(item.worktree);
  // Masih ada tautan yang gagal dilepas → jangan hapus paksa (bisa ikut menghapus isi node_modules repo utama).
  if (jalurTautan(config.repoDir, item.worktree).some(({ target }) => fs.lstatSync(target, { throwIfNoEntry: false })?.isSymbolicLink())) {
    throw new Galat(500, `Tautan node_modules di ${item.worktree} tidak bisa dilepas; hapus manual tautannya lalu coba lagi`);
  }
  await git(["worktree", "remove", "--force", item.worktree], { izinkanGagal: true });
  await ubah("studio_item", item.uuid, { worktree: null });
};
