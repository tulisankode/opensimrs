<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import * as XLSX from "xlsx";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { rupiah, waktuAk } from "@/stores/penunjang/akuntansi";
import { daftarPeriodeRemun, izinRemunerasi, rekapRemunerasi, slipPenerima } from "@/stores/penunjang/remunerasi";
import SlipRincian from "./SlipRincian.vue";

// Rekap remunerasi per unit & profesi + rincian penerima (STD-0032), hanya periode disetujui/dibayar. Ekspor xlsx/csv
// dibuat di klien dari data yang sama; permintaan data ekspor membawa ?ekspor= sehingga izin EKSPOR diperiksa dan
// tercatat di Audit Trail. Tim remunerasi dapat membuka slip penerima (tanpa identitas pasien).
const storeUtils = utilsStore();
const bolehEkspor = izinRemunerasi("rekap", "EKSPOR");
const periode = ref<any[]>([]);
const pilih = ref("");
const data = ref<any>(null);
const opsi = computed(() => periode.value.filter((p) => ["disetujui", "dibayar"].includes(p.status)).map((p) => ({ uuid: p.uuid, label: `${p.nama} (${p.status})` })));

const muat = async (ekspor?: string) => {
  if (!pilih.value) return null;
  storeUtils.setLoading(true);
  try {
    const r = await rekapRemunerasi(pilih.value, ekspor);
    if (r?.payload) data.value = r.payload;
    return r?.payload ?? null;
  } finally {
    storeUtils.setLoading(false);
  }
};
const baris = (d: any) => [
  ["Penerima", "Profesi", "Unit", "Jumlah layanan", "Nilai dasar", "Jasa langsung", "Jasa kebersamaan", "Koreksi", "Total"],
  ...d.rincian.map((r: any) => [r.nama, r.namaProfesi, r.unit ?? "", r.jumlahLayanan, Number(r.nilaiDasar), Number(r.langsung), Number(r.kebersamaan), Number(r.koreksi), Number(r.total)]),
];
const nama = (d: any) => `rekap-jaspel-${d.periode.nomor}`;
const unduh = (isi: string, berkas: string) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([isi], { type: "text/csv;charset=utf-8" }));
  a.download = berkas;
  a.click();
  URL.revokeObjectURL(a.href);
};
const eksporExcel = async () => {
  const d = await muat("xlsx");
  if (!d) return;
  const buku = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(buku, XLSX.utils.aoa_to_sheet(baris(d)), "Penerima");
  XLSX.utils.book_append_sheet(buku, XLSX.utils.aoa_to_sheet([["Unit", "Penerima", "Layanan", "Langsung", "Kebersamaan", "Koreksi", "Total"], ...d.perUnit.map((g: any) => [g.nama, g.jumlahPenerima, g.jumlahLayanan, Number(g.langsung), Number(g.kebersamaan), Number(g.koreksi), Number(g.total)])]), "Per Unit");
  XLSX.utils.book_append_sheet(buku, XLSX.utils.aoa_to_sheet([["Profesi", "Penerima", "Layanan", "Langsung", "Kebersamaan", "Koreksi", "Total"], ...d.perProfesi.map((g: any) => [g.nama, g.jumlahPenerima, g.jumlahLayanan, Number(g.langsung), Number(g.kebersamaan), Number(g.koreksi), Number(g.total)])]), "Per Profesi");
  XLSX.writeFile(buku, `${nama(d)}.xlsx`);
};
const eksporCsv = async () => {
  const d = await muat("csv");
  if (!d) return;
  const sel = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  unduh("﻿" + baris(d).map((r: any[]) => r.map(sel).join(";")).join("\r\n"), `${nama(d)}.csv`);
};

const dialog = ref(false);
const slip = ref<any>(null);
const bukaSlip = async (r: any) => {
  storeUtils.setLoading(true);
  try {
    slip.value = (await slipPenerima(pilih.value, r.practitionerUuid))?.payload ?? null;
    dialog.value = !!slip.value;
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(async () => {
  periode.value = (await daftarPeriodeRemun())?.payload ?? [];
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat()" />
          <h1 class="toolbar-heading text-opensimrs-300">Rekap Remunerasi</h1>
          <CustomSelect v-model="pilih" label="Periode (disetujui)" :options="opsi" optionValue="uuid" optionLabel="label" :showFilter="false" @update:modelValue="muat()" />
          <CustomButton v-if="bolehEkspor && data" icon="PhFileXls" label="Excel" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="eksporExcel" />
          <CustomButton v-if="bolehEkspor && data" icon="PhFileCsv" label="CSV" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="eksporCsv" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data" />
        <div v-else class="flex flex-col gap-4">
          <div class="text-xs text-grey-400">
            {{ data.periode.nama }} · skema v{{ data.periode.skemaVersi }} · disetujui {{ data.periode.disetujuiOleh }} {{ waktuAk(data.periode.disetujuiPada) }} · total Rp {{ rupiah(data.periode.total) }}
          </div>
          <div class="grid grid-cols-2 gap-4">
            <DataTable :value="data.perUnit" stripedRows class="text-xs">
              <Column header="Unit" field="nama" headerClass="bg-opensimrs-50" />
              <Column header="Penerima" field="jumlahPenerima" headerClass="bg-opensimrs-50" />
              <Column header="Total" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: g }">{{ rupiah(g.total) }}</template></Column>
            </DataTable>
            <DataTable :value="data.perProfesi" stripedRows class="text-xs">
              <Column header="Profesi" field="nama" headerClass="bg-opensimrs-50" />
              <Column header="Penerima" field="jumlahPenerima" headerClass="bg-opensimrs-50" />
              <Column header="Total" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: g }">{{ rupiah(g.total) }}</template></Column>
            </DataTable>
          </div>
          <DataTable :value="data.rincian" stripedRows class="text-xs cursor-pointer" @rowClick="bukaSlip($event.data)">
            <Column header="Penerima" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ r.nama }}<div class="text-[11px] text-grey-400">{{ r.namaProfesi }}</div></template></Column>
            <Column header="Unit" field="unit" headerClass="bg-opensimrs-50" />
            <Column header="Layanan" field="jumlahLayanan" headerClass="bg-opensimrs-50" />
            <Column header="Langsung" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: r }">{{ rupiah(r.langsung) }}</template></Column>
            <Column header="Kebersamaan" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: r }">{{ rupiah(r.kebersamaan) }}</template></Column>
            <Column header="Koreksi" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: r }">{{ rupiah(r.koreksi) }}</template></Column>
            <Column header="Total" headerClass="bg-opensimrs-50" bodyClass="text-right font-semibold"><template #body="{ data: r }">{{ rupiah(r.total) }}</template></Column>
          </DataTable>
        </div>
      </template>
    </Card>
    <CustomDialog v-model:visible="dialog" width="1000px">
      <template #header>Slip Jasa Pelayanan</template>
      <template #body><div class="pt-4"><SlipRincian v-if="slip" :slip="slip" /></div></template>
      <template #footer>
        <div class="flex justify-end"><CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" /></div>
      </template>
    </CustomDialog>
  </div>
</template>
