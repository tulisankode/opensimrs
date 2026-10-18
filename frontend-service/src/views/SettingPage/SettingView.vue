<script setup lang="ts">
import GearFillIcon from "@/components/icons/GearFillIcon.vue";
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { computed, ref } from "vue";
import { fiturAktif } from "@/stores/modulFaskes";

// Konfigurasi Integrasi dikelompokkan per sistem tujuan; satu halaman per bagian (/setting/konfigurasi-integrasi/:bagian).
// Bagian yang bergantung fitur katalog hanya tampil bila fiturnya aktif untuk faskes.
const KI = "/setting/konfigurasi-integrasi";
const tautan = (name: string, bagian: string): SidebarBody => ({ name, type: linkType.LINK, url: `${KI}/${bagian}` });
const menuKonfigurasiIntegrasi = (): SidebarBody => ({
  name: "Konfigurasi Integrasi",
  type: linkType.DROPDOWN,
  icon: "GearFillIcon",
  child: [
    {
      name: "BPJS",
      type: linkType.DROPDOWN,
      child: [
        tautan("BPJS PCare", "bpjs-pcare"),
        tautan("BPJS VClaim", "bpjs-vclaim"),
        ...(fiturAktif("antrian_online_bpjs") ? [tautan("Antrean Online (Mobile JKN)", "antrean-bpjs")] : []),
      ],
    },
    tautan("SATUSEHAT", "satusehat"),
    {
      name: "LIS",
      type: linkType.DROPDOWN,
      child: [
        tautan("Lab PK", "lis-pk"),
        ...(fiturAktif("pa_bridging_lis") ? [tautan("Lab PA", "lis-pa")] : []),
        tautan("Mikrobiologi", "lis-mikrobiologi"),
      ],
    },
    ...(fiturAktif("rad_bridging_pacs") ? [{ name: "Radiologi", type: linkType.DROPDOWN, child: [tautan("PACS/RIS", "pacs")] }] : []),
    ...(fiturAktif("bdrs_bridging") ? [{ name: "Bank Darah", type: linkType.DROPDOWN, child: [tautan("UTD", "bdrs-utd")] }] : []),
    ...(fiturAktif("hd_bridging_hdis") ? [{ name: "Hemodialisa", type: linkType.DROPDOWN, child: [tautan("HDIS", "hdis")] }] : []),
    tautan("Helpdesk AI", "helpdesk"),
    tautan("Lainnya", "lainnya"),
  ],
});

const sidebarBodyList = computed<SidebarBody[]>(() => [
  {
    name: "1",
    type: linkType.SECTION,
    child: [
      
          { name: "Profil Faskes", type: linkType.LINK, url: '/setting/profil-faskes', icon:'GearFillIcon' },
          menuKonfigurasiIntegrasi(),
          { name: "Print Out", type: linkType.LINK, url:'/setting/print-out', icon:"GearFillIcon" },
          { name: "Manajemen Modul", type: linkType.LINK, url:'/setting/manajemen-modul', icon:'GearFillIcon' },
          { name: "System", type: linkType.LINK, url:'/setting/system', icon:'GearFillIcon' },
          { name: "Audit Trail", type: linkType.LINK, url:'/setting/audit-trail', icon:'GearFillIcon' },
          // Ekstensi tanpa kode (impor paket SIMRS Studio): superadmin saja
          ...(JSON.parse(localStorage.getItem("user") ?? "{}").role === "super admin" ? [{ name: "Ekstensi", type: linkType.LINK, url: "/setting/ekstensi", icon: "GearFillIcon" }] : []),
    ],
  },
]);
const filter = ref('')
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar
      sidebarTitle="Setting"
      sidebarTitleUrl="/setting/profil-faskes"
      class="flex-none"
      :sidebar-body-list="sidebarBodyList"
      v-model:filter="filter"
    />
    <component
      class="max-h-full overflow-auto grow"
      :is="$route.meta.page || 'div'"
      :filter="filter"
    ></component>
  </div>
</template>
