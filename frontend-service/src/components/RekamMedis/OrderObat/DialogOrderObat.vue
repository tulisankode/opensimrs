<script lang="ts" setup>
import CustomButton from "@/components/Base/CustomButton.vue";
import { fiturAktif } from "@/stores/modulFaskes";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import { onMounted, onUpdated, ref, type PropType } from "vue";
import { useForm, useFieldArray, ErrorMessage } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import DialogTambahObat from "./DialogTambahObat.vue";
import DialogEdit from "./DialogEdit.vue";
import DialogObatRacikan from "./DialogObatRacikan.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import { utilsStore } from "@/stores/utils";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { useDoctorPrescriptionStore } from "@/stores/farmasi/DoctorPrescription";
import { useStockLocationStore } from "@/stores/datamasterFarmasi/StockLocation";
import { urutkanLokasiTujuan } from "@/utils/Helpers";
import { useMedicalItemStore } from "@/stores/datamasterFarmasi/MedicalItem";
import { useHowToUseStore } from "@/stores/datamasterFarmasi/HowToUse";
import { useUnitStore } from "@/stores/datamasterFarmasi/Unit";
import { useRulesOfUseStore } from "@/stores/datamasterFarmasi/RulesOfUse";
import { usePriceConfigurationStore } from "@/stores/datamasterFarmasi/PriceConfiguration";

// NOTE Store
const storeUtils = utilsStore();
const rekamMedisStore = useRekamMedisStore();
const doctorPrescriptionStore = useDoctorPrescriptionStore();
const stockLocationStore = useStockLocationStore();
const medicalItemStore = useMedicalItemStore();
const rulesOfUseStore = useRulesOfUseStore();
const unitStore = useUnitStore();
const howToUseStore = useHowToUseStore();
const priceConfigurationtore = usePriceConfigurationStore();

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: "Tambah",
  },
  method: {
    type: String,
    default: "add",
  },
  rmType: {
    type: String,
    default: "rawat-jalan",
  },
  patientData: {
    type: Object,
  },
  rmUuid: {
    type: String,
    default: "",
  },
  sessionUuid: {
    type: String,
    default: "",
  },
  type: {
    type: String,
    default: "",
  },
  obatOrder: {
    type: Object,
    default: () => {},
  },
});

const dialogTambahData = ref({
  isVisible: false,
  title: "Tambah Obat",
});

const dialogEditData = ref({
  isVisible: false,
  title: "Edit",
  obatToEdit: null as any | null,
});

const dialogRacikanData = ref({
  isVisible: false,
  title: "Tambah Obat Racikan",
  obatToEdit: null as any | null,
  type: "add",
});

const emit = defineEmits([
  "update:isDialogVisible",
  "submitOrder",
  "deleteObat",
]);

function updateVisibility(value: boolean) {
  emit("update:isDialogVisible", value);
}

const orderObatschema = toTypedSchema(
  yup.object({
    selectedLokasiTujuanOrder: yup.string(),
    obatPulang: yup.bool(),
  })
);

const { errors, handleSubmit, resetForm, defineField } = useForm({
  validationSchema: orderObatschema,
  initialValues: {
    selectedLokasiTujuanOrder: "",
    obatPulang: false,
  },
});

const [selectedLokasiTujuanOrder] = defineField("selectedLokasiTujuanOrder");
const [obatPulang] = defineField("obatPulang");

const listLokasiTujuanOrder = ref<any[]>([]);
const orderObats = ref<any[]>([]);

const namaObats = ref<any[]>([]);
const periodes = ref([
  { id: 1, periode: "Hari" },
  { id: 2, periode: "Minggu" },
  { id: 3, periode: "Jam" },
  { id: 4, periode: "Tiap" },
  { id: 5, periode: "Khusus" },
]);
const aturanPakais = ref<any[]>([]);
const satuanDosiss = ref<any[]>([]);
const caraPakais = ref<any[]>([]);
const rutePemberians = ref([
  { kode: "Implant", rutePemberian: "Implant" },
  { kode: "Inhal", rutePemberian: "Inhalation" },
  { kode: "Instill", rutePemberian: "Instillation" },
  { kode: "N", rutePemberian: "nasal" },
  { kode: "O", rutePemberian: "oral" },
  { kode: "P", rutePemberian: "parenteral" },
  { kode: "R", rutePemberian: "rectal" },
  { kode: "SL", rutePemberian: "sublingual/buccal/oromucosal" },
  { kode: "TD", rutePemberian: "transdermal" },
  { kode: "V", rutePemberian: "vaginal" },
]);
const listBentukRacikan = ref<any[]>([]);

