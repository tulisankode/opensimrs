<script lang="ts" setup>
import UserDoctorIcon from "../icons/UserDoctorIcon.vue";

const props = defineProps({
  cardJam: {
    type: Object as () => { jam: string },
    default: () => ({ jam: "" }),
  },
});
</script>

<template>
  <Card
    style="width: full; overflow: hidden; height: full"
    pt:body:class="p-0 bg-white"
    pt:root:class="h-full"
  >
    <template #header> </template>
    <template #content>
      <div class="flex align-center h-[65px] w-[181px]">
        <div class="flex items-center justify-center my-auto ml-5">
          <div class="font-bold text-[14px] text-center text-opensimrs-300">
            {{ cardJam.jam }}
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>
