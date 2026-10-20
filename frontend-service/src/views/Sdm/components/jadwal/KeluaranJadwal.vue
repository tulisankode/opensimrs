<script setup lang="ts">
import CustomButton from "@/components/Base/CustomButton.vue";
import { amanCsv, tanggalJadwal } from "@/stores/penunjang/jadwalDinas";
import { warnaShift } from "./tampilan";

// Keluaran jadwal terbit (ekspor CSV atau cetak). Logika ekspor sama dengan komponen lama CetakJadwal.
const props = defineProps<{ data: any; jenis: string }>();
const ekspor = () => {
  const baris = [
    ["Pegawai", "Tanggal", "Shift", "Mulai", "Selesai"],
    ...props.data.penempatan.map((p: any) => [p.nama, tanggalJadwal(p.tanggalKerja), p.potretShift.nama, tanggalJadwal(p.mulaiEpoch), tanggalJadwal(p.selesaiEpoch)]),
  ];
  const url = URL.createObjectURL(new Blob(["﻿", baris.map((x: unknown[]) => x.map(amanCsv).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const tautan = document.createElement("a");
  tautan.href = url;
  tautan.download = "jadwal-dinas.csv";
  tautan.click();
  URL.revokeObjectURL(url);
};
const cetak = () => window.print();
</script>

<template>
  <section class="flex flex-col gap-3 p-4 border rounded-lg hasil-cetak-jadwal border-grey-75">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 class="font-semibold text-opensimrs-300">{{ data.judul }} · Versi {{ data.versi.nomorVersi }} · Terbit</h2>
        <p class="text-xs text-grey-400">Dibuat {{ tanggalJadwal(data.dibuatPada) }} · Asia/Jakarta</p>
      </div>
      <CustomButton v-if="jenis === 'ekspor'" class="print:hidden" icon="PhDownloadSimple" label="Unduh CSV" @click="ekspor" />
      <CustomButton v-else class="print:hidden" icon="PhPrinter" label="Cetak jadwal" @click="cetak" />
    </div>
    <DataTable :value="data.penempatan" dataKey="uuid" stripedRows class="text-xs" tableStyle="min-width: 40rem">
      <Column header="Pegawai" headerClass="bg-opensimrs-50"><template #body="{ data: p }">{{ p.nama }}</template></Column>
      <Column header="Tanggal" headerClass="bg-opensimrs-50"><template #body="{ data: p }">{{ tanggalJadwal(p.tanggalKerja) }}</template></Column>
      <Column header="Shift" headerClass="bg-opensimrs-50">
        <template #body="{ data: p }">
          <span class="px-2 py-0.5 mr-1 font-semibold border rounded-md" :class="warnaShift(p.potretShift?.kode, p.potretShift?.libur)">{{ p.potretShift?.kode }}</span>
          {{ p.potretShift.nama }}
        </template>
      </Column>
      <Column header="Mulai" headerClass="bg-opensimrs-50"><template #body="{ data: p }">{{ tanggalJadwal(p.mulaiEpoch) }}</template></Column>
      <Column header="Selesai" headerClass="bg-opensimrs-50"><template #body="{ data: p }">{{ tanggalJadwal(p.selesaiEpoch) }}</template></Column>
    </DataTable>
  </section>
</template>

<style>
@media print {
  body * { visibility: hidden; }
  .hasil-cetak-jadwal, .hasil-cetak-jadwal * { visibility: visible; }
  .hasil-cetak-jadwal { position: absolute; inset: 0; background: white; border: none; }
  .hasil-cetak-jadwal button { display: none; }
}
</style>
