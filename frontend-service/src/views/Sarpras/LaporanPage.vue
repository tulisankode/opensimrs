<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import * as XLSX from "xlsx";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { keTanggal } from "@/stores/penunjang/radiologi";
import {
  HASIL_KALIBRASI,
  KATEGORI_ASET,
  PRIORITAS,
  STATUS_ASET,
  daftarAset,
  durasiSarpras,
  epochAkhirHari,
  epochAwalHari,
  gayaStatusKalibrasi,
  izinSarpras,
  laporanSarpras,
  opsi,
  rupiahSarpras,
  tanggalSarpras,
  waktuSarpras,
} from "@/stores/penunjang/sarpras";

// Laporan Sarana & Prasarana (KF-17/KF-18): daftar aset, kepatuhan pemeliharaan & kalibrasi, waktu respons perbaikan,
// biaya, dan riwayat per aset. Ekspor Excel di sisi klien dari data yang sama (filter & isolasi faskes backend).
const storeUtils = utilsStore();
const bolehEkspor = izinSarpras("Laporan Sarpras", "EKSPOR");
const tab = ref("aset");
const tglMulai = ref<Date | null>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
const tglSelesai = ref<Date | null>(new Date());
const filterKategori = ref("");
const filterStatus = ref("");
const asetPilih = ref("");
const opsiAset = ref<any[]>([]);
const hasil = ref<Record<string, any>>({});
const BUTUH_PERIODE = ["kepatuhan-pemeliharaan", "respons-perbaikan", "biaya-pemeliharaan"];

const muat = async () => {
  const jenis = tab.value;
  if (jenis === "riwayat-aset" && !asetPilih.value) return;
  storeUtils.setLoading(true);
  try {
    const params: Record<string, any> = BUTUH_PERIODE.includes(jenis) ? { tanggalMulai: epochAwalHari(tglMulai.value), tanggalSelesai: epochAkhirHari(tglSelesai.value) } : {};
    if (jenis === "aset") Object.assign(params, { kategori: filterKategori.value, status: filterStatus.value });
    if (jenis === "riwayat-aset") params.asetUuid = asetPilih.value;
    const res = await laporanSarpras(jenis, params);
    hasil.value = { ...hasil.value, [jenis]: res?.payload ?? null };
  } finally {
    storeUtils.setLoading(false);
  }
};
watch(tab, () => {
  if (!hasil.value[tab.value]) muat();
});
watch(asetPilih, muat);
const kini = computed(() => hasil.value[tab.value]);
// Kunci objek respons dikonversi camelCase oleh axios; status kalibrasi dikembalikan ke kode snake_case.
const kodeStatus = (k: string | number) => String(k).replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

