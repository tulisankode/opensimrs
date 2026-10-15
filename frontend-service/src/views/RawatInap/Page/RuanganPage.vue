<script setup lang="ts">
import { onBeforeMount, onMounted, ref, watch } from "vue";
import { onBeforeRouteLeave, useRoute } from "vue-router";
import DataPoliBPJSHeader from "../Layout/Header/DataPoliBPJSHeader.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import type { FilterAdmisi } from "@/utils/Interface";
import { dateToEpoch, epochToDate, formatDate, setTimeForDate } from "@/utils/Helpers";
import { utilsStore } from "@/stores/utils";
import { useAdmisiRIStore } from "@/stores/admisi/rawatInap";
import DataPelayananRawatJalan from "@/views/RawatJalan/Layout/Tabel/Poli/DataPelayananRawatJalan.vue";
import NoData from "@/components/section/NoData.vue";
import DataPasienRawatInap from "../Layout/Tabel/Ruangan/DataPasienRawatInap.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import { useToast } from "primevue/usetoast";
import MedicalRecord from "@/views/MedicalRecord/MedicalRecord.vue";

// STORE
const storeUtils = utilsStore();
const toast = useToast();
const admisiRIStore = useAdmisiRIStore();
const rekamMedisStore = useRekamMedisStore();
// ROUTE
const route = useRoute();
const currentRouteName = ref("");

const properties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

const props = defineProps<{
  filterRuangan: Filter;
}>();

interface Filter {
  name: string;
  uuid: string;
}

const isDataFetched = ref(false);

const patientData = ref<any[]>([]);
const selectedPatient = ref<any[]>([]);
const selectedTab = ref("2");

const showCancelVisit = ref(false);
const cancelReason = ref<string>();

const searchQuery = ref("");
const dokter = ref("");
const startDateFilter = ref<Date>(new Date());
const endDateFilter = ref<Date>(new Date());
const selectedFilterPayment = ref<string[]>([]);
const medicalRecord = ref<any>();
const openedPatientData = ref<any>({});

const handleSelectedTab = (newTab: string) => {
  selectedTab.value = newTab;
  reloadData();
};
const handleSearchQuery = (value: string) => {
  searchQuery.value = value;
};
const handleDokter = (value: string) => {
  dokter.value = value;
};
const handleStartDate = (value: any) => {
  startDateFilter.value = value;
};
const handleEndDate = (value: any) => {
  endDateFilter.value = value;
};
const handleReset = () => {
  resetFilter();
  reloadData();
};
const handleChipPayment = (filters: string[]) => {
  selectedFilterPayment.value = filters;
  reloadData();
};

const filterData = ref<FilterAdmisi>({});

const handleRefreshPatientData = async () => {
  if (!openedPatientData.value?.uuid) {
    return;
  }
  setTimeout(async () => {
    try {
      const response = await admisiRIStore.getDetailRI(openedPatientData.value.uuid);  
      if (response && response.payload) {
        const currentRmUuid = openedPatientData.value.rekamMedisUuid;
        openedPatientData.value = {
          ...response.payload,
          rekamMedisUuid: currentRmUuid
        };
      }
    } catch (error) {
      console.error("❌ Gagal refresh data pasien RI:", error);
    }
  }, 200);
};

const openDialogRM = async (event: any) => {
  try {
    storeUtils.setLoading(true);
    const responseDetailPelayanan = await admisiRIStore.getDetailRI(
      event.data.uuid
    );

    if (!responseDetailPelayanan || !responseDetailPelayanan.payload) {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "Gagal mendapatkan detail data pelayanan.",
        life: 3000,
      });
      return;
    }

    openedPatientData.value = responseDetailPelayanan.payload;
    openedPatientData.value.rekamMedisUuid = event.data.rekamMedisUuid;

    let responseRekamMedis: any;
    const rekamMedisUuid = openedPatientData.value.rekamMedisUuid;

    if (rekamMedisUuid) {
      responseRekamMedis = await rekamMedisStore.getRekamMedis({
        rekamMedisUuid: rekamMedisUuid,
      });
    } else {
      const dataPasien = openedPatientData.value;
      const lokasiUuid = dataPasien?.monitoringRoom?.room?.uuid;

      if (!lokasiUuid) {
        toast.add({
          severity: "error",
          summary: "Error",
          detail: "Data lokasi ruangan tidak ditemukan pada pasien ini.",
          life: 3000,
        });
        return;
      }

      responseRekamMedis = await rekamMedisStore.createRekamMedis({
        noRm: dataPasien?.patient?.noRm,
        noReg: dataPasien.noReg,
        date: formatDate(new Date(), true),
        pelayanan: "ri",
        lokasiUuid: lokasiUuid,
        noPelayanan: dataPasien.noPelayanan,
        paymentMethod: dataPasien.paymentMethod,
      });
    }

    if (responseRekamMedis && responseRekamMedis.payload) {
      openedPatientData.value.rekamMedisUuid =
        responseRekamMedis.payload.meta.rekamMedisUuid;
      
      rekamMedisStore.setOpenedRekamMedisData(responseRekamMedis.payload);
      
      medicalRecord.value?.showDialogRM();
    } else {
       toast.add({
        severity: "error",
        summary: "Error",
        detail: "Gagal memproses data rekam medis pasien.",
        life: 3000,
      });
    }

  } catch (error) {
    console.error("Gagal membuka rekam medis:", error);
    toast.add({
        severity: "error",
        summary: "Error",
        detail: "Terjadi kesalahan saat memuat rekam medis.",
        life: 3000,
      });
  } finally {
    storeUtils.setLoading(false);
  }
};

