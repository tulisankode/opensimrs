<script setup lang="ts">
import { onMounted, ref } from "vue";
import NoData from "@/components/section/NoData.vue";
import KerangkaLaporan from "./KerangkaLaporan.vue";
import { apiFisio, labelJenis, keIso } from "@/stores/penunjang/fisioterapi";

// Rekapitulasi Kunjungan per Jenis Fisioterapi (sport, saraf, orto, anak, geriatri).
const awal = new Date();
const mulai = ref(new Date(awal.getFullYear(), awal.getMonth(), 1));
const selesai = ref(new Date());
const memuat = ref(false);
const data = ref<{ data: any[]; total: any }>({ data: [], total: {} });

const muat = async () => {
  memuat.value = true;
  const r = await apiFisio.laporan("rekap-jenis", { tanggal_mulai: keIso(mulai.value), tanggal_selesai: keIso(selesai.value) });
  if (r) data.value = r.payload;
  memuat.value = false;
};

const KOLOM: [string, string][] = [
  ["kunjungan", "Kunjungan"],
  ["pasien", "Pasien"],
  ["baru", "Baru"],
  ["lama", "Lama"],
  ["lakiLaki", "Laki-laki"],
  ["perempuan", "Perempuan"],
  ["aps", "APS"],
  ["rujukan", "Rujukan Pelayanan"],
];
const persen = (n: number) => (data.value.total?.kunjungan ? `${((n / data.value.total.kunjungan) * 100).toFixed(1)}%` : "0%");
const lembar = () => [
  {
    nama: "Rekap Jenis Fisioterapi",
    baris: [
      ...data.value.data.map((r) => ({ "Jenis Fisioterapi": labelJenis(r.jenisFisio), ...Object.fromEntries(KOLOM.map(([k, l]) => [l, r[k]])) })),
      { "Jenis Fisioterapi": "TOTAL", ...Object.fromEntries(KOLOM.map(([k, l]) => [l, data.value.total?.[k] ?? 0])) },
    ],
  },
];
onMounted(muat);
</script>

<template>
  <KerangkaLaporan v-model:mulai="mulai" v-model:selesai="selesai" judul="Rekapitulasi Kunjungan Jenis Fisioterapi" :memuat="memuat" :lembar="lembar" @tampilkan="muat">
    <div class="grid grid-cols-2 gap-3 md:grid-cols-5">
      <div v-for="r in data.data" :key="r.jenisFisio" class="p-3 border rounded-lg border-grey-100">
        <div class="text-xs text-grey-400">{{ labelJenis(r.jenisFisio) }}</div>
        <div class="text-xl font-semibold text-opensimrs-400">{{ r.kunjungan }}</div>
        <div class="h-1.5 mt-2 rounded bg-grey-75">
          <div class="h-1.5 rounded bg-opensimrs-300" :style="{ width: persen(r.kunjungan) }" />
        </div>
        <div class="mt-1 text-[11px] text-grey-400">{{ persen(r.kunjungan) }} dari total kunjungan</div>
      </div>
    </div>
    <DataTable :value="data.data" :loading="memuat" class="text-xs" stripedRows>
      <template #empty><NoData /></template>
      <Column header="Jenis Fisioterapi" headerClass="bg-opensimrs-50" footerClass="font-semibold">
        <template #body="{ data: r }">{{ labelJenis(r.jenisFisio) }}</template>
        <template #footer>TOTAL</template>
      </Column>
      <Column v-for="[k, l] in KOLOM" :key="k" :header="l" headerClass="bg-opensimrs-50" footerClass="font-semibold">
        <template #body="{ data: r }">{{ r[k] }}</template>
        <template #footer>{{ data.total?.[k] ?? 0 }}</template>
      </Column>
    </DataTable>
    <p class="text-xs text-grey-400">Kunjungan dihitung dari sesi terapi berstatus hadir/selesai. Baru = sesi fisioterapi pertama pasien di faskes ini.</p>
  </KerangkaLaporan>
</template>
