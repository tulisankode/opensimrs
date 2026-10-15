<script lang="ts" setup>
import { computed, onBeforeMount, ref, watch } from "vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import HistoriTriase from "@/components/RekamMedis/Triase/HistoriTriase.vue";
import { utilsStore } from "@/stores/utils";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import * as yup from "yup";
import { toTypedSchema } from "@vee-validate/yup";
import { useForm } from "vee-validate";
import { epochToDate } from "@/utils/Helpers";
import { PhCheckCircle, PhCaretLeft, PhCaretRight } from "@phosphor-icons/vue";

// NOTE Store
const storeUtils = utilsStore();
const rekamMedisStore = useRekamMedisStore();

const props = defineProps({
  method: {
    type: String,
    default: "form",
  },
  rmUuid: {
    type: String,
    default: "",
  },
  sessionUuid: {
    type: String,
    default: "",
  },
  patientData: {
    type: Object,
    default: () => ({}),
  },
});

const schema = computed(() =>
  toTypedSchema(
    yup.object({
      kasus: yup.string(),
      eye: yup.number(),
      verbal: yup.number(),
      motorik: yup.number(),
      gcsScore: yup.number(),
      gcsKesimpulan: yup.string(),
      tekananDarahSistole: yup.number(),
      tekananDarahDiastole: yup.number(),
      frekuensiNafas: yup.number(),
      frekuensiNadi: yup.number(),
      suhu: yup.number(),
      crt: yup.bool().default(false),
      bloodOxygen: yup.number(),
      kesimpulanTriase: yup.string(),
      warnaTriase: yup.string().default("#3D84E5"),
      caraDatang: yup.string(),
      kendaraan: yup.string(),
      keadaanUmum: yup.string(),
      asalRujukan: yup.string(),
      petugas: yup.string().default("Super Admin"),
    })
  )
);

const { handleSubmit, defineField, resetForm, setValues, errors } = useForm({
  validationSchema: schema,
});

const [kasus] = defineField("kasus");
const [eye] = defineField("eye");
const [verbal] = defineField("verbal");
const [motorik] = defineField("motorik");
const [gcsScore] = defineField("gcsScore");
const [gcsKesimpulan] = defineField("gcsKesimpulan");
const [tekananDarahSistole] = defineField("tekananDarahSistole");
const [tekananDarahDiastole] = defineField("tekananDarahDiastole");
const [frekuensiNafas] = defineField("frekuensiNafas");
const [frekuensiNadi] = defineField("frekuensiNadi");
const [suhu] = defineField("suhu");
const [crt] = defineField("crt");
const [bloodOxygen] = defineField("bloodOxygen");
const [kesimpulanTriase] = defineField("kesimpulanTriase");
const [warnaTriase] = defineField("warnaTriase");
const [caraDatang] = defineField("caraDatang");
const [kendaraan] = defineField("kendaraan");
const [keadaanUmum] = defineField("keadaanUmum");
const [asalRujukan] = defineField("asalRujukan");
const [petugas] = defineField("petugas");

const onSubmit = handleSubmit(async (values: any) => {
  try {
    storeUtils.setLoading(true);
    const response = await rekamMedisStore.insertAssesment({
      sessionUuid: props.sessionUuid,
      rekamMedisUuid: props.rmUuid,
      isLatest: rekamMedisStore.openedRekamMedis.isLatest,
      key: "triase",
      data: values,
    });
    if (response && response.payload) {
      rekamMedisStore.setAsesmentSummaryRekamMedisData(response.payload);
    }
  } catch (error) {
    console.error("Failed to post data", error);
  } finally {
    storeUtils.setLoading(false);
  }
});

