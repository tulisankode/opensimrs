<script setup lang="ts">
import { onMounted, computed, ref, type PropType } from "vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";

const submitForm = () => {
  console.log("Submited Patient Identity Form");
};

defineExpose({
  submitForm,
});
</script>

<template>
  <Card>
    <template #header>
      <div class="flex justify-between w-full align-middle">
        <div class="flex">
          <p
            class="mt-3 ml-5 font-bold leading-10 text-opensimrs-300 text-heading"
          >
            Jadwal Terpilih
          </p>
        </div>
      </div>
      <hr class="mt-5 border-[1px]" />
    </template>

    <template #content>
      <div class="mr-20">
        <div class="flex justify-between ">
          <div>
            <p class="text-xs font-bold underline underline-offset-2">
              Tanggal Terapi
            </p>
            <div class="">01-10-2024</div>
          </div>
          <div>
            <p class="text-xs font-bold underline underline-offset-2">
              Jam Terapi
            </p>
            <div class="">08.00 - 10.00</div>
          </div>
          <div>
            <p class="text-xs font-bold underline underline-offset-2">
              Ruangan
            </p>
            <div class="">Ruangan A</div>
          </div>
          <div>
            <p class="text-xs font-bold underline underline-offset-2">Bed</p>
            <div class="">Bed 01</div>
          </div>
          <div></div>
        </div>
      </div>
    </template>
  </Card>
</template>
