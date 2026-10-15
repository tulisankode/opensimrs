<script setup lang="ts">
import { onMounted, ref, type PropType, computed, } from "vue";
import { fiturAktif } from "@/stores/modulFaskes";

import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import type { MenuItem } from "primevue/menuitem";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import { dateToEpoch, epochToDate, setTimeForDate } from "@/utils/Helpers";
import type { FilterAdmisi } from "@/utils/Interface";
import { utilsStore } from "@/stores/utils";
import { usePraktisiStore } from "@/stores/datamaster/praktisi";
import { useLokasiStore } from "@/stores/datamaster/lokasi";
import { useRuanganStore } from "@/stores/datamaster/ruangan";
import { useMonitoringKamarStore } from "@/stores/admisi/monitoringKamar";

// NOTE Store
const storeUtils = utilsStore();
const praktisiStore = usePraktisiStore();
const lokasiStore = useLokasiStore();
const monitoringStore = useMonitoringKamarStore();

const props = defineProps({
  pageType: {
    type: String,
    required: true,
  },
  isSEP: {
    type: Boolean,
    default: false,
  },
  dataBreadCrumb: {
    type: Array as PropType<MenuItem[]>,
    default: () => [],
  },
  filterData: {
    type: Object as PropType<FilterAdmisi>,
    default: {},
  },
});

const emit = defineEmits(["daftar", "daftarBayi", "search"]);

const startDateFilter = ref<Date>(new Date());
const endDateFilter = ref<Date>(new Date());
const searchPatientFilter = ref<string>("");
const searchDPJPFilter = ref<string | undefined>("Semua");
const selectedRoomName = ref<string | null>(null);


const listDpjp = ref<any[]>([]);

// SECTION Rawat Jalan
const filterPoliList = ref<Poli[]>([]);
interface Poli {
  name: string;
  faskesUuid: string;
}
const selectedFilterPoli = ref<string[]>([]);
const onPoliSelect = (label: string) => {
  if (selectedFilterPoli.value.includes(label)) {
    selectedFilterPoli.value = selectedFilterPoli.value.filter(
      (item) => item != label
    );
  } else {
    selectedFilterPoli.value.push(label);
  }
  emit("search");
};

const filterRegisterMethod = ref(["ADMISI", "APM", "MOBILE"]);
const selectedFilterRegisterMethod = ref<string[]>([]);
const onRegisterMethodSelect = (label: string) => {
  if (selectedFilterRegisterMethod.value.includes(label)) {
    selectedFilterRegisterMethod.value =
      selectedFilterRegisterMethod.value.filter((item) => item != label);
  } else {
    selectedFilterRegisterMethod.value.push(label);
  }
  emit("search");
};
// !SECTION

// SECTION Rawat Inap
const payload = ref<any[]>([]); 
const filterRoomList = ref<any[]>([]);
const selectedFilterRoom = ref<string[]>([]);

const onFilterRoomSelect = (label: string) => {
  if (selectedFilterRoom.value.includes(label)) {
    selectedFilterRoom.value = selectedFilterRoom.value.filter(
      (item) => item != label
    );
  } else {
    selectedFilterRoom.value.push(label);
  }
  emit("search");
};

const filterBedRoomList = ref(["MAWAR I", "MAWAR II"]);
const selectedFilterBedRoom = ref<string[]>([]);
const onFilterBedRoomSelect = (label: string) => {
  if (selectedFilterBedRoom.value.includes(label)) {
    selectedFilterBedRoom.value = selectedFilterBedRoom.value.filter(
      (item) => item != label
    );
  } else {
    selectedFilterBedRoom.value.push(label);
  }
};
// !SECTION

// SECTION IGD
const filterPatientList = ref([
  { name: "DATA LENGKAP", value: "0" },
  { name: "DATA TIDAK LENGKAP", value: "1" },
]);
const selectedFilterPatient = ref<string[]>([]);
const onFilterPatientSelect = (label: string) => {
  if (selectedFilterPatient.value.includes(label)) {
    selectedFilterPatient.value = selectedFilterPatient.value.filter(
      (item) => item != label
    );
  } else {
    selectedFilterPatient.value.push(label);
  }
  emit("search");
};
// !SECTION

