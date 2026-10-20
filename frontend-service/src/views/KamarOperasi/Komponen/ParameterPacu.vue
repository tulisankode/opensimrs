<script setup lang="ts">
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";

// Isian parameter dinamis dari snapshot protokol PACU (parameter pemantauan, kriteria pindah, isi serah terima).
// Kunci nilai = kode parameter (snake_case) sesuai protokol; tipe angka dikirim sebagai number.
const props = defineProps<{ definisi: any[]; modelValue: Record<string, any>; disabled?: boolean }>();
const emit = defineEmits<{ "update:modelValue": [nilai: Record<string, any>] }>();

const baca = (kode: string) => props.modelValue?.[kode] ?? null;
const ubah = (p: any, nilai: any) =>
  emit("update:modelValue", {
    ...props.modelValue,
    [p.kode]: p.tipe === "angka" ? (nilai === "" || nilai === null || nilai === undefined ? null : Number(nilai)) : nilai,
  });
const label = (p: any) => `${p.nama}${p.satuan ? ` (${p.satuan})` : ""}`;
const opsi = (p: any) =>
  p.tipe === "boolean" ? [{ label: "Ya", nilai: true }, { label: "Tidak", nilai: false }] : (p.pilihan ?? []).map((v: string) => ({ label: v, nilai: v }));
</script>

<template>
  <div class="grid grid-cols-2 gap-3">
    <template v-for="p in definisi" :key="p.kode">
      <CustomSelect
        v-if="p.tipe === 'pilihan' || p.tipe === 'boolean'"
        :modelValue="baca(p.kode)"
        :label="label(p)"
        :required="p.wajib"
        :options="opsi(p)"
        optionLabel="label"
        optionValue="nilai"
        :disabled="disabled"
        @update:modelValue="ubah(p, $event)"
      />
      <CustomTextfield
        v-else
        :modelValue="baca(p.kode) === null ? null : String(baca(p.kode))"
        :label="label(p)"
        :required="p.wajib"
        :type="p.tipe === 'angka' ? 'number' : 'text'"
        :disabled="disabled"
        @update:modelValue="ubah(p, $event)"
      />
    </template>
  </div>
</template>
