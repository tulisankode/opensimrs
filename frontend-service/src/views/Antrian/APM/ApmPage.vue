<script setup lang="ts">
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import HeaderFilter from "../Layout/ApmHeader.vue";
import { onMounted, ref, computed } from "vue";
import { onBeforeRouteLeave, useRoute } from "vue-router";
import type { MenuItem } from "primevue/menuitem";
import { useRouter } from "vue-router";

const router = useRouter();

const goToApmAktif = () => router.push({ name: "antrian-apm-aktif" });
const goToFarmasi = () =>
  router.push({ name: "antrian-apm-aktif-pasien-farmasi" });

// Util: tentukan apakah APM adalah jenis "Antrian Obat"
const isFarmasi = (apm: { ucapan: string[] | string }) => {
  const menus = Array.isArray(apm.ucapan)
    ? apm.ucapan
    : apm.ucapan
    ? [apm.ucapan]
    : [];
  return menus.includes("Antrian Obat");
};

const handleNavigate = (apm: { ucapan: string[] | string }) => {
  if (isFarmasi(apm)) {
    goToFarmasi();
  } else {
    goToApmAktif();
  }
};

const handleAktif = (apm: { ucapan: string[] | string }) => {
  handleNavigate(apm);
};
import NoData from "@/components/section/NoData.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";

const pageType = ref("");
const route = useRoute();

const headerFilterRef = ref<typeof HeaderFilter>();
const resetFilter = () => {
  headerFilterRef.value?.resetFilter();
};

const dataBreadCrumb = ref<MenuItem[]>([]);

const changeSection = (label: string) => {
  if (dataBreadCrumb.value.length) {
    dataBreadCrumb.value[0] = { label: label };
  } else {
    dataBreadCrumb.value.push({ label: label });
  }
};

const updatePageType = (path: string) => {
  resetFilter();
  dataBreadCrumb.value = [];
  let tempArrPath = path.split("/");
  pageType.value = tempArrPath[2] ?? "";
};
onBeforeRouteLeave((to, from) => {
  updatePageType(to.path);
});
onMounted(() => {
  updatePageType(route.path);
});

const itemsAPM = ref([
  {
    noAPM: "1",
    name: "APM 1",
    jumlahMenu: 4,
    ucapan: ["Pasien JKN", "Pasien Non-JKN", "Checkin", "Print"],
    status: "AKTIF",
  },
  {
    noAPM: "2",
    name: "APM 2",
    jumlahMenu: 4,
    ucapan: ["Antrian Obat"],
    status: "AKTIF",
  },
]);

const dialogData = ref({
  isVisible: false,
  method: "add",
  title: "Tambah",
});

// function handleAdd() {
//   dialogData.value = {
//     isVisible: true,
//     method: "add",
//     title: "Tambah",
//   };
// }

function handleEdit() {
  dialogData.value = {
    isVisible: true,
    method: "edit",
    title: "Edit",
  };
}

function handleClose() {
  dialogData.value.isVisible = false;
}

const totalItems = computed(() => itemsAPM.value.length);

const selectedPatient = ref([]);
</script>

<template>
  <Card
    v-if="dataBreadCrumb.length == 0"
    pt:body:class="overflow-auto pt-0 h-full"
    pt:content:class="overflow-auto h-full"
    class=""
  >
    <template #header>
      <HeaderFilter
        ref="headerFilterRef"
        :pageType="pageType"
        @daftar="changeSection('Daftar')"
      />
    </template>
    <template #content>
      <DataTable
        v-if="itemsAPM.length"
        v-model:selection="selectedPatient"
        :value="itemsAPM"
        tableStyle="min-width: 50rem"
        stripedRows
        scrollable
        scrollHeight="flex"
        :pt="{ headerRow: 'text-SM' }"
      >
        <Column field="No." headerClass="bg-opensimrs-50">
          <template #header>
            <div class="w-full font-semibold text-center">No.</div>
          </template>
          <template #body="slotProps">
            <div class="text-center">
              <div class="text-sm">{{ slotProps.data.noAPM }}</div>
            </div>
          </template>
        </Column>
        <Column field="nama-apm" header="Nama APM" headerClass="bg-opensimrs-50">
          <template #body="slotProps">
            <div class="text-SM">{{ slotProps.data.name }}</div>
          </template>
        </Column>
        <Column
          field="jumlah-menu"
          header="Jumlah Menu"
          headerClass="bg-opensimrs-50"
        >
          <template #body="slotProps">
            <div class="text-SM">{{ slotProps.data.jumlahMenu }} Menu</div>
          </template>
        </Column>
        <Column field="flash-text" header="Menu" headerClass="bg-opensimrs-50">
          <template #body="slotProps">
            <div class="flex flex-wrap">
              <div
                v-if="
                  Array.isArray(slotProps.data.ucapan) &&
                  slotProps.data.ucapan.length
                "
              >
                <CustomChip
                  v-for="(konten, index) in slotProps.data.ucapan"
                  :key="index"
                  :showCheckedIcon="false"
                  :label="konten"
                  bgColor="bg-opensimrs-300"
                  textColor="text-white"
                  customClass="h-5  border-none mr-[5px]"
                />
              </div>
              <div v-else-if="slotProps.data.ucapan">
                <CustomChip
                  :showCheckedIcon="false"
                  :label="slotProps.data.ucapan"
                  bgColor="bg-opensimrs-300"
                  textColor="text-white"
                  customClass="h-5  border-none mr-[5px]"
                />
              </div>
            </div>
          </template>
        </Column>
        <Column
          field="Action"
          header="Action"
          headerClass="bg-opensimrs-50 flex items-center justify-center"
        >
          <template #body="slotProps">
            <div class="flex justify-center items-center">
              <div
                class="p-1.5 rounded-lg bg-opensimrs-300"
                @click="handleAktif(slotProps.data)"
              >
                <PhScreencast :size="26" color="#ffffff" weight="fill" />
              </div>
            </div>
          </template>
        </Column>
      </DataTable>

      <NoData v-else />
      <ApmAktifPage
        :full-screen="true"
        v-model:isDialogVisible="dialogData.isVisible"
        :title="dialogData.title"
        :method="dialogData.method"
        @close="handleClose"
      />
    </template>
    <template #footer>
      <div class="flex justify-between px-5 py-2.5">
        <CustomPaginator class="ml-auto" />
      </div>
    </template>
  </Card>
</template>

<style></style>
