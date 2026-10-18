<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import * as XLSX from "xlsx";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { keTanggal } from "@/stores/penunjang/radiologi";
import {
  PERISTIWA_UNIT,
  POSISI_UNIT,
  epochAkhirHari,
  epochAwalHari,
  gayaSiklusUnit,
  gayaStatusUnit,
  izinLaundry,
  laporanUnitLaundry,
  posisiUnit,
  referensiUnitLaundry,
  waktuLaundry,
} from "@/stores/penunjang/laundry";

// Laporan unit linen (STD-0030): riwayat perjalanan per unit, unit hilang/rusak/dimusnahkan per ruangan terakhir,
// unit mendekati/mencapai batas umur pakai, dan perputaran (hanya perpindahan tersimpan — pindai yang ditolak tidak
// pernah tercatat). Ekspor Excel memerlukan izin CETAK LAPORAN.
const storeUtils = utilsStore();
const bolehEkspor = izinLaundry("Laporan Unit", "CETAK LAPORAN");
const tab = ref("status");
const tglMulai = ref<Date | null>(new Date(Date.now() - 29 * 86400 * 1000));
const tglSelesai = ref<Date | null>(new Date());
const ruangan = ref<any[]>([]);
const jenis = ref<any[]>([]);
const opsiRuangan = computed(() => [{ value: "", label: "Semua ruangan" }, ...ruangan.value.map((r) => ({ value: r.uuid, label: r.nama }))]);
const opsiJenis = computed(() => [{ value: "", label: "Semua jenis" }, ...jenis.value.filter((j) => j.caraPencatatan === "per_unit").map((j) => ({ value: j.uuid, label: j.nama }))]);
const filter = ref({ lokasiUuid: "", jenisLinenUuid: "", status: "", ambang: "", kode: "" });
const periode = () => ({ dari: epochAwalHari(tglMulai.value), sampai: epochAkhirHari(tglSelesai.value) });

const riwayat = ref<any>(null);
const status = ref<any>({ ringkasan: [], unit: [] });
const siklus = ref<any[]>([]);
const perputaran = ref<any[]>([]);
const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const f = filter.value;
    if (tab.value === "riwayat") riwayat.value = f.kode.trim() ? ((await laporanUnitLaundry("riwayat", { kode: f.kode.trim(), ...periode() }))?.payload ?? null) : null;
    if (tab.value === "status") status.value = (await laporanUnitLaundry("status", { status: f.status, lokasi_uuid: f.lokasiUuid, jenis_linen_uuid: f.jenisLinenUuid, ...periode() }))?.payload ?? { ringkasan: [], unit: [] };
    if (tab.value === "siklus") siklus.value = (await laporanUnitLaundry("siklus", { ambang: f.ambang, lokasi_uuid: f.lokasiUuid, jenis_linen_uuid: f.jenisLinenUuid }))?.payload ?? [];
    if (tab.value === "perputaran") perputaran.value = (await laporanUnitLaundry("perputaran", { lokasi_uuid: f.lokasiUuid, jenis_linen_uuid: f.jenisLinenUuid, ...periode() }))?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
onMounted(async () => {
  const r = (await referensiUnitLaundry())?.payload;
  ruangan.value = r?.ruangan ?? [];
  jenis.value = r?.jenisLinen ?? [];
  muat();
});
const gantiTab = (t: string | number) => {
  tab.value = String(t);
  muat();
};
const lokasiRiwayat = (tipe: string, nama?: string) => (tipe === "laundry" ? POSISI_UNIT.laundry : tipe ? `${POSISI_UNIT[tipe] ?? tipe}${nama ? ` · ${nama}` : ""}` : "-");

