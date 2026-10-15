<script setup lang="ts">
import { onMounted, ref, type PropType } from "vue";
import { modulAktif } from "@/stores/modulFaskes";
import CustomButton from "@/components/Base/CustomButton.vue";
import FormAlergi from "@/components/RekamMedis/Alergi/FormAlergi.vue";
import Anamnesis from "@/components/RekamMedis/Anamnesis/Anamnesis.vue";
import AnamnesisIGD from "@/components/RekamMedis/AnamnesisIGD/AnamnesisIGD.vue";
import Triase from "@/components/RekamMedis/Triase/Triase.vue";
import FormTandaVital from "@/components/RekamMedis/TandaVital/FormTandaVital.vue";
import Antropometri from "@/components/RekamMedis/Antropometri/Antropometri.vue";
import FormAsesmenNyeri from "@/components/RekamMedis/AsesmenNyeri/FormAsesmenNyeri.vue";
import Kesadaran from "@/components/RekamMedis/Kesadaran/Kesadaran.vue";
import PemeriksaanFisik from "@/components/RekamMedis/PemeriksaanFisik/PemeriksaanFisik.vue";
import PemeriksaanGigi from "@/components/RekamMedis/PemeriksaanGigi/PemeriksaanGigi.vue";
import PemeriksaanMata from "@/components/RekamMedis/PemeriksaanMata/PemeriksaanMata.vue";
import BurnInput from "@/components/RekamMedis/LukaBakar/BurnInput.vue";
import CatatanHasilPenunjang from "@/components/RekamMedis/CatatanHasilPenunjang/CatatanHasilPenunjang.vue";
import FormDiagnosaDokterICD10 from "@/components/RekamMedis/DiagnosaDokter/FormDiagnosaDokterICD10.vue";
import AsuhanKeperawatan from "@/components/RekamMedis/AsuhanKeperawatan/AsuhanKeperawatan.vue";
import FormCatatanPerawat from "@/components/RekamMedis/CatatanPerawat/FormCatatanPerawat.vue";
import InstruksiMedis from "@/components/RekamMedis/IntruksiMedis/InstruksiMedis.vue";
import FormOrderObat from "@/components/RekamMedis/OrderObat/AccordionOrderObat.vue";
import PemeriksaanTindakan from "@/components/RekamMedis/PemeriksaanTindakan/PemeriksaanTindakan.vue";
import FormImplementation from "@/components/Fisioterapi/Implementation/FormImplementation.vue";
import FormEvaluation from "@/components/Fisioterapi/Evaluation/FormEvaluation.vue";
import FormReassesment from "@/components/Fisioterapi/Reassesment/FormReassesment.vue";
import FormOrderAlkes from "@/components/RekamMedis/OrderAlkes/AccordionOrderAlkes.vue";
import OrderLab from "@/components/RekamMedis/OrderLab/OrderLab.vue";
import FormOrderFisio from "@/components/RekamMedis/OrderFisio/FormOrderFisio.vue";
import FormOrderRadiologi from "@/components/RekamMedis/OrderRadiologi/FormOrderRadiologi.vue";
import FormOrderMikro from "@/components/RekamMedis/OrderMikro/FormOrderMikro.vue";
import FormOrderPa from "@/components/RekamMedis/OrderPA/FormOrderPa.vue";
import FormPersetujuanPasien from "@/components/RekamMedis/PersetujuanPasien/FormPersetujuanPasien.vue";
import { utilsStore } from "@/stores/utils";
import { useRoomPharmacyStore } from "@/stores/farmasi/RoomPharmacy";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";

// NOTE Store
const storeUtils = utilsStore();
const roomPharmacyStore = useRoomPharmacyStore();
const rekamMedisStore = useRekamMedisStore();

const emit = defineEmits(["editAsesmen", "editAsesmenMata"]);