const listKasus = ref([
  { name: "Trauma" },
  { name: "Non Trauma" },
  { name: "Obstetri" },
]);
const listCaraDatang = ref([
  { name: "Sendiri" },
  { name: "Diantar Polisi" },
  { name: "Diantar Keluarga" },
  { name: "Lain - Lain" },
]);
const listKendaraan = ref([{ name: "Ambulans" }, { name: "Lain - Lain" }]);
const listKeadaanUmum = ref([
  { name: "Baik" },
  { name: "Ringan" },
  { name: "Sedang" },
  { name: "Buruk" },
]);
const listMata = ref([
  { name: "Spontan Merespon", id: 1 },
  { name: "Ada Respon Dengan Rangsang Suara", id: 2 },
  { name: "Ada Respon Dengan Rangsang Nyeri", id: 3 },
  { name: "Tidak Ada Respon", id: 4 },
]);
const listMotorik = ref([
  { name: "Mengikuti Perintah", id: 1 },
  { name: "Melokalisir Nyeri", id: 2 },
  { name: "Flexi Normal", id: 3 },
  { name: "Flexi Abnormal", id: 4 },
  { name: "Ekstensi Abnormal", id: 5 },
  { name: "Tidak Ada Respon", id: 6 },
]);
const listVerbal = ref([
  { name: "Orientasi Balik", id: 1 },
  { name: "Binging Berbicara", id: 2 },
  { name: "Kata - Kata Tidak Jelas", id: 3 },
  { name: "Suara Tanpa Arti (Mengerang)", id: 4 },
  { name: "Tidak Ada Respon", id: 5 },
]);

const listGlasglow = ref([
  { name: "Glasglow 1" },
  { name: "Glasglow 2" },
  { name: "Glasglow 3" },
  { name: "Glasglow 4" },
]);

const emit = defineEmits(["editAsesmen"]);

const setFormData = () => {
  if (rekamMedisStore.openedRekamMedis.data.triase) {
    const tempTriase = rekamMedisStore.openedRekamMedis.data.triase;
    setValues({
      kasus: tempTriase.kasus,
      eye: tempTriase.eye,
      verbal: tempTriase.verbal,
      motorik: tempTriase.motorik,
      gcsScore: tempTriase.gcsScore,
      tekananDarahSistole: tempTriase.tekananDarahSistole,
      tekananDarahDiastole: tempTriase.tekananDarahDiastole,
      frekuensiNafas: tempTriase.frekuensiNafas,
      frekuensiNadi: tempTriase.frekuensiNadi,
      suhu: tempTriase.suhu,
      crt: tempTriase.crt,
      bloodOxygen: tempTriase.bloodOxygen,
      kesimpulanTriase: tempTriase.kesimpulanTriase,
      warnaTriase: tempTriase.warnaTriase,
      caraDatang: tempTriase.caraDatang,
      kendaraan: tempTriase.kendaraan,
      keadaanUmum: tempTriase.keadaanUmum,
      asalRujukan: tempTriase.asalRujukan,
      petugas: tempTriase.petugas,
    });
    countKesimpulan();
  } else {
    resetForm();
  }
};

onBeforeMount(() => {
  setFormData();
});

const storedRMData = computed(() => rekamMedisStore.openedRekamMedis);
watch(storedRMData, (newRM) => {
  setFormData();
});

const countKesimpulan = () => {
  if (eye.value && motorik.value && verbal.value) {
    gcsKesimpulan.value = "";
    let totalSkor = eye.value + motorik.value + verbal.value;
    gcsScore.value = totalSkor;
    if (totalSkor == 3) {
      gcsKesimpulan.value = "Coma";
    } else if (totalSkor == 4) {
      gcsKesimpulan.value = "Semi-coma";
    } else if (totalSkor == 5 || totalSkor == 6) {
      gcsKesimpulan.value = "Sopor";
    } else if (totalSkor > 6 && totalSkor <= 9) {
      gcsKesimpulan.value = "Somnolence";
    } else if (totalSkor == 10 || totalSkor == 11) {
      gcsKesimpulan.value = "Delirium";
    } else if (totalSkor == 12 || totalSkor == 13) {
      gcsKesimpulan.value = "Apatis";
    } else if (totalSkor == 14 || totalSkor == 15) {
      gcsKesimpulan.value = "Compos Mentis";
    }
  }
};

// === LOGIC COMPARE ===
const compareDialog = ref(false);
const historyData = ref<Array<any> | null>(null);
const historyPageIndex = ref(0);
const filterOptions = ref([
  { name: "Semua", value: "semua" },
  { name: "RJ", value: "rj" },
  { name: "RI", value: "ri" },
  { name: "IGD", value: "igd" },
]);
const selectedFilter = ref("semua");

