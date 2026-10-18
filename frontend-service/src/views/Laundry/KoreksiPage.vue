<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { JENIS_KOREKSI, OPSI_KOREKSI, daftarKoreksiLaundry, izinLaundry, koreksiStokLaundry, referensiLaundry, waktuLaundry } from "@/stores/penunjang/laundry";

// Koreksi kehilangan, kerusakan, afkir (KF-12): transaksi keluar beralasan dari stok ruangan atau stok bersih
// laundry; jejak transaksi asal tidak dihapus. Ditolak bila melebihi saldo tercatat.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinLaundry("Koreksi Stok", aksi);
const ruangan = ref<any[]>([]);
const jenis = ref<any[]>([]);
const opsiRuangan = computed(() => ruangan.value.map((r) => ({ value: r.uuid, label: r.nama })));
const opsiJenis = computed(() => jenis.value.map((j) => ({ value: j.uuid, label: `${j.nama} (${j.satuan})` })));

const data = ref<any[]>([]);
const muat = async () => {
  if (!boleh("READ")) return;
  storeUtils.setLoading(true);
  try {
    data.value = (await daftarKoreksiLaundry())?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
onMounted(async () => {
  const r = (await referensiLaundry())?.payload;
  ruangan.value = r?.ruangan ?? [];
  jenis.value = r?.jenisLinen ?? [];
  muat();
});

const dialog = ref(false);
const form = ref<any>({});
const galat = ref("");
const buka = () => {
  galat.value = "";
  form.value = { lokasiTipe: "ruangan", lokasiUuid: "", jenisLinenUuid: "", jenisKoreksi: "hilang", jumlah: 1, alasan: "" };
  dialog.value = true;
};
const simpan = async () => {
  const f = form.value;
  if ((f.lokasiTipe === "ruangan" && !f.lokasiUuid) || !f.jenisLinenUuid) return (galat.value = "Lokasi dan jenis linen wajib dipilih");
  if (!f.alasan?.trim()) return (galat.value = "Alasan wajib diisi");
  storeUtils.setLoading(true);
  try {
    if (await koreksiStokLaundry({ ...f, lokasiUuid: f.lokasiTipe === "ruangan" ? f.lokasiUuid : undefined })) {
      dialog.value = false;
      muat();
    }
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
          <h1 class="toolbar-heading text-opensimrs-300">Koreksi Stok Linen</h1>
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Koreksi" @click="buka" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 50rem">
          <Column header="Waktu" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ waktuLaundry(d.waktuTransaksi) }}</template></Column>
          <Column header="Lokasi" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.lokasiTipe === "laundry" ? "Stok bersih laundry" : d.namaLokasi }}</template></Column>
          <Column field="namaLinen" header="Jenis Linen" headerClass="bg-opensimrs-50" />
          <Column header="Jenis Koreksi" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ JENIS_KOREKSI[d.jenisKoreksi] ?? d.jenisKoreksi }}</template></Column>
          <Column header="Jumlah" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ Number(d.jumlah) }}</template></Column>
          <Column field="alasan" header="Alasan" headerClass="bg-opensimrs-50" />
          <Column field="petugasUuid" header="Petugas" headerClass="bg-opensimrs-50" />
        </DataTable>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="540px">
      <template #header>Koreksi Stok Linen</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <CustomSelect
            v-model="form.lokasiTipe"
            label="Lokasi Stok"
            :options="[{ value: 'ruangan', label: 'Ruangan' }, { value: 'laundry', label: 'Stok bersih laundry' }]"
            optionValue="value"
            optionLabel="label"
          />
          <CustomSelect v-if="form.lokasiTipe === 'ruangan'" v-model="form.lokasiUuid" label="Ruangan" :options="opsiRuangan" optionValue="value" optionLabel="label" placeHolder="Pilih ruangan" />
          <CustomSelect v-model="form.jenisLinenUuid" label="Jenis Linen" :options="opsiJenis" optionValue="value" optionLabel="label" placeHolder="Pilih jenis linen" />
          <CustomSelect v-model="form.jenisKoreksi" label="Jenis Koreksi" :options="OPSI_KOREKSI" optionValue="value" optionLabel="label" />
          <CustomInputNumber v-model="form.jumlah" label="Jumlah" :min="1" />
          <CustomTextfield v-model="form.alasan" label="Alasan" required :maxLength="500" />
          <div v-if="galat" class="text-sm text-danger-300">{{ galat }}</div>
        </div>
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
