<script setup lang="ts">
import { onMounted, ref } from "vue";
import HeaderFilterTraining from "../Layout/HeaderFilterTraining.vue";
import FooterPaginationTraining from "../Layout/FooterPaginationTraining.vue";
import TabelOrder from "../Komponen/TabelOrder.vue";
import DetailBooking from "../BookingKelas/DetailBooking.vue";
import FormDaftarKelas from "./FormDaftarKelas.vue";
import { utilsStore } from "@/stores/utils";
import { apiTraining, izinTraining, keIso, type OrderTraining } from "@/stores/penunjang/training";

// Daftar Kelas: order (pendaftaran) kelas Training per periode tanggal kelas (GET /order), tab Terdaftar/Batal,
// detail & batal pendaftaran (tagihan dihapus), batal massal, dan form pendaftaran langsung tanpa booking.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinTraining("Daftar Kelas", aksi);

const cari = ref("");
const kelasUuid = ref<string | null>(null);
const tanggalMulai = ref<Date>(new Date());
const tanggalSelesai = ref<Date>(new Date());
const tab = ref("order");
const data = ref<OrderTraining[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(10);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const r = await apiTraining.daftarOrder({
      page: page.value,
      limit: limit.value,
      status: tab.value,
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
  if (tab.value !== "order") toggleBatal(false);
  muat();
};
const reset = () => {
  cari.value = "";
  kelasUuid.value = null;
  tanggalMulai.value = new Date();
  tanggalSelesai.value = new Date();
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

// ── Batal massal (hanya tab Terdaftar)
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
    for (const o of dipilih.value) await apiTraining.batalOrder(o.uuid, alasanBatal.value.trim());
  } finally {
    storeUtils.setLoading(false);
  }
  toggleBatal(false);
  muat();
};

// ── Form pendaftaran langsung
const formDaftar = ref(false);
const pendaftaranSelesai = () => {
  formDaftar.value = false;
  muat();
};

onMounted(muat);
</script>
<template>
  <Card v-if="!formDaftar" pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto">
    <template #header>
      <HeaderFilterTraining
        v-model:cari="cari"
        v-model:kelasUuid="kelasUuid"
        v-model:tanggalMulai="tanggalMulai"
        v-model:tanggalSelesai="tanggalSelesai"
        v-model:tab="tab"
        page-type="daftar"
        :bisaTambah="boleh('CREATE DAFTAR KELAS')"
        @reload-data="muat"
        @search="cariData"
        @reset="reset"
        @tambah-data="formDaftar = true"
      />
    </template>
    <template #content>
      <TabelOrder v-model:selection="dipilih" :data="data" :pilih="modeBatal" @detail="bukaDetail" />
      <DetailBooking v-model:isDialogVisible="dialogDetail" :uuid="uuidDetail" jenis="order" @berubah="muat" />
    </template>
    <template #footer>
      <FooterPaginationTraining
        v-model:cancelReason="alasanBatal"
        :cancleButton="tab === 'order' && boleh('BATAL DAFTAR')"
        labelBatal="Batal Daftar"
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
  <FormDaftarKelas v-else @back="formDaftar = false" @tersimpan="pendaftaranSelesai" />
</template>
