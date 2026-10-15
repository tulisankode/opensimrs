<script lang="ts" setup>
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import type { MenuItem } from "primevue/menuitem";
import { onMounted, ref, type PropType } from "vue";
import { useForm, useFieldArray, ErrorMessage } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomCheckbox from "@/components/Base/CustomCheckbox.vue";

const props = defineProps({
  pageType: {
    type: String,
    required: true,
  },
  dataBreadCrumb: {
    type: Array as PropType<MenuItem[]>,
    default: () => [],
  },
});
const puasaStatus = ref(false);
const citoStatus = ref(false);

const dataTindakan = ref<any[]>([]);
const hematokrit = ref(false);
const hematologiLengkap = ref(false);
const jumlahLeukosit = ref(false);

const tesFaalHati = ref(false);
const tesGulaDarah = ref(false);
const tesFaalGinjal = ref(false);
const elektrolit = ref(false);
const sgot = ref(true);
const sgpt = ref(true);

const urinLengkap = ref(false);
const glukosaRutin = ref(false);

const mcuWahana = ref(false);

onMounted(() => {
  dataTindakan.value = [];
  console.log(props.pageType);
});

const dateFilter = ref<Date>(new Date());
</script>

<template>
  <CustomAccordion :openWithHeader="false" class="mt-[10px]" initialState="0">
    <template #header>
      <div class="flex justify-between w-full align-middle">
        <div class="flex">
          <span class="leading-10 text-opensimrs-300 text-heading">
            Order Lab
          </span>
        </div>
      </div>
    </template>
    <template #content>
      <div class="pt-5 grid grid-cols-[40%_40%_20%] gap-4">
        <div>
          <CustomDatePicker
            v-model="dateFilter"
            label="Tanggal"
            class="mr-[20px]"
          />
        </div>
        <div>
          <CustomSwitch
            v-model="citoStatus"
            :show-label="true"
            label="CITO"
            sideLabel="Tidak"
            sideLabelTrue="Iya"
            class="w-[150px] mr-[20px]"
          />
        </div>
        <div>
          <CustomSwitch
            v-model="puasaStatus"
            :show-label="true"
            label="Status Puasa"
            sideLabel="Tidak"
            sideLabelTrue="Iya"
            class="w-[150px] mr-3"
          />
        </div>
      </div>
      <div class="flex mt-[30px]">
        <span class="font-bold text-md"> Tarif Pemeriksaan </span>
      </div>
      <hr class="mt-5 mb-[30px]" />
      <div class="mt-4">
        <CustomAccordion
          :openWithHeader="false"
          header-class="bg-opensimrs-50"
          initialState="0"
        >
          <template #header>
            <div class="flex justify-between w-full align-middle text-normal">
              HEMATOLOGI
            </div>
          </template>
          <template #content>
            <div class="flex flex-wrap gap-4 pt-5">
              <CustomCheckbox
                v-model="hematokrit"
                title="Hematokrit"
                subTitle=""
              />
              <CustomCheckbox
                v-model="hematologiLengkap"
                title="Hematologi Lengkap"
                subTitle=""
              />
              <CustomCheckbox
                v-model="jumlahLeukosit"
                title="Jumlah Leukosit"
                subTitle=""
              />
            </div>
          </template>
        </CustomAccordion>

        <CustomAccordion
          :openWithHeader="false"
          header-class="bg-opensimrs-50"
          initialState="0"
        >
          <template #header>
            <div class="flex justify-between w-full align-middle text-normal">
              KIMIA KLINIK
            </div>
          </template>
          <template #content>
            <div class="flex flex-wrap gap-4 pt-5">
              <CustomCheckbox
                v-model="tesFaalHati"
                title="TES FAAL HATI"
                subTitle=""
              />
              <CustomCheckbox
                v-model="tesGulaDarah"
                title="TES GULA DARAH"
                subTitle=""
              />
              <CustomCheckbox
                v-model="tesFaalGinjal"
                title="TES FAAL GINJAL"
                subTitle=""
              />
              <CustomCheckbox
                v-model="elektrolit"
                title="ELEKTROLIT"
                subTitle=""
              />
              <CustomCheckbox v-model="sgot" title="SGOT" subTitle="" />
              <CustomCheckbox v-model="sgpt" title="SGPT" subTitle="" />
            </div>
          </template>
        </CustomAccordion>

        <CustomAccordion
          :openWithHeader="false"
          header-class="bg-opensimrs-50"
          initialState="0"
        >
          <template #header>
            <div class="flex justify-between w-full align-middle text-normal">
              URINALISIS
            </div>
          </template>
          <template #content>
            <div class="flex flex-wrap gap-4 pt-5">
              <CustomCheckbox
                v-model="urinLengkap"
                title="URIN LENGKAP"
                subTitle=""
              />
              <CustomCheckbox
                v-model="glukosaRutin"
                title="GLUKOSA RUTIN"
                subTitle=""
              />
            </div>
          </template>
        </CustomAccordion>

        <div class="flex mt-[50px]">
          <span class="font-bold text-md"> Tarif Pemeriksaan - Paket</span>
        </div>
        <hr class="mt-5 mb-[30px]" />

        <div class="flex flex-wrap gap-4">
          <CustomCheckbox
            v-model="mcuWahana"
            title="MCU PT. WAHANA"
            subTitle="Darah Lengkap, Urine Lengkap, Golongan Darah, SGOT, SGPT"
          />
        </div>
      </div>
    </template>
    <template #collapseIcon>
      <CustomButton
        icon="PhCaretUp"
        backgroundColor="bg-opensimrs-75"
        textColor="text-opensimrs-300"
      />
    </template>
    <template #expandIcon>
      <CustomButton
        icon="PhCaretDown"
        backgroundColor="bg-opensimrs-75"
        textColor="text-opensimrs-300"
      />
    </template>
  </CustomAccordion>
</template>
