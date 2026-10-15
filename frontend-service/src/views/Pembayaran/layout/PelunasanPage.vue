<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import { useReportCloseBillStore } from "@/stores/pembayaran/closeBill";
import { useTagihanStore } from "@/stores/pembayaran/findBill";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import { createInvoicePdf } from "@/utils/pdf/pdfPembayaran/cetakKuitansi";
import { createRincianPdf } from "@/utils/pdf/pdfPembayaran/cetakTagihan";
import { utilsStore } from "@/stores/utils";
import { epochToDate } from "@/utils/Helpers";
import { useRouter, useRoute } from "vue-router";
import type { MenuItem } from "primevue/menuitem";
import type { DataTableRowClickEvent } from "primevue/datatable";


// State Management
const router = useRouter();
const storeUtils = utilsStore();
const closeBillStore = useReportCloseBillStore();
const tagihanStore = useTagihanStore();

// State Data
const kasirData = ref<any>(null);
const itemsPasien = ref<any[]>([]);
const paymentHistoryList = ref<any[]>([]);
const currentDebt = ref<number>(0);
const isBillPaid = ref(false);
const route = useRoute();
const billUuid = route.params.billUuid as string;

// State untuk Dialog Detail & Pembayaran
const listTagihanRIDialog = ref(false);
const itemTagihan = ref<any>(null);
const openedData = ref<any>({});
const pembayaranDialog = ref(false);
const amount = ref<number>();
const payment_type = ref("");
const payment_method = ref("");
const note = ref("");
const information = ref("");
const kembalian = ref<number>(0);

// Computed Property untuk Validasi
const isAmountInsufficient = computed(() => {
    const requiredAmount = currentDebt.value || 0;
    const paidAmount = amount.value || 0;
    return paidAmount > 0 && paidAmount < requiredAmount;
});

// Fungsi Format Tanggal Lokal
const formatDateCustom = (epochTime: number) => {
    if (!epochTime) return "";
    const date = new Date(epochTime * 1000);
    const day = date.getDate().toString().padStart(2, "0");
    const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
};

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

const dataBreadCrumb = ref<MenuItem[]>([
    { label: "Detail Transaksi Pasien" },
    { label: "Pelunasan" }
]);

const handleBack = () => {
    router.go(-1);
};

// Fungsi untuk memproses data list layanan
const processBillData = (data: any[]) => {
    if (data) {
        itemsPasien.value = data.map((service: any) => ({
            uuid: service.uuid,
            layanan: service.serviceName,
            doctor: service.practitionerName,
        }));
    } else {
        itemsPasien.value = [];
    }
};

// Fungsi utama untuk mengambil semua data
const fetchPelunasanData = async () => {
    if (!billUuid) return;
    storeUtils.setLoading(true);
    try {
        const [historyResponse, patientBillResponse] = await Promise.all([
            closeBillStore.getPaymentHistory(billUuid),
            closeBillStore.getDetailPasienBill(billUuid),
        ]);

        if (historyResponse?.payload && patientBillResponse?.payload) {
            const billDetails = historyResponse.payload.billDetails;
            const historyList = historyResponse.payload.paymentHistory;
            const patientData = patientBillResponse.payload.patient;
            const billData = patientBillResponse.payload.bill;
            const serviceBillData = patientBillResponse.payload.bill?.serviceBill;

            kasirData.value = { ...billDetails, ...patientData, ...billData };
            paymentHistoryList.value = historyList || [];
            currentDebt.value = historyResponse.payload.debt || 0;

            processBillData(serviceBillData);
            isBillPaid.value = currentDebt.value === 0;
        }
    } catch (error) {
        console.error("Gagal mengambil data pelunasan:", error);
    } finally {
        storeUtils.setLoading(false);
    }
};

// Fungsi untuk membuka detail item tagihan
const detailTagihan = async (event: DataTableRowClickEvent) => {
    openedData.value = event.data;
    storeUtils.setLoading(true);
    try {
        const response = await tagihanStore.getItemBill(openedData.value.uuid);
        if (response && response.payload) { itemTagihan.value = response.payload; }
    } catch (error) {
        console.error("Gagal mengambil item tagihan:", error);
    } finally {
        storeUtils.setLoading(false);
    }
    listTagihanRIDialog.value = true;
};

