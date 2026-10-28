// Orkestrator agen: pilih konektor per tahap (Claude Code CLI langganan, Codex CLI langganan ChatGPT, atau konektor
// API), periksa batas biaya/kuota/
// laju, lalu jalankan. Semua adaptor mengembalikan { hasil, sessionId }.
// Tahan kuota: bila konektor gagal karena kuota/rate limit, coba konektor berikutnya dalam rantai cadangan
// (pengaturan konektor_cadangan); bila semuanya habis → GalatKuota (tugas ditunda & dilanjutkan otomatis oleh penjadwal).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import config from "../config.js";
import { query, satu, sekarang } from "../db.js";
import { Galat } from "../respons.js";
import { bacaSemua } from "../pengaturan.js";
import { daftarkanPembatal, jalankanClaude, lepaskanPembatal } from "./claude.js";
import { binCodebaseMemory } from "./petakode.js";
import { jalankanApi } from "./api.js";
import { jalankanCodex, modelCodex, pilihModelCodex } from "./codex.js";
import { cocokModel } from "./model.js";
import { CATATAN_LANJUTAN, GalatKuota, JEDA_BAWAAN, NAMA_BAWAAN, kenaliGalatKuota, konektorBerikutnya, susunRantai } from "./kuota.js";

// Lampiran permintaan disimpan di studio-service/data/lampiran/<item> (diabaikan git).
export const FOLDER_LAMPIRAN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "lampiran");

export const ambilKonektor = async (nilai, tahap) => {
  const pilihan = nilai.konektor_tahap?.[tahap] || "claude_code";
  if (pilihan === "claude_code") return { penyedia: "claude_code", nama: NAMA_BAWAAN.claude_code };
  if (pilihan === "codex") return { penyedia: "codex", nama: NAMA_BAWAAN.codex };
  const k = await satu(`SELECT * FROM studio_konektor WHERE uuid = $1 AND deleted_at IS NULL AND aktif`, [pilihan]);
  if (!k) throw new Galat(400, `Konektor untuk tahap ${tahap} tidak ditemukan/nonaktif — atur ulang di Pengaturan & Agen`);
  return k;
};

// Nama konektor untuk pesan ("claude_code" | "codex" | uuid konektor API).
export const namaKonektor = async (pilihan) => {
  if (NAMA_BAWAAN[pilihan]) return NAMA_BAWAAN[pilihan];
  const k = await satu(`SELECT nama FROM studio_konektor WHERE uuid::text = $1`, [String(pilihan)]).catch(() => null);
  return k?.nama ?? "konektor tidak dikenal";
};

// Batas biaya (bulan/item) — dilanggar → 429 ke pengguna.
const periksaBiaya = async (nilai, item) => {
  const awalBulan = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);
  if (nilai.batas_biaya_bulan != null && nilai.batas_biaya_bulan !== "") {
    const { total } = await satu(`SELECT COALESCE(SUM(biaya_usd), 0) AS total FROM studio_tugas WHERE created_at >= $1`, [awalBulan]);
    if (Number(total) >= Number(nilai.batas_biaya_bulan)) throw new Galat(429, `Batas biaya bulan ini (US$ ${nilai.batas_biaya_bulan}) tercapai`);
  }
  if (item && nilai.batas_biaya_item != null && nilai.batas_biaya_item !== "") {
    const { total } = await satu(`SELECT COALESCE(SUM(biaya_usd), 0) AS total FROM studio_tugas WHERE item_uuid = $1`, [item.uuid]);
    if (Number(total) >= Number(nilai.batas_biaya_item)) throw new Galat(429, `Batas biaya item ini (US$ ${nilai.batas_biaya_item}) tercapai`);
  }
};

