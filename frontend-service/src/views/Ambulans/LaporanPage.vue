<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { JENIS_LAYANAN, epochDariTanggal, izinAmbulans, laporanAmbulans, rupiahAmbulans } from "@/stores/penunjang/ambulans";

// Laporan ambulans: jumlah layanan per jenis, waktu respons, jarak/BBM per armada, & pendapatan (KF-18). Ekspor
// diunduh sebagai CSV di sisi klien karena penunjang-service belum memakai dependensi pembuat Excel (exceljs).
const storeUtils = utilsStore();
const bolehEkspor = izinAmbulans("Laporan Ambulans", "EKSPOR");

const awalBulan = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};
const tanggalMulai = ref<Date>(awalBulan());
const tanggalSelesai = ref<Date>(new Date());
const laporan = ref<any>(null);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await laporanAmbulans({ tanggal_mulai: epochDariTanggal(tanggalMulai.value)!, tanggal_selesai: epochDariTanggal(tanggalSelesai.value)! });
    laporan.value = res?.payload ?? null;
  } finally {
    storeUtils.setLoading(false);
  }
};
onMounted(muat);

const jamMenit = (detik?: number | null) => {
  if (!detik || detik <= 0) return "-";
  const n = Math.round(detik);
  const j = Math.floor(n / 3600);
  const m = Math.round((n % 3600) / 60);
  return j > 0 ? `${j} jam ${m} mnt` : `${m} mnt`;
};

// Ekspor CSV sisi klien sesuai filter & isolasi faskes yang sama dengan tampilan laporan (KF-19).
const eksporCsv = () => {
  if (!laporan.value) return;
  const baris: string[] = [];
  const kutip = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  baris.push("Rekap Layanan per Jenis");
  baris.push(["Jenis Layanan", "Jumlah", "Selesai", "Batal"].map(kutip).join(","));
  for (const r of laporan.value.perJenisLayanan ?? []) baris.push([JENIS_LAYANAN[r.jenisLayanan] ?? r.jenisLayanan, r.jumlah, r.selesai, r.batal].map(kutip).join(","));
  baris.push("");
  baris.push("Rekap per Armada");
  baris.push(["Nomor Polisi", "Jenis", "Jumlah Perjalanan", "Total Jarak (km)", "Total BBM", "Pendapatan"].map(kutip).join(","));
  for (const r of laporan.value.perArmada ?? [])
    baris.push([r.nomorPolisi, JENIS_LAYANAN[r.jenis] ?? r.jenis, r.jumlahPerjalanan, r.totalJarakKm, r.totalBbm, r.pendapatan].map(kutip).join(","));
  baris.push("");
  baris.push(["Rata-rata Waktu Tunggu Penugasan (detik)", laporan.value.waktuRespons?.rataRataTungguPenugasan ?? ""].map(kutip).join(","));
  baris.push(["Rata-rata Waktu Respons (detik)", laporan.value.waktuRespons?.rataRataWaktuRespons ?? ""].map(kutip).join(","));
  baris.push(["Total Tertagih", laporan.value.pendapatan?.totalTertagih ?? 0].map(kutip).join(","));
  baris.push(["Total Kuitansi", laporan.value.pendapatan?.totalKuitansi ?? 0].map(kutip).join(","));

  const blob = new Blob(["﻿" + baris.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `laporan-ambulans-${epochDariTanggal(tanggalMulai.value)}-${epochDariTanggal(tanggalSelesai.value)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};
</script>

<template>
  <div class="flex flex-col h-full overflow-auto">
    <Card pt:body:class="pt-0">
      <template #header>
        <PageToolbar>
          <h1 class="toolbar-heading text-opensimrs-300">Laporan Ambulans</h1>
          <CustomDatePicker v-model="tanggalMulai" label="Dari Tanggal" />
          <CustomDatePicker v-model="tanggalSelesai" label="Sampai Tanggal" />
          <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" @click="muat" />
          <CustomButton v-if="bolehEkspor" icon="PhArrowDown" label="Ekspor CSV" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="eksporCsv" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!laporan" />
        <div v-else class="flex flex-col gap-4 p-4">
          <div class="grid grid-cols-3 gap-3">
            <div class="p-3 border rounded-lg border-grey-100">
              <div class="text-xs text-grey-400">Rata-rata Waktu Respons</div>
              <div class="text-lg font-semibold">{{ jamMenit(laporan.waktuRespons?.rataRataWaktuRespons) }}</div>
            </div>
            <div class="p-3 border rounded-lg border-grey-100">
              <div class="text-xs text-grey-400">Rata-rata Waktu Tunggu Penugasan</div>
              <div class="text-lg font-semibold">{{ jamMenit(laporan.waktuRespons?.rataRataTungguPenugasan) }}</div>
            </div>
            <div class="p-3 border rounded-lg border-grey-100">
              <div class="text-xs text-grey-400">Pendapatan (Tertagih + Kuitansi)</div>
              <div class="text-lg font-semibold">{{ rupiahAmbulans((laporan.pendapatan?.totalTertagih ?? 0) + (laporan.pendapatan?.totalKuitansi ?? 0)) }}</div>
            </div>
          </div>

          <div>
            <h3 class="mb-2 text-sm font-semibold">Jumlah Layanan per Jenis</h3>
            <NoData v-if="!laporan.perJenisLayanan?.length" />
            <DataTable v-else :value="laporan.perJenisLayanan" stripedRows class="text-xs">
              <Column header="Jenis Layanan" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ JENIS_LAYANAN[r.jenisLayanan] ?? r.jenisLayanan }}</template>
              </Column>
              <Column field="jumlah" header="Jumlah" headerClass="bg-opensimrs-50" />
              <Column field="selesai" header="Selesai" headerClass="bg-opensimrs-50" />
              <Column field="batal" header="Batal" headerClass="bg-opensimrs-50" />
            </DataTable>
          </div>

          <div>
            <h3 class="mb-2 text-sm font-semibold">Jarak, BBM & Pendapatan per Armada</h3>
            <NoData v-if="!laporan.perArmada?.length" />
            <DataTable v-else :value="laporan.perArmada" stripedRows class="text-xs">
              <Column field="nomorPolisi" header="Nomor Polisi" headerClass="bg-opensimrs-50" />
              <Column header="Jenis" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ JENIS_LAYANAN[r.jenis] ?? r.jenis }}</template>
              </Column>
              <Column field="jumlahPerjalanan" header="Jumlah Perjalanan" headerClass="bg-opensimrs-50" />
              <Column header="Total Jarak" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ r.totalJarakKm }} km</template>
              </Column>
              <Column header="Total BBM" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ r.totalBbm }}</template>
              </Column>
              <Column header="Pendapatan" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ rupiahAmbulans(r.pendapatan) }}</template>
              </Column>
            </DataTable>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
