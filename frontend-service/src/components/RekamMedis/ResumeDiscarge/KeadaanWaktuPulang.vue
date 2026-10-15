<script setup lang="ts">
import { ref, type PropType, computed } from "vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";

const props = defineProps({
  tandaVitalPulangData: {
    type: Object as PropType<any>,
    default: () => {},
  },
});

const tandaVital = computed(() => props.tandaVitalPulangData);

const optionsKondisiPasien = ref([
  { label: "Stabil", value: "359746009" },
  { label: "Tidak Stabil", value: "162668006" },
  { label: "Perbaikan", value: "268910001" },
]);

const modelValue = defineModel<string>("modelValue", {
  default: () => "",
});

const accordion = ref<HTMLCanvasElement | null>(null);
const open = () => {
  if (accordion.value) {
    (accordion.value as any).open();
  }
};
const close = () => {
  if (accordion.value) {
    (accordion.value as any).close();
  }
};

const getKondisiPulangNama = (value: string) => {
  const result = optionsKondisiPasien.value.find((data) => data.value == value);
  return result ?? "-";
};

defineExpose({
  open,
  close,
  getKondisiPulangNama,
});
</script>

<template>
  <CustomAccordion
    initial-state="0"
    header-class="bg-opensimrs-50"
    ref="accordion"
  >
    <template #header> Keadaan Waktu Pulang </template>
    <template #content>
      <div class="grid grid-cols-12 gap-5 pt-5">
        <div class="flex flex-col col-span-3">
          <div class="font-semibold text-SM">Tekanan Darah</div>
          <div class="font-normal text-normal">
            {{ tandaVital?.tekananDarahSistole }}/{{
              tandaVital?.tekananDarahDiastole
            }}
            mmHg
          </div>
        </div>
        <div class="flex flex-col col-span-3">
          <div class="font-semibold underline text-SM">Frekuensi Nafas</div>
          <div class="font-normal text-normal">
            {{ tandaVital?.frekuensiNafas }} x/mnt
          </div>
        </div>
        <div class="flex flex-col col-span-3">
          <div class="font-semibold underline text-SM">Frekuensi Nadi</div>
          <div class="font-normal text-normal">
            {{ tandaVital?.frekuensiNadi }} x/mnt
          </div>
        </div>
        <div class="flex flex-col col-span-3">
          <div class="font-semibold text-SM">Suhu</div>
          <div class="font-normal text-normal">{{ tandaVital?.suhu }} °C</div>
        </div>
        <CustomSelect
          v-model="modelValue"
          :options="optionsKondisiPasien"
          option-label="label"
          option-value="value"
          class="col-span-12"
          label="Kondisi Pasien Saat Pulang"
          place-holder="Pilih Kondisi Pasien Saat Pulang"
        />
      </div>
    </template>
  </CustomAccordion>
</template>
