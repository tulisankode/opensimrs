// Helpdesk AI (OpenClaw) di mesin pengembang: status gateway, agen helpdesk & modelnya, sinkron panduan, dan token
// gateway — tanpa terminal. Hanya OpenClaw lokal (CLI `openclaw` di mesin ini); gateway produksi di VM tetap diatur
// sesuai deploy/helpdesk/README.md. Kanal pesan (WhatsApp/Telegram/…) sengaja tidak diatur: helpdesk hanya lewat
// endpoint HTTP dari OpenSIMRS (login, penyaring data pasien, batas per jam).
//
// Rahasia (kunci API penyedia model, token gateway) tidak pernah lewat argumen perintah, log, atau respons: ditulis
// sebagai patch JSON5 ke folder berizin terbatas lalu diterapkan dengan `openclaw config patch --file` dan dihapus.
// Paket Windows (MSIX) menjalankan OpenClaw di sesi terisolasi dengan akun Windows tersendiri yang tidak bisa membaca
// profil pengguna maupun stdin, jadi folder patch & workspace berada di C:\Users\Public dengan ACL terbatas.
import crypto from "node:crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { execFile, spawn } from "child_process";
import config from "./config.js";
import { git } from "./git.js";
import { Galat, permintaanSalah } from "./respons.js";

export const AGEN_BAWAAN = "helpdesk-opensimrs";
const PORT_BAWAAN = 18789;
// Alat yang ditolak untuk agen helpdesk: agen hanya membaca panduan di workspace-nya (deploy/helpdesk/README.md §3).
export const ALAT_DITOLAK = [
  "exec", "process", "write", "edit", "apply_patch", "browser", "canvas", "computer", "nodes", "automations", "gateway",
  "sessions_spawn", "sessions_send", "subagents", "web_fetch", "web_search",
];
const BERKAS_PERSONA = ["SOUL.md", "IDENTITY.md", "USER.md"];
const ALAT_DITOLAK_SANDBOX =["exec", "process", "write", "edit", "apply_patch", "sessions_spawn", "sessions_send", "subagents"];
// Batas isi workspace yang disuntikkan ke prompt sistem: model lokal kecil lambat membaca prompt puluhan ribu token.
const BATAS_BOOTSTRAP = 12000;
const POLA_AGEN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const POLA_MODEL = /^[a-z0-9][a-z0-9_-]*\/[\w.:/-]{1,120}$/i;
const POLA_PENYEDIA = /^[a-z][a-z0-9_-]{0,63}$/;
export const PENYEDIA = ["anthropic", "openai", "deepseek", "openrouter", "google", "mistral", "groq", "xai"];

const bersihkan = (teks) => String(teks ?? "").replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").replace(/\r/g, "");

// Jalankan CLI openclaw. Setiap panggilan di paket Windows menyalakan sesi terisolasi (beberapa detik).
export const jalankan = (args, timeout = 120000) =>
  new Promise((resolve) =>
    execFile(config.openclawBin, args, { windowsHide: true, timeout, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) =>
      resolve({ ok: !err, keluaran: bersihkan(`${stdout ?? ""}${stderr ?? ""}`), galat: err }),
    ),
  );
