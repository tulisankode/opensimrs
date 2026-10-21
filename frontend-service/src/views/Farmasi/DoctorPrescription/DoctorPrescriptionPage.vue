<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useDoctorPrescriptionStore } from "@/stores/farmasi/DoctorPrescription";
import { utilsStore } from "@/stores/utils";
import { useStockLocationStore } from "@/stores/datamasterFarmasi/StockLocation";
import { useMedicalItemStore } from "@/stores/datamasterFarmasi/MedicalItem";
import { dateToEpoch, epochToDate, setTimeForDate } from "@/utils/Helpers";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import NoData from "@/components/section/NoData.vue";
import DetailPrescription from "./DetailPrescription.vue";

const startDateFilter = ref<Date>(new Date());
const endDateFilter = ref<Date>(new Date());
const lokasiStok = ref("");
const layanan = ref("");

const optionsLayanan = ref([
  { label: "IGD", value: "igd" },
  { label: "Rawat Jalan", value: "rj" },
  { label: "Rawat Inap", value: "ri" },
]);

// function dateToEpoch(date: any) {
//   if (!(date instanceof Date)) {
//     throw new Error("Input harus berupa objek Date");
//   }
//   return date.getTime();
// }

// Filter Jenis Resep
const selectedRecipe = ref<string[]>([]);
const onRecipeSelect = (label: string) => {
  if (selectedRecipe.value.includes(label)) {
    selectedRecipe.value = selectedRecipe.value.filter((item) => item != label);
  } else {
    selectedRecipe.value.push(label);
  }
  fetchDoctorPrescription();
};

interface Prescription {
  uuid: string;
  noRm: string;
  noReg: string;
  noResep: string;
  dokterOrder: string;
  jenisPelayanan: string;
  orderDate: number;
  isTakeaway?: boolean;
  isChronic?: boolean;
  isCompound?: boolean;
  patient: string;
  lokasiStokNama: string | null;
  // status pembayaran kasir pada tahap Penyerahan Obat (farmasi-service tagihan-farmasi-service.js)
  statusPembayaran?: { kode: string; label: string; bolehDiserahkan: boolean; sisa?: number };
}

interface ApiResponse {
  resepMasuk: Prescription[];
  obatDisiapkan: Prescription[];
  penyerahanObat: Prescription[];
}

const DoctorPrescriptionPayload = ref<ApiResponse>({
  resepMasuk: [],
  obatDisiapkan: [],
  penyerahanObat: [],
});

// State Management
const StockLocationStore = useStockLocationStore();
const MedicalItemStore = useMedicalItemStore();
const StockLocationPayload = ref<any[]>([]);
const DoctorPrescriptionStore = useDoctorPrescriptionStore();
const UseUtilsStore = utilsStore();
const searchQuery = ref<string>("");
const PrescriptionDetail = ref<any>();
const stockObatPayload = ref();

