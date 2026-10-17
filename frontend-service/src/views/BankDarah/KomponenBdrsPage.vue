<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { KELOMPOK_KOMPONEN, daftarKomponenBdrs, hapusKomponenBdrs, izinBdrs, opsi, simpanKomponenBdrs } from "@/stores/penunjang/bankDarah";

// Datamaster Komponen Darah (PRC/WB/TC/FFP, dapat ditambah faskes). Komponen nonaktif tidak dapat dipilih pada
// permintaan & penerimaan stok; hapus bersifat lunak sehingga riwayat tetap utuh.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinBdrs("Datamaster", aksi, "Komponen Darah");

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarKomponenBdrs({ page: page.value, limit: limit.value, cari: cari.value });
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
onMounted(muat);

// ── Form
const dialog = ref(false);
const kosong = () => ({ uuid: "", kode: "", nama: "", keterangan: "", kelompok: "lainnya", status: true });
const form = ref<any>(kosong());
const galat = ref("");
const modeUbah = computed(() => !!form.value.uuid);
const buka = (baris?: any) => {
  galat.value = "";
  form.value = baris ? { ...kosong(), ...baris, keterangan: baris.keterangan ?? "" } : kosong();
  dialog.value = true;
};
const simpan = async () => {
  const f = form.value;
  if (!f.kode?.trim() || !f.nama?.trim()) return (galat.value = "Kode dan nama komponen wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await simpanKomponenBdrs({ kode: f.kode.trim(), nama: f.nama.trim(), keterangan: f.keterangan, kelompok: f.kelompok, status: !!f.status }, f.uuid || undefined);
    if (res) {
      dialog.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const hapus = async (baris: any) => {
  if (!window.confirm(`Hapus komponen ${baris.kode} — ${baris.nama}?`)) return;
  storeUtils.setLoading(true);
  try {
    const res = await hapusKomponenBdrs(baris.uuid);
    if (res) muat();
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
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Komponen Darah</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Kode / nama" :maxLength="100" @keydown.enter="cariData" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Komponen" @click="buka()" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs">
          <Column field="kode" header="Kode" headerClass="bg-opensimrs-50" class="w-[120px]" />
          <Column field="nama" header="Nama Komponen" headerClass="bg-opensimrs-50" />
          <Column header="Kelompok" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span :class="d.kelompok === 'lainnya' ? 'text-[#B54708]' : ''">{{ KELOMPOK_KOMPONEN[d.kelompok] ?? d.kelompok }}</span>
            </template>
          </Column>
          <Column field="keterangan" header="Keterangan" headerClass="bg-opensimrs-50" />
          <Column header="Status" headerClass="bg-opensimrs-50" class="w-[110px]">
            <template #body="{ data: d }">
              <span :class="d.status ? 'text-mint-400' : 'text-grey-300'">{{ d.status ? "Aktif" : "Nonaktif" }}</span>
            </template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[130px]">
            <template #body="{ data: d }">
              <div class="flex gap-2">
                <CustomButton v-if="boleh('UPDATE')" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="buka(d)" />
                <CustomButton v-if="boleh('DELETE')" icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="hapus(d)" />
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

    <CustomDialog v-model:visible="dialog" width="520px">
      <template #header>{{ modeUbah ? "Ubah" : "Tambah" }} Komponen Darah</template>
      <template #body>
        <div class="grid grid-cols-3 gap-4 pt-4">
          <CustomTextfield v-model="form.kode" label="Kode" placeholder="mis. PRC" required :maxLength="20" />
          <CustomTextfield v-model="form.nama" label="Nama" placeholder="mis. Packed Red Cell" required class="col-span-2" :maxLength="150" />
          <CustomSelect
            v-model="form.kelompok"
            label="Kelompok Komponen"
            :options="opsi(KELOMPOK_KOMPONEN)"
            optionValue="value"
            optionLabel="label"
            :showFilter="false"
            :clearable="false"
            class="col-span-3"
          />
          <CustomTextArea v-model="form.keterangan" label="Keterangan" placeholder="Opsional" class="col-span-3" />
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
  </div>
</template>
