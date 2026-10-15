<script lang="ts" setup>
import CustomChip from "@/components/Base/CustomChip.vue";
import NoData from "@/components/section/NoData.vue";
import { epochToDate, formatDate } from "@/utils/Helpers";
import MedicalRecord from "@/views/MedicalRecord/MedicalRecord.vue";
import { onMounted, ref, watch } from "vue";
import { useAdmisiRIStore } from "@/stores/admisi/rawatInap";
import { utilsStore } from "@/stores/utils";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { useToast } from "primevue/usetoast";

const props = defineProps({
  showCancelVisit: {
    type: Boolean,
    default: false,
  },
  isResetPatient: {
    type: Boolean,
  },
  dataPatient: {
    type: Array,
    required: true,
  },
});

interface PatientDataRI {
  uuid?: string;
  rekamMedisUuid?: string;
  noRm?: string;
  noReg?: string;
  noPelayanan?: string;
  paymentMethod?: string | number;
  patient?: {
    uuid: string;
    noRm: string;
    name: string;
  };
  monitoringRoom?: {
    room: {
      uuid: string;
      name: string;
      code: string;
    };
  };
}

const emit = defineEmits([
  "handleSelectedPatient",
  "handleUnselectedPatient",
  "isResetPatient",
  "selectedAll",
  "handleUnselectAll",
]);

const medicalRecord = ref<any>();
const selectedPatientForRM = ref<PatientDataRI>({});
const rekamMedisStore = useRekamMedisStore();
const admisiRIStore = useAdmisiRIStore();
const storeUtils = utilsStore();
const toast = useToast();

const handleSelectionChange = () => {
  emit("handleSelectedPatient", selectedPatient.value);
};

// const openDialogRM = () => {
//   medicalRecord.value?.showDialogRM();
// };

