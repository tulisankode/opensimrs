<script setup lang="ts">
import { ref, watch, type PropType } from "vue";

import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import TambahDataKonfigurasiLayar from "../Konfigurasi/KonfigurasiLayar/SectionTambahKonfigurasiLayar.vue";
import { useDebounceFn } from "@vueuse/core";

const props = defineProps({
  title: {
    type: String,
    default: "Title",
  },
  filter: {
    type: Boolean,
    default: true,
  },
  search: {
    type: Boolean,
    default: true,
  },
  availableTipeLayar: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["search", "reset", "daftar", "refresh"]);

function handleRefresh() {
  emit("refresh");
}

const searchQuery = ref("");
const selectedLayar = ref<any>();
const resetKey = ref(0);

// Fungsi untuk melakukan pencarian
const performSearch = () => {
  emit(
    "search",
    searchQuery.value,
    selectedLayar.value,
    selectedPaymentMethod.value
  );
};

// Debounced search function dengan delay 500ms
const debouncedSearch = useDebounceFn(performSearch, 500);

const dialogData = ref({
  isVisible: false,
  method: "add",
  title: "Tambah",
});

function handleAdd() {
  dialogData.value = {
    isVisible: true,
    method: "add",
    title: "Tambah",
  };
}

function handleEdit() {
  dialogData.value = {
    isVisible: true,
    method: "edit",
    title: "Edit",
  };
}

function handleClose() {
  dialogData.value.isVisible = false;
}

const selectedPaymentMethod = ref<string[]>([]);
const onPaymentMethodSelect = (label: string) => {
  if (selectedPaymentMethod.value.includes(label)) {
    selectedPaymentMethod.value = selectedPaymentMethod.value.filter(
      (item) => item != label
    );
  } else {
    selectedPaymentMethod.value.push(label);
  }

  // Trigger auto-search dengan debounce ketika chip dipilih
  debouncedSearch();
};

// Handle search button click
const handleSearchClick = () => {
  // Langsung jalankan performSearch tanpa debounce untuk tombol cari
  performSearch();
};

const filters = [selectedPaymentMethod];

const resetFilter = () => {
  filters.forEach((filter) => {
    filter.value = [];
  });
  selectedLayar.value = null;
  searchQuery.value = "";
  resetKey.value++;

  emit("reset");
};

watch(
  () => props.availableTipeLayar,
  (newOptions) => {
    const exists =
      Array.isArray(newOptions) &&
      newOptions.some(
        (opt: any) => String(opt.code) === String(selectedLayar.value)
      );
    if (!exists && selectedLayar.value != null) {
      selectedLayar.value = null;
    }
  }
);

defineExpose({
  resetFilter,
});
</script>

<template>
  <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
  <PageToolbar>
    <CustomButton
      label=""
      icon="PhArrowClockwise"
      @click="resetFilter"
      title="refresh"
    />
    <h1 class="toolbar-heading flex items-center text-opensimrs-300">
      Konfigurasi
      <PhCaretRight :size="16" class="mx-1 text-cyan-500" aria-hidden="true" />
      <span class="text-grey-400">Layar Antrian</span>
    </h1>
    <CustomTextfield
      v-if="search"
      v-model="searchQuery"
      :label="`Cari Layar`"
      prependIcon="PhMagnifyingGlass"
      :placeholder="`Cari Nama Layar`"
      @keydown.enter="handleSearchClick"
    >
    </CustomTextfield>
    <CustomSelect
      :key="resetKey"
      v-model="selectedLayar"
      :options="availableTipeLayar"
      optionValue="code"
      optionLabel="tipe_layar"
      :is-loading="false"
      label="Tipe Layar"
      place-holder="Semua"
    />
    <ToolbarFilterMenu :count="selectedPaymentMethod.length">
      <template #label>Status</template>
      <CustomChip
        label="Aktif"
        :isSelected="selectedPaymentMethod.includes('AKTIF')"
        @selected="onPaymentMethodSelect"
      />
      <CustomChip
        label="NON-AKTIF"
        :isSelected="selectedPaymentMethod.includes('NON-AKTIF')"
        @selected="onPaymentMethodSelect"
      />
    </ToolbarFilterMenu>
    <CustomButton
      icon="PhMagnifyingGlass"
      label="Cari"
      @click="handleSearchClick"
    />
    <CustomButton
      @click="resetFilter"
      label="Reset"
      outlined
      borderColor="border-opensimrs-300"
      textColor="text-opensimrs-300"
    />
    <CustomButton
      @click="handleAdd"
      icon="PhPlus"
      label="Layar Antrian"
    />
    <slot name="header"></slot>
  </PageToolbar>
  <TambahDataKonfigurasiLayar
    :full-screen="true"
    v-model:isDialogVisible="dialogData.isVisible"
    :title="dialogData.title"
    :method="dialogData.method"
    @close="handleClose"
    @refresh="handleRefresh"
  />
</template>
