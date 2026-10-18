<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useToast } from "primevue/usetoast";
import CustomButton from "@/components/Base/CustomButton.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import FormSuratVclaim from "./Section/FormSuratVclaim.vue";
import { useBpjsVclaimStore, STATUS_SURAT, bolehSurat, type JenisSuratVclaim } from "@/stores/bpjsVclaim";
import { utilsStore } from "@/stores/utils";
import { epochToDate } from "@/utils/Helpers";
import { cetakSuratVclaim, tglIndo } from "@/utils/pdf/pdfBpjs/cetakSuratVclaim";

// Admisi › Rencana Kontrol & SPRI (STD-0021, fitur vclaim_rencana_kontrol): daftar & pemantauan surat VClaim
// (jatuh tempo, sudah/belum dipakai SEP), pembuatan, perubahan, penghapusan, cetak, dan "Cek status di VClaim"
// untuk surat yang hasil pengirimannya tidak pasti. Tombol mengikuti izin Admisi › Rencana Kontrol & SPRI.
const route = useRoute();
const store = useBpjsVclaimStore();
const storeUtils = utilsStore();
const toast = useToast();

const jenis = computed<JenisSuratVclaim>(() => (route.path.startsWith("/admisi/spri") ? "spri" : "rencana-kontrol"));
const spri = computed(() => jenis.value === "spri");
const judul = computed(() => (spri.value ? "SPRI (Surat Perintah Rawat Inap)" : "Rencana Kontrol"));
const izin = computed(() => ({
  buat: bolehSurat(spri.value ? "CREATE SPRI" : "CREATE RENCANA KONTROL"),
  ubah: bolehSurat(spri.value ? "UPDATE SPRI" : "UPDATE RENCANA KONTROL"),
  hapus: bolehSurat(spri.value ? "DELETE SPRI" : "DELETE RENCANA KONTROL"),
}));

const OPSI_STATUS = [
  { value: "", label: "Semua (belum dihapus)" },
  ...Object.entries(STATUS_SURAT).map(([value, s]) => ({ value, label: s.label })),
];

const konfigurasi = ref<any>(null);
const baris = ref<any[]>([]);
const total = ref(0);
const halaman = ref(1);
const perHalaman = ref(10);
const cari = ref("");
const filterStatus = ref("");
const dari = ref("");
const sampai = ref("");
const formulir = ref<{ mode: "buat" | "ubah"; surat?: any } | null>(null);
const suratDihapus = ref<any>(null);
const kandidat = ref<{ surat: any; daftar: any[] } | null>(null);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await store.getSurat(jenis.value, {
      page: halaman.value, limit: perHalaman.value, q: cari.value.trim(), status: filterStatus.value, dari: dari.value, sampai: sampai.value,
    });
    if (res?.gagal) {
      toast.add({ severity: "warn", summary: judul.value, detail: res.message, life: 6000 });
      baris.value = [];
      total.value = 0;
      return;
    }
    baris.value = res?.payload ?? [];
    total.value = res?.pagination?.total ?? 0;
  } finally {
    storeUtils.setLoading(false);
  }
};

const cariData = () => {
  halaman.value = 1;
  muat();
};

const onPage = (event: { page: number; rows: number }) => {
  halaman.value = event.page + 1;
  perHalaman.value = event.rows;
  muat();
};

const selesaiFormulir = () => {
  formulir.value = null;
  cariData();
};

const bisaDiubah = (s: any) => ["aktif", "jatuh_tempo"].includes(s.status);
const perluCek = (s: any) => s.status === "tidak_pasti" || (s.status === "diajukan" && Date.now() / 1000 - Number(s.updatedAt) > 120);

const hapus = async () => {
  const s = suratDihapus.value;
  suratDihapus.value = null;
  if (!s) return;
  storeUtils.setLoading(true);
  try {
    const res = await store.hapusSurat(jenis.value, s.uuid);
    if (res?.gagal) toast.add({ severity: "error", summary: "Surat gagal dihapus", detail: res.message, life: 8000 });
    else if (res) toast.add({ severity: "success", summary: res.message, detail: s.noSurat, life: 4000 });
  } finally {
    storeUtils.setLoading(false);
  }
  await muat();
};

