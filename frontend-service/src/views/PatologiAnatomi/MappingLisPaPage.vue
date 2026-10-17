<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useToast } from "primevue/usetoast";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  FIELD_HASIL_LIS_PA,
  daftarKoneksiLisPa,
  daftarPemetaanHasilLisPa,
  daftarPemetaanPemeriksaanLisPa,
  daftarPemetaanRefLisPa,
  simpanPemetaanHasilLisPa,
  simpanPemetaanPemeriksaanLisPa,
  simpanPemetaanRefLisPa,
} from "@/stores/penunjang/patologi";

// Mapping Bridging LIS Patologi Anatomi (fitur pa_bridging_lis), per koneksi — satu faskes boleh punya lebih dari
// satu koneksi (sistem PA internal & rujukan) dengan kamus kode berbeda. Tiga tab: Pemeriksaan, Unit/Dokter/Penjamin,
// Field Hasil. Pola sama dengan Laboratorium › Mapping LIS, hanya digabung satu halaman (satu rute katalog).
type Tab = "pemeriksaan" | "ref" | "hasil";
const TAB: { kode: Tab; label: string }[] = [
  { kode: "pemeriksaan", label: "Pemeriksaan" },
  { kode: "ref", label: "Unit, Dokter & Penjamin" },
  { kode: "hasil", label: "Field Hasil" },
];
type JenisRef = "unit" | "dokter" | "penjamin";
const TAB_REF: { kode: JenisRef; label: string; kolom: string }[] = [
  { kode: "unit", label: "Unit Asal", kolom: "Poli / Ruang OpenSIMRS" },
  { kode: "dokter", label: "Dokter Pengirim", kolom: "Dokter OpenSIMRS" },
  { kode: "penjamin", label: "Penjamin", kolom: "Penjamin OpenSIMRS" },
];

const storeUtils = utilsStore();
const toast = useToast();

const koneksi = ref<any[]>([]);
const koneksiUuid = ref("");
const tab = ref<Tab>("pemeriksaan");
const tabRef = ref<JenisRef>("unit");
const cari = ref("");

const pemeriksaan = ref<any[]>([]);
const ref_ = ref<Record<JenisRef, any[]>>({ unit: [], dokter: [], penjamin: [] });
const hasil = ref<any[]>([]);

const siapkanKode = (rows: any[] = [], labelKode = "kode_lis", labelNama = "nama_lis") =>
  rows.map((r: any) => ({ ...r, pilihan: r[labelKode] ?? "", awal: r[labelKode] ?? "", namaPilihan: r[labelNama] ?? "", namaAwal: r[labelNama] ?? "" }));

const muatKoneksi = async () => {
  const res = await daftarKoneksiLisPa();
  koneksi.value = (res?.payload ?? []).filter((k: any) => k.aktif);
  if (!koneksiUuid.value) koneksiUuid.value = (koneksi.value.find((k: any) => k.bawaan) ?? koneksi.value[0])?.uuid ?? "";
};

