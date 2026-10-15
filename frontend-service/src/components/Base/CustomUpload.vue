<script setup>
import { onBeforeUnmount, ref } from "vue";
import { usePrimeVue } from "primevue/config";
import { useToast } from "primevue/usetoast";
import CustomButton from "./CustomButton.vue";
import { onMounted } from "vue";

const $primevue = usePrimeVue();
const toast = useToast();

const totalSize = ref(0);
const totalSizePercent = ref(0);
const files = ref([]);
const dragActive = ref(false); // Untuk feedback visual drag

const onRemoveTemplatingFile = (file, removeFileCallback, index) => {
  removeFileCallback(index);
  totalSize.value -= parseInt(formatSize(file.size));
  totalSizePercent.value = totalSize.value / 10;
};

const onClearTemplatingUpload = (clear) => {
  clear();
  totalSize.value = 0;
  totalSizePercent.value = 0;
};

const onSelectedFiles = (event) => {
  files.value = event.files;
  files.value.forEach((file) => {
    totalSize.value += parseInt(formatSize(file.size));
  });
};

const uploadEvent = (callback) => {
  totalSizePercent.value = totalSize.value / 10;
  callback();
};

const onTemplatedUpload = () => {
  toast.add({
    severity: "info",
    summary: "Success",
    detail: "File Uploaded",
    life: 3000,
  });
};

const formatSize = (bytes) => {
  const k = 1024;
  const dm = 3;
  const sizes = $primevue.config.locale.fileSizeTypes;

  if (bytes === 0) {
    return `0 ${sizes[0]}`;
  }

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const formattedSize = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));

  return `${formattedSize} ${sizes[i]}`;
};

// Menangani event drag & drop
const handleDragOver = (event) => {
  event.preventDefault();
  dragActive.value = true;
};

const handleDragLeave = () => {
  dragActive.value = false;
};

const handleDrop = (event) => {
  event.preventDefault();
  dragActive.value = false;
};

const handleFileDrop = (event) => {
  const droppedFiles = Array.from(event.dataTransfer.files);
  files.value = droppedFiles;
  droppedFiles.forEach((file) => {
    totalSize.value += parseInt(formatSize(file.size));
  });
};

onMounted(() => {
  const dropArea = document.querySelector(".file-drop-area");
  dropArea.addEventListener("dragover", handleDragOver);
  dropArea.addEventListener("dragleave", handleDragLeave);
  dropArea.addEventListener("drop", handleDrop);
  dropArea.addEventListener("drop", handleFileDrop);
});

onBeforeUnmount(() => {
  const dropArea = document.querySelector(".file-drop-area");
  dropArea.removeEventListener("dragover", handleDragOver);
  dropArea.removeEventListener("dragleave", handleDragLeave);
  dropArea.removeEventListener("drop", handleDrop);
  dropArea.removeEventListener("drop", handleFileDrop);
});
</script>

<template>
  <FileUpload
    name="demo[]"
    url="/api/upload"
    @upload="onTemplatedUpload($event)"
    :multiple="true"
    accept="image/*"
    @select="onSelectedFiles"
  >
    <template
      #header="{
        chooseCallback,
        uploadCallback,
        clearCallback,
        filesuploadedFiles,
        removeUploadedFileCallback,
        removeFileCallback,
      }"
    >
      <div
        class="flex flex-col items-center justify-center w-full p-6 mt-2 text-center border-2 border-dashed rounded-md file-drop-area"
        :class="{ 'border-solid border-green-500': dragActive }"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
      >
        <div class="flex flex-col gap-2">
          <p class="font-semibold text-black text-SM">Seret file ke sini</p>
          <p class="mb-4 text-gray-500 text-SM">atau</p>
          <CustomButton
            label="Cari File"
            @click="chooseCallback()"
            class="inline-flex items-center px-3 py-2 mb-4 transition text-XSwhite text- rounded-xl bg-opensimrs-300 hover:bg-opensimrs-400"
            :icon="iconButton"
          />
          <p class="text-gray-500 text-SM">File Type.....</p>

          <!-- Jika ada file, tampilkan informasi file -->
          <div v-if="files.length > 0">
            <h5>Pending</h5>
            <div class="flex flex-wrap gap-4">
              <div
                v-for="(file, index) of files"
                :key="file.name + file.type + file.size"
                class="flex flex-col items-center gap-4 p-8 border rounded-border border-surface"
              >
                <div>
                  <img
                    role="presentation"
                    :alt="file.name"
                    :src="file.objectURL"
                    width="100"
                    height="50"
                  />
                </div>
                <span
                  class="overflow-hidden font-semibold text-ellipsis max-w-60 whitespace-nowrap"
                  >{{ file.name }}</span
                >
                <div>{{ formatSize(file.size) }}</div>
                <Badge value="Pending" severity="warn" />
                <Button
                  icon="pi pi-times"
                  @click="
                    onRemoveTemplatingFile(file, removeFileCallback, index)
                  "
                  outlined
                  rounded
                  severity="danger"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </FileUpload>
</template>
