<script lang="ts" setup>
import { ref, onMounted, computed } from "vue";
import * as XLSX from "xlsx-js-style";
import { useTarifStore } from "@/stores/datamaster/tarif";
import { usePenjaminStore } from "@/stores/datamaster/penjamin";
import { utilsStore } from "@/stores/utils";
import FooterPaginator from "../Layout/FooterPaginator.vue";
import TablesRuangan from "./TarifRuangan/TablesRuangan.vue";
import TablesTindakan from "./TarifTindakan/TablesTindakan.vue";
import FormTarifTindakan from "./TarifTindakan/FormTarifTindakan.vue";
import FormTarifRuangan from "./TarifRuangan/FormTarifRuangan.vue";
import HeaderFilter from "../Layout/HeaderFilter.vue";
import NoData from "@/components/section/NoData.vue";

const selectedTab = ref("0");
const tarifStore = useTarifStore();
const penjaminStore = usePenjaminStore();
const UseUtilsStore = utilsStore();
const tarifPayload = ref<any[]>([]);
const tindakanPayload = ref<any[]>([]);
const ruanganPayload = ref<any[]>([]);
const penjaminPayload = ref<any[]>([]);

const tarifProperties = ref({
  page: 1,
  page_size: 10,
  jenis: "Tindakan",
  total: 0,
});

const handleSelectedTab = (newTab: string) => {
  selectedTab.value = newTab;
  tarifProperties.value.jenis = newTab === "0" ? "Tindakan" : "Ruangan";
  tarifProperties.value.page = 1;
  resetForm();
  fetchTarifData();
};

// Filter
const searchQuery = ref<string>("");
const selectedUnit = ref();
const selectedPenjamin = ref("");

const handleSearchQuery = (searchValue: string) => {
  searchQuery.value = searchValue;
};
const handleSelectedUnit = (selectedValue: any) => {
  selectedUnit.value = selectedValue;
};
const handleSelectedPenjamin = (selectedValue: any) => {
  selectedPenjamin.value = selectedValue;
};

// Reset filter fields
const handleReset = () => {
  resetForm();
  fetchTarifData();
};

