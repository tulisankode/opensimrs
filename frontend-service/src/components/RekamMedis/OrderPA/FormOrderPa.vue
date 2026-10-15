<script lang="ts" setup>
import { computed, onMounted, ref, watch } from "vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import PilihPemeriksaanPa from "./PilihPemeriksaanPa.vue";
import { utilsStore } from "@/stores/utils";
import {
  JENIS_PA,
  SARAN_CARA_AMBIL_PA,
  batalOrderPa,
  buatOrderPa,
  detailOrderPa,
  gayaKasusPa,
  gayaOrderPa,
  izinPa,
  orderKunjunganPa,
  rupiahPa,
  waktuPa,
} from "@/stores/penunjang/patologi";
import { createHasilPaPdf } from "@/utils/pdf/pdfPatologi/cetakPatologi";
import { getLoginUsername } from "@/utils/permissions";

// Order Patologi Anatomi dari rekam medis (tab Penunjang): form order baru (method "form") + daftar order PA
// kunjungan ini beserta status kasus (nomor PA) & kesimpulan. Order masuk ke Patologi Anatomi › Order dengan sumber
// RME; tagihan dikirim ke tagihan kunjungan saat divalidasi petugas PA. Props & perilaku sama dengan
// FormOrderRadiologi (riwayat = semua order pasien, kunjungan ini di atas).
const props = defineProps({
  method: {
    type: String as () => "form" | "detail",
    default: "detail",
  },
  initialState: {
    type: String,
    default: "null",
  },
  patientData: {
    type: Object,
    default: () => ({}),
  },
  rmType: {
    type: String,
    default: "rawat-jalan",
  },
  rmDate: {
    type: [String, Number],
    default: "",
  },
  // Rekam medis kunjungan bila patientData tidak memuatnya (mis. dari MedicalRecordDetail).
  rmUuid: {
    type: String,
    default: "",
  },
  // Riwayat semua order PA pasien (tab Cetak Hasil), order kunjungan ini di atas.
  riwayat: {
    type: Boolean,
    default: false,
  },
});

const storeUtils = utilsStore();
const isForm = computed(() => props.method === "form");

// Konteks kunjungan (bentuk data RJ/IGD langsung, RI di patientData.rawatInap).
const kunjungan = computed(() => (props.patientData?.rawatInap ? props.patientData.rawatInap : props.patientData) ?? {});
const rekamMedisUuid = computed(() => props.patientData?.rekamMedisUuid ?? kunjungan.value?.rekamMedisUuid ?? props.rmUuid ?? "");
const noReg = computed(() => kunjungan.value?.noReg ?? props.patientData?.noReg ?? "");
const patientUuid = computed(() => kunjungan.value?.patientUuid ?? props.patientData?.patientUuid ?? props.patientData?.patient?.uuid ?? "");
const kunjunganIni = (o: any) => (noReg.value && o.noReg === noReg.value) || (rekamMedisUuid.value && o.rekamMedisUuid === rekamMedisUuid.value);

// ── Daftar order kunjungan
const daftar = ref<any[]>([]);
const sudahMuat = ref(false);
const muat = async () => {
  if (!rekamMedisUuid.value && !noReg.value && !(props.riwayat && patientUuid.value)) return;
  const res = await orderKunjunganPa({
    rekamMedisUuid: rekamMedisUuid.value || undefined,
    noReg: noReg.value || undefined,
    patientUuid: (props.riwayat && patientUuid.value) || undefined,
  });
  const data: any[] = res?.payload ?? [];
  daftar.value = props.riwayat ? [...data.filter(kunjunganIni), ...data.filter((o) => !kunjunganIni(o))] : data;
  sudahMuat.value = true;
};
onMounted(muat);
watch([rekamMedisUuid, noReg, patientUuid], muat);

// ── Form order baru
const pemilih = ref<InstanceType<typeof PilihPemeriksaanPa>>();
const items = ref<string[]>([]);
const induk = ref("");
const klinis = ref("");
const riwayatKlinis = ref("");
const lokasiAnatomi = ref("");
const caraPengambilan = ref("");
const catatan = ref("");
const cito = ref(false);
const galat = ref("");

