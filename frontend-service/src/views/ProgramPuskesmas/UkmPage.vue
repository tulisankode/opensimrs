<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  JENIS_KEGIATAN_UKM,
  cariKelurahanPkm,
  daftarUkmPkm,
  hapusUkmPkm,
  izinPkm,
  keTanggal,
  opsi,
  ringkasanUkmPkm,
  simpanUkmPkm,
} from "@/stores/programPuskesmas/programPuskesmas";

// Kegiatan UKM & luar gedung (KF-18/KF-19): dicatat sebagai rekap kegiatan kelompok, bukan kunjungan rawat
// jalan individual (aturan bisnis #10 — peserta kegiatan tidak dihitung sebagai pasien unik).
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinPkm("Kegiatan UKM", aksi);
const periodeDefault = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const filterPeriode = ref(periodeDefault());
const ringkasan = ref<any[]>([]);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const [res, rk] = await Promise.all([
      daftarUkmPkm({ page: page.value, limit: limit.value, periode: filterPeriode.value }),
      ringkasanUkmPkm(filterPeriode.value),
    ]);
    data.value = res?.payload?.data ?? [];
    total.value = res?.payload?.pagination?.total ?? 0;
    ringkasan.value = rk?.payload ?? [];
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
const kataKelurahan = ref("");
const hasilKelurahan = ref<any[]>([]);
const kelurahanTerpilih = ref<any>(null);
const kosong = () => ({ uuid: "", jenisKegiatan: "posyandu", tanggalPelaksanaan: new Date(), pelaksana: "", jumlahSasaran: 0, catatan: "" });
const form = ref(kosong());
const galat = ref("");
const buka = (baris?: any) => {
  kataKelurahan.value = "";
  hasilKelurahan.value = [];
  galat.value = "";
  if (baris) {
    kelurahanTerpilih.value = { code: baris.kelurahanCode, name: baris.namaKelurahan };
    form.value = {
      uuid: baris.uuid,
      jenisKegiatan: baris.jenisKegiatan,
      tanggalPelaksanaan: new Date(baris.tanggalPelaksanaan),
      pelaksana: baris.pelaksana ?? "",
      jumlahSasaran: baris.jumlahSasaran ?? 0,
      catatan: baris.catatan ?? "",
    };
  } else {
    kelurahanTerpilih.value = null;
    form.value = kosong();
  }
  dialog.value = true;
};
const cariKelurahan = async () => {
  const res = await cariKelurahanPkm(kataKelurahan.value);
  hasilKelurahan.value = res?.payload ?? [];
};
const simpan = async () => {
  galat.value = "";
  if (!kelurahanTerpilih.value) return (galat.value = "Pilih kelurahan pelaksanaan");
  const f = form.value;
  storeUtils.setLoading(true);
  try {
    const res = await simpanUkmPkm(
      {
        jenisKegiatan: f.jenisKegiatan,
        kelurahanCode: kelurahanTerpilih.value.code,
        tanggalPelaksanaan: keTanggal(f.tanggalPelaksanaan),
        pelaksana: f.pelaksana || null,
        jumlahSasaran: f.jumlahSasaran,
        catatan: f.catatan || null,
      },
      f.uuid || undefined,
    );
    if (res?.payload) {
      dialog.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const dialogHapus = ref(false);
const akanDihapus = ref<any>(null);
const konfirmasiHapus = (baris: any) => {
  akanDihapus.value = baris;
  dialogHapus.value = true;
};
const hapus = async () => {
  if (!akanDihapus.value) return;
  const res = await hapusUkmPkm(akanDihapus.value.uuid);
  if (res) {
    dialogHapus.value = false;
    muat();
  }
};

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden gap-3">
    <Card v-if="ringkasan.length" pt:content:class="p-4">
      <template #content>
        <div class="mb-2 text-sm font-semibold">Ringkasan Capaian — Periode {{ filterPeriode }}</div>
        <div class="flex flex-wrap gap-3">
          <div v-for="r in ringkasan" :key="`${r.kelurahanCode}-${r.jenisKegiatan}`" class="px-3 py-2 text-xs rounded-lg bg-opensimrs-50">
            <b>{{ r.namaKelurahan }}</b> · {{ JENIS_KEGIATAN_UKM[r.jenisKegiatan] ?? r.jenisKegiatan }}: {{ r.jumlahKegiatan }} kegiatan, {{ r.totalPeserta }} peserta
          </div>
        </div>
      </template>
    </Card>
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Kegiatan UKM & Luar Gedung</h1>
          <CustomTextfield v-model="filterPeriode" label="Periode (YYYY-MM)" placeholder="2026-01" :maxLength="7" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Kegiatan" @click="buka()" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 50rem">
          <Column header="No." headerClass="bg-opensimrs-50" class="w-[50px]">
            <template #body="{ index }">{{ (page - 1) * limit + index + 1 }}</template>
          </Column>
          <Column header="Jenis Kegiatan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ JENIS_KEGIATAN_UKM[d.jenisKegiatan] ?? d.jenisKegiatan }}</template>
          </Column>
          <Column header="Kelurahan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.namaKelurahan }}</template>
          </Column>
          <Column header="Tanggal" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.tanggalPelaksanaan }}</template>
          </Column>
          <Column header="Pelaksana" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.pelaksana ?? "-" }}</template>
          </Column>
          <Column header="Jumlah Sasaran" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.jumlahSasaran }}</template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[110px]">
            <template #body="{ data: d }">
              <div class="flex gap-2">
                <CustomButton v-if="boleh('UPDATE')" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="buka(d)" />
                <CustomButton v-if="boleh('DELETE')" icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="konfirmasiHapus(d)" />
              </div>
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

    <CustomDialog v-model:visible="dialog" width="640px">
      <template #header>{{ form.uuid ? "Ubah" : "Catat" }} Kegiatan UKM</template>
      <template #body>
        <div class="flex flex-col gap-4 pt-4">
          <div class="grid grid-cols-2 gap-4">
            <CustomSelect v-model="form.jenisKegiatan" label="Jenis Kegiatan" :options="opsi(JENIS_KEGIATAN_UKM)" optionValue="value" optionLabel="label" :clearable="false" :showFilter="false" />
            <CustomDatePicker v-model="form.tanggalPelaksanaan" label="Tanggal Pelaksanaan" required />
          </div>
          <div>
            <div class="mb-1 text-sm font-semibold">Kelurahan</div>
            <div v-if="kelurahanTerpilih" class="flex items-center justify-between p-3 rounded-lg bg-opensimrs-50">
              <span class="text-sm">{{ kelurahanTerpilih.name }}</span>
              <CustomButton label="Ganti" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="kelurahanTerpilih = null" />
            </div>
            <div v-else class="flex flex-col gap-2">
              <div class="flex gap-2">
                <InputText v-model="kataKelurahan" placeholder="Cari nama kelurahan" class="text-sm grow" @keydown.enter="cariKelurahan" />
                <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariKelurahan" />
              </div>
              <div v-if="hasilKelurahan.length" class="overflow-auto border rounded-lg max-h-[140px] border-grey-75">
                <div v-for="k in hasilKelurahan" :key="k.code" class="px-3 py-2 text-sm border-b cursor-pointer border-grey-75 hover:bg-opensimrs-50" @click="kelurahanTerpilih = k">
                  {{ k.name }}
                </div>
              </div>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <CustomTextfield v-model="form.pelaksana" label="Pelaksana (opsional)" />
            <CustomTextfield v-model.number="form.jumlahSasaran" label="Jumlah Sasaran/Peserta" type="number" />
            <CustomTextArea v-model="form.catatan" label="Catatan (opsional)" class="col-span-2" />
          </div>
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

    <CustomDialog v-model:visible="dialogHapus" width="420px" headerBg="bg-danger-300">
      <template #header>Hapus Kegiatan</template>
      <template #body>
        <div class="pt-4 text-normal">Hapus kegiatan <b>{{ JENIS_KEGIATAN_UKM[akanDihapus?.jenisKegiatan] ?? akanDihapus?.jenisKegiatan }}</b> di <b>{{ akanDihapus?.namaKelurahan }}</b>?</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogHapus = false" />
          <CustomButton label="Hapus" icon="PhTrash" backgroundColor="bg-danger-300" @click="hapus" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
