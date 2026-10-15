<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  MODALITAS_RAD,
  daftarPaketRad,
  daftarPemeriksaanRad,
  hapusPaketRad,
  rupiahRad,
  simpanPaketRad,
  type PaketRad,
} from "@/stores/penunjang/radiologi";

// Datamaster Paket Pemeriksaan Radiologi: kumpulan pemeriksaan dengan satu harga paket. Saat diorder, harga paket
// dialokasikan proporsional ke tiap pemeriksaan (tagihan & laporan tetap per pemeriksaan, total = harga paket).
const storeUtils = utilsStore();

const data = ref<PaketRad[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarPaketRad({ page: page.value, limit: limit.value, cari: cari.value });
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
  cariData();
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};
const persenHemat = (p: { harga: number; totalSatuan: number }) =>
  p.totalSatuan > 0 && p.totalSatuan > p.harga ? Math.round(((p.totalSatuan - p.harga) / p.totalSatuan) * 100) : 0;

// ── Master pemeriksaan (untuk memilih isi paket)
const pemeriksaan = ref<any[]>([]);
const muatPemeriksaan = async () => {
  if (pemeriksaan.value.length) return;
  const res = await daftarPemeriksaanRad({ limit: 9999 });
  pemeriksaan.value = res?.payload?.data ?? [];
};
const cariItem = ref("");
const pilihanItem = computed(() => {
  const q = cariItem.value.trim().toLowerCase();
  return pemeriksaan.value.filter((m) => !q || `${m.kode} ${m.nama} ${m.bagianTubuh ?? ""} ${m.modalitas}`.toLowerCase().includes(q));
});

// ── Form tambah / ubah
const dialog = ref(false);
const kosong = () => ({ uuid: "", kode: "", nama: "", deskripsi: "", harga: 0, status: true, items: [] as string[] });
const form = ref(kosong());
const galat = ref("");
const modeUbah = computed(() => !!form.value.uuid);
const itemForm = computed(() => form.value.items.map((u) => pemeriksaan.value.find((m) => m.uuid === u)).filter(Boolean));
const totalSatuanForm = computed(() => itemForm.value.reduce((n, m) => n + Number(m.harga || 0), 0));

