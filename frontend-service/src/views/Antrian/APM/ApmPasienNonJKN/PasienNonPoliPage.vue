<script lang="ts" setup>
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CardAktivitas from "@/components/Antrian/CardAktivitas.vue";
import CardDokter from "@/components/Antrian/CardDokter.vue";
import { useRoute, useRouter } from "vue-router";
import { computed, onMounted, ref, type PropType } from "vue";
import Stethoscop from "@/components/icons/Stethoscop.vue";
import CardJam from "@/components/Antrian/CardJam.vue";
import NavbarAntrian from "@/components/Antrian/NavbarAntrian.vue";
import OrnamentAntrian from "@/components/Antrian/OrnamentAntrian.vue";
import { useJadwalDokterStore } from "@/stores/antrian/jadwalDokter";
import { utilsStore } from "@/stores/utils";
import { watch } from "vue";
import { useApmStore } from "@/stores/antrian/apm";
import { useApmFlowStore } from "@/utils/apmFlow";

const router = useRouter();
const route = useRoute();
const apmFlow = useApmFlowStore();

const apmStore = useApmStore();

const HARI_ID = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];
const now = ref(new Date());
const todayName = computed(() => HARI_ID[now.value.getDay()]);

const toMinutes = (hhmm: string) => {
  const [h, m] = (hhmm || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const nowMinutes = computed(
  () => now.value.getHours() * 60 + now.value.getMinutes()
);

const isScheduleDisabled = (j: any) => {
  // Disable jika waktu sekarang sudah melewati atau tepat sama dengan endTime
  const end = toMinutes(j?.endTime);
  const isTimeExpired = nowMinutes.value >= end;

  // Disable jika kuota sudah habis (sisa_kuota <= 0)
  const isQuotaFull = (j?.sisaKuota || 0) <= 0;

  // Disable jika status tidak aktif
  const isInactive = j?.status !== "aktif";

  return isTimeExpired || isQuotaFull || isInactive;
};

const hasScheduleToday = (item: any) => {
  const list = item?.jadwalDokter || [];
  return list.some((j: any) => j?.day === todayName.value);
};
const isAllSchedulesDisabledToday = (item: any) => {
  const list = item?.jadwalDokter || [];
  const todayList = list.filter((j: any) => j?.day === todayName.value);
  if (todayList.length === 0) return true; // treat as disabled when no schedule today
  return todayList.every((j: any) => isScheduleDisabled(j));
};
const isDoctorDisabled = (item: any) =>
  !hasScheduleToday(item) || isAllSchedulesDisabledToday(item);

const handleBack = () => {
  router.push({
    path: "/antrian/apm/aktif/pasien/non-jkn/data-pasien",
  });
};

const handleBerhasil = async () => {
  try {
    useUtilsStore.setLoading(true);

    console.log("[Apm] handleBerhasil: start", {
      selectedTime: selectedTime.value,
    });
    if (!selectedTime.value) {
      console.warn(
        "[Apm] handleBerhasil: selectedTime kosong, batalkan submit"
      );
      return;
    }

    const patientStatus = apmFlow.patientStatus || "";
    const identity = apmFlow.identity || "";
    const no_identity = apmFlow.noIdentity || "";
    const no_rm = apmFlow.patientData?.noRm || "";

    let payload: any;
    if (
      patientStatus === "success" &&
      (apmFlow.identity === "Passport" ||
        apmFlow.identity === "KTP" ||
        apmFlow.identity === "Lainnya")
    ) {
      payload = {
        patient_data: { identity, no_identity },
        payment_method: apmFlow.paymentMethod || "",
        jadwal_dokter_uuid: selectedTime.value,
      };
    } else if (patientStatus === "success" && apmFlow.identity === "RM") {
      payload = {
        patient_data: { no_rm: no_identity },
        payment_method: apmFlow.paymentMethod || "",
        jadwal_dokter_uuid: selectedTime.value,
      };
    } else {
      payload = {
        patient_data: { identity, no_identity },
        payment_method: apmFlow.paymentMethod || "",
        jadwal_dokter_uuid: selectedTime.value,
      };
    }

    console.log("[Apm] handleBerhasil: payload", payload);
    const response = await apmStore.register(payload);
    console.log("[Apm] handleBerhasil: raw response", response);

    // Ambil data aman dari respons (prioritaskan response.data > response.payload > response)
    const safeResponse =
      (response && (response.data || response.payload)) || response;
    // Opsional: pastikan benar2 plain object
    const cloned = JSON.parse(JSON.stringify(safeResponse || {}));

    apmFlow.setApmSuccessResponse(cloned);
    console.log("[Apm] handleBerhasil: saved to store", cloned);

    await router.push({
      path: "/antrian/apm/aktif/pasien/non-jkn/berhasil",
    });
  } catch (error) {
    console.error("[Apm] handleBerhasil: error", error);
  } finally {
    useUtilsStore.setLoading(false);
  }
};

const selectedType = ref<string | null>(null);
const isDisabled = computed(() => !selectedType.value);
const selectType = (type: string) => {
  selectedType.value = type;
};

const selectedTime = ref<string | null>(null);
const selectTime = (time: string) => {
  selectedTime.value = time;
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
  excludedDokterUuids: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
  excludedDoctorUuidsByPoli: {
    type: Object as PropType<Record<string, string[]>>,
    default: () => ({}),
  },
});

const jadwalDokterStore = useJadwalDokterStore();
const useUtilsStore = utilsStore();

const getDokterPayload = ref<any[]>([]);
const getDokterProperties = ref({
  poliUuid: "",
  name: "",
});

const poliName = ref<string>("");

const jadwalDokterPayload = ref<any[]>([]);
const jadwalDokterProperties = ref({
  page: 1,
  page_size: 99999999999999,
  total: 0,
});

const fetchJadwalDokter = async () => {
  useUtilsStore.setLoading(true);
  try {
    const response = await jadwalDokterStore.getApi(
      jadwalDokterProperties.value.page,
      jadwalDokterProperties.value.page_size
    );

    const selectedPoliUuid = getDokterProperties.value.poliUuid;

    if (Array.isArray(response?.payload)) {
      const filtered = selectedPoliUuid
        ? response.payload.filter(
            (item: any) => item?.poli?.uuid === selectedPoliUuid
          )
        : response.payload;

      // Normalisasi field jadwal_dokter -> jadwalDokter (camelCase)
      jadwalDokterPayload.value = filtered.map((item: any) => ({
        ...item,
        jadwalDokter: Array.isArray(item?.jadwalDokter)
          ? item.jadwalDokter.map((j: any) => ({
              jadwalDokterUuid: j?.jadwalDokterUuid,
              day: j?.day,
              startTime: j?.startTime,
              endTime: j?.endTime,
              kuotaJkn: j?.kuotaJkn,
              kuotaNonJkn: j?.kuotaNonJkn,
              totalKuota: j?.totalKuota,
              sisaKuota: j?.sisaKuota,
              durasiPelayanan: j?.durasiPelayanan,
              status: j?.status,
            }))
          : [],
      }));

      jadwalDokterProperties.value.total = jadwalDokterPayload.value.length;
      console.log("filtered:", jadwalDokterPayload.value);
    } else {
      jadwalDokterPayload.value = [];
      jadwalDokterProperties.value.total = 0;
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    jadwalDokterPayload.value = [];
    jadwalDokterProperties.value.total = 0;
  } finally {
    useUtilsStore.setLoading(false);
  }
};

onMounted(() => {
  // Ambil poli terpilih dari store, bukan dari route.query
  const sel = apmFlow.selectedPoli;
  getDokterProperties.value.poliUuid = sel?.uuid || "";
  poliName.value = sel?.name || "";
  fetchJadwalDokter();
});

// watch(
//   () => route.query.poli_uuid,
//   (newVal) => {
//     selectedPoliUuid.value = (newVal as string) || "";
//     fetchGetDokter(selectedPoliUuid.value);
//   }
// );

const selectedDokter = ref<string | null>(null);
const selectDokter = (doctorUuid: string) => {
  selectedDokter.value = doctorUuid;
  selectedTime.value = null;
};

const selectedDoctorDetail = computed(() => {
  if (!selectedDokter.value) return null;
  const found =
    jadwalDokterPayload.value.find(
      (item: any) => item?.doctor?.uuid === selectedDokter.value
    ) || null;

  if (!found) return null;

  // Hanya jadwal untuk hari ini
  const onlyToday = (found.jadwalDokter || []).filter(
    (j: any) => j?.day === todayName.value
  );

  return { ...found, jadwalDokter: onlyToday };
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
          class="bg-white bg-opacity-30 w-full h-[540px] items-center justify-center relative z-10"
        >
          <div class="grid relative grid-cols-3 gap-4 pt-10">
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
              <Stethoscop class="text-opensimrs-300" :size="28" />
              &nbsp {{ poliName || "Poli" }}
            </div>

            <!-- Button Container (Right) -->
            <div class="flex col-span-1 justify-end items-center mr-6">
              <CustomButton
                label="< &nbsp Kembali"
                outlined
                borderColor="border-opensimrs-300"
                textColor="text-opensimrs-300"
                class="w-[120px]"
                @click="handleBack"
              />
            </div>
          </div>

          <div class="flex items-start mx-16 my-5">
            <div class="pr-6 pl-6 w-full">
              <div class="justify-start pl-1 text-lg font-bold">
                List Dokter
              </div>
              <hr class="bg-black h-[2px] my-2 ml-1" />
              <div class="justify-start pb-4 pl-1 text-sm text-opensimrs-300">
                Silahkan Pilih Dokter
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div v-for="dokter in jadwalDokterPayload" :key="dokter.uuid">
                  <cardDokter
                    :cardDokter="{
                      namaDokter: dokter?.doctor?.name || 'Dokter',
                    }"
                    :active="selectedDokter === dokter?.doctor?.uuid"
                    class="w-full transition-transform duration-300 hover:scale-95"
                    :class="{
                      'opacity-50 pointer-events-none':
                        isDoctorDisabled(dokter),
                    }"
                    @click="
                      !isDoctorDisabled(dokter) &&
                        selectDokter(dokter?.doctor?.uuid)
                    "
                  />
                </div>

                <div
                  v-if="jadwalDokterPayload.length === 0"
                  class="col-span-2 text-sm italic text-gray-500"
                >
                  Tidak ada dokter untuk poli ini.
                </div>
              </div>
            </div>

            <!-- Divider vertikal sesuai Figma -->
            <div
              class="mx-8 w-[4px] bg-opensimrs-300 rounded self-stretch mt-16"
              v-show="selectedDokter"
            ></div>

            <!-- Panel Jam Praktek (selalu tampil) -->
            <div class="" v-show="selectedDokter">
              <div>
                <div class="justify-start pl-1 text-lg font-bold">
                  Jam Praktek
                </div>
                <hr class="bg-black h-[2px] my-2" />
                <div class="justify-start pb-4 pl-1 text-sm text-opensimrs-300">
                  Silahkan Pilih Jam Praktek
                </div>

                <!-- Daftar Jam sesuai Figma -->
                <!-- Ganti kontainer menjadi pembungkus lebar + area scroll di dalamnya -->
                <div class="w-[280px] relative">
                  <!-- Area daftar yang dibatasi tinggi dan bisa scroll -->
                  <div
                    class="grid overflow-y-auto grid-cols-1 gap-4 pr-2 max-h-64"
                  >
                    <template v-if="selectedDoctorDetail">
                      <template
                        v-for="j in selectedDoctorDetail.jadwalDokter"
                        :key="j.jadwalDokterUuid"
                      >
                        <button
                          type="button"
                          :disabled="isScheduleDisabled(j)"
                          :class="[
                            'relative flex items-center justify-center h-[60px] w-[280px] rounded-2xl shadow-md transition-all duration-300',
                            selectedTime === j.jadwalDokterUuid &&
                            !isScheduleDisabled(j)
                              ? 'bg-opensimrs-100 text-white'
                              : 'bg-white text-opensimrs-300',
                            isScheduleDisabled(j)
                              ? 'opacity-50 cursor-not-allowed pointer-events-none'
                              : 'hover:bg-opensimrs-100 hover:text-white',
                            'hover:scale-95',
                          ]"
                          @click="
                            !isScheduleDisabled(j) &&
                              selectTime(j.jadwalDokterUuid)
                          "
                        >
                          <span class="font-extrabold text-[16px]">
                            {{ j.startTime }} - {{ j.endTime }}
                          </span>
                          <CheckCircleIcon
                            :size="20"
                            class="absolute right-4"
                            :class="
                              selectedTime === j.jadwalDokterUuid &&
                              !isScheduleDisabled(j)
                                ? 'text-white'
                                : 'text-transparent'
                            "
                          />
                        </button>
                      </template>
                    </template>
                  </div>

                  <!-- Tombol di luar area scroll sehingga tidak terpengaruh max-h -->
                  <CustomButton
                    v-show="selectedTime"
                    label="Lanjutkan"
                    class="w-[280px] mt-2"
                    backgroundColor="bg-opensimrs-300 hover:bg-opensimrs-400"
                    textColor="text-white"
                    @click="handleBerhasil"
                  />
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
