import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";

const angka = (nilai, bawaan) => (nilai !== undefined && nilai !== "" && Number.isFinite(Number(nilai)) ? Number(nilai) : bawaan);
const folderLayanan = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export default {
  port: angka(process.env.APPLICATION_PORT ?? process.env.PORT, 8090),
  host: process.env.APPLICATION_HOST || "0.0.0.0",
  basePath: "/api/v3/studio",
  secretKey: process.env.SECRET_KEY,
  // Lapis 1 (instalasi): Studio hanya melayani bila diaktifkan di .env.
  aktifInstalasi: (process.env.STUDIO_PENGEMBANG || "").toLowerCase() === "aktif",
  lingkungan: (process.env.LINGKUNGAN || process.env.NODE_ENV || "development").toLowerCase(),
  // Repo yang dikembangkan agen (bawaan: monorepo tempat layanan ini berada).
  repoDir: path.resolve(process.env.STUDIO_REPO_DIR || path.join(folderLayanan, "..")),
  claudeBin: process.env.STUDIO_CLAUDE_BIN || "claude",
  // Codex CLI (OpenAI, langganan ChatGPT). Kosong = dicari dari paket npm global @openai/codex.
  codexBin: process.env.STUDIO_CODEX_BIN || "",
  // codebase-memory-mcp (peta kode/graph repo untuk agen Claude Code). Kosong = ~/.local/bin bila ada, lalu PATH.
  codebaseMemoryBin: process.env.STUDIO_CODEBASE_MEMORY_BIN || "",
  // Runtime ekstensi tanpa kode (validasi, pratinjau, pasang) ada di laporan-service.
  laporanUrl: (process.env.BASE_URL_API_LAPORAN || "http://localhost:8088/api/v3/laporan").replace(/\/$/, ""),
  // Helpdesk AI: OpenClaw di mesin ini (menu Helpdesk AI) & pengaturan Helpdesk di setting-service.
  openclawBin: process.env.STUDIO_OPENCLAW_BIN || "openclaw",
  settingUrl: (process.env.BASE_URL_API_SETTING || "http://localhost:8094/api/v3/setting").replace(/\/$/, ""),
  ollamaUrl: (process.env.STUDIO_OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, ""),
  pg: {
    host: process.env.DB_HOST || "localhost",
    port: angka(process.env.DB_PORT, 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
  },
};
