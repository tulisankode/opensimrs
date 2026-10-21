<script setup lang="ts">
import { onMounted, ref } from "vue";
import DataPoliBPJSHeader from "../Layout/Header/DataPoliBPJSHeader.vue";
import DataPerpindahanBangsal from "../Layout/Tabel/Perpindahan/DataPerpindahanBangsal.vue";
import { onBeforeRouteLeave, useRoute } from "vue-router";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import type { MenuItem } from "primevue/menuitem";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import type { FilterAdmisi } from "@/utils/Interface";
import { utilsStore } from "@/stores/utils";
import { usePerpindahanBangsalStore} from "@/stores/rawatInap/perpindahanBangsal";
import { epochToDate, formatDate } from "@/utils/Helpers";
import MedicalRecord from "@/views/MedicalRecord/MedicalRecord.vue";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { useAdmisiRIStore } from "@/stores/admisi/rawatInap";
import { useToast } from "primevue/usetoast";

// STORE
const storeUtils = utilsStore();
const perpindahanBangsalStore = usePerpindahanBangsalStore();
const rekamMedisStore = useRekamMedisStore();
const admisiRIStore = useAdmisiRIStore();
const toast = useToast();

const props = defineProps({
  filterRuang: {
    type: String,
    default: "",
  },
});
const value = ref("1");
const dataBreadCrumb = ref<MenuItem[]>([{ label: "Perpindahan Bangsal" }]);
// Data Patient From API
const patientData = ref<any>([]);

const route = useRoute();
const currentRouteName = ref("");
// PROPERTIES FOR PAGINATION
const properties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});


// Menyimpan emit ke variabel
const searchQuery = ref("");
const dokter = ref("");
const selectedFilterPayment = ref<string[]>([]);

// Event emit FROM HEADER
const handleSearchQuery = (value: string) => {
  searchQuery.value = value;
};
const handleDokter = (value: string) => {
  dokter.value = value;
};
const handleReset = () => {
  resetFilter();
  reloadData();
}
const handleChipPayment = (filters: string[]) => {
  selectedFilterPayment.value = filters;
  reloadData();
};


// Filter Data
const filterData = ref<FilterAdmisi>({});

// Ambil dari API
const fetchRIPerpindahanBangsal = async (filter: FilterAdmisi) => {
  storeUtils.setLoading(true);
  try {
    const response = await perpindahanBangsalStore.getAll(filter);
    
    if (response && response.payload) {
      const rawData = Array.isArray(response.payload) ? response.payload : [];
      properties.value.total = response.properties?.totalData || rawData.length;

      return rawData.map((item: any) => {
        const ri = item.rawatInap || {};
        const patient = ri.patient || {};
        const practitioner = ri.practitioner?.pegawai || {};
        const origin = item.originMonitoringRoom || {};
        const dest = item.destinationMonitoringRoom || {};

        const tglDirawat = ri.tanggalDirawat || 0;
        const todayEpoch = Math.floor(Date.now() / 1000);
        const lamaHari = tglDirawat ? Math.floor((todayEpoch - tglDirawat) / 86400) : 0;

        const doctorName = practitioner.name 
          ? `${practitioner.firstTitle || ''} ${practitioner.name} ${practitioner.lastTitle || ''}`.trim()
          : '-';

        const rmUuid = ri.rekamMedisUuid || ri.rekam_medis_uuid || item.rekamMedisUuid;
        
        return {
          ...ri, 
          rekamMedisUuid: rmUuid, 
          patient: patient,
          rawatInapUuid: ri.uuid,
          uuid: item.uuid,
          noRm: ri.noRm || '-',
          noReg: ri.noReg || '-',
          noPelayanan: ri.noPelayanan || '-',
          
          name: patient.name || '-',
          ageYear: patient.birthDetail?.ageYear || 0,
          ageMonth: patient.birthDetail?.ageMonth || 0,
          ageDay: patient.birthDetail?.ageDay || 0,
          address: patient.address?.fullAddress || '-',
          newPatient: patient.newPatient || false,
          gender: ['Female', 'Perempuan'].includes(patient.gender) ? 'P' : 'L',
          phone: patient.phone || '-',

          doctor: doctorName,
          ruangan: origin.room?.name || '-',
          bed: origin.noBed || '-',
          insuranceAccountName: ri.paymentMethod === 1 ? 'TUNAI' : 'ASURANSI',
          no_SEP: '-',

          tanggalSPRI: '-',
          tanggalDirawat: epochToDate(ri.tanggalDirawat, 'dateTime') || '-',
          lamaHari: lamaHari,

          asal: `${origin.room?.name || '-'} / ${origin.noBed || '-'}`,
          tujuan: `${dest.room?.name || '-'} / ${dest.noBed  || '-'}`
        };
      });
      
    } else {
      return [];
    }
  }catch(error){
    console.error("Failed to fetch data", error);
    return [];
  } finally {
    storeUtils.setLoading(false);
  }
};


