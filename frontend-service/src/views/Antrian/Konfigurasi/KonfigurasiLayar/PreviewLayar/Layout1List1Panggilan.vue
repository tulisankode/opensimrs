<script setup lang="ts">
import { computed, ref } from "vue";

/* Props */
const props = defineProps<{
  media?: any;
  admisiCallsWaiting?: any[];
  admisiCallsActive?: any[];
  poliCallsWaiting?: any[];
  poliCallsActive?: any[];
  isPoli?: boolean;
  isAdmisi?: boolean;
  isFarmasi?: boolean;
  activeOrder?: Array<"poli" | "admisi" | "farmasi">;
}>();

/* Helper: convert various YouTube URLs to embed URL */
const toEmbedUrl = (url?: string) => {
  if (!url) return "";
  try {
    const u = new URL(url);
    // youtu.be/<id>
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }
    // youtube.com/watch?v=<id>
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      // youtube.com/embed/<id>
      if (u.pathname.startsWith("/embed/")) return url;
    }
    return "";
  } catch {
    return "";
  }
};

const embedUrl = computed(() => toEmbedUrl(props.media));

const serviceType = computed<"poli" | "admisi" | "farmasi" | null>(() => {
  if (props.isPoli) return "poli";
  if (props.isAdmisi) return "admisi";
  if (props.isFarmasi) return "farmasi";
  const order = Array.isArray(props.activeOrder) ? props.activeOrder : [];
  return order[0] ?? null;
});

const waitingNos = computed<string[]>(() => {
  if (serviceType.value === "poli") {
    return (Array.isArray(props.poliCallsWaiting) ? props.poliCallsWaiting : [])
      .map(
        (x: any) =>
          x?.patient_data?.antrian?.no_antrian_poli ??
          x?.patientData?.antrian?.noAntrianPoli ??
          x?.patientData?.antrian?.no_antrian_poli ??
          null
      )
      .filter((v: any) => !!v);
  }

  if (serviceType.value === "admisi") {
    return (
      Array.isArray(props.admisiCallsWaiting) ? props.admisiCallsWaiting : []
    )
      .map(
        (x: any) =>
          x?.patient_data?.antrian?.no_antrian_admisi ??
          x?.patientData?.antrian?.noAntrianAdmisi ??
          x?.patientData?.antrian?.no_antrian_admisi ??
          null
      )
      .filter((v: any) => !!v);
  }

  return [];
});

const activeCall = computed(() => {
  const admisiA = Array.isArray(props.admisiCallsActive)
    ? props.admisiCallsActive
    : [];
  const poliA = Array.isArray(props.poliCallsActive)
    ? props.poliCallsActive
    : [];

  if (serviceType.value === "poli") {
    return { item: poliA[0] ?? null, type: "poli" as const };
  }
  if (serviceType.value === "admisi") {
    return { item: admisiA[0] ?? null, type: "admisi" as const };
  }
  if (serviceType.value === "farmasi") {
    return { item: null, type: "farmasi" as const };
  }
  return { item: null, type: null as any };
});

const hasActiveCall = computed(() => {
  return !!activeCall.value?.item;
});

const activeNo = computed<string>(() => {
  const { item, type } = activeCall.value;
  if (!type) return "-";
  if (type === "poli") {
    return (
      item?.patient_data?.antrian?.no_antrian_poli ??
      item?.patientData?.antrian?.noAntrianPoli ??
      item?.patientData?.antrian?.no_antrian_poli ??
      "-"
    );
  }
  if (type === "admisi") {
    return (
      item?.patient_data?.antrian?.no_antrian_admisi ??
      item?.patientData?.antrian?.noAntrianAdmisi ??
      item?.patientData?.antrian?.no_antrian_admisi ??
      "-"
    );
  }
  return "-";
});

const activeName = computed<string | undefined>(() => {
  const { item, type } = activeCall.value;
  if (!type) return undefined;
  if (type === "poli") {
    return (
      item?.patient_data?.jadwal_dokter?.nama_poli ??
      item?.patientData?.jadwalDokter?.namaPoli ??
      item?.patientData?.jadwalDokter?.nama_poli ??
      "Poli"
    );
  }
  if (type === "admisi") {
    return item?.patient_data?.name ?? item?.patientData?.name ?? undefined;
  }
  return "Farmasi";
});

