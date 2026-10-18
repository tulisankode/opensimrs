<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  OPSI_KATEGORI,
  batalPenerimaanLaundry,
  buatPenerimaanLaundry,
  daftarPenerimaanLaundry,
  gayaKategori,
  gayaStatusLaundry,
  izinLaundry,
  konfirmasiPenerimaanLaundry,
  referensiLaundry,
  waktuLaundry,
} from "@/stores/penunjang/laundry";

// Serah terima linen kotor (UC-1): petugas ruangan mencatat jenis, jumlah, kategori; petugas laundry yang berbeda
// mengonfirmasi jumlah aktual (selisih wajib beralasan). Konfirmasi mengurangi stok ruangan asal.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinLaundry("Penerimaan", aksi);
const ruangan = ref<any[]>([]);
const jenis = ref<any[]>([]);
const opsiRuangan = computed(() => ruangan.value.map((r) => ({ value: r.uuid, label: r.nama })));
// Jenis per unit (STD-0030) diserahkan lewat Pemindaian Unit (kode unit wajib), bukan form jumlah.
const opsiJenis = computed(() => jenis.value.filter((j) => j.aktif && j.caraPencatatan !== "per_unit").map((j) => ({ value: j.uuid, label: `${j.nama} (${j.satuan})` })));
const adaJenisUnit = computed(() => jenis.value.some((j) => j.aktif && j.caraPencatatan === "per_unit"));

