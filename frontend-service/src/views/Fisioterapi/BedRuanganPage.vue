<script setup lang="ts">
import { onMounted, ref } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { apiFisio, JAM_SLOT, useFisioterapiStore, type BedFisio } from "@/stores/penunjang/fisioterapi";

// Datamaster Bed Ruangan Fisioterapi. Jam terapi statis 6 slot; slot per jam = jumlah bed aktif.
const store = useFisioterapiStore();
const cari = ref("");
const halaman = ref({ page: 1, limit: 10 });
const daftar = ref<BedFisio[]>([]);
const total = ref(0);
const jumlahAktif = ref(0);
const memuat = ref(false);

const muat = async () => {
  memuat.value = true;
  const [r, aktif] = await Promise.all([apiFisio.daftarBed({ ...halaman.value, cari: cari.value }), apiFisio.daftarBed({ limit: 1, status: "aktif" })]);
  daftar.value = r?.payload?.data ?? [];
  total.value = r?.payload?.pagination?.total ?? 0;
  jumlahAktif.value = aktif?.payload?.pagination?.total ?? 0;
  memuat.value = false;
};
const cariUlang = () => {
  halaman.value.page = 1;
  muat();
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  halaman.value = { page: e.page + 1, limit: e.rows };
  muat();
};

const dialog = ref(false);
const form = ref<Partial<BedFisio>>({});
const galat = ref<Record<string, string>>({});
const bukaForm = (b?: BedFisio) => {
  form.value = b ? { ...b } : { kode: "", nama: "", ruangan: "Ruang Fisioterapi", keterangan: "", status: true };
  galat.value = {};
  dialog.value = true;
};
const simpan = async () => {
  galat.value = {};
  if (!form.value.kode?.trim()) galat.value.kode = "Kode bed wajib diisi";
  if (!form.value.nama?.trim()) galat.value.nama = "Nama bed wajib diisi";
  if (Object.keys(galat.value).length) return;
  const { uuid, kode, nama, ruangan, keterangan, status } = form.value;
  const r = await apiFisio.simpanBed({ kode, nama, ruangan, keterangan, status }, uuid);
  if (!r) return;
  dialog.value = false;
  store.muatBed(true);
  muat();
};

const dialogHapus = ref(false);
const dihapus = ref<BedFisio | null>(null);
const konfirmasiHapus = (b: BedFisio) => {
  dihapus.value = b;
  dialogHapus.value = true;
};
const hapus = async () => {
  if (!dihapus.value) return;
  const r = await apiFisio.hapusBed(dihapus.value.uuid);
  dialogHapus.value = false;
  if (r) {
    store.muatBed(true);
    muat();
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
          <CustomBreadCrumb :home="{ label: 'Datamaster', home: true }" />
          <PhCaretRight :size="16" weight="bold" class="shrink-0 text-opensimrs-300" aria-hidden="true" />
          <h1 class="toolbar-heading text-opensimrs-300">Bed Ruangan</h1>
          <CustomTextfield v-model="cari" label="Cari Bed" prependIcon="PhMagnifyingGlass" placeholder="Kode / nama / ruangan" @keydown.enter="cariUlang" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariUlang" />
          <CustomButton icon="PhPlus" label="Bed" class="toolbar-action" @click="bukaForm()" />
        </PageToolbar>
      </template>
      <template #content>
        <div class="flex flex-wrap items-center gap-2 px-4 py-2 text-xs border-b border-grey-75 text-grey-500">
          <span class="font-semibold">Jam terapi:</span>
          <span v-for="j in JAM_SLOT" :key="j.slot" class="px-2 py-0.5 rounded bg-opensimrs-50 text-opensimrs-400">{{ j.label }}</span>
          <span class="ml-auto">Kapasitas: <b>{{ jumlahAktif }}</b> slot per jam · <b>{{ jumlahAktif * JAM_SLOT.length }}</b> slot per hari</span>
        </div>
        <div class="flex-1 min-h-0">
          <DataTable :value="daftar" :loading="memuat" stripedRows class="text-xs" scrollable scrollHeight="flex" dataKey="uuid">
            <template #empty><NoData /></template>
            <Column header="No." headerClass="bg-opensimrs-50">
              <template #body="{ index }">{{ (halaman.page - 1) * halaman.limit + index + 1 }}</template>
            </Column>
            <Column field="kode" header="Kode" headerClass="bg-opensimrs-50" />
            <Column field="nama" header="Nama Bed" headerClass="bg-opensimrs-50" />
            <Column field="ruangan" header="Ruangan" headerClass="bg-opensimrs-50" />
            <Column field="keterangan" header="Keterangan" headerClass="bg-opensimrs-50" />
            <Column header="Status" headerClass="bg-opensimrs-50">
              <template #body="{ data }">
                <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold" :class="data.status ? 'bg-opensimrs-300 text-white' : 'border border-grey-300 text-grey-400'">
                  {{ data.status ? "AKTIF" : "NON-AKTIF" }}
                </span>
              </template>
            </Column>
            <Column headerClass="bg-opensimrs-50">
              <template #header><div class="w-full text-center">Aksi</div></template>
              <template #body="{ data }">
                <div class="flex items-center justify-center gap-2">
                  <button type="button" class="p-1 text-white rounded bg-info-300" aria-label="Ubah" @click="bukaForm(data)"><PhPencilSimple :size="14" /></button>
                  <button type="button" class="p-1 text-white rounded bg-danger-300" aria-label="Hapus" @click="konfirmasiHapus(data)"><PhTrash :size="14" /></button>
                </div>
              </template>
            </Column>
          </DataTable>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="halaman.limit" :totalRecords="total" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="min(500px, 94vw)">
      <template #header>{{ form.uuid ? "Ubah" : "Tambah" }} Data Bed</template>
      <template #body>
        <div class="grid grid-cols-2 gap-3">
          <CustomTextfield v-model="form.kode" label="Kode Bed" placeholder="mis. BED-01" :invalid="!!galat.kode" :invalidMessage="galat.kode" required />
          <CustomTextfield v-model="form.nama" label="Nama Bed" placeholder="mis. Bed 1" :invalid="!!galat.nama" :invalidMessage="galat.nama" required />
          <CustomTextfield v-model="form.ruangan" class="col-span-2" label="Ruangan" placeholder="mis. Ruang Fisioterapi" />
          <CustomTextArea v-model="form.keterangan" class="col-span-2" label="Keterangan" placeholder="Opsional" />
          <CustomSwitch v-model="form.status" class="col-span-2" showLabel label="Status" sideLabel="NON-AKTIF" sideLabelTrue="AKTIF" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-grey-200" textColor="text-grey-400" @click="dialog = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpan" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogHapus" width="min(420px, 94vw)" headerBg="bg-danger-300">
      <template #header>Hapus Bed</template>
      <template #body>
        <p class="text-sm">Hapus <b>{{ dihapus?.nama }}</b>? Bed yang masih memiliki jadwal/booking aktif tidak dapat dihapus.</p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-grey-200" textColor="text-grey-400" @click="dialogHapus = false" />
          <CustomButton label="Hapus" backgroundColor="bg-danger-300" @click="hapus" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