const props = defineProps({
  rmType: {
    type: String,
    default: "rawat-jalan",
  },
  rmAssesmentData: {
    type: Object as PropType<any>,
  },
  sessionUuid: {
    type: String,
    default: "",
  },
  rmUuid: {
    type: String,
    default: "",
  },
  rmDate: {
    type: String,
    default: "",
  },
  patientData: {
    type: Object,
    required: true,
  },
});

const refs = {
  alergi: ref<any>(null),
  anamnesis: ref<any>(null),
  // anamnesisIGD: ref<any>(null),
  triase: ref<any>(null),
  tandaVital: ref<any>(null),
  antropometri: ref<any>(null),
  asesmenNyeri: ref<any>(null),
  kesadaran: ref<any>(null),
  pemeriksaanFisik: ref<any>(null),
  pemeriksaanGigi: ref<any>(null),
  pemeriksaanMata: ref<any>(null),
  lukaBakar: ref<any>(null),
  catatanHasilPenunjang: ref<any>(null),
  diagnosisDokter: ref<any>(null),
  asuhanKeperawatan: ref<any>(null),
  catatanPerawat: ref<any>(null),
  instruksiMedis: ref<any>(null),
  orderObat: ref<any>(null),
  pemeriksaanTindakan: ref<any>(null),
  implementation: ref<any>(null),
  evaluation: ref<any>(null),
  reassessment: ref<any>(null),
  orderAlkes: ref<any>(null),
  orderLab: ref<any>(null),
  orderFisio: ref<any>(null),
  orderRadiologi: ref<any>(null),
  orderMikro: ref<any>(null),
  orderPa: ref<any>(null),
  persetujuanPasien: ref<any>(null),
  edukasi: ref<any>(null),
  keadaanWaktuPulang: ref<any>(null),
  statusPulang: ref<any>(null),
};

const toggleShowAllDetailMR = (method = "show") => {
  // refs['pemeriksaanFisik'].value.open()
  Object.keys(refs).forEach((key) => {
    const refKey = key as keyof typeof refs; // pastikan key cocok dengan kunci refs

    const element = refs[refKey].value; // akses elemen dari ref

    if (element) {
      if (method == "show") {
        element.open?.();
      } else {
        element.close?.();
      }
    }
  });
};

const results = ref<any[]>([]);
const getListOrderAlkes = async () => {
  if (props.rmUuid && props.rmDate) {
    try {
      const response = await roomPharmacyStore.geInOneDate({
        rekamMedisUuid: props.rmUuid,
        rekamMedisDate: props.rmDate,
      });

      if (response && response.payload) {
        const summaryList = response.payload;
        const detailedResults = await Promise.all(
          summaryList.map(async (order: any) => {
            try {
              const detailResponse = await roomPharmacyStore.detailApi(order.uuid);
              const payload = detailResponse?.payload;
              const items = payload?.alkes_items || payload?.alkesItems || [];
              const mappedItems = items.map((item: any) => ({
                ...item,
                itemMedis: item.item_medis || item.itemMedis,
                qty: item.qty
              }));
              return {
                ...order,
                alkesItems: mappedItems, 
              };
            } catch (err) {
              console.error(`Gagal ambil detail untuk order ${order.uuid}`, err);
              return { ...order, alkesItems: [] };
            }
          })
        );
        results.value = detailedResults;
      }
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        console.warn("Info: Data order alkes kosong untuk pasien ini (404).");
        results.value = [];
      } else {
        console.error("Gagal mengambil list order alkes:", error);
      }
    }
  }
};

const resultsPersetujan = ref<any[]>([]);
const getListPersetujuan = async () => {
  if (props.rmUuid && props.rmDate) {
    const response = await rekamMedisStore.getAllInformConsent({
      rekamMedisUuid: props.rmUuid,
    });
    if (response && response.payload) {
      resultsPersetujan.value = response.payload;
    }
  }
};

