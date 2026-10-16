<script setup lang="ts">
// Jejak audit (append-only) & pemakaian agen per item.
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { apiStudioGet } from "@/utils/apiHandler";
import { formatUsd, formatWaktu, nomorItem } from "../umum";

const router = useRouter();
const audit = ref<any[]>([]);
const biaya = ref<any[]>([]);
const metrik = ref<any>(null);

const muat = async () => {
  const [res, m] = await Promise.all([apiStudioGet("/audit"), apiStudioGet("/metrik", true)]);
  audit.value = res?.payload?.audit ?? [];
  biaya.value = res?.payload?.biaya ?? [];
  metrik.value = m?.payload ?? null;
};
const kartuMetrik = () => [
  { label: "Median permintaan → PRD disetujui", nilai: metrik.value?.medianJamKePrd != null ? `${metrik.value.medianJamKePrd} jam` : "-" },
  { label: "PRD disetujui tanpa revisi", nilai: metrik.value?.persenPrdTanpaRevisi != null ? `${metrik.value.persenPrdTanpaRevisi}%` : "-" },
  { label: "Kode agen disetujui tanpa revisi", nilai: metrik.value?.persenKodeTanpaRevisi != null ? `${metrik.value.persenKodeTanpaRevisi}%` : "-" },
  { label: "Item selesai", nilai: metrik.value?.jumlahSelesai ?? 0 },
  { label: "Median durasi item selesai", nilai: metrik.value?.medianHariSelesai != null ? `${metrik.value.medianHariSelesai} hari` : "-" },
  { label: "Rata-rata biaya per item selesai", nilai: metrik.value?.rataBiayaPerItemSelesai != null ? formatUsd(metrik.value.rataBiayaPerItemSelesai) : "-" },
];
onMounted(muat);

const ekspor = () => {
  const baris = [["Waktu", "Pelaku", "Aksi", "Item"], ...audit.value.map((a) => [formatWaktu(a.waktu), a.pelaku, a.aksi, a.nomor ? nomorItem(a.nomor) : ""])];
  const csv = baris.map((b) => b.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "audit-simrs-studio.csv";
  a.click();
  URL.revokeObjectURL(url);
};
</script>

<template>
  <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full" class="h-full">
    <template #header>
      <PageToolbar>
        <h1 class="toolbar-heading text-opensimrs-300">Audit, Pemakaian & Metrik</h1>
        <div class="flex gap-2">
          <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" icon="PhArrowClockwise" outlined @click="muat" />
          <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" label="Ekspor CSV" outlined icon="PhDownloadSimple" @click="ekspor" />
        </div>
      </PageToolbar>
    </template>
    <template #content>
      <div class="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-6">
        <div v-for="k in kartuMetrik()" :key="k.label" class="rounded-lg bg-opensimrs-50 p-3">
          <div class="text-heading font-bold text-grey-500">{{ k.nilai }}</div>
          <div class="text-[11px] text-grey-400">{{ k.label }}</div>
        </div>
      </div>
      <div class="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_340px]">
        <div class="overflow-auto rounded-lg border border-grey-200">
          <table class="w-full text-SM">
            <thead class="bg-grey-75 text-left text-XS text-grey-500">
              <tr><th class="p-2">Waktu</th><th class="p-2">Pelaku</th><th class="p-2">Aksi</th><th class="p-2">Item</th></tr>
            </thead>
            <tbody>
              <tr v-for="a in audit" :key="a.id" class="border-t border-grey-100 text-grey-500">
                <td class="whitespace-nowrap p-2 text-XS">{{ formatWaktu(a.waktu) }}</td>
                <td class="p-2">
                  <span class="inline-flex items-center gap-1">
                    <PhRobot v-if="a.pelaku === 'agen'" :size="14" class="text-opensimrs-300" aria-hidden="true" />
                    <PhUser v-else :size="14" class="text-grey-400" aria-hidden="true" />
                    {{ a.pelaku === "agen" ? "Agen AI" : a.pelaku }}
                  </span>
                </td>
                <td class="p-2">{{ a.aksi }}</td>
                <td class="p-2 text-XS font-semibold">
                  <button v-if="a.itemUuid" type="button" class="text-opensimrs-300 underline" @click="router.push(`/studio/item/${a.itemUuid}`)">{{ nomorItem(a.nomor) }}</button>
                  <span v-else>—</span>
                </td>
              </tr>
              <tr v-if="!audit.length"><td colspan="4" class="p-4 text-center text-XS text-grey-300">Belum ada aktivitas.</td></tr>
            </tbody>
          </table>
        </div>
        <div class="h-fit rounded-lg bg-opensimrs-50 p-4">
          <div class="mb-1 font-semibold text-opensimrs-300">Pemakaian agen per item</div>
          <div class="mb-2 text-[11px] text-grey-400">Setara harga API. Dengan langganan Claude, pemakaian dihitung ke kuota, bukan ditagih per token.</div>
          <button
            v-for="b in biaya"
            :key="b.nomor"
            type="button"
            class="flex w-full justify-between gap-2 border-b border-white py-1.5 text-left text-SM text-grey-500"
            @click="router.push(`/studio/item/${b.uuid}`)"
          >
            <span class="truncate">{{ nomorItem(b.nomor) }} · {{ b.judul }}</span><span class="shrink-0 font-mono text-XS">{{ formatUsd(b.biayaUsd) }}</span>
          </button>
          <div class="mt-2 flex justify-between text-SM font-bold text-grey-500">
            <span>Total</span><span>{{ formatUsd(biaya.reduce((t, b) => t + Number(b.biayaUsd), 0)) }}</span>
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>
