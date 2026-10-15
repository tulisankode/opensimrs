<script lang="ts" setup>
import { ref, onMounted, computed, watch } from "vue";
import { useTindakanStore } from "@/stores/datamaster/tindakan";
import { useSnomedCTStore } from "@/stores/datamaster/snomedCT";
import { useIcd9Store } from "@/stores/datamaster/icd9";
import { utilsStore } from "@/stores/utils";
import * as XLSX from "xlsx-js-style";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import Footer from "../Layout/FooterPaginator.vue";
import FormTindakan from "./FormTindakan.vue";
import HeaderFilter from "../Layout/HeaderFilter.vue";
import DialogDelete from "../Layout/DialogDelete.vue";
import NoData from "@/components/section/NoData.vue";

// State Management
const tindakanStore = useTindakanStore();
const snomedStore = useSnomedCTStore();
const icd9Store = useIcd9Store();
const UseUtilsStore = utilsStore();
const tindakanPayload = ref<any[]>([]);
const tindakanProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Search Query
const searchQuery = ref<string>("");

// Fetch tindakan Data from API
const fetchTindakanData = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await tindakanStore.getApi(
      tindakanProperties.value.page,
      tindakanProperties.value.page_size,
      searchQuery.value
    );

    if (response && response.payload) {
      tindakanProperties.value.total = response.properties.total;
      tindakanPayload.value = response.payload;
    } else {
      tindakanPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    tindakanPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, (newValue) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetchTindakanData();
  }, 500);
});

onMounted(() => {
  fetchTindakanData();
});

// Handle Pagination
const handlePage = (event: any) => {
  tindakanProperties.value.page = event.page + 1;
  tindakanProperties.value.page_size = event.rows;
  fetchTindakanData();
};

// Check if Data Exists
const hasData = computed(() => tindakanPayload.value.length > 0);

// Selected Row
const metaKey = ref(true);
const selectedData = ref<any>(null); // Perbaiki tipe data

const onRowSelect = (event: any) => {
  if (event.data) {
    selectedData.value = event.data;
    openDialog("detail", "Detail Data", selectedData.value);
  }
};

// Dialog Management
const isTambahDataDialogVisible = ref(false);
const isDeleteDialogVisible = ref(false);

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
      await tindakanStore.deleteApi(item.uuid);
      fetchTindakanData();
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
    const response = await tindakanStore.exportApi();
    const rows = response.payload;
    if (!rows || rows.length === 0) {
      console.error("No data available for export");
      return;
    }

    // Prepare Data for Export
    const title = ["DATAMASTER TINDAKAN"];
    const data = [];

    // Header Row (Kosong untuk baris kedua tanpa border)
    data.push({});
    data.push({});
    data.push({
      No: "No",
      Kode: "Kode Tindakan",
      Nama: "Nama Tindakan",
      Snomed: "Snomed",
      icd: "ICD 9 CM",
      Status: "Status",
    });

    // Data Rows
    for (let i = 0; i < rows.length; i++) {
      data.push({
        No: i + 1,
        Kode: rows[i].code,
        Nama: rows[i].name,
        Snomed: rows[i].snomed?.name ?? "-",
        icd: rows[i].icd_9?.name ?? "-",
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datamaster Tindakan");
    XLSX.writeFile(workbook, `Datamaster Tindakan.xlsx`);
  } catch (error) {
    console.error("Error while exporting Excel", error);
  }
};

const downloadFormatExcel = async () => {
  try {
    let snomedData = [];
    const responseSnomed = await snomedStore.exportApi();
    if (responseSnomed && responseSnomed.payload) {
      snomedData = responseSnomed.payload;
    } else {
      snomedData = [];
    }

    let icd9Data = [];
    const responseIcd9 = await icd9Store.exportApi();
    if (responseIcd9 && responseIcd9.payload) {
      icd9Data = responseIcd9.payload;
    } else {
      icd9Data = [];
    }

    // Prepare Data for Export
    const data = [];

    // Header Row
    data.push({
      No: "No",
      Code: "Kode Tindakan*",
      Name: "Nama Tindakan*",
      Snomed: "snomed-CT",
      ICD: "ICD-9",
    });

    // Add Empty Rows (4 empty rows to match the example)

    data.push({
      No: "1",
      Code: "PDU-001",
      Name: "Pemeriksaan Dokter Umum",
      Snomed: "",
      ICD: "",
    });

    // Create Workbook and Worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: true });

    worksheet["G1"] = {
      t: "s",
      v: "Catatan :",
      s: {
        font: {
          bold: true,
        },
      },
    };
    worksheet["G2"] = {
      t: "s",
      v: "Data Nama Snomed CT harus sesuai sheet SNOMED-CT",
    };
    worksheet["G3"] = { t: "s", v: "Data Nama ICD 9 harus sesuai sheet ICD 9" };

    // Pastikan worksheet["!ref"] mencakup A-E dan G1-G3
    const maxRow = Math.max(data.length + 1, 3); // +1 karena ada header
    worksheet["!ref"] = `A1:G${maxRow}`;

    // Column Widths
    const columnWidths = data.reduce((widths: any, row: any) => {
      Object.keys(row).forEach((key, colIdx) => {
        const cellValue = row[key] ? row[key].toString() : "";
        widths[colIdx] = Math.max(widths[colIdx] || 10, cellValue.length + 2);
      });
      return widths;
    }, []);

    worksheet["!cols"] = columnWidths.map((wch: any) => ({ wch }));

    // Append Worksheet to Workbook and Save
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Format Datamaster Tindakan"
    );
    const snomedSheet = await generateWorksheetSnomed(snomedData);
    XLSX.utils.book_append_sheet(workbook, snomedSheet, "SNOMED-CT");
    const icd9Sheet = await generateWorksheetIcd9(icd9Data);
    XLSX.utils.book_append_sheet(workbook, icd9Sheet, "ICD 9");
    XLSX.writeFile(workbook, `Format Datamaster Tindakan.xlsx`);
  } catch (error) {
    console.error("Error while exporting Excel", error);
  }
};

