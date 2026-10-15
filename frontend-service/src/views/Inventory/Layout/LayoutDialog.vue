<script setup lang="ts">
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { ref } from "vue";
import { onMounted } from "vue";

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    required: true,
  },
  buttonFooterLeft: {
    type: String,
  },
  buttonFooterRight: {
    type: String,
  },
  labelTextField: {
    type: String,
  },
  message: {
    type: String,
  },
  spanMessage: {
    type: String,
  },
  extendedMessage: {
    type:String
  }
});

const alasan = ref("");

onMounted(() => {
  console.log(props.labelTextField);
  console.log(props.buttonFooterLeft);
});

const emit = defineEmits(["update:isDialogVisible", "close", "reject"]);

const updateVisibility = (value: any) => {
  emit("update:isDialogVisible", value);
};

const closeDialog = () => {
  emit("update:isDialogVisible", false);
};

const onSubmit = (() => {
    // console.log(alasan.value);
    emit("reject", alasan.value);
    alasan.value = ""
    closeDialog();
})
</script>

<template>
  <CustomDialog
    width="600px"
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    headerBg="bg-danger-300"
  >
    <template #header>{{ title }} </template>
    <template #body>
      <div class="flex flex-col gap-5 pt-5 font-normal text-normal">
        <CustomTextfield
          :label="labelTextField"
          :placeholder="labelTextField"
          v-model:modelValue="alasan"
        />
        <div class="italic font-normal text-normal text-danger-300">
          {{ message }}
          <span class="font-bold text-normal">{{ spanMessage }}</span>
          <span>{{ extendedMessage }}</span>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="w-full">
        <div class="mt-5 flex justify-end gap-2.5">
          <CustomButton
            :label="buttonFooterLeft"
            border-color="border-grey-200"
            background-color="bg-white"
            text-color="text-grey-300"
            @click="closeDialog"
          />
          <CustomButton
            :label="buttonFooterRight"
            backgroundColor="bg-danger-300"
            @click="onSubmit"
          />
        </div>
      </div>
    </template>
  </CustomDialog>
</template>
