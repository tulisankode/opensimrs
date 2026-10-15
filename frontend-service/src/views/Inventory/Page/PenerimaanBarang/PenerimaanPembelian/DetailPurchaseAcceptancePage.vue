<script lang="ts" setup>
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import Card from "primevue/card";
import { onMounted, ref, watchEffect, computed } from "vue";
import { useForm, useFieldArray } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import { usePurchaseAcceptanceStore } from "@/stores/inventory/purchaseAcceptance";
import { usePriceConfigurationStore } from "@/stores/datamasterFarmasi/PriceConfiguration";
import { utilsStore } from "@/stores/utils";
import * as yup from "yup";
import { formatPrice, epochToDate, dateToEpoch } from "@/utils/Helpers";

const props = defineProps({
    selectedDataUuid: { type: String, required: true },
    selectedData: {
        type: Object,
        default: () => ({}),
    },
});
const emit = defineEmits(["kembali", "diterima"]);

//state management
const PurchaseAcceptanceStore = usePurchaseAcceptanceStore();
const PriceConfigurationStore = usePriceConfigurationStore();
const UseUtilsStore = utilsStore();
const DetailPayload = ref<any>({});
const today = new Date();

// Validasi schema dengan Yup
const schema = toTypedSchema(
    yup.object({
        tanggalPenerimaan: yup.date().required("Tgl. Penerimaan harus diisi"),
        noFaktur: yup.string().required("No. Faktur harus diisi"),
        tanggalFaktur: yup.date().required("Tgl. Faktur harus diisi"),
        noSuratJalan: yup.string().required("No. Surat Jalan harus diisi"),
        catatan: yup.string().nullable(),
        namaSupplierPengirim: yup.string().required("Nama Supplier Pengirim harus diisi"),
        items: yup.array().of(
            yup.object({
                qtyTerima: yup.number().min(0).required("Jumlah terima harus diisi"),
                expDate: yup.date().nullable().required("Exp. Date harus diisi"),
            })
        ),
    })
);

// Vee-validate form setup
const { handleSubmit, defineField, setValues, errors } = useForm({
    validationSchema: schema,
});

// Form fields
const [tanggalPenerimaan] = defineField("tanggalPenerimaan");
const [noFaktur] = defineField("noFaktur");
const [tanggalFaktur] = defineField("tanggalFaktur");
const [noSuratJalan] = defineField("noSuratJalan");
const [catatan] = defineField("catatan");
const [namaSupplierPengirim] = defineField("namaSupplierPengirim");
const { fields: itemFields } = useFieldArray<any>("items");

// State untuk kalkulasi
const diskon = ref(0);
const materai = ref(0);
const ppn = ref(0);
const ppnPercentage = ref(0);
const grandTotal = ref(0);

// 1. Tambahkan Fungsi Fetch Config PPN
const fetchPpnConfig = async () => {
    try {
        const response = await PriceConfigurationStore.getApiKonfig();
        if (response && response.payload) {
            ppnPercentage.value = response.payload.ppn || 0;
        }
    } catch (error) {
        console.error("Gagal mengambil konfigurasi PPN", error);
        // ppnPercentage.value = 11; // Fallback optional
    }
};

// Fetch detail data dari API
const fetchDetail = async () => {
    UseUtilsStore.setLoading(true);
    try {
        const response = await PurchaseAcceptanceStore.getApiDetail(props.selectedDataUuid);
        DetailPayload.value = response?.payload || {};
        // Mengisi form dengan data dari fetch
        setValues({
            tanggalPenerimaan: new Date(),
            noFaktur: DetailPayload.value.noFaktur || '',
            tanggalFaktur: DetailPayload.value.tanggalFaktur ? new Date(DetailPayload.value.tanggalFaktur * 1000) : undefined,
            noSuratJalan: DetailPayload.value.noSuratJalan || '',
            catatan: DetailPayload.value.catatanPenerimaan || '',
            items: (DetailPayload.value.items || []).map((item: any) => ({
                ...item,
                qtyTerima: item.qtyOrder,
                expDate: null,
            })),
        });
        // Mengisi state kalkulasi
        diskon.value = DetailPayload.value.diskon || 0;
        materai.value = DetailPayload.value.materai || 0;
        const isPpnActive = DetailPayload.value.ppn === true || DetailPayload.value.ppn > 0;
        ppn.value = isPpnActive ? ppnPercentage.value : 0;
    } finally {
        UseUtilsStore.setLoading(false);
    }
};

