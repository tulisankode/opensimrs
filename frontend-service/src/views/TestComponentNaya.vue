<script setup lang="ts">
import DatePickers from "@/components/Base/CustomDatePicker.vue";
import Select from "@/components/Base/CustomSelect.vue";
import Switch from "@/components/Base/CustomSwitch.vue";
import CardPanggilan from "@/components/Antrian/CardPanggilan.vue";
import { ref } from "vue";
import TiketAntrian from "@/components/Antrian/TiketAntrian.vue";
import CardRiwayatPemeriksaan from "@/components/Admisi/CardRiwayatPemeriksaan.vue";
import CardMonitoringBed from "@/components/Admisi/CardMonitoringBed.vue";
import CustomCheckbox from "@/components/Base/CustomCheckbox.vue";
import CustomQuil from "@/components/Base/CustomQuil.vue";
// import TableKomponenTarif from "@/components/Datamaster/TableKomponenTarif.vue";
import TableTindakan from "@/components/Datamaster/TableKomponenTarifTindakan.vue";
import TableJenisPembayaranBed from "@/components/Datamaster/TableJenisPembayaranBedV1.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import Anamnesis from "@/components/RekamMedis/Anamnesis/Anamnesis.vue";
import Kesadaran from "@/components/RekamMedis/Kesadaran/Kesadaran.vue";
import Antropometri from "@/components/RekamMedis/Antropometri/Antropometri.vue";
import CatatanHasilPenunjang from "@/components/RekamMedis/CatatanHasilPenunjang/CatatanHasilPenunjang.vue";
import AsuhanKeperawatan from "@/components/RekamMedis/AsuhanKeperawatan/AsuhanKeperawatan.vue";
import PemeriksaanTindakan from "@/components/RekamMedis/PemeriksaanTindakan/PemeriksaanTindakan.vue";
import InstruksiMedis from "@/components/RekamMedis/IntruksiMedis/InstruksiMedis.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import OrderLab from "@/components/RekamMedis/OrderLab/OrderLab.vue";
import ListSuratKeterangan from "@/components/RekamMedis/ListSuratKeterangan/ListSuratKeterangan.vue";
import TandaVital from "@/components/RekamMedis/ResumeDiscarge/TandaVital.vue";
import AnamnesisResume from "@/components/RekamMedis/ResumeDiscarge/Anamnesis.vue";
import Edukasi from "@/components/RekamMedis/ResumeDiscarge/Edukasi.vue";
import KeadaanWaktuPulang from "@/components/RekamMedis/ResumeDiscarge/KeadaanWaktuPulang.vue";
import StatusPulang from "@/components/RekamMedis/ResumeDiscarge/StatusPulang.vue";
import PemeriksaanFisik from "@/components/RekamMedis/ResumeDiscarge/PemeriksaanFisik.vue";
import Diagnosis from "@/components/RekamMedis/ResumeDiscarge/Diagnosis.vue";
import Tindakan from "@/components/RekamMedis/ResumeDiscarge/Tindakan.vue";
import Obat from "@/components/RekamMedis/ResumeDiscarge/Obat.vue";
import FormPemberianObat from "@/components/RekamMedis/FPO/FormPemberianObat.vue";
import SuratControlRawatJalan from "@/components/RekamMedis/ListSuratKeterangan/SuratControlRawatJalan.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import Prognosis from "@/components/RekamMedis/ResumeDiscarge/Prognosis.vue";
import CustomRadioButton from "@/components/Base/CustomRadioButton.vue";

//For Test Selected Component
const selectedItems = ref();
const items = ref([
  { name: "New York", code: "NY" },
  { name: "Rome", code: "RM" },
  { name: "London", code: "LDN" },
  { name: "Istanbul", code: "IST" },
  { name: "Paris", code: "PRS" },
]);

const testLog = (data: any) => {
  console.log("city data: ", data);
  console.log("city: ", selectedItems.value);
};

