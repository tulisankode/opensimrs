<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { bagianTampil, modulAktif } from "@/stores/modulFaskes"; // Setting › Manajemen Modul & Fitur (bagian)
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";

const props = defineProps({
  rmType: {
    type: String,
    default: "rawat-jalan",
  },
  selectedTab: {
    type: String,
    default: "asesmen",
  },
  // Lokasi (poli) kunjungan: bagian khusus poli (gigi/mata) mengikuti jenis polinya.
  lokasiUuid: {
    type: String,
    default: "",
  },
});

const tampilAsm = (label: string) => bagianTampil("rme_asesmen", label, props.lokasiUuid);
const tampilRsm = (label: string) => bagianTampil("rme_resume", label, props.lokasiUuid);

const emit = defineEmits(["soapSoapierJump", "resumeDischargeJump"]);

const assesmentList = ref([
  "Alergi",
  "Anamnesis",
  "Tanda Vital",
  "Antropometri",
  "Asesmen Nyeri",
  "Kesadaran",
  "Pemeriksaan Fisik", 
  "Derajat Luka Bakar (RON)",
  "Catatan Hasil Penunjang",
  "Diagnosis Dokter",
  "Asuhan Keperawatan",
  "Catatan Perawat",
  "Instruksi Medis",
  "Pemeriksaan dan Tindakan",
]);
const selectedAssesment = defineModel<string>("selectedAssesment", {
  default: "Alergi",
});
const onAssesmentSelect = (label: string) => {
  if (selectedAssesment.value != label) {
    selectedAssesment.value = label;
  }
};

const soapList = ref(["Subjective", "Objective", "Assesment", "Plan"]);
const selectedSoap = defineModel<string>("selectedSoap", {
  default: "Subjective",
});
const onSoapSelect = (label: string) => {
  if (selectedSoap.value != label) {
    selectedSoap.value = label;
  }
};

const soapierList = ref([
  "Subjective",
  "Objective",
  "Assesment",
  "Plan",
  "I",
  "E",
  "R",
]);
const selectedSoapier = defineModel<string>("selectedSoapier", {
  default: "Subjective",
});
const onSoapierSelect = (label: string) => {
  if (selectedSoapier.value != label) {
    selectedSoapier.value = label;
  }
};

const jumpToFormList = (selectedPage: string) => daftarLompatSoap(selectedPage).filter(tampilAsm);
const daftarLompatSoap = (selectedPage: string) => {
  if (selectedPage == "Subjective") {
    return ["Alergi", "Anamnesis"];
  } else if (selectedPage == "Objective") {
    return [
      "Tanda Vital",
      "Antropometri",
      "Asesmen Nyeri",
      "Kesadaran",
      "Pemeriksaan Fisik",
      "Catatan Hasil Penunjang",
    ];
  } else if (selectedPage == "Assesment") {
    return ["Diagnosis Dokter", "Asuhan Keperawatan"];
  } else if (selectedPage == "Plan") {
    return [
      "Instruksi Medis",
      "Catatan Perawat",
      "Order Obat",
      "Pemeriksaan dan Tindakan",
    ];
  } else return [];
};

// Order Fisio hanya bila modul Fisioterapi aktif (Setting › Manajemen Modul).
const alkesList = ref([
  "Order Lab",
  ...(modulAktif("fisioterapi") ? ["Order Fisio"] : []),
  // Order Radiologi hanya bila modul Radiologi aktif.
  ...(modulAktif("radiologi") ? ["Order Radiologi"] : []),
  ...(modulAktif("patologi_anatomi") ? ["Order Patologi Anatomi"] : []),
  ...(modulAktif("mikrobiologi") ? ["Order Mikrobiologi"] : []),
]);
const selectedPenunjang = defineModel<string>("selectedPenunjang", {
  default: "Order Lab",
});
const onAlkesSelect = (label: string) => {
  if (selectedPenunjang.value != label) {
    selectedPenunjang.value = label;
  }
};

const jumpToFormDischargeList = ref([
  "Tanda Vital",
  "Ringkasan Riwayat Penyakit",
  "Edukasi",
  "Keadaan Waktu Pulang",
  "Status Pulang",
  "Pemeriksaan Fisik",
  "Diagnosis",
  "Tindakan",
  "Obat",
]);

const cetakSuratList = ref(["Cetak Hasil Pemeriksaan", "Surat Keterangan"]);
const selectedSuratList = defineModel<string>("selectedSuratList", {
  default: "Cetak Hasil Pemeriksaan",
});
const onSuratListSelect = (label: string) => {
  if (selectedSuratList.value != label) {
    selectedSuratList.value = label;
  }
};

const assesmentTampil = computed(() => assesmentList.value.filter(tampilAsm));
const resumeTampil = computed(() => jumpToFormDischargeList.value.filter(tampilRsm));

onMounted(() => {
  if (props.rmType == "igd") {
    assesmentList.value.splice(2, 0, "Triase");
  } if (props.rmType == 'rawat-jalan') {
    assesmentList.value.splice(7, 0, "Pemeriksaan Gigi", "Pemeriksaan Mata")
  }
});
</script>

