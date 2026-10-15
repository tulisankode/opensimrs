<script setup lang="ts">
import { utilsStore } from "@/stores/utils";
import { fiturAktif } from "@/stores/modulFaskes";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import { onMounted, ref, computed, nextTick, type PropType } from "vue";
import { onBeforeRouteLeave, useRoute } from "vue-router";
import type { MenuItem } from "primevue/menuitem";
import HeaderFilter from "../Layout/OrderHeader.vue";
import NoData from "@/components/section/NoData.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import DaftarOrderLabPage from "./DaftarOrderLabPage.vue";
import EditOrderLabApsPage from "./EditOrderLabApsPage.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import MedicalRecord from "@/views/MedicalRecord/MedicalRecord.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomMultiSelect from "@/components/Base/CustomMultiSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomCheckbox from "@/components/Base/CustomCheckbox.vue";
import { useOrderLab } from "@/stores/Laboratorium/orderLab";
import {
  epochToDate,
  dateToEpoch,
  formatPrice,
  setTimeForDate,
} from "@/utils/Helpers";
import { usePraktisiStore } from "@/stores/datamaster/praktisi";
import { usePenjaminStore } from "@/stores/datamaster/penjamin";
import type { DataTableRowClickEvent } from "primevue/datatable";
import { useSpesimenLabStore } from "@/stores/datamasterLaboratorium/spesimenLab";
import OrderTindakan from "../Section/DaftarOrderLab/OrderTindakan.vue";
import { useForm, ErrorMessage } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { useToast } from "primevue/usetoast";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { useRekamMedisPelayananStore } from "@/stores/rekamMedis/rekamMedisPelayanan";
import { useLisStore } from "@/stores/Laboratorium/lis";
import { useAdmisiRJStore } from "@/stores/admisi/rawatJalan";

const stores = utilsStore();
const toast = useToast();
const rekamMedisStore = useRekamMedisStore();
const rekamMedisPelayananStore = useRekamMedisPelayananStore();
const admisiRJStore = useAdmisiRJStore();
const lisStore = useLisStore();
const orderLabStore = useOrderLab();
const praktisiStore = usePraktisiStore();
const penjaminStore = usePenjaminStore();
const spesimenLabStore = useSpesimenLabStore();
const listDpjp = ref<any[]>([]);
const listSpesimen = ref<any[]>([]);
const practitionerUuid = ref();
const listPenjamin = ref<any[]>([]);
const pageType = ref("");
const spesimen = ref<any[]>([]);
const orderLabProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});
const orderLabPayload = ref<any[]>([]);
const searchQuery = ref<string>("");

const route = useRoute();
const patientData = ref<any>({});
const startDateFilter = ref<Date>(new Date());
const endDateFilter = ref<Date>(new Date());
const orderTindakanRef = ref<InstanceType<typeof OrderTindakan> | null>(null);

const selectedPaymentMethod = ref<string[]>([]);
const onPaymentMethodSelect = (label: string) => {
  if (selectedPaymentMethod.value.includes(label)) {
    selectedPaymentMethod.value = selectedPaymentMethod.value.filter(
      (item) => item != label
    );
  } else {
    selectedPaymentMethod.value.push(label);
  }
  fetchOrderLab();
};

