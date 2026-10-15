<script lang="ts" setup>
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import { ref, type PropType, watch, computed } from "vue";
import DialogAdjustItem from "@/views/Stok/Layout/StokAdjustment/DialogAdjustItem.vue";
import { useStokAdjustmentStore } from "@/stores/inventory/stokAdjustment";
import { utilsStore } from "@/stores/utils";

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    default: false,
  },
  detailData: {
    type: Object as PropType<Record<string, any> | null>,
    default: null,
  },
  lokasiStokUuid: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["update:isDialogVisible"]);
const StokAdjustmentStore = useStokAdjustmentStore();
const UseUtilsStore = utilsStore();

// state Management
const detailedItems = ref<any[]>([]);
const itemAdjustmentData = ref(null);
const totalStok = ref(0);

function updateVisibility(value: boolean) {
  if (!value) {
    detailedItems.value = [];
    totalStok.value = 0;
  }
  emit("update:isDialogVisible", value);
}

// fetch data item
const fetchItemDetails = async () => {
  if (!props.detailData?.uuid || !props.lokasiStokUuid) {
    detailedItems.value = [];
    return;
  }
  UseUtilsStore.setLoading(true);
  try {
    // Panggil API (sesuai kode Anda)
    const response = await StokAdjustmentStore.getDetailApi(
      props.lokasiStokUuid,
      props.detailData.uuid
    );
    if (response && response.payload && Array.isArray(response.payload.items)) {
      detailedItems.value = response.payload.items.map((item: any) => ({
        uuid: item.uuid,
        nama: item.nama,
        kategori: item.kategori,
        jenisStok: item.jenisStok,
        jenisItem: item.jenisItem,
        kategoriObat: item.kategoriObat,
        expDate: item.expDate ? new Date(item.expDate) : null,
        sisaStok: item.sisaStok,
      }));
      totalStok.value = response.payload.totalStok || 0;
    } else {
      detailedItems.value = [];
      totalStok.value = 0;
    }
  } catch (error) {
    console.error("Failed to fetch item details:", error);
    detailedItems.value = [];
    totalStok.value = 0;
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// Panggil fetch saat dialog terlihat
watch(
  () => props.isDialogVisible,
  (isVisible) => {
    if (isVisible) {
      fetchItemDetails();
    }
  }
);

// Dialog konfirmasi
const dialogAdjustItem = ref({
  isVisible: false,
  title: "",
});

function handleAdjustItem(values: any) {
  dialogAdjustItem.value.isVisible = true;
  dialogAdjustItem.value.title = "Adjust Item";
  itemAdjustmentData.value = {
    ...values,
    namaItem: props.detailData?.nama,
    satuanObat: props.detailData?.satuanObat,
  };
}
</script>

<template>
  <CustomDialog
    width="1000px"
    :visible="isDialogVisible"
    headerBg="bg-opensimrs-300"
    @update:visible="updateVisibility"
  >
    <template #header>{{ detailData?.nama }}</template>
    <template #body>
      <div class="py-5">
        <DataTable
          :value="detailedItems"
          tableStyle="min-width: 50rem"
          scrollable
          scrollHeight="240px"
          :pt="{ headerRow: 'text-SM' }"
        >
          <Column headerClass="bg-opensimrs-50" class="w-[40px]">
            <template #header>
              <div class="font-semibold">No</div>
            </template>
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.index + 1 }}</div>
            </template>
          </Column>

          <Column headerClass="bg-opensimrs-50">
            <template #header>
              <div class="font-semibold">Nama Item</div>
            </template>
            <template #body="slotProps">
              <div class="text-SM">{{ detailData?.nama }}</div>
              <CustomChip
                v-if="slotProps.data.kategori"
                :showCheckedIcon="false"
                :label="slotProps.data.kategori.toUpperCase()"
                bgColor="bg-opensimrs-300"
                textColor="text-white"
                customClass="h-5 pr-[6px] border-none mr-[5px]"
              />
              <CustomChip
                v-if="slotProps.data.jenisStok"
                :showCheckedIcon="false"
                :label="slotProps.data.jenisStok.toUpperCase()"
                bgColor="bg-opensimrs-300"
                textColor="text-white"
                customClass="h-5 pr-[6px] border-none mr-[5px]"
              />
              <CustomChip
                v-if="slotProps.data.jenisItem"
                :showCheckedIcon="false"
                :label="slotProps.data.jenisItem.toUpperCase()"
                bgColor="bg-opensimrs-300"
                textColor="text-white"
                customClass="h-5 pr-[6px] border-none mr-[5px]"
              />
              <CustomChip
                v-if="slotProps.data.kategoriObat"
                :showCheckedIcon="false"
                :label="slotProps.data.kategoriObat.toUpperCase()"
                bgColor="bg-opensimrs-300"
                textColor="text-white"
                customClass="h-5 pr-[6px] border-none mr-[5px]"
              />
            </template>
          </Column>

          <Column headerClass="bg-opensimrs-50" class="w-[180px]">
            <template #header>
              <div class="w-full font-semibold text-center">Exp. Date</div>
            </template>
            <template #body="slotProps">
              <CustomDatePicker
                :showLabel="false"
                :modelValue="new Date(slotProps.data.expDate)"
                @update:modelValue="
                  (newDate) => (slotProps.data.expDate = newDate)
                "
              />
            </template>
          </Column>

          <Column headerClass="bg-opensimrs-50" class="w-[180px]">
            <template #header>
              <div class="w-full font-semibold text-center">Stok</div>
            </template>
            <template #body="slotProps">
              <CustomInputNumber
                :showLabel="false"
                v-model="slotProps.data.sisaStok"
              >
                <template #appendText>
                  <div
                    class="flex justify-center items-center px-2 text-xs text-grey-400"
                  >
                    {{ detailData?.satuanObat || "" }}
                  </div>
                </template>
              </CustomInputNumber>
            </template>
          </Column>

          <Column headerClass="bg-opensimrs-50" class="w-[75px]">
            <template #header>
              <div class="w-full font-semibold text-center">Action</div>
            </template>
            <template #body="slotProps">
              <div class="flex justify-center items-center">
                <CustomButton
                  label="Adjust"
                  class="my-auto bg-opensimrs-300"
                  @click="handleAdjustItem(slotProps.data)"
                />
              </div>
            </template>
          </Column>
        </DataTable>

        <DialogAdjustItem
          v-model:is-dialog-visible="dialogAdjustItem.isVisible"
          :title="dialogAdjustItem.title"
          :detailData="itemAdjustmentData"
        />
      </div>
    </template>

    <template #footer>
      <div class="w-full font-semibold text-normal">
        Total Stok : {{ totalStok }} {{ detailData?.satuanObat || "" }}
      </div>
    </template>
  </CustomDialog>
</template>
