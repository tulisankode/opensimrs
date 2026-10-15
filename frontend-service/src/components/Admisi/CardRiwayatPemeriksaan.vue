<script setup lang="ts">
import CustomChip from "@/components/Base/CustomChip.vue";

const props = defineProps({
  pemeriksaan: {
    default: Object
  },
});
</script>
<template>
  <Card style="width: full; overflow: hidden;" pt:body:class="px-2.5 bg-opensimrs-50 h-[80px] py-0 flex justify-center min-h-[80px]">
    <template #content>
      <div class="flex items-center justify-between h-full">
        <div>
          <div class="flex items-center gap-2">
            <div class="text-sm font-bold leading-5">{{ pemeriksaan.ruangan }}</div>
            <CustomChip :label="pemeriksaan.asuransi" border-color="border-opensimrs-300" text-color="text-opensimrs-300"
              :showCheckedIcon="false"
              customClass="font-semibold flex h-4 border-2 rounded-full text-[8px] bg-transparent" />
          </div>
          <div class="flex items-center gap-2">
            <img src="../../assets/icons/user-doctor-solid.svg" />
            <div class="text-sm font-normal leading-5 text-grey-400">
              {{ pemeriksaan.dokter }}
            </div>
          </div>
          <div class="flex gap-2 text-sm font-normal leading-5">
            <div>Tanggal</div>
            <div class="flex items-center justify-center">
              <img src="../../assets/icons/Vector-arows.svg" />
            </div>
            <div>{{ pemeriksaan.tanggal }}</div>
            <div>{{ pemeriksaan.jam }}</div>
          </div>
        </div>
        <div class="flex items-center justify-center">
          <CustomChip :label="pemeriksaan.statusLunas" text-color="text-[#14ac5b]" borderColor="border-transparent"
            :showCheckedIcon="false"
            customClass="font-normal h-4 border-2 rounded-full text-sm leading-5 bg-success-50" />
        </div>
      </div>
    </template>
  </Card>
</template>
