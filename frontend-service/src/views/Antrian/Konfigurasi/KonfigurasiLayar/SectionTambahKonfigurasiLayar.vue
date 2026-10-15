<script lang="ts" setup>
import { ref, computed, onMounted, watch, shallowRef } from "vue";
import { namaFaskesAktif } from "@/utils/Helpers";
const namaFaskes = namaFaskesAktif();
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
// import CustomUpload from "@/components/Base/CustomUpload.vue";
import CustomMultiSelect from "@/components/Base/CustomMultiSelect.vue";
import Layout3x2Panggilan from "./PreviewLayar/Layout3x2Panggilan.vue";
import Layout3x3Panggilan from "./PreviewLayar/Layout3x3Panggilan.vue";
import LayoutList3Panggilan3 from "./PreviewLayar/LayoutList3Panggilan3.vue";
import Layout2List2Panggilan from "./PreviewLayar/Layout2List2Panggilan.vue";
import Layout1List1Panggilan from "./PreviewLayar/Layout1List1Panggilan.vue";
import { utilsStore } from "@/stores/utils";
import { useJadwalDokterStore } from "@/stores/antrian/jadwalDokter";
import { useConfigLayarAntrianStore } from "@/stores/antrian/configLayarAntrian";
import { useToast } from "primevue/usetoast";
import Chips from "primevue/chips";

const toast = useToast();

const marqueeDuration = ref(20); // durasi dalam detik

const props = defineProps({
  isDialogVisible: {
    default: false,
  },
  title: {
    type: String,
  },
  method: {
    type: String,
  },
});

const configLayarStore = useConfigLayarAntrianStore();

const jadwalDokterStore = useJadwalDokterStore();
const useUtilsStore = utilsStore();

const jadwalPoliPayload = ref<any[]>([]);
const jadwalPoliProperties = ref({
  name: "",
});

const fetchGetPoli = async () => {
  useUtilsStore.setLoading(true);
  try {
    const response = await jadwalDokterStore.getApiPoli(
      jadwalPoliProperties.value.name
    );
    console.log("Hasil get response:", response);
    if (response && response.payload) {
      jadwalPoliPayload.value = response.payload;
    }
  } catch (error) {
    console.log("Error:", error);
    jadwalPoliPayload.value = [];
  } finally {
    useUtilsStore.setLoading(false);
  }
};

const selectedPoliData = computed(() => {
  if (!poliUuids.value || poliUuids.value.length === 0) {
    return [];
  }
  return jadwalPoliPayload.value.filter((poli) =>
    poliUuids.value.includes(poli.uuid)
  );
});

const itemsLayar = ref([
  { name: "Layar 3 x 3 Panggilan", code: 1 },
  { name: "Layar 3 x 2 Panggilan", code: 2 },
  { name: "Layar 3 List & 3 Panggilan", code: 3 },
  { name: "Layar 2 List & 2 Panggilan", code: 4 },
  { name: "Layar 1 List, 1 Panggilan, 1 Gambar", code: 5 },
]);

const schema = toTypedSchema(
  yup.object({
    namaLayar: yup.string().required("Nama layar harus diisi"),
    tipeLayar: yup.number().required("Tipe layar harus diisi"),
    judul: yup.string().required("Judul harus diisi"),
    isAdmisi: yup.boolean(),
    isPoli: yup.boolean(),
    isFarmasi: yup.boolean(),
    flashText: yup
      .array()
      .of(yup.string().max(100, "Panjang maksimal 100 karakter"))
      .default([`Selamat Datang di ${namaFaskes}`]),
    media: yup
      .string()
      .matches(
        /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/,
        "URL harus dari YouTube"
      )
      .nullable(),
    aktif: yup.boolean().default(true),
    poliUuids: yup
      .array()
      .of(yup.string())
      .when("isPoli", {
        is: true,
        then: (s) => s.min(1, "Pilih minimal 1 poli"),
        otherwise: (s) => s.default([]),
      }),
  })
);

