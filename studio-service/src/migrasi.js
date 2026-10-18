// Awalan & urutan migrasi item SIMRS Studio. Aturan repo: migrasi bernama YYYYMMDDHHMMSS-*.cjs (UTC) dan harus
// berurutan paling akhir saat digabung. Item yang dikerjakan paralel dulu memilih stempel sendiri-sendiri, sehingga
// sering bentrok (awalan sama) atau tertinggal (item lain diterapkan lebih dulu). Studio kini memesan satu blok jam
// UTC (YYYYMMDDHH) per item saat coding dimulai, dan mengganti nama migrasi item yang tertinggal saat Terapkan.
import fs from "fs";
import os from "os";
import path from "path";
import { git } from "./git.js";

export const FOLDER_MIGRASI = "database/migrations";
export const POLA_NAMA_MIGRASI = /^(\d{14})-[a-z0-9_-]+\.cjs$/i;

// Blok jam (YYYYMMDDHH) dari stempel 14 digit atau Date (UTC).
export const jamDari = (nilai) => {
  if (nilai instanceof Date) return nilai.toISOString().replace(/\D/g, "").slice(0, 10);
  return String(nilai ?? "").slice(0, 10);
};

// Blok jam berikutnya (2026101823 → 2026101900).
export const jamBerikut = (jam) => {
  const m = String(jam).match(/^(\d{4})(\d{2})(\d{2})(\d{2})$/);
  if (!m) throw new Error(`Blok jam tidak sah: ${jam}`);
  return jamDari(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]) + 1)));
};

// Awalan unik untuk item: blok jam UTC yang lebih baru dari migrasi terakhir di branch dasar/lokal DAN dari semua
// awalan yang sudah dipesan item lain yang masih aktif; tidak lebih awal dari jam sekarang.
export const hitungAwalan = ({ terakhir = null, dipesan = [], sekarang = new Date() } = {}) => {
  let jam = jamDari(sekarang);
  const batas = [terakhir && jamDari(terakhir), ...dipesan.map(jamDari)].filter((j) => /^\d{10}$/.test(j ?? ""));
  for (const b of batas) if (b >= jam) jam = jamBerikut(b);
  return jam;
};

// Awalan item masih layak dipakai: lebih baru dari migrasi terakhir dan tidak dipakai item aktif lain.
export const awalanLayak = (awalan, { terakhir = null, dipesan = [] } = {}) =>
  /^\d{10}$/.test(awalan ?? "") && (!terakhir || awalan > jamDari(terakhir)) && !dipesan.includes(awalan);

// Rencana penggantian nama migrasi item yang tidak lagi paling akhir terhadap target.
// milikItem/diTarget: nama berkas (basename). Mengembalikan [{ lama, baru }] (kosong bila sudah urut).
// Urutan relatif dipertahankan; menit-detik asal dipakai bila semua migrasi item berada dalam satu blok jam dan unik,
// selain itu diberi nomor 0000, 0100, 0200, …
export const rencanaUrutMigrasi = ({ milikItem = [], diTarget = [], awalanBaru }) => {
  const item = [...new Set(milikItem)].filter((n) => POLA_NAMA_MIGRASI.test(n)).sort();
  if (!item.length) return [];
  const lain = diTarget.filter((n) => !item.includes(n) && POLA_NAMA_MIGRASI.test(n)).sort();
  const terakhir = lain.at(-1);
  const stempelLain = new Set(lain.map((n) => n.slice(0, 14)));
  const stempelItem = item.map((n) => n.slice(0, 14));
  const urut = (!terakhir || item[0] > terakhir) && !stempelItem.some((s) => stempelLain.has(s)) && new Set(stempelItem).size === item.length;
  if (urut) return [];
  if (!/^\d{10}$/.test(awalanBaru ?? "")) throw new Error("Awalan baru migrasi tidak sah");
  if (terakhir && `${awalanBaru}9999` <= terakhir.slice(0, 14)) throw new Error(`Awalan baru ${awalanBaru} tidak lebih baru dari ${terakhir}`);
  const satuBlok = new Set(stempelItem.map((s) => s.slice(0, 10))).size === 1 && new Set(stempelItem).size === item.length;
  if (item.length > 60 && !satuBlok) throw new Error("Terlalu banyak migrasi item untuk diurutkan otomatis");
  return item.map((lama, i) => {
    const mmss = satuBlok ? lama.slice(10, 14) : `${String(i).padStart(2, "0")}00`;
    return { lama, baru: `${awalanBaru}${mmss}${lama.slice(14)}` };
  });
};

// Ganti rujukan nama lama (tanpa .cjs, sehingga "x.cjs" maupun "x" ikut berubah) di teks.
export const gantiRujukan = (teks, peta) => {
  let hasil = teks;
  for (const { lama, baru } of [...peta].sort((a, b) => b.lama.length - a.lama.length)) {
    hasil = hasil.split(lama.replace(/\.cjs$/, "")).join(baru.replace(/\.cjs$/, ""));
  }
  return hasil;
};

// Terapkan rencana di working tree branch item: git mv, perbarui rujukan di berkas teks yang dilacak, lalu commit.
// Mengembalikan { sha, berkas } (berkas = semua path yang berubah).
export const terapkanUrutMigrasi = async (cwd, peta, pesanCommit) => {
  if (!peta.length) return null;
  for (const { lama, baru } of peta) await git(["mv", `${FOLDER_MIGRASI}/${lama}`, `${FOLDER_MIGRASI}/${baru}`], { cwd });
  const args = ["grep", "-l", "-I", "-F"];
  for (const { lama } of peta) args.push("-e", lama.replace(/\.cjs$/, ""));
  const { keluaran } = await git(args, { cwd, izinkanGagal: true });
  const rujukan = keluaran.split("\n").filter(Boolean);
  for (const rel of rujukan) {
    const lokasi = path.join(cwd, rel);
    const asli = fs.readFileSync(lokasi, "utf8");
    const baru = gantiRujukan(asli, peta);
    if (baru !== asli) fs.writeFileSync(lokasi, baru);
  }
  if (rujukan.length) await git(["add", "--", ...rujukan], { cwd });
  const berkasPesan = path.join(os.tmpdir(), `simrs-studio-urut-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  fs.writeFileSync(berkasPesan, pesanCommit, "utf8");
  try {
    await git(["commit", "-F", berkasPesan], { cwd });
  } finally {
    fs.rmSync(berkasPesan, { force: true });
  }
  const sha = (await git(["rev-parse", "HEAD"], { cwd })).keluaran;
  return { sha, berkas: [...new Set([...peta.flatMap((p) => [`${FOLDER_MIGRASI}/${p.lama}`, `${FOLDER_MIGRASI}/${p.baru}`]), ...rujukan])] };
};
