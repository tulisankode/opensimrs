<script setup lang="ts">
import { computed, onMounted, onUpdated, ref, type PropType, watch, nextTick } from "vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import * as yup from "yup";
import { toTypedSchema } from "@vee-validate/yup";
import { useForm } from "vee-validate";
import { utilsStore } from "@/stores/utils";
import { usePraktisiStore } from "@/stores/datamaster/praktisi";
import { usePenjaminStore } from "@/stores/datamaster/penjamin";
import { useAdmisiRJStore } from "@/stores/admisi/rawatJalan";
import { useLokasiStore } from "@/stores/datamaster/lokasi";
import { fiturAktif } from "@/stores/modulFaskes";

// NOTE Store
const storeUtils = utilsStore();
const praktisiStore = usePraktisiStore();
const penjaminStore = usePenjaminStore();
const admisiRJStore = useAdmisiRJStore();
const lokasiStore = useLokasiStore();
const filteredDpjp = computed(() => {
  if (!selectedPoli.value) return [];
  return listDpjp.value.filter(
    (dpjp: any) =>
      String(dpjp.poliUuid).toLowerCase() ===
      String(selectedPoli.value).toLowerCase()
  );
});

const props = defineProps({
  pageType: {
    type: String,
    required: true,
  },
  formType: {
    type: String,
    default: "",
  },
  isDetail: {
    type: Boolean,
    required: false,
  },
  patientData: {
    type: Object as PropType<any>,
    required: true,
  },
  doctorVisitData: {
    type: Object as PropType<any>,
    required: true,
  },
});

const filterPoliList = ref([]);
const listDpjp = ref<any[]>([]);
const listPenjamin = ref<any[]>([]);
const listJadwalDokter = ref<any[]>([]);
const selectedJadwalPoli = ref("");
const selectedPoliUuid = ref("");

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const listJadwalDokterFiltered = computed(() => {
  const currentUuid = practitionerUuid.value;

  if (!currentUuid) {
    return [];
  }

  // payload dikelompokkan per dokter + poli: dokter yang praktik di beberapa poli punya beberapa grup
  const doctorSchedules = listJadwalDokter.value.filter(
    (item) => item.doctor?.uuid === currentUuid && (!selectedPoli.value || item.poli?.uuid === selectedPoli.value)
  );

  // pendaftaran baru hanya untuk jadwal hari ini (backend menolak hari lain); saat melihat/mengubah data lama tampilkan semua
  const hariIni = HARI[new Date().getDay()];
  const hanyaHariIni = !props.isDetail && props.formType !== "Detail Edit";

  return doctorSchedules
    .flatMap((group: any) => group.jadwalDokter ?? [])
    .filter((jadwal: any) => jadwal.status === "aktif" && (!hanyaHariIni || jadwal.day === hariIni || jadwal.jadwalDokterUuid === jadwalDokterUuid.value))
    .map((jadwal: any) => ({
      uuid: jadwal.jadwalDokterUuid,
      day: jadwal.day,
      startTime: jadwal.startTime,
      endTime: jadwal.endTime,
      label: `${jadwal.day} | ${jadwal.startTime} - ${jadwal.endTime} · sisa kuota ${jadwal.sisaKuota ?? "-"}`,
    }));
});


