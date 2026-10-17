<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { catatDekontaminasiCssd, daftarSetCssd, gayaSetCssd, izinCssd, ubahStatusSetCssd, waktuRingkas } from "@/stores/penunjang/cssd";

// Dekontaminasi, pemeriksaan kelengkapan instrumen & pengemasan (alur utama #3-4, A1 untuk set tidak lengkap/rusak).
const storeUtils = utilsStore();
const boleh = izinCssd("Penerimaan & Dekontaminasi", "CREATE");
const bolehUbahStatus = izinCssd("Penyimpanan & Distribusi", "UPDATE STATUS");

const antrian = ref<any[]>([]);
const muatAntrian = async () => {
  antrian.value = (await daftarSetCssd({ status: ["kotor", "dekontaminasi"], limit: 50 }))?.payload?.data ?? [];
};
onMounted(muatAntrian);

const kodeBarcode = ref("");
const barcodeInput = ref<HTMLInputElement>();
const setAktif = ref<any>(null);
const galatCari = ref("");
const cariSet = async () => {
  galatCari.value = "";
  setAktif.value = null;
  const kode = kodeBarcode.value.trim();
  if (!kode) return (galatCari.value = "Pindai atau isi kode barcode set");
  const hasil = (await daftarSetCssd({ q: kode, limit: 5 }))?.payload?.data ?? [];
  const cocok = hasil.find((s: any) => s.kodeBarcode === kode) ?? hasil[0];
  if (!cocok) return (galatCari.value = `Barcode ${kode} tidak dikenal; periksa label atau cari set secara manual`);
  setAktif.value = cocok;
};

const kosong = () => ({ hasilKelengkapan: "lengkap", instrumenKurang: "", catatan: "", petugasUuid: "", langsungDikemas: true, petugasPengemasanUuid: "" });
const form = ref(kosong());
const galat = ref("");

const simpan = async () => {
  galat.value = "";
  if (!setAktif.value) return (galat.value = "Pindai set terlebih dahulu");
  const f = form.value;
  const instrumenKurang = f.instrumenKurang
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (f.hasilKelengkapan === "tidak_lengkap" && !instrumenKurang.length && !f.catatan.trim()) {
    return (galat.value = "Isi instrumen yang kurang/rusak atau catatan bila kelengkapan tidak lengkap");
  }
  storeUtils.setLoading(true);
  try {
    const waktu = Math.floor(Date.now() / 1000);
    const res = await catatDekontaminasiCssd(setAktif.value.uuid, {
      waktuMulai: waktu,
      waktuSelesai: waktu,
      hasilKelengkapan: f.hasilKelengkapan,
      instrumenKurang,
      catatan: f.catatan,
      petugasUuid: f.petugasUuid,
      ...(f.hasilKelengkapan === "lengkap" && f.langsungDikemas ? { waktuPengemasan: waktu, petugasPengemasanUuid: f.petugasPengemasanUuid } : {}),
    });
    if (res) {
      setAktif.value = null;
      kodeBarcode.value = "";
      form.value = kosong();
      muatAntrian();
      barcodeInput.value?.focus();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// Status manual (dikarantina/hilang/rusak) — di luar alur otomatis load (aturan bisnis #4).
const tandaiStatus = async (status: string) => {
  storeUtils.setLoading(true);
  try {
    const res = await ubahStatusSetCssd(setAktif.value.uuid, status);
    if (res) {
      setAktif.value = null;
      kodeBarcode.value = "";
      muatAntrian();
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
          <h1 class="toolbar-heading text-opensimrs-300">Dekontaminasi, Kelengkapan & Pengemasan</h1>
        </PageToolbar>
      </template>
      <template #content>
        <div class="grid grid-cols-3 gap-3">
          <label class="flex flex-col gap-1 text-sm font-semibold col-span-2">
            Kode Barcode/QR Set <span class="text-danger-300">*</span>
            <input
              ref="barcodeInput"
              v-model="kodeBarcode"
              type="text"
              placeholder="Pindai atau ketik kode barcode"
              class="px-3 py-2 text-sm font-normal border rounded-lg border-grey-200"
              @keydown.enter.prevent="cariSet"
            />
          </label>
          <div class="flex items-end"><CustomButton label="Cari Set" icon="PhMagnifyingGlass" @click="cariSet" /></div>
        </div>
        <div v-if="galatCari" class="mt-2 text-sm text-danger-300">{{ galatCari }}</div>

        <template v-if="setAktif">
          <div class="flex items-center gap-2 p-3 mt-3 border rounded-lg border-grey-100 bg-grey-25">
            <div class="font-semibold">{{ setAktif.namaSet }}</div>
            <div class="text-grey-400">{{ setAktif.kodeSetFisik }} · {{ setAktif.kodeBarcode }}</div>
            <span class="px-2 py-0.5 ml-auto rounded-full text-[10px] font-semibold" :class="[gayaSetCssd(setAktif.status)?.bg, gayaSetCssd(setAktif.status)?.text]">
              {{ gayaSetCssd(setAktif.status)?.label }}
            </span>
          </div>

          <div class="grid grid-cols-2 gap-4 mt-4">
            <CustomSelect
              v-model="form.hasilKelengkapan"
              label="Hasil Pemeriksaan Kelengkapan"
              :options="[{ value: 'lengkap', label: 'Lengkap' }, { value: 'tidak_lengkap', label: 'Tidak Lengkap / Rusak' }]"
              optionValue="value"
              optionLabel="label"
              :clearable="false"
              :showFilter="false"
            />
            <CustomTextfield v-model="form.petugasUuid" label="Petugas Dekontaminasi" :maxLength="255" />
            <CustomTextArea v-model="form.instrumenKurang" label="Instrumen Kurang/Rusak (pisahkan koma)" class="col-span-2" :disabled="form.hasilKelengkapan === 'lengkap'" />
            <CustomTextArea v-model="form.catatan" label="Catatan" class="col-span-2" />
            <template v-if="form.hasilKelengkapan === 'lengkap'">
              <CustomSwitch v-model="form.langsungDikemas" label="Langsung Dikemas" sideLabel="Belum" sideLabelTrue="Ya" />
              <CustomTextfield v-if="form.langsungDikemas" v-model="form.petugasPengemasanUuid" label="Petugas Pengemasan" :maxLength="255" />
            </template>
          </div>
          <div v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</div>
          <div class="flex items-center justify-between mt-4">
            <div v-if="bolehUbahStatus" class="flex gap-2">
              <CustomButton label="Tandai Dikarantina" size="small" outlined borderColor="border-warning-300" textColor="text-warning-300" @click="tandaiStatus('dikarantina')" />
              <CustomButton label="Tandai Hilang" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="tandaiStatus('hilang')" />
              <CustomButton label="Tandai Rusak" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="tandaiStatus('rusak')" />
            </div>
            <CustomButton v-if="boleh" label="Simpan" icon="PhCheck" @click="simpan" />
          </div>
        </template>
      </template>
    </Card>

    <Card class="flex-1 overflow-hidden">
      <template #header>
        <div class="flex items-center justify-between px-5 pt-4">
          <h2 class="font-semibold">Antrian Dekontaminasi & Kemas</h2>
          <CustomButton icon="PhArrowClockwise" size="small" @click="muatAntrian" />
        </div>
      </template>
      <template #content>
        <NoData v-if="!antrian.length" />
        <DataTable v-else :value="antrian" stripedRows class="text-xs" scrollable scrollHeight="flex">
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
          <Column header="Diperbarui" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ waktuRingkas(d.updatedAt) }}</template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>