const wajib = async (args, judul, timeout) => {
  const r = await jalankan(args, timeout);
  if (r.galat?.code === "ENOENT") throw new Galat(409, "OpenClaw belum terpasang di mesin ini (perintah openclaw tidak ditemukan)");
  if (!r.ok) throw new Galat(502, `${judul} gagal: ${r.keluaran.trim().split("\n").slice(-4).join(" ") || r.galat?.message}`);
  return r.keluaran;
};
// JSON di keluaran CLI: bisa diapit teks lain (banner, "CLI cleanup timed out", …).
export const ambilJson = (teks) => {
  const awal = teks.search(/[[{]/);
  if (awal < 0) return null;
  const tutup = teks[awal] === "{" ? "}" : "]";
  for (let akhir = teks.lastIndexOf(tutup); akhir > awal; akhir = teks.lastIndexOf(tutup, akhir - 1)) {
    try {
      return JSON.parse(teks.slice(awal, akhir + 1));
    } catch {
      /* coba penutup sebelumnya */
    }
  }
  return null;
};

// Lokasi konfigurasi & akun yang menjalankan OpenClaw (berbeda dari pengguna OS → sesi terisolasi paket Windows).
const infoInstalasi = async () => {
  const r = await jalankan(["config", "file"], 60000);
  if (r.galat?.code === "ENOENT") return { terpasang: false };
  const berkas = r.keluaran.split("\n").map((b) => b.trim()).find((b) => /openclaw\.json5?$/i.test(b)) ?? null;
  const akun = berkas?.match(/^[A-Za-z]:\\Users\\([^\\]+)\\/i)?.[1] ?? null;
  const terisolasi = Boolean(akun) && akun.toLowerCase() !== os.userInfo().username.toLowerCase();
  return { terpasang: true, berkasKonfigurasi: berkas, akun, terisolasi };
};

// Folder yang bisa dibaca OpenClaw: workspace agen & patch rahasia sementara.
const AKAR_PUBLIK = process.platform === "win32" ? path.join(process.env.PUBLIC || "C:\\Users\\Public", "openclaw-helpdesk") : path.join(os.homedir(), ".openclaw-helpdesk");
const folderWorkspace = (agen) => path.join(AKAR_PUBLIK, agen);

// Folder patch: hanya pengguna OS ini & akun sesi terisolasi yang boleh membaca (Windows); 0700 di sistem lain.
const siapkanFolderMasuk = async (info) => {
  const dir = path.join(AKAR_PUBLIK, ".masuk");
  fs.mkdirSync(dir, { recursive: true });
  if (process.platform === "win32") {
    const izin = [`${os.userInfo().username}:(OI)(CI)F`, ...(info.terisolasi && info.akun ? [`${info.akun}:(OI)(CI)R`] : [])];
    await new Promise((resolve, reject) =>
      execFile("icacls", [dir, "/inheritance:r", "/grant:r", ...izin], { windowsHide: true }, (err, stdout, stderr) =>
        err ? reject(new Galat(500, `Izin folder ${dir} gagal diatur: ${bersihkan(stderr || stdout).trim()}`)) : resolve(),
      ),
    );
  } else fs.chmodSync(dir, 0o700);
  return dir;
};

// Terapkan patch konfigurasi (bisa berisi rahasia) lewat berkas sementara; validasi skema dulu (--dry-run).
const terapkanPatch = async (patch, info) => {
  const dir = await siapkanFolderMasuk(info);
  const berkas = path.join(dir, `patch-${crypto.randomUUID()}.json`);
  fs.writeFileSync(berkas, JSON.stringify(patch, null, 2), { encoding: "utf8", mode: 0o600 });
  try {
    await wajib(["config", "patch", "--file", berkas, "--dry-run"], "Validasi konfigurasi OpenClaw");
    await wajib(["config", "patch", "--file", berkas], "Menyimpan konfigurasi OpenClaw");
  } finally {
    fs.rmSync(berkas, { force: true });
  }
};

const ambilNilai = async (jalur) => {
  const r = await jalankan(["config", "get", jalur], 60000);
  if (!r.ok || /unset|Unknown config path/i.test(r.keluaran)) return null;
  const json = ambilJson(r.keluaran);
  if (json !== null) return json;
  const baris = r.keluaran.split("\n").map((b) => b.trim()).filter((b) => b && !/^OpenClaw \d/.test(b) && !b.startsWith("|"));
  return baris.at(-1) ?? null;
};

const daftarAgen = async () => {
  const r = await jalankan(["agents", "list", "--json"], 60000);
  return (ambilJson(r.keluaran) ?? []).map((a) => ({ id: a.id, model: a.model ?? null, workspace: a.workspace ?? null, bawaan: Boolean(a.isDefault) }));
};

const portGateway = async () => Number(await ambilNilai("gateway.port")) || PORT_BAWAAN;

// Gateway berjalan? Endpoint HTTP aktif? (tanpa token: 401 = aktif & meminta token, 404 = endpoint mati)
const periksaGateway = async (port) => {
  const url = `http://127.0.0.1:${port}`;
  const coba = async (p) => {
    try {
      return (await fetch(`${url}${p}`, { signal: AbortSignal.timeout(4000) })).status;
    } catch {
      return null;
    }
  };
  const akar = await coba("/");
  if (akar == null) return { url, berjalan: false, endpointHttp: null };
  const v1 = await coba("/v1/models");
  return { url, berjalan: true, endpointHttp: v1 === 404 ? "mati" : v1 === 401 || v1 === 200 ? "aktif" : `HTTP ${v1}` };
};

const modelOllama = async () => {
  try {
    const r = await fetch(`${config.ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    const j = await r.json();
    return { berjalan: true, model: (j.models ?? []).map((m) => ({ nama: m.name, ukuranGb: Math.round((m.size / 1e9) * 10) / 10 })) };
  } catch {
    return { berjalan: false, model: [] };
  }
};

// Pengaturan Helpdesk AI di setting-service (dipanggil dengan token pengguna superadmin).
const setting = async (token, metode, url, body) => {
  let r;
  try {
    r = await fetch(`${config.settingUrl}${url}`, { method: metode, headers: { Authorization: token, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    throw new Galat(502, `setting-service tidak dapat dihubungi (${config.settingUrl}): ${e.message}`);
  }
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Galat(r.status === 401 ? 401 : r.status >= 500 ? 502 : r.status, `setting-service: ${json.message ?? r.status}`);
  return json.payload;
};

const ringkasAgen = (id, entri, daftar) => {
  const a = daftar.find((x) => x.id === id);
  if (!a) return null;
  const tolak = new Set(entri?.tools?.deny ?? []);
  return {
    id,
    model: a.model,
    workspace: a.workspace,
    thinking: entri?.thinkingDefault ?? null,
    sandbox: entri?.sandbox?.mode ?? null,
    batasBootstrap: entri?.bootstrapTotalMaxChars ?? null,
    alatAman: ALAT_DITOLAK.every((x) => tolak.has(x)),
    panduan: a.workspace ? fs.existsSync(path.join(a.workspace, "AGENTS.md")) : false,
  };
};

export const status = async (token) => {
  const info = await infoInstalasi();
  if (!info.terpasang) return { terpasang: false, ollama: await modelOllama() };
  const [versi, port, daftar, ollama] = await Promise.all([jalankan(["--version"], 60000), portGateway(), daftarAgen(), modelOllama()]);
  const gateway = await periksaGateway(port);
  const helpdesk = token ? await setting(token, "GET", "/bantuan/konfigurasi").catch((e) => ({ galat: e.message })) : null;
  const idAgen = helpdesk?.agen || AGEN_BAWAAN;
  const entri = daftar.some((a) => a.id === idAgen) ? await ambilNilai(`agents.entries.${idAgen}`) : null;
  return {
    terpasang: true,
    versi: versi.keluaran.match(/OpenClaw\s+([\d.]+)/)?.[1] ?? null,
    berkasKonfigurasi: info.berkasKonfigurasi,
    terisolasi: info.terisolasi,
    gateway,
    agen: daftar,
    agenHelpdesk: ringkasAgen(idAgen, entri, daftar),
    ollama,
    helpdesk,
    penyedia: PENYEDIA,
  };
};

// Salin pengetahuan agen dari commit terakhir repo (sama dengan deploy/helpdesk/sinkron-panduan.sh).
export const sinkronPanduan = async (agen = AGEN_BAWAAN, workspace = folderWorkspace(agen)) => {
  if (!POLA_AGEN.test(agen)) throw permintaanSalah("ID agen hanya huruf kecil, angka, - dan _");
  const cwd = config.repoDir;
  const { keluaran } = await git(["ls-tree", "-r", "--name-only", "HEAD", "docs/panduan-pengguna"], { cwd });
  const panduan = keluaran.split("\n").filter((p) => p.endsWith(".md"));
  const isi = [
    ...panduan.map((p) => [p, path.join("panduan-pengguna", path.relative("docs/panduan-pengguna", p))]),
    ["database/data/katalog-modul.json", "katalog-modul.json"],
    // Persona helpdesk menggantikan persona asisten pribadi bawaan OpenClaw (disuntikkan ke setiap prompt).
    ...["AGENTS.md", ...BERKAS_PERSONA].map((b) => [`deploy/helpdesk/${b}`, b]),
  ];
  fs.rmSync(path.join(workspace, "panduan-pengguna"), { recursive: true, force: true });
  for (const [sumber, tujuan] of isi) {
    const r = await git(["show", `HEAD:${sumber}`], { cwd, izinkanGagal: true });
    // Berkas yang belum di-commit (mis. persona baru) dibaca dari working tree.
    const teks = r.ok ? `${r.keluaran}\n` : fs.readFileSync(path.join(cwd, sumber), "utf8");
    const target = path.join(workspace, tujuan);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, teks, "utf8");
  }
  // Ritual "lahir" asisten pribadi OpenClaw tidak cocok untuk helpdesk; hanya dibuat ulang pada workspace baru.
  fs.rmSync(path.join(workspace, "BOOTSTRAP.md"), { force: true });
  const sha = (await git(["rev-parse", "--short", "HEAD"], { cwd })).keluaran;
  return { workspace, berkas: panduan.length, sha };
};

// Buat/ubah agen helpdesk: model, kunci API penyedia (opsional), mode berpikir, batas prompt, dan batasan alat.
// body: { agen, model, penyedia?, kunciApi?, thinking?, batasBootstrap? }
export const aturAgen = async (body = {}) => {
  const agen = String(body.agen || AGEN_BAWAAN).trim();
  const model = String(body.model ?? "").trim();
  if (!POLA_AGEN.test(agen)) throw permintaanSalah("ID agen hanya huruf kecil, angka, - dan _ (maks. 64)");
  if (!POLA_MODEL.test(model)) throw permintaanSalah('Model ditulis "penyedia/nama-model", mis. ollama/qwen3:4b atau anthropic/claude-haiku-5-5');
  const penyediaModel = model.split("/")[0].toLowerCase();
  const kunciApi = String(body.kunciApi ?? "").trim();
  const penyedia = String(body.penyedia || penyediaModel).trim().toLowerCase();
  if (kunciApi && !POLA_PENYEDIA.test(penyedia)) throw permintaanSalah("Nama penyedia tidak valid");
  if (kunciApi && penyedia === "ollama") throw permintaanSalah("Model Ollama lokal tidak memakai kunci API");
  const thinking = ["off", "minimal", "low", "medium", "high"].includes(body.thinking) ? body.thinking : "off";
  const batas = Number(body.batasBootstrap ?? BATAS_BOOTSTRAP);
  if (!Number.isInteger(batas) || batas < 2000 || batas > 200000) throw permintaanSalah("Batas isi workspace harus 2.000–200.000 karakter");

  const info = await infoInstalasi();
  if (!info.terpasang) throw new Galat(409, "OpenClaw belum terpasang di mesin ini");
  const daftar = await daftarAgen();
  let workspace = daftar.find((a) => a.id === agen)?.workspace;
  let dibuat = false;
  if (!workspace) {
    workspace = folderWorkspace(agen);
    await sinkronPanduan(agen, workspace);
    await wajib(["agents", "add", agen, "--non-interactive", "--workspace", workspace], "Membuat agen OpenClaw");
    dibuat = true;
  }
  const patch = {
    gateway: { http: { endpoints: { chatCompletions: { enabled: true } } } },
    agents: {
      entries: {
        [agen]: {
          model,
          thinkingDefault: thinking,
          bootstrapTotalMaxChars: batas,
          // Sandbox Docker butuh Docker di sesi OpenClaw; di mesin pengembang dimatikan, alat berbahaya tetap ditolak.
          sandbox: { mode: "off", workspaceAccess: "ro", scope: "session" },
          tools: { deny: ALAT_DITOLAK, sandbox: { tools: { deny: ALAT_DITOLAK_SANDBOX } } },
        },
      },
    },
    ...(kunciApi ? { models: { providers: { [penyedia]: { apiKey: kunciApi } } } } : {}),
  };
  await terapkanPatch(patch, info);
  return { agen, model, workspace, dibuat, kunciDisimpan: Boolean(kunciApi), penyedia: kunciApi ? penyedia : null };
};

// Token gateway baru: dipasang di OpenClaw lalu di pengaturan Helpdesk AI OpenSIMRS (URL, agen, token). Gateway perlu
// dijalankan ulang agar token baru berlaku.
export const gantiToken = async (tokenPengguna, body = {}) => {
  const info = await infoInstalasi();
  if (!info.terpasang) throw new Galat(409, "OpenClaw belum terpasang di mesin ini");
  const token = crypto.randomBytes(32).toString("hex");
  await terapkanPatch({ gateway: { auth: { mode: "token", token } } }, info);
  const port = await portGateway();
  const lama = await setting(tokenPengguna, "GET", "/bantuan/konfigurasi").catch(() => ({}));
  await setting(tokenPengguna, "PUT", "/bantuan/konfigurasi", {
    aktif: lama?.aktif ?? true,
    gateway_url: `http://127.0.0.1:${port}`,
    token,
    agen: String(body.agen || lama?.agen || AGEN_BAWAAN),
    batas_per_jam: lama?.batas_per_jam ?? 20,
    timeout_detik: lama?.timeout_detik ?? 120,
  });
  return { akhiran: token.slice(-4), url: `http://127.0.0.1:${port}` };
};

// Jalankan (ulang) gateway sebagai proses latar milik studio-service. --force menghentikan gateway lama di port yang
// sama (perintah `gateway restart` tidak bisa menyalakannya kembali pada paket Windows).
let prosesGateway = null;
export const jalankanGateway = async () => {
  const info = await infoInstalasi();
  if (!info.terpasang) throw new Galat(409, "OpenClaw belum terpasang di mesin ini");
  const anak = spawn(config.openclawBin, ["gateway", "--force"], { windowsHide: true, detached: true, stdio: "ignore" });
  anak.on("error", () => {});
  anak.unref();
  prosesGateway = anak;
  const port = await portGateway();
  for (let i = 0; i < 45; i++) {
    const g = await periksaGateway(port);
    if (g.berjalan) return g;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Galat(504, "Gateway belum menjawab setelah 90 detik. Periksa aplikasi OpenClaw Gateway atau jalankan `openclaw gateway` di terminal untuk melihat galatnya.");
};
export const gatewayDijalankanStudio = () => Boolean(prosesGateway && prosesGateway.exitCode == null);

// Uji tanya-jawab ke agen helpdesk lewat gateway (memakai model sungguhan): jawaban & lama waktunya.
export const ujiTanya = async (body = {}) => {
  const agen = String(body.agen || AGEN_BAWAAN).trim();
  if (!POLA_AGEN.test(agen)) throw permintaanSalah("ID agen tidak valid");
  const pertanyaan = String(body.pertanyaan || "Bagaimana cara mengganti kata sandi?").slice(0, 300);
  const mulai = Date.now();
  // Sesi baru per uji: jawaban tidak dipengaruhi riwayat percakapan uji sebelumnya.
  const sesi = `agent:${agen}:uji-studio-${crypto.randomUUID().slice(0, 8)}`;
  const r = await jalankan(["agent", "--agent", agen, "--session-key", sesi, "--message", pertanyaan, "--json", "--timeout", "300"], 330000);
  const durasiMs = Date.now() - mulai;
  const json = ambilJson(r.keluaran);
  const jawaban = (json?.result?.payloads ?? []).map((p) => p.text).filter(Boolean).join("\n") || null;
  if (!r.ok && !jawaban) throw new Galat(502, `Agen tidak menjawab (${Math.round(durasiMs / 1000)} dtk): ${r.keluaran.trim().split("\n").slice(-4).join(" ")}`);
  return { agen, pertanyaan, jawaban: jawaban ?? r.keluaran.trim().slice(-2000), durasiMs };
};
