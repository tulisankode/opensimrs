<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import { utilsStore } from "@/stores/utils";
import { laporanHd, tampilTanggal, tanggalIso } from "@/stores/penunjang/hemodialisa";

// Laporan unit HD (KF-16): jumlah tindakan, utilisasi mesin, komplikasi, dan rekap adekuasi per periode tanggal jadwal.
// Definisi indikator ditampilkan dari backend; tidak ada ambang kecukupan klinis.
const storeUtils = utilsStore();
const dari = ref<Date | null>(new Date(Date.now() - 29 * 86400000));
const sampai = ref<Date | null>(new Date());
const lap = ref<any>(null);
const muat = async () => {
  storeUtils.setLoading(true);
  try {
    lap.value = (await laporanHd(tanggalIso(dari.value), tanggalIso(sampai.value)))?.payload ?? null;
  } finally {
    storeUtils.setLoading(false);
  }
};
onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Laporan Unit HD</h1>
          <CustomDatePicker v-model="dari" label="Dari" class="toolbar-field--date" />
          <CustomDatePicker v-model="sampai" label="Sampai" class="toolbar-field--date" />
          <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" @click="muat" />
        </PageToolbar>
      </template>
      <template #content>
        <div v-if="lap" class="flex flex-col gap-5 pt-4 text-sm">
          <div class="text-grey-400">Periode {{ tampilTanggal(lap.periode.dari) }} – {{ tampilTanggal(lap.periode.sampai) }} ({{ lap.periode.jumlahHari }} hari)</div>
          <div class="grid grid-cols-5 gap-3">
            <div class="p-3 rounded-md bg-opensimrs-50"><div class="text-xs text-grey-400">Tindakan selesai</div><div class="text-2xl font-semibold">{{ lap.tindakan.selesai }}</div></div>
            <div class="p-3 rounded-md bg-opensimrs-50"><div class="text-xs text-grey-400">Pasien</div><div class="text-2xl font-semibold">{{ lap.tindakan.pasien }}</div></div>
            <div class="p-3 rounded-md bg-opensimrs-50"><div class="text-xs text-grey-400">Jadwal / batal</div><div class="text-2xl font-semibold">{{ lap.tindakan.jadwalTerjadwal }} / {{ lap.tindakan.jadwalBatal }}</div></div>
            <div class="p-3 rounded-md bg-opensimrs-50"><div class="text-xs text-grey-400">Sesi batal</div><div class="text-2xl font-semibold">{{ lap.tindakan.batal }}</div></div>
            <div class="p-3 rounded-md bg-opensimrs-50"><div class="text-xs text-grey-400">Tertagih / belum</div><div class="text-2xl font-semibold">{{ lap.tindakan.tertagih }} / {{ lap.tindakan.belumTertagih }}</div></div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <section>
              <div class="mb-2 font-semibold">Per jenis HD</div>
              <DataTable :value="lap.tindakan.perJenis" class="text-xs"><Column field="jenis" header="Jenis" headerClass="bg-opensimrs-50" /><Column field="jumlah" header="Jumlah" headerClass="bg-opensimrs-50" /></DataTable>
            </section>
            <section>
              <div class="mb-2 font-semibold">Komplikasi</div>
              <DataTable :value="lap.komplikasi" class="text-xs">
                <Column field="label" header="Kategori" headerClass="bg-opensimrs-50" />
                <Column field="kejadian" header="Kejadian" headerClass="bg-opensimrs-50" />
                <Column field="sesi" header="Sesi terdampak" headerClass="bg-opensimrs-50" />
                <template #empty><div class="py-2 text-center text-grey-400">Tidak ada komplikasi tercatat.</div></template>
              </DataTable>
            </section>
          </div>
          <section>
            <div class="mb-2 font-semibold">Utilisasi mesin</div>
            <DataTable :value="lap.utilisasiMesin" class="text-xs">
              <Column field="kode" header="Mesin" headerClass="bg-opensimrs-50" />
              <Column field="status" header="Status" headerClass="bg-opensimrs-50" />
              <Column field="terjadwal" header="Jadwal" headerClass="bg-opensimrs-50" />
              <Column field="selesai" header="Sesi selesai" headerClass="bg-opensimrs-50" />
              <Column field="slotTersedia" header="Slot tersedia" headerClass="bg-opensimrs-50" />
              <Column header="Utilisasi" headerClass="bg-opensimrs-50"><template #body="{ data: m }">{{ m.persen === null ? "-" : `${m.persen}%` }}</template></Column>
            </DataTable>
          </section>
          <section>
            <div class="mb-2 font-semibold">Adekuasi</div>
            <div class="grid grid-cols-4 gap-3 text-xs">
              <div>Tersedia: <b>{{ lap.adekuasi.tersedia }}</b></div>
              <div>Belum tersedia: <b>{{ lap.adekuasi.belumTersedia }}</b></div>
              <div>Tanpa data: <b>{{ lap.adekuasi.tanpaData }}</b></div>
              <div>Rata-rata Kt/V {{ lap.adekuasi.rataKtV ?? "-" }} · URR {{ lap.adekuasi.rataUrr ?? "-" }}%</div>
            </div>
          </section>
          <section class="text-xs text-grey-400">
            <div v-for="(isi, kunci) in lap.definisi" :key="kunci">{{ kunci }}: {{ isi }}</div>
          </section>
        </div>
      </template>
    </Card>
  </div>
</template>
