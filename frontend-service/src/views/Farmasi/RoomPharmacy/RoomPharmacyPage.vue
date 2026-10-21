<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoomPharmacyStore } from "@/stores/farmasi/RoomPharmacy";
import { utilsStore } from "@/stores/utils";
import { useStockLocationStore } from "@/stores/datamasterFarmasi/StockLocation";
import { epochToDate, dateToEpoch, setTimeForDate } from "@/utils/Helpers";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import NoData from "@/components/section/NoData.vue";
import DetailRoomPharmacyPage from "./DetailRoomPharmacyPage.vue";
import DetailRoomPharmacyPage2 from "./DetailRoomPharmacyPage2.vue";
import DetailRoomPharmacyPage3 from "./DetailRoomPharmacyPage3.vue";

const startDate = ref<Date>(new Date());
const endDate = ref<Date>(new Date());
const stockLocation = ref<string>("");
const searchQuery = ref<string>("");
const UseUtilsStore = utilsStore();

// State Management Stock Location
const StockLocationStore = useStockLocationStore();
const StockLocationPayload = ref<any[]>([]);

// Fetch Stock Location
const fetchStockLocation = async () => {
  try {
    const response = await StockLocationStore.getApi();

    if (response && response.payload) {
      StockLocationPayload.value = response.payload;
      console.log("fetchStockLocation:", StockLocationPayload.value);
    } else {
      StockLocationPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    StockLocationPayload.value = [];
  }
};

interface RoomPharmacyResponse {
  uuid: string;
  noOrderAlkes: string;
  orderStatus: number;
  createdAt: number;
  petugasOrder: string;
  noReg: string;
  noRm: string;
  jenisPelayanan: string;
  paymentMethod: string;
  patient: string;
  lokasiStok: { name: string };
  // status pembayaran kasir pada tahap Penyerahan Alkes (farmasi-service tagihan-farmasi-service.js)
  statusPembayaran?: { kode: string; label: string; bolehDiserahkan: boolean; sisa?: number };
}

interface ApiResponse {
  orderMasuk: RoomPharmacyResponse[];
  sedangDisiapkan: RoomPharmacyResponse[];
  penyerahanAlkes: RoomPharmacyResponse[];
}

const RoomPharmacyPayload = ref<ApiResponse>({
  orderMasuk: [],
  sedangDisiapkan: [],
  penyerahanAlkes: [],
});

// State Management Room Pharmacy
const RoomPharmacyStoreStore = useRoomPharmacyStore();
const RoomPharmacyIncomingDetail = ref<any>({});
const RoomPharmacyReadyDetail = ref<any>({});
const RoomPharmacyHandoverDetail = ref<any>({});

// Fetch Room Pharmacy
const fetchRoomPharmacy = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await RoomPharmacyStoreStore.getApi({
      startDate: dateToEpoch(setTimeForDate(startDate.value, 0, 0, 0)),
      endDate: dateToEpoch(setTimeForDate(endDate.value, 23, 59, 59)),
      search: searchQuery.value,
      lokasiStokUuid: stockLocation.value,
    });

    if (response && response.payload) {
      RoomPharmacyPayload.value = response.payload;
      console.log("fetchRoomPharmacy:", RoomPharmacyPayload.value);
    } else {
      RoomPharmacyPayload.value = {
        orderMasuk: [],
        sedangDisiapkan: [],
        penyerahanAlkes: [],
      };
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    RoomPharmacyPayload.value = {
      orderMasuk: [],
      sedangDisiapkan: [],
      penyerahanAlkes: [],
    };
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const IncomingDetail = async (uuid: string) => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await RoomPharmacyStoreStore.detailApi(uuid);
    if (response && response.payload) {
      RoomPharmacyIncomingDetail.value = response.payload;
      console.log("IncomingDetail:", RoomPharmacyIncomingDetail.value);
      RoomPharmacyIncomingDetail.value.alkesItems.forEach((element: any) => {
        element.listAlkes = [
          {
            stokAlkes: "",
            sisaStok: 0,
            hargaSatuan: 0,
            total: 0,
          },
        ];
      });
    } else {
      RoomPharmacyIncomingDetail.value = {};
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    RoomPharmacyIncomingDetail.value = {};
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// Incoming
const incoming = ref(true);
const incomingDetail = ref(false);

const incomingOpen = async (uuid: string) => {
  readyMedicine.value = false;
  drugHandover.value = false;
  await IncomingDetail(uuid);
  incomingDetail.value = true;
};

const incomingClose = () => {
  readyMedicine.value = true;
  drugHandover.value = true;
  incomingDetail.value = false;
};

const ReadyDetail = async (uuid: string) => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await RoomPharmacyStoreStore.detailApi(uuid);
    if (response && response.payload) {
      RoomPharmacyReadyDetail.value = response.payload;
      console.log("ReadyDetail:", RoomPharmacyReadyDetail.value);
    } else {
      RoomPharmacyReadyDetail.value = {};
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    RoomPharmacyReadyDetail.value = {};
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// Ready Medicine
const readyMedicine = ref(true);
const readyMedicineDetails = ref(false);

const readyMedicineOpen = async (uuid: string) => {
  incoming.value = false;
  drugHandover.value = false;
  await ReadyDetail(uuid);
  readyMedicineDetails.value = true;
};

const readyMedicineClose = () => {
  incoming.value = true;
  drugHandover.value = true;
  readyMedicineDetails.value = false;
};

const HandoverDetail = async (uuid: string) => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await RoomPharmacyStoreStore.detailApi(uuid);
    if (response && response.payload) {
      RoomPharmacyHandoverDetail.value = response.payload;
      console.log("HandoverDetail:", RoomPharmacyHandoverDetail.value);
    } else {
      RoomPharmacyHandoverDetail.value = {};
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    RoomPharmacyHandoverDetail.value = {};
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// Drug Handover
const drugHandover = ref(true);
const drugHandoverDetails = ref(false);

const drugHandoverOpen = async (uuid: string) => {
  incoming.value = false;
  readyMedicine.value = false;
  await HandoverDetail(uuid);
  drugHandoverDetails.value = true;
};

const drugHandoverClose = () => {
  incoming.value = true;
  readyMedicine.value = true;
  drugHandoverDetails.value = false;
};

// Filter Search Data
const searchData = () => {
  dateToEpoch(setTimeForDate(startDate.value, 0, 0, 0)),
    dateToEpoch(setTimeForDate(endDate.value, 23, 59, 59)),
    searchQuery.value,
    stockLocation.value,
    fetchRoomPharmacy();
};

// Filter Reset Data
const resetData = () => {
  startDate.value = new Date();
  endDate.value = new Date();
  searchQuery.value = "";
  stockLocation.value = "";
  fetchRoomPharmacy();
};

// funcNextPage1
const funcNextPage1 = (uuid: string) => {
  incomingDetail.value = false;
  readyMedicineOpen(uuid);
  incoming.value = false;
  readyMedicine.value = true;
  drugHandover.value = false;
};

// funcNextPage2
const funcNextPage2 = (uuid: string) => {
  readyMedicineDetails.value = false;
  drugHandoverOpen(uuid);
  incoming.value = false;
  readyMedicine.value = false;
  drugHandover.value = true;
};

// funcPrevious
const funcPrevious = (uuid: string) => {
  drugHandoverDetails.value = false;
  readyMedicineOpen(uuid);
  incoming.value = false;
  readyMedicine.value = true;
  drugHandover.value = false;
};

onMounted(() => {
  fetchRoomPharmacy();
  fetchStockLocation();
});
</script>

<template>
  <div>
    <Card
      pt:body:class="pt-0 h-full"
      pt:content:class="h-full"
      class="overflow-hidden overflow-y-auto h-full"
    >
      <template #header>
        <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="fetchRoomPharmacy" />
          <CustomBreadCrumb :home="{ label: 'Farmasi Ruangan', home: true }" />
          <CustomTextfield
            v-model="searchQuery"
            label="Pencarian"
            prependIcon="PhMagnifyingGlass"
            placeholder="Cari No. Resep / No. RM / Nama Pasien"
            @keydown.enter="searchData"
          />
          <CustomSelect
            v-model="stockLocation"
            place-holder="Pilih Lokasi"
            label="Lokasi"
            optionLabel="name"
            optionValue="uuid"
            :options="StockLocationPayload"
          />
          <CustomDatePicker
            v-model="startDate"
            @update:model-value="fetchRoomPharmacy"
            label="Tanggal mulai"
            class="toolbar-field--date"
          />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker
            v-model="endDate"
            @update:model-value="fetchRoomPharmacy"
            label="Tanggal selesai"
            class="toolbar-field--date"
          />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="searchData" />
          <CustomButton
            label="Reset"
            outlined
            borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300"
            @click="resetData"
          />
        </PageToolbar>
      </template>
      <template #content>
        <div class="grid grid-cols-3 gap-3">
          <!-- Order Masuk -->
          <div v-show="incoming">
            <div
              class="mt-[10px] p-4 rounded-t-lg bg-opensimrs-300 shadow-md flex justify-between"
            >
              <div class="text-lg font-bold text-white font-poppins">
                Order Masuk
              </div>
              <div class="w-[40px] bg-white rounded-lg">
                <div
                  class="flex items-center justify-center font-bold text-opensimrs-300 text-MD font-poppins mt-[3px]"
                >
                  {{ RoomPharmacyPayload.orderMasuk.length }}
                </div>
              </div>
            </div>
            <div
              class="h-[430px] p-4 overflow-auto bg-white rounded-b-lg shadow-md"
            >
              <div
                v-if="RoomPharmacyPayload.orderMasuk.length"
                v-for="itemIncoming in RoomPharmacyPayload.orderMasuk"
                :key="itemIncoming.uuid"
                @click="incomingOpen(itemIncoming.uuid)"
              >
                <div class="grid grid-cols-2">
                  <div class="grid justify-items-start">
                    <CustomButton class="h-5 text-xs">{{
                      itemIncoming.noRm
                    }}</CustomButton>
                    <div class="text-sm font-bold mt-[5px]">
                      {{ itemIncoming.patient || "-" }}
                    </div>
                    <div
                      class="text-xs font-bold underline underline-offset-2 mt-[5px]"
                    >
                      DPJP
                    </div>
                    <div class="mt-[5px]">
                      {{ itemIncoming.petugasOrder || "-" }}
                    </div>
                    <div>
                      <CustomChip
                        :label="itemIncoming.lokasiStok?.name || '-'"
                        borderColor="border-grey-300"
                        bgColor="bg-grey-50"
                        :showCheckedIcon="false"
                        textColor="text-grey-300"
                        customClass="h-5"
                        class="mr-[5px]"
                      />
                    </div>
                  </div>
                  <div class="grid justify-items-end">
                    <div class="text-sm font-bold">
                      {{ itemIncoming.noOrderAlkes }}
                    </div>
                    <div class="text-sm font-bold mt-[5px]">
                      {{ itemIncoming.noReg }}
                    </div>
                    <div
                      class="text-xs font-bold underline underline-offset-2 mt-[5px]"
                    >
                      Tgl. Order
                    </div>
                    <div class="mt-[5px]">
                      {{ epochToDate(itemIncoming.createdAt, "date") }}
                    </div>
                    <div>
                      <CustomChip
                        :label="itemIncoming.paymentMethod || '-'"
                        :borderColor="
                          itemIncoming.paymentMethod === 'Tunai'
                            ? 'border-opensimrs-300'
                            : 'border-warning-300'
                        "
                        :bgColor="
                          itemIncoming.paymentMethod === 'Tunai'
                            ? 'bg-opensimrs-50'
                            : 'bg-warning-50'
                        "
                        :showCheckedIcon="false"
                        :textColor="
                          itemIncoming.paymentMethod === 'Tunai'
                            ? 'text-opensimrs-300'
                            : 'text-warning-300'
                        "
                        customClass="h-5"
                        class="mr-[5px]"
                      />
                    </div>
                  </div>
                </div>
                <hr class="mt-[10px] mb-[10px] border-[1px] border-grey-200" />
              </div>
              <NoData v-else />
            </div>
          </div>

          <!-- Sedang Disiapkan -->
          <div v-show="readyMedicine">
            <div
              class="mt-[10px] p-4 rounded-t-lg bg-opensimrs-300 shadow-md flex justify-between"
            >
              <div class="text-lg font-bold text-white font-poppins">
                Sedang Disiapkan
              </div>
              <div class="w-[40px] bg-white rounded-lg">
                <div
                  class="flex items-center justify-center font-bold text-opensimrs-300 text-MD font-poppins mt-[3px]"
                >
                  {{ RoomPharmacyPayload.sedangDisiapkan.length }}
                </div>
              </div>
            </div>
            <div
              class="h-[430px] p-4 overflow-auto bg-white rounded-b-lg shadow-md"
            >
              <div
                v-if="RoomPharmacyPayload.sedangDisiapkan.length"
                v-for="itemPrepared in RoomPharmacyPayload.sedangDisiapkan"
                :key="itemPrepared.uuid"
                @click="readyMedicineOpen(itemPrepared.uuid)"
              >
                <div class="grid grid-cols-2">
                  <div class="grid justify-items-start">
                    <CustomButton class="h-5 text-xs">{{
                      itemPrepared.noRm
                    }}</CustomButton>
                    <div class="text-sm font-bold mt-[5px]">
                      {{ itemPrepared.patient }}
                    </div>
                    <div
                      class="text-xs font-bold underline underline-offset-2 mt-[5px]"
                    >
                      DPJP
                    </div>
                    <div class="mt-[5px]">{{ itemPrepared.petugasOrder }}</div>
                    <div>
                      <CustomChip
                        :label="itemPrepared.lokasiStok?.name || '-'"
                        borderColor="border-grey-300"
                        bgColor="bg-grey-50"
                        :showCheckedIcon="false"
                        textColor="text-grey-300"
                        customClass="h-5"
                        class="mr-[5px]"
                      />
                    </div>
                  </div>
                  <div class="grid justify-items-end">
                    <div class="text-sm font-bold">
                      {{ itemPrepared.noOrderAlkes }}
                    </div>
                    <div class="text-sm font-bold mt-[5px]">
                      {{ itemPrepared.noReg }}
                    </div>
                    <div
                      class="text-xs font-bold underline underline-offset-2 mt-[5px]"
                    >
                      Tgl. Order
                    </div>
                    <div class="mt-[5px]">
                      {{ epochToDate(itemPrepared.createdAt, "date") }}
                    </div>
                    <div>
                      <CustomChip
                        :label="itemPrepared.paymentMethod || '-'"
                        :borderColor="
                          itemPrepared.paymentMethod === 'Tunai'
                            ? 'border-opensimrs-300'
                            : 'border-warning-300'
                        "
                        :bgColor="
                          itemPrepared.paymentMethod === 'Tunai'
                            ? 'bg-opensimrs-50'
                            : 'bg-warning-50'
                        "
                        :showCheckedIcon="false"
                        :textColor="
                          itemPrepared.paymentMethod === 'Tunai'
                            ? 'text-opensimrs-300'
                            : 'text-warning-300'
                        "
                        customClass="h-5"
                        class="mr-[5px]"
                      />
                    </div>
                  </div>
                </div>
                <hr class="mt-[10px] mb-[10px] border-[1px] border-grey-200" />
              </div>
              <NoData v-else />
            </div>
          </div>

          <!-- Penyerahan Alkes -->
          <div v-show="drugHandover">
            <div
              class="mt-[10px] p-4 rounded-t-lg bg-opensimrs-300 shadow-md flex justify-between"
            >
              <div class="text-lg font-bold text-white font-poppins">
                Penyerahan Alkes
              </div>
              <div class="w-[40px] bg-white rounded-lg">
                <div
                  class="flex items-center justify-center font-bold text-opensimrs-300 text-MD font-poppins mt-[3px]"
                >
                  {{ RoomPharmacyPayload.penyerahanAlkes.length }}
                </div>
              </div>
            </div>
            <div
              class="h-[430px] p-4 overflow-auto bg-white rounded-b-lg shadow-md"
            >
              <div
                v-if="RoomPharmacyPayload.penyerahanAlkes.length"
                v-for="itemHandover in RoomPharmacyPayload.penyerahanAlkes"
                :key="itemHandover.uuid"
                @click="drugHandoverOpen(itemHandover.uuid)"
              >
                <div class="grid grid-cols-2">
                  <div class="grid justify-items-start">
                    <CustomButton class="h-5 text-xs">{{
                      itemHandover.noRm
                    }}</CustomButton>
                    <div class="text-sm font-bold mt-[5px]">
                      {{ itemHandover.patient }}
                    </div>
                    <div
                      class="text-xs font-bold underline underline-offset-2 mt-[5px]"
                    >
                      DPJP
                    </div>
                    <div class="mt-[5px]">{{ itemHandover.petugasOrder }}</div>
                    <div>
                      <CustomChip
                        :label="itemHandover.lokasiStok?.name || '-'"
                        :borderColor="
                          itemHandover.lokasiStok?.name === 'Farmasi'
                            ? 'border-opensimrs-300'
                            : 'border-grey-300'
                        "
                        :bgColor="
                          itemHandover.lokasiStok?.name === 'Farmasi'
                            ? 'bg-opensimrs-50'
                            : 'bg-grey-50'
                        "
                        :showCheckedIcon="false"
                        :textColor="
                          itemHandover.lokasiStok?.name === 'Farmasi'
                            ? 'text-opensimrs-300'
                            : 'text-grey-300'
                        "
                        customClass="h-5"
                        class="mr-[5px]"
                      />
                    </div>
                  </div>
                  <div class="grid justify-items-end">
                    <div class="text-sm font-bold">
                      {{ itemHandover.noOrderAlkes }}
                    </div>
                    <div class="text-sm font-bold mt-[5px]">
                      {{ itemHandover.noReg }}
                    </div>
                    <div
                      class="text-xs font-bold underline underline-offset-2 mt-[5px]"
                    >
                      Tgl. Order
                    </div>
                    <div class="mt-[5px]">
                      {{ epochToDate(itemHandover.createdAt, "date") }}
                    </div>
                    <div>
                      <!-- dulu selalu "BPJS"; kini metode bayar & status pembayaran kasir -->
                      <CustomChip
                        :label="itemHandover.paymentMethod || '-'"
                        :borderColor="
                          itemHandover.paymentMethod === 'Tunai'
                            ? 'border-opensimrs-300'
                            : 'border-warning-300'
                        "
                        :bgColor="
                          itemHandover.paymentMethod === 'Tunai'
                            ? 'bg-opensimrs-50'
                            : 'bg-warning-50'
                        "
                        :showCheckedIcon="false"
                        :textColor="
                          itemHandover.paymentMethod === 'Tunai'
                            ? 'text-opensimrs-300'
                            : 'text-warning-300'
                        "
                        customClass="h-5"
                        class="mr-[5px]"
                      />
                      <CustomChip
                        v-if="itemHandover.statusPembayaran"
                        :label="itemHandover.statusPembayaran.label.toUpperCase()"
                        :borderColor="itemHandover.statusPembayaran.bolehDiserahkan ? 'border-grass-300' : 'border-warning-300'"
                        :bgColor="itemHandover.statusPembayaran.bolehDiserahkan ? 'bg-grass-50' : 'bg-warning-50'"
                        :showCheckedIcon="false"
                        :textColor="itemHandover.statusPembayaran.bolehDiserahkan ? 'text-grass-300' : 'text-warning-300'"
                        customClass="h-5"
                        class="mr-[5px]"
                      />
                    </div>
                  </div>
                </div>
                <hr class="mt-[10px] mb-[10px] border-[1px] border-grey-200" />
              </div>
              <NoData v-else />
            </div>
          </div>

          <!-- Detail Order Masuk -->
          <DetailRoomPharmacyPage
            v-if="incomingDetail"
            :payloadDetail="RoomPharmacyIncomingDetail"
            @close="incomingClose(), fetchRoomPharmacy()"
            @nextPage1="funcNextPage1"
          />
          <!-- Detail Sedang Disiapkan -->
          <DetailRoomPharmacyPage2
            v-if="readyMedicineDetails"
            :payloadDetail2="RoomPharmacyReadyDetail"
            @close="readyMedicineClose(), fetchRoomPharmacy()"
            @nextPage2="funcNextPage2"
          />
          <!-- Detail Penyerahan Alkes -->
          <DetailRoomPharmacyPage3
            v-if="drugHandoverDetails"
            :payloadDetail3="RoomPharmacyHandoverDetail"
            @close="drugHandoverClose(), fetchRoomPharmacy()"
            @previous="funcPrevious"
          />
        </div>
      </template>
    </Card>
  </div>
</template>
