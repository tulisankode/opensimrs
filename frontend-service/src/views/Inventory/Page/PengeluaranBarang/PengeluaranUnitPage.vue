<script setup lang="ts">
import { onBeforeRouteLeave, useRoute } from "vue-router";
import HeaderPengeluaranBarang from "../../Layout/HeaderPengeluaranBarang.vue";
import { onMounted, ref } from "vue";
import type { MenuItem } from "primevue/menuitem";
import CustomChip from "@/components/Base/CustomChip.vue";
import TambahPengeluaran from "./PengeluaranUnit/TambahPengeluaran.vue";
import DetailPengeluaran from "./PengeluaranUnit/DetailPengeluaran.vue";
import Paginator from "primevue/paginator";

const route = useRoute();

const pageType = ref("");
const dataBreadCrumb = ref<MenuItem[]>([{}]);

const pengeluaranUnitData = ref<any | null>(null);

const detailPengeluaranUnitData = ref();

const updatePageType = (path: string) => {
  dataBreadCrumb.value = [];
  let tempArrPath = path.split("/");
  pageType.value = tempArrPath[3] ?? "";
  dataBreadCrumb.value = [
    {
      label: pageType.value == "pengeluaran-unit" ? "Pengeluaran Unit" : "",
    },
  ];
  //   console.log(pageType.value);
};

onBeforeRouteLeave((to, from) => {
  updatePageType(to.path);
});
onMounted(() => {
  updatePageType(route.path);
  pengeluaranUnitData.value = [
    {
      tanggalPengeluaran: "01-01-2024",
      noPengeluaran: "PGL.1234",
      kategoriItem: "Medis",
      jenisStok: "Umum",
      jenisItem: "Obat",
      jenisPengeluaran: "Pemakaian Unit",
      tujuanPengeluaran: "Poli Mata",
      petugasPengeluaran: "Nama Petugas",
      catatan: "-",
      datas: [
        {
          namaItems: "Paracetamol",
          expDate: "10-10-2025",
          minStok: 1,
          stok: 0,
          pengeluaran: 1,
          satuan: "Box/100",
          HNA: 1800,
          HPP: 1500,
          total: 150000,
        },
        {
          namaItems: "Kasa",
          expDate: "10-10-2025",
          minStok: 0,
          stok: 0,
          pengeluaran: 2,
          satuan: "Box/100",
          HNA: 800,
          HPP: 500,
          total: 200000,
        },
      ],
    },
  ];
});

const changeSection = (label: string, data: any = null) => {
  dataBreadCrumb.value = [{ label }]; // Pastikan ini direset
  if (data) {
    detailPengeluaranUnitData.value = data; // Simpan data detail
  }
};

const handleSimpanPengeluaran = (data: any) => {
  if (pengeluaranUnitData.value === null) {
    pengeluaranUnitData.value = [];
  }
  pengeluaranUnitData.value.push(data);
  dataBreadCrumb.value[0].label = "Pengeluaran Unit";
};

const handleRowClick = (rowData: any) => {
  changeSection("Detail Pengeluaran", rowData.data);
};
</script>

<template>
  <!-- {{ pengeluaranUnitData }} -->
  <Card
    v-if="dataBreadCrumb[0].label == 'Pengeluaran Unit'"
    pt:body:class="h-full pt-0 overflow-auto"
    pt:content:class="h-full overflow-auto"
    class=""
  >
    <template #header>
      <HeaderPengeluaranBarang
        :data-bread-crumb="dataBreadCrumb"
        :page-type="pageType"
        @tambah-pengeluaran="changeSection('Tambah Pengeluaran')"
      />
    </template>

    <template #content>
      <DataTable
        v-if="pengeluaranUnitData.length"
        @row-click="handleRowClick"
        :value="pengeluaranUnitData"
        tableStyle="min-width: 50rem"
        scrollable
        scrollHeight="240px"
        :pt="{ headerRow: 'text-SM' }"
      >
        <Column field="tanggal" headerClass="bg-opensimrs-50">
          <template #header>
            <div class="font-semibold">Tanggal</div>
          </template>
          <template #body="slotProps">
            <div>
              <div class="text-SM">{{ slotProps.data.tanggalPengeluaran }}</div>
            </div>
          </template>
        </Column>

        <Column field="noPembelian" headerClass="bg-opensimrs-50">
          <template #header>
            <div class="font-semibold">No. Pengeluaran</div>
          </template>
          <template #body="slotProps">
            <div>
              <div class="text-SM">{{ slotProps.data.noPengeluaran }}</div>
              <CustomChip
                :showCheckedIcon="false"
                :label="slotProps.data.kategoriItem"
                bgColor="bg-opensimrs-300"
                textColor="text-white"
                customClass="h-5 pr-[6px] border-none mr-[5px]"
              />
              <CustomChip
                :showCheckedIcon="false"
                :label="slotProps.data.jenisStok"
                bgColor="bg-opensimrs-300"
                textColor="text-white"
                customClass="h-5 pr-[6px] border-none mr-[5px]"
              />
              <CustomChip
                :showCheckedIcon="false"
                :label="slotProps.data.jenisItem"
                bgColor="bg-opensimrs-300"
                textColor="text-white"
                customClass="h-5 pr-[6px] border-none mr-[5px]"
              />
            </div>
          </template>
        </Column>

        <Column field="supplier" headerClass="bg-opensimrs-50">
          <template #header>
            <div class="w-full font-semibold">Jenis Pengeluaran</div>
          </template>
          <template #body="slotProps">
            <div>
              <div class="font-bold text-SM">
                {{ slotProps.data.jenisPengeluaran }}
              </div>
            </div>
          </template>
        </Column>

        <Column field="petugas" headerClass="bg-opensimrs-50">
          <template #header>
            <div class="font-semibold">Petugas</div>
          </template>
          <template #body="slotProps">
            <div>
              <div class="text-SM">{{ slotProps.data.petugasPengeluaran }}</div>
            </div>
          </template>
        </Column>
      </DataTable>
    </template>
    <template #footer>
      <div class="flex justify-end">
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

  <TambahPengeluaran
    v-else-if="dataBreadCrumb[0].label == 'Tambah Pengeluaran'"
    :pageType="pageType"
    :dataBreadCrumb="dataBreadCrumb"
    @kembali="dataBreadCrumb[0].label = 'Pengeluaran Unit'"
    @on-simpan-pengeluaran="handleSimpanPengeluaran"
  />

  <DetailPengeluaran
    v-else-if="(dataBreadCrumb[0].label = 'Detail Pengeluaran')"
    :page-type="pageType"
    :detail-data="detailPengeluaranUnitData"
    @kembali="dataBreadCrumb[0].label = 'Pengeluaran Unit'"
  />
</template>
