<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import NoData from "@/components/section/NoData.vue";
import DialogBatalEntri from "@/components/RawatInap/CCU/DialogBatalEntri.vue";
import { utilsStore } from "@/stores/utils";
import { useCcuStore, LABEL_IRAMA, IRAMA_BERBAHAYA, opsi, tampilWaktu } from "@/stores/rawatInap/ccu";

// EKG & irama CCU: pencatatan manual EKG 12 sadapan/strip irama (KF-6/KF-11). QTc dihitung server (Bazett). Irama
// berbahaya, elevasi ST, dan QTc ≥ 500 ms ditandai sebagai peringatan — dukungan keputusan, bukan diagnosis.
const props = defineProps<{ perawatanUuid: string; aktif: boolean }>();
const storeUtils = utilsStore();
const ccuStore = useCcuStore();

const riwayat = ref<any[]>([]);
const kosong = () => ({
  waktuRekam: new Date(),
  irama: "sinus",
  lajuJantung: null as number | null,
  intervalPr: null as number | null,
  durasiQrs: null as number | null,
  intervalQt: null as number | null,
  aksis: "normal",
  perubahanSt: "tidak_ada",
  leadSt: "",
  gelombangQ: false,
  blokCabang: "tidak_ada",
  interpretasi: "",
});
const form = ref(kosong());
const galat = ref("");
const peringatanSimpan = ref("");

const AKSIS = [
  { value: "normal", label: "Normal" },
  { value: "deviasi_kiri", label: "Deviasi kiri" },
  { value: "deviasi_kanan", label: "Deviasi kanan" },
  { value: "ekstrem", label: "Ekstrem" },
];
const ST = [
  { value: "tidak_ada", label: "Tidak ada" },
  { value: "elevasi", label: "Elevasi ST" },
  { value: "depresi", label: "Depresi ST" },
];
const BLOK = [
  { value: "tidak_ada", label: "Tidak ada" },
  { value: "rbbb", label: "RBBB" },
  { value: "lbbb", label: "LBBB" },
];

const muat = async () => {
  if (!props.perawatanUuid) return;
  const res = await ccuStore.getEkg(props.perawatanUuid);
  riwayat.value = res?.payload ?? [];
};

