<script setup lang="ts">
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import { epochToDate } from "@/utils/Helpers";
import { type PropType, computed } from "vue";

const props = defineProps({
  history: {
    type: Object as PropType<any>,
    default: null,
  },
});

const emit = defineEmits(["showDetail"]);

const jenisKunjunganLabel = computed(() => {
  if (!props.history?.jenisKunjungan) return null;
  switch (props.history.jenisKunjungan) {
    case 'rj':
      return 'Rawat Jalan';
    case 'ri':
      return 'Rawat Inap';
    case 'igd':
      return 'IGD';
    default:
      return null;
  }
});

const chipBgColor = computed(() => {
      return 'bg-white';
});

const chipTextColor = computed(() => {
      return 'text-grey-400';
});

const petugasInput = computed(() => {
  if (props.history?.data && props.history.data.length > 0) {
    return props.history.data[0].petugasInput || '-';
  }
  return props.history?.petugas || '-';
});

</script>

<template>
  <div v-if="history && history.data && history.data.length > 0">
    <CustomAccordion headerClass="bg-opensimrs-50" :initialState="'0'">
      <template #header>
        <span class="shrink-0 text-sm mr-2 mt-1">
          {{ epochToDate(history.date, 'date') || "Data Riwayat" }}
        </span>
        <div class="flex flex-wrap">
          <CustomChip
                v-if="jenisKunjunganLabel"
                :label="jenisKunjunganLabel"
                :bgColor="chipBgColor"
                :textColor="chipTextColor"
                customClass="h-5 px-2 text-xs font-semibold border-none shrink-0 mt-1"
                :showCheckedIcon="false"
            />
          <CustomChip
              v-if="history.session && jenisKunjunganLabel !== 'Rawat Jalan'"
              :label="`Sesi ${history.session}`"
              bgColor="bg-blue-200"
              textColor="text-blue-800"
              customClass="h-5 px-2 text-xs font-semibold border-none shrink-0 mt-1"
              :showCheckedIcon="false"
            />
        </div>
      </template>
      <template #content>
        <div class="py-5 flex flex-col gap-[10px]">
          <DataTable
            :value="history.data"
            stripedRows
            class="mt-5 text-xs"
            scrollable
            scrollHeight="flex"
          >
            <Column headerClass="bg-opensimrs-50">
              <template #header>
                <div class="w-full font-semibold text-center">No.</div>
              </template>
              <template #body="slotProps">
                <div class="flex items-center justify-center">
                  {{ slotProps.index + 1 }}
                </div>
              </template>
            </Column>
            <Column
              field="namaTindakan"
              header="List Tindakan"
              headerClass="bg-opensimrs-50"
            >
              <template #body="slotProps">
                <div>
                  <div>{{ slotProps.data.namaTindakan }}</div>
                  <div class="font-bold">
                    Rp. {{ slotProps.data.hargaTindakan }}
                  </div>
                </div>
              </template>
            </Column>
            <Column headerClass="bg-opensimrs-50" class="w-[150px]">
              <template #header>
                <div class="w-full font-semibold text-center">Jumlah</div>
              </template>
              <template #body="slotProps">
                <div class="w-full text-center">
                  <span> {{ slotProps.data.qtyTindakan }}</span>
                </div>
              </template>
            </Column>
          </DataTable>
          
          <CustomInfoRow label="Catatan" :value="history.data[0]?.catatan || '-'" type="vertical" />
          <hr class="border-grey-200" />
          <div class="flex justify-between">
            <CustomInfoRow
              label="Petugas Input"
              :value="petugasInput"
              type="vertical"
            />
            <CustomInfoRow
              label="Jam Input"
              :value="String(epochToDate(history.data[0]?.updatedAt, 'time'))"
              type="vertical"
              alignment="right"
            />
          </div>
        </div>
      </template>
    </CustomAccordion>
  </div>
  <div v-else class="text-center text-grey-400">Tidak ada riwayat.</div>
</template>