<script lang="ts" setup>
const props = defineProps({
  titleCard: {
    type: String,
    default: "",
  },
  totalTest: {
    type: Number,
    default: 0,
  },
  satuanCard: {
    type: String,
    default: "",
  },
  backgroundIcon: {
    type: String,
    default: "",
  },
  bottomIcon: {
    type: String,
    default: "",
  },
  activeBackground: {
    type: Boolean,
    default: true,
  },
});
</script>

<template>
  <div
    :class="[
      'relative flex items-center text-white rounded-lg shadow-md bg-opensimrs-300',
      activeBackground ? 'p-3' : 'p-0'
    ]"
  >
    <!-- Ikon di kiri -->
    <div
      v-if="activeBackground "
      class="flex items-center justify-center w-20 h-20 bg-white rounded-full text-opensimrs-300"
    >
      <component :is="backgroundIcon" class=" text-opensimrs-300" :size="40"/>
    </div>

    <!-- Konten teks -->
    <div class="px-5 ">
      <div class="font-normal text-subHeading">{{ titleCard }}</div>
      <div class="flex items-center gap-2.5">
          <div class="font-semibold text-start text-[28px]">{{ satuanCard }}</div>
        <div class="font-semibold text-subTitle">{{ totalTest }}</div>
      </div>
    </div>

    <!-- Gambar di pojok kanan bawah -->
    <component
      :is="bottomIcon"
      class="absolute right-0 top-6 opacity-30"
      :size="120"
    />
  </div>
</template>

<style scoped>
/* Jika ingin menambahkan gaya khusus */
</style>
