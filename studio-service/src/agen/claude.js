// Adaptor agen: Claude Code CLI (headless, `claude -p --output-format stream-json`).
// Memakai login yang sudah ada di mesin ini (langganan Claude Pro/Max lewat /login, atau ANTHROPIC_API_KEY),
// sehingga pengembangan lewat SIMRS Studio memakai langganan yang sama dengan Claude Code di VS Code/terminal.
import { spawn, execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import config from "../config.js";
import { query, sekarang, ubah } from "../db.js";
import { ATURAN_PLATFORM } from "./prompt.js";
import { ALAT_PETA_KODE, panduanCodebaseMemory } from "./petakode.js";

// Alat per mode. Dokumen: hanya membaca repo. Coding: menyunting + perintah verifikasi dari daftar putih.
const ALAT_BACA = ["Read", "Grep", "Glob"];
const PERINTAH_DIIZINKAN = [
  "Bash(node --check:*)",
  "Bash(node --test:*)",
  "Bash(npm test:*)",
  "Bash(npm --prefix * test:*)",
  "Bash(npm --prefix * run test:*)",
  "Bash(npm --prefix frontend-service run build-only:*)",
  "Bash(npm run docs:katalog:*)",
  "Bash(node scripts/dokumen-katalog.mjs:*)",
  "Bash(git status:*)",
  "Bash(git diff:*)",
  "Bash(git log:*)",
];
const DILARANG = [
  "Read(**/.env)", "Read(**/.env.*)", "Edit(**/.env*)", "Write(**/.env*)",
  "Edit(studio-service/**)", "Write(studio-service/**)",
  "Edit(packages/authorization-sdk/**)", "Write(packages/authorization-sdk/**)",
  "Edit(packages/permission-sdk/**)", "Write(packages/permission-sdk/**)",
  "Edit(**/rahasia.js)", "Edit(.github/**)", "Write(.github/**)", "Edit(deploy/**)", "Write(deploy/**)",
  "Edit(CLAUDE.md)", "Edit(CLAUDE.local.md)",
  "Bash(git commit:*)", "Bash(git push:*)", "Bash(git checkout:*)", "Bash(git switch:*)", "Bash(git reset:*)",
  "Bash(npm install:*)", "Bash(npm i:*)", "Bash(rm:*)",
];

const proses = new Map(); // tugas_uuid → child process | AbortController (adaptor API)
const BERKAS_MCP = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "mcp.js");
// Alat MCP OpenSIMRS yang boleh dipakai agen Claude Code (baca saja).
const ALAT_MCP = ["mcp__opensimrs__baca_skema_db", "mcp__opensimrs__baca_katalog"];
// Alat peta kode codebase-memory (pengaturan codebase_memory), lihat petakode.js.
const ALAT_CODEBASE_MEMORY = ALAT_PETA_KODE.map((a) => `mcp__codebase-memory__${a}`);

const logTugas = (tugasUuid, jenis, teks) =>
  query(`INSERT INTO studio_tugas_log (tugas_uuid, jenis, teks, waktu) VALUES ($1, $2, $3, $4)`, [
    tugasUuid,
    jenis,
    String(teks).slice(0, 8000),
    sekarang(),
  ]).catch(() => {});

const ringkasAlat = (nama, masukan = {}) => {
  const target = masukan.file_path ?? masukan.path ?? masukan.pattern ?? masukan.command ?? masukan.tabel ?? masukan.description ?? "";
  const relatif = String(target).replace(config.repoDir.replace(/\\/g, "/"), "").replace(config.repoDir, "").replace(/^[\\/]/, "");
  return `${nama} ${relatif}`.trim();
};

// codebaseMemory = path biner codebase-memory-mcp (pengaturan aktif) atau null.
export const argumenClaude = ({ mode, model, resume, base, folderTambahan = [], batasBiaya = null, mcp = true, codebaseMemory = null }) => {
  const peta = mcp && codebaseMemory;
  const sistem = peta ? `${ATURAN_PLATFORM}\n\n${panduanCodebaseMemory(base ?? config.repoDir)}` : ATURAN_PLATFORM;
  const args = ["-p", "--output-format", "stream-json", "--verbose", "--strict-mcp-config", "--append-system-prompt", sistem];
  if (model) args.push("--model", model);
  if (resume) args.push("--resume", resume);
  if (batasBiaya) args.push("--max-budget-usd", String(batasBiaya));
  for (const d of folderTambahan) args.push("--add-dir", d);
  if (mcp) {
    const server = { opensimrs: { command: process.execPath, args: [BERKAS_MCP], env: { STUDIO_MCP_BASE: base ?? config.repoDir } } };
    if (peta) server["codebase-memory"] = { command: codebaseMemory, args: [] };
    args.push("--mcp-config", JSON.stringify({ mcpServers: server }));
  }
  const alatMcp = mcp ? [...ALAT_MCP, ...(peta ? ALAT_CODEBASE_MEMORY : [])] : [];
  if (mode === "coding") {
    args.push("--tools", [...ALAT_BACA, "Edit", "Write", "Bash"].join(","));
    args.push("--permission-mode", "acceptEdits");
    args.push("--allowedTools", ...ALAT_BACA, "Edit", "Write", ...PERINTAH_DIIZINKAN, ...alatMcp);
  } else {
    args.push("--tools", ALAT_BACA.join(","));
    args.push("--allowedTools", ...ALAT_BACA, ...alatMcp);
  }
  args.push("--disallowedTools", ...DILARANG);
  return args;
};