onMounted(async () => {
  try {
    storeUtils.setLoading(true);
    await getListPersetujuan();
    await getListOrderAlkes();
  } catch (error) {
    console.error(error);
  } finally {
    storeUtils.setLoading(false);
  }
});
</script>

<template>
  <div class="flex mt-5 overflow-auto">
    <!-- <NoData class="grow" title="Belum Ada Pemeriksaan" /> -->
    <div class="grid grid-cols-2 grow gap-2.5 overflow-x-hidden">
      <FormAlergi
        v-if="rmAssesmentData.alergi"
        :ref="refs.alergi"
        method="detail"
        @editAsesmen="emit('editAsesmen', 'Alergi')"
      />
      <Anamnesis
        v-if="rmAssesmentData.anamnesis"
        :ref="refs.anamnesis"
        method="detail"
      />
      <!-- <AnamnesisIGD
        v-if="rmType == 'igd' && rmAssesmentData.anemsisIgd"
        :ref="refs.anamnesisIGD"
        method="detail"
        @editAsesmen="emit('editAsesmen', 'Anamnesis IGD')"
      /> -->
      <Triase
        v-if="rmType == 'igd' && rmAssesmentData.triase"
        :ref="refs.triase"
        method="detail"
        @editAsesmen="emit('editAsesmen', 'Triase')"
      />
      <FormTandaVital
        v-if="rmAssesmentData.tandaVital"
        :ref="refs.tandaVital"
        method="detail"
        @editAsesmen="emit('editAsesmen', 'Tanda Vital')"
      />
      <Antropometri
        v-if="rmAssesmentData.antropometri"
        :ref="refs.antropometri"
        method="detail"
        @editAsesmen="emit('editAsesmen', 'Antropometri')"
      />
      <FormAsesmenNyeri
        v-if="rmAssesmentData.asesmenNyeri"
        :ref="refs.asesmenNyeri"
        method="detail"
        @editAsesmen="emit('editAsesmen', 'Asesmen Nyeri')"
      />
      <Kesadaran
        v-if="rmAssesmentData.kesadaran"
        :ref="refs.kesadaran"
        method="detail"
        @editAsesmen="emit('editAsesmen', 'Kesadaran')"
      />
      <PemeriksaanFisik
        v-if="rmAssesmentData.pemeriksaanFisik"
        :ref="refs.pemeriksaanFisik"
        method="detail"
        @editAsesmen="emit('editAsesmen', 'Pemeriksaan Fisik', $event)"
      />
      <PemeriksaanGigi
        v-if="rmType == 'rawat-jalan' && rmAssesmentData.pemeriksaanGigi"
        :ref="refs.pemeriksaanGigi"
        method="detail"
        @editAsesmen="emit('editAsesmen', 'Pemeriksaan Gigi')"
      />
      <PemeriksaanMata
        v-if="rmType == 'rawat-jalan' && rmAssesmentData.pemeriksaanMata"
        :ref="refs.pemeriksaanMata"
        method="detail"
        @editAsesmen="emit('editAsesmen', 'Pemeriksaan Mata')"
      />
      <BurnInput
        v-if="rmAssesmentData.lukaBakar"
        :ref="refs.lukaBakar"
        method="detail"
        :patientData="patientData"
        @editAsesmen="emit('editAsesmen', 'Derajat Luka Bakar (RON)')"
      />
      <CatatanHasilPenunjang
        v-if="rmAssesmentData.catatanPenunjang"
        :ref="refs.catatanHasilPenunjang"
        method="detail"
        @editAsesmen="emit('editAsesmen', 'Catatan Hasil Penunjang')"
      />
      <FormDiagnosaDokterICD10
        v-if="rmAssesmentData.diagnosisDokter?.length"
        :ref="refs.diagnosisDokter"
        method="detail"
        @editAsesmen="emit('editAsesmen', 'Diagnosis Dokter')"
      />
      <AsuhanKeperawatan
        v-if="rmAssesmentData.diagnosaPerawat"
        :ref="refs.asuhanKeperawatan"
        method="detail"
        @editAsesmen="emit('editAsesmen', 'Asuhan Keperawatan')"
      />
      <FormCatatanPerawat
        v-if="rmAssesmentData.catatanPerawat?.length"
        :ref="refs.catatanPerawat"
        :sessionUuid="sessionUuid"
        method="detail"
        @editAsesmen="emit('editAsesmen', 'Catatan Perawat')"
      />
      <InstruksiMedis
        v-if="rmAssesmentData.instruksiMedis?.length"
        :ref="refs.instruksiMedis"
        :sessionUuid="sessionUuid"
        method="detail"
        @editAsesmen="emit('editAsesmen', 'Instruksi Medis')"
      />
      <FormOrderObat
        v-if="rmAssesmentData.obatUuides?.length"
        :ref="refs.orderObat"
        method="detail"
      />
      <PemeriksaanTindakan
        v-if="rmAssesmentData.pemeriksaanTindakan?.length"
        :ref="refs.pemeriksaanTindakan"
        method="detail"
        @editAsesmen="emit('editAsesmen', 'Pemeriksaan dan Tindakan')"
      />
      <FormImplementation
        v-if="rmType == 'fisio' && rmAssesmentData.implementation"
        :ref="refs.implementation"
        method="detail"
      />
      <FormEvaluation
        v-if="rmType == 'fisio' && rmAssesmentData.evaluation"
        :ref="refs.evaluation"
        method="detail"
      />
      <FormReassesment
        v-if="rmType == 'fisio' && rmAssesmentData.reassessment"
        :ref="refs.reassessment"
        method="detail"
      />
      <!-- FIXME Belum Ada -->
      <FormOrderAlkes
        v-if="results.length"
        :ref="refs.orderAlkes"
        :rmUuid="rmUuid"
        :rmDate="rmDate"
        method="detail"
      />
      <OrderLab :ref="refs.orderLab" method="detail" :patientData="patientData" :rmType="rmType" :rmDate="rmDate" />
      <!-- Order fisioterapi masih prototipe (data contoh): tampil hanya bila modul Fisioterapi aktif. -->
      <FormOrderFisio v-if="modulAktif('fisioterapi')" :ref="refs.orderFisio" method="detail" />
      <!-- Order radiologi kunjungan (status & hasil expertise): tampil bila modul Radiologi aktif & ada order. -->
      <FormOrderRadiologi
        v-if="modulAktif('radiologi')"
        :ref="refs.orderRadiologi"
        method="detail"
        :patientData="patientData"
        :rmType="rmType"
        :rmDate="rmDate"
        :rmUuid="rmUuid"
      />
      <FormOrderPa
        v-if="modulAktif('patologi_anatomi')"
        :ref="refs.orderPa"
        method="detail"
        :patientData="patientData"
        :rmType="rmType"
        :rmDate="rmDate"
        :rmUuid="rmUuid"
      />
      <FormOrderMikro
        v-if="modulAktif('mikrobiologi')"
        :ref="refs.orderMikro"
        method="detail"
        :patientData="patientData"
        :rmType="rmType"
        :rmDate="rmDate"
        :rmUuid="rmUuid"
      />
      <FormPersetujuanPasien
        v-if="resultsPersetujan.length"
        :ref="refs.persetujuanPasien"
        :rmUuid="rmUuid"
        :patientData="patientData"
        :listPersetujuanPasien="resultsPersetujan"
        method="detail"
        @dataDeleted="getListPersetujuan" 
      />
    </div>
    <div class="flex flex-col mx-[10px]">
      <CustomButton
        @click="toggleShowAllDetailMR('hide')"
        icon="PhArrowsInLineVertical"
        class="mb-[10px]"
      />
      <CustomButton
        @click="toggleShowAllDetailMR('show')"
        icon="PhArrowsOutLineVertical"
        class=""
      />
    </div>
  </div>
</template>
