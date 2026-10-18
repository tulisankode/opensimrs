import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CATATAN_LANJUTAN, GalatKuota, JEDA_BAWAAN, JEDA_JARINGAN, JEDA_KREDIT, kenaliGalatKuota, konektorBerikutnya, lanjutPalingAwal, susunRantai, uraiWaktuReset, waktuLanjut,
} from "../src/agen/kuota.js";
import { SQL_KLAIM_TUNDA, klaimTundaJatuhTempo } from "../src/penjadwal.js";
import { STATUS_BERJALAN, alasanTidakLanjut } from "../src/alur.js";

// 18 Okt 2026 09.00 WIB (02.00 UTC).
const KINI = Date.UTC(2026, 9, 18, 2, 0);
const detik = (ms) => Math.floor(ms / 1000);

test("kenaliGalatKuota: Claude Code session limit dengan jam & zona dalam kurung", () => {
  const k = kenaliGalatKuota("You've hit your session limit · resets 11:10am (Asia/Jakarta)", KINI);
  assert.deepEqual(k, { penyedia: "claude_code", lanjutPada: detik(Date.UTC(2026, 9, 18, 4, 10)), diketahui: true, kredit: false, jaringan: false });
});

test("kenaliGalatKuota: jam yang sudah lewat hari ini → besok; tanpa zona = Asia/Jakarta", () => {
  const k = kenaliGalatKuota("You've hit your usage limit · resets 3:50am", KINI);
  assert.equal(k.lanjutPada, detik(Date.UTC(2026, 9, 18, 20, 50))); // 19 Okt 03.50 WIB
  assert.equal(k.diketahui, true);
  // 12am = tengah malam berikutnya
  assert.equal(uraiWaktuReset("Claude usage limit · resets 12am", KINI), detik(Date.UTC(2026, 9, 18, 17, 0)));
});

test("kenaliGalatKuota: zona waktu lain (IANA, UTC, singkatan WIB/WITA)", () => {
  // 02.00 UTC = 22.00 EDT 17 Okt → 11.10 EDT 18 Okt = 15.10 UTC
  assert.equal(kenaliGalatKuota("Session limit reached · resets 11:10am (America/New_York)", KINI).lanjutPada, detik(Date.UTC(2026, 9, 18, 15, 10)));
  assert.equal(kenaliGalatKuota("You've hit your session limit · resets 2pm (UTC)", KINI).lanjutPada, detik(Date.UTC(2026, 9, 18, 14, 0)));
  assert.equal(kenaliGalatKuota("You've hit your session limit, resets 11.10 WITA", KINI).lanjutPada, detik(Date.UTC(2026, 9, 18, 3, 10)));
  // Zona tidak dikenal → Asia/Jakarta
  assert.equal(kenaliGalatKuota("You've hit your session limit · resets 11:10am (Mars/Olympus)", KINI).lanjutPada, detik(Date.UTC(2026, 9, 18, 4, 10)));
});

test("kenaliGalatKuota: Codex usage limit — try again at jam / tanggal / durasi", () => {
  const a = kenaliGalatKuota("You've hit your usage limit. Upgrade to Pro (https://openai.com/chatgpt/pricing) or try again at 3:04 PM.", KINI);
  assert.equal(a.penyedia, "codex");
  assert.equal(a.lanjutPada, detik(Date.UTC(2026, 9, 18, 8, 4)));
  const b = kenaliGalatKuota("You've hit your usage limit. Try again at Oct 21st, 2026 3:04 PM.", KINI);
  assert.equal(b.lanjutPada, detik(Date.UTC(2026, 9, 21, 8, 4)));
  const c = kenaliGalatKuota("You've hit your usage limit. Upgrade to Plus or try again in 4 days 23 hours 59 minutes.", KINI);
  assert.equal(c.lanjutPada, detik(KINI) + 4 * 86400 + 23 * 3600 + 59 * 60);
  assert.equal(c.diketahui, true);
});

test("kenaliGalatKuota: format lama Claude (epoch setelah |)", () => {
  const reset = detik(Date.UTC(2026, 9, 18, 5, 0));
  assert.equal(kenaliGalatKuota(`Claude AI usage limit reached|${reset}`, KINI).lanjutPada, reset);
});

