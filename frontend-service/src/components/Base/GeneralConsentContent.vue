<script setup lang="ts">
import { computed } from "vue";
import NoData from "@/components/section/NoData.vue";
import { sanitizeGeneralConsent } from "@/utils/sanitizeGeneralConsent";

const props = defineProps<{ isiSurat?: string | null }>();
const html = computed(() => sanitizeGeneralConsent(props.isiSurat));
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- sudah dibersihkan DOMPurify dengan daftar elemen terbatas (sanitizeGeneralConsent) -->
  <div v-if="html" v-html="html"></div>
  <NoData v-else title="Isi General Consent tidak tersedia." />
</template>
