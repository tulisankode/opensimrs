<script lang="ts" setup>
import NavbarAntrian from "@/components/Antrian/NavbarAntrian.vue";
import OrnamentAntrian from "@/components/Antrian/OrnamentAntrian.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import AddPrint from "@/components/icons/AddPrint.vue";
import { useApmStore } from "@/stores/antrian/apm";
import { utilsStore } from "@/stores/utils";
import { useApmFlowStore } from "@/utils/apmFlow";
import { ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();

const useUtilsStore = utilsStore();
const apmStore = useApmStore();
const apmFlow = useApmFlowStore();

const handleHome = () => {
  router.push("/antrian/apm/aktif");
};
const handleData = () => {
  router.push("/antrian/apm/aktif/print/data");
};

const noIdentity = ref("");

// Submit handler
const onSubmit = async () => {
  try {
    useUtilsStore.setLoading(true);

    const payload = {
      kode_booking: noIdentity.value,
    };

    const response = await apmStore.printPasien(payload);

    if (response?.payload && response.payload.uuid) {
      // Simpan ke store, lalu navigasi tanpa query sensitif
      apmFlow.setPatientStatus("success");
      apmFlow.setPatientData(response.payload);

      router.push({
        path: "/antrian/apm/aktif/print/data",
      });
    } else {
      throw new Error("Patient not found");
    }
  } catch (error) {
    // Pasien baru (not_found)
    apmFlow.setPatientStatus("not_found");
    apmFlow.setPatientData(null);
  } finally {
    useUtilsStore.setLoading(false);
  }
};

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
});
</script>

<template #body>
  <div class="flex flex-col py-5 w-full min-h-screen">
    <div
      class="flex relative z-10 gap-5 justify-between py-0 pr-5 mx-3 rounded-xl shadow-md bg-opensimrs-300 max-md:flex-wrap"
    >
      <NavbarAntrian />
    </div>
    <div class="flex relative flex-1 justify-center items-center mx-36">
      <div
        class="flex overflow-hidden flex-col justify-center w-full rounded-3xl"
      >
        <div
          class="bg-white bg-opacity-30 w-full h-[540px] items-center justify-center"
        >
          <div class="grid grid-cols-3 gap-4 pt-10">
            <div
              class="flex justify-between w-28 h-10 bg-white rounded-xl shadow-md"
            >
              <div
                class="flex gap-2 items-center text-sm leading-5 whitespace-nowrap text-opensimrs-300"
              >
                <!-- Logo Container -->
                <div
                  class="flex items-center px-2.5 py-2.5 rounded-r-lg bg-opensimrs-300"
                >
                  <!-- <img
                    loading="lazy"
                    src="@/assets/icons/icon-park-solid_add-print.svg"
                    class="shrink-0 w-[30px] h-[30px] p-[2px] filter invert"
                  /> -->
                  <AddPrint class="text-white" :size="30" />
                </div>

                <!-- Text Container with Background -->
                <div class="px-2 py-1 font-bold rounded-xl text-opensimrs-300">
                  Print
                </div>
              </div>
            </div>

            <!-- Title Container (Center) -->
            <div
              class="flex col-span-1 justify-center items-center text-2xl font-extrabold text-opensimrs-300"
            >
              Print Antrian
            </div>

            <!-- Button Container (Right) -->
            <div class="flex col-span-1 justify-end items-center mr-6">
              <CustomButton
                label="< &nbsp Kembali"
                outlined
                borderColor="border-opensimrs-300"
                textColor="text-opensimrs-300"
                class="w-[120px]"
                @click="handleHome"
              />
            </div>
          </div>

          <div class="flex flex-col gap-4 items-center mt-28">
            <CustomTextfield
              :label="`No. Kode Booking`"
              :placeholder="`Masukkan No. Kode Booking`"
              class="w-2/5"
              v-model="noIdentity"
            ></CustomTextfield>
            <CustomButton label="Print" class="w-2/5" @click="onSubmit" />
          </div>
        </div>
      </div>
    </div>
    <OrnamentAntrian />
  </div>
</template>
