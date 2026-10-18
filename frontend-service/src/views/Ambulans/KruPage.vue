<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { usePegawaiStore } from "@/stores/datamaster/pegawai";
import {
  PERAN_KRU,
  daftarKru,
  epochDariTanggal,
  hapusJadwalJagaKru,
  izinAmbulans,
  jadwalJagaKru,
  opsi,
  simpanKru,
  tambahJadwalJagaKru,
  waktuAmbulans,
} from "@/stores/penunjang/ambulans";

// Master kru (sopir & perawat pendamping) & jadwal jaga (KF-3).
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinAmbulans("Kru & Jadwal Jaga", aksi);
const pegawaiStore = usePegawaiStore();

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const filterPeran = ref("");
const filterAktif = ref("");

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarKru({ page: page.value, limit: limit.value, peran: filterPeran.value, aktif: filterAktif.value });
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

// ── Daftar pegawai (untuk dipilih sebagai kru)
const pegawaiOpsi = ref<any[]>([]);
const muatPegawai = async () => {
  const res = await pegawaiStore.getAktifApi();
  pegawaiOpsi.value = res?.payload ?? [];
};
onMounted(() => Promise.all([muat(), muatPegawai()]));

// ── Form kru (baru / ubah)
const dialog = ref(false);
const kosong = () => ({ uuid: "", pegawaiUuid: "", peran: "sopir", aktif: true });
const form = ref(kosong());
const galat = ref("");
const buka = (baris?: any) => {
  galat.value = "";
  form.value = baris ? { uuid: baris.uuid, pegawaiUuid: baris.pegawaiUuid, peran: baris.peran, aktif: baris.aktif } : kosong();
  dialog.value = true;
};
const simpan = async () => {
  const f = form.value;
  galat.value = "";
  if (!f.pegawaiUuid) return (galat.value = "Pegawai wajib dipilih");
  storeUtils.setLoading(true);
  try {
    const res = await simpanKru({ pegawaiUuid: f.pegawaiUuid, peran: f.peran, aktif: f.aktif }, f.uuid || undefined);
    if (res) {
      dialog.value = false;
      muat();
    } else galat.value = "Gagal menyimpan kru";
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Jadwal jaga
const dialogJadwal = ref(false);
const kruDipilih = ref<any>(null);
const jadwal = ref<any[]>([]);
const muatJadwal = async (kru: any) => {
  kruDipilih.value = kru;
  const res = await jadwalJagaKru(kru.uuid, {});
  jadwal.value = res?.payload ?? [];
  dialogJadwal.value = true;
};
const formJadwal = ref({ waktuMulai: null as Date | null, waktuSelesai: null as Date | null });
const galatJadwal = ref("");
const tambahJadwal = async () => {
  galatJadwal.value = "";
  const f = formJadwal.value;
  if (!f.waktuMulai || !f.waktuSelesai) return (galatJadwal.value = "Waktu mulai dan selesai wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await tambahJadwalJagaKru(kruDipilih.value.uuid, { waktu_mulai: epochDariTanggal(f.waktuMulai)!, waktu_selesai: epochDariTanggal(f.waktuSelesai)! });
    if (res?.payload) {
      formJadwal.value = { waktuMulai: null, waktuSelesai: null };
      await muatJadwal(kruDipilih.value);
    } else galatJadwal.value = "Gagal menyimpan jadwal";
  } finally {
    storeUtils.setLoading(false);
  }
};
const hapusJadwal = async (jadwalUuid: string) => {
  const res = await hapusJadwalJagaKru(kruDipilih.value.uuid, jadwalUuid);
  if (res) await muatJadwal(kruDipilih.value);
};
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Master Kru</h1>
          <CustomSelect v-model="filterPeran" label="Peran" placeHolder="Semua" :options="opsi(PERAN_KRU)" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Kru" @click="buka()" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 50rem">
          <Column header="No." headerClass="bg-opensimrs-50" class="w-[50px]">
            <template #body="{ index }">{{ index + 1 }}</template>
          </Column>
          <Column field="namaPegawai" header="Nama Pegawai" headerClass="bg-opensimrs-50" />
          <Column header="Peran" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ PERAN_KRU[d.peran] ?? d.peran }}</template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><span :class="d.aktif ? 'text-mint-400' : 'text-grey-300'">{{ d.aktif ? "Aktif" : "Nonaktif" }}</span></template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[180px]">
            <template #body="{ data: d }">
              <div class="flex gap-2">
                <CustomButton label="Jadwal Jaga" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="muatJadwal(d)" />
                <CustomButton v-if="boleh('UPDATE')" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="buka(d)" />
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

    <CustomDialog v-model:visible="dialog" width="520px">
      <template #header>{{ form.uuid ? "Ubah" : "Tambah" }} Kru</template>
      <template #body>
        <div class="flex flex-col gap-4 pt-4">
          <CustomSelect
            v-model="form.pegawaiUuid"
            label="Pegawai"
            placeHolder="Pilih pegawai"
            :options="pegawaiOpsi"
            optionValue="uuid"
            optionLabel="name"
            :disabled="!!form.uuid"
            required
          />
          <CustomSelect v-model="form.peran" label="Peran" :options="opsi(PERAN_KRU)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" required />
          <CustomSwitch v-model="form.aktif" label="Status" sideLabel="Nonaktif" sideLabelTrue="Aktif" />
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

    <CustomDialog v-model:visible="dialogJadwal" width="640px">
      <template #header>Jadwal Jaga — {{ kruDipilih?.namaPegawai }}</template>
      <template #body>
        <div class="flex flex-col gap-4 pt-4">
          <div v-if="boleh('CREATE')" class="grid grid-cols-5 gap-2 p-3 border rounded-lg border-grey-100">
            <CustomDatePicker v-model="formJadwal.waktuMulai" label="Mulai" showTime class="col-span-2" />
            <CustomDatePicker v-model="formJadwal.waktuSelesai" label="Selesai" showTime class="col-span-2" />
            <CustomButton label="Tambah" class="self-end" @click="tambahJadwal" />
          </div>
          <div v-if="galatJadwal" class="text-sm text-danger-300">{{ galatJadwal }}</div>
          <NoData v-if="!jadwal.length" />
          <DataTable v-else :value="jadwal" stripedRows class="text-xs">
            <Column header="Mulai" headerClass="bg-opensimrs-50">
              <template #body="{ data: j }">{{ waktuAmbulans(j.waktuMulai) }}</template>
            </Column>
            <Column header="Selesai" headerClass="bg-opensimrs-50">
              <template #body="{ data: j }">{{ waktuAmbulans(j.waktuSelesai) }}</template>
            </Column>
            <Column header="" headerClass="bg-opensimrs-50" class="w-[90px]">
              <template #body="{ data: j }">
                <CustomButton v-if="boleh('DELETE')" icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="hapusJadwal(j.uuid)" />
              </template>
            </Column>
          </DataTable>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogJadwal = false" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