<template>
  <div>
    <div v-if="selectedTab == 'asesmen'" class="mt-[10px] mb-[10px]">
      <CustomChip
        v-for="(assesment, index) in assesmentTampil"
        :key="assesment + index"
        :label="assesment"
        :showCheckedIcon="false"
        :outlined="false"
        class="mr-[10px] mb-[10px]"
        customClass="h-6"
        textSize="text-SM"
        textColor="text-black"
        selectedTextColor="text-white"
        bgColor="bg-grey-75"
        selectedColor="bg-opensimrs-300"
        :isSelected="selectedAssesment == assesment"
        @selected="onAssesmentSelect"
      />
    </div>
    <div v-if="selectedTab == 'soap'" class="my-5">
      <div class="flex">
        <CustomButton
          v-for="(soapData, index) in soapList"
          @click="onSoapSelect(soapData)"
          :label="soapData"
          class="mr-[10px]"
          borderColor="border-opensimrs-300"
          :textColor="
            selectedSoap.includes(soapData) ? 'text-white' : 'text-opensimrs-300'
          "
          :outlined="!selectedSoap.includes(soapData)"
        />
        <div class="border-[0.5px] mr-[25px] ml-[15px]"></div>
        <div>
          <div class="flex font-semibold text-gray-400 underline text-XS">
            Lompat Ke Form
            <PhArrowSquareIn :size="16" weight="fill" class="ml-[5px]" />
          </div>
          <CustomChip
            v-for="(jumpToForm, index) in jumpToFormList(selectedSoap)"
            @click="emit('soapSoapierJump', jumpToForm)"
            :showCheckedIcon="false"
            :label="jumpToForm"
            bgColor="bg-opensimrs-50"
            textColor="text-opensimrs-300"
            borderColor="border-opensimrs-300"
            customClass="h-5 mr-[5px]"
          />
        </div>
      </div>
    </div>
    <div v-if="selectedTab == 'soapier'" class="my-5">
      <div class="flex">
        <CustomButton
          v-for="(soapierData, index) in soapierList"
          @click="onSoapierSelect(soapierData)"
          :label="soapierData"
          class="mr-[10px]"
          borderColor="border-opensimrs-300"
          :textColor="
            selectedSoapier.includes(soapierData)
              ? 'text-white'
              : 'text-opensimrs-300'
          "
          :outlined="!selectedSoapier.includes(soapierData)"
        />
        <div class="border-[0.5px] mr-[25px] ml-[15px]"></div>
        <div>
          <div
            v-if="jumpToFormList(selectedSoapier).length"
            class="flex font-semibold text-gray-400 underline text-XS"
          >
            Lompat Ke Form
            <PhArrowSquareIn :size="16" weight="fill" class="ml-[5px]" />
          </div>
          <CustomChip
            v-for="(jumpToForm, index) in jumpToFormList(selectedSoapier)"
            @click="emit('soapSoapierJump', jumpToForm)"
            :showCheckedIcon="false"
            :label="jumpToForm"
            bgColor="bg-opensimrs-50"
            textColor="text-opensimrs-300"
            borderColor="border-opensimrs-300"
            customClass="h-5 mr-[5px]"
          />
        </div>
      </div>
    </div>
    <div v-if="selectedTab == 'penunjang'" class="mt-[10px] mb-[10px]">
      <CustomChip
        v-for="(penunjang, index) in alkesList"
        :key="penunjang + index"
        :label="penunjang"
        :showCheckedIcon="false"
        :outlined="false"
        class="mr-[10px] mb-[10px]"
        customClass="h-6"
        textSize="text-SM"
        textColor="text-black"
        selectedTextColor="text-white"
        bgColor="bg-grey-75"
        selectedColor="bg-opensimrs-300"
        :isSelected="selectedPenunjang.includes(penunjang)"
        @selected="onAlkesSelect"
      />
    </div>
    <div v-if="selectedTab == 'cetak-hasil-surat'" class="mt-[10px] mb-[10px]">
      <CustomChip
        v-for="(action, index) in cetakSuratList"
        :key="action + index"
        :label="action"
        :showCheckedIcon="false"
        :outlined="false"
        class="mr-[10px] mb-[10px]"
        customClass="h-6"
        textSize="text-SM"
        textColor="text-black"
        selectedTextColor="text-white"
        bgColor="bg-grey-75"
        selectedColor="bg-opensimrs-300"
        :isSelected="selectedSuratList.includes(action)"
        @selected="onSuratListSelect"
      />
    </div>
    <div v-if="selectedTab == 'resume-discharge'" class="">
      <div class="flex h-[60px]">
        <div class="flex">
          <PhListStar
            :size="20"
            weight="fill"
            class="my-auto text-opensimrs-300 mr-[10px]"
          />
          <div class="my-auto font-semibold text-MD text-grey-400">
            Form Resume Medis
          </div>
        </div>
        <div class="border-[0.5px] mr-[25px] ml-[15px] my-[10px]"></div>
        <div class="my-auto">
          <div class="flex font-semibold text-gray-400 underline text-XS">
            Lompat Ke Form
            <PhArrowSquareIn :size="16" weight="fill" class="ml-[5px]" />
          </div>
          <CustomChip
            v-for="(jumpToForm, index) in resumeTampil"
            @click="emit('resumeDischargeJump', jumpToForm)"
            :showCheckedIcon="false"
            :label="jumpToForm"
            bgColor="bg-opensimrs-50"
            textColor="text-opensimrs-300"
            borderColor="border-opensimrs-300"
            customClass="h-5 mr-[5px]"
          />
        </div>
      </div>
    </div>
  </div>
</template>
