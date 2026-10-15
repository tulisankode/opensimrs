<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import { onBeforeRouteLeave, useRoute } from "vue-router";
import { utilsStore } from "@/stores/utils";
import { dateToEpoch, epochToDate } from "@/utils/Helpers";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import Paginator from 'primevue/paginator';
import TransactionDetailPage from "@/views/Pembayaran/layout/TransactionPelayanan.vue";
import type { DataTableRowClickEvent } from "primevue/datatable";
import type { MenuItem } from "primevue/menuitem";
import NoData from "@/components/section/NoData.vue";
import { usePelayananTransaction as usePelayananStore } from "@/stores/pembayaran/pelayanan";
import { useAdmisiMasterPasienStore } from "@/stores/admisi/masterPasien";



const today = new Date();
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(today.getDate() - 7);

const startDateFilter = ref<Date>(sevenDaysAgo);
const endDateFilter = ref<Date>(today);
const pageType = ref("");
const searchQuery = ref<string>("");
const selectedBillUuid = ref<string>();

const filterPoliList = ref([
  "RAWAT JALAN",
  "RAWAT INAP",
  "IGD",
]);

const masterPasienStore = useAdmisiMasterPasienStore();
const pelayananStore = usePelayananStore();
const UseUtilsStore = utilsStore();
const pelayananPayload = ref<any[]>([]);
const pelayananProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// State untuk Pencarian Dropdown
const searchResults = ref<any[]>([]);
const loadingSearch = ref(false);
const selectedPatientUuid = ref<string | null>(null);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

const hasData = computed(
  () => pelayananPayload.value && pelayananPayload.value.length > 0
);

watch(startDateFilter, (newDate) => {
  if (newDate) newDate.setHours(0, 0, 0, 0);
}, { immediate: true });

watch(endDateFilter, (newDate) => {
  if (newDate) newDate.setHours(23, 59, 59, 999);
}, { immediate: true });

const poliMapping: { [key: string]: string } = {
  "RAWAT JALAN": "RJ",
  "RAWAT INAP": "RI",
  "IGD": "IGD",
  "APS & OTC": "APS",
};

