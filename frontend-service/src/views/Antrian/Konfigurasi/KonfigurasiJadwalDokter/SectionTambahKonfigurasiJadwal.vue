<script lang="ts" setup>
import { ref, watch, onMounted, computed, type PropType } from "vue";
import { useForm, useFieldArray } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import { useJadwalDokterStore } from "@/stores/antrian/jadwalDokter";
import { utilsStore } from "@/stores/utils";
import { useToast } from "primevue/usetoast";
import DeleteModalComponent from "@/components/Antrian/DeleteModalComponent.vue";
import { formatTime } from "@/utils/Helpers";

const toast = useToast();

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
  excludedDokterUuids: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
  excludedDoctorUuidsByPoli: {
    type: Object as PropType<Record<string, string[]>>,
    default: () => ({}),
  },
});

const jadwalDokterStore = useJadwalDokterStore();
const utils = utilsStore();

const jadwalPoliPayload = ref<any[]>([]);
const jadwalPoliProperties = ref({
  name: "",
});

const jadwalDokterPayload = ref<any[]>([]);
const jadwalDokterProperties = ref({
  poliUuid: "",
  name: "",
});

watch(
  jadwalDokterPayload,
  (dokterPayload) => {
    console.log("Data dokter payload: ", dokterPayload);
  },
  { deep: true }
);

// Computed property untuk mendapatkan kode antrian dokter yang dipilih
const selectedDokterCode = computed(() => {
  if (!dokterUuid.value) return "";
  const selectedDokter = jadwalDokterPayload.value.find(
    (dokter) => dokter.uuid === dokterUuid.value
  );
  return selectedDokter?.codeAntrianDokter || "";
});

const fetchGetPoli = async () => {
  utils.setLoading(true);
  try {
    const response = await jadwalDokterStore.getApiPoli(
      jadwalPoliProperties.value.name
    );
    console.log("Hasil dari response:", response);
    if (response && response.payload) {
      jadwalPoliPayload.value = response.payload;
    }
  } catch (error) {
    console.log("Error:", error);
    jadwalPoliPayload.value = [];
  } finally {
    utils.setLoading(false);
  }
};

const fetchGetDokter = async (poliUuid: string) => {
  if (!poliUuid) {
    jadwalDokterPayload.value = [];
    return;
  }

  utils.setLoading(true);
  try {
    const response = await jadwalDokterStore.getApiListDokter(
      poliUuid,
      jadwalDokterProperties.value.name
    );
    if (response && response.payload) {
      // ambil daftar excluded khusus poli yang dipilih (fallback ke excludedDokterUuids bila mapping kosong)
      const excludedSet = new Set(
        (props.excludedDoctorUuidsByPoli?.[poliUuid] as string[] | undefined) ??
          props.excludedDokterUuids ??
          []
      );
      jadwalDokterPayload.value = response.payload.filter(
        (dokter: any) => !excludedSet.has(dokter.uuid)
      );
    }
  } catch (error) {
    console.log("Error:", error);
    jadwalDokterPayload.value = [];
  } finally {
    utils.setLoading(false);
  }
};

const defaultData = [
  {
    day: undefined,
    startTime: new Date(),
    endTime: new Date(),
    kuotaJkn: 0,
    kuotaNonJkn: 0,
    durasiPelayanan: "0",
    aktif: true,
  },
];

defaultData.forEach((item) => item.startTime.setHours(0, 0, 0, 0));
defaultData.forEach((item) => item.endTime.setHours(0, 0, 0, 0));

// Initialize data with default values
const data = ref([...defaultData]);

const startDateFilter = ref<Date>(new Date());
startDateFilter.value.setHours(0, 0, 0, 0);
const endDateFilter = ref<Date>(new Date());
endDateFilter.value.setHours(0, 0, 0, 0);

const addRow = () => {
  push({
    day: undefined,
    startTime: new Date(startDateFilter.value),
    endTime: new Date(endDateFilter.value),
    kuotaJkn: 0,
    kuotaNonJkn: 0,
    durasiPelayanan: "0",
    aktif: true,
  });
};

