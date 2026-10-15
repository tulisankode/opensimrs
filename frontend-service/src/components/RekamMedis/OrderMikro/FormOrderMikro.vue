<script lang="ts" setup>
import { computed, onMounted, ref, watch } from "vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import PilihPemeriksaanMikro from "./PilihPemeriksaanMikro.vue";
import { utilsStore } from "@/stores/utils";
import {
  KULTUR_MIKRO,
  batalOrderMikro,
  buatOrderMikro,
  detailOrderMikro,
  gayaItemMikro,
  gayaOrderMikro,
  izinMikro,
  namaSpesimen,
  orderKunjunganMikro,
  rupiahMikro,
  waktuMikro,
  type ItemOrderMikroInput,
} from "@/stores/penunjang/mikrobiologi";
import { createHasilMikroPdf } from "@/utils/pdf/pdfMikrobiologi/cetakMikrobiologi";
import { getLoginUsername } from "@/utils/permissions";

// Order mikrobiologi dari rekam medis (tab Penunjang): form order baru (method "form") — pemeriksaan + jenis spesimen +
// sumber/lokasi, keterangan klinis & antibiotik yang sedang diberikan — dan daftar order mikrobiologi kunjungan ini
// (atau riwayat pasien) beserta status laporan sementara/final, organisme, dan Cetak Hasil. Order masuk ke
// Mikrobiologi › Order dengan sumber RME; tagihan ke tagihan kunjungan saat divalidasi petugas.
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
  // Riwayat semua order mikrobiologi pasien (tab Cetak Hasil), order kunjungan ini di atas.
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

