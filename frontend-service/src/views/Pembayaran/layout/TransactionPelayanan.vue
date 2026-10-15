<script setup lang="ts">
import type { MenuItem } from "primevue/menuitem";
import { onMounted, ref, type PropType, computed, watch } from "vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { usePelayananTransaction } from "@/stores/pembayaran/pelayanan";
import { useAdmisiMasterPasienStore } from "@/stores/admisi/masterPasien";
import { useTagihanStore } from "@/stores/pembayaran/findBill";
import { createInvoicePdf } from "@/utils/pdf/pdfPembayaran/cetakKuitansi";
import { createRincianPdf } from "@/utils/pdf/pdfPembayaran/cetakTagihan";
import { utilsStore } from "@/stores/utils";
import { epochToDate } from "@/utils/Helpers";
import type { DataTableRowClickEvent } from "primevue/datatable";

// PROPS & EMITS 
const props = defineProps({
  billUuid: {
    type: String,
  },
  pageType: {
    type: String,
    required: true,
  },
  dataBreadCrumb: {
    type: Array as PropType<MenuItem[]>,
    default: () => [],
  },
});
const emit = defineEmits(["back"]);

// STORE 
const pelayananStore = usePelayananTransaction();
const AdmisiMasterPasienStore = useAdmisiMasterPasienStore();
const tagihanStore = useTagihanStore();
const storeUtils = utilsStore();

//  STATE UTAMA 
const detailData = ref<any>(null);
const listTagihan = ref<any[]>([]);
const isPaid = ref(false);
const totalPaid = ref(0);
const isBillClosed = ref(false);

//  STATE DIALOG DETAIL ITEM 
const listTagihanRIDialog = ref(false);
const itemTagihan = ref<any>(null);
const openedData = ref<any>({});

//  STATE DIALOG PEMBAYARAN 
const pembayaranDialog = ref(false);
const amount = ref<number>();
const payment_type = ref("");
const payment_method = ref("");
const note = ref("");
const information = ref("");
const kembalian = ref<number>(0);

const confirmDiscountDialog = ref(false);
const confirmVoucherDialog = ref(false);

const codeVoucher = ref("");
const codeDiscount = ref<string>();
const discountDisabled = ref(false);
const voucherDisabled = ref(false);

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

//Mapping PaymentType
const paymentTypeMap: { [key: string]: string } = {
  'TUNAI': 'Tunai',
  'ASURANSI': 'Asuransi'
};

//Flexibilitas Format Voucher
const formattedVoucherValue = computed(() => {
  if (!detailData.value || !detailData.value.voucherValue) {
    return 'Rp 0';
  }

  const type = detailData.value.voucherType;
  const value = detailData.value.voucherValue;
  if (type === 'persentase') {
    return `${value} %`;
  }
  else if (type === 'potongan') {
    return formatPriceLokal(value);
  }
  return formatPriceLokal(value);
});


// Mengambil data detail tagihan utama
const fetchDetailBill = async () => {
  if (!props.billUuid) return;
  storeUtils.setLoading(true);
  try {
    const response = await pelayananStore.getDetailBill(props.billUuid);
    const data = response.payload;

    if (data) {
      // Masukkan data awal tagihan
      detailData.value = data;
      isPaid.value = data.isPaid;
      totalPaid.value = data.totalPaid || 0;
      isBillClosed.value = data.closeBill;
      let patientDetailFromAdmisi: any = null;

      // Menonaktifkan tombol jika lunas/tutup
      if (isPaid.value || isBillClosed.value) {
        discountDisabled.value = true;
        voucherDisabled.value = true;
      }

      // [3] FETCH DETAIL PASIEN (Logic Tambahan)
      // Ambil patientUuid dari data tagihan untuk get detail pasien
      if (data.patientUuid) {
        try {
          const resPasien = await AdmisiMasterPasienStore.getDetailMasterPasien(data.patientUuid);
          if (resPasien && resPasien.payload) {
            const pasien = resPasien.payload;

            // Map Gender & Umur ke detailData agar bisa dipakai di template
            // Pastikan mapping sesuai dengan response API getDetailMasterPasien
            detailData.value.gender = pasien.gender === 'Female' ? 'Perempuan' : 'Laki-laki';

            if (pasien.birthDetail) {
              detailData.value.ageYear = pasien.birthDetail.ageYear;
              detailData.value.ageMonth = pasien.birthDetail.ageMonth;
              detailData.value.ageDay = pasien.birthDetail.ageDay;
            }
          }
        } catch (err) {
          console.error("Gagal mengambil detail pasien:", err);
        }
      }

      // Memproses list tagihan
      listTagihan.value = (data.serviceBill || []).map((service: any) => ({
        uuid: service.uuid,
        layanan: service.serviceName,
        doctor: service.practitionerName,
        isChildBill: service.isChildBill,
      }));
    }
  } catch (error) {
    console.error("Gagal mengambil detail tagihan:", error);
  } finally {
    storeUtils.setLoading(false);
  }
};


