<script lang="ts" setup>
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { useRoute, useRouter } from "vue-router";
import TiketAntrian from "@/components/Antrian/TiketAntrian.vue";
import { onActivated, onMounted, ref, watch } from "vue";
import PlusIcon from "@/components/icons/PlusIcon.vue";
import NavbarAntrian from "@/components/Antrian/NavbarAntrian.vue";
import OrnamentAntrian from "@/components/Antrian/OrnamentAntrian.vue";
import { useApmFlowStore } from "@/utils/apmFlow";

const router = useRouter();
const route = useRoute();
const apmFlow = useApmFlowStore();

const handleHome = () => {
  // Opsional: bersihkan data flow setelah selesai
  apmFlow.resetFlow();
  router.push("/antrian/apm/aktif");
};
// const handleBack = () => {
//   router.push("/antrian/apm/aktif/pasien/jkn");
// };

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

const formatDateId = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(d);
  } catch {
    return iso;
  }
};

const mapGender = (g?: string) => {
  if (!g) return "";
  const m = g.toLowerCase();
  if (m === "male") return "Laki-laki";
  if (m === "female") return "Perempuan";
  return g;
};

const getTiketData = ref();

watch(
  () => apmFlow.apmSuccessResponse,
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
  const val = apmFlow.apmSuccessResponse;
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
              class="flex justify-between w-48 h-10 bg-white rounded-xl shadow-md"
            >
              <div
                class="flex gap-2 items-center text-sm leading-5 whitespace-nowrap text-opensimrs-300"
              >
                <!-- Logo Container -->
                <div
                  class="flex items-center px-2.5 py-2.5 rounded-r-lg bg-opensimrs-300"
                >
                  <PlusIcon class="text-white" :size="30" />
                </div>

                <!-- Text Container with Background -->
                <div class="px-2 py-1 font-bold rounded-xl text-opensimrs-300">
                  Pasien Non-JKN
                </div>
              </div>
            </div>

            <!-- Title Container (Center) -->
            <div
              class="flex col-span-1 justify-center items-center text-2xl font-extrabold text-opensimrs-300"
            >
              Pendaftaran Berhasil
            </div>

            <!-- Button Container (Right) -->
            <div class="flex col-span-1 justify-end items-center mr-6">
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
            <TiketAntrian :tiketAntrian="getTiketData" class="mt-14" />
          </div>
        </div>
      </div>
    </div>
    <OrnamentAntrian />
  </div>
</template>