//For Test Date Picker Component
const selectedDate = ref();
const testDate = (data: any) => {
  console.log("Date: ", data);
};
let today = new Date();
let month = today.getMonth();
let year = today.getFullYear();
let firstDayOfCurrentMonth = new Date(year, month + 1, 10);

//For Test Time Picker Component
const selectedTime = ref();
const testTime = (data: any) => {
  console.log("Time: ", data);
};

//For Test Toggle Switch Component
const toggleSwitch = ref();
const testSwitch = (data: any) => {
  console.log("value: ", toggleSwitch.value);
};

//For Test Card
const cardPanggilan = ref({
  noAntri: "9349",
  namaPoli: "Poli Gigi",
  namaDokter: "dr. Contoh Dokter",
});

const tiketAntrian = ref({
  noRM: "001827",
  noBPJS: "9234938492",
  nik: "0932493849382",
  nama: "Adam bin Adam",
  tanggalLahir: "01 Januari 2000",
  gender: "Laki-laki",
  namaPoli: "Poli Anak",
  dokter: "dr. Umum",
  jadwal: "07:00-10:00",
  tanggal: "10 Jan 2024",
  noAntri: "PD-02-01",
});
const riwayatPemerikasaan = ref({
  ruangan: "IGD",
  asuransi: "TUNAI",
  dokter: "dr. Contoh Dokter",
  tanggal: "2024-6-12",
  jam: "09:00",
  statusLunas: "Lunas",
});

const monitoringBed = ref({
  nomorBed: "1",
  nomorRM: "00123456",
  namaPasien: "Adam bin Adam",
  gender: "Laki-laki Dewasa",
  asuransi: "BPJS",
});

const categories = ref([
  { name: "Accounting", key: "A" },
  { name: "Marketing", key: "M" },
  { name: "Production", key: "P" },
  { name: "Research", key: "R" },
]);
const checkCategorie = ref();
const handleRowsUpdate = (rows: number) => {
  console.log("Rows updated:", rows);
};

const handlePageUpdate = (page: number) => {
  console.log("Page updated:", page);
};
// const handleUpdate = (page: number) => {
//   console.log('first updated:', page);
// };
const handlePage = (page: number) => {
  console.log("Page updated:", page);
};
const selectedValue = ref();

const controlRawatJalanRef = ref();
const submitChildForm = () => {
  if (controlRawatJalanRef.value) {
    controlRawatJalanRef.value.submitForm();
  }
};

const listKomponenTarifRef = ref();
const submitListKomponenSurat = () => {
  if (listKomponenTarifRef.value) {
    listKomponenTarifRef.value.onSubmit();
  }
};
</script>

