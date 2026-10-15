<script setup lang="ts">
import { ref, type PropType, computed } from "vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import { epochToDate } from "@/utils/Helpers";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import CustomButton from "@/components/Base/CustomButton.vue";

const props = defineProps({
  history: {
    type: Object as PropType<any>,
    default: null,
  },
});

const listDebrisIndex = ref([
  { score: 1, text: "skor 1 : bila terapat debris pada 1/3 permukaan servikal gigi atau dijumpai stain ekstrinsik" },
  { score: 2, text: "skor 2 : bila terdapat debris pada 1/3 - 2/3 permukaan gigi" },
  { score: 3, text: "skor 3 : bila terdapat debris pada > 2/3 permukaan gigi" },
]);

const listKalkulusIndex = ref([
  { score: 1, text: "skor 1 : bila terdapat kalkulus supragingiva pada 1/3 permukaan servikal gigi tanpa kalkulus subgingiva." },
  { score: 2, text: "skor 2 : bila terdapat kalkulus supragingiva pada 1/3 - 2/3 permukaan gigi dan/atau terdapat kalkulus subgingiva berupa titik- titik yang tidak melingkari leher gigi." },
  { score: 3, text: "skor 3 : bila terdapat kalkulus supragingiva pada > 2/3 permukaan gigi dan/atau terdapat kalkulus subgingiva yang melingkari leher gigi." },
]);

const getDebrisText = (score: string | number) => {
  if (score == null) return null;
  const numericScore = Number(score);
  const found = listDebrisIndex.value.find(item => item.score === numericScore);
  return found ? found.text : score;
};

const getKalkulusText = (score: string | number) => {
  if (score == null) return null;
  const numericScore = Number(score);
  const found = listKalkulusIndex.value.find(item => item.score === numericScore);
  return found ? found.text : score;
};

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
</script>

<template>
  <div v-if="history && history.data && history.data.ohis">
    <CustomAccordion headerClass="bg-opensimrs-50" :initialState="'0'">
      <template #header>
          <span>{{ epochToDate(history.date, 'date') || "Data Riwayat" }}</span>
          <CustomChip
            v-if="jenisKunjunganLabel"
            :label="jenisKunjunganLabel"
            :bgColor="chipBgColor"
            :textColor="chipTextColor"
            customClass="h-5 px-2 text-xs font-semibold border-none"
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
      </template>
      <template #content>
        <div class="py-5 flex flex-col gap-[19px]">
          <DataTable :value="history.data.ohis?.ohisItem || []" class="mt-2 text-xs" scrollable scrollHeight="200px">
            <Column field="noGigi" header="No. Gigi" headerStyle="width: 120px"></Column>
            <Column header="Keadaan Gigi">
              <template #body="slotProps">
                <div>
                  <div v-if="slotProps.data.debrisIndeks != null">
                    Debris Indeks: {{ getDebrisText(slotProps.data.debrisIndeks) }}
                  </div>
                  <div v-if="slotProps.data.kalkulusIndeks != null">
                    Kalkulus Indeks: {{ getKalkulusText(slotProps.data.kalkulusIndeks) }}
                  </div>
                </div>
              </template>
            </Column>
          </DataTable>
          <CustomInfoRow label="Skor Total Debris Indeks" :value="history.data.ohis?.skorDi?.toFixed(2) || '0'" type="vertical" />
          <CustomInfoRow label="Skor Total Kalkulus Indeks" :value="history.data.ohis?.skorCi?.toFixed(2) || '0'" type="vertical" />
          <CustomInfoRow label="Skor Total OHIS" :value="history.data.ohis?.skorTotal?.toFixed(2) || '0'" type="vertical" />
          <CustomInfoRow label="Hasil Interpretasi OHIS (Kesimpulan)" :value="history.data.ohis?.interpretasiOhis || '-'" type="vertical" />
          <hr class="border-grey-200" />
          <div class="flex">
            <div class="flex justify-between grow">
                <CustomInfoRow
                  label="Petugas Input"
                  :value="history.data.petugas || '-'"
                  type="vertical"
                />
                <CustomInfoRow
                  label="Jam Input"
                  :value="String(epochToDate(history.data.updatedAt, 'time'))"
                  type="vertical"
                  alignment="right"
                />
            </div>
          </div>
        </div>
      </template>
    </CustomAccordion>
  </div>
  <div v-else class="text-center text-grey-400 p-4">
    Tidak ada data riwayat.
  </div>
</template>