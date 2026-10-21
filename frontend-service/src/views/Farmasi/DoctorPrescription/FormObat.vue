<script setup lang="ts">
import { ref, onMounted, watch, computed } from "vue";
import { fiturAktif } from "@/stores/modulFaskes";
import { useMedicalItemStore } from "@/stores/datamasterFarmasi/MedicalItem";
import { useHowToUseStore } from "@/stores/datamasterFarmasi/HowToUse";
import { useRulesOfUseStore } from "@/stores/datamasterFarmasi/RulesOfUse";
import { useForm, useFieldArray, ErrorMessage } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import { useDoctorPrescriptionStore } from "@/stores/farmasi/DoctorPrescription";
import { useUnitStore } from "@/stores/datamasterFarmasi/Unit";
import { usePriceConfigurationStore } from "@/stores/datamasterFarmasi/PriceConfiguration";
import * as yup from "yup";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
const props = defineProps({
  isDialogVisible: {
    default: false,
  },
  method: {
    type: String,
  },
  title: {
    type: String,
  },
  payload: {
    type: Object,
    default: () => ({}),
  },
  // identitas pasien & ringkasan klinis dari layar telaah resep (sebelumnya teks contoh ditulis mati)
  pasien: {
    type: Object,
    default: () => ({}),
  },
  ringkasan: {
    type: Object,
    default: null,
  },
});

const perempuanObat = computed(() => /^(female|p|perempuan)$/i.test(String((props.pasien as any)?.gender ?? "")));
const tglLahirObat = computed(() => {
  const t = (props.pasien as any)?.tanggalLahir;
  return t ? new Date(t).toLocaleDateString("id-ID") : "-";
});
const nilaiVital = (v: any, satuan = "") => (v === null || v === undefined || v === "" || v === 0 ? "-" : `${v}${satuan}`);

watch(
  () => props.payload,
  (newVal) => {
    console.log("payload form obat changed:", newVal);
  },
  { immediate: true, deep: true }
);

interface Racikan {
  uuid?: string;
  itemMedisUuid: string;
  qtyRacikan: number;
  isUpdated: boolean;
  isDeleted?: boolean;
  hargaSatuan?: number | null;
  jenisStokUuid?: string;
  jenisStokName?: string | null;
  namaItem?: string;
  satuan?: string;
  itemUuid?: string;
}
const doctorPrescriptionStore = useDoctorPrescriptionStore();
const medicalItemsStore = useMedicalItemStore();
const priceConfigurationStore = usePriceConfigurationStore();
const caraPakaiStore = useHowToUseStore();
const aturanPakaiStore = useRulesOfUseStore();
const unitStore = useUnitStore();
const obatPayload = ref<any[]>([]);
const caraPakaiPayload = ref<any[]>([]);
const aturanPakaiPayload = ref<any[]>([]);
const satuanDosisPayload = ref<any[]>([]);
const bentukRacikanPayload = ref<any[]>([]);
const schema = toTypedSchema(
  yup
    .object({
      aturanPakai: yup.string(),
      bentukRacikan: yup.string(),
      caraPakai: yup.string(),
      catatanResep: yup.string(),
      dosis: yup.number(),
      hargaSatuan: yup.number(),
      isChronic: yup.boolean(),
      isCompound: yup.boolean(),
      isTakeaway: yup.boolean(),
      itemMedisUuid: yup.string(),
      jenisRacikan: yup.number(),
      jenisStokName: yup.string(),
      jenisStokUuid: yup.string(),
      namaItem: yup.string(),
      orderStatus: yup.number(),
      qtySisa: yup.number(),
      rutePemberian: yup.string(),
      satuanDosis: yup.string(),
      totalHarga: yup.number(),
      totalObat: yup.number(),
      uuid: yup.string(),
      racikanItems: yup.array().of(
        yup.object({
          hargaSatuan: yup.number(),
          itemMedisUuid: yup.string(),
          jenisStokName: yup.string(),
          jenisStokUuid: yup.string(),
          namaItem: yup.string(),
          qtyRacikan: yup.number(),
          satuan: yup.string(),
          itemUuid: yup.string(),
        })
      ),
    })
    .noUnknown()
);

const { errors, handleSubmit, defineField, resetForm, setValues } = useForm({
  validationSchema: schema,
  initialValues: {},
});

const digerus = ref<boolean>();
const { remove, push, fields } = useFieldArray<Racikan>("racikanItems");

