<script setup lang="ts">
import { computed } from "vue";

const props = defineProps({
  modelValue: {
    type: [Boolean, Array] as any,
  },
  value: {
    type: String,
    default: "",
  },
  height: {
    type: String,
    default: "h-[50px]",
  },
  bgSwitch: {
    type: String,
    default: "rgb(var(--opensimrs-300))",
  },
  borderColor: {
    type: String,
    default: "rgb(var(--opensimrs-300))",
  },
  label: {
    type: String,
    default: "",
  },
  title: {
    type: String,
    default: "Aktif",
  },
  titleClass: {
    type: String,
    default: "font-semibold text-SM",
  },
  subTitle: {
    type: String,
    default: "Subtext",
  },
  subTitleClass: {
    type: String,
    default: "text-XS text-opensimrs-300",
  },
  endText: {
    type: String,
    default: "",
  },
  endTextClass: {
    type: String,
    default: "font-semibold text-SM",
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  multiple: {
    type: Boolean,
    default: true,
  },
  binary: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(["update:modelValue"]);
const checked = computed({
  get: () => props.modelValue,
  set: (value: any) => emit("update:modelValue", value),
});

const toggleCheckbox = () => {
  if (!props.disabled) {
    if (props.binary) {
      checked.value = !checked.value;
    } else {
      if (props.multiple) {
        if (checked.value.includes(props.value)) {
          checked.value.splice(checked.value.indexOf(props.value), 1);
        } else {
          checked.value.push(props.value);
        }
      } else {
        if (checked.value.length) {
          checked.value[0] = props.value;
        } else {
          checked.value.push(props.value);
        }
      }
      emit("update:modelValue", checked.value);
    }
  }
};
const test = (data: any) => {
  console.log("data", data);
};
</script>

<template>
  <label
    v-if="label"
    class="block font-semibold mb-[5px] text-normal"
    :class="{ 'text-grey-300': disabled }"
    @click="toggleCheckbox"
  >
    {{ props.label }}
  </label>
  <div
    :class="{
      [props.height]: true,
      'bg-grey-100': disabled,
      'bg-opensimrs-50': binary ? checked : checked.includes(value),
    }"
    class="flex border-[1px] border-grey-200 rounded-lg px-[10px] py-[5px] cursor-pointer"
    @click="toggleCheckbox"
  >
    <Checkbox
      v-if="!disabled"
      v-model="checked"
      :binary="binary"
      :value="value"
      :disabled="disabled"
      class="my-auto ml-[3px]"
      @update:model-value="test"
      @click.stop.prevent="toggleCheckbox"
      :dt="{
        checkedBackground: bgSwitch,
        checkedHoverBackground: bgSwitch,
        borderColor: borderColor,
      }"
    />
    <div class="ml-[10px] flex flex-col justify-center">
      <div :class="[titleClass, { 'text-grey-300': disabled }]">
        {{ title }}
      </div>
      <div :class="[subTitleClass, { 'text-grey-400': disabled }]">
        {{ subTitle }}
      </div>
    </div>
    <div v-if="endText" class="flex ml-auto">
      <span :class="[endTextClass, { 'text-grey-400': disabled }]">
        {{ endText }}
      </span>
    </div>
  </div>
</template>
