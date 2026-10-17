<script setup lang="ts">
import type { SidebarBody } from "@/utils/Interface";
import { linkType } from "@/utils/Enum";
import Accordion from "../utils/Accordion.vue";
import { PhMagnifyingGlass, PhStack } from "@phosphor-icons/vue";
import { useRouter, useRoute, routerKey } from "vue-router";
import { computed, onMounted, ref, watch } from "vue";
import dialogStokView from "@/views/Stok/StokView.vue";
import { useStorageLocationStore } from "@/stores/inventory/storageLocation";
import CustomSelect from "../Base/CustomSelect.vue";
import { filterSidebarByPermission } from "@/utils/permissions";
import { modulAktif } from "@/stores/modulFaskes";

const props = defineProps({
  sidebarTitle: {
    type: String,
    required: true,
  },
  sidebarTitleUrl: {
    type: String,
    required: true,
    default: "",
  },
  sidebarBodyList: {
    type: Array<SidebarBody>,
    required: true,
  },
  showFilter: {
    type: Boolean,
    default: false,
  },
  showStockBtn: {
    type: Boolean,
    default: false,
  },
});

// State Management Stock Location
const StorageLocationStore = useStorageLocationStore();
const StorageLocationPayload = ref<any[]>([]);
const selectedLokasiStok = ref("");

