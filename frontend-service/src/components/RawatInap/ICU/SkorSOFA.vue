<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { hasPermission } from "@/utils/permissions";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { useIcuStore } from "@/stores/rawatInap/icu";

// Skor SOFA saat masuk & harian (KF-11/KF-12); parameter wajib kosong -> ditandai belum lengkap, bukan mengarang
// nilai (KF-13/KT-9). Rumus & ambang perlu ditinjau & disahkan pemilik klinis sebelum dipakai untuk keputusan klinis
// resmi (lihat rawat-inap-service/src/services/icu-service.js).
const props = defineProps<{ perawatanUuid: string }>();
const storeUtils = utilsStore();
const icuStore = useIcuStore();

const riwayat = ref<any[]>([]);

const kosongForm = () => ({
  waktuPenilaian: new Date(),
  pao2Fio2: null as number | null,
  ventilatorDibantu: false,
  trombosit: null as number | null,
  bilirubin: null as number | null,
  map: null as number | null,
  vasopressor: "tidak_ada" as string,
  gcsTotal: null as number | null,
  kreatinin: null as number | null,
  urineOutputMlHari: null as number | null,
  catatan: "",
});
const form = ref(kosongForm());

const VASOPRESSOR_OPSI = [
  { label: "Tidak ada", value: "tidak_ada" },
  { label: "Dopamin dosis rendah", value: "dopamin_rendah" },
  { label: "Dopamin dosis tinggi", value: "dopamin_tinggi" },
  { label: "Norepinefrin", value: "norepinefrin" },
];

const muat = async () => {
  if (!props.perawatanUuid) return;
  storeUtils.setLoading(true);
  try {
    const res = await icuStore.getSkorSofa(props.perawatanUuid);
    riwayat.value = res?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};

const simpan = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await icuStore.tambahSkorSofa(props.perawatanUuid, {
      waktuPenilaian: Math.floor(form.value.waktuPenilaian.getTime() / 1000),
      pao2Fio2: form.value.pao2Fio2,
      ventilatorDibantu: form.value.ventilatorDibantu,
      trombosit: form.value.trombosit,
      bilirubin: form.value.bilirubin,
      map: form.value.map,
      vasopressor: form.value.vasopressor,
      gcsTotal: form.value.gcsTotal,
      kreatinin: form.value.kreatinin,
      urineOutputMlHari: form.value.urineOutputMlHari,
      catatan: form.value.catatan || undefined,
    });
    if (res?.payload) {
      form.value = kosongForm();
      await muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

watch(() => props.perawatanUuid, muat);
onMounted(muat);
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="p-4 border rounded-lg border-grey-75">
      <div class="mb-2 font-semibold">Penilaian SOFA Baru</div>
      <div class="grid grid-cols-3 gap-3">
        <CustomDatePicker v-model="form.waktuPenilaian" label="Waktu penilaian" showTime />
        <CustomTextfield v-model.number="form.pao2Fio2" label="PaO2/FiO2 (mmHg)" type="number" />
        <div class="flex items-end gap-2 pb-2">
          <Checkbox v-model="form.ventilatorDibantu" binary inputId="sofa-ventilator" />
          <label for="sofa-ventilator" class="text-sm font-semibold">Dibantu ventilator</label>
        </div>
        <CustomTextfield v-model.number="form.trombosit" label="Trombosit (x10³/µL)" type="number" />
        <CustomTextfield v-model.number="form.bilirubin" label="Bilirubin (mg/dL)" type="number" />
        <CustomTextfield v-model.number="form.map" label="MAP (mmHg)" type="number" />
        <CustomSelect v-model="form.vasopressor" label="Vasopressor" :options="VASOPRESSOR_OPSI" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
        <CustomTextfield v-model.number="form.gcsTotal" label="GCS Total" type="number" />
        <CustomTextfield v-model.number="form.kreatinin" label="Kreatinin (mg/dL)" type="number" />
        <CustomTextfield v-model.number="form.urineOutputMlHari" label="Urine output (mL/hari)" type="number" />
        <CustomTextArea v-model="form.catatan" label="Catatan" class="col-span-3" />
      </div>
      <div class="flex justify-end mt-3">
        <CustomButton v-if="hasPermission('ICU', 'Skor SOFA', 'CREATE')" label="Simpan Skor SOFA" icon="PhPlus" @click="simpan" />
      </div>
    </div>

    <NoData v-if="!riwayat.length" />
    <DataTable v-else :value="riwayat" stripedRows class="text-xs">
      <Column header="Waktu" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ new Date(d.waktuPenilaian * 1000).toLocaleString("id-ID") }}</template></Column>
      <Column header="Total Skor" headerClass="bg-opensimrs-50">
        <template #body="{ data: d }">
          <span v-if="d.lengkap" class="font-semibold">{{ d.totalSkor }}</span>
          <span v-else class="font-semibold text-warning-400">Belum lengkap</span>
        </template>
      </Column>
      <Column header="Sub-skor (R/K/H/KV/SP/G)" headerClass="bg-opensimrs-50">
        <template #body="{ data: d }">{{ d.respirasiSkor ?? "-" }}/{{ d.koagulasiSkor ?? "-" }}/{{ d.heparSkor ?? "-" }}/{{ d.kardiovaskularSkor ?? "-" }}/{{ d.sarafPusatSkor ?? "-" }}/{{ d.ginjalSkor ?? "-" }}</template>
      </Column>
      <Column header="Penilai" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.penilai }}</template></Column>
    </DataTable>
  </div>
</template>
