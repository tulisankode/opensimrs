<script setup lang="ts">
// Kesiapan Terapkan: daftar periksa dari studio-service (commit, berkas belum di-commit, migrasi, konflik dengan branch
// lokal, working tree aplikasi) beserta tombol perbaikannya, agar penerapan yang gagal bisa dibereskan tanpa terminal.
import { ref, watch } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { apiStudioGet } from "@/utils/apiHandler";

const props = defineProps<{ itemUuid: string; muatUlang: number; sibuk: boolean; bolehAgen: boolean }>();
const emit = defineEmits<{ (e: "aksi", nama: string): void; (e: "siap", siap: boolean): void }>();

const kesiapan = ref<any>(null);
const memuat = ref(false);
const muat = async () => {
  memuat.value = true;
  try {
    kesiapan.value = (await apiStudioGet(`/item/${props.itemUuid}/kesiapan`, true))?.payload ?? null;
    emit("siap", Boolean(kesiapan.value?.siap));
  } finally {
    memuat.value = false;
  }
};
watch(() => [props.itemUuid, props.muatUlang], muat, { immediate: true });

const IKON: Record<string, string> = { ok: "PhCheckCircle", info: "PhInfo", blokir: "PhXCircle" };
const WARNA: Record<string, string> = { ok: "text-success-300", info: "text-opensimrs-300", blokir: "text-danger-300" };
const AKSI: Record<string, { label: string; ikon: string; bahaya?: boolean }> = {
  "coding/pindai": { label: "Pindai perubahan", ikon: "PhMagnifyingGlass" },
  commit: { label: "Ke formulir commit", ikon: "PhGitCommit" },
  "konflik/mulai": { label: "Mulai selesaikan konflik", ikon: "PhGitMerge" },
  "konflik/agen": { label: "Minta agen menyelesaikan", ikon: "PhRobot" },
  "konflik/selesai": { label: "Tutup penggabungan", ikon: "PhCheck" },
  "konflik/batal": { label: "Batalkan penggabungan", ikon: "PhArrowCounterClockwise", bahaya: true },
};
const BATAS_BERKAS = 8;
const terbuka = ref<Record<string, boolean>>({});
const disalin = ref("");
const salin = async (teks: string) => {
  try {
    await navigator.clipboard.writeText(teks);
    disalin.value = teks;
    setTimeout(() => (disalin.value = ""), 1500);
  } catch {
    /* clipboard tidak tersedia: teks tetap bisa dipilih manual */
  }
};
defineExpose({ muat });
</script>

<template>
  <div class="flex flex-col gap-2 rounded-lg border border-grey-200 bg-white p-2.5 text-XS text-grey-500">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2 font-semibold">
        <PhListChecks :size="16" class="text-opensimrs-300" aria-hidden="true" />
        Kesiapan penerapan<template v-if="kesiapan"> ke <b>{{ kesiapan.target }}</b></template>
        <span v-if="kesiapan" class="rounded px-1.5 text-[10px] font-semibold" :class="kesiapan.siap ? 'bg-success-50 text-success-400' : 'bg-danger-50 text-danger-400'">
          {{ kesiapan.siap ? "Siap diterapkan" : "Perlu dibereskan" }}
        </span>
      </div>
      <CustomButton label="Periksa ulang" icon="PhArrowsClockwise" outlined text-color="text-opensimrs-300" border-color="border-opensimrs-300" :disabled="memuat || sibuk" @click="muat" />
    </div>
    <div v-if="!kesiapan && memuat" class="text-grey-400">Memeriksa…</div>
    <ul v-else-if="kesiapan" class="flex flex-col gap-1.5">
      <li v-for="l in kesiapan.langkah" :key="l.kode" class="flex items-start gap-2 rounded-lg p-1.5" :class="{ 'bg-danger-50/40': l.status === 'blokir' }">
        <component :is="IKON[l.status]" :size="16" weight="fill" class="mt-0.5 shrink-0" :class="WARNA[l.status]" aria-hidden="true" />
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <div class="font-semibold" :class="l.status === 'blokir' ? 'text-danger-400' : 'text-grey-500'">{{ l.judul }}</div>
          <div v-if="l.rincian" class="whitespace-pre-line text-grey-400">{{ l.rincian }}</div>
          <div v-if="l.folder" class="flex flex-wrap items-center gap-1 text-grey-400">
            Folder: <code class="break-all rounded bg-grey-75 px-1">{{ l.folder }}</code>
            <button type="button" class="text-opensimrs-300 underline" @click="salin(l.folder)">{{ disalin === l.folder ? "tersalin" : "salin" }}</button>
          </div>
          <ul v-if="(l.berkas ?? []).length" class="flex flex-col gap-0.5">
            <li v-for="b in terbuka[l.kode] ? l.berkas : l.berkas.slice(0, BATAS_BERKAS)" :key="b">
              <code class="break-all rounded bg-grey-75 px-1">{{ b }}</code>
            </li>
            <li v-if="l.berkas.length > BATAS_BERKAS">
              <button type="button" class="text-opensimrs-300 underline" @click="terbuka[l.kode] = !terbuka[l.kode]">
                {{ terbuka[l.kode] ? "Ringkas" : `+${l.berkas.length - BATAS_BERKAS} berkas lagi` }}
              </button>
            </li>
          </ul>
          <div v-if="(l.aksi ?? []).length" class="flex flex-wrap gap-2 pt-0.5">
            <CustomButton
              v-for="a in l.aksi.filter((x: string) => AKSI[x] && (x !== 'konflik/agen' || bolehAgen))"
              :key="a"
              :label="AKSI[a].label"
              :icon="AKSI[a].ikon"
              outlined
              :text-color="AKSI[a].bahaya ? 'text-danger-300' : 'text-opensimrs-300'"
              :border-color="AKSI[a].bahaya ? 'border-danger-300' : 'border-opensimrs-300'"
              :disabled="sibuk || memuat"
              @click="emit('aksi', a)"
            />
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
