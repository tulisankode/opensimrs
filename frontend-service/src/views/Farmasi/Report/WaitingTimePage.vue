<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import { useLokasiStore } from "@/stores/datamaster/lokasi";
import { useWaitingTimeStore } from "@/stores/laporanFarmasi/waitingTime";
import { utilsStore } from "@/stores/utils";
import * as XLSX from "xlsx-js-style";
import { dateToEpoch, epochToDate } from "@/utils/Helpers";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";

const startDateFilter = ref<Date>(new Date());
const endDateFilter = ref<Date>(new Date());
const expandedRows = ref();
const typeOfService = ref<string>("");
const recipe = ref<string>("");
const recipeOrigin = ref<string>("");
const paymentMethod = ref<string>("");
const searchQuery = ref<string>("");
const optionPelayanan = ref([
  { label: "Semua", value: "" },
  { label: "IGD", value: "igd" },
  { label: "Rawat Jalan", value: "rj" },
  { label: "Rawat Inap", value: "ri" },
]);
const optionResep = ref([
  { label: "Semua", value: "" },
  { label: "Racikan", value: "racikan" },
  { label: "Non-Racikan", value: "non-racikan" },
]);
const optionPembayaran = ref([
  { label: "Semua", value: "" },
  { label: "Tunai", value: 1 },
  { label: "Asuransi", value: 2 },
]);

function formatDate(date: any) {
  const parsedDate = new Date(date);
  const day = String(parsedDate.getDate()).padStart(2);
  const monthIndex = parsedDate.getMonth();
  const monthNames = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const month = monthNames[monthIndex];
  const year = parsedDate.getFullYear();

  return `${day} ${month} ${year}`;
}

// State Management Location
const locationStore = useLokasiStore();
const locationPayload = ref<any[]>([]);

// Fetch Location
const fetchLocation = async () => {
  try {
    const response = await locationStore.getApi(1, 9999);
    if (response && response.payload) {
      locationPayload.value = response.payload;
    } else {
      locationPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch kategori ruangan", error);
    locationPayload.value = [];
  }
};

// State Management Revenue Recap
const waitingTimeStore = useWaitingTimeStore();
const UseUtilsStore = utilsStore();
const waitingTimePayload = ref<any[]>([]);
const waitingTimeProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Check if Data Exists
const hasData = computed(
  () => waitingTimePayload.value && waitingTimePayload.value.length > 0
);

// Fetch Waiting Time
const fetchWaitingTime = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await waitingTimeStore.getApi(
      searchQuery.value,
      paymentMethod.value,
      recipeOrigin.value,
      recipe.value,
      typeOfService.value,
      dateToEpoch(startDateFilter.value),
      dateToEpoch(endDateFilter.value),
      waitingTimeProperties.value.page,
      waitingTimeProperties.value.page_size
    );

    if (response && response.payload.items) {
      waitingTimeProperties.value.total = response.properties.total;
      waitingTimePayload.value = response.payload.items;
    } else {
      waitingTimePayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    waitingTimePayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, () => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetchWaitingTime();
  }, 500);
});

// Handle Pagination
const handlePage = (event: any) => {
  waitingTimeProperties.value.page = event.page + 1;
  waitingTimeProperties.value.page_size = event.rows;
  fetchWaitingTime();
};

// Filter Reset Data
const resetData = () => {
  paymentMethod.value = "";
  searchQuery.value = "";
  typeOfService.value = "";
  recipe.value = "";
  recipeOrigin.value = "";
  startDateFilter.value = new Date();
  endDateFilter.value = new Date();
  fetchWaitingTime();
};

