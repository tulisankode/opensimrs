<script setup lang="ts">
// Log langkah satu tugas agen/cek. Dipantau tiap 2 detik selama tugas berjalan.
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { apiStudioGet, apiStudioPost } from "@/utils/apiHandler";
import { formatUsd } from "../umum";

const props = defineProps<{ tugasUuid: string; judul?: string }>();
const emit = defineEmits<{ (e: "selesai", status: string): void }>();

const log = ref<Array<{ id: number; jenis: string; teks: string; waktu: number }>>([]);
const tugas = ref<any>(null);
const wadah = ref<HTMLElement>();
let pewaktu: ReturnType<typeof setTimeout> | undefined;
let sejak = 0;

const berjalan = () => ["antri", "jalan"].includes(tugas.value?.status);

const muat = async () => {
  const res = await apiStudioGet(`/tugas/${props.tugasUuid}/log?sejak=${sejak}`, true);
  if (res?.payload) {
    const statusLama = tugas.value?.status;
    tugas.value = res.payload.tugas;
    if (res.payload.log.length) {
      log.value.push(...res.payload.log);
      sejak = res.payload.log.at(-1).id;
      await nextTick();
      if (wadah.value) wadah.value.scrollTop = wadah.value.scrollHeight;
    }
    if (statusLama && ["antri", "jalan"].includes(statusLama) && !berjalan()) emit("selesai", tugas.value.status);
  }
  if (berjalan()) pewaktu = setTimeout(muat, 2000);
};

watch(
  () => props.tugasUuid,
  () => {
    clearTimeout(pewaktu);
    log.value = [];
    tugas.value = null;
    sejak = 0;
    muat();
  },
  { immediate: true },
);
onBeforeUnmount(() => clearTimeout(pewaktu));

const hentikan = async () => {
  await apiStudioPost(`/tugas/${props.tugasUuid}/batal`);
};

const WARNA: Record<string, string> = {
  info: "text-grey-400",
  teks: "text-grey-500",
  alat: "text-info-300",
  hasil: "text-success-400",
  galat: "text-danger-300",
};
const LABEL_STATUS: Record<string, string> = { antri: "Antri", jalan: "Berjalan", selesai: "Selesai", gagal: "Gagal", dibatalkan: "Dihentikan" };
</script>

<template>
  <div class="rounded-lg border border-grey-200">
    <div class="flex items-center justify-between gap-2 border-b border-grey-200 px-3 py-2">
      <div class="flex items-center gap-2 text-SM font-semibold text-grey-500">
        <PhSpinnerGap v-if="berjalan()" :size="16" class="animate-spin text-opensimrs-300" aria-hidden="true" />
        <PhRobot v-else :size="16" class="text-opensimrs-300" aria-hidden="true" />
        {{ judul ?? "Log agen" }}
        <span v-if="tugas" class="rounded bg-grey-75 px-1.5 text-[10px] font-semibold text-grey-400">{{ LABEL_STATUS[tugas.status] ?? tugas.status }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span v-if="tugas && Number(tugas.biayaUsd)" class="text-[10px] text-grey-400" title="Setara harga API; dengan langganan dihitung ke kuota">≈ {{ formatUsd(tugas.biayaUsd) }}</span>
        <CustomButton v-if="berjalan()" label="Hentikan" icon="PhStop" outlined text-color="text-danger-300" border-color="border-danger-300" @click="hentikan" />
      </div>
    </div>
    <div ref="wadah" class="max-h-72 overflow-auto bg-grey-50 p-3 font-mono text-XS">
      <div v-for="l in log" :key="l.id" class="flex gap-2 whitespace-pre-wrap py-[1px]">
        <span class="shrink-0 text-grey-300">{{ new Date(l.waktu * 1000).toLocaleTimeString("id-ID") }}</span>
        <span :class="WARNA[l.jenis] ?? 'text-grey-500'">{{ l.jenis === "alat" ? "› " : "" }}{{ l.teks }}</span>
      </div>
      <div v-if="!log.length" class="text-grey-300">Menunggu agen…</div>
      <div v-if="tugas?.pesanGalat" class="mt-1 text-danger-300">{{ tugas.pesanGalat }}</div>
    </div>
  </div>
</template>
