<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { JENIS_LAYANAN, daftarKuitansi, detailKuitansi, rupiahAmbulans, waktuAmbulans } from "@/stores/penunjang/ambulans";

// Kuitansi layanan ambulans untuk pengguna umum tanpa pasien/kunjungan (KF-14). Akses baca diperiksa backend
// (izin "Biaya & Kuitansi" › READ); halaman ini tidak memiliki aksi tulis.
const storeUtils = utilsStore();

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarKuitansi({ page: page.value, limit: limit.value });
    data.value = res?.payload?.data ?? [];
    total.value = res?.payload?.pagination?.total ?? 0;
  } finally {
    storeUtils.setLoading(false);
  }
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};
onMounted(muat);

const dialog = ref(false);
const detail = ref<any>(null);
const bukaDetail = async (uuid: string) => {
  storeUtils.setLoading(true);
  try {
    const res = await detailKuitansi(uuid);
    if (res?.payload) {
      detail.value = res.payload;
      dialog.value = true;
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Kuitansi Umum</h1>
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs cursor-pointer" scrollable scrollHeight="flex" tableStyle="min-width: 50rem" @rowClick="bukaDetail($event.data.uuid)">
          <Column header="No. Kuitansi" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.nomorKuitansi }}</template>
          </Column>
          <Column header="No. Permintaan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.nomorPermintaan }}</template>
          </Column>
          <Column header="Jenis Layanan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ JENIS_LAYANAN[d.jenisLayanan] ?? d.jenisLayanan }}</template>
          </Column>
          <Column field="tujuan" header="Tujuan" headerClass="bg-opensimrs-50" />
          <Column header="Jumlah" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ rupiahAmbulans(d.jumlah) }}</template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.status }}</template>
          </Column>
          <Column header="Tanggal" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ waktuAmbulans(d.createdAt) }}</template>
          </Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="520px">
      <template #header>Kuitansi {{ detail?.nomorKuitansi }}</template>
      <template #body>
        <div v-if="detail" class="flex flex-col gap-2 pt-4 text-sm">
          <div><span class="text-grey-400">No. Permintaan:</span> {{ detail.nomorPermintaan }}</div>
          <div><span class="text-grey-400">Jenis layanan:</span> {{ JENIS_LAYANAN[detail.jenisLayanan] ?? detail.jenisLayanan }}</div>
          <div><span class="text-grey-400">Lokasi jemput:</span> {{ detail.lokasiJemput ?? "-" }}</div>
          <div><span class="text-grey-400">Tujuan:</span> {{ detail.tujuan }}</div>
          <div><span class="text-grey-400">Waktu permintaan:</span> {{ waktuAmbulans(detail.waktuPermintaan) }}</div>
          <div class="text-lg font-semibold">{{ rupiahAmbulans(detail.jumlah) }}</div>
          <div><span class="text-grey-400">Status:</span> {{ detail.status }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
