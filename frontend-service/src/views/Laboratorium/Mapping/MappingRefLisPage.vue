<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import NoData from "@/components/section/NoData.vue";
import { useLisStore } from "@/stores/Laboratorium/lis";
import { utilsStore } from "@/stores/utils";

// Mapping registrasi ke LIS: kode master LIS untuk Unit Asal (poli/ruang), Dokter Pengirim dan Penjamin.
// LIS menolak kode baru yang namanya sudah ada di masternya (mis. "Data Unit Asal sudah ada di master data
// (0202 - Poli Umum)"), jadi isi kode LIS-nya di sini. Nama LIS opsional: kosong = nama OpenSIMRS.
type Jenis = "unit" | "dokter" | "penjamin";
const TAB: { kode: Jenis; label: string; kolom: string; contoh: string }[] = [
  { kode: "unit", label: "Unit Asal", kolom: "Poli / Ruang OpenSIMRS", contoh: "mis. 0202" },
  { kode: "dokter", label: "Dokter Pengirim", kolom: "Dokter OpenSIMRS", contoh: "mis. DRG-0040" },
  { kode: "penjamin", label: "Penjamin", kolom: "Penjamin OpenSIMRS", contoh: "mis. 1" },
];

const store = useLisStore();
const storeUtils = utilsStore();
const toast = useToast();

const data = ref<Record<Jenis, any[]>>({ unit: [], dokter: [], penjamin: [] });
const tab = ref<Jenis>("unit");
const cari = ref("");
const tabAktif = computed(() => TAB.find((t) => t.kode === tab.value)!);
const berubah = (r: any) => (r.pilihan ?? "") !== (r.awal ?? "") || (r.namaPilihan ?? "") !== (r.namaAwal ?? "");
const semua = computed(() => [...data.value.unit, ...data.value.dokter, ...data.value.penjamin]);
const jumlahBerubah = computed(() => semua.value.filter(berubah).length);
const kosong = (j: Jenis) => data.value[j].filter((r) => !r.pilihan).length;
const tersaring = computed(() => {
  const k = cari.value.trim().toLowerCase();
  return data.value[tab.value].filter((r) => !k || [r.kode, r.nama, r.pilihan, r.namaPilihan].some((v) => String(v ?? "").toLowerCase().includes(k)));
});

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await store.getPemetaanRef();
    const p = res?.payload ?? {};
    const siapkan = (rows: any[] = []) =>
      rows.map((r) => ({ ...r, pilihan: r.kodeLis ?? "", awal: r.kodeLis ?? "", namaPilihan: r.namaLis ?? "", namaAwal: r.namaLis ?? "" }));
    data.value = { unit: siapkan(p.unit), dokter: siapkan(p.dokter), penjamin: siapkan(p.penjamin) };
  } finally {
    storeUtils.setLoading(false);
  }
};

const simpan = async () => {
  const items = semua.value.filter(berubah);
  if (!items.length) return toast.add({ severity: "info", summary: "Tidak ada perubahan", life: 2500 });
  storeUtils.setLoading(true);
  try {
    const res = await store.simpanPemetaanRef(
      items.map((r) => ({ jenis: r.jenis, uuid: r.uuid, kode_lis: r.pilihan?.trim() || null, nama_lis: r.namaPilihan?.trim() || null }))
    );
    if (res?.gagal) return toast.add({ severity: "error", summary: "Gagal menyimpan", detail: res.message, life: 5000 });
    toast.add({ severity: "success", summary: `${items.length} pemetaan disimpan`, life: 3000 });
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
          <h1 class="toolbar-heading text-opensimrs-300">Mapping Unit, Dokter & Penjamin LIS</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nama / kode" :maxLength="100" />
          <CustomButton
            class="toolbar-action"
            icon="PhFloppyDisk"
            :label="jumlahBerubah ? `Simpan (${jumlahBerubah})` : 'Simpan'"
            @click="simpan"
          />
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
          Isi kode master di LIS. Bila kosong, yang dikirim kode OpenSIMRS — LIS menolak bila namanya sudah ada di masternya dengan
          kode lain. "Nama di LIS" opsional, isi bila penulisan nama di LIS berbeda.
        </div>
        <NoData v-if="!tersaring.length" />
        <DataTable v-else :value="tersaring" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 55rem">
          <Column header="Kode OpenSIMRS" field="kode" headerClass="bg-opensimrs-50" class="w-[130px]" />
          <Column :header="tabAktif.kolom" headerClass="bg-opensimrs-50">
            <template #body="{ data: r }">
              {{ r.nama }}
              <span v-if="r.keterangan" class="ml-1 text-grey-400">· {{ r.keterangan }}</span>
            </template>
          </Column>
          <Column header="Kode di LIS" headerClass="bg-opensimrs-50" class="w-[200px]">
            <template #body="{ data: r }">
              <CustomTextfield v-model="r.pilihan" :showLabel="false" :placeholder="tabAktif.contoh" :maxLength="50" />
            </template>
          </Column>
          <Column header="Nama di LIS (opsional)" headerClass="bg-opensimrs-50" class="w-[260px]">
            <template #body="{ data: r }">
              <CustomTextfield v-model="r.namaPilihan" :showLabel="false" :placeholder="r.nama" :maxLength="200" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>
