#!/usr/bin/env node
// Server MCP OpenSIMRS (stdio, JSON-RPC 2.0 per baris) — rancangan §10.2.
// Dipakai: (1) agen Claude Code di Studio (--mcp-config, alat baca skema DB & katalog); (2) agen eksternal yang mendukung
// MCP (OpenClaw, Claude Desktop, agen lain) untuk membaca repo & ikut menulis dokumen item SIMRS Studio.
//
// Contoh konfigurasi agen eksternal:
//   { "mcpServers": { "opensimrs": { "command": "node", "args": ["<repo>/studio-service/src/mcp.js"] } } }
// Variabel: STUDIO_MCP_BASE (direktori kerja, bawaan repo), STUDIO_MCP_TULIS=aktif (izinkan alat tulis berkas & perintah),
// STUDIO_MCP_PENGGUNA (nama yang dicatat di audit, bawaan "agen-eksternal").
import readline from "readline";
import config from "./config.js";
import { audit, query, satu, sisipkan } from "./db.js";
import { ALAT } from "./agen/alat.js";
import { bacaSemua } from "./pengaturan.js";
import { temukanDataPribadi } from "./kebijakan.js";

const base = process.env.STUDIO_MCP_BASE || config.repoDir;
const bolehTulis = (process.env.STUDIO_MCP_TULIS || "").toLowerCase() === "aktif";
const pengguna = process.env.STUDIO_MCP_PENGGUNA || "agen-eksternal";
const TAHAP_DOKUMEN = ["permintaan", "usecase", "prd", "desain", "qa", "rilis"];

const pastikanStudioAktif = async () => {
  const { nilai } = await bacaSemua();
  if (!config.aktifInstalasi || !nilai.mode_pengembang?.aktif) throw new Error("SIMRS Studio / Mode Pengembang tidak aktif");
  if (nilai.kill_switch?.aktif) throw new Error("SIMRS Studio sedang dihentikan (kill switch)");
};
const itemDariNomor = async (nomor) => {
  const n = Number(String(nomor).replace(/\D/g, ""));
  const item = await satu(`SELECT * FROM studio_item WHERE nomor = $1 AND deleted_at IS NULL`, [n]);
  if (!item) throw new Error(`Item STD-${String(n).padStart(4, "0")} tidak ditemukan`);
  return item;
};

