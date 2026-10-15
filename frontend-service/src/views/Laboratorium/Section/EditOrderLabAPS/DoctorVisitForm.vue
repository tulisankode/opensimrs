<script setup lang="ts">
import { onMounted, ref, type PropType } from "vue";
import { utilsStore } from "@/stores/utils";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomCheckbox from "@/components/Base/CustomCheckbox.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";

const props = defineProps({
  pageType: {
    type: String,
    required: true,
  },
  formType: {
    type: String,
    default: "",
  },
  isDetail: {
    type: Boolean,
    required: false,
  },
  patientData: {
    type: Object as PropType<any>,
    required: true,
  },
});
const status = ref(false);

const storeUtils = utilsStore();

onMounted(() => {
  if (props.formType == "Daftar Bayi Baru Lahir") {
    babyBox.value = true;
  }
  if (storeUtils.selectedRoom) {
    selectedRoomCategory.value = storeUtils.selectedRoom.roomCategory;
    selectedRoomClass.value = storeUtils.selectedRoom.roomClass;
    selectedRoom.value = storeUtils.selectedRoom.room;
    selectedBed.value.push(`${storeUtils.selectedRoom.bed}`);
    storeUtils.setSelectedRoom(null);
  }
});

const mergeBill = ref(false);
const selectedRoomCategory = ref();
const selectedRoomClass = ref();
const selectedRoom = ref();
const selectedBed = ref<string[]>([]);
const babyBox = ref(false);

const selectedPaymentMethod = ref<string[]>(["TUNAI"]);
const onPaymentMethodSelect = (label: string) => {
  selectedPaymentMethod.value[0] = label;
};

const submitForm = () => {
  console.log("Submited Doctor Visit Detail Form");
};

defineExpose({
  submitForm,
});
</script>

