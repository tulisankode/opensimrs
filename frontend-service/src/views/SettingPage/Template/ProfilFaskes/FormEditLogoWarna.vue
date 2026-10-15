<script setup lang="ts">
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomColorPicker from "@/components/Base/CustomColorPicker.vue";
import CustomDragDrop from "@/components/Base/CustomDragDrop.vue";
import { ref } from "vue";
import GreenCard from "../GreenCard.vue";
import { PhHandTap } from "@phosphor-icons/vue";
import { useSettingStore } from "@/stores/setting";
import { computed } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { utilsStore } from "@/stores/utils";
import Loading from "@/components/section/Loading.vue";

const useUtilsStore = utilsStore();

const props = defineProps({
  profilFaskesResponse: {
    type: Object,
    required: true,
  },
  isEditLogoWarna: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits([
  "update:isEditLogoWarna",
  "update:afterEditLogoWarna",
]);

const settingStore = useSettingStore();

const schemaLogoWarna = computed(() =>
  toTypedSchema(
    yup.object({
      logo: yup.string().required("Harus Mengupload Foto"),
      bgWarna: yup.string().default("#14b8a6"),
    })
  )
);

const {
  errors: logoWarnaErrors,
  handleSubmit: handleSubmitLogoWarna,
  defineField: defineFieldLogoWarna,
  resetForm: resetLogoWarnaForm,
} = useForm({
  validationSchema: schemaLogoWarna,
  initialValues: {
    logo: props.profilFaskesResponse.logo,
    bgWarna: props.profilFaskesResponse.bgWarna ?? "#14b8a6",
  },
});

const [logo] = defineFieldLogoWarna("logo");
const [bgWarna] = defineFieldLogoWarna("bgWarna");

const onSubmitLogoWarna = handleSubmitLogoWarna(async (values) => {
  useUtilsStore.setLoading(true);
  try {
    const payload = {
      logo: values.logo,
      bgWarna: values.bgWarna,
      code: props.profilFaskesResponse.code,
      name: props.profilFaskesResponse.name,
      address_uuid: props.profilFaskesResponse.addressUuid,
      phone: props.profilFaskesResponse.phone,
      email: props.profilFaskesResponse.email,
      website: props.profilFaskesResponse.website,
      url_gmaps: props.profilFaskesResponse.urlGmaps,
      prov: props.profilFaskesResponse.address.prov,
      city: props.profilFaskesResponse.address.city,
      district: props.profilFaskesResponse.address.district,
      village: props.profilFaskesResponse.address.village,
      postal_code: props.profilFaskesResponse.address.postalCode,
      full_address: props.profilFaskesResponse.address.fullAddress,
      codeKabupaten: props.profilFaskesResponse.codeKabupaten,
      codeProvinsi: props.profilFaskesResponse.codeProvinsi,
      lat: props.profilFaskesResponse.lat,
      long: props.profilFaskesResponse.long,
      cover: props.profilFaskesResponse.cover,
    };
    console.log("Payload to be sent:", payload);
    const response = await settingStore.putProfilFaskesApi(payload);
    if (response?.status === 200) {
      emit("update:isEditLogoWarna", false);
      emit("update:afterEditLogoWarna", {
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

const resetForm = () => {
  resetLogoWarnaForm({
    values: {
      logo: "",
      bgWarna: "#14B8A6",
    },
  });
};
</script>

<template>
  <GreenCard
    class="mb-4"
    cardHeading="Logo & Warna"
    hr-enable-custom-class
    showButton
    labelButton="Batal Edit"
    :button-click-handler="() => emit('update:isEditLogoWarna', false)"
    outlined
    borderColor="border-opensimrs-300"
    textColor="text-opensimrs-300"
  >
    <!-- Sebelum tulisan Warna Tema  -->
    <div class="flex w-full">
      <!-- Bagian Konten Kiri -->
      <div class="w-full">
        <div class="mb-8">
          <div class="text-sm font-semibold font-poppins">Logo</div>
          <div class="text-SM text-[#858D9D]">
            Logo ini akan ditampilkan di bagian
            <span class="font-bold">
              Halaman Login, Header Menu sebelah kiri, Loading Screen,
            </span>
            dan <span class="font-bold">Print Out</span>.
          </div>
          <ul class="list-disc list-inside text-SM ml-[6px] text-[#858D9D]">
            <li>
              Ukuran minimum yang disarankan adalah
              <span class="font-bold">960x540</span>
            </li>
            <li>
              Rasio aspek yang disarankan adalah
              <span class="font-bold">16:9</span>
            </li>
          </ul>
        </div>
      </div>

      <!-- Gambar -->
      <div class="flex flex-col items-end justify-end w-2/5">
        <div class="flex flex-col justify-center w-full">
          <div class="font-bold text-center text-normalt- text-opensimrs-300">
            Preview Logo
          </div>
          <CustomDragDrop
            v-model="logo"
            :allowed-file-types="['image/png']"
            class="bg-white"
          />
          <small
            v-if="logoWarnaErrors.logo"
            class="text-center text-danger-300"
          >
            {{ logoWarnaErrors.logo }}
          </small>
        </div>
      </div>
    </div>

    <!-- Setelah Gambar -->
    <div class="flex items-center justify-between mt-5">
      <div class="">
        <div class="text-sm font-semibold font-poppins">Warna Tema</div>
        <div class="text-SM text-[#858D9D]">
          Warna yang dipilih akan mengubah seluruh tema warna LIS.
        </div>
        <ul class="list-disc list-inside text-SM ml-[6px] text-[#858D9D]">
          <li>Pilihlah warna yang akan ditampilkan.</li>
        </ul>
      </div>
      <div class="flex items-center gap-2">
        <!-- Color pembungkus -->
        <div class="flex flex-col">
          <!-- Color Baris atas -->
          <div class="flex flex-col gap-x-2">
            <CustomColorPicker
              class="ml-auto"
              icon="PhHandTap"
              showIcon
              v-model="bgWarna"
            />
            <small v-if="logoWarnaErrors.bgWarna" class="text-danger-300">{{
              logoWarnaErrors.bgWarna
            }}</small>
          </div>
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
      <CustomButton label="Simpan" @click="onSubmitLogoWarna" />
    </div>
  </GreenCard>
</template>

<style lang="scss" scoped></style>
