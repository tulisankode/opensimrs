<script lang="ts" setup>
import type { SelectFilterEvent } from "primevue/select";
import { ref, computed, type PropType, watch, inject } from "vue";
import { compactToolbarKey } from "./toolbarContext";

const compactToolbar = inject(compactToolbarKey, false);

const props = defineProps({
  showLabel: {
    type: Boolean,
    default: true,
  },
  label: {
    type: String,
    default: "Label",
  },
  placeHolder: {
    type: String,
    default: "",
  },
  prependIcon: {
    type: String,
    default: "",
  },
  modelValue: {
    type: [String, Number, Boolean, Object] as PropType<
      string | number | boolean | null
    >,
    default: "",
  },
  options: {
    type: Array,
    default: () => [],
  },
  optionLabel: {
    type: String,
    default: "label",
  },
  optionValue: {
    type: String,
    default: null,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  disabled: {
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
  // kolom yang dicari saat memfilter (bawaan: optionLabel), mis. ["code", "name"]
  filterFields: {
    type: Array as PropType<string[]>,
    default: undefined,
  },
  showFilter: {
    type: Boolean,
    default: true,
  },
  invalidMessage: {
    type: String,
    default: "",
  },
  clearable: {
    type: Boolean,
    default: true,
  },
  customValue: {
    type: Boolean,
    default: false,
  },
  dataKey: {
    type: String as PropType<string | undefined>,
    default: undefined,
  },
});

const selectedData = ref<any>();

watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue) {
      selectedData.value = newValue;
    }
  },
  { immediate: true }
);

// const value = ref(props.modelValue);
const value = computed({
  get: () => props.modelValue as string,
  set: (value: string) => {
    if (props.customValue && props.optionValue) {
      selectedData.value = props.options.find(
        (data: any) => data[props.optionValue] == value
      );
    } else if (props.customValue) {
      selectedData.value = value;
    }
    emit("update:modelValue", value);
  },
});

const emit = defineEmits([
  "update:modelValue",
  "change",
  "clickPrepend",
  "filter",
  "blur",
  "focus",
]);

const showClear = computed(() => {
  return value.value !== "" && props.clearable;
});

const filterData = (event: SelectFilterEvent) => {
  emit("filter", event.value);
};

// const onChange = (event: any) => {
//   console.log(event);

//   if (!event) return;
//   emit("update:modelValue", event.value);
//   emit("change", event.value);
// };
</script>

<template>
  <div :class="{ 'toolbar-field': compactToolbar }" :title="compactToolbar ? label : undefined">
    <label
      v-if="showLabel && !compactToolbar"
      class="block font-semibold mb-[5px] text-normal"
      :class="{ 'text-grey-300': disabled }"
    >
      {{ label }}<span v-if="required" class="text-danger-300">*</span>
    </label>
    <InputGroup>
      <InputGroupAddon
        v-if="prependIcon"
        class="px-3 py-2 rounded-l-lg"
        :class="{
          'text-danger-300 border-danger-300': invalid,
          'border-grey-200': !disabled && !invalid,
          'border-grey-200 bg-grey-100': disabled,
        }"
      >
        <component
          @click="emit('clickPrepend')"
          :is="prependIcon"
          weight="bold"
          :size="22"
          class="cursor-pointer"
          :class="{
            'text-danger-300': invalid,
            'text-grey-300': disabled,
            'text-black': !disabled && !invalid,
          }"
        ></component>
      </InputGroupAddon>
      <Select
        :aria-label="compactToolbar ? label : undefined"
        v-model="value"
        :options="options"
        :optionLabel="optionLabel"
        :optionValue="optionValue"
        :dataKey="dataKey"
        :loading="isLoading"
        :showClear="showClear"
        :placeholder="placeHolder || (compactToolbar ? label : '')"
        :disabled="disabled"
        class="h-10 rounded-lg text-SM"
        :class="[
          prependIcon ? 'border-l-0 rounded-l-none' : '',
          invalid ? 'border-danger-300 text-danger-300' : '',
          disabled ? ' bg-grey-100 text-grey-300' : '',
          !invalid && !disabled ? 'text-white' : '',
        ]"
        :invalid="invalid"
        fluid
        :filter="showFilter"
        :filterFields="filterFields"
        filterPlaceholder="Search"
        pt:pcFilterIconContainer:class="flex items-center"
        pt:pcFilter:root:class="text-black border-grey-200 text-SM"
        :dt="{
          placeholderColor: invalid ? '#e9594c' : '#90969E',
          color: invalid ? '#e9594c' : '#000000',
          borderColor: invalid ? '#000000' : '#D0D5DD',
          focusBorderColor: '#D0D5DD',
          hoverBorderColor: '#D0D5DD',
        }"
        @filter="filterData"
        @blur="emit('blur')"
        @focus="emit('focus')"
        :virtualScrollerOptions="{ itemSize: 38 }"
      >
        <template v-if="$slots.customValue" #value="{ value, placeholder }">
          <slot
            name="customValue"
            :value="value"
            :placeholder="placeholder"
            :selectedData="selectedData"
          />
        </template>
        <template
          v-if="$slots.customOptions"
          #option="{ index, option, selected }"
        >
          <slot
            name="customOptions"
            :index="index"
            :option="option"
            :selected="selected"
          />
        </template>
        <template #dropdownicon>
          <PhCaretDown
            weight="fill"
            class="text-grey-300"
            :class="{
              'text-red-500': invalid,
              'text-black': modelValue,
              'text-grey-300': disabled,
            }"
          />
        </template>
      </Select>
    </InputGroup>
    <small v-if="invalid" class="text-red-500 text-XS">{{
      invalidMessage
    }}</small>
  </div>
</template>
