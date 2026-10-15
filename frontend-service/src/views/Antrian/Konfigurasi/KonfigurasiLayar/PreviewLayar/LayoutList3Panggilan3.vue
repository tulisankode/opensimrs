<script setup lang="ts">
import { computed, type PropType } from "vue";

type CallItem = {
  patient_data?: {
    name?: string;
    antrian?: {
      no_antrian_admisi?: string | number;
      no_antrian_poli?: string | number;
    };
    jadwal_dokter?: {
      nama_poli?: string;
      nama_dokter?: string;
    };
  };
  patientData?: {
    name?: string;
    antrian?: {
      noAntrianAdmisi?: string | number;
      no_antrian_admisi?: string | number;
      noAntrianPoli?: string | number;
      no_antrian_poli?: string | number;
    };
    jadwalDokter?: {
      namaPoli?: string;
      nama_poli?: string;
      namaDokter?: string;
      nama_dokter?: string;
    };
  };
};

const props = defineProps({
  payload: {
    type: [Array, Object] as PropType<unknown[] | Record<string, unknown>>,
    default: () => ({}),
  },
  isPoli: {
    type: Boolean,
    default: false,
  },
  isAdmisi: {
    type: Boolean,
    default: false,
  },
  isFarmasi: {
    type: Boolean,
    default: false,
  },
  activeOrder: {
    type: Array as () => Array<"poli" | "admisi" | "farmasi">,
    default: () => [],
  },
  admisiCallsActive: {
    type: Array as PropType<CallItem[]>,
    default: () => [],
  },
  admisiCallsWaiting: {
    type: Array as PropType<CallItem[]>,
    default: () => [],
  },
  poliCallsActive: {
    type: Array as PropType<CallItem[]>,
    default: () => [],
  },
  poliCallsWaiting: {
    type: Array as PropType<CallItem[]>,
    default: () => [],
  },
});

// Informasi antrian
const admisiWaitingNoAt = (idx: number) => {
  const arr = Array.isArray(props.admisiCallsWaiting)
    ? props.admisiCallsWaiting
    : [];
  if (arr.length === 0 || idx - 1 >= arr.length) return null;
  const item = arr[idx - 1];
  return item?.patientData?.antrian?.noAntrianAdmisi ?? null;
};

const poliWaitingNoAt = (idx: number) => {
  const arr = Array.isArray(props.poliCallsWaiting)
    ? props.poliCallsWaiting
    : [];
  if (arr.length === 0 || idx - 1 >= arr.length) return null;
  const item = arr[idx - 1];
  return (
    item?.patient_data?.antrian?.no_antrian_poli ??
    item?.patientData?.antrian?.noAntrianPoli ??
    null
  );
};

const enabledTypes = computed<Array<"poli" | "admisi" | "farmasi">>(() => {
  const order = Array.isArray(props.activeOrder) ? props.activeOrder : [];
  const fallback: Array<"poli" | "admisi" | "farmasi"> = [
    "admisi",
    "poli",
    "farmasi",
  ];
  const base = order.length ? order : fallback;
  return base.filter((k) =>
    k === "poli"
      ? props.isPoli
      : k === "admisi"
      ? props.isAdmisi
      : props.isFarmasi
  );
});

const callSlots = computed<
  Array<"poli" | "admisi" | "farmasi" | "placeholder">
>(() => {
  const types = enabledTypes.value;
  if (!types.length) return ["placeholder", "placeholder", "placeholder"];
  return [types[0], types[1] ?? types[0], types[2] ?? types[0]];
});

const callIndexForTypeAt = (idx: number, type: string) => {
  const slots = callSlots.value;
  const t = slots[idx - 1];
  if (t !== type) return 0;
  return slots.slice(0, idx).filter((x) => x === type).length - 1;
};

