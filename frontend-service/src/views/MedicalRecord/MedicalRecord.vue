<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import DataPatient from "@/components/RekamMedis/DataPatient.vue";
import PemeriksaanFisik from "@/components/RekamMedis/PemeriksaanFisik/PemeriksaanFisik.vue";
import RMCustomSelect from "@/components/Base/RMCustomSelect.vue";
import NoData from "@/components/section/NoData.vue";
import FormAlergi from "@/components/RekamMedis/Alergi/FormAlergi.vue";
import Anamnesis from "@/components/RekamMedis/Anamnesis/Anamnesis.vue";
import FormTandaVital from "@/components/RekamMedis/TandaVital/FormTandaVital.vue";
import Antropometri from "@/components/RekamMedis/Antropometri/Antropometri.vue";
import FormAsesmenNyeri from "@/components/RekamMedis/AsesmenNyeri/FormAsesmenNyeri.vue";
import Kesadaran from "@/components/RekamMedis/Kesadaran/Kesadaran.vue";
import CatatanHasilPenunjang from "@/components/RekamMedis/CatatanHasilPenunjang/CatatanHasilPenunjang.vue";
import FormDiagnosaDokterICD10 from "@/components/RekamMedis/DiagnosaDokter/FormDiagnosaDokterICD10.vue";
import AsuhanKeperawatan from "@/components/RekamMedis/AsuhanKeperawatan/AsuhanKeperawatan.vue";
import FormCatatanPerawat from "@/components/RekamMedis/CatatanPerawat/FormCatatanPerawat.vue";
import InstruksiMedis from "@/components/RekamMedis/IntruksiMedis/InstruksiMedis.vue";
import PemeriksaanTindakan from "@/components/RekamMedis/PemeriksaanTindakan/PemeriksaanTindakan.vue";
import FormImplementation from "@/components/Fisioterapi/Implementation/FormImplementation.vue";
import FormEvaluation from "@/components/Fisioterapi/Evaluation/FormEvaluation.vue";
import FormReassesment from "@/components/Fisioterapi/Reassesment/FormReassesment.vue";
import FormOrderObat from "@/components/RekamMedis/OrderObat/AccordionOrderObat.vue";
import FormOrderAlkes from "@/components/RekamMedis/OrderAlkes/AccordionOrderAlkes.vue";
import OrderLab from "@/components/RekamMedis/OrderLab/OrderLab.vue";
import FormOrderFisio from "@/components/RekamMedis/OrderFisio/FormOrderFisio.vue";
import FormOrderRadiologi from "@/components/RekamMedis/OrderRadiologi/FormOrderRadiologi.vue";
import FormOrderMikro from "@/components/RekamMedis/OrderMikro/FormOrderMikro.vue";
import FormOrderPa from "@/components/RekamMedis/OrderPA/FormOrderPa.vue";
import FormPersetujuanPasien from "@/components/RekamMedis/PersetujuanPasien/FormPersetujuanPasien.vue";
import FormPemberianObat from "@/components/RekamMedis/FPO/FormPemberianObat.vue";
import FormPerpindahan from "@/components/RekamMedis/Perpindahan/FormPerpindahan.vue";
import RiwayatPerpindahanBed from "@/components/RekamMedis/Perpindahan/riwayatPerpindahanBed.vue";
import FormUnggahBerkas from "@/components/RekamMedis/UnggahBerkas/FormUnggahBerkas.vue";
import TandaVital from "@/components/RekamMedis/ResumeDiscarge/TandaVital.vue";
import AnamnesisDischarge from "@/components/RekamMedis/ResumeDiscarge/Anamnesis.vue";
import Edukasi from "@/components/RekamMedis/ResumeDiscarge/Edukasi.vue";
import KeadaanWaktuPulang from "@/components/RekamMedis/ResumeDiscarge/KeadaanWaktuPulang.vue";
import StatusPulang from "@/components/RekamMedis/ResumeDiscarge/StatusPulang.vue";
import PemeriksaanFisikDischarge from "@/components/RekamMedis/ResumeDiscarge/PemeriksaanFisik.vue";
import Diagnosis from "@/components/RekamMedis/ResumeDiscarge/Diagnosis.vue";
import Tindakan from "@/components/RekamMedis/ResumeDiscarge/Tindakan.vue";
import Obat from "@/components/RekamMedis/ResumeDiscarge/Obat.vue";
import ListSuratKeterangan from "@/components/RekamMedis/ListSuratKeterangan/ListSuratKeterangan.vue";
import OdontogramInput from "@/components/RekamMedis/PemeriksaanGigi/OdontogramInput.vue";
import MedicalRecordTab from "./SectionNavigator/MedicalRecordTab.vue";
import MedicalRecordNavigation from "./SectionNavigator/MedicalRecordNavigation.vue";
import MedicalRecordDetail from "./SectionContent/MedicalRecordDetail.vue";
import MedicalRecordAssesment from "./SectionContent/MedicalRecordAssesment.vue";
import SoapRingkas from "./SectionContent/SoapRingkas.vue";
import HistoriTandaVital from "@/components/RekamMedis/TandaVital/HistoriTandaVital.vue";
import type { PropType } from "vue";
import { utilsStore } from "@/stores/utils";
import { useToast } from "primevue/usetoast";
import { bagianTampil, fiturAktif, modulAktif } from "@/stores/modulFaskes";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { useRekamMedisPelayananStore } from "@/stores/rekamMedis/rekamMedisPelayanan";
import { dateToEpoch, epochToDate, formatDate } from "@/utils/Helpers";
import { createResumeMedis, createLaporanOdontogram } from "@/utils/pdf/RekamMedis";
import { useAuthStore } from "@/stores/auth";
import { createPatientLabel } from "@/utils/PdfMake";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import FormSuratVclaim from "@/views/Admisi/Section/FormSuratVclaim.vue";
import { bolehSurat } from "@/stores/bpjsVclaim";

// NOTE Store
const storeUtils = utilsStore();
const toast = useToast();

// Bagian RME (form Asesmen/Resume) mengikuti Setting › Manajemen Modul & Fitur; bagian khusus poli
// (gigi/mata) mengikuti jenis poli lokasi kunjungan.
const lokasiUuidKunjungan = computed<string>(() =>
  rekamMedisStore.openedRekamMedis?.meta?.lokasiUuid ?? props.patientData?.lokasi?.uuid ?? ""
);
const tampilAsm = (label: string) => bagianTampil("rme_asesmen", label, lokasiUuidKunjungan.value);
const tampilRsm = (label: string) => bagianTampil("rme_resume", label, lokasiUuidKunjungan.value);
const rekamMedisStore = useRekamMedisStore();
const rekamMedisPelayananStore = useRekamMedisPelayananStore();
const authStore = useAuthStore();

const emit = defineEmits(["openHistory", "refreshPatientData"]);

const props = defineProps({
  rmType: {
    type: String,
    default: "rawat-jalan",
  },
  patientData: {
    type: Object,
    required: true,
  },
  viewMode: {
    type: String as PropType<"current" | "history">,
    default: "current",
  },
  initialTab: {
    type: String,
    default: "rekam-medis"
  },
  isApprovalMode: {
    type: Boolean,
    default: false
  },
});

const dialogRM = ref(false);
const selectedTab = ref(props.initialTab);
const selectedSessionTab = ref<string | undefined>();
const selectedSessionData = ref<any>();
const historyVisitDialog = ref(false);

