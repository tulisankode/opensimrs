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
        name: "Kasir",
        icon: "CashRegisterIcon",
        type: linkType.LINK,
        url: "/pembayaran/kasir",
      },
      {
        name: "Transaksi",
        icon: "PayMoneyIcon",
        type: linkType.DROPDOWN,
        // url: "/pembayaran/transaksi",
        child:[
          {
            name: "Pelayanan",
            type: linkType.LINK,
            url: "/pembayaran/transaksi/pelayanan",
          },
          {
            name: "APS & OTC",
            type: linkType.LINK,
            url: "/pembayaran/transaksi/APSOTC",
          },
        ],
      },
      {
        name: "Closed Bill",
        icon: "ClosedBillIcon",
        type: linkType.LINK,
        url: "/pembayaran/closed-bill",
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
            name: "Pendapatan",
            type: linkType.LINK,
            url: "/pembayaran/laporan/pendapatan",
          },
          {
            name: "Pembayaran Kunjungan",
            type: linkType.LINK,
            url: "/pembayaran/laporan/pembayaran",
          },
          {
            name: "Closing Kasir",
            type: linkType.LINK,
            url: "/pembayaran/laporan/closing",
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
      sidebarTitle="Pembayaran"
      sidebarTitleUrl="/pembayaran"
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
