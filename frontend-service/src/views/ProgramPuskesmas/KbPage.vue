<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { cariPasienPkm, daftarKbPkm, hapusKbPkm, izinPkm, keTanggal, simpanKbPkm } from "@/stores/programPuskesmas/programPuskesmas";

// Pelayanan & kohort KB (KF-6..KF-8): setiap pelayanan yang disimpan otomatis menjadi kohort KB.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinPkm("KB", aksi);

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const hanyaTerlambat = ref(false);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarKbPkm({ page: page.value, limit: limit.value, kunjungan_ulang_lewat: hanyaTerlambat.value ? "1" : undefined });
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

const dialog = ref(false);
const kataPasien = ref("");
const hasilPasien = ref<any[]>([]);
const pasien = ref<any>(null);
const kosong = () => ({ uuid: "", metode: "", tanggalPelayanan: new Date(), rencanaKunjunganUlang: null as Date | null, efekSamping: "" });
const form = ref(kosong());
const galat = ref("");
const buka = (baris?: any) => {
  galat.value = "";
  kataPasien.value = "";
  hasilPasien.value = [];
  if (baris) {
    pasien.value = { uuid: baris.patientUuid, name: baris.namaPasien, noRm: baris.noRm };
    form.value = {
      uuid: baris.uuid,
      metode: baris.metode,
      tanggalPelayanan: new Date(baris.tanggalPelayanan),
      rencanaKunjunganUlang: baris.rencanaKunjunganUlang ? new Date(baris.rencanaKunjunganUlang) : null,
      efekSamping: baris.efekSamping ?? "",
    };
  } else {
    pasien.value = null;
    form.value = kosong();
  }
  dialog.value = true;
};
const cariPasien = async () => {
  const res = await cariPasienPkm(kataPasien.value);
  hasilPasien.value = res?.payload ?? [];
};
const simpan = async () => {
  const f = form.value;
  if (!pasien.value) return (galat.value = "Pilih pasien terlebih dahulu");
  if (!f.metode?.trim() || !f.tanggalPelayanan) return (galat.value = "Metode dan tanggal pelayanan wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await simpanKbPkm(
      {
        patientUuid: pasien.value.uuid,
        metode: f.metode,
        tanggalPelayanan: keTanggal(f.tanggalPelayanan),
        rencanaKunjunganUlang: f.rencanaKunjunganUlang ? keTanggal(f.rencanaKunjunganUlang) : null,
        efekSamping: f.efekSamping || null,
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
  const res = await hapusKbPkm(akanDihapus.value.uuid);
  if (res) {
    dialogHapus.value = false;
    muat();
  }
};

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Pelayanan & Kohort KB</h1>
          <CustomSwitch v-model="hanyaTerlambat" label="Kunjungan ulang lewat" @update:modelValue="muat" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Pelayanan KB" @click="buka()" />
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
          <Column field="metode" header="Metode" headerClass="bg-opensimrs-50" />
          <Column header="Tanggal Pelayanan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.tanggalPelayanan }}</template>
          </Column>
          <Column header="Rencana Kunjungan Ulang" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span :class="d.terlambatKunjunganUlang ? 'text-danger-300 font-semibold' : ''">{{ d.rencanaKunjunganUlang ?? "-" }}</span>
            </template>
          </Column>
          <Column header="Efek Samping" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.efekSamping ?? "-" }}</template>
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
      <template #header>{{ form.uuid ? "Ubah" : "Catat" }} Pelayanan KB</template>
      <template #body>
        <div class="flex flex-col gap-4 pt-4">
          <div v-if="!form.uuid">
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
                <div v-for="p in hasilPasien" :key="p.uuid" class="flex justify-between px-3 py-2 text-sm border-b cursor-pointer border-grey-75 hover:bg-opensimrs-50" @click="pasien = p">
                  <span><b>{{ p.name }}</b> · {{ p.noRm }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <CustomTextfield v-model="form.metode" label="Metode KB" placeholder="mis. Suntik 3 Bulan, IUD, Implan" required class="col-span-2" />
            <CustomDatePicker v-model="form.tanggalPelayanan" label="Tanggal Pelayanan" required />
            <CustomDatePicker v-model="form.rencanaKunjunganUlang" label="Rencana Kunjungan Ulang (opsional)" />
            <CustomTextArea v-model="form.efekSamping" label="Efek Samping (opsional)" class="col-span-2" />
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
      <template #header>Hapus Pelayanan KB</template>
      <template #body>
        <div class="pt-4 text-normal">Hapus catatan pelayanan KB <b>{{ akanDihapus?.namaPasien }}</b>?</div>
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
