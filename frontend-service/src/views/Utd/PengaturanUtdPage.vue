<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import { utilsStore } from "@/stores/utils";
import { ambilPengaturanUtd, izinUtd, simpanPengaturanUtd, waktuUtd } from "@/stores/penunjang/utd";

// Pengaturan UTD per faskes: interval minimal antar-donor (hari) yang dipakai backend saat menetapkan keputusan
// seleksi "layak". Nilai bawaan wajib ditinjau pemilik proses sesuai pedoman resmi (PMI/Kemenkes). Backend mewajibkan
// izin UTD › Donor › UPDATE untuk menyimpan (belum ada submodul izin "Pengaturan" khusus UTD).
const storeUtils = utilsStore();
const bolehUbah = izinUtd("Donor", "UPDATE");

const form = ref({ intervalMinimalHari: 90 });
const diperbarui = ref<any>(null);
const galat = ref("");

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const p = (await ambilPengaturanUtd())?.payload;
    if (p) {
      form.value = { intervalMinimalHari: Number(p.intervalMinimalHari) || 90 };
      diperbarui.value = p.updatedAt || p.createdAt;
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
onMounted(muat);

const simpan = async () => {
  galat.value = "";
  const n = Number(form.value.intervalMinimalHari);
  if (!Number.isInteger(n) || n < 1) return (galat.value = "Interval minimal harus bilangan bulat positif (hari)");
  storeUtils.setLoading(true);
  try {
    const res = await simpanPengaturanUtd({ intervalMinimalHari: n });
    if (res?.payload) {
      form.value = { intervalMinimalHari: Number(res.payload.intervalMinimalHari) || n };
      diperbarui.value = res.payload.updatedAt || diperbarui.value;
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Pengaturan UTD</h1>
        </PageToolbar>
      </template>
      <template #content>
        <div class="flex flex-col gap-6 max-w-[720px]">
          <section class="flex flex-col gap-3">
            <h3 class="text-sm font-semibold">Interval Minimal Antar-Donor</h3>
            <CustomInputNumber v-model="form.intervalMinimalHari" label="Interval minimal (hari)" :min="1" :max="365" :disabled="!bolehUbah" class="max-w-[240px]" />
            <div class="text-xs text-grey-400">
              Dihitung dari tanggal aftap terakhir donor. Bila belum terpenuhi, keputusan seleksi "Layak" otomatis menjadi "Tolak" beserta tanggal donor
              berikutnya. Tinjau nilai ini sesuai pedoman resmi sebelum dipakai di produksi.
            </div>
            <div v-if="diperbarui" class="text-xs text-grey-400">Terakhir diperbarui {{ waktuUtd(diperbarui) }}.</div>
          </section>
          <div v-if="galat" class="text-sm text-danger-300">{{ galat }}</div>
          <div v-if="bolehUbah">
            <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpan" />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
