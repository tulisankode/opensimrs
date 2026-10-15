<script setup lang="ts">
import { computed, inject } from "vue";
import { filterMenuKey } from "./toolbarContext";

const inFilterMenu = inject(filterMenuKey, false);

const props = defineProps({
  label: {
    type: String,
    default: "",
  },
  value: {
    type: String,
    default: null,
  },
  isSelected: {
    type: Boolean,
    default: false,
  },
  outlined: {
    type: Boolean,
    default: true,
  },
  borderColor: {
    type: String,
    default: "border-grey-300",
  },
  textColor: {
    type: String,
    default: "text-grey-300",
  },
  textSize: {
    type: String,
    default: "text-XS",
  },
  bgColor: {
    type: String,
    default: "bg-transparent",
  },
  selectedColor: {
    type: String,
    default: "bg-grey-300 border-grey-300",
  },
  selectedTextColor: {
    type: String,
    default: "text-white",
  },
  iconSize: {
    type: Number,
    default: 14,
  },
  iconColor: {
    type: String,
    default: "text-grey-300",
  },
  selectedIconColor: {
    type: String,
    default: "text-white",
  },
  showCheckedIcon: {
    type: Boolean,
    default: true,
  },
  customClass: {
    type: String,
    default: "h-6",
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["selected"]);

const onSelectedValue = () => {
  if (props.disabled) return;
  if (props.value) emit("selected", props.value);
  else emit("selected", props.label);
};

const customizedClass = computed(() => props.customClass);
</script>

<template>
  <button
    v-if="inFilterMenu"
    type="button"
    role="checkbox"
    :aria-checked="isSelected"
    :disabled="disabled"
    class="toolbar-filter-option"
    :class="isSelected ? 'text-opensimrs-300' : 'text-grey-400'"
    @click="onSelectedValue"
  >
    <PhCheckSquare v-if="isSelected" :size="18" class="shrink-0" aria-hidden="true" />
    <PhSquare v-else :size="18" class="shrink-0" aria-hidden="true" />
    <span>{{ label }}</span>
  </button>
  <Chip
    v-else
    :class="[
      customizedClass,
      textSize,
      isSelected ? selectedTextColor : textColor,
      isSelected ? selectedColor : borderColor + ' ' + bgColor,
      showCheckedIcon ? 'pr-3' : 'pr-[10px]',
      outlined ? 'border-2 font-semibold' : 'shadow-sm',
    ]"
    @click="onSelectedValue"
    class="pl-[10px] rounded-full cursor-pointer"
  >
    <template v-if="showCheckedIcon">
      <PhCheckCircle
        :size="iconSize"
        :class="[isSelected ? selectedIconColor : iconColor]"
        weight="fill"
      />
    </template>
    <p :label="label">{{ props.label }}</p>
  </Chip>
</template>
