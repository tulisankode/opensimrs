<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import NoData from "@/components/section/NoData.vue";
import DialogBatalEntri from "@/components/RawatInap/CCU/DialogBatalEntri.vue";
import { utilsStore } from "@/stores/utils";
import { useCcuStore, LABEL_PENANDA, opsi, tampilWaktu } from "@/stores/rawatInap/ccu";

// Penanda jantung serial (troponin/hs-troponin, CK-MB, NT-proBNP, elektrolit). Batas atas rujukan diisi dari
// laboratorium faskes (mis. persentil 99 troponin); sistem menandai nilai di atas batas & menghitung delta antar-sampel
// berjenis sama. Hasil dari LIS dapat disalin dengan sumber "lab" + nomor rujukan lab.
const props = defineProps<{ perawatanUuid: string; aktif: boolean }>();
const storeUtils = utilsStore();
const ccuStore = useCcuStore();

const riwayat = ref<any[]>([]);
const SATUAN_BAWAAN: Record<string, string> = {
  troponin_i: "ng/mL", troponin_t: "ng/mL", hs_troponin_i: "ng/L", hs_troponin_t: "ng/L", ck_mb: "U/L", ck: "U/L",
  nt_probnp: "pg/mL", bnp: "pg/mL", d_dimer: "µg/mL", kalium: "mmol/L", magnesium: "mg/dL",
};
const kosong = () => ({
  waktuSampel: new Date(),
  jenis: "hs_troponin_i",
  nilai: null as number | null,
  satuan: SATUAN_BAWAAN.hs_troponin_i,
  batasAtas: null as number | null,
  sumber: "manual",
  referensiLab: "",
  catatan: "",
});
const form = ref(kosong());
const galat = ref("");
watch(() => form.value.jenis, (j) => (form.value.satuan = SATUAN_BAWAAN[j] ?? form.value.satuan));

const muat = async () => {
  if (!props.perawatanUuid) return;
  const res = await ccuStore.getPenanda(props.perawatanUuid);
  riwayat.value = res?.payload ?? [];
};

