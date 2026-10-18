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
  FREKUENSI,
  catatPelaksanaan,
  daftarAset,
  daftarJadwalPemeliharaan,
  epochTanggal,
  epochWaktu,
  gayaJatuhTempo,
  izinSarpras,
  nonaktifkanJadwal,
  opsi,
  referensiSarpras,
  riwayatPelaksanaan,
  rupiahSarpras,
  simpanJadwalPemeliharaan,
  tanggalDariEpoch,
  tanggalSarpras,
  waktuSarpras,
} from "@/stores/penunjang/sarpras";

// Pemeliharaan preventif (KF-12/KF-13, fitur sarpras_pemeliharaan): jadwal per aset + checklist, penanda terlambat
// (dihitung per hari WIB di backend), pencatatan pelaksanaan yang menghitung ulang tanggal berikutnya, & riwayat.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinSarpras("Pemeliharaan", aksi);

const referensi = ref<any>({ pegawai: [], fitur: {} });
const fiturAktif = ref(true);
const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");
const filterStatus = ref("aktif");
const filterJatuhTempo = ref("");
const OPSI_JATUH_TEMPO = [
  { value: "terlambat", label: "Terlambat" },
  { value: "7", label: "Jatuh tempo ≤ 7 hari" },
  { value: "30", label: "Jatuh tempo ≤ 30 hari" },
];

