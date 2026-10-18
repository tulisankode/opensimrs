<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import GreenCard from "../GreenCard.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import { daftarPesanHdis, gayaHdis, kirimUlangPesanHdis, tampilWaktu } from "@/stores/penunjang/hemodialisa";

// Riwayat pertukaran HDIS (STD-0033): jadwal keluar (terkirim/gagal/tidak pasti) & parameter masuk (diterapkan/ditolak),
// dengan jumlah percobaan dan alasan. Kirim ulang aman karena kunci idempoten sama selama jadwal tidak berubah.
const toast = useToast();
const OPSI_STATUS = [
  { value: "", label: "Semua" },
  { value: "terkirim", label: "Terkirim" },
  { value: "gagal", label: "Gagal" },
  { value: "tidak_pasti", label: "Tidak pasti" },
  { value: "diterapkan", label: "Diterapkan (masuk)" },
  { value: "ditolak", label: "Ditolak / karantina (masuk)" },
];
const baris = ref<any[]>([]);
const total = ref(0);
const halaman = ref(1);
const perHalaman = ref(10);
const status = ref("");
const memproses = ref<string | null>(null);

const muat = async () => {
  const res = await daftarPesanHdis({ page: halaman.value, limit: perHalaman.value, status: status.value });
  baris.value = res?.payload?.data ?? [];
  total.value = res?.payload?.pagination?.total ?? 0;
};
const kirimUlang = async (row: any) => {
  memproses.value = row.uuid;
  try {
    const res = await kirimUlangPesanHdis(row.uuid);
    if (res?.payload) toast.add({ severity: res.payload.status === "terkirim" ? "success" : "warn", summary: `Kirim ulang: ${res.payload.status}`, detail: res.payload.pesan, life: 6000 });
  } finally {
    memproses.value = null;
  }
  muat();
};
onMounted(muat);
defineExpose({ muat });
</script>

<template>
  <GreenCard cardHeading="Riwayat Pertukaran HDIS" hrEnableCustomClass :showButton="false">
    <div class="flex flex-col gap-3 pl-2">
      <div class="flex items-end gap-2">
        <CustomSelect v-model="status" label="Status" :options="OPSI_STATUS" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="(halaman = 1), muat()" />
        <CustomButton icon="PhArrowClockwise" label="Muat ulang" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="muat" />
      </div>
      <DataTable :value="baris" stripedRows class="text-xs">
        <Column header="Waktu" headerClass="bg-opensimrs-50"><template #body="{ data }">{{ tampilWaktu(data.updatedAt) }}</template></Column>
        <Column header="Arah" headerClass="bg-opensimrs-50"><template #body="{ data }">{{ data.arah === "keluar" ? "SIMRS → HDIS (jadwal)" : "HDIS → SIMRS (parameter)" }}</template></Column>
        <Column field="koneksi" header="Koneksi" headerClass="bg-opensimrs-50" />
        <Column field="kunciIdempoten" header="Kunci idempoten" headerClass="bg-opensimrs-50" />
        <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data }"><span :class="['px-2 py-0.5 rounded', gayaHdis(data.status).bg, gayaHdis(data.status).text]">{{ gayaHdis(data.status).label }}</span></template></Column>
        <Column field="percobaan" header="Percobaan" headerClass="bg-opensimrs-50" />
        <Column field="pesan" header="Keterangan" headerClass="bg-opensimrs-50" />
        <Column header="" headerClass="bg-opensimrs-50">
          <template #body="{ data }">
            <CustomButton v-if="data.arah === 'keluar' && ['gagal', 'tidak_pasti'].includes(data.status)" :label="memproses === data.uuid ? 'Mengirim…' : 'Kirim Ulang'" :disabled="memproses === data.uuid" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="kirimUlang(data)" />
          </template>
        </Column>
        <template #empty><div class="py-3 text-center text-grey-400">Belum ada pertukaran.</div></template>
      </DataTable>
      <div class="flex justify-end">
        <CustomPaginator :rows="perHalaman" :totalRecords="total" :rowsPerPageOptions="[10, 25, 50]" @page="(e: any) => ((halaman = e.page + 1), (perHalaman = e.rows), muat())" />
      </div>
    </div>
  </GreenCard>
</template>