const muat = async () => {
  if (!koneksiUuid.value) return;
  storeUtils.setLoading(true);
  try {
    if (tab.value === "pemeriksaan") {
      const res = await daftarPemetaanPemeriksaanLisPa(koneksiUuid.value);
      pemeriksaan.value = siapkanKode(res?.payload ?? []);
    } else if (tab.value === "ref") {
      const res = await daftarPemetaanRefLisPa(koneksiUuid.value);
      const p = res?.payload ?? {};
      ref_.value = { unit: siapkanKode(p.unit), dokter: siapkanKode(p.dokter), penjamin: siapkanKode(p.penjamin) };
    } else {
      const res = await daftarPemetaanHasilLisPa(koneksiUuid.value);
      const peta = new Map((res?.payload ?? []).map((r: any) => [r.fieldSimrs, r.fieldLis]));
      hasil.value = FIELD_HASIL_LIS_PA.map((f) => ({ fieldSimrs: f.kode, label: f.label, pilihan: peta.get(f.kode) ?? "", awal: peta.get(f.kode) ?? "" }));
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
watch([koneksiUuid, tab], muat);
onMounted(async () => {
  await muatKoneksi();
  await muat();
});

const tersaringPemeriksaan = computed(() => {
  const k = cari.value.trim().toLowerCase();
  return pemeriksaan.value.filter((r) => !k || [r.kode, r.nama, r.pilihan].some((v) => String(v ?? "").toLowerCase().includes(k)));
});
const tersaringRef = computed(() => {
  const k = cari.value.trim().toLowerCase();
  return ref_.value[tabRef.value].filter((r) => !k || [r.kode, r.nama, r.pilihan].some((v) => String(v ?? "").toLowerCase().includes(k)));
});
const kosongPemeriksaan = computed(() => pemeriksaan.value.filter((r) => !r.pilihan).length);
const kosongRef = (j: JenisRef) => ref_.value[j].filter((r) => !r.pilihan).length;
const berubahRef = (r: any) => (r.pilihan ?? "") !== (r.awal ?? "") || (r.namaPilihan ?? "") !== (r.namaAwal ?? "");
const jumlahBerubah = computed(() => {
  if (tab.value === "pemeriksaan") return pemeriksaan.value.filter((r) => (r.pilihan ?? "") !== (r.awal ?? "")).length;
  if (tab.value === "ref") return [...ref_.value.unit, ...ref_.value.dokter, ...ref_.value.penjamin].filter(berubahRef).length;
  return hasil.value.filter((r) => (r.pilihan ?? "") !== (r.awal ?? "")).length;
});

const simpan = async () => {
  if (!koneksiUuid.value) return;
  storeUtils.setLoading(true);
  try {
    let res;
    if (tab.value === "pemeriksaan") {
      const items = pemeriksaan.value.filter((r) => (r.pilihan ?? "") !== (r.awal ?? "")).map((r) => ({ uuid: r.uuid, kode_lis: r.pilihan?.trim() || null, nama_lis: r.nama }));
      if (!items.length) return toast.add({ severity: "info", summary: "Tidak ada perubahan", life: 2500 });
      res = await simpanPemetaanPemeriksaanLisPa(koneksiUuid.value, items);
    } else if (tab.value === "ref") {
      const items = [...ref_.value.unit, ...ref_.value.dokter, ...ref_.value.penjamin]
        .filter(berubahRef)
        .map((r) => ({ jenis: r.jenis, uuid: r.uuid, kode_lis: r.pilihan?.trim() || null, nama_lis: r.namaPilihan?.trim() || null }));
      if (!items.length) return toast.add({ severity: "info", summary: "Tidak ada perubahan", life: 2500 });
      res = await simpanPemetaanRefLisPa(koneksiUuid.value, items);
    } else {
      const items = hasil.value.filter((r) => (r.pilihan ?? "") !== (r.awal ?? "")).map((r) => ({ field_simrs: r.fieldSimrs, field_lis: r.pilihan?.trim() || null }));
      if (!items.length) return toast.add({ severity: "info", summary: "Tidak ada perubahan", life: 2500 });
      res = await simpanPemetaanHasilLisPa(koneksiUuid.value, items);
    }
    // apiPenunjangPut sudah menampilkan toast sukses/galat otomatis (lihat utils/apiHandler.ts).
    if (!res) return;
    await muat();
  } finally {
    storeUtils.setLoading(false);
  }
};
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden flex flex-col" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Mapping LIS PA</h1>
          <CustomSelect v-model="koneksiUuid" class="toolbar-field" label="Koneksi" :options="koneksi" optionValue="uuid" optionLabel="nama" :showFilter="false" :clearable="false" />
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nama / kode" :maxLength="100" />
          <CustomButton class="toolbar-action" icon="PhFloppyDisk" :label="jumlahBerubah ? `Simpan (${jumlahBerubah})` : 'Simpan'" :disabled="!koneksiUuid" @click="simpan" />
        </PageToolbar>
      </template>
      <template #content>
        <div v-if="!koneksi.length" class="p-3 m-4 text-sm rounded-md bg-[#FEF0C7] text-[#B54708]">
          Belum ada koneksi LIS PA aktif. Atur di Setting › Konfigurasi Integrasi › Konfigurasi LIS PA.
        </div>
        <template v-else>
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
              <span v-if="t.kode === 'pemeriksaan' && kosongPemeriksaan" class="ml-1 text-[10px] opacity-80">({{ kosongPemeriksaan }} belum)</span>
            </button>
          </div>

          <!-- Pemeriksaan -->
          <template v-if="tab === 'pemeriksaan'">
            <div class="px-4 pt-2 pb-2 text-xs text-grey-400">Kode pemeriksaan LIS PA dikirim sebagai <code>pemeriksaan.kode</code> saat kasus divalidasi & dikirim.</div>
            <NoData v-if="!tersaringPemeriksaan.length" />
            <DataTable v-else :value="tersaringPemeriksaan" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 55rem">
              <Column header="Kode PA" field="kode" headerClass="bg-opensimrs-50" class="w-[120px]" />
              <Column header="Pemeriksaan PA" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ r.nama }} <span v-if="r.kategori" class="text-grey-400">· {{ r.kategori }}</span></template>
              </Column>
              <Column header="Kode di LIS PA" headerClass="bg-opensimrs-50" class="w-[220px]">
                <template #body="{ data: r }"><CustomTextfield v-model="r.pilihan" :showLabel="false" placeholder="mis. HIS001" :maxLength="50" /></template>
              </Column>
            </DataTable>
          </template>

          <!-- Unit, Dokter & Penjamin -->
          <template v-else-if="tab === 'ref'">
            <div class="flex flex-wrap items-center gap-2 px-4 pt-1" role="tablist">
              <button
                v-for="t in TAB_REF"
                :key="t.kode"
                type="button"
                role="tab"
                :aria-selected="tabRef === t.kode"
                class="px-2.5 py-1 text-xs rounded-full border"
                :class="tabRef === t.kode ? 'bg-opensimrs-400 text-white border-opensimrs-400' : 'bg-white text-grey-500 border-grey-75'"
                @click="tabRef = t.kode"
              >
                {{ t.label }}
                <span v-if="kosongRef(t.kode)" class="ml-1 text-[10px] opacity-80">({{ kosongRef(t.kode) }} belum)</span>
              </button>
            </div>
            <NoData v-if="!tersaringRef.length" />
            <DataTable v-else :value="tersaringRef" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 55rem">
              <Column header="Kode OpenSIMRS" field="kode" headerClass="bg-opensimrs-50" class="w-[130px]" />
              <Column :header="TAB_REF.find((t) => t.kode === tabRef)?.kolom" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ r.nama }}</template>
              </Column>
              <Column header="Kode di LIS PA" headerClass="bg-opensimrs-50" class="w-[200px]">
                <template #body="{ data: r }"><CustomTextfield v-model="r.pilihan" :showLabel="false" placeholder="mis. 0202" :maxLength="50" /></template>
              </Column>
              <Column header="Nama di LIS PA (opsional)" headerClass="bg-opensimrs-50" class="w-[240px]">
                <template #body="{ data: r }"><CustomTextfield v-model="r.namaPilihan" :showLabel="false" :placeholder="r.nama" :maxLength="200" /></template>
              </Column>
            </DataTable>
          </template>

          <!-- Field Hasil -->
          <template v-else>
            <div class="px-4 pt-2 pb-2 text-xs text-grey-400">
              Nama field pada payload hasil dari LIS PA (dot-path, mis. <code>laporan.diagnosis</code>) yang dipetakan ke field laporan SIMRS. Kosong = memakai nama field SIMRS langsung pada payload.
            </div>
            <DataTable :value="hasil" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 50rem">
              <Column header="Field Laporan SIMRS" field="label" headerClass="bg-opensimrs-50" />
              <Column header="Nama Field di LIS PA" headerClass="bg-opensimrs-50" class="w-[280px]">
                <template #body="{ data: r }"><CustomTextfield v-model="r.pilihan" :showLabel="false" :placeholder="r.fieldSimrs" :maxLength="100" /></template>
              </Column>
            </DataTable>
          </template>
        </template>
      </template>
    </Card>
  </div>
</template>
