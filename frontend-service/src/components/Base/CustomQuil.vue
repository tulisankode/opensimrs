<template>
  <div>
    <Editor v-model="value" :style="{ height: '320px' }" ref="editor">
      <template #toolbar>
        <div class="flex gap-2.5">
          <div class="grow flex gap-5">
            <!-- Font Size -->
            <select class="ql-size w-full">
              <option value="false" selected>Normal</option>
              <option value="small">Small</option>
              <option value="large">Large</option>
              <option value="huge">Huge</option>
            </select>
            <!-- Text Alignment -->
            <select class="ql-align">
              <option value=""></option>
              <option value="center"></option>
              <option value="right"></option>
              <option value="justify"></option>
            </select>
          </div>
          <div class="flex gap-2.5">
            <div class="flex gap-5 border-x px-2.5 border-grey-200">
              <!-- Background Color -->
              <select class="ql-background">
                <option value="red"></option>
                <option value="green"></option>
                <option value="blue"></option>
                <option value="orange"></option>
                <option value="violet"></option>
                <option value="#d0d1d2"></option>
                <option selected></option>
              </select>
              <!-- Text Color -->
              <select class="ql-color">
                <option value="red"></option>
                <option value="green"></option>
                <option value="blue"></option>
                <option value="orange"></option>
                <option value="violet"></option>
                <option value="#d0d1d2"></option>
                <option selected></option>
              </select>
              <!-- Text Case -->

              <!-- Bold, Italic, Link -->
              <button class="ql-bold"></button>
              <button class="ql-italic"></button>
              <button class="ql-link"></button>
            </div>
            <div class="flex gap-5">
              <!-- Ordered and Bullet Lists -->
              <button class="ql-list" value="ordered"></button>
              <button class="ql-list" value="bullet"></button>
            </div>
            <div class="flex gap-5 border-l px-2.5 border-grey-200">
              <!-- Undo and Redo -->
              <button @click="undo" v-tooltip.bottom="'Undo'">
                <PhArrowUUpLeft :size="32" />
              </button>
              <button @click="redo" v-tooltip.bottom="'Redo'">
                <PhArrowUUpRight :size="32" />
              </button>
            </div>
          </div>
        </div>
      </template>
    </Editor>
  </div>
</template>

<script lang="ts" setup>
import { ref } from "vue";

const value = ref<string>(""); // Reactive content value
const editor = ref<any>(null); // Reference to editor

// Undo function
const undo = () => {
  if (editor.value) {
    editor.value.quill.history.undo();
  }
};

// Redo function
const redo = () => {
  if (editor.value) {
    editor.value.quill.history.redo();
  }
};
</script>
