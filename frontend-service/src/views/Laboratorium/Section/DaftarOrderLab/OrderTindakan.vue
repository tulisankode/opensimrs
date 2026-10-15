<script lang="ts" setup>
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import type { MenuItem } from "primevue/menuitem";
import { onMounted, computed, ref, type PropType, watch } from "vue";
import { useForm, ErrorMessage } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomCheckbox from "@/components/Base/CustomCheckbox.vue";
import { useOrderLab } from "@/stores/Laboratorium/orderLab";
import { utilsStore } from "@/stores/utils";
import { epochToDate, getDateNow, dateToEpoch } from "@/utils/Helpers";

const props = defineProps({
  pageType: {
    type: String,
    required: true,
  },
  dataBreadCrumb: {
    type: Array as PropType<MenuItem[]>,
    default: () => [],
  },
  initialData: {
    type: Object as PropType<any>,
    default: () => ({}),
  },
});

// Data state
const categories = ref<any[]>([]);
const nonCategories = ref<any[]>([]);
const selectedTarifs = ref<Record<string, boolean>>({});
const allTarifsMap = ref<Record<string, any>>({});

const orderLabStore = useOrderLab();
const storeUtils = utilsStore();

const schema = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // set jam ke 00:00:00

  return toTypedSchema(
    yup
      .object({
        tglPemeriksaan: yup
          .date()
          .required("Tanggal pemeriksaan harus diisi")
          .min(today, "Tanggal tidak boleh kurang dari hari ini")
          .default(new Date()),
        cito: yup.boolean().default(false),
        statusPuasa: yup.boolean().default(false),
        tarifLabUuids: yup
          .array()
          .of(yup.string().required())
          .min(1, "Pilih minimal satu pemeriksaan")
          .required(),
        isMcu: yup.boolean().default(false),
      })
      .noUnknown()
  );
});

const { errors, handleSubmit, defineField, setFieldValue } = useForm({
  validationSchema: schema,
});

// Define fields
const [tglPemeriksaan] = defineField("tglPemeriksaan");
const [cito] = defineField("cito");
const [statusPuasa] = defineField("statusPuasa");
const [tarifLabUuids] = defineField("tarifLabUuids");
const [isMcu] = defineField("isMcu");

