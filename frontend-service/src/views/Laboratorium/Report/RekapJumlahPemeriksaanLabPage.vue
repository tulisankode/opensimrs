<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import * as XLSX from "xlsx-js-style";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import NoData from "@/components/section/NoData.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import { useRekapPemeriksaan } from "../../../stores/laporanLaboratorium/laporanRekapPemeriksaan";
import { useRekapPerTanggal } from "../../../stores/laporanLaboratorium/laporanRekapPerTanggal";
import { utilsStore } from "@/stores/utils";
import {
  epochToDate,
  dateToEpoch,
  formatPrice,
  setTimeForDate,
} from "@/utils/Helpers";

const startDateFilter = ref<Date>(new Date());
const endDateFilter = ref<Date>(new Date());
const UseUtilsStore = utilsStore();
const searchQuery = ref<string>("");
const rekapPemeriksaanPayload = ref<any[]>([]);
const rekapPemeriksaanStore = useRekapPemeriksaan();
const rekapPerTanggalStore = useRekapPerTanggal();
const rekapPerTanggalPayload = ref<any[]>([]);
const selectedOrderType = ref<string>("pemeriksaan");
const rekapPemeriksaanProperties = ref({
  page: 1 as number,
  page_size: 10 as number,
  total: 0 as number,
});
const rekapPerTanggalProperties = ref({
  page: 1 as number,
  page_size: 10 as number,
  total: 0 as number,
});

