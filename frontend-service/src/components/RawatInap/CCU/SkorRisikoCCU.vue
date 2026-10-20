<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { useCcuStore, tampilWaktu } from "@/stores/rawatInap/ccu";

// Skor risiko kardiak: Killip, TIMI UA/NSTEMI (0–7), TIMI STEMI (0–14). Skor dihitung server
// (rawat-inap-service/src/services/ccu-skor.js); bobot perlu disahkan KSM Jantung sebelum dipakai keputusan resmi.
const props = defineProps<{ perawatanUuid: string; aktif: boolean }>();
const storeUtils = utilsStore();
const ccuStore = useCcuStore();

const JENIS = [
  { value: "killip", label: "Kelas Killip" },
  { value: "timi_nste", label: "TIMI UA/NSTEMI" },
  { value: "timi_stemi", label: "TIMI STEMI" },
];
const LABEL_JENIS: Record<string, string> = { killip: "Killip", timi_nste: "TIMI UA/NSTEMI", timi_stemi: "TIMI STEMI" };
const KILLIP_OPSI = [
  { value: 1, label: "I — tanpa tanda gagal jantung" },
  { value: 2, label: "II — ronki/S3, JVP meningkat" },
  { value: 3, label: "III — edema paru akut" },
  { value: 4, label: "IV — syok kardiogenik" },
];
const BUTIR_NSTE = [
  { kunci: "usiaLanjut", label: "Usia ≥ 65 tahun" },
  { kunci: "tigaFaktorRisiko", label: "≥ 3 faktor risiko PJK" },
  { kunci: "pjkDiketahui", label: "Stenosis koroner ≥ 50% diketahui" },
  { kunci: "aspirinSeminggu", label: "Aspirin dalam 7 hari terakhir" },
  { kunci: "anginaBerat", label: "Angina berat (≥ 2 episode/24 jam)" },
  { kunci: "deviasiSt", label: "Deviasi ST ≥ 0,5 mm" },
  { kunci: "penandaPositif", label: "Penanda jantung positif" },
];

const riwayat = ref<any[]>([]);
const jenis = ref("killip");
const waktuPenilaian = ref(new Date());
const catatan = ref("");
const killip = ref<number>(1);
const nste = ref<Record<string, boolean>>(Object.fromEntries(BUTIR_NSTE.map((b) => [b.kunci, false])));
const stemi = ref({
  umur: null as number | null,
  dmHtAngina: false,
  sistolik: null as number | null,
  lajuJantung: null as number | null,
  killip: 1,
  beratBadan: null as number | null,
  steAnteriorLbbb: false,
  waktuTerapiJam: null as number | null,
});
const galat = ref("");

const muat = async () => {
  if (!props.perawatanUuid) return;
  const res = await ccuStore.getSkor(props.perawatanUuid);
  riwayat.value = res?.payload ?? [];
};

const parameter = () => {
  if (jenis.value === "killip") return { kelas: killip.value };
  if (jenis.value === "timi_nste") return { ...nste.value };
  const s = stemi.value;
  if ([s.umur, s.sistolik, s.lajuJantung, s.beratBadan, s.waktuTerapiJam].some((v) => v === null || (v as any) === "")) return null;
  return { ...s };
};

const simpan = async () => {
  galat.value = "";
  const p = parameter();
  if (!p) return (galat.value = "Lengkapi semua isian TIMI STEMI");
  storeUtils.setLoading(true);
  try {
    const res = await ccuStore.tambahSkor(props.perawatanUuid, {
      jenis: jenis.value,
      waktuPenilaian: Math.floor(waktuPenilaian.value.getTime() / 1000),
      parameter: p,
      catatan: catatan.value || undefined,
    });
    if (res?.payload) {
      catatan.value = "";
      await muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const warnaKategori = (k?: string) => (k === "tinggi" ? "text-danger-400" : k === "sedang" ? "text-warning-400" : "");

watch(() => props.perawatanUuid, muat);
onMounted(muat);
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="aktif" class="p-4 border rounded-lg border-grey-75">
      <div class="mb-2 font-semibold">Penilaian Skor Risiko</div>
      <div class="grid grid-cols-3 gap-3">
        <CustomSelect v-model="jenis" label="Jenis skor" :options="JENIS" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
        <CustomDatePicker v-model="waktuPenilaian" label="Waktu penilaian" showTime />
        <div />
        <template v-if="jenis === 'killip'">
          <CustomSelect v-model="killip" label="Kelas Killip" :options="KILLIP_OPSI" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" class="col-span-2" />
        </template>
        <template v-else-if="jenis === 'timi_nste'">
          <div v-for="b in BUTIR_NSTE" :key="b.kunci" class="flex items-center gap-2">
            <Checkbox v-model="nste[b.kunci]" binary :inputId="`ccu-nste-${b.kunci}`" />
            <label :for="`ccu-nste-${b.kunci}`" class="text-sm">{{ b.label }}</label>
          </div>
        </template>
        <template v-else>
          <CustomTextfield v-model.number="stemi.umur" label="Usia (tahun)" type="number" />
          <CustomTextfield v-model.number="stemi.sistolik" label="TD sistolik (mmHg)" type="number" />
          <CustomTextfield v-model.number="stemi.lajuJantung" label="Laju jantung (x/mnt)" type="number" />
          <CustomSelect v-model="stemi.killip" label="Kelas Killip" :options="KILLIP_OPSI" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
          <CustomTextfield v-model.number="stemi.beratBadan" label="Berat badan (kg)" type="number" />
          <CustomTextfield v-model.number="stemi.waktuTerapiJam" label="Onset → terapi (jam)" type="number" />
          <div class="flex items-center gap-2">
            <Checkbox v-model="stemi.dmHtAngina" binary inputId="ccu-stemi-dm" />
            <label for="ccu-stemi-dm" class="text-sm">DM, hipertensi, atau riwayat angina</label>
          </div>
          <div class="flex items-center gap-2">
            <Checkbox v-model="stemi.steAnteriorLbbb" binary inputId="ccu-stemi-ste" />
            <label for="ccu-stemi-ste" class="text-sm">Elevasi ST anterior atau LBBB</label>
          </div>
        </template>
        <CustomTextArea v-model="catatan" label="Catatan" class="col-span-3" />
      </div>
      <div v-if="galat" class="mt-2 text-sm text-danger-300">{{ galat }}</div>
      <div class="flex justify-end mt-3">
        <CustomButton label="Hitung & Simpan Skor" icon="PhPlus" @click="simpan" />
      </div>
    </div>

    <NoData v-if="!riwayat.length" />
    <DataTable v-else :value="riwayat" stripedRows class="text-xs">
      <Column header="Waktu" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ tampilWaktu(d.waktuPenilaian) }}</template></Column>
      <Column header="Skor" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ LABEL_JENIS[d.jenis] ?? d.jenis }}</template></Column>
      <Column header="Hasil" headerClass="bg-opensimrs-50">
        <template #body="{ data: d }">
          <span class="font-semibold">{{ d.jenis === "killip" ? `Kelas ${d.totalSkor}` : d.totalSkor }}</span>
          <span v-if="d.jenis !== 'killip'" :class="['ml-1 font-semibold', warnaKategori(d.kategori)]">risiko {{ d.kategori }}</span>
          <div v-else class="text-grey-400">{{ d.kategori }}</div>
        </template>
      </Column>
      <Column header="Penilai" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.penilai }}</template></Column>
      <Column header="Catatan" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.catatan ?? "-" }}</template></Column>
    </DataTable>
  </div>
</template>
