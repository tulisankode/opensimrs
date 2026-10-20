<script setup lang="ts">
import { useAngkaHalus, useGerakKurang } from './animasi'

// Angka dengan count-up saat nilainya berubah (langsung bila prefers-reduced-motion).
const props = defineProps<{ nilai: number }>()
const kurang = useGerakKurang()
const tampil = useAngkaHalus(() => ({ n: props.nilai ?? 0 }), kurang)
</script>

<template>
  <span class="tabular-nums">{{ tampil.n ?? nilai }}</span>
</template>
