<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import {
  daftarPesertaMcu, daftarkanPesertaMcu, batalPesertaMcu, detailPesertaMcu, daftarPaketMcu, daftarPerusahaanMcu, cariPasienMcu,
  buatOrderLabMcu, izinMcu, daftarPasienBaruMcu, referensiImporMcu, STATUS_PESERTA, KESIMPULAN_MCU, OPSI_JENIS_MCU, JENIS_MCU, tglIso, tglIndo, rupiah, jenisKelamin,
  STATUS_LIS, FILTER_STATUS_LIS, AKSI_LIS, petunjukGalatLis, type StatusPeserta, type Kesimpulan, type StatusLis, type AksiLis,
} from "@/stores/penunjang/mcu";
import { fiturAktif } from "@/stores/modulFaskes";
import KirimLisMcu from "./Komponen/KirimLisMcu.vue";
import { cetakLaporanMcu, cetakSertifikatMcu } from "@/utils/pdf/pdfMcu/cetakMcu";
import ImporExcelMcu from "./Komponen/ImporExcelMcu.vue";

// Peserta MCU: daftar per tanggal + pendaftaran. Rombongan korporasi lewat Impor Excel (jalur utama); dialog pilih
// pasien satu per satu untuk perorangan / cadangan korporasi.
const router = useRouter();
const boleh = (aksi: string) => izinMcu("Peserta", aksi);
const dialogImpor = ref(false);
const rows = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const memuat = ref(false);
const mulai = ref<Date>(new Date());
// Bawaan: hari ini s.d. 30 hari ke depan — rombongan korporasi biasanya dijadwalkan beberapa hari ke depan.
const tigaPuluhHari = () => new Date(Date.now() + 30 * 86400000);
const selesai = ref<Date>(tigaPuluhHari());
const cari = ref("");
const perusahaanFilter = ref<string>("");
const statusFilter = ref<string[]>([]);
const statusLisFilter = ref<string[]>([]);
const perusahaan = ref<any[]>([]);
const paket = ref<any[]>([]);

const muat = async () => {
  memuat.value = true;
  const res = await daftarPesertaMcu({
    page: page.value, limit: limit.value, cari: cari.value, tanggal_mulai: tglIso(mulai.value), tanggal_selesai: tglIso(selesai.value),
    perusahaan_uuid: perusahaanFilter.value, status: statusFilter.value.join(","), status_lis: statusLisFilter.value.join(","),
  });
  rows.value = res?.payload?.data ?? [];
  total.value = res?.payload?.pagination?.total ?? 0;
  memuat.value = false;
};
// Setelah impor: daftar langsung menampilkan peserta hasil impor (rentang tanggal MCU di file + perusahaannya).
const tampilkanHasilImpor = (info?: { mulai: Date; selesai: Date; perusahaanUuid: string | null }) => {
  if (info) {
    mulai.value = info.mulai;
    selesai.value = info.selesai;
    perusahaanFilter.value = info.perusahaanUuid ?? "";
    cari.value = "";
    statusFilter.value = [];
    statusLisFilter.value = [];
  }
  cariUlang();
};
const cariUlang = () => {
  page.value = 1;
  pilihan.value = [];
  semuaFilter.value = false;
  muat();
};
const reset = () => {
  mulai.value = new Date();
  selesai.value = tigaPuluhHari();
  cari.value = "";
  perusahaanFilter.value = "";
  statusFilter.value = [];
  statusLisFilter.value = [];
  cariUlang();
};
const toggleStatusLis = (s: string) => {
  statusLisFilter.value = statusLisFilter.value.includes(s) ? statusLisFilter.value.filter((x) => x !== s) : [...statusLisFilter.value, s];
};

// ── Bridging LIS: pilih peserta (checkbox) → kirim / kirim ulang yang gagal / ambil hasil / cek status (batch di server) ──
const lisAktif = computed(() => fiturAktif("lab_bridging_lis"));
const bolehLis = computed(() => lisAktif.value && boleh("KIRIM LIS"));
const pilihan = ref<any[]>([]);
const semuaFilter = ref(false); // "pilih semua sesuai filter" (melebihi halaman)
const jumlahDipilih = computed(() => (semuaFilter.value ? total.value : pilihan.value.length));
const halamanTerpilihSemua = computed(() => rows.value.length > 0 && rows.value.every((r) => pilihan.value.some((p) => p.uuid === r.uuid)));
const hitungPilihan = (status: string[]) => pilihan.value.filter((p) => status.includes(p.statusLis)).length;
// Filter daftar saat ini (dikirim ke server untuk "semua sesuai filter").
const filterSaatIni = () => ({
  cari: cari.value, tanggal_mulai: tglIso(mulai.value), tanggal_selesai: tglIso(selesai.value), perusahaan_uuid: perusahaanFilter.value,
  status: statusFilter.value.join(","), status_lis: statusLisFilter.value.join(","),
});
const dialogLis = ref(false);
const lis = ref<{ aksi: AksiLis | null; pesertaUuids: string[]; filter: Record<string, any> | null; jumlah: number; batchAwal: string | null }>({
  aksi: null, pesertaUuids: [], filter: null, jumlah: 0, batchAwal: null,
});
const bukaLis = (aksi: AksiLis | null) => {
  if (aksi && !jumlahDipilih.value) return window.alert("Pilih peserta terlebih dahulu (centang baris atau pilih semua sesuai filter).");
  lis.value = semuaFilter.value
    ? { aksi, pesertaUuids: [], filter: filterSaatIni(), jumlah: total.value, batchAwal: null }
    : { aksi, pesertaUuids: pilihan.value.map((p) => p.uuid), filter: null, jumlah: pilihan.value.length, batchAwal: null };
  dialogLis.value = true;
};
const segarkanPilihan = async () => {
  await muat();
  // perbarui status LIS baris terpilih yang tampil di halaman ini
  pilihan.value = pilihan.value.map((p) => rows.value.find((r) => r.uuid === p.uuid) ?? p);
};
const itemAksiLis = computed(() => [
  { label: AKSI_LIS.cek.label, icon: "pi pi-search", command: () => bukaLis("cek") },
  { label: AKSI_LIS.tandai.label, icon: "pi pi-flag", command: () => bukaLis("tandai") },
  { separator: true },
  { label: "Riwayat Kirim LIS", icon: "pi pi-history", command: () => bukaLis(null) },
]);
const menuLis = ref();
const toggleStatus = (s: string) => {
  statusFilter.value = statusFilter.value.includes(s) ? statusFilter.value.filter((x) => x !== s) : [...statusFilter.value, s];
};
const gantiHalaman = (e: any) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

