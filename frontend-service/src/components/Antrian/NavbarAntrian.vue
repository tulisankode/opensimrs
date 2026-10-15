<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import { namaFaskesAktif } from "@/utils/Helpers";
const namaFaskes = namaFaskesAktif();

const timeNow = ref("");
const dateNow = ref("");

let timerId;
function updateDateTime() {
  const now = new Date();

  const time = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  });
  timeNow.value = `${time} WIB`;

  const date = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
  dateNow.value = date;
}

onMounted(() => {
  updateDateTime();
  timerId = window.setInterval(updateDateTime, 1000);
});

onUnmounted(() => {
  if (timerId) {
    clearInterval(timerId);
  }
});
</script>

<template>
  <div
    class="flex gap-5 justify-between w-full text-sm leading-5 text-white whitespace-nowrap max-md:flex-wrap"
  >
    <!-- Logo and Divider -->
    <div
      class="flex gap-1 justify-center items-center px-2.5 bg-white rounded-lg shadow-sm"
    >
      <img
        loading="lazy"
        src="@/assets/images/opensimrs-logo.png"
        class="shrink-0 self-stretch my-auto mx-1 aspect-square w-[70px] h-[70px]"
      />
      <div class="bg-opensimrs-300 w-[2px] h-[50px] my-auto rounded-md"></div>
      <img
        loading="lazy"
        src="@/assets/images/opensimrs.png"
        class="self-stretch object-contain w-[120px] my-auto shrink-0 mx-1"
      />
    </div>

    <!-- Main Title and Subtitle -->
    <div class="flex flex-col mx-1 my-auto">
      <!-- Added mx-4 for spacing -->
      <div class="mb-1 font-bold text-MD">
        Anjungan Pendaftaran Pribadi (APM)
      </div>
      <div class="text-sm">{{ namaFaskes }}</div>
    </div>

    <!-- Clock and Date -->
    <div class="flex flex-col my-auto ml-auto text-right">
      <!-- Align text to the right -->
      <div class="text-lg font-bold">{{ timeNow }}</div>
      <div class="text-sm">{{ dateNow }}</div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
