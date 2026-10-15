<script lang="ts" setup>
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import { epochToDate } from "@/utils/Helpers";
import { ref } from "vue";

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: "Detail",
  },
  obatDetail: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(["update:isDialogVisible"]);

function updateVisibility(value: boolean) {
  emit("update:isDialogVisible", value);
}

const getStringRutePemberian = (code: string) => {
  if (code == "Implant") return code;
  else if (code == "Inhal") return "Inhalation";
  else if (code == "Instill") return "Instillation";
  else if (code == "N") return "nasal";
  else if (code == "O") return "oral";
  else if (code == "P") return "parenteral";
  else if (code == "R") return "rectal";
  else if (code == "SL") return "sublingual/buccal/oromucosal";
  else if (code == "TD") return "transdermal";
  else if (code == "V") return "vaginal";
};
</script>

<template>
  <CustomDialog
    width="1000px"
    :visible="isDialogVisible"
    headerBg="bg-opensimrs-300"
    @update:visible="updateVisibility"
  >
    <template #header>{{ title }}</template>
    <template #body>
      <div class="flex flex-col gap-5 py-3">
        <div class="flex gap-7">
          <CustomInfoRow
            label="Penulis Resep"
            :value="obatDetail.dokterOrder"
            type="vertical"
          />
          <CustomInfoRow
            label="Tgl. Order"
            :value="`${epochToDate(obatDetail.orderDate, 'date')}`"
            type="vertical"
          />
          <CustomInfoRow
            label="Lokasi Tujuan Order"
            :value="obatDetail.lokasiStokNama || obatDetail.lokasiName" type="vertical"
          />
          <CustomInfoRow
            label="Obat Pulang"
            :value="obatDetail.isTakeaway ? 'Ya' : 'Tidak'"
            type="vertical"
          />
        </div>
        <DataTable
          :value="obatDetail.obatItems" class="overflow-y-scroll text-xs bg-opensimrs-50 max-h-[300px]"
          scrollable
          scrollHeight="flex"
          table-style="min-width:50 rem"
        >
          <Column
            headerClass="bg-opensimrs-50 font-semibold text-SM"
            class="max-w-[60px] text-center"
          >
            <template #header>
              <div class="w-full text-center">No.</div>
            </template>
            <template #body="slotProps">
              <div class="flex items-center justify-center">
                {{ slotProps.index + 1 }}
              </div>
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50" class="w-auto text-left">
            <template #header>
              <div class="w-full font-semibold text-left">Nama Obat</div>
            </template>
            <template #body="slotProps">
              <div v-if="slotProps.data.isCompound"> {{ slotProps.data.namaRacikan }} -
                {{ slotProps.data.bentukRacikan?.namaBentukRacikan }}
              </div>
              <div v-else>
                {{ slotProps.data.namaItem }} </div>
              <div class="flex gap-1.5 justify-left">
                <CustomChip
                  v-if="slotProps.data.isChronic" :showCheckedIcon="false"
                  label="OBAT KRONIS"
                  bgColor="bg-sunFlower-50"
                  textColor="text-sunFlower-300"
                  customClass="h-5 border-sunFlower-300"
                />
              </div>
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50" class="w-auto text-left">
            <template #header>
              <div class="w-full font-semibold text-left">Total Obat</div>
            </template>
            <template #body="slotProps">
              {{ slotProps.data.totalObat }}
              <span v-if="slotProps.data.isCompound">
                - {{ slotProps.data.bentukRacikan?.namaBentukRacikan }}
              </span>
              <span v-else>
                </span>
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50" class="w-auto text-left">
            <template #header>
              <div class="w-full font-semibold text-left">Dosis</div>
            </template>
            <template #body="slotProps">
              {{ slotProps.data.dosis }}
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
              {{ getStringRutePemberian(slotProps.data.rutePemberian) }}
            </template>
          </Column>
        </DataTable>
      </div>
    </template>
  </CustomDialog>
</template>