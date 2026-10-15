<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useMedicalItemStore } from "@/stores/datamasterFarmasi/MedicalItem";
import { useStockTypeStore } from "@/stores/datamasterFarmasi/StockType";
import * as XLSX from "xlsx-js-style";
import { utilsStore } from "@/stores/utils";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import NoData from "@/components/section/NoData.vue";
import AddMedicalItem from "./DialogMedicalItem/AddMedicalItem.vue";
import DeleteMedicalItem from "./DialogMedicalItem/DeleteMedicalItem.vue";

const optionJenisItem = ref([
  { name: "OBAT", value: "obat" },
  { name: "ALKES", value: "alkes" },
]);

// State Management
const searchQuery = ref<string>("");
const jenisItem = ref<string>("");
const MedicalItemStore = useMedicalItemStore();
const UseUtilsStore = utilsStore();
const MedicalItemPayload = ref<any[]>([]);
const MedicalItemProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Check if Data Exists
const hasData = computed(
  () => MedicalItemPayload.value && MedicalItemPayload.value.length > 0
);

// Fetch MedicalItem
const fetchMedicalItem = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await MedicalItemStore.getApi(
      MedicalItemProperties.value.page,
      MedicalItemProperties.value.page_size,
      searchQuery.value,
      jenisItem.value || "",
      selectedFilterJenisStok.value
    );

    if (response && response.payload) {
      MedicalItemProperties.value.total = response.properties.total;
      MedicalItemPayload.value = response.payload;
      console.log("MedicalItemPayload", MedicalItemPayload.value);
    } else {
      MedicalItemPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    MedicalItemPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// Handle Pagination
const handlePage = (event: any) => {
  MedicalItemProperties.value.page = event.page + 1;
  MedicalItemProperties.value.page_size = event.rows;
  fetchMedicalItem();
};

const selectedFilterJenisStok = ref<string[]>([]);
const onPoliSelect = (label: string) => {
  if (selectedFilterJenisStok.value.includes(label)) {
    selectedFilterJenisStok.value = selectedFilterJenisStok.value.filter(
      (item) => item != label
    );
  } else {
    selectedFilterJenisStok.value.push(label);
  }
  fetchMedicalItem();
};

// Filter Search Data
const searchData = () => {
  searchQuery.value, jenisItem.value, fetchMedicalItem();
};

const paginatorKey = ref(0);

// Filter Reset Data
const resetData = () => {
  searchQuery.value = "";
  jenisItem.value = "";
  selectedFilterJenisStok.value = [];
  MedicalItemProperties.value.page = 1;
  paginatorKey.value++;
  fetchMedicalItem();
};

// Selected Row
const metaKey = ref(true);
const selectedData = ref();

const onRowSelect = (event: any) => {
  selectedData.value = event.data;
  openDialog("detail", "Detail Data", selectedData.value);
};

// Dialog Management
const MedicalItemDialog = ref(false);
const DeleteMedicalItemDialog = ref(false);

const dialogConfig = ref<any>({
  method: "add",
  title: "Tambah",
  data: null,
});

const openDialog = (method: string, title: string, data: any = null) => {
  dialogConfig.value = { method, title, data };
  MedicalItemDialog.value = true;
};

const deleteDialog = (method: string, title: string, data: any = null) => {
  dialogConfig.value = { method, title, data };
  DeleteMedicalItemDialog.value = true;
};

const confirmDelete = async (item: any) => {
  if (item) {
    UseUtilsStore.setLoading(true);
    try {
      await MedicalItemStore.deleteApi(item.uuid);
      fetchMedicalItem();
    } catch (error) {
      console.error("Failed to delete data", error);
    } finally {
      UseUtilsStore.setLoading(false);
      DeleteMedicalItemDialog.value = false;
    }
  }
};

// State Management Stock Type
const StockTypeStore = useStockTypeStore();
const StockTypePayload = ref<any[]>([]);

// Fetch Stock Type
const fetchStockType = async () => {
  try {
    const response = await StockTypeStore.getApi();
    if (response && response.payload) {
      StockTypePayload.value = response.payload;
      console.log("StockTypePayload", StockTypePayload.value);
    } else {
      StockTypePayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch", error);
    StockTypePayload.value = [];
  }
};

const onUpload = (event: any) => {
  const uploadedFiles = event.files[0]; // Ambil file yang diunggah
  importExcel(uploadedFiles);
};

// Import Excel
const importExcel = async (file: File) => {
  const dataUpload = new FormData();
  dataUpload.append("files", file);
  try {
    const response = await MedicalItemStore.importApi(dataUpload);
    fetchMedicalItem();
    console.log("File uploaded successfully:", response);
  } catch (error) {
    console.error("Error uploading file:", error);
  }
};

// Export Excel
const ExportExcel = async () => {
  try {
    // Ambil state paginasi aktif
    const { page, page_size } = MedicalItemProperties.value;

    // Ambil data sesuai page & page_size & pencarian aktif
    const response = await MedicalItemStore.getApi(
      page,
      page_size,
      searchQuery.value
    );
    const rows = response?.payload ?? [];
    if (!rows || rows.length === 0) {
      console.error("No data available for export");
      return;
    }

    // Hitung offset untuk penomoran sesuai page aktif
    const offset = (page - 1) * page_size;

    // Prepare Data for Export
    const title = ["DATAMASTER ITEM MEDIS"];
    const data: any[] = [];

    // Header Row (kosong untuk baris kedua tanpa border)
    data.push({});
    data.push({});
    data.push({
      No: "No",
      Kode: "Kode Item Medis",
      Nama: "Nama Item Medis",
      JenisItem: "Jenis Item",
      SatuanPenggunaan: "Satuan Penggunaan",
      JenisStok: "Jenis Stok",
      Manufaktur: "Manufaktur",
      BentukSediaan: "Bentuk Sediaan",
      DosisKemasan: "Dosis Kemasan",
      SatuanDosis: "Satuan Dosis",
      IsiKemasan: "Isi Kemasan",
      SatuanKemasan: "Satuan Kemasan",
      KategoriItem: "Kategori Item",
      Komposisi: "Komposisi",
      Status: "Status",
    });

    // Helper untuk konversi objek/array ke label tabel
    const toJenisStokLabels = (jenisStok: any) =>
      Array.isArray(jenisStok)
        ? jenisStok
            .map((it: any) => it?.detailStok?.name)
            .filter(Boolean)
            .join(", ")
        : "";

    const toKomposisiLabels = (ingridients: any) =>
      Array.isArray(ingridients)
        ? ingridients
            .map((it: any) => it?.name)
            .filter(Boolean)
            .join(", ")
        : "";

    for (let i = 0; i < rows.length; i++) {
      data.push({
        No: offset + i + 1,
        Kode: rows[i]?.code,
        Nama: rows[i]?.name,
        JenisItem: rows[i]?.jenisItem,
        SatuanPenggunaan: rows[i]?.satuanPenggunaan?.name || "",
        JenisStok: toJenisStokLabels(rows[i]?.jenisStok),
        Manufaktur: rows[i]?.manufacture?.name || "",
        BentukSediaan: rows[i]?.bentukSediaan?.name || "",
        DosisKemasan: rows[i]?.dosis ?? "",
        SatuanDosis: rows[i]?.satuanDosis?.name || "",
        IsiKemasan: rows[i]?.isiKemasan ?? "", // perbaiki huruf kecil
        SatuanKemasan: rows[i]?.satuanKemasan?.name || "",
        KategoriItem: rows[i]?.kategoriObat?.name || "",
        Komposisi: toKomposisiLabels(rows[i]?.ingridients),
        Status: rows[i]?.status ? "AKTIF" : "NON-AKTIF",
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
    worksheet["!cols"] = [
      { wch: 5 }, // No
      { wch: 14 }, // Kode
      { wch: 28 }, // Nama
      { wch: 12 }, // JenisItem
      { wch: 18 }, // SatuanPenggunaan
      { wch: 18 }, // JenisStok
      { wch: 18 }, // Manufaktur
      { wch: 18 }, // BentukSediaan
      { wch: 14 }, // DosisKemasan
      { wch: 16 }, // SatuanDosis
      { wch: 14 }, // IsiKemasan
      { wch: 16 }, // SatuanKemasan
      { wch: 18 }, // KategoriItem
      { wch: 24 }, // Komposisi
      { wch: 10 }, // Status
    ];

    // Apply Styles to Cells
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:D1");
    for (let row = 2; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!worksheet[cellAddress]) worksheet[cellAddress] = { v: "" };

        // Border untuk baris tabel
        if (row >= 2) {
          worksheet[cellAddress].s = worksheet[cellAddress].s || {};
          worksheet[cellAddress].s.border = {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
          };
        }

        // Align header (baris 3)
        worksheet[cellAddress].s.alignment = {
          horizontal: "center",
          vertical: "center",
        };

        // Fill header (baris 3)
        if (row === 2) {
          worksheet[cellAddress].s.fill = {
            fgColor: { rgb: "9fe2db" },
          };
        }
      }
    }

    // Append Worksheet to Workbook and Save
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datamaster Item Medis");
    XLSX.writeFile(workbook, `Datamaster Item Medis.xlsx`);
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
      Kode: "Kode Item Medis*",
      Nama: "Nama Item Medis*",
      JenisItem: "Jenis Item*",
      SatuanPenggunaan: "Satuan Penggunaan*",
      SatuanPembelian: "Satuan Pembelian*",
      JenisStok: "Jenis Stok",
      Pabrik: "Pabrik",
      BentukSediaan: "Bentuk Sediaan*",
      DosisKemasan: "Dosis Kemasan*",
      SatuanDosis: "Satuan Dosis*",
      IsiKemasan: "Isi Kemasan",
      SatuanKemasan: "Satuan Kemasan",
      KategoriItem: "Kategori Item*",
      Komposisi: "Komposisi",
    });

    // Add Empty Rows (4 empty rows to match the example)
    data.push({
      No: "1",
      Kode: "MD001",
      Nama: "Betadine",
      JenisItem: "Alkes",
      SatuanPenggunaan: "btl",
      SatuanPembelian: "btl",
      JenisStok: "bpjs",
      Pabrik: "mn1",
      BentukSediaan: "bs1",
      DosisKemasan: "500",
      SatuanDosis: "btl",
      IsiKemasan: "10",
      SatuanKemasan: "btl",
      KategoriItem: "kategori1",
      Komposisi: "KODE-001",
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

    // Apply table styling
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:F2");
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!worksheet[cellAddress]) worksheet[cellAddress] = { v: "" };

        worksheet[cellAddress].s = worksheet[cellAddress].s || {};
        // Border untuk semua sel
        worksheet[cellAddress].s.border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        };

        if (row === range.s.r) {
          // Header style
          worksheet[cellAddress].s.alignment = {
            horizontal: "center",
            vertical: "center",
          };
          worksheet[cellAddress].s.font = { bold: true };
          worksheet[cellAddress].s.fill = { fgColor: { rgb: "9fe2db" } };
        } else {
          // Center alignment untuk kolom numeric dan kolom "No"
          if (col === 0 || col === 4 || col === 5) {
            worksheet[cellAddress].s.alignment = {
              horizontal: "center",
              vertical: "center",
            };
          }
        }
      }
    }

    // Append Worksheet to Workbook and Save
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Format Datamaster Item Medis"
    );
    XLSX.writeFile(workbook, `Format Datamaster Item Medis.xlsx`);
  } catch (error) {
    console.error("Error while exporting Excel", error);
  }
};