const cekStatus = async (s: any, noSurat = "") => {
  storeUtils.setLoading(true);
  try {
    const res = await store.cekStatusSurat(jenis.value, s.uuid, noSurat);
    if (res?.gagal) {
      toast.add({ severity: "error", summary: "Cek status di VClaim", detail: res.message, life: 8000 });
    } else if (res?.payload) {
      kandidat.value = res.payload.statusOperasi === "tidak_pasti" && res.payload.kandidat?.length ? { surat: s, daftar: res.payload.kandidat } : null;
      toast.add({ severity: kandidat.value ? "warn" : "success", summary: "Cek status di VClaim", detail: res.message, life: 7000 });
    }
  } finally {
    storeUtils.setLoading(false);
  }
  await muat();
};

const cetak = (s: any) =>
  cetakSuratVclaim({ ...s, jenis: spri.value ? "spri" : "rencana_kontrol" });

const SUMBER: Record<string, string> = { rawat_jalan: "Rawat Jalan", rawat_inap: "Rawat Inap", igd: "IGD" };
const sumberLabel = (s: string) => SUMBER[s] ?? s ?? "-";
const dibuat = (epoch: number) => (epoch ? epochToDate(Number(epoch), "dateTime") : "-");

watch(jenis, () => {
  formulir.value = null;
  cari.value = "";
  filterStatus.value = "";
  cariData();
});
onMounted(async () => {
  muat();
  const res = await store.getKonfigurasi();
  konfigurasi.value = res?.gagal ? null : res?.payload ?? null;
});
</script>

