<script setup lang="ts">
import { computed, ref, watch } from "vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import { format } from "date-fns";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { utilsStore } from "@/stores/utils";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "primevue/usetoast";

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    default: false,
  },
  payload: {
    type: Object,
    default: () => ({}),
  },
  recordDate: {
    type: String,
    default: "",
  },
  noResep: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);

// Store
const rekamMedisStore = useRekamMedisStore();
const storeUtils = utilsStore();
const authStore = useAuthStore();
const toast = useToast();

const jamPemberian = ref(new Date());
const catatan = ref("");
const selectedObat = ref<any>(null);
const detailData = ref<any>(null);


const isEditing = ref(false);
const editingPemberian = ref<any>(null);

const editedSisaObat = ref(0);

const startEditObat = () => {
  editObat.value = true;
  editedSisaObat.value = selectedObat.value?.sisaQtyOrder || 0;
};

const saveUpdateSisaObat = async () => {
  const uuid = selectedObat.value?.uuid;
  
  if (!uuid) {
    toast.add({ severity: "warn", summary: "Error", detail: "Data obat tidak valid.", life: 3000 });
    return;
  }

  storeUtils.setLoading(true);
  try {
    const payload = {
      sisa_qty_order: editedSisaObat.value
    };

    const response: any = await rekamMedisStore.updatesisaobat(uuid, payload);
    if (
      response && 
      (
        response.payload?.includes?.("berhasil") || 
        response.message?.toLowerCase().includes("berhasil") ||
        response.message?.toLowerCase().includes("success")
      )
    ) {
      selectedObat.value.sisaQtyOrder = editedSisaObat.value;
      editObat.value = false;
    } else {
      throw new Error(response?.message || "Gagal update sisa obat");
    }
  } catch (error) {
    console.error("Update Sisa Obat Error:", error);
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Gagal memperbarui sisa obat.",
      life: 3000,
    });
  } finally {
    storeUtils.setLoading(false);
  }
};

const getUserName = () => {
  let nama = "Petugas";
  const userLs = localStorage.getItem("user") || localStorage.getItem("userData") || localStorage.getItem("userInfo");
  
  if (userLs) {
    try {
      const userObj = JSON.parse(userLs);
      nama = userObj.name || userObj.email || userObj.username || userObj.nama || nama;
    } catch (e) {
      console.error("Gagal parsing user dari localStorage", e);
    }
  } else {
    const storeAny = authStore as any;
    const userStore = storeAny.user || storeAny.userData || storeAny.currentUser;
    if (userStore) {
      nama = userStore.name || userStore.email || nama;
    }
  }
  
  return nama;
};

const isToday = computed(() => {
  if (!props.recordDate) return false;
  const today = format(new Date(), "yyyy-MM-dd");
  return props.recordDate === today;
});

