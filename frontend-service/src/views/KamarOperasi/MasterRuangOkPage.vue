<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { daftarRuangOk, hapusRuangOk, izinOk, simpanRuangOk } from "@/stores/penunjang/kamarOperasi";

// Datamaster Ruang OK: kode, nama, jam operasional. Ruang tidak aktif tidak bisa dipilih pada penjadwalan baru;
// jadwal yang sudah ada tetap tertaut.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinOk("Datamaster", aksi, "Ruang OK");

const data = ref<any[]>([]);
const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarRuangOk();
    data.value = res?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};

const dialog = ref(false);
const kosong = () => ({ uuid: "", kode: "", nama: "", jamMulai: "08:00", jamSelesai: "16:00", aktif: true });
const form = ref(kosong());
const galat = ref("");
const modeUbah = computed(() => !!form.value.uuid);
const buka = (baris?: any) => {
  galat.value = "";
  form.value = baris ? { ...kosong(), ...baris } : kosong();
  dialog.value = true;
};
const simpan = async () => {
  const f = form.value;
  galat.value = "";
  if (!f.kode.trim() || !f.nama.trim()) return (galat.value = "Kode dan nama ruang wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await simpanRuangOk({ kode: f.kode, nama: f.nama, jamMulai: f.jamMulai, jamSelesai: f.jamSelesai, aktif: f.aktif }, f.uuid || undefined);
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
  if (!akanDihapus.value) return;
  if (await hapusRuangOk(akanDihapus.value.uuid)) {
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
          <h1 class="toolbar-heading text-opensimrs-300">Ruang OK</h1>
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Ruang" @click="buka()" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 48rem">
          <Column field="kode" header="Kode" headerClass="bg-opensimrs-50" class="w-[100px] font-semibold" />
          <Column field="nama" header="Nama Ruang" headerClass="bg-opensimrs-50" />
          <Column header="Jam Operasional" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.jamMulai ?? "-" }}–{{ d.jamSelesai ?? "-" }}</template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><span :class="d.aktif ? 'text-mint-400' : 'text-grey-300'">{{ d.aktif ? "Aktif" : "Nonaktif" }}</span></template>
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
    </Card>

    <CustomDialog v-model:visible="dialog" width="520px">
      <template #header>{{ modeUbah ? "Ubah" : "Tambah" }} Ruang OK</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomTextfield v-model="form.kode" label="Kode Ruang" placeholder="mis. OK1" required :maxLength="50" />
          <CustomTextfield v-model="form.nama" label="Nama Ruang" placeholder="mis. Ruang Operasi 1" required :maxLength="150" />
          <CustomTextfield v-model="form.jamMulai" type="time" label="Jam Mulai Operasional" />
          <CustomTextfield v-model="form.jamSelesai" type="time" label="Jam Selesai Operasional" />
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
      <template #header>Nonaktifkan Ruang</template>
      <template #body>
        <div class="pt-4 text-normal">Nonaktifkan <b>{{ akanDihapus?.nama }}</b>? Ruang tidak bisa dipilih pada penjadwalan baru; jadwal yang sudah ada tetap tertaut.</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogHapus = false" />
          <CustomButton label="Nonaktifkan" icon="PhTrash" backgroundColor="bg-danger-300" @click="hapus" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
