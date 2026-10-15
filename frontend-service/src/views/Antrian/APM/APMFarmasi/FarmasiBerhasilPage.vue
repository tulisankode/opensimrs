<script lang="ts" setup>
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { useRouter } from "vue-router";
import TiketAntrian from "@/components/Antrian/TiketAntrian.vue";
import { onActivated, ref } from "vue";
import AddPrint from "@/components/icons/AddPrint.vue";
import CheckCircleIcon from "@/components/icons/CheckCircleIcon.vue";
import HouseFill from "@/components/icons/HouseFill.vue";
import NavbarAntrian from "@/components/Antrian/NavbarAntrian.vue";
import OrnamentAntrian from "@/components/Antrian/OrnamentAntrian.vue";
import { watch } from "vue";
import { useApmFlowStore } from "@/utils/apmFlow";

const router = useRouter();
const apmFlow = useApmFlowStore();

const handleHome = () => {
  router.push("/antrian/apm/aktif/pasien/farmasi");
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

const tiketAntrian = ref({
  noRM: "00-00-00",
  noBooking: "63DJ83",
  noRegistrasi: "REG2407010049",
  noBPJS: "523214315123123",
  nik: "327012371204102",
  nama: "Nama Lengkap Pasien Jika Panjang",
  tanggalLahir: "01 Januari 2000",
  gender: "Laki-laki",
  namaPoli: "Poli Anak",
  dokter: "dr. Nama Dokter",
  jadwal: "07:00 - 10:00",
  tanggal: "10 Jan 2024",
  noAntri: "PD-02-01",
});

const getTiketData = ref();

watch(
  () => apmFlow.patientData,
  (val) => {
    if (val != null) {
      getTiketData.value = val;
      console.log("APM Success Response (from store):", getTiketData.value);
    } else {
      console.warn("Tidak ada data success di store.");
    }
  },
  { immediate: true }
);

onActivated(() => {
  const val = apmFlow.patientData;
  if (val != null) {
    getTiketData.value = val;
    console.log(
      "APM Success Response (from store) [activated]:",
      getTiketData.value
    );
  }
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
              class="flex justify-between h-10 bg-white rounded-xl shadow-md w-fit"
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
                  <PillFillIcon class="text-white" :size="30" />
                </div>

                <!-- Text Container with Background -->
                <div class="px-2 py-1 font-bold rounded-xl text-opensimrs-300">
                  Antrian Obat
                </div>
              </div>
            </div>

            <!-- Title Container (Center) -->
            <div
              class="flex flex-col justify-center items-center justify-self-center mx-auto text-center text-2xl font-extrabold text-opensimrs-300"
            >
              <div class="flex">
                <div class="pr-2">Konfirmasi Obat Berhasil</div>
                <CheckCircleIcon class="text-opensimrs-300" :size="30" />
              </div>
              <div class="text-grey-400 text-subHeading">
                Silahkan menunggu panggilan antrian
              </div>
            </div>

            <!-- Button Container (Right) -->
            <div class="flex col-span-1 justify-end items-center mr-6">
              <!-- <HouseFill class="text-opensimrs-300" :size="20"/> -->
              <CustomButton
                label="< &nbsp Halaman Utama"
                outlined
                borderColor="border-opensimrs-300"
                textColor="text-opensimrs-300"
                class="w-fit"
                @click="handleHome"
              />
            </div>
          </div>

          <div class="flex justify-center items-center px-16">
            <TiketAntrian
              :showPrintButton="true"
              :tiketAntrian="getTiketData"
              class="mt-14"
            />
          </div>
        </div>
      </div>
    </div>
    <OrnamentAntrian />
  </div>
</template>
