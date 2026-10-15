<script setup lang="ts">
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import NoData from "@/components/section/NoData.vue";
import { computed, ref } from "vue";
import { epochToDate } from "@/utils/Helpers";
import DialogCardObat from "@/components/RekamMedis/OrderObat/DialogCardObat.vue";

const props = defineProps({
  patientData: {
    type: Object,
    required: true,
  },
  historyItem: {
    type: Object,
    default: null,
  },
  filterJenisKunjungan: {
    type: String,
    default: 'semua',
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  canGoToPrevious: Boolean,
  canGoToNext: Boolean,
});

const emit = defineEmits([
  "update:filter", 
  "next", 
  "previous"
]);

const isDetailDialogVisible = ref(false);
const selectedObatDetail = ref<any>(null);

function showDetail(resep: any) {
  selectedObatDetail.value = {
    dokterOrder: resep.meta.petugasName,
    orderDate: resep.meta.createdAt,
    lokasiStokNama: resep.meta.lokasiName ?? 'N/A',
    isTakeaway: resep.meta.isTakeaway ?? false,
    obatItems: resep.data
  };
  isDetailDialogVisible.value = true;
}


const optionsJenisKunjungan = ref([
  { label: 'Semua', value: 'semua' },
  { label: 'RJ', value: 'rj' },
  { label: 'RI', value: 'ri' },
  { label: 'IGD', value: 'igd' },
]);

const dataObatTable = computed(() => {
  return props.historyItem?.data || [];
});

const jenisKunjunganLabel = computed(() => {
  if (!props.historyItem) return '';
  switch (props.historyItem?.jenisKunjungan) {
    case 'rj': return 'Rawat Jalan';
    case 'ri': return 'Rawat Inap';
    case 'igd': return 'IGD';
    default: return props.historyItem?.jenisKunjungan || 'Lainnya';
  }
});

const petugasInput = computed(() => {
  return props.historyItem?.meta?.petugasName || 'N/A';
});

const jamInput = computed(() => {
  return props.historyItem?.meta?.createdAt ? epochToDate(props.historyItem.meta.createdAt, 'time') : 'N/A';
});

const tanggalRiwayat = computed(() => {
  return props.historyItem?.date ? epochToDate(props.historyItem.date, 'date') : 'Tidak Ada Riwayat';
});

const updateFilter = (value: string) => {
  emit('update:filter', value);
}
</script>

<template>
  <div class="flex flex-col gap-2.5 pt-2">
    <div class="flex items-center justify-between">
      <div class="font-semibold text-gray-400 text-MD">Riwayat Sebelumnya</div>
      <div class="flex items-end gap-2.5">
        <CustomSelect
          label=""
          prependIcon="PhHospital"
          placeHolder="Semua"
          :modelValue="filterJenisKunjungan"
          @update:modelValue="updateFilter" 
          :options="optionsJenisKunjungan"
          optionLabel="label"
          optionValue="value"
          class="w-[150px]"
        />
        <CustomButton 
          icon="PhCaretLeft" 
          @click="emit('previous')"
          :disabled="!canGoToPrevious"
        />
        <CustomButton 
          icon="PhCaretRight" 
          @click="emit('next')"
          :disabled="!canGoToNext"
        />
      </div>
    </div>
    
    <NoData
      v-if="!isLoading && !historyItem"
      title="Tidak ada riwayat sebelumnya"
      class="mt-4"
    />

    <CustomAccordion 
      v-if="!isLoading && historyItem" 
      headerClass="bg-opensimrs-50" 
      initialState="0"
    >
      <template #header>
        <div class="flex gap-2">
          <div>{{ tanggalRiwayat }}</div>
          <hr class="h-auto border border-opensimrs-300" />
          <CustomChip :showCheckedIcon="false" :label="jenisKunjunganLabel" />
        </div>
      </template>
      <template #content>
        <div 
          v-if="historyItem.prescriptions && historyItem.prescriptions.length > 0"
          v-for="(resep, index) in historyItem.prescriptions" 
          :key="index" 
          class="pt-3"
        >
          <CustomAccordion initialState="0">
            <template #header>
              <div class="flex items-center justify-between w-full">
                <div class="font-semibold text-s text-opensimrs-300">
                  {{ resep.meta.noResep || 'N/A' }} </div>
                <div class="flex items-center gap-2.5 mr-3">
                  <div class="font-normal text-s">{{ tanggalRiwayat }}</div>
                  <CustomButton label="Detail" @click.stop="showDetail(resep)" />
                </div>
              </div>
            </template>
            <template #content>
              <DataTable
                :value="resep.data" class="overflow-y-scroll text-xs bg-opensimrs-50 max-h-[300px]"
                scrollable
                scrollHeight="flex"
                :loading="isLoading"
              >
                <Column headerClass="bg-opensimrs-50 font-semibold text-SM w-[40px]">
                  <template #header>
                    <div class="">No.</div>
                  </template>
                  <template #body="slotProps">
                    <div class="w-full text-center">
                      {{ slotProps.index + 1 }}
                    </div>
                  </template>
                </Column>
                <Column headerClass="bg-opensimrs-50 w-[300px]">
                  <template #header>
                    <div class="font-semibold">Obat</div>
                  </template>
                  <template #body="slotProps">
                    <div>
                      <div>
                        {{ slotProps.data.namaItem }}</div>
                      <div class="font-bold text-SM">
                        {{ slotProps.data.aturanPakai }} </div>
                    </div>
                  </template>
                </Column>
                <Column headerClass="bg-opensimrs-50">
                  <template #header>
                    <div class="font-semibold">Total Obat</div>
                  </template>
                  <template #body="slotProps">
                    <div>
                      <div>
                        {{ slotProps.data.totalObat }}
                      </div>
                    </div>
                  </template>
                </Column>
              </DataTable>
              <div class="flex justify-between py-2.5">
                <div>
                  <div class="font-semibold underline text-SM">
                    Petugas Input
                  </div>
                  <div class="font-normal text-SM">{{ resep.meta.petugasName }}</div> </div>
                <div>
                  <div class="font-semibold underline text-SM">Jam Input</div>
                  <div class="font-normal text-SM text-end">{{ epochToDate(resep.meta.createdAt, 'time') }}</div> </div>
              </div>
            </template>
          </CustomAccordion>
        </div>

        <NoData
          v-if="!isLoading && (!historyItem.prescriptions || historyItem.prescriptions.length === 0)"
          title="Tidak ada data resep pada sesi ini"
          class="mt-4"
        />
      </template>
    </CustomAccordion>

    <DialogCardObat 
      v-model:isDialogVisible="isDetailDialogVisible"
      title="Riwayat - Detail Resep"
      :obatDetail="selectedObatDetail"
    />
    </div>
</template>