const listRecordDate = ref<any>([]);
const rmDate = ref("");
const rmDateData = ref<any>(null);

const selectedAssesment = ref("Alergi");
const selectedPemeriksaanFisik = ref<null | string>(null);
const selectedPemeriksaanMata = ref<null | string>(null);
const selectedSoap = ref("Subjective");
const selectedSoapier = ref("Subjective");

// NOTE Utils Function
const soapSoapierScrollContainer = ref<HTMLElement | null>(null);

const soapSoapierScrollController = (id: string) => {
  const target = document.getElementById(id);
  if (target && soapSoapierScrollContainer.value) {
    const container = soapSoapierScrollContainer.value;
    const targetRect = target.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    container.scrollTop += targetRect.top - containerRect.top;
    target.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
};

const selectedPenunjang = ref("Order Lab");

const resumeDischargeScrollContainer = ref<HTMLElement | null>(null);

const resumeDischargeScrollController = (id: string) => {
  const target = document.getElementById(id);
  if (target && resumeDischargeScrollContainer.value) {
    const container = resumeDischargeScrollContainer.value;
    const targetRect = target.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    container.scrollTop += targetRect.top - containerRect.top;
    target.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
};

const selectedSuratList = ref("Cetak Hasil Pemeriksaan");
const formPerpindahanRef = ref<any>(null);

const refs = {
  alergi: ref<any>(null),
  anamnesis: ref<any>(null),
  anamnesisIGD: ref<any>(null),
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
  persetujuanPasien: ref<any>(null),
  edukasi: ref<any>(null),
  keadaanWaktuPulang: ref<any>(null),
  statusPulang: ref<any>(null),
};

const latestTandaVitalHistory = computed(() => {
  const storeData = rekamMedisStore.openedRekamMedis;
  const tandaVitalData = storeData?.data?.tandaVital;
  if (!tandaVitalData) {
    return null;
  }

  const selectedDateStr = storeData.dates?.find((d: any) => d.isSelected)?.date;
  const dateEpoch = selectedDateStr ? dateToEpoch(new Date(selectedDateStr)) : 0; 

  let jenisKunjunganKey = 'rj'; 
  if (props.rmType === 'rawat-inap') jenisKunjunganKey = 'ri';
  else if (props.rmType === 'igd') jenisKunjunganKey = 'igd';
  else if (props.rmType === 'fisioterapi') jenisKunjunganKey = 'fisio';

  const sessionOrder = storeData.sessions?.find((s: any) => s.isSelected)?.order;

  return {
    date: dateEpoch,
    jenisKunjungan: jenisKunjunganKey,
    session: sessionOrder,
    data: tandaVitalData
  };
});

const detailedRawatInapData = ref<any>(null);

// Rencana Kontrol BPJS dari resume rawat jalan / discharge rawat inap dan SPRI dari keputusan rawat inap di RJ/IGD
// (STD-0021, fitur vclaim_rencana_kontrol; izin Admisi › Rencana Kontrol & SPRI). Surat dibuat lewat VClaim.
const dialogSurat = ref<"rencana-kontrol" | "spri" | null>(null);
const suratBpjsAktif = computed(
  () => props.viewMode !== "history" && !props.isApprovalMode && modulAktif("bpjs_fkrtl") && fiturAktif("vclaim_rencana_kontrol")
);
const bolehRencanaKontrol = computed(
  () => suratBpjsAktif.value && ["rawat-jalan", "rawat-inap"].includes(props.rmType) && bolehSurat("CREATE RENCANA KONTROL")
);
const bolehSpri = computed(() => suratBpjsAktif.value && ["rawat-jalan", "igd"].includes(props.rmType) && bolehSurat("CREATE SPRI"));
const awalSurat = computed(() => {
  const p: any = props.patientData ?? {};
  const asuransi = ([] as any[]).concat(p.patient?.insurance ?? [], p.insurance ?? []);
  const bpjs = asuransi.find((i) => /bpjs/i.test(String(i?.name ?? i?.insuranceName ?? "")));
  return {
    noKartu: bpjs?.accountNumber ?? "",
    patientUuid: p.patient?.uuid ?? p.patientUuid ?? null,
    sumber: props.rmType === "rawat-inap" ? "rawat_inap" : props.rmType === "igd" ? "igd" : "rawat_jalan",
    sumberUuid: (props.rmType === "rawat-inap" ? dataRawatInap.value?.uuid : p.uuid) ?? null,
  };
});

const handleDetailFetched = (payload: any) => {
   if (payload?.rawatInap) {
    detailedRawatInapData.value = payload.rawatInap;
  }
};

const dataRawatInap = computed(() => {
  if (detailedRawatInapData.value) {
    return detailedRawatInapData.value;
  }
  if (props.patientData?.rawatInap) {
    return props.patientData.rawatInap;
  }
  return props.patientData;
});

const toggleShowAllDetailMR = (method = "show") => {
  Object.keys(refs).forEach((key) => {
    const refKey = key as keyof typeof refs;

    const element = refs[refKey].value;

    if (element) {
      if (method == "show") {
        element.open?.();
      } else {
        element.close?.();
      }
    }
  });
};

const resetInitialDialog = () => {
  rekamMedisStore.resetOpenedRekamMedisData();
  selectedSessionTab.value = undefined;
  selectedTab.value = "rekam-medis";
  selectedAssesment.value = "Alergi";
  selectedPemeriksaanFisik.value = null;
  selectedPemeriksaanMata.value = null;
  selectedSoap.value = "Subjective";
  selectedSoapier.value = "Subjective";
};

const listHistoryData = ref<any[]>([]);
const showHistoryDialog = async () => {
  try {
    storeUtils.setLoading(true);
    const response = await rekamMedisPelayananStore.getHistory(
      props.patientData.noRm
    );
    if (response && response.payload) {
      listHistoryData.value = response.payload;
      historyVisitDialog.value = true;
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    listHistoryData.value = [];
  } finally {
    storeUtils.setLoading(false);
  }
};

const handlePrintPatientLabel = async () => {
  const visitDetailData = rekamMedisStore.openedRekamMedis?.meta;
  const patientIdentityData = props.patientData?.patient;

  if (!visitDetailData || !patientIdentityData) {
    toast.add({
      severity: "warn",
      summary: "Peringatan",
      detail: "Data pasien tidak lengkap untuk mencetak label.",
      life: 3000,
    });
    return;
  }

  const labelData = {
    patientName: patientIdentityData.name,
    noRm: patientIdentityData.noRm,
    noReg: visitDetailData.noReg || props.patientData.noReg,
    birthDate: patientIdentityData.birthDetail?.birthDate,
    patientAge: `${patientIdentityData.birthDetail?.ageYear || 0} Thn, ${patientIdentityData.birthDetail?.ageMonth || 0} Bln, ${patientIdentityData.birthDetail?.ageDay || 0} Hri`,
    gender: patientIdentityData.gender,
    address: patientIdentityData.address?.fullAddress || '-',
  };

  await createPatientLabel({ labelData: labelData });
};

// NOTE Logic Function
const setUtilsRM = () => {
  if (
    rekamMedisStore.openedRekamMedis &&
    rekamMedisStore.openedRekamMedis.dates?.length &&
    rekamMedisStore.openedRekamMedis.sessions?.length
  ) {
    listRecordDate.value = rekamMedisStore.openedRekamMedis.dates;
    listRecordDate.value.forEach((dateList: any, index: number) => {
      dateList.dateOrder = index + 1;
    });
    const tempSelectedRecord = listRecordDate.value.find(
      (dateList: any) => dateList.isSelected
    );

    if (tempSelectedRecord) {
      const selectedDate = tempSelectedRecord;
      rmDate.value = selectedDate.date;
      rmDateData.value = selectedDate;
    } else if (listRecordDate.value.length > 0) {
      const selectedDate = listRecordDate.value[0];
      rmDate.value = selectedDate.date;
      rmDateData.value = selectedDate;
    }
    const tempSelectedSession = rekamMedisStore.openedRekamMedis.sessions.find(
      (sessionList: any) => sessionList.isSelected
    );

    if (tempSelectedSession) {
      selectedSessionData.value = tempSelectedSession;
      selectedSessionTab.value = `${tempSelectedSession.order}`;
    }
  }
};

const storedRMData = computed(() => rekamMedisStore.openedRekamMedis);
watch(storedRMData, (newRM) => {
  setUtilsRM();
});

const isAllowCreateRecord = () => {
  if (Object.keys(rekamMedisStore.openedRekamMedis).length) {
    const tempDateNow = formatDate(new Date(), true);
    return rekamMedisStore.openedRekamMedis.dates.some(
      (dateList: any) => dateList.date == tempDateNow
    );
  } else return false;
};
const createRecord = async () => {
  if (!isAllowCreateRecord()) {
    try {
      storeUtils.setLoading(true);
      const response = await rekamMedisStore.createNewRecord({
        rekamMedisUuid: props.patientData.rekamMedisUuid,
        date: formatDate(new Date(), true),
      });
      if (response && response.payload) {
        rekamMedisStore.setOpenedRekamMedisData(response.payload);
      }
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      storeUtils.setLoading(false);
    }
  } else {
    toast.add({
      severity: "info",
      summary: "Info",
      detail: "Tanggal Sudah Ada",
      life: 3000,
    });
  }
};

const changeRecordData = async (selectedRecordDate: string) => {
  try {
    storeUtils.setLoading(true);
    const selectedRecordDateData = listRecordDate.value.find(
      (dateList: any) => dateList.date == selectedRecordDate
    );
    let response = await rekamMedisStore.getRekamMedis({
      rekamMedisUuid: props.patientData.rekamMedisUuid,
      dateOrder: selectedRecordDateData.dateOrder,
    });
    if (response && response.payload) {
      rekamMedisStore.setOpenedRekamMedisData(response.payload);
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

// NOTE Resume Discharge
const printResumeMedis = async () => {
  // Bagian resume bisa dimatikan per segmen (Manajemen Modul) sehingga ref-nya kosong: isi default, jangan gagal diam-diam.
  const r = (ref: any) => ref?.value ?? null;
  try {
    await createResumeMedis({
      data: {
        patientData: {
          ...props.patientData,
          jenisPelayanan:
            props.rmType == "rawat-jalan"
              ? "Rawat Jalan"
              : props.rmType == "rawat-inap"
              ? "Rawat Inap"
              : props.rmType == "igd"
              ? "IGD"
              : "Fisioterapi",
        },
        resumeData: {
          ...dataResumeMedis.value,
          statusPulangNama: r(refs.statusPulang)?.getStatusPulangNama(dataResumeMedis.value.statusPulang) ?? "-",
          edukasiName: r(refs.edukasi)?.getKondisiPulangNama(dataResumeMedis.value.edukasi) ?? "-",
          kondisiPasienPulangNama: r(refs.keadaanWaktuPulang)?.getKondisiPulangNama(dataResumeMedis.value.kondisiPasienPulang) ?? "-",
          selectedDiagnosis: r(refs.diagnosisDokter)?.printSelectedData() ?? [],
          selectedPemeriksaanFisik: r(refs.pemeriksaanFisik)?.printSelectedData() ?? [],
          selectedObat: r(refs.orderObat)?.printSelectedData() ?? [],
          selectedTindakan: r(refs.pemeriksaanTindakan)?.printSelectedData() ?? [],
        },
      },
    });
  } catch (error) {
    console.error("Gagal mencetak resume medis", error);
    toast.add({ severity: "error", summary: "Cetak resume gagal", detail: "Resume medis belum bisa dicetak. Simpan resume lalu coba lagi.", life: 5000 });
  }
};

// epoch detik; nilai tak masuk akal (mis. sisa data lama yang terkonversi ganda → tahun 1970) diganti waktu sekarang
const keEpoch = (nilai: any) => {
  const e = nilai instanceof Date ? dateToEpoch(nilai) : typeof nilai === "number" ? nilai : nilai ? dateToEpoch(new Date(nilai)) : null;
  return e && e > 1e9 ? e : nilai ? Math.floor(Date.now() / 1000) : null;
};

const submitResumeMedis = async () => {
  // jangan ubah model kalender (Date) menjadi epoch: konversi hanya di payload
  const statusPulang = segmentRMStatusPulang.value
    ? { ...segmentRMStatusPulang.value, dischargeDate: keEpoch(segmentRMStatusPulang.value.dischargeDate) }
    : {};
  const payload = {
    rekamMedisUuid: props.patientData.rekamMedisUuid,
    pelayanan:
      props.rmType == "rawat-jalan"
        ? "rj"
        : props.rmType == "rawat-inap"
        ? "ri"
        : props.rmType == "igd"
        ? "igd"
        : "fisio",
    ...segmentRMEdukasi.value,
    // backend mewajibkan string; edukasi boleh dikosongkan
    edukasi: segmentRMEdukasi.value?.edukasi ?? "",
    edukasiText: segmentRMEdukasi.value?.edukasiText ?? "",
    kondisiPasienPulang: segmentRMKondisi.value ?? "",
    ...statusPulang,
  };
  try {
    storeUtils.setLoading(true);
    await rekamMedisPelayananStore.putResumeMedis(payload);
    await fetchResumeDischargeData();
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const dischargeData = async () => {
  const dischargeDateValue = segmentRMStatusPulang.value?.dischargeDate;
  const dischargeEpoch = keEpoch(dischargeDateValue);
  try {
    storeUtils.setLoading(true);
    const res: any = await rekamMedisPelayananStore.discharge({
      pelayanan:
        props.rmType == "rawat-jalan"
          ? "rj"
          : props.rmType == "rawat-inap"
          ? "ri"
          : props.rmType == "igd"
          ? "igd"
          : "fisio",
      rekamMedisUuid: props.patientData.rekamMedisUuid,
      lokasiUuid: rekamMedisStore.openedRekamMedis.meta.lokasiUuid,
      ...(dischargeEpoch && { dischargeDate: dischargeEpoch }),
    });
    // Biaya kamar RI ditagihkan otomatis; kamar tanpa tarif (Datamaster › Tarif › Ruangan) tidak ikut tertagih.
    const tanpaTarif: string[] = res?.payload?.biayaKamar?.tanpaTarif ?? [];
    if (tanpaTarif.length > 0) {
      toast.add({
        severity: "warn",
        summary: "Biaya kamar belum tertagih",
        detail: `Tarif ruangan belum diatur untuk: ${tanpaTarif.join(", ")}. Atur di Datamaster › Tarif › Ruangan lalu discharge ulang.`,
        life: 10000,
      });
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

watch(
  () => selectedSessionTab.value,
  async (newSession, oldSession) => {
    if (
      rmDateData.value &&
      oldSession &&
      newSession &&
      oldSession != "plus" &&
      newSession != "plus" &&
      props.patientData.rekamMedisUuid
    ) {
      try {
        storeUtils.setLoading(true);
        selectedSessionData.value =
          rekamMedisStore.openedRekamMedis.sessions.find(
            (sessionList: any) => sessionList.order == newSession
          );
        let response = await rekamMedisStore.getRekamMedis({
          rekamMedisUuid: props.patientData.rekamMedisUuid,
          dateOrder: rmDateData.value.dateOrder,
          sessionOrder: parseInt(newSession ?? ""),
        });
        if (response && response.payload) {
          rekamMedisStore.setOpenedRekamMedisData(response.payload);
        }
      } catch (error) {
        console.error("Failed to fetch data", error);
      } finally {
        storeUtils.setLoading(false);
      }
    }
  }
);

const dataResumeMedis = ref<any>({});
const segmentRMEdukasi = ref<{ edukasi: string; edukasiText: string }>();
const segmentRMKondisi = ref<string>();
const segmentRMStatusPulang = ref<{
  statusPulang: string;
  statusPulangKeterangan: string;
  dischargeDate: any;
  isInternal: boolean;
  rujukInternal: string;
  rujukEksternal: string;
  instruksiTindakLanjut: string;
  tujuanRujuk: string;
  tujuanRujukLainnya: string;
  transportRujuk: string;
  transportRujukLainnya: string;
  instruksiNoDarurat: string;
}>();
const fetchResumeDischargeData = async () => {
  const responseResumeMedis = await rekamMedisPelayananStore.getResumeMedis({
    rekamMedisUuid: props.patientData.rekamMedisUuid,
    pelayanan:
      props.rmType == "rawat-jalan"
        ? "rj"
        : props.rmType == "rawat-inap"
        ? "ri"
        : props.rmType == "igd"
        ? "igd"
        : "fisio",
  });
  if (responseResumeMedis && responseResumeMedis.payload) {
    dataResumeMedis.value = responseResumeMedis.payload;
    segmentRMEdukasi.value = {
      edukasi: dataResumeMedis.value.edukasi,
      edukasiText: dataResumeMedis.value.edukasiText,
    };
    segmentRMKondisi.value = dataResumeMedis.value.kondisiPasienPulang;
    const existingDate =
      Number(dataResumeMedis.value.dischargeDate) > 1e9 ? epochToDate(dataResumeMedis.value.dischargeDate) : new Date();
    segmentRMStatusPulang.value = {
      statusPulang: dataResumeMedis.value.statusPulang,
      statusPulangKeterangan: dataResumeMedis.value.statusPulangKeterangan,
      dischargeDate: existingDate,
      isInternal: dataResumeMedis.value.isInternal,
      rujukInternal: dataResumeMedis.value.rujukInternal,
      rujukEksternal: dataResumeMedis.value.rujukEksternal,
      instruksiTindakLanjut: dataResumeMedis.value.instruksiTindakLanjut,
      tujuanRujuk: dataResumeMedis.value.tujuanRujuk,
      tujuanRujukLainnya: dataResumeMedis.value.tujuanRujukLainnya,
      transportRujuk: dataResumeMedis.value.transportRujuk,
      transportRujukLainnya: dataResumeMedis.value.transportRujukLainnya,
      instruksiNoDarurat: dataResumeMedis.value.instruksiNoDarurat,
    };
  } else dataResumeMedis.value = {};
};

// NOTE FPO Data
const dataFPO = ref<any[]>([]);
const fpoDate = ref<any>(new Date());
const changeFPODate = (days: number) => {
  if (!fpoDate.value) return;
  
  const date = new Date(fpoDate.value);
  date.setDate(date.getDate() + days);
  fpoDate.value = date;
};

const fetchFPOData = async () => {
  const formattedDate = formatDate(fpoDate.value, true); 

  if (!props.patientData.rekamMedisUuid || !formattedDate) {
    console.warn("Missing rmUuid or date for fetching FPO");
    dataFPO.value = [];
    return;
  }
  try {
    storeUtils.setLoading(true);
    const response = await rekamMedisStore.getAllFPO({
      rekamMedisUuid: props.patientData.rekamMedisUuid,
      date: formattedDate,
    });
    if (response && response.payload) {
      dataFPO.value = response.payload;
    } else {
      dataFPO.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch FPO data", error);
    dataFPO.value = [];
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Gagal mengambil data FPO",
      life: 3000,
    });
  } finally {
    storeUtils.setLoading(false);
  }
};

watch(fpoDate, async () => {
  if (selectedTab.value == "fpo") {
    await fetchFPOData();
  }
});

const updateOdontogramPrintData = () => {
  const dataGigi = rekamMedisStore.openedRekamMedis?.data?.pemeriksaanGigi;
  if (dataGigi && refs.pemeriksaanGigi.value) {
    const rawItems = dataGigi.odontogramItems || [];
    const mappedItems = rawItems.map((item: any) => ({
      noGigi: item.noGigi,
      keadaanGigi: item.keadaanGigi || []
    }));
    refs.pemeriksaanGigi.value.setData(mappedItems);
  }
};

watch(selectedSuratList, async (newVal) => {
  if (newVal === 'Cetak Hasil Pemeriksaan' && selectedTab.value === 'cetak-hasil-surat') {
    await nextTick();
    updateOdontogramPrintData();
  }
});

watch(
  () => selectedTab.value,
  async (newTab, oldTab) => {
    if (newTab == "cetak-hasil-surat" && selectedSuratList.value == "Cetak Hasil Pemeriksaan") {
      await nextTick();
      updateOdontogramPrintData();
    }
    if (newTab == "fpo") {
      if (rmDate.value) {
        fpoDate.value = new Date(rmDate.value);
      }
      await fetchFPOData();
    }
    if (newTab == "resume-discharge") {
      await fetchResumeDischargeData();
    } else if (newTab == "fpo") {
      await fetchFPOData();
    }
  }
);

const handleHistoryClick = (historyItem: any) => {
  emit("openHistory", historyItem);
  historyVisitDialog.value = false;
};

// NOTE Cetak Odontogram
const handlePrintOdontogram = async (payload: { image: string; items: any[] }) => {
  const pemeriksaanGigiData = rekamMedisStore.openedRekamMedis?.data?.pemeriksaanGigi || {};
  
  const namaDokter = props.patientData.practitioner?.pegawai?.name 
    ? (props.patientData.practitioner.pegawai.firstTitle || '') + ' ' + 
      props.patientData.practitioner.pegawai.name + ' ' + 
      (props.patientData.practitioner.pegawai.lastTitle || '')
    : "-";

  const jenisPelayanan = props.rmType == "rawat-jalan"
      ? "Rawat Jalan"
      : props.rmType == "rawat-inap"
      ? "Rawat Inap"
      : props.rmType == "igd"
      ? "IGD"
      : "Fisioterapi";

  const tanggalKeluar = dataResumeMedis.value?.dischargeDate 
    ? dataResumeMedis.value.dischargeDate 
    : (rmDate.value ? new Date(rmDate.value).getTime() / 1000 : null);

  await createLaporanOdontogram({
    data: {
      ...pemeriksaanGigiData,
      petugas: namaDokter
    },
    patientData: {
      ...props.patientData,
      jenisPelayanan: jenisPelayanan 
    },
    odontogramImage: payload.image,
    odontogramItems: payload.items,
    headerData: {
      dischargeDate: tanggalKeluar
    }
  });
};

// NOTE Exposed Function
// SOAP Ringkas (fitur rme_soap_ringkas, praktik mandiri): tab utama RME rawat jalan yang sedang berjalan.
const soapRingkasAktif = computed(
  () => props.rmType == "rawat-jalan" && props.viewMode != "history" && !props.isApprovalMode && fiturAktif("rme_soap_ringkas")
);

// Saat SOAP Ringkas aktif, tab S.O.A.P lengkap redundan (data yang sama) → disembunyikan. Tab Asesmen
// tetap ada hanya di poli dengan pemeriksaan khusus (odontogram gigi, pemeriksaan mata).
const sembunyikanSoapLengkap = computed(() => soapRingkasAktif.value);
const sembunyikanAsesmen = computed(
  () => soapRingkasAktif.value && !tampilAsm("Pemeriksaan Gigi") && !tampilAsm("Pemeriksaan Mata")
);

const showDialogRM = () => {
  dialogRM.value = true;
  if (props.initialTab) {
    selectedTab.value = props.initialTab;
  }
  if (soapRingkasAktif.value && selectedTab.value == "rekam-medis") {
    selectedTab.value = "soap-ringkas";
  }
};

const tutupSetelahSelesai = () => {
  dialogRM.value = false;
  resetInitialDialog();
};

defineExpose({ showDialogRM });

onMounted(() => {
  console.log("Data Pasien yang Diterima di MedicalRecord.vue:", props.patientData);
});
</script>

<template>
  <div>
    <CustomDialog
      v-model:visible="dialogRM"
      class=""
      fullScreen
      @closeDialog="resetInitialDialog"
    >
      <template #header>
        <div class="flex justify-between">
          <div class="flex my-auto">
            <span>
              {{ props.viewMode === 'history' ? 'Riwayat Pemeriksaan' : 'Detail Pasien' }}
            </span>
            <span class="mx-[10px]"> | </span>
            <span>
              {{
                rmType == "rawat-jalan"
                  ? "Rawat Jalan"
                  : rmType == "rawat-inap"
                  ? "Rawat Inap"
                  : rmType == "igd"
                  ? "IGD"
                  : "Fisioterapi"
              }}
            </span>
            <PhArrowRight :size="18" class="my-auto mx-[10px]" weight="bold" />
            <div
              class="bg-white rounded-lg text-opensimrs-300 px-[10px] mr-[10px]"
            >
              {{ patientData.patient?.noRm }}
            </div>
            {{ patientData.patient?.name }}
          </div>
          <CustomButton
            @click="handlePrintPatientLabel"
            icon="PhPrinter"
            label="Cetak Label"
            class="mr-5"
            backgroundColor="bg-white"
            textColor="text-opensimrs-300"
          />
        </div>
      </template>
      <template #body>
        <div class="pt-[10px] h-full overflow-hidden flex flex-col">
          <DataPatient
            :rmType="rmType"
            :patientData="patientData"
            :summaryData="rekamMedisStore.openedRekamMedis.summary"
          />
          <div class="flex flex-col overflow-hidden grow">
            <div class="flex justify-between mb-4">
              <div
                v-if="rmType == 'rawat-inap' || rmType == 'igd'"
                class="flex mr-5"
              >
                <RMCustomSelect
                  v-model="rmDate"
                  @update:model-value="changeRecordData"
                  :options="listRecordDate"
                  class="mr-[10px]"
                  optionLabel="date"
                  optionValue="date"
                />
                <CustomButton
                  icon="PhPlus"
                  size="small"
                  class="!rounded-md"
                  @click="createRecord"
                />
              </div>
              <div class="flex">
                <PhStethoscope
                  :size="24"
                  weight="bold"
                  class="text-opensimrs-300 mr-[10px]"
                />
                <span class="font-semibold leading-6 text-grey-500 text-MD">
                  Pemeriksaan
                </span>
              </div>
              <CustomButton
                @click="showHistoryDialog"
                icon="PhClockCounterClockwise"
                label="Riwayat"
                size="small"
                class="!rounded-md ml-auto"
              />
            </div>
            <MedicalRecordTab
              v-if="!isApprovalMode"
              v-model:selected-tab="selectedTab"
              v-model:selected-session-tab="selectedSessionTab"
              :rmType="rmType"  
              :selectedRecord="rmDateData"
              :sessions="rekamMedisStore.openedRekamMedis.sessions"
              :rmUuid="patientData.rekamMedisUuid"
              :view-mode="viewMode"
              :sembunyikanSoap="sembunyikanSoapLengkap"
              :sembunyikanAsesmen="sembunyikanAsesmen"
            />
            <MedicalRecordNavigation
              v-if="!isApprovalMode"
              :selectedTab="selectedTab"
              v-model:selected-assesment="selectedAssesment"
              v-model:selected-soap="selectedSoap"
              v-model:selected-soapier="selectedSoapier"
              v-model:selected-penunjang="selectedPenunjang"
              v-model:selected-surat-list="selectedSuratList"
              @soap-soapier-jump="soapSoapierScrollController"
              @resume-discharge-jump="resumeDischargeScrollController"
              :rmType="rmType"
              :lokasiUuid="lokasiUuidKunjungan"
            />

            <MedicalRecordDetail
              v-if="selectedTab == 'rekam-medis'"
              :rmType="rmType"
              :rmAssesmentData="rekamMedisStore.openedRekamMedis.data"
              :sessionUuid="selectedSessionData.id"
              @editAsesmen="
                (data, editedPemeriksaanFisik) => {
                  selectedTab = 'asesmen';
                  selectedAssesment = data;
                  selectedPemeriksaanFisik = editedPemeriksaanFisik ?? null;
                }
              "
              @editAsesmenMata="
                (data, editedPemeriksaanMata) => {
                  selectedTab = 'asesmen';
                  selectedAssesment = data;
                  selectedPemeriksaanMata = editedPemeriksaanMata ?? null;
                }
              "
              :patientData="patientData"
              :rmUuid="patientData.rekamMedisUuid"
              :rmDate="rmDate"
            />

            <SoapRingkas
              v-if="selectedTab == 'soap-ringkas' && soapRingkasAktif"
              :rmUuid="patientData.rekamMedisUuid"
              :sessionUuid="selectedSessionData.id"
              :patientData="patientData"
              :lokasiUuid="lokasiUuidKunjungan"
              @refreshPatientData="emit('refreshPatientData')"
              @selesai="tutupSetelahSelesai"
            />

            <MedicalRecordAssesment
              v-if="selectedTab == 'asesmen'"
              :selectedAssesment="selectedAssesment"
              :selectedPemeriksaanFisik="selectedPemeriksaanFisik"
              :selectedPemeriksaanMata="selectedPemeriksaanMata"
              :rmUuid="patientData.rekamMedisUuid"
              :sessionUuid="selectedSessionData.id"
              :asesmenData="rekamMedisStore.openedRekamMedis.data"
              :isLatest="rekamMedisStore.openedRekamMedis.isLatest"
              :patientData="patientData"
              @refreshPatientData="emit('refreshPatientData')"
            />

            <div
              v-if="selectedTab == 'soap' || selectedTab == 'soapier'"
              class="flex mt-5 overflow-auto"
              ref="soapSoapierScrollContainer"
            >
              <div class="overflow-x-hidden grow">
                <div
                  v-if="
                    (selectedTab == 'soap' && selectedSoap == 'Subjective') ||
                    (selectedTab == 'soapier' &&
                      selectedSoapier == 'Subjective')
                  "
                >
                  <FormAlergi
                    v-if="tampilAsm('Alergi')"
                    id="Alergi"
                    :ref="refs.alergi"
                    method="form"
                    class="mb-[10px]"
                    :rmUuid="patientData?.rekamMedisUuid" :sessionUuid="selectedSessionData?.id" :patientData="patientData"
                  />
                  <Anamnesis
                    v-if="tampilAsm('Anamnesis')"
                    id="Anamnesis"
                    :ref="refs.anamnesis"
                    method="form"
                    class=""
                    :rmUuid="patientData.rekamMedisUuid"
                    :sessionUuid="selectedSessionData.id"
                  />
                </div>

                <div
                  v-if="
                    (selectedTab == 'soap' && selectedSoap == 'Objective') ||
                    (selectedTab == 'soapier' && selectedSoapier == 'Objective')
                  "
                >
                  <FormTandaVital
                    v-if="tampilAsm('Tanda Vital')"
                    id="Tanda Vital"
                    :ref="refs.tandaVital"
                    :rmUuid="patientData.rekamMedisUuid"
                    :sessionUuid="selectedSessionData.id"
                    method="form"
                    class="mb-[10px]"
                  />
                  <Antropometri
                    v-if="tampilAsm('Antropometri')"
                    id="Antropometri"
                    :ref="refs.antropometri"
                    method="form"
                    class="mb-[10px]"
                    :rmUuid="patientData.rekamMedisUuid"
                    :sessionUuid="selectedSessionData.id"
                  />
                  <FormAsesmenNyeri
                    v-if="tampilAsm('Asesmen Nyeri')"
                    id="Asesmen Nyeri"
                    :ref="refs.asesmenNyeri"
                    method="form"
                    class="mb-[10px]"
                    :rmUuid="patientData.rekamMedisUuid"
                    :sessionUuid="selectedSessionData.id"
                  />
                  <Kesadaran
                    v-if="tampilAsm('Kesadaran')"
                    id="Kesadaran"
                    :ref="refs.kesadaran"
                    method="form"
                    class="mb-[10px]"
                    :rmUuid="patientData.rekamMedisUuid"
                    :sessionUuid="selectedSessionData.id"
                  />
                  <PemeriksaanFisik
                    v-if="tampilAsm('Pemeriksaan Fisik')"
                    id="Pemeriksaan Fisik"
                    :ref="refs.pemeriksaanFisik"
                    :rmUuid="patientData.rekamMedisUuid"
                    :sessionUuid="selectedSessionData.id"
                    class="mb-[10px]"
                    :patientData="patientData"
                  />
                  <CatatanHasilPenunjang
                    v-if="tampilAsm('Catatan Hasil Penunjang')"
                    id="Catatan Hasil Penunjang"
                    :ref="refs.catatanHasilPenunjang"
                    method="form"
                    class=""
                    :rmUuid="patientData.rekamMedisUuid"
                    :sessionUuid="selectedSessionData.id"
                  />
                </div>

                <div
                  v-if="
                    (selectedTab == 'soap' && selectedSoap == 'Assesment') ||
                    (selectedTab == 'soapier' && selectedSoapier == 'Assesment')
                  "
                >
                  <FormDiagnosaDokterICD10
                    v-if="tampilAsm('Diagnosis Dokter')"
                    id="Diagnosis Dokter"
                    :ref="refs.diagnosisDokter"
                    :rmUuid="patientData.rekamMedisUuid"
                    :sessionUuid="selectedSessionData.id"
                    method="form"
                    class="mb-[10px]"
                  />
                  <AsuhanKeperawatan
                    v-if="tampilAsm('Asuhan Keperawatan')"
                    id="Asuhan Keperawatan"
                    :ref="refs.asuhanKeperawatan"
                    method="form"
                    class=""
                    :rmUuid="patientData.rekamMedisUuid"
                    :sessionUuid="selectedSessionData.id"
                  />
                </div>

                <div
                  v-if="
                    (selectedTab == 'soap' && selectedSoap == 'Plan') ||
                    (selectedTab == 'soapier' && selectedSoapier == 'Plan')
                  "
                >
                  <InstruksiMedis
                    v-if="tampilAsm('Instruksi Medis')"
                    id="Instruksi Medis"
                    :ref="refs.instruksiMedis"
                    :rmUuid="patientData.rekamMedisUuid"
                    :sessionUuid="selectedSessionData.id"
                    method="form"
                    class="mb-[10px]"
                  />
                  <FormCatatanPerawat
                    v-if="tampilAsm('Catatan Perawat')"
                    id="Catatan Perawat"
                    :ref="refs.catatanPerawat"
                    :rmUuid="patientData.rekamMedisUuid"
                    :sessionUuid="selectedSessionData.id"
                    method="form"
                    class="mb-[10px]"
                  />
                  <FormOrderObat
                    id="Order Obat"
                    :ref="refs.orderObat"
                    :rmType="rmType"
                    :patientData="patientData"
                    :rmUuid="patientData.rekamMedisUuid"
                    :sessionUuid="selectedSessionData.id"
                    method="form"
                    class="mb-[10px]"
                  />
                  <PemeriksaanTindakan
                    v-if="tampilAsm('Pemeriksaan dan Tindakan')"
                    id="Pemeriksaan dan Tindakan"
                    :ref="refs.pemeriksaanTindakan"
                    :rmUuid="patientData.rekamMedisUuid"
                    :sessionUuid="selectedSessionData.id"
                    method="form"
                    class=""
                    @refreshPatientData="emit('refreshPatientData')"
                  />
                </div>

                <div v-if="selectedTab == 'soapier' && selectedSoapier == 'I'">
                  <FormImplementation
                    :ref="refs.implementation"
                    method="form"
                    :rmUuid="patientData.rekamMedisUuid"
                    :sessionUuid="selectedSessionData.id"
                  />
                </div>

                <div v-if="selectedTab == 'soapier' && selectedSoapier == 'E'">
                  <FormEvaluation
                    :ref="refs.evaluation"
                    method="form"
                    :rmUuid="patientData.rekamMedisUuid"
                    :sessionUuid="selectedSessionData.id"
                  />
                </div>

                <div v-if="selectedTab == 'soapier' && selectedSoapier == 'R'">
                  <FormReassesment
                    :ref="refs.reassessment"
                    method="form"
                    :rmUuid="patientData.rekamMedisUuid"
                    :sessionUuid="selectedSessionData.id"
                  />
                </div>
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

            <div v-if="selectedTab == 'penunjang'" class="overflow-auto">
              <OrderLab
                v-if="selectedPenunjang == 'Order Lab'"
                method="form"
                initialState="0"
                :patientData="patientData"
                :rmType="rmType"
                :rmDate="rmDate"
              />
              <FormOrderFisio
                v-if="selectedPenunjang == 'Order Fisio' && modulAktif('fisioterapi')"
                method="form"
                initialState="0"
                :patientData="patientData"
              />
              <FormOrderRadiologi
                v-if="selectedPenunjang == 'Order Radiologi' && modulAktif('radiologi')"
                method="form"
                initialState="0"
                :patientData="patientData"
                :rmType="rmType"
                :rmDate="rmDate"
              />
              <FormOrderMikro
                v-if="selectedPenunjang == 'Order Mikrobiologi' && modulAktif('mikrobiologi')"
                method="form"
                initialState="0"
                :patientData="patientData"
                :rmType="rmType"
                :rmDate="rmDate"
              />
              <FormOrderPa
                v-if="selectedPenunjang == 'Order Patologi Anatomi' && modulAktif('patologi_anatomi')"
                method="form"
                initialState="0"
                :patientData="patientData"
                :rmType="rmType"
                :rmDate="rmDate"
              />
            </div>

            <div v-if="selectedTab == 'alkes'" class="overflow-auto mt-[10px]">
              <FormOrderAlkes
                method="form"
                initialState="0"
                :rmType="rmType"
                :patientData="patientData"
                :rmUuid="patientData.rekamMedisUuid"
                :rmDate="rmDate"
              />
            </div>

            <div
              v-if="selectedTab == 'inform-consent'"
              class="overflow-auto mt-[10px]"
            >
              <FormPersetujuanPasien
                method="form"
                initialState="0"
                :rmUuid="patientData.rekamMedisUuid"
                :patientData="patientData"
              />
            </div>

            <div v-if="selectedTab == 'fpo'" class="overflow-auto mt-[10px]">
              <div class="flex justify-between items-center mb-4 px-1">
                <span class="text-lg font-semibold text-gray-800">
                  Form Pemberian Obat (FPO)
                </span>
                
                <div class="flex items-center gap-2">
                  
                  <button 
                    @click="changeFPODate(-1)"
                    class="h-8 w-8 flex items-center justify-center border-2 border-opensimrs-300 rounded-lg bg-white hover:bg-opensimrs-50 transition-colors"
                  >
                    <PhCaretLeft weight="bold" :size="20" class="text-opensimrs-300" />
                  </button>

                  <div class="w-64">
                    <InputGroup>
                      <InputGroupAddon class="h-8 border-2 border-r-0 rounded-l-lg border-opensimrs-300 bg-white p-0 flex justify-center items-center px-2">
                        <PhCalendarDots weight="fill" :size="20" class="text-opensimrs-300" />
                      </InputGroupAddon>
                      <DatePicker
                        v-model="fpoDate"
                        dateFormat="dd-mm-yy"
                        placeholder="Pilih Tanggal"
                        :maxDate="new Date()"
                        :manualInput="false"
                        :pt="{
                          root: { class: 'w-full' },
                          pcInputText: {
                            root: {
                              class: 'h-8 border-2 border-l-0 rounded-r-lg border-opensimrs-300 text-opensimrs-300 font-semibold text-sm w-full shadow-none focus:ring-0'
                            }
                          }
                        }"
                      />
                    </InputGroup>
                  </div>

                  <button 
                    @click="changeFPODate(1)"
                    :disabled="new Date(fpoDate).setHours(0,0,0,0) >= new Date().setHours(0,0,0,0)"
                    class="h-8 w-8 flex items-center justify-center border-2 border-opensimrs-300 rounded-lg bg-white hover:bg-opensimrs-50 transition-colors"
                  >
                    <PhCaretRight weight="bold" :size="20" :class="new Date(fpoDate).setHours(0,0,0,0) >= new Date().setHours(0,0,0,0) ? 'text-grey-400' : 'text-opensimrs-300'" />
                  </button>

                </div>
              </div>
              
              <FormPemberianObat
                method="form"
                initialState="0"
                :fpoData="dataFPO"
                :recordDate="formatDate(fpoDate, true)" 
                @refresh-data="fetchFPOData"
              />
            </div>

            <div
              v-if="selectedTab == 'perpindahan'"
              class="overflow-auto mt-[10px]"
            >
              <FormPerpindahan
                ref="formPerpindahanRef"
                :method="isApprovalMode ? 'detail' : 'form'"
                initialState="0"
                class="mb-[10px]"
                :patientData="patientData"
                :isDetail="isApprovalMode"
                @detail-fetched="handleDetailFetched" 
              />
              <div class="mb-[10px]">
                <HistoriTandaVital
                  v-if="latestTandaVitalHistory"
                  :history="latestTandaVitalHistory"
                  layout="flat"
                />
                <NoData v-else message="Belum ada data Tanda Vital untuk sesi ini." />
              </div>
              <RiwayatPerpindahanBed 
                method="form" 
                initialState="0" 
                class="" 
                :uuidRawatInap="dataRawatInap?.uuid"
              />

              <div v-if="!isApprovalMode" class="flex items-end justify-end gap-3 mt-5">
                <CustomButton
                  @click="formPerpindahanRef?.resetForm()"
                  label="Reset"
                  textColor="text-[#9DA4B1]"
                  backgroundColor="bg-transparent"
                  borderColor="border-2 border-[#9DA4B1]"
                />
                <CustomButton
                  label="Simpan"
                  @click="formPerpindahanRef?.onSubmit()"
                />
              </div>
            </div>

            <div
              v-if="selectedTab == 'unggah-berkas'"
              class="overflow-auto mt-[10px]"
            >
              <FormUnggahBerkas
                method="form"
                initialState="0"
                :rmUuid="patientData.rekamMedisUuid"
                :rmType="rmType"
              />
            </div>

            <div v-if="selectedTab == 'resume-discharge'" class="overflow-auto">
              <div
                class="overflow-auto mt-[10px] flex"
                ref="resumeDischargeScrollContainer"
              >
                <div class="overflow-auto grow">
                  <TandaVital
                    v-if="tampilRsm('Tanda Vital')"
                    id="Tanda Vital"
                    :ref="refs.tandaVital"
                    :tandaVitalData="dataResumeMedis.tandaVitalAwal"
                    method="form"
                    initialState="0"
                    class="mb-[10px]"
                  />
                  <AnamnesisDischarge
                    v-if="tampilRsm('Ringkasan Riwayat Penyakit')"
                    id="Ringkasan Riwayat Penyakit"
                    :ref="refs.anamnesis"
                    :anamnesisData="dataResumeMedis.anamnesis"
                    method="form"
                    initialState="0"
                    class="mb-[10px]"
                  />
                  <Edukasi
                    v-if="tampilRsm('Edukasi')"
                    id="Edukasi"
                    :ref="refs.edukasi"
                    v-model="segmentRMEdukasi"
                    method="form"
                    initialState="0"
                    class="mb-[10px]"
                  />
                  <KeadaanWaktuPulang
                    v-if="tampilRsm('Keadaan Waktu Pulang')"
                    id="Keadaan Waktu Pulang"
                    :ref="refs.keadaanWaktuPulang"
                    v-model="segmentRMKondisi"
                    :tandaVitalPulangData="dataResumeMedis.tandaVitalPulang"
                    method="form"
                    initialState="0"
                    class="mb-[10px]"
                  />
                  <StatusPulang
                    v-if="tampilRsm('Status Pulang')"
                    id="Status Pulang"
                    :ref="refs.statusPulang"
                    v-model="segmentRMStatusPulang"
                    method="form"
                    initialState="0"
                    class="mb-[10px]"
                  />
                  <PemeriksaanFisikDischarge
                    v-if="tampilRsm('Pemeriksaan Fisik')"
                    id="Pemeriksaan Fisik"
                    :ref="refs.pemeriksaanFisik"
                    :pemeriksaanFisikData="dataResumeMedis.pemeriksaanFisik"
                    method="form"
                    initialState="0"
                    class="mb-[10px]"
                  />
                  <Diagnosis
                    v-if="tampilRsm('Diagnosis')"
                    id="Diagnosis"
                    :ref="refs.diagnosisDokter"
                    :diagnosisData="dataResumeMedis.diagnosaDokter"
                    method="form"
                    initialState="0"
                    class="mb-[10px]"
                  />
                  <Tindakan
                    v-if="tampilRsm('Tindakan')"
                    id="Tindakan"
                    :ref="refs.pemeriksaanTindakan"
                    :tindakanData="dataResumeMedis.pemeriksaanTindakan"
                    method="form"
                    initialState="0"
                    class="mb-[10px]"
                  />
                  <Obat
                    v-if="tampilRsm('Obat')"
                    id="Obat"
                    :ref="refs.orderObat"
                    :obatData="dataResumeMedis.obatUuides || []"
                    method="form"
                    initialState="0"
                    class=""
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
              <hr class="my-5" />
              <div class="flex justify-between pr-[60px]">
                <div class="flex gap-[10px]">
                  <CustomButton
                    @click="printResumeMedis"
                    icon="PhPrinter"
                    label="Cetak Resume Medis"
                  />
                  <CustomButton v-if="bolehRencanaKontrol" icon="PhCalendarCheck" label="Rencana Kontrol BPJS" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogSurat = 'rencana-kontrol'" />
                  <CustomButton v-if="bolehSpri" icon="PhBed" label="SPRI BPJS" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogSurat = 'spri'" />
                </div>
                <div class="flex">
                  <CustomButton
                    @click="submitResumeMedis"
                    label="Simpan Resume Medis"
                    class="mr-[10px]"
                  />
                  <CustomButton
                    @click="dischargeData"
                    label="Discharge"
                    background-color="bg-danger-300"
                  />
                </div>
              </div>
            </div>

            <div
              v-if="selectedTab == 'cetak-hasil-surat'"
              class="flex overflow-auto"
            >
              <div
                v-if="selectedSuratList == 'Cetak Hasil Pemeriksaan'"
                class="flex overflow-auto grow"
              >
                <div class="overflow-auto grow">
                  <!-- Odontogram hanya untuk poli Gigi & Mulut; hasil lab hanya bila fitur Order Penunjang aktif -->
                  <OdontogramInput v-if="tampilAsm('Pemeriksaan Gigi')" :ref="refs.pemeriksaanGigi" method="print" @print="handlePrintOdontogram"/>
                  <OrderLab
                    v-if="fiturAktif('rme_penunjang')"
                    :ref="refs.orderLab"
                    class="mt-5"
                    method="detail"
                    :patientData="patientData"
                    :rmType="rmType"
                    :rmDate="rmDate"
                  />
                  <!-- Riwayat penunjang pasien (kunjungan ini di atas): cetak hasil radiologi, jadwal & asuhan terapi -->
                  <FormOrderRadiologi
                    v-if="modulAktif('radiologi')"
                    class="mt-5"
                    method="detail"
                    riwayat
                    initialState="0"
                    :patientData="patientData"
                    :rmType="rmType"
                    :rmDate="rmDate"
                  />
                  <FormOrderPa
                    v-if="modulAktif('patologi_anatomi')"
                    class="mt-5"
                    method="detail"
                    riwayat
                    initialState="0"
                    :patientData="patientData"
                    :rmType="rmType"
                    :rmDate="rmDate"
                  />
                  <FormOrderMikro
                    v-if="modulAktif('mikrobiologi')"
                    class="mt-5"
                    method="detail"
                    riwayat
                    initialState="0"
                    :patientData="patientData"
                    :rmType="rmType"
                    :rmDate="rmDate"
                  />
                  <FormOrderFisio v-if="modulAktif('fisioterapi')" class="mt-5" method="detail" initialState="0" :patientData="patientData" riwayat />
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
              <ListSuratKeterangan
                v-if="selectedSuratList == 'Surat Keterangan'"
                :patient-data="patientData"
                :rmType="rmType"
                :lokasi-uuid="lokasiUuidKunjungan"
                :view-mode="viewMode"
                method="form"
                initialState="0"
                class="grow"
              />
            </div>
          </div>
        </div>
      </template>
    </CustomDialog>
    <CustomDialog
      class=""
      v-model:visible="historyVisitDialog"
      position="bottomright"
      headerHeight="h-5"
      width="350px"
      closeIcon="PhTextIndent"
      dismissableMask
    >
      <template #header>
        <div class="flex">
          <PhClockCounterClockwise
            color="white"
            :size="20"
            weight="bold"
            class="my-auto"
          />
          <span class="ml-[10px] text-normal"> Riwayat Kunjungan</span>
        </div>
      </template>
      <template #body>
        <div class="h-[60vh] text-SM py-[10px]">
          <div v-for="history in listHistoryData">
            <div
            class="px-[10px] py-[5px] cursor-pointer hover:bg-opensimrs-50 rounded-lg"
            @click="handleHistoryClick(history)"
          >
              <div class="font-bold">
                {{
                  history.statusRj
                    ? "Rawat Jalan"
                    : history.statusRi
                    ? "Rawat Inap"
                    : history.statusIgd
                    ? "IGD"
                    : ""
                }}
                {{ history.lokasi ? "- " + history.lokasi.name : "" }}
                <CustomChip
                  v-if="history.paymentMethod == 1"
                  label="TUNAI"
                  bgColor="bg-mint-50"
                  text-color="text-mint-300"
                  border-color="border-mint-300"
                  :showCheckedIcon="false"
                  customClass="h-5 ml-[5px]"
                />
                <CustomChip
                  v-else
                  :showCheckedIcon="false"
                  label="BPJS"
                  bgColor="bg-warning-50"
                  textColor="text-warning-300"
                  borderColor="border-warning-300"
                  customClass="h-5 ml-[5px]"
                />
              </div>
              <div class="flex">
                <DoctorIcon class="text-[#79808F] mr-1" :size="16" />
                <div>
                  {{
                    `${history?.practitioner?.pegawai?.firstTitle} ${history?.practitioner?.pegawai?.name} ${history?.practitioner?.pegawai?.lastTitle}`
                  }}
                </div>
              </div>
              <div class="flex text-[#5E646F">
                <div>Tanggal</div>
                <ArrowRightBrokenIcon class="mx-3 my-auto text-success-300" />
                <div>{{ epochToDate(history.tanggalDaftar, "dateTime") }}</div>
              </div>
            </div>
            <hr class="my-[10px]" />
          </div>
        </div>
      </template>
      <template #customCloseIcon>
        <MenuOpenIcon class="text-white" />
      </template>
    </CustomDialog>
    <Dialog
      :visible="!!dialogSurat"
      modal
      :header="dialogSurat === 'spri' ? 'SPRI BPJS (Surat Perintah Rawat Inap)' : 'Rencana Kontrol BPJS'"
      :style="{ width: '900px' }"
      @update:visible="dialogSurat = null"
    >
      <FormSuratVclaim v-if="dialogSurat" :jenis="dialogSurat" mode="buat" :awal="awalSurat" @selesai="dialogSurat = null" @batal="dialogSurat = null" />
    </Dialog>
  </div>
</template>