const [aturanPakai] = defineField("aturanPakai");
const [bentukRacikan] = defineField("bentukRacikan");
const [caraPakai] = defineField("caraPakai");
const [catatanResep] = defineField("catatanResep");
const [dosis] = defineField("dosis");
const [hargaSatuan] = defineField("hargaSatuan");
const [isChronic] = defineField("isChronic");
const [isCompound] = defineField("isCompound");
const [isTakeaway] = defineField("isTakeaway");
const [itemMedisUuid] = defineField("itemMedisUuid");
const [jenisRacikan] = defineField("jenisRacikan");
const [jenisStokName] = defineField("jenisStokName");
const [jenisStokUuid] = defineField("jenisStokUuid");
const [namaItem] = defineField("namaItem");
const [orderStatus] = defineField("orderStatus");
const [qtySisa] = defineField("qtySisa");
const [rutePemberian] = defineField("rutePemberian");
const [satuanDosis] = defineField("satuanDosis");
const [totalHarga] = defineField("totalHarga");
const [totalObat] = defineField("totalObat");
const [uuid] = defineField("uuid");
const [racikanItems] = defineField("racikanItems");

// Obat non-racikan tidak diganti dari form edit: penggantian lewat tombol Substitusi di detail resep
// (obat asal & alasan tercatat). Sebelumnya tombol "Subtitusi" di sini mengganti obat tanpa jejak.
const isNamaObatDisabled = computed(() => {
  if (props.method === "add") return false;
  if (digerus.value) return false;
  if ((props.payload as any)?.isCompound) return false;
  return true;
});

