<script setup lang="ts">
import { ref } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import { simpanGaji, epochHariGaji, kunciBesar } from "@/stores/penunjang/penggajian";

// Formulir generik penggajian: tombol pembuka + dialog. Isian teks/angka/nominal/JSON memakai elemen native bergaya
// OpenSIMRS agar validasi bawaan (required/pattern/min/max) berjalan saat submit; pilihan & tanggal memakai komponen Base
// dan diperiksa manual sebelum dikirim. Nama kunci payload = `nama` kolom (camelCase, dikonversi instance penunjang).
export interface PilihanGaji { value: string | number; label: string }
export interface KolomGaji {
  nama: string; label: string;
  jenis?: "teks" | "angka" | "nominal" | "tanggal" | "json" | "area";
  pilihan?: (string | PilihanGaji)[]; opsional?: boolean; bantuan?: string; contoh?: string; lebar?: boolean; min?: number; max?: number; maks?: number; pola?: string; polaPesan?: string;
}
const props = defineProps<{
  judul: string; path: string; kolom: KolomGaji[]; boleh: boolean; labelTombol?: string;
  ikon?: string; kecil?: boolean; garis?: boolean; ubah?: boolean; keterangan?: string; lebar?: string;
  tambahan?: Record<string, any>; awal?: Record<string, any>; nonaktif?: boolean;
}>();
const emit = defineEmits<{ tersimpan: [payload?: any] }>();
const terbuka = ref(false), form = ref<Record<string, any>>({}), pesan = ref(""), sibuk = ref(false);
const idForm = `form-gaji-${Math.random().toString(36).slice(2, 9)}`;
const opsi = (c: KolomGaji) => (c.pilihan ?? []).map((p) => (typeof p === "string" ? { value: p, label: p } : p));
const NOMINAL = "-?\\d{1,16}(\\.\\d{1,2})?";
const kelasLabel = "block font-semibold mb-[5px] text-normal";
const kelasInput = "w-full h-10 px-3 bg-white border rounded-lg border-grey-200 text-SM disabled:bg-grey-100";
const kelasArea = "w-full p-3 bg-white border rounded-lg border-grey-200 text-SM";
const kelasTombolSimpan = "h-10 px-4 font-semibold text-white rounded-[10px] bg-opensimrs-300 disabled:bg-grey-200 disabled:text-grey-400";

const buka = () => {
  pesan.value = "";
  form.value = Object.fromEntries(props.kolom.map((c) => {
    const v = props.awal?.[c.nama];
    if (c.jenis === "json") return [c.nama, v == null ? "" : typeof v === "string" ? v : JSON.stringify(v, null, 2)];
    if (c.jenis === "tanggal") return [c.nama, v ? new Date(Number(v) * 1000) : null];
    return [c.nama, v ?? ""];
  }));
  terbuka.value = true;
};
const simpan = async () => {
  if (sibuk.value) return;
  pesan.value = "";
  const data: Record<string, any> = { ...(props.tambahan ?? {}) };
  for (const c of props.kolom) {
    const v = form.value[c.nama];
    if (v == null || v === "") {
      if (c.opsional) { data[c.nama] = null; continue; }
      pesan.value = `${c.label} wajib diisi`;
      return;
    }
    if (c.jenis === "json") {
      try { data[c.nama] = JSON.parse(v); } catch { pesan.value = `${c.label} bukan JSON yang sah`; return; }
      if (kunciBesar(data[c.nama])) { pesan.value = `${c.label}: nama kunci JSON wajib huruf kecil dengan garis bawah (snake_case), mis. bpjs_kesehatan`; return; }
    } else if (c.jenis === "tanggal") data[c.nama] = epochHariGaji(v);
    else if (c.jenis === "angka") data[c.nama] = Number(v);
    else data[c.nama] = typeof v === "string" ? v.trim() : v;
  }
  sibuk.value = true;
  try {
    const r = await simpanGaji(props.path, data, props.ubah);
    if (r) { terbuka.value = false; emit("tersimpan", r.payload); }
  } finally { sibuk.value = false; }
};
</script>

