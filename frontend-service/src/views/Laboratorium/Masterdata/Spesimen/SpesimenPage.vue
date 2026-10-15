<script setup lang="ts">
import { ref, watch, onMounted, computed } from "vue";
import { utilsStore } from "@/stores/utils";
import { useSpesimenLabStore } from "@/stores/datamasterLaboratorium/spesimenLab";
import * as XLSX from "xlsx-js-style";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import DialogDelete from "../../Layout/DialogDelete.vue";
import DialogSpesimen from "./DialogSpesimen.vue";
import NoData from "@/components/section/NoData.vue";

const spesimenStore = useSpesimenLabStore();
const storeUtils = utilsStore();
const spesimenPayload = ref(<any[]>[]);
const searchQuery = ref<string>("");
const spesimenProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});
const handleSearchQuery = (searchValue: string) => {
  searchQuery.value = searchValue;
};

// Fetch data
const fetchSpesimen = async () => {
  storeUtils.setLoading(true);
  try {
    const response = await spesimenStore.getApi(
      spesimenProperties.value.page,
      spesimenProperties.value.page_size,
      searchQuery.value
    );
    if (response && response.payload) {
      spesimenProperties.value.total = response.payload.pagination.total;
      spesimenPayload.value = response.payload.data;
    } else {
      spesimenPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch spesimen", error);
    spesimenPayload.value = [];
  } finally {
    storeUtils.setLoading(false);
  }
};

// Add and edit Spesimen
const spesimenDialogRef = ref();

// Fungsi untuk membuka dialog tambah data
const openAddDialog = () => {
  spesimenDialogRef.value.resetForm(); // Reset form sebelum membuka dialog
  spesimenDialogRef.value.visible = true; // Buka dialog
  spesimenDialogRef.value.editMode = false; 
};

// Fungsi untuk membuka dialog edit data
const editDialog = (item: any) => {
  spesimenDialogRef.value.fillForm({
    code: item.code,
    name: item.name,
    status: item.status,
    id: item.uuid
  });
  spesimenDialogRef.value.visible = true;
};
const submitSpesimen = async (payload: any) => {
  storeUtils.setLoading(true);
  try {
    let response;
    if (payload.id) {
      response = await spesimenStore.putApi(payload.id, payload);
    } else {
      response = await spesimenStore.postApi(payload);
    }

    if (response) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      searchQuery.value = "";
      await fetchSpesimen();
      resetForm();
      spesimenDialogRef.value.visible = false;
    }
  } catch (error) {
    console.error("Error submitting data", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

// Delete Data
const isDeleteDialogVisible = ref(false);
const dialogConfig = ref({
  method: "",
  title: "",
  data: {},
});

const deleteDialog = (method: string, title: string, data: any = null) => {
  dialogConfig.value = { method, title, data };
  isDeleteDialogVisible.value = true;
};

const confirmDelete = async (item: any) => {
  if (item) {
    storeUtils.setLoading(true);
    try {
      await spesimenStore.deleteApi(item.uuid);
      fetchSpesimen();
    } catch (error) {
      console.error("Failed to delete data", error);
    } finally {
      storeUtils.setLoading(false);
      isDeleteDialogVisible.value = false;
    }
  }
};

const hasData = computed(() => spesimenPayload.value.length > 0);

// Reset Data
const resetForm = () => {
  spesimenDialogRef.value?.resetForm();
};

// Handle Page
const handlePage = (event: any) => {
  spesimenProperties.value.page = event.page + 1;
  spesimenProperties.value.page_size = event.rows;
  fetchSpesimen();
};

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, (newValue) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetchSpesimen();
  }, 500);
});

const onUpload = (event: any) => {
  const uploadedFiles = event.files[0]; // Ambil file yang diunggah
  importExcel(uploadedFiles);
};

// Import Excel
const importExcel = async (file: File) => {
  const dataUpload = new FormData();
  dataUpload.append("file", file);
  try {
    const response = await spesimenStore.importApi(dataUpload);
    fetchSpesimen();
    console.log("File uploaded successfully:", response);
  } catch (error) {
    console.error("Error uploading file:", error);
  }
};

