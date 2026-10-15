<script setup lang="ts">
import HeaderFilter from "../../Layout/HeaderFilter.vue";
import { ref, onMounted, computed, watch } from "vue";
import { useOklusiGigiStore } from "@/stores/datamaster/oklusiGigi";
import * as XLSX from "xlsx-js-style";
import { utilsStore } from "@/stores/utils";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import FormOklusi from "./FormOklusi.vue";
import NoData from "@/components/section/NoData.vue";
import FooterPaginator from "../../Layout/FooterPaginator.vue";
import DialogDelete from "../../Layout/DialogDelete.vue";
// State Management
const oklusiStore = useOklusiGigiStore();
const UseUtilsStore = utilsStore();
const oklusiPayload = ref<any[]>([]);
const oklusiProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Search Query
const searchQuery = ref<string>("");

// Fetch Oklusi Data from API
const fetchOklusiData = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await oklusiStore.getApi(
      oklusiProperties.value.page,
      oklusiProperties.value.page_size,
      searchQuery.value
    );

    if (response && response.payload) {
      oklusiProperties.value.total = response.properties.total;
      oklusiPayload.value = response.payload;
    } else {
      oklusiPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    oklusiPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, (newValue) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetchOklusiData();
  }, 500);
});

onMounted(() => {
  fetchOklusiData();
});

// Handle Pagination
const handlePage = (event: any) => {
  oklusiProperties.value.page = event.page + 1;
  oklusiProperties.value.page_size = event.rows;
  fetchOklusiData();
};

// Check if Data Exists
const hasData = computed(
  () => oklusiPayload.value && oklusiPayload.value.length > 0
);

// Selected Row
const metaKey = ref(true);
const selectedData = ref();

const onRowSelect = (event: any) => {
  selectedData.value = event.data;
  openDialog("detail", "Detail Data", selectedData.value);
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
      await oklusiStore.deleteApi(item.uuid);
      fetchOklusiData();
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
    const response = await oklusiStore.exportApi();
    const rows = response.payload;
    if (!rows || rows.length === 0) {
      console.error("No data available for export");
      return;
    }

    // Prepare Data for Export
    const title = ["DATAMASTER OKLUSI"];
    const data = [];

    // Header Row (Kosong untuk baris kedua tanpa border)
    data.push({});
    data.push({});
    data.push({
      No: "No",
      system: "Referensi Sistem SATUSEHAT",
      code: "Code SATUSEHAT",
      Display: "Display SATUSEHAT",
      Nama: "Oklusi",
      // Status: "Status",
    });

    // Data Rows
    for (let i = 0; i < rows.length; i++) {
      data.push({
        No: i + 1,
        system: rows[i].system,
        code:rows[i].code,
        Display: rows[i].display,
        Nama: rows[i].name,
        // Status: rows[i].status ? "AKTIF" : "NON-AKTIF",
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datamaster Oklusi");
    XLSX.writeFile(workbook, `Datamaster Oklusi.xlsx`);
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
      Referensi:"Referensi Sistem SATUSEHAT*",
      Code: "Code SATUSEHAT*",
      Display:"Display SATUSEHAT*",
      Name: "Oklusi*",
    });

    // Add Empty Rows (4 empty rows to match the example)
    
      data.push({ No: "1",Referensi:"[reference sistem satu sehat] 1", Code: "OG-001",Display:"Surface [Identifier] Tooth 1", Name: "Normal Bite 0" });


    // Create Workbook and Worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: true });

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
    const range = XLSX.utils.decode_range("A1:C5");

  
    // Append Worksheet to Workbook and Save
    XLSX.utils.book_append_sheet(workbook, worksheet, "Format Datamaster Oklusi Gigi");
    XLSX.writeFile(workbook, `Format Datamaster Oklusi Gigi.xlsx`);
  } catch (error) {
    console.error("Error while exporting Excel", error);
  }
};

const handleFileUpload = async (file: File) => {
  const dataUpload = new FormData();
  dataUpload.append("file", file);

  try {
    const response = await oklusiStore.importApi(dataUpload); // Panggil fungsi importApi dengan formData
    fetchOklusiData();
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
        pageType="oklusi"
        isSuperAdmin
        @update:valueSearch="searchQuery = $event"
        @tambah-data="openDialog('add', 'Tambah Data')"
        @reload-data="fetchOklusiData()"
      />
    </template>
    <template #content>
      <NoData v-if="!hasData" />
      <DataTable
        v-else
        :value="oklusiPayload"
        v-model:selection="selectedData"
        tableStyle="min-width: 50rem"
        stripedRows
        scrollable
        scrollHeight="flex"
        class="text-xs"
        @rowSelect="onRowSelect"
        selectionMode="single"
        :metaKeySelection="metaKey"
        :dt="{
          rowSelectedColor: '#000000',
          rowSelectedBackground: 'transparent',
          bodyCellSelectedBorderColor: 'transparent',
          bodyCellBorderColor: 'rgba(0, 0, 0, 0)',
          rowStripedBackground: '#F8F8F8',
        }"
      >
        <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
          <template #header>
            <div class="flex items-center">No.</div>
          </template>
          <template #body="slotProps">
            <div class="flex items-center justify-center">
              {{
                (oklusiProperties.page - 1) * oklusiProperties.page_size +
                slotProps.index +
                1
              }}
            </div>
          </template>
        </Column>
        <Column
          field="display"
          header="Display SATUSEHAT"
          headerClass="bg-opensimrs-50"
        ></Column>
        <Column
          field="name"
          header="Oklusi"
          class="w-1/2"
          headerClass="bg-opensimrs-50"
        ></Column>
        <!-- <Column
          field="status"
          headerClass="bg-opensimrs-50 font-semibold text-SM"
        >
          <template #header>
            <div class="w-full text-center">Status</div>
          </template>
          <template #body="slotProps">
            <div class="flex justify-center items-center min-w-[120px]">
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
        </Column> -->
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
      <FormOklusi
        v-model:isDialogVisible="isTambahDataDialogVisible"
        :title="dialogConfig.title"
        :method="dialogConfig.method"
        :payload="dialogConfig.data"
        @data-updated="fetchOklusiData"
      />
      <DialogDelete
        v-model:isDialogVisible="isDeleteDialogVisible"
        :title="dialogConfig.title"
        :itemToDelete="dialogConfig.data"
        @delete="confirmDelete"
      />
    </template>
    <template #footer>
      <FooterPaginator
        :rows="oklusiProperties.page_size"
        :totalRecords="oklusiProperties.total"
        @page="handlePage"
        @export="downloadExportExcel"
        @import="handleFileUpload"
        @download="downloadFormatExcel"
      />
    </template>
  </Card>
</template>
