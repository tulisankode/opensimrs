// Kirim branch lokal ke server RS tanpa GitHub (rancangan §16.3, mode rilis lokal):
// 1. git push lewat SSH ke repo penampung (bare) di server;
// 2. di server: ambil branch itu ke folder repo aplikasi (fast-forward saja) lalu jalankan perintah deploy;
// 3. alternatif tanpa jaringan: berkas git bundle untuk dibawa lewat USB.
// Autentikasi: kunci SSH khusus Studio (privat terenkripsi di DB, ditulis sementara saat dipakai). Sidik jari host dicatat
// saat koneksi pertama; bila berubah, koneksi ditolak.
import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import config from "./config.js";
import { audit, query, satu, sekarang, sisipkan, ubah } from "./db.js";
import { Galat, permintaanSalah, tidakDitemukan } from "./respons.js";
import { bacaSemua } from "./pengaturan.js";
import { dekripsi, enkripsi } from "./rahasia.js";
import { git } from "./git.js";
import { branchLokal } from "./kerja.js";
import { daftarkanPembatal, lepaskanPembatal } from "./agen/claude.js";

const FOLDER_SSH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "ssh");
const GIT_WIN = "C:/Program Files/Git/usr/bin";
// Di Windows pakai OpenSSH bawaan Git for Windows (tidak menolak berkas kunci karena ACL folder).
const bin = (nama) => process.env[`STUDIO_${nama.replace("-", "_").toUpperCase()}_BIN`] || (process.platform === "win32" && fs.existsSync(`${GIT_WIN}/${nama}.exe`) ? `${GIT_WIN}/${nama}.exe` : nama);
const jalurPosix = (p) => p.replace(/\\/g, "/");

// ---------- Validasi ----------
const POLA_PATH = /^[~\w./-]+$/;
export const validasiServer = (b) => {
  if (!String(b.nama ?? "").trim()) throw permintaanSalah("Nama server wajib diisi");
  if (!/^[\w.-]+$/.test(String(b.host ?? ""))) throw permintaanSalah("Host harus IP atau nama host (tanpa spasi)");
  if (!/^[a-z_][\w.-]*$/i.test(String(b.pengguna ?? ""))) throw permintaanSalah("Pengguna SSH tidak valid");
  const port = Number(b.port ?? 22);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw permintaanSalah("Port SSH tidak valid");
  for (const k of ["repo_dir", "repo_bare"]) if (b[k] && !POLA_PATH.test(b[k])) throw permintaanSalah(`${k} hanya boleh huruf, angka, ~ . / - _`);
  if (b.branch && !/^[\w./-]+$/.test(b.branch)) throw permintaanSalah("Nama branch tidak valid");
  if (b.perintah_deploy && /[\r\n]/.test(b.perintah_deploy)) throw permintaanSalah("Perintah deploy harus satu baris");
  if (b.jenis && !["produksi", "staging"].includes(b.jenis)) throw permintaanSalah("Jenis server harus produksi atau staging");
};

export const ambilServer = async (uuid) => {
  const s = await satu(`SELECT * FROM studio_server WHERE uuid = $1 AND deleted_at IS NULL`, [uuid]);
  if (!s) throw tidakDitemukan("Server");
  return s;
};

export const tampilServer = (s) => ({ ...s, kunci_privat: s.kunci_privat ? "••••••••" : null });

// ---------- Proses ----------
const jalankan = (perintah, args, { env, onBaris, timeoutMs = 15 * 60 * 1000, tugasUuid } = {}) =>
  new Promise((resolve) => {
    const anak = spawn(perintah, args, { env: { ...process.env, ...env }, windowsHide: true });
    if (tugasUuid) daftarkanPembatal(tugasUuid, { abort: () => anak.kill() });
    let keluaran = "";
    let sisa = "";
    const terima = (d) => {
      const teks = d.toString("utf8");
      keluaran = (keluaran + teks).slice(-20000);
      if (!onBaris) return;
      sisa += teks;
      const baris = sisa.split(/\r?\n/);
      sisa = baris.pop();
      for (const b of baris) if (b.trim()) onBaris(b);
    };
    anak.stdout.on("data", terima);
    anak.stderr.on("data", terima);
    const batas = setTimeout(() => anak.kill(), timeoutMs);
    anak.on("error", (e) => resolve({ ok: false, kode: -1, keluaran: e.message }));
    anak.on("close", (kode) => {
      clearTimeout(batas);
      if (sisa.trim() && onBaris) onBaris(sisa);
      if (tugasUuid) lepaskanPembatal(tugasUuid);
      resolve({ ok: kode === 0, kode, keluaran });
    });
  });

