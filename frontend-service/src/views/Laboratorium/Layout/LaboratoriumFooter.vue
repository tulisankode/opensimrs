<script lang="ts" setup>
import {ref} from 'vue'
import CustomButton from '@/components/Base/CustomButton.vue';
import CustomPaginator from '@/components/Base/CustomPaginator.vue';
const rows = ref(10);
const props=defineProps({
    totalRecords:{
        default:120
    },
    importExport:{
        default:true
    },
    rowsPerPageOptions:{
      default:[]
    }
})
const emits = defineEmits(['update:rows', 'update:current-page']);
const handleRowsUpdate = (rows: number) => {
  console.log('Rows updated:', rows);
};
const handlePageUpdate = (page: number) => {
  console.log('Page updated:', page);
};

</script>
<template>
  <div class="flex justify-between px-5 py-2.5">
    <CustomPaginator
      class="ml-auto"
      :rows="10"
      :totalRecords="100"
      :rowsPerPageOptions="[10, 20, 30]"
      @update:rows="handleRowsUpdate"
      @update:current-page="handlePageUpdate"
    />
  </div>
</template>
