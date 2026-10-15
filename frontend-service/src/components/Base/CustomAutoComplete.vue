<script setup lang="ts">
import { ref } from "vue";

const props = defineProps({
  modelValue: {
    default: "",
  },
  label: {
    type: String,
    default: "Label",
  },
  options: {
    type: Array,
    default: () => [],
  },
  optionLabel: {
    type: String,
    default: null,
  },
  forceSelection: {
    type: Boolean,
    default: true,
  },
  multiple: {
    type: Boolean,
    default: false,
  },
});

const value = ref<any>(props.modelValue);
const filteredData = ref();

const emit = defineEmits(["update:modelValue"]);

const onEnter = () => {
  if (!props.forceSelection && !props.multiple) {
    emit("update:modelValue", value.value);
  }
};
const updateModalValue = (data: any) => {
  emit("update:modelValue", data);
};
const removeSelect = (data: any) => {
  if (props.multiple) {
    if (props.optionLabel) {
      value.value = value.value.filter(
        (selected: any) =>
          selected[props.optionLabel] != data[props.optionLabel]
      );
    } else {
      value.value = value.value.filter((selected: any) => selected != data);
    }
  }
  emit("update:modelValue", value.value);
};
const search = (event: any) => {
  setTimeout(() => {
    if (!event.query.trim().length) {
      filteredData.value = [...props.options];
    } else {
      if (props.optionLabel) {
        filteredData.value = props.options.filter((data: any) =>
          data[props.optionLabel]
            .toLowerCase()
            .includes(event.query.toLowerCase())
        );
      } else {
        filteredData.value = props.options.filter((data: any) =>
          data.toLowerCase().includes(event.query.toLowerCase())
        );
      }
    }
  }, 250);
};
</script>

<template>
  <div class="">
    <label v-if="label" class="block font-bold">{{ label }}</label>
    <AutoComplete
      v-model="value"
      class="h-10"
      pt:pcInputText:root:class="w-full rounded-lg border-grey-400"
      pt:inputMultiple:class="rounded-lg border-grey-400"
      :suggestions="filteredData"
      :optionLabel="optionLabel"
      :forceSelection="forceSelection"
      :multiple="multiple"
      fluid
      @update:model-value="updateModalValue"
      @complete="search"
      @keydown.enter="onEnter"
      :dt="{
            placeholderColor: '#90969E',
          }"
    >
      <template #chip="{ value }">
        <Chip
          class="h-6 rounded-[50px] bg-opensimrs-300 px-[10px] text-SM font-bold text-white py-2"
          removable
        >
          {{ optionLabel ? value[optionLabel] : value }}
          <template #removeicon>
            <PhX
              class="cursor-pointer"
              :size="16"
              weight="bold"
              @click="removeSelect(value)"
            />
          </template>
        </Chip>
      </template>
    </AutoComplete>
  </div>
</template>
