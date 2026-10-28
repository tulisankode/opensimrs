// Adaptor agen: Codex CLI (OpenAI, `codex exec --json`) dengan login langganan ChatGPT atau kunci API OpenAI.
// Login dari aplikasi memakai kode perangkat (`codex login --device-auth`): pengguna membuka auth.openai.com/codex/device,
// masuk (bisa dengan akun Google), memasukkan kode, lalu CLI selesai sendiri.
//
// Codex tidak punya daftar larangan per berkas seperti Claude Code. Pembatasnya:
// - sandbox Codex: read-only untuk tahap dokumen, workspace-write (tanpa jaringan) untuk coding;
// - setelah coding, perubahan pada zona terlarang dikembalikan dan commit buatan agen dibatalkan (jagaZonaTerlarang);
// - pemeriksa kebijakan Studio tetap memeriksa semua perubahan sebelum gerbang persetujuan.
import { execFile, spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import config from "../config.js";
import { query, sekarang, ubah } from "../db.js";
import { Galat } from "../respons.js";
import { git, statusBerkas } from "../git.js";
import { ATURAN_PLATFORM } from "./prompt.js";
import { daftarkanPembatal, lepaskanPembatal } from "./claude.js";
import { ALAT_PETA_KODE, panduanCodebaseMemory } from "./petakode.js";

// Berkas yang tidak boleh diubah agen (padanan --disallowedTools Claude Code).
export const ZONA_TERLARANG = [
  /(^|\/)\.env(\.|$)/,
  /^studio-service\//,
  /^packages\/(authorization|permission)-sdk\//,
  /(^|\/)rahasia\.js$/,
  /^\.github\//,
  /^deploy\//,
  /^CLAUDE(\.local)?\.md$/,
];
export const terlarang = (p) => ZONA_TERLARANG.some((r) => r.test(p.replace(/\\/g, "/")));

const ATURAN_CODEX = `\n\nBatas khusus agen ini (ditegakkan SIMRS Studio; pelanggaran dikembalikan otomatis):
- Jangan mengubah .env*, studio-service/, packages/authorization-sdk/, packages/permission-sdk/, rahasia.js, .github/, deploy/, CLAUDE.md.
- Jangan menjalankan git commit/push/checkout/switch/reset, npm install, atau menghapus berkas di luar perubahan tugas.`;

// Lokasi CLI: STUDIO_CODEX_BIN (.js dijalankan dengan node), atau peluncur paket npm global @openai/codex
// (dijalankan dengan node agar tidak perlu shell di Windows), atau "codex" di PATH.
let lokasi = null;
const temukanCodex = async () => {
  if (lokasi) return lokasi;
  if (config.codexBin) {
    lokasi = config.codexBin.endsWith(".js") ? { bin: process.execPath, awal: [config.codexBin] } : { bin: config.codexBin, awal: [] };
    return lokasi;
  }
  // Studio dijalankan lewat `npm --prefix studio-service run dev`, yang mewariskan npm_config_prefix ke proses anak:
  // tanpa dibuang, `npm root -g` menunjuk ke studio-service/node_modules, bukan folder paket global.
  const envNpm = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^npm_config_prefix$/i.test(k)));
  const akar = await new Promise((resolve) =>
    execFile("npm", ["root", "-g"], { windowsHide: true, timeout: 20000, shell: process.platform === "win32", env: envNpm }, (err, stdout) => resolve(err ? null : stdout.trim())),
  );
  const kandidat = [akar, process.platform === "win32" && process.env.APPDATA ? path.join(process.env.APPDATA, "npm", "node_modules") : null]
    .filter(Boolean)
    .map((a) => path.join(a, "@openai", "codex", "bin", "codex.js"));
  const js = kandidat.find((f) => fs.existsSync(f));
  // Hanya diingat bila paket ditemukan, agar Codex yang baru dipasang terbaca tanpa menjalankan ulang Studio.
  if (js) lokasi = { bin: process.execPath, awal: [js] };
  return lokasi ?? { bin: "codex", awal: [] };
};

