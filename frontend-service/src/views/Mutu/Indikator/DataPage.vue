<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  STATUS_DATA_INDIKATOR,
  ajukanDataIndikator,
  bukaDataIndikator,
  bulanIni,
  capaianTeks,
  daftarDataIndikator,
  daftarIndikator,
  detailDataIndikator,
  epochTanggal,
  gayaStatusData,
  hapusDataIndikator,
  hitungCapaianIndikator,
  hitungOtomatisIndikator,
  izinIndikator,
  opsi,
  opsiBulan,
  referensiIndikator,
  simpanDataIndikator,
  tanggalDariEpoch,
  tanggalMutu,
  validasiDataIndikator,
} from "@/stores/penunjang/mutu";

// Pengumpulan & validasi data Indikator Mutu (STD-0025): input numerator/denominator per tanggal & unit (indikator
// bulanan disimpan pada tanggal 1 bulan itu), hitung otomatis untuk indikator bersumber data SIMRS (hasil masuk draf
// untuk ditinjau), ajukan → validasi oleh orang lain (setujui / kembalikan dengan catatan), dan buka kembali data
// tervalidasi dengan alasan. Hanya data tervalidasi yang dihitung sebagai capaian resmi.
const storeUtils = utilsStore();
const route = useRoute();
const boleh = izinIndikator;
const MULAI_TANPA_FILTER = "";

const indikator = ref<any[]>([]);
const unit = ref<any[]>([]);
const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const filterBulan = ref(bulanIni());
const filterIndikator = ref(MULAI_TANPA_FILTER);
const filterUnit = ref("");
const filterStatus = ref("");
const OPSI_BULAN = opsiBulan(24);
const OPSI_STATUS = opsi(STATUS_DATA_INDIKATOR);
const opsiIndikator = computed(() => indikator.value.map((i: any) => ({ value: i.uuid, label: `${i.kode} — ${i.judul}` })));
const opsiIndikatorAktif = computed(() => indikator.value.filter((i: any) => i.aktif).map((i: any) => ({ value: i.uuid, label: `${i.kode} — ${i.judul}` })));
const opsiUnit = computed(() => unit.value.map((u: any) => ({ value: u.uuid, label: u.nama })));
const opsiFilterUnit = computed(() => [{ value: "-", label: "Tingkat faskes" }, ...opsiUnit.value]);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarDataIndikator({
      page: page.value,
      limit: limit.value,
      bulan: filterBulan.value,
      indikatorUuid: filterIndikator.value,
      unitUuid: filterUnit.value,
      status: filterStatus.value,
    });
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

