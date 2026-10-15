<script lang="ts" setup>
import { onMounted, ref, watch, computed } from "vue";
import { fiturAktif } from "@/stores/modulFaskes";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import DetailPasien from "./DetailPasien.vue";
import { useFieldArray, useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import RiwayatSebelumnya from "./RiwayatSebelumnya.vue";
import { utilsStore } from "@/stores/utils";
import { useMedicalItemStore } from "@/stores/datamasterFarmasi/MedicalItem";
import { useHowToUseStore } from "@/stores/datamasterFarmasi/HowToUse";
import { useUnitStore } from "@/stores/datamasterFarmasi/Unit";
import { useRulesOfUseStore } from "@/stores/datamasterFarmasi/RulesOfUse";
import { usePriceConfigurationStore } from "@/stores/datamasterFarmasi/PriceConfiguration";
import { useDoctorPrescriptionStore } from "@/stores/farmasi/DoctorPrescription";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";

const storeUtils = utilsStore();
const medicalItemStore = useMedicalItemStore();
const rulesOfUseStore = useRulesOfUseStore();
const unitStore = useUnitStore();
const howToUseStore = useHowToUseStore();
const priceConfigurationtore = usePriceConfigurationStore();
const doctorPrescriptionStore = useDoctorPrescriptionStore();
const rekamMedisStore = useRekamMedisStore();

type ObatRacikan = {
  itemMedis: any;
  jumlahTotal: number;
};
const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
  },
  obatToEdit: { type: Object, default: () => {} },
  index: {
    type: Number,
    default: null,
  },
  patientData: {
    type: Object,
  },
  prescriptionUuid: {
    type: String,
    required: true,
  },
  type: {
    type: String,
  },
});

const sirup = ref(false);
const schema = toTypedSchema(
  yup.object({
    namaRacikan: yup.string().required("Nama Racikan Harus diisi"),
    medicationQty: yup.number().required("Jumlah Embalase Harus diisi"),
    bentukRacikan: yup.mixed<any>().required("Satuan Embalase Harus diisi"),
    medicationPeriod: yup.mixed<any>().required("Periode harus dipilih"),
    medicationDoseQty: yup
      .number()
      .required("Jumlah Konsumsi harus diisi")
      .min(1),
    medicationDoseSatuan: yup
      .mixed<any>()
      .required("Satuan Dosis harus dipilih"),
    aturanPakai: yup.mixed<any>().required("Aturan Pakai harus dipilih"),
    caraPakai: yup.mixed<any>().required("Cara Pakai harus dipilih"),
    route: yup.mixed<any>().required("Rute Pemberihan harus dipilih"),
    isChronic: yup.bool().default(false),
    prescriptionNotes: yup.string(),
    isCompound: yup.bool().default(true),
    jenisRacikan: yup.boolean().default(false),
    racikan: yup
      .array()
      .of(
        yup.object({
          itemMedis: yup.mixed<any>().required("Nama Obat harus dipilih"),
          jumlahTotal: yup.number().required().min(1),
        })
      )
      .min(1, "Harus ada minimal 1 data obat"),
  })
);

const { errors, handleSubmit, resetForm, defineField, setValues } = useForm({
  validationSchema: schema,
  initialValues: {
    namaRacikan: "",
    medicationQty: 1,
    bentukRacikan: null,
    medicationPeriod: null,
    medicationDoseQty: 1,
    medicationDoseSatuan: null,
    aturanPakai: null,
    caraPakai: null,
    route: null,
    isChronic: false,
    prescriptionNotes: "",
    racikan: [{ itemMedis: null, jumlahTotal: 1 }],
  },
});

const [namaRacikan] = defineField("namaRacikan");
const [medicationQty] = defineField("medicationQty");
const [bentukRacikan] = defineField("bentukRacikan");
const [medicationPeriod] = defineField("medicationPeriod");
const [medicationDoseQty] = defineField("medicationDoseQty");
const [medicationDoseSatuan] = defineField("medicationDoseSatuan");
const [aturanPakai] = defineField("aturanPakai");
const [caraPakai] = defineField("caraPakai");
const [route] = defineField("route");
const [isChronic] = defineField("isChronic");
const [prescriptionNotes] = defineField("prescriptionNotes");
const [jenisRacikan] = defineField("jenisRacikan");

const emit = defineEmits([
  "update:isDialogVisible",
  "add-obat-racikan",
  "update-obat",
]);

