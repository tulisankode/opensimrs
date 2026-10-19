<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import { daftarInstrumen, strukturInstrumen } from "@/stores/penunjang/mutu";

// Pemilih elemen penilaian (pemetaan bukti dokumen, KF-5): pilih instrumen faskes lalu centang elemen per bab/standar.
// Pilihan dari instrumen lain tetap tersimpan saat instrumen diganti. Faskes tanpa instrumen → petunjuk (KT-3).
const model = defineModel<string[]>({ default: () => [] });
const opsiInstrumen = ref<any[]>([]);
const instrumenUuid = ref("");
const struktur = ref<any>(null);
const cari = ref("");
const memuat = ref(true);

const pilihInstrumen = async () => {
  struktur.value = null;
  if (!instrumenUuid.value) return;
  const res = await strukturInstrumen(instrumenUuid.value);
  struktur.value = res?.payload ?? null;
};
const cocok = (e: any) => !cari.value.trim() || `${e.kode} ${e.uraian}`.toLowerCase().includes(cari.value.trim().toLowerCase());
const babTampil = computed(() =>
  (struktur.value?.bab ?? [])
    .map((b: any) => ({ ...b, standar: b.standar.map((s: any) => ({ ...s, elemen: s.elemen.filter(cocok) })).filter((s: any) => s.elemen.length) }))
    .filter((b: any) => b.standar.length)
);
const dipilih = (uuid: string) => model.value.includes(uuid);
const ubahPilihan = (uuid: string, v: boolean) => {
  model.value = v ? [...new Set([...model.value, uuid])] : model.value.filter((x) => x !== uuid);
};
const pilihStandar = (s: any, v: boolean) => {
  const ids = s.elemen.map((e: any) => e.uuid);
  model.value = v ? [...new Set([...model.value, ...ids])] : model.value.filter((x) => !ids.includes(x));
};

onMounted(async () => {
  const res = await daftarInstrumen({ limit: 200 });
  opsiInstrumen.value = (res?.payload?.data ?? []).map((i: any) => ({ value: i.uuid, label: `${i.kode ? `${i.kode} — ` : ""}${i.nama}${i.aktif ? "" : " (nonaktif)"}` }));
  if (opsiInstrumen.value.length === 1) {
    instrumenUuid.value = opsiInstrumen.value[0].value;
    await pilihInstrumen();
  }
  memuat.value = false;
});
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="!memuat && !opsiInstrumen.length" class="p-3 text-xs border rounded-lg text-grey-400 border-grey-100">
      Belum ada instrumen akreditasi. Isi atau impor bab, standar, dan elemen penilaian di menu Instrumen Akreditasi terlebih dahulu; sistem tidak menyediakan isi instrumen.
    </div>
    <template v-else>
      <div class="grid grid-cols-2 gap-3">
        <CustomSelect v-model="instrumenUuid" label="Instrumen" :options="opsiInstrumen" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="pilihInstrumen" />
        <div class="flex flex-col gap-1">
          <label class="text-sm">Cari elemen</label>
          <input v-model="cari" class="h-[40px] px-3 text-sm border rounded-lg border-grey-200" placeholder="Kode / uraian" />
        </div>
      </div>
      <div class="text-xs text-grey-400">{{ model.length }} elemen dipilih</div>
      <div v-if="struktur" class="overflow-auto border rounded-lg max-h-72 border-grey-100">
        <div v-if="!babTampil.length" class="p-3 text-xs text-grey-400">Tidak ada elemen penilaian pada instrumen ini.</div>
        <div v-for="b in babTampil" :key="b.uuid" class="px-3 py-2 border-b border-grey-100 last:border-0">
          <div class="text-xs font-semibold">{{ b.kode }} — {{ b.nama }}</div>
          <div v-for="s in b.standar" :key="s.uuid" class="pl-3 mt-1">
            <label class="flex items-center gap-2 text-xs font-semibold text-opensimrs-300">
              <Checkbox :modelValue="s.elemen.every((e: any) => dipilih(e.uuid))" binary @update:modelValue="pilihStandar(s, $event)" /> {{ s.kode }} — {{ s.nama }}
            </label>
            <label v-for="e in s.elemen" :key="e.uuid" class="flex items-start gap-2 py-0.5 pl-6 text-xs">
              <Checkbox :modelValue="dipilih(e.uuid)" binary @update:modelValue="ubahPilihan(e.uuid, $event)" />
              <span><span class="font-semibold">{{ e.kode }}</span> {{ e.uraian }}</span>
            </label>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
