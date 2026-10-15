<script setup lang="ts">
import { ref, type PropType, onMounted, computed } from "vue";
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

const props = defineProps({
  pageType: {
    type: String,
    default: "Semua Poli",
  },
  dataBreadCrumb: {
    type: Array as PropType<MenuItem[]>,
    default: () => [],
  },
  filterSelect: {
    type: Array,
    default: () => [],
  },
  valueBulanFilter: {
    type: Date as PropType<Date | null>,
    default: null,
  },
});

const startDateFilter = ref<Date>(new Date());
const endDateFilter = ref<Date>(new Date());
const searchPatientFilter = ref<string>("");

const filterPatientList = ref([
  { name: "DATA LENGKAP", value: "0" },
  { name: "DATA TIDAK LENGKAP", value: "1" },
]);
const selectedFilterPasien = ref<string[]>([]);
const onPasienSelect = (value: string) => {
  const index = selectedFilterPasien.value.indexOf(value);
  if (index === -1) {
    selectedFilterPasien.value.push(value);
  } else {
    selectedFilterPasien.value.splice(index, 1);
  }
  emit("filterChipPasien", selectedFilterPasien.value);
};

const selectedPaymentMethod = ref<string[]>([]);
const onPaymentMethodSelect = (value: string) => {
  const index = selectedPaymentMethod.value.indexOf(value);
  if (index === -1) {
    selectedPaymentMethod.value.push(value);
  } else {
    selectedPaymentMethod.value.splice(index, 1);
  }
  emit("filterChipPayment", selectedPaymentMethod.value);
};

const emit = defineEmits([
  "selectedTab",
  "update:selectedFilter",
  "reload-data",
  "update:valueSearch",
  "search",
  "update:selectedMonth",
  "reset",
  "update:startDateFilter",
  "update:endDateFilter",
  "filterChipPasien",
  "filterChipPayment",
]);

const monthValue = computed({
  get() {
    return props.valueBulanFilter;
  },
  set(newValue) {
    emit("update:selectedMonth", newValue);
  },
});

const selectedTab = ref("2");
const valueSelectedFilter = ref();
const resetForm = () => {
  searchPatientFilter.value = "";
  valueSelectedFilter.value = "";
  emit("update:selectedMonth", new Date());
  selectedTab.value = "2";
  let date = new Date(),
    y = date.getFullYear(),
    m = date.getMonth();

  selectedFilterPasien.value = [];
  selectedPaymentMethod.value = [];

  startDateFilter.value = new Date(y, m, 1);
  endDateFilter.value = new Date(y, m + 1, 0);
};

onMounted(() => {
  let date = new Date(),
    y = date.getFullYear(),
    m = date.getMonth();

  startDateFilter.value = new Date(y, m, 1);
  endDateFilter.value = new Date(y, m + 1, 0);
});

defineExpose({
  resetForm,
});
</script>

