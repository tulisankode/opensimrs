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
  STATUS_TINDAK_LANJUT,
  capaianTeks,
  daftarIndikator,
  daftarTindakLanjut,
  epochTanggal,
  gayaTindakLanjut,
  hapusTindakLanjut,
  izinIndikator,
  labelPeriode,
  opsi,
  opsiBulan,
  opsiTriwulan,
  referensiIndikator,
  simpanTindakLanjut,
  tanggalDariEpoch,
  tanggalMutu,
  targetTeks,
} from "@/stores/penunjang/mutu";

// Tindak lanjut Indikator Mutu (STD-0025): analisis penyebab & rencana perbaikan (mis. siklus PDSA) per indikator dan
// periode (bulan/triwulan), terutama saat capaian di bawah target. Capaian & target periode disalin backend saat
// dicatat. Status rencana → berjalan → selesai; selesai mewajibkan hasil evaluasi.
const storeUtils = utilsStore();
const route = useRoute();
const boleh = izinIndikator;

const indikator = ref<any[]>([]);
const unit = ref<any[]>([]);
const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const filterIndikator = ref("");
const filterStatus = ref("");
const OPSI_STATUS = opsi(STATUS_TINDAK_LANJUT);
const OPSI_PERIODE = [...opsiBulan(24), ...opsiTriwulan(8)];
const opsiIndikator = computed(() => indikator.value.map((i: any) => ({ value: i.uuid, label: `${i.kode} — ${i.judul}` })));
const opsiUnit = computed(() => unit.value.map((u: any) => ({ value: u.uuid, label: u.nama })));

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarTindakLanjut({ page: page.value, limit: limit.value, indikatorUuid: filterIndikator.value, status: filterStatus.value });
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

