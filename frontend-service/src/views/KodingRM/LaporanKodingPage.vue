<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { JENIS_KUNJUNGAN, keTanggalKoding, detikKeJam, laporanDasborKoding, laporanIndeksKoding, laporanProduktivitasKoder, laporanRlKoding, laporanSepuluhBesarKoding } from "@/stores/penunjang/koding";

// Laporan Koding Rekam Medis: dasbor (target waktu koding RI ≤ 2×24 jam), indeks penyakit/tindakan, 10 besar
// penyakit, data RL (morbiditas/mortalitas), dan produktivitas koder — seluruhnya hanya dari hasil koding
// terverifikasi (status siap_klaim).
const storeUtils = utilsStore();
const tab = ref("dasbor");
const gantiTab = (v: string | number) => (tab.value = String(v));

const awalBulan = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};
const tglMulai = ref<Date | null>(awalBulan());
const tglSelesai = ref<Date | null>(new Date());

const dasbor = ref<any>(null);
const indeks = ref<any[]>([]);
const jenisIndeks = ref<"diagnosis" | "tindakan">("diagnosis");
const sepuluhBesar = ref<any[]>([]);
const jenisSepuluhBesar = ref<string[]>([]);
const rl = ref<{ morbiditas: any[]; mortalitas: any[] } | null>(null);
const produktivitas = ref<any[]>([]);

const rentang = () => ({ tanggal_mulai: keTanggalKoding(tglMulai.value), tanggal_sampai: keTanggalKoding(tglSelesai.value ?? tglMulai.value) });

