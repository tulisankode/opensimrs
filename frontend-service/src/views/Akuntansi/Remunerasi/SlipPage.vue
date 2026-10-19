<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { rupiah, tanggalAk } from "@/stores/penunjang/akuntansi";
import { GAYA_STATUS_REMUN, STATUS_PERIODE_REMUN, detailSlipSaya, slipSaya } from "@/stores/penunjang/remunerasi";
import SlipRincian from "./SlipRincian.vue";

// Slip jasa pelayanan milik pengguna login (STD-0032): penerima ditentukan backend dari akun (users.practitioner_uuid),
// hanya periode yang sudah disetujui/dibayar. Rincian layanan memakai penanda pasien anonim (tanpa nama/No. RM).
const storeUtils = utilsStore();
const daftar = ref<any[]>([]);
const slip = ref<any>(null);
const pesan = ref("");
const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const r = await slipSaya();
    daftar.value = r?.payload ?? [];
    pesan.value = r ? "" : "Akun Anda belum ditautkan ke data praktisi atau belum memiliki slip.";
  } finally {
    storeUtils.setLoading(false);
  }
};
const buka = async (uuid: string) => {
  storeUtils.setLoading(true);
  try {
    slip.value = (await detailSlipSaya(uuid))?.payload ?? null;
  } finally {
    storeUtils.setLoading(false);
  }
};
onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Slip Jasa Pelayanan Saya</h1>
          <CustomButton v-if="slip" label="Kembali ke daftar" icon="PhArrowLeft" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="slip = null" />
        </PageToolbar>
      </template>
      <template #content>
        <template v-if="!slip">
          <div v-if="pesan" class="px-1 pb-2 text-xs text-grey-400">{{ pesan }}</div>
          <NoData v-if="!daftar.length" />
          <DataTable v-else :value="daftar" stripedRows class="text-xs cursor-pointer" @rowClick="buka($event.data.uuid)">
            <Column header="Periode" headerClass="bg-opensimrs-50"><template #body="{ data: p }"><span class="font-semibold">{{ p.nama }}</span></template></Column>
            <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: p }"><span :class="['px-2 py-0.5 rounded-full', GAYA_STATUS_REMUN[p.status]]">{{ STATUS_PERIODE_REMUN[p.status] }}</span></template></Column>
            <Column header="Langsung" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: p }">{{ rupiah(p.langsung) }}</template></Column>
            <Column header="Kebersamaan" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: p }">{{ rupiah(p.kebersamaan) }}</template></Column>
            <Column header="Koreksi" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: p }">{{ rupiah(p.koreksi) }}</template></Column>
            <Column header="Total" headerClass="bg-opensimrs-50" bodyClass="text-right font-semibold"><template #body="{ data: p }">{{ rupiah(p.total) }}</template></Column>
            <Column header="Dibayar" headerClass="bg-opensimrs-50"><template #body="{ data: p }">{{ p.tanggalBayar ? tanggalAk(p.tanggalBayar) : "-" }}</template></Column>
          </DataTable>
        </template>
        <SlipRincian v-else :slip="slip" />
      </template>
    </Card>
  </div>
</template>
