<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { JENIS_DOKUMEN, bukaBerkas, daftarDokumenSurveior, tanggalMutu, unduhBerkasSurveior } from "@/stores/penunjang/mutu";

// Dokumen yang dibagikan ke surveior (KF-11): baca saja, hanya dokumen disahkan yang dibagikan faskes dan belum
// melewati batas waktu berbagi (izin "Akses Surveior" › READ).
const storeUtils = utilsStore();
const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarDokumenSurveior({ page: page.value, limit: limit.value, cari: cari.value.trim() });
    data.value = res?.payload?.data ?? [];
    total.value = res?.payload?.pagination?.total ?? 0;
  } finally {
    storeUtils.setLoading(false);
  }
};
const cariData = () => {
  page.value = 1;
  muat();
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};
const lihat = async (uuid: string) => bukaBerkas((await unduhBerkasSurveior(uuid))?.payload);

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Dokumen untuk Surveior</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nomor / judul" :maxLength="100" @keydown.enter="cariData" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 56rem">
          <Column header="Dokumen" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.nomor }} <span class="font-normal text-grey-400">v{{ d.versi }}</span></div>
              <div>{{ d.judul }}</div>
            </template>
          </Column>
          <Column header="Jenis" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ JENIS_DOKUMEN[d.jenis] ?? d.jenis }}</template></Column>
          <Column field="unitPemilik" header="Unit Pemilik" headerClass="bg-opensimrs-50" />
          <Column header="Terbit" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ tanggalMutu(d.tanggalTerbit) }}</template></Column>
          <Column header="Elemen Penilaian" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.elemen.map((e: any) => `${e.babKode}/${e.standarKode}/${e.kode}`).join(", ") || "-" }}</template>
          </Column>
          <Column header="Dibagikan s.d." headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.dibagikanSampai ? tanggalMutu(d.dibagikanSampai) : "Tanpa batas" }}</template></Column>
          <Column header="" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><CustomButton label="Lihat" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="lihat(d.uuid)" /></template>
          </Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>
  </div>
</template>
