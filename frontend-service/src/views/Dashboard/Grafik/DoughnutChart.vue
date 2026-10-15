<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import Chart from 'primevue/chart';

const props = defineProps({
  labels: {
    type: Array as () => string[],
    default: () => []
  },
  data: {
    type: Array as () => number[],
    default: () => [] 
  },
  backgroundColor: {
    type: Array as () => string[],
    default: () =>[]
  },


});


const chartData = ref({});
const chartOptions = ref({});


onMounted(() => {
  chartData.value = setChartData();
  chartOptions.value = setChartOptions();
});

watch(
  () => [props.labels, props.data, props.backgroundColor],
  () => {
    chartData.value = setChartData();
  },
  { deep: true }
);

const setChartData = () => {
  return {
    labels: props.labels,
    datasets: [
      {
        data: props.data,
        backgroundColor: props.backgroundColor,
        borderWidth: 0,

      }
    ]
  };
};

const setChartOptions = () => {
  return {
    responsive: true,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          usePointStyle: true,
        },
      },
    },
    cutout: '60%',
  };
};
</script>

<template>
  <div class="w-auto p-5">
    <div class="flex justify-center">
      <Chart type="doughnut" :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>
