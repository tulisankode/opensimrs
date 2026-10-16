<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { daftarSetCssd, gayaSetCssd, izinCssd, opsi, penerimaanKotorCssd, referensiPilihanCssd, referensiUnitCssd, waktuRingkas } from "@/stores/penunjang/cssd";

// Penerimaan alat kotor dari unit: alur pemindaian barcode berurutan (fokus pindah otomatis ke field berikutnya
// setelah Enter) agar petugas tidak banyak klik mouse saat memproses banyak set berturut-turut (NF-7).
const storeUtils = utilsStore();
const boleh = izinCssd("Penerimaan & Dekontaminasi", "CREATE");

const unit = ref<any[]>([]);
const kondisiPilihan = ref<Record<string, string>>({});
const kodeBarcode = ref("");
const barcodeInput = ref<HTMLInputElement>();
const form = ref({ unitAsalUuid: "", kondisi: "baik", catatanKondisi: "", petugasSerahUuid: "", petugasTerimaUuid: "" });
const galat = ref("");
const riwayat = ref<any[]>([]);

const muatRiwayat = async () => {
  riwayat.value = (await daftarSetCssd({ limit: 20 }))?.payload?.data ?? [];
};

onMounted(async () => {
  unit.value = (await referensiUnitCssd())?.payload ?? [];
  const ref1 = await referensiPilihanCssd();
  kondisiPilihan.value = ref1?.payload?.kondisiSerah ?? {};
  muatRiwayat();
  barcodeInput.value?.focus();
});

const simpan = async () => {
  galat.value = "";
  if (!kodeBarcode.value.trim()) return (galat.value = "Pindai atau isi kode barcode set");
  if (!form.value.unitAsalUuid) return (galat.value = "Unit asal wajib dipilih");
  storeUtils.setLoading(true);
  try {
    const res = await penerimaanKotorCssd({ kodeBarcode: kodeBarcode.value.trim(), ...form.value });
    if (res) {
      kodeBarcode.value = "";
      muatRiwayat();
      barcodeInput.value?.focus();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
</script>

<template>
  <div class="flex flex-col h-full gap-3 overflow-auto">
    <Card>
      <template #header>
        <PageToolbar>
          <h1 class="toolbar-heading text-opensimrs-300">Penerimaan Alat Kotor dari Unit</h1>
        </PageToolbar>
      </template>
      <template #content>
        <div class="grid grid-cols-2 gap-4">
          <label class="flex flex-col gap-1 text-sm font-semibold">
            Kode Barcode/QR Set <span class="text-danger-300">*</span>
            <input
              ref="barcodeInput"
              v-model="kodeBarcode"
              type="text"
              placeholder="Pindai atau ketik kode barcode"
              class="px-3 py-2 text-sm font-normal border rounded-lg border-grey-200"
              @keydown.enter.prevent="simpan"
            />
          </label>
          <CustomSelect v-model="form.unitAsalUuid" label="Unit Asal" :options="unit.map((u: any) => ({ value: u.uuid, label: u.nama }))" optionValue="value" optionLabel="label" placeHolder="Pilih unit" />
          <CustomSelect v-model="form.kondisi" label="Kondisi" :options="opsi(kondisiPilihan)" optionValue="value" optionLabel="label" :clearable="false" :showFilter="false" />
          <CustomTextfield v-model="form.petugasSerahUuid" label="Petugas Penyerah (unit)" :maxLength="255" />
          <CustomTextfield v-model="form.petugasTerimaUuid" label="Petugas Penerima (CSSD)" :maxLength="255" />
          <CustomTextArea v-model="form.catatanKondisi" label="Catatan Kondisi" class="col-span-2" />
        </div>
        <div v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</div>
        <div class="flex justify-end mt-4">
          <CustomButton v-if="boleh" label="Catat Serah Terima" icon="PhCheck" @click="simpan" />
        </div>
      </template>
    </Card>

    <Card class="flex-1 overflow-hidden">
      <template #header>
        <h2 class="px-5 pt-4 font-semibold">Set Terbaru</h2>
      </template>
      <template #content>
        <NoData v-if="!riwayat.length" />
        <DataTable v-else :value="riwayat" stripedRows class="text-xs" scrollable scrollHeight="flex">
          <Column header="Set" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.namaSet }}</div>
              <div class="text-grey-400">{{ d.kodeSetFisik }} · {{ d.kodeBarcode }}</div>
            </template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaSetCssd(d.status)?.bg, gayaSetCssd(d.status)?.text]">{{ gayaSetCssd(d.status)?.label }}</span>
            </template>
          </Column>
          <Column header="Lokasi" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.lokasiTipe === "cssd" ? "CSSD" : "Unit" }}</template>
          </Column>
          <Column header="Diperbarui" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ waktuRingkas(d.updatedAt) }}</template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>