const { errors, handleSubmit, defineField, resetForm, validate } = useForm({
  validationSchema: schema,
});

const [namaLayar] = defineField("namaLayar");
const [tipeLayar] = defineField("tipeLayar");
const [judul] = defineField("judul");
const [isAdmisi] = defineField("isAdmisi");
const [isPoli] = defineField("isPoli");
const [isFarmasi] = defineField("isFarmasi");
const [flashText] = defineField("flashText");
const [media] = defineField("media");
const [aktif] = defineField("aktif");
const [poliUuids] = defineField("poliUuids");

const maxSelected = computed(() => {
  if (tipeLayar.value === 4) return 2;
  if (tipeLayar.value === 5) return 1;
  return 3;
});

const selectedCount = computed(() => {
  return [isAdmisi.value, isPoli.value, isFarmasi.value].filter(Boolean).length;
});

const enforceMaxSelected = (changed: "admisi" | "poli" | "farmasi") => {
  if (selectedCount.value <= maxSelected.value) return;

  if (changed === "admisi") isAdmisi.value = false;
  if (changed === "poli") isPoli.value = false;
  if (changed === "farmasi") isFarmasi.value = false;

  toast.add({
    severity: "warn",
    summary: `Maksimal ${maxSelected.value} pilihan untuk tipe layar ini`,
    life: 3000,
  });
};

watch(tipeLayar, () => {
  if (selectedCount.value <= maxSelected.value) return;
  if (maxSelected.value < 3) isFarmasi.value = false;
  if (selectedCount.value <= maxSelected.value) return;
  if (maxSelected.value < 2) isPoli.value = false;
});

watch(isAdmisi, (val) => {
  if (val === true) enforceMaxSelected("admisi");
});

watch(isPoli, (val) => {
  if (val === true) enforceMaxSelected("poli");
  if (val !== true) poliUuids.value = [];
});

watch(isFarmasi, (val) => {
  if (val === true) enforceMaxSelected("farmasi");
});

const generateForm = () => schema.cast({});

const form = shallowRef(generateForm());

const emit = defineEmits(["update:isDialogVisible", "close", "refresh"]);

const onSubmit = handleSubmit(async (values: any) => {
  const payload = {
    ...values, // salin semua field yang sudah ada
    isAdmisi: values.isAdmisi ?? false, // atau nilai sesuai kebutuhan
    isFarmasi: values.isFarmasi ?? false, // idem
    poliUuids: values.poliUuids ?? [], // pastikan array
    aktif: values.aktif ?? false, //
    status: values.aktif ?? false,
  };
  console.log(payload);

  try {
    await configLayarStore.createLayarAntrian(payload);
    toast.add({
      severity: "success",
      summary: "Data berhasil disimpan",
      life: 3000,
    });
    emit("refresh");

    closeDialog();
  } catch (error) {
    console.error(error);
  }
});

function updateVisibility(value: any) {
  emit("update:isDialogVisible", value);
}

function closeDialog() {
  emit("close");
}

const layarTitle = computed(() => {
  const selectedLayar = itemsLayar.value.find(
    (item) => item.code === tipeLayar.value // Perbaikan: gunakan tipeLayar bukan namaLayar
  );
  return selectedLayar ? selectedLayar.name : "Layar Antrian";
});

const isLayarSelected = computed(() => !!tipeLayar.value);

const isListAndCallLayout = computed(() => {
  return namaLayar.value === "L-3"; // Layar 3 List & 3 Panggilan
});

const onReset = () => {
  resetForm();
};

onMounted(() => {
  fetchGetPoli();
});

watch(
  () => props.isDialogVisible,
  (newValue) => {
    if (newValue) {
      // Reset form ketika dialog dibuka
      resetForm();

      // Set nilai default untuk field tertentu
      setTimeout(() => {
        aktif.value = true; // Default status aktif
        flashText.value = [`Selamat Datang di ${namaFaskes}`]; // Default flash text
      }, 0);
    }
  },
  { immediate: false }
);

