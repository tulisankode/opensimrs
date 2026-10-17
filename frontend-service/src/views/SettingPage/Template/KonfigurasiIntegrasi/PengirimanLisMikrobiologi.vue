<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import GreenCard from "../GreenCard.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import { cekStatusKirimOrderMikro, daftarPengirimanLisMikro, izinMikro, kirimOrderMikroLis } from "@/stores/penunjang/mikrobiologi";
import { utilsStore } from "@/stores/utils";
import { epochToDate } from "@/utils/Helpers";

// Riwayat registrasi order mikrobiologi ke LIS & status hasil yang dikirim balik; kirim ulang bila gagal/tidak pasti.
const storeUtils = utilsStore();
const toast = useToast();
const boleh = (aksi: string) => izinMikro("Pengiriman LIS Mikrobiologi", aksi);

const STATUS: Record<string, { label: string; bg: string; text: string }> = {
  terkirim: { label: "Terkirim", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  gagal: { label: "Gagal", bg: "bg-[#FDE2E1]", text: "text-[#B42318]" },
  mengirim: { label: "Sedang dikirim", bg: "bg-[#D1E9FF]", text: "text-[#175CD3]" },
  tidak_pasti: { label: "Tidak pasti", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  hasil_diterima: { label: "Hasil diterima", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  hasil_sebagian: { label: "Hasil sebagian", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
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
    const res = await daftarPengirimanLisMikro({ page: halaman.value, limit: perHalaman.value, status: status.value });
    baris.value = res?.payload ?? [];
    total.value = res?.pagination?.total ?? 0;
  } finally {
    storeUtils.setLoading(false);
  }
};

const kirimUlang = async (row: any) => {
  storeUtils.setLoading(true);
  try {
    const res = await kirimOrderMikroLis(row.orderUuid);
    toast.add({ severity: res?.gagal ? "error" : "success", summary: row.noRegistrasi, detail: res?.message, life: 6000 });
  } finally {
    storeUtils.setLoading(false);
  }
  await muat();
};

const cekStatus = async (row: any) => {
  storeUtils.setLoading(true);
  try {
    const res = await cekStatusKirimOrderMikro(row.orderUuid);
    toast.add({ severity: res?.gagal ? "error" : "info", summary: row.noRegistrasi, detail: res?.payload?.pesan ?? res?.message, life: 6000 });
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
  <GreenCard cardHeading="Pengiriman LIS Mikrobiologi" hrEnableCustomClass>
    <div class="flex flex-col gap-3 pl-2 text-base">
      <div class="flex items-end gap-3">
        <CustomSelect v-model="status" class="w-1/5" label="Status" :options="OPSI_STATUS" optionValue="value" optionLabel="label" @update:modelValue="(halaman = 1), muat()" />
        <CustomButton label="Muat Ulang" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="muat" />
      </div>
      <DataTable :value="baris" stripedRows class="text-xs">
        <Column header="No. Order" headerClass="bg-opensimrs-50">
          <template #body="{ data }">
            <div class="font-semibold">{{ data.noOrder ?? data.noRegistrasi }}</div>
            <div class="text-grey-400">{{ data.namaPasien ?? "-" }} · RM {{ data.noRm ?? "-" }}</div>
          </template>
        </Column>
        <Column header="LIS" field="lis" headerClass="bg-opensimrs-50" />
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
        <Column v-if="boleh('KIRIM ULANG') || boleh('CEK STATUS')" header="" headerClass="bg-opensimrs-50">
          <template #body="{ data }">
            <div class="flex flex-wrap gap-2">
              <CustomButton
                v-if="boleh('KIRIM ULANG') && !['mengirim', 'tidak_pasti'].includes(data.status)"
                :label="data.status === 'gagal' ? 'Kirim Ulang' : 'Kirim Lagi'"
                outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="kirimUlang(data)"
              />
              <CustomButton v-if="boleh('CEK STATUS') && data.status === 'tidak_pasti'" label="Cek Status" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cekStatus(data)" />
            </div>
          </template>
        </Column>
        <template #empty><div class="py-3 text-center text-grey-400">Belum ada order yang dikirim ke LIS Mikrobiologi.</div></template>
      </DataTable>
      <div class="flex justify-end"><CustomPaginator :rows="perHalaman" :totalRecords="total" @page="onPage" /></div>
    </div>
  </GreenCard>
</template>
