<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  KELOMPOK_MIKRO,
  daftarMasterMikro,
  hapusMasterMikro,
  izinMikro,
  panelKelompokMikro,
  ringkasanPanelMikro,
  simpanMasterMikro,
  simpanPanelMikro,
} from "@/stores/penunjang/mikrobiologi";

// Datamaster antibiotik (kode WHONET, golongan, potensi disk, breakpoint umum opsional) dan panel antibiotik standar per
// kelompok organisme (urutan tampil + breakpoint khusus kelompok). Panel dipakai otomatis saat uji kepekaan isolat;
// breakpoint dipakai untuk interpretasi S/I/R otomatis bila petugas hanya mengisi zona/MIC.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinMikro("Datamaster", aksi, "Antibiotik");
const tab = ref("antibiotik");

// ── Daftar antibiotik
const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(50);
const cari = ref("");
const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarMasterMikro("antibiotik", { page: page.value, limit: limit.value, cari: cari.value });
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
const teksBp = (s?: number | null, r?: number | null, satuan = "") => (s == null && r == null ? "-" : `S ${s ?? "?"} / R ${r ?? "?"}${satuan}`);

const dialog = ref(false);
const kosong = () => ({ uuid: "", kode: "", nama: "", golongan: "", potensiDisk: "", bpZonaS: null, bpZonaR: null, bpMicS: null, bpMicR: null, standarBp: "", keterangan: "", status: true });
const form = ref<any>(kosong());
const galat = ref("");
const modeUbah = computed(() => !!form.value.uuid);
const buka = (baris?: any) => {
  galat.value = "";
  form.value = baris
    ? { ...kosong(), ...baris, golongan: baris.golongan ?? "", potensiDisk: baris.potensiDisk ?? "", standarBp: baris.standarBp ?? "", keterangan: baris.keterangan ?? "" }
    : kosong();
  dialog.value = true;
};
const simpan = async () => {
  const f = form.value;
  if (!f.kode?.trim() || !f.nama?.trim()) return (galat.value = "Kode dan nama wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await simpanMasterMikro(
      "antibiotik",
      {
        kode: f.kode, nama: f.nama, golongan: f.golongan, potensiDisk: f.potensiDisk, bpZonaS: f.bpZonaS, bpZonaR: f.bpZonaR,
        bpMicS: f.bpMicS, bpMicR: f.bpMicR, standarBp: f.standarBp, keterangan: f.keterangan, status: f.status,
      },
      f.uuid || undefined,
    );
    if (res) {
      dialog.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const dialogHapus = ref(false);
const akanDihapus = ref<any>(null);
const konfirmasiHapus = (baris: any) => {
  akanDihapus.value = baris;
  dialogHapus.value = true;
};
const hapus = async () => {
  if (!akanDihapus.value) return;
  const res = await hapusMasterMikro("antibiotik", akanDihapus.value.uuid);
  if (res) {
    dialogHapus.value = false;
    muat();
  }
};

// ── Panel per kelompok
const ringkasan = ref<any[]>([]);
const kelompok = ref("ENTEROBACTERALES");
const panel = ref<any[]>([]);
const semuaAb = ref<any[]>([]);
const tambahAb = ref<string[]>([]);
const berubah = ref(false);
const muatPanel = async () => {
  storeUtils.setLoading(true);
  try {
    const [r, p] = await Promise.all([ringkasanPanelMikro(), panelKelompokMikro(kelompok.value)]);
    ringkasan.value = r?.payload ?? [];
    panel.value = (p?.payload ?? []).map((x: any) => ({ ...x }));
    berubah.value = false;
    if (!semuaAb.value.length) semuaAb.value = (await daftarMasterMikro("antibiotik", { limit: 500, status: "aktif" }))?.payload?.data ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
const pilihKelompok = (k: string) => {
  kelompok.value = k;
  tambahAb.value = [];
  muatPanel();
};
const opsiTambah = computed(() =>
  semuaAb.value.filter((a) => !panel.value.some((p) => p.antibiotikUuid === a.uuid)).map((a) => ({ value: a.uuid, label: `${a.kode} — ${a.nama}` })),
);
const tambahkan = () => {
  for (const u of tambahAb.value) {
    const a = semuaAb.value.find((x) => x.uuid === u);
    if (a) panel.value.push({ antibiotikUuid: a.uuid, kode: a.kode, nama: a.nama, golongan: a.golongan, bpZonaS: null, bpZonaR: null, bpMicS: null, bpMicR: null });
  }
  tambahAb.value = [];
  berubah.value = true;
};
const geser = (n: number, arah: number) => {
  const m = n + arah;
  if (m < 0 || m >= panel.value.length) return;
  const salin = [...panel.value];
  [salin[n], salin[m]] = [salin[m], salin[n]];
  panel.value = salin;
  berubah.value = true;
};
const buang = (n: number) => {
  panel.value = panel.value.filter((_, i) => i !== n);
  berubah.value = true;
};
const simpanPanel = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await simpanPanelMikro(
      kelompok.value,
      panel.value.map((p) => ({ antibiotikUuid: p.antibiotikUuid, bpZonaS: p.bpZonaS, bpZonaR: p.bpZonaR, bpMicS: p.bpMicS, bpMicR: p.bpMicR })),
    );
    if (res) muatPanel();
  } finally {
    storeUtils.setLoading(false);
  }
};
const gantiTab = (t: string | number) => {
  tab.value = String(t);
  if (tab.value === "panel" && !ringkasan.value.length) muatPanel();
};

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="tab === 'panel' ? muatPanel() : muat()" />
          <h1 class="toolbar-heading text-opensimrs-300">Antibiotik &amp; Panel Uji Kepekaan</h1>
          <template v-if="tab === 'antibiotik'">
            <CustomTextfield v-model="cari" label="Cari antibiotik" prependIcon="PhMagnifyingGlass" placeholder="Kode / nama / golongan" :maxLength="100" @keydown.enter="cariData" />
            <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
            <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Antibiotik" @click="buka()" />
          </template>
          <template v-else>
            <CustomButton v-if="boleh('UPDATE')" icon="PhFloppyDisk" label="Simpan Panel" :disabled="!berubah" @click="simpanPanel" />
          </template>
        </PageToolbar>
      </template>
      <template #content>
        <Tabs :value="tab" class="flex flex-col h-full" @update:value="gantiTab">
          <TabList>
            <Tab value="antibiotik">Daftar Antibiotik</Tab>
            <Tab value="panel">Panel per Kelompok Organisme</Tab>
          </TabList>
          <TabPanels class="overflow-auto grow !p-0">
            <TabPanel value="antibiotik">
              <NoData v-if="!data.length" />
              <DataTable v-else :value="data" stripedRows class="text-xs" tableStyle="min-width: 50rem">
                <Column header="No." headerClass="bg-opensimrs-50" class="w-[50px]">
                  <template #body="{ index }">{{ (page - 1) * limit + index + 1 }}</template>
                </Column>
                <Column field="kode" header="Kode WHONET" headerClass="bg-opensimrs-50" />
                <Column field="nama" header="Nama Antibiotik" headerClass="bg-opensimrs-50" />
                <Column header="Golongan" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ d.golongan ?? "-" }}</template>
                </Column>
                <Column header="Potensi Disk" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ d.potensiDisk ?? "-" }}</template>
                </Column>
                <Column header="Breakpoint Zona (mm)" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ teksBp(d.bpZonaS, d.bpZonaR) }}</template>
                </Column>
                <Column header="Breakpoint MIC (µg/mL)" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ teksBp(d.bpMicS, d.bpMicR) }}</template>
                </Column>
                <Column header="Status" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">
                    <span :class="d.status ? 'text-mint-400' : 'text-grey-300'">{{ d.status ? "Aktif" : "Nonaktif" }}</span>
                  </template>
                </Column>
                <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[110px]">
                  <template #body="{ data: d }">
                    <div class="flex gap-2">
                      <CustomButton v-if="boleh('UPDATE')" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="buka(d)" />
                      <CustomButton v-if="boleh('DELETE')" icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="konfirmasiHapus(d)" />
                    </div>
                  </template>
                </Column>
              </DataTable>
              <div class="flex justify-end px-5 py-2.5">
                <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[50, 100, 200]" @page="gantiHalaman" />
              </div>
            </TabPanel>
            <TabPanel value="panel">
              <div class="flex gap-4 p-4">
                <div class="flex flex-col gap-1 w-[260px] shrink-0">
                  <button
                    v-for="k in ringkasan"
                    :key="k.kode"
                    type="button"
                    class="flex justify-between px-3 py-2 text-sm text-left border rounded-lg"
                    :class="k.kode === kelompok ? 'bg-opensimrs-50 border-opensimrs-300 text-opensimrs-400 font-semibold' : 'border-grey-75 hover:bg-grey-50'"
                    @click="pilihKelompok(k.kode)"
                  >
                    <span>{{ k.nama }}</span>
                    <span class="text-xs text-grey-400">{{ k.jumlah }}</span>
                  </button>
                </div>
                <div class="flex flex-col gap-3 grow">
                  <div class="flex items-end gap-2">
                    <label class="flex flex-col gap-1 text-sm font-semibold grow">
                      Tambah antibiotik ke panel {{ KELOMPOK_MIKRO[kelompok] }}
                      <MultiSelect v-model="tambahAb" :options="opsiTambah" optionValue="value" optionLabel="label" filter placeholder="Pilih antibiotik" class="w-full font-normal" />
                    </label>
                    <CustomButton icon="PhPlus" label="Tambah" :disabled="!tambahAb.length || !boleh('UPDATE')" @click="tambahkan" />
                  </div>
                  <div class="text-xs text-grey-400">
                    Urutan panel = urutan tampil di form uji kepekaan & cetakan hasil. Breakpoint kelompok (opsional) menimpa breakpoint umum antibiotik untuk interpretasi otomatis.
                    Isi sesuai CLSI/EUCAST edisi yang berlaku di laboratorium.
                  </div>
                  <NoData v-if="!panel.length" />
                  <DataTable v-else :value="panel" class="text-xs" stripedRows>
                    <Column header="#" headerClass="bg-opensimrs-50" class="w-[40px]">
                      <template #body="{ index }">{{ index + 1 }}</template>
                    </Column>
                    <Column header="Antibiotik" headerClass="bg-opensimrs-50">
                      <template #body="{ data: p }"><b>{{ p.kode }}</b> — {{ p.nama }} <div class="text-grey-400">{{ p.golongan ?? "" }}</div></template>
                    </Column>
                    <Column header="Zona S ≥ (mm)" headerClass="bg-opensimrs-50" class="w-[95px]">
                      <template #body="{ data: p }"><InputNumber v-model="p.bpZonaS" :min="0" :max="100" inputClass="w-[70px] text-xs" @update:modelValue="berubah = true" /></template>
                    </Column>
                    <Column header="Zona R ≤ (mm)" headerClass="bg-opensimrs-50" class="w-[95px]">
                      <template #body="{ data: p }"><InputNumber v-model="p.bpZonaR" :min="0" :max="100" inputClass="w-[70px] text-xs" @update:modelValue="berubah = true" /></template>
                    </Column>
                    <Column header="MIC S ≤" headerClass="bg-opensimrs-50" class="w-[95px]">
                      <template #body="{ data: p }">
                        <InputNumber v-model="p.bpMicS" :min="0" :maxFractionDigits="4" inputClass="w-[70px] text-xs" @update:modelValue="berubah = true" />
                      </template>
                    </Column>
                    <Column header="MIC R ≥" headerClass="bg-opensimrs-50" class="w-[95px]">
                      <template #body="{ data: p }">
                        <InputNumber v-model="p.bpMicR" :min="0" :maxFractionDigits="4" inputClass="w-[70px] text-xs" @update:modelValue="berubah = true" />
                      </template>
                    </Column>
                    <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[130px]">
                      <template #body="{ index }">
                        <div class="flex gap-1">
                          <CustomButton icon="PhArrowUp" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" :disabled="index === 0" @click="geser(index, -1)" />
                          <CustomButton icon="PhArrowDown" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" :disabled="index === panel.length - 1" @click="geser(index, 1)" />
                          <CustomButton icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="buang(index)" />
                        </div>
                      </template>
                    </Column>
                  </DataTable>
                </div>
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="680px">
      <template #header>{{ modeUbah ? "Ubah" : "Tambah" }} Antibiotik</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomTextfield v-model="form.kode" label="Kode (WHONET)" placeholder="mis. CRO" required :maxLength="20" />
          <CustomTextfield v-model="form.potensiDisk" label="Potensi Disk" placeholder="mis. 30 µg" :maxLength="20" />
          <CustomTextfield v-model="form.nama" label="Nama Antibiotik" placeholder="mis. Seftriakson" required class="col-span-2" :maxLength="150" />
          <CustomTextfield v-model="form.golongan" label="Golongan / Kelas" placeholder="mis. Sefalosporin generasi III" class="col-span-2" :maxLength="100" />
          <div class="flex flex-col col-span-2 gap-2 p-3 rounded-lg bg-grey-50">
            <div class="text-sm font-semibold">Breakpoint umum (opsional)</div>
            <div class="grid grid-cols-4 gap-3 text-xs">
              <label class="flex flex-col gap-1">Zona S ≥ (mm)<InputNumber v-model="form.bpZonaS" :min="0" :max="100" inputClass="w-full" /></label>
              <label class="flex flex-col gap-1">Zona R ≤ (mm)<InputNumber v-model="form.bpZonaR" :min="0" :max="100" inputClass="w-full" /></label>
              <label class="flex flex-col gap-1">MIC S ≤ (µg/mL)<InputNumber v-model="form.bpMicS" :min="0" :maxFractionDigits="4" inputClass="w-full" /></label>
              <label class="flex flex-col gap-1">MIC R ≥ (µg/mL)<InputNumber v-model="form.bpMicR" :min="0" :maxFractionDigits="4" inputClass="w-full" /></label>
            </div>
            <CustomTextfield v-model="form.standarBp" label="Standar" placeholder="mis. CLSI M100 Ed.35" :maxLength="50" />
          </div>
          <CustomTextfield v-model="form.keterangan" label="Keterangan" :maxLength="500" />
          <CustomSwitch v-model="form.status" label="Status" sideLabel="Nonaktif" sideLabelTrue="Aktif" />
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

    <CustomDialog v-model:visible="dialogHapus" width="420px" headerBg="bg-danger-300">
      <template #header>Hapus Antibiotik</template>
      <template #body>
        <div class="pt-4 text-normal">Hapus antibiotik <b>{{ akanDihapus?.nama }}</b>? Hasil uji kepekaan lama tetap menyimpan nama antibiotik.</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogHapus = false" />
          <CustomButton label="Hapus" icon="PhTrash" backgroundColor="bg-danger-300" @click="hapus" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
