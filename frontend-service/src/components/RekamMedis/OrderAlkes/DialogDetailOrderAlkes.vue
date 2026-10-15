<script lang="ts" setup>
import type { PropType } from "vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import { epochToDate } from "@/utils/Helpers";

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: "Tambah",
  },
  dataDetail: {
    type: Object as PropType<any>,
    default: () => {},
  },
  alkesData: {
    type: Object as PropType<any>,
    default: () => {},
  },
});

const emit = defineEmits(["update:isDialogVisible", "submit-order"]);

function updateVisibility(value: boolean) {
  emit("update:isDialogVisible", value);
}
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
        <div class="flex">
          <CustomInfoRow
            type="vertical"
            label="Pengorder Alkes"
            :value="alkesData.petugasOrder"
          />
          <CustomInfoRow
            type="vertical"
            label="Tgl. Order"
            :value="String(epochToDate(alkesData.createdAt, 'date'))"
          />
          <CustomInfoRow
            type="vertical"
            label="Lokasi Tujuan Order"
            :value="alkesData.lokasiStok"
          />
        </div>
        <hr />
        <DataTable
          :value="dataDetail.alkesItems"
          tableStyle="min-width: 50rem"
          class="overflow-hidden text-xs rounded-lg bg-opensimrs-50"
        >
          <Column
            headerClass="bg-opensimrs-50 font-semibold text-SM"
            class="w-[20px]"
          >
            <template #header>
              <div class="flex items-center">No.</div>
            </template>
            <template #body="slotProps">
              <div class="flex items-center justify-center">
                {{ slotProps.index + 1 }}
              </div>
            </template>
          </Column>

          <Column headerClass="bg-opensimrs-50" class="w-[500px]">
            <template #header>
              <div class="font-semibold">Nama Alkes</div>
            </template>
            <template #body="slotProps">
              {{ slotProps.data?.itemMedis?.name }}
            </template>
          </Column>

          <Column headerClass="bg-opensimrs-50 " class="w-[300px]">
            <template #header>
              <div class="w-full font-semibold text-center">Jumlah</div>
            </template>
            <template #body="slotProps">
              <div class="w-full text-center">
                {{ slotProps.data?.qty }}
              </div>
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50 w-[300px]">
            <template #header>
              <div class="w-full font-semibold text-center">Satuan</div>
            </template>
            <template #body="slotProps">
              <div class="text-center">
                {{ slotProps.data?.itemMedis?.satuanPenggunaan?.name }}
              </div>
            </template>
          </Column>
        </DataTable>
      </div>
    </template>
  </CustomDialog>
</template>
