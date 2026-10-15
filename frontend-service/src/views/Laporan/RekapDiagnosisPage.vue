<script setup lang="ts">
import { ref } from "vue";
import HeaderFilter from "./Layout/HeaderFilter.vue";
import FooterPaginator from "./Layout/FooterPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { useRekapLaporan, JENIS_KUNJUNGAN, OPSI_JENIS_KUNJUNGAN } from "./useRekapLaporan";

const OPSI_GENDER = [
  { value: "Male", label: "Laki-Laki" },
  { value: "Female", label: "Perempuan" },
];

// Kelompok umur sesuai kolom dari laporan-service
const KELOMPOK_UMUR = [
  { key: "age<1", label: "<1 Thn" },
  { key: "age1-4", label: "1-4 Thn" },
  { key: "age5-14", label: "5-14 Thn" },
  { key: "age15-24", label: "15-24 Thn" },
  { key: "age25-44", label: "25-44 Thn" },
  { key: "age45-64", label: "45-64 Thn" },
  { key: "age65+", label: "65+ Thn" },
];

// Pisahkan kode ICD di awal teks diagnosis (mis. "J06.9 ISPA") bila ada
const pecahDiagnosis = (teks: string) => {
  const match = /^([A-Z]\d{2}(?:\.\d+)?)\s*[-–]?\s*(.*)$/.exec(teks ?? "");
  return match ? { kode: match[1], nama: match[2] || match[1] } : { kode: "-", nama: teks ?? "-" };
};

// Baris backend per (diagnosis, gender, jenis kunjungan) → satu baris per (diagnosis, jenis kunjungan) dengan LK/PR
const pivot = (data: any[]) => {
  const map = new Map<string, any>();
  for (const row of data) {
    const key = `${row.diagnosis}|${row.visitType}`;
    if (!map.has(key)) {
      const { kode, nama } = pecahDiagnosis(row.diagnosis);
      map.set(key, {
        kode,
        diagnosis: nama,
        visitType: row.visitType,
        total: 0,
        umur: Object.fromEntries(KELOMPOK_UMUR.map((k) => [k.key, { laki: 0, perempuan: 0 }])),
      });
    }
    const item = map.get(key);
    const jk = row.gender === "Female" ? "perempuan" : "laki";
    for (const k of KELOMPOK_UMUR) item.umur[k.key][jk] += Number(row[k.key] ?? 0);
    item.total += Number(row.total ?? 0);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
};

const rekap = useRekapLaporan("diagnosis", "Rekapitulasi Diagnosis berdasarkan Umur Pasien", pivot);
const { rows, totalRecords, pageSize, offset, jenisKunjungan, filterKedua, startDate, endDate } = rekap;
const headerRef = ref();

const exportExcel = () =>
  rekap.exportExcel([
    { header: "Kode", value: (row) => row.kode },
    { header: "Diagnosis", value: (row) => row.diagnosis },
    { header: "Jenis Kunjungan", value: (row) => JENIS_KUNJUNGAN[row.visitType] ?? row.visitType },
    ...KELOMPOK_UMUR.flatMap((k) => [
      { header: `${k.label} LK`, value: (row: any) => row.umur[k.key].laki },
      { header: `${k.label} PR`, value: (row: any) => row.umur[k.key].perempuan },
    ]),
    { header: "Total", value: (row) => row.total },
  ]);
</script>
<template>
  <Card
    pt:body:class="h-full pt-0 overflow-auto"
    pt:content:class="h-full overflow-auto"
  >
    <template #header>
      <HeaderFilter
        ref="headerRef"
        pageType="rekapitulasi-diagnosis"
        :selectOption="OPSI_JENIS_KUNJUNGAN"
        :selectOptionSecond="OPSI_GENDER"
        @update:selected-filter="(value: string) => (jenisKunjungan = value)"
        @update:selected-filter-second="(value: string) => (filterKedua = value)"
        @update:startDateFilter="(value: Date) => (startDate = value)"
        @update:endDateFilter="(value: Date) => (endDate = value)"
        @search="rekap.cari"
        @reload-data="rekap.fetchData"
        @reset="rekap.resetFilter(headerRef)"
      />
    </template>
    <template #content>
      <DataTable
        v-if="rows.length"
        :value="rows"
        tableStyle="min-width: 50rem"
        stripedRows
        scrollable
        scrollHeight="flex"
        class="text-xs"
        :dt="{
          rowSelectedColor: '#000000',
          rowSelectedBackground: 'transparent',
          bodyCellSelectedBorderColor: 'transparent',
          bodyCellBorderColor: 'transparent',
          rowStripedBackground: '#F8F8F8',
        }"
      >
        <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
          <template #header>
            <div class="flex items-center justify-center w-full">No.</div>
          </template>
          <template #body="slotProps">
            <div class="flex items-center justify-center">
              {{ offset + slotProps.index + 1 }}
            </div>
          </template>
        </Column>
        <Column field="kode" header="Kode" headerClass="bg-opensimrs-50"></Column>
        <Column class="w-1/4" field="diagnosis" header="Diagnosis" headerClass="bg-opensimrs-50"></Column>
        <Column header="Kunjungan" headerClass="bg-opensimrs-50">
          <template #body="{ data }">{{ JENIS_KUNJUNGAN[data.visitType] ?? data.visitType }}</template>
        </Column>
        <Column v-for="kelompok in KELOMPOK_UMUR" :key="kelompok.key" headerClass="bg-opensimrs-50 font-semibold text-SM">
          <template #header>
            <div class="flex items-center justify-center w-full">{{ kelompok.label }}</div>
          </template>
          <template #body="{ data }">
            <div class="flex flex-col items-center w-full">
              <div class="flex">
                LK <ArrowRightBrokenIcon class="text-blue-300" />
                {{ data.umur[kelompok.key].laki }}
              </div>
              <div class="flex">
                PR <ArrowRightBrokenIcon class="text-female-300" />
                {{ data.umur[kelompok.key].perempuan }}
              </div>
            </div>
          </template>
        </Column>
        <Column field="total" header="Total" headerClass="bg-opensimrs-50"></Column>
      </DataTable>
      <NoData v-else />
    </template>
    <template #footer>
      <FooterPaginator :rows="pageSize" :totalRecords="totalRecords" @page="rekap.onPage" @export="exportExcel" />
    </template>
  </Card>
</template>
