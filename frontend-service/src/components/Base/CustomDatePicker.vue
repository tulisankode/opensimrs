<script lang="ts" setup>
import { computed, ref, type PropType, inject } from "vue";
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
  timeOnly: {
    type: Boolean,
    default: false,
  },
  modelValue: {
    type: Date as PropType<Date | null>,
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
  invalidMessage: {
    type: String,
    default: "",
  },
  minDate: {
    type: Date,
  },
  maxDate: {
    type: Date,
  },
  view: {
    type: String as PropType<"date" | "month" | "year">,
    default: "date",
  },
  dateFormat: {
    type: String,
    default: "dd-mm-yy",
  },
  showTime: {
    type: Boolean,
    default: false,
  },
  hourFormat: {
    type: String as PropType<"12" | "24">,
    default: "24",
  },
  // izinkan mengetik tanggal (mis. tanggal lahir dd-mm-yyyy) selain memilih dari kalender
  manualInput: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:modelValue", "input", "date-select"]);

// const value = ref(props.modelValue);
const value = computed({
  get: () => props.modelValue,
  set: (value: Date | undefined | null) => emit("update:modelValue", value),
});

// const formatDate = (date: Date): string => {
//   const day = date.getDate();
//   const month = date.toLocaleString("default", { month: "short" });
//   const year = date.getFullYear();
//   return `${day}-${month}-${year}`;
// };

// const formatTime = (date: Date): string => {
//   const hours = date.getHours().toString().padStart(2, "0");
//   const minutes = date.getMinutes().toString().padStart(2, "0");
//   return `${hours}:${minutes}`;
// };

// const onInput = (event: any) => {
//   if (!event) return;

//   const date = new Date(event);
//   const formattedValue = props.timeOnly ? formatTime(date) : formatDate(date);

//   emit("update:modelValue", formattedValue);
// };
</script>

<template>
  <div :class="{ 'toolbar-field toolbar-field--date': compactToolbar }" :title="compactToolbar ? (showLabel ? label : 'Tanggal selesai') : undefined">
    <label
      v-if="showLabel && !compactToolbar"
      class="block font-semibold mb-[5px] truncate text-normal"
      :class="{ 'text-grey-300': disabled }"
    >
      {{ label }}<span v-if="required" class="text-danger-300">*</span>
    </label>
    <div class="">
      <IconField class="">
        <InputIcon class="-mt-[11px] -ml-[2px]">
          <component
            :is="timeOnly ? 'PhClock' : 'PhCalendarBlank'"
            weight="bold"
            :size="22"
            :class="{
              'text-danger-300': invalid,
              'text-black': !disabled && !invalid,
              'text-grey-300': disabled,
            }"
          ></component>
        </InputIcon>
        <DatePicker
          :pt:pcInputText:root:aria-label="compactToolbar ? (showLabel ? label : 'Tanggal selesai') : undefined"
          :timeOnly="timeOnly"
          v-model="value as Date"
          :minDate="minDate"
          :maxDate="maxDate"
          :placeholder="placeHolder"
          :disabled="disabled"
          selectionMode="single"
          :dateFormat="dateFormat"
          :view="view"
          :manualInput="manualInput"
          fluid
          :showTime="showTime"
          :hourFormat="hourFormat"
          :pt:pcInputText:root:class="{
            'border-danger-300 text-danger-300': invalid,
            'border-grey-200': !disabled && !invalid,
            'border-grey-200 bg-grey-100 text-grey-300': disabled,
            'w-full h-10 rounded-lg pl-10 text-SM text-black': true,
          }"
          :dt="{
            placeholderColor: invalid ? '#e9594c' : '#90969E',
          }"
        />
      </IconField>
    </div>
    <small v-if="invalid" class="text-red-500 text-XS">{{
      invalidMessage
    }}</small>
  </div>
</template>
