<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import { utilsStore } from "@/stores/utils";
import { KELAS_OPERASI, keTanggalOk, rekapOk } from "@/stores/penunjang/kamarOperasi";

// Rekap operasi per periode: jumlah per operator, per kelas operasi (kecil/sedang/besar/khusus), dan persentase
// pembatalan jadwal terhadap total jadwal pada periode yang dipilih (KF-20/KT-20).
const storeUtils = utilsStore();
const tglMulai = ref<Date | null>(new Date(new Date().setDate(1)));
const tglSelesai = ref<Date | null>(new Date());
const hasil = ref<any>(null);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await rekapOk({ tanggalDari: tglMulai.value ? keTanggalOk(tglMulai.value) : undefined, tanggalSampai: tglSelesai.value ? keTanggalOk(tglSelesai.value) : undefined });
    hasil.value = res?.payload ?? null;
  } finally {
    storeUtils.setLoading(false);
  }
};
onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <h1 class="toolbar-heading text-opensimrs-300">Rekap Operasi</h1>
          <CustomDatePicker v-model="tglMulai" label="Tanggal mulai" class="toolbar-field--date" :maxDate="tglSelesai ?? undefined" />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker v-model="tglSelesai" label="Tanggal selesai" class="toolbar-field--date" :minDate="tglMulai ?? undefined" />
          <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" @click="muat" />
        </PageToolbar>
      </template>
      <template #content>
        <div v-if="hasil" class="flex flex-col gap-5 p-4 text-sm">
          <div class="grid grid-cols-3 gap-4">
            <div class="p-4 text-center rounded-lg bg-opensimrs-50">
              <div class="text-2xl font-bold text-opensimrs-400">{{ hasil.total }}</div>
              <div class="text-grey-400">Total Jadwal Operasi</div>
            </div>
            <div class="p-4 text-center rounded-lg bg-danger-50">
              <div class="text-2xl font-bold text-danger-400">{{ hasil.pembatalan.jumlah }}</div>
              <div class="text-grey-400">Jadwal Dibatalkan</div>
            </div>
            <div class="p-4 text-center rounded-lg bg-warning-50">
              <div class="text-2xl font-bold text-warning-500">{{ hasil.pembatalan.persentase }}%</div>
              <div class="text-grey-400">Persentase Pembatalan</div>
            </div>
          </div>
          <div>
            <h3 class="mb-2 font-semibold">Per Kelas Operasi</h3>
            <DataTable :value="hasil.perKelas" class="text-xs" stripedRows>
              <Column header="Kelas Operasi" headerClass="bg-opensimrs-50">
                <template #body="{ data: d }">{{ KELAS_OPERASI[d.kelasOperasi as keyof typeof KELAS_OPERASI] ?? d.kelasOperasi }}</template>
              </Column>
              <Column field="jumlah" header="Jumlah Selesai" headerClass="bg-opensimrs-50" />
            </DataTable>
          </div>
          <div>
            <h3 class="mb-2 font-semibold">Per Operator</h3>
            <DataTable :value="hasil.perOperator" class="text-xs" stripedRows>
              <Column field="nama" header="Operator" headerClass="bg-opensimrs-50" />
              <Column field="jumlah" header="Jumlah Operasi Selesai" headerClass="bg-opensimrs-50" />
            </DataTable>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
