<script setup lang="ts">
import { type PropType, ref, onMounted } from "vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import { formatPrice } from "@/utils/Helpers";
import { useReportCloseBillStore } from "@/stores/pembayaran/closeBill";
import { utilsStore } from "@/stores/utils";

const props = defineProps({
  billUuid: {
    type: String,
    required: true,
  }
});

const emit = defineEmits(['update:payment-status']);

const store = useReportCloseBillStore();
const storeUtils = utilsStore();

const paymentData = ref<any>(null);

const translatePaymentMethod = (method: string | null) => {
  //jika metode pembayarannya asuransi
  if (method === null) {
    return 'Asuransi';
  }
  if (!method) {
    return '-';
  }
  switch (method.toUpperCase()) {
    case 'CASH':
      return 'Tunai';
    case 'CREDIT':
      return 'Kredit';
    case 'TRANSFER':
      return 'Transfer';
    case 'DEBIT':
      return 'Debit';
    default:
      return method;
  }
};

//formating Nominal IDR
const formatPriceLokal = (price: number) => {
    if (typeof price !== 'number') return 'Rp 0';
    const roundedPrice = Math.ceil(price);
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(roundedPrice);
};

const fetchPaymentHistory = async () => {
  if (!props.billUuid) return;
  storeUtils.setLoading(true);
  try {
    const response = await store.getPaymentHistory(props.billUuid);
    if (response && response.payload) {
      paymentData.value = response.payload;
      emit('update:payment-status', response.payload.isPaid);
    }
  } catch (error) {
    console.error("Gagal mengambil riwayat pembayaran:", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(() => {
  fetchPaymentHistory();
});
</script>

<template>
  <CustomAccordion :openWithHeader="false">
    <template #header>
      <div class="flex justify-between w-full align-middle">
        <div v-if="paymentData" class="flex">
          <p class="leading-10 text-opensimrs-300 text-heading">
            Pembayaran
          </p>
          <CustomChip v-if="paymentData.isPaid === true" class="mt-2 ml-3" :showCheckedIcon="false" label="Lunas"
            bgColor="bg-success-75" textColor="text-success-300" customClass="h-5 border-none" />
          <CustomChip v-else class="mt-2 ml-3" :showCheckedIcon="false" label="Piutang" bgColor="bg-danger-75"
            textColor="text-danger-300" customClass="h-5 border-none" />
        </div>
      </div>
    </template>
    <template #content>
      <div v-if="paymentData" class="pt-5">

        <div class="flex justify-between">
          <p class="text-base font-bold">Total</p>
          <p class="text-base font-bold">Rp {{ paymentData.subTotal?.toLocaleString('id-ID') || 0 }}</p>
        </div>
        <div class="flex justify-between mt-4">
          <p class="text-base font-bold">Biaya Administrasi</p>
          <p class="text-base font-bold">Rp {{ paymentData.adminFee?.toLocaleString('id-ID') || 0 }}</p>
        </div>
        <div class="flex justify-between mt-4">
          <p class="text-base font-bold">Diskon ({{ paymentData.discount?.percentage || 0 }}%)</p>
          <p class="text-base font-bold">Rp {{ paymentData.discount.amount?.toLocaleString('id-ID') || 0 }}</p>
        </div>
        <div class="flex justify-between mt-4">
          <p class="text-base font-bold">PPN ({{ paymentData.ppn?.percentage || 0 }}%)</p>
          <p class="text-base font-bold">Rp {{ paymentData.ppn.amount?.toLocaleString('id-ID') || 0 }}</p>
        </div>
        <div class="flex justify-between mt-4">
          <p class="text-base font-bold">Grand Total</p>
          <p class="text-base font-bold">{{ formatPriceLokal(paymentData.grandTotal) || 0 }}</p>
        </div>

        <div class="flex justify-between mt-4">
          <p class="text-base font-bold">Jumlah Terbayar</p>
          <p class="text-base font-bold">Rp {{ paymentData.totalPaid?.toLocaleString('id-ID') || 0 }}</p>
        </div>

        <div v-if="!paymentData.isPaid" class="flex justify-between mt-4">
          <p class="text-base font-bold text-danger-300">Sisa Bayar</p>
          <p class="text-base font-bold text-danger-300">- Rp {{ paymentData.debt?.toLocaleString('id-ID') || 0 }}</p>
        </div>

        <hr class="mt-6 mb-3 border-2 border-grey-200">
        <div class="grid grid-cols-2 mt-6" v-if="paymentData.paymentHistory && paymentData.paymentHistory.length > 0">
          <div>
            <p class="text-xs font-bold underline underline-offset-2">Metode Pembayaran</p>
            <p class="text-xs font-normal ">{{
              translatePaymentMethod(paymentData.paymentHistory[paymentData.paymentHistory.length - 1].paymentMethod) }}
            </p>
          </div>
          <div>
            <p class="text-xs font-bold underline underline-offset-2">No. Referensi</p>
            <p class="text-xs font-normal">{{ paymentData.paymentHistory[paymentData.paymentHistory.length -1].referensi || '-' }}</p>
          </div>
        </div>

      </div>
      <div v-else>
        <p>Memuat data pembayaran...</p>
      </div>
    </template>
    <template #collapseIcon>
      <CustomButton icon="PhCaretUp" backgroundColor="bg-opensimrs-75" textColor="text-opensimrs-300" />
    </template>
    <template #expandIcon>
      <CustomButton icon="PhCaretDown" backgroundColor="bg-opensimrs-75" textColor="text-opensimrs-300" />
    </template>
  </CustomAccordion>
</template>