const formatDate = (dateString: string) => {
  if (!dateString) return "";

  const months = [
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

  const date = new Date(dateString);
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
};

const fetchOrderLab = async () => {
  stores.setLoading(true);
  try {
    const params: any = {
      page: orderLabProperties.value.page,
      limit: orderLabProperties.value.page_size,
      search: searchQuery.value,
      startDate: dateToEpoch(setTimeForDate(startDateFilter.value, 0, 0, 0)),
      endDate: dateToEpoch(setTimeForDate(endDateFilter.value, 23, 59, 59)),
    };

    if (selectedOrderType.value === "Order") {
      params.orderStatus = 1;
    } else if (selectedOrderType.value === "Batal") {
      params.orderStatus = 0;
    }

    if (selectedPaymentMethod.value !== null) {
      if (
        selectedPaymentMethod.value.includes("1") &&
        selectedPaymentMethod.value.includes("2")
      ) {
        params.paymentMethod = [];
      } else {
        params.paymentMethod = selectedPaymentMethod.value;
      }
    }

    const response = await orderLabStore.getApi(params);
    if (response && response.payload) {
      orderLabProperties.value.total = response.payload.pagination.total;
      orderLabPayload.value = response.payload.data;
    } else {
      orderLabPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    return [];
  } finally {
    stores.setLoading(false);
  }
};

const fetchUtils = async () => {
  try {
    const responseDpjp = await praktisiStore.getApi({
      limit: 9999,
      // nonDoctor: false,
    });
    if (responseDpjp && responseDpjp.payload) {
      listDpjp.value = responseDpjp.payload.filter(
        (praktisi: any) => praktisi.isDoctor && praktisi.status
      );
      console.log("List DPJP:", listDpjp.value);
    }

    const responseSpesimen = await spesimenLabStore.getApi(1, 9999, "");

    if (responseSpesimen && responseSpesimen.payload) {
      listSpesimen.value = responseSpesimen.payload.data;
      console.log("List Spesimen:", listSpesimen.value);
    } else {
      listSpesimen.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    stores.setLoading(false);
  }
};

const emits = defineEmits(["update:rows", "update:current-page"]);

const headerFilterRef = ref<typeof HeaderFilter>();
const resetFilter = () => {
  headerFilterRef.value?.resetFilter();
};

const dataBreadCrumb = ref<MenuItem[]>([]);

const changeSection = (label: string) => {
  if (dataBreadCrumb.value.length) {
    dataBreadCrumb.value[0] = { label: label };
  } else {
    dataBreadCrumb.value.push({ label: label });
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
  let date = new Date(),
    y = date.getFullYear(),
    m = date.getMonth();

  startDateFilter.value = new Date(y, m, 1);
  endDateFilter.value = new Date(y, m + 1, 0);
  fetchOrderLab();
  fetchUtils();
});

const selectedStatus = ref<any>();
const itemStatus = ref([
  { name: "Semua", code: "S1" },
  { name: "Belum Lunas", code: "S2" },
  { name: "Batal Order", code: "S3" },
]);

const showCancelVisit = ref(false);
const cancelReason = ref<string>();

const selectedPatient = ref([]);
const selectedOrderType = ref<string>("Order");

const onSelectOrderType = (label: string) => {
  selectedOrderType.value = label;
  console.log(selectedOrderType, "selectedOrderType");
  fetchOrderLab();
};

const medicalRecord = ref<typeof MedicalRecord>();
const rmPatientData = ref<any>(null);
const rmType = ref("rawat-jalan");

// Rekam medis pasien order: kandidat = kunjungan rawat jalan aktif (90 hari) + riwayat kunjungan
// berdasarkan No. RM; muat rekam medis kandidat pertama yang tersedia lalu buka RME mode riwayat (baca saja).
// Sebelumnya MedicalRecord dibuka dengan patientData kosong → error render, hanya backdrop.
const openDialogRM = async () => {
  const order = openedPatientData.value ?? {};
  const pesan = (detail: string) => toast.add({ severity: "warn", summary: "Rekam Medis", detail, life: 4000 });
  if (!order.noRm) return pesan("No. RM pasien tidak ditemukan pada order ini.");

  stores.setLoading(true);
  try {
    const sekarang = Math.floor(Date.now() / 1000);
    const [rjAktif, riwayat] = await Promise.all([
      admisiRJStore
        .getRJ({ q: order.noRm, limit: 10, startDate: String(sekarang - 90 * 86400), endDate: String(sekarang + 86400) })
        .catch(() => null),
      rekamMedisPelayananStore.getHistory(order.noRm).catch(() => null),
    ]);

    type Kandidat = { rekamMedisUuid: string; tanggal: number; noReg: string; tipe: string; data: () => Promise<any> };
    const kandidat: Kandidat[] = [
      ...(rjAktif?.payload ?? [])
        .filter((v: any) => v.noRm === order.noRm && v.rekamMedisUuid)
        .map((v: any) => ({
          rekamMedisUuid: v.rekamMedisUuid,
          tanggal: Number(v.tanggalDaftar),
          noReg: v.noReg,
          tipe: "rawat-jalan",
          data: async () => (await admisiRJStore.getDetailRJ(v.uuid))?.payload ?? v,
        })),
      ...(riwayat?.payload ?? [])
        .filter((v: any) => v.rekamMedisUuid)
        .map((v: any) => ({
          rekamMedisUuid: v.rekamMedisUuid,
          tanggal: Number(v.tanggalDaftar),
          noReg: v.noReg,
          tipe: v.statusRi !== undefined ? "rawat-inap" : v.statusIgd !== undefined ? "igd" : "rawat-jalan",
          data: async () => v,
        })),
    ].sort((a, b) => {
      const cocokA = order.noreg && a.noReg === order.noreg ? 1 : 0;
      const cocokB = order.noreg && b.noReg === order.noreg ? 1 : 0;
      return cocokB - cocokA || b.tanggal - a.tanggal;
    });
    if (!kandidat.length) {
      return pesan("Pasien belum memiliki rekam medis kunjungan (mis. pasien APS/luar).");
    }

    // sebagian kunjungan lama merujuk rekam medis yang sudah tidak ada (404): coba kandidat berikutnya
    let kunjungan: Kandidat | null = null;
    let response: any = null;
    const sudahDicoba = new Set<string>();
    for (const item of kandidat) {
      if (sudahDicoba.has(item.rekamMedisUuid)) continue;
      sudahDicoba.add(item.rekamMedisUuid);
      try {
        response = await rekamMedisStore.getRekamMedis({ rekamMedisUuid: item.rekamMedisUuid });
      } catch {
        response = null;
      }
      if (response?.payload) {
        kunjungan = item;
        break;
      }
    }
    if (!kunjungan) return pesan("Rekam medis kunjungan pasien tidak dapat dimuat.");

    const dataKunjungan = await kunjungan.data();
    rmType.value = kunjungan.tipe;
    rmPatientData.value = {
      ...dataKunjungan,
      patient: dataKunjungan.patient ?? order.patient,
      noRm: order.noRm,
      rekamMedisUuid: response.payload.meta?.rekamMedisUuid ?? kunjungan.rekamMedisUuid,
    };
    // MedicalRecord memilih sesi lewat watch pada data rekam medis di store:
    // pasang komponennya dulu, baru isi data rekam medis, lalu buka dialog
    await nextTick();
    rekamMedisStore.setOpenedRekamMedisData(response.payload);
    await nextTick();
    medicalRecord.value?.showDialogRM();
  } catch (error) {
    console.error("Gagal membuka rekam medis:", error);
    pesan("Terjadi kesalahan saat memuat rekam medis.");
  } finally {
    stores.setLoading(false);
  }
};
const popupDialog = ref(false);
const dialogData = ref<any>(null);
const openedPatientData = ref<any>({});

const showDetailPatient = async (event: DataTableRowClickEvent) => {
  stores.setLoading(true);
  try {
    const responsePatient = await orderLabStore.getDetailPasien(
      event.data.uuid
    );
    if (responsePatient && responsePatient.payload) {
      openedPatientData.value = responsePatient.payload;
      // Dokter otomatis: dokter pengirim order (bila terdaftar sebagai DPJP), atau satu-satunya dokter faskes.
      const dokterOrder = responsePatient.payload.dokterPengirimUuid;
      practitionerUuid.value = listDpjp.value.some((d: any) => d.uuid === dokterOrder)
        ? dokterOrder
        : listDpjp.value.length === 1
          ? listDpjp.value[0].uuid
          : practitionerUuid.value ?? null;
    } else {
      openedPatientData.value = {};
    }
    popupDialog.value = true;
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    stores.setLoading(false);
  }
};

const handleCancelOrder = async () => {
  stores.setLoading(true);
  try {
    const tempUuid: any[] = [];
    selectedPatient.value.forEach((item: any) => {
      tempUuid.push(item.uuid);
    });

    const updatedPayload = {
      orderLabUuids: tempUuid,
      orderStatus: 0, // Status batal
      alasanBatalOrder: cancelReason.value, // Alasan batal
    };

    const responseCancel = await orderLabStore.putApiBatalOrder(updatedPayload);
    if (responseCancel && responseCancel.data) {
      showCancelVisit.value = false;
      cancelReason.value = "";
      selectedPatient.value = [];
      fetchOrderLab();
    }
  } catch (error) {
    console.error("Failed to cancel order:", error);
  } finally {
    stores.setLoading(false);
  }
};

const validationSchema = toTypedSchema(
  yup.object({
    practitionerUuid: yup.string().required("Dokter harus dipilih"),
    spesimen: yup.array().nullable(),
  })
);

const { handleSubmit, setFieldError } = useForm({
  validationSchema,
  initialValues: {
    spesimen: [],
  },
});

// Validasi order: konfirmasi dua pilihan — "Validasi saja" atau "Validasi & Kirim ke LIS" (adamLIS).
// Validasi tetap sah walau pengiriman ke LIS gagal; pengiriman dapat diulang dari Setting › Pengiriman LIS.
const dialogValidasi = ref(false);
const koneksiLis = ref<any[]>([]);
const koneksiLisDipilih = ref("");
const bukaDialogValidasi = async () => {
  dialogValidasi.value = true;
  const res = await lisStore.getKoneksi();
  koneksiLis.value = (res?.payload ?? []).filter((k: any) => k.aktif);
  koneksiLisDipilih.value = (koneksiLis.value.find((k: any) => k.bawaan) ?? koneksiLis.value[0])?.uuid ?? "";
};

const handleValidasi = async (kirimLis = false) => {
  dialogValidasi.value = false;
  stores.setLoading(true);
  try {
    const updatedPayload: Record<string, unknown> = {
      spesimenUuids: spesimen.value,
      practitionerUuid: practitionerUuid.value,
    };
    if (kirimLis) {
      updatedPayload.kirimLis = true;
      updatedPayload.koneksiUuid = koneksiLisDipilih.value || null;
    }

    const responseCancel = await orderLabStore.putApiValidasi(
      openedPatientData.value.uuid,
      updatedPayload
    );
    // Gagal kirim LIS = validasi gagal (galat server ditampilkan apiHandler); sampai sini berarti terkirim.
    const lis = responseCancel?.data?.payload?.lis;
    if (lis) {
      toast.add({ severity: "success", summary: `Divalidasi & terkirim ke ${lis.lis}`, detail: `No. Lab ${lis.noLab ?? "-"}`, life: 5000 });
    }
    if (responseCancel && responseCancel.data) {
      selectedPatient.value = [];
      popupDialog.value = false;
      fetchOrderLab();
    }
  } catch (error) {
    console.error("Failed to cancel order:", error);
  } finally {
    stores.setLoading(false);
  }
};

const handleEditOrder = async () => {
  stores.setLoading(true);
  let tempOrderTindakanData;
  tempOrderTindakanData = await orderTindakanRef.value?.onSubmit();
  let payload: any = {
    ...tempOrderTindakanData,
  };
  try {
    const response = await orderLabStore.putApiEdit(
      openedPatientData.value.uuid,
      payload
    );
    if (response && response.data) {
      editOrderDialog.value = false;
      popupDialog.value = false;
      fetchOrderLab();
    }
  } catch (error) {
    console.error("Failed to process the data:", error);
  } finally {
    stores.setLoading(false);
  }
};

const onPopupDialogClose = (isVisible: boolean) => {
  if (!isVisible) {
    practitionerUuid.value = null;
    spesimen.value = [];
  }
};

// Filter Search Data
const searchData = () => {
  searchQuery.value;
  dateToEpoch(startDateFilter.value);
  dateToEpoch(endDateFilter.value);
  fetchOrderLab();
};

// Filter Reset Data
const resetData = () => {
  searchQuery.value = "";
  startDateFilter.value = new Date();
  endDateFilter.value = new Date();
  selectedPaymentMethod.value = [];
  fetchOrderLab();
};

const editIdentitas = () => {
  popupDialog.value = false;
  changeSection("Edit Order");
};
const handleBack = () => {
  popupDialog.value = true; // Menampilkan popup dialog
  dataBreadCrumb.value = [];
};
const editOrderDialog = ref(false);

const handlePage = (event: any) => {
  orderLabProperties.value.page = event.page + 1;
  orderLabProperties.value.page_size = event.rows;
  fetchOrderLab();
};

const totalTagihanLab = computed(() => {
  if (!openedPatientData.value?.orderLabPemeriksaan) return 0;

  return openedPatientData.value.orderLabPemeriksaan.reduce(
    (total: number, item: any) => {
      return total + (item.tarifLab?.grandTotal || 0);
    },
    0
  );
});
</script>

<template>
  <div class="flex flex-col w-full h-full overflow-hidden">
    <Card
      v-if="dataBreadCrumb.length == 0"
      pt:body:class="h-full pt-0 overflow-auto"
      pt:content:class="h-full overflow-auto"
      class="h-full overflow-hidden"
    >
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="fetchOrderLab" />
          <CustomBreadCrumb :home="{ label: 'Order Lab', home: true }" />
          <CustomTextfield
            v-model="searchQuery"
            label="Pencarian"
            prependIcon="PhMagnifyingGlass"
            placeholder="Cari Nama / Alamat / No. RM"
            @keydown.enter="searchData"
          />
          <CustomSelect
            v-model="selectedStatus"
            :options="itemStatus"
            label="Status"
            optionLabel="name"
            optionValue="code"
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
          <ToolbarFilterMenu :count="selectedPaymentMethod.length">
            <template #label>Pembayaran</template>
            <CustomChip
              label="TUNAI"
              value="1"
              :isSelected="selectedPaymentMethod.includes('1')"
              @selected="onPaymentMethodSelect"
            />
            <CustomChip
              label="ASURANSI"
              value="2"
              :isSelected="selectedPaymentMethod.includes('2')"
              @selected="onPaymentMethodSelect"
            />
          </ToolbarFilterMenu>
          <div class="flex items-center gap-1 shrink-0" role="group" aria-label="Jenis order">
            <CustomButton
              @click="onSelectOrderType('Order')"
              label="Order"
              :outlined="selectedOrderType != 'Order'"
              borderColor="border-opensimrs-300"
              :textColor="selectedOrderType != 'Order' ? 'text-opensimrs-300' : 'text-white'"
              :backgroundColor="selectedOrderType != 'Order' ? 'bg-transparent' : 'bg-opensimrs-300'"
              class="font-semibold"
            />
            <CustomButton
              @click="onSelectOrderType('Batal')"
              label="Batal"
              :outlined="selectedOrderType != 'Batal'"
              borderColor="border-opensimrs-300"
              :textColor="selectedOrderType != 'Batal' ? 'text-opensimrs-300' : 'text-white'"
              :backgroundColor="selectedOrderType != 'Batal' ? 'bg-transparent' : 'bg-opensimrs-300'"
              class="font-semibold"
            />
          </div>
          <CustomButton
            @click="searchData"
            icon="PhMagnifyingGlass"
            label="Cari"
            borderColor="border-opensimrs-300"
          />
          <CustomButton
            @click="resetData"
            label="Reset"
            outlined
            borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300"
          />
          <CustomButton @click="changeSection('Daftar')" icon="PhPlus" label="Order" />
        </PageToolbar>
      </template>
      <template #content>
        <DataTable
          v-if="orderLabPayload.length"
          v-model:selection="selectedPatient"
          :value="orderLabPayload"
          tableStyle="min-width: 50rem"
          scrollable
          scrollHeight="flex"
          :pt="{ headerRow: 'text-SM' }"
          @rowClick="showDetailPatient"
        >
          <Column field="nomor" headerClass="bg-opensimrs-50">
            <template #header>
              <div class="w-full font-semibold text-center">Nomor</div>
            </template>
            <template #body="slotProps">
              <div class="text-center">
                <div class="text-SM">{{ slotProps.data.noRm }}</div>
                <div class="text-SM">{{ slotProps.data.noreg }}</div>
                <div class="text-SM">{{ slotProps.data.noOrder }}</div>
              </div>
            </template>
          </Column>
          <Column field="pasien" header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">
                <!-- {{ slotProps.data.patient?.birthDetail }} -->
                <span class="font-semibold">{{
                  slotProps.data.patient?.name
                }}</span>
                <span class="text-grey-300">
                  ({{ slotProps.data.patient?.birthDetail?.ageYear }}Th
                  {{ slotProps.data.ageMonth }}Bln
                  {{ slotProps.data.ageDay }}Hr)
                </span>
              </div>
              <div class="text-XS">
                {{ slotProps.data.patientAddress }},
                {{ slotProps.data.patient?.address?.districtData?.name }},
                {{ slotProps.data.patient?.address?.cityData?.name }},
                {{ slotProps.data.patient?.address?.provData?.name }}
              </div>
              <div class="flex flex-wrap">
                <CustomChip
                  :showCheckedIcon="false"
                  :label="
                    slotProps.data.patient?.gender == 'Female'
                      ? 'Perempuan'
                      : 'Laki-laki'
                  "
                  :bgColor="
                    slotProps.data.patient?.gender == 'Female'
                      ? 'bg-female-75'
                      : 'bg-male-75'
                  "
                  :textColor="
                    slotProps.data.patient?.gender == 'Female'
                      ? 'text-female-300'
                      : 'text-male-300'
                  "
                  customClass="h-5 pr-[6px] border-none mr-[5px]"
                />
                <CustomChip
                  :showCheckedIcon="false"
                  :label="slotProps.data.patient?.phone"
                  bgColor="bg-opensimrs-50"
                  textColor="text-opensimrs-300"
                  customClass="h-5 pr-[6px] border-none mr-[5px]"
                />
              </div>
            </template>
          </Column>
          <Column
            field="keperawatan"
            header="Keperawatan"
            headerClass="bg-opensimrs-50"
          >
            <template #body="slotProps">
              <div class="text-SM">
                {{ slotProps.data.dokterPengirim?.firstTitle }}
                {{ slotProps.data.dokterPengirim?.name }}
                {{ slotProps.data.dokterPengirim?.lastTitle }}
              </div>
              <div class="flex flex-wrap">
                <CustomChip
                  :showCheckedIcon="false"
                  :label="slotProps.data.pelayanan"
                  customClass="h-5 pr-[5px] mr-[5px]"
                />
                <CustomChip v-if="slotProps.data.isMcu" :showCheckedIcon="false" label="MCU" bgColor="bg-warning-50" textColor="text-warning-300" borderColor="border-warning-300" customClass="h-5 pr-[5px] mr-[5px]" />
                <CustomChip
                  :showCheckedIcon="false"
                  :label="slotProps.data.lokasi?.name"
                  customClass="h-5 pr-[5px] mr-[5px]"
                />
                <CustomChip
                  :showCheckedIcon="false"
                  :label="
                    slotProps.data.paymentMethod == 1 ? 'TUNAI' : 'ASURANSI'
                  "
                  :bgColor="
                    slotProps.data.paymentMethod == 1
                      ? 'bg-opensimrs-50'
                      : 'bg-warning-50'
                  "
                  :textColor="
                    slotProps.data.paymentMethod == 1
                      ? 'text-opensimrs-300'
                      : 'text-warning-300'
                  "
                  :borderColor="
                    slotProps.data.paymentMethod == 1
                      ? 'border-opensimrs-300'
                      : 'border-warning-300'
                  "
                  customClass="h-5 pr-[6px] mr-[5px]"
                />
                <CustomChip
                  v-if="slotProps.data.no_SEP"
                  :showCheckedIcon="false"
                  :label="`SEP.${slotProps.data.no_SEP}`"
                  bgColor="bg-warning-50"
                  textColor="text-warning-300"
                  borderColor="border-warning-300"
                  customClass="h-5 pr-[6px]"
                />
              </div>
            </template>
          </Column>
          <Column
            field="data-kunjungan"
            header="Data Kunjungan"
            headerClass="bg-opensimrs-50"
            style="width: 25%"
          >
            <template #body="slotProps">
              <div class="text-SM">
                <div
                  class="grid content-center grid-cols-[80px_min-content_150px] auto-cols-min"
                >
                  Daftar
                  <PhArrowRight
                    :size="18"
                    class="my-auto mr-5 text-info-300"
                    weight="bold"
                  />
                  {{
                    epochToDate(
                      parseInt(slotProps.data.tglOrder) / 1000,
                      "date"
                    )
                  }}

                  {{
                    epochToDate(
                      parseInt(slotProps.data.tglOrder) / 1000,
                      "time"
                    )
                  }}
                </div>
                <div
                  class="grid content-center grid-cols-[80px_min-content_150px] mt-[5px]"
                >
                  Jadwal
                  <PhArrowRight
                    :size="18"
                    class="my-auto mr-5 text-sunFlower-300"
                    weight="bold"
                  />
                  {{
                    epochToDate(parseInt(slotProps.data.tglPemeriksaan), "date")
                  }}
                  {{
                    epochToDate(parseInt(slotProps.data.tglPemeriksaan), "time")
                  }}
                </div>
              </div>
            </template>
          </Column>
          <Column
            v-if="showCancelVisit"
            selectionMode="multiple"
            headerStyle="width: 3rem"
            headerClass="bg-opensimrs-50"
            class="custom-checkbox"
          ></Column>
        </DataTable>
        <NoData v-else />
      </template>
      <template #footer>
        <div class="flex justify-between">
          <div class="flex">
            <CustomButton
              v-if="!showCancelVisit"
              @click="showCancelVisit = true"
              class="my-auto bg-danger-300"
              label="Batal Order"
            />

            <CustomButton
              v-if="showCancelVisit"
              @click="showCancelVisit = false"
              class="my-auto mr-[10px]"
              label="Batal"
              outlined
              borderColor="border-grey-200"
              textColor="text-grey-300"
            />

            <CustomButton
              v-if="showCancelVisit"
              @click="handleCancelOrder"
              class="my-auto mr-[10px] bg-danger-300 w-[20%]"
              label="Iya, Batalkan"
              :disabled="!cancelReason"
            />

            <CustomTextfield
              v-if="showCancelVisit"
              v-model="cancelReason"
              :showLabel="false"
              class="my-auto w-[400px]"
              placeholder="Alasan Batal Order"
            />
          </div>
          <CustomPaginator
            :rows="orderLabProperties.page_size"
            :totalRecords="orderLabProperties.total"
            :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePage"
          />
        </div>
      </template>
    </Card>

    <DaftarOrderLabPage
      v-else-if="dataBreadCrumb[0].label == 'Daftar'"
      :dataBreadCrumb="dataBreadCrumb"
      :pageType="pageType"
      :patientData="patientData"
      @fetchOrderLab="fetchOrderLab"
      @back="dataBreadCrumb.pop()"
    />
    <EditOrderLabApsPage
      v-else-if="dataBreadCrumb[0].label == 'Edit Order'"
      :dataBreadCrumb="dataBreadCrumb"
      :pageType="pageType"
      :patientData="patientData"
      @back="handleBack"
    />

    <!-- Pop Up Dialog -->
    <CustomDialog
      v-model:visible="popupDialog"
      width="1000px"
      @update:visible="onPopupDialogClose"
    >
      <template #header>
        <div class="flex justify-between">
          <div class="flex">
            <p>
              Detail Order Lab
              <CustomChip
                :label="openedPatientData.pelayanan"
                :showCheckedIcon="false"
                borderColor="border-opensimrs-300"
                bgColor="bg-opensimrs-50"
                textColor="text-opensimrs-300"
                customClass="h-6"
              />
                <CustomChip v-if="openedPatientData.isMcu" :showCheckedIcon="false" label="MCU" bgColor="bg-warning-50" textColor="text-warning-300" borderColor="border-warning-300" customClass="h-5 pr-[5px] mr-[5px]" />
              <CustomChip
                :showCheckedIcon="false"
                :label="
                  openedPatientData.paymentMethod == 1 ? 'TUNAI' : 'ASURANSI'
                "
                :bgColor="
                  openedPatientData.paymentMethod == 1
                    ? 'bg-opensimrs-50'
                    : 'bg-warning-50'
                "
                :textColor="
                  openedPatientData.paymentMethod == 1
                    ? 'text-opensimrs-300'
                    : 'text-warning-300'
                "
                :borderColor="
                  openedPatientData.paymentMethod == 1
                    ? 'border-opensimrs-300'
                    : 'border-warning-300'
                "
                customClass="h-6"
              />
            </p>
          </div>

          <div class="flex ml-[200px]">
            <div class="bg-white w-[1px] h-[30px]"></div>
            <p class="text-sm ml-[10px] mt-[3px]">
              Tgl. Order :
              {{
                epochToDate(parseInt(openedPatientData.tglOrder) / 1000, "date")
              }}
            </p>
          </div>
        </div>
      </template>
      <template #body>
        <div>
          <div class="pt-5 mb-20">
            <div class="grid grid-cols-3 gap-4 mt-8">
              <div class="basis-1/4">
                <p class="font-bold text-MD">
                  {{ openedPatientData.patient?.name }}
                </p>
                <p>{{ openedPatientData.noreg }}</p>
                <CustomButton class="w-24 h-5 text-sm">{{
                  openedPatientData.noRm
                }}</CustomButton>
                <CustomChip
                  :showCheckedIcon="false"
                  :label="
                    openedPatientData.patient?.gender == 'Female'
                      ? 'Perempuan'
                      : 'Laki-laki'
                  "
                  :bgColor="
                    openedPatientData.patient?.gender == 'Female'
                      ? 'bg-female-75'
                      : 'bg-male-75'
                  "
                  :textColor="
                    openedPatientData.patient?.gender == 'Female'
                      ? 'text-female-300'
                      : 'text-male-300'
                  "
                  customClass="h-5 pr-[6px] border-none mr-[5px] ml-2"
                />
              </div>
              <div class="flex">
                <div class="bg-mediumGrey-300 w-[1px] h-[85px] mr-[20px]"></div>
                <div class="mt-[20px] mr-[40px]">
                  <p class="text-xs font-bold underline underline-offset-2">
                    Tgl. Lahir
                  </p>
                  <p class="">
                    {{
                      formatDate(
                        openedPatientData.patient?.birthDetail?.birthDate
                      )
                    }}
                  </p>
                </div>
              </div>
              <div class="mt-[20px] mr-[40px]">
                <p class="text-xs font-bold underline underline-offset-2">
                  Umur
                </p>
                <p class="">
                  {{ openedPatientData.patient?.birthDetail?.ageYear }}Th
                  {{ openedPatientData.patient?.birthDetail?.ageMonth }}Bln
                  {{ openedPatientData.patient?.birthDetail?.ageDay }}Hr
                </p>
              </div>
            </div>

            <!-- Profil Pasien  -->

            <div class="grid grid-cols-1 mt-2">
              <CustomAccordion
                no-border
                :openWithHeader="false"
                initial-state="0"
              >
                <template #header>
                  <div class="flex justify-between w-full mt-5">
                    <div class="mt-4 basis-1/4">
                      <p class="font-bold text-MD">Profil Pasien</p>
                    </div>
                  </div>
                </template>
                <template #content>
                  <div class="grid grid-cols-3 gap-4 mt-8">
                    <div class="">
                      <p class="text-xs font-bold underline underline-offset-2">
                        KTP
                      </p>
                      <p>{{ openedPatientData.patient?.noIdentity }}</p>
                      <p
                        class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                      >
                        Agama
                        <span> </span>
                      </p>
                      <p>
                        {{ openedPatientData.patient?.religion }}
                      </p>
                      <p
                        class="mt-3 text-xs font-bold underline underline-offset-2"
                      >
                        Kecamatan
                      </p>
                      <p>
                        {{
                          openedPatientData.patient?.address?.districtData?.name
                        }}
                      </p>
                      <p
                        class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                      >
                        Kode Pos
                        <span> </span>
                      </p>
                      <p>
                        {{ openedPatientData.patient?.address?.postalCode }}
                      </p>
                    </div>

                    <div>
                      <p class="text-xs font-bold underline underline-offset-2">
                        Tgl. Lahir
                      </p>
                      <p class="">
                        {{
                          formatDate(
                            openedPatientData.patient?.birthDetail?.birthDate
                          )
                        }}
                      </p>
                      <p
                        class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                      >
                        Provinsi
                      </p>
                      <p class="">
                        {{ openedPatientData.patient?.address?.provData?.name }}
                      </p>
                      <p
                        class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                      >
                        Kelurahahn / Desa
                      </p>
                      <p class="">
                        {{
                          openedPatientData.patient?.address?.villageData?.name
                        }}
                      </p>
                      <p
                        class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                      >
                        Alamat
                      </p>
                      <p class="">
                        {{ openedPatientData.patient?.address?.fullAddress }}
                      </p>
                    </div>
                    <div>
                      <p class="text-xs font-bold underline underline-offset-2">
                        No. Handphone
                      </p>
                      <p class="">{{ openedPatientData.patient?.phone }}</p>
                      <p
                        class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                      >
                        Kabupaten / Kota
                      </p>
                      <p class="">
                        {{ openedPatientData.patient?.address?.cityData?.name }}
                      </p>
                      <div class="flex flex-row mt-[10px]">
                        <div class="basis-1/4">
                          <p
                            class="text-xs font-bold underline underline-offset-2"
                          >
                            RT
                          </p>
                          <p>{{ openedPatientData.patient?.address?.rt }}</p>
                        </div>
                        <div class="basis-1/4">
                          <p
                            class="text-xs font-bold underline underline-offset-2"
                          >
                            RW
                          </p>
                          <p>{{ openedPatientData.patient?.address?.rw }}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
                <template #collapseIcon>
                  <CustomButton
                    icon="PhCaretUp"
                    backgroundColor="bg-transparent"
                    textColor="text-opensimrs-300"
                  />
                </template>
                <template #expandIcon>
                  <CustomButton
                    icon="PhCaretDown"
                    backgroundColor="bg-transparent"
                    textColor="text-opensimrs-300"
                  />
                </template>
              </CustomAccordion>
            </div>

            <!-- Asesmen Medis -->
            <div class="grid grid-cols-1 mt-2">
              <CustomAccordion
                no-border
                :openWithHeader="false"
                initial-state="0"
              >
                <template #header>
                  <div class="flex justify-between w-full mt-5">
                    <div class="mt-4 basis-1/4">
                      <p class="font-bold text-MD">Asesmen Medis</p>
                    </div>
                    <div>
                      <CustomButton
                        @click="openDialogRM"
                        label="Rekam Medis"
                        class="mr-4"
                      />
                    </div>
                  </div>
                </template>
                <template #content>
                  <div class="grid grid-cols-3 gap-4 mt-8">
                    <div class="basis-1/4">
                      <p class="text-xs font-bold underline underline-offset-2">
                        Unit Asal
                      </p>
                      <p>{{ openedPatientData.lokasi?.name }}</p>
                      <p
                        class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                      >
                        Maternitas
                        <span> </span>
                      </p>
                      <p>
                        {{
                          openedPatientData.pasienMaternitas ? "Iya" : "Tidak"
                        }}
                      </p>
                      <p
                        class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                      >
                        Catatan
                        <span> </span>
                      </p>
                      <p>{{ openedPatientData.catatan }}</p>
                    </div>

                    <div>
                      <div class="flex">
                        <p
                          class="mr-2 text-xs font-bold underline underline-offset-2"
                        >
                          Dokter Pengirim
                        </p>
                        <CustomChip
                          :showCheckedIcon="false"
                          :label="openedPatientData.pelayanan"
                          customClass="h-5 pr-[5px] mr-[5px]"
                        />
                <CustomChip v-if="openedPatientData.isMcu" :showCheckedIcon="false" label="MCU" bgColor="bg-warning-50" textColor="text-warning-300" borderColor="border-warning-300" customClass="h-5 pr-[5px] mr-[5px]" />
                      </div>
                      <p class="">
                        {{
                          openedPatientData.dokterPengirim?.pegawai?.firstTitle
                        }}
                        {{ openedPatientData.dokterPengirim?.pegawai?.name }}
                        {{
                          openedPatientData.dokterPengirim?.pegawai?.lastTitle
                        }}
                      </p>
                      <p
                        class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                      >
                        Keluhan Utama
                      </p>
                      <p class="">{{ openedPatientData.keluhanUtama }}</p>
                      <p
                        class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                      >
                        Alergi
                      </p>
                      <p class="">Tidak Ada</p>
                    </div>
                    <div class="flex mr-[80px]">
                      <div
                        class="bg-mediumGrey-300 w-[1px] h-[135px] mr-[20px]"
                      ></div>
                      <div class="">
                        <p
                          class="text-xs font-bold underline underline-offset-2"
                        >
                          Diagnosa Sekunder
                        </p>
                        <p class="">{{ openedPatientData.diagnosis }}</p>
                        <p
                          class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                        >
                          Diagnosa Sekunder
                        </p>
                        <p class="">-</p>
                      </div>
                    </div>
                  </div>
                </template>
                <template #collapseIcon>
                  <CustomButton
                    icon="PhCaretUp"
                    backgroundColor="bg-transparent"
                    textColor="text-opensimrs-300"
                  />
                </template>
                <template #expandIcon>
                  <CustomButton
                    icon="PhCaretDown"
                    backgroundColor="bg-transparent"
                    textColor="text-opensimrs-300"
                  />
                </template>
              </CustomAccordion>
            </div>

            <!-- List Order  -->
            <div class="grid grid-cols-1 mt-[20px]">
              <CustomAccordion
                no-border
                :openWithHeader="false"
                initial-state="0"
              >
                <template #header>
                  <div class="flex justify-between w-full">
                    <div class="mt-2">
                      <p>List Pemeriksaan Lab</p>
                    </div>
                    <div class="flex mt-2 ml-[300px]">
                      <div class="bg-mediumGrey-300 w-[1px] h-[30px]"></div>
                      <p class="text-xs ml-2 mt-[3px]">
                        Tgl. Pemeriksaan Lab :
                        {{
                          epochToDate(
                            parseInt(openedPatientData.tglPemeriksaan),
                            "date"
                          )
                        }}
                      </p>
                    </div>

                    <div class="ml-[10px] items-center">
                      <!-- <CustomButton
                        v-if="openedPatientData.pelayanan === 'aps'"
                        label="Edit Order"
                        @click="editIdentitas"
                        class="mr-4"
                      /> -->
                      <CustomButton
                        label="Edit Order"
                        @click="editOrderDialog = true"
                        class="mr-4"
                      />
                    </div>
                  </div>
                </template>
                <template #content>
                  <div class="flex mt-[20px]">
                    <CustomSelect
                      v-model="practitionerUuid"
                      label="Dokter Pengirim"
                      placeHolder="Pilih dokter Pengirim"
                      optionLabel="pegawai.name"
                      optionValue="uuid"
                      :showFilter="false"
                      :options="listDpjp"
                      class="mr-3 w-[40%]"
                      :invalid="!practitionerUuid"
                      :errorMessage="
                        !practitionerUuid
                          ? 'Dokter Pengirim tidak boleh kosong'
                          : ''
                      "
                    />
                    <CustomMultiSelect
                      v-model="spesimen"
                      placeholder="Pilih Spesimen"
                      label="Spesimen"
                      optionLabel="name"
                      optionValue="uuid"
                      :maxSelectedLabels="4"
                      :options="listSpesimen"
                      class="mr-3 grow"
                    />
                  </div>
                  <div class="mt-[40px]">
                    <card class="bg-opensimrs-50">
                      <template #content>
                        <div class="flex justify-between">
                          <div class="flex">
                            <p class="text-base font-bold text-opensimrs-300">
                              {{ openedPatientData.noOrder }}
                            </p>
                            <div
                              class="bg-black w-[2px] h-[15px] ml-2 mt-1"
                            ></div>
                            <p class="ml-2 text-base">Nama Tarif Pemeriksaan</p>
                          </div>
                        </div>
                      </template>
                    </card>
                    <div class="pt-5 mt-[-20px]">
                      <DataTable
                        :value="openedPatientData.orderLabPemeriksaan"
                        class="overflow-hidden rounded-[10px]"
                        scrollable
                        scrollHeight="flex"
                        :pt="{ headerRow: 'text-SM', thead: 'z-0' }"
                      >
                        <Column field="pemeriksaanName" class="w-[80%]">
                          <template #header>
                            <div class="font-bold">Pemeriksaan</div>
                          </template>
                          <template #body="slotProps">
                            <div class="flex justify-between">
                              <div>
                                <p class="text-SM">
                                  {{ slotProps.data.tarifLab?.name }}
                                </p>
                              </div>
                            </div>
                          </template>
                        </Column>
                        <!-- Harga -->
                        <Column field="harga">
                          <template #header>
                            <div class="font-bold text-end">Harga</div>
                          </template>
                          <template #body="slotProps">
                            <div class="text-SM text-end">
                              {{ openedPatientData.isMcu ? "Termasuk paket MCU" : slotProps.data.tarifLab?.grandTotal }}
                            </div>
                          </template>
                        </Column>
                      </DataTable>
                    </div>
                    <div class="mt-4">
                      <card class="bg-opensimrs-50">
                        <template #content>
                          <div class="grid grid-cols-3">
                            <div>
                              <p
                                class="text-xs font-bold underline underline-offset-2"
                              >
                                Dokter Pengirim
                              </p>
                              <p>
                                {{
                                  (listDpjp.find(
                                    (dokter) => dokter.uuid === practitionerUuid
                                  )?.pegawai
                                    ? `${
                                        listDpjp.find(
                                          (dokter) =>
                                            dokter.uuid === practitionerUuid
                                        ).pegawai.firstTitle || ""
                                      } 
         ${
           listDpjp.find((dokter) => dokter.uuid === practitionerUuid).pegawai
             .name || ""
         } 
         ${
           listDpjp.find((dokter) => dokter.uuid === practitionerUuid).pegawai
             .lastTitle
             ? "-" +
               listDpjp.find((dokter) => dokter.uuid === practitionerUuid)
                 .pegawai.lastTitle
             : ""
         }`
                                    : " "
                                  ).trim()
                                }}
                              </p>
                            </div>
                            <div class="flex">
                              <div
                                class="bg-opensimrs-300 w-[1px] h-[30px] ml-2"
                              ></div>
                              <p class="mt-1 ml-4 text-base font-bold">
                                Total Tagihan Lab
                              </p>
                            </div>
                            <div>
                              <p
                                class="flex justify-end mt-1 text-base font-bold"
                              >
                                {{ openedPatientData.isMcu ? "Termasuk paket MCU (tanpa tagihan lab)" : `RP. ${totalTagihanLab}` }}
                              </p>
                            </div>
                          </div>
                        </template>
                      </card>
                    </div>
                  </div>
                </template>
                <template #collapseIcon>
                  <CustomButton
                    icon="PhCaretUp"
                    backgroundColor="bg-transparent"
                    textColor="text-opensimrs-300"
                  />
                </template>
                <template #expandIcon>
                  <CustomButton
                    icon="PhCaretDown"
                    backgroundColor="bg-transparent"
                    textColor="text-opensimrs-300"
                  />
                </template>
              </CustomAccordion>
            </div>
          </div>
        </div>
        <Card class="absolute inset-x-0 bottom-0">
          <template #footer>
            <div class="flex justify-end">
              <CustomButton
                @click="bukaDialogValidasi"
                label="Validasi Order"
                backgroundColor="bg-opensimrs-300"
              />
            </div>
          </template>
        </Card>
      </template>
    </CustomDialog>

    <!-- Edit Order Dialog -->

    <CustomDialog
      v-model:visible="editOrderDialog"
      class="h-full"
      width="1000px"
    >
      <template #header>
        <div class="flex">
          <p>Edit Order Lab</p>
        </div>
      </template>
      <template #body>
        <OrderTindakan
          :pageType="pageType"
          :dataBreadCrumb="dataBreadCrumb"
          :initialData="openedPatientData"
          ref="orderTindakanRef"
        />
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomButton
            label="Batal"
            class="mr-[10px]"
            outlined
            borderColor="border-grey-200"
            textColor="text-grey-300"
            @click="editOrderDialog = false"
          />
          <CustomButton
            label="Simpan"
            backgroundColor="bg-opensimrs-300"
            @click="handleEditOrder"
          />
        </div>
      </template>
    </CustomDialog>
  </div>
  <Dialog v-model:visible="dialogValidasi" modal header="Validasi Order Lab" :style="{ width: '520px' }">
    <div class="flex flex-col gap-3 text-sm">
      <div>Validasi order <b>{{ openedPatientData?.noOrder }}</b> atas nama <b>{{ openedPatientData?.patient?.name ?? "-" }}</b>?</div>
      <CustomSelect
        v-if="koneksiLis.length > 1"
        v-model="koneksiLisDipilih"
        label="Kirim ke LIS"
        :options="koneksiLis"
        optionValue="uuid"
        optionLabel="nama"
      />
      <div v-else-if="koneksiLis.length === 1" class="text-grey-400">LIS tujuan: {{ koneksiLis[0].nama }}</div>
      <div v-else class="p-3 rounded-md bg-[#FEF0C7] text-[#B54708]">
        Belum ada koneksi LIS aktif. Atur di Setting › Konfigurasi Integrasi › Konfigurasi LIS.
      </div>
    </div>
    <template #footer>
      <CustomButton label="Batal" textColor="text-[#9DA4B1]" backgroundColor="bg-transparent" borderColor="border-2 border-[#9DA4B1]" @click="dialogValidasi = false" />
      <CustomButton label="Validasi Saja" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="handleValidasi(false)" />
      <CustomButton v-if="fiturAktif('lab_bridging_lis')" label="Validasi & Kirim ke LIS" icon="PhPaperPlaneTilt" :disabled="!koneksiLis.length" @click="handleValidasi(true)" />
    </template>
  </Dialog>
  <MedicalRecord
    v-if="rmPatientData"
    ref="medicalRecord"
    :key="rmPatientData.rekamMedisUuid"
    :patientData="rmPatientData"
    :rmType="rmType"
    viewMode="history"
  />
</template>
