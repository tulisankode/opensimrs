<script setup lang="ts">
import { watch, ref } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
const props = defineProps({
  cancleButton: {
    type: Boolean,
    default: false,
  },
  value: {
    type: String,
  },
  showCancelVisit: {
    type: Boolean,
  },
  cancelReason: {
    type: String,
  },
  exportImport: {
    type: Boolean,
    default: false,
  },
});
const emit = defineEmits([
  "toggle-cancel-visit",
  "confirm-cancel",
  "update:valueCancle",
  "export",
  "download",
]);
const valueCancle = ref(props.value);
watch(valueCancle, (newValue) => {
  emit("update:valueCancle", newValue);
});
</script>

<template>
  <div class="flex justify-between">
    <div v-if="cancleButton" class="flex">
      <CustomButton
        v-if="!showCancelVisit"
        @click="$emit('toggle-cancel-visit', true)"
        class="my-auto bg-danger-300"
        label="Batal Kunjungan"
      />
      <CustomButton
        v-if="showCancelVisit"
        @click="$emit('toggle-cancel-visit', false)"
        class="my-auto mr-[10px]"
        label="Batal"
        outlined
        borderColor="border-grey-200"
        textColor="text-grey-300"
      />
      <CustomButton
        v-if="showCancelVisit"
        @click="$emit('confirm-cancel')"
        class="my-auto mr-5 bg-danger-300"
        label="Iya, Batalkan"
        :disabled="!cancelReason"
      />
      <CustomTextfield
        v-if="showCancelVisit"
        :showLabel="false"
        :value="valueCancle"
        @input="valueCancle = $event"
        class="my-auto w-[400px]"
        placeholder="Alasan Batal Kunjungan"
      />
    </div>
    <div v-if="exportImport" class="flex items-center gap-2.5">
      <!-- Show Import Button if enabled via props -->
      <FileUpload
        mode="basic"
        accept=".xls,.xlsx"
        :maxFileSize="1000000"
        label="Import"
        chooseLabel="Import"
        auto
        :pt="{
          pcButton: {
            class: 'font-back', // OR { class: 'w-64' }
          },
        }"
        class="bg-opensimrs-300 rounded-[10px] font-black text-normal h-10 text-white border-opensimrs-300"
        custom-upload
        name="dems[]"
      >
        <template #chooseicon>
          <FileImportIcon />
        </template>
      </FileUpload>

      <CustomButton
        label="Eksport"
        icon="FileImportIcon"
        @click="emit('export')"
      />
      <CustomButton
        label="Download"
        icon="FileImportIcon"
        @click="emit('download')"
      />
    </div>
    <div
      :class="{
        'flex justify-end w-full': !exportImport && !cancleButton,
        '': exportImport || cancleButton,
      }"
    >
      <CustomPaginator :rows="2" :totalRecords="10" />
    </div>
  </div>
</template>
<style scoped>
:deep(.p-button-label) {
  @apply font-semibold;
}
</style>
