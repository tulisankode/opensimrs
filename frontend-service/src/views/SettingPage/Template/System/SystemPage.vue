<script setup lang="ts">
import CustomChip from "@/components/Base/CustomChip.vue";
import GreenCard from "../GreenCard.vue";
import MainHeaderSetting from "../MainHeaderSetting.vue";
import { computed, ref, onMounted } from "vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import { useSettingStore } from "@/stores/setting";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { utilsStore } from "@/stores/utils";
import KartuModePengembang from "./KartuModePengembang.vue";
import { isSuperadmin } from "@/stores/simrsStudio";

const useUtilsStore = utilsStore();

// Initial Values
const initialBiayaAdministrasi = ref(0);
const initialBiayaPPN = ref(0);

// Store
const settingStore = useSettingStore();

// Schema for Administrasi
const schemaBiayaAdministrasi = computed(() =>
  toTypedSchema(
    yup.object({
      statusBiayaAdministrasi: yup.boolean().default(false),
      biayaInputAdministrasi: yup.number().default(0),
    })
  )
);

const {
  handleSubmit: handleSubmitBiayaAdministrasi,
  defineField: defineFieldBiayaAdministrasi,
  resetForm: resetBiayaAdministrasiForm,
} = useForm({
  validationSchema: schemaBiayaAdministrasi,
});

const [statusBiayaAdministrasi] = defineFieldBiayaAdministrasi(
  "statusBiayaAdministrasi"
);
const [biayaInputAdministrasi] = defineFieldBiayaAdministrasi(
  "biayaInputAdministrasi"
);

const onSubmitBiayaAdministrasi = handleSubmitBiayaAdministrasi(
  async (values) => {
    try {
      const payload = {
        statusBiayaLain: values.statusBiayaAdministrasi,
        valueBiayaLain: values.biayaInputAdministrasi,
      };
      await settingStore.putBiayaAdministrasi(payload);
      fetchBiayaAdministrasiData();
      initialBiayaAdministrasi.value = values.biayaInputAdministrasi;
      // Reload halaman setelah submit berhasil
    } catch (error) {
      console.error("Error during submission:", error);
    }
  }
);

// Schema for PPN
const schemaPPN = computed(() =>
  toTypedSchema(
    yup.object({
      statusPPN: yup.boolean().default(false),
      biayaInputPPN: yup.number().default(0),
    })
  )
);

const {
  handleSubmit: handleSubmitPPN,
  defineField: defineFieldPPN,
  resetForm: resetPPNForm,
} = useForm({
  validationSchema: schemaPPN,
});

const [statusPPN] = defineFieldPPN("statusPPN");
const [biayaInputPPN] = defineFieldPPN("biayaInputPPN");

const onSubmitPPN = handleSubmitPPN(async (values) => {

  try {
    const payload = {
      statusPpn: values.statusPPN,
      valuePpn: values.biayaInputPPN,
    };
    await settingStore.putPPN(payload);
    fetchPPNData();
    initialBiayaPPN.value = values.biayaInputPPN;
  } catch (error) {
    console.error("Error during submission:", error);
  }
});

// Response Data
const biayaAdministrasiResponse = ref({
  statusBiayaLain: false,
  valueBiayaLain: 0,
});

