<script lang="ts" setup>
import { ref, onMounted, computed, watch } from "vue";
import { usePraktisiStore } from "@/stores/datamaster/praktisi";
import * as XLSX from "xlsx-js-style";
import { utilsStore } from "@/stores/utils";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import Footer from "../Layout/FooterPaginator.vue";
import FormPraktisi from "./FormsPraktisi.vue";
import HeaderFilter from "../Layout/HeaderFilter.vue";
import DialogDelete from "../Layout/DialogDelete.vue";
import NoData from "@/components/section/NoData.vue";

// State Management
const praktisiStore = usePraktisiStore();
const UseUtilsStore = utilsStore();
const praktisiPayload = ref<any[]>([]);
const praktisiProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Filter
const searchQuery = ref<string>("");

const filterTipePraktisi = ref([
  { label: "DOCTOR", value: "dokter" },
  { label: "NON-DOCTOR", value: "non-dokter" },
]);

// Filter Chip
const selectedFilters = ref<string[]>([]);
const onFilterChange = (filters: string[]) => {
  selectedFilters.value = filters; // Update selected filters
  fetchPraktisiData(); // Fetch data with the new filters
};

// Fetch praktisi Data from API
const fetchPraktisiData = async () => {
  UseUtilsStore.setLoading(true);
  try {
    let isDoctor: string | boolean = "";
    if (
      selectedFilters.value.includes("dokter") &&
      selectedFilters.value.includes("non-dokter")
    ) {
      isDoctor = "";
    } else if (selectedFilters.value.includes("dokter")) {
      isDoctor = true;
    } else if (selectedFilters.value.includes("non-dokter")) {
      isDoctor = false;
    }

    const response = await praktisiStore.getApi({
      page: praktisiProperties.value.page,
      limit: praktisiProperties.value.page_size,
      name: searchQuery.value,
      isDoctor: isDoctor,
    });

    if (response && response.payload) {
      praktisiProperties.value.total = response.properties.totalItem;
      praktisiPayload.value = response.payload;
    } else {
      praktisiPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    praktisiPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, (newValue) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetchPraktisiData();
  }, 500);
});

onMounted(() => {
  fetchPraktisiData();
});

// Handle Pagination
const handlePage = (event: any) => {
  praktisiProperties.value.page = event.page + 1;
  praktisiProperties.value.page_size = event.rows;
  fetchPraktisiData();
};

// Check if Data Exists
const hasData = computed(
  () => praktisiPayload.value && praktisiPayload.value.length > 0
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
      await praktisiStore.deleteApi(item.uuid);
      fetchPraktisiData();
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
    const response = await praktisiStore.exportApi();
    const rows = response.payload;
    if (!rows || rows.length === 0) {
      console.error("No data available for export");
      return;
    }

    // Prepare Data for Export
    const title = ["DATAMASTER PRAKTISI"];
    const data = [];

    // Header Row (Kosong untuk baris kedua tanpa border)
    data.push({});
    data.push({});
    data.push({
      No: "No",
      Tipe: "Tipe Praktisi",
      Name: "Nama Praktisi",
      Code: "Kode HFIS (BPJS)",
      SIP: "SIP",
      STR: "STR",
      Antrian: "Kode Antrian Dokter",
      Pelayanan: "Pelayanan*",
      Status: "Status",
    });

    // Data Rows
    for (let i = 0; i < rows.length; i++) {
      data.push({
        No: i + 1,
        Tipe: rows[i].isDoctor ? "Dokter" : "Non-Dokter",
        Name: rows[i].pegawai.name,
        Code: rows[i].codeBpjs ?? "-",
        SIP: rows[i].sip ?? "-",
        STR: rows[i].str ?? "-",
        Antrian: rows[i].codeAntrianDokter ?? "-",
        Pelayanan: rows[i].isDoctor,
        Status: rows[i].status ? "AKTIF" : "NON-AKTIF",
      });
    }

    // Create Workbook and Worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: true });

    // Add Title and Merge Cells
    XLSX.utils.sheet_add_aoa(worksheet, [title], { origin: "A1" });
    worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }];

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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datamaster Prakisi");
    XLSX.writeFile(workbook, `Datamaster Praktisi.xlsx`);
  } catch (error) {
    console.error("Error while exporting Excel", error);
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
        page-type="praktisi"
        @update:valueSearch="searchQuery = $event"
        @tambah-data="openDialog('add', 'Tambah Data')"
        @reload-data="fetchPraktisiData()"
        :filterChipList="filterTipePraktisi"
        @filterChange="onFilterChange"
      />
    </template>
    <template #content>
      <NoData v-if="!hasData" />
      <DataTable
        v-else
        :value="praktisiPayload"
        v-model:selection="selectedData"
        :metaKeySelection="metaKey"
        @rowClick="onRowSelect"
        selectionMode="single"
        tableStyle="min-width: 50rem"
        class="text-xs"
        stripedRows
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
                (praktisiProperties.page - 1) * praktisiProperties.page_size +
                slotProps.index +
                1
              }}
            </div>
          </template>
        </Column>
        <Column header="kode HFIS (BPJS)" headerClass="bg-opensimrs-50">
          <template #body="slotProps">
            {{ slotProps.data.codeBpjs || "-" }}
          </template>
        </Column>
        <Column header="SIP" headerClass="bg-opensimrs-50">
          <template #body="slotProps">
            {{ slotProps.data.sip || "-" }}
          </template>
        </Column>
        <Column header="STR" headerClass="bg-opensimrs-50">
          <template #body="slotProps">
            {{ slotProps.data.str || "-" }}
          </template>
        </Column>
        <Column header="Nama Praktisi" headerClass="bg-opensimrs-50">
          <template #body="slotProps">
            <div>
              {{
                slotProps.data.pegawai?.firstTitle &&
                slotProps.data.pegawai?.firstTitle != "-"
                  ? slotProps.data.pegawai?.firstTitle + ". "
                  : ""
              }}{{ slotProps.data.pegawai?.name
              }}{{
                slotProps.data.pegawai?.lastTitle &&
                slotProps.data.pegawai?.lastTitle != "-"
                  ? ", " + slotProps.data.pegawai?.lastTitle
                  : ""
              }}
            </div>
          </template>
        </Column>
        <Column header="Tipe Praktisi" headerClass="bg-opensimrs-50">
          <template #body="slotProps">
            <CustomChip
              :label="slotProps.data.isDoctor ? 'DOKTOR' : 'NON-DOKTOR'"
              :showCheckedIcon="false"
              border-color="border-none"
              bg-color="bg-opensimrs-300"
              customClass="text-xs font-semibold cursor-auto h-5 bg-opensimrs-300 text-white text-nowrap"
            />
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
                    `${slotProps.data.pegawai.name}`,
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
      <!-- Dialog for Tambah Data Dokter -->
      <FormPraktisi
        v-model:isDialogVisible="isTambahDataDialogVisible"
        :title="dialogConfig.title"
        :method="dialogConfig.method"
        :payload="dialogConfig.data"
        @data-updated="fetchPraktisiData"
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
        :rows="praktisiProperties.page_size"
        :totalRecords="praktisiProperties.total"
        :showImport="false"
        :showDownload="false"
        @page="handlePage"
        @export="downloadExportExcel"
      />
    </template>
  </Card>
</template>
