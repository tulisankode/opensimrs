<script lang="ts" setup>
import { ref, onMounted, computed, watch } from "vue";
import { useStokOpnameStore } from "@/stores/inventory/stokOpname";
import { useStockTypeStore } from "@/stores/datamasterFarmasi/StockType";
import { utilsStore } from "@/stores/utils";
import { epochToDate, formatDate, dateToEpoch } from "@/utils/Helpers";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import type { MenuItem } from "primevue/menuitem";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomMultiSelect from "@/components/Base/CustomMultiSelect.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import NoData from "@/components/section/NoData.vue";
import Dialog from "./Dialog.vue";
// import { exportStokOpnameToExcel } from "@/utils/exportExcelInventory";

const props = defineProps({
  pageType: {
    type: String,
    required: true,
  },
  lokasiStokUuid: {
    type: String,
    default: "",
  },
  dataBreadCrumb: {
    type: Array as () => MenuItem[],
    required: true,
  },
  selectedData: {
    type: Object,
    default: () => null,
  },
});

// validasi form
const schema = toTypedSchema(
  yup.object({
    judulStokOpname: yup.string().required("Judul Stok Opname harus diisi"),
    tglCutOff: yup.date().required("Tanggal Cut Off harus diisi"),
    jenisStokUuids: yup
      .array()
      .min(1, "Minimal 1 Jenis Stok harus dipilih")
      .required("Jenis Stok harus diisi"),
    kategoriItem: yup.string().required("Kategori Obat harus diisi"),
    jenisItem: yup
      .array()
      .min(1, "Minimal 1 Jenis Item harus dipilih")
      .required("Jenis Item harus diisi"),
  })
);

const { errors, handleSubmit, defineField, setValues } = useForm({
  validationSchema: schema,
  initialValues: {
    tglCutOff: new Date(), // Set default ke hari ini
    judulStokOpname: "",
    jenisStokUuids: [],
    kategoriItem: "",
    jenisItem: [],
  },
});

// Ganti ref() biasa dengan defineField()
const [tglCutOff] = defineField("tglCutOff");
const [judulStokOpname] = defineField("judulStokOpname");
const [jenisStokUuids] = defineField("jenisStokUuids");
const [kategoriItem] = defineField("kategoriItem");
const [jenisItem] = defineField("jenisItem");

// State Management Kategori Item
const optionKategori = ref([
  { name: "Medis", value: "medis" },
  { name: "Non-Medis", value: "non-medis" },
]);

// State Management Jenis Item
const optionJenis = ref([
  { name: "Obat", value: "obat" },
  { name: "Alkes", value: "alkes" },
]);

// State Management Stock Type
const StockTypeStore = useStockTypeStore();
const StockTypePayload = ref<any[]>([]);
const filterJenisItem = ref<string>("");

