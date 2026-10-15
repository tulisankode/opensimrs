<script setup lang="ts">
import { onMounted, ref, type PropType, computed, watch } from "vue";
import { onBeforeRouteLeave, useRoute } from "vue-router";
import { useReportCloseBillStore } from "@/stores/pembayaran/closeBill";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomPaginator from '@/components/Base/CustomPaginator.vue';
import CustomSelect from "@/components/Base/CustomSelect.vue";
import ClosedBillDetailPage from "./layout/ClosedBillDetailPage.vue"
import { utilsStore } from "@/stores/utils";
import type { MenuItem } from "primevue/menuitem";
import NoData from "@/components/section/NoData.vue";
import { dateToEpoch, epochToDate } from "@/utils/Helpers";
import { useAdmisiMasterPasienStore } from "@/stores/admisi/masterPasien";

// Inisialisasi
const route = useRoute();
const store = useReportCloseBillStore();
const admisiMasterPasienStore = useAdmisiMasterPasienStore();
const storeUtils = utilsStore();
const searchQuery = ref("");

// State untuk UI & Navigasi
const pageType = ref("");
const dataBreadCrumb = ref<MenuItem[]>([]);
const detailData = ref(null);

// State untuk Data & Paginator
const closedBillList = ref<any[]>([]);
const closedBillProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// State untuk Filter
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(new Date().getDate() - 7);
const startDateFilter = ref<Date>(sevenDaysAgo);
const endDateFilter = ref<Date>(new Date());
const statusFilter = ref("Semua");
const selectedFilterPoli = ref<string[]>([]);
const selectedPaymentMethod = ref<string[]>([]);
const today = new Date();

// State untuk Pencarian
const searchResults = ref<any[]>([]);
const loadingSearch = ref(false);
const selectedPatientUuid = ref<string | null>(null);
const selectedBillUuid = ref<string | null>(null);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

// Computed Properties & Data Statis dari BE
const hasData = computed(() => closedBillList.value.length > 0);
const filterPoliList = ref(["RAWAT INAP", "RAWAT JALAN", "IGD", "APS", "OTC"]);
const poliMapping: { [key: string]: string } = { "RAWAT INAP": "RI", "RAWAT JALAN": "RJ", "IGD": "IGD", "APS": "APS", "OTC": "OTC" };

//untuk UI di column perawatan
const reversePoliMapping: { [key: string]: string } = {
  "RI": "RAWAT INAP",
  "RJ": "RAWAT JALAN",
  "IGD": "IGD",
  "APS": "APS",
  "OTC": "OTC"
};

//  Fungsi untuk memecah string "IGD, RI, RJ" menjadi Array Object
const getServiceList = (rawServices: string) => {
  if (!rawServices) return [];
  return rawServices.split(',').map(item => {
    const code = item.trim(); // Hapus spasi (misal " RJ" jadi "RJ")
    return {
      code: code,
      label: reversePoliMapping[code] || code // Gunakan mapping, kalau tidak ada pakai code aslinya
    };
  });
};

