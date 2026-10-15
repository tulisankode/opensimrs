<script setup lang="ts">
import * as XLSX from "xlsx";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import { keIso } from "@/stores/penunjang/fisioterapi";

// Kerangka halaman laporan Fisioterapi: header satu baris (rentang tanggal, filter tambahan, Tampilkan,
// Ekspor Excel) + isi laporan. `lembar` = data ekspor: [{ nama, baris: objek per baris }].
type Lembar = { nama: string; baris: Record<string, unknown>[] };
const mulai = defineModel<Date>("mulai", { required: true });
const selesai = defineModel<Date>("selesai", { required: true });
const props = defineProps<{ judul: string; memuat?: boolean; lembar?: () => Lembar[] | Promise<Lembar[]> }>();
const emit = defineEmits<{ (e: "tampilkan"): void }>();

const ekspor = async () => {
  if (!props.lembar) return;
  const wb = XLSX.utils.book_new();
  for (const l of await props.lembar()) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(l.baris.length ? l.baris : [{ Keterangan: "Tidak ada data" }]), l.nama.slice(0, 31));
  XLSX.writeFile(wb, `${props.judul} ${keIso(mulai.value)} sd ${keIso(selesai.value)}.xlsx`);
};
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-hidden" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="emit('tampilkan')" />
          <CustomBreadCrumb :home="{ label: 'Laporan', home: true }" />
          <PhCaretRight :size="16" weight="bold" class="shrink-0 text-opensimrs-300" aria-hidden="true" />
          <h1 class="toolbar-heading text-opensimrs-300">{{ judul }}</h1>
          <CustomDatePicker v-model="mulai" label="Tanggal mulai" class="toolbar-field--date" :max-date="selesai" />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker v-model="selesai" label="Tanggal selesai" class="toolbar-field--date" :min-date="mulai" />
          <slot name="filter" />
          <CustomButton label="Tampilkan" :loading="memuat" @click="emit('tampilkan')" />
          <CustomButton v-if="lembar" icon="PhMicrosoftExcelLogo" label="Ekspor" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="ekspor" />
        </PageToolbar>
      </template>
      <template #content>
        <div class="flex flex-col gap-4 p-4">
          <slot />
        </div>
      </template>
    </Card>
  </div>
</template>