const fetchRIPatient = async (filter: FilterAdmisi = {}) => {
  storeUtils.setLoading(true);
  let response;
  try {
    if (currentRouteName.value === "ruangan") {
      response = await admisiRIStore.getRI(filter);
      properties.value.total = response.properties.totalData;
      
      return response.payload;
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    return [];
  } finally {
    storeUtils.setLoading(false);
    isDataFetched.value = true;
  }
};

const reloadData = async () => {
  let filter = {} as FilterAdmisi;
  filter = setFilter();
  patientData.value = await fetchRIPatient(filter);
};

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
  filter.startDate = `${dateToEpoch(
    setTimeForDate(startDateFilter.value, 0, 0, 0)
  )}`;
  filter.endDate = `${dateToEpoch(
    setTimeForDate(endDateFilter.value, 23, 59, 59)
  )}`;
  filter.status = selectedTab.value;

  filter.room = [props.filterRuangan.name === "Semua Ruangan" ? props.filterRuangan.uuid : props.filterRuangan.name];
  filter.dpjp = dokter.value;

  return filter;
};

const resetFormRef = ref();

const resetFilter = () => {
  searchQuery.value = "";
  selectedFilterPayment.value = [];
  startDateFilter.value = new Date();
  endDateFilter.value = new Date();
  resetFormRef.value.resetForm();
  dokter.value = "";
  selectedFilterPayment.value = [];
  selectedTab.value = "2";
};

const handlePage = (event: any) => {
  properties.value.page = event.page + 1;
  properties.value.page_size = event.rows;
  reloadData();
};


watch(
  () => props.filterRuangan,
  async (newFilter) => {
    //  console.log(`Filter anyar`, newFilter);
    // resetFilter();
    reloadData();
    // filterData.value = {
    //   ...filterData.value,
    //   startDate: `${dateToEpoch(
    //     setTimeForDate(startDateFilter.value, 0, 0, 0)
    //   )}`,
    //   endDate: `${dateToEpoch(
    //     setTimeForDate(endDateFilter.value, 23, 59, 59)
    //   )}`,
    //   room: [newFilter.name],
    // }
    // // console.log(`filter paling baru`, filterData.value);
    // patientData.value = await fetchRIPatient(filterData.value);
  },
  { immediate: false }
);

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
    console.log("payload cancle visit",payload)
    const response = await admisiRIStore.cancelVisitRI(payload);
    console.log("response data",response)
    showCancelVisit.value = false;
    cancelReason.value = undefined;
    await reloadData();
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    storeUtils.setLoading(false);
  }
};


const updatePageType = async (path: string) => {
  resetFilter();
  const tempArrPath = path.split("/");
  currentRouteName.value = tempArrPath[2] ?? "";

  let filter = {} as FilterAdmisi;
  filter = setFilter();
  patientData.value = await fetchRIPatient(filter);
};

onBeforeRouteLeave((to, from) => {
  console.log("Navigating from:", from.path, "to:", to.path);
  updatePageType(to.path);
});

onMounted(() => {
  updatePageType(route.path);
});

