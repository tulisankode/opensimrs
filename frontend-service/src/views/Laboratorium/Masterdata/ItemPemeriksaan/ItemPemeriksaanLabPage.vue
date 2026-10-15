<script setup lang="ts">
import { ref, watch, onMounted, computed } from "vue";
import { utilsStore } from "@/stores/utils";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import TambahDataItem from "@/views/Laboratorium/Masterdata/ItemPemeriksaan/TambahData.vue";
import DialogNilaiRujukanAngka from "./DialogNilaiRujukanAngka.vue";
import DialogRujukanText from "./DialogRujukanText.vue";
import { useItemPemeriksaanStore } from "@/stores/datamasterLaboratorium/itemPemeriksaanLab";
import * as XLSX from "xlsx-js-style";
import DialogDelete from "../../Layout/DialogDelete.vue";
import NoData from "@/components/section/NoData.vue";

const addItemDialog = ref(false);

const nilaiRujukanText = ref(false);
const UseUtilsStore = utilsStore();
const itemPemeriksaanStore = useItemPemeriksaanStore();

const itemPemeriksaanProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});
const itemPemeriksaanPayload = ref(<any>[]);
const searchQuery = ref("");

// Fetch Data Item Pemeriksaan
const fetchItemPemeriksaan = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await itemPemeriksaanStore.getApi({
      page: itemPemeriksaanProperties.value.page,
      limit: itemPemeriksaanProperties.value.page_size,
      name: searchQuery.value,
    });
    console.log("Response", response);

    if (response && response.payload) {
      itemPemeriksaanProperties.value.total = response.payload.pagination.total;
      itemPemeriksaanPayload.value = response.payload.data;
    } else {
      itemPemeriksaanPayload.value = [];
    }
    console.log("Data Kategori Pemeriksaan", itemPemeriksaanPayload.value);
  } catch (error) {
    console.error("Failed to fetch data", error);
    itemPemeriksaanPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const hasData = computed(() => {
  return itemPemeriksaanPayload.value.length > 0;
});

//  dialog rujukan angka
const nilaiRujukanAngka = ref(false);
const dialogNilaiRujukanAngkaConfig = ref<any>({
  method: "add",
  data: null,
});
const dialogNilaiRujukanAngka = (method: string, data: any = null) => {
  dialogNilaiRujukanAngkaConfig.value = { method, data };
  nilaiRujukanAngka.value = true;
};

const dialogNilaiRujukanTextConfig = ref<any>({
  method: "add",
  data: null,
});
const dialogNilaiRujukanText = (method: string, data: any = null) => {
  dialogNilaiRujukanTextConfig.value = { method, data };
  nilaiRujukanText.value = true;
};

// Add and edit
const tambahDataDialogRef = ref();

// Fungsi untuk membuka dialog tambah data
const openAddDialog = () => {
  tambahDataDialogRef.value.resetForm(); // Reset form sebelum membuka dialog
  tambahDataDialogRef.value.editMode = false;
  tambahDataDialogRef.value.visible = true; // Buka dialog
};

// Fungsi untuk membuka dialog edit data
const editDialog = (item: any) => {
  console.log("Data item yang akan diedit:", item);
  tambahDataDialogRef.value.setValues({
    id: item.uuid,
    code: item.code,
    name: item.name,
    noUrut: item.noUrut,
    categoryPemeriksaanUuid: item.categoryPemeriksaan?.uuid,
    satuan: item.satuan,
    metode: item.metode,
    jenisInput: item.jenisInput,
    loinc: item.loincUuid,
    icd9: item.icd9Uuid,
    snomedCT: item.snomedUuid,
    status: item.status,
    statusNilaiRujukan: item.statusNilaiRujukan,
    pilihanHasilItemPemeriksaans:
      item.pilihanHasilItemPemeriksaan?.pilihanHasil || [],
  });
  tambahDataDialogRef.value.editMode = true;
  tambahDataDialogRef.value.visible = true;
};

const submitData = async (payload: any) => {
  UseUtilsStore.setLoading(true);
  try {
    const formattedPayload = {
      ...payload,
      categoryPemeriksaanUuid: payload.kategoriPemeriksaan,
      loincUuid: payload.loinc || null,
      icd9Uuid: payload.icd9 || null,
      snomedUuid: payload.snomedCT || null,
      pilihanHasilItemPemeriksaans: payload.pilihanHasilItemPemeriksaans || [],
    };

    let response;
    if (payload.id) {
      response = await itemPemeriksaanStore.putApi(
        payload.id,
        formattedPayload
      );
    } else {
      response = await itemPemeriksaanStore.postApi(formattedPayload);
    }

    if (response) {
      await fetchItemPemeriksaan();
      tambahDataDialogRef.value.visible = false;
    }
  } catch (error) {
    console.error("Error submitting data", error);
  } finally {
    UseUtilsStore.setLoading(false);
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
    UseUtilsStore.setLoading(true);
    try {
      await itemPemeriksaanStore.deleteApi(item.uuid);
      fetchItemPemeriksaan();
    } catch (error) {
      console.error("Failed to delete data", error);
    } finally {
      UseUtilsStore.setLoading(false);
      isDeleteDialogVisible.value = false;
    }
  }
};

// Reset Data
const resetForm = () => {
  tambahDataDialogRef.value?.resetForm();
};

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, (newValue) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetchItemPemeriksaan();
  }, 500);
});

