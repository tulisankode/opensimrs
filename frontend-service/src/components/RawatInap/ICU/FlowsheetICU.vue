<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { useIcuStore } from "@/stores/rawatInap/icu";

// Flowsheet observasi ICU: input per jam/interval (KF-4/KF-5), tren 24 jam dalam satu layar (KF-6), dan koreksi
// berjejak tanpa menimpa riwayat (KF-7/KT-5).
const props = defineProps<{ perawatanUuid: string }>();
const storeUtils = utilsStore();
const icuStore = useIcuStore();

const observasi = ref<any[]>([]);
const tren = ref<any[]>([]);

const kosongForm = () => ({
  waktuPengukuran: new Date(),
  tekananSistolik: null as number | null,
  tekananDiastolik: null as number | null,
  nadi: null as number | null,
  suhu: null as number | null,
  lajuNapas: null as number | null,
  spo2: null as number | null,
  gcsE: null as number | null,
  gcsV: null as number | null,
  gcsM: null as number | null,
  skalaNyeri: null as number | null,
  ventilatorTerpasang: false,
  ventilatorMode: "",
  ventilatorFio2: null as number | null,
  ventilatorPeep: null as number | null,
  ventilatorTidalVolume: null as number | null,
  ventilatorLajuNapas: null as number | null,
  catatan: "",
});
const form = ref(kosongForm());
const galat = ref("");

