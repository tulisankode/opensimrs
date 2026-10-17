<script setup lang="ts">
import { onMounted, ref } from "vue";
import * as XLSX from "xlsx";
import type { MenuItem } from "primevue/menuitem";
import HeaderFilterTraining from "../Layout/HeaderFilterTraining.vue";
import FooterPaginationTraining from "../Layout/FooterPaginationTraining.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  apiTraining, keIso, labelCaraBayar, rupiah, STATUS_ORDER, tglIndo,
  type BarisLaporan, type PerKelasLaporan, type RingkasanLaporan,
} from "@/stores/penunjang/training";

// Rekapitulasi kunjungan kelas Training (GET /laporan/rekapitulasi): order bukan batal per periode tanggal kelas
// (+ filter kelas). Ringkasan & rekap per kelas dihitung backend; rincian dipaginasi. Ekspor Excel memakai data
// yang sama (seluruh baris periode) agar layar & berkas identik.
const dataBreadCrumb = ref<MenuItem[]>([{ label: "Rekapitulasi Kunjungan Kelas Training" }]);
const storeUtils = utilsStore();

const awalBulan = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};
const tanggalMulai = ref<Date>(awalBulan());
const tanggalSelesai = ref<Date>(new Date());
const kelasUuid = ref<string | null>(null);
const ringkasan = ref<RingkasanLaporan>({ totalPeserta: 0, totalPasien: 0, totalTarif: 0 });
const perKelas = ref<PerKelasLaporan[]>([]);
const data = ref<BarisLaporan[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(10);
const memuat = ref(false);

const filter = () => ({ tanggalMulai: keIso(tanggalMulai.value), tanggalSelesai: keIso(tanggalSelesai.value), kelasUuid: kelasUuid.value ?? undefined });
const muat = async () => {
  memuat.value = true;
  storeUtils.setLoading(true);
  try {
    const r = await apiTraining.laporanRekapitulasi({ ...filter(), page: page.value, limit: limit.value });
    const p = r?.payload;
    ringkasan.value = p?.ringkasan ?? { totalPeserta: 0, totalPasien: 0, totalTarif: 0 };
    perKelas.value = p?.perKelas ?? [];
    data.value = p?.data ?? [];
    total.value = p?.pagination?.total ?? 0;
  } finally {
    memuat.value = false;
    storeUtils.setLoading(false);
  }
};
const tampilkan = () => {
  page.value = 1;
  muat();
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

const ekspor = async () => {
  storeUtils.setLoading(true);
  try {
    const r = await apiTraining.laporanRekapitulasi({ ...filter(), page: 1, limit: 9999 });
    if (!r?.payload) return;
    const p = r.payload;
    const rincian = (p.data ?? []).map((b: BarisLaporan, i: number) => ({
      No: i + 1,
      Tanggal: b.tanggalKelas,
      Kelas: b.kelasNama,
      Sesi: b.namaSesi ?? "-",
      "No. Order": b.noOrder,
      "No. RM": b.noRm ?? "-",
      "Nama Pasien": b.namaPasien ?? "-",
      "Cara Bayar": labelCaraBayar(b.paymentMethod),
      Status: STATUS_ORDER[b.status]?.label ?? b.status,
      Tarif: Number(b.harga) || 0,
    }));
    const rekap = (p.perKelas ?? []).map((k: PerKelasLaporan) => ({ Kelas: k.kelasNama, Peserta: k.peserta, Tarif: Number(k.tarif) || 0 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        { Keterangan: "Periode", Nilai: `${p.periode?.mulai} s.d. ${p.periode?.selesai}` },
        { Keterangan: "Total peserta", Nilai: p.ringkasan?.totalPeserta ?? 0 },
        { Keterangan: "Total pasien", Nilai: p.ringkasan?.totalPasien ?? 0 },
        { Keterangan: "Total tarif", Nilai: p.ringkasan?.totalTarif ?? 0 },
      ]),
      "Ringkasan",
    );
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rekap.length ? rekap : [{ Keterangan: "Tidak ada data" }]), "Per Kelas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rincian.length ? rincian : [{ Keterangan: "Tidak ada data" }]), "Rincian");
    XLSX.writeFile(wb, `Rekapitulasi Kunjungan Kelas Training ${keIso(tanggalMulai.value)} sd ${keIso(tanggalSelesai.value)}.xlsx`);
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(muat);
</script>
<template>
  <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto">
    <template #header>
      <HeaderFilterTraining
        v-model:kelasUuid="kelasUuid"
        v-model:tanggalMulai="tanggalMulai"
        v-model:tanggalSelesai="tanggalSelesai"
        page-type="laporan"
        :dataBreadCrumb="dataBreadCrumb"
        :memuat="memuat"
        @reload-data="muat"
        @search="tampilkan"
        @export="ekspor"
      />
    </template>
    <template #content>
      <div class="flex flex-col gap-4 p-1">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div class="p-3 border rounded-lg border-grey-100">
            <div class="text-xs text-grey-400">Total Peserta (kunjungan)</div>
            <div class="text-xl font-semibold text-opensimrs-300">{{ ringkasan.totalPeserta }}</div>
          </div>
          <div class="p-3 border rounded-lg border-grey-100">
            <div class="text-xs text-grey-400">Total Pasien</div>
            <div class="text-xl font-semibold text-opensimrs-300">{{ ringkasan.totalPasien }}</div>
          </div>
          <div class="p-3 border rounded-lg border-grey-100">
            <div class="text-xs text-grey-400">Total Tarif</div>
            <div class="text-xl font-semibold text-opensimrs-300">{{ rupiah(ringkasan.totalTarif) }}</div>
          </div>
        </div>

        <section>
          <h2 class="mb-2 text-sm font-semibold">Rekap per Kelas</h2>
          <div v-if="!perKelas.length" class="p-4 text-xs text-center text-grey-400">Tidak ada kunjungan kelas pada periode ini.</div>
          <DataTable v-else :value="perKelas" stripedRows class="text-xs" tableStyle="min-width: 32rem">
            <Column header="No." headerClass="bg-opensimrs-50">
              <template #body="{ index }">{{ index + 1 }}</template>
            </Column>
            <Column field="kelasNama" header="Kelas" headerClass="bg-opensimrs-50" />
            <Column field="peserta" header="Peserta" headerClass="bg-opensimrs-50" />
            <Column header="Tarif" headerClass="bg-opensimrs-50">
              <template #body="{ data: k }">{{ rupiah(k.tarif) }}</template>
            </Column>
          </DataTable>
        </section>

        <section>
          <h2 class="mb-2 text-sm font-semibold">Rincian Kunjungan</h2>
          <NoData v-if="!data.length" />
          <DataTable v-else :value="data" stripedRows class="text-xs" tableStyle="min-width: 50rem">
            <Column header="No." headerClass="bg-opensimrs-50">
              <template #body="{ index }">{{ (page - 1) * limit + index + 1 }}</template>
            </Column>
            <Column header="Tanggal" headerClass="bg-opensimrs-50">
              <template #body="{ data: b }">{{ tglIndo(b.tanggalKelas) }}</template>
            </Column>
            <Column header="Kelas" headerClass="bg-opensimrs-50">
              <template #body="{ data: b }">
                <div>{{ b.kelasNama }}</div>
                <div class="text-grey-400">{{ b.namaSesi ?? "" }}</div>
              </template>
            </Column>
            <Column header="Pasien" headerClass="bg-opensimrs-50">
              <template #body="{ data: b }">
                <div class="font-semibold">{{ b.namaPasien ?? "-" }}</div>
                <div class="text-grey-400">{{ b.noRm ?? "-" }} · {{ b.noOrder }}</div>
              </template>
            </Column>
            <Column header="Cara Bayar" headerClass="bg-opensimrs-50">
              <template #body="{ data: b }">{{ labelCaraBayar(b.paymentMethod) }}</template>
            </Column>
            <Column header="Status" headerClass="bg-opensimrs-50">
              <template #body="{ data: b }">
                <span class="px-2 py-0.5 border rounded-full font-semibold" :class="STATUS_ORDER[b.status]?.kelas">{{ STATUS_ORDER[b.status]?.label ?? b.status }}</span>
              </template>
            </Column>
            <Column header="Tarif" headerClass="bg-opensimrs-50">
              <template #body="{ data: b }">{{ rupiah(b.harga) }}</template>
            </Column>
          </DataTable>
        </section>
      </div>
    </template>
    <template #footer>
      <FooterPaginationTraining :rows="limit" :totalRecords="total" @page="gantiHalaman" />
    </template>
  </Card>
</template>
