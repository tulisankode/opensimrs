<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRoomPharmacyStore } from "@/stores/farmasi/RoomPharmacy";
import { useForm, useFieldArray, ErrorMessage } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import { useUnitStore } from "@/stores/datamasterFarmasi/Unit";
import * as yup from "yup";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";

const props = defineProps({
  isDialogVisible: {
    default: false,
  },
  payloadCancel: {
    type: Object,
    default: () => ({}),
  },
});

const alasanBatal = ref("");

const listAlkes = ref([
  {
    no: 1,
    sisaStok: 0,
    hargaSatuan: 0,
    total: 0,
  },
]);

const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);
const updateVisibility = (value: any) => {
  emit("update:isDialogVisible", value);
};
const closeDialog = () => {
  emit("update:isDialogVisible", false);
};

// State Management
const RoomPharmacyStoreStore = useRoomPharmacyStore();

const cancelOrder = async (uuid: string) => {
  try {
    const response = await RoomPharmacyStoreStore.cancelOrderApi(uuid, {
      alasanBatal: alasanBatal.value,
    });
    emit("data-updated");
  } catch (error) {
    console.error("Failed to process the data:", error);
  }
  closeDialog();
  alasanBatal.value = "";
};
</script>
<template>
  <CustomDialog
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    width="550px"
    headerBg="bg-danger-300"
  >
    <template #header>Batal Order</template>
    <template #body>
      <div class="grid grid-cols-1">
        <div class="mt-[20px]">
          <p class="font-bold">Alasan Membatalkan Order</p>
        </div>
        <div class="mt-[10px]">
          <CustomTextfield
            v-model="alasanBatal"
            :showLabel="false"
            placeholder="Alasan Membatalkan Order"
          />
        </div>
        <div class="mt-[10px]">
          <p class="text-sm italic text-danger-300">
            *Setelah membatalkan, <span class="font-bold">Dokter</span> harus
            mengorderkan ulang obatnya
          </p>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end">
        <CustomButton
          @click="closeDialog"
          label="Tidak"
          outlined
          borderColor="border-grey-200"
          textColor="text-grey-300"
        />
        <CustomButton
          @click="cancelOrder(payloadCancel.uuid)"
          label="Iya, Batalkan Order"
          backgroundColor="bg-danger-300"
          borderColor="border-danger-300"
          textColor="text-white"
          class="ml-[10px]"
        />
      </div>
    </template>
  </CustomDialog>
</template>
