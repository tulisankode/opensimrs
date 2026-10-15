<script setup lang="ts">
import Sidebar from "@/components/section/Sidebar.vue";
import { useLokasiStore } from "@/stores/datamaster/lokasi";
import { utilsStore } from "@/stores/utils";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { computed } from "vue";
import { onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const isSidebarReady = ref(false);
const filterPoliList = ref<any[]>([]);
// State Management
const lokasiStore = useLokasiStore();
const UseUtilsStore = utilsStore();
const lokasiPayload = ref<any[]>([]);
const lokasiProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Fetch data dari API
const fetchLokasiData = async () => {
  UseUtilsStore.setLoading(true);

  lokasiPayload.value = [];
  filterPoliList.value = [];

  try {
    const response = await lokasiStore.getApi(0, 9999);

    if (response && response.payload) {
      lokasiPayload.value = response.payload;

      filterPoliList.value = response.payload
        .filter((lokasi: any) => lokasi.isPoli && lokasi.status)
        .map((lokasi: any) => {
          return {
            name: lokasi.name,
            faskesUuid: lokasi.uuid,
          };
        });

      updateSidebarBodyList();

    } else {
      lokasiPayload.value = [];
      filterPoliList.value = [];
    }
  } catch (error) {
    console.error("Gagal mengambil data lokasi:", error);
    lokasiPayload.value = [];
    filterPoliList.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
    isSidebarReady.value = true;
  }
};

// Sidebar body list structure
const sidebarBodyList = ref<SidebarBody[]>([
  {
    name: "1",
    type: linkType.SECTION,
    child: [
      {
        name: "Poli",
        icon: "PhStethoscope",
        type: linkType.DROPDOWN,
        child: [
          {
            name: "Semua Poli",
            datas: "",
            icon: "",
            type: linkType.LINK,
            url: "/rawat-jalan/poli",
          },
        ],
      },
    ],
  },
  {
    name: "2",
    type: linkType.SECTION,
    child: [
      {
        name: "BPJS",
        icon: "BPJSIcon",
        type: linkType.DROPDOWN,
        child: [
          {
            name: "Monitoring Kunjungan",
            type: linkType.LINK,
            url: "/rawat-jalan/bpjs/monitoring-kunjungan",
          },
          {
            name: "Monitoring Riwayat Kunjungan",
            type: linkType.LINK,
            url: "/rawat-jalan/bpjs/monitoring-riwayat-kunjungan",
          },
          {
            name: "Monitoring Obat Kunjungan",
            type: linkType.LINK,
            url: "/rawat-jalan/bpjs/monitoring-obat-kunjungan",
          },
        ],
      },
      {
        name: "Laporan",
        icon: "FileReportIcon",
        type: linkType.DROPDOWN,
        child: [
          {
            name: "Kunjungan Rawat Jalan",
            type: linkType.LINK,
            url: "/rawat-jalan/laporan/kunjungan-rawat-jalan",
          },
          {
            name: "Pembatalan Poli",
            type: linkType.LINK,
            url: "/rawat-jalan/laporan/pembatalan-poli",
          },
          {
            name: "Rekap Tindakan Pasien",
            type: linkType.LINK,
            url: "/rawat-jalan/laporan/rekap-tindakan-pasien",
          },
        ],
      },
    ],
  },
]);

// Filter state
const filter = ref<{ uuid: string; name: string }>({ uuid: "", name: "" });

// Update sidebar body list dengan data dari API
const updateSidebarBodyList = () => {
  const poliSection = sidebarBodyList.value[0]?.child?.[0]?.child ?? [];
  lokasiPayload.value.forEach((item) => {
    if (item.status && item.isPoli) {
      poliSection.push({
        name: item.name,
        datas: item.uuid,
        icon: "",
        type: linkType.LINK,
        url: "",
      });
    }
  });

  if (poliSection.length > 0) {
    const defaultFilter = poliSection[0].datas;
    const defaultName = poliSection[0].name;

    filter.value = { uuid: defaultFilter, name: defaultName };

    // if (!route.query.filter) {
    //   router.replace({
    //     path: "/rawat-jalan/poli",
    //     query: { filter: defaultName },
    //   });
    // }
    // Mengupdate URL dengan query filter sesuai nilai defaultFilter
    if (route.path === "/rawat-jalan/poli") {
      router.replace({
        path: "/rawat-jalan/poli",
        query: { filter: defaultName },
      });
    }
  }
};

// Update filter value
const updateFilterMenu = (newFilter: { uuid: string; name: string }) => {
  filter.value = { uuid: newFilter.uuid, name: newFilter.name };
  router.replace({
    path: "/rawat-jalan/poli",
    query: { filter: newFilter.name },
  });
};

// Search Poli
let searchTimeout: ReturnType<typeof setTimeout>;

const handleSearchPoli = (searchTerm: string) => {
  clearTimeout(searchTimeout);

  searchTimeout = setTimeout(() => {
    const poliSection = sidebarBodyList.value[0]?.child?.[0]?.child;
    if (!poliSection) return;
    poliSection.length = 0;
    poliSection.push({
      name: "Semua Poli",
      datas: "",
      icon: "",
      type: linkType.LINK,
      url: "/rawat-jalan/poli",
    });
    const filteredPoli = lokasiPayload.value
      .filter(
        (item) =>
          item.status &&
          item.isPoli &&
          item.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .map((item) => ({
        name: item.name,
        datas: item.uuid,
        icon: "",
        type: linkType.LINK,
        url: "",
      }));
    poliSection.push(...filteredPoli);

  }, 300);
};


onMounted(() => {
  fetchLokasiData();

  if (route.query.filter) {
    filter.value = { uuid: "", name: route.query.filter as string };
  }
});
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar
      sidebarTitle="Rawat Jalan"
      sidebarTitleUrl="/rawat-jalan/poli"
      class="flex-none"
      :sidebar-body-list="sidebarBodyList"
      showFilter
      showStockBtn
      v-model:filter="filter"
      @filter-changed="updateFilterMenu"
      @update:search-sidebar="handleSearchPoli"
    />
    <component
      v-if="isSidebarReady"
      class="max-h-full overflow-auto grow"
      :is="$route.meta.page || 'div'"
      :filter="filter"
    ></component>
  </div>
</template>
