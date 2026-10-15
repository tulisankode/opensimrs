<script setup lang="ts">
import { computed, watch, type PropType } from "vue";

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
    type: Array as PropType<unknown[]>,
    default: () => [],
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
  poliCallsActive: {
    type: Array as PropType<CallItem[]>,
    default: () => [],
  },
});

const activeNos = computed<Array<string | number>>(() =>
  (Array.isArray(props.admisiCallsActive) ? props.admisiCallsActive : [])
    .map(
      (x) =>
        x?.patient_data?.antrian?.no_antrian_admisi ??
        x?.patientData?.antrian?.noAntrianAdmisi ??
        x?.patientData?.antrian?.no_antrian_admisi ??
        null
    )
    .filter((v): v is string | number => v !== null && v !== undefined)
);

const activeName = computed<string | undefined>(() => {
  const arr = Array.isArray(props.admisiCallsActive)
    ? props.admisiCallsActive
    : [];
  if (!arr.length) return undefined;
  return arr[0]?.patient_data?.name ?? arr[0]?.patientData?.name ?? undefined;
});

const poliActiveNoAt = (idx: number) => {
  const arr = Array.isArray(props.poliCallsActive) ? props.poliCallsActive : [];
  if (arr.length === 0 || idx - 1 >= arr.length) return null;
  const item = arr[idx - 1];
  return (
    item?.patient_data?.antrian?.no_antrian_poli ??
    item?.patientData?.antrian?.noAntrianPoli ??
    item?.patientData?.antrian?.no_antrian_poli ??
    null
  );
};

