<script setup lang="ts">
import { onMounted, computed, ref, type PropType } from "vue";
import { onBeforeRouteLeave, useRoute } from "vue-router";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import type { DataTableRowClickEvent } from "primevue/datatable";
import type { MenuItem } from "primevue/menuitem";
import NoData from "@/components/section/NoData.vue";
import DetailHasilPemeriksaanPage from "./DetailHasilPemeriksaanPage.vue";
import { useHasilPemeriksaanLab } from "@/stores/Laboratorium/hasilPemeriksaan";
import { utilsStore } from "@/stores/utils";
import { cetakHasilLabOrder } from "@/utils/pdf/pdfLaboratorium/cetakHasilLabOrder";
import {
  epochToDate,
  dateToEpoch,
  formatPrice,
  setTimeForDate,
} from "@/utils/Helpers";

const startDateFilter = ref<Date>(new Date());
const endDateFilter = ref<Date>(new Date());
const pageType = ref("");
const useHasilPemeriksaanLabStore = useHasilPemeriksaanLab();
const stores = utilsStore();
const hasilPemeriksaanProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});
const hasilPemeriksaanPayload = ref<any[]>([]);
const searchQuery = ref<string>("");
const selectedOrderType = ref<string>("Periksa");
const selectedPatient = ref([]);

const onSelectOrderType = (label: string) => {
  selectedOrderType.value = label;
  fetchHasilPemeriksaan();
};

const selectedPaymentMethod = ref<string[]>([]);

const onPaymentMethodSelect = (label: string) => {
  if (selectedPaymentMethod.value.includes(label)) {
    selectedPaymentMethod.value = selectedPaymentMethod.value.filter(
      (item) => item != label
    );
  } else {
    selectedPaymentMethod.value.push(label);
  }
  fetchHasilPemeriksaan();
};