// Reload dan Terapkan Filter
const reloadData = async () => {
  let filter = {} as FilterAdmisi;
  filter = setFilter();
  patientData.value = await fetchRIPerpindahanBangsal(filter);
};

// SET FILTER
const setFilter = () => {
  let filter = {} as FilterAdmisi
  filter.page = properties.value.page;
  filter.limit = properties.value.page_size;
  filter.q = searchQuery.value;
  filter.paymentMethod =
    selectedFilterPayment.value.length > 1 ||
    !selectedFilterPayment.value.length
      ? ""
      : selectedFilterPayment.value[0];
  filter.dpjp = dokter.value;
  
  return filter
}


const resetFormRef = ref();

const resetFilter = () => {
  searchQuery.value = "";
  resetFormRef.value.resetForm(); 
  dokter.value = "";
}

// PAGINATION
const handlePage = (event: any) => {
  properties.value.page = event.page + 1;
  properties.value.page_size = event.rows;
  reloadData();
};

const medicalRecordRef = ref();
const selectedPatientData = ref<any>({});

const openApprovalDialog = async (data: any) => {
  try {
    storeUtils.setLoading(true);
    
    // Hit API Detail Rawat Inap
    const responseDetailPelayanan = await admisiRIStore.getDetailRI(
      data.rawatInapUuid 
    );

    if (!responseDetailPelayanan || !responseDetailPelayanan.payload) {
      console.error("ERROR: Detail Pelayanan Payload Kosong");
      toast.add({
        severity: "error",
        summary: "Error",
        detail: "Gagal mendapatkan detail data pelayanan.",
        life: 3000,
      });
      return;
    }

    selectedPatientData.value = responseDetailPelayanan.payload;
    selectedPatientData.value.uuid = data.uuid;
    if (data.rekamMedisUuid) {
         selectedPatientData.value.rekamMedisUuid = data.rekamMedisUuid;
    }

    let responseRekamMedis: any;
    const rekamMedisUuid = selectedPatientData.value.rekamMedisUuid;

    console.log("5. Pengecekan IF (rekamMedisUuid):", rekamMedisUuid ? "TRUE (Ada UUID)" : "FALSE (Undefined/Null)");

    if (rekamMedisUuid) {
      responseRekamMedis = await rekamMedisStore.getRekamMedis({
        rekamMedisUuid: rekamMedisUuid,
      });
    } else {
      const dataPasien = selectedPatientData.value;
      const lokasiUuid = dataPasien?.monitoringRoom?.room?.uuid;

      console.log("Data Pasien untuk Create:", dataPasien);
      console.log("Lokasi UUID:", lokasiUuid);

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
      selectedPatientData.value.rekamMedisUuid =
        responseRekamMedis.payload.meta.rekamMedisUuid;
      
      rekamMedisStore.setOpenedRekamMedisData(responseRekamMedis.payload);
      
      medicalRecordRef.value?.showDialogRM();
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
    console.log("=== DEBUG END ===");
  }
};

const updatePageType = (path: string) => {
  resetFilter();
  const tempArrPath = path.split("/");
  currentRouteName.value = tempArrPath[2] ?? "";
  reloadData();
  
};
onBeforeRouteLeave((to) => {
  updatePageType(to.path)
})
onMounted(() => {
  updatePageType(route.path);
});
</script>
<template>
  <div class="flex flex-col h-full w-full"> 
    
    <Card
      pt:body:class="h-full pt-0 overflow-auto"
      pt:content:class="h-full overflow-auto"
      class="flex-1 h-full overflow-hidden" 
    >
      <template #header>
        <DataPoliBPJSHeader
          ref="resetFormRef"
          :activeTab="value"
          @update:value-dokter ="handleDokter"
          :current-route-name="currentRouteName"
          :dataBreadCrumb="dataBreadCrumb"
          @update:value-search="handleSearchQuery"
          @search="reloadData()"
          @reset="handleReset()"
          @payment = "handleChipPayment"
          @reloadData="reloadData()"
        />
      </template>
      <template #content>
        <DataPerpindahanBangsal 
          :items="patientData" 
          @onRowClick="openApprovalDialog"
        />
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomPaginator 
            :rows="properties.page_size"
            :totalRecords="properties.total"
            @page="handlePage"/>
        </div>
      </template>
    </Card>

    <MedicalRecord
      ref="medicalRecordRef"
      :patientData="selectedPatientData"
      rmType="rawat-inap"
      viewMode="current"
      :initialTab="'perpindahan'" 
      :isApprovalMode="true" 
    />
  </div>
</template>