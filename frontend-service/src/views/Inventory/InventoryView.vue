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
        name: "Pengadaan Barang",
        type: linkType.DROPDOWN,
        icon: "BoxPlusIcon",
        child: [
          {
            name: "Pembelian Barang Supplier",
            type: linkType.LINK,
            url: "/inventory/pengadaan-barang/pembelian-barang-supplier",
            icon: "",
          },
          {
            name: "Verifikasi Pembelian Barang Supplier",
            type: linkType.LINK,
            url: "/inventory/pengadaan-barang/verifikasi-pembelian-barang-supplier",
            icon: "",
          },
          {
            name: "Retur & Penggantian Barang Supplier",
            type: linkType.LINK,
            url: "/inventory/pengadaan-barang/retur-penggantian-barang-supplier",
            icon: "",
          },
        ],
      },
      {
        name: "Pengeluaran Barang",
        type: linkType.DROPDOWN,
        icon:"BoxUpIcon",
        child: [
          {
            name: "Verifikasi & Pengiriman Unit",
            type: linkType.LINK,
            url: "/inventory/pengeluaran-barang/verifikasi-pengiriman-unit",
          },
          {
            name: "Pengeluaran Unit", type: linkType.LINK, url: "/inventory/pengeluaran-barang/pengeluaran-unit" 
            
          },
        ],
      },
      {
        name: "Penerimaan Barang",
          type: linkType.DROPDOWN,
        icon:"BoxDownIcon",
        child: [
          { name: "Penerimaan Pembelian", type: linkType.LINK, url: "/inventory/penerimaan-barang/penerimaan-pembelian" },
          { name: "Penerimaan Retur Unit", type: linkType.LINK, url: "/inventory/penerimaan-barang/penerimaan-retur-unit" },
        ],
      },
    ],
  },
  {
    name: "2",
    type: linkType.SECTION,
    child: [
      {
        name: "Datamaster",
        type: linkType.DROPDOWN,
        icon: "DatabaseFill",
        child: [
          {
            name: "Supplier",
            type: linkType.LINK,
            url: "/inventory/datamaster/supplier",
            icon: "",
          },
        ],
      },
    ],
  },
  {
    name: "3",
    type: linkType.SECTION,
    child: [
      {
        name: "Riwayat Tarif",
        type: linkType.LINK,
        url: "/inventory/riwayat-tarif",
        icon: "OpenBoxIcon",
      },
      {
        name: "Kartu Stok & Mutasi",
        type: linkType.LINK,
        url: "/inventory/kartustok-mutasi",
        icon: "OpenBoxIcon",
      },
      {
        name: "Stok Opname",
        type: linkType.LINK,
        url: "/inventory/stok-opname",
        icon: "OpenBoxIcon",
      },
      {
        name: "Stok Adjustment",
        type: linkType.LINK,
        url: "/inventory/stok-adjustment",
        icon: "OpenBoxIcon",
      },
    ],
  },
  {
    name: "4",
    type: linkType.SECTION,
    child: [
      {
        name: "Laporan",
            type: linkType.DROPDOWN,
        icon:"FileReportIcon",
        child: [
          { name: "Obat Expired", type: linkType.LINK, url: "/inventory/laporan/obat-expired" },
          { name: "Persediaan", type: linkType.LINK, url: "/inventory/laporan/persediaan" },
        ],
      },
    ],
  },
]);
const filter = ref("");

//  STATE UNTUK MENYIMPAN UUID LOKASI STOK
const selectedLokasiStokUuid = ref("");

// FUNGSI UNTUK MENG-UPDATE STATE
const handleLokasiStokUpdate = (uuid: string) => {
  selectedLokasiStokUuid.value = uuid;
};
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar
      sidebarTitle="Inventory"
      sidebarTitleUrl="/inventory/pengadaan-barang/pembelian-barang-supplier"
      class="flex-none"
      :sidebar-body-list="sidebarBodyList"
      v-model:filter="filter"
      @update:searchSidebar="handleLokasiStokUpdate" />
    <component
      class="max-h-full overflow-auto grow"
      :is="$route.meta.page || 'div'"
      :filter="filter"
      :lokasi-stok-uuid="selectedLokasiStokUuid"
    ></component>
  </div>
</template>
