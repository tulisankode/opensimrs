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
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  JENIS_PA,
  JK_PA,
  LATERALITAS_PA,
  OPSI_FIKSASI_PA,
  SARAN_ALASAN_TOLAK_PA,
  SARAN_CARA_AMBIL_PA,
  SARAN_SPESIMEN_PA,
  asalPa,
  detailKasusPa,
  gayaKasusPa,
  izinPa,
  keEpochPa,
  terimaSpesimenPa,
  tolakSpesimenPa,
  umurPa,
  validasiOrderPa,
  waktuPa,
  worklistPa,
} from "@/stores/penunjang/patologi";
import { createLabelWadahPaPdf } from "@/utils/pdf/pdfPatologi/cetakPatologi";

// Penerimaan jaringan/spesimen PA: kasus yang menunggu jaringan (order tervalidasi; order belum divalidasi dapat
// divalidasi langsung, mis. potong beku CITO). Terima → nomor PA otomatis (PA-/SIT-/FS-/IHK-YY-NNNNN) + label wadah;
// tolak dengan alasan (spesimen dapat dikirim ulang lalu diterima).
const storeUtils = utilsStore();
// Hak akses tombol (Setting › Hak Akses › Patologi Anatomi): validasi = Order PA › VALIDASI; terima/tolak = Penerimaan Jaringan.
const boleh = (aksi: string) => izinPa("Penerimaan Jaringan", aksi);
const bolehValidasi = izinPa("Order PA", "VALIDASI");

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");
const TAMPILAN: Record<string, { label: string; status: string[] }> = {
  menunggu: { label: "Menunggu jaringan", status: ["menunggu", "ditolak"] },
  diterima: { label: "Sudah diterima", status: ["diterima", "diproses", "verifikasi", "selesai"] },
};
const tampilan = ref<"menunggu" | "diterima">("menunggu");
const filterJenis = ref<string[]>([]);
const belumValidasi = ref(true);
const hanyaCito = ref(false);

