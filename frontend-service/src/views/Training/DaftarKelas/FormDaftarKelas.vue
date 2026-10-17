<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import PilihPasien from "../Komponen/PilihPasien.vue";
import TabelSlot from "../Komponen/TabelSlot.vue";
import { apiTraining, izinTraining, keIso, labelSesi, OPSI_CARA_BAYAR, rupiah, tglIndo, useTrainingStore, type PasienRingkas, type SlotSesi } from "@/stores/penunjang/training";

// Pendaftaran kelas langsung (tanpa booking): pasien terdaftar + cara bayar + kelas/tanggal/sesi dengan slot
// tersedia → POST /order. Order langsung membentuk tagihan Pembayaran senilai tarif kelas.
const emit = defineEmits(["back", "tersimpan"]);
const store = useTrainingStore();
const bolehDaftar = izinTraining("Daftar Kelas", "CREATE DAFTAR KELAS");

const pasien = ref<PasienRingkas | null>(null);
const caraBayar = ref(1);
const tanggalKelas = ref<Date>(new Date());
const kelasUuid = ref<string | null>(null);
const slot = ref<SlotSesi | null>(null);
const galat = ref("");
const menyimpan = ref(false);

const opsiKelas = computed(() => store.kelas.map((k) => ({ value: k.uuid, label: `${k.nama} (${k.kode})` })));
const kelas = computed(() => store.kelas.find((k) => k.uuid === kelasUuid.value));
const tanggalIso = computed(() => keIso(tanggalKelas.value));
watch([kelasUuid, tanggalIso], () => (slot.value = null));

const reset = () => {
  pasien.value = null;
  caraBayar.value = 1;
  tanggalKelas.value = new Date();
  kelasUuid.value = null;
  slot.value = null;
  galat.value = "";
};

const simpan = async () => {
  galat.value = "";
  if (!pasien.value) return (galat.value = "Pilih pasien terdaftar");
  if (!kelasUuid.value) return (galat.value = "Pilih kelas");
  if (!slot.value) return (galat.value = "Pilih slot/sesi yang tersedia pada tabel ketersediaan");
  menyimpan.value = true;
  try {
    const r = await apiTraining.buatOrder({
      kelasUuid: kelasUuid.value,
      tanggalKelas: tanggalIso.value,
      sesiUuid: slot.value.sesiUuid ?? null,
      patientUuid: pasien.value.uuid,
      paymentMethod: caraBayar.value,
    });
    if (r?.payload) emit("tersimpan", r.payload);
  } finally {
    menyimpan.value = false;
  }
};

onMounted(() => store.muatKelas());
</script>
<template>
  <div class="relative w-full overflow-hidden">
    <Card class="h-min mb-[10px] absolute right-0 left-0">
      <template #content>
        <div class="flex justify-between">
          <CustomBreadCrumb :home="{ label: 'Daftar Kelas', home: true }" :model="[{ label: 'Daftar' }]" class="grow" />
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
          <span class="leading-10 text-opensimrs-300 text-heading">Identitas Pasien</span>
        </template>
        <template #content>
          <div class="flex flex-col gap-2 pt-5 md:w-2/3">
            <PilihPasien v-model="pasien" label="Cari Nama / No. RM / No. HP" />
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
      <CustomAccordion noBorder initial-state="0" class="mb-2.5">
        <template #header>
          <div class="flex items-center justify-between w-full">
            <span class="leading-10 text-opensimrs-300 text-heading">Jadwal & Pembayaran</span>
            <div class="flex gap-2.5 mr-2.5" @click.stop>
              <CustomChip
                v-for="o in OPSI_CARA_BAYAR"
                :key="o.value"
                :label="o.label.toUpperCase()"
                :isSelected="caraBayar === o.value"
                @selected="caraBayar = o.value"
              />
            </div>
          </div>
        </template>
        <template #content>
          <div class="grid grid-cols-12 gap-5 pt-5">
            <CustomDatePicker v-model="tanggalKelas" label="Tanggal Kelas" class="col-span-3" :min-date="new Date()" />
            <CustomSelect v-model="kelasUuid" label="Kelas" :options="opsiKelas" optionLabel="label" optionValue="value" placeHolder="Pilih Kelas" class="col-span-5" />
            <div class="flex flex-col justify-end col-span-4 text-sm">
              <span class="text-grey-400">Tarif</span>
              <span class="font-semibold">{{ kelas ? rupiah(kelas.harga) : "-" }}</span>
            </div>
            <div class="col-span-12">
              <TabelSlot
                :kelasUuid="kelasUuid"
                :tanggal="tanggalIso"
                :terpilih="slot ? slot.sesiUuid ?? null : undefined"
                labelPilih="Pilih"
                @pilih="slot = $event"
              />
            </div>
            <div v-if="slot && kelas" class="col-span-12 p-3 text-sm rounded-lg bg-opensimrs-50">
              Jadwal terpilih: <b>{{ kelas.nama }}</b> · {{ tglIndo(tanggalIso, true) }} · {{ slot.namaSesi ? labelSesi(slot) : "tanpa sesi" }} · sisa slot {{ slot.tersedia }}
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
    </div>
    <Card class="h-min mt-[10px] absolute bottom-0 right-0 left-0">
      <template #content>
        <div class="flex items-center justify-end gap-2.5">
          <span v-if="galat" class="mr-auto text-sm text-danger-300">{{ galat }}</span>
          <CustomButton label="Reset" class="mr-[10px]" outlined borderColor="border-grey-200" textColor="text-grey-300" @click="reset" />
          <CustomButton v-if="bolehDaftar" label="Simpan Pendaftaran" backgroundColor="bg-opensimrs-300" :loading="menyimpan" @click="simpan" />
        </div>
      </template>
    </Card>
  </div>
</template>