onMounted(async () => {
  await Promise.all([
    fetchLokasiTujuanStok(),
    getListObat(),
    getListAturanPakai(),
    getListSatuanDosis(),
    getListCaraPakai(),
    getBentukRacikanSediaan()
  ]);
});

onUpdated(() => {
  if (props.type == "edit") {
    selectedLokasiTujuanOrder.value = props.obatOrder.lokasiStokUuid;
    obatPulang.value = props.obatOrder.isTakeaway;
    orderObats.value = reverseTransformPayloadData(props.obatOrder.obatItems);
  }
});

const fetchLokasiTujuanStok = async () => {
  const response = await stockLocationStore.getApi(
    1,
    9999,
    "",
    "",
    props.rmType == "rawat-inap"
      ? "0"
      : props.rmType == "rawat-jalan"
      ? "1"
      : props.rmType == "igd"
      ? "2"
      : "3"
  );
  if (response && response.payload) {
    listLokasiTujuanOrder.value = urutkanLokasiTujuan(
      response.payload.filter((lokasiTujuan: any) => lokasiTujuan.status)
    );
    if (listLokasiTujuanOrder.value.length > 0) {
      if (!selectedLokasiTujuanOrder.value) {
        selectedLokasiTujuanOrder.value = listLokasiTujuanOrder.value[0].uuid;
      }
    }
  }
};

const getListObat = async () => {
  const response = await medicalItemStore.getWithoutPaginationApi2();
  if (response && response.payload) {
    namaObats.value = response.payload;
  }
};

const getListAturanPakai = async () => {
  const response = await rulesOfUseStore.exportApi();
  if (response && response.payload) {
    aturanPakais.value = response.payload;
  }
};

const getListSatuanDosis = async () => {
  const response = await unitStore.exportApi();
  if (response && response.payload) {
    satuanDosiss.value = response.payload.filter(
      (unit: any) => unit.satuanDosis
    );
  }
};

const getListCaraPakai = async () => {
  const response = await howToUseStore.exportApi();
  if (response && response.payload) {
    caraPakais.value = response.payload;
  }
};

const getBentukRacikanSediaan = async () => {
  const response = await priceConfigurationtore.getRacikanApi();
  if (response && response.payload) {
    listBentukRacikan.value = response.payload;
  }
};


const dialogDetailData = ref({
  isVisible: false,
  title: "",
  obatDetail: null as any | null,
});

const selectedObatIndex = ref(0);


function handleAdd() {
  dialogTambahData.value.isVisible = true;
}

// Detail Dialog
function handleDetail() {
  const obatDetail = orderObats.value;
  dialogDetailData.value = {
    isVisible: true,
    title: "Detail Obat",
    obatDetail: obatDetail,
  };
}

function handleAddRacikan() {
  dialogRacikanData.value.isVisible = true;
  dialogRacikanData.value.type = "add";
}



function handleEdit(index: number) {
  const obatToEdit = orderObats.value[index];

  if (obatToEdit.isCompound) {
    dialogRacikanData.value = {
      isVisible: true,
      title: "Edit Obat Racikan",
      obatToEdit: { ...obatToEdit },
      type: "edit",
    };
    selectedObatIndex.value = index;
  } else {
    dialogEditData.value = {
      isVisible: true,
      title: "Edit",
      obatToEdit: { ...obatToEdit },
    };
    selectedObatIndex.value = index;
  }

}

const handleAddObat = (newObat: any) => {
  orderObats.value.push(...newObat);
};

