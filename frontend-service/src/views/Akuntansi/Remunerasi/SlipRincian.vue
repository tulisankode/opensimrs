<script setup lang="ts">
import { rupiah, tanggalAk, waktuAk } from "@/stores/penunjang/akuntansi";
import { persen } from "@/stores/penunjang/remunerasi";

// Isi slip jasa pelayanan (dipakai Slip Saya & Rekap). Data dari backend sudah tanpa identitas pasien: kolom "Pasien"
// berisi penanda anonim per periode.
defineProps<{ slip: any }>();
</script>

<template>
  <div class="flex flex-col gap-4 text-sm">
    <div class="grid grid-cols-2 gap-3 text-xs">
      <div class="p-3 border rounded-md border-grey-100">
        <div class="text-base font-semibold">{{ slip.penerima.nama }}</div>
        <div class="text-grey-400">{{ slip.penerima.namaProfesi }} · {{ slip.penerima.unit || "-" }}</div>
        <div class="mt-1 text-grey-400">{{ slip.periode.nama }} ({{ slip.periode.nomor }}) · skema v{{ slip.periode.skemaVersi }} · disetujui {{ waktuAk(slip.periode.disetujuiPada) }}<span v-if="slip.periode.tanggalBayar"> · dibayar {{ tanggalAk(slip.periode.tanggalBayar) }}</span></div>
      </div>
      <div class="grid grid-cols-2 gap-1 p-3 border rounded-md border-grey-100">
        <span class="text-grey-400">Jasa langsung ({{ slip.ringkasan.jumlahLayanan }} layanan)</span><span class="text-right">Rp {{ rupiah(slip.ringkasan.langsung) }}</span>
        <span class="text-grey-400">Jasa kebersamaan</span><span class="text-right">Rp {{ rupiah(slip.ringkasan.kebersamaan) }}</span>
        <span class="text-grey-400">Koreksi</span><span class="text-right">Rp {{ rupiah(slip.ringkasan.koreksi) }}</span>
        <span class="font-semibold">Total</span><span class="text-right font-semibold">Rp {{ rupiah(slip.ringkasan.total) }}</span>
      </div>
    </div>
    <div v-if="slip.rumus" class="text-xs text-grey-400">
      Kebersamaan: poin {{ slip.rumus.poin }} (indeks profesi {{ slip.rumus.indeksProfesi }} + indeks × bobot) × capaian kinerja {{ slip.rumus.kinerjaPersen }}% = poin efektif {{ slip.rumus.poinEfektif }}, porsi pool {{ slip.rumus.porsiPoolPersen }}%.
    </div>
    <div v-if="slip.koreksi.length">
      <h3 class="mb-1 font-semibold">Koreksi</h3>
      <DataTable :value="slip.koreksi" class="text-xs" stripedRows>
        <Column header="Nilai" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: k }">{{ rupiah(k.nilai) }}</template></Column>
        <Column header="Alasan" field="alasan" headerClass="bg-opensimrs-50" />
        <Column header="Rujukan" headerClass="bg-opensimrs-50"><template #body="{ data: k }">{{ k.nomorRujukan || "-" }}</template></Column>
      </DataTable>
    </div>
    <div>
      <h3 class="mb-1 font-semibold">Rincian layanan (identitas pasien disamarkan)</h3>
      <DataTable :value="slip.layanan" class="text-xs" stripedRows scrollable scrollHeight="360px">
        <Column header="Tanggal" headerClass="bg-opensimrs-50"><template #body="{ data: l }">{{ tanggalAk(l.tanggalLayanan || l.tanggalLunas) }}</template></Column>
        <Column header="Pasien" field="pasien" headerClass="bg-opensimrs-50" />
        <Column header="Layanan" headerClass="bg-opensimrs-50"><template #body="{ data: l }">{{ l.namaItem }}<div class="text-[11px] text-grey-400">{{ l.jenisLayanan }} · {{ l.kategori }}</div></template></Column>
        <Column header="Nilai" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: l }">{{ rupiah(l.nilai) }}</template></Column>
        <Column header="Porsi" headerClass="bg-opensimrs-50"><template #body="{ data: l }">{{ persen(l.persenBp) }}</template></Column>
        <Column header="Jaspel" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: l }">{{ rupiah(l.jaspel) }}</template></Column>
        <Column header="Jasa langsung" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: l }">{{ rupiah(l.langsung) }}</template></Column>
      </DataTable>
    </div>
  </div>
</template>