const toggleJenis = (j: string) => {
  filterJenis.value = filterJenis.value.includes(j) ? filterJenis.value.filter((x) => x !== j) : [...filterJenis.value, j];
};

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await worklistPa({
      page: page.value,
      limit: limit.value,
      cari: cari.value,
      status: TAMPILAN[tampilan.value].status,
      jenis: filterJenis.value,
      cito: hanyaCito.value ? 1 : "",
      belum_validasi: tampilan.value === "menunggu" && belumValidasi.value ? 1 : "",
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
const gantiTampilan = (t: "menunggu" | "diterima") => {
  tampilan.value = t;
  cariData();
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

const validasi = async (d: any) => {
  storeUtils.setLoading(true);
  try {
    if (await validasiOrderPa(d.orderUuid)) muat();
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Terima
const FIKSASI_BAWAAN: Record<string, string> = { histopatologi: "formalin_10", sitologi: "alkohol_95", potong_beku: "tanpa_fiksasi", ihk: "lainnya" };
const dialogTerima = ref(false);
const aktif = ref<any>(null);
const kosongForm = () => ({
  jenisSpesimen: "",
  lokasiAnatomi: "",
  lateralitas: "",
  caraPengambilan: "",
  jumlahWadah: 1,
  fiksasi: "formalin_10",
  waktuPengambilan: null as Date | null,
  waktuTerima: new Date() as Date | null,
  kondisi: "",
  catatan: "",
});
const form = ref(kosongForm());
const galat = ref("");
const bukaTerima = async (d: any) => {
  galat.value = "";
  aktif.value = d;
  const det = (await detailKasusPa(d.uuid))?.payload;
  const o = det?.order ?? {};
  form.value = {
    ...kosongForm(),
    jenisSpesimen: d.jenis === "ihk" ? `Blok parafin kasus ${det?.induk?.noPa ?? d.noPaInduk ?? ""}`.trim() : "",
    lokasiAnatomi: det?.lokasiAnatomi ?? o.lokasiAnatomi ?? "",
    caraPengambilan: o.caraPengambilan ?? "",
    fiksasi: FIKSASI_BAWAAN[d.jenis] ?? "formalin_10",
  };
  dialogTerima.value = true;
};
const hasilTerima = ref<any>(null);
const simpanTerima = async () => {
  const f = form.value;
  galat.value = "";
  if (!f.jenisSpesimen.trim() || !f.lokasiAnatomi.trim()) return (galat.value = "Jenis spesimen dan lokasi/organ wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await terimaSpesimenPa(aktif.value.uuid, {
      jenisSpesimen: f.jenisSpesimen,
      lokasiAnatomi: f.lokasiAnatomi,
      lateralitas: f.lateralitas || null,
      caraPengambilan: f.caraPengambilan,
      jumlahWadah: f.jumlahWadah,
      fiksasi: f.fiksasi || null,
      waktuPengambilan: keEpochPa(f.waktuPengambilan),
      waktuTerima: keEpochPa(f.waktuTerima),
      kondisi: f.kondisi,
      catatan: f.catatan,
    });
    if (res?.payload) {
      dialogTerima.value = false;
      hasilTerima.value = res.payload;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const cetakLabel = async (d: any) => {
  const det = (await detailKasusPa(d.uuid))?.payload;
  if (det) createLabelWadahPaPdf(det);
};

// ── Tolak
const dialogTolak = ref(false);
const alasanTolak = ref("");
const galatTolak = ref("");
const bukaTolak = (d: any) => {
  aktif.value = d;
  alasanTolak.value = "";
  galatTolak.value = "";
  dialogTolak.value = true;
};
const simpanTolak = async () => {
  if (!alasanTolak.value.trim()) return (galatTolak.value = "Alasan penolakan wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await tolakSpesimenPa(aktif.value.uuid, { alasanTolak: alasanTolak.value.trim(), lokasiAnatomi: aktif.value.lokasiAnatomiOrder ?? null });
    if (res) {
      dialogTolak.value = false;
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
          <h1 class="toolbar-heading text-opensimrs-300">Penerimaan Jaringan</h1>
          <div class="flex overflow-hidden border rounded-lg shrink-0 border-opensimrs-300">
            <button
              v-for="(t, kode) in TAMPILAN"
              :key="kode"
              type="button"
              class="px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
              :class="tampilan === kode ? 'bg-opensimrs-300 text-white' : 'text-opensimrs-300 bg-white'"
              @click="gantiTampilan(kode as 'menunggu' | 'diterima')"
            >
              {{ t.label }}
            </button>
          </div>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nama / No. RM / No. Order / No. PA" :maxLength="100" @keydown.enter="cariData" />
          <ToolbarFilterMenu :count="filterJenis.length + (hanyaCito ? 1 : 0) + (belumValidasi && tampilan === 'menunggu' ? 1 : 0)">
            <template #label>Filter</template>
            <CustomChip v-for="(j, kode) in JENIS_PA" :key="kode" :label="j.label" :value="String(kode)" :isSelected="filterJenis.includes(String(kode))" @selected="toggleJenis" />
            <CustomChip label="Hanya CITO" :isSelected="hanyaCito" @selected="hanyaCito = !hanyaCito" />
            <CustomChip v-if="tampilan === 'menunggu'" label="Termasuk order belum divalidasi" :isSelected="belumValidasi" @selected="belumValidasi = !belumValidasi" />
          </ToolbarFilterMenu>
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 64rem">
          <Column header="Order" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">
                <span v-if="d.cito" class="px-1.5 mr-1 text-[10px] font-bold text-white rounded bg-danger-300">CITO</span>{{ d.noOrder }}
              </div>
              <div class="text-grey-400">{{ waktuPa(d.waktuOrder) }}</div>
            </template>
          </Column>
          <Column header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.namaPasien ?? "-" }}</div>
              <div class="text-grey-400">{{ d.noRm }} · {{ JK_PA[d.gender] ?? "-" }} · {{ umurPa(d.birthDate) }}</div>
            </template>
          </Column>
          <Column header="Pemeriksaan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.nama }}</div>
              <div class="text-grey-400">
                {{ JENIS_PA[d.jenis as keyof typeof JENIS_PA]?.singkat }}<span v-if="d.noPaInduk"> · blok {{ d.noPaInduk }}</span>
              </div>
            </template>
          </Column>
          <Column header="Asal / Klinis" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div>{{ asalPa(d) }} · {{ d.dokterPengirim ?? "-" }}</div>
              <div class="max-w-[260px] truncate text-grey-400" :title="d.klinis">{{ d.lokasiAnatomi ?? d.lokasiAnatomiOrder ?? "" }} {{ d.klinis ? `— ${d.klinis}` : "" }}</div>
            </template>
          </Column>
          <Column header="No. PA / Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div v-if="d.noPa" class="font-semibold">{{ d.noPa }}</div>
              <span v-if="d.statusOrder === 'order'" class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-grey-50 text-grey-500">Belum divalidasi</span>
              <span v-else class="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap" :class="[gayaKasusPa(d.status)?.bg, gayaKasusPa(d.status)?.text]">
                {{ gayaKasusPa(d.status)?.label }}
              </span>
              <div v-if="d.status === 'ditolak'" class="max-w-[200px] mt-0.5 text-danger-300">{{ d.alasanTolak }}</div>
              <div v-if="d.waktuTerima" class="text-grey-400">Diterima {{ waktuPa(d.waktuTerima) }}</div>
            </template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[230px]">
            <template #body="{ data: d }">
              <div class="flex flex-wrap gap-2">
                <template v-if="d.statusOrder === 'order'">
                  <CustomButton v-if="bolehValidasi" label="Validasi" icon="PhCheckCircle" size="small" @click="validasi(d)" />
                  <span v-else class="text-grey-400">Menunggu validasi order</span>
                </template>
                <template v-else-if="['menunggu', 'ditolak'].includes(d.status)">
                  <CustomButton v-if="boleh('TERIMA')" label="Terima" icon="PhCheck" size="small" @click="bukaTerima(d)" />
                  <CustomButton v-if="d.status === 'menunggu' && boleh('TOLAK')" label="Tolak" icon="PhX" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="bukaTolak(d)" />
                </template>
                <CustomButton v-else label="Label Wadah" icon="PhTag" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cetakLabel(d)" />
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

    <!-- Terima -->
    <CustomDialog v-model:visible="dialogTerima" width="760px">
      <template #header>Terima Jaringan / Spesimen</template>
      <template #body>
        <div v-if="aktif" class="flex flex-col gap-4 pt-4">
          <div class="p-3 text-sm rounded-lg bg-opensimrs-50">
            <b>{{ aktif.nama }}</b> · {{ aktif.namaPasien }} ({{ aktif.noRm }}) · {{ aktif.noOrder }}
            <span v-if="aktif.cito" class="ml-1 font-bold text-danger-300">CITO</span>
            <div v-if="aktif.klinis" class="text-grey-500">Klinis: {{ aktif.klinis }}</div>
            <div v-if="aktif.status === 'ditolak'" class="text-danger-300">Sebelumnya ditolak: {{ aktif.alasanTolak }}</div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <label class="flex flex-col gap-1 text-sm font-semibold">
              <span>Jenis Spesimen <span class="text-danger-300">*</span></span>
              <InputText v-model="form.jenisSpesimen" list="pa-saran-spesimen" placeholder="mis. Jaringan eksisi" maxlength="200" class="text-sm font-normal" />
              <datalist id="pa-saran-spesimen"><option v-for="s in SARAN_SPESIMEN_PA" :key="s" :value="s" /></datalist>
            </label>
            <label class="flex flex-col gap-1 text-sm font-semibold">
              <span>Lokasi Anatomi / Organ <span class="text-danger-300">*</span></span>
              <InputText v-model="form.lokasiAnatomi" placeholder="mis. Mammae sinistra" maxlength="200" class="text-sm font-normal" />
            </label>
            <CustomSelect
              v-model="form.lateralitas"
              label="Lateralitas"
              placeHolder="Tidak berlaku"
              :options="Object.entries(LATERALITAS_PA).map(([value, label]) => ({ value, label }))"
              optionValue="value"
              optionLabel="label"
              :showFilter="false"
            />
            <label class="flex flex-col gap-1 text-sm font-semibold">
              Cara Pengambilan
              <InputText v-model="form.caraPengambilan" list="pa-saran-cara" placeholder="mis. Biopsi eksisi" maxlength="100" class="text-sm font-normal" />
              <datalist id="pa-saran-cara"><option v-for="c in SARAN_CARA_AMBIL_PA" :key="c" :value="c" /></datalist>
            </label>
            <CustomInputNumber v-model="form.jumlahWadah" label="Jumlah Wadah" :min="0" :max="50" />
            <CustomSelect v-model="form.fiksasi" label="Fiksasi" :options="OPSI_FIKSASI_PA" optionValue="value" optionLabel="label" :showFilter="false" />
            <CustomDatePicker v-model="form.waktuPengambilan" label="Waktu Pengambilan" showTime :maxDate="new Date()" />
            <CustomDatePicker v-model="form.waktuTerima" label="Waktu Penerimaan" showTime :maxDate="new Date()" />
            <CustomTextArea v-model="form.kondisi" label="Kondisi Spesimen" placeholder="mis. wadah utuh, formalin cukup, label sesuai" />
            <CustomTextArea v-model="form.catatan" label="Catatan" placeholder="Wajib bila jaringan histopatologi tidak difiksasi formalin 10%" />
          </div>
          <div v-if="galat" class="text-sm text-danger-300">{{ galat }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogTerima = false" />
          <CustomButton label="Terima & Beri Nomor PA" icon="PhCheckCircle" @click="simpanTerima" />
        </div>
      </template>
    </CustomDialog>

    <!-- Hasil terima: nomor PA + label -->
    <CustomDialog :visible="!!hasilTerima" width="420px" @update:visible="(v: boolean) => !v && (hasilTerima = null)">
      <template #header>Jaringan Diterima</template>
      <template #body>
        <div v-if="hasilTerima" class="flex flex-col items-center gap-2 pt-4 text-center">
          <div class="text-sm text-grey-400">Nomor PA</div>
          <div class="text-2xl font-bold text-opensimrs-400">{{ hasilTerima.noPa }}</div>
          <div class="text-sm">{{ hasilTerima.nama }} · {{ hasilTerima.order?.pasien?.name }}</div>
          <div class="text-xs text-grey-400">Target selesai: {{ waktuPa(hasilTerima.targetSelesai, true) }} ({{ hasilTerima.tatHari }} hari)</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="hasilTerima = null" />
          <CustomButton label="Cetak Label Wadah" icon="PhTag" @click="createLabelWadahPaPdf(hasilTerima)" />
        </div>
      </template>
    </CustomDialog>

    <!-- Tolak -->
    <CustomDialog v-model:visible="dialogTolak" width="520px" headerBg="bg-danger-300">
      <template #header>Tolak Spesimen</template>
      <template #body>
        <div v-if="aktif" class="flex flex-col gap-3 pt-4">
          <div class="text-sm"><b>{{ aktif.nama }}</b> · {{ aktif.namaPasien }} ({{ aktif.noRm }})</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="a in SARAN_ALASAN_TOLAK_PA"
              :key="a"
              type="button"
              class="px-2 py-1 text-xs border rounded-full border-grey-200 text-grey-500 hover:border-danger-300"
              @click="alasanTolak = alasanTolak ? `${alasanTolak}; ${a}` : a"
            >
              {{ a }}
            </button>
          </div>
          <CustomTextArea v-model="alasanTolak" label="Alasan penolakan" placeholder="Alasan & tindak lanjut (mis. minta kirim ulang)" required />
          <div class="text-xs text-grey-400">Spesimen dapat dikirim ulang dan diterima kembali dari daftar ini. Tagihan tidak berubah; batalkan order bila pemeriksaan tidak dilanjutkan.</div>
          <div v-if="galatTolak" class="text-sm text-danger-300">{{ galatTolak }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Kembali" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogTolak = false" />
          <CustomButton label="Tolak Spesimen" backgroundColor="bg-danger-300" @click="simpanTolak" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