<template>
  <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
  <PageToolbar>
    <CustomButton icon="PhArrowClockwise" @click="emit('reload-data')" />
    <CustomBreadCrumb
      :home="{
        label:
          pageType === 'pasien-igd'
            ? 'Pasien IGD'
            : pageType === 'monitoring-kunjungan' ||
              pageType === 'monitoring-riwayat-kunjungan' ||
              pageType === 'monitoring-obat-kunjungan'
            ? 'BPJS'
            : pageType === 'kunjungan-igd' ||
              pageType === 'pembatalan-dirawat' ||
              pageType === 'rekap-tindakan-pasien'
            ? 'Laporan'
            : '',
        home: true,
      }"
      :model="dataBreadCrumb"
    />
    <!-- Filter by search and slect -->
    <CustomTextfield
      v-model="searchPatientFilter"
      prependIcon="PhMagnifyingGlass"
      :label="
        props.pageType === 'pasien-igd'
          ? 'Cari Pasien'
          : pageType === 'monitoring-kunjungan' ||
            pageType === 'monitoring-riwayat-kunjungan'
          ? 'Cari No. Anggota'
          : pageType === 'monitoring-obat-kunjungan'
          ? 'Cari Nama Obat'
          : pageType === 'kunjungan-igd' ||
            pageType === 'pembatalan-dirawat' ||
            pageType === 'rekap-tindakan-pasien'
          ? 'Pencarian'
          : ''
      "
      :placeholder="
        props.pageType === 'pasien-igd'
          ? 'Cari Nama / Alamat / No. RM'
          : pageType === 'monitoring-kunjungan' ||
            pageType === 'monitoring-riwayat-kunjungan'
          ? 'Cari No. Anggota'
          : pageType === 'monitoring-obat-kunjungan'
          ? 'Cari Nama Obat'
          : pageType === 'kunjungan-igd' ||
            pageType === 'pembatalan-dirawat'
          ? 'Cari Nama / Alamat / No. RM'
          : pageType === 'rekap-tindakan-pasien'
          ? 'Cari Nama Tindakan'
          : ''
      "
      @update:modelValue="$emit('update:valueSearch', searchPatientFilter)"
      @keydown.enter="$emit('search')"
    />
    <CustomSelect
      v-model="valueSelectedFilter"
      :label="
        props.pageType === 'pasien-igd' ||
        pageType === 'monitoring-kunjungan'
          ? 'Dokter'
          : pageType === 'monitoring-riwayat-kunjungan' ||
            pageType === 'monitoring-obat-kunjungan'
          ? 'Jenis Pelayanan'
          : pageType === 'kunjungan-igd' ||
            pageType === 'pembatalan-dirawat'
          ? 'Dokter DPJP'
          : pageType === 'rekap-tindakan-pasien'
          ? 'Praktisi'
          : ''
      "
      :optionLabel="
        pageType === 'rekap-tindakan-pasien'
          ? 'pegawai.name'
          : 'pegawai.name'
      "
      optionValue="uuid"
      :place-holder="
        props.pageType === 'pasien-igd' ||
        pageType === 'monitoring-kunjungan'
          ? 'Pilih Dokter'
          : pageType === 'monitoring-riwayat-kunjungan' ||
            pageType === 'monitoring-obat-kunjungan'
          ? 'Pilih Jenis Pelayanan'
          : pageType === 'kunjungan-igd' ||
            pageType === 'pembatalan-dirawat'
          ? 'Pilih Dokter DPJP'
          : pageType === 'rekap-tindakan-pasien'
          ? 'Semua'
          : ''
      "
      :options="filterSelect"
      prependIcon="PhMagnifyingGlass"
      @update:modelValue="
        $emit('update:selectedFilter', valueSelectedFilter)
      "
    />

    <!-- DatePicker -->
    <CustomDatePicker
      v-if="['rekap-tindakan-pasien'].includes(pageType)"
      v-model="monthValue" date-format="mm-yy"
      view="month"
      label="Bulan"
      place-holder="Pilih Bulan"
      class="toolbar-field--date"
      :max-date="new Date()"
    />
    <template v-else>
      <CustomDatePicker
        v-model="startDateFilter"
        label="Tanggal mulai"
        class="toolbar-field--date"
        @update:modelValue="
          $emit('update:startDateFilter', startDateFilter)
        "
        :max-date="endDateFilter"
      />
      <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
      <CustomDatePicker
        v-model="endDateFilter"
        label="Tanggal selesai"
        class="toolbar-field--date"
        @update:modelValue="$emit('update:endDateFilter', endDateFilter)"
        :min-date="startDateFilter"
      />
    </template>

    <!-- Filter for pasien igd -->
    <ToolbarFilterMenu
      v-if="props.pageType === 'pasien-igd'"
      :count="selectedFilterPasien.length"
    >
      <template #label>Data Pasien</template>
      <CustomChip
        v-for="(option, index) in filterPatientList"
        :key="option.value + index"
        :label="option.name"
        :value="option.value"
        :isSelected="selectedFilterPasien.includes(option.value)"
        @selected="onPasienSelect(option.value)"
      >
      </CustomChip>
    </ToolbarFilterMenu>
    <ToolbarFilterMenu
      v-if="props.pageType === 'pasien-igd'"
      :count="selectedPaymentMethod.length"
    >
      <template #label>Pembayaran</template>
      <CustomChip
        label="TUNAI"
        value="1"
        :isSelected="selectedPaymentMethod.includes('1')"
        @selected="onPaymentMethodSelect('1')"
      />
      <CustomChip
        label="ASURANSI"
        value="2"
        :isSelected="selectedPaymentMethod.includes('2')"
        @selected="onPaymentMethodSelect('2')"
      />
    </ToolbarFilterMenu>
    <div
      v-if="props.pageType === 'pasien-igd'"
      class="flex items-center gap-1 shrink-0"
      role="group"
      aria-label="Status pelayanan"
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
        label="Pelayanan"
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
      label="Reset"
      outlined
      borderColor="border-opensimrs-300"
      textColor="text-opensimrs-300"
      @click="$emit('reset')"
    />
  </PageToolbar>
</template>
