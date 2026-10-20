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
import BarisJurnalEditor from "./BarisJurnalEditor.vue";
import DetailJurnalDialog from "./DetailJurnalDialog.vue";
import {
  GAYA_STATUS,
  JENIS_JURNAL,
  NAMA_BULAN,
  STATUS_EVENT,
  STATUS_JURNAL,
  buatJurnal,
  daftarAkun,
  daftarEvent,
  daftarJurnal,
  epochHari,
  izinAkuntansi,
  pratinjauProses,
  prosesJurnal,
  referensiAkuntansi,
  rupiah,
  selesaikanEvent,
  tanggalAk,
  waktuAk,
} from "@/stores/penunjang/akuntansi";

// Jurnal umum: daftar jurnal (otomatis/manual/penyesuaian/koreksi), proses jurnal otomatis per periode dari transaksi
// yang sudah ada (idempoten), transaksi tertahan/konflik, dan pengajuan jurnal manual/penyesuaian (KF-4..KF-10).
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinAkuntansi("Jurnal", aksi);
const kini = new Date();
const referensi = ref<any>({ penjamin: [], supplier: [], jenisEvent: [] });
const akun = ref<any[]>([]);
const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const dari = ref<Date | null>(new Date(kini.getFullYear(), kini.getMonth(), 1));
const sampai = ref<Date | null>(kini);
const jenis = ref("");
const status = ref("");
const cari = ref("");
const opsi = (o: Record<string, string>) => Object.entries(o).map(([value, label]) => ({ value, label }));
const OPSI_TAHUN = Array.from({ length: 6 }, (_, i) => ({ value: kini.getFullYear() - i, label: String(kini.getFullYear() - i) }));
const OPSI_BULAN = NAMA_BULAN.map((label, i) => ({ value: i + 1, label }));

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const r = await daftarJurnal({ page: page.value, limit: limit.value, dari: epochHari(dari.value), sampai: epochHari(sampai.value), jenis: jenis.value, status: status.value, q: cari.value.trim() });
    data.value = r?.payload?.data ?? [];
    total.value = r?.payload?.pagination?.total ?? 0;
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

const detailUuid = ref<string | null>(null);
const dialogDetail = ref(false);
const bukaDetail = (uuid: string) => {
  detailUuid.value = uuid;
  dialogDetail.value = true;
};

