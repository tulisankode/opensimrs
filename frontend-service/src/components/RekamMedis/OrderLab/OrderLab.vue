<script lang="ts" setup>
import { computed, onMounted, ref, watch } from "vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import OrderTindakan from "@/views/Laboratorium/Section/DaftarOrderLab/OrderTindakan.vue";
import { useOrderLab } from "@/stores/Laboratorium/orderLab";
import { useExpertiseLab } from "@/stores/Laboratorium/expertise";
import { createHasilLabPdf } from "@/utils/pdf/pdfLaboratorium/cetakHasilLab";
import { usePraktisiStore } from "@/stores/datamaster/praktisi";
import { usePenjaminStore } from "@/stores/datamaster/penjamin";
import { useLokasiStore } from "@/stores/datamaster/lokasi";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { utilsStore } from "@/stores/utils";
import { epochToDate, formatPrice } from "@/utils/Helpers";

// Order lab dari rekam medis: riwayat order pasien + form order baru (dikirim ke lab-service)
const props = defineProps({
  method: {
    type: String,
    default: "detail",
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
});

const orderLabStore = useOrderLab();
const expertiseLabStore = useExpertiseLab();
const praktisiStore = usePraktisiStore();
const penjaminStore = usePenjaminStore();
const lokasiStore = useLokasiStore();
const rekamMedisStore = useRekamMedisStore();
const storeUtils = utilsStore();

const isEditing = computed(() => props.method === "form");

const STATUS_ORDER: Record<number, { label: string; bg: string; text: string }> = {
  0: { label: "Batal", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
  1: { label: "Order", bg: "bg-[#D4D8DC]", text: "text-[#687077]" },
  2: { label: "Diperiksa", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  3: { label: "Selesai", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
};
const PELAYANAN: Record<string, string> = { "rawat-jalan": "rajal", "rawat-inap": "ranap", igd: "igd" };

// --- Konteks kunjungan
const kunjungan = computed(() => (props.patientData?.rawatInap ? props.patientData.rawatInap : props.patientData) ?? {});
const pasien = computed(() => kunjungan.value?.patient ?? props.patientData?.patient ?? {});
const noRm = computed(() => kunjungan.value?.noRm ?? pasien.value?.noRm ?? "");
const metodeBayar = computed(() => (Number(kunjungan.value?.paymentMethod ?? 1) === 2 ? 2 : 1));
// DPJP kunjungan: bentuk data berbeda antar modul (practitioner.uuid / pegawai.nama / pegawai.name / nama)
const dpjp = computed(() => {
  const p = kunjungan.value?.practitioner ?? {};
  return {
    uuid: p?.uuid ?? kunjungan.value?.practitionerUuid ?? "",
    nik: p?.pegawai?.nik ?? p?.nik ?? "",
    nama: (p?.pegawai?.nama ?? p?.pegawai?.name ?? p?.nama ?? "").toLowerCase(),
  };
});
const lokasiKunjungan = computed(
  () =>
    kunjungan.value?.polyclinic?.uuid ??
    kunjungan.value?.lokasiUuid ??
    kunjungan.value?.lokasi?.uuid ??
    rekamMedisStore.openedRekamMedis?.meta?.lokasiUuid ??
    ""
);

// --- Riwayat order lab pasien
const riwayat = ref<any[]>([]);
const detailOrder = ref<Record<string, any>>({});

const fetchRiwayat = async () => {
  if (!noRm.value) return;
  const response = await orderLabStore.getApi({ search: noRm.value, limit: 50 });
  const data = response?.payload?.data ?? [];
  // pencarian lab juga mencocokkan nama; batasi ke pasien ini
  riwayat.value = data
    .filter((order: any) => order.noRm === noRm.value || (pasien.value?.uuid && order.patientUuid === pasien.value.uuid))
    .sort((a: any, b: any) => Number(b.tglOrder) - Number(a.tglOrder));
  // panel order terbuka secara default: muat daftar pemeriksaan 10 order terbaru langsung
  await Promise.all(riwayat.value.slice(0, 10).map((order: any) => bukaDetail(order.uuid)));
};

const bukaDetail = async (uuid: string) => {
  if (detailOrder.value[uuid]) return;
  const response = await orderLabStore.getDetailPasien(uuid);
  if (response?.payload) detailOrder.value = { ...detailOrder.value, [uuid]: response.payload };
};

const tanggalOrder = (tgl: string | number) => {
  const n = Number(tgl);
  if (!n) return "-";
  return epochToDate(n > 1e12 ? Math.floor(n / 1000) : n, "dateTime");
};

// Cetak hasil (order selesai): data sama dengan halaman Expertise
const cetakHasil = async (uuid: string) => {
  storeUtils.setLoading(true);
  try {
    const [pasienRes, tarifRes] = await Promise.all([
      expertiseLabStore.getDetailPasien(uuid),
      expertiseLabStore.getDetailTarif(uuid),
    ]);
    createHasilLabPdf({ ...(pasienRes?.payload || {}), ...(tarifRes?.payload || {}) });
  } finally {
    storeUtils.setLoading(false);
  }
};

// --- Form order baru
const listDokter = ref<any[]>([]);
const listPenjamin = ref<any[]>([]);
const listLokasi = ref<any[]>([]);
const dokterUuid = ref("");
const penjaminUuid = ref("");
const lokasiUuid = ref("");
const diagnosis = ref("");
const catatan = ref("");
const orderTindakanRef = ref<InstanceType<typeof OrderTindakan> | null>(null);
const errorForm = ref("");

const fetchMaster = async () => {
  const [dokter, penjamin, lokasi] = await Promise.all([
    praktisiStore.getAktifApi(),
    metodeBayar.value === 2 ? penjaminStore.getAktifApi() : Promise.resolve(null),
    lokasiStore.getApi(99999, 9999),
  ]);
  listDokter.value = (dokter?.payload ?? [])
    .filter((p: any) => p.isDoctor && p.status)
    .map((p: any) => ({ uuid: p.uuid, name: p.pegawai?.name ?? "-", nik: p.pegawai?.nik ?? "" }));
  listPenjamin.value = penjamin?.payload ?? [];
  listLokasi.value = lokasi?.payload ?? [];

  // default dokter pengirim = DPJP kunjungan: cocokkan uuid, lalu NIK, lalu nama persis
  const { uuid, nik, nama } = dpjp.value;
  const cocok =
    listDokter.value.find((d) => uuid && d.uuid === uuid) ??
    listDokter.value.find((d) => nik && d.nik === nik) ??
    listDokter.value.find((d) => nama && d.name.toLowerCase() === nama);
  dokterUuid.value = cocok?.uuid ?? "";
  lokasiUuid.value = lokasiKunjungan.value;
};

const kirimOrder = async () => {
  errorForm.value = "";
  const tindakan = await orderTindakanRef.value?.onSubmit();
  if (!tindakan) return; // validasi pemeriksaan/tanggal ditampilkan oleh OrderTindakan
  if (!pasien.value?.uuid || !noRm.value) return (errorForm.value = "Data pasien kunjungan tidak ditemukan");
  if (!dokterUuid.value) return (errorForm.value = "Dokter pengirim harus dipilih");
  if (!lokasiUuid.value) return (errorForm.value = "Unit asal harus dipilih");
  if (metodeBayar.value === 2 && !penjaminUuid.value) return (errorForm.value = "Penjamin harus dipilih");

  storeUtils.setLoading(true);
  try {
    const response = await orderLabStore.postApi({
      ...tindakan,
      patientUuid: pasien.value.uuid,
      noRm: noRm.value,
      // No. Reg kunjungan asal agar order lab tersambung ke kunjungan RJ/RI/IGD (bukan nomor baru dari lab)
      noreg: kunjungan.value?.noReg ?? props.patientData?.noReg ?? null,
      rekamMedisDate: props.rmDate ? String(props.rmDate) : String(Math.floor(Date.now() / 1000)),
      paymentMethod: metodeBayar.value,
      penjaminUuid: metodeBayar.value === 2 ? penjaminUuid.value : null,
      pelayanan: PELAYANAN[props.rmType] ?? "rajal",
      lokasiUuid: lokasiUuid.value,
      dokterPengirimUuid: dokterUuid.value,
      pasienMaternitas: false,
      diagnosis: diagnosis.value || null,
      catatan: catatan.value || null,
    });
    if (response) {
      diagnosis.value = "";
      catatan.value = "";
      await fetchRiwayat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(async () => {
  await fetchRiwayat();
  if (isEditing.value) await fetchMaster();
});
watch(noRm, fetchRiwayat);

// --- expand/collapse dari MedicalRecordDetail
const accordion = ref();
const open = () => accordion.value?.open?.();
const close = () => accordion.value?.close?.();
defineExpose({ open, close });
</script>
<template>
  <CustomAccordion headerClass="bg-opensimrs-50" ref="accordion">
    <template #header>
      <div>{{ isEditing ? "Order Lab" : "Laboratorium" }}</div>
    </template>
    <template #content>
      <div class="flex flex-col gap-5 pt-5">
        <!-- Form order baru -->
        <div v-if="isEditing" class="flex flex-col gap-4">
          <div class="grid grid-cols-3 gap-4">
            <CustomSelect
              v-model="dokterUuid"
              label="Dokter Pengirim"
              placeHolder="Pilih Dokter"
              :options="listDokter"
              optionValue="uuid"
              optionLabel="name"
              showFilter
            />
            <CustomSelect
              v-model="lokasiUuid"
              label="Unit Asal"
              placeHolder="Pilih Unit"
              :options="listLokasi"
              optionValue="uuid"
              optionLabel="name"
              showFilter
            />
            <CustomSelect
              v-if="metodeBayar === 2"
              v-model="penjaminUuid"
              label="Penjamin"
              placeHolder="Pilih Penjamin"
              :options="listPenjamin"
              optionValue="uuid"
              optionLabel="name"
            />
            <div v-else class="flex flex-col justify-end text-normal text-grey-400">Pembayaran: Tunai</div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <CustomTextArea v-model="diagnosis" label="Diagnosis / Indikasi" placeholder="Diagnosis klinis" />
            <CustomTextArea v-model="catatan" label="Catatan untuk Lab" placeholder="Catatan" />
          </div>
          <OrderTindakan ref="orderTindakanRef" pageType="order-lab" />
          <div class="flex items-center justify-end gap-3">
            <span v-if="errorForm" class="text-sm text-danger-300">{{ errorForm }}</span>
            <CustomButton label="Kirim Order Lab" icon="PhPaperPlaneTilt" @click="kirimOrder" />
          </div>
        </div>

        <!-- Riwayat order lab pasien -->
        <div class="font-semibold text-MD">Riwayat Order Lab</div>
        <div v-if="!riwayat.length" class="text-normal text-grey-400">Belum ada order lab untuk pasien ini.</div>
        <div v-for="order in riwayat" :key="order.uuid">
          <CustomAccordion initial-state="0" header-class="bg-opensimrs-50" @open="bukaDetail(order.uuid)">
            <template #header>
              <div class="flex items-center justify-between w-full">
                <div class="flex items-center font-normal text-MD">
                  {{ order.noOrder }}
                  <CustomChip
                    :label="STATUS_ORDER[order.orderStatus]?.label ?? '-'"
                    class="ml-2.5"
                    :show-checked-icon="false"
                    :bg-color="STATUS_ORDER[order.orderStatus]?.bg ?? 'bg-[#D4D8DC]'"
                    border-color="border-grey-75"
                    :text-color="STATUS_ORDER[order.orderStatus]?.text ?? 'text-[#687077]'"
                  />
                  <CustomChip
                    v-if="order.cito"
                    label="CITO"
                    class="ml-2"
                    :show-checked-icon="false"
                    bg-color="bg-[#FDE2E1]"
                    border-color="border-transparent"
                    text-color="text-[#B42318]"
                  />
                </div>
                <div class="mr-2.5 font-normal text-MD">Tgl. Order: {{ tanggalOrder(order.tglOrder) }}</div>
              </div>
            </template>
            <template #content>
              <div class="flex flex-col gap-2 pt-4 text-normal">
                <div>
                  Dokter pengirim: {{ order.dokterPengirim?.pegawai?.name ?? "-" }} · Petugas:
                  {{ order.petugasOrder ?? "-" }}
                </div>
                <div v-if="!detailOrder[order.uuid]" class="text-grey-400">Memuat pemeriksaan…</div>
                <DataTable v-else :value="detailOrder[order.uuid].orderLabPemeriksaan ?? []" stripedRows class="text-xs">
                  <Column header="Pemeriksaan">
                    <template #body="{ data }">{{ data.tarifLab?.name ?? "-" }}</template>
                  </Column>
                  <Column header="Kode">
                    <template #body="{ data }">{{ data.tarifLab?.code ?? "-" }}</template>
                  </Column>
                  <Column header="Tarif">
                    <template #body="{ data }">{{
                      data.tarifLab?.grandTotal != null ? formatPrice(Number(data.tarifLab.grandTotal)) : "-"
                    }}</template>
                  </Column>
                </DataTable>
                <div v-if="order.orderStatus === 3" class="flex justify-end">
                  <CustomButton label="Cetak Hasil" icon="PhPrinter" @click="cetakHasil(order.uuid)" />
                </div>
              </div>
            </template>
          </CustomAccordion>
        </div>
      </div>
    </template>
  </CustomAccordion>
</template>
