<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useMedicalItemStore } from "@/stores/datamasterFarmasi/MedicalItem";
import { useRoomPharmacyStore } from "@/stores/farmasi/RoomPharmacy";
import { utilsStore } from "@/stores/utils";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";

const props = defineProps({
  isDialogVisible: {
    default: false,
  },
  payloadEdit: {
    type: Object,
    default: () => ({}),
  },
});
const listAlkes = ref([
  {
    no: 1,
    alkes: "",
    jumlah: 0,
    satuan: "",
  },
]);
const alkesItem = ref<any>({});
const qty = ref(0);
const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);
const updateVisibility = (value: any) => {
  emit("update:isDialogVisible", value);
};
const closeDialog = () => {
  emit("update:isDialogVisible", false);
};

// State Management Medical Item
const medicalItemsStore = useMedicalItemStore();
const alkesPayload = ref<any[]>([]);

const preselectAlkesFromPayload = () => {
  const itemUuid = props.payloadEdit?.itemMedis?.uuid;
  qty.value = props.payloadEdit?.qty ?? qty.value;
  if (!itemUuid) {
    alkesItem.value = null;
    return;
  }
  const selected =
    alkesPayload.value.find((item: any) => item.uuid === itemUuid) || null;
  alkesItem.value = selected;
};

// Fetch Alkes
const fetchAlkes = async () => {
  try {
    const response = await medicalItemsStore.getWithoutPaginationApi("alkes");
    if (response && response.payload) {
      alkesPayload.value = response.payload;
    } else {
      alkesPayload.value = [];
    }
    preselectAlkesFromPayload();
  } catch (error) {
    console.error("Failed to fetch data", error);
    alkesPayload.value = [];
  }
};

// State Management Detail Room Pharmacy
const RoomPharmacyStoreStore = useRoomPharmacyStore();
const UseUtilsStore = utilsStore();

const editAlkes = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await RoomPharmacyStoreStore.updateAlkesItemApi(
      props.payloadEdit.uuid,
      {
        qty: qty.value,
        item_medis_uuid: alkesItem.value.uuid,
      }
    );
  } catch (error) {
    console.error("Failed to process the data:", error);
  } finally {
    UseUtilsStore.setLoading(false);
    emit("data-updated");
    closeDialog();
  }
};

const resetForm = () => {
  alkesItem.value = null;
  qty.value = 0;
};

watch(
  () => props.isDialogVisible,
  (visible) => {
    if (!visible) return;
    preselectAlkesFromPayload();
  }
);

onMounted(() => {
  fetchAlkes();
});
</script>

<template>
  <CustomDialog
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    width="700px"
  >
    <template #header>Edit Alkes</template>
    <template #body>
      <div class="grid grid-cols-1">
        <div class="mt-[20px]">
          <DataTable :value="listAlkes" :pt="{ headerRow: 'text-SM' }">
            <!-- No -->
            <Column headerClass="bg-opensimrs-50">
              <template #header>
                <div class="w-full font-bold">No</div>
              </template>
              <template #body="slotProps">
                <div class="flex">
                  <p class="text-xs">{{ slotProps.data.no }}</p>
                </div>
              </template>
            </Column>
            <!-- List Alkes -->
            <Column headerClass="bg-opensimrs-50">
              <template #header>
                <div class="w-full font-bold">List Alkes</div>
              </template>
              <template #body="slotProps">
                <CustomSelect
                  v-model="alkesItem"
                  place-holder="Pilih Alkes"
                  :show-label="false"
                  optionLabel="name"
                  optionValue=""
                  :options="alkesPayload"
                  class="w-[250px]"
                  data-key="uuid"
                />
              </template>
            </Column>
            <!-- Jumlah -->
            <Column field="jumlah" headerClass="bg-opensimrs-50">
              <template #header>
                <div class="w-full font-bold">Jumlah</div>
              </template>
              <template #body="slotProps">
                <CustomInputNumber
                  v-model="qty"
                  :show-label="false"
                  :show-buttons="true"
                  class="w-[130px]"
                />
              </template>
            </Column>
            <!-- Satuan -->
            <Column field="satuan" headerClass="bg-opensimrs-50">
              <template #header>
                <div class="w-full font-bold">Satuan</div>
              </template>
              <template #body="slotProps">
                <div class="flex">
                  <p class="text-xs">
                    {{ alkesItem?.satuanPenggunaan?.name || "-" }}
                  </p>
                </div>
              </template>
            </Column>
          </DataTable>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end">
        <CustomButton
          @click="resetForm"
          label="Reset"
          outlined
          borderColor="border-grey-200"
          textColor="text-grey-300"
        />
        <CustomButton
          label="Simpan Edit"
          class="ml-[10px]"
          @click="editAlkes"
        />
      </div>
    </template>
  </CustomDialog>
</template>