// ── Proses jurnal otomatis
const dialogProses = ref(false);
const formProses = ref<any>({ tahun: kini.getFullYear(), bulan: kini.getMonth() + 1 });
const pratinjau = ref<any>(null);
const hasilProses = ref<any>(null);
const bukaProses = async () => {
  hasilProses.value = null;
  dialogProses.value = true;
  await muatPratinjau();
};
const muatPratinjau = async () => {
  pratinjau.value = null;
  const r = await pratinjauProses(formProses.value.tahun, formProses.value.bulan);
  pratinjau.value = r?.payload ?? null;
};
const jalankanProses = async () => {
  storeUtils.setLoading(true);
  try {
    const r = await prosesJurnal({ tahun: formProses.value.tahun, bulan: formProses.value.bulan });
    if (r?.payload) {
      hasilProses.value = r.payload;
      await muatPratinjau();
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Transaksi tertahan & konflik
const dialogEvent = ref(false);
const event = ref<any[]>([]);
const statusEvent = ref("tertahan");
const muatEvent = async () => {
  const r = await daftarEvent({ status: statusEvent.value, limit: 200 });
  event.value = r?.payload?.data ?? [];
};
const bukaEvent = () => {
  dialogEvent.value = true;
  muatEvent();
};
const selesaikan = async (e: any) => {
  const alasan = prompt(`Alasan menandai konflik ${e.sumberNomor ?? e.kunci} selesai (mis. "sudah dikoreksi dengan JK-…"):`);
  if (!alasan?.trim()) return;
  if (await selesaikanEvent(e.uuid, alasan.trim())) muatEvent();
};

// ── Jurnal manual / penyesuaian
const dialogManual = ref(false);
const formManual = ref<any>({});
const editor = ref<any>();
const galatManual = ref("");
const barisKosong = () => ({ akunUuid: "", debit: "", kredit: "", uraian: "", penjaminUuid: "", supplierUuid: "" });
const bukaManual = () => {
  galatManual.value = "";
  formManual.value = { jenis: "manual", tanggal: new Date(), uraian: "", alasan: "", referensi: "", baris: [barisKosong(), barisKosong()] };
  dialogManual.value = true;
};
const simpanManual = async () => {
  const f = formManual.value;
  galatManual.value = "";
  if (!f.tanggal || !f.uraian.trim()) return (galatManual.value = "Tanggal dan uraian wajib diisi");
  if (f.jenis === "penyesuaian" && !f.alasan.trim()) return (galatManual.value = "Alasan penyesuaian wajib diisi");
  if (f.baris.some((b: any) => !b.akunUuid)) return (galatManual.value = "Setiap baris wajib memilih akun");
  if (!editor.value?.seimbang()) return (galatManual.value = "Jurnal belum seimbang (total debit harus sama dengan total kredit)");
  storeUtils.setLoading(true);
  try {
    const r = await buatJurnal({
      jenis: f.jenis,
      tanggal: epochHari(f.tanggal),
      uraian: f.uraian.trim(),
      alasan: f.alasan.trim(),
      referensi: f.referensi.trim(),
      baris: f.baris.map((b: any) => ({ akunUuid: b.akunUuid, debit: b.debit || 0, kredit: b.kredit || 0, uraian: b.uraian, penjaminUuid: b.penjaminUuid || null, supplierUuid: b.supplierUuid || null })),
    });
    if (r) {
      dialogManual.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(async () => {
  const [r, a] = await Promise.all([referensiAkuntansi(), daftarAkun({ aktif: "1" })]);
  if (r?.payload) referensi.value = r.payload;
  akun.value = a?.payload ?? [];
  muat();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Jurnal</h1>
          <CustomDatePicker v-model="dari" label="Dari" />
          <CustomDatePicker v-model="sampai" label="Sampai" />
          <CustomSelect v-model="jenis" label="Jenis" placeHolder="Semua" :options="opsi(JENIS_JURNAL)" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomSelect v-model="status" label="Status" placeHolder="Semua" :options="opsi(STATUS_JURNAL)" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nomor / uraian / dokumen" :maxLength="100" @keydown.enter="cariData" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton label="Tertahan & Konflik" icon="PhWarningCircle" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaEvent" />
          <CustomButton v-if="boleh('PROSES OTOMATIS')" label="Proses Jurnal Otomatis" icon="PhLightning" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaProses" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Jurnal Manual" @click="bukaManual" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs cursor-pointer" scrollable scrollHeight="flex" tableStyle="min-width: 64rem" @rowClick="bukaDetail($event.data.uuid)">
          <Column header="Tanggal" headerClass="bg-opensimrs-50"><template #body="{ data: j }">{{ tanggalAk(j.tanggal) }}</template></Column>
          <Column header="Nomor" headerClass="bg-opensimrs-50"><template #body="{ data: j }"><span class="font-semibold">{{ j.nomor }}</span></template></Column>
          <Column header="Jenis" headerClass="bg-opensimrs-50"><template #body="{ data: j }">{{ JENIS_JURNAL[j.jenis] ?? j.jenis }}</template></Column>
          <Column header="Uraian" headerClass="bg-opensimrs-50"><template #body="{ data: j }">{{ j.uraian }}<div v-if="j.sumberNomor" class="text-[11px] text-grey-400">Sumber: {{ j.sumberNomor }}</div></template></Column>
          <Column header="Nominal" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: j }">{{ rupiah(j.totalDebit) }}</template></Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: j }"><span :class="['px-2 py-0.5 rounded-full', GAYA_STATUS[j.status]]">{{ STATUS_JURNAL[j.status] ?? j.status }}</span></template>
          </Column>
          <Column header="Dibuat" headerClass="bg-opensimrs-50"><template #body="{ data: j }">{{ j.dibuatOleh || "sistem" }}</template></Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <DetailJurnalDialog v-model:visible="dialogDetail" :uuid="detailUuid" :referensi="referensi" :akun="akun" @berubah="muat" />

    <!-- Proses jurnal otomatis -->
    <CustomDialog v-model:visible="dialogProses" width="860px">
      <template #header>Proses Jurnal Otomatis</template>
      <template #body>
        <div class="flex flex-col gap-4 pt-4 text-sm">
          <div class="text-xs text-grey-400">
            Membaca transaksi yang sudah tercatat (tagihan final, pembayaran kasir, penerimaan & retur barang, pemakaian/pemusnahan stok) pada periode terpilih dan
            membuat jurnal seimbang sesuai Pemetaan Akun. Aman diulang: dokumen yang sudah dijurnal tidak digandakan; yang ditahan dicoba lagi.
          </div>
          <div class="flex items-end gap-3">
            <CustomSelect v-model="formProses.tahun" label="Tahun" :options="OPSI_TAHUN" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" @update:modelValue="muatPratinjau" />
            <CustomSelect v-model="formProses.bulan" label="Bulan" :options="OPSI_BULAN" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" @update:modelValue="muatPratinjau" />
            <CustomButton label="Proses Sekarang" icon="PhLightning" @click="jalankanProses" />
          </div>
          <DataTable v-if="pratinjau" :value="Object.values(pratinjau.perJenis)" class="text-xs" stripedRows>
            <Column header="Sumber" field="nama" headerClass="bg-opensimrs-50" />
            <Column header="Dokumen" field="jumlah" headerClass="bg-opensimrs-50" />
            <Column header="Sudah dijurnal" field="dijurnal" headerClass="bg-opensimrs-50" />
            <Column header="Belum" field="belum" headerClass="bg-opensimrs-50" />
            <Column header="Konflik" field="konflik" headerClass="bg-opensimrs-50" />
            <Column header="Dilewati" field="dilewati" headerClass="bg-opensimrs-50" />
          </DataTable>
          <div v-if="hasilProses">
            <h3 class="mb-1 font-semibold">Hasil proses {{ NAMA_BULAN[hasilProses.bulan - 1] }} {{ hasilProses.tahun }}</h3>
            <DataTable :value="Object.values(hasilProses.ringkasan)" class="text-xs" stripedRows>
              <Column header="Sumber" field="nama" headerClass="bg-opensimrs-50" />
              <Column header="Jurnal baru" field="dijurnal" headerClass="bg-opensimrs-50" />
              <Column header="Sudah ada" field="sudah" headerClass="bg-opensimrs-50" />
              <Column header="Tertahan" field="tertahan" headerClass="bg-opensimrs-50" />
              <Column header="Konflik" field="konflik" headerClass="bg-opensimrs-50" />
              <Column header="Dilewati" field="dilewati" headerClass="bg-opensimrs-50" />
              <Column header="Nilai dijurnal" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: r }">{{ rupiah(r.nilaiDijurnal) }}</template></Column>
            </DataTable>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end"><CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogProses = false" /></div>
      </template>
    </CustomDialog>

    <!-- Tertahan & konflik -->
    <CustomDialog v-model:visible="dialogEvent" width="980px">
      <template #header>Transaksi Tertahan & Konflik</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4 text-sm">
          <CustomSelect v-model="statusEvent" label="Status" :options="opsi(STATUS_EVENT)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" class="w-60" @update:modelValue="muatEvent" />
          <NoData v-if="!event.length" />
          <DataTable v-else :value="event" class="text-xs" stripedRows>
            <Column header="Tanggal" headerClass="bg-opensimrs-50"><template #body="{ data: e }">{{ tanggalAk(e.tanggal) }}</template></Column>
            <Column header="Sumber" headerClass="bg-opensimrs-50">
              <template #body="{ data: e }">{{ referensi.jenisEvent.find((x: any) => x.kode === e.jenisEvent)?.nama ?? e.jenisEvent }}<div class="text-[11px] text-grey-400">{{ e.sumberNomor }}</div></template>
            </Column>
            <Column header="Nilai" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: e }">{{ rupiah(e.nilai) }}</template></Column>
            <Column header="Alasan" headerClass="bg-opensimrs-50"><template #body="{ data: e }">{{ e.alasan }}</template></Column>
            <Column header="Diproses" headerClass="bg-opensimrs-50"><template #body="{ data: e }">{{ waktuAk(e.updatedAt) }} ({{ e.percobaan }}×)</template></Column>
            <Column header="" headerClass="bg-opensimrs-50">
              <template #body="{ data: e }">
                <div class="flex gap-1">
                  <CustomButton v-if="e.jurnalUuid" label="Jurnal" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaDetail(e.jurnalUuid)" />
                  <CustomButton v-if="e.status === 'konflik' && boleh('KOREKSI')" label="Tandai Selesai" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="selesaikan(e)" />
                </div>
              </template>
            </Column>
          </DataTable>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end"><CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogEvent = false" /></div>
      </template>
    </CustomDialog>

    <!-- Jurnal manual / penyesuaian -->
    <CustomDialog v-model:visible="dialogManual" width="980px">
      <template #header>Jurnal Manual / Penyesuaian</template>
      <template #body>
        <div class="flex flex-col gap-4 pt-4 text-sm">
          <div class="grid grid-cols-4 gap-4">
            <CustomSelect v-model="formManual.jenis" label="Jenis" :options="[{ value: 'manual', label: 'Manual' }, { value: 'penyesuaian', label: 'Penyesuaian' }]" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
            <CustomDatePicker v-model="formManual.tanggal" label="Tanggal transaksi" />
            <CustomTextfield v-model="formManual.referensi" label="Referensi dokumen" :maxLength="255" class="col-span-2" />
            <CustomTextfield v-model="formManual.uraian" label="Uraian" :maxLength="1000" class="col-span-4" required />
            <CustomTextArea v-model="formManual.alasan" :label="formManual.jenis === 'penyesuaian' ? 'Alasan penyesuaian (wajib)' : 'Alasan / catatan'" class="col-span-4" />
          </div>
          <BarisJurnalEditor ref="editor" v-model="formManual.baris" :akun="akun" :penjamin="referensi.penjamin" :supplier="referensi.supplier" />
          <div class="text-xs text-grey-400">Jurnal masuk antrean persetujuan dan baru memengaruhi buku besar setelah disetujui pengguna lain (tingkat 2 untuk nominal ≥ ambang di menu Periode).</div>
          <div v-if="galatManual" class="text-sm text-danger-300">{{ galatManual }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogManual = false" />
          <CustomButton label="Ajukan" icon="PhPaperPlaneTilt" @click="simpanManual" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
