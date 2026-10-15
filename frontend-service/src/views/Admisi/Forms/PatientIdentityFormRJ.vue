<script setup lang="ts">
import { computed, onMounted, onUpdated, ref, type PropType } from "vue";
import { fiturAktif } from "@/stores/modulFaskes";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import * as yup from "yup";
import { toTypedSchema } from "@vee-validate/yup";
import { useForm } from "vee-validate";
import { utilsStore } from "@/stores/utils";
import { useAdmisiMasterPasienStore } from "@/stores/admisi/masterPasien";
import { useDistrictStore } from "@/stores/datamaster/district";
import { countAge } from "@/utils/Helpers";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";

// NOTE Store
const storeUtils = utilsStore();
const masterPasienStore = useAdmisiMasterPasienStore();
const districtStore = useDistrictStore();

const props = defineProps({
  pageType: {
    type: String,
    required: true,
  },
  formType: {
    type: String,
    default: "",
  },
  isDetail: {
    type: Boolean,
    required: false,
  },
  patientData: {
    type: Object as PropType<any>,
    required: false,
  },
});

const fetchProvinsi = async () => {
  try {
    const response = await districtStore.getProvinsiApi(); 
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

const fetchKabupaten = async (provinsiId: string) => {
  try {
    const response = await districtStore.getKabupatenApi(provinsiId);
    if (response && response.payload) {
      kabupatenPayload.value = response.payload;
    } else {
      kabupatenPayload.value = [];
    }
    addressCity.value = undefined;
    addressDistrict.value = undefined;
    addressVillage.value = undefined;
  } catch (error) {
    console.error("Failed to fetch kabupaten", error);
    kabupatenPayload.value = [];
  }
};

const fetchKecamatan = async (kabupatenId: string) => {
  try {
    const response = await districtStore.getKecamatanApi(kabupatenId);
    if (response && response.payload) {
      kecamatanPayload.value = response.payload;
    } else {
      kecamatanPayload.value = [];
    }
    addressDistrict.value = undefined;
    addressVillage.value = undefined;
  } catch (error) {
    console.error("Failed to fetch kecamatan", error);
    kecamatanPayload.value = [];
  }
};

const fetchKelurahan = async (kecamatanId: string) => {
  try {
    const response = await districtStore.getKelurahanApi(kecamatanId); 
    if (response && response.payload) {
      kelurahanPayload.value = response.payload;
    } else {
      kelurahanPayload.value = [];
    }
    addressVillage.value = undefined;
  } catch (error) {
    console.error("Failed to fetch kelurahan", error);
    kelurahanPayload.value = [];
  }
};

const provinsiPayload = ref<any[]>([]);
const kabupatenPayload = ref<any[]>([]);
const kecamatanPayload = ref<any[]>([]);
const kelurahanPayload = ref<any[]>([]);

const setFormData = async (data: any, uuid: string = "") => {
  if (Object.keys(data).length) {
    let tempPatientData = data;

    if (tempPatientData.address && tempPatientData.address.country === 'Indonesia') {
      tempPatientData.address.country = 'id-ID';
    }

    if (tempPatientData.language === 'Indonesian') {
      tempPatientData.language = 'ID';
    }

    await fetchKabupaten(tempPatientData.address.prov);
    await fetchKecamatan(tempPatientData.address.city);
    await fetchKelurahan(tempPatientData.address.district);

    tempPatientData.birthDetail.birthDate = new Date(
      tempPatientData.birthDetail.birthDate
    );
    if (uuid) {
      tempPatientData.patientUuid = uuid;
    }
    setValues({
      ...tempPatientData,
    });
    patientAge.value = `${tempPatientData.birthDetail.ageYear} Tahun, ${tempPatientData.birthDetail.ageMonth} Bulan, ${tempPatientData.birthDetail.ageDay} Hari`;
  }
};

onMounted(() => {
  setFormData(props.patientData);
  fetchProvinsi();
});

onUpdated(() => {
  setFormData(props.patientData);
  fetchProvinsi();
});

const timer = ref<any>();
const listDataPatient = ref([]);
const loadingSearchPatient = ref(false);
const searchPatientData = async (query: string = "") => {
  
  loadingSearchPatient.value = true;  
  try {
    const response = await masterPasienStore.getMasterPasien({
      q: query,
      limit: 9999,
      status: 'aktif'
    });
    if (response && response.payload) {
      listDataPatient.value = response.payload.map((patient: { name: any; noRm: any; }) => {
        return {
          ...patient,
          searchableText: `${patient.name} ${patient.noRm}` 
        };
      });
    } else {
      listDataPatient.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    listDataPatient.value = [];
  } finally {
    loadingSearchPatient.value = false;
  }
};

const fetchInitialPatientList = () => {
  if (listDataPatient.value.length === 0) {
    searchPatientData("");
  }
};

const setSelectedPatientData = async (data: any) => {
  if (data) {
    storeUtils.setLoading(true);
    try {
      const response = await masterPasienStore.getDetailMasterPasien(data.uuid);
      if (response && response.payload) {
        setFormData(response.payload, data.uuid);
      }
    } catch (error) {
      console.error("Failed to process the data:", error);
    } finally {
      storeUtils.setLoading(false);
    }
  }
};

const selectedDataPatient = ref<any>();
const patientAge = ref("");

// Pendaftaran Ringkas (fitur daftar_ringkas, praktik mandiri): pendaftaran baru hanya meminta data inti
// (nama, identitas, tgl lahir, jenis kelamin, HP, alamat). Data administratif opsional lewat "Isi data lengkap".
const isiLengkap = ref(false);
const modeRingkas = computed(
  () =>
    fiturAktif("daftar_ringkas") &&
    !isiLengkap.value &&
    !props.isDetail &&
    !["Edit Data Pasien", "Detail Edit", "Detail"].includes(props.formType)
);
// Selama fitur aktif, field administratif opsional juga saat edit (pasien ringkas tetap bisa diedit tanpa melengkapinya).
const wajib = (pesan: string) => yup.string().test("wajib", pesan, (v) => fiturAktif("daftar_ringkas") || !!v);

const schema = toTypedSchema(
  yup
    .object({
      patientUuid: yup.string(),
      noRm: yup.string(),
      title: yup.string().required("Awalan/Gelar harus dipilih"),
      name: yup.string().required("Nama lengkap harus diisi"),
      identity: yup.string().required("Identitas harus dipilih"),
      noIdentity: yup
          .string()
          .required("No identitas harus diisi")
          .when(["identity"], (identityValues, schema) => {
            const identity = Array.isArray(identityValues)
              ? identityValues[0]
              : identityValues;

            if (identity === "KTP") {
              return schema.min(16, "No identitas KTP minimal 16 karakter");
            }

            if (identity === "Passport") {
              return schema
                .min(9, "No identitas Passport minimal 9 karakter")
                .matches(
                  /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]+$/,
                  "No identitas Passport harus mengandung huruf dan angka"
                );
            }

            return schema;
          }),
      birthDetail: yup
        .object({
          birthPlace: wajib("Tempat lahir harus diisi"),
          birthDate: yup.date().required("Tanggal lahir harus dipilih"),
        })
        .noUnknown(),
      gender: yup.string().required("Jenis kelamin harus dipilih"),
      phone: yup.string().required("No. Handphone harus diisi"),
      religion: wajib("Agama harus dipilih"),
      language: yup.string().nullable(),
      maritialStatus: wajib("Status pernikahan harus dipilih"),
      motherName: wajib("Nama ibu kandung harus diisi"),
      status: yup.boolean().default(true),
      address: yup
        .object({
          prov: wajib("Provinsi harus dipilih"),
          city: wajib("Kabupaten / Kota harus dipilih"),
          district: wajib("Kecamatan harus dipilih"),
          rt: yup.string().nullable(),
          rw: yup.string().nullable(),
          fullAddress: yup.string().required("Alamat harus diisi"),
          country: wajib("Negara harus diisi"),
          village: wajib("Kelurahan / Desa harus dipilih"),
          postalCode: yup.string().nullable(),
        })
        .noUnknown(),
    })
    .noUnknown()
);


const { errors, handleSubmit, defineField, resetForm, setValues, values } = useForm({
  validationSchema: schema,
});

const getFormData = () => {
  return {
    ...values,
    patientAge: patientAge.value,
  };
};

const [noRm] = defineField("noRm");
const [title] = defineField("title");
const [name] = defineField("name");
const [identity] = defineField("identity");
const [noIdentity] = defineField("noIdentity");
const [birthDetailPlace] = defineField("birthDetail.birthPlace");
const [birthDetailDate] = defineField("birthDetail.birthDate");
const [gender] = defineField("gender");
const [phone] = defineField("phone");
const [religion] = defineField("religion");
const [language] = defineField("language");
const [maritialStatus] = defineField("maritialStatus");
const [motherName] = defineField("motherName");
const [addressProv] = defineField("address.prov");
const [addressCity] = defineField("address.city");
const [addressDistrict] = defineField("address.district");
const [addressRt] = defineField("address.rt");
const [addressRw] = defineField("address.rw");
const [addressFullAddress] = defineField("address.fullAddress");
const [addressCountry] = defineField("address.country");
const [addressVillage] = defineField("address.village");
const [addressPostalCode] = defineField("address.postalCode");
const [status] = defineField("status");

const onSubmit = handleSubmit(async (values) => {
  // RT/RW, kode pos & bahasa tidak wajib di formulir; backend tetap menerima string kosong
  if (!values.language) values.language = "ID";
  // Field administratif yang dilewati di Pendaftaran Ringkas dikirim sebagai string kosong (backend mewajibkan string).
  const v: any = values;
  v.birthDetail = { ...v.birthDetail, birthPlace: v.birthDetail?.birthPlace || "" };
  v.religion = v.religion || "";
  v.maritialStatus = v.maritialStatus || "";
  v.motherName = v.motherName || "";
  v.address = {
    ...v.address,
    prov: v.address?.prov || "",
    city: v.address?.city || "",
    district: v.address?.district || "",
    village: v.address?.village || "",
    country: v.address?.country || "id-ID",
    rt: v.address?.rt || "",
    rw: v.address?.rw || "",
    postalCode: v.address?.postalCode || "",
  };
  return values;
});
const onResetForm = () => {
  resetForm();
};

const getAge = (date: Date) => {
  const { tahun, bulan, hari } = countAge(date);
  patientAge.value = `${tahun} Tahun, ${bulan} Bulan, ${hari} Hari`;
};

defineExpose({
  onSubmit,
  onResetForm,
  getFormData,
});
</script>

<template>
  <CustomAccordion :openWithHeader="false" initialState="0">
    <template #header>
      <div class="flex justify-between w-full align-middle">
        <div class="flex">
          <span class="leading-10 text-opensimrs-300 text-heading">
            Identitas Pasien
          </span>
        </div>
      </div>
    </template>
    <template #content>
      <div class="pt-5">
        <div class="flex">
          <CustomSelect
            v-if="
              formType != 'Checkin' &&
              formType != 'Edit Data Pasien' &&
              formType != 'Detail Edit' &&
              formType != 'Detail'
            "
            v-model="selectedDataPatient"
            @update:model-value="setSelectedPatientData"
            label="Cari Nama / No. RM"
            placeHolder="Cari Nama / No. RM"
            class="grow mr-[30px]"
            :class="{ '': pageType != 'datamaster' }"
            optionLabel="searchableText"
            optionValue=""
            :options="listDataPatient"
            prependIcon="PhMagnifyingGlass"
            :disabled="isDetail"
            :isLoading="loadingSearchPatient"
            @filter="searchPatientData"
            @click="fetchInitialPatientList"
          >
            <template #customOptions="{ option }">
              {{ option.name }} ~ {{ option.noRm }}
            </template>
          </CustomSelect>
          <div
            v-if="
              pageType != 'rawat-inap' &&
              formType != 'Edit Data Pasien' &&
              formType != 'Detail Edit' &&
              formType != 'Detail'
            "
            class="border-[1px] border-grey-200 mr-[35px]"
          ></div>
          <CustomTextfield
            v-model="noRm"
            label="No. RM"
            class="w-[23.5%]"
            placeholder="No. RM"
            readOnly
          />
        </div>
        <hr class="mt-5 mb-[30px]" />
        <div class="flex mb-5">
          <CustomSelect
            v-model="title"
            label="Awalan / Gelar"
            placeHolder="Pilih Awalan / Gelar"
            class="pr-[20px] w-1/4"
            optionLabel=""
            optionValue=""
            :showFilter="false"
            :options="[
              'Tn. (Tuan)',
              'Ny. (Nyonya)',
              'Sdr. (Saudara)',
              'Nn. (Nona)',
              'An. (Anak)',
              'By. (Bayi)',
            ]"
            :disabled="isDetail"
            :invalid="!!errors.title"
            :invalidMessage="errors.title"
          />
          <div class="flex ml-[10px] grow">
            <CustomTextfield
              v-model="name"
              label="Nama Lengkap"
              class="w-full mr-[30px]"
              placeholder="Nama Lengkap"
              :disabled="isDetail"
              :invalid="!!errors.name"
              :invalidMessage="errors.name"
            />
            <CustomSelect
              v-model="identity"
              label="Identitas"
              placeHolder="Pilih Identitas"
              class="mr-[10px]"
              optionLabel=""
              optionValue=""
              :showFilter="false"
              :options="['KTP', 'Passport', 'SIM', 'Lainya']"
              :disabled="isDetail"
              :invalid="!!errors.identity"
              :invalidMessage="errors.identity"
            />
          </div>
          <CustomTextfield
            v-model="noIdentity"
            label=" "
            class="w-[23.5%] mt-5"
            placeholder="KTP"
            :disabled="isDetail"
            :invalid="!!errors.noIdentity"
            :invalidMessage="errors.noIdentity"
          />
        </div>
        <div class="grid grid-cols-4 gap-y-5 gap-x-[30px]">
          <!-- Row 1 -->
          <CustomTextfield
            v-if="!modeRingkas"
            v-model="birthDetailPlace"
            label="Tempat Lahir"
            class=""
            placeholder="Tempat Lahir"
            :disabled="isDetail"
            :invalid="!!errors['birthDetail.birthPlace']"
            :invalidMessage="errors['birthDetail.birthPlace']"
          />
          <CustomDatePicker manualInput
            v-model="birthDetailDate"
            @update:model-value="getAge"
            :maxDate="new Date()"
            label="Tanggal Lahir"
            placeHolder="01-01-2024"
            class=""
            :disabled="isDetail"
            :invalid="!!errors['birthDetail.birthDate']"
            :invalidMessage="errors['birthDetail.birthDate']"
          />
          <CustomTextfield
            v-model="patientAge"
            label="Umur"
            class=""
            placeholder="Umur"
            :disabled="isDetail"
            readOnly
          />
          <CustomSelect
            v-model="gender"
            label="Jenis Kelamin"
            placeHolder="Pilih Jenis Kelamin"
            class=""
            optionLabel="label"
            optionValue="value"
            :showFilter="false"
            :options="[
              { label: 'Laki-laki', value: 'Male' },
              { label: 'Perempuan', value: 'Female' },
            ]"
            :disabled="isDetail"
            :invalid="!!errors.gender"
            :invalidMessage="errors.gender"
          />
          <!-- Row 2 -->
          <CustomTextfield
            v-model="phone"
            label="No. Handphone"
            class=""
            placeholder="08XX-XXXX-XXXX"
            :disabled="isDetail"
            :invalid="!!errors.phone"
            :invalidMessage="errors.phone"
          />
          <CustomSelect
            v-if="!modeRingkas"
            v-model="religion"
            label="Agama"
            placeHolder="Pilih Agama"
            class=""
            optionLabel=""
            optionValue=""
            :showFilter="false"
            :options="[
              'Islam',
              'Kristen',
              'Katolik',
              'Hindu',
              'Buddha',
              'Konghucu',
              'Lain-lain',
            ]"
            :disabled="isDetail"
            :invalid="!!errors.religion"
            :invalidMessage="errors.religion"
          />
          <CustomSelect
            v-if="!modeRingkas"
            v-model="addressCountry"
            label="Negara"
            placeHolder="Pilih Negara"
            class=""
            optionLabel="label"
            optionValue="value"
            :showFilter="false"
            :options="[{ label: 'Indonesia', value: 'id-ID' }]"
            :disabled="isDetail"
            :invalid="!!errors['address.country']"
            :invalidMessage="errors['address.country']"
          />
          <CustomSelect
            v-if="!modeRingkas"
            v-model="language"
            label="Bahasa yang Dikuasai"
            placeHolder="Pilih Bahasa yang Dikuasai"
            class=""
            optionLabel="label"
            optionValue="value"
            :showFilter="false"
            :options="[{ label: 'Bahasa Indonesia', value: 'ID' }]"
            :disabled="isDetail"
            :invalid="!!errors.language"
            :invalidMessage="errors.language"
          />
          <!-- Row 3 -->
          <CustomSelect
            v-if="!modeRingkas"
            v-model="maritialStatus"
            label="Status Pernikahan"
            placeHolder="Pilih Status Pernikahan"
            class=""
            optionLabel=""
            optionValue=""
            :showFilter="false"
            :options="['Belum Kawin', 'Kawin', 'Cerai Hidup', 'Cerai Mati']"
            :disabled="isDetail"
            :invalid="!!errors.maritialStatus"
            :invalidMessage="errors.maritialStatus"
          />
          <CustomTextfield
            v-if="!modeRingkas"
            v-model="motherName"
            label="Nama Ibu Kandung"
            class="col-span-3"
            placeholder="Nama Ibu Kandung"
            :disabled="isDetail"
            :invalid="!!errors.motherName"
            :invalidMessage="errors.motherName"
          />
        </div>
        <hr class="my-[30px]" />
        <div class="grid grid-cols-4 gap-y-5 gap-x-[30px]">
          <template v-if="!modeRingkas">
          <CustomSelect
            v-model="addressProv"
            @update:model-value="fetchKabupaten"
            label="Provinsi"
            placeHolder="Pilih Provinsi"
            class=""
            optionLabel="name"
            optionValue="code"
            :options="provinsiPayload"
            :disabled="isDetail"
            :invalid="!!errors['address.prov']"
            :invalidMessage="errors['address.prov']"
          />
          <CustomSelect
            v-model="addressCity"
            @update:model-value="fetchKecamatan"
            label="Kabupaten / Kota"
            placeHolder="Pilih Kabupaten / Kota"
            class=""
            optionLabel="name"
            optionValue="code"
            :options="kabupatenPayload"
            :disabled="isDetail"
            :invalid="!!errors['address.city']"
            :invalidMessage="errors['address.city']"
          />
          <CustomSelect
            v-model="addressDistrict"
            @update:model-value="fetchKelurahan"
            label="Kecamatan"
            placeHolder="Pilih Kecamatan"
            class=""
            optionLabel="name"
            optionValue="code"
            :options="kecamatanPayload"
            :disabled="isDetail"
            :invalid="!!errors['address.district']"
            :invalidMessage="errors['address.district']"
          />
          <CustomSelect
            v-model="addressVillage"
            label="Kelurahan / Desa"
            placeHolder="Pilih Kelurahan / Desa"
            class=""
            optionLabel="name"
            optionValue="code"
            :options="kelurahanPayload"
            :disabled="isDetail"
            :invalid="!!errors['address.village']"
            :invalidMessage="errors['address.village']"
          />
          <div class="grid grid-cols-2 gap-y-5 gap-x-[30px]">
            <CustomTextfield
              v-model="addressRt"
              label="RT"
              class=""
              placeholder="0"
              :disabled="isDetail"
              :invalid="!!errors['address.rt']"
              :invalidMessage="errors['address.rt']"
            />
            <CustomTextfield
              v-model="addressRw"
              label="RW"
              class=""
              placeholder="0"
              :disabled="isDetail"
              :invalid="!!errors['address.rw']"
              :invalidMessage="errors['address.rw']"
            />
          </div>
          <CustomTextfield
            v-model="addressPostalCode"
            label="Kode Pos"
            placeholder="Kode Pos"
            class=""
            :disabled="isDetail"
            :invalid="!!errors['address.postalCode']"
            :invalidMessage="errors['address.postalCode']"
          />
          </template>
          <CustomTextArea
            v-model="addressFullAddress"
            label="Alamat"
            :class="modeRingkas ? 'col-span-4' : 'col-span-2'"
            placeholder="Alamat"
            height="h-10"
            :disabled="isDetail"
            :invalid="!!errors['address.fullAddress']"
            :invalidMessage="errors['address.fullAddress']"
          />
        </div>
        <button
          v-if="fiturAktif('daftar_ringkas') && !isDetail && !['Edit Data Pasien', 'Detail Edit', 'Detail'].includes(formType)"
          type="button"
          class="mt-4 text-sm font-semibold text-opensimrs-300 underline"
          @click="isiLengkap = !isiLengkap"
        >
          {{ isiLengkap ? "Sembunyikan data tambahan" : "Isi data lengkap (tempat lahir, agama, wilayah, nama ibu, …)" }}
        </button>
        <hr class="my-[30px]" />
          <CustomSwitch
          v-if="formType == 'Edit Data Pasien'"
          v-model="status"
          label="Status Data Pasien"
          sideLabel="Non-Aktif"
          sideLabelTrue="Aktif"
          :disabled="isDetail"
          />
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
