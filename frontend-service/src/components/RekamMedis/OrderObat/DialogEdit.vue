<script lang="ts" setup>
import { ref, watch, computed, onMounted } from "vue";
import { fiturAktif } from "@/stores/modulFaskes";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import DetailPasien from "./DetailPasien.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import { useFieldArray, useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { utilsStore } from "@/stores/utils";
import { useMedicalItemStore } from "@/stores/datamasterFarmasi/MedicalItem";
import { useHowToUseStore } from "@/stores/datamasterFarmasi/HowToUse";
import { useUnitStore } from "@/stores/datamasterFarmasi/Unit";
import { useRulesOfUseStore } from "@/stores/datamasterFarmasi/RulesOfUse";
import { useDoctorPrescriptionStore } from "@/stores/farmasi/DoctorPrescription";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import RiwayatSebelumnya from "./RiwayatSebelumnya.vue";

// NOTE Store
const storeUtils = utilsStore();
const medicalItemStore = useMedicalItemStore();
const rulesOfUseStore = useRulesOfUseStore();
const unitStore = useUnitStore();
const howToUseStore = useHowToUseStore();
const doctorPrescriptionStore = useDoctorPrescriptionStore();
const rekamMedisStore = useRekamMedisStore();

const props = defineProps({
  isDialogVisible: {
    default: false,
  },
  method: {
    type: String,
  },
  obatToEdit: Object,
  index: {
    type: Number,
    default: null,
  },
  patientData: {
    type: Object,
  },
  editedObatOrder: {
    type: Object,
    default: () => {},
  },
});

const emit = defineEmits(["update:isDialogVisible", "update-obat"]);

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

function updateVisibility(value: boolean) {
  emit("update:isDialogVisible", value);
  historyData.value = null;
  historyPageIndex.value = 0;
  detailedHistoryItem.value = null;
  filterJenisKunjungan.value = 'semua';
}
const obatData = ref({ ...props.obatToEdit });

watch(
  () => props.obatToEdit,
  (newVal: any) => {
    obatData.value = { ...newVal };
    setValues(newVal);
  }
);

const schema = toTypedSchema(
  yup.object({
    itemMedis: yup.mixed<any>().required("Nama Obat harus dipilih"),
    medicationQty: yup.number().required("Jumlah Total harus diisi").min(1),
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
  })
);

const { errors, handleSubmit, resetForm, defineField, setValues } = useForm({
  validationSchema: schema,
  initialValues: props.obatToEdit,
});

const [itemMedis] = defineField("itemMedis");
const [medicationQty] = defineField("medicationQty");
const [medicationPeriod] = defineField("medicationPeriod");
const [medicationDoseQty] = defineField("medicationDoseQty");
const [medicationDoseSatuan] = defineField("medicationDoseSatuan");
const [aturanPakai] = defineField("aturanPakai");
const [caraPakai] = defineField("caraPakai");
const [route] = defineField("route");
const [isChronic] = defineField("isChronic");
const [prescriptionNotes] = defineField("prescriptionNotes");

const onSubmit = handleSubmit(async (values: any) => {
  try {
    storeUtils.setLoading(true);
    let response = await doctorPrescriptionStore.updatePrescriptionObat(
      values.uuid,
      transformPayloadData(values)
    );
    if (response && response.data.sucess) {
      emit("update:isDialogVisible", false);
      emit("update-obat", values);
      resetForm();
    }
  } catch (error) {
    console.error("Failed to post data", error);
  } finally {
    storeUtils.setLoading(false);
  }
});

