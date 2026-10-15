<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import * as XLSX from "xlsx-js-style";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { PELAYANAN_RAD, keTanggal, laporanKunjunganRad, rupiahRad } from "@/stores/penunjang/radiologi";

// Laporan Kunjungan Radiologi: rekap rentang tanggal order per modalitas, per ruang/alat, per pemeriksaan, per pelayanan
// & per hari, utilisasi jadwal per ruang (tanggal jadwal), dan waktu tunggu hasil (TAT: validasi → expertise).
// Pendapatan = tarif item order tervalidasi yang ditagihkan (order MCU tanpa tagihan dihitung jumlahnya saja).
const storeUtils = utilsStore();

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
    const res = await laporanKunjunganRad(keTanggal(tglMulai.value ?? new Date()), keTanggal(tglSelesai.value ?? tglMulai.value ?? new Date()));
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

const kartu = computed(() => {
  const r = lap.value?.ringkasan ?? {};
  return [
    { label: "Order", nilai: r.jumlahOrder ?? 0 },
    { label: "Pasien", nilai: r.jumlahPasien ?? 0 },
    { label: "Pemeriksaan", nilai: r.jumlahPemeriksaan ?? 0 },
    { label: "Selesai (expertise)", nilai: r.jumlahSelesai ?? 0 },
    { label: "CITO", nilai: r.jumlahCito ?? 0 },
    { label: "Belum validasi", nilai: r.belumValidasi ?? 0 },
    { label: "Batal", nilai: r.jumlahBatal ?? 0 },
    { label: "Pendapatan", nilai: rupiahRad(r.pendapatan) },
    { label: "Rerata waktu tunggu hasil", nilai: menit(r.rerataTatMenit) },
    { label: "Rerata periksa → expertise", nilai: menit(r.rerataBacaMenit) },
  ];
});
// Menit → "x jam y mnt" (null = belum ada data).
function menit(n?: number | null) {
  if (n === null || n === undefined) return "-";
  const m = Math.round(Number(n));
  return m >= 60 ? `${Math.floor(m / 60)} jam ${m % 60} mnt` : `${m} mnt`;
}
const totalModalitas = computed(() => (lap.value?.perModalitas ?? []).reduce((n: number, r: any) => n + Number(r.jumlah), 0) || 1);

