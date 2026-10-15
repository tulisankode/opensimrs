<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import NoData from "@/components/section/NoData.vue";
import { useLisStore } from "@/stores/Laboratorium/lis";
import { utilsStore } from "@/stores/utils";

// Mapping hasil dari LIS: kode pemeriksaan LIS per item pemeriksaan OpenSIMRS (mis. Hemoglobin → HGB).
// Hasil yang dikirim LIS dicocokkan berurutan: Kode LIS → kode item → nama item.
const store = useLisStore();
const storeUtils = utilsStore();
const toast = useToast();

const items = ref<any[]>([]);
const cari = ref("");
const hanyaKosong = ref(false);
const tersaring = computed(() => {
  const k = cari.value.trim().toLowerCase();
  return items.value.filter(
    (i) =>
      (!hanyaKosong.value || !i.pilihan) &&
      (!k || [i.code, i.name, i.kategori, i.pilihan].some((v) => String(v ?? "").toLowerCase().includes(k)))
  );
});
const jumlahKosong = computed(() => items.value.filter((i) => !i.pilihan).length);
const jumlahBerubah = computed(() => items.value.filter((i) => (i.pilihan ?? "") !== (i.awal ?? "")).length);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await store.getPemetaanItem();
    items.value = (res?.payload ?? []).map((i: any) => ({ ...i, pilihan: i.kodeLis ?? "", awal: i.kodeLis ?? "" }));
  } finally {
    storeUtils.setLoading(false);
  }
};

const simpan = async () => {
  const berubah = items.value.filter((i) => (i.pilihan ?? "") !== (i.awal ?? ""));
  if (!berubah.length) return toast.add({ severity: "info", summary: "Tidak ada perubahan", life: 2500 });
  storeUtils.setLoading(true);
  try {
    const res = await store.simpanPemetaanItem(berubah.map((i) => ({ uuid: i.uuid, kode_lis: i.pilihan?.trim() || null })));
    if (res?.gagal) return toast.add({ severity: "error", summary: "Gagal menyimpan", detail: res.message, life: 5000 });
    toast.add({ severity: "success", summary: `${berubah.length} kode hasil LIS disimpan`, life: 3000 });
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
          <h1 class="toolbar-heading text-opensimrs-300">Mapping Hasil LIS</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nama / kode item / kategori" :maxLength="100" />
          <label class="flex items-center gap-2 text-sm toolbar-item">
            <Checkbox v-model="hanyaKosong" binary />
            Belum dipetakan ({{ jumlahKosong }})
          </label>
          <CustomButton
            class="toolbar-action"
            icon="PhFloppyDisk"
            :label="jumlahBerubah ? `Simpan (${jumlahBerubah})` : 'Simpan'"
            @click="simpan"
          />
        </PageToolbar>
      </template>
      <template #content>
        <div class="px-4 pt-3 pb-2 text-xs text-grey-400">
          Kode pemeriksaan di LIS (mis. HGB, WBC) untuk mencocokkan hasil yang dikirim LIS ke item OpenSIMRS. Kosongkan bila kode
          item OpenSIMRS sudah sama dengan kode di LIS.
        </div>
        <NoData v-if="!tersaring.length" />
        <DataTable v-else :value="tersaring" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 50rem">
          <Column header="Kategori" field="kategori" headerClass="bg-opensimrs-50" class="w-[160px]" />
          <Column header="Kode Item" field="code" headerClass="bg-opensimrs-50" class="w-[120px]" />
          <Column header="Item Pemeriksaan OpenSIMRS" field="name" headerClass="bg-opensimrs-50" />
          <Column header="Satuan" field="satuan" headerClass="bg-opensimrs-50" class="w-[100px]" />
          <Column header="Kode Pemeriksaan LIS" headerClass="bg-opensimrs-50" class="w-[240px]">
            <template #body="{ data }">
              <CustomTextfield v-model="data.pilihan" :showLabel="false" placeholder="mis. HGB" :maxLength="50" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>
