<script setup lang="ts">
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import { utilsStore } from "@/stores/utils";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomRadio from "@/components/Base/CustomRadio.vue";
import CustomCheckbox from "@/components/Base/CustomCheckbox.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import { computed, onMounted, ref, watch } from "vue";
import { useMonitoringKamarStore } from "@/stores/admisi/monitoringKamar";
import { useKategoriRuanganStore } from "@/stores/datamaster/kategoriRuangan";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { usePerpindahanBangsalStore } from "@/stores/rawatInap/perpindahanBangsal";
import { useToast } from "primevue/usetoast";

const props = defineProps({
  method: {
    type: String,
    default: "form",
  },
  isDetail: {
    type: Boolean,
    required: false,
  },
patientData: {
    type: Object,
    default: () => ({})
  },
});

const currentRoomName = computed(() => {
  return props.patientData?.monitoringRoom?.room?.name ?? 
  props.patientData?.monitoring_room?.room?.name ?? "-";
});

const currentRoomClass = computed(() => {
  return props.patientData?.monitoringRoom?.room?.className ?? 
         props.patientData?.monitoring_room?.room?.class_name ?? "-";
});

const currentBedNumber = computed(() => {
  return props.patientData?.monitoringRoom?.noBed ??
         props.patientData?.monitoring_room?.no_bed ?? "-";
});

const tipePerpindahan = ref([
  { name: "Bed", key: "B" },
  { name: "Ruangan", key: "R" },
]);
const radioPerpindahan = ref();

const keterangan = ref();

const tambahan = ref(false);

// STORE
const storeUtils = utilsStore();
const monitoringKamarStore = useMonitoringKamarStore();
const kategoriRuanganStore = useKategoriRuanganStore();
const rekamMedisStore = useRekamMedisStore();
const perpindahanBangsalStore = usePerpindahanBangsalStore();
const toast = useToast();

const detailRequestData = ref<any>(null);


