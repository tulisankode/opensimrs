<script setup lang="ts">
import { onMounted, ref } from "vue";
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
import PilihPemeriksaanPa from "@/components/RekamMedis/OrderPA/PilihPemeriksaanPa.vue";
import { utilsStore } from "@/stores/utils";
import { fiturAktif } from "@/stores/modulFaskes";
import {
  JENIS_PA,
  JK_PA,
  asalPa,
  SARAN_CARA_AMBIL_PA,
  STATUS_ORDER_PA,
  SUMBER_PA,
  batalOrderPa,
  buatOrderPa,
  cariPasienPa,
  daftarDokterPa,
  daftarKoneksiLisPa,
  daftarOrderPa,
  detailOrderPa,
  gayaKasusPa,
  gayaOrderPa,
  izinPa,
  keTanggalPa,
  rupiahPa,
  umurPa,
  validasiOrderPa,
  waktuPa,
} from "@/stores/penunjang/patologi";
import { createBuktiOrderPaPdf, createHasilPaPdf } from "@/utils/pdf/pdfPatologi/cetakPatologi";

// Order Patologi Anatomi: daftar order (RME / APS / rujukan luar), validasi (tagihan dikirim ke Pembayaran), batal
// (tagihan dihapus; hanya sebelum jaringan diterima), cetak bukti order & hasil, dan order baru APS / rujukan luar.
const storeUtils = utilsStore();
// Hak akses tombol (Setting › Hak Akses › Patologi Anatomi › Order PA).
const boleh = (aksi: string) => izinPa("Order PA", aksi);

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
const filterJenis = ref<string[]>([]);