const fetchFPODetail = async (uuid: string, date: string) => {
  if (!uuid || !date) {
    console.warn("Missing UUID or Date for FPO Detail");
    return;
  }

  let epochDate: string | number = "";
  const parts = date.split("-");
  if (parts.length === 3) {
    const dateObject = new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10)
    );
    epochDate = Math.floor(dateObject.getTime() / 1000);
  } else {
    console.error("Invalid date format provided to dialog:", date);
    return;
  }

  storeUtils.setLoading(true);
  try {
    const response = await rekamMedisStore.getFPODetail({
      prescriptionItemUuid: uuid,
      date: epochDate.toString(),
    });

    if (response && response.payload) {
      detailData.value = response.payload;
    if (selectedObat.value && response.payload.detail?.sisaQtyOrder !== undefined) {
        selectedObat.value.sisaQtyOrder = response.payload.detail.sisaQtyOrder;
      }
    } else {
      detailData.value = null;
      console.error("Failed to get FPO detail:", response);
    }
  } catch (error) {
    detailData.value = null;
    console.error("Error fetching FPO detail:", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

watch(
  () => props.isDialogVisible,
  (isVisible) => {
    if (isVisible && props.payload?.uuid && props.recordDate) {

      selectedObat.value = props.payload;
      cancelEdit();
      fetchFPODetail(props.payload.uuid, props.recordDate);
    } else if (!isVisible) {
      detailData.value = null;
      selectedObat.value = null;
    }
  }
);

const updateVisibility = (value: boolean) => {
  emit("update:isDialogVisible", value);
};

const submitPemberian = async () => {
  const targetObatUuid = selectedObat.value?.uuid || props.payload?.uuid;

  if (!targetObatUuid) {
    toast.add({
      severity: "warn",
      summary: "Error",
      detail: "Data obat tidak ditemukan.",
      life: 3000,
    });
    return;
  }
  
  if (!props.recordDate) {
    toast.add({
      severity: "warn",
      summary: "Error",
      detail: "Tanggal rekam medis tidak ditemukan.",
      life: 3000,
    });
    return;
  }

  const parts = props.recordDate.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; 
  const day = parseInt(parts[2], 10);
  const hours = jamPemberian.value.getHours();
  const minutes = jamPemberian.value.getMinutes();
  const seconds = jamPemberian.value.getSeconds();
  const combinedDate = new Date(year, month, day, hours, minutes, seconds);
  const epochTimestamp = Math.floor(combinedDate.getTime() / 1000);
  const namaPetugas = getUserName();

  const payload = {
    jam_pemberian: epochTimestamp,
    nama_pemberi: namaPetugas, 
    note: catatan.value,
    prescription_item_uuid: targetObatUuid,
    qty_pemberian: selectedObat.value?.medicationDoseQty || 0,
  };

  storeUtils.setLoading(true);
  try {
    const response = await rekamMedisStore.addFPO(payload);
    if (response && (response.payload || response.sucess || response.message?.includes("berhasil"))) {
      emit("data-updated");
      await fetchFPODetail(targetObatUuid, props.recordDate);
      catatan.value = "";
      jamPemberian.value = new Date();
    } else {
      throw new Error(response?.message || "Gagal menambahkan data");
    }
  } catch (error) {
     console.error("Submit FPO Error:", error);
     const errorMessage = (error as Error).message;
     if (errorMessage === "Validation Error" || errorMessage.includes("422")) {
        return;
     }
     toast.add({
        severity: "error",
        summary: "Error",
        detail: (error as Error).message || "Gagal menambahkan data.",
        life: 3000,
      });
  } finally {
    storeUtils.setLoading(false);
  }
};


const startEdit = (pemberian: any) => {
  isEditing.value = true;
  editingPemberian.value = pemberian;

  catatan.value = pemberian.note;
  const timeParts = pemberian.jamPemberian.split(":");
  const newJam = new Date();
  newJam.setHours(parseInt(timeParts[0], 10));
  newJam.setMinutes(parseInt(timeParts[1], 10));
  newJam.setSeconds(0);
  jamPemberian.value = newJam;
};

const cancelEdit = () => {
  isEditing.value = false;
  editingPemberian.value = null;
  catatan.value = "";
  jamPemberian.value = new Date();
};

const saveEdit = async () => {
  const dataUuid = editingPemberian.value?.uuid ?? editingPemberian.value?._id;

  if (!editingPemberian.value || !dataUuid) {
    toast.add({
      severity: "warn",
      summary: "Error",
      detail: "Data pemberian tidak valid untuk diedit.",
      life: 3000,
    });
    return;
  }

  if (!props.recordDate) {
    toast.add({
      severity: "warn",
      summary: "Error",
      detail: "Tanggal rekam medis tidak ditemukan.",
      life: 3000,
    });
    return;
  }

  const parts = props.recordDate.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const hours = jamPemberian.value.getHours();
  const minutes = jamPemberian.value.getMinutes();
  const seconds = jamPemberian.value.getSeconds();
  const combinedDate = new Date(year, month, day, hours, minutes, seconds);
  const epochTimestamp = Math.floor(combinedDate.getTime() / 1000);
  const namaPetugas = getUserName();

  const payload = {
    jam_pemberian: epochTimestamp,
    nama_pemberi: namaPetugas,
    note: catatan.value,
    uuid: dataUuid,
  };
  
  storeUtils.setLoading(true);
  try {
    const response = await rekamMedisStore.editFPO(payload);
    if (response && (response.payload || response.sucess || response.message.includes("berhasil"))) {
      emit("data-updated");
      await fetchFPODetail(props.payload.uuid, props.recordDate);
      cancelEdit();
    } else {
      throw new Error("Gagal memperbarui data");
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const formattedRecordDate = computed(() => {
  if (props.recordDate) {
    const parts = props.recordDate.split("-");
    if (parts.length === 3) {
      const dateObj = new Date(
        parseInt(parts[0]),
        parseInt(parts[1]) - 1,
        parseInt(parts[2])
      );
      return format(dateObj, "dd-MM-yyyy");
    }
  }
  return format(new Date(), "dd-MM-yyyy");
});

const timeSessions = [
  { label: "Pagi", timeRange: "07:00 - 12:00", start: "07:00", end: "12:00" },
  { label: "Siang", timeRange: "12:00 - 16:00", start: "12:00", end: "16:00" },
  { label: "Sore", timeRange: "16:00 - 18:00", start: "16:00", end: "18:00" },
  { label: "Malam", timeRange: "18:00 - 00:00", start: "18:00", end: "00:00" },
  { label: "Khusus", timeRange: "00:00 - 07:00", start: "00:00", end: "07:00" },
];

interface Pemberian {
  waktuPemberian: string;
  qtyPemberian: string;
  petugasPemberian: string;
  catatan: string;
}
const getPemberianByTimeRange = (start: string, end: string): Pemberian[] => {
  const result: Pemberian[] = [];
  const timeFormat = (time: string) => time.split(":").map(Number);

  const pemberianList =
    detailData.value?.pemberian || selectedObat.value?.pemberian || [];

  pemberianList.forEach((pemberian: Pemberian) => {
    const pemberianTime = timeFormat(pemberian.waktuPemberian);
    const startTime = timeFormat(start);
    const endTime = timeFormat(end);

    if (pemberianTime[0] >= startTime[0] && pemberianTime[0] < endTime[0]) {
      result.push(pemberian);
    }
  });

  return result;
};
const editObat = ref(false);

watch(
  () => props.payload,
  (newPayload) => {
    if (props.isDialogVisible && newPayload) {
      selectedObat.value = newPayload;
    }
  },
  { deep: true }
);

</script>

<template>
  <CustomDialog
    width="800px"
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    headerBg="bg-opensimrs-300"
  >
    <template #header>
      <div class="flex justify-between w-[700px] items-center">
        <div class="flex items-center gap-2.5">
          <div class="font-semibold text-MD">
            {{ selectedObat?.itemMedis?.name }}
          </div>
          <PhLineVertical :size="20" color="#ffffff" />
          <CustomButton
            :label="noResep"
            background-color="bg-grey-50"
            text-color="text-opensimrs-300"
            class="rounded-lg h-7"
          />
        </div>
        <div class="text-MD">Tgl. Pemberian: {{ formattedRecordDate }}</div>
      </div>
    </template>

    <template #body>
      <div
        v-if="!detailData && storeUtils.isLoading"
        class="flex items-center justify-center h-64"
      >
        </div>
      <div
        v-else-if="detailData || selectedObat"
        class="flex flex-col gap-5 pt-5 overflow-hidden h-full"
      >
        <Card
          v-if="selectedObat"
          pt:root:class="border rounded-lg shadow border-opensimrs-300 shadow-inherit"
          pt:body:class="h-full p-2.5"
        >
          <template #content>
            <div class="flex justify-between">
              <div class="flex flex-col gap-2.5">
                <div class="flex items-center gap-2.5 text-SM">
                  {{ selectedObat.aturanPakai.name }}
                  <span><img src="@/assets/icons/Vector-arows.svg" /></span>
                  {{ selectedObat.medicationDoseQty }}
                  {{ selectedObat.satuanDosis?.name }}
                </div>
                <CustomChip
                  :label="selectedObat.caraPakai?.caraPakai"
                  :showCheckedIcon="false"
                  border-color="border-opensimrs-300"
                  bg-color="bg-opensimrs-50"
                  text-color="text-opensimrs-300"
                  customClass="text-xs font-semibold cursor-auto h-5 max-w-fit"
                />
              </div>
             <div class="flex flex-col items-end justify-between">
                <div class="flex items-center gap-2.5 text-SM">
                  Jml. Order
                  <span><img src="@/assets/icons/Vector-arows.svg" /></span>
                  {{ selectedObat.medicationQty }}
                  {{ selectedObat.itemMedis?.satuanPenggunaan?.name }}
                </div>
                <div class="flex items-center gap-2.5" v-if="!editObat">
                  <div class="text-SM">
                    Sisa Obat
                    <span class="font-bold"
                      >({{ selectedObat.sisaQtyOrder }}
                      {{
                        selectedObat.itemMedis?.satuanPenggunaan?.name
                      }})</span
                    >
                  </div>
                  <CustomButton
                    v-if="detailData?.detail?.satuanDosis?.editable"
                    label=""
                    background-color="bg-[#3D84E5] rounded-lg"
                    class="h-6 w-[26px] p-0"
                    @click="startEditObat" 
                  >
                    <img src="@/assets/icons/edit.svg" alt="" />
                  </CustomButton>
                </div>
                <div class="flex gap-2.5 items-center" v-if="editObat">
                  <div class="text-SM">Sisa Obat</div>
                  <div class="w-[130px]">
                    <CustomInputNumber 
                      v-model="editedSisaObat" 
                      showButtons 
                      label=""
                      :min="0"
                      :max="selectedObat?.medicationQty" 
                    />
                  </div>
                  <CustomButton
                    label=""
                    background-color="bg-opensimrs-300 rounded-lg"
                    class="h-6 w-[26px] p-0"
                    @click="saveUpdateSisaObat"
                  >
                     <PhCheck />
                  </CustomButton>
                </div>
              </div>
            </div>
          </template>
        </Card>

        <div class="flex items-end gap-5">
          <CustomDatePicker
            v-model="jamPemberian"
            label="Jam Pemberian"
            time-only
          />
          <CustomTextArea
            v-model="catatan"
            label="Catatan"
            placeholder="Catatan"
            class="grow"
            height="h-10"
          />

          <CustomButton
            v-if="isEditing"
            label="Simpan Edit"
            background-color="bg-opensimrs-300"
            text-color="text-white"
            class="ml-2.5"
            @click="saveEdit"
          />
          <CustomButton
            v-if="!isEditing && isToday"
            background-color="bg-opensimrs-300"
            text-color="text-white"
            class="ml-2.5"
            icon="PhPlus"
            @click="submitPemberian"
          />
          </div>

        <hr class="border-grey-200" />

        <div class="flex flex-col gap-5 overflow-y-auto h-[30vh]">
          <div v-for="(session, key) in detailData?.jadwal" :key="key">
            <CustomAccordion header-class="bg-opensimrs-50">
              <template #header>
                <div class="flex justify-between w-full pr-2.5 items-center">
                  <div class="font-normal text-normal capitalize">
                    {{ key }}
                    <span class="text-grey-500">({{ session.range }})</span>
                  </div>
                  <div
                    class="flex items-center gap-2.5 font-normal text-normal"
                  >
                    Jumlah Pemberian
                    <CustomButton
                      :label="session.jumlahPemberian.toString()"
                      background-color="bg-transparent"
                      border-color="border-2 border-opensimrs-300"
                      text-color="text-opensimrs-300"
                      class="h-[21px] px-[10.5px] rounded-[5px]"
                    />
                  </div>
                </div>
              </template>
              <template #content>
                <div class="items-center pt-5 gap-2.5">
                  <div
                    v-if="session.data.length === 0"
                    class="text-center text-grey-400"
                  >
                    Belum ada pemberian di sesi ini.
                  </div>
                  <div
                    v-for="(pemberian, pIndex) in session.data"
                    :key="pIndex"
                    class="mb-4"
                  >
                    <Card
                      pt:root:class="rounded-lg shadow bg-opensimrs-100 shadow-inherit"
                      pt:body:class="h-full p-2.5"
                      class="grow"
                    >
                      <template #content>
                        <div class="flex w-full gap-5">
                          <div class="flex flex-col gap-2.5">
                            <div
                              class="font-semibold text-white truncate text-SM"
                            >
                              Jam Pemberian
                            </div>
                            <div
                              class="font-semibold text-heading text-opensimrs-300 px-[14.5px] rounded-lg py-1.5 bg-white text-center"
                            >
                              {{ pemberian.jamPemberian }}
                            </div>
                            <CustomButton
                              v-if="!isEditing && isToday"
                              label="Edit"
                              @click="startEdit(pemberian)"
                            >
                              <PhPencilSimple :size="20" weight="fill" />
                              Edit
                            </CustomButton>

                            <CustomButton
                              v-if="isEditing && editingPemberian?.uuid === pemberian.uuid"
                              label="Batal"
                              background-color="bg-danger-300"
                              @click="cancelEdit"
                            />
                            </div>
                          <div class="flex flex-col gap-2.5 grow">
                            <div class="font-semibold text-white text-SM">
                              Catatan
                            </div>
                            <div
                              class="rounded-lg p-2.5 bg-white grow text-XS flex flex-col gap-1"
                            >
                              <div>
                                {{ pemberian.note }}
                              </div>
                              <hr class="border-grey-200" />
                              <div class="flex items-center gap-2.5">
                                Petugas
                                <span>
                                  <ArrowRightBrokenIcon
                                    class="text-opensimrs-300"
                                  />
                                </span>
                                {{ pemberian.namaPemberi }}
                              </div>
                            </div>
                          </div>
                        </div>
                      </template>
                    </Card>
                  </div>
                </div>
              </template>
            </CustomAccordion>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div>
        </div>
    </template>
  </CustomDialog>
</template>