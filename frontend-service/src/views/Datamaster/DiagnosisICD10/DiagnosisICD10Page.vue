<script lang="ts" setup>
import { ref, onMounted, computed, watch } from "vue";
import { useDiagnosisStore } from "@/stores/datamaster/diagnosis";
import * as XLSX from "xlsx-js-style";
import { utilsStore } from "@/stores/utils";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import Footer from "../Layout/FooterPaginator.vue";
import FormDiagnosisICD10 from "./FormDiagnosisICD10.vue";
import HeaderFilter from "../Layout/HeaderFilter.vue";
import NoData from "@/components/section/NoData.vue";
import DialogDelete from "../Layout/DialogDelete.vue";

// State Management
const diagnosisStore = useDiagnosisStore();
const UseUtilsStore = utilsStore();
const diagnosisPayload = ref<any[]>([]);
const diagnosisProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Search Query
const searchQuery = ref<string>("");

// Fetch Diagnosis Data from API
const fetchDiagnosisData = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await diagnosisStore.getApi(
      diagnosisProperties.value.page,
      diagnosisProperties.value.page_size,
      searchQuery.value
    );

    if (response && response.payload) {
      diagnosisProperties.value.total = response.properties.total;
      diagnosisPayload.value = response.payload;
    } else {
      diagnosisPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    diagnosisPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, (newValue) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetchDiagnosisData();
  }, 500);
});

onMounted(() => {
  fetchDiagnosisData();
});

// Handle Pagination
const handlePage = (event: any) => {
  diagnosisProperties.value.page = event.page + 1;
  diagnosisProperties.value.page_size = event.rows;
  fetchDiagnosisData();
};

// Check if Data Exists
const hasData = computed(
  () => diagnosisPayload.value && diagnosisPayload.value.length > 0
);

// Selected Row
const metaKey = ref(true);
const selectedData = ref();

const onRowSelect = (event: any) => {
  selectedData.value = event.data;
  openDialog("detail", "Detail Data", selectedData.value);
};

// Dialog States
const isTambahDataDialogVisible = ref(false);
const isDeleteDialogVisible = ref(false);

// Dialog Configuration
const dialogConfig = ref<any>({
  method: "add",
  title: "Tambah Data",
  data: null,
});

const openDialog = (method: string, title: string, data: any = null) => {
  dialogConfig.value = { method, title, data };
  isTambahDataDialogVisible.value = true;
};

const deleteDialog = (method: string, title: string, data: any = null) => {
  dialogConfig.value = { method, title, data };
  isDeleteDialogVisible.value = true;
};

const confirmDelete = async (item: any) => {
  if (item) {
    UseUtilsStore.setLoading(true);
    try {
      await diagnosisStore.deleteApi(item.uuid);
      fetchDiagnosisData();
    } catch (error) {
      console.error("Failed to delete data", error);
    } finally {
      UseUtilsStore.setLoading(false);
      isDeleteDialogVisible.value = false;
    }
  }
};

// Export Excel
const downloadExportExcel = async () => {
  try {
    const response = await diagnosisStore.exportApi();
    const rows = response.payload;
    if (!rows || rows.length === 0) {
      console.error("No data available for export");
      return;
    }

    // Prepare Data for Export
    const title = ["DATAMASTER DIAGNOSIS (ICD 10)"];
    const data = [];

    // Header Row (Kosong untuk baris kedua tanpa border)
    data.push({});
    data.push({});
    data.push({
      No: "No",
      Kode: "Kode Diagnosis",
      Nama: "Nama Diagnosis (ICD-10)",
      Status: "Status",
    });

    // Data Rows
    for (let i = 0; i < rows.length; i++) {
      data.push({
        No: i + 1,
        Kode: rows[i].code,
        Nama: rows[i].name,
        Status: rows[i].status ? "AKTIF" : "NON-AKTIF",
      });
    }

    // Create Workbook and Worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: true });

    // Add Title and Merge Cells
    XLSX.utils.sheet_add_aoa(worksheet, [title], { origin: "A1" });
    worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];

    // Style Title
    worksheet["A1"].s = {
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true, sz: 14 },
    };

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
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Datamaster Diagnosis (ICD 10)"
    );
    XLSX.writeFile(workbook, `Datamaster Diagnosis (ICD 10).xlsx`);
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
      Category: "Category",
      Subcategory: "Subcategory",
      EnglishName: "English Name",
      IndonesianName: "Indonesian Name",
    });

    // Add Empty Rows (4 empty rows to match the example)

    data.push({
      Category: "A00",
      Subcategory: "",
      EnglishName: "Cholera",
      IndonesianName: "Kolera",
    });
    data.push({
      Category: "A00",
      Subcategory: "0",
      EnglishName: "Cholera due to Vibrio cholerae 01, biovar cholerae",
      IndonesianName:
        "Kolera yang disebabkan oleh Vibrio cholerae 01, biovar cholerae",
    });
    data.push({
      Category: "A00",
      Subcategory: "1",
      EnglishName: "Cholera due to Vibrio cholerae 01, biovar el tor",
      IndonesianName:
        "Kolera yang disebabkan oleh Vibrio cholerae 01, biovar el tor",
    });
    data.push({
      Category: "A00",
      Subcategory: "9",
      EnglishName: "Cholera, unspecified",
      IndonesianName: "Kolera, tidak terspesifikasi",
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

    // Apply Styles to Cells
    const range = XLSX.utils.decode_range("A1:C5");

    // Append Worksheet to Workbook and Save
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Format Datamaster Diagnosis"
    );
    XLSX.writeFile(workbook, `Format Datamaster Diagnosis (ICD-10).xlsx`);
  } catch (error) {
    console.error("Error while exporting Excel", error);
  }
};

