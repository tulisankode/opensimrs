<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { JENIS_UTILITAS, SATUAN_UTILITAS, catatUtilitas, daftarUtilitas, epochAkhirHari, epochAwalHari, epochWaktu, izinSarpras, opsi, referensiSarpras, waktuSarpras } from "@/stores/penunjang/sarpras";

// Pencatatan meter utilitas (KF-19, fitur opsional sarpras_utilitas): listrik/air/genset/oksigen sentral per lokasi,
// dengan selisih terhadap catatan sebelumnya (pemakaian periode).
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinSarpras("Utilitas", aksi);

const referensi = ref<any>({ lokasi: [], fitur: {} });
const fiturAktif = ref(true);
const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const filterLokasi = ref("");
const filterJenis = ref("");
const tglMulai = ref<Date | null>(null);
const tglSelesai = ref<Date | null>(null);

const muat = async () => {
  if (!fiturAktif.value) return;
  storeUtils.setLoading(true);
  try {
    const res = await daftarUtilitas({
      page: page.value,
      limit: limit.value,
      lokasiUuid: filterLokasi.value,
      jenisUtilitas: filterJenis.value,
      tanggalMulai: epochAwalHari(tglMulai.value),
      tanggalSelesai: epochAkhirHari(tglSelesai.value),
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

const dialog = ref(false);
const form = ref<any>({});
const galat = ref("");
const buka = () => {
  galat.value = "";
  form.value = { lokasiUuid: filterLokasi.value, jenisUtilitas: filterJenis.value || "listrik", waktuCatat: new Date(), nilaiMeter: "", satuan: SATUAN_UTILITAS[filterJenis.value || "listrik"], catatan: "" };
  dialog.value = true;
};
watch(
  () => form.value.jenisUtilitas,
  (j) => {
    if (j && dialog.value) form.value.satuan = SATUAN_UTILITAS[j] ?? form.value.satuan;
  },
);
const simpan = async () => {
  const f = form.value;
  galat.value = "";
  if (!f.lokasiUuid || !f.jenisUtilitas || f.nilaiMeter === "" || !String(f.satuan ?? "").trim()) return (galat.value = "Lokasi, jenis, nilai meter, dan satuan wajib diisi");
  const res = await catatUtilitas({ lokasiUuid: f.lokasiUuid, jenisUtilitas: f.jenisUtilitas, waktuCatat: epochWaktu(f.waktuCatat), nilaiMeter: f.nilaiMeter, satuan: f.satuan.trim(), catatan: f.catatan.trim() || undefined });
  if (res) {
    dialog.value = false;
    muat();
  }
};

onMounted(async () => {
  const r = await referensiSarpras();
  if (r?.payload) {
    referensi.value = r.payload;
    fiturAktif.value = r.payload.fitur?.sarprasUtilitas !== false;
  }
  muat();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Pencatatan Utilitas</h1>
          <template v-if="fiturAktif">
            <CustomSelect v-model="filterLokasi" label="Lokasi" placeHolder="Semua" :options="referensi.lokasi" optionValue="uuid" optionLabel="nama" @update:modelValue="cariData" />
            <CustomSelect v-model="filterJenis" label="Jenis" placeHolder="Semua" :options="opsi(JENIS_UTILITAS)" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
            <CustomDatePicker v-model="tglMulai" label="Dari Tanggal" class="toolbar-field--date" />
            <CustomDatePicker v-model="tglSelesai" label="Sampai Tanggal" class="toolbar-field--date" />
            <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
            <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Catat Meter" @click="buka" />
          </template>
        </PageToolbar>
      </template>
      <template #content>
        <div v-if="!fiturAktif" class="p-6 text-sm text-grey-400">Fitur Pencatatan Utilitas belum diaktifkan untuk faskes ini (Setting › Manajemen Modul & Fitur).</div>
        <NoData v-else-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 50rem">
          <Column header="Waktu" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ waktuSarpras(d.waktuCatat) }}</template></Column>
          <Column field="namaLokasi" header="Lokasi" headerClass="bg-opensimrs-50" />
          <Column header="Jenis" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ JENIS_UTILITAS[d.jenisUtilitas] ?? d.jenisUtilitas }}</template></Column>
          <Column header="Nilai Meter" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ Number(d.nilaiMeter).toLocaleString("id-ID") }} {{ d.satuan }}</template></Column>
          <Column header="Selisih" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.selisih === null || d.selisih === undefined ? "-" : `${Number(d.selisih).toLocaleString("id-ID")} ${d.satuan}` }}</template>
          </Column>
          <Column field="catatan" header="Catatan" headerClass="bg-opensimrs-50" />
          <Column field="dicatatOleh" header="Dicatat Oleh" headerClass="bg-opensimrs-50" />
        </DataTable>
      </template>
      <template #footer>
        <div v-if="fiturAktif" class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="600px">
      <template #header>Catat Meter Utilitas</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomSelect v-model="form.lokasiUuid" label="Lokasi" :options="referensi.lokasi" optionValue="uuid" optionLabel="nama" required />
          <CustomSelect v-model="form.jenisUtilitas" label="Jenis" :options="opsi(JENIS_UTILITAS)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" required />
          <CustomDatePicker v-model="form.waktuCatat" label="Waktu Catat" showTime :maxDate="new Date()" />
          <div class="grid grid-cols-2 gap-2">
            <CustomTextfield v-model="form.nilaiMeter" label="Nilai Meter" type="number" required :maxLength="15" />
            <CustomTextfield v-model="form.satuan" label="Satuan" required :maxLength="20" />
          </div>
          <CustomTextfield v-model="form.catatan" label="Catatan (opsional)" class="col-span-2" :maxLength="500" />
        </div>
        <div v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpan" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