// Fetch Doctor Prescription
const fetchDoctorPrescription = async () => {
  UseUtilsStore.setLoading(true);
  let returnMedicine: string | boolean = "";
  let chronicDrugs: string | boolean = "";
  let concoction: string | boolean = "";
  if (selectedRecipe.value.includes("OBAT PULANG")) {
    returnMedicine = true;
  } else if (selectedRecipe.value.includes("OBAT KRONIS")) {
    chronicDrugs = true;
  } else if (selectedRecipe.value.includes("MENGANDUNG RACIKAN")) {
    concoction = true;
  } else if (selectedRecipe.value.length === 3) {
    returnMedicine = "";
    chronicDrugs = "";
    concoction = "";
  }

  try {
    const response = await DoctorPrescriptionStore.getApi({
      startDate: dateToEpoch(setTimeForDate(startDateFilter.value, 0, 0, 0)),
      endDate: dateToEpoch(setTimeForDate(endDateFilter.value, 23, 59, 59)),
      status: [1, 5],
      search: searchQuery.value,
      takeaway: returnMedicine,
      isChronic: chronicDrugs,
      racikan: concoction,
      jenisPelayanan: layanan.value,
      lokasiStokUuid: lokasiStok.value,
    });

    if (response && response.payload) {
      DoctorPrescriptionPayload.value = response.payload;
      console.log(
        "DoctorPrescriptionPayload.value",
        DoctorPrescriptionPayload.value
      );
    } else {
      DoctorPrescriptionPayload.value = {
        resepMasuk: [],
        obatDisiapkan: [],
        penyerahanObat: [],
      };
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    DoctorPrescriptionPayload.value = {
      resepMasuk: [],
      obatDisiapkan: [],
      penyerahanObat: [],
    };
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const detailPrescription = async (uuid: string) => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await DoctorPrescriptionStore.detailApi(uuid);

    if (response && response.payload) {
      PrescriptionDetail.value = response.payload;
    } else {
      PrescriptionDetail.value = {};
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    PrescriptionDetail.value = {};
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// Fetch Stock Location
const fetchStockLocation = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await StockLocationStore.getApi();

    if (response && response.payload) {
      StockLocationPayload.value = response.payload;
    } else {
      StockLocationPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    StockLocationPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// Fetch Stock Obat
const fetchStockObat = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await MedicalItemStore.getApi(1, 9999);

    if (response && response.payload) {
      stockObatPayload.value = response.payload.filter(
        (item: any) => item.status === true
      );
    } else {
      StockLocationPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    stockObatPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const defaultData = [
  {
    namaObat: "",
    jumlahTotal: "",
  },
];

const data = ref([...defaultData]);

// Incoming Recipes
const incomingRecipes = ref(true);
const incomingRecipesDetails = ref(false);

const incomingRecipesOpen = async (uuid: string) => {
  readyMedicine.value = false;
  drugHandover.value = false;
  await detailPrescription(uuid);
  incomingRecipesDetails.value = true;
};

const incomingRecipesClose = () => {
  readyMedicine.value = true;
  drugHandover.value = true;
  incomingRecipesDetails.value = false;
  fetchDoctorPrescription();
};

// Ready Medicine
const readyMedicine = ref(true);
const readyMedicineDetails = ref(false);

const readyMedicineOpen = async (uuid: string) => {
  incomingRecipes.value = false;
  drugHandover.value = false;
  await detailPrescription(uuid);
  readyMedicineDetails.value = true;
};

const readyMedicineClose = () => {
  incomingRecipes.value = true;
  drugHandover.value = true;
  readyMedicineDetails.value = false;
  fetchDoctorPrescription();
};

// Drug Handover
const drugHandover = ref(true);
const drugHandoverDetails = ref(false);

const drugHandoverOpen = async (uuid: string) => {
  incomingRecipes.value = false;
  readyMedicine.value = false;
  await detailPrescription(uuid);
  drugHandoverDetails.value = true;
};

const drugHandoverClose = () => {
  incomingRecipes.value = true;
  readyMedicine.value = true;
  drugHandoverDetails.value = false;
  fetchDoctorPrescription();
};

onMounted(() => {
  fetchDoctorPrescription();
  fetchStockLocation();
  fetchStockObat();
});

const handleReset = () => {
  searchQuery.value = "";
  lokasiStok.value = "";
  layanan.value = "";
  fetchDoctorPrescription();
};
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
          <CustomButton icon="PhArrowClockwise" @click="fetchDoctorPrescription" />
          <CustomBreadCrumb :home="{ label: 'Resep Dokter', home: true }" />
          <CustomTextfield
            v-model="searchQuery"
            label="Pencarian Transaksi"
            prependIcon="PhMagnifyingGlass"
            placeholder="Cari Nama / No. RM / Nama Pasien"
            @keydown.enter="fetchDoctorPrescription"
          />
          <CustomSelect
            v-model="lokasiStok"
            place-holder="Pilih Lokasi"
            label="Lokasi"
            optionLabel="name"
            optionValue="uuid"
            :options="StockLocationPayload"
          />
          <CustomSelect
            v-model="layanan"
            place-holder="Pilih Jenis Pelayanan"
            label="Jenis Pelayanan"
            optionLabel="label"
            optionValue="value"
            :options="optionsLayanan"
          />
          <CustomDatePicker
            v-model="startDateFilter"
            @update:model-value="fetchDoctorPrescription"
            label="Tanggal mulai"
            class="toolbar-field--date"
          />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker
            v-model="endDateFilter"
            @update:model-value="fetchDoctorPrescription"
            label="Tanggal selesai"
            class="toolbar-field--date"
          />
          <ToolbarFilterMenu :count="selectedRecipe.length">
            <template #label>Jenis Resep</template>
            <CustomChip
              label="Obat Pulang"
              :isSelected="selectedRecipe.includes('OBAT PULANG')"
              @selected="onRecipeSelect"
            />
            <CustomChip
              label="Obat Kronis"
              :isSelected="selectedRecipe.includes('OBAT KRONIS')"
              @selected="onRecipeSelect"
            />
            <CustomChip
              label="Mengandung Racikan"
              :isSelected="selectedRecipe.includes('MENGANDUNG RACIKAN')"
              @selected="onRecipeSelect"
            />
          </ToolbarFilterMenu>
          <CustomButton
            icon="PhMagnifyingGlass"
            label="Cari"
            @click="fetchDoctorPrescription"
          />
          <CustomButton
            label="Reset"
            outlined
            borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300"
            @click="handleReset"
          />
        </PageToolbar>
      </template>
      <template #content>
        <div class="grid grid-cols-3 gap-3">
          <!-- Resep Masuk -->
          <div v-show="incomingRecipes">
            <div
              class="mt-[10px] p-4 rounded-t-lg bg-opensimrs-300 shadow-md flex justify-between"
            >
              <div class="text-lg font-bold text-white font-poppins">
                Resep Masuk
              </div>
              <div class="w-[40px] bg-white rounded-lg">
                <div
                  class="flex items-center justify-center font-bold text-opensimrs-300 text-MD font-poppins mt-[3px]"
                >
                  {{ DoctorPrescriptionPayload.resepMasuk.length }}
                </div>
              </div>
            </div>
            <div
              class="h-[430px] p-4 overflow-auto bg-white rounded-b-lg shadow-md"
            >
              <div
                v-if="DoctorPrescriptionPayload.resepMasuk.length"
                v-for="(
                  prescription, prescriptionIndex
                ) in DoctorPrescriptionPayload.resepMasuk"
                :key="prescription.uuid"
                @click="incomingRecipesOpen(prescription.uuid)"
              >
                <div class="grid grid-cols-2">
                  <div class="grid justify-items-start">
                    <CustomButton class="h-5 text-xs">{{
                      prescription.noRm
                    }}</CustomButton>
                    <div class="text-sm font-bold mt-[5px]">
                      {{ prescription.patient }}
                    </div>
                    <div
                      class="text-xs font-bold underline underline-offset-2 mt-[5px]"
                    >
                      Penulis Resep
                    </div>
                    <div class="mt-[5px]">{{ prescription.dokterOrder }}</div>
                    <div
                      class="text-xs font-bold underline underline-offset-2 mt-[5px]"
                    >
                      Lokasi Tujuan Order
                    </div>
                    <div class="mt-[5px]">
                      {{ prescription.lokasiStokNama || "-" }}
                    </div>
                    <div>
                      <CustomChip
                        :label="
                          prescription.jenisPelayanan === 'igd'
                            ? 'IGD'
                            : prescription.jenisPelayanan === 'ri'
                            ? 'RAWAT INAP'
                            : prescription.jenisPelayanan === 'rj'
                            ? 'RAWAT JALAN'
                            : ''
                        "
                        borderColor="border-grey-300"
                        bgColor="bg-grey-50"
                        :showCheckedIcon="false"
                        textColor="text-grey-300"
                        customClass="h-5"
                        class="mr-[5px]"
                      />
                      <CustomChip
                        v-if="prescription.isTakeaway"
                        label="OBAT PULANG"
                        borderColor="border-male-300"
                        bgColor="bg-male-50"
                        :showCheckedIcon="false"
                        textColor="text-male-300"
                        customClass="h-5"
                        class="mr-[5px]"
                      />
                      <CustomChip
                        v-if="prescription.isChronic"
                        label="OBAT KRONIS"
                        borderColor="border-sunFlower-300"
                        bgColor="bg-sunFlower-50"
                        :showCheckedIcon="false"
                        textColor="text-sunFlower-300"
                        customClass="h-5"
                        class="mr-[5px]"
                      />
                      <CustomChip
                        v-if="prescription.isCompound"
                        label="MENGANDUNG RACIKAN"
                        borderColor="border-grass-300"
                        bgColor="bg-grass-50"
                        :showCheckedIcon="false"
                        textColor="text-grass-300"
                        customClass="h-5"
                        class="mr-[5px]"
                      />
                    </div>
                  </div>
                  <div class="grid justify-items-end">
                    <div class="text-sm font-bold">
                      {{ prescription.noResep }}
                    </div>
                    <div class="text-sm font-bold mt-[5px]">
                      {{ prescription.noReg }}
                    </div>
                    <div
                      class="text-xs font-bold underline underline-offset-2 mt-[5px]"
                    >
                      Tgl. Order
                    </div>
                    <div class="mt-[5px]">
                      {{ epochToDate(prescription.orderDate, "date") }}
                    </div>
                    <div class="mt-[5px] invisible">test</div>
                    <div class="mt-[5px] invisible">test</div>
                    <div>
                      <CustomChip
                        label="TUNAI"
                        borderColor="border-opensimrs-300"
                        bgColor="bg-opensimrs-50"
                        :showCheckedIcon="false"
                        textColor="text-opensimrs-300"
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

          <!-- Obat Disiapkan -->
          <div v-show="readyMedicine">
            <div
              class="mt-[10px] p-4 rounded-t-lg bg-opensimrs-300 shadow-md flex justify-between"
            >
              <div class="text-lg font-bold text-white font-poppins">
                Obat Disiapkan
              </div>
              <div class="w-[40px] bg-white rounded-lg">
                <div
                  class="flex items-center justify-center font-bold text-opensimrs-300 text-MD font-poppins mt-[3px]"
                >
                  {{ DoctorPrescriptionPayload.obatDisiapkan.length }}
                </div>
              </div>
            </div>
            <div
              class="h-[430px] p-4 overflow-auto bg-white rounded-b-lg shadow-md"
            >
              <div
                v-if="DoctorPrescriptionPayload.obatDisiapkan.length"
                v-for="(
                  prescription, prescriptionIndex
                ) in DoctorPrescriptionPayload.obatDisiapkan"
                :key="prescription.uuid"
                @click="readyMedicineOpen(prescription.uuid)"
                class=""
              >
                <div class="grid grid-cols-2">
                  <div class="grid justify-items-start">
                    <CustomButton class="h-5 text-xs">{{
                      prescription.noRm
                    }}</CustomButton>
                    <div class="text-sm font-bold mt-[5px]">
                      {{ prescription.patient }}
                    </div>
                    <div
                      class="text-xs font-bold underline underline-offset-2 mt-[5px]"
                    >
                      Penulis Resep
                    </div>
                    <div class="mt-[5px]">{{ prescription.dokterOrder }}</div>
                    <div
                      class="text-xs font-bold underline underline-offset-2 mt-[5px]"
                    >
                      Lokasi Tujuan Order
                    </div>
                    <div class="mt-[5px]">
                      {{ prescription.lokasiStokNama || "-" }}
                    </div>
                    <div>
                      <CustomChip
                        :label="
                          prescription.jenisPelayanan === 'igd'
                            ? 'IGD'
                            : prescription.jenisPelayanan === 'ri'
                            ? 'RAWAT INAP'
                            : prescription.jenisPelayanan === 'rj'
                            ? 'RAWAT JALAN'
                            : ''
                        "
                        borderColor="border-grey-300"
                        bgColor="bg-grey-50"
                        :showCheckedIcon="false"
                        textColor="text-grey-300"
                        customClass="h-5"
                        class="mr-[5px]"
                      />
                      <CustomChip
                        v-if="prescription.isTakeaway"
                        label="OBAT PULANG"
                        borderColor="border-male-300"
                        bgColor="bg-male-50"
                        :showCheckedIcon="false"
                        textColor="text-male-300"
                        customClass="h-5"
                        class="mr-[5px]"
                      />
                      <CustomChip
                        v-if="prescription.isChronic"
                        label="OBAT KRONIS"
                        borderColor="border-sunFlower-300"
                        bgColor="bg-sunFlower-50"
                        :showCheckedIcon="false"
                        textColor="text-sunFlower-300"
                        customClass="h-5"
                        class="mr-[5px]"
                      />
                      <CustomChip
                        v-if="prescription.isCompound"
                        label="MENGANDUNG RACIKAN"
                        borderColor="border-grass-300"
                        bgColor="bg-grass-50"
                        :showCheckedIcon="false"
                        textColor="text-grass-300"
                        customClass="h-5"
                        class="mr-[5px]"
                      />
                    </div>
                  </div>
                  <div class="grid justify-items-end">
                    <div class="text-sm font-bold">
                      {{ prescription.noResep }}
                    </div>
                    <div class="text-sm font-bold mt-[5px]">
                      {{ prescription.noReg }}
                    </div>
                    <div
                      class="text-xs font-bold underline underline-offset-2 mt-[5px]"
                    >
                      Tgl. Order
                    </div>
                    <div class="mt-[5px]">
                      {{ epochToDate(prescription.orderDate, "date") }}
                    </div>
                    <div class="mt-[5px] invisible">test</div>
                    <div class="mt-[5px] invisible">test</div>
                    <div>
                      <CustomChip
                        label="TUNAI"
                        borderColor="border-opensimrs-300"
                        bgColor="bg-opensimrs-50"
                        :showCheckedIcon="false"
                        textColor="text-opensimrs-300"
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

          <!-- Penyerahan Obat -->
          <div v-show="drugHandover">
            <div
              class="mt-[10px] p-4 rounded-t-lg bg-opensimrs-300 shadow-md flex justify-between"
            >
              <div class="text-lg font-bold text-white font-poppins">
                Penyerahan Obat
              </div>
              <div class="w-[40px] bg-white rounded-lg">
                <div
                  class="flex items-center justify-center font-bold text-opensimrs-300 text-MD font-poppins mt-[3px]"
                >
                  {{ DoctorPrescriptionPayload.penyerahanObat.length }}
                </div>
              </div>
            </div>
            <div
              class="h-[430px] p-4 overflow-auto bg-white rounded-b-lg shadow-md"
            >
              <div
                v-if="DoctorPrescriptionPayload.penyerahanObat.length"
                v-for="(
                  prescription, prescriptionIndex
                ) in DoctorPrescriptionPayload.penyerahanObat"
                :key="prescription.uuid"
                @click="drugHandoverOpen(prescription.uuid)"
              >
                <div class="grid grid-cols-2">
                  <div class="grid justify-items-start">
                    <CustomButton class="h-5 text-xs">{{
                      prescription.noRm
                    }}</CustomButton>
                    <div class="text-sm font-bold mt-[5px]">
                      {{ prescription.patient }}
                    </div>
                    <div
                      class="text-xs font-bold underline underline-offset-2 mt-[5px]"
                    >
                      Penulis Resep
                    </div>
                    <div class="mt-[5px]">{{ prescription.dokterOrder }}</div>
                    <div
                      class="text-xs font-bold underline underline-offset-2 mt-[5px]"
                    >
                      Lokasi Tujuan Order
                    </div>
                    <div class="mt-[5px]">
                      {{ prescription.lokasiStokNama || "-" }}
                    </div>
                    <div>
                      <CustomChip
                        :label="
                          prescription.jenisPelayanan === 'igd'
                            ? 'IGD'
                            : prescription.jenisPelayanan === 'ri'
                            ? 'RAWAT INAP'
                            : prescription.jenisPelayanan === 'rj'
                            ? 'RAWAT JALAN'
                            : ''
                        "
                        borderColor="border-grey-300"
                        bgColor="bg-grey-50"
                        :showCheckedIcon="false"
                        textColor="text-grey-300"
                        customClass="h-5"
                        class="mr-[5px]"
                      />
                      <CustomChip
                        v-if="prescription.isTakeaway"
                        label="OBAT PULANG"
                        borderColor="border-male-300"
                        bgColor="bg-male-50"
                        :showCheckedIcon="false"
                        textColor="text-male-300"
                        customClass="h-5"
                        class="mr-[5px]"
                      />
                      <CustomChip
                        v-if="prescription.isChronic"
                        label="OBAT KRONIS"
                        borderColor="border-sunFlower-300"
                        bgColor="bg-sunFlower-50"
                        :showCheckedIcon="false"
                        textColor="text-sunFlower-300"
                        customClass="h-5"
                        class="mr-[5px]"
                      />
                      <CustomChip
                        v-if="prescription.isCompound"
                        label="MENGANDUNG RACIKAN"
                        borderColor="border-grass-300"
                        bgColor="bg-grass-50"
                        :showCheckedIcon="false"
                        textColor="text-grass-300"
                        customClass="h-5"
                        class="mr-[5px]"
                      />
                      <CustomChip
                        v-if="prescription.statusPembayaran"
                        :label="prescription.statusPembayaran.label.toUpperCase()"
                        :borderColor="prescription.statusPembayaran.bolehDiserahkan ? 'border-grass-300' : 'border-warning-300'"
                        :bgColor="prescription.statusPembayaran.bolehDiserahkan ? 'bg-grass-50' : 'bg-warning-50'"
                        :showCheckedIcon="false"
                        :textColor="prescription.statusPembayaran.bolehDiserahkan ? 'text-grass-300' : 'text-warning-300'"
                        customClass="h-5"
                        class="mr-[5px]"
                      />
                    </div>
                  </div>
                  <div class="grid justify-items-end">
                    <div class="text-sm font-bold">
                      {{ prescription.noResep }}
                    </div>
                    <div class="text-sm font-bold mt-[5px]">
                      {{ prescription.noReg }}
                    </div>
                    <div
                      class="text-xs font-bold underline underline-offset-2 mt-[5px]"
                    >
                      Tgl. Order
                    </div>
                    <div class="mt-[5px]">
                      {{ epochToDate(prescription.orderDate, "date") }}
                    </div>
                    <div class="mt-[5px] invisible">test</div>
                    <div class="mt-[5px] invisible">test</div>
                    <div>
                      <CustomChip
                        label="TUNAI"
                        borderColor="border-opensimrs-300"
                        bgColor="bg-opensimrs-50"
                        :showCheckedIcon="false"
                        textColor="text-opensimrs-300"
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

          <!-- Detail Resep - Telaah -->
          <DetailPrescription
            v-if="incomingRecipesDetails"
            :key="(PrescriptionDetail?.uuid || 'incoming') + '-incoming'"
            :payloadDetail="PrescriptionDetail || {}"
            @close="incomingRecipesClose"
          />
          <!-- Detail Resep - Obat Siap Diserahkan -->
          <DetailPrescription
            v-if="readyMedicineDetails"
            :key="(PrescriptionDetail?.uuid || 'ready') + '-ready'"
            :payloadDetail="PrescriptionDetail || {}"
            @close="readyMedicineClose"
          />
          <!-- Detail Resep - Serahkan Obat -->
          <DetailPrescription
            v-if="drugHandoverDetails"
            :key="(PrescriptionDetail?.uuid || 'handover') + '-handover'"
            :payloadDetail="PrescriptionDetail || {}"
            @close="drugHandoverClose"
          />
        </div>
      </template>
    </Card>
  </div>
</template>