const handleFileUpload = async (file: File) => {
  const dataUpload = new FormData();
  dataUpload.append("file", file);
  try {
    const response = await diagnosisStore.importApi(dataUpload); // Panggil fungsi importApi dengan formData
    fetchDiagnosisData();
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
        page-type="diagnosis"
        @update:valueSearch="searchQuery = $event"
        @tambah-data="openDialog('add', 'Tambah Data')"
        @reload-data="fetchDiagnosisData()"
      />
    </template>

    <template #content>
      <NoData v-if="!hasData" />
      <DataTable
        v-else
        :value="diagnosisPayload"
        v-model:selection="selectedData"
        :metaKeySelection="metaKey"
        @rowClick="onRowSelect"
        selectionMode="single"
        tableStyle="min-width: 50rem"
        stripedRows
        class="text-xs"
        scrollable
        scrollHeight="flex"
        :dt="{
          rowSelectedColor: '#000000',
          rowSelectedBackground: 'transparent',
          bodyCellSelectedBorderColor: 'transparent',
          bodyCellBorderColor: 'transparent',
          rowStripedBackground: '#F8F8F8',
        }"
      >
        <Column headerClass="bg-opensimrs-50">
          <template #header>
            <div class="w-full font-semibold text-center">No.</div>
          </template>
          <template #body="slotProps">
            <div class="flex items-center justify-center">
              {{
                (diagnosisProperties.page - 1) * diagnosisProperties.page_size +
                slotProps.index +
                1
              }}
            </div>
          </template>
        </Column>
        <Column
          field="code"
          header="Kode Diagnosis"
          headerClass="bg-opensimrs-50"
        ></Column>
        <Column
          field="name"
          header="Nama Diagnosis"
          class="w-1/2"
          headerClass="bg-opensimrs-50"
        >
          <template #body="{ data }">
            <div v-for="(name, i) in data.name?.split('~')" :key="name + i">
              <b v-if="i == 0">{{ name }}</b>
              <span v-else>{{ name }}</span>
            </div>
            <!-- <span v-html="data.name.replace('~', '<br/>')"></span> -->
          </template>
        </Column>
        <Column field="status" headerClass="bg-opensimrs-50">
          <template #header>
            <div class="w-full font-semibold text-center text-SM">Status</div>
          </template>
          <template #body="slotProps">
            <div class="flex items-center justify-center text-nowrap">
              <CustomChip
                :label="slotProps.data.status ? 'AKTIF' : 'NON-AKTIF'"
                :textColor="
                  slotProps.data.status ? 'text-white' : 'text-[#80868d]'
                "
                :bgColor="slotProps.data.status ? 'bg-opensimrs-300' : 'bg-white'"
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
            <div
              class="flex items-center justify-center w-full font-semibold text-SM"
            >
              Action
            </div>
          </template>
          <template #body="slotProps">
            <div class="flex items-center gap-2.5 justify-center">
              <CustomButton
                label=""
                background-color="bg-[#3D84E5] rounded-lg"
                @click="openDialog('edit', 'Edit Data', slotProps.data)"
                class="h-6 w-[26px] p-0"
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
                    `${slotProps.data.code}-${slotProps.data.name}`,
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
      <FormDiagnosisICD10
        v-model:isDialogVisible="isTambahDataDialogVisible"
        :title="dialogConfig.title"
        :method="dialogConfig.method"
        :payload="dialogConfig.data"
        @data-updated="fetchDiagnosisData"
      />
      <DialogDelete
        v-model:isDialogVisible="isDeleteDialogVisible"
        :title="dialogConfig.title"
        :itemToDelete="dialogConfig.data"
        @delete="confirmDelete"
      />
    </template>
    <template #footer>
      <Footer
        :rows="diagnosisProperties.page_size"
        :totalRecords="diagnosisProperties.total"
        @page="handlePage"
        @export="downloadExportExcel"
        @import="handleFileUpload"
        @download="downloadFormatExcel"
      />
    </template>
  </Card>
</template>
