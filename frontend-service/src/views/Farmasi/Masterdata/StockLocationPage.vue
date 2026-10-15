<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useStockLocationStore } from "@/stores/datamasterFarmasi/StockLocation";
import * as XLSX from "xlsx-js-style";
import { utilsStore } from "@/stores/utils";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import AddStockLocation from "../Masterdata/DialogStockLocation/AddStockLocation.vue";
import DeleteStockLocation from "../Masterdata/DialogStockLocation/DeleteStockLocation.vue";

const filterLokasi = ref([
  { name: "GUDANG", values: "gudang" },
  { name: "DEPO PELAYANAN", values: "depo" },
]);

const selectedFilteronStokLocationSelect = ref<string[]>([]);
const onStokLocationSelect = (values: string) => {
  if (selectedFilteronStokLocationSelect.value.includes(values)) {
    selectedFilteronStokLocationSelect.value =
      selectedFilteronStokLocationSelect.value.filter((item) => item != values);
  } else {
    selectedFilteronStokLocationSelect.value.push(values);
  }
  searchData();
};

const timer = ref<any>();
const searchData = () => {
  if (timer.value) {
    clearTimeout(timer.value);
    timer.value = null;
  }
  timer.value = setTimeout(async () => {
    await fetchStockLocation();
  }, 800);
};

// State Management
const searchQuery = ref<string>("");
const StockLocationStore = useStockLocationStore();
const UseUtilsStore = utilsStore();
const StockLocationPayload = ref<any[]>([]);
const StockLocationProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Check if Data Exists
const hasData = computed(
  () => StockLocationPayload.value && StockLocationPayload.value.length > 0
);

