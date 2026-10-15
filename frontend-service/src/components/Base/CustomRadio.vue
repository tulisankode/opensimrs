<script setup lang="ts">
import { computed } from "vue";

const props = defineProps({
  modelValue: {
    type: [String, Boolean],
  },
  sideLabel: {
    type: String,
    default: "",
  },
  value: {
    type: [String, Boolean],
    default: "",
  },
  label: {
    type: String,
    default: "",
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  invalid: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:modelValue"]);
const checked = computed({
  get: () => props.modelValue,
  set: (value: any) => emit("update:modelValue", value),
});

const selectRadio = (value: string | boolean) => {
  checked.value = value;
};
</script>

<template>
  <div>
    <label
      v-if="label"
      class="block font-semibold mb-[5px] text-normal"
      :class="{ 'text-grey-300': disabled }"
      @click="() => {}"
    >
      {{ props.label }}
    </label>
    <div
      @click="selectRadio(value)"
      class="flex px-3 py-2 border rounded-lg cursor-pointer"
      :class="{
        'bg-opensimrs-50': checked === value,
        'text-danger-300 border-danger-300': invalid,
        'border-gray-200': !invalid,
        'text-grey-300': disabled,
        'text-black': !disabled && !invalid,
      }"
    >
      <RadioButton
        v-model="checked"
        :value="value"
        class="mr-[10px]"
        :dt="{
          checkedBackground: '#ffffff',
          iconCheckedColor: 'rgb(var(--opensimrs-300))',
        }"
      />
      <div class="leading-5 text-normal">{{ sideLabel }}</div>
    </div>
  </div>
</template>
