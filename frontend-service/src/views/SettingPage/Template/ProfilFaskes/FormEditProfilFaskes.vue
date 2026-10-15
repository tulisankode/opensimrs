<script setup lang="ts">
import CustomTextfield from "../../../../components/Base/CustomTextfield.vue";
import CustomSelect from "../../../../components/Base/CustomSelect.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import { onMounted, ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { computed } from "vue";
import axios from "axios";
import GreenCard from "../GreenCard.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { useSettingStore } from "@/stores/setting";
import { utilsStore } from "@/stores/utils";
import { useDistrictStore } from "@/stores/datamaster/district";
import CustomDragDrop from "@/components/Base/CustomDragDrop.vue";

const useUtilsStore = utilsStore();
const props = defineProps({
  profilFaskesResponse: {
    type: Object,
    required: true,
  },
  isEditProfilFaskes: {
    type: Boolean,
    required: true,
  },
});

const settingStore = useSettingStore();
const districtStore = useDistrictStore();

const provinsiPayload = ref<any[]>([]);
const kabupatenPayload = ref<any[]>([]);
const kecamatanPayload = ref<any[]>([]);
const kelurahanPayload = ref<any[]>([]);

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

const emit = defineEmits([
  "update:isEditProfilFaskes",
  "update:afterEditProfilFaskes",
]);

// const API_URL_ALAMAT = "https://mq8t8n8x-5000.asse.devtunnels.ms/api/v3/datamaster/";

// Pilihan di select
// const provinces = ref<{ code: string; name: string }[]>([]);
// const regencies = ref<{ code: string; name: string }[]>([]);
// const districts = ref<{ code: string; name: string }[]>([]);
// const villages = ref<{ code: string; name: string }[]>([]);
// const postalCodes = ref<{ id: string; text: string }[]>([]);

const schemaProfilFaskes = computed(() =>
  toTypedSchema(
    yup
      .object({
        code: yup.string().required("Kode wajib diisi"),
        name: yup.string().required("Nama Faskes wajib diisi"),
        fullAddress: yup.string().required("Alamat wajib diisi"),
        addressUuid: yup.string(),
        lat: yup.string(),
        long: yup.string(),
        cover: yup.string(),
        logo: yup.string(),
        bgWarna: yup.string(),
        selectedProvinceId: yup.string().required("Provinsi wajib dipilih"),
        selectedRegencyId: yup.string().required("Kabupaten wajib dipilih"),
        selectedDistrictId: yup.string().required("Kecamatan wajib dipilih"),
        selectedVillageId: yup.string().required("Kelurahan wajib dipilih"),
        postalCodeId: yup.string().required("Kode Pos wajib diisi"),
        phone: yup.string().required("No Telpon wajib diisi"),
        email: yup.string().required("Email wajib diisi"),
        website: yup.string().required("Website wajib diisi"),
        urlGmaps: yup.string().required("Link Google Maps wajib diisi"),
      })
      .noUnknown()
  )
);

const {
  errors: profilFaskesErrors,
  handleSubmit: handleSubmitProfilFaskes,
  defineField: defineFieldProfilFaskes,
  resetForm: resetProfilFaskesForm,
} = useForm({
  validationSchema: schemaProfilFaskes,
  initialValues: {
    code: props.profilFaskesResponse.code,
    name: props.profilFaskesResponse.name,
    fullAddress: props.profilFaskesResponse.address.fullAddress || "",
    addressUuid: props.profilFaskesResponse.addressUuid,
    lat: props.profilFaskesResponse.lat,
    long: props.profilFaskesResponse.long,
    cover: "",
    logo: "",
    bgWarna: "",
    selectedProvinceId: "",
    selectedRegencyId: "",
    selectedDistrictId: "",
    selectedVillageId: "",
    postalCodeId: props.profilFaskesResponse.address.postalCode,
    phone: props.profilFaskesResponse.phone,
    email: props.profilFaskesResponse.email,
    website: props.profilFaskesResponse.website,
    urlGmaps: props.profilFaskesResponse.urlGmaps,
  },
});