test("kenaliGalatKuota: konektor API 429/529 tanpa jam → 15 menit lagi", () => {
  for (const pesan of [
    "429 This request would exceed the rate limit for your organization",
    "429 rate_limit_error",
    "529 Overloaded",
    "API Error: 529 {\"type\":\"error\",\"error\":{\"type\":\"overloaded_error\"}}",
    "429 You exceeded your current quota, please check your plan (insufficient_quota)",
    "Too Many Requests",
  ]) {
    const k = kenaliGalatKuota(pesan, KINI);
    assert.ok(k, pesan);
    assert.equal(k.lanjutPada, detik(KINI) + JEDA_BAWAAN, pesan);
    assert.equal(k.diketahui, false, pesan);
  }
  assert.equal(kenaliGalatKuota("429 rate_limit_error", KINI).penyedia, "api");
});

test("kenaliGalatKuota: galat lain bukan kuota", () => {
  for (const pesan of [
    "",
    null,
    "Claude Code berhenti (kode 1)",
    "Batas biaya per tugas (US$ 5) tercapai",
    "Reached maximum budget limit",
    "Agen melebihi batas langkah",
    "Prompt is too long",
    "Galat sintaks di baris 429 berkas lab.js",
    "Konektor untuk tahap coding tidak ditemukan/nonaktif",
  ]) assert.equal(kenaliGalatKuota(pesan, KINI), null, String(pesan));
});

test("waktuLanjut menampilkan jam WIB, 'besok', atau tanggal", () => {
  assert.equal(waktuLanjut(detik(Date.UTC(2026, 9, 18, 4, 10)), KINI), "pukul 11.10 WIB");
  assert.equal(waktuLanjut(detik(Date.UTC(2026, 9, 18, 20, 50)), KINI), "besok pukul 03.50 WIB");
  assert.equal(waktuLanjut(detik(Date.UTC(2026, 9, 21, 8, 4)), KINI), "21 Okt pukul 15.04 WIB");
});

test("rantai cadangan: utama dulu, tanpa duplikat, konektor berikutnya yang belum dicoba", () => {
  assert.deepEqual(susunRantai(undefined, null), ["claude_code"]);
  assert.deepEqual(susunRantai("codex", ["claude_code", "codex", "", "uuid-api"]), ["codex", "claude_code", "uuid-api"]);
  const rantai = susunRantai("claude_code", ["uuid-api", "codex"]);
  const dicoba = new Set(["claude_code"]);
  assert.equal(konektorBerikutnya(rantai, dicoba), "uuid-api");
  dicoba.add("uuid-api");
  assert.equal(konektorBerikutnya(rantai, dicoba), "codex");
  dicoba.add("codex");
  assert.equal(konektorBerikutnya(rantai, dicoba), null);
});

test("GalatKuota: lanjut_pada = jam reset diketahui paling awal; tanpa jam diketahui = perkiraan paling awal", () => {
  const g = new GalatKuota([
    { nama: "Claude Code (langganan)", lanjutPada: 2000, diketahui: true },
    { nama: "Anthropic API", lanjutPada: 1500, diketahui: false },
    { nama: "Codex (langganan ChatGPT)", lanjutPada: 1800, diketahui: true },
  ]);
  assert.equal(g.kuota, true);
  assert.equal(g.lanjutPada, 1800);
  assert.match(g.message, /Claude Code.*Anthropic API.*Codex/);
  assert.equal(lanjutPalingAwal([{ lanjutPada: 900, diketahui: false }, { lanjutPada: 700, diketahui: false }]), 700);
  assert.equal(lanjutPalingAwal([]), null);
});

