<script setup lang="ts">
import { computed, onUpdated, type PropType } from "vue";

const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
  selectedTab: {
    type: String,
    default: "0",
  },
  dataSession: {
    type: Array as PropType<any>,
    default: () => [],
  },
});

const emit = defineEmits(["update:modelValue", "addSession"]);
const value = computed({
  get: () => props.modelValue,
  set: (value: string) => emit("update:modelValue", value),
});
</script>

<template>
  <Tabs
    v-model:value="value"
    :dt="{
      tabActiveBackground: 'rgb(var(--opensimrs-50))',
      tabActiveColor: 'rgb(var(--opensimrs-300))',
      tabActiveBorderColor: 'rgb(var(--opensimrs-300))',
    }"
  >
    <TabList :pt="{ tabList: 'h-10 text-SM' }">
      <Tab
        v-if="selectedTab == 'rekam-medis'"
        class="py-0 px-[10px]"
        value="non-sesi"
        :pt="{ root: 'rounded-t-lg' }"
      >
        Non-Sesi
      </Tab>
      <Tab
        v-if="selectedTab == 'rekam-medis'"
        class="px-0 py-0"
        value="-"
        :pt="{ root: 'rounded-t-lg' }"
        disabled
      >
        <PhLineVertical :size="26" weight="bold" class="text-opensimrs-300" />
      </Tab>
      <Tab
        v-for="(session, index) in dataSession"
        :key="'session' + index"
        class="py-0 px-[10px]"
        :value="`${session.order}`"
        :pt="{ root: 'rounded-t-lg' }"
      >
        Sesi {{ session.order }}
      </Tab>
      <Tab
        v-if="selectedTab != 'rekam-medis'"
        @click="emit('addSession', dataSession.at(-1))"
        class="py-0 px-[10px]"
        value="plus"
        :pt="{ root: 'rounded-t-lg' }"
      >
        <PhPlus :size="20" weight="bold" class="" />
      </Tab>
    </TabList>
  </Tabs>
</template>
