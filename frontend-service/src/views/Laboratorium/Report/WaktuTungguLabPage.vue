<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import * as XLSX from "xlsx-js-style";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import NoData from "@/components/section/NoData.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import { useLaporanTat } from "@/stores/laporanLaboratorium/laporanTAT";
import { utilsStore } from "@/stores/utils";
import {
  epochToDate,
  dateToEpoch,
  formatPrice,
  setTimeForDate,
} from "@/utils/Helpers";

const startDateFilter = ref<Date>(new Date());
const endDateFilter = ref<Date>(new Date());
const searchQuery = ref<string>("");
const tatPayload = ref<any[]>([]);
const UseUtilsStore = utilsStore();
const laporanTatStore = useLaporanTat();
const tatProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});
const expandedRows = ref<any[]>([]);

const jenisPelayanan = ref<string>("");
const optionJenisPelayanan = ref([
  { label: "Semua", value: "" },
  { label: "Rawat Jalan", value: "rajal" },
  { label: "Rawat Inap", value: "ranap" },
  { label: "IGD", value: "igd" },
  { label: "APS", value: "aps" },
]);

const fetchLaporanTat = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const params: any = {
      startDate: dateToEpoch(setTimeForDate(startDateFilter.value, 0, 0, 0)),
      endDate: dateToEpoch(setTimeForDate(endDateFilter.value, 23, 59, 59)),
      jenisPelayanan: jenisPelayanan.value,
      search: searchQuery.value,
      page: tatProperties.value.page,
      pageSize: tatProperties.value.page_size,
    };
    const response = await laporanTatStore.getApi(params);

    if (response && response.payload) {
      tatProperties.value.total = response.payload.pagination.total;
      tatPayload.value = response.payload.data;
      console.log("Kunjungan data fetched successfully", tatPayload.value);
    } else {
      tatPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    tatPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const hasData = computed(() => tatPayload.value && tatPayload.value.length > 0);

const cloneData = (data: any) => {
  try {
    return JSON.parse(JSON.stringify(data));
  } catch {
    return {};
  }
};

const formatDurationFromEpochMs = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let result = "";
  if (hours > 0) result += `${hours} jam `;
  if (minutes > 0) result += `${minutes} menit `;
  if (seconds > 0 || (!hours && !minutes)) result += `${seconds} detik`;

  return result.trim();
};

const searchData = () => {
  searchQuery.value;
  dateToEpoch(startDateFilter.value);
  dateToEpoch(endDateFilter.value);
  jenisPelayanan.value;
  fetchLaporanTat();
};

const handlePage = (event: any) => {
  tatProperties.value.page = event.page + 1;
  tatProperties.value.page_size = event.rows;
  fetchLaporanTat();
};

const resetFilters = () => {
  startDateFilter.value = new Date();
  endDateFilter.value = new Date();
  searchQuery.value = "";
  jenisPelayanan.value = "";
  tatProperties.value.page = 1;
  tatProperties.value.page_size = 10;
  fetchLaporanTat();
};