// ── Form input / ubah
const dialogForm = ref(false);
const form = ref<any>({});
const galat = ref("");
const pratinjauOtomatis = ref<any>(null);
const indikatorForm = computed(() => indikator.value.find((i: any) => i.uuid === form.value.indikatorUuid));
const capaianForm = computed(() => hitungCapaianIndikator(form.value.numerator, form.value.denominator, indikatorForm.value?.satuan));
const bukaForm = (d?: any) => {
  galat.value = "";
  pratinjauOtomatis.value = null;
  form.value = d
    ? { uuid: d.uuid, indikatorUuid: d.indikatorUuid, unitUuid: d.unitUuid ?? "", tanggal: tanggalDariEpoch(d.tanggal), numerator: String(Number(d.numerator)), denominator: String(Number(d.denominator)), catatan: d.catatan ?? "", ajukan: false }
    : { indikatorUuid: filterIndikator.value || "", unitUuid: filterUnit.value && filterUnit.value !== "-" ? filterUnit.value : "", tanggal: new Date(), numerator: "", denominator: "", catatan: "", ajukan: false };
  dialogForm.value = true;
};
const simpan = async () => {
  const f = form.value;
  galat.value = "";
  if (!f.indikatorUuid || !f.tanggal) return (galat.value = "Indikator dan tanggal wajib diisi");
  if (String(f.numerator).trim() === "" || String(f.denominator).trim() === "") return (galat.value = "Numerator dan denominator wajib diisi");
  storeUtils.setLoading(true);
  try {
    const isi: Record<string, any> = { numerator: String(f.numerator).replace(",", "."), denominator: String(f.denominator).replace(",", "."), catatan: f.catatan.trim() };
    const res = f.uuid
      ? await simpanDataIndikator(isi, f.uuid)
      : await simpanDataIndikator({ ...isi, indikatorUuid: f.indikatorUuid, unitUuid: f.unitUuid || null, tanggal: epochTanggal(f.tanggal), ajukan: f.ajukan });
    if (res) {
      dialogForm.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const hitungOtomatis = async (simpanHasil: boolean) => {
  const f = form.value;
  galat.value = "";
  if (!f.indikatorUuid || !f.tanggal) return (galat.value = "Indikator dan tanggal wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await hitungOtomatisIndikator({ indikatorUuid: f.indikatorUuid, unitUuid: f.unitUuid || null, tanggal: epochTanggal(f.tanggal), simpan: simpanHasil });
    if (!res?.payload) return;
    if (simpanHasil) {
      dialogForm.value = false;
      muat();
      return;
    }
    pratinjauOtomatis.value = res.payload;
    form.value.numerator = String(res.payload.numerator);
    form.value.denominator = String(res.payload.denominator);
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Detail & alur validasi
const dialogDetail = ref(false);
const detail = ref<any>(null);
const aksi = ref("");
const catatanAksi = ref("");
const galatAksi = ref("");
const bukaDetail = async (uuid: string) => {
  storeUtils.setLoading(true);
  try {
    const res = await detailDataIndikator(uuid);
    if (res?.payload) {
      detail.value = res.payload;
      aksi.value = "";
      catatanAksi.value = "";
      galatAksi.value = "";
      dialogDetail.value = true;
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const segarkan = async () => {
  if (detail.value) await bukaDetail(detail.value.uuid);
  muat();
};
const ajukan = async () => {
  if (await ajukanDataIndikator(detail.value.uuid)) segarkan();
};
const jalankanAksi = async () => {
  const catatan = catatanAksi.value.trim();
  galatAksi.value = "";
  if ((aksi.value === "kembalikan" || aksi.value === "buka") && !catatan) return (galatAksi.value = aksi.value === "buka" ? "Alasan membuka kembali wajib diisi" : "Catatan pengembalian wajib diisi");
  const res =
    aksi.value === "buka"
      ? await bukaDataIndikator(detail.value.uuid, catatan)
      : await validasiDataIndikator(detail.value.uuid, aksi.value === "setujui" ? "setujui" : "kembalikan", catatan || undefined);
  if (res) segarkan();
};
const hapus = async () => {
  if (!confirm("Hapus data indikator ini?")) return;
  if (await hapusDataIndikator(detail.value.uuid)) {
    dialogDetail.value = false;
    muat();
  }
};
const dapatDiubah = computed(() => ["draf", "dikembalikan"].includes(detail.value?.status));
const LABEL_AKSI: Record<string, string> = {
  buat: "Diinput",
  buat_ajukan: "Diinput & diajukan",
  hitung_otomatis: "Dihitung otomatis",
  hitung_ulang_otomatis: "Dihitung ulang otomatis",
  ubah: "Diubah",
  ajukan: "Diajukan",
  validasi: "Divalidasi",
  kembalikan: "Dikembalikan",
  buka_kembali: "Dibuka kembali",
  hapus: "Dihapus",
};
const ringkasAudit = (a: any) => {
  const s = a.dataSesudah;
  if (!s) return "";
  const teks = `${Number(s.numerator)}/${Number(s.denominator)}`;
  return ["kembalikan", "buka_kembali"].includes(a.aksi) && s.catatanValidasi ? `${teks} — ${s.catatanValidasi}` : teks;
};

onMounted(async () => {
  const [r, i] = await Promise.all([referensiIndikator(), daftarIndikator({ limit: 500 })]);
  unit.value = r?.payload?.unit ?? [];
  indikator.value = i?.payload?.data ?? [];
  if (route.query.indikator) filterIndikator.value = String(route.query.indikator);
  if (route.query.bulan) filterBulan.value = String(route.query.bulan);
  if (route.query.status) filterStatus.value = String(route.query.status);
  muat();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Pengumpulan Data Indikator</h1>
          <CustomSelect v-model="filterBulan" label="Bulan" placeHolder="Semua" :options="OPSI_BULAN" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomSelect v-model="filterIndikator" label="Indikator" placeHolder="Semua" :options="opsiIndikator" optionValue="value" optionLabel="label" @update:modelValue="cariData" />
          <CustomSelect v-model="filterUnit" label="Unit" placeHolder="Semua" :options="opsiFilterUnit" optionValue="value" optionLabel="label" @update:modelValue="cariData" />
          <CustomSelect v-model="filterStatus" label="Status" placeHolder="Semua" :options="OPSI_STATUS" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomButton v-if="boleh('INPUT DATA')" icon="PhPlus" label="Input Data" @click="bukaForm()" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs cursor-pointer" scrollable scrollHeight="flex" tableStyle="min-width: 64rem" @rowClick="bukaDetail($event.data.uuid)">
          <Column header="Tanggal" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.frekuensi === "bulanan" ? new Date(d.tanggal * 1000).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" }) : tanggalMutu(d.tanggal) }}</template>
          </Column>
          <Column header="Indikator" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.indikatorKode }}</div>
              <div>{{ d.indikatorJudul }}</div>
            </template>
          </Column>
          <Column header="Unit" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.unitNama || "Tingkat faskes" }}</template></Column>
          <Column header="Num / Den" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ Number(d.numerator) }} / {{ Number(d.denominator) }}</template></Column>
          <Column header="Capaian" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ capaianTeks(d.capaian, d.satuan) }}</template></Column>
          <Column header="Sumber" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.sumber === "otomatis" ? "Otomatis" : "Manual" }}</template></Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaStatusData(d.status).bg, gayaStatusData(d.status).text]">{{ gayaStatusData(d.status).label }}</span>
            </template>
          </Column>
          <Column header="Pengisi / Validator" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.diisiOleh || "-" }}<div class="text-grey-400">{{ d.divalidasiOleh || "" }}</div></template></Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialogForm" width="760px">
      <template #header>{{ form.uuid ? "Ubah Data Indikator" : "Input Data Indikator" }}</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomSelect v-model="form.indikatorUuid" label="Indikator" class="col-span-2" :options="opsiIndikatorAktif" optionValue="value" optionLabel="label" :clearable="false" required :disabled="!!form.uuid" />
          <CustomSelect v-model="form.unitUuid" label="Unit" placeHolder="Tingkat faskes" :options="opsiUnit" optionValue="value" optionLabel="label" :disabled="!!form.uuid" />
          <CustomDatePicker v-model="form.tanggal" :label="indikatorForm?.frekuensi === 'bulanan' ? 'Bulan (tanggal mana pun pada bulan itu)' : 'Tanggal'" :maxDate="new Date()" required :disabled="!!form.uuid" />
          <div v-if="indikatorForm" class="col-span-2 p-2 text-xs rounded-lg bg-opensimrs-50">
            <div><span class="text-grey-400">Numerator:</span> {{ indikatorForm.definisiNumerator }}</div>
            <div><span class="text-grey-400">Denominator:</span> {{ indikatorForm.definisiDenominator }}</div>
          </div>
          <CustomTextfield v-model="form.numerator" label="Numerator" required />
          <CustomTextfield v-model="form.denominator" label="Denominator" required />
          <div class="col-span-2 text-sm">
            Capaian: <span class="font-semibold">{{ capaianTeks(capaianForm, indikatorForm?.satuan) }}</span>
            <span v-if="capaianForm === null && String(form.denominator).trim() !== ''" class="text-xs text-grey-400"> (denominator 0 — capaian tidak dihitung)</span>
          </div>
          <CustomTextArea v-model="form.catatan" label="Catatan" class="col-span-2" />
          <div v-if="!form.uuid && indikatorForm?.sumberData === 'otomatis'" class="col-span-2 p-2 text-xs border rounded-lg border-opensimrs-100">
            <div class="flex flex-wrap items-center gap-2">
              <span class="grow">Indikator ini dapat dihitung dari data SIMRS. Hasil masuk sebagai draf untuk ditinjau.</span>
              <CustomButton label="Pratinjau Hitung" icon="PhCalculator" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="hitungOtomatis(false)" />
              <CustomButton label="Hitung & Simpan Draf" icon="PhFloppyDisk" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="hitungOtomatis(true)" />
            </div>
            <div v-if="pratinjauOtomatis" class="mt-1 text-grey-400">
              {{ pratinjauOtomatis.rincianOtomatis?.jumlahKunjungan ?? 0 }} kunjungan, {{ pratinjauOtomatis.rincianOtomatis?.tidakLengkap ?? 0 }} tanpa cap waktu lengkap (tidak dihitung) · sumber:
              {{ pratinjauOtomatis.rincianOtomatis?.sumber }}
            </div>
          </div>
          <label v-if="!form.uuid" class="flex items-center gap-2 text-xs col-span-2"><Checkbox v-model="form.ajukan" binary /> Langsung ajukan untuk validasi</label>
        </div>
        <div v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogForm = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpan" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogDetail" width="820px">
      <template #header>{{ detail?.indikator?.kode }} — {{ detail?.indikator?.judul }}</template>
      <template #body>
        <div v-if="detail" class="flex flex-col gap-4 pt-4 text-sm">
          <div class="grid grid-cols-2 gap-x-6 gap-y-1">
            <div><span class="text-grey-400">Tanggal:</span> {{ tanggalMutu(detail.tanggal) }} ({{ detail.periodeBulan }})</div>
            <div>
              <span class="text-grey-400">Status:</span>
              <span class="px-2 py-0.5 ml-1 rounded-full text-xs font-semibold" :class="[gayaStatusData(detail.status).bg, gayaStatusData(detail.status).text]">{{ gayaStatusData(detail.status).label }}</span>
            </div>
            <div><span class="text-grey-400">Numerator / Denominator:</span> {{ Number(detail.numerator) }} / {{ Number(detail.denominator) }}</div>
            <div><span class="text-grey-400">Capaian:</span> {{ capaianTeks(detail.capaian, detail.indikator?.satuan) }}</div>
            <div><span class="text-grey-400">Sumber:</span> {{ detail.sumber === "otomatis" ? "Otomatis (data SIMRS)" : "Manual" }}</div>
            <div><span class="text-grey-400">Pengisi:</span> {{ detail.diisiOleh || "-" }}</div>
            <div><span class="text-grey-400">Diajukan:</span> {{ detail.diajukanOleh ? `${detail.diajukanOleh}, ${tanggalMutu(detail.diajukanPada)}` : "-" }}</div>
            <div><span class="text-grey-400">Validasi:</span> {{ detail.divalidasiOleh ? `${detail.divalidasiOleh}, ${tanggalMutu(detail.divalidasiPada)}` : "-" }}</div>
            <div v-if="detail.catatan" class="col-span-2"><span class="text-grey-400">Catatan:</span> {{ detail.catatan }}</div>
            <div v-if="detail.catatanValidasi" class="col-span-2"><span class="text-grey-400">Catatan validasi:</span> {{ detail.catatanValidasi }}</div>
            <div v-if="detail.rincianOtomatis" class="col-span-2 text-xs text-grey-400">
              Hitung otomatis: {{ detail.rincianOtomatis.sumber }} · {{ detail.rincianOtomatis.jumlahKunjungan }} kunjungan, {{ detail.rincianOtomatis.tidakLengkap }} tidak lengkap
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <CustomButton v-if="boleh('INPUT DATA') && dapatDiubah" label="Ubah" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogDetail = false; bukaForm(detail)" />
            <CustomButton v-if="boleh('INPUT DATA') && dapatDiubah" label="Ajukan Validasi" icon="PhPaperPlaneTilt" size="small" @click="ajukan" />
            <CustomButton v-if="boleh('VALIDASI') && detail.status === 'diajukan'" label="Setujui" icon="PhCheck" size="small" outlined borderColor="border-success-300" textColor="text-success-300" @click="aksi = 'setujui'" />
            <CustomButton v-if="boleh('VALIDASI') && detail.status === 'diajukan'" label="Kembalikan" icon="PhArrowUUpLeft" size="small" outlined borderColor="border-warning-300" textColor="text-warning-300" @click="aksi = 'kembalikan'" />
            <CustomButton v-if="boleh('VALIDASI') && detail.status === 'tervalidasi'" label="Buka Kembali" icon="PhLockOpen" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="aksi = 'buka'" />
            <CustomButton v-if="boleh('INPUT DATA') && dapatDiubah" label="Hapus" icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="hapus" />
          </div>

          <div v-if="aksi" class="p-3 border rounded-lg border-opensimrs-100 bg-opensimrs-50">
            <div class="mb-2 font-semibold">{{ aksi === "setujui" ? "Setujui data (validasi)" : aksi === "kembalikan" ? "Kembalikan ke pengumpul" : "Buka kembali data tervalidasi" }}</div>
            <CustomTextArea v-model="catatanAksi" :label="aksi === 'setujui' ? 'Catatan (opsional)' : aksi === 'buka' ? 'Alasan (wajib)' : 'Catatan perbaikan (wajib)'" />
            <div class="mt-1 text-[11px] text-grey-400">Validator tidak boleh orang yang mengisi atau mengajukan data ini.</div>
            <div class="flex justify-end gap-2 mt-2">
              <CustomButton label="Batal" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="aksi = ''" />
              <CustomButton label="Simpan" size="small" @click="jalankanAksi" />
            </div>
            <div v-if="galatAksi" class="mt-2 text-sm text-danger-300">{{ galatAksi }}</div>
          </div>

          <div>
            <h3 class="mb-1 font-semibold">Jejak Audit</h3>
            <div v-for="a in detail.audit" :key="a.uuid" class="py-0.5 text-xs border-b border-grey-100">
              <span class="text-grey-400">{{ new Date(a.createdAt * 1000).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) }}</span> · {{ a.aktor }} · {{ LABEL_AKSI[a.aksi] ?? a.aksi }}
              <span class="text-grey-400">{{ ringkasAudit(a) }}</span>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogDetail = false" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
