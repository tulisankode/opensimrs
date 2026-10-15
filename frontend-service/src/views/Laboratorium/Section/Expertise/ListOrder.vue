<script setup lang="ts">
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import RiwayatOrderLab from "../RiwayatOrderLab.vue";
import { computed, ref, type PropType } from "vue";
import type { MenuItem } from "primevue/menuitem";

const props = defineProps({
  pageType: {
    type: String,
    required: true,
  },
  dataBreadCrumb: {
    type: Array as PropType<MenuItem[]>,
    default: () => [],
  },
  formType: {
    type: String,
    default: "",
  },
  isDetail: {
    type: Boolean,
    required: false,
  },
  openedPatientData: {
    type: Object as PropType<any>,
    required: true,
  },
});
const historyVisitDialog = ref(false);

</script>

<template>
  <CustomAccordion :openWithHeader="false" initial-state="0">
    <template #header>
      <div class="flex justify-between w-full align-middle">
        <div class="flex">
          <p class="leading-10 text-bold text-heading">List Order Lab</p>
        </div>
        <div class="mr-4">
          <CustomButton
            @click="historyVisitDialog = true"
            icon="PhClockCounterClockwise"
            label="Riwayat"
          ></CustomButton>
        </div>
      </div>
    </template>
    <template #content>
      <div class="mt-1">
        <div class="grid grid-cols-4 gap-4">
          <div class="basis-1/4">
            <p class="text-xs font-bold underline underline-offset-2">
              Dokter Penanggung Jawab
            </p>
            <p class="">
              {{ openedPatientData.practitioner?.pegawai?.firstTitle }}
              {{ openedPatientData.practitioner?.pegawai?.name }}
              {{ openedPatientData.practitioner?.pegawai?.lastTitle }}
            </p>
          </div>

          <div>
            <p class="mr-2 text-xs font-bold underline underline-offset-2">
              Spesimen
            </p>
            <div
              class="flex gap-1 mt-1"
              v-if="openedPatientData.spesimenUuids?.length"
            >
              <div
                v-for="items in openedPatientData.spesimenUuids"
                :key="items"
              >
                <CustomChip
                  :label="items.name"
                  :showCheckedIcon="false"
                  borderColor="border-opensimrs-300"
                  bgColor="bg-opensimrs-300"
                  textColor="text-white"
                  customClass="h-6"
                  class="mr-[5px]"
                />
              </div>
            </div>
          </div>
          <div class="basis-1/4">
            <p class="text-xs font-bold underline underline-offset-2">
              Status Puasa
            </p>
            <p>{{ openedPatientData.statusPuasa ? "Iya" : "Tidak" }}</p>
          </div>
          <div class="basis-1/4">
            <p class="text-xs font-bold underline underline-offset-2">CITO</p>
            <p>{{ openedPatientData.cito ? "Iya" : "Tidak" }}</p>
          </div>
        </div>
        <card class="mt-4 bg-opensimrs-50">
          <template #content>
            <div class="flex justify-between">
              <div class="flex">
                <p class="text-base font-bold text-opensimrs-300">
                  {{ openedPatientData.noOrder }}
                </p>
                <div class="bg-black w-[2px] h-[15px] ml-2 mt-1"></div>
                <p class="ml-2 text-base">Kimia Klinik</p>
              </div>
            </div>
          </template>
        </card>
        <div class="pt-5 mt-[-20px]">
          <DataTable
            :value="openedPatientData.hasilPemeriksaan"
            class="overflow-hidden rounded-[10px]"
            scrollable
            scrollHeight="flex"
            :pt="{ headerRow: 'text-SM', thead: 'z-0' }"
          >
            <Column field="pemeriksaanName" header="Nama Pemeriksaan">
              <template #body="slotProps">
                <div class="flex justify-between">
                  <div>
                    <p class="text-SM">
                      {{ slotProps.data.itemPemeriksaan.name }}
                    </p>
                  </div>
                </div>
              </template>
            </Column>

            <Column field="result" header="Hasil Pemeriksaan">
              <template #body="slotProps">
               <div>
                <p class="text-SM">
                  {{ slotProps.data.result || "-" }}
                </p>
               </div>
              </template>
            </Column>

            <Column field="flags" header="Flags" class="w-[10%]">
              <template #body="slotProps">
                <div class="flex justify-between">
                  <div>
                    <CustomButton
                      :label="slotProps.data.flag ? slotProps.data.flag : '-'"
                      background-color="bg-mediumGrey-300"
                      text-color="text-mediumGrey-500"
                    />
                  </div>
                </div>
              </template>
            </Column>
            <Column field="metode" header="Metode" class="w-[10%]">
              <template #body="slotProps">
                <div class="flex justify-between">
                  <div>
                    <p class="text-SM">
                      {{ slotProps.data.itemPemeriksaan.metode }}
                    </p>
                  </div>
                </div>
              </template>
            </Column>
            <Column field="satuan" header="Satuan" class="w-[10%]">
              <template #body="slotProps">
                <div class="flex justify-between">
                  <div>
                    <p class="text-SM">
                      {{ slotProps.data.itemPemeriksaan.satuan }}
                    </p>
                  </div>
                </div>
              </template>
            </Column>

            <Column field="nilaiRujukan" header="Nilai Rujukan" class="w-[10%]">
              <template #body="slotProps">
                <div>
                  <p class="text-sm">
                    {{ slotProps.data.itemPemeriksaan.nilaiRujukan || "-" }}
                  </p>
                </div>
              </template>
            </Column>
            <Column field="statusPeriksa">
              <template #header>
                <div class="font-bold text-center">Status Pemeriksaan</div>
              </template>
              <template #body="slotProps">
                <CustomChip
                  :showCheckedIcon="false"
                  :label="
                    slotProps.data.statusPeriksa == false
                      ? 'Belum Selesai'
                      : 'Selesai'
                  "
                  :bgColor="
                    slotProps.data.statusPeriksa == false
                      ? 'bg-mediumGrey-300'
                      : 'bg-male-75'
                  "
                  :textColor="
                    slotProps.data.statusPeriksa == false
                      ? 'text-mediumGrey-500'
                      : 'text-male-300'
                  "
                  customClass="h-5 pr-[6px] border-none mr-[5px] ml-2"
                />
              </template>
            </Column>
          </DataTable>
        </div>
      </div>
    </template>
    <template #collapseIcon>
      <CustomButton
        icon="PhCaretUp"
        backgroundColor="bg-transparent"
        textColor="text-opensimrs-300"
      />
    </template>
    <template #expandIcon>
      <CustomButton
        icon="PhCaretDown"
        backgroundColor="bg-transparent"
        textColor="text-opensimrs-300"
      />
    </template>
  </CustomAccordion>
  <!-- Riwayat pemeriksaan lab pasien -->
  <RiwayatOrderLab v-model:visible="historyVisitDialog" :order="openedPatientData" />
</template>
