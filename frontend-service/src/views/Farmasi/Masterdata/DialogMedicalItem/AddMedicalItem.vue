<script lang="ts" setup>
import { ref, watch, onMounted } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { utilsStore } from "@/stores/utils";
import { useMedicalItemStore } from "@/stores/datamasterFarmasi/MedicalItem";
import { useUnitStore } from "@/stores/datamasterFarmasi/Unit";
import { useManufacturingStore } from "@/stores/datamasterFarmasi/manufacturing";
import { useDosageFormStore } from "@/stores/datamasterFarmasi/DosageForm";
import { useDrugCategoryStore } from "@/stores/datamasterFarmasi/DrugCategory";
import { useCompositionStore } from "@/stores/datamasterFarmasi/Composition";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomMultiSelect from "@/components/Base/CustomMultiSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";

const props = defineProps({
  isDialogVisible: {
    default: false,
  },
  title: {
    type: String,
  },
  method: {
    type: String,
  },
  payload: {
    type: Object,
    default: () => ({}),
  },
  dataJenisStok: {
    type: Array,
    default: () => [],
  },
});

const optionJenisItem = ref([
  { label: "Obat", value: "obat" },
  { label: "Alkes", value: "alkes" },
]);

const schema = toTypedSchema(
  yup
    .object({
      code: yup.string().required("Kode Item Medis harus diisi"),
      name: yup.string().required("Nama Item Medis harus diisi"),
      dosis: yup.number().required("Dosis harus diisi"),
      satuanDosisUuid: yup.string().required("Satuan Dosis harus diisi"),
      isiKemasan: yup.number().required("Kemasan harus diisi"),
      satuanKemasanUuid: yup.string().required("Satuan Kemasan harus diisi"),
      jenisItem: yup.string().required("Jenis Item harus diisi"),
      satuanPenggunaanUuid: yup
        .string()
        .required("Satuan Pengguna harus diisi"),
      manufactureUuid: yup.string().required("Manufaktur harus diisi"),
      bentukSediaanUuid: yup.string().required("Bentuk Sediaan harus diisi"),
      kategoriObatUuid: yup.string().required("Kategori Item harus diisi"),
      jenisStocks: yup
        .array()
        .min(1, "Minimal satu Jenis Stok harus dipilih")
        .required("Jenis Stok harus diisi"),
      ingridients: yup
        .array()
        .min(1, "Minimal satu Komposisi harus dipilih")
        .required("Komposisi harus diisi"),
      status: yup.bool().default(true),
    })
    .noUnknown()
);

const {
  errors,
  handleSubmit,
  defineField,
  resetForm,
  setValues,
  setFieldError,
} = useForm({
  validationSchema: schema,
});

const [code] = defineField("code");
const [name] = defineField("name");
const [jenisItem] = defineField("jenisItem");
const [satuanPenggunaanUuid] = defineField("satuanPenggunaanUuid");
const [jenisStocks] = defineField("jenisStocks");
const [manufactureUuid] = defineField("manufactureUuid");
const [bentukSediaanUuid] = defineField("bentukSediaanUuid");
const [kategoriObatUuid] = defineField("kategoriObatUuid");
const [ingridients] = defineField("ingridients");
const [dosis] = defineField("dosis");
const [satuanDosisUuid] = defineField("satuanDosisUuid");
const [isiKemasan] = defineField("isiKemasan");
const [satuanKemasanUuid] = defineField("satuanKemasanUuid");
const [status] = defineField("status");

const conversion = ref<any[]>([]);
const addRow = () => {
  conversion.value.push({
    no: conversion.value.length + 1,
    satuanPembelianUuid: resultSelectedPembelian.value.uuid,
    satuanPembelian: resultSelectedPembelian.value.name,
    satuanPenggunaanUuid: resultSelectedPenggunaan.value.uuid,
    satuanPenggunaan: resultSelectedPenggunaan.value.name,
    konversi: konversi.value,
  });
};

const remove = (index: any) => {
  conversion.value.splice(index, 1);
};

