<script setup lang="ts">
import { watch, ref } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
const props = defineProps({
  cancleButton: {
    type: Boolean,
    default: false,
  },
  showCancelVisit: {
    type: Boolean,
  },
  rows: {
    type: Number,
    required: true,
  },
  totalRecords: {
    type: Number,
    required: true,
  },
  cancleSelected:{
    type:Array,
    default: () => []
  }

});
const emit = defineEmits([
  "toggle-cancel-visit",
  "confirm-cancel",
  "update:valueCancle",
  "page",
  "update:cancleReason",
  "update:cancleSelected",
  "export",
]);
const cancleReason=ref<string>("")
const handlePage = (event: any) => {
  emit("page", event);
};

const handleCancleVisit=()=>{
  cancleReason.value='';
  emit('update:cancleSelected', []);
  emit('toggle-cancel-visit', false)
}
</script>

<template>
  <div class="flex justify-between">
    <div v-if="cancleButton" class="flex">
      <CustomButton
        v-if="!showCancelVisit"
        @click="$emit('toggle-cancel-visit', true)"
        class="my-auto bg-danger-300"
        label="Batal Kunjungan"
      />
      <CustomButton
        v-if="showCancelVisit"
        @click="handleCancleVisit"
        class="my-auto mr-[10px]"
        label="Batal"
        outlined
        borderColor="border-grey-200"
        textColor="text-grey-300"
      />
      <CustomButton
        v-if="showCancelVisit"
        @click="$emit('confirm-cancel')"
        class="my-auto mr-5 bg-danger-300"
        label="Iya, Batalkan"
        :disabled="!cancleReason || cancleSelected.length === 0"
      />
      <CustomTextfield
        v-if="showCancelVisit"
        :showLabel="false"
        v-model="cancleReason"
        class="my-auto w-[400px]"
        placeholder="Alasan Batal Kunjungan"
        @update:modelValue="$emit('update:cancleReason', cancleReason)"
      />
    </div>
    <CustomButton
      v-else
      icon="PhPrinter"
      icon-pos="left"
      icon-type="fill"
      class="my-auto bg-opensimrs-300"
      label="Cetak"
      @click="$emit('export')"
    />
    <CustomPaginator :rows="rows"
      :totalRecords="totalRecords"
      @page="handlePage" />
  </div>
</template>