const openDialogRM = async (event: any) => {
  try {
    storeUtils.setLoading(true);
    const responseDetailPelayanan = await admisiRIStore.getDetailRI(
      event.data.uuid
    );

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

    let responseRekamMedis: any;
    const rekamMedisUuid = selectedPatientForRM.value.rekamMedisUuid;

    if (rekamMedisUuid) {
      responseRekamMedis = await rekamMedisStore.getRekamMedis({
        rekamMedisUuid: rekamMedisUuid,
      });
    } else {
      const dataPasien = selectedPatientForRM.value;
      const lokasiUuid = dataPasien?.monitoringRoom?.room?.uuid;

      if (!lokasiUuid) {
        toast.add({
          severity: "error",
          summary: "Error",
          detail: "Data lokasi ruangan tidak ditemukan pada pasien ini.",
          life: 3000,
        });
        return;
      }

      responseRekamMedis = await rekamMedisStore.createRekamMedis({
        noRm: dataPasien?.patient?.noRm,
        noReg: dataPasien.noReg,
        date: formatDate(new Date(), true),
        pelayanan: "ri",
        lokasiUuid: lokasiUuid,
        noPelayanan: dataPasien.noPelayanan,
        paymentMethod: dataPasien.paymentMethod,
      });
    }

    if (responseRekamMedis && responseRekamMedis.payload) {
      selectedPatientForRM.value.rekamMedisUuid =
        responseRekamMedis.payload.meta.rekamMedisUuid;
      
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


const handleRowUnselect = () => {
  emit("handleUnselectedPatient", selectedPatient.value);
};

const handleSelectedAll = (dataPatient: any) => {
  emit("selectedAll", dataPatient.data);
};

const handleUnselectAll = (dataPatient: any) => {
  emit("handleUnselectAll", dataPatient.data);
};
const selectedPatient = ref([]);

watch(
  () => props.isResetPatient,
  (newValue) => {
    if (newValue) {
      resetSelection();
      // Reset the prop value after performing reset
      emit("isResetPatient", false); // Emit event to reset the prop value
    }
  }
);

// Function to reset the selected patient
const resetSelection = () => {
  selectedPatient.value = [];
};
</script>

<template>
{{ dataPatient }}
<!-- <div>Hali ini coba</div> -->
  <DataTable
    v-if="dataPatient.length"
    v-model:selection="selectedPatient"
    :value="dataPatient"
    tableStyle="min-width: 50rem"
    scrollable
    scrollHeight="flex"
    class=""
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
            {{ slotProps.data.polyclinic.code }}
          </div>
          <div class="text-SM">{{ slotProps.data.noReg }}</div>
        </div>
      </template>
    </Column>
    <Column
      field="pasien"
      header="Pasien"
      headerClass="bg-opensimrs-50"
      class="w-[300px]"
    >
      <template #body="slotProps">
        <div class="text-SM">
          <span class="font-semibold">{{ slotProps.data.patient.name }}</span>
          <span class="text-grey-300">
            ({{ slotProps.data.birthDetail.ageYear }}Th
            {{ slotProps.data.birthDetail.ageMonth }}Bln
            {{ slotProps.data.birthDetail.ageDay }}Hr)
          </span>
        </div>
        <div class="text-XS">
          {{ slotProps.data.patient.address.fullAddress }}
        </div>
        <div class="flex flex-wrap/">
          <PhUserCirclePlus
            v-if="slotProps.data.newPatient"
            :size="22"
            class="text-opensimrs-300 mt-auto mr-[5px]"
            weight="fill"
          />
          <CustomChip
            :showCheckedIcon="false"
            :label="
              slotProps.data.patient.gender == 'Female'
                ? 'Perempuan'
                : 'Laki-Laki'
            "
            :bgColor="
              slotProps.data.patient.gender == 'Female'
                ? 'bg-female-75'
                : 'bg-male-75'
            "
            :textColor="
              slotProps.data.patient.gender == 'Female'
                ? 'text-female-300'
                : 'text-male-300'
            "
            customClass="h-5 pr-[6px] border-none mr-[5px]"
          />
          <CustomChip
            :showCheckedIcon="false"
            :label="slotProps.data.patient.phone"
            bgColor="bg-opensimrs-50"
            textColor="text-opensimrs-300"
            customClass="h-5 pr-[6px] border-none mr-[5px]"
          />
        </div>
      </template>
    </Column>
    <Column
      field="keperawatan"
      header="Keperawatan"
      headerClass="bg-opensimrs-50"
      class="w-[350px]"
    >
      <template #body="slotProps">
        <div class="flex">
          <div class="text-SM">
            {{ slotProps.data.practitioner.title }}
            {{ slotProps.data.practitioner.nama }}
          </div>
          <div class="border border-opensimrs-300 mx-[5px] my-1"></div>
          <div class="text-SM">
            {{ slotProps.data.schedule.startTime }} -
            {{ slotProps.data.schedule.endTime }}
          </div>
        </div>
        <div class="flex flex-wrap mt-1">
          <CustomChip
            :showCheckedIcon="false"
            :label="slotProps.data.polyclinic.name"
            customClass="h-5 pr-[5px] mr-[5px]"
          />
          <CustomChip
            :showCheckedIcon="false"
            :label="slotProps.data.paymentMethod == '1' ? 'TUNAI' : 'BPJS'"
            :bgColor="
              slotProps.data.paymentMethod == '1'
                ? 'bg-opensimrs-50'
                : 'bg-warning-50'
            "
            :textColor="
              slotProps.data.paymentMethod == '1'
                ? 'text-opensimrs-300'
                : 'text-warning-300'
            "
            :borderColor="
              slotProps.data.paymentMethod == '1'
                ? 'border-opensimrs-300'
                : 'border-warning-300'
            "
            customClass="h-5 pr-[6px] mr-[5px]"
          />
          <CustomChip
            v-if="slotProps.data.no_SEP"
            :showCheckedIcon="false"
            :label="`SEP.${slotProps.data.no_SEP}`"
            bgColor="bg-warning-50"
            textColor="text-warning-300"
            borderColor="border-warning-300"
            customClass="h-5 pr-[6px]"
          />
        </div>
      </template>
    </Column>
    <Column
      field="data-kunjungan"
      header="Data Kunjungan"
      headerClass="bg-opensimrs-50"
      class="max-w-[240px]"
    >
      <template #body="slotProps">
        <div class="text-SM">
          <div
            class="grid content-center grid-cols-[80px_min-content_150px] auto-cols-min"
          >
            Daftar
            <PhArrowRight
              :size="18"
              class="my-auto mr-5 text-grey-300"
              weight="bold"
            />
            {{ epochToDate(slotProps.data.tanggalDaftar, "dateTime") }}
          </div>
          <div
            class="grid content-center grid-cols-[80px_min-content_150px] mt-[5px]"
          >
            Diperiksa
            <PhArrowRight
              :size="18"
              class="my-auto mr-5 text-blueJeans-300"
              weight="bold"
            />
            {{ epochToDate(slotProps.data.jadwalPeriksa, "dateTime") }}
          </div>
        </div>
      </template>
    </Column>
    <Column
      field="status"
      header="Status"
      headerClass="bg-opensimrs-50"
      class="w-[114px]"
    >
      <template #body="slotProps">
        <div>
          <CustomChip
            :showCheckedIcon="false"
            :label="
              slotProps.data.statusRj == '0'
                ? 'DIBATALKAN'
                : slotProps.data.statusRj == '1'
                ? 'BOOKING'
                : slotProps.data.statusRj == '2'
                ? 'ANTRI'
                : slotProps.data.statusRj == '3'
                ? 'ANTRIAN'
                : slotProps.data.statusRj == '4'
                ? 'DIPERIKSA'
                : 'DISCHARGE'
            "
            customClass="h-5 pr-[5px] mr-[5px] border-none"
            :bgColor="
              slotProps.data.statusRj == '2' || slotProps.data.statusRj == '3'
                ? 'bg-grey-75'
                : slotProps.data.statusRj == '4'
                ? 'bg-blueJeans-75'
                : 'bg-danger-75'
            "
            :textColor="
              slotProps.data.statusRj == '2' || slotProps.data.statusRj == '3'
                ? 'text-grey-400'
                : slotProps.data.statusRj == '4'
                ? 'text-blueJeans-300'
                : 'text-danger-300'
            "
          />
        </div>
        <div v-if="slotProps.data.statusPembayaran">
          <CustomChip
            :showCheckedIcon="false"
            label="Belum Lunas"
            customClass="h-5 pr-[5px] mr-[5px] border-none"
            :bgColor="
              slotProps.data.statusPembayaran == 'Belum Lunas'
                ? 'bg-grey-100'
                : 'bg-none'
            "
            :textColor="
              slotProps.data.statusPembayaran == 'Belum Lunas'
                ? 'text-grey-400'
                : 'text-white'
            "
          />
        </div>
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
  <!-- Else -->
  <NoData v-else />
  <MedicalRecord ref="medicalRecord" rmType="rawat-jalan" :patientData="selectedPatientForRM" />
</template>

<style>
/* TailwindCSS styles */
.custom-checkbox .p-checkbox-checked .p-checkbox-box {
  @apply border-danger-300 bg-danger-300; /* Kelas Tailwind untuk border dan warna latar */
}

.custom-checkbox .p-checkbox-checked .p-checkbox-box .p-checkbox-icon {
  @apply text-white; /* Kelas Tailwind untuk warna tanda centang */
}
</style>
