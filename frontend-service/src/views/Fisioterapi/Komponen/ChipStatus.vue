<script setup lang="ts">
import { computed } from "vue";
import { STATUS_ORDER, STATUS_JADWAL } from "@/stores/penunjang/fisioterapi";

// Lencana status order / jadwal fisioterapi.
const props = defineProps<{ status?: string | null; jenis?: "order" | "jadwal" }>();
const info = computed(() => (props.jenis === "jadwal" ? STATUS_JADWAL : STATUS_ORDER)[props.status ?? ""] ?? { label: props.status ?? "-", kelas: "bg-grey-75 text-grey-500 border-grey-100" });
</script>

<template>
  <span class="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap" :class="info.kelas">
    {{ info.label }}
  </span>
</template>
