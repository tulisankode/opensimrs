<script lang="ts" setup>
import { computed, onMounted, ref, watch } from "vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import PilihPemeriksaanRadiologi from "./PilihPemeriksaanRadiologi.vue";
import { utilsStore } from "@/stores/utils";
import {
  STATUS_ITEM_RAD,
  STATUS_ORDER_RAD,
  buatOrderRad,
  detailOrderRad,
  orderKunjunganRad,
  rupiahRad,
  waktuRad,
} from "@/stores/penunjang/radiologi";
import { createHasilRadPdf } from "@/utils/pdf/pdfRadiologi/cetakRadiologi";

// Order radiologi dari rekam medis (tab Penunjang): form order baru (method "form") + daftar order radiologi
// kunjungan ini beserta status & hasil expertise. Order masuk ke Radiologi › Order dengan sumber RME; tagihan
// dikirim ke tagihan kunjungan saat divalidasi petugas radiologi.
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
  // Riwayat semua order radiologi pasien (tab Cetak Hasil), order kunjungan ini di atas.
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
  const res = await orderKunjunganRad({
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
const items = ref<string[]>([]);
const paket = ref<string[]>([]);
const klinis = ref("");
const catatan = ref("");
const cito = ref(false);
const galat = ref("");

const kirim = async () => {
  galat.value = "";
  if (!rekamMedisUuid.value && !noReg.value) return (galat.value = "Data kunjungan (No. Reg / rekam medis) tidak ditemukan");
  if (!items.value.length && !paket.value.length) return (galat.value = "Pilih minimal satu pemeriksaan atau paket");
  if (!klinis.value.trim()) return (galat.value = "Keterangan klinis wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await buatOrderRad({
      sumber: "rme",
      rekamMedisUuid: rekamMedisUuid.value || undefined,
      noReg: noReg.value || undefined,
      klinis: klinis.value,
      catatan: catatan.value,
      cito: cito.value,
      items: items.value,
      paketUuids: paket.value,
    });
    if (res?.payload) {
      items.value = [];
      paket.value = [];
      klinis.value = "";
      catatan.value = "";
      cito.value = false;
      await muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const cetakHasil = async (uuid: string) => {
  storeUtils.setLoading(true);
  try {
    const res = await detailOrderRad(uuid);
    if (res?.payload) createHasilRadPdf(res.payload);
  } finally {
    storeUtils.setLoading(false);
  }
};

const gayaOrder = (s: string) => STATUS_ORDER_RAD[s as keyof typeof STATUS_ORDER_RAD];
const gayaItem = (s: string) => STATUS_ITEM_RAD[s as keyof typeof STATUS_ITEM_RAD];

// --- expand/collapse dari MedicalRecord / MedicalRecordDetail
const accordion = ref();
const open = () => accordion.value?.open?.();
const close = () => accordion.value?.close?.();
defineExpose({ open, close });
</script>

<template>
  <!-- Mode detail: tampil hanya bila kunjungan memiliki order radiologi -->
  <CustomAccordion v-if="isForm || riwayat || daftar.length" ref="accordion" headerClass="bg-opensimrs-50" :initialState="initialState">
    <template #header>
      <div>{{ isForm ? "Order Radiologi" : "Radiologi" }}</div>
    </template>
    <template #content>
      <div class="flex flex-col gap-5 pt-5">
        <div v-if="isForm" class="flex flex-col gap-4">
          <PilihPemeriksaanRadiologi v-model="items" v-model:paket="paket" />
          <div class="grid grid-cols-2 gap-4">
            <CustomTextArea v-model="klinis" label="Keterangan Klinis / Diagnosis" placeholder="Indikasi pemeriksaan radiologi" required />
            <CustomTextArea v-model="catatan" label="Catatan untuk Radiologi" placeholder="mis. pasien hamil, alergi kontras" />
          </div>
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <Checkbox v-model="cito" binary inputId="rme-rad-cito" />
              <label for="rme-rad-cito" class="text-sm font-semibold text-danger-300">CITO (segera)</label>
            </div>
            <div class="flex items-center gap-3">
              <span v-if="galat" class="text-sm text-danger-300">{{ galat }}</span>
              <CustomButton label="Kirim Order Radiologi" icon="PhPaperPlaneTilt" @click="kirim" />
            </div>
          </div>
        </div>

        <div class="font-semibold text-MD">{{ riwayat ? "Riwayat Order Radiologi Pasien" : "Order Radiologi Kunjungan Ini" }}</div>
        <div v-if="!daftar.length" class="text-normal text-grey-400">
          {{ sudahMuat ? (riwayat ? "Belum ada order radiologi untuk pasien ini." : "Belum ada order radiologi untuk kunjungan ini.") : "Memuat…" }}
        </div>
        <div v-for="o in daftar" :key="o.uuid" class="p-3 border rounded-lg border-grey-75">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2 text-sm">
              <b>{{ o.noOrder }}</b>
              <span class="px-2 py-0.5 rounded-full text-xs font-semibold" :class="[gayaOrder(o.status)?.bg, gayaOrder(o.status)?.text]">
                {{ gayaOrder(o.status)?.label ?? o.status }}
              </span>
              <span v-if="o.cito" class="px-1.5 text-[10px] font-bold text-white rounded bg-danger-300">CITO</span>
              <span v-if="riwayat" class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="kunjunganIni(o) ? 'bg-opensimrs-50 text-opensimrs-300' : 'bg-grey-50 text-grey-400'">
                {{ kunjunganIni(o) ? "Kunjungan ini" : `Kunjungan lain${o.noReg ? " · " + o.noReg : ""}` }}
              </span>
            </div>
            <div class="flex items-center gap-3 text-xs text-grey-400">
              {{ waktuRad(o.createdAt) }} · {{ o.dokterPengirim ?? "-" }}
              <CustomButton v-if="o.jumlahSelesai" label="Cetak Hasil" icon="PhPrinter" size="small" @click="cetakHasil(o.uuid)" />
            </div>
          </div>
          <div v-if="o.klinis" class="mt-1 text-xs text-grey-400">Klinis: {{ o.klinis }}</div>
          <div v-if="o.status === 'batal'" class="mt-1 text-xs text-danger-300">Dibatalkan: {{ o.alasanBatal }}</div>
          <div class="flex flex-col gap-2 mt-2">
            <div v-for="i in o.items" :key="i.uuid" class="text-sm">
              <div class="flex justify-between">
                <span>{{ i.nama }} <span class="text-xs text-grey-300">· {{ i.modalitas }} · {{ rupiahRad(i.harga) }}</span>
                  <span v-if="i.paketNama" class="ml-1 px-1.5 rounded text-[10px] bg-opensimrs-50 text-opensimrs-400">{{ i.paketNama }}</span></span>
                <span class="text-xs font-semibold" :class="gayaItem(i.status)?.text">{{ gayaItem(i.status)?.label ?? i.status }}</span>
              </div>
              <div v-if="i.status === 'selesai'" class="p-2 mt-1 text-xs rounded bg-opensimrs-50">
                <div class="whitespace-pre-line">{{ i.hasil }}</div>
                <div class="mt-1"><b>Kesan:</b> {{ i.kesan }}</div>
                <div class="flex items-center justify-between mt-1 text-grey-400">
                  <span>{{ i.dokterRadiologi ?? "-" }} · {{ waktuRad(i.waktuHasil) }}</span>
                  <CustomButton v-if="i.urlViewer" label="Buka Citra" icon="PhImage" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="() => window.open(i.urlViewer, '_blank', 'noopener')" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </CustomAccordion>
</template>
