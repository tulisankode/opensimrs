<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { getLoginUsername } from "@/utils/permissions";
import { NAMA_BULAN, epochHari, kodeSnake, rupiah, tanggalAk, waktuAk } from "@/stores/penunjang/akuntansi";
import {
  GAYA_STATUS_REMUN,
  STATUS_PERIODE_REMUN,
  bayarPeriodeRemun,
  buatPeriodeRemun,
  daftarPenerima,
  daftarPeriodeRemun,
  daftarPraktisi,
  detailPeriodeRemun,
  hapusKoreksi,
  hitungPeriodeRemun,
  izinRemunerasi,
  kembalikanPeriodeRemun,
  persen,
  referensiRemunerasi,
  setujuiPeriodeRemun,
  simpanKinerja,
  sumberPeriodeRemun,
  tambahKoreksi,
  tanganiPengecualian,
  verifikasiPeriodeRemun,
} from "@/stores/penunjang/remunerasi";

// Periode remunerasi bulanan (STD-0032): draf → hitung (dari tagihan lunas bulan itu, idempoten) → verifikasi →
// persetujuan (penghitung ≠ verifikator ≠ penyetuju; dijurnal ke Akuntansi) → dibayar (dijurnal). Pengecualian wajib
// ditangani beralasan sebelum verifikasi; koreksi atas periode lama dicatat beralasan di periode draf berikutnya.
const storeUtils = utilsStore();
const saya = getLoginUsername().toLowerCase();
const kini = new Date();
const tahun = ref(kini.getFullYear());
const OPSI_TAHUN = Array.from({ length: 6 }, (_, i) => ({ value: kini.getFullYear() - i, label: String(kini.getFullYear() - i) }));
const OPSI_BULAN = NAMA_BULAN.map((n, i) => ({ value: i + 1, label: n }));
const ref_ = ref<any>({ statusSumber: [], profesi: [], metodeBayar: [] });
const periode = ref<any[]>([]);
const namaOpsi = (daftar: any[], kode: string) => daftar.find((x: any) => x.kode === kode)?.nama ?? kode;

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    periode.value = (await daftarPeriodeRemun({ tahun: tahun.value }))?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};

