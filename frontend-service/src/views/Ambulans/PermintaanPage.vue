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
  JENIS_LAYANAN,
  PRIORITAS,
  STATUS_PENERUSAN,
  STATUS_PERMINTAAN,
  SUMBER_PERMINTAAN,
  batalPermintaan,
  buatPermintaan,
  daftarPermintaan,
  detailPermintaan as muatDetailPermintaan,
  epochDariTanggal,
  gayaStatusPermintaan,
  izinAmbulans,
  opsi,
  rupiahAmbulans,
  teruskanBiaya,
  waktuAmbulans,
} from "@/stores/penunjang/ambulans";

// Permintaan layanan ambulans: pembuatan, daftar, detail (penugasan+perjalanan+biaya), & pembatalan sebelum
// penugasan (KF-4/KF-5/KF-17). Penugasan & pencatatan perjalanan dilakukan di halaman Penugasan/Perjalanan.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinAmbulans("Permintaan", aksi);
const bolehBiaya = (aksi: string) => izinAmbulans("Biaya & Kuitansi", aksi);
const bolehPendamping = izinAmbulans("Catatan Pendamping", "READ");

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");
const filterStatus = ref("");
const filterJenis = ref("");
const filterPrioritas = ref("");

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarPermintaan({ page: page.value, limit: limit.value, cari: cari.value.trim(), status: filterStatus.value, jenis_layanan: filterJenis.value, prioritas: filterPrioritas.value });
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

