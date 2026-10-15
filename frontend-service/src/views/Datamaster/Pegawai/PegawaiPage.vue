<script lang="ts" setup>
import { ref, onMounted, computed, watch } from "vue";
import { usePegawaiStore } from "@/stores/datamaster/pegawai";
import * as XLSX from "xlsx-js-style";
import { utilsStore } from "@/stores/utils";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import Footer from "../Layout/FooterPaginator.vue";
import FormPegawai from "./FormPegawai.vue";
import HeaderFilter from "../Layout/HeaderFilter.vue";
import DialogDelete from "../Layout/DialogDelete.vue";
import NoData from "@/components/section/NoData.vue";

// State Management
const pegawaiStore = usePegawaiStore();
const UseUtilsStore = utilsStore();
const pegawaiPayload = ref<any[]>([]);
const pegawaiProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Filter
const searchQuery = ref<string>("");

const selectedFilters = ref<number[]>([]);
const onFilterChange = (filters: number[]) => {
  selectedFilters.value = filters;
  fetchPegawaiData();
};

// Fetch Pegawai Data from API
const fetchPegawaiData = async () => {
  UseUtilsStore.setLoading(true);
  try {
    let typeValue = "";

    if (
      selectedFilters.value.length === 2 &&
      selectedFilters.value.includes(1) &&
      selectedFilters.value.includes(2)
    ) {
      typeValue = "";
    } else if (selectedFilters.value.length === 1) {
      typeValue = `${selectedFilters.value[0]}`;
    }

    const response = await pegawaiStore.getApi({
      page: pegawaiProperties.value.page,
      limit: pegawaiProperties.value.page_size,
      name: searchQuery.value,
      type: typeValue,
    });

    if (response && response.payload) {
      pegawaiProperties.value.total = response.properties.total;
      pegawaiPayload.value = response.payload;
    } else {
      pegawaiPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    pegawaiPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, (newValue) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetchPegawaiData();
  }, 500);
});

onMounted(() => {
  fetchPegawaiData();
});

// Handle Pagination
const handlePage = (event: any) => {
  pegawaiProperties.value.page = event.page + 1;
  pegawaiProperties.value.page_size = event.rows;
  fetchPegawaiData();
};