const fetchRekapPemeriksaan = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const params: any = {
      startDate: dateToEpoch(setTimeForDate(startDateFilter.value, 0, 0, 0)),
      endDate: dateToEpoch(setTimeForDate(endDateFilter.value, 23, 59, 59)),
      search: searchQuery.value,
      // page: Number(rekapPemeriksaanProperties.value.page),
      // pageSize: Number(rekapPemeriksaanProperties.value.page_size),
    };
    const response = await rekapPemeriksaanStore.getApi(params);

    if (response && response.payload) {
      // rekapPemeriksaanProperties.value.total =
      //   response.payload.pagination.total;
      rekapPemeriksaanPayload.value = response.payload.data;
    } else {
      rekapPemeriksaanPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    rekapPemeriksaanPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const fetchRekapPerTanggal = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const params: any = {
      startDate: dateToEpoch(setTimeForDate(startDateFilter.value, 0, 0, 0)),
      endDate: dateToEpoch(setTimeForDate(endDateFilter.value, 23, 59, 59)),
      search: searchQuery.value,
      // page: Number(rekapPerTanggalProperties.value.page),
      // pageSize: Number(rekapPerTanggalProperties.value.page_size),
    };
    const response = await rekapPerTanggalStore.getApi(params);

    if (response && response.payload) {
      // rekapPerTanggalProperties.value.total = response.payload.pagination.total;
      rekapPerTanggalPayload.value = response.payload.data;
    } else {
      rekapPerTanggalPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    rekapPerTanggalPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const handleSearch = () => {
  searchQuery.value;
  dateToEpoch(startDateFilter.value);
  dateToEpoch(endDateFilter.value);
  fetchData();
};

const resetFilters = () => {
  searchQuery.value = "";
  startDateFilter.value = new Date();
  endDateFilter.value = new Date();
  fetchData();
};

const fetchData = () => {
  if (selectedOrderType.value === "pemeriksaan") {
    fetchRekapPemeriksaan();
  } else {
    fetchRekapPerTanggal();
  }
};

const handlePagePemriksaan = (event: any) => {
  rekapPemeriksaanProperties.value.page = Number(event.page + 1);
  rekapPemeriksaanProperties.value.page_size = Number(event.rows);
  fetchRekapPemeriksaan();
};

const handlePagePerTanggal = (event: any) => {
  rekapPerTanggalProperties.value.page = Number(event.page + 1);
  rekapPerTanggalProperties.value.page_size = Number(event.rows);
  fetchRekapPerTanggal();
};

const onSelectOrderType = (label: string) => {
  selectedOrderType.value = label;
  fetchData();
};

const itemsPasien = computed(() => {
  if (selectedOrderType.value === "pemeriksaan") {
    return rekapPemeriksaanPayload.value;
  }
  return rekapPerTanggalPayload.value;
});

const hasData = computed(() => {
  if (UseUtilsStore.isLoading) return true;
  return itemsPasien.value.length > 0;
});

const downloadExcel = async () => {
  UseUtilsStore.setLoading(true);
  try {
    let data: any[] = [];
    if (selectedOrderType.value === "pemeriksaan") {
      await fetchRekapPemeriksaan();
      data = rekapPemeriksaanPayload.value;
    } else {
      await fetchRekapPerTanggal();
      data = rekapPerTanggalPayload.value;
    }

    const ws = XLSX.utils.aoa_to_sheet([]);

    // 🏷️ Judul dinamis
    const judulText =
      selectedOrderType.value === "pemeriksaan"
        ? "REKAPITULASI PEMERIKSAAN"
        : "REKAPITULASI PEMERIKSAAN PER TANGGAL";

    XLSX.utils.sheet_add_aoa(ws, [[judulText]], { origin: "A1" });

    // 🗓️ Periode
    XLSX.utils.sheet_add_aoa(
      ws,
      [
        [
          `PERIODE: ${startDateFilter.value.toLocaleDateString()} S/D ${endDateFilter.value.toLocaleDateString()}`,
        ],
      ],
      { origin: "A2" }
    );

    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, // Judul A1:D1
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }, // Periode A2:D2
    ];

    ws["A1"].s = {
      font: { bold: true, sz: 14 },
      alignment: { horizontal: "left", vertical: "center" },
    };
    ws["A2"].s = {
      font: { bold: true },
      alignment: { horizontal: "left", vertical: "center" },
    };

    // 📊 Header tabel
    const headers =
      selectedOrderType.value === "pemeriksaan"
        ? ["No", "Pemeriksaan", "Total"]
        : ["No", "Tanggal", "Pemeriksaan", "Total"];

    XLSX.utils.sheet_add_aoa(ws, [headers], { origin: "A4" });

    headers.forEach((_, idx) => {
      const cellRef = XLSX.utils.encode_cell({ c: idx, r: 3 });
      ws[cellRef].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "000000" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
      };
    });

    // 📑 Data rows
    const rows = data.map((item, index) => {
      if (selectedOrderType.value === "pemeriksaan") {
        return [index + 1, item.namaPemeriksaan, item.jumlahPemeriksaan];
      } else {
        return [
          index + 1,
          item.tanggal,
          item.namaPemeriksaan,
          item.jumlahPemeriksaan,
        ];
      }
    });

    XLSX.utils.sheet_add_aoa(ws, rows, { origin: "A5" });

    rows.forEach((row, rowIdx) => {
      row.forEach((cell, colIdx) => {
        const cellRef = XLSX.utils.encode_cell({
          c: colIdx,
          r: rowIdx + 4,
        });

        let alignment: any = { horizontal: "center", vertical: "center" };
        if (selectedOrderType.value === "pemeriksaan") {
          if (colIdx === 1) alignment.horizontal = "left";
          if (colIdx === 2) alignment.horizontal = "right";
        } else {
          if (colIdx === 2) alignment.horizontal = "left";
          if (colIdx === 3) alignment.horizontal = "right";
        }

        ws[cellRef].s = {
          font: { color: { rgb: "000000" } },
          alignment,
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } },
          },
        };
      });
    });
    // 🔑 Lebar kolom auto
    ws["!cols"] = headers.map(() => ({ wch: 20 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekapitulasi");
    XLSX.writeFile(wb, "Rekapitulasi_Jumlah_Pemeriksaan.xlsx");
  } catch (error) {
    console.error("Download Excel gagal:", error);
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

onMounted(() => {
  let date = new Date(),
    y = date.getFullYear(),
    m = date.getMonth();

  startDateFilter.value = new Date(y, m, 1);
  endDateFilter.value = new Date(y, m + 1, 0);
  fetchData();
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
          <CustomButton icon="PhArrowClockwise" @click="fetchData" />
          <CustomBreadCrumb :home="{ label: 'Laporan', home: true }" />
          <PhCaretRight :size="16" weight="bold" class="shrink-0 text-opensimrs-300" aria-hidden="true" />
          <h1 class="toolbar-heading text-opensimrs-300">Rekapitulasi Jumlah Pemeriksaan</h1>
          <CustomTextfield
            v-model="searchQuery"
            label="Pencarian"
            prependIcon="PhMagnifyingGlass"
            placeholder="Cari Nama / No. RM / No. Reg"
            @keydown.enter="handleSearch"
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
          <div class="flex items-center gap-1 shrink-0" role="group" aria-label="Jenis rekap">
            <CustomButton
              @click="onSelectOrderType('pemeriksaan')"
              label="Pemeriksaan"
              :outlined="selectedOrderType != 'pemeriksaan'"
              borderColor="border-opensimrs-300"
              :textColor="selectedOrderType != 'pemeriksaan' ? 'text-opensimrs-300' : 'text-white'"
              :backgroundColor="selectedOrderType != 'pemeriksaan' ? 'bg-transparent' : 'bg-opensimrs-300'"
              class="font-semibold"
            />
            <CustomButton
              @click="onSelectOrderType('Tanggal')"
              label="Pemeriksaan & Tanggal"
              :outlined="selectedOrderType != 'Tanggal'"
              borderColor="border-opensimrs-300"
              :textColor="selectedOrderType != 'Tanggal' ? 'text-opensimrs-300' : 'text-white'"
              :backgroundColor="selectedOrderType != 'Tanggal' ? 'bg-transparent' : 'bg-opensimrs-300'"
              class="font-semibold"
            />
          </div>
          <CustomButton
            icon="PhMagnifyingGlass"
            label="Cari"
            @click="handleSearch"
          />
          <CustomButton
            label="Reset"
            outlined
            borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300"
            @click="resetFilters"
          />
        </PageToolbar>
      </template>
      <template #content>
        <DataTable
          v-if="hasData"
          :value="itemsPasien"
          scrollable
          scrollHeight="flex"
          :pt="{ headerRow: 'text-SM' }"
        >
          <Column field="no" headerClass="bg-opensimrs-50 mr-5 w-5">
            <template #header>
              <div class="w-full font-semibold text-center">No.</div>
            </template>
            <template #body="slotProps">
              <div class="text-center">
                <div class="text-SM">{{ slotProps.index + 1 }}</div>
              </div>
            </template>
          </Column>
          <Column
            v-if="selectedOrderType === 'Tanggal'"
            field="tanggal"
            header="Tanggal"
            header-class="text-black bg-opensimrs-50"
            class="w-1/6"
          >
            <template #body="slotProps">
              <div class="text-center">
                <div class="text-left text-SM">
                  {{ slotProps.data.tanggal }}
                </div>
              </div>
            </template>
          </Column>
          <Column
            field="pemeriksaan"
            header="Pemeriksaan"
            headerClass="bg-opensimrs-50"
          >
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.namaPemeriksaan }}</div>
            </template>
          </Column>
          <Column field="total" header="Total" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.jumlahPemeriksaan }}</div>
            </template>
          </Column>
        </DataTable>
        <NoData />
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
          <!-- <CustomPaginator
            v-if="selectedOrderType === 'pemeriksaan'"
            :rows="rekapPemeriksaanProperties.page_size"
            :totalRecords="rekapPemeriksaanProperties.total"
            :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePagePemriksaan"
          />
          <CustomPaginator
            v-if="selectedOrderType != 'pemeriksaan'"
            :rows="rekapPerTanggalProperties.page_size"
            :totalRecords="rekapPerTanggalProperties.total"
            :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePagePerTanggal"
          /> -->
        </div>
      </template>
    </Card>
  </div>
</template>
