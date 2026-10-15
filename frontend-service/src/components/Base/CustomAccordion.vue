<script setup lang="ts">
import { ref } from "vue";

const props = defineProps({
  headerClass: {
    type: String,
    default: "",
  },
  initialState: {
    type: String,
    default: "null",
  },
  openWithHeader: {
    type: Boolean,
    default: true,
  },
  noBorder: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["open"]);

const checkOpen = (data: any) => {
  openedData.value = data;
};
const openAccordion = (data: string) => {
  if (!props.openWithHeader) {
    openedData.value = data;
  }
};

const openedData = ref(props.initialState);

const open = () => {
  openedData.value = "0";
};
const close = () => {
  openedData.value = "null";
};

defineExpose({
  open,
  close,
});
</script>

<template>
  <Accordion :value="openedData" @update:value="checkOpen" class="text-black" @tab-open="emit('open')">
    <AccordionPanel
      class="rounded-[10px]"
      :class="{ 'border-none': noBorder }"
      value="0"
    >
      <AccordionHeader
        class="rounded-t-[10px]"
        :class="{
          'rounded-b-[10px]': openedData != '0',
          'border-b-grey-100 border-b-[1px]': openedData == '0',
          'cursor-default': !openWithHeader,
        }"
        :pt:root:class="headerClass"
        :disabled="!openWithHeader"
      >
        <slot name="header" />
      </AccordionHeader>
      <AccordionContent class="" :pt:content:class="`rounded-b-[10px] ${noBorder ? '' : 'border-l border-r'}`">
        <slot name="content" />
        <div
          v-if="$slots.footer"
          class="border-t-[1px] border-grey-200 -mx-[18px] my-5"
        ></div>
        <slot v-if="$slots.footer" name="footer" />
      </AccordionContent>
    </AccordionPanel>
    <template #collapseicon>
      <div @click="openAccordion('null')" class="cursor-pointer">
        <slot v-if="$slots.collapseIcon" name="collapseIcon" />
        <PhCaretUp v-else :size="20" />
      </div>
    </template>
    <template #expandicon>
      <div @click="openAccordion('0')" class="cursor-pointer">
        <slot v-if="$slots.expandIcon" name="expandIcon" />
        <PhCaretDown v-else :size="20" />
      </div>
    </template>
  </Accordion>
</template>