// Fetch Stock Type
const fetchStockType = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await StockTypeStore.getApi(1, 9999);

    if (response && response.payload) {
      StockTypePayload.value = response.payload;
    } else {
      StockTypePayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    StockTypePayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// State Management
const searchQuery = ref<string>("");
const StokOpnameStore = useStokOpnameStore();
const UseUtilsStore = utilsStore();
const StokOpnamePayload = ref<any[]>([]);
const StokOpnameProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Dialog Import
const showImportDialog = ref(false);
const selectedImportFile = ref<File | null>(null);
const handleImportPreview = (file: File | null) => {
  selectedImportFile.value = file;
  showImportDialog.value = false;
};
const handleImportReset = () => {
  selectedImportFile.value = null;
};

// Check if Data Exists
const hasData = computed(
  () => StokOpnamePayload.value && StokOpnamePayload.value.length > 0
);

// Computed properties data display
const selectedJenisStokNames = computed(() => {
  if (!jenisStokUuids.value || !StockTypePayload.value.length) {
    return "";
  }
  return jenisStokUuids.value
    .map((uuid) => {
      const found = StockTypePayload.value.find(
        (option) => option.uuid === uuid
      );
      return found ? found.name : uuid; // Tampilkan nama, fallback ke UUID
    })
    .join(", ");
});

const selectedKategoriName = computed(() => {
  if (!kategoriItem.value) return "";
  const found = optionKategori.value.find(
    (option) => option.value === kategoriItem.value
  );
  return found ? found.name : kategoriItem.value; // Tampilkan nama, fallback ke value
});

const selectedJenisItemNames = computed(() => {
  if (!jenisItem.value || !optionJenis.value.length) {
    return "";
  }
  return jenisItem.value
    .map((val) => {
      const found = optionJenis.value.find((option) => option.value === val);
      return found ? found.name : val; // Tampilkan nama, fallback ke value
    })
    .join(", ");
});

// Fetch Purchasing Of Supplier
const fetchRekonsil = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const jenisItemPayload = filterJenisItem.value
      ? filterJenisItem.value
      : (jenisItem.value ?? []).join(","); // Ini adalah array yg di-join
    const response = await StokOpnameStore.getApiRekonsil(
      props.lokasiStokUuid,
      (jenisStokUuids.value ?? []).join(","),
      jenisItemPayload,
      kategoriItem.value,
      type.value,
      StokOpnameProperties.value.page,
      StokOpnameProperties.value.page_size
    );

    if (response && response.payload) {
      const formattedData = response.payload.map((item: any) => {
        const { rawEd, expDate } = parseDateData(item.ed || item.expDate);

        return {
          ...item,
          idStok: item.id,
          code: item.code,
          stokFisik: 0,
          namaItem: item.name,
          kategoriItem: item.kategoriObat,
          stokSistem: item.stok,
          hargaDasar: item.hargaSatuan,
          rawEd: rawEd, // YYYY-MM-DD
          expDate: expDate, // DD-MM-YYYY
        };
      });

      // Masukkan data yang sudah diformat ke dataItems
      dataItems.value = formattedData;

      // Perbaiki total pagination. Berdasarkan JSON, kita hitung manual.
      if (response.properties) {
        StokOpnameProperties.value.total = response.properties.total;
      } else {
        // Fallback jika backend belum update
        StokOpnameProperties.value.total = response.payload.length;
      }
    } else {
      StokOpnamePayload.value = [];
      dataItems.value = [];
      StokOpnameProperties.value.total = 0;
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    StokOpnamePayload.value = [];
    dataItems.value = []; // Kosongkan tabel
    StokOpnameProperties.value.total = 0;
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, (newValue) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetchRekonsil();
  }, 500);
});

// Handle Pagination
const handlePage = (event: any) => {
  StokOpnameProperties.value.page = event.page + 1;
  StokOpnameProperties.value.page_size = event.rows;
  fetchRekonsil();
};

const rekonsilTitle = ref<string | null>(null);
const type = ref("");

const onInvalidSubmit = ({ errors }: any) => {
  console.log("VALIDASI GAGAL:", errors);
};

const rekonsilDariMasterItem = handleSubmit(() => {
  isDataAvailable.value = true;
  rekonsilTitle.value = "Rekonsil Dari Master Item";
  type.value = "master_stok";
  fetchRekonsil();
}, onInvalidSubmit);

const rekonsilDariStokItem = handleSubmit(() => {
  isDataAvailable.value = true;
  rekonsilTitle.value = "Rekonsil Dari Stok Item";
  type.value = "master_item";
  fetchRekonsil();
}, onInvalidSubmit);

const emit = defineEmits(["back", "onSimpanDraft", "onSimpanAkhiriSO"]);

// State untuk data dan status
const isDataAvailable = ref(false);
const dataItems = ref<any[]>([]);
const selectedDataItem = ref<any[]>([]);

