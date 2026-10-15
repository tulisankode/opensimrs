<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { MenuItem } from "primevue/menuitem";
import { onBeforeRouteLeave, useRoute } from "vue-router";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import HeaderFilterTraining from "../Layout/HeaderFilterTraining.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import DataPasienBooking from "./DataPasienBooking.vue";
import DetailBooking from "./DetailBooking.vue";
const emit = defineEmits(["back"]);
const dataBreadCrumb = ref<MenuItem[]>([]);
const route = useRoute();
const pageType = ref("");
const updatePageType = (path: string) => {
  // resetFilter();
  let tempArrPath = path.split("/");
  pageType.value = tempArrPath[2] ?? "";
  dataBreadCrumb.value = [
    {
      label: pageType.value == "booking-kelas" ? "Cari Jadwal & Kelas" : "",
    },
  ];
};

const changeSection = (label: string, data: any = null) => {
  dataBreadCrumb.value = [{ label }]; // Pastikan ini direset
  if (data) {
    dataPasienBook.value = data; // Simpan data detail
  }
};
onBeforeRouteLeave((to, from) => {
  updatePageType(to.path);
});
onMounted(() => {
  updatePageType(route.path);
});
const bookPayload = ref([
  {
    slot: "Slot 1",
    nama: "Nama Lengkap",
    status: true,
  },
  {
    slot: "Slot 1",
    nama: "Nama Lengkap",
    status: false,
  },
]);
const dataPasienBook = ref();


</script>
<template>
  <Card
    v-if="dataBreadCrumb[0]?.label == 'Cari Jadwal & Kelas'"
    pt:body:class="h-full pt-0 overflow-auto"
    pt:content:class="h-full overflow-auto"
    class=""
  >
    <template #header>
      <HeaderFilterTraining
        :page-type="pageType"
        :dataBreadCrumb="dataBreadCrumb"
        @back="emit('back')"
      />
    </template>
    <template #content>
      <DataTable
        :value="bookPayload"
        tableStyle="min-width: 50rem"
        stripedRows
        class="text-xs"
        scrollable
        scrollHeight="flex"
      >
        <Column headerClass="bg-opensimrs-50">
          <template #header>
            <div class="w-full font-semibold text-center">No.</div>
          </template>
          <template #body="slotProps">
            <div class="flex items-center justify-center">
              {{ slotProps.index + 1 }}
            </div>
          </template>
        </Column>
        <Column field="slot" header="Slot" headerClass="bg-opensimrs-50"></Column>
        <Column
          field="nama"
          header="Nama Pasien"
          class="w-1/2"
          headerClass="bg-opensimrs-50"
        ></Column>
        <Column headerClass="bg-opensimrs-50">
          <template #header>
            <div
              class="flex items-center justify-center w-full font-semibold text-SM"
            >
              Action
            </div>
          </template>
          <template #body="slotProps">
            <div class="flex items-center gap-2.5 justify-center">
              <CustomButton
                :label="slotProps.data.status ? 'BOOK' : 'BOOKED'"
                :background-color="
                  slotProps.data.status ? 'bg-opensimrs-300' : 'bg-transparent'
                "
                :text-color="
                  slotProps.data.status ? 'text-white' : 'text-grey-300'
                "
                size="small"
                class="px-2.5 h-[24px]"
                @click="changeSection('Daftar')"
              />
            </div>
          </template>
        </Column>
      </DataTable>
      
    </template>
  </Card>
  <DataPasienBooking
    v-else-if="dataBreadCrumb[0]?.label == 'Daftar'"
    :dataBreadCrumb="dataBreadCrumb"
    @back="dataBreadCrumb[0].label = 'Cari Jadwal & Kelas'"
  />
</template>
