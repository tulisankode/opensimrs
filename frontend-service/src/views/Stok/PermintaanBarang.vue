<script setup lang="ts">
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { computed, onMounted, ref, watch } from "vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import TambahPermintaanBarang from "./Layout/PermintaanBarang/TambahPermintaanBarang.vue";
import DetailPermintaanBarang from "./Layout/PermintaanBarang/DetailPermintaanBarang.vue";
import { usePermintaanBarangStore } from "@/stores/stok/PermintaanBarang";
import { utilsStore } from "@/stores/utils";
import { formatStringDate } from "@/utils/Helpers";
import NoData from "@/components/section/NoData.vue";
import { useStockLocationSelectionStore } from "@/utils/StockLocationSelection";

const buttonSelect = ref("request"); //request, canceled, verified
const searchQuery = ref(""); //for search
const useUtilsStore = utilsStore(); //for loading

const STATUS_LABELS: Record<string, string> = {
  request: "PENGAJUAN",
  cancel: "DIBATALKAN",
  verified: "DIVERIFIKASI",
  request_sebagian: "PENGAJUAN - VERIF SEBAGIAN",
  verif_sebagian: "DIVERIFIKASI - VERIF SEBAGIAN",
};

// Pemetaan pilihan tombol -> parameter status API (boleh koma)
const STATUS_GROUPS: Record<string, string> = {
  request: "request,request_sebagian",
  verified: "verified,verif_sebagian",
  dikirim: "dikirim",
  cancel: "cancel",
};

//variable for debounce search
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

//variable for dialog
const showTambah = ref(false);
const showDetail = ref(false);

//variable for fetch data permintaan barang
const permintaanBarangStore = usePermintaanBarangStore();
const permintaanBarangPayload = ref([]);
const PermintaanBarangProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

const stockLocSel = useStockLocationSelectionStore();
// Ambil name lokasi stok yang sedang dipilih (jika ada)
const selectedTujuanName = computed(() => {
  const data = stockLocSel.getByUuid(stockLocSel.selectedUuid);
  return data?.name ?? "";
});

//function for fetch data permintaan barang
const fetchPermintaanBarang = async () => {
  useUtilsStore.setLoading(true);
  try {
    // Tentukan parameter status berdasarkan pilihan tombol
    const statusParam = STATUS_GROUPS[buttonSelect.value] ?? buttonSelect.value;

    const response = await permintaanBarangStore.getAll(
      PermintaanBarangProperties.value.page,
      PermintaanBarangProperties.value.page_size,
      statusParam,
      searchQuery.value,
      stockLocSel.selectedUuid ?? ""
    );

    // Normalisasi payload & total untuk kasus sukses + pasang label status
    permintaanBarangPayload.value = Array.isArray(response?.payload)
      ? response.payload.map((item: any) => ({
          ...item,
          statusLabel: STATUS_LABELS[item?.status] ?? item?.status,
        }))
      : [];
    PermintaanBarangProperties.value.total =
      response?.properties?.totalData ?? response?.properties?.total ?? 0;

    console.log("permintaanBarangPayload:", permintaanBarangPayload.value);
  } catch (error) {
    console.log(error);
    permintaanBarangPayload.value = [];
    PermintaanBarangProperties.value.total = 0;
  } finally {
    useUtilsStore.setLoading(false);
  }
};

const selectedRow = ref<any | null>(null);

const handlePage = (event: any) => {
  PermintaanBarangProperties.value.page = event.page + 1;
  PermintaanBarangProperties.value.page_size = event.rows;
  fetchPermintaanBarang();
};

const handleRowClick = (event: any) => {
  selectedRow.value = event?.data;
  showDetail.value = true;
  console.log("Navigating to detail with data:", selectedRow.value);
};

// Watcher untuk menangani perubahan status dan pencarian
watch(
  [searchQuery, buttonSelect],
  ([newSearch, newButton], [oldSearch, oldButton]) => {
    // Jika tombol status berubah, fetch langsung dan batalkan debounce yang berjalan
    if (newButton !== oldButton) {
      PermintaanBarangProperties.value.page = 1;
      if (searchTimeout) clearTimeout(searchTimeout);
      fetchPermintaanBarang();
    }

    // Jika pencarian berubah, jalankan fetch dengan debounce 500ms
    if (newSearch !== oldSearch) {
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        PermintaanBarangProperties.value.page = 1;
        fetchPermintaanBarang();
      }, 500);
    }
  }
);

watch(selectedTujuanName, () => {
  PermintaanBarangProperties.value.page = 1;
  fetchPermintaanBarang();
});