const filterStatus = ref("menunggu_konfirmasi");
const data = ref<any[]>([]);
const muat = async () => {
  storeUtils.setLoading(true);
  try {
    data.value = (await daftarPenerimaanLaundry({ status: filterStatus.value }))?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
onMounted(async () => {
  const r = (await referensiLaundry())?.payload;
  ruangan.value = r?.ruangan ?? [];
  jenis.value = r?.jenisLinen ?? [];
  muat();
});

// ── Serah terima baru
const dialog = ref(false);
const form = ref<any>({});
const galat = ref("");
const barisBaru = () => ({ jenisLinenUuid: "", kategori: "biasa", jumlahDiserahkan: 1 });
const buka = () => {
  galat.value = "";
  form.value = { lokasiUuid: "", catatan: "", rincian: [barisBaru()] };
  dialog.value = true;
};
const simpan = async () => {
  const f = form.value;
  if (!f.lokasiUuid) return (galat.value = "Ruangan asal wajib dipilih");
  if (f.rincian.some((x: any) => !x.jenisLinenUuid || !x.jumlahDiserahkan)) return (galat.value = "Lengkapi jenis linen dan jumlah setiap baris");
  storeUtils.setLoading(true);
  try {
    const res = await buatPenerimaanLaundry({ lokasiUuid: f.lokasiUuid, catatan: f.catatan, rincian: f.rincian });
    if (res) {
      dialog.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Konfirmasi petugas laundry
const dialogKonfirmasi = ref(false);
const terpilih = ref<any>(null);
const formKonfirmasi = ref<any[]>([]);
const galatKonfirmasi = ref("");
const bukaKonfirmasi = (p: any) => {
  terpilih.value = p;
  galatKonfirmasi.value = "";
  formKonfirmasi.value = (p.rincian ?? []).map((x: any) => ({ ...x, jumlahDiterima: Number(x.jumlahDiserahkan), alasanSelisih: "" }));
  dialogKonfirmasi.value = true;
};
const konfirmasi = async () => {
  if (formKonfirmasi.value.some((x) => Number(x.jumlahDiterima) !== Number(x.jumlahDiserahkan) && !x.alasanSelisih?.trim()))
    return (galatKonfirmasi.value = "Alasan selisih wajib diisi untuk jumlah yang berbeda");
  storeUtils.setLoading(true);
  try {
    const res = await konfirmasiPenerimaanLaundry(
      terpilih.value.uuid,
      formKonfirmasi.value.map((x) => ({ uuid: x.uuid, jumlahDiterima: Number(x.jumlahDiterima ?? 0), alasanSelisih: x.alasanSelisih || undefined })),
    );
    if (res) {
      dialogKonfirmasi.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const batal = async (p: any) => {
  if (await batalPenerimaanLaundry(p.uuid)) muat();
};
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Serah Terima Linen Kotor</h1>
          <CustomSelect
            v-model="filterStatus"
            label="Status"
            :options="[{ value: '', label: 'Semua' }, { value: 'menunggu_konfirmasi', label: 'Menunggu Konfirmasi' }, { value: 'selesai', label: 'Selesai' }]"
            optionValue="value"
            optionLabel="label"
            @update:modelValue="muat"
          />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Serah Terima" @click="buka" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 60rem">
          <Column header="Waktu Serah" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ waktuLaundry(d.waktuSerah) }}</template></Column>
          <Column field="namaRuangan" header="Ruangan Asal" headerClass="bg-opensimrs-50" />
          <Column header="Rincian" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div v-for="x in d.rincian" :key="x.uuid" class="flex items-center gap-2">
                <span>{{ x.namaLinen }}: {{ Number(x.jumlahDiserahkan) }}<template v-if="x.jumlahDiterima !== null && x.jumlahDiterima !== undefined"> → {{ Number(x.jumlahDiterima) }}</template></span>
                <span class="px-2 rounded" :class="[gayaKategori(x.kategori).bg, gayaKategori(x.kategori).text]">{{ gayaKategori(x.kategori).label }}</span>
                <span v-if="x.alasanSelisih" class="text-grey-400">({{ x.alasanSelisih }})</span>
              </div>
            </template>
          </Column>
          <Column header="Petugas" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.petugasPenyerah }}<template v-if="d.petugasPenerima"> → {{ d.petugasPenerima }}</template></template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><span class="px-2 py-1 rounded" :class="[gayaStatusLaundry(d.status).bg, gayaStatusLaundry(d.status).text]">{{ gayaStatusLaundry(d.status).label }}</span></template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[180px]">
            <template #body="{ data: d }">
              <div v-if="d.status === 'menunggu_konfirmasi'" class="flex gap-2">
                <CustomButton v-if="boleh('KONFIRMASI')" label="Konfirmasi" size="small" icon="PhCheck" @click="bukaKonfirmasi(d)" />
                <CustomButton v-if="boleh('CREATE')" icon="PhX" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="batal(d)" />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="720px">
      <template #header>Serah Terima Linen Kotor</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <CustomSelect v-model="form.lokasiUuid" label="Ruangan Asal" :options="opsiRuangan" optionValue="value" optionLabel="label" placeHolder="Pilih ruangan" />
          <div v-if="adaJenisUnit" class="text-xs text-grey-400">Jenis linen yang dilacak per unit diserahkan lewat menu <b>Pemindaian Unit</b>.</div>
          <div v-for="(x, i) in form.rincian" :key="i" class="grid grid-cols-[2fr_1.3fr_1fr_auto] items-end gap-2">
            <CustomSelect v-model="x.jenisLinenUuid" label="Jenis Linen" :options="opsiJenis" optionValue="value" optionLabel="label" placeHolder="Pilih" />
            <CustomSelect v-model="x.kategori" label="Kategori" :options="OPSI_KATEGORI" optionValue="value" optionLabel="label" />
            <CustomInputNumber v-model="x.jumlahDiserahkan" label="Jumlah" :min="1" />
            <CustomButton icon="PhTrash" outlined borderColor="border-danger-300" textColor="text-danger-300" :disabled="form.rincian.length === 1" @click="form.rincian.splice(i, 1)" />
          </div>
          <div class="text-xs text-grey-400">Linen infeksius dan bernoda berat dicatat sebagai baris terpisah sesuai kategorinya.</div>
          <CustomButton icon="PhPlus" label="Tambah baris" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" class="self-start" @click="form.rincian.push(barisBaru())" />
          <CustomTextfield v-model="form.catatan" label="Catatan (opsional)" :maxLength="500" />
          <div v-if="galat" class="text-sm text-danger-300">{{ galat }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpan" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogKonfirmasi" width="720px">
      <template #header>Konfirmasi Penerimaan — {{ terpilih?.namaRuangan }}</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <div class="text-xs text-grey-400">Diserahkan oleh {{ terpilih?.petugasPenyerah }}. Konfirmasi harus dilakukan petugas laundry yang berbeda.</div>
          <div v-for="x in formKonfirmasi" :key="x.uuid" class="grid grid-cols-[2fr_1fr_2fr] items-end gap-2">
            <div class="text-sm pb-2">
              {{ x.namaLinen }} <span class="px-2 rounded" :class="[gayaKategori(x.kategori).bg, gayaKategori(x.kategori).text]">{{ gayaKategori(x.kategori).label }}</span>
              <div class="text-xs text-grey-400">Diserahkan: {{ Number(x.jumlahDiserahkan) }}</div>
            </div>
            <CustomInputNumber v-model="x.jumlahDiterima" label="Diterima" :min="0" />
            <CustomTextfield v-model="x.alasanSelisih" label="Alasan selisih" :maxLength="300" :disabled="Number(x.jumlahDiterima) === Number(x.jumlahDiserahkan)" />
          </div>
          <div v-if="galatKonfirmasi" class="text-sm text-danger-300">{{ galatKonfirmasi }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogKonfirmasi = false" />
          <CustomButton label="Konfirmasi" icon="PhCheck" @click="konfirmasi" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
