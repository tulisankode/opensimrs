<script setup lang="ts">
import { computed,ref } from "vue";

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
  label: {
    type: String,
    default: "",
  },
  title: {
    type: String,
    default: "Aktif",
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:modelValue"]);
const isChecked = computed(() => props.modelValue === props.value);

const toggleRadio = () => {
  if (!props.disabled) {
    emit("update:modelValue", props.value);
  }
};

</script>
<template>
  <div class="flex flex-col">
    <label
    v-if="label"
    class="block font-semibold mb-[5px]"
    :class="{ 'text-grey-300': disabled }"
  >
    {{ props.label }}
  </label>
  <div
    :class="{
      [props.height]: true,
      'bg-grey-100': disabled,
      'bg-opensimrs-50': isChecked ,
    }"
    class="flex border-[2px] border-grey-200 rounded-lg px-[10px] py-[5px] cursor-pointer"
    @click="toggleRadio"
    >
    <RadioButton
      v-model="props.modelValue"
      :value="props.value"
      :disabled="disabled"
      class="my-auto ml-[3px]"
      :pt="{
         box: {
          class: `border-[2px] bg-white ${isChecked ? 'border-opensimrs-300' : 'border-grey-300'}`,
        },
        icon: {
          class: 'bg-opensimrs-300 ',
        },
        hooks: {
          class: 'bg-opensimrs-300',
        },
        
      }"
    />
    <div class="ml-[10px] flex items-center justify-center">
      <div class="font-semibold text-SM truncate" :class="{ 'text-grey-300': disabled }">
        {{ title }}
      </div>
    </div>
  </div>
  </div>
</template>
