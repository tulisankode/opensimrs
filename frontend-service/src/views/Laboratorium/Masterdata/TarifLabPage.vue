<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { utilsStore } from "@/stores/utils";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import FormTarifLab from "../Layout/FormTarifLab.vue";
import { useTarifPemeriksaanStore } from "@/stores/datamasterLaboratorium/tarifPemeriksaan";
import * as XLSX from "xlsx-js-style";
import DialogDelete from "../Layout/DialogDelete.vue";
import NoData from "@/components/section/NoData.vue";

const rowsPerPage = ref(10);
const currentPage = ref(0);
const status = ref(true);
const tarifPemeriksaanStore = useTarifPemeriksaanStore();
const tarifPemeriksaanPayload = ref<any[]>([]);
const namaTarif = ref("");
const codeTarif = ref("");
const grandTotal = ref(0);
const pelayanans = ref([
  { label: "Rajal", value: "rawat jalan" },
  { label: "Ranap", value: "rawat inap" },
  { label: "IGD", value: "igd" },
]);
const tarifPemeriksaanProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});
const searchQuery = ref<string>("");
const selectedPelayanan = ref<string[]>([]);
const selectedPenjamin = ref<string[]>([]);

const handleSearchQuery = (searchValue: string) => {
  searchQuery.value = searchValue;
};
const handleSelectedUnit = (selectedValue: any) => {
  selectedPelayanan.value = selectedValue;
};
const handleSelectedPenjamin = (selectedValue: any) => {
  selectedPenjamin.value = selectedValue;
};

// Filter Search Data
const searchData = () => {
  searchQuery.value;
  fetchTarifPemeriksaan();
};

const onSelectedPenjamin = (event: string) => {
  console.log("event", event);
  console.log("selectedPenjamin => ", selectedPenjamin.value);
  if (selectedPenjamin.value.includes(event)) {
    selectedPenjamin.value = selectedPenjamin.value.filter(
      (item: string) => item !== event
    );
  } else {
    selectedPenjamin.value.push(event);
  }
  console.log("selectedPenjamin", selectedPenjamin.value);
};

const onSelectedPelayanan = (event: string) => {
  console.log("event", event);
  console.log("selectedPelayanan => ", selectedPelayanan.value);
  if (selectedPelayanan.value.includes(event)) {
    selectedPelayanan.value = selectedPelayanan.value.filter(
      (item: string) => item !== event
    );
  } else {
    selectedPelayanan.value.push(event);
  }
  console.log("selectedPelayanan", selectedPelayanan.value);
};
// Filter Reset Data
const resetData = () => {
  searchQuery.value = "";
  selectedPelayanan.value = [];
  selectedPenjamin.value = [];
  fetchTarifPemeriksaan();
};

const utils = utilsStore();

// Fetch Tarif
const fetchTarifPemeriksaan = async () => {
  utils.setLoading(true);
  try {
    console.log("Selected Pelayanan", selectedPelayanan.value);
    console.log("Selected Penjamin", selectedPenjamin.value.join(","));

    const response = await tarifPemeriksaanStore.getApi({
      page: tarifPemeriksaanProperties.value.page,
      limit: tarifPemeriksaanProperties.value.page_size,
      name: searchQuery.value,
      penjamins: selectedPenjamin.value.join(","),
      pelayanans: selectedPelayanan.value.join(","),
    });
    console.log("Response", response);

    if (response && response.payload) {
      tarifPemeriksaanProperties.value.total =
        response.payload.pagination.total;
      tarifPemeriksaanPayload.value = response.payload.data;
    } else {
      tarifPemeriksaanPayload.value = [];
    }
    console.log("Data Kategori Pemeriksaan", tarifPemeriksaanPayload.value);
  } catch (error) {
    console.error("Failed to fetch data", error);
    tarifPemeriksaanPayload.value = [];
  } finally {
    utils.setLoading(false);
  }
};

const hasData = computed(() => {
  return tarifPemeriksaanPayload.value.length > 0;
});

// Handle Page
const handlePage = (event: any) => {
  tarifPemeriksaanProperties.value.page = event.page + 1;
  tarifPemeriksaanProperties.value.page_size = event.rows;
  fetchTarifPemeriksaan();
};

