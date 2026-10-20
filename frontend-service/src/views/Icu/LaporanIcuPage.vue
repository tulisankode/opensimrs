<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { useIcuStore } from "@/stores/rawatInap/icu";

// Laporan ICU: BOR, ALOS, angka kematian & hari ventilator (KF-21/KT-15). Definisi operasional sementara — lihat
// catatan di rawat-inap-service/src/repositories/icu-repository.js — menunggu ketetapan final pemilik klinis/manajemen.
const layananKode = ref(""); const ruanganUuid = ref("");
const pilihanLayanan = [{ kode: '', nama: 'Semua layanan' }, { kode: 'umum', nama: 'ICU Umum' }, { kode: 'burn', nama: 'Burn ICU' }, { kode: 'neuro', nama: 'Neuro ICU' }, { kode: 'belum_diklasifikasikan', nama: 'Belum diklasifikasikan' }];
const storeUtils = utilsStore();
const icuStore = useIcuStore();

const dari = ref<Date>(new Date(new Date().setDate(new Date().getDate() - 30)));
const sampai = ref<Date>(new Date());
import { hasPermission } from "@/utils/permissions";
import { fiturAktif } from "@/stores/modulFaskes";
const kelengkapan = ref<any>(null); const halaman = ref(1);
const laporan = ref<any>(null);
const muatKelengkapan = async () => {
  if (hasPermission("ICU", "Kelengkapan Dokumentasi", "READ") && fiturAktif("icu_kelengkapan_dokumentasi")) {
    kelengkapan.value = (await icuStore.getLaporanKelengkapan({ dari: Math.floor(dari.value.getTime() / 1000), sampai: Math.floor(sampai.value.getTime() / 1000), layananKode: layananKode.value || undefined, ruanganUuid: ruanganUuid.value || undefined, halaman: halaman.value }))?.payload;
  }
};

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await icuStore.getLaporan(Math.floor(dari.value.getTime() / 1000), Math.floor(sampai.value.getTime() / 1000), ruanganUuid.value || undefined, layananKode.value || undefined);
    laporan.value = res?.payload ?? null;
    halaman.value = 1; await muatKelengkapan();
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomSelect v-model="layananKode" label="Layanan" :options="pilihanLayanan" optionValue="kode" optionLabel="nama" />
          <CustomTextfield v-model="ruanganUuid" label="UUID unit (opsional)" />
          <h1 class="toolbar-heading text-opensimrs-300">Laporan ICU</h1>
          <CustomDatePicker v-model="dari" label="Dari" />
          <CustomDatePicker v-model="sampai" label="Sampai" />
          <CustomButton label="Tampilkan" icon="PhMagnifyingGlass" @click="muat" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!laporan" />
        <div v-else class="flex flex-col gap-4 p-4">
          <div class="grid grid-cols-4 gap-3">
            <div class="p-4 text-center border rounded-lg border-grey-75">
              <div class="text-xs text-grey-400">BOR Ruang Intensif</div>
              <div class="text-2xl font-semibold">{{ laporan.bor ?? "-" }}{{ laporan.bor !== null ? "%" : "" }}</div>
            </div>
            <div class="p-4 text-center border rounded-lg border-grey-75">
              <div class="text-xs text-grey-400">ALOS (hari)</div>
              <div class="text-2xl font-semibold">{{ laporan.alos ?? "-" }}</div>
            </div>
            <div class="p-4 text-center border rounded-lg border-grey-75">
              <div class="text-xs text-grey-400">Angka Kematian</div>
              <div class="text-2xl font-semibold">{{ laporan.angkaKematian ?? "-" }}{{ laporan.angkaKematian !== null ? "%" : "" }}</div>
            </div>
            <div class="p-4 text-center border rounded-lg border-grey-75">
              <div class="text-xs text-grey-400">Hari Ventilator</div>
              <div class="text-2xl font-semibold">{{ laporan.hariVentilator }}</div>
            </div>
          </div>
          <div class="text-xs text-grey-400">
            {{ laporan.jumlahBedIcu }} bed ICU teridentifikasi · {{ laporan.jumlahEpisodeSelesai }} episode selesai pada periode ini.
          </div>
          <p v-if="laporan.dasarKapasitas?.alasan">{{ laporan.dasarKapasitas.alasan }}</p>
          <div v-if="kelengkapan"><h2>Kelengkapan dokumentasi</h2><p>Lengkap: {{ kelengkapan.ringkasan.lengkap }} - Belum lengkap: {{ kelengkapan.ringkasan.belumLengkap }} - Belum dikonfigurasi: {{ kelengkapan.ringkasan.belumDikonfigurasi }}</p>
            <p v-for="e in kelengkapan.data" :key="e.perawatanUuid">{{ e.perawatanUuid }} - {{ e.status }} - {{ e.kekurangan.length }} kekurangan</p>
            <CustomButton v-if="halaman > 1" label="Sebelumnya" @click="halaman--; muatKelengkapan()" /><CustomButton v-if="halaman * 50 < kelengkapan.total" label="Berikutnya" @click="halaman++; muatKelengkapan()" />
          </div>
          <div class="p-3 text-xs rounded-lg text-grey-400 bg-grey-25">{{ laporan.definisi }}</div>
        </div>
      </template>
    </Card>
  </div>
</template>
