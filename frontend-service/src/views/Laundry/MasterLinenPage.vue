<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { daftarLinenLaundry, hapusLinenLaundry, izinLaundry, simpanLinenLaundry } from "@/stores/penunjang/laundry";

// Datamaster Laundry: jenis linen (kode, nama, satuan hitung per unit/lembar).
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinLaundry("Datamaster", aksi, "Jenis Linen");

const data = ref<any[]>([]);
const cari = ref("");
const muat = async () => {
  storeUtils.setLoading(true);
  try {
    data.value = (await daftarLinenLaundry({ q: cari.value }))?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};

const dialog = ref(false);
const kosong = () => ({ uuid: "", kode: "", nama: "", satuan: "lembar", aktif: true });
const form = ref<any>(kosong());
const galat = ref("");
const modeUbah = computed(() => !!form.value.uuid);
const buka = (baris?: any) => {
  galat.value = "";
  form.value = baris ? { ...kosong(), ...baris } : kosong();
  dialog.value = true;
};
const simpan = async () => {
  const f = form.value;
  if (!f.kode?.trim() || !f.nama?.trim() || !f.satuan?.trim()) return (galat.value = "Kode, nama, dan satuan wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await simpanLinenLaundry({ kode: f.kode, nama: f.nama, satuan: f.satuan, aktif: f.aktif }, f.uuid || undefined);
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
  const res = await hapusLinenLaundry(akanDihapus.value.uuid);
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
          <h1 class="toolbar-heading text-opensimrs-300">Jenis Linen</h1>
          <CustomTextfield v-model="cari" label="Cari jenis linen" prependIcon="PhMagnifyingGlass" placeholder="Kode / nama" :maxLength="100" @keydown.enter="muat" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="muat" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Jenis Linen" @click="buka()" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 40rem">
          <Column header="No." headerClass="bg-opensimrs-50" class="w-[50px]">
            <template #body="{ index }">{{ index + 1 }}</template>
          </Column>
          <Column field="kode" header="Kode" headerClass="bg-opensimrs-50" />
          <Column field="nama" header="Nama Jenis Linen" headerClass="bg-opensimrs-50" />
          <Column field="satuan" header="Satuan" headerClass="bg-opensimrs-50" />
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><span :class="d.aktif ? 'text-mint-400' : 'text-grey-300'">{{ d.aktif ? "Aktif" : "Nonaktif" }}</span></template>
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
    </Card>

    <CustomDialog v-model:visible="dialog" width="560px">
      <template #header>{{ modeUbah ? "Ubah" : "Tambah" }} Jenis Linen</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomTextfield v-model="form.kode" label="Kode" placeholder="mis. SPR-01" required :maxLength="40" />
          <CustomTextfield v-model="form.satuan" label="Satuan Hitung" placeholder="mis. lembar" required :maxLength="30" />
          <CustomTextfield v-model="form.nama" label="Nama Jenis Linen" placeholder="mis. Sprei Dewasa" class="col-span-2" required :maxLength="120" />
          <CustomSwitch v-model="form.aktif" label="Status" sideLabel="Nonaktif" sideLabelTrue="Aktif" />
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
      <template #header>Arsipkan Jenis Linen</template>
      <template #body>
        <div class="pt-4 text-normal">Arsipkan jenis linen <b>{{ akanDihapus?.nama }}</b>? Hanya bisa bila saldonya sudah nol; riwayat transaksi tetap tersimpan.</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogHapus = false" />
          <CustomButton label="Arsipkan" icon="PhTrash" backgroundColor="bg-danger-300" @click="hapus" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
