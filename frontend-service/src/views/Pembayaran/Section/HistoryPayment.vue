<script setup lang="ts">
import { type PropType, ref, onMounted, computed } from "vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { useReportCloseBillStore } from "@/stores/pembayaran/closeBill";
import { utilsStore } from "@/stores/utils";
import { epochToDate, formatPrice } from "@/utils/Helpers";

const props = defineProps({
    billUuid: {
        type: String,
        required: true,
    }
});

const store = useReportCloseBillStore();
const storeUtils = utilsStore();
const paymentHistory = ref<any[]>([]);

const paymentTypeMap: { [key: string]: string } = {
    'CASH': 'TUNAI',
    'INSURANCE': 'ASURANSI'
};

// Computed property untuk memeriksa status lunas
const shouldDisplayHistory = computed(() => {
    const history = paymentHistory.value;

    if (history.length === 0) {
        return false;
    }
    if (history.length > 1) {
        return true;
    }

    if (history.length === 1) {
        const singlePayment = history[0];
        return singlePayment.debtAfter > 0;
    }
    return false;
});

const fetchPaymentData = async () => {
    if (!props.billUuid) return;
    storeUtils.setLoading(true);
    try {
        const response = await store.getPaymentHistory(props.billUuid);
        if (response?.payload?.paymentHistory) {
            paymentHistory.value = response.payload.paymentHistory;
        }
    } catch (error) {
        console.error("Gagal mengambil riwayat pembayaran hutang:", error);
    } finally {
        storeUtils.setLoading(false);
    }
};

onMounted(() => {
    fetchPaymentData();
});
</script>

<template>
    <div v-if="shouldDisplayHistory">
        <CustomAccordion :openWithHeader="false">
            <template #header>
                <div class="flex justify-between w-full align-middle">
                    <div class="flex">
                        <span class="leading-10 text-opensimrs-300 text-heading">
                            Riwayat Pembayaran 
                        </span>
                    </div>
                </div>
            </template>
            <template #content>
                <div class="pt-5">
                    <DataTable :value="paymentHistory" class="overflow-hidden rounded-t-[10px]"
                        :pt="{ headerRow: 'text-SM' }">
                        <Column header="Tanggal Bayar" headerClass="bg-opensimrs-50" style="width: 25%">
                            <template #body="slotProps">
                                {{ epochToDate(slotProps.data.createdAt, "date") }}
                            </template>
                        </Column>
                        <Column header="No.Kuitansi" headerClass="bg-opensimrs-50" style="width: 25%">
                            <template #body="slotProps">
                                {{ slotProps.data.receiptNumber }}
                            </template>
                        </Column>
                        <Column header="Cara Bayar " headerClass="bg-opensimrs-50" style="width: 35%">
                            <template #body="slotProps">
                                {{ paymentTypeMap[slotProps.data.paymentType] || slotProps.data.paymentType }}
                            </template>
                        </Column>
                        <Column header="Jumlah Terbayar" headerClass="bg-opensimrs-50" style="width: 15%">
                            <template #body="slotProps">
                                Rp. {{ Number(slotProps.data.amount).toLocaleString('id-ID') }}
                            </template>
                        </Column>
                    </DataTable>
                </div>
            </template>
            <template #collapseIcon>
                <CustomButton icon="PhCaretUp" backgroundColor="bg-opensimrs-75" textColor="text-opensimrs-300" />
            </template>
            <template #expandIcon>
                <CustomButton icon="PhCaretDown" backgroundColor="bg-opensimrs-75" textColor="text-opensimrs-300" />
            </template>
        </CustomAccordion>
    </div>
</template>