// Mapping untuk menampilkan nama layanan dari kode 
const reversePoliMapping: { [key: string]: string } = {
  "RJ": "RAWAT JALAN",
  "RI": "RAWAT INAP",
  "IGD": "IGD",
  "APS": "APS & OTC"
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


const fetchPelayanan = async () => {
  UseUtilsStore.setLoading(true);
  try {
    // 1. Siapkan parameter filter
    let statusForApi = '';
    if (selectedPayType.value === 'MenungguPembayaran') statusForApi = 'PIUTANG';
    else if (selectedPayType.value === 'Lunas') statusForApi = 'LUNAS';

    const poliForApi = selectedFilterPoli.value.map(poli => poliMapping[poli] || poli);
    const paymentForApi = selectedPaymentMethod.value;

    // 2. Panggil API Transaksi Pelayanan (Utama)
    const response = await pelayananStore.getApi(
      pelayananProperties.value.page,
      pelayananProperties.value.page_size,
      dateToEpoch(startDateFilter.value),
      dateToEpoch(endDateFilter.value),
      selectedPatientUuid.value || searchQuery.value,
      statusForApi,
      poliForApi,
      paymentForApi
    );

    const plainResponse = JSON.parse(JSON.stringify(response));

    if (plainResponse && plainResponse.payload && plainResponse.properties) {
      // 3. Mapping data awal dari Response Pelayanan
      const rawData = plainResponse.payload;

      // Ambil semua patient_uuid yang unik untuk di-fetch detailnya
      const patientUuids = [...new Set(rawData.map((item: any) => item.patientUuid))];

      // 4. Fetch Detail Pasien dari Admisi secara Paralel
      const patientDetailsMap: Record<string, any> = {};

      await Promise.all(
        patientUuids.map(async (uuid) => {
          if (!uuid) return;
          try {
            const detailRes = await masterPasienStore.getDetailMasterPasien(uuid as string);
            if (detailRes && detailRes.payload) {
              patientDetailsMap[uuid as string] = detailRes.payload;
            }
          } catch (err) {
            console.error(`Gagal fetch detail pasien ${uuid}`, err);
          }
        })
      );

      // 5. Gabungkan Data Pelayanan dengan Data Detail Pasien (Phone & Address)
      pelayananPayload.value = rawData.map((item: any) => {
        const patientDetail = patientDetailsMap[item.patientUuid] || {};

        return {
          uuid: item.uuid,
          billCode: item.billCode,
          invoiceCode: item.invoiceCode,
          noRm: patientDetail.noRm || item.noRm || '-', // Prioritas dari detail pasien
          noReg: item.noReg || '-', // Asumsi field ini ada atau default
          patientName: item.patientName,

          // Data Umur (Dari detail pasien jika ada)
          ageYear: patientDetail.birthDetail?.ageYear ?? item.ageYear ?? 0,
          ageMonth: patientDetail.birthDetail?.ageMonth ?? item.ageMonth ?? 0,
          ageDay: patientDetail.birthDetail?.ageDay ?? item.ageDay ?? 0,

          // DATA BARU DARI ADMISI
          fullAddress: patientDetail.address?.fullAddress || item.fullAddress || '-',
          noHandphone: patientDetail.phone || item.noHandphone || '-',
          jenisKelamin: patientDetail.gender || item.jenisKelamin || '-',

          doctorName: item.doctorName,
          scheduleStartTime: item.scheduleStartTime,
          scheduleEndTime: item.scheduleEndTime,
          poliName: item.poliName, // Sesuaikan jika ada mapping poli
          serviceTypes: item.serviceTypes,
          paymentType: item.paymentType,
          paymentStatus: item.paymentStatus,// sebelumnya completenessStatus
          roomName: item.roomName,
          bedNumber: item.bedNumber,
        };
      });

      // Set Properties Pagination
      const apiProperties = plainResponse.properties;
      pelayananProperties.value.page = apiProperties.page;
      pelayananProperties.value.page_size = apiProperties.pageSize;
      pelayananProperties.value.total = parseInt(apiProperties.totalData, 10) || 0;

    } else {
      pelayananPayload.value = [];
      pelayananProperties.value.total = 0;
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    pelayananPayload.value = [];
    pelayananProperties.value.total = 0;
  } finally {
    UseUtilsStore.setLoading(false);
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
      // Mengambil filter aktif saat ini
      let statusForApi = '';
      if (selectedPayType.value === 'MenungguPembayaran') {
        statusForApi = 'PIUTANG';
      } else if (selectedPayType.value === 'Lunas') {
        statusForApi = 'LUNAS';
      }
      const poliForApi = selectedFilterPoli.value.map(poli => poliMapping[poli] || poli);
      const paymentForApi = selectedPaymentMethod.value;

      // Memanggil API dengan limit kecil untuk dropdown
      const response = await pelayananStore.getApi(
        1,
        20,
        dateToEpoch(startDateFilter.value),
        dateToEpoch(endDateFilter.value),
        filterText,
        statusForApi,
        poliForApi,
        paymentForApi
      );

      const plainResponse = JSON.parse(JSON.stringify(response));
      if (plainResponse && Array.isArray(plainResponse.payload)) {
        searchResults.value = plainResponse.payload;
      } else {
        searchResults.value = [];
      }
    } catch (error) {
      console.error("Gagal mencari data dropdown:", error);
      searchResults.value = [];
    } finally {
      loadingSearch.value = false;
    }
  }, 500); // Jeda 500ms
};

const applyFilter = () => {
  pelayananProperties.value.page = 1;
  fetchPelayanan();
};

const resetFilter = () => {
  const todayReset = new Date();
  const sevenDaysAgoReset = new Date();
  sevenDaysAgoReset.setDate(todayReset.getDate() - 7);

  startDateFilter.value = sevenDaysAgoReset;
  endDateFilter.value = todayReset;
  searchQuery.value = "";
  selectedPayType.value = "MenungguPembayaran";
  selectedFilterPoli.value = [];
  selectedPaymentMethod.value = [];
  selectedPatientUuid.value = null;
  searchResults.value = [];
  applyFilter();
};

const selectedPayType = ref<string>("Semua");
const onSelectPayType = (label: string) => {
  selectedPayType.value = label;
  applyFilter();
};

const selectedFilterPoli = ref<string[]>([]);
const onPoliSelect = (label: string) => {
  const index = selectedFilterPoli.value.indexOf(label);
  if (index > -1) {
    selectedFilterPoli.value.splice(index, 1);
  } else {
    selectedFilterPoli.value.push(label);
  }
  applyFilter();
};

