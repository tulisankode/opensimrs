<script setup lang="ts">
import { onBeforeRouteLeave, useRoute } from "vue-router";
import HeaderKartustokMutasi from "../../Layout/HeaderKartustokMutasi.vue";
import { ref } from "vue";
import type { MenuItem } from "primevue/menuitem";
import { onMounted } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import TabelKartuStok from "./Tabel/KartuStokMutasi/TabelKartuStok.vue";
import TabelMutasi from "./Tabel/KartuStokMutasi/TabelMutasi.vue";

const route = useRoute();

const value = ref("1");
const pageType = ref("");
const dataBreadCrumb = ref<MenuItem[]>([{}]);

const kartuStokData = ref<any | null>(null);
const mutasiData = ref<any | null>(null);
const updatePageType = (path: string) => {
  dataBreadCrumb.value = [];
  let tempArrPath = path.split("/");
  pageType.value = tempArrPath[2] ?? "";
  dataBreadCrumb.value = [
    {
      label: pageType.value == "kartustok-mutasi" ? "Kartu Stok & Mutasi" : "",
    },
  ];
  //   console.log(pageType.value);
};

onBeforeRouteLeave((to, from) => {
  updatePageType(to.path);
});
onMounted(() => {
  updatePageType(route.path);
  kartuStokData.value = [
    {
      id: 1,
      namaItem: "Masker Onemed",
      jenisStok: "Umum",
      jenisItem: "Alkes",
      kategoriItem: "Medis",
      lokasi: "Farmasi",
      sisaStok: 20,
      satuan: "Box",
    },
    {
      id: 2,
      namaItem: "Masker OP",
      jenisStok: "Umum",
      jenisItem: "Alkes",
      kategoriItem: "Medis",
      lokasi: "Farmasi",
      sisaStok: 20,
      satuan: "Box",
    },
  ];
  mutasiData.value = [
    {
      kodeTransaksi: "PER1283129",
      lokasiTransaksi: "Inventory",
      tglTransaksi: "01-01-2024",
      itemTransaksi: "Masker",
      kodeItem: "MK123456",
      jenisStok: "Umum",
      jenisItem: "Alkes",
      kategoriItem: "Medis",
      expDate: "01-01-2025",
      keterangan: "Penerimaan Unit",
      dari: "Gudang Farmasi",
      ke: "Farmasi",
      petugas: "Nama Petugas",
      stokAwal: 100,
      mutasiStok: 10,
      sisaStok: 110,
    },
    {
      kodeTransaksi: "ORD1283129",
      lokasiTransaksi: "Pelayanan",
      tglTransaksi: "01-01-2024",
      itemTransaksi: "Kasa",
      kodeItem: "KS123456",
      jenisStok: "Umum",
      jenisItem: "Alkes",
      kategoriItem: "Medis",
      expDate: "01-01-2025",
      keterangan: "Order Alkes",
      petugas: "Nama Petugas",
      stokAwal: 100,
      mutasiStok: -10,
      sisaStok: 90,
    },
  ];
});
</script>

<template>
  <Card
    pt:body:class="h-full pt-0 overflow-auto"
    pt:content:class="h-full overflow-auto"
    class=""
  >
    <template #header>
      <HeaderKartustokMutasi
        :data-bread-crumb="dataBreadCrumb"
        :page-type="pageType"
      >
        <template #tabs>
          <CustomButton
            label="KARTU STOK"
            :text-color="value === '1' ? 'text-white' : 'text-opensimrs-300'"
            :border-color="value === '1' ? 'border-none' : 'border-opensimrs-300'"
            :class="value === '1' ? 'bg-opensimrs-300' : 'bg-white'"
            @click="value = '1'"
            :outlined="value !== '1'"
          />
          <CustomButton
            label="MUTASI"
            :text-color="value === '2' ? 'text-white' : 'text-opensimrs-300'"
            :border-color="value === '2' ? 'border-none' : 'border-opensimrs-300'"
            :class="value === '2' ? 'bg-opensimrs-300' : 'bg-white'"
            @click="value = '2'"
            :outlined="value !== '2'"
          />
        </template>
      </HeaderKartustokMutasi>
    </template>
    <template #content>
      <Tabs v-model:value="value">
        <TabPanels>
          <TabPanel value="1">
            <TabelKartuStok :tabel-data="kartuStokData" />
          </TabPanel>
          <TabPanel value="2">
            <TabelMutasi :tabel-data="mutasiData"/>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </template>
    <template #footer>
      <div :class="value === '2' ? 'flex justify-end' : 'flex justify-between'">
        <CustomButton
        v-if="value==='1'"
          label="Cetak"
          class="my-auto bg-opensimrs-300"
          icon="PhPrinter"
        />
        <Paginator
          :rows="10"
          :totalRecords="120"
          :rowsPerPageOptions="[10, 20, 30]"
          template="FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink RowsPerPageDropdown"
          currentPageReportTemplate="{currentPage}"
        >
          <template #start="slotProps">Total Data: 0</template>
        </Paginator>
      </div>
    </template>
  </Card>
</template>