// Kalkukasi ppn
const ppnAmount = computed(() => {
    const subTotal = (itemFields.value || []).reduce((total, item) => {
        const qty = item.value.qtyTerima || 0;
        const harga = item.value.hargaSatuan || 0;
        return total + (qty * harga);
    }, 0);
    const totalSetelahDiskon = subTotal - diskon.value;
    const nilaiPpn = totalSetelahDiskon * (ppnPercentage.value / 100);
    return Math.max(0, nilaiPpn);
});

// kalkulasi grandtotal
watchEffect(() => {
    const subTotal = (itemFields.value || []).reduce((total, item) => {
        const qty = item.value.qtyTerima || 0;
        const harga = item.value.hargaSatuan || 0;
        return total + (qty * harga);
    }, 0);

    const totalSetelahDiskon = subTotal - diskon.value;

    // Cek apakah switch aktif (nilainya > 0)
    const ppnYangDitambahkan = ppn.value > 0 ? ppnAmount.value : 0;

    const finalTotal = totalSetelahDiskon + materai.value + ppnYangDitambahkan;

    grandTotal.value = Math.max(0, finalTotal);
});

const handleTerima = handleSubmit(async (values) => {
    // Validasi: Pastikan setidaknya satu item dipilih
    if (!itemFields.value || itemFields.value.length === 0) {
        alert("Tidak ada item untuk diterima.");
        return;
    }

    UseUtilsStore.setLoading(true);
    try {
        const payload = {
            tanggal_terima: dateToEpoch(values.tanggalPenerimaan as Date),
            no_faktur: values.noFaktur,
            tanggal_faktur: dateToEpoch(values.tanggalFaktur as Date),
            no_surat_jalan: values.noSuratJalan,
            petugas_pengirim: values.namaSupplierPengirim,
            catatan_penerimaan: values.catatan,
            diskon: diskon.value,
            materai: materai.value,
            ppn: ppn.value > 0,
            items: itemFields.value.map((item: any) => ({
                uuid: item.value.uuid,
                qty_terima: item.value.qtyTerima,
                exp_date: dateToEpoch(item.value.expDate as Date) * 1000,
            })),
        };

        console.log("Payload untuk API Terima Pembelian:", payload);

        await PurchaseAcceptanceStore.putApi(props.selectedDataUuid, payload);
        emit("diterima");
    } catch (error) {
        console.error("Gagal menyimpan data penerimaan:", error);
    } finally {
        UseUtilsStore.setLoading(false);
    }
});

// Menangani nama penerima 
const petugasPenerima = computed(() => {
    const userString = localStorage.getItem('user');
    if (userString) {
        try {
            const userObject = JSON.parse(userString);
            return userObject.name || 'Nama Petugas';
        } catch (e) {
            console.error("Gagal parse data user dari localStorage:", e);
            return 'Nama Petugas';
        }
    }
    return 'Nama Petugas';
});

// Handle reset button
const handleReset = () => {
    fetchDetail();
};

onMounted(async () => {
    await fetchPpnConfig();
    fetchDetail();
});

</script>

