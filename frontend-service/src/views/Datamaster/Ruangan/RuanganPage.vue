<script lang="ts" setup>
import { ref, onMounted, watch, computed } from "vue";
import { useRuanganStore } from "@/stores/datamaster/ruangan";
import { useKategoriRuanganStore } from "@/stores/datamaster/kategoriRuangan";
import * as XLSX from "xlsx-js-style";
import { utilsStore } from "@/stores/utils";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import Footer from "../Layout/FooterPaginator.vue";
import FormRuangan from "./FormRuangan.vue";
import HeaderFilter from "../Layout/HeaderFilter.vue";
import NoData from "@/components/section/NoData.vue";
import DialogDelete from "../Layout/DialogDelete.vue";

// State Management
const ruanganStore = useRuanganStore();
const kategoriRuanganStore = useKategoriRuanganStore();
const UseUtilsStore = utilsStore();
const kategoriRuanganPayload = ref<any[]>([]);
const ruanganPayload = ref<any[]>([]);
const ruanganProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Filter
const searchQuery = ref<string>("");
const selectedKategoriRuangan = ref("");
const selectedKelas = ref("");

const handleSearchQuery = (searchValue: string) => {
  searchQuery.value = searchValue;
};
const handleSelectedKategoriRuangan = (selectedValue: any) => {
  selectedKategoriRuangan.value = selectedValue;
};
const handleSelectedKelas = (selectedValue: any) => {
  selectedKelas.value = selectedValue;
};

// Reset filter fields
const handleReset = () => {
  resetForm();
  fetchRuanganData();
};

const resetFormRef = ref();

const resetForm = () => {
  searchQuery.value = "";
  selectedKategoriRuangan.value = "";
  selectedKelas.value = "";
  ruanganProperties.value.page = 1;
  resetFormRef.value.resetForm();
};

