<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  JENIS_PA,
  OPSI_JENIS_PA,
  PERAN_PETUGAS_PA,
  daftarDokterPa,
  daftarPemeriksaanPa,
  daftarPetugasPa,
  hapusPemeriksaanPa,
  hapusPetugasPa,
  rupiahPa,
  simpanPemeriksaanPa,
  simpanPetugasPa,
  izinPa,
} from "@/stores/penunjang/patologi";

// Datamaster Patologi Anatomi: pemeriksaan (kode, nama, jenis histopatologi/sitologi/potong beku/IHK, kategori,
// tarif, ICD-9-CM, TAT hari) dan petugas PA (dokter Sp.PA verifikator laporan, teknisi/analis histoteknik).
const storeUtils = utilsStore();
// Hak akses (Patologi Anatomi › Datamaster › Pemeriksaan PA): CREATE / UPDATE / DELETE (tab Petugas memakai UPDATE).
const boleh = (aksi: string) => izinPa("Datamaster", aksi, "Pemeriksaan PA");
const tab = ref<"pemeriksaan" | "petugas">("pemeriksaan");

// ── Pemeriksaan
const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");
const filterJenis = ref<string[]>([]);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarPemeriksaanPa({ page: page.value, limit: limit.value, cari: cari.value, jenis: filterJenis.value });
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
const pilihJenis = (j: string) => {
  filterJenis.value = filterJenis.value.includes(j) ? filterJenis.value.filter((x) => x !== j) : [...filterJenis.value, j];
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

const dialog = ref(false);
const kosong = () => ({ uuid: "", kode: "", nama: "", jenis: "histopatologi", kategori: "", harga: 0, kodeIcd9: "", tatHari: 5, keterangan: "", status: true });
const form = ref<any>(kosong());
const galat = ref("");
const modeUbah = computed(() => !!form.value.uuid);
const buka = (baris?: any) => {
  galat.value = "";
  form.value = baris ? { ...kosong(), ...baris, kategori: baris.kategori ?? "", kodeIcd9: baris.kodeIcd9 ?? "", keterangan: baris.keterangan ?? "" } : kosong();
  dialog.value = true;
};
const simpan = async () => {
  const f = form.value;
  if (!f.kode?.trim() || !f.nama?.trim() || !f.jenis) return (galat.value = "Kode, nama, dan jenis wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await simpanPemeriksaanPa(
      { kode: f.kode, nama: f.nama, jenis: f.jenis, kategori: f.kategori, harga: Number(f.harga) || 0, kodeIcd9: f.kodeIcd9, tatHari: Number(f.tatHari) || 0, keterangan: f.keterangan, status: f.status },
      f.uuid || undefined
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
const hapus = async () => {
  const ok = akanDihapus.value?.peran ? await hapusPetugasPa(akanDihapus.value.uuid) : await hapusPemeriksaanPa(akanDihapus.value.uuid);
  if (ok) {
    dialogHapus.value = false;
    akanDihapus.value?.peran ? muatPetugas() : muat();
  }
};

// ── Petugas
const petugas = ref<any[]>([]);
const praktisi = ref<any[]>([]);
const muatPetugas = async () => {
  petugas.value = (await daftarPetugasPa())?.payload ?? [];
};
const dialogPetugas = ref(false);
const kosongPetugas = () => ({ uuid: "", peran: "dokter", practitionerUuid: "", nama: "", sip: "", keterangan: "", status: true });
const formPetugas = ref<any>(kosongPetugas());
const galatPetugas = ref("");
const bukaPetugas = async (baris?: any) => {
  galatPetugas.value = "";
  formPetugas.value = baris ? { ...kosongPetugas(), ...baris, sip: baris.sip ?? "", keterangan: baris.keterangan ?? "" } : kosongPetugas();
  dialogPetugas.value = true;
  if (!praktisi.value.length) praktisi.value = (await daftarDokterPa(true))?.payload ?? [];
};
const simpanPetugas = async () => {
  const f = formPetugas.value;
  if (!f.uuid && !f.practitionerUuid && !f.nama.trim()) return (galatPetugas.value = "Pilih praktisi atau isi nama");
  const res = await simpanPetugasPa(
    f.uuid
      ? { nama: f.nama, sip: f.sip, keterangan: f.keterangan, status: f.status }
      : { peran: f.peran, practitionerUuid: f.practitionerUuid || null, nama: f.nama, sip: f.sip, keterangan: f.keterangan },
    f.uuid || undefined
  );
  if (res) {
    dialogPetugas.value = false;
    muatPetugas();
  }
};

const gantiTab = (t: "pemeriksaan" | "petugas") => {
  tab.value = t;
  if (t === "petugas") muatPetugas();
};

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="tab === 'pemeriksaan' ? muat() : muatPetugas()" />
          <h1 class="toolbar-heading text-opensimrs-300">{{ tab === "pemeriksaan" ? "Pemeriksaan PA" : "Petugas PA" }}</h1>
          <div class="flex overflow-hidden border rounded-lg shrink-0 border-opensimrs-300">
            <button
              v-for="t in (['pemeriksaan', 'petugas'] as const)"
              :key="t"
              type="button"
              class="px-3 py-1.5 text-xs font-semibold"
              :class="tab === t ? 'bg-opensimrs-300 text-white' : 'text-opensimrs-300 bg-white'"
              @click="gantiTab(t)"
            >
              {{ t === "pemeriksaan" ? "Pemeriksaan & Tarif" : "Dokter Sp.PA & Teknisi" }}
            </button>
          </div>
          <template v-if="tab === 'pemeriksaan'">
            <CustomTextfield v-model="cari" label="Cari pemeriksaan" prependIcon="PhMagnifyingGlass" placeholder="Kode / nama / kategori" :maxLength="100" @keydown.enter="cariData" />
            <ToolbarFilterMenu :count="filterJenis.length">
              <template #label>Jenis</template>
              <CustomChip v-for="(j, kode) in JENIS_PA" :key="kode" :label="j.label" :value="String(kode)" :isSelected="filterJenis.includes(String(kode))" @selected="pilihJenis" />
            </ToolbarFilterMenu>
            <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
            <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Pemeriksaan" @click="buka()" />
          </template>
          <CustomButton v-else-if="boleh('CREATE') || boleh('UPDATE')" icon="PhPlus" label="Petugas" @click="bukaPetugas()" />
        </PageToolbar>
      </template>
      <template #content>
        <template v-if="tab === 'pemeriksaan'">
          <NoData v-if="!data.length" />
          <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 56rem">
            <Column header="No." headerClass="bg-opensimrs-50" class="w-[50px]">
              <template #body="{ index }">{{ (page - 1) * limit + index + 1 }}</template>
            </Column>
            <Column field="kode" header="Kode" headerClass="bg-opensimrs-50" />
            <Column header="Nama Pemeriksaan" headerClass="bg-opensimrs-50">
              <template #body="{ data: d }">
                <div class="font-semibold">{{ d.nama }}</div>
                <div v-if="d.kategori" class="text-grey-400">{{ d.kategori }}</div>
              </template>
            </Column>
            <Column header="Jenis" headerClass="bg-opensimrs-50">
              <template #body="{ data: d }">{{ JENIS_PA[d.jenis as keyof typeof JENIS_PA]?.label ?? d.jenis }}</template>
            </Column>
            <Column header="ICD-9-CM" headerClass="bg-opensimrs-50">
              <template #body="{ data: d }">{{ d.kodeIcd9 ?? "-" }}</template>
            </Column>
            <Column header="TAT" headerClass="bg-opensimrs-50">
              <template #body="{ data: d }">{{ d.tatHari ? `${d.tatHari} hari` : "Hari yang sama" }}</template>
            </Column>
            <Column header="Tarif" headerClass="bg-opensimrs-50" class="text-right">
              <template #body="{ data: d }">{{ rupiahPa(d.harga) }}</template>
            </Column>
            <Column header="Status" headerClass="bg-opensimrs-50">
              <template #body="{ data: d }"><span :class="d.status ? 'text-mint-400' : 'text-grey-300'">{{ d.status ? "Aktif" : "Nonaktif" }}</span></template>
            </Column>
            <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[110px]">
              <template #body="{ data: d }">
                <div class="flex gap-2">
                  <CustomButton v-if="boleh('UPDATE')" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="buka(d)" />
                  <CustomButton v-if="boleh('DELETE')" icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="(akanDihapus = d), (dialogHapus = true)" />
                </div>
              </template>
            </Column>
          </DataTable>
        </template>
        <template v-else>
          <NoData v-if="!petugas.length" />
          <DataTable v-else :value="petugas" stripedRows class="text-xs" scrollable scrollHeight="flex">
            <Column header="Nama" headerClass="bg-opensimrs-50">
              <template #body="{ data: d }">
                <div class="font-semibold">{{ d.nama }}</div>
                <div class="text-grey-400">{{ d.practitionerUuid ? "Terhubung ke praktisi faskes" : "Petugas mandiri / konsulen" }}<span v-if="d.praktisiNonaktif" class="text-danger-300"> · praktisi nonaktif</span></div>
              </template>
            </Column>
            <Column header="Peran" headerClass="bg-opensimrs-50">
              <template #body="{ data: d }">{{ PERAN_PETUGAS_PA[d.peran] ?? d.peran }}</template>
            </Column>
            <Column header="SIP" headerClass="bg-opensimrs-50">
              <template #body="{ data: d }">{{ d.sip ?? "-" }}</template>
            </Column>
            <Column header="Keterangan" headerClass="bg-opensimrs-50">
              <template #body="{ data: d }">{{ d.keterangan ?? "-" }}</template>
            </Column>
            <Column header="Status" headerClass="bg-opensimrs-50">
              <template #body="{ data: d }"><span :class="d.status ? 'text-mint-400' : 'text-grey-300'">{{ d.status ? "Aktif" : "Nonaktif" }}</span></template>
            </Column>
            <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[110px]">
              <template #body="{ data: d }">
                <div class="flex gap-2">
                  <CustomButton v-if="boleh('UPDATE')" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaPetugas(d)" />
                  <CustomButton v-if="boleh('DELETE')" icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="(akanDihapus = d), (dialogHapus = true)" />
                </div>
              </template>
            </Column>
          </DataTable>
        </template>
      </template>
      <template #footer>
        <div v-if="tab === 'pemeriksaan'" class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="660px">
      <template #header>{{ modeUbah ? "Ubah" : "Tambah" }} Pemeriksaan PA</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomTextfield v-model="form.kode" label="Kode" placeholder="mis. PA-HIS-K" required :maxLength="50" />
          <CustomSelect v-model="form.jenis" label="Jenis" :options="OPSI_JENIS_PA" optionValue="value" optionLabel="label" required :clearable="false" :showFilter="false" />
          <CustomTextfield v-model="form.nama" label="Nama Pemeriksaan" placeholder="mis. Histopatologi Biopsi Kecil" required class="col-span-2" :maxLength="200" />
          <CustomTextfield v-model="form.kategori" label="Kategori" placeholder="mis. Biopsi kecil / FNAB / Payudara" :maxLength="100" />
          <CustomTextfield v-model="form.kodeIcd9" label="Kode ICD-9-CM" placeholder="mis. 91.46" :maxLength="20" />
          <CustomInputNumber v-model="form.harga" label="Tarif (Rp)" :min="0" />
          <CustomInputNumber v-model="form.tatHari" label="Target selesai / TAT (hari)" :min="0" :max="60" />
          <CustomTextfield v-model="form.keterangan" label="Keterangan" placeholder="mis. syarat spesimen" class="col-span-2" :maxLength="500" />
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

    <CustomDialog v-model:visible="dialogPetugas" width="560px">
      <template #header>{{ formPetugas.uuid ? "Ubah" : "Tambah" }} Petugas PA</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomSelect
            v-model="formPetugas.peran"
            label="Peran"
            :options="Object.entries(PERAN_PETUGAS_PA).map(([value, label]) => ({ value, label }))"
            optionValue="value"
            optionLabel="label"
            :showFilter="false"
            :clearable="false"
            :disabled="!!formPetugas.uuid"
          />
          <CustomSelect
            v-if="!formPetugas.uuid"
            v-model="formPetugas.practitionerUuid"
            label="Praktisi faskes (opsional)"
            placeHolder="Kosongkan untuk konsulen/tamu"
            :options="praktisi"
            optionValue="uuid"
            optionLabel="nama"
          />
          <div v-else />
          <CustomTextfield v-model="formPetugas.nama" label="Nama & gelar" placeholder="mis. dr. Ratna K., Sp.PA (kosong = nama praktisi)" :maxLength="200" class="col-span-2" />
          <CustomTextfield v-model="formPetugas.sip" label="No. SIP" placeholder="Dicetak di laporan" :maxLength="100" />
          <CustomSwitch v-if="formPetugas.uuid" v-model="formPetugas.status" label="Status" sideLabel="Nonaktif" sideLabelTrue="Aktif" />
          <CustomTextfield v-model="formPetugas.keterangan" label="Keterangan" :maxLength="300" class="col-span-2" />
        </div>
        <div v-if="galatPetugas" class="mt-3 text-sm text-danger-300">{{ galatPetugas }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogPetugas = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanPetugas" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogHapus" width="420px" headerBg="bg-danger-300">
      <template #header>Hapus {{ akanDihapus?.peran ? "Petugas" : "Pemeriksaan" }}</template>
      <template #body>
        <div class="pt-4 text-normal">
          Hapus <b>{{ akanDihapus?.nama }}</b>? Data order/laporan yang sudah ada tetap menyimpan nama &amp; tarifnya.
        </div>
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
