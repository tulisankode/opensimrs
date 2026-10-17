<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useToast } from "primevue/usetoast";
import { fiturAktif } from "@/stores/modulFaskes";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  GOLONGAN_ABO,
  HASIL_UJI,
  JK_BDRS,
  RHESUS,
  SKRINING_ANTIBODI,
  STATUS_PERMINTAAN_BDRS,
  SUMBER_KUNJUNGAN_BDRS,
  ambilStatusUtdPermintaan,
  buatPermintaanBdrs,
  cariPasienBdrs,
  daftarDokterBdrs,
  daftarKantongUtdPermintaan,
  daftarKomponenBdrs,
  daftarLokasiBdrs,
  daftarPermintaanBdrs,
  detailPermintaanBdrs,
  gayaPermintaanBdrs,
  gayaSerahTerimaBdrs,
  gayaValidasiKantongUtd,
  golonganRh,
  izinBdrs,
  keTanggal,
  kirimPermintaanKeUtd,
  lengkapiPermintaanBdrs,
  opsi,
  permintaanKunjunganBdrs,
  terimaKantongUtd,
  ubahStatusPermintaanBdrs,
  umurBdrs,
  waktuBdrs,
} from "@/stores/penunjang/bankDarah";

// Permintaan Darah dari ruangan (Rawat Jalan/Rawat Inap/IGD): daftar antrean BDRS, pengajuan permintaan baru pada
// kunjungan pasien (No. Reg), serta tindakan proses/kembalikan/tolak/batalkan/lengkapi sesuai status & izin.
// Alur: baru → diproses → (perlu_dilengkapi → diproses) → dipenuhi_sebagian/diserahkan, atau dibatalkan/ditolak.
const storeUtils = utilsStore();
const toast = useToast();
const boleh = (aksi: string) => izinBdrs("Permintaan Darah", aksi);

// ── Daftar & filter
const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");
const tglMulai = ref<Date | null>(new Date());
const tglSelesai = ref<Date | null>(new Date());
const filterStatus = ref<string[]>([]);
const hanyaCito = ref(false);