// ── Pendaftaran ─────────────────────────────────────────────
const dialogDaftar = ref(false);
const form = ref<any>({});
const hasilCari = ref<any[]>([]);
const kataPasien = ref("");
const mencari = ref(false);
const menyimpan = ref(false);
const bukaDaftar = () => {
  form.value = { caraBayar: "perorangan", perusahaanUuid: null, paketUuid: null, tanggal: new Date(), jenisMcu: "umum", peserta: [] };
  hasilCari.value = [];
  kataPasien.value = "";
  dialogDaftar.value = true;
};
watch(() => form.value.caraBayar, (v) => {
  if (!dialogDaftar.value) return;
  form.value.jenisMcu = v === "korporasi" ? "berkala" : "umum";
  if (v === "perorangan") form.value.perusahaanUuid = null;
  const p = paket.value.find((x) => x.uuid === form.value.paketUuid);
  if (p && p.jenis !== "semua" && p.jenis !== v) form.value.paketUuid = null;
});
// Harga berlaku (harga kontrak perusahaan pada tanggal MCU bila ada).
const paketHarga = ref<any[]>([]);
const muatHargaPaket = async () => {
  if (form.value.caraBayar !== "korporasi" || !form.value.perusahaanUuid) {
    paketHarga.value = [];
    return;
  }
  const res = await daftarPaketMcu({ limit: 500, perusahaan_uuid: form.value.perusahaanUuid, tanggal: tglIso(form.value.tanggal) });
  paketHarga.value = res?.payload?.data ?? [];
};
watch(() => [form.value.perusahaanUuid, form.value.caraBayar, form.value.tanggal?.getTime?.()], () => dialogDaftar.value && muatHargaPaket());
const hargaBerlaku = (p: any) => paketHarga.value.find((x) => x.uuid === p?.uuid)?.hargaBerlaku ?? p?.harga ?? 0;
const kontrakBerlaku = (p: any) => paketHarga.value.find((x) => x.uuid === p?.uuid)?.hargaKontrak != null;
const paketTersedia = computed(() => paket.value.filter((p) => p.status && (p.jenis === "semua" || p.jenis === form.value.caraBayar)));
const paketDipilih = computed(() => paket.value.find((p) => p.uuid === form.value.paketUuid));
const perusahaanAktif = computed(() => perusahaan.value.filter((p) => p.status));