const simpan = async () => {
  galat.value = "";
  if (form.value.nilai === null || form.value.nilai === undefined || (form.value.nilai as any) === "") return (galat.value = "Nilai wajib diisi");
  if (!form.value.satuan) return (galat.value = "Satuan wajib diisi");
  storeUtils.setLoading(true);
  try {
    const f = form.value;
    const res = await ccuStore.tambahPenanda(props.perawatanUuid, {
      waktuSampel: Math.floor(f.waktuSampel.getTime() / 1000),
      jenis: f.jenis,
      nilai: f.nilai,
      satuan: f.satuan,
      batasAtas: f.batasAtas,
      sumber: f.sumber,
      referensiLab: f.referensiLab || undefined,
      catatan: f.catatan || undefined,
    });
    if (res?.payload) {
      const jenis = f.jenis;
      const batas = f.batasAtas;
      form.value = { ...kosong(), jenis, satuan: f.satuan, batasAtas: batas };
      await muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// Tren troponin (entri aktif) untuk grafik.
const tren = computed(() => [...riwayat.value].filter((d) => !d.dibatalkanPada && d.jenis.includes("troponin")).reverse());
const chartData = computed(() => ({
  labels: tren.value.map((t) => new Date(t.waktuSampel * 1000).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })),
  datasets: [
    { label: "Troponin", data: tren.value.map((t) => Number(t.nilai)), borderColor: "#ef4444", tension: 0.3 },
    { label: "Batas atas rujukan", data: tren.value.map((t) => (t.batasAtas !== null ? Number(t.batasAtas) : null)), borderColor: "#9ca3af", borderDash: [4, 4] },
  ],
}));
const chartOptions = { responsive: true, aspectRatio: 3, plugins: { legend: { display: true, position: "bottom" } } };

const dialogBatal = ref(false);
const dibatalkan = ref<any>(null);
const bukaBatal = (d: any) => {
  dibatalkan.value = d;
  dialogBatal.value = true;
};
const simpanBatal = async (alasan: string) => {
  storeUtils.setLoading(true);
  try {
    const res = await ccuStore.batalPenanda(dibatalkan.value.uuid, alasan);
    if (res?.payload) {
      dialogBatal.value = false;
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
    <div v-if="aktif" class="p-4 border rounded-lg border-grey-75">
      <div class="mb-2 font-semibold">Hasil Penanda Jantung Baru</div>
      <div class="grid grid-cols-4 gap-3">
        <CustomDatePicker v-model="form.waktuSampel" label="Waktu sampel" showTime />
        <CustomSelect v-model="form.jenis" label="Pemeriksaan" :options="opsi(LABEL_PENANDA)" optionValue="value" optionLabel="label" :clearable="false" />
        <CustomTextfield v-model.number="form.nilai" label="Nilai" type="number" />
        <CustomTextfield v-model="form.satuan" label="Satuan" />
        <CustomTextfield v-model.number="form.batasAtas" label="Batas atas rujukan" type="number" />
        <CustomSelect
          v-model="form.sumber"
          label="Sumber"
          :options="[{ value: 'manual', label: 'Input manual' }, { value: 'lab', label: 'Salin hasil laboratorium' }]"
          optionValue="value"
          optionLabel="label"
          :showFilter="false"
          :clearable="false"
        />
        <CustomTextfield v-if="form.sumber === 'lab'" v-model="form.referensiLab" label="No. order / rujukan lab" />
        <CustomTextfield v-model="form.catatan" label="Catatan" />
      </div>
      <div v-if="galat" class="mt-2 text-sm text-danger-300">{{ galat }}</div>
      <div class="flex justify-end mt-3">
        <CustomButton label="Simpan Hasil" icon="PhPlus" @click="simpan" />
      </div>
    </div>

    <div v-if="tren.length > 1" class="p-4 border rounded-lg border-grey-75">
      <div class="mb-2 font-semibold">Tren Troponin</div>
      <Chart type="line" :data="chartData" :options="chartOptions" />
    </div>

    <NoData v-if="!riwayat.length" />
    <DataTable v-else :value="riwayat" stripedRows class="text-xs" scrollable scrollHeight="420px">
      <Column header="Waktu sampel" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ tampilWaktu(d.waktuSampel) }}</template></Column>
      <Column header="Pemeriksaan" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ LABEL_PENANDA[d.jenis] ?? d.jenis }}</template></Column>
      <Column header="Nilai" headerClass="bg-opensimrs-50">
        <template #body="{ data: d }">
          <span :class="d.diAtasBatas ? 'font-semibold text-danger-400' : ''">{{ Number(d.nilai) }} {{ d.satuan }}</span>
          <span v-if="d.batasAtas !== null" class="text-grey-400"> (≤ {{ Number(d.batasAtas) }})</span>
        </template>
      </Column>
      <Column header="Delta" headerClass="bg-opensimrs-50">
        <template #body="{ data: d }">
          <span v-if="d.delta !== null">{{ d.delta > 0 ? "+" : "" }}{{ d.delta }}<span v-if="d.deltaPersen !== null"> ({{ d.deltaPersen > 0 ? "+" : "" }}{{ d.deltaPersen }}%)</span></span>
          <span v-else>-</span>
        </template>
      </Column>
      <Column header="Sumber" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.sumber === "lab" ? `Lab ${d.referensiLab ?? ""}` : "Manual" }}</template></Column>
      <Column header="Pencatat" headerClass="bg-opensimrs-50">
        <template #body="{ data: d }">
          {{ d.pencatat }}
          <div v-if="d.dibatalkanPada" class="text-[10px] font-semibold text-warning-400">Dibatalkan {{ d.dibatalkanOleh }}: {{ d.alasanBatal }}</div>
        </template>
      </Column>
      <Column header="" headerClass="bg-opensimrs-50">
        <template #body="{ data: d }">
          <CustomButton v-if="!d.dibatalkanPada" label="Batalkan" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="bukaBatal(d)" />
        </template>
      </Column>
    </DataTable>

    <DialogBatalEntri v-model:visible="dialogBatal" judul="Batalkan Hasil Penanda Jantung" @simpan="simpanBatal" />
  </div>
</template>
