<script setup lang="ts">
import { onMounted, ref, type PropType } from "vue";

import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import type { MenuItem } from "primevue/menuitem";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import { usePraktisiStore } from "@/stores/datamaster/praktisi";
import { utilsStore } from "@/stores/utils";
import type { FilterAdmisi } from "@/utils/Interface";
import { dateToEpoch, epochToDate, setTimeForDate } from "@/utils/Helpers";

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

const praktisiProperties = ref({
  page: 1,
  page_size: 9999,
  total: 0,
});

const searchDoctor = ref<string>("");

const selectedTab = ref("2");
// Emit for Search and Payment
const emit = defineEmits([
  "selectedTab",
  "search",
  "payment",
  "update:valueSearch",
  "update:valueNoAnggota",
  "update:valueNamaObat",
  "update:valueDokter",
  "update:valuePelayanan",
  "update:valueStartDate",
  "update:valueEndDate",
  "reset",
  "reloadData",
]);

// STORE
const praktisiStore = usePraktisiStore();
const UseUtilsStore = utilsStore();
const praktisiPayload = ref<any[]>([]);

// Fetch data Praktisi dari API
const fetchPraktisiData = async () => {
  UseUtilsStore.setLoading(true);
  try {
    let isDoctor = true;
    const response = await praktisiStore.getApi({
      page: praktisiProperties.value.page,
      limit: praktisiProperties.value.page_size,
      name: searchDoctor.value,
      isDoctor: isDoctor,
    });

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

// Removed duplicate emit declaration

const startDateFilter = ref<Date>(new Date());
const endDateFilter = ref<Date>(new Date());
const searchPatientFilter = ref<string>("");
const searchNoAnggotaFilter = ref<string>("");
const searchNamaObatFilter = ref<string>("");
const searchDokterFilter = ref<string>("");
const searchPelayananFilter = ref<string>("");

// CHIP UNTUK FILTER PEMBAYARAN.
const selectedPaymentMethod = ref<string[]>([]);

// Ketika chip di klik, maka akan memilih filter pembayaran
const onPaymentMethodSelect = (label: string) => {
  if (selectedPaymentMethod.value.includes(label)) {
    selectedPaymentMethod.value = selectedPaymentMethod.value.filter(
      (item) => item != label
    );
  } else {
    selectedPaymentMethod.value.push(label);
  }
  emit("payment", selectedPaymentMethod.value);
};

// const filters = [selectedFilterPoli, selectedPaymentMethod];
const resetForm = () => {
  let date = new Date(),
    y = date.getFullYear(),
    m = date.getMonth();

  startDateFilter.value = new Date(y, m, 1);
  endDateFilter.value = new Date(y, m + 1, 0);
  searchPatientFilter.value = "";
  searchDokterFilter.value = "";
  selectedPaymentMethod.value = [];
  selectedTab.value = "2";
};

defineExpose({
  resetForm,
});

onMounted(() => {
  fetchPraktisiData();
  let date = new Date(),
    y = date.getFullYear(),
    m = date.getMonth();

  startDateFilter.value = new Date(y, m, 1);
  endDateFilter.value = new Date(y, m + 1, 0);
});
</script>

<template>
  <!-- {{ currentRouteName }} -->
  <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
  <PageToolbar>
    <CustomButton icon="PhArrowClockwise" @click="emit('reloadData')" />
    <h1
      class="toolbar-heading text-opensimrs-300"
      v-if="currentRouteName == 'ruangan'"
    >
      {{ filterMenu.name }}
    </h1>
    <CustomBreadCrumb
      v-else-if="currentRouteName && currentRouteName.includes('monitoring')"
      :home="{
        label: 'BPJS',
        home: true,
      }"
      :model="dataBreadCrumb"
    />
    <CustomBreadCrumb
      v-else-if="
        currentRouteName && currentRouteName.includes('perpindahan-bangsal')
      "
      :home="{
        label: 'Perpindahan Bangsal',
        home: true,
      }"
    />
    <h1
      class="toolbar-heading text-opensimrs-300"
      v-else-if="currentRouteName == 'rawat-inap-perpindahan-bangsal'"
    >
      {{ dataBreadCrumb[0].label }}
    </h1>
    <CustomTextfield
      v-if="currentRouteName === 'ruangan' || 'perpindahan-bangsal'"
      v-model="searchPatientFilter"
      prependIcon="PhMagnifyingGlass"
      label="Cari Pasien"
      placeholder="Cari Nama Pasien"
      @update:modelValue="$emit('update:valueSearch', searchPatientFilter)"
      @keydown.enter="$emit('search')"
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
      @update:model-value="
        $emit('update:valueNoAnggota', searchNoAnggotaFilter)
      "
    />
    <CustomTextfield
      v-if="currentRouteName === 'monitoring-obat-kunjungan'"
      v-model="searchNamaObatFilter"
      prependIcon="PhMagnifyingGlass"
      label="Cari Nama Obat"
      placeholder="Cari Nama Obat"
      @update:model-value="
        $emit('update:valueNamaObat', searchNamaObatFilter)
      "
    />
    <CustomSelect
      v-if="currentRouteName === 'ruangan' || 'perpindahan-bangsal'"
      v-model="searchDokterFilter"
      label="Dokter"
      optionLabel="pegawai.name"
      optionValue="uuid"
      place-holder="Cari Dokter"
      :options="praktisiPayload"
      prependIcon="PhMagnifyingGlass"
      @update:modelValue="$emit('update:valueDokter', searchDokterFilter)"
    />
    <CustomSelect
      v-else
      v-model="searchPelayananFilter"
      label="Jenis Pelayanan"
      optionLabel=""
      optionValue=""
      place-holder="Pilih Jenis Pelayanan"
      :options="['Semua', 'Beberapa', 'Banyak']"
      prependIcon="PhMagnifyingGlass"
      @update:modelValue="
        $emit('update:valuePelayanan', searchPelayananFilter)
      "
    />
    <template v-if="currentRouteName === 'ruangan'">
      <CustomDatePicker
        v-model="startDateFilter"
        label="Tanggal mulai"
        class="toolbar-field--date"
        @update:modelValue="$emit('update:valueStartDate', startDateFilter)"
        :max-date="endDateFilter"
      />
      <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
      <CustomDatePicker
        v-model="endDateFilter"
        label="Tanggal selesai"
        class="toolbar-field--date"
        @update:modelValue="$emit('update:valueEndDate', endDateFilter)"
        :min-date="startDateFilter"
      />
    </template>
    <ToolbarFilterMenu
      v-if="currentRouteName === 'ruangan' || 'perpindahan-bangsal'"
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
    <div
      v-if="currentRouteName === 'ruangan'"
      class="flex items-center gap-1 shrink-0"
      role="group"
      aria-label="Status perawatan"
    >
      <CustomButton
        v-tooltip.bottom="'Semua status'"
        aria-label="Semua status"
        label=""
        icon="PhListBullets"
        :text-color="selectedTab === '2' ? 'text-white' : 'text-opensimrs-300'"
        :border-color="
          selectedTab === '2' ? 'border-none' : 'border-opensimrs-300'
        "
        :class="selectedTab === '2' ? 'bg-opensimrs-300' : 'bg-white'"
        @click="$emit('selectedTab', (selectedTab = '2'))"
        :outlined="selectedTab !== '2'"
      />
      <CustomButton
        label="Dirawat"
        :text-color="selectedTab === '1' ? 'text-white' : 'text-opensimrs-300'"
        :border-color="
          selectedTab === '1' ? 'border-none' : 'border-opensimrs-300'
        "
        :class="selectedTab === '1' ? 'bg-opensimrs-300' : 'bg-white'"
        @click="$emit('selectedTab', (selectedTab = '1'))"
        :outlined="selectedTab !== '1'"
      />
      <CustomButton
        label="Discharge"
        :text-color="selectedTab === '0' ? 'text-white' : 'text-opensimrs-300'"
        :border-color="
          selectedTab === '0' ? 'border-none' : 'border-opensimrs-300'
        "
        :class="selectedTab === '0' ? 'bg-opensimrs-300' : 'bg-white'"
        @click="$emit('selectedTab', (selectedTab = '0'))"
        :outlined="selectedTab !== '0'"
      />
    </div>
    <CustomButton
      icon="PhMagnifyingGlass"
      label="Cari"
      @click="$emit('search')"
    />
    <CustomButton
      @click="$emit('reset')"
      label="Reset"
      outlined
      borderColor="border-opensimrs-300"
      textColor="text-opensimrs-300"
    />
  </PageToolbar>
</template>
