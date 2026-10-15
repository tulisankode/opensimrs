<script setup lang="ts">
import HeaderFilter from "../../Layout/HeaderFilter.vue";
import { onMounted, ref, watch, computed } from "vue";
import * as XLSX from "xlsx-js-style";
import { utilsStore } from "@/stores/utils";
import { useItemGigiStore } from "@/stores/datamaster/itemGigi";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import FormItemGigi from "./FormItemGigi.vue";
import NoData from "@/components/section/NoData.vue";
import FooterPaginator from "../../Layout/FooterPaginator.vue";
import DialogDelete from "../../Layout/DialogDelete.vue";

// State Management
const itemGigiStore = useItemGigiStore();
const UseUtilsStore = utilsStore();
const itemGigiPayload = ref<any[]>([]);
const itemGigiProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Search Query
const searchQuery = ref<string>("");

// Fetch ItemGigi Data from API
const fetchItemGigiData = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await itemGigiStore.getApi(
      itemGigiProperties.value.page,
      itemGigiProperties.value.page_size,
      searchQuery.value
    );

    if (response && response.payload) {
      itemGigiProperties.value.total = response.properties.totalItem;
      itemGigiPayload.value = response.payload;
    } else {
      itemGigiPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    itemGigiPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, (newValue) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetchItemGigiData();
  }, 500);
});

onMounted(() => {
  fetchItemGigiData();
});

// Handle Pagination
const handlePage = (event: any) => {
  itemGigiProperties.value.page = event.page + 1;
  itemGigiProperties.value.page_size = event.rows;
  fetchItemGigiData();
};

// Check if Data Exists
const hasData = computed(
  () => itemGigiPayload.value && itemGigiPayload.value.length > 0
);

// Selected Row
const metaKey = ref(true);
const selectedData = ref();

const onRowSelect = (event: any) => {
  selectedData.value = event.data;
  openDialog("detail", "Detail Data Item Gigi", selectedData.value);
};

// Dialog Management
const isTambahDataDialogVisible = ref(false);
const isDeleteDialogVisible = ref(false);
// const isPreview=ref(false)

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
      await itemGigiStore.deleteApi(item.uuid);
      fetchItemGigiData();
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
    const response = await itemGigiStore.exportApi();
    const rows = response.payload;
    if (!rows || rows.length === 0) {
      console.error("No data available for export");
      return;
    }

    // Prepare Data for Export
    const title = ["DATAMASTER ITEM GIGI"];
    const data = [];

    // Header Row (Kosong untuk baris kedua tanpa border)
    data.push({});
    data.push({});
    data.push({
      No: "No",
      Kategori: "Kategori Gigi",
      Referensi: "Referensi Sistem SATUSEHAT",
      Code: "Masukkan Code SATUSEHAT",
      Display: "Display SATUSEHAT",
      Name: "Nama Item Gigi",
      Catatan: "Catatan",
      // Status: "Status",
    });

    // Data Rows
    for (let i = 0; i < rows.length; i++) {
      data.push({
        No: i + 1,
        Kategori: rows[i].kategoriGigi.name,
        Referensi: rows[i].system,
        Code: rows[i].code,
        Display: rows[i].display,
        Name: rows[i].name,
        Catatan: rows[i].catatan ?? "-",
        // Status: rows[i].status ? "AKTIF" : "NON-AKTIF",
      });
    }

    // Create Workbook and Worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: true });

    // Add Title and Merge Cells
    XLSX.utils.sheet_add_aoa(worksheet, [title], { origin: "A1" });
    worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];

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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datamaster Item Gigi");
    XLSX.writeFile(workbook, `Datamaster Item Gigi.xlsx`);
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
      Kategori: "Kategori Gigi*",
      Referensi: "Referensi Sistem*",
      Code: "Code SATUSEHAT*",
      Display: "Display SATUSEHAT*",
      Name: "Nama Item Gigi*",
      Catatan: "Catatan",
      Gambar: "Gambar",
    });

    // Add Empty Rows (4 empty rows to match the example)

    data.push({
      No: "1",
      Kategori: "Restorasi",
      Referensi: "http://snomed.info/sct",
      Code: "468993001",
      Display: "Dental implant system",
      Name: "ipx = Implan",
      Catatan: "-",
      Gambar: "",
    });
    data.push({
      No: "2",
      Kategori: "Keadaan Gigi",
      Referensi: "http://snomed.info/sct",
      Code: "255579002",
      Display: "Dental caries",
      Name: "karies lingual",
      Catatan: "-",
      Gambar: "",
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
      "Format Datamaster Item Gigi"
    );
    XLSX.writeFile(workbook, `Format Datamaster Item Gigi.xlsx`);
  } catch (error) {
    console.error("Error while exporting Excel", error);
  }
};

const handleFileUpload = async (file: File) => {
  const dataUpload = new FormData();
  dataUpload.append("file", file);

  try {
    const response = await itemGigiStore.importApi(dataUpload); // Panggil fungsi importApi dengan formData
    fetchItemGigiData();
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
        pageType="item-gigi"
        isSuperAdmin
        @update:valueSearch="searchQuery = $event"
        @tambah-data="openDialog('add', 'Tambah Data Item Gigi')"
        @reload-data="fetchItemGigiData()"
      />
    </template>
    <template #content>
      <NoData v-if="!hasData" />
      <DataTable
        v-else
        :value="itemGigiPayload"
        v-model:selection="selectedData"
        :metaKeySelection="metaKey"
        @rowClick="onRowSelect"
        selectionMode="single"
        tableStyle="min-width: 50rem"
        stripedRows
        scrollable
        scrollHeight="flex"
        class="text-xs"
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
                (itemGigiProperties.page - 1) * itemGigiProperties.page_size +
                slotProps.index +
                1
              }}
            </div>
          </template>
        </Column>
        <Column
          field="kategoriGigi.name"
          header="Kategori Gigi"
          headerClass="bg-opensimrs-50"
        ></Column>
        <Column
          field="name"
          header="Item Gigi"
          class="w-1/3"
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
                background-color="bg-opensimrs-300 rounded-lg"
                class="h-6 w-[26px] p-0"
                @click="
                  openDialog(
                    'preview',
                    `Preview - ${slotProps.data.name}`,
                    slotProps.data
                  )
                "
              >
                <PhEye :size="13" weight="fill" />
              </CustomButton>
              <CustomButton
                label=""
                background-color="bg-[#3D84E5] rounded-lg"
                class="h-6 w-[26px] p-0"
                @click="
                  openDialog('edit', 'Edit Data Item Gigi', slotProps.data)
                "
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
      <FormItemGigi
        v-model:isDialogVisible="isTambahDataDialogVisible"
        :title="dialogConfig.title"
        :method="dialogConfig.method"
        :payload="dialogConfig.data"
        @data-updated="fetchItemGigiData"
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
        :rows="itemGigiProperties.page_size"
        :totalRecords="itemGigiProperties.total"
        @page="handlePage"
        @export="downloadExportExcel"
        @import="handleFileUpload"
        @download="downloadFormatExcel"
      />
    </template>
  </Card>
</template>