<template>
  <div class="h-screen mx-5 overflow-scroll">
    <Select label="Choose a City" v-model="selectedItems" :options="items" optionValue="code" optionLabel="name"
      :isLoading="false" :invalid="false" invalidMessage="Wajib diisi" :disabled="false" @change="testLog" />
    <p>Kota: {{ selectedItems }}</p>
    <br />
    <DatePickers label="Choose a Date" v-model="selectedDate" :invalid="false" invalidMessage="Wajib diisi"
      :disabled="false" :maxDate="firstDayOfCurrentMonth" />

    <p>Date: {{ selectedDate }}</p>
    <br />
    <DatePickers label="Choose a Time" timeOnly v-model="selectedTime" :invalid="false" invalidMessage="Wajib diisi"
      :disabled="false" @date-select="testTime" />
    <p>Time: {{ selectedTime }}</p>
    <br />
    <Switch label="Switch" v-model="toggleSwitch" @input="testSwitch" :invalid="false" invalidMessage="Wajib diisi"
      :disabled="false" />
    <p>Switch: {{ toggleSwitch }}</p>
    <br />
    <div class="w-[300px]">
      <CardPanggilan :cardPanggilan="cardPanggilan" />
    </div>
    <br />
    <div class="w-3/4">
      <TiketAntrian :tiketAntrian="tiketAntrian" />
    </div>
    <br />
    <div class="w-3/4">
      <CardRiwayatPemeriksaan :pemeriksaan="riwayatPemerikasaan" />
    </div>
    <br />
    <div class="w-3/4">
      <CardMonitoringBed :monitoringBed="monitoringBed" />
    </div>
    <br />
    <div>
      <CustomCheckbox v-model="checkCategorie" :categories="categories" />
      {{ checkCategorie }}
    </div>
    <CustomCheckBoxUser v-model="checkCategorie" :categories="categories" />
    <br />
    <KomponenTarif />
    <br />
    <div class="p-5">
      <VarianTarif />
    </div>
    <br />
    <Kelas />
    <br />
    <div class="w-3/4">
      <CustomQuil />
    </div>
    <br />
    table komponen tarif
    <TableKomponenTarif />
    <br /><br />
    table tindakan
    <TableTindakan />
    <br />
    <br />
    jenis pembayaran bed
    <TableJenisPembayaranBed />
    <br />
    <br />
    <CustomPaginator :rows="10" :totalRecords="100" :rowsPerPageOptions="[10, 20, 30]" @update:rows="handleRowsUpdate"
      @update:first="handlePageUpdate" @page="handlePage" />
    <Paginator :rows="20" :totalRecords="0" :rowsPerPageOptions="[10, 20, 30]" :first="1" :pageLinkSize="1" :pt="{
      content: {
        class: 'flex gap-0 p-0 m-0 h-[30px] items-center justify-center',
      },
      first: { class: 'rounded-none h-full' },
      prev: { class: 'rounded-none h-full' },
      pages: { class: 'rounded-none h-full' },
      page: {
        class:
          'rounded-none h-full bg-opensimrs-300 text-white w-10 h-10 flex items-center justify-center',
      },
      next: { class: 'rounded-none h-full' },
      last: { class: 'rounded-none h-full' },
      pcRowPerPageDropdown: {
        root: 'border-b-2 rounded-none border-white border-b-grey-200 ml-5 h-full items-center justify-center',
      },
    }" @page="$emit('page', $event)">
      <template #rowsperpagedropdownicon>
        <PhCaretDown :size="20" weight="fill" class="text-grey-200" />
      </template>
    </Paginator>

    <b>Component Rekam Medis</b>
    <Anamnesis /> <br />
    <Kesadaran /><br />
    <Antropometri /> <br />
    <CatatanHasilPenunjang /> <br />
    <AsuhanKeperawatan /> <br />
    <PemeriksaanTindakan /> <br />
    <InstruksiMedis />
    <br />
    <OrderLab /><br />
    <ListSuratKeterangan /> <br />
    <b>Form resume medis</b>
    <TandaVital /> <br />
    <AnamnesisResume /><br />
    <Edukasi /> <br />
    <Prognosis /><br />
    <KeadaanWaktuPulang /><br />
    <StatusPulang /><br />
    <PemeriksaanFisik /> <br />
    <Diagnosis /> <br />
    <Tindakan /> <br />
    <Obat /> <br />
    <FormPemberianObat />
    <SuratControlRawatJalan ref="controlRawatJalanRef" />
    <CustomButton label="Simpan" @click="submitChildForm" />
    <br /><br />
    <TableTindakan ref="listKomponenTarifRef" />
    <CustomButton label="Submit" @click="submitListKomponenSurat" />
    <FileUpload
        mode="basic"
        accept=".xls,.xlsx"
        :maxFileSize="1000000"
        label="Import"
        chooseLabel="Import"
        auto
        class="bg-opensimrs-300 rounded-[10px] font-black text-normal h-10 text-white border-opensimrs-300"
        @upload="()=>{}"
      >
        <template #uploadicon>
          <FileImportIcon />
        </template>
      </FileUpload>
  </div>
</template>
