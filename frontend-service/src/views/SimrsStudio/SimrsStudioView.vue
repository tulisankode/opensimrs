<script setup lang="ts">
// SIMRS Studio: tampil bila Mode Pengembang diaktifkan superadmin (Setting › System) dan pengguna punya hak modul SIMRS Studio.
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { computed, ref } from "vue";
import { useSimrsStudioStore } from "@/stores/simrsStudio";

const studio = useSimrsStudioStore();
const sidebarBodyList = computed<SidebarBody[]>(() => [
  {
    name: "Pengembangan",
    type: linkType.SECTION,
    child: [
      { name: "Beranda", type: linkType.LINK, url: "/studio/beranda", icon: "PhSquaresFour" },
      ...(studio.boleh("Permintaan", "CREATE") ? [{ name: "Permintaan Baru", type: linkType.LINK, url: "/studio/permintaan-baru", icon: "PhPlusCircle" }] : []),
      ...(studio.boleh("Ekstensi", "READ") ? [{ name: "Ekstensi", type: linkType.LINK, url: "/studio/ekstensi", icon: "PhPuzzlePiece" }] : []),
    ],
  },
  {
    name: "Pengaturan",
    type: linkType.SECTION,
    child: [
      { name: "Aturan & Pengetahuan", type: linkType.LINK, url: "/studio/aturan", icon: "PhScroll" },
      ...(studio.boleh("Rilis", "DEPLOY") ? [{ name: "Server & Deploy", type: linkType.LINK, url: "/studio/server", icon: "PhHardDrives" }] : []),
      ...(studio.status.superadmin ? [{ name: "Pengaturan & Agen", type: linkType.LINK, url: "/studio/pengaturan", icon: "PhGearSix" }] : []),
      ...(studio.status.superadmin ? [{ name: "Helpdesk AI", type: linkType.LINK, url: "/studio/helpdesk-ai", icon: "PhHeadset" }] : []),
      ...(studio.boleh("Audit", "READ") ? [{ name: "Audit & Metrik", type: linkType.LINK, url: "/studio/audit", icon: "PhListMagnifyingGlass" }] : []),
    ],
  },
]);
const filter = ref("");
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar
      sidebarTitle="SIMRS Studio"
      sidebarTitleUrl="/studio/beranda"
      class="flex-none"
      :sidebar-body-list="sidebarBodyList"
      v-model:filter="filter"
    />
    <div class="flex min-w-0 grow flex-col gap-2">
      <div v-if="studio.status.beku" class="flex items-center gap-2 rounded-lg bg-danger-50 px-3 py-1.5 text-XS text-danger-400">
        <PhStop :size="16" aria-hidden="true" /> SIMRS Studio sedang dihentikan superadmin — semua item hanya-baca.
      </div>
      <component class="max-h-full min-h-0 min-w-0 grow overflow-auto" :is="$route.meta.page || 'div'" :filter="filter" />
    </div>
  </div>
</template>
