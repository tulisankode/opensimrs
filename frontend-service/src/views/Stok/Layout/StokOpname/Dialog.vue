<script setup lang="ts">
import { ref } from "vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { PhPaperclip } from "@phosphor-icons/vue";

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits(["update:visible", "save-preview", "reset"]);

const file = ref<File | null>(null);

const onChoose = (e: Event) => {
  const t = e.target as HTMLInputElement;
  file.value = t.files?.[0] || null;
};

const onReset = () => {
  file.value = null;
  emit("reset");
};

const onSave = () => {
  emit("save-preview", file.value);
};
const onFileSelect = (e: any) => {
  file.value = e?.files && e.files[0] ? e.files[0] : null;
};
</script>

<template>
  <CustomDialog
    :visible="props.visible"
    @update:visible="(v:any) => emit('update:visible', v)"
    width="720px"
    headerBg="bg-opensimrs-300"
  >
    <template #header>Import File</template>
    <template #body>
      <div class="py-2 space-y-2">
        <div class="font-semibold">File Stok Opname</div>
        <div class="flex justify-between items-center">
          <FileUpload
            mode="basic"
            name="file"
            class="bg-opensimrs-300"
            accept=".xls,.xlsx"
            @select="onFileSelect"
          />
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex gap-2.5 justify-end">
        <CustomButton
          label="Reset"
          outlined
          borderColor="border-grey-200"
          textColor="text-grey-300"
          @click="onReset"
        />
        <CustomButton
          label="Simpan & Preview"
          class="bg-opensimrs-300"
          :disabled="!file"
          @click="onSave"
        />
      </div>
    </template>
  </CustomDialog>
</template>