const downloadExcel = () => {
  const wb = XLSX.utils.book_new();

  // === Judul & Metadata ===
  const cetakTanggal = epochToDate(Date.now() / 1000, "date"); // adjust format if needed
  const cetakWaktu = new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dicetakOleh = `DICETAK OLEH: IKHWAN, ${cetakTanggal} PUKUL ${cetakWaktu}`;

  const title = [
    ["RSUD MERAH PUTIH", "", "", "", "", "", dicetakOleh], // A1:G1
    ["Alamat: Jl. Contoh Alamat No.123"], // A2:F2
    [],
    [],
    ["Laporan Waktu Tunggu Pelayanan Laboratorium"], // A5:K5
    [
      `Periode: ${epochToDate(
        dateToEpoch(startDateFilter.value),
        "date"
      )} - ${epochToDate(dateToEpoch(endDateFilter.value), "date")}`,
    ],
  ];

  const header = [
    [
      "No",
      "Tanggal",
      "No Registrasi",
      "No RM",
      "Nama Pasien",
      "Pelayanan",
      "Unit Asal",
      "Metode Pembayaran",
      "Jam Validasi",
      "Jam Selesai",
      "Waktu Pelayanan",
    ],
  ];

  const dataRows = tatPayload.value.map((item, index) => {
    return [
      index + 1,
      epochToDate(parseInt(item.tglOrder) / 1000, "date"),
      item.noreg || "-",
      item.noRm || "-",
      item.patient?.name || "-",
      item.pelayanan || "-",
      item.lokasi?.name || "-",
      item.paymentMethod === 1 ? "Tunai" : "Asuransi",
      item.waktuValidasi
        ? epochToDate(parseInt(item.waktuValidasi) / 1000, "time")
        : "-",
      item.waktuSelsai
        ? epochToDate(parseInt(item.waktuSelsai) / 1000, "time")
        : "-",
      item.tat ? formatDurationFromEpochMs(item.tat) : "-",
    ];
  });

  const fullData = [...title, [], ...header, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(fullData);

  // === Merge Cells ===
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // A1:F1 Judul RS
    { s: { r: 0, c: 6 }, e: { r: 0, c: 10 } }, // G1:K1 Dicetak Oleh
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, // A2:F2 Alamat
    { s: { r: 4, c: 0 }, e: { r: 4, c: 10 } }, // A5:K5 Judul Laporan
    { s: { r: 5, c: 0 }, e: { r: 5, c: 10 } }, // A6:K6 Periode
  ];

  // === Styling ===
  const range = XLSX.utils.decode_range(ws["!ref"] || "");
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell_address = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cell_address]) continue;

      // RSUD MERAH PUTIH
      if (R === 0 && C <= 5) {
        ws[cell_address].s = {
          font: { name: "Calibri", sz: 26, bold: true },
          alignment: { horizontal: "left", vertical: "center" },
        };
      }
      // Dicetak Oleh
      else if (R === 0 && C >= 6) {
        ws[cell_address].s = {
          font: { name: "Calibri", sz: 11 },
          alignment: { horizontal: "right", vertical: "center" },
        };
      }
      // Alamat
      else if (R === 1) {
        ws[cell_address].s = {
          font: { name: "Calibri", sz: 12 },
          alignment: { horizontal: "left", vertical: "center" },
        };
      }
      // Judul Laporan
      else if (R === 4) {
        ws[cell_address].s = {
          font: { name: "Calibri", sz: 20, bold: true },
          alignment: { horizontal: "center", vertical: "center" },
        };
      }
      // Periode
      else if (R === 5) {
        ws[cell_address].s = {
          font: { name: "Calibri", sz: 13, bold: true },
          alignment: { horizontal: "center", vertical: "center" },
        };
      }
      // Header Tabel
      else if (R === 7) {
        ws[cell_address].s = {
          font: { name: "Calibri", sz: 14, bold: true },
          alignment: { horizontal: "center", vertical: "center" },
          fill: { fgColor: { rgb: "CCCCCC" } },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } },
          },
        };
      }
      // Data Baris
      else if (R > 7) {
        ws[cell_address].s = {
          font: { name: "Calibri", sz: 14 },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } },
          },
        };
      }
    }
  }

  // Lebar kolom sama seperti sebelumnya...
  ws["!cols"] = [
    { wch: 7 },
    { wch: 14 },
    { wch: 17 },
    { wch: 12 },
    { wch: 22 },
    { wch: 16 },
    { wch: 20 },
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 18 },
  ];

  const fileName = `Laporan_TAT_${epochToDate(Date.now() / 1000, "date")}.xlsx`;
  XLSX.utils.book_append_sheet(wb, ws, "Laporan TAT");
  XLSX.writeFile(wb, fileName);
};