// Fungsi untuk menghitung kembalian
const getKembalian = () => {
    const requiredAmount = Math.ceil(currentDebt.value || 0);
    const paidAmount = amount.value || 0;
    kembalian.value = paidAmount - requiredAmount;
};

//fungsi untuk cetak invoice
const handleCetakInvoice = async () => {
    storeUtils.setLoading(true);
    try {
        const billUuid = route.params.billUuid as string;
        if (!billUuid) {
            console.error("UUID tagihan tidak ditemukan.");
            storeUtils.setLoading(false);
            return;
        }
        // Ganti ke getDetailPasienBill
        const detailBillResponse: any = await closeBillStore.getDetailPasienBill(billUuid);
        let paymentResultFromStorage = null;
        const storedPayment = localStorage.getItem(`paymentResult_${billUuid}`);
        if (storedPayment) {
            paymentResultFromStorage = JSON.parse(storedPayment);
        }
        if (detailBillResponse && detailBillResponse.payload) {
            await createInvoicePdf({
                detailBill: detailBillResponse.payload, // pastikan mapping sesuai
                paymentResult: paymentResultFromStorage
            });
        } else {
            console.error("Struktur respons API getDetailPasienBill tidak sesuai, 'payload' tidak ditemukan.");
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
        const billUuid = route.params.billUuid as string;
        if (!billUuid) {
            storeUtils.setLoading(false);
            alert("Silakan pilih pasien/tagihan terlebih dahulu!");
            return;
        }

        // Ambil detail pasien bill
        const detailBillResponse: any = await closeBillStore.getDetailPasienBill(billUuid);
        const serviceBillList = detailBillResponse?.payload?.bill?.serviceBill || [];
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
            console.error("Struktur respons API getDetailPasienBill tidak sesuai, 'payload' tidak ditemukan.");
        }
    } catch (error) {
        console.error("Gagal memproses cetak rincian biaya:", error);
    } finally {
        storeUtils.setLoading(false);
    }
};

watch(amount, () => {
    setTimeout(getKembalian, 700);
});

// Fungsi untuk submit pembayaran
const submitPelunasan = async () => {
    if (!billUuid) return;
    storeUtils.setLoading(true);
    try {
        const payload = {
            amount: amount.value,
            paymentType: payment_type.value,
            paymentMethod: payment_method.value,
            note: note.value,
            information: information.value,
        };
        const paymentResponse: any = await closeBillStore.payDebtOnClosedBill(billUuid, payload);
        if (paymentResponse && paymentResponse.data && paymentResponse.data.payload) {
            // Ambil nilai kembalian dari response API
            kembalian.value = paymentResponse.data.payload.change ?? 0;
            localStorage.setItem(`paymentResult_${billUuid}`, JSON.stringify(paymentResponse.data.payload));
        }
        pembayaranDialog.value = false;
        await fetchPelunasanData();
    } catch (error) {
        console.error("Gagal melakukan pelunasan:", error);
    } finally {
        storeUtils.setLoading(false);
    }
};

//logic refresh textfiled pembayaran
const initializePelunasanDialog = () => {
    // Reset semua input
    amount.value = undefined;
    payment_method.value = "";
    note.value = "";
    information.value = "";
    kembalian.value = 0;

    // Logika untuk mengisi otomatis 'Cara Bayar'
    if (kasirData.value && kasirData.value.paymentType) {
        const defaultPaymentType = optionCaraBayar.value.find(
            option => option.label.toUpperCase() === kasirData.value.paymentType.toUpperCase()
        );
        payment_type.value = defaultPaymentType ? defaultPaymentType.value : "";
    } else {
        payment_type.value = "";
    }
};