const satuanPembelianUuid = ref<any>({});
const konversi = ref(0);
const resultSelectedPenggunaan = ref<any>({});
const selectedPenggunaan = (uuid: string) => {
  resultSelectedPenggunaan.value = UnitPayload.value.find(
    (unit) => unit.uuid === uuid
  );
};
const resultSelectedPembelian = ref<any>({});
const selectedPembelian = (uuid: string) => {
  resultSelectedPembelian.value = UnitPayload.value.find(
    (unit) => unit.uuid === uuid
  );
};

const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);

const method = ref(props.method);
const title = ref(props.title);

const updateVisibility = (value: any) => {
  emit("update:isDialogVisible", value);
};

const resetDialogMode = () => {
  method.value = props.method;
  title.value = props.title;
};

const closeDialog = () => {
  emit("update:isDialogVisible", false);
  resetDialogMode();
  resetForm();
};

const handleEdit = () => {
  method.value = "edit";
  title.value = "Edit Data";
};

const UnitStore = useUnitStore();
const UnitPayload = ref<any[]>([]);

// Fetch Unit
const fetchSatuan = async () => {
  try {
    const response = await UnitStore.getApi();
    if (response && response.payload) {
      UnitPayload.value = response.payload;
    } else {
      UnitPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch provinsi", error);
    UnitPayload.value = [];
  }
};

const ManufacturingStore = useManufacturingStore();
const ManufacturingPayload = ref<any[]>([]);

// Fetch Manufacturing
const fetchManufacturing = async () => {
  try {
    const response = await ManufacturingStore.getApi();
    if (response && response.payload) {
      ManufacturingPayload.value = response.payload;
    } else {
      ManufacturingPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch provinsi", error);
    ManufacturingPayload.value = [];
  }
};

const DosageFormStore = useDosageFormStore();
const DosageFormPayload = ref<any[]>([]);

// Fetch Dosage Form
const fetchDosageForm = async () => {
  try {
    const response = await DosageFormStore.getApi();
    if (response && response.payload) {
      DosageFormPayload.value = response.payload;
    } else {
      DosageFormPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch provinsi", error);
    DosageFormPayload.value = [];
  }
};

const DrugCategoryStore = useDrugCategoryStore();
const DrugCategoryPayload = ref<any[]>([]);

// Fetch Drug Category
const fetchDrugCategory = async () => {
  try {
    const response = await DrugCategoryStore.getApi();
    if (response && response.payload) {
      DrugCategoryPayload.value = response.payload;
    } else {
      DrugCategoryPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch provinsi", error);
    DrugCategoryPayload.value = [];
  }
};

const CompositionStore = useCompositionStore();
const CompositionPayload = ref<any[]>([]);

// Fetch Composition
const fetchComposition = async () => {
  try {
    const response = await CompositionStore.getApi();
    if (response && response.payload) {
      CompositionPayload.value = response.payload;
    } else {
      CompositionPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch provinsi", error);
    CompositionPayload.value = [];
  }
};

// State Management
const UseUtilsStore = utilsStore();
const MedicalItemStore = useMedicalItemStore();

const onSubmit = handleSubmit(async (values: any) => {
  let jenisStokDelete = values.jenisStocks.map((uuid: string) => ({
    jenis_stok_uuid: uuid,
  }));
  let jenisStokNew = values.jenisStocks.map((uuid: string) => ({
    jenis_stok_uuid: uuid,
  }));
  let ingridientsNew = values.ingridients.map((name: string) => ({
    name: name,
  }));

  try {
    if (method.value === "edit") {
      if (!props.payload || !props.payload.uuid) {
        throw new Error("UUID is missing for edit operation");
      }
      const uuid = props.payload.uuid;
      const payloadUpdated = {
        code: values.code,
        name: values.name,
        bentuk_sediaan_uuid: values.bentukSediaanUuid,
        dosis: values.dosis,
        satuanDosisUuid: values.satuanDosisUuid,
        isiKemasan: values.isiKemasan,
        satuanKemasanUuid: values.satuanKemasanUuid,
        satuanPenggunaanUuid: values.satuanPenggunaanUuid,
        manufactureUuid: values.manufactureUuid,
        jenisItem: values.jenisItem,
        kategoriObatUuid: values.kategoriObatUuid,
        status: values.status,
        ingridients: ingridientsNew,
        jenisStocks: jenisStokNew,
        conversion: [
          {
            satuan_pembelian_uuid: resultSelectedPembelian.value.uuid,
            satuan_pembelian: resultSelectedPembelian.value.name,
            satuan_penggunaan_uuid: resultSelectedPenggunaan.value.uuid,
            satuan_penggunaan: resultSelectedPenggunaan.value.name,
            konversi: konversi.value,
          },
        ],
      };

      const response = await MedicalItemStore.putApi(uuid, payloadUpdated);
      console.log("Data updated successfully:", response);
      emit("data-updated");
    } else if (method.value === "add") {
      const payload = {
        code: values.code,
        name: values.name,
        bentukSediaanUuid: values.bentukSediaanUuid,
        dosis: values.dosis,
        satuanDosisUuid: values.satuanDosisUuid,
        isiKemasan: values.isiKemasan,
        satuanKemasanUuid: values.satuanKemasanUuid,
        satuanPenggunaanUuid: values.satuanPenggunaanUuid,
        manufactureUuid: values.manufactureUuid,
        jenisItem: values.jenisItem,
        kategoriObatUuid: values.kategoriObatUuid,
        status: values.status,
        ingridients: ingridientsNew,
        jenisStocks: jenisStokNew,
        conversion: [
          {
            satuan_pembelian_uuid: resultSelectedPembelian.value.uuid,
            satuan_pembelian: resultSelectedPembelian.value.name,
            satuan_penggunaan_uuid: resultSelectedPenggunaan.value.uuid,
            satuan_penggunaan: resultSelectedPenggunaan.value.name,
            konversi: konversi.value,
          },
        ],
      };
      const response = await MedicalItemStore.postApi(payload);
      emit("data-updated");
    }
    closeDialog();
  } catch (error) {
    console.error("Failed to process the data:", error);
  }
});

watch(
  () => props.isDialogVisible,
  (newValue) => {
    if (newValue) {
      resetDialogMode();
      if (props.method !== "add" && props.payload) {
        const selectedJenisStok =
          props.payload.jenisStok?.map((item: any) => item.detailStok?.uuid) ||
          [];
        const selectedIngridient =
          props.payload.ingridients?.map(
            (item: { name: string }) => item.name
          ) || [];

        setValues({
          ...props.payload,
          jenisStocks: selectedJenisStok,
          ingridients: selectedIngridient,
        });
      }
    } else {
      resetForm();
      resetDialogMode();
    }
  }
);

onMounted(() => {
  fetchSatuan();
  fetchManufacturing();
  fetchDosageForm();
  fetchDrugCategory();
  fetchComposition();
});
</script>

<template>
  <CustomDialog
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    width="700px"
  >
    <template #header>
      <div v-if="method !== 'detail'" class="grid grid-cols-1">
        <p>{{ title }} Data Item Medis</p>
      </div>
      <div v-if="method === 'detail'" class="grid grid-cols-1">
        <p>Detail Data Item Medis</p>
      </div>
    </template>
    <template #body>
      <div v-if="method !== 'detail'">
        <div class="grid grid-cols-[30%,70%]">
          <!-- Kode Item Medis -->
          <div class="mt-[20px]">
            <CustomTextfield
              v-model="code"
              :invalid="!!errors.code"
              :invalidMessage="errors.code"
              label="Kode Item Medis"
              placeholder="Kode Item Medis"
              class="mr-2"
            />
          </div>
          <!-- Nama Item Medis -->
          <div class="mt-[20px]">
            <CustomTextfield
              v-model="name"
              :invalid="!!errors.name"
              :invalidMessage="errors.name"
              label="Nama Item Medis"
              placeholder="Nama Item Medis"
              class="ml-2"
            />
          </div>
          <!-- Jenis Item  -->
          <div class="mt-[20px]">
            <CustomSelect
              v-model="jenisItem"
              :invalid="!!errors.jenisItem"
              :invalidMessage="errors.jenisItem"
              place-holder="Pilih Jenis Item"
              label="Jenis Item"
              optionLabel="label"
              optionValue="value"
              :options="optionJenisItem"
              class="mr-2"
            />
          </div>
          <!-- Satuan Penggunaan -->
          <div class="mt-[20px]">
            <CustomSelect
              v-model="satuanPenggunaanUuid"
              @update:model-value="selectedPenggunaan"
              :invalid="!!errors.satuanPenggunaanUuid"
              :invalidMessage="errors.satuanPenggunaanUuid"
              place-holder="Pilih Satuan Penggunaan"
              label="Satuan Penggunaan"
              optionLabel="name"
              optionValue="uuid"
              :options="UnitPayload"
              class="ml-2"
            />
          </div>
        </div>
        <!-- Jenis Stok -->
        <div class="grid grid-cols-1">
          <div class="mt-[20px]">
            <CustomMultiSelect
              placeholder="Pilih Jenis Stok"
              label="Jenis Stok"
              v-model="jenisStocks"
              :invalid="!!errors.jenisStocks"
              :invalidMessage="errors.jenisStocks"
              optionLabel="name"
              optionValue="uuid"
              :options="dataJenisStok"
            />
          </div>
        </div>
        <!-- Manufaktur -->
        <div class="grid grid-cols-2 gap-2">
          <div class="mt-[20px]">
            <CustomSelect
              v-model="manufactureUuid"
              :invalid="!!errors.manufactureUuid"
              :invalidMessage="errors.manufactureUuid"
              place-holder="Pilih Manufaktur"
              label="Manufaktur"
              optionLabel="name"
              optionValue="uuid"
              :options="ManufacturingPayload"
              class=""
            />
          </div>
          <!-- Bentuk Sediaan -->
          <div class="mt-[20px]">
            <CustomSelect
              v-model="bentukSediaanUuid"
              :invalid="!!errors.bentukSediaanUuid"
              :invalidMessage="errors.bentukSediaanUuid"
              place-holder="Pilih Bentuk Sediaan"
              label="Bentuk Sediaan"
              optionLabel="name"
              optionValue="uuid"
              :options="DosageFormPayload"
              class="ml-2"
            />
          </div>
        </div>
        <!-- Dosis Kemasan -->
        <div class="grid grid-cols-[20%,30%,20%,30%]">
          <div class="mt-[20px]">
            <CustomInputNumber
              v-model="dosis"
              :invalid="!!errors.dosis"
              :invalidMessage="errors.dosis"
              label="Dosis Kemasan"
              class=""
            />
          </div>
          <!-- Satuan -->
          <div class="mt-[20px]">
            <CustomSelect
              v-model="satuanDosisUuid"
              :invalid="!!errors.satuanDosisUuid"
              :invalidMessage="errors.satuanDosisUuid"
              place-holder="Pilih Satuan"
              label="Satuan"
              optionLabel="name"
              optionValue="uuid"
              :options="UnitPayload"
              class="mr-1 ml-2"
            />
          </div>
          <!-- Isi Kemasan -->
          <div class="mt-[20px]">
            <CustomInputNumber
              v-model="isiKemasan"
              :invalid="!!errors.isiKemasan"
              :invalidMessage="errors.isiKemasan"
              label="Isi Kemasan"
              class="ml-3"
            />
          </div>
          <!-- Satuan -->
          <div class="mt-[20px]">
            <CustomSelect
              v-model="satuanKemasanUuid"
              :invalid="!!errors.satuanKemasanUuid"
              :invalidMessage="errors.satuanKemasanUuid"
              place-holder="Pilih Satuan"
              label="Satuan"
              optionLabel="name"
              optionValue="uuid"
              :options="UnitPayload"
              class="ml-2"
            />
          </div>
        </div>
        <div class="grid grid-cols-[30%,70%]">
          <!-- Kategori Item -->
          <div class="mt-[20px]">
            <CustomSelect
              v-model="kategoriObatUuid"
              :invalid="!!errors.kategoriObatUuid"
              :invalidMessage="errors.kategoriObatUuid"
              place-holder="Kategori Item"
              label="Kategori Item"
              optionLabel="name"
              optionValue="uuid"
              :options="DrugCategoryPayload"
              class="mr-2"
            />
          </div>
          <!-- Komposisi -->
          <div class="mt-[20px]">
            <CustomMultiSelect
              placeholder="Pilih Komposisi"
              label="Komposisi"
              v-model="ingridients"
              :invalid="!!errors.ingridients"
              :invalidMessage="errors.ingridients"
              optionLabel="name"
              optionValue="name"
              :maxSelectedLabels="3"
              :options="CompositionPayload"
              class="ml-2"
            />
          </div>
        </div>
        <hr class="mt-[20px] border border-slate-300" />

        <!-- Konversi Satuan -->
        <div class="grid grid-cols-1 mt-[30px]">
          <p class="text-xl font-bold">Konversi Satuan</p>
        </div>
        <hr class="mt-[10px] border border-slate-200" />
        <!-- Satuan Pembelian -->
        <div class="grid grid-cols-[50%,30%,20%]">
          <div class="mt-[10px]">
            <CustomSelect
              v-model="satuanPembelianUuid"
              @update:model-value="selectedPembelian"
              place-holder="Pilih Satuan Pembelian"
              label="Satuan Pembelian"
              optionLabel="name"
              optionValue="uuid"
              :options="UnitPayload"
            />
          </div>
          <!-- Konversi -->
          <div class="mt-[10px]">
            <CustomInputNumber
              v-model="konversi"
              label="Konversi"
              placeholder="0"
              class="mr-[15px] ml-[15px]"
            >
              <template #appendText>
                <div
                  class="font-semibold text-sm text-opensimrs-300 mr-[15px] mt-[10px]"
                >
                  {{ resultSelectedPenggunaan.name }}
                </div>
              </template>
            </CustomInputNumber>
          </div>
          <!-- Tambahkan -->
          <div class="mt-[36px]">
            <CustomButton
              icon="PhPlus"
              label="Tambahkan"
              class=""
              @click="addRow"
            />
          </div>
        </div>
        <!-- Datatable -->
        <div class="grid grid-cols-1 mt-[20px]">
          <DataTable
            :value="conversion"
            stripedRows
            class="text-xs"
            scrollable
            scrollHeight="flex"
          >
            <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
              <template #header>
                <div class="">No.</div>
              </template>
              <template #body="slotProps">
                <div class="">
                  {{ slotProps.data.no }}
                </div>
              </template>
            </Column>
            <Column
              header="Satuan Pembelian"
              headerClass="bg-opensimrs-50 font-semibold text-SM"
            >
              <template #body="slotProps">
                <div class="text-sm">{{ slotProps.data.satuanPembelian }}</div>
              </template>
            </Column>
            <Column
              header="Satuan Penggunaan"
              headerClass="bg-opensimrs-50 font-semibold text-SM"
            >
              <template #body="slotProps">
                <div class="text-sm">{{ slotProps.data.satuanPenggunaan }}</div>
              </template>
            </Column>
            <Column
              header="Konversi"
              headerClass="bg-opensimrs-50 font-semibold text-SM"
            >
              <template #body="slotProps">
                <div class="text-sm">{{ slotProps.data.konversi }}</div>
              </template>
            </Column>
            <Column headerClass="bg-opensimrs-50">
              <template #header="slotProps">
                <div class="font-semibold text-SM">Action</div>
              </template>
              <template #body="slotProps">
                <div class="">
                  <CustomButton
                    label=""
                    background-color="bg-danger-300 rounded-lg"
                    class="h-6 w-[26px] p-0"
                    @click="remove(slotProps.index)"
                  >
                    <img src="@/assets/icons/delete.svg" alt="" />
                  </CustomButton>
                </div>
              </template>
            </Column>
          </DataTable>
        </div>
        <!-- Status -->
        <div class="grid grid-cols-2 mt-[15px]">
          <div>
            <CustomSwitch
              v-model="status"
              :show-label="true"
              label="Status"
              sideLabel="NON-AKTIF"
              sideLabelTrue="AKTIF"
            />
          </div>
        </div>
      </div>
      <div v-if="method === 'detail'">
        <!-- Title Item Medis -->
        <div class="mt-[20px]">
          <p class="text-xl font-bold">Item Medis</p>
        </div>
        <hr class="mt-[10px] border border-slate-200" />
        <div class="grid grid-cols-[30%,70%]">
          <!-- Kode Item Medis -->
          <div>
            <p class="mt-[20px] text-sm font-bold">Kode Item Medis</p>
          </div>
          <div>
            <p class="mt-[20px] text-sm">: {{ payload?.code || "-" }}</p>
          </div>
          <!-- Nama Item Medis -->
          <div>
            <p class="mt-[20px] text-sm font-bold">Nama Item Medis</p>
          </div>
          <div>
            <p class="mt-[20px] text-sm">: {{ payload?.name || "-" }}</p>
          </div>
          <!-- Jenis Item -->
          <div>
            <p class="mt-[20px] text-sm font-bold">Jenis Item</p>
          </div>
          <div>
            <p class="mt-[20px] text-sm">: {{ payload?.jenisItem || "-" }}</p>
          </div>
          <!-- Satuan Penggunaan -->
          <div>
            <p class="mt-[20px] text-sm font-bold">Satuan Penggunaan</p>
          </div>
          <div>
            <p class="mt-[20px] text-sm">
              : {{ payload?.satuanPenggunaan?.name || "-" }}
            </p>
          </div>
          <!-- Jenis Stok -->
          <div>
            <p class="mt-[20px] text-sm font-bold">Jenis Stok</p>
          </div>
          <div class="flex mt-[20px] text-sm">
            :
            <div
              class="ml-[5px]"
              v-for="(items, idx) in payload?.jenisStok || []"
              :key="items?.detailStok?.uuid || idx"
            >
              <CustomChip
                :label="items?.detailStok?.name || '-'"
                :showCheckedIcon="false"
                borderColor="border-opensimrs-300"
                bgColor="bg-opensimrs-300"
                textColor="text-white"
                customClass="h-6"
                class="mr-[5px]"
              />
            </div>
          </div>
          <!-- Manufaktur -->
          <div>
            <p class="mt-[20px] text-sm font-bold">Manufaktur</p>
          </div>
          <div>
            <p class="mt-[20px] text-sm">
              : {{ payload?.manufacture?.name || "-" }}
            </p>
          </div>
          <!-- Bentuk Sediaan -->
          <div>
            <p class="mt-[20px] text-sm font-bold">Bentuk Sediaan</p>
          </div>
          <div>
            <p class="mt-[20px] text-sm">
              : {{ payload?.bentukSediaan?.name || "-" }}
            </p>
          </div>
        </div>
        <div class="grid grid-cols-[30%,20%,30%,20%]">
          <!-- Dosis Kemasan -->
          <div>
            <p class="mt-[20px] text-sm font-bold">Dosis Kemasan</p>
          </div>
          <div>
            <p class="mt-[20px] text-sm">: {{ payload?.dosis ?? "-" }}</p>
          </div>
          <!-- Satuan -->
          <div>
            <p class="mt-[20px] text-sm font-bold">Satuan</p>
          </div>
          <div>
            <p class="mt-[20px] text-sm">
              : {{ payload?.satuanDosis?.name || "-" }}
            </p>
          </div>
          <!-- Isi Kemasan -->
          <div>
            <p class="mt-[20px] text sm font-bold">Isi Kemasan</p>
          </div>
          <div>
            <p class="mt-[20px] text-sm">: {{ payload?.isiKemasan ?? "-" }}</p>
          </div>
          <!-- Satuan -->
          <div>
            <p class="mt-[20px] text-sm font-bold">Satuan</p>
          </div>
          <div>
            <p class="mt-[20px] text-sm">
              : {{ payload?.satuanKemasan?.name || "-" }}
            </p>
          </div>
        </div>
        <div class="grid grid-cols-[30%,70%]">
          <!-- Kategori Item -->
          <div>
            <p class="mt-[20px] text-sm font-bold">Kategori Item</p>
          </div>
          <div>
            <p class="mt-[20px] text-sm">
              : {{ payload?.kategoriObat?.name || "-" }}
            </p>
          </div>
          <!-- Komposisi -->
          <div>
            <p class="mt-[20px] text-sm font-bold">Komposisi</p>
          </div>
          <div class="flex mt-[20px] text-sm">
            :
            <div
              class="ml-[5px]"
              v-for="(items, idx) in payload?.ingridients || []"
              :key="items?.uuid || items?.name || idx"
            >
              <CustomChip
                :label="items?.name || '-'"
                :showCheckedIcon="false"
                borderColor="border-opensimrs-300"
                bgColor="bg-opensimrs-300"
                textColor="text-white"
                customClass="h-6"
                class="mr-[5px]"
              />
            </div>
          </div>
        </div>
        <!-- Title Konversi Satuan -->
        <div class="mt-[20px]">
          <p class="text-xl font-bold">Konversi Satuan</p>
        </div>
        <hr class="mt-[10px] border border-slate-200" />
        <div class="mt-[20px]">
          <DataTable :value="payload?.conversions || []" class="text-xs">
            <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
              <template #header>
                <div class="w-full text-center">No.</div>
              </template>
              <template #body="slotProps">
                <div class="flex justify-center items-center">
                  {{ slotProps.index + 1 }}
                </div>
              </template>
            </Column>
            <!-- Satuan Pembelian -->
            <Column
              field="satuanPembelian"
              header="Satuan Pembelian"
              headerClass="bg-opensimrs-50 font-semibold text-SM"
            ></Column>
            <!-- Satuan Penggunaan -->
            <Column
              field="satuanPenggunaan"
              header="Satuan Penggunaan"
              headerClass="bg-opensimrs-50 font-semibold text-SM"
            ></Column>
            <!-- Konversi -->
            <Column
              field="konversi"
              header="Konversi"
              headerClass="bg-opensimrs-50 font-semibold text-SM"
            ></Column>
          </DataTable>
        </div>
        <div class="grid grid-cols-1">
          <div class="flex">
            <p class="mt-[20px] text-sm font-bold">
              Status <span class="font-normal ml-[145px]">:</span>
            </p>
            <CustomChip
              :label="status ? 'AKTIF' : 'NON-AKTIF'"
              :textColor="status ? 'text-white' : 'text-[#80868d]'"
              :bgColor="status ? 'bg-opensimrs-300' : 'bg-white'"
              :borderColor="status ? 'border-none' : 'border-[#80868d]'"
              :icon-color="status ? 'white' : '#80868d'"
              customClass="font-semibold h-5 flex"
              class="mt-[20px] ml-[5px]"
            />
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="w-full">
        <div class="flex gap-2.5 justify-end mt-5">
          <CustomButton
            v-if="method !== 'detail'"
            label="Reset"
            textColor="text-grey-300"
            backgroundColor="bg-transparent"
            borderColor="border-2 border-grey-200"
            @click="resetForm"
          />
          <CustomButton
            v-if="method !== 'detail'"
            label="Simpan"
            @click="onSubmit"
          />
          <CustomButton
            v-if="method === 'detail'"
            label="Edit"
            @click="handleEdit"
          />
        </div>
      </div>
    </template>
  </CustomDialog>
</template>