const fetchTarifData = async () => {
  UseUtilsStore.setLoading(true);
  let unitValue = "";
  if (selectedUnit.value !== null) {
    unitValue = selectedUnit.value === 4 ? "" : selectedUnit.value;
  }
  try {
    // Set jenis berdasarkan tab yang aktif
    const jenis = tarifProperties.value.jenis;

    // Fetch data dari API berdasarkan jenis
    const response = await tarifStore.getApi(
      tarifProperties.value.page,
      tarifProperties.value.page_size,
      searchQuery.value,
      jenis,
      unitValue,
      selectedPenjamin.value !== null ? selectedPenjamin.value : ""
    );

    if (response && response.payload) {
      tarifProperties.value.total = response.properties.totalItem;

      // Simpan payload yang relevan berdasarkan jenis
      if (jenis === "Tindakan") {
        tindakanPayload.value = response.payload;
      } else if (jenis === "Ruangan") {
        ruanganPayload.value = response.payload;
      }

      // Simpan payload penuh jika diperlukan
      tarifPayload.value = response.payload;
    } else {
      // Reset payload jika tidak ada respons
      tarifPayload.value = [];
      tindakanPayload.value = [];
      ruanganPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    tarifPayload.value = [];
    tindakanPayload.value = [];
    ruanganPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const optionsPelayanan = ref([
  { label: "IGD", value: 'IGD' },
  { label: "Rawat Jalan", value: 'Rawat Jalan' },
  { label: "Rawat Inap", value: 'Rawat Inap' },
  { label: "Semua", value: '' },
]);

const fetchPenjamin = async () => {
  try {
    const response = await penjaminStore.getAktifApi();
    if (response && response.payload) {
      penjaminPayload.value = response.payload;
    } else {
      penjaminPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch fetch penjamin", error);
    penjaminPayload.value = [];
  }
};

onMounted(() => {
  fetchTarifData();
  fetchPenjamin();
});

// Handle Pagination
const handlePage = (event: any) => {
  tarifProperties.value.page = event.page + 1;
  tarifProperties.value.page_size = event.rows;
  fetchTarifData();
};

const handleDeleteItem = async (item: any) => {
  if (item) {
    UseUtilsStore.setLoading(true);
    try {
      await tarifStore.deleteApi(item.uuid);
      fetchTarifData();
    } catch (error) {
      console.error("Failed to delete data", error);
    } finally {
      UseUtilsStore.setLoading(false);
      isDeleteDialogVisible.value = false;
    }
  }
};

// Check if Tindakan Data Exists
const hasTindakanData = computed(() => {
  return (
    Array.isArray(tindakanPayload.value) && tindakanPayload.value.length > 0
  );
});

// Check if Ruangan Data Exists
const hasRuanganData = computed(() => {
  return Array.isArray(ruanganPayload.value) && ruanganPayload.value.length > 0;
});

const isTambahTindakanDialogVisible = ref(false);
const isTambahRuanganDialogVisible = ref(false);
const isDeleteDialogVisible = ref(false);

const dialogConfig = ref<any>({
  method: "add",
  title: "Tambah Data",
  data: null,
});

const FormTindakanDialog = (
  method: string,
  title: string,
  data: any = null
) => {
  dialogConfig.value = { method, title, data };
  isTambahTindakanDialogVisible.value = true;
};

const FormRUanganDialog = (method: string, title: string, data: any = null) => {
  dialogConfig.value = { method, title, data };
  isTambahRuanganDialogVisible.value = true;
};

const resetFormRef = ref();

const resetForm = () => {
  searchQuery.value = "";
  selectedUnit.value = "";
  selectedPenjamin.value = "";
  tarifProperties.value.page = 1;
  resetFormRef.value.resetForm();
};

// Export Excel
const downloadExportExcel = async () => {
  try {
    const response = await tarifStore.exportApi();
    let rows = response.payload;
    if (!rows || rows.length === 0) {
      console.error("No data available for export");
      return;
    }

    // Prepare Data for Export
    const title = ["DATAMASTER TARIF"];
    const data = [];

    // Header Row (Kosong untuk baris kedua tanpa border)
    data.push({}); 
    data.push({}); 
    data.push({
      No: "No",
      JenisTarif: "Jenis Tarif",
      Kode: "Kode Tarif",
      Nama: "Nama Tarif",
      GrandTotal: "Grand Total",
      Status: "Status",
    });
    
    // Data Rows
    for (let i = 0; i < rows.length; i++) {
      data.push({
        No: i + 1,
        JenisTarif: rows[i].jenisTarif,
        Kode: rows[i].code,
        Nama: rows[i].name,
        GrandTotal: `Rp ${rows[i].grandTotal ?? 0}`,
        Status: rows[i].status ? "AKTIF" : "NON-AKTIF",
      });
    }

    // Create Workbook and Worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: true });

    // Add Title and Merge Cells
    XLSX.utils.sheet_add_aoa(worksheet, [title], { origin: "A1" });
    worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];

    // Style Title
    worksheet["A1"].s = {
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true, sz: 14 },
    };

    // Column Widths
    const columnWidths = data.reduce((widths:any, row:any) => {
      Object.keys(row).forEach((key, colIdx) => {
        const cellValue = row[key] ? row[key].toString() : "";
        widths[colIdx] = Math.max(widths[colIdx] || 10, cellValue.length + 2);
      });
      return widths;
    }, []);

    worksheet["!cols"] = columnWidths.map((wch:any) => ({ wch }));

    // Apply Styles to Cells
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:D1");

    // Start formatting from row 3 (index 2 in array)
    for (let row = 2; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!worksheet[cellAddress]) worksheet[cellAddress] = { v: "" };

        // Apply border only to row 3 and beyond (table rows)
        if (row >= 2) {
          worksheet[cellAddress].s = worksheet[cellAddress].s || {};
          worksheet[cellAddress].s.border = {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
          };
        }

        // Align header cells (row 3)
        if (row === 2 || col === 0) {
          worksheet[cellAddress].s.alignment = {
            horizontal: "center",
            vertical: "center",
          };
        }

        // Fill header with background color (row 3)
        if (row === 2) {
          worksheet[cellAddress].s.fill = {
            fgColor: { rgb: "9fe2db" },
          };
        }
      }
    }

    // Append Worksheet to Workbook and Save
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datamaster Tarif");
    XLSX.writeFile(workbook, `Datamaster Tarif.xlsx`);
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
      JenisTarif: "Jenis Tarif*",
      MetodePembayaran: "Metode Pembayaran*",
      KodeTarif: "Kode Tarif*",
      NamaTarif: "Nama Tarif*",
      ModePilihanTarif: "Mode Pilihan Tarif*",
      Pelayanan: "Pelayanan*",
      NamaTindakan: "Nama Tindakan*",
      KomponenTarif: "Komponen Tarif*",
      HargaRupiah: "Harga Tarif (rupiah)",
      GrandTotal: "Grand Total",
      IsMCU: "is MCU*",
      TarifLab: "List Tarif Lab*",
    });

    // Add Empty Rows (4 empty rows to match the example)

    data.push({
      No: "1",
      JenisTarif: "Tindakan",
      MetodePembayaran: "BPJS",
      KodeTarif: "TD-001",
      NamaTarif: "Paket pemeriksaan dokter spesialis",
      ModePilihanTarif: "Single",
      Pelayanan: "rawat inap",
      NamaTindakan: "Pemeriksaan dokter",
      KomponenTarif: "Jasa dokter",
      HargaRupiah: "Rp. 250.000",
      GrandTotal: "Rp. 1.300.000",
      IsMCU: "False",
      TarifLab: "",
    });
    data.push({
      No: "2",
      JenisTarif: "Tindakan",
      MetodePembayaran: "BPJS",
      KodeTarif: "TD-001",
      NamaTarif: "Paket pemeriksaan dokter spesialis",
      ModePilihanTarif: "Single",
      Pelayanan: "rawat inap",
      NamaTindakan: "Pemeriksaan dokter",
      KomponenTarif: "Jasa dokter",
      HargaRupiah: "Rp. 250.000",
      GrandTotal: "Rp. 1.300.000",
      IsMCU: "False",
      TarifLab: "",
    });
    data.push({
      No: "3",
      JenisTarif: "Tindakan",
      MetodePembayaran: "BPJS",
      KodeTarif: "TD-001",
      NamaTarif: "Paket pemeriksaan dokter spesialis",
      ModePilihanTarif: "Single",
      Pelayanan: "rawat jalan",
      NamaTindakan: "Pemeriksaan dokter",
      KomponenTarif: "Jasa dokter",
      HargaRupiah: "Rp. 800.000",
      GrandTotal: "Rp. 1.300.000",
      IsMCU: "False",
      TarifLab: "",
    });
    data.push({
      No: "4",
      JenisTarif: "Tindakan",
      MetodePembayaran: "BPJS",
      KodeTarif: "TD-001",
      NamaTarif: "Paket pemeriksaan dokter spesialis",
      ModePilihanTarif: "Single",
      Pelayanan: "rawat jalan",
      NamaTindakan: "Periksa Poli Umum",
      KomponenTarif: "Jasa dokter",
      HargaRupiah: "Rp. 500.000",
      GrandTotal: "Rp. 1.300.000",
      IsMCU: "False",
      TarifLab: "",
    });
    data.push({
      No: "5",
      JenisTarif: "Tindakan",
      MetodePembayaran: "Tunai",
      KodeTarif: "TD-001",
      NamaTarif: "Paket pemeriksaan dokter spesialis",
      ModePilihanTarif: "Single",
      Pelayanan: "igd",
      NamaTindakan: "Periksa Poli Umum",
      KomponenTarif: "Jasa dokter",
      HargaRupiah: "Rp. 500.000",
      GrandTotal: "Rp. 1.300.000",
      IsMCU: "False",
      TarifLab: "",
    });
    data.push({
      No: "6",
      JenisTarif: "Tindakan",
      MetodePembayaran: "Tunai",
      KodeTarif: "TD-001",
      NamaTarif: "Paket pemeriksaan dokter spesialis",
      ModePilihanTarif: "Single",
      Pelayanan: "igd",
      NamaTindakan: "Periksa Poli Umum",
      KomponenTarif: "Jasa dokter",
      HargaRupiah: "Rp. 300.000",
      GrandTotal: "Rp. 1.300.000",
      IsMCU: "False",
      TarifLab: "",
    });
    data.push({
      No: "2",
      JenisTarif: "Tindakan",
      MetodePembayaran: "Tunai",
      KodeTarif: "TD-001",
      NamaTarif: "Paket pemeriksaan dokter spesialis",
      ModePilihanTarif: "Single",
      Pelayanan: "icu",
      NamaTindakan: "Periksa Poli Gigi",
      KomponenTarif: "Jasa dokter",
      HargaRupiah: "Rp. 500.000",
      GrandTotal: "Rp. 1.300.000",
      IsMCU: "True",
      TarifLab: "SGOT",
    });

    // Create Workbook and Worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: true });
    
    worksheet["!merges"] = [
      { s: { r: 1, c: 0 }, e: { r: 6, c: 0 } },
      { s: { r: 1, c: 1 }, e: { r: 6, c: 1 } },
      { s: { r: 1, c: 2 }, e: { r: 4, c: 2 } },
      { s: { r: 5, c: 2 }, e: { r: 6, c: 2 } },
      { s: { r: 1, c: 3 }, e: { r: 6, c: 3 } },
      { s: { r: 1, c: 4 }, e: { r: 6, c: 4 } },
      { s: { r: 1, c: 5 }, e: { r: 6, c: 5 } },
      { s: { r: 1, c: 6 }, e: { r: 2, c: 6 } },
      { s: { r: 3, c: 6 }, e: { r: 4, c: 6 } },
      { s: { r: 5, c: 6 }, e: { r: 6, c: 6 } },
      { s: { r: 1, c: 7 }, e: { r: 3, c: 7 } },
      { s: { r: 4, c: 7 }, e: { r: 6, c: 7 } },      
      { s: { r: 1, c: 10 }, e: { r: 3, c: 10 } },
      { s: { r: 4, c: 10 }, e: { r: 6, c: 10 } },
      { s: { r: 1, c: 11 }, e: { r: 6, c: 11 } },
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

    const data2 = [];

    // Header Row
    data2.push({
      No: "No",
      JenisTarif: "Jenis Tarif*",
      MetodePembayaran: "Metode Pembayaran*",
      KodeTarif: "Kode Tarif*",
      NamaTarif: "Nama Tarif*",
      Pelayanan: "Pelayanan*",
      Ruangan: "Ruangan",
      HargaBed: "Harga Bed*",
    });
    
    // Add Empty Rows (4 empty rows to match the example)
    
    data2.push({
      No: "1",
      JenisTarif: "Ruangan",
      MetodePembayaran: "BPJS",
      KodeTarif: "TW-001",
      NamaTarif: "Ruangan Mawar",
      Pelayanan: "Rawat Inap",
      Ruangan: "Mawar",
      HargaBed: "Rp. 10.000",
    });
    data2.push({
      No: "2",
      JenisTarif: "Ruangan",
      MetodePembayaran: "BPJS",
      KodeTarif: "TW-002",
      NamaTarif: "Ruangan Melati",
      Pelayanan: "Rawat Inap",
      Ruangan: "Melati",
      HargaBed: "Rp. 10.000",
    });
    
    const worksheet2 = XLSX.utils.json_to_sheet(data2, { skipHeader: true });

    // Column Widths
    const columnWidths2 = data2.reduce((widths: any, row: any) => {
      Object.keys(row).forEach((key, colIdx) => {
        const cellValue = row[key] ? row[key].toString() : "";
        widths[colIdx] = Math.max(widths[colIdx] || 10, cellValue.length + 2);
      });
      return widths;
    }, []);
    
    worksheet2["!cols"] = columnWidths2.map((wch: any) => ({ wch }));

    // Apply Styles to Cells
    const range = XLSX.utils.decode_range("A1:C5");

    // Append Worksheet to Workbook and Save
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Tindakan"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet2,
      "Ruangan"
    );
    XLSX.writeFile(workbook, `Format Datamaster Tarif.xlsx`);
  } catch (error) {
    console.error("Error while exporting Excel", error);
  }
};