const activeLabel = computed(() => {
  const { item, type } = activeCall.value;
  if (!type) return "";
  if (type === "poli") {
    return (
      item?.patient_data?.jadwal_dokter?.nama_dokter ??
      item?.patientData?.jadwalDokter?.namaDokter ??
      item?.patientData?.jadwalDokter?.nama_dokter ??
      ""
    );
  }
  if (type === "admisi") return "Admisi";
  return "Farmasi";
});

// ========= 3 kolom x 6 baris, isi secara kolom (column-major) =========
// Ambil maksimal 18 sel: 6 baris per kolom x 3 kolom.
// Urutan penempatan: isi kolom 1 (baris 1..6), lanjut kolom 2 (1..6), kolom 3 (1..6).
const displayedCells = computed(() => {
  const cells: string[] = [];
  for (let i = 0; i < 18; i++) {
    cells.push(waitingNos.value[i] ?? "-");
  }
  return cells;
});
const panggilanText = ref("");
</script>

<template>
  <div class="flex gap-2 pt-1 h-full">
    <!-- ===== Bagian Kiri : 1 List Antrian ===== -->
    <div class="flex flex-col flex-1">
      <!-- Header Informasi Antrian -->
      <div
        class="flex gap-2 justify-center items-center py-1 my-3 w-full text-white rounded-lg bg-opensimrs-300"
      >
        <PhInfo :size="18" weight="fill" />
        <span>Informasi Antrian</span>
      </div>

      <!-- List Antrian -->
      <div
        class="flex overflow-hidden flex-col bg-white rounded-lg border-2 content-area border-opensimrs-300"
      >
        <!-- Header Lokasi -->
        <div
          class="py-2 text-sm font-semibold text-center text-white rounded-t-lg bg-opensimrs-300"
        >
          {{
            serviceType === "poli"
              ? "Poli"
              : serviceType === "admisi"
              ? "Admisi"
              : serviceType === "farmasi"
              ? "Farmasi"
              : "Lokasi Pelayanan 1"
          }}
        </div>
        <div class="flex-1">
          <!-- Grid 3 kolom x 6 baris, pengisian per kolom -->
          <div class="grid grid-cols-3 grid-rows-6 h-full">
            <div
              v-for="(item, idx) in displayedCells"
              :key="idx"
              class="flex justify-center items-center text-black border border-gray-200 min-h-[60px]"
              :class="
                Math.floor(idx / 3) % 2 === 1 ? 'bg-opensimrs-50' : 'bg-white'
              "
            >
              <span class="text-5xl font-bold">{{ item }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== Bagian Kanan : 1 Panggilan + 1 Youtube ===== -->
    <div class="flex flex-col w-1/3 h-full">
      <!-- Header Panggilan -->
      <div
        class="flex gap-2 justify-center items-center py-1 my-3 w-full text-white rounded-lg bg-opensimrs-300"
      >
        <PhMegaphone :size="18" class="scale-x-[-1]" weight="fill" />
        <span>Panggilan</span>
      </div>

      <!-- Gunakan grid agar kotak Panggilan & Youtube seimbang -->
      <div class="grid grid-rows-2 gap-2 content-area">
        <!-- Kotak Panggilan -->
        <div
          v-if="hasActiveCall"
          class="grid grid-rows-2 bg-white rounded-lg border-2 border-opensimrs-300"
        >
          <div
            class="flex justify-center items-center text-5xl font-extrabold text-opensimrs-300"
          >
            {{ activeNo }}
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
                <div class="text-3xl font-black">
                  {{ activeName ?? "-" }}
                </div>
                <hr class="border-opensimrs-300" />
                <div class="text-xl font-bold whitespace-pre-line">
                  {{ activeLabel }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="h-full rounded-lg bg-opensimrs-50"></div>

        <!-- Kotak Youtube -->
        <div
          class="flex justify-center items-center font-bold text-white rounded-lg border-2 bg-opensimrs-300 border-opensimrs-300"
        >
          <iframe
            v-if="embedUrl"
            :src="embedUrl"
            title="YouTube video"
            class="w-full h-full rounded-lg"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
          ></iframe>
          <span v-else>Youtube</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.content-area {
  height: calc(100% - 57px); /* Mengurangi tinggi header internal (≈57px) */
}
</style>
