<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  PRIORITAS,
  STATUS_LAPORAN,
  ambilFotoKerusakan,
  bacaBerkas,
  bukaBerkas,
  buatLaporanKerusakan,
  catatSukuCadang,
  daftarAset,
  daftarLaporanKerusakan,
  detailLaporanKerusakan,
  durasiSarpras,
  epochAkhirHari,
  epochAwalHari,
  epochWaktu,
  gayaPrioritas,
  gayaStatusLaporan,
  izinSarpras,
  opsi,
  referensiSarpras,
  rupiahSarpras,
  tugaskanLaporan,
  tutupLaporan,
  ubahStatusLaporan,
  unggahFotoKerusakan,
  waktuSarpras,
} from "@/stores/penunjang/sarpras";

// Laporan kerusakan / work order (KF-8–KF-11): lapor (baru) → tugaskan teknisi (diproses) → dikerjakan (diproses ⇄
// menunggu suku cadang, catat suku cadang, foto) → tutup (selesai / tidak dapat diperbaiki). Urutan status dijaga backend.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinSarpras("Laporan Kerusakan", aksi);
const bolehSuku = (aksi: string) => izinSarpras("Suku Cadang", aksi);
const bolehBerkas = izinSarpras("Berkas", "READ");

const referensi = ref<any>({ lokasi: [], pegawai: [], inventoryAktif: false, berkas: { maksMb: 5 } });
const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");
const filterStatus = ref("terbuka");
const filterPrioritas = ref("");
const tglMulai = ref<Date | null>(null);
const tglSelesai = ref<Date | null>(null);
const OPSI_STATUS = [{ value: "terbuka", label: "Semua Terbuka" }, ...opsi(STATUS_LAPORAN)];

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarLaporanKerusakan({
      page: page.value,
      limit: limit.value,
      cari: cari.value.trim(),
      status: filterStatus.value,
      prioritas: filterPrioritas.value,
      tanggalMulai: epochAwalHari(tglMulai.value),
      tanggalSelesai: epochAkhirHari(tglSelesai.value),
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
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

// ── Buat laporan
const dialogBuat = ref(false);
const opsiAset = ref<any[]>([]);
const formBuat = ref<any>({});
const fotoBaru = ref<File | null>(null);
const galatBuat = ref("");
const bukaBuat = async () => {
  galatBuat.value = "";
  formBuat.value = { asetUuid: "", uraian: "", prioritas: "sedang", lokasiKejadianUuid: "", pelaporNama: "", waktuLaporan: new Date() };
  fotoBaru.value = null;
  const res = await daftarAset({ limit: 2000 });
  opsiAset.value = (res?.payload?.data ?? [])
    .filter((a: any) => a.status !== "dihapuskan")
    .map((a: any) => ({ uuid: a.uuid, label: `${a.kodeInventaris} — ${a.nama}${a.namaLokasi ? ` (${a.namaLokasi})` : ""}` }));
  dialogBuat.value = true;
};
const pilihFoto = (e: Event) => {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null;
  galatBuat.value = "";
  if (f && f.size > referensi.value.berkas.maksMb * 1024 * 1024) {
    galatBuat.value = `Ukuran foto maksimal ${referensi.value.berkas.maksMb} MB`;
    (e.target as HTMLInputElement).value = "";
    return;
  }
  fotoBaru.value = f;
};
const simpanBuat = async () => {
  const f = formBuat.value;
  galatBuat.value = "";
  if (!f.asetUuid || !f.uraian.trim() || !f.prioritas) return (galatBuat.value = "Aset, uraian kerusakan, dan prioritas wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await buatLaporanKerusakan({
      asetUuid: f.asetUuid,
      uraian: f.uraian.trim(),
      prioritas: f.prioritas,
      lokasiKejadianUuid: f.lokasiKejadianUuid || undefined,
      pelaporNama: f.pelaporNama.trim() || undefined,
      waktuLaporan: epochWaktu(f.waktuLaporan),
    });
    if (res?.payload) {
      if (fotoBaru.value) await unggahFotoKerusakan(res.payload.uuid, await bacaBerkas(fotoBaru.value));
      dialogBuat.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Detail & aksi work order
const dialogDetail = ref(false);
const detail = ref<any>(null);
const bukaDetail = async (uuid: string) => {
  storeUtils.setLoading(true);
  try {
    const res = await detailLaporanKerusakan(uuid);
    if (res?.payload) {
      detail.value = res.payload;
      dialogDetail.value = true;
      formTugas.value = { teknisiUuid: res.payload.teknisiUuid ?? "", prioritas: res.payload.prioritas };
      formTutup.value = { status: "selesai", tindakan: res.payload.tindakan ?? "", hasil: "", alasanTidakDapatDiperbaiki: "", biaya: "" };
      catatanStatus.value = "";
      galatAksi.value = "";
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const segarkan = async () => {
  if (detail.value) await bukaDetail(detail.value.uuid);
  muat();
};
const terbuka = computed(() => ["diproses", "menunggu_suku_cadang"].includes(detail.value?.status));
const galatAksi = ref("");

const formTugas = ref<any>({ teknisiUuid: "", prioritas: "sedang" });
const tugaskan = async () => {
  galatAksi.value = "";
  if (!formTugas.value.teknisiUuid) return (galatAksi.value = "Pilih teknisi");
  if (await tugaskanLaporan(detail.value.uuid, formTugas.value.teknisiUuid, formTugas.value.prioritas)) segarkan();
};

const catatanStatus = ref("");
const ubahStatus = async (status: string) => {
  if (await ubahStatusLaporan(detail.value.uuid, status, catatanStatus.value.trim() || undefined)) segarkan();
};

const dialogTutup = ref(false);
const formTutup = ref<any>({});
const galatTutup = ref("");
const tutup = async () => {
  const f = formTutup.value;
  galatTutup.value = "";
  if (!f.tindakan.trim()) return (galatTutup.value = "Tindakan wajib diisi");
  if (f.status === "tidak_dapat_diperbaiki" && !f.alasanTidakDapatDiperbaiki.trim()) return (galatTutup.value = "Alasan tidak dapat diperbaiki wajib diisi");
  const res = await tutupLaporan(detail.value.uuid, {
    status: f.status,
    tindakan: f.tindakan.trim(),
    hasil: f.hasil.trim() || undefined,
    alasanTidakDapatDiperbaiki: f.status === "tidak_dapat_diperbaiki" ? f.alasanTidakDapatDiperbaiki.trim() : undefined,
    biaya: f.biaya === "" ? undefined : f.biaya,
  });
  if (res) {
    dialogTutup.value = false;
    segarkan();
  }
};

const dialogSuku = ref(false);
const formSuku = ref<any>({});
const galatSuku = ref("");
const bukaSuku = () => {
  galatSuku.value = "";
  formSuku.value = { namaBarang: "", jumlah: "1", biaya: "", kurangiStok: false, itemUuid: "", lokasiStokUuid: "", jenisStokUuid: "" };
  dialogSuku.value = true;
};
const simpanSuku = async () => {
  const f = formSuku.value;
  galatSuku.value = "";
  if (!f.namaBarang.trim() || !(Number(f.jumlah) > 0)) return (galatSuku.value = "Nama barang dan jumlah (> 0) wajib diisi");
  if (f.kurangiStok && (!f.itemUuid.trim() || !f.lokasiStokUuid.trim() || !f.jenisStokUuid.trim())) return (galatSuku.value = "Item, lokasi stok, dan jenis stok wajib diisi untuk mengurangi stok");
  const res = await catatSukuCadang(detail.value.uuid, {
    namaBarang: f.namaBarang.trim(),
    jumlah: Number(f.jumlah),
    biaya: f.biaya === "" ? undefined : f.biaya,
    kurangiStok: f.kurangiStok,
    itemUuid: f.itemUuid.trim() || undefined,
    lokasiStokUuid: f.kurangiStok ? f.lokasiStokUuid.trim() : undefined,
    jenisStokUuid: f.kurangiStok ? f.jenisStokUuid.trim() : undefined,
  });
  if (res) {
    dialogSuku.value = false;
    segarkan();
  }
};

const unggahFoto = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  input.value = "";
  if (!f || !detail.value) return;
  if (f.size > referensi.value.berkas.maksMb * 1024 * 1024) return (galatAksi.value = `Ukuran berkas maksimal ${referensi.value.berkas.maksMb} MB`);
  storeUtils.setLoading(true);
  try {
    if (await unggahFotoKerusakan(detail.value.uuid, await bacaBerkas(f))) segarkan();
  } finally {
    storeUtils.setLoading(false);
  }
};
const lihatFoto = async (b: any) => bukaBerkas((await ambilFotoKerusakan(detail.value.uuid, b.uuid))?.payload);

onMounted(async () => {
  const r = await referensiSarpras();
  if (r?.payload) referensi.value = r.payload;
  muat();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Laporan Kerusakan</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nomor / aset / uraian" :maxLength="100" @keydown.enter="cariData" />
          <CustomSelect v-model="filterStatus" label="Status" placeHolder="Semua" :options="OPSI_STATUS" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomSelect v-model="filterPrioritas" label="Prioritas" placeHolder="Semua" :options="opsi(PRIORITAS)" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomDatePicker v-model="tglMulai" label="Dari Tanggal" class="toolbar-field--date" />
          <CustomDatePicker v-model="tglSelesai" label="Sampai Tanggal" class="toolbar-field--date" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Lapor Kerusakan" @click="bukaBuat" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs cursor-pointer" scrollable scrollHeight="flex" tableStyle="min-width: 64rem" @rowClick="bukaDetail($event.data.uuid)">
          <Column field="nomorLaporan" header="Nomor" headerClass="bg-opensimrs-50" />
          <Column header="Aset" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.namaAset }}</div>
              <div class="text-grey-400">{{ d.kodeInventaris }} · {{ d.namaLokasiKejadian || d.namaLokasiAset || "-" }}</div>
            </template>
          </Column>
          <Column field="uraian" header="Uraian" headerClass="bg-opensimrs-50" class="max-w-[260px] truncate" />
          <Column header="Prioritas" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaPrioritas(d.prioritas).bg, gayaPrioritas(d.prioritas).text]">{{ gayaPrioritas(d.prioritas).label }}</span>
            </template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaStatusLaporan(d.status).bg, gayaStatusLaporan(d.status).text]">{{ gayaStatusLaporan(d.status).label }}</span>
            </template>
          </Column>
          <Column header="Dilaporkan" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ waktuSarpras(d.waktuLaporan) }}</template></Column>
          <Column header="Teknisi" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.namaTeknisi || "-" }}</template></Column>
          <Column header="Respons" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ durasiSarpras(d.waktuRespons) }}</template></Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialogBuat" width="680px">
      <template #header>Lapor Kerusakan</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomSelect v-model="formBuat.asetUuid" label="Aset" :options="opsiAset" optionValue="uuid" optionLabel="label" class="col-span-2" required />
          <CustomTextArea v-model="formBuat.uraian" label="Uraian Kerusakan" placeholder="mis. layar mati, alarm tidak berbunyi" class="col-span-2" required />
          <CustomSelect v-model="formBuat.prioritas" label="Prioritas" :options="opsi(PRIORITAS)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" required />
          <CustomDatePicker v-model="formBuat.waktuLaporan" label="Waktu Laporan" showTime :maxDate="new Date()" />
          <CustomSelect v-model="formBuat.lokasiKejadianUuid" label="Lokasi Kejadian (bila berbeda)" :options="referensi.lokasi" optionValue="uuid" optionLabel="nama" />
          <CustomTextfield v-model="formBuat.pelaporNama" label="Nama Pelapor (opsional)" :maxLength="255" />
          <div class="col-span-2 text-sm">
            <div class="mb-1 text-grey-400">Foto kerusakan (opsional, JPG/PNG/PDF ≤ {{ referensi.berkas?.maksMb }} MB)</div>
            <input type="file" accept="image/jpeg,image/png,application/pdf" @change="pilihFoto" />
          </div>
        </div>
        <div v-if="galatBuat" class="mt-3 text-sm text-danger-300">{{ galatBuat }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogBuat = false" />
          <CustomButton label="Kirim Laporan" icon="PhPaperPlaneTilt" @click="simpanBuat" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogDetail" width="900px">
      <template #header>{{ detail?.nomorLaporan }} — {{ detail?.namaAset }}</template>
      <template #body>
        <div v-if="detail" class="flex flex-col gap-4 pt-4 text-sm">
          <div class="grid grid-cols-2 gap-x-6 gap-y-1">
            <div><span class="text-grey-400">Aset:</span> {{ detail.kodeInventaris }} — {{ detail.namaAset }}</div>
            <div>
              <span class="text-grey-400">Status:</span>
              <span class="px-2 py-0.5 ml-1 rounded-full text-xs font-semibold" :class="[gayaStatusLaporan(detail.status).bg, gayaStatusLaporan(detail.status).text]">{{ gayaStatusLaporan(detail.status).label }}</span>
              <span class="px-2 py-0.5 ml-1 rounded-full text-xs font-semibold" :class="[gayaPrioritas(detail.prioritas).bg, gayaPrioritas(detail.prioritas).text]">{{ gayaPrioritas(detail.prioritas).label }}</span>
            </div>
            <div><span class="text-grey-400">Lokasi:</span> {{ detail.namaLokasiKejadian || detail.namaLokasiAset || "-" }}</div>
            <div><span class="text-grey-400">Pelapor:</span> {{ detail.pelaporNama || detail.pelapor || "-" }} · {{ waktuSarpras(detail.waktuLaporan) }}</div>
            <div><span class="text-grey-400">Teknisi:</span> {{ detail.namaTeknisi || "-" }}</div>
            <div><span class="text-grey-400">Waktu respons / penyelesaian:</span> {{ durasiSarpras(detail.waktuRespons) }} / {{ durasiSarpras(detail.waktuPenyelesaian) }}</div>
            <div class="col-span-2"><span class="text-grey-400">Uraian:</span> {{ detail.uraian }}</div>
            <template v-if="detail.waktuSelesai">
              <div class="col-span-2"><span class="text-grey-400">Tindakan:</span> {{ detail.tindakan }}</div>
              <div v-if="detail.hasil" class="col-span-2"><span class="text-grey-400">Hasil:</span> {{ detail.hasil }}</div>
              <div v-if="detail.alasanTidakDapatDiperbaiki" class="col-span-2"><span class="text-grey-400">Alasan tidak dapat diperbaiki:</span> {{ detail.alasanTidakDapatDiperbaiki }}</div>
              <div><span class="text-grey-400">Biaya perbaikan:</span> {{ detail.biaya !== null ? rupiahSarpras(detail.biaya) : "-" }}</div>
              <div><span class="text-grey-400">Ditutup oleh:</span> {{ detail.ditutupOleh ?? "-" }} · {{ waktuSarpras(detail.waktuSelesai) }}</div>
            </template>
          </div>

          <div v-if="detail.status === 'baru' && boleh('TUGASKAN')" class="p-3 border rounded-lg border-grey-100">
            <div class="mb-2 font-semibold">Tugaskan Teknisi</div>
            <div class="grid grid-cols-3 gap-3">
              <CustomSelect v-model="formTugas.teknisiUuid" label="Teknisi" :options="referensi.pegawai" optionValue="uuid" optionLabel="nama" class="col-span-2" />
              <CustomSelect v-model="formTugas.prioritas" label="Prioritas" :options="opsi(PRIORITAS)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
            </div>
            <div class="flex justify-end mt-2"><CustomButton label="Tugaskan" size="small" icon="PhUserCheck" @click="tugaskan" /></div>
          </div>

          <div v-if="terbuka && (boleh('UPDATE STATUS') || boleh('TUTUP'))" class="p-3 border rounded-lg border-grey-100">
            <div class="mb-2 font-semibold">Pengerjaan</div>
            <div class="flex flex-wrap items-end gap-2">
              <CustomTextfield v-if="boleh('UPDATE STATUS')" v-model="catatanStatus" label="Catatan perubahan status (opsional)" class="grow" :maxLength="500" />
              <CustomButton v-if="boleh('UPDATE STATUS') && detail.status === 'diproses'" label="Menunggu Suku Cadang" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="ubahStatus('menunggu_suku_cadang')" />
              <CustomButton v-if="boleh('UPDATE STATUS') && detail.status === 'menunggu_suku_cadang'" label="Lanjutkan Pengerjaan" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="ubahStatus('diproses')" />
              <CustomButton v-if="boleh('TUTUP')" label="Tutup Laporan" size="small" icon="PhCheckCircle" @click="dialogTutup = true" />
            </div>
          </div>
          <div v-if="galatAksi" class="text-sm text-danger-300">{{ galatAksi }}</div>

          <div v-if="detail.sukuCadang !== null">
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-semibold">Suku Cadang</h3>
              <CustomButton v-if="terbuka && bolehSuku('CATAT PEMAKAIAN')" icon="PhPlus" label="Catat Suku Cadang" size="small" @click="bukaSuku" />
            </div>
            <NoData v-if="!detail.sukuCadang?.length" />
            <DataTable v-else :value="detail.sukuCadang" class="text-xs" stripedRows>
              <Column field="namaBarang" header="Barang" headerClass="bg-opensimrs-50" />
              <Column header="Jumlah" headerClass="bg-opensimrs-50"><template #body="{ data: s }">{{ Number(s.jumlah) }}</template></Column>
              <Column header="Biaya" headerClass="bg-opensimrs-50"><template #body="{ data: s }">{{ s.biaya !== null ? rupiahSarpras(s.biaya) : "-" }}</template></Column>
              <Column header="Stok Gudang" headerClass="bg-opensimrs-50"><template #body="{ data: s }">{{ s.referensiTransaksiInventory ? "Dikurangi" : "Manual" }}</template></Column>
              <Column field="dicatatOleh" header="Dicatat Oleh" headerClass="bg-opensimrs-50" />
            </DataTable>
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-semibold">Foto / Berkas</h3>
              <label v-if="boleh('CREATE') || boleh('UPDATE STATUS')" class="text-xs cursor-pointer text-opensimrs-300">
                + Unggah (JPG/PNG/PDF ≤ {{ referensi.berkas?.maksMb }} MB)
                <input type="file" class="hidden" accept="image/jpeg,image/png,application/pdf" @change="unggahFoto" />
              </label>
            </div>
            <div v-if="!detail.berkas?.length" class="text-grey-400">Belum ada berkas</div>
            <div v-for="b in detail.berkas" :key="b.uuid" class="flex items-center justify-between py-1 border-b border-grey-100">
              <span>{{ b.namaBerkas }} <span class="text-xs text-grey-400">({{ Math.ceil(b.ukuranBita / 1024) }} KB · {{ b.diunggahOleh }})</span></span>
              <CustomButton v-if="bolehBerkas" label="Lihat" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="lihatFoto(b)" />
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogDetail = false" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogTutup" width="600px">
      <template #header>Tutup Laporan {{ detail?.nomorLaporan }}</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <CustomSelect
            v-model="formTutup.status"
            label="Hasil Akhir"
            :options="[{ value: 'selesai', label: 'Selesai (berhasil diperbaiki)' }, { value: 'tidak_dapat_diperbaiki', label: 'Tidak Dapat Diperbaiki' }]"
            optionValue="value"
            optionLabel="label"
            :showFilter="false"
            :clearable="false"
          />
          <CustomTextArea v-model="formTutup.tindakan" label="Tindakan" placeholder="Pemeriksaan & tindakan yang dilakukan" required />
          <CustomTextArea v-model="formTutup.hasil" label="Hasil (opsional)" />
          <CustomTextArea v-if="formTutup.status === 'tidak_dapat_diperbaiki'" v-model="formTutup.alasanTidakDapatDiperbaiki" label="Alasan Tidak Dapat Diperbaiki" required />
          <CustomTextfield v-model="formTutup.biaya" label="Biaya Perbaikan (Rp, opsional)" type="number" :maxLength="15" />
        </div>
        <div v-if="galatTutup" class="mt-3 text-sm text-danger-300">{{ galatTutup }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogTutup = false" />
          <CustomButton label="Tutup Laporan" icon="PhCheckCircle" @click="tutup" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogSuku" width="600px">
      <template #header>Catat Suku Cadang</template>
      <template #body>
        <div class="grid grid-cols-2 gap-3 pt-4">
          <CustomTextfield v-model="formSuku.namaBarang" label="Nama Barang" class="col-span-2" required :maxLength="255" />
          <CustomTextfield v-model="formSuku.jumlah" label="Jumlah" type="number" required :maxLength="10" />
          <CustomTextfield v-model="formSuku.biaya" label="Biaya (Rp, opsional)" type="number" :maxLength="15" />
          <div class="col-span-2">
            <CustomSwitch
              v-model="formSuku.kurangiStok"
              label="Kurangi stok Gudang & Pengadaan"
              sideLabel="Tidak (catat manual)"
              sideLabelTrue="Ya"
              :disabled="!referensi.inventoryAktif"
            />
            <div v-if="!referensi.inventoryAktif" class="mt-1 text-xs text-grey-400">Modul Gudang & Pengadaan tidak aktif — suku cadang dicatat manual tanpa transaksi stok.</div>
          </div>
          <template v-if="formSuku.kurangiStok">
            <CustomTextfield v-model="formSuku.itemUuid" label="UUID Item Gudang" class="col-span-2" :maxLength="255" />
            <CustomTextfield v-model="formSuku.lokasiStokUuid" label="UUID Lokasi Stok" :maxLength="255" />
            <CustomTextfield v-model="formSuku.jenisStokUuid" label="UUID Jenis Stok" :maxLength="255" />
            <div class="col-span-2 text-xs text-grey-400">Bila pengurangan stok gagal, suku cadang tidak tersimpan.</div>
          </template>
        </div>
        <div v-if="galatSuku" class="mt-3 text-sm text-danger-300">{{ galatSuku }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogSuku = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanSuku" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
