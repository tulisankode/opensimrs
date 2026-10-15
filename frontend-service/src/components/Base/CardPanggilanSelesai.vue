<script setup>
import Card from "primevue/card";
import CustomChip from "./CustomChip.vue";

const props = defineProps({
  // Kiri
  nomorAntrian: {
    type: Number,
    default: 1,
  },
  // Tengah
  namaPasien: {
    type: String,
    default: "Nama Pasien",
  },
  nomorIdentitas: {
    type: String,
    default: "123",
  },
  kodeBooking: {
    type: String,
    default: "BOOK.123",
  },
  // Kanan
  showIconSelesai: {
    type: Boolean,
    default: false,
  },
  showIconPanggil: {
    type: Boolean,
    default: true,
  },
  showIconLewati: {
    type: Boolean,
    default: true,
  },
  showIconProcess: {
    type: Boolean,
    default: true,
  },
  namaDokter: {
    type: String,
    default: "dr. Spesialis Sp.A",
  },
});
</script>

<template>
  <Card class="bg-opensimrs-50 h-[92px]">
    <template #content>
      <div class="flex items-center h-full gap-3 -mt-2 text-black font-poppins">
        <!-- Kiri -->
        <div
          class="flex bg-opensimrs-75 rounded-md w-[60px] items-center justify-center text-opensimrs-300 font-semibold text-base h-[60px]"
        >
          {{ nomorAntrian }}
        </div>

        <!-- Tengah dan Kanan -->
        <div class="flex-1">
          <!-- Atas sebelum hr -->
          <div class="flex justify-between">
            <!-- Kolom Kiri: Nama Pasien dan Nomor Identitas -->
            <div class="flex flex-col justify-center text-left">
              <div class="font-bold text-MD">{{ namaPasien }}</div>
              <div class="font-normal text-SM">{{ nomorIdentitas }}</div>
            </div>

            <!-- Kolom Kanan: Nama Dokter -->
            <div class="flex items-center justify-end max-w-xs text-right">
              <span class="whitespace-normal text-SM">{{ namaDokter }}</span>
            </div>
          </div>
          
          <hr class="border-[1px] border-opensimrs-300 my-1" />
          
          <!-- Setelah hr -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1">
              <CustomChip
                label="TUNAI"
                border-color="border-opensimrs-300"
                text-color="text-opensimrs-300"
                :showCheckedIcon="false"
                customClass="font-semibold h-4 border-2 rounded-full text-[8px] bg-transparent font-poppins"
              />
              <div class="mt-1 font-normal text-SM font-poppins">
                {{ kodeBooking }}
              </div>
            </div>
            <div class="flex items-center">
              <CustomChip
                label="POLI ANAK"
                :showCheckedIcon="false"
                customClass="font-semibold h-4 border-2 rounded-full text-[8px] bg-transparent font-poppins"
              />
            </div>
          </div>
        </div>
        
      </div>
    </template>
  </Card>
</template>