<template>
  <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto">
    <template #header>
      <PageToolbar>
        <h1 class="toolbar-heading text-opensimrs-300">{{ judul }} · BPJS</h1>
        <CustomChip
          v-if="konfigurasi?.mode === 'mock'"
          label="VClaim simulasi"
          :show-checked-icon="false"
          bg-color="bg-[#FEF0C7]"
          border-color="border-transparent"
          text-color="text-[#B54708]"
        />
        <template v-if="!formulir">
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="No. surat / kartu / RM / nama pasien" @keyup.enter="cariData" />
          <CustomSelect v-model="filterStatus" label="Status" :options="OPSI_STATUS" optionValue="value" optionLabel="label" @update:modelValue="cariData" />
          <CustomTextfield v-model="dari" label="Rencana dari" type="date" @update:modelValue="cariData" />
          <CustomTextfield v-model="sampai" label="Sampai" type="date" @update:modelValue="cariData" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton v-if="izin.buat" :label="`Buat ${spri ? 'SPRI' : 'Rencana Kontrol'}`" icon="PhPlus" :disabled="konfigurasi && !konfigurasi.lengkap" @click="formulir = { mode: 'buat' }" />
        </template>
      </PageToolbar>
    </template>
    <template #content>
      <div v-if="konfigurasi && !konfigurasi.lengkap" class="p-3 mb-3 text-sm rounded-md bg-[#FEF0C7] text-[#B54708]">
        Lengkapi Cons ID, Secret Key, User Key dan Kode PPK di Setting › Konfigurasi Integrasi › BPJS VClaim sebelum membuat surat.
      </div>

      <div v-if="formulir" class="p-4 bg-white rounded-lg">
        <div class="mb-3 font-semibold">{{ formulir.mode === "ubah" ? "Ubah" : "Buat" }} {{ spri ? "SPRI" : "Rencana Kontrol" }}</div>
        <FormSuratVclaim :jenis="jenis" :mode="formulir.mode" :surat="formulir.surat" @selesai="selesaiFormulir" @batal="formulir = null" />
      </div>

      <div v-else class="flex flex-col gap-3">
        <DataTable :value="baris" stripedRows class="text-xs" dataKey="uuid">
          <Column header="No. Surat" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div class="font-semibold">{{ data.noSurat ?? "(belum bernomor)" }}</div>
              <CustomChip
                :label="STATUS_SURAT[data.status]?.label ?? data.status"
                :show-checked-icon="false"
                :bg-color="STATUS_SURAT[data.status]?.bg ?? 'bg-[#F2F4F7]'"
                border-color="border-transparent"
                :text-color="STATUS_SURAT[data.status]?.teks ?? 'text-[#344054]'"
              />
              <span v-if="data.simulasi" class="ml-1 text-[#B54708]">simulasi</span>
              <div v-if="data.pesanGalat" class="mt-1 text-[#B42318] max-w-[260px]">{{ data.pesanGalat }}</div>
            </template>
          </Column>
          <Column header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div class="font-semibold">{{ data.namaPasien ?? "-" }}</div>
              <div class="text-grey-400">RM {{ data.noRm || "-" }} · Kartu {{ data.noKartu }}</div>
            </template>
          </Column>
          <Column header="Rencana" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div class="font-semibold">{{ tglIndo(data.tglRencana) }}</div>
              <div class="text-grey-400">Poli {{ data.poliTujuan ?? "-" }} · DPJP {{ data.namaDokter ?? data.dpjp ?? "-" }}</div>
            </template>
          </Column>
          <Column header="Asal" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div>{{ sumberLabel(data.sumber) }}</div>
              <div v-if="data.noSepAsal" class="text-grey-400">SEP {{ data.noSepAsal }}</div>
            </template>
          </Column>
          <Column header="Dipakai SEP" headerClass="bg-opensimrs-50">
            <template #body="{ data }">{{ data.sepNoSep ?? (data.statusPakai === "dipakai" ? "sedang diproses" : "Belum") }}</template>
          </Column>
          <Column header="Dibuat" headerClass="bg-opensimrs-50">
            <template #body="{ data }">{{ dibuat(data.createdAt) }}<br /><span class="text-grey-400">{{ data.dibuatOleh ?? "-" }}</span></template>
          </Column>
          <Column header="" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div class="flex flex-wrap gap-2">
                <CustomButton v-if="data.noSurat && data.status !== 'dihapus'" label="Cetak" icon="PhPrinter" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cetak(data)" />
                <CustomButton v-if="izin.ubah && bisaDiubah(data)" label="Ubah" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="formulir = { mode: 'ubah', surat: data }" />
                <CustomButton v-if="izin.hapus && bisaDiubah(data)" label="Hapus" outlined borderColor="border-[#B42318]" textColor="text-[#B42318]" @click="suratDihapus = data" />
                <CustomButton v-if="(izin.buat || izin.ubah) && perluCek(data)" label="Cek status di VClaim" icon="PhArrowsClockwise" outlined borderColor="border-[#B54708]" textColor="text-[#B54708]" @click="cekStatus(data)" />
              </div>
            </template>
          </Column>
          <template #empty>
            <div class="py-4 text-center text-grey-400">Belum ada {{ spri ? "SPRI" : "Rencana Kontrol" }} sesuai filter.</div>
          </template>
        </DataTable>
        <div class="flex justify-end">
          <CustomPaginator :rows="perHalaman" :totalRecords="total" @page="onPage" />
        </div>
      </div>
    </template>
  </Card>

  <!-- Konfirmasi hapus -->
  <Dialog :visible="!!suratDihapus" modal :header="`Hapus ${spri ? 'SPRI' : 'Rencana Kontrol'}`" :style="{ width: '460px' }" @update:visible="suratDihapus = null">
    <div class="text-sm">
      Surat <b>{{ suratDihapus?.noSurat }}</b> atas nama <b>{{ suratDihapus?.namaPasien ?? suratDihapus?.noKartu }}</b> akan dihapus di BPJS (VClaim).
      Surat yang sudah dipakai SEP tidak dapat dihapus.
    </div>
    <template #footer>
      <CustomButton label="Batal" textColor="text-[#9DA4B1]" backgroundColor="bg-transparent" borderColor="border-2 border-[#9DA4B1]" @click="suratDihapus = null" />
      <CustomButton label="Hapus" backgroundColor="bg-[#B42318]" @click="hapus" />
    </template>
  </Dialog>

  <!-- Rekonsiliasi: beberapa surat di VClaim cocok, operator memilih nomor yang benar -->
  <Dialog :visible="!!kandidat" modal header="Pilih surat yang cocok di VClaim" :style="{ width: '640px' }" @update:visible="kandidat = null">
    <div class="mb-3 text-sm">
      VClaim mencatat beberapa surat peserta ini dengan tanggal & DPJP yang sama. Pilih nomor surat yang dibuat dari permintaan ini.
    </div>
    <DataTable :value="kandidat?.daftar ?? []" class="text-xs" dataKey="noSurat">
      <Column header="No. Surat" field="noSurat" headerClass="bg-opensimrs-50" />
      <Column header="Tanggal" headerClass="bg-opensimrs-50">
        <template #body="{ data }">{{ tglIndo(data.tglRencana) }}</template>
      </Column>
      <Column header="DPJP" headerClass="bg-opensimrs-50">
        <template #body="{ data }">{{ data.namaDokter ?? data.kodeDokter ?? "-" }}</template>
      </Column>
      <Column header="" headerClass="bg-opensimrs-50">
        <template #body="{ data }">
          <CustomButton label="Pilih" @click="cekStatus(kandidat!.surat, data.noSurat)" />
        </template>
      </Column>
    </DataTable>
  </Dialog>
</template>
