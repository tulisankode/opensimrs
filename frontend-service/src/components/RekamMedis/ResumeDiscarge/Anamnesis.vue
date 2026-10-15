<script setup lang="ts">
import { ref, onUpdated, watch, computed } from "vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";

const props = defineProps({
  anamnesisData: {
    type: String,
    default: "-",
  },
});

const anamnesis = computed(() => props.anamnesisData);

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
    <template #header> Ringkasan Riwayat Penyakit / Anamnesis </template>
    <template #content>
      <div class="pt-5">
        <CustomTextfield
          label="Ringkasan Riwayat Penyakit / Anamnesis"
          placeholder="Anamnesis"
          v-model="anamnesis"
          readOnly
        />
      </div>
    </template>
  </CustomAccordion>
</template>
