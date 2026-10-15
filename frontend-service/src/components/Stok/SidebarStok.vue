<script setup lang="ts">
import type { SidebarBody } from "@/utils/Interface";
import { linkType } from "@/utils/Enum";
import Accordion from "../utils/Accordion.vue";
import { PhMagnifyingGlass, PhStack } from "@phosphor-icons/vue";
import { useRouter, useRoute, routerKey } from "vue-router";
import { ref, watch } from "vue";
import dialogPermintaanBarang from "@/views/Stok/PermintaanBarang.vue";
import dialogStokView from "@/views/Stok/StokView.vue";

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
  selectedKey: {
    type: String,
    default: "",
  },
});

const router = useRouter();
const route = useRoute();

const showSidebar = ref(true);
const DialogStokView = ref(false);
const emit = defineEmits([
  "filterChanged",
  "update:searchSidebar",
  "select-component",
]);
const searchSidebar = ref("");

watch(searchSidebar, (newValue) => {
  emit("update:searchSidebar", newValue);
});

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
</script>

<template>
  <div class="flex w-[240px]" :class="{ 'w-[80px]': !showSidebar }">
    <div
      class="flex flex-col justify-between p-[10px] text-white rounded-xl grow bg-opensimrs-300 overflow-hidden"
    >
      <div class="p-[10px] overflow-auto flex flex-col">
        <!-- Title -->
        <div v-if="showSidebar" class="flex justify-between mb-[25px]">
          <div
            class="font-semibold cursor-pointer text-heading"
            @click="goToPage(sidebarTitleUrl)"
          >
            {{ sidebarTitle }}
          </div>
          <img
            @click="showSidebar = !showSidebar"
            src="../../assets/icons/Expand.svg"
            alt=""
            class="cursor-pointer"
          />
        </div>
        <img
          v-else
          @click="showSidebar = !showSidebar"
          src="../../assets/icons/Expand.svg"
          alt=""
          class="mx-auto cursor-pointer"
        />

        <!-- body -->
        <div class="overflow-auto">
          <div
            v-for="(section, index) in props.sidebarBodyList"
            class="text-SM"
          >
            <hr :class="[index == 0 ? 'mb-[20px]' : 'my-[20px]']" />
            <div v-for="row1 in section.child">
              <div v-if="showSidebar">
                <div
                  v-if="row1.type == linkType.LINK"
                  @click="
                    row1.url
                      ? goToPage(row1.url)
                      : emit('select-component', row1.datas)
                  "
                  class="font-bold cursor-pointer my-[15px] flex px-[10px] py-[5px]"
                  :class="{
                    'bg-opensimrs-100 rounded-lg':
                      route.path == row1.url ||
                      (!row1.url && props.selectedKey === row1.datas),
                  }"
                >
                  <component
                    v-if="row1.icon"
                    :is="row1.icon"
                    :size="16"
                    class="text-white mr-[10px]"
                  />
                  <div>
                    {{ row1.name }}
                  </div>
                </div>
                <Accordion
                  v-else-if="row1.type == linkType.DROPDOWN"
                  :title="row1.name"
                  :icon="row1.icon ? row1.icon : ''"
                  class="cursor-pointer"
                >
                  <div
                    class="flex m-[10px]"
                    v-if="
                      (showFilter && row1.name === 'Poli') ||
                      row1.name === 'Ruang Rawatan'
                    "
                  >
                    <PhMagnifyingGlass class="my-auto mr-2" size="20" />
                    <input
                      type="text"
                      class="w-full text-white bg-transparent"
                      :placeholder="
                        row1.name === 'Poli'
                          ? `Cari ${row1.name} ...`
                          : 'Cari Ruangan ...'
                      "
                      v-model="searchSidebar"
                    />
                  </div>

                  <div v-for="row2 in row1.child" class="ml-[10px]">
                    <div
                      v-if="row2.type == linkType.LINK"
                      @click="
                        row1.name === 'Poli' || row1.name === 'Ruang Rawatan'
                          ? goToFilteredPage(row2.datas, row2.name)
                          : row2.url
                          ? goToPage(row2.url)
                          : emit('select-component', row2.datas)
                      "
                      class="cursor-pointer mx-[10px] my-[10px] px-[10px] py-[5px]"
                      :class="{
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
                            (route.path === row2.url ||
                              (!row2.url && props.selectedKey === row2.datas))),
                      }"
                    >
                      {{ row2.name }}
                    </div>
                    <Accordion
                      v-else-if="row2.type == linkType.DROPDOWN"
                      :title="row2.name"
                      class="cursor-pointer"
                    >
                      <div v-for="row3 in row2.child">
                        <div v-if="row3.type == linkType.LINK">
                          {{ row3.name }}
                        </div>
                        <Accordion
                          v-else-if="row3.type == linkType.DROPDOWN"
                          :title="row3.name"
                        >
                          <div></div>
                        </Accordion>
                      </div>
                    </Accordion>
                  </div>
                </Accordion>
              </div>
              <div v-else>
                <component
                  v-if="row1.icon"
                  :is="row1.icon"
                  :size="16"
                  class="mx-auto my-5 text-white"
                  @click="
                    row1.type == linkType.DROPDOWN
                      ? goToPage(row1.child ? row1.child[0].url ?? '' : '')
                      : goToPage(row1.url ?? '')
                  "
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        v-if="showStockBtn && showSidebar"
        class="flex flex-none justify-center w-full h-10 align-middle bg-white rounded-md cursor-pointer text-opensimrs-300"
        @click="DialogStokView = true"
      >
        <PhStack size="20" weight="bold" class="mr-[10px] my-auto" />
        <div class="my-auto font-semibold">Stok</div>
      </div>
      <dialogStokView
        v-model:isDialogVisible="DialogStokView"
        :full-screen="true"
      />
    </div>
  </div>
</template>

<style scoped>
::placeholder {
  color: white;
  opacity: 1; /* Firefox */
}

::-ms-input-placeholder {
  /* Edge 12 -18 */
  color: white;
}
</style>
