// Peta kode: codebase-memory-mcp (graph repo) untuk agen Studio (pengaturan codebase_memory).
// - Claude Code: dipasang lewat --mcp-config (claude.js);
// - Codex: lewat -c mcp_servers.codebase-memory.* (codex.js), karena config.toml pribadi diabaikan;
// - konektor API: klien MCP stdio di sini (bukaPetaKode), alatnya digabung ke loop alat api.js.
// Indeks & catatan arsitektur (ADR) disimpan di cache codebase-memory pengguna OS yang menjalankan Studio, bukan di repo.
import { execFile, spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import config from "../config.js";

// Alat yang boleh dipakai agen. delete_project & ingest_traces sengaja tidak diizinkan.
export const ALAT_PETA_KODE = [
  "search_graph", "trace_path", "get_code_snippet", "query_graph", "get_architecture", "search_code", "get_graph_schema",
  "get_file_outline", "list_projects", "index_status", "detect_changes", "check_index_coverage", "compare_graphs",
  "index_repository", "manage_adr",
];

const BATAS_KELUARAN = 30000;

export const panduanCodebaseMemory = (base) => `Peta kode (server MCP codebase-memory) tersedia untuk repo ${base}:
1. Di awal tugas, cari proyek repo ini dengan list_projects/index_status. Bila belum ada atau usang, jalankan index_repository {"repo_path": "${base}", "mode": "fast"} — tanpa persistence (jangan menulis .codebase-memory/ ke repo).
2. Petakan dulu lewat graph sebelum mencari berkas: get_architecture untuk gambaran layanan, search_graph untuk simbol/rute, trace_path untuk pemanggil & dampak, get_code_snippet untuk sumber. Graph bisa tertinggal dari berkas; pastikan path dengan membaca berkasnya sebelum mengutip atau mengubahnya.
3. Baca catatan arsitektur proyek (manage_adr mode "outline"/"get") untuk keputusan modul sebelumnya, dan ikuti polanya.
4. Pada tahap desain dan coding, setelah keputusan arsitektur penting (modul/tabel/API baru, pola integrasi), catat dengan manage_adr mode "set_sections" — satu bagian per modul (judul bagian = nama modul), isi ringkas dalam Bahasa Indonesia: tujuan, berkas & tabel utama, rute API, izin/katalog, nomor item STD. Jangan menghapus bagian modul lain.`;

// Lokasi codebase-memory-mcp: STUDIO_CODEBASE_MEMORY_BIN, lalu ~/.local/bin (lokasi installer bawaan, sering tidak ada di
// PATH layanan), lalu nama perintah di PATH.
export const binCodebaseMemory = () => {
  if (config.codebaseMemoryBin) return config.codebaseMemoryBin;
  const lokal = path.join(os.homedir(), ".local", "bin", process.platform === "win32" ? "codebase-memory-mcp.exe" : "codebase-memory-mcp");
  return fs.existsSync(lokal) ? lokal : "codebase-memory-mcp";
};

// Versi & lokasi codebase-memory-mcp (untuk halaman Pengaturan).
export const versiCodebaseMemory = () => {
  const bin = binCodebaseMemory();
  return new Promise((resolve) =>
    execFile(bin, ["--version"], { windowsHide: true, timeout: 20000 }, (err, stdout) =>
      resolve(err ? { terpasang: false, bin, pesan: err.code === "ENOENT" ? "codebase-memory-mcp tidak ditemukan" : err.message } : { terpasang: true, bin, versi: stdout.trim().split("\n")[0] }),
    ),
  );
};

// Klien MCP stdio minimal (JSON-RPC per baris) untuk konektor API. Resolves { alat, tutup }; alat berbentuk seperti
// src/agen/alat.js ({ nama, deskripsi, skema, mode, jalankan }) sehingga langsung masuk loop alat api.js.
export const bukaPetaKode = async (bin = binCodebaseMemory()) => {
  const anak = spawn(bin, [], { windowsHide: true, stdio: ["pipe", "pipe", "ignore"] });
  const tunggu = new Map();
  let nomor = 0;
  let sisa = "";
  let galatProses = null;
  const gagalkanSemua = (e) => {
    galatProses = galatProses ?? e;
    for (const t of tunggu.values()) t.reject(galatProses);
    tunggu.clear();
  };
  anak.on("error", (e) => gagalkanSemua(e.code === "ENOENT" ? new Error(`codebase-memory-mcp tidak ditemukan (${bin})`) : e));
  anak.on("exit", () => gagalkanSemua(new Error("Server codebase-memory berhenti")));
  anak.stdin.on("error", () => {});
  anak.stdout.on("data", (potong) => {
    sisa += potong.toString("utf8");
    const baris = sisa.split("\n");
    sisa = baris.pop();
    for (const b of baris) {
      let m;
      try {
        m = JSON.parse(b);
      } catch {
        continue;
      }
      const t = tunggu.get(m.id);
      if (!t) continue;
      tunggu.delete(m.id);
      if (m.error) t.reject(new Error(m.error.message ?? "Galat codebase-memory"));
      else t.resolve(m.result);
    }
  });
  const kirim = (pesan) => anak.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", ...pesan })}\n`);
  const minta = (method, params, batasMs = 120000) =>
    new Promise((resolve, reject) => {
      if (galatProses) return reject(galatProses);
      const id = ++nomor;
      const pewaktu = setTimeout(() => {
        tunggu.delete(id);
        reject(new Error(`${method}: codebase-memory tidak menjawab dalam ${Math.round(batasMs / 1000)} detik`));
      }, batasMs);
      tunggu.set(id, {
        resolve: (v) => (clearTimeout(pewaktu), resolve(v)),
        reject: (e) => (clearTimeout(pewaktu), reject(e)),
      });
      kirim({ id, method, params });
    });
  const tutup = () => {
    if (anak.exitCode === null && !anak.killed) anak.kill();
  };

  try {
    await minta("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "simrs-studio", version: "1.0.0" } }, 20000);
    kirim({ method: "notifications/initialized" });
    const { tools = [] } = await minta("tools/list", {}, 20000);
    const alat = tools
      .filter((t) => ALAT_PETA_KODE.includes(t.name))
      .map((t) => ({
        nama: t.name,
        deskripsi: `[Peta kode] ${t.description ?? ""}`,
        skema: t.inputSchema ?? { type: "object", properties: {} },
        mode: "baca",
        jalankan: async (args) => {
          // Indeks pertama repo besar bisa lama.
          const r = await minta("tools/call", { name: t.name, arguments: args ?? {} }, t.name === "index_repository" ? 600000 : 120000);
          const teks = (r?.content ?? []).map((c) => c.text ?? "").join("\n");
          if (r?.isError) throw new Error(teks || "Galat codebase-memory");
          return teks.length > BATAS_KELUARAN ? `${teks.slice(0, BATAS_KELUARAN)}\n… (keluaran dipotong)` : teks;
        },
      }));
    return { alat, tutup };
  } catch (e) {
    tutup();
    throw e;
  }
};
