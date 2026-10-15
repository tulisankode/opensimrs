<script setup lang="ts">
import { ref, computed, watch, type PropType } from "vue";
import CustomButton from "./CustomButton.vue";

// Definisikan props sebagai array
const props = defineProps({
  modelValue: {
    type: String as PropType<string | undefined | null>,
    default: "",
  },
  allowedFileTypes: {
    type: Array as () => string[],
    default: () => ["image/png"],
  },
  maxFileSize: {
    type: Number,
    default: 2 * 1024 * 1024,
  },
  width: {
    type: String,
    default: "100%", // Nilai default bisa disesuaikan
  },
  height: {
    type: String,
    default: "200px", // Nilai default bisa disesuaikan
  },
  backgroundColor: {
    type: String,
    default: "white",
  },
  iconButton: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["update:modelValue"]);

const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const imageSrc = ref<string | undefined | null>("");

// untuk PDF
const fileName = ref<string | null>(null);
const fileExtension = ref<string | null>(null);
const errorMessage = ref<string | null>(null);

const browseFile = () => {
  if (fileInput.value) {
    fileInput.value.click();
  }
};

const onDragOver = () => {
  isDragging.value = true;
};

const onDragLeave = () => {
  isDragging.value = false;
};

const onDrop = (event: DragEvent) => {
  isDragging.value = false;
  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    handleFiles(files);
  }
};

const onFileChange = (event: Event) => {
  const files = (event.target as HTMLInputElement).files;
  if (files && files.length > 0) {
    handleFiles(files);
  }
};

const isDocument = ref(false);
const handleFiles = (files: FileList) => {
  isDocument.value = false;
  const file = files[0];
  if (file) {
    // Validasi tipe file berdasarkan props array
    if (!props.allowedFileTypes.includes(file.type)) {
      errorMessage.value = "Format File tidak sesuai";
      return;
    }

    // Validasi ukuran file
    if (file.size > props.maxFileSize) {
      errorMessage.value = "Ukuran file terlalu besar. Maksimal 2 MB.";
      return;
    }

    errorMessage.value = null; // Reset error message jika file valid

    if (file.name.endsWith(".pdf")) {
      isDocument.value = true;
    }

    fileName.value = file.name;
    const match = file.name.match(/\.([0-9a-z]+)(?:[\?#]|$)/i);
    fileExtension.value = match ? `.${match[1].toLowerCase()}` : ``;

    const reader = new FileReader();
    reader.onload = (e) => {
      imageSrc.value = e.target?.result as string;
      emit("update:modelValue", imageSrc.value);
    };
    reader.readAsDataURL(file);
  }
};

// Computed property untuk v-model binding dua arah
const value = computed({
  get: () => props.modelValue,
  set: (newValue: string | undefined | null) =>
    emit("update:modelValue", newValue),
});

// Memperbarui imageSrc jika modelValue berubah dari luar
watch(
  () => props.modelValue,
  (newValue) => {
    imageSrc.value = newValue;
  }
);

// KALAU MAU MENGHAPUS FILE YANG SUDAH DIUPLOAD (BUKAN RESET)

const clearFile = () => {
  imageSrc.value = "";
  fileName.value = null;
  fileExtension.value = null;
  emit("update:modelValue", "");
};

defineExpose({
  clearFile,
  fileName,
  fileExtension,
});
</script>

<template>
  <div
    class="flex items-center justify-center p-6 mt-2 text-center border-2 border-dashed rounded-md"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
    :class="{
      'border-opensimrs-200': isDragging,
      backgroundColor: props.backgroundColor,
      width: props.width,
      height: props.height,
    }"
  >
    <div v-if="!imageSrc && !fileName">
      <p class="font-semibold text-black text-SM">Seret file ke sini</p>
      <p class="mb-4 text-gray-500 text-SM">atau</p>
      <CustomButton
        label="Cari File"
        @click="browseFile"
        class="inline-flex items-center px-3 py-2 mb-4 transition text-XSwhite text- rounded-xl bg-opensimrs-300 hover:bg-opensimrs-400"
        :icon="iconButton"
      />
      <p class="text-gray-500 text-SM">
        File {{ allowedFileTypes.join(", ") }}
      </p>
      <input
        type="file"
        ref="fileInput"
        class="hidden"
        @change="onFileChange"
      />
      <!-- Menampilkan error message jika ada -->
      <p v-if="errorMessage" class="mt-4 text-red-500">{{ errorMessage }}</p>
    </div>

    <div v-else-if="isDocument">
      <p @click="clearFile" class="font-semibold text-black text-SM">
        {{ fileName }}
      </p>
    </div>
    <div v-else>
      <img
        @click="clearFile"
        :src="imageSrc as string"
        alt="Uploaded Image"
        class="mx-auto mt-4 rounded-md"
      />
    </div>
  </div>
</template>

<style scoped></style>
