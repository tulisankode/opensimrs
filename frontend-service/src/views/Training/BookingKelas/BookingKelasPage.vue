<script setup lang="ts">
import { onMounted, ref } from "vue";
import HeaderFilterTraining from "../Layout/HeaderFilterTraining.vue";
import FooterPaginationTraining from "../Layout/FooterPaginationTraining.vue";
import TabelOrder from "../Komponen/TabelOrder.vue";
import CariJadwal from "./CariJadwal.vue";
import DetailBooking from "./DetailBooking.vue";
import { utilsStore } from "@/stores/utils";
import { apiTraining, izinTraining, keIso, type OrderTraining } from "@/stores/penunjang/training";

// Booking Kelas: daftar booking aktif (GET /booking, status booking) dengan filter pasien/kelas/periode tanggal
// kelas, detail & aksi (ubah, lanjut daftar, batal), batal massal, dan cari jadwal untuk booking baru.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinTraining("Booking Kelas", aksi);

const hariIni = () => new Date();
const tambahHari = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};
const cari = ref("");
const kelasUuid = ref<string | null>(null);
const tanggalMulai = ref<Date>(hariIni());
const tanggalSelesai = ref<Date>(tambahHari(30));
const data = ref<OrderTraining[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(10);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const r = await apiTraining.daftarBooking({
      page: page.value,
      limit: limit.value,
      cari: cari.value.trim(),
      kelas_uuid: kelasUuid.value,
      tanggal_mulai: keIso(tanggalMulai.value),
      tanggal_selesai: keIso(tanggalSelesai.value),
    });
    data.value = r?.payload?.data ?? [];
    total.value = r?.payload?.pagination?.total ?? 0;
  } finally {
    storeUtils.setLoading(false);
  }
};
const cariData = () => {
  page.value = 1;
  muat();
};
const reset = () => {
  cari.value = "";
  kelasUuid.value = null;
  tanggalMulai.value = hariIni();
  tanggalSelesai.value = tambahHari(30);
  cariData();
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

// ── Detail
const dialogDetail = ref(false);
const uuidDetail = ref("");
const bukaDetail = (o: OrderTraining) => {
  if (modeBatal.value) return;
  uuidDetail.value = o.uuid;
  dialogDetail.value = true;
};

// ── Batal massal
const modeBatal = ref(false);
const dipilih = ref<OrderTraining[]>([]);
const alasanBatal = ref("");
const toggleBatal = (v: boolean) => {
  modeBatal.value = v;
  dipilih.value = [];
  alasanBatal.value = "";
};
const konfirmasiBatal = async () => {
  if (!alasanBatal.value.trim() || !dipilih.value.length) return;
  storeUtils.setLoading(true);
  try {
    for (const o of dipilih.value) await apiTraining.batalBooking(o.uuid, alasanBatal.value.trim());
  } finally {
    storeUtils.setLoading(false);
  }
  toggleBatal(false);
  muat();
};

// ── Cari jadwal (booking baru)
const cariJadwal = ref(false);
const bookingSelesai = () => {
  cariJadwal.value = false;
  muat();
};

onMounted(muat);
</script>
<template>
  <Card v-if="!cariJadwal" pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto">
    <template #header>
      <HeaderFilterTraining
        v-model:cari="cari"
        v-model:kelasUuid="kelasUuid"
        v-model:tanggalMulai="tanggalMulai"
        v-model:tanggalSelesai="tanggalSelesai"
        page-type="booking"
        :bisaTambah="boleh('CREATE BOOKING')"
        @reload-data="muat"
        @search="cariData"
        @reset="reset"
        @tambah-data="cariJadwal = true"
      />
    </template>
    <template #content>
      <TabelOrder v-model:selection="dipilih" :data="data" :pilih="modeBatal" @detail="bukaDetail" />
      <DetailBooking v-model:isDialogVisible="dialogDetail" :uuid="uuidDetail" jenis="booking" @berubah="muat" />
    </template>
    <template #footer>
      <FooterPaginationTraining
        v-model:cancelReason="alasanBatal"
        :cancleButton="boleh('BATAL BOOKING')"
        labelBatal="Batal Booking"
        :showCancelVisit="modeBatal"
        :jumlahDipilih="dipilih.length"
        :rows="limit"
        :totalRecords="total"
        @toggle-cancel-visit="toggleBatal"
        @confirm-cancel="konfirmasiBatal"
        @page="gantiHalaman"
      />
    </template>
  </Card>
  <CariJadwal v-else @back="cariJadwal = false" @selesai="bookingSelesai" />
</template>
