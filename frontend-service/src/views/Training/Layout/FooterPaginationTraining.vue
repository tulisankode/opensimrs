<script setup lang="ts">
import { ref } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";

// Footer bersama halaman Training: paginasi data nyata (rows/totalRecords dari pagination backend), mode batal
// massal (pilih baris + alasan) dan tombol impor/ekspor/unduh template (datamaster).
defineProps({
  rows: { type: Number, default: 10 },
  totalRecords: { type: Number, default: 0 },
  rowsPerPageOptions: { type: Array, default: () => [10, 20, 50] },
  cancleButton: { type: Boolean, default: false },
  labelBatal: { type: String, default: "Batal" },
  jumlahDipilih: { type: Number, default: 0 },
  showCancelVisit: { type: Boolean, default: false },
  exportImport: { type: Boolean, default: false },
  bisaImpor: { type: Boolean, default: true },
});
const emit = defineEmits(["toggle-cancel-visit", "confirm-cancel", "export", "download", "import", "page"]);
const alasan = defineModel<string>("cancelReason", { default: "" });

const refUnggah = ref();
const pilihBerkas = (e: { files: File[] }) => {
  if (e.files?.[0]) emit("import", e.files[0]);
  refUnggah.value?.clear?.();
};
</script>

<template>
  <div class="flex justify-between gap-2.5">
    <div v-if="cancleButton" class="flex items-center">
      <CustomButton v-if="!showCancelVisit" class="my-auto bg-danger-300" :label="labelBatal" @click="emit('toggle-cancel-visit', true)" />
      <template v-else>
        <CustomButton
          class="my-auto mr-[10px]"
          label="Kembali"
          outlined
          borderColor="border-grey-200"
          textColor="text-grey-300"
          @click="emit('toggle-cancel-visit', false)"
        />
        <CustomButton
          class="my-auto mr-5 bg-danger-300"
          :label="`Iya, Batalkan${jumlahDipilih ? ` (${jumlahDipilih})` : ''}`"
          :disabled="!alasan?.trim() || !jumlahDipilih"
          @click="emit('confirm-cancel')"
        />
        <CustomTextfield v-model="alasan" :showLabel="false" class="my-auto w-[400px]" placeholder="Alasan pembatalan (wajib)" :maxLength="500" />
      </template>
    </div>
    <div v-if="exportImport" class="flex items-center gap-2.5">
      <FileUpload
        v-if="bisaImpor"
        ref="refUnggah"
        mode="basic"
        accept=".xls,.xlsx"
        :maxFileSize="1000000"
        chooseLabel="Impor"
        auto
        customUpload
        :pt="{ pcButton: { class: 'font-back' } }"
        class="bg-opensimrs-300 rounded-[10px] font-black text-normal h-10 text-white border-opensimrs-300"
        name="kelas[]"
        @select="pilihBerkas"
      >
        <template #chooseicon>
          <FileImportIcon />
        </template>
      </FileUpload>
      <CustomButton label="Ekspor" icon="FileImportIcon" @click="emit('export')" />
      <CustomButton v-if="bisaImpor" label="Template" icon="PhDownload" @click="emit('download')" />
    </div>
    <div :class="{ 'flex justify-end w-full': !exportImport && !cancleButton }">
      <CustomPaginator :rows="rows" :totalRecords="totalRecords" :rowsPerPageOptions="rowsPerPageOptions" @page="emit('page', $event)" />
    </div>
  </div>
</template>
<style scoped>
:deep(.p-button-label) {
  @apply font-semibold;
}
</style>