const ekspor = () => {
  const buku = XLSX.utils.book_new();
  if (tab.value === "riwayat" && riwayat.value)
    XLSX.utils.book_append_sheet(
      buku,
      XLSX.utils.json_to_sheet(
        riwayat.value.riwayat.map((x: any) => ({
          Waktu: waktuLaundry(x.waktu),
          Peristiwa: PERISTIWA_UNIT[x.peristiwa] ?? x.peristiwa,
          Dari: lokasiRiwayat(x.lokasiTipeSebelum, x.namaLokasiSebelum),
          Ke: lokasiRiwayat(x.lokasiTipeSesudah, x.namaLokasiSesudah),
          Status: gayaStatusUnit(x.statusSesudah).label,
          Siklus: x.siklusSesudah,
          Keterangan: x.alasan,
          Petugas: x.pelakuUuid,
        })),
      ),
      riwayat.value.unit.kodeUnit,
    );
  if (tab.value === "status")
    XLSX.utils.book_append_sheet(
      buku,
      XLSX.utils.json_to_sheet(status.value.unit.map((x: any) => ({ Kode: x.kodeUnit, Jenis: x.namaJenis, Status: gayaStatusUnit(x.status).label, "Ruangan/Posisi Terakhir": posisiUnit(x), Waktu: x.waktuStatus ? waktuLaundry(x.waktuStatus) : "", Alasan: x.alasanStatus }))),
      "Hilang-Rusak",
    );
  if (tab.value === "siklus")
    XLSX.utils.book_append_sheet(
      buku,
      XLSX.utils.json_to_sheet(siklus.value.map((x: any) => ({ Kode: x.kodeUnit, Jenis: x.namaJenis, Siklus: x.siklusCuci, Batas: x.batasSiklus, Ambang: x.peringatanSiklus, Keterangan: gayaSiklusUnit(x.statusSiklus).label, Posisi: posisiUnit(x) }))),
      "Umur Pakai",
    );
  if (tab.value === "perputaran")
    XLSX.utils.book_append_sheet(
      buku,
      XLSX.utils.json_to_sheet(perputaran.value.map((x: any) => ({ Jenis: x.namaJenis, Peristiwa: PERISTIWA_UNIT[x.peristiwa] ?? x.peristiwa, "Jumlah Perpindahan": x.jumlahPerpindahan, "Jumlah Unit": x.jumlahUnit }))),
      "Perputaran",
    );
  if (!buku.SheetNames.length) return;
  XLSX.writeFile(buku, `laporan-unit-linen-${tab.value}-${keTanggal(tglMulai.value)}-${keTanggal(tglSelesai.value)}.xlsx`);
};
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <h1 class="toolbar-heading text-opensimrs-300">Laporan Unit Linen</h1>
          <CustomDatePicker v-if="tab !== 'siklus'" v-model="tglMulai" label="Tanggal mulai" class="toolbar-field--date" :maxDate="tglSelesai ?? undefined" />
          <CustomDatePicker v-if="tab !== 'siklus'" v-model="tglSelesai" label="Tanggal selesai" class="toolbar-field--date" :minDate="tglMulai ?? undefined" />
          <CustomTextfield v-if="tab === 'riwayat'" v-model="filter.kode" label="Kode unit" prependIcon="PhQrCode" :maxLength="60" @keydown.enter="muat" />
          <template v-else>
            <CustomSelect v-model="filter.lokasiUuid" label="Ruangan" :options="opsiRuangan" optionValue="value" optionLabel="label" />
            <CustomSelect v-model="filter.jenisLinenUuid" label="Jenis" :options="opsiJenis" optionValue="value" optionLabel="label" />
          </template>
          <CustomSelect
            v-if="tab === 'status'"
            v-model="filter.status"
            label="Status"
            :options="[{ value: '', label: 'Rusak, hilang, dimusnahkan' }, { value: 'rusak', label: 'Rusak' }, { value: 'hilang', label: 'Hilang' }, { value: 'dimusnahkan', label: 'Dimusnahkan' }]"
            optionValue="value"
            optionLabel="label"
          />
          <CustomSelect
            v-if="tab === 'siklus'"
            v-model="filter.ambang"
            label="Ambang"
            :options="[{ value: '', label: 'Mendekati & mencapai' }, { value: 'dekat', label: 'Mendekati batas' }, { value: 'tercapai', label: 'Mencapai/melewati batas' }]"
            optionValue="value"
            optionLabel="label"
          />
          <CustomButton icon="PhArrowClockwise" label="Muat" @click="muat" />
          <CustomButton v-if="bolehEkspor" icon="PhFileXls" label="Ekspor Excel" @click="ekspor" />
        </PageToolbar>
      </template>
      <template #content>
        <Tabs :value="tab" @update:value="gantiTab">
          <TabList>
            <Tab value="status">Hilang / Rusak per Ruangan</Tab>
            <Tab value="siklus">Umur Pakai</Tab>
            <Tab value="perputaran">Perputaran</Tab>
            <Tab value="riwayat">Riwayat Unit</Tab>
          </TabList>
          <TabPanels>
            <TabPanel value="status">
              <div class="flex flex-wrap gap-2 mb-3">
                <span v-for="(r, i) in status.ringkasan" :key="i" class="px-2 py-1 rounded text-xs" :class="[gayaStatusUnit(r.status).bg, gayaStatusUnit(r.status).text]">{{ r.namaLokasi ?? "-" }} · {{ gayaStatusUnit(r.status).label }}: {{ r.jumlah }}</span>
              </div>
              <NoData v-if="!status.unit.length" />
              <DataTable v-else :value="status.unit" class="text-xs" stripedRows>
                <Column field="kodeUnit" header="Kode" headerClass="bg-opensimrs-50" />
                <Column field="namaJenis" header="Jenis" headerClass="bg-opensimrs-50" />
                <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ gayaStatusUnit(d.status).label }}</template></Column>
                <Column header="Ruangan/Posisi Terakhir" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ posisiUnit(d) }}</template></Column>
                <Column header="Waktu Status" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.waktuStatus ? waktuLaundry(d.waktuStatus) : "-" }}</template></Column>
                <Column field="alasanStatus" header="Alasan" headerClass="bg-opensimrs-50" />
              </DataTable>
            </TabPanel>
            <TabPanel value="siklus">
              <NoData v-if="!siklus.length" />
              <DataTable v-else :value="siklus" class="text-xs" stripedRows>
                <Column field="kodeUnit" header="Kode" headerClass="bg-opensimrs-50" />
                <Column field="namaJenis" header="Jenis" headerClass="bg-opensimrs-50" />
                <Column header="Siklus / Batas" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.siklusCuci }} / {{ d.batasSiklus ?? "-" }}</template></Column>
                <Column header="Keterangan" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }"><span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaSiklusUnit(d.statusSiklus).bg, gayaSiklusUnit(d.statusSiklus).text]">{{ gayaSiklusUnit(d.statusSiklus).label }}</span></template>
                </Column>
                <Column header="Posisi" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ posisiUnit(d) }}</template></Column>
                <Column header="Terakhir Dicuci" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.waktuCuciTerakhir ? waktuLaundry(d.waktuCuciTerakhir) : "-" }}</template></Column>
              </DataTable>
            </TabPanel>
            <TabPanel value="perputaran">
              <NoData v-if="!perputaran.length" />
              <DataTable v-else :value="perputaran" class="text-xs" stripedRows>
                <Column field="namaJenis" header="Jenis" headerClass="bg-opensimrs-50" />
                <Column header="Peristiwa" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ PERISTIWA_UNIT[d.peristiwa] ?? d.peristiwa }}</template></Column>
                <Column field="jumlahPerpindahan" header="Jumlah Perpindahan" headerClass="bg-opensimrs-50" />
                <Column field="jumlahUnit" header="Jumlah Unit Berbeda" headerClass="bg-opensimrs-50" />
              </DataTable>
            </TabPanel>
            <TabPanel value="riwayat">
              <NoData v-if="!riwayat" />
              <template v-else>
                <div class="text-xs mb-2">
                  <b>{{ riwayat.unit.kodeUnit }}</b> · {{ riwayat.unit.namaJenis }} · {{ gayaStatusUnit(riwayat.unit.status).label }} · {{ posisiUnit(riwayat.unit) }} · siklus {{ riwayat.unit.siklusCuci }}{{ riwayat.unit.batasSiklus ? ` / ${riwayat.unit.batasSiklus}` : "" }}
                </div>
                <DataTable :value="riwayat.riwayat" class="text-xs" stripedRows>
                  <Column header="Waktu" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ waktuLaundry(d.waktu) }}</template></Column>
                  <Column header="Peristiwa" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ PERISTIWA_UNIT[d.peristiwa] ?? d.peristiwa }}</template></Column>
                  <Column header="Dari" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ lokasiRiwayat(d.lokasiTipeSebelum, d.namaLokasiSebelum) }}</template></Column>
                  <Column header="Ke" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ lokasiRiwayat(d.lokasiTipeSesudah, d.namaLokasiSesudah) }}{{ d.noBed ? ` · Bed ${d.noBed}` : "" }}</template></Column>
                  <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ gayaStatusUnit(d.statusSesudah).label }}</template></Column>
                  <Column field="siklusSesudah" header="Siklus" headerClass="bg-opensimrs-50" />
                  <Column field="alasan" header="Keterangan" headerClass="bg-opensimrs-50" />
                  <Column field="pelakuUuid" header="Petugas" headerClass="bg-opensimrs-50" />
                </DataTable>
              </template>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </template>
    </Card>
  </div>
</template>
