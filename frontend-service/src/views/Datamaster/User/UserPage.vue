<script lang="ts" setup>
import { ref, onMounted, computed, watch, onBeforeMount } from "vue";
import { useRoute, onBeforeRouteLeave } from "vue-router";
import * as XLSX from "xlsx-js-style";
import type { MenuItem } from "primevue/menuitem";
import { useUserStore } from "@/stores/user";
import { utilsStore } from "@/stores/utils";
import { useRoleStore } from "@/stores/datamaster/role";
import { useAuthStore } from "@/stores/auth";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import HeaderFilter from "../Layout/HeaderFilter.vue";
import TambahDataUserPage from "./TambahDataUserPage.vue";
import FooterPaginator from "../Layout/FooterPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import DetailUser from "./DetailUser.vue";
import DialogDelete from "../Layout/DialogDelete.vue";
//Breadcumb section
const headerFilterRef = ref<typeof HeaderFilter>();
const resetFilter = () => {
  headerFilterRef.value?.resetFilter();
};
const authStore = useAuthStore();
const pageType = ref("");
const route = useRoute();
const dataBreadCrumb = ref<MenuItem[]>([]);

const changeSection = (
  label: string,
  mode: string = "add",
  data: any = null
) => {
  let tempData = { label: label, mode: mode, data: data };
  if (dataBreadCrumb.value.length) {
    dataBreadCrumb.value[0] = tempData;
  } else {
    dataBreadCrumb.value.push(tempData);
  }
};

const updatePageType = (path: string) => {
  resetFilter();
  dataBreadCrumb.value = [];
  let tempArrPath = path.split("/");
  pageType.value = tempArrPath[2] ?? "";
};
onBeforeRouteLeave((to, from) => {
  updatePageType(to.path);
});
onMounted(() => {
  updatePageType(route.path);
});

// Filter
const searchQuery = ref<string>("");
const selectedRole = ref("");

const handleSearchQuery = (searchValue: string) => {
  searchQuery.value = searchValue;
};
const handleSelectedRole = (selectedValue: any) => {
  selectedRole.value = selectedValue;
};
const handleReset = () => {
  resetForm();
  fetchUserData();
};

const resetFormRef = ref();

const resetForm = () => {
  searchQuery.value = "";
  selectedRole.value = "";
  resetFormRef.value.resetForm();
};

const userStore = useUserStore();
const roleStore = useRoleStore();
const UseUtilsStore = utilsStore();
const userPayload = ref<any[]>([]);
const userProperties = ref({
  page: 0,
  page_size: 10,
  total: 0,
});
const rolePayload = ref<any[]>([]);

