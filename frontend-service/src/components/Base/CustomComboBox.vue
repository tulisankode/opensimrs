<script setup lang="ts">
import { computed, ref, watch, type PropType } from "vue";
import InputText from "primevue/inputtext";

// Props
const props = defineProps({
  modelValue: {
    type: Array as PropType<string[]>,
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
});

const emit = defineEmits(["update:modelValue", "change"]);

const inputText = ref("");

const chips = computed({
  get: () => props.modelValue,
  set: (value: string[]) => emit("update:modelValue", value),
});

const addChip = () => {
  if (inputText.value.trim() && !props.disabled) {
    const newChips = inputText.value
      .split(",")
      .map((chip) => chip.trim())
      .filter((chip) => chip.length > 0);

    chips.value = [...chips.value, ...newChips];
    inputText.value = "";

    emit("change", chips.value);
  }
};

const removeChip = (index: number) => {
  if (!props.disabled) {
    const newChips = chips.value.filter((_, i) => i !== index);
    chips.value = newChips;
    emit("change", newChips);
  }
};

const handleInput = (event: KeyboardEvent) => {
  if (event.key === ",") {
    addChip();
  }
};

</script>

<template>
  <div>
    <div class="flex justify-between">
      <label
        v-if="showLabel"
        class="block font-semibold mb-[5px] text-normal"
        :class="{ 'text-grey-300': disabled }"
      >
        {{ props.label }}<span v-if="required" class="text-danger-300">*</span>
      </label>
      <span
        @click="disabled ? () => {} : (chips = [])"
        class="font-semibold cursor-pointer text-XS"
        :class="[
          chips.length == 0 || disabled ? 'text-grey-400' : 'text-opensimrs-300',
        ]"
      >
        Hapus semua
      </span>
    </div>

    <div class="p-2 border border-gray-300 rounded-lg">
      <div v-if="chips.length > 0" class="flex flex-wrap gap-2 mb-2">
        <Chip
          v-for="(chip, index) in chips"
          :key="index"
          :label="chip"
          class="h-6 rounded-[50px] px-[10px] text-SM font-bold py-2"
          removable
          :class="{
            'bg-grey-300 text-grey-400': disabled,
            'bg-opensimrs-300 text-white': !disabled && !invalid,
          }"
        >
          <template #removeicon>
            <PhX
              class="cursor-pointer"
              :size="16"
              weight="bold"
              @click="removeChip(index)"
            />
          </template>
        </Chip>
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

        <div class="p-inputgroup">
          <InputText
            v-model="inputText"
            @keyup.enter="addChip"
            @keyup="handleInput"
            :placeholder="placeholder"
            :disabled="disabled"
            display="chip"
            class="w-full h-10 text-black rounded-lg text-SM"
            :class="{
              'border-danger-300': invalid,
              'bg-grey-100': disabled,
            }"
            :dt="{
              placeholderColor: invalid ? '#e9594c' : '#90969E',
              color: invalid ? '#e9594c' : '#000000',
              borderColor: invalid ? '#e9594c' : '#D0D5DD',
              focusBorderColor: '#D0D5DD',
              hoverBorderColor: '#D0D5DD',
            }"
          >
          </InputText>
        </div>
      </InputGroup>
    </div>

    <small v-if="invalid" class="text-red-500 text-XS">{{
      invalidMessage
    }}</small>
  </div>
</template>
