<script lang="ts" setup>
import { ref, onMounted, watch } from "vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import { utilsStore } from "@/stores/utils";
import { useDataAntrianStore } from "@/stores/antrian/dataAntrian";
import NoData from "@/components/section/NoData.vue";
import {
  dateToEpoch,
  formatDate,
  formatTime,
  setTimeForDate,
} from "@/utils/Helpers";

const props = defineProps<{
  paginationProperties: {
    start_date: number | undefined;
    end_date: number | undefined;
    page: number;
    page_size: number;
    total: number;
    name: string;
    status_panggilan: number[];
    pelayanan: string;
  };
}>();

const startDateFilter = ref<Date>(new Date());
const endDateFilter = ref<Date>(new Date());

const dataTablePt = Object.freeze({ headerRow: "bg-blue-500 text-white" });

const emit = defineEmits<{
  updateTotalData: [totalData: number];
}>();

const dataAntrianStore = useDataAntrianStore();
const useUtilsStore = utilsStore();

const dataAntrianAdmisiPayload = ref([]);

const convertPaymentMethod = (jenisPasien: number | undefined): string => {
  const jp = jenisPasien ?? "";
  switch (jp) {
    case 1:
      return "TUNAI";
    case 2:
      return "BPJS";
    default:
      return "Tidak Diketahui"; // Default untuk nilai yang tidak valid
  }
};

watch(
  () => props.paginationProperties,
  () => {
    fetchGetDataAntrianAdmisi();
  },
  { deep: true }
);

const fetchGetDataAntrianAdmisi = async () => {
  useUtilsStore.setLoading(true);
  // Kosongkan data terlebih dahulu agar tidak menampilkan data lama saat loading/error
  dataAntrianAdmisiPayload.value = [];
  try {
    const startEpoch =
      props.paginationProperties.start_date ??
      dateToEpoch(setTimeForDate(startDateFilter.value, 0, 0, 0));
    const endEpoch =
      props.paginationProperties.end_date ??
      dateToEpoch(setTimeForDate(endDateFilter.value, 23, 59, 59));

    const statusQuery =
      props.paginationProperties.status_panggilan &&
      props.paginationProperties.status_panggilan.length > 0
        ? props.paginationProperties.status_panggilan.join(",")
        : "";

    const response = await dataAntrianStore.getAntrianAdmisi(
      startEpoch,
      endEpoch,
      props.paginationProperties.page,
      props.paginationProperties.page_size,
      props.paginationProperties.total,
      props.paginationProperties.name,
      statusQuery, // status_panggilan
      props.paginationProperties.pelayanan // pelayanan
    );
    console.log("Ini adalah data antrian admisi antrian", response);

    // Jika response sukses tapi payload kosong/tidak valid -> tampilkan NoData
    if (response && Array.isArray(response.payload)) {
      dataAntrianAdmisiPayload.value = response.payload;
      emit("updateTotalData", response.properties?.total ?? 0);
    } else {
      dataAntrianAdmisiPayload.value = [];
      emit("updateTotalData", 0);
    }
  } catch (error) {
    // Anggap "data tidak ditemukan" sebagai hasil kosong, bukan kegagalan UI
    console.log("No data or error fetching data antrian admisi:", error);
    dataAntrianAdmisiPayload.value = [];
    emit("updateTotalData", 0);
  } finally {
    useUtilsStore.setLoading(false);
  }
};

const dateTimeFormat = (timestamp: number | string): string => {
  if (timestamp === null || timestamp === undefined || timestamp === "")
    return "-";
  const epoch =
    typeof timestamp === "string"
      ? parseInt(timestamp as string, 10)
      : (timestamp as number);
  if (Number.isNaN(epoch)) return "-";
  const date = new Date(epoch * 1000);
  return `${formatDate(date)} ${formatTime(date)}`;
};

onMounted(() => {
  fetchGetDataAntrianAdmisi();
});

// Fungsi untuk mendapatkan style metode bayar
const getMetodeBayarStyle = (jenisPasien: number | undefined) => {
  const convertedMethod = convertPaymentMethod(jenisPasien).toLowerCase();

  if (convertedMethod === "tunai") {
    return {
      bgColor: "bg-opensimrs-50",
      textColor: "text-opensimrs-300",
      borderColor: "border-opensimrs-300",
    };
  } else if (convertedMethod === "bpjs") {
    return {
      bgColor: "bg-warning-50",
      textColor: "text-warning-300",
      borderColor: "border-warning-300",
    };
  } else {
    return {
      bgColor: "bg-gray-50",
      textColor: "text-gray-500",
      borderColor: "border-gray-300",
    };
  }
};

// Mapping style untuk status
const statusStyles = {
  antri: {
    bgColor: "bg-grey-50",
    textColor: "text-grey-300",
    borderColor: "border-grey-300",
    label: "ANTRI",
  },
  proses: {
    bgColor: "bg-warning-50",
    textColor: "text-warning-300",
    borderColor: "border-warning-300",
    label: "PROSES",
  },
  selesai: {
    bgColor: "bg-opensimrs-50",
    textColor: "text-opensimrs-300",
    borderColor: "border-opensimrs-300",
    label: "SELESAI",
  },
  default: {
    bgColor: "bg-gray-50",
    textColor: "text-gray-500",
    borderColor: "border-gray-300",
    label: "UNKNOWN",
  },
} as const;

const convertStatusRj = (statusRj: number): string => {
  switch (statusRj) {
    case 0:
      return "antri";
    case 1:
      return "antri";
    case 2:
      return "antri";
    case 3:
      return "proses";
    case 4:
      return "selesai";
    case 5:
      return "verifikasi obat";
    default:
      return "unknown";
  }
};

