<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { daftarMappingTindakanPacs, simpanMappingTindakanPacs } from "@/stores/penunjang/radiologi";

// Mapping tindakan radiologi → kode prosedur & modalitas PACS. Dikirim sebagai pemeriksaan.kode_prosedur_pacs /
// modalitas_pacs saat "Validasi & Kirim ke PACS"; tindakan tanpa mapping ditolak dengan nama tindakan disebutkan.
const OPSI_MODALITAS_PACS = ["CR", "CT", "MR", "US", "DX", "MG"].map((v) => ({ value: v, label: v }));

const storeUtils = utilsStore();
const toast = useToast();

const data = ref<any[]>([]);
const cari = ref("");
const hanyaKosong = ref(false);
const tersaring = computed(() => {
  const k = cari.value.trim().toLowerCase();
  return data.value.filter(
    (t) => (!hanyaKosong.value || !t.pilihanKode) && (!k || [t.kode, t.nama, t.pilihanKode].some((v) => String(v ?? "").toLowerCase().includes(k)))
  );
});
const jumlahKosong = computed(() => data.value.filter((t) => !t.pilihanKode).length);
const berubah = (t: any) => (t.pilihanKode ?? "") !== (t.awalKode ?? "") || (t.pilihanModalitas ?? "") !== (t.awalModalitas ?? "");
const jumlahBerubah = computed(() => data.value.filter(berubah).length);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarMappingTindakanPacs();
    data.value = (res?.payload ?? []).map((t: any) => ({
      ...t,
      pilihanKode: t.kodeProsedurPacs ?? "", awalKode: t.kodeProsedurPacs ?? "",
      pilihanModalitas: t.modalitasPacs ?? "", awalModalitas: t.modalitasPacs ?? "",
    }));
  } finally {
    storeUtils.setLoading(false);
  }
};

const simpanSemua = async () => {
  const items = data.value.filter(berubah);
  if (!items.length) return toast.add({ severity: "info", summary: "Tidak ada perubahan", life: 2500 });
  storeUtils.setLoading(true);
  try {
    for (const t of items) {
      await simpanMappingTindakanPacs(t.pemeriksaanUuid, { kodeProsedurPacs: t.pilihanKode?.trim() ?? "", modalitasPacs: t.pilihanModalitas ?? "" });
    }
    toast.add({ severity: "success", summary: `${items.length} mapping tindakan PACS disimpan`, life: 3000 });
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
          <h1 class="toolbar-heading text-opensimrs-300">Mapping Tindakan PACS</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nama / kode tindakan" :maxLength="100" />
          <label class="flex items-center gap-2 text-sm toolbar-item">
            <Checkbox v-model="hanyaKosong" binary />
            Belum dipetakan ({{ jumlahKosong }})
          </label>
          <CustomButton class="toolbar-action" icon="PhFloppyDisk" :label="jumlahBerubah ? `Simpan (${jumlahBerubah})` : 'Simpan'" @click="simpanSemua" />
        </PageToolbar>
      </template>
      <template #content>
        <div class="px-4 pt-3 pb-2 text-xs text-grey-400">
          Kode prosedur & modalitas PACS dikirim saat order divalidasi & dikirim ke PACS. Tindakan tanpa mapping ditolak dan menyebutkan nama tindakan tersebut.
        </div>
        <NoData v-if="!tersaring.length" />
        <DataTable v-else :value="tersaring" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 55rem">
          <Column header="Kode" field="kode" headerClass="bg-opensimrs-50" class="w-[120px]" />
          <Column header="Tindakan Radiologi" headerClass="bg-opensimrs-50">
            <template #body="{ data: t }">{{ t.nama }} <span class="text-grey-300">· {{ t.modalitas }}</span></template>
          </Column>
          <Column header="Kode Prosedur PACS" headerClass="bg-opensimrs-50" class="w-[220px]">
            <template #body="{ data: t }">
              <CustomTextfield v-model="t.pilihanKode" :showLabel="false" placeholder="mis. CR-THX" :maxLength="50" />
            </template>
          </Column>
          <Column header="Modalitas PACS" headerClass="bg-opensimrs-50" class="w-[180px]">
            <template #body="{ data: t }">
              <CustomSelect v-model="t.pilihanModalitas" :options="OPSI_MODALITAS_PACS" optionValue="value" optionLabel="label" placeHolder="Pilih modalitas" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>