const selectedPaymentMethod = ref<string[]>([]);
const onPaymentMethodSelect = (label: string) => {
  if (selectedPaymentMethod.value.includes(label)) {
    selectedPaymentMethod.value = selectedPaymentMethod.value.filter(
      (item) => item != label
    );
  } else {
    selectedPaymentMethod.value.push(label);
  }
  emit("search");
};

// NOTE SEP Filter
const selectedSEPType = ref<string>("belumSEP");
const onSEPTypeSelect = (label: string) => {
  selectedSEPType.value = label;
};

const filters = [
  selectedFilterPoli,
  selectedFilterRegisterMethod,
  selectedFilterRoom,
  selectedFilterBedRoom,
  selectedFilterPatient,
  selectedPaymentMethod,
];

const resetFilter = () => {
  filters.forEach((filter) => {
    filter.value = [];
  });
  startDateFilter.value = new Date();
  endDateFilter.value = new Date();
  searchPatientFilter.value = "";
  searchDPJPFilter.value = "Semua";
  emit('search');
};

const setFilter = (dataFilter: FilterAdmisi) => {
  selectedFilterPoli.value = dataFilter.poly ?? [];
  selectedFilterRegisterMethod.value = dataFilter.platform
    ? dataFilter.platform.split(',')
    : [];
  selectedFilterRoom.value = dataFilter.room ?? [];
  selectedFilterPatient.value = dataFilter.withoutIdentity
    ? [dataFilter.withoutIdentity]
    : [];
  selectedPaymentMethod.value = dataFilter.paymentMethod
    ? [dataFilter.paymentMethod]
    : [];
  startDateFilter.value = dataFilter.startDate
    ? (epochToDate(parseInt(dataFilter.startDate)) as Date)
    : new Date();
  endDateFilter.value = dataFilter.endDate
    ? (epochToDate(parseInt(dataFilter.endDate)) as Date)
    : new Date();
  searchPatientFilter.value = dataFilter.q ?? "";
  searchDPJPFilter.value = dataFilter.dpjp == "" ? "Semua" : dataFilter.dpjp;
};