// Cetak Excel
const print = async () => {
  try {
    const response = await waitingTimeStore.getApi(
      searchQuery.value,
      paymentMethod.value,
      recipeOrigin.value,
      recipe.value,
      typeOfService.value,
      dateToEpoch(startDateFilter.value),
      dateToEpoch(endDateFilter.value),
      waitingTimeProperties.value.page,
      waitingTimeProperties.value.page_size
    );
    
    const faskes = response.payload.faskes;
    const address = response.payload.address;
    const user = response.payload.message;
    const rows = response.payload.items;
    if (!rows || rows.length === 0) {
      console.error("No data available for export");
      return;
    }    

    // Prepare Data for Export;
    const faskesName = [`${faskes}`];
    const faskesAddress = [`${address}`];
    const userName = [`${user}`];
    const title = ["Laporan Pelayanan Farmasi - Waktu Tunggu"];
    const periode = [`Periode: ${formatDate(startDateFilter.value)} - ${formatDate(endDateFilter.value)}`];
    const data = [];

    // Header Row (Kosong untuk baris kedua tanpa border)
    data.push({});
    data.push({});
    data.push({});
    data.push({});
    data.push({});
    data.push({
      No: "No",
      Tanggal: "Tanggal",
      NoResep: "No. Resep",
      NoRegis: "No. Registrasi",
      NoRM: "No. RM",
      Nama: "Nama Pasien",
      JenisPelayanan: "Jenis Pelayanan",
      MetodePembayaran: "Metode Pembayaran",
      Waktu: "Waktu Verifikasi",
      WaktuPenyerahan: "Waktu Penyerahan",
      Asal: "Asal Resep",
      WaktuPelayanan: "Waktu Pelayanan",
      Resep: "Resep",
      Racikan: "Racikan",
    });

    const jenisPelayananMapping: Record<string, string> = {
      ri: "Rawat Inap",
      rj: "Rawat Jalan",
      igd: "Instalasi Gawat Darurat",
    };

    // Data Rows
    let grandTotalValue = 0;
    for (let i = 0; i < rows.length; i++) {
      grandTotalValue += rows[i].totalHarga || 0;
      data.push({
        No: i + 1,
        Tanggal: epochToDate(rows[i].orderDate, 'date'),
        NoResep: rows[i].noResep,
        NoRegis: rows[i].noReg,
        NoRM: rows[i].noRm,
        Nama: rows[i].patient,
        JenisPelayanan: jenisPelayananMapping[rows[i].jenisPelayanan as string] || rows[i].jenisPelayanan,
        MetodePembayaran: rows[i].paymentMethod,
        Waktu: epochToDate(rows[i].waktuVerifikasi, 'dateTime'),
        WaktuPenyerahan: epochToDate(rows[i].waktuPemberian, 'dateTime'),
        Asal: rows[i].asalResep,
        WaktuPelayanan: rows[i].waktuPelayanan,
        Resep: rows[i].jenisResep,
        Racikan: rows[i].jumlahRacikan,
      });
    }

    // Create Workbook and Worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data, { skipHeader: true });

    // Add Title and Merge Cells
    XLSX.utils.sheet_add_aoa(worksheet, [faskesName], { origin: "A1" });
    XLSX.utils.sheet_add_aoa(worksheet, [faskesAddress], { origin: "A2" });
    XLSX.utils.sheet_add_aoa(worksheet, [userName], { origin: "A3" });
    XLSX.utils.sheet_add_aoa(worksheet, [title], { origin: "A4" });
    XLSX.utils.sheet_add_aoa(worksheet, [periode], { origin: "A5" });
    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 13 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 13 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 13 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 13 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: 13 } },   
    ];

    // Style Title
    worksheet["A1"].s = {
      font: { bold: true, sz: 14 },
    };
    worksheet["A2"].s = {
      font: { bold: true, sz: 14 },
    };
    worksheet["A3"].s = {
      font: { bold: false, sz: 10 },
    };
    worksheet["A4"].s = {
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true, sz: 14 },
    };
    worksheet["A5"].s = {
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true, sz: 14 },
    };

    // Column Widths
    worksheet["!cols"] = [{ wch: 5 }, { wch: 10 }, { wch: 30 }, { wch: 10 }];

    // Apply Styles to Cells
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:D1");

    // Start formatting from row 3 (index 2 in array)
    for (let row = 5; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        if (!worksheet[cellAddress]) worksheet[cellAddress] = { v: "" };

        // Apply border only to row 3 and beyond (table rows)
        if (row >= 5) {
          worksheet[cellAddress].s = worksheet[cellAddress].s || {};
          worksheet[cellAddress].s.border = {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" },
          };
        }

        // Alignment header cells
        worksheet[cellAddress].s.alignment = {
          horizontal: "center",
          vertical: "center",
        };

        // Alignment header row 3
        if (row === 5) {
          worksheet[cellAddress].s.alignment = {
            horizontal: "center",
            vertical: "center",
          };
          worksheet[cellAddress].s.font = {
            bold: true,
            sz: 10
          };
        }

        // Fill header with background color (row 3)
        if (row === 5) {
          worksheet[cellAddress].s.fill = {
            fgColor: { rgb: "D3D3D3" },
          };
        }
      }
    }

    // Append Worksheet to Workbook and Save
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Pelayanan Farmasi");
    XLSX.writeFile(workbook, `Laporan Pelayanan Farmasi - Waktu Tunggu.xlsx`);
  } catch (error) {
    console.error("Error while exporting Excel", error);
  }
};

