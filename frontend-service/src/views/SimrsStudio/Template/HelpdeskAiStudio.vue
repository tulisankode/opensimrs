<script setup lang="ts">
// Helpdesk AI (OpenClaw di mesin ini, superadmin): status gateway, agen helpdesk & modelnya (Ollama lokal atau penyedia
// API + kunci), sinkron panduan, token gateway, dan uji tanya. Kanal pesan sengaja tidak diatur: helpdesk hanya lewat
// tombol Bantuan OpenSIMRS. Gateway produksi di VM diatur sesuai deploy/helpdesk/README.md.
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { apiStudioGet, apiStudioPost } from "@/utils/apiHandler";
import { useSimrsStudioStore } from "@/stores/simrsStudio";

const studio = useSimrsStudioStore();
const router = useRouter();
const data = ref<any>(null);
const memuat = ref(false);
const sibuk = ref("");

const muat = async () => {
  memuat.value = true;
  try {
    data.value = (await apiStudioGet("/helpdesk-ai"))?.payload ?? null;
    isiForm();
  } finally {
    memuat.value = false;
  }
};
onMounted(muat);

const jalankan = async (nama: string, fn: () => Promise<any>, muatUlang = true) => {
  sibuk.value = nama;
  try {
    return await fn();
  } finally {
    sibuk.value = "";
    if (muatUlang) await muat();
  }
};

