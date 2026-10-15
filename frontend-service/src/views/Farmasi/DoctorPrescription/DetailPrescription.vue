<script setup lang="ts">
import { ref, onMounted, watch, computed } from "vue";
import { useForm, useFieldArray, ErrorMessage } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { useMedicalItemStore } from "@/stores/datamasterFarmasi/MedicalItem";
import { useDoctorPrescriptionStore } from "@/stores/farmasi/DoctorPrescription";
import { utilsStore } from "@/stores/utils";
import { epochToDate } from "@/utils/Helpers";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { useStockLocationStore } from "@/stores/datamasterFarmasi/StockLocation";
import { usePegawaiStore } from "@/stores/datamaster/pegawai";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import FormObat from "./FormObat.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import Obat from "@/components/RekamMedis/ResumeDiscarge/Obat.vue";
import { createETiketPdf, createEResepPdf } from "@/utils/pdf/pdfFarmasi/cetakResep";

// define props
const props = defineProps({
  payloadDetail: {
    type: Object,
    default: () => ({}),
  },
});

watch(
  () => props.payloadDetail,
  (newVal) => {
    console.log("payloadDetail changed:", newVal);
  },
  { immediate: true, deep: true }
);

const payload = ref({ ...props.payloadDetail });

// Identitas & ringkasan klinis pasien untuk telaah resep (sebelumnya berisi teks contoh yang ditulis mati)
const rekamMedisStore = useRekamMedisStore();
const ringkasanKlinis = ref<any>(null);
const PELAYANAN_RESEP: Record<string, string> = { rj: "RJ", ri: "RI", igd: "IGD" };
const pasienResep = computed(() => (payload.value as any)?.pasien ?? {});
const perempuan = computed(() => /^(female|p|perempuan)$/i.test(String(pasienResep.value.gender ?? "")));
const tglLahirResep = computed(() => {
  const t = pasienResep.value.tanggalLahir;
  return t ? new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-";
});
const diagnosisSekunder = computed(() =>
  (ringkasanKlinis.value?.diagnosisDokter ?? []).filter((d: any) => !d.deletedAt && d.tipe !== "primer").map((d: any) => d.diagnosis?.split("~")[0]).filter(Boolean)
);
const muatRingkasanKlinis = async (rekamMedisUuid?: string) => {
  ringkasanKlinis.value = null;
  if (!rekamMedisUuid) return;
  try {
    const res = await rekamMedisStore.getRekamMedis({ rekamMedisUuid });
    ringkasanKlinis.value = res?.payload?.summary ?? null;
  } catch {
    ringkasanKlinis.value = null;
  }
};
watch(
  () => (props.payloadDetail as any)?.rekamMedisUuid,
  (uuid) => muatRingkasanKlinis(uuid),
  { immediate: true }
);

watch(
  payload,
  (newVal) => {
    console.log("payload changed:", newVal);
  },
  { immediate: true, deep: true }
);

const emit = defineEmits(["close"]);

// data user from local storage
const userData = ref<userData | undefined>(undefined);
userData.value = JSON.parse(localStorage.getItem("user") ?? "");

// define ref variabel
const DoctorPrescriptionStore = useDoctorPrescriptionStore();
const MedicalItemStore = useMedicalItemStore();
const UseUtilsStore = utilsStore();
const pegawaiStore = usePegawaiStore();
const pegawaiPayload = ref<any[]>([]);
const StockLocationPayload = ref<any[]>([]);
const StockLocationStore = useStockLocationStore();
const stockObatPayload = ref();
const stockObatNonRacikanPayload = ref();
const stockObatRacikanPayload = ref();
const penerima = ref("");
// obat dibawa pulang atau resep RJ/IGD: penerima diketik (pasien/keluarga); rawat inap: pilih perawat penerima
const penerimaDiketik = computed(() => !!(payload.value as any)?.isTakeaway || ["rj", "igd"].includes((payload.value as any)?.jenisPelayanan));
const noHpPenerima = ref("");
const alasanBatal = ref("");
const awalLokasi = ref("");
const lokasiTujuan = ref("");
const totalTagihan = ref();
// define ref dialog
const batalDialog = ref(false);
const pindahDialog = ref(false);
const cetakDialog = ref(false);
const cetak = async (jenis: "e-tiket" | "e-resep" | "salinan") => {
  UseUtilsStore.setLoading(true);
  try {
    if (jenis === "e-tiket") {
      const res = await DoctorPrescriptionStore.cetakETiket(payload.value.uuid);
      if (res?.payload?.length) createETiketPdf(res.payload);
    } else {
      const res = await DoctorPrescriptionStore.cetakEResep(payload.value.uuid);
      if (res?.payload) createEResepPdf(res.payload, jenis === "salinan");
    }
  } finally {
    UseUtilsStore.setLoading(false);
  }
};
const isTambahDataDialogVisible = ref(false);
// define ref selected
const selectedTelaah = ref<any[]>([]);
const selectedTelaah2 = ref<any[]>([]);
const selectedTelaah3 = ref<any[]>([]);
const selectedEdukasi = ref<any[]>([]);
const selectedPegawai = ref();
// dialog config
const dialogConfig = ref<any>({
  method: "add",
  title: "Tambah Data",
  data: null,
});

const openDialog = (method: string, title: string, data: any = null) => {
  dialogConfig.value = { method, title, data };
  isTambahDataDialogVisible.value = true;
};

// define ref datatable items obat dan racikan
const itemsObat = ref([
  {
    stokObat: "",
    sisa: "",
    aturanPakai: "",
    biayaSatuan: "",
    subTotal: "",
  },
]);

const itemsRacikan = ref([
  {
    caraPakai: "",
    embalase: "",
    racik: "",
    subTotal: "",
  },
]);
//interface
interface userData {
  name: string;
  role: string;
}

interface Racikan {
  hargaSatuan: string;
  medicationQty: number;
  subTotal: number;
  sisaStok: number;
}

interface AturanPakai {
  name: string;
}

interface Obat {
  uuid: string;
  isCompound: boolean;
  itemMedis: { name: string };
  jenisStok: { name: string };
  medicationQty: number;
  aturanPakai: AturanPakai;
  racikan: Array<Racikan>;
  grandTotal: number;
  bentukRacikan: any;
  biayaEmbalase: number;
  biayaRacik: number;
  hargaSatuan: number;
  sisaStok: number;
  jenisStokUuid: string;
  caraPakai: any;
  isTakeaway: boolean;
  isChronic: boolean;
}

