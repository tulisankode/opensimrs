<script lang="ts" setup>
import { ref, type PropType, computed, watch } from "vue";
import { modulAktif } from "@/stores/modulFaskes";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomChip from "@/components/Base/CustomChip.vue";

const props = defineProps({
  pageType: {
    type: String,
    required: true,
  },
  isSuperAdmin: {
    type: Boolean,
    default: false,
  },
  dataBreadCrumb: {
    default: "",
  },
  filterChipList: {
    type: Array as PropType<FilterChip[]>,
    default: () => [],
  },
  filterSelect: {
    type: Array,
    default: () => [],
  },
  filterSelectSecond: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits([
  "tambah-data",
  "tarif-ruangan",
  "update:valueSearch",
  "update:selectedRole",
  "selectedTab",
  "reload-data",
  "filterChange",
  "update:selectedFilter",
  "update:selectedFilterSecond",
  "search",
  "reset",
]);

const pageLabel = computed(() => {
  return props.pageType === "user"
    ? "User"
    : props.pageType === "role"
    ? "Role"
    : props.pageType === "ruangan"
    ? "Ruangan"
    : props.pageType === "kategori-ruangan"
    ? "Kategori Ruangan"
    : props.pageType === "tarif"
    ? "Tarif"
    : props.pageType === "komponen-tarif"
    ? "Komponen Tarif"
    : props.pageType === "tindakan"
    ? "Tindakan"
    : props.pageType === "icd9-cm"
    ? "ICD 9 CM"
    : props.pageType === "snomed-ct"
    ? "Snomed CT"
    : props.pageType === "loinc"
    ? "Loinc"
    : props.pageType === "diagnosis"
    ? "Diagnosis (ICD 10)"
    : props.pageType === "praktisi"
    ? "Praktisi"
    : props.pageType === "pegawai"
    ? "Pegawai"
    : props.pageType === "penjamin"
    ? "Penjamin"
    : props.pageType === "voucher"
    ? "Voucher"
    : props.pageType === "faskes"
    ? "Faskes"
    : props.pageType === "lokasi"
    ? "Lokasi"
    : props.pageType === "organisasi"
    ? "Organisasi"
    : "General Consent";
});

const dataBreadCrumb = ref([
  {
    label:
      props.pageType === "gigi-fdi"
        ? "Gigi FDI"
        : props.pageType === "item-gigi"
        ? "Item Gigi"
        : props.pageType === "kategori-gigi"
        ? "Kategori Gigi"
        : "Oklusi",
  },
]);
const valueSearch = ref();
const valueSelectedFilter = ref();
const valueSelectedFilterSecond = ref();

const resetForm = () => {
  valueSearch.value = ""; // Mengatur ulang pencarian
  valueSelectedFilter.value = ""; // Reset filter pertama
  valueSelectedFilterSecond.value = ""; // Reset filter kedua
  // emit("reset");
};

defineExpose({
  resetForm,
});

watch(valueSearch, (newValue) => {
  emit("update:valueSearch", newValue);
});

const selectedFilterAktif = ref<string[]>([]);

const tabs = ref([
  { title: "TINDAKAN", content: "Tindakan", value: "0" },
  ...(modulAktif("rawat_inap") ? [{ title: "RUANGAN", content: "Ruangan", value: "1" }] : []),
]);
const selectedTab = ref("0");
const filterPoliList = ref([
  "POLI UMUM",
  "POLI ANAK",
  "POLI GIGI POLI MATA",
  "APS",
]);

const selectedFilter = ref<number[]>([]);

const onPoliSelect = (value: number) => {
  const index = selectedFilter.value.indexOf(value);
  if (index === -1) {
    selectedFilter.value.push(value);
  } else {
    selectedFilter.value.splice(index, 1);
  }
  emit("filterChange", selectedFilter.value);
};

interface FilterChip {
  label: string;
  value: any;
}
</script>
<template>
  <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
  <PageToolbar>
    <CustomButton icon="PhArrowClockwise" @click="emit('reload-data')" />
    <CustomBreadCrumb
      v-if="isSuperAdmin"
      :home="{
        label: 'Super Admin',
        home: true,
      }"
      :model="dataBreadCrumb"
    />
    <h1 v-else class="toolbar-heading text-opensimrs-300">
      {{ pageLabel }}
    </h1>
    <CustomTextfield
      v-model="valueSearch"
      :label="isSuperAdmin ? 'Pencarian' : `Cari ${pageLabel}`"
      :placeholder="
        isSuperAdmin
          ? props.pageType === 'item-gigi'
            ? 'Cari Item Gigi'
            : 'Cari Display Gigi'
          : `Cari ${pageLabel}`
      "
      prependIcon="PhMagnifyingGlass"
      @update:modelValue="$emit('update:valueSearch', valueSearch)"
      @keydown.enter="$emit('search')"
    />
    <CustomSelect
      v-if="['user', 'ruangan', 'tarif'].includes(pageType)"
      v-model="valueSelectedFilter"
      :label="
        props.pageType === 'user'
          ? 'Role'
          : props.pageType === 'ruangan'
          ? 'Kategori'
          : props.pageType === 'tarif'
          ? 'Unit Pelayanan'
          : 'Kategori'
      "
      :placeHolder="
        props.pageType === 'user'
          ? 'Pilih Role'
          : props.pageType === 'ruangan'
          ? 'Pilih Kategori'
          : props.pageType === 'tarif'
          ? 'Pilih Unit Pelayanan'
          : 'Pilih Kategori'
      "
      :options="props.filterSelect"
      :optionValue="
        props.pageType === 'ruangan'
          ? 'uuid'
          : props.pageType === 'tarif'
          ? 'value'
          : props.pageType === 'user'
          ? 'name'
          : ''
      "
      :optionLabel="
        props.pageType === 'ruangan'
          ? 'name'
          : props.pageType === 'tarif'
          ? 'label'
          : props.pageType === 'user'
          ? 'name'
          : ''
      "
      @update:modelValue="
        $emit('update:selectedFilter', valueSelectedFilter)
      "
    />
    <CustomSelect
      v-if="['ruangan', 'tarif'].includes(pageType)"
      v-model="valueSelectedFilterSecond"
      :label="
        props.pageType === 'ruangan'
          ? 'Kelas'
          : props.pageType === 'tarif'
          ? 'Metode Pembayaran'
          : 'Kelas'
      "
      :placeHolder="
        props.pageType === 'ruangan'
          ? 'Pilih Kelas'
          : props.pageType === 'tarif'
          ? 'Pilih Metode Pembayaran'
          : 'Pilih Kelas'
      "
      :options="props.filterSelectSecond"
      :optionValue="
        props.pageType === 'ruangan'
          ? 'value'
          : props.pageType === 'tarif'
          ? 'uuid'
          : ''
      "
      :optionLabel="
        props.pageType === 'ruangan'
          ? 'label'
          : props.pageType === 'tarif'
          ? 'name'
          : ''
      "
      @update:modelValue="
        $emit('update:selectedFilterSecond', valueSelectedFilterSecond)
      "
    />
    <ToolbarFilterMenu
      v-if="['pegawai', 'praktisi'].includes(pageType)"
      :count="selectedFilter.length"
    >
      <template #label>
        {{
          props.pageType === "pegawai"
            ? "Tipe Pegawai"
            : props.pageType === "praktisi"
            ? "Tipe Praktisi"
            : ""
        }}
      </template>
      <CustomChip
        v-for="(filter, index) in filterChipList"
        :key="filter.value + index"
        :label="filter.label"
        :isSelected="selectedFilter.includes(filter.value)"
        @selected="onPoliSelect(filter.value)"
      />
    </ToolbarFilterMenu>
    <div
      v-if="['tarif'].includes(pageType)"
      class="flex items-center gap-1 shrink-0"
      role="group"
      aria-label="Jenis tarif"
    >
      <CustomButton
        v-for="tab in tabs"
        :key="tab.title"
        :label="tab.title"
        :text-color="
          selectedTab === tab.value ? 'text-white' : 'text-opensimrs-300'
        "
        :border-color="
          selectedTab === tab.value ? 'border-none' : 'border-opensimrs-300'
        "
        :class="selectedTab === tab.value ? 'bg-opensimrs-300' : 'bg-white'"
        @click="$emit('selectedTab', (selectedTab = tab.value))"
        :outlined="selectedTab !== tab.value"
      />
    </div>
    <template v-if="['user', 'ruangan', 'tarif'].includes(pageType)">
      <CustomButton
        label="Cari"
        icon="PhMagnifyingGlass"
        @click="$emit('search')"
      />
      <CustomButton
        label="Reset"
        background-color="bg-white"
        border-color="border-opensimrs-300"
        text-color="text-opensimrs-300"
        @click="$emit('reset')"
      />
    </template>
    <CustomButton
      @click="emit('tambah-data')"
      icon="PhPlus"
      :label="props.pageType === 'tarif' ? 'Tarif Tindakan' : 'Data'"
    />
    <CustomButton
      v-if="['tarif'].includes(pageType) && modulAktif('rawat_inap')"
      @click="emit('tarif-ruangan')"
      icon="PhPlus"
      label="Tarif Ruangan"
    />
  </PageToolbar>
</template>
