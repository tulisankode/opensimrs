<script setup lang="ts">
import { ref, watch } from "vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { apiFisio, labelGender, umur, type PasienRingkas } from "@/stores/penunjang/fisioterapi";

// Pencarian pasien terdaftar (nama / No. RM / No. HP). v-model = pasien terpilih atau null.
const model = defineModel<PasienRingkas | null>({ default: null });
defineProps<{ label?: string; invalidMessage?: string }>();

const cari = ref("");
const hasil = ref<PasienRingkas[]>([]);
const memuat = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

watch(cari, (q) => {
  clearTimeout(timer);
  if (q.trim().length < 2) {
    hasil.value = [];
    return;
  }
  timer = setTimeout(async () => {
    memuat.value = true;
    const r = await apiFisio.cariPasien(q.trim());
    hasil.value = r?.payload ?? [];
    memuat.value = false;
  }, 350);
});

const pilih = (p: PasienRingkas) => {
  model.value = p;
  cari.value = "";
  hasil.value = [];
};
</script>

<template>
  <div class="flex flex-col gap-1">
    <div v-if="model" class="flex items-center justify-between gap-3 p-3 border rounded-lg border-opensimrs-200 bg-opensimrs-50">
      <div class="text-sm">
        <div class="font-semibold">{{ model.name }}</div>
        <div class="text-xs text-grey-500">
          {{ model.noRm }} · {{ labelGender(model.gender) }} · {{ umur(model.birthDate) }} · {{ model.phone || "-" }}
        </div>
      </div>
      <button type="button" class="text-xs font-semibold text-danger-300" @click="model = null">Ganti</button>
    </div>
    <template v-else>
      <CustomTextfield
        v-model="cari"
        :label="label ?? 'Pasien'"
        prependIcon="PhMagnifyingGlass"
        placeholder="Ketik nama / No. RM / No. HP (min. 2 huruf)"
        :invalid="!!invalidMessage"
        :invalidMessage="invalidMessage"
      />
      <div v-if="memuat" class="text-xs text-grey-400">Mencari…</div>
      <ul v-else-if="hasil.length" class="overflow-auto border rounded-lg max-h-56 border-grey-100">
        <li
          v-for="p in hasil"
          :key="p.uuid"
          class="px-3 py-2 text-sm cursor-pointer hover:bg-opensimrs-50 border-b last:border-b-0 border-grey-75"
          @click="pilih(p)"
        >
          <div class="font-medium">{{ p.name }}</div>
          <div class="text-xs text-grey-400">{{ p.noRm }} · {{ labelGender(p.gender) }} · {{ p.phone || "-" }}</div>
        </li>
      </ul>
      <div v-else-if="cari.trim().length >= 2" class="text-xs text-grey-400">Pasien tidak ditemukan. Daftarkan pasien di Admisi.</div>
    </template>
  </div>
</template>
