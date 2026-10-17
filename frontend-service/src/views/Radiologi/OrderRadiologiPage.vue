<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import PilihPemeriksaanRadiologi from "@/components/RekamMedis/OrderRadiologi/PilihPemeriksaanRadiologi.vue";
import DialogJadwalRadiologi from "./Komponen/DialogJadwalRadiologi.vue";
import { utilsStore } from "@/stores/utils";
import { fiturAktif } from "@/stores/modulFaskes";
import {
  MODALITAS_RAD,
  PELAYANAN_RAD,
  STATUS_ITEM_RAD,
  STATUS_ORDER_RAD,
  SUMBER_RAD,
  batalOrderRad,
  buatOrderRad,
  cariPasienRad,
  daftarDokterRad,
  daftarKoneksiPacs,
  daftarOrderRad,
  detailOrderRad,
  keTanggal,
  noAntreanRad,
  rupiahRad,
  umurRad,
  validasiDanKirimPacs,
  validasiOrderRad,
  waktuRad,
} from "@/stores/penunjang/radiologi";
import { createBuktiOrderRadPdf, createHasilRadPdf } from "@/utils/pdf/pdfRadiologi/cetakRadiologi";

// Order Radiologi: daftar order (RME / APS / MCU), validasi (tagihan dikirim ke Pembayaran), batal, cetak
// bukti order, dan order APS baru untuk pasien terdaftar.
const storeUtils = utilsStore();

// ── Daftar & filter
const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");
const tglMulai = ref<Date | null>(new Date());
const tglSelesai = ref<Date | null>(new Date());
const filterStatus = ref<string[]>([]);
const filterSumber = ref<string[]>([]);
const filterModalitas = ref<string[]>([]);

