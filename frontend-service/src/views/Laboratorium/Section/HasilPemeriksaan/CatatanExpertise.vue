<script setup lang="ts">
import { computed, ref, type PropType } from "vue";
import type { MenuItem } from "primevue/menuitem";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";

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

const plainCatatanExpertise = computed(() => {
  const html = props.openedPatientData?.catatanExpertise || "";
  const tempEl = document.createElement("div");

  const cleanHtml = html.replace(/<br\s*\/?>/gi, "\n");
  tempEl.innerHTML = cleanHtml;

  return (tempEl.textContent || "")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
});
</script>

<template>
  <CustomAccordion :openWithHeader="false" initial-state="0">
    <template #header>
      <div class="flex justify-between w-full align-middle">
        <div class="flex">
          <p class="leading-10 text-bold text-heading">Catatan Expertise</p>
        </div>
      </div>
    </template>
    <template #content>
      <div class="pt-5">
        {{ plainCatatanExpertise }}
      </div>
    </template>
    <template #collapseIcon>
      <CustomButton
        icon="PhCaretUp"
        backgroundColor="bg-transparent"
        textColor="text-opensimrs-300"
      />
    </template>
    <template #expandIcon>
      <CustomButton
        icon="PhCaretDown"
        backgroundColor="bg-transparent"
        textColor="text-opensimrs-300"
      />
    </template>
  </CustomAccordion>
</template>
