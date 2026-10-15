<script setup lang="ts">
import { onMounted, computed, ref, type PropType } from "vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";

const startDateFilter = ref<Date>(new Date());
const submitForm = () => {
  console.log("Submited Patient Identity Form");
};

defineExpose({
  submitForm,
});

const selectedJam = ref<any>();
const itemJam = ref([
  { name: "08.00 - 10.00", code: "J1" },
  { name: "10.00 - 12.00", code: "J2" },
  { name: "13.00 - 15.00", code: "J3" },
]);
const selectedRuangan = ref<any>();
const itemRuangan = ref([
  { name: "Ruangan 1", code: "R1" },
  { name: "Ruangan 2", code: "R2" },
  { name: "Ruangan 3", code: "R3" },
]);
const selectedBed = ref<any>();
const itemBed = ref([
  { name: "Bed 1", code: "B1" },
  { name: "Bed 2", code: "B2" },
  { name: "Bed 3", code: "B3" },
]);
const selectedPetugas = ref<any>();
const itemPetugas = ref([
  { name: "Petugas 1", code: "P1" },
  { name: "Petugas 2", code: "P2" },
  { name: "Petugas 3", code: "P3" },
]);
</script>

<template>
  <CustomAccordion :openWithHeader="false" initial-state="0">
    <template #header>
      <div class="w-full align-middle">
        <div class="flex">
          <p class="leading-10 text-bold text-heading">Jadwal & Bed Terapi</p>
        </div>
      </div>
    </template>
    <template #content>
      <div class="pt-3 mr-20">
        <div class="grid grid-cols-[15%_15%_25%_15%_30%] gap-5">
          <CustomDatePicker v-model="startDateFilter" label="Tanggal" />
          <CustomSelect
            v-model="selectedJam"
            :options="itemJam"
            label="Jam"
            optionLabel="name"
            optionValue="code"
            place-holder="Pilih Waktu"
          />
          <CustomSelect
            v-model="selectedRuangan"
            :options="itemRuangan"
            label="Ruangan"
            optionLabel="name"
            optionValue="code"
            place-holder="Pilih Ruangan"
          />
          <CustomSelect
            v-model="selectedBed"
            :options="itemBed"
            label="Bed"
            optionLabel="name"
            optionValue="code"
            place-holder="Pilih Bed"
          />
          <CustomSelect
            v-model="selectedPetugas"
            :options="itemPetugas"
            label="Petugas Terapi"
            optionLabel="name"
            optionValue="code"
            place-holder="Pilih Petugas Terapi"
          />
        </div>
      </div>
    </template>
    <template #collapseIcon>
      <CustomButton
        icon="PhCaretUp"
        backgroundColor="bg-transparent"
        textColor="text-opensimrs-300"
      />
    </template>
    <template #expandIcon>
      <CustomButton
        icon="PhCaretDown"
        backgroundColor="bg-transparent"
        textColor="text-opensimrs-300"
      />
    </template>
  </CustomAccordion>
</template>
