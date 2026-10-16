<script setup lang="ts">
// Pengaturan SIMRS Studio (superadmin): fitur, kill switch, agen (Claude Code langganan + konektor API), konektor & model
// per tahap, batas biaya/kuota/laju, integrasi Git, kunci penanda tangan ekstensi, aturan instalasi.
import { computed, onMounted, ref } from "vue";
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
  if (nilai.value) {
    nilai.value.konektorTahap ??= {};
    nilai.value.modelTahap ??= {};
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
const uji = async (k: string) => {
  menguji.value = k;
  hasilUji.value = (await apiStudioPost("/konektor/uji", { konektor: k }))?.payload ?? null;
  menguji.value = null;
};

// Konektor API
const dialogKonektor = ref(false);
const formKonektor = ref<any>({});
const bukaKonektor = (k?: any) => {
  formKonektor.value = k ? { ...k, kunciApi: k.kunciApi ? "••••••••" : "" } : { nama: "", penyedia: "anthropic", endpoint: "", model: "", kunciApi: "", hargaMasuk: "", hargaKeluar: "", aktif: true };
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

const MODEL_SARAN = ["", "claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"];
const TAHAP_AGEN = [...TAHAP.map((t) => ({ kode: t.kode, nama: t.nama })), { kode: "ekstensi", nama: "Ekstensi" }];
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

          <!-- Claude Code -->
          <div class="flex flex-col gap-2 rounded-lg border border-grey-200 p-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <PhTerminalWindow :size="26" weight="duotone" class="text-opensimrs-300" aria-hidden="true" />
                <div>
                  <div class="text-normal font-semibold text-grey-500">Claude Code (langganan Anda)</div>
                  <div class="text-XS text-grey-400">{{ sistem?.claude?.terpasang ? sistem.claude.versi : sistem?.claude?.pesan ?? "memuat…" }}</div>
                </div>
              </div>
              <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Uji" outlined icon="PhPulse" :disabled="!!menguji" @click="uji('claude_code')" />
            </div>
            <div class="text-XS text-grey-400">Agen bawaan: <code>claude -p</code> di mesin ini dengan login yang sama seperti Claude Code di VS Code (Pro/Max lewat <code>/login</code>). Pemakaian dihitung ke kuota langganan.</div>
            <div v-if="kuota" class="rounded-lg bg-grey-50 p-2 text-XS text-grey-500">
              <div class="flex justify-between"><span>Kuota {{ kuota.jenis }}</span><b>{{ kuota.persen ?? "-" }}% terpakai</b></div>
              <div class="mt-1 h-2 overflow-hidden rounded-full bg-white">
                <div class="h-full" :class="(kuota.persen ?? 0) >= 90 ? 'bg-danger-300' : (kuota.persen ?? 0) >= 75 ? 'bg-warning-300' : 'bg-opensimrs-300'" :style="{ width: `${Math.min(kuota.persen ?? 0, 100)}%` }"></div>
              </div>
              <div v-if="kuota.reset" class="mt-1 text-grey-400">Direset {{ kuota.reset }}<template v-if="sistem?.kuotaPada"> · data per {{ formatWaktu(sistem.kuotaPada) }}</template></div>
            </div>
            <div v-if="hasilUji" class="text-XS text-success-400">✔ {{ hasilUji.hasil }} ({{ hasilUji.tugas?.model }}, ≈ {{ formatUsd(hasilUji.tugas?.biayaUsd) }})</div>
            <div class="text-XS text-grey-400">Repo <code>{{ sistem?.repoDir }}</code> · branch <b>{{ sistem?.branch }}</b> · lingkungan <b>{{ sistem?.lingkungan }}</b></div>
          </div>
        </div>

        <!-- Konektor API -->
        <div class="mt-3 rounded-lg border border-grey-200 p-4">
          <div class="mb-2 flex items-center justify-between">
            <div class="font-semibold text-opensimrs-300">Konektor API (opsional)</div>
            <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Tambah konektor" icon="PhPlus" outlined @click="bukaKonektor()" />
          </div>
          <div class="mb-2 text-XS text-grey-400">Anthropic API, OpenAI API, atau model lokal yang kompatibel OpenAI (Ollama, vLLM, LM Studio) untuk faskes yang tidak boleh mengirim data keluar. Agen eksternal (mis. OpenClaw) tersambung lewat server MCP OpenSIMRS — lihat panduan.</div>
          <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div v-for="k in konektor" :key="k.uuid" class="flex items-center justify-between gap-2 rounded-lg bg-grey-50 p-2 text-XS">
              <div>
                <div class="font-semibold text-grey-500">{{ k.nama }} <span v-if="!k.aktif" class="text-grey-300">(nonaktif)</span></div>
                <div class="text-grey-400">{{ PENYEDIA[k.penyedia] }} · {{ k.model }}{{ k.endpoint ? ` · ${k.endpoint}` : "" }}</div>
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
                  <select v-model="nilai.konektorTahap[t.kode]" class="w-full rounded border border-grey-200 px-2 py-1">
                    <option :value="undefined">Claude Code (langganan)</option>
                    <option v-for="k in konektor.filter((x) => x.aktif)" :key="k.uuid" :value="k.uuid">{{ k.nama }}</option>
                  </select>
                </td>
                <td class="p-2">
                  <input v-model="nilai.modelTahap[t.kode]" list="saran-model" class="w-full rounded border border-grey-200 px-2 py-1 font-mono" placeholder="bawaan" />
                </td>
              </tr>
            </tbody>
          </table>
          <datalist id="saran-model"><option v-for="m in MODEL_SARAN.filter(Boolean)" :key="m" :value="m" /></datalist>
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
              <label class="flex flex-col gap-1 text-XS"><span class="font-semibold">Henti di kuota (%)</span><input v-model="nilai.batasKuotaPersen" type="number" min="0" max="100" class="rounded border border-grey-200 bg-white px-2 py-1" /></label>
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
              <label v-if="nilai.gitPenyedia" class="flex flex-col gap-1 text-XS"><span class="font-semibold">Token (izin PR saja)</span><input v-model="nilai.gitToken" type="password" class="rounded border border-grey-200 bg-white px-2 py-1 font-mono" placeholder="tidak diubah" /></label>
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

  <Dialog v-model:visible="dialogKonektor" modal header="Konektor agen" :style="{ width: '34rem' }">
    <div class="flex flex-col gap-2 text-SM text-grey-500">
      <label class="flex flex-col gap-1"><span class="text-XS font-semibold">Nama</span><input v-model="formKonektor.nama" class="rounded border border-grey-200 px-2 py-1.5" placeholder="Anthropic API kantor" /></label>
      <label class="flex flex-col gap-1"><span class="text-XS font-semibold">Penyedia</span>
        <select v-model="formKonektor.penyedia" class="rounded border border-grey-200 px-2 py-1.5"><option v-for="(n, k) in PENYEDIA" :key="k" :value="k">{{ n }}</option></select></label>
      <label class="flex flex-col gap-1"><span class="text-XS font-semibold">Endpoint {{ formKonektor.penyedia === "openai_kompatibel" ? "(wajib)" : "(opsional)" }}</span>
        <input v-model="formKonektor.endpoint" class="rounded border border-grey-200 px-2 py-1.5 font-mono text-XS" :placeholder="formKonektor.penyedia === 'openai_kompatibel' ? 'http://localhost:11434/v1' : 'bawaan penyedia'" /></label>
      <label class="flex flex-col gap-1"><span class="text-XS font-semibold">Model</span><input v-model="formKonektor.model" class="rounded border border-grey-200 px-2 py-1.5 font-mono text-XS" placeholder="claude-opus-5-5 / gpt-… / qwen2.5-coder" /></label>
      <label class="flex flex-col gap-1"><span class="text-XS font-semibold">Kunci API (disimpan terenkripsi)</span><input v-model="formKonektor.kunciApi" type="password" class="rounded border border-grey-200 px-2 py-1.5 font-mono text-XS" placeholder="kosongkan untuk model lokal" /></label>
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
