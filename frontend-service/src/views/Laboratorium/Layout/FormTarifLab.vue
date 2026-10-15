<script lang="ts" setup>
import { ref, watch, onMounted, computed } from "vue";
import { useForm, useFieldArray, ErrorMessage } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { utilsStore } from "@/stores/utils";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomMultiSelect from "@/components/Base/CustomMultiSelect.vue";
import CustomRadio from "@/components/Base/CustomRadio.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import NoData from "@/components/section/NoData.vue";
import { useTarifPemeriksaanStore } from "@/stores/datamasterLaboratorium/tarifPemeriksaan";
import { useItemPemeriksaanStore } from "@/stores/datamasterLaboratorium/itemPemeriksaanLab";
import { usePenjaminStore } from "@/stores/datamaster/penjamin";
import { useKomponenTarifStore } from "@/stores/datamaster/komponenTarif";
import { useKelompokPemeriksaanStore } from "@/stores/datamasterLaboratorium/kelompokPemeriksaan";

const props = defineProps({
  isDialogVisible: {
    default: false,
  },
  title: {
    type: String,
  },
  method: {
    type: String,
  },
  payload: {
    type: Object,
    default: () => ({}),
  },
});

const schema = toTypedSchema(
  yup
    .object({
      code: yup.string().required("Kode Tarif harus diisi"),
      name: yup.string().required("Nama Tarif harus diisi"),
      grandTotal: yup.number().default(0),
      unitPelayanan: yup.array().of(yup.object()),
      penjaminUuid: yup.array().of(yup.string()),
      presentase: yup.bool().default(false),
      pelayanans: yup
        .array()
        .of(yup.string().required("Unit Pelayanan harus dipilih"))
        .min(1, "Minimal satu Unit Pelayanan harus dipilih")
        .required("Unit Pelayanan harus dipilih"),
      penjaminSelected: yup
        .array()
        .of(yup.string().required("Penjamin harus dipilih"))
        .min(1, "Minimal satu Penjamin harus dipilih")
        .required("Penjamin harus dipilih"),
      tarifLabItems: yup.array().of(
        yup.object({
          itemPemeriksaanUuid: yup
            .string()
            .required("Item Pemeriksaan harus dipilih"),
          listKomponenItem: yup
            .array()
            .of(
              yup.object({
                tarifKomponenUuid: yup
                  .string()
                  .required("Komponen tarif harus dipilih"),
                tarifPerKomponen: yup
                  .number()
                  .min(0, "Tarif per komponen tidak boleh negatif")
                  .required("Tarif per komponen harus diisi"),
                persentase: yup
                  .number()
                  .min(0, "Persentase tidak boleh negatif")
                  .max(100, "Persentase tidak boleh lebih dari 100")
                  .required("Persentase harus diisi"),
              })
            )
            .min(1, "Tambahkan minimal satu komponen tarif"),
          total: yup.number().min(0).required("total harus diisi"),
        })
      ),
      tarifLabKelompok: yup.array().of(
        yup.object({
          kelompokPemeriksaanUuid: yup
            .string()
            .required("Kelompok Pemeriksaan harus dipilih"),
          listKomponenKelompok: yup
            .array()
            .of(
              yup.object({
                tarifKomponenUuid: yup
                  .string()
                  .required("Komponen tarif harus dipilih"),
                tarifPerKomponen: yup
                  .number()
                  .min(0, "Tarif per komponen tidak boleh negatif")
                  .required("Tarif per komponen harus diisi"),
                persentase: yup
                  .number()
                  .min(0, "Persentase tidak boleh negatif")
                  .max(100, "Persentase tidak boleh lebih dari 100")
                  .required("Persentase harus diisi"),
              })
            )
            .min(1, "Tambahkan minimal satu komponen tarif"),
          total: yup.number().min(0).required("total harus diisi"),
        })
      ),
      status: yup.bool().default(true),
    })
    .noUnknown()
);

const method = ref(props.method);
const title = ref(props.title);
const storeUtils = utilsStore();
const penjaminStore = usePenjaminStore();
const penjaminPayload = ref<any[]>([]);
const tindakanPayload = ref<any[]>([]);
const tempPelayanan = ref<any>([]);
const tempPenjamin = ref<any>([]);
const komponenTarifPayload = ref<any[]>([]);
const tempDeleteTindakan = ref<any[]>([]);
const tempTindakan = ref<any[]>([]);
const tarifPemeriksaanStore = useTarifPemeriksaanStore();
const itemPemeriksaanStore = useItemPemeriksaanStore();
const itemPemeriksaanPayload = ref(<any>[]);
const itemPemeriksaanOptions = ref<{ label: string; value: string }[]>([]);
const itemPemeriksaan = ref();
const kelompokPemeriksaanStore = useKelompokPemeriksaanStore();
const kelompokPemeriksaanPayload = ref(<any>[]);
const kelompokPemeriksaanOptions = ref<{ label: string; value: string }[]>([]);
const kelompokPemeriksaan = ref();
const tempDeletedLab = ref<any[]>([]);
const komponenTarifStore = useKomponenTarifStore();

interface ListKomponenTarif {
  tarifKomponenUuid: string;
  tarifPerKomponen: number;
  persentase: number;
}
interface ListKomponenItem {
  tarifKomponenUuid: string;
  tarifPerKomponen: number;
  persentase: number;
}
interface ListKomponenKelompok {
  tarifKomponenUuid: string;
  tarifPerKomponen: number;
  persentase: number;
}

interface Tindakan {
  tindakanUuid: string;
  listKomponenTarif: Array<ListKomponenTarif>;
  isPresentase: boolean;
  total: number;
}
interface itemPemeriksaan {
  itemPemeriksaanUuid: string;
  listKomponenItem: Array<ListKomponenItem>;
  isPresentase: boolean;
  total: number;
}
interface kelompokPemeriksaan {
  kelompokPemeriksaanUuid: string;
  listKomponenKelompok: Array<ListKomponenKelompok>;
  isPresentase: boolean;
  total: number;
}

interface LabEntry {
  tarifLabUuid: string;
}

const optionsPelayanan = ref([
  { label: "IGD", value: "igd" },
  { label: "Rawat Jalan", value: "rajal" },
  { label: "Rawat Inap", value: "ranap" },
]);

const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);

