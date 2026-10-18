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
import PilihElemen from "@/views/Mutu/PilihElemen.vue";
import { utilsStore } from "@/stores/utils";
import {
  JENIS_DOKUMEN,
  STATUS_DOKUMEN,
  TRANSISI_DOKUMEN,
  bacaBerkas,
  bagikanSurveior,
  bukaBerkas,
  buatDokumen,
  daftarDokumen,
  detailDokumen,
  epochAkhirHari,
  epochTanggal,
  gayaStatusDokumen,
  hapusDokumen,
  izinMutu,
  opsi,
  petakanElemen,
  referensiMutu,
  revisiDokumen,
  tanggalDariEpoch,
  tanggalMutu,
  tinjauDokumen,
  ubahDokumen,
  ubahStatusDokumen,
  ukuranBerkas,
  unduhBerkasDokumen,
} from "@/stores/penunjang/mutu";

// Dokumen akreditasi (KF-3..7, KF-11): metadata + PDF, pemetaan ke elemen penilaian, status manual
// (draf → disahkan → kedaluwarsa/dicabut), revisi berversi (versi lama tetap utuh dan dapat dibuka), tinjau ulang
// (penanda "perlu ditinjau" tidak mengubah status), dan pembagian baca ke surveior. Dokumen disahkan tidak dapat
// diubah langsung — gunakan revisi.
const storeUtils = utilsStore();
const route = useRoute();
const boleh = (aksi: string) => izinMutu("Dokumen Akreditasi", aksi);

