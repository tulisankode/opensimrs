<script setup lang="ts">
import type { MenuItem } from "primevue/menuitem";
import { computed, ref, type PropType } from "vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import BookHeaderPage from "../../Layout/BookHeaderPage.vue";

const props = defineProps({
  pageType: {
    type: String,
    required: true,
  },
  dataBreadCrumb: {
    type: Array as PropType<MenuItem[]>,
    default: () => [],
  },
  formType: {
    type: String,
    default: "",
  },
  isDetail: {
    type: Boolean,
    required: false,
  },
  patientData: {
    type: Object as PropType<any>,
    required: true,
  },
});

const startDateFilter = ref<Date>(new Date());
const dataBedruangan = ref([
  { bed: "Bed 1", patientName: "Nama Lengkap Pasien ", status: "Book" },
  { bed: "Bed 2", patientName: "Nama Lengkap Pasien ", status: "Book" },
  { bed: "Bed 3", patientName: "Nama Lengkap Pasien ", status: "Booked" },
  { bed: "Bed 4", patientName: "Nama Lengkap Pasien ", status: "Book" },
  { bed: "Bed 5", patientName: "Nama Lengkap Pasien ", status: "Booked" },
]);
const selectedJam = ref<any>();
const itemJam = ref([
  { name: "08.00 - 10.00", code: "J1" },
  { name: "10.00 - 12.00", code: "J2" },
  { name: "13.00 - 15.00", code: "J3" },
]);
const selectedRuangan = ref<any>();
const itemRuangan = ref([
  { name: "Ruangan 1", code: "R1" },
  { name: "Ruangan 2", code: "R2" },
  { name: "Ruangan 3", code: "R3" },
]);

const dataBreadCrumb = ref<MenuItem[]>([]);

const changeSection = (label: string, data: any = null) => {
  let tempData = { label: label };
  if (data) {
    tempData = { ...tempData, ...data };
  }
  if (dataBreadCrumb.value.length) {
    dataBreadCrumb.value[0] = tempData;
  } else {
    dataBreadCrumb.value.push(tempData);
  }
};
const bookTerapi = () => {
  changeSection("Cari Jadwal & Bed");
};
const emit = defineEmits(["back", "goToDetail", "goToEdit"]);
</script>

<template>
  <div class="relative w-full h-full overflow-hidden">
    <Card
      v-if="dataBreadCrumb.length == 0"
      pt:body:class="h-full pt-0 overflow-auto"
      pt:content:class="h-full overflow-hidden"
      class="h-full overflow-hidden"
    >
      <template #header>
        <div class="p-5">
          <div class="flex justify-between">
            <div class="flex">
                <CustomBreadCrumb
                  :home="{
                    label: 'Booking Terapi',
                    home: true,
                  }"
                />
                <PhCaretRight :size="25" weight="bold" class="ml-[10px] mt-[8px] text-opensimrs-300" />
                <div class="">
                  <p class="font-semibold text-heading text-grey-400 ml-[10px] mt-[5px]">Cari Jadwal & Bed</p>
                </div>
              </div>
            <div class="flex">
              <CustomButton
                @click="emit('back')"
                icon="PhCaretLeft"
                label="Kembali"
                outlined
                borderColor="border-opensimrs-300"
                textColor="text-opensimrs-300"
              />
            </div>
          </div>
          <hr class="mt-4 border-grey-200" />
          <div class="pt-3 mb-5">
            <div class="flex">
              <CustomDatePicker
                v-model="startDateFilter"
                label="Tanggal "
                class="mr-5 grow"
              />
              <CustomSelect
                v-model="selectedJam"
                :options="itemJam"
                label="Jam"
                optionLabel="name"
                optionValue="code"
                place-holder="Pilih Waktu"
                class="mr-5 w-[250px]"
              />
              <CustomSelect
                v-model="selectedRuangan"
                :options="itemRuangan"
                label="Ruangan"
                optionLabel="name"
                optionValue="code"
                place-holder="Pilih Ruangan"
                class="mr-5 w-[250px]"
              />
              <CustomButton
                icon="PhMagnifyingGlass"
                label="Cari"
                class="mt-auto ml-5 mr-[10px]"
                borderColor="border-opensimrs-300"
              />
              <CustomButton
                label="Reset"
                outlined
                borderColor="border-opensimrs-300"
                textColor="text-opensimrs-300"
                class="mt-auto"
              />
            </div>
          </div>
        </div>
      </template>
      <template #content>
        <DataTable
          :value="dataBedruangan"
          tableStyle="min-width: 50rem"
          stripedRows
          class="text-xs"
          scrollable
          scrollHeight="flex"
        >
          <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
            <template #header>
              <div class="w-full text-center">No.</div>
            </template>
            <template #body="slotProps">
              <div class="flex items-center justify-center">
                {{ slotProps.index + 1 }}
              </div>
            </template>
          </Column>
          <Column field="bed" header="Bed" headerClass="bg-opensimrs-50" class="">
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.bed }}</div>
            </template>
          </Column>
          <Column
            field="patientName"
            header="Nama Pasien"
            headerClass="bg-opensimrs-50"
          >
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.patientName }}</div>
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
                <CustomButton
                  :label="slotProps.data.status"
                  :outlined="slotProps.data.status === 'Book' ? false : true"
                  :textColor="
                    slotProps.data.status === 'Book'
                      ? 'text-white'
                      : 'text-[#000000]'
                  "
                  :bgColor="
                    slotProps.data.status === 'Book' ? 'bg-opensimrs-300' : ''
                  "
                  :borderColor="
                    slotProps.data.status === 'Book'
                      ? 'border-none'
                      : 'border-none'
                  "
                  :icon-color="
                    slotProps.data.status === 'Book' ? 'white' : '#80868d'
                  "
                  customClass="text-xs font-semibold h-5 flex"
                  :disabled="slotProps.data.status === 'Book' ? false : true"
                  @click="bookTerapi"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
    <BookHeaderPage
      v-else-if="dataBreadCrumb[0].label == 'Cari Jadwal & Bed'"
      :dataBreadCrumb="dataBreadCrumb"
      :pageType="pageType"
      :patientData="patientData"
      @back="dataBreadCrumb.pop()"
    />
  </div>
</template>
