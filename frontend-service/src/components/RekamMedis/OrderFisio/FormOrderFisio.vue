<script lang="ts" setup>
import { computed, onMounted, ref, watch } from "vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import IsianOrderFisio from "./IsianOrderFisio.vue";
import { utilsStore } from "@/stores/utils";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import {
  apiFisio, isianKosong, labelJenis, labelJam, rupiah, tglIndo, waktuEpoch, STATUS_ORDER, STATUS_JADWAL,
  type IsianOrder, type OrderFisio, type JadwalFisio,
} from "@/stores/penunjang/fisioterapi";
import { cetakAsuhanTerapi, cetakJadwalTerapi } from "@/utils/pdf/pdfFisioterapi/cetakFisioterapi";

// Order fisioterapi dari rekam medis (tab Penunjang › Order Fisio) oleh dokter DPJP: form order baru
// (method "form") + daftar order fisioterapi kunjungan ini beserta status, jadwal sesi & evaluasi.
// Order masuk ke Fisioterapi › Order (sumber RME); tagihan dikirim ke kunjungan saat divalidasi admin fisio.
const props = defineProps({
  method: { type: String as () => "form" | "detail" | string, default: "detail" },
  initialState: { type: String, default: "null" },
  patientData: { type: Object, default: () => ({}) },
  // Rekam medis kunjungan bila patientData tidak memuatnya.
  rmUuid: { type: String, default: "" },
  // Riwayat semua order fisioterapi pasien (tab Cetak Hasil), order kunjungan ini di atas.
  riwayat: { type: Boolean, default: false },
});

const storeUtils = utilsStore();
const rekamMedisStore = useRekamMedisStore();
const isForm = computed(() => props.method === "form");

const kunjungan = computed<any>(() => (props.patientData?.rawatInap ? props.patientData.rawatInap : props.patientData) ?? {});
const rekamMedisUuid = computed<string>(
  () => props.rmUuid || props.patientData?.rekamMedisUuid || kunjungan.value?.rekamMedisUuid || rekamMedisStore.openedRekamMedis?.meta?.rekamMedisUuid || "",
);
const noReg = computed<string>(() => kunjungan.value?.noReg ?? props.patientData?.noReg ?? "");
const patientUuid = computed<string>(() => kunjungan.value?.patientUuid ?? props.patientData?.patientUuid ?? props.patientData?.patient?.uuid ?? "");
const kunjunganIni = (o: any) => Boolean((noReg.value && o.noReg === noReg.value) || (rekamMedisUuid.value && o.rekamMedisUuid === rekamMedisUuid.value));
// Sesi terjadwal (tanpa yang batal) & evaluasi tiap sesi untuk tabel riwayat.
const sesiAktif = (o: OrderFisio) => (o.jadwal ?? []).filter((x: JadwalFisio) => x.status !== "batal");
const evaluasiSesi = (o: OrderFisio, j: JadwalFisio) => (o.evaluasi ?? []).find((e: any) => e.jadwalUuid === j.uuid || (!e.jadwalUuid && e.sesiKe === j.sesiKe));

// ── Daftar order kunjungan (beserta jadwal & evaluasi)
const daftar = ref<OrderFisio[]>([]);
const sudahMuat = ref(false);
const muat = async () => {
  const pakaiRiwayat = props.riwayat && patientUuid.value;
  if (!rekamMedisUuid.value && !noReg.value && !pakaiRiwayat) return;
  // No. Reg mengikat satu kunjungan; uuid rekam medis bisa berbeda antar-dokumen RM kunjungan yang sama.
  const r = await apiFisio.daftarOrder(
    pakaiRiwayat
      ? { patient_uuid: patientUuid.value, limit: 50 }
      : noReg.value
        ? { no_reg: noReg.value, limit: 50 }
        : { rekam_medis_uuid: rekamMedisUuid.value, limit: 50 },
  );
  let ringkas: OrderFisio[] = r?.payload?.data ?? [];
  if (pakaiRiwayat) ringkas = [...ringkas.filter(kunjunganIni), ...ringkas.filter((o) => !kunjunganIni(o))];
  daftar.value = (await Promise.all(ringkas.map((o) => apiFisio.detailOrder(o.uuid)))).map((d, i) => d?.payload ?? ringkas[i]);
  sudahMuat.value = true;
};
onMounted(muat);
watch([rekamMedisUuid, noReg, patientUuid], muat);