// ── Form permintaan baru
const dialog = ref(false);
const kosong = () => ({
  sumber: "igd",
  jenisLayanan: "rujukan",
  prioritas: "biasa",
  patientUuid: "",
  noReg: "",
  lokasiJemput: "",
  tujuan: "",
  waktuPermintaan: new Date(),
});
const form = ref(kosong());
const galat = ref("");
const buka = () => {
  galat.value = "";
  form.value = kosong();
  dialog.value = true;
};
const simpan = async () => {
  const f = form.value;
  galat.value = "";
  if (!f.tujuan.trim()) return (galat.value = "Tujuan wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await buatPermintaan({
      sumber: f.sumber,
      jenisLayanan: f.jenisLayanan,
      prioritas: f.prioritas,
      patientUuid: f.patientUuid.trim() || undefined,
      noReg: f.noReg.trim() || undefined,
      lokasiJemput: f.lokasiJemput.trim() || undefined,
      tujuan: f.tujuan.trim(),
      waktuPermintaan: epochDariTanggal(f.waktuPermintaan),
    });
    if (res?.payload) {
      dialog.value = false;
      muat();
    } else galat.value = "Gagal menyimpan permintaan";
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Detail permintaan
const dialogDetail = ref(false);
const detail = ref<any>(null);
const bukaDetail = async (uuid: string) => {
  storeUtils.setLoading(true);
  try {
    const res = await muatDetailPermintaan(uuid);
    if (res?.payload) {
      detail.value = res.payload;
      dialogDetail.value = true;
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const muatUlangDetail = async () => {
  if (!detail.value) return;
  const res = await muatDetailPermintaan(detail.value.uuid);
  if (res?.payload) detail.value = res.payload;
};

// ── Batalkan permintaan (hanya sebelum penugasan)
const dialogBatal = ref(false);
const alasanBatal = ref("");
const batalkan = async () => {
  if (!detail.value || !alasanBatal.value.trim()) return;
  storeUtils.setLoading(true);
  try {
    const res = await batalPermintaan(detail.value.uuid, alasanBatal.value.trim());
    if (res?.payload) {
      dialogBatal.value = false;
      alasanBatal.value = "";
      detail.value = res.payload;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Teruskan biaya (penerusan tagihan / kuitansi umum)
const teruskan = async () => {
  if (!detail.value?.biaya?.uuid) return;
  storeUtils.setLoading(true);
  try {
    await teruskanBiaya(detail.value.biaya.uuid);
    await muatUlangDetail();
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
          <h1 class="toolbar-heading text-opensimrs-300">Permintaan Layanan</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="No. Permintaan / Pasien / Tujuan" :maxLength="100" @keydown.enter="cariData" />
          <CustomSelect v-model="filterStatus" label="Status" placeHolder="Semua" :options="opsi(STATUS_PERMINTAAN)" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomSelect v-model="filterJenis" label="Jenis Layanan" placeHolder="Semua" :options="opsi(JENIS_LAYANAN)" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomSelect v-model="filterPrioritas" label="Prioritas" placeHolder="Semua" :options="opsi(PRIORITAS)" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Permintaan" @click="buka" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs cursor-pointer" scrollable scrollHeight="flex" tableStyle="min-width: 60rem" @rowClick="bukaDetail($event.data.uuid)">
          <Column header="No. Permintaan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.nomorPermintaan }}</div>
              <div class="text-grey-400">{{ waktuAmbulans(d.waktuPermintaan) }}</div>
            </template>
          </Column>
          <Column header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.namaPasien ?? "Umum (tanpa pasien)" }}</template>
          </Column>
          <Column header="Jenis Layanan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ JENIS_LAYANAN[d.jenisLayanan] ?? d.jenisLayanan }}</template>
          </Column>
          <Column header="Prioritas" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ PRIORITAS[d.prioritas] ?? d.prioritas }}</template>
          </Column>
          <Column field="tujuan" header="Tujuan" headerClass="bg-opensimrs-50" />
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaStatusPermintaan(d.status).bg, gayaStatusPermintaan(d.status).text]">{{ gayaStatusPermintaan(d.status).label }}</span>
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

    <!-- Form permintaan baru -->
    <CustomDialog v-model:visible="dialog" width="680px">
      <template #header>Permintaan Ambulans Baru</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomSelect v-model="form.sumber" label="Sumber" :options="opsi(SUMBER_PERMINTAAN)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" required />
          <CustomSelect v-model="form.jenisLayanan" label="Jenis Layanan" :options="opsi(JENIS_LAYANAN)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" required />
          <CustomSelect v-model="form.prioritas" label="Prioritas" :options="opsi(PRIORITAS)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" required />
          <CustomDatePicker v-model="form.waktuPermintaan" label="Waktu Permintaan" showTime required />
          <CustomTextfield v-model="form.noReg" label="No. Registrasi Kunjungan (opsional)" placeholder="RJ/RI/IGD" :maxLength="255" />
          <CustomTextfield v-model="form.patientUuid" label="UUID Pasien (opsional)" placeholder="diisi otomatis bila No. Reg valid" :maxLength="255" :disabled="!!form.noReg.trim()" />
          <CustomTextfield v-model="form.lokasiJemput" label="Lokasi Jemput (opsional)" class="col-span-2" :maxLength="255" />
          <CustomTextArea v-model="form.tujuan" label="Tujuan" placeholder="mis. RSUD Contoh / Rumah pasien" class="col-span-2" required />
        </div>
        <div class="mt-2 text-xs text-grey-400">Kosongkan No. Reg dan UUID Pasien untuk layanan umum (tanpa pasien terdaftar); biaya akan diterbitkan sebagai kuitansi.</div>
        <div v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpan" />
        </div>
      </template>
    </CustomDialog>

    <!-- Detail permintaan -->
    <CustomDialog v-model:visible="dialogDetail" width="860px">
      <template #header>Permintaan {{ detail?.nomorPermintaan }}</template>
      <template #body>
        <div v-if="detail" class="flex flex-col gap-4 pt-4 text-sm">
          <div class="grid grid-cols-2 gap-x-6 gap-y-1">
            <div><span class="text-grey-400">Sumber:</span> {{ SUMBER_PERMINTAAN[detail.sumber] ?? detail.sumber }}</div>
            <div>
              <span class="text-grey-400">Status:</span>
              <span class="px-2 py-0.5 ml-1 rounded-full text-xs font-semibold" :class="[gayaStatusPermintaan(detail.status).bg, gayaStatusPermintaan(detail.status).text]">{{ gayaStatusPermintaan(detail.status).label }}</span>
            </div>
            <div><span class="text-grey-400">Jenis layanan:</span> {{ JENIS_LAYANAN[detail.jenisLayanan] ?? detail.jenisLayanan }}</div>
            <div><span class="text-grey-400">Prioritas:</span> {{ PRIORITAS[detail.prioritas] ?? detail.prioritas }}</div>
            <div><span class="text-grey-400">Waktu permintaan:</span> {{ waktuAmbulans(detail.waktuPermintaan) }}</div>
            <div><span class="text-grey-400">Pasien:</span> {{ detail.namaPasien ? `${detail.namaPasien} (${detail.noRm})` : "Umum (tanpa pasien)" }}</div>
            <div><span class="text-grey-400">Lokasi jemput:</span> {{ detail.lokasiJemput ?? "-" }}</div>
            <div><span class="text-grey-400">Tujuan:</span> {{ detail.tujuan }}</div>
            <div v-if="detail.status === 'batal'" class="col-span-2">
              <span class="text-grey-400">Alasan batal:</span> {{ detail.alasanBatal }} — {{ detail.dibatalkanOleh }}, {{ waktuAmbulans(detail.dibatalkanPada) }}
            </div>
          </div>

          <div v-if="detail.penugasan?.length">
            <h3 class="mb-2 font-semibold">Riwayat Penugasan & Perjalanan</h3>
            <div v-for="pn in detail.penugasan" :key="pn.uuid" class="p-3 mb-2 border rounded-lg border-grey-100">
              <div class="flex items-center justify-between">
                <div class="font-semibold">{{ pn.nomorPolisi }} ({{ pn.jenisArmada }})</div>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="pn.status === 'aktif' ? 'bg-[#E0EAFF] text-[#3538CD]' : pn.status === 'batal' ? 'bg-[#FDE2E1] text-[#B42318]' : 'bg-[#D1FADF] text-[#027A48]'">
                  {{ pn.status }}
                </span>
              </div>
              <div class="text-xs text-grey-400">Ditugaskan {{ waktuAmbulans(pn.waktuPenugasan) }} oleh {{ pn.ditugaskanOleh }}</div>
              <div class="mt-1 text-xs">Kru: {{ (pn.kru ?? []).map((k: any) => `${k.namaPegawai} (${k.peran})`).join(", ") || "-" }}</div>
              <div v-if="pn.alasanBatal" class="text-xs text-danger-300">Dibatalkan: {{ pn.alasanBatal }}</div>
              <div v-if="pn.perjalanan" class="grid grid-cols-2 gap-x-4 mt-2 text-xs border-t pt-2 border-grey-75">
                <div>Berangkat: {{ waktuAmbulans(pn.perjalanan.berangkatPada) }}</div>
                <div>Tiba lokasi: {{ waktuAmbulans(pn.perjalanan.tibaLokasiPada) }}</div>
                <div>Berangkat tujuan: {{ waktuAmbulans(pn.perjalanan.berangkatTujuanPada) }}</div>
                <div>Tiba tujuan: {{ waktuAmbulans(pn.perjalanan.tibaTujuanPada) }}</div>
                <div>Kembali: {{ waktuAmbulans(pn.perjalanan.kembaliPada) }}</div>
                <div>Jarak: {{ pn.perjalanan.jarakKm ?? "-" }} km (km {{ pn.perjalanan.kmAwal ?? "-" }} → {{ pn.perjalanan.kmAkhir ?? "-" }})</div>
                <div>BBM: {{ pn.perjalanan.bbmNilai ?? "-" }} {{ pn.perjalanan.bbmSatuan ?? "" }}</div>
                <div v-if="bolehPendamping" class="col-span-2">Catatan pendamping: {{ pn.perjalanan.catatanPendamping ?? "-" }}</div>
              </div>
            </div>
          </div>

          <div v-if="detail.biaya" class="p-3 border rounded-lg border-grey-100">
            <h3 class="mb-1 font-semibold">Biaya Layanan</h3>
            <div class="text-xs">
              Status: <b>{{ STATUS_PENERUSAN[detail.biaya.statusPenerusan] ?? detail.biaya.statusPenerusan }}</b>
              <span v-if="detail.biaya.jumlah"> · {{ rupiahAmbulans(detail.biaya.jumlah) }}</span>
            </div>
            <div v-if="detail.biaya.pesanGalat" class="text-xs text-danger-300">{{ detail.biaya.pesanGalat }}</div>
            <div v-if="detail.biaya.referensiPembayaran" class="text-xs text-grey-400">Referensi: {{ detail.biaya.referensiPembayaran }}</div>
            <CustomButton
              v-if="bolehBiaya('TERUSKAN') && ['menunggu', 'gagal'].includes(detail.biaya.statusPenerusan)"
              label="Teruskan Biaya"
              size="small"
              class="mt-2"
              @click="teruskan"
            />
          </div>
          <div v-if="detail.kuitansi" class="p-3 border rounded-lg border-grey-100">
            <h3 class="mb-1 font-semibold">Kuitansi Umum</h3>
            <div class="text-xs">{{ detail.kuitansi.nomorKuitansi }} · {{ rupiahAmbulans(detail.kuitansi.jumlah) }} · {{ detail.kuitansi.status }}</div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton
            v-if="boleh('BATAL') && detail?.status === 'menunggu'"
            label="Batalkan Permintaan"
            outlined
            borderColor="border-danger-300"
            textColor="text-danger-300"
            @click="(alasanBatal = ''), (dialogBatal = true)"
          />
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogDetail = false" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogBatal" width="460px" headerBg="bg-danger-300">
      <template #header>Batalkan Permintaan {{ detail?.nomorPermintaan }}</template>
      <template #body>
        <div class="pt-4">
          <CustomTextfield v-model="alasanBatal" label="Alasan pembatalan" placeholder="mis. Pasien batal dirujuk" :maxLength="255" required />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogBatal = false" />
          <CustomButton label="Batalkan Permintaan" backgroundColor="bg-danger-300" @click="batalkan" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
