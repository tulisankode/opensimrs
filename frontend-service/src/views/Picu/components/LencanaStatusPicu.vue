<script setup lang="ts">
import { computed } from "vue";

// Lencana status PICU (episode, dokumentasi, konfigurasi, tempat tidur) dengan warna sesuai makna status.
const props = defineProps<{ status?: string | null }>();
const WARNA: Record<string, string> = {
  aktif: "bg-success-50 text-success-400",
  berlaku: "bg-success-50 text-success-400",
  final: "bg-success-50 text-success-400",
  tersedia: "bg-success-50 text-success-400",
  draf: "bg-warning-50 text-warning-400",
  terpakai: "bg-opensimrs-50 text-opensimrs-300",
  tidak_operasional: "bg-danger-50 text-danger-400",
};
const kelas = computed(() => WARNA[props.status ?? ""] ?? "bg-grey-50 text-grey-500");
const label = computed(() => (props.status ?? "-").replaceAll("_", " "));
</script>

<template>
  <span class="inline-block px-2 py-0.5 text-xs font-semibold capitalize rounded-full whitespace-nowrap" :class="kelas">{{ label }}</span>
</template>