test("penjadwal: klaim tunda_kuota atomik lewat satu UPDATE ... WHERE status='tunda_kuota' RETURNING", async () => {
  const panggilan = [];
  // Klien tiruan meniru semantik UPDATE bersyarat: baris yang sudah diklaim tidak bisa diklaim lagi.
  const baris = [{ uuid: "a", status: "tunda_kuota", lanjut_pada: 100 }, { uuid: "b", status: "tunda_kuota", lanjut_pada: 999 }];
  const klien = {
    query: async (sql, params) => {
      panggilan.push({ sql, params });
      const kena = baris.filter((b) => b.status === "tunda_kuota" && b.lanjut_pada <= params[0]);
      for (const b of kena) b.status = "dilanjutkan";
      return { rows: kena.map((b) => ({ ...b })) };
    },
  };
  assert.match(SQL_KLAIM_TUNDA, /^UPDATE studio_tugas SET status = 'dilanjutkan'/);
  assert.match(SQL_KLAIM_TUNDA, /WHERE status = 'tunda_kuota' AND lanjut_pada IS NOT NULL AND lanjut_pada <= \$1 RETURNING \*/);
  const [pertama, kedua] = await Promise.all([klaimTundaJatuhTempo(500, klien), klaimTundaJatuhTempo(500, klien)]);
  assert.deepEqual([...pertama, ...kedua].map((t) => t.uuid), ["a"]);
  assert.deepEqual(panggilan[0].params, [500]);
});

test("tugas tersimpan tidak dilanjutkan bila item berubah", () => {
  const tugas = { tahap: "coding", jenis: "coding" };
  const item = { tahap: "coding", risiko: "sedang" };
  assert.equal(alasanTidakLanjut(item, tugas, { fitur: { coding: true } }, "development"), null);
  assert.match(alasanTidakLanjut(null, tugas, {}, "development"), /dihapus/);
  assert.match(alasanTidakLanjut({ ...item, tahap: "qa" }, tugas, {}, "development"), /tahap QA/);
  assert.match(alasanTidakLanjut({ ...item, tahap: "dibatalkan" }, tugas, {}, "development"), /dibatalkan/);
  assert.match(alasanTidakLanjut(item, tugas, {}, "production"), /produksi/);
  assert.match(alasanTidakLanjut(item, tugas, { fitur: { coding: false } }, "development"), /Coding dimatikan/);
  assert.equal(alasanTidakLanjut({ tahap: "prd" }, { tahap: "prd", jenis: "dokumen" }, {}, "production"), null);
  assert.ok(STATUS_BERJALAN.includes("tunda_kuota"));
  assert.ok(CATATAN_LANJUTAN.includes("git status/diff"));
});

test("kenaliGalatKuota: saldo kredit API habis → kredit, jeda 60 menit", () => {
  const kini = Date.UTC(2026, 9, 18, 4, 44);
  for (const pesan of [
    "400 Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.",
    "402 Payment Required",
    "billing_hard_limit_reached",
  ]) {
    const k = kenaliGalatKuota(pesan, kini);
    assert.equal(k?.kredit, true, pesan);
    assert.equal(k.penyedia, "api");
    assert.equal(k.lanjutPada, Math.floor(kini / 1000) + JEDA_KREDIT);
    assert.equal(k.diketahui, false);
  }
});

test("kenaliGalatKuota: rate limit token per menit organisasi API dikenali sebagai kuota", () => {
  const k = kenaliGalatKuota("429 This request would exceed your organization's rate limit of 500,000 input tokens per minute (org: contoh, model: claude-sonnet-5-5).", Date.UTC(2026, 9, 18, 4, 44));
  assert.equal(k?.kredit, false);
  assert.equal(k.penyedia, "api");
});

test("kenaliGalatKuota: galat jaringan sementara → beralih/tunda singkat; galat lain tetap null", () => {
  const kini = Date.UTC(2026, 9, 18, 7, 0);
  for (const pesan of ["fetch failed", "API Error: Connection lost mid-response. The response above may be incomplete.", "connect ECONNREFUSED 127.0.0.1:11434", "socket hang up"]) {
    const k = kenaliGalatKuota(pesan, kini);
    assert.equal(k?.jaringan, true, pesan);
    assert.equal(k.lanjutPada, Math.floor(kini / 1000) + JEDA_JARINGAN);
  }
  assert.equal(kenaliGalatKuota("SyntaxError: Unexpected token", kini), null);
  assert.equal(kenaliGalatKuota("Prompt is too long", kini), null);
});