const namaObats = ref<any[]>([]);
const periodes = ref([
  { id: 1, periode: "Hari" },
  { id: 2, periode: "Minggu" },
  { id: 3, periode: "Jam" },
  { id: 4, periode: "Tiap" },
  { id: 5, periode: "Khusus" },
]);
const aturanPakais = ref<any[]>([]);
const satuanDosiss = ref<any[]>([]);
const caraPakais = ref<any[]>([]);
const rutePemberians = ref([
  { kode: "Implant", rutePemberian: "Implant" },
  { kode: "Inhal", rutePemberian: "Inhalation" },
  { kode: "Instill", rutePemberian: "Instillation" },
  { kode: "N", rutePemberian: "nasal" },
  { kode: "O", rutePemberian: "oral" },
  { kode: "P", rutePemberian: "parenteral" },
  { kode: "R", rutePemberian: "rectal" },
  { kode: "SL", rutePemberian: "sublingual/buccal/oromucosal" },
  { kode: "TD", rutePemberian: "transdermal" },
  { kode: "V", rutePemberian: "vaginal" },
]);
const listBentukRacikan = ref<any[]>([]);
const { remove, push, fields } = useFieldArray<ObatRacikan>("racikan");

const addObatRacikan = () => {
  push({
    itemMedis: null,
    jumlahTotal: 1,
  });
};

const onSubmit = handleSubmit(async (values: any) => {
  if (props.type == "add") {
    emit("add-obat-racikan", values);
    resetForm();
    emit("update:isDialogVisible", false);
  } else {
    try {
      storeUtils.setLoading(true);
      let response = await doctorPrescriptionStore.updatePrescriptionObat(
        values.uuid,
        transformPayloadData(values)
      );
      if (response && response.data.sucess) {
        resetForm();
        emit("update:isDialogVisible", false);
        emit("update-obat");
      }
    } catch (error) {
      console.error("Failed to post data", error);
    } finally {
      storeUtils.setLoading(false);
    }
  }
});

const transformPayloadData = (dataObat: any) => {
  let tempObatRacikan = {
    type: "racikan",
    prescriptionUuid: props.prescriptionUuid,
    medicationQty: dataObat.medicationQty || 0,
    itemMedisUuid: "-",
    medicationDoseQty: dataObat.medicationDoseQty || 0,
    medicationDoseSatuanUuid: dataObat.medicationDoseSatuan?.uuid || "",
    medicationPeriod: dataObat.medicationPeriod || "",
    aturanPakaiUuid: dataObat.aturanPakai?.uuid || "",
    caraPakaiUuid: dataObat.caraPakai?.uuid || "",
    prescriptionNotes: dataObat.prescriptionNotes || "",
    isChronic: dataObat.isChronic || false,
    route: dataObat.route?.kode || "",
    isCompound: true,
    namaRacikan: dataObat.namaRacikan || "",
    jenisRacikan: dataObat.jenisRacikan ? 1 : 0,
    bentukRacikanUuid: dataObat.bentukRacikan?.uuid || "",
    racikan: dataObat.racikan.map((obatRacikan: any) => {
      if (obatRacikan.uuid)
        return {
          isUpdated: true,
          uuid: obatRacikan.uuid,
          itemMedisUuid: obatRacikan.itemMedis.uuid,
          medicationQty: obatRacikan.jumlahTotal || 0,
        };
      else
        return {
          itemMedisUuid: obatRacikan.itemMedis.uuid,
          medicationQty: obatRacikan.jumlahTotal || 0,
        };
    }),
  };
  listDeletedObat.value.forEach((deletedObat: any) => {
    tempObatRacikan.racikan.push({
      isDeleted: deletedObat.isDeleted,
      uuid: deletedObat.uuid,
      itemMedisUuid: deletedObat.itemMedis.uuid,
      medicationQty: deletedObat.jumlahTotal || 0,
    });
  });
  return tempObatRacikan;
};

function updateVisibility(value: boolean) {
  emit("update:isDialogVisible", value);
  resetForm();
  historyData.value = null;
  historyPageIndex.value = 0;
  detailedHistoryItem.value = null;
  filterJenisKunjungan.value = 'semua';
}

const obatData = ref({ ...props.obatToEdit });

watch(
  () => props.obatToEdit,
  (newVal: any) => {
    console.log("Updated obatToEdit:", newVal);
    obatData.value = { ...newVal };
    setValues(newVal);
  }
);

