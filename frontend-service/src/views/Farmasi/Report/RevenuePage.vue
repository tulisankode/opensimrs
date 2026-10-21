<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useRevenueStore } from "@/stores/laporanFarmasi/revenue";
import { useLokasiStore } from "@/stores/datamaster/lokasi";
import { utilsStore } from "@/stores/utils";
import * as XLSX from "xlsx-js-style";
import { epochToDate, dateToEpoch, formatPrice } from "@/utils/Helpers";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import NoData from "@/components/section/NoData.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";

const startDateFilter = ref<Date>(new Date());
const endDateFilter = ref<Date>(new Date());
const expandedRows = ref();
// Laporan per jenis pendapatan (Resep Dokter / Penjualan Obat bebas); pilihan "Semua" dihapus karena
// server tidak menggabungkan keduanya (sebelumnya "Semua" selalu menampilkan data kosong).
const revenue = ref<string>("prescription");
const grandTotalPendapatan = ref(0);
const recipeOrigin = ref<string>("");
const typeOfService = ref<string>("");
const paymentMethod = ref<string>("");
const searchQuery = ref<string>("");
const optionRevenue = ref([
  { label: "Resep Dokter", value: "prescription" },
  { label: "Penjualan Obat", value: "penjualan_obat"},
]);
const optionPelayanan = ref([
  { label: "Semua", value: "" },
  { label: "IGD", value: "igd" },
  { label: "Rawat Jalan", value: "rj" },
  { label: "Rawat Inap", value: "ri" },
]);
const jenisPelayananLabel: Record<string, string> = {
  ri: "Rawat Inap",
  rj: "Rawat Jalan",
  igd: "IGD",
  otc: "Penjualan Bebas",
};
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

// State Management
const revenueStore = useRevenueStore();
const UseUtilsStore = utilsStore();
const revenuePayload = ref<any[]>([]);
const revenueProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Check if Data Exists
const hasData = computed(
  () => revenuePayload.value && revenuePayload.value.length > 0
);

// Fetch Revenue
const fetchRevenue = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await revenueStore.getApi(
      dateToEpoch(startDateFilter.value),
      dateToEpoch(endDateFilter.value),
      recipeOrigin.value,
      typeOfService.value,
      paymentMethod.value,
      searchQuery.value,
      revenue.value,
      revenueProperties.value.page,
      revenueProperties.value.page_size
    );

    if (response && response.payload?.items) {
      revenueProperties.value.total = response.properties.total;
      revenuePayload.value = response.payload.items;
      grandTotalPendapatan.value = response.payload.grandTotal ?? 0;
    } else {
      revenuePayload.value = [];
      grandTotalPendapatan.value = 0;
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    revenuePayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, (newValue) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetchRevenue();
  }, 500);
});

// Handle Pagination
const handlePage = (event: any) => {
  revenueProperties.value.page = event.page + 1;
  revenueProperties.value.page_size = event.rows;
  fetchRevenue();
};

// Filter Reset Data
const resetData = () => {
  startDateFilter.value = new Date();
  endDateFilter.value = new Date();
  recipeOrigin.value = "";
  typeOfService.value = "";
  paymentMethod.value = "";
  searchQuery.value = "";
  revenue.value = "prescription";
  fetchRevenue();
};