const fetchDraftItems = async () => {
  UseUtilsStore.setLoading(true);
  try {
    // ID/UUID dari selectedData
    const uuid = props.selectedData?.uuid;
    // logic filter
    const jenisItemPayload = filterJenisItem.value
      ? filterJenisItem.value
      : (props.selectedData?.jenisItems || []).join(",");

    const response = await StokOpnameStore.getApiDetail(
      uuid,
      searchQuery.value,
      jenisItemPayload,
      StokOpnameProperties.value.page,
      StokOpnameProperties.value.page_size
    );

    if (response && response.payload) {
      const rawData = Array.isArray(response.payload)
        ? response.payload
        : response.payload.data || [];

      const formattedData = rawData.map((item: any) => {
        const { rawEd, expDate } = parseDateData(item.ed);

        return {
          id: item.id,
          uuid: item.uuid,
          code: item.kodeItem,
          idStok: item.idStok,
          namaItem: item.nama,
          kategoriItem: item.kategori,
          jenisItem: item.jenisItem,
          jenisStok: item.jenisStok,
          jenisObat: "",
          stokAwal: item.stokAwal,
          stokMasuk: item.stokMasuk,
          stokKeluar: item.stokKeluar,
          stokSistem: item.stokSistem,
          stokFisik: item.stokFisik,
          hargaDasar: item.hargaDasar,
          hargaAkhir: item.hargaAkhir,

          rawEd: rawEd, // YYYY-MM-DD
          expDate: expDate, // DD-MM-YYYY
        };
      });
      dataItems.value = formattedData;

      // Update Pagination
      if (response.properties) {
        StokOpnameProperties.value.total = response.properties.total;
      } else {
        StokOpnameProperties.value.total = 0;
      }

      StokOpnamePayload.value = response.payload.data;
    } else {
      dataItems.value = [];
      StokOpnameProperties.value.total = 0;
    }
  } catch (error) {
    console.error("Failed to fetch draft details", error);
    dataItems.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// Helper Function
const parseDateData = (dateString: string | null) => {
  if (!dateString) return { rawEd: null, expDate: "-" };

  const str = dateString.substring(0, 10);

  // Skenario 1: Format YYYY-MM-DD (ISO Standard)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const parts = str.split("-");
    return {
      rawEd: str, // Simpan YYYY-MM-DD untuk payload
      expDate: `${parts[2]}-${parts[1]}-${parts[0]}`, // Ubah ke DD-MM-YYYY untuk tampilan
    };
  }

  // Skenario 2: Format DD-MM-YYYY (Format Lokal)
  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
    const parts = str.split("-");
    return {
      rawEd: `${parts[2]}-${parts[1]}-${parts[0]}`, // Ubah ke YYYY-MM-DD untuk payload
      expDate: str, // Simpan DD-MM-YYYY untuk tampilan
    };
  }

  // Skenario 3: Format Lain (Fallback ke Date Object)
  const dateObj = new Date(dateString);
  if (!isNaN(dateObj.getTime())) {
    return {
      rawEd: formatDate(dateObj, true),
      expDate: formatDate(dateObj, false),
    };
  }
  return { rawEd: null, expDate: "-" };
};

// Helper function untuk payload builder
const buildPayload = (statusType: string) => {
  const payload: any = {
    type: statusType, // 'draft' atau 'final'
    tanggal_cut_off: dateToEpoch(tglCutOff.value!),
    judul_stok_opname: judulStokOpname.value,
    jenis_stoks: jenisStokUuids.value,
    kategori_item: kategoriItem.value,
    jenis_items: jenisItem.value,
    lokasi_stok_uuid: props.lokasiStokUuid,
    items: dataItems.value.map((item) => ({
      kode_item: item.code,
      id_stok: item.idStok,
      jenis_stok: item.jenisStok,
      ed: item.rawEd || "",
      stok_fisik: item.stokFisik,
      stok_sistem: item.stokSistem,
    })),
  };

  // Jika Mode Edit Draft, tambahkan stok_opname_uuid
  if (isEditMode.value && props.selectedData?.uuid) {
    payload.stok_opname_uuid = props.selectedData.uuid;
  }

  return payload;
};

