<script setup>
import Card from "primevue/card";
import CustomChip from "./CustomChip.vue";
import {
  PhCheckCircle,
  PhAddressBook
} from '@phosphor-icons/vue';
import { computed } from 'vue';
import AnnouncementIcon from "../icons/AnnouncementIcon.vue";
import SkipIcon from "../icons/SkipIcon.vue";

const props = defineProps({
  panggilan: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['panggil', 'lewati', 'proses', 'selesai']);

const nomorAntrian = computed(() => props.panggilan.patientData?.antrian?.noAntrianAdmisi || '-');
const namaPasien = computed(() => props.panggilan.patientData?.name || 'Nama Tidak Ditemukan');
const nomorIdentitas = computed(() => props.panggilan.patientData?.noIdentity ? `NIK. ${props.panggilan.patientData.noIdentity}` : '-');
const nomorAntrianPoli = computed(() => props.panggilan.patientData?.antrian?.noAntrianPoli || '-');
const kodeBooking = computed(() => props.panggilan.patientData?.antrian?.kodeBooking || '-');
const jenisPasien = computed(() => {
  const paymentMap = {
    1: 'TUNAI',
    2: 'ASURANSI'
  };
  const method = props.panggilan.patientData?.paymentMethod;
  return paymentMap[method] || 'TUNAI';
});
const pasienBaru = computed(() => props.panggilan.pasienBaru);

const status = computed(() => {
  const statusMap = {
    3: 'sedang proses', 
    4: 'selesai',      
  };
  return statusMap[props.panggilan.statusPanggilan] || 'aktif';
});

const showTombolAwal = computed(() => {
  const currentStatus = props.panggilan.statusPanggilan;
  return [0, 1, 2].includes(currentStatus);
});

const showIconPanggil = computed(() => {
  const currentStatus = props.panggilan.statusPanggilan;
  return [0, 1, 2].includes(currentStatus); // status 1: panggil ulang bila pasien belum datang
});

const showIconLewati = computed(() => {
  const currentStatus = props.panggilan.statusPanggilan;
  return [0, 1].includes(currentStatus);
});

</script>


<template>
  <Card class="bg-opensimrs-50 w-full rounded-lg">
    <template #content>
      <div class="grid grid-cols-[auto_1fr_auto] items-center h-[60px] gap-3">
        
        <div class="flex bg-opensimrs-75 rounded-md w-[60px] h-[60px] items-center justify-center text-opensimrs-300 font-semibold text-base font-poppins shrink-0">
          {{ nomorAntrian }}
        </div>
        
        
        <div class="flex flex-col justify-start gap-2 text-black min-w-0">
          <div class="flex flex-col justify-center font-poppins">
            <div class="font-bold text-md truncate" :title="namaPasien">{{ namaPasien }}</div>
            <div class="font-normal text-sm text-gray-500">{{ nomorIdentitas }}</div>
          </div>
          <hr class="border-[1px] border-opensimrs-300 -mt-1" />
          <div class="flex items-center gap-1 -mt-1">
            <CustomChip
              :label="jenisPasien"
              :border-color="jenisPasien === 'ASURANSI' ? 'border-[#E89F29]' : 'border-opensimrs-300'"
              :text-color="jenisPasien === 'ASURANSI' ? 'text-[#E89F29]' : 'text-opensimrs-300'"
              :showCheckedIcon="false"
              customClass="font-semibold h-4 border rounded-full text-[9px] bg-transparent font-poppins px-2"
            />
            <CustomChip
              :label="kodeBooking"
              borderColor="border-blue-400"
              textColor="text-blue-600"
              :showCheckedIcon="false"
              customClass="font-semibold h-4 border rounded-full text-[9px] bg-transparent font-poppins px-2"
              />
              <CustomChip
      v-if="status === 'selesai' && nomorAntrianPoli"
      :label="nomorAntrianPoli"
      borderColor="border-gray-400"
      textColor="text-gray-600"
      :showCheckedIcon="false"
      customClass="font-semibold h-4 border rounded-full text-[9px] bg-transparent font-poppins px-2"
    />
          </div>
        </div>
        
        <div class="flex items-center gap-2 w-[136px] justify-end">
          
          <div v-if="showTombolAwal" class="flex items-center gap-2">
            <button
              v-if="showIconPanggil"
              @click="$emit('panggil', panggilan.uuid)"
              class="w-[40px] h-[40px] rounded-lg flex items-center justify-center bg-[#3D84E5] hover:opacity-90"
              :title="panggilan.statusPanggilan === 1 ? 'Panggil Ulang' : 'Panggil'"
            >
              <AnnouncementIcon :size="22" class="text-white"/>
            </button>
            <button
              v-if="showIconLewati"
              @click="$emit('lewati', panggilan.uuid)"
              class="w-[40px] h-[40px] rounded-lg flex items-center justify-center bg-[#E89F29] hover:opacity-90"
              title="Lewati"
            >
              <SkipIcon :size="22" class="text-white"/>
            </button>
            <button
              @click="$emit('proses', panggilan.uuid)"
              class="w-[40px] h-[40px] rounded-lg flex items-center justify-center bg-opensimrs-300 hover:opacity-90"
              title="Proses"
            >
              <PhAddressBook :size="22" color="white" weight="fill" />
            </button>
          </div>

          <div v-else-if="status === 'sedang proses'" class="flex items-center">
            <button
              @click="$emit('selesai', panggilan.uuid)"
              class="w-[44px] h-[44px] rounded-xl flex items-center justify-center bg-success-500 hover:opacity-90"
              v-tooltip.bottom="'Selesaikan Proses'"
            >
              <FinishButton :size="28" color="green" weight="fill" />
            </button>
          </div>
          
          <div v-else>
            </div>

        </div>
      </div>
    </template>
  </Card>
</template>