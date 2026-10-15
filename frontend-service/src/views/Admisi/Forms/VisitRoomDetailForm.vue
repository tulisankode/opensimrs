<script setup lang="ts">
import { computed, onMounted, onUpdated, ref, watch, type PropType } from "vue";
import { utilsStore } from "@/stores/utils";
import { useMonitoringKamarStore } from "@/stores/admisi/monitoringKamar";
import { useLokasiStore } from "@/stores/datamaster/lokasi";
import { usePraktisiStore } from "@/stores/datamaster/praktisi";
import { usePenjaminStore } from "@/stores/datamaster/penjamin";
import { useKategoriRuanganStore } from "@/stores/datamaster/kategoriRuangan";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomCheckbox from "@/components/Base/CustomCheckbox.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import * as yup from "yup";
import { toTypedSchema } from "@vee-validate/yup";
import { useForm } from "vee-validate";
import { useToast } from "primevue/usetoast";


// NOTE Store
const storeUtils = utilsStore();
const monitoringKamarStore = useMonitoringKamarStore();
const lokasiStore = useLokasiStore();
const praktisiStore = usePraktisiStore();
const penjaminStore = usePenjaminStore();
const kategoriRuanganStore = useKategoriRuanganStore();
const toast = useToast();

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
  initialRoomCategory: {
    type: String,
    default: null
  },
  initialRoomClass: {
    type: String,
    default: null
  },
  initialRoom: {
    type: String,
    default: null
  },
});

const filterPoliList = ref([]);
const listDpjp = ref<any[]>([]);
const listPenjamin = ref<any[]>([]);
const listKategoriRuangan = ref<any[]>([]);