const onSubmitDraft = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const payload = buildPayload("draft");
    console.log("Submitting Draft Payload:", JSON.stringify(payload, null, 2));
    await StokOpnameStore.postApi(payload);

    emit("back");
  } catch (error) {
    console.error("Failed to submit draft:", error);
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const onSubmitAkhiriSO = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const payload = buildPayload("final");
    console.log("Submitting Final Payload:", JSON.stringify(payload, null, 2));

    await StokOpnameStore.postApi(payload);
    emit("back");
  } catch (error) {
    console.error("Failed to submit final:", error);
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const isDialogVisible = ref(false);
const isEditMode = computed(
  () => props.selectedData && props.selectedData.status === "draft"
);

// handle export excel
const handleExportExcel = async () => {
  const faskesProfileString = localStorage.getItem("faskes_profile");
  if (!faskesProfileString) {
    alert("Gagal memuat profil klinik untuk header.");
    return;
  }
  let clinicProfile: any;
  try {
    clinicProfile = JSON.parse(faskesProfileString);
  } catch (e) {
    console.error("Gagal parse data profil:", e);
    return;
  }

  UseUtilsStore.setLoading(true);
  try {
    const limitExport = StokOpnameProperties.value.total || 9999;
    const jenisItemPayload = filterJenisItem.value
      ? filterJenisItem.value
      : isEditMode.value
      ? (
          props.selectedData?.jenis_items ||
          props.selectedData?.jenisItems ||
          []
        ).join(",")
      : (jenisItem.value ?? []).join(",");
    let rowsToExport = [];
    let response: any;

    // Data Header
    const exportHeaderData = {
      judulStokOpname: judulStokOpname.value || "Stok Opname",
      tglCutOff: tglCutOff.value ? formatDate(tglCutOff.value) : "-",
      lokasiStokName: "", // Nanti diisi kalau ada
    };

    if (isEditMode.value) {
      response = await StokOpnameStore.getApiDetail(
        props.selectedData?.uuid,
        searchQuery.value,
        jenisItemPayload,
        1,
        limitExport
      );

      // Handle format response JSON baru (array langsung di payload)
      const rawData =
        response && response.payload
          ? Array.isArray(response.payload)
            ? response.payload
            : response.payload.data || []
          : [];

      if (rawData.length > 0) {
        rowsToExport = rawData.map((item: any) => ({
          ...exportHeaderData,
          code: item.kodeItem,
          namaItem: item.nama,
          kategoriItem: item.kategori,
          jenisItem: item.jenisItem,
          jenisStok: item.jenisStok,
          satuan: item.satuan,
          stokAwal: item.stokAwal,
          stokMasuk: item.stokMasuk,
          stokKeluar: item.stokKeluar,
          stokSistem: item.stokSistem,
          stokFisik: item.stokFisik,
          expDate: item.ed ? formatDate(new Date(item.ed)) : "-",
          hargaDasar: item.hargaDasar,
          hargaAkhir: item.hargaAkhir,
          idStok: item.idStok,
        }));
      }
    } else {
      response = await StokOpnameStore.getApiRekonsil(
        props.lokasiStokUuid,
        (jenisStokUuids.value ?? []).join(","),
        jenisItemPayload,
        kategoriItem.value,
        type.value,
        1,
        limitExport
      );
      if (response && response.payload) {
        rowsToExport = response.payload.map((item: any) => ({
          ...exportHeaderData,
          code: item.code,
          namaItem: item.name,
          kategoriItem: item.kategoriObat,
          jenisItem: item.jenisItem,
          jenisStok: item.jenisStok,
          satuan: item.satuan,
          stokAwal: 0,
          stokMasuk: item.stokMasuk,
          stokKeluar: item.stokKeluar,
          stokSistem: item.stok,
          stokFisik: 0,
          expDate: item.expDate
            ? formatDate(new Date(item.expDate))
            : item.ed
            ? formatDate(new Date(item.expDate))
            : "-",
          hargaDasar: item.hargaSatuan,
          hargaAkhir: 0,
          idStok: item.id,
        }));
      }
    }

    if (rowsToExport.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }
    const fileName = `Lembar_Kerja_SO_${new Date().toISOString().slice(0, 10)}`;
    await exportStokOpnameToExcel(rowsToExport, clinicProfile, fileName);
  } catch (error) {
    console.error("Gagal export:", error);
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const dialogConfig = ref({
  title: "",
  buttonFooterLeft: "",
  buttonFooterRight: "",
  message: "",
});

// Fungsi untuk tombol cari
const handleSearchClick = () => {
  StokOpnameProperties.value.page = 1;
  if (isEditMode.value) {
    fetchDraftItems();
  } else {
    fetchRekonsil();
  }
};

// Fungsi untuk Tombol RESET
const handleResetClick = () => {
  filterJenisItem.value = "";
  StokOpnameProperties.value.page = 1;
  if (isEditMode.value) {
    fetchDraftItems();
  } else {
    fetchRekonsil();
  }
};

// handle delte item row
const handleDeleteItems = () => {
  // Opsional: Tambahkan konfirmasi biar user gak salah pencet
  const confirmed = confirm(
    `Apakah Anda yakin ingin menghapus ${selectedDataItem.value.length} item yang dipilih?`
  );

  if (confirmed) {
    // Ambil semua item di dataItems YANG TIDAK ADA di selectedDataItem
    dataItems.value = dataItems.value.filter(
      (item) => !selectedDataItem.value.includes(item)
    );

    // Kosongkan pilihan setelah dihapus
    selectedDataItem.value = [];
  }
};

onMounted(() => {
  fetchStockType(); // Fetch master data untuk dropdown
  // Cek apakah ini mode EDIT DRAFT
  if (props.selectedData && props.selectedData.status === "draft") {
    //  Isi Form Header dari data draft
    setValues({
      judulStokOpname: props.selectedData.judulStokOpname,
      tglCutOff: new Date(props.selectedData.tanggalCutOff * 1000),
      jenisStokUuids: props.selectedData.jenisStoks,
      kategoriItem: props.selectedData.kategoriItem,
      jenisItem: props.selectedData.jenisItems,
    });

    isDataAvailable.value = true;
    fetchDraftItems();
  }
});
</script>

<template>
  <Card
    pt:body:class="overflow-auto pt-0 pb-0 h-full"
    pt:content:class="overflow-hidden h-full"
    class="overflow-hidden overflow-y-auto h-full"
    >>
    <template #header>
      <CustomAccordion :openWithHeader="false" noBorder initialState="0">
        <template #header>
          <div class="flex justify-between items-center w-full align-middle">
            <div class="flex items-center">
              <CustomButton icon="PhArrowClockwise" class="mr-5" />
              <CustomBreadCrumb
                :home="{
                  label: 'Stok Opname',
                  home: true,
                }"
                :model="props.dataBreadCrumb"
              />

              <div v-if="isDataAvailable" class="flex">
                <hr class="mx-2.5 h-6 border-2 border-opensimrs-300" />
                <div class="font-semibold text-opensimrs-300 text-MD">
                  Tgl. Cut off : {{ tglCutOff ? formatDate(tglCutOff) : "-" }}
                </div>
              </div>
              <div v-if="isEditMode" class="mt-1 ml-2">
                <CustomChip
                  label="DRAFT"
                  :showCheckedIcon="false"
                  borderColor="border-warning-75"
                  bgColor="bg-warning-75"
                  textColor="text-warning-300"
                />
              </div>
            </div>
            <CustomButton
              @click="emit('back')"
              icon="PhCaretLeft"
              label="Kembali"
              class="mr-[10px]"
              outlined
              borderColor="border-opensimrs-300"
              textColor="text-opensimrs-300"
            />
          </div>
        </template>
        <template #content>
          <div v-if="!isDataAvailable">
            <div class="grid grid-cols-4 gap-4 mt-[10px]">
              <CustomTextfield
                label="Judul Stok Opname"
                placeholder="Masukkan judul Stok Opname"
                v-model="judulStokOpname"
                :invalid="!!errors.judulStokOpname"
                :invalidMessage="errors.judulStokOpname"
              />
              <CustomMultiSelect
                label="Jenis Stok"
                placeHolder="Pilih Jenis Stok"
                v-model="jenisStokUuids"
                :options="StockTypePayload"
                optionLabel="name"
                optionValue="uuid"
                :invalid="!!errors.jenisStokUuids"
                :invalidMessage="errors.jenisStokUuids"
              />
              <CustomSelect
                label="Kategori Item"
                placeHolder="Pilih Kategori Item"
                v-model="kategoriItem"
                :options="optionKategori"
                optionLabel="name"
                optionValue="value"
                class="grow"
                :invalid="!!errors.kategoriItem"
                :invalidMessage="errors.kategoriItem"
              />
              <CustomMultiSelect
                label="Jenis Item"
                placeHolder="Pilih Jenis Item"
                v-model="jenisItem"
                :options="optionJenis"
                optionLabel="name"
                optionValue="value"
                :invalid="!!errors.jenisItem"
                :invalidMessage="errors.jenisItem"
              />
            </div>
          </div>

          <div v-else class="grid grid-cols-4 gap-4 mt-[10px] px-2 py-1">
            <div>
              <label
                class="block mb-1 text-sm font-semibold text-black underline"
                >Judul Stok Opname</label
              >
              <p class="font-normal text-normal">{{ judulStokOpname }}</p>
            </div>
            <div>
              <label
                class="block mb-1 text-sm font-semibold text-black underline"
                >Jenis Stok</label
              >
              <p class="font-normal text-normal">
                {{ selectedJenisStokNames }}
              </p>
            </div>
            <div>
              <label
                class="block mb-1 text-sm font-semibold text-black underline"
                >Kategori Item</label
              >
              <p class="font-normal text-normal">{{ selectedKategoriName }}</p>
            </div>
            <div>
              <label
                class="block mb-1 text-sm font-semibold text-black underline"
                >Jenis Item</label
              >
              <p class="font-normal text-normal">
                {{ selectedJenisItemNames }}
              </p>
            </div>
          </div>
          <hr class="border-grey-200 mt-[15px]" />
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
    <template #content>
      <div class="flex flex-col h-full">
        <div class="flex justify-between items-center pb-2.5">
          <div class="flex gap-2.5">
            <div class="font-semibold text-MD text-opensimrs-300">
              Daftar Item Stok Opname
            </div>
            <div
              v-if="rekonsilTitle"
              class="font-semibold text-grey-300 text-MD"
            >
              ({{ rekonsilTitle }})
            </div>
          </div>
          <div v-if="!isDataAvailable" class="flex gap-4 items-end">
            <div class="flex gap-2 items-end">
              <label class="mb-2.5 text-sm font-semibold">Tgl. Cut Off</label>
              <CustomDatePicker
                label=""
                v-model="tglCutOff"
                :invalid="!!errors.tglCutOff"
                :invalidMessage="errors.tglCutOff"
              />
            </div>

            <hr class="h-10 border-l-[1.5px] border-grey-200" />
            <CustomButton
              label="Rekonsil Dari Master Item"
              class="mr-[10px]"
              @click="rekonsilDariMasterItem"
            />
            <CustomButton
              label="Rekonsil Dari Stok Item"
              @click="rekonsilDariStokItem"
            />
          </div>
          <div v-else>
            <CustomButton
              icon="PhDownloadSimple"
              label="Kartu Stok"
              class="mr-[10px]"
              @click="handleExportExcel"
            />
            <CustomButton
              icon="PhUploadSimple"
              label="Import Excel"
              class="mr-[10px]"
              @click="showImportDialog = true"
            />
            <CustomButton
              v-if="selectedDataItem.length > 0"
              icon="PhTrash"
              label="Hapus Item"
              class="bg-danger-300"
              @click="handleDeleteItems"
            />
          </div>
        </div>
        <hr class="border-grey-200" />
        <div
          v-if="isDataAvailable"
          class="flex flex-col flex-grow gap-5 min-h-0"
        >
          <div class="flex items-end gap-4 mt-[10px]">
            <CustomTextfield
              label="Cari Nama Item / Kode Item"
              class="grow"
              placeholder="Masukkan judul Stok Opname"
            />
            <CustomSelect
              label="Jenis Item"
              placeHolder="Pilih Jenis Item"
              v-model="filterJenisItem"
              :options="optionJenis"
              optionValue="value"
              optionLabel="name"
              :isLoading="false"
              class="w-[200px]"
            />
            <div class="flex gap-2.5">
              <CustomButton
                icon="PhMagnifyingGlass"
                label="Cari"
                @click="handleSearchClick"
              />
              <CustomButton
                label="Reset"
                outlined
                borderColor="border-opensimrs-300"
                textColor="text-opensimrs-300"
                @click="handleResetClick"
              />
            </div>
          </div>
          <div class="relative flex-grow min-h-0">
            <DataTable
              :rowClass="
                (data) => ({ 'bg-danger-50': selectedDataItem.includes(data) })
              "
              dataKey="id"
              selectionMode="multiple"
              v-model:selection="selectedDataItem"
              :value="dataItems"
              tableStyle="min-width: 50rem"
              scrollable
              scrollHeight="flex"
              :pt="{ headerRow: 'text-SM' }"
            >
              <Column headerClass="bg-opensimrs-50" class="w-[40px]">
                <template #header>
                  <div class="font-semibold">No</div>
                </template>
                <template #body="slotProps">
                  <div>
                    <div class="text-SM">{{ slotProps.index + 1 }}</div>
                  </div>
                </template>
              </Column>
              <Column field="noPembelian" headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="font-semibold">Nama Item</div>
                </template>
                <template #body="slotProps">
                  <div>
                    <div class="text-SM">{{ slotProps.data.namaItem }}</div>
                    <CustomChip
                      :showCheckedIcon="false"
                      :label="slotProps.data.kategoriItem.toUpperCase()"
                      bgColor="bg-opensimrs-300"
                      textColor="text-white"
                      customClass="h-5 pr-[6px] border-none mr-[5px]"
                    />
                    <CustomChip
                      :showCheckedIcon="false"
                      :label="slotProps.data.jenisItem.toUpperCase()"
                      bgColor="bg-opensimrs-300"
                      textColor="text-white"
                      customClass="h-5 pr-[6px] border-none mr-[5px]"
                    />
                    <CustomChip
                      :showCheckedIcon="false"
                      :label="slotProps.data.jenisStok.toUpperCase()"
                      bgColor="bg-opensimrs-300"
                      textColor="text-white"
                      customClass="h-5 pr-[6px] border-none mr-[5px]"
                    />
                    <CustomChip
                      v-if="slotProps.data.jenisObat"
                      :showCheckedIcon="false"
                      :label="slotProps.data.jenisObat.toUpperCase()"
                      bgColor="bg-opensimrs-300"
                      textColor="text-white"
                      customClass="h-5 pr-[6px] border-none mr-[5px]"
                    />
                  </div>
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="w-full font-semibold">Stok Awal</div>
                </template>
                <template #body="slotProps">
                  <div class="font-normal text-SM">
                    {{ slotProps.data.stokAwal || 0 }}
                  </div>
                  <div class="font-normal text-[8px] text-opensimrs-300">
                    Tablet
                  </div>
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="w-full font-semibold">Stok Masuk</div>
                </template>
                <template #body="slotProps">
                  <div class="font-normal text-SM">
                    {{ slotProps.data.stokMasuk || 0 }}
                  </div>
                  <div class="font-normal text-[8px] text-opensimrs-300">
                    Tablet
                  </div>
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="w-full font-semibold">Stok Keluar</div>
                </template>
                <template #body="slotProps">
                  <div class="font-normal text-SM">
                    {{ slotProps.data.stokKeluar || 0 }}
                  </div>
                  <div class="font-normal text-[8px] text-opensimrs-300">
                    Tablet
                  </div>
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="w-full font-semibold">Stok Sistem</div>
                </template>
                <template #body="slotProps">
                  <div class="font-normal text-SM">
                    {{ slotProps.data.stokSistem || 0 }}
                  </div>
                  <div class="font-normal text-[8px] text-opensimrs-300">
                    Tablet
                  </div>
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50" class="w-[180px]">
                <template #header>
                  <div class="w-full font-semibold text-center">Stok Fisik</div>
                </template>
                <template #body="slotProps">
                  <CustomInputNumber
                    label=""
                    v-model:modelValue="slotProps.data.stokFisik"
                  >
                    <template #appendText>
                      <div
                        class="flex justify-center items-center px-2 text-XS"
                      >
                        Tablet
                      </div>
                    </template>
                  </CustomInputNumber>
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="w-full font-semibold">Selisih</div>
                </template>
                <template #body="slotProps">
                  <div class="flex gap-1 ustify-between i">
                    <div class="flex flex-col">
                      <div class="text-SM">
                        {{
                          Math.abs(
                            slotProps.data.stokFisik - slotProps.data.stokSistem
                          )
                        }}
                      </div>
                      <div class="font-normal text-[8px] text-opensimrs-300">
                        Tablet
                      </div>
                    </div>
                    <PhArrowCircleDown
                      v-if="
                        slotProps.data.stokFisik - slotProps.data.stokSistem < 0
                      "
                      :size="18"
                      color="#E9594C"
                      weight="fill"
                    />
                    <PhArrowCircleUp
                      v-else
                      :size="18"
                      color="#E89F29"
                      weight="fill"
                    />
                  </div>
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="w-full font-semibold">Exp. Date</div>
                </template>
                <template #body="slotProps">
                  <div class="font-normal text-SM">
                    {{ slotProps.data.expDate }}
                  </div>
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="w-full font-semibold">Harga Dasar</div>
                </template>
                <template #body="slotProps">
                  <div class="font-normal text-SM">
                    Rp {{ slotProps.data.hargaDasar || "-" }}
                  </div>
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="w-full font-semibold">Harga Akhir</div>
                </template>
                <template #body="slotProps">
                  <div class="font-normal text-SM">
                    Rp {{ slotProps.data.hargaAkhir || "-" }}
                  </div>
                </template>
              </Column>
              <Column
                header="Action"
                body-class="text-center"
                selectionMode="multiple"
                headerStyle="width: 3rem"
                headerClass="bg-opensimrs-50"
                class="custom-checkbox"
              >
              </Column>
            </DataTable>
          </div>
        </div>
      </div>
      <Dialog
        v-model:visible="showImportDialog"
        @save-preview="handleImportPreview"
        @reset="handleImportReset"
      />
    </template>
    <template #footer>
      <div
        v-if="isDataAvailable"
        class="flex justify-end pt-2 border-t border-grey-200"
      >
        <CustomPaginator
          :rows="StokOpnameProperties.page_size"
          :totalRecords="StokOpnameProperties.total"
          :rowsPerPageOptions="[10, 20, 30]"
          @page="handlePage"
        />
      </div>

      <div class="flex justify-between mt-4 mb-[10px]">
        <div
          :class="`grid gap-7 ${
            isDataAvailable ? 'grid-cols-3' : 'grid-cols-2'
          }`"
        >
          <div>
            <div class="font-semibold underline text-SM">Total Item SO</div>
            <div class="font-normal text-normal">0 item</div>
          </div>
          <div>
            <div class="font-semibold underline text-SM">Tgl. Selesai SO</div>
            <div class="font-normal text-normal">01-01-2024</div>
          </div>
          <div v-if="isDataAvailable">
            <div class="font-semibold underline text-SM">Petugas SO</div>
            <div class="font-normal text-normal">Nama Petugas</div>
          </div>
        </div>
        <div>
          <CustomButton
            label="Simpan (Draft)"
            class="my-auto mr-2 bg-warning-300"
            :disabled="!isDataAvailable"
            @click="onSubmitDraft"
          />
          <CustomButton
            label="Simpan & Akhiri SO"
            class="my-auto bg-opensimrs-300"
            :disabled="!isDataAvailable"
            @click="onSubmitAkhiriSO"
          />
        </div>
      </div>
    </template>
  </Card>
</template>

<style>
.custom-checkbox .p-checkbox-checked .p-checkbox-box {
  @apply border-danger-300 bg-danger-300;
  /* Kelas Tailwind untuk border dan warna latar */
}

.custom-checkbox .p-checkbox-checked .p-checkbox-box .p-checkbox-icon {
  @apply text-white;
  /* Kelas Tailwind untuk warna tanda centang */
}
</style>
