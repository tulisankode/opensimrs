<script setup lang="ts">
import { ref } from "vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomRadio from "@/components/Base/CustomRadio.vue";

const optionsStatusPulang = ref([
  { label: "Pulang Atas Persetujuan Dokter", value: "home" },
  { label: "Pulang Atas Permintaan Sendiri", value: "aadvice" },
  { label: "Dirujuk", value: "other-hfc" },
  { label: "Meninggal < 48 Jam", value: "exp-lt48h" },
  { label: "Meninggal > 48 Jam", value: "exp-gt48h" },
  { label: "Lainnya", value: "oth" },
]);
const optionsRujukInternal = ref(["Rawat Inap", "Kontrol Ulang", "Konsultasi"]);
const optionsRujukEksternal = ref(["Rawat Inap", "Rawat Jalan"]);
const optionsTujuanRujuk = ref([
  { label: "Poli", value: "OF" },
  { label: "Fasyankes (Rumah Sakit)", value: "HOSP" },
  { label: "Fasyankes (Klinik)", value: "PC" },
  { label: "Lain-lain", value: "oth" },
]);
const optionsTransportRujuk = ref([
  { label: "Ambulans", value: "AMB" },
  { label: "Lain-lain", value: "oth" },
]);
const optionsIsInternal = ref([
  { label: "Internal", value: true },
  { label: "Eksternal", value: false },
]);

const modelValue = defineModel<{
  statusPulang: string;
  statusPulangKeterangan: string;
  dischargeDate: any;
  isInternal: boolean;
  rujukInternal: string;
  rujukEksternal: string;
  instruksiTindakLanjut: string;
  tujuanRujuk: string;
  tujuanRujukLainnya: string;
  transportRujuk: string;
  transportRujukLainnya: string;
  instruksiNoDarurat: string;
}>("modelValue", {
  default: () => ({
    statusPulang: "",
    statusPulangKeterangan: "",
    dischargeDate: new Date(),
    isInternal: true,
    rujukInternal: "",
    rujukEksternal: "",
    instruksiTindakLanjut: "",
    tujuanRujuk: "",
    tujuanRujukLainnya: "",
    transportRujuk: "",
    transportRujukLainnya: "",
    instruksiNoDarurat: "",
  }),
});

const accordion = ref<HTMLCanvasElement | null>(null);
const open = () => {
  if (accordion.value) {
    (accordion.value as any).open();
  }
};
const close = () => {
  if (accordion.value) {
    (accordion.value as any).close();
  }
};

const getStatusPulangNama = (value: string) => {
  const result = optionsStatusPulang.value.find((data) => data.value == value);
  return result ?? "-";
};

defineExpose({
  open,
  close,
  getStatusPulangNama,
});
</script>
<template>
  <CustomAccordion
    initial-state="0"
    header-class="bg-opensimrs-50"
    ref="accordion"
  >
    <template #header> Status Pulang </template>
    <template #content>
      <div class="flex flex-col gap-5 pt-5">
        <div class="flex gap-[30px]">
          <CustomSelect
            v-model="modelValue.statusPulang"
            label="Status Pulang"
            place-holder="Pilih Status Pulang"
            :options="optionsStatusPulang"
            optionValue="value"
            optionLabel="label"
            class="grow"
          />
          <CustomTextfield
            v-if="modelValue.statusPulang === 'oth'"
            v-model="modelValue.statusPulangKeterangan"
            label="Keterangan"
            placeholder="Keterangan"
          />
          <CustomDatePicker
            v-model="modelValue.dischargeDate"
            label="Tanggal Discharge"
            class="col-span-1"
            :max-date="new Date()"
            showTime
          />
        </div>
        <div
          v-if="modelValue.statusPulang === 'other-hfc'"
          class="flex flex-col gap-5"
        >
          <hr class="border-grey-200 my-2.5" />

          <div class="flex gap-[30px]">
            <div
              class="grid grid-cols-2 gap-x-5 pr-[30px] border-r border-grey-200"
            >
              <div class="col-span-2 font-semibold text-normal">Rujukan</div>
              <CustomRadio
                v-for="data in optionsIsInternal"
                v-model="modelValue.isInternal"
                :sideLabel="data.label"
                :value="data.value"
              />
            </div>
            <CustomSelect
              v-if="modelValue.isInternal"
              v-model="modelValue.rujukInternal"
              :options="optionsRujukInternal"
              option-label=""
              option-value=""
              label="Rujukan Internal"
              place-holder="Pilih Rujukan Internal"
              class="grow"
            />
            <CustomSelect
              v-else
              v-model="modelValue.rujukEksternal"
              :options="optionsRujukEksternal"
              option-label=""
              option-value=""
              label="Rujukan Eksternal"
              place-holder="Pilih Rujukan Eksternal"
              class="grow"
            />
            <CustomTextfield
              label="Instruksi Tindak Lanjut"
              v-model="modelValue.instruksiTindakLanjut"
              placeholder="Instruksi Tindak Lanjut"
              class="grow"
            />
          </div>
          <div class="flex gap-[30px]">
            <CustomSelect
              label="Tujuan Rujukan"
              v-model="modelValue.tujuanRujuk"
              :options="optionsTujuanRujuk"
              option-label="label"
              option-value="value"
              place-holder="Pilih Tujuan Rujuk"
              class="grow"
            />
            <CustomTextfield
              v-if="modelValue.tujuanRujuk == 'oth'"
              label="Keterangan"
              v-model="modelValue.tujuanRujukLainnya"
              placeholder="Keterangan"
              class="grow"
            />
          </div>
          <div class="flex gap-[30px]">
            <CustomTextfield
              label="No. Darurat"
              v-model="modelValue.instruksiNoDarurat"
              placeholder="08xxx-xxxx-xxxx"
              class="grow"
            />
            <CustomSelect
              label="Transportasi"
              v-model="modelValue.transportRujuk"
              :options="optionsTransportRujuk"
              option-label="label"
              option-value="value"
              place-holder="Pilih Transportasi"
              class="grow"
            />
            <CustomTextfield
              v-if="modelValue.transportRujuk == 'oth'"
              label="Transportasi Lainnya"
              v-model="modelValue.transportRujukLainnya"
              placeholder="Transportasi Lainnya"
              class="grow"
            />
          </div>
        </div>
      </div>
    </template>
  </CustomAccordion>
</template>
