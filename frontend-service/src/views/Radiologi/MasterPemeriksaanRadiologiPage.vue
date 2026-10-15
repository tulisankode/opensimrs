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
  MODALITAS_RAD,
  OPSI_MODALITAS,
  daftarPemeriksaanRad,
  hapusPemeriksaanRad,
  rupiahRad,
  simpanPemeriksaanRad,
} from "@/stores/penunjang/radiologi";

// Datamaster pemeriksaan radiologi: kode, nama, modalitas, bagian tubuh, tarif, kode ICD-9-CM.
const storeUtils = utilsStore();

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");
const filterModalitas = ref<string[]>([]);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarPemeriksaanRad({ page: page.value, limit: limit.value, cari: cari.value, modalitas: filterModalitas.value });
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
  filterModalitas.value = [];
  cariData();
};
const pilihModalitas = (kode: string) => {
  filterModalitas.value = filterModalitas.value.includes(kode)
    ? filterModalitas.value.filter((m) => m !== kode)
    : [...filterModalitas.value, kode];
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

// ── Form tambah / ubah
const dialog = ref(false);
const kosong = () => ({ uuid: "", kode: "", nama: "", modalitas: "XR", bagianTubuh: "", harga: 0, kodeIcd9: "", persiapan: "", status: true });
const form = ref<any>(kosong());
const galat = ref("");
const modeUbah = computed(() => !!form.value.uuid);

const buka = (baris?: any) => {
  galat.value = "";
  form.value = baris ? { ...kosong(), ...baris, bagianTubuh: baris.bagianTubuh ?? "", kodeIcd9: baris.kodeIcd9 ?? "", persiapan: baris.persiapan ?? "" } : kosong();
  dialog.value = true;
};
const simpan = async () => {
  const f = form.value;
  if (!f.kode?.trim() || !f.nama?.trim() || !f.modalitas) return (galat.value = "Kode, nama, dan modalitas wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await simpanPemeriksaanRad(
      { kode: f.kode, nama: f.nama, modalitas: f.modalitas, bagianTubuh: f.bagianTubuh, harga: Number(f.harga) || 0, kodeIcd9: f.kodeIcd9, persiapan: f.persiapan, status: f.status },
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
const konfirmasiHapus = (baris: any) => {
  akanDihapus.value = baris;
  dialogHapus.value = true;
};
const hapus = async () => {
  if (!akanDihapus.value) return;
  const res = await hapusPemeriksaanRad(akanDihapus.value.uuid);
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
          <h1 class="toolbar-heading text-opensimrs-300">Pemeriksaan Radiologi</h1>
          <CustomTextfield
            v-model="cari"
            label="Cari pemeriksaan"
            prependIcon="PhMagnifyingGlass"
            placeholder="Kode / nama / bagian tubuh"
            :maxLength="100"
            @keydown.enter="cariData"
          />
          <ToolbarFilterMenu :count="filterModalitas.length">
            <template #label>Modalitas</template>
            <CustomChip
              v-for="(nama, kode) in MODALITAS_RAD"
              :key="kode"
              :label="`${kode} — ${nama}`"
              :value="String(kode)"
              :isSelected="filterModalitas.includes(String(kode))"
              @selected="pilihModalitas"
            />
          </ToolbarFilterMenu>
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="reset" />
          <CustomButton icon="PhPlus" label="Pemeriksaan" @click="buka()" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 50rem">
          <Column header="No." headerClass="bg-opensimrs-50" class="w-[50px]">
            <template #body="{ index }">{{ (page - 1) * limit + index + 1 }}</template>
          </Column>
          <Column field="kode" header="Kode" headerClass="bg-opensimrs-50" />
          <Column field="nama" header="Nama Pemeriksaan" headerClass="bg-opensimrs-50" />
          <Column header="Modalitas" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.modalitas }} · {{ MODALITAS_RAD[d.modalitas] ?? "-" }}</template>
          </Column>
          <Column header="Bagian Tubuh" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.bagianTubuh ?? "-" }}</template>
          </Column>
          <Column header="ICD-9-CM" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.kodeIcd9 ?? "-" }}</template>
          </Column>
          <Column header="Tarif" headerClass="bg-opensimrs-50" class="text-right">
            <template #body="{ data: d }">{{ rupiahRad(d.harga) }}</template>
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

    <CustomDialog v-model:visible="dialog" width="640px">
      <template #header>{{ modeUbah ? "Ubah" : "Tambah" }} Pemeriksaan Radiologi</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomTextfield v-model="form.kode" label="Kode" placeholder="mis. XR-THX-PA" required :maxLength="50" />
          <CustomSelect v-model="form.modalitas" label="Modalitas" :options="OPSI_MODALITAS" optionValue="value" optionLabel="label" required :clearable="false" />
          <CustomTextfield v-model="form.nama" label="Nama Pemeriksaan" placeholder="mis. Thorax PA" required class="col-span-2" :maxLength="200" />
          <CustomTextfield v-model="form.bagianTubuh" label="Bagian Tubuh" placeholder="mis. Dada" :maxLength="100" />
          <CustomTextfield v-model="form.kodeIcd9" label="Kode ICD-9-CM" placeholder="mis. 87.44" :maxLength="20" />
          <CustomInputNumber v-model="form.harga" label="Tarif (Rp)" :min="0" />
          <CustomSwitch v-model="form.status" label="Status" sideLabel="Nonaktif" sideLabelTrue="Aktif" />
          <label class="flex flex-col col-span-2 gap-1 text-sm font-semibold">
            Persiapan Pasien
            <textarea v-model="form.persiapan" rows="3" maxlength="1000" placeholder="mis. Puasa 6 jam sebelum pemeriksaan; kandung kemih penuh" class="p-2 font-normal border rounded-md border-grey-200 focus:outline-opensimrs-300"></textarea>
            <span class="text-xs font-normal text-grey-400">Dicetak pada slip jadwal pasien.</span>
          </label>
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
      <template #header>Hapus Pemeriksaan</template>
      <template #body>
        <div class="pt-4 text-normal">
          Hapus pemeriksaan <b>{{ akanDihapus?.nama }}</b>? Order yang sudah ada tetap menyimpan nama &amp; tarifnya.
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