const [code] = defineFieldProfilFaskes("code");
const [name] = defineFieldProfilFaskes("name");
const [fullAddress] = defineFieldProfilFaskes("fullAddress");
const [addressUuid] = defineFieldProfilFaskes("addressUuid");
const [lat] = defineFieldProfilFaskes("lat");
const [long] = defineFieldProfilFaskes("long");
const [cover] = defineFieldProfilFaskes("cover");
const [logo] = defineFieldProfilFaskes("logo");
const [bgWarna] = defineFieldProfilFaskes("bgWarna");
const [selectedProvinceId] = defineFieldProfilFaskes("selectedProvinceId");
const [selectedRegencyId] = defineFieldProfilFaskes("selectedRegencyId");
const [selectedDistrictId] = defineFieldProfilFaskes("selectedDistrictId");
const [selectedVillageId] = defineFieldProfilFaskes("selectedVillageId");
const [postalCodeId] = defineFieldProfilFaskes("postalCodeId");
// const [selectedPostalCodeId] = defineFieldProfilFaskes("selectedPostalCodeId")
const [phone] = defineFieldProfilFaskes("phone");
const [email] = defineFieldProfilFaskes("email");
const [website] = defineFieldProfilFaskes("website");
const [urlGmaps] = defineFieldProfilFaskes("urlGmaps");

const resetForm = () => {
  resetProfilFaskesForm({
    values: {
      code: "",
      name: "",
      fullAddress: "",
      selectedProvinceId: "",
      selectedRegencyId: "",
      selectedDistrictId: "",
      selectedVillageId: "",
      postalCodeId: "",
      phone: "",
      email: "",
      website: "",
      urlGmaps: "",
      lat: "",
      long: "",
      cover: "",
    },
  });
};

const onSubmitProfilFaskes = handleSubmitProfilFaskes(async (values) => {
  useUtilsStore.setLoading(true);
  try {
    // console.log(`${values.selectedProvinceId} ${provinces.value.find(obj => obj.id === values.selectedProvinceId)?.text}`)
    const payload = {
      code: values.code,
      name: values.name,
      full_address: values.fullAddress,
      address_uuid: values.addressUuid,
      cover: values.cover,
      bg_warna: values.bgWarna,
      logo: values.logo,
      prov: provinsiPayload.value.find(
        (obj) => obj.code === values.selectedProvinceId
      )?.name,
      city: kabupatenPayload.value.find(
        (obj) => obj.code === values.selectedRegencyId
      )?.name,
      district: kecamatanPayload.value.find(
        (obj) => obj.code === values.selectedDistrictId
      )?.name,
      // FIXME : village is not in the payload

      village: values.selectedVillageId,

      codeKabupaten: values.selectedRegencyId,
      codeProvinsi: values.selectedProvinceId,
      postal_code: values.postalCodeId,
      phone: values.phone,
      email: values.email,
      website: values.website,
      url_gmaps: values.urlGmaps,
      lat: values.lat,
      long: values.long,
    };
    const response = await settingStore.putProfilFaskesApi(payload);
    console.log("API Response:", response);

    if (response?.status === 200) {
      emit("update:isEditProfilFaskes", false);
      emit("update:afterEditProfilFaskes", {
        ...props.profilFaskesResponse,
        ...payload,
      });
    } else {
      console.error("Failed to update profile:");
    }
  } catch (error) {
    console.error("Error during submission:", error);
  } finally {
    useUtilsStore.setLoading(false);
  }
});

const fetchData = async (url: string, refVar: any) => {
  useUtilsStore.setLoading(true);
  try {
    const response = await axios.get(url);
    refVar.value = response.data.payload.map((item: any) => ({
      code: item.code,
      name: item.name,
    }));
    useUtilsStore.setLoading(false);
    // console.log(refVar.value)
  } catch (error) {
    console.error(`Error fetching data from ${url}:`, error);
  }
};

