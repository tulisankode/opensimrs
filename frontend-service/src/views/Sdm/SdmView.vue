<script setup lang="ts">
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { fiturAktif } from "@/stores/modulFaskes";
import { computed } from "vue";

// HR / SDM (penunjang-service /hr, STD-0035 fase 1): kepegawaian & kredensial pegawai. Menu disaring izin oleh Sidebar
// dan status fitur katalog. Jadwal dinas, kehadiran/cuti, pelatihan, dan penggajian belum tersedia (fitur "Segera"),
// sehingga sengaja tidak ditampilkan sebagai menu.
const sidebarBodyList = computed<SidebarBody[]>(() => [
  {
    name: "1",
    type: linkType.SECTION,
    child: [
      ...(fiturAktif("sdm_kepegawaian") ? [{ name: "Kepegawaian", icon: "PhUsersThree", type: linkType.LINK, url: "/sdm/kepegawaian" }] : []),
      ...(fiturAktif("sdm_kredensial") ? [{ name: "Kredensial", icon: "PhIdentificationCard", type: linkType.LINK, url: "/sdm/kredensial" }] : []),
    ],
  },
]);
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="HR / SDM" sidebarTitleUrl="/sdm" class="flex-none" :sidebar-body-list="sidebarBodyList" />
    <component class="max-h-full overflow-auto grow" :is="$route.meta.page || 'div'"></component>
  </div>
</template>