// Fetch obat
const fetchObat = async () => {
  try {
    const response = await medicalItemsStore.getWithoutPaginationApi("obat");
    if (response && response.payload) {
      obatPayload.value = response.payload;
    } else {
      obatPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    obatPayload.value = [];
  }
};

// Fetch cara pemakaian
const fetchCaraPemakaian = async () => {
  try {
    const response = await caraPakaiStore.getApi(1, 9999);
    if (response && response.payload) {
      caraPakaiPayload.value = response.payload;
    } else {
      caraPakaiPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    caraPakaiPayload.value = [];
  }
};
// Fetch aturan pemakaian
const fetchAturanPemakaian = async () => {
  try {
    const response = await aturanPakaiStore.getApi(1, 9999);
    if (response && response.payload) {
      aturanPakaiPayload.value = response.payload;
    } else {
      aturanPakaiPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data cara pakai", error);
    aturanPakaiPayload.value = [];
  }
};

// fetch satuan dosis
const fetchSatuanDosis = async () => {
  try {
    const response = await unitStore.getApi(1, 9999);
    if (response && response.payload) {
      satuanDosisPayload.value = response.payload;
    } else {
      satuanDosisPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    satuanDosisPayload.value = [];
  }
};
// Fetch cara pemakaian
const fetchBentukRacikan = async () => {
  try {
    const response = await priceConfigurationStore.getRacikanApi();
    if (response && response.payload) {
      bentukRacikanPayload.value = response.payload;
    } else {
      bentukRacikanPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    bentukRacikanPayload.value = [];
  }
};

onMounted(() => {
  fetchObat();
  fetchCaraPemakaian();
  fetchAturanPemakaian();
  fetchSatuanDosis();
  fetchBentukRacikan();
});

const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);
const updateVisibility = (value: any) => {
  emit("update:isDialogVisible", value);
};
const closeDialog = () => {
  emit("update:isDialogVisible", false);
  resetForm();
};

const tempDeletedRacikan = ref<Racikan[]>([]);

// isDelete Racikan
const handleRemoveRacikan = (index: number) => {
  const racikanToRemove = fields.value[index].value;
  const parseItem = JSON.parse(JSON.stringify(racikanToRemove));
  if (!parseItem.uuid) {
    tempDeletedRacikan.value.pop();
  } else {
    const tempKomponen = tempArrayRacikan.value.find(
      (temp: any) => temp.uuid === parseItem.uuid
    );

    if (tempKomponen) {
      const deletedItem = { ...tempKomponen, isDeleted: true };
      tempDeletedRacikan.value.push(deletedItem);
    }
  }
  remove(index);
};

// const tempEditRacikan = ref<Racikan[]>([]);

// isUpdated Racikan
const handleEditRacikan = ({
  index,
}: {
  index: number;
  valueItemMedis?: string;
  valueQty?: number;
}) => {
  const current = fields.value[index]?.value as Racikan | undefined;
  if (!current) return;

  const tempKomponen = tempArrayRacikan.value.find(
    (temp: any) => temp.uuid && temp.uuid === current.uuid
  );

  if (
    tempKomponen &&
    (tempKomponen.itemMedisUuid !== current.itemMedisUuid ||
      tempKomponen.qtyRacikan !== current.qtyRacikan)
  ) {
    fields.value[index].value = { ...current, isUpdated: true };
  }
};

const onSubmit = handleSubmit(async (values: any) => {
  try {
    const combinedArrayRacikanItems = [
      ...(values.racikanItems || []),
      ...tempDeletedRacikan.value,
    ];
    values.racikanItems = JSON.parse(JSON.stringify(combinedArrayRacikanItems));
    if (props.payload.isCompound || digerus.value) {
      values.isCompound = true;
      values.type = "racikan";
    } else {
      values.isCompound = false;
      values.type = "satuan";
    }

    if (!props.payload || !props.payload.uuid) {
      throw new Error("UUID is missing for edit operation");
    }
    const uuid = props.payload.uuid;
    const response = await doctorPrescriptionStore.updateObatApi(uuid, values);
    console.log("Data updated successfully:", response);
    emit("data-updated");
    closeDialog();
  } catch (error) {
    console.error("Failed to process the data:", error);
  }
});

watch(
  () => props.isDialogVisible,
  (newValue) => {
    if (newValue) {
      digerus.value = props.method === "digerus";
      if (props.method !== "add" && props.payload) {
        setValues({
          ...props.payload,
        });
        tempArrayRacikan.value =
          (props.payload as any).racikanItems ??
          (props.payload as any).racikan ??
          [];
      }
    } else {
      resetForm();
      tempArrayRacikan.value = [];
      tempDeletedRacikan.value = [];
    }
  }
);

const tempArrayRacikan = ref<Racikan[]>([]);

const handlePushRacikan = () => {
  push({
    itemMedisUuid: "",
    qtyRacikan: 0,
    isUpdated: false,
    jenisStokUuid: "",
    jenisStokName: null,
    namaItem: "",
    satuan: "",
    itemUuid: "",
  });
};
const test = ref();
</script>
<template>
  <CustomDialog
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    width="1030px"
  >
    <template #header>Edit Obat</template>
    <template #body>
      <div class="grid grid-cols-[40%,3%,57%]">
        <!-- Part 1 & Part 2 -->
        <div>
          <div class="grid grid-cols-2 gap-2">
            <div class="mt-[20px]">
              <p class="text-xs font-bold underline underline-offset-2">
                Jenis Kelamin
              </p>
              <CustomChip
                :showCheckedIcon="false"
                :label="perempuanObat ? 'Perempuan' : 'Laki-laki'"
                :bgColor="perempuanObat ? 'bg-female-75' : 'bg-male-75'"
                :textColor="perempuanObat ? 'text-female-300' : 'text-male-300'"
                customClass="h-5 border-none"
                class="mt-[10px]"
              />
            </div>
            <div class="mt-[20px]">
              <p class="text-xs font-bold underline underline-offset-2">
                Tanggal Lahir
              </p>
              <p class="text-sm mt-[10px]">
                {{ tglLahirObat }} <span class="font-bold">|</span>
                <span class="font-bold text-opensimrs-300 ml-[5px]"
                  >{{ (pasien as any)?.umur ?? "-" }}</span
                >
              </p>
            </div>
          </div>
          <!-- Part 1 -->
          <div class="grid grid-cols-1">
            <div
              class="mt-[20px] rounded-lg bg-opensimrs-50 h-[250px] grid grid-cols-2"
            >
              <!-- T.Darah -->
              <div class="flex mt-[10px] ml-[10px]">
                <p class="text-sm font-bold">T.Darah</p>
                <div class="bg-white rounded-lg h-[25px] w-[120px] ml-[10px]">
                  <p class="text-sm ml-[10px] mt-[3px]">{{ (ringkasan as any)?.tekananDarahSistole ? `${(ringkasan as any).tekananDarahSistole}/${(ringkasan as any).tekananDarahDiastole} mmHg` : "-" }}</p>
                </div>
              </div>
              <!-- Frek.Nadi -->
              <div class="flex mt-[10px] ml-[10px]">
                <p class="text-sm font-bold">Frek.Nadi</p>
                <div class="bg-white rounded-lg h-[25px] w-[100px] ml-[10px]">
                  <p class="text-sm ml-[10px] mt-[3px]">{{ nilaiVital((ringkasan as any)?.frekuensiNadi, " x/mnt") }}</p>
                </div>
              </div>
              <!-- Frek.Nafas -->
              <div class="flex mt-[10px] ml-[10px]">
                <p class="text-sm font-bold">Frek.Nafas</p>
                <div class="bg-white rounded-lg h-[25px] w-[100px] ml-[10px]">
                  <p class="text-sm ml-[10px] mt-[3px]">{{ nilaiVital((ringkasan as any)?.frekuensiNafas, " x/mnt") }}</p>
                </div>
              </div>
              <!-- Suhu -->
              <div class="flex mt-[10px] ml-[10px]">
                <p class="text-sm font-bold">Suhu</p>
                <div class="bg-white rounded-lg h-[25px] w-[50px] ml-[10px]">
                  <p class="text-sm ml-[10px] mt-[3px]">{{ nilaiVital((ringkasan as any)?.suhu, " °C") }}</p>
                </div>
              </div>
              <!-- Berat -->
              <div class="flex mt-[10px] ml-[10px]">
                <p class="text-sm font-bold">Berat</p>
                <div class="bg-white rounded-lg h-[25px] w-[60px] ml-[10px]">
                  <p class="text-sm ml-[10px] mt-[3px]">{{ nilaiVital((ringkasan as any)?.beratBadan, " kg") }}</p>
                </div>
              </div>
              <!-- Tinggi -->
              <div class="flex mt-[10px] ml-[10px]">
                <p class="text-sm font-bold">Tinggi</p>
                <div class="bg-white rounded-lg h-[25px] w-[80px] ml-[10px]">
                  <p class="text-sm ml-[10px] mt-[3px]">{{ nilaiVital((ringkasan as any)?.tinggiBadan, " cm") }}</p>
                </div>
              </div>
              <!-- Scor GCS -->
              <div class="flex mt-[10px] ml-[10px]">
                <p class="text-sm font-bold">Scor GCS</p>
                <div class="bg-white rounded-lg h-[25px] w-[50px] ml-[10px]">
                  <p class="text-sm ml-[10px] mt-[3px]">{{ nilaiVital((ringkasan as any)?.gcsScore) }}</p>
                </div>
              </div>
              <!-- Skala Nyeri -->
              <div class="flex mt-[10px] ml-[10px]">
                <p class="text-sm font-bold">Skala Nyeri</p>
                <div class="bg-white rounded-lg h-[25px] w-[50px] ml-[10px]">
                  <p class="text-sm ml-[10px] mt-[3px]">{{ nilaiVital((ringkasan as any)?.skalaNyeri) }}</p>
                </div>
              </div>
              <!-- Alergi -->
              <div class="flex mt-[10px] ml-[10px]">
                <p class="text-sm font-bold">Alergi</p>
                <div class="bg-white rounded-lg h-[25px] w-[50px] ml-[10px]">
                  <p class="text-sm ml-[10px] mt-[3px]">{{ (ringkasan as any)?.namaAlergi || "-" }}</p>
                </div>
              </div>
            </div>
          </div>
          <!-- Part 2 -->
          <div class="grid grid-cols-1">
            <div
              class="mt-[20px] rounded-lg bg-opensimrs-50 h-[160px] grid grid-cols-1"
            >
              <!-- Keluhan & Diagnosa Primer -->
              <div class="mt-[10px] ml-[10px]">
                <p class="text-sm font-bold">Keluhan</p>
                <div class="bg-white rounded-lg h-[23px] w-[370px] mt-[10px]">
                  <p class="text-sm ml-[10px] truncate">{{ (ringkasan as any)?.keluhanUtama || "-" }}</p>
                </div>
                <p class="text-sm font-bold mt-[20px]">Diagnosa Primer</p>
                <div class="bg-white rounded-lg h-[23px] w-[370px] mt-[10px]">
                  <p class="text-sm ml-[10px] truncate">
                    {{ (ringkasan as any)?.diagnosisPrimer?.split("~")[0] || "-" }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          class="bg-mediumGrey-300 w-[2px] h-[500px] mt-[20px] ml-[13px]"
        ></div>

        <!-- Form Obat -->
        <div>
          <!-- Racikan tambah obat -->
          <div
            v-if="payload.isCompound || digerus"
            class="grid grid-cols-[49%,20%,30%] gap-3 mt-[15px]"
          >
            <div>
              <CustomTextfield
                v-model="namaItem"
                label="Nama Racikan"
                placeholder="Masukkan Nama Racikan"
              />
            </div>
            <div>
              <CustomSwitch
                v-model="jenisRacikan"
                :show-label="true"
                label="Sirup"
                sideLabel="Tidak"
                sideLabelTrue="Ya"
                :true-value="1"
                :false-value="0"
              />
            </div>
            <div class="mt-[25px]">
              <CustomButton
                label="Tambah Obat"
                icon="PhPlus"
                @click="handlePushRacikan"
              />
            </div>
          </div>

          <!-- Obat non-racikan -->
          <p v-if="!payload.isCompound && !digerus" class="mt-[15px] font-bold">
            Obat 1
          </p>
          <hr class="border border-slate-200 mt-[10px]" />
          <div
            v-if="!payload.isCompound && !digerus"
            class="grid gap-2 grid-cols-[75%,25%] items-end"
          >
            <!-- Nama Obat -->
            <div class="mt-[20px]">
              <CustomSelect
                v-model="itemMedisUuid"
                place-holder="Pilih Nama Obat"
                label="Nama Obat"
                class=""
                optionLabel="name"
                optionValue="uuid"
                :options="obatPayload"
                :invalid="!!errors.itemMedisUuid"
                :invalidMessage="errors.itemMedisUuid"
                :required="errors.itemMedisUuid ? true : false"
                :disabled="isNamaObatDisabled"
              />
            </div>
            <!-- Jumlah Total -->
            <div class="mt-[20px]">
              <CustomInputNumber
                v-model="totalObat"
                label="Jumlah Total"
                :show-buttons="true"
                :invalid="!!errors.totalObat"
                :invalidMessage="errors.totalObat"
                :required="errors.totalObat ? true : false"
              />
            </div>
          </div>

          <!-- Racikan tambah obat -->
          <div
            v-if="payload.isCompound || digerus"
            v-for="(fieldsRacikan, idx) in fields"
            class="flex justify-between mt-[10px] gap-3"
          >
            <!-- Nama Obat -->
            <CustomSelect
              v-model="fieldsRacikan.value.itemMedisUuid"
              place-holder="Cari Nama Obat"
              label="Nama Obat"
              class="grow"
              optionLabel="name"
              optionValue="uuid"
              :options="obatPayload"
              :invalid="(errors as any)[`racikanItems[${idx}].itemMedisUuid`] ? true : false"
              :invalidMessage="(errors as any)[`racikanItems[${idx}].itemMedisUuid`]"
              @update:modelValue="
                handleEditRacikan({
                  index: idx,
                })
              "
            />
            <!-- Jumlah Total -->
            <CustomInputNumber
              v-model="fieldsRacikan.value.qtyRacikan"
              label="Jumlah Total"
              :show-buttons="true"
              class="w-[150px]"
              :invalid="(errors as any)[`racikanItems[${idx}].qtyRacikan`] ? true : false"
              :invalidMessage="(errors as any)[`racikanItems[${idx}].qtyRacikan`]"
              @update:modelValue="
                handleEditRacikan({
                  index: idx,
                })
              "
            />
            <CustomButton
              label=""
              background-color="bg-danger-300 rounded-lg"
              class="h-1/2 w-[40px] p-0 mt-[25px]"
              @click="handleRemoveRacikan(idx)"
            >
              <img src="@/assets/icons/delete.svg" alt="" />
            </CustomButton>
          </div>
          <!-- Racikan tambah obat -->
          <!-- Embalase -->
          <div
            v-if="payload.isCompound || digerus"
            class="flex bg-opensimrs-50 items-center gap-2.5 w-full my-5 p-5 rounded-[10px] mt-[20px]"
          >
            <div class="font-semibold">Dibuat Sebanyak (Embalase)</div>
            <CustomInputNumber
              v-model="totalObat"
              label=""
              class="w-[50px] mr-[10px]"
              :invalid="!!errors.totalObat"
              :invalidMessage="errors.totalObat"
              :required="errors.totalObat ? true : false"
            />
            <CustomSelect
              v-model="bentukRacikan"
              label=""
              :options="bentukRacikanPayload"
              option-label="namaBentukRacikan"
              option-value="namaBentukRacikan"
              :invalid="!!errors.bentukRacikan"
              :invalidMessage="errors.bentukRacikan"
              :required="errors.bentukRacikan ? true : false"
            />
          </div>

          <div class="grid grid-cols-4 gap-4 mt-5">
            <!-- Periode -->
            <CustomSelect
              place-holder=""
              label="Periode"
              class=""
              optionLabel=""
              optionValue=""
              :options="['Hari', 'Jam', 'Minggu', 'Tiap', 'Khusus']"
            />
            <!-- Aturan Pakai -->
            <CustomSelect
              v-model="aturanPakai"
              place-holder="Hari"
              label="Aturan Pakai"
              class=""
              optionLabel="name"
              optionValue="name"
              :options="aturanPakaiPayload"
              :invalid="!!errors.aturanPakai"
              :invalidMessage="errors.aturanPakai"
              :required="errors.aturanPakai ? true : false"
            />
            <!-- Jumlah Konsumsi -->
            <CustomInputNumber
              v-model="dosis"
              label="Jumlah Konsumsi"
              :show-buttons="true"
              class="truncate"
              :invalid="!!errors.dosis"
              :invalidMessage="errors.dosis"
              :required="errors.dosis ? true : false"
            />
            <!-- Satuan Dosis -->
            <CustomSelect
              v-model="satuanDosis"
              place-holder="Mg"
              label="Satuan Dosis"
              class=""
              optionLabel="name"
              optionValue="name"
              :options="satuanDosisPayload"
              :invalid="!!errors.satuanDosis"
              :invalidMessage="errors.satuanDosis"
              :required="errors.satuanDosis ? true : false"
            />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <!-- Cara Pakai -->
            <div class="mt-[20px]">
              <CustomSelect
                v-model="caraPakai"
                place-holder="Cari Cara Pakai"
                label="Cara Pakai"
                class="mr-[10px]"
                optionLabel="caraPakai"
                optionValue="caraPakai"
                :options="caraPakaiPayload"
                :invalid="!!errors.caraPakai"
                :invalidMessage="errors.caraPakai"
                :required="errors.caraPakai ? true : false"
              />
            </div>
            <!-- Rute Pemberian -->
            <div class="mt-[20px]">
              <CustomSelect
                v-model="rutePemberian"
                place-holder="Cari Rute Pemberian"
                label="Rute Pemberian"
                class=""
                optionLabel=""
                optionValue=""
                :options="[
                  'Implant',
                  'Inhalation',
                  'Instillation',
                  'nasal',
                  'oral',
                  'parental',
                  'rectal',
                  'sublingual',
                  'transdermal',
                  'vaginal',
                ]"
              />
            </div>
            <!-- Obat Pulang -->
            <!-- <div class="mt-[10px]">
              <CustomSwitch
                v-model="isTakeaway"
                :show-label="true"
                label="Obat Pulang"
                sideLabel="Tidak"
                sideLabelTrue="Ya"
              />
            </div> -->
            <!-- Obat Kronis -->
            <div v-if="fiturAktif('farmasi_obat_kronis')" class="mt-[10px]">
              <CustomSwitch
                v-model="isChronic"
                :show-label="true"
                label="Obat Kronis"
                sideLabel="Tidak"
                sideLabelTrue="Ya"
              />
            </div>
            <!-- Catatan -->
            <div class="mt-[10px]">
              <CustomTextArea
                v-model="catatanResep"
                label="Catatan"
                placeholder="-"
                class="mr-[10px]"
              />
            </div>
            <!-- Alasan Diganti -->
            <!-- <div class="mt-[10px]">
              <CustomTextArea
                :label="
                  payload.isCompound ? 'Alasan Diganti' : 'Alasan Digerus'
                "
                :placeholder="
                  payload.isCompound
                    ? 'Masukan alasan diganti'
                    : 'Masukan alasan digerus'
                "
              />
            </div> -->
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end">
        <CustomButton
          label="Reset"
          outlined
          class=""
          borderColor="border-grey-200"
          textColor="text-grey-300"
          @click="resetForm"
        />
        <CustomButton @click="onSubmit" label="Simpan Edit" class="ml-[10px]" />
      </div>
    </template>
  </CustomDialog>
</template>
