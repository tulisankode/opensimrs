<script lang="ts" setup>
import { ref, watch, onMounted, computed, watchEffect } from "vue";
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
import DeleteModalComponent from "@/components/Antrian/DeleteModalComponent.vue";
import { useToast } from "primevue/usetoast";
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
  editData: {
    type: Object,
    default: () => ({}),
  },
});

const jadwalDokterStore = useJadwalDokterStore();
const utils = utilsStore();

const itemsHari = ref([
  { name: "Senin", code: 1 },
  { name: "Selasa", code: 2 },
  { name: "Rabu", code: 3 },
  { name: "Kamis", code: 4 },
  { name: "Jumat", code: 5 },
]);

const dayNameToCode = (dayName: string) => {
  const mapping: Record<string, number> = {
    Senin: 1,
    Selasa: 2,
    Rabu: 3,
    Kamis: 4,
    Jumat: 5,
    Sabtu: 6,
    Minggu: 7,
  };
  return mapping[dayName] ?? null; // null jika nama tak dikenali
};

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
  const totalKuota = (parseInt(kuotaJkn) || 0) + (parseInt(kuotaNonJkn) || 0);

  if (totalKuota > 0 && startTime && endTime) {
    const totalMenit = toMinutes(endTime) - toMinutes(startTime);
    return Math.floor(totalMenit / totalKuota).toString();
  }

  return "0";
};

// Schema validasi untuk array jadwal
const schema = toTypedSchema(
  yup.object({
    jadwalData: yup.array().of(
      yup.object({
        jadwalDokterUuid: yup.string().nullable(),
        day: yup
          .number()
          .transform((value) => (isNaN(value) ? undefined : value))
          .required("Hari wajib diisi"),
        startTime: yup.date(),
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
        durasiPelayanan: yup
          .number()
          .required("Durasi pelayanan harus diisi")
          .min(1, "Durasi minimal 1 menit"),
        kuotaJkn: yup
          .number()
          .required("Kuota JKN harus diisi")
          .min(1, "Kuota tidak boleh nol"),
        kuotaNonJkn: yup
          .number()
          .required("Kuota Non-JKN harus diisi")
          .min(1, "Kuota tidak boleh nol"),
        kuota: yup.number().required("Total kuota harus diisi"),
        status: yup.boolean().required("Status harus dipilih"),
      })
    ),
  })
);

const { errors, handleSubmit, resetForm, setValues, values } = useForm({
  validationSchema: schema,
});

const { remove, push, replace, fields } = useFieldArray("jadwalData");

const emit = defineEmits(["update:isDialogVisible", "close", "refresh"]);

function updateVisibility(value: any) {
  emit("update:isDialogVisible", value);
}

function closeDialog() {
  emit("close");
}

// Function untuk menambah row baru
const addRow = () => {
  push({
    jadwalDokterUuid: null,
    day: null,
    startTime: defaultTime(),
    endTime: defaultTime(),
    durasiPelayanan: 30,
    kuotaJkn: 0,
    kuotaNonJkn: 0,
    kuota: 0,
    status: true,
  });
};

// Function untuk format waktu dari string ke Date object
const parseTimeString = (timeString: string) => {
  if (!timeString) return null;
  const [hours, minutes] = timeString.split(":");
  const date = new Date();
  date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  return date;
};

//Helper function untuk mendapatkan waktu default
const defaultTime = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// Watch untuk data dari parent
watch(
  () => props.editData,
  (newData) => {
    console.log("Data yang diterima dari parent:", newData);
    if (newData && newData.jadwalDokter && props.isDialogVisible) {
      // Map data dari parent ke format yang dibutuhkan form
      const mappedData = newData.jadwalDokter.map((jadwal: any) => ({
        jadwalDokterUuid: jadwal.jadwalDokterUuid || null,
        day:
          typeof jadwal.day === "string"
            ? dayNameToCode(jadwal.day)
            : Number(jadwal.day) || "",
        startTime: parseTimeString(jadwal.startTime),
        endTime: parseTimeString(jadwal.endTime),
        durasiPelayanan: Number(jadwal.durasiPelayanan) || 30,
        kuotaJkn: Number(jadwal.kuotaJkn) || 0,
        kuotaNonJkn: Number(jadwal.kuotaNonJkn) || 0,
        kuota: Number(jadwal.kuota) || 0,
        status: jadwal.status === "aktif" || jadwal.status === true,
      }));

      // Set values ke form
      setValues({ jadwalData: mappedData });
    }
  },
  { immediate: true, deep: true }
);

