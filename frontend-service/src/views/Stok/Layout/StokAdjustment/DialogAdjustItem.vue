<script lang="ts" setup>
import { useStokAdjustmentStore } from "@/stores/inventory/stokAdjustment";
import { utilsStore } from "@/stores/utils"; // Import utilsStore
import { formatDate } from "@/utils/Helpers"; // Import formatDate
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import { ref, type PropType } from "vue";

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
  },
  detailData: {
    type: Object as PropType<Record<string, any> | null>,
    default: null,
  },
});

const emit = defineEmits(["update:isDialogVisible", "adjusted"]); // Tambah emit 'adjusted'

const StokAdjustmentStore = useStokAdjustmentStore(); // Init store
const UseUtilsStore = utilsStore(); // Init utilsStore

function updateVisibility(value: boolean) {
  emit("update:isDialogVisible", value);
}

// konfirmasi ubah data
const confirmAdjustment = async () => {
  if (!props.detailData || !props.detailData.uuid) {
    console.error("Data item untuk adjustment tidak valid.");
    return;
  }

  UseUtilsStore.setLoading(true);
  try {
    let formattedExpDate = "";
    if (props.detailData.expDate instanceof Date) {
      formattedExpDate = formatDate(props.detailData.expDate, true);
    } else if (typeof props.detailData.expDate === "string") {
      try {
        const dateObj = new Date(props.detailData.expDate);
        if (!isNaN(dateObj.getTime())) {
          formattedExpDate = formatDate(dateObj, true);
        } else {
          throw new Error("Invalid date string");
        }
      } catch (e) {
        console.error(
          "Gagal format tanggal string:",
          props.detailData.expDate,
          e
        );
        UseUtilsStore.setLoading(false);
        return;
      }
    } else {
      console.error("Format expDate tidak dikenali:", props.detailData.expDate);
      UseUtilsStore.setLoading(false);
      return;
    }
    const payload = {
      uuid: props.detailData.uuid,
      expDate: formattedExpDate,
      sisaStok: props.detailData.sisaStok,
    };

    console.log("Mengirim payload adjustment:", payload);
    await StokAdjustmentStore.putApi(payload);
    emit("adjusted");
    updateVisibility(false);
  } catch (error) {
    console.error("Gagal melakukan adjustment:", error);
  } finally {
    UseUtilsStore.setLoading(false);
  }
};
</script>

<template>
  <CustomDialog
    width="650px"
    :visible="isDialogVisible"
    headerBg="bg-opensimrs-300"
    @update:visible="updateVisibility"
  >
    <template #header>{{ title }} </template>
    <template #body>
      <!-- {{ detailData }} -->
      <div class="py-5 italic font-normal text-normal text-danger-300">
        *Setelah simpan, stok akan mengupdate sesuai hasil adjustment
      </div>
    </template>
    <template #footer>
      <div class="flex gap-2.5 justify-end">
        <CustomButton
          label="Tidak"
          textColor="text-[#9DA4B1]"
          backgroundColor="bg-transparent"
          borderColor="border-2 border-[#9DA4B1]"
          @click="updateVisibility(false)"
        />
        <CustomButton label="Iya, Adjust Item" @click="confirmAdjustment" />
      </div>
    </template>
  </CustomDialog>
</template>
