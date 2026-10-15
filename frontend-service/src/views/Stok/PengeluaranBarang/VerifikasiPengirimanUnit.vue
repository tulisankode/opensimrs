<script setup lang="ts">
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { computed, onMounted, ref, watch } from "vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import TambahPermintaanBarang from "../Layout/PermintaanBarang/TambahPermintaanBarang.vue";
import DetailPermintaanBarang from "../Layout/PermintaanBarang/DetailPermintaanBarang.vue";
import DetailVerifikasiPengirimanUnit from "../Layout/VerifikasiPengirimanUnit/DetailVerifikasiPengirimanUnit.vue";
import { useStockLocationSelectionStore } from "@/utils/StockLocationSelection";
import { usePermintaanBarangStore } from "@/stores/stok/PermintaanBarang";
import { utilsStore } from "@/stores/utils";
import { useVerifikasiPengirimanBarangStore } from "@/stores/stok/VerifikasiPengirimanBarang";
import { formatStringDate } from "@/utils/Helpers";
import NoData from "@/components/section/NoData.vue";

const buttonSelect = ref("request");
const searchQuery = ref("");
const useUtilsStore = utilsStore();

// Label status yang ditampilkan pada chip
const STATUS_LABELS: Record<string, string> = {
  request: "PENGAJUAN",
  request_sebagian: "PENGAJUAN - VERIF SEBAGIAN",
  verified: "DIVERIFIKASI",
  verif_sebagian: "DIVERIFIKASI - VERIF SEBAGIAN",
  dikirim: "DIKIRIM",
  cancel: "DIBATALKAN",
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
const verifikasiPengirimanBarangStore = useVerifikasiPengirimanBarangStore();
const verifikasiPengirimanBarangPayload = ref([]);
const verifikasiPengirimanBarangProperties = ref({
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
const fetchVerifikasiPengirimanUnit = async () => {
  useUtilsStore.setLoading(true);
  try {
    // Tentukan parameter status berdasarkan pilihan tombol
    const statusParam = STATUS_GROUPS[buttonSelect.value] ?? buttonSelect.value;

    const response = await verifikasiPengirimanBarangStore.getAll(
      verifikasiPengirimanBarangProperties.value.page,
      verifikasiPengirimanBarangProperties.value.page_size,
      statusParam,
      searchQuery.value,
      selectedTujuanName.value
    );

    // Normalisasi payload & total untuk kasus sukses + pasang label status
    verifikasiPengirimanBarangPayload.value = Array.isArray(response?.payload)
      ? response.payload.map((item: any) => ({
          ...item,
          statusLabel: STATUS_LABELS[item?.status] ?? item?.status,
        }))
      : [];
    verifikasiPengirimanBarangProperties.value.total =
      response?.properties?.totalData ?? response?.properties?.total ?? 0;

    console.log(
      "verifikasiPengirimanBarangPayload:",
      verifikasiPengirimanBarangPayload.value
    );
  } catch (error) {
    console.log(error);
    verifikasiPengirimanBarangPayload.value = [];
    verifikasiPengirimanBarangProperties.value.total = 0;
  } finally {
    useUtilsStore.setLoading(false);
  }
};

const selectedRow = ref<any | null>(null);

const handlePage = (event: any) => {
  verifikasiPengirimanBarangProperties.value.page = event.page + 1;
  verifikasiPengirimanBarangProperties.value.page_size = event.rows;
  fetchVerifikasiPengirimanUnit();
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
      verifikasiPengirimanBarangProperties.value.page = 1;
      if (searchTimeout) clearTimeout(searchTimeout);
      fetchVerifikasiPengirimanUnit();
    }

    // Jika pencarian berubah, jalankan fetch dengan debounce 500ms
    if (newSearch !== oldSearch) {
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        verifikasiPengirimanBarangProperties.value.page = 1;
        fetchVerifikasiPengirimanUnit();
      }, 500);
    }
  }
);

