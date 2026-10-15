<script setup lang="ts">
// Kolom Status tabel Rawat Jalan: status kunjungan, tombol Panggil/Panggil Ulang, waktu panggil,
// dan status pembayaran.
import { computed, ref } from "vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import AnnouncementIcon from "@/components/icons/AnnouncementIcon.vue";
import { epochToDate } from "@/utils/Helpers";
import { masihAntri, panggilPasien } from "./antrianPoli";
import { modulAktif } from "@/stores/modulFaskes";

const props = defineProps<{ row: any }>();
const emit = defineEmits(["diperbarui"]);

const statusRj = computed(() => String(props.row?.statusRj));
const label = computed(() =>
  statusRj.value === "0" ? "DIBATALKAN"
  : ["1", "2", "3"].includes(statusRj.value) ? "ANTRI"
  : statusRj.value === "4" ? "DIPERIKSA"
  : "DISCHARGE"
);
const warna = computed(() =>
  statusRj.value === "0" ? "bg-danger-300"
  : ["1", "2", "3"].includes(statusRj.value) ? "bg-warning-300"
  : statusRj.value === "4" ? "bg-blueJeans-300"
  : "bg-opensimrs-300"
);

// statusBayar: true lunas, false belum lunas, null belum ada tagihan
const bayar = computed(() => {
  const s = props.row?.statusBayar;
  if (s === true) return { label: "Lunas", bg: "bg-success-75", text: "text-success-300" };
  if (s === false) return { label: "Belum Lunas", bg: "bg-grey-100", text: "text-grey-400" };
  return { label: "Belum Ada Tagihan", bg: "bg-grey-100", text: "text-grey-400" };
});

const statusPanggilan = computed(() => Number(props.row?.statusPanggilan ?? -1));
const bisaDipanggil = computed(() => modulAktif("antrian") && masihAntri(props.row) && !!props.row?.antrianPoliUuid && statusPanggilan.value !== 3);
const keteranganPanggilan = computed(() => {
  if (!masihAntri(props.row) || !modulAktif("antrian")) return "";
  const jam = props.row?.waktuPanggilan ? epochToDate(Number(props.row.waktuPanggilan), "time") : "";
  if (statusPanggilan.value === 1) return `Dipanggil ${jam}`.trim();
  if (statusPanggilan.value === 2) return "Terlewat";
  return "";
});

const sedangMemanggil = ref(false);
const panggil = async () => {
  sedangMemanggil.value = true;
  try {
    if (await panggilPasien(props.row)) emit("diperbarui");
  } finally {
    sedangMemanggil.value = false;
  }
};
</script>

<template>
  <div class="flex flex-col items-start gap-1">
    <CustomChip :showCheckedIcon="false" :label="label" customClass="h-5 pr-[9px] mr-[5px] border-none" :bgColor="warna" textColor="text-white" />
    <CustomChip :showCheckedIcon="false" :label="bayar.label" customClass="h-5 mr-[5px] border-none whitespace-nowrap" :bgColor="bayar.bg" :textColor="bayar.text" />
    <div v-if="bisaDipanggil" class="flex items-center gap-1">
      <button
        type="button"
        class="flex items-center gap-1 rounded-md bg-[#3D84E5] px-2 py-[3px] text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
        :disabled="sedangMemanggil"
        :title="statusPanggilan === 1 ? 'Panggil ulang pasien ini' : 'Panggil pasien ini ke layar antrian'"
        @click.stop="panggil"
      >
        <AnnouncementIcon :size="14" class="text-white" />
        {{ statusPanggilan === 1 ? "Panggil Ulang" : "Panggil" }}
      </button>
    </div>
    <span v-if="keteranganPanggilan" class="text-[11px] text-grey-400">{{ keteranganPanggilan }}</span>
  </div>
</template>