const handleEditObat = async (updatedObat?: any) => {
  if (updatedObat && selectedObatIndex.value !== null && typeof selectedObatIndex.value === 'number') {
    orderObats.value[selectedObatIndex.value] = updatedObat;

  } 
  else if (props.type === 'edit' && props.obatOrder && props.obatOrder.uuid) {
    try {
      storeUtils.setLoading(true);
      const resultRefetch = await doctorPrescriptionStore.detailApi(
        props.obatOrder.uuid
      );
      if (resultRefetch && resultRefetch.payload) {
        orderObats.value = reverseTransformPayloadData(resultRefetch.payload.obatItems);
      }
    } catch (e) {
      console.error("Gagal refetch data obat:", e);
    } finally {
      storeUtils.setLoading(false);
    }
  }
};

function handleAddObatRacikan(newObat: any) {
  if (Array.isArray(newObat)) {
    orderObats.value.push(newObat[0]);
  } else {
    orderObats.value.push(newObat);
  }
}

const deleteObat = async (index: number, data: any) => {
  if (props.type == "add") {
    orderObats.value.splice(index, 1);
  } else {
    try {
      storeUtils.setLoading(true);
      const result = await doctorPrescriptionStore.deleteObatApi(data.uuid);
      if (result && result.data.sucess) {
        const resultRefetch = await doctorPrescriptionStore.detailApi(
          props.obatOrder.uuid
        );
        if (resultRefetch && resultRefetch.payload) {
          orderObats.value = reverseTransformPayloadData(
            resultRefetch.payload.obatItems
          );
        }
      }
    } catch (error) {
      console.error("Failed to post data", error);
    } finally {
      storeUtils.setLoading(false);
    }
  }
};

const onSubmit = handleSubmit(async (values: any) => {
  try {
    storeUtils.setLoading(true);
    let response: any;

    if (props.type == "add") {
      response = await doctorPrescriptionStore.createPrescription({
        noReg: props.patientData?.noReg,
        noRm: props.patientData?.noRm,
        isTakeaway: obatPulang.value,
        patientUuid: props.patientData?.patient.uuid,
        lokasiStokUuid: selectedLokasiTujuanOrder.value,
        jenisPelayanan:
          props.rmType == "rawat-jalan"
            ? "rj"
            : props.rmType == "rawat-inap"
            ? "ri"
            : props.rmType == "igd"
            ? "igd"
            : "fisio",
        sessionUuid: props.sessionUuid,
        rekamMedisUuid: props.rmUuid,
        // Poli/ruang asal order (tampil & filter di daftar resep farmasi).
        lokasiUuid: rekamMedisStore.openedRekamMedis?.meta?.lokasiUuid ?? props.patientData?.lokasi?.uuid ?? "",
        paymentMethod: props.patientData?.paymentMethod,
        obat: transformPayloadData(),
      });
    } else {
      const itemsToAdd = transformPayloadData().filter((data: any) => data);
      const headerResponse = await doctorPrescriptionStore.updatePrescription(props.obatOrder.uuid, {
        isTakeaway: obatPulang.value,
        lokasiStokUuid: selectedLokasiTujuanOrder.value,
      });
      if (itemsToAdd.length > 0) {
        const addItemsResponse = await doctorPrescriptionStore.addObatPrescription({
          prescriptionUuid: props.obatOrder.uuid,
          obat: itemsToAdd,
        });
        response = addItemsResponse;
      } else {
        response = headerResponse;
      }
    }
    if (response) {
      if (response.payload) {
        rekamMedisStore.setAsesmentRekamMedisData(response.payload);
      }
      emit("submitOrder");
      emit("update:isDialogVisible", false);
      resetFormFields();
      resetForm();
    }
  } catch (error) {
    console.error("Failed to post data", error);
  } finally {
    setTimeout(() => {
      storeUtils.setLoading(false);
    }, 300);
  }
});

