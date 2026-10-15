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
        name: "Order Fisioterapi",
        icon: "FisioIcon",
        type: linkType.LINK,
        url: "/fisioterapi/order-fisioterapi",
      },
      {
        name: "Penjadwalan Terapi",
        icon: "FisioIcon",
        type: linkType.LINK,
        url: "/fisioterapi/penjadwalan-fisioterapi",
      },
      {
        name: "Evaluasi Terapi",
        icon: "FisioIcon",
        type: linkType.LINK,
        url: "/fisioterapi/evaluasi-terapi",
      },
    ],
  },
  {
    name: "2",
    type: linkType.SECTION,
    child: [
      {
        name: "Booking Terapi",
        icon: "PhAddressBook",
        type: linkType.LINK,
        url: "/fisioterapi/booking-terapi",
      },
    ],
  },
  {
    name: "3",
    type: linkType.SECTION,
    child: [
      {
        name: "Datamaster",
        icon: "DatabaseFill",
        type: linkType.DROPDOWN,
        child: [
          {
            name: "Bed Ruangan",
            type: linkType.LINK,
            url: "/fisioterapi/datamaster/bed-ruangan",
          },
          {
            name: "Tindakan Terapi",
            type: linkType.LINK,
            url: "/fisioterapi/datamaster/tindakan",
          },
          {
            name: "Paket Terapi",
            type: linkType.LINK,
            url: "/fisioterapi/datamaster/paket",
          },
        ],
      },
    ],
  },
  {
    name: "4",
    type: linkType.SECTION,
    child: [
      {
        name: "Laporan",
        icon: "FileReportIcon",
        type: linkType.DROPDOWN,
        child: [
          {
            name: "Kunjungan",
            type: linkType.LINK,
            url: "/fisioterapi/laporan/kunjungan",
          },
          {
            name: "Rekapitulasi Kunjungan Jenis Fisioterapi",
            type: linkType.LINK,
            url: "/fisioterapi/laporan/rekapitulasi-kunjungan-jenis-fisioterapi",
          },
          {
            name: "Rekapitulasi Terapi",
            type: linkType.LINK,
            url: "/fisioterapi/laporan/rekapitulasi-terapi",
          },
          {
            name: "Rekapitulasi Pendapatan Fisioterapi",
            type: linkType.LINK,
            url: "/fisioterapi/laporan/rekapitulasi-pendapatan-fisioterapi",
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
      sidebarTitle="Fisioterapi"
      sidebarTitleUrl="/fisioterapi"
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
