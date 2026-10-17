<script setup lang="ts">
import { ref, type PropType } from "vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import PilihPasien from "../Komponen/PilihPasien.vue";
import { apiTraining, izinTraining, tglIndo, type PasienRingkas } from "@/stores/penunjang/training";

// Form booking: jadwal terpilih (kelas + tanggal + sesi) dan pasien terdaftar (master Admisi). Booking belum
// membentuk tagihan; tagihan terbentuk saat booking dilanjutkan ke pendaftaran (DetailBooking › Daftar).
type Jadwal = { kelasUuid: string; kelasNama: string; tanggalKelas: string; sesiUuid: string | null; namaSesi: string; tersedia: number };
const props = defineProps({ jadwal: { type: Object as PropType<Jadwal>, required: true } });
const emit = defineEmits(["back", "tersimpan"]);

const bolehBooking = izinTraining("Booking Kelas", "CREATE BOOKING");
const pasien = ref<PasienRingkas | null>(null);
const galat = ref("");
const menyimpan = ref(false);

const simpan = async () => {
  galat.value = pasien.value ? "" : "Pilih pasien terdaftar";
  if (!pasien.value) return;
  menyimpan.value = true;
  try {
    const r = await apiTraining.buatBooking({
      kelasUuid: props.jadwal.kelasUuid,
      tanggalKelas: props.jadwal.tanggalKelas,
      sesiUuid: props.jadwal.sesiUuid,
      patientUuid: pasien.value.uuid,
    });
    if (r?.payload) emit("tersimpan", r.payload);
  } finally {
    menyimpan.value = false;
  }
};
</script>
<template>
  <div class="relative w-full overflow-hidden">
    <Card class="h-min mb-[10px] absolute right-0 left-0">
      <template #content>
        <div class="flex justify-between">
          <CustomBreadCrumb :home="{ label: 'Booking Kelas', home: true }" :model="[{ label: 'Cari Jadwal & Kelas' }, { label: 'Booking' }]" class="grow" />
          <CustomButton
            label="Kembali"
            icon="PhCaretLeft"
            background-color="bg-white"
            border-color="border-opensimrs-300"
            text-color="text-opensimrs-300"
            @click="emit('back')"
          />
        </div>
      </template>
    </Card>
    <div class="relative h-full overflow-auto top-[100px] pb-[180px]">
      <CustomAccordion noBorder initial-state="0">
        <template #header>
          <div class="flex justify-between w-full align-middle">
            <span class="leading-10 text-opensimrs-300 text-heading">Jadwal Terpilih</span>
          </div>
        </template>
        <template #content>
          <div class="grid grid-cols-4 pt-5">
            <div class="flex flex-col">
              <div class="font-semibold underline text-SM">Tanggal Kelas</div>
              <div class="font-normal text-normal">{{ tglIndo(jadwal.tanggalKelas, true) }}</div>
            </div>
            <div class="flex flex-col">
              <div class="font-semibold underline text-SM">Kelas</div>
              <div class="font-normal text-normal">{{ jadwal.kelasNama }}</div>
            </div>
            <div class="flex flex-col">
              <div class="font-semibold underline text-SM">Sesi</div>
              <div class="font-normal text-normal">{{ jadwal.namaSesi }}</div>
            </div>
            <div class="flex flex-col">
              <div class="font-semibold underline text-SM">Sisa Slot</div>
              <div class="font-normal text-normal">{{ jadwal.tersedia }}</div>
            </div>
          </div>
        </template>
        <template #collapseIcon>
          <CustomButton icon="PhCaretUp" backgroundColor="bg-opensimrs-75" textColor="text-opensimrs-300" />
        </template>
        <template #expandIcon>
          <CustomButton icon="PhCaretDown" backgroundColor="bg-opensimrs-75" textColor="text-opensimrs-300" />
        </template>
      </CustomAccordion>
      <CustomAccordion noBorder initial-state="0" class="mb-2.5">
        <template #header>
          <div class="flex justify-between w-full align-middle">
            <span class="leading-10 text-opensimrs-300 text-heading">Identitas Pasien</span>
          </div>
        </template>
        <template #content>
          <div class="flex flex-col gap-2 pt-5 md:w-2/3">
            <PilihPasien v-model="pasien" label="Cari Nama / No. RM / No. HP" :invalidMessage="galat" />
            <p class="text-xs text-grey-400">Pasien belum terdaftar? Daftarkan terlebih dahulu di Admisi, lalu cari di sini.</p>
          </div>
        </template>
        <template #collapseIcon>
          <CustomButton icon="PhCaretUp" backgroundColor="bg-opensimrs-75" textColor="text-opensimrs-300" />
        </template>
        <template #expandIcon>
          <CustomButton icon="PhCaretDown" backgroundColor="bg-opensimrs-75" textColor="text-opensimrs-300" />
        </template>
      </CustomAccordion>
    </div>
    <Card class="h-min mt-[10px] absolute bottom-0 right-0 left-0">
      <template #content>
        <div class="flex justify-end gap-2.5">
          <CustomButton label="Reset" class="mr-[10px]" outlined borderColor="border-grey-200" textColor="text-grey-300" @click="pasien = null" />
          <CustomButton v-if="bolehBooking" label="Simpan Booking" backgroundColor="bg-opensimrs-300" :loading="menyimpan" @click="simpan" />
        </div>
      </template>
    </Card>
  </div>
</template>
