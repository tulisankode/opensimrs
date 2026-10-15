<script lang="ts" setup>
import { computed, ref, type PropType } from "vue";

const props = defineProps({
  showLabel: {
    type: Boolean,
    default: true,
  },
  label: {
    type: String,
    default: "Label",
  },
  sideLabel: {
    type: String,
    default: "Tidak",
  },
  sideLabelTrue: {
    type: String,
    default: "Iya",
  },
  sideLabelColor: {
    type: String,
    default: "text-grey-300",
  },
  sideLabelColorTrue: {
    type: String,
    default: "text-black",
  },
  leftLabel: {
    type: Boolean,
    default: false,
  },
  bgSwitch: {
    type: String,
    default: "rgb(var(--opensimrs-75))",
  },
  bgSlider: {
    type: String,
    default: "rgb(var(--opensimrs-300))",
  },
  modelValue: {
    type: [Boolean, String, Number] as PropType<any>,
    default: false,
  },
  trueValue: {
    type: [Boolean, String,Number],
    default: true,
  },
  falseValue: {
    type: [Boolean, String, Number],
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  invalid: {
    type: Boolean,
    default: false,
  },
  invalidMessage: {
    type: String,
    default: "",
  },
});

const checked = computed({
  get: () => props.modelValue,
  set: (value: any) => emit("update:modelValue", value),
});
const emit = defineEmits(["update:modelValue", "change"]);
</script>
<template>
  <div class="flex flex-col">
    <label
      v-if="showLabel"
      class="block font-semibold mb-[11px] text-normal"
      :class="{ 'text-grey-300': disabled }"
    >
      {{ label }}
    </label>
    <div class="flex">
      <ToggleSwitch
        v-model="checked"
        :disabled="disabled"
        :trueValue="trueValue"
        :falseValue="falseValue"
        fluid
        :invalid="invalid"
        :class="{ 'order-2': leftLabel }"
        :dt="{
          width: '48px',
          height: '28px',
          handleSize: '20px',
          checkedBackground: bgSwitch,
          handleCheckedBackground: bgSlider,
          checkedHoverBackground: bgSwitch,
          handleCheckedHoverBackground: bgSlider,
        }"
      />
      <div
        v-if="sideLabel"
        class="mt-1 text-SM"
        :class="[
          checked == trueValue ? sideLabelColorTrue : sideLabelColor,
          leftLabel ? 'mr-[10px] order-1' : 'ml-[10px]',
        ]"
      >
        {{ checked == trueValue ? sideLabelTrue : sideLabel }}
      </div>
    </div>
    <small v-if="invalid" class="text-red-500 text-XS">{{ invalidMessage }}</small>
  </div>
</template>
