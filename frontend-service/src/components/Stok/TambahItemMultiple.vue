<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomButton from "@/components/Base/CustomButton.vue";

const isDialogVisible = ref(true);

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  showHeaderInfo: {
    type: Boolean,
    default: true,
  },
  fieldData: {
    type: Object,
    default: () => {},
  },
  fetchOptions: {
    type: Array,
    default: () => [],
  },
});

watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      // reset semua state ketika dialog dibuka
      selectedDrugCode.value = null;
      stokTujuan.value = "";
      rows.value = [];
    }
  }
);

const emit = defineEmits(["update:visible", "ambil-items"]);
const visible = computed({
  get: () => props.visible,
  set: (val: boolean) => emit("update:visible", val),
});

// State pilihan & input
const selectedDrugCode = ref<string | null>(null);
const stokTujuan = ref<string>("-");

const currentFilter = ref("");

const onFilter = (value: string) => {
  currentFilter.value = value;
};

watch(selectedDrugCode, () => {
  currentFilter.value = "";
});

const isPlusButtonDisabled = computed(() => {
  if (!selectedDrugCode.value) return true;

  const q = currentFilter.value.trim().toLowerCase();
  if (q) {
    const item = (props.fetchOptions as any[]).find(
      (i: any) => i.itemUuid === selectedDrugCode.value
    );
    if (!item) return true;
    const name = String(item.itemName || "").toLowerCase();
    if (!name.includes(q)) return true;
  }
  return false;
});

type SelectedRow = {
  no: number;
  itemUuid: string;
  name: string;
  sisaStok: number;
  stokTujuan: number;
  hargaSatuan: number;
};
// Tabel hasil pilihan
const rows = ref<SelectedRow[]>([]);

const addToTable = () => {
  const item = (props.fetchOptions as any[]).find(
    (i: any) => i.itemUuid === selectedDrugCode.value
  );
  if (!item) return;
  rows.value.push({
    no: rows.value.length + 1,
    itemUuid: item.itemUuid,
    name: item.itemName,
    sisaStok: item.jumlahTersedia ?? 0,
    stokTujuan: Number(stokTujuan.value),
    hargaSatuan: item.hargaSatuan ?? 0,
  });
  // reset input kecil
  selectedDrugCode.value = null;
  stokTujuan.value = "";
};

const submitSelection = () => {
  // Prefer rows, but fall back to single selected item
  const uuids = rows.value.map((r) => r.itemUuid).filter(Boolean);
  if (uuids.length === 0 && selectedDrugCode.value) {
    uuids.push(selectedDrugCode.value);
  }
  if (uuids.length === 0) {
    emit("update:visible", false);
    return;
  }
  emit("ambil-items", uuids);
  rows.value = [];
  selectedDrugCode.value = null;
  emit("update:visible", false);
};

const removeRow = (index: number) => {
  rows.value.splice(index, 1);
  // normalisasi nomor
  rows.value.forEach((r, i) => (r.no = i + 1));
};

const clearAllRows = () => {
  rows.value = [];
};

watch(
  () => props.fetchOptions,
  (newVal) => {
    console.log("fetchOptions updated:", newVal);
  },
  { immediate: true }
);
</script>

<template>
  <CustomDialog
    v-model:visible="visible"
    width="920px"
    headerBg="bg-opensimrs-300"
    headerHeight="h-[54px]"
    :noScroll="true"
    @close-dialog="emit('update:visible', false)"
  >
    <template #header>
      <div class="flex justify-between items-center w-full">
        <p class="text-lg font-semibold">Tambah Item Multiple</p>
      </div>
    </template>
    <template #body>
      <div class="py-4 space-y-5">
        <div
          v-if="showHeaderInfo"
          class="flex justify-between items-center px-4 py-2 border-b border-gray-300"
        >
          <div>
            <div class="font-semibold underline">Kategori Item</div>
            <div>{{ fieldData?.kategoriItem }}</div>
          </div>
          <div>
            <div class="font-semibold underline">Jenis Stok</div>
            <div>{{ fieldData?.jenisStok }}</div>
          </div>
          <div>
            <div class="font-semibold underline">jenis Item</div>
            <div>{{ fieldData?.jenisItem }}</div>
          </div>
        </div>
        <div class="flex gap-4 items-end">
          <CustomSelect
            label="Cari Item"
            v-model="selectedDrugCode"
            class="flex-1"
            :options="fetchOptions"
            optionLabel="itemName"
            optionValue="itemUuid"
            placeHolder="Pilih Obat"
            @filter="onFilter"
          />
          <CustomButton
            icon="PhPlus"
            @click="addToTable"
            :disabled="isPlusButtonDisabled"
          />
        </div>
        <DataTable :value="rows" stripedRows class="text-xs">
          <Column header="No" headerClass="bg-opensimrs-50" field="no" />
          <Column header="Nama Obat" headerClass="bg-opensimrs-50" field="name" />
          <Column header="" headerClass="bg-opensimrs-50" field="">
            <template #header>
              <div class="w-full font-semibold text-center">Sisa Stok</div>
            </template>
            <template #body="slotProps">
              <div class="w-full text-center">
                {{ slotProps.data.sisaStok || 0 }}
              </div>
            </template>
          </Column>
          <Column header="" headerClass="bg-opensimrs-50" field="">
            <template #header>
              <div class="w-full font-semibold text-center">Stok Tujuan</div>
            </template>
            <template #body="slotProps">
              <div class="w-full text-center">
                {{ slotProps.data.stokTujuan || 0 }}
              </div>
            </template>
          </Column>
          <Column header="" headerClass="bg-opensimrs-50">
            <template #header>
              <div class="w-full font-semibold text-center">Action</div>
            </template>
            <template #body="slotProps">
              <div class="flex justify-center items-center w-full">
                <CustomButton
                  label=""
                  backgroundColor="bg-danger-300 rounded-lg"
                  class="h-6 w-[26px] p-0"
                  @click="removeRow(slotProps.index)"
                >
                  <img src="@/assets/icons/delete.svg" alt="delete" />
                </CustomButton>
              </div>
            </template>
          </Column>
        </DataTable>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-between items-center">
        <div class="font-bold">Total Item Terpilih: {{ rows.length }}</div>
        <div class="flex gap-2">
          <CustomButton
            label="Hapus Semua"
            backgroundColor="bg-transparent"
            borderColor="border-danger-300"
            textColor="text-danger-300"
            @click="clearAllRows"
          />
          <CustomButton
            label="Ambil Item"
            backgroundColor="bg-opensimrs-300"
            textColor="text-white"
            :disabled="rows.length === 0"
            @click="submitSelection"
          />
        </div>
      </div>
    </template>
  </CustomDialog>
</template>

<style lang="scss" scoped></style>
