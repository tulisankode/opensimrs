<script lang="ts" setup>
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";

const props = defineProps({
  rows: {
    type: Number,
    required: true,
  },
  totalRecords: {
    type: Number,
    required: true,
  },
  showExport: {
    type: Boolean,
    default: true, // Default to show export button
  },
  showImport: {
    type: Boolean,
    default: true, // Default to show import button
  },
  showDownload: {
    type: Boolean,
    default: true, // Default to show import button
  },
  noPagination: {
    type: Boolean,
    default: false, // Default to show import button
  },
});

const emit = defineEmits(["page", "export", "import","download"]);

const handlePage = (event: any) => {
  emit("page", event);
};

const onUpload = (event: any) => {
  const uploadedFiles = event.files[0]; // Ambil file yang diunggah
  console.log('Uploaded Files:', uploadedFiles); // Cetak file yang diunggah
  emit('import', uploadedFiles); // Emit event import dengan file yang diunggah
};


const onError = (event: any) => {
    console.error("File upload failed:", event);
};
</script>

<template>
  <div class="flex justify-between py-2.5">
    <div class="flex items-center gap-2.5">
      <!-- Show Import Button if enabled via props -->
      <FileUpload
        v-if="showImport"
        mode="basic"
        accept=".xls,.xlsx"
        label="Import"
        chooseLabel="Import"
        auto
        :pt="{
          pcButton: {
              class: 'font-back', // OR { class: 'w-64' }
          },
        }"
        class="bg-opensimrs-300 rounded-[10px] font-black text-normal h-10 text-white border-opensimrs-300"
        @select="onUpload"
        custom-upload
        name="dems[]"
      >
        <template #chooseicon>
          <FileImportIcon />
        </template>
      </FileUpload>

      <!-- Show Export Button if enabled via props -->
      <CustomButton
        v-if="showExport"
        label="Eksport"
        @click="emit('export')"
        icon="FileImportIcon"
      />
      <CustomButton
        v-if="showDownload"
        label="Download"
        @click="emit('download')"
        icon="DownloadIcon"
      />
    </div>

    <!-- Pagination Component -->
    <CustomPaginator
      :rows="rows"
      :totalRecords="totalRecords"
      @page="handlePage"
      :noPagination="noPagination"
    />
  </div>
</template>
<style scoped>
:deep(.p-button-label){
  @apply font-semibold;
}
</style>