<script setup lang="ts">
import { ref, watch } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";

// Dialog konfirmasi penggajian (pengganti dialog bawaan peramban): pesan, isian alasan/catatan (wajib atau opsional), dan
// tanggal bila diperlukan. Nilai dikembalikan lewat emit `setuju`; pemanggil yang memanggil API dan menutup dialog.
const props = defineProps<{
  judul: string; pesan?: string; labelSetuju?: string; berisiko?: boolean; sibuk?: boolean;
  alasan?: { label: string; wajib?: boolean; awal?: string }; tanggal?: { label: string };
}>();
const terbuka = defineModel<boolean>("visible", { default: false });
const emit = defineEmits<{ setuju: [nilai: { alasan: string; tanggal: Date | null }] }>();
const isiAlasan = ref(""), isiTanggal = ref<Date | null>(null), galat = ref("");
watch(terbuka, (v) => { if (v) { isiAlasan.value = props.alasan?.awal ?? ""; isiTanggal.value = null; galat.value = ""; } });
const setuju = () => {
  galat.value = "";
  if (props.tanggal && !isiTanggal.value) return (galat.value = `${props.tanggal.label} wajib diisi`);
  if (props.alasan?.wajib && !isiAlasan.value.trim()) return (galat.value = `${props.alasan.label} wajib diisi`);
  emit("setuju", { alasan: isiAlasan.value.trim(), tanggal: isiTanggal.value });
};
</script>

<template>
  <CustomDialog v-model:visible="terbuka" width="560px" :headerBg="berisiko ? 'bg-danger-300' : 'bg-opensimrs-300'">
    <template #header>{{ judul }}</template>
    <template #body>
      <div class="flex flex-col gap-4 pt-4 text-sm">
        <p v-if="pesan">{{ pesan }}</p>
        <slot />
        <CustomDatePicker v-if="props.tanggal" v-model="isiTanggal" :label="props.tanggal.label" required />
        <CustomTextArea v-if="props.alasan" v-model="isiAlasan" :label="props.alasan.label + (props.alasan.wajib ? '' : ' (opsional)')" :required="props.alasan.wajib" />
        <div v-if="galat" role="alert" class="px-3 py-2 rounded-lg bg-danger-50 text-danger-400">{{ galat }}</div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="terbuka = false" />
        <CustomButton :label="labelSetuju || 'Lanjutkan'" :backgroundColor="berisiko ? 'bg-danger-300' : ''" :disabled="sibuk" @click="setuju" />
      </div>
    </template>
  </CustomDialog>
</template>
