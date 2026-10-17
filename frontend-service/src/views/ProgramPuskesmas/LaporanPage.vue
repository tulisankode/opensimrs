<script setup lang="ts">
import { ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { eksporLaporanPkm, izinPkm, laporanImunisasiPkm, laporanKiaPkm, laporanLb1Pkm, laporanProgramPkm } from "@/stores/programPuskesmas/programPuskesmas";

// Laporan Dinkes (KF-20..KF-23): LB1 dari diagnosis kunjungan (Mongo) digabung demografi/kunjungan
// (PostgreSQL); bagian yang tidak dapat dihitung ditandai, bukan ditampilkan nol tanpa keterangan (KT-10).
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinPkm("Laporan Dinkes", aksi);
const periodeDefault = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const tab = ref("lb1");
const periode = ref(periodeDefault());
const lb1 = ref<any>(null);
const kia = ref<any>(null);
const imunisasi = ref<any>(null);
const program = ref<any>(null);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const [resLb1, resKia, resImunisasi, resProgram] = await Promise.all([
      laporanLb1Pkm(periode.value),
      laporanKiaPkm(periode.value),
      laporanImunisasiPkm(periode.value),
      laporanProgramPkm(periode.value),
    ]);
    lb1.value = resLb1?.payload ?? null;
    kia.value = resKia?.payload ?? null;
    imunisasi.value = resImunisasi?.payload ?? null;
    program.value = resProgram?.payload ?? null;
  } finally {
    storeUtils.setLoading(false);
  }
};
const ekspor = async (jenis: string) => {
  storeUtils.setLoading(true);
  try {
    await eksporLaporanPkm(jenis, periode.value);
  } finally {
    storeUtils.setLoading(false);
  }
};
muat();
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Laporan Dinkes</h1>
          <CustomTextfield v-model="periode" label="Periode (YYYY-MM)" placeholder="2026-01" :maxLength="7" />
          <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" @click="muat" />
        </PageToolbar>
      </template>
      <template #content>
        <Tabs v-model:value="tab" class="flex flex-col h-full">
          <TabList>
            <Tab value="lb1">LB1 (Data Kesakitan)</Tab>
            <Tab value="kia">KIA</Tab>
            <Tab value="imunisasi">Imunisasi</Tab>
            <Tab value="program">Program (UKM & Sasaran)</Tab>
          </TabList>
          <TabPanels class="overflow-auto grow !p-0 pt-3">
          <TabPanel value="lb1">
            <div v-if="lb1" class="flex flex-col gap-3 text-xs">
              <div class="flex flex-wrap gap-3">
                <div class="px-3 py-2 rounded-lg bg-opensimrs-50">Total kunjungan: <b>{{ lb1.kelengkapan.totalKunjungan }}</b></div>
                <div class="px-3 py-2 rounded-lg bg-opensimrs-50">Kunjungan dengan diagnosis: <b>{{ lb1.kelengkapan.kunjunganDenganDiagnosis }}</b></div>
                <div v-if="lb1.kelengkapan.kunjunganTanpaDiagnosis" class="px-3 py-2 rounded-lg bg-danger-50 text-danger-300">
                  Kunjungan tanpa diagnosis tersimpan (tidak masuk rekap): <b>{{ lb1.kelengkapan.kunjunganTanpaDiagnosis }}</b>
                </div>
              </div>
              <NoData v-if="!lb1.rincian.length" />
              <DataTable v-else :value="lb1.rincian" stripedRows class="text-xs" scrollable scrollHeight="400px">
                <Column field="kodeIcd10" header="Kode ICD-10" headerClass="bg-opensimrs-50" />
                <Column field="namaDiagnosis" header="Nama Diagnosis" headerClass="bg-opensimrs-50" />
                <Column field="kelompokUmur" header="Kelompok Umur" headerClass="bg-opensimrs-50" />
                <Column field="jenisKelamin" header="Jenis Kelamin" headerClass="bg-opensimrs-50" />
                <Column field="jumlah" header="Jumlah" headerClass="bg-opensimrs-50" />
              </DataTable>
              <div class="flex justify-end">
                <CustomButton v-if="boleh('EKSPOR EXCEL')" label="Ekspor Excel" icon="PhFileXls" @click="ekspor('lb1')" />
              </div>
            </div>
          </TabPanel>
          <TabPanel value="kia">
            <div v-if="kia" class="flex flex-col gap-3 text-xs">
              <DataTable :value="kia.cakupanAnc" stripedRows class="text-xs">
                <Column field="nomorKunjungan" header="Nomor Kunjungan" headerClass="bg-opensimrs-50" />
                <Column field="jumlah" header="Jumlah" headerClass="bg-opensimrs-50" />
              </DataTable>
              <div class="flex gap-4">
                <div class="px-3 py-2 rounded-lg bg-opensimrs-50">Jumlah persalinan: <b>{{ kia.jumlahPersalinan }}</b></div>
                <div class="px-3 py-2 rounded-lg bg-opensimrs-50">Jumlah nifas: <b>{{ kia.jumlahNifas }}</b></div>
              </div>
              <div class="flex justify-end">
                <CustomButton v-if="boleh('EKSPOR EXCEL')" label="Ekspor Excel" icon="PhFileXls" @click="ekspor('kia')" />
              </div>
            </div>
          </TabPanel>
          <TabPanel value="imunisasi">
            <div v-if="imunisasi" class="flex flex-col gap-3 text-xs">
              <NoData v-if="!imunisasi.cakupan.length" />
              <DataTable v-else :value="imunisasi.cakupan" stripedRows class="text-xs">
                <Column field="jenisVaksinNama" header="Jenis Vaksin" headerClass="bg-opensimrs-50" />
                <Column field="jumlah" header="Jumlah Pemberian" headerClass="bg-opensimrs-50" />
                <Column field="jumlahPasien" header="Jumlah Pasien" headerClass="bg-opensimrs-50" />
              </DataTable>
              <div class="flex justify-end">
                <CustomButton v-if="boleh('EKSPOR EXCEL')" label="Ekspor Excel" icon="PhFileXls" @click="ekspor('imunisasi')" />
              </div>
            </div>
          </TabPanel>
          <TabPanel value="program">
            <div v-if="program" class="flex flex-col gap-3 text-xs">
              <div class="font-semibold">Kegiatan UKM</div>
              <NoData v-if="!program.ukm.length" />
              <DataTable v-else :value="program.ukm" stripedRows class="text-xs">
                <Column field="namaKelurahan" header="Kelurahan" headerClass="bg-opensimrs-50" />
                <Column field="jenisKegiatan" header="Jenis Kegiatan" headerClass="bg-opensimrs-50" />
                <Column field="jumlahKegiatan" header="Jumlah Kegiatan" headerClass="bg-opensimrs-50" />
                <Column field="totalPeserta" header="Total Peserta" headerClass="bg-opensimrs-50" />
              </DataTable>
              <div class="mt-2 font-semibold">Sasaran Program</div>
              <NoData v-if="!program.sasaran.length" />
              <DataTable v-else :value="program.sasaran" stripedRows class="text-xs">
                <Column field="namaKelurahan" header="Kelurahan" headerClass="bg-opensimrs-50" />
                <Column field="jenisSasaran" header="Jenis Sasaran" headerClass="bg-opensimrs-50" />
                <Column field="jumlahSasaran" header="Jumlah Sasaran" headerClass="bg-opensimrs-50" />
                <Column field="jumlahDilayani" header="Jumlah Dilayani" headerClass="bg-opensimrs-50" />
              </DataTable>
              <div class="flex justify-end">
                <CustomButton v-if="boleh('EKSPOR EXCEL')" label="Ekspor Excel" icon="PhFileXls" @click="ekspor('program')" />
              </div>
            </div>
          </TabPanel>
          </TabPanels>
        </Tabs>
      </template>
    </Card>
  </div>
</template>
