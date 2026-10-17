<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  buatLoadCssd,
  daftarLoadCssd,
  daftarMesinCssd,
  daftarSetCssd,
  detailLoadCssd,
  gayaLoadCssd,
  gayaSetCssd,
  izinCssd,
  opsi,
  referensiPilihanCssd,
  simpanHasilLoadCssd,
  waktuRingkas,
} from "@/stores/penunjang/cssd";

// Siklus sterilisasi (load): mesin, metode, parameter, set yang dimuat, hasil indikator kimia/biologi — satu
// kegagalan mengubah seluruh set dalam load menjadi tidak layak secara otomatis (KF-13).
const storeUtils = utilsStore();
const route = useRoute();
const router = useRouter();
const boleh = (aksi: string) => izinCssd("Siklus Sterilisasi", aksi);

const data = ref<any[]>([]);
const mesin = ref<any[]>([]);
const metode = ref<Record<string, string>>({});
const filterStatus = ref("");

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    data.value = (await daftarLoadCssd({ status: filterStatus.value, limit: 100 }))?.payload?.data ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
onMounted(async () => {
  const ref1 = await referensiPilihanCssd();
  metode.value = Object.fromEntries((ref1?.payload?.metode ?? []).map((m: any) => [m.kode, m.nama]));
  mesin.value = (await daftarMesinCssd({ status_aktif: 1 }))?.payload ?? [];
  await muat();
  if (route.query.load) bukaDetail({ uuid: route.query.load as string });
});

// ── Load baru ──────────────────────────────────────────────────────────────
const dialogBaru = ref(false);
const setDikemas = ref<any[]>([]);
const kosong = () => ({ mesinUuid: "", nomorLoad: "", metode: "autoklaf", parameterSuhu: null, parameterTekanan: null, parameterDurasiMenit: null, catatan: "", petugasUuid: "", setUuid: [] as string[] });
const form = ref<any>(kosong());
const galat = ref("");

