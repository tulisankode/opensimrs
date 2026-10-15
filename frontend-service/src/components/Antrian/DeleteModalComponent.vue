<script lang="ts" setup>
import CustomDialog from "@/components/Base/CustomDialog.vue";
import { computed } from "vue";

interface Props {
  isVisible: boolean;
  entityName: string; // Nama entitas yang akan dihapus (misal: "Dokter", "Poli", "Jadwal", dll)
}

interface Emits {
  (e: "close"): void;
  (e: "confirm"): void;
}

const props = withDefaults(defineProps<Props>(), {
  isVisible: false,
  entityName: "Data",
});

const emit = defineEmits<Emits>();

const closeModal = () => {
  emit("close");
};

const confirmDelete = () => {
  emit("confirm");
  closeModal();
};

// Computed untuk mengontrol visibility dialog
const dialogVisible = computed({
  get: () => props.isVisible,
  set: (value: boolean) => {
    if (!value) {
      closeModal();
    }
  },
});
</script>

<template>
  <CustomDialog
    v-model:visible="dialogVisible"
    width="w-full"
    position="center"
    headerBg="bg-red-500"
    headerHeight="h-[60px]"
    :dismissableMask="true"
    @closeDialog="closeModal"
  >
    <template #header>
      <div class="flex items-center">
        <h3 class="text-lg font-semibold text-white">Hapus Data</h3>
      </div>
    </template>

    <template #body>
      <div class="px-2 py-4">
        <p class="text-center text-gray-700">
          Apakah anda yakin ingin menghapus data
          <strong>{{ entityName }}</strong> ini?
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex gap-3 justify-end">
        <button
          @click="closeModal"
          class="px-4 py-2 text-gray-600 bg-white rounded-md border border-gray-300 transition-colors hover:bg-gray-50"
        >
          Batal
        </button>
        <button
          @click="confirmDelete"
          class="px-4 py-2 text-white bg-red-500 rounded-md transition-colors hover:bg-red-600"
        >
          Hapus
        </button>
      </div>
    </template>
  </CustomDialog>
</template>