const getDetailData = async () => {
  const uuid = props.patientData?.uuid;
  if (!uuid) return;
  try {
    storeUtils.setLoading(true);
    const response = await perpindahanBangsalStore.getDetailRequest(uuid);
    if (response && response.payload) {
      detailRequestData.value = response.payload;
      emit('detail-fetched', response.payload);
    }
  } catch (error) {
    console.error("Gagal mengambil detail perpindahan:", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const dataRawatInap = computed(() => {
  if (props.patientData?.rawatInap) {
    return props.patientData.rawatInap;
  }
  return props.patientData;
});

onMounted(async () => {
  console.log(storeUtils.selectedRoom);
  if (storeUtils.selectedRoom) {
    selectedBed.value.push(`${storeUtils.selectedRoom.bed}`);
    storeUtils.setSelectedRoom(null);
  }
  await fetchKategoriRuangan();
  if (props.method === 'detail') {
    await getDetailData();
  }
});

const selectedBed = ref<string[]>([]);
const listKelasRuangan = ref([
  { label: "Kelas 1", value: "Kelas 1" },
  { label: "Kelas 2", value: "Kelas 2" },
  { label: "Kelas 3", value: "Kelas 3" },
  { label: "VIP", value: "VIP" },
  { label: "VVIP", value: "VVIP" },
]);

const listKategoriRuangan = ref<any[]>([]);
const listRuangan = ref<any[]>([]);
const selectedRuangan = ref("");
const selectedKelas = ref("");
const selectedKategori = ref("");

const listBed = ref<any[]>([]);
const listBedCadangan = ref<any[]>([]);
const fetchKategoriRuangan = async () => {
  try {
    storeUtils.setLoading(true);
    const responseKategoriRuangan = await kategoriRuanganStore.getAktifApi();
    if (responseKategoriRuangan && responseKategoriRuangan.payload) {
      listKategoriRuangan.value = responseKategoriRuangan.payload;
    } else {
      listKategoriRuangan.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const fetchListRoomData = async () => {
  if (!selectedKelas.value || !selectedKategori.value) return;

  try {
    storeUtils.setLoading(true);
    const response = await monitoringKamarStore.getMonitoringKamar({
      filterKelas: selectedKelas.value ?? "",
      filterKategori: [selectedKategori.value ?? ""],
    });
    if (response && response.payload) {
      listRuangan.value = response.payload;
    } else {
      listRuangan.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    listRuangan.value = [];
  } finally {
    storeUtils.setLoading(false);
  }
};

const fetchListBedData = async (uuid: string) => {
  if (!uuid) {
    listBed.value = [];
    listBedCadangan.value = [];
    return;
  }
  try {
    storeUtils.setLoading(true);
    const response = await monitoringKamarStore.getDetailMonitoringKamar(uuid);

    if (response && response.payload) {
      listBed.value = [];
      listBedCadangan.value = [];

      const beds = Array.isArray(response.payload.detail)
        ? response.payload.detail
        : Array.isArray(response.payload)
        ? response.payload
        : [];

      beds.forEach((bed: any) => {
        if (bed.type == "Bed") {
          listBed.value.push(bed);
        } else if (bed.type == "Bed Cadangan") {
          listBedCadangan.value.push(bed);
        }
      });
    } else {
      listBed.value = [];
      listBedCadangan.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const getRoomName = () => {
  const result = listRuangan.value.find(
    (data: any) => data.uuid == selectedRuangan.value
  );
  if (result) {
    return result.name;
  } else return "-";
};

watch(selectedKelas, (newValue) => {
  listRuangan.value = [];
  selectedRuangan.value = "";
  if (newValue && selectedKategori.value) {
    fetchListRoomData();
  }
});

watch(selectedKategori, (newValue) => {
  listRuangan.value = [];
  selectedRuangan.value = "";
  if (newValue && selectedKelas.value) {
    fetchListRoomData();
  }
});

watch(selectedRuangan, (newValue) => {
  selectedBed.value = [];
  if (newValue) {
    fetchListBedData(newValue);
  } else {
    listBed.value = [];
    listBedCadangan.value = [];
  }
});

watch(radioPerpindahan, (newValue) => {
  selectedBed.value = [];
  listBed.value = [];
  listBedCadangan.value = [];
  
  if (newValue === 'B') {
    const currentRoomUuid = 
      dataRawatInap.value?.monitoringRoom?.roomUuid ??
      dataRawatInap.value?.monitoring_room?.room_uuid;
    
    if (currentRoomUuid) {
      fetchListBedData(currentRoomUuid);
    }
    
    selectedKelas.value = "";
    selectedKategori.value = "";
    selectedRuangan.value = "";
    listRuangan.value = [];

  } else if (newValue === 'R') {
  }
});

const onSubmit = async () => {
  
  if (!selectedBed.value || selectedBed.value.length === 0) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Silakan pilih bed tujuan perpindahan.",
      life: 3000,
    });
    return;
  }

  const UuidRawatInap = dataRawatInap.value?.uuid;
  if (!UuidRawatInap) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Data UUID Rawat Inap pasien tidak ditemukan.",
      life: 3000,
    });
    return;
  }

  const payload = {
    destination_monitoring_room_uuid: selectedBed.value[0],
    keterangan: keterangan.value || ""
  };

  try {
    storeUtils.setLoading(true);
    const response = await rekamMedisStore.createPerpindahan(UuidRawatInap, payload);

    if (response && (response.payload || response.sucess || response.message)) {
      toast.add({
        severity: "success",
        summary: "Berhasil",
        detail: "Permintaan perpindahan bed berhasil dikirim.",
        life: 3000,
      });
    } else {
       toast.add({
        severity: "error",
        summary: "Gagal",
        detail: "Gagal mengirim permintaan perpindahan bed.",
        life: 3000,
      });
    }
  } catch (error) {
    console.error("Failed to create perpindahan:", error);
     toast.add({
        severity: "error",
        summary: "Error",
        detail: "Terjadi kesalahan saat mengirim permintaan.",
        life: 3000,
      });
  } finally {
    storeUtils.setLoading(false);
  }
};

const resetForm = () => {
  selectedBed.value = [];
  listBed.value = [];
  listBedCadangan.value = [];
  keterangan.value = "";
  radioPerpindahan.value = null;
  selectedKelas.value = "";
  selectedKategori.value = "";
  selectedRuangan.value = "";
  tambahan.value = false;
};

const formatRoomDetail = (roomData: any) => {
  if (!roomData) return "-";
  const roomName = roomData.room?.name || "-";
  const className = roomData.room?.className || roomData.room?.class_name || "-";
  const bedNo = roomData.noBed || "-";
  return `${roomName} - ${className} - Bed ${bedNo}`;
};

const emit = defineEmits(['closeDialog', 'refreshData', 'detail-fetched']);

const handleApprove = async () => {
  const uuid = props.patientData?.uuid;
  if (!uuid) return;

  try {
    storeUtils.setLoading(true);
    const response = await perpindahanBangsalStore.approveRequestMoveBed(uuid);
    if (response) {
      toast.add({
        severity: "success",
        summary: "Berhasil",
        detail: "Permintaan perpindahan disetujui.",
        life: 3000,
      });
    }
  } catch (error) {
    console.error("Gagal approve:", error);
    toast.add({ severity: "error", summary: "Error", detail: "Gagal menyetujui permintaan.", life: 3000 });
  } finally {
    storeUtils.setLoading(false);
  }
};

const handleReject = async () => {
  const uuid = props.patientData?.uuid;
  if (!uuid) return;

  try {
    storeUtils.setLoading(true);
    const response = await perpindahanBangsalStore.rejectRequestMoveBed(uuid);
    if (response) {
      toast.add({
        severity: "success",
        summary: "Berhasil",
        detail: "Permintaan perpindahan ditolak.",
        life: 3000,
      });
    }
  } catch (error) {
    console.error("Gagal reject:", error);
    toast.add({ severity: "error", summary: "Error", detail: "Gagal menolak permintaan.", life: 3000 });
  } finally {
    storeUtils.setLoading(false);
  }
};

defineExpose({
  onSubmit,
  resetForm,
  handleApprove,
  handleReject
});

</script>

<template>
  <CustomAccordion headerClass="bg-opensimrs-50">
    <template #header>Perpindahan</template>
    <template #content>
      <div v-if="props.method == 'form'" class="gap-[30px] py-3">
        <div class="grid grid-cols-12 gap-2 py-4">
          <div class="flex items-start col-span-6 gap-4">
            <div class="mt-3">
              <div class="mb-2 text-xs font-semibold text-gray-600 underline">
                Bed Yang Ditempati Saat Ini
              </div>
              <div class="text-lg font-bold text-gray-900">
                {{ currentRoomName }} - {{ currentRoomClass }} - {{ currentBedNumber }}
              </div>
            </div>

            <div class="flex flex-col justify-end ml-auto mr-4 space-y-3">
              <div class="font-bold text-gray-900 text-MD">
                Tipe Perpindahan
              </div>
              <div class="flex gap-4">
                <div
                  v-for="items of tipePerpindahan"
                  :key="items.key"
                  class="flex items-center gap-2.5"
                >
                  <CustomRadio
                    v-model="radioPerpindahan"
                    :value="items.key"
                    :sideLabel="items.name"
                    :disabled="false"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="border-l-[2px] border-gray-100 pl-[15px] col-span-6 mr-4">
            <CustomTextArea
              v-model="keterangan"
              label="Keterangan"
              placeholder="Keterangan"
              class="w-full ml-3"
            />
          </div>
        </div>

        <hr class="my-4 border-grey-200" />

        <div v-if="radioPerpindahan === 'R'">
          <div class="grid grid-cols-5 gap-x-[30px] my-6">
            <CustomSelect
              label="Kelas"
              v-model="selectedKelas"
              :options="listKelasRuangan"
              optionValue="value"
              optionLabel="label"
              :isLoading="false"
              :invalid="false"
              invalidMessage="Wajib diisi"
              :disabled="false"
              placeHolder="Pilih Kelas"
              customSelectClass="border-[#C7CBD2]"
            />
            <CustomSelect
              label="Kategori Ruangan"
              v-model="selectedKategori"
              :options="listKategoriRuangan"
              optionValue="uuid"
              optionLabel="name"
              :invalid="false"
              invalidMessage="Wajib diisi"
              :disabled="false"
              placeHolder="Pilih Kategori Ruangan"
              customSelectClass="border-[#C7CBD2]"
              class="col-span-3"
            />
            <CustomSelect
              label="Ruangan"
              v-model="selectedRuangan"
              :options="listRuangan"
              optionValue="uuid"
              optionLabel="name"
              :invalid="false"
              invalidMessage="Wajib diisi"
              :disabled="!selectedKelas || !selectedKategori"
              placeHolder="Pilih Ruangan"
              customSelectClass="border-[#C7CBD2]"
            />
          </div>
        </div>

        <div
          v-if="(radioPerpindahan === 'R' && selectedRuangan) || radioPerpindahan === 'B'"
          class="grid grid-cols-3 gap-x-[15px]"
        >
          <div class="items-start col-span-2 gap-4">
            <div>
              <div class="flex mb-2 font-bold">
                <div class="mr-1 text-opensimrs-300">{{ radioPerpindahan === 'B' ? currentRoomName : getRoomName() }}</div>
                <div>> Pilih Bed</div>
              </div>
              <div class="grid grid-cols-2 gap-[10px]">
                <CustomCheckbox
                  v-for="data in listBed"
                  v-model="selectedBed"
                  :title="data.patient ? data.patient.name : '-'"
                  :subTitle="'Bed ' + data.noBed"
                  :endText="
                    selectedBed[0] == data.uuid
                      ? 'Terpilih'
                      : data.patient
                      ? 'Terisi'
                      : 'Kosong'
                  "
                  :key="data.uuid"
                  :binary="false"
                  :value="`${data.uuid}`"
                  :multiple="false"
                  :disabled="!!data.patient || isDetail"
                />
              </div>
            </div>

            <div v-if="tambahan">
              <div class="flex mt-4 mb-2 font-bold">
                <div class="mr-1 text-opensimrs-300">{{ radioPerpindahan === 'B' ? currentRoomName : getRoomName() }}</div>
                <div>> Pilih Bed - Bed Cadangan</div>
              </div>
              <div class="grid grid-cols-2 col-span-2 gap-[10px]">
                <CustomCheckbox
                  v-for="data in listBedCadangan"
                  v-model="selectedBed"
                  :title="data.patient ? data.patient.name : '-'"
                  :subTitle="'Bed ' + data.noBed"
                  :endText="
                    selectedBed[0] == data.uuid
                      ? 'Terpilih'
                      : data.patient
                      ? 'Terisi'
                      : 'Kosong'
                  "
                  :key="data.uuid"
                  :binary="false"
                  :value="`${data.uuid}`"
                  :multiple="false"
                  :disabled="!!data.patient || isDetail"
                />
              </div>
            </div>
          </div>
          <div class="border-l-[2px] border-gray-100 pl-[15px]">
            <CustomSwitch
              v-model="tambahan"
              label="Tambahan"
              sideLabel="Bed Cadangan"
              sideLabelTrue="Bed Cadangan"
              :disabled="isDetail"
            />
            </div>
        </div>
      </div>

      <div v-if="props.method == 'detail'" class="grid grid-cols-4 pt-5">
        <CustomInfoRow
          label="Ruangan Saat Ini"
          :value="detailRequestData ? formatRoomDetail(detailRequestData.originMonitoringRoom) : 'Memuat...'"
          type="vertical"
        />
        <CustomInfoRow
          label="Masuk Ke"
          :value="detailRequestData ? formatRoomDetail(detailRequestData.destinationMonitoringRoom) : 'Memuat...'"
          type="vertical"
        />
        <div class="flex col-span-2">
          <div class="mr-5 border border-grey-200" />
          <CustomInfoRow
            label="Keterangan"
            :value="detailRequestData?.keterangan || '-'"
            type="vertical"
          />
        </div>
      </div>
    </template>
    <template #footer v-if="props.method == 'detail'">
      <div class="flex items-end justify-end gap-3">
        <CustomButton
          @click="handleReject"
          label="Tolak Permintaan"
          textColor="text-danger-300"
          backgroundColor="bg-transparent"
          borderColor="border-2 border-danger-300"
        />
        <CustomButton 
        @click="handleApprove"
        label="Setuju & Terima" />
      </div>
    </template>
  </CustomAccordion>
</template>