const poliActiveLabelAt = (idx: number) => {
  const arr = Array.isArray(props.poliCallsActive) ? props.poliCallsActive : [];
  if (arr.length === 0 || idx - 1 >= arr.length) return null;
  const item = arr[idx - 1];
  const poli =
    item?.patient_data?.jadwal_dokter?.nama_poli ??
    item?.patientData?.jadwalDokter?.namaPoli ??
    item?.patientData?.jadwalDokter?.nama_poli ??
    "Poli";
  const dok =
    item?.patient_data?.jadwal_dokter?.nama_dokter ??
    item?.patientData?.jadwalDokter?.namaDokter ??
    item?.patientData?.jadwalDokter?.nama_dokter ??
    "";
  return { poli, dok };
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

const singleType = computed<"poli" | "admisi" | "farmasi" | null>(() => {
  return enabledTypes.value.length === 1 ? enabledTypes.value[0] : null;
});

const columns = computed(() => {
  const cols: Array<"placeholder" | "poli" | "admisi" | "farmasi"> = [
    "placeholder",
    "placeholder",
    "placeholder",
  ];
  let pos = 0;
  for (const key of props.activeOrder) {
    if (pos > 2) break;
    if (key === "poli" && !props.isPoli) continue;
    if (key === "admisi" && !props.isAdmisi) continue;
    if (key === "farmasi" && !props.isFarmasi) continue;
    cols[pos] = key;
    pos++;
  }
  return cols;
});

watch(
  () => props.payload,
  (newPayload) => {
    console.log("Payload data:", newPayload);
  },
  { immediate: true, deep: true }
);
</script>

<template>
  <!-- Header Panggilan -->
  <div class="flex flex-col h-full">
    <div
      class="flex gap-2 justify-center items-center py-1 my-3 w-full text-white rounded-lg bg-opensimrs-300"
    >
      <div>
        <PhMegaphone :size="18" class="scale-x-[-1]" weight="fill" />
      </div>
      <div>Panggilan</div>
    </div>

    <!-- gunakan utilitas grid tailwind + content-area agar tinggi proporsional -->
    <div
      v-if="singleType"
      class="grid grid-cols-3 grid-rows-3 gap-2 content-area"
    >
      <template v-for="item in 9" :key="`single-${item}`">
        <div
          v-if="
            (singleType === 'poli' && poliActiveNoAt(item) != null) ||
            (singleType === 'admisi' && activeNos[item - 1] != null)
          "
          class="grid grid-rows-2 h-full bg-white rounded-lg"
        >
          <div
            class="flex justify-center items-center text-5xl font-extrabold text-opensimrs-300"
          >
            <template v-if="singleType === 'poli'">
              {{ poliActiveNoAt(item) }}
            </template>
            <template v-else>
              {{ activeNos[item - 1] }}
            </template>
          </div>
          <div class="flex rounded-b-lg bg-opensimrs-50">
            <div class="flex items-center w-full">
              <div
                class="flex justify-center items-center p-6 h-full rounded-bl-lg bg-opensimrs-300 rounded-s-lg"
                dir="rtl"
              >
                <PhCaretDoubleRight :size="44" color="#ffffff" weight="bold" />
              </div>
              <div class="px-3 w-full">
                <template v-if="singleType === 'poli'">
                  <div class="text-3xl font-black">
                    {{ poliActiveLabelAt(item)?.poli ?? "Poli" }}
                  </div>
                  <hr class="border-opensimrs-300" />
                  <div class="text-xl font-bold">
                    {{ poliActiveLabelAt(item)?.dok ?? "Ini Dokter" }}
                  </div>
                </template>
                <template v-else>
                  <div class="text-3xl font-black">{{ activeName ?? "" }}</div>
                  <hr class="border-opensimrs-300" />
                  <div class="text-xl font-bold">Admisi</div>
                </template>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="h-full rounded-lg bg-opensimrs-50"></div>
      </template>
    </div>

    <div
      v-else
      class="grid grid-cols-3 grid-rows-3 grid-flow-col gap-2 content-area"
    >
      <template v-for="(colType, colIdx) in columns" :key="colIdx">
        <!-- Kolom Poli -->
        <template v-if="colType === 'poli'">
          <template v-for="item in 3" :key="`poli-${colIdx}-${item}`">
            <div
              v-if="poliActiveNoAt(item) != null"
              class="grid grid-rows-2 h-full bg-white rounded-lg"
            >
              <div
                class="flex justify-center items-center text-5xl font-extrabold text-opensimrs-300"
              >
                {{ poliActiveNoAt(item) }}
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
                      {{ poliActiveLabelAt(item)?.poli ?? "Poli" }}
                    </div>
                    <hr class="border-opensimrs-300" />
                    <div class="text-xl font-bold">
                      {{ poliActiveLabelAt(item)?.dok ?? "Ini Dokter" }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="h-full rounded-lg bg-opensimrs-50"></div>
          </template>
        </template>

        <!-- Kolom Admisi -->
        <template v-else-if="colType === 'admisi'">
          <template v-for="item in 3" :key="`admisi-${colIdx}-${item}`">
            <div
              v-if="activeNos[item - 1] != null"
              class="grid grid-rows-2 h-full bg-white rounded-lg"
            >
              <div
                class="flex justify-center items-center text-5xl font-extrabold text-opensimrs-300"
              >
                {{ activeNos[item - 1] }}
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
                    <div class="text-3xl font-black">{{ activeName ?? "" }}</div>
                    <hr class="border-opensimrs-300" />
                    <div class="text-xl font-bold">Admisi</div>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="h-full rounded-lg bg-opensimrs-50"></div>
          </template>
        </template>

        <!-- Kolom Farmasi -->
        <template v-else-if="colType === 'farmasi'">
          <div
            v-for="item in 3"
            :key="`farmasi-${colIdx}-${item}`"
            class="h-full rounded-lg bg-opensimrs-50"
          ></div>
        </template>

        <!-- Kolom Placeholder -->
        <template v-else>
          <div v-for="item in 3" class="h-full rounded-lg bg-opensimrs-50"></div>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.grid-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  grid-auto-flow: column;
  gap: 12px;
  height: calc(100% - 57px); /* Kurangi tinggi header */
  min-height: 400px;
}

.content-area {
  height: calc(100% - 57px); /* Mengurangi tinggi header internal (≈57px) */
}
</style>