//Untuk dynamic layar antrian
const activeOrder = ref<Array<"poli" | "admisi" | "farmasi">>([]);

const pushIfNotExists = (key: "poli" | "admisi" | "farmasi") => {
  if (!activeOrder.value.includes(key)) activeOrder.value.push(key);
};

const removeIfExists = (key: "poli" | "admisi" | "farmasi") => {
  activeOrder.value = activeOrder.value.filter((k) => k !== key);
};

watch(
  isAdmisi,
  (val) => {
    if (val === true) {
      pushIfNotExists("admisi");
      enforceMaxSelected("admisi");
    } else {
      removeIfExists("admisi");
    }
  },
  { immediate: true }
);

watch(
  isPoli,
  (val) => {
    if (val === true) {
      pushIfNotExists("poli");
      enforceMaxSelected("poli");
    } else {
      removeIfExists("poli");
      poliUuids.value = [];
    }
  },
  { immediate: true }
);

watch(
  isFarmasi,
  (val) => {
    if (val === true) {
      pushIfNotExists("farmasi");
      enforceMaxSelected("farmasi");
    } else {
      removeIfExists("farmasi");
    }
  },
  { immediate: true }
);

const flashTextSchema = yup.string().max(100, "Panjang maksimal 100 karakter");
const flashTextRealtimeError = ref<string | null>(null);
const validateFlashTextDraft = (val: string) => {
  try {
    flashTextSchema.validateSync(val.trim());
    flashTextRealtimeError.value = null;
  } catch (err: any) {
    flashTextRealtimeError.value =
      err?.message ?? "Panjang maksimal 100 karakter";
  }
};

const onFlashTextComplete = (e: any) => validateFlashTextDraft(e?.query ?? "");
const onFlashTextKeyup = (e: any) =>
  validateFlashTextDraft(e?.target?.value ?? "");

const onFlashTextKeydown = (e: KeyboardEvent) => {
  if (e.key === "Enter") {
    const draft = (e.target as HTMLInputElement)?.value ?? "";
    const len = draft.trim().length;
    if (len > 100) {
      e.preventDefault();
      e.stopImmediatePropagation?.();
      e.stopPropagation();
      flashTextRealtimeError.value = "Panjang maksimal 100 karakter";
      return;
    }
    flashTextRealtimeError.value = null;
  }
};

watch(flashText, () => {
  flashTextRealtimeError.value = null;
});
</script>

