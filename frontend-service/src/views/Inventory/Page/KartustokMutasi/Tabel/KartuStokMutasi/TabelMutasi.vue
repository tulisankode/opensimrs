<script lang="ts" setup>
import CustomChip from "@/components/Base/CustomChip.vue";

const props = defineProps({
  tabelData: {
    type: Array as () => Array<Record<string, any>>,
    default: () => [],
  },
});
</script>
<template>
  <DataTable
    :value="tabelData"
    tableStyle="min-width: 50rem"
    scrollable
    class="-m-4"
    scrollHeight="240px"
    :pt="{ headerRow: 'text-SM' }"
  >
    <Column headerClass="bg-opensimrs-50" class="w-[150px]">
      <template #header>
        <div class="font-semibold">Transaksi</div>
      </template>
      <template #body="slotProps">
        <div class="text-SM">{{ slotProps.data.kodeTransaksi }}</div>
        <CustomChip
          :showCheckedIcon="false"
          bgColor="bg-opensimrs-75"
          textColor="text-opensimrs-300"
          customClass="h-5 pr-[6px] border-none mr-[5px]"
          :label="slotProps.data.lokasiTransaksi"
        />
        <div class="text-SM">{{ slotProps.data.tglTransaksi }}</div>
      </template>
    </Column>
    <Column headerClass="bg-opensimrs-50" class="w-[200px]">
      <template #header>
        <div class="font-semibold">Transaksi</div>
      </template>
      <template #body="slotProps">
        <div>
          <div class="font-bold text-SM">
            {{ slotProps.data.itemTransaksi }}
          </div>
          <div class="text-SM">{{ slotProps.data.kodeItem }}</div>
          <CustomChip
            :showCheckedIcon="false"
            :label="slotProps.data.kategoriItem"
            bgColor="bg-opensimrs-300"
            textColor="text-white"
            customClass="h-5 pr-[6px] border-none mr-[5px]"
          />
          <CustomChip
            :showCheckedIcon="false"
            :label="slotProps.data.jenisStok"
            bgColor="bg-opensimrs-300"
            textColor="text-white"
            customClass="h-5 pr-[6px] border-none mr-[5px]"
          />
          <CustomChip
            :showCheckedIcon="false"
            :label="slotProps.data.jenisItem"
            bgColor="bg-opensimrs-300"
            textColor="text-white"
            customClass="h-5 pr-[6px] border-none mr-[5px]"
          />
        </div>
      </template>
    </Column>
    <Column headerClass="bg-opensimrs-50">
      <template #header>
        <div class="font-semibold">Exp Date</div>
      </template>
      <template #body="slotProps">
        <div>
          <div class="text-SM">{{ slotProps.data.expDate }}</div>
        </div>
      </template>
    </Column>
    <Column headerClass="bg-opensimrs-50">
      <template #header>
        <div class="font-semibold">Keterangan</div>
      </template>
      <template #body="slotProps">
        <div class="flex flex-col gap-1">
          <div class="text-SM">{{ slotProps.data.keterangan }}</div>
          <div v-if="slotProps.data.dari">
            <CustomChip
              :showCheckedIcon="false"
              :label="slotProps.data.dari"
              bgColor="bg-grey-200"
              textColor="text-grey-400"
              customClass="h-5 pr-[6px] border-none mr-[5px]"
            />
          </div>

          <!-- Conditionally render the "ke" section with arrow if both "dari" and "ke" have values -->
          <div v-if="slotProps.data.dari && slotProps.data.ke" class="flex">
            <PhArrowElbowDownRight :size="18" class="text-grey-400" />
            <CustomChip
              :showCheckedIcon="false"
              :label="slotProps.data.ke"
              bgColor="bg-mint-75"
              textColor="text-mint-400"
              customClass="h-5 pr-[6px] border-none mr-[5px]"
            />
          </div>
        </div>
      </template>
    </Column>
    <Column headerClass="bg-opensimrs-50">
      <template #header>
        <div class="font-semibold">Petugas</div>
      </template>
      <template #body="slotProps">
        <div>
          <div class="text-SM">{{ slotProps.data.petugas }}</div>
        </div>
      </template>
    </Column>
    <Column headerClass="bg-opensimrs-50">
      <template #header>
        <div class="w-full font-semibold text-center">Stok Awal</div>
      </template>
      <template #body="slotProps">
        <div>
          <div class="text-center text-SM">{{ slotProps.data.stokAwal }}</div>
        </div>
      </template>
    </Column>
    <Column headerClass="bg-opensimrs-50">
      <template #header>
        <div class="w-full font-semibold text-center">Mutasi Stok</div>
      </template>
      <template #body="slotProps">
        <div class="flex items-center justify-center gap-1">
          <div class="text-center text-SM">
            {{ Math.abs(slotProps.data.mutasiStok) }}
          </div>

          <!-- Conditionally render PhArrowCircleDown or PhArrowCircleUp based on mutasiStok value -->
          <PhArrowCircleDown
            v-if="slotProps.data.mutasiStok < 0"
            :size="18"
            color="#E9594C"
            weight="fill"
          />
          <PhArrowCircleUp v-else :size="18" color="#3AC279" weight="fill" />
        </div>
      </template>
    </Column>
    <Column headerClass="bg-opensimrs-50">
      <template #header>
        <div class="w-full font-semibold text-center">Sisa Stok</div>
      </template>
      <template #body="slotProps">
        <div>
          <div class="text-center text-SM">{{ slotProps.data.sisaStok }}</div>
        </div>
      </template>
    </Column>
  </DataTable>
</template>