const fetchUtils = async () => {
  try {
    // FIXME Masih menggunakan api biasa dan filter by FE
    const responsePoli = await lokasiStore.getApi(0, 9999);
    if (responsePoli && responsePoli.payload) {
      filterPoliList.value = responsePoli.payload.filter(
        (lokasi: any) => lokasi.isPoli && lokasi.status
      );
    } else filterPoliList.value = [];

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
      listPenjamin.value = responsePenjamin.payload;
    } else {
      listPenjamin.value = [];
    }

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

const setFormData = () => {
  if (Object.keys(props.doctorVisitData).length) {
    let tempDoctorVisitData = props.doctorVisitData;

    noSpri.value = tempDoctorVisitData.noSpri ?? "";
    selectedRoomCategory.value = tempDoctorVisitData.kategoriRuanganUuid ?? "";
    selectedRoom.value = tempDoctorVisitData.roomUuid ?? "";
    selectedBed.value = tempDoctorVisitData.monitoringRoomUuid 
      ? [tempDoctorVisitData.monitoringRoomUuid] 
      : [];

    const classNameFromProp = tempDoctorVisitData.roomClassName;
    if (classNameFromProp) {
      const matchingClass = listKelasRuangan.value.find(
        (kelas: any) => kelas.label === classNameFromProp
      );
      if (matchingClass) {
        selectedRoomClass.value = matchingClass.value;
      }
    } else {
      selectedRoomClass.value = "";
    }

    fetchListRoomData();

    if (selectedRoom.value) {
      fetchListBedData(selectedRoom.value);
    }
    if (tempDoctorVisitData.paymentMethod == 2) {
      const tempInsurance = listPenjamin.value.find(
        (penjamin: any) => penjamin.code == tempDoctorVisitData.insurance.code
      );
      if (tempInsurance) {
        tempDoctorVisitData.insurance.penjaminUuid = tempInsurance.uuid;
      } else tempDoctorVisitData.insurance.penjaminUuid = "";
    }
    setValues({
      ...tempDoctorVisitData,
      complaint: tempDoctorVisitData.complaint || "", 
      note: tempDoctorVisitData.note || "",
    });
    onPaymentMethodSelect(
      tempDoctorVisitData.paymentMethod == "1" ? "TUNAI" : "ASURANSI"
    );
  }
};

const fetchListRoomData = async () => {
  try {
    storeUtils.setLoading(true);
    const response = await monitoringKamarStore.getMonitoringKamar({
      filterKelas: selectedRoomClass.value ?? "",
      filterKategori: [selectedRoomCategory.value ?? ""],
    });
    if (response && response.payload) {
      listRuangan.value = response.payload;
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const getRoomName = () => {
  const result = listRuangan.value.find(
    (data: any) => data.uuid == selectedRoom.value
  );
  if (result) {
    return result.name;
  } else return "-";
};



const fetchListBedData = async (uuid: string) => {
  try {
    storeUtils.setLoading(true);
    const response = await monitoringKamarStore.getDetailMonitoringKamar(uuid);

    if (response && response.payload) {
      listBed.value = [];
      listBedCadangan.value = [];
      listBoxBayi.value = [];

      const beds = Array.isArray(response.payload.detail)
        ? response.payload.detail
        : Array.isArray(response.payload)
        ? response.payload
        : [];

      beds.forEach((bed: any, idx: number) => {
        if (bed.type == "Bed") {
          listBed.value.push(bed);
        } else if (bed.type == "Bed Cadangan") {
          listBedCadangan.value.push(bed);
        } else if (bed.type == "Box Bayi") {
          listBoxBayi.value.push(bed);
        }
      });
    } else {
      listBed.value = [];
      listBedCadangan.value = [];
      listBoxBayi.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    storeUtils.setLoading(false);
  }
};


onMounted(() => {
  if (props.formType == "Daftar Bayi Baru Lahir") {
    boxBaby.value = true;
  }
  fetchUtils();
  setFormData();
});

watch(() => props.doctorVisitData, (newData) => {
    if (newData && Object.keys(newData).length > 0) {
        setFormData();
    }
}, { deep: true });


const listKelasRuangan = ref([
  { label: "Kelas 1", value: "Kelas 1" },
  { label: "Kelas 2", value: "Kelas 2" },
  { label: "Kelas 3", value: "Kelas 3" },
  { label: "VIP", value: "VIP" },
  { label: "VVIP", value: "VVIP" },
]);

const listRuangan = ref<any[]>([]);
const listBed = ref<any[]>([]);
const listBedCadangan = ref<any[]>([]);
const listBoxBayi = ref<any[]>([]);

const noSpri = ref("");
const selectedBed = ref<string[]>([]);

const selectedPaymentMethod = ref<string>("TUNAI");
const onPaymentMethodSelect = (label: string) => {
  selectedPaymentMethod.value = label;
  paymentMethod.value = label;
};

const setSelectedBed = (data: any) => {
  if (data.length) {
    monitoringRoomUuid.value = data[0];
  }
};

const schema = computed(() =>
  toTypedSchema(
    yup
      .object({
        paymentMethod: yup.string().default("TUNAI"),
        familyBill: yup.boolean().default(false),
        maternity: yup.boolean().default(false),
        entrustedPatient: yup.boolean().default(false),
        upgradeClass: yup.boolean().default(false),
        previousBill: yup.boolean().default(false),
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
          selectedRoomCategory: yup.string().required("Kategori Ruangan harus dipilih"),
          selectedRoomClass: yup.string().required("Kelas harus dipilih"),
          selectedRoom: yup.string().required("Ruangan harus dipilih"),
        practitionerUuid: yup.string().required("DPJP harus dipilih"),
        monitoringRoomUuid: yup
          .string()
          .required("Harus memilih bed terlebih dahulu"),
        spareBed: yup.boolean().default(false),
        boxBaby: yup.boolean().default(false),
      })
      .noUnknown()
  )
);

const { errors, handleSubmit, defineField, resetForm, setValues, validate } = useForm({
  validationSchema: schema,
});

const [paymentMethod] = defineField("paymentMethod");
const [practitionerUuid] = defineField("practitionerUuid");
const [complaint] = defineField("complaint");
const [familyBill] = defineField("familyBill");
const [maternity] = defineField("maternity");
const [entrustedPatient] = defineField("entrustedPatient");
const [upgradeClass] = defineField("upgradeClass");
const [previousBill] = defineField("previousBill");
const [insuranceUuid] = defineField("insurance.penjaminUuid");
const [insuranceAccount] = defineField("insurance.accountNumber");
const [insuranceClass] = defineField("insurance.classEntitle");
const [monitoringRoomUuid] = defineField("monitoringRoomUuid");
const [spareBed] = defineField("spareBed");
const [boxBaby] = defineField("boxBaby");
const [selectedRoomCategory, selectedRoomCategoryAttrs] = defineField('selectedRoomCategory');
const [selectedRoomClass, selectedRoomClassAttrs] = defineField('selectedRoomClass');
const [selectedRoom, selectedRoomAttrs] = defineField('selectedRoom');

const onSubmit = handleSubmit(
  async (values) => {
    return values;
  },
  ({ errors }) => {
    const errorKeys = Object.keys(errors);
    if (errorKeys.length > 0) {
      const firstErrorField = errorKeys[0];
      const errorMessage = errors[firstErrorField as keyof typeof errors];
      
      console.warn("❌ Validasi Gagal pada field:", firstErrorField, errorMessage);
      toast.add({
        severity: "warn",
        summary: "Data Belum Lengkap",
        detail: errorMessage, 
        life: 3000,
      });
    }
    return null;
  }
);
const onResetForm = () => {
  resetForm();
};

defineExpose({
  onSubmit,
  onResetForm,
});

watch(selectedBed, (newVal) => {
  if (newVal && newVal.length > 0) {
    monitoringRoomUuid.value = newVal[0];
  } else {
    monitoringRoomUuid.value = undefined;
  }
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
        <div
          class="grid gap-y-5 gap-x-[30px]"
          :class="[
            patientData.isNewBorn || formType == 'Daftar Bayi Baru Lahir'
              ? 'grid-cols-5'
              : 'grid-cols-2',
          ]"
        >
          <div
            class="gap-x-[30px] grid grid-cols-4"
            :class="[
              patientData.isNewBorn || formType == 'Daftar Bayi Baru Lahir'
                ? 'col-span-4'
                : 'col-span-2',
            ]"
          >
            <CustomSelect
              v-model="practitionerUuid"
              label="DPJP"
              placeHolder="Pilih DPJP"
              class="col-span-2"
              optionLabel="pegawai.name"
              optionValue="uuid"
              :options="listDpjp"
              :showFilter="false"
              :disabled="isDetail"
              :invalid="!!errors.practitionerUuid"
              :invalidMessage="errors.practitionerUuid"
            />
            <CustomTextfield
              v-model="complaint"
              label="Keluhan Utama"
              class="col-span-2"
              placeholder="Keluhan Utama"
              :disabled="isDetail"
            />
          </div>
        <CustomSwitch
          v-if="patientData.isNewBorn || formType == 'Daftar Bayi Baru Lahir'"
          v-model="familyBill"
          :disabled="isDetail"
          label="Tagihan Keluarga"
          :sideLabel="familyBill ? 'Iya' : 'Tidak'"
        />
        </div>
        <div
          v-if="!patientData.isNewBorn && formType != 'Daftar Bayi Baru Lahir'"
          class="grid gap-y-5 gap-x-[30px] mt-5"
          :class="[pageType == 'rawat-inap' ? 'grid-cols-4' : 'grid-cols-5']"
        >
          <CustomSwitch
            v-model="maternity"
            label="Pasien Maternitas"
            :sideLabel="maternity ? 'Iya' : 'Tidak'"
            :disabled="isDetail"
          />
          <CustomSwitch
            v-model="entrustedPatient"
            label="Pasien Titipan"
            :sideLabel="entrustedPatient ? 'Iya' : 'Tidak'"
            :disabled="isDetail"
          />
          <CustomSwitch
            v-model="upgradeClass"
            label="Naik Kelas"
            :sideLabel="upgradeClass ? 'Iya' : 'Tidak'"
            :disabled="isDetail"
          />
          <CustomSwitch
            v-model="previousBill"
            label="Gabung Tagihan Sebelumnya"
            :sideLabel="previousBill ? 'Iya' : 'Tidak'"
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
        <div v-if="pageType == 'rawat-inap'">
          <hr class="my-[30px]" />
          <div class="grid grid-cols-6 gap-x-[30px]">
            <CustomTextfield
              v-model="noSpri"
              label="SPRI"
              class=""
              placeholder="SPRI" 
              readOnly
            /> 
            <!-- FIXME Dummy Data -->
            <CustomSelect 
              v-model="selectedRoomCategory" 
              @update:model-value="fetchListRoomData" 
              label="Kategori Ruangan" 
              placeHolder="Pilih Kategori Ruangan" 
              class="col-span-2" 
              optionLabel="name" 
              optionValue="uuid" 
              :showFilter="false" 
              :options="[ 
                ...listKategoriRuangan, 
              ]" 
              :disabled="isDetail"
              :invalid="!!errors.selectedRoomCategory"
              :invalidMessage="errors.selectedRoomCategory"
            /> 
            <CustomSelect 
              v-model="selectedRoomClass" 
              @update:model-value="fetchListRoomData" 
              label="Kelas" 
              placeHolder="Pilih Kelas" 
              class="" 
              optionLabel="label" 
              optionValue="value" 
              :showFilter="false" 
              :options="listKelasRuangan" 
              :disabled="isDetail" 
              :invalid="!!errors.selectedRoomClass"
              :invalidMessage="errors.selectedRoomClass"
            /> 
            <CustomSelect 
              v-model="selectedRoom" 
              @update:model-value="fetchListBedData" 
              label="Ruangan" 
              placeHolder="Pilih Ruangan" 
              class="col-span-2" 
              optionLabel="name" 
              optionValue="uuid" 
              :showFilter="false" 
              :options="listRuangan" 
              :disabled="isDetail" 
              :invalid="!!errors.selectedRoom"
              :invalidMessage="errors.selectedRoom"
            />
          </div>
          <div v-if="selectedRoom" class="grid grid-cols-3 mt-[30px]">
            <div
              class=""
              :class="[
                formType == 'Daftar Bayi Baru Lahir'
                  ? 'col-span-3'
                  : 'col-span-2',
              ]"
            >
              <div>
                <div class="font-semibold text-normal">
                  <span class="text-opensimrs-300">{{ getRoomName() }}</span> >
                  Pilih Bed
                </div>
                <div class="grid grid-cols-2 gap-[10px] mr-[15px]">
                  <CustomCheckbox
                    v-for="(data, index) in listBed"
                    v-model="selectedBed"
                    @update:model-value="setSelectedBed"
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
                    :disabled="
                      !!data.patient ||
                      isDetail ||
                      formType == 'Daftar Bayi Baru Lahir' ||
                      doctorVisitData.statusRi == 3
                    "
                  />
                </div>
              </div>
              <div v-if="spareBed">
                <div class="font-semibold text-normal">
                  <span class="text-opensimrs-300">{{ getRoomName() }}</span> >
                  Pilih Bed - Cadangan
                </div>
                <div class="grid grid-cols-2 gap-[10px] mr-[15px]">
                  <CustomCheckbox
                    v-for="(data, index) in listBedCadangan"
                    v-model="selectedBed"
                    @update:model-value="setSelectedBed"
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
                    :disabled="
                      !!data.patient ||
                      isDetail ||
                      formType == 'Daftar Bayi Baru Lahir' ||
                      doctorVisitData.statusRi == 3
                    "
                  />
                </div>
              </div>
              <div v-if="boxBaby">
                <div class="mt-5 font-semibold text-normal">
                  <span class="text-opensimrs-300">{{ getRoomName() }}</span> >
                  Pilih Bed - Box Bayi
                </div>
                <div class="grid grid-cols-2 col-span-2 gap-[10px] mr-[15px]">
                  <CustomCheckbox
                    v-for="(data, index) in listBoxBayi"
                    v-model="selectedBed"
                    @update:model-value="setSelectedBed"
                    :title="data.patient ? data.patient.name : '-'"
                    :subTitle="'Box ' + data.noBed"
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
                    :disabled="
                      !!data.patient ||
                      isDetail ||
                      doctorVisitData.statusRi == 3
                    "
                  />
                </div>
              </div>
            </div>
            <div
              v-if="formType != 'Daftar Bayi Baru Lahir'"
              class="border-l-[1px] border-gray-100 pl-[15px]"
            >
              <CustomSwitch
                v-model="spareBed"
                label="Tambahan"
                class="mb-[30px]"
                sideLabel="Bed Cadangan"
                sideLabelTrue="Bed Cadangan"
                :disabled="isDetail || doctorVisitData.statusRi == 3"
              />
              <CustomSwitch
                v-model="boxBaby"
                label=""
                sideLabel="Box Bayi"
                sideLabelTrue="Box Bayi"
                :disabled="isDetail || doctorVisitData.statusRi == 3"
              />
            </div>
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
