<script setup lang="ts">
import { ref, onMounted, watch, computed } from "vue";
import { utilsStore } from "@/stores/utils";
import { useForm, ErrorMessage } from "vee-validate";
import * as yup from "yup";
import { toTypedSchema } from "@vee-validate/yup";
import { useKategoriPemeriksaanStore } from "@/stores/datamasterLaboratorium/kategoriPemeriksaan";
import * as XLSX from "xlsx-js-style";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import DialogDelete from "@/views/Laboratorium/Layout/DialogDelete.vue";
import NoData from "@/components/section/NoData.vue";

const storeUtils = utilsStore();
const kategoriPemeriksaanPayload = ref<any[]>([]);
const addKategoriDialog = ref(false);
const kategoriPemeriksaanStore = useKategoriPemeriksaanStore();
const kategoriPemeriksaanProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});
const searchQuery = ref<string>("");

const openDialogData = () => {
  resetForm();
  addKategoriDialog.value = true;
};

const isEditMode = computed(() => editKategoriDialog.value);

const schema = toTypedSchema(
  yup.object({
    code: yup
      .string()
      .required("Kode harus diisi")
      .test("is-unique-code", "Kode sudah digunakan", (value) => {
        if (!value) return true;
        const duplicate = kategoriPemeriksaanPayload.value.find(
          (item) =>
            item.code === value &&
            (!isEditMode.value || item.uuid !== selectedKategori.value?.uuid)
        );
        return !duplicate;
      }),
    name: yup.string().required("Nama harus diisi"),
    noUrut: yup
      .number()
      .typeError("No Urut harus angka")
      .required("No Urut harus diisi")
      .test("is-unique-nourut", "No Urut sudah digunakan", (value) => {
        if (value === undefined || value === null) return true;
        const duplicate = kategoriPemeriksaanPayload.value.find(
          (item) =>
            item.noUrut === value &&
            (!isEditMode.value || item.uuid !== selectedKategori.value?.uuid)
        );
        return !duplicate;
      }),
    status: yup.boolean().default(true),
  })
);

const { handleSubmit, defineField, resetForm, errors } = useForm({
  validationSchema: schema,
});
const [kodeKategoriPemeriksaan] = defineField("code");
const [namaKategoriPemeriksaan] = defineField("name");
const [noUrut] = defineField("noUrut");
const [status] = defineField("status");

// Fetch Data Kategori Pemeriksaan
const fetchKategoriPemeriksaan = async () => {
  storeUtils.setLoading(true);
  try {
    const response = await kategoriPemeriksaanStore.getApi({
      page: kategoriPemeriksaanProperties.value.page,
      limit: kategoriPemeriksaanProperties.value.page_size,
      name: searchQuery.value,
    });
    console.log("Response", response);

    if (response && response.payload) {
      kategoriPemeriksaanProperties.value.total =
        response.payload.pagination.total;
      kategoriPemeriksaanPayload.value = response.payload.data;
    } else {
      kategoriPemeriksaanPayload.value = [];
    }
    console.log("Data Kategori Pemeriksaan", kategoriPemeriksaanPayload.value);
    resetForm();
  } catch (error) {
    console.error("Failed to fetch data", error);
    kategoriPemeriksaanPayload.value = [];
  } finally {
    storeUtils.setLoading(false);
  }
};

const onSubmit = handleSubmit(async (values) => {
  storeUtils.setLoading(true);
  try {
    if (isEditMode.value && selectedKategori.value?.uuid) {
      await kategoriPemeriksaanStore.putApi(
        selectedKategori.value.uuid,
        values
      );
    } else {
      await kategoriPemeriksaanStore.postApi(values);
    }

    editKategoriDialog.value = false;
    addKategoriDialog.value = false;
    await fetchKategoriPemeriksaan();
    resetForm();
  } catch (error) {
    console.error("Error submit data", error);
  } finally {
    storeUtils.setLoading(false);
  }
});

// Edit Data
const editKategoriDialog = ref(false);
const selectedKategori = ref<any>(null);

const openEditDialog = (kategori: any) => {
  selectedKategori.value = kategori;
  kodeKategoriPemeriksaan.value = kategori.code;
  namaKategoriPemeriksaan.value = kategori.name;
  noUrut.value = kategori.noUrut;
  status.value = kategori.status;
  editKategoriDialog.value = true;
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
      await kategoriPemeriksaanStore.deleteApi(item.uuid);
      fetchKategoriPemeriksaan();
    } catch (error) {
      console.error("Failed to delete data", error);
    } finally {
      storeUtils.setLoading(false);
      isDeleteDialogVisible.value = false;
    }
  }
};

// Check if there is data to display
const hasData = computed(() => {
  return kategoriPemeriksaanPayload.value.length > 0;
});

// Reset Data
// const resetForm = () => {
//   kodeKategoriPemeriksaan.value = "";
//   namaKategoriPemeriksaan.value = "";
//   noUrut.value = 0;
//   status.value = true;
// };

