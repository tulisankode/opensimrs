<script setup lang="ts">
import {
  ClassicEditor,
  Bold,
  Essentials,
  Italic,
  Mention,
  Paragraph,
  Undo,
  Alignment,
  Heading,
  FontSize,
  FontBackgroundColor,
  FontColor,
  Link,
  List,
  Table,
  HeadingButtonsUI,
  ParagraphButtonUI,
} from "ckeditor5";
import { computed, ref } from "vue";

import "ckeditor5/ckeditor5.css";
import "ckeditor5-premium-features/ckeditor5-premium-features.css";

const props = defineProps({
  modelValue: {
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
  placeholder: {
    type: String,
    default: "Insert text here ...",
  },
});
const editor = ref(ClassicEditor);
const editorConfig = ref({
  plugins: [
    Bold,
    Essentials,
    Italic,
    Mention,
    Paragraph,
    Undo,
    Alignment,
    Heading,
    FontSize,
    FontBackgroundColor,
    FontColor,
    Link,
    List,
    Table,
    HeadingButtonsUI,
    ParagraphButtonUI,
  ],
  toolbar: [
    "heading",
    "alignment",
    "|",
    "fontBackgroundColor",
    "fontColor",
    "fontSize",
    "bold",
    "italic",
    "link",
    "|",
    "bulletedList",
    "numberedList",
    "|",
    "undo",
    "redo",
    "|",
    "insertTable",
  ],
  table: {
    contentToolbar: ["tableColumn", "tableRow", "mergeTableCells"],
  },
  placeholder: props.placeholder,
});

const emit = defineEmits(["update:modelValue"]);
const value = computed({
  get: () => props.modelValue,
  set: (value: string) => emit("update:modelValue", value),
});
</script>

<template>
  <label
    v-if="showLabel"
    class="block font-semibold mb-[5px] truncate text-normal"
  >
    {{ label }}<span v-if="required" class="text-danger-300">*</span>
  </label>
  <div
    class="max-w-full prose"
    :class="{
      'border border-danger-300': props.invalid,
      'invalid-placeholder': props.invalid,
    }"
  >
    <ckeditor v-model="value" :editor="editor" :config="editorConfig" />
  </div>
  <small v-if="invalid" class="text-danger-300 text-XS">{{
    invalidMessage
  }}</small>
</template>
<style>
.ck .ck-editor__main {
  color: #000000;
  font-size: 12px;
}
.invalid-placeholder .ck.ck-editor__editable > .ck-placeholder::before {
  color: #e9594c;
}
</style>
