<script setup lang="ts">
import { ref } from 'vue';
import CustomAccordion from '@/components/Base/CustomAccordion.vue';
import CustomSelect from '@/components/Base/CustomSelect.vue';
import CustomTextfield from '@/components/Base/CustomTextfield.vue';
const optionsPrognosis = ref([
  { label: "Baik", value: "170968001" },
  { label: "Dubia et bonam / cenderung baik ", value:"65872000" },
  { label: "Dubia et malam / cenderung tidak baik ", value: "67334001" },
  { label: "Tidak baik", value: "170969009" },
]);
const prognosis=ref()
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
    <CustomAccordion initial-state="0" header-class="bg-opensimrs-50" ref="accordion">
        <template #header>
            Prognosis
        </template>
        <template #content>
            <div class="pt-5">
                <CustomSelect v-model="prognosis" :options="optionsPrognosis" option-label="label" option-value="value" label="Pilih Prognosis" place-holder="Pilih Prognosis"/>
            </div>
        </template>
    </CustomAccordion>
</template>