onMounted(() => {
  fetchPermintaanBarang();
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
            @click="fetchPermintaanBarang"
            title="Refresh"
          />
          <CustomBreadCrumb
            :home="{ label: 'Permintaan Barang', home: true }"
            :model="[{ label: 'Permintaan Unit' }]"
          />
          <CustomTextfield
            v-model="searchQuery"
            label="Cari Satuan"
            prependIcon="PhMagnifyingGlass"
            placeholder="Cari No. Permintaan / Tujuan Permintaan"
          />
          <!-- Status permintaan -->
          <div class="flex items-center gap-1 shrink-0" role="group" aria-label="Status permintaan">
            <CustomButton
              label="Permintaan"
              :outlined="buttonSelect !== 'request'"
              borderColor="border-opensimrs-300"
              :textColor="buttonSelect === 'request' ? 'text-white' : 'text-opensimrs-300'"
              :backgroundColor="buttonSelect === 'request' ? 'bg-opensimrs-300' : 'bg-white'"
              @click="buttonSelect = 'request'"
            />
            <CustomButton
              label="Dibatalkan"
              :outlined="buttonSelect !== 'cancel'"
              borderColor="border-opensimrs-300"
              :textColor="buttonSelect === 'cancel' ? 'text-white' : 'text-opensimrs-300'"
              :backgroundColor="buttonSelect === 'cancel' ? 'bg-opensimrs-300' : 'bg-white'"
              @click="buttonSelect = 'cancel'"
            />
            <CustomButton
              label="Terverifikasi"
              :outlined="buttonSelect !== 'verified'"
              borderColor="border-opensimrs-300"
              :textColor="buttonSelect === 'verified' ? 'text-white' : 'text-opensimrs-300'"
              :backgroundColor="buttonSelect === 'verified' ? 'bg-opensimrs-300' : 'bg-white'"
              @click="buttonSelect = 'verified'"
            />
          </div>
          <CustomButton
            icon="PhPlus"
            label="Permintaan"
            @click="showTambah = true"
          />
        </PageToolbar>
      </template>
      <template #content>
        <DataTable
          v-if="permintaanBarangPayload.length"
          tableStyle="min-width: 50rem"
          stripedRows
          class="text-xs"
          scrollable
          scrollHeight="flex"
          :value="permintaanBarangPayload"
          @row-click="handleRowClick"
        >
          <Column
            field="tanggalPermintaan"
            header="Tanggal"
            headerClass="bg-opensimrs-50 font-semibold text-SM"
          >
            <template #body="slotProps">
              {{ formatStringDate(slotProps.data.tanggalPermintaan, "date") }}
            </template>
          </Column>

          <Column
            field="noPermintaan"
            header="No. Permintaan"
            headerClass="bg-opensimrs-50 font-semibold text-SM"
          >
            <template #body="slotProps">
              <div class="space-y-1">
                <div class="font-semibold">
                  {{ slotProps.data.noPermintaan }}
                </div>
                <div class="flex gap-1">
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
                    v-if="slotProps.data.jenisItem"
                    :label="slotProps.data.jenisItem"
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
            field="lokasiTujuan"
            header="Tujuan Permintaan"
            headerClass="bg-opensimrs-50 font-bold text-SM"
            class="font-bold"
          >
            <template #body="slotProps">
              {{ slotProps.data.lokasiTujuan?.name || "tidak ada" }}
            </template>
          </Column>

          <Column
            field="petugasPermintaan"
            header="Petugas"
            headerClass="bg-opensimrs-50 font-semibold text-SM"
          />

          <Column
            field="status"
            headerClass="bg-opensimrs-50 font-semibold text-SM"
          >
            <template #header>
              <div class="flex justify-center items-center w-full">Status</div>
            </template>
            <template #body="slotProps">
              <div class="flex justify-center items-center w-full">
                <CustomChip
                  :label="slotProps.data.statusLabel || slotProps.data.status"
                  :outlined="true"
                  :showCheckedIcon="false"
                  :customClass="'h-6 px-3'"
                  :borderColor="
                    buttonSelect === 'cancel'
                      ? 'border-danger-300'
                      : buttonSelect === 'verified'
                      ? 'border-opensimrs-300'
                      : 'border-grey-300'
                  "
                  textColor="text-white"
                  :bgColor="
                    buttonSelect === 'cancel'
                      ? 'bg-danger-300'
                      : buttonSelect === 'verified'
                      ? 'bg-opensimrs-300'
                      : 'bg-grey-300'
                  "
                />
              </div>
            </template>
          </Column>
        </DataTable>
        <NoData v-else />
      </template>
      <template #footer>
        <div class="flex justify-end border-t border-grey-200">
          <CustomPaginator
            :rows="PermintaanBarangProperties.page_size"
            :totalRecords="PermintaanBarangProperties.total"
            :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePage"
          />
        </div>
      </template>
    </Card>
    <!-- Detail -->
    <DetailPermintaanBarang
      v-else-if="showDetail"
      :data="selectedRow"
      :isCancelable="buttonSelect === 'request'"
      @back="
        () => {
          showDetail = false;
          fetchPermintaanBarang();
        }
      "
    />

    <!-- Tambah -->
    <TambahPermintaanBarang
      v-else
      @back="
        () => {
          showTambah = false;
          fetchPermintaanBarang();
        }
      "
      @saved="fetchPermintaanBarang"
    />
  </div>
</template>

<style lang="scss" scoped></style>
