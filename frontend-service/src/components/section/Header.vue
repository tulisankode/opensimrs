<script setup lang="ts">
import type { ListMenu } from "@/utils/Interface";
import { onMounted, onUnmounted, nextTick, ref, onBeforeMount, computed, watch } from "vue";
import { useAuthStore } from "@/stores/auth";
import { utilsStore } from "@/stores/utils";
import CustomButton from "../Base/CustomButton.vue";
import { useRoute, useRouter } from "vue-router";
import RMCustomSelect from "@/components/Base/RMCustomSelect.vue";
import { useFaskesStore } from "@/stores/datamaster/faskes";
import { useSettingStore } from "@/stores/setting";
import CustomSelect from "../Base/CustomSelect.vue";
import CardPanggilanAdmisi from "@/components/Base/CardPanggilanAdmisi.vue";
import PanelPanggilanPoli from "@/components/Antrian/PanelPanggilanPoli.vue";
import { PhMegaphone, PhX } from '@phosphor-icons/vue';
import { useAntrianCallStore } from "@/stores/antrian/antrianCall";
import AnnouncementIcon from "../icons/AnnouncementIcon.vue";
import { useRJStore } from "@/stores/rawatJalan/laporanrajal";
import { useModulFaskesStore, modulSegera } from "@/stores/modulFaskes";
import { studioAktif, EVENT_STUDIO, mungkinPunyaAkses, useSimrsStudioStore } from "@/stores/simrsStudio";
import { adaEkstensi, muatEkstensi, EVENT_EKSTENSI } from "@/stores/ekstensi";
import { usePermissionStore } from "@/stores/datamaster/permission";
import { logoFaskes } from "@/utils/tema";
import Popover from "primevue/popover";
import TombolBantuan from "./TombolBantuan.vue";
import {
  canShowModuleInProduction,
  getStoredPermissions,
} from "@/utils/permissions";

interface userData {
  name: string;
  role: string;
}

const authStore = useAuthStore();
const emit = defineEmits(["selectedFaskes"]);
const UseUtilsStore = utilsStore();
const faskesStore = useFaskesStore();
const settingStore = useSettingStore();
const antrianCallStore = useAntrianCallStore();
const rjStore = useRJStore();
const modulStore = useModulFaskesStore();

const faskesPayload = ref<any[]>([]);
const router = useRouter();
const route = useRoute();
const goToPage = (url: string) => {
  router.push(url);
};

const listMenu = ref<ListMenu[]>([]);
const templistMenu = ref<ListMenu[]>([
  {
    title: "Dashboard",
    icon: "PhChartLine",
    iconWeight: "bold",
    url: "/dashboard",
  },
  {
    title: "Antrian",
    icon: "PhUsers",
    url: "/antrian",
  },
  {
    title: "Admisi",
    icon: "PhAddressBook",
    url: "/admisi",
  },
  {
    title: "Rawat Jalan",
    icon: "PhHospital",
    url: "/rawat-jalan",
  },
  {
    title: "Rawat Inap",
    icon: "PhHospital",
    url: "/rawat-inap",
  },
  {
    title: "ICU",
    icon: "PhHeartbeat",
    url: "/icu",
  },
  {
    title: "IGD",
    icon: "PhHospital",
    url: "/igd",
  },
  {
    title: "Kamar Operasi",
    icon: "PhKnife",
    url: "/kamar-operasi",
  },
  {
    title: "Gizi",
    icon: "PhBowlFood",
    url: "/gizi",
  },
  {
    title: "Farmasi",
    icon: "PhAsclepius",
    iconWeight: "bold",
    url: "/farmasi",
  },
  {
    title: "Laboratorium",
    icon: "PhMicroscope",
    iconWeight: "bold",
    url: "/laboratorium",
  },
  {
    title: "Fisioterapi",
    icon: "FisioIcon",
    url: "/fisioterapi",
  },
  {
    title: "Radiologi",
    icon: "PhScan",
    iconWeight: "bold",
    url: "/radiologi",
  },
  {
    title: "Patologi Anatomi",
    icon: "PhMicroscope",
    url: "/patologi-anatomi",
  },
  {
    title: "Mikrobiologi",
    icon: "PhBug",
    url: "/mikrobiologi",
  },
  {
    title: "MCU",
    icon: "PhClipboardText",
    url: "/mcu",
  },
  {
    title: "Program Puskesmas",
    icon: "PhBabyCarriage",
    url: "/program-puskesmas",
  },
  {
    title: "CSSD",
    icon: "PhSprayBottle",
    url: "/cssd",
  },
  {
    title: "Bank Darah RS (BDRS)",
    icon: "PhDrop",
    url: "/bank-darah",
  },
  {
    title: "UTD",
    icon: "PhDropHalf",
    url: "/utd",
  },
  {
    title: "Manajemen Ambulans",
    icon: "PhAmbulance",
    url: "/ambulans",
  },
  {
    title: "Training",
    icon: "TrainingIcon",
    url: "/training",
  },
  {
    title: "Koding Rekam Medis",
    icon: "PhFileCode",
    url: "/koding-rm",
  },
  {
    title: "Pembayaran",
    icon: "PhMoneyWavy",
    url: "/pembayaran",
  },
  {
    title: "Inventory",
    icon: "DoubleBoxIcon",
    url: "/inventory",
  },
  {
    title: "Datamaster",
    icon: "PhDatabase",
    url: "/datamaster",
  },
  {
    title: "Laporan",
    icon: "FileReportIcon",
    url: "/laporan",
  },
]);

