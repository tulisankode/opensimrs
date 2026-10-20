<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import FormTemplateIcu from "@/components/RawatInap/ICU/FormTemplateIcu.vue";
import { useIcuStore, type TemplateIcu, type ElemenIcu, type NilaiIcu } from "@/stores/rawatInap/icu";
import { hasPermission } from "@/utils/permissions";
const store = useIcuStore();
const data = ref<TemplateIcu[]>([]); const halaman = ref(1); const total = ref(0);
const layanan = [{ kode: 'umum', nama: 'ICU Umum' }, { kode: 'burn', nama: 'Burn ICU' }, { kode: 'neuro', nama: 'Neuro ICU' }];
const kosong = () => ({ uuid: '', nama: '', layananKode: 'burn', kodeTemplate: '', nomorVersi: 1, status: 'draf', revisi: 1,
  definisi: { observasi: [] as ElemenIcu[], dokumen: [] as { kodeDokumen: string; nama: string; elemen: ElemenIcu[] }[] }, aturanKelengkapan: [] as any[] });
const form = ref(kosong()); const versiBaru = ref(false); const alasan = ref(''); const pratinjau = ref<NilaiIcu[]>([]);
const sumber = ref('observasi'); const indeksDokumen = ref(0);
const daftarElemen = computed(() => sumber.value === 'observasi' ? form.value.definisi.observasi : form.value.definisi.dokumen[indeksDokumen.value]?.elemen ?? []);
const bolehEdit = computed(() => !form.value.uuid ? hasPermission('ICU', 'Template Klinis', 'CREATE') : versiBaru.value ? hasPermission('ICU', 'Template Klinis', 'CREATE') : form.value.status === 'draf' && hasPermission('ICU', 'Template Klinis', 'UPDATE'));
const muat = async () => { const r = await store.getTemplate({ halaman: halaman.value }); data.value = r?.payload?.data ?? []; total.value = r?.payload?.total ?? 0; };
const pilih = (v: TemplateIcu) => { form.value = JSON.parse(JSON.stringify(v)); versiBaru.value = false; pratinjau.value = []; sumber.value = 'observasi'; };
const simpan = async () => {
  const isi = { nama: form.value.nama, definisi: form.value.definisi, aturanKelengkapan: form.value.aturanKelengkapan };
  const r = versiBaru.value ? await store.tindakanTemplate(form.value.uuid, 'versi', isi)
    : await store.simpanTemplate(form.value.uuid ? { ...isi, revisi: form.value.revisi } : { ...isi, layananKode: form.value.layananKode, kodeTemplate: form.value.kodeTemplate }, form.value.uuid || undefined);
  if (r?.payload) { pilih(r.payload); await muat(); }
};
const tindakan = async (aksi: string) => { const r = await store.tindakanTemplate(form.value.uuid, aksi, { revisi: form.value.revisi, alasan: alasan.value }); if (r?.payload) { pilih(r.payload); await muat(); } };
const tambahElemen = () => daftarElemen.value.push({ kodeParameter: '', label: '', jenis: 'teks', wajib: false });
const ubahAngka = (e: ElemenIcu, kolom: 'minimum' | 'maksimum' | 'panjangMaksimum', nilai: string | null) => {
  if (nilai === '' || nilai === null) delete e[kolom];
  else e[kolom] = Number(nilai);
};
onMounted(muat);
</script>
<template>
  <Card class="h-full overflow-auto"><template #content><div class="flex flex-col gap-3 p-4">
    <h1 class="toolbar-heading">Template Klinis ICU</h1>
    <p>Rumah sakit menetapkan elemen dan aturan kelengkapan. Versi yang ditetapkan tetap dipakai episode berjalan.</p>
    <CustomButton v-if="hasPermission('ICU', 'Template Klinis', 'CREATE')" label="Draf Template Baru" @click="form = kosong(); versiBaru = false" />
    <div v-for="v in data" :key="v.uuid"><CustomButton :label="v.nama + ' · Versi ' + v.nomorVersi + ' · ' + v.status" @click="pilih(v)" /></div>
    <div class="flex gap-2"><CustomButton v-if="halaman > 1" label="Sebelumnya" @click="halaman--; muat()" /><CustomButton v-if="halaman * 50 < total" label="Berikutnya" @click="halaman++; muat()" /></div>
    <CustomTextfield v-model="form.nama" label="Nama template" :disabled="!bolehEdit" />
    <CustomTextfield v-model="form.kodeTemplate" label="Kode template" :disabled="!!form.uuid || !bolehEdit" />
    <CustomSelect v-model="form.layananKode" label="Layanan" :options="layanan" optionLabel="nama" optionValue="kode" :disabled="!!form.uuid || !bolehEdit" />
    <p>Status: {{ form.status }} · Versi {{ form.nomorVersi }}</p>
    <CustomButton v-if="form.uuid && hasPermission('ICU', 'Template Klinis', 'CREATE')" label="Susun Versi Berikutnya" @click="versiBaru = true" />
    <CustomSelect v-model="sumber" label="Bagian template" :options="[{ kode: 'observasi', nama: 'Observasi tambahan' }, { kode: 'dokumentasi', nama: 'Dokumentasi' }]" optionValue="kode" optionLabel="nama" />
    <template v-if="sumber === 'dokumentasi'">
      <CustomButton v-if="bolehEdit" label="Tambah Dokumen" @click="form.definisi.dokumen.push({ kodeDokumen: '', nama: '', elemen: [] }); indeksDokumen = form.definisi.dokumen.length - 1" />
      <CustomSelect v-model="indeksDokumen" label="Dokumen" :options="form.definisi.dokumen.map((d, i) => ({ nama: d.nama || 'Dokumen ' + (i + 1), indeks: i }))" optionLabel="nama" optionValue="indeks" />
      <template v-if="form.definisi.dokumen[indeksDokumen]">
        <CustomTextfield v-model="form.definisi.dokumen[indeksDokumen].kodeDokumen" label="Kode dokumen" :disabled="!bolehEdit" />
        <CustomTextfield v-model="form.definisi.dokumen[indeksDokumen].nama" label="Nama dokumen" :disabled="!bolehEdit" />
      </template>
    </template>
    <div v-for="(e, i) in daftarElemen" :key="i" class="grid grid-cols-2 gap-2 border p-3">
      <CustomTextfield v-model="e.kodeParameter" label="Kode parameter" :disabled="!bolehEdit" /><CustomTextfield v-model="e.label" label="Label" :disabled="!bolehEdit" />
      <CustomSelect v-model="e.jenis" label="Jenis" :options="['angka', 'teks', 'boolean', 'pilihan'].map((k) => ({ nama: k }))" optionLabel="nama" optionValue="nama" :disabled="!bolehEdit" />
      <CustomTextfield v-model="e.satuan" label="Satuan" :disabled="!bolehEdit" />
      <template v-if="e.jenis === 'angka'"><CustomTextfield :modelValue="e.minimum === undefined ? null : String(e.minimum)" @update:modelValue="ubahAngka(e, 'minimum', $event)" label="Minimum" type="number" :disabled="!bolehEdit" /><CustomTextfield :modelValue="e.maksimum === undefined ? null : String(e.maksimum)" @update:modelValue="ubahAngka(e, 'maksimum', $event)" label="Maksimum" type="number" :disabled="!bolehEdit" /></template>
      <CustomTextfield v-if="e.jenis === 'teks'" :modelValue="e.panjangMaksimum === undefined ? null : String(e.panjangMaksimum)" @update:modelValue="ubahAngka(e, 'panjangMaksimum', $event)" label="Panjang maksimum" type="number" :disabled="!bolehEdit" />
      <CustomTextfield v-if="e.jenis === 'pilihan'" :modelValue="e.pilihan?.join(', ')" @update:modelValue="e.pilihan = String($event).split(',').map((v) => v.trim()).filter(Boolean)" label="Pilihan dipisah koma" :disabled="!bolehEdit" />
      <label><input type="checkbox" v-model="e.wajib" :disabled="!bolehEdit" /> Wajib saat pencatatan</label><CustomButton v-if="bolehEdit" label="Hapus Elemen Draf" @click="daftarElemen.splice(i, 1)" />
    </div>
    <CustomButton v-if="bolehEdit && (sumber === 'observasi' || form.definisi.dokumen[indeksDokumen])" label="Tambah Elemen" @click="tambahElemen" />
    <h2>Aturan kelengkapan</h2>
    <div v-for="(a, i) in form.aturanKelengkapan" :key="i" class="grid grid-cols-2 gap-2 border p-3">
      <CustomSelect v-model="a.sumber" label="Sumber catatan" :options="['observasi', 'dokumentasi'].map((k) => ({ nama: k }))" optionValue="nama" optionLabel="nama" :disabled="!bolehEdit" />
      <CustomTextfield v-if="a.sumber === 'dokumentasi'" v-model="a.kodeDokumen" label="Kode dokumen" :disabled="!bolehEdit" />
      <CustomTextfield :modelValue="a.parameter.join(', ')" @update:modelValue="a.parameter = String($event).split(',').map((v) => v.trim()).filter(Boolean)" label="Kode parameter dipisah koma" :disabled="!bolehEdit" />
      <CustomSelect v-model="a.cakupan" label="Cakupan" :options="['episode', 'interval', 'selesai'].map((k) => ({ nama: k }))" optionLabel="nama" optionValue="nama" :disabled="!bolehEdit" />
      <CustomTextfield v-if="a.cakupan === 'interval'" v-model.number="a.intervalDetik" label="Interval (detik)" type="number" :disabled="!bolehEdit" />
      <CustomButton v-if="bolehEdit" label="Hapus Aturan Draf" @click="form.aturanKelengkapan.splice(i, 1)" />
    </div>
    <CustomButton v-if="bolehEdit" label="Tambah Aturan" @click="form.aturanKelengkapan.push({ sumber: 'observasi', parameter: [], cakupan: 'episode' })" />
    <CustomButton v-if="bolehEdit" label="Simpan Draf" @click="simpan" />
    <template v-if="form.uuid && !versiBaru && hasPermission('ICU', 'Template Klinis', 'TETAPKAN')">
      <CustomTextArea v-model="alasan" label="Alasan penetapan atau pengarsipan" />
      <CustomButton v-if="form.status === 'draf'" label="Tetapkan Versi" @click="tindakan('tetapkan')" /><CustomButton v-if="form.status === 'ditetapkan'" label="Arsipkan Versi" @click="tindakan('arsipkan')" />
    </template>
    <h2>Pratinjau bagian terpilih</h2><FormTemplateIcu v-model="pratinjau" :elemen="daftarElemen" />
  </div></template></Card>
</template>