onMounted(() => {
  fetchWaitingTime();
  fetchLocation();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" />
          <CustomBreadCrumb
            :home="{ label: 'Laporan', home: true }"
            :model="[{ label: 'Waktu Tunggu' }]"
          />
          <CustomTextfield
            v-model="searchQuery"
            label="Cari Pasien"
            prependIcon="PhMagnifyingGlass"
            placeholder="Cari Asal Resep / No. RM"
            @keydown.enter="fetchWaitingTime"
          />
          <CustomSelect
            v-model="typeOfService"
            label="Jenis Pelayanan"
            optionLabel="label"
            optionValue="value"
            :options="optionPelayanan"
            place-holder="Semua"
          />
          <CustomSelect
            v-model="recipe"
            label="Resep"
            optionLabel="label"
            optionValue="value"
            :options="optionResep"
            place-holder="Semua"
          />
          <CustomSelect
            v-model="recipeOrigin"
            label="Asal Resep"
            optionLabel="name"
            optionValue="uuid"
            :options="locationPayload"
            place-holder="Semua"
          />
          <CustomSelect
            v-model="paymentMethod"
            label="Metode Pembayaran"
            optionLabel="label"
            optionValue="value"
            :options="optionPembayaran"
            place-holder="Semua"
          />
          <CustomDatePicker
            v-model="startDateFilter"
            label="Tanggal mulai"
            class="toolbar-field--date"
          />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker
            v-model="endDateFilter"
            label="Tanggal selesai"
            class="toolbar-field--date"
          />
          <CustomButton @click="fetchWaitingTime" icon="PhMagnifyingGlass" label="Cari" />
          <CustomButton
            @click="resetData"
            label="Reset"
            outlined
            borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300"
          />
        </PageToolbar>
      </template>

      <template #content>
        <NoData v-if="!hasData" />
        <DataTable
          v-else
          v-model:expandedRows="expandedRows"
          :value="waitingTimePayload"
          scrollable
          scrollHeight="flex"
          :pt="{ headerRow: 'text-SM' }"
          class="text-SM"
        >
          <Column expander style="width: 40px" headerClass="bg-opensimrs-50" />
          <!-- No -->
          <Column headerClass="bg-opensimrs-50">
            <template #header>
              <div class="w-full font-semibold">No.</div>
            </template>
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.index + 1 }}</div>
            </template>
          </Column>
          <!-- Tanggal -->
          <Column header="Tanggal" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">{{ epochToDate(slotProps.data.orderDate, "date") }}</div>
            </template>
          </Column>
          <!-- No. Resep -->
          <Column header="No. Resep" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.noResep }}</div>
            </template>
          </Column>
          <!-- No. Registrasi -->
          <Column header="No. Registrasi" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.noReg }}</div>
            </template>
          </Column>
          <!-- No. RM -->
          <Column header="No. RM" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.noRm }}</div>
            </template>
          </Column>
          <!-- Nama Pasien -->
          <Column header="Nama Pasien" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.patient }}</div>
            </template>
          </Column>
          <!-- Jenis Pelayanan -->
          <Column header="Jenis Pelayanan" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM" v-if="slotProps.data.jenisPelayanan == 'ri'">
                Rawat Inap
              </div>
              <div class="text-SM" v-if="slotProps.data.jenisPelayanan == 'igd'">
                IGD
              </div>
              <div class="text-SM" v-if="slotProps.data.jenisPelayanan == 'rj'">
                Rawat Jalan
              </div>
            </template>
          </Column>
          <!-- Metode Pembayaran -->
          <Column header="Metode Pembayaran" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.paymentMethod }}</div>
            </template>
          </Column>
          <template #expansion="slotProps">
            <div class="p-3 -mx-3 -my-1.5 bg-opensimrs-75">
              <DataTable
                :value="[slotProps.data]"
                class="overflow-hidden rounded-lg bg-opensimrs-50"
                :pt="{ headerRow: 'text-SM' }"
              >
                <!-- Waktu Verifikasi -->
                <Column header="Waktu Verifikasi" headerClass="bg-opensimrs-50">
                  <template #body="slotProps">
                    <div class="text-SM">
                      {{ epochToDate(slotProps.data.waktuVerifikasi, "dateTime") }}
                    </div>
                  </template>
                </Column>
                <!-- Waktu Penyerahan -->
                <Column header="Waktu Penyerahan" headerClass="bg-opensimrs-50">
                  <template #body="slotProps">
                    <div class="text-SM">
                      {{ epochToDate(slotProps.data.waktuPemberian, "dateTime") }}
                    </div>
                  </template>
                </Column>
                <!-- Asal Resep -->
                <Column header="Asal Resep" headerClass="bg-opensimrs-50">
                  <template #body="slotProps">
                    <div class="text-SM">{{ slotProps.data.asalResep }}</div>
                  </template>
                </Column>
                <!-- Waktu Pelayanan -->
                <Column header="Waktu Pelayanan" headerClass="bg-opensimrs-50">
                  <template #body="slotProps">
                    <div class="text-SM">{{ slotProps.data.waktuPelayanan }}</div>
                  </template>
                </Column>
                <!-- Resep -->
                <Column header="Resep" headerClass="bg-opensimrs-50">
                  <template #body="slotProps">
                    <div class="text-SM">{{ slotProps.data.jenisResep }}</div>
                  </template>
                </Column>
                <!-- Jumlah Racikan -->
                <Column header="Jumlah Racikan" headerClass="bg-opensimrs-50">
                  <template #body="slotProps">
                    <div class="text-SM">{{ slotProps.data.jumlahRacikan }}</div>
                  </template>
                </Column>
              </DataTable>
            </div>
          </template>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-between mt-[10px]">
          <div class="flex items-center">
            <CustomButton
              @click="print"
              icon="PhPrinter"
              label="Cetak"
              class="mr-[10px]"
              backgroundColor="bg-opensimrs-300"
            />
          </div>
          <CustomPaginator
            :rows="waitingTimeProperties.page_size"
            :totalRecords="waitingTimeProperties.total"
            :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePage"
          />
        </div>
      </template>
    </Card>
  </div>
</template>
