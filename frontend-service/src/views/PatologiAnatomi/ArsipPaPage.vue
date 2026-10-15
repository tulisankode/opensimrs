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
import { utilsStore } from "@/stores/utils";
import {
  KEPERLUAN_PINJAM_PA,
  STATUS_ARSIP_PA,
  daftarArsipPa,
  hapusArsipPa,
  kembaliArsipPa,
  keTanggalPa,
  lokasiArsipPa,
  pinjamArsipPa,
  riwayatArsipPa,
  tambahArsipPa,
  ubahArsipPa,
  waktuPa,
  izinPa,
} from "@/stores/penunjang/patologi";
import { createLabelArsipPaPdf } from "@/utils/pdf/pdfPatologi/cetakPatologi";

// Arsip blok parafin & slide PA: lokasi rak (satuan atau massal), status ada / dipinjam / dikembalikan, peminjaman
// untuk konsultasi / second opinion / IHK luar beserta riwayat, tambah blok/slide manual (potong ulang, slide IHK),
// dan cetak label kaset/slide.
const storeUtils = utilsStore();
// Hak akses (Patologi Anatomi › Arsip Blok & Slide): UPDATE = tambah/ubah/hapus/lokasi rak; PINJAM = pinjam & kembali.
const boleh = (aksi: string) => izinPa("Arsip Blok & Slide", aksi);

const data = ref<any[]>([]);
const ringkasan = ref<any>({});
const total = ref(0);
const page = ref(1);
const limit = ref(50);
const cari = ref("");
const filterJenis = ref<string[]>([]);
const filterStatus = ref<string[]>([]);
const hanyaTerlambat = ref(false);
const dipilih = ref<any[]>([]);

const toggle = (daftar: typeof filterJenis, nilai: string) => {
  daftar.value = daftar.value.includes(nilai) ? daftar.value.filter((x) => x !== nilai) : [...daftar.value, nilai];
};
const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarArsipPa({
      page: page.value,
      limit: limit.value,
      cari: cari.value,
      jenis: filterJenis.value,
      status: filterStatus.value,
      terlambat: hanyaTerlambat.value ? 1 : "",
    });
    data.value = res?.payload?.data ?? [];
    ringkasan.value = res?.payload?.ringkasan ?? {};
    total.value = res?.payload?.pagination?.total ?? 0;
    dipilih.value = [];
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
const kartu = computed(() => [
  { label: "Blok parafin", nilai: ringkasan.value.blok ?? 0 },
  { label: "Slide", nilai: ringkasan.value.slide ?? 0 },
  { label: "Sedang dipinjam", nilai: ringkasan.value.dipinjam ?? 0 },
  { label: "Lewat rencana kembali", nilai: ringkasan.value.terlambat ?? 0, bahaya: true },
  { label: "Belum ada lokasi rak", nilai: ringkasan.value.tanpaRak ?? 0 },
]);

