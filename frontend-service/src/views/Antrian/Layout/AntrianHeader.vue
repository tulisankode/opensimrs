<script setup lang="ts">
import { ref, computed, watch } from "vue";

import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { useDebounceFn } from "@vueuse/core";
import { dateToEpoch, epochToDate, setTimeForDate } from "@/utils/Helpers";

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
  activeTab: {
    type: String,
    required: true,
  },
  startDateEpoch: {
    type: Number,
    default: undefined,
  },
  endDateEpoch: {
    type: Number,
    default: undefined,
  },
});

const chipValues = ref(["SEMUA"]);

// Function untuk handle chip selection
const handleChipSelect = (value: string) => {
  if (value === "SEMUA") {
    // Jika SEMUA dipilih, clear semua selection dan pilih hanya SEMUA
    chipValues.value = ["SEMUA"];
  } else {
    // Remove SEMUA jika ada chip lain yang dipilih
    chipValues.value = chipValues.value.filter((v) => v !== "SEMUA");

    // Toggle selection untuk chip yang diklik
    const index = chipValues.value.indexOf(value);
    if (index > -1) {
      chipValues.value.splice(index, 1);
    } else {
      chipValues.value.push(value);
    }

    // Jika tidak ada yang terpilih, set ke SEMUA
    if (chipValues.value.length === 0) {
      chipValues.value = ["SEMUA"];
    }
  }

  // Pindahkan trigger ke sini agar SEMUA juga terpicu (auto-trigger, debounce 300ms)
  if (["0", "1", "2"].includes(props.activeTab)) {
    debouncedSearch();
  }
};

// Helper function untuk check apakah chip terpilih
const isChipSelected = (value: string) => {
  return chipValues.value.includes(value);
};

const startDateFilter = ref<Date | null>(new Date());
const endDateFilter = ref<Date | null>(new Date());
const searchPatientFilter = ref<string>("");

// emit event pencarian dan rentang tanggal
const emit = defineEmits<{
  search: [q: string, statuses?: string[]];
  dateRange: [start_date?: number | null, end_date?: number | null];
}>();

// Fallback tanggal untuk tampilan (display purpose only)
const today = new Date();

const getSelectedStatusCodes = (): string[] => {
  if (chipValues.value.includes("SEMUA")) return [];
  const set = new Set<string>();
  for (const v of chipValues.value) {
    switch (v) {
      case "ANTRI":
        set.add("0");
        set.add("1");
        set.add("2");
        break;
      case "PROSES":
        set.add("3");
        break;
      case "SELESAI":
        set.add("4");
        break;
      case "PENYERAHAN_OBAT":
        set.add("5");
        break;
    }
  }
  return Array.from(set);
};

// Auto-trigger (chip) dengan debounce 300ms
const performSearch = () => {
  if (["0", "1", "2"].includes(props.activeTab)) {
    emit("search", searchPatientFilter.value.trim(), getSelectedStatusCodes());
  }
};
const debouncedSearch = useDebounceFn(performSearch, 300);

// Hanya jalankan pencarian untuk tab Rawat Jalan (activeTab === '1')
const onClickSearch = () => {
  if (["0", "1", "2"].includes(props.activeTab)) {
    emit("search", searchPatientFilter.value.trim(), getSelectedStatusCodes());
    emit(
      "dateRange",
      dateToEpoch(setTimeForDate(startDateFilter.value as Date, 0, 0, 0)),
      dateToEpoch(setTimeForDate(endDateFilter.value as Date, 23, 59, 59))
    );
  }
};

// Reset input dan kirim empty query agar hasil pencarian direset
const onClickReset = () => {
  searchPatientFilter.value = "";
  chipValues.value = ["SEMUA"];
  if (["0", "1", "2"].includes(props.activeTab)) {
    startDateFilter.value = setTimeForDate(new Date(), 0, 0, 0);
    endDateFilter.value = setTimeForDate(new Date(), 23, 59, 59);
    emit("search", "", getSelectedStatusCodes());
    emit(
      "dateRange",
      dateToEpoch(setTimeForDate(startDateFilter.value, 0, 0, 0)),
      dateToEpoch(setTimeForDate(endDateFilter.value, 23, 59, 59))
    );
  } else {
    startDateFilter.value = null;
    endDateFilter.value = null;
    emit("search", "");
    emit("dateRange", null, null);
  }
};

// Reset otomatis ketika pindah tab ke selain Rawat Jalan
watch(
  () => props.activeTab,
  (newVal) => {
    chipValues.value = ["SEMUA"];

    if (["0", "1", "2"].includes(props.activeTab)) {
      // Reset pencarian dan tanggal ke hari ini (00:00:00) saat kembali ke tab antrian
      searchPatientFilter.value = "";
      startDateFilter.value = setTimeForDate(new Date(), 0, 0, 0);
      endDateFilter.value = setTimeForDate(new Date(), 23, 59, 59);
      emit("search", "");
      emit(
        "dateRange",
        dateToEpoch(setTimeForDate(startDateFilter.value, 0, 0, 0)),
        dateToEpoch(setTimeForDate(endDateFilter.value, 23, 59, 59))
      );
    } else {
      // Kosongkan tanggal jika keluar dari tab antrian
      startDateFilter.value = null;
      endDateFilter.value = null;
      emit("dateRange", null, null);
    }
  }
);
</script>

<template>
  <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
  <PageToolbar>
    <CustomButton
      label=""
      icon="PhArrowClockwise"
      @click="onClickReset"
      title="refresh"
    />
    <h1 class="toolbar-heading text-opensimrs-300">Data Antrian</h1>
    <CustomTextfield
      v-model="searchPatientFilter"
      prependIcon="PhMagnifyingGlass"
      label="Cari Pasien"
      placeholder="Cari Nama Pasien"
      @keydown.enter="onClickSearch"
    />
    <CustomDatePicker
      v-model="startDateFilter"
      label="Tanggal mulai"
      class="toolbar-field--date"
    />
    <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
    <CustomDatePicker
      v-model="endDateFilter"
      label="Tanggal selesai"
      class="toolbar-field--date"
    />
    <ToolbarFilterMenu
      :count="chipValues.filter((v) => v !== 'SEMUA').length"
    >
      <template #label>Status</template>
      <CustomChip
        :isSelected="isChipSelected('SEMUA')"
        label="Semua"
        @selected="handleChipSelect('SEMUA')"
      />
      <CustomChip
        :isSelected="isChipSelected('ANTRI')"
        label="Antri"
        @selected="handleChipSelect('ANTRI')"
      />
      <CustomChip
        :isSelected="isChipSelected('PROSES')"
        label="Proses"
        @selected="handleChipSelect('PROSES')"
      />
      <CustomChip
        :isSelected="
          isChipSelected(activeTab === '2' ? 'PENYERAHAN_OBAT' : 'SELESAI')
        "
        :label="activeTab === '2' ? 'PENYERAHAN OBAT' : 'SELESAI'"
        @selected="
          handleChipSelect(
            activeTab === '2' ? 'PENYERAHAN_OBAT' : 'SELESAI'
          )
        "
      />
    </ToolbarFilterMenu>
    <CustomButton
      icon="PhMagnifyingGlass"
      label="Cari"
      @click="onClickSearch"
    />
    <CustomButton
      label="Reset"
      outlined
      borderColor="border-opensimrs-300"
      textColor="text-opensimrs-300"
      @click="onClickReset"
    />
    <slot name="header"></slot>
  </PageToolbar>
</template>
