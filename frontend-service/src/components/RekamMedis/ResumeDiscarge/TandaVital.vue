<script lang="ts" setup>
import { ref, computed } from "vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import type { PropType } from "vue";

const props = defineProps({
  tandaVitalData: {
    type: Object as PropType<any>,
    default: () => {},
  },
});

const tandaVital = computed(() => props.tandaVitalData);

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

defineExpose({
  open,
  close,
});
</script>

<template>
  <CustomAccordion
    initial-state="0"
    header-class="bg-opensimrs-50"
    ref="accordion"
  >
    <template #header> Tanda Vital Ketika Masuk </template>
    <template #content>
      <div class="grid grid-cols-4 gap-4 pt-5">
        <div class="flex flex-col">
          <div class="text-sm font-semibold">Tekanan Darah</div>
          <div class="font-normal text-normal">
            {{ tandaVital?.tekananDarahSistole }}/{{
              tandaVital?.tekananDarahDiastole
            }}
            mmHg
          </div>
        </div>
        <div class="flex flex-col">
          <div class="text-sm font-semibold underline">Frekuensi Nafas</div>
          <div class="font-normal text-normal">
            {{ tandaVital?.frekuensiNafas }} x/mnt
          </div>
        </div>
        <div class="flex flex-col">
          <div class="text-sm font-semibold underline">Frekuensi Nadi</div>
          <div class="font-normal text-normal">
            {{ tandaVital?.frekuensiNadi }} x/mnt
          </div>
        </div>
        <div class="flex flex-col">
          <div class="text-sm font-semibold">Suhu</div>
          <div class="font-normal text-normal">{{ tandaVital?.suhu }} °C</div>
        </div>
      </div>
    </template>
  </CustomAccordion>
</template>