const transformPayloadData = (dataObat: any) => {
  return {
    type: "satuan",
    prescriptionUuid: props.editedObatOrder.uuid,
    itemMedisUuid: dataObat.itemMedis.uuid || "",
    medicationQty: dataObat.medicationQty || 1,
    medicationDoseQty: dataObat.medicationDoseQty || 1,
    medicationDoseSatuanUuid: dataObat.medicationDoseSatuan?.uuid || "",
    medicationPeriod: dataObat.medicationPeriod || "",
    aturanPakaiUuid: dataObat.aturanPakai?.uuid || "",
    caraPakaiUuid: dataObat.caraPakai?.uuid || "",
    prescriptionNotes: dataObat.prescriptionNotes || "",
    isChronic: dataObat.isChronic || false,
    route: dataObat.route?.kode || "",
  };
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
  if (
    !prescriptionUuidList ||
    !Array.isArray(prescriptionUuidList) ||
    prescriptionUuidList.length === 0
  ) {
    detailedHistoryItem.value = null;
    return;
  }

  storeUtils.setLoading(true);
  try {
    const detailPromises = prescriptionUuidList.map((uuid) =>
      doctorPrescriptionStore.detailApi(uuid)
    );
    const detailResponses = await Promise.all(detailPromises);
    const prescriptions = detailResponses
      .map((response) => {
        const detail = response?.payload;
        if (!detail) return null;
        return {
          data: detail.obatItems || [],
          meta: {
            petugasName: detail.dokterOrder || "N/A",
            createdAt: detail.orderDate,
            noResep: detail.noResep || "N/A",
            lokasiName: detail.lokasiStokNama || "N/A",
            isTakeaway: detail.isTakeaway || false,
          },
        };
      })
      .filter((p) => p !== null);

    detailedHistoryItem.value = {
      ...newHistoryItem,
      noPelayanan: newHistoryItem.noPelayanan || "N/A",
      prescriptions: prescriptions,
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
      storeUtils.setLoading(true);
      try {
        await Promise.all([
          getListObat(),
          getListAturanPakai(),
          getListSatuanDosis(),
          getListCaraPakai(),
          fetchRiwayatSebelumnya(),
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
    fullScreen
    :visible="isDialogVisible"
    headerBg="bg-opensimrs-300"
    @update:visible="updateVisibility"
  >
    <template #header>Edit Obat</template>
    <template #body>
      <div class="flex my-5 gap-7">
        <div class="min-w-[500px]">
          <DetailPasien :patientData="patientData" />
          <RiwayatSebelumnya
            v-if="patientData"
            :patientData="patientData"
            :historyItem="detailedHistoryItem" :filterJenisKunjungan="filterJenisKunjungan"
            :isLoading="storeUtils.isLoading"
            :canGoToPrevious="canGoToPrevious"
            :canGoToNext="canGoToNext"
            @update:filter="(val) => filterJenisKunjungan = val"
            @next="nextHistory"
            @previous="previousHistory"
          />
          </div>
        <hr class="min-h-[440px] border border-opensimrs-300" />
        <div class="grow">
          <Card
            pt:body:class="h-full p-0 overflow-auto"
            pt:content:class="h-full overflow-auto"
            pt:root:class="shadow shadow-inherit"
          >
            <template #header>
              <div class="flex items-center">
                <div class="font-semibold text-MD">Obat {{ index + 1 }}</div>
                </div>
              <hr class="my-4 bg-grey-200 border-1" />
            </template>
            <template #content>
              <div class="">
                <div class="flex flex-col gap-5">
                  <div class="flex gap-7">
                    <div class="grow">
                      <CustomSelect
                        label="Nama Obat"
                        placeHolder="Pilih obat"
                        v-model="itemMedis"
                        :options="namaObats"
                        optionLabel="name"
                        optionValue=""
                        dataKey="uuid"
                        :invalid="!!errors.itemMedis"
                        :invalidMessage="errors.itemMedis"
                      >
                        <template #customOptions="{ option }">
                          {{ option.name }} - {{ option.satuanDosis?.name }} -
                          {{ option.bentukSediaan?.name }}
                          {{
                            option.manufacture
                              ? `- ${option.manufacture.name}`
                              : ""
                          }}
                        </template>
                      </CustomSelect>
                    </div>
                    <div class="w-[12.5%]">
                      <CustomInputNumber
                        label="Jumlah Total"
                        :show-buttons="true"
                        v-model="medicationQty"
                        :invalid="!!(errors as any)[`datas[${index}].medicationQty`]"
                        :invalidMessage="(errors as any)[`datas[${index}].medicationQty`]"
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-4 gap-5">
                    <div class="flex col-span-2 gap-54">
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
                        :show-buttons="true"
                        v-model="medicationDoseQty"
                        class="w-1/4"
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
            </template>
          </Card>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="w-full">
        <hr class="-mx-5 border-grey-200" />
        <div class="mt-5 flex justify-end gap-2.5">
          <CustomButton
            label="Reset"
            borderColor="border-2 border-[#9DA4B1]"
            background-color="bg-transparent"
            text-color="text-grey-300"
          />
          <CustomButton label="Simpan" @click="onSubmit" />
        </div>
      </div>
    </template>
  </CustomDialog>
</template>