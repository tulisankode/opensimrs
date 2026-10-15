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
  JENIS_MIKRO,
  PEWARNAAN_MIKRO,
  SPESIMEN_MIKRO,
  daftarMasterMikro,
  hapusMasterMikro,
  izinMikro,
  namaSpesimen,
  opsi,
  rupiahMikro,
  simpanMasterMikro,
} from "@/stores/penunjang/mikrobiologi";

// Datamaster pemeriksaan mikrobiologi: jenis (kultur/pewarnaan/molekuler), spesimen yang diizinkan, tahapan form hasil
// (pewarnaan, kultur, uji kepekaan), tarif, TAT (hari), kode LIS (untuk integrasi alat kelak).
const storeUtils = utilsStore();
const FITUR = "Pemeriksaan Mikrobiologi";
const boleh = (aksi: string) => izinMikro("Datamaster", aksi, FITUR);

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");
const filterJenis = ref<string[]>([]);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarMasterMikro("pemeriksaan", { page: page.value, limit: limit.value, cari: cari.value, jenis: filterJenis.value });
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
  filterJenis.value = [];
  cariData();
};
const pilihJenis = (kode: string) => {
  filterJenis.value = filterJenis.value.includes(kode) ? filterJenis.value.filter((m) => m !== kode) : [...filterJenis.value, kode];
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

// Daftar spesimen ringkas: 3 nama pertama + jumlah sisanya (daftar lengkap di tooltip).
const ringkasSpesimen = (sp?: string[]) => {
  if (!sp?.length) return "Semua jenis";
  const nama = sp.map((k) => namaSpesimen(k).split(" (")[0]);
  return nama.length > 3 ? `${nama.slice(0, 3).join(", ")} +${nama.length - 3} lainnya` : nama.join(", ");
};

// ── Form
const dialog = ref(false);
const kosong = () => ({
  uuid: "", kode: "", nama: "", jenis: "kultur", spesimen: [] as string[], denganPewarnaan: "", denganKultur: true, denganAst: true,
  metode: "", harga: 0, tatHari: 3, kodeLis: "", keterangan: "", status: true,
});
const form = ref<any>(kosong());
const galat = ref("");
const modeUbah = computed(() => !!form.value.uuid);
const OPSI_SPESIMEN = opsi(SPESIMEN_MIKRO);

const buka = (baris?: any) => {
  galat.value = "";
  form.value = baris
    ? { ...kosong(), ...baris, denganPewarnaan: baris.denganPewarnaan ?? "", metode: baris.metode ?? "", kodeLis: baris.kodeLis ?? "", keterangan: baris.keterangan ?? "" }
    : kosong();
  dialog.value = true;
};
const simpan = async () => {
  const f = form.value;
  if (!f.kode?.trim() || !f.nama?.trim() || !f.jenis) return (galat.value = "Kode, nama, dan jenis wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await simpanMasterMikro(
      "pemeriksaan",
      {
        kode: f.kode, nama: f.nama, jenis: f.jenis, spesimen: f.spesimen, denganPewarnaan: f.denganPewarnaan || null,
        denganKultur: f.denganKultur, denganAst: f.denganAst, metode: f.metode, harga: Number(f.harga) || 0, tatHari: Number(f.tatHari) || 0,
        kodeLis: f.kodeLis, keterangan: f.keterangan, status: f.status,
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
  const res = await hapusMasterMikro("pemeriksaan", akanDihapus.value.uuid);
  if (res) {
    dialogHapus.value = false;
    muat();
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
          <h1 class="toolbar-heading text-opensimrs-300">Pemeriksaan Mikrobiologi</h1>
          <CustomTextfield v-model="cari" label="Cari pemeriksaan" prependIcon="PhMagnifyingGlass" placeholder="Kode / nama / metode" :maxLength="100" @keydown.enter="cariData" />
          <ToolbarFilterMenu :count="filterJenis.length">
            <template #label>Jenis</template>
            <CustomChip
              v-for="(nama, kode) in JENIS_MIKRO"
              :key="kode"
              :label="nama"
              :value="String(kode)"
              :isSelected="filterJenis.includes(String(kode))"
              @selected="pilihJenis"
            />
          </ToolbarFilterMenu>
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="reset" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Pemeriksaan" @click="buka()" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 60rem">
          <Column header="No." headerClass="bg-opensimrs-50" class="w-[50px]">
            <template #body="{ index }">{{ (page - 1) * limit + index + 1 }}</template>
          </Column>
          <Column field="kode" header="Kode" headerClass="bg-opensimrs-50" class="whitespace-nowrap" />
          <Column header="Nama Pemeriksaan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.nama }}</div>
              <div class="text-grey-400">{{ d.metode ?? "" }}</div>
            </template>
          </Column>
          <Column header="Jenis" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ JENIS_MIKRO[d.jenis] ?? d.jenis }}</template>
          </Column>
          <Column header="Tahapan Hasil" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="flex flex-wrap gap-1">
                <span v-if="d.denganPewarnaan" class="px-1.5 rounded bg-info-50 text-info-300">{{ PEWARNAAN_MIKRO[d.denganPewarnaan] ?? d.denganPewarnaan }}</span>
                <span v-if="d.denganKultur" class="px-1.5 rounded bg-warning-50 text-warning-300">Kultur</span>
                <span v-if="d.denganAst" class="px-1.5 rounded bg-success-50 text-success-300">Uji kepekaan</span>
                <span v-if="!d.denganPewarnaan && !d.denganKultur" class="px-1.5 rounded bg-grey-50 text-grey-400">Hasil teks</span>
              </div>
            </template>
          </Column>
          <Column header="Spesimen" headerClass="bg-opensimrs-50" class="max-w-[260px]">
            <template #body="{ data: d }">
              <span class="text-grey-400" :title="d.spesimen?.map(namaSpesimen).join(', ')">{{ ringkasSpesimen(d.spesimen) }}</span>
            </template>
          </Column>
          <Column header="TAT" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.tatHari }} hari</template>
          </Column>
          <Column header="Tarif" headerClass="bg-opensimrs-50" class="text-right">
            <template #body="{ data: d }">{{ rupiahMikro(d.harga) }}</template>
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
      </template>
      <template #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="720px">
      <template #header>{{ modeUbah ? "Ubah" : "Tambah" }} Pemeriksaan Mikrobiologi</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomTextfield v-model="form.kode" label="Kode" placeholder="mis. MB-KU" required :maxLength="30" />
          <CustomSelect v-model="form.jenis" label="Jenis" :options="opsi(JENIS_MIKRO)" optionValue="value" optionLabel="label" required :clearable="false" :showFilter="false" />
          <CustomTextfield v-model="form.nama" label="Nama Pemeriksaan" placeholder="mis. Kultur Urin & Sensitivitas" required class="col-span-2" :maxLength="200" />
          <label class="flex flex-col col-span-2 gap-1 text-sm font-semibold">
            Jenis Spesimen yang Diterima
            <MultiSelect
              v-model="form.spesimen"
              :options="OPSI_SPESIMEN"
              optionValue="value"
              optionLabel="label"
              filter
              display="chip"
              placeholder="Kosongkan = semua jenis spesimen"
              class="w-full font-normal"
            />
          </label>
          <CustomSelect
            v-model="form.denganPewarnaan"
            label="Pewarnaan / Sediaan Langsung"
            placeHolder="Tanpa pewarnaan"
            :options="opsi(PEWARNAAN_MIKRO)"
            optionValue="value"
            optionLabel="label"
            :showFilter="false"
          />
          <CustomTextfield v-model="form.metode" label="Metode" placeholder="mis. Kultur kuantitatif, disk difusi" :maxLength="200" />
          <CustomSwitch v-model="form.denganKultur" label="Kultur & Identifikasi" sideLabel="Tidak" sideLabelTrue="Ya" />
          <CustomSwitch v-model="form.denganAst" label="Uji Kepekaan Antibiotik (AST)" sideLabel="Tidak" sideLabelTrue="Ya" />
          <CustomInputNumber v-model="form.harga" label="Tarif (Rp)" :min="0" />
          <CustomInputNumber v-model="form.tatHari" label="TAT (hari)" :min="0" :max="90" />
          <CustomTextfield v-model="form.kodeLis" label="Kode LIS / Alat (opsional)" placeholder="Untuk integrasi alat kelak" :maxLength="50" />
          <CustomSwitch v-model="form.status" label="Status" sideLabel="Nonaktif" sideLabelTrue="Aktif" />
          <CustomTextfield v-model="form.keterangan" label="Keterangan" class="col-span-2" :maxLength="500" />
        </div>
        <div class="mt-2 text-xs text-grey-400">Uji kepekaan otomatis mengaktifkan kultur. Tahapan menentukan bagian form hasil di menu Pemeriksaan.</div>
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
      <template #header>Hapus Pemeriksaan</template>
      <template #body>
        <div class="pt-4 text-normal">Hapus pemeriksaan <b>{{ akanDihapus?.nama }}</b>? Order yang sudah ada tetap menyimpan nama &amp; tarifnya.</div>
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
