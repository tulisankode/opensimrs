<script setup lang="ts">
import type { MenuItem } from "primevue/menuitem";
import { computed, ref, type PropType } from "vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import IdentitasPasien from "../Section/BookingTerapi/IdentitasPasien.vue";
import JadwalTerpilih from "../Section/BookingTerapi/JadwalTerpilih.vue";

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

const emit = defineEmits(["back", "goToDetail", "goToEdit"]);
</script>

<template>
  <div class="relative w-full h-full overflow-hidden">
    <Card class="h-min mb-[10px] absolute top-0 right-0 left-0">
      <template #content>
        <div class="flex justify-between">
          <div class="flex">
            <CustomBreadCrumb
              :home="{
                label: 'Booking Terapi',
                home: true,
              }"
              :model="dataBreadCrumb"
              class=""
            />
            <PhCaretRight
              :size="25"
              weight="bold"
              class="ml-[10px] mt-[8px] text-grey-400"
            />
            <div class="">
              <p
                class="font-semibold text-heading text-grey-400 ml-[10px] mt-[5px]"
              >
                Data Pasien Booking
              </p>
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
      </template>
    </Card>
    <div class="relative h-full overflow-auto top-[90px] pb-[180px]">
      <JadwalTerpilih
        class="mt-2"
        :dataBreadCrumb="dataBreadCrumb"
        :pageType="pageType"
        :patientData="patientData"
        @back="dataBreadCrumb.pop()"
      />
      <IdentitasPasien
        class="mt-2"
        :dataBreadCrumb="dataBreadCrumb"
        :pageType="pageType"
        :patientData="patientData"
        @back="dataBreadCrumb.pop()"
      />
    </div>

    <Card class="absolute inset-x-0 bottom-0">
      <template #footer>
        <div class="flex justify-end">
          <CustomButton
            label="Reset"
            class="mr-[10px]"
            outlined
            borderColor="border-grey-200"
            textColor="text-grey-300"
          />
          <CustomButton
            label="Simpan Booking"
            class=""
            backgroundColor="bg-opensimrs-300"
          />
        </div>
      </template>
    </Card>
  </div>
</template>
