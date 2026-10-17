<script setup lang="ts">
import { ref, watch } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import { utilsStore } from "@/stores/utils";
import { OPSI_PERAN_TIM_OK, buatJadwalOk, daftarDokterOk, daftarRuangOk, keEpochOk } from "@/stores/penunjang/kamarOperasi";

// Dialog jadwalkan order operasi: pilih ruang OK, tanggal/jam mulai, durasi (dari estimasi order, dapat diubah),
// dan tim operasi (minimal satu operator). Konflik ruang/operator divalidasi oleh backend (KT-5); galat 409
// ditampilkan apa adanya (bukan divalidasi ulang di sisi UI).
const storeUtils = utilsStore();
const visible = defineModel<boolean>("visible", { default: false });
const props = defineProps<{ order?: any | null }>();
const emit = defineEmits<{ (e: "tersimpan", jadwal: any): void }>();

const ruang = ref<any[]>([]);
const dokter = ref<any[]>([]);
const ruangUuid = ref("");
const tanggal = ref<Date>(new Date());
const jamMulai = ref("08:00");
const durasiMenit = ref(60);
const tim = ref<{ practitionerUuid: string; peran: string }[]>([{ practitionerUuid: "", peran: "operator" }]);
const galat = ref("");

const opsiRuang = () => ruang.value.map((r) => ({ value: r.uuid, label: `${r.kode} — ${r.nama}` }));
const opsiDokter = () => dokter.value.map((d) => ({ value: d.uuid, label: d.nama }));

watch(visible, async (v) => {
  if (!v) return;
  galat.value = "";
  tanggal.value = new Date();
  jamMulai.value = "08:00";
  durasiMenit.value = Number(props.order?.durasiEstimasiMenit) || 60;
  ruangUuid.value = "";
  tim.value = [{ practitionerUuid: "", peran: "operator" }];
  storeUtils.setLoading(true);
  try {
    const [resRuang, resDokter] = await Promise.all([daftarRuangOk(true), daftarDokterOk(true)]);
    ruang.value = resRuang?.payload ?? [];
    dokter.value = resDokter?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
});

const tambahTim = () => tim.value.push({ practitionerUuid: "", peran: "asisten" });
const hapusTim = (i: number) => tim.value.splice(i, 1);

const kirim = async () => {
  galat.value = "";
  if (!props.order?.uuid) return;
  if (!ruangUuid.value) return (galat.value = "Pilih ruang OK");
  if (!jamMulai.value) return (galat.value = "Pilih jam mulai");
  if (!durasiMenit.value || durasiMenit.value <= 0) return (galat.value = "Durasi harus lebih dari 0 menit");
  const timTerisi = tim.value.filter((t) => t.practitionerUuid);
  if (!timTerisi.some((t) => t.peran === "operator")) return (galat.value = "Tim operasi wajib memiliki operator");

  const [jam, menit] = jamMulai.value.split(":").map(Number);
  const mulai = new Date(tanggal.value);
  mulai.setHours(jam || 0, menit || 0, 0, 0);
  const waktuMulai = keEpochOk(mulai)!;
  const waktuSelesai = waktuMulai + durasiMenit.value * 60;

  storeUtils.setLoading(true);
  try {
    const res = await buatJadwalOk(props.order.uuid, { ruangUuid: ruangUuid.value, waktuMulai, waktuSelesai, tim: timTerisi });
    if (res?.payload) {
      visible.value = false;
      emit("tersimpan", res.payload);
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
</script>

<template>
  <CustomDialog v-model:visible="visible" width="720px">
    <template #header>Jadwalkan Operasi — {{ order?.noOrder }}</template>
    <template #body>
      <div class="flex flex-col gap-4 pt-4 text-sm">
        <div v-if="order" class="p-3 rounded-lg bg-opensimrs-50">
          <span v-if="order.jenisOperasi === 'cito'" class="px-1.5 mr-1 text-[10px] font-bold text-white rounded bg-danger-300">CITO</span>
          <b>{{ order.namaPasien }}</b> ({{ order.noRm }}) · {{ order.diagnosisNama }}
        </div>
        <div class="grid grid-cols-3 gap-4">
          <CustomSelect v-model="ruangUuid" label="Ruang OK" placeHolder="Pilih ruang" :options="opsiRuang()" optionValue="value" optionLabel="label" required :showFilter="false" />
          <CustomDatePicker v-model="tanggal" label="Tanggal operasi" :minDate="new Date()" />
          <CustomTextfield v-model="jamMulai" type="time" label="Jam Mulai" required />
        </div>
        <CustomTextfield v-model.number="durasiMenit" type="number" label="Durasi (menit)" required />
        <div>
          <div class="flex items-center justify-between mb-1">
            <div class="text-sm font-semibold">Tim Operasi</div>
            <CustomButton size="small" icon="PhPlus" label="Tambah Anggota" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="tambahTim" />
          </div>
          <div v-for="(t, i) in tim" :key="i" class="grid grid-cols-[1fr_200px_40px] gap-2 mb-2">
            <CustomSelect v-model="t.practitionerUuid" placeHolder="Pilih petugas" :options="opsiDokter()" optionValue="value" optionLabel="label" />
            <CustomSelect v-model="t.peran" :options="OPSI_PERAN_TIM_OK" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
            <CustomButton v-if="tim.length > 1" icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="hapusTim(i)" />
          </div>
        </div>
        <div v-if="galat" class="text-sm text-danger-300">{{ galat }}</div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="visible = false" />
        <CustomButton label="Jadwalkan" icon="PhCalendarCheck" @click="kirim" />
      </div>
    </template>
  </CustomDialog>
</template>