const FILTER = { status: filterStatus, sumber: filterSumber, jenis: filterJenis };
const toggle = (jenis: keyof typeof FILTER, nilai: string) => {
  const daftar = FILTER[jenis];
  daftar.value = daftar.value.includes(nilai) ? daftar.value.filter((x) => x !== nilai) : [...daftar.value, nilai];
};

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarOrderPa({
      page: page.value,
      limit: limit.value,
      cari: cari.value,
      status: filterStatus.value,
      sumber: filterSumber.value,
      jenis: filterJenis.value,
      tanggal_mulai: keTanggalPa(tglMulai.value),
      tanggal_selesai: keTanggalPa(tglSelesai.value ?? tglMulai.value),
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
  filterJenis.value = [];
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
    const res = await detailOrderPa(uuid);
    if (res?.payload) {
      detail.value = res.payload;
      dialogDetail.value = true;
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
// Validasi order: pilihan "Validasi Saja" atau "Validasi & Kirim ke LIS PA" (Bridging LIS PA, pola sama lab).
// Validasi tetap sah walau pengiriman gagal/ditolak dibatalkan di backend; lihat kriteria penerimaan.
const dialogValidasi = ref(false);
const koneksiLisPa = ref<any[]>([]);
const koneksiLisPaDipilih = ref("");
const bukaDialogValidasi = async () => {
  dialogValidasi.value = true;
  const res = await daftarKoneksiLisPa();
  koneksiLisPa.value = (res?.payload ?? []).filter((k: any) => k.aktif);
  koneksiLisPaDipilih.value = (koneksiLisPa.value.find((k: any) => k.bawaan) ?? koneksiLisPa.value[0])?.uuid ?? "";
};
const validasi = async (kirimLisPa = false) => {
  if (!detail.value) return;
  dialogValidasi.value = false;
  storeUtils.setLoading(true);
  try {
    const res = await validasiOrderPa(detail.value.uuid, kirimLisPa ? { kirimLisPa: true, koneksiUuid: koneksiLisPaDipilih.value || null } : {});
    if (res?.payload) {
      detail.value = res.payload;
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
    const res = await batalOrderPa(detail.value.uuid, alasanBatal.value.trim());
    if (res?.payload) {
      dialogBatal.value = false;
      detail.value = res.payload;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const bisaBatal = () =>
  detail.value && ["order", "valid", "ditolak"].includes(detail.value.status) && (detail.value.items ?? []).every((i: any) => ["menunggu", "ditolak"].includes(i.status));

// ── Order APS / rujukan luar
const dialogOrder = ref(false);
const kataPasien = ref("");
const hasilPasien = ref<any[]>([]);
const pasien = ref<any>(null);
const dokter = ref<any[]>([]);
const pemilih = ref<InstanceType<typeof PilihPemeriksaanPa>>();
const kosongForm = () => ({
  sumber: "aps" as "aps" | "rujukan",
  dokterPengirimUuid: "",
  dokterPengirimLuar: "",
  faskesPerujuk: "",
  paymentMethod: 1,
  klinis: "",
  riwayat: "",
  lokasiAnatomi: "",
  caraPengambilan: "",
  catatan: "",
  cito: false,
  items: [] as string[],
  induk: "",
});
const formOrder = ref(kosongForm());
const galatOrder = ref("");

const bukaOrder = async () => {
  kataPasien.value = "";
  hasilPasien.value = [];
  pasien.value = null;
  galatOrder.value = "";
  formOrder.value = kosongForm();
  dialogOrder.value = true;
  if (!dokter.value.length) dokter.value = (await daftarDokterPa())?.payload ?? [];
};
const cariPasien = async () => {
  hasilPasien.value = (await cariPasienPa(kataPasien.value))?.payload ?? [];
};
const kirimOrder = async () => {
  galatOrder.value = "";
  const f = formOrder.value;
  if (!pasien.value) return (galatOrder.value = "Pilih pasien terlebih dahulu");
  if (!f.items.length) return (galatOrder.value = "Pilih minimal satu pemeriksaan");
  if (pemilih.value?.adaIhk && !f.induk) return (galatOrder.value = "Pilih kasus PA induk untuk pemeriksaan IHK");
  if (f.sumber === "rujukan" && !f.dokterPengirimLuar.trim() && !f.faskesPerujuk.trim()) return (galatOrder.value = "Rujukan luar: isi dokter atau faskes perujuk");
  storeUtils.setLoading(true);
  try {
    const res = await buatOrderPa({
      sumber: f.sumber,
      patientUuid: pasien.value.uuid,
      dokterPengirimUuid: f.sumber === "aps" ? f.dokterPengirimUuid || null : null,
      dokterPengirimLuar: f.sumber === "rujukan" ? f.dokterPengirimLuar : undefined,
      faskesPerujuk: f.sumber === "rujukan" ? f.faskesPerujuk : undefined,
      paymentMethod: f.paymentMethod,
      klinis: f.klinis,
      riwayat: f.riwayat,
      lokasiAnatomi: f.lokasiAnatomi,
      caraPengambilan: f.caraPengambilan,
      catatan: f.catatan,
      cito: f.cito,
      items: pemilih.value?.items ?? f.items.map((u) => ({ pemeriksaanUuid: u })),
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

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Order Patologi Anatomi</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nama / No. RM / No. Order / No. PA" :maxLength="100" @keydown.enter="cariData" />
          <CustomDatePicker v-model="tglMulai" label="Tanggal mulai" class="toolbar-field--date" :maxDate="tglSelesai ?? undefined" />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker v-model="tglSelesai" label="Tanggal selesai" class="toolbar-field--date" :minDate="tglMulai ?? undefined" />
          <ToolbarFilterMenu :count="filterStatus.length">
            <template #label>Status</template>
            <CustomChip
              v-for="(s, kode) in STATUS_ORDER_PA"
              :key="kode"
              :label="s.label"
              :value="String(kode)"
              :isSelected="filterStatus.includes(String(kode))"
              @selected="toggle('status', $event)"
            />
          </ToolbarFilterMenu>
          <ToolbarFilterMenu :count="filterSumber.length">
            <template #label>Sumber</template>
            <CustomChip v-for="(s, kode) in SUMBER_PA" :key="kode" :label="s" :value="String(kode)" :isSelected="filterSumber.includes(String(kode))" @selected="toggle('sumber', $event)" />
          </ToolbarFilterMenu>
          <ToolbarFilterMenu :count="filterJenis.length">
            <template #label>Jenis</template>
            <CustomChip v-for="(j, kode) in JENIS_PA" :key="kode" :label="j.label" :value="String(kode)" :isSelected="filterJenis.includes(String(kode))" @selected="toggle('jenis', $event)" />
          </ToolbarFilterMenu>
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="reset" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Order APS / Rujukan" @click="bukaOrder" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs cursor-pointer" scrollable scrollHeight="flex" tableStyle="min-width: 64rem" @rowClick="bukaDetail($event.data.uuid)">
          <Column header="No. Order" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.noOrder }}</div>
              <div class="text-grey-400">{{ waktuPa(d.createdAt) }}</div>
            </template>
          </Column>
          <Column header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.namaPasien ?? "-" }}</div>
              <div class="text-grey-400">{{ d.noRm }} · {{ JK_PA[d.gender] ?? "-" }} · {{ umurPa(d.birthDate) }}</div>
            </template>
          </Column>
          <Column header="Asal" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div>{{ asalPa(d) }}</div>
              <div class="text-grey-400">{{ d.faskesPerujuk ?? d.lokasiAsal ?? d.noReg ?? "" }}</div>
            </template>
          </Column>
          <Column header="Pemeriksaan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span v-if="d.cito" class="px-1.5 mr-1 text-[10px] font-bold text-white rounded bg-danger-300">CITO</span>
              {{ d.pemeriksaan ?? "-" }}
              <div class="text-grey-400">
                {{ d.noPa ?? "Belum ada nomor PA" }} · {{ d.jumlahSelesai }}/{{ d.jumlahItem }} selesai<span v-if="d.jumlahDitolak" class="text-danger-300"> · {{ d.jumlahDitolak }} ditolak</span>
              </div>
            </template>
          </Column>
          <Column header="Dokter Pengirim" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.dokterPengirim ?? "-" }}</template>
          </Column>
          <Column header="Total" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ rupiahPa(d.total) }}</template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap" :class="[gayaOrderPa(d.status)?.bg, gayaOrderPa(d.status)?.text]">
                {{ gayaOrderPa(d.status)?.label ?? d.status }}
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
    <CustomDialog v-model:visible="dialogDetail" width="880px">
      <template #header>Order {{ detail?.noOrder }}</template>
      <template #body>
        <div v-if="detail" class="flex flex-col gap-4 pt-4 text-sm">
          <div class="grid grid-cols-2 gap-x-6 gap-y-1">
            <div><span class="text-grey-400">Pasien:</span> <b>{{ detail.pasien?.name ?? detail.namaPasien }}</b> ({{ detail.noRm }})</div>
            <div>
              <span class="text-grey-400">Status:</span>
              <span class="px-2 py-0.5 ml-1 rounded-full text-xs font-semibold" :class="[gayaOrderPa(detail.status)?.bg, gayaOrderPa(detail.status)?.text]">{{ gayaOrderPa(detail.status)?.label }}</span>
              <span v-if="detail.cito" class="px-1.5 ml-1 text-[10px] font-bold text-white rounded bg-danger-300">CITO</span>
            </div>
            <div><span class="text-grey-400">Umur / JK:</span> {{ umurPa(detail.pasien?.birthDate) }} / {{ JK_PA[detail.pasien?.gender] ?? "-" }}</div>
            <div><span class="text-grey-400">Tgl. order:</span> {{ waktuPa(detail.createdAt) }}</div>
            <div>
              <span class="text-grey-400">Asal:</span> {{ asalPa(detail) }} {{ detail.noReg ? `(${detail.noReg})` : "" }}
              <span v-if="detail.faskesPerujuk"> · {{ detail.faskesPerujuk }}</span>
            </div>
            <div><span class="text-grey-400">Dokter pengirim:</span> {{ detail.dokterPengirim ?? "-" }}</div>
            <div><span class="text-grey-400">Pembayaran:</span> {{ detail.paymentMethod === 2 ? "Asuransi" : "Tunai" }}</div>
            <div v-if="detail.divalidasiPada"><span class="text-grey-400">Validasi:</span> {{ waktuPa(detail.divalidasiPada) }} · {{ detail.divalidasiOleh }}</div>
            <div class="col-span-2"><span class="text-grey-400">Data klinis:</span> {{ detail.klinis || "-" }}</div>
            <div v-if="detail.riwayat" class="col-span-2"><span class="text-grey-400">Riwayat:</span> {{ detail.riwayat }}</div>
            <div><span class="text-grey-400">Lokasi/organ:</span> {{ detail.lokasiAnatomi || "-" }}</div>
            <div><span class="text-grey-400">Cara pengambilan:</span> {{ detail.caraPengambilan || "-" }}</div>
            <div v-if="detail.catatan" class="col-span-2"><span class="text-grey-400">Catatan:</span> {{ detail.catatan }}</div>
            <div v-if="detail.status === 'batal'" class="col-span-2 text-danger-300">Alasan batal: {{ detail.alasanBatal }}</div>
          </div>
          <DataTable :value="detail.items" class="text-xs" stripedRows>
            <Column header="Pemeriksaan" headerClass="bg-opensimrs-50">
              <template #body="{ data: i }">
                {{ i.nama }} <span class="text-grey-300">· {{ i.kode }}</span>
                <div v-if="i.noPaInduk" class="text-grey-400">IHK pada blok kasus {{ i.noPaInduk }}</div>
              </template>
            </Column>
            <Column header="Jenis" headerClass="bg-opensimrs-50">
              <template #body="{ data: i }">{{ JENIS_PA[i.jenis as keyof typeof JENIS_PA]?.singkat ?? i.jenis }}</template>
            </Column>
            <Column header="No. PA" headerClass="bg-opensimrs-50">
              <template #body="{ data: i }"><b>{{ i.noPa ?? "-" }}</b></template>
            </Column>
            <Column header="Tarif" headerClass="bg-opensimrs-50">
              <template #body="{ data: i }">{{ rupiahPa(i.harga) }}</template>
            </Column>
            <Column header="Status" headerClass="bg-opensimrs-50">
              <template #body="{ data: i }">
                <span v-if="detail.status === 'batal'" class="font-semibold text-grey-400">Dibatalkan</span>
                <span v-else class="font-semibold" :class="gayaKasusPa(i.status)?.text">{{ gayaKasusPa(i.status)?.label ?? i.status }}</span>
                <div v-if="i.status === 'ditolak'" class="text-danger-300">{{ i.alasanTolak }}</div>
                <div v-if="i.ditolakEksternalPada" class="text-danger-300">Spesimen ditolak sistem PA tujuan: {{ i.ditolakEksternalAlasan }}</div>
              </template>
            </Column>
            <Column header="Kesimpulan" headerClass="bg-opensimrs-50">
              <template #body="{ data: i }">
                <div class="max-w-[260px] line-clamp-2">{{ i.status === "selesai" ? i.diagnosis : "-" }}</div>
              </template>
            </Column>
          </DataTable>
          <div class="font-semibold text-right">Total: {{ rupiahPa(detail.total) }}</div>
        </div>
      </template>
      <template #footer>
        <div v-if="detail" class="flex flex-wrap justify-end gap-2">
          <CustomButton v-if="bisaBatal() && boleh('BATAL')" label="Batalkan" icon="PhXCircle" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="bukaBatal" />
          <CustomButton v-if="boleh('CETAK')" label="Cetak Bukti Order" icon="PhPrinter" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="createBuktiOrderPaPdf(detail)" />
          <CustomButton
            v-if="detail.items?.some((i: any) => i.status === 'selesai') && (boleh('CETAK') || izinPa('Pemeriksaan', 'CETAK HASIL'))"
            label="Cetak Hasil"
            icon="PhFileText"
            outlined
            borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300"
            @click="createHasilPaPdf(detail)"
          />
          <CustomButton v-if="detail.status === 'order' && boleh('VALIDASI')" label="Validasi & Kirim Tagihan" icon="PhCheckCircle" @click="bukaDialogValidasi" />
        </div>
      </template>
    </CustomDialog>

    <!-- Validasi: saja / & kirim ke LIS PA -->
    <Dialog v-model:visible="dialogValidasi" modal header="Validasi Order PA" :style="{ width: '520px' }">
      <div class="flex flex-col gap-3 text-sm">
        <div>Validasi order <b>{{ detail?.noOrder }}</b> atas nama <b>{{ detail?.pasien?.name ?? detail?.namaPasien ?? "-" }}</b>? Tagihan dikirim ke Pembayaran.</div>
        <CustomSelect v-if="koneksiLisPa.length > 1" v-model="koneksiLisPaDipilih" label="Kirim ke LIS PA" :options="koneksiLisPa" optionValue="uuid" optionLabel="nama" />
        <div v-else-if="koneksiLisPa.length === 1" class="text-grey-400">LIS PA tujuan: {{ koneksiLisPa[0].nama }}</div>
        <div v-else class="p-3 rounded-md bg-[#FEF0C7] text-[#B54708]">Belum ada koneksi LIS PA aktif. Atur di Setting › Konfigurasi Integrasi › Konfigurasi LIS PA.</div>
      </div>
      <template #footer>
        <CustomButton label="Batal" textColor="text-[#9DA4B1]" backgroundColor="bg-transparent" borderColor="border-2 border-[#9DA4B1]" @click="dialogValidasi = false" />
        <CustomButton label="Validasi Saja" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="validasi(false)" />
        <CustomButton v-if="fiturAktif('pa_bridging_lis')" label="Validasi & Kirim ke LIS PA" icon="PhPaperPlaneTilt" :disabled="!koneksiLisPa.length" @click="validasi(true)" />
      </template>
    </Dialog>

    <!-- Batal -->
    <CustomDialog v-model:visible="dialogBatal" width="460px" headerBg="bg-danger-300">
      <template #header>Batalkan Order {{ detail?.noOrder }}</template>
      <template #body>
        <div class="flex flex-col gap-2 pt-4">
          <div v-if="detail?.status !== 'order'" class="text-sm text-grey-400">Item tagihan order ini akan dihapus dari Pembayaran.</div>
          <CustomTextArea v-model="alasanBatal" label="Alasan pembatalan" placeholder="mis. operasi ditunda, jaringan tidak jadi dikirim" required />
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

    <!-- Order APS / rujukan luar -->
    <CustomDialog v-model:visible="dialogOrder" width="900px">
      <template #header>Order Patologi Anatomi — APS / Rujukan Luar</template>
      <template #body>
        <div class="flex flex-col gap-4 pt-4">
          <div class="flex overflow-hidden border rounded-lg w-fit border-opensimrs-300">
            <button
              v-for="s in (['aps', 'rujukan'] as const)"
              :key="s"
              type="button"
              class="px-4 py-1.5 text-xs font-semibold"
              :class="formOrder.sumber === s ? 'bg-opensimrs-300 text-white' : 'text-opensimrs-300 bg-white'"
              @click="formOrder.sumber = s"
            >
              {{ s === "aps" ? "Atas Permintaan Sendiri (APS)" : "Rujukan Luar" }}
            </button>
          </div>
          <div>
            <div class="mb-1 text-sm font-semibold">Pasien</div>
            <div v-if="pasien" class="flex items-center justify-between p-3 rounded-lg bg-opensimrs-50">
              <div class="text-sm">
                <b>{{ pasien.name }}</b> · {{ pasien.noRm }} · {{ JK_PA[pasien.gender] ?? "-" }} · {{ umurPa(pasien.birthDate) }}
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
                <div v-for="p in hasilPasien" :key="p.uuid" class="flex justify-between px-3 py-2 text-sm border-b cursor-pointer border-grey-75 hover:bg-opensimrs-50" @click="pasien = p">
                  <span><b>{{ p.name }}</b> · {{ p.noRm }}</span>
                  <span class="text-grey-400">{{ JK_PA[p.gender] ?? "-" }} · {{ umurPa(p.birthDate) }}</span>
                </div>
              </div>
              <div class="text-xs text-grey-400">Pasien baru didaftarkan dahulu di Admisi (master pasien).</div>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-4">
            <template v-if="formOrder.sumber === 'aps'">
              <CustomSelect
                v-model="formOrder.dokterPengirimUuid"
                label="Dokter Pengirim (opsional)"
                placeHolder="Pilih dokter faskes"
                :options="dokter"
                optionValue="uuid"
                optionLabel="nama"
              />
            </template>
            <template v-else>
              <CustomTextfield v-model="formOrder.dokterPengirimLuar" label="Dokter Perujuk" placeholder="mis. dr. Andi, Sp.B" :maxLength="200" />
              <CustomTextfield v-model="formOrder.faskesPerujuk" label="Faskes Perujuk" placeholder="mis. RS Mitra / Klinik Sehat" :maxLength="200" />
            </template>
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
              <Checkbox v-model="formOrder.cito" binary inputId="pa-cito-aps" />
              <label for="pa-cito-aps" class="text-sm font-semibold text-danger-300">CITO (segera)</label>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <label class="flex flex-col gap-1 text-sm font-semibold">
              Lokasi / Organ Asal Jaringan
              <InputText v-model="formOrder.lokasiAnatomi" placeholder="mis. Serviks uteri / Tiroid lobus kanan" maxlength="200" class="text-sm font-normal" />
            </label>
            <label class="flex flex-col gap-1 text-sm font-semibold">
              Cara Pengambilan
              <InputText v-model="formOrder.caraPengambilan" list="pa-aps-cara-ambil" placeholder="mis. Biopsi eksisi / FNAB" maxlength="100" class="text-sm font-normal" />
              <datalist id="pa-aps-cara-ambil"><option v-for="c in SARAN_CARA_AMBIL_PA" :key="c" :value="c" /></datalist>
            </label>
            <CustomTextArea v-model="formOrder.klinis" label="Data Klinis / Diagnosis Klinis" placeholder="Keluhan, temuan, diagnosis kerja" />
            <CustomTextArea v-model="formOrder.riwayat" label="Riwayat Singkat" placeholder="mis. HPHT, riwayat PA sebelumnya" />
            <CustomTextArea v-model="formOrder.catatan" label="Catatan" placeholder="mis. nomor surat rujukan" class="col-span-2" />
          </div>
          <div>
            <div class="mb-1 text-sm font-semibold">Pemeriksaan</div>
            <PilihPemeriksaanPa ref="pemilih" v-model="formOrder.items" v-model:induk="formOrder.induk" :patientUuid="pasien?.uuid ?? ''" />
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