const toggleStatus = (nilai: string) => {
  filterStatus.value = filterStatus.value.includes(nilai) ? filterStatus.value.filter((x) => x !== nilai) : [...filterStatus.value, nilai];
};

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarPermintaanBdrs({
      page: page.value,
      limit: limit.value,
      cari: cari.value,
      status: filterStatus.value,
      cito: hanyaCito.value ? 1 : undefined,
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
  hanyaCito.value = false;
  cariData();
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

// ── Referensi form
const komponen = ref<any[]>([]);
const lokasi = ref<any[]>([]);
const dokter = ref<any[]>([]);
const muatReferensi = async () => {
  if (!komponen.value.length) komponen.value = (await daftarKomponenBdrs({ status: "aktif", limit: 200 }))?.payload?.data ?? [];
  if (!lokasi.value.length) lokasi.value = (await daftarLokasiBdrs({ pelayanan: "rajal,ranap,igd" }))?.payload ?? [];
  if (!dokter.value.length) dokter.value = (await daftarDokterBdrs())?.payload ?? [];
};
const opsiKomponen = computed(() => komponen.value.map((k: any) => ({ value: k.uuid, label: `${k.kode} — ${k.nama}` })));

// ── Detail
const detail = ref<any>(null);
const dialogDetail = ref(false);
const kantongUtd = ref<any[]>([]);
const muatKantongUtd = async () => {
  kantongUtd.value = detail.value && fiturAktif("bdrs_bridging") ? ((await daftarKantongUtdPermintaan(detail.value.uuid))?.payload ?? []) : [];
};
const bukaDetail = async (uuid: string) => {
  storeUtils.setLoading(true);
  try {
    const res = await detailPermintaanBdrs(uuid);
    if (res?.payload) {
      detail.value = res.payload;
      dialogDetail.value = true;
      await muatKantongUtd();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const AKTIF = ["baru", "diproses", "perlu_dilengkapi", "dipenuhi_sebagian"];
// ── Bridging UTD (STD-0017): kirim permintaan ke UTD mitra, ambil status/kantong, & teruskan kantong valid ke stok.
const memprosesUtd = ref(false);
const bisaKirimUtd = computed(() => fiturAktif("bdrs_bridging") && AKTIF.includes(detail.value?.status) && boleh("UPDATE"));
const bisaAmbilStatusUtd = computed(() => fiturAktif("bdrs_bridging") && boleh("READ") && AKTIF.includes(detail.value?.status));
const kirimKeUtd = async () => {
  memprosesUtd.value = true;
  try {
    const res = await kirimPermintaanKeUtd(detail.value.uuid);
    if (res?.payload) toast.add({ severity: "success", summary: res.message ?? "Dikirim ke UTD", life: 5000 });
    else if (res?.payload?.koneksi) toast.add({ severity: "warn", summary: "Pilih koneksi UTD", detail: "Lebih dari satu koneksi UTD aktif", life: 6000 });
    await muatKantongUtd();
  } finally {
    memprosesUtd.value = false;
  }
};
const ambilStatusUtd = async () => {
  memprosesUtd.value = true;
  try {
    await ambilStatusUtdPermintaan(detail.value.uuid);
    await muatKantongUtd();
    toast.add({ severity: "info", summary: "Status UTD diperbarui", life: 3000 });
  } finally {
    memprosesUtd.value = false;
  }
};
const terimaKantong = async (k: any) => {
  memprosesUtd.value = true;
  try {
    const res = await terimaKantongUtd(k.uuid);
    if (res?.payload) toast.add({ severity: "success", summary: `Kantong ${k.noKantong} diterima ke stok`, life: 4000 });
    await muatKantongUtd();
    muat();
  } finally {
    memprosesUtd.value = false;
  }
};
const bisaProses = computed(() => detail.value?.status === "baru" && boleh("UPDATE"));
const bisaKembalikanTolak = computed(() => ["baru", "diproses"].includes(detail.value?.status) && boleh("UPDATE"));
// Pembuat permintaan boleh membatalkan tanpa izin BATAL (diperiksa backend); tombol ditampilkan bagi pengaju & pemilik izin BATAL.
const bisaBatalkan = computed(() => AKTIF.includes(detail.value?.status) && (boleh("BATAL") || boleh("CREATE")));
const bisaLengkapi = computed(() => detail.value?.status === "perlu_dilengkapi" && (boleh("LENGKAPI") || boleh("CREATE")));

const proses = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await ubahStatusPermintaanBdrs(detail.value.uuid, "proses");
    if (res?.payload) {
      detail.value = res.payload;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Kembalikan / tolak / batalkan (beralasan)
const JUDUL_AKSI: Record<string, string> = { kembalikan: "Kembalikan untuk Dilengkapi", tolak: "Tolak Permintaan", batalkan: "Batalkan Permintaan" };
const dialogAlasan = ref(false);
const aksiAlasan = ref<"kembalikan" | "tolak" | "batalkan">("kembalikan");
const alasan = ref("");
const galatAlasan = ref("");
const bukaAlasan = (aksi: "kembalikan" | "tolak" | "batalkan") => {
  aksiAlasan.value = aksi;
  alasan.value = "";
  galatAlasan.value = "";
  dialogAlasan.value = true;
};
const simpanAlasan = async () => {
  if (!alasan.value.trim()) return (galatAlasan.value = "Alasan wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await ubahStatusPermintaanBdrs(detail.value.uuid, aksiAlasan.value, alasan.value.trim());
    if (res?.payload) {
      dialogAlasan.value = false;
      detail.value = res.payload;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Form permintaan baru / lengkapi
const dialogForm = ref(false);
const modeLengkapi = ref(false);
const kataPasien = ref("");
const hasilPasien = ref<any[]>([]);
const pasien = ref<any>(null);
const riwayatPasien = ref<any[]>([]);
const kosong = () => ({ noReg: "", lokasiAsalUuid: "", komponenUuid: "", golonganDiminta: "", rhesusDiminta: "", jumlahDiminta: 1, indikasi: "", cito: false, dokterPemintaUuid: "" });
const form = ref<any>(kosong());
const galatForm = ref("");
// No. Reg dari riwayat permintaan pasien terpilih (bantuan isian; kunjungan aktif tetap diperiksa backend).
const noRegRiwayat = computed(() => [...new Set(riwayatPasien.value.map((r: any) => r.noReg).filter(Boolean))].slice(0, 5));

const bukaBaru = async () => {
  modeLengkapi.value = false;
  form.value = kosong();
  galatForm.value = "";
  kataPasien.value = "";
  hasilPasien.value = [];
  pasien.value = null;
  riwayatPasien.value = [];
  dialogForm.value = true;
  muatReferensi();
};
const bukaLengkapi = async () => {
  const d = detail.value;
  modeLengkapi.value = true;
  galatForm.value = "";
  form.value = {
    noReg: d.noReg ?? "",
    lokasiAsalUuid: d.lokasiAsalUuid ?? "",
    komponenUuid: d.komponenUuid ?? "",
    golonganDiminta: d.golonganDiminta ?? "",
    rhesusDiminta: d.rhesusDiminta ?? "",
    jumlahDiminta: Number(d.jumlahDiminta) || 1,
    indikasi: d.indikasi ?? "",
    cito: !!d.cito,
  };
  dialogForm.value = true;
  muatReferensi();
};
const cariPasien = async () => {
  hasilPasien.value = (await cariPasienBdrs(kataPasien.value))?.payload ?? [];
};
const pilihPasien = async (p: any) => {
  pasien.value = p;
  hasilPasien.value = [];
  riwayatPasien.value = (await permintaanKunjunganBdrs({ patient_uuid: p.uuid }))?.payload ?? [];
};
const simpanForm = async () => {
  const f = form.value;
  galatForm.value = "";
  if (!modeLengkapi.value && !f.noReg.trim()) return (galatForm.value = "No. Registrasi kunjungan wajib diisi");
  if (!modeLengkapi.value && !f.dokterPemintaUuid) return (galatForm.value = "Dokter peminta wajib dipilih");
  if (!f.komponenUuid) return (galatForm.value = "Komponen darah wajib dipilih");
  if (!f.golonganDiminta || !f.rhesusDiminta) return (galatForm.value = "Golongan darah & rhesus yang diminta wajib dipilih");
  if (!Number.isInteger(Number(f.jumlahDiminta)) || f.jumlahDiminta < 1 || f.jumlahDiminta > 20) return (galatForm.value = "Jumlah kantong harus 1–20");
  if (!f.indikasi.trim()) return (galatForm.value = "Indikasi transfusi wajib diisi");
  storeUtils.setLoading(true);
  try {
    const isi = {
      komponenUuid: f.komponenUuid,
      golonganDiminta: f.golonganDiminta,
      rhesusDiminta: f.rhesusDiminta,
      jumlahDiminta: Number(f.jumlahDiminta),
      indikasi: f.indikasi.trim(),
      cito: !!f.cito,
    };
    const res = modeLengkapi.value
      ? await lengkapiPermintaanBdrs(detail.value.uuid, isi)
      : await buatPermintaanBdrs({ ...isi, noReg: f.noReg.trim(), lokasiAsalUuid: f.lokasiAsalUuid || null, dokterPemintaUuid: f.dokterPemintaUuid });
    if (res?.payload) {
      dialogForm.value = false;
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
          <h1 class="toolbar-heading text-opensimrs-300">Permintaan Darah</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nama / No. RM / No. Permintaan" :maxLength="100" @keydown.enter="cariData" />
          <CustomDatePicker v-model="tglMulai" label="Tanggal mulai" class="toolbar-field--date" :maxDate="tglSelesai ?? undefined" />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker v-model="tglSelesai" label="Tanggal selesai" class="toolbar-field--date" :minDate="tglMulai ?? undefined" />
          <ToolbarFilterMenu :count="filterStatus.length + (hanyaCito ? 1 : 0)">
            <template #label>Status</template>
            <CustomChip
              v-for="(s, kode) in STATUS_PERMINTAAN_BDRS"
              :key="kode"
              :label="s.label"
              :value="String(kode)"
              :isSelected="filterStatus.includes(String(kode))"
              @selected="toggleStatus($event)"
            />
            <CustomChip label="Hanya CITO" value="cito" :isSelected="hanyaCito" @selected="hanyaCito = !hanyaCito" />
          </ToolbarFilterMenu>
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="reset" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Permintaan" @click="bukaBaru" />
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
          <Column header="No. Permintaan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">
                <span v-if="d.cito" class="px-1.5 mr-1 text-[10px] font-bold text-white rounded bg-danger-300">CITO</span>{{ d.noPermintaan }}
              </div>
              <div class="text-grey-400">{{ waktuBdrs(d.createdAt) }}</div>
            </template>
          </Column>
          <Column header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.namaPasien ?? "-" }}</div>
              <div class="text-grey-400">{{ d.noRm }} · {{ JK_BDRS[d.gender] ?? "-" }} · {{ umurBdrs(d.birthDate) }}</div>
            </template>
          </Column>
          <Column header="Asal" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div>{{ SUMBER_KUNJUNGAN_BDRS[d.sumberKunjungan] ?? d.sumberKunjungan }}</div>
              <div class="text-grey-400">{{ d.lokasiAsal ?? "-" }} · {{ d.noReg }}</div>
            </template>
          </Column>
          <Column header="Komponen" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div>{{ d.komponenKode }} — {{ d.komponenNama }}</div>
              <div class="text-grey-400">Golongan {{ golonganRh(d.golonganDiminta, d.rhesusDiminta) }}</div>
            </template>
          </Column>
          <Column header="Kantong" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.jumlahDipenuhi ?? 0 }}/{{ d.jumlahDiminta }}</template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-xs font-semibold" :class="[gayaPermintaanBdrs(d.status)?.bg, gayaPermintaanBdrs(d.status)?.text]">
                {{ gayaPermintaanBdrs(d.status)?.label ?? d.status }}
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

    <!-- Detail permintaan -->
    <CustomDialog v-model:visible="dialogDetail" width="860px">
      <template #header>Permintaan {{ detail?.noPermintaan }}</template>
      <template #body>
        <div v-if="detail" class="flex flex-col gap-4 pt-4 text-sm">
          <div class="grid grid-cols-2 gap-x-6 gap-y-1">
            <div><span class="text-grey-400">Pasien:</span> <b>{{ detail.namaPasien }}</b> ({{ detail.noRm }})</div>
            <div>
              <span class="text-grey-400">Status:</span>
              <span class="px-2 py-0.5 ml-1 rounded-full text-xs font-semibold" :class="[gayaPermintaanBdrs(detail.status)?.bg, gayaPermintaanBdrs(detail.status)?.text]">
                {{ gayaPermintaanBdrs(detail.status)?.label ?? detail.status }}
              </span>
              <span v-if="detail.cito" class="px-1.5 ml-1 text-[10px] font-bold text-white rounded bg-danger-300">CITO</span>
            </div>
            <div><span class="text-grey-400">Umur / JK:</span> {{ umurBdrs(detail.birthDate) }} / {{ JK_BDRS[detail.gender] ?? "-" }}</div>
            <div><span class="text-grey-400">Diajukan:</span> {{ waktuBdrs(detail.createdAt) }} · {{ detail.dibuatOleh ?? "-" }}</div>
            <div><span class="text-grey-400">Asal:</span> {{ SUMBER_KUNJUNGAN_BDRS[detail.sumberKunjungan] }} · {{ detail.lokasiAsal ?? "-" }} ({{ detail.noReg }})</div>
            <div v-if="detail.waktuDiproses"><span class="text-grey-400">Diproses:</span> {{ waktuBdrs(detail.waktuDiproses) }} · {{ detail.diprosesOleh }}</div>
            <div><span class="text-grey-400">Dokter peminta:</span> {{ detail.dokterPemintaNama ?? "-" }}</div>
            <div><span class="text-grey-400">Komponen:</span> {{ detail.komponenKode }} — {{ detail.komponenNama }}</div>
            <div><span class="text-grey-400">Golongan diminta:</span> {{ golonganRh(detail.golonganDiminta, detail.rhesusDiminta) }}</div>
            <div><span class="text-grey-400">Jumlah:</span> {{ detail.jumlahDipenuhi ?? 0 }} dari {{ detail.jumlahDiminta }} kantong</div>
            <div class="col-span-2"><span class="text-grey-400">Indikasi:</span> {{ detail.indikasi || "-" }}</div>
            <div v-if="detail.alasanKembali" class="col-span-2 text-danger-300">
              {{ detail.status === "perlu_dilengkapi" ? "Perlu dilengkapi" : "Alasan" }}: {{ detail.alasanKembali }}
            </div>
            <div v-if="detail.alasanBatal" class="col-span-2 text-danger-300">Alasan dibatalkan: {{ detail.alasanBatal }}</div>
          </div>

          <div>
            <h3 class="mb-1 font-semibold">Pemeriksaan Golongan Darah Pasien</h3>
            <div v-if="detail.pemeriksaan" class="grid grid-cols-3 gap-2 p-3 rounded-lg bg-opensimrs-50">
              <div><span class="text-grey-400">ABO/Rh:</span> <b>{{ golonganRh(detail.pemeriksaan.golonganAbo, detail.pemeriksaan.rhesus) }}</b></div>
              <div><span class="text-grey-400">Skrining antibodi:</span> {{ SKRINING_ANTIBODI[detail.pemeriksaan.hasilSkriningAntibodi] ?? "-" }}</div>
              <div><span class="text-grey-400">Petugas:</span> {{ detail.pemeriksaan.petugas ?? "-" }} · {{ waktuBdrs(detail.pemeriksaan.waktuPeriksa) }}</div>
            </div>
            <div v-else class="text-grey-400">Belum diperiksa.</div>
          </div>

          <div>
            <h3 class="mb-1 font-semibold">Uji Silang Serasi</h3>
            <NoData v-if="!detail.crossmatch?.length" />
            <DataTable v-else :value="detail.crossmatch" stripedRows class="text-xs">
              <Column field="noKantong" header="No. Kantong" headerClass="bg-opensimrs-50" />
              <Column header="Gol." headerClass="bg-opensimrs-50">
                <template #body="{ data: c }">{{ golonganRh(c.golonganAbo, c.rhesus) }}</template>
              </Column>
              <Column header="Mayor / Minor" headerClass="bg-opensimrs-50">
                <template #body="{ data: c }">{{ HASIL_UJI[c.hasilMayor] }} / {{ HASIL_UJI[c.hasilMinor] }}</template>
              </Column>
              <Column header="Hasil" headerClass="bg-opensimrs-50">
                <template #body="{ data: c }">
                  <span :class="c.kompatibel ? 'text-mint-400' : 'text-danger-300'" class="font-semibold">{{ c.kompatibel ? "Kompatibel" : "Inkompatibel" }}</span>
                  <span v-if="c.statusValidasi === 'perlu_tinjau'" class="ml-1 text-[10px] text-[#B54708]">(perlu ditinjau ulang)</span>
                </template>
              </Column>
              <Column header="Petugas" headerClass="bg-opensimrs-50">
                <template #body="{ data: c }">{{ c.petugas ?? "-" }} · {{ waktuBdrs(c.waktuPeriksa) }}</template>
              </Column>
            </DataTable>
          </div>

          <div v-if="fiturAktif('bdrs_bridging') && kantongUtd.length">
            <h3 class="mb-1 font-semibold">Kantong Bridging UTD</h3>
            <DataTable :value="kantongUtd" stripedRows class="text-xs">
              <Column field="noKantong" header="No. Kantong" headerClass="bg-opensimrs-50" />
              <Column header="Gol." headerClass="bg-opensimrs-50">
                <template #body="{ data: k }">
                  {{ golonganRh(k.golonganAbo, k.rhesus) }}
                  <span v-if="k.peringatanGolongan" class="ml-1 text-[10px] text-[#B54708]">(beda dari permintaan)</span>
                </template>
              </Column>
              <Column header="IMLTD" headerClass="bg-opensimrs-50">
                <template #body="{ data: k }">{{ k.statusImltd }}</template>
              </Column>
              <Column header="Status" headerClass="bg-opensimrs-50">
                <template #body="{ data: k }">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaValidasiKantongUtd(k.statusValidasi)?.bg, gayaValidasiKantongUtd(k.statusValidasi)?.text]">
                    {{ gayaValidasiKantongUtd(k.statusValidasi)?.label ?? k.statusValidasi }}
                  </span>
                  <div v-if="k.alasanTolak" class="mt-0.5 text-[#B42318]">{{ k.alasanTolak }}</div>
                </template>
              </Column>
              <Column header="" headerClass="bg-opensimrs-50">
                <template #body="{ data: k }">
                  <CustomButton
                    v-if="k.statusValidasi === 'menunggu' && izinBdrs('Stok & Penerimaan', 'TERIMA KANTONG')"
                    label="Terima ke Stok"
                    size="small"
                    :disabled="memprosesUtd"
                    @click="terimaKantong(k)"
                  />
                </template>
              </Column>
            </DataTable>
          </div>

          <div v-if="detail.serahTerima?.length">
            <h3 class="mb-1 font-semibold">Serah Terima</h3>
            <DataTable :value="detail.serahTerima" stripedRows class="text-xs">
              <Column header="Waktu" headerClass="bg-opensimrs-50">
                <template #body="{ data: s }">{{ waktuBdrs(s.createdAt) }}</template>
              </Column>
              <Column header="Kantong" headerClass="bg-opensimrs-50">
                <template #body="{ data: s }">{{ (s.items ?? []).map((i: any) => i.noKantong).join(", ") || "-" }}</template>
              </Column>
              <Column header="Penyerah / Penerima" headerClass="bg-opensimrs-50">
                <template #body="{ data: s }">{{ s.petugasPenyerah ?? "-" }} / {{ s.petugasPenerima ?? "-" }}</template>
              </Column>
              <Column header="Status" headerClass="bg-opensimrs-50">
                <template #body="{ data: s }">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaSerahTerimaBdrs(s.status)?.bg, gayaSerahTerimaBdrs(s.status)?.text]">
                    {{ gayaSerahTerimaBdrs(s.status)?.label ?? s.status }}
                  </span>
                </template>
              </Column>
            </DataTable>
          </div>
        </div>
      </template>
      <template #footer>
        <div v-if="detail" class="flex flex-wrap justify-end gap-2">
          <CustomButton v-if="bisaAmbilStatusUtd" label="Ambil Status UTD" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" :disabled="memprosesUtd" @click="ambilStatusUtd" />
          <CustomButton v-if="bisaKirimUtd" label="Kirim ke UTD" icon="PhPaperPlaneTilt" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" :disabled="memprosesUtd" @click="kirimKeUtd" />
          <CustomButton v-if="bisaBatalkan" label="Batalkan" icon="PhXCircle" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="bukaAlasan('batalkan')" />
          <CustomButton v-if="bisaKembalikanTolak" label="Tolak" icon="PhProhibit" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="bukaAlasan('tolak')" />
          <CustomButton v-if="bisaKembalikanTolak" label="Kembalikan" icon="PhArrowUUpLeft" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaAlasan('kembalikan')" />
          <CustomButton v-if="bisaLengkapi" label="Lengkapi & Kirim Ulang" icon="PhPencilSimple" @click="bukaLengkapi" />
          <CustomButton v-if="bisaProses" label="Proses" icon="PhCheckCircle" @click="proses" />
        </div>
      </template>
    </CustomDialog>

    <!-- Alasan kembalikan / tolak / batalkan -->
    <CustomDialog v-model:visible="dialogAlasan" width="460px" :headerBg="aksiAlasan === 'kembalikan' ? 'bg-opensimrs-300' : 'bg-danger-300'">
      <template #header>{{ JUDUL_AKSI[aksiAlasan] }} {{ detail?.noPermintaan }}</template>
      <template #body>
        <div class="flex flex-col gap-2 pt-4">
          <CustomTextArea
            v-model="alasan"
            label="Alasan"
            :placeholder="aksiAlasan === 'kembalikan' ? 'mis. indikasi transfusi belum lengkap' : 'Tuliskan alasan'"
            required
          />
          <div v-if="galatAlasan" class="text-sm text-danger-300">{{ galatAlasan }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Kembali" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogAlasan = false" />
          <CustomButton label="Simpan" :backgroundColor="aksiAlasan === 'kembalikan' ? undefined : 'bg-danger-300'" @click="simpanAlasan" />
        </div>
      </template>
    </CustomDialog>

    <!-- Form permintaan baru / lengkapi -->
    <CustomDialog v-model:visible="dialogForm" width="820px">
      <template #header>{{ modeLengkapi ? `Lengkapi Permintaan ${detail?.noPermintaan}` : "Permintaan Darah Baru" }}</template>
      <template #body>
        <div class="flex flex-col gap-4 pt-4">
          <div v-if="modeLengkapi && detail?.alasanKembali" class="px-3 py-2 text-sm rounded-lg bg-[#FDE2E1] text-[#B42318]">
            Catatan BDRS: {{ detail.alasanKembali }}
          </div>
          <template v-if="!modeLengkapi">
            <div>
              <div class="mb-1 text-sm font-semibold">Pasien (bantu cari kunjungan)</div>
              <div v-if="pasien" class="flex items-center justify-between p-3 rounded-lg bg-opensimrs-50">
                <div class="text-sm">
                  <b>{{ pasien.name }}</b> · {{ pasien.noRm }} · {{ JK_BDRS[pasien.gender] ?? "-" }} · {{ umurBdrs(pasien.birthDate) }}
                </div>
                <CustomButton label="Ganti" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="pasien = null" />
              </div>
              <div v-else class="flex flex-col gap-2">
                <div class="flex gap-2">
                  <InputText v-model="kataPasien" placeholder="Cari nama / No. RM / NIK pasien terdaftar" class="text-sm grow" @keydown.enter="cariPasien" />
                  <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariPasien" />
                </div>
                <div v-if="hasilPasien.length" class="overflow-auto border rounded-lg max-h-[160px] border-grey-75">
                  <div
                    v-for="p in hasilPasien"
                    :key="p.uuid"
                    class="flex justify-between px-3 py-2 text-sm border-b cursor-pointer border-grey-75 hover:bg-opensimrs-50"
                    @click="pilihPasien(p)"
                  >
                    <span><b>{{ p.name }}</b> · {{ p.noRm }}</span>
                    <span class="text-grey-400">{{ JK_BDRS[p.gender] ?? "-" }} · {{ umurBdrs(p.birthDate) }}</span>
                  </div>
                </div>
              </div>
              <div v-if="pasien && riwayatPasien.length" class="mt-2 text-xs text-grey-400">
                Riwayat permintaan darah: {{ riwayatPasien.length }} (terakhir {{ riwayatPasien[0]?.noPermintaan }} ·
                {{ gayaPermintaanBdrs(riwayatPasien[0]?.status)?.label }})
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="flex flex-col gap-1">
                <CustomTextfield v-model="form.noReg" label="No. Registrasi Kunjungan" placeholder="No. Reg kunjungan RJ/RI/IGD aktif" required :maxLength="100" />
                <div v-if="noRegRiwayat.length" class="flex flex-wrap gap-1 text-xs">
                  <span class="text-grey-400">Pakai No. Reg sebelumnya:</span>
                  <button v-for="n in noRegRiwayat" :key="n" type="button" class="px-1.5 rounded bg-opensimrs-50 text-opensimrs-400" @click="form.noReg = n">{{ n }}</button>
                </div>
              </div>
              <CustomSelect
                v-model="form.lokasiAsalUuid"
                label="Ruangan Asal (opsional)"
                placeHolder="Otomatis dari kunjungan"
                :options="lokasi"
                optionValue="uuid"
                optionLabel="name"
              />
            </div>
            <CustomSelect
              v-model="form.dokterPemintaUuid"
              label="Dokter Peminta"
              placeHolder="Pilih dokter peminta"
              :options="dokter"
              optionValue="uuid"
              optionLabel="nama"
              required
            />
          </template>
          <div class="grid grid-cols-3 gap-4">
            <CustomSelect v-model="form.komponenUuid" label="Komponen Darah" placeHolder="Pilih komponen" :options="opsiKomponen" optionValue="value" optionLabel="label" required />
            <CustomSelect v-model="form.golonganDiminta" label="Golongan Diminta" placeHolder="Pilih golongan" :options="opsi(GOLONGAN_ABO)" optionValue="value" optionLabel="label" :showFilter="false" required />
            <CustomSelect v-model="form.rhesusDiminta" label="Rhesus Diminta" placeHolder="Pilih rhesus" :options="opsi(RHESUS)" optionValue="value" optionLabel="label" :showFilter="false" required />
          </div>
          <div class="grid grid-cols-3 gap-4">
            <CustomInputNumber v-model="form.jumlahDiminta" label="Jumlah Kantong" :min="1" :max="20" required />
            <div class="flex items-end gap-2 pb-2">
              <Checkbox v-model="form.cito" binary inputId="bdrs-cito" />
              <label for="bdrs-cito" class="text-sm font-semibold text-danger-300">CITO (segera)</label>
            </div>
          </div>
          <CustomTextArea v-model="form.indikasi" label="Indikasi Transfusi" placeholder="mis. Hb 6,5 g/dL pra-operasi" required />
          <div v-if="galatForm" class="text-sm text-danger-300">{{ galatForm }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogForm = false" />
          <CustomButton :label="modeLengkapi ? 'Simpan & Kirim Ulang' : 'Ajukan Permintaan'" icon="PhPaperPlaneTilt" @click="simpanForm" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
