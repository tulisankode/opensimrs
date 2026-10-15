<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import Pelayanan from "../Layout/Tabel/Poli/DataPelayananRawatJalan.vue";
import { useRoute } from "vue-router";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import Discharge from "../Layout/Tabel/Poli/DataDischargeRawatJalan.vue";
import { utilsStore } from "@/stores/utils";
import { useAdmisiRJStore } from "@/stores/admisi/rawatJalan";
import { useRJStore } from "@/stores/rawatJalan/laporanrajal";
import DataAllPasienRawatJalan from "../Layout/Tabel/Poli/DataAllPasienRawatJalan.vue";
import KonfirmasiMulaiPeriksa from "../Layout/Tabel/Poli/KonfirmasiMulaiPeriksa.vue";
import type { FilterAdmisi } from "@/utils/Interface";
import { dateToEpoch, setTimeForDate } from "@/utils/Helpers";
import DataPoliBPJSHeader from "../Layout/Header/DataPoliBPJSHeader.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";

// NOTE Store
const storeUtils = utilsStore();
const admisiRJStore = useAdmisiRJStore();
const rjStore = useRJStore();

const headerPoliBPJSRef = ref<typeof DataPoliBPJSHeader>();

const resetFilter = () => {
  headerPoliBPJSRef.value?.resetFilter();

  filterData.value = headerPoliBPJSRef.value?.searchData() ?? {
    startDate: dateToEpoch(setTimeForDate(new Date(), 0, 0, 0)),
    endDate: dateToEpoch(setTimeForDate(new Date(), 23, 59, 59)),
  };
};

const patientData = ref<any>([]);

const properties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

const filterData = ref<FilterAdmisi>({
  startDate: `${dateToEpoch(
    setTimeForDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 0, 0, 0)
  )}`,
  endDate: `${dateToEpoch(
    setTimeForDate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 23, 59, 59)
  )}`,
  status: "2",
  poly: [],
  q: "",
  dpjp: "",
  paymentMethod: "",
});

const search = async () => {
  const headerFilters = headerPoliBPJSRef.value?.searchData() ?? {};

  filterData.value = {
    ...headerFilters,
    poly: filterData.value.poly,
    page: properties.value.page,
    limit: properties.value.page_size,
    status: statusPelayanan.value,
  };


  if (currentRouteName.value == "rawat-jalan-poli") {
    patientData.value = await fetchRJPatient();
  }
};

// Dipanggil tabel setelah pasien dipanggil / mulai diperiksa.
const muatUlangPasien = async () => {
  patientData.value = await fetchRJPatient();
};

