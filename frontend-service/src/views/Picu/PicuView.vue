<script setup lang="ts">
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { computed } from "vue";
import { fiturAktif } from "@/stores/modulFaskes";
import { bolehPicu } from "./usePicu";

// [nama, url, submodul izin, aksi izin, fitur modul, ikon]
const menu: [string, string, string, string, string, string][] = [
  ["Dasbor", "/picu/dashboard", "Dasbor", "READ", "dasbor", "PhGauge"],
  ["Penerimaan", "/picu/penerimaan", "Episode", "CREATE", "episode", "PhUserPlus"],
  ["Episode", "/picu/episode", "Episode", "READ", "episode", "PhListBullets"],
  ["Konfigurasi", "/picu/konfigurasi", "Konfigurasi", "READ", "konfigurasi", "PhGearSix"],
  ["Laporan", "/picu/laporan", "Laporan Operasional", "READ", "laporan", "PhChartBar"],
];
const sidebarBodyList = computed<SidebarBody[]>(() => [{ name: "picu", type: linkType.SECTION,
  child: menu.filter((m) => bolehPicu(m[2], m[3]) && fiturAktif(`picu_${m[4]}`)).map((m) => ({ name: m[0], url: m[1], type: linkType.LINK, icon: m[5] })),
}]);
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar sidebarTitle="PICU" sidebarTitleUrl="/picu" class="flex-none" :sidebar-body-list="sidebarBodyList" />
    <component class="max-h-full overflow-auto grow" :is="$route.meta.page || 'div'" />
  </div>
</template>

<style>
/* Kolom formulir native di halaman PICU (validasi HTML bawaan tetap dipakai). */
.picu-form .label-picu { display: flex; flex-direction: column; gap: 4px; font-size: 0.875rem; font-weight: 600; }
.picu-form input:not([type="checkbox"]), .picu-form select, .picu-form textarea {
  width: 100%; min-height: 40px; padding: 8px 12px; font-weight: 400; background: #fff;
  border: 1px solid #d0d5dd; border-radius: 8px; outline: none;
}
.picu-form textarea { min-height: 80px; }
.picu-form input:not([type="checkbox"]):focus, .picu-form select:focus, .picu-form textarea:focus { border-color: rgb(var(--opensimrs-300)); }
.picu-form select:disabled { background: #f2f4f7; }
.picu-form input[type="checkbox"] { width: 16px; height: 16px; accent-color: rgb(var(--opensimrs-300)); }
</style>
