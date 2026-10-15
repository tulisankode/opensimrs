<script setup lang="ts">
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { onMounted, ref, watch } from "vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import DetailVerifikasiPengirimanUnit from "../Layout/VerifikasiPengirimanUnit/DetailVerifikasiPengirimanUnit.vue";
import TambahPengeluaranUnit from "../Layout/PengeluaranUnit/TambahPengeluaranUnit.vue";
import DetailPengeluaranBarang from "../Layout/PengeluaranUnit/DetailPengeluaranUnit.vue";
import DetailPengeluaranUnit from "../Layout/PengeluaranUnit/DetailPengeluaranUnit.vue";
import { utilsStore } from "@/stores/utils";
import { usePengeluaranUnitStore } from "@/stores/stok/PengeluaranUnit";
import { formatStringDate } from "@/utils/Helpers";
import NoData from "@/components/section/NoData.vue";

const searchQuery = ref(""); //untuk pencarian
const useUtilsStore = utilsStore(); //for loading

//variable for debounce search
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

//variable for dialog
const showTambah = ref(false);
const showDetail = ref(false);

//variable for fetch data pengeluaran unit
const PengeluaranUnitStore = usePengeluaranUnitStore();
const PengeluaranUnitPayload = ref([]);
const PengeluaranUnitProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

//function for fetch data pengeluaran unit
const fetchPengeluaranUnit = async () => {
  useUtilsStore.setLoading(true);
  try {
    const response = await PengeluaranUnitStore.getAll(
      PengeluaranUnitProperties.value.page,
      PengeluaranUnitProperties.value.page_size,
      searchQuery.value
    );
    console.log("response pengeluaran unit:", response);
    PengeluaranUnitPayload.value = response.payload || [];
    PengeluaranUnitProperties.value.total = response.properties.totalData || 0;
  } catch (error) {
    console.error("Error fetching pengeluaran unit:", error);
  } finally {
    useUtilsStore.setLoading(false);
  }
};

const selectedRow = ref<any | null>(null);

const handlePage = (event: any) => {
  PengeluaranUnitProperties.value.page = event.page + 1;
  PengeluaranUnitProperties.value.page_size = event.rows;
  fetchPengeluaranUnit();
};

const handleRowClick = (event: any) => {
  selectedRow.value = event?.data;
  showDetail.value = true;
  console.log("Navigating to detail with data:", selectedRow.value);
};

// Auto-search pengeluaran unit debounce searchQuery changes
watch(searchQuery, () => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    PengeluaranUnitProperties.value.page = 1; // reset to first page
    fetchPengeluaranUnit();
  }, 500); // 500ms debounce delay
});

onMounted(() => {
  fetchPengeluaranUnit();
});
</script>

<template>
  <div>
    <Card
      pt:body:class="overflow-auto pt-0 h-full"
      pt:content:class="overflow-hidden h-full"
      class="overflow-hidden h-full"
      v-if="!showTambah && !showDetail"
    >
      <template #header>
        <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
        <PageToolbar>
          <CustomButton
            icon="PhArrowClockwise"
            @click="fetchPengeluaranUnit"
            title="Refresh"
          />
          <CustomBreadCrumb
            :home="{ label: 'Pengeluaran Barang', home: true }"
            :model="[{ label: 'Pengeluaran Unit' }]"
          />
          <CustomTextfield
            v-model="searchQuery"
            label="Cari Satuan"
            prependIcon="PhMagnifyingGlass"
            placeholder="Cari No. Permintaan / Tujuan Permintaan"
          />
          <CustomButton
            icon="PhPlus"
            label="Pengeluaran"
            @click="showTambah = true"
          />
        </PageToolbar>
      </template>
      <template #content>
        <DataTable
          v-if="PengeluaranUnitPayload.length"
          tableStyle="min-width: 50rem"
          stripedRows
          class="text-xs"
          scrollable
          scrollHeight="flex"
          :value="PengeluaranUnitPayload"
          @row-click="handleRowClick"
        >
          <Column
            field="tanggalPengeluaran"
            header="Tanggal"
            headerClass="bg-opensimrs-50 font-semibold text-SM"
          >
            <template #body="slotProps">
              {{ formatStringDate(slotProps.data.tanggalPengeluaran, "date") }}
            </template>
          </Column>

          <Column
            field="noPengeluaran"
            header="No. Pengeluaran"
            headerClass="bg-opensimrs-50 font-semibold text-SM"
          >
            <template #body="slotProps">
              <div class="space-y-1">
                <div class="font-semibold">
                  {{ slotProps.data.noPengeluaran }}
                </div>
                <div class="flex gap-2">
                  <CustomChip
                    v-if="slotProps.data.kategoriItem"
                    :label="slotProps.data.kategoriItem"
                    :outlined="true"
                    :showCheckedIcon="false"
                    :customClass="'h-5 px-2'"
                    borderColor="border-opensimrs-300"
                    textColor="text-white"
                    bgColor="bg-opensimrs-300"
                  />
                  <CustomChip
                    v-if="slotProps.data.jenisStok.name"
                    :label="slotProps.data.jenisStok.name"
                    :outlined="true"
                    :showCheckedIcon="false"
                    :customClass="'h-5 px-2'"
                    borderColor="border-opensimrs-300"
                    textColor="text-white"
                    bgColor="bg-opensimrs-300"
                  />
                  <CustomChip
                    v-if="slotProps.data.cito"
                    :label="'CITO'"
                    :outlined="true"
                    :showCheckedIcon="false"
                    :customClass="'h-5 px-2'"
                    borderColor="border-danger-300"
                    textColor="text-white"
                    bgColor="bg-danger-300"
                  />
                </div>
              </div>
            </template>
          </Column>

          <Column
            header="Jenis Pengeluaran"
            headerClass="bg-opensimrs-50 font-bold text-SM"
            class=""
          >
            <template #body="slotProps">
              <div class="space-y-1">
                <div class="font-bold">
                  {{ slotProps.data.jenisPengeluaran }}
                </div>
                <div
                  class="flex gap-1 items-center"
                  v-if="
                    slotProps.data.jenisPengeluaran ===
                    'pengeluaran tanpa permintaan'
                  "
                >
                  <PhArrowRight :size="16" class="text-opensimrs-300" />
                  <div>{{ slotProps.data.lokasiStokAkhir.name }}</div>
                </div>
              </div>
            </template>
          </Column>

          <Column
            field="petugasPengeluaran"
            header="Petugas"
            headerClass="bg-opensimrs-50 font-semibold text-SM"
          />
        </DataTable>
        <NoData v-else />
      </template>
      <template #footer>
        <div class="flex justify-end border-t border-grey-200">
          <CustomPaginator
            :rows="PengeluaranUnitProperties.page_size"
            :totalRecords="PengeluaranUnitProperties.total"
            :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePage"
          />
        </div>
      </template>
    </Card>
    <!-- Detail -->
    <DetailPengeluaranUnit
      v-else-if="showDetail"
      :data="selectedRow"
      @back="showDetail = false"
    />

    <!-- Tambah -->
    <TambahPengeluaranUnit
      v-else
      @back="showTambah = false"
      @saved="fetchPengeluaranUnit"
    />
  </div>
</template>

<style lang="scss" scoped></style>
