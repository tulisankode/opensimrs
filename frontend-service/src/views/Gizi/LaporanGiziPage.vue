<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { izinGizi, keTanggal, laporanCakupanSkriningGizi, laporanJumlahDietGizi, referensiGizi } from "@/stores/penunjang/gizi";

// Laporan Gizi: jumlah pasien rawat inap aktif per jenis diet (order berlaku) & cakupan skrining gizi (≤1x24 jam).
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinGizi("Laporan Gizi", aksi);

const ruanganRef = ref<any[]>([]);
const ruanganUuid = ref("");
const tanggalMulai = ref<Date>(new Date(Date.now() - 29 * 86400 * 1000));
const tanggalSelesai = ref<Date>(new Date());

const jumlahDiet = ref<any[]>([]);
const cakupan = ref<any>(null);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const [resDiet, resCakupan] = await Promise.all([
      laporanJumlahDietGizi({ ruangan_uuid: ruanganUuid.value }),
      laporanCakupanSkriningGizi({ tanggal_mulai: keTanggal(tanggalMulai.value), tanggal_selesai: keTanggal(tanggalSelesai.value) }),
    ]);
    jumlahDiet.value = resDiet?.payload ?? [];
    cakupan.value = resCakupan?.payload ?? null;
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(async () => {
  const res = await referensiGizi();
  ruanganRef.value = res?.payload?.ruangan ?? [];
  muat();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden gap-3">
    <Card pt:body:class="pt-0" class="flex-none">
      <template #header>
        <PageToolbar>
          <h1 class="toolbar-heading text-opensimrs-300">Laporan Gizi</h1>
          <CustomDatePicker v-model="tanggalMulai" label="Tanggal Mulai" @update:modelValue="muat" />
          <CustomDatePicker v-model="tanggalSelesai" label="Tanggal Selesai" @update:modelValue="muat" />
          <CustomSelect v-model="ruanganUuid" label="Ruangan (jumlah diet)" :options="ruanganRef" optionValue="uuid" optionLabel="nama" @update:modelValue="muat" />
          <CustomButton icon="PhArrowClockwise" label="Muat" @click="muat" />
        </PageToolbar>
      </template>
    </Card>

    <div class="grid grid-cols-2 gap-3 overflow-auto">
      <Card v-if="boleh('READ')" pt:body:class="pt-0">
        <template #header><div class="px-4 pt-4 font-semibold text-opensimrs-300">Jumlah Pasien per Jenis Diet <span class="font-normal text-xs text-grey-400">(pasien dirawat saat ini, tanpa filter tanggal)</span></div></template>
        <template #content>
          <NoData v-if="!jumlahDiet.length" />
          <DataTable v-else :value="jumlahDiet" stripedRows class="text-xs">
            <Column field="namaDiet" header="Jenis Diet" headerClass="bg-opensimrs-50" />
            <Column field="jumlahPasien" header="Jumlah Pasien" headerClass="bg-opensimrs-50" />
          </DataTable>
        </template>
      </Card>

      <Card v-if="boleh('READ') && cakupan" pt:body:class="pt-0">
        <template #header><div class="px-4 pt-4 font-semibold text-opensimrs-300">Cakupan Skrining Gizi</div></template>
        <template #content>
          <div class="p-4 space-y-2 text-sm">
            <div>Total pasien rawat inap baru: <b>{{ cakupan.totalPasien }}</b></div>
            <div>Terskrining tepat waktu (≤1×24 jam): <b>{{ cakupan.terskriningTepatWaktu }}</b></div>
            <div>Persentase cakupan: <b>{{ cakupan.persentase }}%</b></div>
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>