const handlePageUpdate = (newPage: number) => {
  currentPage.value = newPage;
};

const dataBedruangan = ref([
  { namaRuangan: "Ruangan 1", jumlahBed: "10", status: "AKTIF" },
  { namaRuangan: "Ruangan 2", jumlahBed: "15", status: "AKTIF" },
  { namaRuangan: "Ruangan 3", jumlahBed: "17", status: "AKTIF" },
  { namaRuangan: "Ruangan 4", jumlahBed: "18", status: "AKTIF" },
  { namaRuangan: "Ruangan 5", jumlahBed: "12", status: "NON-AKTIF" },
  { namaRuangan: "Ruangan 6", jumlahBed: "15", status: "NON-AKTIF" },
]);

const isTambahTindakanDialogVisible = ref(false);
const isDeleteDialogVisible = ref(false);
const dialogConfig = ref<any>({
  method: "",
  title: "",
  data: {},
});

const metaKey = ref(true);
const selectedData = ref();
const onRowSelect = (event: any) => {
  selectedData.value = event.data;
  openDialog("detail", "Detail Data", selectedData.value);
};

const openDialog = (method: string, title: string, data: any = null) => {
  dialogConfig.value = { method, title, data };
  isTambahTindakanDialogVisible.value = true;
  console.log("method", method);
};
const deleteDialog = (method: string, title: string, data: any = null) => {
  dialogConfig.value = { method, title, data };
  isDeleteDialogVisible.value = true;
};
const confirmDelete = async (item: any) => {
  if (item) {
    utils.setLoading(true);
    try {
      await tarifPemeriksaanStore.deleteApi(item.uuid);
      tarifPemeriksaanPayload.value = [];
      await fetchTarifPemeriksaan();
    } catch (error) {
      console.error("Failed to delete data", error);
    } finally {
      utils.setLoading(false);
      isDeleteDialogVisible.value = false;
    }
  }
};

const emit = defineEmits(["deleteItem", "updated"]);

// Import Excel
const onUpload = (event: any) => {
  const uploadedFiles = event.files[0]; // Ambil file yang diunggah
  importExcel(uploadedFiles);
};
const importExcel = async (file: File) => {
  const dataUpload = new FormData();
  dataUpload.append("file", file);
  try {
    const response = await tarifPemeriksaanStore.importApi(dataUpload);
    fetchTarifPemeriksaan();
    console.log("File uploaded successfully:", response);
  } catch (error) {
    console.error("Error uploading file:", error);
  }
};