const cariPasien = async () => {
  mencari.value = true;
  hasilCari.value = (await cariPasienMcu(kataPasien.value, 30))?.payload ?? [];
  mencari.value = false;
};
// ── Pasien baru langsung dari MCU (lewat Admisi; NIK terdaftar → pasien lama, tidak diubah) ──
const formBaru = ref<any>(null);
const wilayah = ref<any>(null);
const menyimpanBaru = ref(false);
const bukaPasienBaru = async () => {
  formBaru.value = { nama: kataPasien.value && !/\d{6,}/.test(kataPasien.value) ? kataPasien.value : "", jenisIdentitas: "KTP", noIdentitas: /^\d{16}$/.test(kataPasien.value) ? kataPasien.value : "",
    jenisKelamin: null, tglLahir: null, noTelp: "", alamat: "", prov: null, city: null, district: null };
  if (!wilayah.value) wilayah.value = (await referensiImporMcu())?.payload?.wilayah ?? { provinsi: [], kabupaten: [], kecamatan: [] };
};
const opsiKab = computed(() => (wilayah.value?.kabupaten ?? []).filter((k: any) => k.prov === formBaru.value?.prov));
const opsiKec = computed(() => (wilayah.value?.kecamatan ?? []).filter((k: any) => k.kab === formBaru.value?.city));
const simpanPasienBaru = async () => {
  const f = formBaru.value;
  menyimpanBaru.value = true;
  const res = await daftarPasienBaruMcu({
    nama: f.nama, jenisIdentitas: f.jenisIdentitas, noIdentitas: f.noIdentitas, jenisKelamin: f.jenisKelamin, tglLahir: f.tglLahir ? tglIso(f.tglLahir) : "",
    noTelp: f.noTelp, alamat: f.alamat, prov: f.prov ?? "", city: f.city ?? "", district: f.district ?? "",
  });
  menyimpanBaru.value = false;
  const d = res?.payload;
  if (!d) return;
  const p = d.pasien;
  if (!sudahDipilih(p.uuid))
    form.value.peserta.push({ patientUuid: p.uuid, nama: p.name, noRm: p.noRm, umur: p.umur, gender: p.gender, nikKaryawan: "", jabatan: "", bagian: "",
      asal: d.status, peringatan: d.peringatan ?? [] });
  formBaru.value = null;
};
const sudahDipilih = (uuid: string) => form.value.peserta.some((p: any) => p.patientUuid === uuid);
const pilihPasien = (p: any) => {
  if (sudahDipilih(p.uuid)) form.value.peserta = form.value.peserta.filter((x: any) => x.patientUuid !== p.uuid);
  else form.value.peserta.push({ patientUuid: p.uuid, nama: p.name, noRm: p.noRm, umur: p.umur, gender: p.gender, nikKaryawan: "", jabatan: "", bagian: "" });
};
const pilihSemua = () => hasilCari.value.forEach((p) => !sudahDipilih(p.uuid) && pilihPasien(p));
const bisaSimpan = computed(
  () => form.value.paketUuid && form.value.peserta?.length && (form.value.caraBayar === "perorangan" || form.value.perusahaanUuid),
);
const simpanDaftar = async () => {
  menyimpan.value = true;
  const f = form.value;
  const res = await daftarkanPesertaMcu({
    caraBayar: f.caraBayar, perusahaanUuid: f.perusahaanUuid, paketUuid: f.paketUuid, tanggal: tglIso(f.tanggal), jenisMcu: f.jenisMcu,
    peserta: f.peserta.map((p: any) => ({ patientUuid: p.patientUuid, nikKaryawan: p.nikKaryawan, jabatan: p.jabatan, bagian: p.bagian })),
  });
  menyimpan.value = false;
  if (res) {
    dialogDaftar.value = false;
    muat();
  }
};

// ── Detail & aksi ───────────────────────────────────────────
const dialogDetail = ref(false);
const detail = ref<any>(null);
const bukaDetail = async (r: any) => {
  const res = await detailPesertaMcu(r.uuid);
  if (!res) return;
  detail.value = res.payload;
  dialogDetail.value = true;
};
const cetak = async (r: any, jenis: "laporan" | "sertifikat") => {
  const res = await detailPesertaMcu(r.uuid);
  if (!res) return;
  if (jenis === "laporan") cetakLaporanMcu(res.payload);
  else cetakSertifikatMcu(res.payload);
};
const periksa = (r: any) => router.push({ path: "/mcu/pemeriksaan", query: { peserta: r.uuid } });

const dialogBatal = ref(false);
const targetBatal = ref<any>(null);
const alasan = ref("");
const bukaBatal = (r: any) => {
  targetBatal.value = r;
  alasan.value = "";
  dialogBatal.value = true;
};
const batal = async () => {
  if (!alasan.value.trim()) return;
  const res = await batalPesertaMcu(targetBatal.value.uuid, alasan.value.trim());
  if (res) {
    dialogBatal.value = false;
    muat();
  }
};

const menu = ref();
const menuRow = ref<any>(null);
const itemMenu = computed(() => {
  const r = menuRow.value;
  if (!r) return [];
  const labPerlu = !["batal", "selesai"].includes(r.status) && (!r.labOrderUuid || Number(r.statusOrderLab) === 0);
  return [
    { label: "Detail", icon: "pi pi-eye", command: () => bukaDetail(r) },
    { label: "Pemeriksaan Stasiun", icon: "pi pi-clipboard", disabled: r.status === "batal", visible: izinMcu("Pemeriksaan", "READ"), command: () => periksa(r) },
    { label: "Cetak Laporan Hasil", icon: "pi pi-print", disabled: r.status === "batal", visible: boleh("CETAK"), command: () => cetak(r, "laporan") },
    { label: "Cetak Surat Keterangan", icon: "pi pi-file", disabled: r.status !== "selesai", visible: boleh("CETAK"), command: () => cetak(r, "sertifikat") },
    { label: "Buat Order Laboratorium", icon: "pi pi-plus", visible: boleh("UPDATE") && labPerlu, command: () => orderLabUlang(r) },
    { label: "Batalkan", icon: "pi pi-times", disabled: ["batal", "selesai"].includes(r.status) || !!r.invoiceUuid, visible: boleh("BATAL"), command: () => bukaBatal(r) },
  ];
});
const orderLabUlang = async (r: any) => {
  if (!window.confirm(`Buat order laboratorium untuk ${r.namaPasien} (${r.noMcu})?`)) return;
  if (await buatOrderLabMcu(r.uuid)) muat();
};
const bukaMenu = (e: Event, r: any) => {
  menuRow.value = r;
  menu.value.toggle(e);
};