// Fetch Stock Location
const fetchStockLocation = async () => {
  UseUtilsStore.setLoading(true);
  let filter = "";
  if (
    selectedFilteronStokLocationSelect.value.length === 2 &&
    selectedFilteronStokLocationSelect.value.includes("gudang") &&
    selectedFilteronStokLocationSelect.value.includes("depo")
  ) {
    filter = "";
  } else if (selectedFilteronStokLocationSelect.value.length === 1) {
    filter = selectedFilteronStokLocationSelect.value[0];
  }
  // console.log(filter, 'filter');
  try {
    const response = await StockLocationStore.getApi(
      StockLocationProperties.value.page,
      StockLocationProperties.value.page_size,
      searchQuery.value,
      filter
    );

    if (response && response.payload) {
      StockLocationProperties.value.total = response.properties.total;
      StockLocationPayload.value = response.payload;
    } else {
      StockLocationPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    StockLocationPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const paginatorKey = ref(0);

const resetSearch = () => {
  searchQuery.value = "";
  selectedFilteronStokLocationSelect.value = [];
  StockLocationProperties.value.page = 1;
  paginatorKey.value++;
  fetchStockLocation();
};

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
// watch(searchQuery, (newValue) => {
//   if (searchTimeout) clearTimeout(searchTimeout);
//   searchTimeout = setTimeout(() => {
//     fetchStockLocation();
//   }, 500);
// });

// Handle Pagination
const handlePage = (event: any) => {
  StockLocationProperties.value.page = event.page + 1;
  StockLocationProperties.value.page_size = event.rows;
  fetchStockLocation();
};

// Dialog Management
const StockLocationDialog = ref(false);
const DeleteStockLocationDialog = ref(false);

const dialogConfig = ref<any>({
  method: "add",
  title: "Tambah",
  data: null,
});

const openDialog = (method: string, title: string, data: any = null) => {
  dialogConfig.value = { method, title, data };
  StockLocationDialog.value = true;
};

const deleteDialog = (method: string, title: string, data: any = null) => {
  dialogConfig.value = { method, title, data };
  DeleteStockLocationDialog.value = true;
};

const confirmDelete = async (item: any) => {
  if (item) {
    UseUtilsStore.setLoading(true);
    try {
      await StockLocationStore.deleteApi(item.uuid);
      fetchStockLocation();
    } catch (error) {
      console.error("Failed to delete data", error);
    } finally {
      UseUtilsStore.setLoading(false);
      DeleteStockLocationDialog.value = false;
    }
  }
};

const onUpload = (event: any) => {
  const uploadedFiles = event.files[0]; // Ambil file yang diunggah
  importExcel(uploadedFiles);
};

// Import Excel
const importExcel = async (file: File) => {
  const dataUpload = new FormData();
  dataUpload.append("files", file);
  try {
    const response = await StockLocationStore.importApi(dataUpload);
    fetchStockLocation();
    console.log("File uploaded successfully:", response);
  } catch (error) {
    console.error("Error uploading file:", error);
  }
};

// Export Excel
const ExportExcel = async () => {
  try {
    // Ambil state paginasi aktif
    const { page, page_size } = StockLocationProperties.value;

    // Ambil data sesuai page & page_size & pencarian aktif
    const response = await StockLocationStore.getApi(
      page,
      page_size,
      searchQuery.value
    );
    const rows = response?.payload ?? [];
    if (!rows || rows.length === 0) {
      console.error("No data available for export");
      return;
    }

    // Hitung offset untuk penomoran sesuai page aktif
    const offset = (page - 1) * page_size;

    // Prepare Data for Export
    const title = ["DATAMASTER LOKASI STOK"];
    const data: any[] = [];

    // Header Row (kosong untuk baris kedua tanpa border)
    data.push({});
    data.push({});
    data.push({
      No: "No",
      Kode: "Kode Lokasi Stok",
      Nama: "Nama Lokasi Stok",
      Jenis: "Jenis Lokasi Stok",
      Default: "Default Tujuan Order & Permintaan",
      Status: "Status",
    });

    // Helper: konversi array default tujuan menjadi label yang ditampilkan di tabel
    const toDefaultLabel = (values: any) => {
      const labels: Record<string, string> = {
        "0": "Rawat Inap",
        "1": "Rawat Jalan",
        "2": "IGD",
        "3": "FISIO",
      };
      return Array.isArray(values)
        ? values.map((v: any) => labels[String(v)] ?? String(v)).join(", ")
        : "";
    };

    // Data Rows
    for (let i = 0; i < rows.length; i++) {
      data.push({
        No: offset + i + 1,
        Kode: rows[i].code,
        Nama: rows[i].name,
        Jenis: rows[i].jenisLokasi,
        Default: toDefaultLabel(rows[i].defaultTujuanOrderPermintaan),
        Status: rows[i].status ? "AKTIF" : "NON-AKTIF",
      });
    }

    // Create Workbook and Worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: true });

    // Add Title and Merge Cells
    XLSX.utils.sheet_add_aoa(worksheet, [title], { origin: "A1" });
    worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];

    // Style Title
    worksheet["A1"].s = {
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true, sz: 14 },
    };

    // Column Widths
    worksheet["!cols"] = [
      { wch: 5 },
      { wch: 12 },
      { wch: 30 },
      { wch: 18 },
      { wch: 32 },
      { wch: 10 },
    ];

    // Apply Styles to Cells
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:D1");
    for (let row = 2; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!worksheet[cellAddress]) worksheet[cellAddress] = { v: "" };

        // Border untuk baris tabel
        if (row >= 2) {
          worksheet[cellAddress].s = worksheet[cellAddress].s || {};
          worksheet[cellAddress].s.border = {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
          };
        }

        // Align header (baris 3)
        worksheet[cellAddress].s.alignment = {
          horizontal: "center",
          vertical: "center",
        };

        // Fill header (baris 3)
        if (row === 2) {
          worksheet[cellAddress].s.fill = {
            fgColor: { rgb: "9fe2db" },
          };
        }
      }
    }

    // Append Worksheet to Workbook and Save
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datamaster Lokasi Stok");
    XLSX.writeFile(workbook, `Datamaster Lokasi Stok.xlsx`);
  } catch (error) {
    console.error("Error while exporting Excel", error);
  }
};

