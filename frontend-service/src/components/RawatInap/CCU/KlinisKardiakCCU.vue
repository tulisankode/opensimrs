<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import { utilsStore } from "@/stores/utils";
import { useCcuStore, LABEL_SINDROM, opsi, tampilWaktu } from "@/stores/rawatInap/ccu";

// Data klinis kardiak episode CCU: sindrom, waktu onset → kontak medis pertama → tiba RS (dasar door-to-balloon),
// kelas Killip saat masuk, fraksi ejeksi, dan faktor risiko. Satu data per episode; disimpan ulang bila berubah.
const props = defineProps<{ perawatanUuid: string }>();
const emit = defineEmits<{ tersimpan: [] }>();
const storeUtils = utilsStore();
const ccuStore = useCcuStore();

const FAKTOR = [
  { value: "hipertensi", label: "Hipertensi" },
  { value: "diabetes", label: "Diabetes melitus" },
  { value: "dislipidemia", label: "Dislipidemia" },
  { value: "merokok", label: "Merokok" },
  { value: "riwayat_keluarga", label: "Riwayat keluarga PJK dini" },
  { value: "obesitas", label: "Obesitas" },
  { value: "ckd", label: "Penyakit ginjal kronik" },
];
const KILLIP_OPSI = [
  { value: 1, label: "I — tanpa gagal jantung" },
  { value: 2, label: "II — ronki/S3" },
  { value: 3, label: "III — edema paru" },
  { value: 4, label: "IV — syok kardiogenik" },
];

const kosong = () => ({
  sindrom: "",
  lokasiInfark: "",
  waktuOnset: null as Date | null,
  waktuKontakMedisPertama: null as Date | null,
  waktuTibaRs: null as Date | null,
  kelasKillip: null as number | null,
  fraksiEjeksi: null as number | null,
  faktorRisiko: [] as string[],
  catatan: "",
});
const form = ref(kosong());
const tersimpan = ref<any>(null);
const galat = ref("");

const keTanggal = (detik?: number | null) => (detik ? new Date(detik * 1000) : null);
const keDetik = (d: Date | null) => (d ? Math.floor(d.getTime() / 1000) : null);

const muat = async () => {
  if (!props.perawatanUuid) return;
  const res = await ccuStore.getKlinis(props.perawatanUuid);
  const k = res?.payload ?? null;
  tersimpan.value = k;
  form.value = k
    ? {
        sindrom: k.sindrom,
        lokasiInfark: k.lokasiInfark ?? "",
        waktuOnset: keTanggal(k.waktuOnset),
        waktuKontakMedisPertama: keTanggal(k.waktuKontakMedisPertama),
        waktuTibaRs: keTanggal(k.waktuTibaRs),
        kelasKillip: k.kelasKillip ?? null,
        fraksiEjeksi: k.fraksiEjeksi !== null && k.fraksiEjeksi !== undefined ? Number(k.fraksiEjeksi) : null,
        faktorRisiko: k.faktorRisiko ?? [],
        catatan: k.catatan ?? "",
      }
    : kosong();
};

const simpan = async () => {
  galat.value = "";
  if (!form.value.sindrom) return (galat.value = "Sindrom/diagnosis kerja wajib dipilih");
  storeUtils.setLoading(true);
  try {
    const f = form.value;
    const res = await ccuStore.simpanKlinis(props.perawatanUuid, {
      sindrom: f.sindrom,
      lokasiInfark: f.lokasiInfark || undefined,
      waktuOnset: keDetik(f.waktuOnset),
      waktuKontakMedisPertama: keDetik(f.waktuKontakMedisPertama),
      waktuTibaRs: keDetik(f.waktuTibaRs),
      kelasKillip: f.kelasKillip,
      fraksiEjeksi: f.fraksiEjeksi,
      faktorRisiko: f.faktorRisiko,
      catatan: f.catatan || undefined,
    });
    if (res?.payload) {
      await muat();
      emit("tersimpan");
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
      <div class="flex items-center justify-between mb-2">
        <div class="font-semibold">Data Klinis Kardiak</div>
        <div v-if="tersimpan" class="text-xs text-grey-400">
          Terakhir diubah {{ tampilWaktu(tersimpan.updatedAt ?? tersimpan.createdAt) }} · {{ tersimpan.diubahOleh }}
        </div>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <CustomSelect v-model="form.sindrom" label="Sindrom / diagnosis kerja" :options="opsi(LABEL_SINDROM)" optionValue="value" optionLabel="label" required />
        <CustomTextfield v-model="form.lokasiInfark" label="Lokasi infark / lesi" placeholder="mis. anterior, inferior" />
        <CustomSelect v-model="form.kelasKillip" label="Kelas Killip saat masuk" :options="KILLIP_OPSI" optionValue="value" optionLabel="label" :showFilter="false" />
        <CustomDatePicker v-model="form.waktuOnset" label="Onset gejala" showTime />
        <CustomDatePicker v-model="form.waktuKontakMedisPertama" label="Kontak medis pertama (FMC)" showTime />
        <CustomDatePicker v-model="form.waktuTibaRs" label="Tiba di RS (door)" showTime />
        <CustomTextfield v-model.number="form.fraksiEjeksi" label="Fraksi ejeksi (%)" type="number" />
        <div class="col-span-2">
          <div class="mb-1 text-sm font-semibold">Faktor risiko</div>
          <div class="flex flex-wrap gap-3">
            <div v-for="f in FAKTOR" :key="f.value" class="flex items-center gap-1">
              <Checkbox v-model="form.faktorRisiko" :value="f.value" :inputId="`ccu-faktor-${f.value}`" />
              <label :for="`ccu-faktor-${f.value}`" class="text-sm">{{ f.label }}</label>
            </div>
          </div>
        </div>
        <CustomTextArea v-model="form.catatan" label="Catatan" class="col-span-3" />
      </div>
      <div v-if="galat" class="mt-2 text-sm text-danger-300">{{ galat }}</div>
      <div class="flex justify-end mt-3">
        <CustomButton label="Simpan Data Klinis" icon="PhFloppyDisk" @click="simpan" />
      </div>
    </div>
  </div>
</template>
