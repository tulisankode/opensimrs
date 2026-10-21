<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from "vue-router";
import { utilsStore } from "@/stores/utils";
import Footer from "./components/section/Footer.vue";
import Loading from "./components/section/Loading.vue";
import AsistenPengembang from "./components/section/AsistenPengembang.vue";

const route = useRoute();

const storeUtils = utilsStore();
</script>

<template>
  <body
    :class="[
      'flex flex-col min-h-screen',
      route.path.startsWith('/antrian/apm/aktif')
        ? 'bg-opensimrs-75'
        : 'bg-[#f2f8ff]',
    ]"
  >
    <Toast />
    <component :is="$route.meta.layout || 'div'">
      <RouterView  />
    </component>
    <!-- Conditionally show Footer based on the route path -->
    <Footer v-if="!route.path.startsWith('/antrian/apm/aktif') && !route.path.startsWith('/layar/')" />
    <Loading v-if="storeUtils.isLoading" />
    <AsistenPengembang />
  </body>
</template>

<style scoped></style>