const buka = async (baris?: PaketRad) => {
  galat.value = "";
  cariItem.value = "";
  await muatPemeriksaan();
  form.value = baris
    ? { uuid: baris.uuid, kode: baris.kode, nama: baris.nama, deskripsi: baris.deskripsi ?? "", harga: baris.harga, status: baris.status, items: baris.items.map((i) => i.pemeriksaanUuid) }
    : kosong();
  dialog.value = true;
};
const toggleItem = (uuid: string) => {
  form.value.items = form.value.items.includes(uuid) ? form.value.items.filter((u) => u !== uuid) : [...form.value.items, uuid];
};
const naikTurun = (i: number, arah: -1 | 1) => {
  const a = [...form.value.items];
  const j = i + arah;
  if (j < 0 || j >= a.length) return;
  [a[i], a[j]] = [a[j], a[i]];
  form.value.items = a;
};
const simpan = async () => {
  const f = form.value;
  if (!f.kode?.trim() || !f.nama?.trim()) return (galat.value = "Kode dan nama paket wajib diisi");
  if (!f.items.length) return (galat.value = "Pilih minimal satu pemeriksaan");
  if (!(Number(f.harga) >= 0)) return (galat.value = "Harga paket tidak valid");
  storeUtils.setLoading(true);
  try {
    const res = await simpanPaketRad(
      { kode: f.kode, nama: f.nama, deskripsi: f.deskripsi, harga: Number(f.harga) || 0, status: f.status, items: f.items },
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
const akanDihapus = ref<PaketRad | null>(null);
const konfirmasiHapus = (baris: PaketRad) => {
  akanDihapus.value = baris;
  dialogHapus.value = true;
};
const hapus = async () => {
  if (!akanDihapus.value) return;
  const res = await hapusPaketRad(akanDihapus.value.uuid);
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
          <h1 class="toolbar-heading text-opensimrs-300">Paket Radiologi</h1>
          <CustomTextfield
            v-model="cari"
            label="Cari paket"
            prependIcon="PhMagnifyingGlass"
            placeholder="Kode / nama / deskripsi"
            :maxLength="100"
            @keydown.enter="cariData"
          />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="reset" />
          <CustomButton icon="PhPlus" label="Paket" @click="buka()" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 60rem">
          <Column header="No." headerClass="bg-opensimrs-50" class="w-[50px]">
            <template #body="{ index }">{{ (page - 1) * limit + index + 1 }}</template>
          </Column>
          <Column field="kode" header="Kode" headerClass="bg-opensimrs-50" />
          <Column header="Nama Paket" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.nama }}</div>
              <div v-if="d.deskripsi" class="text-grey-400">{{ d.deskripsi }}</div>
            </template>
          </Column>
          <Column header="Isi Pemeriksaan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="i in d.items"
                  :key="i.pemeriksaanUuid"
                  class="px-1.5 py-0.5 rounded"
                  :class="i.aktif ? 'bg-opensimrs-50 text-opensimrs-400' : 'bg-danger-50 text-danger-300 line-through'"
                  :title="i.aktif ? `${i.kode} · ${rupiahRad(i.harga)}` : 'Pemeriksaan nonaktif / dihapus'"
                >
                  {{ i.modalitas }} · {{ i.nama }}
                </span>
              </div>
            </template>
          </Column>
          <Column header="Total Satuan" headerClass="bg-opensimrs-50" class="text-right whitespace-nowrap">
            <template #body="{ data: d }"><span class="text-grey-400">{{ rupiahRad(d.totalSatuan) }}</span></template>
          </Column>
          <Column header="Harga Paket" headerClass="bg-opensimrs-50" class="text-right whitespace-nowrap">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ rupiahRad(d.harga) }}</div>
              <div v-if="persenHemat(d)" class="text-mint-400">hemat {{ persenHemat(d) }}%</div>
              <div v-else-if="d.harga > d.totalSatuan" class="text-warning-400">di atas total satuan</div>
            </template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span :class="d.status ? 'text-mint-400' : 'text-grey-300'">{{ d.status ? "Aktif" : "Nonaktif" }}</span>
            </template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[110px]">
            <template #body="{ data: d }">
              <div class="flex gap-2">
                <CustomButton icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="buka(d)" />
                <CustomButton icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="konfirmasiHapus(d)" />
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

    <CustomDialog v-model:visible="dialog" width="900px">
      <template #header>{{ modeUbah ? "Ubah" : "Tambah" }} Paket Radiologi</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomTextfield v-model="form.kode" label="Kode" placeholder="mis. PKT-RAD-CU" required :maxLength="50" />
          <CustomTextfield v-model="form.nama" label="Nama Paket" placeholder="mis. Paket Check-Up Radiologi" required :maxLength="200" />
          <CustomTextArea v-model="form.deskripsi" label="Deskripsi" placeholder="Keterangan singkat isi / indikasi paket" class="col-span-2" />
        </div>
        <div class="grid grid-cols-2 gap-4 mt-4">
          <div class="flex flex-col gap-2">
            <div class="text-sm font-semibold">Pilih Pemeriksaan</div>
            <IconField>
              <InputIcon><PhMagnifyingGlass :size="16" /></InputIcon>
              <InputText v-model="cariItem" placeholder="Cari kode / nama / modalitas" class="w-full text-sm" />
            </IconField>
            <div class="overflow-auto border rounded-lg border-grey-75 h-[280px]">
              <label
                v-for="m in pilihanItem"
                :key="m.uuid"
                class="flex items-center gap-2 px-3 py-1.5 text-xs border-b cursor-pointer border-grey-75 hover:bg-opensimrs-50"
                :class="{ 'opacity-50': !m.status }"
              >
                <Checkbox :modelValue="form.items.includes(m.uuid)" binary @update:modelValue="toggleItem(m.uuid)" />
                <span class="w-8 font-semibold text-opensimrs-400" :title="MODALITAS_RAD[m.modalitas]">{{ m.modalitas }}</span>
                <span class="grow">{{ m.nama }} <span class="text-grey-300">· {{ m.kode }}</span><span v-if="!m.status" class="text-danger-300"> (nonaktif)</span></span>
                <span class="text-grey-400">{{ rupiahRad(m.harga) }}</span>
              </label>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <div class="text-sm font-semibold">Isi Paket ({{ itemForm.length }})</div>
            <div class="overflow-auto border rounded-lg border-grey-75 h-[200px]">
              <div v-if="!itemForm.length" class="p-3 text-xs text-grey-400">Belum ada pemeriksaan dipilih.</div>
              <div v-for="(m, i) in itemForm" :key="m.uuid" class="flex items-center gap-2 px-3 py-1.5 text-xs border-b border-grey-75">
                <span class="w-5 text-grey-300">{{ i + 1 }}.</span>
                <span class="grow">{{ m.nama }} <span class="text-grey-300">· {{ m.modalitas }}</span></span>
                <span class="text-grey-400">{{ rupiahRad(m.harga) }}</span>
                <PhCaretUp :size="14" class="cursor-pointer text-grey-400" @click="naikTurun(i, -1)" />
                <PhCaretDown :size="14" class="cursor-pointer text-grey-400" @click="naikTurun(i, 1)" />
                <PhX :size="14" class="cursor-pointer text-danger-300" @click="toggleItem(m.uuid)" />
              </div>
            </div>
            <div class="p-3 text-sm rounded-lg bg-opensimrs-50">
              <div class="flex justify-between"><span>Total tarif satuan</span><b>{{ rupiahRad(totalSatuanForm) }}</b></div>
              <div class="flex justify-between">
                <span>Harga paket</span>
                <b :class="Number(form.harga) > totalSatuanForm ? 'text-warning-400' : 'text-opensimrs-400'">{{ rupiahRad(form.harga) }}</b>
              </div>
              <div class="flex justify-between text-xs text-grey-400">
                <span>Selisih</span>
                <span>{{ rupiahRad(totalSatuanForm - Number(form.harga || 0)) }} ({{ persenHemat({ harga: Number(form.harga || 0), totalSatuan: totalSatuanForm }) }}%)</span>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <CustomInputNumber v-model="form.harga" label="Harga Paket (Rp)" :min="0" />
              <CustomSwitch v-model="form.status" label="Status" sideLabel="Nonaktif" sideLabelTrue="Aktif" />
            </div>
          </div>
        </div>
        <div class="mt-2 text-xs text-grey-400">
          Saat diorder, harga paket dibagi proporsional terhadap tarif satuan tiap pemeriksaan (tagihan per pemeriksaan, jumlahnya = harga paket).
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
      <template #header>Hapus Paket</template>
      <template #body>
        <div class="pt-4 text-normal">
          Hapus paket <b>{{ akanDihapus?.nama }}</b>? Order yang sudah ada tetap menyimpan item &amp; tarifnya.
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
