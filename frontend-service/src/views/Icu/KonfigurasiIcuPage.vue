<script setup lang="ts">
import { ref, onMounted } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import { useIcuStore } from "@/stores/rawatInap/icu";
import { hasPermission } from "@/utils/permissions";
const store = useIcuStore();
const konfigurasi = ref<any>(null);
const riwayat = ref<any[]>([]);
const alasan = ref("");
const bed = ref(""); const layananKode = ref("umum"); const mulai = ref(new Date(Date.now() + 60000));
const role = ref(""); const unit = ref(""); const aktif = ref(true);
const halaman = ref(1); const total = ref(0);
const muatRiwayat = async () => { const r = await store.getRiwayatKonfigurasi(halaman.value); riwayat.value = r?.payload?.data ?? []; total.value = r?.payload?.total ?? 0; };
const muat = async () => { konfigurasi.value = (await store.getKonfigurasi())?.payload; await muatRiwayat(); };
const ubahLayanan = async (l: any) => { if ((await store.ubahLayanan(l.kode, { aktif: !l.aktif, revisi: l.revisi, alasan: alasan.value }))?.payload) await muat(); };
const simpanBed = async () => {
  const lama = konfigurasi.value.penempatanBed.find((b: any) => b.roomMonitoringUuid === bed.value);
  if ((await store.ubahBed(bed.value, { layananKode: layananKode.value, berlakuMulai: Math.floor(mulai.value.getTime() / 1000), revisi: lama?.revisi ?? 0, alasan: alasan.value }))?.payload) await muat();
};
const simpanAkses = async () => {
  const lama = konfigurasi.value.aksesUnit.find((a: any) => a.roleUuid === role.value && a.ruanganUuid === unit.value);
  if ((await store.ubahAkses({ roleUuid: role.value, ruanganUuid: unit.value, aktif: aktif.value, revisi: lama?.revisi ?? 0, alasan: alasan.value }))?.payload) await muat();
};
onMounted(muat);
</script>
<template>
  <Card class="h-full overflow-auto"><template #content><div class="flex flex-col gap-4 p-4" v-if="konfigurasi">
    <h1 class="toolbar-heading">Konfigurasi Layanan ICU</h1>
    <p>Siapkan pemetaan bed, akses peran/unit, dan template yang ditetapkan sebelum mengaktifkan layanan khusus.</p>
    <CustomTextArea v-if="hasPermission('ICU', 'Konfigurasi Layanan', 'KELOLA')" v-model="alasan" label="Alasan perubahan" />
    <div v-for="l in konfigurasi.layanan" :key="l.kode" class="flex items-center gap-3"><b>{{ l.nama }}</b><span>{{ l.aktif ? 'Aktif' : 'Nonaktif' }}</span>
      <CustomButton v-if="hasPermission('ICU', 'Konfigurasi Layanan', 'KELOLA')" :label="l.aktif ? 'Nonaktifkan' : 'Aktifkan'" @click="ubahLayanan(l)" />
    </div>
    <template v-if="hasPermission('ICU', 'Konfigurasi Layanan', 'KELOLA')">
      <h2>Pemetaan bed</h2><CustomTextfield v-model="bed" label="UUID bed terdaftar" />
      <CustomSelect v-model="layananKode" :options="konfigurasi.layanan" optionLabel="nama" optionValue="kode" label="Layanan" />
      <CustomDatePicker v-model="mulai" label="Berlaku mulai" showTime /><CustomButton label="Simpan Pemetaan Bed" @click="simpanBed" />
      <h2>Akses unit</h2><CustomTextfield v-model="role" label="UUID peran" /><CustomTextfield v-model="unit" label="UUID unit" />
      <label><input type="checkbox" v-model="aktif" /> Akses aktif</label><CustomButton label="Simpan Akses Unit" @click="simpanAkses" />
    </template>
    <h2>Penempatan bed</h2><p v-for="b in konfigurasi.penempatanBed" :key="b.uuid">{{ b.roomMonitoringUuid }} · {{ b.layananKode }} · {{ new Date(Number(b.berlakuMulai) * 1000).toLocaleString('id-ID') }} — {{ b.berlakuSampai ? new Date(Number(b.berlakuSampai) * 1000).toLocaleString('id-ID') : 'Berlanjut' }}</p>
    <h2>Akses unit aktif</h2><p v-for="a in konfigurasi.aksesUnit" :key="a.uuid">Peran {{ a.roleUuid }} · Unit {{ a.ruanganUuid }}</p>
    <h2>Riwayat perubahan</h2><p v-for="r in riwayat" :key="r.uuid">{{ new Date(Number(r.createdAt) * 1000).toLocaleString('id-ID') }} · {{ r.pelaku }} · {{ r.alasan }}</p>
    <div class="flex gap-2"><CustomButton v-if="halaman > 1" label="Sebelumnya" @click="halaman--; muatRiwayat()" /><CustomButton v-if="halaman * 50 < total" label="Berikutnya" @click="halaman++; muatRiwayat()" /></div>
  </div></template></Card>
</template>