const muat = async () => {
  if (!fiturAktif.value) return;
  storeUtils.setLoading(true);
  try {
    const res = await daftarJadwalPemeliharaan({
      page: page.value,
      limit: limit.value,
      cari: cari.value.trim(),
      status: filterStatus.value,
      terlambat: filterJatuhTempo.value === "terlambat" ? "true" : undefined,
      dalamHari: filterJatuhTempo.value && filterJatuhTempo.value !== "terlambat" ? filterJatuhTempo.value : undefined,
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

// ── Jadwal (baru / ubah)
const dialog = ref(false);
const opsiAset = ref<any[]>([]);
const form = ref<any>({});
const galat = ref("");
const buka = async (baris?: any) => {
  galat.value = "";
  form.value = baris
    ? { uuid: baris.uuid, asetUuid: baris.asetUuid, namaAset: `${baris.kodeInventaris} — ${baris.namaAset}`, frekuensi: baris.frekuensi, tanggalBerikutnya: tanggalDariEpoch(baris.tanggalBerikutnya), checklist: (baris.checklist ?? []).join("\n") }
    : { uuid: "", asetUuid: "", frekuensi: "bulanan", tanggalBerikutnya: new Date(), checklist: "" };
  if (!baris) {
    const res = await daftarAset({ limit: 2000 });
    opsiAset.value = (res?.payload?.data ?? []).filter((a: any) => a.status !== "dihapuskan").map((a: any) => ({ uuid: a.uuid, label: `${a.kodeInventaris} — ${a.nama}` }));
  }
  dialog.value = true;
};
const simpan = async () => {
  const f = form.value;
  galat.value = "";
  const checklist = String(f.checklist ?? "")
    .split("\n")
    .map((s: string) => s.trim())
    .filter(Boolean);
  if ((!f.uuid && !f.asetUuid) || !f.frekuensi || !f.tanggalBerikutnya || !checklist.length) return (galat.value = "Aset, frekuensi, tanggal berikutnya, dan minimal satu butir checklist wajib diisi");
  storeUtils.setLoading(true);
  try {
    const isi: Record<string, any> = { frekuensi: f.frekuensi, tanggalBerikutnya: epochTanggal(f.tanggalBerikutnya), checklist };
    if (!f.uuid) isi.asetUuid = f.asetUuid;
    if (await simpanJadwalPemeliharaan(isi, f.uuid || undefined)) {
      dialog.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Nonaktifkan
const dialogNonaktif = ref(false);
const jadwalPilih = ref<any>(null);
const alasanNonaktif = ref("");
const bukaNonaktif = (baris: any) => {
  jadwalPilih.value = baris;
  alasanNonaktif.value = "";
  dialogNonaktif.value = true;
};
const nonaktifkan = async () => {
  if (!alasanNonaktif.value.trim()) return;
  if (await nonaktifkanJadwal(jadwalPilih.value.uuid, alasanNonaktif.value.trim())) {
    dialogNonaktif.value = false;
    muat();
  }
};

// ── Pelaksanaan
const dialogLaksana = ref(false);
const formLaksana = ref<any>({});
const galatLaksana = ref("");
const bukaLaksana = (baris: any) => {
  jadwalPilih.value = baris;
  galatLaksana.value = "";
  formLaksana.value = {
    waktuMulai: new Date(),
    waktuSelesai: null,
    pelaksanaUuid: "",
    hasil: "",
    catatan: "",
    biaya: "",
    checklist: (baris.checklist ?? []).map((butir: string) => ({ butir, ok: false, catatan: "" })),
  };
  dialogLaksana.value = true;
};
const simpanLaksana = async () => {
  const f = formLaksana.value;
  galatLaksana.value = "";
  if (!f.waktuMulai) return (galatLaksana.value = "Waktu mulai wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await catatPelaksanaan(jadwalPilih.value.uuid, {
      waktuMulai: epochWaktu(f.waktuMulai),
      waktuSelesai: epochWaktu(f.waktuSelesai),
      pelaksanaUuid: f.pelaksanaUuid || undefined,
      hasil: f.hasil.trim() || undefined,
      catatan: f.catatan.trim() || undefined,
      biaya: f.biaya === "" ? undefined : f.biaya,
      checklistHasil: f.checklist.map((c: any) => ({ butir: c.butir, ok: c.ok, catatan: c.catatan.trim() || null })),
    });
    if (res) {
      dialogLaksana.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Riwayat pelaksanaan
const dialogRiwayat = ref(false);
const riwayat = ref<any[]>([]);
const bukaRiwayat = async (baris: any) => {
  jadwalPilih.value = baris;
  const res = await riwayatPelaksanaan(baris.uuid, { limit: 100 });
  riwayat.value = res?.payload?.data ?? [];
  dialogRiwayat.value = true;
};
const ringkasChecklist = (c: any[]) => (c?.length ? `${c.filter((x) => x.ok).length}/${c.length} butir baik` : "-");

onMounted(async () => {
  const r = await referensiSarpras();
  if (r?.payload) {
    referensi.value = r.payload;
    fiturAktif.value = r.payload.fitur?.sarprasPemeliharaan !== false;
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
          <h1 class="toolbar-heading text-opensimrs-300">Pemeliharaan Preventif</h1>
          <template v-if="fiturAktif">
            <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Kode / nama aset" :maxLength="100" @keydown.enter="cariData" />
            <CustomSelect v-model="filterStatus" label="Status Jadwal" placeHolder="Semua" :options="[{ value: 'aktif', label: 'Aktif' }, { value: 'nonaktif', label: 'Nonaktif' }]" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
            <CustomSelect v-model="filterJatuhTempo" label="Jatuh Tempo" placeHolder="Semua" :options="OPSI_JATUH_TEMPO" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
            <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
            <CustomButton v-if="boleh('CREATE JADWAL')" icon="PhPlus" label="Jadwal" @click="buka()" />
          </template>
        </PageToolbar>
      </template>
      <template #content>
        <div v-if="!fiturAktif" class="p-6 text-sm text-grey-400">Fitur Pemeliharaan Preventif belum diaktifkan untuk faskes ini (Setting › Manajemen Modul & Fitur).</div>
        <NoData v-else-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 62rem">
          <Column header="Aset" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.namaAset }}</div>
              <div class="text-grey-400">{{ d.kodeInventaris }} · {{ d.namaLokasi || "-" }}</div>
            </template>
          </Column>
          <Column header="Frekuensi" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ FREKUENSI[d.frekuensi] ?? d.frekuensi }}</template></Column>
          <Column header="Checklist" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.checklist?.length ?? 0 }} butir</template></Column>
          <Column header="Jatuh Tempo" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ tanggalSarpras(d.tanggalBerikutnya) }}</template></Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span v-if="d.status !== 'aktif'" class="text-grey-400" :title="d.alasanNonaktif">Nonaktif</span>
              <span v-else class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaJatuhTempo(d.statusJatuhTempo).bg, gayaJatuhTempo(d.statusJatuhTempo).text]">{{ gayaJatuhTempo(d.statusJatuhTempo).label }}</span>
            </template>
          </Column>
          <Column header="Terakhir Dilaksanakan" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ waktuSarpras(d.pelaksanaanTerakhir) }}</template></Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[180px]">
            <template #body="{ data: d }">
              <div class="flex gap-2">
                <CustomButton v-if="d.status === 'aktif' && boleh('CATAT PELAKSANAAN')" icon="PhClipboardText" size="small" title="Catat pelaksanaan" @click="bukaLaksana(d)" />
                <CustomButton icon="PhClockCounterClockwise" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" title="Riwayat" @click="bukaRiwayat(d)" />
                <CustomButton v-if="d.status === 'aktif' && boleh('UPDATE JADWAL')" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" title="Ubah" @click="buka(d)" />
                <CustomButton v-if="d.status === 'aktif' && boleh('NONAKTIFKAN JADWAL')" icon="PhProhibit" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" title="Nonaktifkan" @click="bukaNonaktif(d)" />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
      <template #footer>
        <div v-if="fiturAktif" class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="640px">
      <template #header>{{ form.uuid ? "Ubah" : "Tambah" }} Jadwal Pemeliharaan</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomSelect v-if="!form.uuid" v-model="form.asetUuid" label="Aset" :options="opsiAset" optionValue="uuid" optionLabel="label" class="col-span-2" required />
          <div v-else class="col-span-2 text-sm"><span class="text-grey-400">Aset:</span> {{ form.namaAset }}</div>
          <CustomSelect v-model="form.frekuensi" label="Frekuensi" :options="opsi(FREKUENSI)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" required />
          <CustomDatePicker v-model="form.tanggalBerikutnya" label="Tanggal Pelaksanaan Berikutnya" required />
          <CustomTextArea v-model="form.checklist" label="Checklist (satu butir per baris)" placeholder="Periksa kabel daya&#10;Uji alarm&#10;Bersihkan filter" class="col-span-2" height="h-40" required />
        </div>
        <div v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpan" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogNonaktif" width="480px" headerBg="bg-danger-300">
      <template #header>Nonaktifkan Jadwal</template>
      <template #body>
        <div class="pt-4 text-sm">Jadwal pemeliharaan <b>{{ jadwalPilih?.namaAset }}</b> ({{ FREKUENSI[jadwalPilih?.frekuensi] }}) dinonaktifkan; riwayat pelaksanaan tetap tersimpan.</div>
        <CustomTextArea v-model="alasanNonaktif" label="Alasan" class="mt-3" required />
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogNonaktif = false" />
          <CustomButton label="Nonaktifkan" icon="PhProhibit" backgroundColor="bg-danger-300" :disabled="!alasanNonaktif.trim()" @click="nonaktifkan" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogLaksana" width="760px">
      <template #header>Catat Pelaksanaan — {{ jadwalPilih?.namaAset }}</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4 text-sm">
          <div class="text-grey-400">Jatuh tempo: {{ tanggalSarpras(jadwalPilih?.tanggalBerikutnya) }} ({{ FREKUENSI[jadwalPilih?.frekuensi] }})</div>
          <div class="grid grid-cols-3 gap-3">
            <CustomDatePicker v-model="formLaksana.waktuMulai" label="Waktu Mulai" showTime :maxDate="new Date()" required />
            <CustomDatePicker v-model="formLaksana.waktuSelesai" label="Waktu Selesai" showTime :maxDate="new Date()" />
            <CustomSelect v-model="formLaksana.pelaksanaUuid" label="Pelaksana" :options="referensi.pegawai" optionValue="uuid" optionLabel="nama" />
          </div>
          <div class="p-3 border rounded-lg border-grey-100">
            <div class="mb-2 font-semibold">Checklist</div>
            <div v-for="(c, i) in formLaksana.checklist" :key="i" class="flex items-center gap-3 py-1">
              <Checkbox v-model="c.ok" :binary="true" :inputId="`cek-${i}`" />
              <label :for="`cek-${i}`" class="w-1/2">{{ c.butir }}</label>
              <CustomTextfield v-model="c.catatan" :showLabel="false" placeholder="Catatan / kendala" class="grow" :maxLength="500" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <CustomTextArea v-model="formLaksana.hasil" label="Hasil" />
            <CustomTextArea v-model="formLaksana.catatan" label="Catatan / Kendala" />
            <CustomTextfield v-model="formLaksana.biaya" label="Biaya (Rp, opsional)" type="number" :maxLength="15" />
          </div>
        </div>
        <div v-if="galatLaksana" class="mt-3 text-sm text-danger-300">{{ galatLaksana }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogLaksana = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanLaksana" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogRiwayat" width="860px">
      <template #header>Riwayat Pelaksanaan — {{ jadwalPilih?.namaAset }}</template>
      <template #body>
        <div class="pt-4">
          <NoData v-if="!riwayat.length" />
          <DataTable v-else :value="riwayat" class="text-xs" stripedRows scrollable scrollHeight="420px">
            <Column header="Waktu" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ waktuSarpras(r.waktuMulai) }}</template></Column>
            <Column header="Jatuh Tempo" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ tanggalSarpras(r.jatuhTempo) }}</template></Column>
            <Column header="Ketepatan" headerClass="bg-opensimrs-50">
              <template #body="{ data: r }"><span :class="r.terlambat ? 'text-danger-300' : 'text-mint-400'">{{ r.terlambat ? "Terlambat" : "Tepat waktu" }}</span></template>
            </Column>
            <Column header="Checklist" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ ringkasChecklist(r.checklistHasil) }}</template></Column>
            <Column header="Pelaksana" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ r.namaPelaksana || r.dicatatOleh || "-" }}</template></Column>
            <Column field="hasil" header="Hasil" headerClass="bg-opensimrs-50" />
            <Column header="Biaya" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ r.biaya !== null ? rupiahSarpras(r.biaya) : "-" }}</template></Column>
          </DataTable>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogRiwayat = false" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