// Fetch User Data from API
const fetchUserData = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await userStore.getApi({
      page: userProperties.value.page,
      limit: userProperties.value.page_size,
      name: searchQuery.value,
      role: selectedRole.value || undefined,
    });

    if (response && response.payload) {
      userProperties.value.total = response.properties.totalItem;
      userPayload.value = response.payload;
    } else {
      userPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    userPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// Handle Page Change
const handlePage = (event: any) => {
  userProperties.value.page = event.page;
  userProperties.value.page_size = event.rows;
  fetchUserData();
};

const fetchRole = async () => {
  try {
    const response = await roleStore.getAktifApi();
    if (response && response.payload) {
      rolePayload.value = response.payload;
    } else {
      rolePayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch role", error);
    rolePayload.value = [];
  }
};

const faskesUuid = computed(() => {
  return authStore.getFaskesUuid;
});

watch(
  faskesUuid,
  (newValue, oldValue) => {
    fetchUserData();
  },
  { immediate: true }
);

onMounted(() => {
  fetchUserData();
  fetchRole();
});

const hasData = computed(
  () => userPayload.value && userPayload.value.length > 0
);

const metaKey = ref(true);
const selectedData = ref();

const onRowSelect = (event: any) => {
  if (event.data) {
    selectedData.value = event.data;
    changeSection("Detail");
  }
};
const isTambahDataDialogVisible = ref(false);
const isDeleteDialogVisible = ref(false);

const dialogConfig = ref<any>({
  method: "add",
  title: "Tambah Data",
  data: null,
});
const deleteDialog = (method: string, title: string, data: any = null) => {
  dialogConfig.value = { method, title, data };
  isDeleteDialogVisible.value = true;
};

const confirmDelete = async (item: any) => {
  if (item) {
    UseUtilsStore.setLoading(true);
    try {
      await userStore.deleteApi(item.uuid);
      fetchUserData();
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
    const response = await userStore.exportApi();
    const rows = response.payload;
    if (!rows || rows.length === 0) {
      console.error("No data available for export");
      return;
    }

    // Prepare Data for Export
    const title = ["DATAMASTER USER"];
    const data = [];

    // Header Row (Kosong untuk baris kedua tanpa border)
    data.push({});
    data.push({});
    data.push({
      No: "No",
      Username: "Username",
      Email: "Email",
      Phone: "Phone",
      Status: "Status",
    });

    // Data Rows
    for (let i = 0; i < rows.length; i++) {
      data.push({
        No: i + 1,
        Username: rows[i].username,
        Email: rows[i].email,
        Phone: rows[i].phone ?? '-',
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
    const columnWidths = data.reduce((widths: any, row: any) => {
      Object.keys(row).forEach((key, colIdx) => {
        const cellValue = row[key] ? row[key].toString() : "";
        widths[colIdx] = Math.max(widths[colIdx] || 10, cellValue.length + 2);
      });
      return widths;
    }, []);

    worksheet["!cols"] = columnWidths.map((wch: any) => ({ wch }));

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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datamaster User");
    XLSX.writeFile(workbook, `Datamaster User.xlsx`);
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
      Role: "Role*",
      Username: "Username*",
      Password: "Password*",
      Email: "Email*",
      TipePraktisi: "Tipe Praktisi*",
      KodeHFIS: "Kode HFIS (BPJS)",
      SIP: "SIP",
      STR: "STR",
      KodeAntrian: "Kode Antrian Dokter",
      TipePegawai: "Tipe Pegawai*",
      GelarAwal: "Gelar Awal*",
      GelarAkhir: "Gelar Akhir*",
      NamaPegawai: "Nama Pegawai*",
      NIK: "NIK*",
      TanggalLahir: "Tanggal Lahir*",
      JenisKelamin: "Jenis Kelamin*",
    });

    // Add Empty Rows (4 empty rows to match the example)

    data.push({
      No: "1",
      Role: "dokter spesialis",
      Username: "dokteradam",
      Password: "dokteradam123",
      Email: "email@contoh.id",
      TipePraktisi: "Dokter",
      KodeHFIS: "BPJS-001",
      SIP: "12345",
      STR: "1234567890",
      KodeAntrian: "A01",
      TipePegawai: "1",
      GelarAwal: "dr",
      GelarAkhir: "Sp.An",
      NamaPegawai: "dr. Adam,Sp.An",
      NIK: "9999010101010001",
      TanggalLahir: "7/1/2003",
      JenisKelamin: "Laki-laki",
    });
    data.push({
      No: "2",
      Role: "admin lab",
      Username: "analisadam",
      Password: "analisadam123",
      Email: "email@contoh.id",
      TipePraktisi: "Non-Dokter",
      KodeHFIS: "-",
      SIP: "54321",
      STR: "9876543210",
      KodeAntrian: "-",
      TipePegawai: "2",
      GelarAwal: "-",
      GelarAkhir: "-",
      NamaPegawai: "Analis Adam",
      NIK: "9999010101010002",
      TanggalLahir: "12/26/2004",
      JenisKelamin: "Perempuan",
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
    XLSX.writeFile(workbook, `Format Datamaster User.xlsx`);
  } catch (error) {
    console.error("Error while exporting Excel", error);
  }
};
const handleFileUpload = async (file: File) => {
  const dataUpload = new FormData();
  dataUpload.append("file", file);
  try {
    const response = await userStore.importApi(dataUpload); // Panggil fungsi importApi dengan formData
    fetchUserData();
    console.log("File uploaded successfully:", response);
  } catch (error) {
    console.error("Error uploading file:", error);
  }
};
</script>

<template>
  <Card
    v-if="dataBreadCrumb.length == 0"
    pt:body:class="h-full pt-0 overflow-auto"
    pt:content:class="h-full overflow-auto"
    class=""
  >
    <template #header>
      <HeaderFilter
        page-type="user"
        @update:valueSearch="handleSearchQuery"
        @update:selectedFilter="handleSelectedRole"
        @search="fetchUserData()"
        @reset="handleReset()"
        @tambah-data="changeSection('Daftar', 'add')"
        @reload-data="fetchUserData()"
        :filterSelect="rolePayload"
        ref="resetFormRef"
      />
    </template>
    <template #content>
      <NoData v-if="!hasData" />
      <DataTable
        v-else
        :value="userPayload"
        tableStyle="min-width: 50rem"
        stripedRows
        class="text-xs"
        scrollable
        scrollHeight="flex"
        @rowSelect="onRowSelect"
        v-model:selection="selectedData"
        :metaKeySelection="metaKey"
        selectionMode="single"
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
            <div class="w-full text-center">No.</div>
          </template>
          <template #body="slotProps">
            <div class="flex items-center justify-center">
              {{ slotProps.index + 1 }}
            </div>
          </template>
        </Column>
        <Column
          field="name"
          header="Nama User"
          headerClass="bg-opensimrs-50 font-semibold text-SM"
          class="w-4/12"
        >
        </Column>
        <Column
          field="role.name"
          header="Role"
          headerClass="bg-opensimrs-50 font-semibold text-SM"
          class="w-4/12"
        >
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
            <div class="w-full font-semibold text-center text-SM">Action</div>
          </template>
          <template #body="slotProps">
            <div class="flex items-center gap-2.5 justify-center">
              <CustomButton
                label=""
                background-color="bg-[#3D84E5] rounded-lg"
                class="h-6 w-[26px] p-0"
                @click="changeSection('Daftar', 'edit', slotProps.data)"
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
      <DialogDelete
        v-model:isDialogVisible="isDeleteDialogVisible"
        :title="dialogConfig.title"
        :itemToDelete="dialogConfig.data"
        @delete="confirmDelete"
      />
    </template>
    <template #footer>
      <FooterPaginator
        :rows="userProperties.page_size"
        :totalRecords="userProperties.total"
        @page="handlePage"
        @import="handleFileUpload"
        @export="downloadExportExcel"
        @download="downloadFormatExcel"
      />
    </template>
  </Card>
  <TambahDataUserPage
    v-else-if="dataBreadCrumb[0].label == 'Daftar'"
    @back="dataBreadCrumb.pop()"
    :method="dataBreadCrumb[0].mode"
    :payload="dataBreadCrumb[0].data"
    @data-updated="fetchUserData"
  />
  <DetailUser
    v-else-if="dataBreadCrumb[0].label == 'Detail'"
    @back="dataBreadCrumb.pop()"
    :payload="selectedData"
  />
</template>
