<script lang="ts" setup>
import BPJSIcon from "../icons/BPJSIcon.vue";
import PlusIcon from "../icons/PlusIcon.vue";

const props = defineProps({
  cardPasien: {
    type: Object as () => { keterangan: string },
    default: () => ({ keterangan: "" }),
  },
  showPillIcon: {
    type: Boolean,
    default: false,
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
      <div class="flex my-5">
        <div
          class="rounded-r-xl w-[100px] h-[100px] flex items-center justify-center bg-opensimrs-300"
        >
          <!-- <img
            v-if="cardPasien.keterangan === 'Pasien JKN'"
            src="@/assets/icons/sidebar-icon/BPJS.svg"
            alt=""
            class="w-[60px] h-[60px]"
          /> -->

          <PillFillIcon class="text-white" v-if="showPillIcon" :size="50" />
          <div v-else>
            <BPJSIcon
              class="text-white"
              :size="50"
              v-if="cardPasien.keterangan === 'Pasien JKN'"
            />
            <PlusIcon
              class="text-white"
              :size="50"
              v-if="cardPasien.keterangan === 'Pasien Non-JKN'"
            />
          </div>
        </div>
        <div class="items-center justify-center my-auto ml-5">
          <div class="font-extrabold text-[22px] text-opensimrs-300">
            {{ cardPasien.keterangan }}
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>
