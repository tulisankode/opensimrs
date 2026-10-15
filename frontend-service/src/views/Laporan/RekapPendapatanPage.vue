<script setup lang="ts">
import { ref, computed } from "vue";
import HeaderFilter from "./Layout/HeaderFilter.vue";
import FooterPaginator from "./Layout/FooterPaginator.vue";
import NoData from "@/components/section/NoData.vue";
const pendapatanPayload = ref([
  {
    tanggalKunjungan: "01-01-2024",
    penjamin: "BPJS",
    rajal: "Rp 20,000",
    ranap: "Rp 20,000",
    igd: "Rp 20,000",
    lab: "Rp 20,000",
    fisio: "Rp 20,000",
    farmasi: "Rp 20,000",
    total: 5,
  },
  {
    tanggalKunjungan: "01-01-2024",
    penjamin: "BPJS",
    rajal: "Rp 20,000",
    ranap: "Rp 20,000",
    igd: "Rp 20,000",
    lab: "Rp 20,000",
    fisio: "Rp 20,000",
    farmasi: "Rp 20,000",
    total: 5,
  },
  {
    tanggalKunjungan: "01-01-2024",
    penjamin: "BPJS",
    rajal: "Rp 20,000",
    ranap: "Rp 20,000",
    igd: "Rp 20,000",
    lab: "Rp 20,000",
    fisio: "Rp 20,000",
    farmasi: "Rp 20,000",
    total: 5,
  },
]);
const optionKunjungan = ref([
  {
    uuid: "0191a18a-22e4-79f7-9da5-a10a6e1a60f9",
    name: "Rawat Jalan",
  },
  { uuid: "0191a18a-22e4-79f7-9da5-a10a6e1a6089", name: "Rawat Inap" },
  { uuid: "0191a18a-22e4-79f7-9da5-a10a6e1a6067", name: "IGD" },
]);

const optionPenjamin = ref([
  {
    uuid: "0191a18a-22e4-79f7-9da5-a10a6e1a60f9",
    name: "Tunai",
  },
  { uuid: "0191a18a-22e4-79f7-9da5-a10a6e1a6089", name: "BPJS" },
]);

const selectedKunjungan = ref("");
const selectedPenjamin = ref("");
const startDateFilter = ref<Date>(new Date());
const endDateFilter = ref<Date>(new Date());
const handleSelectedKunjungan = (value: any) => {
  selectedKunjungan.value = value;
};
const handleSelectedPenjamin = (value: string) => {
  selectedPenjamin.value = value;
};

const handleStartDate = (value: any) => {
  startDateFilter.value = value;
};
const handleEndDate = (value: any) => {
  endDateFilter.value = value;
};
const resetFormRef = ref();
const resetFilter = () => {
  selectedKunjungan.value = "";
  selectedPenjamin.value = "";
  startDateFilter.value = new Date();
  endDateFilter.value = new Date();
  resetFormRef.value.resetForm();
};
</script>
<template>
  <Card
    pt:body:class="h-full pt-0 overflow-auto"
    pt:content:class="h-full overflow-auto"
  >
    <template #header>
      <HeaderFilter
        pageType="rekapitulasi-pendapatan"
        @update:selected-filter="handleSelectedPenjamin"
        @update:selected-filter-second="handleSelectedKunjungan"
        @update:startDateFilter="handleStartDate"
        @update:endDateFilter="handleEndDate"
        :selectOption="optionPenjamin"
        :selectOptionSecond="optionKunjungan"
        @reset="resetFilter"
        ref="resetFormRef"
      />
    </template>
    <template #content>
      <DataTable
        v-if="pendapatanPayload.length"
        :value="pendapatanPayload"
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
              {{ slotProps.index + 1 }}
            </div>
          </template>
        </Column>
        <Column
          field="tanggalKunjungan"
          header="Tgl. Kunjungan"
          headerClass="bg-opensimrs-50"
        ></Column>
        <Column
          field="penjamin"
          header="Nama Penjamin"
          headerClass="bg-opensimrs-50"
        ></Column>
        <Column
          field="rajal"
          headerClass="bg-opensimrs-50 font-semibold text-SM"
          body-class="text-end"
        >
          <template #header>
            <div class="flex justify-end w-full">RAJAL</div>
          </template>
        </Column>
        <Column
          field="ranap"
          headerClass="bg-opensimrs-50 font-semibold text-SM"
          body-class="text-end"
          ><template #header>
            <div class="flex justify-end w-full">RANAP</div>
          </template></Column
        >
        <Column
          field="igd"
          headerClass="bg-opensimrs-50 font-semibold text-SM"
          body-class="text-end"
        >
          <template #header>
            <div class="flex justify-end w-full">IGD</div>
          </template></Column
        >
        <Column
          field="lab"
          headerClass="bg-opensimrs-50 font-semibold text-SM"
          body-class="text-end"
        >
          <template #header>
            <div class="flex justify-end w-full">Lab</div>
          </template></Column
        >
        <Column
          field="fisio"
          headerClass="bg-opensimrs-50 font-semibold text-SM"
          body-class="text-end"
        >
          <template #header>
            <div class="flex justify-end w-full">Fisio</div>
          </template></Column
        >
        <Column
          field="farmasi"
          headerClass="bg-opensimrs-50 font-semibold text-SM"
          body-class="text-end"
        >
          <template #header>
            <div class="flex justify-end w-full">Farmasi</div>
          </template></Column
        >
        <Column
          field="total"
          headerClass="bg-opensimrs-50 font-semibold text-SM"
          body-class="text-end"
        >
          <template #header>
            <div class="flex justify-end w-full">Total</div>
          </template></Column
        >
      </DataTable>
      <NoData v-else />
    </template>
    <template #footer>
      <FooterPaginator :rows="2" :totalRecords="20" />
    </template>
  </Card>
</template>
