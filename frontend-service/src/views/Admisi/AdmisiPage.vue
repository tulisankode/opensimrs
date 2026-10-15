<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { onBeforeRouteLeave, useRoute } from "vue-router";
import type { MenuItem } from "primevue/menuitem";
import { utilsStore } from "@/stores/utils";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import HeaderFilter from "./Layout/HeaderFilter.vue";
import RegisterForm from "./Layout/RegisterForm.vue";
import NoData from "@/components/section/NoData.vue";
import type { DataTableRowClickEvent } from "primevue/datatable";
import { dateToEpoch, epochToDate, setTimeForDate } from "@/utils/Helpers";
import { useAdmisiRJStore } from "@/stores/admisi/rawatJalan";
import { useAdmisiRIStore } from "@/stores/admisi/rawatInap";
import { useAdmisiIGDStore } from "@/stores/admisi/igd";
import type { FilterAdmisi } from "@/utils/Interface";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";

// NOTE Store
const storeUtils = utilsStore();
const admisiRJStore = useAdmisiRJStore();
const admisiRIStore = useAdmisiRIStore();
const admisiIGDStore = useAdmisiIGDStore();

const pageType = ref("");
const route = useRoute();

const headerFilterRef = ref<typeof HeaderFilter>();
const resetFilter = () => {
  headerFilterRef.value?.resetFilter();
  filterData.value = headerFilterRef.value?.searchData() ?? {
    startDate: dateToEpoch(setTimeForDate(new Date(), 0, 0, 0)),
    endDate: dateToEpoch(setTimeForDate(new Date(), 23, 59, 59)),
    dpjp: ''
  };
};

const dataBreadCrumb = ref<MenuItem[]>([]);

const changeSection = (label: string, data: any = null) => {
  let tempData = { label: label };
  if (data) {
    tempData = { ...tempData, ...data };
  }
  if (dataBreadCrumb.value.length) {
    dataBreadCrumb.value[0] = tempData;
  } else {
    dataBreadCrumb.value.push(tempData);
  }
};

const patientData = ref<any>([]);
const patientDataRI = ref<any>([]);
const patientDataIGD = ref<any>([]);
const properties = ref({
  page: 1,
  pageSize: 10,
  total: 0,
});

const filterData = ref<FilterAdmisi>({});
const search = async () => {
  filterData.value = headerFilterRef.value?.searchData();
  if (pageType.value == "rawat-jalan") {
    patientData.value = await fetchRJPatient();
  } else if (pageType.value == "rawat-inap") {
    patientDataRI.value = await fetchRIPatient();
  } else if (pageType.value == "igd") {
    patientDataIGD.value = await fetchIGDPatient();
  }
};

