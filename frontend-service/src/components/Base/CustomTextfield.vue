<script setup lang="ts">
import type { PropType } from "vue";
import { computed, ref, inject } from "vue";
import { compactToolbarKey } from "./toolbarContext";

const compactToolbar = inject(compactToolbarKey, false);

const props = defineProps({
  modelValue: {
    type: String as PropType<string | null>,
    default: "",
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
  showLabel: {
    type: Boolean,
    default: true,
  },
  label: {
    type: String,
    default: "Label",
  },
  type: {
    type: String,
    default: "text",
  },
  placeholder: {
    type: String,
    default: "",
  },
  prependIcon: {
    type: String,
    default: "",
  },
  appendIcon: {
    type: String,
    default: "",
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  readOnly: {
    type: Boolean,
    default: false,
  },
  maxLength: {
    type: Number,
    default: 8,
  },
  // Diteruskan ke elemen input (atribut biasa jatuh ke div pembungkus), mis. "new-password" agar browser tidak
  // mengisi otomatis sandi tersimpan.
  autocomplete: {
    type: String,
    default: undefined,
  },
});

// const value = ref(props.modelValue);
const value = computed({
  get: () => props.modelValue,
  set: (value: string | null) => emit("update:modelValue", value),
});

const emit = defineEmits(["update:modelValue", "clickPrepend", "clickAppend"]);
// const onInput = (event: any) => {
//   if (!event) return;
//   emit("update:modelValue", event.target?.value);
// };

</script>
<template>
  <div :class="{ 'toolbar-field': compactToolbar }" :title="compactToolbar ? label : undefined">
    <label
      v-if="showLabel && !compactToolbar"
      class="block font-semibold mb-[5px] truncate text-normal"
      :class="{ 'text-grey-200': disabled }"
    >
      {{ label }}<span v-if="required" class="text-danger-300">*</span>
    </label>
    <div class="flex">
      <div
        v-if="$slots.prependText"
        @click="emit('clickPrepend')"
        class="flex border border-r-0 border-solid rounded-l-lg cursor-pointer text-SM text-grey-300"
        :class="{
          'text-danger-300 border-danger-300': invalid,
          'border-grey-200': !disabled && !invalid && !readOnly,
          'border-opensimrs-300': readOnly,
          'border-grey-200 bg-grey-100': disabled,
        }"
      >
        <slot name="prependText" />
      </div>
      <IconField class="grow">
        <InputIcon v-if="prependIcon" class="-mt-[11px] -ml-[2px]">
          <component
            @click="emit('clickPrepend')"
            :is="prependIcon"
            weight="bold"
            :size="22"
            class="cursor-pointer"
            :class="{
              'text-danger-300': invalid,
              'text-black': !disabled && !invalid,
              'text-grey-300': disabled,
            }"
          ></component>
        </InputIcon>
        <InputText
          :aria-label="compactToolbar ? (showLabel ? label : placeholder) : undefined"
          :type="type"
          :autocomplete="autocomplete"
          v-model="value"
          class="h-10 pt-1 text-black rounded-lg text-SM"
          :class="{
            'border-danger-300 text-danger-300': invalid,
            'border-grey-200 bg-grey-100 text-grey-300': disabled,
            'border-grey-200': !disabled && !invalid && !readOnly,
            'border-opensimrs-300': readOnly,
            'rounded-r-none border-r-0': $slots.appendText,
            'rounded-l-none border-l-0': $slots.prependText,
            'cursor-not-allowed': readOnly,
          }"
          :dt="{
            // placeholderColor: '#90969E',
            placeholderColor: invalid ? '#e9594c' : '#90969E',
          }"
          :disabled="disabled"
          fluid
          :placeholder="placeholder"
          :readonly="readOnly"
        />
        <InputIcon v-if="appendIcon" class="-mt-[11px] -ml-[2px]">
          <component
            @click="emit('clickAppend')"
            :is="appendIcon"
            weight="bold"
            :size="22"
            class="ml-auto cursor-pointer"
            :class="{
              'text-danger-300': invalid,
              'text-black': !disabled && !invalid,
              'text-grey-300': disabled,
            }"
          ></component>
        </InputIcon>
      </IconField>
      <div
        v-if="$slots.appendText"
        @click="emit('clickAppend')"
        class="flex font-bold border border-l-0 border-solid rounded-r-lg cursor-pointer text-SM"
        :class="{
          'text-danger-300 border-danger-300': invalid,
          'border-grey-200': !disabled && !invalid && !readOnly,
          'border-opensimrs-300': readOnly,
          'border-grey-200 bg-grey-100 text-grey-300': disabled,
        }"
      >
        <slot name="appendText" />
      </div>
    </div>
    <small v-if="invalid" class="text-danger-300 text-XS">{{
      invalidMessage
    }}</small>
  </div>
</template>
