<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { MODALITAS_RAD, daftarPaketRad, daftarPemeriksaanRad, rupiahRad, type PaketRad } from "@/stores/penunjang/radiologi";

// Pemilih pemeriksaan radiologi (master aktif) dengan segmen "Pemeriksaan | Paket".
// v-model = array uuid pemeriksaan satuan; v-model:paket = array uuid paket terpilih. Pemeriksaan yang sudah
// tercakup paket ditandai "dalam paket" (backend mengabaikan duplikasinya). Harga item paket dialokasikan dari
// harga paket di backend. Dipakai order APS (halaman Radiologi) & form order RME.
const terpilih = defineModel<string[]>({ default: () => [] });
const paket = defineModel<string[]>("paket", { default: () => [] });
defineProps({ tinggi: { type: String, default: "max-h-[260px]" } });

const master = ref<any[]>([]);
const masterPaket = ref<PaketRad[]>([]);
const segmen = ref<"pemeriksaan" | "paket">("pemeriksaan");
const cari = ref("");
const modalitas = ref("");

onMounted(async () => {
  const [res, resPaket] = await Promise.all([daftarPemeriksaanRad({ limit: 9999, status: "1" }), daftarPaketRad({ limit: 9999, status: "1" })]);
  master.value = res?.payload?.data ?? [];
  masterPaket.value = resPaket?.payload?.data ?? [];
});

const modalitasAda = computed(() => [...new Set(master.value.map((m) => m.modalitas))]);
const tampil = computed(() => {
  const q = cari.value.trim().toLowerCase();
  return master.value.filter(
    (m) =>
      (!modalitas.value || m.modalitas === modalitas.value) &&
      (!q || `${m.kode} ${m.nama} ${m.bagianTubuh ?? ""}`.toLowerCase().includes(q))
  );
});
const tampilPaket = computed(() => {
  const q = cari.value.trim().toLowerCase();
  return masterPaket.value.filter(
    (p) => !q || `${p.kode} ${p.nama} ${p.deskripsi ?? ""} ${p.items.map((i) => i.nama).join(" ")}`.toLowerCase().includes(q)
  );
});

const paketDipilih = computed(() => masterPaket.value.filter((p) => paket.value.includes(p.uuid)));
// Pemeriksaan yang tercakup paket terpilih → uuid → nama paket.
const dalamPaket = computed(() => {
  const peta = new Map<string, string>();
  paketDipilih.value.forEach((p) => p.items.forEach((i) => peta.set(i.pemeriksaanUuid, p.nama)));
  return peta;
});
const dipilih = computed(() => master.value.filter((m) => terpilih.value.includes(m.uuid) && !dalamPaket.value.has(m.uuid)));
const total = computed(
  () => paketDipilih.value.reduce((n, p) => n + Number(p.harga || 0), 0) + dipilih.value.reduce((n, m) => n + Number(m.harga || 0), 0)
);
const jumlah = computed(() => paketDipilih.value.length + dipilih.value.length);

const toggle = (uuid: string) => {
  terpilih.value = terpilih.value.includes(uuid) ? terpilih.value.filter((u) => u !== uuid) : [...terpilih.value, uuid];
};
const togglePaket = (uuid: string) => {
  paket.value = paket.value.includes(uuid) ? paket.value.filter((u) => u !== uuid) : [...paket.value, uuid];
};

