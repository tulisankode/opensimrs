<script setup lang="ts">
import { Vue3Lottie } from "vue3-lottie";
import LoadingJSON from "@/assets/images/Loading.json";
import { logoFaskes } from "@/utils/tema";
</script>

<template>
  <div class="fixed flex justify-center w-full h-full align-middle z-[99999]">
    <div class="absolute w-full h-full backdrop-blur-md"></div>
    <div class="flex my-auto">
      <!-- Logo faskes (Setting › Logo & Warna) bila ada; selain itu animasi logo aplikasi. -->
      <img
        v-if="logoFaskes()"
        :src="logoFaskes()!"
        alt="Memuat"
        class="relative h-[120px] max-w-[320px] object-contain animate-pulse"
      />
      <Vue3Lottie
        v-else
        class=""
        :animationData="LoadingJSON"
        :height="300"
        :width="300"
      />
    </div>
  </div>
</template>