// Fetch Data
const fetchBiayaAdministrasiData = async () => {
  useUtilsStore.setLoading(true);
  try {
    const response = await settingStore.getBiayaAdministrasi();
    if (response && response.payload) {
      biayaAdministrasiResponse.value = response.payload;
      // Assign values to inputs based on response
      biayaInputAdministrasi.value =
        Number(response.payload.valueBiayaLain) || 0;
      statusBiayaAdministrasi.value = response.payload.statusBiayaLain || false;
      useUtilsStore.setLoading(false);
    } else {
      console.error("Unexpected response Structure", response);
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
  }
};

const biayaPPNResponse = ref({
  statusPpn: false,
  valuePpn: 0,
});

// Fetch Data for PPN
const fetchPPNData = async () => {
  useUtilsStore.setLoading(true);
  try {
    const response = await settingStore.getPPN();
    if (response && response.payload) {
      biayaPPNResponse.value = response.payload;
      console.log("PPN Response Data:", response.payload);
      // Assign values to inputs based on response
      biayaInputPPN.value = Number(response.payload.valuePpn) || 0;
      statusPPN.value = response.payload.statusPpn || false;

      useUtilsStore.setLoading(false);
    } else {
      console.error("Unexpected response Structure", response);
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
  }
};
// On Mounted
onMounted(() => {
  fetchBiayaAdministrasiData();
  fetchPPNData();
});
</script>

<template>
  <Card
    pt:body:class="h-full pt-0 overflow-auto"
    pt:content:class="h-full overflow-auto"
  >
    <template #header>
      <MainHeaderSetting heading="System" />
    </template>
    <template #content>
      <GreenCard
        cardHeading="Administrasi"
        :disableLine="!statusBiayaAdministrasi"
        :hrEnableCustomClass="statusBiayaAdministrasi"
      >
        <template #switch>
          <div class="flex gap-5">
            <CustomSwitch
              v-model="statusBiayaAdministrasi"
              label=""
              leftLabel
              sideLabel="Non-Aktif"
              sideLabelTrue="Aktif"
              sideLabelColor="text-danger-300"
              sideLabelColorTrue="text-success-300"
            />
            <div class="flex items-end gap-5" v-if="statusBiayaAdministrasi">
              <div class="h-2/3 border-opensimrs-300 border-l-[1px]"></div>
              <CustomChip
                :label="`Rp ${biayaInputAdministrasi}`"
                bg-color="bg-opensimrs-300"
                border-color="border-transparent"
                text-color="text-white"
                icon-color="text-white"
                textSize="text-MD"
                customClass="h-7"
              />
            </div>
          </div>
        </template>

        <div class="flex justify-between pt-2.5" v-if="statusBiayaAdministrasi">
          <div class="flex flex-col gap-1">
            <div class="font-semibold text-normal">Biaya Administrasi</div>
            <div class="text-grey-400 text-SM">
              Mempengaruhi harga pada pembayaran
            </div>
          </div>
          <div class="flex items-end justify-end">
            <CustomInputNumber
              class=""
              label="Input Biaya (Rp)"
              v-model="biayaInputAdministrasi"
            >
              <template #prependText>
                <div
                  class="flex items-center justify-center px-3 overflow-hidden font-semibold leading-7 text-white border-r text-MD bg-opensimrs-300 rounded-l-md"
                >
                  Rp.
                </div>
              </template>
            </CustomInputNumber>
          </div>
        </div>

        <hr
          class="border-[#D9DCE1] border-1 mt-5 mb-5 w-full"
          v-if="
            statusBiayaAdministrasi &&
            biayaInputAdministrasi !== initialBiayaAdministrasi
          "
        />
        <div
          class="flex items-end justify-end gap-3"
          v-if="
            statusBiayaAdministrasi &&
            biayaInputAdministrasi !== initialBiayaAdministrasi
          "
        >
          <CustomButton
            label="Reset"
            textColor="text-[#9DA4B1]"
            backgroundColor="bg-transparent"
            borderColor="border-2 border-[#9DA4B1]"
            @click="resetBiayaAdministrasiForm"
          />
          <CustomButton label="Simpan" @click="onSubmitBiayaAdministrasi" />
        </div>
      </GreenCard>

      <GreenCard
        cardHeading="PPN"
        :disableLine="!statusPPN"
        :hrEnableCustomClass="statusPPN"
      >
        <template #switch>
          <div class="flex gap-5">
            <CustomSwitch
              v-model="statusPPN"
              label=""
              leftLabel
              sideLabel="Non-Aktif"
              sideLabelTrue="Aktif"
              sideLabelColor="text-danger-300"
              sideLabelColorTrue="text-success-300"
            />
            <div class="flex items-end gap-5" v-if="statusPPN">
              <div class="h-2/3 border-opensimrs-300 border-l-[1px]"></div>
              <CustomChip
                :label="`${biayaInputPPN}%`"
                bg-color="bg-opensimrs-300"
                border-color="border-transparent"
                text-color="text-white"
                icon-color="text-white"
                textSize="text-MD"
                customClass="h-7"
              />
            </div>
          </div>
        </template>

        <div class="flex justify-between pt-2.5" v-if="statusPPN">
          <div class="flex flex-col gap-1">
            <div class="font-semibold text-normal">Presentase PPN</div>
            <div class="text-grey-400 text-SM">
              Mempengaruhi harga pada pembayaran
            </div>
          </div>
          <div class="flex items-end justify-end">
            <CustomInputNumber
              v-model="biayaInputPPN"
              label="Input Margin (%)"
              class="basis-2/3"
            >
              <template #appendText>
                <div class="flex items-center justify-center mr-2.5">%</div>
              </template>
            </CustomInputNumber>
          </div>
        </div>

        <hr
          class="border-[#D9DCE1] border-1 mt-5 mb-5 w-full"
          v-if="statusPPN && biayaInputPPN !== initialBiayaPPN"
        />
        <div
          class="flex items-end justify-end gap-3"
          v-if="statusPPN && biayaInputPPN !== initialBiayaPPN"
        >
          <CustomButton
            label="Reset"
            textColor="text-[#9DA4B1]"
            backgroundColor="bg-transparent"
            borderColor="border-2 border-[#9DA4B1]"
            @click="resetPPNForm"
          />
          <CustomButton label="Simpan" @click="onSubmitPPN" />
        </div>
      </GreenCard>

      <!-- Mode Pengembang (SIMRS Studio): hanya superadmin -->
      <KartuModePengembang v-if="isSuperadmin()" />
    </template>
  </Card>
</template>
