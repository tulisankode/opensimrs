<script setup lang="ts">
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";

const props = defineProps({
  isDialogVisible: {
    default: false,
  },
  title: {
    type: String,
  },
  obatDetail: {
    type: Object,
    default: () => ({}),
  },
  index: {
    type: Number,
    default: null,
  },
});

const emit = defineEmits(["update:isDialogVisible", "edit-detail-obat"]);

function updateVisibility(value: boolean) {
  emit("update:isDialogVisible", value);
}
</script>
<template>
  <CustomDialog
    width="1000px"
    :visible="props.isDialogVisible"
    headerBg="bg-opensimrs-300"
    @update:visible="updateVisibility"
  >
    <template #header>{{ title }}</template>
    <template #body>
      <div class="pt-5">
        <DataTable
          :value="obatDetail.obatItems"
          class="text-xs bg-opensimrs-50 max-h-[160px] overflow-y-scroll"
          scrollable
          scrollHeight="flex"
        >
          <Column
            headerClass="bg-opensimrs-50 font-semibold text-SM"
            class="w-2 text-center"
          >
            <template #header>
              <div class="text-center">No.</div>
            </template>
            <template #body="slotProps">
              <div class="flex items-center justify-center">
                {{ slotProps.index + 1 }}
              </div>
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50" class="max-w-[300px] text-left">
            <template #header>
              <div class="w-full font-semibold text-left">Nama Obat</div>
            </template>
            <template #body="slotProps">
              <div v-if="slotProps.data.isCompound"> 
                {{ slotProps.data.namaRacikan }}
                <span v-if="slotProps.data.jenisRacikan == 1">- Sirup</span>
              </div>
              <div v-else>
                {{ slotProps.data.namaItem }} </div>
              <div class="flex gap-1.5 justify-left">
                <CustomChip
                  v-if="slotProps.data.isCompound" :showCheckedIcon="false"
                  label="RACIKAN"
                  bgColor="bg-none"
                  textColor="text-grass-300"
                  customClass="h-5 pr-[6px] border-[#A0D468]"
                />
                <CustomChip
                  v-if="obatDetail.isTakeaway" :showCheckedIcon="false"
                  label="OBAT PULANG"
                  bgColor="bg-none"
                  textColor="text-info-300"
                  customClass="h-5 pr-[6px] border-info-300 min-w-[85px]"
                />
                <CustomChip
                  v-if="slotProps.data.isChronic" :showCheckedIcon="false"
                  label="OBAT KRONIS"
                  bgColor="bg-none"
                  textColor="text-sunFlower-300"
                  customClass="h-5 border-sunFlower-300"
                />
              </div>
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50" class="w-auto text-left">
            <template #header>
              <div class="w-full font-semibold text-left">Dosis</div>
            </template>
            <template #body="slotProps">
              {{ slotProps.data.jumlahKonsumsi }}
              {{ slotProps.data.satuanDosis }}
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50" class="w-auto text-left">
            <template #header>
              <div class="w-full font-semibold text-left">Aturan Pakai</div>
            </template>
            <template #body="slotProps">
              {{ slotProps.data.aturanPakai }} </template>
          </Column>
          <Column headerClass="bg-opensimrs-50" class="w-auto text-left">
            <template #header>
              <div class="w-full font-semibold text-left">Cara Pakai</div>
            </template>
            <template #body="slotProps">
              {{ slotProps.data.caraPakai }} </template>
          </Column>
          <Column headerClass="bg-opensimrs-50" class="w-auto text-left">
            <template #header>
              <div class="w-full font-semibold text-left">Rute Pemberian</div>
            </template>
            <template #body="slotProps">
              {{ slotProps.data.rutePemberian }}
            </template>
          </Column>
        </DataTable>
      </div>
    </template>
    <template #footer>
      <div class="w-full">
        <hr class="-mx-5 border-grey-200" />
        <div class="mt-5 flex justify-end gap-2.5">
          <CustomButton label="Edit" />
        </div>
      </div>
    </template>
  </CustomDialog>
</template>