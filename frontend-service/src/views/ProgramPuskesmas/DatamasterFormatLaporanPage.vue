<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import { utilsStore } from "@/stores/utils";
import { formatLaporanPkm, izinPkm, simpanFormatLaporanPkm } from "@/stores/programPuskesmas/programPuskesmas";

// Konfigurasi format kolom ekspor Excel per jenis laporan Dinkes. Belum ada format baku nasional resmi yang
// diasumsikan (lihat dokumen desain) — format disimpan sebagai JSON bebas per faskes/Dinkes penerima.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinPkm("Datamaster", aksi, "Format Laporan Dinkes");
const JENIS = { lb1: "LB1", kia: "KIA", imunisasi: "Imunisasi", program: "Program" };

const jenis = ref("lb1");
const status = ref(true);
const formatTeks = ref("{}");
const galat = ref("");

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await formatLaporanPkm(jenis.value);
    status.value = res?.payload?.status ?? true;
    formatTeks.value = JSON.stringify(res?.payload?.format ?? {}, null, 2);
  } finally {
    storeUtils.setLoading(false);
  }
};
const simpan = async () => {
  galat.value = "";
  let format: Record<string, any>;
  try {
    format = JSON.parse(formatTeks.value || "{}");
  } catch {
    galat.value = "Format JSON tidak valid";
    return;
  }
  storeUtils.setLoading(true);
  try {
    await simpanFormatLaporanPkm(jenis.value, { format, status: status.value });
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <h1 class="toolbar-heading text-opensimrs-300">Format Laporan Dinkes</h1>
          <CustomSelect v-model="jenis" label="Jenis Laporan" :options="Object.entries(JENIS).map(([value, label]) => ({ value, label }))" optionValue="value" optionLabel="label" :clearable="false" :showFilter="false" @update:modelValue="muat" />
        </PageToolbar>
      </template>
      <template #content>
        <div class="flex flex-col gap-4 p-5">
          <CustomSwitch v-model="status" label="Status" sideLabel="Nonaktif" sideLabelTrue="Aktif" :disabled="!boleh('UPDATE')" />
          <CustomTextArea v-model="formatTeks" label="Konfigurasi Format (JSON)" height="h-80" :disabled="!boleh('UPDATE')" />
          <div class="text-xs text-grey-400">Konfigurasi kolom/format ekspor Excel untuk laporan ini, mis. nama kolom sesuai yang diminta Dinkes setempat.</div>
          <div v-if="galat" class="text-sm text-danger-300">{{ galat }}</div>
          <div class="flex justify-end">
            <CustomButton v-if="boleh('UPDATE')" label="Simpan" icon="PhFloppyDisk" @click="simpan" />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
