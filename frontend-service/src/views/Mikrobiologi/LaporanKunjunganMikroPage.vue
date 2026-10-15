<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import * as XLSX from "xlsx-js-style";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { PELAYANAN_MIKRO, izinMikro, keTanggal, laporanKunjunganMikro, namaSpesimen, rupiahMikro } from "@/stores/penunjang/mikrobiologi";

// Laporan Kunjungan Mikrobiologi (tanggal order): jumlah order/pasien/spesimen, final/sementara/ditolak, positivitas
// kultur, TAT rata-rata (hari, terima → final) & jumlah yang melewati target TAT, per pemeriksaan, per jenis spesimen,
// organisme terbanyak, penanda resistensi, per pelayanan & per hari. Pendapatan = tarif item order tervalidasi.
const storeUtils = utilsStore();
const bolehCetak = izinMikro("Laporan Mikrobiologi", "CETAK LAPORAN", "Kunjungan");

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
    const res = await laporanKunjunganMikro(keTanggal(tglMulai.value ?? new Date()), keTanggal(tglSelesai.value ?? tglMulai.value ?? new Date()));
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

const persen = (a?: number, b?: number) => (b ? `${Math.round(((a ?? 0) / b) * 100)}%` : "-");
const hari = (n?: number | null) => (n === null || n === undefined ? "-" : `${n} hari`);
const kartu = computed(() => {
  const r = lap.value?.ringkasan ?? {};
  return [
    { label: "Order", nilai: r.jumlahOrder ?? 0 },
    { label: "Pasien", nilai: r.jumlahPasien ?? 0 },
    { label: "Pemeriksaan (spesimen)", nilai: r.jumlahPemeriksaan ?? 0 },
    { label: "Hasil final", nilai: r.jumlahFinal ?? 0 },
    { label: "Laporan sementara", nilai: r.jumlahSementara ?? 0 },
    { label: "Dalam proses", nilai: r.jumlahProses ?? 0 },
    { label: "Spesimen ditolak", nilai: r.jumlahDitolak ?? 0 },
    { label: "Order batal", nilai: r.jumlahBatal ?? 0 },
    { label: "Positivitas kultur", nilai: `${persen(r.kulturPositif, r.kulturSelesai)} (${r.kulturPositif ?? 0}/${r.kulturSelesai ?? 0})` },
    { label: "Kontaminan", nilai: r.kulturKontaminan ?? 0 },
    { label: "Rerata TAT (terima → final)", nilai: hari(r.rerataTatHari) },
    { label: "Melewati target TAT", nilai: r.melewatiTat ?? 0 },
    { label: "CITO", nilai: r.jumlahCito ?? 0 },
    { label: "Belum validasi", nilai: r.belumValidasi ?? 0 },
    { label: "Pendapatan", nilai: rupiahMikro(r.pendapatan) },
  ];
});
const totalOrganisme = computed(() => Math.max(...(lap.value?.organismeTerbanyak ?? []).map((r: any) => Number(r.jumlah)), 1));