const fetchClosedBills = async (searchUuid: string | null = null) => {
  storeUtils.setLoading(true);
  closedBillList.value = [];
  closedBillProperties.value.total = 0;

  try {
    // 1. Calculation tanggal 
    const startDate = new Date(startDateFilter.value);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(endDateFilter.value);
    endDate.setHours(23, 59, 59, 999);

    const statusForApi = statusFilter.value.toUpperCase() === 'SEMUA' ? '' : statusFilter.value.toUpperCase();
    const poliForApi = selectedFilterPoli.value.map(poli => poliMapping[poli]);
    const paymentForApi = selectedPaymentMethod.value;

    // 2. Hit API Closed Bill Utama
    const response = await store.getApi(
      closedBillProperties.value.page,
      closedBillProperties.value.page_size,
      dateToEpoch(startDate),
      dateToEpoch(endDate),
      searchUuid || selectedPatientUuid.value || "",
      statusForApi,
      poliForApi,
      paymentForApi
    );

    if (response && Array.isArray(response.payload) && response.properties) {

      // 3. Mapping data + Hit API Detail Pasien (Parallel)
      const mappedData = await Promise.all(response.payload.map(async (item: any) => {

        // Default data tambahan
        let patientDetail = {
          phone: "-",
          ageYear: 0,
          ageMonth: 0,
          ageDay: 0,
          address: "Alamat tidak tersedia"
        };

        // Jika ada patient_uuid, ambil detail dari Master Pasien
        if (item.patientUuid) {
          try {
            const resPasien = await admisiMasterPasienStore.getDetailMasterPasien(item.patientUuid);

            if (resPasien && resPasien.payload) {
              const p = resPasien.payload;

              // 1. Ambil No HP (langsung di root payload)
              patientDetail.phone = p.phone || "-";

              // 2. Ambil Umur (DI DALAM birth_detail)
              // Menggunakan optional chaining (?.) untuk aman jika birth_detail null
              if (p.birthDetail) {
                patientDetail.ageYear = p.birthDetail.ageYear ?? 0;
                patientDetail.ageMonth = p.birthDetail.ageMonth ?? 0;
                patientDetail.ageDay = p.birthDetail.ageDay ?? 0;
              }

              // 3. Ambil Alamat (DI DALAM address) - Opsional jika ingin ditampilkan
              if (p.address) {
                patientDetail.address = p.address.fullAddress || "Alamat tidak tersedia";
              }
            }
          } catch (err) {
            console.warn("Gagal ambil detail pasien:", item.patientUuid);
          }
        }

        // Return object gabungan untuk tabel
        return {
          uuid: item.uuid,
          name: item.patientName,
          noInvoice: item.invoiceCode,
          billCode: item.billCode,
          noReg: item.noReg,
          doctor: item.doctorName,
          polyclinic: item.serviceTypes,
          status: item.paymentStatus,
          paymentType: item.paymentType,

          // Data dari Master Pasien (Hasil Mapping di atas)
          phone: patientDetail.phone,
          ageYear: patientDetail.ageYear,
          ageMonth: patientDetail.ageMonth,
          ageDay: patientDetail.ageDay,
          address: patientDetail.address,

          // Format Data Lainnya
          createdAt: item.createdAt,
          grandTotal: item.grandTotal,
        };
      }));

      // Masukkan hasil mapping ke list
      closedBillList.value = mappedData;

      // Set Properties Pagination
      const properties = response.properties;
      closedBillProperties.value.page = properties.page || 1;
      closedBillProperties.value.page_size = properties.page_size || 10;
      closedBillProperties.value.total = parseInt(properties.total_data, 10) || 0;
    }

  } catch (error) {
    console.error("Gagal mengambil data Closed Bill:", error);
  } finally {
    storeUtils.setLoading(false);
  }
};


const findTransactionsForDropdown = async (filter: string) => {
  const filterText = filter || "";
  searchQuery.value = filterText;
  if (searchTimer) {
    clearTimeout(searchTimer);
  }

  if (!filterText) {
    searchResults.value = [];
    return;
  }

  searchTimer = setTimeout(async () => {
    loadingSearch.value = true;
    try {
      const startDate = new Date(startDateFilter.value);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(endDateFilter.value);
      endDate.setHours(23, 59, 59, 999);
      const statusForApi = statusFilter.value.toUpperCase() === 'SEMUA' ? '' : statusFilter.value.toUpperCase();
      const response = await store.getApi(
        1,
        20,
        dateToEpoch(startDate),
        dateToEpoch(endDate),
        filterText,
        statusForApi,
        "",
        ""
      );

      if (response && Array.isArray(response.payload)) {
        searchResults.value = response.payload;
      } else {
        searchResults.value = [];
      }
    } catch (error) {
      console.error("Gagal mencari data pasien:", error);
      searchResults.value = [];
    } finally {
      loadingSearch.value = false;
    }
  }, 500);
};

