<script setup lang="ts">
import { onMounted, ref } from "vue";
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
  JENIS_ARMADA,
  STATUS_ARMADA,
  catatServisArmada,
  daftarArmada,
  detailArmada,
  epochDariTanggal,
  gayaStatusArmada,
  izinAmbulans,
  opsi,
  simpanArmada,
  tanggalDariEpoch,
  ubahStatusArmada,
  waktuAmbulans,
} from "@/stores/penunjang/ambulans";

// Master armada ambulans: data kendaraan, status (siap/bertugas/servis), jadwal servis/pajak-STNK, & riwayat servis (KF-2/KF-16).
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinAmbulans("Armada", aksi);
const bolehServis = (aksi: string) => izinAmbulans("Servis Armada", aksi);

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");
const filterStatus = ref("");
const filterJenis = ref("");

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarArmada({ page: page.value, limit: limit.value, cari: cari.value.trim(), status: filterStatus.value, jenis: filterJenis.value });
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
onMounted(muat);

// ── Form armada (baru / ubah)
const dialog = ref(false);
const modeUbah = ref(false);
const kosong = () => ({ uuid: "", nomorPolisi: "", jenis: "transport", kelengkapan: "", jadwalServisBerikutnya: null as Date | null, pajakStnkBerlakuSampai: null as Date | null });
const form = ref(kosong());
const galat = ref("");
const buka = (baris?: any) => {
  galat.value = "";
  form.value = baris
    ? {
        uuid: baris.uuid,
        nomorPolisi: baris.nomorPolisi,
        jenis: baris.jenis,
        kelengkapan: baris.kelengkapan ? JSON.stringify(baris.kelengkapan) : "",
        jadwalServisBerikutnya: tanggalDariEpoch(baris.jadwalServisBerikutnya),
        pajakStnkBerlakuSampai: tanggalDariEpoch(baris.pajakStnkBerlakuSampai),
      }
    : kosong();
  dialog.value = true;
};
const simpan = async () => {
  const f = form.value;
  galat.value = "";
  if (!f.nomorPolisi.trim()) return (galat.value = "Nomor polisi wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await simpanArmada(
      {
        nomorPolisi: f.nomorPolisi.trim(),
        jenis: f.jenis,
        kelengkapan: f.kelengkapan.trim() || null,
        jadwalServisBerikutnya: epochDariTanggal(f.jadwalServisBerikutnya),
        pajakStnkBerlakuSampai: epochDariTanggal(f.pajakStnkBerlakuSampai),
      },
      f.uuid || undefined,
    );
    if (res) {
      dialog.value = false;
      muat();
    } else galat.value = "Gagal menyimpan armada";
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Ubah status & riwayat servis
const dialogDetail = ref(false);
const detail = ref<any>(null);
const bukaDetail = async (uuid: string) => {
  storeUtils.setLoading(true);
  try {
    const res = await detailArmada(uuid);
    if (res?.payload) {
      detail.value = res.payload;
      dialogDetail.value = true;
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const statusBaru = ref("siap");
const catatanStatus = ref("");
const ubahStatus = async () => {
  if (!detail.value) return;
  storeUtils.setLoading(true);
  try {
    const res = await ubahStatusArmada(detail.value.uuid, statusBaru.value, catatanStatus.value.trim() || undefined);
    if (res?.payload) {
      detail.value = { ...detail.value, ...res.payload };
      catatanStatus.value = "";
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const dialogServis = ref(false);
const formServis = ref({ tanggalServis: new Date(), uraian: "", workOrderUuid: "" });
const bukaServis = () => {
  formServis.value = { tanggalServis: new Date(), uraian: "", workOrderUuid: "" };
  dialogServis.value = true;
};
const simpanServis = async () => {
  if (!detail.value || !formServis.value.uraian.trim()) return;
  storeUtils.setLoading(true);
  try {
    const res = await catatServisArmada(detail.value.uuid, {
      tanggalServis: epochDariTanggal(formServis.value.tanggalServis),
      uraian: formServis.value.uraian.trim(),
      workOrderUuid: formServis.value.workOrderUuid.trim() || undefined,
    });
    if (res) {
      dialogServis.value = false;
      await bukaDetail(detail.value.uuid);
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Master Armada</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nomor polisi" :maxLength="20" @keydown.enter="cariData" />
          <CustomSelect v-model="filterStatus" label="Status" placeHolder="Semua" :options="opsi(STATUS_ARMADA)" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomSelect v-model="filterJenis" label="Jenis" placeHolder="Semua" :options="opsi(JENIS_ARMADA)" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Armada" @click="buka()" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs cursor-pointer" scrollable scrollHeight="flex" tableStyle="min-width: 50rem" @rowClick="bukaDetail($event.data.uuid)">
          <Column header="No." headerClass="bg-opensimrs-50" class="w-[50px]">
            <template #body="{ index }">{{ index + 1 }}</template>
          </Column>
          <Column field="nomorPolisi" header="Nomor Polisi" headerClass="bg-opensimrs-50" />
          <Column header="Jenis" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ JENIS_ARMADA[d.jenis] ?? d.jenis }}</template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaStatusArmada(d.status).bg, gayaStatusArmada(d.status).text]">{{ gayaStatusArmada(d.status).label }}</span>
            </template>
          </Column>
          <Column header="Jadwal Servis Berikutnya" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ waktuAmbulans(d.jadwalServisBerikutnya, true) }}</template>
          </Column>
          <Column header="Pajak/STNK Berlaku s.d." headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ waktuAmbulans(d.pajakStnkBerlakuSampai, true) }}</template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[70px]">
            <template #body="{ data: d }">
              <CustomButton v-if="boleh('UPDATE')" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click.stop="buka(d)" />
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
      <template #header>{{ form.uuid ? "Ubah" : "Tambah" }} Armada</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomTextfield v-model="form.nomorPolisi" label="Nomor Polisi" placeholder="mis. B 1234 AM" required :maxLength="20" />
          <CustomSelect v-model="form.jenis" label="Jenis Armada" :options="opsi(JENIS_ARMADA)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" required />
          <CustomDatePicker v-model="form.jadwalServisBerikutnya" label="Jadwal Servis Berikutnya" />
          <CustomDatePicker v-model="form.pajakStnkBerlakuSampai" label="Pajak/STNK Berlaku Sampai" />
          <CustomTextArea v-model="form.kelengkapan" label="Kelengkapan (opsional)" placeholder="mis. tabung oksigen, brankar, defibrillator" class="col-span-2" />
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

    <!-- Detail armada: ubah status & riwayat servis -->
    <CustomDialog v-model:visible="dialogDetail" width="760px">
      <template #header>Armada {{ detail?.nomorPolisi }}</template>
      <template #body>
        <div v-if="detail" class="flex flex-col gap-4 pt-4 text-sm">
          <div class="grid grid-cols-2 gap-x-6 gap-y-1">
            <div><span class="text-grey-400">Jenis:</span> {{ JENIS_ARMADA[detail.jenis] ?? detail.jenis }}</div>
            <div>
              <span class="text-grey-400">Status:</span>
              <span class="px-2 py-0.5 ml-1 rounded-full text-xs font-semibold" :class="[gayaStatusArmada(detail.status).bg, gayaStatusArmada(detail.status).text]">{{ gayaStatusArmada(detail.status).label }}</span>
            </div>
            <div><span class="text-grey-400">Jadwal servis:</span> {{ waktuAmbulans(detail.jadwalServisBerikutnya, true) }}</div>
            <div><span class="text-grey-400">Pajak/STNK s.d.:</span> {{ waktuAmbulans(detail.pajakStnkBerlakuSampai, true) }}</div>
            <div v-if="detail.kelengkapan" class="col-span-2"><span class="text-grey-400">Kelengkapan:</span> {{ detail.kelengkapan }}</div>
          </div>

          <div v-if="boleh('UBAH STATUS')" class="p-3 border rounded-lg border-grey-100">
            <div class="mb-2 text-sm font-semibold">Ubah Status</div>
            <div class="grid grid-cols-3 gap-3">
              <CustomSelect v-model="statusBaru" label="Status Baru" :options="opsi(STATUS_ARMADA)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
              <CustomTextfield v-model="catatanStatus" label="Catatan (opsional)" class="col-span-2" :maxLength="255" />
            </div>
            <div class="flex justify-end mt-2">
              <CustomButton label="Simpan Status" size="small" @click="ubahStatus" />
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-semibold">Riwayat Servis</h3>
              <CustomButton v-if="bolehServis('CREATE')" icon="PhPlus" label="Catat Servis" size="small" @click="bukaServis" />
            </div>
            <NoData v-if="!detail.riwayatServis?.length" />
            <DataTable v-else :value="detail.riwayatServis" stripedRows class="text-xs">
              <Column header="Tanggal" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ waktuAmbulans(r.tanggalServis, true) }}</template>
              </Column>
              <Column field="uraian" header="Uraian" headerClass="bg-opensimrs-50" />
              <Column header="Work Order" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ r.workOrderUuid ?? "-" }}</template>
              </Column>
              <Column header="Dicatat Oleh" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ r.dicatatOleh ?? "-" }}</template>
              </Column>
            </DataTable>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogDetail = false" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogServis" width="560px">
      <template #header>Catat Servis — {{ detail?.nomorPolisi }}</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <CustomDatePicker v-model="formServis.tanggalServis" label="Tanggal Servis" showTime required />
          <CustomTextArea v-model="formServis.uraian" label="Uraian" placeholder="mis. ganti oli & filter, servis berkala 10.000 km" required />
          <CustomTextfield v-model="formServis.workOrderUuid" label="Work Order (opsional, bila modul Sarana & Prasarana aktif)" :maxLength="255" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogServis = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanServis" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
