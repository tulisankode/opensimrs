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
import { STATUS_KIRIM_UTD, cekStatusUtd, daftarPengirimanUtd, kirimUlangUtd } from "@/stores/penunjang/bankDarah";

// Riwayat pengiriman permintaan darah ke UTD & status hasil (STD-0017); kirim ulang / cek status bila gagal atau
// tidak pasti. Status "tidak pasti" wajib Cek Status terlebih dahulu sebelum tombol Kirim Ulang diaktifkan.
const storeUtils = utilsStore();
const toast = useToast();

const OPSI_STATUS = [
  { value: "", label: "Semua" },
  { value: "terkirim", label: "Terkirim" },
  { value: "gagal", label: "Gagal" },
  { value: "sedang_dikirim", label: "Sedang dikirim" },
  { value: "tidak_pasti", label: "Tidak pasti (perlu Cek Status)" },
  { value: "kantong_diterima", label: "Kantong diterima" },
  { value: "diterima_sebagian", label: "Diterima sebagian" },
];

const baris = ref<any[]>([]);
const total = ref(0);
const halaman = ref(1);
const perHalaman = ref(10);
const status = ref("");
const memproses = ref<string | null>(null);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarPengirimanUtd({ page: halaman.value, limit: perHalaman.value, status: status.value });
    baris.value = res?.payload ?? [];
    total.value = res?.pagination?.total ?? 0;
  } finally {
    storeUtils.setLoading(false);
  }
};

const kirimUlang = async (row: any) => {
  memproses.value = row.uuid;
  try {
    const res = await kirimUlangUtd(row.uuid);
    toast.add({ severity: res?.payload?.status === "terkirim" ? "success" : "error", summary: row.noPermintaan, detail: res?.payload?.pesan ?? res?.message, life: 6000 });
  } finally {
    memproses.value = null;
  }
  await muat();
};

const cekStatus = async (row: any) => {
  memproses.value = row.uuid;
  try {
    const res = await cekStatusUtd(row.uuid);
    toast.add({ severity: res?.payload?.status === "terkirim" ? "success" : "info", summary: row.noPermintaan, detail: res?.payload?.pesan, life: 6000 });
  } finally {
    memproses.value = null;
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
  <GreenCard cardHeading="Pengiriman Bank Darah (UTD)" hrEnableCustomClass>
    <div class="flex flex-col gap-3 pl-2 text-base">
      <div class="flex items-end gap-3">
        <CustomSelect v-model="status" class="w-1/4" label="Status" :options="OPSI_STATUS" optionValue="value" optionLabel="label" @update:modelValue="(halaman = 1), muat()" />
        <CustomButton label="Muat Ulang" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="muat" />
      </div>
      <DataTable :value="baris" stripedRows class="text-xs">
        <Column header="No. Permintaan / RM" headerClass="bg-opensimrs-50">
          <template #body="{ data }">
            <div class="font-semibold">{{ data.noPermintaan ?? "-" }}</div>
            <div class="text-grey-400">RM {{ data.noRm ?? "-" }}</div>
          </template>
        </Column>
        <Column header="Koneksi" field="koneksi" headerClass="bg-opensimrs-50" />
        <Column header="No. Registrasi" headerClass="bg-opensimrs-50">
          <template #body="{ data }">{{ data.noRegistrasi }}<br /><span v-if="data.noRegistrasiUtd" class="text-grey-400">UTD: {{ data.noRegistrasiUtd }}</span></template>
        </Column>
        <Column header="Status" headerClass="bg-opensimrs-50">
          <template #body="{ data }">
            <CustomChip :label="STATUS_KIRIM_UTD[data.status]?.label ?? data.status" :show-checked-icon="false" :bg-color="STATUS_KIRIM_UTD[data.status]?.bg" border-color="border-transparent" :text-color="STATUS_KIRIM_UTD[data.status]?.text" />
            <div v-if="['gagal', 'tidak_pasti'].includes(data.status)" class="mt-1 text-[#B42318]">{{ data.pesan }}</div>
          </template>
        </Column>
        <Column header="Waktu" headerClass="bg-opensimrs-50">
          <template #body="{ data }">{{ epochToDate(Number(data.updatedAt), "dateTime") }}<br /><span class="text-grey-400">{{ data.dikirimOleh ?? "-" }} · {{ data.percobaan }}×</span></template>
        </Column>
        <Column header="" headerClass="bg-opensimrs-50">
          <template #body="{ data }">
            <div class="flex flex-wrap gap-2">
              <CustomButton v-if="data.status === 'tidak_pasti'" :disabled="memproses === data.uuid" label="Cek Status" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cekStatus(data)" />
              <CustomButton v-if="data.status === 'gagal'" :disabled="memproses === data.uuid" label="Kirim Ulang" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="kirimUlang(data)" />
            </div>
          </template>
        </Column>
        <template #empty><div class="py-3 text-center text-grey-400">Belum ada permintaan yang dikirim ke UTD.</div></template>
      </DataTable>
      <div class="flex justify-end"><CustomPaginator :rows="perHalaman" :totalRecords="total" @page="onPage" /></div>
    </div>
  </GreenCard>
</template>