const listDeletedObat = ref<any[]>([]);
const deleteObat = (index: number) => {
  listDeletedObat.value.push({
    isDeleted: true,
    ...fields.value[index].value,
  });
  remove(index);
};

const getListObat = async () => {
  const response = await medicalItemStore.getWithoutPaginationApi2();
  if (response && response.payload) {
    namaObats.value = response.payload;
  }
};

const getListAturanPakai = async () => {
  const response = await rulesOfUseStore.exportApi();
  if (response && response.payload) {
    aturanPakais.value = response.payload;
  }
};

const getListSatuanDosis = async () => {
  const response = await unitStore.exportApi();
  if (response && response.payload) {
    satuanDosiss.value = response.payload.filter(
      (unit: any) => unit.satuanDosis
    );
  }
};

const getListCaraPakai = async () => {
  const response = await howToUseStore.exportApi();
  if (response && response.payload) {
    caraPakais.value = response.payload;
  }
};

const getBentukRacikanSediaan = async () => {
  const response = await priceConfigurationtore.getRacikanApi();
  if (response && response.payload) {
    listBentukRacikan.value = response.payload;
  }
};

const historyData = ref<any[] | null>(null);
const historyPageIndex = ref(0);
const filterJenisKunjungan = ref("semua");
const detailedHistoryItem = ref<any>(null);

