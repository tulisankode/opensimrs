<script setup lang="ts">
import { ref, type PropType } from "vue";

const props = defineProps({
  fullScreen: {
    type: Boolean,
    default: false,
  },
  width: {
    type: String,
    default: "",
  },
  position: {
    type: String as PropType<
      | "center"
      | "top"
      | "bottom"
      | "left"
      | "right"
      | "topleft"
      | "topright"
      | "bottomleft"
      | "bottomright"
      | undefined
    >,
    default: "center",
  },
  headerBg: {
    type: String,
    default: "bg-opensimrs-300",
  },
  headerHeight: {
    type: String,
    default: "h-[60px]",
  },
  noScroll: {
    type: Boolean,
    default: false,
  },
  dismissableMask: {
    type: Boolean,
    default: false,
  }
});

const emit = defineEmits(['closeDialog'])

const dialog = ref();

const maximize = () => {
  if (dialog.value.maximized || !props.fullScreen) return;
  dialog.value.maximize();
};
</script>

<template>
  <Dialog
    ref="dialog"
    modal
    class=""
    @show="maximize"
    @hide="emit('closeDialog')"
    :maximizable="fullScreen"
    :position="position"
    :pt:header:class="`rounded-t-[10px] ${headerBg} ${headerHeight}`"
    pt:root:class="border-none"
    pt:pcCloseButton:root:class="hover:bg-transparent focus:outline-none"
    pt:pcMaximizeButton:root:class="hidden"
    :pt:content:class="noScroll ? 'flex flex-col overflow-hidden' : ''"
    :style="fullScreen ? '' : `width: ${width ? width : '400px'}`"
    :dismissableMask="dismissableMask"
  >
    <template #header>
      <div class="w-full font-semibold text-white text-MD">
        <slot name="header" />
      </div>
    </template>
    <template #closeicon class="hover:bg-none">
      <div v-if="$slots.customCloseIcon">
        <slot name="customCloseIcon" />
      </div>
      <PhXCircle v-else :size="32" color="white" weight="fill" />
    </template>
    <template #default>
      <slot name="body" />
    </template>
    <template v-if="$slots.footer" #footer>
      <div class="w-full">
        <hr class="mb-5 -mx-5" />
        <slot name="footer" />
      </div>
    </template>
  </Dialog>
</template>