// ── Daftar order kunjungan / riwayat
const daftar = ref<any[]>([]);
const sudahMuat = ref(false);
const muat = async () => {
  if (!rekamMedisUuid.value && !noReg.value && !(props.riwayat && patientUuid.value)) return;
  const res = await orderKunjunganMikro({
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
const items = ref<ItemOrderMikroInput[]>([]);
const klinis = ref("");
const antibiotikSedang = ref("");
const catatan = ref("");
const cito = ref(false);
const galat = ref("");
const komponenPilih = ref(0);

const kirim = async () => {
  galat.value = "";
  if (!rekamMedisUuid.value && !noReg.value) return (galat.value = "Data kunjungan (No. Reg / rekam medis) tidak ditemukan");
  const terisi = items.value.filter((i) => i.pemeriksaanUuid);
  if (!terisi.length) return (galat.value = "Pilih minimal satu pemeriksaan");
  if (terisi.some((i) => !i.jenisSpesimen)) return (galat.value = "Jenis spesimen wajib dipilih pada setiap pemeriksaan");
  if (!klinis.value.trim()) return (galat.value = "Keterangan klinis / diagnosis wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await buatOrderMikro({
      sumber: "rme",
      rekamMedisUuid: rekamMedisUuid.value || undefined,
      noReg: noReg.value || undefined,
      klinis: klinis.value,
      antibiotikSedang: antibiotikSedang.value,
      catatan: catatan.value,
      cito: cito.value,
      items: terisi,
    });
    if (res?.payload) {
      items.value = [];
      komponenPilih.value++;
      klinis.value = "";
      antibiotikSedang.value = "";
      catatan.value = "";
      cito.value = false;
      await muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const adaHasil = (o: any) => (o.items ?? []).some((i: any) => ["sementara", "final"].includes(i.statusHasil));
// ── Batal order dari RME: pembuat order (dokter pengirim) selama order belum divalidasi petugas, atau pengguna dengan
// izin Order Mikrobiologi › BATAL (backend memeriksa aturan yang sama).
const sayaPembuat = getLoginUsername();
const bisaBatalRme = (o: any) => isForm.value && o.status === "order" && ((sayaPembuat && o.dibuatOleh === sayaPembuat) || izinMikro("Order Mikrobiologi", "BATAL"));
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
    const res = await batalOrderMikro(batalUuid.value, alasanBatal.value.trim());
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
    const res = await detailOrderMikro(uuid);
    if (res?.payload) createHasilMikroPdf(res.payload);
  } finally {
    storeUtils.setLoading(false);
  }
};

// Ringkasan hasil per item untuk tampilan RME (tanpa membuka cetakan).
const ringkas = (i: any) => {
  if (i.status === "ditolak") return `Spesimen ditolak${i.alasanTolak ? `: ${i.alasanTolak}` : ""}`;
  const bagian = [i.kulturStatus ? KULTUR_MIKRO[i.kulturStatus] ?? i.kulturStatus : null, i.organisme].filter(Boolean);
  return bagian.join(" — ");
};

// --- expand/collapse dari MedicalRecord / MedicalRecordDetail
const accordion = ref();
const open = () => accordion.value?.open?.();
const close = () => accordion.value?.close?.();
defineExpose({ open, close });
</script>

<template>
  <!-- Mode detail: tampil hanya bila kunjungan memiliki order mikrobiologi -->
  <CustomAccordion v-if="isForm || riwayat || daftar.length" ref="accordion" headerClass="bg-opensimrs-50" :initialState="initialState">
    <template #header>
      <div>{{ isForm ? "Order Mikrobiologi" : "Mikrobiologi" }}</div>
    </template>
    <template #content>
      <div class="flex flex-col gap-5 pt-5">
        <div v-if="isForm" class="flex flex-col gap-4">
          <PilihPemeriksaanMikro :key="komponenPilih" v-model="items" />
          <div class="grid grid-cols-3 gap-4">
            <CustomTextArea v-model="klinis" label="Keterangan Klinis / Diagnosis" placeholder="mis. sepsis, ISK berulang, ulkus diabetik" required />
            <CustomTextArea v-model="antibiotikSedang" label="Antibiotik yang Sedang Diberikan" placeholder="mis. Seftriakson 2×1 g sejak 12/10 (kosongkan bila belum)" />
            <CustomTextArea v-model="catatan" label="Catatan untuk Laboratorium" placeholder="mis. curiga TB, spesimen pasca-operasi" />
          </div>
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <Checkbox v-model="cito" binary inputId="rme-mikro-cito" />
              <label for="rme-mikro-cito" class="text-sm font-semibold text-danger-300">CITO (segera)</label>
            </div>
            <div class="flex items-center gap-3">
              <span v-if="galat" class="text-sm text-danger-300">{{ galat }}</span>
              <CustomButton label="Kirim Order Mikrobiologi" icon="PhPaperPlaneTilt" @click="kirim" />
            </div>
          </div>
        </div>

        <div class="font-semibold text-MD">{{ riwayat ? "Riwayat Order Mikrobiologi Pasien" : "Order Mikrobiologi Kunjungan Ini" }}</div>
        <div v-if="!daftar.length" class="text-normal text-grey-400">
          {{ sudahMuat ? (riwayat ? "Belum ada order mikrobiologi untuk pasien ini." : "Belum ada order mikrobiologi untuk kunjungan ini.") : "Memuat…" }}
        </div>
        <div v-for="o in daftar" :key="o.uuid" class="p-3 border rounded-lg border-grey-75">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2 text-sm">
              <b>{{ o.noOrder }}</b>
              <span class="px-2 py-0.5 rounded-full text-xs font-semibold" :class="[gayaOrderMikro(o.status)?.bg, gayaOrderMikro(o.status)?.text]">
                {{ gayaOrderMikro(o.status)?.label ?? o.status }}
              </span>
              <span v-if="o.cito" class="px-1.5 text-[10px] font-bold text-white rounded bg-danger-300">CITO</span>
              <span
                v-if="riwayat"
                class="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                :class="kunjunganIni(o) ? 'bg-opensimrs-50 text-opensimrs-300' : 'bg-grey-50 text-grey-400'"
              >
                {{ kunjunganIni(o) ? "Kunjungan ini" : `Kunjungan lain${o.noReg ? " · " + o.noReg : ""}` }}
              </span>
            </div>
            <div class="flex items-center gap-3 text-xs text-grey-400">
              <span>{{ waktuMikro(o.createdAt) }} · {{ o.dokterPengirim ?? "-" }}<template v-if="o.lokasiAsal"> · {{ o.lokasiAsal }}</template></span>
              <CustomButton v-if="bisaBatalRme(o) && batalUuid !== o.uuid" label="Batalkan" icon="PhXCircle" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="mulaiBatal(o)" />
              <CustomButton v-if="adaHasil(o)" label="Cetak Hasil" icon="PhPrinter" size="small" @click="cetakHasil(o.uuid)" />
            </div>
          </div>
          <div v-if="o.klinis" class="mt-1 text-xs text-grey-400">Klinis: {{ o.klinis }}</div>
          <div v-if="o.antibiotikSedang" class="text-xs text-grey-400">Antibiotik saat ini: {{ o.antibiotikSedang }}</div>
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
                  {{ i.nama }}
                  <span class="text-xs text-grey-300">· {{ namaSpesimen(i.jenisSpesimen) }}{{ i.lokasiSpesimen ? ` (${i.lokasiSpesimen})` : "" }} · {{ rupiahMikro(i.harga) }}</span>
                </span>
                <span v-if="o.status === 'batal'" class="text-xs font-semibold text-grey-400">Dibatalkan</span>
                <span v-else class="text-xs font-semibold whitespace-nowrap" :class="gayaItemMikro(i.status)?.text">{{ gayaItemMikro(i.status)?.label ?? i.status }}</span>
              </div>
              <div v-if="ringkas(i)" class="px-2 py-1 mt-1 text-xs rounded" :class="i.status === 'ditolak' ? 'bg-danger-50 text-danger-300' : 'bg-opensimrs-50'">
                {{ ringkas(i) }}
                <span v-if="i.statusHasil === 'final'" class="text-grey-400"> · Final {{ waktuMikro(i.diverifikasiPada) }} · {{ i.dokterMikro ?? "-" }}</span>
                <span v-else-if="i.statusHasil === 'sementara'" class="text-grey-400"> · Laporan sementara {{ waktuMikro(i.sementaraPada) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </CustomAccordion>
</template>
