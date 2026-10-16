<script setup lang="ts">
// Satu ekstensi terpasang: laporan (tabel + ekspor Excel + cetak), template cetak (PDF), atau formulir tambahan.
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import * as XLSX from "xlsx-js-style";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { apiEkstensi } from "@/utils/apiHandler";
import { useEkstensiStore } from "@/stores/ekstensi";
import { cetakEkstensi, formatNilai } from "@/utils/pdf/cetakEkstensi";

const route = useRoute();
const store = useEkstensiStore();
const ekstensi = computed(() => store.daftar.find((e) => e.kode === route.params.kode) ?? null);
const definisi = computed(() => ekstensi.value?.definisi ?? {});

// ---------- Laporan & cetak ----------
const parameter = ref<Record<string, any>>({});
const data = ref<any[]>([]);
const total = ref(0);
const halaman = ref(1);
const BATAS = 20;
const memuat = ref(false);
const sudahCari = ref(false);

const tanggalKeEpoch = (v: string) => (v ? Math.floor(new Date(`${v}T00:00:00`).getTime() / 1000) : "");
const nilaiParameter = () =>
  Object.fromEntries((definisi.value.parameter ?? []).map((p: any) => [p.nama, p.tipe === "tanggal" ? tanggalKeEpoch(parameter.value[p.nama]) : parameter.value[p.nama]]));

const jalankan = async (page = 1, limit = BATAS) => {
  memuat.value = true;
  const res = await apiEkstensi("laporan", "post", `/ekstensi/${route.params.kode}/jalankan`, { parameter: nilaiParameter(), page, limit }, true);
  memuat.value = false;
  return res?.payload ?? null;
};
const tampilkan = async (page = 1) => {
  const r = await jalankan(page);
  if (!r) return;
  data.value = r.data;
  total.value = r.total;
  halaman.value = page;
  sudahCari.value = true;
};
const kolom = computed(() => definisi.value.kolom ?? Object.keys(data.value[0] ?? {}).map((f) => ({ field: f, label: f })));

