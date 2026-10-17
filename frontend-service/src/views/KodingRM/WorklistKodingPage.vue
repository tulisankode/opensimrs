<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { useLokasiStore } from "@/stores/datamaster/lokasi";
import {
  JENIS_KUNJUNGAN,
  gayaKoding,
  keTanggalKoding,
  labelPenjamin,
  waktuKoding,
  worklistKoding,
} from "@/stores/penunjang/koding";

// Worklist Koding: kunjungan RJ/RI/IGD yang sudah pulang, difilter penjamin/ruangan/tanggal pulang/status koding.
const storeUtils = utilsStore();
const router = useRouter();

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const tglMulai = ref<Date | null>(null);
const tglSelesai = ref<Date | null>(null);
const filterJenis = ref<string[]>([]);
const filterPenjamin = ref<string[]>([]);
const filterLokasi = ref<string>("");
const filterStatus = ref<string>("");
const lokasiOpsi = ref<any[]>([]);

const toggleJenis = (v: string) => (filterJenis.value = filterJenis.value.includes(v) ? filterJenis.value.filter((x) => x !== v) : [...filterJenis.value, v]);
const togglePenjamin = (v: string) => (filterPenjamin.value = filterPenjamin.value.includes(v) ? filterPenjamin.value.filter((x) => x !== v) : [...filterPenjamin.value, v]);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await worklistKoding({
      page: page.value,
      limit: limit.value,
      jenis_kunjungan: filterJenis.value,
      penjamin: filterPenjamin.value,
      lokasi_uuid: filterLokasi.value,
      status_koding: filterStatus.value,
      tanggal_pulang_mulai: keTanggalKoding(tglMulai.value),
      tanggal_pulang_sampai: keTanggalKoding(tglSelesai.value ?? tglMulai.value),
    });
    data.value = res?.payload?.data ?? [];
    total.value = res?.payload?.pagination?.total ?? 0;
  } finally {
    storeUtils.setLoading(false);
  }
};
const cariData = () => {
  page.value = 1;
  muat();
};
const reset = () => {
  tglMulai.value = null;
  tglSelesai.value = null;
  filterJenis.value = [];
  filterPenjamin.value = [];
  filterLokasi.value = "";
  filterStatus.value = "";
  cariData();
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};
const bukaKunjungan = (d: any) => router.push(`/koding-rm/kunjungan/${d.kunjunganTipe}/${d.kunjunganUuid}`);

onMounted(async () => {
  lokasiOpsi.value = (await useLokasiStore().exportApi())?.payload ?? [];
  muat();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Worklist Koding</h1>
          <CustomDatePicker v-model="tglMulai" label="Tgl. pulang mulai" class="toolbar-field--date" :maxDate="tglSelesai ?? undefined" />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker v-model="tglSelesai" label="Tgl. pulang sampai" class="toolbar-field--date" :minDate="tglMulai ?? undefined" />
          <ToolbarFilterMenu :count="filterJenis.length">
            <template #label>Jenis Kunjungan</template>
            <CustomChip v-for="(l, kode) in JENIS_KUNJUNGAN" :key="kode" :label="l" :value="String(kode)" :isSelected="filterJenis.includes(String(kode))" @selected="toggleJenis" />
          </ToolbarFilterMenu>
          <ToolbarFilterMenu :count="filterPenjamin.length">
            <template #label>Penjamin</template>
            <CustomChip label="Tunai" value="1" :isSelected="filterPenjamin.includes('1')" @selected="togglePenjamin" />
            <CustomChip label="Asuransi" value="2" :isSelected="filterPenjamin.includes('2')" @selected="togglePenjamin" />
          </ToolbarFilterMenu>
          <CustomSelect v-model="filterLokasi" label="Ruangan" :options="lokasiOpsi" optionLabel="name" optionValue="uuid" placeHolder="Semua ruangan" />
          <CustomSelect
            v-model="filterStatus"
            label="Status Koding"
            :options="[{ value: 'belum', label: 'Belum Dikoding' }, { value: 'proses', label: 'Dalam Proses' }, { value: 'siap_klaim', label: 'Siap Klaim' }]"
            optionLabel="label"
            optionValue="value"
            placeHolder="Semua status"
          />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="reset" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs cursor-pointer" scrollable scrollHeight="flex" tableStyle="min-width: 64rem" @rowClick="bukaKunjungan($event.data)">
          <Column header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.namaPasien ?? "-" }}</div>
              <div class="text-grey-400">{{ d.noRm }}</div>
            </template>
          </Column>
          <Column header="Kunjungan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div>{{ JENIS_KUNJUNGAN[d.kunjunganTipe as 'rj'] ?? d.kunjunganTipe }} · {{ d.noReg }}</div>
              <div class="text-grey-400">{{ labelPenjamin(d.paymentMethod) }} · {{ d.lokasiNama ?? "-" }}</div>
            </template>
          </Column>
          <Column header="Tgl. Pulang" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ waktuKoding(d.dischargeDate) }}</template>
          </Column>
          <Column header="Status Koding" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap" :class="[gayaKoding(d.statusKoding)?.bg, gayaKoding(d.statusKoding)?.text]">
                {{ gayaKoding(d.statusKoding)?.label }}
              </span>
            </template>
          </Column>
          <Column header="Finalisasi" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.finalisasiAt ? waktuKoding(d.finalisasiAt) : "-" }}</template>
          </Column>
          <Column header="" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><CustomButton label="Buka" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click.stop="bukaKunjungan(d)" /></template>
          </Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>
  </div>
</template>