const transformPayloadData = () => {
  return orderObats.value.map((dataObat) => {
    if (!dataObat.uuid) {
      const qty = dataObat.medicationQty !== undefined ? dataObat.medicationQty : (dataObat.totalObat || 0);
      const doseQty = dataObat.medicationDoseQty !== undefined ? dataObat.medicationDoseQty : (dataObat.dosis || 0);

      const baseData = {
        medicationQty: dataObat.totalObat || qty || 0,
        itemMedisUuid: "-",
        medicationDoseQty: dataObat.dosis || doseQty || 0,
        medicationDoseSatuanUuid: dataObat.medicationDoseSatuan?.uuid || "",
        medicationPeriod: dataObat.medicationPeriod || "",
        aturanPakaiUuid: dataObat.aturanPakai?.uuid || "",
        caraPakaiUuid: dataObat.caraPakai?.uuid || "",
        prescriptionNotes: dataObat.prescriptionNotes || "",
        isChronic: dataObat.isChronic || false,
        route: dataObat.route?.kode || "",
      };

      if (dataObat.isCompound) {
        return {
          ...baseData,
          itemMedisUuid: "-",
          isCompound: true,
          namaRacikan: dataObat.namaRacikan || "",
          jenisRacikan: dataObat.jenisRacikan ? 1 : 0,
          bentukRacikanUuid: dataObat.bentukRacikan?.uuid || "",
          racikan: dataObat.racikan.map((obatRacikan: any) => ({
            itemMedisUuid: obatRacikan.itemMedis.uuid,
            medicationQty: obatRacikan.jumlahTotal || 0,
          })),
        };
      } else {
        return {
          ...baseData,
          itemMedisUuid: dataObat.itemMedis.uuid || "",
          medicationQty: dataObat.medicationQty || 0,
        };
      }
    }
  });
};

const reverseTransformPayloadData = (transformedData: any[]) => {
  if (!Array.isArray(transformedData)) return [];

  return transformedData.map((data) => {
    const doseUnitUuid = data.medicationDoseSatuanUuid || data.medication_dose_satuan_uuid;
    const doseUnitName = data.satuanDosis || data.satuan_dosis;
    
    let medicationDoseSatuan = satuanDosiss.value.find(
      (s: any) => s.uuid === doseUnitUuid
    );
    
    if (!medicationDoseSatuan && doseUnitName) {
       medicationDoseSatuan = satuanDosiss.value.find(
        (s: any) => s.name === doseUnitName
       ) || { name: doseUnitName, uuid: null };
    }

    const routeCode = data.rutePemberian || data.rute_pemberian || null;
    const baseData = {
      uuid: data.uuid,
      medicationQty: data.medicationQty || data.medication_qty || data.totalObat || data.total_obat || 1,
      medicationDoseQty: data.medicationDoseQty || data.medication_dose_qty || data.dosis || 1,
      medicationDoseSatuan: medicationDoseSatuan,
      medicationPeriod: data.medicationPeriod || data.medication_period || data.periode || null,
      aturanPakai:
        aturanPakais.value.find(
          (item: any) => item.name === (data.aturanPakai || data.aturan_pakai)
        ) || { name: data.aturanPakai || data.aturan_pakai },
      
      caraPakai:
        caraPakais.value.find(
          (item: any) => item.caraPakai === (data.caraPakai || data.cara_pakai)
        ) || { caraPakai: data.caraPakai || data.cara_pakai },

      prescriptionNotes: data.catatanResep || data.catatan_resep || "",
      isChronic: data.isChronic || data.is_chronic || false,
      route:
        rutePemberians.value.find((item: any) => item.kode === routeCode) || null,
    };
    if (data.isCompound || data.is_compound || data.is_compound_flag) {
      const bentukRacikanStr = data.bentukRacikan || data.bentuk_racikan;
      let bentukObj = listBentukRacikan.value.find(
        (item: any) => item.uuid === data.bentukRacikanUuid
      );
      if (!bentukObj && bentukRacikanStr) {
        bentukObj = listBentukRacikan.value.find(
          (item: any) => item.namaBentukRacikan === bentukRacikanStr
        );
        if (!bentukObj) bentukObj = { namaBentukRacikan: bentukRacikanStr, uuid: null };
      }

      return {
        ...baseData,
        isCompound: true,
        namaRacikan: data.namaRacikan || data.namaItem || data.nama_item,
        jenisRacikan: (data.jenisRacikan === 1 || data.jenis_racikan === 1),
        bentukRacikan: bentukObj,
        racikan: (data.racikanItems || data.racikan_items || []).map((obatRacikan: any) => ({
          uuid: obatRacikan.uuid,
          itemMedis:
            namaObats.value.find(
              (item: any) => item.uuid === (obatRacikan.itemMedisUuid || obatRacikan.item_medis_uuid)
            ) || { name: obatRacikan.namaItem || obatRacikan.nama_item },
          jumlahTotal: obatRacikan.qty_racikan || obatRacikan.medicationQty || 1,
        })),
      };
    } else {
      return {
        ...baseData,
        itemMedis:
          namaObats.value.find(
            (item: any) => item.uuid === (data.itemMedisUuid || data.item_medis_uuid)
          ) || { name: data.namaItem || data.nama_item, uuid: data.itemMedisUuid },
        isCompound: false,
      };
    }
  });
};