// Fetch Ruangan Data from API
const fetchRuanganData = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await ruanganStore.getApi({
      page: ruanganProperties.value.page,
      limit: ruanganProperties.value.page_size,
      name: searchQuery.value,
      kategori_ruangan_uuid:
        selectedKategoriRuangan.value !== null
          ? selectedKategoriRuangan.value
          : "",
      kelas_ruangan: selectedKelas.value !== null ? selectedKelas.value : "",
    });

    if (response && response.payload) {
      ruanganProperties.value.total = response.properties.total;
      ruanganPayload.value = response.payload;
    } else {
      ruanganPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    ruanganPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const fetchKategoriRuangan = async () => {
  try {
    const response = await kategoriRuanganStore.getAktifApi();
    if (response && response.payload) {
      kategoriRuanganPayload.value = response.payload;
    } else {
      kategoriRuanganPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch kategori ruangan", error);
    kategoriRuanganPayload.value = [];
  }
};

const optionsKelas = ref([
  { label: "kelas 1", value: 1 },
  { label: "kelas 2", value: 2 },
  { label: "kelas 3", value: 3 },
  { label: "VIP", value: 4 },
  { label: "VVIP", value: 5 },
]);

onMounted(() => {
  fetchRuanganData();
  fetchKategoriRuangan();
});

// Handle Pagination
const handlePage = (event: any) => {
  ruanganProperties.value.page = event.page + 1;
  ruanganProperties.value.page_size = event.rows;
  fetchRuanganData();
};

// Check if Data Exists
const hasData = computed(
  () => ruanganPayload.value && ruanganPayload.value.length > 0
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
      await ruanganStore.deleteApi(item.uuid);
      fetchRuanganData();
    } catch (error) {
      console.error("Failed to delete data", error);
    } finally {
      UseUtilsStore.setLoading(false);
      isDeleteDialogVisible.value = false;
    }
  }
};
const downloadExportExcel = async () => {
  try {
    const response = await ruanganStore.exportApi();
    const rows = response.payload;
    if (!rows || rows.length === 0) {
      console.error("No data available for export");
      return;
    }

    // Prepare Data for Export
    const title = ["DATAMASTER RUANGAN"];
    const data = [];

    // Header Row (Kosong untuk baris kedua tanpa border)
    data.push({});
    data.push({});
    data.push({
      No: "No",
      Kode: "Kode Ruangan",
      Nama: "Nama Ruangan",
      Kategori: "Kategori Ruangan",
      nomorKamar: "Nomor Ruangan",
      kelasRuangan: "Kelas Ruangan",
      Status: "Status",
    });

    // Data Rows
    for (let i = 0; i < rows.length; i++) {
      const kelasLabel =
        optionsKelas.value.find((kelas) => kelas.value === rows[i].kelasRuangan)
          ?.label || "-";

      data.push({
        No: i + 1,
        Kode: rows[i].code,
        Nama: rows[i].name,
        Kategori: rows[i].kategoriRuangan?.name ?? "-",
        nomorKamar: rows[i].noRoom,
        kelasRuangan: kelasLabel,
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datamaster Ruangan");
    XLSX.writeFile(workbook, `Datamaster Ruangan.xlsx`);
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
      Code: "Kode Ruangan*",
      Name: "Nama Ruangan*",
      Kategori: "Kategori Ruangan*",
      Nomor: "Nomor Kamar*",
      KelasRuangan: "Kelas Ruangan*",
    });

    data.push({
      No: "1",
      Code: "MWR-01",
      Name: "Mawar",
      Kategori: "Rawatan Umum",
      Nomor: "1",
      KelasRuangan: "Kelas 3",
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
      "Format Datamaster Ruangan"
    );
    XLSX.writeFile(workbook, `Format Datamaster Ruangan.xlsx`);
  } catch (error) {
    console.error("Error while exporting Excel", error);
  }
};

const handleFileUpload = async (file: File) => {
  const dataUpload = new FormData();
  dataUpload.append("file", file);

  try {
    const response = await ruanganStore.importApi(dataUpload); // Panggil fungsi importApi dengan formData
    fetchRuanganData();
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
        page-type="ruangan"
        @update:valueSearch="handleSearchQuery"
        @update:selectedFilter="handleSelectedKategoriRuangan"
        @update:selectedFilterSecond="handleSelectedKelas"
        @tambah-data="openDialog('add', 'Tambah Data')"
        @reload-data="fetchRuanganData()"
        @search="fetchRuanganData()"
        @reset="handleReset()"
        :filterSelect="kategoriRuanganPayload"
        :filterSelectSecond="optionsKelas"
        ref="resetFormRef"
      />
    </template>

    <template #content>
      <NoData v-if="!hasData" />
      <DataTable
        v-else
        :value="ruanganPayload"
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
        <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
          <template #header>
            <div class="flex items-center">No.</div>
          </template>
          <template #body="slotProps">
            <div class="flex items-center justify-center">
              {{
                (ruanganProperties.page - 1) * ruanganProperties.page_size +
                slotProps.index +
                1
              }}
            </div>
          </template>
        </Column>
        <Column
          field="code"
          header="Kode Ruangan"
          headerClass="bg-opensimrs-50"
        ></Column>
        <Column
          field="name"
          header="Nama Ruangan"
          headerClass="bg-opensimrs-50"
          class="w-3/12"
        ></Column>
        <Column field="noRoom" headerClass="bg-opensimrs-50" class="text-center">
          <template #header>
            <div class="w-full font-semibold text-center text-SM">No.Kamar</div>
          </template>
        </Column>
        <Column
          field="kategoriRuanganName"
          header="Kategori Ruangan"
          headerClass="bg-opensimrs-50"
        ></Column>

        <Column header="Kelas Ruangan" headerClass="bg-opensimrs-50">
          <template #body="slotProps">
            {{
              optionsKelas.find(
                (kelas) => kelas.value === slotProps.data.kelasRuangan
              )?.label || "-"
            }}
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
      <FormRuangan
        v-model:isDialogVisible="isTambahDataDialogVisible"
        :title="dialogConfig.title"
        :method="dialogConfig.method"
        :payload="dialogConfig.data"
        @data-updated="fetchRuanganData"
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
        :rows="ruanganProperties.page_size"
        :totalRecords="ruanganProperties.total"
        @page="handlePage"
        @export="downloadExportExcel"
        @import="handleFileUpload"
        @download="downloadFormatExcel"
      />
    </template>
  </Card>
</template>
