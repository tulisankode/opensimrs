<script setup lang="ts">
// Pengaturan SIMRS Studio (superadmin): fitur, kill switch, agen (Claude Code langganan + konektor API), konektor & model
// per tahap, rantai cadangan saat kuota habis, batas agen bersamaan, batas biaya/kuota/laju, integrasi Git, kunci penanda
// tangan ekstensi, aturan instalasi.
import { computed, onMounted, onUnmounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { apiStudioGet, apiStudioPost, apiStudioPut, apiEkstensi } from "@/utils/apiHandler";
import { useSimrsStudioStore } from "@/stores/simrsStudio";
import { useModulFaskesStore } from "@/stores/modulFaskes";
import { TAHAP, formatUsd, formatWaktu, ringkasKuota } from "../umum";

const studio = useSimrsStudioStore();
const sistem = ref<any>(null);
const nilai = ref<any>(null);
const peran = ref<Record<string, any>>({});
const konektor = ref<any[]>([]);
const menyimpan = ref(false);

const aplikasi = ref<any>(null);

const muat = async () => {
  const [a, b, c, d] = await Promise.all([apiStudioGet("/sistem"), apiStudioGet("/pengaturan"), apiStudioGet("/konektor", true), apiStudioGet("/aplikasi", true)]);
  sistem.value = a?.payload ?? null;
  nilai.value = b?.payload?.nilai ?? null;
  peran.value = b?.payload?.peran ?? {};
  konektor.value = c?.payload ?? [];
  aplikasi.value = d?.payload ?? null;
  muatAkunClaude();
  muatAkunCodex();
  if (nilai.value) {
    nilai.value.konektorTahap ??= {};
    nilai.value.modelTahap ??= {};
    if (!Array.isArray(nilai.value.konektorCadangan)) nilai.value.konektorCadangan = [];
  }
};
onMounted(muat);

const kuota = computed(() => ringkasKuota(hasilUji.value?.tugas?.kuota ?? sistem.value?.kuota));

const simpan = async () => {
  menyimpan.value = true;
  const { modePengembang, killSwitch, ekstensiKunciPrivat, ekstensiKunciPublik, ...ubah } = nilai.value;
  void modePengembang;
  void killSwitch;
  void ekstensiKunciPrivat;
  void ekstensiKunciPublik;
  await apiStudioPut("/pengaturan", ubah);
  menyimpan.value = false;
  await muat();
  studio.muat();
};

// ---------- Akun Claude Code (login lewat peramban, tanpa terminal) ----------
const akunClaude = ref<any>(null);
const prosesAkun = ref(false);
const dialogLoginClaude = ref(false);
const urlLoginClaude = ref("");
const kodeClaude = ref("");
let pantauLogin: ReturnType<typeof setInterval> | undefined;

const muatAkunClaude = async () => {
  const res = await apiStudioGet("/pengaturan/akun-claude", true);
  akunClaude.value = res?.payload?.akun ?? akunClaude.value;
  return res?.payload;
};
const hentikanPantau = () => {
  if (pantauLogin) clearInterval(pantauLogin);
  pantauLogin = undefined;
};
const mulaiLoginClaude = async () => {
  // Tab dibuka sebelum menunggu server agar tidak diblokir pemblokir pop-up, lalu diarahkan ke URL login.
  const tab = window.open("about:blank", "_blank");
  prosesAkun.value = true;
  try {
    const res = await apiStudioPost("/pengaturan/akun-claude/login", {}, true);
    const url = res?.payload?.url;
    if (!url) {
      tab?.close();
      return;
    }
    urlLoginClaude.value = url;
    if (tab) tab.location.href = url;
    kodeClaude.value = "";
    dialogLoginClaude.value = true;
    // Bila CLI menyelesaikan login tanpa kode (mis. callback lokal), dialog tertutup sendiri.
    hentikanPantau();
    pantauLogin = setInterval(async () => {
      const p = await muatAkunClaude();
      if (p?.login?.selesai) {
        hentikanPantau();
        if (p.login.ok) dialogLoginClaude.value = false;
      }
    }, 4000);
  } finally {
    prosesAkun.value = false;
  }
};
const kirimKodeClaude = async () => {
  if (!kodeClaude.value.trim()) return;
  prosesAkun.value = true;
  try {
    const res = await apiStudioPost("/pengaturan/akun-claude/kode", { kode: kodeClaude.value.trim() });
    if (res?.payload) {
      akunClaude.value = res.payload;
      hentikanPantau();
      dialogLoginClaude.value = false;
    }
  } finally {
    prosesAkun.value = false;
  }
};
const tutupLoginClaude = async () => {
  hentikanPantau();
  kodeClaude.value = "";
  const p = await muatAkunClaude();
  if (p?.login?.berjalan) await apiStudioPost("/pengaturan/akun-claude/batal", {}, true);
};
const keluarClaude = async () => {
  if (!window.confirm("Putuskan akun Claude? Agen Studio dan Claude Code di VS Code pada komputer ini perlu login lagi.")) return;
  prosesAkun.value = true;
  try {
    const res = await apiStudioPost("/pengaturan/akun-claude/keluar", {});
    if (res?.payload) akunClaude.value = res.payload;
  } finally {
    prosesAkun.value = false;
  }
};
onUnmounted(hentikanPantau);

// ---------- Akun Codex (langganan ChatGPT, login kode perangkat) ----------
const akunCodex = ref<any>(null);
// Model yang tersedia untuk akun Codex yang login (dari cache daftar model Codex).
const modelCodex = ref<Array<{ kode: string; nama: string; deskripsi: string }>>([]);
const prosesCodex = ref(false);
const loginCodex = ref<any>(null); // { url, kode }
let pantauCodex: ReturnType<typeof setInterval> | undefined;

const muatAkunCodex = async () => {
  const res = await apiStudioGet("/pengaturan/akun-codex", true);
  akunCodex.value = res?.payload?.akun ?? akunCodex.value;
  modelCodex.value = res?.payload?.model ?? modelCodex.value;
  return res?.payload;
};
const hentikanPantauCodex = () => {
  if (pantauCodex) clearInterval(pantauCodex);
  pantauCodex = undefined;
};
const mulaiLoginCodex = async () => {
  prosesCodex.value = true;
  try {
    const res = await apiStudioPost("/pengaturan/akun-codex/login", {}, true);
    if (!res?.payload?.kode) return;
    loginCodex.value = res.payload;
    window.open(res.payload.url, "_blank", "noopener");
    // CLI selesai sendiri setelah kode disetujui di halaman OpenAI.
    hentikanPantauCodex();
    pantauCodex = setInterval(async () => {
      const p = await muatAkunCodex();
      if (p?.login?.selesai || !p?.login?.berjalan) {
        hentikanPantauCodex();
        if (p?.akun?.masuk) loginCodex.value = null;
      }
    }, 4000);
  } finally {
    prosesCodex.value = false;
  }
};
const tutupLoginCodex = async () => {
  hentikanPantauCodex();
  loginCodex.value = null;
  const p = await muatAkunCodex();
  if (p?.login?.berjalan) await apiStudioPost("/pengaturan/akun-codex/batal", {}, true);
};
const keluarCodex = async () => {
  if (!window.confirm("Putuskan akun Codex? Agen Codex perlu dihubungkan lagi sebelum dipakai.")) return;
  prosesCodex.value = true;
  try {
    const res = await apiStudioPost("/pengaturan/akun-codex/keluar", {});
    if (res?.payload) akunCodex.value = res.payload;
  } finally {
    prosesCodex.value = false;
  }
};
onUnmounted(hentikanPantauCodex);

// Repo utama (aplikasi yang dijalankan npm run dev) dipindah ke branch lokal agar hasil penerapan langsung terlihat.
const pindahkanAplikasi = async () => {
  menyimpan.value = true;
  try {
    if (await apiStudioPost("/aplikasi/pindah", {})) await useModulFaskesStore().segarkanSesi().catch(() => {});
  } finally {
    menyimpan.value = false;
    await muat();
  }
};

// Kill switch
const alasanHenti = ref("");
const killSwitch = async (aktif: boolean) => {
  if (await apiStudioPost("/pengaturan/kill-switch", { aktif, alasan: alasanHenti.value || null })) {
    alasanHenti.value = "";
    await muat();
    studio.muat();
  }
};

// Uji koneksi agen
const menguji = ref<string | null>(null);
const hasilUji = ref<any>(null);
const ujiTerakhir = ref<string | null>(null);
const uji = async (k: string) => {
  menguji.value = k;
  hasilUji.value = (await apiStudioPost("/konektor/uji", { konektor: k }))?.payload ?? null;
  ujiTerakhir.value = k;
  menguji.value = null;
};

// Konektor API
// Penyedia siap pakai: semuanya lewat API kompatibel OpenAI kecuali Anthropic & OpenAI. Model = contoh (nama terbaru
// bisa berubah; cek situs penyedia).
const PRESET_KONEKTOR = [
  { kode: "anthropic", nama: "Anthropic API (Claude)", penyedia: "anthropic", endpoint: "", model: ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"], kunci: "https://console.anthropic.com/settings/keys" },
  { kode: "openai", nama: "OpenAI API (GPT)", penyedia: "openai", endpoint: "", model: [], kunci: "https://platform.openai.com/api-keys" },
  { kode: "deepseek", nama: "DeepSeek", penyedia: "openai_kompatibel", endpoint: "https://api.deepseek.com/v1", model: ["deepseek-chat", "deepseek-reasoner"], kunci: "https://platform.deepseek.com/api_keys" },
  { kode: "qwen", nama: "Qwen (Alibaba Model Studio)", penyedia: "openai_kompatibel", endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", model: ["qwen3-coder-plus", "qwen-plus", "qwen-max"], kunci: "https://modelstudio.console.alibabacloud.com/" },
  { kode: "grok", nama: "Grok (xAI)", penyedia: "openai_kompatibel", endpoint: "https://api.x.ai/v1", model: ["grok-4", "grok-code-fast-1"], kunci: "https://console.x.ai/" },
  { kode: "gemini", nama: "Google Gemini", penyedia: "openai_kompatibel", endpoint: "https://generativelanguage.googleapis.com/v1beta/openai", model: ["gemini-2.5-pro", "gemini-2.5-flash"], kunci: "https://aistudio.google.com/apikey" },
  { kode: "mistral", nama: "Mistral", penyedia: "openai_kompatibel", endpoint: "https://api.mistral.ai/v1", model: ["mistral-large-latest", "codestral-latest"], kunci: "https://console.mistral.ai/api-keys" },
  { kode: "openrouter", nama: "OpenRouter (banyak model)", penyedia: "openai_kompatibel", endpoint: "https://openrouter.ai/api/v1", model: ["deepseek/deepseek-chat", "qwen/qwen3-coder", "x-ai/grok-4"], kunci: "https://openrouter.ai/keys" },
  { kode: "groq", nama: "Groq (inferensi cepat)", penyedia: "openai_kompatibel", endpoint: "https://api.groq.com/openai/v1", model: ["llama-3.3-70b-versatile", "qwen/qwen3-32b"], kunci: "https://console.groq.com/keys" },
  { kode: "ollama", nama: "Ollama (model lokal di RS)", penyedia: "openai_kompatibel", endpoint: "http://localhost:11434/v1", model: ["qwen3:8b", "gpt-oss:20b", "qwen3-coder:30b"], kunci: "" },
];
const presetDipilih = ref("");
const presetKonektor = computed(() => PRESET_KONEKTOR.find((p) => p.kode === presetDipilih.value) ?? null);
const pakaiPreset = () => {
  const p = presetKonektor.value;
  if (!p) return;
  Object.assign(formKonektor.value, { nama: p.nama, penyedia: p.penyedia, endpoint: p.endpoint, model: p.model[0] ?? "" });
};
// Nama penyedia untuk daftar konektor: dikenali dari endpoint preset.
const namaPenyedia = (k: any) =>
  (k.endpoint && PRESET_KONEKTOR.find((p) => p.endpoint && k.endpoint.replace(/\/$/, "") === p.endpoint)?.nama) || PENYEDIA[k.penyedia] || k.penyedia;

const dialogKonektor = ref(false);
const formKonektor = ref<any>({});
const bukaKonektor = (k?: any) => {
  formKonektor.value = k ? { ...k, kunciApi: k.kunciApi ? "••••••••" : "" } : { nama: "", penyedia: "anthropic", endpoint: "", model: "", kunciApi: "", hargaMasuk: "", hargaKeluar: "", aktif: true };
  presetDipilih.value = k ? (PRESET_KONEKTOR.find((p) => p.endpoint && k.endpoint?.replace(/\/$/, "") === p.endpoint)?.kode ?? "") : "";
  dialogKonektor.value = true;
};
const simpanKonektor = async () => {
  const f = formKonektor.value;
  const res = f.uuid ? await apiStudioPut(`/konektor/${f.uuid}`, f) : await apiStudioPost("/konektor", f);
  if (res) {
    dialogKonektor.value = false;
    muat();
  }
};
const hapusKonektor = async (k: any) => {
  if (await apiEkstensi("studio", "delete", `/konektor/${k.uuid}`)) muat();
};

// Git
const ujiGit = ref<any>(null);
const cobaGit = async () => {
  await simpan();
  ujiGit.value = (await apiStudioPost("/pengaturan/git/uji", {}))?.payload ?? null;
};

// Kunci ekstensi
const kunciPublik = ref<string>("");
const siapkanKunci = async (baru = false) => {
  kunciPublik.value = (await apiStudioPost("/pengaturan/kunci-ekstensi", { baru }))?.payload?.kunciPublik ?? "";
};
const salin = (teks: string) => navigator.clipboard?.writeText(teks);

const MODEL_CLAUDE = [
  { kode: "claude-opus-5-5", nama: "Opus 5.5 (terkuat)" },
  { kode: "claude-sonnet-5-5", nama: "Sonnet 5.5 (seimbang)" },
  { kode: "claude-haiku-5-5", nama: "Haiku 5.5 (cepat & hemat)" },
];
// Agen per tahap: jenis (claude_code | codex | api), model konektor API, dan peringatan bila agen belum siap.
const agenTahap = (tahap: string) => {
  const pilihan = nilai.value?.konektorTahap?.[tahap];
  if (!pilihan) return { jenis: "claude_code", peringatan: akunClaude.value?.masuk === false ? "Akun Claude belum terhubung." : "" };
  if (pilihan === "codex") return { jenis: "codex", peringatan: akunCodex.value && !akunCodex.value.masuk ? "Akun Codex belum terhubung." : "" };
  const k = konektor.value.find((x) => x.uuid === pilihan);
  return { jenis: "api", model: k?.model, peringatan: !k ? "Konektor tidak ditemukan." : !k.aktif ? "Konektor nonaktif." : "" };
};
const TAHAP_AGEN = [...TAHAP.map((t) => ({ kode: t.kode, nama: t.nama })), { kode: "ekstensi", nama: "Ekstensi" }];

// ---------- Rantai cadangan konektor (saat kuota konektor tahap habis) ----------
const namaCadangan = (kode: string) => {
  if (kode === "claude_code") return "Claude Code (langganan)";
  if (kode === "codex") return "Codex (langganan ChatGPT)";
  const k = konektor.value.find((x) => x.uuid === kode);
  return k ? `${k.nama} (${k.model})${k.aktif ? "" : " — nonaktif"}` : "Konektor tidak ditemukan";
};
const pilihanCadangan = computed(() =>
  [
    { kode: "claude_code", nama: "Claude Code (langganan)" },
    { kode: "codex", nama: "Codex (langganan ChatGPT)" },
    ...konektor.value.filter((x) => x.aktif).map((x) => ({ kode: x.uuid, nama: `${x.nama} (${x.model})` })),
  ].filter((p) => !(nilai.value?.konektorCadangan ?? []).includes(p.kode)),
);
const tambahCadangan = ref("");
const tambahkanCadangan = () => {
  if (!tambahCadangan.value) return;
  nilai.value.konektorCadangan = [...nilai.value.konektorCadangan, tambahCadangan.value];
  tambahCadangan.value = "";
};
const geserCadangan = (i: number, arah: number) => {
  const daftar = [...nilai.value.konektorCadangan];
  [daftar[i], daftar[i + arah]] = [daftar[i + arah], daftar[i]];
  nilai.value.konektorCadangan = daftar;
};
const hapusCadangan = (i: number) => {
  nilai.value.konektorCadangan = nilai.value.konektorCadangan.filter((_: string, j: number) => j !== i);
};
const FITUR = [
  { kode: "desain", nama: "Desain teknis", ket: "Bila mati, PRD langsung ke coding" },
  { kode: "coding", nama: "Coding agen", ket: "Agen menulis kode di branch kerja (mati bawaan)" },
  { kode: "qa", nama: "QA", ket: "Cek otomatis, rencana & checklist uji" },
  { kode: "rilis", nama: "Rilis", ket: "Commit, push, PR, status CI & tag" },
  { kode: "ekstensi", nama: "Ekstensi tanpa kode", ket: "Laporan, template cetak, formulir (mati bawaan)" },
];
const PENYEDIA: Record<string, string> = { anthropic: "Anthropic API", openai: "OpenAI API", openai_kompatibel: "Model lokal / kompatibel OpenAI" };
</script>

<template>
  <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full" class="h-full">
    <template #header>
      <PageToolbar>
        <h1 class="toolbar-heading text-opensimrs-300">Pengaturan & Agen</h1>
        <CustomButton label="Simpan" icon="PhFloppyDisk" :disabled="!nilai || menyimpan" @click="simpan" />
      </PageToolbar>
    </template>
    <template #content>
      <div v-if="!studio.status.superadmin" class="rounded-lg bg-warning-50 p-3 text-XS text-warning-400">Hanya superadmin yang dapat mengubah pengaturan Studio.</div>
      <template v-else-if="nilai">
        <!-- Kill switch -->
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3" :class="nilai.killSwitch?.aktif ? 'border-danger-300 bg-danger-50' : 'border-danger-75'">
          <div class="text-SM text-danger-400">
            <div class="font-semibold">{{ nilai.killSwitch?.aktif ? "Studio DIHENTIKAN" : "Hentikan Studio (kill switch)" }}</div>
            <div class="text-XS">
              {{ nilai.killSwitch?.aktif ? `Alasan: ${nilai.killSwitch.alasan ?? "-"}. Semua item hanya-baca.` : "Membatalkan semua tugas agen dan membekukan semua item (hanya-baca) sampai dibuka kembali." }}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <input v-if="!nilai.killSwitch?.aktif" v-model="alasanHenti" class="rounded border border-grey-200 px-2 py-1 text-XS" placeholder="Alasan (opsional)" />
            <CustomButton v-if="!nilai.killSwitch?.aktif" label="Hentikan sekarang" icon="PhStop" outlined text-color="text-danger-300" border-color="border-danger-300" @click="killSwitch(true)" />
            <CustomButton v-else label="Buka kembali Studio" icon="PhPlay" @click="killSwitch(false)" />
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <!-- Fitur -->
          <div class="flex flex-col gap-2 rounded-lg bg-opensimrs-50 p-4 text-SM text-grey-500">
            <div class="font-semibold text-opensimrs-300">Fitur Studio</div>
            <label v-for="f in FITUR" :key="f.kode" class="flex items-start gap-2">
              <input v-model="nilai.fitur[f.kode]" type="checkbox" class="mt-1" />
              <span><b>{{ f.nama }}</b> <span class="text-XS text-grey-400">— {{ f.ket }}</span></span>
            </label>
            <hr class="border-white" />
            <label class="flex items-start gap-2">
              <input v-model="nilai.pemisahanTugas" type="checkbox" class="mt-1" />
              <span><b>Pemisahan tugas</b> <span class="text-XS text-grey-400">— pengusul/penyunting tidak boleh menjadi penyetuju (risiko ≥ sedang); satu orang satu gerbang per tahap</span></span>
            </label>
            <div class="flex flex-col gap-1">
              <span class="text-XS font-semibold">Mode kerja agen coding</span>
              <label class="flex items-start gap-2 text-XS"><input v-model="nilai.modeKerja" type="radio" value="workspace" class="mt-0.5" /> <span><b>Workspace</b> — langsung di working tree repo; <code>npm run dev</code> menjadi pratinjau (satu item coding sekaligus).</span></label>
              <label class="flex items-start gap-2 text-XS"><input v-model="nilai.modeKerja" type="radio" value="worktree" class="mt-0.5" /> <span><b>Worktree</b> — salinan terpisah per item (working tree Anda tidak tersentuh; beberapa item paralel).</span></label>
              <input v-if="nilai.modeKerja === 'worktree'" v-model="nilai.direktoriWorktree" class="rounded border border-grey-200 bg-white px-2 py-1 font-mono text-XS" placeholder="Folder worktree (bawaan C:\simrs-studio) — pakai path pendek" />
            </div>
          </div>

          <!-- Agen langganan: Claude Code & Codex, satu baris per agen -->
          <div class="flex flex-col gap-2 rounded-lg border border-grey-200 p-4">
            <div class="font-semibold text-opensimrs-300">Agen langganan</div>
            <div class="text-XS text-grey-400">
              Dijalankan di mesin ini dengan login akun Anda; pemakaian dihitung ke kuota langganan. Pilih per tahap di tabel di bawah. Perubahan agen pada zona terlarang
              (<code>.env</code>, <code>studio-service/</code>, SDK izin, <code>.github/</code>, <code>deploy/</code>) dikembalikan otomatis.
            </div>
            <!-- Claude Code (claude -p, login sama dengan Claude Code di VS Code) -->
            <div class="flex flex-wrap items-center gap-2 rounded-lg bg-opensimrs-50 p-2 text-XS text-grey-500">
              <PhTerminalWindow :size="20" weight="duotone" class="text-opensimrs-300" aria-hidden="true" />
              <span class="min-w-0 flex-1">
                <b>Claude Code</b>
                <span class="text-grey-400"> · {{ sistem?.claude?.terpasang ? sistem.claude.versi : sistem?.claude?.pesan ?? "memuat…" }}</span>
                <span :class="akunClaude?.masuk ? 'text-success-400' : 'text-grey-400'"> · 
                  <template v-if="!akunClaude">memeriksa akun…</template>
                  <template v-else-if="!akunClaude.terpasang">CLI belum terpasang</template>
                  <template v-else-if="akunClaude.masuk">{{ akunClaude.email ?? "terhubung" }}<template v-if="akunClaude.paket"> ({{ akunClaude.paket }})</template></template>
                  <template v-else>belum terhubung</template>
                </span>
                <span v-if="kuota" :class="(kuota.persen ?? 0) >= 90 ? 'text-danger-300' : (kuota.persen ?? 0) >= 75 ? 'text-warning-400' : 'text-grey-400'" :title="kuota.reset ? `Direset ${kuota.reset}` : ''"> · kuota {{ kuota.persen ?? "-" }}%</span>
              </span>
              <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Uji" outlined icon="PhPulse" :disabled="!!menguji" @click="uji('claude_code')" />
              <template v-if="akunClaude?.terpasang">
                <CustomButton :label="akunClaude.masuk ? 'Ganti akun' : 'Hubungkan'" icon="PhSignIn" :outlined="akunClaude.masuk" :text-color="akunClaude.masuk ? 'text-opensimrs-300' : ''" :border-color="akunClaude.masuk ? 'border-opensimrs-300' : ''" :disabled="prosesAkun" @click="mulaiLoginClaude" />
                <CustomButton v-if="akunClaude.masuk" icon="PhSignOut" outlined text-color="text-danger-300" border-color="border-danger-300" :disabled="prosesAkun" title="Putuskan akun Claude" @click="keluarClaude" />
              </template>
            </div>
            <!-- Codex (codex exec dengan sandbox: dokumen hanya-baca; coding hanya folder kerja, tanpa jaringan) -->
            <div class="flex flex-wrap items-center gap-2 rounded-lg bg-opensimrs-50 p-2 text-XS text-grey-500">
              <PhTerminal :size="20" weight="duotone" class="text-opensimrs-300" aria-hidden="true" />
              <span class="min-w-0 flex-1">
                <b>Codex</b>
                <span class="text-grey-400"> · {{ sistem?.codex?.terpasang ? sistem.codex.versi : sistem?.codex ? "belum terpasang: npm i -g @openai/codex" : "memuat…" }}</span>
                <span :class="akunCodex?.masuk ? 'text-success-400' : 'text-grey-400'"> · 
                  <template v-if="!akunCodex">memeriksa akun…</template>
                  <template v-else-if="!akunCodex.terpasang">CLI belum terpasang</template>
                  <template v-else-if="akunCodex.masuk">{{ akunCodex.metode === "api_key" ? "kunci API OpenAI" : "akun ChatGPT" }}</template>
                  <template v-else>belum terhubung</template>
                </span>
              </span>
              <CustomButton v-if="akunCodex?.masuk" text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Uji" outlined icon="PhPulse" :disabled="!!menguji" @click="uji('codex')" />
              <template v-if="akunCodex?.terpasang">
                <CustomButton :label="akunCodex.masuk ? 'Ganti akun' : 'Hubungkan'" icon="PhSignIn" :outlined="akunCodex.masuk" :text-color="akunCodex.masuk ? 'text-opensimrs-300' : ''" :border-color="akunCodex.masuk ? 'border-opensimrs-300' : ''" :disabled="prosesCodex" @click="mulaiLoginCodex" />
                <CustomButton v-if="akunCodex.masuk" icon="PhSignOut" outlined text-color="text-danger-300" border-color="border-danger-300" :disabled="prosesCodex" title="Putuskan akun Codex" @click="keluarCodex" />
              </template>
            </div>
            <!-- Peta kode: codebase-memory-mcp dipasang sebagai server MCP agen Claude Code -->
            <div class="flex flex-wrap items-center gap-2 rounded-lg bg-opensimrs-50 p-2 text-XS text-grey-500">
              <PhGraph :size="20" weight="duotone" class="text-opensimrs-300" aria-hidden="true" />
              <span class="min-w-0 flex-1">
                <b>Peta kode (codebase-memory)</b>
                <span class="text-grey-400"> · {{ sistem?.codebaseMemory?.terpasang ? sistem.codebaseMemory.versi : sistem?.codebaseMemory ? sistem.codebaseMemory.pesan : "memuat…" }}</span>
                <div class="text-[11px] text-grey-400">
                  Agen (Claude Code, Codex, dan konektor API) mengindeks repo, menelusuri graph kode (arsitektur, pemanggil, dampak) sebelum mencari berkas, dan mencatat
                  keputusan arsitektur per modul agar pengembangan modul berikutnya lebih terarah. Indeks & catatan disimpan di cache codebase-memory mesin ini, bukan di repo.
                </div>
              </span>
              <label v-if="nilai.codebaseMemory" class="flex items-center gap-2" :title="sistem?.codebaseMemory?.terpasang ? '' : 'Pasang codebase-memory-mcp atau isi STUDIO_CODEBASE_MEMORY_BIN'">
                <input v-model="nilai.codebaseMemory.aktif" type="checkbox" :disabled="!sistem?.codebaseMemory?.terpasang && !nilai.codebaseMemory.aktif" /> Aktif
              </label>
            </div>
            <div v-if="hasilUji && ujiTerakhir === 'claude_code'" class="text-XS text-success-400">✔ {{ hasilUji.hasil }} ({{ hasilUji.tugas?.model }}, ≈ {{ formatUsd(hasilUji.tugas?.biayaUsd) }})</div>
            <div v-if="hasilUji && ujiTerakhir === 'codex'" class="text-XS text-success-400">✔ {{ hasilUji.hasil }} ({{ hasilUji.tugas?.model }})</div>
            <div class="text-XS text-grey-400">Repo <code>{{ sistem?.repoDir }}</code> · branch <b>{{ sistem?.branch }}</b> · lingkungan <b>{{ sistem?.lingkungan }}</b><template v-if="kuota?.reset"> · kuota Claude direset {{ kuota.reset }}</template></div>
          </div>
        </div>

        <!-- Konektor API -->
        <div class="mt-3 rounded-lg border border-grey-200 p-4">
          <div class="mb-2 flex items-center justify-between">
            <div class="font-semibold text-opensimrs-300">Konektor API (opsional)</div>
            <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Tambah konektor" icon="PhPlus" outlined @click="bukaKonektor()" />
          </div>
          <div class="mb-2 text-XS text-grey-400">Anthropic, OpenAI, DeepSeek, Qwen, Grok, Gemini, Mistral, OpenRouter, Groq (pilih di <b>Penyedia siap pakai</b>), atau model lokal yang kompatibel OpenAI (Ollama, vLLM, LM Studio) untuk faskes yang tidak boleh mengirim data keluar. Dibayar per pemakaian API. Agen eksternal (mis. OpenClaw) tersambung lewat server MCP OpenSIMRS — lihat panduan.</div>
          <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div v-for="k in konektor" :key="k.uuid" class="flex items-center justify-between gap-2 rounded-lg bg-grey-50 p-2 text-XS">
              <div>
                <div class="font-semibold text-grey-500">{{ k.nama }} <span v-if="!k.aktif" class="text-grey-300">(nonaktif)</span></div>
                <div class="text-grey-400">{{ namaPenyedia(k) }} · {{ k.model }}{{ k.endpoint ? ` · ${k.endpoint}` : "" }}</div>
              </div>
              <div class="flex gap-1">
                <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Uji" outlined :disabled="!!menguji" @click="uji(k.uuid)" />
                <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" icon="PhPencilSimple" outlined @click="bukaKonektor(k)" />
                <CustomButton icon="PhTrash" outlined text-color="text-danger-300" border-color="border-danger-300" @click="hapusKonektor(k)" />
              </div>
            </div>
          </div>
        </div>

        <!-- Per tahap -->
        <div class="mt-3 overflow-auto rounded-lg border border-grey-200">
          <table class="w-full text-XS">
            <thead class="bg-grey-75 text-left text-grey-500"><tr><th class="p-2">Tahap</th><th class="p-2">Konektor</th><th class="p-2">Model (kosong = bawaan konektor)</th></tr></thead>
            <tbody>
              <tr v-for="t in TAHAP_AGEN" :key="t.kode" class="border-t border-grey-100 text-grey-500">
                <td class="p-2 font-semibold">{{ t.nama }}</td>
                <td class="p-2">
                  <select v-model="nilai.konektorTahap[t.kode]" class="w-full rounded border border-grey-200 px-2 py-1" @change="nilai.modelTahap[t.kode] = undefined">
                    <option :value="undefined" :disabled="akunClaude?.masuk === false">Claude Code (langganan){{ akunClaude?.masuk === false ? " — belum terhubung" : "" }}</option>
                    <option value="codex" :disabled="!akunCodex?.masuk">Codex (langganan ChatGPT){{ akunCodex?.masuk ? "" : " — belum terhubung" }}</option>
                    <option v-for="k in konektor.filter((x) => x.aktif)" :key="k.uuid" :value="k.uuid">{{ k.nama }} ({{ k.model }})</option>
                  </select>
                  <div v-if="agenTahap(t.kode).peringatan" class="mt-1 text-warning-400">{{ agenTahap(t.kode).peringatan }}</div>
                </td>
                <td class="p-2">
                  <!-- Model mengikuti agen: Claude Code → model Claude; Codex → model OpenAI; konektor API → model konektor itu. -->
                  <select v-if="agenTahap(t.kode).jenis === 'claude_code'" v-model="nilai.modelTahap[t.kode]" class="w-full rounded border border-grey-200 px-2 py-1">
                    <option :value="undefined">Bawaan langganan Claude</option>
                    <option v-for="m in MODEL_CLAUDE" :key="m.kode" :value="m.kode">{{ m.nama }}</option>
                    <option v-if="nilai.modelTahap[t.kode] && !MODEL_CLAUDE.some((m) => m.kode === nilai.modelTahap[t.kode])" :value="nilai.modelTahap[t.kode]">{{ nilai.modelTahap[t.kode] }}</option>
                  </select>
                  <select v-else-if="agenTahap(t.kode).jenis === 'codex'" v-model="nilai.modelTahap[t.kode]" class="w-full rounded border border-grey-200 px-2 py-1">
                    <option :value="undefined">Bawaan akun Codex</option>
                    <option v-for="m in modelCodex" :key="m.kode" :value="m.kode" :title="m.deskripsi">{{ m.nama }}</option>
                    <option v-if="nilai.modelTahap[t.kode] && !modelCodex.some((m) => m.kode === nilai.modelTahap[t.kode])" :value="nilai.modelTahap[t.kode]">{{ nilai.modelTahap[t.kode] }} (tidak tersedia)</option>
                  </select>
                  <div v-else class="px-2 py-1 font-mono text-grey-400">{{ agenTahap(t.kode).model ?? "-" }} <span class="font-sans">(diatur di konektor)</span></div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Tahan kuota: rantai cadangan & batas agen bersamaan -->
        <div class="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[2fr_1fr]">
          <div class="flex flex-col gap-2 rounded-lg border border-grey-200 p-4 text-SM text-grey-500">
            <div class="font-semibold text-opensimrs-300">Rantai cadangan konektor</div>
            <div class="text-XS text-grey-400">
              Bila kuota/rate limit konektor tahap habis, agen otomatis beralih ke konektor berikutnya (urut dari atas) dengan prompt yang sama;
              coding melanjutkan perubahan yang sudah ada di branch kerja. Bila semuanya habis, tugas <b>menunggu kuota</b> dan dilanjutkan otomatis pada jam reset.
              Gunakan jalur berbayar resmi (konektor API) atau penyedia berbeda — bukan memutar beberapa akun langganan pribadi.
            </div>
            <ol class="flex flex-col gap-1">
              <li v-for="(kode, i) in nilai.konektorCadangan" :key="kode" class="flex items-center gap-2 rounded bg-grey-50 px-2 py-1 text-XS">
                <span class="w-5 text-grey-400">{{ i + 1 }}.</span>
                <span class="flex-1" :class="namaCadangan(kode).includes('tidak ditemukan') || namaCadangan(kode).includes('nonaktif') ? 'text-warning-400' : ''">{{ namaCadangan(kode) }}</span>
                <button type="button" class="rounded p-1 hover:bg-grey-75 disabled:opacity-30" :disabled="i === 0" title="Naikkan" aria-label="Naikkan" @click="geserCadangan(i, -1)"><PhArrowUp :size="14" /></button>
                <button type="button" class="rounded p-1 hover:bg-grey-75 disabled:opacity-30" :disabled="i === nilai.konektorCadangan.length - 1" title="Turunkan" aria-label="Turunkan" @click="geserCadangan(i, 1)"><PhArrowDown :size="14" /></button>
                <button type="button" class="rounded p-1 text-danger-300 hover:bg-danger-50" title="Hapus dari rantai" aria-label="Hapus dari rantai" @click="hapusCadangan(i)"><PhX :size="14" /></button>
              </li>
              <li v-if="!nilai.konektorCadangan.length" class="text-XS text-grey-300">Belum ada cadangan — tugas langsung menunggu kuota bila konektor tahap habis.</li>
            </ol>
            <div class="flex items-center gap-2">
              <select v-model="tambahCadangan" class="flex-1 rounded border border-grey-200 px-2 py-1 text-XS">
                <option value="">Pilih konektor cadangan…</option>
                <option v-for="p in pilihanCadangan" :key="p.kode" :value="p.kode">{{ p.nama }}</option>
              </select>
              <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Tambah" icon="PhPlus" outlined :disabled="!tambahCadangan" @click="tambahkanCadangan" />
            </div>
            <div class="text-[11px] text-grey-400">Contoh: Claude Code (langganan) di tahap → konektor API Anthropic → Codex. Konektor utama tahap selalu dicoba lebih dulu; model cadangan = model bawaan konektornya.</div>
          </div>
          <div class="flex flex-col gap-2 rounded-lg border border-grey-200 p-4 text-SM text-grey-500">
            <div class="font-semibold text-opensimrs-300">Maksimal agen bersamaan</div>
            <input v-model="nilai.maksAgenBersamaan" type="number" min="0" max="20" class="rounded border border-grey-200 bg-white px-2 py-1 text-XS" placeholder="kosong/0 = tanpa batas" />
            <div class="text-XS text-grey-400">Tugas agen (dokumen & coding) yang berjalan sekaligus. Tugas berikutnya <b>menunggu slot agen</b> dan dimulai otomatis saat ada yang selesai. Bawaan 2.</div>
          </div>
        </div>

        <div class="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
          <!-- Batas -->
          <div class="flex flex-col gap-2 rounded-lg bg-opensimrs-50 p-4 text-SM text-grey-500">
            <div class="font-semibold text-opensimrs-300">Batas biaya, kuota & laju</div>
            <div class="text-XS text-grey-400">Biaya = setara harga API (dengan langganan dihitung ke kuota). Kosongkan untuk tanpa batas.</div>
            <div class="grid grid-cols-3 gap-2">
              <label class="flex flex-col gap-1 text-XS"><span class="font-semibold">Per tugas (US$)</span><input v-model="nilai.batasBiayaTugas" type="number" min="0" class="rounded border border-grey-200 bg-white px-2 py-1" /></label>
              <label class="flex flex-col gap-1 text-XS"><span class="font-semibold">Per item (US$)</span><input v-model="nilai.batasBiayaItem" type="number" min="0" class="rounded border border-grey-200 bg-white px-2 py-1" /></label>
              <label class="flex flex-col gap-1 text-XS"><span class="font-semibold">Per bulan (US$)</span><input v-model="nilai.batasBiayaBulan" type="number" min="0" class="rounded border border-grey-200 bg-white px-2 py-1" /></label>
              <label class="flex flex-col gap-1 text-XS" title="Kuota langganan Claude Code mencapai persen ini → pakai rantai cadangan atau tunda sampai reset"><span class="font-semibold">Henti di kuota (%)</span><input v-model="nilai.batasKuotaPersen" type="number" min="0" max="100" class="rounded border border-grey-200 bg-white px-2 py-1" /></label>
              <label class="flex flex-col gap-1 text-XS"><span class="font-semibold">Tugas/pengguna/jam</span><input v-model="nilai.batasTugasPerJam" type="number" min="1" class="rounded border border-grey-200 bg-white px-2 py-1" /></label>
            </div>
          </div>

          <!-- Git -->
          <div class="flex flex-col gap-2 rounded-lg bg-opensimrs-50 p-4 text-SM text-grey-500">
            <div class="font-semibold text-opensimrs-300">Rilis</div>
            <div class="flex flex-col gap-1 text-XS">
              <label class="flex items-start gap-2"><input v-model="nilai.modeRilis" type="radio" value="lokal" class="mt-0.5" /> <span><b>Lokal saja</b> — tanpa push/PR. Perubahan digabung ke branch lokal yang dipakai aplikasi RS (bisa dibatalkan). Item baru bercabang dari branch lokal.</span></label>
              <label class="flex items-start gap-2"><input v-model="nilai.modeRilis" type="radio" value="pr" class="mt-0.5" /> <span><b>Pull Request</b> — push & PR ke GitHub/Gitea (kontribusi upstream).</span></label>
              <label class="flex items-start gap-2"><input v-model="nilai.modeRilis" type="radio" value="keduanya" class="mt-0.5" /> <span><b>Keduanya</b> — diterapkan ke lokal dan dikirim sebagai PR.</span></label>
            </div>
            <div v-if="nilai.modeRilis !== 'pr'" class="grid grid-cols-2 gap-2">
              <label class="flex flex-col gap-1 text-XS"><span class="font-semibold">Branch lokal aplikasi RS</span><input v-model="nilai.branchLokal" class="rounded border border-grey-200 bg-white px-2 py-1 font-mono" placeholder="kosong = branch yang sedang aktif" /></label>
              <label class="flex items-end gap-2 pb-1 text-XS"><input v-model="nilai.migrasiOtomatis" type="checkbox" /> Jalankan <code>db:migrate</code> setelah diterapkan</label>
              <label class="col-span-2 flex items-start gap-2 text-XS">
                <input v-model="nilai.aktivasiOtomatis" type="checkbox" class="mt-0.5" />
                <span>Nyalakan modul/fitur baru setelah diterapkan, beri izin modul baru ke peran admin, lalu perbarui menu tanpa login ulang
                  (otomatis hanya bila <code>LINGKUNGAN=development</code>; di staging lewat tombol <b>Aktifkan di aplikasi</b>).</span>
              </label>
              <label v-if="nilai.aktivasiOtomatis" class="flex flex-col gap-1 text-XS"><span class="font-semibold">Faskes yang dinyalakan</span>
                <select v-model="nilai.aktivasiFaskes" class="rounded border border-grey-200 bg-white px-2 py-1"><option value="saya">Faskes yang sedang saya pakai</option><option value="semua">Semua faskes</option></select></label>
            </div>
            <div v-if="nilai.modeRilis !== 'pr' && aplikasi" class="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 text-XS" :class="aplikasi.sama ? 'text-grey-500' : 'text-warning-400'">
              <span class="min-w-0 flex-1">
                Aplikasi pengembang (<code>npm run dev</code>) memakai branch <b>{{ aplikasi.branch }}</b>.
                <template v-if="aplikasi.sama">Hasil penerapan langsung terlihat di aplikasi ini.</template>
                <template v-else>Branch lokal adalah <b>{{ aplikasi.branchLokal }}</b>, jadi hasil penerapan belum terlihat di aplikasi ini.</template>
              </span>
              <CustomButton v-if="!aplikasi.sama" :label="`Pindahkan ke ${aplikasi.branchLokal}`" icon="PhArrowsLeftRight" outlined text-color="text-opensimrs-300" border-color="border-opensimrs-300" :disabled="menyimpan" @click="pindahkanAplikasi" />
            </div>
            <div v-if="nilai.modeRilis !== 'lokal'" class="grid grid-cols-2 gap-2">
              <label class="flex flex-col gap-1 text-XS"><span class="font-semibold">Branch dasar PR</span><input v-model="nilai.branchDasar" class="rounded border border-grey-200 bg-white px-2 py-1 font-mono" placeholder="origin/main" /></label>
              <label class="flex flex-col gap-1 text-XS"><span class="font-semibold">Git hosting</span>
                <select v-model="nilai.gitPenyedia" class="rounded border border-grey-200 bg-white px-2 py-1"><option value="">Tanpa (tautan compare)</option><option value="github">GitHub</option><option value="gitea">Gitea / Forgejo</option></select></label>
              <label v-if="nilai.gitPenyedia === 'gitea'" class="col-span-2 flex flex-col gap-1 text-XS"><span class="font-semibold">URL Gitea/Forgejo</span><input v-model="nilai.gitApiUrl" class="rounded border border-grey-200 bg-white px-2 py-1 font-mono" placeholder="https://git.rs-contoh.id" /></label>
              <label v-if="nilai.gitPenyedia" class="flex flex-col gap-1 text-XS"><span class="font-semibold">Repo (owner/nama)</span><input v-model="nilai.gitRepo" class="rounded border border-grey-200 bg-white px-2 py-1 font-mono" placeholder="dari remote origin" /></label>
              <label v-if="nilai.gitPenyedia" class="flex flex-col gap-1 text-XS"><span class="font-semibold">Token (izin PR saja)</span><input v-model="nilai.gitToken" type="password" autocomplete="new-password" class="rounded border border-grey-200 bg-white px-2 py-1 font-mono" placeholder="tidak diubah" /></label>
            </div>
            <label class="flex flex-col gap-1 text-XS"><span class="font-semibold">Baris atribusi commit</span><input v-model="nilai.atribusiCommit" class="rounded border border-grey-200 bg-white px-2 py-1 font-mono" /></label>
            <label class="flex items-center gap-2 text-XS"><input v-model="nilai.cekBuildFrontend" type="checkbox" /> Cek otomatis menjalankan build frontend bila berkas frontend berubah</label>
            <div v-if="nilai.gitPenyedia && nilai.modeRilis !== 'lokal'" class="flex items-center justify-between gap-2">
              <span v-if="ujiGit" class="text-XS text-success-400">✔ {{ ujiGit.repo }} ({{ ujiGit.privat ? "privat" : "publik" }}, branch {{ ujiGit.branchBawaan }})</span><span v-else></span>
              <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Simpan & uji Git" outlined icon="PhPlugs" @click="cobaGit" />
            </div>
          </div>
        </div>

        <div class="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
          <!-- Aturan instalasi -->
          <div class="flex flex-col gap-1 rounded-lg border border-grey-200 p-3">
            <div class="text-SM font-semibold text-grey-500">Aturan prompt lapis instalasi</div>
            <div class="text-XS text-grey-400">Ditambahkan ke setiap tugas agen; tidak dapat melonggarkan aturan platform. Aturan per area & per tahap ada di halaman Aturan & Pengetahuan.</div>
            <textarea v-model="nilai.aturanInstalasi" rows="7" class="rounded border border-grey-200 p-2 text-XS" placeholder="Mis.: Laporan baru wajib bisa diekspor Excel. Gunakan istilah 'penjamin', bukan 'asuransi'." />
          </div>
          <!-- Kunci ekstensi -->
          <div class="flex flex-col gap-2 rounded-lg border border-grey-200 p-3 text-XS text-grey-500">
            <div class="text-SM font-semibold">Penanda tangan paket ekstensi</div>
            <div class="text-grey-400">Paket ekstensi yang diekspor ditandatangani (Ed25519). Instalasi produksi hanya menerima paket bertanda tangan sah: salin kunci publik ke <code>laporan-service/.env</code> produksi sebagai <code>EKSTENSI_KUNCI_PUBLIK</code>.</div>
            <div v-if="kunciPublik || nilai.ekstensiKunciPublik" class="flex items-center gap-2">
              <code class="min-w-0 grow truncate rounded bg-grey-75 px-2 py-1">{{ kunciPublik || nilai.ekstensiKunciPublik }}</code>
              <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" icon="PhCopy" outlined @click="salin(kunciPublik || nilai.ekstensiKunciPublik)" />
            </div>
            <div class="flex gap-2">
              <CustomButton v-if="!nilai.ekstensiKunciPublik && !kunciPublik" label="Buat kunci" @click="siapkanKunci(false)" />
              <CustomButton v-else label="Buat kunci baru" outlined text-color="text-danger-300" border-color="border-danger-300" @click="siapkanKunci(true)" />
            </div>
          </div>
        </div>

        <!-- Peran -->
        <div class="mt-3 rounded-lg border border-grey-200 p-3">
          <div class="mb-1 text-SM font-semibold text-grey-500">Peran & hak akses</div>
          <div class="mb-2 text-XS text-grey-400">Beri peran lewat <b>Datamaster › Role</b> (modul izin <b>SIMRS Studio</b>). Modul ini tidak pernah diberikan otomatis ke admin faskes.</div>
          <div class="grid grid-cols-1 gap-1 md:grid-cols-3">
            <div v-for="(p, kode) in peran" :key="kode" class="rounded bg-grey-50 px-2 py-1 text-XS text-grey-500">
              <b>{{ p.label }}</b> — <span class="text-grey-400">{{ p.izin ? `${p.izin[0]} › ${p.izin[1]}` : "khusus superadmin" }}</span>
            </div>
          </div>
        </div>
      </template>
    </template>
  </Card>

  <Dialog v-model:visible="dialogLoginClaude" modal header="Hubungkan akun Claude" :style="{ width: '32rem' }" @hide="tutupLoginClaude">
    <div class="flex flex-col gap-3 text-SM text-grey-500">
      <ol class="flex list-decimal flex-col gap-1 pl-5">
        <li>Halaman login Claude terbuka di tab baru. Masuk dengan akun Claude Pro/Max Anda, misalnya lewat <b>Continue with Google</b>.</li>
        <li>Setelah mengizinkan Claude Code, halaman menampilkan <b>kode</b>. Salin seluruh kode itu.</li>
        <li>Tempel kodenya di bawah, lalu klik <b>Hubungkan</b>.</li>
      </ol>
      <a v-if="urlLoginClaude" :href="urlLoginClaude" target="_blank" rel="noopener" class="text-XS text-opensimrs-300 underline">Tab tidak terbuka? Buka halaman login Claude</a>
      <input v-model="kodeClaude" class="rounded border border-grey-200 px-2 py-1.5 font-mono text-XS" placeholder="Tempel kode dari halaman Claude" @keyup.enter="kirimKodeClaude" />
      <div class="text-XS text-grey-400">Akun ini juga dipakai Claude Code di VS Code pada komputer ini. Gunakan langganan pribadi Anda; satu langganan tidak untuk dipakai bersama.</div>
    </div>
    <template #footer>
      <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Batal" outlined @click="dialogLoginClaude = false" />
      <CustomButton label="Hubungkan" icon="PhSignIn" :disabled="!kodeClaude.trim() || prosesAkun" @click="kirimKodeClaude" />
    </template>
  </Dialog>

  <Dialog :visible="!!loginCodex" modal header="Hubungkan akun ChatGPT (Codex)" :style="{ width: '30rem' }" @update:visible="(v: boolean) => !v && tutupLoginCodex()">
    <div v-if="loginCodex" class="flex flex-col gap-3 text-SM text-grey-500">
      <ol class="flex list-decimal flex-col gap-1 pl-5">
        <li>Buka <a :href="loginCodex.url" target="_blank" rel="noopener" class="text-opensimrs-300 underline">{{ loginCodex.url }}</a> (sudah dibuka di tab baru).</li>
        <li>Masuk dengan akun ChatGPT Anda, misalnya lewat <b>Continue with Google</b>.</li>
        <li>Masukkan kode sekali pakai ini (berlaku 15 menit):</li>
      </ol>
      <div class="select-all rounded-lg bg-opensimrs-50 py-3 text-center font-mono text-2xl font-bold tracking-widest text-opensimrs-300">{{ loginCodex.kode }}</div>
      <div class="flex items-center gap-2 text-XS text-grey-400">
        <PhCircleNotch :size="14" class="animate-spin" aria-hidden="true" /> Menunggu persetujuan… dialog tertutup sendiri setelah berhasil.
      </div>
      <div class="text-XS text-grey-400">Gunakan langganan ChatGPT pribadi Anda; satu langganan tidak untuk dipakai bersama.</div>
    </div>
    <template #footer>
      <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Batal" outlined @click="tutupLoginCodex" />
    </template>
  </Dialog>

  <Dialog v-model:visible="dialogKonektor" modal header="Konektor agen" :style="{ width: '34rem' }">
    <div class="flex flex-col gap-2 text-SM text-grey-500">
      <label class="flex flex-col gap-1"><span class="text-XS font-semibold">Penyedia siap pakai</span>
        <select v-model="presetDipilih" class="rounded border border-grey-200 px-2 py-1.5" @change="pakaiPreset">
          <option value="">— isi manual —</option>
          <option v-for="p in PRESET_KONEKTOR" :key="p.kode" :value="p.kode">{{ p.nama }}</option>
        </select></label>
      <div v-if="presetKonektor" class="rounded bg-opensimrs-50 p-2 text-XS text-grey-500">
        <template v-if="presetKonektor.kunci">Kunci API: <a :href="presetKonektor.kunci" target="_blank" rel="noopener" class="text-opensimrs-300 underline">{{ presetKonektor.kunci }}</a>. </template>
        <template v-if="presetKonektor.kunci">Dibayar per pemakaian API (bukan langganan). Nama model bisa berubah; cek nama terbaru di situs penyedia. </template>
        <template v-else>Tanpa kunci API dan tanpa biaya per token; data tidak keluar dari jaringan RS. Pastikan Ollama berjalan dan modelnya sudah di-<code>pull</code> (tulis nama model persis dengan tag, mis. <code>qwen3:8b</code>). Model lokal kecil cocok untuk tahap dokumen atau cadangan terakhir, belum untuk coding modul utuh. </template>
        Kemampuan memakai alat (membaca/menyunting berkas) berbeda tiap model, jadi uji dulu sebelum dipakai untuk tahap Coding.
      </div>
      <label class="flex flex-col gap-1"><span class="text-XS font-semibold">Nama</span><input v-model="formKonektor.nama" class="rounded border border-grey-200 px-2 py-1.5" placeholder="Anthropic API kantor" /></label>
      <label class="flex flex-col gap-1"><span class="text-XS font-semibold">Penyedia</span>
        <select v-model="formKonektor.penyedia" class="rounded border border-grey-200 px-2 py-1.5"><option v-for="(n, k) in PENYEDIA" :key="k" :value="k">{{ n }}</option></select></label>
      <label class="flex flex-col gap-1"><span class="text-XS font-semibold">Endpoint {{ formKonektor.penyedia === "openai_kompatibel" ? "(wajib)" : "(opsional)" }}</span>
        <input v-model="formKonektor.endpoint" class="rounded border border-grey-200 px-2 py-1.5 font-mono text-XS" :placeholder="formKonektor.penyedia === 'openai_kompatibel' ? 'http://localhost:11434/v1' : 'bawaan penyedia'" /></label>
      <label class="flex flex-col gap-1"><span class="text-XS font-semibold">Model</span><input v-model="formKonektor.model" list="saran-model-konektor" class="rounded border border-grey-200 px-2 py-1.5 font-mono text-XS" placeholder="claude-opus-5-5 / gpt-… / qwen3:8b" /></label>
      <datalist id="saran-model-konektor"><option v-for="m in presetKonektor?.model ?? []" :key="m" :value="m" /></datalist>
      <label class="flex flex-col gap-1"><span class="text-XS font-semibold">Kunci API (disimpan terenkripsi)</span><input v-model="formKonektor.kunciApi" type="password" autocomplete="new-password" class="rounded border border-grey-200 px-2 py-1.5 font-mono text-XS" placeholder="kosongkan untuk model lokal" /></label>
      <div class="grid grid-cols-2 gap-2">
        <label class="flex flex-col gap-1"><span class="text-XS font-semibold">Harga masuk / 1 jt token (US$)</span><input v-model="formKonektor.hargaMasuk" type="number" min="0" step="0.01" class="rounded border border-grey-200 px-2 py-1.5" /></label>
        <label class="flex flex-col gap-1"><span class="text-XS font-semibold">Harga keluar / 1 jt token (US$)</span><input v-model="formKonektor.hargaKeluar" type="number" min="0" step="0.01" class="rounded border border-grey-200 px-2 py-1.5" /></label>
      </div>
      <label class="flex items-center gap-2 text-XS"><input v-model="formKonektor.aktif" type="checkbox" /> Aktif</label>
    </div>
    <template #footer>
      <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Batal" outlined @click="dialogKonektor = false" />
      <CustomButton label="Simpan" @click="simpanKonektor" />
    </template>
  </Dialog>
</template>