onMounted(() => {
  let date = new Date(),
    y = date.getFullYear(),
    m = date.getMonth();

  startDateFilter.value = new Date(y, m, 1);
  endDateFilter.value = new Date(y, m + 1, 0);
  fetchLaporanTat();
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
          <CustomButton icon="PhArrowClockwise" @click="fetchLaporanTat" />
          <CustomBreadCrumb :home="{ label: 'Laporan', home: true }" />
          <PhCaretRight :size="16" weight="bold" class="shrink-0 text-opensimrs-300" aria-hidden="true" />
          <h1 class="toolbar-heading text-opensimrs-300">Waktu Tunggu (TAT)</h1>
          <CustomTextfield
            label="Pencarian"
            prependIcon="PhMagnifyingGlass"
            placeholder="Cari Nama / No. RM / No. Reg"
          />
          <CustomSelect
            v-model="jenisPelayanan"
            label="Jenis Pelayanan"
            place-holder="Semua"
            optionLabel="label"
            optionValue="value"
            :options="optionJenisPelayanan"
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
          <CustomButton
            @click="searchData"
            icon="PhMagnifyingGlass"
            label="Cari"
            borderColor="border-opensimrs-300"
          />
          <CustomButton
            @click="resetFilters"
            label="Reset"
            outlined
            borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300"
          />
        </PageToolbar>
      </template>

      <template #content>
        <DataTable
          :value="tatPayload"
          :key="tatPayload.length"
          responsiveLayout="scroll"
          dataKey="id"
          :expandedRows="expandedRows"
          scrollable
          scrollHeight="flex"
          :pt="{ headerRow: 'text-SM' }"
          class="text-SM"
        >
          <Column
            expander
            style="width: 40px"
            header-class="text-black bg-opensimrs-50"
          />
          <!-- No -->
          <Column
            field="id"
            header="No."
            header-class="text-black bg-opensimrs-50"
            style="width: 40px"
          >
            <template #body="slotProps">
              <div class="text-center">
                <div class="text-right text-SM">{{ slotProps.index + 1 }}</div>
              </div>
            </template>
          </Column>
          <!-- Tanggal -->
          <Column
            field="tanggal_daftar"
            header="Tangal"
            header-class="text-black bg-opensimrs-50"
          >
            <template #body="slotProps">
              <div class="text-center">
                <div>
                  {{
                    epochToDate(
                      parseInt(slotProps.data.tglOrder) / 1000,
                      "date"
                    )
                  }}
                </div>
              </div>
            </template>
          </Column>
          <Column
            field="noReg"
            header="No. Registrasi"
            header-class="text-black bg-opensimrs-50"
          >
            <template #body="slotProps">
              <div class="text-SM">
                <div>{{ slotProps.data.noreg }}</div>
              </div>
            </template>
          </Column>
          <Column
            field="noRM"
            header="No. RM"
            header-class="text-black bg-opensimrs-50"
          >
            <template #body="slotProps">
              <div class="text-SM">
                <div>{{ slotProps.data.noRm }}</div>
              </div>
            </template>
          </Column>
          <Column
            field="name"
            header="Nama Pasien"
            header-class="text-black bg-opensimrs-50"
            ><template #body="slotProps">
              <div class="text-SM">
                {{ slotProps.data.patient?.name }}
              </div>
            </template>
          </Column>
          <Column
            field="pelayanan"
            header="Jenis Pelayanan"
            header-class="text-black bg-opensimrs-50"
          >
            <template #body="slotProps">
              <div class="text-SM">
                {{ slotProps.data.pelayanan || "-" }}
              </div>
            </template>
          </Column>
          <Column
            field="unitAsal"
            header="Unit Asal"
            header-class="text-black bg-opensimrs-50"
          >
            <template #body="slotProps">
              <div class="text-SM">
                {{ slotProps.data.lokasi.name || "-" }}
              </div>
            </template>
          </Column>
          <Column
            field="waktuPelayanan"
            header="Waktu Pelayanan"
            header-class="text-black bg-opensimrs-50"
          >
            <template #body="slotProps">
              <div class="text-SM">
                {{
                  slotProps.data.tat
                    ? formatDurationFromEpochMs(slotProps.data.tat)
                    : "-"
                }}
              </div>
            </template>
          </Column>

          <template #expansion="slotProps">
            <div class="p-3 -mx-3 -my-1.5 bg-opensimrs-75">
              <DataTable
                :value="[slotProps.data]"
                class="overflow-hidden rounded-lg"
                :pt="{ headerRow: 'text-SM' }"
              >
                <Column
                  field="metodePembayaran"
                  header="Metode Pembayaran"
                  header-class=" bg-opensimrs-50"
                >
                  <template #body="slotProps">
                    <div class="text-SM">
                      {{
                        slotProps.data.paymentMethod === 1
                          ? "Tunai"
                          : "Asuransi"
                      }}
                    </div>
                  </template>
                </Column>
                <Column
                  field="jamValidasi"
                  header="Jam Validasi"
                  header-class=" bg-opensimrs-50"
                >
                  <template #body="slotProps">
                    <div>
                      {{
                        slotProps.data.waktuValidasi
                          ? epochToDate(
                              parseInt(slotProps.data.waktuValidasi) / 1000,
                              "time"
                            )
                          : "-"
                      }}
                    </div>
                  </template>
                </Column>
                <Column
                  field="jamSelesai"
                  header="Jam Selesai"
                  header-class="bg-opensimrs-50"
                >
                  <template #body="slotProps">
                    <div>
                      {{
                        slotProps.data.waktuSelsai
                          ? epochToDate(
                              parseInt(slotProps.data.waktuSelsai) / 1000,
                              "time"
                            )
                          : "-"
                      }}
                    </div>
                  </template>
                </Column>
              </DataTable>
            </div>
          </template>
        </DataTable>
        <NoData v-if="!hasData" />
      </template>
      <template #footer>
        <div class="flex justify-between">
          <CustomButton
            @click="downloadExcel"
            icon="PhPrinter"
            label="Cetak"
            class="mr-[10px]"
            backgroundColor="bg-opensimrs-300"
          />
          <CustomPaginator
            :rows="tatProperties.page_size"
            :totalRecords="tatProperties.total"
            :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePage"
          />
        </div>
      </template>
    </Card>
  </div>
</template>