const fetchHistoryData = async () => {
  try {
    storeUtils.setLoading(true);
    const openedRekamMedis = rekamMedisStore.openedRekamMedis;
    const selectedDate = openedRekamMedis.dates?.find((d: { isSelected: any; }) => d.isSelected)?.date;
    const selectedSessionOrder = openedRekamMedis.sessions?.find((s: { isSelected: any; }) => s.isSelected)?.order;

    const response = await rekamMedisStore.getCompare({
      noPelayanan: props.patientData?.noPelayanan || props.patientData?.no_pelayanan,
      noRm: props.patientData?.patient?.noRm,
      key: "triase",
      jenisKunjungan: selectedFilter.value === 'semua' ? '' : selectedFilter.value,
      dateFilter: selectedDate,
      sessionOrder: selectedSessionOrder,
    });

    if (response && response.payload) {
      historyData.value = response.payload;
      historyPageIndex.value = 0;
    } else {
      historyData.value = null;
    }
  } catch (error) {
    console.error("Gagal mengambil data compare:", error);
    historyData.value = null;
  } finally {
    storeUtils.setLoading(false);
  }
};

const showDialogCompare = async () => {
  await fetchHistoryData();
  compareDialog.value = true;
};

watch(selectedFilter, async (newValue, oldValue) => {
    if (compareDialog.value && newValue !== oldValue) {
        await fetchHistoryData();
    }
});

// === BAGIAN YANG HILANG SEBELUMNYA (COMPUTED ITEMS) ===
const leftHistoryItem = computed(() => {
  if (!historyData.value || !historyData.value[historyPageIndex.value]) return null;
  return historyData.value[historyPageIndex.value];
});

const rightHistoryItem = computed(() => {
  if (!historyData.value || !historyData.value[historyPageIndex.value + 1]) return null;
  return historyData.value[historyPageIndex.value + 1];
});

const canGoToPrevious = computed(() => historyPageIndex.value > 0);

const canGoToNext = computed(() => {
  if (!historyData.value) return false;
  return historyPageIndex.value + 2 < historyData.value.length;
});

const previousHistory = () => {
  if (canGoToPrevious.value) {
    historyPageIndex.value -= 2;
  }
};

const nextHistory = () => {
  if (canGoToNext.value) {
    historyPageIndex.value += 2;
  }
};
// =====================================================

const accordion = ref<HTMLCanvasElement | null>(null);
const open = () => {
  if (accordion.value) {
    (accordion.value as any).open();
  }
};
const close = () => {
  if (accordion.value) {
    (accordion.value as any).close();
  }
};

defineExpose({
  open,
  close,
});
</script>