const dynamicOptionLabelKey = computed(() => {
  const query = searchQuery.value;
  const queryUC = query.toUpperCase();
  const addressKeywords = ["JL", "DS", "DSN", "RT", "RW", "NO", "GG", "BLOK"];
  const isAddressQuery = addressKeywords.some(keyword => queryUC.includes(keyword));

  // Pola untuk No. RM
  const isRmPattern = /^\d{2}-/.test(query);

  if (queryUC.includes("INV")) {
    return 'invoiceCode';
  }
  if (isRmPattern) {
    return 'noRm';
  }
  if (isAddressQuery) {
    return 'fullAddress';
  }
  return 'patientName';
});
const searchData = () => {
  closedBillProperties.value.page = 1;
  fetchClosedBills();
};

const resetData = () => {
  const todayReset = new Date();
  const sevenDaysAgoReset = new Date();
  sevenDaysAgoReset.setDate(todayReset.getDate() - 7);

  startDateFilter.value = sevenDaysAgoReset;
  endDateFilter.value = todayReset;
  statusFilter.value = "Semua";
  selectedFilterPoli.value = [];
  selectedPaymentMethod.value = [];
  selectedPatientUuid.value = null;
  searchResults.value = [];
  closedBillProperties.value.page = 1;

  fetchClosedBills();
};

const handlePage = (event: any) => {
  closedBillProperties.value.page = event.page + 1;
  closedBillProperties.value.page_size = event.rows;
  fetchClosedBills();
};

const onPoliSelect = (label: string) => {
  const index = selectedFilterPoli.value.indexOf(label);
  if (index > -1) {
    // Jika sudah ada, hapus dari array
    selectedFilterPoli.value.splice(index, 1);
  } else {
    // Jika belum ada, tambahkan ke array
    selectedFilterPoli.value.push(label);
  }
  searchData();
};

const onPaymentMethodSelect = (label: string) => {
  const index = selectedPaymentMethod.value.indexOf(label);
  if (index > -1) {
    // Jika sudah ada, hapus dari array
    selectedPaymentMethod.value.splice(index, 1);
  } else {
    // Jika belum ada, tambahkan ke array
    selectedPaymentMethod.value.push(label);
  }
  searchData();
};

const showPatientDetail = (event: any) => {
  selectedBillUuid.value = event.data.uuid;
  changeSection("Detail Transaksi Pasien");
};

const changeSection = (label: string) => { dataBreadCrumb.value.push({ label: label }); };
const updatePageType = (path: string) => { let tempArrPath = path.split("/"); pageType.value = tempArrPath[2] ?? ""; };
onBeforeRouteLeave((to, from) => { updatePageType(to.path); });

const handlePatientSelection = (uuid: string) => {
  selectedPatientUuid.value = uuid;
  closedBillProperties.value.page = 1;
  fetchClosedBills();
};

watch(startDateFilter, (newDate) => {
  if (newDate) {
    // Atur waktu ke awal hari (00:00:00)
    newDate.setHours(0, 0, 0, 0);
  }
}, { immediate: true });

watch(endDateFilter, (newDate) => {
  if (newDate) {
    // Atur waktu ke akhir hari (23:59:59)
    newDate.setHours(23, 59, 59, 999);
  }
}, { immediate: true });

//Refresh button
const handleRefresh = () => {
  // Cukup panggil ulang fungsi fetch utama
  fetchClosedBills();
};