// Export Excel
const ExportExcel = async () => {
  try {
    const response = await spesimenStore.getApi(
      spesimenProperties.value.page,
      spesimenProperties.value.page_size,
      searchQuery.value
    );
    const rows = response.payload.data;
    console.log("rows", rows);
    if (!rows || rows.length === 0) {
      console.error("No data available for export");
      return;
    }

    // Prepare Data for Export
    const title = ["DATAMASTER Spesimen"];
    const data = [];

    // Header Row (Kosong untuk baris kedua tanpa border)
    data.push({});
    data.push({});
    data.push({
      No: "No",
      Kode: "Kode Spesimen",
      Nama: "Nama Spesimen",
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
    worksheet["!cols"] = [{ wch: 5 }, { wch: 10 }, { wch: 30 }, { wch: 10 }];

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
        worksheet[cellAddress].s.alignment = {
          horizontal: "center",
          vertical: "center",
        };

        // Fill header with background color (row 3)
        if (row === 2) {
          worksheet[cellAddress].s.fill = {
            fgColor: { rgb: "9fe2db" },
          };
        }
      }
    }

    // Append Worksheet to Workbook and Save
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datamaster Spesimen");
    XLSX.writeFile(workbook, `Datamaster Spesimen.xlsx`);
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
      Kode: "Kode*",
      Nama: "Nama Spesimen*",
    });

    // Add Empty Rows (4 empty rows to match the example)
    data.push({ No: "1", Kode: "SP-001", Nama: "Spesimen A" });

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
      "Format Datamaster Spesimen"
    );
    XLSX.writeFile(workbook, `Format Datamaster Spesimen.xlsx`);
  } catch (error) {
    console.error("Error while exporting Excel", error);
  }
};

onMounted(async () => {
  await fetchSpesimen();
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
          <CustomButton icon="PhArrowClockwise" @click="fetchSpesimen" />
          <CustomBreadCrumb :home="{ label: 'Datamaster', home: true }" />
          <PhCaretRight :size="16" weight="bold" class="shrink-0 text-opensimrs-300" aria-hidden="true" />
          <h1 class="toolbar-heading text-opensimrs-300">Spesimen</h1>
          <CustomTextfield
            v-model="searchQuery"
            label="Cari Spesimen"
            prependIcon="PhMagnifyingGlass"
            placeholder="Cari Spesimen"
          />
          <CustomButton @click="openAddDialog" icon="PhPlus" label="Data" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!hasData" />
        <DataTable
          :value="spesimenPayload"
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
                  (spesimenProperties.page - 1) * spesimenProperties.page_size +
                  slotProps.index +
                  1
                }}
              </div>
            </template>
          </Column>
          <Column
            field="kodeSpesimen"
            header="Kode Spesimen"
            headerClass="bg-opensimrs-50"
            class="w-[25%]"
          >
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.code }}</div>
            </template>
          </Column>
          <Column
            field="namaSpesimen"
            header="Nama Spesimen"
            headerClass="bg-opensimrs-50"
            class="w-[55%]"
          >
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.name }}</div>
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
                  @click="editDialog(slotProps.data)"
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
            <CustomButton label="Eksport" @click="ExportExcel">
              <img src="@/assets/icons/File Import.svg" alt="" />Eksport
            </CustomButton>
            <CustomButton label="Eksport" @click="downloadExcel">
              <img src="@/assets/icons/download.svg" alt="" />Download
            </CustomButton>
          </div>
          <CustomPaginator
            :rows="spesimenProperties.page_size"
            :totalRecords="spesimenProperties.total"
            :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePage"
          />
        </div>
      </template>
    </Card>

    <!-- DialogSpesimen -->
    <DialogSpesimen
      ref="spesimenDialogRef"
      @submit="submitSpesimen"
      @reset="resetForm"
    />

    <DialogDelete
      v-model:isDialogVisible="isDeleteDialogVisible"
      :title="dialogConfig.title"
      :itemToDelete="dialogConfig.data"
      @delete="confirmDelete"
    />
  </div>
</template>
