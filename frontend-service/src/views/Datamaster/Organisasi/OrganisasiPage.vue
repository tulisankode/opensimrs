<script lang="ts" setup>
import { ref, onMounted, computed, watch } from "vue";
import { useOrganisasiStore } from "@/stores/datamaster/organisasi";
import * as XLSX from "xlsx-js-style";
import { utilsStore } from "@/stores/utils";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import FormOrganisasi from "./FormOrganisasi.vue";
import HeaderFilter from "../Layout/HeaderFilter.vue";
import NoData from "@/components/section/NoData.vue";
import FooterPaginator from "../Layout/FooterPaginator.vue";
import DialogDelete from "../Layout/DialogDelete.vue";

// State Management
const organisasiStore = useOrganisasiStore();
const UseUtilsStore = utilsStore();
const organisasiPayload = ref<any[]>([]);
const organisasiProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Search Query
const searchQuery = ref<string>("");

// Fetch Organisasi Data from API
const fetchOrganisasiData = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await organisasiStore.getApi(
      organisasiProperties.value.page,
      organisasiProperties.value.page_size,
      searchQuery.value
    );

    if (response && response.payload) {
      organisasiProperties.value.total = Number(response.properties.totalItem);
      organisasiPayload.value = response.payload;
    } else {
      organisasiPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    organisasiPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, (newValue) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetchOrganisasiData();
  }, 500);
});

onMounted(() => {
  fetchOrganisasiData();
});

// Handle Pagination
const handlePage = (event: any) => {
  organisasiProperties.value.page = event.page + 1;
  organisasiProperties.value.page_size = event.rows;
  fetchOrganisasiData();
};

// Check if Data Exists
const hasData = computed(
  () => organisasiPayload.value && organisasiPayload.value.length > 0
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

const openDialog = async (method: string, title: string, data: any = null) => {
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
      await organisasiStore.deleteApi(item.uuid);
      fetchOrganisasiData();
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
    const response = await organisasiStore.exportApi();
    const rows = response.payload;
    if (!rows || rows.length === 0) {
      console.error("No data available for export");
      return;
    }

    // Prepare Data for Export
    const title = ["DATAMASTER ORGANISASI"];
    const data = [];

    // Header Row (Kosong untuk baris kedua tanpa border)
    data.push({});
    data.push({});
    data.push({
      No: "No",
      Kode: "Kode Organisasi",
      Nama: "Nama Organisasi",
      Phone: "No. Telephone",
      Email: "E-mail",
      Url: "URL",
      Provinsi: "Provinsi",
      Kabupaten: "Kabupaten/Kota",
      Kecamatan: "Kecamatan",
      Kelurahan: "Kelurahan/Desa",
      KodePos: "Kode Pos",
      Alamat: "Alamat",
      PartOf: "Part Of ID",
      PartOfName: "Part Of Name",
      IDSatusehat: "ID SATUSEHAT",
      Status: "Status",
    });

    // Data Rows
    for (let i = 0; i < rows.length; i++) {
      data.push({
        No: i + 1,
        Kode: rows[i].code,
        Nama: rows[i].name,
        Phone: rows[i].phone,
        Email: rows[i].email,
        Url: rows[i].url,
        Provinsi: rows[i].province ?? "-",
        Kabupaten: rows[i].city ?? "-",
        Kecamatan: rows[i].district ?? "-",
        Kelurahan: rows[i].village ?? "-",
        KodePos: rows[i].postalCode ?? "-",
        Alamat: rows[i].fullAddress ?? "-",
        PartOf: rows[i].partOf ?? "-",
        PartOfName: rows[i].partOfName ?? "-",
        IDSatusehat: rows[i].satuSehatId ?? "-",
        Status: rows[i].status ? "AKTIF" : "NON-AKTIF",
      });
    }

    // Create Workbook and Worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: true });

    // Add Title and Merge Cells
    XLSX.utils.sheet_add_aoa(worksheet, [title], { origin: "A1" });
    worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 15 } }];

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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datamaster Organisasi");
    XLSX.writeFile(workbook, `Datamaster Organisasi.xlsx`);
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
      IHS: "IHS Number*",
      Kode: "Kode Organisasi*",
      Nama: "Nama Organisasi*",
      Phone: "No. Telepon*",
      Email: "Email*",
      Url: "URL*",
      Provinsi: "Provinsi*",
      Kabupaten: "Kab/Kota*",
      Kecamatan: "Kecamatan*",
      Kelurahan: "Kelurahan/Desa*",
      KodePos: "Kode Pos*",
      Alamat: "Alamat*",
      PartOf: "Part Of Name",
    });

    // Add Empty Rows (4 empty rows to match the example)

    data.push({
      No: "1",
      IHS: "123-dhbfjhegj",
      Kode: "DLB-005",
      Nama: "Departemen Laboratorium",
      Phone: "(032) 888 987",
      Email: "email@contoh.id",
      Url: "https://lab.com/",
      Provinsi: "Jawa Timur",
      Kabupaten: "Surabaya",
      Kecamatan: "Sukolilo",
      Kelurahan: "Keputih",
      KodePos: "62271",
      Alamat: "Sukolilo regency park 01",
      PartOf: "",
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
      "Format Datamaster Organisasi"
    );
    XLSX.writeFile(workbook, `Format Datamaster Organisasi.xlsx`);
  } catch (error) {
    console.error("Error while exporting Excel", error);
  }
};

const handleFileUpload = async (file: File) => {
  const dataUpload = new FormData();
  dataUpload.append("file", file);

  try {
    const response = await organisasiStore.importApi(dataUpload); // Panggil fungsi importApi dengan formData
    fetchOrganisasiData();
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
        page-type="organisasi"
        @update:valueSearch="searchQuery = $event"
        @tambah-data="openDialog('add', 'Tambah Data')"
        @reload-data="fetchOrganisasiData()"
      />
    </template>

    <template #content>
      <NoData v-if="!hasData" />
      <DataTable
        v-else
        :value="organisasiPayload"
        tableStyle="min-width: 50rem"
        class="text-xs"
        scrollable
        scrollHeight="flex"
        selectionMode="single"
        v-model:selection="selectedData"
        :metaKeySelection="metaKey"
        @rowClick="onRowSelect"
        stripedRows
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
                (organisasiProperties.page - 1) *
                  organisasiProperties.page_size +
                slotProps.index +
                1
              }}
            </div>
          </template>
        </Column>
        <Column
          field="code"
          header="Kode Organisasi"
          class="w-2/12"
          headerClass="bg-opensimrs-50"
        ></Column>
        <Column
          field="name"
          header="Nama Organisasi"
          class="w-3/12"
          headerClass="bg-opensimrs-50"
        ></Column>
        <Column
          field="phone"
          header="No. Telepon"
          class="w-3/12"
          headerClass="bg-opensimrs-50"
        ></Column>
        <Column
          field="email"
          header="Email"
          class="w-3/12"
          headerClass="bg-opensimrs-50"
        ></Column>
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
      <!-- Dialog for Tambah Data Dokter -->
      <FormOrganisasi
        v-model:isDialogVisible="isTambahDataDialogVisible"
        :title="dialogConfig.title"
        :method="dialogConfig.method"
        :payload="dialogConfig.data"
        @data-updated="fetchOrganisasiData"
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
        :rows="organisasiProperties.page_size"
        :totalRecords="organisasiProperties.total"
        @page="handlePage"
        @export="downloadExportExcel"
        @import="handleFileUpload"
        @download="downloadFormatExcel"
      />
    </template>
  </Card>
</template>