const deleteModal = ref({
  isVisible: false,
  entityName: "",
  rowIndex: -1,
});

const showDeleteConfirmation = (index: number) => {
  deleteModal.value = {
    isVisible: true,
    entityName: "",
    rowIndex: index,
  };
};

const handleDeleteConfirm = () => {
  if (deleteModal.value.rowIndex >= 0) {
    removeRow(deleteModal.value.rowIndex);
  }
  deleteModal.value.isVisible = false;
};

const handleDeleteClose = () => {
  deleteModal.value.isVisible = false;
};

const itemsHari = ref([
  { name: "Senin", code: "1" },
  { name: "Selasa", code: "2" },
  { name: "Rabu", code: "3" },
  { name: "Kamis", code: "4" },
  { name: "Jumat", code: "5" },
]);

/**
 * Converts time format "HH:mm" or Date object to total minutes from midnight
 * @param {string|Date} time - Example: "09:30" or Date object
 * @returns {number} - Example: 570
 */
const toMinutes = (time: any): number => {
  if (!time) return 0;

  // Handle Date object input
  if (time instanceof Date) {
    return time.getHours() * 60 + time.getMinutes();
  }

  // Handle "HH:mm" string format
  if (typeof time === "string" && /^\d{2}:\d{2}$/.test(time)) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }

  // Handle string that can be converted to Date
  if (typeof time === "string") {
    const dateObj = new Date(time);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.getHours() * 60 + dateObj.getMinutes();
    }
  }

  return 0;
};

// Function untuk menghitung durasi pelayanan otomatis
const calculateDurasiPelayanan = (
  startTime: any,
  endTime: any,
  kuotaJkn: any,
  kuotaNonJkn: any
) => {
  const totalKuota = (Number(kuotaJkn) || 0) + (Number(kuotaNonJkn) || 0);

  if (totalKuota > 0 && startTime && endTime) {
    const totalMenit = toMinutes(endTime) - toMinutes(startTime);
    return Math.floor(totalMenit / totalKuota).toString();
  }

  return "0";
};

// Schema validasi yang diperbaiki
const schema = toTypedSchema(
  yup.object({
    poliUuid: yup.string().required("Poliklinik harus dipilih"),
    dokterUuid: yup.string().required("Dokter harus dipilih"),
    jadwalData: yup
      .array()
      .of(
        yup.object({
          day: yup.number().required("Hari harus dipilih"),
          startTime: yup.date().required("Jam mulai harus diisi"),
          endTime: yup
            .date()
            .required("Jam selesai harus diisi")
            .test(
              "is-greater",
              "Jam selesai harus lebih besar dari jam mulai",
              function (value) {
                const { startTime } = this.parent;
                if (!startTime || !value) return true;
                return toMinutes(value) > toMinutes(startTime);
              }
            ),
          durasiPelayanan: yup.string().required(" harus diisi"),
          kuotaJkn: yup
            .number()
            .required("Kuota JKN harus diisi")
            .min(1, "Kuota tidak boleh nol"),
          kuotaNonJkn: yup
            .number()
            .required("Kuota Non-JKN harus diisi")
            .min(1, "Kuota tidak boleh nol"),
          aktif: yup.boolean().required("Status harus dipilih"),
        })
      )
      .min(1, "Minimal harus ada 1 jadwal"),
  })
);

const { errors, handleSubmit, defineField, resetForm, setValues } = useForm({
  validationSchema: schema,
});

const [poliUuid] = defineField("poliUuid");
const [dokterUuid] = defineField("dokterUuid");

// Computed property untuk menentukan apakah dropdown dokter disabled
const isDokterDisabled = computed(() => {
  return !poliUuid.value || poliUuid.value === "";
});

const isCodeDoctorDisabled = computed(() => {
  return !dokterUuid.value || dokterUuid.value === "";
});

// Computed property untuk mendapatkan kode antrian poli yang dipilih
const selectedPoliCode = computed(() => {
  if (!poliUuid.value) return "";
  const selectedPoli = jadwalPoliPayload.value.find(
    (poli) => poli.uuid === poliUuid.value
  );
  return selectedPoli?.codeAntrianPoli || "";
});

