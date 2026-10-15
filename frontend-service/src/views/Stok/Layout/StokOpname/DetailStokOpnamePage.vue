<script lang="ts" setup>
import { computed, onMounted, ref, watch } from "vue";
import { useStokOpnameStore } from "@/stores/inventory/stokOpname";
import { utilsStore } from "@/stores/utils";
import { epochToDate, formatPrice, formatDate } from "@/utils/Helpers"; // Pastikan formatDate diimport
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { PhArrowCircleUp, PhArrowCircleDown } from "@phosphor-icons/vue";
// import { exportStokOpnameToExcel } from "@/utils/exportExcelInventory";

const props = defineProps({
  pageType: {
    type: String,
    required: true,
  },
  selectedData: {
    type: Object,
    default: () => ({}),
  },
  lokasiStokUuid: {
    type: String,
    default: "",
  },
});

watch(
  () => props.selectedData,
  (newVal) => {
    console.log("selectedData changed:", newVal);
  },
  { immediate: true, deep: true }
);

const emit = defineEmits(["back", "diterima"]);

// State Management Jenis Item
const jenisItem = ref<string>("");
const optionJenis = ref([
  { name: "Obat", value: "obat" },
  { name: "Alkes", value: "alkes" },
]);

// State Management
const searchQuery = ref<string>("");
const StokOpnameStore = useStokOpnameStore();
const UseUtilsStore = utilsStore();
const DetailPayload = ref<any[]>([]);
const DetailProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// State Header & Petugas
const stokOpnameHeader = ref<any>(null);
const petugasSoName = ref<string>("-"); // State untuk nama petugas

// Check if Data Exists
const hasData = computed(
  //   () => DetailPayload.value && DetailPayload.value.length > 0
  () => dummyData.length > 0
);

