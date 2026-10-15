<script lang="ts" setup>
import CustomChip from "@/components/Base/CustomChip.vue";
import NoData from "@/components/section/NoData.vue";
import { epochToDate, formatDate } from "@/utils/Helpers";
import MedicalRecord from "@/views/MedicalRecord/MedicalRecord.vue";
import { useToast } from "primevue/usetoast";
import { ref, watch } from "vue";
import { useAdmisiRJStore } from "@/stores/admisi/rawatJalan";
import { utilsStore } from "@/stores/utils";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import StatusKunjunganRJ from "./StatusKunjunganRJ.vue";
import { masihAntri, siapkanPemeriksaan } from "./antrianPoli";

const props = defineProps({
  showCancelVisit: {
    type: Boolean,
    default: false,
  },
  isResetPatient: {
    type: Boolean,
  },
  dataPatient: {
    type: Array as () => any[],
    required: true,
  },
});

const emit = defineEmits([
  "handleSelectedPatient",
  "handleUnselectedPatient",
  "isResetPatient",
  "selectedAll",
  "handleUnselectAll",
  "refreshData",
]);

const medicalRecord = ref<any>();
const selectedPatientForRM = ref<any>({});
const admisiRJStore = useAdmisiRJStore();
const storeUtils = utilsStore();
const rekamMedisStore = useRekamMedisStore();
const toast = useToast();
const selectedPatient = ref([]);
const viewModeRM = ref<'current' | 'history'>('current');

const handleRefreshPatientData = async () => {
  if (!selectedPatientForRM.value?.uuid) {
    return;
  }
  setTimeout(async () => {
    try {
      const responseDetailPelayanan = await admisiRJStore.getDetailRJ(selectedPatientForRM.value.uuid);     
      if (responseDetailPelayanan && responseDetailPelayanan.payload) {
        const currentRmUuid = selectedPatientForRM.value.rekamMedisUuid;
        selectedPatientForRM.value = {
          ...responseDetailPelayanan.payload,
          rekamMedisUuid: currentRmUuid
        };
      }
    } catch (error) {
      console.error("❌ Gagal refresh data pasien:", error);
    }
  }, 200); 
};


const openDialogRM = async (event: any) => {
  if (props.showCancelVisit) return;

  // Pasien masih antri: membuka RME = mulai diperiksa (pasien belum dipanggil dikonfirmasi dulu).
  const keputusan = await siapkanPemeriksaan(event.data);
  if (keputusan !== "buka") return emit("refreshData");
  if (masihAntri(event.data)) emit("refreshData");

  try {
    viewModeRM.value = 'current';
    storeUtils.setLoading(true);
    const responseDetailPelayanan = await admisiRJStore.getDetailRJ(event.data.uuid);

    if (!responseDetailPelayanan || !responseDetailPelayanan.payload) {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "Gagal mendapatkan detail data pelayanan.",
        life: 3000,
      });
      return;
    }

    selectedPatientForRM.value = responseDetailPelayanan.payload;
    selectedPatientForRM.value.rekamMedisUuid = event.data.rekamMedisUuid;

    const rekamMedisUuid = selectedPatientForRM.value.rekamMedisUuid;
    let responseRekamMedis: any;

    if (rekamMedisUuid) {
      responseRekamMedis = await rekamMedisStore.getRekamMedis({ rekamMedisUuid });
    } else {
      const dataPasien = selectedPatientForRM.value;
      const lokasiUuid = dataPasien?.lokasi?.uuid;
      if (!lokasiUuid) {
        toast.add({
          severity: "error",
          summary: "Error",
          detail: "Data lokasi poliklinik tidak ditemukan.",
          life: 3000,
        });
        return;
      }
      responseRekamMedis = await rekamMedisStore.createRekamMedis({
        noRm: dataPasien.patient?.noRm,
        noReg: dataPasien.noReg,
        date: formatDate(new Date(), true),
        pelayanan: "rj",
        lokasiUuid: lokasiUuid,
        noPelayanan: dataPasien.noPelayanan,
        paymentMethod: dataPasien.paymentMethod,
      });
    }

    if (responseRekamMedis && responseRekamMedis.payload) {
      selectedPatientForRM.value.rekamMedisUuid = responseRekamMedis.payload.meta.rekamMedisUuid;
      rekamMedisStore.setOpenedRekamMedisData(responseRekamMedis.payload);
      medicalRecord.value?.showDialogRM();
    } else {
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "Gagal memproses data rekam medis pasien.",
        life: 3000,
      });
    }
  } catch (error) {
    console.error("Gagal membuka rekam medis:", error);
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Terjadi kesalahan saat memuat rekam medis.",
      life: 3000,
    });
  } finally {
    storeUtils.setLoading(false);
  }
};