const fetchUtils = async () => {
  storeUtils.setLoading(true);
  try {
    // FIXME Masih menggunakan api biasa dan filter by FE
    const responseDpjp = await praktisiStore.getApi({
      limit: 9999,
      non_doctor: false,
    });
    if (responseDpjp && responseDpjp.payload) {
      listDpjp.value = responseDpjp.payload.filter(
        (praktisi: any) => praktisi.isDoctor && praktisi.status
      );
    } else listDpjp.value = [];
    if (props.pageType == "rawat-jalan") {
      // FIXME Masih menggunakan api biasa dan filter by FE
      const responsePoli = await lokasiStore.getApi(0, 9999);
      if (responsePoli && responsePoli.payload) {
        filterPoliList.value = responsePoli.payload
          .filter((lokasi: any) => lokasi.isPoli && lokasi.status)
          .map((lokasi: any) => {
            return {
              name: lokasi.name,
              faskesUuid: lokasi.uuid,
            };
          });
      } else filterPoliList.value = [];
    }
    if (props.pageType == "rawat-inap" || props.pageType == "rawat-jalan") {
    const responseRoom = await monitoringStore.getAktifRuangan();
    if (responseRoom && responseRoom.payload) {
      filterRoomList.value = responseRoom.payload.map((room: any) => ({
        ...room,
        label:
          props.pageType === "rawat-jalan"
            ? room.className
            : room.name,
      }));
  } else { 
    filterRoomList.value = [];
    console.log("No room data found.");
  }
}
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const searchData = () => {
  let filter = {} as FilterAdmisi;

  filter.startDate = `${dateToEpoch(
    setTimeForDate(startDateFilter.value, 0, 0, 0)
  )}`;
  filter.endDate = `${dateToEpoch(
    setTimeForDate(endDateFilter.value, 23, 59, 59)
  )}`;
  filter.q = searchPatientFilter.value;
  filter.paymentMethod =
    selectedPaymentMethod.value.length > 1 ||
    !selectedPaymentMethod.value.length
      ? ""
      : selectedPaymentMethod.value[0];
  if (props.pageType == "rawat-jalan") {
    filter.platform = selectedFilterRegisterMethod.value.join(',');
    filter.poly = selectedFilterPoli.value;
  }
  // FIXME Belum bisa multiple
  if (props.pageType == "rawat-inap") {
    filter.room = selectedFilterRoom.value;
  }
  if (props.pageType == "igd") {
    filter.withoutIdentity =
      selectedFilterPatient.value.length > 1 ||
      !selectedFilterPatient.value.length
        ? ""
        : selectedFilterPatient.value[0];
  }
  // FIXME Belum bisa berjalan di RJ
  filter.dpjp =
    searchDPJPFilter.value == "Semua" || !searchDPJPFilter.value
      ? ""
      : searchDPJPFilter.value;

  return filter;
};

onMounted(() => {
  fetchUtils();
  setFilter(props.filterData);
});

defineExpose({
  resetFilter,
  searchData,
});
</script>

<template>
  <div
    v-if="pageType == 'rawat-jalan' && !isSEP"
    class="outpatient-toolbar"
    role="group"
    aria-label="Pencarian dan filter Rawat Jalan"
  >
    <CustomButton
      v-tooltip.bottom="'Muat ulang'"
      icon="PhArrowClockwise"
      aria-label="Muat ulang"
      class="toolbar-icon"
      @click="emit('search')"
    />
    <h1 class="toolbar-title text-opensimrs-300">Rawat Jalan</h1>
    <InputText
      v-model="searchPatientFilter"
      aria-label="Cari pasien"
      placeholder="Nama / alamat / No. RM"
      class="toolbar-patient"
      @keydown.enter="emit('search')"
    />
    <Select
      v-model="searchDPJPFilter"
      aria-label="DPJP"
      class="toolbar-doctor"
      optionLabel="pegawai.name"
      optionValue="uuid"
      :options="[{ uuid: 'Semua', pegawai: { name: 'Semua DPJP' } }, ...listDpjp]"
      placeholder="DPJP"
      filter
      filterPlaceholder="Cari DPJP"
      showClear
    />
    <div class="toolbar-dates">
      <label for="outpatient-start-date" class="sr-only">Tanggal mulai</label>
      <DatePicker
        v-model="startDateFilter"
        inputId="outpatient-start-date"
        :maxDate="endDateFilter"
        :manualInput="false"
        dateFormat="dd-mm-yy"
        showIcon
        iconDisplay="input"
      />
      <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
      <label for="outpatient-end-date" class="sr-only">Tanggal selesai</label>
      <DatePicker
        v-model="endDateFilter"
        inputId="outpatient-end-date"
        :minDate="startDateFilter"
        :manualInput="false"
        dateFormat="dd-mm-yy"
        showIcon
        iconDisplay="input"
      />
    </div>
    <MultiSelect
      v-model="selectedFilterPoli"
      aria-label="Filter Poli"
      placeholder="Poli"
      class="toolbar-poly"
      :options="filterPoliList"
      optionLabel="name"
      optionValue="faskesUuid"
      filter
      filterPlaceholder="Cari poli"
      @change="emit('search')"
    >
      <template #value>
        Poli{{ selectedFilterPoli.length ? ` (${selectedFilterPoli.length})` : '' }}
      </template>
    </MultiSelect>
    <MultiSelect
      v-model="selectedFilterRegisterMethod"
      aria-label="Filter Cara Daftar"
      placeholder="Cara Daftar"
      class="toolbar-platform"
      :options="filterRegisterMethod"
      @change="emit('search')"
    >
      <template #value>
        Cara Daftar{{ selectedFilterRegisterMethod.length ? ` (${selectedFilterRegisterMethod.length})` : '' }}
      </template>
    </MultiSelect>
    <MultiSelect
      v-model="selectedPaymentMethod"
      aria-label="Filter Pembayaran"
      placeholder="Pembayaran"
      class="toolbar-payment"
      :options="[{ label: 'TUNAI', value: '1' }, { label: 'ASURANSI', value: '2' }]"
      optionLabel="label"
      optionValue="value"
      @change="emit('search')"
    >
      <template #value>
        Pembayaran{{ selectedPaymentMethod.length ? ` (${selectedPaymentMethod.length})` : '' }}
      </template>
    </MultiSelect>
    <CustomButton
      v-tooltip.bottom="'Cari'"
      icon="PhMagnifyingGlass"
      aria-label="Cari"
      class="toolbar-icon"
      @click="emit('search')"
    />
    <CustomButton
      v-tooltip.bottom="'Reset filter'"
      icon="PhFunnelX"
      aria-label="Reset filter"
      class="toolbar-icon"
      outlined
      borderColor="border-opensimrs-300"
      textColor="text-opensimrs-300"
      @click="resetFilter"
    />
    <CustomButton icon="PhPlus" label="Daftar" @click="emit('daftar')" />
  </div>
  <PageToolbar v-else>
    <!-- Header satu baris (PageToolbar) untuk RI / IGD / SEP: komponen Base di dalamnya tampil ringkas tanpa label. -->
    <CustomButton @click="emit('search')" icon="PhArrowClockwise" />
    <h1 v-if="!isSEP" class="toolbar-heading text-opensimrs-300">
      {{
        pageType == "rawat-jalan"
          ? "Rawat Jalan "
          : pageType == "rawat-inap"
          ? "Rawat Inap"
          : "IGD"
      }}
    </h1>
    <CustomBreadCrumb
      v-else
      :home="{
        label: 'SEP',
        home: true,
      }"
      :model="dataBreadCrumb"
    />
    <CustomTextfield
      v-model="searchPatientFilter"
      label="Cari Pasien"
      prependIcon="PhMagnifyingGlass"
      placeholder="Cari Nama / address / No. RM"
      @keydown.enter="emit('search')"
    />
    <CustomSelect
      v-model="searchDPJPFilter"
      label="DPJP"
      optionLabel="pegawai.name"
      optionValue="uuid"
      :options="[
        {
          uuid: 'Semua',
          pegawai: {
            name: 'Semua',
          },
        },
        // FIXME Dummy
        {
          uuid: '0191a18a-22e4-79f7-9da5-a10a6e1a60f9',
          pegawai: {
            name: 'Rudi tabuti',
          },
        },
        ...listDpjp,
      ]"
      prependIcon="PhMagnifyingGlass"
    />
    <CustomDatePicker
      v-model="startDateFilter"
      :maxDate="endDateFilter"
      label="Tanggal mulai"
      class="toolbar-field--date"
    />
    <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
    <CustomDatePicker
      v-model="endDateFilter"
      :minDate="startDateFilter"
      label="Tanggal selesai"
      class="toolbar-field--date"
    />
    <ToolbarFilterMenu
      v-if="pageType == 'rawat-jalan'"
      :count="selectedFilterPoli.length"
    >
      <template #label>Poli</template>
      <CustomChip
        v-for="poli in filterPoliList"
        :key="poli.faskesUuid"
        :label="poli.name"
        :value="poli.faskesUuid"
        :isSelected="selectedFilterPoli.includes(poli.faskesUuid)"
        @selected="onPoliSelect"
      />
    </ToolbarFilterMenu>
    <ToolbarFilterMenu
      v-if="pageType == 'rawat-jalan' && !isSEP"
      :count="selectedFilterRegisterMethod.length"
    >
      <template #label>Cara Daftar</template>
      <CustomChip
        v-for="(method, index) in filterRegisterMethod"
        :key="method + index"
        :label="method"
        :isSelected="selectedFilterRegisterMethod.includes(method)"
        @selected="onRegisterMethodSelect"
      />
    </ToolbarFilterMenu>
    <ToolbarFilterMenu
      v-if="pageType == 'rawat-inap'"
      :count="selectedFilterRoom.length"
    >
      <template #label>Ruangan</template>
      <CustomChip
        v-for="(room, index) in filterRoomList"
        :key="room.uuid + index"
        :label="room.label"
        :isSelected="selectedFilterRoom.includes(room.label)"
        @selected="onFilterRoomSelect"
      />
    </ToolbarFilterMenu>
    <ToolbarFilterMenu
      v-if="pageType == 'igd'"
      :count="selectedFilterPatient.length"
    >
      <template #label>Pasien</template>
      <CustomChip
        v-for="(patientType, index) in filterPatientList"
        :key="patientType.name + index"
        :label="patientType.name"
        :value="patientType.value"
        :isSelected="selectedFilterPatient.includes(patientType.value)"
        @selected="onFilterPatientSelect"
      />
    </ToolbarFilterMenu>
    <ToolbarFilterMenu v-if="!isSEP" :count="selectedPaymentMethod.length">
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
      v-if="isSEP"
      class="flex items-center gap-1 shrink-0"
      role="group"
      aria-label="Status SEP"
    >
      <CustomButton
        @click="onSEPTypeSelect('belumSEP')"
        label="Belum SEP"
        :outlined="selectedSEPType != 'belumSEP'"
        borderColor="border-warning-300"
        :textColor="
          selectedSEPType != 'belumSEP' ? 'text-warning-300' : 'text-white'
        "
        :backgroundColor="
          selectedSEPType != 'belumSEP' ? 'bg-transparent' : 'bg-warning-300'
        "
        class="font-semibold"
      />
      <CustomButton
        @click="onSEPTypeSelect('sudahSEP')"
        label="Sudah SEP"
        :outlined="selectedSEPType != 'sudahSEP'"
        borderColor="border-warning-300"
        :textColor="
          selectedSEPType != 'sudahSEP' ? 'text-warning-300' : 'text-white'
        "
        :backgroundColor="
          selectedSEPType != 'sudahSEP' ? 'bg-transparent' : 'bg-warning-300'
        "
        class="font-semibold"
      />
    </div>
    <CustomButton
      @click="emit('search')"
      icon="PhMagnifyingGlass"
      label="Cari"
    />
    <CustomButton
      @click="resetFilter"
      label="Reset"
      outlined
      borderColor="border-opensimrs-300"
      textColor="text-opensimrs-300"
    />
    <CustomButton
      v-if="!isSEP && (pageType != 'rawat-inap' || fiturAktif('ri_bayi_baru_lahir'))"
      @click="
        pageType == 'rawat-inap' ? emit('daftarBayi') : emit('daftar')
      "
      icon="PhPlus"
      :label="pageType == 'rawat-inap' ? 'Bayi Baru Lahir' : 'Daftar'"
    />
  </PageToolbar>
