<script setup lang="ts">
import CustomChip from "@/components/Base/CustomChip.vue";
import ProgressBar from "primevue/progressbar";

const props = defineProps({
    headerGrafik: {
        type: String,
        default: "",
    },
    progressColor: {
        type: String,
        default: "#000000", // default color
    },
    statusPemeriksaan: {
        type: String,
        default: ""
    },
    jumlahPasien: {
        type: String,
        default: ""
    },
    persenPasien: {
        type: String,
        default:""
    },
    value: {
        type: Number,
        default:10
    }
});
</script>

<template>
    <div class="w-auto p-5">
        <div class="flex flex-col gap-5 px-3">
            <div class="flex items-center justify-between">
                <div class="font-semibold text-normal">{{ props.statusPemeriksaan }}</div>
                <div :style="{ color: props.progressColor }" class="font-bold text-normal">{{ props.jumlahPasien }}</div>
            </div>
            <ProgressBar :value="props.value"
                :style="{ height: '30px', backgroundColor: '#F9FAFB', '--p-progressbar-value-bg': props.progressColor }"
                :class="['relative', 'rounded-full']">
                <span
                    class="absolute px-2 py-1 text-xs font-bold text-black bg-white rounded-full shadow-md top-1 right-1">{{ props.persenPasien }}%</span>
            </ProgressBar>
        </div>
    </div>
</template>

<style>
.p-progressbar-value {
    @apply rounded-2xl;
    background-color: var(--p-progressbar-value-bg); /* Gunakan variable CSS untuk warna */
}   
</style>
