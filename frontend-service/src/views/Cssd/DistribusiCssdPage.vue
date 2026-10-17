<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  buatPermintaanCssd,
  cariPasienCssd,
  daftarMasterSetCssd,
  daftarPermintaanCssd,
  daftarSetCssd,
  distribusiCssd,
  gayaPermintaanCssd,
  izinCssd,
  konfirmasiDistribusiCssd,
  pemakaianCssd,
  referensiUnitCssd,
  stokCssd,
  ubahPermintaanCssd,
  waktuRingkas,
} from "@/stores/penunjang/cssd";

// Penyimpanan, distribusi & pemakaian pasien (KF-15–KF-21). Stok = set berstatus layak & belum kedaluwarsa per
// lokasi; permintaan tidak mengurangi stok sampai serah terima tercatat (aturan bisnis #7).
const storeUtils = utilsStore();
const tab = ref("stok");
const unit = ref<any[]>([]);
const masterSet = ref<any[]>([]);

onMounted(async () => {
  unit.value = (await referensiUnitCssd())?.payload ?? [];
  masterSet.value = (await daftarMasterSetCssd({ limit: 200 }))?.payload?.data ?? [];
  muatStok();
  muatPermintaan();
});
const namaUnit = (uuid?: string) => (uuid ? unit.value.find((u: any) => u.uuid === uuid)?.nama ?? uuid : "-");

