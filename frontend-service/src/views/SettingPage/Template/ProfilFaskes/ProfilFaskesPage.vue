<script setup lang="ts">
import { onMounted, ref } from "vue";
import MainHeaderSetting from "../MainHeaderSetting.vue";
import LogoWarna from "./LogoWarna.vue";
import GreenCard from "../GreenCard.vue";
import FormEditProfilFaskes from "./FormEditProfilFaskes.vue";
import FormEditLogoWarna from "./FormEditLogoWarna.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { useSettingStore } from "@/stores/setting";
import ProfilFaskesTemplate from "./ProfilFaskesTemplate.vue";
import { utilsStore } from "@/stores/utils";

const useUtilsStore = utilsStore();

const profilFaskesResponse = ref({
  code: "",
  name: "",
  phone: "",
  email: "",
  website: "",
  addressUuid: "",
  urlGmaps: "",
  logo: "",
  bgWarna: "",
  address: {
    prov: "",
    city: "",
    district: "",
    village: "",
    postalCode: "",
    fullAddress: "",
  },
});

const settingStore = useSettingStore();

const fetchSettingProfilFaskesData = async () => {
  useUtilsStore.setLoading(true);
  try {
    const response = await settingStore.getProfilFaskesApi();
    if (response) {
      profilFaskesResponse.value = response;
      // Logo & warna tema langsung berlaku setelah disimpan / dimuat ulang.
      useUtilsStore.setProfilFaskes(response);
    } else {
      console.error("Unexpected response Structure", response);
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    useUtilsStore.setLoading(false);
  }
};

onMounted(() => {
  // console.log(profilFaskesResponse.value);
  fetchSettingProfilFaskesData();
});

const handleProfilFaskesUpdate = (updatedProfile: any) => {
  profilFaskesResponse.value = updatedProfile;
  useUtilsStore.setProfilFaskes(updatedProfile);
  fetchSettingProfilFaskesData();
};

const handleLogoWarnaUpdate = (updatedLogoWarna: any) => {
  profilFaskesResponse.value = updatedLogoWarna;
  fetchSettingProfilFaskesData();
};

const isEditProfilFaskes = ref(false);
const isEditLogoWarna = ref(false);

const editProfilFaskes = () => {
  isEditProfilFaskes.value = !isEditProfilFaskes.value;
};

const editLogoWarna = () => {
  isEditLogoWarna.value = !isEditLogoWarna.value;
};
</script>

<template>
  <Card
    pt:body:class="h-full pt-0 overflow-auto"
    pt:content:class="h-full overflow-auto"
  >
    <template #header>
      <MainHeaderSetting heading="Profil Faskes" />
    </template>
    <template #content>
      <!-- Menampilkan Profil Faskes -->
      <template v-if="!isEditProfilFaskes">
        <ProfilFaskesTemplate
          :profilFaskesResponse="profilFaskesResponse"
          :editHandler="editProfilFaskes"
        />
      </template>
      <template v-else>
        <FormEditProfilFaskes
          :profilFaskesResponse="profilFaskesResponse"
          :isEditProfilFaskes="isEditProfilFaskes"
          @update:isEditProfilFaskes="isEditProfilFaskes = $event"
          @update:afterEditProfilFaskes="handleProfilFaskesUpdate"
        />
      </template>

      <!-- Menampilkan Logo & Warna -->
      <template v-if="!isEditLogoWarna">
        <LogoWarna
          :profilFaskesResponse="profilFaskesResponse"
          :editHandler="editLogoWarna"
        />
      </template>
      <template v-else>
        <FormEditLogoWarna
          :profilFaskesResponse="profilFaskesResponse"
          :isEditLogoWarna="isEditLogoWarna"
          @update:is-edit-logo-warna="isEditLogoWarna = $event"
          @update:after-edit-logo-warna="handleLogoWarnaUpdate"
        />
      </template>
    </template>
  </Card>
</template>
