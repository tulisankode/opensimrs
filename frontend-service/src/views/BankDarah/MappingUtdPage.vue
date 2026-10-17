<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useToast } from "primevue/usetoast";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { JENIS_MAPPING_UTD, daftarKoneksiUtd, daftarMappingUtd, simpanMappingUtd } from "@/stores/penunjang/bankDarah";

// Mapping komponen darah (wajib untuk pengiriman), unit asal, dokter peminta, dan penjamin → kode UTD, per koneksi
// (KF-7). Satu faskes bisa punya kode berbeda untuk UTD yang berbeda, jadi koneksi dipilih dahulu.
type Jenis = "komponen" | "unit" | "dokter" | "penjamin";
const TAB: { kode: Jenis; contoh: string }[] = [
  { kode: "komponen", contoh: "mis. PRC" },
  { kode: "unit", contoh: "mis. RI-01" },
  { kode: "dokter", contoh: "mis. DRG-0040" },
  { kode: "penjamin", contoh: "mis. UMUM" },
];

const storeUtils = utilsStore();
const toast = useToast();

const koneksiList = ref<any[]>([]);
const koneksiUuid = ref<string>("");
const data = ref<any[]>([]);
const tab = ref<Jenis>("komponen");
const cari = ref("");
const hanyaBelumDipetakan = ref(false);
const berubah = (r: any) => (r.pilihan ?? "") !== (r.kodeUtd ?? "");
const jumlahBerubah = computed(() => data.value.filter(berubah).length);
const tersaring = computed(() => {
  const k = cari.value.trim().toLowerCase();
  return data.value.filter((r) => !k || [r.kode, r.nama].some((v) => String(v ?? "").toLowerCase().includes(k)));
});

const muatKoneksi = async () => {
  const res = await daftarKoneksiUtd();
  koneksiList.value = res?.payload ?? [];
  if (!koneksiUuid.value) koneksiUuid.value = koneksiList.value.find((k) => k.bawaan)?.uuid ?? koneksiList.value[0]?.uuid ?? "";
};

const muat = async () => {
  if (!koneksiUuid.value) return (data.value = []);
  storeUtils.setLoading(true);
  try {
    const res = await daftarMappingUtd(tab.value, { koneksi_uuid: koneksiUuid.value, belum_dipetakan: hanyaBelumDipetakan.value });
    data.value = (res?.payload ?? []).map((r: any) => ({ ...r, pilihan: r.kodeUtd ?? "" }));
  } finally {
    storeUtils.setLoading(false);
  }
};

const simpanSemua = async () => {
  const items = data.value.filter(berubah);
  if (!items.length) return toast.add({ severity: "info", summary: "Tidak ada perubahan", life: 2500 });
  storeUtils.setLoading(true);
  try {
    for (const r of items) await simpanMappingUtd(tab.value, { koneksiUuid: koneksiUuid.value, refUuid: r.uuid, kodeUtd: r.pilihan?.trim() ?? "" });
    toast.add({ severity: "success", summary: `${items.length} mapping disimpan`, life: 3000 });
    await muat();
  } finally {
    storeUtils.setLoading(false);
  }
};

watch([koneksiUuid, tab, hanyaBelumDipetakan], muat);
onMounted(async () => {
  await muatKoneksi();
  await muat();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden flex flex-col" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Mapping UTD</h1>
          <CustomSelect v-model="koneksiUuid" class="w-56" label="Koneksi UTD" :options="koneksiList" optionValue="uuid" optionLabel="nama" />
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nama / kode" :maxLength="100" />
          <CustomSwitch v-model="hanyaBelumDipetakan" label="Hanya belum dipetakan" sideLabel="Semua" sideLabelTrue="Belum dipetakan" />
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
            {{ JENIS_MAPPING_UTD[t.kode] }}
          </button>
        </div>
        <div v-if="!koneksiList.length" class="px-4 pt-2 pb-2 text-xs text-[#B42318]">
          Belum ada koneksi UTD. Tambahkan di Setting › Konfigurasi Integrasi › Konfigurasi Bank Darah/UTD.
        </div>
        <div v-else class="px-4 pt-2 pb-2 text-xs text-grey-400">
          Komponen darah wajib dipetakan sebelum permintaan dapat dikirim ke koneksi ini. Unit, dokter, dan penjamin opsional — isi hanya bila disyaratkan UTD tujuan.
        </div>
        <NoData v-if="!tersaring.length" />
        <DataTable v-else :value="tersaring" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 50rem">
          <Column v-if="tab !== 'dokter'" header="Kode OpenSIMRS" field="kode" headerClass="bg-opensimrs-50" class="w-[130px]" />
          <Column header="Nama" headerClass="bg-opensimrs-50">
            <template #body="{ data: r }">{{ r.nama }}</template>
          </Column>
          <Column header="Kode di UTD" headerClass="bg-opensimrs-50" class="w-[220px]">
            <template #body="{ data: r }">
              <CustomTextfield v-model="r.pilihan" :showLabel="false" :placeholder="TAB.find((t) => t.kode === tab)?.contoh" :maxLength="50" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>