</template>

<style scoped>
.outpatient-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 12px 14px;
  border-bottom: 1px solid #e4e7ec;
  overflow-x: auto;
  white-space: nowrap;
}

.outpatient-toolbar > * {
  flex-shrink: 0;
}

.toolbar-title {
  margin: 0 4px;
  font-size: 16px;
  font-weight: 600;
}

.toolbar-patient {
  flex: 1 0 160px;
  min-width: 160px;
  max-width: 280px;
}

.toolbar-doctor {
  flex: 1 0 140px;
  min-width: 140px;
  max-width: 220px;
}

.toolbar-dates {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toolbar-dates :deep(.p-datepicker) {
  width: 130px;
}

.toolbar-dates :deep(input) {
  width: 100%;
  min-width: 0;
}

.toolbar-poly {
  width: 100px;
}

.toolbar-platform {
  width: 142px;
}

.toolbar-payment {
  width: 150px;
}

.outpatient-toolbar :deep(.p-inputtext),
.outpatient-toolbar :deep(.p-select),
.outpatient-toolbar :deep(.p-multiselect),
.outpatient-toolbar :deep(.p-button) {
  height: 36px;
  border-radius: 6px;
  font-size: 12px;
}

.outpatient-toolbar :deep(.p-select-label),
.outpatient-toolbar :deep(.p-multiselect-label) {
  align-self: center;
  padding: 6px 10px;
  font-size: 12px;
}

.outpatient-toolbar :deep(.p-select-dropdown),
.outpatient-toolbar :deep(.p-multiselect-dropdown) {
  width: 26px;
}

.outpatient-toolbar .toolbar-icon {
  width: 36px;
  padding: 0;
}
</style>