// const fetchProvinces = () => fetchData(`${API_URL_ALAMAT}provinsi`, provinces);
// const fetchRegencies = (provinceId: string) => fetchData(`${API_URL_ALAMAT}kabupaten?provinsi_code=${provinceId}`, regencies);
// const fetchDistricts = (regencyId: string) => fetchData(`${API_URL_ALAMAT}kecamatan?kabupaten_code=${regencyId}`, districts);
// const fetchVillages = (districtId: string) => fetchData(`${API_URL_ALAMAT}kelurahan?kecamatan_code=${districtId}`, villages);
// const fetchPostalCode = (regencyId: string, districtId: string) => fetchData(`${API_URL_ALAMAT}kodepos/get/?d_kabkota_id=${regencyId}&d_kecamatan_id=${districtId}`, postalCodes);

watch(
  () => [
    selectedProvinceId.value,
    selectedRegencyId.value,
    selectedDistrictId.value,
  ],
  ([newProvinceId, newRegencyId, newDistrictId]) => {
    if (newProvinceId) fetchKabupaten(newProvinceId);
    if (newRegencyId) fetchKecamatan(newRegencyId);
    if (newDistrictId) {
      fetchKelurahan(newDistrictId);
      // fetchPostalCode(newRegencyId || '', newDistrictId);
    }
  }
);

onMounted(() => {
  fetchProvinsi();
});
</script>