// Watch untuk poliModel - ketika poli berubah, fetch dokter dan reset dokter selection
watch(
  () => poliUuid.value,
  (newPoliValue) => {
    dokterUuid.value = undefined;
    jadwalDokterPayload.value = [];

    if (newPoliValue) {
      // Langsung gunakan newPoliValue sebagai UUID
      fetchGetDokter(newPoliValue);
    }
  }
);

// Field array untuk mengelola data jadwal
const { remove, push, replace, fields } = useFieldArray("jadwalData");

// Function untuk mengecek duplikasi jam praktek
const checkDuplicateSchedule = (schedules: any[]) => {
  const duplicates: string[] = [];
  for (let i = 0; i < schedules.length; i++) {
    for (let j = i + 1; j < schedules.length; j++) {
      const s1 = schedules[i];
      const s2 = schedules[j];
      if (Number(s1.day) === Number(s2.day)) {
        const start1 = toMinutes(s1.startTime);
        const end1 = toMinutes(s1.endTime);
        const start2 = toMinutes(s2.startTime);
        const end2 = toMinutes(s2.endTime);
        const hasOverlap =
          (start1 >= start2 && start1 < end2) ||
          (end1 > start2 && end1 <= end2) ||
          (start1 <= start2 && end1 >= end2);
        if (hasOverlap) {
          const dayName =
            itemsHari.value.find((h) => Number(h.code) === Number(s1.day))
              ?.name || "Hari tidak diketahui";
          const timeRange1 = `${formatTime(s1.startTime)}-${formatTime(
            s1.endTime
          )}`;
          const timeRange2 = `${formatTime(s2.startTime)}-${formatTime(
            s2.endTime
          )}`;
          duplicates.push(`${dayName}: ${timeRange1} dengan ${timeRange2}`);
        }
      }
    }
  }
  return duplicates;
};

// Helper untuk validasi field wajib pada item jadwal
const isMissing = (val: any) => !val;
const isMissingOrZeroString = (val: any) =>
  val === undefined || val === null || val === "" || Number(val) === 0;

const hasEmptyRequiredFields = (items: Array<any>) =>
  items.some((item) => {
    return (
      isMissing(item.day) ||
      isMissing(item.startTime) ||
      isMissing(item.endTime) ||
      isMissing(item.durasiPelayanan) ||
      isMissingOrZeroString(item.kuotaJkn) ||
      isMissingOrZeroString(item.kuotaNonJkn)
    );
  });

const onSubmit = handleSubmit(async (values: any) => {
  const schedules = (fields as any).value.map((f: any) => f.value);
  if (hasEmptyRequiredFields(schedules)) {
    toast.add({
      severity: "error",
      summary: "Validasi Error",
      detail: "Semua field jadwal harus diisi dengan benar",
      life: 3000,
    });
    return;
  }

  // Validasi duplikasi jam praktek
  const duplicates = checkDuplicateSchedule(schedules);
  if (duplicates.length > 0) {
    toast.add({
      severity: "error",
      summary: "Validasi Error",
      detail: `Terdapat duplikasi jam praktek: ${duplicates.join(", ")}`,
      life: 5000,
    });
    return;
  }

  // Validasi durasi per pasien minimal 1 menit (hitung dinamis)
  const invalidDurasiIndexes = schedules
    .map((item, idx) => ({
      idx,
      val: Number(
        calculateDurasiPelayanan(
          item.startTime,
          item.endTime,
          item.kuotaJkn,
          item.kuotaNonJkn
        )
      ),
    }))
    .filter((x) => !x.val || x.val < 1)
    .map((x) => x.idx + 1);

  if (invalidDurasiIndexes.length > 0) {
    toast.add({
      severity: "error",
      summary: "Validasi Durasi",
      detail: "Durasi per pasien minimal 1 menit",
      life: 5000,
    });
    return;
  }

  // membangun payload
  const payload = {
    dokter_uuid: dokterUuid.value,
    poliklinik_uuid: poliUuid.value,
    jadwal: schedules.map((item: any) => ({
      day: Number(item.day), //  number
      start_time: formatTime(item.startTime),
      end_time: formatTime(item.endTime),
      kuota_jkn: Number(item.kuotaJkn),
      kuota_non_jkn: Number(item.kuotaNonJkn),
      aktif: item.aktif ?? true,
    })),
  };

  try {
    utils.setLoading(true);
    await jadwalDokterStore.addJadwalDoctor(payload);
    toast.add({
      severity: "success",
      summary: "Sukses",
      detail: "Jadwal dokter berhasil disimpan",
      life: 3000,
    });
    emit("refresh");
    closeDialog();
  } catch (error) {
    toast.add({
      severity: "error",
      summary: "Gagal",
      detail: "Gagal menyimpan jadwal dokter",
      life: 3000,
    });
  } finally {
    utils.setLoading(false);
  }
});