const exportToExcel = async () => {
  try {
    // Prepare Data for Export
    const data = [];

    // Header Row
    data.push({
      No: "No",
      KodeTarif: "Kode Tarif*",
      NamaTarif: "Nama Tarif*",
      Pelayanan: "Pelayanan*",
      MetodePembayaran: "Metode Pembayaran*",
      KelompokPemeriksaan: "Kelompok Pemeriksaan",
      KomponenTarif: "Komponen Tarif",
      Persentase: "Persentase*",
      HargaPersen: "Harga Tarif (persen)",
      HargaRupiah: "Harga Tarif (rupiah)",
      ItemPemeriksaan: "Item Pemeriksaan",
      KomponenTarifItem: "Komponen Tarif",
      PersentaseItem: "Persentase",
      HargaPersenItem: "Harga Tarif (persen)",
      HargaRupiahItem: "Harga Tarif (rupiah)",
      GrandTotal: "Grand Total",
    });

    // Process each tarif pemeriksaan
    tarifPemeriksaanPayload.value.forEach((tarif, index) => {
      // Process each penjamin (metode pembayaran)
      tarif.tarifLabPenjamin.forEach((penjamin: any, penjaminIndex: number) => {
        // Process each pelayanan
        tarif.pelayanan.forEach((pelayanan: any, pelayananIndex: number) => {
          // Process each item pemeriksaan
          tarif.tarifLabItem.forEach((item: any, itemIndex: number) => {
            // Only add komponen tarif if it exists
            item.komponenTarif.forEach(
              (komponen: any, komponenIndex: number) => {
                data.push({
                  No: index + 1,
                  KodeTarif: tarif.code,
                  NamaTarif: tarif.name,
                  Pelayanan: pelayanan.pelayanan,
                  MetodePembayaran: penjamin.penjamin.name,
                  KelompokPemeriksaan: item.kelompokPemeriksaan?.name || "",
                  KomponenTarif: komponen.name,
                  Persentase: komponen.prosentase ? "TRUE" : "FALSE",
                  HargaPersen: komponen.prosentase ? komponen.prosentase : "",
                  HargaRupiah: !komponen.prosentase
                    ? `Rp. ${komponen.tarif.toLocaleString("id-ID")}`
                    : "",
                  ItemPemeriksaan: item.itemPemeriksaan?.name || "",
                  KomponenTarifItem: komponen.name,
                  PersentaseItem: komponen.prosentase ? "TRUE" : "FALSE",
                  HargaPersenItem: komponen.prosentase
                    ? komponen.prosentase
                    : "",
                  HargaRupiahItem: !komponen.prosentase
                    ? `Rp. ${komponen.tarif.toLocaleString("id-ID")}`
                    : "",
                  GrandTotal: `Rp. ${tarif.grandTotal.toLocaleString("id-ID")}`,
                });
              }
            );
          });
        });
      });
    });

    // Create Workbook and Worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: true });

    // Column Widths
    const columnWidths = [
      { wch: 5 }, // No
      { wch: 15 }, // KodeTarif
      { wch: 30 }, // NamaTarif
      { wch: 15 }, // Pelayanan
      { wch: 20 }, // MetodePembayaran
      { wch: 25 }, // KelompokPemeriksaan
      { wch: 20 }, // KomponenTarif
      { wch: 15 }, // Persentase
      { wch: 20 }, // HargaPersen
      { wch: 20 }, // HargaRupiah
      { wch: 25 }, // ItemPemeriksaan
      { wch: 20 }, // KomponenTarifItem
      { wch: 15 }, // PersentaseItem
      { wch: 20 }, // HargaPersenItem
      { wch: 20 }, // HargaRupiahItem
      { wch: 15 }, // GrandTotal
    ];

    worksheet["!cols"] = columnWidths;

    // Append Worksheet to Workbook and Save
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tarif Pemeriksaan");
    XLSX.writeFile(
      workbook,
      `Data_Tarif_Pemeriksaan_${new Date().toISOString().split("T")[0]}.xlsx`
    );
  } catch (error) {
    console.error("Error while exporting Excel", error);
  }
};

