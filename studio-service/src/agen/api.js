// Adaptor agen lewat API langsung (tanpa Claude Code CLI): Anthropic Messages API, OpenAI Chat Completions, dan
// endpoint kompatibel OpenAI (model lokal: Ollama, vLLM, LM Studio, dll.). Loop alat memakai src/agen/alat.js.
import { query, sekarang, ubah } from "../db.js";
import { dekripsi } from "../rahasia.js";
import { alatUntukMode, ringkasArgumen } from "./alat.js";
import { ATURAN_PLATFORM } from "./prompt.js";

const MAKS_LANGKAH = { dokumen: 30, coding: 80 };

const logTugas = (tugasUuid, jenis, teks) =>
  query(`INSERT INTO studio_tugas_log (tugas_uuid, jenis, teks, waktu) VALUES ($1, $2, $3, $4)`, [tugasUuid, jenis, String(teks).slice(0, 8000), sekarang()]).catch(() => {});

const hitungBiaya = (konektor, masuk, keluar) =>
  (Number(konektor.harga_masuk ?? 0) * masuk + Number(konektor.harga_keluar ?? 0) * keluar) / 1_000_000;

const panggil = async (url, headers, body, signal) => {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal });
  const teks = await r.text();
  let json;
  try {
    json = JSON.parse(teks);
  } catch {
    json = null;
  }
  if (!r.ok) throw new Error(`${r.status} ${json?.error?.message ?? teks.slice(0, 300)}`);
  return json;
};

const jalankanAlat = async (alat, nama, args, konteks, tugasUuid) => {
  const a = alat.find((x) => x.nama === nama);
  await logTugas(tugasUuid, "alat", ringkasArgumen(nama, args));
  if (!a) return { isi: `Alat tidak dikenal: ${nama}`, galat: true };
  try {
    return { isi: String(await a.jalankan(args ?? {}, konteks)), galat: false };
  } catch (e) {
    await logTugas(tugasUuid, "galat", `${nama}: ${e.message}`);
    return { isi: `Galat: ${e.message}`, galat: true };
  }
};

const loopAnthropic = async ({ konektor, model, prompt, alat, konteks, tugasUuid, batasBiaya }) => {
  const url = `${(konektor.endpoint || "https://api.anthropic.com").replace(/\/$/, "")}/v1/messages`;
  const headers = { "x-api-key": dekripsi(konektor.kunci_api), "anthropic-version": "2023-06-01" };
  const tools = alat.map((a) => ({ name: a.nama, description: a.deskripsi, input_schema: a.skema }));
  const messages = [{ role: "user", content: prompt }];
  let masuk = 0;
  let keluar = 0;
  for (let langkah = 0; langkah < MAKS_LANGKAH[konteks.mode]; langkah++) {
    const res = await panggil(url, headers, { model, max_tokens: 16000, system: ATURAN_PLATFORM, messages, tools }, konteks.signal);
    masuk += (res.usage?.input_tokens ?? 0) + (res.usage?.cache_read_input_tokens ?? 0) + (res.usage?.cache_creation_input_tokens ?? 0);
    keluar += res.usage?.output_tokens ?? 0;
    await ubah("studio_tugas", tugasUuid, { token_masuk: masuk, token_keluar: keluar, biaya_usd: hitungBiaya(konektor, masuk, keluar) }).catch(() => {});
    for (const c of res.content ?? []) if (c.type === "text" && c.text.trim()) await logTugas(tugasUuid, "teks", c.text.trim());
    if (res.stop_reason !== "tool_use") return (res.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
    if (batasBiaya && hitungBiaya(konektor, masuk, keluar) > batasBiaya) throw new Error(`Batas biaya per tugas (US$ ${batasBiaya}) tercapai`);
    messages.push({ role: "assistant", content: res.content });
    const hasil = [];
    for (const c of res.content.filter((x) => x.type === "tool_use")) {
      const r = await jalankanAlat(alat, c.name, c.input, konteks, tugasUuid);
      hasil.push({ type: "tool_result", tool_use_id: c.id, content: r.isi, is_error: r.galat });
    }
    messages.push({ role: "user", content: hasil });
  }
  throw new Error("Agen melebihi batas langkah");
};

const loopOpenAI = async ({ konektor, model, prompt, alat, konteks, tugasUuid, batasBiaya }) => {
  const dasar = (konektor.endpoint || "https://api.openai.com/v1").replace(/\/$/, "");
  const kunci = dekripsi(konektor.kunci_api);
  const headers = kunci ? { Authorization: `Bearer ${kunci}` } : {};
  const tools = alat.map((a) => ({ type: "function", function: { name: a.nama, description: a.deskripsi, parameters: a.skema } }));
  const messages = [
    { role: "system", content: ATURAN_PLATFORM },
    { role: "user", content: prompt },
  ];
  let masuk = 0;
  let keluar = 0;
  for (let langkah = 0; langkah < MAKS_LANGKAH[konteks.mode]; langkah++) {
    const res = await panggil(`${dasar}/chat/completions`, headers, { model, messages, tools }, konteks.signal);
    masuk += res.usage?.prompt_tokens ?? 0;
    keluar += res.usage?.completion_tokens ?? 0;
    await ubah("studio_tugas", tugasUuid, { token_masuk: masuk, token_keluar: keluar, biaya_usd: hitungBiaya(konektor, masuk, keluar) }).catch(() => {});
    const pesan = res.choices?.[0]?.message ?? {};
    if (pesan.content?.trim()) await logTugas(tugasUuid, "teks", pesan.content.trim());
    if (!pesan.tool_calls?.length) return pesan.content ?? "";
    if (batasBiaya && hitungBiaya(konektor, masuk, keluar) > batasBiaya) throw new Error(`Batas biaya per tugas (US$ ${batasBiaya}) tercapai`);
    messages.push(pesan);
    for (const c of pesan.tool_calls) {
      let args = {};
      try {
        args = JSON.parse(c.function?.arguments || "{}");
      } catch {
        args = {};
      }
      const r = await jalankanAlat(alat, c.function?.name, args, konteks, tugasUuid);
      messages.push({ role: "tool", tool_call_id: c.id, content: r.isi });
    }
  }
  throw new Error("Agen melebihi batas langkah");
};

// Dipanggil src/agen/index.js. signal = AbortController.signal untuk pembatalan.
export const jalankanApi = async ({ tugasUuid, prompt, mode, konektor, model, base, signal, batasBiaya }) => {
  const modelDipakai = model || konektor.model;
  if (!modelDipakai) throw new Error(`Konektor ${konektor.nama} belum menentukan model`);
  await ubah("studio_tugas", tugasUuid, { status: "jalan", mulai: sekarang(), model: modelDipakai });
  await logTugas(tugasUuid, "info", `Agen dimulai lewat ${konektor.nama} (${modelDipakai}, ${mode})`);
  const args = { konektor, model: modelDipakai, prompt, alat: alatUntukMode(mode), konteks: { base, signal, mode }, tugasUuid, batasBiaya };
  const hasil = konektor.penyedia === "anthropic" ? await loopAnthropic(args) : await loopOpenAI(args);
  return { hasil, sessionId: null };
};
