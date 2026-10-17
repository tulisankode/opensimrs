<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { catatBowieDickCssd, daftarMesinCssd, izinCssd, opsi, referensiPilihanCssd, riwayatBowieDickCssd, simpanMesinCssd } from "@/stores/penunjang/cssd";

// Master mesin sterilisasi + uji Bowie-Dick harian (mesin autoklaf wajib lulus uji hari ini sebelum dipakai
// membuat load baru — ditegakkan backend saat POST /cssd/load).
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinCssd("Master Set & Mesin", aksi);
const bolehBowieDick = izinCssd("Siklus Sterilisasi", "BOWIE DICK");

const data = ref<any[]>([]);
const metode = ref<Record<string, string>>({});

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    data.value = (await daftarMesinCssd())?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
onMounted(async () => {
  const ref1 = await referensiPilihanCssd();
  metode.value = Object.fromEntries((ref1?.payload?.metode ?? []).map((m: any) => [m.kode, m.nama]));
  muat();
});

// ── Form mesin
const dialog = ref(false);
const kosong = () => ({ uuid: "", namaMesin: "", nomorSeri: "", metode: "autoklaf", statusAktif: true });
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
  if (!f.namaMesin?.trim()) return (galat.value = "Nama mesin wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await simpanMesinCssd({ namaMesin: f.namaMesin, nomorSeri: f.nomorSeri, metode: f.metode, statusAktif: f.statusAktif }, f.uuid || undefined);
    if (res) {
      dialog.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Bowie-Dick
const dialogBd = ref(false);
const mesinAktif = ref<any>(null);
const riwayat = ref<any[]>([]);
const formBd = ref({ tanggal: new Date().toISOString().slice(0, 10), hasil: "lulus", catatan: "" });
const bukaBd = async (baris: any) => {
  mesinAktif.value = baris;
  formBd.value = { tanggal: new Date().toISOString().slice(0, 10), hasil: "lulus", catatan: "" };
  riwayat.value = (await riwayatBowieDickCssd(baris.uuid))?.payload ?? [];
  dialogBd.value = true;
};
const simpanBd = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await catatBowieDickCssd(mesinAktif.value.uuid, formBd.value);
    if (res) riwayat.value = (await riwayatBowieDickCssd(mesinAktif.value.uuid))?.payload ?? [];
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
          <h1 class="toolbar-heading text-opensimrs-300">Mesin Sterilisasi</h1>
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Mesin" @click="buka()" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs">
          <Column field="namaMesin" header="Nama Mesin" headerClass="bg-opensimrs-50" />
          <Column field="nomorSeri" header="Nomor Seri" headerClass="bg-opensimrs-50" />
          <Column header="Metode" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ metode[d.metode] ?? d.metode }}</template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span :class="d.statusAktif ? 'text-mint-400' : 'text-grey-300'">{{ d.statusAktif ? "Aktif" : "Nonaktif" }}</span>
            </template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[260px]">
            <template #body="{ data: d }">
              <div class="flex gap-2">
                <CustomButton v-if="bolehBowieDick" label="Bowie-Dick" icon="PhFlask" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaBd(d)" />
                <CustomButton v-if="boleh('UPDATE')" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="buka(d)" />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="560px">
      <template #header>{{ modeUbah ? "Ubah" : "Tambah" }} Mesin</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomTextfield v-model="form.namaMesin" label="Nama Mesin" placeholder="mis. Autoklaf 1" required class="col-span-2" :maxLength="150" />
          <CustomTextfield v-model="form.nomorSeri" label="Nomor Seri" :maxLength="100" />
          <CustomSelect v-model="form.metode" label="Metode" :options="opsi(metode)" optionValue="value" optionLabel="label" :clearable="false" :showFilter="false" />
          <CustomSwitch v-model="form.statusAktif" label="Status" sideLabel="Nonaktif" sideLabelTrue="Aktif" />
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

    <CustomDialog v-model:visible="dialogBd" width="620px">
      <template #header>Uji Bowie-Dick — {{ mesinAktif?.namaMesin }}</template>
      <template #body>
        <div class="flex flex-col gap-4 pt-4">
          <div class="text-xs text-grey-400">
            Mesin autoklaf wajib memiliki hasil Bowie-Dick <b>lulus</b> pada hari berjalan sebelum dapat dipakai untuk load baru (kebijakan keselamatan CSSD).
          </div>
          <div class="grid grid-cols-3 gap-3">
            <label class="flex flex-col gap-1 text-sm font-semibold">
              Tanggal
              <input v-model="formBd.tanggal" type="date" class="px-3 py-2 text-sm font-normal border rounded-lg border-grey-200" />
            </label>
            <CustomSelect v-model="formBd.hasil" label="Hasil" :options="[{ value: 'lulus', label: 'Lulus' }, { value: 'gagal', label: 'Gagal' }]" optionValue="value" optionLabel="label" :clearable="false" :showFilter="false" />
            <div class="flex items-end">
              <CustomButton v-if="bolehBowieDick" label="Simpan" icon="PhFloppyDisk" @click="simpanBd" />
            </div>
          </div>
          <CustomTextArea v-model="formBd.catatan" label="Catatan" />
          <h3 class="text-sm font-semibold">Riwayat</h3>
          <NoData v-if="!riwayat.length" />
          <DataTable v-else :value="riwayat" stripedRows class="text-xs">
            <Column field="tanggal" header="Tanggal" headerClass="bg-opensimrs-50" />
            <Column header="Hasil" headerClass="bg-opensimrs-50">
              <template #body="{ data: d }"><span :class="d.hasil === 'lulus' ? 'text-mint-400' : 'text-danger-300'">{{ d.hasil === "lulus" ? "Lulus" : "Gagal" }}</span></template>
            </Column>
            <Column field="catatan" header="Catatan" headerClass="bg-opensimrs-50" />
          </DataTable>
        </div>
      </template>
      <template #footer>
        <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogBd = false" />
      </template>
    </CustomDialog>
  </div>
</template>