<template>
  <CustomAccordion :openWithHeader="false" class="mt-[10px]" initialState="0">
    <template #header>
      <div class="flex justify-between w-full align-middle">
        <div class="flex">
          <span class="leading-10 text-opensimrs-300 text-heading">
            Detail Kunjungan & Dokter
          </span>
          <CustomChip
            label="TUNAI"
            borderColor="border-opensimrs-300"
            bgColor="bg-opensimrs-50"
            iconColor="text-opensimrs-300"
            textColor="text-opensimrs-300"
            customClass="h-5"
            class="my-auto ml-5"
            :isSelected="selectedPaymentMethod.includes('TUNAI')"
            @selected="onPaymentMethodSelect"
            selectedColor="bg-opensimrs-300 border-opensimrs-300"
          />
          <CustomChip
            label="ASURANSI"
            borderColor="border-warning-300"
            bgColor="bg-warning-50"
            iconColor="text-warning-300"
            textColor="text-warning-300"
            customClass="h-5"
            class="ml-[10px] my-auto"
            :isSelected="selectedPaymentMethod.includes('ASURANSI')"
            @selected="onPaymentMethodSelect"
            selectedColor="bg-warning-300 border-warning-300"
          />
        </div>
      </div>
    </template>
    <template #content>
      <div class="pt-5">
        <div class="flex gap-y-5 gap-x-[30px]">
          <CustomSelect
            label="Unit Asal"
            placeHolder="Pilih Unit Asal"
            optionLabel=""
            optionValue=""
            :showFilter="false"
            :options="['Laboratorium', 'Bed 2', 'Bed 3']"
            class="mr-3 grow"
          />
          <CustomTextfield
            label="Dokter Pengirim"
            placeholder="Dokter Pengirim"
            class="w-1/3 mr-3"
          />
          <CustomSwitch
            v-model="status"
            :show-label="true"
            label="Pasien Maternitas"
            sideLabel="Tidak"
            sideLabelTrue="Iya"
            class="w-[150px] mr-3"
          />
        </div>
        <div class="flex gap-y-5 gap-x-[30px] mt-5">
          <CustomTextfield
            label="Keluhan Utama"
            class="w-1/2 col-span-2 mr-3 grow"
            placeholder="Keluhan Utama"
          />
          <CustomTextArea
            label="Catatan"
            class="w-1/2 col-span-2 mr-3"
            placeholder="Catatan"
            height="h-10"
          />
        </div>
        <div v-if="selectedPaymentMethod.includes('ASURANSI')">
          <hr class="my-[30px]" />
          <div class="grid grid-cols-2 gap-y-5 gap-x-[30px]">
            <CustomSelect
              label="Nama Penjamin"
              placeHolder="Pilih Nama Penjamin"
              class=""
              optionLabel=""
              optionValue=""
              :showFilter="false"
              :options="[
                'BPJS Kesehatan',
                'Asuransi Prudential',
                'Asuransi Allianz',
              ]"
              :disabled="isDetail"
            />
            <CustomTextfield
              label="No. Penjamin"
              class=""
              placeholder="No. Penjamin"
              :disabled="isDetail"
            />
          </div>
        </div>
        <div v-if="pageType == 'rawat-inap'">
          <hr class="my-[30px]" />
          <div class="grid grid-cols-6 gap-x-[30px]">
            <CustomTextfield
              label="SPRI"
              class=""
              placeholder="SPRI"
              disabled
            />
            <CustomSelect
              v-model="selectedRoomCategory"
              label="Kategori Ruangan"
              placeHolder="Pilih Kategori Ruangan"
              class="col-span-2"
              optionLabel=""
              optionValue=""
              :showFilter="false"
              :options="['Rawatan Umum']"
              :disabled="isDetail"
            />
            <CustomSelect
              v-model="selectedRoomClass"
              label="Kelas"
              placeHolder="Pilih Kelas"
              class=""
              optionLabel=""
              optionValue=""
              :showFilter="false"
              :options="['Kelas 2']"
              :disabled="isDetail"
            />
            <CustomSelect
              v-model="selectedRoom"
              label="Ruangan"
              placeHolder="Pilih Ruangan"
              class="col-span-2"
              optionLabel=""
              optionValue=""
              :showFilter="false"
              :options="['Mawar']"
              :disabled="isDetail"
            />
          </div>
          <div v-if="selectedRoom" class="grid grid-cols-3 mt-[30px]">
            <div
              class=""
              :class="[
                formType == 'Daftar Bayi Baru Lahir'
                  ? 'col-span-3'
                  : 'col-span-2',
              ]"
            >
              <div>
                <div class="font-semibold text-normal">
                  <span class="text-opensimrs-300">{{ selectedRoom }}</span> >
                  Pilih Bed
                </div>
                <div class="grid grid-cols-2 gap-[10px] mr-[15px]">
                  <CustomCheckbox
                    v-for="(data, index) in ['1', '2', '3', '4', '5', '6']"
                    v-model="selectedBed"
                    :title="
                      selectedBed[0] == data || data == '2' || data == '4'
                        ? 'Nama Lengkap Pasien'
                        : '-'
                    "
                    :subTitle="'Bed ' + data"
                    :endText="
                      selectedBed[0] == data
                        ? 'Terpilih'
                        : data == '2' || data == '4'
                        ? 'Terisi'
                        : 'Kosong'
                    "
                    :key="data + index"
                    :binary="false"
                    :value="`${data}`"
                    :multiple="false"
                    :disabled="
                      data == '2' ||
                      data == '4' ||
                      isDetail ||
                      formType == 'Daftar Bayi Baru Lahir'
                    "
                  />
                </div>
              </div>
              <div v-if="babyBox">
                <div class="mt-5 font-semibold text-normal">
                  <span class="text-opensimrs-300">{{ selectedRoom }}</span> >
                  Pilih Bed - Box Bayi
                </div>
                <div class="grid grid-cols-2 col-span-2 gap-[10px] mr-[15px]">
                  <CustomCheckbox
                    v-for="(data, index) in [
                      'Bed 1',
                      'Bed 2',
                      'Bed 3',
                      'Bed 4',
                      'Bed 5',
                      'Bed 6',
                    ]"
                    v-model="selectedBed"
                    title="-"
                    :subTitle="'Box ' + data"
                    endText="Kosong"
                    :key="data + index"
                    :binary="false"
                    :value="`${data}`"
                    :multiple="false"
                    :disabled="isDetail"
                  />
                </div>
              </div>
            </div>
            <div
              v-if="formType != 'Daftar Bayi Baru Lahir'"
              class="border-l-[1px] border-gray-100 pl-[15px]"
            >
              <CustomSwitch
                label="Tambahan"
                class="mb-[30px]"
                sideLabel="Bed Cadangan"
                :disabled="isDetail"
              />
              <CustomSwitch
                v-model="babyBox"
                label=""
                sideLabel="Box Bayi"
                :disabled="isDetail"
              />
            </div>
          </div>
        </div>
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
