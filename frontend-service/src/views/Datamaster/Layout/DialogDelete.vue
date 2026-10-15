di<script setup lang="ts">
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    required: true,
  },
  itemToDelete: {
    type: Object,
    required: false,
  },
});

const emit = defineEmits(["update:isDialogVisible", "close", "delete"]);

const updateVisibility = (value: any) => {
  emit("update:isDialogVisible", value);
};

const closeDialog = () => {
  emit("update:isDialogVisible", false);
};

const deleteData = () => {
  emit("delete", props.itemToDelete);
  emit("update:isDialogVisible", false);
};
</script>

<template>
  <CustomDialog
    width="600px"
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    headerBg="bg-danger-300"
  >
    <template #header> Hapus Data </template>
    <template #body>
      <div class="pt-5 font-normal text-normal">
        Apakah Anda yakin ingin menghapus data
        <span class="font-bold"> {{ title }}</span>
        ini?
      </div>
    </template>
    <template #footer>
      <div class="w-full">
        <div class="mt-5 flex justify-end gap-2.5">
          <CustomButton
            label="Batal"
            border-color="border-grey-200"
            background-color="bg-white"
            text-color="text-grey-300"
            @click="closeDialog"
          />
          <CustomButton
            label="Hapus"
            backgroundColor="bg-danger-300"
            @click="deleteData"
          />
        </div>
      </div>
    </template>
  </CustomDialog>
</template>