const jalankan = async (args, { timeout = 30000, env = {} } = {}) => {
  const { bin, awal } = await temukanCodex();
  return new Promise((resolve) =>
    execFile(bin, [...awal, ...args], { windowsHide: true, timeout, env: { ...process.env, ...env } }, (err, stdout, stderr) =>
      resolve({ ok: !err, keluaran: `${stdout ?? ""}${stderr ?? ""}`.replace(/\x1b\[[0-9;]*m/g, ""), galat: err }),
    ),
  );
};

const PESAN_PASANG = "Codex CLI tidak ditemukan. Pasang dulu: npm i -g @openai/codex (atau isi STUDIO_CODEX_BIN).";

export const versiCodex = async () => {
  const r = await jalankan(["--version"], { timeout: 20000 });
  if (!r.ok) return { terpasang: false, pesan: r.galat?.code === "ENOENT" ? "Codex CLI tidak ditemukan" : r.keluaran.trim().slice(-200) || r.galat?.message };
  return { terpasang: true, versi: r.keluaran.trim().split("\n").filter((b) => !/^WARNING/.test(b)).pop() };
};

// Model yang tersedia untuk akun yang login, dari cache daftar model Codex (CODEX_HOME/models_cache.json, diperbarui CLI).
export const modelCodex = () => {
  const rumah = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
  try {
    const j = JSON.parse(fs.readFileSync(path.join(rumah, "models_cache.json"), "utf8"));
    return (j.models ?? [])
      .filter((m) => m.slug && (m.visibility ?? "list") === "list")
      .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
      .map((m) => ({ kode: m.slug, nama: m.display_name ?? m.slug, deskripsi: m.description ?? "" }));
  } catch {
    return [];
  }
};

// Model yang dikirim ke `codex exec -m`. Studio memakai --ignore-user-config, sehingga tanpa -m Codex CLI memakai model
// bawaannya sendiri yang bisa ditolak akun ChatGPT (mis. "model … is not supported when using Codex with a ChatGPT
// account"). Maka: model tahap yang ada di daftar akun dipakai; selain itu (kosong/tidak tersedia) model pertama daftar
// akun (urut prioritas); tanpa daftar (cache belum ada) → model tahap apa adanya / bawaan CLI.
export const pilihModelCodex = (model, tersedia = []) => {
  if (!tersedia.length) return model || "";
  if (model && tersedia.some((m) => m.kode === model)) return model;
  return tersedia[0].kode;
};

// ---------- Akun (langganan ChatGPT) ----------

export const statusAkunCodex = async () => {
  const r = await jalankan(["login", "status"]);
  if (r.galat?.code === "ENOENT") return { terpasang: false, masuk: false };
  const teks = r.keluaran;
  if (/not logged in/i.test(teks)) return { terpasang: true, masuk: false };
  const metode = /chatgpt/i.test(teks) ? "chatgpt" : /api key/i.test(teks) ? "api_key" : null;
  return { terpasang: true, masuk: /logged in/i.test(teks), metode, keterangan: teks.split("\n").filter((b) => b.trim() && !/^WARNING/.test(b)).pop()?.trim() ?? null };
};

const BATAS_LOGIN_MS = 15 * 60 * 1000;
let sesi = null; // { anak, url, kode, keluaran, mulai, selesai, ok }

export const statusLoginCodex = () =>
  sesi ? { berjalan: !sesi.selesai, url: sesi.url, kode: sesi.kode, selesai: sesi.selesai, ok: sesi.ok, mulai: sesi.mulai } : { berjalan: false };

export const batalLoginCodex = () => {
  if (sesi && !sesi.selesai) sesi.anak.kill();
  sesi = null;
};

// Mulai login kode perangkat; mengembalikan tautan & kode sekali pakai. CLI selesai sendiri setelah pengguna menyetujui.
export const mulaiLoginCodex = async () => {
  if (sesi && !sesi.selesai && sesi.kode) return statusLoginCodex();
  batalLoginCodex();
  const { bin, awal } = await temukanCodex();
  const anak = spawn(bin, [...awal, "login", "--device-auth"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  const s = { anak, url: null, kode: null, keluaran: "", mulai: Date.now(), selesai: false, ok: false };
  sesi = s;
  const batas = setTimeout(() => anak.kill(), BATAS_LOGIN_MS);
  return new Promise((resolve, reject) => {
    const tunggu = setTimeout(() => {
      if (!s.kode) {
        anak.kill();
        reject(new Galat(502, `Kode login tidak muncul dari Codex CLI: ${s.keluaran.slice(-300) || "tanpa keluaran"}`));
      }
    }, 45000);
    const baca = (d) => {
      s.keluaran = (s.keluaran + d.toString("utf8").replace(/\x1b\[[0-9;]*m/g, "")).slice(-4000);
      s.url ??= s.keluaran.match(/https:\/\/auth\.openai\.com\/\S*device\S*/)?.[0] ?? null;
      s.kode ??= s.keluaran.match(/\b[A-Z0-9]{4}-[A-Z0-9]{4,6}\b/)?.[0] ?? null;
      if (s.url && s.kode) {
        clearTimeout(tunggu);
        resolve(statusLoginCodex());
      }
    };
    anak.stdout.on("data", baca);
    anak.stderr.on("data", baca);
    anak.on("error", (e) => {
      clearTimeout(tunggu);
      s.selesai = true;
      reject(new Galat(e.code === "ENOENT" ? 400 : 500, e.code === "ENOENT" ? PESAN_PASANG : e.message));
    });
    anak.on("close", (kode) => {
      clearTimeout(batas);
      clearTimeout(tunggu);
      s.selesai = true;
      s.ok = kode === 0;
      if (!s.kode) reject(new Galat(502, `Login Codex berhenti sebelum kode muncul: ${s.keluaran.slice(-300)}`));
    });
  });
};

export const keluarCodex = async () => {
  batalLoginCodex();
  await jalankan(["logout"]);
  return statusAkunCodex();
};

// ---------- Menjalankan tugas ----------

const logTugas = (tugasUuid, jenis, teks) =>
  query(`INSERT INTO studio_tugas_log (tugas_uuid, jenis, teks, waktu) VALUES ($1, $2, $3, $4)`, [tugasUuid, jenis, String(teks).slice(0, 8000), sekarang()]).catch(() => {});

// --ignore-user-config: config.toml pribadi pengguna (model, plugin, memori, MCP) tidak ikut ke agen Studio; login tetap
// dari CODEX_HOME. Tanpa -m, Codex memakai model bawaan akun.
// Windows: workspace-write butuh sandbox Windows Codex (windows.sandbox). Tanpa itu — dan config pengguna diabaikan —
// Codex jatuh ke read-only sehingga coding "selesai" tanpa satu berkas pun berubah. "unelevated" tidak meminta UAC.
// codebaseMemory = path biner codebase-memory-mcp (pengaturan codebase_memory aktif) atau null. Alatnya disetujui otomatis
// (approval_policy "never" menolak alat yang butuh persetujuan) dan dibatasi enabled_tools.
export const argumenCodex = ({ mode, model, base, berkasHasil, platform = process.platform, codebaseMemory = null }) => {
  const args = ["exec", "--json", "--ignore-user-config", "--color", "never", "-C", base, "-s", mode === "coding" ? "workspace-write" : "read-only", "-c", 'approval_policy="never"', "-o", berkasHasil];
  if (mode === "coding" && platform === "win32") args.push("-c", 'windows.sandbox="unelevated"');
  if (codebaseMemory) {
    // Nilai -c diurai sebagai TOML; string & larik JSON juga valid TOML.
    const server = "mcp_servers.codebase-memory";
    args.push(
      "-c", `${server}.command=${JSON.stringify(codebaseMemory)}`,
      "-c", `${server}.enabled_tools=${JSON.stringify(ALAT_PETA_KODE)}`,
      "-c", `${server}.default_tools_approval_mode="approve"`,
      "-c", `${server}.tool_timeout_sec=600`,
    );
  }
  if (model) args.push("-m", model);
  args.push("-"); // instruksi dari stdin
  return args;
};

// Berkas .env* di root & satu tingkat folder (diabaikan git, jadi dipotret isinya sebelum tugas).
const daftarEnv = (base) => {
  const hasil = [];
  const ambil = (dir) => {
    try {
      for (const n of fs.readdirSync(path.join(base, dir))) if (/^\.env/.test(n)) hasil.push(path.posix.join(dir, n));
    } catch {
      /* folder tidak terbaca */
    }
  };
  ambil(".");
  for (const d of fs.readdirSync(base, { withFileTypes: true })) if (d.isDirectory() && !d.name.startsWith(".") && d.name !== "node_modules") ambil(d.name);
  return hasil.map((p) => p.replace(/^\.\//, ""));
};
export const potretEnv = (base) => Object.fromEntries(daftarEnv(base).map((p) => [p, fs.readFileSync(path.join(base, p))]));

// Setelah tugas coding: kembalikan perubahan agen pada zona terlarang dan batalkan commit buatan agen.
export const jagaZonaTerlarang = async (base, { head, kotor, env = {} }) => {
  const catatan = [];
  for (const p of daftarEnv(base)) {
    const lama = env[p];
    const kini = fs.readFileSync(path.join(base, p));
    if (!lama) {
      fs.rmSync(path.join(base, p), { force: true });
      catatan.push(`berkas ${p} buatan agen dihapus (zona terlarang)`);
    } else if (!lama.equals(kini)) {
      fs.writeFileSync(path.join(base, p), lama);
      catatan.push(`perubahan pada ${p} dikembalikan (zona terlarang)`);
    }
  }
  for (const [p, isi] of Object.entries(env)) {
    if (!fs.existsSync(path.join(base, p))) {
      fs.writeFileSync(path.join(base, p), isi);
      catatan.push(`berkas ${p} yang dihapus agen dipulihkan`);
    }
  }
  const headSekarang = (await git(["rev-parse", "HEAD"], { cwd: base, izinkanGagal: true })).keluaran;
  if (head && headSekarang && headSekarang !== head) {
    await git(["reset", "--soft", head], { cwd: base });
    catatan.push(`commit buatan agen dibatalkan (perubahan tetap ada, belum di-commit)`);
  }
  const status = await statusBerkas(base);
  for (const [p, kode] of Object.entries(status)) {
    if (!terlarang(p) || p in kotor) continue;
    if (kode.includes("?")) fs.rmSync(path.join(base, p), { force: true, recursive: true });
    else await git(["checkout", "HEAD", "--", p], { cwd: base, izinkanGagal: true });
    catatan.push(`perubahan pada ${p} dikembalikan (zona terlarang)`);
  }
  return catatan;
};

export const jalankanCodex = async ({ tugasUuid, prompt, mode = "dokumen", model = "", base = config.repoDir, codebaseMemory = null }) => {
  const { bin, awal } = await temukanCodex();
  const berkasHasil = path.join(os.tmpdir(), `simrs-studio-codex-${tugasUuid}.txt`);
  const awalKerja = mode === "coding"
    ? { head: (await git(["rev-parse", "HEAD"], { cwd: base, izinkanGagal: true })).keluaran, kotor: await statusBerkas(base), env: potretEnv(base) }
    : null;
  const args = [...awal, ...argumenCodex({ mode, model, base, berkasHasil, codebaseMemory })];

  return new Promise((resolve, reject) => {
    const anak = spawn(bin, args, { cwd: base, windowsHide: true, env: { ...process.env } });
    daftarkanPembatal(tugasUuid, anak);
    ubah("studio_tugas", tugasUuid, { status: "jalan", pid: anak.pid ?? null, mulai: sekarang(), model: model ? `codex:${model}` : "codex" }).catch(() => {});
    logTugas(tugasUuid, "info", `Agen Codex dimulai (${mode}${model ? `, ${model}` : ""}, sandbox ${mode === "coding" ? "workspace-write" : "read-only"})`);

    let sisa = "";
    let sessionId = null;
    let pesanTerakhir = "";
    let galatTugas = null;
    let galatStderr = "";
    const token = { masuk: 0, keluar: 0 };

    const prosesBaris = async (baris) => {
      let e;
      try {
        e = JSON.parse(baris);
      } catch {
        return;
      }
      if (e.type === "thread.started" && e.thread_id) {
        sessionId = `codex:${e.thread_id}`;
        await ubah("studio_tugas", tugasUuid, { session_id: sessionId }).catch(() => {});
      } else if (e.type === "item.completed" && e.item) {
        const it = e.item;
        if (it.type === "agent_message" && it.text?.trim()) {
          pesanTerakhir = it.text;
          await logTugas(tugasUuid, "teks", it.text.trim());
        } else if (it.type === "command_execution") {
          await logTugas(tugasUuid, "alat", `$ ${it.command ?? ""}`.trim());
          if (it.exit_code && it.exit_code !== 0) await logTugas(tugasUuid, "galat", String(it.aggregated_output ?? "").slice(-500));
        } else if (it.type === "file_change") {
          for (const c of it.changes ?? []) await logTugas(tugasUuid, "alat", `${c.kind ?? "ubah"} ${c.path ?? ""}`.trim());
        } else if (it.type === "mcp_tool_call") {
          await logTugas(tugasUuid, "alat", `${it.server ?? "mcp"}.${it.tool ?? ""}`);
        } else if (it.type === "error" && it.message) {
          await logTugas(tugasUuid, "galat", it.message);
        }
      } else if (e.type === "turn.completed" && e.usage) {
        token.masuk += (e.usage.input_tokens ?? 0) + (e.usage.cached_input_tokens ?? 0);
        token.keluar += e.usage.output_tokens ?? 0;
      } else if (e.type === "turn.failed") {
        galatTugas = e.error?.message ?? "Codex gagal menyelesaikan tugas";
      } else if (e.type === "error" && e.message) {
        galatTugas = e.message;
      }
    };

    let antrean = Promise.resolve();
    anak.stdout.on("data", (potong) => {
      sisa += potong.toString("utf8");
      const baris = sisa.split("\n");
      sisa = baris.pop();
      for (const b of baris) if (b.trim()) antrean = antrean.then(() => prosesBaris(b));
    });
    anak.stderr.on("data", (potong) => (galatStderr = (galatStderr + potong.toString("utf8")).slice(-4000)));
    anak.on("error", (err) => {
      lepaskanPembatal(tugasUuid);
      reject(new Error(err.code === "ENOENT" ? PESAN_PASANG : err.message));
    });
    anak.on("close", async (kode) => {
      if (sisa.trim()) antrean = antrean.then(() => prosesBaris(sisa));
      await antrean;
      lepaskanPembatal(tugasUuid);
      let hasil = pesanTerakhir;
      try {
        hasil = fs.readFileSync(berkasHasil, "utf8") || hasil;
      } catch {
        /* tanpa berkas hasil: pakai pesan agen terakhir */
      }
      fs.rmSync(berkasHasil, { force: true });
      if (awalKerja) {
        for (const c of await jagaZonaTerlarang(base, awalKerja).catch((e) => [`pemeriksaan zona terlarang gagal: ${e.message}`])) await logTugas(tugasUuid, "galat", c);
      }
      // Biaya: CLI langganan tidak melaporkan US$; hanya token.
      await ubah("studio_tugas", tugasUuid, { biaya_usd: 0, token_masuk: token.masuk, token_keluar: token.keluar, session_id: sessionId, pid: null }).catch(() => {});
      if (kode === 0 && !galatTugas) return resolve({ hasil, sessionId });
      reject(new Error(galatTugas || galatStderr.replace(/^WARNING.*$/gm, "").trim().split("\n").slice(-3).join(" ") || `Codex berhenti (kode ${kode})`));
    });

    const panduan = codebaseMemory ? `\n\n${panduanCodebaseMemory(base)}` : "";
    anak.stdin.end(`${ATURAN_PLATFORM}${ATURAN_CODEX}${panduan}\n\n---\n\n${prompt}`, "utf8");
  });
};