const selectedPaymentMethod = ref<string[]>([]);
const onPaymentMethodSelect = (label: string) => {
  const index = selectedPaymentMethod.value.indexOf(label);
  if (index > -1) {
    // Jika sudah ada, hapus dari array
    selectedPaymentMethod.value.splice(index, 1);
  } else {
    // Jika belum ada, tambahkan ke array
    selectedPaymentMethod.value.push(label);
  }
  applyFilter();
};


const handlePage = (event: any) => {
  pelayananProperties.value.page = event.page + 1;
  pelayananProperties.value.page_size = event.rows;
  fetchPelayanan();
};

const dataBreadCrumb = ref<MenuItem[]>([
  { label: 'Pelayanan' }
]);

const changeSection = (label: string) => {
  dataBreadCrumb.value.push({ label: label });
};

const dynamicOptionLabelKey = computed(() => {
  const query = searchQuery.value;
  const queryUC = query.toUpperCase();
  const addressKeywords = ["JL", "DS", "DSN", "RT", "RW", "NO", "GG", "BLOK"];
  const isAddressQuery = addressKeywords.some(keyword => queryUC.includes(keyword));

  // Pola untuk No. RM
  const isRmPattern = /^\d{2}-/.test(query);

  if (isRmPattern) {
    return 'noRm';
  }
  if (isAddressQuery) {
    return 'fullAddress';
  }
  return 'patientName';
});

const handlePatientSelection = (uuid: string) => {
  if (!uuid) return;
  selectedPatientUuid.value = uuid;
  pelayananProperties.value.page = 1; // Reset halaman ke 1
  fetchPelayanan(); // Panggil fungsi fetch utama
};

const showDetail = (event: DataTableRowClickEvent) => {
  selectedBillUuid.value = event.data.uuid; // Simpan UUID
  changeSection("Detail Tagihan");
};

onMounted(() => {
  fetchPelayanan();
});
</script>