// Fetch data for option selection
const fetchPegawai = async () => {
  try {
    const response = await pegawaiStore.getAktifApi();
    if (response && response.payload) {
      pegawaiPayload.value = response.payload;
      console.log("pegawaiPayload.value", pegawaiPayload.value);
    } else {
      pegawaiPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data pegawai", error);
    pegawaiPayload.value = [];
  }
};

const fetchStockObat = async () => {
  if (props.payloadDetail.isCompound == true) {
    const itemMedsUuidInRacikan = props.payloadDetail.obat.flatMap(
      (obat: any) =>
        obat.racikan.map((racikan: any) =>
          racikan.itemMedis ? racikan.itemMedis.uuid : null
        )
    );
    try {
      const response = await MedicalItemStore.getAvailableStockApi(
        itemMedsUuidInRacikan
      );
      if (response && response.payload) {
        stockObatPayload.value = response.payload;
      } else {
        stockObatPayload.value = [];
      }
    } catch (error) {
      console.error("Failed to fetch data", error);
      stockObatPayload.value = [];
    }
  } else {
    const uuidObat = props.payloadDetail.obat[0].itemMedis.uuid;

    try {
      const response = await MedicalItemStore.getAvailableStockApi(uuidObat);

      if (response && response.payload) {
        stockObatPayload.value = response.payload;
      } else {
        stockObatPayload.value = [];
      }
    } catch (error) {
      console.error("Failed to fetch data", error);
      stockObatPayload.value = [];
    }
  }
};

const filterAvailableStock = (list: unknown) => {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: any[] = [];

  for (const x of list as any[]) {
    if (!x?.detailStok) continue;
    if (x?.harga === 0) continue;
    if (x?.totalStok === 0) continue;

    const key = x?.detailStok?.uuid;
    if (!key) {
      out.push(x);
      continue;
    }

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(x);
  }

  return out;
};

// Fetch Obat Racikan
const fetchObatRacikan = async () => {
  try {
    const lokasiStokUuid = payload.value?.lokasiStokUuid ?? "";
    const obatList = Array.isArray((payload.value as any)?.obatItems)
      ? (payload.value as any).obatItems
      : Array.isArray((payload.value as any)?.obat)
      ? (payload.value as any).obat
      : [];

    const racikanUuids: string[] = obatList
      .filter((o: any) => o?.isCompound)
      .flatMap((o: any) => {
        const racikanList = Array.isArray(o?.racikanItems)
          ? o.racikanItems
          : Array.isArray(o?.racikan)
          ? o.racikan
          : [];

        return racikanList
          .map((r: any) => r?.itemMedisUuid ?? r?.itemMedis?.uuid ?? null)
          .filter((uuid: string | null) => !!uuid && uuid !== "-") as string[];
      });

    if (!racikanUuids.length) {
      stockObatRacikanPayload.value = [];
      console.log(
        "stockObatRacikanPayload.value empty",
        stockObatRacikanPayload.value
      );
      return;
    }

    const responses = await Promise.all(
      racikanUuids.map((uuid: string) =>
        MedicalItemStore.getAvailableStockApi(uuid, lokasiStokUuid).catch(
          (error) => {
            console.error(`Failed to fetch data for UUID: ${uuid}`, error);
          }
        )
      )
    );

    console.log("responses fetchObatRacikan", responses);
    const list = responses.flatMap((response: any) =>
      Array.isArray(response?.payload) ? response.payload : []
    );
    stockObatRacikanPayload.value = filterAvailableStock(list);
    console.log("stockObatRacikanPayload.value", stockObatRacikanPayload.value);
  } catch (error) {
    console.error("Failed to fetch all data", error);
    stockObatRacikanPayload.value = [];
  }
};

// Fetch Obat Non Racikan
const fetchObatNonRacikan = async () => {
  try {
    const lokasiStokUuid = payload.value?.lokasiStokUuid ?? "";
    const obatList = Array.isArray((payload.value as any)?.obatItems)
      ? (payload.value as any).obatItems
      : Array.isArray((payload.value as any)?.obat)
      ? (payload.value as any).obat
      : [];

    const nonCompound = obatList.find((o: any) => !o?.isCompound);
    const uuidNonRacikan =
      nonCompound?.itemMedisUuid ?? nonCompound?.itemMedis?.uuid ?? null;

    if (!uuidNonRacikan || uuidNonRacikan === "-") {
      stockObatNonRacikanPayload.value = [];
      console.log(
        "stockObatNonRacikanPayload.value empty",
        stockObatNonRacikanPayload.value
      );
      return;
    }

    const response = await MedicalItemStore.getAvailableStockApi(
      uuidNonRacikan,
      lokasiStokUuid
    );

    if (response && response.payload) {
      stockObatNonRacikanPayload.value = filterAvailableStock(response.payload);
      console.log(
        "stockObatNonRacikanPayload.value",
        stockObatNonRacikanPayload.value
      );
    } else {
      stockObatNonRacikanPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    stockObatNonRacikanPayload.value = [];
  }
};

// Fetch Stock Location
const fetchStockLocation = async () => {
  try {
    const response = await StockLocationStore.getApi();

    if (response && response.payload) {
      StockLocationPayload.value = response.payload;
      console.log("StockLocationPayload.value", StockLocationPayload.value);
    } else {
      StockLocationPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    StockLocationPayload.value = [];
  }
};

// Item telaaah dan edukasi
const itemTelaah = ref([
  {
    farmasetik: "Nama Obat, Bentuk, dan Kekuatan Sediaan",
  },
  {
    farmasetik: "Dosis dan Jumlah Obat",
  },
  {
    farmasetik: "Stabilitas",
  },
  {
    farmasetik: "Aturan dan Cara Penggunaan",
  },
]);

const itemTelaah2 = ref([
  {
    administratif: "Benar Identitas pasien",
  },
  {
    administratif: "Identitas Dokter",
  },
  {
    administratif: "Tanggal Resep",
  },
  {
    administratif: "Unit Asal Resep",
  },
]);

const itemTelaah3 = ref([
  {
    klinik: "Ketepatan Indikasi, Dosis, dan Waktu Penggunaan Obat",
  },
  {
    klinik: "Duplikasi Pengobatan",
  },
  {
    klinik: "Alergi dan Reaksi Obat yang Tidak Dikehendaki (ROTD)",
  },
  {
    klinik: "Kontraindikasi",
  },
  {
    klinik: "Interaksi Obat",
  },
]);

const itemEdukasi = ref([
  {
    edukasi: "Cara Penggunaan",
  },
  {
    edukasi: "Dosis",
  },
  {
    edukasi: "Efek Samping",
  },
  {
    edukasi: "Khasiat Obat",
  },
  {
    edukasi: "Nama Obat",
  },
]);

const schema = toTypedSchema(
  yup
    .object({
      obat: yup.array().of(
        yup.object({
          jenisStokUuid: yup.string().when("isCompound", {
            is: (value: boolean) => value === false,
            then: (schema) => schema.required("Stok Obat harus dipilih"),
            otherwise: (schema) => schema.notRequired(),
          }),
          racikan: yup.array().when("isCompound", {
            is: true,
            then: (schema) =>
              schema
                .of(
                  yup.object({
                    jenisStokUuid: yup
                      .string()
                      .required("Stok Obat harus dipilih"),
                  })
                )
                .strict(),
            otherwise: (schema) => schema.notRequired(),
          }),
        })
      ),
    })
    .noUnknown()
);

const { errors, handleSubmit, resetForm, setValues, defineField } = useForm({
  validationSchema: schema,
});

const { remove, push, fields } = useFieldArray<any>("obat");

watch(
  fields,
  (newFields) => {
    console.log(
      "fields changed:",
      newFields.map((f: any) => f.value)
    );
  },
  { deep: true, immediate: true }
);

const updateObatRacikan = async (
  racikan: any,
  uuidObat: string,
  uuidStock: string,
  indexObat: number,
  indexRacikan: number
) => {
  UseUtilsStore.setLoading(true);

  const value = {
    isRacikan: racikan,
    jenisStokUuid: uuidStock,
  };
  try {
    const response = await DoctorPrescriptionStore.updateStokObat(
      uuidObat,
      value
    );

    // find data stok obat
    const selectedStock = stockObatRacikanPayload.value.find(
      (stock: any) => stock.uuid === uuidStock
    );

    if (fields.value[indexObat].value.isCompound) {
      const selectedRacikan =
        fields.value[indexObat].value.racikan[indexRacikan];
      selectedRacikan.hargaSatuan = selectedStock.harga;
      selectedRacikan.sisaStok = selectedStock.totalStok;
      selectedRacikan.subTotal =
        selectedStock.harga * selectedRacikan.medicationQty;

      // Hitung grandTotal
      const racikanItems = fields.value[indexObat].value.racikan;
      const grandTotal = racikanItems.reduce((total: number, item: any) => {
        return total + (item.subTotal || 0);
      }, 0);

      // Tambahkan grandTotal ke fields[indexObat]
      fields.value[indexObat].value.grandTotal = grandTotal;
    } else {
      const selectedObat = fields.value[indexObat].value;
      selectedObat.hargaSatuan = selectedStock.harga;
      selectedObat.sisaStok = selectedStock.totalStok;
      selectedObat.grandTotal =
        selectedObat.hargaSatuan * selectedObat.medicationQty;
    }
    // Hitung Total Tagihan secara aman
    totalTagihan.value = fields.value.reduce((total, item) => {
      const itemGrandTotal = item.value?.grandTotal || 0;
      return total + itemGrandTotal;
    }, 0);
  } catch (error) {
    console.error("Failed to update data", error);
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const updateObatNonRacikan = async (
  racikan: any,
  uuidObat: string,
  uuidStock: string,
  indexObat: number,
  indexRacikan: number
) => {
  UseUtilsStore.setLoading(true);

  const value = {
    isRacikan: racikan,
    jenisStokUuid: uuidStock,
  };
  try {
    const response = await DoctorPrescriptionStore.updateStokObat(
      uuidObat,
      value
    );

    // find data stok obat
    const selectedStock = stockObatNonRacikanPayload.value.find(
      (stock: any) => stock.uuid === uuidStock
    );

    if (fields.value[indexObat].value.isCompound) {
      const selectedRacikan =
        fields.value[indexObat].value.racikan[indexRacikan];
      selectedRacikan.hargaSatuan = selectedStock.harga;
      selectedRacikan.sisaStok = selectedStock.totalStok;
      selectedRacikan.subTotal =
        selectedStock.harga * selectedRacikan.medicationQty;

      // Hitung grandTotal
      const racikanItems = fields.value[indexObat].value.racikan;
      const grandTotal = racikanItems.reduce((total: number, item: any) => {
        return total + (item.subTotal || 0);
      }, 0);

      // Tambahkan grandTotal ke fields[indexObat]
      fields.value[indexObat].value.grandTotal = grandTotal;
    } else {
      const selectedObat = fields.value[indexObat].value;
      selectedObat.hargaSatuan = selectedStock.harga;
      selectedObat.sisaStok = selectedStock.totalStok;
      selectedObat.grandTotal =
        selectedObat.hargaSatuan * selectedObat.medicationQty;
    }
    // Hitung Total Tagihan secara aman
    totalTagihan.value = fields.value.reduce((total, item) => {
      const itemGrandTotal = item.value?.grandTotal || 0;
      return total + itemGrandTotal;
    }, 0);
  } catch (error) {
    console.error("Failed to update data", error);
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// Focus Obat Racikan
// const focusObatRacikan = (selectedUuid: string) => {
//   console.log("UUID yang difokuskan:", selectedUuid);
// };
// const focusObatRacikan = (uuid: string) => {
//   console.log(uuid, 'uuid');

//   fetchObatRacikan(uuid)
// };
const detailPrescriptionPayload = ref([]);

const fetchDetailPrescription = async () => {
  try {
    const response = await DoctorPrescriptionStore.detailApi(
      payload.value.uuid
    );
    detailPrescriptionPayload.value = response?.payload || {};
    console.log("payload.value fetchDetailPrescription", payload.value);
  } catch (error) {
    console.error("Failed to fetch data:", error);
    payload.value = {};
  }

  totalTagihan.value = 0;
  if (payload.value?.lokasiStokUuid) {
    awalLokasi.value = payload.value.lokasiStokUuid;
  }
};

// Format rupiah
const formatRupiah = (value: any) => {
  const number = Number(value);
  if (isNaN(number)) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
    }).format(0);
  }
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
  }).format(number);
};

const checkTelaah = computed(() => {
  return (
    selectedTelaah.value.length === itemTelaah.value.length &&
    selectedTelaah2.value.length === itemTelaah2.value.length &&
    selectedTelaah3.value.length === itemTelaah3.value.length
  );
});

const simpanTelaah = async (uuid: string) => {
  try {
    const response = await DoctorPrescriptionStore.updateTelaah({
      uuid: uuid,
      petugasTelaah: selectedPegawai.value,
    });
  } catch (error) {
    console.error("Failed to process the data:", error);
  }
  fetchDetailPrescription();
};

const verifikasiPetugas = async (uuid: string) => {
  try {
    if (payload.value.orderStatus === 2) {
      const obatList = Array.isArray(fields.value)
        ? fields.value.map((f: any) => f?.value)
        : [];

      const items = obatList
        .filter((o: any) => o && o.isCompound === false)
        .map((o: any) => ({
          item_uuid: o?.uuid,
          jenis_stok_uuid: o?.jenisStokUuid,
        }))
        .filter((x: any) => !!x.item_uuid && !!x.jenis_stok_uuid);

      const racikan_items = obatList
        .filter((o: any) => o && o.isCompound === true)
        .flatMap((o: any) => {
          const list = Array.isArray(o?.racikanItems)
            ? o.racikanItems
            : Array.isArray(o?.racikan)
            ? o.racikan
            : [];
          return list.map((r: any) => ({
            racikan_uuid: r?.uuid,
            jenis_stok_uuid: r?.jenisStokUuid,
          }));
        })
        .filter((x: any) => !!x.racikan_uuid && !!x.jenis_stok_uuid);

      const body: any = { uuid };
      if (items.length) body.items = items;
      if (racikan_items.length) body.racikan_items = racikan_items;

      const response = await DoctorPrescriptionStore.statusVerifikasi(body);
    } else if (payload.value.orderStatus === 3) {
      const response = await DoctorPrescriptionStore.statusSiapDiserahkan({
        uuid: uuid,
      });
    } else if (payload.value.orderStatus === 4) {
      const response = await DoctorPrescriptionStore.statusDiserahkan({
        uuid: uuid,
        penerima: penerima.value,
        noHpPenerima: noHpPenerima.value,
        petugasEdukasi: selectedPegawai.value,
      });
      emit("close");
    }
    fetchDetailPrescription();
  } catch (error) {
    console.error("Failed to process the data:", error);
  }
};

const batalOrder = async (uuid: string) => {
  try {
    const response = await DoctorPrescriptionStore.batalOrder({
      uuid: uuid,
      alasanBatal: alasanBatal.value,
    });
  } catch (error) {
    console.error("Failed to process the data:", error);
  }
  fetchDetailPrescription();
  batalDialog.value = false;
  alasanBatal.value = "";
};

const batalPenyerahan = async (uuid: string) => {
  try {
    const response = await DoctorPrescriptionStore.batalSiapDiserahkan({
      uuid: uuid,
    });
  } catch (error) {
    console.error("Failed to process the data:", error);
  }
  fetchDetailPrescription();
};

const pindahLokasi = async (uuid: string) => {
  try {
    const response = await DoctorPrescriptionStore.lokasiStok({
      uuid: uuid,
      lokasiStokUuid: lokasiTujuan.value,
    });
  } catch (error) {
    console.error("Failed to process the data:", error);
  }
  pindahDialog.value = false;
  lokasiTujuan.value = "";
  emit("close");
};

const closeBatalDialog = () => {
  alasanBatal.value = "";
};

const closePindahLokasiDialog = () => {
  lokasiTujuan.value = "";
};

if (userData.value) {
  selectedPegawai.value = userData.value.name;
}

watch(
  () => props.payloadDetail,
  (newPayload: any) => {
    console.log("props.payloadDetail:", newPayload);
    payload.value = newPayload;
    if (payload.value?.lokasiStokUuid) {
      awalLokasi.value = newPayload.lokasiStokUuid;
    }
    setValues({
      obat:
        payload.value.obatItems?.map((item: any) => ({
          ...item,
          isTakeaway: payload.value?.isTakeaway,
          orderStatus: payload.value?.orderStatus,
          totalHarga: payload.value?.totalHarga,
        })) || [],
    });
  },
  { immediate: true }
);

onMounted(() => {
  if (props.payloadDetail.isCompoundFlag == true) {
    fetchObatRacikan();
  }
  // fetchStockObat();
  fetchObatNonRacikan();
  fetchPegawai();
  fetchStockLocation();
});
</script>

<template>
  <div class="col-span-2">
    <div class="mt-[10px] p-3 bg-opensimrs-75">
      <!-- Title -->
      <div class="mt-[10px] p-4 rounded-t-lg bg-opensimrs-300 shadow-md h-[60px]">
        <div class="grid grid-cols-2 gap-2">
          <div class="flex">
            <p class="font-bold text-white font-poppins">{{ payload.noResep }}</p>
            <CustomChip
              :label="Number(payload.paymentMethod) === 2 ? 'ASURANSI' : 'TUNAI'"
              :showCheckedIcon="false"
              borderColor="border-opensimrs-300"
              bgColor="bg-opensimrs-50"
              textColor="text-opensimrs-300"
              customClass="h-5"
              class="ml-[5px] mt-[2px]"
            />
          </div>
          <div class="flex justify-end">
            <div class="bg-white w-[0.5px] h-[30px] mr-[20px]"></div>
            <p
              class="text-sm font-bold text-white font-poppins mt-[5px] mr-[20px]"
            >
              Tgl. Order : {{ epochToDate(payload.orderDate, "date") }}
            </p>
            <CustomButton
              background-color="bg-white"
              size="small"
              class="w-[30px] h-[30px] rounded-full p-0"
              @click="emit('close')"
            >
              <img src="@/assets/icons/x-bold.svg" alt="" width="" />
            </CustomButton>
          </div>
        </div>
      </div>
      <!-- Body -->
      <div class="p-4 bg-white rounded-b-lg shadow-md">
        <div class="flex flex-row">
          <div class="basis-1/2">
            <p class="font-bold text-MD">{{ pasienResep.nama ?? "-" }}</p>
            <p>{{ payload.noReg }}</p>
            <CustomButton class="w-24 h-5 text-sm">{{
              payload.noRm
            }}</CustomButton>
            <CustomChip
              :showCheckedIcon="false"
              :label="perempuan ? 'Perempuan' : 'Laki-laki'"
              :bgColor="perempuan ? 'bg-female-75' : 'bg-male-75'"
              :textColor="perempuan ? 'text-female-300' : 'text-male-300'"
              customClass="h-5 pr-[6px] border-none mr-[5px] ml-2"
            />
            <!-- <CustomChip
                      :showCheckedIcon="false"
                      label="Perempuan"
                      bgColor="bg-female-75"
                      textColor="text-female-300"
                      customClass="h-5 pr-[6px] border-none mr-[5px]"
                    /> -->
          </div>
          <div class="bg-mediumGrey-300 w-[1px] h-[70px] mr-[20px]"></div>
          <div class="basis-1/4">
            <p class="text-xs font-bold underline underline-offset-2 mt-[15px]">
              Tgl. Lahir
            </p>
            <p class="">{{ tglLahirResep }}</p>
          </div>
          <div class="basis-1/4">
            <p class="text-xs font-bold underline underline-offset-2 mt-[15px]">
              Umur
            </p>
            <p class="">{{ pasienResep.umur ?? "-" }}</p>
          </div>
        </div>

        <!-- Asesmen Medis -->
        <div class="grid grid-cols-1">
          <CustomAccordion no-border initial-state="0">
            <template #header>
              <div class="">Asesmen Medis</div>
            </template>
            <template #content>
              <div class="flex flex-row mt-[20px]">
                <div class="basis-1/2">
                  <div class="grid grid-cols-2">
                    <div>
                      <p class="text-xs font-bold underline underline-offset-2">
                        Keluhan Utama
                      </p>
                      <p>{{ ringkasanKlinis?.keluhanUtama || "-" }}</p>
                    </div>
                    <div>
                      <p class="text-xs font-bold underline underline-offset-2">
                        Alergi
                      </p>
                      <p>{{ ringkasanKlinis?.namaAlergi || (ringkasanKlinis ? "Tidak ada" : "-") }}</p>
                    </div>
                    <div>
                      <p
                        class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                      >
                        Dokter Pengirim
                        <span>
                          <CustomButton
                            class="h-[20px] w-[40px] text-xs ml-[10px]"
                            outlined
                            borderColor="border-grey-300"
                            textColor="text-grey-300"
                            >{{ PELAYANAN_RESEP[payload.jenisPelayanan] ?? "-" }}</CustomButton
                          >
                        </span>
                      </p>
                      <p>{{ payload.dokterOrder ?? "-" }}</p>
                    </div>
                  </div>
                </div>
                <div class="bg-mediumGrey-300 w-[1px] h-[85px] mr-[20px]"></div>
                <div class="basis-1/4">
                  <p class="text-xs font-bold underline underline-offset-2">
                    Diagnosa Primer
                  </p>
                  <p class="">{{ ringkasanKlinis?.diagnosisPrimer?.split("~")[0] || "-" }}</p>
                  <p
                    class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                  >
                    Diagnosa Sekunder
                  </p>
                  <p class="">{{ diagnosisSekunder[0] ?? "-" }}</p>
                </div>
                <div class="basis-1/4">
                  <p class="text-xs font-bold underline underline-offset-2">
                    Diagnosa Sekunder
                  </p>
                  <p class="">{{ diagnosisSekunder[1] ?? "-" }}</p>
                  <p
                    class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                  >
                    Diagnosa Sekunder
                  </p>
                  <p class="">{{ diagnosisSekunder[2] ?? "-" }}</p>
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

        <!-- List Obat -->
        <div class="grid grid-cols-1">
          <CustomAccordion no-border initial-state="0">
            <template #header>List Obat</template>
            <template #content>
              <div v-for="(obat, idx) in fields">
                <div class="mt-[20px] p-4 rounded-t-lg bg-opensimrs-50 shadow-md">
                  <div class="grid grid-cols-2 gap-2">
                    <div class="flex">
                      <CustomButton class="h-7 text-sm">{{
                        idx + 1
                      }}</CustomButton>
                      <p class="my-auto ml-2 text-sm font-bold">
                        {{ obat.value.namaItem }}
                      </p>
                      <PhArrowRight
                        :size="20"
                        class="my-auto ml-2 text-success-300"
                        weight="bold"
                      />
                      <p class="my-auto ml-2 text-sm font-bold">
                        {{ obat.value.totalObat }}
                        {{ obat.value.satuanDosis }}
                      </p>
                    </div>
                    <div class="flex justify-end">
                      <CustomChip
                        v-if="obat.value.isTakeaway"
                        label="OBAT PULANG"
                        borderColor="border-male-300"
                        bgColor="bg-male-50"
                        :showCheckedIcon="false"
                        textColor="text-male-300"
                        customClass="h-5"
                        class="mr-[5px]"
                      />
                      <CustomChip
                        v-if="obat.value.isChronic"
                        label="OBAT KRONIS"
                        borderColor="border-sunFlower-300"
                        bgColor="bg-sunFlower-50"
                        :showCheckedIcon="false"
                        textColor="text-sunFlower-300"
                        customClass="h-5"
                        class="mr-[5px]"
                      />
                      <CustomChip
                        v-if="obat.value.isCompound"
                        label="MENGANDUNG RACIKAN"
                        borderColor="border-grass-300"
                        bgColor="bg-grass-50"
                        :showCheckedIcon="false"
                        textColor="text-grass-300"
                        customClass="h-5"
                        class="mr-[5px]"
                      />
                      <CustomButton
                        v-if="!obat.value.isCompound"
                        v-show="payload.orderStatus === 1"
                        label=""
                        background-color="bg-grass-300 rounded-lg"
                        class="h-6 w-[26px] p-0 ml-[10px] mr-[10px]"
                        @click="
                          openDialog('digerus', 'Tambah Data', obat.value)
                        "
                      >
                        <img
                          src="@/assets/icons/Exclude.svg"
                          alt=""
                          width="15"
                        />
                      </CustomButton>
                      <CustomButton
                        v-show="payload.orderStatus === 1"
                        label=""
                        background-color="bg-[#3D84E5] rounded-lg"
                        class="h-6 w-[26px] p-0"
                        @click="openDialog('edit', 'Edit Data', obat.value)"
                      >
                        <img src="@/assets/icons/edit.svg" alt="" />
                      </CustomButton>
                    </div>
                  </div>
                </div>
                <div class="p-4 bg-white rounded-b-lg shadow-md">
                  <DataTable
                    v-if="!obat.value.isCompound"
                    :value="itemsObat"
                    class="text-xs"
                  >
                    <!-- Rincian Obat -->
                    <!-- Stok Obat -->
                    <Column field="itemsObat">
                      <template #header>
                        <div class="flex justify-between items-center w-full">
                          <div class="font-semibold">Stok Obat</div>
                          <CustomButton
                            v-if="payload.orderStatus !== 1"
                            icon="PhCheck"
                            backgroundColor="bg-success-300"
                            size="small"
                            class="w-[20px] h-[20px] rounded-full"
                          />
                        </div>
                      </template>
                      <template #body="slotProps">
                        <div v-if="payload.orderStatus === 1">
                          <CustomSelect
                            v-if="obat.value.isCompound"
                            v-model="slotProps.data.jenisStokUuid"
                            :show-label="false"
                            place-holder="Pilih Stok"
                            optionValue="detailStok.uuid"
                            optionLabel="detailStok.name"
                            :options="stockObatRacikanPayload"
                            :invalid="(errors as any)[`obat[${idx}].racikan[${slotProps.index}].jenisStokUuid`] ? true : false"
                            :invalidMessage="(errors as any)[`obat[${idx}].racikan[${slotProps.index}].jenisStokUuid`]"
                            @update:model-value="
                              updateObatRacikan(
                                obat.value.isCompound,
                                slotProps.data.uuid,
                                slotProps.data.jenisStokUuid,
                                idx,
                                slotProps.index
                              )
                            "
                          />
                          <CustomSelect
                            v-else
                            v-model="obat.value.jenisStokUuid"
                            :show-label="false"
                            place-holder="Pilih Stok"
                            optionValue="detailStok.uuid"
                            optionLabel="detailStok.name"
                            :options="stockObatNonRacikanPayload"
                            :invalid="(errors as any)[`obat[${idx}].jenisStokUuid`] ? true : false"
                            :invalidMessage="(errors as any)[`obat[${idx}].jenisStokUuid`]"
                            @update:model-value="
                              updateObatNonRacikan(
                                obat.value.isCompound,
                                obat.value.uuid,
                                obat.value.jenisStokUuid,
                                idx,
                                slotProps.index
                              )
                            "
                          />
                        </div>
                        <div v-if="payload.orderStatus !== 1">
                          {{ obat.value.namaItem || "-" }}
                        </div>
                      </template>
                    </Column>
                    <!-- Sisa Stok -->
                    <Column
                      v-if="payload.orderStatus === 1"
                      headerClass="font-semibold"
                      class="text-center"
                      bodyClass="align-top text-center"
                    >
                      <template #header>
                        <div class="w-full text-center">Sisa Stok</div>
                      </template>
                      <template #body="slotProps">
                        {{ obat.value.qtySisa ?? "-" }}
                      </template>
                    </Column>
                    <!-- Aturan & Cara Pakai -->
                    <Column
                      v-if="!obat.value.isCompound"
                      field="caraPakai"
                      header="Aturan & Cara Pakai"
                    >
                      <template #body="slotProps">
                        <div>
                          <p class="text-sm">
                            {{ obat.value.aturanPakai || "-" }} <br />
                            {{ obat.value.caraPakai || "-" }}
                          </p>
                        </div>
                      </template>
                    </Column>
                    <!-- Biaya Satuan -->
                    <Column
                      headerClass="font-semibold"
                      class="w-2/12 text-end"
                      bodyClass="align-top text-end"
                    >
                      <template #header>
                        <div class="w-full text-end">Biaya Satuan</div>
                      </template>
                      <template #body="slotProps">
                        {{ formatRupiah(obat.value.totalHarga) || "-" }}
                      </template>
                    </Column>
                    <!-- Sub. Total -->
                    <Column
                      headerClass="font-semibold"
                      class="w-2/12 text-end"
                      bodyClass="align-top text-end"
                    >
                      <template #header>
                        <div class="w-full text-end">Sub. Total</div>
                      </template>
                      <template #body="slotProps">
                        {{ formatRupiah(obat.value.totalHarga) || "-" }}
                      </template>
                    </Column>
                  </DataTable>

                  <DataTable
                    v-if="obat.value.isCompound"
                    :value="obat.value.racikanItems"
                    class="text-xs"
                  >
                    <!-- Rincian Obat -->
                    <!-- Stok Obat -->
                    <Column field="slotProps.index" headerClass="bg-opensimrs-50">
                      <template #header>
                        <div class="flex justify-between items-center w-full">
                          <div class="font-semibold">No.</div>
                        </div>
                      </template>
                      <template #body="slotProps">
                        {{ slotProps.index + 1 }}
                      </template>
                    </Column>

                    <Column field="slotProps" headerClass="bg-opensimrs-50">
                      <template #header>
                        <div class="flex justify-between items-center w-full">
                          <div class="font-semibold">Obat</div>
                        </div>
                      </template>
                      <template #body="slotProps">
                        {{ slotProps.data.namaItem || "-" }}
                      </template>
                    </Column>

                    <Column field="slotProps" headerClass="bg-opensimrs-50">
                      <template #header>
                        <div class="flex justify-between items-center w-full">
                          <div class="font-semibold">Stok Obat</div>
                          <CustomButton
                            v-if="payload.orderStatus !== 1"
                            icon="PhCheck"
                            backgroundColor="bg-success-300"
                            size="small"
                            class="w-[20px] h-[20px] rounded-full"
                          />
                        </div>
                      </template>
                      <template #body="slotProps">
                        <div v-if="payload.orderStatus === 1">
                          <CustomSelect
                            v-if="obat.value.isCompound"
                            v-model="slotProps.data.jenisStokUuid"
                            :show-label="false"
                            place-holder="Pilih Stok"
                            optionValue="detailStok.uuid"
                            optionLabel="detailStok.name"
                            :options="stockObatRacikanPayload"
                            :invalid="(errors as any)[`obat[${idx}].racikan[${slotProps.index}].jenisStokUuid`] ? true : false"
                            :invalidMessage="(errors as any)[`obat[${idx}].racikan[${slotProps.index}].jenisStokUuid`]"
                            @update:model-value="
                              updateObatRacikan(
                                obat.value.isCompound,
                                slotProps.data.uuid,
                                slotProps.data.jenisStokUuid,
                                idx,
                                slotProps.index
                              )
                            "
                          />
                          <CustomSelect
                            v-else
                            v-model="obat.value.jenisStokUuid"
                            :show-label="false"
                            place-holder="Pilih Stok"
                            optionValue="detailStok.uuid"
                            optionLabel="detailStok.name"
                            :options="stockObatNonRacikanPayload"
                            :invalid="(errors as any)[`obat[${idx}].jenisStokUuid`] ? true : false"
                            :invalidMessage="(errors as any)[`obat[${idx}].jenisStokUuid`]"
                            @update:model-value="
                              updateObatNonRacikan(
                                obat.value.isCompound,
                                obat.value.uuid,
                                obat.value.jenisStokUuid,
                                idx,
                                slotProps.index
                              )
                            "
                          />
                        </div>
                        <div v-if="payload.orderStatus !== 1">
                          {{ slotProps.data.jenisStokName || "-" }}
                        </div>
                      </template>
                    </Column>

                    <!-- Sisa Stok -->
                    <Column
                      v-if="payload.orderStatus === 1"
                      headerClass="font-semibold bg-opensimrs-50"
                      class="text-center"
                      bodyClass="align-top text-center"
                    >
                      <template #header>
                        <div class="w-full text-center">Sisa Stok</div>
                      </template>
                      <template #body="slotProps">
                        {{ obat.value.qtySisa ?? "-" }}
                      </template>
                    </Column>
                    <!-- Aturan & Cara Pakai -->
                    <Column
                      v-if="!obat.value.isCompound"
                      field="caraPakai"
                      header="Aturan & Cara Pakai"
                      headerClass="bg-opensimrs-50"
                    >
                      <template #body="slotProps">
                        <div>
                          <p class="text-sm">
                            {{ obat.value.aturanPakai || "-" }} <br />
                            {{ obat.value.caraPakai || "-" }}
                          </p>
                        </div>
                      </template>
                    </Column>
                    <!-- Biaya Satuan -->
                    <Column
                      headerClass="font-semibold bg-opensimrs-50"
                      class="w-2/12 text-end"
                      bodyClass="align-top text-end"
                    >
                      <template #header>
                        <div class="w-full text-end">Biaya Satuan</div>
                      </template>
                      <template #body="slotProps">
                        {{ formatRupiah(obat.value.totalHarga) || "-" }}
                      </template>
                    </Column>
                    <!-- Sub. Total -->
                    <Column
                      headerClass="font-semibold bg-opensimrs-50"
                      class="w-2/12 text-end"
                      bodyClass="align-top text-end"
                    >
                      <template #header>
                        <div class="w-full text-end">Sub. Total</div>
                      </template>
                      <template #body="slotProps">
                        {{ formatRupiah(obat.value.totalHarga) || "-" }}
                      </template>
                    </Column>
                  </DataTable>

                  <DataTable
                    v-if="obat.value.isCompound"
                    :value="itemsRacikan"
                    class="text-xs"
                  >
                    <Column class="w-4/12" header="Aturan & Cara Pakai">
                      <template #body>
                        {{ obat.value.aturanPakai || "-" }} <br />
                        {{ obat.value.caraPakai || "-" }}
                      </template>
                    </Column>
                    <!-- Biaya Embalase -->
                    <Column
                      headerClass="font-semibold"
                      class="w-3/12 text-end"
                      bodyClass="align-top text-end"
                    >
                      <template #header>
                        <div class="w-full text-end">Biaya Embalase</div>
                      </template>
                      <template #body>
                        {{ formatRupiah(obat.value.biayaEmbalase) || "-" }}
                      </template>
                    </Column>
                    <!-- Biaya Racik -->
                    <Column
                      headerClass="font-semibold"
                      class="w-2/12 text-end"
                      bodyClass="align-top text-end"
                    >
                      <template #header>
                        <div class="w-full text-end">Biaya Racik</div>
                      </template>
                      <template #body>
                        {{ formatRupiah(obat.value.biayaRacik) || "-" }}
                      </template>
                    </Column>
                    <!-- Sub. Total -->
                    <Column
                      headerClass="font-semibold"
                      class="w-2/12 text-end"
                      bodyClass="align-top text-end"
                    >
                      <template #header>
                        <div class="w-full text-end">Sub. Total</div>
                      </template>
                      <template #body="slotProps">
                        {{ formatRupiah(obat.value.totalHarga) || "-" }}
                      </template>
                    </Column>
                  </DataTable>
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

        <!-- Penulis Resep -->
        <div class="grid grid-cols-1">
          <card class="bg-opensimrs-50">
            <template #content>
              <div class="flex flex-row">
                <div class="basis-1/4">
                  <p class="text-xs font-bold underline underline-offset-2">
                    Penulisan Resep
                  </p>
                  <p class="">{{ payload.dokterOrder ?? "-" }}</p>
                </div>
                <div class="basis-1/2">
                  <div class="flex">
                    <div
                      class="bg-opensimrs-300 w-[1px] h-[40px] mr-[20px]"
                    ></div>
                    <p class="font-bold mt-[7px]">Total Tagihan Resep</p>
                  </div>
                </div>
                <div class="basis-1/4">
                  <p class="text-base font-bold text-right mt-[7px]">
                    {{ totalTagihan ? formatRupiah(totalTagihan) : "-" }}
                  </p>
                </div>
              </div>
            </template>
          </card>
        </div>

        <!-- Telaah Resep -->
        <div class="grid grid-cols-1">
          <CustomAccordion no-border initial-state="0">
            <template #header>Telaah Resep</template>
            <template #content>
              <div class="grid grid-cols-3 gap-3">
                <!-- itemTelaah -->
                <div class="mt-[20px]">
                  <DataTable
                    :value="itemTelaah"
                    v-model:selection="selectedTelaah"
                    scrollable
                    scrollHeight="380px"
                    :pt="{ headerRow: 'text-SM' }"
                  >
                    <Column field="farmasetik" headerClass="bg-opensimrs-50">
                      <template #header>
                        <div class="w-full font-bold">Aspek Farmasetik</div>
                      </template>
                      <template #body="slotProps">
                        <div class="flex">
                          <p class="text-xs">
                            {{ slotProps.data.farmasetik }}
                          </p>
                        </div>
                      </template>
                    </Column>
                    <Column
                      v-if="payload.orderStatus !== 1"
                      headerClass="bg-opensimrs-50"
                    >
                      <template #header>
                        <div class="w-full font-bold">Hasil</div>
                      </template>
                      <template #body="slotProps">
                        <CustomButton
                          icon="PhCheck"
                          backgroundColor="bg-success-300"
                          size="small"
                          class="w-[20px] h-[20px] rounded-full"
                        />
                      </template>
                    </Column>
                    <Column
                      v-if="payload.orderStatus === 1"
                      selectionMode="multiple"
                      headerStyle="width: 3rem"
                      headerClass="bg-opensimrs-50"
                      class="custom-checkbox"
                    >
                      <template #header>
                        <div class="w-full font-bold">Hasil</div>
                      </template>
                    </Column>
                  </DataTable>
                </div>

                <!-- itemTelaah2 -->
                <div class="mt-[20px]">
                  <DataTable
                    :value="itemTelaah2"
                    v-model:selection="selectedTelaah2"
                    scrollable
                    scrollHeight="380px"
                    :pt="{ headerRow: 'text-SM' }"
                  >
                    <Column field="farmasetik" headerClass="bg-opensimrs-50">
                      <template #header>
                        <div class="w-full font-bold">Aspek Administratif</div>
                      </template>
                      <template #body="slotProps">
                        <div class="flex">
                          <p class="text-xs">
                            {{ slotProps.data.administratif }}
                          </p>
                        </div>
                      </template>
                    </Column>
                    <Column
                      v-if="payload.orderStatus !== 1"
                      headerClass="bg-opensimrs-50"
                    >
                      <template #header>
                        <div class="w-full font-bold">Hasil</div>
                      </template>
                      <template #body="slotProps">
                        <CustomButton
                          icon="PhCheck"
                          backgroundColor="bg-success-300"
                          size="small"
                          class="w-[20px] h-[20px] rounded-full"
                        />
                      </template>
                    </Column>
                    <Column
                      v-if="payload.orderStatus === 1"
                      selectionMode="multiple"
                      headerStyle="width: 3rem"
                      headerClass="bg-opensimrs-50"
                      class="custom-checkbox"
                    >
                      <template #header>
                        <div class="w-full font-bold">Hasil</div>
                      </template>
                    </Column>
                  </DataTable>
                </div>

                <!-- itemTelaah3 -->
                <div class="mt-[20px]">
                  <DataTable
                    :value="itemTelaah3"
                    v-model:selection="selectedTelaah3"
                    scrollable
                    scrollHeight="430px"
                    :pt="{ headerRow: 'text-SM' }"
                  >
                    <Column field="farmasetik" headerClass="bg-opensimrs-50">
                      <template #header>
                        <div class="w-full font-bold">Aspek Klinik</div>
                      </template>
                      <template #body="slotProps">
                        <div class="flex">
                          <p class="text-xs">
                            {{ slotProps.data.klinik }}
                          </p>
                        </div>
                      </template>
                    </Column>
                    <Column
                      v-if="payload.orderStatus !== 1"
                      headerClass="bg-opensimrs-50"
                    >
                      <template #header>
                        <div class="w-full font-bold">Hasil</div>
                      </template>
                      <template #body="slotProps">
                        <CustomButton
                          icon="PhCheck"
                          backgroundColor="bg-success-300"
                          size="small"
                          class="w-[20px] h-[20px] rounded-full"
                        />
                      </template>
                    </Column>
                    <Column
                      v-if="payload.orderStatus === 1"
                      selectionMode="multiple"
                      headerStyle="width: 3rem"
                      headerClass="bg-opensimrs-50"
                      class="custom-checkbox"
                    >
                      <template #header>
                        <div class="w-full font-bold">Hasil</div>
                      </template>
                    </Column>
                  </DataTable>
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

        <!-- Edukasi Pemberian Obat -->
        <div v-if="payload.orderStatus === 4" class="grid grid-cols-1">
          <CustomAccordion no-border initial-state="0">
            <template #header>Edukasi Pemberian Obat</template>
            <template #content>
              <div class="grid grid-cols-2 gap-6">
                <div class="mt-[20px]">
                  <DataTable
                    :value="itemEdukasi"
                    v-model:selection="selectedEdukasi"
                    scrollable
                    scrollHeight="380px"
                    :pt="{ headerRow: 'text-SM' }"
                  >
                    <Column field="farmasetik" headerClass="bg-opensimrs-50">
                      <template #header>
                        <div class="w-full font-bold">Edukasi</div>
                      </template>
                      <template #body="slotProps">
                        <div class="flex">
                          <p class="text-xs">
                            {{ slotProps.data.edukasi }}
                          </p>
                        </div>
                      </template>
                    </Column>
                    <Column
                      field="hasil"
                      header="Hasil"
                      headerClass="bg-opensimrs-50"
                    ></Column>
                    <Column
                      selectionMode="multiple"
                      headerClass="bg-opensimrs-50"
                      class="custom-checkbox"
                    ></Column>
                  </DataTable>
                </div>

                <div class="mt-[20px]">
                  <div v-if="payload.isTakeaway" class="mt-[20px] mb-[20px]">
                    <p
                      class="text-xs font-bold text-left underline underline-offset-2"
                    >
                      Diberikan Oleh
                    </p>
                    <p>{{ userData?.name }}</p>
                  </div>
                  <CustomTextfield
                    v-if="penerimaDiketik"
                    v-model="penerima"
                    label="Diberikan Ke"
                    placeholder="Diberikan Ke"
                    class="mt-[20px]"
                  />
                  <CustomSelect
                    v-if="!penerimaDiketik"
                    v-model="penerima"
                    label="Diberikan Ke"
                    place-holder="Diberikan Ke"
                    :options="pegawaiPayload"
                    optionValue="name"
                    optionLabel="name"
                  />
                  <CustomTextfield
                    v-model="noHpPenerima"
                    label="No. Handphone Penerima"
                    placeholder="08XX-XXXX-XXXX"
                    class="mt-[20px]"
                  />
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
        <hr
          v-if="payload.orderStatus === 1 || payload.orderStatus === 4"
          class="my-5 border-[1px] border-grey-200"
        />
        <div class="flex justify-between items-end">
          <CustomSelect
            v-if="payload.orderStatus === 1 || payload.orderStatus === 4"
            v-model="selectedPegawai"
            :label="
              payload.orderStatus === 4 ? 'Petugas Edukasi' : 'Petugas Telaah'
            "
            place-holder="Pilih Petugas"
            :options="pegawaiPayload"
            optionValue="name"
            optionLabel="name"
            class="w-1/3"
          />
          <CustomButton
            v-if="payload.orderStatus === 1"
            @click="simpanTelaah(payload.uuid)"
            :disabled="
              !checkTelaah || !selectedPegawai || Object.keys(errors).length > 0
            "
          >
            <div class="flex gap-2 items-center">
              <div class="text-sm">Simpan Telaah</div>
            </div>
          </CustomButton>
        </div>
        <hr class="my-5 border-[1px] border-grey-200" />

        <!-- Diverifikasi Oleh -->
        <div class="grid grid-cols-2">
          <div class="flex gap-2 item-center">
            <!-- Batal Order -->
            <CustomButton
              v-if="payload.orderStatus === 1 || payload.orderStatus === 2"
              background-color="bg-danger-300"
              @click="batalDialog = true"
              class="w-[110px]"
              label="Batal Order"
            >
            </CustomButton>
            <!-- Batal Penyerahan -->
            <CustomButton
              v-if="payload.orderStatus === 4"
              background-color="bg-danger-300"
              @click="batalPenyerahan(payload.uuid)"
              label="Batal Penyerahan"
            >
            </CustomButton>
            <!-- Pindah Lokasi Order -->
            <CustomButton
              v-if="payload.orderStatus === 1 || payload.orderStatus === 2"
              @click="pindahDialog = true"
              label="Pindah Lokasi Order"
              class="w-[170px]"
            >
            </CustomButton>
            <CustomButton @click="cetakDialog = true">
              <div class="flex gap-2 items-center">
                <PhPrinter :size="18" colorc="#ffffff" weight="fill" />
                <div class="text-sm">Cetak</div>
              </div>
            </CustomButton>
          </div>
          <div class="flex justify-end">
            <div class="">
              <p
                class="text-xs font-bold text-right underline underline-offset-2"
              >
                Diverifikasi Oleh
              </p>
              <p>{{ payload.petugasVerifikasi }}</p>
            </div>
            <div class="">
              <div
                class="bg-mediumGrey-300 w-[1px] h-[33px] ml-[20px] mt-1"
              ></div>
            </div>
            <div class="">
              <CustomButton
                :label="
                  payload.orderStatus === 1 || payload.orderStatus === 2
                    ? 'Verifikasi'
                    : payload.orderStatus === 3
                    ? 'Obat Siap Diserahkan'
                    : payload.orderStatus === 4
                    ? 'Serahkan Obat'
                    : ''
                "
                :disabled="payload.orderStatus === 1"
                class="ml-[20px]"
                @click="verifikasiPetugas(payload.uuid)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <FormObat
    v-model:isDialogVisible="isTambahDataDialogVisible"
    :method="dialogConfig.method"
    :title="dialogConfig.title"
    :payload="dialogConfig.data"
    :pasien="pasienResep"
    :ringkasan="ringkasanKlinis"
    @data-updated="fetchDetailPrescription"
  />

  <!-- Batal Notification -->
  <CustomDialog
    v-model:visible="batalDialog"
    width="550px"
    headerBg="bg-danger-300"
    @close-dialog="closeBatalDialog"
  >
    <template #header>Batal Order</template>
    <template #body>
      <div class="grid grid-cols-1">
        <div class="mt-[20px]">
          <p class="font-bold">Alasan Membatalkan Order</p>
        </div>
        <div class="mt-[10px]">
          <CustomTextfield
            v-model="alasanBatal"
            :showLabel="false"
            placeholder="Alasan Membatalkan Order"
          />
        </div>
        <div class="mt-[10px]">
          <p class="text-sm italic text-danger-300">
            *Setelah membatalkan, <span class="font-bold">Dokter</span> harus
            mengorderkan ulang obatnya
          </p>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end">
        <CustomButton
          @click="batalDialog = false"
          label="Batal"
          outlined
          class=""
          borderColor="border-grey-200"
          textColor="text-grey-300"
        />
        <CustomButton
          @click="batalOrder(payload.uuid)"
          label="Iya, Batalkan"
          backgroundColor="bg-danger-300"
          borderColor="border-danger-300"
          textColor="text-white"
          class="ml-[10px]"
        />
      </div>
    </template>
  </CustomDialog>

  <!-- Pindah Lokasi Dialog -->
  <CustomDialog
    v-model:visible="pindahDialog"
    width="550px"
    @close-dialog="closePindahLokasiDialog"
  >
    <template #header>Pindah Lokasi Order</template>
    <template #body>
      <div class="grid grid-cols-[45%,10%,45%]">
        <div class="mt-[20px]">
          <CustomSelect
            v-model="awalLokasi"
            place-holder="Lokasi Awal Order"
            label="Lokasi Awal Order"
            optionLabel="name"
            optionValue="uuid"
            :options="StockLocationPayload"
            disabled
          />
        </div>
        <div class="">
          <ArrowRightBrokenIcon
            :size="20"
            class="text-opensimrs-300 ml-[15px] mt-[55px]"
            weight="bold"
          />
        </div>
        <div class="mt-[20px]">
          <CustomSelect
            v-model="lokasiTujuan"
            place-holder="Pilih Lokasi"
            label="Pindah Lokasi Ke"
            class=""
            optionLabel="name"
            optionValue="uuid"
            :options="StockLocationPayload"
          />
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end">
        <CustomButton
          @click="pindahDialog = false"
          label="Batal"
          outlined
          class=""
          borderColor="border-grey-200"
          textColor="text-grey-300"
        />
        <CustomButton
          @click="pindahLokasi(payload.uuid)"
          label="Pindahkan"
          class="ml-[10px]"
        />
      </div>
    </template>
  </CustomDialog>

  <!-- Cetak Dialog -->
  <CustomDialog v-model:visible="cetakDialog" width="435px">
    <template #header>Cetak</template>
    <template #body>
      <div class="flex gap-3 mt-[20px]">
        <CustomButton @click="cetak('e-tiket')">
          <div class="flex gap-2 items-center">
            <PhPrinter :size="18" colorc="#ffffff" weight="fill" />
            <div class="text-sm">E-Tiket</div>
          </div>
        </CustomButton>
        <CustomButton @click="cetak('e-resep')">
          <div class="flex gap-2 items-center">
            <PhPrinter :size="18" colorc="#ffffff" weight="fill" />
            <div class="text-sm">E-Resep</div>
          </div>
        </CustomButton>
        <CustomButton @click="cetak('salinan')">
          <div class="flex gap-2 items-center">
            <PhPrinter :size="18" colorc="#ffffff" weight="fill" />
            <div class="text-sm">Salinan E-Resep</div>
          </div>
        </CustomButton>
      </div>
    </template>
  </CustomDialog>
</template>
