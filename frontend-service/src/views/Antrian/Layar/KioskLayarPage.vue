<script setup lang="ts">
// Layar antrian mode kiosk untuk TV: dibuka langsung dari URL /layar/:uuid?kunci=… tanpa login dan
// tanpa klik. Data diperbarui berkala; panggilan baru/ulang diumumkan dengan suara.
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute } from "vue-router";
import PreviewLayout3x3 from "@/views/Antrian/Konfigurasi/KonfigurasiLayar/PreviewLayar/Layout3x3Panggilan.vue";
import PreviewLayout3x2 from "@/views/Antrian/Konfigurasi/KonfigurasiLayar/PreviewLayar/Layout3x2Panggilan.vue";
import PreviewLayoutList3Panggilan3 from "@/views/Antrian/Konfigurasi/KonfigurasiLayar/PreviewLayar/LayoutList3Panggilan3.vue";
import PreviewLayout2List2Panggilan from "@/views/Antrian/Konfigurasi/KonfigurasiLayar/PreviewLayar/Layout2List2Panggilan.vue";
import PreviewLayout1List1Panggilan from "@/views/Antrian/Konfigurasi/KonfigurasiLayar/PreviewLayar/Layout1List1Panggilan.vue";
import opensimrsLogo from "@/assets/images/opensimrs-logo.png";
import opensimrsText from "@/assets/images/opensimrs.png";
import { urlPublikAntrian } from "@/utils/apiHandler";
import {
  siapkanSuara,
  suaraDiizinkan,
  teksPanggilanAdmisi,
  teksPanggilanPoli,
  umumkan,
} from "@/utils/pengumumanAntrian";

const INTERVAL_PANTAU_MS = 3000;

const route = useRoute();
const uuid = computed(() => String(route.params.uuid ?? ""));
const kunci = computed(() => String(route.query.kunci ?? ""));

const layar = ref<any>(null);
const namaFaskes = ref("");
const admisi = ref<any[]>([]);
const poli = ref<any[]>([]);
const galat = ref("");
const terputus = ref(false);
const perluKetuk = ref(false);

const timeNow = ref("");
const dateNow = ref("");

const panggilanTerakhir = new Map<string, string>();
let sudahDimuat = false;
let pantauId: number | null = null;
let jamId: number | null = null;
let tanggalBuka = "";
let wakeLock: any = null;

const statusDipanggil = (x: any) => x.status_panggilan === 1;
const statusMenunggu = (x: any) => x.status_panggilan === 0;

const komponenLayar = computed(() => {
  switch (layar.value?.tipe_layar) {
    case 1: return PreviewLayout3x3;
    case 2: return PreviewLayout3x2;
    case 3: return PreviewLayoutList3Panggilan3;
    case 4: return PreviewLayout2List2Panggilan;
    case 5: return PreviewLayout1List1Panggilan;
    default: return null;
  }
});

const urutanAktif = computed(() =>
  (["admisi", "poli", "farmasi"] as const).filter((k) =>
    k === "admisi" ? layar.value?.is_admisi : k === "poli" ? layar.value?.is_poli : layar.value?.is_farmasi
  )
);

const propsLayar = computed(() => ({
  payload: [],
  isPoli: !!layar.value?.is_poli,
  isAdmisi: !!layar.value?.is_admisi,
  isFarmasi: !!layar.value?.is_farmasi,
  activeOrder: urutanAktif.value,
  media: layar.value?.media ?? "",
  admisiCallsActive: admisi.value.filter(statusDipanggil),
  admisiCallsWaiting: admisi.value.filter(statusMenunggu),
  poliCallsActive: poli.value.filter(statusDipanggil),
  poliCallsWaiting: poli.value.filter(statusMenunggu),
}));

const flashText = computed<string[]>(() => (Array.isArray(layar.value?.flash_text) ? layar.value.flash_text : []));

const umumkanPanggilanBaru = () => {
  const daftar: Array<{ item: any; teks: string }> = [];
  for (const item of admisi.value.filter(statusDipanggil)) {
    const nomor = item.patient_data?.antrian?.no_antrian_admisi;
    if (nomor) daftar.push({ item, teks: teksPanggilanAdmisi(nomor) });
  }
  for (const item of poli.value.filter(statusDipanggil)) {
    const nomor = item.patient_data?.antrian?.no_antrian_poli;
    const jd = item.patient_data?.jadwal_dokter ?? {};
    if (nomor) daftar.push({ item, teks: teksPanggilanPoli(nomor, jd.nama_poli, jd.nama_dokter) });
  }
  for (const { item, teks } of daftar) {
    const tanda = String(item.updated_at ?? "");
    if (panggilanTerakhir.get(item.uuid) === tanda) continue;
    panggilanTerakhir.set(item.uuid, tanda);
    // Saat layar baru menyala, panggilan lama tidak diumumkan ulang.
    if (sudahDimuat) umumkan(teks);
  }
  sudahDimuat = true;
};

