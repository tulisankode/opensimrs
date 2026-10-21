<script setup lang="ts">
import { onMounted, ref } from "vue";
import { onBeforeRouteLeave, useRoute } from "vue-router";
import type { MenuItem } from "primevue/menuitem";
import HeaderFilter from "../Layout/HeaderFilter.vue";
import { utilsStore } from "@/stores/utils";
import type { DataTableRowClickEvent } from "primevue/datatable";
import NoData from "@/components/section/NoData.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import FooterPagination from "../Layout/FooterPagination.vue";
import MedicalRecord from "@/views/MedicalRecord/MedicalRecord.vue";
import { useAdmisiIGDStore } from "@/stores/admisi/igd";
import { useLokasiStore } from "@/stores/datamaster/lokasi";
import { useToast } from "primevue/usetoast";
import type { FilterAdmisi } from "@/utils/Interface";
import { epochToDate, dateToEpoch, setTimeForDate } from "@/utils/Helpers";
import { usePraktisiStore } from "@/stores/datamaster/praktisi";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { formatDate } from "@/utils/Helpers";

// NOTE Store
const storeUtils = utilsStore();
const admisiIGDStore = useAdmisiIGDStore();
const praktisiStore = usePraktisiStore();
const lokasiStore = useLokasiStore();
const rekamMedisStore = useRekamMedisStore();
const toast = useToast();

const pageType = ref("");
const route = useRoute();
const searchQuery = ref("");
const reportData = ref<any[]>([]);
const startDateFilter = ref<Date>(new Date());
const endDateFilter = ref<Date>(new Date());
const properties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});
const dataBreadCrumb = ref<MenuItem[]>([]);
const updatePageType = (path: string) => {
  resetFilter();
  dataBreadCrumb.value = [];
  const tempArrPath = path.split("/");
  pageType.value = tempArrPath[2] ?? "";
  reloadData();
};

const changeSection = (label: string, data: any = null) => {
  let tempData = { label };
  if (data) {
    tempData = { ...tempData, ...data };
  }
  if (dataBreadCrumb.value.length) {
    dataBreadCrumb.value[0] = tempData;
  } else {
    dataBreadCrumb.value.push(tempData);
  }
};

onBeforeRouteLeave((to) => {
  updatePageType(to.path);
});

onMounted(() => {
  updatePageType(route.path);

  if (storeUtils.selectedRoom) {
    changeSection("Daftar");
  }
  fetchPraktisiData();
});

const setFilter = () => {
  let filter = {} as FilterAdmisi;
  filter.page = properties.value.page;
  filter.limit = properties.value.page_size;
  filter.q = searchQuery.value;
  filter.paymentMethod =
    selectedFilterPayment.value.length > 1 ||
    !selectedFilterPayment.value.length
      ? ""
      : selectedFilterPayment.value[0];
  filter.withoutIdentity =
    selectedFilterPatient.value.length > 1 ||
    !selectedFilterPatient.value.length
      ? ""
      : selectedFilterPatient.value[0];
  filter.startDate = `${dateToEpoch(
    setTimeForDate(startDateFilter.value, 0, 0, 0)
  )}`;
  filter.endDate = `${dateToEpoch(
    setTimeForDate(endDateFilter.value, 23, 59, 59)
  )}`;
  filter.dpjp = selectedFilterValue.value ?? "";
  filter.status = selectedTab.value;
  return filter;
};
const handleStartDate = (value: any) => {
  startDateFilter.value = value;
};
const handleEndDate = (value: any) => {
  endDateFilter.value = value;
};
const handleSearchQuery = (value: string) => {
  searchQuery.value = value;
};

const reloadData = async () => {
  let filter = {} as FilterAdmisi;
  filter = setFilter();
  reportData.value = await fetchIGDPatient(filter);
};

const onFilterCipPasien = (filters: string[]) => {
  selectedFilterPatient.value = filters; // Update selected filters
  reloadData();
};
const onFilterCipPayment = (filters: string[]) => {
  selectedFilterPayment.value = filters; // Update selected filters
  reloadData();
};
const handleReset = () => {
  resetFilter();
  reloadData();
};
const resetFormRef = ref();
const resetFilter = () => {
  searchQuery.value = "";
  selectedFilterPayment.value = [];
  selectedFilterPatient.value = [];
  selectedTab.value = "2";
  let date = new Date(),
    y = date.getFullYear(),
    m = date.getMonth();

  startDateFilter.value = new Date(y, m, 1);
  endDateFilter.value = new Date(y, m + 1, 0);
  resetFormRef.value.resetForm();
};

