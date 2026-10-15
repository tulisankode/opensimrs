<script setup lang="ts">
import type { MenuItem } from "primevue/menuitem";
import { computed, ref, type PropType } from "vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import PenjadwalanPatientNameForm from "../Section/PenjadwalanTerapi/PenjadwalanPatientNameForm.vue";
import AsesmenMedisForm from "../Section/PenjadwalanTerapi/AsesmenMedisForm.vue";
import ListOrderForm from "../Section/PenjadwalanTerapi/ListOrderForm.vue";
import JadwalBedTerapiForm from "../Section/PenjadwalanTerapi/JadwalBedTerapiForm.vue";

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
          <CustomBreadCrumb
            :home="{
              label: 'Penjadwalan Terapi',
              home: true,
            }"
          />
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
      <PenjadwalanPatientNameForm
        class="mt-2"
        :dataBreadCrumb="dataBreadCrumb"
        :pageType="pageType"
        :patientData="patientData"
        @back="dataBreadCrumb.pop()"
      />
      <AsesmenMedisForm
        class=""
        :dataBreadCrumb="dataBreadCrumb"
        :pageType="pageType"
        :patientData="patientData"
        @back="dataBreadCrumb.pop()"
      />

      <ListOrderForm
        class=""
        :dataBreadCrumb="dataBreadCrumb"
        :pageType="pageType"
        :patientData="patientData"
        @back="dataBreadCrumb.pop()"
      />

      <JadwalBedTerapiForm
        class=""
        :dataBreadCrumb="dataBreadCrumb"
        :pageType="pageType"
        :patientData="patientData"
        @back="dataBreadCrumb.pop()"
      />
    </div>

    <Card class="absolute inset-x-0 bottom-0">
      <template #footer>
        <div class="flex justify-end">
          <!-- <CustomButton
            label="Reset"
            class="mr-[10px]"
            outlined
            borderColor="border-grey-200"
            textColor="text-grey-300"
          /> -->
          <CustomButton
            label="Simpan & Mulai Terapi"
            class=""
            backgroundColor="bg-opensimrs-300"
          />
        </div>
      </template>
    </Card>
  </div>
</template>