// Baris per tab untuk ekspor Excel.
const barisEkspor = (): Record<string, any>[] => {
  const d = kini.value;
  if (!d) return [];
  switch (tab.value) {
    case "aset":
      return (d.data ?? []).map((a: any) => ({
        "Kode Inventaris": a.kodeInventaris,
        Nama: a.nama,
        Kategori: KATEGORI_ASET[a.kategori] ?? a.kategori,
        Lokasi: a.namaLokasi,
        Merek: a.merek,
        Tipe: a.tipe,
        "Nomor Seri": a.nomorSeri,
        "Tahun Perolehan": a.tahunPerolehan,
        "Nilai Perolehan": a.nilaiPerolehan,
        Status: STATUS_ASET[a.status]?.label ?? a.status,
        "Wajib Kalibrasi": a.wajibKalibrasi ? "Ya" : "Tidak",
        "Penanggung Jawab": a.namaPenanggungJawab,
      }));
    case "kepatuhan-pemeliharaan":
      return (d.data ?? []).map((r: any) => ({
        "Kode Inventaris": r.kodeInventaris,
        Aset: r.namaAset,
        Kategori: KATEGORI_ASET[r.kategori] ?? r.kategori,
        Pelaksanaan: r.jumlahPelaksanaan,
        "Tepat Waktu": r.tepatWaktu,
        Terlambat: r.terlambat,
        "Jadwal Terlambat Saat Ini": r.jadwalTerlambatKini,
      }));
    case "kepatuhan-kalibrasi":
      return (d.data ?? []).map((r: any) => ({
        "Kode Inventaris": r.kodeInventaris,
        Aset: r.namaAset,
        Lokasi: r.namaLokasi,
        "Tanggal Kalibrasi": tanggalSarpras(r.tanggalKalibrasi),
        Hasil: HASIL_KALIBRASI[r.hasil] ?? "",
        "Nomor Sertifikat": r.nomorSertifikat,
        "Berlaku Sampai": tanggalSarpras(r.tanggalBerlaku),
        "Rencana Berikutnya": tanggalSarpras(r.rencanaBerikutnya),
        Status: gayaStatusKalibrasi(r.statusKalibrasi).label,
      }));
    case "respons-perbaikan":
      return (d.data ?? []).map((r: any) => ({
        Prioritas: PRIORITAS[r.prioritas] ?? r.prioritas,
        Jumlah: r.jumlah,
        Terbuka: r.terbuka,
        Selesai: r.selesai,
        "Tidak Dapat Diperbaiki": r.tidakDapatDiperbaiki,
        "Rata-rata Respons (menit)": r.rataRataRespons === null ? "" : Math.round(r.rataRataRespons / 60),
        "Rata-rata Penyelesaian (menit)": r.rataRataPenyelesaian === null ? "" : Math.round(r.rataRataPenyelesaian / 60),
      }));
    case "biaya-pemeliharaan":
      return (d.data ?? []).map((r: any) => ({
        "Kode Inventaris": r.kodeInventaris,
        Aset: r.namaAset,
        Kategori: KATEGORI_ASET[r.kategori] ?? r.kategori,
        "Biaya Pemeliharaan": r.biayaPemeliharaan,
        "Biaya Perbaikan": r.biayaPerbaikan,
        "Biaya Suku Cadang": r.biayaSukuCadang,
        Total: r.total,
      }));
    case "riwayat-aset":
      return [
        ...(d.pemeliharaan ?? []).map((x: any) => ({ Waktu: waktuSarpras(x.waktuMulai), Jenis: "Pemeliharaan", Uraian: x.hasil ?? x.catatan ?? "", Keterangan: x.terlambat ? "Terlambat" : "Tepat waktu", Biaya: x.biaya })),
        ...(d.kerusakan ?? []).map((x: any) => ({ Waktu: waktuSarpras(x.waktuLaporan), Jenis: `Kerusakan ${x.nomorLaporan}`, Uraian: x.uraian, Keterangan: x.status, Biaya: (x.biaya ?? 0) + (x.biayaSukuCadang ?? 0) })),
        ...(d.kalibrasi ?? []).map((x: any) => ({ Waktu: tanggalSarpras(x.tanggalKalibrasi ?? x.tanggalJadwal), Jenis: "Kalibrasi", Uraian: x.lembagaPenguji ?? "", Keterangan: HASIL_KALIBRASI[x.hasil] ?? "Rencana", Biaya: "" })),
      ];
  }
  return [];
};
const ekspor = () => {
  const baris = barisEkspor();
  const buku = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(buku, XLSX.utils.json_to_sheet(baris.length ? baris : [{ Keterangan: "Tidak ada data" }]), tab.value.slice(0, 31));
  XLSX.writeFile(buku, `laporan-sarpras-${tab.value}-${keTanggal(new Date())}.xlsx`);
};

onMounted(async () => {
  const res = await daftarAset({ limit: 2000 });
  opsiAset.value = (res?.payload?.data ?? []).map((a: any) => ({ uuid: a.uuid, label: `${a.kodeInventaris} — ${a.nama}` }));
  muat();
});
</script>