const muatSemua = async () => {
  storeUtils.setLoading(true);
  try {
    const r = rentang();
    const [d, i, s, l, p] = await Promise.all([
      laporanDasborKoding(r),
      laporanIndeksKoding({ ...r, jenis: jenisIndeks.value, limit: 50 }),
      laporanSepuluhBesarKoding({ ...r, jenis_kunjungan: jenisSepuluhBesar.value }),
      laporanRlKoding(r),
      laporanProduktivitasKoder(r),
    ]);
    dasbor.value = d?.payload ?? null;
    indeks.value = i?.payload?.data ?? [];
    sepuluhBesar.value = s?.payload ?? [];
    rl.value = l?.payload ?? null;
    produktivitas.value = p?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
const reset = () => {
  tglMulai.value = awalBulan();
  tglSelesai.value = new Date();
  muatSemua();
};

const persenTepatWaktu = computed(() => (dasbor.value?.kodingRi?.jumlahFinal ? Math.round((dasbor.value.kodingRi.tepatWaktu / dasbor.value.kodingRi.jumlahFinal) * 100) : 0));

onMounted(muatSemua);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muatSemua" />
          <h1 class="toolbar-heading text-opensimrs-300">Laporan Koding Rekam Medis</h1>
          <CustomDatePicker v-model="tglMulai" label="Tanggal mulai" class="toolbar-field--date" :maxDate="tglSelesai ?? undefined" />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker v-model="tglSelesai" label="Tanggal selesai" class="toolbar-field--date" :minDate="tglMulai ?? undefined" />
          <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" @click="muatSemua" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="reset" />
        </PageToolbar>
      </template>
      <template #content>
        <Tabs :value="tab" class="flex flex-col h-full" @update:value="gantiTab">
          <TabList>
            <Tab value="dasbor">Dasbor</Tab>
            <Tab value="indeks">Indeks Penyakit & Tindakan</Tab>
            <Tab value="sepuluh">10 Besar Penyakit</Tab>
            <Tab value="rl">Data RL</Tab>
            <Tab value="produktivitas">Produktivitas Koder</Tab>
          </TabList>
          <TabPanels class="overflow-auto grow">
            <TabPanel value="dasbor">
              <NoData v-if="!dasbor" />
              <div v-else class="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div class="p-3 border rounded-lg border-grey-75">
                  <div class="text-xs text-grey-400">Koding RI Final (target ≤ {{ detikKeJam(dasbor.targetKodingDetik) }})</div>
                  <div class="text-lg font-semibold text-opensimrs-400">{{ dasbor.kodingRi?.jumlahFinal ?? 0 }}</div>
                </div>
                <div class="p-3 border rounded-lg border-grey-75">
                  <div class="text-xs text-grey-400">Tepat Waktu</div>
                  <div class="text-lg font-semibold text-opensimrs-400">{{ dasbor.kodingRi?.tepatWaktu ?? 0 }} ({{ persenTepatWaktu }}%)</div>
                </div>
                <div class="p-3 border rounded-lg border-grey-75">
                  <div class="text-xs text-grey-400">Belum Dikoding (periode)</div>
                  <div class="text-lg font-semibold text-opensimrs-400">{{ dasbor.belumDikoding ?? 0 }}</div>
                </div>
                <div class="p-3 border rounded-lg border-grey-75">
                  <div class="text-xs text-grey-400">Item Checklist Belum Lengkap</div>
                  <div class="text-lg font-semibold text-opensimrs-400">{{ dasbor.checklistItemTidakLengkap ?? 0 }}</div>
                </div>
              </div>
            </TabPanel>

            <TabPanel value="indeks">
              <div class="flex justify-end mb-3">
                <CustomSelect v-model="jenisIndeks" :options="[{ value: 'diagnosis', label: 'Diagnosis (ICD-10)' }, { value: 'tindakan', label: 'Tindakan (ICD-9-CM)' }]" optionLabel="label" optionValue="value" @update:modelValue="muatSemua" />
              </div>
              <NoData v-if="!indeks.length" />
              <DataTable v-else :value="indeks" stripedRows class="text-xs">
                <Column field="kode" header="Kode" headerClass="bg-opensimrs-50" />
                <Column field="nama" header="Nama" headerClass="bg-opensimrs-50" />
                <Column field="jumlah" header="Jumlah" headerClass="bg-opensimrs-50" />
              </DataTable>
            </TabPanel>

            <TabPanel value="sepuluh">
              <NoData v-if="!sepuluhBesar.length" />
              <DataTable v-else :value="sepuluhBesar" stripedRows class="text-xs">
                <Column header="No." headerClass="bg-opensimrs-50" class="w-[50px]">
                  <template #body="{ index }">{{ index + 1 }}</template>
                </Column>
                <Column field="kode" header="Kode ICD-10" headerClass="bg-opensimrs-50" />
                <Column field="nama" header="Diagnosis Utama" headerClass="bg-opensimrs-50" />
                <Column field="jumlah" header="Jumlah" headerClass="bg-opensimrs-50" />
              </DataTable>
            </TabPanel>

            <TabPanel value="rl">
              <div class="grid gap-5 lg:grid-cols-2">
                <div>
                  <div class="mb-2 font-semibold">Morbiditas (per jenis kunjungan)</div>
                  <NoData v-if="!rl?.morbiditas?.length" />
                  <DataTable v-else :value="rl.morbiditas" stripedRows class="text-xs">
                    <Column header="Kunjungan" headerClass="bg-opensimrs-50">
                      <template #body="{ data: r }">{{ JENIS_KUNJUNGAN[r.kunjunganTipe as 'rj'] ?? r.kunjunganTipe }}</template>
                    </Column>
                    <Column field="kode" header="Kode" headerClass="bg-opensimrs-50" />
                    <Column field="nama" header="Diagnosis" headerClass="bg-opensimrs-50" />
                    <Column field="gender" header="JK" headerClass="bg-opensimrs-50" />
                    <Column field="jumlah" header="Jumlah" headerClass="bg-opensimrs-50" />
                  </DataTable>
                </div>
                <div>
                  <div class="mb-2 font-semibold">Mortalitas (kondisi pulang meninggal)</div>
                  <NoData v-if="!rl?.mortalitas?.length" />
                  <DataTable v-else :value="rl.mortalitas" stripedRows class="text-xs">
                    <Column field="kode" header="Kode" headerClass="bg-opensimrs-50" />
                    <Column field="nama" header="Diagnosis" headerClass="bg-opensimrs-50" />
                    <Column field="jumlah" header="Jumlah" headerClass="bg-opensimrs-50" />
                  </DataTable>
                </div>
              </div>
            </TabPanel>

            <TabPanel value="produktivitas">
              <NoData v-if="!produktivitas.length" />
              <DataTable v-else :value="produktivitas" stripedRows class="text-xs">
                <Column field="koderUuid" header="Koder" headerClass="bg-opensimrs-50" />
                <Column field="jumlahFinalisasi" header="Jumlah Kunjungan Dikoding" headerClass="bg-opensimrs-50" />
                <Column header="Rerata Waktu Koding" headerClass="bg-opensimrs-50">
                  <template #body="{ data: r }">{{ detikKeJam(r.rerataWaktuKodingDetik) }}</template>
                </Column>
              </DataTable>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </template>
    </Card>
  </div>
</template>
