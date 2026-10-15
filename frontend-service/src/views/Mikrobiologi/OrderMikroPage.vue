<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
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
import PilihPemeriksaanMikro from "@/components/RekamMedis/OrderMikro/PilihPemeriksaanMikro.vue";
import { utilsStore } from "@/stores/utils";
import {
  PELAYANAN_MIKRO,
  STATUS_ORDER_MIKRO,
  SUMBER_MIKRO,
  batalOrderMikro,
  buatOrderMikro,
  cariPasienMikro,
  daftarDokterMikro,
  daftarOrderMikro,
  detailOrderMikro,
  gayaItemMikro,
  gayaOrderMikro,
  izinMikro,
  keTanggal,
  namaSpesimen,
  rupiahMikro,
  umurMikro,
  validasiOrderMikro,
  waktuMikro,
  type ItemOrderMikroInput,
} from "@/stores/penunjang/mikrobiologi";
import { createBuktiOrderMikroPdf, createHasilMikroPdf } from "@/utils/pdf/pdfMikrobiologi/cetakMikrobiologi";

// Order Mikrobiologi: daftar order (RME / APS), validasi (tagihan dikirim ke Pembayaran), batal (tagihan dihapus),
// cetak bukti order & hasil, dan order APS baru untuk pasien terdaftar (pemeriksaan + jenis & sumber spesimen).
const storeUtils = utilsStore();
const router = useRouter();
const boleh = (aksi: string) => izinMikro("Order Mikrobiologi", aksi);

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");
const tglMulai = ref<Date | null>(new Date());
const tglSelesai = ref<Date | null>(new Date());
const filterStatus = ref<string[]>([]);
const filterSumber = ref<string[]>([]);
const FILTER = { status: filterStatus, sumber: filterSumber };
const toggle = (jenis: keyof typeof FILTER, nilai: string) => {
  const d = FILTER[jenis];
  d.value = d.value.includes(nilai) ? d.value.filter((x) => x !== nilai) : [...d.value, nilai];
};

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarOrderMikro({
      page: page.value,
      limit: limit.value,
      cari: cari.value,
      status: filterStatus.value,
      sumber: filterSumber.value,
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
    const res = await detailOrderMikro(uuid);
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
    const res = await validasiOrderMikro(detail.value.uuid);
    if (res?.payload) {
      await bukaDetail(detail.value.uuid);
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
    const res = await batalOrderMikro(detail.value.uuid, alasanBatal.value.trim());
    if (res?.payload) {
      dialogBatal.value = false;
      detail.value = res.payload;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const bisaBatal = computed(() => detail.value && ["order", "valid"].includes(detail.value.status) && !(detail.value.items ?? []).some((i: any) => !["menunggu", "ditolak"].includes(i.status)));
const adaHasil = computed(() => (detail.value?.items ?? []).some((i: any) => ["sementara", "final"].includes(i.hasil?.status)));
const cetakBukti = () => detail.value && createBuktiOrderMikroPdf(detail.value);
const cetakHasil = () => detail.value && createHasilMikroPdf(detail.value);
const keWorklist = () => router.push({ path: "/mikrobiologi/pemeriksaan", query: { cari: detail.value?.noOrder } });

// ── Order APS baru
const dialogOrder = ref(false);
const kataPasien = ref("");
const hasilPasien = ref<any[]>([]);
const pasien = ref<any>(null);
const dokter = ref<any[]>([]);
const kosongOrder = () => ({ dokterPengirimUuid: "", paymentMethod: 1, klinis: "", antibiotikSedang: "", catatan: "", cito: false, items: [] as ItemOrderMikroInput[] });
const formOrder = ref(kosongOrder());
const kunciPilih = ref(0);
const galatOrder = ref("");
const bukaOrder = async () => {
  kataPasien.value = "";
  hasilPasien.value = [];
  pasien.value = null;
  galatOrder.value = "";
  formOrder.value = kosongOrder();
  kunciPilih.value++;
  dialogOrder.value = true;
  if (!dokter.value.length) dokter.value = (await daftarDokterMikro())?.payload ?? [];
};
const cariPasien = async () => {
  const res = await cariPasienMikro(kataPasien.value);
  hasilPasien.value = res?.payload ?? [];
};
const kirimOrder = async () => {
  galatOrder.value = "";
  if (!pasien.value) return (galatOrder.value = "Pilih pasien terlebih dahulu");
  const items = formOrder.value.items.filter((i) => i.pemeriksaanUuid);
  if (!items.length) return (galatOrder.value = "Pilih minimal satu pemeriksaan");
  if (items.some((i) => !i.jenisSpesimen)) return (galatOrder.value = "Jenis spesimen wajib dipilih pada setiap pemeriksaan");
  storeUtils.setLoading(true);
  try {
    const res = await buatOrderMikro({
      sumber: "aps",
      patientUuid: pasien.value.uuid,
      dokterPengirimUuid: formOrder.value.dokterPengirimUuid || null,
      paymentMethod: formOrder.value.paymentMethod,
      klinis: formOrder.value.klinis,
      antibiotikSedang: formOrder.value.antibiotikSedang,
      catatan: formOrder.value.catatan,
      cito: formOrder.value.cito,
      items,
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

const JK: Record<string, string> = { Male: "L", Female: "P", "Laki-laki": "L", Perempuan: "P" };
onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Order Mikrobiologi</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nama / No. RM / No. Order" :maxLength="100" @keydown.enter="cariData" />
          <CustomDatePicker v-model="tglMulai" label="Tanggal mulai" class="toolbar-field--date" :maxDate="tglSelesai ?? undefined" />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker v-model="tglSelesai" label="Tanggal selesai" class="toolbar-field--date" :minDate="tglMulai ?? undefined" />
          <ToolbarFilterMenu :count="filterStatus.length">
            <template #label>Status</template>
            <CustomChip
              v-for="(s, kode) in STATUS_ORDER_MIKRO"
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
              v-for="(s, kode) in SUMBER_MIKRO"
              :key="kode"
              :label="s"
              :value="String(kode)"
              :isSelected="filterSumber.includes(String(kode))"
              @selected="toggle('sumber', $event)"
            />
          </ToolbarFilterMenu>
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="reset" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Order APS" @click="bukaOrder" />
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
              <div class="text-grey-400">{{ waktuMikro(d.createdAt) }}</div>
            </template>
          </Column>
          <Column header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.namaPasien ?? "-" }}</div>
              <div class="text-grey-400">{{ d.noRm }} · {{ JK[d.gender] ?? "-" }} · {{ umurMikro(d.birthDate) }}</div>
            </template>
          </Column>
          <Column header="Asal" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div>{{ SUMBER_MIKRO[d.sumber] }} · {{ PELAYANAN_MIKRO[d.pelayanan] ?? d.pelayanan }}</div>
              <div class="text-grey-400">{{ d.lokasiAsal ?? d.noReg ?? "" }}</div>
            </template>
          </Column>
          <Column header="Pemeriksaan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span v-if="d.cito" class="px-1.5 mr-1 text-[10px] font-bold text-white rounded bg-danger-300">CITO</span>
              {{ d.pemeriksaan ?? "-" }}
              <div class="text-grey-400">
                {{ d.jumlahFinal }}/{{ d.jumlahItem }} final<span v-if="d.jumlahSementara"> · {{ d.jumlahSementara }} sementara</span>
                <span v-if="d.jumlahDitolak" class="text-danger-300"> · {{ d.jumlahDitolak }} ditolak</span>
              </div>
            </template>
          </Column>
          <Column header="Dokter Pengirim" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.dokterPengirim ?? "-" }}</template>
          </Column>
          <Column header="Total" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ rupiahMikro(d.total) }}</template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-xs font-semibold" :class="[gayaOrderMikro(d.status)?.bg, gayaOrderMikro(d.status)?.text]">
                {{ gayaOrderMikro(d.status)?.label ?? d.status }}
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
    <CustomDialog v-model:visible="dialogDetail" width="900px">
      <template #header>Order {{ detail?.noOrder }}</template>
      <template #body>
        <div v-if="detail" class="flex flex-col gap-4 pt-4 text-sm">
          <div class="grid grid-cols-2 gap-x-6 gap-y-1">
            <div><span class="text-grey-400">Pasien:</span> <b>{{ detail.pasien?.name ?? detail.namaPasien }}</b> ({{ detail.noRm }})</div>
            <div>
              <span class="text-grey-400">Status:</span>
              <span class="px-2 py-0.5 ml-1 rounded-full text-xs font-semibold" :class="[gayaOrderMikro(detail.status)?.bg, gayaOrderMikro(detail.status)?.text]">
                {{ gayaOrderMikro(detail.status)?.label }}
              </span>
              <span v-if="detail.cito" class="px-1.5 ml-1 text-[10px] font-bold text-white rounded bg-danger-300">CITO</span>
            </div>
            <div><span class="text-grey-400">Umur / JK:</span> {{ umurMikro(detail.pasien?.birthDate) }} / {{ JK[detail.pasien?.gender] ?? "-" }}</div>
            <div><span class="text-grey-400">Tgl. order:</span> {{ waktuMikro(detail.createdAt) }}</div>
            <div><span class="text-grey-400">Asal:</span> {{ SUMBER_MIKRO[detail.sumber] }} · {{ PELAYANAN_MIKRO[detail.pelayanan] }} {{ detail.noReg ? `(${detail.noReg})` : "" }}</div>
            <div><span class="text-grey-400">Dokter pengirim:</span> {{ detail.dokterPengirim ?? "-" }}</div>
            <div><span class="text-grey-400">Pembayaran:</span> {{ detail.paymentMethod === 2 ? "Asuransi" : "Tunai" }}</div>
            <div v-if="detail.divalidasiPada"><span class="text-grey-400">Validasi:</span> {{ waktuMikro(detail.divalidasiPada) }} · {{ detail.divalidasiOleh }}</div>
            <div class="col-span-2"><span class="text-grey-400">Klinis:</span> {{ detail.klinis || "-" }}</div>
            <div class="col-span-2"><span class="text-grey-400">Antibiotik yang sedang diberikan:</span> {{ detail.antibiotikSedang || "-" }}</div>
            <div v-if="detail.catatan" class="col-span-2"><span class="text-grey-400">Catatan:</span> {{ detail.catatan }}</div>
            <div v-if="detail.status === 'batal'" class="col-span-2 text-danger-300">Alasan batal: {{ detail.alasanBatal }}</div>
          </div>
          <DataTable :value="detail.items" class="text-xs" stripedRows>
            <Column header="Pemeriksaan" headerClass="bg-opensimrs-50">
              <template #body="{ data: i }">{{ i.nama }} <span class="text-grey-300">· {{ i.kode }}</span></template>
            </Column>
            <Column header="Spesimen" headerClass="bg-opensimrs-50">
              <template #body="{ data: i }">
                {{ namaSpesimen(i.jenisSpesimen) }}
                <div class="text-grey-400">{{ i.lokasiSpesimen ?? "" }}</div>
              </template>
            </Column>
            <Column header="No. Mikro" headerClass="bg-opensimrs-50">
              <template #body="{ data: i }">{{ i.noMikro ?? "-" }}</template>
            </Column>
            <Column header="Tarif" headerClass="bg-opensimrs-50">
              <template #body="{ data: i }">{{ rupiahMikro(i.harga) }}</template>
            </Column>
            <Column header="Status" headerClass="bg-opensimrs-50">
              <template #body="{ data: i }">
                <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap" :class="[gayaItemMikro(i.status)?.bg, gayaItemMikro(i.status)?.text]">
                  {{ gayaItemMikro(i.status)?.label ?? i.status }}
                </span>
                <div v-if="i.alasanTolak" class="text-danger-300">{{ i.alasanTolak }}</div>
              </template>
            </Column>
            <Column header="Organisme" headerClass="bg-opensimrs-50">
              <template #body="{ data: i }"><i>{{ i.organisme ?? "-" }}</i></template>
            </Column>
          </DataTable>
          <div class="font-semibold text-right">Total: {{ rupiahMikro(detail.total) }}</div>
        </div>
      </template>
      <template #footer>
        <div v-if="detail" class="flex flex-wrap justify-end gap-2">
          <CustomButton v-if="bisaBatal && boleh('BATAL')" label="Batalkan" icon="PhXCircle" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="bukaBatal" />
          <CustomButton v-if="boleh('CETAK')" label="Cetak Bukti Order" icon="PhPrinter" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cetakBukti" />
          <CustomButton v-if="adaHasil" label="Cetak Hasil" icon="PhFileText" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cetakHasil" />
          <CustomButton v-if="['valid', 'diproses'].includes(detail.status)" label="Ke Pemeriksaan" icon="PhArrowRight" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="keWorklist" />
          <CustomButton v-if="detail.status === 'order' && boleh('VALIDASI')" label="Validasi & Kirim Tagihan" icon="PhCheckCircle" @click="validasi" />
        </div>
      </template>
    </CustomDialog>

    <!-- Batal -->
    <CustomDialog v-model:visible="dialogBatal" width="460px" headerBg="bg-danger-300">
      <template #header>Batalkan Order {{ detail?.noOrder }}</template>
      <template #body>
        <div class="flex flex-col gap-2 pt-4">
          <div v-if="detail?.status === 'valid'" class="text-sm text-grey-400">Item tagihan order ini akan dihapus dari Pembayaran.</div>
          <CustomTextArea v-model="alasanBatal" label="Alasan pembatalan" placeholder="mis. pasien menolak pengambilan spesimen" required />
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
    <CustomDialog v-model:visible="dialogOrder" width="960px">
      <template #header>Order Mikrobiologi APS (Atas Permintaan Sendiri / Rujukan Luar)</template>
      <template #body>
        <div class="flex flex-col gap-4 pt-4">
          <div>
            <div class="mb-1 text-sm font-semibold">Pasien</div>
            <div v-if="pasien" class="flex items-center justify-between p-3 rounded-lg bg-opensimrs-50">
              <div class="text-sm">
                <b>{{ pasien.name }}</b> · {{ pasien.noRm }} · {{ JK[pasien.gender] ?? "-" }} · {{ umurMikro(pasien.birthDate) }}
                <span v-if="pasien.noIdentity" class="text-grey-400">· NIK {{ pasien.noIdentity }}</span>
              </div>
              <CustomButton label="Ganti" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="pasien = null" />
            </div>
            <div v-else class="flex flex-col gap-2">
              <div class="flex gap-2">
                <InputText v-model="kataPasien" placeholder="Cari nama / No. RM / NIK pasien terdaftar" class="text-sm grow" @keydown.enter="cariPasien" />
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
                  <span class="text-grey-400">{{ JK[p.gender] ?? "-" }} · {{ umurMikro(p.birthDate) }}</span>
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
              <Checkbox v-model="formOrder.cito" binary inputId="mikro-cito-aps" />
              <label for="mikro-cito-aps" class="text-sm font-semibold text-danger-300">CITO (segera)</label>
            </div>
          </div>
          <div>
            <div class="mb-1 text-sm font-semibold">Pemeriksaan &amp; Spesimen</div>
            <PilihPemeriksaanMikro :key="kunciPilih" v-model="formOrder.items" />
          </div>
          <div class="grid grid-cols-3 gap-4">
            <CustomTextArea v-model="formOrder.klinis" label="Keterangan Klinis / Diagnosis" placeholder="Indikasi pemeriksaan" />
            <CustomTextArea v-model="formOrder.antibiotikSedang" label="Antibiotik yang Sedang Diberikan" placeholder="Nama, dosis, sejak kapan" />
            <CustomTextArea v-model="formOrder.catatan" label="Catatan" placeholder="mis. nomor surat rujukan" />
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
