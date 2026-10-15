-
<script lang="ts" setup>
import { ref, watch, onMounted } from "vue";
import { useForm, useFieldArray, ErrorMessage } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { useTarifStore } from "@/stores/datamaster/tarif";
import { usePenjaminStore } from "@/stores/datamaster/penjamin";
import { useMonitoringKamarStore } from "@/stores/admisi/monitoringKamar";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";

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
});

const tarifStore = useTarifStore();
const penjaminStore = usePenjaminStore();
const monitoringKamarStore = useMonitoringKamarStore();
const penjaminPayload = ref<any[]>([]);
const ruanganPayload = ref<any[]>([]);
const optionsPelayanan = ref([
  { label: "IGD", value: 1 },
  { label: "Rawat Inap", value: 3 },
]);

const fetchPenjamin = async () => {
  try {
    const response = await penjaminStore.getAktifApi();
    if (response && response.payload) {
      penjaminPayload.value = response.payload;
    } else {
      penjaminPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch fetch penjamin", error);
    penjaminPayload.value = [];
  }
};

// Kamar rawat inap (lokasi) yang sama dengan pilihan di Admisi › Rawat Inap & Monitoring Kamar,
// agar biaya kamar bisa ditagihkan otomatis saat pasien discharge.
const fetchRuangan = async () => {
  try {
    const response = await monitoringKamarStore.getAktifRuangan();
    if (response && response.payload) {
      ruanganPayload.value = response.payload.map((r: any) => ({
        uuid: r.uuid,
        name: [r.name, r.className].filter(Boolean).join(" - "),
      }));
    } else {
      ruanganPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch ruangan", error);
    ruanganPayload.value = [];
  }
};
onMounted(() => {
  fetchPenjamin();
  fetchRuangan();
});
const schema = toTypedSchema(
  yup
    .object({
      jenisTarif: yup.string().default("Ruangan"),
      code: yup.string().required("Code Tarif harus diisi"),
      name: yup.string().required("Nama Tarif harus diisi"),
      unitPelayanan: yup.string().required("Pelayanan harus dipilih"),
      lokasiUuid: yup.string().required("Ruangan harus dipilih"),
      tarifPenjamin: yup.array().of(
        yup.object({
          penjaminUuid: yup.string().required("Jenis Pembayaran harus dipilih"),
          harga: yup.number().required("Harga Bed harus diisi"),
        })
      ),
      status: yup.bool().default(true),
    })
    .noUnknown()
);

const { errors, handleSubmit, resetForm, setValues, defineField } = useForm({
  validationSchema: schema,
  initialValues: {
    tarifPenjamin: [
      {
        penjaminUuid: "",
        harga: 0,
      },
    ],
  },
});
const [code] = defineField("code");
const [name] = defineField("name");
const [unitPelayanan] = defineField("unitPelayanan");
const [lokasiUuid] = defineField("lokasiUuid");
const [status] = defineField("status");

interface Penjamin {
  penjaminUuid: string;
  harga: number;
}
const {
  remove,
  push,
  fields: filedsPenjamin,
} = useFieldArray<Penjamin>("tarifPenjamin");

const myPushFunction = () => {
  push({ penjaminUuid: "", harga: 0 });
};

const tempDeleteData = ref<any[]>([]);
interface TempKomponen {
  harga: number;
  penjaminName: string;
  penjaminUuid: string;
  uuid: string;
}

const tempPenjamin = ref<TempKomponen[]>([]);

const handleDelete = (index: number) => {
  const komponenToRemove = filedsPenjamin.value[index].value;
  const parseItem = JSON.parse(JSON.stringify(komponenToRemove));
  // Check if the item is in tempPenjamin
  const tempKomponen = tempPenjamin.value.find(
    (temp: any) => temp.penjaminUuid === parseItem.penjaminUuid
  );

  if (tempKomponen) {
    // Mark the component as deleted and add to tempDeleteData
    const deletedItem = { ...tempKomponen, isDeleted: true };
    tempDeleteData.value.push(deletedItem);
  }

  // Remove the component from the fields array
  remove(index);
};

const onSubmit = handleSubmit(async (values: any) => {
  try {
    values.unitPelayanan = [
      {
        unitPelayanan: values.unitPelayanan,
      },
    ];
    if (method.value === "edit") {
      if (!props.payload || !props.payload.uuid) {
        throw new Error("UUID is missing for edit operation");
      }
      const uuid = props.payload.uuid;
      const response = await tarifStore.putApi(uuid, values);
      emit("data-updated");
    } else if (method.value === "add") {
      const response = await tarifStore.postApi(values);
      emit("data-updated");
    }
    closeDialog();
  } catch (error) {
    console.error("Failed to process the data:", error);
  }
});

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
  tempPenjamin.value = [];
  tempDeleteData.value = [];
};

watch(
  () => props.isDialogVisible,
  (newValue) => {
    if (newValue) {
      resetDialogMode();
      if (props.method !== "add" && props.payload) {
        setValues({
          ...props.payload,
          unitPelayanan: props.payload.tagUnitPelayanan[0].unitPelayanan,
          lokasiUuid: props.payload.lokasiUuid ?? props.payload.ruangan?.uuid,
          tarifPenjamin: props.payload.tagPenjamin,
        });
        tempPenjamin.value = props.payload.tagPenjamin;
      }
    } else {
      resetForm();
      resetDialogMode();
      tempPenjamin.value = [];
      tempDeleteData.value = [];
    }
  }
);
</script>

<template>
  <CustomDialog
    width="600px"
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    headerBg="bg-opensimrs-300"
  >
    <template #header>{{ title }}</template>
    <template #body>
      <!-- Form Input -->
      <div
        v-if="method !== 'detail'"
        class="flex flex-col h-full overflow-hidden"
      >
        <div class="grid grid-cols-12 gap-5 mt-5">
          <CustomTextfield
            v-model="code"
            class="col-span-6"
            label="Kode Tarif"
            placeholder="Kode Tarif"
            :invalid="!!errors.code"
            :invalidMessage="errors.code"
            :required="errors.code ? true : false"
          />
          <CustomTextfield
            v-model="name"
            class="col-span-6"
            label="Nama Tarif"
            placeholder="Nama Tarif"
            :invalid="!!errors.name"
            :invalidMessage="errors.name"
            :required="errors.name ? true : false"
          />
          <CustomSelect
            v-model="unitPelayanan"
            class="col-span-6"
            label="Pelayanan"
            :options="optionsPelayanan"
            optionLabel="label"
            optionValue="label"
            place-holder="Pelayanan"
            :invalid="!!errors.unitPelayanan"
            :invalidMessage="errors.unitPelayanan"
            :required="errors.unitPelayanan ? true : false"
          />
          <CustomSelect
            label="Ruangan"
            v-model="lokasiUuid"
            place-holder="Ruangan"
            :options="ruanganPayload"
            option-label="name"
            option-value="uuid"
            class="col-span-6"
            :invalid="!!errors.lokasiUuid"
            :invalidMessage="errors.lokasiUuid"
            :required="errors.lokasiUuid ? true : false"
          />
          <div class="col-span-12">
            <DataTable
              :value="filedsPenjamin"
              tableStyle="min-width: 30rem"
              class="overflow-hidden text-xs rounded-lg bg-opensimrs-50"
            >
              <Column headerClass="bg-opensimrs-300 text-white" class="w-1/2">
                <template #header>
                  <div>Jenis Pembayaran Bed</div>
                </template>
                <template #body="slotProps">
                  <CustomSelect
                    v-model="slotProps.data.value.penjaminUuid"
                    :options="penjaminPayload"
                    optionValue="uuid"
                    optionLabel="name"
                    label=""
                    place-holder="Jenis Pembayaran Lain"
                    :invalid="(errors as any)[`tarifPenjamin[${slotProps.index}].penjaminUuid`] ? true : false"
                    :invalidMessage="(errors as any)[`tarifPenjamin[${slotProps.index}].penjaminUuid`]"
                  />
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-300 text-white">
                <template #header>
                  <div class="w-full font-semibold text-end">Harga Bed</div>
                </template>
                <template #body="slotProps">
                  <CustomInputNumber
                    v-model="slotProps.data.value.harga"
                    label=""
                    align-number="text-end"
                    :invalid="(errors as any)[`tarifPenjamin[${slotProps.index}].harga`] ? true : false"
                    :invalidMessage="(errors as any)[`tarifPenjamin[${slotProps.index}].harga`]"
                  >
                    <template #prependText>
                      <div
                        class="flex items-center justify-center px-3 overflow-hidden font-semibold leading-7 text-white border-r text-MD text-opensimrs-300 bg-opensimrs-300 rounded-l-md"
                      >
                        Rp.
                      </div>
                    </template>
                  </CustomInputNumber>
                  <ErrorMessage
                    :name="`tarifPenjamin[${slotProps.index}].harga`"
                    class="text-danger-300"
                  />
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-300 text-white">
                <template #header>
                  <div class="w-full font-semibold text-center">Action</div>
                </template>
                <template #body="slotProps">
                  <div class="flex items-center justify-center">
                    <CustomButton
                      label=""
                      background-color="bg-danger-300 rounded-lg"
                      class="h-6 w-[26px] p-0"
                      @click="handleDelete(slotProps.index)"
                    >
                      <img src="@/assets/icons/delete.svg" alt="" />
                    </CustomButton>
                  </div>
                </template>
              </Column>
            </DataTable>
          </div>

          <div
            class="flex items-center justify-center col-span-12 p-5 m-5 border border-dashed rounded-lg border-opensimrs-300"
          >
            <CustomButton
              icon="PhPlus"
              label="Jenis Pembayaran"
              borderColor="border-opensimrs-300"
              textColor="text-opensimrs-300"
              backgroundColor="bg-white"
              @click="myPushFunction"
            />
          </div>
          <hr class="col-span-12 border-200" />
          <CustomSwitch
            v-model="status"
            :show-label="true"
            label="Status"
            sideLabel="Non-Aktif"
            sideLabelTrue="Aktif"
            class="col-span-6"
          />
        </div>
      </div>
    </template>
    <template #footer>
      <div class="w-full">
        <div class="mt-5 flex justify-end gap-2.5">
          <CustomButton
            v-if="method !== 'detail'"
            label="Batal"
            border-color="border-grey-200"
            background-color="bg-white"
            text-color="text-grey-300"
            @click="closeDialog"
          />
          <CustomButton
            v-if="method !== 'detail'"
            label="Simpan"
            @click="onSubmit"
          />
        </div>
      </div>
    </template>
  </CustomDialog>
</template>
