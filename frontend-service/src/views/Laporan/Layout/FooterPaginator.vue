<script setup lang="ts">
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
const props = defineProps({
  rows: {
    type: Number,
    required: true,
  },
  totalRecords: {
    type: Number,
    required: true,
  },
});
const emit = defineEmits(["page", "export", "import", "download"]);
const handlePage = (event: any) => {
  emit("page", event);
};
</script>
<template>
  <div class="flex justify-between py-2.5">
    <CustomButton
      label="Eksport"
      @click="emit('export')"
      icon="FileImportIcon"
    />
    <CustomPaginator
      :rows="rows"
      :totalRecords="totalRecords"
      @page="handlePage"
    />
  </div>
</template>