watch(selectedTujuanName, () => {
  verifikasiPengirimanBarangProperties.value.page = 1;
  fetchVerifikasiPengirimanUnit();
});

onMounted(() => {
  fetchVerifikasiPengirimanUnit();
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
            @click="fetchVerifikasiPengirimanUnit"
            title="Refresh"
          />
          <CustomBreadCrumb
            :home="{ label: 'Pengeluaran Barang', home: true }"
            :model="[{ label: 'Verifikasi & Pengiriman Barang' }]"
          />
          <CustomTextfield
            v-model="searchQuery"
            label="Cari Satuan"
            prependIcon="PhMagnifyingGlass"
            placeholder="Cari No. Permintaan / Tujuan Permintaan"
          />
          <!-- Status pengiriman -->
          <div class="flex items-center gap-1 shrink-0" role="group" aria-label="Status pengiriman">
            <CustomButton
              label="Permintaan"
              :outlined="buttonSelect !== 'request'"
              borderColor="border-opensimrs-300"
              :textColor="buttonSelect === 'request' ? 'text-white' : 'text-opensimrs-300'"
              :backgroundColor="buttonSelect === 'request' ? 'bg-opensimrs-300' : 'bg-white'"
              @click="buttonSelect = 'request'"
            />
            <CustomButton
              label="Diverifikasi"
              :outlined="buttonSelect !== 'verified'"
              borderColor="border-opensimrs-300"
              :textColor="buttonSelect === 'verified' ? 'text-white' : 'text-opensimrs-300'"
              :backgroundColor="buttonSelect === 'verified' ? 'bg-opensimrs-300' : 'bg-white'"
              @click="buttonSelect = 'verified'"
            />
            <CustomButton
              label="Dikirim"
              :outlined="buttonSelect !== 'dikirim'"
              borderColor="border-opensimrs-300"
              :textColor="buttonSelect === 'dikirim' ? 'text-white' : 'text-opensimrs-300'"
              :backgroundColor="buttonSelect === 'dikirim' ? 'bg-opensimrs-300' : 'bg-white'"
              @click="buttonSelect = 'dikirim'"
            />
            <CustomButton
              label="Dibatalkan"
              :outlined="buttonSelect !== 'cancel'"
              borderColor="border-opensimrs-300"
              :textColor="buttonSelect === 'cancel' ? 'text-white' : 'text-opensimrs-300'"
              :backgroundColor="buttonSelect === 'cancel' ? 'bg-opensimrs-300' : 'bg-white'"
              @click="buttonSelect = 'cancel'"
            />
          </div>
        </PageToolbar>
      </template>
      <template #content>
        <DataTable
          v-if="verifikasiPengirimanBarangPayload.length"
          tableStyle="min-width: 50rem"
          stripedRows
          class="text-xs"
          scrollable
          scrollHeight="flex"
          :value="verifikasiPengirimanBarangPayload"
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
                      ? 'border-aqua-300'
                      : buttonSelect === 'dikirim'
                      ? 'border-mint-300'
                      : 'border-grey-300'
                  "
                  textColor="text-white"
                  :bgColor="
                    buttonSelect === 'cancel'
                      ? 'bg-danger-300'
                      : buttonSelect === 'verified'
                      ? 'bg-aqua-300'
                      : buttonSelect === 'dikirim'
                      ? 'bg-mint-300'
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
            :rows="verifikasiPengirimanBarangProperties.page_size"
            :totalRecords="verifikasiPengirimanBarangProperties.total"
            :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePage"
          />
        </div>
      </template>
    </Card>
    <!-- Detail -->
    <DetailVerifikasiPengirimanUnit
      v-else-if="showDetail"
      :data="selectedRow"
      @back="
        showDetail = false;
        fetchVerifikasiPengirimanUnit();
      "
      @saved="fetchVerifikasiPengirimanUnit"
    />
  </div>
</template>

<style lang="scss" scoped></style>