const emit = defineEmits(["update:isDialogVisible", "close", "refresh"]);

function updateVisibility(value: any) {
  emit("update:isDialogVisible", value);
}

function closeDialog() {
  emit("close");
}

// to trigger handleReset at the start
onMounted(() => {
  handleReset();
  fetchGetPoli();
  // Set initial data untuk field array
  replace(defaultData);
});

watch(
  () => props.isDialogVisible,
  (newValue) => {
    if (!newValue) {
      handleReset();
    }
  }
);

// Watcher untuk auto-calculate durasi pelayanan
watch(
  () => data.value,
  (newData) => {
    newData.forEach((item) => {
      if (
        item.startTime &&
        item.endTime &&
        (item.kuotaJkn || item.kuotaNonJkn)
      ) {
        const calculatedDurasi = calculateDurasiPelayanan(
          item.startTime,
          item.endTime,
          item.kuotaJkn,
          item.kuotaNonJkn
        );

        // Update durasi hanya jika berbeda untuk menghindari infinite loop
        if (item.durasiPelayanan !== calculatedDurasi) {
          item.durasiPelayanan = calculatedDurasi;
        }
      }
    });
  },
  { deep: true }
);

function handleReset() {
  resetForm();
  poliUuid.value = undefined;
  dokterUuid.value = undefined;
  jadwalDokterPayload.value = [];
  replace([
    {
      day: undefined,
      startTime: new Date(new Date().setHours(0, 0, 0, 0)),
      endTime: new Date(new Date().setHours(0, 0, 0, 0)),
      kuotaJkn: 0,
      kuotaNonJkn: 0,
      durasiPelayanan: "0",
      aktif: true,
    },
  ]);
}

// Function untuk menghapus row
const removeRow = (index: number) => {
  remove(index); // hapus di field array vee-validate
  data.value.splice(index, 1); // hapus di sumber DataTable
};

const selectedPatient = ref([]);
</script>

