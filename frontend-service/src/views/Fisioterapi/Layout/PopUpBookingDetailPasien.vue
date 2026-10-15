<script lang="ts" setup>
import { ref } from "vue";

import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { useIcd9Store } from "@/stores/datamaster/icd9";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomChip from "@/components/Base/CustomChip.vue";

const props = defineProps({
  isDialogVisible: {
    default: false,
  },
  title: {
    type: String,
  },
  method: {
    type: String,
  },
  payload: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);

const method = ref(props.method);
const title = ref(props.title);

const updateVisibility = (value: any) => {
  emit("update:isDialogVisible", value);
};

const closeDialog = () => {
  emit("update:isDialogVisible", false);
};
</script>

<template>
  <CustomDialog
    width="1000px"
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    headerBg="bg-opensimrs-300"
  >
    <template #header>
      <div class="flex justify-between">
        <div class="flex">
          {{ title }}
        </div>
        <div class="flex ml-[470px]">
          <div class="bg-white w-[1px] h-[30px]"></div>
          <p class="text-sm ml-[10px] mt-[3px] mr-5">Tgl. Order : 3-11-2024</p>
        </div>
      </div>
    </template>

    <template #body>
      <!-- Form Input -->
      <div>
        <div class="pt-5 mb-5">
          <div class="flex flex-row">
            <div class="basis-1/4">
              <p class="font-bold text-MD">Nama lengkap pasien</p>
              <p>REG1231235</p>
              <CustomButton class="w-24 h-5 text-sm">00-00-00</CustomButton>
              <CustomChip
                :showCheckedIcon="false"
                label="Laki-laki"
                bgColor="bg-male-75"
                textColor="text-male-300"
                customClass="h-5 pr-[6px] border-none mr-[5px] ml-2"
              />
            </div>
            <div
              class="bg-mediumGrey-300 w-[1px] h-[85px] mr-[20px] ml-[40px]"
            ></div>
            <div class="mt-[20px] mr-[40px]">
              <p class="text-xs font-bold underline underline-offset-2">
                Tgl. Lahir
              </p>
              <p class="">10 Januari 2090</p>
            </div>
            <div class="mt-[20px] mr-[40px]">
              <p class="text-xs font-bold underline underline-offset-2">Umur</p>
              <p class="">24Thn 2Bln 1Hari</p>
            </div>
            <div class="mt-[20px] mr-[40px]">
              <p class="text-xs font-bold underline underline-offset-2">
                Alergi
              </p>
              <p class="">Tidak Ada</p>
            </div>
          </div>
        </div>
      </div>
      <div class="mt-10">
        <p class="font-bold text-MD">Profil Pasien</p>
      </div>
      <hr class="mt-5 border-[1px]" />
      <div class="grid grid-cols-3 gap-4 mt-8">
        <div class="">
          <p class="text-xs font-bold underline underline-offset-2">KTP</p>
          <p>1666666666666666</p>
          <p class="text-xs font-bold underline underline-offset-2 mt-[10px]">
            Provinsi
            <span> </span>
          </p>
          <p>Jawa Timur</p>
          <p class="mt-3 text-xs font-bold underline underline-offset-2">
            Kelurahahn / Desa
          </p>
          <p>Keputih</p>
          <p class="text-xs font-bold underline underline-offset-2 mt-[10px]">
            Alamat
            <span> </span>
          </p>
          <p>Jl. Ijo Abang no. 17</p>
        </div>

        <div>
          <p class="text-xs font-bold underline underline-offset-2">
            No. Handphone
          </p>
          <p class="">080000000000</p>
          <p class="text-xs font-bold underline underline-offset-2 mt-[10px]">
            Kabupaten / Kota
          </p>
          <p class="">Surabaya</p>
          <div class="flex flex-row mt-[10px]">
            <div class="basis-1/4">
              <p class="text-xs font-bold underline underline-offset-2">RT</p>
              <p>01</p>
            </div>
            <div class="basis-1/4">
              <p class="text-xs font-bold underline underline-offset-2">RW</p>
              <p>02</p>
            </div>
          </div>
        </div>
        <div>
          <p class="text-xs font-bold underline underline-offset-2">Agama</p>
          <p class="">Islam</p>
          <p class="text-xs font-bold underline underline-offset-2 mt-[10px]">
            Kecamatan
          </p>
          <p class="">Sukolilo</p>
          <p class="text-xs font-bold underline underline-offset-2 mt-[10px]">
            Kode Pos
          </p>
          <p class="">12345</p>
        </div>
      </div>
      <div class="mt-12">
        <p class="font-bold text-MD">Jadwal & Bed</p>
      </div>
      <hr class="mt-5 border-[1px]" />
      <div class="flex justify-between mt-8">
        <div>
          <p class="text-xs font-bold underline underline-offset-2">
            Tanggal Terapi
          </p>
          <div class="">
            01-10-2024
          </div>
        </div>
        <div>
          <p class="text-xs font-bold underline underline-offset-2">
            Jam Terapi
          </p>
          <div class="">
            08.00 - 10.00
          </div>
        </div>
        <div>
          <p class="text-xs font-bold underline underline-offset-2">
            Ruangan
          </p>
          <div class="">
            Ruangan A
          </div>
        </div>
        <div>
          <p class="text-xs font-bold underline underline-offset-2">
            Bed
          </p>
          <div class="">
            Bed 01
          </div>
        </div>
        <div></div>
      </div>
    </template>

    <template #footer>
      <div class="w-full">
        <div class="mt-5 flex justify-end gap-2.5">
          <CustomButton
            label="Edit Booking"
            outlined
            borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300"
            @click="closeDialog"
          />
          <CustomButton label="Daftar" @click="" />
        </div>
      </div>
    </template>
  </CustomDialog>
</template>