const kirim = async () => {
  galat.value = "";
  if (!rekamMedisUuid.value && !noReg.value) return (galat.value = "Data kunjungan (No. Reg / rekam medis) tidak ditemukan");
  if (!items.value.length) return (galat.value = "Pilih minimal satu pemeriksaan PA");
  if (pemilih.value?.adaIhk && !induk.value) return (galat.value = "Pilih kasus PA induk untuk pemeriksaan IHK");
  if (!klinis.value.trim()) return (galat.value = "Data klinis / diagnosis klinis wajib diisi");
  if (!lokasiAnatomi.value.trim()) return (galat.value = "Lokasi / organ asal jaringan wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await buatOrderPa({
      sumber: "rme",
      rekamMedisUuid: rekamMedisUuid.value || undefined,
      noReg: noReg.value || undefined,
      klinis: klinis.value,
      riwayat: riwayatKlinis.value,
      lokasiAnatomi: lokasiAnatomi.value,
      caraPengambilan: caraPengambilan.value,
      catatan: catatan.value,
      cito: cito.value,
      items: pemilih.value?.items ?? items.value.map((u) => ({ pemeriksaanUuid: u })),
    });
    if (res?.payload) {
      items.value = [];
      induk.value = "";
      klinis.value = "";
      riwayatKlinis.value = "";
      lokasiAnatomi.value = "";
      caraPengambilan.value = "";
      catatan.value = "";
      cito.value = false;
      await muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Batal order dari RME: pembuat order (dokter pengirim) selama order belum divalidasi petugas, atau pengguna dengan
// izin Order PA › BATAL (backend memeriksa aturan yang sama).
const sayaPembuat = getLoginUsername();
const bisaBatalRme = (o: any) => isForm.value && o.status === "order" && ((sayaPembuat && o.dibuatOleh === sayaPembuat) || izinPa("Order PA", "BATAL"));
const batalUuid = ref("");
const alasanBatal = ref("");
const galatBatal = ref("");
const mulaiBatal = (o: any) => {
  batalUuid.value = o.uuid;
  alasanBatal.value = "";
  galatBatal.value = "";
};
const konfirmasiBatal = async () => {
  if (!alasanBatal.value.trim()) return (galatBatal.value = "Alasan pembatalan wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await batalOrderPa(batalUuid.value, alasanBatal.value.trim());
    if (res?.payload) {
      batalUuid.value = "";
      await muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const cetakHasil = async (uuid: string) => {
  storeUtils.setLoading(true);
  try {
    const res = await detailOrderPa(uuid);
    if (res?.payload) createHasilPaPdf(res.payload);
  } finally {
    storeUtils.setLoading(false);
  }
};

// --- expand/collapse dari MedicalRecord / MedicalRecordDetail
const accordion = ref();
const open = () => accordion.value?.open?.();
const close = () => accordion.value?.close?.();
defineExpose({ open, close });
</script>

<template>
  <!-- Mode detail: tampil hanya bila kunjungan memiliki order PA -->
  <CustomAccordion v-if="isForm || riwayat || daftar.length" ref="accordion" headerClass="bg-opensimrs-50" :initialState="initialState">
    <template #header>
      <div>{{ isForm ? "Order Patologi Anatomi" : "Patologi Anatomi" }}</div>
    </template>
    <template #content>
      <div class="flex flex-col gap-5 pt-5">
        <div v-if="isForm" class="flex flex-col gap-4">
          <PilihPemeriksaanPa ref="pemilih" v-model="items" v-model:induk="induk" :patientUuid="patientUuid" />
          <div class="grid grid-cols-2 gap-4">
            <label class="flex flex-col gap-1 text-sm font-semibold">
              <span>Lokasi / Organ Asal Jaringan <span class="text-danger-300">*</span></span>
              <InputText v-model="lokasiAnatomi" placeholder="mis. Mammae sinistra kuadran lateral atas" maxlength="200" class="text-sm font-normal" />
            </label>
            <label class="flex flex-col gap-1 text-sm font-semibold">
              Cara Pengambilan
              <InputText v-model="caraPengambilan" list="rme-pa-cara-ambil" placeholder="mis. Biopsi eksisi / FNAB / Kuretase" maxlength="100" class="text-sm font-normal" />
              <datalist id="rme-pa-cara-ambil"><option v-for="c in SARAN_CARA_AMBIL_PA" :key="c" :value="c" /></datalist>
            </label>
            <CustomTextArea v-model="klinis" label="Data Klinis / Diagnosis Klinis" placeholder="Keluhan, temuan klinis, diagnosis kerja" required />
            <CustomTextArea v-model="riwayatKlinis" label="Riwayat Singkat" placeholder="mis. riwayat operasi/PA sebelumnya, HPHT, terapi" />
            <CustomTextArea v-model="catatan" label="Catatan untuk Patologi Anatomi" placeholder="mis. jaringan dikirim menyusul dari OK" class="col-span-2" />
          </div>
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <Checkbox v-model="cito" binary inputId="rme-pa-cito" />
              <label for="rme-pa-cito" class="text-sm font-semibold text-danger-300">CITO (segera)</label>
            </div>
            <div class="flex items-center gap-3">
              <span v-if="galat" class="text-sm text-danger-300">{{ galat }}</span>
              <CustomButton label="Kirim Order PA" icon="PhPaperPlaneTilt" @click="kirim" />
            </div>
          </div>
        </div>

        <div class="font-semibold text-MD">{{ riwayat ? "Riwayat Order Patologi Anatomi Pasien" : "Order Patologi Anatomi Kunjungan Ini" }}</div>
        <div v-if="!daftar.length" class="text-normal text-grey-400">
          {{ sudahMuat ? (riwayat ? "Belum ada order PA untuk pasien ini." : "Belum ada order PA untuk kunjungan ini.") : "Memuat…" }}
        </div>
        <div v-for="o in daftar" :key="o.uuid" class="p-3 border rounded-lg border-grey-75">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2 text-sm">
              <b>{{ o.noOrder }}</b>
              <span class="px-2 py-0.5 rounded-full text-xs font-semibold" :class="[gayaOrderPa(o.status)?.bg, gayaOrderPa(o.status)?.text]">
                {{ gayaOrderPa(o.status)?.label ?? o.status }}
              </span>
              <span v-if="o.cito" class="px-1.5 text-[10px] font-bold text-white rounded bg-danger-300">CITO</span>
              <span v-if="riwayat" class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="kunjunganIni(o) ? 'bg-opensimrs-50 text-opensimrs-300' : 'bg-grey-50 text-grey-400'">
                {{ kunjunganIni(o) ? "Kunjungan ini" : `Kunjungan lain${o.noReg ? " · " + o.noReg : ""}` }}
              </span>
            </div>
            <div class="flex items-center gap-3 text-xs text-grey-400">
              <span>{{ waktuPa(o.createdAt) }} · {{ o.dokterPengirim ?? "-" }}<template v-if="o.lokasiAsal"> · {{ o.lokasiAsal }}</template></span>
              <CustomButton v-if="bisaBatalRme(o) && batalUuid !== o.uuid" label="Batalkan" icon="PhXCircle" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="mulaiBatal(o)" />
              <CustomButton v-if="o.jumlahSelesai" label="Cetak Hasil" icon="PhPrinter" size="small" @click="cetakHasil(o.uuid)" />
            </div>
          </div>
          <div v-if="o.klinis" class="mt-1 text-xs text-grey-400">Klinis: {{ o.klinis }}<span v-if="o.lokasiAnatomi"> · Lokasi: {{ o.lokasiAnatomi }}</span></div>
          <div v-if="o.status === 'batal'" class="mt-1 text-xs text-danger-300">Dibatalkan: {{ o.alasanBatal }}</div>
          <div v-if="batalUuid === o.uuid" class="flex flex-wrap items-center gap-2 p-2 mt-2 rounded-lg bg-danger-50">
            <InputText v-model="alasanBatal" placeholder="Alasan pembatalan (wajib)" maxlength="255" class="text-sm grow min-w-[240px]" @keydown.enter="konfirmasiBatal" />
            <CustomButton label="Ya, Batalkan" size="small" backgroundColor="bg-danger-300" @click="konfirmasiBatal" />
            <CustomButton label="Kembali" size="small" outlined borderColor="border-grey-200" textColor="text-grey-400" @click="batalUuid = ''" />
            <span v-if="galatBatal" class="w-full text-xs text-danger-300">{{ galatBatal }}</span>
          </div>
          <div class="flex flex-col gap-2 mt-2">
            <div v-for="i in o.items" :key="i.uuid" class="text-sm">
              <div class="flex justify-between gap-2">
                <span>
                  <b v-if="i.noPa" class="mr-1">{{ i.noPa }}</b>{{ i.nama }}
                  <span class="text-xs text-grey-300">· {{ JENIS_PA[i.jenis as keyof typeof JENIS_PA]?.singkat ?? i.jenis }} · {{ rupiahPa(i.harga) }}</span>
                  <span v-if="i.noPaInduk" class="ml-1 text-xs text-grey-400">(blok {{ i.noPaInduk }})</span>
                </span>
                <span v-if="o.status === 'batal'" class="text-xs font-semibold text-grey-400">Dibatalkan</span>
                <span v-else class="text-xs font-semibold whitespace-nowrap" :class="gayaKasusPa(i.status)?.text">{{ gayaKasusPa(i.status)?.label ?? i.status }}</span>
              </div>
              <div v-if="i.status === 'ditolak' && i.alasanTolak" class="mt-1 text-xs text-danger-300">Spesimen ditolak: {{ i.alasanTolak }}</div>
              <div v-if="i.status === 'selesai'" class="p-2 mt-1 text-xs rounded bg-opensimrs-50">
                <div class="font-semibold whitespace-pre-line">{{ i.diagnosis }}</div>
                <div v-if="i.icdOMorfologi || i.icd10" class="mt-1 text-grey-500">
                  ICD-O: {{ [i.icdOTopografi, i.icdOMorfologi].filter(Boolean).join(" · ") || "-" }} · ICD-10: {{ i.icd10 ?? "-" }}
                </div>
                <div class="mt-1 text-grey-400">{{ i.dokterPaNama ?? "-" }} · {{ waktuPa(i.waktuVerifikasi) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </CustomAccordion>
</template>
