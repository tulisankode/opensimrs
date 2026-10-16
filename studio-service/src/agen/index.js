// Orkestrator agen: pilih konektor per tahap (Claude Code CLI langganan, Codex CLI langganan ChatGPT, atau konektor
// API), periksa batas biaya/kuota/
// laju, lalu jalankan. Semua adaptor mengembalikan { hasil, sessionId }.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import config from "../config.js";
import { query, satu } from "../db.js";
import { Galat } from "../respons.js";
import { bacaSemua } from "../pengaturan.js";
import { daftarkanPembatal, jalankanClaude, lepaskanPembatal } from "./claude.js";
import { jalankanApi } from "./api.js";
import { jalankanCodex } from "./codex.js";

// Lampiran permintaan disimpan di studio-service/data/lampiran/<item> (diabaikan git).
export const FOLDER_LAMPIRAN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "lampiran");

export const ambilKonektor = async (nilai, tahap) => {
  const pilihan = nilai.konektor_tahap?.[tahap] || "claude_code";
  if (pilihan === "claude_code") return { penyedia: "claude_code", nama: "Claude Code (langganan)" };
  if (pilihan === "codex") return { penyedia: "codex", nama: "Codex (langganan ChatGPT)" };
  const k = await satu(`SELECT * FROM studio_konektor WHERE uuid = $1 AND deleted_at IS NULL AND aktif`, [pilihan]);
  if (!k) throw new Galat(400, `Konektor untuk tahap ${tahap} tidak ditemukan/nonaktif — atur ulang di Pengaturan & Agen`);
  return k;
};

// Pemeriksaan sebelum tugas agen dimulai (rancangan §10.3, §15).
export const periksaBatas = async (item, pengguna) => {
  const { nilai } = await bacaSemua();
  const awalBulan = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);
  if (nilai.batas_biaya_bulan != null && nilai.batas_biaya_bulan !== "") {
    const { total } = await satu(`SELECT COALESCE(SUM(biaya_usd), 0) AS total FROM studio_tugas WHERE created_at >= $1`, [awalBulan]);
    if (Number(total) >= Number(nilai.batas_biaya_bulan)) throw new Galat(429, `Batas biaya bulan ini (US$ ${nilai.batas_biaya_bulan}) tercapai`);
  }
  if (item && nilai.batas_biaya_item != null && nilai.batas_biaya_item !== "") {
    const { total } = await satu(`SELECT COALESCE(SUM(biaya_usd), 0) AS total FROM studio_tugas WHERE item_uuid = $1`, [item.uuid]);
    if (Number(total) >= Number(nilai.batas_biaya_item)) throw new Galat(429, `Batas biaya item ini (US$ ${nilai.batas_biaya_item}) tercapai`);
  }
  if (nilai.batas_kuota_persen) {
    const t = await satu(`SELECT kuota, updated_at FROM studio_tugas WHERE kuota IS NOT NULL ORDER BY updated_at DESC LIMIT 1`);
    const k = t?.kuota;
    const belumReset = k?.resetsAt ? Number(k.resetsAt) > Date.now() / 1000 : true;
    if (k?.utilization != null && belumReset && Number(k.utilization) * 100 >= Number(nilai.batas_kuota_persen)) {
      throw new Galat(429, `Kuota langganan Claude sudah ${Math.round(k.utilization * 100)}% (batas ${nilai.batas_kuota_persen}%). Tunggu reset atau naikkan batas di Pengaturan.`);
    }
  }
  if (pengguna && nilai.batas_tugas_per_jam) {
    const { jumlah } = await satu(`SELECT COUNT(*)::int AS jumlah FROM studio_tugas WHERE dibuat_oleh = $1 AND created_at >= $2 AND jenis IN ('dokumen','coding')`, [pengguna, Math.floor(Date.now() / 1000) - 3600]);
    if (jumlah >= Number(nilai.batas_tugas_per_jam)) throw new Galat(429, `Batas ${nilai.batas_tugas_per_jam} tugas agen per jam tercapai`);
  }
};

// Jalankan agen untuk satu tugas.
export const jalankanAgen = async ({ tugasUuid, prompt, mode, tahap, base = config.repoDir, item = null, resume = null }) => {
  const { nilai } = await bacaSemua();
  const konektor = await ambilKonektor(nilai, tahap);
  const model = nilai.model_tahap?.[tahap] || "";
  const batasBiaya = nilai.batas_biaya_tugas ? Number(nilai.batas_biaya_tugas) : null;
  // Sesi Codex (codex:<thread>) tidak bisa dilanjutkan Claude Code, dan sebaliknya; Codex selalu memulai sesi baru.
  const sesiClaude = resume && !String(resume).startsWith("codex:") ? resume : null;
  if (konektor.penyedia === "codex") return jalankanCodex({ tugasUuid, prompt, mode, model, base });
  if (konektor.penyedia === "claude_code") {
    const lampiran = item ? path.join(FOLDER_LAMPIRAN, item.uuid) : null;
    return jalankanClaude({
      tugasUuid,
      prompt,
      mode,
      model,
      resume: sesiClaude,
      base,
      batasBiaya,
      folderTambahan: lampiran && fs.existsSync(lampiran) ? [lampiran] : [],
    });
  }
  const pengendali = new AbortController();
  daftarkanPembatal(tugasUuid, pengendali);
  try {
    return await jalankanApi({ tugasUuid, prompt, mode, konektor, model, base, signal: pengendali.signal, batasBiaya });
  } catch (e) {
    if (pengendali.signal.aborted) throw new Error("Tugas dihentikan");
    throw e;
  } finally {
    lepaskanPembatal(tugasUuid);
  }
};

// Estimasi biaya tugas (rata-rata 20 tugas terakhir yang selesai dengan jenis/tahap sama) — rancangan NF-5.
export const estimasiBiaya = async (jenis, tahap) => {
  const rows = await query(
    `SELECT biaya_usd, EXTRACT(EPOCH FROM INTERVAL '1 second') * (selesai - mulai) AS durasi FROM studio_tugas
      WHERE jenis = $1 AND tahap = $2 AND status = 'selesai' AND mulai IS NOT NULL AND selesai IS NOT NULL ORDER BY id DESC LIMIT 20`,
    [jenis, tahap],
  );
  if (!rows.length) return null;
  const rata = (k) => rows.reduce((t, r) => t + Number(r[k] ?? 0), 0) / rows.length;
  return { biayaUsd: Number(rata("biaya_usd").toFixed(2)), durasiDetik: Math.round(rata("durasi")), sampel: rows.length };
};
