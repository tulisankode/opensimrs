<script lang="ts" setup>
import { ref, watch, onMounted } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { useOrganisasiStore } from "@/stores/datamaster/organisasi";
import { useDistrictStore } from "@/stores/datamaster/district";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";

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

const organisasiStore = useOrganisasiStore();
const organisasiPayload = ref<any[]>([]);

const districtStore = useDistrictStore();
const provinsiPayload = ref<any[]>([]);
const kabupatenPayload = ref<any[]>([]);
const kecamatanPayload = ref<any[]>([]);
const kelurahanPayload = ref<any[]>([]);

const fetchOrganisasi = async () => {
  try {
    const response = await organisasiStore.getApi(1, 9999);
    if (response && response.payload) {
      organisasiPayload.value = response.payload;
    } else {
      organisasiPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch kategori ruangan", error);
    organisasiPayload.value = [];
  }
};
// Fetch Provinsi
const fetchProvinsi = async () => {
  try {
    const response = await districtStore.getProvinsiApi(); // Ambil data provinsi
    if (response && response.payload) {
      provinsiPayload.value = response.payload;
    } else {
      provinsiPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch provinsi", error);
    provinsiPayload.value = [];
  }
};

// Fetch Kabupaten berdasarkan Provinsi terpilih
const fetchKabupaten = async (provinsiId: string) => {
  try {
    const response = await districtStore.getKabupatenApi(provinsiId); // Berikan ID provinsi sebagai parameter
    if (response && response.payload) {
      kabupatenPayload.value = response.payload;
    } else {
      kabupatenPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch kabupaten", error);
    kabupatenPayload.value = [];
  }
};

// Fetch Kecamatan berdasarkan Kabupaten terpilih
const fetchKecamatan = async (kabupatenId: string) => {
  try {
    const response = await districtStore.getKecamatanApi(kabupatenId); // Berikan ID kabupaten sebagai parameter
    if (response && response.payload) {
      kecamatanPayload.value = response.payload;
    } else {
      kecamatanPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch kecamatan", error);
    kecamatanPayload.value = [];
  }
};

// Fetch Kelurahan berdasarkan Kecamatan terpilih
const fetchKelurahan = async (kecamatanId: string) => {
  try {
    const response = await districtStore.getKelurahanApi(kecamatanId); // Berikan ID kecamatan sebagai parameter
    if (response && response.payload) {
      kelurahanPayload.value = response.payload;
    } else {
      kelurahanPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch kelurahan", error);
    kelurahanPayload.value = [];
  }
};
onMounted(() => {
  fetchProvinsi();
});
const phoneRegExp =
  /^((\\+[1-9]{1,4}[ \\-])|(\\([0-9]{2,3}\\)[ \\-])|([0-9]{2,4})[ \\-])?[0-9]{3,4}?[ \\-]*[0-9]{3,4}?$/;
const schema = toTypedSchema(
  yup
    .object({
      code: yup.string().required("Kode Organisasi harus diisi"),
      name: yup.string().required("Nama Organisasi harus diisi"),
      phone: yup
        .string()
        .required("No. Telepon harus diisi")
        .matches(/^(\+62|62|0)8[1-9][0-9]{6,9}$/, "Format tidak sesuai"),
      email: yup
        .string()
        .required("Email harus diisi")
        .email("Format email tidak sesuai"),
      url: yup
        .string()
        .required("URL harus diisi")
        .matches(/^https:\/\//, "URL harus dimulai dengan https://"),
      partOfName: yup.string().notRequired(),
      partOfUuid: yup.string().notRequired(),
      status: yup.bool().default(true),
      address: yup.object({
        fullAddress: yup.string().required("Alamat harus diisi"),
        prov: yup.string().required("Provinsi harus dipilih"),
        city: yup.string().required("Kab/Kota harus dipilih"),
        district: yup.string().required("Kecamatan harus dipilih"),
        village: yup.string().required("Kelurahan harus dipilih"),
        postalCode: yup.string().required("Kode Pos harus diisi"),
        country: yup.string().default("Indonesia"),
      }),
      satuSehatId: yup.string().notRequired(),
      organizationIhsNumber: yup.string().notRequired(),
    })
    .noUnknown()
);

const { errors, handleSubmit, defineField, resetForm, setValues } = useForm({
  validationSchema: schema,
});

const [code] = defineField("code");
const [name] = defineField("name");
const [phone] = defineField("phone");
const [email] = defineField("email");
const [url] = defineField("url");
const [status] = defineField("status");
const [kodePos] = defineField("address.postalCode");
const [alamat] = defineField("address.fullAddress");
const [partOfName] = defineField("partOfName");
const [partOfUuid] = defineField("partOfUuid");
const [provinsi] = defineField("address.prov");
const [kabupaten] = defineField("address.city");
const [kecamatan] = defineField("address.district");
const [kelurahan] = defineField("address.village");
const [satuSehatId] = defineField("satuSehatId");
const [organizationIhsNumber] = defineField("organizationIhsNumber");

const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);

const onSubmit = handleSubmit(async (values: any) => {
  try {
    if (!values.partOfUuid) {
      delete values.partOfUuid;
    }
    if (method.value === "edit") {
      if (!props.payload || !props.payload.uuid) {
        throw new Error("UUID is missing for edit operation");
      }
      const uuid = props.payload.uuid;
      const response = await organisasiStore.putApi(uuid, values);
      console.log("Data updated successfully:", response);
      emit("data-updated");
    } else if (method.value === "add") {
      console.log("Adding new data with values:", values);
      const response = await organisasiStore.postApi(values);
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

const onProvinsiUpdate = async (newProvinsi: string) => {
  await fetchKabupaten(newProvinsi);
  kabupaten.value = "";
  kecamatan.value = "";
  kelurahanPayload.value = [];
};

const onKabupatenUpdate = async (newKabupaten: string) => {
  await fetchKecamatan(newKabupaten);
  kecamatan.value = "";
  kelurahanPayload.value = [];
};

const onKecamatanUpdate = async (newKecamatan: string) => {
  await fetchKelurahan(newKecamatan);
};

const getName = (code: string | undefined, payload: any[]) => {
  if (code) {
    const tempData = payload.find((item: any) => item.code == code);
    return tempData ? tempData.name : "-";
  }
  return "-";
};

watch(
  () => props.isDialogVisible,
  async (newValue) => {
    if (newValue) {
      resetDialogMode();
      fetchOrganisasi();

      // Check if we are editing, and if so, set initial values
      if (props.method !== "add" && props.payload) {
        setValues({
          ...props.payload,
        });
        if (props.payload) {
          // Set provinsi
          provinsi.value = props.payload?.provinceCode as string;
          await fetchKabupaten(provinsi.value);

          // Set kabupaten
          kabupaten.value = props.payload?.cityCode as string;
          await fetchKecamatan(kabupaten.value);

          // Set kecamatan
          kecamatan.value = props.payload?.districtCode as string;
          await fetchKelurahan(kecamatan.value);

          // Set kelurahan
          kelurahan.value = props.payload?.villageCode as string;

          kodePos.value = props.payload?.postalCode as string;
          alamat.value = props.payload?.fullAddress as string;
        }
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
    <template #header>{{ title }} Organisasi</template>
    <template #body>
      <!-- Form Input -->
      <div v-if="method !== 'detail'" class="grid grid-cols-12 gap-5 mt-5">
        <CustomTextfield
          label="Kode Organisasi"
          v-model="code"
          placeholder="Kode Organisasi"
          class="col-span-4"
          :invalid="!!errors.code"
          :invalidMessage="errors.code"
          :required="errors.code ? true : false"
        />
        <CustomTextfield
          label="Nama Organisasi"
          v-model="name"
          placeholder="Nama Organisasi"
          class="col-span-8"
          :invalid="!!errors.name"
          :invalidMessage="errors.name"
          :required="errors.name ? true : false"
        />
        <CustomTextfield
          label="No. Telepon"
          v-model="phone"
          placeholder="0"
          class="col-span-4"
          :invalid="!!errors.phone"
          :invalidMessage="errors.phone"
          :required="errors.phone === 'No. Telepon harus diisi' ? true : false"
        />
        <CustomTextfield
          label="Email"
          v-model="email"
          placeholder="Email"
          class="col-span-8"
          :invalid="!!errors.email"
          :invalidMessage="errors.email"
          :required="errors.email === 'Email harus diisi' ? true : false"
        />
        <CustomTextfield
          label="URL"
          v-model="url"
          placeholder="URL"
          class="col-span-12"
          :invalid="!!errors.url"
          :invalidMessage="errors.url"
          :required="errors.url === 'URL harus diisi' ? true : false"
        />
        <CustomSelect
          label="Provinsi"
          v-model="provinsi"
          place-holder="Pilih Provinsi"
          class="col-span-6"
          :options="provinsiPayload"
          option-label="name"
          option-value="code"
          @update:modelValue="onProvinsiUpdate"
          :invalid="!!errors['address.prov']"
          :invalidMessage="errors['address.prov']"
          :required="errors['address.prov'] ? true : false"
        />
        <CustomSelect
          label="Kab/Kota"
          v-model="kabupaten"
          place-holder="Pilih Kab/Kota"
          class="col-span-6"
          :options="kabupatenPayload"
          option-label="name"
          option-value="code"
          @update:modelValue="onKabupatenUpdate"
          :invalid="!!errors['address.city']"
          :invalidMessage="errors['address.city']"
          :required="errors['address.city'] ? true : false"
        />
        <CustomSelect
          label="Kecamatan"
          v-model="kecamatan"
          place-holder="Pilih Kecamatan"
          class="col-span-6"
          :options="kecamatanPayload"
          option-label="name"
          option-value="code"
          @update:modelValue="onKecamatanUpdate"
          :invalid="!!errors['address.district']"
          :invalidMessage="errors['address.district']"
          :required="errors['address.district'] ? true : false"
        />
        <CustomSelect
          label="Kelurahan/Desa"
          v-model="kelurahan"
          place-holder="Pilih Kelurahan/Desa"
          class="col-span-6"
          :options="kelurahanPayload"
          option-label="name"
          option-value="code"
          :invalid="!!errors['address.village']"
          :invalidMessage="errors['address.village']"
          :required="errors['address.village'] ? true : false"
        />
        <CustomTextfield
          label="Kode Pos"
          v-model="kodePos"
          placeholder="Kode Pos"
          class="col-span-4"
          :invalid="!!errors['address.postalCode']"
          :invalidMessage="errors['address.postalCode']"
          :required="errors['address.postalCode'] ? true : false"
        />
        <CustomTextfield
          label="Alamat"
          v-model="alamat"
          placeholder="Alamat"
          class="col-span-8"
          :invalid="!!errors['address.fullAddress']"
          :invalidMessage="errors['address.fullAddress']"
          :required="errors['address.fullAddress'] ? true : false"
        />
        <CustomSelect
          label="Part Of"
          v-model="partOfUuid"
          place-holder="Pilih Part Of"
          class="col-span-12"
          :options="organisasiPayload"
          optionValue="uuid"
          optionLabel="name"
        />
        <!-- <CustomTextfield
          label="ID SATUSEHAT"
          v-model="satuSehatId"
          placeholder="ID SATUSEHAT"
          class="col-span-12"
          :invalid="!!errors.satuSehatId"
          :invalidMessage="errors.satuSehatId"
        /> -->
        <!-- <CustomTextfield
          label="IHS No. Organization"
          v-model="organizationIhsNumber"
          placeholder="IHS No. Organization"
          class="col-span-12"
          :invalid="!!errors.organizationIhsNumber"
          :invalidMessage="errors.organizationIhsNumber"
        /> -->
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
        <!-- {{ payload }} -->
        <div class="font-bold leading-8 text-heading">Data Organisasi</div>
        <hr class="border-grey-200" />
        <CustomInfoRow label="Kode Organisasi" :value="payload.code" />
        <CustomInfoRow label="Nama Organisasi" :value="payload.name" />
        <CustomInfoRow label="No. Telephone" :value="payload.phone" />
        <CustomInfoRow label="E-mail" :value="payload.email" />
        <CustomInfoRow label="URL" :value="payload.url" />
        <CustomInfoRow
          label="Provinsi"
          :value="getName(payload?.provinceCode, provinsiPayload)"
        />
        <CustomInfoRow
          label="Kab/Kota"
          :value="getName(payload?.cityCode, kabupatenPayload)"
        />
        <CustomInfoRow
          label="Kecamatan"
          :value="getName(payload?.districtCode, kecamatanPayload)"
        />
        <CustomInfoRow
          label="Kelurahan/Desa"
          :value="getName(payload?.villageCode, kelurahanPayload)"
        />
        <CustomInfoRow label="Kode Pos" :value="payload?.postalCode ?? '-'" />
        <CustomInfoRow label="Alamat" :value="payload?.fullAddress ?? '-'" />
        <CustomInfoRow label="Part Of Id" :value="payload?.partOf ?? '-'" />
        <CustomInfoRow
          label="Part Of Name"
          :value="payload.partOfName ?? '-'"
        />
        <CustomInfoRow
          label="ID SATUSEHAT"
          :value="payload.satuSehatId ?? '-'"
        />
        <CustomInfoRow
          label="IHS No. Organization"
          :value="payload.organizationIhsNumber ?? '-'"
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
