<script setup lang="ts">
import { ref, type PropType } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import type { MenuItem } from "primevue/menuitem";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
const props = defineProps({
  pageType: {
    type: String,
    default: "Semua Poli",
  },
  dataBreadCrumb: {
    type: Array as PropType<MenuItem[]>,
    default: () => [],
  },
  currentRouteName: {
    type: String,
  },
});
const emit = defineEmits([
  "reload-data",
  "tambah-data",
  "selectedTab",
  "search",
  "reset",
  "back",
]);
const tanggal= ref<Date>(new Date());
const startDateFilter = ref<Date>(new Date());
const endDateFilter = ref<Date>(new Date());
const selectedTab = ref("0");
const filterStatusBayarList = ref(["Belum Lunas", "Lunas"]);
const filterPembayaranList = ref(["TUNAI", "ASURANSI"]);
const selectedFilterStatus = ref<string[]>([]);
const selectedFilterPembayaran = ref<string[]>([]);
const onStatusSelect = (label: string) => {
  if (selectedFilterStatus.value.includes(label)) {
    selectedFilterStatus.value = selectedFilterStatus.value.filter(
      (item) => item != label
    );
  } else {
    selectedFilterStatus.value.push(label);
  }
};
const onPembayaranSelect = (label: string) => {
  if (selectedFilterPembayaran.value.includes(label)) {
    selectedFilterPembayaran.value = selectedFilterPembayaran.value.filter(
      (item) => item != label
    );
  } else {
    selectedFilterPembayaran.value.push(label);
  }
};

const kelasOption = ref(["Zumba", "Gym", "Pilates"]);
const kelasSelected = ref();
const search = ref();
</script>
<template>
  <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
  <PageToolbar>
    <CustomButton icon="PhArrowClockwise" @click="emit('reload-data')" />
    <CustomBreadCrumb
      v-if="['datamaster', 'laporan', 'booking-kelas'].includes(pageType)"
      :home="{
        label:
          pageType === 'datamaster'
            ? 'Datamaster'
            : pageType === 'laporan'
            ? 'Laporan'
            : pageType === 'booking-kelas'
            ? 'Booking Kelas'
            : '',
        home: true,
      }"
      :model="dataBreadCrumb"
    />
    <h1 v-else class="toolbar-heading text-opensimrs-300">
      {{
        pageType == "daftar"
          ? "Daftar Kelas"
          : pageType == "booking"
          ? "Booking Kelas"
          : ""
      }}
    </h1>
    <CustomTextfield
      v-model="search"
      v-if="!['laporan','booking-kelas'].includes(pageType)"
      :label="
        props.pageType === 'datamaster' ? 'Cari Kelas' : 'Cari Pasien'
      "
      :placeholder="
        props.pageType === 'datamaster'
          ? 'Cari Nama Kelas'
          : 'Cari Nama / Alamat / No. RM'
      "
      prependIcon="PhMagnifyingGlass"
      @keydown.enter="$emit('search')"
    />
    <CustomSelect
      v-if="['daftar', 'booking', 'laporan','booking-kelas'].includes(pageType)"
      v-model="kelasSelected"
      label="Kelas"
      :options="kelasOption"
      option-value=""
      option-label=""
      placeHolder="Pilih Kelas"
    />
    <CustomSelect
      v-if="['booking-kelas'].includes(pageType)"
      v-model="kelasSelected"
      label="Sesi"
      :options="kelasOption"
      option-value=""
      option-label=""
      placeHolder="Pilih Sesi"
    />
    <CustomDatePicker
      v-if="['booking-kelas'].includes(pageType)"
      v-model="tanggal"
      label="Tanggal"
      class="toolbar-field--date"
    />
    <template v-if="['daftar', 'booking', 'laporan'].includes(pageType)">
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
    </template>
    <ToolbarFilterMenu
      v-if="['daftar'].includes(pageType)"
      :count="selectedFilterStatus.length"
    >
      <template #label>Status Bayar</template>
      <CustomChip
        v-for="(option, index) in filterStatusBayarList"
        :key="option + index"
        :label="option"
        :isSelected="selectedFilterStatus.includes(option)"
        @selected="onStatusSelect(option)"
      >
      </CustomChip>
    </ToolbarFilterMenu>
    <ToolbarFilterMenu
      v-if="['booking', 'daftar'].includes(pageType)"
      :count="selectedFilterPembayaran.length"
    >
      <template #label>Pembayaran</template>
      <CustomChip
        v-for="(option, index) in filterPembayaranList"
        :key="option + index"
        :label="option"
        :isSelected="selectedFilterPembayaran.includes(option)"
        @selected="onPembayaranSelect(option)"
      >
      </CustomChip>
    </ToolbarFilterMenu>
    <div
      v-if="['daftar'].includes(pageType)"
      class="flex items-center gap-1 shrink-0"
      role="group"
      aria-label="Status pendaftaran"
    >
      <CustomButton
        label="Daftar"
        :text-color="selectedTab === '0' ? 'text-white' : 'text-opensimrs-300'"
        :border-color="
          selectedTab === '0' ? 'border-none' : 'border-opensimrs-300'
        "
        :class="selectedTab === '0' ? 'bg-opensimrs-300' : 'bg-white'"
        @click="$emit('selectedTab', (selectedTab = '0'))"
        :outlined="selectedTab !== '0'"
      />
      <CustomButton
        label="Batal"
        :text-color="selectedTab === '1' ? 'text-white' : 'text-opensimrs-300'"
        :border-color="
          selectedTab === '1' ? 'border-none' : 'border-opensimrs-300'
        "
        :class="selectedTab === '1' ? 'bg-opensimrs-300' : 'bg-white'"
        @click="$emit('selectedTab', (selectedTab = '1'))"
        :outlined="selectedTab !== '1'"
      />
    </div>
    <template v-if="['daftar', 'booking','booking-kelas'].includes(pageType)">
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
    </template>
    <CustomButton
      v-if="!['laporan','booking-kelas'].includes(pageType)"
      @click="emit('tambah-data')"
      icon="PhPlus"
      :label="
        props.pageType === 'daftar'
          ? 'Daftar Kelas'
          : props.pageType === 'booking'
          ? 'Book'
          : props.pageType === 'datamaster'
          ? 'Data'
          : ''
      "
    />
    <CustomButton
      v-if="pageType === 'booking-kelas'"
      label="Kembali"
      icon="PhCaretLeft"
      @click="emit('back')"
      background-color="bg-white"
      border-color="border-opensimrs-300"
      text-color="text-opensimrs-300"
    />
  </PageToolbar>
</template>