// ── Lokasi rak massal
const dialogLokasi = ref(false);
const lokasiMassal = ref("");
const simpanLokasi = async () => {
  storeUtils.setLoading(true);
  try {
    if (await lokasiArsipPa(dipilih.value.map((d) => d.uuid), lokasiMassal.value)) {
      dialogLokasi.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Ubah satu
const dialogUbah = ref(false);
const formUbah = ref<any>({});
const bukaUbah = (d: any) => {
  formUbah.value = { uuid: d.uuid, kode: d.kode, lokasiRak: d.lokasiRak ?? "", pewarnaan: d.pewarnaan ?? "", keterangan: d.keterangan ?? "" };
  dialogUbah.value = true;
};
const simpanUbah = async () => {
  const f = formUbah.value;
  if (await ubahArsipPa(f.uuid, { lokasiRak: f.lokasiRak, pewarnaan: f.pewarnaan, keterangan: f.keterangan })) {
    dialogUbah.value = false;
    muat();
  }
};
const hapus = async () => {
  if (await hapusArsipPa(formUbah.value.uuid)) {
    dialogUbah.value = false;
    muat();
  }
};

// ── Tambah manual
const dialogTambah = ref(false);
const formTambah = ref({ noPa: "", jenis: "slide", kode: "", pewarnaan: "", keterangan: "", lokasiRak: "" });
const galatTambah = ref("");
const bukaTambah = () => {
  formTambah.value = { noPa: "", jenis: "slide", kode: "", pewarnaan: "", keterangan: "", lokasiRak: "" };
  galatTambah.value = "";
  dialogTambah.value = true;
};
const simpanTambah = async () => {
  if (!formTambah.value.noPa.trim()) return (galatTambah.value = "Nomor PA wajib diisi");
  if (await tambahArsipPa({ ...formTambah.value, noPa: formTambah.value.noPa.trim() })) {
    dialogTambah.value = false;
    muat();
  }
};

// ── Pinjam / kembali / riwayat
const aktif = ref<any>(null);
const dialogPinjam = ref(false);
const formPinjam = ref({ peminjam: "", instansi: "", keperluan: "second_opinion", rencanaKembali: null as Date | null, catatan: "" });
const galatPinjam = ref("");
const bukaPinjam = (d: any) => {
  aktif.value = d;
  formPinjam.value = { peminjam: "", instansi: "", keperluan: "second_opinion", rencanaKembali: null, catatan: "" };
  galatPinjam.value = "";
  dialogPinjam.value = true;
};
const simpanPinjam = async () => {
  const f = formPinjam.value;
  if (!f.peminjam.trim()) return (galatPinjam.value = "Nama peminjam wajib diisi");
  if (await pinjamArsipPa(aktif.value.uuid, { ...f, rencanaKembali: keTanggalPa(f.rencanaKembali) || null })) {
    dialogPinjam.value = false;
    muat();
  }
};
const dialogKembali = ref(false);
const formKembali = ref({ kondisiKembali: "", lokasiRak: "" });
const bukaKembali = (d: any) => {
  aktif.value = d;
  formKembali.value = { kondisiKembali: "Utuh, sesuai saat dipinjam", lokasiRak: d.lokasiRak ?? "" };
  dialogKembali.value = true;
};
const simpanKembali = async () => {
  if (await kembaliArsipPa(aktif.value.uuid, formKembali.value)) {
    dialogKembali.value = false;
    muat();
  }
};
const dialogRiwayat = ref(false);
const riwayat = ref<any>(null);
const bukaRiwayat = async (d: any) => {
  const res = await riwayatArsipPa(d.uuid);
  if (res?.payload) {
    riwayat.value = res.payload;
    dialogRiwayat.value = true;
  }
};

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden flex flex-col" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Arsip Blok &amp; Slide</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Kode / No. PA / pasien / rak / peminjam" :maxLength="100" @keydown.enter="cariData" />
          <ToolbarFilterMenu :count="filterJenis.length + filterStatus.length + (hanyaTerlambat ? 1 : 0)">
            <template #label>Filter</template>
            <CustomChip label="Blok parafin" value="blok" :isSelected="filterJenis.includes('blok')" @selected="toggle(filterJenis, $event)" />
            <CustomChip label="Slide" value="slide" :isSelected="filterJenis.includes('slide')" @selected="toggle(filterJenis, $event)" />
            <CustomChip v-for="(s, kode) in STATUS_ARSIP_PA" :key="kode" :label="s.label" :value="String(kode)" :isSelected="filterStatus.includes(String(kode))" @selected="toggle(filterStatus, $event)" />
            <CustomChip label="Lewat rencana kembali" :isSelected="hanyaTerlambat" @selected="hanyaTerlambat = !hanyaTerlambat" />
          </ToolbarFilterMenu>
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton v-if="boleh('UPDATE')" icon="PhMapPin" :label="`Lokasi Rak (${dipilih.length})`" :disabled="!dipilih.length" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="(lokasiMassal = ''), (dialogLokasi = true)" />
          <CustomButton icon="PhTag" :label="`Label (${dipilih.length})`" :disabled="!dipilih.length" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="createLabelArsipPaPdf(dipilih)" />
          <CustomButton v-if="boleh('UPDATE')" icon="PhPlus" label="Blok/Slide" @click="bukaTambah" />
        </PageToolbar>
      </template>
      <template #content>
        <div class="grid grid-cols-5 gap-3 px-4 pt-3 shrink-0">
          <div v-for="k in kartu" :key="k.label" class="p-2 border rounded-lg border-grey-75">
            <div class="text-xs text-grey-400">{{ k.label }}</div>
            <div class="text-lg font-semibold" :class="k.bahaya && k.nilai ? 'text-danger-300' : 'text-opensimrs-400'">{{ k.nilai }}</div>
          </div>
        </div>
        <NoData v-if="!data.length" />
        <DataTable v-else v-model:selection="dipilih" :value="data" dataKey="uuid" stripedRows class="mt-2 text-xs grow" scrollable scrollHeight="flex" tableStyle="min-width: 60rem">
          <Column selectionMode="multiple" headerClass="bg-opensimrs-50" class="w-[40px]" />
          <Column header="Kode" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.kode }}</div>
              <div class="text-grey-400">{{ d.jenis === "blok" ? "Blok parafin" : `Slide${d.pewarnaan ? ` · ${d.pewarnaan}` : ""}` }}</div>
            </template>
          </Column>
          <Column header="Kasus / Pasien" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div><b>{{ d.noPa }}</b> · {{ d.namaPasien ?? "-" }}</div>
              <div class="max-w-[280px] truncate text-grey-400" :title="d.diagnosis">{{ d.noRm }} · {{ d.diagnosis ?? d.pemeriksaan }}</div>
            </template>
          </Column>
          <Column header="Lokasi Rak" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span :class="d.lokasiRak ? '' : 'text-grey-300'">{{ d.lokasiRak ?? "Belum diatur" }}</span>
              <div v-if="d.keterangan" class="text-grey-400">{{ d.keterangan }}</div>
            </template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap" :class="[STATUS_ARSIP_PA[d.status]?.bg, STATUS_ARSIP_PA[d.status]?.text]">{{ STATUS_ARSIP_PA[d.status]?.label }}</span>
              <div v-if="d.status === 'dipinjam'" class="mt-0.5">
                {{ d.peminjam }}<span v-if="d.instansi" class="text-grey-400"> · {{ d.instansi }}</span>
                <div :class="d.terlambat ? 'text-danger-300 font-semibold' : 'text-grey-400'">
                  {{ KEPERLUAN_PINJAM_PA[d.keperluan] ?? "" }} · sejak {{ waktuPa(d.waktuPinjam, true) }}{{ d.rencanaKembali ? ` · kembali ${d.rencanaKembali}` : "" }}
                </div>
              </div>
            </template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[250px]">
            <template #body="{ data: d }">
              <div class="flex flex-wrap gap-2">
                <CustomButton v-if="d.status !== 'dipinjam' && boleh('PINJAM')" label="Pinjam" icon="PhArrowSquareOut" size="small" @click="bukaPinjam(d)" />
                <CustomButton v-else-if="d.status === 'dipinjam' && boleh('PINJAM')" label="Kembali" icon="PhArrowSquareIn" size="small" @click="bukaKembali(d)" />
                <CustomButton v-if="boleh('UPDATE')" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaUbah(d)" />
                <CustomButton icon="PhClockCounterClockwise" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaRiwayat(d)" />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[50, 100, 200]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialogLokasi" width="420px">
      <template #header>Atur Lokasi Rak ({{ dipilih.length }} blok/slide)</template>
      <template #body>
        <div class="pt-4"><CustomTextfield v-model="lokasiMassal" label="Lokasi rak" placeholder="mis. Lemari B · Rak 03 · Laci 2" :maxLength="100" /></div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogLokasi = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanLokasi" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogUbah" width="480px">
      <template #header>Ubah {{ formUbah.kode }}</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <CustomTextfield v-model="formUbah.lokasiRak" label="Lokasi rak" placeholder="mis. Lemari B · Rak 03" :maxLength="100" />
          <CustomTextfield v-model="formUbah.pewarnaan" label="Pewarnaan (slide)" placeholder="mis. HE / PAS / IHK ER" :maxLength="50" />
          <CustomTextArea v-model="formUbah.keterangan" label="Keterangan" placeholder="mis. potong ulang, blok habis" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-between w-full gap-2">
          <CustomButton label="Hapus" icon="PhTrash" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="hapus" />
          <div class="flex gap-2">
            <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogUbah = false" />
            <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanUbah" />
          </div>
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogTambah" width="520px">
      <template #header>Tambah Blok / Slide</template>
      <template #body>
        <div class="grid grid-cols-2 gap-3 pt-4">
          <CustomTextfield v-model="formTambah.noPa" label="Nomor PA" placeholder="mis. PA-26-00001" :maxLength="30" required />
          <CustomSelect v-model="formTambah.jenis" label="Jenis" :options="[{ value: 'blok', label: 'Blok parafin' }, { value: 'slide', label: 'Slide' }]" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
          <CustomTextfield v-model="formTambah.kode" label="Kode (opsional)" placeholder="Kosong = otomatis" :maxLength="60" />
          <CustomTextfield v-model="formTambah.pewarnaan" label="Pewarnaan" placeholder="mis. IHK ER / PAS" :maxLength="50" />
          <CustomTextfield v-model="formTambah.lokasiRak" label="Lokasi rak" :maxLength="100" class="col-span-2" />
          <CustomTextArea v-model="formTambah.keterangan" label="Keterangan" placeholder="mis. potong ulang untuk IHK" class="col-span-2" />
        </div>
        <div v-if="galatTambah" class="mt-2 text-sm text-danger-300">{{ galatTambah }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogTambah = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanTambah" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogPinjam" width="520px">
      <template #header>Pinjam {{ aktif?.kode }}</template>
      <template #body>
        <div class="grid grid-cols-2 gap-3 pt-4">
          <CustomTextfield v-model="formPinjam.peminjam" label="Peminjam" placeholder="Nama dokter / petugas" :maxLength="200" required class="col-span-2" />
          <CustomTextfield v-model="formPinjam.instansi" label="Instansi tujuan" placeholder="mis. RSUD rujukan / lab IHK" :maxLength="200" class="col-span-2" />
          <CustomSelect v-model="formPinjam.keperluan" label="Keperluan" :options="Object.entries(KEPERLUAN_PINJAM_PA).map(([value, label]) => ({ value, label }))" optionValue="value" optionLabel="label" :showFilter="false" />
          <CustomDatePicker v-model="formPinjam.rencanaKembali" label="Rencana kembali" :minDate="new Date()" />
          <CustomTextArea v-model="formPinjam.catatan" label="Catatan" placeholder="mis. nomor surat permintaan" class="col-span-2" />
        </div>
        <div v-if="galatPinjam" class="mt-2 text-sm text-danger-300">{{ galatPinjam }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogPinjam = false" />
          <CustomButton label="Catat Peminjaman" icon="PhArrowSquareOut" @click="simpanPinjam" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogKembali" width="460px">
      <template #header>Pengembalian {{ aktif?.kode }}</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <div class="text-sm">Dipinjam oleh <b>{{ aktif?.peminjam }}</b> sejak {{ waktuPa(aktif?.waktuPinjam) }}</div>
          <CustomTextArea v-model="formKembali.kondisiKembali" label="Kondisi saat kembali" />
          <CustomTextfield v-model="formKembali.lokasiRak" label="Lokasi rak" :maxLength="100" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogKembali = false" />
          <CustomButton label="Terima Kembali" icon="PhArrowSquareIn" @click="simpanKembali" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogRiwayat" width="720px">
      <template #header>Riwayat Peminjaman {{ riwayat?.kode }}</template>
      <template #body>
        <div class="pt-4">
          <div v-if="!riwayat?.riwayat?.length" class="text-sm text-grey-400">Belum pernah dipinjam.</div>
          <DataTable v-else :value="riwayat.riwayat" class="text-xs" stripedRows>
            <Column header="Peminjam" headerClass="bg-opensimrs-50">
              <template #body="{ data: r }">
                <div class="font-semibold">{{ r.peminjam }}</div>
                <div class="text-grey-400">{{ r.instansi ?? "-" }} · {{ KEPERLUAN_PINJAM_PA[r.keperluan] ?? "-" }}</div>
              </template>
            </Column>
            <Column header="Dipinjam" headerClass="bg-opensimrs-50">
              <template #body="{ data: r }">{{ waktuPa(r.waktuPinjam) }}<div class="text-grey-400">{{ r.petugasPinjam }}</div></template>
            </Column>
            <Column header="Rencana" headerClass="bg-opensimrs-50">
              <template #body="{ data: r }">{{ r.rencanaKembali ?? "-" }}</template>
            </Column>
            <Column header="Kembali" headerClass="bg-opensimrs-50">
              <template #body="{ data: r }">
                <span v-if="r.waktuKembali">{{ waktuPa(r.waktuKembali) }}<div class="text-grey-400">{{ r.kondisiKembali ?? "" }}</div></span>
                <span v-else class="font-semibold text-warning-300">Belum kembali</span>
              </template>
            </Column>
          </DataTable>
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
