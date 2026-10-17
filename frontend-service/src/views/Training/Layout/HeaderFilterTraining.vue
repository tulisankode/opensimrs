<script setup lang="ts">
import { computed, onMounted, type PropType } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import type { MenuItem } from "primevue/menuitem";
import { useTrainingStore } from "@/stores/penunjang/training";

// Header satu baris (PageToolbar) bersama halaman Training. Nilai filter dikendalikan halaman induk lewat v-model;
// header hanya menampilkan kontrol yang relevan untuk pageType:
//   datamaster    → cari kelas + filter status + tambah
//   daftar        → cari pasien, kelas, periode, tab Terdaftar/Batal + daftar kelas
//   booking       → cari pasien, kelas, periode + book
//   booking-kelas → kelas + tanggal (cari jadwal) + kembali
//   laporan       → kelas, periode + ekspor
const props = defineProps({
  pageType: { type: String, default: "" },
  dataBreadCrumb: { type: Array as PropType<MenuItem[]>, default: () => [] },
  bisaTambah: { type: Boolean, default: true },
  memuat: { type: Boolean, default: false },
});
const emit = defineEmits(["reload-data", "tambah-data", "search", "reset", "back", "export"]);

const cari = defineModel<string>("cari", { default: "" });
const kelasUuid = defineModel<string | null>("kelasUuid", { default: null });
const tanggal = defineModel<Date>("tanggal");
const tanggalMulai = defineModel<Date>("tanggalMulai");
const tanggalSelesai = defineModel<Date>("tanggalSelesai");
const tab = defineModel<string>("tab", { default: "order" });
const status = defineModel<string>("status", { default: "" });

const store = useTrainingStore();
const opsiKelas = computed(() => store.kelas.map((k) => ({ value: k.uuid, label: `${k.nama} (${k.kode})` })));
const pakai = (...jenis: string[]) => jenis.includes(props.pageType);

const judul = computed(() => (props.pageType === "daftar" ? "Daftar Kelas" : props.pageType === "booking" ? "Booking Kelas" : ""));
const labelHome = computed(() =>
  props.pageType === "datamaster" ? "Datamaster" : props.pageType === "laporan" ? "Laporan" : props.pageType === "booking-kelas" ? "Booking Kelas" : "",
);
const labelTambah = computed(() => (props.pageType === "daftar" ? "Daftar Kelas" : props.pageType === "booking" ? "Book" : "Data"));
const gantiStatus = (v: string) => {
  status.value = status.value === v ? "" : v;
  emit("search");
};
const gantiTab = (v: string) => {
  tab.value = v;
  emit("search");
};

onMounted(() => {
  if (pakai("daftar", "booking", "booking-kelas", "laporan")) store.muatKelas();
});
</script>
<template>
  <PageToolbar>
    <CustomButton icon="PhArrowClockwise" @click="emit('reload-data')" />
    <CustomBreadCrumb v-if="pakai('datamaster', 'laporan', 'booking-kelas')" :home="{ label: labelHome, home: true }" :model="dataBreadCrumb" />
    <h1 v-else class="toolbar-heading text-opensimrs-300">{{ judul }}</h1>

    <CustomTextfield
      v-if="pakai('datamaster', 'daftar', 'booking')"
      v-model="cari"
      :label="pageType === 'datamaster' ? 'Cari Kelas' : 'Cari Pasien'"
      :placeholder="pageType === 'datamaster' ? 'Kode / Nama / Instruktur' : 'Nama / No. RM / No. Order'"
      prependIcon="PhMagnifyingGlass"
      @keydown.enter="emit('search')"
    />
    <CustomSelect
      v-if="pakai('daftar', 'booking', 'laporan', 'booking-kelas')"
      v-model="kelasUuid"
      label="Kelas"
      :options="opsiKelas"
      optionLabel="label"
      optionValue="value"
      placeHolder="Pilih Kelas"
      :clearable="pageType !== 'booking-kelas'"
    />
    <CustomDatePicker v-if="pakai('booking-kelas')" v-model="tanggal" label="Tanggal kelas" class="toolbar-field--date" :min-date="new Date()" />
    <template v-if="pakai('daftar', 'booking', 'laporan')">
      <CustomDatePicker v-model="tanggalMulai" label="Tanggal mulai" class="toolbar-field--date" :max-date="tanggalSelesai" />
      <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
      <CustomDatePicker v-model="tanggalSelesai" label="Tanggal selesai" class="toolbar-field--date" :min-date="tanggalMulai" />
    </template>
    <ToolbarFilterMenu v-if="pakai('datamaster')" :count="status ? 1 : 0">
      <template #label>Status</template>
      <CustomChip label="Aktif" value="true" :isSelected="status === 'true'" @selected="gantiStatus('true')" />
      <CustomChip label="Non-aktif" value="false" :isSelected="status === 'false'" @selected="gantiStatus('false')" />
    </ToolbarFilterMenu>
    <div v-if="pakai('daftar')" class="flex items-center gap-1 shrink-0" role="group" aria-label="Status pendaftaran">
      <CustomButton
        label="Terdaftar"
        :text-color="tab === 'order' ? 'text-white' : 'text-opensimrs-300'"
        :border-color="tab === 'order' ? 'border-none' : 'border-opensimrs-300'"
        :class="tab === 'order' ? 'bg-opensimrs-300' : 'bg-white'"
        :outlined="tab !== 'order'"
        @click="gantiTab('order')"
      />
      <CustomButton
        label="Batal"
        :text-color="tab === 'batal' ? 'text-white' : 'text-opensimrs-300'"
        :border-color="tab === 'batal' ? 'border-none' : 'border-opensimrs-300'"
        :class="tab === 'batal' ? 'bg-opensimrs-300' : 'bg-white'"
        :outlined="tab !== 'batal'"
        @click="gantiTab('batal')"
      />
    </div>
    <CustomButton icon="PhMagnifyingGlass" :label="pageType === 'laporan' ? 'Tampilkan' : 'Cari'" :loading="memuat" @click="emit('search')" />
    <CustomButton v-if="pakai('datamaster', 'daftar', 'booking')" label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="emit('reset')" />
    <CustomButton
      v-if="pakai('laporan')"
      icon="PhMicrosoftExcelLogo"
      label="Ekspor"
      outlined
      borderColor="border-opensimrs-300"
      textColor="text-opensimrs-300"
      @click="emit('export')"
    />
    <CustomButton v-if="pakai('datamaster', 'daftar', 'booking') && bisaTambah" icon="PhPlus" :label="labelTambah" @click="emit('tambah-data')" />
    <CustomButton
      v-if="pageType === 'booking-kelas'"
      label="Kembali"
      icon="PhCaretLeft"
      background-color="bg-white"
      border-color="border-opensimrs-300"
      text-color="text-opensimrs-300"
      @click="emit('back')"
    />
  </PageToolbar>
</template>
