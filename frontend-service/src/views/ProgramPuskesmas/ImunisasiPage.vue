<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  STATUS_KIRIM_SATUSEHAT,
  cariPasienPkm,
  daftarImunisasiPkm,
  daftarJenisVaksinPkm,
  izinPkm,
  kirimUlangSatuSehatPkm,
  riwayatImunisasiPkm,
  simpanImunisasiPkm,
  waktuPkm,
} from "@/stores/programPuskesmas/programPuskesmas";

// Pencatatan imunisasi (KF-9..KF-12): riwayat ditampilkan sebelum simpan (peringatan dosis berulang, KT-5
// — tidak memblokir paksa), lalu sistem menampilkan jadwal berikutnya & status imunisasi dasar lengkap.
const router = useRouter();
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinPkm("Imunisasi", aksi);

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarImunisasiPkm({ page: page.value, limit: limit.value });
    data.value = res?.payload?.data ?? [];
    total.value = res?.payload?.pagination?.total ?? 0;
  } finally {
    storeUtils.setLoading(false);
  }
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

// ── Dialog catat imunisasi
const dialog = ref(false);
const kataPasien = ref("");
const hasilPasien = ref<any[]>([]);
const pasien = ref<any>(null);
const riwayat = ref<any[]>([]);
const vaksin = ref<any[]>([]);
const form = ref({ jenisVaksinUuid: "", tanggalPemberian: new Date(), catatan: "" });
const galat = ref("");
const hasilSimpan = ref<any>(null);
const buka = async () => {
  kataPasien.value = "";
  hasilPasien.value = [];
  pasien.value = null;
  riwayat.value = [];
  form.value = { jenisVaksinUuid: "", tanggalPemberian: new Date(), catatan: "" };
  galat.value = "";
  hasilSimpan.value = null;
  if (!vaksin.value.length) vaksin.value = (await daftarJenisVaksinPkm({ aktif: "1" }))?.payload ?? [];
  dialog.value = true;
};
const cariPasien = async () => {
  const res = await cariPasienPkm(kataPasien.value);
  hasilPasien.value = res?.payload ?? [];
};
const pilihPasien = async (p: any) => {
  pasien.value = p;
  const res = await riwayatImunisasiPkm(p.uuid);
  riwayat.value = res?.payload ?? [];
};
const simpan = async () => {
  galat.value = "";
  if (!pasien.value) return (galat.value = "Pilih pasien terlebih dahulu");
  if (!form.value.jenisVaksinUuid) return (galat.value = "Pilih jenis vaksin");
  storeUtils.setLoading(true);
  try {
    const res = await simpanImunisasiPkm({
      patientUuid: pasien.value.uuid,
      jenisVaksinUuid: form.value.jenisVaksinUuid,
      tanggalPemberian: form.value.tanggalPemberian.toISOString().slice(0, 10),
      catatan: form.value.catatan || null,
    });
    if (res?.payload) {
      hasilSimpan.value = res.payload;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Kirim ulang SATUSEHAT
const kirimUlang = async (uuid: string) => {
  const res = await kirimUlangSatuSehatPkm(uuid);
  if (res?.payload) muat();
};

const kePengaturanVaksin = () => router.push("/program-puskesmas/datamaster/jenis-vaksin");

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Imunisasi</h1>
          <CustomButton
            v-if="izinPkm('Datamaster', 'READ', 'Jenis Vaksin & Jadwal')"
            label="Jenis Vaksin & Jadwal"
            icon="PhGear"
            outlined
            borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300"
            @click="kePengaturanVaksin"
          />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Catat Imunisasi" @click="buka" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 50rem">
          <Column header="No." headerClass="bg-opensimrs-50" class="w-[50px]">
            <template #body="{ index }">{{ (page - 1) * limit + index + 1 }}</template>
          </Column>
          <Column header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><b>{{ d.namaPasien }}</b> · {{ d.noRm }}</template>
          </Column>
          <Column header="Vaksin" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.jenisVaksinNama }}</template>
          </Column>
          <Column header="Tanggal Pemberian" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.tanggalPemberian }}</template>
          </Column>
          <Column header="Status SATUSEHAT" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span>{{ STATUS_KIRIM_SATUSEHAT[d.statusKirimSatusehat] ?? d.statusKirimSatusehat }}</span>
              <CustomButton
                v-if="d.statusKirimSatusehat === 'gagal' && izinPkm('Imunisasi', 'KIRIM SATUSEHAT')"
                label="Kirim Ulang"
                size="small"
                class="ml-2"
                outlined
                borderColor="border-opensimrs-300"
                textColor="text-opensimrs-300"
                @click="kirimUlang(d.uuid)"
              />
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

    <CustomDialog v-model:visible="dialog" width="720px">
      <template #header>Catat Imunisasi</template>
      <template #body>
        <div class="flex flex-col gap-4 pt-4">
          <div>
            <div class="mb-1 text-sm font-semibold">Pasien</div>
            <div v-if="pasien" class="flex items-center justify-between p-3 rounded-lg bg-opensimrs-50">
              <div class="text-sm"><b>{{ pasien.name }}</b> · {{ pasien.noRm }}</div>
              <CustomButton label="Ganti" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="pasien = null" />
            </div>
            <div v-else class="flex flex-col gap-2">
              <div class="flex gap-2">
                <InputText v-model="kataPasien" placeholder="Cari nama / No. RM / NIK pasien terdaftar" class="text-sm grow" @keydown.enter="cariPasien" />
                <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariPasien" />
              </div>
              <div v-if="hasilPasien.length" class="overflow-auto border rounded-lg max-h-[160px] border-grey-75">
                <div v-for="p in hasilPasien" :key="p.uuid" class="flex justify-between px-3 py-2 text-sm border-b cursor-pointer border-grey-75 hover:bg-opensimrs-50" @click="pilihPasien(p)">
                  <span><b>{{ p.name }}</b> · {{ p.noRm }}</span>
                </div>
              </div>
            </div>
          </div>
          <div v-if="pasien" class="text-xs text-grey-400">
            <span v-if="riwayat.length">Riwayat imunisasi: {{ riwayat.map((r) => `${r.jenisVaksinNama} (${r.tanggalPemberian})`).join(", ") }}</span>
            <span v-else>Belum ada riwayat imunisasi pada pasien ini.</span>
          </div>
          <div v-if="pasien" class="grid grid-cols-2 gap-4">
            <CustomSelect v-model="form.jenisVaksinUuid" label="Jenis Vaksin" :options="vaksin" optionValue="uuid" optionLabel="nama" :clearable="false" class="col-span-2" />
            <CustomDatePicker v-model="form.tanggalPemberian" label="Tanggal Pemberian" required />
            <CustomTextArea v-model="form.catatan" label="Catatan (opsional)" class="col-span-2" />
          </div>
          <div v-if="hasilSimpan" class="p-3 text-sm rounded-lg bg-mint-50 text-mint-400">
            Imunisasi tersimpan.
            <span v-if="hasilSimpan.jadwalBerikutnya">Jadwal berikutnya: <b>{{ hasilSimpan.jadwalBerikutnya.nama }}</b>.</span>
            <span v-else>Tidak ada jadwal vaksin berikutnya pada kelompok sasaran ini.</span>
            Status imunisasi dasar lengkap: <b>{{ hasilSimpan.imunisasiDasarLengkap ? "Lengkap" : "Belum Lengkap" }}</b>.
          </div>
          <div v-if="galat" class="text-sm text-danger-300">{{ galat }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
          <CustomButton v-if="!hasilSimpan" label="Simpan" icon="PhFloppyDisk" @click="simpan" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