const getCallDataAt = (idx: number) => {
  const slot = callSlots.value[idx - 1];
  if (!slot || slot === "placeholder") return null;

  if (slot === "admisi") {
    const arr = Array.isArray(props.admisiCallsActive)
      ? props.admisiCallsActive
      : [];
    const n = callIndexForTypeAt(idx, "admisi");
    const item = arr[n];
    if (!item) return null;
    const no =
      item?.patient_data?.antrian?.no_antrian_admisi ??
      item?.patientData?.antrian?.noAntrianAdmisi ??
      item?.patientData?.antrian?.no_antrian_admisi ??
      "-";
    const name = item?.patient_data?.name ?? item?.patientData?.name ?? "-";
    return { no, name, label: "Admisi" };
  }

  if (slot === "poli") {
    const arr = Array.isArray(props.poliCallsActive)
      ? props.poliCallsActive
      : [];
    const n = callIndexForTypeAt(idx, "poli");
    const item = arr[n];
    if (!item) return null;
    const no =
      item?.patient_data?.antrian?.no_antrian_poli ??
      item?.patientData?.antrian?.noAntrianPoli ??
      item?.patientData?.antrian?.no_antrian_poli ??
      "-";
    const name = item?.patient_data?.name ?? item?.patientData?.name ?? "-";
    const poliName =
      item?.patient_data?.jadwal_dokter?.nama_poli ??
      item?.patientData?.jadwalDokter?.namaPoli ??
      item?.patientData?.jadwalDokter?.nama_poli ??
      "Poli";
    const dokName =
      item?.patient_data?.jadwal_dokter?.nama_dokter ??
      item?.patientData?.jadwalDokter?.namaDokter ??
      item?.patientData?.jadwalDokter?.nama_dokter ??
      "";
    return { no, name, label: `${poliName}\n${dokName}` };
  }

  return { no: "-", name: "-", label: "Farmasi" };
};

const poliAt = (idx: number) => {
  const arr = Array.isArray(props.payload) ? props.payload : [];
  if (arr.length === 0) return null;
  // gunakan modulo agar tidak error saat jumlah payload < 3
  return arr[idx % arr.length] ?? null;
};
</script>

