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
import {
  HASIL_KALIBRASI,
  STATUS_KALIBRASI,
  ambilSertifikat,
  bacaBerkas,
  bukaBerkas,
  catatKalibrasi,
  daftarAset,
  daftarKalibrasi,
  detailKalibrasi,
  epochTanggal,
  gayaStatusKalibrasi,
  isiHasilKalibrasi,
  izinSarpras,
  referensiSarpras,
  tanggalDariEpoch,
  tanggalSarpras,
  ubahJadwalKalibrasi,
  unggahSertifikat,
} from "@/stores/penunjang/sarpras";

// Kalibrasi & uji fungsi alat (KF-14/KF-15, fitur sarpras_kalibrasi): catat hasil (lembaga, sertifikat, masa berlaku)
// atau rencana kalibrasi; status masa berlaku (kedaluwarsa / mendekati jatuh tempo sesuai ambang faskes / berlaku)
// dihitung backend dari catatan terbaru per alat. Hasil tidak lulus tidak mengubah status aset otomatis.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinSarpras("Kalibrasi", aksi);
const bolehBerkas = izinSarpras("Berkas", "READ");

const referensi = ref<any>({ fitur: {}, berkas: { maksMb: 5 } });
const fiturAktif = ref(true);
const data = ref<any[]>([]);
const total = ref(0);
const ambang = ref(30);
const page = ref(1);
const limit = ref(20);
const cari = ref("");
const filterStatus = ref("");
const OPSI_STATUS = ["kedaluwarsa", "jatuh_tempo", "berlaku", "terjadwal", "tanpa_masa_berlaku", "digantikan"].map((value) => ({ value, label: STATUS_KALIBRASI[value].label }));
const OPSI_HASIL = Object.entries(HASIL_KALIBRASI).map(([value, label]) => ({ value, label }));