// Fetch Detail Data
const fetchDetail = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await StokOpnameStore.getApiDetail(
      props.selectedData?.uuid,
      searchQuery.value,
      jenisItem.value,
      DetailProperties.value.page,
      DetailProperties.value.page_size
    );

    // Reset data dulu
    DetailPayload.value = [];
    petugasSoName.value = "-";

    if (response && response.payload) {
      // JSON Baru: response.payload adalah Array langsung
      const rawData = Array.isArray(response.payload)
        ? response.payload
        : response.payload.data || [];
      const formattedData = rawData.map((item: any) => ({
        id: item.id,
        uuid: item.uuid,
        kodeItem: item.kodeItem,
        namaItem: item.nama,
        kategori: item.kategori,
        jenisItem: item.jenisItem,
        jenisStok: item.jenisStok,
        satuan: item.satuan,
        stokAwal: item.stokAwal,
        stokMasuk: item.stokMasuk,
        stokKeluar: item.stokKeluar,
        stokSistem: item.stokSistem,
        stokFisik: item.stokFisik,
        selisih: item.selisih, // Backend sudah menghitung selisih
        ed: item.ed,
        hargaDasar: item.hargaDasar,
        hargaAkhir: item.hargaAkhir,
        petugasSo: item.petugasSo,
      }));

      DetailPayload.value = formattedData;

      // Ambil data header & petugas dari item pertama (jika ada data)
      if (formattedData.length > 0) {
        const firstItem = formattedData[0];
        stokOpnameHeader.value = {
          jenisStok: firstItem.jenisStok,
          kategori: firstItem.kategori,
          jenisItem: firstItem.jenisItem,
        };
        petugasSoName.value = firstItem.petugasSo || "-";
      }

      // Update Pagination
      if (response.properties) {
        DetailProperties.value.total = response.properties.total;
      } else {
        DetailProperties.value.total = 0;
      }
    } else {
      DetailProperties.value.total = 0;
      stokOpnameHeader.value = null;
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    DetailPayload.value = [];
    DetailProperties.value.total = 0;
    stokOpnameHeader.value = null;
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// Export Excel
const handleExportExcel = async () => {
  const faskesProfileString = localStorage.getItem("faskes_profile");
  if (!faskesProfileString) {
    alert("Gagal memuat profil klinik untuk header.");
    return;
  }
  let clinicProfile: any;
  try {
    clinicProfile = JSON.parse(faskesProfileString);
  } catch (e) {
    console.error("Gagal parse data profil:", e);
    return;
  }

  UseUtilsStore.setLoading(true);
  try {
    // Ambil SEMUA data (limit = total data atau 9999)
    const limitExport = DetailProperties.value.total || 9999;

    const response = await StokOpnameStore.getApiDetail(
      props.selectedData?.uuid,
      searchQuery.value,
      jenisItem.value,
      1, // Halaman 1
      limitExport // Limit Maksimal
    );

    // Siapkan data Header untuk disisipkan ke row (agar fungsi export bisa membacanya)
    const tglCutOffStr = props.selectedData?.tanggalCutOff
      ? epochToDate(props.selectedData.tanggalCutOff, "date")
      : "-";
    const exportHeaderData = {
      judulStokOpname: props.selectedData?.judulStokOpname || "Stok Opname",
      tglCutOff: tglCutOffStr,
      lokasiStokName: "", // Opsional
    };

    let rowsToExport = [];

    if (response && response.payload) {
      const rawData = Array.isArray(response.payload)
        ? response.payload
        : response.payload.data || [];

      // Mapping data agar sesuai dengan field yang diharapkan fungsi export
      rowsToExport = rawData.map((item: any) => ({
        ...exportHeaderData, // Sisipkan info header

        // Mapping field sesuai logic di fetchDetail
        code: item.kodeItem,
        namaItem: item.nama,
        kategoriItem: item.kategori,
        jenisItem: item.jenisItem,
        jenisStok: item.jenisStok,
        satuan: item.satuan,
        stokAwal: item.stokAwal,
        stokMasuk: item.stokMasuk,
        stokKeluar: item.stokKeluar,
        stokSistem: item.stokSistem,
        stokFisik: item.stokFisik,

        // Format tanggal
        expDate: item.ed ? formatDate(new Date(item.ed)) : "-",

        hargaDasar: item.hargaDasar,
        hargaAkhir: item.hargaAkhir,
        idStok: item.idStok, // UUID Stok Master
      }));
    }

    if (rowsToExport.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }

    const fileName = `Detail_Stok_Opname_${
      props.selectedData?.noStokOpname || "Report"
    }`;
    await exportStokOpnameToExcel(rowsToExport, clinicProfile, fileName);
  } catch (error) {
    console.error("Gagal export:", error);
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// Tambahkan fungsi handleSearch
const handleSearch = () => {
  DetailProperties.value.page = 1;
  fetchDetail();
};

//  fungsi handleReset
const handleReset = () => {
  searchQuery.value = "";
  jenisItem.value = "";
  DetailProperties.value.page = 1;
  fetchDetail();
};

// Handle Pagination
const handlePage = (event: any) => {
  DetailProperties.value.page = event.page + 1;
  DetailProperties.value.page_size = event.rows;
  fetchDetail();
};

onMounted(() => {
  if (props.selectedData?.uuid) {
    fetchDetail();
  }
});

// Dummy data for testing
const dummyData = [
  {
    id: 1,
    uuid: "0192b31f-365d-731c-8b16-3a4565c9475e",
    faskesUuid: "0192b31f-365d-731c-8b16-3a4565c9475e",
    stokOpnameUuid: "0192b31f-365d-731c-8b16-3a4565c9475e",
    stokFisik: 4,
    kodeItem: "prcm",
    nama: "paracetamol",
    kategori: "obat",
    jenisItem: "obat",
    jenisStok: "BPJS",
    satuan: "pcs",
    stokAwal: 10,
    stokMasuk: 10,
    stokKeluar: 5,
    stokSistem: 5,
    ed: "2025-12-12T00:00:00.000Z",
    hargaDasar: null,
    hargaAkhir: 5000,
    idStok: "0192b31f-365d-731c-8b16-3a4565c9475e",
    createdAt: "1738594220",
    updatedAt: null,
    deletedAt: null,
  },
];
</script>

<template>
  <Card
    pt:body:class="flex overflow-hidden flex-col pt-0 pb-0 h-full"
    pt:content:class="overflow-hidden h-full"
    class="overflow-hidden h-full"
  >
    <template #header>
      <CustomAccordion :openWithHeader="false" noBorder initialState="0">
        <template #header>
          <div class="flex justify-between items-center w-full align-middle">
            <div class="flex items-center">
              <CustomButton icon="PhArrowClockwise" class="mr-5" />
              <CustomBreadCrumb
                :home="{
                  label: 'Stok Opname',
                  home: true,
                }"
                :model="[
                  {
                    label: props.selectedData?.noStokOpname,
                  },
                ]"
              >
              </CustomBreadCrumb>
              <div
                v-if="props.selectedData.status == 'final'"
                class="ml-[10px] mt-[5px]"
              >
                <CustomChip
                  label="SELESAI"
                  :showCheckedIcon="false"
                  borderColor="border-grey-300"
                  bgColor="bg-grey-300"
                  textColor="text-success-300"
                />
              </div>
              <div
                v-if="props.selectedData.status == 'draft'"
                class="ml-[10px] mt-[5px]"
              >
                <CustomChip
                  label="DRAFT"
                  :showCheckedIcon="false"
                  borderColor="border-warning-75"
                  bgColor="bg-warning-75"
                  textColor="text-warning-300"
                />
              </div>
            </div>
            <CustomButton
              @click="emit('back')"
              icon="PhCaretLeft"
              label="Kembali"
              class="mr-[10px]"
              outlined
              borderColor="border-opensimrs-300"
              textColor="text-opensimrs-300"
            />
          </div>
        </template>
        <template #content>
          <div class="grid grid-cols-6 gap-6 mt-[10px]">
            <div>
              <div class="font-semibold underline text-SM">No. Stok Opname</div>
              <div class="font-normal text-normal">
                {{ props.selectedData?.noStokOpname }}
              </div>
            </div>
            <div>
              <div class="font-semibold underline text-SM">Tgl. Cut Off</div>
              <div class="font-normal text-normal">
                {{ epochToDate(props.selectedData?.tanggalCutOff, "date") }}
              </div>
            </div>
            <div>
              <div class="font-semibold underline text-SM">
                Judul Stok Opname
              </div>
              <div class="font-normal text-normal">
                {{ props.selectedData?.judulStokOpname }}
              </div>
            </div>
            <div>
              <div class="font-semibold underline text-SM">Jenis Stok</div>
              <div class="font-normal text-normal">
                {{ stokOpnameHeader?.jenisStok || "-" }}
              </div>
            </div>
            <div>
              <div class="font-semibold underline text-SM">Kategori Item</div>
              <div class="font-normal text-normal">
                {{ stokOpnameHeader?.kategori || "-" }}
              </div>
            </div>
            <div>
              <div class="font-semibold underline text-SM">Jenis Item</div>
              <div class="font-normal text-normal">
                {{ stokOpnameHeader?.jenisItem || "-" }}
              </div>
            </div>
          </div>
          <hr class="border-grey-200 mt-[10px]" />
        </template>
        <template #collapseIcon>
          <CustomButton
            icon="PhCaretUp"
            backgroundColor="bg-opensimrs-75"
            textColor="text-opensimrs-300"
          />
        </template>
        <template #expandIcon>
          <CustomButton
            icon="PhCaretDown"
            backgroundColor="bg-opensimrs-75"
            textColor="text-opensimrs-300"
          />
        </template>
      </CustomAccordion>
    </template>

    <template #content>
      <div class="flex flex-col gap-4 h-full">
        <div class="flex gap-7 items-end">
          <CustomTextfield
            label="Cari Nama Item / Kode Item"
            class="grow"
            placeholder="Cari Nama Item / Kode Item"
            v-model="searchQuery"
            @keyup.enter="handleSearch"
          />
          <CustomSelect
            label="Jenis Item"
            placeHolder="Pilih Jenis Item"
            v-model="jenisItem"
            :options="optionJenis"
            optionLabel="name"
            optionValue="value"
            class="w-[200px]"
          />
          <div class="flex gap-2.5">
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
              @click="handleReset"
            />
          </div>
        </div>

        <div v-if="hasData" class="relative flex-grow min-h-0">
          <DataTable
            :value="dummyData"
            stripedRows
            class="text-xs"
            scrollable
            scrollHeight="flex"
            :pt="{ headerRow: 'text-SM' }"
          >
            <Column headerClass="bg-opensimrs-50" class="w-[40px]">
              <template #header>
                <div class="font-semibold">No</div>
              </template>
              <template #body="slotProps">
                <div>
                  <div class="text-SM">{{ slotProps.index + 1 }}</div>
                </div>
              </template>
            </Column>
            <Column field="namaItem" headerClass="bg-opensimrs-50">
              <template #header>
                <div class="font-semibold">Nama Item</div>
              </template>
              <template #body="slotProps">
                <div class="text-SM">{{ slotProps.data.namaItem }}</div>
                <div class="flex flex-wrap">
                  <CustomChip
                    v-if="slotProps.data.kategori"
                    :label="slotProps.data.kategori.toUpperCase()"
                    :showCheckedIcon="false"
                    borderColor="border-opensimrs-300"
                    bgColor="bg-opensimrs-300"
                    textColor="text-white"
                    customClass="h-5"
                    class="ml-2"
                  />
                  <CustomChip
                    v-if="slotProps.data.jenisItem"
                    :label="slotProps.data.jenisItem.toUpperCase()"
                    :showCheckedIcon="false"
                    borderColor="border-opensimrs-300"
                    bgColor="bg-opensimrs-300"
                    textColor="text-white"
                    customClass="h-5"
                    class="ml-2"
                  />
                  <CustomChip
                    v-if="slotProps.data.jenisStok"
                    :label="slotProps.data.jenisStok.toUpperCase()"
                    :showCheckedIcon="false"
                    borderColor="border-opensimrs-300"
                    bgColor="bg-opensimrs-300"
                    textColor="text-white"
                    customClass="h-5"
                    class="ml-2"
                  />
                </div>
              </template>
            </Column>
            <Column headerClass="bg-opensimrs-50">
              <template #header>
                <div class="w-full font-semibold">Stok Awal</div>
              </template>
              <template #body="slotProps">
                <div class="font-normal text-SM">
                  {{ slotProps.data.stokAwal }}
                </div>
                <div class="font-normal text-[8px] text-opensimrs-300">
                  {{ slotProps.data.satuan }}
                </div>
              </template>
            </Column>
            <Column headerClass="bg-opensimrs-50">
              <template #header>
                <div class="w-full font-semibold">Stok Masuk</div>
              </template>
              <template #body="slotProps">
                <div class="font-normal text-SM">
                  {{ slotProps.data.stokMasuk }}
                </div>
                <div class="font-normal text-[8px] text-opensimrs-300">
                  {{ slotProps.data.satuan }}
                </div>
              </template>
            </Column>
            <Column headerClass="bg-opensimrs-50">
              <template #header>
                <div class="w-full font-semibold">Stok Keluar</div>
              </template>
              <template #body="slotProps">
                <div class="font-normal text-SM">
                  {{ slotProps.data.stokKeluar }}
                </div>
                <div class="font-normal text-[8px] text-opensimrs-300">
                  {{ slotProps.data.satuan }}
                </div>
              </template>
            </Column>
            <Column headerClass="bg-opensimrs-50">
              <template #header>
                <div class="w-full font-semibold">Stok Sistem</div>
              </template>
              <template #body="slotProps">
                <div class="font-normal text-SM">
                  {{ slotProps.data.stokSistem }}
                </div>
                <div class="font-normal text-[8px] text-opensimrs-300">
                  {{ slotProps.data.satuan }}
                </div>
              </template>
            </Column>
            <Column headerClass="bg-opensimrs-50" class="w-[100px]">
              <template #header>
                <div class="font-semibold">Stok Fisik</div>
              </template>
              <template #body="slotProps">
                <div class="font-normal text-SM">
                  {{ slotProps.data.stokFisik }}
                </div>
                <div class="font-normal text-[8px] text-opensimrs-300">
                  {{ slotProps.data.satuan }}
                </div>
              </template>
            </Column>
            <Column headerClass="bg-opensimrs-50">
              <template #header>
                <div class="w-full font-semibold">Selisih</div>
              </template>
              <template #body="slotProps">
                <div class="flex gap-1 ustify-between i">
                  <div class="flex flex-col">
                    <div class="text-SM">
                      {{ Math.abs(slotProps.data.selisih) }}
                    </div>
                    <div class="font-normal text-[8px] text-opensimrs-300">
                      {{ slotProps.data.satuan }}
                    </div>
                  </div>
                  <PhArrowCircleDown
                    v-if="slotProps.data.selisih < 0"
                    :size="18"
                    color="#E9594C"
                    weight="fill"
                  />
                  <PhArrowCircleUp
                    v-else-if="slotProps.data.selisih > 0"
                    :size="18"
                    color="#E89F29"
                    weight="fill"
                  />
                </div>
              </template>
            </Column>
            <Column headerClass="bg-opensimrs-50">
              <template #header>
                <div class="w-full font-semibold">Exp. Date</div>
              </template>
              <template #body="slotProps">
                <div class="font-normal text-SM">
                  {{
                    slotProps.data.ed
                      ? formatDate(new Date(slotProps.data.ed))
                      : "-"
                  }}
                </div>
              </template>
            </Column>
            <Column headerClass="bg-opensimrs-50">
              <template #header>
                <div class="w-full font-semibold">Harga Dasar</div>
              </template>
              <template #body="slotProps">
                <div class="font-normal text-SM">
                  {{ formatPrice(slotProps.data.hargaDasar) }}
                </div>
              </template>
            </Column>
            <Column headerClass="bg-opensimrs-50">
              <template #header>
                <div class="w-full font-semibold">Harga Akhir</div>
              </template>
              <template #body="slotProps">
                <div class="font-normal text-SM">
                  {{ formatPrice(slotProps.data.hargaAkhir) }}
                </div>
              </template>
            </Column>
          </DataTable>
        </div>
        <NoData v-else />
      </div>
    </template>

    <template #footer>
      <div
        v-if="hasData"
        class="flex justify-end pt-2 border-t border-grey-200"
      >
        <CustomPaginator
          :rows="DetailProperties.page_size"
          :totalRecords="DetailProperties.total"
          :rowsPerPageOptions="[10, 20, 30]"
          @page="handlePage"
        />
      </div>

      <!-- Info Footer -->
      <div class="flex gap-5 mb-[10px] mt-4">
        <CustomButton
          label="Cetak"
          class="my-auto bg-opensimrs-300"
          icon="PhPrinter"
          @click="handleExportExcel"
        />
        <div>
          <div class="font-semibold underline text-SM">Total Item SO</div>
          <div class="font-normal text-normal">
            {{ DetailProperties.total }} item
          </div>
        </div>
        <div>
          <div class="font-semibold underline text-SM">Tgl. Selesai SO</div>
          <div class="font-normal text-normal">
            {{ epochToDate(props.selectedData?.tanggalCutOff, "date") }}
          </div>
        </div>
        <div>
          <div class="font-semibold underline text-SM">Petugas SO</div>
          <div class="font-normal capitalize text-normal">
            {{ petugasSoName }}
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>
