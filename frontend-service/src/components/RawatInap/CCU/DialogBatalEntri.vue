<script setup lang="ts">
import { ref, watch } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";

// Pembatalan entri klinis CCU berjejak: entri tidak dihapus, ditandai batal beserta alasan & pelaku (PRD KF-13).
const props = defineProps<{ judul: string }>();
const visible = defineModel<boolean>("visible", { default: false });
const emit = defineEmits<{ simpan: [alasan: string] }>();
const alasan = ref("");
const galat = ref("");

watch(visible, (buka) => {
  if (buka) {
    alasan.value = "";
    galat.value = "";
  }
});

const kirim = () => {
  if (alasan.value.trim().length < 3) return (galat.value = "Alasan pembatalan minimal 3 karakter");
  emit("simpan", alasan.value.trim());
};
</script>

<template>
  <CustomDialog v-model:visible="visible" width="480px">
    <template #header>{{ props.judul }}</template>
    <template #body>
      <div class="flex flex-col gap-3 pt-4">
        <div class="text-xs text-grey-400">Entri tetap tersimpan dengan tanda batal, alasan, dan nama petugas.</div>
        <CustomTextArea v-model="alasan" label="Alasan pembatalan" required />
        <div v-if="galat" class="text-sm text-danger-300">{{ galat }}</div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="visible = false" />
        <CustomButton label="Batalkan Entri" @click="kirim" />
      </div>
    </template>
  </CustomDialog>
</template>