// Handle Pagination
const handlePage = (event: any) => {
  kategoriPemeriksaanProperties.value.page = event.page + 1;
  kategoriPemeriksaanProperties.value.page_size = event.rows;
  fetchKategoriPemeriksaan();
};

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, (newValue) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetchKategoriPemeriksaan();
  }, 500);
});

// Import Excel
const onUpload = (event: any) => {
  const uploadedFiles = event.files[0]; // Ambil file yang diunggah
  importExcel(uploadedFiles);
};

const importExcel = async (file: File) => {
  const dataUpload = new FormData();
  dataUpload.append("file", file);
  try {
    const response = await kategoriPemeriksaanStore.importApi(dataUpload);
    fetchKategoriPemeriksaan();
    console.log("File uploaded successfully:", response);
  } catch (error) {
    console.error("Error uploading file:", error);
  }
};

// Export Excel
const ExportExcel = async () => {
  try {
    const response = await kategoriPemeriksaanStore.getApi({
      page: kategoriPemeriksaanProperties.value.page,
      limit: kategoriPemeriksaanProperties.value.page_size,
      name: searchQuery.value,
    });
    const rows = response.payload.data;
    console.log("rows", rows);
    if (!rows || rows.length === 0) {
      console.error("No data available for export");
      return;
    }

    // Prepare Data for Export
    const title = ["DATAMASTER KATEGORI PEMERIKSAAN"];
    const data = [];

    // Header Row (Kosong untuk baris kedua tanpa border)
    data.push({});
    data.push({});
    data.push({
      No: "No",
      Kode: "Kode Spesimen",
      Nama: "Nama Spesimen",
      NoUrut: "No. Urut",
      Status: "Status",
    });

    // Data Rows
    for (let i = 0; i < rows.length; i++) {
      data.push({
        No: i + 1,
        Kode: rows[i].code,
        Nama: rows[i].name,
        NoUrut: rows[i].noUrut,
        Status: rows[i].status ? "AKTIF" : "NON-AKTIF",
      });
    }

    // Create Workbook and Worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: true });

    // Add Title and Merge Cells
    XLSX.utils.sheet_add_aoa(worksheet, [title], { origin: "A1" });
    worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];

    // Style Title
    worksheet["A1"].s = {
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true, sz: 14 },
    };

    // Column Widths
    worksheet["!cols"] = [{ wch: 5 }, { wch: 10 }, { wch: 30 }, { wch: 10 }];

    // Apply Styles to Cells
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:E1");

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
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Datamaster Kategori Pemeriksaan"
    );
    XLSX.writeFile(workbook, `Datamaster Kategori Pemeriksaan.xlsx`);
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
      Kode: "Kode Kategori Pemeriksaa*",
      Nama: "Nama Kategori Pemeriksaan*",
      NoUrut: "No Urut*",
    });

    // Add Empty Rows (4 empty rows to match the example)
    data.push({ No: "1", Kode: "HMT-001", Nama: "Hematologi", NoUrut: 1 });

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
    const range = XLSX.utils.decode_range("A1:D5");

    // Append Worksheet to Workbook and Save
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kategori Pemeriksaan");
    XLSX.writeFile(workbook, `Format Datamaster Kategori Pemeriksaan.xlsx`);
  } catch (error) {
    console.error("Error while exporting Excel", error);
  }
};