<template>
  <template v-if="boleh">
    <CustomButton
      :label="labelTombol || 'Simpan versi baru'"
      :icon="ikon ?? 'PhPlus'"
      :size="kecil ? 'small' : undefined"
      :outlined="garis"
      :borderColor="garis ? 'border-opensimrs-300' : undefined"
      :textColor="garis ? 'text-opensimrs-300' : undefined"
      :disabled="nonaktif"
      @click="buka"
    />
    <CustomDialog v-model:visible="terbuka" :width="lebar || '720px'">
      <template #header>{{ judul }}</template>
      <template #body>
        <form :id="idForm" class="flex flex-col gap-4 pt-4 text-sm" @submit.prevent="simpan">
          <p v-if="keterangan" class="px-3 py-2 text-xs rounded-lg bg-info-50 text-info-400">{{ keterangan }}</p>
          <div class="grid items-start grid-cols-1 gap-4 md:grid-cols-2">
            <div v-for="c in kolom" :key="c.nama" class="flex flex-col" :class="{ 'md:col-span-2': c.lebar || c.jenis === 'json' || c.jenis === 'area' }">
              <CustomSelect v-if="c.pilihan" v-model="form[c.nama]" :label="c.label + (c.opsional ? ' (opsional)' : '')" :options="opsi(c)" optionValue="value" optionLabel="label" :showFilter="opsi(c).length > 8" :required="!c.opsional" :placeHolder="`Pilih ${c.label.toLowerCase()}`" />
              <CustomDatePicker v-else-if="c.jenis === 'tanggal'" v-model="form[c.nama]" :label="c.label + (c.opsional ? ' (opsional)' : '')" :required="!c.opsional" />
              <label v-else class="flex flex-col">
                <span :class="kelasLabel">{{ c.label }}<span v-if="!c.opsional" class="text-danger-300">*</span><span v-else class="font-normal text-grey-400"> (opsional)</span></span>
                <textarea v-if="c.jenis === 'json'" v-model="form[c.nama]" :class="kelasArea" class="font-mono" rows="8" :required="!c.opsional" :placeholder="c.contoh" autocomplete="off" spellcheck="false" />
                <textarea v-else-if="c.jenis === 'area'" v-model="form[c.nama]" :class="kelasArea" rows="3" :required="!c.opsional" :maxlength="c.maks ?? 4000" :placeholder="c.contoh" />
                <input v-else-if="c.jenis === 'angka'" v-model="form[c.nama]" :class="kelasInput" type="number" step="1" :min="c.min" :max="c.max" :required="!c.opsional" :placeholder="c.contoh" autocomplete="off" />
                <input v-else-if="c.jenis === 'nominal'" v-model="form[c.nama]" :class="kelasInput" inputmode="decimal" :pattern="NOMINAL" title="Angka dengan titik desimal, maksimal dua angka di belakang titik (mis. 2500000.00)" :required="!c.opsional" :placeholder="c.contoh ?? 'mis. 2500000.00'" autocomplete="off" />
                <input v-else v-model="form[c.nama]" :class="kelasInput" :required="!c.opsional" :maxlength="c.maks ?? 1000" :pattern="c.pola" :title="c.polaPesan" :placeholder="c.contoh" autocomplete="off" />
              </label>
              <span v-if="c.bantuan" class="mt-1 text-xs text-grey-400">{{ c.bantuan }}</span>
            </div>
          </div>
          <slot />
          <div v-if="pesan" role="alert" class="px-3 py-2 rounded-lg bg-danger-50 text-danger-400">{{ pesan }}</div>
        </form>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="terbuka = false" />
          <button type="submit" :form="idForm" :class="kelasTombolSimpan" :disabled="sibuk">{{ ubah ? "Simpan perubahan" : "Simpan" }}</button>
        </div>
      </template>
    </CustomDialog>
  </template>
</template>
