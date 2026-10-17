<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import DialogJadwalOk from "./Komponen/DialogJadwalOk.vue";
import { utilsStore } from "@/stores/utils";
import {
  JENIS_OPERASI,
  JK_OK,
  STATUS_ORDER_OK,
  buatOrderOk,
  daftarOrderOk,
  detailOrderOk,
  gayaOrderOk,
  izinOk,
  klarifikasiOrderOk,
  lengkapiOrderOk,
  umurOk,
  waktuOk,
} from "@/stores/penunjang/kamarOperasi";

// Daftar Tunggu OK: order operasi dari Plan asesmen RJ/RI/IGD (atau dibuat langsung di sini dengan No. Reg kunjungan).
// Order cito tampil di urutan teratas (sudah diurutkan backend); klarifikasi mengembalikan order ke dokter pemesan;
// jadwalkan membuka dialog penjadwalan (ruang, waktu, tim).
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinOk("Order Operasi", aksi);
const bolehJadwal = (aksi: string) => izinOk("Jadwal OK", aksi);

// ── Daftar & filter
const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");
const filterStatus = ref<string[]>([]);
const filterJenis = ref<string[]>([]);

const toggle = (grup: "status" | "jenis", nilai: string) => {
  const daftar = grup === "status" ? filterStatus : filterJenis;
  daftar.value = daftar.value.includes(nilai) ? daftar.value.filter((x) => x !== nilai) : [...daftar.value, nilai];
};

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarOrderOk({ page: page.value, limit: limit.value, cari: cari.value, status: filterStatus.value, jenis_operasi: filterJenis.value });
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
const reset = () => {
  cari.value = "";
  filterStatus.value = [];
  filterJenis.value = [];
  cariData();
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

// ── Detail
const detail = ref<any>(null);
const dialogDetail = ref(false);
const bukaDetail = async (uuid: string) => {
  storeUtils.setLoading(true);
  try {
    const res = await detailOrderOk(uuid);
    if (res?.payload) {
      detail.value = res.payload;
      dialogDetail.value = true;
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Klarifikasi / lengkapi
const dialogKlarifikasi = ref(false);
const catatanKlarifikasi = ref("");
const bukaKlarifikasi = () => {
  catatanKlarifikasi.value = "";
  dialogKlarifikasi.value = true;
};
const kirimKlarifikasi = async () => {
  if (!catatanKlarifikasi.value.trim()) return;
  storeUtils.setLoading(true);
  try {
    const res = await klarifikasiOrderOk(detail.value.uuid, catatanKlarifikasi.value);
    if (res?.payload) {
      detail.value = res.payload;
      dialogKlarifikasi.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const lengkapi = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await lengkapiOrderOk(detail.value.uuid, {});
    if (res?.payload) {
      detail.value = res.payload;
      dialogDetail.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Jadwalkan
const dialogJadwal = ref(false);
const orderUntukJadwal = ref<any>(null);
const bukaJadwal = (order: any) => {
  orderUntukJadwal.value = order;
  dialogJadwal.value = true;
};
const setelahDijadwalkan = () => {
  dialogDetail.value = false;
  muat();
};

// ── Buat order baru (No. Reg kunjungan)
const dialogOrder = ref(false);
const galatOrder = ref("");
const formOrder = ref<any>({ noReg: "", sumber: "rajal", diagnosisKode: "", diagnosisNama: "", jenisOperasi: "elektif", durasiEstimasiMenit: 60 });
const tindakan = ref<any[]>([{ kodeIcd9cm: "", nama: "", kelasOperasi: null }]);
const bukaOrder = () => {
  galatOrder.value = "";
  formOrder.value = { noReg: "", sumber: "rajal", diagnosisKode: "", diagnosisNama: "", jenisOperasi: "elektif", durasiEstimasiMenit: 60 };
  tindakan.value = [{ kodeIcd9cm: "", nama: "", kelasOperasi: null }];
  dialogOrder.value = true;
};
const tambahBarisTindakan = () => tindakan.value.push({ kodeIcd9cm: "", nama: "", kelasOperasi: null });
const hapusBarisTindakan = (i: number) => tindakan.value.splice(i, 1);
const kirimOrder = async () => {
  galatOrder.value = "";
  if (!formOrder.value.noReg.trim()) return (galatOrder.value = "No. Reg kunjungan wajib diisi");
  const daftarTindakan = tindakan.value.filter((t) => t.kodeIcd9cm.trim() && t.nama.trim());
  if (!daftarTindakan.length) return (galatOrder.value = "Minimal satu rencana tindakan (ICD-9-CM) wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await buatOrderOk({ ...formOrder.value, tindakan: daftarTindakan });
    if (res?.payload) {
      dialogOrder.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
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
          <h1 class="toolbar-heading text-opensimrs-300">Daftar Tunggu OK</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nama / No. RM / No. Order" :maxLength="100" @keydown.enter="cariData" />
          <ToolbarFilterMenu :count="filterStatus.length">
            <template #label>Status</template>
            <CustomChip v-for="(s, kode) in STATUS_ORDER_OK" :key="kode" :label="s.label" :value="String(kode)" :isSelected="filterStatus.includes(String(kode))" @selected="toggle('status', $event)" />
          </ToolbarFilterMenu>
          <ToolbarFilterMenu :count="filterJenis.length">
            <template #label>Jenis</template>
            <CustomChip v-for="(j, kode) in JENIS_OPERASI" :key="kode" :label="j" :value="String(kode)" :isSelected="filterJenis.includes(String(kode))" @selected="toggle('jenis', $event)" />
          </ToolbarFilterMenu>
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="reset" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Buat Order" @click="bukaOrder" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs cursor-pointer" scrollable scrollHeight="flex" tableStyle="min-width: 64rem" @rowClick="bukaDetail($event.data.uuid)">
          <Column header="No. Order" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.noOrder }}</div>
              <div class="text-grey-400">{{ waktuOk(d.createdAt) }}</div>
            </template>
          </Column>
          <Column header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.namaPasien ?? "-" }}</div>
              <div class="text-grey-400">{{ d.noRm }} · {{ JK_OK[d.gender] ?? "-" }} · {{ umurOk(d.tanggalLahir) }}</div>
            </template>
          </Column>
          <Column header="Diagnosis / Rencana Tindakan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span v-if="d.jenisOperasi === 'cito'" class="px-1.5 mr-1 text-[10px] font-bold text-white rounded bg-danger-300">CITO</span>
              {{ d.diagnosisNama ?? "-" }}
            </template>
          </Column>
          <Column header="Durasi (menit)" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.durasiEstimasiMenit }}</template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap" :class="[gayaOrderOk(d.status)?.bg, gayaOrderOk(d.status)?.text]">
                {{ gayaOrderOk(d.status)?.label ?? d.status }}
              </span>
            </template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <CustomButton
                v-if="d.status === 'menunggu_jadwal' && bolehJadwal('CREATE')"
                label="Jadwalkan"
                size="small"
                icon="PhCalendarCheck"
                @click.stop="bukaJadwal(d)"
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

    <!-- Detail order -->
    <CustomDialog v-model:visible="dialogDetail" width="760px">
      <template #header>Order {{ detail?.noOrder }}</template>
      <template #body>
        <div v-if="detail" class="flex flex-col gap-4 pt-4 text-sm">
          <div class="grid grid-cols-2 gap-x-6 gap-y-1">
            <div><span class="text-grey-400">Pasien:</span> <b>{{ detail.namaPasien }}</b> ({{ detail.noRm }})</div>
            <div>
              <span class="text-grey-400">Status:</span>
              <span class="px-2 py-0.5 ml-1 rounded-full text-xs font-semibold" :class="[gayaOrderOk(detail.status)?.bg, gayaOrderOk(detail.status)?.text]">{{ gayaOrderOk(detail.status)?.label }}</span>
              <span v-if="detail.jenisOperasi === 'cito'" class="px-1.5 ml-1 text-[10px] font-bold text-white rounded bg-danger-300">CITO</span>
            </div>
            <div><span class="text-grey-400">Umur / JK:</span> {{ umurOk(detail.tanggalLahir) }} / {{ JK_OK[detail.gender] ?? "-" }}</div>
            <div><span class="text-grey-400">Tgl. order:</span> {{ waktuOk(detail.createdAt) }}</div>
            <div><span class="text-grey-400">Sumber:</span> {{ detail.sumber }} · No. Reg {{ detail.noReg }}</div>
            <div><span class="text-grey-400">Durasi estimasi:</span> {{ detail.durasiEstimasiMenit }} menit</div>
            <div class="col-span-2"><span class="text-grey-400">Diagnosis:</span> {{ detail.diagnosisKode }} — {{ detail.diagnosisNama || "-" }}</div>
            <div v-if="detail.status === 'perlu_klarifikasi'" class="col-span-2 text-warning-400">Catatan klarifikasi: {{ detail.catatanKlarifikasi }}</div>
          </div>
          <DataTable :value="detail.tindakan" class="text-xs" stripedRows>
            <Column header="Kode ICD-9-CM" field="kodeIcd9cm" headerClass="bg-opensimrs-50" />
            <Column header="Tindakan" field="namaTindakan" headerClass="bg-opensimrs-50" />
            <Column header="Kelas Operasi" headerClass="bg-opensimrs-50">
              <template #body="{ data: t }">{{ t.kelasOperasi ?? "-" }}</template>
            </Column>
          </DataTable>
          <div v-if="detail.jadwal" class="p-3 text-xs rounded-lg bg-opensimrs-50">
            Sudah terjadwal: {{ waktuOk(detail.jadwal.waktuMulai) }} – {{ waktuOk(detail.jadwal.waktuSelesai, true) }}
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex flex-wrap justify-end gap-2">
          <CustomButton
            v-if="detail && ['menunggu_jadwal', 'perlu_klarifikasi'].includes(detail.status) && boleh('KLARIFIKASI')"
            label="Minta Klarifikasi"
            outlined
            borderColor="border-warning-400"
            textColor="text-warning-400"
            @click="bukaKlarifikasi"
          />
          <CustomButton v-if="detail?.status === 'perlu_klarifikasi' && boleh('UPDATE')" label="Tandai Sudah Dilengkapi" icon="PhCheck" @click="lengkapi" />
          <CustomButton
            v-if="detail?.status === 'menunggu_jadwal' && bolehJadwal('CREATE')"
            label="Jadwalkan"
            icon="PhCalendarCheck"
            @click="bukaJadwal(detail)"
          />
        </div>
      </template>
    </CustomDialog>

    <!-- Klarifikasi -->
    <CustomDialog v-model:visible="dialogKlarifikasi" width="460px" headerBg="bg-warning-400">
      <template #header>Minta Klarifikasi Order</template>
      <template #body>
        <div class="pt-4">
          <CustomTextArea v-model="catatanKlarifikasi" label="Catatan untuk dokter pemesan" placeholder="mis. jenis tindakan belum lengkap" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogKlarifikasi = false" />
          <CustomButton label="Kirim" @click="kirimKlarifikasi" />
        </div>
      </template>
    </CustomDialog>

    <!-- Buat order baru -->
    <CustomDialog v-model:visible="dialogOrder" width="760px">
      <template #header>Buat Order Operasi</template>
      <template #body>
        <div class="flex flex-col gap-4 pt-4 text-sm">
          <div class="grid grid-cols-3 gap-4">
            <CustomTextfield v-model="formOrder.noReg" label="No. Reg Kunjungan" placeholder="No. Reg Rajal/Ranap/IGD" required />
            <CustomSelect
              v-model="formOrder.sumber"
              label="Sumber Kunjungan"
              :options="[{ value: 'rajal', label: 'Rawat Jalan' }, { value: 'ranap', label: 'Rawat Inap' }, { value: 'igd', label: 'IGD' }]"
              optionValue="value"
              optionLabel="label"
              :showFilter="false"
              :clearable="false"
            />
            <CustomSelect
              v-model="formOrder.jenisOperasi"
              label="Jenis Operasi"
              :options="[{ value: 'elektif', label: 'Elektif' }, { value: 'cito', label: 'CITO' }]"
              optionValue="value"
              optionLabel="label"
              :showFilter="false"
              :clearable="false"
            />
          </div>
          <div class="grid grid-cols-3 gap-4">
            <CustomTextfield v-model="formOrder.diagnosisKode" label="Kode Diagnosis (ICD-10)" placeholder="mis. K35.8" />
            <CustomTextfield v-model="formOrder.diagnosisNama" label="Diagnosis" placeholder="mis. Apendisitis akut" class="col-span-2" />
          </div>
          <CustomTextfield v-model.number="formOrder.durasiEstimasiMenit" label="Perkiraan Durasi (menit)" type="number" />
          <div>
            <div class="flex items-center justify-between mb-1">
              <div class="text-sm font-semibold">Rencana Tindakan (ICD-9-CM)</div>
              <CustomButton size="small" icon="PhPlus" label="Tambah Tindakan" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="tambahBarisTindakan" />
            </div>
            <div v-for="(t, i) in tindakan" :key="i" class="grid grid-cols-[140px_1fr_140px_40px] gap-2 mb-2">
              <CustomTextfield v-model="t.kodeIcd9cm" placeholder="Kode ICD-9-CM" />
              <CustomTextfield v-model="t.nama" placeholder="Nama tindakan" />
              <CustomSelect
                v-model="t.kelasOperasi"
                placeHolder="Kelas operasi"
                :options="[{ value: 'kecil', label: 'Kecil' }, { value: 'sedang', label: 'Sedang' }, { value: 'besar', label: 'Besar' }, { value: 'khusus', label: 'Khusus' }]"
                optionValue="value"
                optionLabel="label"
                :showFilter="false"
              />
              <CustomButton v-if="tindakan.length > 1" icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="hapusBarisTindakan(i)" />
            </div>
          </div>
          <div v-if="galatOrder" class="text-sm text-danger-300">{{ galatOrder }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogOrder = false" />
          <CustomButton label="Buat Order" icon="PhPaperPlaneTilt" @click="kirimOrder" />
        </div>
      </template>
    </CustomDialog>

    <DialogJadwalOk v-model:visible="dialogJadwal" :order="orderUntukJadwal" @tersimpan="setelahDijadwalkan" />
  </div>
</template>
