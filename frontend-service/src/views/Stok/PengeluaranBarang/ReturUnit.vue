<script setup lang="ts">
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { computed, ref, watch } from "vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import DetailVerifikasiPengirimanUnit from "../Layout/VerifikasiPengirimanUnit/DetailVerifikasiPengirimanUnit.vue";
import TambahPengeluaranUnit from "../Layout/PengeluaranUnit/TambahPengeluaranUnit.vue";
import DetailPengeluaranBarang from "../Layout/PengeluaranUnit/DetailPengeluaranUnit.vue";
import DetailPengeluaranUnit from "../Layout/PengeluaranUnit/DetailPengeluaranUnit.vue";
import TambahReturUnit from "../Layout/ReturUnit/TambahReturUnit.vue";
import DetailReturUnit from "../Layout/ReturUnit/DetailReturUnit.vue";
import { useReturUnitStore } from "@/stores/stok/ReturUnit";
import { onMounted } from "vue";
import { utilsStore } from "@/stores/utils";
import NoData from "@/components/section/NoData.vue";

const searchQuery = ref("");
const useUtilsStore = utilsStore();

const returUnitStore = useReturUnitStore();
const returUnitPayload = ref<any>([]);
const returUnitProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

const fetchReturUnit = async () => {
  useUtilsStore.setLoading(true);
  try {
    const res = await returUnitStore.getAll(
      returUnitProperties.value.page,
      returUnitProperties.value.page_size,
      searchQuery.value
    );
    console.log(res);

    returUnitProperties.value.total = res.properties.totalData;
    returUnitPayload.value = res.payload;

    console.log("returUnitPayload.value", returUnitPayload.value);
  } catch (error) {
    console.log(error);
    returUnitPayload.value = [];
    returUnitProperties.value.total = 0;
  } finally {
    useUtilsStore.setLoading(false);
  }
};

const showTambah = ref(false);
const showDetail = ref(false);

const selectedRow = ref<any | null>(null);

// computed untuk menentukan label Jenis Item berdasarkan Kategori Item
const getJenisItemLabel = (row: any) => {
  const kategori = row?.kategoriItem?.toLowerCase();
  if (!kategori) return "-";
  // medis → obat; selain medis (termasuk non-medis) → alkes
  if (kategori.includes("medis") && !kategori.includes("non")) return "obat";
  return "alkes";
};

const handlePage = (event: any) => {
  returUnitProperties.value.page = event.page + 1;
  returUnitProperties.value.page_size = event.rows;
  fetchReturUnit();
};

const handleRowClick = (event: any) => {
  selectedRow.value = event?.data;
  showDetail.value = true;
  console.log("Navigating to detail with data:", selectedRow.value);
};

//variable for debounce search
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
// Auto-search retur unit debounce searchQuery changes
watch(searchQuery, () => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    returUnitProperties.value.page = 1; // reset to first page
    fetchReturUnit();
  }, 500); // 500ms debounce delay
});

onMounted(() => {
  fetchReturUnit();
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
            @click="fetchReturUnit"
            title="Refresh"
          />
          <CustomBreadCrumb
            :home="{ label: 'Pengeluaran Barang', home: true }"
            :model="[{ label: 'Retur Unit' }]"
          />
          <CustomTextfield
            v-model="searchQuery"
            label="Cari Satuan"
            prependIcon="PhMagnifyingGlass"
            placeholder="Cari No. Permintaan / Tujuan Permintaan"
          />
          <CustomButton
            icon="PhPlus"
            label="Retur"
            @click="showTambah = true"
          />
        </PageToolbar>
      </template>
      <template #content>
        <DataTable
          v-if="returUnitPayload.length"
          tableStyle="min-width: 50rem"
          stripedRows
          class="text-xs"
          scrollable
          scrollHeight="flex"
          :value="returUnitPayload"
          @row-click="handleRowClick"
        >
          <Column
            field="tanggalRetur"
            header="Tanggal"
            headerClass="bg-opensimrs-50 font-semibold text-SM"
          ></Column>

          <Column
            header="No. Retur"
            headerClass="bg-opensimrs-50 font-semibold text-SM"
          >
            <template #body="slotProps">
              <div class="space-y-1">
                <div class="font-semibold">{{ slotProps.data.noRetur }}</div>
                <div class="flex gap-2">
                  <CustomChip
                    :label="slotProps.data.kategoriItem"
                    :outlined="true"
                    :showCheckedIcon="false"
                    :customClass="'h-5 px-2'"
                    :borderColor="'border-opensimrs-300'"
                    :textColor="'text-white'"
                    :bgColor="'bg-opensimrs-300'"
                  />
                  <CustomChip
                    :label="slotProps.data.jenisStok"
                    :outlined="true"
                    :showCheckedIcon="false"
                    :customClass="'h-5 px-2'"
                    :borderColor="'border-opensimrs-300'"
                    :textColor="'text-white'"
                    :bgColor="'bg-opensimrs-300'"
                  />
                  <CustomChip
                    :label="getJenisItemLabel(slotProps.data)"
                    :outlined="true"
                    :showCheckedIcon="false"
                    :customClass="'h-5 px-2'"
                    :borderColor="'border-opensimrs-300'"
                    :textColor="'text-white'"
                    :bgColor="'bg-opensimrs-300'"
                  />
                </div>
              </div>
            </template>
          </Column>

          <Column
            header="Tujuan Retur"
            headerClass="bg-opensimrs-50 font-bold text-SM"
            field="lokasiStokTujuan.name"
            class=""
          >
          </Column>

          <Column
            header="Alasan Retur"
            headerClass="bg-opensimrs-50 font-bold text-SM"
            field="alasanRetur"
            class=""
          >
          </Column>

          <Column
            field="petugasRetur"
            header="Petugas"
            headerClass="bg-opensimrs-50 font-semibold text-SM"
          >
          </Column>
        </DataTable>
        <NoData v-else />
      </template>
      <template #footer>
        <div class="flex justify-end border-t border-grey-200">
          <CustomPaginator
            :rows="returUnitProperties.page_size"
            :totalRecords="returUnitProperties.total"
            :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePage"
          />
        </div>
      </template>
    </Card>
    <!-- Detail -->
    <DetailReturUnit
      v-else-if="showDetail"
      :data="selectedRow"
      @back="showDetail = false"
    />

    <!-- Tambah -->
    <TambahReturUnit
      v-else
      @saved="fetchReturUnit"
      @back="showTambah = false"
    />
  </div>
</template>

<style lang="scss" scoped></style>
