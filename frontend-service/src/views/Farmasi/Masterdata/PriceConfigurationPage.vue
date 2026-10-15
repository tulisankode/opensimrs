<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { usePriceConfigurationStore } from "@/stores/datamasterFarmasi/PriceConfiguration";
import { utilsStore } from "@/stores/utils";
import { epochToDate } from "@/utils/Helpers";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import NoData from "@/components/section/NoData.vue";
import AddPriceConfiguration from "./DialogPriceConfiguration/AddPriceConfiguration.vue";
import DeletePriceConfiguration from "./DialogPriceConfiguration/DeletePriceConfiguration.vue";

// Initial Values
const PriceConfigurationPayload = ref({
  id: "",
  uuid: "",
  faskesUuid: "",
  metodePemotonganStok: "",
  metodeHpp: "",
  ppn: 0,
  margin: 0,
  biayaEmbalaseRacik: true,
  metodeBiayaRacikan: "",
  petugas: "",
  createdAt: 0,
  updatedAt: "",
  deletedAt: null,
});

// State Management
const PriceConfigurationStore = usePriceConfigurationStore();
const UseUtilsStore = utilsStore();
const HerbFormPayload = ref<any[]>([]);
const initialHerbForm = ref<any[]>([]);
const BASELINE_KEY = "price_cfg_initial_herb";
const loadBaseline = () => {
  try {
    const raw = sessionStorage.getItem(BASELINE_KEY);
    if (raw) initialHerbForm.value = JSON.parse(raw) || [];
  } catch {}
};
const saveBaseline = () => {
  try {
    sessionStorage.setItem(
      BASELINE_KEY,
      JSON.stringify(initialHerbForm.value ?? [])
    );
  } catch {}
};

// Check if Data Exists
const hasData = computed(
  () => HerbFormPayload.value && HerbFormPayload.value.length > 0
);

