<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { izinCssd, keEpoch, laporanKegagalanCssd, laporanSetBermasalahCssd, laporanVolumeCssd, waktuRingkas } from "@/stores/penunjang/cssd";

// Laporan CSSD: volume sterilisasi per unit/metode/periode, kegagalan indikator & Bowie-Dick, set hilang/rusak (KF-24).
const storeUtils = utilsStore();
const bolehCetak = izinCssd("Laporan CSSD", "CETAK LAPORAN");

const awalBulan = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};
const tglMulai = ref<Date | null>(awalBulan());
const tglSelesai = ref<Date | null>(new Date());

const volume = ref<any[]>([]);
const kegagalan = ref<any>(null);
const setBermasalah = ref<any[]>([]);
const tab = ref("volume");

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const dari = keEpoch(tglMulai.value);
    const sampai = keEpoch(tglSelesai.value);
    const [v, k, s] = await Promise.all([laporanVolumeCssd({ dari, sampai }), laporanKegagalanCssd({ dari, sampai }), laporanSetBermasalahCssd({ dari, sampai })]);
    volume.value = v?.payload ?? [];
    kegagalan.value = k?.payload ?? null;
    setBermasalah.value = s?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Laporan CSSD</h1>
          <CustomDatePicker v-model="tglMulai" label="Tanggal mulai" class="toolbar-field--date" :maxDate="tglSelesai ?? undefined" />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker v-model="tglSelesai" label="Tanggal selesai" class="toolbar-field--date" :minDate="tglMulai ?? undefined" />
          <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" @click="muat" />
        </PageToolbar>
      </template>
      <template #content>
        <Tabs :value="tab" class="flex flex-col h-full" @update:value="(v: any) => (tab = v)">
          <TabList>
            <Tab value="volume">Volume Sterilisasi</Tab>
            <Tab value="kegagalan">Kegagalan Indikator</Tab>
            <Tab value="bermasalah">Set Hilang/Rusak</Tab>
          </TabList>
          <TabPanels class="overflow-auto grow">
            <TabPanel value="volume">
              <NoData v-if="!volume.length" />
              <DataTable v-else :value="volume" stripedRows class="text-xs">
                <Column field="tanggal" header="Tanggal" headerClass="bg-opensimrs-50" />
                <Column field="namaMesin" header="Mesin" headerClass="bg-opensimrs-50" />
                <Column field="metode" header="Metode" headerClass="bg-opensimrs-50" />
                <Column field="jumlahLoad" header="Jumlah Load" headerClass="bg-opensimrs-50" />
                <Column field="jumlahSet" header="Jumlah Set" headerClass="bg-opensimrs-50" />
              </DataTable>
            </TabPanel>

            <TabPanel value="kegagalan">
              <div class="grid grid-cols-2 gap-3 mb-4">
                <div class="p-3 border rounded-lg border-grey-75">
                  <div class="text-xs text-grey-400">Load Gagal</div>
                  <div class="text-lg font-semibold text-danger-300">{{ kegagalan?.ringkasan?.jumlahLoadGagal ?? 0 }}</div>
                </div>
                <div class="p-3 border rounded-lg border-grey-75">
                  <div class="text-xs text-grey-400">Bowie-Dick Gagal</div>
                  <div class="text-lg font-semibold text-danger-300">{{ kegagalan?.ringkasan?.jumlahBowieDickGagal ?? 0 }}</div>
                </div>
              </div>
              <h3 class="mb-2 text-sm font-semibold">Load Gagal</h3>
              <NoData v-if="!kegagalan?.loadGagal?.length" />
              <DataTable v-else :value="kegagalan.loadGagal" stripedRows class="mb-4 text-xs">
                <Column field="nomorLoad" header="Load" headerClass="bg-opensimrs-50" />
                <Column field="metode" header="Metode" headerClass="bg-opensimrs-50" />
                <Column field="hasilIndikatorKimia" header="Kimia" headerClass="bg-opensimrs-50" />
                <Column field="hasilIndikatorBiologi" header="Biologi" headerClass="bg-opensimrs-50" />
                <Column header="Mulai" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ waktuRingkas(d.waktuMulai) }}</template>
                </Column>
              </DataTable>
              <h3 class="mb-2 text-sm font-semibold">Bowie-Dick Gagal</h3>
              <NoData v-if="!kegagalan?.bowieDickGagal?.length" />
              <DataTable v-else :value="kegagalan.bowieDickGagal" stripedRows class="text-xs">
                <Column field="namaMesin" header="Mesin" headerClass="bg-opensimrs-50" />
                <Column field="tanggal" header="Tanggal" headerClass="bg-opensimrs-50" />
                <Column field="catatan" header="Catatan" headerClass="bg-opensimrs-50" />
              </DataTable>
            </TabPanel>

            <TabPanel value="bermasalah">
              <NoData v-if="!setBermasalah.length" />
              <DataTable v-else :value="setBermasalah" stripedRows class="text-xs">
                <Column field="namaSet" header="Jenis Set" headerClass="bg-opensimrs-50" />
                <Column field="kodeSetFisik" header="Kode Set Fisik" headerClass="bg-opensimrs-50" />
                <Column field="kodeBarcode" header="Barcode" headerClass="bg-opensimrs-50" />
                <Column field="status" header="Status" headerClass="bg-opensimrs-50" />
                <Column header="Diperbarui" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ waktuRingkas(d.updatedAt) }}</template>
                </Column>
              </DataTable>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </template>
    </Card>
  </div>
</template>
