<script setup lang="ts">
import CustomButton from "@/components/Base/CustomButton.vue";
import { CAKUPAN_PELATIHAN } from "@/stores/penunjang/pelatihan";
defineProps<{ modelValue: any[]; referensi: any; pegawai: any[]; target?: boolean }>();
const emit = defineEmits<{ "update:modelValue": [value: any[]] }>();
// Elemen native dipertahankan agar validasi bawaan formulir induk (required/min/max/step) tetap berlaku.
const kelasLabel = "block font-semibold mb-[5px] text-normal";
const kelasInput = "w-full h-10 px-3 bg-white border rounded-lg border-grey-200 text-SM";
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="!modelValue.length" class="text-xs text-grey-400">Belum ada {{ target ? "target" : "cakupan" }}.</div>
    <div v-for="(c, i) in modelValue" :key="i" class="p-3 border rounded-lg border-grey-75">
      <div class="grid items-end grid-cols-1 gap-3 md:grid-cols-2">
        <label class="flex flex-col">
          <span :class="kelasLabel">Cakupan</span>
          <select v-model="c.jenisCakupan" :class="kelasInput" @change="c.referensiUuid = null">
            <option v-for="(nama, kode) in CAKUPAN_PELATIHAN" :key="kode" :value="kode">{{ nama }}</option>
          </select>
        </label>
        <label v-if="c.jenisCakupan !== 'semua'" class="flex flex-col">
          <span :class="kelasLabel">Pilihan<span class="text-danger-300">*</span></span>
          <select v-model="c.referensiUuid" :class="kelasInput" required>
            <option :value="null" disabled>Pilih cakupan</option>
            <option v-for="p in c.jenisCakupan === 'pegawai' ? pegawai : c.jenisCakupan === 'unit' ? referensi.unit : referensi.jenisPegawai" :key="p.uuid" :value="p.uuid">{{ p.namaPegawai ?? p.nama }}</option>
          </select>
        </label>
        <label v-if="target" class="flex flex-col">
          <span :class="kelasLabel">Target jam<span class="text-danger-300">*</span></span>
          <input v-model="c.targetJam" :class="kelasInput" type="number" min="0.01" max="999999.99" step="0.01" required />
        </label>
        <template v-else>
          <label class="flex flex-col">
            <span :class="kelasLabel">Mulai berlaku (WIB)<span class="text-danger-300">*</span></span>
            <input v-model="c.mulaiBerlaku" :class="kelasInput" type="date" required />
          </label>
          <label class="flex flex-col">
            <span :class="kelasLabel">Akhir berlaku, tidak termasuk (WIB)</span>
            <input v-model="c.akhirBerlaku" :class="kelasInput" type="date" />
          </label>
        </template>
      </div>
      <div class="flex justify-end mt-3">
        <CustomButton
          :label="target ? 'Hapus target' : 'Hapus cakupan'"
          icon="PhTrash"
          size="small"
          outlined
          borderColor="border-danger-300"
          textColor="text-danger-300"
          @click="emit('update:modelValue', modelValue.filter((_, n) => n !== i))"
        />
      </div>
    </div>
    <div>
      <CustomButton
        :label="`Tambah ${target ? 'target' : 'cakupan'}`"
        icon="PhPlus"
        size="small"
        outlined
        borderColor="border-opensimrs-300"
        textColor="text-opensimrs-300"
        @click="emit('update:modelValue', [...modelValue, { jenisCakupan: 'semua', referensiUuid: null, targetJam: '', mulaiBerlaku: '', akhirBerlaku: '' }])"
      />
    </div>
  </div>
</template>