// Handle Page
const handlePage = (event: any) => {
  itemPemeriksaanProperties.value.page = event.page + 1;
  itemPemeriksaanProperties.value.page_size = event.rows;
  fetchItemPemeriksaan();
};

// Import Excel
const onUpload = (event: any) => {
  const uploadedFiles = event.files[0]; // Ambil file yang diunggah
  importExcel(uploadedFiles);
};

const importExcel = async (file: File) => {
  const dataUpload = new FormData();
  dataUpload.append("file", file);
  try {
    const response = await itemPemeriksaanStore.importApi(dataUpload);
    fetchItemPemeriksaan();
    console.log("File uploaded successfully:", response);
  } catch (error) {
    console.error("Error uploading file:", error);
  }
};

const downloadFormatExcel = async () => {
  try {
    // Prepare Data for Export - Item Pemeriksaan Sheet
    const itemPemeriksaanData = [];

    // Header Row for Item Pemeriksaan
    itemPemeriksaanData.push({
      No: "No",
      "Kode Item Pemeriksaan*": "Kode Item Pemeriksaan*",
      "Nama Item Pemeriksaan*": "Nama Item Pemeriksaan*",
      "No Urut*": "No Urut*",
      "Kategori Pemeriksaan*": "Kategori Pemeriksaan*",
      Satuan: "Satuan",
      Metode: "Metode",
      "Jenis Input*": "Jenis Input*",
      "Pilihan Hasil": "Pilihan Hasil",
      "Snomed-CT": "Snomed-CT",
      "ICD 9 - CM": "ICD 9 - CM",
      "LOINC*": "LOINC*",
      "Status Nilai Rujukan*": "Status Nilai Rujukan*",
    });

    // Example data rows for Item Pemeriksaan
    itemPemeriksaanData.push({
      No: "1.0",
      "Kode Item Pemeriksaan*": "HP-001",
      "Nama Item Pemeriksaan*": "Hemoglobin Parsial",
      "No Urut*": "1.0",
      "Kategori Pemeriksaan*": "HMT-009",
      Satuan: "g/dl",
      Metode: "Colorimatic",
      "Jenis Input*": "angka",
      "Pilihan Hasil": "",
      "Snomed-CT": "snomed-007",
      "ICD 9 - CM": "icd9-006",
      "LOINC*": "Loinc98-001",
      "Status Nilai Rujukan*": "true",
    });

    itemPemeriksaanData.push({
      No: "2.0",
      "Kode Item Pemeriksaan*": "HL-009",
      "Nama Item Pemeriksaan*": "Hemtokrit Lengkap",
      "No Urut*": "2.0",
      "Kategori Pemeriksaan*": "KKL-002",
      Satuan: "%",
      Metode: "Impedance",
      "Jenis Input*": "angka",
      "Pilihan Hasil": "",
      "Snomed-CT": "",
      "ICD 9 - CM": "icd9-007",
      "LOINC*": "Loinc98-002",
      "Status Nilai Rujukan*": "false",
    });

    const nilaiRujukanData = [
      // Main Header Row
      [
        "No",
        "Kode Item Pemeriksaan*",
        "Jenis Kelamin*",
        "Umur Bawah*",
        "",
        "",
        "Umur Atas*",
        "",
        "",
        "Nilai Normal Angka",
        "",
        "",
        "Kritis Bawah",
        "",
        "Kritis Atas",
        "",
        "Nilai Normal Text",
        "Status",
      ],
      // Sub Header Row
      [
        "",
        "",
        "",
        "Tahun",
        "Bulan",
        "Hari",
        "Tahun",
        "Bulan",
        "Hari",
        "Batas Bawah",
        "Operator Nilai Normal",
        "Batas Atas",
        "Kritis Bawah",
        "Operator Kritis Bawah",
        "Kritis Atas",
        "Operator Kritis Atas",
        "",
        "",
      ],
      // Data Rows
      [
        "1",
        "HP-001",
        "Perempuan",
        "5",
        "1",
        "7",
        "20",
        "9",
        "4",
        "3",
        "-",
        "4",
        "7",
        "<",
        "5",
        ">",
        "",
        "true",
      ],
      [
        "2",
        "HP-001",
        "Laki-laki",
        "6",
        "5",
        "5",
        "12",
        "2",
        "2",
        "5",
        "-",
        "6",
        "8",
        ">",
        "6",
        ">",
        "",
        "false",
      ],
      [
        "3",
        "RR-005",
        "Perempuan",
        "7",
        "2",
        "2",
        "3",
        "3",
        "3",
        "",
        "<",
        "7",
        "5",
        "<",
        "7",
        "<",
        "",
        "true",
      ],
      [
        "4",
        "LL-002",
        "Perempuan",
        "19",
        "6",
        "3",
        "5",
        "6",
        "5",
        "1",
        "-",
        "3",
        "6",
        ">",
        "8",
        "<",
        "",
        "true",
      ],
      [
        "5",
        "DD-001",
        "General",
        "0",
        "0",
        "0",
        "9999",
        "0",
        "0",
        "19",
        ">",
        "",
        "9",
        "<",
        "9",
        ">",
        "",
        "true",
      ],
      [
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "Negative,Negatif",
        "",
      ],
    ];

    const nilaiRujukanWS = XLSX.utils.aoa_to_sheet(nilaiRujukanData);

    // Set merged cells exactly as in the example file
    nilaiRujukanWS["!merges"] = [
      // Merge Umur Bawah* header (D1:F1)
      { s: { r: 0, c: 3 }, e: { r: 0, c: 5 } },
      // Merge Umur Atas* header (G1:I1)
      { s: { r: 0, c: 6 }, e: { r: 0, c: 8 } },
      // Merge Nilai Normal Angka header (J1:L1)
      { s: { r: 0, c: 9 }, e: { r: 0, c: 11 } },
      // Merge Kritis Bawah header (M1:N1)
      { s: { r: 0, c: 12 }, e: { r: 0, c: 13 } },
      // Merge Kritis Atas header (O1:P1)
      { s: { r: 0, c: 14 }, e: { r: 0, c: 15 } },
    ];

    // Set column widths for better formatting
    nilaiRujukanWS["!cols"] = [
      { wch: 5 }, // No
      { wch: 20 }, // Kode Item Pemeriksaan*
      { wch: 15 }, // Jenis Kelamin*
      { wch: 8 }, // Tahun (Umur Bawah)
      { wch: 8 }, // Bulan
      { wch: 8 }, // Hari
      { wch: 8 }, // Tahun (Umur Atas)
      { wch: 8 }, // Bulan
      { wch: 8 }, // Hari
      { wch: 12 }, // Batas Bawah
      { wch: 8 }, // Operator Nilai Normal
      { wch: 10 }, // Batas Atas
      { wch: 12 }, // Kritis Bawah
      { wch: 8 }, // Operator Kritis Bawah
      { wch: 10 }, // Kritis Atas
      { wch: 8 }, // Operator Kritis Atas
      { wch: 20 }, // Nilai Normal Text
      { wch: 8 }, // Status
    ];

    // Create Workbook and Worksheets
    const workbook = XLSX.utils.book_new();

    // Add Item Pemeriksaan sheet
    const itemPemeriksaanSheet = XLSX.utils.json_to_sheet(itemPemeriksaanData, {
      skipHeader: true,
    });
    XLSX.utils.book_append_sheet(
      workbook,
      itemPemeriksaanSheet,
      "Item Pemeriksaan"
    );

    // Add Nilai Rujukan sheet
    const nilaiRujukanSheet = XLSX.utils.json_to_sheet(nilaiRujukanData, {
      skipHeader: true,
    });
    XLSX.utils.book_append_sheet(workbook, nilaiRujukanSheet, "Nilai Rujukan");

    // Set column widths
    const setColumnWidths = (sheet: any, data: any[]) => {
      const colWidths = data.reduce((widths: any, row: any) => {
        Object.keys(row).forEach((key, colIdx) => {
          const cellValue = row[key] ? row[key].toString() : "";
          widths[colIdx] = Math.max(widths[colIdx] || 10, cellValue.length + 2);
        });
        return widths;
      }, []);

      sheet["!cols"] = colWidths.map((wch: any) => ({ wch }));
    };

    setColumnWidths(itemPemeriksaanSheet, itemPemeriksaanData);
    setColumnWidths(nilaiRujukanSheet, nilaiRujukanData);

    // Save the workbook
    XLSX.writeFile(workbook, `Format Import Master Item Pemeriksaan.xlsx`);
  } catch (error) {
    console.error("Error while exporting Excel", error);
  }
};
onMounted(async () => {
  await fetchItemPemeriksaan();
});