const unduhExcel = () => {
  if (!lap.value) return;
  const wb = XLSX.utils.book_new();
  const lembar = (nama: string, baris: any[]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(baris), nama);
  lembar("Ringkasan", kartu.value.map((k) => ({ Uraian: k.label, Nilai: k.label === "Pendapatan" ? lap.value.ringkasan.pendapatan : k.nilai })));
  lembar("Per Modalitas", (lap.value.perModalitas ?? []).map((r: any) => ({ Modalitas: `${r.modalitas} - ${r.namaModalitas}`, Pemeriksaan: r.jumlah, Pasien: r.jumlahPasien, Pendapatan: r.pendapatan })));
  lembar("Per Ruang", (lap.value.perRuang ?? []).map((r: any) => ({ Ruang: r.nama ?? "Belum ditentukan", Alat: r.namaAlat ?? "", Pemeriksaan: r.jumlah, Pasien: r.jumlahPasien, Selesai: r.selesai, "TAT (menit)": r.rerataTatMenit, Pendapatan: r.pendapatan })));
  lembar("Jadwal per Ruang", (lap.value.jadwalPerRuang ?? []).map((r: any) => ({ Ruang: r.nama, Jadwal: r.jumlahJadwal, Terjadwal: r.terjadwal, Hadir: r.hadir, Diperiksa: r.diperiksa, Batal: r.batal, Segera: r.segera, "Selisih hadir (menit)": r.rerataSelisihHadirMenit })));
  lembar("Per Pemeriksaan", (lap.value.perPemeriksaan ?? []).map((r: any) => ({ Kode: r.kode, Pemeriksaan: r.nama, Modalitas: r.modalitas, Jumlah: r.jumlah, Selesai: r.selesai, Pendapatan: r.pendapatan })));
  lembar("Per Pelayanan", (lap.value.perPelayanan ?? []).map((r: any) => ({ Pelayanan: PELAYANAN_RAD[r.pelayanan] ?? r.pelayanan, Order: r.jumlahOrder, Pemeriksaan: r.jumlahPemeriksaan, Pendapatan: r.pendapatan })));
  lembar("Per Hari", (lap.value.perHari ?? []).map((r: any) => ({ Tanggal: r.tanggal, Order: r.jumlahOrder, Pemeriksaan: r.jumlahPemeriksaan, Pendapatan: r.pendapatan })));
  XLSX.writeFile(wb, `Laporan Kunjungan Radiologi ${lap.value.tanggalMulai} sd ${lap.value.tanggalSelesai}.xlsx`);
};

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Laporan Kunjungan Radiologi</h1>
          <CustomDatePicker v-model="tglMulai" label="Tanggal mulai" class="toolbar-field--date" :maxDate="tglSelesai ?? undefined" />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker v-model="tglSelesai" label="Tanggal selesai" class="toolbar-field--date" :minDate="tglMulai ?? undefined" />
          <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" @click="muat" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="reset" />
          <CustomButton icon="PhFileXls" label="Excel" :disabled="!lap" @click="unduhExcel" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!lap" />
        <div v-else class="flex flex-col gap-5 p-4">
          <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div v-for="k in kartu" :key="k.label" class="p-3 border rounded-lg border-grey-75">
              <div class="text-xs text-grey-400">{{ k.label }}</div>
              <div class="text-lg font-semibold text-opensimrs-400">{{ k.nilai }}</div>
            </div>
          </div>

          <div class="grid gap-5 lg:grid-cols-2">
            <div>
              <div class="mb-2 font-semibold">Per Modalitas</div>
              <DataTable :value="lap.perModalitas" class="text-xs" stripedRows>
                <template #empty>Tidak ada data.</template>
                <Column header="Modalitas" headerClass="bg-opensimrs-50">
                  <template #body="{ data: r }">
                    <div>{{ r.modalitas }} · {{ r.namaModalitas }}</div>
                    <div class="h-1.5 mt-1 rounded bg-opensimrs-300" :style="{ width: `${Math.max(4, (r.jumlah / totalModalitas) * 100)}%` }" />
                  </template>
                </Column>
                <Column field="jumlah" header="Pemeriksaan" headerClass="bg-opensimrs-50" />
                <Column field="jumlahPasien" header="Pasien" headerClass="bg-opensimrs-50" />
                <Column header="Waktu tunggu hasil" headerClass="bg-opensimrs-50">
                  <template #body="{ data: r }">{{ menit(r.rerataTatMenit) }}</template>
                </Column>
                <Column header="Pendapatan" headerClass="bg-opensimrs-50">
                  <template #body="{ data: r }">{{ rupiahRad(r.pendapatan) }}</template>
                </Column>
              </DataTable>
            </div>
            <div>
              <div class="mb-2 font-semibold">Per Ruang / Alat</div>
              <DataTable :value="lap.perRuang" class="text-xs" stripedRows>
                <template #empty>Tidak ada data.</template>
                <Column header="Ruang" headerClass="bg-opensimrs-50">
                  <template #body="{ data: r }">
                    <div>{{ r.nama ?? "Belum ditentukan" }}</div>
                    <div class="text-grey-400">{{ r.namaAlat ?? "" }}</div>
                  </template>
                </Column>
                <Column field="jumlah" header="Pemeriksaan" headerClass="bg-opensimrs-50" />
                <Column field="selesai" header="Selesai" headerClass="bg-opensimrs-50" />
                <Column header="Waktu tunggu hasil" headerClass="bg-opensimrs-50">
                  <template #body="{ data: r }">{{ menit(r.rerataTatMenit) }}</template>
                </Column>
                <Column header="Pendapatan" headerClass="bg-opensimrs-50">
                  <template #body="{ data: r }">{{ rupiahRad(r.pendapatan) }}</template>
                </Column>
              </DataTable>
            </div>
            <div>
              <div class="mb-2 font-semibold">Penjadwalan per Ruang <span class="font-normal text-grey-400">(tanggal jadwal)</span></div>
              <DataTable :value="lap.jadwalPerRuang" class="text-xs" stripedRows>
                <template #empty>Tidak ada jadwal.</template>
                <Column field="nama" header="Ruang" headerClass="bg-opensimrs-50" />
                <Column field="jumlahJadwal" header="Jadwal" headerClass="bg-opensimrs-50" />
                <Column field="hadir" header="Hadir" headerClass="bg-opensimrs-50" />
                <Column field="diperiksa" header="Diperiksa" headerClass="bg-opensimrs-50" />
                <Column field="terjadwal" header="Belum datang" headerClass="bg-opensimrs-50" />
                <Column field="batal" header="Batal" headerClass="bg-opensimrs-50" />
                <Column field="segera" header="Segera" headerClass="bg-opensimrs-50" />
              </DataTable>
            </div>
            <div>
              <div class="mb-2 font-semibold">Per Pelayanan</div>
              <DataTable :value="lap.perPelayanan" class="text-xs" stripedRows>
                <template #empty>Tidak ada data.</template>
                <Column header="Pelayanan" headerClass="bg-opensimrs-50">
                  <template #body="{ data: r }">{{ PELAYANAN_RAD[r.pelayanan] ?? r.pelayanan }}</template>
                </Column>
                <Column field="jumlahOrder" header="Order" headerClass="bg-opensimrs-50" />
                <Column field="jumlahPemeriksaan" header="Pemeriksaan" headerClass="bg-opensimrs-50" />
                <Column header="Pendapatan" headerClass="bg-opensimrs-50">
                  <template #body="{ data: r }">{{ rupiahRad(r.pendapatan) }}</template>
                </Column>
              </DataTable>
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
              <Column field="modalitas" header="Modalitas" headerClass="bg-opensimrs-50" />
              <Column field="jumlah" header="Jumlah" headerClass="bg-opensimrs-50" />
              <Column field="selesai" header="Selesai" headerClass="bg-opensimrs-50" />
              <Column header="Pendapatan" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ rupiahRad(r.pendapatan) }}</template>
              </Column>
            </DataTable>
          </div>

          <div>
            <div class="mb-2 font-semibold">Per Hari</div>
            <DataTable :value="lap.perHari" class="text-xs" stripedRows>
              <template #empty>Tidak ada data.</template>
              <Column field="tanggal" header="Tanggal" headerClass="bg-opensimrs-50" />
              <Column field="jumlahOrder" header="Order" headerClass="bg-opensimrs-50" />
              <Column field="jumlahPemeriksaan" header="Pemeriksaan" headerClass="bg-opensimrs-50" />
              <Column header="Pendapatan" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ rupiahRad(r.pendapatan) }}</template>
              </Column>
            </DataTable>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