<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card v-if="dataBreadCrumb.length === 1" pt:body:class="h-full pt-0 overflow-auto"
      pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="fetchPelayanan" />
          <CustomBreadCrumb :model="dataBreadCrumb" :home="{ label: 'Transaksi', home: true }" />
          <CustomSelect v-model="selectedPatientUuid" label="Pencarian" prependIcon="PhMagnifyingGlass"
            place-holder="Cari Nama / Alamat / No. RM" :options="searchResults"
            :optionLabel="dynamicOptionLabelKey" optionValue="uuid" :loading="loadingSearch"
            @filter="findTransactionsForDropdown" @update:model-value="handlePatientSelection" />
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
          <!-- Status pembayaran -->
          <div class="flex items-center gap-1 shrink-0" role="group" aria-label="Status pembayaran">
            <CustomButton @click="onSelectPayType('Semua')" icon="PhListBullets"
              v-tooltip.bottom="'Semua status'" aria-label="Semua status"
              :outlined="selectedPayType != 'Semua'" borderColor="border-opensimrs-300"
              :textColor="selectedPayType != 'Semua' ? 'text-opensimrs-300' : 'text-white'"
              :backgroundColor="selectedPayType != 'Semua' ? 'bg-transparent' : 'bg-opensimrs-300'" />
            <CustomButton @click="onSelectPayType('MenungguPembayaran')" label="Menunggu"
              :outlined="selectedPayType != 'MenungguPembayaran'" borderColor="border-opensimrs-300"
              :textColor="selectedPayType != 'MenungguPembayaran' ? 'text-opensimrs-300' : 'text-white'"
              :backgroundColor="selectedPayType != 'MenungguPembayaran' ? 'bg-transparent' : 'bg-opensimrs-300'"
              class="font-semibold" />
            <CustomButton @click="onSelectPayType('Lunas')" label="Lunas"
              :outlined="selectedPayType != 'Lunas'" borderColor="border-opensimrs-300"
              :textColor="selectedPayType != 'Lunas' ? 'text-opensimrs-300' : 'text-white'"
              :backgroundColor="selectedPayType != 'Lunas' ? 'bg-transparent' : 'bg-opensimrs-300'"
              class="font-semibold" />
          </div>
          <CustomButton @click="applyFilter" icon="PhMagnifyingGlass" label="Cari" />
          <CustomButton @click="resetFilter" label="Reset" outlined borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!hasData" />
        <DataTable v-else :value="pelayananPayload" tableStyle="min-width: 50rem" scrollable scrollHeight="flex"
          :pt="{ headerRow: 'text-SM' }" @rowClick="showDetail">
          <Column field="nomor" headerClass="bg-opensimrs-50">
            <template #header>
              <div class="w-full font-semibold text-center">Nomor</div>
            </template>
            <template #body="slotProps">
              <div class="text-center">
                <div class="text-SM">{{ slotProps.data.billCode }}</div>
                <div class="text-SM">{{ slotProps.data.noReg }}</div>
                <div class="text-SM">{{ slotProps.data.invoiceCode }}</div>
              </div>
            </template>
          </Column>
          <Column field="pasien" header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">
                <span class="font-semibold">{{ slotProps.data.patientName }}</span>
                <span class="text-grey-300">
                  ({{ slotProps.data.ageYear }}Th
                  {{ slotProps.data.ageMonth }}Bln
                  {{ slotProps.data.ageDay }}Hr)
                </span>
              </div>
              <div class="text-XS">{{ slotProps.data.fullAddress }}</div>
              <div class="flex flex-wrap">
                <CustomChip :showCheckedIcon="false"
                  :label="['Perempuan', 'Female'].includes((slotProps.data.jenisKelamin || '').toString().trim()) ? 'Perempuan' : 'Laki-laki'"
                  :bgColor="['Perempuan', 'Female'].includes((slotProps.data.jenisKelamin || '').toString().trim()) ? 'bg-female-75' : 'bg-male-75'"
                  :textColor="['Perempuan', 'Female'].includes((slotProps.data.jenisKelamin || '').toString().trim()) ? 'text-female-300' : 'text-male-300'"
                  customClass="h-5 pr-[6px] border-none mr-[5px]" />
                <CustomChip :showCheckedIcon="false" :label="slotProps.data.noHandphone" bgColor="bg-opensimrs-50"
                  textColor="text-opensimrs-300" customClass="h-5 pr-[6px] border-none mr-[5px]" />
              </div>
            </template>
          </Column>
          <Column field="keperawatan" header="Keperawatan" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">
                {{ slotProps.data.doctorName }}

                <span v-if="slotProps.data.scheduleStartTime">
                  <span class="text-opensimrs-300"> | </span>
                  {{ epochToDate(slotProps.data.scheduleStartTime, 'time') }}

                  <template v-if="slotProps.data.scheduleEndTime"> - {{ epochToDate(slotProps.data.scheduleEndTime,
                    'time') }}</template>
                </span>
              </div>
              <div class="flex flex-wrap mt-1">
                <CustomChip v-for="(service, index) in getServiceList(slotProps.data.serviceTypes)" :key="index"
                  :label="service.label" :showCheckedIcon="false" customClass="h-5 pr-[5px] mr-[5px]" />
                <CustomChip v-if="slotProps.data.roomName" :showCheckedIcon="false" label="RUANGAN"
                  customClass="h-5 pr-[5px] mr-[5px]" />
                <CustomChip v-if="slotProps.data.bedNumber" :showCheckedIcon="false" label="BED"
                  customClass="h-5 pr-[5px] mr-[5px]" />
                <!-- <CustomChip v-if="slotProps.data.paymentStatus && slotProps.data.serviceTypes === 'IGD'"
                  :showCheckedIcon="false" :label="slotProps.data.paymentStatus" customClass="h-5 pr-[5px] mr-[5px]" /> -->
                <CustomChip v-if="slotProps.data.poliName && slotProps.data.serviceTypes === 'RJ'"
                  :showCheckedIcon="false" :label="slotProps.data.poliName" customClass="h-5 pr-[5px] mr-[5px]" />
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
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <Paginator :first="(pelayananProperties.page - 1) * pelayananProperties.page_size"
            :rows="pelayananProperties.page_size" :totalRecords="pelayananProperties.total"
            :rowsPerPageOptions="[10, 20, 30]" @page="handlePage"
            template="FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink RowsPerPageDropdown"
            currentPageReportTemplate="{currentPage}">
            <template #start>
              <span class="font-md mr-4">Total Data: {{ pelayananProperties.total }}</span>
            </template>
          </Paginator>
        </div>
      </template>
    </Card>
    <TransactionDetailPage v-else :bill-uuid="selectedBillUuid" :dataBreadCrumb="dataBreadCrumb" :pageType="pageType"
      @back="dataBreadCrumb.pop()" />
  </div>
</template>