// ── Form order baru
const isian = ref<IsianOrder>(isianKosong());
const refIsian = ref<InstanceType<typeof IsianOrderFisio>>();
const galat = ref("");
const kirim = async () => {
  galat.value = "";
  if (!rekamMedisUuid.value && !noReg.value) return (galat.value = "Data kunjungan (rekam medis / No. Reg) tidak ditemukan");
  if (!refIsian.value?.validasi()) return;
  storeUtils.setLoading(true);
  try {
    const r = await apiFisio.buatOrder({
      sumber: "rme",
      rekamMedisUuid: rekamMedisUuid.value || undefined,
      noReg: noReg.value || undefined,
      ...refIsian.value.payload(),
    });
    if (r?.payload) {
      isian.value = isianKosong();
      await muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// Batal order oleh dokter hanya selama belum divalidasi admin fisioterapi.
const batal = async (o: OrderFisio) => {
  const alasan = window.prompt(`Alasan pembatalan order ${o.noOrder}:`);
  if (!alasan?.trim()) return;
  if (await apiFisio.batalOrder(o.uuid, alasan.trim())) muat();
};

// --- expand/collapse dari MedicalRecord / MedicalRecordDetail
const accordion = ref();
const open = () => accordion.value?.open?.();
const close = () => accordion.value?.close?.();
defineExpose({ open, close, muat });
</script>

<template>
  <!-- Mode detail: tampil hanya bila kunjungan memiliki order fisioterapi -->
  <CustomAccordion v-if="isForm || riwayat || daftar.length" ref="accordion" headerClass="bg-opensimrs-50" :initialState="initialState">
    <template #header>
      <div>{{ isForm ? "Order Fisio" : "Fisioterapi" }}</div>
    </template>
    <template #content>
      <div class="flex flex-col gap-5 pt-5">
        <div v-if="isForm" class="flex flex-col gap-4">
          <IsianOrderFisio ref="refIsian" v-model="isian" />
          <div class="flex items-center justify-end gap-3">
            <span v-if="galat" class="text-sm text-danger-300">{{ galat }}</span>
            <CustomButton label="Reset" outlined borderColor="border-grey-200" textColor="text-grey-400" @click="isian = isianKosong()" />
            <CustomButton label="Kirim Order Fisioterapi" icon="PhPaperPlaneTilt" @click="kirim" />
          </div>
        </div>

        <div class="font-semibold text-MD">{{ riwayat ? "Riwayat Order Fisioterapi Pasien" : "Order Fisioterapi Kunjungan Ini" }}</div>
        <div v-if="!daftar.length" class="text-normal text-grey-400">
          {{ sudahMuat ? (riwayat ? "Belum ada order fisioterapi untuk pasien ini." : "Belum ada order fisioterapi untuk kunjungan ini.") : "Memuat…" }}
        </div>
        <div v-for="o in daftar" :key="o.uuid" class="overflow-hidden border rounded-lg border-grey-75">
          <!-- Kepala order -->
          <div class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-grey-50">
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <b>{{ o.noOrder }}</b>
              <span class="px-2 py-0.5 rounded-full border text-xs font-semibold" :class="STATUS_ORDER[o.status]?.kelas">{{ STATUS_ORDER[o.status]?.label ?? o.status }}</span>
              <span v-if="riwayat" class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="kunjunganIni(o) ? 'bg-opensimrs-50 text-opensimrs-300' : 'bg-white text-grey-400 border border-grey-75'">
                {{ kunjunganIni(o) ? "Kunjungan ini" : `Kunjungan lain${o.noReg ? " · " + o.noReg : ""}` }}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <CustomButton v-if="o.jadwal?.length" label="Jadwal" icon="PhPrinter" size="small" @click="cetakJadwalTerapi(o)" />
              <CustomButton v-if="o.evaluasi?.length" label="Asuhan" icon="PhPrinter" size="small" @click="cetakAsuhanTerapi(o)" />
              <CustomButton v-if="isForm && o.status === 'order'" label="Batal" size="small" backgroundColor="bg-danger-300" @click="batal(o)" />
            </div>
          </div>

          <!-- Ringkasan order -->
          <table class="w-full text-xs">
            <tbody>
              <tr class="border-t border-grey-75">
                <td class="w-32 px-3 py-1.5 text-grey-400">Tgl. Order</td>
                <td class="px-3 py-1.5">{{ waktuEpoch(o.createdAt) }}</td>
                <td class="w-32 px-3 py-1.5 text-grey-400">Jenis</td>
                <td class="px-3 py-1.5">{{ labelJenis(o.jenisFisio) }}</td>
              </tr>
              <tr class="border-t border-grey-75">
                <td class="px-3 py-1.5 text-grey-400">Tindakan</td>
                <td class="px-3 py-1.5">{{ o.tindakanRingkas || "-" }}</td>
                <td class="px-3 py-1.5 text-grey-400">Sesi · Biaya</td>
                <td class="px-3 py-1.5">{{ o.jumlahSesi }} sesi · {{ rupiah(o.totalBiaya) }}</td>
              </tr>
              <tr v-if="o.diagnosis || o.status === 'batal'" class="border-t border-grey-75">
                <td class="px-3 py-1.5 text-grey-400">{{ o.status === "batal" ? "Alasan Batal" : "Diagnosis" }}</td>
                <td colspan="3" class="px-3 py-1.5" :class="{ 'text-danger-300': o.status === 'batal' }">
                  {{ o.status === "batal" ? o.alasanBatal : o.diagnosis }}
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Sesi terapi & evaluasi -->
          <table v-if="sesiAktif(o).length" class="w-full text-xs border-t border-grey-75">
            <thead>
              <tr class="text-left bg-opensimrs-50 text-grey-500">
                <th class="w-14 px-3 py-1.5 font-semibold text-center">Sesi</th>
                <th class="px-3 py-1.5 font-semibold">Tanggal</th>
                <th class="px-3 py-1.5 font-semibold">Jam</th>
                <th class="px-3 py-1.5 font-semibold">Bed</th>
                <th class="px-3 py-1.5 font-semibold">Status</th>
                <th class="px-3 py-1.5 font-semibold">Fase</th>
                <th class="px-3 py-1.5 font-semibold">Evaluasi (A · P · E)</th>
                <th class="px-3 py-1.5 font-semibold">Terapis</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="j in sesiAktif(o)" :key="j.uuid" class="border-t border-grey-75 align-top">
                <td class="px-3 py-1.5 text-center">{{ j.sesiKe }}</td>
                <td class="px-3 py-1.5 whitespace-nowrap">{{ tglIndo(j.tanggal, true) }}</td>
                <td class="px-3 py-1.5 whitespace-nowrap">{{ labelJam(j.jamSlot) }}</td>
                <td class="px-3 py-1.5 whitespace-nowrap">{{ j.bed ?? "-" }}</td>
                <td class="px-3 py-1.5">
                  <span class="px-2 py-0.5 rounded-full border text-[10px] font-semibold whitespace-nowrap" :class="STATUS_JADWAL[j.status]?.kelas">
                    {{ STATUS_JADWAL[j.status]?.label ?? j.status }}
                  </span>
                </td>
                <td class="px-3 py-1.5">{{ evaluasiSesi(o, j)?.faseRehabilitasi ?? "-" }}</td>
                <td class="px-3 py-1.5">
                  <template v-if="evaluasiSesi(o, j)">
                    <div><b>A:</b> {{ evaluasiSesi(o, j)?.asesmen || "-" }}</div>
                    <div><b>P:</b> {{ evaluasiSesi(o, j)?.intervensi || "-" }}</div>
                    <div><b>E:</b> {{ evaluasiSesi(o, j)?.evaluasi || "-" }}</div>
                  </template>
                  <span v-else class="text-grey-400">-</span>
                </td>
                <td class="px-3 py-1.5 whitespace-nowrap">{{ evaluasiSesi(o, j)?.terapis ?? "-" }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </CustomAccordion>
</template>