const fetchRiwayatSebelumnya = async () => {
  storeUtils.setLoading(true);
  historyData.value = null;
  historyPageIndex.value = 0;
  detailedHistoryItem.value = null;
  try {
    const noRm = props.patientData?.patient?.noRm;
    const noPelayananAdmission = props.patientData?.noPelayanan || props.patientData?.no_pelayanan;

    if (!noRm || !noPelayananAdmission) {
      console.warn("noRm atau noPelayanan tidak ditemukan di patientData, tidak bisa fetch riwayat.");
      return;
    }
    const openedRekamMedis = rekamMedisStore.openedRekamMedis;
    const selectedDate = openedRekamMedis.dates?.find((d: { isSelected: any; }) => d.isSelected)?.date;
    const selectedSessionOrder = openedRekamMedis.sessions?.find((s: { isSelected: any; }) => s.isSelected)?.order;

    const params = {
      noPelayanan: noPelayananAdmission,
      noRm: noRm,
      jenisKunjungan: filterJenisKunjungan.value === 'semua' ? '' : filterJenisKunjungan.value,
      key: "obat_uuides",
      dateFilter: selectedDate || "",
      sessionOrder: selectedSessionOrder || "",
    };
    const response = await rekamMedisStore.getCompare(params);
    if (response && response.payload && Array.isArray(response.payload) && response.payload.length > 0) {
      historyData.value = response.payload;
    } else {
      console.warn("API getCompare tidak mengembalikan data riwayat.", response);
    }
  } catch (error) {
    console.error("Gagal mengambil riwayat sebelumnya (getCompare):", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const currentHistoryItemRaw = computed(() => {
  if (!historyData.value || !historyData.value[historyPageIndex.value]) return null;
  return historyData.value[historyPageIndex.value];
});

watch(currentHistoryItemRaw, async (newHistoryItem) => {
  if (!newHistoryItem) {
    detailedHistoryItem.value = null;
    return;
  }

  const prescriptionUuidList = newHistoryItem.data; 
  if (!prescriptionUuidList || !Array.isArray(prescriptionUuidList) || prescriptionUuidList.length === 0) {
    detailedHistoryItem.value = null;
    return;
  }

  storeUtils.setLoading(true);
  try {

    const detailPromises = prescriptionUuidList.map(uuid => 
      doctorPrescriptionStore.detailApi(uuid)
    );
    const detailResponses = await Promise.all(detailPromises);
    const allDataObat = detailResponses.flatMap(res => res?.payload?.obatItems || []);
    const firstDetail = detailResponses[0]?.payload;

    detailedHistoryItem.value = {
      ...newHistoryItem,
      noPelayanan: newHistoryItem.noPelayanan || firstDetail?.noPelayanan || 'N/A',
      data: allDataObat,
      meta: {
        petugasName: firstDetail?.dokterOrder || 'N/A',
        createdAt: firstDetail?.orderDate,
        noResep: firstDetail?.noResep,
      }
    };
    
  } catch (error) {
    console.error("Gagal mengambil detail riwayat resep:", error);
    detailedHistoryItem.value = null;
  } finally {
    storeUtils.setLoading(false);
  }
});

const canGoToPrevious = computed(() => historyPageIndex.value > 0);
const canGoToNext = computed(() => {
  if (!historyData.value) return false;
  return historyPageIndex.value + 1 < historyData.value.length;
});
const previousHistory = () => {
  if (canGoToPrevious.value) {
    historyPageIndex.value -= 1;
  }
};
const nextHistory = () => {
  if (canGoToNext.value) {
    historyPageIndex.value += 1;
  }
};

watch(
  () => props.isDialogVisible,
  async (newValue) => {
    if (newValue) {
      try {
        storeUtils.setLoading(true);
        await Promise.all([
          getListObat(),
          getListAturanPakai(),
          getListSatuanDosis(),
          getListCaraPakai(),
          getBentukRacikanSediaan(),
          fetchRiwayatSebelumnya()
        ]);
      } catch (error) {
        console.error(error);
      } finally {
        storeUtils.setLoading(false);
      }
    }
  }
);

watch(filterJenisKunjungan, (newValue, oldValue) => {
  if (props.isDialogVisible && newValue !== oldValue) {
    fetchRiwayatSebelumnya();
  }
});
</script>

<template>
  <CustomDialog
    :full-screen="true"
    class=""
    :visible="isDialogVisible"
    headerBg="bg-opensimrs-300"
    @update:visible="updateVisibility"
  >
    <template #header>{{ title }}</template>
    <template #body>
      <div class="flex gap-5 my-5">
        <div class="min-w-[500px]">
          <DetailPasien :patientData="patientData" />
          <RiwayatSebelumnya
            v-if="patientData"
            :patientData="patientData"
            :historyItem="detailedHistoryItem"
            :filterJenisKunjungan="filterJenisKunjungan"
            :isLoading="storeUtils.isLoading"
            :canGoToPrevious="canGoToPrevious"
            :canGoToNext="canGoToNext"
            @update:filter="(val) => filterJenisKunjungan = val"
            @next="nextHistory"
            @previous="previousHistory"
          />
        </div>
        <hr class="h-auto border border-opensimrs-300" />
        <div class="grow">
          <div class="flex items-center">
            <div class="grow">
              <CustomTextfield
                label="Nama Racikan"
                class="border-[#C7CBD2]"
                placeholder="Masukkan Nama Racikan"
                v-model="namaRacikan"
                :invalid="!!errors.namaRacikan"
                :invalidMessage="errors.namaRacikan"
              />
            </div>
            <CustomSwitch v-model="jenisRacikan" label="Sirup" class="mx-10" />
            <CustomButton
              label="Tambah Obat"
              showIcon
              icon-pos="left"
              icon="PhPlus"
              @click="addObatRacikan"
            />
          </div>
          <hr class="my-4 bg-grey-200 border-1" />

          <div class="flex flex-col gap-5 overflow-y-auto max-h-[400px] w-auto">
            <div
              class="flex items-end gap-4"
              v-for="(field, index) in fields"
              :key="index"
            >
              <div class="grow">
                <CustomSelect
                  :label="`Nama Obat - ${index + 1}`"
                  placeHolder="Pilih Obat"
                  v-model="field.value.itemMedis"
                  :options="namaObats"
                  optionLabel="name"
                  optionValue=""
                  dataKey="uuid"
                  :invalid="!!(errors as any)[`racikan[${index}].itemMedis`]"
                  :invalidMessage="(errors as any)[`racikan[${index}].itemMedis`]"
                >
                  <template #customOptions="{ option }">
                    {{ option.name }} - {{ option.satuanDosis?.name }} -
                    {{ option.bentukSediaan?.name }}
                    {{
                      option.manufacture ? `- ${option.manufacture.name}` : ""
                    }}
                  </template>
                </CustomSelect>
              </div>
              <div class="w-[12.5%] mx-[15px]">
                <CustomInputNumber
                  label="Jumlah Total"
                  v-model="field.value.jumlahTotal"
                  :show-buttons="true"
                />
              </div>
              <div class="h-10 w-[45px]">
                <CustomButton
                  label=""
                  backgroundColor="bg-danger-300 rounded-lg"
                  class="h-10 w-[45px] p-0"
                  @click="deleteObat(index)"
                  :disabled="index === 0"
                >
                  <img src="@/assets/icons/delete.svg" alt="" width="15px" />
                </CustomButton>
              </div>
            </div>
            <hr class="bg-grey-200 border-1" />
          </div>

          <div
            class="grid items-center justify-between grid-cols-4 gap-5 p-5 mt-5 rounded-lg bg-opensimrs-50"
          >
            <div class="col-span-2 font-semibold text-MD">
              Dibuat sebanyak (Embalase)
            </div>
            <div class="flex col-span-2 gap-5">
              <div class="w-1/4">
                <CustomInputNumber
                  label=""
                  v-model="medicationQty"
                  :show-buttons="true"
                  :invalid="!!errors.medicationQty"
                  :invalidMessage="errors.medicationQty"
                />
              </div>
              <div class="grow">
                <CustomSelect
                  label=""
                  placeHolder="Pilih bentuk embalase"
                  v-model="bentukRacikan"
                  :options="listBentukRacikan"
                  optionLabel="namaBentukRacikan"
                  optionValue=""
                  dataKey="uuid"
                  :invalid="!!errors.bentukRacikan"
                  :invalidMessage="errors.bentukRacikan"
                  :disabled="sirup"
                />
              </div>
            </div>
          </div>
          <div class="pt-5">
            <div class="flex flex-col gap-5">
              <div class="grid grid-cols-4 gap-5">
                <div class="flex col-span-2 gap-5">
                  <CustomSelect
                    label="Periode"
                    placeHolder="Pilih periode"
                    v-model="medicationPeriod"
                    :options="periodes"
                    class="w-1/4"
                    optionValue="periode"
                    optionLabel="periode"
                    :invalid="!!errors.medicationPeriod"
                    :invalidMessage="errors.medicationPeriod"
                  />
                  <CustomSelect
                    label="Aturan Pakai"
                    placeHolder="Pilih aturan pakai"
                    v-model="aturanPakai"
                    :options="aturanPakais"
                    class="grow"
                    optionLabel="name"
                    optionValue=""
                    dataKey="uuid"
                    :invalid="!!errors.aturanPakai"
                    :invalidMessage="errors.aturanPakai"
                  />
                </div>
                <div class="flex col-span-2 gap-5">
                  <CustomInputNumber
                    label="Jumlah Konsumsi"
                    v-model="medicationDoseQty"
                    class="w-1/4"
                    :show-buttons="true"
                    :invalid="!!errors.medicationDoseQty"
                    :invalidMessage="errors.medicationDoseQty"
                  />
                  <CustomSelect
                    label="Satuan Dosis"
                    placeHolder="Pilih satuan dosis"
                    v-model="medicationDoseSatuan"
                    :options="satuanDosiss"
                    class="grow"
                    optionLabel="name"
                    optionValue=""
                    dataKey="uuid"
                    :invalid="!!errors.medicationDoseSatuan"
                    :invalidMessage="errors.medicationDoseSatuan"
                  />
                </div>
              </div>
              <div class="flex gap-7">
                <div class="w-1/2">
                  <CustomSelect
                    label="Cara Pakai"
                    placeHolder="Pilih cara pakai"
                    v-model="caraPakai"
                    :options="caraPakais"
                    optionLabel="caraPakai"
                    optionValue=""
                    dataKey="uuid"
                    :invalid="!!errors.caraPakai"
                    :invalidMessage="errors.caraPakai"
                  />
                </div>
                <div class="w-1/2">
                  <CustomSelect
                    label="Rute Pemberian"
                    placeHolder="Pilih rute pemberian"
                    v-model="route"
                    :options="rutePemberians"
                    optionLabel="rutePemberian"
                    optionValue=""
                    dataKey="kode"
                    :invalid="!!errors.route"
                    :invalidMessage="errors.route"
                  />
                </div>
              </div>
              <div class="flex gap-7">
                <CustomSwitch v-if="fiturAktif('farmasi_obat_kronis')" label="Obat Kronis" v-model="isChronic" />
                <div class="grow">
                  <CustomTextArea
                    label="Catatan"
                    placeholder="Masukkan catatan"
                    v-model="prescriptionNotes"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="w-full">
        <div class="mt-5 flex justify-end gap-2.5">
          <CustomButton
            label="Reset"
            borderColor="border-2 border-[#9DA4B1]"
            background-color="bg-transparent"
            text-color="text-grey-300"
            @click="resetForm"
          >
          </CustomButton>
          <CustomButton
            label="Simpan Obat"
            v-if="props.title === 'Tambah Obat Racikan'"
            @click="onSubmit"
          >
          </CustomButton>
          <CustomButton label="Simpan Edit" v-else @click="onSubmit">
          </CustomButton>
        </div>
      </div>
    </template>
  </CustomDialog>
</template>