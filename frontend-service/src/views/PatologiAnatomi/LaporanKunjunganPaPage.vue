<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import * as XLSX from "xlsx-js-style";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { asalPa, izinPa, keTanggalPa, laporanKunjunganPa, rupiahPa } from "@/stores/penunjang/patologi";

// Laporan Kunjungan Patologi Anatomi: rekap rentang tanggal order per jenis pemeriksaan, per pemeriksaan, per
// pelayanan/sumber & per hari; diagnosis terbanyak (ICD-O morfologi), organ (topografi), beban kerja dokter Sp.PA,
// dan waktu tunggu hasil (TAT, hari: jaringan diterima → laporan diverifikasi) beserta ketepatan terhadap target.
const storeUtils = utilsStore();
const bolehCetak = izinPa("Laporan PA", "CETAK LAPORAN", "Kunjungan");

const awalBulan = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};
const tglMulai = ref<Date | null>(awalBulan());
const tglSelesai = ref<Date | null>(new Date());
const lap = ref<any>(null);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await laporanKunjunganPa(keTanggalPa(tglMulai.value ?? new Date()), keTanggalPa(tglSelesai.value ?? tglMulai.value ?? new Date()));
    lap.value = res?.payload ?? null;
  } finally {
    storeUtils.setLoading(false);
  }
};
const reset = () => {
  tglMulai.value = awalBulan();
  tglSelesai.value = new Date();
  muat();
};

const hari = (n?: number | null) => (n === null || n === undefined ? "-" : `${Number(n).toLocaleString("id-ID", { maximumFractionDigits: 1 })} hari`);
const persen = (a?: number, b?: number) => (b ? `${Math.round(((a ?? 0) / b) * 100)}%` : "-");

const kartu = computed(() => {
  const r = lap.value?.ringkasan ?? {};
  return [
    { label: "Order", nilai: r.jumlahOrder ?? 0 },
    { label: "Pasien", nilai: r.jumlahPasien ?? 0 },
    { label: "Kasus (pemeriksaan)", nilai: r.jumlahKasus ?? 0 },
    { label: "Jaringan diterima", nilai: r.jumlahDiterima ?? 0 },
    { label: "Spesimen ditolak", nilai: r.jumlahDitolak ?? 0 },
    { label: "Dalam proses", nilai: r.dalamProses ?? 0 },
    { label: "Menunggu verifikasi", nilai: r.menungguVerifikasi ?? 0 },
    { label: "Selesai (terverifikasi)", nilai: r.jumlahSelesai ?? 0 },
    { label: "Keganasan (ICD-O /3, /6)", nilai: r.jumlahGanas ?? 0 },
    { label: "CITO", nilai: r.jumlahCito ?? 0 },
    { label: "Belum validasi", nilai: r.belumValidasi ?? 0 },
    { label: "Batal", nilai: r.jumlahBatal ?? 0 },
    { label: "Pendapatan", nilai: rupiahPa(r.pendapatan) },
    { label: "Rerata TAT", nilai: hari(r.rerataTatHari) },
    { label: "Tepat waktu (≤ target)", nilai: persen(r.tepatWaktu, r.jumlahTat) },
  ];
});
const totalJenis = computed(() => (lap.value?.perJenis ?? []).reduce((n: number, r: any) => n + Number(r.jumlah), 0) || 1);

