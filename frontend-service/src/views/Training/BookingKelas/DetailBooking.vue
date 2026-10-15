<script lang="ts" setup>
import { ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { useIcd9Store } from "@/stores/datamaster/icd9";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
const props = defineProps({
  isDialogVisible: {
    default: false,
  },
  payload: {
    type: Object,
    default: () => ({}),
  },
});
const emit = defineEmits(["update:isDialogVisible", "close"]);

const updateVisibility = (value: any) => {
  emit("update:isDialogVisible", value);
};
const closeDialog = () => {
  emit("update:isDialogVisible", false);
};
</script>
<template>
  <CustomDialog
    width="800px"
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    headerBg="bg-opensimrs-300"
  >
    <template #header>
      <div class="flex justify-between items-center">
        <div class="flex">
          <span class="font-semibold text-MD text-white mr-2.5">BOOKN020</span>
          <CustomChip
            label="APS"
            borderColor="border-grey-400"
            bgColor="bg-grey-100"
            textColor="text-grey-400"
            :showCheckedIcon="false"
            class="font-semibold text-XS mr-1"
          />
          <CustomChip
            label="Tunai"
            borderColor="border-opensimrs-300"
            bgColor="bg-opensimrs-50"
            textColor="text-opensimrs-300"
            :showCheckedIcon="false"
            class="font-semibold text-XS"
          />
        </div>
        <div class="font-semibold text-SM font-white border-l pl-5 mr-2.5">
          Tgl. Booking: 01-01-2004
        </div>
      </div>
    </template>
    <template #body>
      <div class="flex justify-between items-center">
        <div class="flex flex-col mt-5 pr-10 border-r border-grey-200">
          <div class="font-semibold text-MD">Nama Lengkap Pasien</div>
          <div class="font-normal text-normal">REG2407010049</div>
          <div class="flex gap-1">
            <CustomChip
              label="00-00-00"
              bgColor="bg-opensimrs-300"
              borderColor="border-opensimrs-300"
              textColor="text-white"
              :showCheckedIcon="false"
              class="font-semibold text-XS"
            />
            <CustomChip
              label="Laki-laki"
              bgColor="bg-male-75"
              borderColor="border-male-75"
              textColor="text-male-300"
              :showCheckedIcon="false"
              class="font-semibold text-XS"
            />
          </div>
        </div>
        <div class="flex flex-col">
          <div class="font-semibold underline text-SM">Tanggal Lahir</div>
          <div class="font-normal text-normal">10 Januari 1990</div>
        </div>
        <div class="flex flex-col">
          <div class="font-semibold underline text-SM">Umur</div>
          <div class="font-normal text-normal">24Thn 2Bln 1Hri</div>
        </div>
      </div>
      <CustomAccordion noBorder initial-state="0">
        <template #header>
          <div class="font-semibold text-MD -ml-4">Profil Pasien</div>
        </template>
        <template #content>
          <div
            class="grid grid-cols-3 gap-2.5 -ml-4 pt-5 justify-between items-center"
          >
            <div class="flex flex-col">
              <div class="font-semibold underline text-SM">KTP</div>
              <div class="font-normal text-normal">16666666666666</div>
            </div>
            <div class="flex flex-col">
              <div class="font-semibold underline text-SM">No.Handphone</div>
              <div class="font-normal text-normal">080000000000</div>
            </div>
            <div class="flex flex-col">
              <div class="font-semibold underline text-SM">Agama</div>
              <div class="font-normal text-normal">Islam</div>
            </div>
            <div class="flex flex-col">
              <div class="font-semibold underline text-SM">Provinsi</div>
              <div class="font-normal text-normal">Jawa Timur</div>
            </div>
            <div class="flex flex-col">
              <div class="font-semibold underline text-SM">Kabupaten/Kota</div>
              <div class="font-normal text-normal">Surabaya</div>
            </div>
            <div class="flex flex-col gap-5">
              <div class="font-semibold underline text-SM">Kecamatan</div>
              <div class="font-normal text-normal">Sukolilo</div>
            </div>
            <div class="flex flex-col gap-5">
              <div class="font-semibold underline text-SM">Kelurahan/Desa</div>
              <div class="font-normal text-normal">Keputih</div>
            </div>
            <div class="flex gap-5">
                <div class="flex flex-col">
              <div class="font-semibold underline text-SM">RT</div>
              <div class="font-normal text-normal">01</div>
            </div>
            <div class="flex flex-col">
              <div class="font-semibold underline text-SM">RW</div>
              <div class="font-normal text-normal">02</div>
            </div>
            </div>
            <div class="flex flex-col">
              <div class="font-semibold underline text-SM">Kodepos</div>
              <div class="font-normal text-normal">12345</div>
            </div>
            <div class="flex flex-col">
              <div class="font-semibold underline text-SM">Alamat</div>
              <div class="font-normal text-normal">Jl. Ijo Abang no.17</div>
            </div>
          </div>
        </template>
        <template #collapseIcon>
          <PhCaretUp class="text-opensimrs-300" />
        </template>
        <template #expandIcon>
          <PhCaretDown class="text-opensimrs-300" />
        </template>
      </CustomAccordion>
      <CustomAccordion noBorder initial-state="0">
        <template #header>
          <div class="font-semibold text-MD -ml-4">Jadwal & Slot</div>
        </template>
        <template #content>
          <div class="grid grid-cols-4 -ml-4 pt-5 gap-2.5">
            <div class="flex flex-col">
              <div class="font-semibold underline text-SM">Tanggal Lahir</div>
              <div class="font-normal text-normal">01-01-2024</div>
            </div>
            <div class="flex flex-col">
              <div class="font-semibold underline text-SM">Kelas</div>
              <div class="font-normal text-normal">Zumba</div>
            </div>
            <div class="flex flex-col">
              <div class="font-semibold underline text-SM">Sesi</div>
              <div class="font-normal text-normal">-</div>
            </div>
            <div class="flex flex-col">
              <div class="font-semibold underline text-SM">Slot</div>
              <div class="font-normal text-normal">Slot 1</div>
            </div>
          </div>
        </template>
        <template #collapseIcon>
          <PhCaretUp class="text-opensimrs-300" />
        </template>
        <template #expandIcon>
          <PhCaretDown class="text-opensimrs-300" />
        </template>
      </CustomAccordion>
    </template>
    <template #footer>
        <div class="flex justify-end gap-2.5">
            <CustomButton
            label="Edit Booking"
            outlined
            borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300"
          />
          <CustomButton
            label="Daftar"
            class=""
            backgroundColor="bg-opensimrs-300"
          />
        </div>
    </template>
  </CustomDialog>
</template>
