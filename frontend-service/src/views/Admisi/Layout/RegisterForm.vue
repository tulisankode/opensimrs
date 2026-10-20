<script setup lang="ts">
import type { MenuItem } from "primevue/menuitem";
import { fiturAktif } from "@/stores/modulFaskes";
import { computed, onBeforeMount, ref, type PropType } from "vue";
import Qrcode from "qrcode.vue";
import { epochToDate, getDateNow } from "@/utils/Helpers";

import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import PatientIdentityFormRJ from "../Forms/PatientIdentityFormRJ.vue";
import PatientIdentityFormRI from "../Forms/PatientIdentityFormRI.vue";
import PatientIdentityFormIGD from "../Forms/PatientIdentityFormIGD.vue";
import DoctorVisitDetail from "../Forms/DoctorVisitDetailForm.vue";
import VisitRoomDetail from "../Forms/VisitRoomDetailForm.vue";
import { utilsStore } from "@/stores/utils";
import { useAdmisiRJStore } from "@/stores/admisi/rawatJalan";
import { useAdmisiRIStore } from "@/stores/admisi/rawatInap";
import { useAdmisiIGDStore } from "@/stores/admisi/igd";
import { useAdmisiGeneralConsent } from "@/stores/admisi/admisionGeneralConsent";
import { useToast } from "primevue/usetoast";
import { formatDate } from "@/utils/Helpers";
import * as yup from "yup";
import { toTypedSchema } from "@vee-validate/yup";
import { useForm } from "vee-validate";
import { createGeneralConsentPdf, createPatientLabel, createPatientVisit, createPatientBracelet } from "@/utils/PdfMake";
import { useGeneralConsentStore } from "@/stores/datamaster/generalConsent";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";

const props = defineProps({
  pageType: {
    type: String,
    required: true,
  },
  dataBreadCrumb: {
    type: Array as PropType<MenuItem[]>,
    default: () => [],
  },
  patientData: {
    type: Object as PropType<any>,
    required: true,
  },
  formType: {
    type: String as PropType<"add" | "edit" | "detail">,
    default: "add",
  },
});

// NOTE Store
const storeUtils = utilsStore();
const admisiRJStore = useAdmisiRJStore();
const admisiRIStore = useAdmisiRIStore();
const admisiIGDStore = useAdmisiIGDStore();
const admisiGeneralConsentStore = useAdmisiGeneralConsent();
const toast = useToast();
const generalConsentStore = useGeneralConsentStore();
const isEditing = ref(false);
const emit = defineEmits(["back", "goToDetail", "goToEdit", "cancelEdit" , "closeForm"]);

const consentText = computed(() => {
  switch (props.pageType) {
    case 'rawat-jalan':
      return 'Rawat Jalan.';
    case 'rawat-inap':
      return 'Rawat Inap.';
    case 'igd':
      return 'IGD.';
    default:
      return 'Tidak Diketahui.';
  }
});

const goToEdit = () => {
  isEditing.value = true
  emit ('goToEdit')
}

const confirmSaveDialog = ref(false);
const inputGeneralConsentDialog = ref(false);
const generalConsentDialog = ref(false);
const generalConsentDialogInputType = ref("create");
const selectedGeneralConsent = ref<"Pasien" | "Keluarga">("Pasien");
const onGeneralConsentTypeSelect = (label: "Pasien" | "Keluarga") => {
  selectedGeneralConsent.value = label;
};
const isEditButtonDisabled = computed(() => {
  return false;
});

const isDetail = () => {
  return props.formType === 'detail';
};

const openedPatientData = ref<any>({});
const openedDoctorVisitData = ref<any>({});
onBeforeMount(async () => {
  if (
    !props.dataBreadCrumb[0].label?.toString().includes("Daftar") ||
    (props.pageType === "rawat-inap" && props.patientData?.uuid)
  ) {
    await fetchDetailPatientData();
  }
});

const setDetailDoctorVisitData = (patientData: any) => {
  if (props.pageType == "rawat-jalan" || props.pageType == "igd") {
    let tempOpenedDoctorVisit = {
      paymentMethod: patientData.paymentMethod,
      jadwalDokterUuid: patientData.jadwalDokterUuid,
      maternity: patientData.maternity ?? false,
      complaint: patientData.complaint,
      note: patientData.note,
      insurance: patientData.insurance,
      practitionerUuid: patientData.practitionerUuid,
      lokasiUuid: patientData.lokasiUuid,
    };
    if (props.pageType == "rawat-jalan") {
      // delete tempOpenedDoctorVisit.practitionerUuid;
    } else {
      delete tempOpenedDoctorVisit.jadwalDokterUuid;
    }
    openedDoctorVisitData.value = tempOpenedDoctorVisit;
  }
  if (props.pageType == "rawat-inap") {
    let finalDataToPass = { ...patientData };
    if (patientData.practitioner && patientData.practitioner.uuid) {
      finalDataToPass.practitionerUuid = patientData.practitioner.uuid;
    }
    if (patientData.monitoringRoom && patientData.monitoringRoom.room) {
      const roomData = patientData.monitoringRoom.room;

      finalDataToPass.kategoriRuanganUuid = roomData.kategoriRuangan?.uuid;
      finalDataToPass.roomUuid = roomData.uuid;
      finalDataToPass.roomClassName = roomData.className;
      finalDataToPass.monitoringRoomUuid = patientData.monitoringRoom.uuid;
    } 
    else if (patientData.ruangan) {
       finalDataToPass.kategoriRuanganUuid = patientData.ruangan.kategoriRuangan?.uuid;
       finalDataToPass.roomUuid = patientData.ruangan.uuid;
       finalDataToPass.roomClassName = patientData.ruangan.className; 
    }
    openedDoctorVisitData.value = finalDataToPass;
  }
};