onMounted(async () => {
  await fetchKategoriPemeriksaan();
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
          <CustomButton icon="PhArrowClockwise" @click="fetchKategoriPemeriksaan" />
          <CustomBreadCrumb :home="{ label: 'Datamaster', home: true }" />
          <PhCaretRight :size="16" weight="bold" class="shrink-0 text-opensimrs-300" aria-hidden="true" />
          <h1 class="toolbar-heading text-opensimrs-300">Kategori Pemeriksaan</h1>
          <CustomTextfield
            v-model="searchQuery"
            label="Cari Kategori Pemeriksaan"
            prependIcon="PhMagnifyingGlass"
            placeholder="Cari Kategori Pemeriksaan"
          />
          <CustomButton @click="openDialogData" icon="PhPlus" label="Data" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!hasData" />
        <DataTable
          :value="kategoriPemeriksaanPayload"
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
                  (kategoriPemeriksaanProperties.page - 1) *
                    kategoriPemeriksaanProperties.page_size +
                  slotProps.index +
                  1
                }}
              </div>
            </template>
          </Column>
          <Column
            field="code"
            header="Kode Kategori Pemeriksaan"
            headerClass="bg-opensimrs-50"
            class="w-[25%]"
          >
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.code }}</div>
            </template>
          </Column>
          <Column
            field="namaKategoriPemeriksaan"
            header="Nama Kategori Pemeriksaan"
            headerClass="bg-opensimrs-50"
            class="w-[55%]"
          >
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.name }}</div>
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
                  class="h-6 w-[26px] p-0"
                  @click="openEditDialog(slotProps.data)"
                >
                  <img src="@/assets/icons/edit.svg" alt="edit" />
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
            :rows="kategoriPemeriksaanProperties.page_size"
            :totalRecords="kategoriPemeriksaanProperties.total"
            :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePage"
          />
        </div>
      </template>
    </Card>

    <!-- addKategoriDialog -->
    <CustomDialog
      v-model:visible="addKategoriDialog"
      :style="{ width: '600px' }"
    >
      <template #header>
        <div class="grid grid-cols-1">
          <p>Tambah Data Kategori Pemeriksaan</p>
        </div>
      </template>
      <template #body>
        <div class="grid grid-cols-[35%,45%,10%] gap-3">
          <div class="mt-[20px]">
            <CustomTextfield
              v-model="kodeKategoriPemeriksaan"
              label="Kode Kategori Pemeriksaan"
              placeholder="Kode Kategori Pemeriksaan"
              class="mr-2"
              :error="errors.code"
            />
            <ErrorMessage name="code" class="text-xs text-red-500" />
          </div>
          <div class="mt-[20px]">
            <CustomTextfield
              v-model="namaKategoriPemeriksaan"
              label="Nama Kategori Pemeriksaan"
              placeholder="Nama Kategori Pemeriksaan"
              class="mr-2"
              :error="errors.name"
            />
            <ErrorMessage name="name" class="text-xs text-red-500" />
          </div>
          <div class="mt-[20px]">
            <CustomInputNumber
              v-model="noUrut"
              label="No. Urut"
              :show-buttons="false"
              class="text-center"
              :error="errors.noUrut"
            />
            <ErrorMessage name="noUrut" class="text-xs text-red-500" />
          </div>
        </div>

        <hr class="mt-[20px] border border-slate-200" />
        <div class="grid grid-cols-1 mt-[15px]">
          <div>
            <CustomSwitch
              v-model="status"
              :show-label="true"
              label="Status"
              sideLabel="NON-AKTIF"
              sideLabelTrue="AKTIF"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="w-full">
          <!-- <hr class="-mx-5 border-grey-200" /> -->
          <div class="mt-5 flex justify-end gap-2.5">
            <CustomButton
              label="Reset"
              textColor="text-grey-300"
              backgroundColor="bg-transparent"
              borderColor="border-2 border-grey-200"
              @click="resetForm"
            />
            <CustomButton label="Simpan" @click="onSubmit" />
          </div>
        </div>
      </template>
    </CustomDialog>

    <!-- editKategoriDialog -->
    <CustomDialog
      v-model:visible="editKategoriDialog"
      :style="{ width: '600px' }"
    >
      <template #header>
        <div class="grid grid-cols-1">
          <p>Edit Data Kategori Pemeriksaan</p>
        </div>
      </template>
      <template #body>
        <div class="grid grid-cols-[35%,45%,10%] gap-3">
          <div class="mt-[20px]">
            <CustomTextfield
              v-model="kodeKategoriPemeriksaan"
              label="Kode Kategori Pemeriksaan"
              placeholder="Kode Kategori Pemeriksaan"
              class="mr-2"
              :error="errors.code"
            />
            <ErrorMessage name="code" class="text-xs text-red-500" />
          </div>
          <div class="mt-[20px]">
            <CustomTextfield
              v-model="namaKategoriPemeriksaan"
              label="Nama Kategori Pemeriksaan"
              placeholder="Nama Kategori Pemeriksaan"
              class="mr-2"
              :error="errors.name"
            />
            <ErrorMessage name="name" class="text-xs text-red-500" />
          </div>
          <div class="mt-[20px]">
            <CustomInputNumber
              v-model="noUrut"
              label="No. Urut"
              :show-buttons="false"
              class="text-center"
              :error="errors.noUrut"
            />
            <ErrorMessage name="noUrut" class="text-xs text-red-500" />
          </div>
        </div>

        <hr class="mt-[20px] border border-slate-200" />
        <div class="grid grid-cols-1 mt-[15px]">
          <div>
            <CustomSwitch
              v-model="status"
              :show-label="true"
              label="Status"
              sideLabel="NON-AKTIF"
              sideLabelTrue="AKTIF"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="w-full">
          <div class="mt-5 flex justify-end gap-2.5">
            <CustomButton
              label="Batal"
              textColor="text-grey-300"
              backgroundColor="bg-transparent"
              borderColor="border-2 border-grey-200"
              @click="editKategoriDialog = false"
            />
            <CustomButton label="Simpan" @click="onSubmit" />
          </div>
        </div>
      </template>
    </CustomDialog>

    <DialogDelete
      v-model:isDialogVisible="isDeleteDialogVisible"
      :title="dialogConfig.title"
      :itemToDelete="dialogConfig.data"
      @delete="confirmDelete"
    />
  </div>
</template>