// Check if Data Exists
const hasData = computed(
  () => pegawaiPayload.value && pegawaiPayload.value.length > 0
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
      await pegawaiStore.deleteApi(item.uuid);
      fetchPegawaiData();
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
    const response = await pegawaiStore.exportApi();
    const rows = response.payload;
    if (!rows || rows.length === 0) {
      console.error("No data available for export");
      return;
    }

    // Prepare Data for Export
    const title = ["DATAMASTER PEGAWAI"];
    const data = [];

    // Header Row (Kosong untuk baris kedua tanpa border)
    data.push({});
    data.push({});
    data.push({
      No: "No",
      Tipe: "Tipe Pegawai",
      Gelar: "Gelar Awal",
      Name: "Nama Pegawai",
      GelarAkhir: "Gelar Akhir",
      NIK: "NIK",
      TglLahir: "Tanggal Lahir",
      Gender: "Jenis Kelamin",
      Status: "Status",
    });

    // Data Rows
    for (let i = 0; i < rows.length; i++) {
      data.push({
        No: i + 1,
        Tipe: rows[i].tipe === 1 ? "Nakes" : "Non-Nakes",
        Gelar: rows[i].firstTitle ?? "-",
        Name: rows[i].name,
        GelarAkhir: rows[i].lastTitle ?? "-",
        NIK: rows[i].nik,
        TglLahir: rows[i].tanggalLahir,
        Gender: rows[i].gender === "perempuan" ? "Perempuan" : "Laki-laki",
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datamaster Pegawai");
    XLSX.writeFile(workbook, `Datamaster Pegawai.xlsx`);
  } catch (error) {
    console.error("Error while exporting Excel", error);
  }
};
const filterTipePegawai = ref([
  { label: "NAKES", value: 1 },
  { label: "NON-NAKES", value: 2 },
]);

const downloadFormatExcel = async () => {
  try {
    // Prepare Data for Export
    const data = [];

    // Header Row
    data.push({
      No: "No",
      Tipe: "Tipe Pegawai*",
      Gelar: "Gelar Awal",
      Name: "Nama Pegawai*",
      GelarAkhir: "Gelar Akhir",
      NIK: "NIK*",
      TglLahir: "Tanggal Lahir*",
      Gender: "Jenis Kelamin*",
    });

    // Add Empty Rows (4 empty rows to match the example)

    data.push({
      No: "1",
      Tipe: "Nakes",
      Gelar: "Dr",
      Name: "Zahrotul Hidayah",
      GelarAkhir: "Sp.Ort",
      NIK: "32256789065434",
      TglLahir: "26-12-2004",
      Gender: "Perempuan",
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
      "Format Datamaster Pegawai"
    );
    XLSX.writeFile(workbook, `Format Datamaster Pegawai.xlsx`);
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
        page-type="pegawai"
        @update:valueSearch="searchQuery = $event"
        @tambah-data="openDialog('add', 'Tambah Data')"
        @reload-data="fetchPegawaiData()"
        :filterChipList="filterTipePegawai"
        @filterChange="onFilterChange"
      />
    </template>

    <template #content>
      <NoData v-if="!hasData" />
      <DataTable
        v-else
        :value="pegawaiPayload"
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
                (pegawaiProperties.page - 1) * pegawaiProperties.page_size +
                slotProps.index +
                1
              }}
            </div>
          </template>
        </Column>
        <Column field="nik" header="NIK" headerClass="bg-opensimrs-50"></Column>
        <Column header="Nama Pegawai" headerClass="bg-opensimrs-50">
          <template #body="slotProps">
            <div class="text-pretty">
              {{
                slotProps.data.firstTitle && slotProps.data.firstTitle != "-"
                  ? slotProps.data.firstTitle + ". "
                  : ""
              }}{{ slotProps.data.name
              }}{{
                slotProps.data.lastTitle && slotProps.data.lastTitle != "-"
                  ? ", " + slotProps.data.lastTitle
                  : ""
              }}
            </div>
          </template></Column
        >
        <Column header="Tipe Pegawai" headerClass="bg-opensimrs-50">
          <template #body="slotProps">
            <CustomChip
              :label="slotProps.data.tipe === 1 ? 'NAKES' : 'NON NAKES'"
              :showCheckedIcon="false"
              border-color="border-none"
              bg-color="bg-opensimrs-300"
              customClass="text-xs font-semibold cursor-auto h-5 bg-opensimrs-300 text-white"
              class="text-nowrap"
            />
          </template>
        </Column>
        <Column headerClass="bg-opensimrs-50">
          <template #header>
            <div class="w-full font-semibold text-center text-SM">
              Jenis Kelamin
            </div>
          </template>
          <template #body="slotProps">
            <div class="flex items-center justify-center text-nowrap">
              <CustomChip
                :label="slotProps.data.gender"
                :show-checked-icon="false"
                :textColor="
                  slotProps.data.gender === 'Laki-laki'
                    ? 'text-male-300'
                    : 'text-female-300'
                "
                :bgColor="
                  slotProps.data.gender === 'Laki-laki'
                    ? 'bg-male-75'
                    : 'bg-female-75'
                "
                :border-color="
                  slotProps.data.gender === 'Laki-laki'
                    ? 'border-male-75'
                    : 'border-female-75'
                "
                customClass="text-xs font-semibold h-5 flex"
              />
            </div>
          </template>
        </Column>
        <Column field="status" headerClass="bg-opensimrs-50">
          <template #header="slotProps">
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
                    `${slotProps.data.nik}-${slotProps.data.name}`,
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
      <!-- Dialog for Tambah Data Nakes -->
      <FormPegawai
        v-model:isDialogVisible="isTambahDataDialogVisible"
        :title="dialogConfig.title"
        :method="dialogConfig.method"
        :payload="dialogConfig.data"
        @data-updated="fetchPegawaiData"
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
        :rows="pegawaiProperties.page_size"
        :totalRecords="pegawaiProperties.total"
        :showImport="false"
        :show-download="false"
        @page="handlePage"
        @export="downloadExportExcel"
        @download="downloadFormatExcel"
      />
    </template>
  </Card>
</template>
