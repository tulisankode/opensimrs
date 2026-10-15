<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const props = defineProps({
    modelValue: {
        type: String,
        default: "#14B8A6"
    },
    icon: {
        type: String,
        default: "",
    },
    showIcon: {
        type: Boolean,
        default: false,
    },
     mode: {
        type: String,
        default: "picker", // "picker" untuk mode color picker, "view" untuk mode view
    },
});

const emit = defineEmits(['update:modelValue']);

const selectedColor = computed({
    get: () => props.modelValue,
    set: (newValue: string) => {
        emit('update:modelValue', newValue);
    },
});


watch(() => props.modelValue, (newValue) => {
    selectedColor.value = newValue;
});

function handleColorChange(event: Event) {
    const target = event.target as HTMLInputElement;
    selectedColor.value = target.value;
}
</script>

<template>
   <div class="flex items-center">
        <!-- Menampilkan input color jika mode adalah "picker" -->
        <input v-if="props.mode === 'picker'" type="color" v-model="selectedColor" @input="handleColorChange"
            class="w-24 h-16 bg-transparent border-none cursor-pointer" />

        <!-- Menampilkan warna yang dipilih jika mode adalah "view" -->
        <div v-else :style="{ backgroundColor: selectedColor, width: '96px', height: '64px', borderRadius: '4px' }">
        </div>
    </div>
</template>

<style>

</style>
