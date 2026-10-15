<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  BENTUK_MIKRO,
  GRAM_MIKRO,
  KELOMPOK_MIKRO,
  daftarMasterMikro,
  hapusMasterMikro,
  izinMikro,
  opsi,
  simpanMasterMikro,
} from "@/stores/penunjang/mikrobiologi";

// Datamaster organisme: nama spesies, sifat Gram, bentuk, kelompok (menentukan panel antibiotik uji kepekaan otomatis),
// kode WHONET (opsional, untuk ekspor/integrasi).
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinMikro("Datamaster", aksi, "Organisme");

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(50);
const cari = ref("");
const filterGram = ref<string[]>([]);
const filterKelompok = ref<string[]>([]);
const FILTER = { gram: filterGram, kelompok: filterKelompok };
const toggle = (jenis: keyof typeof FILTER, nilai: string) => {
  const d = FILTER[jenis];
  d.value = d.value.includes(nilai) ? d.value.filter((x) => x !== nilai) : [...d.value, nilai];
};

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarMasterMikro("organisme", { page: page.value, limit: limit.value, cari: cari.value, gram: filterGram.value, kelompok: filterKelompok.value });
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
  filterGram.value = [];
  filterKelompok.value = [];
  cariData();
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

const WARNA_GRAM: Record<string, string> = {
  positif: "bg-[#EBE9FE] text-[#5925DC]",
  negatif: "bg-[#FDE2E1] text-[#B42318]",
  jamur: "bg-[#FEF0C7] text-[#B54708]",
  bta: "bg-[#D1E9FF] text-[#175CD3]",
  lain: "bg-grey-50 text-grey-400",
};

// ── Form
const dialog = ref(false);
const kosong = () => ({ uuid: "", kode: "", nama: "", gram: "negatif", bentuk: "batang", kelompok: "ENTEROBACTERALES", kodeWhonet: "", keterangan: "", status: true });
const form = ref<any>(kosong());
const galat = ref("");
const modeUbah = computed(() => !!form.value.uuid);
const buka = (baris?: any) => {
  galat.value = "";
  form.value = baris ? { ...kosong(), ...baris, bentuk: baris.bentuk ?? "", kodeWhonet: baris.kodeWhonet ?? "", keterangan: baris.keterangan ?? "" } : kosong();
  dialog.value = true;
};
const simpan = async () => {
  const f = form.value;
  if (!f.kode?.trim() || !f.nama?.trim() || !f.gram) return (galat.value = "Kode, nama, dan sifat Gram wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await simpanMasterMikro(
      "organisme",
      { kode: f.kode, nama: f.nama, gram: f.gram, bentuk: f.bentuk || null, kelompok: f.kelompok || "LAIN", kodeWhonet: f.kodeWhonet, keterangan: f.keterangan, status: f.status },
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
  const res = await hapusMasterMikro("organisme", akanDihapus.value.uuid);
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
          <h1 class="toolbar-heading text-opensimrs-300">Organisme</h1>
          <CustomTextfield v-model="cari" label="Cari organisme" prependIcon="PhMagnifyingGlass" placeholder="Kode / nama / WHONET" :maxLength="100" @keydown.enter="cariData" />
          <ToolbarFilterMenu :count="filterGram.length">
            <template #label>Gram</template>
            <CustomChip
              v-for="(nama, kode) in GRAM_MIKRO"
              :key="kode"
              :label="nama"
              :value="String(kode)"
              :isSelected="filterGram.includes(String(kode))"
              @selected="toggle('gram', $event)"
            />
          </ToolbarFilterMenu>
          <ToolbarFilterMenu :count="filterKelompok.length">
            <template #label>Kelompok</template>
            <CustomChip
              v-for="(nama, kode) in KELOMPOK_MIKRO"
              :key="kode"
              :label="nama"
              :value="String(kode)"
              :isSelected="filterKelompok.includes(String(kode))"
              @selected="toggle('kelompok', $event)"
            />
          </ToolbarFilterMenu>
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="reset" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Organisme" @click="buka()" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 50rem">
          <Column header="No." headerClass="bg-opensimrs-50" class="w-[50px]">
            <template #body="{ index }">{{ (page - 1) * limit + index + 1 }}</template>
          </Column>
          <Column field="kode" header="Kode" headerClass="bg-opensimrs-50" />
          <Column header="Nama Organisme" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><i class="font-semibold">{{ d.nama }}</i></template>
          </Column>
          <Column header="Gram / Bentuk" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-1.5 rounded" :class="WARNA_GRAM[d.gram] ?? ''">{{ GRAM_MIKRO[d.gram] ?? d.gram }}</span>
              <span class="ml-1 text-grey-400">{{ BENTUK_MIKRO[d.bentuk] ?? "" }}</span>
            </template>
          </Column>
          <Column header="Kelompok (Panel AST)" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ KELOMPOK_MIKRO[d.kelompok] ?? d.kelompok }}</template>
          </Column>
          <Column header="WHONET" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.kodeWhonet ?? "-" }}</template>
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
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[50, 100, 200]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="640px">
      <template #header>{{ modeUbah ? "Ubah" : "Tambah" }} Organisme</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomTextfield v-model="form.kode" label="Kode" placeholder="mis. ECO" required :maxLength="30" />
          <CustomTextfield v-model="form.kodeWhonet" label="Kode WHONET (opsional)" placeholder="mis. eco" :maxLength="20" />
          <CustomTextfield v-model="form.nama" label="Nama Organisme" placeholder="mis. Escherichia coli" required class="col-span-2" :maxLength="200" />
          <CustomSelect v-model="form.gram" label="Sifat Gram" :options="opsi(GRAM_MIKRO)" optionValue="value" optionLabel="label" required :clearable="false" :showFilter="false" />
          <CustomSelect v-model="form.bentuk" label="Bentuk" :options="opsi(BENTUK_MIKRO)" optionValue="value" optionLabel="label" :showFilter="false" />
          <CustomSelect
            v-model="form.kelompok"
            label="Kelompok (Panel Antibiotik)"
            :options="opsi(KELOMPOK_MIKRO)"
            optionValue="value"
            optionLabel="label"
            :clearable="false"
            class="col-span-2"
          />
          <CustomTextfield v-model="form.keterangan" label="Keterangan" :maxLength="500" />
          <CustomSwitch v-model="form.status" label="Status" sideLabel="Nonaktif" sideLabelTrue="Aktif" />
        </div>
        <div class="mt-2 text-xs text-grey-400">Kelompok menentukan daftar antibiotik yang otomatis muncul saat uji kepekaan isolat.</div>
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
      <template #header>Hapus Organisme</template>
      <template #body>
        <div class="pt-4 text-normal">Hapus organisme <b>{{ akanDihapus?.nama }}</b>? Hasil lama tetap menyimpan nama organisme.</div>
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