const dialogForm = ref(false);
const form = ref<any>({});
const galat = ref("");
const bukaForm = (d?: any) => {
  galat.value = "";
  form.value = d
    ? { ...d, unitUuid: d.unitUuid ?? "", tenggat: tanggalDariEpoch(d.tenggat), hasilEvaluasi: d.hasilEvaluasi ?? "" }
    : { indikatorUuid: filterIndikator.value || "", unitUuid: "", periode: OPSI_PERIODE[0].value, analisis: "", rencana: "", penanggungJawab: "", tenggat: null, status: "rencana", hasilEvaluasi: "" };
  dialogForm.value = true;
};
const simpan = async () => {
  const f = form.value;
  galat.value = "";
  if (!f.uuid && (!f.indikatorUuid || !f.periode)) return (galat.value = "Indikator dan periode wajib dipilih");
  if (!f.analisis.trim() || !f.rencana.trim() || !f.penanggungJawab.trim()) return (galat.value = "Analisis, rencana tindak lanjut, dan penanggung jawab wajib diisi");
  if (f.status === "selesai" && !f.hasilEvaluasi.trim()) return (galat.value = "Hasil evaluasi wajib diisi bila tindak lanjut selesai");
  storeUtils.setLoading(true);
  try {
    const isi: Record<string, any> = {
      analisis: f.analisis.trim(),
      rencana: f.rencana.trim(),
      penanggungJawab: f.penanggungJawab.trim(),
      tenggat: epochTanggal(f.tenggat) ?? null,
      status: f.status,
      hasilEvaluasi: f.hasilEvaluasi.trim(),
    };
    const res = f.uuid ? await simpanTindakLanjut(isi, f.uuid) : await simpanTindakLanjut({ ...isi, indikatorUuid: f.indikatorUuid, unitUuid: f.unitUuid || null, periode: f.periode });
    if (res) {
      dialogForm.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const hapus = async () => {
  if (!confirm("Hapus tindak lanjut ini?")) return;
  if (await hapusTindakLanjut(form.value.uuid)) {
    dialogForm.value = false;
    muat();
  }
};

onMounted(async () => {
  const [r, i] = await Promise.all([referensiIndikator(), daftarIndikator({ limit: 500 })]);
  unit.value = r?.payload?.unit ?? [];
  indikator.value = i?.payload?.data ?? [];
  if (route.query.indikator) filterIndikator.value = String(route.query.indikator);
  await muat();
  if (route.query.baru && boleh("TINDAK LANJUT")) {
    bukaForm();
    if (route.query.periode) form.value.periode = String(route.query.periode);
  }
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Tindak Lanjut Indikator Mutu</h1>
          <CustomSelect v-model="filterIndikator" label="Indikator" placeHolder="Semua" :options="opsiIndikator" optionValue="value" optionLabel="label" @update:modelValue="cariData" />
          <CustomSelect v-model="filterStatus" label="Status" placeHolder="Semua" :options="OPSI_STATUS" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomButton v-if="boleh('TINDAK LANJUT')" icon="PhPlus" label="Catat Tindak Lanjut" @click="bukaForm()" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs cursor-pointer" scrollable scrollHeight="flex" tableStyle="min-width: 64rem" @rowClick="bukaForm($event.data)">
          <Column header="Periode" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ labelPeriode(d.periode) }}</template></Column>
          <Column header="Indikator" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.indikatorKode }}</div>
              <div>{{ d.indikatorJudul }}</div>
              <div class="text-grey-400">{{ d.unitNama || "Tingkat faskes" }}</div>
            </template>
          </Column>
          <Column header="Capaian / Target" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ capaianTeks(d.capaian, d.satuan) }}<div class="text-grey-400">{{ targetTeks(d.targetNilai, d.arah, d.satuan) }}</div></template>
          </Column>
          <Column header="Rencana" headerClass="bg-opensimrs-50"><template #body="{ data: d }"><div class="line-clamp-2">{{ d.rencana }}</div></template></Column>
          <Column field="penanggungJawab" header="Penanggung Jawab" headerClass="bg-opensimrs-50" />
          <Column header="Tenggat" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ tanggalMutu(d.tenggat) }}</template></Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaTindakLanjut(d.status).bg, gayaTindakLanjut(d.status).text]">{{ gayaTindakLanjut(d.status).label }}</span>
            </template>
          </Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialogForm" width="820px">
      <template #header>{{ form.uuid ? `Tindak Lanjut ${form.indikatorKode} — ${labelPeriode(form.periode)}` : "Catat Tindak Lanjut" }}</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <template v-if="!form.uuid">
            <CustomSelect v-model="form.indikatorUuid" label="Indikator" class="col-span-2" :options="opsiIndikator" optionValue="value" optionLabel="label" :clearable="false" required />
            <CustomSelect v-model="form.periode" label="Periode" :options="OPSI_PERIODE" optionValue="value" optionLabel="label" :clearable="false" required />
            <CustomSelect v-model="form.unitUuid" label="Unit" placeHolder="Tingkat faskes" :options="opsiUnit" optionValue="value" optionLabel="label" />
          </template>
          <div v-else class="col-span-2 text-sm">
            Capaian saat dicatat: <b>{{ capaianTeks(form.capaian, form.satuan) }}</b> · target {{ targetTeks(form.targetNilai, form.arah, form.satuan) }} · {{ form.unitNama || "Tingkat faskes" }}
          </div>
          <CustomTextArea v-model="form.analisis" label="Analisis (penyebab capaian)" class="col-span-2" required :disabled="!boleh('TINDAK LANJUT')" />
          <CustomTextArea v-model="form.rencana" label="Rencana Tindak Lanjut" class="col-span-2" required :disabled="!boleh('TINDAK LANJUT')" />
          <CustomTextfield v-model="form.penanggungJawab" label="Penanggung Jawab" :maxLength="255" required :disabled="!boleh('TINDAK LANJUT')" />
          <CustomDatePicker v-model="form.tenggat" label="Tenggat / Waktu Evaluasi" :disabled="!boleh('TINDAK LANJUT')" />
          <CustomSelect v-model="form.status" label="Status" :options="OPSI_STATUS" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" :disabled="!boleh('TINDAK LANJUT')" />
          <CustomTextArea v-model="form.hasilEvaluasi" label="Hasil Evaluasi" class="col-span-2" :disabled="!boleh('TINDAK LANJUT')" />
        </div>
        <div v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</div>
      </template>
      <template #footer>
        <div class="flex justify-between gap-2">
          <CustomButton v-if="form.uuid && boleh('TINDAK LANJUT')" label="Hapus" icon="PhTrash" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="hapus" />
          <span v-else></span>
          <div class="flex gap-2">
            <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogForm = false" />
            <CustomButton v-if="boleh('TINDAK LANJUT')" label="Simpan" icon="PhFloppyDisk" @click="simpan" />
          </div>
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
