<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { JENIS_PA, daftarPemeriksaanPa, kasusIndukPa, rupiahPa, waktuPa } from "@/stores/penunjang/patologi";

// Pemilih pemeriksaan Patologi Anatomi (master aktif) dengan filter jenis. v-model = array uuid pemeriksaan.
// Pemeriksaan IHK (imunohistokimia) adalah tambahan pada kasus PA yang sudah ada: bila dipilih, wajib memilih kasus
// induk (blok parafin) pasien yang sama → v-model:induk. Dipakai order APS/rujukan (halaman PA) & form order RME.
const terpilih = defineModel<string[]>({ default: () => [] });
const induk = defineModel<string>("induk", { default: "" });
const props = defineProps({
  patientUuid: { type: String, default: "" },
  tinggi: { type: String, default: "max-h-[260px]" },
});

const master = ref<any[]>([]);
const cari = ref("");
const jenis = ref("");
const kandidatInduk = ref<any[]>([]);

onMounted(async () => {
  master.value = (await daftarPemeriksaanPa({ limit: 9999, status: "1" }))?.payload?.data ?? [];
});

const jenisAda = computed(() => Object.keys(JENIS_PA).filter((j) => master.value.some((m) => m.jenis === j)));
const tampil = computed(() => {
  const q = cari.value.trim().toLowerCase();
  return master.value.filter((m) => (!jenis.value || m.jenis === jenis.value) && (!q || `${m.kode} ${m.nama} ${m.kategori ?? ""}`.toLowerCase().includes(q)));
});
const dipilih = computed(() => master.value.filter((m) => terpilih.value.includes(m.uuid)));
const total = computed(() => dipilih.value.reduce((n, m) => n + Number(m.harga || 0), 0));
const adaIhk = computed(() => dipilih.value.some((m) => m.jenis === "ihk"));

const muatInduk = async () => {
  if (!adaIhk.value || !props.patientUuid) return;
  kandidatInduk.value = (await kasusIndukPa(props.patientUuid))?.payload ?? [];
  if (induk.value && !kandidatInduk.value.some((k) => k.uuid === induk.value)) induk.value = "";
};
watch([adaIhk, () => props.patientUuid], muatInduk);

const toggle = (uuid: string) => {
  terpilih.value = terpilih.value.includes(uuid) ? terpilih.value.filter((u) => u !== uuid) : [...terpilih.value, uuid];
};

// Item untuk API order: IHK membawa kasus induk.
const items = computed(() => dipilih.value.map((m) => ({ pemeriksaanUuid: m.uuid, kasusIndukUuid: m.jenis === "ihk" ? induk.value || null : null })));
defineExpose({ dipilih, total, adaIhk, items });
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex flex-wrap items-center gap-2">
      <IconField class="grow min-w-[200px]">
        <InputIcon><PhMagnifyingGlass :size="16" /></InputIcon>
        <InputText v-model="cari" placeholder="Cari pemeriksaan PA (nama / kode / kategori)" class="w-full text-sm" />
      </IconField>
      <button
        v-for="j in ['', ...jenisAda]"
        :key="j || 'semua'"
        type="button"
        class="px-3 py-1 text-xs border rounded-full"
        :class="jenis === j ? 'bg-opensimrs-300 text-white border-opensimrs-300' : 'border-grey-200 text-grey-400'"
        @click="jenis = j"
      >
        {{ j ? JENIS_PA[j as keyof typeof JENIS_PA].singkat : "Semua" }}
      </button>
    </div>

    <div class="overflow-auto border rounded-lg border-grey-75" :class="tinggi">
      <div v-if="!master.length" class="p-3 text-sm text-grey-400">Belum ada master pemeriksaan PA aktif.</div>
      <div v-else-if="!tampil.length" class="p-3 text-sm text-grey-400">Tidak ada pemeriksaan yang cocok.</div>
      <label v-for="m in tampil" :key="m.uuid" class="flex items-center gap-3 px-3 py-2 text-sm border-b cursor-pointer border-grey-75 hover:bg-opensimrs-50">
        <Checkbox :modelValue="terpilih.includes(m.uuid)" binary @update:modelValue="toggle(m.uuid)" />
        <span class="w-20 text-xs font-semibold text-opensimrs-400">{{ JENIS_PA[m.jenis as keyof typeof JENIS_PA]?.singkat ?? m.jenis }}</span>
        <span class="grow">
          {{ m.nama }} <span class="text-xs text-grey-300">· {{ m.kode }}</span>
          <span v-if="m.kategori" class="ml-1 text-xs text-grey-400">({{ m.kategori }})</span>
        </span>
        <span class="text-xs text-grey-400 whitespace-nowrap">{{ m.tatHari ? `± ${m.tatHari} hari` : "hari ini" }}</span>
        <span class="text-xs text-grey-400 whitespace-nowrap">{{ rupiahPa(m.harga) }}</span>
      </label>
    </div>

    <div v-if="adaIhk" class="p-3 border rounded-lg border-warning-75 bg-warning-50">
      <div class="mb-1 text-sm font-semibold">Kasus PA induk untuk IHK (blok parafin)</div>
      <div v-if="!patientUuid" class="text-xs text-grey-400">Pilih pasien terlebih dahulu.</div>
      <div v-else-if="!kandidatInduk.length" class="text-xs text-danger-300">Pasien belum memiliki kasus PA bernomor (histopatologi/sitologi). IHK hanya dapat diorder sebagai tambahan kasus PA.</div>
      <div v-else class="flex flex-col gap-1 overflow-auto max-h-[150px]">
        <label v-for="k in kandidatInduk" :key="k.uuid" class="flex items-start gap-2 text-sm cursor-pointer">
          <RadioButton v-model="induk" :value="k.uuid" class="mt-0.5" />
          <span>
            <b>{{ k.noPa }}</b> · {{ k.nama }} <span class="text-xs text-grey-400">· {{ waktuPa(k.waktuTerima, true) }}</span>
            <span v-if="k.diagnosis" class="block text-xs text-grey-500 line-clamp-1">{{ k.diagnosis }}</span>
            <span v-if="k.blok" class="block text-xs text-grey-400">Blok: {{ k.blok }}</span>
          </span>
        </label>
      </div>
    </div>

    <div v-if="dipilih.length" class="flex flex-wrap items-center gap-2 text-xs">
      <span class="font-semibold">Dipilih ({{ dipilih.length }}):</span>
      <span v-for="m in dipilih" :key="m.uuid" class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-opensimrs-50 text-opensimrs-400">
        {{ m.nama }}
        <PhX :size="12" class="cursor-pointer" @click="toggle(m.uuid)" />
      </span>
      <span class="ml-auto font-semibold">Estimasi tarif: {{ rupiahPa(total) }}</span>
    </div>
  </div>
</template>