const unduhExcel = () => {
  if (!lap.value) return;
  const wb = XLSX.utils.book_new();
  const lembar = (nama: string, baris: any[]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(baris.length ? baris : [{ Keterangan: "Tidak ada data" }]), nama);
  lembar("Ringkasan", kartu.value.map((k) => ({ Uraian: k.label, Nilai: k.label === "Pendapatan" ? lap.value.ringkasan.pendapatan : k.nilai })));
  lembar("Per Pemeriksaan", (lap.value.perPemeriksaan ?? []).map((r: any) => ({
    Kode: r.kode, Pemeriksaan: r.nama, Jumlah: r.jumlah, Final: r.final, Ditolak: r.ditolak, "Kultur selesai": r.kulturSelesai, "Kultur positif": r.kulturPositif,
    "TAT rata-rata (hari)": r.rerataTatHari, "Target TAT (hari)": r.tatTarget, Pendapatan: r.pendapatan,
  })));
  lembar("Per Spesimen", (lap.value.perSpesimen ?? []).map((r: any) => ({ Spesimen: r.namaSpesimen, Jumlah: r.jumlah, Ditolak: r.ditolak, "Kultur selesai": r.kulturSelesai, "Kultur positif": r.kulturPositif, Kontaminan: r.kulturKontaminan })));
  lembar("Organisme", (lap.value.organismeTerbanyak ?? []).map((r: any) => ({ Organisme: r.nama, Kelompok: r.namaKelompok, Isolat: r.jumlah })));
  lembar("Penanda Resistensi", (lap.value.penandaResistensi ?? []).map((r: any) => ({ Penanda: r.penanda, Nama: r.nama, Isolat: r.jumlah })));
  lembar("Per Pelayanan", (lap.value.perPelayanan ?? []).map((r: any) => ({ Pelayanan: PELAYANAN_MIKRO[r.pelayanan] ?? r.pelayanan, Order: r.jumlahOrder, Pemeriksaan: r.jumlahPemeriksaan, Pendapatan: r.pendapatan })));
  lembar("Per Hari", (lap.value.perHari ?? []).map((r: any) => ({ Tanggal: r.tanggal, Order: r.jumlahOrder, Pemeriksaan: r.jumlahPemeriksaan, Pendapatan: r.pendapatan })));
  XLSX.writeFile(wb, `Laporan Kunjungan Mikrobiologi ${lap.value.tanggalMulai} sd ${lap.value.tanggalSelesai}.xlsx`);
};

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Laporan Kunjungan Mikrobiologi</h1>
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

          <div>
            <div class="mb-2 font-semibold">Per Pemeriksaan</div>
            <DataTable :value="lap.perPemeriksaan" class="text-xs" stripedRows>
              <template #empty>Tidak ada data.</template>
              <Column field="kode" header="Kode" headerClass="bg-opensimrs-50" />
              <Column field="nama" header="Pemeriksaan" headerClass="bg-opensimrs-50" />
              <Column field="jumlah" header="Jumlah" headerClass="bg-opensimrs-50" />
              <Column field="final" header="Final" headerClass="bg-opensimrs-50" />
              <Column field="ditolak" header="Ditolak" headerClass="bg-opensimrs-50" />
              <Column header="Kultur positif" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ r.kulturSelesai ? `${r.kulturPositif}/${r.kulturSelesai} (${persen(r.kulturPositif, r.kulturSelesai)})` : "-" }}</template>
              </Column>
              <Column header="TAT rata-rata / target" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">
                  <span :class="r.rerataTatHari != null && r.rerataTatHari > r.tatTarget ? 'text-danger-300 font-semibold' : ''">{{ hari(r.rerataTatHari) }}</span>
                  / {{ r.tatTarget }} hari
                </template>
              </Column>
              <Column header="Pendapatan" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ rupiahMikro(r.pendapatan) }}</template>
              </Column>
            </DataTable>
          </div>

          <div class="grid gap-5 lg:grid-cols-2">
            <div>
              <div class="mb-2 font-semibold">Per Jenis Spesimen</div>
              <DataTable :value="lap.perSpesimen" class="text-xs" stripedRows>
                <template #empty>Tidak ada data.</template>
                <Column header="Spesimen" headerClass="bg-opensimrs-50">
                  <template #body="{ data: r }">{{ namaSpesimen(r.jenisSpesimen) }}</template>
                </Column>
                <Column field="jumlah" header="Jumlah" headerClass="bg-opensimrs-50" />
                <Column field="ditolak" header="Ditolak" headerClass="bg-opensimrs-50" />
                <Column header="Positif" headerClass="bg-opensimrs-50">
                  <template #body="{ data: r }">{{ r.kulturSelesai ? `${r.kulturPositif}/${r.kulturSelesai}` : "-" }}</template>
                </Column>
                <Column field="kulturKontaminan" header="Kontaminan" headerClass="bg-opensimrs-50" />
              </DataTable>
            </div>
            <div>
              <div class="mb-2 font-semibold">Organisme Terbanyak <span class="font-normal text-grey-400">(isolat hasil final)</span></div>
              <DataTable :value="lap.organismeTerbanyak" class="text-xs" stripedRows>
                <template #empty>Belum ada isolat.</template>
                <Column header="Organisme" headerClass="bg-opensimrs-50">
                  <template #body="{ data: r }">
                    <i>{{ r.nama }}</i>
                    <div class="h-1.5 mt-1 rounded bg-opensimrs-300" :style="{ width: `${Math.max(4, (r.jumlah / totalOrganisme) * 100)}%` }" />
                  </template>
                </Column>
                <Column field="namaKelompok" header="Kelompok" headerClass="bg-opensimrs-50" />
                <Column field="jumlah" header="Isolat" headerClass="bg-opensimrs-50" />
              </DataTable>
            </div>
            <div>
              <div class="mb-2 font-semibold">Penanda Resistensi</div>
              <DataTable :value="lap.penandaResistensi" class="text-xs" stripedRows>
                <template #empty>Tidak ada.</template>
                <Column header="Penanda" headerClass="bg-opensimrs-50">
                  <template #body="{ data: r }"><b class="text-danger-300">{{ r.penanda }}</b> — {{ r.nama }}</template>
                </Column>
                <Column field="jumlah" header="Isolat" headerClass="bg-opensimrs-50" />
              </DataTable>
            </div>
            <div>
              <div class="mb-2 font-semibold">Per Pelayanan</div>
              <DataTable :value="lap.perPelayanan" class="text-xs" stripedRows>
                <template #empty>Tidak ada data.</template>
                <Column header="Pelayanan" headerClass="bg-opensimrs-50">
                  <template #body="{ data: r }">{{ PELAYANAN_MIKRO[r.pelayanan] ?? r.pelayanan }}</template>
                </Column>
                <Column field="jumlahOrder" header="Order" headerClass="bg-opensimrs-50" />
                <Column field="jumlahPemeriksaan" header="Pemeriksaan" headerClass="bg-opensimrs-50" />
                <Column header="Pendapatan" headerClass="bg-opensimrs-50">
                  <template #body="{ data: r }">{{ rupiahMikro(r.pendapatan) }}</template>
                </Column>
              </DataTable>
            </div>
          </div>

          <div>
            <div class="mb-2 font-semibold">Per Hari</div>
            <DataTable :value="lap.perHari" class="text-xs" stripedRows>
              <template #empty>Tidak ada data.</template>
              <Column field="tanggal" header="Tanggal" headerClass="bg-opensimrs-50" />
              <Column field="jumlahOrder" header="Order" headerClass="bg-opensimrs-50" />
              <Column field="jumlahPemeriksaan" header="Pemeriksaan" headerClass="bg-opensimrs-50" />
              <Column header="Pendapatan" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ rupiahMikro(r.pendapatan) }}</template>
              </Column>
            </DataTable>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
