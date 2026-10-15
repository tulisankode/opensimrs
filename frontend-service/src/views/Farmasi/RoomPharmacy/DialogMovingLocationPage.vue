<script setup lang="ts">
import { ref, onMounted, watch, toRaw, computed } from "vue";
import { useRoomPharmacyStore } from "@/stores/farmasi/RoomPharmacy";
import { useStockLocationStore } from "@/stores/datamasterFarmasi/StockLocation";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import { utilsStore } from "@/stores/utils";

const props = defineProps({
  isDialogVisible: {
    default: false,
  },
  payloadMoving: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);
const updateVisibility = (value: any) => {
  emit("update:isDialogVisible", value);
};
const closeDialog = () => {
  emit("update:isDialogVisible", false);
};

const startingLocation = ref("");
const destinationLocation = ref("");

// State Management
const RoomPharmacyStoreStore = useRoomPharmacyStore();
const StockLocationStore = useStockLocationStore();
const UseUtilsStore = utilsStore();
const StockLocationPayload = ref<any[]>([]);
const DestinationStockLocationPayload = computed(() =>
  StockLocationPayload.value.filter(
    (item: any) => item.uuid !== startingLocation.value
  )
);

const fetchStockLocation = async () => {
  try {
    const response = await StockLocationStore.getApi();

    if (response && response.payload) {
      StockLocationPayload.value = response.payload;
      console.log("StockLocationPayload:", StockLocationPayload.value);
    } else {
      StockLocationPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    StockLocationPayload.value = [];
  }
};

const movingLocation = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await RoomPharmacyStoreStore.updateLocationApi({
      uuid: props.payloadMoving.uuid,
      lokasiStokUuid: destinationLocation.value,
    });
    destinationLocation.value = "";
    closeDialog();
    emit("data-updated");
  } catch (error) {
    console.error("Failed to process the data:", error);
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

onMounted(() => {
  fetchStockLocation();
});

watch(
  () => props.isDialogVisible,
  (newValue) => {
    if (newValue) {
      if (props.payloadMoving) {
        const selectedAlkes = StockLocationPayload.value.find(
          (item: any) => props.payloadMoving.lokasiStokUuid == item.uuid
        );
        // Hindari error jika selectedAlkes belum ditemukan
        startingLocation.value = selectedAlkes?.uuid || "";
      }
      // Log saat dialog dibuka dengan payload terbaru
      console.log("payloadMoving (visible):", toRaw(props.payloadMoving));
    }
  }
);

console.log("payloadMoving:", props.payloadMoving);
</script>

<template>
  <CustomDialog
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    width="550px"
  >
    <template #header>Pindah Lokasi Order</template>
    <template #body>
      <div class="grid grid-cols-[45%,10%,45%]">
        <div class="mt-[20px]">
          <CustomSelect
            v-model="startingLocation"
            place-holder="Lokasi Awal Order"
            label="Lokasi Awal Order"
            optionLabel="name"
            optionValue="uuid"
            :options="StockLocationPayload"
            disabled
          />
        </div>
        <div class="">
          <ArrowRightBrokenIcon
            :size="20"
            class="text-opensimrs-300 ml-[15px] mt-[55px]"
            weight="bold"
          />
        </div>
        <div class="mt-[20px]">
          <CustomSelect
            v-model="destinationLocation"
            place-holder="Pilih Lokasi"
            label="Pindah Lokasi Ke"
            optionLabel="name"
            optionValue="uuid"
            :options="DestinationStockLocationPayload"
          />
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end">
        <CustomButton
          label="Batal"
          outlined
          class=""
          borderColor="border-grey-200"
          textColor="text-grey-300"
          @click="closeDialog"
        />
        <CustomButton
          label="Pindahkan"
          class="ml-[10px]"
          @click="movingLocation"
        />
      </div>
    </template>
  </CustomDialog>
</template>