// ── Stok ───────────────────────────────────────────────────────────────────
const bolehDistribusi = (aksi: string) => izinCssd("Penyimpanan & Distribusi", aksi);
const stok = ref<any[]>([]);
const filterLokasi = ref("");
const muatStok = async () => {
  storeUtils.setLoading(true);
  try {
    stok.value = (await stokCssd({ lokasi_uuid: filterLokasi.value }))?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Permintaan ───────────────────────────────────────────────────────────────
const permintaan = ref<any[]>([]);
const filterStatusPermintaan = ref("");
const muatPermintaan = async () => {
  permintaan.value = (await daftarPermintaanCssd({ status: filterStatusPermintaan.value, limit: 100 }))?.payload?.data ?? [];
};
const dialogPermintaan = ref(false);
const formPermintaan = ref({ unitUuid: "", masterSetUuid: "", jumlah: 1 });
const galatPermintaan = ref("");
const bukaPermintaan = () => {
  formPermintaan.value = { unitUuid: "", masterSetUuid: "", jumlah: 1 };
  galatPermintaan.value = "";
  dialogPermintaan.value = true;
};
const simpanPermintaan = async () => {
  const f = formPermintaan.value;
  if (!f.unitUuid || !f.masterSetUuid) return (galatPermintaan.value = "Unit dan jenis set wajib dipilih");
  storeUtils.setLoading(true);
  try {
    const res = await buatPermintaanCssd(f);
    if (res) {
      dialogPermintaan.value = false;
      muatPermintaan();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const prosesPermintaan = async (baris: any, status: "disetujui" | "ditolak") => {
  const alasanPenolakan = status === "ditolak" ? window.prompt("Alasan penolakan:") ?? "" : undefined;
  if (status === "ditolak" && !alasanPenolakan) return;
  storeUtils.setLoading(true);
  try {
    const res = await ubahPermintaanCssd(baris.uuid, { status, alasanPenolakan });
    if (res) muatPermintaan();
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Distribusi (serah terima set steril ke unit) ──────────────────────────────
const cariSetLayak = ref("");
const hasilSetLayak = ref<any[]>([]);
const cariSet = async () => {
  hasilSetLayak.value = (await daftarSetCssd({ status: "layak", q: cariSetLayak.value, limit: 30 }))?.payload?.data ?? [];
};
const formDistribusi = ref({ unitTujuanUuid: "", petugasSerahUuid: "", petugasTerimaUuid: "", setUuid: [] as string[] });
const galatDistribusi = ref("");
const serahTerimaTerbaru = ref<any[]>([]);
const namaSetTerbaru = ref<Record<string, string>>({});
const simpanDistribusi = async () => {
  const f = formDistribusi.value;
  if (!f.unitTujuanUuid) return (galatDistribusi.value = "Unit tujuan wajib dipilih");
  if (!f.setUuid.length) return (galatDistribusi.value = "Pilih minimal satu set layak");
  storeUtils.setLoading(true);
  try {
    namaSetTerbaru.value = Object.fromEntries(hasilSetLayak.value.map((s: any) => [s.uuid, `${s.namaSet} — ${s.kodeSetFisik}`]));
    const res = await distribusiCssd(f);
    if (res) {
      serahTerimaTerbaru.value = res.payload ?? [];
      formDistribusi.value = { unitTujuanUuid: "", petugasSerahUuid: "", petugasTerimaUuid: "", setUuid: [] };
      hasilSetLayak.value = [];
      cariSetLayak.value = "";
      muatStok();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const konfirmasiTerima = async (baris: any) => {
  storeUtils.setLoading(true);
  try {
    const res = await konfirmasiDistribusiCssd(baris.uuid, { petugasTerimaUuid: formDistribusi.value.petugasTerimaUuid });
    if (res) baris.dikonfirmasiPada = res.payload?.dikonfirmasiPada;
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Pemakaian pada pasien ─────────────────────────────────────────────────────
const bolehPemakaian = izinCssd("Pemakaian Pasien", "CREATE");
const cariPasienTeks = ref("");
const hasilPasien = ref<any[]>([]);
const formPemakaian = ref({ noReg: "", pasienUuid: "", namaPasien: "", setUuid: "", unitUuid: "", namaTindakan: "", catatan: "" });
const kodeBarcodePakai = ref("");
const galatPemakaian = ref("");
const cariPasien = async () => {
  hasilPasien.value = (await cariPasienCssd(cariPasienTeks.value))?.payload ?? [];
};
const pilihPasien = (p: any) => {
  formPemakaian.value.pasienUuid = p.uuid;
  formPemakaian.value.namaPasien = `${p.name} (${p.noRm})`;
  formPemakaian.value.noReg = "";
  hasilPasien.value = [];
};
const cariSetUntukPakai = async () => {
  const kode = kodeBarcodePakai.value.trim();
  if (!kode) return (galatPemakaian.value = "Pindai atau isi kode barcode set");
  const hasil = (await daftarSetCssd({ q: kode, status: "layak", limit: 5 }))?.payload?.data ?? [];
  const cocok = hasil.find((s: any) => s.kodeBarcode === kode) ?? hasil[0];
  if (!cocok) return (galatPemakaian.value = `Set dengan barcode ${kode} tidak ditemukan/tidak layak dipakai`);
  formPemakaian.value.setUuid = cocok.uuid;
  galatPemakaian.value = "";
};
const simpanPemakaian = async () => {
  const f = formPemakaian.value;
  galatPemakaian.value = "";
  if (!f.setUuid) return (galatPemakaian.value = "Pindai/cari set yang dipakai terlebih dahulu");
  if (!f.noReg.trim() && !f.pasienUuid) return (galatPemakaian.value = "No. Registrasi atau pasien wajib diisi");
  if (!f.unitUuid || !f.namaTindakan.trim()) return (galatPemakaian.value = "Unit dan nama tindakan wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await pemakaianCssd({ noReg: f.noReg || undefined, pasienUuid: f.noReg ? undefined : f.pasienUuid, setUuid: f.setUuid, unitUuid: f.unitUuid, namaTindakan: f.namaTindakan, catatan: f.catatan });
    if (res) {
      formPemakaian.value = { noReg: "", pasienUuid: "", namaPasien: "", setUuid: "", unitUuid: "", namaTindakan: "", catatan: "" };
      kodeBarcodePakai.value = "";
      muatStok();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <h1 class="toolbar-heading text-opensimrs-300">Penyimpanan, Distribusi & Pemakaian</h1>
        </PageToolbar>
      </template>
      <template #content>
        <Tabs :value="tab" class="flex flex-col h-full" @update:value="(v: any) => (tab = v)">
          <TabList>
            <Tab value="stok">Stok Set Layak</Tab>
            <Tab value="permintaan">Permintaan Unit</Tab>
            <Tab value="distribusi">Distribusi</Tab>
            <Tab value="pemakaian">Pemakaian Pasien</Tab>
          </TabList>
          <TabPanels class="overflow-auto grow">
            <TabPanel value="stok">
              <div class="flex items-end gap-2 mb-3">
                <CustomSelect v-model="filterLokasi" label="Lokasi" :options="unit.map((u: any) => ({ value: u.uuid, label: u.nama }))" optionValue="value" optionLabel="label" placeHolder="Semua lokasi" class="w-[280px]" @update:modelValue="muatStok" />
                <CustomButton icon="PhArrowClockwise" @click="muatStok" />
              </div>
              <NoData v-if="!stok.length" />
              <DataTable v-else :value="stok" stripedRows class="text-xs">
                <Column header="Lokasi" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ d.lokasiTipe === "cssd" ? "CSSD" : namaUnit(d.lokasiUuid) }}</template>
                </Column>
                <Column field="namaSet" header="Jenis Set" headerClass="bg-opensimrs-50" />
                <Column field="jumlah" header="Jumlah Layak" headerClass="bg-opensimrs-50" />
              </DataTable>
            </TabPanel>

            <TabPanel value="permintaan">
              <PageToolbar class="!px-0 mb-3">
                <CustomSelect
                  v-model="filterStatusPermintaan"
                  label="Status"
                  :options="[{ value: 'menunggu', label: 'Menunggu' }, { value: 'disetujui', label: 'Disetujui' }, { value: 'ditolak', label: 'Ditolak' }, { value: 'selesai', label: 'Selesai' }]"
                  optionValue="value"
                  optionLabel="label"
                  placeHolder="Semua status"
                  @update:modelValue="muatPermintaan"
                />
                <CustomButton icon="PhArrowClockwise" @click="muatPermintaan" />
                <CustomButton v-if="bolehDistribusi('CREATE')" icon="PhPlus" label="Permintaan" @click="bukaPermintaan" />
              </PageToolbar>
              <NoData v-if="!permintaan.length" />
              <DataTable v-else :value="permintaan" stripedRows class="text-xs">
                <Column header="Unit" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ namaUnit(d.unitUuid) }}</template>
                </Column>
                <Column field="namaSet" header="Jenis Set" headerClass="bg-opensimrs-50" />
                <Column field="jumlah" header="Jumlah" headerClass="bg-opensimrs-50" />
                <Column header="Status" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaPermintaanCssd(d.status)?.bg, gayaPermintaanCssd(d.status)?.text]">{{ gayaPermintaanCssd(d.status)?.label }}</span>
                  </template>
                </Column>
                <Column header="Diajukan" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ waktuRingkas(d.waktuPermintaan) }}</template>
                </Column>
                <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[200px]">
                  <template #body="{ data: d }">
                    <div v-if="d.status === 'menunggu' && bolehDistribusi('UPDATE')" class="flex gap-2">
                      <CustomButton label="Setujui" size="small" @click="prosesPermintaan(d, 'disetujui')" />
                      <CustomButton label="Tolak" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="prosesPermintaan(d, 'ditolak')" />
                    </div>
                  </template>
                </Column>
              </DataTable>
            </TabPanel>

            <TabPanel value="distribusi">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <h3 class="mb-2 text-sm font-semibold">Pilih Set Layak</h3>
                  <div class="flex gap-2">
                    <CustomTextfield v-model="cariSetLayak" label="" placeholder="Cari kode/barcode/nama set" :maxLength="100" @keydown.enter="cariSet" />
                    <CustomButton icon="PhMagnifyingGlass" @click="cariSet" />
                  </div>
                  <MultiSelect
                    v-model="formDistribusi.setUuid"
                    :options="hasilSetLayak.map((s: any) => ({ value: s.uuid, label: `${s.namaSet} — ${s.kodeSetFisik} (${s.kodeBarcode})` }))"
                    optionValue="value"
                    optionLabel="label"
                    filter
                    display="chip"
                    placeholder="Pilih set yang akan diserahkan"
                    class="w-full mt-2 font-normal"
                  />
                </div>
                <div class="flex flex-col gap-3">
                  <CustomSelect v-model="formDistribusi.unitTujuanUuid" label="Unit Tujuan" :options="unit.map((u: any) => ({ value: u.uuid, label: u.nama }))" optionValue="value" optionLabel="label" placeHolder="Pilih unit" />
                  <CustomTextfield v-model="formDistribusi.petugasSerahUuid" label="Petugas Penyerah (CSSD)" :maxLength="255" />
                  <CustomTextfield v-model="formDistribusi.petugasTerimaUuid" label="Petugas Penerima (unit)" :maxLength="255" />
                  <div v-if="galatDistribusi" class="text-sm text-danger-300">{{ galatDistribusi }}</div>
                  <CustomButton v-if="bolehDistribusi('CREATE')" label="Catat Serah Terima" icon="PhCheck" @click="simpanDistribusi" />
                </div>
              </div>

              <div v-if="serahTerimaTerbaru.length" class="mt-4">
                <h3 class="mb-2 text-sm font-semibold">Serah Terima Baru Saja Dicatat</h3>
                <DataTable :value="serahTerimaTerbaru" stripedRows class="text-xs">
                  <Column header="Set" headerClass="bg-opensimrs-50">
                    <template #body="{ data: d }">{{ namaSetTerbaru[d.setUuid] ?? d.setUuid }}</template>
                  </Column>
                  <Column header="Waktu" headerClass="bg-opensimrs-50">
                    <template #body="{ data: d }">{{ waktuRingkas(d.waktu) }}</template>
                  </Column>
                  <Column header="Konfirmasi Penerimaan" headerClass="bg-opensimrs-50">
                    <template #body="{ data: d }">
                      <CustomButton v-if="!d.dikonfirmasiPada && bolehDistribusi('KONFIRMASI')" label="Konfirmasi Diterima" size="small" @click="konfirmasiTerima(d)" />
                      <span v-else-if="d.dikonfirmasiPada" class="text-mint-400">Dikonfirmasi</span>
                    </template>
                  </Column>
                </DataTable>
              </div>
            </TabPanel>

            <TabPanel value="pemakaian">
              <div class="grid grid-cols-2 gap-4">
                <div class="flex flex-col gap-3">
                  <h3 class="text-sm font-semibold">Rujukan Pasien/Kunjungan</h3>
                  <CustomTextfield v-model="formPemakaian.noReg" label="No. Registrasi Kunjungan" placeholder="Isi bila ada No. Reg" :maxLength="100" />
                  <div class="text-xs text-center text-grey-400">atau</div>
                  <div class="flex gap-2">
                    <CustomTextfield v-model="cariPasienTeks" label="Cari Pasien (nama/No. RM/NIK)" :maxLength="100" @keydown.enter="cariPasien" />
                    <CustomButton icon="PhMagnifyingGlass" class="mt-6" @click="cariPasien" />
                  </div>
                  <div v-if="formPemakaian.namaPasien" class="px-3 py-2 text-sm border rounded-lg border-mint-200 bg-mint-25">Pasien terpilih: {{ formPemakaian.namaPasien }}</div>
                  <NoData v-else-if="cariPasienTeks && !hasilPasien.length" />
                  <div v-for="p in hasilPasien" :key="p.uuid" class="flex items-center justify-between px-3 py-2 text-sm border rounded-lg border-grey-100">
                    <span>{{ p.name }} — {{ p.noRm }}</span>
                    <CustomButton label="Pilih" size="small" @click="pilihPasien(p)" />
                  </div>
                </div>
                <div class="flex flex-col gap-3">
                  <h3 class="text-sm font-semibold">Set & Tindakan</h3>
                  <div class="flex gap-2">
                    <CustomTextfield v-model="kodeBarcodePakai" label="Kode Barcode/QR Set" :maxLength="100" @keydown.enter="cariSetUntukPakai" />
                    <CustomButton icon="PhMagnifyingGlass" class="mt-6" @click="cariSetUntukPakai" />
                  </div>
                  <CustomSelect v-model="formPemakaian.unitUuid" label="Unit Pemakaian" :options="unit.map((u: any) => ({ value: u.uuid, label: u.nama }))" optionValue="value" optionLabel="label" placeHolder="Pilih unit" />
                  <CustomTextfield v-model="formPemakaian.namaTindakan" label="Nama Tindakan" :maxLength="255" />
                  <CustomTextArea v-model="formPemakaian.catatan" label="Catatan" />
                  <div v-if="galatPemakaian" class="text-sm text-danger-300">{{ galatPemakaian }}</div>
                  <CustomButton v-if="bolehPemakaian" label="Catat Pemakaian" icon="PhCheck" @click="simpanPemakaian" />
                </div>
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialogPermintaan" width="520px">
      <template #header>Permintaan Set Steril</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <CustomSelect v-model="formPermintaan.unitUuid" label="Unit" :options="unit.map((u: any) => ({ value: u.uuid, label: u.nama }))" optionValue="value" optionLabel="label" placeHolder="Pilih unit" />
          <CustomSelect v-model="formPermintaan.masterSetUuid" label="Jenis Set" :options="masterSet.map((m: any) => ({ value: m.uuid, label: m.namaSet }))" optionValue="value" optionLabel="label" placeHolder="Pilih jenis set" />
          <CustomInputNumber v-model="formPermintaan.jumlah" label="Jumlah" :min="1" />
          <div v-if="galatPermintaan" class="text-sm text-danger-300">{{ galatPermintaan }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogPermintaan = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanPermintaan" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