const fetchRJPatient = async () => {
  storeUtils.setLoading(true);
  try {
    const response = await admisiRJStore.getRJ(filterData.value);
    if (response && response.payload) {
      properties.value.total = response.properties.totalData;
      return response.payload;
    } else {
      return [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    return [];
  } finally {
    storeUtils.setLoading(false);
  }
};
interface Filter {
  name: string;
  uuid: string;
}

const props = defineProps<{
  filter: Filter;
}>();

watch(
  () => props.filter,
  async (newFilter) => {
    if (newFilter && newFilter.uuid) {
      filterData.value.poly = [newFilter.uuid];
    } else {
      filterData.value.poly = []; 
    }
    filterData.value.page = 1;
    properties.value.page = 1;
    patientData.value = await fetchRJPatient();
  },
  {
    deep: true,
  }
);

const statusPelayanan = ref("2");

const showCancelVisit = ref(false);
const cancelReason = ref<string>();
const selectedPatient = ref<any[]>([]);

const route = useRoute();
const currentRouteName = ref("");

onMounted(async () => {
  currentRouteName.value = route.name ? String(route.name) : "";
  // Dokter yang login: default hanya pasien miliknya.
  try {
    const konteks = await rjStore.getKonteksPetugas();
    if (konteks?.isDoctor && konteks?.practitionerUuid && !filterData.value.dpjp) {
      filterData.value.dpjp = konteks.practitionerUuid;
      headerPoliBPJSRef.value?.setDokter(konteks.practitionerUuid);
    }
  } catch {
    /* filter dokter tidak wajib */
  }
  patientData.value = await fetchRJPatient();
});

const updateSelectedPatient = (patient: any) => {
  patient.length > 0
    ? (selectedPatient.value = patient)
    : (selectedPatient.value = []);
};

const updateUnselectedPatient = (patient: any) => {
  if (selectedPatient.value && selectedPatient.value.length > 0) {
    const index = selectedPatient.value.findIndex(
      (p: { id: string }) => p.id === patient.phone
    );
    if (index !== -1) {
      selectedPatient.value.splice(index, 1);
    }
  }
};

const updateUnselectAll = () => {
  selectedPatient.value = [];
};

const isResetPatient = ref(false);

const resetCancelVisit = () => {
  cancelReason.value = ""; 
  selectedPatient.value = []; 
  showCancelVisit.value = false; 
  isResetPatient.value = !isResetPatient.value;
};

const handleResetPatient = () => {
  isResetPatient.value = false;
};

const confirmCancel = async () => {
  try {
    storeUtils.setLoading(true);
    let payload = {
      listUuid: [] as any[],
      cancelReason: cancelReason.value,
    };
    selectedPatient.value.forEach((patient) => {
      payload.listUuid.push(patient.uuid);
    });
    const response = await admisiRJStore.cancelVisitRJ(payload);
    showCancelVisit.value = false;
    if (response) {
      resetCancelVisit();
      search();
    }
  } catch (error) {
    console.error("Failed to cancel visit", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

// Pagination
const handlePage = (event: any) => {
  properties.value.page = event.page + 1;
  properties.value.page_size = event.rows;
  search();
};

// FIlter Status
const filterStatus = async (status: string) => {
  statusPelayanan.value = status;
  filterData.value = {
    ...filterData.value,
    status: statusPelayanan.value,
  };
  patientData.value = await fetchRJPatient();
};

const handleReset = () => {
  headerPoliBPJSRef.value?.resetFilter();
  statusPelayanan.value = "2";
  search();
};
</script>

<template>
  <!-- {{ filter }} -->

  <!-- {{ showCancelVisit }} -->
  <!-- {{ patientData }} -->
  <!-- {{ selectedPatient }} -->

  <!-- {{ currentRouteName }} -->
  <!-- {{ filterData }} -->

  <!-- {{ statusPelayanan }} -->
  <Card
    pt:body:class="h-full pt-0 overflow-auto"
    pt:content:class="h-full overflow-auto"
    class=""
  >
    <template #header>
      <DataPoliBPJSHeader
        ref="headerPoliBPJSRef"
        @search="search"
        @reload-data="search"
        @payment="search"
        @reset="handleReset"
        :filter-menu="filter"
        :filter-data="filterData"
        :current-route-name="currentRouteName"
      >
        <template #content>
      <!-- Konfirmasi "pasien belum dipanggil" saat RME dibuka (di dalam Card agar halaman tetap satu root). -->
      <KonfirmasiMulaiPeriksa />
          <div class="flex items-center gap-1 shrink-0" role="group" aria-label="Status pelayanan">
            <CustomButton
              v-tooltip.bottom="'Semua status'"
              aria-label="Semua status"
              label=""
              icon="PhListBullets"
              :text-color="
                statusPelayanan === '2' ? 'text-white' : 'text-opensimrs-300'
              "
              :border-color="
                statusPelayanan === '2' ? 'border-none' : 'border-opensimrs-300'
              "
              :class="statusPelayanan === '2' ? 'bg-opensimrs-300' : 'bg-white'"
              @click="filterStatus('2')"
              :outlined="statusPelayanan !== '2'"
            />
            <!-- Filter = {{ props.filter }} -->
            <CustomButton
              label="Pelayanan"
              :text-color="
                statusPelayanan === '1' ? 'text-white' : 'text-opensimrs-300'
              "
              :border-color="
                statusPelayanan === '1' ? 'border-none' : 'border-opensimrs-300'
              "
              :class="statusPelayanan === '1' ? 'bg-opensimrs-300' : 'bg-white'"
              @click="filterStatus('1')"
              :outlined="statusPelayanan !== '1'"
            />
            <CustomButton
              label="Discharge"
              :text-color="
                statusPelayanan === '0' ? 'text-white' : 'text-opensimrs-300'
              "
              :border-color="
                statusPelayanan === '0' ? 'border-none' : 'border-opensimrs-300'
              "
              :class="statusPelayanan === '0' ? 'bg-opensimrs-300' : 'bg-white'"
              @click="filterStatus('0')"
              :outlined="statusPelayanan !== '0'"
            />
          </div>
        </template>
      </DataPoliBPJSHeader>
    </template>
    <template #content>
      <Tabs v-model:value="statusPelayanan" class="h-full overflow flex flex-col">
        <TabPanels class="flex flex-col w-full h-full p-0">
          <TabPanel value="2" class="flex-1 flex flex-col">
            <DataAllPasienRawatJalan 
              :data-patient="patientData"
              :isResetPatient="isResetPatient"
              :show-cancel-visit="showCancelVisit"
              @handle-selected-patient="updateSelectedPatient"
              @handle-unselected-patient="updateUnselectedPatient"
              @selectedAll="updateSelectedPatient"
              @handle-unselect-all="updateUnselectAll"
              @is-reset-patient="handleResetPatient"
              @refresh-data="muatUlangPasien"
            />
          </TabPanel>
          <TabPanel value="1" class="flex-1 flex flex-col">
            <Pelayanan
              :data-patient="patientData"
              :isResetPatient="isResetPatient"
              :show-cancel-visit="showCancelVisit"
              @handle-selected-patient="updateSelectedPatient"
              @handle-unselected-patient="updateUnselectedPatient"
              @selectedAll="updateSelectedPatient"
              @handle-unselect-all="updateUnselectAll"
              @is-reset-patient="handleResetPatient"
              @refresh-data="muatUlangPasien"
            />
          </TabPanel>
          <TabPanel value="0" class="flex-1 flex flex-col">
            <Discharge :data-patient="patientData" @refresh-data="muatUlangPasien" />
          </TabPanel>
          <TabPanel value="" class="flex-1">
            <NoData class="w-full h-full" />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </template>
    <template #footer>
      <div class="flex justify-between">
        <div class="flex">
          <CustomButton
            v-if="!showCancelVisit"
            @click="showCancelVisit = true"
            class="my-auto bg-danger-300"
            label="Batal Kunjungan"
          />
          <CustomButton
            v-if="showCancelVisit"
            @click="resetCancelVisit"
            class="my-auto mr-[10px]"
            label="Batal"
            outlined
            borderColor="border-grey-200"
            textColor="text-grey-300"
          />
          <CustomButton
            v-if="showCancelVisit"
            @click="confirmCancel"
            class="my-auto mr-5 bg-danger-300"
            label="Iya, Batalkan"
            :disabled="!cancelReason || selectedPatient.length === 0"
          />

          <CustomTextfield
            v-if="showCancelVisit"
            v-model="cancelReason"
            :showLabel="false"
            class="my-auto w-[400px]"
            placeholder="Alasan Batal Kunjungan"
          />
        </div>
        <CustomPaginator
          :rows="properties.page_size"
          :totalRecords="properties.total"
          @page="handlePage"
        />
      </div>
    </template>
  </Card>
</template>