const muat = async () => {
  if (!uuid.value || !kunci.value) {
    galat.value = "Link layar tidak lengkap. Salin ulang link kiosk dari menu Antrian › Layar.";
    return;
  }
  try {
    const res = await fetch(
      urlPublikAntrian(`/kiosk/layar/${encodeURIComponent(uuid.value)}?kunci=${encodeURIComponent(kunci.value)}`),
      { cache: "no-store" }
    );
    if (res.status === 401 || res.status === 404) {
      galat.value = "Link layar tidak berlaku. Minta link kiosk terbaru dari admin (menu Antrian › Layar).";
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { payload } = await res.json();
    galat.value = "";
    terputus.value = false;
    layar.value = payload.layar;
    namaFaskes.value = payload.faskes?.name ?? "";
    admisi.value = payload.admisi ?? [];
    poli.value = payload.poli ?? [];
    umumkanPanggilanBaru();
  } catch {
    // Data terakhir tetap ditampilkan; coba lagi pada putaran berikutnya.
    terputus.value = true;
  }
};

const perbaruiJam = () => {
  const now = new Date();
  timeNow.value = `${now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" })} WIB`;
  dateNow.value = now.toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  // Ganti hari: muat ulang halaman agar antrian & aplikasi selalu segar.
  const tgl = now.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" });
  if (tanggalBuka && tgl !== tanggalBuka) window.location.reload();
  tanggalBuka = tgl;
};

const kunciLayarMenyala = async () => {
  try {
    wakeLock = await (navigator as any).wakeLock?.request("screen");
  } catch {
    wakeLock = null;
  }
};

const aktifkanSuara = async () => {
  siapkanSuara();
  perluKetuk.value = false;
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
  } catch {
    /* layar penuh tidak wajib */
  }
  kunciLayarMenyala();
};

const saatTerlihat = () => {
  if (document.visibilityState === "visible") kunciLayarMenyala();
};

onMounted(() => {
  document.title = "Layar Antrian";
  perbaruiJam();
  jamId = window.setInterval(perbaruiJam, 1000);
  siapkanSuara();
  // Chrome kiosk dengan --autoplay-policy=no-user-gesture-required langsung boleh bersuara;
  // selain itu tampilkan ajakan ketuk layar sekali.
  window.setTimeout(() => (perluKetuk.value = !suaraDiizinkan()), 800);
  kunciLayarMenyala();
  document.addEventListener("visibilitychange", saatTerlihat);
  muat();
  pantauId = window.setInterval(muat, INTERVAL_PANTAU_MS);
});

onUnmounted(() => {
  if (pantauId) clearInterval(pantauId);
  if (jamId) clearInterval(jamId);
  document.removeEventListener("visibilitychange", saatTerlihat);
  wakeLock?.release?.();
});
</script>

<template>
  <div class="fixed inset-0 flex flex-col bg-opensimrs-75 overflow-hidden px-1 pt-1 select-none" @click="perluKetuk && aktifkanSuara()">
    <div v-if="galat" class="m-auto max-w-xl rounded-xl bg-white p-8 text-center shadow">
      <div class="text-2xl font-semibold text-opensimrs-300">Layar Antrian</div>
      <p class="mt-3 text-lg text-gray-600">{{ galat }}</p>
    </div>

    <template v-else>
      <div class="flex gap-4 items-center font-semibold text-white rounded-lg bg-opensimrs-300 text-subHeading">
        <div class="flex bg-white w-[180px] justify-center items-center gap-1 rounded-lg h-full">
          <img :src="opensimrsLogo" class="shrink-0 self-stretch my-auto mx-1 aspect-square w-[50px] h-full" />
          <div class="bg-opensimrs-300 w-[3px] h-[50px] my-auto rounded-md"></div>
          <img :src="opensimrsText" class="self-stretch object-contain w-[106px] my-auto shrink-0" />
        </div>
        <div>{{ namaFaskes || layar?.judul }}</div>
        <div v-if="terputus" class="rounded-full bg-[#B42318] px-3 py-1 text-xs">Koneksi terputus, mencoba lagi…</div>
        <div class="mr-3 ml-auto font-semibold text-right">
          <div class="text-2xl font-semibold">{{ timeNow }}</div>
          <div class="text-sm">{{ dateNow }}</div>
        </div>
      </div>

      <div class="flex-1 min-h-0 px-1">
        <component v-if="komponenLayar" :is="komponenLayar" v-bind="propsLayar" class="h-full" />
      </div>

      <div class="mt-3 font-semibold text-white rounded-tl-lg rounded-tr-lg bg-opensimrs-300">
        <div class="marquee" aria-label="Running text">
          <div class="marquee__track" style="--duration: 20s">
            <span v-for="(item, idx) in flashText" :key="`${idx}-${item}`" class="mx-2">{{ item }}</span>
          </div>
        </div>
      </div>
    </template>

    <div v-if="perluKetuk && !galat" class="absolute inset-0 flex items-center justify-center bg-black/60 cursor-pointer">
      <div class="rounded-2xl bg-white px-10 py-8 text-center shadow-xl">
        <div class="text-3xl font-semibold text-opensimrs-300">Ketuk layar untuk mengaktifkan suara</div>
        <p class="mt-3 text-gray-600">Agar tidak perlu diketuk, jalankan Chrome mode kiosk dengan opsi
          <code>--autoplay-policy=no-user-gesture-required</code>.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.marquee {
  overflow: hidden;
  white-space: nowrap;
  display: block;
}
.marquee__track {
  display: inline-block;
  padding-left: 100%;
  animation: marquee var(--duration, 20s) linear infinite;
}
@keyframes marquee {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-100%);
  }
}
</style>