<template>
  <div class="flex gap-2 pt-1 h-full">
    <!-- Bagian Kiri: Informasi Antrian (3 Kolom List) -->
    <div class="flex flex-1 gap-2">
      <!-- Header Informasi Antrian -->
      <div class="w-full">
        <div
          class="flex gap-2 justify-center items-center py-1 my-3 w-full text-white rounded-lg bg-opensimrs-300"
        >
          <div>
            <PhInfo :size="18" weight="fill" />
          </div>
          <div>Informasi Antrian</div>
        </div>

        <!-- 3 Kolom List -->
        <div class="flex gap-3 content-area">
          <!-- Kolom 1: Admisi atau Placeholder -->
          <div
            class="flex overflow-hidden flex-col w-full h-full bg-white rounded-lg"
          >
            <template v-if="isAdmisi">
              <div class="py-2 font-bold text-center text-white bg-opensimrs-300">
                Admisi
              </div>
              <div class="grid flex-1 grid-rows-6">
                <div
                  v-for="i in 6"
                  :key="'admisi-' + i"
                  class="flex justify-center items-center px-4 text-5xl font-extrabold text-black"
                  :class="i % 2 === 0 ? 'bg-opensimrs-50' : 'bg-white'"
                >
                  {{ admisiWaitingNoAt(i) ?? "-" }}
                </div>
              </div>
            </template>
            <template v-else>
              <div class="py-2 font-bold text-center text-white bg-opensimrs-300">
                Lokasi 1
              </div>
              <div class="grid flex-1 grid-rows-6">
                <div
                  v-for="i in 6"
                  :key="'placeholder1-' + i"
                  class="flex justify-center items-center px-4 text-2xl font-extrabold"
                  :class="i % 2 === 0 ? 'bg-opensimrs-50' : 'bg-white'"
                >
                  -
                </div>
              </div>
            </template>
          </div>

          <!-- Kolom 2: Poli atau Placeholder -->
          <div
            class="flex overflow-hidden flex-col w-full h-full bg-white rounded-lg"
          >
            <template v-if="isPoli">
              <div class="py-2 font-bold text-center text-white bg-opensimrs-300">
                Poli
              </div>
              <div class="grid flex-1 grid-rows-6">
                <div
                  v-for="i in 6"
                  :key="'poli-' + i"
                  class="flex justify-center items-center px-4 text-2xl font-extrabold"
                  :class="i % 2 === 0 ? 'bg-opensimrs-50' : 'bg-white'"
                >
                  {{ poliWaitingNoAt(i) ?? "-" }}
                </div>
              </div>
            </template>
            <template v-else>
              <div class="py-2 font-bold text-center text-white bg-opensimrs-300">
                Lokasi 2
              </div>
              <div class="grid flex-1 grid-rows-6">
                <div
                  v-for="i in 6"
                  :key="'placeholder2-' + i"
                  class="flex justify-center items-center px-4 text-2xl font-extrabold"
                  :class="i % 2 === 0 ? 'bg-opensimrs-50' : 'bg-white'"
                >
                  -
                </div>
              </div>
            </template>
          </div>

          <!-- Kolom 3: Farmasi atau Placeholder -->
          <div
            class="flex overflow-hidden flex-col w-full h-full bg-white rounded-lg"
          >
            <template v-if="isFarmasi">
              <div class="py-2 font-bold text-center text-white bg-opensimrs-300">
                Farmasi
              </div>
              <div class="grid flex-1 grid-rows-6">
                <div
                  v-for="i in 6"
                  :key="'farmasi-row-' + i"
                  class="grid grid-cols-2"
                >
                  <div
                    class="flex justify-center items-center px-4 text-2xl font-extrabold border-r border-opensimrs-100"
                    :class="i % 2 === 0 ? 'bg-opensimrs-50' : 'bg-white'"
                  >
                    R00{{ i }}
                  </div>
                  <div
                    class="flex justify-center items-center px-4 text-2xl font-extrabold"
                    :class="i % 2 === 0 ? 'bg-opensimrs-50' : 'bg-white'"
                  >
                    NR00{{ i }}
                  </div>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="py-2 font-bold text-center text-white bg-opensimrs-300">
                Lokasi 3
              </div>
              <div class="grid flex-1 grid-rows-6">
                <div
                  v-for="i in 6"
                  :key="'placeholder2-' + i"
                  class="flex justify-center items-center px-4 text-2xl font-extrabold"
                  :class="i % 2 === 0 ? 'bg-opensimrs-50' : 'bg-white'"
                >
                  -
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Bagian Kanan: Panggilan (3 Kotak) -->
    <div class="flex flex-col w-1/3 h-full">
      <!-- Header Panggilan -->
      <div
        class="flex gap-2 justify-center items-center py-1 my-3 w-full text-white rounded-lg bg-opensimrs-300"
      >
        <div>
          <PhMegaphone :size="18" class="scale-x-[-1]" weight="fill" />
        </div>
        <div>Panggilan</div>
      </div>

      <!-- 3 Kotak Panggilan -->
      <div class="grid grid-rows-3 gap-2 content-area">
        <template v-if="isAdmisi || isPoli">
          <template v-for="item in 3" :key="'panggilan-' + item">
            <div
              v-if="getCallDataAt(item) && getCallDataAt(item)?.no !== '-'"
              class="grid grid-rows-2 h-full bg-white rounded-lg"
            >
              <div
                class="flex justify-center items-center text-5xl font-extrabold text-opensimrs-300"
              >
                {{ getCallDataAt(item)?.no }}
              </div>
              <div class="flex rounded-b-lg bg-opensimrs-50">
                <div class="flex items-center w-full">
                  <div
                    class="flex justify-center items-center p-6 h-full rounded-bl-lg bg-opensimrs-300 rounded-s-lg"
                    dir="rtl"
                  >
                    <PhCaretDoubleRight
                      :size="44"
                      color="#ffffff"
                      weight="bold"
                    />
                  </div>
                  <div class="px-3 w-full">
                    <div class="text-3xl font-black">
                      {{ getCallDataAt(item)?.name ?? '' }}
                    </div>
                    <hr class="border-opensimrs-300" />
                    <div class="text-xl font-bold whitespace-pre-line">
                      {{
                        getCallDataAt(item)?.label ??
                        (isAdmisi ? "Admisi" : "Poli")
                      }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="h-full rounded-lg bg-opensimrs-50"></div>
          </template>
        </template>
        <template v-else>
          <div
            v-for="item in 3"
            :key="'placeholder-panggilan-' + item"
            class="h-full rounded-lg bg-opensimrs-50"
          ></div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.content-area {
  height: calc(100% - 57px); /* 40px = tinggi header internal */
}
</style>
