<script setup lang="ts">
import Sidebar from "@/components/section/Sidebar.vue";
import { useRuanganStore } from "@/stores/datamaster/ruangan";
import { utilsStore } from "@/stores/utils";
import { linkType } from "@/utils/Enum";
import type { SidebarBody } from "@/utils/Interface";
import { onBeforeMount } from "vue";
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useMonitoringKamarStore } from "@/stores/admisi/monitoringKamar";

const route = useRoute();
const router = useRouter();
const monitoringKamarStore = useMonitoringKamarStore();
// Filter state
const filter = ref<{ uuid: string; name: string }>({ uuid: "", name: "" });

// STORE
const ruanganStore = useRuanganStore();
const UseUtilsStore = utilsStore();
const ruanganPayload = ref<any[]>([]);

// Flag to control rendering
const isSidebarReady = ref(false);

// FETCH RUANGAN
const fetchRuangan = async () => {
  // Fetch data ruangan dari API
  UseUtilsStore.setLoading(true);
  try {
    const response = await monitoringKamarStore.getMonitoringKamar({ page: 1, limit: 9999 });
    if (response && response.payload) {
      ruanganPayload.value = response.payload;
      console.log("Ruangan Payload:", ruanganPayload.value);
      updateSidebarBodyList();
    } else {
      ruanganPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    ruanganPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
    isSidebarReady.value = true;
  }
};

// Search Ruangan
let searchTimeout: ReturnType<typeof setTimeout>;

const handleSearchRuangan = (search: string) => {
  clearTimeout(searchTimeout);

  searchTimeout = setTimeout(() => {
    const filteredRuangan = ruanganPayload.value.filter((ruangan) =>
      ruangan.name.toLowerCase().includes(search.toLowerCase())
    );
    const newSidebarItems = [
      {
        name: "Semua Ruangan",
        datas: "",
        icon: "",
        type: linkType.LINK,
        url: "/rawat-inap/ruangan",
      },
      ...filteredRuangan.map((ruangan) => ({
        name: ruangan.name,
        icon: "",
        type: linkType.LINK,
        datas: ruangan.uuid,
        url: "",
      })),
    ];
    if (sidebarBodyList.value[0]?.child?.[0]) {
      sidebarBodyList.value[0].child[0].child = newSidebarItems;
    }
  }, 500);
};

// Sidebar Body List
const updateSidebarBodyList = () => {
  const roomItems = ruanganPayload.value.map((ruangan) => ({
    name: ruangan.name,
    icon: "",
    type: linkType.LINK,
    datas: ruangan.uuid,
    url: "",
  }));
  if (sidebarBodyList.value[0]?.child?.[0]) {
    sidebarBodyList.value[0].child[0].child = [
      {
        name: "Semua Ruangan",
        datas: "",
        icon: "",
        type: linkType.LINK,
        url: "/rawat-inap/ruangan",
      },
      ...roomItems,
    ];
  }
  if (roomItems.length > 0) {
    const defaultFilter = roomItems[0].datas;
    const defaultName = roomItems[0].name;

    filter.value = { uuid: defaultFilter, name: defaultName };

    if (route.path === "/rawat-inap/ruangan") {
      router.replace({
        path: "/rawat-inap/ruangan",
        query: { filter: defaultName },
      });
    }
  }
};

// Update filter value
const updateFilterMenu = (newFilter: { uuid: string; name: string }) => {
  filter.value = { uuid: newFilter.uuid, name: newFilter.name };
  router.replace({
    path: "/rawat-inap/ruangan",
    query: { filter: newFilter.name },
  });
};

const sidebarBodyList = ref<SidebarBody[]>([
  {
    name: "1",
    type: linkType.SECTION,
    child: [
      {
        name: "Ruang Rawatan",
        icon: "MonitoringBedIcon",
        type: linkType.DROPDOWN,
        child: [
          {
            name: "Semua Ruangan",
            datas: "",
            icon: "",
            type: linkType.LINK,
            url: "/rawat-inap/ruangan",
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
        name: "HDU",
        icon: "PhHeartbeat",
        type: linkType.LINK,
        url: "/rawat-inap/hdu",
      },
      {
        name: "Perpindahan Bangsal",
        icon: "HandshakeIcon",
        type: linkType.LINK,
        url: "/rawat-inap/perpindahan-bangsal",
      },
    ],
  },
  {
    name: "3",
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
            url: "/rawat-inap/bpjs/monitoring-kunjungan",
          },
          {
            name: "Monitoring Riwayat Kunjungan",
            type: linkType.LINK,
            url: "/rawat-inap/bpjs/monitoring-riwayat-kunjungan",
          },
          {
            name: "Monitoring Obat Kunjungan",
            type: linkType.LINK,
            url: "/rawat-inap/bpjs/monitoring-obat-kunjungan",
          },
        ],
      },
      {
        name: "Laporan",
        icon: "FileReportIcon",
        type: linkType.DROPDOWN,
        child: [
          {
            name: "Kunjungan Rawat Inap",
            type: linkType.LINK,
            url: "/rawat-inap/laporan/kunjungan-rawat-inap",
          },
          {
            name: "Perpindahan Pasien",
            type: linkType.LINK,
            url: "/rawat-inap/laporan/perpindahan-pasien",
          },
          {
            name: "Pembatalan Dirawat",
            type: linkType.LINK,
            url: "/rawat-inap/laporan/pembatalan-dirawat",
          },
          {
            name: "Rekap Tindakan Pasien",
            type: linkType.LINK,
            url: "/rawat-inap/laporan/rekap-tindakan-pasien",
          },
        ],
      },
    ],
  },
]);

onBeforeMount(() => {
  fetchRuangan();
  if (route.query.filter) {
    filter.value = { uuid: "", name: route.query.filter as string };
  }
});
</script>

<template>
  <div class="flex h-full gap-3">
    <Sidebar
      sidebarTitle="Rawat Inap"
      sidebarTitleUrl="/rawat-inap/ruangan"
      class="flex-none"
      :sidebar-body-list="sidebarBodyList"
      showFilter
      showStockBtn
      v-model:filter="filter"
      @update:search-sidebar="handleSearchRuangan"
      @filterChanged="updateFilterMenu"
    />
    <component
      v-if="isSidebarReady"
      class="max-h-full overflow-auto grow"
      :is="$route.meta.page || 'div'"
      :filterRuangan="filter"
    ></component>
  </div>
</template>