onMounted(() => {
  updatePageType(route.path);
  fetchClosedBills();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card v-if="dataBreadCrumb.length == 0" pt:body:class="h-full pt-0 overflow-auto"
      pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="handleRefresh" />
          <CustomBreadCrumb :home="{ label: 'Closed Bill', home: true }" />
          <CustomSelect v-model="selectedPatientUuid" label="Pencarian" prependIcon="PhMagnifyingGlass"
            place-holder="Cari Nama / Alamat / No. RM" :options="searchResults"
            :optionLabel="dynamicOptionLabelKey" optionValue="uuid" :loading="loadingSearch"
            @filter="findTransactionsForDropdown" @update:model-value="handlePatientSelection" />
          <CustomSelect label="Status" v-model="statusFilter" optionLabel="" optionValue=""
            :options="['SEMUA', 'LUNAS', 'PIUTANG']" />
          <CustomDatePicker v-model="startDateFilter" label="Tanggal mulai" class="toolbar-field--date"
            :maxDate="endDateFilter" />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker v-model="endDateFilter" label="Tanggal selesai" class="toolbar-field--date"
            :minDate="startDateFilter" :maxDate="today" />
          <ToolbarFilterMenu :count="selectedFilterPoli.length">
            <template #label>Pelayanan</template>
            <CustomChip v-for="(poli, index) in filterPoliList" :key="poli + index" :label="poli"
              :isSelected="selectedFilterPoli.includes(poli)" @selected="onPoliSelect" />
          </ToolbarFilterMenu>
          <ToolbarFilterMenu :count="selectedPaymentMethod.length">
            <template #label>Pembayaran</template>
            <CustomChip label="TUNAI" :isSelected="selectedPaymentMethod.includes('TUNAI')"
              @selected="onPaymentMethodSelect" />
            <CustomChip label="ASURANSI" :isSelected="selectedPaymentMethod.includes('ASURANSI')"
              @selected="onPaymentMethodSelect" />
          </ToolbarFilterMenu>
          <CustomButton @click="searchData" icon="PhMagnifyingGlass" label="Cari" />
          <CustomButton @click="resetData" label="Reset" outlined borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300" />
        </PageToolbar>
      </template>

      <!-- Datatable -->
      <template #content>
        <DataTable v-if="hasData" :value="closedBillList" scrollable scrollHeight="flex" :pt="{ headerRow: 'text-SM' }"
          @rowClick="showPatientDetail">
          <Column header="Nomor" headerClass="bg-opensimrs-50" style="width: 10%">
            <template #body="slotProps">
              <div class="text-center text-SM">
                <div v-if="slotProps.data.noRm" class="text-SM">
                  {{ slotProps.data.noRm }}
                </div>
                <div>{{ slotProps.data.noReg }}</div>
                <div>{{ slotProps.data.noInvoice }}</div>
              </div>
            </template>
          </Column>

          <Column header="Pasien" headerClass="bg-opensimrs-50" style="width: 35%">
            <template #body="slotProps">
              <div class="text-SM">
                <span class="font-semibold">{{ slotProps.data.name }}</span>
                <span class="text-grey-300">
                  ({{ slotProps.data.ageYear }}Th {{ slotProps.data.ageMonth }}Bln {{ slotProps.data.ageDay }}Hr)
                </span>
              </div>
              <div class="text-XS">{{ slotProps.data.address }}</div>
              <div class="flex flex-wrap mt-1">
                <CustomChip :showCheckedIcon="false"
                  :label="['Perempuan', 'Female'].includes((slotProps.data.jenisKelamin || '').toString().trim()) ? 'Perempuan' : 'Laki-laki'"
                  :bgColor="['Perempuan', 'Female'].includes((slotProps.data.jenisKelamin || '').toString().trim()) ? 'bg-female-75' : 'bg-male-75'"
                  :textColor="['Perempuan', 'Female'].includes((slotProps.data.jenisKelamin || '').toString().trim()) ? 'text-female-300' : 'text-male-300'"
                  customClass="h-5 pr-[6px] border-none mr-[5px]" />
                <CustomChip :showCheckedIcon="false" :label="slotProps.data.phone" bgColor="bg-opensimrs-50"
                  textColor="text-opensimrs-300" customClass="h-5 pr-[6px] border-none mr-[5px]" />
              </div>
            </template>
          </Column>

          <Column header="Keperawatan" headerClass="bg-opensimrs-50" style="width: 35%">
            <template #body="slotProps">
              <div class="text-SM">
                {{ slotProps.data.doctor }}

                <span v-if="slotProps.data.scheduleStartTime">
                  <span class="text-opensimrs-300"> | </span>
                  {{ epochToDate(slotProps.data.scheduleStartTime, 'time') }}

                  <template v-if="slotProps.data.scheduleEndTime"> - {{ epochToDate(slotProps.data.scheduleEndTime,
                    'time') }}</template>
                </span>
              </div>
              <div class="flex flex-wrap mt-1">
                <CustomChip v-for="(service, index) in getServiceList(slotProps.data.polyclinic)" :key="index"
                  :label="service.label" :showCheckedIcon="false" customClass="h-5 pr-[5px] mr-[5px]" />
                <CustomChip v-if="slotProps.data.roomName" :showCheckedIcon="false" label="RUANGAN"
                  customClass="h-5 pr-[5px] mr-[5px]" />
                <CustomChip v-if="slotProps.data.bedNumber" :showCheckedIcon="false" label="BED"
                  customClass="h-5 pr-[5px] mr-[5px]" />
                <!-- <CustomChip v-if="slotProps.data.paymentStatus && slotProps.data.serviceTypes === 'IGD'"
                  :showCheckedIcon="false" :label="slotProps.data.paymentStatus" customClass="h-5 pr-[5px] mr-[5px]" />
                <CustomChip v-if="slotProps.data.poliName && slotProps.data.serviceTypes === 'RJ'"
                  :showCheckedIcon="false" :label="slotProps.data.poliName" customClass="h-5 pr-[5px] mr-[5px]" /> -->
                <CustomChip :showCheckedIcon="false" :label="slotProps.data.paymentType" :bgColor="slotProps.data.paymentType == 'TUNAI'
                  ? 'bg-opensimrs-50'
                  : 'bg-warning-50'
                  " :textColor="slotProps.data.paymentType == 'TUNAI'
                    ? 'text-opensimrs-300'
                    : 'text-warning-300'
                    " :borderColor="slotProps.data.paymentType == 'TUNAI'
                      ? 'border-opensimrs-300'
                      : 'border-warning-300'
                      " customClass="h-5 pr-[6px] mr-[5px]" />
              </div>
            </template>
          </Column>

          <Column header="Status" headerClass="bg-opensimrs-50" style="width: 5%">
            <template #body="slotProps">
              <div class="flex items-center justify-center">
                <CustomChip :showCheckedIcon="false" :label="slotProps.data.status"
                  :bgColor="slotProps.data.status.toUpperCase() == 'LUNAS' ? 'bg-success-75' : 'bg-danger-75'"
                  :textColor="slotProps.data.status.toUpperCase() == 'LUNAS' ? 'text-success-300' : 'text-danger-300'"
                  customClass="h-5 pr-[6px] border-none" />
              </div>
            </template>
          </Column>
        </DataTable>
        <NoData v-else />
      </template>
      <template #footer>
        <div class="flex justify-end">
          <Paginator :first="(closedBillProperties.page - 1) * closedBillProperties.page_size"
            :rows="closedBillProperties.page_size" :totalRecords="closedBillProperties.total"
            :rowsPerPageOptions="[10, 20, 30]" @page="handlePage"
            template="FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink RowsPerPageDropdown"
            currentPageReportTemplate="{currentPage}">
            <template #start>
              <span class="font-md mr-4">Total Data: {{ closedBillProperties.total }}</span>
            </template>
          </Paginator>
        </div>
      </template>
    </Card>
    <!-- <ClosedBillDetailPage
      v-else-if="dataBreadCrumb[0].label == 'Detail Transaksi Pasien'"
      :dataBreadCrumb="dataBreadCrumb"
      :pageType="pageType"
      @back="dataBreadCrumb.pop()"
      @goToDetail="dataBreadCrumb[0].label = 'Detail Transaksi Pasien'"
    /> -->
    <ClosedBillDetailPage v-else-if="dataBreadCrumb[0].label == 'Detail Transaksi Pasien' && selectedBillUuid"
      :bill-uuid="selectedBillUuid" :dataBreadCrumb="dataBreadCrumb" :pageType="pageType" @back="dataBreadCrumb.pop()"
      @goToDetail="dataBreadCrumb[0].label = 'Detail Transaksi Pasien'" />
  </div>
</template>
