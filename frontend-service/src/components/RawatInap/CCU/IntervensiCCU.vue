<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import NoData from "@/components/section/NoData.vue";
import DialogBatalEntri from "@/components/RawatInap/CCU/DialogBatalEntri.vue";
import { utilsStore } from "@/stores/utils";
import { useCcuStore, LABEL_INTERVENSI, opsi, tampilWaktu } from "@/stores/rawatInap/ccu";

// Intervensi & terapi kardiak (PCI primer, trombolisis, pacu jantung sementara, IABP, kardioversi/defibrilasi, RJP).
// Waktu mulai dipakai laporan door-to-balloon/needle. Order obat/tindakan & tagihan tetap lewat modul pemiliknya.
const props = defineProps<{ perawatanUuid: string; aktif: boolean }>();
const storeUtils = utilsStore();
const ccuStore = useCcuStore();

const riwayat = ref<any[]>([]);
const kosong = () => ({
  jenis: "pci_primer",
  waktuMulai: new Date(),
  waktuSelesai: null as Date | null,
  operator: "",
  hasil: "",
  komplikasi: "",
  catatan: "",
});
const form = ref(kosong());
const galat = ref("");

const muat = async () => {
  if (!props.perawatanUuid) return;
  const res = await ccuStore.getIntervensi(props.perawatanUuid);
  riwayat.value = res?.payload ?? [];
};

const simpan = async () => {
  galat.value = "";
  const f = form.value;
  if (!f.waktuMulai) return (galat.value = "Waktu mulai wajib diisi");
  if (f.waktuSelesai && f.waktuSelesai < f.waktuMulai) return (galat.value = "Waktu selesai tidak boleh sebelum waktu mulai");
  storeUtils.setLoading(true);
  try {
    const res = await ccuStore.tambahIntervensi(props.perawatanUuid, {
      jenis: f.jenis,
      waktuMulai: Math.floor(f.waktuMulai.getTime() / 1000),
      waktuSelesai: f.waktuSelesai ? Math.floor(f.waktuSelesai.getTime() / 1000) : null,
      operator: f.operator || undefined,
      hasil: f.hasil || undefined,
      komplikasi: f.komplikasi || undefined,
      catatan: f.catatan || undefined,
    });
    if (res?.payload) {
      form.value = kosong();
      await muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const dialogBatal = ref(false);
const dibatalkan = ref<any>(null);
const bukaBatal = (d: any) => {
  dibatalkan.value = d;
  dialogBatal.value = true;
};
const simpanBatal = async (alasan: string) => {
  storeUtils.setLoading(true);
  try {
    const res = await ccuStore.batalIntervensi(dibatalkan.value.uuid, alasan);
    if (res?.payload) {
      dialogBatal.value = false;
      await muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

watch(() => props.perawatanUuid, muat);
onMounted(muat);
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="aktif" class="p-4 border rounded-lg border-grey-75">
      <div class="mb-2 font-semibold">Intervensi / Terapi Kardiak Baru</div>
      <div class="grid grid-cols-4 gap-3">
        <CustomSelect v-model="form.jenis" label="Jenis intervensi" :options="opsi(LABEL_INTERVENSI)" optionValue="value" optionLabel="label" :clearable="false" />
        <CustomDatePicker v-model="form.waktuMulai" label="Waktu mulai" showTime />
        <CustomDatePicker v-model="form.waktuSelesai" label="Waktu selesai" showTime />
        <CustomTextfield v-model="form.operator" label="Operator / pelaksana" />
        <CustomTextArea v-model="form.hasil" label="Hasil (mis. TIMI flow, lesi, stent)" class="col-span-2" />
        <CustomTextArea v-model="form.komplikasi" label="Komplikasi" class="col-span-2" />
        <CustomTextArea v-model="form.catatan" label="Catatan" class="col-span-4" />
      </div>
      <div v-if="galat" class="mt-2 text-sm text-danger-300">{{ galat }}</div>
      <div class="flex justify-end mt-3">
        <CustomButton label="Simpan Intervensi" icon="PhPlus" @click="simpan" />
      </div>
    </div>

    <NoData v-if="!riwayat.length" />
    <DataTable v-else :value="riwayat" stripedRows class="text-xs">
      <Column header="Intervensi" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ LABEL_INTERVENSI[d.jenis] ?? d.jenis }}</template></Column>
      <Column header="Mulai / Selesai" headerClass="bg-opensimrs-50">
        <template #body="{ data: d }">{{ tampilWaktu(d.waktuMulai) }} – {{ tampilWaktu(d.waktuSelesai) }}</template>
      </Column>
      <Column header="Operator" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.operator ?? "-" }}</template></Column>
      <Column header="Hasil / Komplikasi" headerClass="bg-opensimrs-50">
        <template #body="{ data: d }">{{ d.hasil ?? "-" }}<div v-if="d.komplikasi" class="text-danger-400">Komplikasi: {{ d.komplikasi }}</div></template>
      </Column>
      <Column header="Pencatat" headerClass="bg-opensimrs-50">
        <template #body="{ data: d }">
          {{ d.pencatat }}
          <div v-if="d.dibatalkanPada" class="text-[10px] font-semibold text-warning-400">Dibatalkan {{ d.dibatalkanOleh }}: {{ d.alasanBatal }}</div>
        </template>
      </Column>
      <Column header="" headerClass="bg-opensimrs-50">
        <template #body="{ data: d }">
          <CustomButton v-if="!d.dibatalkanPada" label="Batalkan" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="bukaBatal(d)" />
        </template>
      </Column>
    </DataTable>

    <DialogBatalEntri v-model:visible="dialogBatal" judul="Batalkan Intervensi Kardiak" @simpan="simpanBatal" />
  </div>
</template>