const simpan = async () => {
  galat.value = "";
  peringatanSimpan.value = "";
  if (!form.value.waktuRekam) return (galat.value = "Waktu rekam wajib diisi");
  storeUtils.setLoading(true);
  try {
    const f = form.value;
    const res = await ccuStore.tambahEkg(props.perawatanUuid, {
      waktuRekam: Math.floor(f.waktuRekam.getTime() / 1000),
      irama: f.irama,
      lajuJantung: f.lajuJantung,
      intervalPr: f.intervalPr,
      durasiQrs: f.durasiQrs,
      intervalQt: f.intervalQt,
      aksis: f.aksis,
      perubahanSt: f.perubahanSt,
      leadSt: f.leadSt || undefined,
      gelombangQ: f.gelombangQ,
      blokCabang: f.blokCabang,
      interpretasi: f.interpretasi || undefined,
    });
    if (res?.payload) {
      if (res.payload.berbahaya) peringatanSimpan.value = `Irama berbahaya tercatat: ${LABEL_IRAMA[res.payload.ekg.irama]}. Segera laporkan ke dokter.`;
      form.value = kosong();
      await muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const dialogBatal = ref(false);
const dibatalkan = ref<any>(null);
const bukaBatal = (d: any) => {
  dibatalkan.value = d;
  dialogBatal.value = true;
};
const simpanBatal = async (alasan: string) => {
  storeUtils.setLoading(true);
  try {
    const res = await ccuStore.batalEkg(dibatalkan.value.uuid, alasan);
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
      <div class="mb-2 font-semibold">Rekam EKG / Irama Baru</div>
      <div class="grid grid-cols-4 gap-3">
        <CustomDatePicker v-model="form.waktuRekam" label="Waktu rekam" showTime />
        <CustomSelect v-model="form.irama" label="Irama" :options="opsi(LABEL_IRAMA)" optionValue="value" optionLabel="label" :clearable="false" />
        <CustomTextfield v-model.number="form.lajuJantung" label="Laju jantung (x/mnt)" type="number" />
        <CustomSelect v-model="form.aksis" label="Aksis" :options="AKSIS" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
        <CustomTextfield v-model.number="form.intervalPr" label="Interval PR (ms)" type="number" />
        <CustomTextfield v-model.number="form.durasiQrs" label="Durasi QRS (ms)" type="number" />
        <CustomTextfield v-model.number="form.intervalQt" label="Interval QT (ms)" type="number" />
        <CustomSelect v-model="form.blokCabang" label="Blok cabang berkas" :options="BLOK" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
        <CustomSelect v-model="form.perubahanSt" label="Perubahan ST" :options="ST" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
        <CustomTextfield v-model="form.leadSt" label="Sadapan perubahan ST" placeholder="mis. V1–V4" />
        <div class="flex items-end gap-2 pb-2">
          <Checkbox v-model="form.gelombangQ" binary inputId="ccu-gelombang-q" />
          <label for="ccu-gelombang-q" class="text-sm font-semibold">Gelombang Q patologis</label>
        </div>
        <CustomTextArea v-model="form.interpretasi" label="Interpretasi / kesimpulan" class="col-span-4" />
      </div>
      <div v-if="galat" class="mt-2 text-sm text-danger-300">{{ galat }}</div>
      <div v-if="peringatanSimpan" class="px-3 py-2 mt-2 text-sm font-semibold rounded bg-danger-50 text-danger-400">{{ peringatanSimpan }}</div>
      <div class="flex justify-end mt-3">
        <CustomButton label="Simpan EKG" icon="PhPlus" @click="simpan" />
      </div>
    </div>

    <NoData v-if="!riwayat.length" />
    <DataTable v-else :value="riwayat" stripedRows class="text-xs" scrollable scrollHeight="420px">
      <Column header="Waktu" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ tampilWaktu(d.waktuRekam) }}</template></Column>
      <Column header="Irama / Laju" headerClass="bg-opensimrs-50">
        <template #body="{ data: d }">
          <span :class="IRAMA_BERBAHAYA.includes(d.irama) ? 'font-semibold text-danger-400' : ''">{{ LABEL_IRAMA[d.irama] ?? d.irama }}</span>
          · {{ d.lajuJantung ?? "-" }}x/mnt
        </template>
      </Column>
      <Column header="PR / QRS / QT(c)" headerClass="bg-opensimrs-50">
        <template #body="{ data: d }">
          {{ d.intervalPr ?? "-" }} / {{ d.durasiQrs ?? "-" }} / {{ d.intervalQt ?? "-" }}
          <span :class="d.intervalQtc >= 500 ? 'font-semibold text-danger-400' : ''">({{ d.intervalQtc ?? "-" }})</span> ms
        </template>
      </Column>
      <Column header="ST / Q / Blok" headerClass="bg-opensimrs-50">
        <template #body="{ data: d }">
          <span :class="d.perubahanSt === 'elevasi' ? 'font-semibold text-danger-400' : ''">{{ d.perubahanSt === "tidak_ada" ? "ST normal" : `${d.perubahanSt === "elevasi" ? "Elevasi" : "Depresi"} ST ${d.leadSt ?? ""}` }}</span>
          · {{ d.gelombangQ ? "Q+" : "Q-" }} · {{ d.blokCabang && d.blokCabang !== "tidak_ada" ? d.blokCabang.toUpperCase() : "-" }}
        </template>
      </Column>
      <Column header="Interpretasi" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.interpretasi ?? "-" }}</template></Column>
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

    <DialogBatalEntri v-model:visible="dialogBatal" judul="Batalkan Entri EKG" @simpan="simpanBatal" />
  </div>
</template>