<template>
  <div class="flex flex-col h-full gap-3 overflow-hidden">
    <Card pt:body:class="pt-0" class="flex-none">
      <template #header>
        <PageToolbar>
          <h1 class="toolbar-heading text-opensimrs-300">Laporan Sarana & Prasarana</h1>
          <template v-if="BUTUH_PERIODE.includes(tab)">
            <CustomDatePicker v-model="tglMulai" label="Tanggal mulai" class="toolbar-field--date" :maxDate="tglSelesai ?? undefined" />
            <CustomDatePicker v-model="tglSelesai" label="Tanggal selesai" class="toolbar-field--date" :minDate="tglMulai ?? undefined" />
          </template>
          <template v-if="tab === 'aset'">
            <CustomSelect v-model="filterKategori" label="Kategori" placeHolder="Semua" :options="opsi(KATEGORI_ASET)" optionValue="value" optionLabel="label" :showFilter="false" />
            <CustomSelect v-model="filterStatus" label="Status" placeHolder="Semua" :options="opsi(STATUS_ASET)" optionValue="value" optionLabel="label" :showFilter="false" />
          </template>
          <CustomSelect v-if="tab === 'riwayat-aset'" v-model="asetPilih" label="Aset" :options="opsiAset" optionValue="uuid" optionLabel="label" />
          <CustomButton icon="PhArrowClockwise" label="Muat" @click="muat" />
          <CustomButton v-if="bolehEkspor" icon="PhFileXls" label="Ekspor Excel" :disabled="!kini" @click="ekspor" />
        </PageToolbar>
      </template>
    </Card>

    <Card pt:body:class="pt-0" class="overflow-auto grow">
      <template #content>
        <Tabs v-model:value="tab">
          <TabList>
            <Tab value="aset">Daftar Aset</Tab>
            <Tab value="kepatuhan-pemeliharaan">Kepatuhan Pemeliharaan</Tab>
            <Tab value="kepatuhan-kalibrasi">Kepatuhan Kalibrasi</Tab>
            <Tab value="respons-perbaikan">Waktu Respons Perbaikan</Tab>
            <Tab value="biaya-pemeliharaan">Biaya</Tab>
            <Tab value="riwayat-aset">Riwayat per Aset</Tab>
          </TabList>
          <TabPanels>
            <TabPanel value="aset">
              <template v-if="hasil.aset">
                <div class="flex flex-wrap gap-2 mb-3 text-xs">
                  <span v-for="r in hasil.aset.ringkasan" :key="`${r.kategori}-${r.status}`" class="px-2 py-1 rounded bg-opensimrs-50">
                    {{ KATEGORI_ASET[r.kategori] }} · {{ STATUS_ASET[r.status]?.label }}: <b>{{ r.jumlah }}</b> ({{ rupiahSarpras(r.totalNilai) }})
                  </span>
                </div>
                <NoData v-if="!hasil.aset.data?.length" />
                <DataTable v-else :value="hasil.aset.data" class="text-xs" stripedRows paginator :rows="50">
                  <Column field="kodeInventaris" header="Kode" headerClass="bg-opensimrs-50" />
                  <Column field="nama" header="Nama" headerClass="bg-opensimrs-50" />
                  <Column header="Kategori" headerClass="bg-opensimrs-50"><template #body="{ data: a }">{{ KATEGORI_ASET[a.kategori] }}</template></Column>
                  <Column field="namaLokasi" header="Lokasi" headerClass="bg-opensimrs-50" />
                  <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: a }">{{ STATUS_ASET[a.status]?.label }}</template></Column>
                  <Column header="Nilai" headerClass="bg-opensimrs-50"><template #body="{ data: a }">{{ a.nilaiPerolehan !== null ? rupiahSarpras(a.nilaiPerolehan) : "-" }}</template></Column>
                </DataTable>
              </template>
            </TabPanel>
            <TabPanel value="kepatuhan-pemeliharaan">
              <template v-if="hasil['kepatuhan-pemeliharaan']">
                <div class="mb-3 text-sm">
                  Pelaksanaan: <b>{{ hasil["kepatuhan-pemeliharaan"].total.pelaksanaan }}</b> · tepat waktu {{ hasil["kepatuhan-pemeliharaan"].total.tepatWaktu }} · terlambat
                  {{ hasil["kepatuhan-pemeliharaan"].total.terlambat }} · kepatuhan
                  <b>{{ hasil["kepatuhan-pemeliharaan"].total.persenTepatWaktu ?? "-" }}{{ hasil["kepatuhan-pemeliharaan"].total.persenTepatWaktu !== null ? "%" : "" }}</b>
                </div>
                <NoData v-if="!hasil['kepatuhan-pemeliharaan'].data?.length" />
                <DataTable v-else :value="hasil['kepatuhan-pemeliharaan'].data" class="text-xs" stripedRows>
                  <Column field="kodeInventaris" header="Kode" headerClass="bg-opensimrs-50" />
                  <Column field="namaAset" header="Aset" headerClass="bg-opensimrs-50" />
                  <Column field="jumlahPelaksanaan" header="Pelaksanaan" headerClass="bg-opensimrs-50" />
                  <Column field="tepatWaktu" header="Tepat Waktu" headerClass="bg-opensimrs-50" />
                  <Column field="terlambat" header="Terlambat" headerClass="bg-opensimrs-50" />
                  <Column field="jadwalTerlambatKini" header="Jadwal Terlambat Kini" headerClass="bg-opensimrs-50" />
                </DataTable>
              </template>
            </TabPanel>
            <TabPanel value="kepatuhan-kalibrasi">
              <template v-if="hasil['kepatuhan-kalibrasi']">
                <div class="mb-3 text-sm">
                  Alat wajib kalibrasi: <b>{{ hasil["kepatuhan-kalibrasi"].ringkasan.total }}</b> · ambang {{ hasil["kepatuhan-kalibrasi"].ambangKalibrasiHari }} hari ·
                  <span v-for="(n, k) in hasil['kepatuhan-kalibrasi'].ringkasan" :key="k"><template v-if="k !== 'total'">{{ gayaStatusKalibrasi(kodeStatus(k)).label }}: {{ n }} · </template></span>
                </div>
                <NoData v-if="!hasil['kepatuhan-kalibrasi'].data?.length" />
                <DataTable v-else :value="hasil['kepatuhan-kalibrasi'].data" class="text-xs" stripedRows>
                  <Column field="kodeInventaris" header="Kode" headerClass="bg-opensimrs-50" />
                  <Column field="namaAset" header="Aset" headerClass="bg-opensimrs-50" />
                  <Column header="Kalibrasi Terakhir" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ tanggalSarpras(r.tanggalKalibrasi) }}</template></Column>
                  <Column header="Berlaku s.d." headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ tanggalSarpras(r.tanggalBerlaku) }}</template></Column>
                  <Column header="Rencana" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ tanggalSarpras(r.rencanaBerikutnya) }}</template></Column>
                  <Column header="Status" headerClass="bg-opensimrs-50">
                    <template #body="{ data: r }">
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaStatusKalibrasi(r.statusKalibrasi).bg, gayaStatusKalibrasi(r.statusKalibrasi).text]">{{ gayaStatusKalibrasi(r.statusKalibrasi).label }}</span>
                    </template>
                  </Column>
                </DataTable>
              </template>
            </TabPanel>
            <TabPanel value="respons-perbaikan">
              <template v-if="hasil['respons-perbaikan']">
                <NoData v-if="!hasil['respons-perbaikan'].data?.length" />
                <DataTable v-else :value="hasil['respons-perbaikan'].data" class="text-xs" stripedRows>
                  <Column header="Prioritas" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ PRIORITAS[r.prioritas] }}</template></Column>
                  <Column field="jumlah" header="Jumlah" headerClass="bg-opensimrs-50" />
                  <Column field="terbuka" header="Terbuka" headerClass="bg-opensimrs-50" />
                  <Column field="selesai" header="Selesai" headerClass="bg-opensimrs-50" />
                  <Column field="tidakDapatDiperbaiki" header="Tidak Dapat Diperbaiki" headerClass="bg-opensimrs-50" />
                  <Column header="Rata-rata Respons" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ durasiSarpras(r.rataRataRespons) }}</template></Column>
                  <Column header="Rata-rata Penyelesaian" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ durasiSarpras(r.rataRataPenyelesaian) }}</template></Column>
                </DataTable>
              </template>
            </TabPanel>
            <TabPanel value="biaya-pemeliharaan">
              <template v-if="hasil['biaya-pemeliharaan']">
                <div class="mb-3 text-sm">Total biaya periode: <b>{{ rupiahSarpras(hasil["biaya-pemeliharaan"].total) }}</b></div>
                <NoData v-if="!hasil['biaya-pemeliharaan'].data?.length" />
                <DataTable v-else :value="hasil['biaya-pemeliharaan'].data" class="text-xs" stripedRows>
                  <Column field="kodeInventaris" header="Kode" headerClass="bg-opensimrs-50" />
                  <Column field="namaAset" header="Aset" headerClass="bg-opensimrs-50" />
                  <Column header="Pemeliharaan" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ rupiahSarpras(r.biayaPemeliharaan) }}</template></Column>
                  <Column header="Perbaikan" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ rupiahSarpras(r.biayaPerbaikan) }}</template></Column>
                  <Column header="Suku Cadang" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ rupiahSarpras(r.biayaSukuCadang) }}</template></Column>
                  <Column header="Total" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ rupiahSarpras(r.total) }}</template></Column>
                </DataTable>
              </template>
            </TabPanel>
            <TabPanel value="riwayat-aset">
              <div v-if="!asetPilih" class="text-sm text-grey-400">Pilih aset pada toolbar.</div>
              <template v-else-if="hasil['riwayat-aset']">
                <div class="mb-2 text-sm font-semibold">{{ hasil["riwayat-aset"].aset.kodeInventaris }} — {{ hasil["riwayat-aset"].aset.nama }} ({{ hasil["riwayat-aset"].aset.namaLokasi }})</div>
                <DataTable :value="barisEkspor()" class="text-xs" stripedRows>
                  <Column field="Waktu" header="Waktu" headerClass="bg-opensimrs-50" />
                  <Column field="Jenis" header="Jenis" headerClass="bg-opensimrs-50" />
                  <Column field="Uraian" header="Uraian" headerClass="bg-opensimrs-50" />
                  <Column field="Keterangan" header="Keterangan" headerClass="bg-opensimrs-50" />
                  <Column header="Biaya" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ r.Biaya === "" || r.Biaya === null ? "-" : rupiahSarpras(r.Biaya) }}</template></Column>
                </DataTable>
              </template>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </template>
    </Card>
  </div>
</template>
