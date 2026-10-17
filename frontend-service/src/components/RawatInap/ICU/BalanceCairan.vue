<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { useIcuStore } from "@/stores/rawatInap/icu";

// Balance cairan: entri intake/output terpisah (KF-8), dihitung otomatis per periode (KF-9), ditandai belum lengkap
// bila periode belum berakhir atau belum ada entri (KF-10). Definisi jam-kosong final menunggu ketetapan pemilik
// klinis — lihat catatan di rawat-inap-service/src/repositories/icu-repository.js.
const props = defineProps<{ perawatanUuid: string }>();
const storeUtils = utilsStore();
const icuStore = useIcuStore();

const kosongForm = () => ({
  waktuPencatatan: new Date(),
  jenis: "intake" as "intake" | "output",
  kategori: "",
  jumlahMl: null as number | null,
  keterangan: "",
});
const form = ref(kosongForm());
const galat = ref("");

const dari = ref<Date>(new Date(Date.now() - 24 * 60 * 60 * 1000));
const sampai = ref<Date>(new Date());
const balance = ref<any>(null);

const simpan = async () => {
  galat.value = "";
  if (!form.value.kategori.trim()) return (galat.value = "Kategori wajib diisi");
  if (!form.value.jumlahMl || form.value.jumlahMl < 0) return (galat.value = "Jumlah (mL) wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await icuStore.tambahIntakeOutput(props.perawatanUuid, {
      waktuPencatatan: Math.floor(form.value.waktuPencatatan.getTime() / 1000),
      jenis: form.value.jenis,
      kategori: form.value.kategori,
      jumlahMl: form.value.jumlahMl,
      keterangan: form.value.keterangan || undefined,
    });
    if (res?.payload) {
      form.value = kosongForm();
      await muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const muat = async () => {
  if (!props.perawatanUuid) return;
  storeUtils.setLoading(true);
  try {
    const res = await icuStore.getBalance(
      props.perawatanUuid,
      Math.floor(dari.value.getTime() / 1000),
      Math.floor(sampai.value.getTime() / 1000),
    );
    balance.value = res?.payload ?? null;
  } finally {
    storeUtils.setLoading(false);
  }
};

watch(() => props.perawatanUuid, muat);
onMounted(muat);
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="p-4 border rounded-lg border-grey-75">
      <div class="mb-2 font-semibold">Catat Intake / Output</div>
      <div class="grid grid-cols-4 gap-3">
        <CustomDatePicker v-model="form.waktuPencatatan" label="Waktu" showTime />
        <CustomSelect v-model="form.jenis" label="Jenis" :options="[{ label: 'Intake', value: 'intake' }, { label: 'Output', value: 'output' }]" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
        <CustomTextfield v-model="form.kategori" label="Kategori" placeholder="mis. Infus RL / Urine / Drain" :maxLength="100" />
        <CustomTextfield v-model.number="form.jumlahMl" label="Jumlah (mL)" type="number" />
        <CustomTextArea v-model="form.keterangan" label="Keterangan" class="col-span-4" />
      </div>
      <div v-if="galat" class="mt-2 text-sm text-danger-300">{{ galat }}</div>
      <div class="flex justify-end mt-3">
        <CustomButton label="Simpan Entri" icon="PhPlus" @click="simpan" />
      </div>
    </div>

    <div class="p-4 border rounded-lg border-grey-75">
      <div class="flex items-end gap-3 mb-3">
        <CustomDatePicker v-model="dari" label="Dari" showTime />
        <CustomDatePicker v-model="sampai" label="Sampai" showTime />
        <CustomButton label="Hitung Balance" icon="PhCalculator" @click="muat" />
      </div>
      <NoData v-if="!balance" />
      <div v-else class="flex flex-col gap-3">
        <div v-if="!balance.lengkap" class="px-3 py-2 text-xs font-semibold rounded bg-warning-50 text-warning-400">
          Data periode ini belum lengkap: {{ balance.rentangKurang?.keterangan }}
        </div>
        <div class="grid grid-cols-3 gap-3 text-sm">
          <div class="p-3 text-center border rounded-lg border-grey-75"><div class="text-grey-400">Total Intake</div><div class="text-lg font-semibold">{{ balance.totalIntake }} mL</div></div>
          <div class="p-3 text-center border rounded-lg border-grey-75"><div class="text-grey-400">Total Output</div><div class="text-lg font-semibold">{{ balance.totalOutput }} mL</div></div>
          <div class="p-3 text-center border rounded-lg border-grey-75"><div class="text-grey-400">Balance</div><div class="text-lg font-semibold" :class="balance.balance < 0 ? 'text-danger-300' : 'text-opensimrs-300'">{{ balance.balance }} mL</div></div>
        </div>
        <DataTable :value="balance.entri" stripedRows class="text-xs">
          <Column header="Waktu" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ new Date(d.waktuPencatatan * 1000).toLocaleString("id-ID") }}</template></Column>
          <Column header="Jenis" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.jenis === "intake" ? "Intake" : "Output" }}</template></Column>
          <Column header="Kategori" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.kategori }}</template></Column>
          <Column header="Jumlah" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.jumlahMl }} mL</template></Column>
          <Column header="Pencatat" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.pencatat }}</template></Column>
        </DataTable>
      </div>
    </div>
  </div>
</template>