// Kunci & known_hosts ditulis sementara per pemakaian; known_hosts baru disimpan ke DB (pin sidik jari host).
const denganKunci = async (server, fn) => {
  if (!server.kunci_privat) throw permintaanSalah("Server belum punya kunci SSH — klik Buat kunci");
  fs.mkdirSync(FOLDER_SSH, { recursive: true });
  const kunci = path.join(FOLDER_SSH, `${server.uuid}-${Date.now()}.key`);
  const kenal = path.join(FOLDER_SSH, `${server.uuid}.known_hosts`);
  fs.writeFileSync(kunci, `${dekripsi(server.kunci_privat).trim()}\n`, { mode: 0o600 });
  fs.writeFileSync(kenal, server.sidik_host ?? "", { mode: 0o600 });
  try {
    const argSsh = ["-i", jalurPosix(kunci), "-p", String(server.port || 22), "-o", "IdentitiesOnly=yes", "-o", "BatchMode=yes",
      "-o", `UserKnownHostsFile=${jalurPosix(kenal)}`, "-o", "StrictHostKeyChecking=accept-new", "-o", "ConnectTimeout=15", "-o", "ServerAliveInterval=30"];
    return await fn(argSsh);
  } finally {
    const baru = fs.existsSync(kenal) ? fs.readFileSync(kenal, "utf8") : "";
    if (baru.trim() && baru !== (server.sidik_host ?? "")) await ubah("studio_server", server.uuid, { sidik_host: baru });
    fs.rmSync(kunci, { force: true });
    fs.rmSync(kenal, { force: true });
  }
};

const kutip = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

// Jalankan skrip shell di server (bash login agar PATH docker/podman/node sama dengan sesi SSH biasa).
export const ssh = (server, skrip, opsi = {}) =>
  denganKunci(server, (argSsh) => jalankan(bin("ssh"), [...argSsh, `${server.pengguna}@${server.host}`, `bash -lc ${kutip(skrip)}`], opsi));

const pesanGagalSsh = (r) =>
  /Host key verification failed|REMOTE HOST IDENTIFICATION HAS CHANGED/i.test(r.keluaran)
    ? "Sidik jari server berubah — bisa jadi server tertukar atau dipasang ulang. Bila memang dipasang ulang, klik Lupakan sidik jari lalu coba lagi."
    : /Permission denied/i.test(r.keluaran)
      ? "Akses SSH ditolak — pastikan kunci publik Studio sudah ditempel di ~/.ssh/authorized_keys pengguna itu di server."
      : /timed out|Could not resolve|No route|Connection refused/i.test(r.keluaran)
        ? "Server tidak terjangkau — periksa IP/port dan jaringan (VPN/LAN)."
        : r.keluaran.trim().split("\n").slice(-3).join(" ");

