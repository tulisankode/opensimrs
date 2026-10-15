<script setup lang="ts">
import { computed, ref, type PropType, watch } from "vue";
import { useDebounceFn } from "@vueuse/core";

import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import TambahDataKonfigurasiJadwal from "../Konfigurasi/KonfigurasiJadwalDokter/SectionTambahKonfigurasiJadwal.vue";

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
  excludedDoctorUuids: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
  excludedDoctorUuidsByPoli: {
    type: Object as PropType<Record<string, string[]>>,
    default: () => ({}),
  },
  payload: {
    type: Object,
    default: () => ({}),
  },
  dokterOptions: {
    type: Array as PropType<Array<{ uuid: string; name: string }>>,
    default: () => [],
  },
  poliOptions: {
    type: Array as PropType<Array<{ uuid: string; name: string }>>,
    default: () => [],
  },
  jadwalDokterData: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
});

// Computed untuk dropdown poli
const poliDropdown = computed(() => props.poliOptions);

// Computed untuk dropdown dokter yang difilter berdasarkan poli yang dipilih
const dokterDropdown = computed(() => {
  if (!selectedPoli.value) {
    return [];
  }

  // Gunakan data dokterOptions (tidak terpengaruh filter status) dan
  // filter berdasarkan poli yang dipilih melalui atribut poliUuids
  const dokterInPoli = (
    props.dokterOptions as Array<{
      uuid: string;
      name: string;
      poliUuids?: string[];
    }>
  ).filter((dokter) => dokter.poliUuids?.includes(selectedPoli.value));

  // Remove duplicates berdasarkan uuid
  const uniqueDokter = dokterInPoli.filter(
    (dokter, index, self) =>
      index === self.findIndex((d) => d.uuid === dokter.uuid)
  );

  return uniqueDokter;
});

// Computed untuk menentukan apakah dropdown dokter disabled
const isDokterDisabled = computed(() => !selectedPoli.value);

const selectedDokter = ref<any>();
const selectedPoli = ref<any>();
const resetKey = ref(0);

const poliFilterText = ref("");

const handlePoliFilter = (value?: string) => {
  poliFilterText.value = (value ?? "").toString();
};

watch(selectedPoli, (newPoliUuid) => {
  // Reset pilihan dokter ketika poli berubah
  selectedDokter.value = null;
  poliFilterText.value = "";
});

const selectedPaymentMethod = ref<string[]>([]);

// Fungsi untuk melakukan pencarian
const performSearch = () => {
  // Validasi: jika ada teks filter poli tapi tidak ada opsi yang cocok,
  const q = poliFilterText.value?.trim().toLowerCase() ?? "";
  const hasPoliQuery = q.length > 0;
  const poliQueryMatches = props.poliOptions.some((p: any) =>
    p?.name?.toLowerCase().includes(q)
  );
  const isValidSearch = !(hasPoliQuery && !poliQueryMatches);

  console.log("Debug performSearch:", {
    q,
    hasPoliQuery,
    poliQueryMatches,
    isValidSearch,
    selectedDokter: selectedDokter.value,
    selectedPoli: selectedPoli.value,
  });

  emit("search", {
    // Mengirim parameter yang akan digunakan langsung oleh backend API
    dokterUuid: isValidSearch ? selectedDokter.value ?? "" : "",
    poliUuid: isValidSearch ? selectedPoli.value ?? "" : "",
    aktif:
      selectedPaymentMethod.value.length === 1
        ? selectedPaymentMethod.value[0] === "AKTIF"
        : undefined,
    // kirim flag validasi untuk dipakai di halaman
    isValidSearch,
  });
};

// Debounced search function dengan delay 500ms
const debouncedSearch = useDebounceFn(performSearch, 500);

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

const filters = [selectedPaymentMethod];

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

function handleClose() {
  dialogData.value.isVisible = false;
}

const resetFilter = () => {
  filters.forEach((filter) => {
    filter.value = [];
    selectedDokter.value = null;
    selectedPoli.value = null;
  });
  poliFilterText.value = "";
  resetKey.value++;
};
defineExpose({
  resetFilter,
});

const emit = defineEmits(["refresh", "search"]);

function handleRefresh() {
  emit("refresh");
}

function handleSearch() {
  // Langsung jalankan performSearch tanpa debounce untuk tombol cari
  performSearch();
}

function handleReset() {
  resetFilter(); // bersihkan pilihan lokal

  emit("search", {
    dokterUuid: "",
    poliUuid: "",
    aktif: undefined,
    isValidSearch: true,
  });

  // emit refresh untuk memuat ulang data dari server
  emit("refresh");
}
</script>

<template>
  <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
  <PageToolbar>
    <CustomButton
      label=""
      icon="PhArrowClockwise"
      @click="handleReset"
      title="refresh"
    />
    <h1 class="toolbar-heading flex items-center text-opensimrs-300">
      Konfigurasi
      <PhCaretRight :size="16" class="mx-1 text-cyan-500" aria-hidden="true" />
      <span class="text-grey-400">Jadwal Dokter</span>
    </h1>
    <CustomSelect
      :key="`poli-${resetKey}`"
      v-model="selectedPoli"
      :options="poliDropdown"
      optionValue="uuid"
      optionLabel="name"
      :is-loading="false"
      prependIcon="PhMagnifyingGlass"
      label="Cari Poli"
      place-holder="Cari Poli"
      @filter="handlePoliFilter"
    />
    <CustomSelect
      :key="`dokter-${resetKey}`"
      v-model="selectedDokter"
      :options="dokterDropdown"
      optionValue="uuid"
      optionLabel="name"
      :is-loading="false"
      :disabled="isDokterDisabled"
      prependIcon="PhMagnifyingGlass"
      label="Cari Dokter"
      :place-holder="
        isDokterDisabled ? 'Pilih poli terlebih dahulu' : 'Cari Dokter'
      "
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
      @click="handleSearch"
    />
    <CustomButton
      @click="handleReset"
      label="Reset"
      outlined
      borderColor="border-opensimrs-300"
      textColor="text-opensimrs-300"
    />
    <CustomButton
      @click="handleAdd"
      icon="PhPlus"
      label="Jadwal"
    />
    <slot name="header"></slot>
  </PageToolbar>
  <TambahDataKonfigurasiJadwal
    v-model:isDialogVisible="dialogData.isVisible"
    :excludedDokterUuids="props.excludedDoctorUuids"
    :excludedDoctorUuidsByPoli="props.excludedDoctorUuidsByPoli"
    :title="dialogData.title"
    :method="dialogData.method"
    @close="handleClose"
    @refresh="handleRefresh"
  />
</template>
