<script lang="ts" setup>
import { ref, watch, onMounted, computed } from "vue";
import { useForm, useFieldArray, ErrorMessage } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomMultiSelect from "@/components/Base/CustomMultiSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { usePraktisiStore } from "@/stores/datamaster/praktisi";
import { usePegawaiStore } from "@/stores/datamaster/pegawai";
import { useLokasiStore } from "@/stores/datamaster/lokasi";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomChip from "@/components/Base/CustomChip.vue";

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

const tipePraktisi = ref([
  { name: "Dokter", value: true },
  { name: "Non-Dokter", value: false },
]);

const pegawaiStore = usePegawaiStore();
const praktisiStore = usePraktisiStore();
const lokasiStore = useLokasiStore();
const pegawaiPayload = ref<any[]>([]);
const lokasiPayload = ref<any[]>([]);

const fetchPegawai = async () => {
  try {
    const response = await pegawaiStore.getAktifApi("1");
    if (response && response.payload) {
      pegawaiPayload.value = response.payload;
    } else {
      pegawaiPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data pegawai", error);
    pegawaiPayload.value = [];
  }
};
const fetchLokasi = async () => {
  try {
    const response = await lokasiStore.getAktifApi({
      type: "Ward",
      isPoli: true,
    });
    if (response && response.payload) {
      lokasiPayload.value = response.payload;
    } else {
      lokasiPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data lokasi", error);
    lokasiPayload.value = [];
  }
};

onMounted(() => {
  fetchPegawai();
  fetchLokasi();
});

const selectedPegawai = ref<any>(null);
const searchPegawai = () => {
  selectedPegawai.value = pegawaiPayload.value.find(
    (pegawai) => pegawai.uuid === pegawaiUuid.value
  );
};

const resetSearch = () => {
  pegawaiUuid.value = "";
  selectedPegawai.value = null;
};

const schema = toTypedSchema(
  yup
    .object({
      pegawaiUuid: yup.string().required("Pegawai harus dipilih"),
      codeBpjs: yup.string().when("isDoctor", {
        is: (value: boolean) => value === true,
        then: (schema) => schema.required("Kode BPJS harus diisi"),
        otherwise: (schema) => schema.notRequired(),
      }),
      sip: yup.string().nullable(),
      str: yup.string().nullable(),
      isDoctor: yup.boolean().required("Tipe Praktisi harus diisi"),
      codeAntrianDokter: yup.string().when("isDoctor", {
        is: (value: boolean) => value === true,
        then: (schema) => schema.required("Kode Antrian Dokter harus diisi"),
        otherwise: (schema) => schema.notRequired(),
      }),
      poliPelayanan: yup.array().of(
        yup.object().shape({
          lokasiUuid: yup.string().notRequired(),
        })
      ),
      status: yup.bool().default(true),
      practitionerPoliSelected: yup
        .array()
        .of(yup.string().required("Poli harus dipilih"))
        .when("isDoctor", {
          is: (value: boolean) => value === true,
          then: (schema) =>
            schema
              .required("Poli harus dipilih")
              .min(1, "Minimal satu Unit Pelayanan harus dipilih")
              .required("Unit Pelayanan harus dipilih"),
          otherwise: (schema) => schema.notRequired(),
        }),
      // .min(1, "Minimal satu Unit Pelayanan harus dipilih")
      // .required("Unit Pelayanan harus dipilih"),
    })
    .noUnknown()
);

const {
  errors,
  handleSubmit,
  defineField,
  resetForm,
  setValues,
  validateField,
} = useForm({
  validationSchema: schema,
});

const [pegawaiUuid] = defineField("pegawaiUuid");
const [codeBpjs] = defineField("codeBpjs");
const [sip] = defineField("sip");
const [str] = defineField("str");
const [isDoctor] = defineField("isDoctor");
const [codeAntrianDokter] = defineField("codeAntrianDokter");
const [poliPelayanan] = defineField("poliPelayanan");
const [status] = defineField("status");
const [practitionerPoliSelected] = defineField("practitionerPoliSelected");
const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);

const { push: pushPractitionerPoli } = useFieldArray("poliPelayanan");

const handlePenjaminUpdate = (selectedValues: string[]) => {
  poliPelayanan.value = tempPoli.value
    .filter((item: any) => selectedValues.includes(item.lokasiUuid))
    .map((item: any) => ({
      lokasiUuid: item.uuid,
      uuid: item.uuid,
    }));

  selectedValues.forEach((value) => {
    const existsInTemp = tempPoli.value.some(
      (item: { lokasiUuid: string }) => item.lokasiUuid === value
    );

    if (!existsInTemp) {
      pushPractitionerPoli({
        lokasiUuid: value,
      });
    }
  });
  validateField("practitionerPoliSelected");
};

const onSubmit = handleSubmit(async (values: any) => {
  try {
    delete values.practitionerPoliSelected;
    if (values.codeBpjs === "") {
      values.codeBpjs = null;
    } else if (values.sip === "") {
      values.sip = null;
    } else if (values.str === "") {
      values.str = null;
    }

    if (method.value === "edit") {
      if (!props.payload || !props.payload.uuid) {
        throw new Error("UUID is missing for edit operation");
      }
      const uuid = props.payload.uuid;
      const response = await praktisiStore.putApi(uuid, values);
      emit("data-updated");
    } else if (method.value === "add") {
      const response = await praktisiStore.postApi(values);
      emit("data-updated");
    }
    closeDialog();
  } catch (error) {
    console.error("Failed to process the data:", error);
  }
});

const method = ref(props.method);
const title = ref(props.title);

const updateVisibility = (value: any) => {
  emit("update:isDialogVisible", value);
};

const resetDialogMode = () => {
  method.value = props.method;
  title.value = props.title;
};

const handleEdit = () => {
  method.value = "edit";
  title.value = "Edit Data";
};

const closeDialog = () => {
  emit("update:isDialogVisible", false);
  resetDialogMode();
  resetForm();
};

watch(
  () => props.isDialogVisible,
  (newValue) => {
    if (newValue) {
      resetDialogMode();
      if (props.method !== "add" && props.payload) {
        const poliPayload =
          props.payload.poliPelayanan?.map(
            (item: { lokasiUuid: string }) => item.lokasiUuid
          ) || [];
        const tempPoliObject =
          props.payload.poliPelayanan?.map(
            (item: { lokasiUuid: string; uuid: string }) => ({
              lokasiUuid: item.lokasiUuid,
              uuid: item.lokasiUuid,
            })
          ) || [];
        setValues({
          ...props.payload,
          poliPelayanan: props.payload.poliPelayanan ?? [],
          practitionerPoliSelected: poliPayload,
          pegawaiUuid: props.payload?.pegawai?.uuid,
        });
        tempPoli.value = tempPoliObject;
      }
    } else {
      resetForm();
      resetDialogMode();
      resetSearch();
      tempPoli.value = [];
    }
  }
);
const tempPoli = ref([]);
</script>

<template>
  <CustomDialog
    width="600px"
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    headerBg="bg-opensimrs-300"
  >
    <template #header>{{ title }} Praktisi</template>
    <template #body>
      <!-- Form Input -->
      <div v-if="method !== 'detail'" class="grid grid-cols-12 gap-5 mt-5">
        <CustomSelect
          v-model="isDoctor"
          label="Tipe Praktisi"
          :options="tipePraktisi"
          option-label="name"
          option-value="value"
          place-holder="Cari & Pilih Praktisi"
          class="w-1/2 col-span-12"
          :invalid="!!errors.isDoctor"
          :invalidMessage="errors.isDoctor"
          :required="errors.isDoctor ? true : false"
        />
        <hr class="col-span-12 border-grey-200" />
        <CustomSelect
          label="Nama Pegawai"
          v-model="pegawaiUuid"
          :options="pegawaiPayload"
          optionValue="uuid"
          optionLabel="name"
          @update:modelValue="searchPegawai"
          place-holder="Cari & Pilih Pegawai"
          class="col-span-12"
          :invalid="!!errors.pegawaiUuid"
          :invalidMessage="errors.pegawaiUuid"
          :required="errors.pegawaiUuid ? true : false"
        />

        <div v-if="selectedPegawai" class="col-span-12">
          <div
            class="grid grid-flow-col grid-cols-2 grid-rows-2 gap-5 border rounded-[10px] border-opensimrs-300 p-5"
          >
            <div class="flex flex-col">
              <div class="font-semibold underline text-SM">Nama Pegawai</div>
              <div class="font-normal text-normal">
                {{ selectedPegawai.name }}
              </div>
              <!-- Correctly access the name -->
            </div>
            <div class="flex flex-col">
              <div class="font-semibold underline text-SM">Tanggal Lahir</div>
              <div class="font-normal text-normal">
                {{ selectedPegawai.tanggalLahir }}
              </div>
              <!-- Replace with the correct field -->
            </div>
            <div class="flex flex-col">
              <div class="font-semibold underline text-SM">Nik</div>
              <div class="font-normal text-normal">
                {{ selectedPegawai.nik }}
              </div>
              <!-- Replace with the correct field -->
            </div>
            <div class="flex flex-col">
              <div class="font-semibold underline text-SM">Jenis Kelamin</div>
              <div class="font-normal text-normal">
                {{ selectedPegawai.gender }}
              </div>
            </div>
          </div>
        </div>
        <CustomTextfield
          v-if="isDoctor"
          label="Kode HFIS (BPJS)"
          v-model="codeBpjs"
          placeholder="000"
          class="col-span-4"
          :invalid="!!errors.codeBpjs"
          :invalidMessage="errors.codeBpjs"
          :required="errors.codeBpjs ? true : false"
        />
        <CustomTextfield
          v-if="isDoctor"
          label="SIP"
          v-model="sip"
          placeholder="000"
          class="col-span-4"
        />
        <CustomTextfield
          label="STR"
          v-model="str"
          placeholder="0"
          :class="isDoctor ? 'col-span-4' : 'col-span-12'"
        />
        <CustomTextfield
          v-if="isDoctor"
          label="Kode Antrian Dokter"
          v-model="codeAntrianDokter"
          placeholder="Kode Antrian Dokter"
          class="col-span-4"
          :invalid="!!errors.codeAntrianDokter"
          :invalidMessage="errors.codeAntrianDokter"
          :required="errors.codeAntrianDokter ? true : false"
        />
        <!-- Non-dokter: poli tugas opsional (untuk menyaring panel panggilan antrian perawat). -->
        <CustomMultiSelect
          :label="isDoctor ? 'Poli' : 'Poli Tugas (opsional)'"
          v-model="practitionerPoliSelected"
          :options="lokasiPayload"
          @update:modelValue="handlePenjaminUpdate"
          placeholder="Pilih Poli"
          :class="isDoctor ? 'col-span-8' : 'col-span-12'"
          optionValue="uuid"
          optionLabel="name"
          :invalid="!!errors.practitionerPoliSelected"
          :invalidMessage="errors.practitionerPoliSelected"
          :required="errors.practitionerPoliSelected ? true : false"
        />

        <hr class="col-span-12 border-grey-200" />
        <CustomSwitch
          v-model="status"
          :show-label="true"
          label="Status"
          sideLabel="NON-AKTIF"
          sideLabelTrue="AKTIF"
          class="col-span-12"
        />
      </div>
      <!-- Detail Data -->
      <div v-if="method === 'detail'" class="flex flex-col gap-5 mt-5">
        <div class="font-bold text-heading">
          Data Praktisi -
          {{ payload.isDoctor ? "DOKTOR" : "NON-DOKTOR" }}
        </div>
        <hr class="border-grey-200" />
        <CustomInfoRow
          label="Nama Lengkap"
          :value="`${
            payload.pegawai.firstTitle ? payload.pegawai.firstTitle + '. ' : ''
          }${payload.pegawai.name}${
            payload.pegawai.lastTitle ? ', ' + payload.pegawai.lastTitle : ''
          }`"
        />
        <CustomInfoRow label="NIK" :value="payload.pegawai.nik" />
        <CustomInfoRow
          label="Tanggal Lahir"
          :value="payload.pegawai.tanggalLahir"
        />
        <CustomInfoRow label="Jenis Kelamin" :value="payload.pegawai.gender" />
        <CustomInfoRow
          v-if="payload.isDoctor"
          label="Kode HFIS (BPJS)"
          :value="
            payload.codeBpjs && payload.codeBpjs.trim() !== ''
              ? payload.codeBpjs
              : '-'
          "
        />
        <CustomInfoRow
          v-if="payload.isDoctor"
          label="SIP"
          :value="payload.sip && payload.sip.trim() !== '' ? payload.sip : '-'"
        />
        <CustomInfoRow
          label="STR"
          :value="payload.str && payload.str.trim() !== '' ? payload.str : '-'"
        />
        <CustomInfoRow
          v-if="payload.isDoctor"
          label="Kode Antrian Dokter"
          :value="
            codeAntrianDokter && codeAntrianDokter.trim() !== ''
              ? codeAntrianDokter
              : '-'
          "
        />
        <CustomInfoRow v-if="payload.isDoctor || payload.poliPelayanan?.length" :label="payload.isDoctor ? 'Poli' : 'Poli Tugas'">
          <template #value>
            <div
              v-if="poliPelayanan && poliPelayanan.length"
              class="flex flex-wrap w-full h-full gap-1"
            >
              <CustomChip
                v-for="poli in payload.poliPelayanan"
                :label="poli.name"
                textColor="text-white"
                bgColor="bg-opensimrs-300"
                borderColor="border-none"
                :showCheckedIcon="false"
                customClass="text-xs font-semibold h-5 flex w-fit"
              />
            </div>
            <div v-else>-</div>
          </template>
        </CustomInfoRow>
        <CustomInfoRow
          label="ID SATUSEHAT"
          :value="
            payload.satuSehatId && payload.satuSehatId.trim() !== ''
              ? payload.satuSehatId
              : '-'
          "
        />
        <hr class="border-grey-200" />
        <div class="grid grid-cols-2">
          <CustomInfoRow label="Status">
            <template #value>
              <CustomChip
                :label="status ? 'AKTIF' : 'NON-AKTIF'"
                :textColor="status ? 'text-white' : 'text-[#80868d]'"
                :bgColor="status ? 'bg-opensimrs-300' : 'bg-white'"
                :borderColor="status ? 'border-none' : 'border-[#80868d]'"
                :icon-color="status ? 'white' : '#80868d'"
                customClass="text-xs font-semibold h-5 flex w-fit"
              />
            </template>
          </CustomInfoRow>
          <CustomInfoRow label="Status SATUSEHAT">
            <template #value>
              <CustomChip
                :label="
                  payload.satuSehatId && payload.satuSehatId.trim() !== ''
                    ? 'AKTIF'
                    : 'NON-AKTIF'
                "
                :textColor="
                  payload.satuSehatId && payload.satuSehatId.trim() !== ''
                    ? 'text-white'
                    : 'text-[#80868d]'
                "
                :bgColor="
                  payload.satuSehatId && payload.satuSehatId.trim() !== ''
                    ? 'bg-opensimrs-300'
                    : 'bg-white'
                "
                :borderColor="
                  payload.satuSehatId && payload.satuSehatId.trim() !== ''
                    ? 'border-none'
                    : 'border-[#80868d]'
                "
                :icon-color="
                  payload.satuSehatId && payload.satuSehatId.trim() !== ''
                    ? 'white'
                    : '#80868d'
                "
                customClass="text-xs font-semibold h-5 flex w-fit"
              />
            </template>
          </CustomInfoRow>
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
