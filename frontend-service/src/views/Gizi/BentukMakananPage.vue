<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { daftarBentukMakananGizi, hapusBentukMakananGizi, izinGizi, simpanBentukMakananGizi } from "@/stores/penunjang/gizi";

// Datamaster Gizi: bentuk makanan (mis. Biasa, Lunak, Cair, Saring).
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinGizi("Datamaster", aksi, "Bentuk Makanan");

const data = ref<any[]>([]);
const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarBentukMakananGizi();
    data.value = res?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};

const dialog = ref(false);
const kosong = () => ({ uuid: "", nama: "", status: true });
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
  if (!f.nama?.trim()) return (galat.value = "Nama bentuk makanan wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await simpanBentukMakananGizi({ nama: f.nama, status: f.status }, f.uuid || undefined);
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
  const res = await hapusBentukMakananGizi(akanDihapus.value.uuid);
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
          <h1 class="toolbar-heading text-opensimrs-300">Bentuk Makanan</h1>
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Bentuk Makanan" @click="buka()" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 40rem">
          <Column header="No." headerClass="bg-opensimrs-50" class="w-[50px]">
            <template #body="{ index }">{{ index + 1 }}</template>
          </Column>
          <Column field="nama" header="Nama" headerClass="bg-opensimrs-50" />
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><span :class="d.status ? 'text-mint-400' : 'text-grey-300'">{{ d.status ? "Aktif" : "Nonaktif" }}</span></template>
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

    <CustomDialog v-model:visible="dialog" width="480px">
      <template #header>{{ modeUbah ? "Ubah" : "Tambah" }} Bentuk Makanan</template>
      <template #body>
        <div class="grid grid-cols-1 gap-4 pt-4">
          <CustomTextfield v-model="form.nama" label="Nama" placeholder="mis. Lunak" required :maxLength="100" />
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
      <template #header>Hapus Bentuk Makanan</template>
      <template #body>
        <div class="pt-4 text-normal">Hapus bentuk makanan <b>{{ akanDihapus?.nama }}</b>?</div>
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