const getPatientList = async () => {
  if (pageType.value == "rawat-jalan") {
    patientData.value = await fetchRJPatient();
  } else if (pageType.value == "rawat-inap") {
    patientDataRI.value = await fetchRIPatient();
  } else if (pageType.value == "igd") {
    patientDataIGD.value = await fetchIGDPatient();
  }
};
const fetchRJPatient = async () => {
  storeUtils.setLoading(true);
  try {
    const response = await admisiRJStore.getRJ({
      ...filterData.value,
      page: properties.value.page,
      limit: properties.value.pageSize,
    });
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

const fetchRIPatient = async () => {
  storeUtils.setLoading(true);
  try {
    const response = await admisiRIStore.getRI({
      ...filterData.value,
      page: properties.value.page,
      limit: properties.value.pageSize,
    });
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

const fetchIGDPatient = async () => {
  storeUtils.setLoading(true);
  try {
    const response = await admisiIGDStore.getIGD({
      ...filterData.value,
      page: properties.value.page,
      limit: properties.value.pageSize,
    });
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

const updatePageType = async (path: string) => {
  resetFilter();
  dataBreadCrumb.value = [];
  let tempArrPath = path.split("/");
  pageType.value = tempArrPath[2] ?? "";

  await getPatientList();
};

onBeforeRouteLeave((to, from) => {
  updatePageType(to.path);
});
onMounted(() => {
  updatePageType(route.path);

  if (storeUtils.selectedRoom) {
    changeSection("Daftar");
  }
});

const openedPatientData = ref<any>({});
const selectedPaymentMethod = ref<string>('TUNAI');
const showPatientDetail = (event: DataTableRowClickEvent) => {
  openedPatientData.value = event.data;

  if (openedPatientData.value.payment_method == 2) {
    selectedPaymentMethod.value = "ASURANSI"; 
  } else {
    selectedPaymentMethod.value = "TUNAI";
  }

  if (pageType.value == "rawat-jalan") {
    if (openedPatientData.value.statusRj == "1") {
      formType.value = "add";
      changeSection("Checkin", { platform: openedPatientData.value.platform });
    } else {
      formType.value = "detail";
      changeSection("Detail");
    }
  } else if (pageType.value == "rawat-inap") {
    if (
      openedPatientData.value.statusRi == "1" ||
      openedPatientData.value.statusRi == "2"
    ) {
      formType.value = "add";
      changeSection("Daftar");
    } else {
      formType.value = "detail";
      changeSection("Detail");
    }
  } else if (pageType.value == "igd") {
    if (
      openedPatientData.value.statusRi == "1"
    ) {
      formType.value = "add";
      changeSection("Daftar");
    } else {
      formType.value = "detail";
      changeSection("Detail");
    }
  }
};

const getDataTable = (type: "data" | "length" = "data") => {
  let tempPatient = [];
  if (pageType.value == "rawat-jalan") {
    tempPatient = showCancelVisit.value
      ? patientData.value.filter(
          (patient: any) => patient.statusRj != 4 && patient.statusRj != 5
        )
      : patientData.value;
  } else if (pageType.value == "rawat-inap") {
    tempPatient = showCancelVisit.value
      ? patientDataRI.value.filter(
          (patient: any) => patient.statusRi != 3 && patient.statusRi != 4
        )
      : patientDataRI.value;
  } else if (pageType.value == "igd") {
    tempPatient = showCancelVisit.value
      ? patientDataIGD.value.filter((patient: any) => patient.statusRi != 2)
      : patientDataIGD.value;
  }

  return tempPatient;
};

const formType = ref<"add" | "edit" | "detail">("add");
const closeRegistrationForm = () => {
  dataBreadCrumb.value.pop();
  openedPatientData.value = {};
  getPatientList();
};

const selectedPatient = ref<any[]>([]);

const showCancelVisit = ref(false);
const cancelReason = ref<string>();
const cancelVisit = async () => {
  try {
    storeUtils.setLoading(true);
    let payload = {
      listUuid: [] as any[],
      cancelReason: cancelReason.value,
    };
    selectedPatient.value.forEach((patientData: any) => {
      payload.listUuid.push(patientData.uuid);
    });
    if (pageType.value == "rawat-jalan") {
      await admisiRJStore.cancelVisitRJ(payload);
    } else if (pageType.value == "rawat-inap") {
      await admisiRIStore.cancelVisitRI(payload);
    } else if (pageType.value == "igd") {
      await admisiIGDStore.cancelVisitIGD(payload);
    }
    showCancelVisit.value = false;
    cancelReason.value = '';
    selectedPatient.value = [];
    
    await getPatientList();
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

watch(formType, (newValue, oldValue) => {
  if (newValue === 'edit' && oldValue !== 'edit') {
  }
});

const handleGoToDetail = (newData: any) => {
  openedPatientData.value = newData;

  dataBreadCrumb.value[0].label = 'Detail';
  formType.value = 'detail';
};

const handlePage = (event: any) => {
  properties.value.page = event.page + 1;
  properties.value.pageSize = event.rows;
  getPatientList();
};

</script>

<template>
  <Card
    v-if="dataBreadCrumb.length == 0"
    :key="route.fullPath"
    pt:body:class="h-full pt-0 overflow-auto"
    pt:content:class="h-full overflow-auto"
    class=""
  >
    <template #header>
      <HeaderFilter
        ref="headerFilterRef"
        :pageType="pageType"
        :filterData="filterData"
        @daftar="changeSection('Daftar'), (formType = 'add')"
        @daftarBayi="changeSection('Daftar Bayi Baru Lahir'), (formType = 'add')"
        @search="search"
      />
    </template>
    <template #content>
      <DataTable
        v-if="getDataTable().length"
        :key="route.fullPath"
        v-model:selection="selectedPatient"
        :value="getDataTable()"
        tableStyle="min-width: 50rem"
        stripedRows
        scrollable
        scrollHeight="flex"
        :pt="{ headerRow: 'text-SM' }"
        @rowClick="showPatientDetail"
      >
        <Column field="nomor" headerClass="bg-opensimrs-50">
          <template #header>
            <div class="w-full font-semibold text-center">Nomor</div>
          </template>
          <template #body="slotProps">
            <div class="text-center">
              <div
                v-if="
                  slotProps.data.noAntrianAdmisi && pageType == 'rawat-jalan'
                "
                class="w-min mx-auto bg-opensimrs-75 text-opensimrs-300 rounded-[5px] px-2 leading-5 text-SM font-semibold px-"
              >
                {{ slotProps.data.noAntrianAdmisi ?? " " }}
              </div>
              <div class="text-SM">{{ slotProps.data.noRm ?? "-" }}</div>
              <div class="text-SM">{{ slotProps.data.noReg }}</div>
              <div class="text-SM">{{ slotProps.data.noPelayanan }}</div>
            </div>
          </template>
        </Column>
        <Column field="patient" header="Pasien" headerClass="bg-opensimrs-50">
          <template #body="slotProps">
            <div class="text-SM">
              <span class="font-semibold">{{
                slotProps.data?.patient?.name
              }}</span>
              <span class="text-grey-300">
                ({{ slotProps.data?.birthDetail?.ageYear }}Th
                {{ slotProps.data?.birthDetail?.ageMonth }}Bln
                {{ slotProps.data?.birthDetail?.ageDay }}Hr)
              </span>
            </div>
            <div class="text-XS">
              {{ slotProps.data?.patient?.address?.fullAddress }}
            </div>
            <div class="flex flex-wrap">
              <!-- <PhUserCirclePlus
                v-if="slotProps.data.new_patient"
                :size="22"
                class="text-opensimrs-300 mt-auto mr-[5px]"
                weight="fill"
              /> -->
              <CustomChip
                v-if="
                  pageType == 'rawat-jalan' &&
                  slotProps.data?.platform != 'ADMISI' &&
                  slotProps.data?.platform
                "
                :showCheckedIcon="false"
                :label="slotProps.data?.platform"
                bgColor="bg-opensimrs-300"
                textColor="text-white"
                customClass="h-5 pr-[6px] border-none mr-[5px]"
              />
              <CustomChip
                :showCheckedIcon="false"
                :label="
                  slotProps.data?.patient?.gender == 'Female'
                    ? 'Perempuan'
                    : 'Laki-laki'
                "
                :bgColor="
                  slotProps.data?.patient?.gender == 'Female'
                    ? 'bg-female-75'
                    : 'bg-male-75'
                "
                :textColor="
                  slotProps.data?.patient?.gender == 'Female'
                    ? 'text-female-300'
                    : 'text-male-300'
                "
                customClass="h-5 pr-[9px] border-none mr-[5px]"
              />
              <CustomChip
                :showCheckedIcon="false"
                :label="slotProps.data?.patient?.phone ?? '-'"
                bgColor="bg-opensimrs-75"
                textColor="text-opensimrs-300"
                customClass="h-5 pr-[8px] border-none mr-[5px]"
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
              <div
                v-if="pageType == 'rawat-jalan'"
                class="border border-opensimrs-300 mx-[5px] my-1"
              ></div>
              <div v-if="pageType == 'rawat-jalan'">
                {{ slotProps.data.schedule.startTime }} -
                {{ slotProps.data.schedule.endTime }}
              </div>
            </div>
            <div class="flex flex-wrap">
              <CustomChip
                  v-if="pageType != 'igd' && slotProps.data.monitoringRoom?.room"
                  :showCheckedIcon="false"
                  :label="
                    pageType == 'rawat-jalan'
                      ? slotProps.data.monitoringRoom.room.className
                      : slotProps.data.monitoringRoom.room.name
                  "
                  customClass="h-5 pr-[7px] mr-[5px]"
                />
              <CustomChip
                v-else
                :showCheckedIcon="false"
                :label="
                  slotProps.data.withoutIdentity
                    ? 'DATA TIDAK TIDAK LENGKAP'
                    : 'DATA LENGKAP'
                "
                customClass="h-5 pr-[7px] mr-[5px]"
              />
               <CustomChip
                v-if="slotProps.data.polyclinic"
                :showCheckedIcon="false"
                :label="`${slotProps.data.polyclinic.name}`"
                customClass="h-5 pr-[7px] mr-[5px]"
              />
              <CustomChip
                v-if="pageType == 'rawat-inap'"
                :showCheckedIcon="false"
                :label="`${slotProps.data.monitoringRoom?.bedLokasi?.name}`"
                customClass="h-5 pr-[7px] mr-[5px]"
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
                customClass="h-5 pr-[9px] mr-[5px]"
              />
              <!-- NOTE Belum Ada BPJS -->
              <CustomChip
                v-if="slotProps.data.no_SEP"
                :showCheckedIcon="false"
                :label="`SEP.${slotProps.data.no_SEP}`"
                bgColor="bg-warning-50"
                textColor="text-warning-300"
                borderColor="border-warning-300"
                customClass="h-5 pr-[6px]"
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
                v-if="pageType == 'rawat-jalan'"
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
              <!-- <div
                v-if="pageType == 'rawat-jalan'"
                class="grid content-center grid-cols-[80px_min-content_150px] mt-[5px]"
              >
                Diperiksa
                <ArrowRightBrokenIcon
                  :size="18"
                  class="my-auto mr-5 text-male-300"
                  weight="bold"
                />
                {{ epochToDate(slotProps.data.jadwalPeriksa, "dateTime") }}
              </div> -->
              <div
                v-if="
                  pageType == 'rawat-jalan' && slotProps.data.tanggalCheckin
                "
                class="grid content-center grid-cols-[80px_min-content_150px] mt-[5px]"
              >
                Checkin
                <ArrowRightBrokenIcon
                  :size="18"
                  class="my-auto mr-5 text-mint-300"
                  weight="bold"
                />
                {{ epochToDate(slotProps.data.tanggalCheckin, "dateTime") }}
              </div>
              <div
                v-if="pageType == 'rawat-inap'"
                class="grid content-center grid-cols-[80px_min-content_150px] auto-cols-min"
              >
                SPRI
                <ArrowRightBrokenIcon
                  :size="18"
                  class="my-auto mr-5 text-grey-300"
                  weight="bold"
                />
                {{ slotProps.data.noSpri ?? "-" }}
              </div>
              <div
                v-if="pageType == 'rawat-inap' && slotProps.data.tanggalDirawat"
                class="grid content-center grid-cols-[80px_min-content_150px] mt-[5px]"
              >
                Dirawat
                <ArrowRightBrokenIcon
                  :size="18"
                  class="my-auto mr-5 text-info-300"
                  weight="bold"
                />
                {{ epochToDate(slotProps.data.tanggalDirawat, "dateTime") }}
              </div>
              <div
                v-if="pageType == 'igd'"
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
                v-if="pageType == 'igd' && slotProps.data.tanggalDirawat"
                class="grid content-center grid-cols-[80px_min-content_150px] mt-[5px]"
              >
                Dirawat
                <ArrowRightBrokenIcon
                  :size="18"
                  class="my-auto mr-5 text-info-300"
                  weight="bold"
                />
                {{ epochToDate(slotProps.data.tanggalDirawat, "dateTime") }}
              </div>
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
    </template>
    <template #footer>
      <div class="flex justify-between">
        <div class="flex">
          <CustomButton
            v-if="!showCancelVisit"
            @click="showCancelVisit = true"
            class="my-auto bg-danger-300"
            :label="`Batal ${
              pageType == 'igd'
                ? 'IGD'
                : pageType == 'rawat-inap'
                ? 'Rawat Inap'
                : 'Rawat Jalan'
            }`"
          />
          <CustomButton
            v-if="showCancelVisit"
            @click="showCancelVisit = false"
            class="my-auto mr-[10px]"
            label="Batal"
            outlined
            borderColor="border-grey-200"
            textColor="text-grey-300"
          />
          <CustomButton
            v-if="showCancelVisit"
            @click="cancelVisit"
            class="my-auto mr-5 bg-danger-300"
            label="Iya, Batalkan"
            :disabled="!cancelReason || selectedPatient.length == 0"
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
          :rows="properties.pageSize"
          :totalRecords="properties.total"
          :rowsPerPageOptions="[10,20,30,40,50]"
          @page="handlePage"
        />
      </div>
    </template>
  </Card>
  <RegisterForm
    v-else-if="
      dataBreadCrumb[0].label == 'Checkin' ||
      dataBreadCrumb[0].label == 'Daftar' ||
      dataBreadCrumb[0].label == 'Daftar Bayi Baru Lahir' ||
      dataBreadCrumb[0].label == 'Detail' ||
      dataBreadCrumb[0].label == 'Detail Edit'
    "
    :dataBreadCrumb="dataBreadCrumb"
    :pageType="pageType"
    :patientData="openedPatientData"
    :formType="formType"
    @back="closeRegistrationForm"
    @goToDetail="handleGoToDetail"
    @goToEdit="(dataBreadCrumb[0].label = 'Detail Edit'), (formType = 'edit')"
  />
</template>

<style>
/* TailwindCSS styles */
.custom-checkbox .p-checkbox-checked .p-checkbox-box {
  @apply border-danger-300 bg-danger-300; /* Kelas Tailwind untuk border dan warna latar */
}

.custom-checkbox .p-checkbox-checked .p-checkbox-box .p-checkbox-icon {
  @apply text-white; /* Kelas Tailwind untuk warna tanda centang */
}
</style>