const profileEdit = () => {
  isDialogVisible.value = false;
  router.push({ name: "setting-profil-akun" });
};

const clickSetting = () => {
  isDialogVisible.value = false;
  router.push({ name: "setting-profil-faskes" });
};
const isDialogVisible = ref(false);

const showDialog = () => {
  isDialogVisible.value = true;
};

const isCardPanggilanVisible = ref(false);
// Ikon toa (panggilan antrian) hanya untuk faskes dengan modul Antrian aktif (Setting › Manajemen Modul).
const antrianAktif = computed(() => modulStore.aktif("antrian"));

const toggleCardPanggilan = () => {
  isCardPanggilanVisible.value = !isCardPanggilanVisible.value;
};

const getCurrentStore = computed(() => {
  const path = route.path;
  if (path.includes('/admisi')) {
    return antrianCallStore;
  }
  // Di luar Admisi panel menampilkan antrian poli (rawat jalan).
  return rjStore;
});

const pesanKosong = computed(() => {
  const jenis = route.path.includes('/admisi') ? 'pendaftaran' : 'poli';
  if (activeTab.value === 'terlewat') return `Tidak ada antrian ${jenis} yang terlewat hari ini.`;
  if (activeTab.value === 'selesai') return `Belum ada antrian ${jenis} yang selesai hari ini. Antrian pindah ke sini setelah diproses lalu diselesaikan, atau setelah pasien pulang.`;
  return `Tidak ada antrian ${jenis} yang menunggu hari ini.`;
});

const fetchAntrianData = async () => {
  if (getCurrentStore.value) {
      await getCurrentStore.value.getAllAntrianCall();
  }
};

watch(isCardPanggilanVisible, (newValue) => {
  if (newValue) {
    fetchAntrianData();
  }
});

const activeTab = ref('aktif');

const filteredPanggilan = computed(() => {
  const list = getCurrentStore.value?.antrianList;
  if (!list) return [];
  
  switch (activeTab.value) {
    case 'aktif':
      return list.filter(p => [0, 1, 3].includes(p.statusPanggilan));
    case 'terlewat':
      return list.filter(p => p.statusPanggilan === 2);
    case 'selesai':
      return list.filter(p => p.statusPanggilan === 4);
    default:
      return [];
  }
});

const handlePanggil = async (uuid: string) => {
  if (getCurrentStore.value) {
    await getCurrentStore.value.updateAntrianCall(uuid, 1);
  }
};

const handleLewati = async (uuid: string) => {
  if (getCurrentStore.value) {
    await getCurrentStore.value.updateAntrianCall(uuid, 2);
  }
};

