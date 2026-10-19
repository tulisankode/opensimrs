<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
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
  GRADE_IKP,
  STATUS_RISIKO,
  daftarRisikoIkp,
  epochTanggal,
  gayaGrade,
  gayaRisiko,
  hapusRisikoIkp,
  izinRisiko,
  opsi,
  referensiIkp,
  simpanRisikoIkp,
  tanggalDariEpoch,
  tanggalMutu,
} from "@/stores/penunjang/mutu";

// Register risiko unit (STD-0026, izin "Mutu & Akreditasi › Register Risiko"): risiko teridentifikasi per unit, skor
// dampak × probabilitas (grade dari matriks faskes), pengendalian yang ada, rencana mitigasi, PIC & tenggat, dan
// tautan opsional ke nomor laporan insiden.
const storeUtils = utilsStore();
const boleh = izinRisiko;
const referensi = ref<any>({ unit: [], pegawai: [], levelDampak: [], levelProbabilitas: [], pengaturan: {} });
const opsiUnit = computed(() => (referensi.value.unit ?? []).map((u: any) => ({ value: u.uuid, label: u.nama })));
const opsiPegawai = computed(() => (referensi.value.pegawai ?? []).map((p: any) => ({ value: p.uuid, label: p.nama })));
const opsiLevel = (daftar: any[]) => (daftar ?? []).map((x: any) => ({ value: Number(x.kode), label: `${x.kode}. ${x.nama}` }));
const OPSI_STATUS = opsi(STATUS_RISIKO);
const OPSI_GRADE = opsi(GRADE_IKP);

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const filter = ref({ unitUuid: "", status: "", grade: "", cari: "" });
const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarRisikoIkp({ page: page.value, limit: limit.value, ...filter.value, cari: filter.value.cari.trim() });
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