const bukaBaru = async () => {
  galat.value = "";
  form.value = kosong();
  setDikemas.value = (await daftarSetCssd({ status: "dikemas", limit: 200 }))?.payload?.data ?? [];
  dialogBaru.value = true;
};
const pilihMesin = (mesinUuid: string) => {
  const m = mesin.value.find((x) => x.uuid === mesinUuid);
  if (m) form.value.metode = m.metode;
};
const simpanBaru = async () => {
  const f = form.value;
  if (!f.mesinUuid) return (galat.value = "Mesin wajib dipilih");
  if (!f.nomorLoad.trim()) return (galat.value = "Nomor load wajib diisi");
  if (!f.setUuid.length) return (galat.value = "Pilih minimal satu set untuk dimuat");
  storeUtils.setLoading(true);
  try {
    const res = await buatLoadCssd(f);
    if (res) {
      dialogBaru.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Detail & hasil indikator ───────────────────────────────────────────────
const dialogDetail = ref(false);
const loadAktif = ref<any>(null);
const formHasil = ref({ hasilIndikatorKimia: "", hasilIndikatorBiologi: "", catatan: "" });
const galatHasil = ref("");

const bukaDetail = async (baris: any) => {
  loadAktif.value = (await detailLoadCssd(baris.uuid))?.payload;
  formHasil.value = { hasilIndikatorKimia: loadAktif.value?.hasilIndikatorKimia ?? "", hasilIndikatorBiologi: loadAktif.value?.hasilIndikatorBiologi ?? "", catatan: "" };
  galatHasil.value = "";
  dialogDetail.value = true;
};
const simpanHasil = async () => {
  const f = formHasil.value;
  if (!f.hasilIndikatorKimia && !f.hasilIndikatorBiologi) return (galatHasil.value = "Isi minimal satu hasil indikator");
  storeUtils.setLoading(true);
  try {
    const res = await simpanHasilLoadCssd(loadAktif.value.uuid, f);
    if (res) {
      loadAktif.value = res.payload;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const lihatRecall = () => {
  dialogDetail.value = false;
  router.push({ path: "/cssd/recall", query: { load: loadAktif.value.uuid } });
};
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Siklus Sterilisasi (Load)</h1>
          <CustomSelect
            v-model="filterStatus"
            label="Status"
            :options="[{ value: 'menunggu_hasil', label: 'Menunggu Hasil' }, { value: 'lulus', label: 'Lulus' }, { value: 'gagal', label: 'Gagal' }]"
            optionValue="value"
            optionLabel="label"
            placeHolder="Semua status"
            @update:modelValue="muat"
          />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Load Baru" @click="bukaBaru" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex">
          <Column field="nomorLoad" header="Nomor Load" headerClass="bg-opensimrs-50" />
          <Column field="namaMesin" header="Mesin" headerClass="bg-opensimrs-50" />
          <Column header="Metode" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ metode[d.metode] ?? d.metode }}</template>
          </Column>
          <Column field="jumlahSet" header="Jumlah Set" headerClass="bg-opensimrs-50" />
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaLoadCssd(d.status)?.bg, gayaLoadCssd(d.status)?.text]">{{ gayaLoadCssd(d.status)?.label }}</span>
            </template>
          </Column>
          <Column header="Mulai" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ waktuRingkas(d.waktuMulai) }}</template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[100px]">
            <template #body="{ data: d }">
              <CustomButton label="Detail" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaDetail(d)" />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <!-- Load baru -->
    <CustomDialog v-model:visible="dialogBaru" width="760px">
      <template #header>Load Sterilisasi Baru</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomSelect v-model="form.mesinUuid" label="Mesin" :options="mesin.map((m: any) => ({ value: m.uuid, label: `${m.namaMesin} (${metode[m.metode]})` }))" optionValue="value" optionLabel="label" placeHolder="Pilih mesin" @update:modelValue="pilihMesin" />
          <CustomTextfield v-model="form.nomorLoad" label="Nomor Load" placeholder="mis. 7" required :maxLength="50" />
          <CustomSelect v-model="form.metode" label="Metode" :options="opsi(metode)" optionValue="value" optionLabel="label" :clearable="false" :showFilter="false" />
          <CustomTextfield v-model="form.petugasUuid" label="Petugas" :maxLength="255" />
          <CustomInputNumber v-model="form.parameterSuhu" label="Suhu (°C)" />
          <CustomInputNumber v-model="form.parameterTekanan" label="Tekanan (kPa)" />
          <CustomInputNumber v-model="form.parameterDurasiMenit" label="Durasi (menit)" />
        </div>
        <label class="flex flex-col gap-1 mt-4 text-sm font-semibold">
          Set yang Dimuat <span class="text-danger-300">*</span>
          <MultiSelect
            v-model="form.setUuid"
            :options="setDikemas.map((s: any) => ({ value: s.uuid, label: `${s.namaSet} — ${s.kodeSetFisik} (${s.kodeBarcode})` }))"
            optionValue="value"
            optionLabel="label"
            filter
            display="chip"
            placeholder="Pilih set berstatus dikemas"
            class="w-full font-normal"
          />
        </label>
        <CustomTextArea v-model="form.catatan" label="Catatan" class="mt-4" />
        <div v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogBaru = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanBaru" />
        </div>
      </template>
    </CustomDialog>

    <!-- Detail load & hasil indikator -->
    <CustomDialog v-model:visible="dialogDetail" width="720px">
      <template #header>Load {{ loadAktif?.nomorLoad }} — {{ loadAktif?.namaMesin }}</template>
      <template #body>
        <div v-if="loadAktif" class="flex flex-col gap-4 pt-4">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaLoadCssd(loadAktif.status)?.bg, gayaLoadCssd(loadAktif.status)?.text]">{{ gayaLoadCssd(loadAktif.status)?.label }}</span>
            <CustomButton v-if="loadAktif.status === 'gagal'" label="Lihat Recall" icon="PhWarningCircle" size="small" @click="lihatRecall" />
          </div>

          <div>
            <h3 class="mb-2 text-sm font-semibold">Set dalam Load</h3>
            <DataTable :value="loadAktif.set" stripedRows class="text-xs">
              <Column header="Set" headerClass="bg-opensimrs-50">
                <template #body="{ data: s }">{{ s.namaSet }} — {{ s.kodeSetFisik }}</template>
              </Column>
              <Column header="Status" headerClass="bg-opensimrs-50">
                <template #body="{ data: s }">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaSetCssd(s.status)?.bg, gayaSetCssd(s.status)?.text]">{{ gayaSetCssd(s.status)?.label }}</span>
                </template>
              </Column>
            </DataTable>
          </div>

          <div v-if="loadAktif.status === 'menunggu_hasil' || loadAktif.status === 'draf'">
            <h3 class="mb-2 text-sm font-semibold">Hasil Indikator</h3>
            <div class="grid grid-cols-2 gap-4">
              <CustomSelect
                v-model="formHasil.hasilIndikatorKimia"
                label="Indikator Kimia"
                :options="[{ value: 'lulus', label: 'Lulus' }, { value: 'gagal', label: 'Gagal' }]"
                optionValue="value"
                optionLabel="label"
                placeHolder="Belum diisi"
              />
              <CustomSelect
                v-model="formHasil.hasilIndikatorBiologi"
                label="Indikator Biologi"
                :options="[{ value: 'lulus', label: 'Lulus' }, { value: 'gagal', label: 'Gagal' }]"
                optionValue="value"
                optionLabel="label"
                placeHolder="Belum diisi"
              />
            </div>
            <CustomTextArea v-model="formHasil.catatan" label="Catatan" class="mt-3" />
            <div v-if="galatHasil" class="mt-2 text-sm text-danger-300">{{ galatHasil }}</div>
            <div class="flex justify-end mt-3">
              <CustomButton v-if="boleh('INPUT HASIL')" label="Simpan Hasil" icon="PhCheck" @click="simpanHasil" />
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogDetail = false" />
      </template>
    </CustomDialog>
  </div>
</template>
