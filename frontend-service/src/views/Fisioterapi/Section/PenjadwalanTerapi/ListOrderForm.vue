<script setup lang="ts">
import { ref } from "vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";

const historyVisitDialog = ref(false);
const submitForm = () => {
  console.log("Submited Patient Identity Form");
};

defineExpose({
  submitForm,
});
</script>

<template>
  <CustomAccordion :openWithHeader="false" initial-state="0">
    <template #header>
      <div class="flex justify-between w-full align-middle">
        <div class="flex">
          <p class="leading-10 text-bold text-heading">
            List Order Fisioterapi
          </p>
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
        <card class="bg-opensimrs-50">
          <template #content>
            <div class="flex justify-between">
              <div class="flex">
                <p class="text-base font-bold text-opensimrs-300">FISK82L</p>
                <div class="bg-black w-[2px] h-[15px] ml-2 mt-1"></div>
                <p class="ml-2 text-base font-bold">
                  Rincian Pemeriksaan & Biaya
                </p>
              </div>
            </div>
          </template>
        </card>
        <div class="pt-5 mt-[-20px]">
          <DataTable
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
                      {{ slotProps.data.pemeriksaanName }}
                    </p>
                  </div>
                </div>
              </template>
            </Column>

            <Column field="diagnosa" header="Diagnosis">
              <template #body="slotProps">
                <div>
                  <p class="text-sm">
                    {{ slotProps.data.diagnosa }}
                  </p>
                </div>
              </template>
            </Column>

            <!-- Harga -->
            <Column field="harga">
              <template #header>
                <div class="font-bold text-end">Harga</div>
              </template>
              <template #body="slotProps">
                <div class="text-SM text-end">
                  {{ slotProps.data.harga }}
                </div>
              </template>
            </Column>
          </DataTable>
        </div>
        <div class="mt-4">
          <card class="bg-opensimrs-50">
            <template #content>
              <div class="grid grid-cols-3">
                <div>
                  <p class="text-xs font-bold underline underline-offset-2">
                    Dokter Pengirim
                  </p>
                  <p>dr. Anji Sp. M</p>
                </div>
                <div class="flex">
                  <div class="bg-black w-[1px] h-[30px] ml-2"></div>
                  <p class="mt-1 ml-4 text-base font-bold">
                    Total Tagihan Fisio
                  </p>
                </div>
                <div>
                  <p class="flex justify-end mt-1 text-base font-bold">
                    RP. 0, 00
                  </p>
                </div>
              </div>
            </template>
          </card>
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
  <!-- Dialog history -->
  <CustomDialog
    class=""
    v-model:visible="historyVisitDialog"
    position="bottomright"
    headerHeight="h-5"
    width="350px"
    closeIcon="PhTextIndent"
  >
    <template #header>
      <div class="flex">
        <PhClockCounterClockwise
          color="white"
          :size="20"
          weight="bold"
          class="my-auto"
        />
        <span class="ml-[10px] text-normal"> Riwayat Pemeriksaan </span>
      </div>
    </template>
    <template #body>
      <div class="h-[60vh]">
        <!-- <div>
            <div>
              Rawat Jalan - Poli Mata
              <CustomChip
                :showCheckedIcon="false"
                label="BPJS"
                bgColor="bg-warning-50"
                textColor="text-warning-300"
                borderColor="border-warning-300"
                customClass="h-5 pr-[6px] mr-[5px]"
              />
            </div>
          </div> -->
      </div>
    </template>
    <template #customCloseIcon>
      <MenuOpenIcon class="text-white" />
    </template>
  </CustomDialog>
</template>
