<script setup lang="ts">
import Sidebar from "@/components/section/Sidebar.vue";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { computed, ref } from "vue";
import { fiturAktif } from "@/stores/modulFaskes";

const sidebarBodyList = ref<SidebarBody[]>([
  {
    name: "1",
    type: linkType.SECTION,
    child: [
      {
        name: "Order Lab",
        icon: "flask-fill",
        type: linkType.LINK,
        url: "/laboratorium/order-lab",
      },
      {
        name: "Hasil Pemeriksaan",
        icon: "flask-fill",
        type: linkType.LINK,
        url: "/laboratorium/hasil-pemeriksaan",
      },
      {
        name: "Expertise",
        icon: "flask-fill",
        type: linkType.LINK,
        url: "/laboratorium/expertise",
      },
    ],
  },
  {
    name: "2",
    type: linkType.SECTION,
    child: [
      {
        name: "Datamaster",
        icon: "database-fill",
        type: linkType.DROPDOWN,
        child: [
          {
            name: "Kategori Pemeriksaan",
            icon: "",
            type: linkType.LINK,
            url: "/laboratorium/datamaster/kategori-pemeriksaan",
          },
          {
            name: "Kelompok Pemeriksaan",
            icon: "",
            type: linkType.LINK,
            url: "/laboratorium/datamaster/kelompok-pemeriksaan",
          },
          {
            name: "Item Pemeriksaan",
            icon: "",
            type: linkType.LINK,
            url: "/laboratorium/datamaster/item-pemeriksaan",
          },
          {
            name: "Spesimen",
            icon: "",
            type: linkType.LINK,
            url: "/laboratorium/datamaster/spesimen",
          },
          {
            name: "Tarif Lab",
            icon: "",
            type: linkType.LINK,
            url: "/laboratorium/datamaster/tarif-lab",
          },
        ],
      },
    ],
  },
  {
    name: "mapping-lis",
    type: linkType.SECTION,
    child: [
      {
        name: "Mapping LIS",
        icon: "PhArrowsLeftRight",
        type: linkType.DROPDOWN,
        child: [
          {
            name: "Tindakan (Registrasi)",
            icon: "",
            type: linkType.LINK,
            url: "/laboratorium/mapping/tindakan-lis",
          },
          {
            name: "Unit, Dokter & Penjamin",
            icon: "",
            type: linkType.LINK,
            url: "/laboratorium/mapping/referensi-lis",
          },
          {
            name: "Hasil Pemeriksaan",
            icon: "",
            type: linkType.LINK,
            url: "/laboratorium/mapping/hasil-lis",
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
        name: "Laporan",
        icon: "file-text-fill",
        type: linkType.DROPDOWN,
        child: [
          {
            name: "Kunjungan",
            icon: "",
            type: linkType.LINK,
            url: "/laboratorium/laporan/kunjungan",
          },
          {
            name: "Waktu Tunggu (TAT)",
            icon: "",
            type: linkType.LINK,
            url: "/laboratorium/laporan/waktu-tunggu",
          },
          {
            name: "Rekap Jumlah Pemeriksaan",
            icon: "",
            type: linkType.LINK,
            url: "/laboratorium/laporan/rekap-jumlah",
          },
        ],
      },
    ],
  },
]);
// Mapping LIS hanya untuk faskes yang mengaktifkan fitur Bridging LIS (Manajemen Modul).
const sidebarTampil = computed(() =>
  sidebarBodyList.value.filter((s) => s.name !== "mapping-lis" || fiturAktif("lab_bridging_lis"))
);
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar
      sidebarTitle="Laboratorium"
      sidebarTitleUrl="/laboratorium"
      class="flex-none"
      :sidebar-body-list="sidebarTampil"
      showStockBtn
    />
    <component
      class="max-h-full overflow-auto grow"
      :is="$route.meta.page || 'div'"
    ></component>
  </div>
</template>
