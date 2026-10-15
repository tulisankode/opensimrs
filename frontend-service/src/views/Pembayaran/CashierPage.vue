<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed, type PropType, type Ref } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { fiturAktif } from "@/stores/modulFaskes";
import { useTagihanStore } from "@/stores/pembayaran/findBill";
import { useAdmisiMasterPasienStore } from "@/stores/admisi/masterPasien";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import { utilsStore } from "@/stores/utils";
import type { DataTableRowClickEvent } from "primevue/datatable";
import { createSlipTutupShiftPdf } from "@/utils/pdf/pdfPembayaran/closingkasir";
import { createSlipTutupHarianPdf } from "@/utils/pdf/pdfPembayaran/closingdays";
import { createInvoicePdf } from "@/utils/pdf/pdfPembayaran/cetakKuitansi";
import { createRincianPdf } from "@/utils/pdf/pdfPembayaran/cetakTagihan";
import { epochToDate, dateToEpoch } from "@/utils/Helpers";


const emits = defineEmits(["update:rows", "update:current-page"]);
const storeUtils = utilsStore();
const closeHarianDialog = ref(false);
const kasirCloseBillDialog = ref(false);
const confirmDiscountDialog = ref(false);
const confirmVoucherDialog = ref(false);
const closeKasirDialog = ref(false);
const isKasirOpen = ref(false);
const saldoAwalDisabled = ref(false);
const discountDisabled = ref(false);
const voucherDisabled = ref(false);
const shiftDisabled = ref(false);
const kasirData = ref<any>(null);
const itemTagihan = ref<any>(null);
const openedData = ref<any>({});
const codeVoucher = ref("");
const codeDiscount = ref<string>();
const saldoAwal = ref<number>();
const selectShift = ref("");
const cash = ref<number>();
// const debit = ref<number>();
// const insurance = ref<number>();
const kasirPayload = ref<any[]>([]);
const pembayaranBPJSDialog = ref(false);
const isBillClosed = ref(false);
const listTagihanRIDialog = ref(false); const itemsPasien = ref<any[]>([]);
const amount = ref<number>();
const payment_type = ref("");
const payment_method = ref("");
const note = ref("");
const information = ref("");
let pollingInterval: number | null = null;
const kembalian = ref<number>(0);
const kasirCheckData = ref<any>({});
const closingHarianData = ref<any>({});
const selectedPatient = ref<string | null>(null);
const selectedServiceBillUuid = ref<string | null>(null);
const masterPasienStore = useAdmisiMasterPasienStore();

//format price lokal(khusus kunjungan)
const formatPriceLokal = (price: number) => {
  if (typeof price !== 'number') return 'Rp 0';
  const roundedPrice = Math.ceil(price);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(roundedPrice);
};

//Flexibilitas Format Voucher
const formattedVoucherValue = computed(() => {
  if (!kasirData.value || !kasirData.value.voucherValue) {
    return 'Rp 0';
  }

  const type = kasirData.value.voucherType;
  const value = kasirData.value.voucherValue;
  if (type === 'persentase') {
    return `${value} %`;
  }
  else if (type === 'potongan') {
    return formatPriceLokal(value);
  }
  return formatPriceLokal(value);
});

const isClosingHarianDisabled = computed(
  () => saldoAwalDisabled.value && shiftDisabled.value
);

//closingharianDialogcheck
const openClosingHarianDialog = async () => {
  storeUtils.setLoading(true);
  try {
    const response = await tagihanStore.getCloseDayConfirmation();
    if (response && response.payload) {
      closingHarianData.value = response.payload;
      closeHarianDialog.value = true;
    }
  } catch (error) {
    console.error("Gagal mengambil data closing harian:", error);
    closingHarianData.value = {};
  } finally {
    storeUtils.setLoading(false);
  }
};

//closeKasirDialog
const openDynamicDialog = async (dialogRef: Ref<boolean>) => {
  storeUtils.setLoading(true);
  try {
    const response = await tagihanStore.getKasirStatus();
    if (response && response.payload) {
      kasirCheckData.value = response.payload;
      dialogRef.value = true;
    }
  } catch (error) {
    console.error("Gagal mengambil data status kasir:", error);
    kasirCheckData.value = {};
  } finally {
    storeUtils.setLoading(false);
  }
};

//Counting Selisih Saldo closingkasir
// const selisihKasirMessage = computed(() => {
//   const systemTunai = kasirCheckData.value.pendapatanSystem?.cash ?? 0;
//   const aktualTunai = cash.value ?? 0;

//   // Hitung selisihnya
//   const selisih = aktualTunai - systemTunai;
//   if (!cash.value || selisih === 0) {
//     return ""; // Kembalikan string kosong
//   }
//   if (selisih < 0) {
//     return `Saldo aktual kurang ${formatPriceLokal(-selisih)}`;
//   }
//   if (selisih > 0) {
//     return `Saldo aktual lebih ${formatPriceLokal(selisih)}`;
//   }
//   return "";
// });

//kembalian
const getKembalian = () => {
  const requiredAmount = Math.ceil(kasirData.value?.grandTotal || 0);
  const paidAmount = amount.value || 0;

  if (paidAmount >= requiredAmount) {
    kembalian.value = paidAmount - requiredAmount;
  } else {
    kembalian.value = 0;
  }
};

// atur kembalian otomatis
let kembalianTimeout: ReturnType<typeof setTimeout> | null = null;
watch(amount, () => {
  if (kembalianTimeout) clearTimeout(kembalianTimeout);

  kembalianTimeout = setTimeout(() => {
    getKembalian();
  }, 700);
});

const handleRowsUpdate = (rows: number) => {
  console.log("Rows updated:", handleRowsUpdate);
};

const tagihanStore = useTagihanStore();
const searchQuery = ref("");

const timer = ref<any>();
// const listDataPatient = ref([]);
const loadingSearchPatient = ref(false);
const snakeToCamel = (str: string) => str.replace(/([-_]\w)/g, (g) => g[1].toUpperCase());

const searchPatientData = async (event: any) => {
  const filterText = typeof event === 'object' && event.value ? event.value : event;
  searchQuery.value = filterText;
  if (timer.value) clearTimeout(timer.value);

  if (!filterText || filterText.trim() === '') {
    kasirPayload.value = [];
    return;
  }
  timer.value = setTimeout(async () => {
    loadingSearchPatient.value = true;
    try {
      const response = await tagihanStore.getApi(filterText);
      if (response && response.payload) {
        kasirPayload.value = response.payload.map((item: any) => {
          const newItem: { [key: string]: any } = {};
          for (const key in item) {
            newItem[snakeToCamel(key)] = item[key];
          }
          return newItem;
        });
      } else {
        kasirPayload.value = [];
      }
    } catch (error) {
      console.error("Failed to fetch data", error);
      kasirPayload.value = [];
    } finally {
      loadingSearchPatient.value = false;
    }
  }, 800);
};

const processBillData = (data: any) => {
  console.log("data", data);
  if (data) {
    itemsPasien.value = data.map((service: any, index: number) => ({
      no: index + 1,
      uuid: service.uuid,
      layanan: service.serviceName,
      doctor: service.practitionerName,
      isChildBill: service.isChildBill,
    }));
  } else {
    itemsPasien.value = [];
  }
};
const selectedBillUuid = ref<string | null>(null);

