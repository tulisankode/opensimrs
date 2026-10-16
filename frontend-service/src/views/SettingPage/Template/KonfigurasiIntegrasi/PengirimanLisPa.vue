<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import GreenCard from "../GreenCard.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import { utilsStore } from "@/stores/utils";
import { epochToDate } from "@/utils/Helpers";
import { daftarPengirimanLisPa, kirimUlangLisPa, cekStatusLisPa } from "@/stores/penunjang/patologi";

// Riwayat registrasi kasus PA ke LIS PA & status hasil yang dikirim balik; kirim ulang / cek status bila gagal/tidak pasti.
const storeUtils = utilsStore();
const toast = useToast();

const STATUS: Record<string, { label: string; bg: string; text: string }> = {
  terkirim: { label: "Terkirim", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  gagal: { label: "Gagal", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
  mengirim: { label: "Sedang dikirim", bg: "bg-[#D1E9FF]", text: "text-[#175CD3]" },
  tidak_pasti: { label: "Tidak pasti", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  diterima: { label: "Hasil diterima", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  sebagian: { label: "Hasil sebagian", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  ditolak: { label: "Spesimen ditolak", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
};
const OPSI_STATUS = [
  { value: "", label: "Semua" },
  { value: "terkirim", label: "Terkirim" },
  { value: "gagal", label: "Gagal" },
  { value: "mengirim", label: "Sedang dikirim" },
  { value: "tidak_pasti", label: "Tidak pasti (perlu Cek Status)" },
];

const baris = ref<any[]>([]);
const total = ref(0);
const halaman = ref(1);
const perHalaman = ref(10);
const status = ref("");

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarPengirimanLisPa({ page: halaman.value, limit: perHalaman.value, status: status.value });
    baris.value = res?.payload ?? [];
    total.value = res?.pagination?.total ?? 0;
  } finally {
    storeUtils.setLoading(false);
  }
};

// kirimUlangLisPa: status & pesan sudah ditampilkan otomatis oleh apiHandler (HTTP 200 = toast sukses,
// HTTP 502 = toast galat) — cukup muat ulang daftar. cekStatusLisPa dipanggil "diam" (selalu HTTP 200
// walau hasilnya tidak_pasti/gagal), jadi toast kustom di sini berdasarkan payload.status.
const kirimUlang = async (row: any) => {
  storeUtils.setLoading(true);
  try {
    await kirimUlangLisPa(row.orderItemUuid);
  } finally {
    storeUtils.setLoading(false);
  }
  await muat();
};

const cekStatus = async (row: any) => {
  storeUtils.setLoading(true);
  try {
    const res = await cekStatusLisPa(row.orderItemUuid);
    if (res?.payload) {
      const severity = res.payload.status === "terkirim" ? "success" : res.payload.status === "tidak_pasti" ? "warn" : res.payload.status === "dilewati" ? "info" : "error";
      toast.add({ severity, summary: row.noPa ?? row.pemeriksaan, detail: res.payload.pesan, life: 6000 });
    }
  } finally {
    storeUtils.setLoading(false);
  }
  await muat();
};

const onPage = (e: { page: number; rows: number }) => {
  halaman.value = e.page + 1;
  perHalaman.value = e.rows;
  muat();
};

defineExpose({ muat });
onMounted(muat);
</script>

<template>
  <GreenCard cardHeading="Pengiriman LIS PA" hrEnableCustomClass>
    <div class="flex flex-col gap-3 pl-2 text-base">
      <div class="flex items-end gap-3">
        <CustomSelect v-model="status" class="w-1/5" label="Status" :options="OPSI_STATUS" optionValue="value" optionLabel="label" @update:modelValue="(halaman = 1), muat()" />
        <CustomButton label="Muat Ulang" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="muat" />
      </div>
      <DataTable :value="baris" stripedRows class="text-xs">
        <Column header="Kasus" headerClass="bg-opensimrs-50">
          <template #body="{ data }">
            <div class="font-semibold">{{ data.noPa ?? data.noOrder ?? "-" }}</div>
            <div class="text-grey-400">{{ data.namaPasien ?? "-" }} · RM {{ data.noRm ?? "-" }} · {{ data.pemeriksaan }}</div>
          </template>
        </Column>
        <Column header="LIS PA" headerClass="bg-opensimrs-50">
          <template #body="{ data }">{{ data.lis }}<br /><span class="text-grey-400">No. PA tujuan {{ data.lisNoPa ?? "-" }}</span></template>
        </Column>
        <Column header="Registrasi" headerClass="bg-opensimrs-50">
          <template #body="{ data }">
            <CustomChip :label="STATUS[data.status]?.label ?? data.status" :show-checked-icon="false" :bg-color="STATUS[data.status]?.bg" border-color="border-transparent" :text-color="STATUS[data.status]?.text" />
            <div v-if="['gagal', 'tidak_pasti'].includes(data.status)" class="mt-1 text-[#B42318]">{{ data.pesan }}</div>
          </template>
        </Column>
        <Column header="Hasil" headerClass="bg-opensimrs-50">
          <template #body="{ data }">
            <CustomChip v-if="data.statusHasil" :label="STATUS[data.statusHasil]?.label ?? data.statusHasil" :show-checked-icon="false" :bg-color="STATUS[data.statusHasil]?.bg ?? 'bg-[#D4D8DC]'" border-color="border-transparent" :text-color="STATUS[data.statusHasil]?.text ?? 'text-[#687077]'" />
            <span v-else class="text-grey-400">Menunggu</span>
          </template>
        </Column>
        <Column header="Waktu" headerClass="bg-opensimrs-50">
          <template #body="{ data }">{{ epochToDate(Number(data.updatedAt), "dateTime") }}<br /><span class="text-grey-400">{{ data.dikirimOleh ?? "-" }} · {{ data.percobaan }}×</span></template>
        </Column>
        <Column header="" headerClass="bg-opensimrs-50">
          <template #body="{ data }">
            <CustomButton v-if="data.status === 'tidak_pasti'" label="Cek Status" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cekStatus(data)" />
            <CustomButton v-else-if="data.status !== 'mengirim'" :label="data.status === 'gagal' ? 'Kirim Ulang' : 'Kirim Lagi'" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="kirimUlang(data)" />
          </template>
        </Column>
        <template #empty><div class="py-3 text-center text-grey-400">Belum ada kasus yang dikirim ke LIS PA.</div></template>
      </DataTable>
      <div class="flex justify-end"><CustomPaginator :rows="perHalaman" :totalRecords="total" @page="onPage" /></div>
    </div>
  </GreenCard>
</template>
