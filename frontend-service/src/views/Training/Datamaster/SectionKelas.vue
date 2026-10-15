<script setup lang="tsx">
import { onMounted, ref } from "vue";
import type { MenuItem } from "primevue/menuitem";
import { onBeforeRouteLeave, useRoute } from "vue-router";
import HeaderFilterTraining from "../Layout/HeaderFilterTraining.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import FooterPaginationTraining from "../Layout/FooterPaginationTraining.vue";
import FormKelas from "./FormKelas.vue";

const dataBreadCrumb = ref<MenuItem[]>([]);
const route = useRoute();
const pageType = ref("");
const updatePageType = (path: string) => {
  // resetFilter();
  let tempArrPath = path.split("/");
  pageType.value = tempArrPath[3] ?? "";
  dataBreadCrumb.value = [
    {
      label: pageType.value == "kelas" ? "Kelas" : "",
    },
  ];
};
onBeforeRouteLeave((to, from) => {
  updatePageType(to.path);
});
onMounted(() => {
  updatePageType(route.path);
});
const hasData = ref(false);
const handleSearchExecuted = (status: boolean) => {
  hasData.value = status; // Set hasData menjadi true ketika event searchExecuted diemit
};

const kelasPayload = ref([
  {
    kode: "ZMB",
    nama: "Zumba",
    sesi: ["Sesi 1", "Sesi 2", "Sesi 3"],
    status: true,
  },
  {
    kode: "GYM",
    nama: "Gym",
    sesi: [],
    status: true,
  },
  {
    kode: "PLS",
    nama: "Pilates",
    sesi: [],
    status: true,
  },
]);

// Dialog Management
const isTambahDataDialogVisible = ref(false);
const isDeleteDialogVisible = ref(false);

const dialogConfig = ref<any>({
  method: "add",
  title: "Tambah Data",
  data: null,
});

const openDialog = (method: string, title: string, data: any = null) => {
  dialogConfig.value = { method, title, data };
  isTambahDataDialogVisible.value = true;
};
</script>
<template>
  <Card
    pt:body:class="h-full pt-0 overflow-auto"
    pt:content:class="h-full overflow-auto"
    class=""
  >
    <template #header>
      <HeaderFilterTraining
        page-type="datamaster"
        :dataBreadCrumb="dataBreadCrumb"
        @tambah-data="openDialog('add', 'Tambah Data')"
      />
    </template>
    <template #content>
      <DataTable
        :value="kelasPayload"
        tableStyle="min-width: 50rem"
        stripedRows
        scrollable
        scrollHeight="flex"
        class="text-xs"
      >
        <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
          <template #header>
            <div class="flex items-center">No.</div>
          </template>
          <template #body="slotProps">
            <div class="flex items-center justify-center">
              {{ slotProps.index + 1 }}
            </div>
          </template>
        </Column>
        <Column
          field="kode"
          header="Kode Kelas"
          class="w-2/12"
          headerClass="bg-opensimrs-50"
        ></Column>
        <Column
          field="nama"
          header="Nama Kelas"
          class="w-3/12"
          headerClass="bg-opensimrs-50"
        ></Column>
        <Column header="Sesi" class="w-6/12" headerClass="bg-opensimrs-50">
          <template #body="slotProps">
            <div class="flex flex-wrap gap-2">
              <div
                v-if="slotProps.data.sesi && slotProps.data.sesi.length > 0"
                class="flex flex-wrap w-full h-full gap-1"
              >
                <div v-for="items in slotProps.data.sesi" :key="items">
                  <CustomChip
                    :label="items"
                    :showCheckedIcon="false"
                    border-color="border-none"
                    bg-color="bg-opensimrs-300"
                    customClass="text-xs font-semibold cursor-auto h-5 bg-opensimrs-300 text-white"
                  />
                </div>
              </div>
              <div v-else>-</div>
            </div>
          </template>
        </Column>

        <Column
          field="status"
          headerClass="bg-opensimrs-50 font-semibold text-SM"
        >
          <template #header>
            <div class="w-full text-center">Status</div>
          </template>
          <template #body="slotProps">
            <div class="flex justify-center items-center min-w-[120px]">
              <CustomChip
                :label="slotProps.data.status ? 'AKTIF' : 'NON-AKTIF'"
                :textColor="
                  slotProps.data.status ? 'text-white' : 'text-[#80868d]'
                "
                :bgColor="slotProps.data.status ? 'bg-opensimrs-300' : 'bg-white'"
                :borderColor="
                  slotProps.data.status ? 'border-none' : 'border-[#80868d]'
                "
                :icon-color="slotProps.data.status ? 'white' : '#80868d'"
                customClass="text-xs font-semibold h-5 flex"
              />
            </div>
          </template>
        </Column>
        <Column headerClass="bg-opensimrs-50">
          <template #header="slotProps">
            <div
              class="flex items-center justify-center w-full font-semibold text-SM"
            >
              Action
            </div>
          </template>
          <template #body="slotProps">
            <div class="flex items-center gap-2.5 justify-center">
              <CustomButton
                label=""
                background-color="bg-[#3D84E5] rounded-lg"
                class="h-6 w-[26px] p-0"
                @click="openDialog('edit', 'Edit Data', slotProps.data)"
              >
                <img src="@/assets/icons/edit.svg" alt="" />
              </CustomButton>
              <CustomButton
                label=""
                background-color="bg-danger-300 rounded-lg"
                class="h-6 w-[26px] p-0"
              >
                <img src="@/assets/icons/delete.svg" alt="" />
              </CustomButton>
            </div>
          </template>
        </Column>
      </DataTable>
      <FormKelas
        v-model:isDialogVisible="isTambahDataDialogVisible"
        :title="dialogConfig.title"
        :method="dialogConfig.method"
        :payload="dialogConfig.data"
      />
      
    </template>
    <template #footer>
      <FooterPaginationTraining exportImport />
    </template>
  </Card>
</template>