const dialog = ref(false);
const form = ref<any>({});
const galat = ref("");
const pratinjau = computed(() => (form.value.dampak && form.value.probabilitas ? referensi.value.pengaturan?.matriks?.[form.value.probabilitas - 1]?.[form.value.dampak - 1] : null));
const bukaForm = (d?: any) => {
  galat.value = "";
  form.value = d
    ? { ...d, penyebab: d.penyebab ?? "", pengendalianAda: d.pengendalianAda ?? "", rencanaMitigasi: d.rencanaMitigasi ?? "", picPegawaiUuid: d.picPegawaiUuid ?? "", tenggat: tanggalDariEpoch(d.tenggat) }
    : { unitUuid: filter.value.unitUuid || "", uraian: "", penyebab: "", pengendalianAda: "", dampak: null, probabilitas: null, rencanaMitigasi: "", picPegawaiUuid: "", tenggat: null, status: "terbuka" };
  dialog.value = true;
};
const simpan = async () => {
  const f = form.value;
  galat.value = "";
  if (!f.unitUuid || !f.uraian.trim() || !f.dampak || !f.probabilitas) return (galat.value = "Unit, uraian risiko, dampak, dan probabilitas wajib diisi");
  storeUtils.setLoading(true);
  try {
    const isi = {
      unitUuid: f.unitUuid,
      uraian: f.uraian.trim(),
      penyebab: f.penyebab.trim(),
      pengendalianAda: f.pengendalianAda.trim(),
      dampak: f.dampak,
      probabilitas: f.probabilitas,
      rencanaMitigasi: f.rencanaMitigasi.trim(),
      picPegawaiUuid: f.picPegawaiUuid || null,
      tenggat: epochTanggal(f.tenggat) ?? null,
      status: f.status,
    };
    if (await simpanRisikoIkp(isi, f.uuid)) {
      dialog.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const hapus = async () => {
  if (!confirm("Hapus risiko ini?")) return;
  if (await hapusRisikoIkp(form.value.uuid)) {
    dialog.value = false;
    muat();
  }
};

onMounted(async () => {
  const r = await referensiIkp();
  if (r?.payload) referensi.value = r.payload;
  muat();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Register Risiko Unit</h1>
          <CustomTextfield v-model="filter.cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Uraian / unit" :maxLength="100" @keydown.enter="cariData" />
          <CustomSelect v-model="filter.unitUuid" label="Unit" placeHolder="Semua" :options="opsiUnit" optionValue="value" optionLabel="label" @update:modelValue="cariData" />
          <CustomSelect v-model="filter.status" label="Status" placeHolder="Semua" :options="OPSI_STATUS" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomSelect v-model="filter.grade" label="Grade" placeHolder="Semua" :options="OPSI_GRADE" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Catat Risiko" @click="bukaForm()" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs cursor-pointer" scrollable scrollHeight="flex" tableStyle="min-width: 64rem" @rowClick="bukaForm($event.data)">
          <Column field="unitNama" header="Unit" headerClass="bg-opensimrs-50" />
          <Column header="Risiko" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><div class="font-semibold">{{ d.uraian }}</div><div v-if="d.penyebab" class="text-grey-400">{{ d.penyebab }}</div></template>
          </Column>
          <Column header="Skor / Grade" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              {{ d.dampak }} × {{ d.probabilitas }} = {{ d.skor }}
              <span class="px-2 py-0.5 ml-1 rounded-full text-[10px] font-semibold" :class="[gayaGrade(d.grade).bg, gayaGrade(d.grade).text]">{{ gayaGrade(d.grade).label }}</span>
            </template>
          </Column>
          <Column header="Mitigasi" headerClass="bg-opensimrs-50"><template #body="{ data: d }"><div class="line-clamp-2">{{ d.rencanaMitigasi || "-" }}</div></template></Column>
          <Column header="PIC / Tenggat" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.picNama || "-" }}<div class="text-grey-400">{{ tanggalMutu(d.tenggat) }}</div></template></Column>
          <Column field="laporanNomor" header="Laporan Terkait" headerClass="bg-opensimrs-50" />
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaRisiko(d.status).bg, gayaRisiko(d.status).text]">{{ gayaRisiko(d.status).label }}</span></template>
          </Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="820px">
      <template #header>{{ form.uuid ? "Risiko Unit" : "Catat Risiko Unit" }}</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomSelect v-model="form.unitUuid" label="Unit" :options="opsiUnit" optionValue="value" optionLabel="label" :clearable="false" required :disabled="!!form.uuid && !boleh('UPDATE')" />
          <CustomSelect v-model="form.status" label="Status" :options="OPSI_STATUS" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" :disabled="!boleh(form.uuid ? 'UPDATE' : 'CREATE')" />
          <CustomTextArea v-model="form.uraian" label="Uraian Risiko" class="col-span-2" required :disabled="!boleh(form.uuid ? 'UPDATE' : 'CREATE')" />
          <CustomTextArea v-model="form.penyebab" label="Penyebab" class="col-span-2" :disabled="!boleh(form.uuid ? 'UPDATE' : 'CREATE')" />
          <CustomTextArea v-model="form.pengendalianAda" label="Pengendalian yang Sudah Ada" class="col-span-2" :disabled="!boleh(form.uuid ? 'UPDATE' : 'CREATE')" />
          <CustomSelect v-model="form.dampak" label="Dampak" :options="opsiLevel(referensi.levelDampak)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" required :disabled="!boleh(form.uuid ? 'UPDATE' : 'CREATE')" />
          <CustomSelect v-model="form.probabilitas" label="Probabilitas" :options="opsiLevel(referensi.levelProbabilitas)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" required :disabled="!boleh(form.uuid ? 'UPDATE' : 'CREATE')" />
          <div class="col-span-2 text-sm">
            Skor: <b>{{ form.dampak && form.probabilitas ? form.dampak * form.probabilitas : "-" }}</b> · Grade:
            <b :class="gayaGrade(pratinjau).text">{{ pratinjau ? gayaGrade(pratinjau).label : "-" }}</b>
          </div>
          <CustomTextArea v-model="form.rencanaMitigasi" label="Rencana Mitigasi" class="col-span-2" :disabled="!boleh(form.uuid ? 'UPDATE' : 'CREATE')" />
          <CustomSelect v-model="form.picPegawaiUuid" label="PIC" :options="opsiPegawai" optionValue="value" optionLabel="label" :disabled="!boleh(form.uuid ? 'UPDATE' : 'CREATE')" />
          <CustomDatePicker v-model="form.tenggat" label="Tenggat Mitigasi" :disabled="!boleh(form.uuid ? 'UPDATE' : 'CREATE')" />
          <div v-if="form.laporanNomor" class="col-span-2 text-xs text-grey-400">Tertaut laporan insiden {{ form.laporanNomor }}</div>
        </div>
        <div v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</div>
      </template>
      <template #footer>
        <div class="flex justify-between gap-2">
          <CustomButton v-if="form.uuid && boleh('DELETE')" label="Hapus" icon="PhTrash" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="hapus" />
          <span v-else></span>
          <div class="flex gap-2">
            <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
            <CustomButton v-if="boleh(form.uuid ? 'UPDATE' : 'CREATE')" label="Simpan" icon="PhFloppyDisk" @click="simpan" />
          </div>
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