const fetchIGDPatient = async (filter: FilterAdmisi = {}) => {
  storeUtils.setLoading(true);
  try {
    const response = await admisiIGDStore.getIGD(filter);
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

const selectedPatient = ref<any[]>([]);
const showCancelVisit = ref(false);
const cancelReason = ref<string>();
const selectedTab = ref("2");
const selectedFilterPatient = ref<string[]>([]);
const selectedFilterPayment = ref<string[]>([]);
const selectedFilterValue = ref("");

const handleSelectedTab = (newTab: string) => {
  selectedTab.value = newTab;
  reloadData();
};
const handleSelectedPraktisi = (value: any) => {
  selectedFilterValue.value = value;
};
const toggleCancelVisit = () => {
  showCancelVisit.value = !showCancelVisit.value;
  cancelReason.value = "";
};

const confirmCancel = async () => {
  try {
    storeUtils.setLoading(true);
    let payload = {
      listUuid: [] as any[],
      cancelReason: cancelReason.value,
    };
    selectedPatient.value.forEach((patientData: any) => {
      payload.listUuid.push(patientData.uuid);
    });
    const response = await admisiIGDStore.cancelVisitIGD(payload);
    showCancelVisit.value = false;
    cancelReason.value = undefined;
    selectedPatient.value = [];
    await reloadData();
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const handleRefreshPatientData = async () => {
  if (!openedPatientData.value?.uuid) {
    return;
  }
  setTimeout(async () => {
    try {
      const response = await admisiIGDStore.getDetailIGD(openedPatientData.value.uuid);
      if (response && response.payload) {
        const currentRmUuid = openedPatientData.value.rekamMedisUuid;
        openedPatientData.value = {
          ...response.payload,
          rekamMedisUuid: currentRmUuid
        };
      }
    } catch (error) {
      console.error("❌ Gagal refresh data pasien IGD:", error);
    }
  }, 200);
};

const medicalRecord = ref<any>();
const viewModeRM = ref<'current' | 'history'>('current');
const openedPatientData = ref<any>({});
const openDialogRM = async (event: DataTableRowClickEvent) => {
  try {
    storeUtils.setLoading(true);
    viewModeRM.value = 'current';
    const responseDetailPelayanan = await admisiIGDStore.getDetailIGD(
      event.data.uuid
    );
    if (responseDetailPelayanan && responseDetailPelayanan.payload) {
      openedPatientData.value = responseDetailPelayanan.payload;
      openedPatientData.value.rekamMedisUuid = event.data.rekamMedisUuid;
      openedPatientData.value.practitioner = praktisiPayload.value.find(
        (praktisi) => praktisi.uuid == openedPatientData.value.practitionerUuid
      );
    }
    let response: any;
    if (openedPatientData.value.rekamMedisUuid) {
      response = await rekamMedisStore.getRekamMedis({
        rekamMedisUuid: openedPatientData.value.rekamMedisUuid,
      });
    } else {
      let lokasiUuid = "";
      const responseLokasi = await lokasiStore.getLokasiIgdApi();
      if (responseLokasi && responseLokasi.payload) {
        lokasiUuid = responseLokasi.payload.uuid;
      } else {
        toast.add({
          severity: "error",
          summary: "Lokasi IGD tidak ada di datamaster lokasi",
          detail: "",
          life: 3000,
        });
        return;
      }

      response = await rekamMedisStore.createRekamMedis({
        noRm: openedPatientData.value.noRm,
        noReg: openedPatientData.value.noReg,
        date: formatDate(new Date(), true),
        pelayanan: "igd",
        lokasiUuid: lokasiUuid,
        noPelayanan: openedPatientData.value.noPelayanan,
        paymentMethod: openedPatientData.value.paymentMethod,
      });
    }
    if (response && response.payload) {
      openedPatientData.value.rekamMedisUuid =
        response.payload.meta.rekamMedisUuid;
      rekamMedisStore.setOpenedRekamMedisData(response.payload);
      medicalRecord.value?.showDialogRM();
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const handleOpenHistory = async (historyItem: any) => {
  try {
    storeUtils.setLoading(true);
    viewModeRM.value = 'history';
    const responseDetailPelayanan = await admisiIGDStore.getDetailIGD(
      historyItem.uuid 
    );
    
    if (!responseDetailPelayanan || !responseDetailPelayanan.payload) {
      toast.add({ severity: "error", summary: "Error", detail: "Gagal memuat detail riwayat.", life: 3000 });
      return;
    }

    openedPatientData.value = responseDetailPelayanan.payload;
    openedPatientData.value.rekamMedisUuid = historyItem.rekamMedisUuid;
    const response = await rekamMedisStore.getRekamMedis({
      rekamMedisUuid: openedPatientData.value.rekamMedisUuid,
    });

    if (response && response.payload) {
      openedPatientData.value.rekamMedisUuid = response.payload.meta.rekamMedisUuid;
      rekamMedisStore.setOpenedRekamMedisData(response.payload);
      medicalRecord.value?.showDialogRM();
    }
  } catch (error) {
    console.error("Failed to fetch history data", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const handleCancleReason = (value: string) => {
  cancelReason.value = value;
};
const handlePage = (event: any) => {
  properties.value.page = event.page + 1;
  properties.value.page_size = event.rows;
  reloadData();
};

const praktisiPayload = ref<any[]>([]);
const praktisiProperties = ref({
  page: 1,
  page_size: 9999,
  total: 0,
});
// Search Dokter
const searchDoctor = ref<string>("");

// Fetch data Praktisi dari API
const fetchPraktisiData = async () => {
  storeUtils.setLoading(true);
  try {
    let isDoctor = true;

    const response = await praktisiStore.getApi({
      page: praktisiProperties.value.page,
      limit: praktisiProperties.value.page_size,
      name: searchDoctor.value,
      isDoctor: isDoctor,
    });

    if (response && response.payload) {
      praktisiPayload.value = response.payload;
    } else {
      praktisiPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    praktisiPayload.value = [];
  } finally {
    storeUtils.setLoading(false);
  }
};
</script>

<template>
  <Card
    pt:body:class="h-full pt-0 overflow-auto"
    pt:content:class="h-full overflow-auto"
    class=""
  >
    <template #header>
      <HeaderFilter
        pageType="pasien-igd"
        @update:valueSearch="handleSearchQuery"
        @update:selectedFilter="handleSelectedPraktisi"
        @selected-tab="handleSelectedTab"
        @reload-data="reloadData()"
        @search="reloadData()"
        @update:startDateFilter="handleStartDate"
        @update:endDateFilter="handleEndDate"
        @filterChipPasien="onFilterCipPasien"
        @filterChipPayment="onFilterCipPayment"
        @reset="handleReset()"
        :filterSelect="praktisiPayload"
        ref="resetFormRef"
      />
    </template>
    <template #content>
      <DataTable
        v-if="reportData.length"
        v-model:selection="selectedPatient"
        :value="reportData"
        tableStyle="min-width: 50rem"
        scrollable
        scrollHeight="flex"
        :pt="{ headerRow: 'text-SM' }"
        @rowClick="openDialogRM"
      >
        <Column field="nomor" headerClass="bg-opensimrs-50">
          <template #header>
            <div class="w-full font-semibold text-center">Nomor</div>
          </template>
          <template #body="slotProps">
            <div class="text-center">
              <div class="text-SM">{{ slotProps.data.noRm }}</div>
              <div class="text-SM">{{ slotProps.data.noReg }}</div>
              <div class="text-SM">{{ slotProps.data.noPelayanan }}</div>
            </div>
          </template>
        </Column>
        <Column field="pasien" header="Pasien" headerClass="bg-opensimrs-50">
          <template #body="slotProps">
            <div class="text-SM">
              <span class="font-semibold">{{
                slotProps.data.patient.name
              }}</span>
              <span class="text-grey-300">
                ({{ slotProps.data.birthDetail.ageYear }}Th
                {{ slotProps.data.birthDetail.ageMonth }}Bln
                {{ slotProps.data.birthDetail.ageDay }}Hr)
              </span>
            </div>
            <div class="text-XS">
              {{ slotProps.data.patient.address.fullAddress }}
            </div>
            <div class="flex flex-wrap">
              <!-- <PhUserCirclePlus
                v-if="slotProps.data.new_patient"
                :size="22"
                class="text-opensimrs-300 mt-auto mr-[5px]"
                weight="fill"
              /> -->
              <CustomChip
                :showCheckedIcon="false"
                :label="
                  ['Female', 'Perempuan'].includes(slotProps.data.patient.gender)
                    ? 'Perempuan'
                    : 'Laki-laki'
                "
                :bgColor="
                  ['Female', 'Perempuan'].includes(slotProps.data.patient.gender)
                    ? 'bg-female-75'
                    : 'bg-male-75'
                "
                :textColor="
                  ['Female', 'Perempuan'].includes(slotProps.data.patient.gender)
                    ? 'text-female-300'
                    : 'text-male-300'
                "
                customClass="h-5 border-none mr-[5px]"
              />
              <CustomChip
                :showCheckedIcon="false"
                :label="slotProps.data.patient.phone ?? '-'"
                bgColor="bg-opensimrs-50"
                textColor="text-opensimrs-300"
                customClass="h-5 border-none mr-[5px]"
              />
            </div>
          </template>
        </Column>
        <Column
          field="keperawatan"
          header="Keperawatan"
          headerClass="bg-opensimrs-50"
        >
          <template #body="slotProps">
            <div class="flex mb-[5px] text-SM">
              <div>
                {{ slotProps.data.practitioner.title }}
                {{ slotProps.data.practitioner.nama }}
              </div>
            </div>
            <div class="flex flex-wrap">
              <CustomChip
                :showCheckedIcon="false"
                :label="
                  slotProps.data.withoutIdentity
                    ? 'DATA TIDAK TIDAK LENGKAP'
                    : 'DATA LENGKAP'
                "
                customClass="h-5 mr-[5px]"
              />
              <CustomChip
                :showCheckedIcon="false"
                :label="
                  slotProps.data.paymentMethod == 1 ? 'TUNAI' : 'ASURANSI'
                "
                :bgColor="
                  slotProps.data.paymentMethod == 1
                    ? 'bg-opensimrs-50'
                    : 'bg-warning-50'
                "
                :textColor="
                  slotProps.data.paymentMethod == 1
                    ? 'text-opensimrs-300'
                    : 'text-warning-300'
                "
                :borderColor="
                  slotProps.data.paymentMethod == 1
                    ? 'border-opensimrs-300'
                    : 'border-warning-300'
                "
                customClass="h-5 mr-[5px]"
              />
            </div>
          </template>
        </Column>
        <Column
          field="data-kunjungan"
          header="Data Kunjungan"
          headerClass="bg-opensimrs-50"
          style="width: 25%"
        >
          <template #body="slotProps">
            <div class="text-SM">
              <div
                class="grid content-center grid-cols-[80px_min-content_150px] auto-cols-min"
              >
                Daftar
                <ArrowRightBrokenIcon
                  :size="18"
                  class="my-auto mr-5 text-grey-300"
                  weight="bold"
                />
                {{ epochToDate(slotProps.data.tanggalDaftar, "dateTime") }}
              </div>
              <div
                class="grid content-center grid-cols-[80px_min-content_150px] mt-[5px]"
              >
                Discharge
                <ArrowRightBrokenIcon
                  :size="18"
                  class="my-auto mr-5 text-male-300"
                  weight="bold"
                />
                {{ slotProps.data.dischargeDate ? epochToDate(slotProps.data.dischargeDate, "dateTime") : "-" }}
              </div>
            </div>
          </template>
        </Column>
        <Column
          field="status"
          header="Status"
          headerClass="bg-opensimrs-50"
          class="w-[114px]"
        >
          <template #body="slotProps">
            <div>
              <CustomChip
                :showCheckedIcon="false"
                :label="
                  slotProps.data.statusIgd == 0
                    ? 'DIBATALKAN'
                    : slotProps.data.statusIgd == 1
                    ? 'DIRAWAT'
                    : 'DISCHARGE'
                "
                customClass="h-5 mr-[5px] border-none"
                :bgColor="
                  slotProps.data.statusIgd == 0
                    ? 'bg-danger-300'
                    : slotProps.data.statusIgd == 1
                    ? 'bg-blueJeans-300'
                    : 'bg-opensimrs-300'
                "
                :textColor="'text-white'"
              />
            </div>
            <div>
              <CustomChip
                :showCheckedIcon="false"
                :label="slotProps.data.serviceBill?.status ? 'Lunas' : 'Belum Lunas'"
                customClass="h-5 mr-[5px] border-none whitespace-nowrap"
                :bgColor="
                  slotProps.data.serviceBill?.status
                    ? 'bg-success-75'
                    : 'bg-grey-100'
                "
                :textColor="
                  slotProps.data.serviceBill?.status
                    ? 'text-success-300'
                    : 'text-grey-400'
                "
              />
            </div>
          </template>
        </Column>
        <Column
          v-if="showCancelVisit"
          selectionMode="multiple"
          headerStyle="width: 3rem"
          headerClass="bg-opensimrs-50"
          class="custom-checkbox"
        ></Column>
      </DataTable>
      <NoData v-else />
      <MedicalRecord
        ref="medicalRecord"
        rmType="igd"
        :patientData="openedPatientData"
        :viewMode="viewModeRM"
        @openHistory="handleOpenHistory"
        @refreshPatientData="handleRefreshPatientData"
      />
    </template>
    <template #footer>
      <FooterPagination
        cancleButton
        :rows="properties.page_size"
        :totalRecords="properties.total"
        @page="handlePage"
        :show-cancel-visit="showCancelVisit"
        @toggle-cancel-visit="toggleCancelVisit"
        @confirm-cancel="confirmCancel"
        @update:cancleReason="handleCancleReason"
        :cancleSelected="selectedPatient"
        @update:cancleSelected="selectedPatient = $event"
      />
    </template>
  </Card>
</template>
