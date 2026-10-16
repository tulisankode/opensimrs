<script setup lang="ts">
import { computed } from "vue";
import { keHtml } from "../umum";

const props = defineProps<{ isi?: string | null }>();
const html = computed(() => keHtml(props.isi));
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- sudah dibersihkan DOMPurify -->
  <div class="studio-md" v-html="html"></div>
</template>

<style scoped>
.studio-md :deep(h1) { @apply mb-2 mt-3 text-heading font-bold text-grey-500; }
.studio-md :deep(h2) { @apply mb-1.5 mt-4 text-normal font-bold text-opensimrs-300; }
.studio-md :deep(h3) { @apply mb-1 mt-3 text-SM font-bold text-grey-500; }
.studio-md :deep(p) { @apply my-1.5 text-SM leading-relaxed text-grey-500; }
.studio-md :deep(ul) { @apply my-1.5 list-disc pl-5 text-SM text-grey-500; }
.studio-md :deep(ol) { @apply my-1.5 list-decimal pl-5 text-SM text-grey-500; }
.studio-md :deep(li) { @apply my-0.5; }
.studio-md :deep(code) { @apply rounded bg-grey-75 px-1 font-mono text-XS; }
.studio-md :deep(pre) { @apply my-2 overflow-auto rounded-lg bg-grey-50 p-3 text-XS; }
.studio-md :deep(pre code) { @apply bg-transparent p-0; }
.studio-md :deep(table) { @apply my-2 w-full border-collapse text-XS; }
.studio-md :deep(th) { @apply border border-grey-200 bg-grey-75 p-1.5 text-left font-semibold; }
.studio-md :deep(td) { @apply border border-grey-200 p-1.5 align-top; }
.studio-md :deep(blockquote) { @apply my-2 border-l-4 border-opensimrs-200 pl-3 text-grey-400; }
.studio-md :deep(a) { @apply text-opensimrs-300 underline; }
</style>