const FILTER = { status: filterStatus, sumber: filterSumber, modalitas: filterModalitas };
const toggle = (jenis: keyof typeof FILTER, nilai: string) => {
  const daftar = FILTER[jenis];
  daftar.value = daftar.value.includes(nilai) ? daftar.value.filter((x) => x !== nilai) : [...daftar.value, nilai];
};

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarOrderRad({
      page: page.value,
      limit: limit.value,
      cari: cari.value,
      status: filterStatus.value,
      sumber: filterSumber.value,
      modalitas: filterModalitas.value,
      tanggal_mulai: keTanggal(tglMulai.value),
      tanggal_selesai: keTanggal(tglSelesai.value ?? tglMulai.value),
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
const reset = () => {
  cari.value = "";
  tglMulai.value = new Date();
  tglSelesai.value = new Date();
  filterStatus.value = [];
  filterSumber.value = [];
  filterModalitas.value = [];
  cariData();
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

// ── Detail, validasi, batal, cetak
const detail = ref<any>(null);
const dialogDetail = ref(false);
const bukaDetail = async (uuid: string) => {
  storeUtils.setLoading(true);
  try {
    const res = await detailOrderRad(uuid);
    if (res?.payload) {
      detail.value = res.payload;
      dialogDetail.value = true;
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const validasi = async () => {
  if (!detail.value) return;
  storeUtils.setLoading(true);
  try {
    const res = await validasiOrderRad(detail.value.uuid);
    if (res?.payload) {
      detail.value = res.payload;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Bridging PACS/RIS: "Validasi & Kirim ke PACS" (tersedia bila fitur rad_bridging_pacs aktif & ada koneksi aktif)
const pacsAktif = computed(() => fiturAktif("rad_bridging_pacs"));
const koneksiAktifPacs = ref<any[]>([]);
const dialogPilihKoneksiPacs = ref(false);
const koneksiPilihanPacs = ref<string | null>(null);
const muatKoneksiPacs = async () => {
  if (!pacsAktif.value) return;
  const res = await daftarKoneksiPacs(true);
  koneksiAktifPacs.value = res?.payload ?? [];
};
const kirimPacs = async () => {
  if (!detail.value) return;
  const bawaan = koneksiAktifPacs.value.find((k: any) => k.bawaan);
  if (!bawaan && koneksiAktifPacs.value.length > 1 && !koneksiPilihanPacs.value) {
    dialogPilihKoneksiPacs.value = true;
    return;
  }
  storeUtils.setLoading(true);
  try {
    const res = await validasiDanKirimPacs(detail.value.uuid, koneksiPilihanPacs.value);
    if (res?.payload?.order) {
      detail.value = res.payload.order;
      dialogPilihKoneksiPacs.value = false;
      koneksiPilihanPacs.value = null;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const dialogBatal = ref(false);
const alasanBatal = ref("");
const galatBatal = ref("");
const bukaBatal = () => {
  alasanBatal.value = "";
  galatBatal.value = "";
  dialogBatal.value = true;
};
const batal = async () => {
  if (!alasanBatal.value.trim()) return (galatBatal.value = "Alasan pembatalan wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await batalOrderRad(detail.value.uuid, alasanBatal.value.trim());
    if (res?.payload) {
      dialogBatal.value = false;
      detail.value = res.payload;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const cetakBukti = () => detail.value && createBuktiOrderRadPdf(detail.value);

// ── Jadwalkan item yang belum terjadwal (order tervalidasi)
const dialogJadwal = ref(false);
const orderUntukJadwal = computed(() => {
  const d = detail.value;
  if (!d || !["valid", "diperiksa"].includes(d.status)) return null;
  const items = (d.items ?? []).filter((i: any) => i.status === "menunggu" && !i.jadwalUuid);
  return items.length ? { uuid: d.uuid, noOrder: d.noOrder, noRm: d.noRm, namaPasien: d.pasien?.name ?? d.namaPasien, cito: d.cito, klinis: d.klinis, items } : null;
});
const setelahDijadwalkan = () => detail.value && bukaDetail(detail.value.uuid);
const cetakHasil = () => detail.value && createHasilRadPdf(detail.value);

// ── Order APS baru
const dialogOrder = ref(false);
const kataPasien = ref("");
const hasilPasien = ref<any[]>([]);
const pasien = ref<any>(null);
const dokter = ref<any[]>([]);
const formOrder = ref({ dokterPengirimUuid: "", paymentMethod: 1, klinis: "", catatan: "", cito: false, items: [] as string[], paket: [] as string[] });
const galatOrder = ref("");

const bukaOrder = async () => {
  kataPasien.value = "";
  hasilPasien.value = [];
  pasien.value = null;
  galatOrder.value = "";
  formOrder.value = { dokterPengirimUuid: "", paymentMethod: 1, klinis: "", catatan: "", cito: false, items: [], paket: [] };
  dialogOrder.value = true;
  if (!dokter.value.length) dokter.value = (await daftarDokterRad())?.payload ?? [];
};
const cariPasien = async () => {
  const res = await cariPasienRad(kataPasien.value);
  hasilPasien.value = res?.payload ?? [];
};
const kirimOrder = async () => {
  galatOrder.value = "";
  if (!pasien.value) return (galatOrder.value = "Pilih pasien terlebih dahulu");
  if (!formOrder.value.items.length && !formOrder.value.paket.length) return (galatOrder.value = "Pilih minimal satu pemeriksaan atau paket");
  storeUtils.setLoading(true);
  try {
    const res = await buatOrderRad({
      sumber: "aps",
      patientUuid: pasien.value.uuid,
      dokterPengirimUuid: formOrder.value.dokterPengirimUuid || null,
      paymentMethod: formOrder.value.paymentMethod,
      klinis: formOrder.value.klinis,
      catatan: formOrder.value.catatan,
      cito: formOrder.value.cito,
      items: formOrder.value.items,
      paketUuids: formOrder.value.paket,
    });
    if (res?.payload) {
      dialogOrder.value = false;
      detail.value = res.payload;
      dialogDetail.value = true;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const JK: Record<string, string> = { Male: "L", Female: "P" };

onMounted(() => {
  muat();
  muatKoneksiPacs();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Order Radiologi</h1>
          <CustomTextfield
            v-model="cari"
            label="Cari"
            prependIcon="PhMagnifyingGlass"
            placeholder="Nama / No. RM / No. Order"
            :maxLength="100"
            @keydown.enter="cariData"
          />
          <CustomDatePicker v-model="tglMulai" label="Tanggal mulai" class="toolbar-field--date" :maxDate="tglSelesai ?? undefined" />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker v-model="tglSelesai" label="Tanggal selesai" class="toolbar-field--date" :minDate="tglMulai ?? undefined" />
          <ToolbarFilterMenu :count="filterStatus.length">
            <template #label>Status</template>
            <CustomChip
              v-for="(s, kode) in STATUS_ORDER_RAD"
              :key="kode"
              :label="s.label"
              :value="String(kode)"
              :isSelected="filterStatus.includes(String(kode))"
              @selected="toggle('status', $event)"
            />
          </ToolbarFilterMenu>
          <ToolbarFilterMenu :count="filterSumber.length">
            <template #label>Sumber</template>
            <CustomChip
              v-for="(s, kode) in SUMBER_RAD"
              :key="kode"
              :label="s"
              :value="String(kode)"
              :isSelected="filterSumber.includes(String(kode))"
              @selected="toggle('sumber', $event)"
            />
          </ToolbarFilterMenu>
          <ToolbarFilterMenu :count="filterModalitas.length">
            <template #label>Modalitas</template>
            <CustomChip
              v-for="(nama, kode) in MODALITAS_RAD"
              :key="kode"
              :label="`${kode} — ${nama}`"
              :value="String(kode)"
              :isSelected="filterModalitas.includes(String(kode))"
              @selected="toggle('modalitas', $event)"
            />
          </ToolbarFilterMenu>
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="reset" />
          <CustomButton icon="PhPlus" label="Order APS" @click="bukaOrder" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable
          v-else
          :value="data"
          stripedRows
          class="text-xs cursor-pointer"
          scrollable
          scrollHeight="flex"
          tableStyle="min-width: 60rem"
          @rowClick="bukaDetail($event.data.uuid)"
        >
          <Column header="No. Order" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.noOrder }}</div>
              <div class="text-grey-400">{{ waktuRad(d.createdAt) }}</div>
            </template>
          </Column>
          <Column header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.namaPasien ?? "-" }}</div>
              <div class="text-grey-400">{{ d.noRm }} · {{ JK[d.gender] ?? "-" }} · {{ umurRad(d.birthDate) }}</div>
            </template>
          </Column>
          <Column header="Asal" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div>{{ SUMBER_RAD[d.sumber] }} · {{ PELAYANAN_RAD[d.pelayanan] ?? d.pelayanan }}</div>
              <div class="text-grey-400">{{ d.lokasiAsal ?? d.noReg ?? "" }}</div>
            </template>
          </Column>
          <Column header="Pemeriksaan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span v-if="d.cito" class="px-1.5 mr-1 text-[10px] font-bold text-white rounded bg-danger-300">CITO</span>
              {{ d.pemeriksaan ?? "-" }}
              <div class="text-grey-400">{{ d.jumlahSelesai }}/{{ d.jumlahItem }} selesai</div>
            </template>
          </Column>
          <Column header="Dokter Pengirim" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.dokterPengirim ?? "-" }}</template>
          </Column>
          <Column header="Total" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.tanpaTagihan ? "Paket MCU" : rupiahRad(d.total) }}</template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-xs font-semibold" :class="[STATUS_ORDER_RAD[d.status as keyof typeof STATUS_ORDER_RAD]?.bg, STATUS_ORDER_RAD[d.status as keyof typeof STATUS_ORDER_RAD]?.text]">
                {{ STATUS_ORDER_RAD[d.status as keyof typeof STATUS_ORDER_RAD]?.label ?? d.status }}
              </span>
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
    <CustomDialog v-model:visible="dialogDetail" width="820px">
      <template #header>Order {{ detail?.noOrder }}</template>
      <template #body>
        <div v-if="detail" class="flex flex-col gap-4 pt-4 text-sm">
          <div class="grid grid-cols-2 gap-x-6 gap-y-1">
            <div><span class="text-grey-400">Pasien:</span> <b>{{ detail.pasien?.name ?? detail.namaPasien }}</b> ({{ detail.noRm }})</div>
            <div>
              <span class="text-grey-400">Status:</span>
              <span class="px-2 py-0.5 ml-1 rounded-full text-xs font-semibold" :class="[STATUS_ORDER_RAD[detail.status as keyof typeof STATUS_ORDER_RAD]?.bg, STATUS_ORDER_RAD[detail.status as keyof typeof STATUS_ORDER_RAD]?.text]">
                {{ STATUS_ORDER_RAD[detail.status as keyof typeof STATUS_ORDER_RAD]?.label }}
              </span>
              <span v-if="detail.cito" class="px-1.5 ml-1 text-[10px] font-bold text-white rounded bg-danger-300">CITO</span>
            </div>
            <div><span class="text-grey-400">Umur / JK:</span> {{ umurRad(detail.pasien?.birthDate) }} / {{ JK[detail.pasien?.gender] ?? "-" }}</div>
            <div><span class="text-grey-400">Tgl. order:</span> {{ waktuRad(detail.createdAt) }}</div>
            <div><span class="text-grey-400">Asal:</span> {{ SUMBER_RAD[detail.sumber] }} · {{ PELAYANAN_RAD[detail.pelayanan] }} {{ detail.noReg ? `(${detail.noReg})` : "" }}</div>
            <div><span class="text-grey-400">Dokter pengirim:</span> {{ detail.dokterPengirim ?? "-" }}</div>
            <div><span class="text-grey-400">Pembayaran:</span> {{ detail.tanpaTagihan ? "Tanpa tagihan (MCU)" : detail.paymentMethod === 2 ? "Asuransi" : "Tunai" }}</div>
            <div v-if="detail.divalidasiPada"><span class="text-grey-400">Validasi:</span> {{ waktuRad(detail.divalidasiPada) }} · {{ detail.divalidasiOleh }}</div>
            <div class="col-span-2"><span class="text-grey-400">Klinis:</span> {{ detail.klinis || "-" }}</div>
            <div v-if="detail.catatan" class="col-span-2"><span class="text-grey-400">Catatan:</span> {{ detail.catatan }}</div>
            <div v-if="detail.status === 'batal'" class="col-span-2 text-danger-300">Alasan batal: {{ detail.alasanBatal }}</div>
          </div>
          <DataTable :value="detail.items" class="text-xs" stripedRows>
            <Column header="Pemeriksaan" headerClass="bg-opensimrs-50">
              <template #body="{ data: i }">
                {{ i.nama }} <span class="text-grey-300">· {{ i.kode }}</span>
                <span v-if="i.paketNama" class="ml-1 px-1.5 rounded text-[10px] bg-opensimrs-50 text-opensimrs-400">{{ i.paketNama }}</span>
              </template>
            </Column>
            <Column header="Modalitas" headerClass="bg-opensimrs-50">
              <template #body="{ data: i }">{{ i.modalitas }}</template>
            </Column>
            <Column header="Tarif" headerClass="bg-opensimrs-50">
              <template #body="{ data: i }">{{ rupiahRad(i.harga) }}</template>
            </Column>
            <Column header="Status" headerClass="bg-opensimrs-50">
              <template #body="{ data: i }">{{ STATUS_ITEM_RAD[i.status as keyof typeof STATUS_ITEM_RAD]?.label ?? i.status }}</template>
            </Column>
            <Column header="Jadwal / Ruang" headerClass="bg-opensimrs-50">
              <template #body="{ data: i }">
                <template v-if="i.jadwalStatus">
                  {{ i.jadwalTanggal }} {{ i.jadwalJam }}
                  <div class="text-grey-400">{{ i.ruang }}<span v-if="i.noAntrean"> · {{ noAntreanRad(i.ruangKode, i.noAntrean) }}</span></div>
                </template>
                <span v-else-if="i.ruang">{{ i.ruang }}</span>
                <span v-else class="text-grey-400">{{ i.status === "menunggu" ? "Belum dijadwalkan" : "-" }}</span>
              </template>
            </Column>
            <Column v-if="pacsAktif" header="Accession No. (PACS)" headerClass="bg-opensimrs-50">
              <template #body="{ data: i }">{{ i.accessionNumber ?? "-" }}</template>
            </Column>
            <Column header="Kesan" headerClass="bg-opensimrs-50">
              <template #body="{ data: i }">{{ i.kesan ?? "-" }}</template>
            </Column>
          </DataTable>
          <div class="font-semibold text-right">Total: {{ detail.tanpaTagihan ? "Paket MCU" : rupiahRad(detail.total) }}</div>
        </div>
      </template>
      <template #footer>
        <div v-if="detail" class="flex flex-col items-end gap-2">
          <div class="flex flex-wrap justify-end gap-2">
            <CustomButton
              v-if="['order', 'valid'].includes(detail.status)"
              label="Batalkan"
              icon="PhXCircle"
              outlined
              borderColor="border-danger-300"
              textColor="text-danger-300"
              @click="bukaBatal"
            />
            <CustomButton label="Cetak Bukti Order" icon="PhPrinter" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cetakBukti" />
            <CustomButton v-if="detail.items?.some((i: any) => i.status === 'selesai')" label="Cetak Hasil" icon="PhFileText" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cetakHasil" />
            <CustomButton
              v-if="detail.status === 'order'"
              :label="pacsAktif ? 'Validasi Saja' : 'Validasi & Kirim Tagihan'"
              icon="PhCheckCircle"
              :outlined="pacsAktif"
              :borderColor="pacsAktif ? 'border-opensimrs-300' : undefined"
              :textColor="pacsAktif ? 'text-opensimrs-300' : undefined"
              @click="validasi"
            />
            <CustomButton
              v-if="detail.status === 'order' && pacsAktif"
              label="Validasi & Kirim ke PACS"
              icon="PhPaperPlaneTilt"
              :disabled="!koneksiAktifPacs.length"
              @click="kirimPacs"
            />
            <CustomButton v-if="orderUntukJadwal" label="Jadwalkan" icon="PhCalendarPlus" @click="dialogJadwal = true" />
          </div>
          <div v-if="detail.status === 'order' && pacsAktif && !koneksiAktifPacs.length" class="text-xs text-danger-300">
            Belum ada koneksi PACS aktif. Lengkapi dahulu di Setting › Konfigurasi Integrasi › Konfigurasi PACS.
          </div>
        </div>
      </template>
    </CustomDialog>

    <!-- Pilih koneksi PACS tujuan (lebih dari satu koneksi aktif tanpa koneksi bawaan) -->
    <CustomDialog v-model:visible="dialogPilihKoneksiPacs" width="420px">
      <template #header>Pilih Koneksi PACS Tujuan</template>
      <template #body>
        <div class="flex flex-col gap-2 pt-4">
          <label v-for="k in koneksiAktifPacs" :key="k.uuid" class="flex items-center gap-2 p-2 border rounded-lg cursor-pointer border-grey-75 hover:bg-opensimrs-50">
            <RadioButton v-model="koneksiPilihanPacs" :value="k.uuid" />
            <span class="text-sm">{{ k.nama }}</span>
          </label>
        </div>
      </template>
      <template #footer>
        <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogPilihKoneksiPacs = false" />
        <CustomButton label="Kirim" :disabled="!koneksiPilihanPacs" @click="kirimPacs" />
      </template>
    </CustomDialog>

    <DialogJadwalRadiologi v-model:visible="dialogJadwal" :order="orderUntukJadwal" @tersimpan="setelahDijadwalkan" />

    <!-- Batal -->
    <CustomDialog v-model:visible="dialogBatal" width="460px" headerBg="bg-danger-300">
      <template #header>Batalkan Order {{ detail?.noOrder }}</template>
      <template #body>
        <div class="flex flex-col gap-2 pt-4">
          <div v-if="detail?.status === 'valid' && !detail?.tanpaTagihan" class="text-sm text-grey-400">
            Item tagihan order ini akan dihapus dari Pembayaran.
          </div>
          <CustomTextArea v-model="alasanBatal" label="Alasan pembatalan" placeholder="mis. pasien menolak pemeriksaan" required />
          <div v-if="galatBatal" class="text-sm text-danger-300">{{ galatBatal }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Kembali" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogBatal = false" />
          <CustomButton label="Batalkan Order" backgroundColor="bg-danger-300" @click="batal" />
        </div>
      </template>
    </CustomDialog>

    <!-- Order APS -->
    <CustomDialog v-model:visible="dialogOrder" width="860px">
      <template #header>Order Radiologi APS (Atas Permintaan Sendiri / Rujukan Luar)</template>
      <template #body>
        <div class="flex flex-col gap-4 pt-4">
          <div>
            <div class="mb-1 text-sm font-semibold">Pasien</div>
            <div v-if="pasien" class="flex items-center justify-between p-3 rounded-lg bg-opensimrs-50">
              <div class="text-sm">
                <b>{{ pasien.name }}</b> · {{ pasien.noRm }} · {{ JK[pasien.gender] ?? "-" }} · {{ umurRad(pasien.birthDate) }}
                <span v-if="pasien.noIdentity" class="text-grey-400">· NIK {{ pasien.noIdentity }}</span>
              </div>
              <CustomButton label="Ganti" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="pasien = null" />
            </div>
            <div v-else class="flex flex-col gap-2">
              <div class="flex gap-2">
                <InputText v-model="kataPasien" placeholder="Cari nama / No. RM / NIK pasien terdaftar" class="grow text-sm" @keydown.enter="cariPasien" />
                <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariPasien" />
              </div>
              <div v-if="hasilPasien.length" class="overflow-auto border rounded-lg max-h-[180px] border-grey-75">
                <div
                  v-for="p in hasilPasien"
                  :key="p.uuid"
                  class="flex justify-between px-3 py-2 text-sm border-b cursor-pointer border-grey-75 hover:bg-opensimrs-50"
                  @click="pasien = p"
                >
                  <span><b>{{ p.name }}</b> · {{ p.noRm }}</span>
                  <span class="text-grey-400">{{ JK[p.gender] ?? "-" }} · {{ umurRad(p.birthDate) }}</span>
                </div>
              </div>
              <div class="text-xs text-grey-400">Pasien baru didaftarkan dahulu di Admisi (master pasien).</div>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-4">
            <CustomSelect
              v-model="formOrder.dokterPengirimUuid"
              label="Dokter Pengirim (opsional)"
              placeHolder="Pilih dokter / kosongkan untuk rujukan luar"
              :options="dokter"
              optionValue="uuid"
              optionLabel="nama"
            />
            <CustomSelect
              v-model="formOrder.paymentMethod"
              label="Pembayaran"
              :options="[{ label: 'Tunai', value: 1 }, { label: 'Asuransi', value: 2 }]"
              optionValue="value"
              optionLabel="label"
              :showFilter="false"
              :clearable="false"
            />
            <div class="flex items-end gap-2 pb-2">
              <Checkbox v-model="formOrder.cito" binary inputId="rad-cito-aps" />
              <label for="rad-cito-aps" class="text-sm font-semibold text-danger-300">CITO (segera)</label>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <CustomTextArea v-model="formOrder.klinis" label="Keterangan Klinis / Diagnosis" placeholder="Indikasi pemeriksaan" />
            <CustomTextArea v-model="formOrder.catatan" label="Catatan" placeholder="mis. nomor surat rujukan" />
          </div>
          <div>
            <div class="mb-1 text-sm font-semibold">Pemeriksaan / Paket</div>
            <PilihPemeriksaanRadiologi v-model="formOrder.items" v-model:paket="formOrder.paket" />
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
  </div>
</template>
