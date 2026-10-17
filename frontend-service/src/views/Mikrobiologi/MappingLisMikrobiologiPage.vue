<script setup lang="ts">
import { computed, ref } from "vue";
import { useToast } from "primevue/usetoast";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { daftarPemetaanLisMikro, izinMikro, simpanPemetaanLisMikro, type JenisPemetaanLisMikro } from "@/stores/penunjang/mikrobiologi";

// Mapping LIS Mikrobiologi (fitur mikro_bridging_lis): kode LIS vendor per pemeriksaan, jenis spesimen, organisme,
// antibiotik, unit, dokter, dan penjamin. Kode organisme/antibiotik dipakai lis-peta.js (petakanIsolat) untuk
// mencocokkan isolat/kepekaan dari LIS; yang belum dipetakan tampil "Tidak cocok dengan item" di Pemeriksaan & Hasil.
type BarisPeta = { id: string; kode?: string | null; nama: string; kelompok?: string | null; pilihan: string; awal: string; namaLis?: string; namaLisAwal?: string };

const storeUtils = utilsStore();
const toast = useToast();
const boleh = (aksi: string) => izinMikro("Mapping LIS Mikrobiologi", aksi);

const TAB = [
  { value: "pemeriksaan", label: "Pemeriksaan", namaLis: false },
  { value: "spesimen", label: "Jenis Spesimen", namaLis: true },
  { value: "organisme", label: "Organisme", namaLis: false },
  { value: "antibiotik", label: "Antibiotik", namaLis: false },
  { value: "unit", label: "Unit Pengirim", namaLis: true },
  { value: "dokter", label: "Dokter Pengirim", namaLis: true },
  { value: "penjamin", label: "Penjamin", namaLis: true },
] as const;
const tab = ref<JenisPemetaanLisMikro>("pemeriksaan");
const tabAktif = computed(() => TAB.find((t) => t.value === tab.value)!);

const cari = ref("");
const hanyaKosong = ref(false);
const baris = ref<BarisPeta[]>([]);
const tersaring = computed(() => {
  const k = cari.value.trim().toLowerCase();
  return baris.value.filter(
    (b) => (!hanyaKosong.value || !b.pilihan) && (!k || [b.kode, b.nama, b.kelompok, b.pilihan].some((v) => String(v ?? "").toLowerCase().includes(k))),
  );
});
const jumlahKosong = computed(() => baris.value.filter((b) => !b.pilihan).length);
const jumlahBerubah = computed(() => baris.value.filter((b) => b.pilihan !== b.awal || (tabAktif.value.namaLis && b.namaLis !== b.namaLisAwal)).length);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarPemetaanLisMikro(tab.value);
    baris.value = (res?.payload ?? []).map((b: any) => ({
      id: b.uuid ?? b.kode,
      kode: b.kode ?? null,
      nama: b.nama,
      kelompok: b.kelompok ?? b.golongan ?? null,
      pilihan: b.kodeLis ?? "",
      awal: b.kodeLis ?? "",
      namaLis: b.namaLis ?? "",
      namaLisAwal: b.namaLis ?? "",
    }));
  } finally {
    storeUtils.setLoading(false);
  }
};
const gantiTab = (v: string) => {
  tab.value = v as JenisPemetaanLisMikro;
  cari.value = "";
  hanyaKosong.value = false;
  muat();
};

const simpan = async () => {
  const berubah = baris.value.filter((b) => b.pilihan !== b.awal || (tabAktif.value.namaLis && b.namaLis !== b.namaLisAwal));
  if (!berubah.length) return toast.add({ severity: "info", summary: "Tidak ada perubahan", life: 2500 });
  storeUtils.setLoading(true);
  try {
    const items = berubah.map((b) => ({ uuid: b.id, kode: b.kode ?? b.id, kode_lis: b.pilihan?.trim() || null, nama_lis: b.namaLis?.trim() || null }));
    const res = await simpanPemetaanLisMikro(tab.value, items);
    if (res?.gagal) return toast.add({ severity: "error", summary: "Gagal menyimpan", detail: res.message, life: 5000 });
    toast.add({ severity: "success", summary: `${berubah.length} pemetaan ${tabAktif.value.label} disimpan`, life: 3000 });
    await muat();
  } finally {
    storeUtils.setLoading(false);
  }
};

muat();
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Mapping LIS Mikrobiologi</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nama / kode / kode LIS" :maxLength="100" />
          <label class="flex items-center gap-2 text-sm toolbar-item">
            <Checkbox v-model="hanyaKosong" binary />
            Belum dipetakan ({{ jumlahKosong }})
          </label>
          <CustomButton v-if="boleh('KELOLA')" class="toolbar-action" icon="PhFloppyDisk" :label="jumlahBerubah ? `Simpan (${jumlahBerubah})` : 'Simpan'" :disabled="!jumlahBerubah" @click="simpan" />
        </PageToolbar>
      </template>
      <template #content>
        <Tabs :value="tab" class="flex flex-col h-full" @update:value="gantiTab">
          <TabList>
            <Tab v-for="t in TAB" :key="t.value" :value="t.value">{{ t.label }}</Tab>
          </TabList>
          <TabPanels class="overflow-auto grow !p-0">
            <TabPanel v-for="t in TAB" :key="t.value" :value="t.value">
              <div v-if="t.value === 'organisme' || t.value === 'antibiotik'" class="px-4 pt-3 pb-2 text-xs text-grey-400">
                Organisme/antibiotik dari hasil LIS dicocokkan ke Kode LIS di sini terlebih dahulu. Yang belum cocok tetap tersimpan dan ditampilkan sebagai
                "Tidak cocok dengan item" di Pemeriksaan &amp; Hasil.
              </div>
              <NoData v-if="!tersaring.length" />
              <DataTable v-else :value="tersaring" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 50rem">
                <Column v-if="tersaring.some((b) => b.kode)" header="Kode" field="kode" headerClass="bg-opensimrs-50" class="w-[130px]" />
                <Column header="Nama" headerClass="bg-opensimrs-50">
                  <template #body="{ data }">
                    {{ data.nama }}
                    <span v-if="data.kelompok" class="ml-1 text-grey-400">({{ data.kelompok }})</span>
                  </template>
                </Column>
                <Column header="Kode LIS" headerClass="bg-opensimrs-50" class="w-[220px]">
                  <template #body="{ data }">
                    <CustomTextfield v-model="data.pilihan" :showLabel="false" placeholder="mis. ECO" :maxLength="50" />
                  </template>
                </Column>
                <Column v-if="t.namaLis" header="Nama di LIS (opsional)" headerClass="bg-opensimrs-50" class="w-[240px]">
                  <template #body="{ data }">
                    <CustomTextfield v-model="data.namaLis" :showLabel="false" placeholder="Nama sesuai LIS" :maxLength="200" />
                  </template>
                </Column>
              </DataTable>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </template>
    </Card>
  </div>
</template>