const { errors, handleSubmit, resetForm, setValues, defineField } = useForm({
  validationSchema: schema,
});
const fetchPenjamin = async () => {
  try {
    const response = await penjaminStore.getAktifApi();
    if (response && response.payload) {
      penjaminPayload.value = response.payload;
    } else {
      penjaminPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch penjamin", error);
    penjaminPayload.value = [];
  }
};

const fetchKomponenTarif = async () => {
  try {
    const response = await komponenTarifStore.getAktifApi();
    if (response && response.payload) {
      komponenTarifPayload.value = response.payload;
    } else {
      komponenTarifPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch komponen tarif", error);
    komponenTarifPayload.value = [];
  }
};

const fetchItemPemeriksaan = async () => {
  storeUtils.setLoading(true);
  try {
    const response = await itemPemeriksaanStore.getActive();

    if (response && response.payload) {
      itemPemeriksaanPayload.value = response.payload;
      itemPemeriksaanOptions.value = itemPemeriksaanPayload.value.map(
        (item: any) => ({
          label: item.name,
          value: item.uuid,
        })
      );
    } else {
      itemPemeriksaanPayload.value = [];
      itemPemeriksaanOptions.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    itemPemeriksaanPayload.value = [];
  } finally {
    storeUtils.setLoading(false);
  }
};

const fetchKelompokPemeriksaan = async () => {
  storeUtils.setLoading(true);
  try {
    const response = await kelompokPemeriksaanStore.getActive();

    if (response && response.payload) {
      kelompokPemeriksaanPayload.value = response.payload;
      kelompokPemeriksaanOptions.value = kelompokPemeriksaanPayload.value.map(
        (item: any) => ({
          label: item.name,
          value: item.uuid,
        })
      );
    } else {
      kelompokPemeriksaanPayload.value = [];
      kelompokPemeriksaanOptions.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    kelompokPemeriksaanPayload.value = [];
  } finally {
    storeUtils.setLoading(false);
  }
};

const [code] = defineField("code");
const [name] = defineField("name");
const [grandTotal] = defineField("grandTotal");
const [unitPelayanan] = defineField("unitPelayanan");
const [penjaminUuid] = defineField("penjaminUuid");
const [status] = defineField("status");
const [pelayanans] = defineField("pelayanans");
const [penjaminSelected] = defineField("penjaminSelected");
const [presentase] = defineField("presentase");
// const [tarifLabItems] = defineField("tarifLabItems");
// const [tarifLabKelompok] = defineField("tarifLabKelompok");
// const [itemPemeriksaanUuid] = defineField("itemPemeriksaanUuid");
// const [tarifKomponenUuid] = defineField("tarifKomponenUuid");
// const [prosentasePerKomponen] = defineField("prosentasePerKomponen");
// const [tarifPerKomponen] = defineField("tarifPerKomponen");

const {
  remove: removeTindakan,
  push: pushTindakan,
  fields: fieldsTindakan,
} = useFieldArray<Tindakan>("tindakanPoli");

const {
  remove: removeItemPemeriksaan,
  push: pushItemPemeriksaan,
  fields: fieldsItemPemeriksaan,
} = useFieldArray<itemPemeriksaan>("tarifLabItems");
const {
  remove: removeKelompokPemeriksaan,
  push: pushKelompokPemeriksaan,
  fields: fieldsKelompokPemeriksaan,
} = useFieldArray<kelompokPemeriksaan>("tarifLabKelompok");

const { push: pushUnitPelayanan } = useFieldArray("unitPelayanan");
const { push: pushPenjamin } = useFieldArray("penjaminUuid");
const { fields: fieldsTarifLab } = useFieldArray<LabEntry>("tarifLab");

const addListKomponenTarif = (index: number) => {
  fieldsTindakan.value[index].value.listKomponenTarif.push({
    tarifKomponenUuid: "",
    tarifPerKomponen: 0,
    persentase: 0,
  });
};

const addListItemPemeriksaan = (index: number) => {
  fieldsItemPemeriksaan.value[index].value.listKomponenItem.push({
    tarifKomponenUuid: "",
    tarifPerKomponen: 0,
    persentase: 0,
  });
};
const addListKelompokPemeriksaan = (index: number) => {
  fieldsKelompokPemeriksaan.value[index].value.listKomponenKelompok.push({
    tarifKomponenUuid: "",
    tarifPerKomponen: 0,
    persentase: 0,
  });
};

const removeListKomponenItem = (itemIndex: number, komponenIndex: number) => {
  fieldsItemPemeriksaan.value[itemIndex].value.listKomponenItem.splice(
    komponenIndex,
    1
  );
};
const removeListKomponenKelompok = (
  kelompokIndex: number,
  komponenIndex: number
) => {
  fieldsKelompokPemeriksaan.value[
    kelompokIndex
  ].value.listKomponenKelompok.splice(komponenIndex, 1);
};

const removeListKomponenTarif = (
  tindakanIndex: number,
  komponenIndex: number
) => {
  fieldsTindakan.value[tindakanIndex].value.listKomponenTarif.splice(
    komponenIndex,
    1
  );
};

const handleRemoveTindakan = (tindakanIndex: number) => {
  removeTindakan(tindakanIndex);
};
const handleRemoveItemPemeriksaan = (itemIndex: number) => {
  removeItemPemeriksaan(itemIndex);
};
const handleRemoveKelompokPemeriksaan = (itemIndex: number) => {
  removeKelompokPemeriksaan(itemIndex);
};

const handlePushTindakan = () => {
  pushTindakan({
    tindakanUuid: "",
    listKomponenTarif: [
      { tarifKomponenUuid: "", tarifPerKomponen: 0, persentase: 0 },
    ],
    isPresentase: false,
    total: 0,
  });
};
const handlePushItemPemeriksaan = () => {
  pushItemPemeriksaan({
    itemPemeriksaanUuid: "",
    listKomponenItem: [
      { tarifKomponenUuid: "", tarifPerKomponen: 0, persentase: 0 },
    ],
    isPresentase: false,
    total: 0,
  });
};
const handlePushKelompokPemeriksaan = () => {
  pushKelompokPemeriksaan({
    kelompokPemeriksaanUuid: "",
    listKomponenKelompok: [
      { tarifKomponenUuid: "", tarifPerKomponen: 0, persentase: 0 },
    ],
    isPresentase: false,
    total: 0,
  });
};

const handleUnitPelayananUpdate = (selectedValues: number[]) => {
  unitPelayanan.value = tempPelayanan.value.map(
    (item: { unitPelayanan: number; uuid: string }) => {
      if (!selectedValues.includes(item.unitPelayanan)) {
        return {
          unitPelayanan: item.unitPelayanan,
          uuid: item.uuid,
          isDelete: true,
        };
      } else {
        return {
          unitPelayanan: item.unitPelayanan,
          uuid: item.uuid,
        };
      }
    }
  );

  selectedValues.forEach((value) => {
    const existsInTemp = tempPelayanan.value.some(
      (item: { unitPelayanan: number }) => item.unitPelayanan === value
    );

    if (!existsInTemp) {
      pushUnitPelayanan({
        unitPelayanan: value,
      });
    }
  });
};

const handlePenjaminUpdate = (selectedValues: string[]) => {
  console.log(
    "handlePenjaminUpdate ~ selectedValues:",
    JSON.stringify(selectedValues)
  );

  console.log(
    "handlePenjaminUpdate ~ tempPenjamin.value:",
    JSON.stringify(tempPenjamin.value)
  );

  console.log(
    "handlePenjaminUpdate ~ penjaminUuid.value:",
    JSON.stringify(penjaminUuid.value)
  );

  penjaminUuid.value = selectedValues;
  // penjaminUuid.value = tempPenjamin.value.map((item: any) => {
  //   if (selectedValues.includes(item)) {
  //     return item;
  //   }
  // });

  // selectedValues.forEach((value) => {
  //   const existsInTemp = tempPenjamin.value.some((item: any) => item === value);

  //   if (!existsInTemp) {
  //     pushPenjamin(value);
  //   }
  // });

  console.log(
    "handlePenjaminUpdate ~ after set selectedValues:",
    JSON.stringify(selectedValues)
  );

  console.log(
    "handlePenjaminUpdate ~ after set tempPenjamin.value:",
    JSON.stringify(tempPenjamin.value)
  );

  console.log(
    "handlePenjaminUpdate ~ after set penjaminUuid.value:",
    JSON.stringify(penjaminUuid.value)
  );
};

const getItemPemeriksaanUuid = (uuid: string | { value: string }): string => {
  return typeof uuid === "object" ? uuid.value : uuid;
};
const getKelompokPemeriksaanUuid = (
  uuid: string | { value: string }
): string => {
  return typeof uuid === "object" ? uuid.value : uuid;
};

const onSubmit = handleSubmit(async (values: any) => {
  try {
    console.log("🚀 ~ onSubmit ~ values:", values);
    if (!values.isPresentase) {
      values.grandTotal = grandTotalData.value;
    }
    delete values.unitPelayananSelected;
    delete values.penjaminSelected;

    tempDeleteTindakan.value.forEach((deletedTindakan) => {
      const indexToReplace = values.tindakanPoli.findIndex(
        (tindakan: Tindakan) =>
          tindakan.tindakanUuid === deletedTindakan.tindakanUuid
      );

      if (indexToReplace !== -1) {
        values.tindakanPoli[indexToReplace] = deletedTindakan;
      } else {
        values.tindakanPoli.push(deletedTindakan);
      }
    });

    values.tarifLab = (values.tarifLab || []).map((lab: any) => ({
      ...lab,
      isDeleted: true,
    }));

    const combinedPenjaminData = [
      ...(values.tarifLab || []),
      ...tempDeletedLab.value,
    ];
    values.tarifLab = JSON.parse(JSON.stringify(combinedPenjaminData));

    const formattedData = {
      code: values.code,
      name: values.name,
      grandTotal: grandTotalData.value,
      presentase: values.presentase || false,
      status: values.status || false,
      pelayanans: values.pelayanans || [],
      penjaminUuids: values.penjaminUuid || [],
      tarifLabItems: [
        ...(fieldsKelompokPemeriksaan.value || []).map((item) => ({
          kelompokPemeriksaanUuid: getKelompokPemeriksaanUuid(
            item.value.kelompokPemeriksaanUuid
          ),
          totalTarif: item.value.total || 0,
          komponenTindakanLabs: (item.value.listKomponenKelompok || []).map(
            (komponen) => ({
              tarifKomponenUuid: komponen.tarifKomponenUuid,
              prosentasePerKomponen: komponen.persentase || 0,
              tarifPerKomponen: komponen.tarifPerKomponen || 0,
            })
          ),
        })),

        ...(fieldsItemPemeriksaan.value || []).map((item) => ({
          itemPemeriksaanUuid: getItemPemeriksaanUuid(
            item.value.itemPemeriksaanUuid
          ),
          totalTarif: item.value.total || 0,
          komponenTindakanLabs: (item.value.listKomponenItem || []).map(
            (komponen) => ({
              tarifKomponenUuid: komponen.tarifKomponenUuid,
              prosentasePerKomponen: komponen.persentase || 0,
              tarifPerKomponen: komponen.tarifPerKomponen || 0,
            })
          ),
        })),
      ],
    };
    console.log(
      "🚀 ~ onSubmit ~ formattedData:",
      JSON.stringify(formattedData, null, 2)
    );

    if (method.value === "edit") {
      if (!props.payload || !props.payload.uuid) {
        throw new Error("UUID is missing for edit operation");
      }
      const uuid = props.payload.uuid;
      console.log("value edit", values);
      const response = await tarifPemeriksaanStore.putApi(uuid, formattedData);
      emit("data-updated");
    } else if (method.value === "add") {
      console.log(values);
      const response = await tarifPemeriksaanStore.postApi(formattedData);
      console.log("Response from postApi:", response);
      emit("data-updated");
    }
    closeDialog();
  } catch (error) {
    console.error("Failed to process the data:", error);
  }
});

const updateVisibility = (value: any) => {
  emit("update:isDialogVisible", value);
};

const resetDialogMode = () => {
  method.value = props.method;
  title.value = props.title;
};

const handleEdit = () => {
  method.value = "edit";
  title.value = "Edit Data";
};

const closeDialog = () => {
  emit("update:isDialogVisible", false);
  resetDialogMode();
  resetForm();
  tempDeleteTindakan.value = [];
};

const grandTotalData = ref<number>(0);
const grandTotalValues = computed(() => {
  grandTotalData.value = 0;

  // Hitung total dari tindakan
  const totalDataTindakan = fieldsTindakan.value.reduce(
    (grandTotal, tindakanWrapper) => {
      return grandTotal + (tindakanWrapper.value.total || 0);
    },
    0
  );

  // Hitung total dari item pemeriksaan
  const totalDataItemPemeriksaan = fieldsItemPemeriksaan.value.reduce(
    (grandTotal, itemWrapper) => {
      return (
        grandTotal +
        itemWrapper.value.listKomponenItem.reduce((sum, komponen) => {
          return sum + (komponen.tarifPerKomponen || 0);
        }, 0)
      );
    },
    0
  );
  const totalDataKelompokPemeriksaan = fieldsKelompokPemeriksaan.value.reduce(
    (grandTotal, kelompokWrapper) => {
      return (
        grandTotal +
        kelompokWrapper.value.listKomponenKelompok.reduce((sum, komponen) => {
          return sum + (komponen.tarifPerKomponen || 0);
        }, 0)
      );
    },
    0
  );

  // Gabungkan total tindakan dan item pemeriksaan
  const total =
    totalDataTindakan + totalDataItemPemeriksaan + totalDataKelompokPemeriksaan;
  grandTotalData.value = total;

  return formatCurrency(total);
});

const handlePersentase = (
  inputPersentase: any,
  tindakanIndex: number,
  komponenIndex: number
) => {
  const tindakan = fieldsTindakan.value[tindakanIndex].value;
  const tarifPerKomponen = (inputPersentase / 100) * tindakan.total;
  tindakan.listKomponenTarif[komponenIndex].tarifPerKomponen = parseFloat(
    tarifPerKomponen.toFixed(2)
  );
};
const handlePersentaseItem = (
  inputPersentase: any,
  itemIndex: number,
  komponenIndex: number
) => {
  const item = fieldsItemPemeriksaan.value[itemIndex].value;
  const tarifPerKomponen = (inputPersentase / 100) * item.total;
  item.listKomponenItem[komponenIndex].tarifPerKomponen = parseFloat(
    tarifPerKomponen.toFixed(2)
  );
};
const handlePersentaseKelompok = (
  inputPersentase: any,
  kelompokIndex: number,
  komponenIndex: number
) => {
  const kelompok = fieldsKelompokPemeriksaan.value[kelompokIndex].value;
  const tarifPerKomponen = (inputPersentase / 100) * kelompok.total;
  kelompok.listKomponenKelompok[komponenIndex].tarifPerKomponen = parseFloat(
    tarifPerKomponen.toFixed(2)
  );
};

const handleTotalKomponen = (tindakanIndex: any) => {
  const tindakan = fieldsTindakan.value[tindakanIndex].value;
  tindakan.total = tindakan.listKomponenTarif.reduce((sum, komponen) => {
    return sum + (komponen.tarifPerKomponen || 0);
  }, 0);
};
const handleTotalKomponenItem = (itemIndex: any) => {
  const item = fieldsItemPemeriksaan.value[itemIndex].value;
  item.total = item.listKomponenItem.reduce((sum, komponen) => {
    return sum + (komponen.tarifPerKomponen || 0);
  }, 0);
};
const handleTotalKomponenKelompok = (kelompokIndex: any) => {
  const kelompok = fieldsKelompokPemeriksaan.value[kelompokIndex].value;
  kelompok.total = kelompok.listKomponenKelompok.reduce((sum, komponen) => {
    return sum + (komponen.tarifPerKomponen || 0);
  }, 0);
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 2,
  }).format(value);
};

const totalTindakan = (tindakanIndex: number): string => {
  const tindakan = fieldsTindakan.value[tindakanIndex];

  if (!tindakan || !Array.isArray(tindakan.value.listKomponenTarif)) {
    return formatCurrency(0);
  }

  if (!tindakan.value.isPresentase) {
    const total = tindakan.value.listKomponenTarif.reduce((sum, komponen) => {
      return sum + (komponen.tarifPerKomponen || 0);
    }, 0);

    return formatCurrency(total);
  }

  return formatCurrency(0);
};

const totalItemPemeriksaan = (itemIndex: number): string => {
  const item = fieldsItemPemeriksaan.value[itemIndex];

  if (!item || !Array.isArray(item.value.listKomponenItem)) {
    return formatCurrency(0);
  }

  if (!item.value.isPresentase) {
    const total = item.value.listKomponenItem.reduce((sum, komponen) => {
      return sum + (komponen.tarifPerKomponen || 0);
    }, 0);

    return formatCurrency(total);
  }

  return formatCurrency(0);
};

const totalKelompokPemeriksaan = (kelompokIndex: number): string => {
  const kelompok = fieldsKelompokPemeriksaan.value[kelompokIndex];

  if (!kelompok || !Array.isArray(kelompok.value.listKomponenKelompok)) {
    return formatCurrency(0);
  }

  if (!kelompok.value.isPresentase) {
    const total = kelompok.value.listKomponenKelompok.reduce(
      (sum, komponen) => {
        return sum + (komponen.tarifPerKomponen || 0);
      },
      0
    );

    return formatCurrency(total);
  }

  return formatCurrency(0);
};

watch(
  () => props.isDialogVisible,
  (newValue) => {
    if (newValue) {
      resetDialogMode();
      if (props.method !== "add" && props.payload) {
        console.log(
          "🚀 ~ watch ~ props.payload:",
          JSON.stringify(props.payload)
        );

        // Map data dari payload ke form
        const dataPelayanan =
          props.payload.pelayanan?.map((item: any) => item.pelayanan) || [];
        const dataPenjamin =
          props.payload.tarifLabPenjamin?.map(
            (item: any) => item.penjamin.uuid
          ) || [];

        console.log("watch datapenjamin ==> ", dataPenjamin);
        penjaminUuid.value = dataPenjamin;
        console.log(
          "watch penjaminUuid ==> ",
          JSON.stringify(penjaminUuid.value)
        );
        const dataTarifLabItems =
          props.payload.tarifLabItem
            ?.filter((item: any) => item.itemPemeriksaanUuid != null)
            .map((item: any) => ({
              itemPemeriksaanUuid: item.itemPemeriksaanUuid,
              total: item.totalTarif,
              listKomponenItem:
                item.komponenTarif?.map((komponen: any) => ({
                  tarifKomponenUuid: komponen.tarifKomponenUuid,
                  tarifPerKomponen: komponen.tarif,
                  persentase: komponen.prosentase,
                  isPresentase: komponen.prosentase > 0 ? true : false,
                })) || [],
            })) || [];
        const dataKelompokPemeriksaan =
          props.payload.tarifLabItem
            ?.filter((item: any) => item.kelompokPemeriksaanUuid != null)
            .map((item: any) => ({
              kelompokPemeriksaanUuid: item.kelompokPemeriksaanUuid,
              total: item.totalTarif,
              listKomponenKelompok:
                item.komponenTarif?.map((komponen: any) => ({
                  tarifKomponenUuid: komponen.tarifKomponenUuid,
                  tarifPerKomponen: komponen.tarif,
                  persentase: komponen.prosentase,
                  isPresentase: komponen.prosentase > 0 ? true : false,
                })) || [],
            })) || [];
        const grandTotalValue = props.payload.grandTotal;

        // console.log(
        //   "🚀 ~ watch ~ dataTarif:",
        //   JSON.stringify(dataTarifLabItems)
        // );

        // Set nilai ke form
        setValues({
          code: props.payload.code,
          name: props.payload.name,
          grandTotal: grandTotalValue,
          pelayanans: dataPelayanan,
          penjaminSelected: dataPenjamin,
          tarifLabItems: dataTarifLabItems,
          tarifLabKelompok: dataKelompokPemeriksaan,
          status: props.payload.status,
        });

        // console.log(
        //   "🚀 ~ handlePenjaminUpdate ~ tempPenjamin.value:",
        //   JSON.stringify(tempPenjamin.value)
        // );

        // console.log(
        //   "🚀 ~ handlePenjaminUpdate ~ penjaminUuid.value:",
        //   JSON.stringify(penjaminUuid.value)
        // );

        // console.log("options = ", JSON.stringify(itemPemeriksaanOptions));

        // console.log("tarif lab items", fieldsItemPemeriksaan);

        // Simpan data sementara untuk pembaruan
        tempPelayanan.value = dataPelayanan;
        tempPenjamin.value = dataPenjamin;
      }
    } else {
      resetForm();
      resetDialogMode();
    }
  }
);

onMounted(() => {
  fetchKomponenTarif();
  fetchPenjamin();
  fetchItemPemeriksaan();
  fetchKelompokPemeriksaan();
  // if (props.method === "add") {
  //   handlePushTindakan();
  //   handlePushItemPemeriksaan();
  // } else if (props.method === "edit") {
  //   handleEdit();
  // }
});
</script>

<template>
  <CustomDialog
    :width="method === 'detail' ? '1000px' : '850px'"
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    headerBg="bg-opensimrs-300"
  >
    <template #header>{{ title }} Tarif Lab</template>
    <template #body>
      <!-- Form Input -->
      <div
        v-if="method !== 'detail'"
        class="flex flex-col h-full overflow-hidden"
      >
        <div class="flex flex-col h-full min-h-screen gap-5">
          <!-- Grid Section -->
          <div class="grid grid-cols-12 gap-x-[30px] gap-y-5 mt-5">
            <CustomTextfield
              class="col-span-3"
              label="Kode Tarif"
              v-model="code"
              placeholder="Kode Tarif"
              :invalid="!!errors.code"
              :invalidMessage="errors.code"
              :required="errors.code ? true : false"
            />
            <CustomTextfield
              class="col-span-9"
              label="Nama Tarif Tindakan"
              v-model="name"
              placeholder="Nama Tarif Tindakan"
              :invalid="!!errors.name"
              :invalidMessage="errors.name"
              :required="errors.name ? true : false"
            />

            <CustomMultiSelect
              label="Pelayanan"
              v-model="pelayanans"
              :options="optionsPelayanan"
              optionValue="value"
              @update:modelValue="handleUnitPelayananUpdate"
              optionLabel="label"
              placeholder="Pelayanan"
              class="col-span-12"
              :invalid="!!errors.pelayanans"
              :invalidMessage="errors.pelayanans"
              :required="errors.pelayanans ? true : false"
            />
            <CustomMultiSelect
              label="Metode Pembayaran"
              v-model="penjaminSelected"
              :options="penjaminPayload"
              @update:modelValue="handlePenjaminUpdate"
              optionValue="uuid"
              optionLabel="name"
              placeholder="Metode Pembayaran"
              class="col-span-12"
              :invalid="!!errors.penjaminSelected"
              :invalidMessage="errors.penjaminSelected"
              :required="errors.penjaminSelected ? true : false"
            />
          </div>

          <!-- Accordion Kelompok Section -->
          <div class="overflow-y-auto h-1/2">
            <CustomAccordion
              class="col-span-12"
              initial-state="0"
              :open-with-header="false"
              no-border
            >
              <template #header>
                <div class="flex items-end w-full -ml-4">
                  <div class="font-semibold text-heading">
                    Kelompok Pemeriksaan
                  </div>
                  <div class="grow ml-2.5"></div>
                  <CustomButton
                    icon="PhPlus"
                    label="Kelompok"
                    @click="handlePushKelompokPemeriksaan"
                  />
                </div>
              </template>

              <template #content>
                <!-- Field Array -->
                <div
                  v-for="(
                    fieldKelompokPemeriksaan, idx
                  ) in fieldsKelompokPemeriksaan"
                  :key="idx"
                  class="mt-5"
                >
                  <div
                    class="flex flex-col gap-5 p-5 pt-5 -mx-4 border border-opensimrs-300 rounded-xl"
                  >
                    <div class="flex gap-2.5 items-start">
                      <CustomButton
                        :label="`${idx + 1}`"
                        class="w-10 h-10 p-3 rounded"
                      />
                      <CustomSelect
                        v-model="
                          fieldKelompokPemeriksaan.value.kelompokPemeriksaanUuid
                        "
                        :showLabel="false"
                        place-holder="Kelompok"
                        :options="kelompokPemeriksaanOptions"
                        option-label="label"
                        option-value="value"
                        class="w-full"
                        :invalid="(errors as any)[`tarifLabKelompok[${idx}].kelompokPemeriksaanUuid`] ? true : false"
                        :invalidMessage="(errors as any)[`tarifLabKelompok[${idx}].kelompokPemeriksaanUuid`]"
                      />
                      <CustomButton
                        background-color="bg-danger-300"
                        @click="handleRemoveKelompokPemeriksaan(idx)"
                      >
                        <img src="@/assets/icons/delete.svg" alt="" />
                        <span class="font-semibold text-normal">Hapus</span>
                      </CustomButton>
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <DataTable
                        :value="
                          fieldKelompokPemeriksaan.value.listKomponenKelompok
                        "
                        tableStyle="min-width: 30rem"
                        class="overflow-hidden text-xs rounded-lg bg-opensimrs-50"
                      >
                        <Column
                          headerClass="bg-opensimrs-300 text-white"
                          class="w-7/12"
                          bodyClass="align-top"
                        >
                          <template #header>
                            <div>Komponen Tarif</div>
                          </template>
                          <template #body="slotProps">
                            <CustomSelect
                              v-model="slotProps.data.tarifKomponenUuid"
                              label=""
                              place-holder="Pilih Komponen Tarif"
                              :options="komponenTarifPayload"
                              option-label="name"
                              option-value="uuid"
                              :invalid="(errors as any)[`tarifLabKelompok[${idx}].listKomponenKelompok[${slotProps.index}].tarifKomponenUuid`] ? true : false"
                              :invalidMessage="(errors as any)[`tarifLabKelompok[${idx}].listKomponenKelompok[${slotProps.index}].tarifKomponenUuid`]"
                            />
                          </template>
                        </Column>
                        <Column
                          headerClass="bg-opensimrs-300 text-white"
                          bodyClass="align-top"
                          class="w-2/12"
                        >
                          <template #header>
                            <div class="w-full font-semibold text-end">
                              Persen (%)
                            </div>
                          </template>
                          <template #body="slotProps">
                            <CustomInputNumber
                              v-model="slotProps.data.persentase"
                              label=""
                              :disabled="
                                !fieldKelompokPemeriksaan.value.isPresentase
                              "
                              @update:model-value="
                                handlePersentaseKelompok(
                                  slotProps.data.persentase,
                                  idx,
                                  slotProps.index
                                )
                              "
                            >
                              <template #appendText>
                                <div
                                  class="flex items-center justify-center mr-2.5"
                                >
                                  %
                                </div>
                              </template>
                            </CustomInputNumber>
                          </template>
                        </Column>
                        <Column
                          headerClass="bg-opensimrs-300 text-white"
                          bodyClass="align-top"
                          class="w-4/12"
                        >
                          <template #header>
                            <div class="w-full font-semibold text-end">
                              Rupiah (Rp)
                            </div>
                          </template>
                          <template #body="slotProps">
                            <CustomInputNumber
                              v-model="slotProps.data.tarifPerKomponen"
                              label=""
                              align-number="text-end"
                              :disabled="
                                fieldKelompokPemeriksaan.value.isPresentase
                              "
                              :invalid="(errors as any)[`tarifLabKelompok[${idx}].listKomponenKelompok[${slotProps.index}].tarifPerKomponen`] ? true : false"
                              :invalidMessage="(errors as any)[`tarifLabKelompok[${idx}].listKomponenKelompok[${slotProps.index}].tarifPerKomponen`]"
                              @update:model-value="
                                handleTotalKomponenKelompok(idx)
                              "
                            >
                              <template #prependText>
                                <div
                                  class="flex items-center justify-center px-3 overflow-hidden font-semibold leading-7 text-white border-r text-MD bg-opensimrs-300 rounded-l-md"
                                >
                                  Rp.
                                </div>
                              </template>
                            </CustomInputNumber>
                          </template>
                        </Column>
                        <Column
                          header="Action"
                          headerClass="bg-opensimrs-300 text-white"
                          bodyClass="align-top"
                        >
                          <template #body="slotProps">
                            <CustomButton
                              label=""
                              background-color="bg-danger-300 rounded-lg"
                              class="h-6 w-[26px] p-0 mt-3"
                              @click="
                                removeListKomponenKelompok(idx, slotProps.index)
                              "
                            >
                              <img src="@/assets/icons/delete.svg" alt="" />
                            </CustomButton>
                          </template>
                        </Column>
                      </DataTable>
                      <div class="flex flex-col gap-5 p-5">
                        <div
                          class="flex items-center justify-center p-5 border border-dashed rounded-lg border-opensimrs-300"
                        >
                          <CustomButton
                            icon="PhPlus"
                            label="Komponen Tarif"
                            borderColor="border-opensimrs-300"
                            textColor="text-opensimrs-300"
                            backgroundColor="bg-white"
                            @click="addListKelompokPemeriksaan(idx)"
                          />
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center justify-between gap-4">
                      <CustomSwitch
                        v-model="fieldKelompokPemeriksaan.value.isPresentase"
                        :show-label="false"
                        label=""
                        sideLabel="Persentase"
                        sideLabelTrue="Persentase"
                        class="col-span-6"
                      />
                      <div class="flex items-center">
                        <div
                          class="pr-4 py-2.5 border-r border-grey-300 font-bold text-MD"
                        >
                          Total
                        </div>
                        <div
                          class="min-w-[300px] flex justify-end font-bold text-MD"
                        >
                          <CustomInputNumber
                            v-if="fieldKelompokPemeriksaan.value.isPresentase"
                            v-model="fieldKelompokPemeriksaan.value.total"
                            label=""
                            align-number="text-end"
                            class="w-[200px]"
                          >
                            <template #prependText>
                              <div
                                class="flex items-center justify-center px-3 overflow-hidden font-semibold leading-7 text-white border-r text-MD bg-opensimrs-300 rounded-l-md"
                              >
                                Rp.
                              </div>
                            </template>
                          </CustomInputNumber>
                          <div v-else>
                            {{ totalKelompokPemeriksaan(idx) }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
              <template #collapseIcon>
                <CustomButton
                  icon="PhCaretUp"
                  backgroundColor="bg-transparent"
                  textColor="text-opensimrs-300"
                />
              </template>

              <template #expandIcon>
                <CustomButton
                  icon="PhCaretDown"
                  backgroundColor="bg-transparent"
                  textColor="text-opensimrs-300"
                />
              </template>
            </CustomAccordion>
          </div>
          <hr class="border-200" />

          <!-- Accordion Item Section -->
          <div class="overflow-y-auto h-1/2">
            <CustomAccordion
              class="col-span-12"
              initial-state="0"
              :open-with-header="false"
              no-border
            >
              <template #header>
                <div class="flex items-end w-full -ml-4">
                  <div class="font-semibold text-heading">Item Pemeriksaan</div>
                  <div class="grow ml-2.5"></div>
                  <CustomButton
                    icon="PhPlus"
                    label="Item"
                    @click="handlePushItemPemeriksaan"
                  />
                </div>
              </template>

              <template #content>
                <!-- Field Array -->
                <div
                  v-for="(fieldItemPemeriksaan, idx) in fieldsItemPemeriksaan"
                  :key="idx"
                  class="mt-5"
                >
                  <div
                    class="flex flex-col gap-5 p-5 pt-5 -mx-4 border border-opensimrs-300 rounded-xl"
                  >
                    <div class="flex gap-2.5 items-start">
                      <CustomButton
                        :label="`${idx + 1}`"
                        class="w-10 h-10 p-3 rounded"
                      />
                      <CustomSelect
                        v-model="fieldItemPemeriksaan.value.itemPemeriksaanUuid"
                        :showLabel="false"
                        place-holder="Item Pemeriksaan"
                        :options="itemPemeriksaanOptions"
                        option-label="label"
                        option-value="value"
                        class="w-full"
                        :invalid="(errors as any)[`tarifLabItems[${idx}].itemPemeriksaanUuid`] ? true : false"
                        :invalidMessage="(errors as any)[`tarifLabItems[${idx}].itemPemeriksaanUuid`]"
                      />
                      <CustomButton
                        background-color="bg-danger-300"
                        @click="handleRemoveItemPemeriksaan(idx)"
                      >
                        <img src="@/assets/icons/delete.svg" alt="" />
                        <span class="font-semibold text-normal">Hapus</span>
                      </CustomButton>
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <DataTable
                        :value="fieldItemPemeriksaan.value.listKomponenItem"
                        tableStyle="min-width: 30rem"
                        class="overflow-hidden text-xs rounded-lg bg-opensimrs-50"
                      >
                        <Column
                          headerClass="bg-opensimrs-300 text-white"
                          class="w-7/12"
                          bodyClass="align-top"
                        >
                          <template #header>
                            <div>Komponen Tarif</div>
                          </template>
                          <template #body="slotProps">
                            <CustomSelect
                              v-model="slotProps.data.tarifKomponenUuid"
                              label=""
                              place-holder="Pilih Komponen Tarif"
                              :options="komponenTarifPayload"
                              option-label="name"
                              option-value="uuid"
                              :invalid="(errors as any)[`tarifLabItems[${idx}].listKomponenItem[${slotProps.index}].tarifKomponenUuid`] ? true : false"
                              :invalidMessage="(errors as any)[`tarifLabItems[${idx}].listKomponenItem[${slotProps.index}].tarifKomponenUuid`]"
                            />
                          </template>
                        </Column>
                        <Column
                          headerClass="bg-opensimrs-300 text-white"
                          bodyClass="align-top"
                          class="w-2/12"
                        >
                          <template #header>
                            <div class="w-full font-semibold text-end">
                              Persen (%)
                            </div>
                          </template>
                          <template #body="slotProps">
                            <CustomInputNumber
                              v-model="slotProps.data.persentase"
                              label=""
                              :disabled="
                                !fieldItemPemeriksaan.value.isPresentase
                              "
                              @update:model-value="
                                handlePersentaseItem(
                                  slotProps.data.persentase,
                                  idx,
                                  slotProps.index
                                )
                              "
                            >
                              <template #appendText>
                                <div
                                  class="flex items-center justify-center mr-2.5"
                                >
                                  %
                                </div>
                              </template>
                            </CustomInputNumber>
                          </template>
                        </Column>
                        <Column
                          headerClass="bg-opensimrs-300 text-white"
                          bodyClass="align-top"
                          class="w-4/12"
                        >
                          <template #header>
                            <div class="w-full font-semibold text-end">
                              Rupiah (Rp)
                            </div>
                          </template>
                          <template #body="slotProps">
                            <CustomInputNumber
                              v-model="slotProps.data.tarifPerKomponen"
                              label=""
                              align-number="text-end"
                              :disabled="
                                fieldItemPemeriksaan.value.isPresentase
                              "
                              :invalid="(errors as any)[`tarifLabItem[${idx}].listKomponenItem[${slotProps.index}].tarifPerKomponen`] ? true : false"
                              :invalidMessage="(errors as any)[`tarifLabItem[${idx}].listKomponenItem[${slotProps.index}].tarifPerKomponen`]"
                              @update:model-value="handleTotalKomponenItem(idx)"
                            >
                              <template #prependText>
                                <div
                                  class="flex items-center justify-center px-3 overflow-hidden font-semibold leading-7 text-white border-r text-MD bg-opensimrs-300 rounded-l-md"
                                >
                                  Rp.
                                </div>
                              </template>
                            </CustomInputNumber>
                          </template>
                        </Column>
                        <Column
                          header="Action"
                          headerClass="bg-opensimrs-300 text-white"
                          bodyClass="align-top"
                        >
                          <template #body="slotProps">
                            <CustomButton
                              label=""
                              background-color="bg-danger-300 rounded-lg"
                              class="h-6 w-[26px] p-0 mt-3"
                              @click="
                                removeListKomponenItem(idx, slotProps.index)
                              "
                            >
                              <img src="@/assets/icons/delete.svg" alt="" />
                            </CustomButton>
                          </template>
                        </Column>
                      </DataTable>
                      <div class="flex flex-col gap-5 p-5">
                        <div
                          class="flex items-center justify-center p-5 border border-dashed rounded-lg border-opensimrs-300"
                        >
                          <CustomButton
                            icon="PhPlus"
                            label="Komponen Tarif"
                            borderColor="border-opensimrs-300"
                            textColor="text-opensimrs-300"
                            backgroundColor="bg-white"
                            @click="addListItemPemeriksaan(idx)"
                          />
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center justify-between gap-4">
                      <CustomSwitch
                        v-model="fieldItemPemeriksaan.value.isPresentase"
                        :show-label="false"
                        label=""
                        sideLabel="Persentase"
                        sideLabelTrue="Persentase"
                        class="col-span-6"
                      />
                      <div class="flex items-center">
                        <div
                          class="pr-4 py-2.5 border-r border-grey-300 font-bold text-MD"
                        >
                          Total
                        </div>
                        <div
                          class="min-w-[300px] flex justify-end font-bold text-MD"
                        >
                          <CustomInputNumber
                            v-if="fieldItemPemeriksaan.value.isPresentase"
                            v-model="fieldItemPemeriksaan.value.total"
                            label=""
                            align-number="text-end"
                            class="w-[200px]"
                          >
                            <template #prependText>
                              <div
                                class="flex items-center justify-center px-3 overflow-hidden font-semibold leading-7 text-white border-r text-MD bg-opensimrs-300 rounded-l-md"
                              >
                                Rp.
                              </div>
                            </template>
                          </CustomInputNumber>
                          <div v-else>
                            {{ totalItemPemeriksaan(idx) }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
              <template #collapseIcon>
                <CustomButton
                  icon="PhCaretUp"
                  backgroundColor="bg-transparent"
                  textColor="text-opensimrs-300"
                />
              </template>

              <template #expandIcon>
                <CustomButton
                  icon="PhCaretDown"
                  backgroundColor="bg-transparent"
                  textColor="text-opensimrs-300"
                />
              </template>
            </CustomAccordion>
          </div>
          <hr class="border-200" />

          <div class="flex items-center justify-end gap-4">
            <div class="pr-4 py-2.5 border-r border-grey-300 font-bold text-MD">
              Grand Total
            </div>
            <div class="min-w-[300px] flex justify-end font-bold text-MD">
              <div>
                {{ grandTotalValues }}
              </div>
            </div>
          </div>
          <hr class="border-200" />
          <CustomSwitch
            v-model="status"
            :show-label="true"
            label="Status"
            sideLabel="Non-Aktif"
            sideLabelTrue="Aktif"
            class="col-span-6"
          />
        </div>
      </div>

      <!-- Detail Data -->
      <div v-if="method === 'detail'" class="grid grid-cols-12 gap-5 mt-5">
        <div class="flex flex-col col-span-6">
          <!-- <div>{{ payload }}</div> -->

          <div class="font-semibold underline text-SM">Kode Tarif</div>
          <div class="font-normal text-normal">
            {{ payload.code }}
          </div>
        </div>
        <div class="flex flex-col col-span-4">
          <div class="font-semibold underline text-SM">Nama Tarif Tindakan</div>
          <div class="font-normal text-normal">
            {{ payload.name }}
          </div>
        </div>

        <div class="flex flex-col col-span-6">
          <div class="font-semibold underline text-SM">Pelayanan</div>
          <div class="flex flex-wrap w-full h-full gap-1">
            <CustomChip
              v-for="pelayanan in payload.pelayanan"
              :label="pelayanan.pelayanan"
              textColor="text-white"
              bgColor="bg-opensimrs-300"
              borderColor="border-none"
              :showCheckedIcon="false"
              customClass="text-xs font-semibold h-5 flex w-fit"
            />
          </div>
        </div>
        <div class="flex flex-col col-span-4">
          <div class="font-semibold underline text-SM">Mode Pembayaran</div>
          <div class="flex flex-wrap w-full h-full gap-1">
            <CustomChip
              v-for="(item, i) in payload.tarifLabPenjamin"
              :label="item.penjamin.name"
              :showCheckedIcon="false"
              :border-color="
                item.penjamin.name === 'Tunai' ? 'border-none' : 'border-none'
              "
              :bg-color="
                item.penjamin.name === 'Tunai'
                  ? 'bg-opensimrs-300'
                  : 'bg-warning-300'
              "
              :customClass="
                item.penjamin.name === 'Tunai'
                  ? 'text-xs font-semibold cursor-auto h-5 bg-opensimrs-300 text-white pr-2 pl-3 '
                  : 'cursor-auto h-5 bg-warning-300 text-white pr-2 pl-3'
              "
            />
          </div>
        </div>
        <CustomAccordion
          class="col-span-12"
          initial-state="0"
          :open-with-header="false"
          no-border
        >
          <template #header> List Kelompok Pemeriksaan </template>
          <template #content>
            <div
              v-for="(tindakan, idx) in payload.tarifLabItem.filter((item: any) => item.kelompokPemeriksaanUuid !== null)"
              :key="idx"
              class="mt-5"
            >
              <div
                class="flex flex-col gap-5 p-5 pt-5 mb-5 -mx-4 border border-opensimrs-300 rounded-xl"
              >
                <div class="flex gap-2.5 items-center">
                  <CustomButton
                    :label="`${idx + 1}`"
                    class="w-10 h-10 p-3 rounded"
                  />
                  <div class="font-semibold text-normal">
                    {{ tindakan.kelompokPemeriksaan.name }}
                  </div>
                </div>
                <DataTable
                  :value="tindakan.komponenTarif"
                  tableStyle="min-width: 50rem"
                  class="overflow-hidden text-xs rounded-lg"
                >
                  <Column
                    header="Komponen Tarif"
                    headerClass="bg-opensimrs-300 text-white"
                    bodyClass="align-top"
                  >
                    <template #body="slotProps">
                      {{ slotProps.data.name || "-" }}
                    </template>
                  </Column>
                  <Column
                    headerClass="bg-opensimrs-300 text-white font-semibold text-SM"
                    class="w-6/12 text-end"
                    bodyClass="align-top text-end"
                  >
                    <template #header>
                      <div class="w-full text-end">Rupiah (Rp)</div>
                    </template>
                    <template #body="slotProps">
                      {{ slotProps.data.tarif }}
                    </template>
                  </Column>
                </DataTable>
                <div class="flex items-center justify-end col-span-12 gap-4">
                  <div
                    class="pr-4 py-2.5 border-r border-grey-300 font-bold text-MD"
                  >
                    Total
                  </div>
                  <div class="min-w-[300px] text-end font-bold text-MD">
                    {{ tindakan.totalTarif }}
                  </div>
                </div>
              </div>
            </div>
          </template>
          <template #collapseIcon>
            <CustomButton
              icon="PhCaretUp"
              backgroundColor="bg-transparent"
              textColor="text-opensimrs-300"
            />
          </template>

          <template #expandIcon>
            <CustomButton
              icon="PhCaretDown"
              backgroundColor="bg-transparent"
              textColor="text-opensimrs-300"
            />
          </template>
        </CustomAccordion>
        <CustomAccordion
          class="col-span-12"
          initial-state="0"
          :open-with-header="false"
          no-border
        >
          <template #header> List Item Pemeriksaan </template>
          <template #content>
            <div
              v-for="(tindakan, idx) in payload.tarifLabItem.filter((item: any) => item.itemPemeriksaanUuid !== null)"
              :key="idx"
              class="mt-5"
            >
              <div
                class="flex flex-col gap-5 p-5 pt-5 mb-5 -mx-4 border border-opensimrs-300 rounded-xl"
              >
                <div class="flex gap-2.5 items-center">
                  <CustomButton
                    :label="`${idx + 1}`"
                    class="w-10 h-10 p-3 rounded"
                  />
                  <div class="font-semibold text-normal">
                    {{ tindakan.itemPemeriksaan.name }}
                  </div>
                </div>
                <DataTable
                  :value="tindakan.komponenTarif"
                  tableStyle="min-width: 50rem"
                  class="overflow-hidden text-xs rounded-lg"
                >
                  <Column
                    header="Komponen Tarif"
                    headerClass="bg-opensimrs-300 text-white"
                    bodyClass="align-top"
                  >
                    <template #body="slotProps">
                      {{ slotProps.data.name || "-" }}
                    </template>
                  </Column>
                  <Column
                    headerClass="bg-opensimrs-300 text-white font-semibold text-SM"
                    class="w-6/12 text-end"
                    bodyClass="align-top text-end"
                  >
                    <template #header>
                      <div class="w-full text-end">Rupiah (Rp)</div>
                    </template>
                    <template #body="slotProps">
                      {{ slotProps.data.tarif }}
                    </template>
                  </Column>
                </DataTable>
                <div class="flex items-center justify-end col-span-12 gap-4">
                  <div
                    class="pr-4 py-2.5 border-r border-grey-300 font-bold text-MD"
                  >
                    Total
                  </div>
                  <div class="min-w-[300px] text-end font-bold text-MD">
                    {{ tindakan.totalTarif }}
                  </div>
                </div>
              </div>
            </div>
          </template>
          <template #collapseIcon>
            <CustomButton
              icon="PhCaretUp"
              backgroundColor="bg-transparent"
              textColor="text-opensimrs-300"
            />
          </template>

          <template #expandIcon>
            <CustomButton
              icon="PhCaretDown"
              backgroundColor="bg-transparent"
              textColor="text-opensimrs-300"
            />
          </template>
        </CustomAccordion>

        <hr class="col-span-12 border-grey-200" />
        <div class="flex items-center justify-end col-span-12 gap-4">
          <div class="pr-4 py-2.5 border-r border-grey-300 font-bold text-MD">
            Grand Total
          </div>
          <div class="min-w-[300px] text-end font-bold text-MD">
            {{ payload.grandTotal }}
          </div>
        </div>
        <hr class="col-span-12 border-grey-200" />
        <CustomInfoRow label="Status" class="col-span-12">
          <template #value>
            <CustomChip
              :label="payload.status === true ? 'AKTIF' : 'NON-AKTIF'"
              :textColor="
                payload.status === true ? 'text-white' : 'text-[#80868d]'
              "
              :bgColor="payload.status === true ? 'bg-opensimrs-300' : 'bg-white'"
              :borderColor="
                payload.status === true ? 'border-none' : 'border-[#80868d]'
              "
              :icon-color="payload.status === true ? 'white' : '#80868d'"
              customClass="text-xs font-semibold h-5 flex w-fit"
            />
          </template>
        </CustomInfoRow>
      </div>
    </template>
    <template #footer>
      <div class="w-full">
        <div class="mt-5 flex justify-end gap-2.5">
          <CustomButton
            v-if="method === 'edit'"
            label="Batal"
            border-color="border-grey-200"
            background-color="bg-white"
            text-color="text-grey-300"
            @click="closeDialog"
          />
          <CustomButton
            v-if="method !== 'edit' && method !== 'detail'"
            label="Reset"
            border-color="border-grey-200"
            background-color="bg-white"
            text-color="text-grey-300"
            @click="resetForm"
          />
          <CustomButton
            v-if="method !== 'detail'"
            label="Simpan"
            @click="onSubmit"
          />
          <CustomButton
            v-if="method === 'detail'"
            label="Edit"
            @click="handleEdit"
          />
        </div>
      </div>
    </template>
  </CustomDialog>
</template>