// Watch untuk reset form ketika dialog ditutup
watch(
  () => props.isDialogVisible,
  (newValue) => {
    if (!newValue) {
      resetForm();
    } else if (newValue && props.method === "add") {
      // Jika mode add, set data default
      setValues({
        jadwalData: [
          {
            jadwalDokterUuid: null,
            day: null,
            startTime: defaultTime(),
            endTime: defaultTime(),
            durasiPelayanan: 30,
            kuotaJkn: 0,
            kuotaNonJkn: 0,
            kuota: 0,
            status: true,
          },
        ],
      });
    } else if (newValue && props.method === "edit") {
      // Selalu remap data asli setiap kali dialog edit dibuka kembali
      const mappedData = (props.editData.jadwalDokter || []).map(
        (jadwal: any) => ({
          jadwalDokterUuid: jadwal.jadwalDokterUuid || null,
          day:
            typeof jadwal.day === "string"
              ? dayNameToCode(jadwal.day)
              : Number(jadwal.day) || "",
          startTime: parseTimeString(jadwal.startTime),
          endTime: parseTimeString(jadwal.endTime),
          durasiPelayanan: Number(jadwal.durasiPelayanan) || 30,
          kuotaJkn: Number(jadwal.kuotaJkn) || 0,
          kuotaNonJkn: Number(jadwal.kuotaNonJkn) || 0,
          kuota: Number(jadwal.kuota) || 0,
          status: jadwal.status === "aktif" || jadwal.status === true,
        })
      );
      setValues({ jadwalData: mappedData });
    }
  }
);

watchEffect(() => {
  if (fields.value && Array.isArray(fields.value)) {
    fields.value.forEach((field: any, index: number) => {
      const jadwal = field.value;
      if (
        jadwal.startTime &&
        jadwal.endTime &&
        (Number(jadwal.kuotaJkn) > 0 || Number(jadwal.kuotaNonJkn) > 0)
      ) {
        const calculatedDurasi = calculateDurasiPelayanan(
          jadwal.startTime,
          jadwal.endTime,
          jadwal.kuotaJkn,
          jadwal.kuotaNonJkn
        );

        // Update durasi jika berbeda
        if (jadwal.durasiPelayanan !== Number(calculatedDurasi)) {
          jadwal.durasiPelayanan = Number(calculatedDurasi);
        }
      }
    });
  }
});

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

// Submit handler
const onSubmit = handleSubmit(
  async (formValues: any) => {
    utils.setLoading(true);
    try {
      const doctorUuid = props.editData.doctor?.uuid;
      const poliUuid = props.editData.poli?.uuid;

      if (!doctorUuid || !poliUuid) {
        throw new Error("Doctor UUID atau Poli UUID tidak ditemukan");
      }

      // Prepare payload berdasarkan format yang dibutuhkan API
      const existingJadwal = props.editData.jadwalDokter || [];
      const newJadwalData = formValues.jadwalData || [];

      // Validasi duplikasi jam praktek
      const duplicates = checkDuplicateSchedule(newJadwalData);
      if (duplicates.length > 0) {
        toast.add({
          severity: "error",
          summary: "Validasi Error",
          detail: `Terdapat duplikasi jam praktek: ${duplicates.join(", ")}`,
          life: 5000,
        });
        return;
      }

      const payload = {
        deleted: [] as string[],
        updated: [] as any[],
        added: [] as any[],
      };

      // Identifikasi jadwal yang dihapus
      existingJadwal.forEach((existing: any) => {
        const stillExists = newJadwalData.find(
          (newJadwal: any) =>
            newJadwal.jadwalDokterUuid === existing.jadwalDokterUuid
        );
        if (!stillExists && existing.jadwalDokterUuid) {
          payload.deleted.push(existing.jadwalDokterUuid);
        }
      });

      // Identifikasi jadwal yang diupdate atau ditambah
      newJadwalData.forEach((jadwal: any) => {
        const jadwalPayload = {
          day: Number(jadwal.day),
          start_time: formatTime(jadwal.startTime),
          end_time: formatTime(jadwal.endTime),
          kuota_jkn: Number(jadwal.kuotaJkn),
          kuota_non_jkn: Number(jadwal.kuotaNonJkn),
          aktif: jadwal.status,
        };

        if (jadwal.jadwalDokterUuid) {
          // Update existing(Update)
          payload.updated.push({
            jadwalDokterUuid: jadwal.jadwalDokterUuid,
            ...jadwalPayload,
          });
        } else {
          // Add new(Tambah)
          payload.added.push(jadwalPayload);
        }
      });

      console.log("Payload yang akan dikirim:", payload);

      // Call API
      await jadwalDokterStore.updateJadwalDoctor(doctorUuid, poliUuid, payload);

      // Emit refresh untuk update data di parent
      emit("refresh");

      // Close dialog
      closeDialog();

      console.log("Data berhasil disimpan");
    } catch (error) {
      console.error("Gagal menyimpan data:", error);
    } finally {
      utils.setLoading(false);
    }
  },
  ({ errors, values }: any) => {
    const hasDurasiErrorKey = Object.keys(errors || {}).some((key) =>
      key.includes(".durasiPelayanan")
    );

    if (hasDurasiErrorKey) {
      toast.add({
        severity: "error",
        summary: "Validasi Durasi",
        detail: "Durasi per pasien minimal 1 menit",
        life: 6000,
      });
    }
  }
);