<template>
  <GreenCard
    cardHeading="Profile"
    hr-enable-custom-class
    showButton
    labelButton="Batal Edit"
    :button-click-handler="() => emit('update:isEditProfilFaskes', false)"
    outlined
    borderColor="border-opensimrs-300"
    textColor="text-opensimrs-300"
  >
    <div class="rounded-lg text-normal">
      <!-- Kode Faskes dan Nama Faskes berada dalam dua kolom -->
      <div class="flex gap-[30px] mb-4">
        <div class="w-[200px]">
          <CustomTextfield
            label="Kode Faskes"
            placeholder="Kode Faskes"
            v-model="code"
            :invalid="!!profilFaskesErrors.code"
            :invalidMessage="profilFaskesErrors.code"
            disabled
          />
        </div>
        <div class="grow">
          <CustomTextfield
            label="Nama Faskes"
            class="w-full"
            placeholder="Nama Faskes"
            v-model="name"
            :invalid="!!profilFaskesErrors.name"
            :invalidMessage="profilFaskesErrors.name"
            disabled
          />
        </div>
      </div>

      <!-- Alamat mengambil dua kolom penuh -->
      <div class="mb-4">
        <CustomTextArea
          label="Alamat"
          placeholder="Alamat"
          v-model:model-value="fullAddress"
          :isLoading="false"
          :disabled="false"
          :invalid="!!profilFaskesErrors.fullAddress"
          :invalidMessage="profilFaskesErrors.fullAddress"
        />
      </div>

      <div class="grid grid-cols-2 gap-[30px]">
        <!-- Provinsi, Kabupaten, Kecamatan, dan Kelurahan berada dalam dua kolom -->
        <div>
          <CustomSelect
            label="Provinsi"
            v-model="selectedProvinceId"
            :options="provinsiPayload"
            optionValue="code"
            optionLabel="name"
            :isLoading="false"
            :invalid="!!profilFaskesErrors.selectedProvinceId"
            :invalidMessage="profilFaskesErrors.selectedProvinceId"
            :disabled="false"
            placeHolder="Pilih Provinsi"
            customSelectClass="border-[#C7CBD2]"
          />
        </div>
        <div>
          <CustomSelect
            label="Kabupaten"
            v-model="selectedRegencyId"
            :options="kabupatenPayload"
            optionValue="code"
            optionLabel="name"
            :isLoading="false"
            :invalid="!!profilFaskesErrors.selectedRegencyId"
            :invalidMessage="profilFaskesErrors.selectedRegencyId"
            :disabled="false"
            placeHolder="Pilih Kabupaten"
            customSelectClass="border-[#C7CBD2]"
          />
        </div>
        <div>
          <CustomSelect
            label="Kecamatan"
            v-model="selectedDistrictId"
            :options="kecamatanPayload"
            optionValue="code"
            optionLabel="name"
            :isLoading="false"
            :invalid="!!profilFaskesErrors.selectedDistrictId"
            :invalidMessage="profilFaskesErrors.selectedDistrictId"
            :disabled="false"
            placeHolder="Pilih Kecamatan"
            customSelectClass="border-[#C7CBD2]"
          />
        </div>
        <div>
          <CustomSelect
            label="Kelurahan"
            v-model="selectedVillageId"
            :options="[
              { code: '3578081002', name: 'Mojo' },
              ...kelurahanPayload,
            ]"
            optionValue="code"
            optionLabel="name"
            :isLoading="false"
            :invalid="!!profilFaskesErrors.selectedVillageId"
            :invalidMessage="profilFaskesErrors.selectedVillageId"
            :disabled="false"
            placeHolder="Pilih Kelurahan"
            customSelectClass="border-[#C7CBD2]"
          />
        </div>

        <div>
          <CustomTextfield
            label="Kode Pos"
            v-model="postalCodeId"
            :invalid="!!profilFaskesErrors.postalCodeId"
            :invalidMessage="profilFaskesErrors.postalCodeId"
            placeholder="Isi Kode Pos"
          />
        </div>
        <div>
          <CustomTextfield
            label="No. Telpon"
            class="w-full"
            placeholder="No. Telpon"
            v-model="phone"
            :invalid="!!profilFaskesErrors.phone"
            :invalidMessage="profilFaskesErrors.phone"
          />
        </div>
        <div>
          <CustomTextfield
            label="Email"
            class="w-full"
            placeholder="ex: mail@Email.com"
            v-model="email"
            :invalid="!!profilFaskesErrors.email"
            :invalidMessage="profilFaskesErrors.email"
          />
        </div>
        <div>
          <CustomTextfield
            label="Website"
            class="w-full"
            placeholder="ex: www.website.com"
            v-model="website"
            :invalid="!!profilFaskesErrors.website"
            :invalidMessage="profilFaskesErrors.website"
          />
        </div>
        <div>
          <CustomTextfield
            label="Latitude"
            class="w-full"
            placeholder="Masukkan Latitude"
            v-model="lat"
            :invalid="!!profilFaskesErrors.lat"
            :invalidMessage="profilFaskesErrors.lat"
          />
        </div>
        <div>
          <CustomTextfield
            label="Longitude"
            class="w-full"
            placeholder="Masukkan Longitude"
            v-model="long"
            :invalid="!!profilFaskesErrors.long"
            :invalidMessage="profilFaskesErrors.long"
          />
        </div>

        <!-- Link Google Map mengambil dua kolom penuh -->
        <div class="">
          <CustomTextfield
            label="Link Google Map"
            class="w-full border-[#C7CBD2]"
            placeholder="Link Google Map"
            v-model="urlGmaps"
            :invalid="!!profilFaskesErrors.urlGmaps"
            :invalidMessage="profilFaskesErrors.urlGmaps"
          />
        </div>
        <div class="flex flex-col items-end justify-end w-full">
          <div class="flex flex-col justify-center w-full">
            <div class="font-bold text-normal text-opensimrs-300">Cover</div>
            <CustomDragDrop
              v-model="cover"
              :allowed-file-types="['image/png']"
              class="bg-white"
            />
          </div>
        </div>
      </div>
      <hr class="border-[#D9DCE1] border-1 mt-5" />
      <div class="flex items-end justify-end gap-3 py-2.5">
        <CustomButton
          label="Reset"
          textColor="text-[#9DA4B1]"
          backgroundColor="bg-transparent"
          borderColor="border-2 border-[#9DA4B1]"
          @click="resetForm"
        />
        <CustomButton label="Simpan" @click="onSubmitProfilFaskes" />
      </div>
    </div>
  </GreenCard>
</template>

<style scoped>
/* Custom styles if needed */
</style>