const fetchTarif = async () => {
  storeUtils.setLoading(true);
  try {
    const response = await orderLabStore.getActive();
    if (response.payload) {
      categories.value = response.payload.category || [];
      nonCategories.value = response.payload.nonCategory || [];
      const newAllTarifsMap: Record<string, any> = {};

      // Process categories
      categories.value.forEach((category) => {
        category.tarifLab.forEach((tarif: any) => {
          selectedTarifs.value[tarif.code] = false;
          newAllTarifsMap[tarif.code] = tarif;
        });
      });

      // Process non-categories
      nonCategories.value.forEach((tarif) => {
        selectedTarifs.value[tarif.code] = false;
        newAllTarifsMap[tarif.code] = tarif;
      });

      allTarifsMap.value = newAllTarifsMap;
      setFieldValue("tarifLabUuids", []);
    }
  } catch (error) {
    console.error("Error fetching tarif:", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

watch(
  selectedTarifs,
  (newVal) => {
    const selectedUuids = Object.keys(newVal)
      .filter((code) => newVal[code])
      .map((code) => allTarifsMap.value[code]?.uuid)
      .filter(Boolean);
    console.log("newVal", newVal);
    console.log("selectedUuids", selectedUuids);
    console.log("all tarif", allTarifsMap.value);
    setFieldValue("tarifLabUuids", selectedUuids);
  },
  { deep: true }
);

const setForm = (patientData: any) => {
  if (patientData.tglPemeriksaan) {
    setFieldValue(
      "tglPemeriksaan",
      new Date(parseInt(patientData.tglPemeriksaan) * 1000)
    );
  }
  setFieldValue("cito", patientData.cito || false);
  setFieldValue("statusPuasa", patientData.statusPuasa || false);
  setFieldValue("isMcu", patientData.isMcu || false);

  if (
    patientData.orderLabPemeriksaan &&
    patientData.orderLabPemeriksaan.length > 0
  ) {
    const codesYangAda = patientData.orderLabPemeriksaan.map(
      (item: any) => item.tarifLab.code
    );
    console.log("selectedTarifs", selectedTarifs.value);
    const tempSelectedData = JSON.parse(JSON.stringify(selectedTarifs.value));
    codesYangAda.forEach((code: string) => {
      console.log(code);
      console.log(selectedTarifs.value[code]);

      tempSelectedData[code] = true;
    });
    console.log("akhir", tempSelectedData);

    selectedTarifs.value = JSON.parse(JSON.stringify(tempSelectedData));
    console.log("selectedTarifs after setForm:", selectedTarifs.value);
  }
};

const onSubmit = handleSubmit(async (values) => {
  const modifiedValues = {
    ...values,
    // tglPemeriksaan: dateToEpoch(values.tglPemeriksaan),
    tglPemeriksaan: String(dateToEpoch(values.tglPemeriksaan)),
  };
  return modifiedValues;
});

onMounted(async () => {
  await fetchTarif();
  if (props.initialData && props.initialData.uuid) {
    await fetchTarif();
    setForm(props.initialData);
  }
});

defineExpose({
  onSubmit,
  setForm,
});

// Helper function to group categories by their names
const groupedCategories = (categoryName: string) => {
  return categories.value.filter((cat) => cat.name.includes(categoryName));
};
</script>

<template>
  <CustomAccordion :openWithHeader="false" class="mt-[10px]" initialState="0">
    <template #header>
      <div class="flex justify-between w-full align-middle">
        <div class="flex">
          <span class="leading-10 text-opensimrs-300 text-heading">
            Order Lab
          </span>
        </div>
      </div>
    </template>
    <template #content>
      <div class="pt-5 grid grid-cols-[40%_40%_20%] gap-4">
        <div>
          <CustomDatePicker
            v-model="tglPemeriksaan"
            label="Tanggal"
            class="mr-[20px]"
            :error="errors.tglPemeriksaan"
          />
          <ErrorMessage name="tglPemeriksaan" class="text-sm text-red-500" />
        </div>
        <div>
          <CustomSwitch
            v-model="cito"
            :show-label="true"
            label="CITO"
            sideLabel="Tidak"
            sideLabelTrue="Iya"
            class="w-[150px] mr-[20px]"
          />
        </div>
        <div>
          <CustomSwitch
            v-model="statusPuasa"
            :show-label="true"
            label="Status Puasa"
            sideLabel="Tidak"
            sideLabelTrue="Iya"
            class="w-[150px] mr-3"
          />
        </div>
      </div>
      <div class="flex mt-[30px]">
        <span class="font-bold text-md"> Tarif Pemeriksaan </span>
      </div>
      <hr class="mt-5 mb-[30px]" />
      <div class="mt-4">
        <template v-for="category in categories" :key="category.code">
          <CustomAccordion
            v-if="category.tarifLab && category.tarifLab.length > 0"
            :openWithHeader="false"
            header-class="bg-opensimrs-50"
            initialState="0"
          >
            <template #header>
              <div class="flex justify-between w-full align-middle text-normal">
                {{ category.name }}
              </div>
            </template>
            <template #content>
              <div class="flex flex-wrap gap-4 pt-5">
                <template v-for="tarif in category.tarifLab" :key="tarif.code">
                  <CustomCheckbox
                    v-model="selectedTarifs[tarif.code]"
                    :title="tarif.name"
                    :subTitle="`Rp ${tarif.grandTotal.toLocaleString()}`"
                  />
                </template>
              </div>
            </template>
          </CustomAccordion>
        </template>

        <div class="flex mt-[50px]">
          <span class="font-bold text-md"> Tarif Pemeriksaan - Paket</span>
        </div>
        <hr class="mt-5 mb-[30px]" />

        <div class="flex flex-wrap gap-4">
          <template v-for="tarif in nonCategories" :key="tarif.code">
            <CustomCheckbox
              v-model="selectedTarifs[tarif.code]"
              :title="tarif.name"
              :subTitle="`Rp ${tarif.grandTotal.toLocaleString()}`"
            />
          </template>
        </div>
        <ErrorMessage name="tarifLabUuids" class="mt-4 text-sm text-red-500" />
      </div>
    </template>
    <template #collapseIcon>
      <CustomButton
        icon="PhCaretUp"
        backgroundColor="bg-opensimrs-75"
        textColor="text-opensimrs-300"
      />
    </template>
    <template #expandIcon>
      <CustomButton
        icon="PhCaretDown"
        backgroundColor="bg-opensimrs-75"
        textColor="text-opensimrs-300"
      />
    </template>
  </CustomAccordion>
</template>
