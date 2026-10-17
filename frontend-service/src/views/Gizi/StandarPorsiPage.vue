<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  daftarBentukMakananGizi,
  daftarDietGizi,
  daftarStandarPorsiGizi,
  hapusStandarPorsiGizi,
  izinGizi,
  simpanStandarPorsiGizi,
} from "@/stores/penunjang/gizi";

// Datamaster Gizi: standar porsi per kombinasi diet × bentuk makanan (mis. "DM × Lunak" = 1 porsi @ 250 gram).
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinGizi("Datamaster", aksi, "Standar Porsi");

const data = ref<any[]>([]);
const dietOpsi = ref<any[]>([]);
const bentukOpsi = ref<any[]>([]);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarStandarPorsiGizi();
    data.value = res?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
const muatMaster = async () => {
  const [d, b] = await Promise.all([daftarDietGizi(), daftarBentukMakananGizi()]);
  dietOpsi.value = d?.payload ?? [];
  bentukOpsi.value = b?.payload ?? [];
};

const dialog = ref(false);
const kosong = () => ({ uuid: "", dietUuid: "", bentukMakananUuid: "", takaran: "", satuan: "" });
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
  if (!f.dietUuid || !f.bentukMakananUuid || !f.takaran?.trim()) return (galat.value = "Diet, bentuk makanan, dan takaran wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await simpanStandarPorsiGizi({ dietUuid: f.dietUuid, bentukMakananUuid: f.bentukMakananUuid, takaran: f.takaran, satuan: f.satuan }, f.uuid || undefined);
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
  const res = await hapusStandarPorsiGizi(akanDihapus.value.uuid);
  if (res) {
    dialogHapus.value = false;
    muat();
  }
};

onMounted(async () => {
  await muatMaster();
  muat();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Standar Porsi</h1>
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Standar Porsi" @click="buka()" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 50rem">
          <Column header="No." headerClass="bg-opensimrs-50" class="w-[50px]">
            <template #body="{ index }">{{ index + 1 }}</template>
          </Column>
          <Column field="namaDiet" header="Diet" headerClass="bg-opensimrs-50" />
          <Column field="namaBentukMakanan" header="Bentuk Makanan" headerClass="bg-opensimrs-50" />
          <Column header="Takaran" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.takaran }} {{ d.satuan ?? "" }}</template>
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
      <template #header>{{ modeUbah ? "Ubah" : "Tambah" }} Standar Porsi</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomSelect v-model="form.dietUuid" label="Jenis Diet" :options="dietOpsi" optionValue="uuid" optionLabel="namaDiet" required :disabled="modeUbah" class="col-span-2" />
          <CustomSelect v-model="form.bentukMakananUuid" label="Bentuk Makanan" :options="bentukOpsi" optionValue="uuid" optionLabel="nama" required :disabled="modeUbah" class="col-span-2" />
          <CustomTextfield v-model="form.takaran" label="Takaran" placeholder="mis. 1 porsi / 250" required :maxLength="100" />
          <CustomTextfield v-model="form.satuan" label="Satuan (opsional)" placeholder="mis. gram" :maxLength="50" />
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
      <template #header>Hapus Standar Porsi</template>
      <template #body>
        <div class="pt-4 text-normal">Hapus standar porsi <b>{{ akanDihapus?.namaDiet }} × {{ akanDihapus?.namaBentukMakanan }}</b>?</div>
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
