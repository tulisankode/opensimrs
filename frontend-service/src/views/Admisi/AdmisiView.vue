<script setup lang="ts">
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { ref } from "vue";

const sidebarBodyList = ref<SidebarBody[]>([
  {
    name: "1",
    type: linkType.SECTION,
    child: [
      {
        name: "Rawat Jalan",
        icon: "UserPlusIcon",
        type: linkType.LINK,
        url: "/admisi/rawat-jalan",
      },
      {
        name: "Rawat Inap",
        icon: "UserPlusIcon",
        type: linkType.LINK,
        url: "/admisi/rawat-inap",
      },
      {
        name: "IGD",
        icon: "UserPlusIcon",
        type: linkType.LINK,
        url: "/admisi/igd",
      },
    ],
  },
  {
    name: "2",
    type: linkType.SECTION,
    child: [
      {
        name: "SEP",
        icon: "BPJSIcon",
        type: linkType.DROPDOWN,
        child: [
          {
            name: "Rawat Jalan",
            icon: "Rawat Jalan",
            type: linkType.LINK,
            url: "/admisi/sep/rawat-jalan",
          },
          {
            name: "Rawat Inap",
            icon: "Rawat Inap",
            type: linkType.LINK,
            url: "/admisi/sep/rawat-inap",
          },
          {
            name: "IGD",
            icon: "IGD",
            type: linkType.LINK,
            url: "/admisi/sep/igd",
          },
        ],
      },
      {
        name: "Data Pasien",
        icon: "DatabaseUserIcon",
        type: linkType.LINK,
        url: "/admisi/data-pasien",
      },
      {
        name: "Monitoring Kamar",
        icon: "MonitoringBedIcon",
        type: linkType.LINK,
        url: "/admisi/monitoring-kamar",
      },
    ],
  },
  {
    name: "2",
    type: linkType.SECTION,
    child: [
      {
        name: "Laporan",
        icon: "FileReportIcon",
        type: linkType.DROPDOWN,
        child: [
          {
            name: "Kunjungan",
            icon: "Kunjungan",
            type: linkType.LINK,
            url: "/admisi/laporan/kunjungan",
          },
          // {
          //   name: "Penjamin",
          //   icon: "Penjamin",
          //   type: linkType.LINK,
          //   url: "/admisi/laporan/penjamin",
          // },
          {
            name: "Batal Kunjungan",
            icon: "Batal Kunjungan",
            type: linkType.LINK,
            url: "/admisi/laporan/batal-kunjungan",
          },
          {
            name: "Status Kamar",
            icon: "Status Kamar",
            type: linkType.LINK,
            url: "/admisi/laporan/status-kamar",
          },
          {
            name: "Keperawatan Inap Pasien",
            icon: "Keperawatan Inap Pasien",
            type: linkType.LINK,
            url: "/admisi/laporan/keperawatan-inap-pasien",
          },
          {
            name: "Bayi Baru Lahir",
            icon: "Bayi Baru Lahir",
            type: linkType.LINK,
            url: "/admisi/laporan/bayi-baru-lahir",
          },
          {
            name: "Rekap Kunjungan",
            icon: "Rekap Kunjungan",
            type: linkType.LINK,
            url: "/admisi/laporan/rekap-kunjungan",
          },
        ],
      },
    ],
  },
]);
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar
      sidebarTitle="Admisi"
      sidebarTitleUrl="/admisi"
      class="flex-none"
      :sidebar-body-list="sidebarBodyList"
      showStockBtn
    />
    <component
      class="max-h-full overflow-auto grow"
      :is="$route.meta.page || 'div'"
    ></component>
  </div>
</template>