<template>
  <CustomDialog
    :fullScreen="true"
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    headerBg="bg-opensimrs-300"
    class="relative"
  >
    <template #header>{{ title }} Jadwal</template>
    <template #body>
      <div class="flex flex-col gap-3 mt-5 max-h-svh">
        <div class="flex gap-2.5 w-full">
          <CustomSelect
            label="Poliklinik"
            place-holder="Pilih Poliklinik"
            v-model="poliUuid"
            :options="jadwalPoliPayload"
            optionValue="uuid"
            optionLabel="name"
            class="mr-5 w-3/4 text-black"
            :invalid="!!errors.poliUuid"
            :invalidMessage="errors.poliUuid"
          />
          <CustomTextfield
            label="Kode Antrian Poli"
            v-model="selectedPoliCode"
            placeholder="Kode Antrian Poli"
            class="w-1/4"
            :disabled="isDokterDisabled"
            :readOnly="true"
          />
        </div>
        <div class="flex gap-2.5 w-full">
          <CustomSelect
            label="Nama Dokter"
            place-holder="Cari & Pilih Nama Dokter"
            prependIcon="PhMagnifyingGlass"
            v-model="dokterUuid"
            :options="jadwalDokterPayload"
            optionValue="uuid"
            optionLabel="pegawai.name"
            class="mr-5 w-3/4 text-black"
            :disabled="isDokterDisabled"
            :invalid="!!errors.dokterUuid"
            :invalidMessage="errors.dokterUuid"
          />
          <CustomTextfield
            label="Kode Antrian Dokter"
            v-model="selectedDokterCode"
            placeholder="Kode Antrian Dokter"
            class="w-1/4"
            :disabled="isCodeDoctorDisabled"
            :readOnly="true"
          />
        </div>
        <hr />
        <div class="overflow-y-auto relative">
          <DataTable
            v-model:selection="selectedPatient"
            :value="fields"
            tableStyle="min-width: 50rem"
            class="text-black"
            stripedRows
            scrollable
            scrollHeight="500px"
            :pt="{ headerRow: 'text-SM' }"
          >
            <Column field="No." headerClass="bg-opensimrs-50">
              <template #header>
                <div class="w-full font-semibold text-center">No.</div>
              </template>
              <template #body="slotProps">
                <div class="text-center">
                  <div class="text-sm">{{ slotProps.index + 1 }}</div>
                </div>
              </template>
            </Column>
            <Column field="hari" header="Hari" headerClass="bg-opensimrs-50">
              <template #body="slotProps">
                <CustomSelect
                  place-holder="Pilih Hari"
                  v-model="slotProps.data.value.day"
                  :options="itemsHari"
                  optionValue="code"
                  optionLabel="name"
                  class="text-sm text-black"
                  label=""
                  :invalid="!!(errors as any)[`jadwalData[${slotProps.index}].day`]"
                  :invalidMessage="(errors as any)[`jadwalData[${slotProps.index}].day`]"
                />
              </template>
            </Column>
            <Column
              field="jam praktek"
              header="Jam Praktek"
              headerClass="bg-opensimrs-50"
              class="max-w-60"
            >
              <template #body="slotProps">
                <div class="flex items-center space-x-2">
                  <CustomDatePicker
                    place-holder="00:00"
                    timeOnly
                    v-model="slotProps.data.value.startTime"
                    label=""
                    class="w-[120px] text-xs text-grey-400"
                    :invalid="!!(errors as any)[`jadwalData[${slotProps.index}].startTime`]"
                    :invalidMessage="(errors as any)[`jadwalData[${slotProps.index}].startTime`]"
                  />
                  <PhMinus class="mx-[5px] text-black" />
                  <CustomDatePicker
                    place-holder="00:00"
                    timeOnly
                    v-model="slotProps.data.value.endTime"
                    label=""
                    class="w-[120px] text-grey-400 text-sm"
                    :invalid="!!(errors as any)[`jadwalData[${slotProps.index}].endTime`]"
                    :invalidMessage="(errors as any)[`jadwalData[${slotProps.index}].endTime`]"
                  />
                </div>
              </template>
            </Column>

            <Column field="slot jkn" headerClass="bg-opensimrs-50">
              <template #header>
                <div
                  class="flex justify-center items-center w-full h-full font-bold"
                >
                  Slot JKN
                </div>
              </template>
              <template #body="slotProps">
                <div class="flex justify-center items-center">
                  <CustomInputNumber
                    class="w-[120px] h-[40px]"
                    placeholder="0"
                    v-model:modelValue="slotProps.data.value.kuotaJkn"
                    type="number"
                    :showLabel="false"
                    :invalid="!!(errors as any)[`jadwalData[${slotProps.index}].kuotaJkn`]"
                    :invalidMessage="(errors as any)[`jadwalData[${slotProps.index}].kuotaJkn`]"
                  >
                    <template #appendText>
                      <div class="flex items-center mr-2">Slot</div>
                    </template>
                  </CustomInputNumber>
                </div>
              </template>
            </Column>
            <Column field="slot non-jkn" headerClass="bg-opensimrs-50">
              <template #header>
                <div
                  class="flex justify-center items-center w-full h-full font-bold"
                >
                  Slot Non-JKN
                </div>
              </template>
              <template #body="slotProps">
                <div class="flex justify-center items-center">
                  <CustomInputNumber
                    class="w-[120px] h-[40px]"
                    placeholder="0"
                    v-model:modelValue="slotProps.data.value.kuotaNonJkn"
                    type="number"
                    :showLabel="false"
                    :invalid="!!(errors as any)[`jadwalData[${slotProps.index}].kuotaNonJkn`]"
                    :invalidMessage="(errors as any)[`jadwalData[${slotProps.index}].kuotaNonJkn`]"
                  >
                    <template #appendText>
                      <div class="flex items-center mr-2">Slot</div>
                    </template>
                  </CustomInputNumber>
                </div>
              </template>
            </Column>
            <Column
              field="total_kuota"
              headerClass="bg-opensimrs-50 whitespace-nowrap"
            >
              <template #header>
                <div
                  class="flex justify-center items-center w-full h-full font-bold"
                >
                  Total Kuota
                </div>
              </template>
              <template #body="slotProps">
                <div
                  class="flex justify-center items-center whitespace-nowrap text-SM"
                >
                  {{
                    (Number(slotProps.data.value.kuotaJkn) || 0) +
                    (Number(slotProps.data.value.kuotaNonJkn) || 0)
                  }}
                  Pasien
                </div>
              </template>
            </Column>
            <Column
              field="durasi per-pasien"
              headerClass="bg-opensimrs-50 whitespace-nowrap"
            >
              <template #header>
                <div
                  class="flex justify-center items-center w-full h-full font-bold"
                >
                  Durasi Per-pasien
                </div>
              </template>
              <template #body="slotProps">
                <div
                  class="flex justify-center items-center whitespace-nowrap text-SM"
                >
                  {{
                    calculateDurasiPelayanan(
                      slotProps.data.value.startTime,
                      slotProps.data.value.endTime,
                      slotProps.data.value.kuotaJkn,
                      slotProps.data.value.kuotaNonJkn
                    )
                  }}
                  menit
                </div>
              </template>
            </Column>
            <Column field="" headerClass="bg-opensimrs-50 whitespace-nowrap">
              <template #header>
                <div
                  class="flex justify-center items-center w-full h-full font-bold"
                >
                  Status
                </div>
              </template>
              <template #body="slotProps">
                <div class="flex justify-center items-center w-full">
                  <CustomSwitch
                    v-model="slotProps.data.value.aktif"
                    :showLabel="false"
                    sideLabelTrue="Aktif"
                    sideLabel="Non - Aktif"
                  />
                </div>
              </template>
            </Column>
            <Column
              field="action"
              headerClass="bg-opensimrs-50 whitespace-nowrap"
            >
              <template #header>
                <div
                  class="flex justify-center items-center w-full h-full font-bold"
                >
                  Action
                </div>
              </template>
              <template #body="slotProps">
                <div class="flex justify-center items-center">
                  <CustomButton
                    label=""
                    background-color="bg-danger-300 rounded-lg"
                    @click="showDeleteConfirmation(slotProps.index)"
                    title="Hapus"
                  >
                    <PhTrash :size="18" color="#ffffff" weight="fill" />
                  </CustomButton>
                </div>
              </template>
            </Column>
          </DataTable>
        </div>
        <div
          class="flex justify-center items-center p-5 rounded-lg border border-dashed border-opensimrs-300"
        >
          <CustomButton
            class=""
            icon="PhPlus"
            label="Jadwal Hari"
            borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300"
            backgroundColor="bg-white"
            @click="addRow"
          />
        </div>
      </div>
      <DeleteModalComponent
        :isVisible="deleteModal.isVisible"
        :entityName="deleteModal.entityName"
        @close="handleDeleteClose"
        @confirm="handleDeleteConfirm"
      />
    </template>
    <template #footer>
      <div class="w-full">
        <div class="flex gap-2.5 justify-end mt-5">
          <CustomButton
            label="Reset"
            border-color="border-grey-200"
            background-color="bg-white"
            text-color="text-grey-300"
            @click="handleReset"
          />
          <CustomButton label="Simpan" @click="onSubmit" />
        </div>
      </div>
    </template>
  </CustomDialog>
</template>
