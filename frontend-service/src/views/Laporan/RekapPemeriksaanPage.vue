<script setup lang="ts">
import { ref } from "vue";
import HeaderFilter from "./Layout/HeaderFilter.vue";
import FooterPaginator from "./Layout/FooterPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import {
  useRekapLaporan,
  JENIS_KUNJUNGAN,
  METODE_BAYAR,
  OPSI_JENIS_KUNJUNGAN,
  OPSI_METODE_BAYAR,
} from "./useRekapLaporan";

// Pemeriksaan lab juga mencakup order APS (pasien luar)
const OPSI_KUNJUNGAN_LAB = [...OPSI_JENIS_KUNJUNGAN, { uuid: "aps", name: "APS" }];

const rekap = useRekapLaporan("pemeriksaan-lab", "Rekapitulasi Pemeriksaan Lab");
const { rows, totalRecords, pageSize, offset, search, jenisKunjungan, filterKedua, startDate, endDate } = rekap;
const headerRef = ref();

const exportExcel = () =>
  rekap.exportExcel([
    { header: "Pemeriksaan", value: (row) => row.tindakan ?? "-" },
    { header: "Jenis Kunjungan", value: (row) => JENIS_KUNJUNGAN[row.visitType] ?? row.visitType },
    { header: "Metode Pembayaran", value: (row) => METODE_BAYAR[row.paymentMethod] ?? row.paymentMethod ?? "-" },
    { header: "Total", value: (row) => Number(row.total) },
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
        pageType="rekapitulasi-pemeriksaan"
        :selectOption="OPSI_KUNJUNGAN_LAB"
        :selectOptionSecond="OPSI_METODE_BAYAR"
        @update:valueSearch="(value: string) => (search = value)"
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
        <Column field="tindakan" header="Pemeriksaan" headerClass="bg-opensimrs-50"></Column>
        <Column header="Jenis Kunjungan" headerClass="bg-opensimrs-50">
          <template #body="{ data }">{{ JENIS_KUNJUNGAN[data.visitType] ?? data.visitType }}</template>
        </Column>
        <Column header="Metode Pembayaran" headerClass="bg-opensimrs-50">
          <template #body="{ data }">{{ METODE_BAYAR[data.paymentMethod] ?? data.paymentMethod ?? "-" }}</template>
        </Column>
        <Column class="w-1/4" field="total" header="Total" headerClass="bg-opensimrs-50"></Column>
      </DataTable>
      <NoData v-else />
    </template>
    <template #footer>
      <FooterPaginator :rows="pageSize" :totalRecords="totalRecords" @page="rekap.onPage" @export="exportExcel" />
    </template>
  </Card>
</template>
