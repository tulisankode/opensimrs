<script lang="ts" setup>
import { ref, onMounted, computed, watch } from "vue";
import { useRoleStore } from "@/stores/datamaster/role";
import * as XLSX from "xlsx-js-style";
import { utilsStore } from "@/stores/utils";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import Footer from "../Layout/FooterPaginator.vue";
import FormRole from "./FormRole.vue";
import HeaderFilter from "../Layout/HeaderFilter.vue";
import NoData from "@/components/section/NoData.vue";
import DialogDelete from "../Layout/DialogDelete.vue";

// State Management
const roleStore = useRoleStore();
const UseUtilsStore = utilsStore();
const rolePayload = ref<any[]>([]);
const roleProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Search Query
const searchQuery = ref<string>("");

// Fetch Role Data from API
const fetchRoleData = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await roleStore.getApi(
      roleProperties.value.page,
      roleProperties.value.page_size,
      searchQuery.value
    );

    if (response && response.payload) {
      roleProperties.value.total = response.properties.totalItem;
      rolePayload.value = response.payload;
    } else {
      rolePayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    rolePayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, (newValue) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetchRoleData();
  }, 500);
});

onMounted(() => {
  fetchRoleData();
});

// Handle Pagination
const handlePage = (event: any) => {
  roleProperties.value.page = event.page + 1;
  roleProperties.value.page_size = event.rows;
  fetchRoleData();
};

// Check if Data Exists
const hasData = computed(
  () => rolePayload.value && rolePayload.value.length > 0
);

// Selected Row
const metaKey = ref(true);
const selectedData = ref();

const onRowSelect = (event: any) => {
  console.log("test");

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
      await roleStore.deleteApi(item.uuid);
      fetchRoleData();
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
    const response = await roleStore.exportApi();
    const rows = response.payload;
    if (!rows || rows.length === 0) {
      console.error("No data available for export");
      return;
    }

    // Prepare Data for Export
    const title = ["DATAMASTER ROLE"];
    const data = [];

    // Header Row (Kosong untuk baris kedua tanpa border)
    data.push({});
    data.push({});
    data.push({
      No: "No",
      Kode: "Kode Role",
      Nama: "Nama Role",
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datamaster Role");
    XLSX.writeFile(workbook, `Datamaster Role.xlsx`);
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
      Kode: "Kode Role*",
      Nama: "Nama Role*",
      Permission: "Permission*",
    });

    // Add Empty Rows (4 empty rows to match the example)

    data.push({
      No: "1",
      Kode: "A01",
      Nama: "superadmin",
      Permission: "dashboard, antrian, admisi, rawat jalan, rawat inap, IGD, farmasi, laboratorium, fisioterapi, training, pembayaran, stok, inventory, datamaster, laporan, setting",
    });
    data.push({
      No: "2",
      Kode: "A02",
      Nama: "admin",
      Permission: "dashboard, antrian, admisi, rawat jalan, rawat inap, IGD, farmasi, laboratorium, fisioterapi, training, pembayaran, stok, inventory, datamaster, laporan, setting",
    });
    data.push({
      No: "3",
      Kode: "A03",
      Nama: "admisi",
      Permission: "dashboard, admisi, profile saya",
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
      "Format Datamaster Role"
    );
    XLSX.writeFile(workbook, `Format Datamaster Role.xlsx`);
  } catch (error) {
    console.error("Error while exporting Excel", error);
  }
};

const handleFileUpload = async (file: File) => {
  const dataUpload = new FormData();
  dataUpload.append("file", file);

  try {
    const response = await roleStore.importApi(dataUpload); // Panggil fungsi importApi dengan formData
    fetchRoleData();
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
        page-type="role"
        @update:valueSearch="searchQuery = $event"
        @tambah-data="openDialog('add', 'Tambah Data')"
        @reload-data="fetchRoleData()"
      />
    </template>

    <template #content>
      <NoData v-if="!hasData" />
      <DataTable
        v-else
        :value="rolePayload"
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
          bodyCellBorderColor: 'transparent',
          rowStripedBackground: '#F8F8F8',
        }"
      >
        <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
          <template #header>
            <div class="flex items-center">No.</div>
          </template>
          <template #body="slotProps">
            <div class="flex items-center justify-center">
              {{ slotProps.index + 1 }}
            </div>
          </template>
        </Column>
        <Column
          field="code"
          header="Kode Role"
          class="w-2/12"
          headerClass="bg-opensimrs-50"
        ></Column>
        <Column
          field="name"
          header="Nama Role"
          class="w-3/12"
          headerClass="bg-opensimrs-50"
        ></Column>
        <Column
          field="permission"
          header="Modul"
          class="w-6/12"
          headerClass="bg-opensimrs-50"
        >
          <template #body="slotProps">
            <div class="flex flex-wrap gap-2">
              <div
                v-if="slotProps.data && slotProps.data.permissions && slotProps.data.permissions.length"
                class="flex flex-wrap w-full h-full gap-1"
              >
                <div v-for="items in slotProps.data.permissions" :key="items">
                  <CustomChip
                    :label="items.module"
                    :showCheckedIcon="false"
                    border-color="border-none"
                    bg-color="bg-opensimrs-300"
                    customClass="text-xs font-semibold cursor-auto h-5 bg-opensimrs-300 text-white"
                  />
                </div>
              </div>
              <div v-else>-</div>
            </div>
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
      <FormRole
        v-model:isDialogVisible="isTambahDataDialogVisible"
        :title="dialogConfig.title"
        :method="dialogConfig.method"
        :payload="dialogConfig.data"
        @data-updated="fetchRoleData"
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
        :rows="roleProperties.page_size"
        :totalRecords="roleProperties.total"
        @page="handlePage"
        @export="downloadExportExcel"
        @import="handleFileUpload"
        @download="downloadFormatExcel"
      />
    </template>
  </Card>
</template>
