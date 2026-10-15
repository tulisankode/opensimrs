<script setup lang="ts">
import { ref, computed, watch, type PropType, onMounted } from "vue";

import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import type { MenuItem } from "primevue/menuitem";
import { useRoute } from "vue-router";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import type { FilterAdmisi } from "@/utils/Interface";
import { dateToEpoch, epochToDate, setTimeForDate } from "@/utils/Helpers";
import { usePraktisiStore } from "@/stores/datamaster/praktisi";
import { utilsStore } from "@/stores/utils";

const props = defineProps({
  filterMenu: {
    type: Object as PropType<{ uuid: string; name: string }>,
    default: () => ({ uuid: "", name: "" }),
  },
  dataBreadCrumb: {
    type: Array as PropType<MenuItem[]>,
    default: () => [],
  },
  currentRouteName: {
    type: String,
  },
  filterData: {
    type: Object as PropType<FilterAdmisi>,
    default: {},
  },
});

// Store
const praktisiStore = usePraktisiStore();
const UseUtilsStore = utilsStore();
const praktisiPayload = ref<any[]>([]);
const praktisiProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Search Dokter
const searchDoctor = ref<string>("");

const selectedTab = ref("");
// Fetch data Praktisi dari API
const fetchPraktisiData = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const params = {
      page: praktisiProperties.value.page,
      limit: 9999,
      name: searchDoctor.value,
      isDoctor: true,
    };

    const response = await praktisiStore.getApi(params);

    if (response && response.payload) {
      praktisiPayload.value = response.payload;
    } else {
      praktisiPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    praktisiPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const startDateFilter = ref<Date>(new Date());
const endDateFilter = ref<Date>(new Date());
const searchPatientFilter = ref<string>("");
const searchNoAnggotaFilter = ref<string>("");
const searchNamaObatFilter = ref<string>("");
const searchDokterFilter = ref<string>("");
const searchPelayananFilter = ref<string>("");

// CHIP UNTUK FILTER PEMBAYARAN.
const selectedPaymentMethod = ref<string[]>([]);

const onPaymentMethodSelect = (label: string) => {
  if (selectedPaymentMethod.value.includes(label)) {
    selectedPaymentMethod.value = selectedPaymentMethod.value.filter(
      (item) => item !== label
    );
  } else {
    selectedPaymentMethod.value.push(label);
  }

  // Emit 'payment' event after payment method selection changes
  emit("payment");
};

const resetFilter = () => {
  let date = new Date(),
    y = date.getFullYear(),
    m = date.getMonth();

  startDateFilter.value = new Date(y, m, 1);
  endDateFilter.value = new Date(y, m + 1, 0);
  selectedTab.value = "2";
  // emit("search");

  switch (props.currentRouteName) {
    case "rawat-jalan-poli":
      searchPatientFilter.value = "";
      searchDokterFilter.value = "";
      break;
    case "monitoring-kunjungan":
    case "monitoring-riwayat-kunjungan":
      searchNoAnggotaFilter.value = "";
      searchPelayananFilter.value = "";
      break;
    case "monitoring-obat-kunjungan":
      searchNamaObatFilter.value = "";
      searchPelayananFilter.value = "";
      break;
    default:
      break;
  }
  // Resetting payment method for all routes
  selectedPaymentMethod.value = [];
};

const setFilter = (dataFilter: FilterAdmisi) => {
  selectedPaymentMethod.value = dataFilter.paymentMethod
    ? dataFilter.paymentMethod.split(',')
    : [];
  startDateFilter.value = dataFilter.startDate
    ? (epochToDate(parseInt(dataFilter.startDate)) as Date)
    : new Date();
  endDateFilter.value = dataFilter.endDate
    ? (epochToDate(parseInt(dataFilter.endDate)) as Date)
    : new Date();
  searchPatientFilter.value = dataFilter.q ?? "";
  searchDokterFilter.value = dataFilter.dpjp ?? "";
};

const searchData = (dataString: any) => {
  let filter = {} as FilterAdmisi;

  filter.startDate = `${dateToEpoch(
    setTimeForDate(startDateFilter.value, 0, 0, 0)
  )}`;
  filter.endDate = `${dateToEpoch(
    setTimeForDate(endDateFilter.value, 23, 59, 59)
  )}`;
  filter.q = searchPatientFilter.value || "";
  filter.paymentMethod =
    selectedPaymentMethod.value.length > 1 ||
    !selectedPaymentMethod.value.length
      ? ""
      : selectedPaymentMethod.value[0];

  // FIXME Belum bisa multiple

  filter.poly = [props.filterMenu.uuid ?? ""];
  filter.dpjp = searchDokterFilter.value ?? "";
  filter.status = selectedTab.value;
  return filter;
};

// Dokter yang login: daftar langsung tersaring ke pasiennya (tetap bisa diubah/di-reset).
const setDokter = (practitionerUuid: string) => {
  searchDokterFilter.value = practitionerUuid ?? "";
};

defineExpose({
  resetFilter,
  searchData,
  setDokter,
});

const emit = defineEmits(["search", "reload-data", "payment", "reset"]);

onMounted(() => {
  setFilter(props.filterData);
  fetchPraktisiData();
});
</script>

<template>
  <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
  <PageToolbar>
    <CustomButton icon="PhArrowClockwise" @click="emit('reload-data')" />
    <h1
      v-if="currentRouteName == 'rawat-jalan-poli'"
      class="toolbar-heading text-opensimrs-300"
    >
      {{ filterMenu.name }}
    </h1>
    <CustomBreadCrumb
      v-else-if="currentRouteName && currentRouteName.includes('monitoring')"
      :home="{ label: 'BPJS', home: true }"
      :model="dataBreadCrumb"
    />
    <CustomTextfield
      v-if="currentRouteName === 'rawat-jalan-poli'"
      v-model="searchPatientFilter"
      prependIcon="PhMagnifyingGlass"
      label="Cari Pasien"
      placeholder="Cari nama pasien"
      @keydown.enter="emit('search')"
    />
    <CustomTextfield
      v-if="
        currentRouteName === 'monitoring-kunjungan' ||
        currentRouteName === 'monitoring-riwayat-kunjungan'
      "
      v-model="searchNoAnggotaFilter"
      prependIcon="PhMagnifyingGlass"
      label="Cari No. Anggota"
      placeholder="Cari No. Anggota"
    />
    <CustomTextfield
      v-if="currentRouteName === 'monitoring-obat-kunjungan'"
      v-model="searchNamaObatFilter"
      prependIcon="PhMagnifyingGlass"
      label="Cari Nama Obat"
      placeholder="Cari Nama Obat"
    />
    <CustomSelect
      v-if="currentRouteName === 'rawat-jalan-poli'"
      v-model="searchDokterFilter"
      label="Dokter"
      optionLabel="pegawai.name"
      optionValue="uuid"
      place-holder="Semua dokter"
      :options="praktisiPayload"
    />
    <CustomSelect
      v-else
      v-model="searchPelayananFilter"
      label="Jenis Pelayanan"
      optionLabel=""
      optionValue=""
      place-holder="Jenis pelayanan"
      :options="['Semua', 'Beberapa', 'Banyak']"
    />
    <CustomDatePicker
      v-model="startDateFilter"
      label="Tanggal mulai"
      class="toolbar-field--date"
      :max-date="endDateFilter"
    />
    <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
    <CustomDatePicker
      v-model="endDateFilter"
      label="Tanggal selesai"
      class="toolbar-field--date"
      :min-date="startDateFilter"
    />
    <ToolbarFilterMenu
      v-if="currentRouteName === 'rawat-jalan-poli'"
      :count="selectedPaymentMethod.length"
    >
      <template #label>Pembayaran</template>
      <CustomChip
        label="TUNAI"
        value="1"
        :isSelected="selectedPaymentMethod.includes('1')"
        @selected="onPaymentMethodSelect"
      />
      <CustomChip
        label="ASURANSI"
        value="2"
        :isSelected="selectedPaymentMethod.includes('2')"
        @selected="onPaymentMethodSelect"
      />
    </ToolbarFilterMenu>
    <!-- Slot halaman (mis. status Semua / Pelayanan / Discharge) -->
    <slot name="content"></slot>
    <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="$emit('search')" />
    <CustomButton
      @click="$emit('reset')"
      label="Reset"
      outlined
      borderColor="border-opensimrs-300"
      textColor="text-opensimrs-300"
    />
  </PageToolbar>
</template>
