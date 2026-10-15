<script setup lang="ts">
import { ref, type PropType, computed } from "vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import { epochToDate } from "@/utils/Helpers";
import DataTable from "primevue/datatable";
import Column from "primevue/column";

const props = defineProps({
  history: {
    type: Object as PropType<any>,
    default: null,
  },
  listOklusi: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
});

const jenisKunjunganLabel = computed(() => {
  switch (props.history?.jenisKunjungan) {
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

const chipBgColor = computed(() => 'bg-white');
const chipTextColor = computed(() => 'text-grey-400');

const emit = defineEmits(["showDetail"]);

const listTorusPalatinus = ref([
  { code: "OV000074", tampilan: "Tidak Ada" },
  { code: "OV000075", tampilan: "Kecil" },
  { code: "OV000076", tampilan: "Sedang" },
  { code: "OV000077", tampilan: "Besar" },
  { code: "OV000078", tampilan: "Multiple" },
]);
const listTorusMandibularis = ref([
  { code: "OV000079", tampilan: "Tidak Ada" },
  { code: "OV000080", tampilan: "Sisi Kiri" },
  { code: "OV000081", tampilan: "Sisi Kanan" },
  { code: "OV000082", tampilan: "Kedua Sisi" },
]);
const listPalatum = ref([
  { code: "OV000083", tampilan: "Dalam" },
  { code: "OV000084", tampilan: "Sedang" },
  { code: "OV000085", tampilan: "Rendah" },
]);

const getDisplayText = (list: any[], code: string) => {
  const selected = list.find(item => item.code === code);
  return selected ? selected.tampilan : code || '-';
};

const getOklusiText = (uuid: string) => {
  if (!uuid) return '-';
  const selected = props.listOklusi.find((item: any) => item.uuid === uuid || item.display === uuid);
  return selected ? selected.display : uuid;
};
</script>

<template>
  <div v-if="history && history.data">
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
            :value="history.data.odontogramItems || []"
            class="mt-5"
            tableStyle=""
            scrollable
            scrollHeight="flex"
            :pt="{ headerRow: 'text-SM' }"
          >
            <Column
              field="noGigi"
              headerClass="bg-opensimrs-50"
              headerStyle="width: 82px"
            >
              <template #header>
                <div class="w-full font-semibold text-center">No. Gigi</div>
              </template>
              <template #body="slotProps">
                <div class="text-center">
                  <div class="text-SM">{{ slotProps.data.noGigi }}</div>
                </div>
              </template>
            </Column>
            <Column
              field="keadaanGigi"
              header="Keadaan Gigi"
              headerClass="bg-opensimrs-50"
            >
              <template #body="slotProps">
                <div class="flex flex-wrap gap-2">
                  <CustomChip
                    v-for="keadaan in slotProps.data.keadaanGigi"
                    :key="keadaan"
                    :label="keadaan"
                    :show-checked-icon="false"
                    bg-color="bg-opensimrs-300"
                    borderColor="border-none"
                    text-color="text-white"
                  />
                </div>
              </template>
            </Column>
          </DataTable>

          <CustomInfoRow label="Oklusi" :value="getOklusiText(history.data.oklusiGigiUuid)" type="vertical" />
          
          <CustomInfoRow
            label="Torus Palatinus"
            :value="getDisplayText(listTorusPalatinus, history.data.torusPalatinus)"
            type="vertical"
          />
          <CustomInfoRow
            label="Torus Mandibularis"
            :value="getDisplayText(listTorusMandibularis, history.data.torusMandibularis)"
            type="vertical"
          />
          <CustomInfoRow 
            label="Palatum" 
            :value="getDisplayText(listPalatum, history.data.palatum)" 
            type="vertical" 
          />
          <CustomInfoRow
            label="Frenulum Labialis"
            :value="history.data.frenulumLabialis || '-'"
            type="vertical"
          />
          <CustomInfoRow
            label="Frenulum Lingualis"
            :value="history.data.frenulumLingualis || '-'"
            type="vertical"
          />
          <CustomInfoRow label="Diastema" :value="history.data.diastema ? 'Ya' : 'Tidak'" type="vertical" />
          <CustomInfoRow label="Gigi Anomali" :value="history.data.gigiAnomali ? 'Ya' : 'Tidak'" type="vertical" />
          <CustomInfoRow label="Jml. Gigi Decayed" :value="history.data.gigiDecayed || '0'" type="vertical" />
          <CustomInfoRow label="Jml. Gigi Missing" :value="history.data.gigiMissing || '0'" type="vertical" />
          <CustomInfoRow label="Jml. Gigi Filled" :value="history.data.gigiFilled || '0'" type="vertical" />
          <CustomInfoRow label="Temuan Lainnya" :value="history.data.temuanLain || '-'" type="vertical" />
          <CustomInfoRow
            label="Keterangan Tindakan Gigi"
            :value="history.data.ketTindakanGigi || '-'"
            type="vertical"
          />
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
            <div class="flex">
              <div class="border border-opensimrs-300 mx-[15px] my-[10px]"></div>
              <CustomButton
                @click="emit('showDetail', history.data)"
                class="!rounded-md my-[10px] ml-auto"
                label="Detail"
                size="small"
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