<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useUnitStore } from "@/stores/datamasterFarmasi/Unit";
import * as XLSX from "xlsx-js-style";
import { utilsStore } from "@/stores/utils";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import AddUnit from "../Masterdata/DialogUnit/AddUnit.vue";
import DeleteUnit from "../Masterdata/DialogUnit/DeleteUnit.vue";

// State Management
const searchQuery = ref<string>("");
const UnitStore = useUnitStore();
const UseUtilsStore = utilsStore();
const UnitPayload = ref<any[]>([]);
const UnitProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Check if Data Exists
const hasData = computed(
  () => UnitPayload.value && UnitPayload.value.length > 0
);

// Fetch Satuan
const fetchSatuan = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await UnitStore.getApi(
      UnitProperties.value.page,
      UnitProperties.value.page_size,
      searchQuery.value
    );

    if (response && response.payload) {
      UnitProperties.value.total = response.properties.total;
      UnitPayload.value = response.payload;
    } else {
      UnitPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    UnitPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const paginatorKey = ref(0);

// Reset search function
const resetSearch = () => {
  searchQuery.value = "";
  UnitProperties.value.page = 1;
  paginatorKey.value++;
  fetchSatuan();
};

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
// watch(searchQuery, (newValue) => {
//   if (searchTimeout) clearTimeout(searchTimeout);
//   searchTimeout = setTimeout(() => {
//     fetchSatuan();
//   }, 500);
// });

// Handle Pagination
const handlePage = (event: any) => {
  UnitProperties.value.page = event.page + 1;
  UnitProperties.value.page_size = event.rows;
  fetchSatuan();
};

// Dialog Management
const unitDialog = ref(false);
const DeleteUnitDialog = ref(false);

const dialogConfig = ref<any>({
  method: "add",
  title: "Tambah",
  data: null,
});

const openDialog = (method: string, title: string, data: any = null) => {
  dialogConfig.value = { method, title, data };
  unitDialog.value = true;
};

const deleteDialog = (method: string, title: string, data: any = null) => {
  dialogConfig.value = { method, title, data };
  DeleteUnitDialog.value = true;
};

const confirmDelete = async (item: any) => {
  // console.log(item,'item');
  if (item) {
    UseUtilsStore.setLoading(true);
    try {
      await UnitStore.deleteApi(item.uuid);
      fetchSatuan();
    } catch (error) {
      console.error("Failed to delete data", error);
    } finally {
      UseUtilsStore.setLoading(false);
      DeleteUnitDialog.value = false;
    }
  }
};

const onUpload = (event: any) => {
  const uploadedFiles = event.files[0]; // Ambil file yang diunggah
  // console.log('Uploaded Files:', uploadedFiles); // Cetak file yang diunggah
  importExcel(uploadedFiles);
};

// Import Excel
const importExcel = async (file: File) => {
  const dataUpload = new FormData();
  dataUpload.append("files", file);
  try {
    const response = await UnitStore.importApi(dataUpload);
    fetchSatuan();
    console.log("File uploaded successfully:", response);
  } catch (error) {
    console.error("Error uploading file:", error);
  }
};

// Export Excel
const ExportExcel = async () => {
  try {
    // Ambil state paginasi aktif
    const { page, page_size } = UnitProperties.value;

    // Ambil data sesuai page & page_size & pencarian aktif
    const response = await UnitStore.getApi(page, page_size, searchQuery.value);
    const rows = response?.payload ?? [];
    if (!rows || rows.length === 0) {
      console.error("No data available for export");
      return;
    }

    // Hitung offset untuk penomoran sesuai page aktif
    const offset = (page - 1) * page_size;

    // Prepare Data for Export
    const title = ["DATAMASTER SATUAN"];
    const data: any[] = [];

    // Header Row (kosong untuk baris kedua tanpa border)
    data.push({});
    data.push({});
    data.push({
      No: "No",
      KodeSatuan: "Kode Satuan",
      NamaSatuan: "Nama Satuan",
      SatuanDosis: "Satuan Dosis",
      Editable: "Editable",
      Status: "Status",
    });

    // Data Rows
    for (let i = 0; i < rows.length; i++) {
      data.push({
        No: offset + i + 1,
        KodeSatuan: rows[i].code,
        NamaSatuan: rows[i].name,
        SatuanDosis: rows[i].satuanDosis ? "AKTIF" : "NON-AKTIF",
        Editable: rows[i].editable ? "AKTIF" : "NON-AKTIF",
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
    worksheet["!cols"] = [{ wch: 5 }, { wch: 10 }, { wch: 30 }, { wch: 10 }];

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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datamaster Satuan");
    XLSX.writeFile(workbook, `Datamaster Satuan.xlsx`);
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
      Kode: "Kode Satuan*",
      Nama: "Nama Satuan*",
      Satuan: "Satuan Dosis*",
    });

    // Add Empty Rows (4 empty rows to match the example)
    data.push({
      No: "1",
      Kode: "KODE-001",
      Nama: "Nama Satuan 1",
      Satuan: "Aktif",
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
      "Format Datamaster Satuan"
    );
    XLSX.writeFile(workbook, `Format Datamaster Satuan.xlsx`);
  } catch (error) {
    console.error("Error while exporting Excel", error);
  }
};

onMounted(() => {
  fetchSatuan();
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
            :model="[{ label: 'Satuan' }]"
          />
          <CustomTextfield
            v-model="searchQuery"
            label="Cari Satuan"
            prependIcon="PhMagnifyingGlass"
            placeholder="Cari Nama Satuan"
            @keydown.enter="fetchSatuan"
          />
          <CustomButton @click="fetchSatuan" icon="PhMagnifyingGlass" label="Cari" />
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
          :value="UnitPayload"
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
                  (UnitProperties.page - 1) * UnitProperties.page_size +
                  slotProps.index +
                  1
                }}
              </div>
            </template>
          </Column>
          <Column
            field="code"
            header="Kode Satuan"
            headerClass="bg-opensimrs-50 font-semibold text-SM"
          ></Column>
          <Column
            field="name"
            header="Nama Satuan"
            headerClass="bg-opensimrs-50 font-semibold text-SM"
          ></Column>
          <Column field="satuanDosis" headerClass="bg-opensimrs-50">
            <template #header>
              <div class="w-full font-semibold text-center text-SM">
                Satuan Dosis
              </div>
            </template>
            <template #body="slotProps">
              <div class="flex justify-center items-center">
                <CustomChip
                  :label="slotProps.data.satuanDosis ? 'AKTIF' : 'NON-AKTIF'"
                  :textColor="
                    slotProps.data.satuanDosis ? 'text-white' : 'text-[#80868d]'
                  "
                  :bgColor="
                    slotProps.data.satuanDosis ? 'bg-opensimrs-300' : 'bg-white'
                  "
                  :borderColor="
                    slotProps.data.satuanDosis
                      ? 'border-none'
                      : 'border-[#80868d]'
                  "
                  :icon-color="slotProps.data.satuanDosis ? 'white' : '#80868d'"
                  customClass="text-xs font-semibold h-5 flex"
                />
              </div>
            </template>
          </Column>
          <Column field="editable" headerClass="bg-opensimrs-50">
            <template #header>
              <div class="w-full font-semibold text-center text-SM">
                Editable
              </div>
            </template>
            <template #body="slotProps">
              <div class="flex justify-center items-center">
                <CustomChip
                  :label="slotProps.data.editable ? 'AKTIF' : 'NON-AKTIF'"
                  :textColor="
                    slotProps.data.editable ? 'text-white' : 'text-[#80868d]'
                  "
                  :bgColor="
                    slotProps.data.editable ? 'bg-opensimrs-300' : 'bg-white'
                  "
                  :borderColor="
                    slotProps.data.editable ? 'border-none' : 'border-[#80868d]'
                  "
                  :icon-color="slotProps.data.editable ? 'white' : '#80868d'"
                  customClass="text-xs font-semibold h-5 flex"
                />
              </div>
            </template>
          </Column>
          <Column field="status" headerClass="bg-opensimrs-50">
            <template #header>
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
        <AddUnit
          v-model:isDialogVisible="unitDialog"
          :title="dialogConfig.title"
          :method="dialogConfig.method"
          :payload="dialogConfig.data"
          @data-updated="fetchSatuan"
        />
        <DeleteUnit
          v-model:isDialogVisible="DeleteUnitDialog"
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
            :rows="UnitProperties.page_size"
            :totalRecords="UnitProperties.total"
            :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePage"
          />
        </div>
      </template>
    </Card>
  </div>
</template>