const downloadFormatExcel = async () => {
  try {
    // Prepare Data for Export
    const data = [];

    // Header Row
    data.push({
      No: "No",
      KodeTarif: "Kode Tarif*",
      NamaTarif: "Nama Tarif*",
      Pelayanan: "Pelayanan*",
      MetodePembayaran: "Metode Pembayaran*",
      KelompokPemeriksaan: "Kelompok Pemeriksaan",
      KomponenTarif: "Komponen Tarif",
      Persentase: "Persentase*",
      HargaPersen: "Harga Tarif (persen)",
      HargaRupiah: "Harga Tarif (rupiah)",
      ItemPemeriksaan: "Item Pemeriksaan",
      KomponenTarifItem: "Komponen Tarif",
      PersentaseItem: "Persentase",
      HargaPersenItem: "Harga Tarif (persen)",
      HargaRupiahItem: "Harga Tarif (rupiah)",
      GrandTotal: "Grand Total",
    });

    // Add Empty Rows (4 empty rows to match the example)

    data.push({
      No: "1",
      KodeTarif: "TD-001",
      NamaTarif: "Paket pemeriksaan dokter spesialis",
      Pelayanan: "igd",
      MetodePembayaran: "BPJS",
      KelompokPemeriksaan: "Kelompok Pemeriksaan",
      KomponenTarif: "Jasa dokter",
      Persentase: "False",
      HargaPersen: "",
      HargaRupiah: "Rp. 500.000",
      ItemPemeriksaan: "GDS Stik",
      KomponenTarifItem: "Jasa Klinik",
      PersentaseItem: "TRUE",
      HargaPersenItem: "40",
      HargaRupiahItem: "",
      GrandTotal: "Rp. 1.300.000",
    });
    data.push({
      No: "2",
      KodeTarif: "TD-001",
      NamaTarif: "Paket pemeriksaan dokter spesialis",
      Pelayanan: "rawat inap",
      MetodePembayaran: "BPJS",
      KelompokPemeriksaan: "Kelompok Pemeriksaan",
      KomponenTarif: "Jasa dokter",
      Persentase: "True",
      HargaPersen: "20",
      HargaRupiah: "",
      ItemPemeriksaan: "GDS Stik",
      KomponenTarifItem: "Jasa Klinik",
      PersentaseItem: "TRUE",
      HargaPersenItem: "40",
      HargaRupiahItem: "",
      GrandTotal: "Rp. 1.300.000",
    });
    data.push({
      No: "3",
      KodeTarif: "TD-001",
      NamaTarif: "Paket pemeriksaan dokter spesialis",
      Pelayanan: "rawat jalan",
      MetodePembayaran: "BPJS",
      KelompokPemeriksaan: "Kelompok Pemeriksaan",
      KomponenTarif: "Jasa dokter",
      Persentase: "True",
      HargaPersen: "10",
      HargaRupiah: "",
      ItemPemeriksaan: "GDS Stik",
      KomponenTarifItem: "Jasa Klinik",
      PersentaseItem: "TRUE",
      HargaPersenItem: "40",
      HargaRupiahItem: "",
      GrandTotal: "Rp. 1.300.000",
    });
    data.push({
      No: "4",
      KodeTarif: "TD-001",
      NamaTarif: "Paket pemeriksaan dokter spesialis",
      Pelayanan: "rawat jalan",
      MetodePembayaran: "BPJS",
      KelompokPemeriksaan: "Kelompok Pemeriksaan",
      KomponenTarif: "Jasa dokter",
      Persentase: "False",
      HargaPersen: "",
      HargaRupiah: "Rp. 500.000",
      ItemPemeriksaan: "GDS Stik",
      KomponenTarifItem: "Jasa Klinik",
      PersentaseItem: "TRUE",
      HargaPersenItem: "40",
      HargaRupiahItem: "",
      GrandTotal: "Rp. 1.300.000",
    });
    data.push({
      No: "5",
      KodeTarif: "TD-001",
      NamaTarif: "Paket pemeriksaan dokter spesialis",
      Pelayanan: "igd",
      MetodePembayaran: "Tunai",
      KelompokPemeriksaan: "Kelompok Pemeriksaan",
      KomponenTarif: "Jasa dokter",
      Persentase: "False",
      HargaPersen: "",
      HargaRupiah: "Rp. 500.000",
      ItemPemeriksaan: "GDS Stik",
      KomponenTarifItem: "Jasa Klinik",
      PersentaseItem: "TRUE",
      HargaPersenItem: "40",
      HargaRupiahItem: "",
      GrandTotal: "Rp. 1.300.000",
    });

    // Create Workbook and Worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: true });

    // worksheet["!merges"] = [
    //   { s: { r: 1, c: 0 }, e: { r: 6, c: 0 } },
    //   { s: { r: 1, c: 1 }, e: { r: 6, c: 1 } },
    //   { s: { r: 1, c: 2 }, e: { r: 4, c: 2 } },
    //   { s: { r: 5, c: 2 }, e: { r: 6, c: 2 } },
    //   { s: { r: 1, c: 3 }, e: { r: 6, c: 3 } },
    //   { s: { r: 1, c: 4 }, e: { r: 6, c: 4 } },
    //   { s: { r: 1, c: 5 }, e: { r: 6, c: 5 } },
    //   { s: { r: 1, c: 6 }, e: { r: 2, c: 6 } },
    //   { s: { r: 3, c: 6 }, e: { r: 4, c: 6 } },
    //   { s: { r: 5, c: 6 }, e: { r: 6, c: 6 } },
    //   { s: { r: 1, c: 7 }, e: { r: 3, c: 7 } },
    //   { s: { r: 4, c: 7 }, e: { r: 6, c: 7 } },
    //   { s: { r: 1, c: 9 }, e: { r: 2, c: 9 } },
    //   { s: { r: 3, c: 9 }, e: { r: 4, c: 9 } },
    //   { s: { r: 5, c: 9 }, e: { r: 6, c: 9 } },
    //   { s: { r: 1, c: 12 }, e: { r: 2, c: 12 } },
    //   { s: { r: 3, c: 12 }, e: { r: 4, c: 12 } },
    //   { s: { r: 5, c: 12 }, e: { r: 6, c: 12 } },
    //   { s: { r: 1, c: 13 }, e: { r: 6, c: 13 } },
    // ];

    worksheet["!merges"] = [
      // { s: { r: 1, c: 0 }, e: { r: 0, c: 0 } }, // Merge header row for the title
      { s: { r: 5, c: 0 }, e: { r: 1, c: 0 } }, // "No"
      { s: { r: 5, c: 1 }, e: { r: 1, c: 1 } }, // "Kode Tarif"
      { s: { r: 5, c: 2 }, e: { r: 1, c: 2 } }, // "Nama Tarif"
      { s: { r: 1, c: 3 }, e: { r: 1, c: 3 } }, // "Pelayanan"
      { s: { r: 1, c: 4 }, e: { r: 1, c: 4 } }, // "Metode Pembayaran"
      { s: { r: 1, c: 5 }, e: { r: 1, c: 5 } }, // "Kelompok Pemeriksaan"
      { s: { r: 1, c: 6 }, e: { r: 1, c: 6 } }, // "Komponen Tarif"
      { s: { r: 1, c: 7 }, e: { r: 1, c: 7 } }, // "Persentase"
      { s: { r: 1, c: 8 }, e: { r: 1, c: 8 } }, // "Harga Tarif (persen)"
      { s: { r: 1, c: 9 }, e: { r: 1, c: 9 } }, // "Harga Tarif (rupiah)"
      { s: { r: 1, c: 10 }, e: { r: 1, c: 10 } }, // "Item Pemeriksaan"
      { s: { r: 1, c: 11 }, e: { r: 1, c: 11 } }, // "Komponen Tarif Item"
      { s: { r: 1, c: 12 }, e: { r: 1, c: 12 } }, // "Persentase Item"
      { s: { r: 1, c: 13 }, e: { r: 1, c: 13 } }, // "Grand Total"
    ];

    // Column Widths
    const columnWidths = data.reduce((widths: any, row: any) => {
      Object.keys(row).forEach((key, colIdx) => {
        const cellValue = row[key] ? row[key].toString() : "";
        widths[colIdx] = Math.max(widths[colIdx] || 10, cellValue.length + 2);
      });
      return widths;
    }, []);

    worksheet["!cols"] = columnWidths.map((wch: any) => ({ wch }));

    // Apply Styles to Cells
    const range = XLSX.utils.decode_range("A1:C5");

    // Append Worksheet to Workbook and Save
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tindakan");

    XLSX.writeFile(workbook, `Format Datamaster Tarif Lab.xlsx`);
  } catch (error) {
    console.error("Error while exporting Excel", error);
  }
};

