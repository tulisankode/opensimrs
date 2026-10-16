<script setup lang="ts">
import { ref } from "vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { useRujukanLabStore } from "@/stores/Laboratorium/rujukanLab";
import { utilsStore } from "@/stores/utils";

const rujukanLabStore = useRujukanLabStore();
const storeUtils = utilsStore();

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const visible = ref(false);
const observationItemUuid = ref<string | null>(null);
const berkas = ref<File | null>(null);
const errorMessage = ref<string | null>(null);

const emit = defineEmits(["submitted"]);

const buka = (uuid: string) => {
  observationItemUuid.value = uuid;
  berkas.value = null;
  errorMessage.value = null;
  visible.value = true;
};

const onFileChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null;
  errorMessage.value = null;
  if (!file) return;
  if (!ALLOWED_TYPES.includes(file.type)) {
    errorMessage.value = "Format berkas tidak didukung. Gunakan PDF/JPG/PNG.";
    berkas.value = null;
    return;
  }
  if (file.size > MAX_SIZE) {
    errorMessage.value = "Ukuran berkas melebihi batas 5 MB.";
    berkas.value = null;
    return;
  }
  berkas.value = file;
};

const submit = async () => {
  if (!observationItemUuid.value || !berkas.value) {
    errorMessage.value = "Pilih berkas terlebih dahulu";
    return;
  }
  storeUtils.setLoading(true);
  try {
    const formData = new FormData();
    formData.append("berkas", berkas.value);
    const response = await rujukanLabStore.unggahBerkasApi(
      observationItemUuid.value,
      formData
    );
    if (response) {
      visible.value = false;
      emit("submitted");
    }
  } catch (error) {
    console.error("Gagal mengunggah berkas hasil rujukan", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

defineExpose({ buka });
</script>

<template>
  <CustomDialog v-model:visible="visible" :style="{ width: '450px' }">
    <template #header>
      <p>Unggah Berkas Hasil Rujukan</p>
    </template>
    <template #body>
      <div class="mt-[20px]">
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          @change="onFileChange"
        />
        <p class="mt-2 text-xs text-grey-300">
          Format PDF/JPG/PNG, ukuran maksimal 5 MB.
        </p>
        <p v-if="errorMessage" class="mt-1 text-xs text-red-500">
          {{ errorMessage }}
        </p>
      </div>
    </template>
    <template #footer>
      <div class="w-full">
        <div class="mt-5 flex justify-end gap-2.5">
          <CustomButton
            label="Batal"
            textColor="text-grey-300"
            backgroundColor="bg-transparent"
            borderColor="border-2 border-grey-200"
            @click="visible = false"
          />
          <CustomButton label="Unggah" @click="submit" />
        </div>
      </div>
    </template>
  </CustomDialog>
</template>