onMounted(() => {
  fetchMedicalItem();
  fetchStockType();
});
</script>

<template>
  <div class="flex overflow-hidden flex-col h-full">
    <Card
      pt:body:class="overflow-auto pt-0 h-full"
      pt:content:class="overflow-hidden h-full"
      class="overflow-hidden h-full"
    >
      <template #header>
        <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="resetData" />
          <CustomBreadCrumb
            :home="{ label: 'Datamaster', home: true }"
            :model="[{ label: 'Item Medis' }]"
          />
          <CustomTextfield
            v-model="searchQuery"
            label="Cari Item Medis"
            prependIcon="PhMagnifyingGlass"
            placeholder="Cari Nama Item Medis (Obat / Alkes / dll)"
            @keydown.enter="searchData"
          />
          <CustomSelect
            v-model="jenisItem"
            place-holder="Pilih Jenis Item"
            label="Jenis Item"
            optionLabel="name"
            optionValue="value"
            :options="optionJenisItem"
          />
          <ToolbarFilterMenu :count="selectedFilterJenisStok.length">
            <template #label>Jenis Stok</template>
            <CustomChip
              v-for="(items, index) in StockTypePayload"
              :key="items + index"
              :label="items.name"
              :value="items.uuid"
              :isSelected="selectedFilterJenisStok.includes(items.uuid)"
              @selected="onPoliSelect"
            />
          </ToolbarFilterMenu>
          <CustomButton @click="searchData" icon="PhMagnifyingGlass" label="Cari" />
          <CustomButton
            @click="resetData"
            label="Reset"
            outlined
            borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300"
          />
          <CustomButton
            @click="openDialog('add', 'Tambah')"
            icon="PhPlus"
            label="Data"
          />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!hasData" />
        <DataTable
          v-else
          :value="MedicalItemPayload"
          v-model:selection="selectedData"
          :metaKeySelection="metaKey"
          @rowClick="onRowSelect"
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
              <div class="">No.</div>
            </template>
            <template #body="slotProps">
              <div class="">
                {{
                  (MedicalItemProperties.page - 1) *
                    MedicalItemProperties.page_size +
                  slotProps.index +
                  1
                }}
              </div>
            </template>
          </Column>
          <!-- Kode Item -->
          <Column
            field="code"
            header="Kode Item"
            headerClass="bg-opensimrs-50 font-semibold text-SM"
          ></Column>
          <!-- Nama Item Medis (Obat, Alkes, dll) -->
          <Column
            field="name"
            header="Nama Item Medis (Obat, Alkes, dll)"
            headerClass="bg-opensimrs-50 font-semibold text-SM"
          ></Column>
          <!-- Jenis Item -->
          <Column
            field="jenisItem"
            header="Jenis Item"
            headerClass="bg-opensimrs-50 font-semibold text-SM"
          ></Column>
          <!-- Jenis Stok -->
          <Column
            header="Jenis Stok"
            headerClass="bg-opensimrs-50 font-semibold text-SM"
          >
            <template #body="slotProps">
              <div class="flex items-end">
                <template v-if="Array.isArray(slotProps.data?.jenisStok)">
                  <div
                    v-for="(items, index) in slotProps.data.jenisStok"
                    :key="index"
                  >
                    <CustomChip
                      :label="items?.detailStok?.name || '-'"
                      :showCheckedIcon="false"
                      borderColor="border-opensimrs-300"
                      bgColor="bg-opensimrs-300"
                      textColor="text-white"
                      customClass="h-6"
                      class="mr-[5px]"
                    />
                  </div>
                </template>
                <template v-else>
                  <span>-</span>
                </template>
              </div>
            </template>
          </Column>
          <!-- Manufaktur -->
          <Column
            header="Manufaktur"
            headerClass="bg-opensimrs-50 font-semibold text-SM"
          >
            <template #body="slotProps">
              <div>{{ slotProps.data?.manufacture?.name || "-" }}</div>
            </template>
          </Column>
          <!-- Status -->
          <Column field="status" headerClass="bg-opensimrs-50">
            <template #header="slotProps">
              <div class="w-full font-semibold text-center text-SM">Status</div>
            </template>
            <template #body="slotProps">
              <div class="flex justify-center items-center">
                <CustomChip
                  :label="slotProps.data.status ? 'AKTIF' : 'NON-AKTIF'"
                  :textColor="
                    slotProps.data.status ? 'text-white' : 'text-[#80868d]'
                  "
                  :bgColor="
                    slotProps.data.status ? 'bg-opensimrs-300' : 'bg-white'
                  "
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
              <div class="flex gap-2.5 justify-center items-center">
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
                      `${slotProps.data.code} - ${slotProps.data.name}`,
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
        <AddMedicalItem
          v-model:isDialogVisible="MedicalItemDialog"
          :title="dialogConfig.title"
          :method="dialogConfig.method"
          :payload="dialogConfig.data"
          :dataJenisStok="StockTypePayload"
          @data-updated="fetchMedicalItem"
        />
        <DeleteMedicalItem
          v-model:isDialogVisible="DeleteMedicalItemDialog"
          :title="dialogConfig.title"
          :itemToDelete="dialogConfig.data"
          @delete="confirmDelete"
        />
      </template>
      <template #footer>
        <div class="flex justify-between">
          <div class="flex gap-2.5 items-center">
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
            <CustomButton @click="ExportExcel">
              <img src="@/assets/icons/File Export.svg" alt="" />Export
            </CustomButton>
            <CustomButton @click="downloadExcel">
              <img src="@/assets/icons/download.svg" alt="" />Download
            </CustomButton>
          </div>
          <CustomPaginator
            :key="paginatorKey"
            :rows="MedicalItemProperties.page_size"
            :totalRecords="MedicalItemProperties.total"
            :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePage"
          />
        </div>
      </template>
    </Card>
  </div>
</template>