// Fetch Price Configuration
const fetchPriceConfiguration = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await PriceConfigurationStore.getApiKonfig();
    if (response && response.payload) {
      PriceConfigurationPayload.value = response.payload;

      // Metode Pemotongan Stok
      if (PriceConfigurationPayload.value.metodePemotonganStok == "FIFO") {
        statusFIFO.value = "FIFO";
      } else if (
        PriceConfigurationPayload.value.metodePemotonganStok == "LIFO"
      ) {
        statusLIFO.value = "LIFO";
      } else if (
        PriceConfigurationPayload.value.metodePemotonganStok == "FEFO"
      ) {
        statusFEFO.value = "FEFO";
      } else {
        statusFIFO.value = "false";
        statusLIFO.value = "false";
        statusFEFO.value = "false";
      }

      // Metode Hpp
      if (PriceConfigurationPayload.value.metodeHpp == "average") {
        statusRata.value = "average";
      } else if (PriceConfigurationPayload.value.metodeHpp == "last") {
        statusHargaTerakhir.value = "last";
      } else {
        statusRata.value = "false";
        statusHargaTerakhir.value = "false";
      }

      // Konfigurasi Biaya Embalase & Racik
      if (PriceConfigurationPayload.value.metodeBiayaRacikan == "paket") {
        bentukRacikan.value = "paket";
      } else if (PriceConfigurationPayload.value.metodeBiayaRacikan == "item") {
        itemEmbalase.value = "item";
      } else {
        bentukRacikan.value = "false";
        itemEmbalase.value = "false";
      }
      statusEmbalase.value = PriceConfigurationPayload.value.biayaEmbalaseRacik;
      ppn.value = PriceConfigurationPayload.value.ppn;
      margin.value = PriceConfigurationPayload.value.margin;
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// Fetch Herb Form
const fetchHerbForm = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await PriceConfigurationStore.getApi();
    if (response && response.payload) {
      HerbFormPayload.value = response.payload;
      if (initialHerbForm.value.length === 0) {
        initialHerbForm.value = [...HerbFormPayload.value];
        saveBaseline();
      }
    } else {
      HerbFormPayload.value = [];
      if (initialHerbForm.value.length === 0) {
        initialHerbForm.value = [];
        saveBaseline();
      }
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    HerbFormPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// Dialog Management
const PriceConfigurationDialog = ref(false);
const DeletePriceConfigurationDialog = ref(false);

const dialogConfig = ref<any>({
  method: "add",
  title: "Tambah",
  data: null,
});

const openDialog = (method: string, title: string, data: any = null) => {
  dialogConfig.value = { method, title, data };
  PriceConfigurationDialog.value = true;
};

const deleteDialog = (method: string, title: string, data: any = null) => {
  dialogConfig.value = { method, title, data };
  DeletePriceConfigurationDialog.value = true;
};

const confirmDelete = async (item: any) => {
  // console.log(item,'item');
  if (item) {
    UseUtilsStore.setLoading(true);
    try {
      await PriceConfigurationStore.deleteApi(item.uuid);
      fetchHerbForm();
    } catch (error) {
      console.error("Failed to delete data", error);
    } finally {
      UseUtilsStore.setLoading(false);
      DeletePriceConfigurationDialog.value = false;
    }
  }
};

const schema = toTypedSchema(
  yup
    .object({
      statusFIFO: yup.string().default("false"),
      statusLIFO: yup.string().default("false"),
      statusFEFO: yup.string().default("false"),
      statusHargaTerakhir: yup.string().default("false"),
      statusRata: yup.string().default("false"),
      statusEmbalase: yup.bool().default(true),
      bentukRacikan: yup.string().default("false"),
      itemEmbalase: yup.string().default("false"),
      ppn: yup
        .number()
        .typeError("PPN harus diisi dengan angka")
        .min(0, "PPN tidak boleh negatif")
        .required(""),
      margin: yup
        .number()
        .typeError("Margin harus diisi dengan angka")
        .min(0, "Margin tidak boleh negatif")
        .required(""),
    })
    .noUnknown()
);

const { errors, handleSubmit, defineField } = useForm({
  validationSchema: schema,
});

const [statusFIFO] = defineField("statusFIFO");
const [statusLIFO] = defineField("statusLIFO");
const [statusFEFO] = defineField("statusFEFO");
const [statusHargaTerakhir] = defineField("statusHargaTerakhir");
const [statusRata] = defineField("statusRata");
const [statusEmbalase] = defineField("statusEmbalase");
const [bentukRacikan] = defineField("bentukRacikan");
const [itemEmbalase] = defineField("itemEmbalase");
const [ppn] = defineField("ppn");
const [margin] = defineField("margin");

const onSubmit = handleSubmit(async (values) => {
  UseUtilsStore.setLoading(true);
  try {
    const payload = {
      metodePemotonganStok: [
        values.statusFIFO,
        values.statusLIFO,
        values.statusFEFO,
      ].find((data: string) => data !== "false"),
      metodeHpp: [values.statusHargaTerakhir, values.statusRata].find(
        (data: string) => data !== "false"
      ),
      ppn: values.ppn,
      margin: values.margin,
      biayaEmbalaseRacik: values.statusEmbalase,
      metodeBiayaRacikan: [values.bentukRacikan, values.itemEmbalase].find(
        (data: string) => data !== "false"
      ),
    };
    await PriceConfigurationStore.putApiKonfig(payload);
    initialHerbForm.value = [...HerbFormPayload.value];
    saveBaseline();
    fetchPriceConfiguration();
  } catch (error: any) {
    console.log(error.message, "error");
  } finally {
    UseUtilsStore.setLoading(false);
  }
});

const normalizeConfig = (p: any) => ({
  metodePemotonganStok: p?.metodePemotonganStok || "false",
  metodeHpp: p?.metodeHpp || "false",
  ppn: Number(p?.ppn ?? 0),
  margin: Number(p?.margin ?? 0),
  biayaEmbalaseRacik: Boolean(p?.biayaEmbalaseRacik),
  metodeBiayaRacikan: p?.metodeBiayaRacikan || "false",
});

const pickActive = (vals: Array<string | undefined>) => {
  const found = vals.find((d) => d && d !== "false");
  return found ?? "false";
};

const currentConfig = computed(() => ({
  metodePemotonganStok: pickActive([
    statusFIFO.value,
    statusLIFO.value,
    statusFEFO.value,
  ]),
  metodeHpp: pickActive([statusHargaTerakhir.value, statusRata.value]),
  ppn: Number(ppn.value ?? 0),
  margin: Number(margin.value ?? 0),
  biayaEmbalaseRacik: Boolean(statusEmbalase.value),
  metodeBiayaRacikan: pickActive([bentukRacikan.value, itemEmbalase.value]),
}));

const initialConfig = computed(() =>
  normalizeConfig(PriceConfigurationPayload.value)
);

const hasChanges = computed(() => {
  const a = currentConfig.value;
  const b = initialConfig.value;
  const herbChanged =
    JSON.stringify(HerbFormPayload.value) !==
    JSON.stringify(initialHerbForm.value);
  const configChanged = !(
    a.metodePemotonganStok === b.metodePemotonganStok &&
    a.metodeHpp === b.metodeHpp &&
    a.ppn === b.ppn &&
    a.margin === b.margin &&
    a.biayaEmbalaseRacik === b.biayaEmbalaseRacik &&
    a.metodeBiayaRacikan === b.metodeBiayaRacikan
  );
  return herbChanged || configChanged;
});

onMounted(() => {
  loadBaseline();
  fetchPriceConfiguration();
  fetchHerbForm();
});
</script>

<template>
  <Card
    pt:body:class="overflow-auto pt-0 h-full"
    pt:content:class="overflow-auto h-full"
  >
    <template #header>
      <!-- Header satu baris (PageToolbar) -->
      <PageToolbar>
        <CustomButton icon="PhArrowClockwise" @click="fetchPriceConfiguration" />
        <CustomBreadCrumb
          :home="{ label: 'Datamaster', home: true }"
          :model="[{ label: 'Konfigurasi Harga' }]"
        />
      </PageToolbar>
    </template>
    <template #content>
      <hr class="border border-slate-200" />
      <!-- Metode Pemotong Stok -->
      <div class="mt-[10px] p-4 rounded-lg bg-opensimrs-50">
        <div class="flex justify-between">
          <div class="">
            <p class="text-lg font-bold text-opensimrs-300 font-poppins">
              Metode Pemotongan Stok
            </p>
          </div>
          <div class="flex">
            <div v-if="statusFIFO !== 'false'">
              <CustomChip
                label="FIFO"
                textColor="text-white"
                bgColor="bg-opensimrs-300"
                borderColor="border-none"
                icon-color="white"
                customClass="text-sm font-semibold h-6"
              />
            </div>
            <div v-if="statusLIFO !== 'false'">
              <CustomChip
                label="LIFO"
                textColor="text-white"
                bgColor="bg-opensimrs-300"
                borderColor="border-none"
                icon-color="white"
                customClass="text-sm font-semibold h-6"
              />
            </div>
            <div v-if="statusFEFO !== 'false'">
              <CustomChip
                label="FEFO"
                textColor="text-white"
                bgColor="bg-opensimrs-300"
                borderColor="border-none"
                icon-color="white"
                customClass="text-sm font-semibold h-6"
              />
            </div>
          </div>
        </div>
        <hr class="mt-[10px] border border-slate-200" />

        <!-- FIFO -->
        <div class="flex justify-between">
          <div class="mt-[10px]">
            <p class="font-bold">First In First Out (FIFO)</p>
            <p class="text-xs text-mediumGrey-400">
              Persediaan yang diperoleh diawal akan dipotong (digunakan)
              terlebih dahulu
            </p>
          </div>
          <div class="mt-[20px]">
            <CustomSwitch
              v-if="statusLIFO !== 'false' || statusFEFO !== 'false'"
              disabled
              v-model="statusFIFO"
              :show-label="false"
              leftLabel
              sideLabel="Non-Aktif"
              sideLabelTrue="Aktif"
              sideLabelColor="text-danger-300"
              sideLabelColorTrue="text-success-300"
            />
            <CustomSwitch
              v-else
              v-model="statusFIFO"
              :show-label="false"
              trueValue="FIFO"
              falseValue="false"
              leftLabel
              sideLabel="Non-Aktif"
              sideLabelTrue="Aktif"
              sideLabelColor="text-danger-300"
              sideLabelColorTrue="text-success-300"
            />
          </div>
        </div>

        <!-- LIFO -->
        <div class="flex justify-between">
          <div class="mt-[20px]">
            <p class="font-bold">Last In First Out (LIFO)</p>
            <p class="text-xs text-mediumGrey-400">
              Persediaan yang diperoleh diakhir akan dipotong (digunakan)
              terlebih dahulu
            </p>
          </div>
          <div class="mt-[30px]">
            <CustomSwitch
              v-if="statusFIFO !== 'false' || statusFEFO !== 'false'"
              disabled
              v-model="statusLIFO"
              :show-label="false"
              leftLabel
              sideLabel="Non-Aktif"
              sideLabelTrue="Aktif"
              sideLabelColor="text-danger-300"
              sideLabelColorTrue="text-success-300"
            />
            <CustomSwitch
              v-else
              v-model="statusLIFO"
              :show-label="false"
              trueValue="LIFO"
              falseValue="false"
              leftLabel
              sideLabel="Non-Aktif"
              sideLabelTrue="Aktif"
              sideLabelColor="text-danger-300"
              sideLabelColorTrue="text-success-300"
            />
          </div>
        </div>

        <!-- FEFO -->
        <div class="flex justify-between">
          <div class="mt-[20px]">
            <p class="font-bold">First Expired First Out (FEFO)</p>
            <p class="text-xs text-mediumGrey-400">
              Persediaan yang akan kadaluarsa (*Jika tanggal kadaluarsa diisi
              ketika penerimaan / produksi) akan dipotong (digunakan) terlebih
              dahulu
            </p>
          </div>
          <div class="mt-[30px]">
            <CustomSwitch
              v-if="statusFIFO !== 'false' || statusLIFO !== 'false'"
              disabled
              v-model="statusFEFO"
              :show-label="false"
              leftLabel
              sideLabel="Non-Aktif"
              sideLabelTrue="Aktif"
              sideLabelColor="text-danger-300"
              sideLabelColorTrue="text-success-300"
            />
            <CustomSwitch
              v-else
              v-model="statusFEFO"
              :show-label="false"
              trueValue="FEFO"
              falseValue="false"
              leftLabel
              sideLabel="Non-Aktif"
              sideLabelTrue="Aktif"
              sideLabelColor="text-danger-300"
              sideLabelColorTrue="text-success-300"
            />
          </div>
        </div>
      </div>

      <!-- Metode HPP -->
      <div class="mt-[10px] p-4 rounded-lg bg-opensimrs-50">
        <div class="flex justify-between">
          <div class="">
            <p class="text-lg font-bold text-opensimrs-300 font-poppins">
              Metode HPP
            </p>
          </div>
          <div>
            <CustomChip
              v-if="statusHargaTerakhir !== 'false'"
              label="Harga Terakhir"
              textColor="text-white"
              bgColor="bg-opensimrs-300"
              borderColor="border-none"
              icon-color="white"
              customClass="text-sm font-semibold h-6"
            />
            <CustomChip
              v-if="statusRata !== 'false'"
              label="Rata-rata"
              textColor="text-white"
              bgColor="bg-opensimrs-300"
              borderColor="border-none"
              icon-color="white"
              customClass="text-sm font-semibold h-6"
            />
          </div>
        </div>
        <hr class="mt-[10px] border border-slate-200" />
        <!-- Harga Terakhir -->
        <div class="flex justify-between">
          <div class="mt-[10px]">
            <p class="font-bold">Harga Terakhir</p>
            <p class="text-xs text-mediumGrey-400">
              Penggunaan HPP dengan Harga Terakhir
            </p>
          </div>
          <div class="mt-[20px]">
            <CustomSwitch
              v-if="statusRata !== 'false'"
              disabled
              v-model="statusHargaTerakhir"
              :show-label="false"
              leftLabel
              sideLabel="Non-Aktif"
              sideLabelTrue="Aktif"
              sideLabelColor="text-danger-300"
              sideLabelColorTrue="text-success-300"
            />
            <CustomSwitch
              v-else
              v-model="statusHargaTerakhir"
              :show-label="false"
              trueValue="last"
              falseValue="false"
              leftLabel
              sideLabel="Non-Aktif"
              sideLabelTrue="Aktif"
              sideLabelColor="text-danger-300"
              sideLabelColorTrue="text-success-300"
            />
          </div>
        </div>
        <!-- Rata-rata -->
        <div class="flex justify-between">
          <div class="mt-[20px]">
            <p class="font-bold">Rata-rata</p>
            <p class="text-xs text-mediumGrey-400">
              Penggunaan HPP dengan rata-rata
            </p>
          </div>
          <div class="mt-[30px]">
            <CustomSwitch
              v-if="statusHargaTerakhir !== 'false'"
              disabled
              v-model="statusRata"
              :show-label="false"
              leftLabel
              sideLabel="Non-Aktif"
              sideLabelTrue="Aktif"
              sideLabelColor="text-danger-300"
              sideLabelColorTrue="text-success-300"
            />
            <CustomSwitch
              v-else
              v-model="statusRata"
              :show-label="false"
              trueValue="average"
              falseValue="false"
              leftLabel
              sideLabel="Non-Aktif"
              sideLabelTrue="Aktif"
              sideLabelColor="text-danger-300"
              sideLabelColorTrue="text-success-300"
            />
          </div>
        </div>
      </div>

      <!-- Margin -->
      <div class="mt-[10px] p-4 rounded-lg bg-opensimrs-50">
        <div class="flex justify-between">
          <div class="">
            <p class="text-lg font-bold text-opensimrs-300 font-poppins">
              Margin
            </p>
          </div>
          <div>
            <CustomChip
              :label="`${margin ?? '0'}%`"
              textColor="text-white"
              bgColor="bg-opensimrs-300"
              borderColor="border-none"
              icon-color="white"
              customClass="text-sm font-semibold h-6"
            />
          </div>
        </div>
        <hr class="mt-[10px] border border-slate-200" />

        <!-- Presentase Margin -->
        <div class="flex justify-between">
          <div class="mt-[10px]">
            <p class="font-bold">Presentase Margin</p>
            <li class="text-xs text-mediumGrey-400 mt-[5px]">
              Mempengaruhi pada kolom
              <span class="font-bold text-black">Harga Dasar</span>
              di master item medis
            </li>
            <li class="text-xs text-mediumGrey-400">
              <span class="font-bold text-black">HJA</span> otomatis terhitung
            </li>
          </div>
          <div class="mt-[10px]">
            <p class="font-bold">Input Margin (%)</p>
            <CustomInputNumber
              placeholder="5"
              :show-label="false"
              class="w-[80px] bg-white rounded-xl mt-[5px] ml-[50px]"
              v-model="margin"
              :invalid="!!errors.margin"
              :invalidMessage="errors.margin"
            >
              <template #appendText>
                <div
                  class="font-semibold bg-white text-sm text-opensimrs-300 ml-[10px] mt-[10px] rounded-r-xl w-[20px]"
                >
                  %
                </div>
              </template>
            </CustomInputNumber>
          </div>
        </div>
      </div>

      <!-- PPN -->
      <div class="mt-[10px] p-4 rounded-lg bg-opensimrs-50">
        <div class="flex justify-between">
          <div class="">
            <p class="text-lg font-bold text-opensimrs-300 font-poppins">PPN</p>
          </div>
          <div>
            <CustomChip
              :label="`${ppn ?? '0'}%`"
              textColor="text-white"
              bgColor="bg-opensimrs-300"
              borderColor="border-none"
              icon-color="white"
              customClass="text-sm font-semibold h-6"
            />
          </div>
        </div>
        <hr class="mt-[10px] border border-slate-200" />
        <!-- Presentase PPN -->
        <div class="flex justify-between">
          <div class="mt-[10px]">
            <p class="font-bold">Presentase PPN</p>
            <li class="text-xs text-mediumGrey-400 mt-[5px]">
              Mempengaruhi pada kolom
              <span class="font-bold text-black">Harga Dasar</span>
              di master item medis
            </li>
            <li class="text-xs text-mediumGrey-400">
              <span class="font-bold text-black">HNA</span> otomatis terhitung
            </li>
          </div>
          <div class="mt-[10px]">
            <p class="font-bold">Input PPN (%)</p>
            <CustomInputNumber
              placeholder="12"
              :show-label="false"
              class="w-[80px] bg-white rounded-xl mt-[5px] ml-[50px]"
              v-model="ppn"
              :invalid="!!errors.ppn"
              :invalidMessage="errors.ppn"
            >
              <template #appendText>
                <div
                  class="font-semibold bg-white text-sm text-opensimrs-300 ml-[10px] mt-[10px] rounded-r-xl w-[20px]"
                >
                  %
                </div>
              </template>
            </CustomInputNumber>
          </div>
        </div>
      </div>

      <!-- Konfigurasi Biaya Embalase & Racik -->
      <div class="mt-[10px] p-4 rounded-lg bg-opensimrs-50">
        <div class="flex justify-between">
          <div class="">
            <p class="text-lg font-bold text-opensimrs-300 font-poppins">
              Konfigurasi Biaya Embalase & Racik
            </p>
          </div>
          <div class="flex">
            <div v-if="bentukRacikan !== 'false' || itemEmbalase !== 'false'">
              <CustomSwitch
                v-model="statusEmbalase"
                :show-label="false"
                leftLabel
                sideLabel="Non-Aktif"
                sideLabelTrue="Aktif"
                sideLabelColor="text-danger-300"
                sideLabelColorTrue="text-success-300"
              />
            </div>
            <div v-if="bentukRacikan !== 'false' || itemEmbalase !== 'false'">
              <div
                class="bg-opensimrs-300 w-[2px] h-[25px] mr-[20px] ml-[20px]"
              ></div>
            </div>
            <div v-if="bentukRacikan !== 'false'">
              <CustomChip
                label="Bentuk Racikan (Paket)"
                textColor="text-white"
                bgColor="bg-opensimrs-300"
                borderColor="border-none"
                icon-color="white"
                customClass="text-sm font-semibold h-6"
              />
            </div>
            <div v-if="itemEmbalase !== 'false'">
              <CustomChip
                label="HJA Jenis Item Embalase (Item)"
                textColor="text-white"
                bgColor="bg-opensimrs-300"
                borderColor="border-none"
                icon-color="white"
                customClass="text-sm font-semibold h-6"
              />
            </div>
          </div>
        </div>
        <hr class="mt-[10px] border border-slate-200" />
        <!-- Bentuk Racikan (Paket) -->
        <div class="flex justify-between">
          <div class="mt-[10px]">
            <p class="font-bold">Bentuk Racikan (Paket)</p>
            <p class="text-xs text-mediumGrey-400">
              Biaya jasa akan terakmulasi berdasarkan paket racikan
            </p>
          </div>
          <div class="mt-[20px]">
            <CustomSwitch
              v-if="itemEmbalase !== 'false'"
              disabled
              v-model="bentukRacikan"
              :show-label="false"
              leftLabel
              sideLabel="Non-Aktif"
              sideLabelTrue="Aktif"
              sideLabelColor="text-danger-300"
              sideLabelColorTrue="text-success-300"
            />
            <CustomSwitch
              v-else
              v-model="bentukRacikan"
              :show-label="false"
              trueValue="paket"
              falseValue="false"
              leftLabel
              sideLabel="Non-Aktif"
              sideLabelTrue="Aktif"
              sideLabelColor="text-danger-300"
              sideLabelColorTrue="text-success-300"
            />
          </div>
        </div>
        <!-- HJA Jenis Item Embalase (Item) -->
        <div class="flex justify-between">
          <div class="mt-[20px]">
            <p class="font-bold">HJA Jenis Item Embalase (Item)</p>
            <p class="text-xs text-mediumGrey-400">
              Biaya jasa akan terakumulasi berdasarkan per-item racikan
            </p>
          </div>
          <div class="mt-[30px]">
            <CustomSwitch
              v-if="bentukRacikan == 'true'"
              disabled
              v-model="itemEmbalase"
              :show-label="false"
              leftLabel
              sideLabel="Non-Aktif"
              sideLabelTrue="Aktif"
              sideLabelColor="text-danger-300"
              sideLabelColorTrue="text-success-300"
            />
            <CustomSwitch
              v-else
              v-model="itemEmbalase"
              :show-label="false"
              trueValue="item"
              falseValue="false"
              leftLabel
              sideLabel="Non-Aktif"
              sideLabelTrue="Aktif"
              sideLabelColor="text-danger-300"
              sideLabelColorTrue="text-success-300"
            />
          </div>
        </div>
        <!-- Pengelompokan Bentuk Racikan -->
        <div class="mt-[20px] p-4 bg-white rounded-lg">
          <div class="flex justify-between">
            <div>
              <p class="font-bold">Pengelompokan Bentuk Racikan</p>
            </div>
            <div>
              <CustomButton
                @click="openDialog('add', 'Tambah')"
                icon="PhPlus"
                label="Tarif Jasa Baru"
              />
            </div>
          </div>
          <hr class="mt-[20px] border border-slate-200" />
          <div
            class="mt-[20px] relative overflow-y-auto"
            style="max-height: 220px"
          >
            <NoData v-if="!hasData" />
            <DataTable
              v-else
              :value="HerbFormPayload"
              stripedRows
              class="text-xs"
              scrollable
              scrollHeight="flex"
            >
              <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
                <template #header>
                  <div class="w-full text-center">No.</div>
                </template>
                <template #body="slotProps">
                  <div class="flex justify-center items-center">
                    {{ slotProps.index + 1 }}
                  </div>
                </template>
              </Column>
              <!-- Bentuk Racikan -->
              <Column
                field="namaBentukRacikan"
                header="Bentuk Racikan"
                headerClass="bg-opensimrs-50 font-semibold text-SM"
              ></Column>
              <!-- Jumlah Paket -->
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="w-full font-semibold text-center text-SM">
                    Jumlah Paket
                  </div>
                </template>
                <template #body="slotProps">
                  <div class="flex justify-center items-center">
                    <p>{{ slotProps.data.jumlah }}</p>
                  </div>
                </template>
              </Column>
              <!-- Tarif Embalase -->
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="w-full font-semibold text-center text-SM">
                    Tarif Embalase
                  </div>
                </template>
                <template #body="slotProps">
                  <div class="flex justify-center items-center">
                    <p>{{ slotProps.data.tarifEmbalase }}</p>
                  </div>
                </template>
              </Column>
              <!-- Tarif Racikan -->
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="w-full font-semibold text-center text-SM">
                    Tarif Racikan
                  </div>
                </template>
                <template #body="slotProps">
                  <div class="flex justify-center items-center">
                    <p>{{ slotProps.data.tarifRacik }}</p>
                  </div>
                </template>
              </Column>
              <!-- Action -->
              <Column headerClass="bg-opensimrs-50">
                <template #header="slotProps">
                  <div class="w-full font-semibold text-center text-SM">
                    Action
                  </div>
                </template>
                <template #body="slotProps">
                  <div class="flex gap-2.5 justify-center items-center">
                    <CustomButton
                      label=""
                      background-color="bg-[#3D84E5] rounded-lg"
                      class="h-6 w-[26px] p-0"
                      @click="openDialog('edit', 'Edit Data', slotProps.data)"
                    >
                      <img src="@/assets/icons/edit.svg" alt="" />
                    </CustomButton>
                    <CustomButton
                      label=""
                      background-color="bg-danger-300 rounded-lg"
                      class="h-6 w-[26px] p-0"
                      @click="
                        deleteDialog(
                          'delete',
                          `${slotProps.data.namaBentukRacikan} - ${slotProps.data.jumlah}`,
                          slotProps.data
                        )
                      "
                    >
                      <img src="@/assets/icons/delete.svg" alt="" />
                    </CustomButton>
                  </div>
                </template>
              </Column>
            </DataTable>
            <AddPriceConfiguration
              v-model:isDialogVisible="PriceConfigurationDialog"
              :title="dialogConfig.title"
              :method="dialogConfig.method"
              :payload="dialogConfig.data"
              @data-updated="fetchHerbForm"
            />
            <DeletePriceConfiguration
              v-model:isDialogVisible="DeletePriceConfigurationDialog"
              :title="dialogConfig.title"
              :itemToDelete="dialogConfig.data"
              @delete="confirmDelete"
            />
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end">
        <div class="mt-3">
          <p class="text-xs font-bold text-right underline underline-offset-2">
            Perubahan Dilakukan Oleh
          </p>
          <p>
            {{ PriceConfigurationPayload.petugas }} -
            <span>{{
              epochToDate(PriceConfigurationPayload.createdAt, "dateTime")
            }}</span>
          </p>
        </div>
        <div class="mt-3">
          <div class="bg-mediumGrey-300 w-[1px] h-[33px] ml-[20px] mt-1"></div>
        </div>
        <div class="mt-3">
          <CustomButton
            label="Simpan Perubahan"
            class="ml-[20px]"
            :disabled="!hasChanges"
            @click="onSubmit"
          />
        </div>
      </div>
    </template>
  </Card>
</template>