// Download Excel
const downloadExcel = async () => {
  try {
    // Prepare Data for Export
    const data = [];

    // Header Row
    data.push({
      No: "No",
      Kode: "Kode Lokasi Stok*",
      Nama: "Nama Lokasi Stok*",
      Jenis: "Jenis Lokasi*",
      Default: "Default Tujuan Order & Permintaan",
    });

    // Add Empty Rows (4 empty rows to match the example)
    data.push({
      No: "1",
      Kode: "GL1",
      Nama: "Gudang Logistik",
      Jenis: "Gudang",
      Default: "RJ, RI",
    });

    // Create Workbook and Worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: true });

    // Column Widths
    const columnWidths = data.reduce((widths: any, row: any) => {
      Object.keys(row).forEach((key, colIdx) => {
        const cellValue = row[key] ? row[key].toString() : "";
        widths[colIdx] = Math.max(widths[colIdx] || 10, cellValue.length + 2);
      });
      return widths;
    }, []);

    worksheet["!cols"] = columnWidths.map((wch: any) => ({ wch }));

    // Apply table styling
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:F2");
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!worksheet[cellAddress]) worksheet[cellAddress] = { v: "" };

        worksheet[cellAddress].s = worksheet[cellAddress].s || {};
        // Border untuk semua sel
        worksheet[cellAddress].s.border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        };

        if (row === range.s.r) {
          // Header style
          worksheet[cellAddress].s.alignment = {
            horizontal: "center",
            vertical: "center",
          };
          worksheet[cellAddress].s.font = { bold: true };
          worksheet[cellAddress].s.fill = { fgColor: { rgb: "9fe2db" } };
        } else {
          // Center alignment untuk kolom numeric dan kolom "No"
          if (col === 0 || col === 4 || col === 5) {
            worksheet[cellAddress].s.alignment = {
              horizontal: "center",
              vertical: "center",
            };
          }
        }
      }
    }

    // Append Worksheet to Workbook and Save
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Format Datamaster Lokasi Stok"
    );
    XLSX.writeFile(workbook, `Format Datamaster Lokasi Stok.xlsx`);
  } catch (error) {
    console.error("Error while exporting Excel", error);
  }
};

onMounted(() => {
  fetchStockLocation();
});
</script>