// Reset handler
const handleReset = () => {
  resetForm();
  if (props.editData && props.editData.jadwalDokter) {
    // Reset ke data original
    const mappedData = props.editData.jadwalDokter.map((jadwal: any) => ({
      jadwalDokterUuid: jadwal.jadwalDokterUuid || null,
      day:
        typeof jadwal.day === "string"
          ? dayNameToCode(jadwal.day)
          : Number(jadwal.day) || "",
      startTime: parseTimeString(jadwal.startTime),
      endTime: parseTimeString(jadwal.endTime),
      durasiPelayanan: Number(jadwal.durasiPelayanan) || 30,
      kuotaJkn: Number(jadwal.kuotaJkn) || 0,
      kuotaNonJkn: Number(jadwal.kuotaNonJkn) || 0,
      kuota: Number(jadwal.kuota) || 0,
      status: jadwal.status === "aktif" || jadwal.status === true,
    }));
    setValues({ jadwalData: mappedData });
  }
};

const selectedPatient = ref([]);

const deleteModalData = ref({
  isVisible: false,
  indexToDelete: -1,
});

// Function untuk menampilkan modal konfirmasi delete
const showDeleteModal = (index: number) => {
  deleteModalData.value = {
    isVisible: true,
    indexToDelete: index,
  };
};

// Function untuk menutup modal delete
const closeDeleteModal = () => {
  deleteModalData.value.isVisible = false;
  deleteModalData.value.indexToDelete = -1;
};

// Function untuk konfirmasi penghapusan
const confirmDeleteRow = () => {
  if (deleteModalData.value.indexToDelete >= 0) {
    remove(deleteModalData.value.indexToDelete);
  }
  closeDeleteModal();
};
</script>

<template>
  <CustomDialog
    :fullScreen="true"
    width="1000px"
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    headerBg="bg-opensimrs-300"
  >
    <template #header>{{ title }} Jadwal</template>
    <template #body>
      <div class="flex flex-col gap-5 mt-5">
        <div class="text-lg font-bold text-black">
          {{ editData.doctor?.name || "Nama Dokter" }}
        </div>
        <hr />
        <div class="grid grid-cols-3 gap-y-0 gap-x-4 ml-2 text-xs text-center">
          <div class="font-bold text-black underline">Poliklinik</div>
          <div class="font-bold text-black underline">Kode Antrian Poli</div>
          <div class="font-bold text-black underline">Kode Antrian Dokter</div>
          <div class="text-sm text-black">{{ editData.poli?.name || "-" }}</div>
          <div class="text-sm text-black">
            {{ editData.poli?.kodeAntrian || "-" }}
          </div>
          <div class="text-sm text-black">
            {{ editData.doctor?.kodeAntrian || "-" }}
          </div>
        </div>

        <hr />
        <div class="overflow-y-auto relative">
          <DataTable
            v-if="fields.length"
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
                    class="w-[120px] text-grey-400 text-xs"
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
                    (parseInt(slotProps.data.value.kuotaJkn) || 0) +
                    (parseInt(slotProps.data.value.kuotaNonJkn) || 0)
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
                  {{ slotProps.data.value.durasiPelayanan }} menit
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
                    v-model="slotProps.data.value.status"
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
                    icon="PhTrash"
                    textColor="text-white"
                    backgroundColor="bg-red-500"
                    @click="showDeleteModal(slotProps.index)"
                  />
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
          >
          </CustomButton>
          <CustomButton label="Simpan" @click="onSubmit"> </CustomButton>
          <DeleteModalComponent
            :isVisible="deleteModalData.isVisible"
            entityName="Jadwal Dokter"
            @close="closeDeleteModal"
            @confirm="confirmDeleteRow"
          />
        </div>
      </div>
    </template>
  </CustomDialog>
</template>

<style lang="postcss">
small.text-red-500.text-XS {
  @apply -mt-0.5 block;
  position: relative;
  /* top: px; */
}
</style>
