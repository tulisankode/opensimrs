<script setup lang="ts">
import type { MenuItem } from "primevue/menuitem";
import { computed, ref, type PropType } from "vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import DataPasien from "../Section/Expertise/DataPasien.vue";
import AsesmenMedis from "../Section/Expertise/AsesmenMedis.vue";
import ListOrder from "../Section/Expertise/ListOrder.vue";
import Catatan from "../Section/Expertise/Catatan.vue";
import CatatanExpertise from "../Section/Expertise/CatatanExpertise.vue";
import { epochToDate, dateToEpoch, formatPrice } from "@/utils/Helpers";
import { useExpertiseLab } from "@/stores/Laboratorium/expertise";
import { utilsStore } from "@/stores/utils";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import { createHasilLabPdf } from "@/utils/pdf/pdfLaboratorium/cetakHasilLab";

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
  openedPatientData: {
    type: Object as PropType<any>,
    required: true,
  },
});

const storeUtils = utilsStore();
const expertiseLabStore = useExpertiseLab();
const listCatatanForm = ref<InstanceType<typeof CatatanExpertise> | null>(null);
const batalDialog = ref(false);

const isAllStatusPeriksaTrue = computed(() => {
  if (!props.openedPatientData?.hasilPemeriksaan?.length) return false;
  return props.openedPatientData.hasilPemeriksaan.every(
    (item: any) => item.statusPeriksa === true
  );
});

const hasCatatanExpertise = computed(() => {
  return props.openedPatientData?.catatanExpertise !== null;
});

const postSimpanHasil = async () => {
  storeUtils.setLoading(true);
  try {
    let tempCatatanData: any;
    tempCatatanData = listCatatanForm.value
      ? await listCatatanForm.value.onSubmit()
      : null;
    let payload: any = {
      ...tempCatatanData,
    };

    console.log("RESULT:", payload);
    const response = await expertiseLabStore.postSelesaiExpertise(
      props.openedPatientData.uuid,
      payload
    );
    if (response && response.data) {
      emit("back");
      emit("fetchExpertiseLab");
    }
  } catch (error) {
    console.error("Save error:", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const batalExpertise = async () => {
  storeUtils.setLoading(true);
  try {
    const patientData = { ...props.openedPatientData };
    const response = await expertiseLabStore.putBatalExpertise(
      props.openedPatientData.uuid,
      patientData
    );
    if (response && response.data) {
      batalDialog.value = false;
      emit("back");
      emit("fetchExpertiseLab");
    }
  } catch (error) {
    console.error("Batal error:", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const emit = defineEmits([
  "back",
  "goToDetail",
  "goToEdit",
  "fetchExpertiseLab",
]);
</script>

<template>
  <div class="relative w-full h-full overflow-hidden">
    <Card class="h-min mb-[10px] absolute top-0 right-0 left-0">
      <template #content>
        <div class="flex justify-between">
          <CustomBreadCrumb
            :home="{
              label: 'Expertise',
              home: true,
            }"
          />
          <div class="flex">
            <div class="flex mr-[30px] mt-2">
              <div class="bg-opensimrs-300 w-[1px] h-[30px]"></div>
              <p class="text-sm ml-[10px] mt-[3px]">Tgl. Order : 3-10-2024</p>
            </div>
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
      <DataPasien
        class="mt-2"
        :dataBreadCrumb="dataBreadCrumb"
        :pageType="pageType"
        :openedPatientData="openedPatientData"
        @back="dataBreadCrumb.pop()"
      />
      <AsesmenMedis
        class=""
        :dataBreadCrumb="dataBreadCrumb"
        :pageType="pageType"
        :openedPatientData="openedPatientData"
        @back="dataBreadCrumb.pop()"
      />

      <ListOrder
        class=""
        :dataBreadCrumb="dataBreadCrumb"
        :pageType="pageType"
        :openedPatientData="openedPatientData"
        @back="dataBreadCrumb.pop()"
      />
      <Catatan
        class=""
        :dataBreadCrumb="dataBreadCrumb"
        :pageType="pageType"
        :openedPatientData="openedPatientData"
        @back="dataBreadCrumb.pop()"
      />
      <CatatanExpertise
        ref="listCatatanForm"
        class=""
        :dataBreadCrumb="dataBreadCrumb"
        :pageType="pageType"
        :openedPatientData="openedPatientData"
        @back="dataBreadCrumb.pop()"
      />
    </div>

    <Card class="absolute inset-x-0 bottom-0">
      <template #footer>
        <div class="flex justify-between">
          <CustomButton
            @click="createHasilLabPdf(openedPatientData)"
            icon="PhPrinter"
            label="Print Hasil"
            class="mr-[10px]"
            backgroundColor="bg-opensimrs-300"
          />
          <div>
            <CustomButton
              v-if="!hasCatatanExpertise"
              :disabled="!isAllStatusPeriksaTrue"
              label="Simpan Expertise"
              class=""
              backgroundColor="bg-opensimrs-300"
              @click="postSimpanHasil"
            />
            <CustomButton
              v-if="hasCatatanExpertise"
              background-color="bg-danger-300"
              @click="batalDialog = true"
              class=""
              label="Batal Expertise"
            />
          </div>
        </div>
      </template>
    </Card>
    <CustomDialog
      v-model:visible="batalDialog"
      width="550px"
      headerBg="bg-danger-300"
    >
      <template #header>Batal Expertise</template>
      <template #body>
        <div class="grid grid-cols-1">
          <div class="mt-[10px]">
            <p class="text-sm italic text-danger-300">
              * Apakah Anda yakin ingin membatalkan
              <span class="font-bold">Expertise</span> ini?
            </p>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomButton
            @click="batalDialog = false"
            label="Batal"
            outlined
            class=""
            borderColor="border-grey-200"
            textColor="text-grey-300"
          />
          <CustomButton
            @click="batalExpertise"
            label="Iya, Batalkan"
            backgroundColor="bg-danger-300"
            borderColor="border-danger-300"
            textColor="text-white"
            class="ml-[10px]"
          />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