<template>
  <div class="flex overflow-hidden flex-col h-full">
    <Card
      pt:body:class="overflow-auto pt-0 h-full"
      pt:content:class="overflow-hidden h-full"
      class="overflow-hidden h-full"
    >
      <template #header>
        <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="resetSearch" />
          <CustomBreadCrumb
            :home="{ label: 'Datamaster', home: true }"
            :model="[{ label: 'Lokasi Stok' }]"
          />
          <CustomTextfield
            v-model="searchQuery"
            label="Cari Lokasi Stok"
            prependIcon="PhMagnifyingGlass"
            placeholder="Cari Nama Lokasi Stok"
            @keydown.enter="fetchStockLocation"
          />
          <ToolbarFilterMenu :count="selectedFilteronStokLocationSelect.length">
            <template #label>Jenis Lokasi</template>
            <CustomChip
              v-for="(lokasiStok, index) in filterLokasi"
              :key="lokasiStok.values + index"
              :label="lokasiStok.name"
              :value="lokasiStok.values"
              :isSelected="
                selectedFilteronStokLocationSelect.includes(lokasiStok.values)
              "
              @selected="onStokLocationSelect"
            />
          </ToolbarFilterMenu>
          <CustomButton @click="fetchStockLocation" icon="PhMagnifyingGlass" label="Cari" />
          <CustomButton
            @click="resetSearch"
            label="Reset"
            backgroundColor="bg-white"
            borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300"
          />
          <CustomButton
            @click="openDialog('add', 'Tambah')"
            icon="PhPlus"
            label="Data"
          />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!hasData" />
        <DataTable
          v-else
          :value="StockLocationPayload"
          tableStyle="min-width: 50rem"
          stripedRows
          class="text-xs"
          scrollable
          scrollHeight="flex"
        >
          <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
            <template #header>
              <div class="">No.</div>
            </template>
            <template #body="slotProps">
              <div class="">
                {{
                  (StockLocationProperties.page - 1) *
                    StockLocationProperties.page_size +
                  slotProps.index +
                  1
                }}
              </div>
            </template>
          </Column>
          <!-- Kode Lokasi Stok -->
          <Column
            field="code"
            header="Kode Lokasi Stok"
            headerClass="bg-opensimrs-50 font-semibold text-SM"
          ></Column>
          <!-- Nama Lokasi Stok -->
          <Column
            field="name"
            header="Nama Lokasi Stok"
            headerClass="bg-opensimrs-50 font-semibold text-SM"
          ></Column>
          <!-- Jenis Lokasi Stok -->
          <Column
            header="Jenis Lokasi"
            headerClass="bg-opensimrs-50 font-semibold text-SM"
          >
            <template #body="slotProps">
              <CustomChip
                :label="slotProps.data.jenisLokasi"
                :showCheckedIcon="false"
                border-color="border-none"
                bg-color="bg-opensimrs-300"
                customClass="h-6 text-white"
              />
            </template>
          </Column>
          <!-- Default Tujuan Order & Permintaan -->
          <Column
            header="Default Tujuan Order & Permintaan"
            headerClass="bg-opensimrs-50 font-semibold text-SM"
          >
            <template #body="slotProps">
              <div
                class="flex"
                v-if="
                  Array.isArray(slotProps.data.defaultTujuanOrderPermintaan) &&
                  slotProps.data.defaultTujuanOrderPermintaan.length > 0
                "
              >
                <div
                  v-for="(items, index) in slotProps.data
                    .defaultTujuanOrderPermintaan || []"
                  :key="index"
                >
                  <CustomChip
                    v-if="items === '0'"
                    label="Rawat Inap"
                    :showCheckedIcon="false"
                    borderColor="border-opensimrs-300"
                    bgColor="bg-opensimrs-300"
                    textColor="text-white"
                    customClass="h-6"
                    class="mr-[5px]"
                  />
                  <CustomChip
                    v-if="items === '1'"
                    label="Rawat Jalan"
                    :showCheckedIcon="false"
                    borderColor="border-opensimrs-300"
                    bgColor="bg-opensimrs-300"
                    textColor="text-white"
                    customClass="h-6"
                    class="mr-[5px]"
                  />
                  <CustomChip
                    v-if="items === '2'"
                    label="IGD"
                    :showCheckedIcon="false"
                    borderColor="border-opensimrs-300"
                    bgColor="bg-opensimrs-300"
                    textColor="text-white"
                    customClass="h-6"
                    class="mr-[5px]"
                  />
                  <CustomChip
                    v-if="items === '3'"
                    label="FISIO"
                    :showCheckedIcon="false"
                    borderColor="border-opensimrs-300"
                    bgColor="bg-opensimrs-300"
                    textColor="text-white"
                    customClass="h-6"
                    class="mr-[5px]"
                  />
                </div>
              </div>
            </template>
          </Column>
          <!-- Status -->
          <Column field="status" headerClass="bg-opensimrs-50">
            <template #header="slotProps">
              <div class="w-full font-semibold text-center text-SM">Status</div>
            </template>
            <template #body="slotProps">
              <div class="flex justify-center items-center">
                <CustomChip
                  :label="slotProps.data.status ? 'AKTIF' : 'NON-AKTIF'"
                  :textColor="
                    slotProps.data.status ? 'text-white' : 'text-[#80868d]'
                  "
                  :bgColor="
                    slotProps.data.status ? 'bg-opensimrs-300' : 'bg-white'
                  "
                  :borderColor="
                    slotProps.data.status ? 'border-none' : 'border-[#80868d]'
                  "
                  :icon-color="slotProps.data.status ? 'white' : '#80868d'"
                  customClass="text-xs font-semibold h-5 flex"
                />
              </div>
            </template>
          </Column>
          <!-- Action -->
          <Column headerClass="bg-opensimrs-50">
            <template #header="slotProps">
              <div class="w-full font-semibold text-center text-SM">Action</div>
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
                      `${slotProps.data.code} - ${slotProps.data.name}`,
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
        <AddStockLocation
          v-model:isDialogVisible="StockLocationDialog"
          :title="dialogConfig.title"
          :method="dialogConfig.method"
          :payload="dialogConfig.data"
          @data-updated="fetchStockLocation"
        />
        <DeleteStockLocation
          v-model:isDialogVisible="DeleteStockLocationDialog"
          :title="dialogConfig.title"
          :itemToDelete="dialogConfig.data"
          @delete="confirmDelete"
        />
      </template>
      <template #footer>
        <div class="flex justify-between">
          <div class="flex gap-2.5 items-center">
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
            <CustomButton @click="ExportExcel">
              <img src="@/assets/icons/File Export.svg" alt="" />Export
            </CustomButton>
            <CustomButton @click="downloadExcel">
              <img src="@/assets/icons/download.svg" alt="" />Download
            </CustomButton>
          </div>
          <CustomPaginator
            :key="paginatorKey"
            :rows="StockLocationProperties.page_size"
            :totalRecords="StockLocationProperties.total"
            :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePage"
          />
        </div>
      </template>
    </Card>
  </div>
</template>
