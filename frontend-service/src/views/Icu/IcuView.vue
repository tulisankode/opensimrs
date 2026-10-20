<script setup lang="ts">
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { computed, ref, onBeforeUnmount } from "vue";

import { hasPermission } from "@/utils/permissions";
import { fiturAktif, modulAktif } from "@/stores/modulFaskes";
import { useAuthStore } from "@/stores/auth";
const konteks = ref(0);
const lepas = useAuthStore().$onAction(({ name }) => { if (["loginApi", "logoutApi", "tokenApi", "setFaskesUuid"].includes(name)) konteks.value++; });
onBeforeUnmount(lepas);
const sidebarBodyList = computed<SidebarBody[]>(() => [{ name: "icu", type: linkType.SECTION, child: [
  { name: "Dasbor ICU", icon: "PhGaugeFill", type: linkType.LINK, url: "/icu/dashboard", sub: "Dasbor" },
  { name: "Perawatan ICU", icon: "PhHeartbeat", type: linkType.LINK, url: "/icu/perawatan", sub: "Perawatan" },
  { name: "Laporan ICU", icon: "PhChartBar", type: linkType.LINK, url: "/icu/laporan", sub: "Laporan ICU" },
  { name: "Konfigurasi Layanan", icon: "PhGear", type: linkType.LINK, url: "/icu/konfigurasi", sub: "Konfigurasi Layanan", fitur: "icu_konfigurasi_layanan" },
  { name: "Template Klinis", icon: "PhFileText", type: linkType.LINK, url: "/icu/template", sub: "Template Klinis", fitur: "icu_template_klinis" },
].filter((m) => modulAktif("icu") && hasPermission("ICU", m.sub, "READ") && (!m.fitur || fiturAktif(m.fitur))) }]);
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="ICU / Intensif" sidebarTitleUrl="/icu" class="flex-none" :sidebar-body-list="sidebarBodyList" />
    <component :key="konteks" class="max-h-full overflow-auto grow" :is="$route.meta.page || 'div'"></component>
  </div>
</template>