const jenisInput = ref();
const optionJenisInput = ref([
  { label: "Angka", value: "1" },
  { label: "Text", value: "2" },
  { label: "Long Text", value: "3" },
  { label: "Pilihan", value: "4" },
]);

console.log("jenis input", optionJenisInput.value);
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
          <CustomButton icon="PhArrowClockwise" @click="fetchItemPemeriksaan" />
          <CustomBreadCrumb :home="{ label: 'Datamaster', home: true }" />
          <PhCaretRight :size="16" weight="bold" class="shrink-0 text-opensimrs-300" aria-hidden="true" />
          <h1 class="toolbar-heading text-opensimrs-300">Item Pemeriksaan</h1>
          <CustomTextfield
            v-model="searchQuery"
            label="Cari Item Pemeriksaan"
            prependIcon="PhMagnifyingGlass"
            placeholder="Cari Item Pemeriksaan"
          />
          <CustomButton @click="openAddDialog" icon="PhPlus" label="Data" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!hasData" />
        <DataTable
          :value="itemPemeriksaanPayload"
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
                  (itemPemeriksaanProperties.page - 1) *
                    itemPemeriksaanProperties.page_size +
                  slotProps.index +
                  1
                }}
              </div>
            </template>
          </Column>
          <Column
            field="kodeItem"
            header="Kode Item"
            headerClass="bg-opensimrs-50"
            class=""
          >
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.code }}</div>
            </template>
          </Column>
          <Column
            field="namaItem"
            header="Nama Item"
            headerClass="bg-opensimrs-50"
            class=""
          >
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.name }}</div>
            </template>
          </Column>
          <Column
            field="kategori"
            header="Kategori"
            headerClass="bg-opensimrs-50"
            class=""
          >
            <template #body="slotProps">
              <div class="text-SM">
                {{ slotProps.data.categoryPemeriksaan?.name || "N/A" }}
              </div>
            </template>
          </Column>
          <Column
            field="satuan"
            header="Satuan"
            headerClass="bg-opensimrs-50"
            class=""
          >
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.satuan }}</div>
            </template>
          </Column>
          <Column
            field="metode"
            header="Metode"
            headerClass="bg-opensimrs-50"
            class=""
          >
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.metode }}</div>
            </template>
          </Column>
          <Column
            headerClass="bg-opensimrs-50 font-semibold text-SM"
            class="w-[10%]"
          >
            <template #header>
              <div class="w-full text-center">No. Urut</div>
            </template>
            <template #body="slotProps">
              <div class="flex items-center justify-center text-SM">
                {{ slotProps.data.noUrut }}
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
                  v-if="
                    slotProps.data.jenisInput === 'angka' &&
                    slotProps.data.statusNilaiRujukan
                  "
                  icon="PhListNumbers"
                  class="h-6 w-[26px] p-0"
                  background-color="rounded-lg bg-opensimrs-300"
                  @click="dialogNilaiRujukanAngka('detail', slotProps.data)"
                />
                <CustomButton
                  v-if="
                    slotProps.data.jenisInput === 'angka' &&
                    !slotProps.data.statusNilaiRujukan
                  "
                  icon="PhListNumbers"
                  class="h-6 w-[26px] p-0"
                  background-color="rounded-lg bg-gray-300"
                  disabled
                />

                <CustomButton
                  v-if="
                    slotProps.data.jenisInput !== 'angka' &&
                    slotProps.data.statusNilaiRujukan
                  "
                  icon="PhListNumbers"
                  class="h-6 w-[26px] p-0"
                  background-color="rounded-lg bg-opensimrs-300"
                  @click="dialogNilaiRujukanText('detail', slotProps.data)"
                />
                <CustomButton
                  v-if="
                    slotProps.data.jenisInput !== 'angka' &&
                    !slotProps.data.statusNilaiRujukan
                  "
                  icon="PhListNumbers"
                  class="h-6 w-[26px] p-0"
                  background-color="rounded-lg bg-gray-300"
                  disabled
                />
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
            <CustomButton label="Eksport">
              <img src="@/assets/icons/File Import.svg" alt="" />Eksport
            </CustomButton>
            <CustomButton label="Eksport" @click="downloadFormatExcel">
              <img src="@/assets/icons/download.svg" alt="" />Download
            </CustomButton>
          </div>
          <CustomPaginator
            :rows="itemPemeriksaanProperties.page_size"
            :totalRecords="itemPemeriksaanProperties.total"
            :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePage"
          />
        </div>
      </template>
    </Card>

    <!-- nilaiRujukanAngka Dialog -->
    <DialogNilaiRujukanAngka
      v-model:isDialogVisible="nilaiRujukanAngka"
      :method="dialogNilaiRujukanAngkaConfig.method"
      :payload="dialogNilaiRujukanAngkaConfig.data"
    />

    <DialogRujukanText
      v-model:isDialogVisible="nilaiRujukanText"
      :method="dialogNilaiRujukanTextConfig.method"
      :payload="dialogNilaiRujukanTextConfig.data"
    />

    <TambahDataItem
      ref="tambahDataDialogRef"
      @submit="submitData"
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