const muat = async () => {
  if (!props.perawatanUuid) return;
  storeUtils.setLoading(true);
  try {
    const res = await icuStore.getObservasi(props.perawatanUuid);
    observasi.value = res?.payload?.observasi ?? [];
    tren.value = res?.payload?.tren ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};

const simpan = async () => {
  galat.value = "";
  if (!form.value.waktuPengukuran) return (galat.value = "Waktu pengukuran wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await icuStore.tambahObservasi(props.perawatanUuid, {
      waktuPengukuran: Math.floor(form.value.waktuPengukuran.getTime() / 1000),
      tekananSistolik: form.value.tekananSistolik,
      tekananDiastolik: form.value.tekananDiastolik,
      nadi: form.value.nadi,
      suhu: form.value.suhu,
      lajuNapas: form.value.lajuNapas,
      spo2: form.value.spo2,
      gcsE: form.value.gcsE,
      gcsV: form.value.gcsV,
      gcsM: form.value.gcsM,
      skalaNyeri: form.value.skalaNyeri,
      ventilatorTerpasang: form.value.ventilatorTerpasang,
      ventilatorMode: form.value.ventilatorMode || null,
      ventilatorFio2: form.value.ventilatorFio2,
      ventilatorPeep: form.value.ventilatorPeep,
      ventilatorTidalVolume: form.value.ventilatorTidalVolume,
      ventilatorLajuNapas: form.value.ventilatorLajuNapas,
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

// ── Koreksi
const dialogKoreksi = ref(false);
const observasiDikoreksi = ref<any>(null);
const nilaiKoreksi = ref<Record<string, any>>({});
const alasanKoreksi = ref("");
const bukaKoreksi = (o: any) => {
  observasiDikoreksi.value = o;
  nilaiKoreksi.value = {
    tekanan_sistolik: o.tekananSistolik,
    tekanan_diastolik: o.tekananDiastolik,
    nadi: o.nadi,
    suhu: o.suhu,
    spo2: o.spo2,
  };
  alasanKoreksi.value = "";
  dialogKoreksi.value = true;
};
const simpanKoreksi = async () => {
  if (!alasanKoreksi.value.trim()) return;
  storeUtils.setLoading(true);
  try {
    const res = await icuStore.koreksiObservasi(observasiDikoreksi.value.uuid, {
      nilaiBaru: nilaiKoreksi.value,
      alasan: alasanKoreksi.value.trim(),
    });
    if (res?.payload) {
      dialogKoreksi.value = false;
      await muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const chartData = computed(() => ({
  labels: tren.value.map((t) => new Date(t.waktuPengukuran * 1000).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })),
  datasets: [
    { label: "Sistolik", data: tren.value.map((t) => t.tekananSistolik), borderColor: "#ef4444", tension: 0.3 },
    { label: "Diastolik", data: tren.value.map((t) => t.tekananDiastolik), borderColor: "#f59e0b", tension: 0.3 },
    { label: "Nadi", data: tren.value.map((t) => t.nadi), borderColor: "#3b82f6", tension: 0.3 },
    { label: "SpO2", data: tren.value.map((t) => t.spo2), borderColor: "#10b981", tension: 0.3 },
  ],
}));
const chartOptions = { responsive: true, aspectRatio: 2.5, plugins: { legend: { display: true, position: "bottom" } } };

watch(() => props.perawatanUuid, muat);
onMounted(muat);
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="p-4 border rounded-lg border-grey-75">
      <div class="mb-2 font-semibold">Observasi Baru</div>
      <div class="grid grid-cols-4 gap-3">
        <CustomDatePicker v-model="form.waktuPengukuran" label="Waktu pengukuran" showTime />
        <CustomTextfield v-model.number="form.tekananSistolik" label="Sistolik (mmHg)" type="number" />
        <CustomTextfield v-model.number="form.tekananDiastolik" label="Diastolik (mmHg)" type="number" />
        <CustomTextfield v-model.number="form.nadi" label="Nadi (x/mnt)" type="number" />
        <CustomTextfield v-model.number="form.suhu" label="Suhu (°C)" type="number" />
        <CustomTextfield v-model.number="form.lajuNapas" label="Laju napas (x/mnt)" type="number" />
        <CustomTextfield v-model.number="form.spo2" label="SpO2 (%)" type="number" />
        <CustomTextfield v-model.number="form.skalaNyeri" label="Skala nyeri (0-10)" type="number" />
        <CustomTextfield v-model.number="form.gcsE" label="GCS - Eye" type="number" />
        <CustomTextfield v-model.number="form.gcsV" label="GCS - Verbal" type="number" />
        <CustomTextfield v-model.number="form.gcsM" label="GCS - Motorik" type="number" />
        <div class="flex items-end gap-2 pb-2">
          <Checkbox v-model="form.ventilatorTerpasang" binary inputId="icu-ventilator-terpasang" />
          <label for="icu-ventilator-terpasang" class="text-sm font-semibold">Ventilator terpasang</label>
        </div>
        <template v-if="form.ventilatorTerpasang">
          <CustomTextfield v-model="form.ventilatorMode" label="Mode ventilator" placeholder="mis. SIMV, PSV" />
          <CustomTextfield v-model.number="form.ventilatorFio2" label="FiO2 (%)" type="number" />
          <CustomTextfield v-model.number="form.ventilatorPeep" label="PEEP (cmH2O)" type="number" />
          <CustomTextfield v-model.number="form.ventilatorTidalVolume" label="Tidal volume (mL)" type="number" />
          <CustomTextfield v-model.number="form.ventilatorLajuNapas" label="Laju napas ventilator" type="number" />
        </template>
        <CustomTextArea v-model="form.catatan" label="Catatan" class="col-span-4" />
      </div>
      <div v-if="galat" class="mt-2 text-sm text-danger-300">{{ galat }}</div>
      <div class="flex justify-end mt-3">
        <CustomButton label="Simpan Observasi" icon="PhPlus" @click="simpan" />
      </div>
    </div>

    <div v-if="tren.length" class="p-4 border rounded-lg border-grey-75">
      <div class="mb-2 font-semibold">Tren Tanda Vital & SpO2</div>
      <Chart type="line" :data="chartData" :options="chartOptions" />
    </div>

    <NoData v-if="!observasi.length" />
    <DataTable v-else :value="[...observasi].reverse()" stripedRows class="text-xs" scrollable scrollHeight="360px">
      <Column header="Waktu" headerClass="bg-opensimrs-50">
        <template #body="{ data: d }">{{ new Date(d.waktuPengukuran * 1000).toLocaleString("id-ID") }}</template>
      </Column>
      <Column header="TD / Nadi" headerClass="bg-opensimrs-50">
        <template #body="{ data: d }">{{ d.tekananSistolik ?? "-" }}/{{ d.tekananDiastolik ?? "-" }} · {{ d.nadi ?? "-" }}x/mnt</template>
      </Column>
      <Column header="Suhu / SpO2" headerClass="bg-opensimrs-50">
        <template #body="{ data: d }">{{ d.suhu ?? "-" }}°C · {{ d.spo2 ?? "-" }}%</template>
      </Column>
      <Column header="GCS / Nyeri" headerClass="bg-opensimrs-50">
        <template #body="{ data: d }">
          {{ d.gcsTotal ? `E${d.gcsE}V${d.gcsV}M${d.gcsM}=${d.gcsTotal}` : "-" }} · Nyeri {{ d.skalaNyeri ?? "-" }}
        </template>
      </Column>
      <Column header="Ventilator" headerClass="bg-opensimrs-50">
        <template #body="{ data: d }">{{ d.ventilatorTerpasang ? d.ventilatorMode ?? "Terpasang" : "-" }}</template>
      </Column>
      <Column header="Pencatat" headerClass="bg-opensimrs-50">
        <template #body="{ data: d }">
          {{ d.pencatat }}
          <span v-if="d.dikoreksi" class="ml-1 text-[10px] font-semibold text-warning-400">(dikoreksi)</span>
        </template>
      </Column>
      <Column header="" headerClass="bg-opensimrs-50">
        <template #body="{ data: d }">
          <CustomButton label="Koreksi" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaKoreksi(d)" />
        </template>
      </Column>
    </DataTable>

    <CustomDialog v-model:visible="dialogKoreksi" width="520px">
      <template #header>Koreksi Observasi</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <div class="grid grid-cols-2 gap-3">
            <CustomTextfield v-model.number="nilaiKoreksi.tekanan_sistolik" label="Sistolik" type="number" />
            <CustomTextfield v-model.number="nilaiKoreksi.tekanan_diastolik" label="Diastolik" type="number" />
            <CustomTextfield v-model.number="nilaiKoreksi.nadi" label="Nadi" type="number" />
            <CustomTextfield v-model.number="nilaiKoreksi.suhu" label="Suhu" type="number" />
            <CustomTextfield v-model.number="nilaiKoreksi.spo2" label="SpO2" type="number" />
          </div>
          <CustomTextArea v-model="alasanKoreksi" label="Alasan koreksi" required />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogKoreksi = false" />
          <CustomButton label="Simpan Koreksi" @click="simpanKoreksi" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