const fetchDetailPatientData = async () => {
  storeUtils.setLoading(true);
  try {
    let response;
    if (props.pageType == "rawat-jalan") {
      response = await admisiRJStore.getDetailRJ(props.patientData.uuid);
    } else if (props.pageType == "rawat-inap") {
      response = await admisiRIStore.getDetailRI(props.patientData.uuid);
    } else if (props.pageType == "igd") {
      response = await admisiIGDStore.getDetailIGD(props.patientData.uuid);
    }
    if (response && response.payload) {
      fullVisitData.value = response.payload;
      openedPatientData.value = response.payload.patient;
      openedPatientData.value.withoutIdentity =
        response.payload.withoutIdentity;
      if (openedPatientData.value.isNewBorn) {
        openedPatientData.value.multipleBirth = response.payload.multipleBirth
          ? true
          : false;
      }

      setDetailDoctorVisitData(response.payload);
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const fullVisitData = ref<any>({});

const handlePrintPatientVisit = async () => {
  if (props.pageType !== 'rawat-jalan') return;
  if (!openedPatientData.value.uuid) {
    await fetchDetailPatientData();
  }
  const patientIdentityData = openedPatientData.value;
  const visitDetailData = fullVisitData.value;


  const completeVisitData = {
    queueNumber: visitDetailData.noAntrianPoli || '-',
    qrCodeData: visitDetailData.bookingCode || visitDetailData.uuid,
    doctorName: visitDetailData.practitioner.pegawai.nama || '-',
    poliName: visitDetailData.lokasi?.name || '-',
    patientType: visitDetailData.insurance
      ? `ASURANSI (${visitDetailData.insurance.name || 'BPJS'})`
      : 'TUNAI',
    insuranceNumber: visitDetailData.insurance?.accountNumber || '-',
    sepNumber: visitDetailData.sep || '-',
    patient: {
      ...patientIdentityData,
      patientAge: patientIdentityData.patientAge || `${patientIdentityData.birthDetail?.ageYear || 0} Thn, ${patientIdentityData.birthDetail?.ageMonth || 0} Bln, ${patientIdentityData.birthDetail?.ageDay || 0} Hri`,
      gender: patientIdentityData.gender || '-',
    },
  };
  
  const faskesProfileString = localStorage.getItem('faskes_profile');
  const faskesProfileData = faskesProfileString ? JSON.parse(faskesProfileString) : {};
  createPatientVisit({ visitData: completeVisitData, clinicProfile: faskesProfileData });
};

const handlePrintPatientLabel = async () => {
  const visitDetailData = fullVisitData.value;
  const patientIdentityData = visitDetailData.patient;

  if (!visitDetailData || !patientIdentityData) {
    console.error("Data pasien tidak ditemukan untuk mencetak label.");
    return;
  }

  const labelData = {
    patientName: patientIdentityData.name,
    noRm: patientIdentityData.noRm,
    noReg: visitDetailData.noReg,
    birthDate: patientIdentityData.birthDetail?.birthDate,
    patientAge: `${patientIdentityData.birthDetail?.ageYear || 0} Thn, ${patientIdentityData.birthDetail?.ageMonth || 0} Bln, ${patientIdentityData.birthDetail?.ageDay || 0} Hri`,
    gender: patientIdentityData.gender,
    address: patientIdentityData.address?.fullAddress,
  };

  await createPatientLabel({ labelData: labelData });
};

const handlePrintPatientBracelet = async () => {
  const visitDetailData = fullVisitData.value;
  const patientIdentityData = visitDetailData.patient;

  if (!visitDetailData || !patientIdentityData) {
    console.error("Data pasien tidak ditemukan untuk mencetak gelang.");
    return;
  }

  const braceletData = {
    patientName: patientIdentityData.name,
    gender: patientIdentityData.gender,
    noRm: patientIdentityData.noRm,
    birthDate: patientIdentityData.birthDetail?.birthDate,
    ageYear: patientIdentityData.birthDetail?.ageYear,
    birthPlace: patientIdentityData.address?.fullAddress || '',
    doctorName: `${visitDetailData.practitioner?.pegawai?.firstTitle || ''} ${visitDetailData.practitioner?.pegawai?.nama || ''}`.trim(),
  };

  await createPatientBracelet({ braceletData: braceletData });
};

// NOTE Patient form
const patientIdentityFormRJ = ref<InstanceType<
  typeof PatientIdentityFormRJ
> | null>(null);
const patientIdentityFormRI = ref<InstanceType<
  typeof PatientIdentityFormRI
> | null>(null);
const patientIdentityFormIGD = ref<InstanceType<
  typeof PatientIdentityFormIGD
> | null>(null);
// NOTE Visit detail
const doctorVisitDetail = ref<InstanceType<typeof DoctorVisitDetail> | null>(
  null
);
const visitRoomDetail = ref<InstanceType<typeof VisitRoomDetail> | null>(null);
const closeRegisterForm = () => {
  if (patientIdentityFormRJ.value) {
    patientIdentityFormRJ.value.onResetForm();
    openedPatientData.value = {};
  }
  if (patientIdentityFormRI.value) {
    patientIdentityFormRI.value.onResetForm();
    openedPatientData.value = {};
  }
  if (patientIdentityFormIGD.value) {
    patientIdentityFormIGD.value.onResetForm();
    openedPatientData.value = {};
  }

  if (doctorVisitDetail.value) {
    doctorVisitDetail.value.onResetForm();
    openedDoctorVisitData.value = {};
  }
  if (visitRoomDetail.value) {
    visitRoomDetail.value.onResetForm();
    openedDoctorVisitData.value = {};
  }
  emit("back");
};

const ResetsForm = () => {
  if (patientIdentityFormRJ.value) {
    patientIdentityFormRJ.value.onResetForm();
    openedPatientData.value = {};
  }
  if (patientIdentityFormRI.value) {
    patientIdentityFormRI.value.onResetForm();
    openedPatientData.value = {};
  }
  if (patientIdentityFormIGD.value) {
    patientIdentityFormIGD.value.onResetForm();
    openedPatientData.value = {};
  }
  if (doctorVisitDetail.value) {
    doctorVisitDetail.value.onResetForm();
    openedDoctorVisitData.value = {};
  }
  if (visitRoomDetail.value) {
    visitRoomDetail.value.onResetForm();
    openedDoctorVisitData.value = {};
  }
};

// Validasi formulir dulu agar galat isian terlihat sebelum petugas masuk ke dialog General Consent
const bukaKonfirmasiSimpan = async () => {
  const identitas =
    props.pageType == "rawat-jalan"
      ? patientIdentityFormRJ.value
      : props.pageType == "rawat-inap"
      ? patientIdentityFormRI.value
      : patientIdentityFormIGD.value;
  const kunjungan = props.pageType == "rawat-inap" ? visitRoomDetail.value : doctorVisitDetail.value;
  const [okIdentitas, okKunjungan] = await Promise.all([identitas?.onSubmit(), kunjungan?.onSubmit()]);
  if (!okIdentitas || !okKunjungan) {
    toast.add({ severity: "warn", summary: "Data belum lengkap", detail: "Periksa kolom yang ditandai merah.", life: 4000 });
    return;
  }
  // Fitur General Consent nonaktif (mis. praktik mandiri): langsung simpan tanpa dialog persetujuan.
  if (!fiturAktif("daftar_general_consent")) {
    await registPatient("lewati");
    return;
  }
  confirmSaveDialog.value = true;
};

const postRegisterPatient = async () => {
  let tempPatientData: any;
  let tempDocterVisitData: any;

  if (props.pageType == "rawat-jalan") {
    tempPatientData = await patientIdentityFormRJ.value?.onSubmit();
  } else if (props.pageType == "rawat-inap") {
    tempPatientData = await patientIdentityFormRI.value?.onSubmit();
  } else if (props.pageType == "igd") {
    tempPatientData = await patientIdentityFormIGD.value?.onSubmit();
  }
  if (props.pageType == "rawat-inap") {
    tempDocterVisitData = await visitRoomDetail.value?.onSubmit();
  } else {
    tempDocterVisitData = await doctorVisitDetail.value?.onSubmit();
  }
  if (tempPatientData && tempDocterVisitData) {
    let tempBirthDate = formatDate(
      tempPatientData!.birthDetail.birthDate,
      true
    );
    tempPatientData!.birthDetail.birthDate = tempBirthDate as unknown as Date;
    let payload: any = { 
      patientData: tempPatientData, 
      ...tempDocterVisitData,
      withoutIdentity: tempPatientData.withoutIdentity,
      isNewborn: tempPatientData.isNewBorn,
    };
    if (payload.paymentMethod == "TUNAI") {
      delete payload.insurance;
    }
    
    storeUtils.setLoading(true);

    try {
      let response;
      if (props.pageType == "rawat-jalan") {
       if (props.formType === "add" && !props.patientData?.uuid) {
          response = await admisiRJStore.registRJ(payload); 
        } else {
          response = await admisiRJStore.updateRJ(props.patientData.uuid, payload);
        }
      } else if (props.pageType == "rawat-inap") {
        
        payload.isNewborn = tempPatientData.isNewBorn;
        payload.multipleBirth = tempPatientData.multipleBirth;
        
        const existingSpri = fullVisitData.value?.noSpri || fullVisitData.value?.no_spri;
        const isUpdate = props.formType !== "add" || !!existingSpri;
        if (!isUpdate) {
          response = tempPatientData.isNewBorn
            ? await admisiRIStore.registNewBorn(payload)
            : await admisiRIStore.registPatient(payload);
        } else {
          const targetUuid = fullVisitData.value?.uuid || props.patientData.uuid;
          response = await admisiRIStore.updateRI(
            targetUuid,
            payload
          );
        }
      } else if (props.pageType == "igd") {
        if (props.formType === "add") {
           response = await admisiIGDStore.registIGD(payload);
        } else {
           response = await admisiIGDStore.updateIGD(props.patientData.uuid, payload);
        }
      }

      if (response && response.payload) {
        fullVisitData.value = response.payload;
        openedPatientData.value = response.payload.patient;
        setDetailDoctorVisitData(response.payload);
        emit("goToDetail", response.payload);
        return true;
      }
      // galat API sudah ditampilkan oleh errorApiHandler
      return false;
    } catch (error) {
      console.error("Failed to process the data:", error);
      return false;
    } finally {
      storeUtils.setLoading(false);
    }
  } else {
    console.warn("Data Form tidak lengkap (Validasi Gagal di salah satu form)");
    return false;
  }
};

const selectedIsiSurat = ref<string>("");

const consentDiproses = ref(false);
const registPatient = async (type: string) => {
  if (type == "lewati") {
    await postRegisterPatient();
  } else if (type == "setuju-simpan") {
    consentDiproses.value = false;
    await onSubmitGeneralConsent();
    // validasi gagal (mis. format belum dipilih): biarkan dialog terbuka agar pesan galat terlihat
    if (!consentDiproses.value) {
      storeUtils.setLoading(false);
      return;
    }
  }
  confirmSaveDialog.value = false;
  inputGeneralConsentDialog.value = false;
  storeUtils.setLoading(false);
};

// NOTE General Consent
const schema = computed(() =>
  toTypedSchema(
    yup
      .object({
        uuid: yup.string().notRequired(),
        familyData: yup
          .object({
            name:
              selectedGeneralConsent.value == "Pasien"
                ? yup.string().nullable()
                : yup.string().required("Nama harus diisi"),
            address:
              selectedGeneralConsent.value == "Pasien"
                ? yup.string().nullable()
                : yup.string().required("Alamat harus diisi"),
            gender:
              selectedGeneralConsent.value == "Pasien"
                ? yup.string().nullable()
                : yup.string().required("Jenis kelamin harus dipilih"),
            relationship:
              selectedGeneralConsent.value == "Pasien"
                ? yup.string().nullable()
                : yup.string().required("Hubungan keluarga harus dipilih"),
          })
          .noUnknown(),
        name: yup.string().required("Format general consent harus dipilih"),
        generalConsent: yup.string().notRequired(),
      })
      .noUnknown()
  )
);

const {
  errors,
  handleSubmit: submitGeneralConsent,
  defineField,
  resetForm,
  setValues,
} = useForm({
  validationSchema: schema,
});

const [uuid] = defineField("uuid");
const [familyDataName] = defineField("familyData.name");
const [familyDataAddress] = defineField("familyData.address");
const [familyDataGender] = defineField("familyData.gender");
const [familyDataRelationship] = defineField("familyData.relationship");
const [name] = defineField("name");


const onSubmitGeneralConsent = submitGeneralConsent(async (values) => {
  consentDiproses.value = true;
  storeUtils.setLoading(true);
try {

  if (props.formType == "add") {
    // pendaftaran gagal → jangan buat consent untuk pasien yang tidak tersimpan
    if (!(await postRegisterPatient())) return;
  }

  // consent oleh pasien sendiri: data keluarga dikirim null (backend menolak objek keluarga yang kosong)
  values.familyData =
    selectedGeneralConsent.value == "Keluarga" && values.familyData && Object.values(values.familyData).some(Boolean)
      ? values.familyData
      : (null as any);

  const tempGeneralConsentData = createGeneralConsentPdf({
    data: selectedIsiSurat.value,
    patientData: openedPatientData.value,
    familyData: values.familyData,
  });

  values.generalConsent = await new Promise((resolve, reject) => {
    tempGeneralConsentData.getBase64((base64) => {
      if (base64) {
        resolve(base64);
      } else {
        reject("Gagal mendapatkan Base64 dari dokumen PDF.");
      }
    });
  });

  values.name = selectedDataGeneralConsent.value?.name || "";

  await admisiGeneralConsentStore.createGeneralConsent(
    openedPatientData.value.uuid,
    values
  );


  inputGeneralConsentDialog.value = false;
} catch (error) {
  console.error("❌ Gagal saat proses general consent:", error);
} finally {
  storeUtils.setLoading(false);
}
});


interface GeneralConsentItem {
  uuid: string;
  name: string;
  isiSurat: string;
  status: boolean;
}
const listDatamasterGeneralConsent = ref<GeneralConsentItem[]>([]);
const fetchListGeneralConsent = async () => {
  try {
    storeUtils.setLoading(true);
    // FIXME Masih API biasa filter dari FE
    const response = await generalConsentStore.getApi(1, 9999);
    if (response && response.payload) {
      listDatamasterGeneralConsent.value = response.payload.filter(
        (generalConsent: any) => generalConsent.status
      );
    } else listDatamasterGeneralConsent.value = [];
  } catch (error) {
    console.error("Failed to post data", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const selectedDataGeneralConsent = ref<GeneralConsentItem | undefined>();
const setSelectedGeneralConsent = (uuid: string) => {
  const found = listDatamasterGeneralConsent.value.find(
    (gc: any) => gc.uuid == uuid
  );
  selectedDataGeneralConsent.value = found;
  selectedIsiSurat.value = found?.isiSurat || "";
};

const listOpenedPatientGeneralConsent = ref<any[]>([]);
const urlGeneralConsent = ref();
const showDialogGeneralConsent = async (
  type: "detail" | "list" | "add",
  uuid = ""
) => {
  const daftarConsent = fetchListGeneralConsent();
  generalConsentDialogInputType.value = type;
  if (type == "add") {
    confirmSaveDialog.value = false;
    selectedGeneralConsent.value = "Pasien";
    inputGeneralConsentDialog.value = true;
    await daftarConsent;
    // pilih otomatis format yang sesuai jenis layanan (mis. "Rawat Jalan"), atau satu-satunya format aktif
    const jenis = props.pageType == "rawat-jalan" ? "rawat jalan" : props.pageType == "rawat-inap" ? "rawat inap" : "igd";
    const cocok =
      listDatamasterGeneralConsent.value.find((gc) => gc.name?.toLowerCase().includes(jenis)) ??
      (listDatamasterGeneralConsent.value.length === 1 ? listDatamasterGeneralConsent.value[0] : undefined);
    if (cocok && !name.value) {
      name.value = cocok.uuid;
      setSelectedGeneralConsent(cocok.uuid);
    }
  }
  if (type == "list") {
    try {
      storeUtils.setLoading(true);
      const response =
        await admisiGeneralConsentStore.getAllPatientGeneralConsent(
          openedPatientData.value.uuid
        );
      if (response && response.payload) {
        listOpenedPatientGeneralConsent.value = response.payload;
      }
      generalConsentDialog.value = true;
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      storeUtils.setLoading(false);
    }
  }
  if (type == "detail") {
    try {
      storeUtils.setLoading(true);
      const response = await admisiGeneralConsentStore.getDetailGeneralConsent(
        uuid
      );
      if (response && response.payload) {
        setValues({
          ...response.payload,
        });
        selectedGeneralConsent.value = response.payload.patientFamily
          ? "Keluarga"
          : "Pasien";
        inputGeneralConsentDialog.value = true;
        const blob = base64toBlob(response.payload.generalConsent);
        urlGeneralConsent.value = URL.createObjectURL(blob);
      }
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      storeUtils.setLoading(false);
    }
  }
};

const base64toBlob = (data: string) => {
  const bytes = atob(data);
  let length = bytes.length;
  let out = new Uint8Array(length);

  while (length--) {
    out[length] = bytes.charCodeAt(length);
  }

  return new Blob([out], { type: "application/pdf" });
};

const deleteGeneralConsent = async () => {
  try {
    storeUtils.setLoading(true);
    await admisiGeneralConsentStore.deleteGeneralConsent(uuid.value ?? "");
    generalConsentDialog.value = false;
    inputGeneralConsentDialog.value = false;
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    storeUtils.setLoading(false);
  }
};
</script>

<template>
  <div class="relative w-full overflow-hidden">
    <Card class="h-min mb-[10px] absolute right-0 left-0">
      <template #content>
        <div class="flex justify-between">
          <CustomBreadCrumb
            :home="{
              label:
                pageType == 'rawat-jalan'
                  ? 'Rawat Jalan'
                  : pageType == 'rawat-inap'
                  ? 'Rawat Inap'
                  : 'IGD',
              home: true,
            }"
            :model="dataBreadCrumb"
            class=""
          >
            <template #customItem="{ item }">
              <div class="flex">
                <span
                  :class="{
                    'text-opensimrs-300': item.home,
                    'text-grey-400': !item.home,
                  }"
                >
                  {{ item.label }}
                </span>
                <CustomChip
                  v-if="item.platform"
                  :showCheckedIcon="false"
                  :label="item.platform"
                  bgColor="bg-opensimrs-300"
                  textColor="text-white"
                  customClass="h-5 pr-[6px] border-none mr-[5px]"
                  class="my-auto ml-[10px]"
                />
              </div>
            </template>
          </CustomBreadCrumb>
          <!-- batal edit -->
          <div class="flex">
            <CustomButton
                @click="closeRegisterForm"
                :icon="formType === 'edit' ? undefined : 'PhCaretLeft'"
                :label="formType === 'edit' ? 'Batal Edit' : 'Kembali'"
                class="mr-[10px]"
                outlined
                borderColor="border-opensimrs-300"
                textColor="text-opensimrs-300"
            />
            <CustomButton
              v-if="isDetail()"
              @click="emit('goToEdit')"
              label="Edit"
              class="mr-[10px]"
              backgroundColor="bg-opensimrs-300"
              :disabled="isEditButtonDisabled"  
              :title="isEditButtonDisabled ? 'Pasien sudah dirawat dan tidak dapat diubah' : ''"
            />
          </div>
        </div>
      </template>
    </Card>
    <div class="relative h-full overflow-auto top-[90px] pb-[180px]">
      <PatientIdentityFormRJ
        v-if="pageType == 'rawat-jalan'"
        ref="patientIdentityFormRJ"
        :pageType="pageType"
        :isDetail="isDetail()"
        :formType="dataBreadCrumb[0].label?.toString()"
        :patientData="openedPatientData"
      />
      <PatientIdentityFormRI
        v-else-if="pageType == 'rawat-inap'"
        ref="patientIdentityFormRI"
        :pageType="pageType"
        :isDetail="isDetail()"
        :formType="dataBreadCrumb[0].label?.toString()"
        :patientData="openedPatientData"
      />
      <PatientIdentityFormIGD
        v-else-if="pageType == 'igd'"
        ref="patientIdentityFormIGD"
        :pageType="pageType"
        :isDetail="isDetail()"
        :formType="dataBreadCrumb[0].label?.toString()"
        :patientData="openedPatientData"
      />
      <VisitRoomDetail
        v-if="pageType == 'rawat-inap'"
        ref="visitRoomDetail"
        :pageType="pageType"
        :isDetail="isDetail()"
        :formType="dataBreadCrumb[0].label?.toString()"
        :patientData="openedPatientData"
        :doctorVisitData="openedDoctorVisitData"
      />
      <DoctorVisitDetail
        v-else
        ref="doctorVisitDetail"
        :pageType="pageType"
        :isDetail="isDetail()"
        :formType="dataBreadCrumb[0].label?.toString()"
        :patientData="openedPatientData"
        :doctorVisitData="openedDoctorVisitData"
      />
    </div>
    <Card class="h-min mt-[10px] absolute z-10 bottom-0 right-0 left-0">
      <template #content>
        <div v-if="isDetail()" class="flex">
          <CustomButton
             v-if="pageType == 'rawat-jalan' && isDetail()"
            @click="handlePrintPatientVisit"
            icon="PhPrinter"
            label="Cetak Kunjungan"
            class="mr-[10px]"
            backgroundColor="bg-opensimrs-300"
          />
          <CustomButton
            v-else-if="isDetail()"
            @click="handlePrintPatientBracelet"
            icon="PhPrinter"
            label="Cetak Gelang"
            class="mr-[10px]"
            backgroundColor="bg-opensimrs-300"
          />
          <CustomButton
            v-if="isDetail()"
            @click="handlePrintPatientLabel"
            icon="PhPrinter"
            label="Cetak Label"
            class=""
            backgroundColor="bg-opensimrs-300"
          />
          <div v-if="fiturAktif('daftar_general_consent')" class="bg-opensimrs-300 w-[1px] my-[5px] mx-[15px]"></div>
          <CustomButton
            v-if="fiturAktif('daftar_general_consent')"
            @click="showDialogGeneralConsent('list')"
            label="General Consent"
            class="mr-[10px]"
            backgroundColor="bg-opensimrs-300"
          />
        </div>
        <div v-else class="flex justify-end">
          <CustomButton
            @click="ResetsForm"
            label="Reset"
            class="mr-[10px]"
            outlined
            borderColor="border-grey-200"
            textColor="text-grey-300"
          />
          <CustomButton
            v-if="dataBreadCrumb[0].label == 'Checkin'"
            @click="bukaKonfirmasiSimpan"
            label="Simpan & Checkin"
            class=""
            backgroundColor="bg-opensimrs-300"
          />
          <CustomButton
            v-else
            @click="bukaKonfirmasiSimpan"
            label="Simpan"
            class=""
            backgroundColor="bg-opensimrs-300"
          />
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="confirmSaveDialog" width="600px">
      <template #header>
        General Consent -
        {{
          pageType == "rawat-jalan"
            ? "Rawat Jalan"
            : pageType == "rawat-inap"
            ? "Rawat Inap"
            : "IGD"
        }}
      </template>
      <template #body>
        <div class="mt-5">
          <div class="mb-2">
            Pasien belum menyetujui
            <span class="font-bold">General Consent - {{ consentText }}</span>
          </div>
          <div>
            Membuat kesepakatan <span class="font-bold">General Consent?</span>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomButton
            @click="registPatient('lewati')"
            label="Lewati"
            outlined
            class="mr-[10px]"
            borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300"
          />
          <CustomButton
            @click="showDialogGeneralConsent('add')"
            label="Buat"
            class=""
            backgroundColor="bg-opensimrs-300"
          />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog
      v-model:visible="inputGeneralConsentDialog"
      width="1000px"
      @closeDialog="resetForm"
    >
      <template #header>
        <div class="flex">
          <div>General Consent</div>
          <CustomChip
            v-if="
              (generalConsentDialogInputType != 'add' &&
                selectedGeneralConsent == 'Pasien') ||
              generalConsentDialogInputType == 'add'
            "
            label="Pasien"
            borderColor="border-white"
            iconColor="text-white"
            textColor="text-white"
            selected-icon-color="text-opensimrs-300"
            selectedTextColor="text-opensimrs-300"
            :iconSize="16"
            class="ml-[10px]"
            selectedColor="bg-white border-white"
            :isSelected="selectedGeneralConsent == 'Pasien'"
            @selected="onGeneralConsentTypeSelect"
          />
          <CustomChip
            v-if="
              (generalConsentDialogInputType != 'add' &&
                selectedGeneralConsent == 'Keluarga') ||
              generalConsentDialogInputType == 'add'
            "
            label="Keluarga"
            borderColor="border-white"
            iconColor="text-white"
            textColor="text-white"
            selected-icon-color="text-opensimrs-300"
            selectedTextColor="text-opensimrs-300"
            :iconSize="16"
            class="ml-[10px]"
            selectedColor="bg-white border-white"
            :isSelected="selectedGeneralConsent == 'Keluarga'"
            @selected="onGeneralConsentTypeSelect"
          />
        </div>
      </template>
      <template #body>
        <div class="mt-5">
          <div
            v-if="
              selectedGeneralConsent == 'Keluarga' &&
              generalConsentDialogInputType == 'add'
            "
            class="grid grid-cols-2 gap-x-[30px] gap-y-5 mb-5"
          >
            <CustomTextfield
              v-model="familyDataName"
              label="Nama Lengkap Keluarga"
              class=""
              placeholder="Nama Lengkap Keluarga"
              :invalid="!!errors['familyData.name']"
              :invalidMessage="errors['familyData.name']"
            />
            <CustomTextArea
              v-model="familyDataAddress"
              label="Alamat"
              class=""
              placeholder="Alamat"
              height="h-10"
              :invalid="!!errors['familyData.address']"
              :invalidMessage="errors['familyData.address']"
            />
            <CustomSelect
              v-model="familyDataGender"
              label="Jenis Kelamin"
              placeHolder="Pilih Jenis Kelamin"
              class=""
              optionLabel=""
              optionValue=""
              :showFilter="false"
              :options="['Laki-laki', 'Perempuan']"
              :invalid="!!errors['familyData.gender']"
              :invalidMessage="errors['familyData.gender']"
            />
            <CustomSelect
              v-model="familyDataRelationship"
              label="Hubungan Dengan Pasien"
              placeHolder="Pilih Hubungan Dengan Pasien"
              class=""
              optionLabel=""
              optionValue=""
              :showFilter="false"
              :options="[
                'Kepala Keluarga',
                'Mertua',
                'Menantu',
                'Kepokanan',
                'Sepupu',
                'Teman',
                'Kerabat',
                'Asisten Rumah Tangga',
                'Suami',
                'Istri',
                'Ayah',
                'Ibu',
                'Anak',
                'Kakak',
                'Adik',
                'Cucu',
                'Kakek',
                'Nenek',
                'Lainnya',
                'Family Lain',
              ]"
              :invalid="!!errors['familyData.relationship']"
              :invalidMessage="errors['familyData.relationship']"
            />
          </div>
          <CustomSelect
            v-if="generalConsentDialogInputType == 'add'"
            v-model="name"
            @update:model-value="setSelectedGeneralConsent"
            label="Format General Consent"
            :placeHolder="`General Consent ${
              pageType == 'rawat-jalan'
                ? 'Rawat Jalan'
                : pageType == 'rawat-inap'
                ? 'Rawat Inap'
                : 'IGD'
            }`"
            class=""
            optionLabel="name"
            optionValue="uuid"
            :options="listDatamasterGeneralConsent"
            prependIcon="PhMagnifyingGlass"
            :invalid="!!errors.name"
            :invalidMessage="errors.name"
          />
          <CustomTextfield
            v-else
            v-model="name"
            label="Format General Consent"
            class=""
            placeholder="Format General Consent"
            :disabled="generalConsentDialogInputType == 'detail'"
          />
          <div
            v-if="generalConsentDialogInputType == 'add'"
            class="h-[400px] border-[1px] border-grey-200 border-dashed rounded-[10px] mt-5 flex overflow-auto"
          >
            <div
              v-if="selectedDataGeneralConsent"
              v-html="selectedDataGeneralConsent.isiSurat"
              class="w-full px-10"
            ></div>
            <div v-else class="m-auto font-semibold text-normal">
              Default General Consent Rawat Jalan Pilihan Awal
            </div>
          </div>
          <iframe
            v-else
            :src="urlGeneralConsent"
            height="400px"
            width="100%"
            class="mt-5"
          ></iframe>
          <div
            v-if="generalConsentDialogInputType == 'add'"
            class="grid grid-cols-2 mt-10 text-center"
          >
            <div class="font-semibold text-normal">Petugas</div>
            <div class="font-semibold text-normal">
              {{ selectedGeneralConsent == "Pasien" ? "Pasien" : "Keluarga" }}
            </div>
            <Qrcode
              class="mx-auto my-[10px]"
              :value="`Dikeluarkan di Klinik OpenSIMRS, Ditandatangani secara elektronik oleh Petugas, Pada tanggal ${getDateNow()}`"
            />
            <Qrcode
              class="mx-auto my-[10px]"
              :value="`Dikeluarkan di Klinik OpenSIMRS, Ditandatangani secara elektronik oleh ${
                selectedGeneralConsent == 'Pasien'
                  ? 'Pasien'
                  : 'Keluarga Pasien'
              }, Pada tanggal ${getDateNow()}`"
            />
            <div class="text-SM">Nama Petugas</div>
            <div class="text-SM">
              {{
                selectedGeneralConsent == "Pasien"
                  ? "Nama Pasien"
                  : "Nama Keluarga Pasien"
              }}
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div
          v-if="generalConsentDialogInputType == 'detail'"
          class="flex w-full"
        >
          <CustomButton
            @click="emit('goToDetail'), (inputGeneralConsentDialog = false)"
            icon="PhPrinter"
            label="Cetak"
            class="mr-auto"
            backgroundColor="bg-opensimrs-300"
          />
          <CustomButton
            @click="deleteGeneralConsent"
            label="Hapus"
            class="bg-danger-300"
            backgroundColor="bg-opensimrs-300"
            icon="PhTrash"
            iconType="fill"
          />
        </div>
        <div v-else-if="generalConsentDialogInputType == 'edit'" class="flex">
          <CustomButton
            @click="inputGeneralConsentDialog = false"
            label="Batal Edit"
            outlined
            class="mr-[10px]"
            borderColor="border-grey-200"
            textColor="text-grey-300"
          />
          <CustomButton
            @click="emit('goToDetail'), (inputGeneralConsentDialog = false)"
            label="Simpan Edit"
            class=""
            backgroundColor="bg-opensimrs-300"
          />
        </div>
        <div v-else class="flex justify-end w-full">
          <CustomButton
            @click="inputGeneralConsentDialog = false"
            label="Batal"
            outlined
            class="mr-[10px]"
            borderColor="border-grey-200"
            textColor="text-grey-300"
          />
          <CustomButton
            @click="registPatient('setuju-simpan')"
            label="Setuju & Simpan"
            class=""
            backgroundColor="bg-opensimrs-300"
          />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="generalConsentDialog" width="600px">
      <template #header>General Consent</template>
      <template #body>
        <div class="mt-[10px]">
          <div v-for="data in listOpenedPatientGeneralConsent">
            <div
              @click="showDialogGeneralConsent('detail', data.uuid)"
              class="text-black cursor-pointer text-SM"
            >
              <div class="font-bold">
                {{ data.name }}
              </div>
              <!-- <div class="text-opensimrs-300">Rawat Jalan</div> -->
              <div class="flex">
                Tanggal
                <PhArrowRight
                  :size="18"
                  class="mx-5 ml-2 mr-3 text-success-300"
                  weight="bold"
                />
                {{ epochToDate(data.createdAt, "dateTime") }}
              </div>
            </div>
            <hr class="my-[10px]" />
          </div>
          <div
            class="border-[1px] border-dashed border-grey-200 h-20 rounded-[10px] flex"
          >
            <CustomButton
              @click="
                (generalConsentDialog = false), showDialogGeneralConsent('add')
              "
              icon="PhPlus"
              label="General Consent Baru"
              class="m-auto"
              backgroundColor="bg-opensimrs-300"
            />
          </div>
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