// Mengambil detail per item saat di-klik di tabel
const handleItemClick = async (event: DataTableRowClickEvent) => {
  openedData.value = event.data;
  storeUtils.setLoading(true);
  try {
    const response = await pelayananStore.getItemBill(openedData.value.uuid);
    if (response && response.payload) {
      itemTagihan.value = response.payload;
      listTagihanRIDialog.value = true;
    }
  } catch (error) {
    console.error("Gagal mengambil item detail:", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

// Mengirim data pembayaran
const submitPayment = async () => {
  if (!props.billUuid) return;
  storeUtils.setLoading(true);
  try {
    const payload = {
      amount: amount.value,
      payment_type: payment_type.value,
      payment_method: payment_method.value,
      note: note.value,
      information: information.value,
    };

    const paymentResponse: any = await pelayananStore.postPayment(props.billUuid, payload);
    if (paymentResponse && paymentResponse.data && paymentResponse.data.payload) {
      const billUuid = props.billUuid;
      // Simpan sebagai string JSON dengan kunci: 'paymentResult_UUID_TAGIHAN'
      localStorage.setItem(`paymentResult_${billUuid}`, JSON.stringify(paymentResponse.data.payload));
    }
    pembayaranDialog.value = false;
    await fetchDetailBill(); // Muat ulang data untuk update status tombol & info
  } catch (error) {
    console.error("Gagal melakukan pembayaran:", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const kasirCloseBillDialog = ref(false);
// Menutup tagihan setelah lunas
const submitCloseBill = async () => {
  if (!props.billUuid) return;
  storeUtils.setLoading(true);
  try {
    // API ini dari tagihanStore 
    await tagihanStore.postKasirCloseBill(props.billUuid, {});
    await fetchDetailBill(); // Muat ulang data untuk update status tombol
    kasirCloseBillDialog.value = false;
  } catch (e) {
    console.error("Gagal menutup tagihan:", e)
  } finally {
    storeUtils.setLoading(false);
  }
}

// Menghitung kembalian saat pembayaran
const getKembalian = () => {
  const requiredAmount = Math.ceil(detailData.value?.grandTotal || 0);
  const paidAmount = amount.value || 0;
  if (paidAmount >= requiredAmount) {
    kembalian.value = paidAmount - requiredAmount;
  } else {
    kembalian.value = 0;
  }
};


const submitDiscount = async () => {
  if (!props.billUuid) return;
  storeUtils.setLoading(true);
  try {
    const payload = {
      value: parseFloat(String(codeDiscount.value).replace(',', '.'))
    };
    await tagihanStore.postDiscount(props.billUuid, payload);
    await fetchDetailBill();
    confirmDiscountDialog.value = false; // <-- TAMBAHKAN INI
  } catch (error) {
    console.error("Gagal memakai diskon:", error);
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

//fungsi untuk cetak invoice
const handleCetakInvoice = async () => {
  storeUtils.setLoading(true);
  try {
    const billUuid = props.billUuid;
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
    const billUuid = props.billUuid;
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

const submitVoucher = async () => {
  if (!props.billUuid) return;
  storeUtils.setLoading(true);
  try {
    const payload = {
      code: codeVoucher.value,
    };
    await tagihanStore.postVoucher(props.billUuid, payload);
    await fetchDetailBill();
    confirmVoucherDialog.value = false; // <-- TAMBAHKAN INI
  } catch (error) {
    console.error("Gagal memakai voucher:", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

// Fungsi untuk mereset dan mengisi otomatis state dialog pembayaran
const initializePaymentDialog = () => {
  // Reset semua input
  amount.value = undefined;
  payment_method.value = "";
  note.value = "";
  information.value = "";
  kembalian.value = 0;

  // Logika untuk mengisi otomatis 'Cara Bayar'
  if (detailData.value && detailData.value.paymentType) {
    const defaultPaymentType = optionCaraBayar.value.find(
      option => option.label.toUpperCase() === detailData.value.paymentType.toUpperCase()
    );
    payment_type.value = defaultPaymentType ? defaultPaymentType.value : "";
  } else {
    payment_type.value = "";
  }
};

//checking jumlah input bayar
const isAmountInsufficient = computed(() => {
  const grandTotal = detailData.value?.grandTotal || 0;
  const paidAmount = amount.value || 0;
  return paidAmount > 0 && paidAmount < grandTotal;
});

// Watcher untuk memicu fungsi di atas saat dialog dibuka
watch(pembayaranDialog, (isOpening) => {
  if (isOpening) {
    initializePaymentDialog();
  }
});

//maks 15 digit amount 
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

watch(amount, () => {
  setTimeout(getKembalian, 700);
});

onMounted(() => {
  fetchDetailBill();
});

// DATA STATIS UNTUK DROPDOWN 
const optionCaraBayar = ref([{ label: "Tunai", value: "CASH" }, { label: "Asuransi", value: "INSURANCE" }]);
const optionMetodeBayar = ref([
  { label: "Tunai", value: "CASH" },
  { label: "Transfer", value: "TRANSFER" },
  { label: "Debit/Kredit", value: "DEBIT_KREDIT" },
]); 
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0" pt:content:class="h-full" class="h-full overflow-hidden overflow-y-auto">
      <template #header>
        <div class="flex justify-between p-4">
          <CustomBreadCrumb :home="{
            label: 'Transaksi',
            home: true,
          }" :model="dataBreadCrumb" />
          <div class="flex">
            <CustomButton @click="emit('back')" icon="PhCaretLeft" label="Kembali" outlined
              borderColor="border-opensimrs-300" textColor="text-opensimrs-300" />
          </div>
        </div>
      </template>

      <template #content>
        <div v-if="!detailData" class="flex items-center justify-center h-full">
          <p>Memuat data tagihan...</p>
        </div>

        <div v-else class="grid grid-cols-2 gap-5 h-full pt-5">
          <div class="flex flex-col gap-4">
            <div class="h-[120px] border-2 border-opensimrs-300 rounded-lg flex flex-row flex-shrink-0">
              <div class="basis-1/2">
                <p class="font-bold text-MD mt-[15px] ml-[15px]">{{ detailData.patientName }}</p>
                <p class="ml-[15px] text-sm">{{ detailData.invoiceCode }}</p>
                <CustomButton class="h-5 text-xs ml-[15px]">{{ detailData.billCode }}</CustomButton>
                <CustomChip v-if="detailData.gender" :showCheckedIcon="false"
                  :label="detailData.gender === 'Perempuan' ? 'Perempuan' : 'Laki-laki'"
                  :bgColor="detailData.gender === 'Perempuan' ? 'bg-female-75' : 'bg-male-75'"
                  :textColor="detailData.gender === 'Perempuan' ? 'text-female-300' : 'text-male-300'"
                  customClass="h-5 pr-[6px] border-none ml-[10px]" />
              </div>
              <div class="bg-mediumGrey-300 w-[1px] h-[74px] mr-[20px] mt-[15px]"></div>
              <div class="mt-[30px] mr-[40px]">
                <p class="text-xs font-bold underline underline-offset-2">Umur</p>
                <p class="">{{ detailData.ageYear }}Thn {{ detailData.ageMonth }}Bln {{ detailData.ageDay }}Hr</p>
              </div>
            </div>

            <div class="flex-grow overflow-hidden">
              <DataTable :value="listTagihan" scrollable scrollHeight="flex"
                class="h-full overflow-hidden rounded-[10px]" :pt="{ headerRow: 'text-SM' }"
                @rowClick="handleItemClick">
                <Column headerClass="bg-opensimrs-300 text-white" bodyClass="text-SM" style="width: 100%">
                  <template #header>
                    <div class="w-full font-bold">List Tagihan Pelayanan</div>
                  </template>
                  <template #body="slotProps">
                    <div class="flex flex-wrap gap-3 items-center">
                      <p class="font-bold text-normal">{{ slotProps.data.layanan }}</p>
                      <CustomChip v-if="detailData.paymentType" class="ml-2" :showCheckedIcon="false"
                        :label="detailData.paymentType"
                        :bgColor="detailData.paymentType === 'ASURANSI' ? 'bg-warning-50' : 'bg-opensimrs-50'"
                        :textColor="detailData.paymentType === 'ASURANSI' ? 'text-warning-300' : 'text-opensimrs-300'"
                        :borderColor="detailData.paymentType === 'ASURANSI' ? 'border-warning-300' : 'border-opensimrs-300'" />
                      <CustomChip v-if="slotProps.data.isChildBill" :showCheckedIcon="false"
                        label="Gabung Tagihan Keluarga" bgColor="bg-opensimrs-300" textColor="text-white"
                        borderColor="border-opensimrs-300" />
                    </div>
                    <div class="flex">
                      <UserDoctorIcon class="mt-2" />
                      <p class="mt-2 text-sm text-grey-400">{{ slotProps.data.doctor }}</p>
                    </div>
                    <div v-if="detailData.scheduleTime" class="flex">
                      <p class="text-sm">Tanggal</p>
                      <PhArrowRight :size="18" class="my-auto ml-2 text-success-300" weight="bold" />
                      <p class="ml-2 text-sm">{{ detailData.scheduleTime }}</p>
                      <p class="ml-2 text-sm">{{ detailData.scheduleTime }}</p>
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
                <CustomButton v-if="totalPaid > 0" label="Cetak Kuitansi" @click="handleCetakInvoice"
                  class="mt-[-10px] mr-[10px]" />
                <CustomButton label="Cetak Tagihan" @click="handleCetakRincianBiaya" class="mt-[-10px]" />
              </div>
            </div>
            <hr class="mt-2 mb-2 border border-slate-300" />
            <div class="flex justify-between mt-6">
              <div class="text-sm">Biaya Administrasi</div>
              <div class="text-sm">Rp {{ detailData.adminFee?.toLocaleString('id-ID') || 0 }}</div>
            </div>
            <div class="flex justify-between mt-4">
              <div class="text-sm">Biaya Tindakan</div>
              <div class="text-sm">Rp {{ detailData.totalTindakan?.toLocaleString('id-ID') || 0 }}</div>
            </div>
            <div class="flex justify-between mt-4">
              <div class="text-sm">Biaya Obat/Alkes</div>
              <div class="text-sm">Rp {{ detailData.totalObatAlkes?.toLocaleString('id-ID') || 0 }}</div>
            </div>
            <div class="flex justify-between mt-4">
              <div class="text-sm">Retur Obat/Alkes</div>
              <div class="text-sm">Rp {{ detailData.returObatAlkes?.toLocaleString('id-ID') || 0 }}</div>
            </div>
            <div class="flex justify-between mt-4">
              <div class="text-sm">Biaya Kamar</div>
              <div class="text-sm">Rp {{ detailData.totalRuangan?.toLocaleString('id-ID') || 0 }}</div>
            </div>
            <div class="flex justify-between mt-6">
              <div class="text-sm">Diskon</div>
              <div class="text-sm">{{ detailData.discount || "0" }} % </div>
            </div>
            <div class="flex justify-between mt-6">
              <div class="text-sm">Voucher</div>
              <div class="text-sm"> {{ formattedVoucherValue }} </div>
            </div>
            <hr class="mt-4 border-dashed border-[1px] border-slate-300" />
            <div class="flex justify-between mt-6">
              <div class="text-sm font-bold">Total</div>
              <div class="text-sm font-bold">Rp {{ detailData.subTotal?.toLocaleString('id-ID') || 0 }} </div>
            </div>
            <div class="flex justify-between mt-4">
              <div class="text-sm">PPN</div>
              <div class="text-sm">Rp {{ detailData.ppn?.toLocaleString('id-ID') || 0 }}</div>
            </div>
            <hr class="mt-6 mb-2 border-slate-300 border-1" />
            <div class="flex justify-between mt-6">
              <div class="text-sm font-bold">Grand Total</div>
              <div class="text-sm font-bold"> {{ formatPriceLokal(detailData.grandTotal) }}</div>
            </div>

            <div class="flex mt-[30px]">
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
                class="w-[30%] ml-[50px] mr-[10px]" :disabled="voucherDisabled" />
              <CustomButton label="Pakai Voucher" class="" @click="confirmVoucherDialog = true"
                :disabled="voucherDisabled" />
            </div>
            <hr class="mt-6 mb-2 border-slate-300 border-1" />

            <div class="mt-[0px]">
              <CustomButton v-if="totalPaid === 0" @click="pembayaranDialog = true" label="Bayar" class="w-full" />
              <CustomButton v-else-if="!isBillClosed" @click="kasirCloseBillDialog = true" label="Close Bill"
                class="w-full" backgroundColor="bg-danger-300" />

              <div v-else class="p-4  ">
                <div class="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p class="font-semibold underline underline-offset-2">Metode Pembayaran</p>
                    <p>{{ paymentTypeMap[detailData.paymentType] || detailData.paymentType }}</p>
                  </div>
                  <div>
                    <p class="font-semibold underline underline-offset-2">No. Referensi</p>
                    <p>{{ detailData.noReferensi || '-' }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="pembayaranDialog" width="600px">
      <template #header>Pembayaran</template>
      <template #body>
        <div class="flex justify-between">
          <p class="font-bold mt-[20px]">Grand Total</p>
          <p class="font-bold mt-[20px]"> {{ formatPriceLokal(detailData.grandTotal) }}</p>
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
            <p class="text-xs text-danger-300">*Pembayaran kurang dari Grand Total, tetap melanjutkan dengan
              status piutang?
            </p>
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
            <p class="text-xs text-danger-300">*Pembayaran kurang dari Grand Total, tetap melanjutkan dengan
              status
              piutang?</p>
          </div>
          <hr class="mt-6 border-1 border-grey-200" />
        </div>

        <div>
          <CustomTextfield v-model="note" class="mt-[30px]" label="Catatan" placeholder="Keterangan" />
        </div>
        <div class="flex mt-[20px] gap-4">
          <div>
            <CustomSelect label="Cara Bayar" class="flex-1" optionLabel="label" optionValue="value" :disabled="true"
              :clearable="false" :options="optionCaraBayar" v-model="payment_type" />
          </div>
          <div v-if="payment_type !== 'INSURANCE'">
            <CustomSelect label="Metode Pembayaran" class="flex-1" optionLabel="label" optionValue="value"
              :options="optionMetodeBayar" v-model="payment_method" />
          </div>
          <div>
            <CustomTextfield v-model="information" class="flex-1" label="Keterangan" placeholder="Keterangan" />
          </div>
          <div class="mt-[25px] flex ">
            <CustomButton label="Bayar" @click="submitPayment" />
          </div>
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
          <CustomButton @click="submitCloseBill" label="Close Bill" class="ml-2" backgroundColor="bg-danger-300" />
        </div>
      </template>
    </CustomDialog>

    <!-- Dialog Pakai Diskon-->
    <CustomDialog v-model:visible="confirmDiscountDialog" width="500px">
      <template #header>Pakai Diskon</template>
      <template #body>
        <div class="mt-6 text-base">
          <p>Apakah anda yakin menggunakan <strong>Diskon</strong>?</p>
        </div>
        <div class="text-sm">
          <p class="mt-4 italic text-danger-300">*Diskon akan mempengaruhi <strong>Grand Total</strong></p>
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

    <!--Dialog Pakai Voucher-->>
    <CustomDialog v-model:visible="confirmVoucherDialog" width="500px">
      <template #header>Pakai Voucher</template>
      <template #body>
        <div class="mt-6 text-base">
          <p>Apakah anda yakin menggunakan <strong>Voucher</strong>?</p>
        </div>
        <div class="text-sm">
          <p class="mt-4 italic text-danger-300">*Voucher akan mempengaruhi <strong>Grand Total</strong></p>
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

    <CustomDialog v-model:visible="listTagihanRIDialog" width="1000px">
      <template #header>Detail Tagihan Pelayanan</template>
      <template #body>
        <div v-if="openedData && itemTagihan">
          <div class="pt-5">
            <div class="flex flex-wrap gap-3 items-center">
              <p class="font-bold">{{ openedData.layanan }}</p>
              <CustomChip v-if="detailData.paymentType" class="ml-2" :showCheckedIcon="false"
                :label="detailData.paymentType"
                :bgColor="detailData.paymentType === 'ASURANSI' ? 'bg-warning-50' : 'bg-opensimrs-50'"
                :textColor="detailData.paymentType === 'ASURANSI' ? 'text-warning-300' : 'text-opensimrs-300'"
                :borderColor="detailData.paymentType === 'ASURANSI' ? 'border-warning-300' : 'border-opensimrs-300'" />
              <CustomChip v-if="openedData.isChildBill" :showCheckedIcon="false" label="Gabung Tagihan Keluarga"
                bgColor="bg-opensimrs-300" textColor="text-white" borderColor="border-opensimrs-300" />
            </div>
            <div class="flex">
              <UserDoctorIcon class="mt-2" />
              <p class="mt-2 text-sm text-grey-400">{{ openedData.doctor }}</p>
            </div>
            <div v-if="itemTagihan.scheduleTime" class="flex">
              <p class="text-sm">Tanggal</p>
              <PhArrowRight :size="18" class="my-auto ml-2 text-success-300" weight="bold" />
              <p class="ml-2 text-sm">{{ itemTagihan.scheduleTime || '-' }}</p>
            </div>
          </div>

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
              <Column header="Waktu" headerClass="bg-opensimrs-50" bodyClass="text-left" style="width: 10%">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.qty }} Hari</div>
                </template>
              </Column>
              <Column header="Tarif" headerClass="bg-opensimrs-50" bodyClass="text-left" style="width: 15%">
                <template #body="slotProps">
                  <div class="text-SM">Rp {{ slotProps.data.price?.toLocaleString('id-ID') }}</div>
                </template>
              </Column>
              <Column header="Total" headerClass="bg-opensimrs-50" bodyClass="text-left" style="width: 15%">
                <template #body="slotProps">
                  <div class="text-SM">Rp {{ (slotProps.data.qty * slotProps.data.price).toLocaleString('id-ID') }}
                  </div>
                </template>
              </Column>
            </DataTable>
            <div class="flex justify-between p-2 font-bold bg-white rounded-b-[10px]">
              <p class="text-base font-bold ">Total kamar</p>
              <p class="text-base font-bold">Rp {{ itemTagihan.item.ruangan.total?.toLocaleString('id-ID') }}</p>
            </div>
          </div>

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
              <Column header="Jumlah" headerClass="bg-opensimrs-50" bodyClass="text-left" style="width: 10%">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.qty }}</div>
                </template>
              </Column>
              <Column header="Tarif" headerClass="bg-opensimrs-50" bodyClass="text-left" style="width: 15%">
                <template #body="slotProps">
                  <div class="text-SM">Rp {{ slotProps.data.price?.toLocaleString('id-ID') }}</div>
                </template>
              </Column>
              <Column header="Total" headerClass="bg-opensimrs-50" bodyClass="text-left" style="width: 20%">
                <template #body="slotProps">
                  <div class="text-SM">Rp {{ (slotProps.data.qty * slotProps.data.price).toLocaleString('id-ID') }}
                  </div>
                </template>
              </Column>
            </DataTable>
            <div class="flex justify-between p-3 font-bold bg-white rounded-b-[10px]">
              <p class="text-base font-bold ">Total penunjang</p>
              <p class="text-base font-bold">Rp {{ itemTagihan.item.penunjang.total?.toLocaleString('id-ID') }}</p>
            </div>
          </div>

          <div class="pt-5 shadow-md rounded-xl" v-if="itemTagihan?.item?.tindakan?.list?.length > 0">
            <DataTable :value="itemTagihan.item.tindakan.list" class="overflow-hidden rounded-t-[10px]"
              :pt="{ headerRow: 'text-SM' }">
              <Column header="Tanggal" headerClass="bg-opensimrs-50" style="width: 15%">
                <template #body="slotProps">
                  <p class="text-SM">{{ slotProps.data.date }}</p>
                </template>
              </Column>
              <Column header="Tindakan, Pemeriksaan, dan Administrasi" headerClass="bg-opensimrs-50" style="width: 35%">
                <template #body="slotProps">
                  <p class="text-sm">{{ slotProps.data.itemName }}</p>
                </template>
              </Column>
              <Column header="Jumlah" headerClass="bg-opensimrs-50" bodyClass="text-left" style="width: 15%">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.qty }}</div>
                </template>
              </Column>
              <Column header="Tarif" headerClass="bg-opensimrs-50" bodyClass="text-left" style="width: 13%">
                <template #body="slotProps">
                  <div class="text-SM">Rp {{ slotProps.data.price?.toLocaleString('id-ID') }}</div>
                </template>
              </Column>
              <Column header="Total" headerClass="bg-opensimrs-50" bodyClass="text-left" style="width: 15%">
                <template #body="slotProps">
                  <div class="text-SM">Rp {{ (slotProps.data.qty * slotProps.data.price).toLocaleString('id-ID') }}
                  </div>
                </template>
              </Column>
            </DataTable>
            <div class="flex justify-between p-3 font-bold bg-white rounded-b-[10px]">
              <p class="text-base font-bold ">Total tindakan</p>
              <p class="text-base font-bold">Rp {{ itemTagihan.item.tindakan.total?.toLocaleString('id-ID') }}</p>
            </div>
          </div>

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
              <Column header="Jumlah" headerClass="bg-opensimrs-50" bodyClass="text-left" style="width: 10%">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.qty }}</div>
                </template>
              </Column>
              <Column header="Tarif" headerClass="bg-opensimrs-50" bodyClass="text-left" style="width: 10%">
                <template #body="slotProps">
                  <div class="text-SM">Rp {{ slotProps.data.price?.toLocaleString('id-ID') }}</div>
                </template>
              </Column>
              <Column header="Jasa" headerClass="bg-opensimrs-50" bodyClass="text-left" style="width: 10%">
                <template #body="slotProps">
                  <div class="text-SM">Rp {{ (slotProps.data.serviceFee ?? 0).toLocaleString('id-ID') }}</div>
                </template>
              </Column>
              <Column header="Total" headerClass="bg-opensimrs-50" bodyClass="text-left" style="width: 15%">
                <template #body="slotProps">
                  <div class="text-SM">Rp {{ (slotProps.data.qty * slotProps.data.price + (slotProps.data.serviceFee ??
                    0)).toLocaleString('id-ID') }}</div>
                </template>
              </Column>
            </DataTable>
            <div class="flex justify-between p-3 font-bold bg-white rounded-b-[10px]">
              <p class="text-base font-bold ">Total obat</p>
              <p class="text-base font-bold">Rp {{ itemTagihan.item.obat.total?.toLocaleString('id-ID') }}</p>
            </div>
          </div>

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
              <Column header="Jumlah" headerClass="bg-opensimrs-50" bodyClass="text-left" style="width: 15%">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.qty }}</div>
                </template>
              </Column>
              <Column header="Tarif" headerClass="bg-opensimrs-50" bodyClass="text-left" style="width: 15%">
                <template #body="slotProps">
                  <div class="text-SM">Rp {{ slotProps.data.price?.toLocaleString('id-ID') }}</div>
                </template>
              </Column>
              <Column header="Total" headerClass="bg-opensimrs-50" bodyClass="text-left" style="width: 15%">
                <template #body="slotProps">
                  <div class="text-SM">Rp {{ (slotProps.data.qty * slotProps.data.price).toLocaleString('id-ID') }}
                  </div>
                </template>
              </Column>
            </DataTable>
            <div class="flex justify-between p-3 font-bold bg-white rounded-b-[10px]">
              <p class="text-base font-bold ">Total alkes</p>
              <p class="text-base font-bold">Rp {{ itemTagihan.item.alkes.total?.toLocaleString('id-ID') }}</p>
            </div>
          </div>

          <div class="mt-4">
            <card class="bg-opensimrs-50">
              <template #content>
                <div class="flex justify-between">
                  <p class="text-base font-bold">Total Keseluruhan Item</p>
                  <p class="text-base font-bold">Rp {{ itemTagihan.total?.toLocaleString('id-ID') || 0 }}</p>
                </div>
              </template>
            </card>
          </div>
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