onMounted(async () => {
  muat();
  const [pr, pk] = await Promise.all([daftarPerusahaanMcu({ limit: 500 }), daftarPaketMcu({ limit: 500 })]);
  perusahaan.value = pr?.payload?.data ?? [];
  paket.value = pk?.payload?.data ?? [];
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-hidden" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Peserta MCU</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nama / No. RM / No. MCU" @keydown.enter="cariUlang" />
          <CustomSelect
            v-model="perusahaanFilter"
            label="Perusahaan"
            place-holder="Semua perusahaan"
            optionLabel="nama"
            optionValue="uuid"
            :options="[{ uuid: '', nama: 'Semua perusahaan' }, ...perusahaan]"
          />
          <CustomDatePicker v-model="mulai" label="Tanggal mulai" class="toolbar-field--date" :max-date="selesai" />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker v-model="selesai" label="Tanggal selesai" class="toolbar-field--date" :min-date="mulai" />
          <ToolbarFilterMenu :count="statusFilter.length">
            <template #label>Status</template>
            <CustomChip
              v-for="(s, k) in STATUS_PESERTA"
              :key="k"
              :label="s.label"
              :value="k"
              :isSelected="statusFilter.includes(k)"
              @selected="toggleStatus(k)"
            />
          </ToolbarFilterMenu>
          <ToolbarFilterMenu v-if="lisAktif" :count="statusLisFilter.length">
            <template #label>Status LIS</template>
            <CustomChip
              v-for="s in FILTER_STATUS_LIS"
              :key="s.value"
              :label="s.label"
              :value="s.value"
              :isSelected="statusLisFilter.includes(s.value)"
              @selected="toggleStatusLis(s.value)"
            />
          </ToolbarFilterMenu>
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariUlang" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="reset" />
          <CustomButton v-if="boleh('CREATE')" icon="PhUserPlus" label="Daftar Peserta" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaDaftar" />
          <CustomButton v-if="boleh('IMPOR')" icon="PhFileXls" label="Impor Excel" @click="dialogImpor = true" />
        </PageToolbar>
      </template>
      <template #content>
        <div class="flex flex-col h-full">
        <!-- Aksi massal LIS -->
        <div v-if="bolehLis" class="flex flex-wrap items-center gap-2 px-1 py-2 text-xs border-b border-grey-100" data-uji="bar-lis">
          <span class="font-semibold">{{ jumlahDipilih }} peserta dipilih</span>
          <template v-if="!semuaFilter && halamanTerpilihSemua && total > rows.length">
            · <a class="underline cursor-pointer text-opensimrs-300" data-uji="pilih-semua-filter" @click="semuaFilter = true">Pilih semua {{ total }} peserta sesuai filter</a>
          </template>
          <template v-if="semuaFilter">
            (semua sesuai filter) · <a class="underline cursor-pointer text-opensimrs-300" @click="semuaFilter = false">batal</a>
          </template>
          <a v-if="pilihan.length && !semuaFilter" class="underline cursor-pointer text-grey-400" @click="pilihan = []">kosongkan</a>
          <span v-if="!semuaFilter && pilihan.length" class="text-grey-400">
            ({{ hitungPilihan(['belum']) }} belum · {{ hitungPilihan(['gagal']) }} gagal · {{ hitungPilihan(['terkirim', 'hasil_sebagian', 'hasil_lengkap']) }} terkirim<span v-if="hitungPilihan(['tidak_pasti'])"> · {{ hitungPilihan(['tidak_pasti']) }} tidak pasti</span>)
          </span>
          <div class="flex flex-wrap gap-2 ml-auto">
            <CustomButton icon="PhPaperPlaneTilt" :label="AKSI_LIS.kirim.label" :disabled="!jumlahDipilih" data-uji="aksi-kirim-lis" @click="bukaLis('kirim')" />
            <CustomButton icon="PhArrowClockwise" :label="AKSI_LIS.ulang.label" outlined borderColor="border-[#B42318]" textColor="text-[#B42318]" :disabled="!jumlahDipilih" data-uji="aksi-ulang-lis" @click="bukaLis('ulang')" />
            <CustomButton icon="PhDownloadSimple" :label="AKSI_LIS.hasil.label" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" :disabled="!jumlahDipilih" data-uji="aksi-hasil-lis" @click="bukaLis('hasil')" />
            <Button text size="small" aria-label="Aksi LIS lain" @click="menuLis.toggle($event)"><PhDotsThreeVertical :size="18" /></Button>
            <Menu ref="menuLis" :model="itemAksiLis" popup />
          </div>
        </div>
        <div class="flex-1 min-h-0">
        <DataTable v-model:selection="pilihan" :value="rows" :loading="memuat" stripedRows class="text-xs" scrollable scrollHeight="flex" dataKey="uuid">
          <Column v-if="bolehLis" selectionMode="multiple" headerClass="bg-opensimrs-50" class="w-10" />
          <template #empty><div class="py-6 text-center text-grey-400">Tidak ada peserta MCU pada filter ini</div></template>
          <Column header="No. MCU / Tanggal" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div class="font-semibold">{{ data.noMcu }}</div>
              <div class="text-grey-400">{{ tglIndo(data.tanggal) }}</div>
            </template>
          </Column>
          <Column header="Peserta" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div class="font-semibold">{{ data.namaPasien }} <span v-if="data.cito" class="px-1 text-[10px] rounded bg-danger-300 text-white">CITO</span></div>
              <div class="text-grey-400">{{ data.noRm }} · {{ jenisKelamin(data.gender) }} · {{ data.umur ?? "-" }} th</div>
            </template>
          </Column>
          <Column header="Perusahaan / Bayar" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div>{{ data.namaPerusahaan ?? "Perorangan" }}</div>
              <div class="text-grey-400">
                {{ JENIS_MCU[data.jenisMcu] ?? data.jenisMcu }}<span v-if="data.noInvoice"> · {{ data.noInvoice }}</span>
              </div>
            </template>
          </Column>
          <Column header="Paket" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div>{{ data.namaPaket }}</div>
              <div class="text-grey-400">{{ rupiah(data.harga) }}<span v-if="data.kontrakUuid"> (kontrak)</span><span v-if="data.hargaTambahan"> + {{ rupiah(data.hargaTambahan) }}</span></div>
            </template>
          </Column>
          <Column header="Progres" headerClass="bg-opensimrs-50" class="w-36">
            <template #body="{ data }">
              <div class="text-[11px] mb-1">{{ data.stasiunSelesai }}/{{ data.stasiunTotal }} stasiun</div>
              <div v-if="data.labOrderUuid" class="text-[10px] text-grey-400">Lab {{ data.noOrderLab }}: {{ Number(data.statusOrderLab) === 0 ? "batal" : `${data.labTerisi}/${data.labTotal} hasil` }}</div>
              <ProgressBar :value="Math.round((data.stasiunSelesai / Math.max(data.stasiunTotal, 1)) * 100)" :showValue="false" style="height: 6px" />
            </template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data }">
              <div class="flex flex-col items-start gap-1">
                <span class="px-2 py-0.5 rounded-full font-semibold" :class="[STATUS_PESERTA[data.status as StatusPeserta]?.bg, STATUS_PESERTA[data.status as StatusPeserta]?.text]">
                  {{ STATUS_PESERTA[data.status as StatusPeserta]?.label ?? data.status }}
                </span>
                <span v-if="data.kesimpulan" class="px-2 py-0.5 rounded-full font-semibold" :class="[KESIMPULAN_MCU[data.kesimpulan as Kesimpulan].bg, KESIMPULAN_MCU[data.kesimpulan as Kesimpulan].text]">
                  {{ KESIMPULAN_MCU[data.kesimpulan as Kesimpulan].label }}
                </span>
              </div>
            </template>
          </Column>
          <Column v-if="lisAktif" header="LIS" headerClass="bg-opensimrs-50" class="w-48">
            <template #body="{ data }">
              <div class="flex flex-col items-start gap-0.5" data-uji="status-lis">
                <span class="px-2 py-0.5 rounded-full font-semibold" :class="[STATUS_LIS[data.statusLis as StatusLis]?.bg, STATUS_LIS[data.statusLis as StatusLis]?.text]">
                  {{ STATUS_LIS[data.statusLis as StatusLis]?.label ?? data.statusLis }}
                </span>
                <span v-if="data.noLabLis" class="text-[10px] text-grey-400">No. Lab {{ data.noLabLis }}</span>
                <template v-if="['gagal', 'tidak_pasti'].includes(data.statusLis) && data.pesanLis">
                  <span class="text-[10px] text-[#B42318] line-clamp-2" :title="data.pesanLis">{{ data.pesanLis }}</span>
                  <a v-if="petunjukGalatLis(data.pesanLis)?.rute" class="text-[10px] underline cursor-pointer text-opensimrs-300" :title="petunjukGalatLis(data.pesanLis)!.teks"
                    @click="router.push(petunjukGalatLis(data.pesanLis)!.rute!)">{{ petunjukGalatLis(data.pesanLis)!.label }}</a>
                  <span v-else-if="petunjukGalatLis(data.pesanLis)" class="text-[10px] text-grey-400">{{ petunjukGalatLis(data.pesanLis)!.teks }}</span>
                </template>
              </div>
            </template>
          </Column>
          <Column header="" headerClass="bg-opensimrs-50" class="w-28">
            <template #body="{ data }">
              <div class="flex gap-1">
                <Button v-if="data.status !== 'batal' && izinMcu('Pemeriksaan', 'READ')" size="small" label="Periksa" @click="periksa(data)" />
                <Button text rounded size="small" aria-label="Aksi lain" @click="bukaMenu($event, data)"><PhDotsThreeVertical :size="18" /></Button>
              </div>
            </template>
          </Column>
        </DataTable>
        </div>
        </div>
        <Menu ref="menu" :model="itemMenu" popup />
      </template>
      <template #footer>
        <div class="px-4 py-2">
          <Paginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <KirimLisMcu
      v-model:visible="dialogLis"
      :aksi="lis.aksi"
      :pesertaUuids="lis.pesertaUuids"
      :filter="lis.filter"
      :jumlah="lis.jumlah"
      :batchAwal="lis.batchAwal"
      @selesai="segarkanPilihan"
    />
    <ImporExcelMcu v-model:visible="dialogImpor" :perusahaan="perusahaan" :paket="paket" @selesai="tampilkanHasilImpor" />

    <!-- Pendaftaran -->
    <CustomDialog v-model:visible="dialogDaftar" width="980px">
      <template #header>Daftar Peserta MCU</template>
      <template #body>
        <div class="grid grid-cols-[1fr,1.3fr] gap-5 pt-4 text-sm">
          <div class="flex flex-col gap-3">
            <div class="flex gap-4">
              <label class="flex items-center gap-2"><RadioButton v-model="form.caraBayar" value="perorangan" /> Perorangan</label>
              <label class="flex items-center gap-2"><RadioButton v-model="form.caraBayar" value="korporasi" /> Korporasi / Rombongan</label>
            </div>
            <label v-if="form.caraBayar === 'korporasi'" class="flex flex-col gap-1">Perusahaan *
              <Select v-model="form.perusahaanUuid" :options="perusahaanAktif" optionLabel="nama" optionValue="uuid" filter placeholder="Pilih perusahaan" />
            </label>
            <label class="flex flex-col gap-1">Paket MCU *
              <Select v-model="form.paketUuid" :options="paketTersedia" optionLabel="nama" optionValue="uuid" filter placeholder="Pilih paket">
                <template #option="{ option }">
                  <div class="flex justify-between w-full gap-3"><span>{{ option.nama }}</span><span class="text-grey-400">{{ rupiah(hargaBerlaku(option)) }}<span v-if="kontrakBerlaku(option)"> (kontrak)</span></span></div>
                </template>
              </Select>
            </label>
            <div v-if="paketDipilih" class="p-2 text-xs rounded bg-opensimrs-50">
              {{ rupiah(hargaBerlaku(paketDipilih)) }} / peserta<span v-if="kontrakBerlaku(paketDipilih)"> — harga kontrak {{ perusahaan.find((p) => p.uuid === form.perusahaanUuid)?.nama }} (harga paket {{ rupiah(paketDipilih.harga) }})</span> · {{ paketDipilih.jumlahItem }} item ·
              {{ (paketDipilih.stasiun ?? []).length }} stasiun
            </div>
            <div class="grid grid-cols-2 gap-3">
              <label class="flex flex-col gap-1">Tanggal MCU<DatePicker v-model="form.tanggal" dateFormat="dd-mm-yy" /></label>
              <label class="flex flex-col gap-1">Jenis MCU
                <Select v-model="form.jenisMcu" :options="OPSI_JENIS_MCU" optionLabel="label" optionValue="value" />
              </label>
            </div>
            <div class="mt-2">
              <div class="mb-1 font-semibold">Cari pasien terdaftar</div>
              <div class="flex gap-2">
                <InputText v-model="kataPasien" class="flex-1" placeholder="Nama / No. RM / NIK" @keydown.enter="cariPasien" />
                <Button label="Cari" :loading="mencari" @click="cariPasien" />
              </div>
              <div class="flex items-center justify-between mt-1 text-xs text-grey-400">
                <span>Belum terdaftar? Daftarkan pasien baru langsung di sini. Rombongan karyawan lebih cepat lewat Impor Excel.</span>
                <Button v-if="!formBaru" text size="small" label="+ Pasien Baru" data-uji="tombol-pasien-baru" @click="bukaPasienBaru" />
              </div>
              <div v-if="formBaru" class="grid grid-cols-2 gap-2 p-2 mt-2 text-xs border rounded border-opensimrs-100 bg-opensimrs-50" data-uji="form-pasien-baru">
                <label class="flex flex-col col-span-2 gap-1">Nama lengkap *<InputText v-model="formBaru.nama" size="small" /></label>
                <label class="flex flex-col gap-1">Jenis identitas<Select v-model="formBaru.jenisIdentitas" :options="['KTP', 'PASPOR', 'LAIN-LAIN']" size="small" /></label>
                <label class="flex flex-col gap-1">No. identitas / NIK *<InputText v-model="formBaru.noIdentitas" size="small" :invalid="formBaru.jenisIdentitas === 'KTP' && !!formBaru.noIdentitas && !/^\d{16}$/.test(formBaru.noIdentitas)" /></label>
                <label class="flex flex-col gap-1">Jenis kelamin *<Select v-model="formBaru.jenisKelamin" :options="[{ v: 'Male', l: 'Laki-laki' }, { v: 'Female', l: 'Perempuan' }]" optionLabel="l" optionValue="v" size="small" /></label>
                <label class="flex flex-col gap-1">Tanggal lahir *<DatePicker v-model="formBaru.tglLahir" dateFormat="dd-mm-yy" :maxDate="new Date()" size="small" /></label>
                <label class="flex flex-col gap-1">No. HP<InputText v-model="formBaru.noTelp" size="small" /></label>
                <label class="flex flex-col gap-1">Alamat<InputText v-model="formBaru.alamat" size="small" /></label>
                <label class="flex flex-col gap-1">Provinsi<Select v-model="formBaru.prov" :options="wilayah?.provinsi ?? []" optionLabel="nama" optionValue="code" filter showClear size="small" @change="formBaru.city = null; formBaru.district = null" /></label>
                <label class="flex flex-col gap-1">Kabupaten/Kota<Select v-model="formBaru.city" :options="opsiKab" optionLabel="nama" optionValue="code" filter showClear size="small" @change="formBaru.district = null" /></label>
                <label class="flex flex-col gap-1">Kecamatan<Select v-model="formBaru.district" :options="opsiKec" optionLabel="nama" optionValue="code" filter showClear size="small" /></label>
                <div class="flex items-end justify-end gap-2">
                  <Button text size="small" severity="secondary" label="Batal" @click="formBaru = null" />
                  <Button size="small" label="Simpan & Pilih" :loading="menyimpanBaru" :disabled="!formBaru.nama || !formBaru.noIdentitas" @click="simpanPasienBaru" />
                </div>
                <div class="col-span-2 text-[11px] text-grey-400">
                  Pasien didaftarkan ke master pasien lewat Admisi (No. RM baru). Bila NIK sudah terdaftar, pasien lama dipakai tanpa mengubah datanya.
                </div>
              </div>
              <div class="mt-2 overflow-auto border rounded max-h-64 border-grey-100">
                <div v-if="!hasilCari.length" class="p-3 text-xs text-center text-grey-400">Ketik kata kunci lalu Cari</div>
                <label v-for="p in hasilCari" :key="p.uuid" class="flex items-center gap-2 px-2 py-1.5 border-b border-grey-100 cursor-pointer hover:bg-opensimrs-50">
                  <Checkbox :modelValue="sudahDipilih(p.uuid)" binary @update:modelValue="pilihPasien(p)" />
                  <div class="text-xs">
                    <div class="font-semibold">{{ p.name }}</div>
                    <div class="text-grey-400">{{ p.noRm }} · {{ jenisKelamin(p.gender) }} · {{ p.umur ?? "-" }} th</div>
                  </div>
                </label>
              </div>
              <Button v-if="hasilCari.length > 1" text size="small" label="Pilih semua hasil" class="mt-1" @click="pilihSemua" />
            </div>
          </div>

          <div class="flex flex-col">
            <div class="mb-2 font-semibold">Peserta dipilih ({{ form.peserta?.length ?? 0 }})</div>
            <div class="overflow-auto border rounded border-grey-100 max-h-[440px]">
              <table class="w-full text-xs">
                <thead class="sticky top-0 bg-opensimrs-50">
                  <tr>
                    <th class="p-2 text-left">Pasien</th>
                    <template v-if="form.caraBayar === 'korporasi'">
                      <th class="p-2 text-left">NIK Kary.</th>
                      <th class="p-2 text-left">Jabatan</th>
                      <th class="p-2 text-left">Bagian</th>
                    </template>
                    <th class="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!form.peserta?.length"><td colspan="5" class="p-4 text-center text-grey-400">Belum ada pasien dipilih</td></tr>
                  <tr v-for="(p, i) in form.peserta" :key="p.patientUuid" class="border-t border-grey-100">
                    <td class="p-2">
                      <div class="font-semibold">{{ p.nama }}
                        <span v-if="p.asal === 'baru'" class="px-1 text-[10px] rounded bg-[#D1FADF] text-[#027A48]">pasien baru</span>
                        <span v-else-if="p.asal === 'lama'" class="px-1 text-[10px] rounded bg-[#D1E9FF] text-[#175CD3]">pasien lama</span>
                      </div>
                      <div class="text-grey-400">{{ p.noRm }}</div>
                      <div v-for="w in p.peringatan ?? []" :key="w" class="text-[#B54708]">{{ w }} (data master tidak diubah)</div>
                    </td>
                    <template v-if="form.caraBayar === 'korporasi'">
                      <td class="p-1"><InputText v-model="p.nikKaryawan" size="small" class="w-24" /></td>
                      <td class="p-1"><InputText v-model="p.jabatan" size="small" class="w-28" /></td>
                      <td class="p-1"><InputText v-model="p.bagian" size="small" class="w-28" /></td>
                    </template>
                    <td class="p-1">
                      <Button text rounded size="small" severity="danger" aria-label="Hapus" @click="form.peserta.splice(i, 1)"><PhX :size="14" /></Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="paketDipilih && form.peserta?.length" class="mt-2 text-right">
              Total: <b>{{ rupiah(hargaBerlaku(paketDipilih) * form.peserta.length) }}</b>
              <div class="text-xs text-grey-400">
                {{ form.caraBayar === "perorangan" ? "Tagihan dikirim ke Kasir (layanan MCU) per peserta." : "Ditagihkan ke perusahaan lewat Invoice Korporasi." }}
              </div>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-grey-200" textColor="text-grey-400" @click="dialogDaftar = false" />
          <CustomButton :label="`Daftarkan ${form.peserta?.length || ''} Peserta`" :loading="menyimpan" :disabled="!bisaSimpan" @click="simpanDaftar" />
        </div>
      </template>
    </CustomDialog>

    <!-- Detail -->
    <CustomDialog v-model:visible="dialogDetail" width="720px">
      <template #header>Detail Peserta {{ detail?.noMcu }}</template>
      <template #body>
        <div v-if="detail" class="flex flex-col gap-3 pt-4 text-sm">
          <div class="grid grid-cols-2 gap-x-6 gap-y-1">
            <div><span class="text-grey-400">Nama:</span> {{ detail.namaPasien }} ({{ detail.noRm }})</div>
            <div><span class="text-grey-400">Tanggal:</span> {{ tglIndo(detail.tanggal) }}</div>
            <div><span class="text-grey-400">Paket:</span> {{ detail.namaPaket }} · {{ rupiah(detail.harga) }}</div>
            <div><span class="text-grey-400">Perusahaan:</span> {{ detail.namaPerusahaan ?? "Perorangan" }}</div>
            <div><span class="text-grey-400">Jenis MCU:</span> {{ JENIS_MCU[detail.jenisMcu] }}</div>
            <div><span class="text-grey-400">Status:</span> {{ STATUS_PESERTA[detail.status as StatusPeserta]?.label }}</div>
            <div v-if="detail.radiologi"><span class="text-grey-400">Order radiologi:</span> {{ detail.radiologi.noOrder }} ({{ detail.radiologi.status }})</div>
            <div v-if="detail.laboratorium?.noOrder"><span class="text-grey-400">Order laboratorium:</span> {{ detail.laboratorium.noOrder }} ({{ detail.laboratorium.statusLabel }}, {{ detail.laboratorium.terisi }}/{{ detail.laboratorium.total }} hasil)</div>
            <div v-if="detail.noRegistrasi"><span class="text-grey-400">No. registrasi:</span> {{ detail.noRegistrasi }}</div>
            <div v-if="detail.nikKaryawan || detail.jabatan"><span class="text-grey-400">Karyawan:</span> {{ [detail.nikKaryawan, detail.jabatan, detail.bagian].filter(Boolean).join(" · ") }}</div>
            <div v-if="detail.namaUnitAsal || detail.dokterPengirim"><span class="text-grey-400">Unit / dokter pengirim:</span> {{ [detail.namaUnitAsal, detail.dokterPengirim].filter(Boolean).join(" · ") }}</div>
            <div v-if="detail.namaPenjamin"><span class="text-grey-400">Penjamin:</span> {{ detail.namaPenjamin }}</div>
            <div v-if="detail.diagnosaAwal || detail.icd10Nama" class="col-span-2"><span class="text-grey-400">Klinis:</span> {{ [detail.diagnosaAwal, detail.icd10Code ? `${detail.icd10Code} ${detail.icd10Nama ?? ""}` : detail.icd10Nama].filter(Boolean).join(" · ") }}</div>
            <div v-if="detail.tambahan?.length" class="col-span-2"><span class="text-grey-400">Pemeriksaan tambahan:</span> {{ detail.tambahan.map((t: any) => `${t.nama} (${rupiah(t.harga)})`).join(", ") }}</div>
            <div v-if="detail.cito" class="font-semibold text-danger-300">CITO</div>
            <div v-if="detail.alasanBatal" class="col-span-2 text-danger-300">Alasan batal: {{ detail.alasanBatal }}</div>
          </div>
          <table class="w-full text-xs border border-grey-100">
            <thead class="bg-opensimrs-50"><tr><th class="p-2 text-left">Stasiun</th><th class="p-2 text-left">Status</th><th class="p-2 text-left">Petugas</th></tr></thead>
            <tbody>
              <tr v-for="s in detail.stasiun" :key="s.kode" class="border-t border-grey-100">
                <td class="p-2">{{ s.nama }}</td>
                <td class="p-2">
                  <span :class="s.status === 'selesai' ? 'text-[#027A48] font-semibold' : 'text-grey-400'">{{ s.status === "selesai" ? "Selesai" : "Belum" }}</span>
                </td>
                <td class="p-2">{{ s.petugas ?? "-" }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="detail.kesimpulan" class="p-2 rounded" :class="[KESIMPULAN_MCU[detail.kesimpulan as Kesimpulan].bg]">
            <b>{{ detail.labelKesimpulan }}</b> — {{ detail.dokterPemeriksa }}
            <div v-if="detail.catatanKesimpulan">Catatan: {{ detail.catatanKesimpulan }}</div>
            <div v-if="detail.saran">Saran: {{ detail.saran }}</div>
          </div>
        </div>
      </template>
    </CustomDialog>

    <!-- Batal -->
    <CustomDialog v-model:visible="dialogBatal" width="460px">
      <template #header>Batalkan Peserta {{ targetBatal?.noMcu }}</template>
      <template #body>
        <div class="flex flex-col gap-2 pt-4 text-sm">
          <div>{{ targetBatal?.namaPasien }} — {{ targetBatal?.namaPaket }}</div>
          <div class="text-xs text-grey-400">
            Tagihan kasir (perorangan) ditarik; bila tagihan sudah dibayar, pembatalan ditolak dan harus melalui refund di Kasir.
            Order radiologi yang belum diperiksa dan order laboratorium yang belum berisi hasil ikut dibatalkan.
          </div>
          <label class="flex flex-col gap-1">Alasan pembatalan *<TextArea v-model="alasan" rows="3" /></label>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Tutup" outlined borderColor="border-grey-200" textColor="text-grey-400" @click="dialogBatal = false" />
          <CustomButton label="Batalkan Peserta" backgroundColor="bg-danger-300" :disabled="!alasan.trim()" @click="batal" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