const ALAT_STUDIO = [
  {
    nama: "daftar_item",
    deskripsi: "Daftar item SIMRS Studio yang aktif (nomor, judul, tahap, risiko).",
    skema: { type: "object", properties: {} },
    jalankan: async () => {
      await pastikanStudioAktif();
      const rows = await query(`SELECT nomor, judul, jenis, tahap, risiko, prioritas FROM studio_item WHERE deleted_at IS NULL AND tahap NOT IN ('selesai','dibatalkan') ORDER BY nomor`);
      return rows.map((r) => `STD-${String(r.nomor).padStart(4, "0")} [${r.tahap}, risiko ${r.risiko}, ${r.prioritas}] ${r.judul}`).join("\n") || "Tidak ada item aktif.";
    },
  },
  {
    nama: "baca_item",
    deskripsi: "Isi item SIMRS Studio: permintaan, dokumen terbaru per tahap, dan diskusi tahap aktif.",
    skema: { type: "object", properties: { nomor: { type: "string", description: "mis. STD-0003 atau 3" } }, required: ["nomor"] },
    jalankan: async ({ nomor }) => {
      await pastikanStudioAktif();
      const item = await itemDariNomor(nomor);
      const artefak = await query(
        `SELECT DISTINCT ON (tahap) tahap, versi, isi FROM studio_artefak WHERE item_uuid = $1 ORDER BY tahap, versi DESC`,
        [item.uuid],
      );
      const diskusi = await query(`SELECT dari, pengguna, isi FROM studio_pesan WHERE item_uuid = $1 AND tahap = $2 ORDER BY created_at, id`, [item.uuid, item.tahap]);
      return [
        `# STD-${String(item.nomor).padStart(4, "0")}: ${item.judul} (tahap ${item.tahap}, risiko ${item.risiko})`,
        `## Permintaan\n${JSON.stringify(item.permintaan, null, 2)}`,
        ...artefak.map((a) => `## Dokumen ${a.tahap} v${a.versi}\n${a.isi}`),
        `## Diskusi tahap ${item.tahap}\n${diskusi.map((d) => `- ${d.dari === "ai" ? "AI" : d.pengguna ?? d.dari}: ${d.isi}`).join("\n")}`,
      ].join("\n\n");
    },
  },
  {
    nama: "kirim_artefak",
    deskripsi: "Menyimpan dokumen (Markdown) sebagai versi baru untuk tahap AKTIF item (permintaan/usecase/prd/desain/qa/rilis). Tetap perlu persetujuan manusia di SIMRS Studio.",
    skema: { type: "object", properties: { nomor: { type: "string" }, isi: { type: "string" } }, required: ["nomor", "isi"] },
    jalankan: async ({ nomor, isi }) => {
      await pastikanStudioAktif();
      const item = await itemDariNomor(nomor);
      if (!TAHAP_DOKUMEN.includes(item.tahap)) throw new Error(`Tahap ${item.tahap} bukan tahap dokumen`);
      const pribadi = temukanDataPribadi(isi);
      if (pribadi.length) throw new Error(`Dokumen memuat data pribadi: ${pribadi.slice(0, 3).join(", ")}`);
      const { versi } = await satu(`SELECT COALESCE(MAX(versi), 0) + 1 AS versi FROM studio_artefak WHERE item_uuid = $1 AND tahap = $2`, [item.uuid, item.tahap]);
      await sisipkan("studio_artefak", { item_uuid: item.uuid, tahap: item.tahap, versi, isi: String(isi), dibuat_oleh: pengguna });
      await sisipkan("studio_pesan", { item_uuid: item.uuid, tahap: item.tahap, dari: "ai", isi: `Dokumen ${item.tahap} versi ${versi} dikirim oleh agen eksternal (${pengguna}).`, pengguna });
      await audit(pengguna, `Mengirim dokumen ${item.tahap} v${versi} lewat MCP`, item.uuid);
      return `Tersimpan sebagai ${item.tahap} versi ${versi}. Menunggu persetujuan di SIMRS Studio.`;
    },
  },
  {
    nama: "kirim_pesan",
    deskripsi: "Menambahkan pesan diskusi (sebagai AI) pada tahap aktif item, mis. pertanyaan klarifikasi.",
    skema: { type: "object", properties: { nomor: { type: "string" }, isi: { type: "string" } }, required: ["nomor", "isi"] },
    jalankan: async ({ nomor, isi }) => {
      await pastikanStudioAktif();
      const item = await itemDariNomor(nomor);
      if (temukanDataPribadi(isi).length) throw new Error("Pesan memuat data pribadi");
      await sisipkan("studio_pesan", { item_uuid: item.uuid, tahap: item.tahap, dari: "ai", isi: String(isi), pengguna });
      return "Pesan terkirim.";
    },
  },
];

const semuaAlat = [...ALAT.filter((a) => a.mode === "baca" || bolehTulis), ...ALAT_STUDIO];

const kirim = (pesan) => process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...pesan })}\n`);

const tangani = async (m) => {
  const { id, method, params } = m;
  if (method === "initialize") {
    return kirim({ id, result: { protocolVersion: params?.protocolVersion ?? "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "opensimrs", version: "1.0.0" } } });
  }
  if (method === "ping") return kirim({ id, result: {} });
  if (method === "tools/list") {
    return kirim({ id, result: { tools: semuaAlat.map((a) => ({ name: a.nama, description: a.deskripsi, inputSchema: a.skema })) } });
  }
  if (method === "tools/call") {
    const alat = semuaAlat.find((a) => a.nama === params?.name);
    if (!alat) return kirim({ id, result: { content: [{ type: "text", text: `Alat tidak dikenal: ${params?.name}` }], isError: true } });
    try {
      const teks = await alat.jalankan(params?.arguments ?? {}, { base });
      return kirim({ id, result: { content: [{ type: "text", text: String(teks) }] } });
    } catch (e) {
      return kirim({ id, result: { content: [{ type: "text", text: `Galat: ${e.message}` }], isError: true } });
    }
  }
  if (id !== undefined) kirim({ id, error: { code: -32601, message: `Metode tidak dikenal: ${method}` } });
};

const rl = readline.createInterface({ input: process.stdin });
const berjalan = new Set();
rl.on("line", (baris) => {
  if (!baris.trim()) return;
  let m;
  try {
    m = JSON.parse(baris);
  } catch {
    return kirim({ id: null, error: { code: -32700, message: "JSON tidak valid" } });
  }
  const janji = tangani(m).catch((e) => m.id !== undefined && kirim({ id: m.id, error: { code: -32603, message: e.message } }));
  berjalan.add(janji);
  janji.finally(() => berjalan.delete(janji));
});
// Klien menutup stdin: selesaikan jawaban yang masih berjalan dulu.
rl.on("close", () => Promise.allSettled([...berjalan]).then(() => process.exit(0)));
