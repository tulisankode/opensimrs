<script lang="ts" setup>
import { computed, inject } from "vue";
import { compactToolbarKey } from "./toolbarContext";

const compactToolbar = inject(compactToolbarKey, false);
const props = defineProps({
  label: {
    type: String,
    default: "",
  },
  icon: {
    type: String,
    default: "",
  },
  iconPos: {
    type: String as () => "left" | "right" | "top" | "bottom",
    default: "left",
  },
  iconType: {
    type: String as () => "bold" | "fill",
    default: "bold",
  },
  loading: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  size: {
    type: String as () => "small" | "large",
    default: "large",
  },
  showIcon: {
    type: Boolean,
    default: false,
  },
  outlined: {
    type: Boolean,
    default: false,
  },
  backgroundColor: {
    type: String,
    default: "",
  },
  borderColor: {
    type: String,
    default: "",
  },
  textColor: {
    type: String,
    default: "",
  },
  full: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["click"]);
const commandIcon = computed(() => {
  if (!compactToolbar) return "";
  if (props.label.toLowerCase() === "reset") return "PhFunnelX";
  if (["cari", "tampilkan"].includes(props.label.toLowerCase())) return props.icon || "PhMagnifyingGlass";
  return "";
});
const displayedIcon = computed(() => commandIcon.value || props.icon);
const toolbarLabel = computed(() => props.label || (props.icon === "PhArrowClockwise" ? "Muat ulang" : ""));
</script>

<template>
  <Button
    v-tooltip.bottom="compactToolbar ? toolbarLabel : undefined"
    :aria-label="compactToolbar ? toolbarLabel || undefined : undefined"
    :label="commandIcon ? '' : label"
    :icon="displayedIcon"
    :iconPos="iconPos"
    :loading="loading"
    :disabled="disabled"
    :outlined="outlined"
    class="rounded-[10px] font-semibold"
    :class="[
      compactToolbar && (commandIcon || (!label && icon)) ? 'toolbar-icon' : '',
      backgroundColor ? backgroundColor : 'bg-opensimrs-300',
      textColor ? textColor : 'text-white',
      borderColor ? borderColor : 'border-none',
      outlined ? `bg-transparent border-2` : '',
      size == 'small' ? 'h-6 text-XS' : 'h-10',
      disabled && outlined ? 'border-grey-200 text-grey-200' : '',
      disabled && !outlined ? 'bg-grey-200 text-grey-400 border-none' : '',
    ]"
    :fluid="full"
    @click="(event) => emit('click', event)"
    :pt:label:class="`font-semibold ${size == 'small' ? 'text-XS' : 'text-normal'}`"
  >
    <template #default>
      <slot />
    </template>
    <template #icon="slotProps" v-if="displayedIcon">
      <component
        :is="displayedIcon"
        :weight="iconType"
        :size="size == 'small' ? 14 : 20"
        :class="slotProps.class"
      />
    </template>
  </Button>
</template>