// Fetch Stock Location
const fetchStockLocation = async () => {
  try {
    // Panggil API dengan limit tinggi agar semua data lokasi termuat
    const response = await StorageLocationStore.getApi(1,"gudang", 9999);
    if (response && response.payload) {
      StorageLocationPayload.value = response.payload;

      if (StorageLocationPayload.value.length > 0) {
        selectedLokasiStok.value = StorageLocationPayload.value[0].uuid;
        emit("update:searchSidebar", selectedLokasiStok.value);
      }
    } else {
      StorageLocationPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    StorageLocationPayload.value = [];
  }
};

// Untuk Mendeteksi perubahan (buat inventory)
watch(selectedLokasiStok, (newValue) => {
  emit("update:searchSidebar", newValue);
});

const router = useRouter();
const route = useRoute();

const showSidebar = ref(true);
const DialogStokView = ref(false);
const emit = defineEmits(["filterChanged", "update:searchSidebar"]);
const searchSidebar = ref("");
const filteredSidebarBodyList = computed(() =>
  filterSidebarByPermission(props.sidebarBodyList, props.sidebarTitle)
);

watch(searchSidebar, (newValue) => {
  emit("update:searchSidebar", newValue);
});

// Ada tautan aktif di dalam dropdown (dipakai agar dropdown terbuka setelah halaman dimuat ulang).
const anakAktif = (row: SidebarBody): boolean =>
  (row.child ?? []).some((c) => (c.url && route.path === c.url) || anakAktif(c));

// Tautan pertama di dalam dropdown (bisa bertingkat), untuk ikon saat sidebar diciutkan.
const urlPertama = (row: SidebarBody): string =>
  row.url ?? (row.child ?? []).map(urlPertama).find(Boolean) ?? "";

const goToPage = (url: string) => {
  router.push(url);
};

const goToFilteredPage = (filterUuid: string, filterName: string) => {
  // console.log("poliUuid", filterUuid);
  // console.log("poliName", filterName);
  // console.log("route", route.name);

  if (route.name === "rawat-inap-ruangan") {
    router.push({
      path: "/rawat-inap/ruangan",
      query: { filter: filterUuid },
    });
  } else {
    router.push({
      path: "/rawat-jalan/poli",
      query: { filter: filterUuid },
    });
  }
  emit("filterChanged", { uuid: filterUuid, name: filterName });
};

const goToRuanganPage = () => {
  router.push({
    path: "/rawat-inap/ruangan",
  });
};

// Update the filter and navigate to /rawat-jalan

const getSVG = (svg: string) => {
  const imgUrl = new URL(
    `../../assets/icons/sidebar-icon/${svg}.svg`,
    import.meta.url
  ).href;
  return imgUrl;
};

onMounted(() => {
  if (props.sidebarTitle === "Inventory") {
    fetchStockLocation();
  }
});
</script>

<template>
  <div class="flex w-[240px]" :class="{ 'w-[80px]': !showSidebar }">
    <div class="flex flex-col justify-between p-[10px] text-white rounded-xl grow bg-opensimrs-300 overflow-hidden">
      <div class="p-[10px] overflow-auto flex flex-col">
        <!-- Title -->
        <div v-if="showSidebar" class="flex items-start justify-between gap-2 mb-[25px]">
          <div class="font-semibold cursor-pointer text-heading leading-tight" @click="goToPage(sidebarTitleUrl)">
            {{ sidebarTitle }}
          </div>
          <img @click="showSidebar = !showSidebar" src="../../assets/icons/Expand.svg" alt=""
            class="h-[30px] w-auto shrink-0 cursor-pointer" />
        </div>
        <img v-else @click="showSidebar = !showSidebar" src="../../assets/icons/Expand.svg" alt=""
          class="mx-auto cursor-pointer" />

        <!-- body -->
        <div class="overflow-auto">
          <hr v-if="props.sidebarTitle === 'Inventory'" />
          <div v-if="props.sidebarTitle === 'Inventory'">
            <CustomSelect v-model="selectedLokasiStok" place-holder="Pilih Lokasi Stok" :showLabel="false"
              optionLabel="name" optionValue="uuid" :options="StorageLocationPayload" class="mb-[20px] mt-[20px]" />
          </div>
          <div v-for="(section, index) in filteredSidebarBodyList" class="text-SM">
            <hr :class="[index == 0 ? 'mb-[20px]' : 'my-[20px]']" />
            <div v-for="row1 in section.child">
              <div v-if="showSidebar">
                <div v-if="row1.type == linkType.LINK" @click="goToPage(row1.url ?? '')"
                  class="font-bold cursor-pointer my-[15px] flex px-[10px] py-[5px]" :class="{
                    'bg-opensimrs-100 rounded-lg': route.path == row1.url,
                  }">
                  <component v-if="row1.icon" :is="row1.icon" :size="16" class="text-white mr-[10px]" />
                  <div>
                    {{ row1.name }}
                  </div>
                </div>
                <Accordion v-else-if="row1.type == linkType.DROPDOWN" :title="row1.name"
                  :icon="row1.icon ? row1.icon : ''" :terbuka="anakAktif(row1)" class="cursor-pointer">
                  <div class="flex m-[10px]" v-if="
                    (showFilter && row1.name === 'Poli') ||
                    row1.name === 'Ruang Rawatan'
                  ">
                    <PhMagnifyingGlass class="my-auto mr-2" size="20" />
                    <input type="text" class="w-full text-white bg-transparent" :placeholder="row1.name === 'Poli'
                        ? `Cari ${row1.name} ...`
                        : 'Cari Ruangan ...'
                      " v-model="searchSidebar" />
                  </div>

                  <div v-for="row2 in row1.child" class="ml-[10px]">
                    <div v-if="row2.type == linkType.LINK" @click="
                      row1.name === 'Poli' || row1.name === 'Ruang Rawatan'
                        ? goToFilteredPage(row2.datas, row2.name)
                        : goToPage(row2.url ?? '')
                      " class="cursor-pointer mx-[10px] my-[10px] px-[10px] py-[5px]" :class="{
                        'bg-opensimrs-100 rounded-lg':
                          (row1.name === 'Poli' &&
                            (route.query.filter === row2.name ||
                              (!route.query.filter &&
                                row2.name === row2.datas &&
                                route.path === '/rawat-jalan/poli'))) ||
                          (row1.name === 'Ruang Rawatan' &&
                            (route.query.filter === row2.name ||
                              (!route.query.filter &&
                                row2.name === row2.datas &&
                                route.path === '/rawat-inap/ruangan'))) ||
                          (row1.name !== 'Poli' &&
                            row1.name !== 'Ruang Rawatan' &&
                            route.path === row2.url),
                      }">
                      {{ row2.name }}
                    </div>
                    <Accordion v-else-if="row2.type == linkType.DROPDOWN" :title="row2.name" :terbuka="anakAktif(row2)" class="cursor-pointer">
                      <div v-for="row3 in row2.child" class="ml-[10px]">
                        <div v-if="row3.type == linkType.LINK" @click="goToPage(row3.url ?? '')"
                          class="cursor-pointer mx-[10px] my-[8px] px-[10px] py-[5px]"
                          :class="{ 'bg-opensimrs-100 rounded-lg': route.path === row3.url }">
                          {{ row3.name }}
                        </div>
                        <Accordion v-else-if="row3.type == linkType.DROPDOWN" :title="row3.name">
                          <div></div>
                        </Accordion>
                      </div>
                    </Accordion>
                  </div>
                </Accordion>
              </div>
              <div v-else>
                <component v-if="row1.icon" :is="row1.icon" :size="16" class="mx-auto my-5 text-white" @click="
                  row1.type == linkType.DROPDOWN
                    ? goToPage(urlPertama(row1))
                    : goToPage(row1.url ?? '')
                  " />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="showStockBtn && showSidebar && (modulAktif('farmasi') || modulAktif('inventory'))"
        class="flex justify-center flex-none w-full h-10 align-middle bg-white rounded-md cursor-pointer text-opensimrs-300"
        @click="DialogStokView = true">
        <PhStack size="20" weight="bold" class="mr-[10px] my-auto" />
        <div class="my-auto font-semibold">Stok</div>
      </div>
      <dialogStokView v-model:isDialogVisible="DialogStokView" :full-screen="true" />
    </div>
  </div>
</template>

<style scoped>
::placeholder {
  color: white;
  opacity: 1;
  /* Firefox */
}

::-ms-input-placeholder {
  /* Edge 12 -18 */
  color: white;
}
</style>
