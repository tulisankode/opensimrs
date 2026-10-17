<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import { utilsStore } from "@/stores/utils";
import { ambilPengaturanBdrs, izinBdrs, rupiahBdrs, simpanPengaturanBdrs } from "@/stores/penunjang/bankDarah";

// Pengaturan BDRS per faskes: ambang peringatan kedaluwarsa kantong (hari) dan tarif pengolahan darah & uji silang
// serasi per kantong yang dikirim ke tagihan kunjungan saat serah terima selesai (tarif 0 = tidak ditagihkan).
const storeUtils = utilsStore();
const bolehUbah = izinBdrs("Pengaturan", "UPDATE");

const form = ref({ ambangKedaluwarsaHari: 3, tarifPengolahan: 0, tarifCrossmatch: 0 });
const galat = ref("");

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const p = (await ambilPengaturanBdrs())?.payload;
    if (p) form.value = { ambangKedaluwarsaHari: Number(p.ambangKedaluwarsaHari) || 3, tarifPengolahan: Number(p.tarifPengolahan) || 0, tarifCrossmatch: Number(p.tarifCrossmatch) || 0 };
  } finally {
    storeUtils.setLoading(false);
  }
};
onMounted(muat);

const simpan = async () => {
  const f = form.value;
  galat.value = "";
  if (!f.ambangKedaluwarsaHari || f.ambangKedaluwarsaHari < 1 || f.ambangKedaluwarsaHari > 90) return (galat.value = "Ambang kedaluwarsa harus 1–90 hari");
  if (f.tarifPengolahan < 0 || f.tarifCrossmatch < 0) return (galat.value = "Tarif tidak boleh negatif");
  storeUtils.setLoading(true);
  try {
    const res = await simpanPengaturanBdrs({ ...f });
    if (res?.payload) form.value = { ...form.value, ...res.payload };
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
          <h1 class="toolbar-heading text-opensimrs-300">Pengaturan BDRS</h1>
        </PageToolbar>
      </template>
      <template #content>
        <div class="flex flex-col gap-6 max-w-[720px]">
          <section class="flex flex-col gap-3">
            <h3 class="text-sm font-semibold">Peringatan Kedaluwarsa</h3>
            <CustomInputNumber v-model="form.ambangKedaluwarsaHari" label="Ambang peringatan (hari)" :min="1" :max="90" :disabled="!bolehUbah" class="max-w-[240px]" />
            <div class="text-xs text-grey-400">Kantong tersedia yang kedaluwarsa dalam jumlah hari ini ditandai pada halaman Stok & Penerimaan.</div>
          </section>
          <section class="flex flex-col gap-3">
            <h3 class="text-sm font-semibold">Tarif per Kantong (dikirim ke tagihan kunjungan)</h3>
            <div class="grid grid-cols-2 gap-4">
              <CustomInputNumber v-model="form.tarifPengolahan" label="Biaya Pengolahan Darah" :min="0" mode="currency" currency="IDR" :disabled="!bolehUbah" />
              <CustomInputNumber v-model="form.tarifCrossmatch" label="Biaya Uji Silang Serasi" :min="0" mode="currency" currency="IDR" :disabled="!bolehUbah" />
            </div>
            <div class="text-xs text-grey-400">
              Contoh: 2 kantong diserahkan → {{ rupiahBdrs(2 * (form.tarifPengolahan + form.tarifCrossmatch)) }}. Tarif 0 berarti komponen biaya tersebut tidak ditagihkan.
            </div>
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