const expandedRows = ref();

const getStatusStyle = (status: string | undefined) => {
  if (!status) {
    return statusStyles.default;
  }
  const normalizedStatus = status.toLowerCase();
  return (
    statusStyles[normalizedStatus as keyof typeof statusStyles] ||
    statusStyles.default
  );
};
</script>

<template>
  <DataTable
    v-model:expandedRows="expandedRows"
    :value="dataAntrianAdmisiPayload"
    tableStyle="min-width: 50rem"
    :pt="dataTablePt"
    class="w-full text-xs"
    stripedRows
    dataKey="id"
    scrollable
    scrollHeight="flex"
    v-if="dataAntrianAdmisiPayload.length > 0"
  >
    <Column header-class="text-black bg-opensimrs-50">
      <template #header>
        <div class="w-full font-semibold text-center">No.</div>
      </template>
      <template #body="slotProps">
        <div class="flex justify-center items-center">
          {{
            (props.paginationProperties.page - 1) *
              props.paginationProperties.page_size +
            slotProps.index +
            1
          }}
        </div>
      </template>
    </Column>
    <Column
      header="Data kunjungan"
      header-class="text-black bg-opensimrs-50"
      class="p-0 w-auto"
    >
      <template #body="slotProps">
        <div class="space-y-1 text-SM">
          <!-- Baris Daftar -->
          <div class="grid grid-cols-[auto_16px_1fr] items-center gap-2">
            <div class="whitespace-nowrap">Daftar</div>
            <img
              src="@/assets/icons/solar_arrow-left-broken.svg"
              alt="Arrow Icon"
              class="mx-1 w-4 h-4"
            />
            <div class="whitespace-nowrap">
              {{ dateTimeFormat(slotProps.data.patientData.tanggalDaftar) }}
            </div>
          </div>
          <!-- Baris Kunjungan -->
          <div class="grid grid-cols-[auto_16px_1fr] items-center gap-2">
            <div class="whitespace-nowrap">Kunjungan</div>
            <img
              src="@/assets/icons/solar_arrow-left-broken (1).svg"
              alt="Arrow Icon"
              class="mx-1 w-4 h-4"
            />
            <div class="whitespace-nowrap">
              {{ dateTimeFormat(slotProps.data.patientData.tanggalCheckin) }}
            </div>
          </div>
        </div>
      </template>
    </Column>
    <Column
      header="Nomor"
      header-class="text-black bg-opensimrs-50"
      class="p-1 py-2"
    >
      <template #body="slotProps">
        <div class="text-SM max-w-[190px] space-y-2 text-nowrap">
          <div class="grid grid-cols-3">
            <div>Book</div>
            <div class="flex gap-5">
              <img
                src="@/assets/icons/solar_arrow-left-broken.svg"
                alt="Arrow Icon"
                class=""
              />
              <div>
                {{ slotProps.data.patientData.antrian.kodeBooking ?? "N/A" }}
              </div>
            </div>
          </div>
          <div class="grid grid-cols-3">
            <div>Antrian</div>
            <div class="flex gap-5">
              <img
                src="@/assets/icons/solar_arrow-left-broken (1).svg"
                alt="Arrow Icon"
                class=""
              />
              <div>
                {{
                  slotProps.data.patientData.antrian.noAntrianAdmisi ?? "N/A"
                }}
              </div>
            </div>
          </div>
        </div>
      </template>
    </Column>
    <Column header="Pasien" header-class="text-black bg-opensimrs-50" class="p-0"
      ><template #body="slotProps">
        <div class="items-center space-y-0.5">
          <div class="flex items-center font-semibold max-w-64">
            {{ slotProps.data.patientData?.name ?? "N/A" }}
          </div>
          <div class="flex items-center">
            <CustomChip
              :showCheckedIcon="false"
              :label="slotProps.data.patientData.noRm"
              bgColor="bg-opensimrs-300"
              textColor="text-white"
              border-color="border-opensimrs-300"
              customClass="h-5 "
            />
          </div>
        </div>
      </template>
    </Column>
    <Column
      field="metode_bayar"
      header="Metode Bayar"
      header-class="text-black bg-opensimrs-50"
      class="p-0"
      ><template #body="slotProps">
        <div class="flex items-center">
          <CustomChip
            :showCheckedIcon="false"
            :bgColor="
              getMetodeBayarStyle(slotProps.data.patientData.paymentMethod)
                .bgColor
            "
            :textColor="
              getMetodeBayarStyle(slotProps.data.patientData.paymentMethod)
                .textColor
            "
            :border-color="
              getMetodeBayarStyle(slotProps.data.patientData.paymentMethod)
                .borderColor
            "
            customClass="h-5"
            :label="
              convertPaymentMethod(
                slotProps.data.patientData.paymentMethod
              ).toUpperCase()
            "
          />
        </div> </template
    ></Column>
    <Column field="Status" headerClass="bg-opensimrs-50">
      <template #header>
        <div class="w-full font-semibold text-center">Status</div>
      </template>
      <template #body="slotProps">
        <div class="flex justify-center items-center">
          <CustomChip
            :showCheckedIcon="false"
            v-bind="
              getStatusStyle(convertStatusRj(slotProps.data.statusPanggilan))
            "
            customClass="h-5"
          />
        </div>
      </template>
    </Column>
  </DataTable>
  <NoData class="flex-1 h-full" v-else />
</template>
