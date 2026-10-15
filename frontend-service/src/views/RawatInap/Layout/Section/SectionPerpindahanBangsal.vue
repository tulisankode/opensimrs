<script setup lang="ts">
import { ref } from "vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import DataPatient from "@/components/RekamMedis/DataPatient.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import FormTandaVital from "@/components/RekamMedis/TandaVital/FormTandaVital.vue";
import RiwayatPerpindahanBed from "@/components/RekamMedis/Perpindahan/riwayatPerpindahanBed.vue";
import FormPerpindahan from "@/components/RekamMedis/Perpindahan/FormPerpindahan.vue";

const dialogPerpindahan = ref(false);
const selectedTab = ref("perpindahan");

const showDialogPerpindahanBangsal = () => {
  dialogPerpindahan.value = true;
};

defineExpose({ showDialogPerpindahanBangsal });
</script>

<template>
  <CustomDialog v-model:visible="dialogPerpindahan" class="" fullScreen>
    <template #header>
      <div class="flex justify-between">
        <div class="flex my-auto">
          <span> Detail Pasien </span>
          <span class="mx-[10px]"> | </span>
          <span> Rawat Inap </span>
          <PhArrowRight :size="18" class="my-auto mx-[10px]" weight="bold" />
          <div class="bg-white rounded-lg text-opensimrs-300 px-[10px] mr-[10px]">
            00-00-00
          </div>
          Nama Lengkap Pasien
        </div>
        <CustomButton
          @click="() => {}"
          icon="PhPrinter"
          label="Cetak Label"
          class="mr-5"
          backgroundColor="bg-white"
          textColor="text-opensimrs-300"
        />
      </div>
    </template>
    <template #body>
      <div class="pt-[10px] h-full overflow-hidden flex flex-col">
        <DataPatient />
        <div class="flex flex-col overflow-hidden grow">
          <div class="flex justify-between mb-4">
            <div class="flex">
              <MonitoringBedIcon
                :size="24"
                weight="bold"
                class="text-opensimrs-300 mr-[10px]"
              />
              <span class="font-semibold leading-6 text-grey-500 text-MD">
                Perpindahan Bangsal
              </span>
            </div>
            <CustomButton
              @click="() => {}"
              icon="PhClockCounterClockwise"
              label="Riwayat"
              size="small"
              class="!rounded-md ml-auto"
            />
          </div>
          <Tabs
            v-model:value="selectedTab"
            :dt="{
              tabActiveBackground: 'rgb(var(--opensimrs-50))',
              tabActiveColor: 'rgb(var(--opensimrs-300))',
              tabActiveBorderColor: 'rgb(var(--opensimrs-300))',
            }"
          >
            <TabList :pt="{ tabList: 'h-10 text-SM' }">
              <Tab
                class="py-0 px-[10px]"
                value="perpindahan"
                :pt="{ root: 'rounded-t-lg' }"
              >
                <div class="flex">
                  <PhArrowsClockwise
                    :size="18"
                    weight="bold"
                    class="mr-[10px]"
                  />
                  perpindahan
                </div>
              </Tab>
            </TabList>
          </Tabs>
          <div class="overflow-auto mt-[10px]">
            <FormPerpindahan
              method="detail"
              initialState="0"
              class="mb-[10px]"
            />
            <FormTandaVital
              method="detailPerpindahan"
              initialState="0"
              class="mb-[10px]"
            />
            <RiwayatPerpindahanBed initialState="0" class="mb-[10px]" />
          </div>
        </div>
      </div>
    </template>
  </CustomDialog>
</template>
