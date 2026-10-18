<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  JENIS_LAYANAN,
  METODE_TARIF,
  daftarTarif,
  epochDariTanggal,
  izinAmbulans,
  nonaktifkanTarif,
  opsi,
  rupiahAmbulans,
  simpanTarif,
  tanggalDariEpoch,
  waktuAmbulans,
} from "@/stores/penunjang/ambulans";

// Tarif layanan ambulans: per jenis layanan, kilometer, atau zona, dengan masa berlaku (KF-11/A5).
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinAmbulans("Tarif", aksi);

const data = ref<any[]>([]);
const filterJenis = ref("");
const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarTarif({ jenis_layanan: filterJenis.value });
    data.value = res?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
onMounted(muat);

// ── Form tarif (baru / ubah)
const dialog = ref(false);
const kosong = () => ({ uuid: "", jenisLayanan: "rujukan", metodeHitung: "jenis", nilai: 0, zona: "", berlakuMulai: new Date(), berlakuSampai: null as Date | null, aktif: true });
const form = ref(kosong());
const galat = ref("");
const buka = (baris?: any) => {
  galat.value = "";
  form.value = baris
    ? {
        uuid: baris.uuid,
        jenisLayanan: baris.jenisLayanan,
        metodeHitung: baris.metodeHitung,
        nilai: Number(baris.nilai),
        zona: baris.zona ?? "",
        berlakuMulai: tanggalDariEpoch(baris.berlakuMulai) ?? new Date(),
        berlakuSampai: tanggalDariEpoch(baris.berlakuSampai),
        aktif: baris.aktif,
      }
    : kosong();
  dialog.value = true;
};
const simpan = async () => {
  const f = form.value;
  galat.value = "";
  if (f.metodeHitung === "zona" && !f.zona.trim()) return (galat.value = "Zona wajib diisi untuk metode zona");
  if (f.nilai < 0) return (galat.value = "Nilai tarif tidak boleh negatif");
  storeUtils.setLoading(true);
  try {
    const res = await simpanTarif(
      {
        jenisLayanan: f.jenisLayanan,
        metodeHitung: f.metodeHitung,
        nilai: f.nilai,
        zona: f.metodeHitung === "zona" ? f.zona.trim() : undefined,
        berlakuMulai: epochDariTanggal(f.berlakuMulai),
        berlakuSampai: epochDariTanggal(f.berlakuSampai || undefined),
        aktif: f.aktif,
      },
      f.uuid || undefined,
    );
    if (res) {
      dialog.value = false;
      muat();
    } else galat.value = "Gagal menyimpan tarif";
  } finally {
    storeUtils.setLoading(false);
  }
};

const dialogNonaktif = ref(false);
const akanDinonaktifkan = ref<any>(null);
const nonaktifkan = async () => {
  if (!akanDinonaktifkan.value) return;
  const res = await nonaktifkanTarif(akanDinonaktifkan.value.uuid);
  if (res) {
    dialogNonaktif.value = false;
    muat();
  }
};
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Tarif Layanan Ambulans</h1>
          <CustomSelect v-model="filterJenis" label="Jenis Layanan" placeHolder="Semua" :options="opsi(JENIS_LAYANAN)" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="muat" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Tarif" @click="buka()" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 55rem">
          <Column header="Jenis Layanan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ JENIS_LAYANAN[d.jenisLayanan] ?? d.jenisLayanan }}</template>
          </Column>
          <Column header="Metode" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ METODE_TARIF[d.metodeHitung] ?? d.metodeHitung }}</template>
          </Column>
          <Column header="Nilai" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ rupiahAmbulans(d.nilai) }}{{ d.metodeHitung === "per_km" ? " / km" : "" }}</template>
          </Column>
          <Column header="Zona" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.zona ?? "-" }}</template>
          </Column>
          <Column header="Masa Berlaku" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ waktuAmbulans(d.berlakuMulai, true) }} s.d. {{ d.berlakuSampai ? waktuAmbulans(d.berlakuSampai, true) : "-" }}</template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><span :class="d.aktif ? 'text-mint-400' : 'text-grey-300'">{{ d.aktif ? "Aktif" : "Nonaktif" }}</span></template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[110px]">
            <template #body="{ data: d }">
              <div class="flex gap-2">
                <CustomButton v-if="boleh('UPDATE')" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="buka(d)" />
                <CustomButton
                  v-if="boleh('UPDATE') && d.aktif"
                  icon="PhProhibit"
                  size="small"
                  outlined
                  borderColor="border-danger-300"
                  textColor="text-danger-300"
                  @click="(akanDinonaktifkan = d), (dialogNonaktif = true)"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="640px">
      <template #header>{{ form.uuid ? "Ubah" : "Tambah" }} Tarif</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomSelect v-model="form.jenisLayanan" label="Jenis Layanan" :options="opsi(JENIS_LAYANAN)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" required />
          <CustomSelect v-model="form.metodeHitung" label="Metode Hitung" :options="opsi(METODE_TARIF)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" required />
          <CustomInputNumber v-model="form.nilai" label="Nilai (Rp)" :min="0" required />
          <CustomTextfield v-model="form.zona" label="Zona" :disabled="form.metodeHitung !== 'zona'" :required="form.metodeHitung === 'zona'" :maxLength="100" />
          <CustomDatePicker v-model="form.berlakuMulai" label="Berlaku Mulai" required />
          <CustomDatePicker v-model="form.berlakuSampai" label="Berlaku Sampai (opsional)" />
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

    <CustomDialog v-model:visible="dialogNonaktif" width="420px" headerBg="bg-danger-300">
      <template #header>Nonaktifkan Tarif</template>
      <template #body>
        <div class="pt-4">Nonaktifkan tarif <b>{{ JENIS_LAYANAN[akanDinonaktifkan?.jenisLayanan] }}</b> ({{ METODE_TARIF[akanDinonaktifkan?.metodeHitung] }})?</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogNonaktif = false" />
          <CustomButton label="Nonaktifkan" backgroundColor="bg-danger-300" @click="nonaktifkan" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
