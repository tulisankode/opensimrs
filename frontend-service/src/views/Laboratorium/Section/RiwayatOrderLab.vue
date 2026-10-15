<script setup lang="ts">
import { computed, ref, watch } from "vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import { useHasilPemeriksaanLab } from "@/stores/Laboratorium/hasilPemeriksaan";
import { epochToDate } from "@/utils/Helpers";

// Riwayat pemeriksaan laboratorium pasien (berdasarkan No. RM) untuk Hasil Pemeriksaan & Expertise.
// Order lain milik pasien ditampilkan terbaru lebih dulu; hasil per item dimuat saat order dibuka.
const props = defineProps<{ visible: boolean; order: any }>();
const emit = defineEmits(["update:visible"]);
const store = useHasilPemeriksaanLab();

const STATUS: Record<number, { label: string; bg: string; text: string }> = {
  0: { label: "Batal", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
  1: { label: "Order", bg: "bg-opensimrs-50", text: "text-opensimrs-300" },
  2: { label: "Periksa", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  3: { label: "Selesai", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
};
const PELAYANAN: Record<string, string> = { rajal: "Rawat Jalan", ranap: "Rawat Inap", igd: "IGD", aps: "APS" };

const noRm = computed(() => props.order?.noRm ?? props.order?.patient?.noRm ?? "");
const daftar = ref<any[]>([]);
const memuat = ref(false);
const terbuka = ref<string | null>(null);
const hasil = ref<Record<string, any[] | null>>({});

const tanggal = (ms: any) => {
  const n = Number(ms);
  if (!n) return "-";
  return epochToDate(n > 1e12 ? Math.floor(n / 1000) : n, "dateTime") as string;
};

const muat = async () => {
  if (!noRm.value) return;
  memuat.value = true;
  try {
    const res = await store.getApi({ search: noRm.value, limit: 50 });
    const data = res?.payload?.data ?? res?.payload ?? [];
    daftar.value = data
      .filter((o: any) => o.noRm === noRm.value)
      .sort((a: any, b: any) => Number(b.tglOrder) - Number(a.tglOrder));
  } finally {
    memuat.value = false;
  }
};

const buka = async (o: any) => {
  terbuka.value = terbuka.value === o.uuid ? null : o.uuid;
  if (!terbuka.value || hasil.value[o.uuid] !== undefined) return;
  hasil.value[o.uuid] = null;
  const res = await store.getDetailTarif(o.uuid);
  hasil.value[o.uuid] = res?.payload?.hasilPemeriksaan ?? [];
};

watch(
  () => props.visible,
  (v) => {
    if (v) muat();
  }
);
</script>

<template>
  <CustomDialog
    :visible="visible"
    @update:visible="emit('update:visible', $event)"
    position="bottomright"
    headerHeight="h-5"
    width="480px"
    closeIcon="PhTextIndent"
  >
    <template #header>
      <div class="flex">
        <PhClockCounterClockwise color="white" :size="20" weight="bold" class="my-auto" />
        <span class="ml-[10px] text-normal">Riwayat Pemeriksaan · RM {{ noRm || "-" }}</span>
      </div>
    </template>
    <template #body>
      <div class="h-[60vh] overflow-auto text-SM">
        <div v-if="memuat" class="py-6 text-center text-grey-400">Memuat riwayat…</div>
        <div v-else-if="!daftar.length" class="py-6 text-center text-grey-400">Belum ada riwayat pemeriksaan laboratorium.</div>
        <div v-for="o in daftar" :key="o.uuid" class="border-b border-grey-100">
          <button class="flex w-full items-start gap-2 py-[10px] text-left" @click="buka(o)">
            <div class="flex-1">
              <div class="font-semibold">
                {{ tanggal(o.tglOrder) }} · {{ o.noOrder }}
                <span v-if="o.uuid === order?.uuid" class="font-normal text-opensimrs-300">(order ini)</span>
              </div>
              <div class="text-grey-400">
                {{ PELAYANAN[o.pelayanan] ?? o.pelayanan }} · {{ o.lokasi?.name ?? "-" }} ·
                {{ [o.dokterPengirim?.pegawai?.firstTitle, o.dokterPengirim?.pegawai?.name, o.dokterPengirim?.pegawai?.lastTitle].filter(Boolean).join(" ") || "-" }}
              </div>
            </div>
            <CustomChip
              :label="STATUS[o.orderStatus]?.label ?? String(o.orderStatus)"
              :showCheckedIcon="false"
              :bgColor="STATUS[o.orderStatus]?.bg"
              borderColor="border-transparent"
              :textColor="STATUS[o.orderStatus]?.text"
              customClass="h-5 pr-[6px]"
            />
          </button>
          <div v-if="terbuka === o.uuid" class="pb-[10px] pl-2">
            <div v-if="hasil[o.uuid] === null" class="text-grey-400">Memuat hasil…</div>
            <div v-else-if="!hasil[o.uuid]?.length" class="text-grey-400">Belum ada hasil pemeriksaan.</div>
            <table v-else class="w-full">
              <tr class="text-grey-400">
                <td>Pemeriksaan</td>
                <td>Hasil</td>
                <td>Rujukan</td>
              </tr>
              <tr v-for="h in hasil[o.uuid]" :key="h.uuid">
                <td>{{ h.itemPemeriksaan?.name ?? "-" }}</td>
                <td :class="h.flag ? 'font-semibold text-[#B42318]' : 'font-semibold'">
                  {{ h.result ?? "-" }} {{ h.itemPemeriksaan?.satuan && h.itemPemeriksaan.satuan !== "-" ? h.itemPemeriksaan.satuan : "" }}
                  <span v-if="h.flag">({{ h.flag }})</span>
                </td>
                <td class="text-grey-400">{{ h.itemPemeriksaan?.nilaiRujukan ?? "-" }}</td>
              </tr>
            </table>
          </div>
        </div>
      </div>
    </template>
    <template #customCloseIcon>
      <MenuOpenIcon class="text-white" />
    </template>
  </CustomDialog>
</template>
