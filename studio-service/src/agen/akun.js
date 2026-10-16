// Akun Claude Code (langganan) yang dipakai agen Studio: status, login lewat peramban (OAuth claude.ai, bisa masuk
// dengan akun Google), dan keluar. Login ini sama dengan Claude Code di VS Code untuk pengguna OS yang menjalankan
// studio-service.
//
// Alur `claude auth login` tanpa terminal: CLI mencetak URL otorisasi lalu menunggu kode yang ditampilkan halaman
// Claude setelah login ("Paste code here"). Studio membuka URL itu di tab baru dan meneruskan kode dari pengguna.
import { execFile, spawn } from "child_process";
import config from "../config.js";
import { Galat, permintaanSalah } from "../respons.js";

const BATAS_LOGIN_MS = 10 * 60 * 1000;
let sesi = null; // { anak, url, keluaran, mulai, selesai, ok }

const jalankan = (args, timeout = 30000) =>
  new Promise((resolve) =>
    execFile(config.claudeBin, args, { windowsHide: true, timeout }, (err, stdout, stderr) =>
      resolve({ ok: !err, keluaran: `${stdout ?? ""}${stderr ?? ""}`, galat: err }),
    ),
  );

export const statusAkun = async () => {
  const r = await jalankan(["auth", "status", "--json"]);
  if (r.galat?.code === "ENOENT") return { terpasang: false, masuk: false };
  try {
    const j = JSON.parse(r.keluaran.slice(r.keluaran.indexOf("{")));
    return { terpasang: true, masuk: Boolean(j.loggedIn), metode: j.authMethod ?? null, email: j.email ?? null, organisasi: j.orgName ?? null, paket: j.subscriptionType ?? null };
  } catch {
    return { terpasang: true, masuk: false };
  }
};

export const statusLogin = () =>
  sesi ? { berjalan: !sesi.selesai, url: sesi.url, selesai: sesi.selesai, ok: sesi.ok, mulai: sesi.mulai } : { berjalan: false };

export const batalLogin = () => {
  if (sesi && !sesi.selesai) sesi.anak.kill();
  sesi = null;
};

// Mulai login; mengembalikan URL otorisasi untuk dibuka di tab baru.
export const mulaiLogin = async ({ email } = {}) => {
  if (sesi && !sesi.selesai && sesi.url) return statusLogin();
  batalLogin();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw permintaanSalah("Email tidak valid");
  const anak = spawn(config.claudeBin, ["auth", "login", "--claudeai", ...(email ? ["--email", email] : [])], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  const s = { anak, url: null, keluaran: "", mulai: Date.now(), selesai: false, ok: false };
  sesi = s;
  const batas = setTimeout(() => anak.kill(), BATAS_LOGIN_MS);
  return new Promise((resolve, reject) => {
    const tunggu = setTimeout(() => {
      if (!s.url) {
        anak.kill();
        reject(new Error(`URL login tidak muncul dari Claude Code CLI: ${s.keluaran.slice(-300) || "tanpa keluaran"}`));
      }
    }, 30000);
    const baca = (d) => {
      s.keluaran = (s.keluaran + d.toString("utf8")).slice(-4000);
      const url = s.keluaran.match(/https:\/\/\S+\/oauth\/authorize\?\S+/)?.[0];
      if (url && !s.url) {
        s.url = url;
        clearTimeout(tunggu);
        resolve(statusLogin());
      }
    };
    anak.stdout.on("data", baca);
    anak.stderr.on("data", baca);
    anak.on("error", (e) => {
      clearTimeout(tunggu);
      s.selesai = true;
      reject(new Error(e.code === "ENOENT" ? `Claude Code CLI tidak ditemukan (${config.claudeBin})` : e.message));
    });
    anak.on("close", (kode) => {
      clearTimeout(batas);
      clearTimeout(tunggu);
      s.selesai = true;
      s.ok = kode === 0;
      if (!s.url) reject(new Error(`Login berhenti sebelum URL muncul: ${s.keluaran.slice(-300)}`));
    });
  });
};

// Kode dari halaman Claude setelah login (format kode#state).
export const kirimKode = async (kode) => {
  const isi = String(kode ?? "").trim();
  if (!/^[\w#.~-]{10,600}$/.test(isi)) throw permintaanSalah("Kode login tidak valid. Salin seluruh kode dari halaman Claude.");
  if (!sesi || sesi.selesai) throw new Galat(409, "Sesi login sudah berakhir. Klik Hubungkan akun Claude lagi.");
  const s = sesi;
  s.keluaran = "";
  s.anak.stdin.write(`${isi}\n`);
  await new Promise((resolve) => {
    if (s.selesai) return resolve();
    const batas = setTimeout(resolve, 60000);
    s.anak.on("close", () => {
      clearTimeout(batas);
      resolve();
    });
  });
  if (!s.selesai) {
    s.anak.kill();
    throw new Error("Claude Code CLI tidak menyelesaikan login. Coba lagi.");
  }
  if (!s.ok) {
    // Keluaran setelah kode dikirim saja (URL & prompt sebelumnya tidak relevan).
    const alasan = s.keluaran.replace(/Paste code here if prompted >/g, "").split("\n").map((b) => b.trim()).filter(Boolean).slice(-2).join(" ").slice(0, 300);
    throw new Galat(400, `Login gagal: ${alasan || "kode ditolak (kedaluwarsa atau tidak lengkap)"}. Klik Hubungkan akun Claude untuk mencoba lagi.`);
  }
  return statusAkun();
};

export const keluar = async () => {
  batalLogin();
  await jalankan(["auth", "logout"]);
  return statusAkun();
};