// ---------- Agen & model ----------
const SARAN_API: Record<string, string[]> = {
  anthropic: ["anthropic/claude-haiku-5-5", "anthropic/claude-sonnet-5-5"],
  deepseek: ["deepseek/deepseek-chat"],
  openrouter: ["openrouter/<penyedia>/<model>"],
};
const form = ref({ agen: "helpdesk-opensimrs", sumber: "lokal", modelLokal: "", penyedia: "anthropic", modelApi: "", kunciApi: "", thinking: "off", batasBootstrap: 12000 });
const isiForm = () => {
  const a = data.value?.agenHelpdesk;
  const model: string = a?.model ?? "";
  const lokal = !model || model.startsWith("ollama/");
  form.value = {
    ...form.value,
    agen: a?.id ?? data.value?.helpdesk?.agen ?? "helpdesk-opensimrs",
    sumber: lokal ? "lokal" : "api",
    modelLokal: lokal ? model.replace(/^ollama\//, "") : form.value.modelLokal,
    penyedia: lokal ? form.value.penyedia : model.split("/")[0],
    modelApi: lokal ? form.value.modelApi : model,
    kunciApi: "",
    thinking: a?.thinking ?? "off",
    batasBootstrap: a?.batasBootstrap ?? 12000,
  };
};
const modelDipilih = computed(() => (form.value.sumber === "lokal" ? `ollama/${form.value.modelLokal}` : form.value.modelApi.trim()));
const ukuranLokal = computed(() => data.value?.ollama?.model?.find((m: any) => m.nama === form.value.modelLokal)?.ukuranGb ?? null);
const simpanAgen = () =>
  jalankan("agen", () =>
    apiStudioPost("/helpdesk-ai/agen", {
      agen: form.value.agen,
      model: modelDipilih.value,
      penyedia: form.value.sumber === "api" ? form.value.penyedia : undefined,
      kunciApi: form.value.sumber === "api" && form.value.kunciApi ? form.value.kunciApi : undefined,
      thinking: form.value.thinking,
      batasBootstrap: Number(form.value.batasBootstrap),
    }),
  );

// ---------- Sinkron, gateway, token ----------
const sinkron = () => jalankan("sinkron", () => apiStudioPost("/helpdesk-ai/sinkron", { agen: form.value.agen }));
const jalankanGateway = () => jalankan("gateway", () => apiStudioPost("/helpdesk-ai/gateway", {}));
const dialogToken = ref(false);
const hasilToken = ref<any>(null);
const gantiToken = async () => {
  dialogToken.value = false;
  hasilToken.value = (await jalankan("token", () => apiStudioPost("/helpdesk-ai/token", { agen: form.value.agen })))?.payload ?? null;
};

// ---------- Uji tanya ----------
const pertanyaan = ref("Bagaimana cara mengganti password?");
const hasilUji = ref<any>(null);
const uji = async () => {
  hasilUji.value = null;
  hasilUji.value = (await jalankan("uji", () => apiStudioPost("/helpdesk-ai/uji", { agen: form.value.agen, pertanyaan: pertanyaan.value }, true), false))?.payload ?? null;
};

const LABEL_SIBUK: Record<string, string> = {
  agen: "Menyimpan ke OpenClaw… (±1 menit)",
  sinkron: "Menyalin panduan…",
  gateway: "Menjalankan gateway… (maks. 90 detik)",
  token: "Memasang token baru…",
  uji: "Agen sedang menjawab… (model lokal bisa 1–2 menit)",
};
const centang = (ok: boolean | null | undefined) => (ok ? "text-success-300" : "text-danger-300");
</script>

<template>
  <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full" class="h-full">
    <template #header>
      <PageToolbar>
        <h1 class="toolbar-heading text-opensimrs-300">Helpdesk AI (OpenClaw)</h1>
        <CustomButton label="Periksa ulang" icon="PhArrowsClockwise" outlined text-color="text-opensimrs-300" border-color="border-opensimrs-300" :disabled="memuat || !!sibuk" @click="muat" />
      </PageToolbar>
    </template>
    <template #content>
      <div v-if="!studio.status.superadmin" class="rounded-lg bg-warning-50 p-3 text-XS text-warning-400">Hanya superadmin yang dapat mengatur Helpdesk AI.</div>
      <div v-else class="flex flex-col gap-3 text-SM text-grey-500">
        <div class="rounded-lg bg-grey-75 p-3 text-XS text-grey-500">
          Mengatur <b>OpenClaw di mesin ini</b> untuk tombol <b>Bantuan</b> OpenSIMRS: agen helpdesk, modelnya, panduan yang dibaca, dan token gateway.
          Agen selalu dibatasi hanya-baca (tanpa exec, tulis berkas, peramban). Kanal pesan (WhatsApp/Telegram) tidak diatur di sini.
          Gateway produksi di VM terpisah diatur mengikuti <code>deploy/helpdesk/README.md</code>.
        </div>
        <div v-if="sibuk || (memuat && !data)" class="flex items-center gap-2 rounded-lg bg-opensimrs-50 p-2 text-XS text-opensimrs-300">
          <PhCircleNotch :size="16" class="animate-spin" aria-hidden="true" /> {{ LABEL_SIBUK[sibuk] ?? "Memeriksa OpenClaw… (±30 detik)" }}
        </div>

        <div v-if="data && !data.terpasang" class="rounded-lg border border-warning-200 bg-warning-50 p-3 text-XS text-warning-400">
          OpenClaw belum terpasang di mesin ini. Pasang lewat installer OpenSIMRS (langkah alat AI) atau paket resmi OpenClaw, jalankan
          <code>openclaw onboard</code> sekali (lewati kanal pesan), lalu klik Periksa ulang.
        </div>

        <div v-else-if="data" class="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <!-- Status -->
          <div class="flex flex-col gap-2 rounded-lg bg-opensimrs-50 p-4">
            <div class="font-semibold text-opensimrs-300">Status</div>
            <ul class="flex flex-col gap-1 text-XS">
              <li>OpenClaw <b>{{ data.versi ?? "?" }}</b><span v-if="data.terisolasi" class="text-grey-400"> · paket Windows (sesi terisolasi)</span></li>
              <li class="flex items-center gap-1">
                <PhCircle weight="fill" :size="10" :class="centang(data.gateway?.berjalan)" aria-hidden="true" />
                Gateway {{ data.gateway?.berjalan ? "berjalan" : "tidak berjalan" }} di <code>{{ data.gateway?.url }}</code>
              </li>
              <li v-if="data.gateway?.berjalan" class="flex items-center gap-1">
                <PhCircle weight="fill" :size="10" :class="centang(data.gateway?.endpointHttp === 'aktif')" aria-hidden="true" />
                Endpoint HTTP (dipakai OpenSIMRS): {{ data.gateway?.endpointHttp }}<span v-if="data.gateway?.endpointHttp === 'mati'"> — klik Simpan ke OpenClaw untuk menyalakan</span>
              </li>
              <li class="flex items-center gap-1">
                <PhCircle weight="fill" :size="10" :class="centang(data.ollama?.berjalan)" aria-hidden="true" />
                Ollama {{ data.ollama?.berjalan ? `berjalan (${data.ollama.model.length} model)` : "tidak berjalan — hanya model API yang bisa dipakai" }}
              </li>
            </ul>
            <div class="rounded-lg bg-white p-2 text-XS">
              <div class="font-semibold">Pengaturan Helpdesk AI di OpenSIMRS</div>
              <div v-if="data.helpdesk?.galat" class="text-danger-300">{{ data.helpdesk.galat }}</div>
              <template v-else-if="data.helpdesk">
                <div>{{ data.helpdesk.aktif ? "Aktif" : "Nonaktif" }} · <code>{{ data.helpdesk.gatewayUrl || "-" }}</code> · agen <code>{{ data.helpdesk.agen }}</code> · token {{ data.helpdesk.token || "belum ada" }}</div>
                <div v-if="data.helpdesk.gatewayUrl && data.gateway?.url && data.helpdesk.gatewayUrl !== data.gateway.url" class="text-warning-400">
                  URL berbeda dengan gateway di mesin ini. Klik Buat token baru agar URL & token diselaraskan otomatis.
                </div>
              </template>
              <button type="button" class="mt-1 text-opensimrs-300 underline" @click="router.push('/setting/konfigurasi-integrasi')">Buka Konfigurasi Integrasi</button>
            </div>
            <CustomButton class="self-start" :label="data.gateway?.berjalan ? 'Jalankan ulang gateway' : 'Jalankan gateway'" icon="PhPlay" :disabled="!!sibuk" @click="jalankanGateway" />
            <div class="text-[11px] text-grey-400">Gateway dijalankan sebagai proses latar studio-service. Bila studio-service atau PC dimatikan, jalankan lagi dari sini atau dari aplikasi OpenClaw Gateway.</div>
          </div>

          <!-- Agen & model -->
          <div class="flex flex-col gap-2 rounded-lg bg-opensimrs-50 p-4">
            <div class="font-semibold text-opensimrs-300">Agen & model</div>
            <div v-if="data.agenHelpdesk" class="flex flex-wrap gap-1 text-[11px]">
              <span class="rounded bg-white px-1.5">model: <b>{{ data.agenHelpdesk.model }}</b></span>
              <span class="rounded px-1.5" :class="data.agenHelpdesk.alatAman ? 'bg-success-50 text-success-400' : 'bg-danger-50 text-danger-400'">{{ data.agenHelpdesk.alatAman ? "✔ alat dibatasi" : "✘ alat belum dibatasi" }}</span>
              <span class="rounded px-1.5" :class="data.agenHelpdesk.panduan ? 'bg-success-50 text-success-400' : 'bg-danger-50 text-danger-400'">{{ data.agenHelpdesk.panduan ? "✔ panduan ada" : "✘ panduan belum disalin" }}</span>
              <span class="rounded bg-white px-1.5">berpikir: {{ data.agenHelpdesk.thinking ?? "bawaan" }}</span>
            </div>
            <div v-else class="text-XS text-warning-400">Agen <code>{{ form.agen }}</code> belum ada — Simpan untuk membuatnya.</div>
            <label class="flex flex-col gap-1 text-XS"><span class="font-semibold">ID agen</span>
              <input v-model="form.agen" class="rounded border border-grey-200 bg-white px-2 py-1 font-mono" />
            </label>
            <div class="flex gap-4 text-XS">
              <label class="flex items-center gap-1"><input v-model="form.sumber" type="radio" value="lokal" /> Lokal (Ollama)</label>
              <label class="flex items-center gap-1"><input v-model="form.sumber" type="radio" value="api" /> Penyedia API</label>
            </div>
            <template v-if="form.sumber === 'lokal'">
              <select v-model="form.modelLokal" class="rounded border border-grey-200 bg-white px-2 py-1 text-XS">
                <option value="" disabled>Pilih model Ollama</option>
                <option v-for="m in data.ollama?.model ?? []" :key="m.nama" :value="m.nama">{{ m.nama }} ({{ m.ukuranGb }} GB)</option>
              </select>
              <div class="text-[11px] text-grey-400">
                Data tidak keluar dari mesin ini, tetapi lambat bila model lebih besar dari memori GPU dan bisa mengarang jawaban.
                Model baru dipasang dengan <code>ollama pull &lt;nama&gt;</code>.
                <span v-if="ukuranLokal && ukuranLokal > 4" class="text-warning-400"> Model {{ ukuranLokal }} GB: pada GPU 6 GB sebagian berjalan di CPU (jawaban 1–2 menit).</span>
              </div>
            </template>
            <template v-else>
              <div class="grid grid-cols-2 gap-2">
                <label class="flex flex-col gap-1 text-XS"><span class="font-semibold">Penyedia</span>
                  <select v-model="form.penyedia" class="rounded border border-grey-200 bg-white px-2 py-1">
                    <option v-for="p in data.penyedia" :key="p" :value="p">{{ p }}</option>
                  </select>
                </label>
                <label class="flex flex-col gap-1 text-XS"><span class="font-semibold">Model</span>
                  <input v-model="form.modelApi" list="saran-model" class="rounded border border-grey-200 bg-white px-2 py-1 font-mono" :placeholder="`${form.penyedia}/nama-model`" />
                  <datalist id="saran-model"><option v-for="s in SARAN_API[form.penyedia] ?? []" :key="s" :value="s" /></datalist>
                </label>
              </div>
              <label class="flex flex-col gap-1 text-XS"><span class="font-semibold">Kunci API {{ form.penyedia }}</span>
                <input v-model="form.kunciApi" type="password" autocomplete="new-password" class="rounded border border-grey-200 bg-white px-2 py-1 font-mono" placeholder="Kosongkan bila sudah pernah disimpan" />
              </label>
              <div class="text-[11px] text-grey-400">
                Kunci disimpan di konfigurasi OpenClaw (bukan database OpenSIMRS) dan tidak ditampilkan lagi. Pakai kunci khusus helpdesk, terpisah dari
                kunci agen pengembang. Pertanyaan pengguna (sudah disaring dari NIK/nama/No. RM) dikirim ke penyedia ini.
              </div>
            </template>
            <div class="grid grid-cols-2 gap-2">
              <label class="flex flex-col gap-1 text-XS"><span class="font-semibold">Mode berpikir</span>
                <select v-model="form.thinking" class="rounded border border-grey-200 bg-white px-2 py-1">
                  <option value="off">Mati (paling cepat)</option>
                  <option value="minimal">Minimal</option>
                  <option value="low">Rendah</option>
                  <option value="medium">Sedang</option>
                </select>
              </label>
              <label class="flex flex-col gap-1 text-XS" title="Batas karakter isi workspace (AGENTS.md, persona) yang disuntikkan ke setiap prompt"><span class="font-semibold">Batas isi prompt (karakter)</span>
                <input v-model="form.batasBootstrap" type="number" min="2000" max="200000" step="1000" class="rounded border border-grey-200 bg-white px-2 py-1" />
              </label>
            </div>
            <CustomButton class="self-start" label="Simpan ke OpenClaw" icon="PhFloppyDisk" :disabled="!!sibuk || !form.agen || (form.sumber === 'lokal' ? !form.modelLokal : !form.modelApi)" @click="simpanAgen" />
          </div>

          <!-- Panduan & token -->
          <div class="flex flex-col gap-2 rounded-lg bg-opensimrs-50 p-4">
            <div class="font-semibold text-opensimrs-300">Panduan agen</div>
            <div class="text-XS">
              Menyalin panduan pengguna, katalog modul, dan instruksi agen (AGENTS.md + persona helpdesk) dari commit terakhir repo ke workspace
              <code class="break-all">{{ data.agenHelpdesk?.workspace ?? "-" }}</code>. Jalankan ulang setiap kali panduan diperbarui.
            </div>
            <CustomButton class="self-start" label="Sinkron panduan" icon="PhBooks" outlined text-color="text-opensimrs-300" border-color="border-opensimrs-300" :disabled="!!sibuk" @click="sinkron" />

            <div class="mt-2 font-semibold text-opensimrs-300">Token gateway</div>
            <div class="text-XS">
              Membuat token acak baru, memasangnya di OpenClaw, dan memperbarui URL, agen, serta token di pengaturan Helpdesk AI OpenSIMRS sekaligus.
              Token tidak ditampilkan. Setelah itu klik <b>Jalankan ulang gateway</b>.
            </div>
            <div v-if="hasilToken" class="rounded bg-success-50 p-2 text-XS text-success-400">Token baru …{{ hasilToken.akhiran }} dipasang untuk {{ hasilToken.url }}. Jalankan ulang gateway agar berlaku.</div>
            <CustomButton class="self-start" label="Buat token baru" icon="PhKey" outlined text-color="text-opensimrs-300" border-color="border-opensimrs-300" :disabled="!!sibuk" @click="dialogToken = true" />
          </div>

          <!-- Uji tanya -->
          <div class="flex flex-col gap-2 rounded-lg bg-opensimrs-50 p-4">
            <div class="font-semibold text-opensimrs-300">Uji tanya</div>
            <div class="text-XS">Bertanya langsung ke agen lewat gateway (sesi baru setiap uji), tanpa batas per jam OpenSIMRS.</div>
            <div class="flex gap-2">
              <input v-model="pertanyaan" class="min-w-0 flex-1 rounded border border-grey-200 bg-white px-2 py-1 text-XS" maxlength="300" @keyup.enter="uji" />
              <CustomButton label="Tanya" icon="PhPaperPlaneRight" :disabled="!!sibuk || !pertanyaan.trim()" @click="uji" />
            </div>
            <div v-if="hasilUji" class="flex flex-col gap-1 rounded-lg bg-white p-2 text-XS">
              <div class="text-grey-400">Dijawab dalam <b>{{ (hasilUji.durasiMs / 1000).toFixed(1) }} detik</b> oleh agen {{ hasilUji.agen }}</div>
              <div class="whitespace-pre-wrap">{{ hasilUji.jawaban }}</div>
              <div class="text-[11px] text-grey-400">
                Periksa kebenarannya terhadap panduan. Jawaban yang mengarang (menu/tombol yang tidak ada) tanda model terlalu kecil — pakai model API.
                Batas waktu jawaban di OpenSIMRS: {{ data.helpdesk?.timeoutDetik ?? 120 }} detik.
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </Card>
  <Dialog v-model:visible="dialogToken" modal header="Buat token gateway baru" :style="{ width: '30rem' }">
    <div class="text-SM text-grey-500">
      Token lama langsung tidak berlaku setelah gateway dijalankan ulang. Tombol Bantuan galat sebentar sampai gateway berjalan lagi dengan token baru.
    </div>
    <template #footer>
      <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Batal" outlined @click="dialogToken = false" />
      <CustomButton label="Buat token baru" :disabled="!!sibuk" @click="gantiToken" />
    </template>
  </Dialog>
</template>
