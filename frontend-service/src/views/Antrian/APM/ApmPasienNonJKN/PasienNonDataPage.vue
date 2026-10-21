<script lang="ts" setup>
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CardAktivitas from "@/components/Antrian/CardAktivitas.vue";
import { useRouter, useRoute } from "vue-router";
import { computed, onMounted, ref } from "vue";
import PlusIcon from "@/components/icons/PlusIcon.vue";
import OrnamentAntrian from "@/components/Antrian/OrnamentAntrian.vue";
import NavbarAntrian from "@/components/Antrian/NavbarAntrian.vue";
import { useJadwalDokterStore } from "@/stores/antrian/jadwalDokter";
import { utilsStore } from "@/stores/utils";
import { useApmFlowStore } from "@/utils/apmFlow";

const router = useRouter();
const route = useRoute();

const handleHome = () => {
  router.push("/antrian/apm/aktif/pasien/non-jkn");
};

const handlePoli = (poli: any) => {
  // Simpan pilihan poli di store, jangan kirim query sensitif
  apmFlow.setSelectedPoli(poli?.uuid || "", poli?.name || "");
  router.push({
    path: "/antrian/apm/aktif/pasien/non-jkn/poli",
  });
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
  dataPasien: {
    default: Object,
  },
});

const jadwalDokterStore = useJadwalDokterStore();
const useUtilsStore = utilsStore();
const apmFlow = useApmFlowStore();

const jadwalPoliPayload = ref<any[]>([]);
const jadwalPoliProperties = ref({
  name: "",
});

const pasienDataPayload = ref();

const inputNoIdentity = computed(() => apmFlow.noIdentity || "");

const fetchGetPoli = async () => {
  useUtilsStore.setLoading(true);
  try {
    const response = await jadwalDokterStore.getApiPoli(
      jadwalPoliProperties.value.name
    );
    console.log("Hasil dari response Daftar Pasien:", response);
    if (response && response.payload) {
      jadwalPoliPayload.value = response.payload;
    }
  } catch (error) {
    console.log("Error:", error);
    jadwalPoliPayload.value = [];
  } finally {
    useUtilsStore.setLoading(false);
  }
};

const patientStatus = ref<string>("");

// Helper functions
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

onMounted(() => {
  // Ambil status & data dari store, bukan dari route.query
  const status = apmFlow.patientStatus || "";
  patientStatus.value = status;

  if (status === "success" && apmFlow.patientData) {
    pasienDataPayload.value = apmFlow.patientData;
  } else if (status === "not_found") {
    console.log("Data pasien tidak ditemukan");
  }

  fetchGetPoli();
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
        <div class="bg-white bg-opacity-30 w-full min-h-[640px] space-y-8 pb-8">
          <!-- Header -->
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
              Data Pasien
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

          <!-- Data Pasien -->
          <div class="flex justify-around">
            <div
              class="grid grid-cols-[max-content_1ch_minmax(0,1fr)] gap-x-3 gap-y-1"
            >
              <div class="font-bold whitespace-nowrap">No. Identitas</div>
              <div class="text-center">:</div>
              <div>{{ pasienDataPayload?.noIdentity || inputNoIdentity }}</div>
              <!-- ... existing code ... -->

              <div class="font-bold whitespace-nowrap">No. RM</div>
              <div class="text-center">:</div>
              <div>{{ pasienDataPayload?.noRm || "-" }}</div>
            </div>

            <!-- Hanya tampilkan kolom kedua jika pasien lama -->
            <div
              class="grid grid-cols-[max-content_1ch_minmax(0,1fr)] gap-x-3 gap-y-1"
            >
              <div class="font-bold whitespace-nowrap">Nama</div>
              <div class="text-center">:</div>
              <div>{{ pasienDataPayload?.name || "-" }}</div>

              <div class="font-bold whitespace-nowrap">Tgl. Lahir</div>
              <div class="text-center">:</div>
              <div>
                {{
                  formatDateId(pasienDataPayload?.birthDetail?.birthDate) || "-"
                }}
              </div>
            </div>

            <!-- Hanya tampilkan kolom ketiga jika pasien lama -->
            <div
              class="grid grid-cols-[max-content_1ch_minmax(0,1fr)] gap-x-3 gap-y-1"
            >
              <div class="font-bold whitespace-nowrap">Jenis Kelamin</div>
              <div class="text-center">:</div>
              <div>{{ mapGender(pasienDataPayload?.gender) || "-" }}</div>
            </div>
          </div>

          <!-- Content -->
          <div class="flex gap-6 justify-center">
            <div class="col-span-5 px-32 space-y-7 w-full">
              <div class="">
                <div class="justify-start pl-1 text-lg font-bold">
                  Daftar Poli
                </div>
                <hr class="bg-black h-[2px] my-2 ml-1" />
                <div class="justify-start pl-1 mb-8 text-sm text-opensimrs-300">
                  Silahkan Pilih Poli
                </div>
              </div>

              <!-- Poli banyak (mis. RS 13 poli): daftar mulai dari atas & bisa digulir, tidak meluap menimpa data pasien. -->
              <div class="flex flex-col items-center max-h-[330px] overflow-y-auto pr-2">
                <div>
                  <div class="grid grid-cols-4 gap-x-6 gap-y-6 w-full">
                    <div
                      v-for="item in jadwalPoliPayload"
                      :key="item.uuid || item.id"
                      class="w-[220px] h-[136px]"
                    >
                      <CardAktivitas
                        :cardAktivitas="item.name"
                        class="transition-transform duration-300 hover:scale-95"
                        @click="handlePoli(item)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <OrnamentAntrian />
  </div>
</template>