</script>
<template>
  <!-- {{ patientData }} -->
  <Card
    pt:body:class="h-full pt-0 overflow-auto"
    pt:content:class="h-full overflow-auto"
    class=""
  >
    <template #header>
      <DataPoliBPJSHeader
        ref="resetFormRef"
        @selected-tab="handleSelectedTab"
        @update:value-search="handleSearchQuery"
        @update:value-dokter="handleDokter"
        @update:valueStartDate="handleStartDate"
        @update:value-end-date="handleEndDate"
        @search="reloadData()"
        @reset="handleReset()"
        @payment="handleChipPayment"
        @reloadData="reloadData()"
        :filter-menu="filterRuangan"
        :filter-data="filterData"
        :current-route-name="currentRouteName"
        :active-status="selectedTab"
      >
      </DataPoliBPJSHeader>
    </template>
    <template #content>
      <DataTable
       v-if="patientData && patientData.length > 0"
        v-model:selection="selectedPatient"
        :value="patientData"
         tableStyle="min-width: 50rem"
        scrollable
        scrollHeight="flex"
        :pt="{ headerRow: 'text-SM' }"
        @row-click="openDialogRM($event)"
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
                  slotProps.data.patient.gender == 'Female'
                    ? 'Perempuan'
                    : 'Laki-laki'
                "
                :bgColor="
                  slotProps.data.patient.gender == 'Female'
                    ? 'bg-female-75'
                    : 'bg-male-75'
                "
                :textColor="
                  slotProps.data.patient.gender == 'Female'
                    ? 'text-female-300'
                    : 'text-male-300'
                "
                customClass="h-5 pr-[6px] border-none mr-[5px]"
              />
              <CustomChip
                :showCheckedIcon="false"
                :label="slotProps.data.patient.noIdentity ?? '-'"
                bgColor="bg-opensimrs-50"
                textColor="text-opensimrs-300"
                customClass="h-5 pr-[6px] border-none mr-[5px]"
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
                  slotProps.data.monitoringRoom?.room?.name
                    ? slotProps.data.monitoringRoom?.room?.name
                    : 'RUANGAN'
                "
                customClass="h-5 pr-[5px] mr-[5px]"
              />
              <CustomChip
                :showCheckedIcon="false"
                :label="
                  slotProps.data.monitoringRoom?.bedLokasi.name
                    ? slotProps.data.monitoringRoom?.bedLokasi.name
                    : '-'
                "
                customClass="h-5 pr-[5px] mr-[5px]"
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
                customClass="h-5 pr-[6px] mr-[5px]"
              />
            </div>
          </template>
        </Column>
          <Column
      field="data-kunjungan"
      header="Data Kunjungan"
      headerClass="bg-opensimrs-50"
    >
      <template #body="slotProps">
        <div class="text-SM">
          <div
            class="flex content-center auto-cols-min"
          >
            SPRI
            <ArrowRightBrokenIcon
              :size="18"
              class="mx-[5px] my-auto text-grey-300"
            />
            {{ slotProps.data.dischargeDate ? epochToDate(slotProps.data.dischargeDate, "dateTime") : "-" }}
          </div>
          <div
            class="flex content-center mt-[5px]"
          >
            Dirawat
            <ArrowRightBrokenIcon
              :size="18"
              class="mx-[5px] my-auto text-blueJeans-300"
            />
           {{ slotProps.data.tanggalDirawat ? epochToDate(slotProps.data.tanggalDirawat, 'dateTime') : '-' }}

          </div>
          <div
            class="flex content-center mt-[5px]"
          >
            Lama Dirawat
            <ArrowRightBrokenIcon
              :size="18"
              class="mx-[5px] my-auto text-blueJeans-300"
            />
            {{ slotProps.data.lamaDirawat || '-' }}
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
                :label="slotProps.data.statusRi == 0
                    ? 'DIBATALKAN'
                    : slotProps.data.statusRi == 1
                      ? 'WAITING'
                      : slotProps.data.statusRi == 2
                      ? 'TRANSFER'
                      : slotProps.data.statusRi == 3 ? 'DIRAWAT' : 'DISCHARGE'
                "
                customClass="h-5 pr-[8px] mr-[5px] border-none"
                :bgColor="
                  slotProps.data.statusRi == 0
                    ? 'bg-danger-300'
                    : slotProps.data.statusRi == 1
                      ? 'bg-warning-300'
                      : slotProps.data.statusRi == 2 ?
                        'bg-blue-300' : slotProps.data.statusRi == 3 ? 'bg-blueJeans-300' : 'bg-mint-300'
                "
                :textColor="'text-white'"
              />
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
        rmType="rawat-inap" 
        :patientData="openedPatientData"
        @refreshPatientData="handleRefreshPatientData"
      />
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
            class="my-auto mr-[10px]"
            label="Batal"
            @click="showCancelVisit = false"
            outlined
            borderColor="border-grey-200"
            textColor="text-grey-300"
          />
          <CustomButton
            v-if="showCancelVisit"
            class="my-auto mr-5 bg-danger-300"
            label="Iya, Batalkan"
             :disabled="!cancelReason || selectedPatient.length === 0"
             @click="confirmCancel"
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