// NOTE Export SNOMED dan ICD9
const generateWorksheetSnomed = async (snomedData: any[]) => {
  const data = [];

  data.push({
    No: "No",
    Kode: "Kode Snomed CT",
    Nama: "Nama Snomed CT",
  });

  // Data Rows
  for (let i = 0; i < snomedData.length; i++) {
    data.push({
      No: i + 1,
      Kode: snomedData[i].code,
      Nama: snomedData[i].name,
    });
  }

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

  return worksheet;
};
const generateWorksheetIcd9 = async (icd9Data: any[]) => {
  const data = [];

  data.push({
    No: "No",
    Kode: "Kode ICD-9 CM",
    Nama: "Nama ICD-9 CM",
  });

  // Data Rows
  for (let i = 0; i < icd9Data.length; i++) {
    data.push({
      No: i + 1,
      Kode: icd9Data[i].code,
      Nama: icd9Data[i].name,
    });
  }

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

  return worksheet;
};

const handleFileUpload = async (file: File) => {
  const dataUpload = new FormData();
  dataUpload.append("file", file);

  try {
    const response = await tindakanStore.importApi(dataUpload); // Panggil fungsi importApi dengan formData
    fetchTindakanData();
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
        page-type="tindakan"
        @update:valueSearch="searchQuery = $event"
        @tambah-data="openDialog('add', 'Tambah Data')"
        @reload-data="fetchTindakanData()"
      />
    </template>
    <template #content>
      <NoData v-if="!hasData" />
      <DataTable
        v-else
        :value="tindakanPayload"
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
        <Column header="No." headerClass="bg-opensimrs-50">
          <template #body="slotProps">
            <div class="flex items-center justify-center">
              {{
                (tindakanProperties.page - 1) * tindakanProperties.page_size +
                slotProps.index +
                1
              }}
            </div>
          </template>
        </Column>
        <Column
          field="code"
          header="Kode Tindakan"
          class="w-2/12"
          headerClass="bg-opensimrs-50"
        ></Column>
        <Column
          field="name"
          header="Nama Tindakan"
          class="w-3/12"
          headerClass="bg-opensimrs-50"
        ></Column>
        <Column
          header="Snomed & ICD 9 CM"
          class="w-3/12"
          headerClass="bg-opensimrs-50"
        >
          <template #body="slotProps">
            <div class="underline">Snomed-CT</div>
            <div class="mb-3 font-bold">
              {{
                slotProps.data.snomedDetail && slotProps.data.snomedDetail.name
                  ? slotProps.data.snomedDetail.name
                  : "Tidak ada data"
              }}
            </div>
            <div class="underline">ICD-9 CM</div>
            <div class="font-bold">
              {{
                slotProps.data.icd9Detail && slotProps.data.icd9Detail.name
                  ? slotProps.data.icd9Detail.name
                  : "Tidak ada data"
              }}
            </div>
          </template>
        </Column>
        <Column
          field="status"
          header="Status"
          headerClass="bg-opensimrs-50 flex items-center justify-center"
        >
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
      <FormTindakan
        v-model:isDialogVisible="isTambahDataDialogVisible"
        :title="dialogConfig.title"
        :method="dialogConfig.method"
        :payload="dialogConfig.data"
        @data-updated="fetchTindakanData"
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
        :rows="tindakanProperties.page_size"
        :totalRecords="tindakanProperties.total"
        @page="handlePage"
        @export="downloadExportExcel"
        @import="handleFileUpload"
        @download="downloadFormatExcel"
      />
    </template>
  </Card>
</template>