const handleOpenHistory = async (historyItem: any) => {
  try {
    storeUtils.setLoading(true);
    viewModeRM.value = 'history';

    const responseDetailPelayanan = await admisiRJStore.getDetailRJ(
      historyItem.uuid
    );
    
    if (!responseDetailPelayanan || !responseDetailPelayanan.payload) {
      toast.add({ severity: "error", summary: "Error", detail: "Gagal memuat detail riwayat.", life: 3000 });
      return;
    }
    selectedPatientForRM.value = responseDetailPelayanan.payload;
    selectedPatientForRM.value.rekamMedisUuid = historyItem.rekamMedisUuid;

    const response = await rekamMedisStore.getRekamMedis({
      rekamMedisUuid: selectedPatientForRM.value.rekamMedisUuid,
    });

    if (response && response.payload) {
      selectedPatientForRM.value.rekamMedisUuid = response.payload.meta.rekamMedisUuid;
      rekamMedisStore.setOpenedRekamMedisData(response.payload);
    }
  } catch (error) {
    console.error("Failed to fetch history data", error);
    toast.add({ severity: "error", summary: "Error", detail: "Gagal memuat data rekam medis riwayat.", life: 3000 });
  } finally {
    storeUtils.setLoading(false);
  }
};

const handleSelectionChange = () => emit("handleSelectedPatient", selectedPatient.value);
const handleRowUnselect = () => emit("handleUnselectedPatient", selectedPatient.value);
const handleSelectedAll = (event: any) => emit("selectedAll", event.data);
const handleUnselectAll = (event: any) => emit("handleUnselectAll", event.data);

watch(
  () => props.isResetPatient,
  (newValue) => {
    if (newValue) {
      selectedPatient.value = [];
      emit("isResetPatient", false);
    }
  }
);
</script>