const handleFileUpload = async (file: File) => {
  const dataUpload = new FormData();
  dataUpload.append("file", file);

  try {
    const response = await tarifStore.importApi(dataUpload); // Panggil fungsi importApi dengan formData
    fetchTarifData();
    console.log("File uploaded successfully:", response); // Log respon jika upload berhasil
  } catch (error) {
    console.error("Error uploading file:", error); // Log error jika upload gagal
  }
};
</script>

<template>
  <Card
    pt:body:class="h-full pt-0 overflow-auto"
    pt:content:class="h-full overflow-auto"
    class=""
  >
    <template #header>
      <HeaderFilter
        page-type="tarif"
        @update:valueSearch="handleSearchQuery"
        @update:selectedFilter="handleSelectedUnit"
        @update:selectedFilterSecond="handleSelectedPenjamin"
        @tambah-data="FormTindakanDialog('add', 'Tambah Data Tarif Tindakan')"
        @tarif-ruangan="FormRUanganDialog('add', 'Tambah Data Tarif Ruangan')"
        @selected-tab="handleSelectedTab"
        @reload-data="fetchTarifData()"
        @search="fetchTarifData()"
        @reset="handleReset()"
        :filterSelect="optionsPelayanan"
        :filterSelectSecond="penjaminPayload"
        ref="resetFormRef"
      />
    </template>
    <template #content>
      <div class="h-full">
        <Tabs v-model:value="selectedTab" class="h-full">
          <TabPanels class="h-full">
            <TabPanel value="0" class="h-full">
              <div v-if="hasTindakanData">
                <TablesTindakan
                  :payload="tindakanPayload"
                  @deleteItem="handleDeleteItem"
                  @updated="fetchTarifData()"
                />
              </div>
              <div v-else class="h-full">
                <NoData class="h-full -mx-4" />
              </div>
            </TabPanel>
            <TabPanel value="1" class="h-full">
              <div v-if="hasRuanganData">
                <TablesRuangan
                  :payload="ruanganPayload"
                  @deleteItem="handleDeleteItem"
                  @updated="fetchTarifData()"
                />
              </div>
              <div v-else class="h-full">
                <NoData class="h-full -mx-4" />
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
      <FormTarifTindakan
        v-model:isDialogVisible="isTambahTindakanDialogVisible"
        :title="dialogConfig.title"
        :method="dialogConfig.method"
        :payload="dialogConfig.data"
        @data-updated="fetchTarifData"
      />
      <FormTarifRuangan
        v-model:isDialogVisible="isTambahRuanganDialogVisible"
        :title="dialogConfig.title"
        :method="dialogConfig.method"
        :payload="dialogConfig.data"
        @data-updated="fetchTarifData"
      />
    </template>
    <template #footer>
      <FooterPaginator
        :rows="tarifProperties.page_size"
        :totalRecords="tarifProperties.total"
        @page="handlePage"
        @export="downloadExportExcel"
        @import="handleFileUpload"
        @download="downloadFormatExcel"
      />
    </template>
  </Card>
</template>