const dialogBaru = ref(false);
const baru = ref<any>({ tahun: kini.getFullYear(), bulan: kini.getMonth() || 12, catatan: "" });
const buat = async () => {
  storeUtils.setLoading(true);
  try {
    if (await buatPeriodeRemun({ tahun: baru.value.tahun, bulan: baru.value.bulan, catatan: baru.value.catatan })) {
      dialogBaru.value = false;
      await muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Detail
const dialog = ref(false);
const d = ref<any>(null);
const tab = ref("rincian");
const penerima = ref<any[]>([]);
const praktisi = ref<any[]>([]);
const namaPraktisi = (uuid?: string | null) => (uuid ? (penerima.value.find((p) => p.practitionerUuid === uuid)?.nama ?? praktisi.value.find((p) => p.uuid === uuid)?.nama ?? uuid) : "-");
const bisaUbah = computed(() => d.value && ["draf", "dihitung"].includes(d.value.status));
const buka = async (uuid: string) => {
  storeUtils.setLoading(true);
  try {
    const [r, p] = await Promise.all([detailPeriodeRemun(uuid), penerima.value.length ? null : daftarPenerima()]);
    if (p?.payload) penerima.value = p.payload;
    if (!r?.payload) return;
    d.value = r.payload;
    kinerja.value = Object.fromEntries(penerima.value.filter((x) => x.aktif).map((x) => [x.practitionerUuid, String(Number(d.value.kinerja.find((k: any) => k.practitionerUuid === x.practitionerUuid)?.nilaiBp ?? 10000) / 100)]));
    dialog.value = true;
    if (tab.value === "sumber") muatSumber();
  } finally {
    storeUtils.setLoading(false);
  }
};
const segarkan = async () => {
  await muat();
  if (d.value) await buka(d.value.uuid);
};
const aksi = async (fn: () => Promise<any>, konfirmasi?: string) => {
  if (konfirmasi && !confirm(konfirmasi)) return;
  storeUtils.setLoading(true);
  try {
    if (await fn()) await segarkan();
  } finally {
    storeUtils.setLoading(false);
  }
};
const hitung = () => aksi(() => hitungPeriodeRemun(d.value.uuid));
const verifikasi = () => aksi(() => verifikasiPeriodeRemun(d.value.uuid, prompt("Catatan verifikasi (opsional)") ?? ""), `Verifikasi ${d.value.nama}? Total Rp ${rupiah(d.value.total)}.`);
const setujui = () => aksi(() => setujuiPeriodeRemun(d.value.uuid, prompt("Catatan persetujuan (opsional)") ?? ""), `Setujui ${d.value.nama}? Jurnal beban jasa pelayanan Rp ${rupiah(d.value.total)} dibuat di Akuntansi.`);
const kembalikan = () => {
  const alasan = prompt(d.value.status === "dihitung" ? "Alasan mengembalikan ke draf (wajib)" : "Alasan penolakan (wajib)");
  if (!alasan?.trim()) return;
  aksi(() => kembalikanPeriodeRemun(d.value.uuid, alasan.trim()));
};
const dialogBayar = ref(false);
const bayar = ref<any>({ tanggal: new Date(), metode: "TRANSFER", referensi: "" });
const simpanBayar = async () => {
  dialogBayar.value = false;
  await aksi(() => bayarPeriodeRemun(d.value.uuid, { tanggalBayar: epochHari(bayar.value.tanggal), metodeBayar: bayar.value.metode, referensiBayar: bayar.value.referensi }));
};

// Kinerja
const kinerja = ref<Record<string, string>>({});
const simpanKinerja_ = () =>
  aksi(() => simpanKinerja(d.value.uuid, Object.entries(kinerja.value).map(([practitionerUuid, nilai]) => ({ practitionerUuid, nilai: String(nilai).replace(",", ".") }))));

// Koreksi
const dialogKoreksi = ref(false);
const fk = ref<any>({});
const periodeSelesai = computed(() => periode.value.filter((p) => ["disetujui", "dibayar"].includes(p.status) && d.value && p.tahun * 12 + p.bulan < d.value.tahun * 12 + d.value.bulan).map((p) => ({ uuid: p.uuid, label: p.nomor })));
const bukaKoreksi = () => {
  fk.value = { practitionerUuid: "", nilai: "", alasan: "", rujukanPeriodeUuid: "" };
  dialogKoreksi.value = true;
};
const simpanKoreksi = async () => {
  const f = fk.value;
  if (!f.practitionerUuid || !String(f.nilai).trim() || !f.alasan.trim()) return alert("Penerima, nilai, dan alasan wajib diisi");
  dialogKoreksi.value = false;
  await aksi(() => tambahKoreksi(d.value.uuid, { practitionerUuid: f.practitionerUuid, nilai: String(f.nilai).trim().replace(",", "."), alasan: f.alasan.trim(), rujukanPeriodeUuid: f.rujukanPeriodeUuid || undefined }));
};
const hapusKoreksi_ = (k: any) => {
  const alasan = prompt("Alasan menghapus koreksi (wajib)");
  if (alasan?.trim()) aksi(() => hapusKoreksi(d.value.uuid, k.uuid, alasan.trim()));
};

// Pengecualian
const dialogPengecualian = ref(false);
const fpg = ref<any>({});
const bukaPengecualian = async (s: any, tindakan: string) => {
  if (!praktisi.value.length) praktisi.value = (await daftarPraktisi())?.payload ?? [];
  fpg.value = { billItemUuid: s.billItemUuid, namaItem: s.namaItem, tindakan, practitionerUuid: s.pelaksanaUuid ?? "", alasan: "" };
  dialogPengecualian.value = true;
};
const opsiPenerima = computed(() => penerima.value.filter((p) => p.aktif).map((p) => ({ uuid: p.practitionerUuid, label: p.nama || p.practitionerUuid })));
const simpanPengecualian = async () => {
  const f = fpg.value;
  if (!f.alasan.trim()) return alert("Alasan wajib diisi");
  if (f.tindakan === "tetapkan" && !f.practitionerUuid) return alert("Pilih penerima");
  dialogPengecualian.value = false;
  await aksi(() => tanganiPengecualian(d.value.uuid, { billItemUuid: f.billItemUuid, tindakan: f.tindakan, practitionerUuid: f.practitionerUuid || undefined, alasan: f.alasan.trim() }));
};
const batalPenyelesaian = (s: any) => {
  const alasan = prompt("Alasan membatalkan penanganan (wajib)");
  if (alasan?.trim()) aksi(() => tanganiPengecualian(d.value.uuid, { billItemUuid: s.billItemUuid, tindakan: "batal", alasan: alasan.trim() }));
};

// Sumber (paginasi)
const sumber = ref<any[]>([]);
const sumberTotal = ref(0);
const sumberHal = ref({ page: 1, limit: 50, status: "" });
const muatSumber = async () => {
  const r = await sumberPeriodeRemun(d.value.uuid, { page: sumberHal.value.page, limit: sumberHal.value.limit, status: sumberHal.value.status });
  sumber.value = r?.payload?.data ?? [];
  sumberTotal.value = r?.payload?.pagination?.total ?? 0;
};
const gantiTab = (v: any) => {
  tab.value = v;
  if (v === "sumber") muatSumber();
};

onMounted(async () => {
  const r = await referensiRemunerasi();
  if (r?.payload) ref_.value = r.payload;
  muat();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Periode Remunerasi</h1>
          <CustomSelect v-model="tahun" label="Tahun" :options="OPSI_TAHUN" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" @update:modelValue="muat" />
          <CustomButton v-if="izinRemunerasi('periode', 'CREATE')" icon="PhPlus" label="Periode Baru" @click="dialogBaru = true" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!periode.length" />
        <DataTable v-else :value="periode" stripedRows class="text-xs cursor-pointer" @rowClick="buka($event.data.uuid)">
          <Column header="Periode" headerClass="bg-opensimrs-50"><template #body="{ data: p }"><span class="font-semibold">{{ p.nama }}</span><div class="text-[11px] text-grey-400">{{ p.nomor }}</div></template></Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: p }"><span :class="['px-2 py-0.5 rounded-full', GAYA_STATUS_REMUN[p.status]]">{{ STATUS_PERIODE_REMUN[p.status] ?? p.status }}</span></template>
          </Column>
          <Column header="Skema" headerClass="bg-opensimrs-50"><template #body="{ data: p }">{{ p.skemaVersi ? `v${p.skemaVersi}` : "-" }}</template></Column>
          <Column header="Penerima" field="jumlahPenerima" headerClass="bg-opensimrs-50" />
          <Column header="Pengecualian" headerClass="bg-opensimrs-50"><template #body="{ data: p }"><span :class="p.jumlahPengecualian ? 'text-danger-300 font-semibold' : ''">{{ p.jumlahPengecualian }}</span></template></Column>
          <Column header="Total jaspel" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: p }">{{ rupiah(p.total) }}</template></Column>
          <Column header="Jejak" headerClass="bg-opensimrs-50">
            <template #body="{ data: p }">
              <div v-if="p.dihitungOleh">Dihitung {{ p.dihitungOleh }}</div>
              <div v-if="p.diverifikasiOleh">Diverifikasi {{ p.diverifikasiOleh }}</div>
              <div v-if="p.disetujuiOleh">Disetujui {{ p.disetujuiOleh }}</div>
              <div v-if="p.dibayarOleh">Dibayar {{ tanggalAk(p.tanggalBayar) }}</div>
              <div v-if="p.status === 'draf' && p.alasanKembali" class="text-[#B54708]">Dikembalikan: {{ p.alasanKembali }}</div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialogBaru" width="520px">
      <template #header>Periode Remunerasi Baru</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomSelect v-model="baru.bulan" label="Bulan" :options="OPSI_BULAN" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
          <CustomSelect v-model="baru.tahun" label="Tahun" :options="OPSI_TAHUN" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
          <CustomTextArea v-model="baru.catatan" label="Catatan" class="col-span-2" />
          <div class="col-span-2 text-xs text-grey-400">Dasar hitung: item tagihan dari tagihan yang lunas pada bulan ini (WIB) memakai skema disahkan yang berlaku.</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogBaru = false" />
          <CustomButton label="Buat" icon="PhPlus" @click="buat" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialog" width="1100px">
      <template #header>{{ d?.nama }} — {{ STATUS_PERIODE_REMUN[d?.status] ?? d?.status }}</template>
      <template #body>
        <div v-if="d" class="flex flex-col gap-3 pt-4 text-sm">
          <div class="grid grid-cols-4 gap-3 text-xs">
            <div class="p-3 border rounded-md border-grey-100"><div class="text-grey-400">Dasar (item lunas berporsi)</div><div class="text-base font-semibold">Rp {{ rupiah(d.totalDasar) }}</div></div>
            <div class="p-3 border rounded-md border-grey-100"><div class="text-grey-400">Jasa langsung</div><div class="text-base font-semibold">Rp {{ rupiah(d.totalLangsung) }}</div></div>
            <div class="p-3 border rounded-md border-grey-100"><div class="text-grey-400">Kebersamaan (pool)</div><div class="text-base font-semibold">Rp {{ rupiah(d.totalKebersamaan) }}</div></div>
            <div class="p-3 border rounded-md border-grey-100"><div class="text-grey-400">Total (termasuk koreksi Rp {{ rupiah(d.totalKoreksi) }})</div><div class="text-base font-semibold">Rp {{ rupiah(d.total) }}</div></div>
          </div>
          <div class="text-xs text-grey-400">
            <span v-if="d.skema">Skema v{{ d.skema.versi }} — {{ d.skema.nama }}<span v-if="d.skema.contoh" class="text-[#B54708]"> (berasal dari nilai contoh)</span> · </span>
            <span v-if="d.dihitungOleh">dihitung {{ d.dihitungOleh }} {{ waktuAk(d.dihitungPada) }}<span v-if="String(d.dihitungOleh).toLowerCase() === saya"> (Anda)</span> · </span>
            <span v-if="d.diverifikasiOleh">diverifikasi {{ d.diverifikasiOleh }} {{ waktuAk(d.diverifikasiPada) }} · </span>
            <span v-if="d.disetujuiOleh">disetujui {{ d.disetujuiOleh }} {{ waktuAk(d.disetujuiPada) }} · </span>
            <span v-for="j in d.jurnal" :key="j.uuid">jurnal {{ j.nomor }} ({{ j.jenisEvent }}) · </span>
            <span v-if="d.ringkasan?.jumlahStatus">item: {{ Object.entries(d.ringkasan.jumlahStatus).map(([k, v]) => `${namaOpsi(ref_.statusSumber, kodeSnake(k))} ${v}`).join(", ") }}, tanpa porsi {{ d.ringkasan.itemTanpaPorsi }}</span>
          </div>
          <div v-if="d.status === 'draf' && d.hashHitung" class="p-2 text-xs rounded-md bg-[#FEF0C7] text-[#B54708]">Masukan periode berubah (kinerja/koreksi/pengecualian) atau periode dikembalikan — hitung ulang sebelum diverifikasi.</div>
          <div v-for="(p, i) in d.ringkasan?.pengecualian ?? []" :key="i" class="p-2 text-xs rounded-md bg-[#FEE4E2] text-[#B42318]">{{ p.pesan }}</div>

          <Tabs :value="tab" @update:value="gantiTab">
            <TabList>
              <Tab value="rincian">Rincian Penerima ({{ d.rincian.length }})</Tab>
              <Tab value="pengecualian">Pengecualian ({{ d.pengecualian.length }})</Tab>
              <Tab value="kinerja">Capaian Kinerja</Tab>
              <Tab value="koreksi">Koreksi ({{ d.koreksi.filter((k: any) => !k.deletedAt).length }})</Tab>
              <Tab value="sumber">Item Sumber</Tab>
            </TabList>
          </Tabs>

          <DataTable v-if="tab === 'rincian'" :value="d.rincian" stripedRows class="text-xs" scrollable scrollHeight="360px">
            <Column header="Penerima" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ r.nama || r.practitionerUuid }}<div class="text-[11px] text-grey-400">{{ namaOpsi(ref_.profesi, r.profesi) }} · {{ r.unit || "-" }}</div></template></Column>
            <Column header="Layanan" field="jumlahLayanan" headerClass="bg-opensimrs-50" />
            <Column header="Poin × kinerja" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><span v-if="r.rumus">{{ r.rumus.poin }} × {{ r.rumus.kinerjaPersen }}% = {{ r.rumus.poinEfektif }} ({{ r.rumus.porsiPoolPersen }}%)</span><span v-else>-</span></template></Column>
            <Column header="Langsung" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: r }">{{ rupiah(r.langsung) }}</template></Column>
            <Column header="Kebersamaan" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: r }">{{ rupiah(r.kebersamaan) }}</template></Column>
            <Column header="Koreksi" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: r }">{{ rupiah(r.koreksi) }}</template></Column>
            <Column header="Total" headerClass="bg-opensimrs-50" bodyClass="text-right font-semibold"><template #body="{ data: r }">{{ rupiah(r.total) }}</template></Column>
          </DataTable>

          <template v-if="tab === 'pengecualian'">
            <NoData v-if="!d.pengecualian.length && !d.penyelesaian.length" />
            <DataTable v-if="d.pengecualian.length" :value="d.pengecualian" stripedRows class="text-xs" scrollable scrollHeight="300px">
              <Column header="Tagihan" headerClass="bg-opensimrs-50"><template #body="{ data: s }">{{ s.invoiceCode }}<div class="text-[11px] text-grey-400">{{ s.noReg || "-" }} · {{ s.jenisLayanan }}</div></template></Column>
              <Column header="Item" field="namaItem" headerClass="bg-opensimrs-50" />
              <Column header="Jaspel" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: s }">{{ rupiah(s.jaspel) }}</template></Column>
              <Column header="Alasan" headerClass="bg-opensimrs-50"><template #body="{ data: s }">{{ s.alasan }}<div v-if="s.pelaksanaUuid" class="text-[11px] text-grey-400">pelaksana: {{ namaPraktisi(s.pelaksanaUuid) }}</div></template></Column>
              <Column v-if="bisaUbah && izinRemunerasi('periode', 'KOREKSI')" header="" headerClass="bg-opensimrs-50">
                <template #body="{ data: s }">
                  <div class="flex gap-1">
                    <CustomButton label="Tetapkan" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaPengecualian(s, 'tetapkan')" />
                    <CustomButton label="Abaikan" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="bukaPengecualian(s, 'abaikan')" />
                  </div>
                </template>
              </Column>
            </DataTable>
            <div v-if="d.penyelesaian.length">
              <h3 class="mt-2 mb-1 font-semibold">Penanganan tercatat</h3>
              <DataTable :value="d.penyelesaian" stripedRows class="text-xs">
                <Column header="Item" field="billItemUuid" headerClass="bg-opensimrs-50" />
                <Column header="Tindakan" headerClass="bg-opensimrs-50"><template #body="{ data: s }">{{ s.tindakan === "tetapkan" ? `Tetapkan → ${namaPraktisi(s.practitionerUuid)}` : "Abaikan" }}</template></Column>
                <Column header="Alasan" field="alasan" headerClass="bg-opensimrs-50" />
                <Column header="Oleh" headerClass="bg-opensimrs-50"><template #body="{ data: s }">{{ s.dibuatOleh }} · {{ waktuAk(s.updatedAt) }}</template></Column>
                <Column v-if="bisaUbah && izinRemunerasi('periode', 'KOREKSI')" header="" headerClass="bg-opensimrs-50">
                  <template #body="{ data: s }"><CustomButton label="Batalkan" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="batalPenyelesaian(s)" /></template>
                </Column>
              </DataTable>
            </div>
          </template>

          <template v-if="tab === 'kinerja'">
            <div class="text-xs text-grey-400">Capaian kinerja (IKI) penerima periode ini dalam persen; bawaan 100%. Rentang mengikuti skema. Pool kebersamaan dibagi proporsional poin × capaian.</div>
            <div class="grid grid-cols-3 gap-3">
              <CustomTextfield v-for="p in penerima.filter((x) => x.aktif)" :key="p.practitionerUuid" v-model="kinerja[p.practitionerUuid]" :label="p.nama || p.practitionerUuid" :maxLength="6" :disabled="!bisaUbah || !izinRemunerasi('periode', 'UPDATE')" />
            </div>
            <div><CustomButton v-if="bisaUbah && izinRemunerasi('periode', 'UPDATE') && penerima.length" label="Simpan Capaian Kinerja" icon="PhFloppyDisk" @click="simpanKinerja_" /></div>
          </template>

          <template v-if="tab === 'koreksi'">
            <div class="text-xs text-grey-400">Koreksi (±) beralasan per penerima, mis. atas periode lalu yang sudah disetujui/dibayar. Hasil periode lama tidak diubah.</div>
            <DataTable v-if="d.koreksi.length" :value="d.koreksi" stripedRows class="text-xs">
              <Column header="Penerima" headerClass="bg-opensimrs-50"><template #body="{ data: k }">{{ namaPraktisi(k.practitionerUuid) }}</template></Column>
              <Column header="Nilai" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: k }">{{ rupiah(k.nilai) }}</template></Column>
              <Column header="Alasan" headerClass="bg-opensimrs-50"><template #body="{ data: k }">{{ k.alasan }}<div v-if="k.nomorRujukan" class="text-[11px] text-grey-400">rujukan {{ k.nomorRujukan }}</div></template></Column>
              <Column header="Oleh" headerClass="bg-opensimrs-50"><template #body="{ data: k }">{{ k.dibuatOleh }} · {{ waktuAk(k.createdAt) }}<div v-if="k.deletedAt" class="text-danger-300">dihapus {{ k.dihapusOleh }}: {{ k.alasanHapus }}</div></template></Column>
              <Column v-if="bisaUbah && izinRemunerasi('periode', 'KOREKSI')" header="" headerClass="bg-opensimrs-50">
                <template #body="{ data: k }"><CustomButton v-if="!k.deletedAt" label="Hapus" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="hapusKoreksi_(k)" /></template>
              </Column>
            </DataTable>
            <div><CustomButton v-if="bisaUbah && izinRemunerasi('periode', 'KOREKSI')" label="Tambah Koreksi" icon="PhPlus" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaKoreksi" /></div>
          </template>

          <template v-if="tab === 'sumber'">
            <div class="flex items-end gap-3">
              <CustomSelect v-model="sumberHal.status" label="Status" placeHolder="Semua" :options="ref_.statusSumber" optionValue="kode" optionLabel="nama" :showFilter="false" @update:modelValue="() => { sumberHal.page = 1; muatSumber(); }" />
              <div class="text-xs text-grey-400">Identitas pasien tidak ditampilkan. Item tanpa porsi jaspel (mis. obat) tidak dicatat.</div>
            </div>
            <DataTable :value="sumber" stripedRows class="text-xs" scrollable scrollHeight="320px">
              <Column header="Lunas" headerClass="bg-opensimrs-50"><template #body="{ data: s }">{{ tanggalAk(s.tanggalLunas) }}</template></Column>
              <Column header="Tagihan" headerClass="bg-opensimrs-50"><template #body="{ data: s }">{{ s.invoiceCode }}<div class="text-[11px] text-grey-400">{{ s.jenisLayanan }} · {{ s.kategori }}</div></template></Column>
              <Column header="Item" field="namaItem" headerClass="bg-opensimrs-50" />
              <Column header="Nilai" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: s }">{{ rupiah(s.nilai) }}</template></Column>
              <Column header="Porsi" headerClass="bg-opensimrs-50"><template #body="{ data: s }">{{ persen(s.persenBp) }}</template></Column>
              <Column header="Jaspel (langsung/pool)" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: s }">{{ rupiah(s.jaspel) }}<div class="text-[11px] text-grey-400">{{ rupiah(s.langsung) }} / {{ rupiah(s.kebersamaan) }}</div></template></Column>
              <Column header="Pelaksana" headerClass="bg-opensimrs-50"><template #body="{ data: s }">{{ namaPraktisi(s.pelaksanaUuid ?? s.practitionerUuid) }}</template></Column>
              <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: s }">{{ namaOpsi(ref_.statusSumber, s.status) }}</template></Column>
            </DataTable>
            <CustomPaginator :rows="sumberHal.limit" :totalRecords="sumberTotal" :rowsPerPageOptions="[50, 100, 200]" @page="(e: any) => { sumberHal.page = e.page + 1; sumberHal.limit = e.rows; muatSumber(); }" />
          </template>
        </div>
      </template>
      <template #footer>
        <div v-if="d" class="flex justify-end gap-2">
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
          <CustomButton v-if="bisaUbah && izinRemunerasi('periode', 'HITUNG')" :label="d.status === 'draf' ? 'Hitung' : 'Hitung Ulang'" icon="PhCalculator" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="hitung" />
          <CustomButton v-if="d.status === 'dihitung' && izinRemunerasi('verifikasi', 'KEMBALIKAN')" label="Kembalikan" icon="PhArrowUUpLeft" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="kembalikan" />
          <CustomButton v-if="d.status === 'dihitung' && izinRemunerasi('verifikasi', 'VALIDASI')" label="Verifikasi" icon="PhCheckCircle" :disabled="d.jumlahPengecualian > 0" @click="verifikasi" />
          <CustomButton v-if="d.status === 'diverifikasi' && izinRemunerasi('persetujuan', 'TOLAK')" label="Tolak" icon="PhXCircle" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="kembalikan" />
          <CustomButton v-if="d.status === 'diverifikasi' && izinRemunerasi('persetujuan', 'SETUJUI')" label="Setujui" icon="PhSealCheck" @click="setujui" />
          <CustomButton v-if="d.status === 'disetujui' && izinRemunerasi('pembayaran', 'BAYAR')" label="Catat Pembayaran" icon="PhMoney" @click="dialogBayar = true" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogBayar" width="560px">
      <template #header>Catat Pembayaran Jasa Pelayanan</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomDatePicker v-model="bayar.tanggal" label="Tanggal bayar" />
          <CustomSelect v-model="bayar.metode" label="Metode" :options="ref_.metodeBayar" optionValue="kode" optionLabel="nama" :showFilter="false" :clearable="false" />
          <CustomTextfield v-model="bayar.referensi" label="Referensi (mis. nomor bukti transfer)" :maxLength="255" class="col-span-2" />
          <div class="col-span-2 text-xs text-grey-400">Jurnal D Utang Jasa Pelayanan / K Kas-Bank sebesar Rp {{ rupiah(d?.total) }} dibuat otomatis.</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogBayar = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanBayar" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogKoreksi" width="600px">
      <template #header>Tambah Koreksi</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomSelect v-model="fk.practitionerUuid" label="Penerima" :options="opsiPenerima" optionValue="uuid" optionLabel="label" class="col-span-2" />
          <CustomTextfield v-model="fk.nilai" label="Nilai (Rp, negatif untuk pengurangan)" placeholder="mis. -150000" :maxLength="20" />
          <CustomSelect v-model="fk.rujukanPeriodeUuid" label="Rujukan periode (opsional)" placeHolder="Tidak ada" :options="periodeSelesai" optionValue="uuid" optionLabel="label" :showFilter="false" />
          <CustomTextArea v-model="fk.alasan" label="Alasan (wajib)" class="col-span-2" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogKoreksi = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanKoreksi" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogPengecualian" width="600px">
      <template #header>{{ fpg.tindakan === "tetapkan" ? "Tetapkan Penerima" : "Abaikan Item" }} — {{ fpg.namaItem }}</template>
      <template #body>
        <div class="grid gap-4 pt-4">
          <CustomSelect v-if="fpg.tindakan === 'tetapkan'" v-model="fpg.practitionerUuid" label="Penerima (harus terdaftar & aktif)" :options="opsiPenerima" optionValue="uuid" optionLabel="label" />
          <CustomTextArea v-model="fpg.alasan" label="Alasan (wajib, tercatat di Audit Trail)" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogPengecualian = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanPengecualian" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
