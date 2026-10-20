<script setup lang="ts">
import { ref, watch } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import FormTemplateIcu from "./FormTemplateIcu.vue";
import { useIcuStore, type NilaiIcu, type TemplateIcu } from "@/stores/rawatInap/icu";
import { hasPermission } from "@/utils/permissions";
const props = defineProps<{ perawatanUuid: string; template: TemplateIcu | null; status: string }>();
const emit = defineEmits<{ tersimpan: [] }>();
const store = useIcuStore();
const dokumen = ref("");
const nilai = ref<NilaiIcu[]>([]);
const waktu = ref(new Date());
const data = ref<any[]>([]);
const halaman = ref(1);
const total = ref(0);
const koreksi = ref<any>(null);
const alasan = ref("");
const muat = async () => {
  data.value = [];
  const res = await store.getDokumentasi(props.perawatanUuid, halaman.value);
  data.value = res?.payload?.data ?? []; total.value = res?.payload?.total ?? 0;
};
const simpan = async () => {
  const res = koreksi.value ? await store.koreksiDokumentasi(koreksi.value.uuid, { nilaiBaru: nilai.value, revisi: koreksi.value.revisi, alasan: alasan.value })
    : await store.tambahDokumentasi(props.perawatanUuid, { kodeDokumen: dokumen.value, waktuPencatatan: Math.floor(waktu.value.getTime() / 1000), nilai: nilai.value });
  if (res?.payload) { koreksi.value = null; nilai.value = []; alasan.value = ""; await muat(); emit("tersimpan"); }
};
const bukaKoreksi = (d: any) => { koreksi.value = d; dokumen.value = d.kodeDokumen; nilai.value = d.nilai.map((n: NilaiIcu) => ({ ...n })); alasan.value = ""; };
watch(() => props.perawatanUuid, () => { koreksi.value = null; dokumen.value = ""; nilai.value = []; halaman.value = 1; muat(); }, { immediate: true });
watch(dokumen, () => { if (!koreksi.value) nilai.value = []; });
watch(halaman, muat);
</script>
<template>
  <div class="flex flex-col gap-3">
    <p v-if="!template">Episode ini belum memakai template.</p>
    <template v-if="template && ((status === 'aktif' && hasPermission('ICU', 'Dokumentasi Klinis', 'CREATE')) || (koreksi && hasPermission('ICU', 'Dokumentasi Klinis', 'KOREKSI')))">
      <CustomSelect v-model="dokumen" label="Dokumen" :options="template.definisi.dokumen" optionLabel="nama" optionValue="kodeDokumen" :disabled="!!koreksi" />
      <CustomDatePicker v-if="!koreksi" v-model="waktu" label="Waktu pencatatan" showTime />
      <FormTemplateIcu v-model="nilai" :elemen="template.definisi.dokumen.find((d) => d.kodeDokumen === dokumen)?.elemen ?? []" />
      <CustomTextArea v-if="koreksi" v-model="alasan" label="Alasan koreksi" />
      <CustomButton v-if="dokumen" :label="koreksi ? 'Simpan Koreksi' : 'Simpan Dokumentasi'" @click="simpan" />
      <CustomButton v-if="koreksi" label="Batalkan Koreksi" @click="koreksi = null; nilai = []" />
    </template>
    <div v-for="d in data" :key="d.uuid" class="p-3 border rounded">
      <b>{{ d.kodeDokumen }}</b> · {{ new Date(Number(d.waktuPencatatan) * 1000).toLocaleString('id-ID') }} · Revisi {{ d.revisi }}
      <p v-for="n in d.nilai" :key="n.kodeParameter">{{ template?.definisi.dokumen.find((e) => e.kodeDokumen === d.kodeDokumen)?.elemen.find((e) => e.kodeParameter === n.kodeParameter)?.label ?? n.kodeParameter }}: {{ n.nilai }}</p>
      <CustomButton v-if="hasPermission('ICU', 'Dokumentasi Klinis', 'KOREKSI')" label="Koreksi" @click="bukaKoreksi(d)" />
    </div>
    <div class="flex gap-2"><CustomButton v-if="halaman > 1" label="Sebelumnya" @click="halaman--" /><span>Halaman {{ halaman }} · {{ total }} catatan</span><CustomButton v-if="halaman * 50 < total" label="Berikutnya" @click="halaman++" /></div>
  </div>
</template>
