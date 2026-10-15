<script setup lang="ts">
import { ref, watch } from "vue";
import { useUnitOfExpenditureStore } from "@/stores/inventory/unitOfExpenditure";
import { dateToEpoch } from "@/utils/Helpers";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue"; 

const props = defineProps({
  visible: { type: Boolean, default: false },
  // Parameter API
  jenisItem: { type: String, default: "" },
  kategoriItem: { type: String, default: "" },
  jenisStokUuid: { type: String, default: "" },
  lokasiStokUuid: { type: String, default: "" },
  tanggalPengeluaran: { type: [String, Date], default: "" },
});

const emit = defineEmits(["update:visible", "save"]);

// State
const UnitOfExpenditureStore = useUnitOfExpenditureStore();
const availableItemsOptions = ref<any[]>([]);
const selectedTempItem = ref("");
const tempSelectedList = ref<any[]>([]);
const loading = ref(false);

const updateVisibility = (val: boolean) => {
  emit("update:visible", val);
};

// --- Logic Fetch Data ---
const fetchAvailableItems = async () => {
  if (
    !props.tanggalPengeluaran ||
    !props.jenisStokUuid ||
    !props.lokasiStokUuid ||
    !props.jenisItem ||
    !props.kategoriItem
  ) {
    availableItemsOptions.value = [];
    return;
  }

  loading.value = true;
  try {
    const tglEpoch =
      props.tanggalPengeluaran instanceof Date
        ? dateToEpoch(props.tanggalPengeluaran)
        : typeof props.tanggalPengeluaran === "string"
        ? dateToEpoch(new Date(props.tanggalPengeluaran))
        : props.tanggalPengeluaran;

    const response = await UnitOfExpenditureStore.getApiAvailable(
      tglEpoch,
      props.jenisStokUuid,
      props.lokasiStokUuid,
      props.jenisItem,
      props.kategoriItem
    );

    if (response && response.payload) {
      availableItemsOptions.value = response.payload.map((item: any) => ({
        uuid: item.uuid,
        name: item.name,
        stockMedisUuid: item.stockMedisUuid, 
        stok: item.sisaStok,                  
        hargaDasar: item.hargaDasar,          
        expDate: item.expDate,                
        displayName: `${item.name}`, 
      }));
    } else {
      availableItemsOptions.value = [];
    }
  } catch (error) {
    console.error("Gagal mengambil item available:", error);
    availableItemsOptions.value = [];
  } finally {
    loading.value = false;
  }
};

// --- Watchers & Handlers ---
watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      tempSelectedList.value = [];
      selectedTempItem.value = "";
      fetchAvailableItems();
    }
  }
);

const handleAddItem = () => {
  if (!selectedTempItem.value) return;

  const itemData = availableItemsOptions.value.find(
    (i) => i.uuid === selectedTempItem.value
  );

  if (itemData) {
    const isExist = tempSelectedList.value.some(
      (i) => i.uuid === itemData.uuid
    );
    if (!isExist) {
      tempSelectedList.value.push(itemData);
    }
    selectedTempItem.value = "";
  }
};

const handleDeleteItem = (index: number) => {
  tempSelectedList.value.splice(index, 1);
};

const handleRemoveAll = () => {
  tempSelectedList.value = [];
};

const handleSave = () => {
  emit("save", tempSelectedList.value);
  emit("update:visible", false);
};
</script>

<template>
  <CustomDialog
    width="800px"
    :visible="visible"
    headerBg="bg-opensimrs-300"
    @update:visible="updateVisibility"
  >
    <template #header> Tambah Item Multiple </template>

    <template #body>
      <div class="flex flex-col gap-4 mt-2">
        <div>
          <p class="mb-2 font-semibold">Cari Item</p>
          <div class="flex gap-2">
            <div class="w-full">
              <CustomSelect
                v-model="selectedTempItem"
                :options="availableItemsOptions"
                optionLabel="displayName"
                optionValue="uuid"
                placeholder="Cari & Pilih Item..."
                prependIcon="PhMagnifyingGlass"
                :showLabel="false"
              />
            </div>
            <CustomButton
              icon="PhPlus"
              @click="handleAddItem"
              background-color="bg-opensimrs-300"
              text-color="text-white"
              v-tooltip="'Tambahkan Item'"
            />
          </div>
        </div>

        <div class="relative overflow-y-auto" style="max-height: 300px">
          <DataTable
            :value="tempSelectedList"
            class="text-black"
            stripedRows
            scrollable
            scrollHeight="flex"
            :pt="{ headerRow: 'text-sm' }"
          >
            <template #empty>
              <div class="text-center p-4 text-grey-400">
                Belum ada item yang dipilih.
              </div>
            </template>

            <Column header="No." headerClass="bg-opensimrs-50">
              <template #body="slotProps">
                {{ slotProps.index + 1 }}
              </template>
            </Column>

            <Column field="name" header="Nama Obat" headerClass="bg-opensimrs-50">
              <template #body="{ data }">
                <div >{{ data.name }}</div>
              </template>
            </Column>

            <Column field="stok" header="Sisa Stok" headerClass="bg-opensimrs-50">
              <template #body="{ data }">
                <span >{{ data.stok }}</span>
              </template>
            </Column>

            <Column
              header="Action"
              headerClass="bg-opensimrs-50"
              bodyClass="text-center"
            >
              <template #body="slotProps">
                <CustomButton
                  :showLabel="false"
                  background-color="bg-danger-300 rounded-lg"
                  class="h-[25px] w-[25px] flex items-center justify-center p-0"
                  @click="handleDeleteItem(slotProps.index)"
                >
                  <PhTrash :size="15" weight="fill" class="text-white" />
                </CustomButton>
              </template>
            </Column>
          </DataTable>
        </div>

        <div class="flex justify-between items-center mt-2">
          <p class="font-semibold">
            Total Item Terpilih:
            <span class="text-opensimrs-500">{{ tempSelectedList.length }}</span>
          </p>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 mt-4">
        <CustomButton
          label="Hapus Semua"
          outlined
          borderColor="border-danger-300"
          textColor="text-danger-300"
          @click="handleRemoveAll"
        />
        <CustomButton
          label="Ambil Item"
          backgroundColor="bg-opensimrs-300"
          textColor="text-white"
          @click="handleSave"
          :disabled="tempSelectedList.length === 0"
        />
      </div>
    </template>
  </CustomDialog>
</template>