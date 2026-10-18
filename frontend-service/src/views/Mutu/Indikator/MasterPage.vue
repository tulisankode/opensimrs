<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { JENIS_INDIKATOR, daftarIndikator, detailIndikator, hapusIndikator, izinIndikator, opsi, pasangInm, referensiIndikator, simpanIndikator, targetTeks } from "@/stores/penunjang/mutu";

// Master Indikator Mutu (STD-0025): profil INM/IMP-RS/IMPU milik faskes — definisi operasional, numerator/denominator,
// target & arah, frekuensi, unit penanggung jawab, dan sumber data. Set INM bawaan dipasang dari daftar acuan regulasi
// dan WAJIB ditinjau/disahkan Komite Mutu sebelum dipakai; setiap profil tetap dapat diubah faskes. Indikator yang sudah
// memiliki data tidak dapat dihapus (nonaktifkan saja).
const storeUtils = utilsStore();
const boleh = izinIndikator;

const ref_ = ref<any>({ jenis: [], satuan: [], arah: [], sumberTarget: [], frekuensi: [], sumberData: [], kodeOtomatis: [], unit: [], inmBawaan: [] });
const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");
const filterJenis = ref("");
const filterAktif = ref("true");
const OPSI_JENIS = opsi(JENIS_INDIKATOR);
const OPSI_AKTIF = [
  { value: "true", label: "Aktif" },
  { value: "false", label: "Nonaktif" },
];
const opsiRef = (daftar: any[]) => (daftar ?? []).map((x: any) => ({ value: x.kode, label: x.nama }));
const opsiUnit = computed(() => (ref_.value.unit ?? []).map((u: any) => ({ value: u.uuid, label: u.nama })));

const muatReferensi = async () => {
  const r = await referensiIndikator();
  if (r?.payload) ref_.value = r.payload;
};
const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarIndikator({ page: page.value, limit: limit.value, cari: cari.value.trim(), jenis: filterJenis.value, aktif: filterAktif.value });
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

