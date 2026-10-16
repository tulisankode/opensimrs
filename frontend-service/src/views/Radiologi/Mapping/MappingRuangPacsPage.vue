<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { daftarMappingRuangPacs, simpanMappingRuangPacs } from "@/stores/penunjang/radiologi";

// Mapping ruang/alat radiologi → AE Title modalitas: data referensi yang dikirim bersama order ke PACS/RIS
// (PACS yang membentuk Modality Worklist-nya sendiri; SIMRS tidak menyediakan endpoint DICOM MWL).
const storeUtils = utilsStore();
const toast = useToast();

const data = ref<any[]>([]);
const cari = ref("");
const hanyaKosong = ref(false);
const tersaring = computed(() => {
  const k = cari.value.trim().toLowerCase();
  return data.value.filter((r) => (!hanyaKosong.value || !r.pilihan) && (!k || [r.kode, r.nama, r.namaAlat, r.pilihan].some((v) => String(v ?? "").toLowerCase().includes(k))));
});
const jumlahKosong = computed(() => data.value.filter((r) => !r.pilihan).length);
const berubah = (r: any) => (r.pilihan ?? "") !== (r.awal ?? "");
const jumlahBerubah = computed(() => data.value.filter(berubah).length);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarMappingRuangPacs();
    data.value = (res?.payload ?? []).map((r: any) => ({ ...r, pilihan: r.aeTitle ?? "", awal: r.aeTitle ?? "" }));
  } finally {
    storeUtils.setLoading(false);
  }
};

const simpanSemua = async () => {
  const items = data.value.filter(berubah);
  if (!items.length) return toast.add({ severity: "info", summary: "Tidak ada perubahan", life: 2500 });
  storeUtils.setLoading(true);
  try {
    for (const r of items) await simpanMappingRuangPacs(r.uuid, r.pilihan?.trim() || null);
    toast.add({ severity: "success", summary: `${items.length} AE Title ruang/alat disimpan`, life: 3000 });
    await muat();
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Mapping Ruang/Alat PACS (AE Title)</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nama / kode ruang" :maxLength="100" />
          <label class="flex items-center gap-2 text-sm toolbar-item">
            <Checkbox v-model="hanyaKosong" binary />
            Belum dipetakan ({{ jumlahKosong }})
          </label>
          <CustomButton class="toolbar-action" icon="PhFloppyDisk" :label="jumlahBerubah ? `Simpan (${jumlahBerubah})` : 'Simpan'" @click="simpanSemua" />
        </PageToolbar>
      </template>
      <template #content>
        <div class="px-4 pt-3 pb-2 text-xs text-grey-400">
          AE Title dikirim sebagai data referensi bersama order ke PACS/RIS. Opsional — kosongkan bila PACS tidak memerlukannya.
        </div>
        <NoData v-if="!tersaring.length" />
        <DataTable v-else :value="tersaring" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 50rem">
          <Column header="Kode" field="kode" headerClass="bg-opensimrs-50" class="w-[120px]" />
          <Column header="Ruang / Alat" headerClass="bg-opensimrs-50">
            <template #body="{ data: r }">{{ r.nama }} <span v-if="r.namaAlat" class="text-grey-300">· {{ r.namaAlat }}</span></template>
          </Column>
          <Column header="Modalitas" headerClass="bg-opensimrs-50">
            <template #body="{ data: r }">{{ Array.isArray(r.modalitas) ? r.modalitas.join(", ") : r.modalitas }}</template>
          </Column>
          <Column header="AE Title" headerClass="bg-opensimrs-50" class="w-[220px]">
            <template #body="{ data: r }">
              <CustomTextfield v-model="r.pilihan" :showLabel="false" placeholder="mis. DEMO_CR1" :maxLength="100" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>