const fetchHasilPemeriksaan = async () => {
  stores.setLoading(true);
  try {
    const params: any = {
      page: hasilPemeriksaanProperties.value.page,
      limit: hasilPemeriksaanProperties.value.page_size,
      search: searchQuery.value,
      startDate: dateToEpoch(setTimeForDate(startDateFilter.value, 0, 0, 0)),
      endDate: dateToEpoch(setTimeForDate(endDateFilter.value, 23, 59, 59)),
    };

    if (selectedOrderType.value === "Periksa") {
      params.orderStatus = 2;
    } else if (selectedOrderType.value === "Selesai") {
      params.orderStatus = 3;
    }

    if (selectedPaymentMethod.value !== null) {
      if (
        selectedPaymentMethod.value.includes("1") &&
        selectedPaymentMethod.value.includes("2")
      ) {
        params.paymentMethod = [];
      } else {
        params.paymentMethod = selectedPaymentMethod.value;
      }
    }

    const response = await useHasilPemeriksaanLabStore.getApi(params);
    if (response && response.payload) {
      hasilPemeriksaanProperties.value.total =
        response.payload.pagination.total;
      hasilPemeriksaanPayload.value = response.payload.data;
    } else {
      hasilPemeriksaanPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    return [];
  } finally {
    stores.setLoading(false);
  }
};

const handleCancelValidasi = async () => {
  stores.setLoading(true);
  try {
    const tempUuid: any[] = [];
    selectedPatient.value.forEach((item: any) => {
      tempUuid.push(item.uuid);
    });

    const updatedPayload = {
      orderLabUuids: tempUuid,
      orderStatus: 1,
      alasanBatalValidasi: cancelReason.value,
    };

    const responseCancel =
      await useHasilPemeriksaanLabStore.putApiBatalValidasi(updatedPayload);
    if (responseCancel && responseCancel.data) {
      showBatal.value = false;
      cancelReason.value = "";
      selectedPatient.value = [];
      fetchHasilPemeriksaan();
    }
  } catch (error) {
    console.error("Failed to cancel order:", error);
  } finally {
    stores.setLoading(false);
  }
};

const emits = defineEmits(["update:rows", "update:current-page"]);

const dataBreadCrumb = ref<MenuItem[]>([]);
const openedPatientData = ref<any>({});
const changeSection = (label: string) => {
  if (dataBreadCrumb.value.length) {
    dataBreadCrumb.value[0] = { label: label };
  } else {
    dataBreadCrumb.value.push({ label: label });
  }
};

const showDetail = async (event: DataTableRowClickEvent) => {
  stores.setLoading(true);
  try {
    const [patientResponse, tariffResponse] = await Promise.all([
      useHasilPemeriksaanLabStore.getDetailPasien(event.data.uuid),
      useHasilPemeriksaanLabStore.getDetailTarif(event.data.uuid),
    ]);
    openedPatientData.value = {
      ...(patientResponse?.payload || {}),
      ...(tariffResponse?.payload || {}),
    };
    console.log("Opened Patient Data:", openedPatientData.value);
    changeSection("Hasil Pemeriksaan");
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    stores.setLoading(false);
  }
};

// Muat ulang detail order yang sedang dibuka (mis. setelah hasil diambil dari LIS).
const muatUlangDetail = async () => {
  const uuid = openedPatientData.value?.uuid;
  if (!uuid) return;
  stores.setLoading(true);
  try {
    const [patientResponse, tariffResponse] = await Promise.all([
      useHasilPemeriksaanLabStore.getDetailPasien(uuid),
      useHasilPemeriksaanLabStore.getDetailTarif(uuid),
    ]);
    openedPatientData.value = { ...(patientResponse?.payload || {}), ...(tariffResponse?.payload || {}) };
  } finally {
    stores.setLoading(false);
  }
};

const showBatal = ref(false);
const cancelReason = ref<string>();

// Filter Search Data
const searchData = () => {
  searchQuery.value;
  dateToEpoch(startDateFilter.value);
  dateToEpoch(endDateFilter.value);
  fetchHasilPemeriksaan();
};

// Filter Reset Data
const resetData = () => {
    let date = new Date(),
    y = date.getFullYear(),
    m = date.getMonth();
  searchQuery.value = "";
  startDateFilter.value = new Date(y, m, 1);
  endDateFilter.value = new Date(y, m + 1, 0);
  selectedPaymentMethod.value = [];
  fetchHasilPemeriksaan();
};

const handlePage = (event: any) => {
  hasilPemeriksaanProperties.value.page = event.page + 1;
  hasilPemeriksaanProperties.value.page_size = event.rows;
  fetchHasilPemeriksaan();
};

onMounted(async () => {
  let date = new Date(),
    y = date.getFullYear(),
    m = date.getMonth();

  startDateFilter.value = new Date(y, m, 1);
  endDateFilter.value = new Date(y, m + 1, 0);
  await fetchHasilPemeriksaan();
});
</script>

<template>
  <div class="flex flex-col w-full h-full overflow-hidden">
    <Card
      v-if="dataBreadCrumb.length == 0"
      pt:body:class="h-full pt-0 overflow-auto"
      pt:content:class="h-full overflow-hidden"
      class="h-full overflow-hidden"
    >
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="fetchHasilPemeriksaan" />
          <CustomBreadCrumb :home="{ label: 'Hasil Pemeriksaan', home: true }" />
          <CustomTextfield
            v-model="searchQuery"
            label="Pencarian"
            prependIcon="PhMagnifyingGlass"
            placeholder="Cari Nama, Alamat, No RM"
            @keydown.enter="searchData"
          />
          <CustomDatePicker
            v-model="startDateFilter"
            label="Tanggal mulai"
            class="toolbar-field--date"
          />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker
            v-model="endDateFilter"
            label="Tanggal selesai"
            class="toolbar-field--date"
          />
          <ToolbarFilterMenu :count="selectedPaymentMethod.length">
            <template #label>Pembayaran</template>
            <CustomChip
              label="TUNAI"
              value="1"
              :isSelected="selectedPaymentMethod.includes('1')"
              @selected="onPaymentMethodSelect"
            />
            <CustomChip
              label="ASURANSI"
              value="2"
              :isSelected="selectedPaymentMethod.includes('2')"
              @selected="onPaymentMethodSelect"
            />
          </ToolbarFilterMenu>
          <div class="flex items-center gap-1 shrink-0" role="group" aria-label="Status pemeriksaan">
            <CustomButton
              @click="onSelectOrderType('Periksa')"
              label="Periksa"
              :outlined="selectedOrderType != 'Periksa'"
              borderColor="border-opensimrs-300"
              :textColor="selectedOrderType != 'Periksa' ? 'text-opensimrs-300' : 'text-white'"
              :backgroundColor="selectedOrderType != 'Periksa' ? 'bg-transparent' : 'bg-opensimrs-300'"
              class="font-semibold"
            />
            <CustomButton
              @click="onSelectOrderType('Selesai')"
              label="Selesai"
              :outlined="selectedOrderType != 'Selesai'"
              borderColor="border-opensimrs-300"
              :textColor="selectedOrderType != 'Selesai' ? 'text-opensimrs-300' : 'text-white'"
              :backgroundColor="selectedOrderType != 'Selesai' ? 'bg-transparent' : 'bg-opensimrs-300'"
              class="font-semibold"
            />
          </div>
          <CustomButton @click="searchData" icon="PhMagnifyingGlass" label="Cari" />
          <CustomButton
            @click="resetData"
            label="Reset"
            outlined
            borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300"
          />
        </PageToolbar>
      </template>
      <template #content>
        <DataTable
          v-if="hasilPemeriksaanPayload.length"
          v-model:selection="selectedPatient"
          :value="hasilPemeriksaanPayload"
          tableStyle="min-width: 50rem"
          scrollable
          scrollHeight="flex"
          :pt="{ headerRow: 'text-SM' }"
          @rowClick="showDetail"
        >
          <Column field="nomor" headerClass="bg-opensimrs-50">
            <template #header>
              <div class="w-full font-semibold text-center">Nomor</div>
            </template>
            <template #body="slotProps">
              <div class="text-center">
                <div class="text-SM">{{ slotProps.data.noRm }}</div>
                <div class="text-SM">{{ slotProps.data.noreg }}</div>
                <div class="text-SM">{{ slotProps.data.noOrder }}</div>
              </div>
            </template>
          </Column>
          <Column field="pasien" header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">
                <span class="font-semibold">{{
                  slotProps.data.patient?.name
                }}</span>
                <span class="text-grey-300">
                  ({{ slotProps.data.patient?.birthDetail?.ageYear }}Th
                  {{ slotProps.data.ageMonth }}Bln
                  {{ slotProps.data.ageDay }}Hr)
                </span>
              </div>
              <div class="text-XS">
                {{ slotProps.data.patientAddress }},
                {{ slotProps.data.patient?.address?.districtData?.name }},
                {{ slotProps.data.patient?.address?.cityData?.name }},
                {{ slotProps.data.patient?.address?.provData?.name }}
              </div>
              <div class="flex flex-wrap">
                <CustomChip
                  :showCheckedIcon="false"
                  :label="
                    slotProps.data.patient?.gender == 'Female'
                      ? 'Perempuan'
                      : 'Laki-laki'
                  "
                  :bgColor="
                    slotProps.data.patient?.gender == 'Female'
                      ? 'bg-female-75'
                      : 'bg-male-75'
                  "
                  :textColor="
                    slotProps.data.patient?.gender == 'Female'
                      ? 'text-female-300'
                      : 'text-male-300'
                  "
                  customClass="h-5 pr-[6px] border-none mr-[5px]"
                />
                <CustomChip
                  :showCheckedIcon="false"
                  :label="slotProps.data.patient?.phone"
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
              <div class="text-SM">
                {{ slotProps.data.dokterPengirim?.firstTitle }}
                {{ slotProps.data.dokterPengirim?.name }}
                {{ slotProps.data.dokterPengirim?.lastTitle }}
              </div>
              <div class="flex flex-wrap">
                <CustomChip
                  :showCheckedIcon="false"
                  :label="slotProps.data.pelayanan"
                  customClass="h-5 pr-[5px] mr-[5px]"
                />
                <CustomChip v-if="slotProps.data.isMcu" :showCheckedIcon="false" label="MCU" bgColor="bg-warning-50" textColor="text-warning-300" borderColor="border-warning-300" customClass="h-5 pr-[5px] mr-[5px]" />
                <CustomChip
                  :showCheckedIcon="false"
                  :label="slotProps.data.lokasi?.name"
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
                  class="grid content-center grid-cols-[80px_min-content_150px] auto-cols-min"
                >
                  Daftar
                  <PhArrowRight
                    :size="18"
                    class="my-auto mr-5 text-info-300"
                    weight="bold"
                  />
                  {{
                    epochToDate(
                      parseInt(slotProps.data.tglOrder) / 1000,
                      "date"
                    )
                  }}

                  {{
                    epochToDate(
                      parseInt(slotProps.data.tglOrder) / 1000,
                      "time"
                    )
                  }}
                </div>
                <div
                  class="grid content-center grid-cols-[80px_min-content_150px] mt-[5px]"
                >
                  Jadwal
                  <PhArrowRight
                    :size="18"
                    class="my-auto mr-5 text-sunFlower-300"
                    weight="bold"
                  />
                  {{
                    epochToDate(parseInt(slotProps.data.tglPemeriksaan), "date")
                  }}
                  {{
                    epochToDate(parseInt(slotProps.data.tglPemeriksaan), "time")
                  }}
                </div>
              </div>
            </template>
          </Column>
          <Column v-if="selectedOrderType === 'Selesai'" headerClass="bg-opensimrs-50" style="width: 8rem">
            <template #header><div class="w-full font-semibold text-center">Aksi</div></template>
            <template #body="slotProps">
              <div class="flex justify-center">
                <CustomButton label="Cetak" icon="PhPrinter" size="small" @click.stop="cetakHasilLabOrder(slotProps.data.uuid)" />
              </div>
            </template>
          </Column>
          <Column
            v-if="showBatal"
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
              v-if="!showBatal"
              @click="showBatal = true"
              class="my-auto bg-danger-300"
              label="Batal Validasi"
            />

            <CustomButton
              v-if="showBatal"
              @click="showBatal = false"
              class="my-auto mr-[10px]"
              label="Batal"
              outlined
              borderColor="border-grey-200"
              textColor="text-grey-300"
            />

            <CustomButton
              v-if="showBatal"
              @click="handleCancelValidasi"
              class="my-auto mr-[10px] bg-danger-300 w-[20%]"
              label="Iya, Batalkan"
              :disabled="!cancelReason"
            />

            <CustomTextfield
              v-if="showBatal"
              v-model="cancelReason"
              :showLabel="false"
              class="my-auto w-[400px]"
              placeholder="Alasan Batal Validasi"
            />
          </div>
          <CustomPaginator
            :rows="hasilPemeriksaanProperties.page_size"
            :totalRecords="hasilPemeriksaanProperties.total"
            :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePage"
          />
        </div>
      </template>
    </Card>
    <DetailHasilPemeriksaanPage
      v-else-if="dataBreadCrumb[0].label == 'Hasil Pemeriksaan'"
      :dataBreadCrumb="dataBreadCrumb"
      :pageType="pageType"
      :openedPatientData="openedPatientData"
      @back="dataBreadCrumb.pop()"
      @fetchHasil="fetchHasilPemeriksaan"
      @muatUlang="muatUlangDetail"
    />
  </div>
</template>
