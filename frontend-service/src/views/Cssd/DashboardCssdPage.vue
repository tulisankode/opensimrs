<script setup lang="ts">
import { onMounted, ref } from "vue";
import NoData from "@/components/section/NoData.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { utilsStore } from "@/stores/utils";
import { daftarSetCssd, daftarRecallCssd, gayaRecallCssd, gayaSetCssd, waktuRingkas } from "@/stores/penunjang/cssd";
import { useRouter } from "vue-router";

// Dasbor CSSD: ringkasan stok layak, peringatan kedaluwarsa (H-3, diperbarui setiap kali dasbor dibuka — bukan
// laporan batch), dan recall yang masih terbuka untuk ditindaklanjuti.
const storeUtils = utilsStore();
const router = useRouter();

const ringkasStatus = ref<{ status: string; jumlah: number }[]>([]);
const hampirKedaluwarsa = ref<any[]>([]);
const recallTerbuka = ref<any[]>([]);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const [layak, kedaluwarsa, recall] = await Promise.all([
      daftarSetCssd({ status: "layak", limit: 1 }),
      daftarSetCssd({ hampir_kedaluwarsa: 1, limit: 100 }),
      daftarRecallCssd({ status: "dibuka,ditindaklanjuti", limit: 50 }),
    ]);
    ringkasStatus.value = [{ status: "layak", jumlah: layak?.payload?.pagination?.total ?? 0 }];
    hampirKedaluwarsa.value = kedaluwarsa?.payload?.data ?? [];
    recallTerbuka.value = recall?.payload?.data ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full gap-3 overflow-auto">
    <div class="grid grid-cols-3 gap-3">
      <Card class="p-3">
        <template #content>
          <div class="text-xs text-grey-400">Set Layak/Steril Saat Ini</div>
          <div class="mt-1 text-2xl font-bold text-mint-400">{{ ringkasStatus[0]?.jumlah ?? 0 }}</div>
        </template>
      </Card>
      <Card class="p-3">
        <template #content>
          <div class="text-xs text-grey-400">Mendekati/Lewat Kedaluwarsa (H-3)</div>
          <div class="mt-1 text-2xl font-bold text-warning-400">{{ hampirKedaluwarsa.length }}</div>
        </template>
      </Card>
      <Card class="p-3">
        <template #content>
          <div class="text-xs text-grey-400">Recall Perlu Tindak Lanjut</div>
          <div class="mt-1 text-2xl font-bold text-danger-300">{{ recallTerbuka.length }}</div>
        </template>
      </Card>
    </div>

    <Card class="flex-1 overflow-hidden">
      <template #header>
        <div class="flex items-center justify-between px-5 pt-4">
          <h2 class="font-semibold">Set Mendekati/Lewat Kedaluwarsa Steril</h2>
          <CustomButton icon="PhArrowClockwise" size="small" @click="muat" />
        </div>
      </template>
      <template #content>
        <NoData v-if="!hampirKedaluwarsa.length" />
        <DataTable v-else :value="hampirKedaluwarsa" stripedRows class="text-xs" scrollable scrollHeight="flex">
          <Column header="Set" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.namaSet }}</div>
              <div class="text-grey-400">{{ d.kodeSetFisik }} · {{ d.kodeBarcode }}</div>
            </template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaSetCssd(d.status)?.bg, gayaSetCssd(d.status)?.text]">{{ gayaSetCssd(d.status)?.label }}</span>
            </template>
          </Column>
          <Column header="Kedaluwarsa" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ waktuRingkas(d.tanggalKedaluwarsaSteril) }}</template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Card class="flex-1 overflow-hidden">
      <template #header>
        <h2 class="px-5 pt-4 font-semibold">Recall Perlu Tindak Lanjut</h2>
      </template>
      <template #content>
        <NoData v-if="!recallTerbuka.length" />
        <DataTable v-else :value="recallTerbuka" stripedRows class="text-xs" scrollable scrollHeight="flex">
          <Column field="nomorLoad" header="Load" headerClass="bg-opensimrs-50" />
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaRecallCssd(d.status)?.bg, gayaRecallCssd(d.status)?.text]">{{ gayaRecallCssd(d.status)?.label }}</span>
            </template>
          </Column>
          <Column header="Set Belum Ditindaklanjuti" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.jumlahBelumDitindaklanjuti }} / {{ d.jumlahSet }}</template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <CustomButton label="Tinjau" size="small" @click="router.push({ path: '/cssd/recall', query: { load: d.loadUuid } })" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>