// Kuota langganan Claude Code (rate_limit_event terakhir) sudah melewati batas_kuota_persen? → null atau
// { persen, lanjutPada }. Tidak lagi melempar 429: tugas memakai konektor cadangan atau ditunda sampai kuota reset.
export const kuotaClaudeHabis = async (nilai) => {
  if (!nilai.batas_kuota_persen) return null;
  const t = await satu(`SELECT kuota, updated_at FROM studio_tugas WHERE kuota IS NOT NULL ORDER BY updated_at DESC LIMIT 1`);
  const k = t?.kuota;
  if (k?.utilization == null) return null;
  // Tanpa resetsAt, data kuota dianggap usang setelah 1 jam (agar tugas tunda tidak terkunci selamanya).
  const belumReset = k.resetsAt ? Number(k.resetsAt) > sekarang() : sekarang() - Number(t.updated_at) < 3600;
  if (!belumReset || Number(k.utilization) * 100 < Number(nilai.batas_kuota_persen)) return null;
  return { persen: Math.round(Number(k.utilization) * 100), lanjutPada: k.resetsAt ? Number(k.resetsAt) : sekarang() + JEDA_BAWAAN };
};

// Pemeriksaan sebelum tugas agen dimulai (rancangan §10.3, §15). Kuota langganan diperiksa saat konektor dipilih
// (jalankanAgen), bukan di sini: kuota habis tidak menolak permintaan, melainkan beralih ke cadangan atau menunda tugas.
export const periksaBatas = async (item, pengguna) => {
  const { nilai } = await bacaSemua();
  await periksaBiaya(nilai, item);
  if (pengguna && nilai.batas_tugas_per_jam) {
    const { jumlah } = await satu(`SELECT COUNT(*)::int AS jumlah FROM studio_tugas WHERE dibuat_oleh = $1 AND created_at >= $2 AND jenis IN ('dokumen','coding')`, [pengguna, Math.floor(Date.now() / 1000) - 3600]);
    if (jumlah >= Number(nilai.batas_tugas_per_jam)) throw new Galat(429, `Batas ${nilai.batas_tugas_per_jam} tugas agen per jam tercapai`);
  }
};

const logTugas = (tugasUuid, jenis, teks) =>
  query(`INSERT INTO studio_tugas_log (tugas_uuid, jenis, teks, waktu) VALUES ($1, $2, $3, $4)`, [tugasUuid, jenis, String(teks).slice(0, 8000), sekarang()]).catch(() => {});

const statusTugas = async (tugasUuid) => (await satu(`SELECT status FROM studio_tugas WHERE uuid = $1`, [tugasUuid]))?.status;

// Jalankan satu konektor tertentu.
const jalankanKonektor = async (konektor, { tugasUuid, prompt, mode, model, base, item, sesiClaude, batasBiaya, petaKode }) => {
  // Peta kode codebase-memory (pengaturan codebase_memory) untuk semua agen: Claude Code, Codex, dan konektor API.
  const codebaseMemory = petaKode ? binCodebaseMemory() : null;
  if (konektor.penyedia === "codex") {
    return jalankanCodex({ tugasUuid, prompt, mode, model: pilihModelCodex(model, modelCodex()), base, codebaseMemory });
  }
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
      codebaseMemory,
    });
  }
  const pengendali = new AbortController();
  daftarkanPembatal(tugasUuid, pengendali);
  try {
    return await jalankanApi({ tugasUuid, prompt, mode, konektor, model, base, signal: pengendali.signal, batasBiaya, codebaseMemory });
  } catch (e) {
    if (pengendali.signal.aborted) throw new Error("Tugas dihentikan");
    throw e;
  } finally {
    lepaskanPembatal(tugasUuid);
  }
};

