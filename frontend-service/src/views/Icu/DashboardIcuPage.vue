<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { useIcuStore } from "@/stores/rawatInap/icu";

// Dasbor ruang intensif: satu kartu per bed terisi (episode icu_perawatans aktif), dengan ventilator & peringatan
// nilai kritis dari observasi terakhir (KF-14/KT-10).
const layananKode = ref(""); const ruanganUuid = ref("");
const pilihanLayanan = [{ kode: '', nama: 'Semua layanan' }, { kode: 'umum', nama: 'ICU Umum' }, { kode: 'burn', nama: 'Burn ICU' }, { kode: 'neuro', nama: 'Neuro ICU' }, { kode: 'belum_diklasifikasikan', nama: 'Belum diklasifikasikan' }];
const storeUtils = utilsStore();
const icuStore = useIcuStore();
const router = useRouter();

const data = ref<any[]>([]);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await icuStore.getDashboard({ layananKode: layananKode.value || undefined, ruanganUuid: ruanganUuid.value || undefined });
    data.value = res?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};

const hariRawatLabel = (hari: number) => (hari <= 1 ? "Hari ke-1" : `Hari ke-${hari}`);
const bukaPerawatan = (perawatanUuid: string) => router.push({ path: "/icu/perawatan", query: { perawatan: perawatanUuid } });

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomSelect v-model="layananKode" label="Layanan" :options="pilihanLayanan" optionValue="kode" optionLabel="nama" />
          <CustomTextfield v-model="ruanganUuid" label="UUID unit (opsional)" />
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Dasbor ICU / Intensif</h1>
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <div v-else class="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="p in data"
            :key="p.perawatanUuid"
            class="flex flex-col gap-2 p-4 border rounded-lg cursor-pointer border-grey-75 hover:border-opensimrs-300"
            @click="bukaPerawatan(p.perawatanUuid)"
          >
            <div class="flex items-start justify-between">
              <div>
                <div class="font-semibold">{{ p.namaPasien ?? "-" }}</div>
                <div class="text-xs text-grey-400">{{ p.noRm }} · Bed {{ p.bed?.noBed ?? "-" }} ({{ p.bed?.ruangan ?? "-" }})</div>
              </div>
              <span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-opensimrs-50 text-opensimrs-300">{{ hariRawatLabel(p.hariRawat) }}</span>
            </div>
            <p class="text-sm">{{ p.layananNama }}<span v-if="p.kelengkapan"> - {{ p.kelengkapan.status }}</span></p>
            <div class="text-sm text-grey-500">{{ p.diagnosisRingkas || "Diagnosis belum diisi" }}</div>
            <div class="flex items-center gap-2 text-xs">
              <span v-if="p.ventilator?.terpasang" class="px-2 py-0.5 font-semibold rounded-full bg-warning-50 text-warning-400">
                Ventilator · {{ p.ventilator?.mode ?? "-" }}
              </span>
              <span v-else class="px-2 py-0.5 text-grey-400">Tanpa ventilator</span>
            </div>
            <div v-if="p.observasiTerakhir" class="grid grid-cols-2 text-xs gap-x-2 text-grey-500">
              <span>TD: {{ p.observasiTerakhir.tekananSistolik ?? "-" }}/{{ p.observasiTerakhir.tekananDiastolik ?? "-" }}</span>
              <span>Nadi: {{ p.observasiTerakhir.nadi ?? "-" }}</span>
              <span>SpO2: {{ p.observasiTerakhir.spo2 ?? "-" }}%</span>
              <span>Suhu: {{ p.observasiTerakhir.suhu ?? "-" }}°C</span>
            </div>
            <div v-else class="text-xs text-grey-400">Belum ada observasi</div>
            <div v-if="p.peringatan?.length" class="flex flex-col gap-1">
              <span v-for="(pe, i) in p.peringatan" :key="i" class="px-2 py-0.5 text-xs font-semibold rounded bg-danger-50 text-danger-400">{{ pe }}</span>
            </div>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