// Jalankan satu tugas agen. Resolves { hasil, sessionId } atau melempar galat. Status tugas diperbarui di DB.
export const jalankanClaude = ({ tugasUuid, prompt, mode = "dokumen", model = "", resume = null, base = config.repoDir, folderTambahan = [], batasBiaya = null, mcp = true, codebaseMemory = null }) =>
  new Promise((resolve, reject) => {
    const args = argumenClaude({ mode, model, resume, base, folderTambahan, batasBiaya, mcp, codebaseMemory });
    const anak = spawn(config.claudeBin, args, { cwd: base, windowsHide: true, env: { ...process.env } });
    proses.set(tugasUuid, anak);
    ubah("studio_tugas", tugasUuid, { status: "jalan", pid: anak.pid ?? null, mulai: sekarang() }).catch(() => {});
    logTugas(tugasUuid, "info", `Agen dimulai (${mode}${model ? `, ${model}` : ""}${resume ? ", melanjutkan sesi" : ""})`);

    let sisa = "";
    let hasilAkhir = null;
    let galatStderr = "";
    let sessionId = null;

    const prosesBaris = async (baris) => {
      let e;
      try {
        e = JSON.parse(baris);
      } catch {
        return;
      }
      if (e.type === "system" && e.subtype === "init") {
        sessionId = e.session_id;
        await ubah("studio_tugas", tugasUuid, { session_id: sessionId, model: e.model ?? model ?? null }).catch(() => {});
      } else if (e.type === "rate_limit_event") {
        await ubah("studio_tugas", tugasUuid, { kuota: e.rate_limit_info ?? null }).catch(() => {});
      } else if (e.type === "assistant") {
        for (const c of e.message?.content ?? []) {
          if (c.type === "text" && c.text?.trim()) await logTugas(tugasUuid, "teks", c.text.trim());
          if (c.type === "tool_use") await logTugas(tugasUuid, "alat", ringkasAlat(c.name, c.input));
        }
      } else if (e.type === "user") {
        for (const c of e.message?.content ?? []) {
          if (c.type === "tool_result" && c.is_error) {
            const isi = Array.isArray(c.content) ? c.content.map((x) => x.text ?? "").join(" ") : String(c.content ?? "");
            await logTugas(tugasUuid, "galat", isi.slice(0, 500));
          }
        }
      } else if (e.type === "result") {
        hasilAkhir = e;
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
      proses.delete(tugasUuid);
      const pesan = err.code === "ENOENT" ? `Claude Code CLI tidak ditemukan (${config.claudeBin}). Pasang & login dulu: npm i -g @anthropic-ai/claude-code lalu jalankan "claude" → /login.` : err.message;
      reject(new Error(pesan));
    });
    anak.on("close", async (kode) => {
      if (sisa.trim()) antrean = antrean.then(() => prosesBaris(sisa));
      await antrean;
      proses.delete(tugasUuid);
      const usage = hasilAkhir?.usage ?? {};
      await ubah("studio_tugas", tugasUuid, {
        biaya_usd: hasilAkhir?.total_cost_usd ?? 0,
        token_masuk: (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0),
        token_keluar: usage.output_tokens ?? 0,
        session_id: hasilAkhir?.session_id ?? sessionId,
        pid: null,
      }).catch(() => {});
      if (hasilAkhir && !hasilAkhir.is_error) return resolve({ hasil: hasilAkhir.result ?? "", sessionId: hasilAkhir.session_id ?? sessionId });
      const pesan = hasilAkhir?.result || galatStderr.trim().split("\n").slice(-3).join(" ") || `Claude Code berhenti (kode ${kode})`;
      reject(new Error(pesan));
    });

    anak.stdin.end(prompt, "utf8");
  });

// Adaptor API mendaftarkan AbortController-nya di sini agar bisa dihentikan dengan cara yang sama.
export const daftarkanPembatal = (tugasUuid, pengendali) => proses.set(tugasUuid, pengendali);
export const lepaskanPembatal = (tugasUuid) => proses.delete(tugasUuid);

export const batalkanProses = (tugasUuid) => {
  const anak = proses.get(tugasUuid);
  if (!anak) return false;
  if (typeof anak.abort === "function") {
    anak.abort();
    return true;
  }
  if (process.platform === "win32") execFile("taskkill", ["/PID", String(anak.pid), "/T", "/F"], () => {});
  else anak.kill("SIGTERM");
  return true;
};

export const adaProses = (tugasUuid) => proses.has(tugasUuid);

// Versi CLI (untuk halaman Pengaturan).
export const versiClaude = () =>
  new Promise((resolve) =>
    execFile(config.claudeBin, ["--version"], { windowsHide: true, timeout: 20000 }, (err, stdout) =>
      resolve(err ? { terpasang: false, pesan: err.code === "ENOENT" ? "Claude Code CLI tidak ditemukan" : err.message } : { terpasang: true, versi: stdout.trim() }),
    ),
  );