const setSelectedPatientData = async (uuid: string) => {
  if (!uuid) return;
  storeUtils.setLoading(true);

  // reset form voucher dan discount
  codeDiscount.value = '';
  codeVoucher.value = '';
  try {
    let dataFromApi: any = null;
    let serviceBillData: any[] | null = null;
    let patientDetailFromAdmisi: any = null;

    // 1. Ambil Detail Tagihan
    const response = await tagihanStore.getDetailBill(uuid);
    if (response && response.payload) {
      dataFromApi = response.payload;
      serviceBillData = dataFromApi.serviceBill;
      selectedBillUuid.value = uuid;

      // 2. Ambil Detail Pasien dari Admisi jika patient_uuid tersedia
      // Perhatikan key dari API biasanya snake_case (patient_uuid) atau camelCase tergantung response interceptor
      // Kita coba ambil ID pasiennya
      const patientUuid = dataFromApi.patientUuid;

      if (patientUuid) {
        try {
          const respPasien = await masterPasienStore.getDetailMasterPasien(patientUuid);
          if (respPasien && respPasien.payload) {
            patientDetailFromAdmisi = respPasien.payload;
          }
        } catch (err) {
          console.error("Gagal mengambil detail pasien dari admisi", err);
        }
      }
    }

    if (dataFromApi) {
      // 3. Mapping Data Gabungan
      kasirData.value = {
        uuid: dataFromApi.uuid,
        patientName: dataFromApi.patientName,
        invoiceCode: dataFromApi.invoiceCode,
        billCode: dataFromApi.billCode,
        adminFee: dataFromApi.adminFee,
        scheduleTime: dataFromApi.scheduleTime,
        totalTindakan: dataFromApi.totalTindakan,
        totalPenunjang: dataFromApi.totalPenunjang,
        totalObatAlkes: dataFromApi.totalObatAlkes,
        totalRuangan: dataFromApi.totalRuangan,
        discount: dataFromApi.discount,
        voucherValue: dataFromApi.voucherValue,
        voucherType: dataFromApi.voucherType,
        subTotal: dataFromApi.subTotal,
        ppn: dataFromApi.ppn,
        grandTotal: dataFromApi.grandTotal,
        closeBill: dataFromApi.closeBill,
        paymentType: dataFromApi.paymentType,
        isPaid: dataFromApi.isPaid,
        totalPaid: dataFromApi.totalPaid || 0,
        noRm: patientDetailFromAdmisi?.noRm || dataFromApi.noRm,
        gender: patientDetailFromAdmisi?.gender || dataFromApi.gender,

        // Mapping Umur dari birth_detail
        ageYear: patientDetailFromAdmisi?.birthDetail?.ageYear ?? dataFromApi.ageYear ?? 0,
        ageMonth: patientDetailFromAdmisi?.birthDetail?.ageMonth ?? dataFromApi.ageMonth ?? 0,
        ageDay: patientDetailFromAdmisi?.birthDetail?.ageDay ?? dataFromApi.ageDay ?? 0,
      };

      processBillData(serviceBillData);

      // Logika tombol (tetap sama)
      if (kasirData.value.isPaid === true || kasirData.value.closeBill === true) {
        isBillClosed.value = true;
        discountDisabled.value = true;
        voucherDisabled.value = true;
      } else {
        isBillClosed.value = false;
        discountDisabled.value = false;
        voucherDisabled.value = false;
      }
    }
  } catch (error) {
    console.error("Gagal memproses data tagihan:", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

//untuk milih di dropdown search
watch(selectedPatient, (newlySelectedUuid) => {
  if (newlySelectedUuid) {
    setSelectedPatientData(newlySelectedUuid);
  } else {
    kasirData.value = null;
  }
});

//rest pop up pembayaran
watch(pembayaranBPJSDialog, (isOpening) => {
  if (isOpening) {
    resetPaymentDialogState();
  }
});

const detailTagihan = async (event: DataTableRowClickEvent) => {
  openedData.value = event.data;
  selectedServiceBillUuid.value = event.data.uuid; // <-- simpan UUID item pelayanan
  storeUtils.setLoading(true);
  try {
    const response = await tagihanStore.getItemBill(openedData.value.uuid);
    if (response && response.payload) {
      itemTagihan.value = response.payload;
      console.log("response", itemTagihan.value);
    }
  } catch (error) {
    console.error("Failed to process the data:", error);
  } finally {
    storeUtils.setLoading(false);
  }
  listTagihanRIDialog.value = true;
};

const submitVoucher = async () => {
  storeUtils.setLoading(true);
  try {
    const payload = {
      code: codeVoucher.value,
    };
    await tagihanStore.postVoucher(
      kasirData.value.uuid,
      payload
    );
    const responseDetailBill = await tagihanStore.getDetailBill(
      kasirData.value.uuid
    );
    if (responseDetailBill && responseDetailBill.payload) {
      kasirData.value = responseDetailBill.payload;
      processBillData(responseDetailBill.payload.serviceBill);
      confirmVoucherDialog.value = false;
    }
  } catch (error) {
    console.error("Failed to process the data:", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const submitDiscount = async () => {
  storeUtils.setLoading(true);
  try {
    const payload = {
      value: parseFloat(String(codeDiscount.value).replace(',', '.'))
    };
    await tagihanStore.postDiscount(
      kasirData.value.uuid,
      payload
    );
    const responseDetailBill = await tagihanStore.getDetailBill(
      kasirData.value.uuid
    );
    if (responseDetailBill && responseDetailBill.payload) {
      kasirData.value = responseDetailBill.payload;
      processBillData(responseDetailBill.payload.serviceBill);
      confirmDiscountDialog.value = false; // <-- TAMBAHKAN INI UNTUK MENUTUP DIALOG
    }
  } catch (error) {
    console.error("Failed to process the data:", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

watch(codeDiscount, (newValue, oldValue) => {
  // Jika nilai baru kosong atau null, hentikan proses.
  if (newValue === null || newValue === undefined) return;

  let valueStr = String(newValue);
  valueStr = valueStr.replace(/\./g, ',');
  let cleaned = valueStr.replace(/[^0-9,]/g, '');

  const parts = cleaned.split(',');
  if (parts.length > 2) {
    cleaned = parts[0] + ',' + parts.slice(1).join('');
  }
  const numericValue = parseFloat(cleaned.replace(',', '.'));
  if (!isNaN(numericValue) && numericValue > 100) {
    cleaned = '100';
  }
  if (cleaned !== newValue) {
    codeDiscount.value = cleaned;
  }
});

const optionShiftItem = ref([
  { label: "Pagi", value: "1" },
  { label: "Siang", value: "2" },
  { label: "Malam", value: "3" },
]);

const selectedCaraBayar = ref("");
const optionCaraBayar = ref([
  { label: "Tunai", value: "CASH" },
  { label: "Asuransi", value: "INSURANCE" },
]);

const optionMetodeBayar = ref([
  { label: "Tunai", value: "CASH" },
  { label: "Transfer", value: "TRANSFER" },
  { label: "Debit/Kredit", value: "DEBIT_KREDIT" },
]);

const submitOpenKasir = async () => {
  storeUtils.setLoading(true);
  try {
    if (!isKasirOpen.value) {
      const payload = {
        beginning_balance: saldoAwal.value,
        shift_type: selectShift.value,
      };
      await tagihanStore.postOpenKasir(payload);
      saldoAwalDisabled.value = true;
      shiftDisabled.value = true;
      isKasirOpen.value = true;
      startShortPolling();
    } else {
      await openDynamicDialog(closeKasirDialog);
    }
  } catch (error) {
    console.error("Failed to process the data:", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const startShortPolling = () => {
  pollingInterval = window.setInterval(async () => {
    try {
      console.log("Soft polling: checking kasir status...");

      const status = await tagihanStore.getKasirStatus();
      if (status.payload.isOpen) {
        console.log("Kasir telah ditutup, menghentikan polling.");
        console.log(status);
        saldoAwal.value = status.payload.saldoAwal;

        //  Ambil nama shift dari API
        const shiftNameFromApi = status.payload.shift;
        const shiftOption = optionShiftItem.value.find(
          (option) => option.label === shiftNameFromApi
        );
        if (shiftOption) {
          selectShift.value = shiftOption.value;
        }
        saldoAwalDisabled.value = true;
        shiftDisabled.value = true;
        isKasirOpen.value = true;
      } else {
        saldoAwalDisabled.value = false;
        shiftDisabled.value = false;
        isKasirOpen.value = false;
        closeKasirDialog.value = false;
      }
    } catch (error) {
      console.error("Error during polling:", error);
    }
  }, 30000);
};

const stopShortPolling = () => {
  if (pollingInterval) {


    clearInterval(pollingInterval);
    pollingInterval = null;
  }
};

//fungsi untuk cetak invoice
const handleCetakInvoice = async () => {
  storeUtils.setLoading(true);
  try {
    const billUuid = selectedBillUuid.value;
    if (!billUuid) {
      console.error("UUID tagihan tidak ditemukan, pastikan data pasien sudah dipilih.");
      storeUtils.setLoading(false);
      return;
    }
    const detailBillResponse: any = await tagihanStore.getDetailBill(billUuid);
    let paymentResultFromStorage = null;
    const storedPayment = localStorage.getItem(`paymentResult_${billUuid}`);
    if (storedPayment) {
      paymentResultFromStorage = JSON.parse(storedPayment);
    }
    if (detailBillResponse && detailBillResponse.payload) {
      await createInvoicePdf({
        detailBill: detailBillResponse.payload,
        paymentResult: paymentResultFromStorage
      });
    } else {
      console.error("Struktur respons API getDetailBill tidak sesuai, 'payload' tidak ditemukan.");
    }
  } catch (error) {
    console.error("Gagal memproses cetak invoice:", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

//fungsi untuk cetak rincian biaya
const handleCetakRincianBiaya = async () => {
  storeUtils.setLoading(true);
  try {
    const billUuid = selectedBillUuid.value;
    if (!billUuid) {
      storeUtils.setLoading(false);
      alert("Silakan pilih pasien/tagihan terlebih dahulu!");
      return;
    }

    // Ambil detail bill untuk dapatkan daftar serviceBill
    const detailBillResponse: any = await tagihanStore.getDetailBill(billUuid);
    const serviceBillList = detailBillResponse?.payload?.serviceBill || [];
    if (!serviceBillList.length) {
      storeUtils.setLoading(false);
      alert("Tidak ada data pelayanan pada tagihan ini.");
      return;
    }

    // Ambil UUID service bill pertama
    const serviceBillUuid = serviceBillList[0]?.uuid;
    if (!serviceBillUuid) {
      storeUtils.setLoading(false);
      alert("UUID pelayanan tidak ditemukan.");
      return;
    }

    // Ambil rincian item
    const itemBillResponse: any = await tagihanStore.getItemBill(serviceBillUuid);

    // Ambil data pembayaran dari localStorage
    let paymentResultFromStorage = null;
    const storedPayment = localStorage.getItem(`paymentResult_${billUuid}`);
    if (storedPayment) {
      paymentResultFromStorage = JSON.parse(storedPayment);
    }

    if (detailBillResponse && detailBillResponse.payload) {
      await createRincianPdf({
        detailBill: detailBillResponse.payload,
        itemBill: itemBillResponse?.payload,
        paymentResult: paymentResultFromStorage
      });
    } else {
      console.error("Struktur respons API getDetailBill tidak sesuai, 'payload' tidak ditemukan.");
    }
  } catch (error) {
    console.error("Gagal memproses cetak rincian biaya:", error);
  } finally {
    storeUtils.setLoading(false);
  }
};


// fungsi untuk reset pop up dialog pembayaran
const resetPaymentDialogState = () => {
  amount.value = undefined;
  payment_method.value = "";
  note.value = "";
  information.value = "";
  kembalian.value = 0;

  if (kasirData.value && kasirData.value.paymentType) {
    const defaultPaymentType = optionCaraBayar.value.find(
      option => option.label.toUpperCase() === kasirData.value.paymentType.toUpperCase()
    );
    payment_type.value = defaultPaymentType ? defaultPaymentType.value : "";
  } else {
    payment_type.value = "";
  }
};

const submitCloseKasir = async () => {
  storeUtils.setLoading(true);

  try {
    const payload = {
      cash: cash.value,
      debit: kasirCheckData.value.pendapatanSystem?.debitKredit,
      transfer: kasirCheckData.value.pendapatanSystem?.transfer,
    };

    const response: any = await tagihanStore.postCloseKasir(payload);
    console.log("SELURUH OBJEK 'response' DARI API:", response);

    if (response && response.data && response.data.payload) {
      createSlipTutupShiftPdf({ data: response.data.payload });
    } else {
      console.error("Struktur respons API tidak sesuai, 'payload' tidak ditemukan di 'response.data'");
    }

    saldoAwalDisabled.value = false;
    shiftDisabled.value = false;
    isKasirOpen.value = false;
    closeKasirDialog.value = false;
    saldoAwal.value = 0;
    selectShift.value = "";

  } catch (error) {
    console.error("Failed to process the data:", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const submitClosingHarianKasir = async () => {
  storeUtils.setLoading(true);
  try {

    const response: any = await tagihanStore.postCloseHarianKasir();

    if (response && response.data && response.data.payload) {
      await createSlipTutupHarianPdf({ data: response.data.payload });
    }
    closeHarianDialog.value = false;

  } catch (error) {
    console.error("Gagal memproses tutup harian:", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const submitPaymentKasir = async () => {
  storeUtils.setLoading(true);
  try {
    const payload = {
      amount: amount.value,
      payment_type: payment_type.value,
      payment_method: payment_method.value,
      note: note.value,
      information: information.value,
    };
    const paymentResponse: any = await tagihanStore.postPayment(kasirData.value.uuid, payload);

    if (paymentResponse && paymentResponse.data && paymentResponse.data.payload) {
      const billUuid = kasirData.value.uuid;
      // Simpan sebagai string JSON dengan kunci: 'paymentResult_UUID_TAGIHAN'
      localStorage.setItem(`paymentResult_${billUuid}`, JSON.stringify(paymentResponse.data.payload));
    }
    pembayaranBPJSDialog.value = false;
    isBillClosed.value = true;
    discountDisabled.value = true;
    voucherDisabled.value = true;
    // Refresh data
    await setSelectedPatientData(kasirData.value.uuid);
  } catch (error) {
    console.error("Failed to process the data:", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const submitKasirCloseBill = async () => {
  storeUtils.setLoading(true);
  try {
    const payload = {};
    const response = await tagihanStore.postKasirCloseBill(
      kasirData.value.uuid,
      payload
    );
    kasirCloseBillDialog.value = false;
    await setSelectedPatientData(kasirData.value.uuid);
  } catch (error) {
    console.error("Failed to process the data:", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const dynamicOptionLabelKey = computed(() => {
  const query = searchQuery.value.toUpperCase();

  if (query.includes("INV")) {
    return 'invoiceCode';
  }
  if (/\d/.test(searchQuery.value) && searchQuery.value.includes("-")) {
    return 'noRm';
  }
  if (query.includes("INV")) {
    return 'invoiceCode';
  }
  return 'patientName';
});

//format date 
const formatDateCustom = (epochTime: number) => {
  if (!epochTime) return "";
  const date = new Date(epochTime * 1000);

  const day = date.getDate().toString().padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
};

//pengecekan pembayaran kurang
const isAmountInsufficient = computed(() => {
  const grandTotal = kasirData.value?.grandTotal || 0;
  const paidAmount = amount.value || 0;
  return paidAmount > 0 && paidAmount < grandTotal;
});

//untuk max 18 digit amount
watch(amount, (newValue) => {
  if (newValue) {
    const digitsOnly = String(newValue).replace(/\D/g, '');

    const maxLength = 15;
    if (digitsOnly.length > maxLength) {
      const truncatedDigits = digitsOnly.slice(0, maxLength);
      amount.value = Number(truncatedDigits);
    }
  }
});

//Refresh Page
const handleRefresh = () => {
  // Reset data pasien yang sedang dipilih
  selectedPatient.value = null;
  kasirData.value = null;

  // Kosongkan hasil dropdown pencarian sebelumnya
  searchQuery.value = "";
  kasirPayload.value = [];

  //  Reset input diskon & voucher
  codeDiscount.value = '';
  codeVoucher.value = '';
};

onMounted(() => {
  startShortPolling();
}
);

onUnmounted(() => {
  stopShortPolling();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0" pt:content:class="h-full" class="h-full overflow-hidden overflow-y-auto">
      <template #header>
        <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="handleRefresh" />
          <CustomBreadCrumb :home="{ label: 'Kasir', home: true }" />
          <CustomSelect label="Pencarian Transaksi" prependIcon="PhMagnifyingGlass"
            place-holder="Cari Nama / No.Transaksi / No. RM" v-model="selectedPatient"
            optionValue="uuid" :options="kasirPayload" :optionLabel="dynamicOptionLabelKey"
            @filter="searchPatientData" filter>
          </CustomSelect>
          <!-- Buka/tutup shift hanya bila fitur Shift Kasir aktif; tanpa fitur ini shift dibuka otomatis saat bayar -->
          <template v-if="fiturAktif('bayar_shift_kasir')">
            <div class="shrink-0 w-[2px] h-6 bg-opensimrs-300" aria-hidden="true"></div>
            <CustomInputNumber v-model="saldoAwal" label="Saldo Awal (kas)" placeholder="0"
              :disabled="saldoAwalDisabled">
              <template #prependText>
                <div
                  class="flex items-center justify-center px-3 overflow-hidden font-semibold leading-7 text-white border-r text-MD bg-opensimrs-300 rounded-l-md">
                  Rp.
                </div>
              </template>
            </CustomInputNumber>
            <CustomSelect v-model="selectShift" :disabled="shiftDisabled" label="Pilih Shift"
              optionLabel="label" optionValue="value" :options="optionShiftItem" />
            <CustomButton @click="openClosingHarianDialog" label="Closing Harian" :disabled="isClosingHarianDisabled"
              outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" />
            <CustomButton @click="submitOpenKasir" :label="isKasirOpen ? 'Close Kasir' : 'Open Kasir'" />
          </template>
        </PageToolbar>
      </template>
      <template #content>
        <div v-if="!kasirData" class="grid grid-cols-[50%_50%] gap-5 h-full mr-5">
          <div class="flex flex-col text-center border-[3px] border-dashed border-grey-300 rounded-lg">
            <div class="m-auto text-SM">
              <img src="../../assets/icons/no data icon.svg" alt="no data" class="mx-auto" />
              <div class="text-grey-300">Silahkan Cari Tagihan Pasien</div>
            </div>
          </div>

          <!-- Kolom Pembayaran -->
          <div class="p-5 rounded-lg bg-opensimrs-50">
            <!-- Total Pembayaran -->
            <div class="flex items-center justify-between">
              <div class="text-base font-bold font-poppins">
                Total Pembayaran
              </div>
            </div>
            <hr class="mt-2 mb-2 border border-slate-300" />
            <!-- Biaya Administrasi -->
            <div class="flex justify-between mt-6">
              <div class="text-sm text-black font-poppins">
                Biaya Administrasi
              </div>
              <div class="text-sm font-poppins">Rp 0</div>
            </div>
            <!-- Biaya Tindakan -->
            <div class="flex justify-between mt-4">
              <div class="text-sm font-poppins">Biaya Tindakan</div>
              <div class="text-sm font-poppins">Rp 0</div>
            </div>
            <!-- Biaya Penunjang -->
            <div class="flex justify-between mt-4">
              <div class="text-sm font-poppins">Biaya Penunjang</div>
              <div class="text-sm font-poppins">Rp 0</div>
            </div>
            <!-- Biaya Obat -->
            <div class="flex justify-between mt-4">
              <div class="text-sm font-poppins">Biaya Obat/Alkes</div>
              <div class="text-sm font-poppins">Rp 0</div>
            </div>
            <!-- Retur Obat/Alkes -->
            <div class="flex justify-between mt-4">
              <div class="text-sm font-poppins">Retur Obat/Alkes</div>
              <div class="text-sm font-poppins">Rp 0</div>
            </div>
            <!-- Biaya Kamar -->
            <div class="flex justify-between mt-4">
              <div class="text-sm font-poppins">Biaya Kamar</div>
              <div class="text-sm font-poppins">Rp 0</div>
            </div>
            <!-- Diskon -->
            <div class="flex justify-between mt-6">
              <div class="text-sm font-poppins">Diskon</div>
              <div class="text-sm font-poppins">0 % </div>
            </div>
            <!-- Voucher-->
            <div class="flex justify-between mt-6">
              <div class="text-sm font-poppins">Voucher</div>
              <div class="text-sm font-poppins">Rp 0 </div>
            </div>
            <hr class="mt-4 border-dashed border-[1px] border-slate-300" />
            <!-- Total-->
            <div class="flex justify-between mt-6">
              <div class="text-sm font-poppins font-bold">Total</div>
              <div class="text-sm font-poppins font-bold">Rp 0 </div>
            </div>
            <!-- PPN -->
            <div class="flex justify-between mt-4">
              <div class="text-sm font-poppins">PPN</div>
              <div class="text-sm font-poppins">Rp 0</div>
            </div>
            <hr class="mt-6 mb-2 border-black border-1" />
            <!-- Grand Total -->
            <div class="flex justify-between mt-6">
              <div class="text-sm font-bold font-poppins">Grand Total</div>
              <div class="text-sm font-bold font-poppins">Rp 0</div>
            </div>
            <div class="">
              <div class="flex">
                <!-- <CustomButton
                    label="Bayar"
                    class="w-full mr-4"
                  /> -->
                <CustomButton label="Bayar" class="w-full mt-[70px]" textColor="text-slate-400"
                  backgroundColor="bg-slate-200" />
              </div>
            </div>
          </div>
        </div>
        <div v-else class="grid grid-cols-2 gap-2 h-full">

          <div class="flex flex-col gap-4 mr-[20px]">

            <div class="h-[120px] border-2 border-opensimrs-300 rounded-lg flex flex-row flex-shrink-0">
              <div class="basis-1/2">
                <p class="font-bold text-MD mt-[15px] ml-[15px]">
                  {{ kasirData.patientName }}
                </p>
                <p class="ml-[15px] text-sm">{{ kasirData.invoiceCode }}</p>
                <CustomButton class="h-5 text-xs ml-[15px]">{{ kasirData.billCode }}</CustomButton>
                <CustomChip v-if="kasirData.gender" :showCheckedIcon="false"
                  :label="['Perempuan', 'Female'].includes(kasirData.gender) ? 'Perempuan' : 'Laki-laki'"
                  :bgColor="['Perempuan', 'Female'].includes(kasirData.gender) ? 'bg-female-75' : 'bg-male-75'"
                  :textColor="['Perempuan', 'Female'].includes(kasirData.gender) ? 'text-female-300' : 'text-male-300'"
                  customClass="h-5 pr-[6px] border-none ml-[10px]" />
              </div>
              <div class="bg-mediumGrey-300 w-[1px] h-[74px] mr-[20px] mt-[15px]"></div>
              <div class="mt-[30px] mr-[40px]">
                <p class="text-xs font-bold underline underline-offset-2">Umur</p>
                <p class="">{{ kasirData.ageYear }}Thn {{ kasirData.ageMonth }}Bln {{ kasirData.ageDay }}Hr</p>
              </div>
            </div>

            <!-- List Tagihan Pelayanan -->
            <div class="flex-grow overflow-hidden">
              <DataTable :value="itemsPasien" scrollable scrollHeight="flex"
                class="h-full overflow-hidden rounded-[10px]" :pt="{ headerRow: 'text-SM' }" @rowClick="detailTagihan">
                <Column field="no" headerClass="bg-opensimrs-300 text-white" bodyClass="text-SM" style="width: 60px">
                  <template #header>
                    <div class="w-full font-bold">List Tagihan Pelayanan</div>
                  </template>
                  <template #body="slotProps">
                    <div class="flex flex-wrap gap-3 items-center">
                      <p class="font-bold text-normal">
                        {{ slotProps.data.layanan }}
                      </p>
                      <CustomChip v-if="kasirData.paymentType" :showCheckedIcon="false" :label="kasirData.paymentType"
                        :bgColor="kasirData.paymentType === 'ASURANSI' ? 'bg-warning-50' : 'bg-opensimrs-50'"
                        :textColor="kasirData.paymentType === 'ASURANSI' ? 'text-warning-300' : 'text-opensimrs-300'"
                        :borderColor="kasirData.paymentType === 'ASURANSI' ? 'border-warning-300' : 'border-opensimrs-300'" />
                      <CustomChip v-if="slotProps.data.isChildBill" :showCheckedIcon="false"
                        label="Gabung Tagihan Keluarga" bgColor="bg-opensimrs-300" textColor="text-white"
                        borderColor="border-opensimrs-300" />
                    </div>
                    <div class="flex">
                      <UserDoctorIcon class="mt-2" />
                      <p class="mt-2 text-sm text-grey-400">
                        {{ slotProps.data.doctor }}
                      </p>
                    </div>
                    <div v-if="kasirData.scheduleTime" class="flex">
                      <p class="text-sm">Tanggal</p>
                      <PhArrowRight :size="18" class="my-auto ml-2 text-success-300" weight="bold" />
                      <p class="ml-2 text-sm">
                        {{ epochToDate(kasirData.scheduleTime, "date") }}
                      </p>
                      <p class="ml-2 text-sm">{{ epochToDate(kasirData.scheduleTime, "time") }}</p>
                    </div>
                  </template>
                </Column>
              </DataTable>
            </div>
          </div>

          <div class="p-5 rounded-lg bg-opensimrs-50 overflow-y-auto">
            <div class="flex justify-between">
              <p class="text-base font-bold font-poppins">Total Pembayaran</p>
              <div class="flex">
                <CustomButton v-if="kasirData.totalPaid > 0" label="Cetak Kuitansi" @click="handleCetakInvoice"
                  class="mt-[-10px] mr-[10px]" />
                <CustomButton label="Cetak Tagihan" @click="handleCetakRincianBiaya" class="mt-[-10px]" />
              </div>
            </div>
            <hr class="mt-2 mb-2 border border-slate-300" />

            <div class="flex justify-between mt-6">
              <div class="text-sm text-black font-poppins">Biaya Administrasi</div>
              <div class="text-sm font-poppins"> {{ formatPriceLokal(kasirData.adminFee) }}</div>
            </div>
            <div class="flex justify-between mt-4">
              <div class="text-sm font-poppins">Biaya Tindakan</div>
              <div class="text-sm font-poppins"> {{ formatPriceLokal(kasirData.totalTindakan) }}</div>
            </div>
            <div class="flex justify-between mt-4">
              <div class="text-sm font-poppins">Biaya Penunjang</div>
              <div class="text-sm font-poppins"> {{ formatPriceLokal(kasirData.totalPenunjang) }}</div>
            </div>
            <div class="flex justify-between mt-4">
              <div class="text-sm font-poppins">Biaya Obat/Alkes</div>
              <div class="text-sm font-poppins"> {{ formatPriceLokal(kasirData.totalObatAlkes) }}</div>
            </div>
            <div class="flex justify-between mt-4">
              <div class="text-sm font-poppins">Retur Obat/Alkes</div>
              <div class="text-sm font-poppins"> {{ formatPriceLokal(kasirData.returObat || "Data Not Available") }}
              </div>
            </div>
            <div class="flex justify-between mt-4">
              <div class="text-sm font-poppins">Biaya Kamar</div>
              <div class="text-sm font-poppins"> {{ formatPriceLokal(kasirData.totalRuangan) }}</div>
            </div>
            <div class="flex justify-between mt-6">
              <div class="text-sm font-poppins">Diskon</div>
              <div class="text-sm font-poppins">{{ kasirData.discount || "0" }} % </div>
            </div>
            <div class="flex justify-between mt-6">
              <div class="text-sm font-poppins">Voucher</div>
              <div class="text-sm font-poppins"> {{ formattedVoucherValue }} </div>
            </div>
            <hr class="mt-4 border-dashed border-[1px] border-slate-300" />
            <div class="flex justify-between mt-6">
              <div class="text-sm font-bold font-poppins">Total</div>
              <div class="text-sm font-bold font-poppins"> {{ formatPriceLokal(kasirData.subTotal) }} </div>
            </div>
            <div class="flex justify-between mt-4">
              <div class="text-sm font-poppins">PPN</div>
              <div class="text-sm font-poppins"> {{ formatPriceLokal(kasirData.ppn) }}</div>
            </div>
            <hr class="mt-6 mb-2 border-slate-300 border-1" />

            <div class="flex justify-between mt-6">
              <div class="text-sm font-bold font-poppins">Grand Total</div>
              <div class="text-sm font-bold font-poppins"> {{ formatPriceLokal(kasirData.grandTotal) }}</div>
            </div>


            <!-- Diskon & voucher: fitur bayar_diskon_voucher (Setting › Manajemen Modul & Fitur) -->
            <div v-if="fiturAktif('bayar_diskon_voucher')" class="flex mt-[30px]">
              <CustomTextfield v-model="codeDiscount" placeholder="5" :showLabel="false"
                class="w-[80px] bg-white rounded-xl" :disable="discountDisabled">
                <template #appendText>
                  <div
                    class="font-semibold bg-white text-sm text-opensimrs-300 ml-[10px] mt-[10px] rounded-r-xl w-[20px]">
                    %
                  </div>
                </template>
              </CustomTextfield>
              <CustomButton label="Pakai Diskon" class="ml-[10px]" @click="confirmDiscountDialog = true"
                :disabled="discountDisabled" />

              <CustomTextfield v-model="codeVoucher" :showLabel="false" placeholder="Masukkan Kode Voucher"
                class="w-[30%] ml-[50px] mr-[10px]" :disable="voucherDisabled" />
              <CustomButton label="Pakai Voucher" class="" @click="confirmVoucherDialog = true"
                :disabled="voucherDisabled" />
            </div>

            <!-- Button Bayar -->
            <div class="mt-[60px]">
              <div class="flex">
                <CustomButton v-if="kasirData.totalPaid === 0" @click="pembayaranBPJSDialog = true" label="Bayar"
                  class="w-full" />
                <CustomButton v-else-if="!kasirData.closeBill" @click="kasirCloseBillDialog = true" label="Close Bill"
                  class="w-full" backgroundColor="bg-danger-300" />
                <CustomButton v-else label="Bill Telah Ditutup" class="w-full" :disabled="true" />
              </div>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <!-- Pakai Diskon-->
    <CustomDialog v-model:visible="confirmDiscountDialog" width="500px">
      <template #header>Pakai Diskon</template>
      <template #body>
        <div class="mt-6 text-base">
          <p>
            Apakah anda yakin menggunakan <strong>Diskon</strong>?
          </p>
        </div>
        <div class="text-sm">
          <p class="mt-4 italic text-danger-300">
            *Diskon akan mempengaruhi <strong>Grand Total</strong>
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomButton @click="confirmDiscountDialog = false" label="Tidak" outlined borderColor="border-grey-200"
            textColor="text-grey-300" />
          <CustomButton @click="submitDiscount" label="Iya, Pakai" class="ml-2" backgroundColor="bg-opensimrs-300" />
        </div>
      </template>
    </CustomDialog>

    <!-- Pakai Voucher-->
    <CustomDialog v-model:visible="confirmVoucherDialog" width="500px">
      <template #header>Pakai Voucher</template>
      <template #body>
        <div class="mt-6 text-base">
          <p>
            Apakah anda yakin menggunakan <strong>Voucher</strong>?
          </p>
        </div>
        <div class="text-sm">
          <p class="mt-4 italic text-danger-300">
            *Voucher akan mempengaruhi <strong>Grand Total</strong>
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomButton @click="confirmVoucherDialog = false" label="Tidak" outlined borderColor="border-grey-200"
            textColor="text-grey-300" />
          <CustomButton @click="submitVoucher" label="Iya, Pakai" class="ml-2" backgroundColor="bg-opensimrs-300" />
        </div>
      </template>
    </CustomDialog>

    <!-- Closing Harian -->
    <CustomDialog v-model:visible="closeHarianDialog" width="600px">
      <template #header>
        <div class="">Closing Harian</div>
      </template>
      <template #body>
        <div class="grid grid-flow-col grid-rows-1">
          <div class="row-span-1">
            <img src="../../assets/icons/profil.svg" class="w-[50px] h-[50px] mt-[20px]" />
          </div>
          <div class="mr-[250px]">
            <p class="font-bold mt-[20px]">{{ closingHarianData.namaAkun }}</p>
            <p class="text-sm text-grey-300">
              Terakhir login {{ epochToDate(closingHarianData.terakhirLogin, "dateTime") }}
            </p>
          </div>
        </div>
        <div>
          <p class="mt-[30px] font-bold">
            Tanggal & Jam Closing
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <span class="font-normal">: {{ epochToDate(closingHarianData.tanggalJamClosing, "dateTime") }}</span>
          </p>
        </div>
        <hr class="mt-8 border-1 border-grey-200" />
        <div class="text-center">
          <p class="mt-6 text-base font-bold text-grey-300">
            Apakah anda yakin ingin melakukan penutupan hari ini?
          </p>
        </div>
        <hr class="mt-6 border-1 border-grey-200" />
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomButton @click="closeHarianDialog = false" label="Batal" outlined class="" borderColor="border-grey-200"
            textColor="text-grey-300" />
          <CustomButton @click="submitClosingHarianKasir" label="Closing Harian" class="ml-2"
            backgroundColor="bg-opensimrs-300" />
        </div>
      </template>
    </CustomDialog>

    <!-- Close Bill -->
    <CustomDialog v-model:visible="kasirCloseBillDialog" width="600px" headerBg="bg-danger-300">
      <template #header class="text-white bg-danger-300">Closing Bill</template>
      <template #body>
        <div class="mt-6 text-sm">
          <p>
            Pastikan semua biaya dan tagihan sudah tercantum <strong>Close Bill</strong> pasien?
          </p>
        </div>
        <div class="text-sm">
          <p class="mt-6 text-base italic text-danger-300">
            *Tidak dapat mengubah/menambah tagihan, jika sudah
            <span class="font-bold">Close Bill</span>
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomButton @click="kasirCloseBillDialog = false" label="Batal" outlined class=""
            borderColor="border-grey-200" textColor="text-grey-300" />
          <CustomButton @click="submitKasirCloseBill" label="Close Bill" class="ml-2" backgroundColor="bg-danger-300" />
        </div>
      </template>
    </CustomDialog>

    <!-- Closing kasir/shift -->
    <CustomDialog v-model:visible="closeKasirDialog" width="800px">
      <template #header>Closing Kasir</template>
      <template #body>
        <div class="grid grid-flow-col grid-rows-1 items-center">
          <div class="row-span-1">
            <img src="../../assets/icons/profil.svg" class="w-[50px] h-[50px]" />
          </div>
          <div class="ml-[-330px]">
            <p class="font-bold mt-[20px]">{{ kasirCheckData.namaAkun }}</p>
            <p class="text-sm text-grey-300">
              Terakhir login {{ epochToDate(kasirCheckData.terakhirLogin, "dateTime") }}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 mt-6">
          <div class="flex">
            <p class="text-sm font-bold w-24">Shift</p>
            <p class="text-sm">: {{ kasirCheckData.shift }}</p>
          </div>
          <div class="flex">
            <p class="text-sm font-bold w-40">Tanggal & Jam Closing</p>
            <p class="text-sm">: {{ epochToDate(kasirCheckData.tanggalJamClosing, "dateTime") }}</p>
          </div>
        </div>

        <hr class="mt-4 border-1 border-grey-200" />

        <div class="flex justify-between items-center mt-4">
          <div>
            <p class="text-sm font-bold">Saldo Awal (Kas)</p>
          </div>
          <div>
            <p class="text-sm font-bold">{{ formatPriceLokal(saldoAwal || 0) }}</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-10 mt-4">
          <div>
            <p class="font-bold text-sm text-left underline underline-offset-4 mb-5">Pendapatan System</p>
            <div class="flex justify-between items-center">
              <p class="text-sm font-bold w-1/3">Tunai</p>
              <CustomInputNumber :model-value="kasirCheckData.pendapatanSystem?.cash" :show-label="false"
                class="flex-grow" :disabled="true">
                <template #prependText>
                  <div
                    class="flex items-center justify-center px-3 overflow-hidden font-semibold leading-7 text-white border-r text-MD bg-opensimrs-300 rounded-l-md">
                    Rp.</div>
                </template>
              </CustomInputNumber>
            </div>
          </div>

          <div>
            <p class="font-bold text-left text-sm underline underline-offset-4 mb-5">Pendapatan Aktual</p>
            <div class="flex justify-between items-center">
              <p class="text-sm font-bold w-1/3">Tunai</p>
              <CustomInputNumber v-model="cash" :show-label="false" class="flex-grow" placeholder="0">
                <template #prependText>
                  <div
                    class="flex items-center justify-center px-3 overflow-hidden font-semibold leading-7 text-white border-r text-MD bg-opensimrs-300 rounded-l-md">
                    Rp.</div>
                </template>
              </CustomInputNumber>
            </div>
          </div>
        </div>
        <!-- <hr class="mt-6 border-1 border-grey-200" /> -->
      </template>
      <template #footer>
        <div class="flex justify-between items-center w-full">
          <div>
            <!-- <p v-if="selisihKasirMessage" class="text-sm text-danger-300 italic">
              {{ selisihKasirMessage }}
            </p> -->
          </div>

          <div class="flex">
            <CustomButton @click="closeKasirDialog = false" label="Batal" outlined class=""
              borderColor="border-grey-200" textColor="text-grey-300" />
            <CustomButton @click="submitCloseKasir" label="Closing Kasir" class="ml-2"
              backgroundColor="bg-opensimrs-300" />
          </div>
        </div>
      </template>
    </CustomDialog>

    <!-- Pembayaran -->
    <CustomDialog v-model:visible="pembayaranBPJSDialog" width="700px">
      <template #header>Pembayaran</template>
      <template #body>
        <div class="flex justify-between">
          <div>
            <p class="font-bold mt-[20px]">Grand Total</p>
          </div>
          <div>
            <p class="font-bold mt-[20px]">
              <span> {{ formatPriceLokal(kasirData.grandTotal) }}</span>
            </p>
          </div>
        </div>
        <hr class="mt-6 border-1 border-grey-200" />

        <div v-if="payment_type !== 'INSURANCE'">
          <div class="flex justify-between">
            <div>
              <p class="font-bold mt-[30px] text-sm">Jumlah Bayar</p>
            </div>
            <div>
              <CustomInputNumber v-model="amount" :show-label="false" class="mt-[15px]" placeholder="0" maxlength="18"
                :pt="{ root: { class: isAmountInsufficient ? 'border !border-danger-300 rounded-lg' : '' } }">
                <template #prependText>
                  <div
                    class="flex items-center justify-center px-3 font-semibold text-white border-r text-MD rounded-l-md"
                    :class="{ 'bg-danger-300': isAmountInsufficient, 'bg-opensimrs-300': !isAmountInsufficient }">
                    Rp.
                  </div>
                </template>
              </CustomInputNumber>
            </div>
          </div>
          <div class="flex justify-end mt-1" v-if="isAmountInsufficient">
            <p class="text-xs text-danger-300">*Pembayaran kurang dari Grand Total, tetap melanjutkan dengan status
              piutang?</p>
          </div>

          <div class="flex justify-between">
            <div>
              <p class="font-bold mt-[30px] text-sm">Kembalian</p>
            </div>
            <div>
              <CustomInputNumber :model-value="kembalian" :show-label="false" class="mt-[15px]" placeholder="0"
                :disabled="true"
                :pt="{ root: { class: isAmountInsufficient ? 'border !border-danger-300 rounded-lg' : '' }, input: { class: isAmountInsufficient ? '!text-danger-300' : '' } }">
                <template #prependText>
                  <div
                    class="font-semibold text-MD text-white w-[53.34px] flex items-center justify-center border-r rounded-l-md"
                    :class="{ 'bg-danger-300': isAmountInsufficient, 'bg-opensimrs-300': !isAmountInsufficient }">
                    Rp.
                  </div>
                </template>
              </CustomInputNumber>
            </div>
          </div>
          <hr class="mt-6 border-1 border-grey-200" />
        </div>

        <!-- Bagian ini akan tampil JIKA cara bayar adalah Asuransi -->
        <div v-else>
          <div class="flex justify-between">
            <div>
              <p class="font-bold mt-[30px] text-sm">Dijamin</p>
            </div>
            <div>
              <CustomInputNumber v-model="amount" :show-label="false" class="mt-[15px]" placeholder="0"
                :pt="{ root: { class: isAmountInsufficient ? 'border !border-danger-300 rounded-lg' : '' } }">
                <template #prependText>
                  <div
                    class="flex items-center justify-center px-3 font-semibold text-white border-r text-MD rounded-l-md"
                    :class="{ 'bg-danger-300': isAmountInsufficient, 'bg-opensimrs-300': !isAmountInsufficient }">
                    Rp.
                  </div>
                </template>
              </CustomInputNumber>
            </div>
          </div>
          <div class="flex justify-end mt-1" v-if="isAmountInsufficient">
            <p class="text-xs text-danger-300">*Pembayaran kurang dari Grand Total, tetap melanjutkan dengan status
              piutang?
            </p>
          </div>
          <hr class="mt-6 border-1 border-grey-200" />
        </div>

        <!-- Keterangan -->
        <div>
          <CustomTextfield v-model="note" class="mt-[30px]" label="Catatan" placeholder="Keterangan" />
        </div>

        <!-- Metode Pembayaran -->
        <div class="flex mt-[20px] gap-4">
          <div>
            <CustomSelect label="Cara Bayar" class="flex-1" optionLabel="label" optionValue="value" :clearable="false"
              :disabled="true" :options="optionCaraBayar" v-model="payment_type" />
          </div>
          <div v-if="payment_type !== 'INSURANCE'">
            <CustomSelect label="Metode Pembayaran" class="flex-1" optionLabel="label" optionValue="value"
              :options="optionMetodeBayar" v-model="payment_method" />
          </div>
          <div>
            <CustomTextfield v-model="information" class="flex-1" label="Keterangan" placeholder="Keterangan" />
          </div>
          <div class="mt-[25px] flex items-end">
            <CustomButton label="Bayar" @click="submitPaymentKasir" />
          </div>
        </div>
      </template>
    </CustomDialog>

    <!-- List Tagihan Rawat Inap -->
    <CustomDialog v-model:visible="listTagihanRIDialog" width="1000px">
      <template #header>Detail Tagihan Pelayanan</template>
      <template #body>
        <div>
          <div class="pt-5">
            <div class="flex flex-wrap gap-3 items-center">
              <p class="font-bold">{{ openedData.layanan }}</p>
              <CustomChip v-if="kasirData.paymentType" :showCheckedIcon="false" :label="kasirData.paymentType"
                :bgColor="kasirData.paymentType === 'ASURANSI' ? 'bg-warning-50' : 'bg-opensimrs-50'"
                :textColor="kasirData.paymentType === 'ASURANSI' ? 'text-warning-300' : 'text-opensimrs-300'"
                :borderColor="kasirData.paymentType === 'ASURANSI' ? 'border-warning-300' : 'border-opensimrs-300'" />
              <CustomChip v-if="openedData.isChildBill" :showCheckedIcon="false" label="Gabung Tagihan Keluarga"
                bgColor="bg-opensimrs-300" textColor="text-white" borderColor="border-opensimrs-300" />
            </div>
            <div class="flex">
              <UserDoctorIcon class="mt-2" />
              <p class="mt-2 text-sm text-grey-400">
                {{ openedData.doctor }}
              </p>
            </div>
            <div v-if="itemTagihan?.scheduleTime" class="flex">
              <p class="text-sm">Tanggal</p>
              <PhArrowRight :size="18" class="my-auto ml-2 text-success-300" weight="bold" />
              <p class="ml-2 text-sm">{{ itemTagihan?.scheduleTime || '-' }}</p>
            </div>
          </div>

          <!-- table kamar-->
          <div class="pt-5 shadow-md rounded-xl" v-if="itemTagihan?.item?.ruangan?.list?.length > 0">
            <DataTable :value="itemTagihan.item.ruangan.list" class="overflow-hidden rounded-t-[10px]"
              :pt="{ headerRow: 'text-SM' }">
              <Column header="Tanggal" headerClass="bg-opensimrs-50" style="width: 12%">
                <template #body="slotProps">
                  <p class="text-SM">{{ slotProps.data.date }}</p>
                </template>
              </Column>
              <Column header="Kamar" headerClass="bg-opensimrs-50" style="width: 20%">
                <template #body="slotProps">
                  <p class="text-sm">{{ slotProps.data.itemName }}</p>
                </template>
              </Column>
              <Column header="Jenis Ruangan" headerClass="bg-opensimrs-50" style="width: 20%">
                <template #body="slotProps">
                  <p class="text-sm">{{ slotProps.data.jenisRuangan }}</p>
                </template>
              </Column>
              <Column header="Kelas Ruangan" headerClass="bg-opensimrs-50" style="width: 13%">
                <template #body="slotProps">
                  <p class="text-sm">{{ slotProps.data.kelasRuangan }}</p>
                </template>
              </Column>
              <Column header="Waktu" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left" style="width: 10%">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.qty }} Hari</div>
                </template>
              </Column>
              <Column header="Tarif" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left" style="width: 15%">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.price?.toLocaleString('id-ID') || 0 }}</div>
                </template>
              </Column>
              <Column header="Total" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left" style="width: 15%">
                <template #body="slotProps">
                  <div class="text-SM">{{ (slotProps.data.qty * slotProps.data.price)?.toLocaleString('id-ID') || 0 }}
                  </div>
                </template>
              </Column>
            </DataTable>
            <div class="flex justify-between p-2 font-bold bg-white rounded-b-[10px]">
              <p class="text-base font-bold ">Total</p>
              <p class="text-base font-bold">
                Rp {{ itemTagihan.item.ruangan.total?.toLocaleString('id-ID') || 0 }}
              </p>
            </div>
          </div>

          <!-- table penunjang -->
          <div class="pt-5 shadow-md rounded-xl" v-if="itemTagihan?.item?.penunjang?.list?.length > 0">
            <DataTable :value="itemTagihan.item.penunjang.list" class="overflow-hidden rounded-t-[10px]"
              :pt="{ headerRow: 'text-SM' }">
              <Column header="Tanggal" headerClass="bg-opensimrs-50" style="width: 15%">
                <template #body="slotProps">
                  <p class="text-SM">{{ slotProps.data.date }}</p>
                </template>
              </Column>
              <Column header="Penunjang" headerClass="bg-opensimrs-50" style="width: 45%">
                <template #body="slotProps">
                  <p class="text-sm">{{ slotProps.data.itemName }}</p>
                </template>
              </Column>
              <Column header="Jumlah" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left" style="width: 10%">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.qty }}</div>
                </template>
              </Column>
              <Column header="Tarif" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left" style="width: 15%">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.price?.toLocaleString('id-ID') || 0 }}</div>
                </template>
              </Column>
              <Column header="Total" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left" style="width: 20%">
                <template #body="slotProps">
                  <div class="text-SM">{{ (slotProps.data.qty * slotProps.data.price)?.toLocaleString('id-ID') || 0 }}
                  </div>
                </template>
              </Column>
            </DataTable>
            <div class="flex justify-between p-3 font-bold bg-white rounded-b-[10px]">
              <p class="text-base font-bold ">Total</p>
              <p class="text-base font-bold">
                RP {{ itemTagihan.item.penunjang.total?.toLocaleString('id-ID') || 0 }}
              </p>
            </div>
          </div>

          <!-- table tindakan -->
          <div class="pt-5 shadow-md rounded-xl" v-if="itemTagihan?.item?.tindakan?.list?.length > 0">
            <DataTable :value="itemTagihan.item.tindakan.list" class="overflow-hidden rounded-t-[10px]"
              :pt="{ headerRow: 'text-SM' }">
              <Column header="Tanggal" headerClass="bg-opensimrs-50" style="width: 15%">
                <template #body="slotProps">
                  <p class="text-SM">{{ slotProps.data.date }}</p>
                </template>
              </Column>
              <Column header="Tindakan, Pemeriksaan, dan Administrasi" headerClass="bg-opensimrs-50" style="width: 45%">
                <template #body="slotProps">
                  <p class="text-sm">{{ slotProps.data.itemName }}</p>
                </template>
              </Column>
              <Column header="Jumlah" headerClass="bg-opensimrs-50 text-left" bodyClass="text-left" style="width: 15%">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.qty }}</div>
                </template>
              </Column>
              <Column header="Tarif" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left" style="width: 15%">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.price?.toLocaleString('id-ID') || 0 }}</div>
                </template>
              </Column>
              <Column header="Total" headerClass="bg-opensimrs-50 text-left" bodyClass="text-left" style="width: 15%">
                <template #body="slotProps">
                  <div class="text-SM">{{ (slotProps.data.qty * slotProps.data.price)?.toLocaleString('id-ID') || 0 }}
                  </div>
                </template>
              </Column>
            </DataTable>
            <div class="flex justify-between p-3 font-bold bg-white rounded-b-[10px]">
              <p class="text-base font-bold ">Total</p>
              <p class="text-base font-bold">
                RP {{ itemTagihan.item.tindakan.total?.toLocaleString('id-ID') || 0 }}
              </p>
            </div>
          </div>

          <!-- table obat -->
          <div class="pt-5 shadow-md rounded-xl" v-if="itemTagihan?.item?.obat?.list?.length > 0">
            <DataTable :value="itemTagihan.item.obat.list" class="overflow-hidden rounded-t-[10px]"
              :pt="{ headerRow: 'text-SM' }">
              <Column header="Tanggal" headerClass="bg-opensimrs-50" style="width: 15%">
                <template #body="slotProps">
                  <p class="text-SM">{{ slotProps.data.date }}</p>
                </template>
              </Column>
              <Column header="Obat" headerClass="bg-opensimrs-50" style="width: 25%">
                <template #body="slotProps">
                  <p class="text-sm">{{ slotProps.data.itemName }}</p>
                </template>
              </Column>
              <Column header="Golongan Obat" headerClass="bg-opensimrs-50" style="width: 15%">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.additionalField }}</div>
                </template>
              </Column>
              <Column header="Jumlah" headerClass="bg-opensimrs-50 text-left" bodyClass="text-left" style="width: 15%">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.qty }}</div>
                </template>
              </Column>
              <Column header="Tarif" headerClass="bg-opensimrs-50 text-left" bodyClass="text-left" style="width: 10%">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.price?.toLocaleString('id-ID') || 0 }}</div>
                </template>
              </Column>
              <Column header="Jasa" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left" style="width: 10%">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.serviceFee?.toLocaleString('id-ID') || 0 }}</div>
                </template>
              </Column>
              <Column header="Total" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left" style="width: 15%">
                <template #body="slotProps">
                  <div class="text-SM">
                    {{ (slotProps.data.qty * slotProps.data.price + (slotProps.data.serviceFee ?? 0))?.toLocaleString
                      ('id-ID') || 0 }}
                  </div>
                </template>
              </Column>
            </DataTable>
            <div class="flex justify-between p-3 font-bold bg-white rounded-b-[10px]">
              <p class="text-base font-bold ">Total</p>
              <p class="text-base font-bold">
                RP {{ itemTagihan.item.obat.total?.toLocaleString('id-ID') || 0 }}
              </p>
            </div>
          </div>

          <!-- table alkes -->
          <div class="pt-5 shadow-md rounded-xl" v-if="itemTagihan?.item?.alkes?.list?.length > 0">
            <DataTable :value="itemTagihan.item.alkes.list" class="overflow-hidden rounded-t-[10px]"
              :pt="{ headerRow: 'text-SM' }">
              <Column header="Tanggal" headerClass="bg-opensimrs-50" style="width: 15%">
                <template #body="slotProps">
                  <p class="text-SM">{{ slotProps.data.date }}</p>
                </template>
              </Column>
              <Column header="Alkes" headerClass="bg-opensimrs-50" style="width: 45%">
                <template #body="slotProps">
                  <p class="text-sm">{{ slotProps.data.itemName }}</p>
                </template>
              </Column>
              <Column header="Jumlah" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left" style="width: 15%">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.qty }}</div>
                </template>
              </Column>
              <Column header="Tarif" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left" style="width: 15%">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.price?.toLocaleString('id-ID') || 0 }}</div>
                </template>
              </Column>
              <Column header="Total" headerClass="bg-opensimrs-50 text-left" bodyClass="text-left" style="width: 15%">
                <template #body="slotProps">
                  <div class="text-SM">{{ (slotProps.data.qty * slotProps.data.price)?.toLocaleString('id-ID') || 0 }}
                  </div>
                </template>
              </Column>
            </DataTable>
            <div class="flex justify-between p-3 font-bold bg-white rounded-b-[10px]">
              <p class="text-base font-bold ">Total</p>
              <p class="text-base font-bold">
                RP {{ itemTagihan.item.alkes.total?.toLocaleString('id-ID') || 0 }}
              </p>
            </div>
          </div>

          <div class="mt-4">
            <card class="bg-opensimrs-50">
              <template #content>
                <div class="flex justify-between">
                  <p class="text-base font-bold">Total Keseluruhan</p>
                  <p class="text-base font-bold">
                    RP {{ itemTagihan.total?.toLocaleString('id-ID') || 0 }}
                  </p>
                </div>
              </template>
            </card>
          </div>
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