<template>
  <CustomAccordion ref="accordion" headerClass="bg-opensimrs-50">
    <template #header> Triase</template>
    <template #content>
      <div v-if="props.method == 'form'">
        <div class="flex flex-col">
          <CustomButton
            @click="showDialogCompare"
            class="!rounded-md my-[10px] ml-auto"
            label="Mode Compare"
            size="small"
            icon="LayoutIcon"
          />
          <hr class="mb-[30px]" />
        </div>
        <div class="grid grid-cols-4 gap-[30px] py-3">
          <CustomSelect
            label="Kasus"
            v-model="kasus"
            :options="listKasus"
            option-label="name"
            option-value="name"
            invalidMessage="Wajib diisi"
            :disabled="false"
            placeHolder="Pilih Kasus"
            customSelectClass="border-[#C7CBD2]"
            class="col-span-4"
          />
          <CustomSelect
            label="Cara Datang"
            v-model="caraDatang"
            :options="listCaraDatang"
            option-label="name"
            option-value="name"
            invalidMessage="Wajib diisi"
            :disabled="false"
            placeHolder="Pilih Cara Datang"
            customSelectClass="border-[#C7CBD2]"
            class="col-span-2"
          />
          <CustomSelect
            label="Kendaraan"
            v-model="kendaraan"
            :options="listKendaraan"
            option-label="name"
            option-value="name"
            invalidMessage="Wajib diisi"
            :disabled="false"
            placeHolder="Pilih Kendaraan"
            customSelectClass="border-[#C7CBD2]"
            class="col-span-2"
          />
          <CustomSelect
            label="Keadaan Umum"
            v-model="keadaanUmum"
            :options="listKeadaanUmum"
            option-label="name"
            option-value="name"
            invalidMessage="Wajib diisi"
            :disabled="false"
            placeHolder="Pilih Keadaan Umum"
            customSelectClass="border-[#C7CBD2]"
            class="col-span-2"
          />
          <CustomTextfield
            label="Asal Rujukan"
            placeholder="Asal Rujukan"
            v-model:modelValue="asalRujukan"
            class="col-span-2"
          />
          <hr class="col-span-4" />
          <CustomSelect
            label="Mata (Respon Membuka Mata)"
            v-model="eye"
            @update:model-value="countKesimpulan"
            :options="listMata"
            option-label="name"
            option-value="id"
            invalidMessage="Wajib diisi"
            :disabled="false"
            placeHolder="Pilih Respon"
            customSelectClass="border-[#C7CBD2]"
          />
          <CustomSelect
            label="Motorik (Respon Gerakan)"
            v-model="motorik"
            @update:model-value="countKesimpulan"
            :options="listMotorik"
            option-label="name"
            option-value="id"
            invalidMessage="Wajib diisi"
            :disabled="false"
            placeHolder="Pilih Respon"
            customSelectClass="border-[#C7CBD2]"
          />
          <CustomSelect
            label="Verbal (Respon Verbal)"
            v-model="verbal"
            @update:model-value="countKesimpulan"
            :options="listVerbal"
            option-label="name"
            option-value="id"
            invalidMessage="Wajib diisi"
            :disabled="false"
            placeHolder="Pilih Respon"
            customSelectClass="border-[#C7CBD2]"
          />
          <CustomTextfield
            v-model="gcsKesimpulan"
            label="Glasglow Coma Scale (GCS) Score"
            placeholder="Glasglow Coma Scale (GCS) Score"
            class=""
            readOnly
          />
          <div
            class="grid items-center grid-cols-[2fr_min-content_2fr] col-span-2"
          >
            <CustomInputNumber
              label="Tekanan Darah (Sistole / Diastole)"
              placeholder="0"
              v-model:modelValue="tekananDarahSistole"
              type="number"
            />
            <span class="text-opensimrs-300 mx-[30px] mt-auto mb-2">/</span>
            <CustomInputNumber
              label="Diastole"
              placeholder="0"
              v-model:modelValue="tekananDarahDiastole"
              type="number"
            >
              <template #appendText>
                <div class="flex items-center mr-2">mmHg</div>
              </template>
            </CustomInputNumber>
          </div>
          <CustomInputNumber
            label="Frekuensi Nafas"
            placeholder="0"
            v-model:modelValue="frekuensiNafas"
            type="number"
          >
            <template #appendText>
              <div class="flex items-center mr-2">x/mnt</div>
            </template>
          </CustomInputNumber>
          <CustomInputNumber
            label="Frekuensi Nadi"
            placeholder="0"
            v-model:modelValue="frekuensiNadi"
            type="number"
          >
            <template #appendText>
              <div class="flex items-center mr-2">x/mnt</div>
            </template>
          </CustomInputNumber>
        </div>
        <div class="grid grid-cols-3 gap-[30px] py-3">
          <CustomSwitch
            v-model="crt"
            label=" Capillary Refill Time (CRT > 2 Detik)"
          />
          <CustomInputNumber
            label="Suhu"
            placeholder="0"
            v-model:modelValue="suhu"
            type="number"
          >
            <template #appendText>
              <div class="flex items-center mr-2">°C</div>
            </template>
          </CustomInputNumber>
          <CustomInputNumber
            label="Blood Oxygen"
            placeholder="0"
            v-model:modelValue="bloodOxygen"
            type="number"
          >
            <template #appendText>
              <div class="flex items-center mr-2">%</div>
            </template>
          </CustomInputNumber>
          <hr class="col-span-3" />
        </div>
        <div class="flex gap-[24px] py-3">
          <CustomTextfield
            v-model="kesimpulanTriase"
            label="Kesimpulan Triase"
            placeholder="Kesimpulan Triase"
            class="grow"
          />
          <div
            @click="warnaTriase = '#3D84E5'"
            class="h-10 w-[60px] border border-grey-200 cursor-pointer bg-info-300 rounded-md mt-auto flex"
          >
            <PhCheckCircle
              v-if="warnaTriase == '#3D84E5'"
              :size="25"
              weight="fill"
              class="m-auto text-white"
            />
          </div>
          <div
            @click="warnaTriase = '#E9594C'"
            class="h-10 w-[60px] border border-grey-200 cursor-pointer bg-danger-300 rounded-md mt-auto flex"
          >
            <PhCheckCircle
              v-if="warnaTriase == '#E9594C'"
              :size="25"
              weight="fill"
              class="m-auto text-white"
            />
          </div>
          <div
            @click="warnaTriase = '#E89F29'"
            class="h-10 w-[60px] border border-grey-200 cursor-pointer bg-warning-300 rounded-md mt-auto flex"
          >
            <PhCheckCircle
              v-if="warnaTriase == '#E89F29'"
              :size="25"
              weight="fill"
              class="m-auto text-white"
            />
          </div>
          <div
            @click="warnaTriase = '#14AC5B'"
            class="h-10 w-[60px] border border-grey-200 cursor-pointer bg-success-300 rounded-md mt-auto flex"
          >
            <PhCheckCircle
              v-if="warnaTriase == '#14AC5B'"
              :size="25"
              weight="fill"
              class="m-auto text-white"
            />
          </div>
          <div
            @click="warnaTriase = '#FFFFFF'"
            class="h-10 w-[60px] border border-grey-200 cursor-pointer bg-white rounded-md mt-auto flex"
          >
            <PhCheckCircle
              v-if="warnaTriase == '#FFFFFF'"
              :size="25"
              weight="fill"
              class="m-auto text-black"
            />
          </div>
          <div
            @click="warnaTriase = '#000000'"
            class="h-10 w-[60px] border border-grey-200 cursor-pointer bg-black rounded-md mt-auto flex"
          >
            <PhCheckCircle
              v-if="warnaTriase == '#000000'"
              :size="25"
              weight="fill"
              class="m-auto text-white"
            />
          </div>
        </div>
      </div>

      <div
        v-if="props.method == 'detail'"
        class="py-5 flex flex-col gap-[19px]"
      >
        <CustomInfoRow label="Kasus" :value="kasus" />
        <CustomInfoRow label="Cara Datang" :value="caraDatang" />
        <CustomInfoRow label="Kendaraan" :value="kendaraan" />
        <CustomInfoRow label="Keadaan Umum" :value="keadaanUmum" />
        <CustomInfoRow label="Asal Rujukan" :value="asalRujukan" />
        <hr class="border-grey-200" />
        <CustomInfoRow label="Mata" :value="`${eye}`" />
        <CustomInfoRow label="Motorik" :value="`${motorik}`" />
        <CustomInfoRow label="Verbal" :value="`${verbal}`" />
        <CustomInfoRow
          label="Glasglow Coma Scale (GCS) Score"
          :value="`${gcsScore}`"
        />
        <CustomInfoRow
          label="Glasglow Coma Scale (GCS) Kesimpulan"
          :value="`${gcsKesimpulan}`"
        />
        <CustomInfoRow
          label="Tekanan Darah"
          :value="`${tekananDarahSistole}/${tekananDarahDiastole} mmHg`"
        />
        <CustomInfoRow
          label="Frekuensi Nafas"
          :value="`${frekuensiNafas} x/mnt`"
        />
        <CustomInfoRow
          label="Frekuensi Nadi"
          :value="`${frekuensiNadi} x/mnt`"
        />
        <CustomInfoRow
          label="Capillary Refill Time (CRT > 2 detik)"
          :value="crt ? 'Iya' : 'Tidak'"
        />
        <CustomInfoRow label="Suhu" :value="`${suhu} °C`" />
        <CustomInfoRow label="Blood Oxygen" :value="`${bloodOxygen} %`" />
        <hr class="border-grey-200" />
        <CustomInfoRow label="Kesimpulan Triase" :value="kesimpulanTriase" />
        <div
          class="h-10 w-[60px] border border-grey-200 cursor-pointer rounded-md mt-auto flex"
          :style="{ backgroundColor: warnaTriase }"
        >
          <PhCheckCircle
            :size="25"
            weight="fill"
            :class="`m-auto ${
              warnaTriase == '#FFFFFF' ? 'text-black' : 'text-white'
            }`"
          />
        </div>
        <hr class="border-grey-200" />
        <div class="flex justify-between">
          <CustomInfoRow label="Petugas Input" :value="petugas" />
          <CustomInfoRow
            label="Jam Input"
            :value="`${epochToDate(
              rekamMedisStore.openedRekamMedis.data.triase.updatedAt,
              'time'
            )}`"
            alignment="right"
          />
        </div>
      </div>

      <CustomDialog
        class=""
        v-model:visible="compareDialog"
        width="80%"
        noScroll
      >
        <template #header>Triase</template>
        <template #body>
          <div class="pt-5 grid grid-cols-[1fr_min-content_1fr] overflow-auto">
            <div class="flex flex-col overflow-auto pr-4">
              <div class="mb-[18px] flex justify-between items-center">
                <div class="font-semibold text-grey-400">
                  Riwayat Sebelumnya
                </div>
                <div class="flex items-center">
                  <CustomSelect
                    v-model="selectedFilter"
                    :options="filterOptions"
                    optionLabel="name"
                    optionValue="value"
                    :show-label="false"
                    class="w-40 mr-4"
                  />
                  <CustomButton
                    @click="previousHistory"
                    :disabled="!canGoToPrevious"
                    class="!rounded-md mr-[10px]"
                    size="small"
                    icon="PhCaretLeft"
                  />
                  <CustomButton
                    @click="nextHistory"
                    :disabled="!canGoToNext"
                    class="!rounded-md"
                    size="small"
                    icon="PhCaretRight"
                  />
                </div>
              </div>
              <div class="grid grid-cols-[1fr_min-content_1fr] grow overflow-auto gap-x-4">
              <HistoriTriase v-if="leftHistoryItem" :history="leftHistoryItem" />
              <div v-else class="text-center text-grey-400 self-start pt-4 whitespace-nowrap">Tidak ada riwayat.</div>

              <div v-if="rightHistoryItem" class="border border-opensimrs-300"></div>

              <HistoriTriase v-if="rightHistoryItem" :history="rightHistoryItem" />
              <div v-else class="text-center text-grey-400 self-start pt-4 whitespace-nowrap">Tidak ada riwayat.</div>
            </div>
            </div>
            <div class="border border-opensimrs-300 mx-[15px]"></div>
            <div class="flex flex-col overflow-hidden">
              <div class="flex flex-col pb-1 overflow-auto gap-y-5 grow">
                <CustomSelect
                  label="Kasus"
                  v-model="kasus"
                  :options="listKasus"
                  option-label="name"
                  option-value="name"
                  invalidMessage="Wajib diisi"
                  :disabled="false"
                  placeHolder="Pilih Kasus"
                  customSelectClass="border-[#C7CBD2]"
                  class="col-span-4"
                />
                <CustomSelect
                  label="Cara Datang"
                  v-model="caraDatang"
                  :options="listCaraDatang"
                  option-label="name"
                  option-value="name"
                  invalidMessage="Wajib diisi"
                  :disabled="false"
                  placeHolder="Pilih Cara Datang"
                  customSelectClass="border-[#C7CBD2]"
                  class="col-span-2"
                />
                <CustomSelect
                  label="Kendaraan"
                  v-model="kendaraan"
                  :options="listKendaraan"
                  option-label="name"
                  option-value="name"
                  invalidMessage="Wajib diisi"
                  :disabled="false"
                  placeHolder="Pilih Kendaraan"
                  customSelectClass="border-[#C7CBD2]"
                  class="col-span-2"
                />
                <CustomSelect
                  label="Keadaan Umum"
                  v-model="keadaanUmum"
                  :options="listKeadaanUmum"
                  option-label="name"
                  option-value="name"
                  invalidMessage="Wajib diisi"
                  :disabled="false"
                  placeHolder="Pilih Keadaan Umum"
                  customSelectClass="border-[#C7CBD2]"
                  class="col-span-2"
                />
                <CustomTextfield
                  label="Asal Rujukan"
                  placeholder="Asal Rujukan"
                  v-model:modelValue="asalRujukan"
                  class="col-span-2"
                />
                <hr class="col-span-4" />
                <CustomSelect
                  label="Mata (Respon Membuka Mata)"
                  v-model="eye"
                  @update:model-value="countKesimpulan"
                  :options="listMata"
                  option-label="name"
                  option-value="id"
                  invalidMessage="Wajib diisi"
                  :disabled="false"
                  placeHolder="Pilih Respon"
                  customSelectClass="border-[#C7CBD2]"
                />
                <CustomSelect
                  label="Motorik (Respon Gerakan)"
                  v-model="motorik"
                  @update:model-value="countKesimpulan"
                  :options="listMotorik"
                  option-label="name"
                  option-value="id"
                  invalidMessage="Wajib diisi"
                  :disabled="false"
                  placeHolder="Pilih Respon"
                  customSelectClass="border-[#C7CBD2]"
                />
                <CustomSelect
                  label="Verbal (Respon Verbal)"
                  v-model="verbal"
                  @update:model-value="countKesimpulan"
                  :options="listVerbal"
                  option-label="name"
                  option-value="id"
                  invalidMessage="Wajib diisi"
                  :disabled="false"
                  placeHolder="Pilih Respon"
                  customSelectClass="border-[#C7CBD2]"
                />
                <CustomTextfield
                  v-model="gcsKesimpulan"
                  label="Glasglow Coma Scale (GCS) Score"
                  placeholder="Glasglow Coma Scale (GCS) Score"
                  class=""
                  readOnly
                />
                <div class="grid grid-cols-2 gap-x-[30px]">
                  <div
                    class="grid items-center grid-cols-[2fr_min-content_2fr]"
                  >
                    <label
                      class="block font-semibold mb-[5px] text-normal col-span-3"
                    >
                      Tekanan Darah (Sistole / Diastole)
                    </label>
                    <CustomInputNumber
                      :showLabel="false"
                      placeholder="0"
                      v-model:modelValue="tekananDarahSistole"
                      type="number"
                    />
                    <span class="text-opensimrs-300 mx-[30px] mt-auto mb-2"
                      >/</span
                    >
                    <CustomInputNumber
                      :showLabel="false"
                      placeholder="0"
                      v-model:modelValue="tekananDarahDiastole"
                      type="number"
                    >
                      <template #appendText>
                        <div class="flex items-center mr-2">mmHg</div>
                      </template>
                    </CustomInputNumber>
                  </div>
                  <CustomInputNumber
                    label="Frekuensi Nafas"
                    placeholder="0"
                    v-model:modelValue="frekuensiNafas"
                    type="number"
                  >
                    <template #appendText>
                      <div class="flex items-center mr-2">x/mnt</div>
                    </template>
                  </CustomInputNumber>
                </div>
                <div class="grid grid-cols-2 gap-x-[30px] gap-y-5">
                  <CustomInputNumber
                    label="Frekuensi Nadi"
                    placeholder="0"
                    v-model:modelValue="frekuensiNadi"
                    type="number"
                  >
                    <template #appendText>
                      <div class="flex items-center mr-2">x/mnt</div>
                    </template>
                  </CustomInputNumber>
                  <CustomSwitch
                    v-model="crt"
                    label=" Capillary Refill Time (CRT > 2 Detik)"
                  />
                  <CustomInputNumber
                    label="Suhu"
                    placeholder="0"
                    v-model:modelValue="suhu"
                    type="number"
                  >
                    <template #appendText>
                      <div class="flex items-center mr-2">°C</div>
                    </template>
                  </CustomInputNumber>
                  <CustomInputNumber
                    label="Blood Oxygen"
                    placeholder="0"
                    v-model:modelValue="bloodOxygen"
                    type="number"
                  >
                    <template #appendText>
                      <div class="flex items-center mr-2">%</div>
                    </template>
                  </CustomInputNumber>
                  <hr class="col-span-2" />
                  <CustomTextfield
                    v-model="kesimpulanTriase"
                    label="Kesimpulan Triase"
                    placeholder="Kesimpulan Triase"
                    class="col-span-2 grow"
                  />
                </div>
                <div class="flex gap-[24px] py-3">
                  <div
                    @click="warnaTriase = '#3D84E5'"
                    class="h-10 w-[60px] border border-grey-200 cursor-pointer bg-info-300 rounded-md mt-auto flex"
                  >
                    <PhCheckCircle
                      v-if="warnaTriase == '#3D84E5'"
                      :size="25"
                      weight="fill"
                      class="m-auto text-white"
                    />
                  </div>
                  <div
                    @click="warnaTriase = '#E9594C'"
                    class="h-10 w-[60px] border border-grey-200 cursor-pointer bg-danger-300 rounded-md mt-auto flex"
                  >
                    <PhCheckCircle
                      v-if="warnaTriase == '#E9594C'"
                      :size="25"
                      weight="fill"
                      class="m-auto text-white"
                    />
                  </div>
                  <div
                    @click="warnaTriase = '#E89F29'"
                    class="h-10 w-[60px] border border-grey-200 cursor-pointer bg-warning-300 rounded-md mt-auto flex"
                  >
                    <PhCheckCircle
                      v-if="warnaTriase == '#E89F29'"
                      :size="25"
                      weight="fill"
                      class="m-auto text-white"
                    />
                  </div>
                  <div
                    @click="warnaTriase = '#14AC5B'"
                    class="h-10 w-[60px] border border-grey-200 cursor-pointer bg-success-300 rounded-md mt-auto flex"
                  >
                    <PhCheckCircle
                      v-if="warnaTriase == '#14AC5B'"
                      :size="25"
                      weight="fill"
                      class="m-auto text-white"
                    />
                  </div>
                  <div
                    @click="warnaTriase = '#FFFFFF'"
                    class="h-10 w-[60px] border border-grey-200 cursor-pointer bg-white rounded-md mt-auto flex"
                  >
                    <PhCheckCircle
                      v-if="warnaTriase == '#FFFFFF'"
                      :size="25"
                      weight="fill"
                      class="m-auto text-black"
                    />
                  </div>
                  <div
                    @click="warnaTriase = '#000000'"
                    class="h-10 w-[60px] border border-grey-200 cursor-pointer bg-black rounded-md mt-auto flex"
                  >
                    <PhCheckCircle
                      v-if="warnaTriase == '#000000'"
                      :size="25"
                      weight="fill"
                      class="m-auto text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
        <template #footer>
          <div class="flex items-end justify-end gap-3">
            <CustomButton
              v-if="props.method == 'form'"
              label="Reset"
              @click="resetForm"
              textColor="text-grey-300"
              backgroundColor="bg-transparent"
              borderColor="border-2 border-grey-200"
            />
            <CustomButton
              v-if="method === 'form'"
              label="Simpan"
              @click="onSubmit"
            />
            <CustomButton
              v-if="method === 'detail'"
              label="Edit"
              @click="emit('editAsesmen')"
            />
          </div>
        </template>
      </CustomDialog>
    </template>
    <template #footer>
      <div class="flex items-end justify-end gap-3">
        <CustomButton
          v-if="props.method == 'form'"
          @click="resetForm"
          label="Reset"
          textColor="text-[#9DA4B1]"
          backgroundColor="bg-transparent"
          borderColor="border-2 border-[#9DA4B1]"
        />
        <CustomButton
          v-if="props.method == 'form'"
          @click="onSubmit"
          label="Simpan"
        />
        <CustomButton
          v-if="props.method == 'detail'"
          @click="emit('editAsesmen')"
          label="Edit"
        />
      </div>
    </template>
  </CustomAccordion>
</template>