defineExpose({ dipilih, paketDipilih, total });
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex overflow-hidden border rounded-lg border-opensimrs-300">
        <button
          v-for="s in (['pemeriksaan', 'paket'] as const)"
          :key="s"
          type="button"
          class="px-3 py-1.5 text-xs font-semibold"
          :class="segmen === s ? 'bg-opensimrs-300 text-white' : 'text-opensimrs-300 bg-white'"
          @click="segmen = s"
        >
          {{ s === "pemeriksaan" ? "Pemeriksaan" : `Paket (${masterPaket.length})` }}
        </button>
      </div>
      <IconField class="grow min-w-[200px]">
        <InputIcon><PhMagnifyingGlass :size="16" /></InputIcon>
        <InputText
          v-model="cari"
          :placeholder="segmen === 'paket' ? 'Cari paket (nama / kode / isi)' : 'Cari pemeriksaan (nama / kode / bagian tubuh)'"
          class="w-full text-sm"
        />
      </IconField>
      <template v-if="segmen === 'pemeriksaan'">
        <button
          v-for="m in ['', ...modalitasAda]"
          :key="m || 'semua'"
          type="button"
          class="px-3 py-1 text-xs border rounded-full"
          :class="modalitas === m ? 'bg-opensimrs-300 text-white border-opensimrs-300' : 'border-grey-200 text-grey-400'"
          :title="m ? MODALITAS_RAD[m] : 'Semua modalitas'"
          @click="modalitas = m"
        >
          {{ m || "Semua" }}
        </button>
      </template>
    </div>

    <div v-if="segmen === 'pemeriksaan'" class="overflow-auto border rounded-lg border-grey-75" :class="tinggi">
      <div v-if="!master.length" class="p-3 text-sm text-grey-400">Belum ada master pemeriksaan radiologi aktif.</div>
      <div v-else-if="!tampil.length" class="p-3 text-sm text-grey-400">Tidak ada pemeriksaan yang cocok.</div>
      <label
        v-for="m in tampil"
        :key="m.uuid"
        class="flex items-center gap-3 px-3 py-2 text-sm border-b border-grey-75"
        :class="dalamPaket.has(m.uuid) ? 'opacity-60' : 'cursor-pointer hover:bg-opensimrs-50'"
      >
        <Checkbox
          :modelValue="dalamPaket.has(m.uuid) || terpilih.includes(m.uuid)"
          :disabled="dalamPaket.has(m.uuid)"
          binary
          @update:modelValue="toggle(m.uuid)"
        />
        <span class="w-12 text-xs font-semibold text-opensimrs-400">{{ m.modalitas }}</span>
        <span class="grow">
          {{ m.nama }} <span class="text-xs text-grey-300">· {{ m.kode }}</span>
          <span v-if="dalamPaket.has(m.uuid)" class="ml-1 px-1.5 rounded text-[10px] bg-opensimrs-50 text-opensimrs-400">dalam {{ dalamPaket.get(m.uuid) }}</span>
        </span>
        <span class="text-xs text-grey-400">{{ rupiahRad(m.harga) }}</span>
      </label>
    </div>

    <div v-else class="overflow-auto border rounded-lg border-grey-75" :class="tinggi">
      <div v-if="!masterPaket.length" class="p-3 text-sm text-grey-400">Belum ada paket radiologi aktif (Datamaster › Paket Radiologi).</div>
      <div v-else-if="!tampilPaket.length" class="p-3 text-sm text-grey-400">Tidak ada paket yang cocok.</div>
      <label
        v-for="p in tampilPaket"
        :key="p.uuid"
        class="flex items-start gap-3 px-3 py-2 text-sm border-b cursor-pointer border-grey-75 hover:bg-opensimrs-50"
      >
        <Checkbox :modelValue="paket.includes(p.uuid)" binary class="mt-0.5" @update:modelValue="togglePaket(p.uuid)" />
        <span class="flex flex-col grow">
          <span class="font-semibold">{{ p.nama }} <span class="text-xs font-normal text-grey-300">· {{ p.kode }}</span></span>
          <span class="text-xs text-grey-400">{{ p.items.map((i) => i.nama).join(" + ") }}</span>
        </span>
        <span class="flex flex-col items-end text-xs whitespace-nowrap">
          <span class="font-semibold text-opensimrs-400">{{ rupiahRad(p.harga) }}</span>
          <span v-if="p.totalSatuan > p.harga" class="line-through text-grey-300">{{ rupiahRad(p.totalSatuan) }}</span>
        </span>
      </label>
    </div>

    <div v-if="jumlah" class="flex flex-wrap items-center gap-2 text-xs">
      <span class="font-semibold">Dipilih ({{ jumlah }}):</span>
      <span v-for="p in paketDipilih" :key="p.uuid" class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-opensimrs-300 text-white">
        {{ p.nama }} ({{ p.items.length }} item)
        <PhX :size="12" class="cursor-pointer" @click="togglePaket(p.uuid)" />
      </span>
      <span v-for="m in dipilih" :key="m.uuid" class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-opensimrs-50 text-opensimrs-400">
        {{ m.nama }}
        <PhX :size="12" class="cursor-pointer" @click="toggle(m.uuid)" />
      </span>
      <span class="ml-auto font-semibold">Estimasi tarif: {{ rupiahRad(total) }}</span>
    </div>
  </div>
</template>
