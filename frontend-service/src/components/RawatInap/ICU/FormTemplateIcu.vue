<script setup lang="ts">
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import type { ElemenIcu, NilaiIcu } from "@/stores/rawatInap/icu";
const props = defineProps<{ elemen: ElemenIcu[]; modelValue: NilaiIcu[]; disabled?: boolean }>();
const emit = defineEmits<{ "update:modelValue": [nilai: NilaiIcu[]] }>();
const baca = (kode: string) => props.modelValue.find((v) => v.kodeParameter === kode)?.nilai ?? null;
const ubah = (kode: string, nilai: any) => emit("update:modelValue", [...props.modelValue.filter((v) => v.kodeParameter !== kode), { kodeParameter: kode, nilai }]);
</script>
<template>
  <div class="grid grid-cols-2 gap-3">
    <div v-for="e in elemen" :key="e.kodeParameter">
      <CustomSelect v-if="e.jenis === 'pilihan' || e.jenis === 'boolean'" :modelValue="baca(e.kodeParameter)" @update:modelValue="ubah(e.kodeParameter, $event)"
        :label="e.label + (e.wajib ? ' *' : '')" :disabled="disabled"
        :options="e.jenis === 'boolean' ? [{ label: 'Ya', nilai: true }, { label: 'Tidak', nilai: false }] : e.pilihan?.map((p) => ({ label: p, nilai: p }))"
        optionLabel="label" optionValue="nilai" />
      <CustomTextfield v-else :modelValue="baca(e.kodeParameter) == null ? null : String(baca(e.kodeParameter))" @update:modelValue="ubah(e.kodeParameter, e.jenis === 'angka' ? ($event === '' || $event == null ? null : Number($event)) : $event)"
        :label="e.label + (e.satuan ? ' (' + e.satuan + ')' : '') + (e.wajib ? ' *' : '')" :type="e.jenis === 'angka' ? 'number' : 'text'" :disabled="disabled" />
    </div>
  </div>
</template>