const unduhExcel = () => {
  if (!lap.value) return;
  const wb = XLSX.utils.book_new();
  const lembar = (nama: string, baris: any[]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(baris.length ? baris : [{ Keterangan: "Tidak ada data" }]), nama);
  lembar("Ringkasan", kartu.value.map((k) => ({ Uraian: k.label, Nilai: k.label === "Pendapatan" ? lap.value.ringkasan.pendapatan : k.nilai })));
  lembar("Per Jenis", (lap.value.perJenis ?? []).map((r: any) => ({ Jenis: r.namaJenis, Kasus: r.jumlah, Pasien: r.jumlahPasien, Selesai: r.selesai, Ditolak: r.ditolak, Ganas: r.ganas, "TAT (hari)": r.rerataTatHari, "Tepat waktu": r.tepatWaktu, Pendapatan: r.pendapatan })));
  lembar("Per Pemeriksaan", (lap.value.perPemeriksaan ?? []).map((r: any) => ({ Kode: r.kode, Pemeriksaan: r.nama, Jenis: r.namaJenis, Jumlah: r.jumlah, Selesai: r.selesai, "Target (hari)": r.targetHari, "TAT (hari)": r.rerataTatHari, "Tepat waktu": r.tepatWaktu, Pendapatan: r.pendapatan })));
  lembar("Per Pelayanan", (lap.value.perPelayanan ?? []).map((r: any) => ({ Asal: asalPa(r), Order: r.jumlahOrder, Kasus: r.jumlahKasus, Pendapatan: r.pendapatan })));
  lembar("Diagnosis", (lap.value.perDiagnosis ?? []).map((r: any) => ({ "ICD-O morfologi": r.icdOMorfologi, "ICD-10": r.icd10, Diagnosis: r.contohDiagnosis, Jumlah: r.jumlah, Ganas: r.ganas ? "Ya" : "" })));
  lembar("Organ", (lap.value.perTopografi ?? []).map((r: any) => ({ "ICD-O topografi": r.icdOTopografi, Jumlah: r.jumlah, Ganas: r.ganas })));
  lembar("Dokter Sp.PA", (lap.value.perDokter ?? []).map((r: any) => ({ Dokter: r.dokter, Kasus: r.jumlah, "TAT (hari)": r.rerataTatHari, "Tepat waktu": r.tepatWaktu })));
  lembar("Per Hari", (lap.value.perHari ?? []).map((r: any) => ({ Tanggal: r.tanggal, Order: r.jumlahOrder, Kasus: r.jumlahKasus, Pendapatan: r.pendapatan })));
  XLSX.writeFile(wb, `Laporan Kunjungan PA ${lap.value.tanggalMulai} sd ${lap.value.tanggalSelesai}.xlsx`);
};

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Laporan Kunjungan PA</h1>
          <CustomDatePicker v-model="tglMulai" label="Tanggal mulai" class="toolbar-field--date" :maxDate="tglSelesai ?? undefined" />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker v-model="tglSelesai" label="Tanggal selesai" class="toolbar-field--date" :minDate="tglMulai ?? undefined" />
          <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" @click="muat" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="reset" />
          <CustomButton v-if="bolehCetak" icon="PhFileXls" label="Excel" :disabled="!lap" @click="unduhExcel" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!lap" />
        <div v-else class="flex flex-col gap-5 p-4">
          <div class="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div v-for="k in kartu" :key="k.label" class="p-3 border rounded-lg border-grey-75">
              <div class="text-xs text-grey-400">{{ k.label }}</div>
              <div class="text-lg font-semibold text-opensimrs-400">{{ k.nilai }}</div>
            </div>
          </div>

          <div class="grid gap-5 lg:grid-cols-2">
            <div>
              <div class="mb-2 font-semibold">Per Jenis Pemeriksaan</div>
              <DataTable :value="lap.perJenis" class="text-xs" stripedRows>
                <template #empty>Tidak ada data.</template>
                <Column header="Jenis" headerClass="bg-opensimrs-50">
                  <template #body="{ data: r }">
                    <div>{{ r.namaJenis }}</div>
                    <div class="h-1.5 mt-1 rounded bg-opensimrs-300" :style="{ width: `${Math.max(4, (r.jumlah / totalJenis) * 100)}%` }" />
                  </template>
                </Column>
                <Column field="jumlah" header="Kasus" headerClass="bg-opensimrs-50" />
                <Column field="selesai" header="Selesai" headerClass="bg-opensimrs-50" />
                <Column field="ditolak" header="Ditolak" headerClass="bg-opensimrs-50" />
                <Column field="ganas" header="Ganas" headerClass="bg-opensimrs-50" />
                <Column header="TAT" headerClass="bg-opensimrs-50">
                  <template #body="{ data: r }">{{ hari(r.rerataTatHari) }} <span class="text-grey-400">({{ persen(r.tepatWaktu, r.jumlahTat) }})</span></template>
                </Column>
                <Column header="Pendapatan" headerClass="bg-opensimrs-50">
                  <template #body="{ data: r }">{{ rupiahPa(r.pendapatan) }}</template>
                </Column>
              </DataTable>
            </div>
            <div>
              <div class="mb-2 font-semibold">Per Sumber / Pelayanan</div>
              <DataTable :value="lap.perPelayanan" class="text-xs" stripedRows>
                <template #empty>Tidak ada data.</template>
                <Column header="Asal" headerClass="bg-opensimrs-50">
                  <template #body="{ data: r }">{{ asalPa(r) }}</template>
                </Column>
                <Column field="jumlahOrder" header="Order" headerClass="bg-opensimrs-50" />
                <Column field="jumlahKasus" header="Kasus" headerClass="bg-opensimrs-50" />
                <Column header="Pendapatan" headerClass="bg-opensimrs-50">
                  <template #body="{ data: r }">{{ rupiahPa(r.pendapatan) }}</template>
                </Column>
              </DataTable>
            </div>
            <div>
              <div class="mb-2 font-semibold">Diagnosis Terbanyak <span class="font-normal text-grey-400">(kasus terverifikasi)</span></div>
              <DataTable :value="lap.perDiagnosis" class="text-xs" stripedRows>
                <template #empty>Tidak ada data.</template>
                <Column header="ICD-O" headerClass="bg-opensimrs-50">
                  <template #body="{ data: r }">
                    <span :class="r.ganas ? 'font-semibold text-danger-300' : ''">{{ r.icdOMorfologi }}</span>
                    <div class="text-grey-400">{{ r.icd10 ?? "" }}</div>
                  </template>
                </Column>
                <Column header="Diagnosis" headerClass="bg-opensimrs-50">
                  <template #body="{ data: r }"><div class="max-w-[320px] line-clamp-2">{{ r.contohDiagnosis }}</div></template>
                </Column>
                <Column field="jumlah" header="Jumlah" headerClass="bg-opensimrs-50" />
              </DataTable>
            </div>
            <div class="flex flex-col gap-5">
              <div>
                <div class="mb-2 font-semibold">Beban Kerja Dokter Sp.PA</div>
                <DataTable :value="lap.perDokter" class="text-xs" stripedRows>
                  <template #empty>Tidak ada data.</template>
                  <Column field="dokter" header="Dokter" headerClass="bg-opensimrs-50" />
                  <Column field="jumlah" header="Kasus" headerClass="bg-opensimrs-50" />
                  <Column header="TAT" headerClass="bg-opensimrs-50">
                    <template #body="{ data: r }">{{ hari(r.rerataTatHari) }} <span class="text-grey-400">({{ persen(r.tepatWaktu, r.jumlahTat) }})</span></template>
                  </Column>
                </DataTable>
              </div>
              <div>
                <div class="mb-2 font-semibold">Organ (ICD-O Topografi)</div>
                <DataTable :value="lap.perTopografi" class="text-xs" stripedRows>
                  <template #empty>Tidak ada data.</template>
                  <Column field="icdOTopografi" header="Topografi" headerClass="bg-opensimrs-50" />
                  <Column field="jumlah" header="Kasus" headerClass="bg-opensimrs-50" />
                  <Column field="ganas" header="Ganas" headerClass="bg-opensimrs-50" />
                </DataTable>
              </div>
            </div>
          </div>

          <div>
            <div class="mb-2 font-semibold">Per Pemeriksaan</div>
            <DataTable :value="lap.perPemeriksaan" class="text-xs" stripedRows>
              <template #empty>Tidak ada data.</template>
              <Column header="No." headerClass="bg-opensimrs-50" class="w-[50px]">
                <template #body="{ index }">{{ index + 1 }}</template>
              </Column>
              <Column field="kode" header="Kode" headerClass="bg-opensimrs-50" />
              <Column field="nama" header="Pemeriksaan" headerClass="bg-opensimrs-50" />
              <Column field="namaJenis" header="Jenis" headerClass="bg-opensimrs-50" />
              <Column field="jumlah" header="Jumlah" headerClass="bg-opensimrs-50" />
              <Column field="selesai" header="Selesai" headerClass="bg-opensimrs-50" />
              <Column header="Target / TAT" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ r.targetHari }} hari / {{ hari(r.rerataTatHari) }} <span class="text-grey-400">({{ persen(r.tepatWaktu, r.jumlahTat) }})</span></template>
              </Column>
              <Column header="Pendapatan" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ rupiahPa(r.pendapatan) }}</template>
              </Column>
            </DataTable>
          </div>

          <div>
            <div class="mb-2 font-semibold">Per Hari</div>
            <DataTable :value="lap.perHari" class="text-xs" stripedRows>
              <template #empty>Tidak ada data.</template>
              <Column field="tanggal" header="Tanggal" headerClass="bg-opensimrs-50" />
              <Column field="jumlahOrder" header="Order" headerClass="bg-opensimrs-50" />
              <Column field="jumlahKasus" header="Kasus" headerClass="bg-opensimrs-50" />
              <Column header="Pendapatan" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ rupiahPa(r.pendapatan) }}</template>
              </Column>
            </DataTable>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