// Cetak Excel: ambil seluruh baris tersaring (sebelumnya hanya halaman aktif, mis. 10 baris pertama)
const print = async () => {
  try {
    const response = await revenueStore.getApi(
      dateToEpoch(startDateFilter.value),
      dateToEpoch(endDateFilter.value),
      recipeOrigin.value,
      typeOfService.value,
      paymentMethod.value,
      searchQuery.value,
      revenue.value,
      1,
      Math.max(revenueProperties.value.total, 1)
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
    const judulJenis =
      revenue.value === "penjualan_obat" ? "Penjualan Obat Bebas" : "Resep";
    const title = [`Laporan Pendapatan Farmasi ${judulJenis}`];
    const periode = [`Periode: ${formatDate(startDateFilter.value)} - ${formatDate(endDateFilter.value)}`];
    const grandTotal = ["Grand Total"];
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
      NoInvoice: "No. Invoice",
      NoRegis: "No. Registrasi",
      NoRM: "No. RM",
      Nama: "Nama Pasien",
      NamaDokter: "Nama Dokter",
      AsalResep: "Asal Resep",
      JenisPelayanan: "Jenis Pelayanan",
      MetodePembayaran: "Metode Pembayaran",
      Total: "Total",
    });

    const jenisPelayananMapping: Record<string, string> = {
      ri: "Rawat Inap",
      rj: "Rawat Jalan",
      igd: "Instalasi Gawat Darurat",
      otc: "Penjualan Bebas",
    };

    // Data Rows
    let grandTotalValue = 0;
    for (let i = 0; i < rows.length; i++) {
      grandTotalValue += rows[i].totalHarga || 0;
      data.push({
        No: i + 1,
        Tanggal: epochToDate(rows[i].orderDate, 'date'),
        NoResep: rows[i].noResep,
        NoInvoice: rows[i].noInvoice,
        NoRegis: rows[i].noReg,
        NoRM: rows[i].noRm,
        Nama: rows[i].patient?.name ?? "-",
        NamaDokter: rows[i].dokterOrder,
        AsalResep: rows[i].lokasi?.name ?? "-",
        JenisPelayanan: jenisPelayananMapping[rows[i].jenisPelayanan as string] || rows[i].jenisPelayanan,
        MetodePembayaran: rows[i].paymentMethod,
        Total: formatPrice(rows[i].totalHarga),
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
    // Baris Grand Total tepat di bawah data (sebelumnya tetap di baris 13 sehingga menimpa data ke-7)
    const barisTotal = data.length + 1;
    XLSX.utils.sheet_add_aoa(worksheet, [grandTotal], { origin: `A${barisTotal}` });
    XLSX.utils.sheet_add_aoa(worksheet, [[grandTotalValue]], { origin: `L${barisTotal}` });
    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 11 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 11 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: 11 } },
      { s: { r: barisTotal - 1, c: 0 }, e: { r: barisTotal - 1, c: 10 } },
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
    worksheet[`A${barisTotal}`].s = {
      alignment: { horizontal: "center", vertical: "center" },
      font: { bold: true, sz: 10 },
    };
    worksheet[`L${barisTotal}`] = { v: formatPrice(grandTotalValue), 
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
    XLSX.writeFile(workbook, `Laporan Pendapatan Farmasi ${judulJenis}.xlsx`);
  } catch (error) {
    console.error("Error while exporting Excel", error);
  }
};

onMounted(() => {
  fetchRevenue();
  fetchLocation();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="fetchRevenue" />
          <CustomBreadCrumb
            :home="{ label: 'Laporan', home: true }"
            :model="[{ label: 'Pendapatan' }]"
          />
          <CustomTextfield
            v-model="searchQuery"
            label="Cari Pasien"
            prependIcon="PhMagnifyingGlass"
            placeholder="Cari Asal Resep / No. RM"
            @keydown.enter="fetchRevenue"
          />
          <CustomSelect
            v-model="revenue"
            label="Pendapatan"
            place-holder="Semua"
            optionLabel="label"
            optionValue="value"
            :options="optionRevenue"
          />
          <CustomSelect
            v-model="typeOfService"
            label="Jenis Pelayanan"
            place-holder="Semua"
            optionLabel="label"
            optionValue="value"
            :options="optionPelayanan"
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
          <CustomButton @click="fetchRevenue" icon="PhMagnifyingGlass" label="Cari" />
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
          v-model:expandedRows="expandedRows"
          :value="revenuePayload"
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
          <Column header="No. Resep / Transaksi" headerClass="bg-opensimrs-50">
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
              <div class="text-SM">{{ slotProps.data.patient?.name }}</div>
            </template>
          </Column>
          <!-- Jenis Pelayanan -->
          <Column header="Jenis Pelayanan" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">
                {{ jenisPelayananLabel[slotProps.data.jenisPelayanan] ?? slotProps.data.jenisPelayanan }}
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
                <!-- No. Invoice -->
                <Column header="No. Invoice" headerClass="bg-opensimrs-50">
                  <template #body="slotProps">
                    <div class="text-SM">{{ slotProps.data.noInvoice }}</div>
                  </template>
                </Column>
                <!-- Nama Dokter -->
                <Column header="Nama Dokter" headerClass="bg-opensimrs-50">
                  <template #body="slotProps">
                    <div class="text-SM">{{ slotProps.data.dokterOrder }}</div>
                  </template>
                </Column>
                <!-- Asal Resep -->
                <Column header="Asal Resep" headerClass="bg-opensimrs-50">
                  <template #body="slotProps">
                    <div class="text-SM">{{ slotProps.data.lokasi?.name ?? "-" }}</div>
                  </template>
                </Column>
                <!-- Total -->
                <Column header="Total" headerClass="bg-opensimrs-50">
                  <template #body="slotProps">
                    <div class="text-SM">{{ formatPrice(slotProps.data.totalHarga) }}</div>
                  </template>
                </Column>
              </DataTable>
            </div>
          </template>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-between mt-[10px]">
          <CustomButton
            @click="print"
            icon="PhPrinter"
            label="Cetak"
            class="mr-[10px]"
            backgroundColor="bg-opensimrs-300"
          />
          <div class="font-semibold text-SM self-center">
            Grand Total: {{ formatPrice(grandTotalPendapatan) }}
          </div>
          <CustomPaginator
            :rows="revenueProperties.page_size"
            :totalRecords="revenueProperties.total"
            :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePage"
          />
        </div>
      </template>
    </Card>
  </div>
</template>