// Watcher untuk memicu fungsi di atas saat dialog dibuka
watch(pembayaranDialog, (isOpening) => {
    if (isOpening) {
        initializePelunasanDialog();
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

const optionCaraBayar = ref([{ label: "Tunai", value: "CASH" }, { label: "Asuransi", value: "INSURANCE" }]);
const optionMetodeBayar = ref([
    { label: "Tunai", value: "CASH" },
    { label: "Transfer", value: "TRANSFER" },
    { label: "Debit/Kredit", value: "DEBIT_KREDIT" },
]);

onMounted(() => {
    fetchPelunasanData();
});
</script>

<template>
    <div class="flex flex-col h-full overflow-hidden">
        <Card pt:body:class="h-full pt-0" pt:content:class="h-full" class="h-full overflow-hidden overflow-y-auto">
            <template #header>
                <div class="flex justify-between p-4">
                    <CustomBreadCrumb :home="{ label: 'Closed Bill' }" :model="dataBreadCrumb" />
                    <div class="flex">
                        <CustomButton @click="handleBack" icon="PhCaretLeft" label="Kembali" outlined
                            borderColor="border-opensimrs-300" textColor="text-opensimrs-300" />
                    </div>
                </div>
            </template>

            <template #content>
                <div v-if="kasirData" class="grid grid-cols-2 gap-5 h-full pt-5">
                    <div class="flex flex-col gap-4">
                        <div class="h-[120px] border-2 border-opensimrs-300 rounded-lg flex flex-row flex-shrink-0">
                            <div class="basis-1/2">
                                <p class="font-bold text-MD mt-[15px] ml-[15px]">{{ kasirData.patientName }}</p>
                                <p class="ml-[15px] text-sm">{{ kasirData.invoiceCode }}</p>
                                <CustomButton class="h-5 text-xs ml-[15px]">{{ kasirData.noRm }}</CustomButton>
                                <CustomChip v-if="kasirData.gender" :showCheckedIcon="false"
                                    :label="kasirData.gender === 'P' ? 'Perempuan' : 'Laki-laki'"
                                    :bgColor="kasirData.gender === 'P' ? 'bg-female-75' : 'bg-male-75'"
                                    :textColor="kasirData.gender === 'P' ? 'text-female-300' : 'text-male-300'"
                                    customClass="h-5 pr-[6px] border-none ml-[10px]" />
                            </div>
                            <div class="bg-mediumGrey-300 w-[1px] h-[74px] mr-[20px] mt-[15px]"></div>
                            <div class="mt-[30px] mr-[40px]">
                                <p class="text-xs font-bold underline underline-offset-2">Umur</p>
                                <p class="">{{ kasirData.ageYear }}Thn {{ kasirData.ageMonth }}Bln {{ kasirData.ageDay
                                }}Hr</p>
                            </div>
                        </div>

                        <div class="flex-grow overflow-hidden">
                            <DataTable :value="itemsPasien" scrollable scrollHeight="flex"
                                class="h-full overflow-hidden rounded-[10px]" :pt="{ headerRow: 'text-SM' }"
                                @rowClick="detailTagihan">
                                <Column headerClass="bg-opensimrs-300 text-white" bodyClass="text-SM" style="width: 100%">
                                    <template #header>
                                        <div class="w-full font-bold">List Tagihan Pelayanan</div>
                                    </template>
                                    <template #body="slotProps">
                                        <div class="flex">
                                            <p class="font-bold text-normal">{{ slotProps.data.layanan }}</p>
                                            <CustomChip class="ml-2" :showCheckedIcon="false"
                                                :label="kasirData.paymentType"
                                                :bgColor="kasirData.paymentType === 'ASURANSI' ? 'bg-warning-50' : 'bg-opensimrs-50'"
                                                :textColor="kasirData.paymentType === 'ASURANSI' ? 'text-warning-300' : 'text-opensimrs-300'"
                                                :borderColor="kasirData.paymentType === 'ASURANSI' ? 'border-warning-300' : 'border-opensimrs-300'" />
                                        </div>
                                        <div class="flex">
                                            <UserDoctorIcon class="mt-2" />
                                            <p class="mt-2 text-sm text-grey-400">{{ slotProps.data.doctor }}</p>
                                        </div>
                                        <div v-if="kasirData.scheduleTime" class="flex">
                                            <p class="text-sm">Tanggal</p>
                                            <PhArrowRight :size="18" class="my-auto ml-2 text-success-300"
                                                weight="bold" />
                                            <p class="ml-2 text-sm">{{ epochToDate(kasirData.scheduleTime, "date") }}
                                            </p>
                                            <p class="ml-2 text-sm">{{ epochToDate(kasirData.scheduleTime, "time") }}
                                            </p>
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
                                <CustomButton label="Cetak Kuitansi" @click="handleCetakInvoice"
                                    class="mt-[-10px] mr-[10px]" />
                                <CustomButton label="Cetak Tagihan" @click="handleCetakRincianBiaya"
                                    class="mt-[-10px]" />
                            </div>
                        </div>
                        <hr class="mt-2 mb-2 border border-slate-300" />
                        <div class="flex justify-between mt-6">
                            <div class="text-sm">Biaya Administrasi</div>
                            <div class="text-sm">Rp {{ kasirData.adminFee?.toLocaleString('id-ID') || 0 }}</div>
                        </div>
                        <div class="flex justify-between mt-4">
                            <div class="text-sm">Biaya Tindakan</div>
                            <div class="text-sm">Rp {{ kasirData.totalTindakan?.toLocaleString('id-ID') || 0 }}</div>
                        </div>
                        <div class="flex justify-between mt-4">
                            <div class="text-sm">Biaya Obat/Alkes</div>
                            <div class="text-sm">Rp {{ kasirData.totalObatAlkes?.toLocaleString('id-ID') || 0 }}</div>
                        </div>
                        <div class="flex justify-between mt-4">
                            <div class="text-sm">Retur Obat/Alkes</div>
                            <div class="text-sm">Rp {{ kasirData.returObatAlkes?.toLocaleString('id-ID') || 0 }}</div>
                        </div>
                        <div class="flex justify-between mt-4">
                            <div class="text-sm">Biaya Kamar</div>
                            <div class="text-sm">Rp {{ kasirData.totalRuangan?.toLocaleString('id-ID') || 0 }}</div>
                        </div>
                        <div class="flex justify-between mt-6">
                            <div class="text-sm">Diskon</div>
                            <div class="text-sm">{{ kasirData.discount || "0" }} % </div>
                        </div>
                        <div class="flex justify-between mt-6">
                            <div class="text-sm">Voucher</div>
                            <div class="text-sm">Rp {{ kasirData.voucherValue || "0" }} </div>
                        </div>
                        <hr class="mt-4 border-dashed border-[1px] border-slate-300" />
                        <div class="flex justify-between mt-6">
                            <div class="text-sm font-bold">Total</div>
                            <div class="text-sm font-bold">Rp {{ kasirData.subTotal?.toLocaleString('id-ID') || 0 }}
                            </div>
                        </div>
                        <div class="flex justify-between mt-4">
                            <div class="text-sm">PPN</div>
                            <div class="text-sm">Rp {{ kasirData.ppn?.toLocaleString('id-ID') || 0 }}</div>
                        </div>
                        <hr class="mt-6 mb-2 border-slate-300 border-1" />
                        <div class="flex justify-between mt-6">
                            <div class="text-sm font-bold">Grand Total</div>
                            <div class="text-sm font-bold">{{formatPriceLokal(kasirData.grandTotal) || 0 }}
                            </div>
                        </div>
                        <template v-if="paymentHistoryList.length > 0">
                            <div>
                                <div class="flex justify-between mt-4">
                                    <div class="text-sm font-bold">Jumlah Terbayar</div>
                                    <div class="text-sm font-bold">Rp {{ kasirData.totalPaid?.toLocaleString('id-ID')
                                        || 0 }}</div>
                                </div>
                                <hr class="mt-6 mb-2 border-slate-300 border-1" />
                                <div class="flex justify-between mt-2">
                                    <div class="text-sm font-bold text-danger-300">Sisa Bayar</div>
                                    <div class="text-sm font-bold text-danger-300">-
                                        {{ formatPriceLokal(kasirData.remainingDebt) || 0 }}</div>
                                </div>
                            </div>
                        </template>
                        <div class="mt-[60px] bg-opensimrs-50">
                            <CustomButton v-if="!isBillPaid" @click="pembayaranDialog = true" label="Pelunasan"
                                class="w-full" />
                        </div>
                    </div>
                </div>
                <div v-else class="flex items-center justify-center h-full">
                    <p>Memuat data pelunasan...</p>
                </div>

                <CustomDialog v-model:visible="pembayaranDialog" width="700px">
                    <template #header>Pembayaran</template>
                    <template #body>
                        <div class="flex justify-between">
                            <div>
                                <p class="font-bold mt-[20px]">Grand Total</p>
                            </div>
                            <div>
                                <p class="font-bold mt-[20px]">{{ formatPriceLokal(currentDebt) }}</p>
                            </div>
                        </div>
                        <hr class="mt-6 border-1 border-grey-200" />
                        <div class="flex justify-between">
                            <div>
                                <p class="font-bold mt-[30px] text-sm">Jumlah Bayar</p>
                            </div>
                            <div>
                                <CustomInputNumber v-model="amount" :show-label="false" class="mt-[15px]"
                                    placeholder="0"
                                    :pt="{ root: { class: isAmountInsufficient ? 'border !border-danger-300 rounded-lg' : '' } }">
                                    <template #prependText>
                                        <div class="flex items-center justify-center px-3 font-semibold text-white border-r text-MD rounded-l-md"
                                            :class="{
                                                'bg-danger-300': isAmountInsufficient,
                                                'bg-opensimrs-300': !isAmountInsufficient
                                            }">
                                            Rp.
                                        </div>
                                    </template>
                                </CustomInputNumber>
                            </div>
                        </div>
                        <div class="flex justify-end mt-1" v-if="isAmountInsufficient">
                            <p class="text-xs text-danger-300">*Pembayaran kurang, tetap melanjutkan dengan status
                                piutang?</p>
                        </div>
                        <div class="flex justify-between">
                            <div>
                                <p class="font-bold mt-[30px] text-sm">Kembalian</p>
                            </div>
                            <div>
                                <CustomInputNumber :model-value="kembalian" :show-label="false" class="mt-[15px]"
                                    placeholder="0" :disabled="true"
                                    :pt="{ root: { class: isAmountInsufficient ? 'border !border-danger-300 rounded-lg' : '' }, input: { class: isAmountInsufficient ? '!text-danger-300' : '' } }">
                                    <template #prependText>
                                        <div class="font-semibold text-MD text-white w-[53.34px] flex items-center justify-center border-r rounded-l-md"
                                            :class="{
                                                'bg-danger-300': isAmountInsufficient,
                                                'bg-opensimrs-300': !isAmountInsufficient
                                            }">
                                            Rp.
                                        </div>
                                    </template>
                                </CustomInputNumber>
                            </div>
                        </div>
                        <hr class="mt-6 border-1 border-grey-200" />
                        <div>
                            <CustomTextfield v-model="note" class="mt-[30px]" label="Catatan"
                                placeholder="Keterangan" />
                        </div>
                        <div class="flex mt-[20px] gap-4">
                            <div>
                                <CustomSelect label="Cara Bayar" class="flex-1" optionLabel="label" optionValue="value"
                                    :disabled="true" :clearable="false" :options="optionCaraBayar"
                                    v-model="payment_type" />
                            </div>
                            <div v-if="payment_type !== 'INSURANCE'">
                                <CustomSelect label="Metode Pembayaran" class="flex-1" optionLabel="label"
                                    optionValue="value" :options="optionMetodeBayar" v-model="payment_method" />
                            </div>
                            <div>
                                <CustomTextfield v-model="information" class="flex-1" label="Keterangan"
                                    placeholder="Keterangan" />
                            </div>
                            <div class="mt-[25px] flex ">
                                <CustomButton label="Pelunasan" @click="submitPelunasan" />
                            </div>
                        </div>
                    </template>
                </CustomDialog>

                <CustomDialog v-model:visible="listTagihanRIDialog" width="1000px">
                    <template #header>Detail Tagihan Pelayanan</template>
                    <template #body>
                        <div>
                            <div class="pt-5">
                                <div class="flex">
                                    <p class="font-bold">{{ openedData.layanan }}</p>
                                    <CustomChip class="ml-2" :showCheckedIcon="false" :label="kasirData.paymentType"
                                        bgColor="bg-opensimrs-50" textColor="text-opensimrs-300"
                                        borderColor="border-opensimrs-300" />
                                    <!-- <CustomChip class="ml-2" :showCheckedIcon="false" :label="kasirData.bpjs"
                                        bgColor="bg-warning-50" textColor="text-warning-300"
                                        borderColor="border-warning-300" /> -->
                                </div>
                                <div class="flex">
                                    <UserDoctorIcon class="mt-2" />
                                    <p class="mt-2 text-sm text-grey-400">
                                        {{ openedData.doctor }}
                                    </p>
                                </div>
                                <div v-if="kasirData.scheduleTime" class="flex">
                                    <p class="text-sm">Tanggal</p>
                                    <PhArrowRight :size="18" class="my-auto ml-2 text-success-300" weight="bold" />
                                    <p class="ml-2 text-sm">{{ epochToDate(kasirData.scheduleTime, "date") }}</p>
                                    <p class="ml-2 text-sm">{{ epochToDate(kasirData.scheduleTime, "time") }} </p>
                                </div>
                            </div>

                            <!-- table kamar-->
                            <div class="pt-5 shadow-md rounded-xl" v-if="itemTagihan?.item?.ruangan?.list?.length > 0">
                                <DataTable :value="itemTagihan.item.ruangan.list"
                                    class="overflow-hidden rounded-t-[10px]" :pt="{ headerRow: 'text-SM' }">
                                    <Column header="Tanggal" headerClass="bg-opensimrs-50" style="width: 12%">
                                        <template #body="slotProps">
                                            <p class="text-SM">{{ epochToDate(slotProps.data.dateUsed, "date") }}</p>
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
                                    <Column header="Waktu" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left"
                                        style="width: 10%">
                                        <template #body="slotProps">
                                            <div class="text-SM">{{ slotProps.data.qty }} Hari</div>
                                        </template>
                                    </Column>
                                    <Column header="Tarif" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left"
                                        style="width: 15%">
                                        <template #body="slotProps">
                                            <div class="text-SM">{{ slotProps.data.price?.toLocaleString('id-ID') || 0
                                            }}</div>
                                        </template>
                                    </Column>
                                    <Column header="Total" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left"
                                        style="width: 15%">
                                        <template #body="slotProps">
                                            <div class="text-SM">{{ (slotProps.data.qty *
                                                slotProps.data.price)?.toLocaleString('id-ID') || 0 }}</div>
                                        </template>
                                    </Column>
                                </DataTable>
                                <div class="flex justify-between p-2 font-bold bg-white rounded-b-[10px]">
                                    <p class="text-base font-bold ">Total</p>
                                    <p class="text-base font-bold">
                                        Total Rp {{ itemTagihan.item.ruangan.total?.toLocaleString('id-ID') || 0 }}
                                    </p>
                                </div>
                            </div>

                            <!-- table penunjang -->
                            <div class="pt-5 shadow-md rounded-xl"
                                v-if="itemTagihan?.item?.penunjang?.list?.length > 0">
                                <DataTable :value="itemTagihan.item.penunjang.list"
                                    class="overflow-hidden rounded-t-[10px]" :pt="{ headerRow: 'text-SM' }">
                                    <Column header="Tanggal" headerClass="bg-opensimrs-50" style="width: 15%">
                                        <template #body="slotProps">
                                            <p class="text-SM">{{ epochToDate(slotProps.data.dateUsed, "date") }}</p>
                                        </template>
                                    </Column>
                                    <Column header="Penunjang" headerClass="bg-opensimrs-50" style="width: 45%">
                                        <template #body="slotProps">
                                            <p class="text-sm">{{ slotProps.data.itemName }}</p>
                                        </template>
                                    </Column>
                                    <Column header="Jumlah" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left"
                                        style="width: 10%">
                                        <template #body="slotProps">
                                            <div class="text-SM">{{ slotProps.data.qty }}</div>
                                        </template>
                                    </Column>
                                    <Column header="Tarif" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left"
                                        style="width: 15%">
                                        <template #body="slotProps">
                                            <div class="text-SM">{{ slotProps.data.price?.toLocaleString('id-ID') || 0
                                            }}</div>
                                        </template>
                                    </Column>
                                    <Column header="Total" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left"
                                        style="width: 20%">
                                        <template #body="slotProps">
                                            <div class="text-SM">{{ (slotProps.data.qty *
                                                slotProps.data.price)?.toLocaleString('id-ID') || 0 }}</div>
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
                                <DataTable :value="itemTagihan.item.tindakan.list"
                                    class="overflow-hidden rounded-t-[10px]" :pt="{ headerRow: 'text-SM' }">
                                    <Column header="Tanggal" headerClass="bg-opensimrs-50" style="width: 15%">
                                        <template #body="slotProps">
                                            <p class="text-SM">{{ epochToDate(slotProps.data.dateUsed, "date") }}</p>
                                        </template>
                                    </Column>
                                    <Column header="Tindakan, Pemeriksaan, dan Administrasi" headerClass="bg-opensimrs-50"
                                        style="width: 45%">
                                        <template #body="slotProps">
                                            <p class="text-sm">{{ slotProps.data.itemName }}</p>
                                        </template>
                                    </Column>
                                    <Column header="Jumlah" headerClass="bg-opensimrs-50 text-left" bodyClass="text-left"
                                        style="width: 15%">
                                        <template #body="slotProps">
                                            <div class="text-SM">{{ slotProps.data.qty }}</div>
                                        </template>
                                    </Column>
                                    <Column header="Tarif" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left"
                                        style="width: 15%">
                                        <template #body="slotProps">
                                            <div class="text-SM">{{ slotProps.data.price?.toLocaleString('id-ID') || 0
                                            }}</div>
                                        </template>
                                    </Column>
                                    <Column header="Total" headerClass="bg-opensimrs-50 text-left" bodyClass="text-left"
                                        style="width: 15%">
                                        <template #body="slotProps">
                                            <div class="text-SM">{{ (slotProps.data.qty *
                                                slotProps.data.price)?.toLocaleString('id-ID') || 0 }}</div>
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
                                            <p class="text-SM">{{ epochToDate(slotProps.data.dateUsed, "date") }}</p>
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
                                    <Column header="Jumlah" headerClass="bg-opensimrs-50 text-left" bodyClass="text-left"
                                        style="width: 15%">
                                        <template #body="slotProps">
                                            <div class="text-SM">{{ slotProps.data.qty }}</div>
                                        </template>
                                    </Column>
                                    <Column header="Tarif" headerClass="bg-opensimrs-50 text-left" bodyClass="text-left"
                                        style="width: 10%">
                                        <template #body="slotProps">
                                            <div class="text-SM">{{ slotProps.data.price?.toLocaleString('id-ID') || 0
                                            }}</div>
                                        </template>
                                    </Column>
                                    <Column header="Jasa" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left"
                                        style="width: 10%">
                                        <template #body="slotProps">
                                            <div class="text-SM">{{ slotProps.data.serviceFee?.toLocaleString('id-ID')
                                                || 0 }}</div>
                                        </template>
                                    </Column>
                                    <Column header="Total" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left"
                                        style="width: 15%">
                                        <template #body="slotProps">
                                            <div class="text-SM">
                                                {{ (slotProps.data.qty * slotProps.data.price +
                                                    (slotProps.data.serviceFee ?? 0))?.toLocaleString('id-ID') || 0 }}
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
                                            <p class="text-SM">{{ epochToDate(slotProps.data.dateUsed, "date") }}</p>
                                        </template>
                                    </Column>
                                    <Column header="Alkes" headerClass="bg-opensimrs-50" style="width: 45%">
                                        <template #body="slotProps">
                                            <p class="text-sm">{{ slotProps.data.itemName }}</p>
                                        </template>
                                    </Column>
                                    <Column header="Jumlah" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left"
                                        style="width: 15%">
                                        <template #body="slotProps">
                                            <div class="text-SM">{{ slotProps.data.qty }}</div>
                                        </template>
                                    </Column>
                                    <Column header="Tarif" headerClass="bg-opensimrs-50 text-right" bodyClass="text-left"
                                        style="width: 15%">
                                        <template #body="slotProps">
                                            <div class="text-SM">{{ slotProps.data.price?.toLocaleString('id-ID') || 0
                                            }}</div>
                                        </template>
                                    </Column>
                                    <Column header="Total" headerClass="bg-opensimrs-50 text-left" bodyClass="text-left"
                                        style="width: 15%">
                                        <template #body="slotProps">
                                            <div class="text-SM">{{ (slotProps.data.qty *
                                                slotProps.data.price)?.toLocaleString('id-ID') || 0 }}</div>
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
            </template>
        </Card>
    </div>
</template>