<template>
  <DataTable
    v-if="dataPatient && dataPatient.length"
    v-model:selection="selectedPatient"
    :value="dataPatient"
    scrollable
    scrollHeight="flex"
    class="flex-1"
    @row-click="openDialogRM($event)"
    @row-select-all="handleSelectedAll"
    @row-unselect-all="handleUnselectAll"
    @row-select="handleSelectionChange"
    @row-unselect="handleRowUnselect"
    :pt="{ headerRow: 'text-SM' }"
  >
    <Column field="nomor" headerClass="bg-opensimrs-50">
      <template #header>
        <div class="w-full font-semibold text-center">Nomor</div>
      </template>
      <template #body="slotProps">
        <div class="text-center">
          <div class="text-SM">{{ slotProps.data.noRm }}</div>
          <div
            class="max-w-[75px] mx-auto bg-opensimrs-50 text-opensimrs-300 rounded-[5px] text-SM font-semibold"
          >
            {{ slotProps.data.noAntrianPoli }}
          </div>
          <div class="text-SM">{{ slotProps.data.noReg }}</div>
          <div class="text-SM">{{ slotProps.data.noPelayanan }}</div>
        </div>
      </template>
    </Column>
    <Column field="pasien" header="Pasien" headerClass="bg-opensimrs-50" class="w-[300px]">
      <template #body="slotProps">
        <div class="text-SM">
          <span class="font-semibold">{{ slotProps.data.patient?.name }}</span>
          <span class="text-grey-300" v-if="slotProps.data.birthDetail">
            ({{ slotProps.data.birthDetail.ageYear }}Th
            {{ slotProps.data.birthDetail.ageMonth }}Bln
            {{ slotProps.data.birthDetail.ageDay }}Hr)
          </span>
        </div>
        <div class="text-XS">{{ slotProps.data.patient?.address?.fullAddress }}</div>
        <div class="flex flex-wrap/">
          <PhUserCirclePlus
            v-if="slotProps.data.newPatient"
            :size="22"
            class="text-opensimrs-300 mt-auto mr-[5px]"
            weight="fill"
          />
          <CustomChip
            :showCheckedIcon="false"
            :label="slotProps.data.patient?.gender == 'Female' ? 'Perempuan' : 'Laki-Laki'"
            :bgColor="slotProps.data.patient?.gender == 'Female' ? 'bg-female-75' : 'bg-male-75'"
            :textColor="slotProps.data.patient?.gender == 'Female' ? 'text-female-300' : 'text-male-300'"
            customClass="h-5 pr-[6px] border-none mr-[5px]"
          />
          <CustomChip
            :showCheckedIcon="false"
            :label="slotProps.data.patient?.phone"
            bgColor="bg-opensimrs-50"
            textColor="text-opensimrs-300"
            customClass="h-5 pr-[6px] border-none mr-[5px]"
          />
        </div>
      </template>
    </Column>
    <Column field="keperawatan" header="Keperawatan" headerClass="bg-opensimrs-50" class="w-[350px]">
      <template #body="slotProps">
        <div class="flex">
          <div class="text-SM">{{ slotProps.data.practitioner?.title }} {{ slotProps.data.practitioner?.nama }}</div>
          <div class="border border-opensimrs-300 mx-[5px] my-1"></div>
          <div class="text-SM" v-if="slotProps.data.schedule">{{ slotProps.data.schedule.startTime }} - {{ slotProps.data.schedule.endTime }}</div>
        </div>
        <div class="flex flex-wrap mt-1">
          <CustomChip
            :showCheckedIcon="false"
            :label="slotProps.data.polyclinic?.name"
            customClass="h-5 pr-[5px] mr-[5px]"
          />
          <CustomChip
            :showCheckedIcon="false"
            :label="slotProps.data.paymentMethod == '1' ? 'TUNAI' : 'ASURANSI'"
            :bgColor="slotProps.data.paymentMethod == '1' ? 'bg-opensimrs-50' : 'bg-warning-50'"
            :textColor="slotProps.data.paymentMethod == '1' ? 'text-opensimrs-300' : 'text-warning-300'"
            :borderColor="slotProps.data.paymentMethod == '1' ? 'border-opensimrs-300' : 'border-warning-300'"
            customClass="h-5 pr-[6px] mr-[5px]"
          />
        </div>
      </template>
    </Column>
    <Column field="data-kunjungan" header="Data Kunjungan" headerClass="bg-opensimrs-50" class="max-w-[240px]">
      <template #body="slotProps">
        <div class="text-SM">
          <div class="grid content-center grid-cols-[80px_min-content_150px] auto-cols-min">
            Daftar
            <PhArrowRight :size="18" class="my-auto mr-5 text-grey-300" weight="bold" />
            {{ epochToDate(slotProps.data.tanggalDaftar, "dateTime") }}
          </div>
          <div class="grid content-center grid-cols-[80px_min-content_150px] mt-[5px]">
            Jadwal
            <PhArrowRight :size="18" class="my-auto mr-5 text-blueJeans-300" weight="bold" />
            {{ epochToDate(slotProps.data.jadwalPeriksa, "dateTime") }}
          </div>
        </div>
      </template>
    </Column>
    <Column field="status" header="Status" headerClass="bg-opensimrs-50" class="w-[114px]">
      <template #body="slotProps">
        <StatusKunjunganRJ :row="slotProps.data" @diperbarui="emit('refreshData')" />
      </template>
    </Column>
    <Column
      v-if="props.showCancelVisit"
      selectionMode="multiple"
      headerStyle="width: 3rem"
      headerClass="bg-opensimrs-50"
      class="custom-checkbox"
    ></Column>
  </DataTable>
  <NoData v-else />
  <MedicalRecord ref="medicalRecord" rmType="rawat-jalan" :patientData="selectedPatientForRM" :viewMode="viewModeRM"
    @openHistory="handleOpenHistory" 
    @refreshPatientData="handleRefreshPatientData"
    />
</template>

<style>
/* Style untuk checkbox kustom saat pembatalan */
.custom-checkbox .p-checkbox-checked .p-checkbox-box {
  @apply border-danger-300 bg-danger-300;
}
.custom-checkbox .p-checkbox-checked .p-checkbox-box .p-checkbox-icon {
  @apply text-white;
}
</style>