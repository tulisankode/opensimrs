<script lang="ts" setup>
import UserDoctorIcon from "../icons/UserDoctorIcon.vue";

const props = defineProps({
  cardDokter: {
    type: Object as () => { namaDokter: string },
    default: () => ({ namaDokter: "" }),
  },
  active: {
    type: Boolean,
    default: false,
  },
});
</script>

<template>
  <Card
    style="width: full; overflow: hidden; height: full"
    :pt="{
      body: { class: ['p-0', active ? 'bg-opensimrs-100' : 'bg-white'] },
      root: { class: 'h-full' },
    }"
  >
    <template #header> </template>
    <template #content>
      <div class="flex my-auto h-full align-center focus:bg-opensimrs-100">
        <div
          class="my-[12.5px] rounded-r-xl w-[40px] h-[40px] flex items-center justify-center bg-opensimrs-300"
        >
          <UserDoctorIcon class="mt-2 ml-2 text-center text-white" :size="34" />
        </div>
        <div
          class="flex relative justify-between items-center my-auto ml-5 w-full"
        >
          <div
            :class="{
              'text-[14px] text-white font-extrabold': active,
              'text-[14px] text-opensimrs-300 font-extrabold': !active,
            }"
          >
            {{ cardDokter.namaDokter }}
          </div>
          <CheckCircleIcon
            :class="active ? 'text-white' : 'text-transparent'"
            class="absolute right-4"
            :size="24"
          />
        </div>
      </div>
    </template>
  </Card>
</template>
