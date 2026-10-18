<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { apiPenunjangGet } from "@/utils/apiHandler";
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";

const route = useRoute();
const router = useRouter();
const judul = computed(() => String(route.meta.judul ?? "Jadwal HD"));
const data = ref<any[]>([]);
const pesan = ref("");
const menu: SidebarBody[] = [{ name: "Layanan HD", type: linkType.SECTION, child: [
  { name: "Jadwal dan antrean", icon: "PhCalendar", type: linkType.LINK, url: "/hemodialisa/jadwal" },
  { name: "Registrasi", icon: "PhClipboardText", type: linkType.LINK, url: "/hemodialisa/registrasi" },
  { name: "Sesi HD", icon: "PhHeartbeat", type: linkType.LINK, url: "/hemodialisa/sesi" },
  { name: "Pemakaian BHP", icon: "PhPackage", type: linkType.LINK, url: "/hemodialisa/pemakaian" },
]}, { name: "Referensi", type: linkType.SECTION, child: [
  { name: "Mesin dan shift", icon: "DatabaseFill", type: linkType.LINK, url: "/hemodialisa/datamaster/mesin-shift" },
  { name: "Aturan reuse", icon: "DatabaseFill", type: linkType.LINK, url: "/hemodialisa/datamaster/aturan-reuse" },
  { name: "Laporan", icon: "FileReportIcon", type: linkType.LINK, url: "/hemodialisa/laporan" },
]}];
const muat = async () => {
  data.value = []; pesan.value = "";
  try {
    const endpoint = route.path.includes("registrasi") ? "registrasi" : route.path.includes("sesi") ? "jadwal" : "jadwal";
    const hasil: any = await apiPenunjangGet(`/hemodialisa/${endpoint}`);
    data.value = hasil?.payload?.data ?? hasil?.payload ?? [];
  } catch { pesan.value = "Data belum dapat dimuat. Periksa izin dan status modul Hemodialisa."; }
};
onMounted(muat);
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="Hemodialisa" sidebarTitleUrl="/hemodialisa" class="flex-none" :sidebar-body-list="menu" />
    <main class="grow overflow-auto rounded bg-white p-5">
      <header class="mb-4 flex items-center justify-between"><h1 class="text-xl font-semibold">{{ judul }}</h1><button class="rounded border px-3 py-2" @click="muat">Muat ulang</button></header>
      <p v-if="pesan" class="rounded bg-amber-50 p-3 text-amber-800">{{ pesan }}</p>
      <p class="mb-3 text-sm text-gray-600">Data layanan dibatasi pada faskes dari sesi pengguna. Tinjau keputusan klinis dan aturan reuse sebelum digunakan.</p>
      <div v-if="data.length" class="overflow-auto"><table class="w-full border-collapse text-left text-sm"><thead><tr><th class="border p-2">Identitas</th><th class="border p-2">Tanggal</th><th class="border p-2">Status</th></tr></thead><tbody><tr v-for="baris in data" :key="baris.uuid"><td class="border p-2">{{ baris.no_reg_hd ?? baris.uuid }}</td><td class="border p-2">{{ baris.tanggal ?? "—" }}</td><td class="border p-2">{{ baris.status }}</td></tr></tbody></table></div>
      <p v-else-if="!pesan" class="rounded border border-dashed p-8 text-center text-gray-500">Belum ada data untuk ditampilkan.</p>
    </main>
  </div>
</template>
