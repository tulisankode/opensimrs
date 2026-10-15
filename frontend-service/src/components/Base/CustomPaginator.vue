<!-- <script setup lang="ts">
import Paginator from "primevue/paginator";
import type { PropType } from "vue";

const props = defineProps({
  rows: {
    type: Number,
    default: 0,
  },
  totalRecords: {
    default: 0,
  },
  rowsPerPageOptions: {
    type: Array as PropType<any[]>,
    default: () => [10, 20, 30],
  },
  noPagination: {
    default: false,
  },
});

const emits = defineEmits([
  "page"
]);
</script>

<template>
  <div class="flex gap-2.5 items-center">
    <div>Total Data: {{ props.totalRecords }}</div>
    <Paginator
      v-if="!noPagination"
      :rows="props.rows"
      :totalRecords="props.totalRecords"
      :rowsPerPageOptions="props.rowsPerPageOptions"
      :pageLinkSize="1"
      :pt="{
        content: {
          class: 'flex gap-0 p-0 m-0 h-[30px] items-center justify-center',
        },
        first: { class: 'rounded h-full' },
        prev: { class: 'rounded h-full' },
        pages: { class: 'rounded h-full' },
        page: {
          class:
            'rounded h-full bg-opensimrs-300 text-white w-10 h-10 flex items-center justify-center',
        },
        next: { class: 'rounded h-full' },
        last: { class: 'rounded h-full' },
        pcRowPerPageDropdown: {
          root: 'border-b-2 rounded border-white border-b-grey-200 ml-5 h-full items-center justify-center',
        },
      }"
      @page="$emit('page', $event)"
    >
      <template #rowsperpagedropdownicon>
        <PhCaretDown :size="20" weight="fill" class="text-grey-200" />
      </template>
    </Paginator>
  </div>
</template> -->

<script setup lang="ts">
import Paginator from "primevue/paginator";
import type { PropType } from "vue";

const props = defineProps({
  rows: {
    type: Number,
    default: 10, // ✅ jangan 0, minimal 10 supaya paginator jalan
  },
  totalRecords: {
    type: Number, // ✅ kasih type biar konsisten
    default: 0,
  },
  rowsPerPageOptions: {
    type: Array as PropType<any[]>,
    default: () => [10, 20, 30],
  },
  noPagination: {
    default: false,
  },
});

const emits = defineEmits(["page"]);
</script>

<template>
  <div class="flex gap-2.5 items-center">
    <div>Total Data: {{ props.totalRecords }}</div>
    <Paginator
      v-if="!noPagination"
      :rows="props.rows"
      :totalRecords="props.totalRecords"
      :rowsPerPageOptions="props.rowsPerPageOptions"
      :pageLinkSize="1"
      :pt="{
        content: {
          class: 'flex gap-0 p-0 m-0 h-[30px] items-center justify-center',
        },
        first: { class: 'rounded h-full' },
        prev: { class: 'rounded h-full' },
        pages: { class: 'rounded h-full' },
        page: {
          class:
            'rounded h-full bg-opensimrs-300 text-white w-10 h-10 flex items-center justify-center',
        },
        next: { class: 'rounded h-full' },
        last: { class: 'rounded h-full' },
        pcRowPerPageDropdown: {
          root: 'border-b-2 rounded border-white border-b-grey-200 ml-5 h-full items-center justify-center',
        },
      }"
      @page="$emit('page', $event)"
    >
      <template #rowsperpagedropdownicon>
        <PhCaretDown :size="20" weight="fill" class="text-grey-200" />
      </template>
    </Paginator>
  </div>
</template>