const fetchUtils = async () => {
  try {
    // FIXME Masih menggunakan api biasa dan filter by FE
    const responseDpjp = await praktisiStore.getApi({
      limit: 9999,
      non_doctor: false,
    });
    if (responseDpjp && responseDpjp.payload) {
      listDpjp.value = responseDpjp.payload.filter(
        (praktisi: any) => praktisi.isDoctor && praktisi.status
      );
    }

    const responsePenjamin = await penjaminStore.getAktifApi();

    if (responsePenjamin && responsePenjamin.payload) {
      listPenjamin.value = responsePenjamin.payload
    } else {
      listPenjamin.value = [];
    }

    const responseJadwalDokter = await admisiRJStore.getListJadwalDokter();

    if (responseJadwalDokter && responseJadwalDokter.payload) {
      listJadwalDokter.value = responseJadwalDokter.payload
    } else {
      listJadwalDokter.value = [];
    }

    const responseLokasi = await lokasiStore.getApi(1,9999);
    if (responseLokasi && responseLokasi.payload) {

      filterPoliList.value = responseLokasi.payload
      .filter((lokasi: any) => {
        return (
          lokasi.locationType?.toLowerCase() === "ward" &&
          Boolean(lokasi.isPoli) === true
        );
      })
      .map((lokasi: any) => ({
        name: lokasi.name,
        uuid: lokasi.uuid
      }));

    } else {
      filterPoliList.value = [];
    }

    const responseDpjpPoli = await praktisiStore.getPractitionerApi({
      limit: 9999,
      non_doctor: false,
    });
    if (responseDpjpPoli && responseDpjpPoli.payload) {
      watch(selectedPoliUuid, (uuidPoli) => {
        if (!uuidPoli) {
          listDpjp.value = [];
          return;
        }
        listDpjp.value = responseDpjpPoli.payload.filter(
          (praktisi: any) =>
            praktisi.is_doctor &&
            praktisi.status &&
            praktisi.poli_pelayanan?.some(
              (poli: any) => poli.lokasi_uuid === uuidPoli
            )
        );
      });
    }

  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

watch(selectedJadwalPoli, async (poliUuid) => {
  if (!poliUuid) {
    listDpjp.value = [];
    return;
  }

  try {
    const responseDpjp = await praktisiStore.getPractitionerApi({ poli_uuid: poliUuid });
    listDpjp.value = responseDpjp?.payload || [];
  } catch (error) {
    console.error("Gagal mengambil data DPJP", error);
    listDpjp.value = [];
  }
});


const setFormData = () => {
  if (!props.doctorVisitData || Object.keys(props.doctorVisitData).length === 0) {
    resetForm(); 
    selectedPaymentMethod.value = 'TUNAI';
    return;
  }

  const matchedPenjamin = listPenjamin.value.find(
    (penjamin) => penjamin.code === props.doctorVisitData.insurance?.code
  );
  
  if (props.doctorVisitData.practitioner && props.doctorVisitData.practitioner.pegawai) {
      props.doctorVisitData.practitioner.pegawai.name = props.doctorVisitData.practitioner.pegawai.nama;
  }

  const formData = {
    ...props.doctorVisitData,
    selectedPoli: props.doctorVisitData.lokasiUuid,
    practitionerUuid: props.doctorVisitData.practitionerUuid,
    jadwalDokterUuid: props.doctorVisitData.jadwalDokterUuid,
    paymentMethod: props.doctorVisitData.paymentMethod === 2 ? "ASURANSI" : "TUNAI",
    insurance: {
      penjaminUuid: matchedPenjamin ? matchedPenjamin.uuid : "",
      accountNumber: props.doctorVisitData.insurance?.accountNumber,
      classEntitle: props.doctorVisitData.insurance?.classEntitle,
    },
  };

  setValues(formData);
  onPaymentMethodSelect(formData.paymentMethod);
  setPoliDpjpJadwal(formData.jadwalDokterUuid);
};

onMounted(async () => {
  await fetchUtils();
  setFormData();
  isiOtomatis(); // setFormData mereset form baru → isi ulang pilihan tunggal
});

watch(() => props.doctorVisitData, (newData) => {
  if (newData && Object.keys(newData).length > 0) {
    nextTick(() => {
      setFormData();
    });
  }
}, {
  deep: true,
  immediate: true 
});

const selectedJadwalDpjp = ref("");
const setPoliDpjpJadwal = (jadwalDokterUuid: string) => {
  if (jadwalDokterUuid) {
    const tempDataJadwal = listJadwalDokter.value.find(
      (data) => data.uuid === jadwalDokterUuid
    );
    if (tempDataJadwal) {
      selectedJadwalPoli.value = tempDataJadwal.poliName;
      selectedJadwalDpjp.value = tempDataJadwal.doctorName;
    } else {
      selectedJadwalPoli.value = "";
      selectedJadwalDpjp.value = "";
    }
  } else {
    selectedJadwalPoli.value = "";
    selectedJadwalDpjp.value = "";
  }
};

const selectedPaymentMethod = ref<string>("TUNAI");
const onPaymentMethodSelect = (label: string) => {
  selectedPaymentMethod.value = label;
  paymentMethod.value = label;
};

const schema = computed(() =>
  toTypedSchema(
    yup
      .object({
        paymentMethod: yup.string().default("TUNAI"),
        jadwalDokterUuid:
          props.pageType == "rawat-jalan"
            ? yup.string().required("Jadwal harus dipilih")
            : yup.string(),
        maternity: yup.boolean().nullable(),
        complaint: yup.string().default(""),
        note: yup.string().default(""),
        insurance: yup
          .object({
            penjaminUuid: yup.string().nullable(),
            accountNumber: yup.string().nullable(),
            classEntitle: yup.string().nullable(),
          })
          .when("paymentMethod", ([paymentMethod], schema) => {
            return paymentMethod == "TUNAI"
              ? schema
              : schema.shape({
                  penjaminUuid: yup
                    .string()
                    .required("Nama Penjamin harus dipilih"),
                  accountNumber: yup
                    .string()
                    .required("No. Penjamin harus diisi"),
                  classEntitle: yup.string().required("Kelas harus dipilih"),
                });
          })
          .noUnknown(),
        // NOTE IGD
        practitionerUuid:
          props.pageType == "igd" || props.pageType == "rawat-jalan"
            ? yup.string().required("DPJP harus dipilih")
            : yup.string(),
        // NOTE RJ
        selectedPoli:
          props.pageType == 'rawat-jalan'
            ? yup.string().required("Poli harus dipilih")
            : yup.string(),
      })
      .noUnknown()
  )
);

const { errors, handleSubmit, defineField, resetForm, setValues } = useForm({
  validationSchema: schema,
});

const [paymentMethod] = defineField("paymentMethod");
const [maternity] = defineField("maternity");
const [complaint] = defineField("complaint");
const [note] = defineField("note");
const [insuranceUuid] = defineField("insurance.penjaminUuid");
const [insuranceAccount] = defineField("insurance.accountNumber");
const [insuranceClass] = defineField("insurance.classEntitle");
// NOTE Rawat Jalan
const [selectedPoli] = defineField("selectedPoli");
const [jadwalDokterUuid] = defineField("jadwalDokterUuid");
// NOTE IGD
const [practitionerUuid] = defineField("practitionerUuid");

// DPJP yang praktik di poli terpilih (IGD: semua dokter).
const opsiDpjp = computed(() =>
  props.pageType === "igd"
    ? listDpjp.value
    : selectedPoli.value
      ? listDpjp.value.filter((dpjp: any) =>
          dpjp.poliPelayanan?.some(
            (p: any) => String(p.lokasiUuid).toLowerCase() === String(selectedPoli.value).toLowerCase()
          )
        )
      : []
);

// Pendaftaran Ringkas (fitur daftar_ringkas, praktik mandiri): pilihan poli / DPJP / jadwal yang hanya satu
// diisi otomatis pada pendaftaran baru. Segmen lain tidak berubah.
const pendaftaranBaru = computed(() => fiturAktif("daftar_ringkas") && !props.isDetail && props.formType !== "Detail Edit");
const isiTunggal = (opsi: any[], nilai: { value: any }, kunci: string) => {
  if (pendaftaranBaru.value && !nilai.value && opsi.length === 1) nilai.value = opsi[0][kunci];
};
const isiOtomatis = () => {
  if (props.pageType == "rawat-jalan") isiTunggal(filterPoliList.value, selectedPoli, "uuid");
  isiTunggal(opsiDpjp.value, practitionerUuid, "uuid");
  if (props.pageType == "rawat-jalan") isiTunggal(listJadwalDokterFiltered.value, jadwalDokterUuid, "uuid");
};
watch([filterPoliList, opsiDpjp, listJadwalDokterFiltered], isiOtomatis);

const onSubmit = handleSubmit(async (values) => {
  return values;
});
const onResetForm = () => {
  resetForm();
};

defineExpose({
  onSubmit,
  onResetForm,
});
</script>

<template>
  <CustomAccordion :openWithHeader="false" class="mt-[10px]" initialState="0">
    <template #header>
      <div class="flex justify-between w-full align-middle">
        <div class="flex">
          <span class="leading-10 text-opensimrs-300 text-heading">
            {{
              pageType == "rawat-inap"
                ? "Detail Kunjungan & Ruangan"
                : "Detail Kunjungan Dokter"
            }}
          </span>
          <CustomChip
            v-if="!isDetail || selectedPaymentMethod.includes('TUNAI')"
            label="TUNAI"
            borderColor="border-opensimrs-300"
            bgColor="bg-opensimrs-50"
            iconColor="text-opensimrs-300"
            textColor="text-opensimrs-300"
            customClass="h-5"
            class="my-auto ml-5"
            :isSelected="selectedPaymentMethod.includes('TUNAI')"
            @selected="onPaymentMethodSelect"
            :disabled="isDetail"
            selectedColor="bg-opensimrs-300 border-opensimrs-300"
          />
          <CustomChip
            v-if="!isDetail || selectedPaymentMethod.includes('ASURANSI')"
            label="ASURANSI"
            borderColor="border-warning-300"
            bgColor="bg-warning-50"
            iconColor="text-warning-300"
            textColor="text-warning-300"
            customClass="h-5"
            class="ml-[10px] my-auto"
            :isSelected="selectedPaymentMethod.includes('ASURANSI')"
            @selected="onPaymentMethodSelect"
            :disabled="isDetail"
            selectedColor="bg-warning-300 border-warning-300"
          />
        </div>
      </div>
    </template>
    <template #content>
      <div class="pt-5">
        <div class="grid grid-cols-2 gap-y-5 gap-x-[30px]">
          <div
            class="gap-x-[30px] col-span-2"
            :class="[
              pageType == 'rawat-jalan'
                ? 'grid grid-cols-3'
                : 'grid grid-cols-4',
            ]"
          >
            <CustomSelect
              v-if="pageType == 'rawat-jalan'"
              v-model="selectedPoli"
              label="Poli"
              placeHolder="Pilih Poli"
              optionLabel="name"
              optionValue="uuid"
              :showFilter="false"
              :options="filterPoliList"
              :disabled="isDetail || formType === 'Detail Edit'"
              :invalid="!!errors.selectedPoli" 
              :invalidMessage="errors.selectedPoli"
            />
            <CustomSelect
                v-model="practitionerUuid"
                label="DPJP"
                placeHolder="Pilih DPJP"
                :class="{ 'col-span-2': pageType == 'igd' }"
                optionLabel="pegawai.name"
                optionValue="uuid"
                :options="opsiDpjp"
                :showFilter="false"
                :disabled="isDetail || formType === 'Detail Edit' || (pageType !== 'igd' && !selectedPoli)"
                :invalid="!!errors.practitionerUuid"
                :invalidMessage="errors.practitionerUuid"
              />
            <!-- FIXME Dummy data -->
            <!-- NOTE Harus ada api baru untuk menampilkan data jadwal dengan filter dokter poli dan jam saat ini -->
            <CustomSelect
                v-if="pageType == 'rawat-jalan'"
                v-model="jadwalDokterUuid"
                :options="listJadwalDokterFiltered"
                optionValue="uuid"
                optionLabel="label"
                label="Jadwal" 
                :placeHolder="practitionerUuid && !listJadwalDokterFiltered.length ? 'Tidak ada jadwal hari ini' : 'Pilih Jadwal'"
                :disabled="isDetail || formType === 'Detail Edit'"
                :showFilter="false"
                :invalid="!!errors.jadwalDokterUuid"
                :invalidMessage="errors.jadwalDokterUuid"
              >
                <template #customOptions="{ option }">
                  {{ option.label }}
                </template>
              </CustomSelect>
            <CustomTextfield
              v-if="pageType == 'igd'"
              v-model="complaint"
              label="Keluhan Utama"
              class="col-span-2"
              placeholder="Keluhan Utama"
              :disabled="isDetail"
            />
          </div>
        </div>
        <div class="grid gap-y-5 gap-x-[30px] mt-5 grid-cols-5">
          <CustomSwitch
            v-model="maternity"
            label="Pasien Maternitas"
            :disabled="isDetail"
          />
          <CustomTextfield
            v-if="pageType == 'rawat-jalan'"
            v-model="complaint"
            label="Keluhan Utama"
            class="col-span-2"
            placeholder="Keluhan Utama"
            :disabled="isDetail"
          />
          <CustomTextArea
            v-model="note"
            label="Catatan"
            class="col-span-2"
            :class="{ 'col-span-4': pageType == 'igd' }"
            placeholder="Catatan"
            height="h-10"
            :disabled="isDetail"
          />
        </div>
        <div v-if="selectedPaymentMethod.includes('ASURANSI')">
          <hr class="my-[30px]" />
          <div class="grid grid-cols-3 gap-y-5 gap-x-[30px]">
            <CustomSelect
              v-model="insuranceUuid"
              label="Nama Penjamin"
              placeHolder="Pilih Nama Penjamin"
              class=""
              optionLabel="name"
              optionValue="uuid"
              :showFilter="false"
              :options="listPenjamin"
              :disabled="isDetail"
              :invalid="!!errors['insurance.penjaminUuid']"
              :invalidMessage="errors['insurance.penjaminUuid']"
            />
            <CustomTextfield
              v-model="insuranceAccount"
              label="No. Penjamin"
              class=""
              placeholder="No. Penjamin"
              :disabled="isDetail"
              :invalid="!!errors['insurance.accountNumber']"
              :invalidMessage="errors['insurance.accountNumber']"
            />
            <CustomSelect
              v-model="insuranceClass"
              label="Kelas"
              placeHolder="Pilih Kelas"
              class=""
              optionLabel="name"
              optionValue="uuid"
              :showFilter="false"
              :options="[
                {
                  uuid: 'kelas1',
                  name: 'Kelas 1',
                },
                {
                  uuid: 'kelas2',
                  name: 'Kelas 2',
                },
                {
                  uuid: 'kelas3',
                  name: 'Kelas 3',
                },
                {
                  uuid: 'kelasVip',
                  name: 'Kelas VIP',
                },
                {
                  uuid: 'kelasVvip',
                  name: 'Kelas VVIP',
                },
                {
                  uuid: 'kelasReguler',
                  name: 'Kelas Reguler',
                },
                {
                  uuid: 'kelasEksekutif',
                  name: 'Kelas Eksekutif',
                },
              ]"
              :disabled="isDetail"
              :invalid="!!errors['insurance.classEntitle']"
              :invalidMessage="errors['insurance.classEntitle']"
            />
          </div>
        </div>
      </div>
    </template>
    <template #collapseIcon>
      <CustomButton
        icon="PhCaretUp"
        backgroundColor="bg-opensimrs-75"
        textColor="text-opensimrs-300"
      />
    </template>
    <template #expandIcon>
      <CustomButton
        icon="PhCaretDown"
        backgroundColor="bg-opensimrs-75"
        textColor="text-opensimrs-300"
      />
    </template>
  </CustomAccordion>
</template>