const handleProses = async (uuid: string) => {
  if (getCurrentStore.value) {
    await getCurrentStore.value.updateAntrianCall(uuid, 3);
  }
};

const handleSelesai = async (uuid: string) => {
  if (getCurrentStore.value) {
    await getCurrentStore.value.updateAntrianCall(uuid, 4);
  }
};

const userData = ref<userData>();
const logout = async () => {
  UseUtilsStore.setLoading(true);
  try {
    await authStore.logoutApi();
    router.push("login");
  } catch (error: any) {
    console.log(error.message);
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

onBeforeMount(async () => {
  await fetchFaskes();
  authStore.setFaskesUuid(faskesUuid.value ?? "");
  emit("selectedFaskes");
});

// Menu atas = modul pada permission user ∩ modul aktif faskes (Setting › Manajemen Modul).
const susunMenu = () => {
  const menu: ListMenu[] = [templistMenu.value[0]];
  getStoredPermissions().forEach((module) => {
    if (!canShowModuleInProduction(module.module)) return;
    if (!modulStore.menuAktif(module.module)) return;

    const listMenuFind = templistMenu.value.find(
      (menu) => menu.title == module.module && menu.title != "Dashboard"
    );
    if (listMenuFind && !menu.includes(listMenuFind)) {
      menu.push(listMenuFind);
    }
  });
  // Urutan menu mengikuti templistMenu (alur klinis dulu, administrasi belakangan), bukan urutan permission.
  menu.sort((a, b) => templistMenu.value.indexOf(a) - templistMenu.value.indexOf(b));
  // Modul penunjang medik dikelompokkan dalam satu menu dropdown "Penunjang" (semua segmen).
  const anakPenunjang = menu
    .filter((m) => MODUL_PENUNJANG.includes(m.title))
    .sort((a, b) => MODUL_PENUNJANG.indexOf(a.title) - MODUL_PENUNJANG.indexOf(b.title));
  if (anakPenunjang.length) {
    const posisi = menu.indexOf(anakPenunjang[0]);
    const grup: ListMenu = { title: "Penunjang", icon: "PhFirstAidKit", url: "", anak: anakPenunjang };
    const sisa = menu.filter((m) => !anakPenunjang.includes(m));
    sisa.splice(posisi, 0, grup);
    listMenu.value = sisa;
  } else {
    listMenu.value = menu;
  }
  // SIMRS Studio: hanya bila Mode Pengembang diaktifkan superadmin (Setting › System).
  // Ekstensi tanpa kode yang terpasang untuk pengguna ini (laporan/cetak/formulir dari SIMRS Studio).
  if (adaEkstensi()) listMenu.value = [...listMenu.value, { title: "Ekstensi", icon: "PhPuzzlePiece", url: "/ekstensi" }];
  if (studioAktif()) listMenu.value = [...listMenu.value, { title: "SIMRS Studio", icon: "PhFlask", url: "/studio" }];
  // Modul segmen yang masih dikembangkan: dikumpulkan di menu "Segera" (badge Soon) agar faskes tahu paketnya
  // lengkap tanpa mendesak menu modul aktif.
  menuSegera.value = modulSegera()
    .map((m) => ({ title: NAMA_SEGERA[m.kode] ?? m.nama, icon: IKON_SEGERA[m.kode] ?? "PhPuzzlePiece", url: `/segera/${m.kode}`, segera: true }))
    .filter((s) => !menu.some((x) => x.title === s.title));
};
const MODUL_PENUNJANG = ["Laboratorium", "Patologi Anatomi", "Mikrobiologi", "Radiologi", "Fisioterapi", "CSSD", "Bank Darah RS (BDRS)", "UTD", "Manajemen Ambulans"];
const menuAktif = (m: ListMenu) =>
  m.anak ? m.anak.some((a) => checkActiveTab(a.url)) : checkActiveTab(m.url) || route.path === m.url;
const popupGrup = ref();
const grupTerbuka = ref<ListMenu[]>([]);
const klikMenu = (m: ListMenu, e: Event) => {
  if (!m.anak) return goToPage(m.url);
  grupTerbuka.value = m.anak;
  popupGrup.value?.toggle(e);
};
const bukaGrup = (url: string) => {
  popupGrup.value?.hide();
  goToPage(url);
};
// Menu yang tidak muat di lebar header dipindah ke tombol "Lainnya" (RS kelas A bisa >12 modul).
const wadahMenu = ref<HTMLElement>();
const ukurMenu = ref<HTMLElement>();
const jumlahTampil = ref(99);
const popupLainnya = ref();
const LEBAR_LAINNYA = 120;
const hitungMenuTampil = () => {
  const wadah = wadahMenu.value;
  const ukur = ukurMenu.value;
  if (!wadah || !ukur) return;
  const lebarItem = Array.from(ukur.children).map((el) => (el as HTMLElement).offsetWidth + 10);
  const tersedia = wadah.clientWidth;
  if (lebarItem.reduce((a, b) => a + b, 0) <= tersedia) {
    jumlahTampil.value = lebarItem.length;
    return;
  }
  let pakai = LEBAR_LAINNYA;
  let n = 0;
  while (n < lebarItem.length && pakai + lebarItem[n] <= tersedia) pakai += lebarItem[n++];
  jumlahTampil.value = n;
};
const menuTampil = computed(() => listMenu.value.slice(0, jumlahTampil.value));
const menuLainnya = computed(() => listMenu.value.slice(jumlahTampil.value));
const lainnyaAktif = computed(() => menuLainnya.value.some(menuAktif));
const bukaLainnya = (url: string) => {
  popupLainnya.value?.hide();
  goToPage(url);
};
let pengamatLebar: ResizeObserver | undefined;
watch(listMenu, () => nextTick(hitungMenuTampil));
// Izin sesi diperbarui (mis. setelah Manajemen Modul disimpan) → susun ulang menu.
const saatIzinBerubah = () => susunMenu();
onMounted(() => {
  window.addEventListener("izin-berubah", saatIzinBerubah);
  window.addEventListener(EVENT_STUDIO, saatIzinBerubah);
  window.addEventListener(EVENT_EKSTENSI, saatIzinBerubah);
  // Katalog izin dari server untuk editor Role/User (memuat modul baru); gagal = tetap pakai daftar statis.
  usePermissionStore().muatKatalog().catch(() => {});
});
onUnmounted(() => {
  window.removeEventListener("izin-berubah", saatIzinBerubah);
  window.removeEventListener(EVENT_STUDIO, saatIzinBerubah);
  window.removeEventListener(EVENT_EKSTENSI, saatIzinBerubah);
});
onMounted(() => {
  pengamatLebar = new ResizeObserver(() => hitungMenuTampil());
  if (wadahMenu.value) pengamatLebar.observe(wadahMenu.value);
});
onUnmounted(() => pengamatLebar?.disconnect());

const menuSegera = ref<ListMenu[]>([]);
const popupSegera = ref();
const bukaSegera = (url: string) => {
  popupSegera.value?.hide();
  goToPage(url);
};

const NAMA_SEGERA: Record<string, string> = {
  akuntansi: "Akuntansi",
};
const IKON_SEGERA: Record<string, string> = {
  akuntansi: "PhCalculator",
};

onMounted(async () => {
  fetchFaskes();
  loadFaskesFromLocalStorage();
  userData.value = JSON.parse(localStorage.getItem("user") ?? "");
  susunMenu();
  // Status Mode Pengembang (SIMRS Studio) dari studio-service; perubahan memicu EVENT_STUDIO → susun ulang menu.
  if (mungkinPunyaAkses()) useSimrsStudioStore().muat().catch(() => {});
  muatEkstensi().catch(() => {});
  try {
    await modulStore.muat();
    susunMenu();
  } catch {
    /* tetap pakai menu dari cache */
  }
});

const checkActiveTab = (url: string) => {
  let split = route.path.split("/");
  return `/${split[1]}` == url;
};
const fetchFaskes = async () => {
  try {
    const response = await faskesStore.getAktifApi();
    if (response && response.payload) {
      faskesPayload.value = response.payload;
    } else {
      faskesPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch faskes", error);
    faskesPayload.value = [];
  }
};

const fetchSettingProfilFaskesData = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await settingStore.getProfilFaskesApi();
    if (response) {
      UseUtilsStore.setProfilFaskes(response);
    } else {
      console.error("Unexpected response Structure", response);
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const faskesName = ref<string>("");
const faskesSelected = ref<string>("");
const faskesUuid = ref<string>("");

const updateDataFaskes = async (value: string) => {
  const response = await authStore.tokenApi(faskesSelected.value);
  localStorage.setItem("access_token", `Bearer ${response.payload.newToken}`);
  localStorage.setItem("faskes", JSON.stringify(response.payload));
  authStore.setFaskesUuid(value);
  await fetchSettingProfilFaskesData();
  loadFaskesFromLocalStorage();
  window.location.reload()
};

const loadFaskesFromLocalStorage = () => {
  const faskesData = localStorage.getItem("faskes");
  if (faskesData) {
    try {
      const parsedFaskesData = JSON.parse(faskesData);
      faskesSelected.value = parsedFaskesData.faskesUuid || "";
      faskesName.value = parsedFaskesData.faskesName || "";
      faskesUuid.value = parsedFaskesData.faskesUuid || "";
    } catch (error) {
      console.error("Error parsing faskes data from localStorage:", error);
    }
  }
};

const getUserRole = () => {
  const userDataString = localStorage.getItem("user");
  if (userDataString) {
    try {
      const userData = JSON.parse(userDataString);
      return userData.role;
    } catch (error) {
      console.error("Error parsing user data from localStorage:", error);
      return null;
    }
  }
  return null;
};

const isSuperAdmin = getUserRole() === "super admin";
</script>

<template>
  <div
    class="flex justify-between gap-5 pr-5 mt-[10px] bg-opensimrs-300 rounded-xl max-md:flex-wrap shadow-md mx-3"
  >
    <div
      class="flex min-w-0 flex-1 gap-5 text-sm leading-5 text-white whitespace-nowrap max-md:flex-wrap h-[60px]"
    >
      <div
        class="grid grid-cols-[max-content_max-content_max-content] gap-1 justify-center items-center px-2.5 rounded-xl shadow-sm bg-white"
      >
        <!-- Logo faskes dari Setting › Logo & Warna; bila belum diunggah pakai logo aplikasi. -->
        <img
          v-if="logoFaskes()"
          :src="logoFaskes()!"
          alt="Logo faskes"
          class="col-span-3 my-auto h-[50px] max-w-[170px] object-contain"
        />
        <template v-else>
          <img
            loading="lazy"
            src="../../assets/images/opensimrs-logo.png"
            class="shrink-0 self-stretch my-auto mx-1 aspect-square w-[50px] h-[50px]"
          />
          <div class="bg-opensimrs-300 w-[3px] h-[50px] my-auto rounded-md"></div>
          <img
            loading="lazy"
            src="../../assets/images/opensimrs.png"
            class="self-stretch object-contain w-[106px] my-auto shrink-0"
          />
        </template>
      </div>
      <div ref="wadahMenu" class="relative flex min-w-0 flex-1 gap-2.5 my-auto overflow-hidden">
        <!-- Salinan tak terlihat untuk mengukur lebar tiap menu (font semibold = lebar terbesar). -->
        <div ref="ukurMenu" class="invisible absolute flex gap-2.5 font-semibold" aria-hidden="true">
          <div v-for="menu in listMenu" :key="menu.title" class="flex items-center gap-2.5 h-8 px-3">
            <component :is="menu.icon" class="my-auto" />
            <div class="self-center">{{ menu.title }}</div>
            <PhCaretDown v-if="menu.anak" :size="12" />
          </div>
        </div>
        <div
          v-for="menu in menuTampil"
          :key="menu.title"
          @click="klikMenu(menu, $event)"
          class="cursor-pointer flex shrink-0 items-center gap-2.5 justify-center bg-white rounded-xl h-8 px-3"
          :class="[menuAktif(menu) ? 'text-opensimrs-300 font-semibold' : 'bg-opacity-30']"
          :aria-haspopup="menu.anak ? 'menu' : undefined"
        >
          <component
            :is="menu.icon"
            :weight="menu.iconWeight ? menu.iconWeight : 'fill'"
            class="my-auto"
          />
          <div class="self-center">{{ menu.title }}</div>
          <PhCaretDown v-if="menu.anak" :size="12" aria-hidden="true" />
        </div>
        <button
          v-if="menuLainnya.length"
          type="button"
          class="flex h-8 shrink-0 items-center gap-1.5 rounded-xl bg-white px-3"
          :class="lainnyaAktif ? 'text-opensimrs-300 font-semibold' : 'bg-opacity-30'"
          aria-haspopup="menu"
          @click="popupLainnya?.toggle($event)"
        >
          <PhDotsThreeOutline weight="fill" class="my-auto" aria-hidden="true" />
          Lainnya
          <PhCaretDown :size="12" aria-hidden="true" />
        </button>
      </div>
      <!-- Dropdown grup menu (mis. Penunjang). -->
      <Popover ref="popupGrup">
        <div class="flex min-w-[200px] flex-col gap-1" role="menu">
          <button
            v-for="menu in grupTerbuka"
            :key="menu.url"
            type="button"
            role="menuitem"
            class="flex items-center gap-2.5 rounded-md px-2 py-2 text-left text-SM text-grey-500 hover:bg-opensimrs-50"
            :class="{ 'bg-opensimrs-50 font-semibold text-opensimrs-300': checkActiveTab(menu.url) }"
            @click="bukaGrup(menu.url)"
          >
            <component :is="menu.icon" weight="fill" class="shrink-0 text-opensimrs-300" aria-hidden="true" />
            <span class="grow">{{ menu.title }}</span>
          </button>
        </div>
      </Popover>
      <Popover ref="popupLainnya">
        <div class="flex min-w-[220px] flex-col gap-1" role="menu" aria-label="Modul lainnya">
          <template v-for="menu in menuLainnya" :key="menu.title">
            <div v-if="menu.anak" class="px-2 pt-2 text-[10px] font-bold uppercase tracking-wide text-grey-300">
              {{ menu.title }}
            </div>
            <button
              v-for="item in menu.anak ?? [menu]"
              :key="item.url"
              type="button"
              role="menuitem"
              class="flex items-center gap-2.5 rounded-md px-2 py-2 text-left text-SM text-grey-500 hover:bg-opensimrs-50"
              :class="{ 'bg-opensimrs-50 font-semibold text-opensimrs-300': checkActiveTab(item.url), 'pl-4': menu.anak }"
              @click="bukaLainnya(item.url)"
            >
              <component :is="item.icon" weight="fill" class="shrink-0 text-opensimrs-300" aria-hidden="true" />
              <span class="grow">{{ item.title }}</span>
            </button>
          </template>
        </div>
      </Popover>
      <!-- Modul segmen yang masih dikembangkan (badge Soon), selalu terlihat di ujung menu. -->
      <button
        v-if="menuSegera.length"
        type="button"
        class="my-auto flex h-8 shrink-0 items-center gap-1.5 rounded-xl bg-white px-3"
        :class="route.path.startsWith('/segera') ? 'text-opensimrs-300 font-semibold' : 'bg-opacity-30'"
        aria-haspopup="menu"
        @click="popupSegera?.toggle($event)"
      >
        <PhRocketLaunch weight="fill" class="my-auto" aria-hidden="true" />
        Segera
        <span class="rounded-full bg-danger-300 px-1.5 py-[1px] text-[10px] font-bold leading-3 text-white">
          {{ menuSegera.length }}
        </span>
        <PhCaretDown :size="12" aria-hidden="true" />
      </button>
      <Popover ref="popupSegera">
        <div class="flex min-w-[220px] flex-col gap-1" role="menu" aria-label="Modul segera hadir">
          <button
            v-for="menu in menuSegera"
            :key="menu.url"
            type="button"
            role="menuitem"
            class="flex items-center gap-2.5 rounded-md px-2 py-2 text-left text-SM text-grey-500 hover:bg-opensimrs-50"
            :class="{ 'bg-opensimrs-50 font-semibold text-opensimrs-300': route.path === menu.url }"
            @click="bukaSegera(menu.url)"
          >
            <component :is="menu.icon" weight="fill" class="shrink-0 text-opensimrs-300" aria-hidden="true" />
            <span class="grow">{{ menu.title }}</span>
            <span class="rounded-full bg-danger-300 px-1.5 py-[1px] text-[9px] font-bold uppercase leading-3 text-white">Soon</span>
          </button>
        </div>
      </Popover>
    </div>
    <div class="flex flex-shrink-0 gap-5 my-auto">
      <div class="flex items-center justify-between">
        <svg
          v-if="antrianAktif"
          @click="toggleCardPanggilan"
          class="relative w-8 aspect-square mr-4 cursor-pointer"
          viewBox="0 0 27 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M13.5333 6.06673H2.86662C2.15937 6.06673 1.4811 6.34768 0.981 6.84778C0.480903 7.34788 0.199951 8.02615 0.199951 8.7334V14.0667C0.199951 14.774 0.480903 15.4523 0.981 15.9523C1.4811 16.4524 2.15937 16.7334 2.86662 16.7334H4.19995V22.0667C4.19995 22.4204 4.34043 22.7595 4.59048 23.0095C4.84052 23.2596 5.17966 23.4001 5.53328 23.4001H8.19995C8.55357 23.4001 8.89271 23.2596 9.14276 23.0095C9.39281 22.7595 9.53329 22.4204 9.53329 22.0667V16.7334H13.5333L20.2 22.0667V0.733398L13.5333 6.06673ZM26.2 11.4001C26.2 13.6801 24.92 15.7467 22.8666 16.7334V6.06673C24.9066 7.06673 26.2 9.1334 26.2 11.4001Z"
            fill="white"
          />
        </svg>
        <!-- Bantuan (Helpdesk AI) menggantikan ikon lonceng statis -->
        <TombolBantuan />
      </div>
      <div class="flex items-center justify-center cursor-pointer">
        <div class="">
          <img
            loading="lazy"
            src="../../assets/icons/User Account.svg"
            class="relative w-10 aspect-square"
            @click="showDialog"
          />
          <img
            src="../../assets/icons/green_profile.svg"
            alt=""
            class="absolute right-9 top-6"
          />
        </div>
        <Dialog
          v-model:visible="isDialogVisible"
          position="topright"
          pt:root:class="rounded-2xl"
          :dismissableMask="true"
          :modal="true"
        >
          <template #container>
            <div class="p-2.5 rounded-2xl w-[180px]">
              <div class="font-semibold text-black text-XS">
                {{ userData?.name }}
              </div>
              <div class="text-[#79808F] text-[8px]">
                Terakhir Login 4 Mar 2024 | 12:00
              </div>
              <div
                class="flex items-center gap-1 p-2 my-2.5 rounded-md bg-opensimrs-75"
              >
                <span class="w-2 h-2 bg-opensimrs-300 rounded-full"></span>
                <span class="font-semibold text-opensimrs-300 text-[8px]">{{
                  userData?.role
                }}</span>
              </div>
              <RMCustomSelect
                v-if="isSuperAdmin"
                v-model="faskesSelected"
                :options="faskesPayload"
                place-holder="Pilih Faskes"
                optionLabel="name"
                optionValue="uuid"
                :showCal="false"
                @update:modelValue="updateDataFaskes"
              />
              <hr class="border-[#D9DCE1] border-1 mt-2.5" />
              <div class="flex flex-col items-start py-2">
                <CustomButton
                  label="Profile"
                  text-color="text-gray-300"
                  outlined
                  @click="profileEdit"
                  icon="PhUser"
                  iconPos="left"
                  pt:label:class="font-normal text-SM"
                />
                <CustomButton
                  label="Setting"
                  text-color="text-gray-300"
                  outlined
                  @click="clickSetting"
                  iconPos="left"
                  icon="PhGearSix"
                  pt:label:class="font-normal text-SM "
                />
              </div>
              <hr class="border-[#D9DCE1] border-1 mb-2.5" />

              <div class="flex w-full gap-5 cursor-pointer">
                <CustomButton
                  @click="logout"
                  label="LOGOUT"
                  full
                  class="font-semibold"
                  iconPos="left"
                  icon="PhSignOut"
                  pt:label:class="text-XS"
                />
              </div>
            </div>
          </template>
        </Dialog>
      </div>
    </div>
     <Transition name="drawer">
    <div v-show="isCardPanggilanVisible && antrianAktif" class="fixed inset-0 z-50 flex justify-end">
    <div
      @click="toggleCardPanggilan"
      class="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
    ></div>

    <div class="relative w-full max-w-lg bg-white h-full flex flex-col shadow-xl">
      <div class="flex items-center justify-between p-4 border-b">
        <div class="flex items-center gap-x-2">
          <AnnouncementIcon :size="24" class="text-opensimrs-300" />
          <h2 class="font-bold text-lg text-opensimrs-300">Panggilan Antrian</h2>
        </div>
        <button @click="toggleCardPanggilan" class="text-gray-500 hover:text-gray-800">
          <PhX :size="20" weight="bold" />
        </button>
      </div>
      <!-- Antrian poli: panel dengan filter antrian saya / poli tugas, penghitung, cari, panggil berikutnya -->
      <PanelPanggilanPoli v-if="!route.path.includes('/admisi')" :terbuka="isCardPanggilanVisible" />
      <template v-else>
      <Tabs style="margin-top: 7px;"
      v-model:value="activeTab"
      :dt="{
        tabActiveBackground: 'rgb(var(--opensimrs-50))',
        tabActiveColor: 'rgb(var(--opensimrs-300))',
        tabActiveBorderColor: 'rgb(var(--opensimrs-300))',
      }"
    >
      <TabList :pt="{ tabList: 'h-10 text-SM' }">
        <Tab
          class="py-0 px-[10px]"
          value="aktif"
          :pt="{ root: 'rounded-t-lg' }"
        >
          <div class="flex">
            Antrian Aktif
          </div>
        </Tab>
        <Tab
          class="py-0 px-[10px]"
          value="terlewat"
          :pt="{ root: 'rounded-t-lg' }"
        >
          <div class="flex">
            Terlewat
          </div>
        </Tab>
        <Tab
          class="py-0 px-[10px]"
          value="selesai"
          :pt="{ root: 'rounded-t-lg' }"
        >
          <div class="flex">
            Selesai
          </div>
        </Tab>
      </TabList>
    </Tabs>
     <div class="flex flex-col gap-y-3 p-4 flex-grow overflow-y-auto">
        <template v-if="route.path.includes('/admisi')">
          <CardPanggilanAdmisi
            v-for="panggilan in filteredPanggilan"
            :key="panggilan.uuid"
            :panggilan="panggilan"
            @panggil="handlePanggil"
            @lewati="handleLewati"
            @proses="handleProses"
            @selesai="handleSelesai"
          />
        </template>
        <p v-if="filteredPanggilan.length === 0" class="py-6 text-center text-sm text-gray-500">
          {{ pesanKosong }}
        </p>
      </div>
      </template>
    </div>
  </div>
</Transition>
  </div>
</template>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: all 0.3s ease-in-out;
}

.drawer-enter-from,
.drawer-leave-to {
  & > div:first-child {
    opacity: 0;
  }
  & > div:last-child {
    transform: translateX(100%);
  }
}

.drawer-enter-to,
.drawer-leave-from {
  & > div:first-child {
    opacity: 1;
  }
  & > div:last-child {
    transform: translateX(0);
  }
}
</style>