onMounted(() => {
  fetchTarifPemeriksaan();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card
      pt:body:class="h-full pt-0 overflow-auto"
      pt:content:class="h-full overflow-hidden"
      class="h-full overflow-hidden"
    >
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="fetchTarifPemeriksaan" />
          <CustomBreadCrumb :home="{ label: 'Datamaster', home: true }" />
          <PhCaretRight :size="16" weight="bold" class="shrink-0 text-opensimrs-300" aria-hidden="true" />
          <h1 class="toolbar-heading text-opensimrs-300">Tarif Lab</h1>
          <CustomTextfield
            v-model="searchQuery"
            label="Cari Tarif Lab"
            prependIcon="PhMagnifyingGlass"
            placeholder="Cari Tarif Lab"
            @keydown.enter="searchData"
          />
          <ToolbarFilterMenu :count="selectedPelayanan.length">
            <template #label>Pelayanan</template>
            <CustomChip
              label="Rawat Jalan"
              :isSelected="selectedPelayanan.includes('Rawat Jalan')"
              @selected="onSelectedPelayanan"
            />
            <CustomChip
              label="Rawat Inap"
              :isSelected="selectedPelayanan.includes('Rawat Inap')"
              @selected="onSelectedPelayanan"
            />
            <CustomChip
              label="IGD"
              :isSelected="selectedPelayanan.includes('IGD')"
              @selected="onSelectedPelayanan"
            />
          </ToolbarFilterMenu>
          <ToolbarFilterMenu :count="selectedPenjamin.length">
            <template #label>Pembayaran</template>
            <CustomChip
              label="TUNAI"
              :isSelected="selectedPenjamin.includes('TUNAI')"
              @selected="onSelectedPenjamin"
            />
            <CustomChip
              label="ASURANSI"
              :isSelected="selectedPenjamin.includes('ASURANSI')"
              @selected="onSelectedPenjamin"
            />
          </ToolbarFilterMenu>
          <CustomButton
            @click="searchData"
            icon="PhMagnifyingGlass"
            label="Cari"
            borderColor="border-opensimrs-300"
          />
          <CustomButton
            @click="resetData"
            label="Reset"
            outlined
            borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300"
          />
          <CustomButton @click="openDialog('add', 'Tambah')" icon="PhPlus" label="Tarif" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!hasData" />
        <DataTable
          :value="tarifPemeriksaanPayload"
          v-model:selection="selectedData"
          :metaKeySelection="metaKey"
          @rowClick="onRowSelect"
          @update:valueSearch="handleSearchQuery"
          @update:selectedFilter="handleSelectedUnit"
          @update:selectedFilterSecond="handleSelectedPenjamin"
          @reload-data="fetchTarifPemeriksaan()"
          @search="fetchTarifPemeriksaan()"
          tableStyle="min-width: 50rem"
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
              <div class="flex items-center justify-center">
                {{
                  (tarifPemeriksaanProperties.page - 1) *
                    tarifPemeriksaanProperties.page_size +
                  (slotProps.index + 1)
                }}
              </div>
            </template>
          </Column>
          <Column
            field="namaTarif"
            header="Nama Tarif"
            headerClass="bg-opensimrs-50"
            class="w-[25%]"
          >
            <template #body="slotProps">
              <div class="font-semibold text-SM">
                {{ slotProps.data.name }}
              </div>
              <div class="mt-2">
                <CustomChip
                  v-for="(item, i) in slotProps.data.tarifLabPenjamin"
                  :label="item.penjamin.name"
                  :showCheckedIcon="false"
                  :border-color="
                    item.penjamin.name === 'Tunai'
                      ? 'border-none'
                      : 'border-none'
                  "
                  :bg-color="
                    item.penjamin.name === 'Tunai'
                      ? 'bg-opensimrs-300'
                      : 'bg-warning-300'
                  "
                  :customClass="
                    item.penjamin.name === 'Tunai'
                      ? 'text-xs font-semibold cursor-auto h-5 bg-opensimrs-300 text-white pr-2 pl-3 ml-[10px]'
                      : 'cursor-auto h-5 bg-warning-300 text-white pr-2 pl-3 ml-[10px]'
                  "
                />
                <!-- <CustomChip
                  v-for="(item, i) in slotProps.data.tarifLabPenjamin"
                  :label="item.penjamin.name"
                  :showCheckedIcon="false"
                  selectedColor="bg-warning-300 border-warning-300"
                  border-color="border-none"
                  bg-color="bg-warning-300"
                  customClass=" cursor-auto h-5 bg-opensimrs-300 text-white pr-2 pl-3 ml-[10px]"
                /> -->
              </div>
            </template>
          </Column>
          <Column
            field="pemeriksaan"
            header="Pemeriksaan"
            headerClass="bg-opensimrs-50"
          >
            <template #body="slotProps">
              <div class="flex flex-wrap gap-2 text-nowrap">
                <div v-for="items in slotProps.data.tarifLabItem" :key="items">
                  <CustomChip
                    :label="
                      items.itemPemeriksaan?.name ||
                      items.kelompokPemeriksaan?.name
                    "
                    :showCheckedIcon="false"
                    border-color="border-none"
                    bg-color="bg-opensimrs-300"
                    customClass="text-xs font-semibold cursor-auto h-5 bg-opensimrs-300 text-white pr-2 pl-3"
                  />
                </div>
              </div>
            </template>
          </Column>
          <Column
            field="pelayanan"
            header="Pelayanan"
            headerClass="bg-opensimrs-50"
          >
            <template #body="slotProps">
              <div class="flex flex-wrap gap-2 text-nowrap">
                <div v-for="items in slotProps.data.pelayanan" :key="items">
                  <CustomChip
                    :label="items.pelayanan"
                    :showCheckedIcon="false"
                    border-color="border-none"
                    bg-color="bg-opensimrs-300"
                    customClass="text-xs font-semibold cursor-auto h-5 bg-opensimrs-300 text-white pr-2 pl-3"
                  />
                </div>
              </div>
            </template>
          </Column>
          <Column
            field="tarif"
            header="Tarif"
            headerClass="bg-opensimrs-50"
            class=""
          >
            <template #body="slotProps">
              <div class="text-SM">Rp . {{ slotProps.data.grandTotal }}</div>
            </template>
          </Column>

          <Column
            field="status"
            headerClass="bg-opensimrs-50 font-semibold text-SM"
          >
            <template #header>
              <div class="w-full text-center">Status</div>
            </template>
            <template #body="slotProps">
              <div class="flex justify-center items-center min-w-[120px]">
                <CustomChip
                  :label="
                    slotProps.data.status === true ? 'AKTIF' : 'NON-AKTIF'
                  "
                  :textColor="
                    slotProps.data.status === true
                      ? 'text-white'
                      : 'text-[#80868d]'
                  "
                  :bgColor="
                    slotProps.data.status === true
                      ? 'bg-opensimrs-300'
                      : 'bg-white'
                  "
                  :borderColor="
                    slotProps.data.status === true
                      ? 'border-none'
                      : 'border-[#80868d]'
                  "
                  :icon-color="
                    slotProps.data.status === true ? 'white' : '#80868d'
                  "
                  customClass="text-xs font-semibold h-5 flex"
                />
              </div>
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50">
            <template #header="slotProps">
              <div class="w-full font-semibold text-center text-SM">Action</div>
            </template>
            <template #body="slotProps">
              <div class="flex items-center gap-2.5 justify-center">
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
                      `${slotProps.data.name}`,
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
      </template>
      <template #footer>
        <div class="flex justify-between px-5 py-2.5">
          <div class="flex items-center gap-2.5">
            <FileUpload
              mode="basic"
              accept=".xls,.xlsx"
              :maxFileSize="1000000"
              label="Import"
              chooseLabel="Import"
              auto
              class="bg-opensimrs-300 rounded-[10px] h-10 text-white border-opensimrs-300"
              @select="onUpload"
              custom-upload
              name="dems[]"
            >
              <template #chooseicon>
                <img src="@/assets/icons/File Import.svg" alt="" />
              </template>
            </FileUpload>
            <CustomButton label="Eksport" @click="exportToExcel">
              <img src="@/assets/icons/File Import.svg" alt="" />Eksport
            </CustomButton>
            <CustomButton label="Eksport" @click="downloadFormatExcel">
              <img src="@/assets/icons/download.svg" alt="" />Download
            </CustomButton>
          </div>
          <CustomPaginator
            :rows="tarifPemeriksaanProperties.page_size"
            :totalRecords="tarifPemeriksaanProperties.total"
            :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePage"
          />
        </div>
      </template>
    </Card>

    <FormTarifLab
      v-model:isDialogVisible="isTambahTindakanDialogVisible"
      :title="dialogConfig.title"
      :method="dialogConfig.method"
      :payload="dialogConfig.data"
      @data-updated="fetchTarifPemeriksaan"
    />

    <DialogDelete
      v-model:isDialogVisible="isDeleteDialogVisible"
      :title="dialogConfig.title"
      :itemToDelete="dialogConfig.data"
      @delete="confirmDelete"
    />
  </div>
</template>
