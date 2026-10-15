<script lang="ts" setup>
import CustomChip from "@/components/Base/CustomChip.vue";
import NoData from "@/components/section/NoData.vue";
import { ref, type PropType } from "vue";
import SectionPerpindahanBangsal from "../../Section/SectionPerpindahanBangsal.vue";
import { PhArrowElbowDownRight, PhUserCirclePlus } from "@phosphor-icons/vue"; 

const props = defineProps({
  items: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
});

const emit = defineEmits(["onRowClick"]);

const selectedPatient = ref([]);
const sectionPerpindahanBangsal = ref<any>();
const handleRowClick = (event: any) => {
  emit("onRowClick", event.data);
};
</script>

<template>
  <DataTable
    v-if="items.length"
    v-model:selection="selectedPatient"
    :value="items"
    tableStyle="min-width: 50rem"
    scrollable
    stripedRows
    class=""
    scrollHeight="flex"
    :pt="{ headerRow: 'text-SM' }"
    @row-click="handleRowClick"
  >
    <Column field="nomor" headerClass="bg-opensimrs-50">
      <template #header>
        <div class="w-full font-semibold text-center">Nomor</div>
      </template>
      <template #body="slotProps">
        <div class="text-center">
          <div class="text-SM">{{ slotProps.data.noRm }}</div>
          <div class="text-SM">{{ slotProps.data.noReg }}</div>
          <div class="text-SM">{{ slotProps.data.noPelayanan }}</div>
        </div>
      </template>
    </Column>
    <Column field="pasien" header="Pasien" headerClass="bg-opensimrs-50">
      <template #body="slotProps">
        <div class="text-SM">
          <span class="font-semibold">{{ slotProps.data.name }}</span>
          <span class="text-grey-300">
            ({{ slotProps.data.ageYear }}Th {{ slotProps.data.ageMonth }}Bln
            {{ slotProps.data.ageDay }}Hr)
          </span>
        </div>
        <div class="text-XS">{{ slotProps.data.address }}</div>
        <div class="flex flex-wrap">
          <PhUserCirclePlus
            v-if="slotProps.data.newPatient"
            :size="22"
            class="text-opensimrs-300 mt-auto mr-[5px]"
            weight="fill"
          />
          <CustomChip
            :showCheckedIcon="false"
            :label="slotProps.data.gender == 'P' ? 'Perempuan' : 'Laki-laki'"
            :bgColor="
              slotProps.data.gender == 'P' ? 'bg-female-75' : 'bg-male-75'
            "
            :textColor="
              slotProps.data.gender == 'P' ? 'text-female-300' : 'text-male-300'
            "
            customClass="h-5 pr-[6px] border-none mr-[5px]"
          />
          <CustomChip
            :showCheckedIcon="false"
            :label="slotProps.data.phone"
            bgColor="bg-opensimrs-50"
            textColor="text-opensimrs-300"
            customClass="h-5 pr-[6px] border-none mr-[5px]"
          />
        </div>
      </template>
    </Column>
    <Column
      field="keperawatan"
      header="Keperawatan"
      headerClass="bg-opensimrs-50"
    >
      <template #body="slotProps">
        <div class="text-SM">{{ slotProps.data.doctor }}</div>
        <div class="flex flex-wrap mt-1">
          <!-- <CustomChip
            :showCheckedIcon="false"
            label="Rawat Inap"
            customClass="h-5 pr-[7px] mr-[5px]"
          /> -->
          <CustomChip
            :showCheckedIcon="false"
            :label="slotProps.data.ruangan"
            customClass="h-5 pr-[7px] mr-[5px]"
          />
          <CustomChip
            :showCheckedIcon="false"
            :label="slotProps.data.bed"
            customClass="h-5 pr-[7px] mr-[5px]"
          />
          <CustomChip
            :showCheckedIcon="false"
            :label="slotProps.data.insuranceAccountName"
            :bgColor="
              slotProps.data.insuranceAccountName == 'TUNAI'
                ? 'bg-opensimrs-50'
                : 'bg-warning-50'
            "
            :textColor="
              slotProps.data.insuranceAccountName == 'TUNAI'
                ? 'text-opensimrs-300'
                : 'text-warning-300'
            "
            :borderColor="
              slotProps.data.insuranceAccountName == 'TUNAI'
                ? 'border-opensimrs-300'
                : 'border-warning-300'
            "
            customClass="h-5 pr-[7px] mr-[5px]"
          />
        </div>
      </template>
    </Column>
    <Column
      field="data-kunjungan"
      header="Data Kunjungan"
      headerClass="bg-opensimrs-50"
    >
      <template #body="slotProps">
        <div class="text-SM">
          <div
            class="flex content-center auto-cols-min"
          >
            SPRI
            <ArrowRightBrokenIcon
              :size="18"
              class="mx-[5px] my-auto text-grey-300"
            />
            {{ slotProps.data.tanggalSPRI }}
          </div>
          <div
            class="flex content-center mt-[5px]"
          >
            Dirawat
            <ArrowRightBrokenIcon
              :size="18"
              class="mx-[5px] my-auto text-blueJeans-300"
            />
            {{ slotProps.data.tanggalDirawat }}
          </div>
          <div
            class="flex content-center mt-[5px]"
          >
            Lama Dirawat
            <ArrowRightBrokenIcon
              :size="18"
              class="mx-[5px] my-auto text-blueJeans-300"
            />
            {{ slotProps.data.lamaHari }} Hari
          </div>
        </div>
      </template>
    </Column>
    <Column field="status" headerClass="bg-opensimrs-50">
      <template #header>
        <div class="flex font-semibold">
          <div>Asal</div>
          <ArrowRightBrokenIcon
            :size="18"
            class="my-auto mx-[5px] text-grey-300"
          />
          <div>Tujuan</div>
        </div>
      </template>
      <template #body="slotProps">
        <div class="text-SM">
          <div>
            {{ slotProps.data.asal }}
          </div>
          <div class="flex mt-[5px]">
            <PhArrowElbowDownRight
              :size="18"
              weight="bold"
              class="text-grey-300"
            />
            <span class="leading-6 ml-[5px]">
              {{ slotProps.data.tujuan }}
            </span>
          </div>
        </div>
      </template>
    </Column>
  </DataTable>
  <!-- Else -->
  <NoData v-else />
  <SectionPerpindahanBangsal ref="sectionPerpindahanBangsal" />
</template>