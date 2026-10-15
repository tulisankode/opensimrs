<script lang="ts" setup>
import { ref, watch, onMounted } from "vue";
import { useForm } from "vee-validate";
import { useLokasiStore } from "@/stores/datamaster/lokasi";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
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

const lokasiStore = useLokasiStore();
const lokasiPayload = ref<any[]>([]);
const optionsTipe = ref(["Site", "Building", "Level", "Ward", "Room", "Bed"]);

const optionsKelas = ref([
  { label: "Kelas1", value: "1" },
  { label: "Kelas2", value: "2" },
  { label: "Kelas3", value: "3" },
  { label: "Kelas VIP", value: "vip" },
  { label: "Kelas VVIP", value: "vvip" },
  { label: "Kelas Reguler", value: "reguler" },
  { label: "Kelas Eksekutif", value: "eksekutif" },
]);
const fetchLokasi = async () => {
  try {
    const response = await lokasiStore.getApi();
    if (response && response.payload) {
      lokasiPayload.value = response.payload;
    } else {
      lokasiPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch kategori ruangan", error);
    lokasiPayload.value = [];
  }
};
onMounted(() => {
  fetchLokasi();
});
const phoneRegExp =
  /^((\\+[1-9]{1,4}[ \\-]*)|(\\([0-9]{2,3}\\)[ \\-]*)|([0-9]{2,4})[ \\-]*)*?[0-9]{3,4}?[ \\-]*[0-9]{3,4}?$/;
const schema = toTypedSchema(
  yup
    .object({
      code: yup.string().required("Kode Lokasi harus diisi"),
      name: yup.string().required("Nama lokasi harus diisi"),
      description: yup.string().required("Deskripsi harus diisi"),
      phone: yup
        .string()
        .required("No. Telepon harus diisi")
        .matches(phoneRegExp, "Format tidak sesuai"),
      email: yup
        .string()
        .required("Email harus diisi")
        .email("Format email tidak sesuai"),
      url: yup
        .string()
        .required("URL Website harus diisi")
        .matches(/^https:\/\//, "URL harus dimulai dengan https://"),
      orgId: yup.string().notRequired(),
      locationType: yup.string().required("Tipe harus diisi"),
      classCode: yup.string().notRequired(),
      className: yup.string().notRequired(),
      partOfName: yup.string().notRequired(),
      partOf: yup.string().notRequired(),
      codeAntrianPoli: yup.string().when("isPoli", {
        is: (value: boolean) => value === true,
        then: (schema) => schema.required("Kode Antrian harus diisi"),
        otherwise: (schema) => schema.notRequired(),
      }),
      statusOperasional: yup.bool().default(false),
      isPoli: yup.bool().default(false),
      status: yup.bool().default(true),
    })
    .noUnknown()
);

const { errors, handleSubmit, defineField, resetForm, setValues } = useForm({
  validationSchema: schema,
});

const [code] = defineField("code");
const [name] = defineField("name");
const [description] = defineField("description");
const [phone] = defineField("phone");
const [email] = defineField("email");
const [url] = defineField("url");
const [orgId] = defineField("orgId");
const [locationType] = defineField("locationType");
const [classCode] = defineField("classCode");
const [className] = defineField("className");
const [partOfName] = defineField("partOfName");
const [partOf] = defineField("partOf");
const [statusOperasional] = defineField("statusOperasional");
const [codeAntrianPoli] = defineField("codeAntrianPoli");
const [isPoli] = defineField("isPoli");
const [status] = defineField("status");

const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);
const onSubmit = handleSubmit(async (values: any) => {
  try {
    values.statusOperasional = statusOperasional.value
      ? "occupied"
      : "non-occupied";

    if (method.value === "edit") {
      if (!props.payload || !props.payload.uuid) {
        throw new Error("UUID is missing for edit operation");
      }
      const uuid = props.payload.uuid;
      console.log("Data updated successfully:", values);

      const response = await lokasiStore.putApi(uuid, values);
      console.log("Data updated successfully:", response);
      emit("data-updated");
    } else if (method.value === "add") {
      console.log("Adding new data with values:", values);
      const response = await lokasiStore.postApi(values);
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

watch(isPoli, (newValue) => {
  if (!newValue) {
    setValues({
      codeAntrianPoli: "",
    });
  }
});

const selectedPartOf = () => {
  const selectedItem = lokasiPayload.value.find(
    (item) => item.uuid === partOf.value
  );
  partOfName.value = selectedItem ? selectedItem.name : "";
};
const selectedClass = () => {
  const selectedItem = optionsKelas.value.find(
    (item) => item.value === classCode.value
  );
  className.value = selectedItem ? selectedItem.label : "";
};

watch(
  () => props.isDialogVisible,
  (newValue) => {
    if (newValue) {
      fetchLokasi();
      resetDialogMode();
      if (props.method !== "add" && props.payload) {
        setValues({
          ...props.payload,
          statusOperasional:
            props.payload.statusOperasional === "occupied" ? true : false,
        });
      }
    } else {
      resetForm();
      resetDialogMode();
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
    <template #header>{{ title }} Lokasi</template>
    <template #body>
      <!-- Form Input -->
      <div v-if="method !== 'detail'" class="grid grid-cols-12 gap-5 mt-5">
        <CustomTextfield
          label="Kode Lokasi"
          v-model="code"
          placeholder="Kode Lokasi"
          :invalid="!!errors.code"
          :invalidMessage="errors.code"
          class="col-span-4"
          :required="errors.code ? true : false"
        />
        <CustomTextfield
          label="Nama Lokasi"
          v-model="name"
          placeholder="Nama Lokasi"
          class="col-span-8"
          :invalid="!!errors.name"
          :invalidMessage="errors.name"
          :required="errors.name ? true : false"
        />
        <CustomSwitch
          v-model="isPoli"
          :show-label="true"
          label="Poli"
          sideLabel="Tidak"
          sideLabelTrue="Iya"
          class="col-span-4"
        />
        <CustomTextfield
          v-model="codeAntrianPoli"
          label="Kode Antrian Poli"
          placeholder="Kode Antrian Poli"
          class="col-span-8"
          :disabled="!isPoli"
          :invalid="isPoli && !!errors.codeAntrianPoli"
          :invalidMessage="errors.codeAntrianPoli"
          :required="errors.codeAntrianPoli ? true : false"
        />
        <CustomTextfield
          v-model="description"
          label="Deskripsi"
          placeholder="Deskripsi"
          :invalid="!!errors.description"
          :invalidMessage="errors.description"
          class="col-span-12"
          :required="errors.description ? true : false"
        />
        <CustomTextfield
          label="No. Telepon"
          v-model="phone"
          placeholder="08xx-xxxx-xxxx"
          class="col-span-6"
          :invalid="!!errors.phone"
          :invalidMessage="errors.phone"
          :required="errors.phone === 'No. Telepon harus diisi' ? true : false"
        />
        <CustomTextfield
          v-model="email"
          label="Email"
          placeholder="Email"
          class="col-span-6"
          :invalid="!!errors.email"
          :invalidMessage="errors.email"
          :required="errors.email === 'Email harus diisi' ? true : false"
        />
        <CustomTextfield
          label="URL Website"
          v-model="url"
          placeholder="URL Website"
          class="col-span-6"
          :invalid="!!errors.url"
          :invalidMessage="errors.url"
          :required="errors.url === 'URL Website harus diisi' ? true : false"
        />
        <CustomSelect
          label="Tipe"
          v-model="locationType"
          place-holder="Pilih Tipe"
          class="col-span-6"
          :options="optionsTipe"
          optionValue=""
          optionLabel=""
          :invalid="!!errors.locationType"
          :invalidMessage="errors.locationType"
          :required="errors.locationType ? true : false"
        />
        <CustomSelect
          label="Kelas"
          v-model="classCode"
          place-holder="Pilih Kelas"
          class="col-span-6"
          :options="optionsKelas"
          optionValue="value"
          optionLabel="label"
          @update:modelValue="selectedClass"
        />
        <CustomSelect
          label="Part Of"
          v-model="partOf"
          @update:modelValue="selectedPartOf"
          place-holder="Pilih Part Of"
          class="col-span-6"
          :options="lokasiPayload"
          optionValue="uuid"
          optionLabel="name"
        />
        <hr class="col-span-12 border-grey-200" />
        <CustomSwitch
          v-model="statusOperasional"
          :show-label="true"
          label="Status Operasional"
          sideLabel="Non-Occupied"
          sideLabelTrue="Occupied"
          class="col-span-6"
        />
        <CustomSwitch
          v-model="status"
          :show-label="true"
          label="Status"
          sideLabel="Non-Aktif"
          sideLabelTrue="Aktif"
          class="col-span-6"
        />
      </div>
      <!-- Detail Data -->
      <div v-if="method === 'detail'" class="flex flex-col gap-5 mt-5">
        <CustomInfoRow label="Kode Lokasi" :value="code" />
        <CustomInfoRow label="Nama Lokasi" :value="name" />
        <CustomInfoRow label="Deskripsi" :value="description" />
        <CustomInfoRow label="No. Telephone" :value="payload.phone" />
        <CustomInfoRow label="Url" :value="url" />
        <CustomInfoRow label="Tipe" :value="payload.locationType" />
        <CustomInfoRow label="Kelas" :value="payload.className ?? '-'" />
        <CustomInfoRow label="Part of Id" :value="partOf ?? '-'" />
        <CustomInfoRow
          label="Part of Name"
          :value="payload.partOfName ?? '-'"
        />
        <CustomInfoRow
          label="IHS No. Organization"
          :value="payload.organizationIhsNumber ?? '-'"
        />
        <CustomInfoRow
          label="ID SATUSEHAT"
          :value="payload.satuSehatId ?? '-'"
        />
        <hr class="border-grey-200" />
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
        <CustomInfoRow label="Status Operasional">
          <template #value>
            <CustomChip
              :label="statusOperasional ? 'AKTIF' : 'NON-AKTIF'"
              :textColor="statusOperasional ? 'text-white' : 'text-[#80868d]'"
              :bgColor="statusOperasional ? 'bg-opensimrs-300' : 'bg-white'"
              :borderColor="
                statusOperasional ? 'border-none' : 'border-[#80868d]'
              "
              :icon-color="statusOperasional ? 'white' : '#80868d'"
              customClass="text-xs font-semibold h-5 flex w-fit"
            />
          </template>
        </CustomInfoRow>
        <CustomInfoRow label="Status SATUSEHAT">
          <template #value>
            <CustomChip
              :label="payload.satuSehatId ? 'AKTIF' : 'NON-AKTIF'"
              :textColor="payload.satuSehatId ? 'text-white' : 'text-[#80868d]'"
              :bgColor="payload.satuSehatId ? 'bg-opensimrs-300' : 'bg-white'"
              :borderColor="
                payload.satuSehatId ? 'border-none' : 'border-[#80868d]'
              "
              :icon-color="payload.satuSehatId ? 'white' : '#80868d'"
              customClass="text-xs font-semibold h-5 flex w-fit"
            />
          </template>
        </CustomInfoRow>
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
