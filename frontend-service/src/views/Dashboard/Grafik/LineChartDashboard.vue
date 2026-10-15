<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import Chart from "primevue/chart";
import CustomChip from "@/components/Base/CustomChip.vue";
import CardGrafik from "./CardGrafik.vue";

const props = defineProps({
    headerGrafik: {
        type: String,
        default: "",
    },
    width: {
        type: String,
        default: "100%",
    },
    datasets: {
        type: Array,
        required: true,
    },
    labels: {
        type: Array,
        required: true,
    },
    showLegend: {
        type: Boolean,
        default: false
    },
    legendPosition: {
        type: String,
        default: 'bottom'
    },
    labelsColor: {
        type: String,
        default: '#000000'
    },
    title: {
        type: String,
        default: "Tanggal Kunjungan"
    },
});

const chartData = ref({});
const chartOptions = ref({});

onMounted(() => {
    chartData.value = setChartData();
    chartOptions.value = setChartOptions();
});

watch(
    () => [props.labels, props.datasets],
    () => {
        chartData.value = setChartData();
    },
    { deep: true }
);

const setChartData = () => {
    return {
        labels: props.labels,
        datasets: props.datasets,
    };
};

const setChartOptions = () => {
    const documentStyle = getComputedStyle(document.documentElement);
    const textColorSecondary = documentStyle.getPropertyValue(
        "--p-text-muted-color"
    );

    return {
        responsive: true,
        aspectRatio: 3,
        plugins: {
            legend: {
                display: props.showLegend,
                position: props.legendPosition,
                labels: {
                    color: props.labelsColor || textColorSecondary,
                    usePointStyle: true,
                    font: {
                        family: 'Poppins',
                        weight: 600,
                        size: 12 // Menjadikan label bold
                    },
                    padding: 30
                }
            },
        },
        scales: {
            x: {
                ticks: {
                    color: textColorSecondary,
                    padding: 2,
                },
                grid: {
                    display: false,
                    drawBorder: false,
                },
                offset: true,
            },
            y: {
                min: 0,
                max: 4,
                ticks: {
                    stepSize: 1,
                    color: textColorSecondary,
                    padding: 2,
                },
                grid: {
                    display: false,
                },
            },
        },
        elements: {
            line: {
                borderWidth: 6,
            },
            point: {
                radius: 2,
            },
        },
    };
};
</script>

<template>
    <div class="w-auto p-5">
        <Chart type="line" :data="chartData" :options="chartOptions" />
        <div class="mt-2 text-center">
            <span class="font-semibold text-normal">{{ props.title }}</span>
        </div>

    </div>
</template>
