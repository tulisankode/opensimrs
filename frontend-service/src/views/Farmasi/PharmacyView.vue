<script setup lang="ts">
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { computed, ref } from "vue";
import { filterSidebarByPermission } from "@/utils/permissions";

const sidebarBodyList = ref<SidebarBody[]>([
  {
    name: "1",
    type: linkType.SECTION,
    child: [
      {
        name: "Resep Dokter",
        icon: "PillFillIcon",
        type: linkType.LINK,
        url: "/farmasi/resep-dokter",
        permission: {
          module: "Farmasi",
          submodule: "Resep Dokter",
          action: "READ",
        },
      },
      {
        name: "Penjualan Obat",
        icon: "ShoppingBagIcon",
        type: linkType.LINK,
        url: "/farmasi/penjualan-obat",
        permission: {
          module: "Farmasi",
          submodule: "Penjualan Obat",
          action: "READ",
        },
      },
      {
        name: "Retur Obat & Material",
        icon: "UndoFillIcon",
        type: linkType.LINK,
        url: "/farmasi/retur-obat-&-material",
        permission: {
          module: "Farmasi",
          submodule: "Retur Obat dan Material",
          action: "READ",
        },
      },
      {
        name: "Farmasi Ruangan",
        icon: "SyringeFillIcon",
        type: linkType.LINK,
        url: "/farmasi/farmasi-ruangan",
        permission: {
          module: "Farmasi",
          submodule: "Farmasi Ruangan",
          action: "READ",
        },
      },
      {
        name: "Riwayat Transaksi",
        icon: "HistoryIcon",
        type: linkType.LINK,
        url: "/farmasi/riwayat-transaksi",
        permission: {
          module: "Farmasi",
          submodule: "Riwayat Transaksi",
          action: "READ",
        },
      },
    ],
  },
  {
    name: "2",
    type: linkType.SECTION,
    child: [
      {
        name: "Datamaster",
        icon: "DatabaseFill",
        type: linkType.DROPDOWN,
        child: [
          {
            name: "Aturan Pakai",
            type: linkType.LINK,
            url: "/farmasi/datamaster/aturan-pakai",
            permission: {
              module: "Farmasi",
              submodule: "Datamaster",
              feature: "Aturan Pakai",
              action: "READ",
            },
          },
          {
            name: "Satuan",
            type: linkType.LINK,
            url: "/farmasi/datamaster/satuan",
            permission: {
              module: "Farmasi",
              submodule: "Datamaster",
              feature: "Satuan",
              action: "READ",
            },
          },
          {
            name: "Bentuk Sediaan",
            type: linkType.LINK,
            url: "/farmasi/datamaster/bentuk-sediaan",
            permission: {
              module: "Farmasi",
              submodule: "Datamaster",
              feature: "Bentuk Sediaan",
              action: "READ",
            },
          },
          {
            name: "Kategori Obat",
            type: linkType.LINK,
            url: "/farmasi/datamaster/kategori-obat",
            permission: {
              module: "Farmasi",
              submodule: "Datamaster",
              feature: "Kategori Obat",
              action: "READ",
            },
          },
          {
            name: "Manufaktur",
            type: linkType.LINK,
            url: "/farmasi/datamaster/manufaktur",
            permission: {
              module: "Farmasi",
              submodule: "Datamaster",
              feature: "Manufaktur",
              action: "READ",
            },
          },
          {
            name: "Jenis Stok",
            type: linkType.LINK,
            url: "/farmasi/datamaster/jenis-stok",
            permission: {
              module: "Farmasi",
              submodule: "Datamaster",
              feature: "Jenis Stok",
              action: "READ",
            },
          },
          {
            name: "Lokasi Stok",
            type: linkType.LINK,
            url: "/farmasi/datamaster/lokasi-stok",
            permission: {
              module: "Farmasi",
              submodule: "Datamaster",
              feature: "Lokasi Stok",
              action: "READ",
            },
          },
          {
            name: "Item Medis",
            type: linkType.LINK,
            url: "/farmasi/datamaster/item-medis",
            permission: {
              module: "Farmasi",
              submodule: "Datamaster",
              feature: "Item Medis",
              action: "READ",
            },
          },
          {
            name: "Cara Pakai",
            type: linkType.LINK,
            url: "/farmasi/datamaster/cara-pakai",
            permission: {
              module: "Farmasi",
              submodule: "Datamaster",
              feature: "Cara Pakai",
              action: "READ",
            },
          },
          {
            name: "Komposisi",
            type: linkType.LINK,
            url: "/farmasi/datamaster/komposisi",
            permission: {
              module: "Farmasi",
              submodule: "Datamaster",
              feature: "Komposisi",
              action: "READ",
            },
          },
          {
            name: "Konfigurasi Harga",
            type: linkType.LINK,
            url: "/farmasi/datamaster/konfigurasi-harga",
            permission: {
              module: "Farmasi",
              submodule: "Datamaster",
              feature: "Konfigurasi Harga",
              action: "READ",
            },
          },
        ],
      },
      {
        name: "Laporan",
        icon: "FileReportIcon",
        type: linkType.DROPDOWN,
        child: [
          {
            name: "Pendapatan",
            type: linkType.LINK,
            url: "/farmasi/laporan/pendapatan",
            permission: {
              module: "Farmasi",
              submodule: "Riwayat Transaksi",
              feature: "Pendapatan",
              action: "READ",
            },
          },
          {
            name: "Waktu Tunggu",
            type: linkType.LINK,
            url: "/farmasi/laporan/waktu-tunggu",
            permission: {
              module: "Farmasi",
              submodule: "Riwayat Transaksi",
              feature: "Waktu Tunggu",
              action: "READ",
            },
          },
          {
            name: "Rekap Pendapatan Resep Per Apotik",
            type: linkType.LINK,
            url: "/farmasi/laporan/rekap-pendapatan-dokter-resep-per-apotik",
            permission: {
              module: "Farmasi",
              submodule: "Riwayat Transaksi",
              feature: "Rekap Pendapatan Per Apotik",
              action: "READ",
            },
          },
        ],
      },
    ],
  },
]);

const filteredSidebarBodyList = computed(() =>
  filterSidebarByPermission(sidebarBodyList.value)
);
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar
      sidebarTitle="Farmasi"
      sidebarTitleUrl="/farmasi"
      class="flex-none"
      :sidebar-body-list="filteredSidebarBodyList"
      showStockBtn
    />
    <component
      class="max-h-full overflow-auto grow"
      :is="$route.meta.page || 'div'"
    ></component>
  </div>
</template>
