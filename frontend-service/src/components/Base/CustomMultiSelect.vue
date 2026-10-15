<script setup lang="ts">
import { computed, type PropType } from "vue";
import { ref, inject } from "vue";
import { compactToolbarKey } from "./toolbarContext";

const compactToolbar = inject(compactToolbarKey, false);

const props = defineProps({
  modelValue: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
  autoResize: {
    type: Boolean,
    default: false,
  },
  required: {
    type: Boolean,
    default: false,
  },
  prependIcon: {
    type: String,
    default: "",
  },
  invalid: {
    type: Boolean,
    default: false,
  },
  invalidMessage: {
    type: String,
    default: "",
  },
  variant: {
    type: String,
    default: "Outlined",
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
  options: {
    type: Array,
    default: () => [],
  },
  optionLabel: {
    type: String,
    default: "Label",
  },
  optionValue: {
    type: String,
    default: null,
  },
  showFilter: {
    type: Boolean,
    default: true,
  },
  maxSelectedLabels: {
    type: Number,
    default: undefined,
  },
  dataKey: {
    type: String as PropType<string | undefined>,
    default: undefined,
  },
});
// const value = ref(props.modelValue);
const value2 = computed({
  get: () => props.modelValue,
  set: (value2: Array<any>) => emit("update:modelValue", value2),
});

const emit = defineEmits(["update:modelValue", "change"]);

const removeSelect = (data: any) => {
  if (props.optionValue || !(data instanceof Object)) {
    value2.value = value2.value.filter((selected: any) => selected != data);
  } else {
    value2.value = value2.value.filter(
      (selected: any) => selected[props.optionLabel] != data[props.optionLabel]
    );
  }
};

const getLabel = (value: any) => {
  const findData: any = props.options.find(
    (data: any) => data?.[`${props.optionValue}`] == value
  );
  return findData ? getObjectValue(props.optionLabel, findData) : "Unknown";
};

const getObjectValue = (key: string, object: any) => {
  const keys = key.split(".");
  let value = object;
  keys.forEach((keyData) => {
    value = value[keyData];
  });
  return value;
};
</script>

<template>
  <div :class="{ 'toolbar-field': compactToolbar }" :title="compactToolbar ? label : undefined">
    <div v-if="!compactToolbar" class="flex justify-between">
      <label
        v-if="showLabel"
        class="block font-semibold mb-[5px] text-normal"
        :class="{ 'text-grey-300': disabled }"
      >
        {{ props.label }}<span v-if="required" class="text-danger-300">*</span>
      </label>
      <span
        @click="disabled ? () => {} : (value2 = [])"
        class="font-semibold cursor-pointer text-XS"
        :class="[
          value2.length == 0 || disabled ? 'text-grey-400' : 'text-opensimrs-300',
        ]"
      >
        Hapus semua
      </span>
    </div>
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
      <MultiSelect
        :aria-label="compactToolbar ? label : undefined"
        v-model="value2"
        :options="options"
        :optionLabel="optionLabel"
        :optionValue="optionValue"
        :dataKey="dataKey"
        fluid
        :filter="showFilter"
        :disabled="disabled"
        :invalid="invalid"
        display="chip"
        :placeholder="compactToolbar ? label : placeholder"
        :maxSelectedLabels="maxSelectedLabels"
        filterPlaceholder="Search"
        pt:pcFilterIconContainer:class="flex items-center"
        pt:pcHeaderCheckbox:root:class="hidden"
        pt:pcFilter:root:class="text-black border-grey-200 text-SM"
        class="h-10 text-black rounded-lg text-SM"
        :class="[
          prependIcon ? 'border-l-0 rounded-l-none' : '',
          invalid ? 'border-danger-300 text-danger-300' : '',
          disabled ? ' bg-grey-100 text-grey-300' : '',
          !invalid && !disabled ? 'text-white' : '',
        ]"
        :dt="{
          placeholderColor: invalid ? '#e9594c' : '#90969E',
          color: invalid ? '#e9594c' : '#000000',
          borderColor: invalid ? '#e9594c' : '#D0D5DD',
          focusBorderColor: '#D0D5DD',
          hoverBorderColor: '#D0D5DD',
        }"
        :virtualScrollerOptions="{ itemSize: 38 }"
      >
        <template
          v-if="
            compactToolbar || (props.maxSelectedLabels
              ? value2.length > props.maxSelectedLabels
              : false)
          "
          #value
        >
          <template v-if="compactToolbar">{{ label }}{{ value2.length ? ` (${value2.length})` : '' }}</template>
          <template v-else>{{ value2.length }} item dipilih</template>
        </template>
        <template #chip="{ value }">
          <Chip
            class="h-6 rounded-[50px] px-[10px] text-SM font-bold py-2"
            removable
            :class="{
              'bg-grey-300 text-grey-400': disabled,
              'bg-opensimrs-300 text-white': !disabled && !invalid,
            }"
          >
            {{
              optionLabel && optionValue
                ? getLabel(value)
                : optionLabel && !optionValue
                ? getObjectValue(optionLabel, value)
                : value
            }}
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
      </MultiSelect>
    </InputGroup>
    <small v-if="invalid" class="text-red-500 text-XS">{{
      invalidMessage
    }}</small>
  </div>
</template>