// Jalankan agen untuk satu tugas. beritahu(teks) = pesan sistem di diskusi item (mis. saat beralih konektor).
// Rantai hanya berisi konektor yang dikonfigurasi admin (utama tahap + konektor_cadangan), tidak memutar akun.
export const jalankanAgen = async ({ tugasUuid, prompt, mode, tahap, base = config.repoDir, item = null, resume = null, beritahu = null }) => {
  const { nilai } = await bacaSemua();
  const rantai = susunRantai(nilai.konektor_tahap?.[tahap], nilai.konektor_cadangan);
  const modelTahap = nilai.model_tahap?.[tahap] || "";
  const batasBiaya = nilai.batas_biaya_tugas ? Number(nilai.batas_biaya_tugas) : null;
  // Sesi Codex (codex:<thread>) tidak bisa dilanjutkan Claude Code, dan sebaliknya; Codex selalu memulai sesi baru.
  const sesiClaude = resume && !String(resume).startsWith("codex:") ? resume : null;
  const dicoba = new Set();
  const habis = [];
  let sudahJalan = false;

  for (let pilihan = rantai[0]; pilihan; pilihan = konektorBerikutnya(rantai, dicoba)) {
    const utama = dicoba.size === 0;
    dicoba.add(pilihan);
    if ((await statusTugas(tugasUuid)) === "dibatalkan") throw new Error("Tugas dihentikan");
    let konektor;
    try {
      konektor = await ambilKonektor({ konektor_tahap: { [tahap]: pilihan } }, tahap);
      // Konektor API cadangan tetap tunduk pada batas biaya bulan/item (bisa terlampaui selama tugas berjalan).
      if (!utama && !["claude_code", "codex"].includes(konektor.penyedia)) await periksaBiaya(nilai, item);
    } catch (e) {
      if (utama) throw e;
      await logTugas(tugasUuid, "galat", `Konektor cadangan "${await namaKonektor(pilihan)}" dilewati: ${e.message}`);
      continue;
    }

    let kuota = null;
    if (konektor.penyedia === "claude_code") {
      // Kuota langganan sudah melewati batas → Claude Code tidak dimulai; langsung cadangan / tunda.
      const k = await kuotaClaudeHabis(nilai);
      if (k) kuota = { lanjutPada: k.lanjutPada, diketahui: true, alasan: `pemakaian ${k.persen}%, batas ${nilai.batas_kuota_persen}%` };
    }
    if (!kuota) {
      // Data lama bisa berisi pasangan agen–model yang tidak cocok (mis. model Codex untuk Claude) → pakai bawaan agen.
      const model = cocokModel(pilihan, modelTahap) ? modelTahap : "";
      // Konektor sebelumnya sempat bekerja → worktree mungkin sudah berisi sebagian perubahan.
      const promptDipakai = mode === "coding" && sudahJalan && !prompt.includes(CATATAN_LANJUTAN) ? `${CATATAN_LANJUTAN}\n\n${prompt}` : prompt;
      if (!utama) await logTugas(tugasUuid, "info", `Memakai konektor cadangan ${konektor.nama}`);
      sudahJalan = true;
      try {
        const r = await jalankanKonektor(konektor, {
          tugasUuid, prompt: promptDipakai, mode, model, base, item, batasBiaya, petaKode: Boolean(nilai.codebase_memory?.aktif),
          // Sesi Claude hanya dilanjutkan oleh Claude Code.
          sesiClaude: konektor.penyedia === "claude_code" ? sesiClaude : null,
        });
        return { ...r, konektor: konektor.nama };
      } catch (e) {
        const dikenali = kenaliGalatKuota(e.message);
        if (!dikenali || (await statusTugas(tugasUuid)) === "dibatalkan") throw e;
        kuota = { ...dikenali, alasan: String(e.message).slice(0, 200) };
      }
    }

    habis.push({ pilihan, nama: konektor.nama, lanjutPada: kuota.lanjutPada, diketahui: kuota.diketahui });
    const berikut = konektorBerikutnya(rantai, dicoba);
    const jenisHabis = kuota.jaringan ? `Koneksi ke ${konektor.nama} gagal` : kuota.kredit ? `Saldo kredit ${konektor.nama} habis` : `Kuota ${konektor.nama} habis`;
    const teks = berikut ? `${jenisHabis} — beralih ke ${await namaKonektor(berikut)}` : jenisHabis;
    await logTugas(tugasUuid, "galat", `${teks} (${kuota.alasan})`);
    if (berikut && beritahu) await Promise.resolve(beritahu(`${teks}.`)).catch(() => {});
  }
  throw new GalatKuota(habis);
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