const muat = async () => {
  if (!fiturAktif.value) return;
  storeUtils.setLoading(true);
  try {
    const res = await daftarKalibrasi({ page: page.value, limit: limit.value, cari: cari.value.trim(), status: filterStatus.value });
    data.value = res?.payload?.data ?? [];
    total.value = res?.payload?.pagination?.total ?? 0;
    ambang.value = res?.payload?.ambangKalibrasiHari ?? ambang.value;
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

// ── Catat kalibrasi (hasil) / rencana
const dialog = ref(false);
const opsiAset = ref<any[]>([]);
const form = ref<any>({});
const galat = ref("");
const kosongHasil = () => ({ tanggalKalibrasi: new Date(), hasil: "lulus", lembagaPenguji: "", nomorSertifikat: "", tanggalBerlaku: null as Date | null, catatanTindakLanjut: "" });
const buka = async () => {
  galat.value = "";
  form.value = { jenis: "hasil", asetUuid: "", tanggalJadwal: null, ...kosongHasil() };
  const res = await daftarAset({ limit: 2000 });
  opsiAset.value = (res?.payload?.data ?? [])
    .filter((a: any) => a.status !== "dihapuskan")
    .map((a: any) => ({ uuid: a.uuid, label: `${a.kodeInventaris} — ${a.nama}${a.wajibKalibrasi ? "" : " (belum wajib kalibrasi)"}` }));
  dialog.value = true;
};
const isianHasil = (f: any) => ({
  tanggalKalibrasi: epochTanggal(f.tanggalKalibrasi),
  hasil: f.hasil,
  lembagaPenguji: f.lembagaPenguji.trim() || undefined,
  nomorSertifikat: f.nomorSertifikat.trim() || undefined,
  tanggalBerlaku: epochTanggal(f.tanggalBerlaku),
  catatanTindakLanjut: f.catatanTindakLanjut.trim() || undefined,
});
const cekHasil = (f: any) => {
  if (!f.tanggalKalibrasi || !f.hasil) return "Tanggal kalibrasi dan hasil wajib diisi";
  if (f.hasil === "perlu_tindak_lanjut" && !f.catatanTindakLanjut.trim()) return "Catatan tindak lanjut wajib diisi";
  return "";
};
const simpan = async () => {
  const f = form.value;
  galat.value = "";
  if (!f.asetUuid) return (galat.value = "Pilih aset");
  if (f.jenis === "rencana" && !f.tanggalJadwal) return (galat.value = "Tanggal jadwal wajib diisi");
  if (f.jenis === "hasil" && (galat.value = cekHasil(f))) return;
  storeUtils.setLoading(true);
  try {
    const res = await catatKalibrasi(f.jenis === "rencana" ? { asetUuid: f.asetUuid, tanggalJadwal: epochTanggal(f.tanggalJadwal), lembagaPenguji: f.lembagaPenguji.trim() || undefined } : { asetUuid: f.asetUuid, ...isianHasil(f) });
    if (res) {
      dialog.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Detail: sertifikat, ubah jadwal rencana, isi hasil rencana
const dialogDetail = ref(false);
const detail = ref<any>(null);
const formJadwal = ref<any>({ tanggalJadwal: null, alasan: "" });
const formHasil = ref<any>(kosongHasil());
const galatDetail = ref("");
const bukaDetail = async (uuid: string) => {
  storeUtils.setLoading(true);
  try {
    const res = await detailKalibrasi(uuid);
    if (res?.payload) {
      detail.value = res.payload;
      formJadwal.value = { tanggalJadwal: tanggalDariEpoch(res.payload.tanggalJadwal), alasan: "" };
      formHasil.value = { ...kosongHasil(), lembagaPenguji: res.payload.lembagaPenguji ?? "" };
      galatDetail.value = "";
      dialogDetail.value = true;
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const segarkan = async () => {
  if (detail.value) await bukaDetail(detail.value.uuid);
  muat();
};
const simpanJadwal = async () => {
  galatDetail.value = "";
  if (!formJadwal.value.tanggalJadwal || !formJadwal.value.alasan.trim()) return (galatDetail.value = "Tanggal jadwal dan alasan wajib diisi");
  if (await ubahJadwalKalibrasi(detail.value.uuid, epochTanggal(formJadwal.value.tanggalJadwal)!, formJadwal.value.alasan.trim())) segarkan();
};
const simpanHasil = async () => {
  galatDetail.value = cekHasil(formHasil.value);
  if (galatDetail.value) return;
  if (await isiHasilKalibrasi(detail.value.uuid, isianHasil(formHasil.value))) segarkan();
};
const unggah = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  input.value = "";
  if (!f || !detail.value) return;
  if (f.size > referensi.value.berkas.maksMb * 1024 * 1024) return (galatDetail.value = `Ukuran berkas maksimal ${referensi.value.berkas.maksMb} MB`);
  storeUtils.setLoading(true);
  try {
    if (await unggahSertifikat(detail.value.uuid, await bacaBerkas(f))) segarkan();
  } finally {
    storeUtils.setLoading(false);
  }
};
const lihat = async (b: any) => bukaBerkas((await ambilSertifikat(detail.value.uuid, b.uuid))?.payload);

onMounted(async () => {
  const r = await referensiSarpras();
  if (r?.payload) {
    referensi.value = r.payload;
    fiturAktif.value = r.payload.fitur?.sarprasKalibrasi !== false;
  }
  muat();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Kalibrasi Alat</h1>
          <template v-if="fiturAktif">
            <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Aset / nomor sertifikat" :maxLength="100" @keydown.enter="cariData" />
            <CustomSelect v-model="filterStatus" label="Status" placeHolder="Semua" :options="OPSI_STATUS" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
            <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
            <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Catat Kalibrasi" @click="buka" />
          </template>
        </PageToolbar>
      </template>
      <template #content>
        <div v-if="!fiturAktif" class="p-6 text-sm text-grey-400">Fitur Kalibrasi & Uji Fungsi Alat belum diaktifkan untuk faskes ini (Setting › Manajemen Modul & Fitur).</div>
        <template v-else>
          <div class="px-1 pb-2 text-xs text-grey-400">Ambang peringatan: {{ ambang }} hari sebelum masa berlaku habis (Pengaturan).</div>
          <NoData v-if="!data.length" />
          <DataTable v-else :value="data" stripedRows class="text-xs cursor-pointer" scrollable scrollHeight="flex" tableStyle="min-width: 62rem" @rowClick="bukaDetail($event.data.uuid)">
            <Column header="Aset" headerClass="bg-opensimrs-50">
              <template #body="{ data: d }">
                <div class="font-semibold">{{ d.namaAset }}</div>
                <div class="text-grey-400">{{ d.kodeInventaris }} · {{ d.namaLokasi || "-" }}</div>
              </template>
            </Column>
            <Column header="Tanggal Kalibrasi / Jadwal" headerClass="bg-opensimrs-50">
              <template #body="{ data: d }">{{ d.tanggalKalibrasi ? tanggalSarpras(d.tanggalKalibrasi) : `Rencana ${tanggalSarpras(d.tanggalJadwal)}` }}</template>
            </Column>
            <Column header="Hasil" headerClass="bg-opensimrs-50">
              <template #body="{ data: d }"><span :class="d.hasil && d.hasil !== 'lulus' ? 'text-danger-300 font-semibold' : ''">{{ HASIL_KALIBRASI[d.hasil] ?? "-" }}</span></template>
            </Column>
            <Column field="lembagaPenguji" header="Lembaga Penguji" headerClass="bg-opensimrs-50" />
            <Column field="nomorSertifikat" header="No. Sertifikat" headerClass="bg-opensimrs-50" />
            <Column header="Berlaku s.d." headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ tanggalSarpras(d.tanggalBerlaku) }}</template></Column>
            <Column header="Status" headerClass="bg-opensimrs-50">
              <template #body="{ data: d }">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaStatusKalibrasi(d.statusKalibrasi).bg, gayaStatusKalibrasi(d.statusKalibrasi).text]">{{ gayaStatusKalibrasi(d.statusKalibrasi).label }}</span>
              </template>
            </Column>
            <Column header="Sertifikat" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.jumlahSertifikat || "-" }}</template></Column>
          </DataTable>
        </template>
      </template>
      <template #footer>
        <div v-if="fiturAktif" class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="680px">
      <template #header>Catat Kalibrasi</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomSelect v-model="form.asetUuid" label="Aset" :options="opsiAset" optionValue="uuid" optionLabel="label" class="col-span-2" required />
          <CustomSelect
            v-model="form.jenis"
            label="Jenis Catatan"
            :options="[{ value: 'hasil', label: 'Hasil kalibrasi (sudah dilaksanakan)' }, { value: 'rencana', label: 'Rencana / jadwal kalibrasi' }]"
            optionValue="value"
            optionLabel="label"
            :showFilter="false"
            :clearable="false"
            class="col-span-2"
          />
          <CustomTextfield v-model="form.lembagaPenguji" label="Lembaga Penguji" :maxLength="255" />
          <template v-if="form.jenis === 'rencana'">
            <CustomDatePicker v-model="form.tanggalJadwal" label="Tanggal Jadwal" required />
          </template>
          <template v-else>
            <CustomDatePicker v-model="form.tanggalKalibrasi" label="Tanggal Kalibrasi" :maxDate="new Date()" required />
            <CustomSelect v-model="form.hasil" label="Hasil" :options="OPSI_HASIL" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" required />
            <CustomTextfield v-model="form.nomorSertifikat" label="Nomor Sertifikat" :maxLength="100" />
            <CustomDatePicker v-model="form.tanggalBerlaku" label="Berlaku Sampai" :minDate="form.tanggalKalibrasi ?? undefined" />
            <CustomTextArea v-model="form.catatanTindakLanjut" :label="form.hasil === 'perlu_tindak_lanjut' ? 'Catatan Tindak Lanjut (wajib)' : 'Catatan Tindak Lanjut'" class="col-span-2" />
          </template>
        </div>
        <div class="mt-2 text-xs text-grey-400">Aset otomatis ditandai wajib kalibrasi. Sertifikat diunggah dari detail catatan setelah disimpan.</div>
        <div v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpan" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogDetail" width="780px">
      <template #header>Kalibrasi — {{ detail?.namaAset }}</template>
      <template #body>
        <div v-if="detail" class="flex flex-col gap-4 pt-4 text-sm">
          <div class="grid grid-cols-2 gap-x-6 gap-y-1">
            <div><span class="text-grey-400">Aset:</span> {{ detail.kodeInventaris }} — {{ detail.namaAset }}</div>
            <div>
              <span class="text-grey-400">Status:</span>
              <span class="px-2 py-0.5 ml-1 rounded-full text-xs font-semibold" :class="[gayaStatusKalibrasi(detail.statusKalibrasi).bg, gayaStatusKalibrasi(detail.statusKalibrasi).text]">{{ gayaStatusKalibrasi(detail.statusKalibrasi).label }}</span>
            </div>
            <div><span class="text-grey-400">Lembaga penguji:</span> {{ detail.lembagaPenguji ?? "-" }}</div>
            <div><span class="text-grey-400">Jadwal:</span> {{ tanggalSarpras(detail.tanggalJadwal) }}</div>
            <div><span class="text-grey-400">Tanggal kalibrasi:</span> {{ tanggalSarpras(detail.tanggalKalibrasi) }}</div>
            <div><span class="text-grey-400">Hasil:</span> {{ HASIL_KALIBRASI[detail.hasil] ?? "-" }}</div>
            <div><span class="text-grey-400">Nomor sertifikat:</span> {{ detail.nomorSertifikat ?? "-" }}</div>
            <div><span class="text-grey-400">Berlaku sampai:</span> {{ tanggalSarpras(detail.tanggalBerlaku) }}</div>
            <div v-if="detail.catatanTindakLanjut" class="col-span-2"><span class="text-grey-400">Tindak lanjut:</span> {{ detail.catatanTindakLanjut }}</div>
          </div>

          <template v-if="!detail.tanggalKalibrasi">
            <div v-if="boleh('UPDATE JADWAL')" class="p-3 border rounded-lg border-grey-100">
              <div class="mb-2 font-semibold">Ubah Jadwal</div>
              <div class="grid grid-cols-3 gap-3">
                <CustomDatePicker v-model="formJadwal.tanggalJadwal" label="Tanggal Jadwal Baru" />
                <CustomTextfield v-model="formJadwal.alasan" label="Alasan" class="col-span-2" :maxLength="500" />
              </div>
              <div class="flex justify-end mt-2"><CustomButton label="Simpan Jadwal" size="small" @click="simpanJadwal" /></div>
            </div>
            <div v-if="boleh('CREATE')" class="p-3 border rounded-lg border-grey-100">
              <div class="mb-2 font-semibold">Catat Hasil</div>
              <div class="grid grid-cols-2 gap-3">
                <CustomDatePicker v-model="formHasil.tanggalKalibrasi" label="Tanggal Kalibrasi" :maxDate="new Date()" />
                <CustomSelect v-model="formHasil.hasil" label="Hasil" :options="OPSI_HASIL" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
                <CustomTextfield v-model="formHasil.lembagaPenguji" label="Lembaga Penguji" :maxLength="255" />
                <CustomTextfield v-model="formHasil.nomorSertifikat" label="Nomor Sertifikat" :maxLength="100" />
                <CustomDatePicker v-model="formHasil.tanggalBerlaku" label="Berlaku Sampai" />
                <CustomTextfield v-model="formHasil.catatanTindakLanjut" label="Catatan Tindak Lanjut" :maxLength="2000" />
              </div>
              <div class="flex justify-end mt-2"><CustomButton label="Simpan Hasil" size="small" @click="simpanHasil" /></div>
            </div>
          </template>

          <div>
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-semibold">Sertifikat</h3>
              <label v-if="boleh('UNGGAH SERTIFIKAT')" class="text-xs cursor-pointer text-opensimrs-300">
                + Unggah (PDF/JPG/PNG ≤ {{ referensi.berkas?.maksMb }} MB)
                <input type="file" class="hidden" accept="application/pdf,image/jpeg,image/png" @change="unggah" />
              </label>
            </div>
            <div v-if="!detail.sertifikat?.length" class="text-grey-400">Belum ada sertifikat</div>
            <div v-for="b in detail.sertifikat" :key="b.uuid" class="flex items-center justify-between py-1 border-b border-grey-100">
              <span>{{ b.namaBerkas }} <span class="text-xs text-grey-400">({{ Math.ceil(b.ukuranBita / 1024) }} KB · {{ b.diunggahOleh }})</span></span>
              <CustomButton v-if="bolehBerkas" label="Lihat" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="lihat(b)" />
            </div>
          </div>
          <div v-if="galatDetail" class="text-sm text-danger-300">{{ galatDetail }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogDetail = false" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