// ---------- Kunci ----------
export const buatKunci = async (server, oleh) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "simrs-studio-kunci-"));
  const berkas = path.join(dir, "id_ed25519");
  try {
    const r = await jalankan(bin("ssh-keygen"), ["-q", "-t", "ed25519", "-N", "", "-C", `simrs-studio@${server.nama.replace(/\s+/g, "-")}`, "-f", jalurPosix(berkas)]);
    if (!r.ok) throw new Galat(500, `ssh-keygen gagal: ${r.keluaran}`);
    const publik = fs.readFileSync(`${berkas}.pub`, "utf8").trim();
    await ubah("studio_server", server.uuid, { kunci_privat: enkripsi(fs.readFileSync(berkas, "utf8")), kunci_publik: publik });
    await audit(oleh, `Membuat kunci SSH untuk server ${server.nama}`);
    return publik;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

// ---------- Uji & siapkan ----------
export const ujiKoneksi = async (server) => {
  const r = await ssh(server, `echo SIMRS_OK; uname -sr; git --version; command -v docker || command -v podman || echo "(docker/podman tidak ditemukan)"; [ -d ${server.repo_dir}/.git ] && echo "REPO $(git -C ${server.repo_dir} branch --show-current)" || echo "REPO_BELUM_ADA"`, { timeoutMs: 60000 });
  if (!r.ok || !r.keluaran.includes("SIMRS_OK")) throw new Galat(502, pesanGagalSsh(r));
  const baris = r.keluaran.split("\n").map((b) => b.trim()).filter(Boolean);
  const repo = baris.find((b) => b.startsWith("REPO"));
  return {
    sistem: baris[baris.indexOf("SIMRS_OK") + 1] ?? "",
    git: baris.find((b) => b.startsWith("git version")) ?? "(git tidak ditemukan)",
    kontainer: baris.find((b) => /docker|podman/.test(b)) ?? "",
    repo: repo === "REPO_BELUM_ADA" ? null : repo?.slice(5) || "(tanpa branch)",
  };
};

export const siapkanServer = async (server, oleh) => {
  const r = await ssh(server, `set -e; if [ -d ${server.repo_bare} ]; then echo "Repo penampung sudah ada: ${server.repo_bare}"; else git init -q --bare ${server.repo_bare} && echo "Repo penampung dibuat: ${server.repo_bare}"; fi`, { timeoutMs: 60000 });
  if (!r.ok) throw new Galat(502, pesanGagalSsh(r));
  await audit(oleh, `Menyiapkan repo penampung di server ${server.nama}`);
  return r.keluaran.trim();
};

// ---------- Deploy ----------

// Skrip di server: ambil branch dari repo penampung ke folder aplikasi (fast-forward saja; berhenti dengan kode 3 bila
// folder aplikasi punya perubahan lokal) lalu jalankan perintah deploy di folder itu.
export const skripServer = (server, branch, jalankanDeploy = true) =>
  [
    "set -e",
    `BARE=${server.repo_bare}; REPO=${server.repo_dir}; BR=${kutip(branch)}`,
    `if [ ! -d "$REPO/.git" ]; then git clone -q -b "$BR" "$BARE" "$REPO"; echo "Repo aplikasi dibuat di $REPO"; fi`,
    `cd "$REPO"`,
    `if [ -n "$(git status --porcelain --untracked-files=no)" ]; then echo "Folder aplikasi di server punya perubahan yang belum di-commit — dihentikan agar tidak tertimpa:"; git status --short --untracked-files=no; exit 3; fi`,
    `git fetch -q "$BARE" "$BR"`,
    `if git show-ref --verify --quiet "refs/heads/$BR"; then git checkout -q "$BR"; else git checkout -q -b "$BR" FETCH_HEAD; fi`,
    `git merge --ff-only -q FETCH_HEAD`,
    `echo "SHA_SERVER=$(git rev-parse HEAD)"`,
    ...(jalankanDeploy ? [`echo "3/3 Menjalankan: ${server.perintah_deploy.replace(/"/g, '\\"')}"`, server.perintah_deploy] : []),
  ].join("\n");
const urlRemote = (s) => `ssh://${s.pengguna}@${s.host}:${s.port || 22}${s.repo_bare.startsWith("~") ? "/" : ""}${s.repo_bare}`;

export const deploy = async (server, { jalankanDeploy = true }, oleh) => {
  if (!server.aktif) throw permintaanSalah("Server nonaktif");
  const lain = await satu(`SELECT uuid FROM studio_tugas WHERE jenis = 'deploy' AND status IN ('antri', 'jalan') AND instruksi LIKE $1`, [`%${server.uuid}%`]);
  if (lain) throw new Galat(409, "Masih ada pengiriman ke server ini yang berjalan");
  const { nilai } = await bacaSemua();
  const branch = server.branch || (await branchLokal(nilai));
  if (/\/STD-\d+/.test(branch)) throw permintaanSalah(`Branch ${branch} adalah branch item — atur Branch lokal di Pengaturan & Agen`);
  const sha = (await git(["rev-parse", "--verify", `refs/heads/${branch}`], { izinkanGagal: true })).keluaran;
  if (!sha) throw permintaanSalah(`Branch ${branch} tidak ditemukan di repo Studio`);

  const tugas = await sisipkan("studio_tugas", {
    tahap: "deploy", jenis: "deploy", status: "antri", dibuat_oleh: oleh, updated_at: sekarang(),
    instruksi: JSON.stringify({ server: server.uuid, nama: server.nama, host: server.host, branch, sha, jalankanDeploy }),
  });
  await audit(oleh, `Mengirim ${branch} (${sha.slice(0, 7)}) ke server ${server.nama} (${server.jenis})${jalankanDeploy ? " + deploy" : ""}`);

  (async () => {
    const log = (jenis, teks) => query(`INSERT INTO studio_tugas_log (tugas_uuid, jenis, teks, waktu) VALUES ($1, $2, $3, $4)`, [tugas.uuid, jenis, String(teks).slice(0, 4000), sekarang()]).catch(() => {});
    const batal = async () => (await satu(`SELECT status FROM studio_tugas WHERE uuid = $1`, [tugas.uuid]))?.status === "dibatalkan";
    try {
      await ubah("studio_tugas", tugas.uuid, { status: "jalan", mulai: sekarang() });
      await log("info", `1/3 Mengirim branch ${branch} (${sha.slice(0, 7)}) ke ${server.pengguna}@${server.host}:${server.repo_bare}`);
      const push = await denganKunci(server, (argSsh) =>
        jalankan("git", ["-c", "safe.directory=*", "-C", config.repoDir, "push", urlRemote(server), `${branch}:refs/heads/${branch}`], {
          env: { GIT_SSH_COMMAND: [`"${bin("ssh")}"`, ...argSsh.map((a) => (/\s/.test(a) ? `"${a}"` : a))].join(" ") },
          onBaris: (b) => log("teks", b),
          timeoutMs: 10 * 60 * 1000,
          tugasUuid: tugas.uuid,
        }),
      );
      if (await batal()) return;
      if (!push.ok) throw new Error(/rejected|non-fast-forward/i.test(push.keluaran) ? `Push ditolak: branch ${branch} di server sudah berbeda (ada commit yang tidak ada di Studio). Samakan dulu secara manual.` : pesanGagalSsh(push));
      await log("hasil", "✔ Branch terkirim ke repo penampung server");

      await log("info", `2/3 Memperbarui folder aplikasi ${server.repo_dir} (fast-forward)`);
      const skrip = skripServer(server, branch, jalankanDeploy);
      const hasil = await ssh(server, skrip, { onBaris: (b) => log(/error|gagal|failed/i.test(b) ? "galat" : "teks", b), timeoutMs: 60 * 60 * 1000, tugasUuid: tugas.uuid });
      if (await batal()) return;
      if (!hasil.ok) throw new Error(hasil.kode === 3 ? "Folder aplikasi di server punya perubahan lokal — rapikan di server dulu" : `Langkah di server gagal (kode ${hasil.kode}). ${pesanGagalSsh(hasil)}`);
      const shaServer = hasil.keluaran.match(/SHA_SERVER=(\w+)/)?.[1] ?? sha;
      await ubah("studio_server", server.uuid, { terakhir_deploy: sekarang(), sha_terakhir: shaServer });
      await log("hasil", jalankanDeploy ? `✔ Deploy selesai — server ${server.nama} memakai ${shaServer.slice(0, 7)}` : `✔ Kode di server diperbarui ke ${shaServer.slice(0, 7)} (deploy belum dijalankan)`);
      await ubah("studio_tugas", tugas.uuid, { status: "selesai", selesai: sekarang(), hasil: JSON.stringify({ sha: shaServer }) });
      await audit(oleh, `Deploy ke ${server.nama} selesai (${shaServer.slice(0, 7)})`);
    } catch (e) {
      await log("galat", e.message);
      if (!(await batal())) await ubah("studio_tugas", tugas.uuid, { status: "gagal", pesan_galat: e.message, selesai: sekarang() });
      await audit(oleh, `Deploy ke ${server.nama} gagal`, null, { galat: e.message });
    }
  })();
  return tugas;
};

// ---------- Bundle (tanpa jaringan) ----------
export const buatBundle = async (branchDiminta, oleh) => {
  const { nilai } = await bacaSemua();
  const branch = branchDiminta || (await branchLokal(nilai));
  if (!/^[\w./-]+$/.test(branch)) throw permintaanSalah("Nama branch tidak valid");
  const sha = (await git(["rev-parse", "--verify", `refs/heads/${branch}`], { izinkanGagal: true })).keluaran;
  if (!sha) throw permintaanSalah(`Branch ${branch} tidak ditemukan`);
  const nama = `opensimrs-${branch.replace(/[^\w.-]+/g, "-")}-${sha.slice(0, 7)}.bundle`;
  const berkas = path.join(os.tmpdir(), `simrs-studio-${Date.now()}-${nama}`);
  await git(["bundle", "create", berkas, branch]);
  await audit(oleh, `Mengunduh bundle ${branch} (${sha.slice(0, 7)})`);
  return { berkas, nama, branch, sha };
};
