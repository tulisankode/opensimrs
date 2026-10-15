<script setup lang="ts">
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import dokterPerempuan from "@/assets/icons/Avatar/avatar_dokter_perempuan.svg";
import dokterLaki from "@/assets/icons/Avatar/avatar_dokter_laki.svg";
import { epochToDate } from "@/utils/Helpers";
import { PhCalendarDots, PhClock } from "@phosphor-icons/vue";
import { computed } from "vue";
import CustomChip from "@/components/Base/CustomChip.vue";

const props = defineProps({
  history: {
    type: Object,
    default: () => ({}),
  },
  currentUserUuid: {
    type: String,
    default: "",
  },
});

const imgDokterPerempuan = dokterPerempuan;
const imgDokterLaki = dokterLaki;

const jenisKunjunganLabel = computed(() => {
  switch (props.history?.jenisKunjungan) {
    case 'rj':
      return 'Rawat Jalan';
    case 'ri':
      return 'Rawat Inap';
    case 'igd':
      return 'IGD';
    default:
      return null;
  }
});
const chipBgColor = computed(() => {
      return 'bg-white';
});

const chipTextColor = computed(() => {
      return 'text-grey-400';
});

const petugasInput = computed(() => {
  return props.history?.petugas || 'N/A';
});

const jamInput = computed(() => {
  return props.history?.waktuInput ? String(epochToDate(props.history.waktuInput, 'time')) : 'N/A';
});
</script>

<template>
  <CustomAccordion headerClass="bg-opensimrs-50" initialState="0">
    <template #header>
      <span class="shrink-0 text-sm mr-2 mt-1">
          {{ epochToDate(history.date, 'date') || "Data Riwayat" }}
        </span>
        <div class="flex flex-wrap">
          <CustomChip
                v-if="jenisKunjunganLabel"
                :label="jenisKunjunganLabel"
                :bgColor="chipBgColor"
                :textColor="chipTextColor"
                customClass="h-5 px-2 text-xs font-semibold border-none shrink-0 mt-1"
                :showCheckedIcon="false"
            />
          <CustomChip
              v-if="history.session && jenisKunjunganLabel !== 'Rawat Jalan'"
              :label="`Sesi ${history.session}`"
              bgColor="bg-blue-200"
              textColor="text-blue-800"
              customClass="h-5 px-2 text-xs font-semibold border-none shrink-0 mt-1"
              :showCheckedIcon="false"
            />
        </div>
    </template>
    <template #content>
      <div v-if="history && history.data && history.data.length > 0" class="py-5 flex flex-col gap-[10px]">
        <div
          v-for="(message, index) in history.data"
          :key="message._id || index"
          class="flex items-start gap-2.5"
          :class="{ 'justify-end': message.user_uuid === currentUserUuid }"
        >
          <img
            :src="message.user_uuid === currentUserUuid ? imgDokterPerempuan : imgDokterLaki"
            alt="Avatar"
            :class="message.user_uuid === currentUserUuid ? 'order-2' : ''"
          />
          <div class="flex flex-col gap-2.5">
            <div class="flex items-center w-full gap-5">
              <div class="font-semibold text-opensimrs-300 text-SM">
                {{ message.user_uuid === currentUserUuid ? 'Anda' : message.name }} ({{ message.dokterName }})
              </div>
              <div class="flex gap-2.5 font-medium text-SM text-grey-400">
                <div class="flex items-center gap-[2px]">
                  <PhCalendarDots :size="12" weight="fill" />
                  {{ epochToDate(message.time, "date") }}
                </div>
                <div class="flex items-center gap-[2px]">
                  <PhClock :size="12" weight="fill" />
                  {{ epochToDate(message.time, "time") }}
                </div>
              </div>
            </div>
            <div
              :class="
                message.user_uuid === currentUserUuid
                  ? 'rounded-tl-[10px] rounded-br-[10px] rounded-bl-[10px]'
                  : 'rounded-tr-[10px] rounded-br-[10px] rounded-bl-[10px]'
              "
              class="min-h-[45px] bg-opensimrs-50 flex items-center px-4 text-SM font-normal"
            >
              {{ message.message }}
            </div>
          </div>
        </div>
        <hr class="border-grey-200" />
        <div class="flex justify-between">
          <CustomInfoRow
            label="Petugas Input"
            :value="petugasInput"
            type="vertical"
          />
          <CustomInfoRow
            label="Jam Input"
            :value="jamInput"
            type="vertical"
            alignment="right"
          />
        </div>
      </div>
    </template>
  </CustomAccordion>
</template>