const maksMb = ref(10);
const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");
const filterJenis = ref("");
const filterStatus = ref("");
const perluTinjau = ref(false);
const semuaVersi = ref(false);
const OPSI_JENIS = opsi(JENIS_DOKUMEN);
const OPSI_STATUS = opsi(STATUS_DOKUMEN);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarDokumen({
      page: page.value,
      limit: limit.value,
      cari: cari.value.trim(),
      jenis: filterJenis.value,
      status: filterStatus.value,
      perluTinjau: perluTinjau.value ? 1 : undefined,
      semuaVersi: semuaVersi.value ? 1 : undefined,
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

// ── Form buat / ubah (draf) / revisi
const dialogForm = ref(false);
const mode = ref<"buat" | "ubah" | "revisi">("buat");
const form = ref<any>({});
const berkas = ref<File | null>(null);
const galat = ref("");
const JUDUL_FORM = { buat: "Tambah Dokumen", ubah: "Ubah Dokumen Draf", revisi: "Revisi Dokumen" };
const bukaForm = (m: "buat" | "ubah" | "revisi", d?: any) => {
  mode.value = m;
  galat.value = "";
  berkas.value = null;
  form.value = d
    ? {
        uuid: d.uuid,
        jenis: d.jenis,
        nomor: d.nomor,
        judul: d.judul,
        unitPemilik: d.unitPemilik ?? "",
        versi: m === "revisi" ? "" : d.versi,
        tanggalTerbit: m === "revisi" ? new Date() : tanggalDariEpoch(d.tanggalTerbit),
        tanggalTinjauUlang: m === "revisi" ? null : tanggalDariEpoch(d.tanggalTinjauUlang),
        elemenUuid: (d.elemen ?? []).map((e: any) => e.uuid),
        versiLama: d.versi,
      }
    : { jenis: "", nomor: "", judul: "", unitPemilik: "", versi: "1", tanggalTerbit: new Date(), tanggalTinjauUlang: null, elemenUuid: [] };
  dialogForm.value = true;
};
const pilihBerkas = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0] ?? null;
  input.value = "";
  galat.value = "";
  if (!f) return;
  if (f.type !== "application/pdf") return (galat.value = "Berkas dokumen harus PDF");
  if (f.size > maksMb.value * 1024 * 1024) return (galat.value = `Ukuran berkas maksimal ${maksMb.value} MB`);
  berkas.value = f;
};
const simpanForm = async () => {
  const f = form.value;
  galat.value = "";
  if (mode.value !== "ubah" && !f.jenis) return (galat.value = "Jenis dokumen wajib dipilih");
  if (mode.value === "buat" && !f.nomor.trim()) return (galat.value = "Nomor dokumen wajib diisi");
  if (!f.judul.trim() || !f.tanggalTerbit) return (galat.value = "Judul dan tanggal terbit wajib diisi");
  if (mode.value !== "ubah" && !berkas.value) return (galat.value = "Berkas PDF wajib diunggah");
  if (f.tanggalTinjauUlang && f.tanggalTinjauUlang < f.tanggalTerbit) return (galat.value = "Tanggal tinjau ulang tidak boleh sebelum tanggal terbit");
  storeUtils.setLoading(true);
  try {
    const isi: Record<string, any> = {
      jenis: f.jenis,
      judul: f.judul.trim(),
      unitPemilik: f.unitPemilik.trim(),
      versi: f.versi.trim() || undefined,
      tanggalTerbit: epochTanggal(f.tanggalTerbit),
      tanggalTinjauUlang: epochTanggal(f.tanggalTinjauUlang) ?? null,
    };
    if (berkas.value) isi.berkas = await bacaBerkas(berkas.value);
    let res;
    if (mode.value === "buat") res = await buatDokumen({ ...isi, nomor: f.nomor.trim(), elemenUuid: f.elemenUuid });
    else if (mode.value === "ubah") res = await ubahDokumen(f.uuid, isi);
    else res = await revisiDokumen(f.uuid, { ...isi, elemenUuid: f.elemenUuid });
    if (res) {
      dialogForm.value = false;
      await muat();
      bukaDetail(res.payload.uuid);
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Detail
const dialogDetail = ref(false);
const detail = ref<any>(null);
const bukaDetail = async (uuid: string) => {
  storeUtils.setLoading(true);
  try {
    const res = await detailDokumen(uuid);
    if (res?.payload) {
      detail.value = res.payload;
      aksi.value = "";
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
const lihatBerkas = async (uuid: string) => bukaBerkas((await unduhBerkasDokumen(uuid))?.payload);
const transisi = computed<string[]>(() => TRANSISI_DOKUMEN[detail.value?.status] ?? []);
const LABEL_AKSI: Record<string, string> = {
  buat: "Dibuat",
  ubah: "Metadata diubah",
  ubah_berkas: "Metadata & berkas diubah",
  revisi: "Revisi dibuat dari versi sebelumnya",
  direvisi: "Direvisi menjadi versi baru",
  ubah_status: "Status diubah",
  tinjau: "Tinjauan dicatat",
  petakan_elemen: "Pemetaan elemen diubah",
  bagikan_surveior: "Pengaturan surveior diubah",
  hapus: "Dihapus",
};
const ringkasAudit = (a: any) => {
  if (a.aksi === "ubah_status") return `${STATUS_DOKUMEN[a.dataSebelum?.status]?.label ?? "-"} → ${STATUS_DOKUMEN[a.dataSesudah?.status]?.label ?? "-"}${a.dataSesudah?.catatan ? ` (${a.dataSesudah.catatan})` : ""}`;
  if (a.aksi === "petakan_elemen") return `${a.dataSebelum?.elemenUuid?.length ?? 0} → ${a.dataSesudah?.elemenUuid?.length ?? 0} elemen`;
  if (a.aksi === "tinjau") return `tinjau ulang berikutnya ${tanggalMutu(a.dataSesudah?.tanggalTinjauUlang)}`;
  if (a.aksi === "bagikan_surveior") return a.dataSesudah?.dibagikanSurveior ? `dibagikan${a.dataSesudah?.dibagikanSampai ? ` s.d. ${tanggalMutu(a.dataSesudah.dibagikanSampai)}` : ""}` : "berbagi dihentikan";
  if (a.aksi === "direvisi") return `versi ${a.dataSesudah?.versi ?? ""}`;
  return "";
};

// Aksi pada dialog detail: status | tinjau | elemen | bagikan
const aksi = ref("");
const formAksi = ref<any>({});
const galatAksi = ref("");
const mulaiAksi = (jenis: string, nilai: Record<string, any> = {}) => {
  aksi.value = jenis;
  galatAksi.value = "";
  formAksi.value = nilai;
};
const simpanStatus = async () => {
  const f = formAksi.value;
  if (f.status === "dicabut" && !f.catatan?.trim()) return (galatAksi.value = "Alasan pencabutan wajib diisi");
  if (await ubahStatusDokumen(detail.value.uuid, f.status, f.catatan?.trim() || undefined)) segarkan();
};
const simpanTinjau = async () => {
  const f = formAksi.value;
  if (!f.tanggal || !f.catatan?.trim()) return (galatAksi.value = "Tanggal tinjau ulang berikutnya dan catatan wajib diisi");
  if (await tinjauDokumen(detail.value.uuid, epochTanggal(f.tanggal)!, f.catatan.trim())) segarkan();
};
const simpanElemen = async () => {
  if (await petakanElemen(detail.value.uuid, formAksi.value.elemenUuid ?? [])) segarkan();
};
const simpanBagikan = async (dibagikan: boolean) => {
  if (await bagikanSurveior(detail.value.uuid, dibagikan, dibagikan ? epochAkhirHari(formAksi.value.sampai) : undefined)) segarkan();
};
const hapus = async () => {
  if (!confirm(`Hapus dokumen draf ${detail.value.nomor} versi ${detail.value.versi}?`)) return;
  if (await hapusDokumen(detail.value.uuid)) {
    dialogDetail.value = false;
    muat();
  }
};
const besok = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d;
};

onMounted(async () => {
  const r = await referensiMutu();
  if (r?.payload?.berkas?.maksMb) maksMb.value = r.payload.berkas.maksMb;
  await muat();
  if (route.query.buka) bukaDetail(String(route.query.buka));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Dokumen Akreditasi</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nomor / judul / unit" :maxLength="100" @keydown.enter="cariData" />
          <CustomSelect v-model="filterJenis" label="Jenis" placeHolder="Semua" :options="OPSI_JENIS" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomSelect v-model="filterStatus" label="Status" placeHolder="Semua" :options="OPSI_STATUS" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <label class="flex items-center gap-1 text-xs whitespace-nowrap"><Checkbox v-model="perluTinjau" binary @update:modelValue="cariData" /> Perlu ditinjau</label>
          <label class="flex items-center gap-1 text-xs whitespace-nowrap"><Checkbox v-model="semuaVersi" binary @update:modelValue="cariData" /> Semua versi</label>
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Tambah Dokumen" @click="bukaForm('buat')" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs cursor-pointer" scrollable scrollHeight="flex" tableStyle="min-width: 64rem" @rowClick="bukaDetail($event.data.uuid)">
          <Column header="Dokumen" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.nomor }} <span class="font-normal text-grey-400">v{{ d.versi }}</span></div>
              <div>{{ d.judul }}</div>
            </template>
          </Column>
          <Column header="Jenis" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ JENIS_DOKUMEN[d.jenis] ?? d.jenis }}</template></Column>
          <Column field="unitPemilik" header="Unit Pemilik" headerClass="bg-opensimrs-50" />
          <Column header="Terbit" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ tanggalMutu(d.tanggalTerbit) }}</template></Column>
          <Column header="Tinjau Ulang" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span :class="d.perluTinjau ? 'text-danger-300 font-semibold' : ''">{{ tanggalMutu(d.tanggalTinjauUlang) }}</span>
              <div v-if="d.perluTinjau" class="text-[10px] text-danger-300">Perlu ditinjau</div>
            </template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaStatusDokumen(d.status).bg, gayaStatusDokumen(d.status).text]">{{ gayaStatusDokumen(d.status).label }}</span>
              <div v-if="!d.terbaru" class="text-[10px] text-grey-400">versi lama</div>
            </template>
          </Column>
          <Column header="Elemen" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.jumlahElemen }}</template></Column>
          <Column header="Versi" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.jumlahVersi }}</template></Column>
          <Column header="Surveior" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.dibagikanSurveior ? "Dibagikan" : "-" }}</template></Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialogForm" width="820px">
      <template #header>{{ JUDUL_FORM[mode] }}{{ mode !== "buat" ? ` — ${form.nomor}` : "" }}</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomSelect v-model="form.jenis" label="Jenis Dokumen" :options="OPSI_JENIS" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" required />
          <CustomTextfield v-model="form.nomor" label="Nomor Dokumen" :maxLength="100" :disabled="mode !== 'buat'" required />
          <CustomTextfield v-model="form.judul" label="Judul" class="col-span-2" :maxLength="255" required />
          <CustomTextfield v-model="form.unitPemilik" label="Unit Pemilik" :maxLength="255" />
          <CustomTextfield v-model="form.versi" :label="mode === 'revisi' ? `Versi Baru (kosong = otomatis setelah v${form.versiLama})` : 'Versi'" :maxLength="20" />
          <CustomDatePicker v-model="form.tanggalTerbit" label="Tanggal Terbit" required />
          <CustomDatePicker v-model="form.tanggalTinjauUlang" label="Tanggal Tinjau Ulang" :minDate="form.tanggalTerbit ?? undefined" />
          <div class="col-span-2">
            <label class="text-sm cursor-pointer text-opensimrs-300">
              + {{ mode === "ubah" ? "Ganti berkas PDF (opsional)" : "Unggah berkas PDF (wajib)" }} — maks. {{ maksMb }} MB
              <input type="file" class="hidden" accept="application/pdf" @change="pilihBerkas" />
            </label>
            <div v-if="berkas" class="text-xs">{{ berkas.name }} ({{ ukuranBerkas(berkas.size) }})</div>
            <div class="text-[11px] text-grey-400">Jangan unggah dokumen yang memuat data pasien.</div>
          </div>
          <div v-if="mode !== 'ubah'" class="col-span-2">
            <div class="mb-1 text-sm font-semibold">Pemetaan ke Elemen Penilaian{{ mode === "revisi" ? " (disalin dari versi sebelumnya)" : "" }}</div>
            <PilihElemen v-model="form.elemenUuid" />
          </div>
        </div>
        <div v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogForm = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanForm" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogDetail" width="900px">
      <template #header>{{ detail?.nomor }} v{{ detail?.versi }} — {{ detail?.judul }}</template>
      <template #body>
        <div v-if="detail" class="flex flex-col gap-4 pt-4 text-sm">
          <div class="grid grid-cols-2 gap-x-6 gap-y-1">
            <div><span class="text-grey-400">Jenis:</span> {{ JENIS_DOKUMEN[detail.jenis] }}</div>
            <div>
              <span class="text-grey-400">Status:</span>
              <span class="px-2 py-0.5 ml-1 rounded-full text-xs font-semibold" :class="[gayaStatusDokumen(detail.status).bg, gayaStatusDokumen(detail.status).text]">{{ gayaStatusDokumen(detail.status).label }}</span>
              <span v-if="detail.perluTinjau" class="ml-2 text-xs font-semibold text-danger-300">Perlu ditinjau</span>
              <span v-if="!detail.terbaru" class="ml-2 text-xs text-grey-400">(versi lama)</span>
            </div>
            <div><span class="text-grey-400">Unit pemilik:</span> {{ detail.unitPemilik || "-" }}</div>
            <div><span class="text-grey-400">Tanggal terbit:</span> {{ tanggalMutu(detail.tanggalTerbit) }}</div>
            <div><span class="text-grey-400">Tinjau ulang:</span> {{ tanggalMutu(detail.tanggalTinjauUlang) }}</div>
            <div><span class="text-grey-400">Disahkan:</span> {{ detail.disahkanPada ? `${tanggalMutu(detail.disahkanPada)} oleh ${detail.disahkanOleh}` : "-" }}</div>
            <div v-if="detail.catatanStatus" class="col-span-2"><span class="text-grey-400">Catatan status:</span> {{ detail.catatanStatus }}</div>
            <div v-if="detail.catatanTinjauan" class="col-span-2">
              <span class="text-grey-400">Tinjauan terakhir:</span> {{ detail.catatanTinjauan }} ({{ tanggalMutu(detail.ditinjauPada) }}, {{ detail.ditinjauOleh }})
            </div>
            <div><span class="text-grey-400">Surveior:</span> {{ detail.dibagikanSurveior ? `Dibagikan${detail.dibagikanSampai ? ` s.d. ${tanggalMutu(detail.dibagikanSampai)}` : ""}` : "Tidak dibagikan" }}</div>
            <div class="flex items-center gap-2">
              <span class="text-grey-400">Berkas:</span> {{ detail.berkasInfo?.namaBerkas }} ({{ ukuranBerkas(detail.berkasInfo?.ukuranBita) }})
              <CustomButton label="Lihat" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="lihatBerkas(detail.uuid)" />
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <CustomButton v-if="boleh('UPDATE') && detail.status === 'draf'" label="Ubah Draf" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaForm('ubah', detail)" />
            <CustomButton v-if="boleh('REVISI') && detail.terbaru" label="Buat Revisi" icon="PhClockCounterClockwise" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaForm('revisi', detail)" />
            <CustomButton
              v-for="s in boleh('UBAH STATUS') ? transisi : []"
              :key="s"
              :label="s === 'disahkan' ? 'Sahkan' : s === 'dicabut' ? 'Cabut' : 'Tandai Kedaluwarsa'"
              size="small"
              outlined
              :borderColor="s === 'dicabut' ? 'border-danger-300' : 'border-opensimrs-300'"
              :textColor="s === 'dicabut' ? 'text-danger-300' : 'text-opensimrs-300'"
              @click="mulaiAksi('status', { status: s, catatan: '' })"
            />
            <CustomButton v-if="boleh('TINJAU') && detail.status === 'disahkan'" label="Catat Tinjauan" icon="PhCalendarCheck" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="mulaiAksi('tinjau', { tanggal: null, catatan: '' })" />
            <CustomButton
              v-if="boleh('PETAKAN ELEMEN') && detail.terbaru && detail.status !== 'dicabut'"
              label="Petakan Elemen"
              icon="PhListChecks"
              size="small"
              outlined
              borderColor="border-opensimrs-300"
              textColor="text-opensimrs-300"
              @click="mulaiAksi('elemen', { elemenUuid: detail.elemen.map((e: any) => e.uuid) })"
            />
            <CustomButton v-if="boleh('BAGIKAN SURVEIOR') && detail.status === 'disahkan'" label="Akses Surveior" icon="PhEye" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="mulaiAksi('bagikan', { sampai: tanggalDariEpoch(detail.dibagikanSampai) })" />
            <CustomButton v-if="boleh('DELETE') && detail.status === 'draf' && detail.terbaru" label="Hapus Draf" icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="hapus" />
          </div>

          <div v-if="aksi" class="p-3 border rounded-lg border-opensimrs-100 bg-opensimrs-50">
            <template v-if="aksi === 'status'">
              <div class="mb-2 font-semibold">Ubah status menjadi {{ STATUS_DOKUMEN[formAksi.status]?.label }}</div>
              <CustomTextArea v-model="formAksi.catatan" :label="formAksi.status === 'dicabut' ? 'Alasan pencabutan (wajib)' : 'Catatan'" />
              <div class="flex justify-end gap-2 mt-2">
                <CustomButton label="Batal" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="aksi = ''" />
                <CustomButton label="Simpan Status" size="small" @click="simpanStatus" />
              </div>
            </template>
            <template v-else-if="aksi === 'tinjau'">
              <div class="mb-2 font-semibold">Catat tinjauan dokumen</div>
              <div class="grid grid-cols-3 gap-3">
                <CustomDatePicker v-model="formAksi.tanggal" label="Tinjau Ulang Berikutnya" :minDate="besok()" />
                <CustomTextArea v-model="formAksi.catatan" label="Catatan tinjauan" class="col-span-2" />
              </div>
              <div class="flex justify-end gap-2 mt-2">
                <CustomButton label="Batal" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="aksi = ''" />
                <CustomButton label="Simpan Tinjauan" size="small" @click="simpanTinjau" />
              </div>
            </template>
            <template v-else-if="aksi === 'elemen'">
              <div class="mb-2 font-semibold">Pemetaan elemen penilaian</div>
              <PilihElemen v-model="formAksi.elemenUuid" />
              <div class="flex justify-end gap-2 mt-2">
                <CustomButton label="Batal" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="aksi = ''" />
                <CustomButton label="Simpan Pemetaan" size="small" @click="simpanElemen" />
              </div>
            </template>
            <template v-else-if="aksi === 'bagikan'">
              <div class="mb-2 font-semibold">Akses baca surveior</div>
              <div class="grid grid-cols-2 gap-3">
                <CustomDatePicker v-model="formAksi.sampai" label="Dibagikan sampai (opsional)" :minDate="new Date()" />
                <div class="text-xs text-grey-400">Surveior (izin Akses Surveior) hanya dapat membaca dokumen disahkan yang dibagikan hingga tanggal ini.</div>
              </div>
              <div class="flex justify-end gap-2 mt-2">
                <CustomButton label="Batal" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="aksi = ''" />
                <CustomButton v-if="detail.dibagikanSurveior" label="Hentikan Berbagi" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="simpanBagikan(false)" />
                <CustomButton label="Bagikan" size="small" @click="simpanBagikan(true)" />
              </div>
            </template>
            <div v-if="galatAksi" class="mt-2 text-sm text-danger-300">{{ galatAksi }}</div>
          </div>

          <div>
            <h3 class="mb-1 font-semibold">Elemen Penilaian Terpetakan ({{ detail.elemen.length }})</h3>
            <div v-if="!detail.elemen.length" class="text-xs text-grey-400">Belum dipetakan ke elemen penilaian.</div>
            <div v-for="e in detail.elemen" :key="e.uuid" class="py-0.5 text-xs">
              <span class="font-semibold">{{ e.babKode }} / {{ e.standarKode }} / {{ e.kode }}</span> {{ e.uraian }} <span class="text-grey-400">— {{ e.instrumenNama }}</span>
            </div>
          </div>

          <div>
            <h3 class="mb-1 font-semibold">Riwayat Versi</h3>
            <DataTable :value="detail.riwayatVersi" class="text-xs" size="small">
              <Column header="Versi" headerClass="bg-opensimrs-50"><template #body="{ data: v }"><span :class="v.uuid === detail.uuid ? 'font-bold' : ''">v{{ v.versi }}</span></template></Column>
              <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: v }">{{ STATUS_DOKUMEN[v.status]?.label }}</template></Column>
              <Column header="Terbit" headerClass="bg-opensimrs-50"><template #body="{ data: v }">{{ tanggalMutu(v.tanggalTerbit) }}</template></Column>
              <Column header="Elemen" field="jumlahElemen" headerClass="bg-opensimrs-50" />
              <Column header="Dibuat" headerClass="bg-opensimrs-50"><template #body="{ data: v }">{{ v.dibuatOleh || "-" }}</template></Column>
              <Column header="" headerClass="bg-opensimrs-50">
                <template #body="{ data: v }">
                  <div class="flex gap-1">
                    <CustomButton label="Berkas" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="lihatBerkas(v.uuid)" />
                    <CustomButton v-if="v.uuid !== detail.uuid" label="Buka" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaDetail(v.uuid)" />
                  </div>
                </template>
              </Column>
            </DataTable>
          </div>

          <div>
            <h3 class="mb-1 font-semibold">Jejak Audit</h3>
            <div v-for="a in detail.audit" :key="a.uuid" class="py-0.5 text-xs border-b border-grey-100">
              <span class="text-grey-400">{{ new Date(a.createdAt * 1000).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) }}</span> · {{ a.aktor }} ·
              {{ LABEL_AKSI[a.aksi] ?? a.aksi }} <span class="text-grey-400">{{ ringkasAudit(a) }}</span>
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