const eksporExcel = async () => {
  const r = await jalankan(1, 10000);
  if (!r) return;
  const faskes = JSON.parse(localStorage.getItem("faskes_profile") ?? "{}");
  const aoa = [
    [ekstensi.value.nama.toUpperCase()],
    [faskes?.name ?? ""],
    [(definisi.value.parameter ?? []).map((p: any) => `${p.label ?? p.nama}: ${parameter.value[p.nama] ?? "-"}`).join(" · ")],
    [],
    ["No", ...kolom.value.map((k: any) => k.label ?? k.field)],
    ...r.data.map((row: any, i: number) => [i + 1, ...kolom.value.map((k: any) => (["angka", "rupiah"].includes(k.format) ? Number(row[k.field] ?? 0) : formatNilai(row[k.field], k.format)))]),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const buku = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(buku, sheet, "Data");
  XLSX.writeFile(buku, `${ekstensi.value.nama}.xlsx`);
};

const cetak = async () => {
  const r = await jalankan(1, ekstensi.value.jenis === "cetak" ? 500 : 5000);
  if (r) await cetakEkstensi(ekstensi.value, r.data);
};

// ---------- Formulir ----------
const kaitan = computed(() => (definisi.value.kaitan === "kunjungan" ? "no_reg" : "patient_uuid"));
const labelKaitan = computed(() => (definisi.value.kaitan === "kunjungan" ? "No. Registrasi kunjungan" : "UUID / No. RM pasien"));
const cari = ref("");
const isianList = ref<any[]>([]);
const form = ref<Record<string, any>>({});
const sunting = ref<string | null>(null);

const muatIsian = async () => {
  if (!cari.value.trim()) return;
  const res = await apiEkstensi("laporan", "get", `/ekstensi/${route.params.kode}/isian?${kaitan.value}=${encodeURIComponent(cari.value.trim())}`);
  isianList.value = res?.payload ?? [];
};
const kosongkan = () => {
  form.value = {};
  sunting.value = null;
};
const ubahIsian = (i: any) => {
  form.value = { ...i.isian };
  sunting.value = i.uuid;
};
const simpanIsian = async () => {
  const isian = Object.fromEntries(
    (definisi.value.field ?? []).map((f: any) => [f.kode, f.tipe === "tanggal" && form.value[f.kode] && !/^\d+$/.test(String(form.value[f.kode])) ? tanggalKeEpoch(form.value[f.kode]) : form.value[f.kode]]),
  );
  const body = { isian, [kaitan.value]: cari.value.trim() };
  const res = sunting.value
    ? await apiEkstensi("laporan", "put", `/ekstensi/${route.params.kode}/isian/${sunting.value}`, body)
    : await apiEkstensi("laporan", "post", `/ekstensi/${route.params.kode}/isian`, body);
  if (res) {
    kosongkan();
    muatIsian();
  }
};
const hapusIsian = async (i: any) => {
  if (await apiEkstensi("laporan", "delete", `/ekstensi/${route.params.kode}/isian/${i.uuid}`)) muatIsian();
};

watch(
  () => route.params.kode,
  () => {
    parameter.value = {};
    data.value = [];
    total.value = 0;
    sudahCari.value = false;
    isianList.value = [];
    cari.value = "";
    kosongkan();
  },
);
</script>

<template>
  <Card v-if="ekstensi" pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full" class="h-full">
    <template #header>
      <PageToolbar>
        <div>
          <h1 class="toolbar-heading text-opensimrs-300">{{ ekstensi.nama }}</h1>
          <div class="text-XS text-grey-400">{{ ekstensi.deskripsi }} <span class="text-grey-300">· ekstensi v{{ ekstensi.versi }}</span></div>
        </div>
      </PageToolbar>
    </template>
    <template #content>
      <!-- Laporan & cetak -->
      <template v-if="ekstensi.jenis !== 'formulir'">
        <div class="flex flex-wrap items-end gap-2">
          <label v-for="p in definisi.parameter ?? []" :key="p.nama" class="flex flex-col gap-1 text-XS text-grey-500">
            <span class="font-semibold">{{ p.label ?? p.nama }}<span v-if="p.wajib" class="text-danger-300">*</span></span>
            <select v-if="p.tipe === 'pilihan'" v-model="parameter[p.nama]" class="rounded border border-grey-200 px-2 py-1.5"><option value="">—</option><option v-for="o in p.pilihan" :key="o" :value="o">{{ o }}</option></select>
            <input v-else v-model="parameter[p.nama]" :type="p.tipe === 'tanggal' ? 'date' : p.tipe === 'angka' ? 'number' : 'text'" class="rounded border border-grey-200 px-2 py-1.5" />
          </label>
          <CustomButton v-if="ekstensi.jenis === 'laporan'" label="Tampilkan" icon="PhMagnifyingGlass" :disabled="memuat" @click="tampilkan(1)" />
          <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" v-if="ekstensi.jenis === 'laporan'" label="Ekspor Excel" icon="PhFileXls" outlined :disabled="memuat" @click="eksporExcel" />
          <CustomButton :label="ekstensi.jenis === 'cetak' ? 'Cetak' : 'Cetak PDF'" icon="PhPrinter" :outlined="ekstensi.jenis === 'laporan'" :disabled="memuat" @click="cetak" />
        </div>
        <div v-if="ekstensi.jenis === 'laporan' && sudahCari" class="mt-3 overflow-auto rounded-lg border border-grey-200">
          <table class="w-full text-SM">
            <thead class="bg-grey-75 text-left text-XS text-grey-500">
              <tr><th class="p-2">No</th><th v-for="k in kolom" :key="k.field" class="p-2" :class="['angka', 'rupiah'].includes(k.format) ? 'text-right' : ''">{{ k.label ?? k.field }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in data" :key="i" class="border-t border-grey-100 text-grey-500">
                <td class="p-2 text-XS">{{ (halaman - 1) * 20 + i + 1 }}</td>
                <td v-for="k in kolom" :key="k.field" class="p-2" :class="['angka', 'rupiah'].includes(k.format) ? 'text-right' : ''">{{ formatNilai(r[k.field], k.format) }}</td>
              </tr>
              <tr v-if="!data.length"><td :colspan="kolom.length + 1" class="p-4 text-center text-XS text-grey-300">Tidak ada data.</td></tr>
            </tbody>
          </table>
          <div class="flex items-center justify-between border-t border-grey-200 px-3 py-2 text-XS text-grey-400">
            <span>{{ total }} baris</span>
            <div class="flex gap-2">
              <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" icon="PhCaretLeft" outlined :disabled="halaman <= 1 || memuat" @click="tampilkan(halaman - 1)" />
              <span class="self-center">Hal. {{ halaman }} / {{ Math.max(Math.ceil(total / 20), 1) }}</span>
              <CustomButton icon="PhCaretRight" outlined :disabled="halaman * 20 >= total || memuat" @click="tampilkan(halaman + 1)" />
            </div>
          </div>
        </div>
      </template>

      <!-- Formulir -->
      <template v-else>
        <div class="flex flex-wrap items-end gap-2">
          <label class="flex flex-col gap-1 text-XS text-grey-500">
            <span class="font-semibold">{{ labelKaitan }}</span>
            <input v-model="cari" class="w-72 rounded border border-grey-200 px-2 py-1.5" @keyup.enter="muatIsian" />
          </label>
          <CustomButton label="Buka" icon="PhMagnifyingGlass" :disabled="!cari.trim()" @click="muatIsian" />
        </div>
        <div v-if="cari.trim()" class="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
          <div class="flex flex-col gap-2 rounded-lg border border-grey-200 p-3">
            <div class="text-SM font-semibold text-grey-500">{{ sunting ? "Ubah isian" : "Isian baru" }}</div>
            <label v-for="f in definisi.field ?? []" :key="f.kode" class="flex flex-col gap-1 text-XS text-grey-500">
              <span class="font-semibold">{{ f.label }}<span v-if="f.wajib" class="text-danger-300">*</span></span>
              <select v-if="f.tipe === 'pilihan'" v-model="form[f.kode]" class="rounded border border-grey-200 px-2 py-1.5"><option value="">—</option><option v-for="o in f.pilihan" :key="o" :value="o">{{ o }}</option></select>
              <textarea v-else-if="f.tipe === 'paragraf'" v-model="form[f.kode]" rows="3" class="rounded border border-grey-200 px-2 py-1.5" />
              <input v-else-if="f.tipe === 'centang'" v-model="form[f.kode]" type="checkbox" class="self-start" />
              <input v-else v-model="form[f.kode]" :type="f.tipe === 'tanggal' ? 'date' : f.tipe === 'angka' ? 'number' : 'text'" class="rounded border border-grey-200 px-2 py-1.5" />
            </label>
            <div class="flex justify-end gap-2">
              <CustomButton text-color="text-opensimrs-300" border-color="border-opensimrs-300" v-if="sunting" label="Batal" outlined @click="kosongkan" />
              <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanIsian" />
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <div v-for="i in isianList" :key="i.uuid" class="rounded-lg border border-grey-200 p-3 text-XS text-grey-500">
              <div class="mb-1 flex items-center justify-between">
                <span class="text-grey-400">{{ new Date(i.created_at * 1000).toLocaleString("id-ID") }} · {{ i.dibuat_oleh }}</span>
                <div class="flex gap-2">
                  <button type="button" aria-label="Ubah isian" @click="ubahIsian(i)"><PhPencilSimple :size="14" class="text-opensimrs-300" aria-hidden="true" /></button>
                  <button type="button" aria-label="Hapus isian" @click="hapusIsian(i)"><PhTrash :size="14" class="text-danger-300" aria-hidden="true" /></button>
                </div>
              </div>
              <div v-for="f in definisi.field ?? []" :key="f.kode"><b>{{ f.label }}:</b> {{ f.tipe === "tanggal" ? formatNilai(i.isian[f.kode], "tanggal") : f.tipe === "centang" ? (i.isian[f.kode] ? "Ya" : "Tidak") : i.isian[f.kode] ?? "-" }}</div>
            </div>
            <div v-if="!isianList.length" class="rounded-lg border border-dashed border-grey-200 p-4 text-center text-XS text-grey-300">Belum ada isian.</div>
          </div>
        </div>
      </template>
    </template>
  </Card>
</template>
