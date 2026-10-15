<script setup lang="ts">
import { computed, ref, type PropType } from "vue";
import Textarea from "primevue/textarea";

const props = defineProps({
  modelValue: {
    type: String as PropType<string | null>,
    default: "",
  },
  autoResize: {
    type: Boolean,
    default: false,
  },
  required: {
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
  height: {
    type: String,
    default: "h-20",
  },
  showLabel: {
    type: Boolean,
    default: true,
  },
  label: {
    type: String,
    default: "Label",
  },
  placeholder: {
    type: String,
    default: "Text",
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:modelValue"]);

const value = computed({
  get: () => props.modelValue,
  set: (value: string | null) => emit("update:modelValue", value),
});
</script>

<template>
  <div class="flex flex-col">
    <label
      v-if="props.showLabel"
      class="block font-semibold mb-[5px] text-normal"
      :class="{ 'text-grey-300': props.disabled }"
    >
      {{ props.label
      }}<span v-if="props.required" class="text-danger-300">*</span>
    </label>
    <Textarea
      v-model="value"
      :placeholder="props.placeholder"
      fluid
      :disabled="props.disabled"
      :invalid="props.invalid"
      class="pt-2 pl-3 pb-0 rounded-lg border-[1px] w-full text-SM text-black"
      :class="{
        'border-danger-300 text-danger-300': props.invalid,
        'border-grey-200 bg-grey-100 text-grey-300': props.disabled,
        'border-grey-200': !props.disabled && !props.invalid,
        [props.height]: true,
      }"
      :dt="{
        placeholderColor: invalid ? '#e9594c' : '#90969E',
      }"
    />
    <small v-if="props.invalid" class="mt-1 text-danger-300 text-XS">{{
      props.invalidMessage
    }}</small>
  </div>
</template>
