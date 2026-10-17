<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { daftarMappingRefPacs, simpanMappingRefPacs } from "@/stores/penunjang/radiologi";

// Mapping unit asal / dokter pengirim / penjamin → kode PACS. Opsional per field — hanya wajib bila PACS tujuan
// mensyaratkannya (pengiriman akan menyebut field yang belum lengkap bila ditolak PACS).
type Jenis = "unit" | "dokter" | "penjamin";
const TAB: { kode: Jenis; label: string; kolom: string; contoh: string }[] = [
  { kode: "unit", label: "Unit Asal", kolom: "Poli / Ruang OpenSIMRS", contoh: "mis. RAD-01" },
  { kode: "dokter", label: "Dokter Pengirim", kolom: "Dokter OpenSIMRS", contoh: "mis. DRG-0040" },
  { kode: "penjamin", label: "Penjamin", kolom: "Penjamin OpenSIMRS", contoh: "mis. UMUM" },
];

const storeUtils = utilsStore();
const toast = useToast();

const data = ref<Record<Jenis, any[]>>({ unit: [], dokter: [], penjamin: [] });
const tab = ref<Jenis>("unit");
const cari = ref("");
const tabAktif = computed(() => TAB.find((t) => t.kode === tab.value)!);
const berubah = (r: any) => (r.pilihan ?? "") !== (r.awal ?? "") || (r.namaPilihan ?? "") !== (r.namaAwal ?? "");
const semua = computed(() => [...data.value.unit, ...data.value.dokter, ...data.value.penjamin]);
const jumlahBerubah = computed(() => semua.value.filter(berubah).length);
const kosong = (j: Jenis) => data.value[j].filter((r) => !r.kodePacs).length;
const tersaring = computed(() => {
  const k = cari.value.trim().toLowerCase();
  return data.value[tab.value].filter((r) => !k || [r.kode, r.nama, r.pilihan, r.namaPilihan].some((v) => String(v ?? "").toLowerCase().includes(k)));
});

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarMappingRefPacs();
    const p = res?.payload ?? {};
    const siapkan = (jenis: Jenis, rows: any[] = []) =>
      rows.map((r) => ({ ...r, jenis, pilihan: r.kodePacs ?? "", awal: r.kodePacs ?? "", namaPilihan: r.namaPacs ?? "", namaAwal: r.namaPacs ?? "" }));
    data.value = { unit: siapkan("unit", p.unit), dokter: siapkan("dokter", p.dokter), penjamin: siapkan("penjamin", p.penjamin) };
  } finally {
    storeUtils.setLoading(false);
  }
};

const simpanSemua = async () => {
  const items = semua.value.filter(berubah);
  if (!items.length) return toast.add({ severity: "info", summary: "Tidak ada perubahan", life: 2500 });
  storeUtils.setLoading(true);
  try {
    for (const r of items) {
      await simpanMappingRefPacs(r.jenis, r.uuid, { kodePacs: r.pilihan?.trim() ?? "", namaPacs: r.namaPilihan?.trim() || null });
    }
    toast.add({ severity: "success", summary: `${items.length} mapping disimpan`, life: 3000 });
    await muat();
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden flex flex-col" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Mapping Unit, Dokter & Penjamin PACS</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nama / kode" :maxLength="100" />
          <CustomButton class="toolbar-action" icon="PhFloppyDisk" :label="jumlahBerubah ? `Simpan (${jumlahBerubah})` : 'Simpan'" @click="simpanSemua" />
        </PageToolbar>
      </template>
      <template #content>
        <div class="flex flex-wrap items-center gap-2 px-4 pt-3" role="tablist">
          <button
            v-for="t in TAB"
            :key="t.kode"
            type="button"
            role="tab"
            :aria-selected="tab === t.kode"
            class="px-3 py-1.5 text-sm rounded-full border"
            :class="tab === t.kode ? 'bg-opensimrs-300 text-white border-opensimrs-300' : 'bg-white text-grey-500 border-grey-75'"
            @click="tab = t.kode"
          >
            {{ t.label }}
            <span v-if="kosong(t.kode)" class="ml-1 text-[10px] opacity-80">({{ kosong(t.kode) }} belum)</span>
          </button>
        </div>
        <div class="px-4 pt-2 pb-2 text-xs text-grey-400">
          Mapping ini opsional — kosongkan bila PACS tidak mensyaratkan kode khusus untuk field tersebut. "Nama di PACS" opsional, isi bila penulisan nama di PACS berbeda.
        </div>
        <NoData v-if="!tersaring.length" />
        <DataTable v-else :value="tersaring" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 55rem">
          <Column header="Kode OpenSIMRS" field="kode" headerClass="bg-opensimrs-50" class="w-[130px]" />
          <Column :header="tabAktif.kolom" headerClass="bg-opensimrs-50">
            <template #body="{ data: r }">{{ r.nama }}</template>
          </Column>
          <Column header="Kode di PACS" headerClass="bg-opensimrs-50" class="w-[200px]">
            <template #body="{ data: r }">
              <CustomTextfield v-model="r.pilihan" :showLabel="false" :placeholder="tabAktif.contoh" :maxLength="50" />
            </template>
          </Column>
          <Column header="Nama di PACS (opsional)" headerClass="bg-opensimrs-50" class="w-[260px]">
            <template #body="{ data: r }">
              <CustomTextfield v-model="r.namaPilihan" :showLabel="false" :placeholder="r.nama" :maxLength="200" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>