<template>
  <CustomDialog
    width="1000px"
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    headerBg="bg-opensimrs-300"
  >
    <template #header>{{ title }} Layar Antrian</template>
    <template #body>
      <div class="flex flex-col gap-5 mt-5">
        <div class="flex gap-2.5 w-full">
          <CustomTextfield
            label="Nama Layar"
            placeholder="Nama Layar"
            v-model="namaLayar"
            optionValue="code"
            optionLabel="name"
            class="mr-5 w-1/2 text-black"
            :invalid="!!errors.namaLayar"
            :invalid-message="errors.namaLayar"
          />
          <CustomSelect
            label="Tipe Layar"
            place-holder="Pilih Tipe Layar"
            v-model="tipeLayar"
            :options="itemsLayar"
            optionValue="code"
            optionLabel="name"
            class="w-1/2 text-black"
            :invalid="!!errors.tipeLayar"
            :invalid-message="errors.tipeLayar"
          />
        </div>

        <!-- Conditional rendering based on layarModel -->
        <div class="flex gap-x-4 gap-y-6 min-h-0">
          <div
            class="w-1/2 min-w-[420px] max-w-[520px] flex-shrink-0"
            v-show="isLayarSelected"
          >
            <div class="text-xl font-bold text-black">
              {{ layarTitle }}
            </div>
            <hr class="mt-4" />
            <div class="space-y-5">
              <CustomTextfield
                label="Teks Judul"
                v-model="judul"
                placeholder="Teks Judul"
                optionValue="code"
                optionLabel="name"
                class="mt-4 mr-5 w-full text-black"
                :invalid="!!errors.judul"
                :invalid-message="errors.judul"
              />
              <CustomSwitch
                v-model="isAdmisi"
                label="Admisi"
                sideLabel="Non-Aktif"
                sideLabelTrue="Aktif"
              />
              <div class="flex gap-2.5 items-end mt-4 text-black">
                <CustomSwitch
                  v-model="isPoli"
                  label="Poli"
                  sideLabel="Non-Aktif"
                  sideLabelTrue="Aktif"
                />
              </div>
              <CustomMultiSelect
                label="Pilih Poli"
                placeholder="Pilih Poli"
                v-model="poliUuids"
                :options="jadwalPoliPayload"
                optionValue="uuid"
                optionLabel="name"
                class="mt-4 mr-5 w-full text-black multiselect-wrap"
                v-show="isPoli"
              />
              <CustomSwitch
                v-model="isFarmasi"
                label="Farmasi"
                sideLabel="Non-Aktif"
                sideLabelTrue="Aktif"
              />
              <CustomTextfield
                label="Youtube"
                v-model="media"
                placeholder="URL Youtube"
                class="mt-4 mr-5 w-full text-black"
                v-show="tipeLayar === 5"
                :invalid="!!errors.media"
                :invalid-message="errors.media"
              />
            </div>
            <div>
              <div class="mt-4 block font-semibold mb-[5px] text-normal">
                Flash Text
              </div>
              <AutoComplete
                v-model="flashText"
                class="w-full whitespace-pre-wrap break-all"
                fluid
                multiple
                :typeahead="false"
                :invalid="!!(flashTextRealtimeError || errors.flashText)"
                @complete="onFlashTextComplete"
                @keyup="onFlashTextKeyup"
                @keydown.capture="onFlashTextKeydown"
              />
              <p
                v-if="flashTextRealtimeError || errors.flashText"
                class="mt-1 text-xs text-red-500"
              >
                {{ flashTextRealtimeError || errors.flashText }}
              </p>
            </div>
          </div>
          <div
            class="flex flex-col flex-1 w-full min-w-0"
            v-show="isLayarSelected"
          >
            <div class="text-xl font-bold text-black">Preview Layar</div>
            <hr class="mt-4" />
            <div
              class="mt-4 w-full flex-1 flex flex-col bg-opensimrs-75 overflow-hidden rounded-[10px] px-1 pt-1"
            >
              <!-- Navbar Preview Layar -->
              <div
                class="flex gap-4 items-center font-semibold text-white rounded-lg bg-opensimrs-300 text-subHeading"
              >
                <!-- Logo -->
                <div
                  class="flex bg-white w-[180px] justify-center items-center gap-1 rounded-lg"
                >
                  <img
                    loading="lazy"
                    src="../../../../assets/images/opensimrs-logo.png"
                    class="shrink-0 self-stretch my-auto mx-1 aspect-square w-[50px] h-[50px]"
                  />
                  <div
                    class="bg-opensimrs-300 w-[3px] h-[50px] my-auto rounded-md"
                  ></div>
                  <img
                    loading="lazy"
                    src="../../../../assets/images/opensimrs.png"
                    class="self-stretch object-contain w-[106px] my-auto shrink-0"
                  />
                </div>
                <!-- Komponen di sebelah Logo -->
                <div class="">{{ namaFaskes }}</div>
                <div class="mr-3 ml-auto font-semibold text-right">
                  <div class="text-subHeading">09:00 AM</div>
                  <div class="text-XS">Senin, 01 Jan 2024</div>
                </div>
              </div>
              <!-- Blok Konten -->
              <div class="flex-1 min-h-[500px] px-1" id="wrapper-antrian">
                <template v-if="tipeLayar === 1">
                  <layout-3x3-panggilan
                    :payload="selectedPoliData"
                    :is-poli="isPoli"
                    :is-admisi="isAdmisi"
                    :is-farmasi="isFarmasi"
                    :active-order="activeOrder"
                  />
                </template>
                <template v-else-if="tipeLayar === 2">
                  <layout-3x2-panggilan
                    :payload="jadwalPoliPayload"
                    :is-poli="isPoli"
                    :is-admisi="isAdmisi"
                    :is-farmasi="isFarmasi"
                    :active-order="activeOrder"
                  />
                </template>
                <template v-else-if="tipeLayar === 3">
                  <layout-list-3-panggilan-3
                    :payload="jadwalPoliPayload"
                    :is-poli="isPoli"
                    :is-admisi="isAdmisi"
                    :is-farmasi="isFarmasi"
                    :active-order="activeOrder"
                  />
                </template>
                <template v-else-if="tipeLayar === 4">
                  <layout-2-list-2-panggilan
                    :is-poli="isPoli"
                    :is-admisi="isAdmisi"
                    :is-farmasi="isFarmasi"
                    :active-order="activeOrder"
                  />
                </template>
                <template v-else-if="tipeLayar === 5">
                  <layout-1-list-1-panggilan
                    :media="media"
                    :is-poli="isPoli"
                    :is-admisi="isAdmisi"
                    :is-farmasi="isFarmasi"
                    :active-order="activeOrder"
                  />
                </template>
              </div>
              <div
                class="mt-3 font-semibold text-white rounded-tl-lg rounded-tr-lg bg-opensimrs-300"
              >
                <div class="marquee" aria-label="Running text">
                  <div
                    class="marquee__track"
                    :style="{ '--duration': marqueeDuration + 's' }"
                  >
                    <span
                      v-for="(item, idx) in flashText"
                      :key="`${idx}-${item}`"
                      class="mx-2"
                      >{{ item }}</span
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <hr />
        <CustomSwitch
          class="text-black"
          v-model="aktif"
          label="Status"
          sideLabel="Non-Aktif"
          sideLabelTrue="Aktif"
        />
      </div>
    </template>
    <template #footer>
      <div class="w-full">
        <div class="flex gap-2.5 justify-end mt-5">
          <CustomButton
            label="Reset"
            border-color="border-grey-200"
            background-color="bg-white"
            text-color="text-grey-300"
            @click="onReset"
          >
          </CustomButton>
          <CustomButton label="Simpan" @click="onSubmit"> </CustomButton>
        </div>
      </div>
    </template>
  </CustomDialog>
</template>

<style scoped>
.multiselect-wrap :deep(.p-multiselect-label-container) {
  @apply flex-wrap content-start min-h-10 h-auto px-2 py-1;
}

.multiselect-wrap :deep(.p-multiselect-chip) {
  @apply mb-1 mr-1;
}

.multiselect-wrap :deep(.p-multiselect) {
  @apply h-auto min-h-10;
}

.multiselect-wrap :deep(.p-multiselect .p-multiselect-label) {
  @apply flex flex-wrap items-start py-1 min-h-6 h-auto;
}

.multiselect-wrap :deep(.p-multiselect-token) {
  @apply mb-1 mr-1;
}

.marquee {
  overflow: hidden;
  white-space: nowrap;
  display: block;
  width: 100%;
  position: relative;
}
.marquee__track {
  padding: 6px 0;
  will-change: transform;
  display: inline-block; /* width mengikuti konten */
  width: max-content; /* cegah melar mengikuti kontainer */
  padding-left: 100%; /* mulai dari luar kanan */
  animation: marquee var(--duration, 20s) linear infinite;
}
@keyframes marquee {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-100%);
  }
}
</style>