// ── Form tambah / ubah
const dialogForm = ref(false);
const form = ref<any>({});
const audit = ref<any[]>([]);
const galat = ref("");
const kosong = () => ({
  kode: "",
  judul: "",
  jenis: "imp_rs",
  dimensiMutu: "",
  definisiOperasional: "",
  definisiNumerator: "",
  definisiDenominator: "",
  kriteriaInklusi: "",
  kriteriaEksklusi: "",
  satuan: "persen",
  targetNilai: "",
  arah: "naik",
  targetSumber: "faskes",
  regulasiAcuan: "",
  frekuensi: "bulanan",
  unitPjUuid: "",
  sumberData: "manual",
  kodeOtomatis: "",
  ambangMenit: "60",
  numeratorMaksDenominator: true,
  aktif: true,
});
const bukaForm = async (uuid?: string) => {
  galat.value = "";
  audit.value = [];
  if (!uuid) {
    form.value = kosong();
    dialogForm.value = true;
    return;
  }
  storeUtils.setLoading(true);
  try {
    const res = await detailIndikator(uuid);
    const d = res?.payload;
    if (!d) return;
    form.value = {
      ...kosong(),
      ...d,
      dimensiMutu: d.dimensiMutu ?? "",
      kriteriaInklusi: d.kriteriaInklusi ?? "",
      kriteriaEksklusi: d.kriteriaEksklusi ?? "",
      targetNilai: d.targetNilai === null || d.targetNilai === undefined ? "" : String(Number(d.targetNilai)),
      targetSumber: d.targetSumber ?? "faskes",
      regulasiAcuan: d.regulasiAcuan ?? "",
      unitPjUuid: d.unitPjUuid ?? "",
      kodeOtomatis: d.kodeOtomatis ?? "",
      ambangMenit: String(d.parameterOtomatis?.ambangMenit ?? 60),
    };
    audit.value = d.audit ?? [];
    dialogForm.value = true;
  } finally {
    storeUtils.setLoading(false);
  }
};
const bolehSimpan = computed(() => (form.value.uuid ? boleh("UPDATE") : boleh("CREATE")));
const simpan = async () => {
  const f = form.value;
  galat.value = "";
  for (const [k, nama] of [
    ["kode", "Kode"],
    ["judul", "Judul"],
    ["definisiOperasional", "Definisi operasional"],
    ["definisiNumerator", "Numerator"],
    ["definisiDenominator", "Denominator"],
  ]) {
    if (!String(f[k] ?? "").trim()) return (galat.value = `${nama} wajib diisi`);
  }
  const target = String(f.targetNilai ?? "").trim().replace(",", ".");
  if (target && !Number.isFinite(Number(target))) return (galat.value = "Target harus berupa angka");
  if (target && f.targetSumber === "regulasi" && !f.regulasiAcuan.trim()) return (galat.value = "Regulasi acuan wajib diisi untuk target dari regulasi");
  if (f.sumberData === "otomatis" && !f.kodeOtomatis) return (galat.value = "Pilih sumber otomatis");
  storeUtils.setLoading(true);
  try {
    const isi = {
      kode: f.kode.trim(),
      judul: f.judul.trim(),
      jenis: f.jenis,
      dimensiMutu: f.dimensiMutu.trim(),
      definisiOperasional: f.definisiOperasional.trim(),
      definisiNumerator: f.definisiNumerator.trim(),
      definisiDenominator: f.definisiDenominator.trim(),
      kriteriaInklusi: f.kriteriaInklusi.trim(),
      kriteriaEksklusi: f.kriteriaEksklusi.trim(),
      satuan: f.satuan,
      targetNilai: target === "" ? null : Number(target),
      arah: f.arah,
      targetSumber: target === "" ? null : f.targetSumber,
      regulasiAcuan: f.regulasiAcuan.trim(),
      frekuensi: f.frekuensi,
      unitPjUuid: f.unitPjUuid || null,
      sumberData: f.sumberData,
      kodeOtomatis: f.sumberData === "otomatis" ? f.kodeOtomatis : null,
      parameterOtomatis: f.sumberData === "otomatis" ? { ambangMenit: Number(f.ambangMenit) || 60 } : null,
      numeratorMaksDenominator: !!f.numeratorMaksDenominator,
      aktif: !!f.aktif,
    };
    if (await simpanIndikator(isi, f.uuid)) {
      dialogForm.value = false;
      muat();
      muatReferensi();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const hapus = async () => {
  if (!confirm(`Hapus indikator ${form.value.kode}? Indikator yang sudah memiliki data hanya dapat dinonaktifkan.`)) return;
  if (await hapusIndikator(form.value.uuid)) {
    dialogForm.value = false;
    muat();
    muatReferensi();
  }
};
const LABEL_AKSI: Record<string, string> = { buat: "Dibuat", pasang_inm: "Dipasang dari INM bawaan", ubah: "Diubah", hapus: "Dihapus" };

// ── Pasang INM bawaan
const dialogInm = ref(false);
const pilihInm = ref<string[]>([]);
const bukaInm = async () => {
  await muatReferensi();
  pilihInm.value = (ref_.value.inmBawaan ?? []).filter((i: any) => !i.terpasang).map((i: any) => i.kodeBawaan);
  dialogInm.value = true;
};
const simpanInm = async () => {
  if (!pilihInm.value.length) return;
  storeUtils.setLoading(true);
  try {
    if (await pasangInm(pilihInm.value)) {
      dialogInm.value = false;
      muat();
      muatReferensi();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(async () => {
  await muatReferensi();
  muat();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Master Indikator Mutu</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Kode / judul" :maxLength="100" @keydown.enter="cariData" />
          <CustomSelect v-model="filterJenis" label="Jenis" placeHolder="Semua" :options="OPSI_JENIS" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomSelect v-model="filterAktif" label="Status" placeHolder="Semua" :options="OPSI_AKTIF" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton v-if="boleh('CREATE')" icon="PhListPlus" label="Pasang INM Bawaan" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaInm" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Tambah Indikator" @click="bukaForm()" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs cursor-pointer" scrollable scrollHeight="flex" tableStyle="min-width: 60rem" @rowClick="bukaForm($event.data.uuid)">
          <Column header="Indikator" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.kode }} <span v-if="d.kodeBawaan" class="font-normal text-grey-400">(INM bawaan)</span></div>
              <div>{{ d.judul }}</div>
            </template>
          </Column>
          <Column header="Jenis" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ JENIS_INDIKATOR[d.jenis] ?? d.jenis }}</template></Column>
          <Column header="Target" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              {{ targetTeks(d.targetNilai, d.arah, d.satuan) }}
              <div v-if="d.targetSumber" class="text-[10px] text-grey-400">{{ d.targetSumber === "regulasi" ? "Regulasi" : "Keputusan faskes" }}</div>
            </template>
          </Column>
          <Column header="Frekuensi" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.frekuensi === "harian" ? "Harian" : "Bulanan" }}</template></Column>
          <Column header="Sumber Data" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.sumberData === "otomatis" ? "Otomatis" : "Manual" }}</template></Column>
          <Column field="unitPjNama" header="Unit PJ" headerClass="bg-opensimrs-50" />
          <Column header="Data" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.jumlahData }}</template></Column>
          <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.aktif ? "Aktif" : "Nonaktif" }}</template></Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialogForm" width="900px">
      <template #header>{{ form.uuid ? `Indikator ${form.kode}` : "Tambah Indikator" }}</template>
      <template #body>
        <div class="grid grid-cols-3 gap-4 pt-4">
          <CustomTextfield v-model="form.kode" label="Kode" :maxLength="50" required :disabled="!bolehSimpan" />
          <CustomTextfield v-model="form.judul" label="Judul" class="col-span-2" :maxLength="255" required :disabled="!bolehSimpan" />
          <CustomSelect v-model="form.jenis" label="Jenis" :options="opsiRef(ref_.jenis)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" required :disabled="!bolehSimpan" />
          <CustomTextfield v-model="form.dimensiMutu" label="Dimensi Mutu" :maxLength="100" :disabled="!bolehSimpan" />
          <CustomSelect v-model="form.unitPjUuid" label="Unit Penanggung Jawab" placeHolder="Tingkat faskes" :options="opsiUnit" optionValue="value" optionLabel="label" :disabled="!bolehSimpan" />
          <CustomTextArea v-model="form.definisiOperasional" label="Definisi Operasional" class="col-span-3" required :disabled="!bolehSimpan" />
          <CustomTextArea v-model="form.definisiNumerator" label="Numerator" class="col-span-3 md:col-span-1" required :disabled="!bolehSimpan" />
          <CustomTextArea v-model="form.definisiDenominator" label="Denominator" class="col-span-3 md:col-span-1" required :disabled="!bolehSimpan" />
          <div class="flex flex-col gap-2 col-span-3 md:col-span-1">
            <CustomTextArea v-model="form.kriteriaInklusi" label="Kriteria Inklusi" :disabled="!bolehSimpan" />
            <CustomTextArea v-model="form.kriteriaEksklusi" label="Kriteria Eksklusi" :disabled="!bolehSimpan" />
          </div>
          <CustomSelect v-model="form.satuan" label="Satuan Capaian" :options="opsiRef(ref_.satuan)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" :disabled="!bolehSimpan" />
          <CustomTextfield v-model="form.targetNilai" label="Target (kosong = belum ditetapkan)" :disabled="!bolehSimpan" />
          <CustomSelect v-model="form.arah" label="Arah Target" :options="opsiRef(ref_.arah)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" :disabled="!bolehSimpan" />
          <CustomSelect v-model="form.targetSumber" label="Sumber Target" :options="opsiRef(ref_.sumberTarget)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" :disabled="!bolehSimpan" />
          <CustomTextfield v-model="form.regulasiAcuan" label="Regulasi Acuan" class="col-span-2" :maxLength="255" :disabled="!bolehSimpan" />
          <CustomSelect v-model="form.frekuensi" label="Frekuensi Pengumpulan" :options="opsiRef(ref_.frekuensi)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" :disabled="!bolehSimpan" />
          <CustomSelect v-model="form.sumberData" label="Sumber Data" :options="opsiRef(ref_.sumberData)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" :disabled="!bolehSimpan" />
          <template v-if="form.sumberData === 'otomatis'">
            <CustomSelect v-model="form.kodeOtomatis" label="Sumber Otomatis" :options="opsiRef(ref_.kodeOtomatis)" optionValue="value" optionLabel="label" :showFilter="false" :disabled="!bolehSimpan" />
            <CustomTextfield v-if="form.kodeOtomatis === 'waktu_tunggu_rj'" v-model="form.ambangMenit" label="Ambang Waktu Tunggu (menit)" :disabled="!bolehSimpan" />
            <div class="col-span-3 text-[11px] text-grey-400">
              {{ (ref_.kodeOtomatis ?? []).find((k: any) => k.kode === form.kodeOtomatis)?.sumber }} — hasil hitung disimpan sebagai draf dan tetap ditinjau pengumpul sebelum diajukan.
            </div>
          </template>
          <label class="flex items-center gap-2 text-xs col-span-3 md:col-span-1"><Checkbox v-model="form.numeratorMaksDenominator" binary :disabled="!bolehSimpan" /> Numerator tidak boleh melebihi denominator</label>
          <label class="flex items-center gap-2 text-xs"><Checkbox v-model="form.aktif" binary :disabled="!bolehSimpan" /> Aktif</label>
        </div>
        <div v-if="form.kodeBawaan" class="p-2 mt-3 text-xs border rounded-lg border-warning-300 text-warning-300">
          Indikator ini dipasang dari set INM bawaan ({{ form.kodeBawaan }}). Pastikan definisi dan target telah ditinjau serta disahkan Komite Mutu terhadap naskah regulasi resmi yang berlaku.
        </div>
        <div v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</div>
        <div v-if="audit.length" class="mt-4">
          <h3 class="mb-1 text-sm font-semibold">Jejak Audit</h3>
          <div v-for="a in audit" :key="a.uuid" class="py-0.5 text-xs border-b border-grey-100">
            <span class="text-grey-400">{{ new Date(a.createdAt * 1000).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) }}</span> · {{ a.aktor }} · {{ LABEL_AKSI[a.aksi] ?? a.aksi }}
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-between gap-2">
          <CustomButton v-if="form.uuid && boleh('DELETE')" label="Hapus" icon="PhTrash" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="hapus" />
          <span v-else></span>
          <div class="flex gap-2">
            <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogForm = false" />
            <CustomButton v-if="bolehSimpan" label="Simpan" icon="PhFloppyDisk" @click="simpan" />
          </div>
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogInm" width="760px">
      <template #header>Pasang Set INM Bawaan</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4 text-sm">
          <div class="p-2 text-xs border rounded-lg border-warning-300 text-warning-300">
            Acuan: {{ ref_.regulasiInm }}. Definisi dan target bawaan wajib ditinjau serta disahkan Komite Mutu terhadap naskah regulasi resmi yang berlaku sebelum dipakai; setiap indikator dapat diubah setelah dipasang.
          </div>
          <div v-for="i in ref_.inmBawaan" :key="i.kodeBawaan" class="flex items-center gap-2 py-1 border-b border-grey-100">
            <Checkbox v-model="pilihInm" :value="i.kodeBawaan" :disabled="i.terpasang" />
            <span class="w-16 font-semibold">{{ i.kodeBawaan }}</span>
            <span class="grow">{{ i.judul }}</span>
            <span class="text-xs text-grey-400">{{ targetTeks(i.targetNilai, i.arah, i.satuan) }}</span>
            <span v-if="i.terpasang" class="text-[10px] text-success-300">terpasang</span>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogInm = false" />
          <CustomButton :label="`Pasang ${pilihInm.length} Indikator`" icon="PhDownloadSimple" :disabled="!pilihInm.length" @click="simpanInm" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
