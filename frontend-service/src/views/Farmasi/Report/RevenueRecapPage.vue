<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useLokasiStore } from "@/stores/datamaster/lokasi";
import { useRevenueRecapStore } from "@/stores/laporanFarmasi/revenueRecap";
import { utilsStore } from "@/stores/utils";
import * as XLSX from "xlsx-js-style";
import { dateToEpoch, formatPrice } from "@/utils/Helpers";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import NoData from "@/components/section/NoData.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";

const startDateFilter = ref<Date>(new Date());
const endDateFilter = ref<Date>(new Date());
const metodePembayaran = ref(0);
const stockLocation = ref("");
const optionPembayaran = ref([
  { label: "Semua", value: "" },
  { label: "Tunai", value: 1 },
  { label: "Asuransi", value: 2 },
]);

function formatDate(date: any) {
  const parsedDate = new Date(date);
  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");

  return `${day}-${month}-${year}`;
}

function formatDateExport(date: any) {
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
const revenueRecapStore = useRevenueRecapStore();
const UseUtilsStore = utilsStore();
const revenueRecapPayload = ref<any[]>([]);
const revenueRecapProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Check if Data Exists
const hasData = computed(
  () => revenueRecapPayload.value && revenueRecapPayload.value.length > 0
);

// Fetch Revenue Recap
const fetchRevenueRecap = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await revenueRecapStore.getApi(
      revenueRecapProperties.value.page,
      revenueRecapProperties.value.page_size,
      dateToEpoch(startDateFilter.value),
      dateToEpoch(endDateFilter.value),
      metodePembayaran.value,
      stockLocation.value,
    );

    if (response && response.payload.items) {
      revenueRecapProperties.value.total = response.properties.total;
      revenueRecapPayload.value = response.payload.items;
    } else {
      revenueRecapPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    revenueRecapPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// Handle Pagination
const handlePage = (event: any) => {
  revenueRecapProperties.value.page = event.page + 1;
  revenueRecapProperties.value.page_size = event.rows;
  fetchRevenueRecap();
};

// Filter Reset Data
const resetData = () => {
  metodePembayaran.value = 0;
  stockLocation.value = "";
  startDateFilter.value = new Date();
  endDateFilter.value = new Date();
  fetchRevenueRecap();
};

// Cetak Excel
const print = async () => {
  try {
    const response = await revenueRecapStore.getApi(
      revenueRecapProperties.value.page,
      revenueRecapProperties.value.page_size,
      dateToEpoch(startDateFilter.value),
      dateToEpoch(endDateFilter.value),
      metodePembayaran.value,
      stockLocation.value,
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
    const title = ["Laporan Pendapatan Resep Per Apotek"];
    const periode = [`Periode: ${formatDateExport(startDateFilter.value)} - ${formatDateExport(endDateFilter.value)}`];
    const total = ["Total"];
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
      Lokasi: "Lokasi Stok",
      MetodePembayaran: "Metode Pembayaran",
      Jumlah: "Jumlah",
    });

    // Data Rows
    let totalValue = 0;
    for (let i = 0; i < rows.length; i++) {
      totalValue += rows[i].totalHarga || 0;
      data.push({
        No: i + 1,
        Tanggal: formatDate(rows[i].orderDate),
        Lokasi: rows[i].lokasiStok,
        MetodePembayaran: rows[i].paymentMethod,
        Jumlah: formatPrice(rows[i].totalHarga)
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
    XLSX.utils.sheet_add_aoa(worksheet, [total], { origin: "A8" });
    XLSX.utils.sheet_add_aoa(worksheet, [[totalValue]], { origin: "E8" });
    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, // Merge Title
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }, // Merge Address
      { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } }, // Merge User
      { s: { r: 3, c: 0 }, e: { r: 3, c: 4 } }, // Merge Title
      { s: { r: 4, c: 0 }, e: { r: 4, c: 4 } }, // Merge Period
      { s: { r: 7, c: 0 }, e: { r: 7, c: 3 } }, // Merge Total
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
    worksheet["A8"].s = {
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true, sz: 10 },
    };
    worksheet["E8"] = { v: formatPrice(totalValue), 
      s: { 
        alignment: { horizontal: "center", vertical: "center" }, 
        font: { bold: true, sz: 10 } 
      }      
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Pendapatan Farmasi");
    XLSX.writeFile(workbook, `Laporan Pendapatan Resep Per Apotek.xlsx`);
  } catch (error) {
    console.error("Error while exporting Excel", error);
  }
};

onMounted(() => {    
  fetchRevenueRecap();
  fetchLocation();  
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
        <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" />
          <CustomBreadCrumb
            :home="{ label: 'Laporan', home: true }"
            :model="[{ label: 'Rekap Pendapatan Resep Per Apotik' }]"
          />
          <CustomSelect
            v-model="metodePembayaran"
            label="Metode Pembayaran"
            placeHolder="Semua"
            optionLabel="label"
            optionValue="value"
            :options="optionPembayaran"
          />
          <CustomSelect
            v-model="stockLocation"
            label="Lokasi Stok"
            placeHolder="Semua"
            optionLabel="name"
            optionValue="uuid"
            :options="locationPayload"
          />
          <CustomDatePicker
            v-model="startDateFilter"
            :maxDate="endDateFilter"
            label="Tanggal mulai"
            class="toolbar-field--date"
          />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker
            v-model="endDateFilter"
            label="Tanggal selesai"
            class="toolbar-field--date"
          />
          <CustomButton @click="fetchRevenueRecap" icon="PhMagnifyingGlass" label="Cari" />
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
          :value="revenueRecapPayload"
          scrollable
          scrollHeight="flex"
          :pt="{ headerRow: 'text-SM' }"
          class="text-SM"
        >
          <Column headerClass="bg-opensimrs-50">
            <template #header>
              <div class="w-full font-semibold">No.</div>
            </template>
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.index + 1 }}</div>
            </template>
          </Column>
          <Column header="Tanggal" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">
                {{ formatDate(slotProps.data.orderDate) }}
              </div>
            </template>
          </Column>
          <Column header="Lokasi Stok" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.lokasiStok }}</div>
            </template>
          </Column>
          <Column header="Metode Pembayaran" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.paymentMethod }}</div>
            </template>
          </Column>
          <Column header="Jumlah" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">{{ formatPrice(slotProps.data.totalHarga) }}</div>
            </template>
          </Column>
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
            :rows="revenueRecapProperties.page_size"
            :totalRecords="revenueRecapProperties.total"
            :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePage"
          />
        </div>
      </template>
    </Card>
  </div>
</template>