const getStringRutePembelian = (code: string) => {
  if (code == "Implant") return code;
  else if (code == "Inhal") return "Inhalation";
  else if (code == "Instill") return "Instillation";
  else if (code == "N") return "nasal";
  else if (code == "O") return "oral";
  else if (code == "P") return "parenteral";
  else if (code == "R") return "rectal";
  else if (code == "SL") return "sublingual/buccal/oromucosal";
  else if (code == "TD") return "transdermal";
  else if (code == "V") return "vaginal";
};

const resetFormFields = () => {
  resetForm();
  orderObats.value = [];
};
</script>
<template>
  <CustomDialog
    width="1000px"
    :visible="isDialogVisible"
    headerBg="bg-opensimrs-300"
    @update:visible="updateVisibility"
  >
    <template #header>{{ title }}</template>
    <template #body>
      <div class="flex flex-col gap-5 py-3">
        <div class="flex gap-7">
          <CustomSelect
            prepend-icon="PhMagnifyingGlass"
            v-model="selectedLokasiTujuanOrder"
            :options="listLokasiTujuanOrder"
            optionLabel="name"
            optionValue="uuid"
            label="Lokasi Tujuan Order"
            place-holder="Pilih Lokasi Tujuan Order"
            class="grow"
          />

          <CustomSwitch label="Obat Pulang" v-model="obatPulang" />
          <div class="flex items-end gap-2.5">
            <CustomButton
              icon="PhPlus"
              label="Obat"
              textColor="text-white"
              @click="handleAdd"
            />
            <CustomButton
              v-if="fiturAktif('farmasi_racikan')"
              icon="PhPlus"
              label="Obat Racikan"
              textColor="text-white"
              @click="handleAddRacikan"
            />
          </div>
        </div>

        <DataTable
          :value="orderObats"
          class="overflow-y-scroll text-xs bg-opensimrs-50 max-h-[300px]"
          scrollable
          scrollHeight="flex"
          table-style="min-width:50 rem"
        >
          <Column
            headerClass="bg-opensimrs-50 font-semibold text-SM"
            class="max-w-[60px] text-center"
          >
            <template #header>
              <div class="w-full text-center">No.</div>
            </template>
            <template #body="slotProps">
              <div class="flex items-center justify-center">
                {{ slotProps.index + 1 }}
              </div>
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50" class="w-auto text-left">
            <template #header>
              <div class="w-full font-semibold text-left">Nama Obat</div>
            </template>
            <template #body="slotProps">
              <div v-if="slotProps.data.isCompound">
                {{ slotProps.data.namaRacikan }}
                {{
                  slotProps.data.bentukRacikan
                    ? `- ${slotProps.data.bentukRacikan.namaBentukRacikan}`
                    : ""
                }}
              </div>
              <div v-else>
                {{ slotProps.data.itemMedis?.name }}
              </div>
              <div class="flex gap-1.5 justify-left">
                <CustomChip
                  v-if="slotProps.data.isChronic"
                  :showCheckedIcon="false"
                  label="OBAT KRONIS"
                  bgColor="bg-sunFlower-50"
                  textColor="text-sunFlower-300"
                  customClass="h-5 border-sunFlower-300"
                />
              </div>
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50" class="w-auto text-left">
            <template #header>
              <div class="w-full font-semibold text-left">Total Obat</div>
            </template>
            <template #body="slotProps">
              {{ slotProps.data.medicationQty }} 
              <span v-if="slotProps.data.isCompound">
                - {{ slotProps.data.bentukRacikan?.namaBentukRacikan }}
              </span>
              <span v-else>
                - {{ slotProps.data.itemMedis?.satuanPenggunaan?.name }}
              </span>
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50" class="w-auto text-left">
            <template #header>
              <div class="w-full font-semibold text-left">Dosis</div>
            </template>
            <template #body="slotProps">
              {{ slotProps.data.medicationDoseQty }}
              {{ slotProps.data.medicationDoseSatuan?.name }}
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50" class="w-auto text-left">
            <template #header>
              <div class="w-full font-semibold text-left">Aturan Pakai</div>
            </template>
            <template #body="slotProps">
              {{ slotProps.data.aturanPakai?.name || slotProps.data.aturanPakai }}
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50" class="w-auto text-left">
            <template #header>
              <div class="w-full font-semibold text-left">Cara Pakai</div>
            </template>
            <template #body="slotProps">
              {{ slotProps.data.caraPakai?.caraPakai || slotProps.data.caraPakai }}
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50" class="w-auto text-left">
            <template #header>
              <div class="w-full font-semibold text-left">Rute Pemberian</div>
            </template>
            <template #body="slotProps">
              {{ slotProps.data.route?.rutePemberian }}
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50" class="w-auto">
            <template #header>
              <div class="w-full font-semibold text-center">Status</div>
            </template>
            <template #body="slotProps">
              <div class="flex justify-center gap-1.5">
                <CustomButton
                  label=""
                  background-color="bg-[#3D84E5] rounded-lg"
                  class="h-6 w-[26px] p-0"
                  @click="handleEdit(slotProps.index)"
                >
                  <img src="@/assets/icons/edit.svg" alt="Edit" />
                </CustomButton>
                <CustomButton
                  label=""
                  background-color="bg-danger-300 rounded-lg"
                  class="h-6 w-[26px] p-0"
                  @click="deleteObat(slotProps.index, slotProps.data)"
                >
                  <img src="@/assets/icons/delete.svg" alt="Delete" />
                </CustomButton>
              </div>
            </template>
          </Column>
        </DataTable>
      </div>

      <DialogTambahObat
        v-model:isDialogVisible="dialogTambahData.isVisible"
        :title="dialogTambahData.title"
        :patientData="patientData"
        @add-obat="handleAddObat"
      />

      <DialogEdit
        v-model:isDialogVisible="dialogEditData.isVisible"
        :title="dialogEditData.title"
        :obatToEdit="dialogEditData.obatToEdit"
        :patientData="patientData"
        @update-obat="handleEditObat"
        :index="selectedObatIndex"
        :editedObatOrder="props.obatOrder"
      />

      <DialogObatRacikan
        v-model:is-dialog-visible="dialogRacikanData.isVisible"
        :title="dialogRacikanData.title"
        :patientData="patientData"
        @add-obat-racikan="handleAddObatRacikan"
        :index="selectedObatIndex"
        :obatToEdit="dialogRacikanData.obatToEdit"
        :prescriptionUuid="props.obatOrder?.uuid ?? ''"
        :type="dialogRacikanData.type"
        @update-obat="handleEditObat"
      />
    </template>
    <template #footer>
      <div class="w-full">
        <div class="mt-5 flex justify-end gap-2.5">
          <!-- <CustomButton
            label="Reset"
            borderColor="border-2 border-[#9DA4B1]"
            background-color="bg-transparent"
            text-color="text-grey-300"
            @click="resetFormFields"
          /> -->
          <CustomButton label="Simpan & Order Resep" @click="onSubmit" />
        </div>
      </div>
    </template>
  </CustomDialog>
</template>