<template>
    <div class="flex flex-col h-full overflow-hidden">
        <Card pt:body:class="h-full pt-0" class="h-full overflow-hidden overflow-y-auto">
            <template #header>
                <CustomAccordion :openWithHeader="false" noBorder initialState="0">
                    <template #header>
                        <div class="flex items-center justify-between w-full align-middle">
                            <div class="flex items-center">
                                <CustomButton icon="PhArrowClockwise" class="mr-5" @click="fetchDetail" />
                                <CustomBreadCrumb :home="{ label: 'Penerimaan Barang' }"
                                    :model="[{ label: 'Penerimaan Pembelian' }]" />
                                <PhCaretRight :size="25" weight="bold" class="mx-2 text-opensimrs-300" />
                                <CustomChip :label="DetailPayload?.noPembelian" bgColor="bg-opensimrs-300"
                                    :showCheckedIcon="false" textColor="text-white" />
                                <CustomChip label="BELUM DITERIMA" bgColor="bg-grey-300" textColor="text-white"
                                    :showCheckedIcon="false" class="ml-2" />
                            </div>
                            <div class="flex">
                                <CustomButton @click="emit('kembali')" icon="PhCaretLeft" label="Kembali"
                                    class="mr-[10px]" outlined borderColor="border-opensimrs-300"
                                    textColor="text-opensimrs-300" />
                            </div>
                        </div>
                    </template>
                    <template #content>
                        <div class="p-4 space-y-4">
                            <div class="flex gap-5 text-sm">
                                <div class="flex flex-col flex-1 gap-4">
                                    <div>
                                        <p class="font-bold underline">No. Pembelian</p>
                                        <p>{{ DetailPayload.noPembelian || '-' }}</p>
                                    </div>
                                    <div>
                                        <p class="font-bold underline">Supplier</p>
                                        <p>{{ DetailPayload.supplier || '-' }}</p>
                                    </div>
                                </div>
                                <div class="flex flex-col flex-1 gap-4">
                                    <div>
                                        <p class="font-bold underline">Tgl. Pembelian</p>
                                        <p>{{ DetailPayload.tanggalPembelian ?
                                            epochToDate(DetailPayload.tanggalPembelian, "date") : '-' }}</p>
                                    </div>
                                    <div>
                                        <p class="font-bold underline">Petugas Pembelian</p>
                                        <p>{{ DetailPayload.petugasPembuatPo || '-' }}</p>
                                    </div>
                                </div>
                                <hr class="h-auto border-[0.5px] w-px border-opensimrs-300" />
                                <div class="flex flex-col flex-1 gap-4">
                                    <div>
                                        <p class="font-bold underline">Tgl. Verifikasi Pembelian</p>
                                        <p>{{ DetailPayload.tanggalVerifikasi ?
                                            epochToDate(DetailPayload.tanggalVerifikasi, "date") : '01-01-2025' }}</p>
                                    </div>
                                    <div>
                                        <p class="font-bold underline">Petugas Verifikasi Pembelian</p>
                                        <p>{{ DetailPayload.petugasVerifikasi || 'Nama Petugas' }}</p>
                                    </div>
                                </div>
                                <hr class="h-auto border-[0.5px] w-px border-opensimrs-300" />
                                <div class="grid grid-cols-2 flex-1 gap-4">
                                    <div>
                                        <p class="font-bold underline">Kategori</p>
                                        <p class="capitalize">{{ DetailPayload.kategoriItem || '-' }}</p>
                                    </div>
                                    <div>
                                        <p class="font-bold underline">Jenis Stok</p>
                                        <p>{{ DetailPayload.jenisStok || '-' }}</p>
                                    </div>
                                    <div>
                                        <p class="font-bold underline">Jenis Item</p>
                                        <p class="capitalize">{{ DetailPayload.jenisItem || '-' }}</p>
                                    </div>
                                    <div>
                                        <p class="font-bold underline">Cara Bayar</p>
                                        <p class="capitalize">{{ DetailPayload.paymentMethod || '-' }}</p>
                                    </div>
                                </div>
                            </div>
                            <hr class="border-grey-200" />
                            <div class="flex gap-5">
                                <CustomDatePicker label="Tgl. Penerimaan" v-model="tanggalPenerimaan"
                                    :invalid="!!errors.tanggalPenerimaan" :invalid-message="errors.tanggalPenerimaan"
                                    :maxDate="today" />
                                <CustomTextfield label="No. Faktur" v-model="noFaktur" :invalid="!!errors.noFaktur"
                                    :invalid-message="errors.noFaktur" />
                                <CustomDatePicker label="Tgl. Faktur" v-model="tanggalFaktur"
                                    :invalid="!!errors.tanggalFaktur" :invalid-message="errors.tanggalFaktur"
                                    :maxDate="today" />
                                <CustomTextfield label="No. Surat Jalan" v-model="noSuratJalan"
                                    :invalid="!!errors.noSuratJalan" :invalid-message="errors.noSuratJalan" />
                                <CustomTextfield label="Catatan" class="grow" v-model="catatan" />
                            </div>
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

            <template #content>
                <hr class="border-grey-200 mb-4" />
                <DataTable :value="itemFields" dataKey="key" class="text-xs" scrollable scrollHeight="flex">
                    <Column header="No." headerClass="bg-opensimrs-50 font-semibold" bodyClass="pt-4">
                        <template #body="slotProps">{{ slotProps.index + 1 }}</template>
                    </Column>

                    <Column header="Nama Item" headerClass="bg-opensimrs-50 font-semibold" bodyClass="pt-4">
                        <template #body="slotProps">
                            <div>
                                <div>{{ slotProps.data.value.nama }}</div>
                                <CustomChip :showCheckedIcon="false" :label="DetailPayload.supplier"
                                    bgColor="bg-opensimrs-300" textColor="text-white" customClass="h-5" />
                            </div>
                        </template>
                    </Column>

                    <Column header="Order" headerClass="bg-opensimrs-50 font-semibold text-center" bodyClass="pt-4">
                        <template #body="slotProps">{{ slotProps.data.value.qtyOrder }}</template>
                    </Column>

                    <Column header="Terima" headerClass="bg-opensimrs-50 font-semibold text-center" bodyClass="pt-4">
                        <template #body="slotProps">{{ slotProps.data.value.qtyTerima }}</template>
                    </Column>

                    <Column header="Satuan/Isi" headerClass="bg-opensimrs-50 font-semibold text-center" bodyClass=" pt-4">
                        <template #body="slotProps">{{ slotProps.data.value.satuanBeliString }}</template>
                    </Column>

                    <Column header="Exp. Date" headerClass="bg-opensimrs-50 font-semibold text-center" class="w-[180px]">
                        <template #body="slotProps">
                            <CustomDatePicker label="" v-model="slotProps.data.value.expDate"
                                :invalid="!!errors[`items[${slotProps.index}].expDate`]"
                                :invalid-message="errors[`items[${slotProps.index}].expDate`]" />
                        </template>
                    </Column>

                    <Column header="Harga Satuan" headerClass="bg-opensimrs-50 font-semibold text-center"
                        bodyClass=" pt-4">
                        <template #body="slotProps">{{ formatPrice(slotProps.data.value.hargaSatuan) }}</template>
                    </Column>

                    <Column header="Total" headerClass="bg-opensimrs-50 font-semibold text-center" bodyClass=" pt-4">
                        <template #body="slotProps">
                            {{ formatPrice(slotProps.data.value.qtyTerima * slotProps.data.value.hargaSatuan) }}
                        </template>
                    </Column>


                </DataTable>
            </template>

            <template #footer>
                <div class="p-4">
                    <hr class="mb-4 border-grey-200" />
                    <div class="flex justify-between">
                        <div class="flex gap-6">
                            <CustomInputNumber v-model="diskon" label="Diskon" mode="currency" currency="IDR"
                                locale="id-ID" />
                            <CustomInputNumber v-model="materai" label="Materai" mode="currency" currency="IDR"
                                locale="id-ID" />

                            <div>
                                <label class="block font-semibold mb-[11px] text-normal">PPN {{ ppnPercentage
                                    }}%</label>
                                <div class="flex items-center">
                                    <CustomSwitch v-model="ppn" :show-label="false" :binary="true"
                                        :trueValue="ppnPercentage" :falseValue="0" sideLabel="" sideLabelTrue="" />
                                    <p class="ml-3 text-sm text-gray-500">{{ formatPrice(ppnAmount) }}</p>
                                </div>
                            </div>

                        </div>
                        <div class="flex items-center gap-5">
                            <hr class="h-3/4 border-x-[1px] border-opensimrs-300" />
                            <div>
                                <div class="font-semibold underline">Grand Total</div>
                                <div class="font-bold text-lg">{{ formatPrice(grandTotal) }}</div>
                            </div>
                        </div>
                    </div>
                    <hr class="mt-4 border-grey-200" />
                    <div class="flex items-center justify-between pt-5">
                        <div class="flex items-center gap-6">
                            <div>
                                <p class="font-semibold underline">Total Item</p>
                                <p>{{ DetailPayload.totalItem || 0 }}</p>
                            </div>

                            <CustomTextfield label="Nama Supplier Pengirim" class="w-[300px]"
                                placeholder="Nama Petugas Pengirim" v-model="namaSupplierPengirim"
                                :invalid="!!errors.namaSupplierPengirim"
                                :invalidMessage="errors.namaSupplierPengirim" />
                        </div>
                        <div class="flex items-center gap-3">
                            <div>
                                <p class="font-semibold text-end underline">Penerimaan Dilakukan Oleh</p>
                                <p class="font-normal">{{ petugasPenerima }}- {{ epochToDate(Date.now() / 1000,
                                    'dateTime') }}
                                </p>
                            </div>
                            <CustomButton label="Reset" @click="handleReset" outlined borderColor="border-grey-300"
                                textColor="text-grey-400" />
                            <CustomButton label="Terima Pembelian" class="bg-opensimrs-300" @click="handleTerima" />
                        </div>
                    </div>
                </div>
            </template>
        </Card>
    </div>
</template>
