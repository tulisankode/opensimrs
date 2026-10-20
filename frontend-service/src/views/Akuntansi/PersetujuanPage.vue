<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { getLoginUsername } from "@/utils/permissions";
import DetailJurnalDialog from "./DetailJurnalDialog.vue";
import { JENIS_JURNAL, daftarJurnal, rupiah, tanggalAk, waktuAk } from "@/stores/penunjang/akuntansi";

// Antrean persetujuan jurnal manual/penyesuaian/koreksi (KF-8/KF-9): jurnal menunggu belum memengaruhi saldo. Pembuat
// tidak dapat menyetujui jurnalnya sendiri; tingkat 2 (nominal ≥ ambang) harus disetujui orang berbeda dari tingkat 1.
const storeUtils = utilsStore();
const saya = getLoginUsername().toLowerCase();
const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const r = await daftarJurnal({ status: "menunggu", page: page.value, limit: limit.value });
    data.value = r?.payload?.data ?? [];
    total.value = r?.payload?.pagination?.total ?? 0;
  } finally {
    storeUtils.setLoading(false);
  }
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};
const detailUuid = ref<string | null>(null);
const dialog = ref(false);
const buka = (uuid: string) => {
  detailUuid.value = uuid;
  dialog.value = true;
};
onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Persetujuan Jurnal</h1>
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs cursor-pointer" scrollable scrollHeight="flex" tableStyle="min-width: 56rem" @rowClick="buka($event.data.uuid)">
          <Column header="Tanggal" headerClass="bg-opensimrs-50"><template #body="{ data: j }">{{ tanggalAk(j.tanggal) }}</template></Column>
          <Column header="Nomor" headerClass="bg-opensimrs-50"><template #body="{ data: j }"><span class="font-semibold">{{ j.nomor }}</span></template></Column>
          <Column header="Jenis" headerClass="bg-opensimrs-50"><template #body="{ data: j }">{{ JENIS_JURNAL[j.jenis] ?? j.jenis }}</template></Column>
          <Column header="Uraian" headerClass="bg-opensimrs-50"><template #body="{ data: j }">{{ j.uraian }}<div v-if="j.alasan" class="text-[11px] text-grey-400">{{ j.alasan }}</div></template></Column>
          <Column header="Nominal" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: j }">{{ rupiah(j.totalDebit) }}</template></Column>
          <Column header="Tingkat" headerClass="bg-opensimrs-50"><template #body="{ data: j }">{{ j.tingkatDisetujui }} / {{ j.tingkatWajib }}</template></Column>
          <Column header="Diajukan" headerClass="bg-opensimrs-50">
            <template #body="{ data: j }">{{ j.dibuatOleh }} · {{ waktuAk(j.createdAt) }}<span v-if="String(j.dibuatOleh).toLowerCase() === saya" class="ml-1 text-grey-400">(Anda)</span></template>
          </Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>
    <DetailJurnalDialog v-model:visible="dialog" :uuid="detailUuid" modePersetujuan @berubah="muat" />
  </div>
</template>
