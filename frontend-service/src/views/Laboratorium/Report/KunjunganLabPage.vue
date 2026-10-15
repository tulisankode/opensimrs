<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import type { MenuItem } from "primevue/menuitem";
import * as XLSX from "xlsx-js-style";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import NoData from "@/components/section/NoData.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import { useKunjungan } from "@/stores/laporanLaboratorium/laporanKunjungan";
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
const kunjunganPayload = ref<any[]>([]);
const UseUtilsStore = utilsStore();
const kunjunganStore = useKunjungan();
const kunjunganProperties = ref({
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

const fetchKunjungan = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const params: any = {
      startDate: dateToEpoch(setTimeForDate(startDateFilter.value, 0, 0, 0)),
      endDate: dateToEpoch(setTimeForDate(endDateFilter.value, 23, 59, 59)),
      jenisPelayanan: jenisPelayanan.value,
      search: searchQuery.value,
      page: kunjunganProperties.value.page,
      pageSize: kunjunganProperties.value.page_size,
    };
    const response = await kunjunganStore.getApi(params);

    if (response && response.payload) {
      kunjunganProperties.value.total = response.payload.pagination.total;
      kunjunganPayload.value = response.payload.data;
    } else {
      kunjunganPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    kunjunganPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const hasData = computed(
  () => kunjunganPayload.value && kunjunganPayload.value.length > 0
);

const cloneData = (data: any) => {
  try {
    return JSON.parse(JSON.stringify(data));
  } catch {
    return {};
  }
};

const searchData = () => {
  searchQuery.value;
  dateToEpoch(startDateFilter.value);
  dateToEpoch(endDateFilter.value);
  jenisPelayanan.value;
  fetchKunjungan();
};

const handlePage = (event: any) => {
  kunjunganProperties.value.page = event.page + 1;
  kunjunganProperties.value.page_size = event.rows;
  fetchKunjungan();
};

const resetFilters = () => {
  startDateFilter.value = new Date();
  endDateFilter.value = new Date();
  searchQuery.value = "";
  jenisPelayanan.value = "";
  kunjunganProperties.value.page = 1;
  kunjunganProperties.value.page_size = 10;
  fetchKunjungan();
};

const downloadExcel = () => {
  const workbook = XLSX.utils.book_new();

  const title = [["LAPORAN KUNJUNGAN LABORATORIUM"]];
  const period = [
    [
      `PERIODE: ${epochToDate(
        dateToEpoch(startDateFilter.value),
        "date"
      )} S/D ${epochToDate(dateToEpoch(endDateFilter.value), "date")}`,
    ],
  ];

  const header = [
    "No",
    "Tanggal",
    "No Registrasi",
    "No RM",
    "Nama Pasien",
    "Dokter",
    "Petugas",
    "Pelayanan",
    "Unit Asal",
    "Metode Pembayaran",
    "Pemeriksaan",
    "Biaya",
  ];

  const data = kunjunganPayload.value.flatMap((item, index) =>
    item.orderLabPemeriksaan.map((pemeriksaan: any, i: number) => [
      i === 0 ? index + 1 : "",
      i === 0 ? epochToDate(parseInt(item.tglOrder) / 1000, "date") : "",
      i === 0 ? item.noreg : "",
      i === 0 ? item.noRm : "",
      i === 0 ? item.patient?.name ?? "-" : "",
      i === 0 ? item.dokterPengirim?.pegawai?.name ?? "-" : "",
      i === 0 ? item.petugasOrder ?? "-" : "",
      i === 0 ? item.pelayanan ?? "-" : "",
      i === 0 ? item.lokasi?.name ?? "-" : "",
      i === 0 ? (item.paymentMethod === 1 ? "Tunai" : "Asuransi") : "",
      pemeriksaan.tarifLab?.name ?? "-",
      pemeriksaan.tarifLab?.grandTotal ?? 0,
    ])
  );

  const worksheetData = [...title, ...period, [], header, ...data];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  worksheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } },
  ];

  const range = XLSX.utils.decode_range(worksheet["!ref"]!);

  for (let R = 0; R <= range.e.r; ++R) {
    for (let C = 0; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = worksheet[cellAddress];
      if (!cell) continue;

      const isTitle = R === 0;
      const isPeriod = R === 1;
      const isHeader = R === 3;
      const isBody = R >= 4;

      // Default style
      cell.s = {
        font: {
          name: "Calibri",
          sz: isTitle || isPeriod ? 14 : isHeader ? 12 : 11,
          bold: isTitle || isPeriod || isHeader,
        },
        alignment: {
          vertical: "center",
          horizontal:
            isTitle || isPeriod
              ? "center"
              : isHeader
              ? "center"
              : C === 11
              ? "right"
              : "left",
        },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
      };

      // Background untuk header
      if (isHeader) {
        cell.s.fill = {
          fill: { fgColor: { rgb: "000000" } },
        };
        cell.s.font.color = { rgb: "FFFFFF" };
      }

      // Alignment untuk kolom Biaya
      if (isBody && C === 11) {
        cell.s.alignment = { horizontal: "right", vertical: "center" };
        cell.z = "#,##0";
      }
    }
  }

  worksheet["!cols"] = [
    { wch: 5 }, // No
    { wch: 15 }, // Tanggal
    { wch: 20 }, // No Registrasi
    { wch: 10 }, // No RM
    { wch: 25 }, // Nama Pasien
    { wch: 25 }, // Dokter
    { wch: 25 }, // Petugas
    { wch: 15 }, // Pelayanan
    { wch: 20 }, // Unit Asal
    { wch: 20 }, // Metode Pembayaran
    { wch: 30 }, // Pemeriksaan
    { wch: 15 }, // Biaya
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Kunjungan");
  XLSX.writeFile(workbook, "LAPORAN KUNJUNGAN LABORATORIUM.xlsx");
};

onMounted(() => {
  let date = new Date(),
    y = date.getFullYear(),
    m = date.getMonth();

  startDateFilter.value = new Date(y, m, 1);
  endDateFilter.value = new Date(y, m + 1, 0);
  fetchKunjungan();
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
          <CustomButton icon="PhArrowClockwise" @click="fetchKunjungan" />
          <CustomBreadCrumb :home="{ label: 'Laporan', home: true }" />
          <PhCaretRight :size="16" weight="bold" class="shrink-0 text-opensimrs-300" aria-hidden="true" />
          <h1 class="toolbar-heading text-opensimrs-300">Kunjungan</h1>
          <CustomTextfield
            v-model="searchQuery"
            label="Pencarian"
            prependIcon="PhMagnifyingGlass"
            placeholder="Cari Nama / No. RM / No. Reg"
            @keydown.enter="searchData"
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
            label="Tanggal mulai"
            class="toolbar-field--date"
            v-model="startDateFilter"
          />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker
            label="Tanggal selesai"
            class="toolbar-field--date"
            v-model="endDateFilter"
          />
          <CustomButton
            @click="searchData"
            icon="PhMagnifyingGlass"
            label="Cari"
            borderColor="border-opensimrs-300"
          />
          <CustomButton
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
          :value="kunjunganPayload"
          :key="kunjunganPayload.length"
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
          >
            <template #body="slotProps">
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
            field="lokasi.name"
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
            field="paymentMethod"
            header="Cara Bayar"
            header-class="text-black bg-opensimrs-50"
          >
            <template #body="slotProps">
              <div class="text-SM">
                {{ slotProps.data.paymentMethod === 1 ? "Tunai" : "Asuransi" }}
              </div>
            </template>
          </Column>
          <Column
            field="total"
            header="Total"
            header-class="text-black bg-opensimrs-50"
          >
            <template #body="slotProps">
              <div class="text-right text-SM">
                {{ formatPrice(slotProps.data.grandTotalLab) }}
              </div>
            </template>
          </Column>
          <template #expansion="slotProps">
            <div class="p-3 -mx-3 -my-1.5 bg-opensimrs-75">
              <DataTable
                :value="[cloneData(slotProps.data)]"
                class="overflow-hidden rounded-lg"
                :pt="{ headerRow: 'text-SM' }"
              >
                <Column
                  field="dokter"
                  header="Dokter"
                  header-class=" bg-opensimrs-50"
                >
                  <template #body="{ data }">
                    <div>
                      {{ data.dokterPengirim?.pegawai?.name ?? "-" }}
                    </div>
                  </template>
                </Column>
                <Column
                  field="petugas"
                  header="Petugas"
                  header-class=" bg-opensimrs-50"
                >
                  <template #body="{ data }">
                    <div>{{ data.petugasOrder ?? "-" }}</div>
                  </template>
                </Column>
                <Column
                  field="tarifPemeriksaan"
                  header="Tarif Pemeriksaan"
                  header-class="bg-opensimrs-50"
                >
                  <template #body="{ data }">
                    <div
                      v-if="
                        data.orderLabPemeriksaan &&
                        data.orderLabPemeriksaan.length > 0
                      "
                    >
                      <div
                        v-for="(item, index) in data.orderLabPemeriksaan"
                        :key="index"
                        class="text-SM"
                      >
                        <span class="mt-2">{{
                          item.tarifLab?.name || "-"
                        }}</span>
                      </div>
                    </div>
                    <div v-else>-</div>
                  </template>
                </Column>
                <Column
                  field="hargaPemeriksaan"
                  header="Harga Pemeriksaan"
                  header-class=" bg-opensimrs-50"
                >
                  <template #body="{ data }">
                    <div
                      v-if="
                        data.orderLabPemeriksaan &&
                        data.orderLabPemeriksaan.length > 0
                      "
                    >
                      <div
                        v-for="(item, index) in data.orderLabPemeriksaan"
                        :key="index"
                        class="text-SM"
                      >
                        {{ formatPrice(item.tarifLab?.grandTotal) || "-" }}
                      </div>
                    </div>
                    <div v-else>-</div>
                  </template>
                </Column>
              </DataTable>
            </div>
          </template>
        </DataTable>
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
            :rows="kunjunganProperties.page_size"
            :totalRecords="kunjunganProperties.total"
            :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePage"
          />
        </div>
      </template>
    </Card>
  </div>
</template>
