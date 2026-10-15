<script setup lang="ts">
import { type PropType, computed } from "vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";

const props = defineProps({
  patientData: {
    type: Object as PropType<any>,
    default: () => null
  }
});

// Helper untuk format tanggal lahir khusus closebill
const formattedBirthDate = computed(() => {
  if (!props.patientData?.tglLahir) return "";
  return new Date(props.patientData.tglLahir).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
});

// Computed property untuk menentukan cara bayar 
const paymentType = computed(() => {
  if (props.patientData?.serviceBill?.length > 0) {
    return props.patientData.serviceBill[0].withInsurance ? 'ASURANSI' : 'TUNAI';
  }
  return 'TUNAI';
});
</script>

<template>
  <CustomAccordion :openWithHeader="false">
    <template #header>
      <div class="flex justify-between w-full align-middle">
        <div v-if="patientData" class="flex">
          <p class="leading-10 text-opensimrs-300 text-heading">
            Identitas Pasien
          </p>
          <CustomButton class="ml-4">{{ patientData.invoiceCode }}</CustomButton>
          <CustomChip
            class="mt-2 ml-4"
            :showCheckedIcon="false"
            :label="paymentType"
            :bgColor="paymentType === 'TUNAI' ? 'bg-opensimrs-50' : 'bg-warning-50'"
            :textColor="paymentType === 'TUNAI' ? 'text-opensimrs-300' : 'text-warning-300'"
            :borderColor="paymentType === 'TUNAI' ? 'border-opensimrs-300' : 'border-warning-300'"
          />
        </div>
      </div>
    </template>
    <template #content>
      <div v-if="patientData" class="pt-5">
        <div class="flex flex-row">
          <div class="basis-1/4">
            <p class="font-bold text-MD">{{ patientData.patientName }}</p>
            <p>{{ patientData.regCode || '-' }}</p>
            <CustomButton class="w-30 h-5 text-sm">{{ patientData.noRm }}</CustomButton>
            <CustomChip
              :showCheckedIcon="false"
              :label="patientData.gender"
              :bgColor="patientData.gender === 'Perempuan' ? 'bg-female-75' : 'bg-male-75'"
              :textColor="patientData.gender === 'Perempuan' ? 'text-female-300' : 'text-male-300'"
              customClass="h-5 pr-[6px] border-none mr-[5px] ml-2"
            />
          </div>
          <div class="bg-mediumGrey-300 w-[1px] h-[85px] ml-[50px] mr-[35px]"></div>
          <div class="mt-[20px] mr-[40px]">
            <p class=" font-bold underline underline-offset-2">Tgl. Lahir</p>
            <p class="">{{ formattedBirthDate }}</p>
          </div>
          <div class=" w-[1px] h-[85px] mr-[170px]"></div>
          <div class="mt-[20px] mr-[40px]">
            <p class=" font-bold underline underline-offset-2">Umur</p>
            <p class="">{{ patientData.ageYear }}Thn {{ patientData.ageMonth }}Bln {{ patientData.ageDay }}Hr</p>
          </div>
          <!-- <div class="mt-[20px] mr-[40px]">
            <p class="text-xs font-bold underline underline-offset-2">Alergi</p>
            <p class="">{{ patientData.allergy || 'Tidak Ada' }}</p>
          </div> -->
        </div>
        <div class="grid grid-cols-3 mt-10">
          <div>
            <p class="font-bold underline underline-offset-2">{{ patientData.identityType }}</p>
            <p>{{ patientData.noIdentity }}</p>
            <p class="mt-4 font-bold underline underline-offset-2">Provinsi</p>
            <p>{{ patientData.provinsi }}</p>
            <p class="mt-4 font-bold underline underline-offset-2">Kelurahan/Desa</p>
            <p>{{ patientData.kelurahanDesa }}</p>
          </div>
          <div>
            <p class="font-bold underline underline-offset-2">No. Handphone</p>
            <p>{{ patientData.noHandphone }}</p>
            <p class="mt-4 font-bold underline underline-offset-2">Kabupaten/Kota</p>
            <p>{{ patientData.kabupatenKota }}</p>
            
            <div class="mt-4 font-bold flex space-x-4">
            <p class="underline underline-offset-2">RT</p>
            <p class="underline underline-offset-2">RW</p>
            </div>
            <div class="flex space-x-4">
              <p class="w-6">{{ patientData.rt }}</p> <p>{{ patientData.rw }}</p>
            </div>
          </div>
          <div>
            <p class="font-bold underline underline-offset-2">Agama</p>
            <p>{{ patientData.agama }}</p>
            <p class="mt-4 font-bold underline underline-offset-2">Kecamatan</p>
            <p>{{ patientData.kecamatan }}</p>
            <p class="mt-4 font-bold underline underline-offset-2">Kodepos</p>
            <p>{{ patientData.kodepos }}</p>
          </div>
        </div>
        <div class="grid grid-cols-2 mt-4">
          <div>
            <p class="font-bold underline underline-offset-2">Alamat</p>
            <p>{{ patientData.alamat }}</p>
          </div>
        </div>        
      </div>
      <div v-else class="pt-5">
        <p>Memuat data identitas pasien...</p>
      </div>
    </template>
    <template #collapseIcon>
      <CustomButton
        icon="PhCaretUp"
        backgroundColor="bg-opensimrs-75"
        textColor="text-opensimrs-300"
      />
    </template>
    <template #expandIcon>
      <CustomButton
        icon="PhCaretDown"
        backgroundColor="bg-opensimrs-75"
        textColor="text-opensimrs-300"
      />
    </template>
  </CustomAccordion>
</template>