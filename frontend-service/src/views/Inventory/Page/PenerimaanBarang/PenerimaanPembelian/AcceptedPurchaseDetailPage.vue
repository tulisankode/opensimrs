<script lang="ts" setup>
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import Card from "primevue/card";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import { onMounted, ref, computed } from "vue";
import { usePurchaseAcceptanceStore } from "@/stores/inventory/purchaseAcceptance";
import { utilsStore } from "@/stores/utils";
import { formatPrice, epochToDate, formatStringDate } from "@/utils/Helpers";
import { generateFakturPdf } from "@/utils/pdf/pdfInventory/cetakFakturPenerimaan";

const props = defineProps({
    selectedDataUuid: { type: String, required: true },
});
const emit = defineEmits(["kembali"]);

//state management
const PurchaseAcceptanceStore = usePurchaseAcceptanceStore();
const UseUtilsStore = utilsStore();
const DetailPayload = ref<any>({});

// Fetch detail data dari API
const fetchDetail = async () => {
    UseUtilsStore.setLoading(true);
    try {
        const response = await PurchaseAcceptanceStore.getApiDetail(props.selectedDataUuid);
        DetailPayload.value = response?.payload || {};
    } finally {
        UseUtilsStore.setLoading(false);
    }
};

// Kalkulasi PPN
const ppnNominal = computed(() => {
    if (!DetailPayload.value || !DetailPayload.value.items || !DetailPayload.value.ppn) {
        return 0;
    }
    const subTotal = DetailPayload.value.items.reduce((total: any, item: { totalHarga: any; }) => {
        return total + (item.totalHarga || 0);
    }, 0);
    const totalSetelahDiskon = subTotal - (DetailPayload.value.diskon || 0);
    const nilaiPpn = totalSetelahDiskon * (DetailPayload.value.ppn / 100);
    return Math.max(0, nilaiPpn);
});

// handle cetak faktur
const handleCetakFaktur = async () => {
    if (!DetailPayload.value.uuid) {
        console.error("Data detail belum dimuat.");
        return;
    }

    // 1. Ambil data faskes_profile dari localStorage
    const faskesProfileString = localStorage.getItem("faskes_profile");
    if (!faskesProfileString) {
        console.error("Data profil faskes tidak ditemukan di localStorage.");
        return;
    }

    let clinicProfile: any;
    try {
        // 2. Parse data JSON
        clinicProfile = JSON.parse(faskesProfileString);
    } catch (e) {
        console.error("Gagal parse data profil faskes:", e);
        return;
    }

    UseUtilsStore.setLoading(true);
    try {
        // 3. Kirim data ke fungsi PDF
        const base64Pdf = await generateFakturPdf(DetailPayload.value, clinicProfile);

        // Buka PDF di tab baru
        const pdfWindow = window.open("");
        if (pdfWindow) {
            pdfWindow.document.write(
                `<iframe width='100%' height='100%' src='data:application/pdf;base64,${base64Pdf}'></iframe>`
            );
            pdfWindow.document.title = `Faktur - ${DetailPayload.value.noFaktur || DetailPayload.value.noPembelian}`;
        } else {
            console.error("Gagal membuka tab baru. Pop-up mungkin diblokir.");
        }

    } catch (error) {
        console.error("Gagal membuat PDF:", error);
    } finally {
        UseUtilsStore.setLoading(false);
    }
};


onMounted(fetchDetail);
</script>

<template>
    <div class="flex flex-col h-full overflow-hidden">
        <Card pt:body:class="h-full pt-0" class="h-full overflow-hidden overflow-y-auto">
            <template #header>
                <CustomAccordion :openWithHeader="false" noBorder initialState="0">
                    <template #header>
                        <div class="flex items-center justify-between w-full p-2 ">
                            <div class="flex items-center">
                                <CustomButton icon="PhArrowClockwise" class="mr-5" @click="fetchDetail" />
                                <CustomBreadCrumb :home="{ label: 'Penerimaan Barang' }"
                                    :model="[{ label: 'Penerimaan Pembelian' }]" />
                                <PhCaretRight :size="25" weight="bold" class="mx-2 text-opensimrs-300" />
                                <CustomChip :label="DetailPayload?.noPembelian" bgColor="bg-opensimrs-300"
                                    :showCheckedIcon="false" textColor="text-white" />
                                <CustomChip label="DITERIMA" bgColor="bg-success-300" textColor="text-white"
                                    :showCheckedIcon="false" class="ml-2" />
                            </div>
                            <div class="flex gap-2">
                                <CustomButton @click="emit('kembali')" icon="PhCaretLeft" label="Kembali" outlined
                                    borderColor="border-opensimrs-300" textColor="text-opensimrs-300" />
                                <CustomButton label="Cetak Faktur" icon="PhPrinter" class="bg-opensimrs-300"
                                    @click="handleCetakFaktur" />
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

                            <div class="grid grid-cols-5 gap-y-4 gap-x-8 text-sm">
                                <div>
                                    <p class="font-bold underline">Tgl. Penerimaan</p>
                                    <p>{{ DetailPayload.tanggalPenerimaan ? epochToDate(DetailPayload.tanggalPenerimaan,
                                        "date") : '-' }}</p>
                                </div>
                                <div>
                                    <p class="font-bold underline">No. Faktur</p>
                                    <p>{{ DetailPayload.noFaktur || '-' }}</p>
                                </div>
                                <div>
                                    <p class="font-bold underline">Tgl. Faktur</p>
                                    <p>{{ DetailPayload.tanggalFaktur ? epochToDate(DetailPayload.tanggalFaktur, "date")
                                        : '-'
                                    }}</p>
                                </div>
                                <div>
                                    <p class="font-bold underline">No. Surat Jalan</p>
                                    <p>{{ DetailPayload.noSuratJalan || '-' }}</p>
                                </div>
                                <div>
                                    <p class="font-bold underline">Catatan</p>
                                    <p>{{ DetailPayload.catatanPenerimaan || '-' }}</p>
                                </div>
                            </div>

                            <hr class="border-grey-200" />

                            <div class="h-[200px] overflow-y-auto">
                                <DataTable :value="DetailPayload.items" class="text-xs" scrollable scrollHeight="flex">
                                    <Column header="No." headerClass="bg-opensimrs-50"><template #body="slotProps">{{
                                        slotProps.index + 1 }}</template>
                                    </Column>
                                    <Column field="nama" header="Nama Item" headerClass="bg-opensimrs-50"></Column>
                                    <Column field="qtyOrder" header="Order" headerClass="bg-opensimrs-50"></Column>
                                    <Column field="qtyTerima" header="Terima" headerClass="bg-opensimrs-50"></Column>
                                    <Column field="satuanBeliString" header="Satuan/Isi" headerClass="bg-opensimrs-50">
                                    </Column>
                                    <Column header="Exp. Date" headerClass="bg-opensimrs-50">
                                        <template #body="slotProps">{{ formatStringDate(slotProps.data.expDate, "date")
                                        }} </template>
                                    </Column>
                                    <Column header="Harga Satuan" headerClass="bg-opensimrs-50 text-end">
                                        <template #body="slotProps">{{ formatPrice(slotProps.data.hargaSatuan)
                                        }}</template>
                                    </Column>
                                    <Column header="Total" headerClass="bg-opensimrs-50 text-end">
                                        <template #body="slotProps">{{ formatPrice(slotProps.data.totalHarga)
                                        }}</template>
                                    </Column>
                                </DataTable>
                            </div>
                        </div>
                    </template>

                    <template #footer>
                        <div class="flex flex-col gap-4 p-2">
                            <!-- <hr class="border-grey-200" /> -->
                            <div class="flex justify-between">
                                <div class="flex gap-16 text-sm">
                                    <div class="mr-12">
                                        <p class="font-semibold underline">Diskon</p>
                                        <p>{{ formatPrice(DetailPayload.diskon) }}</p>
                                    </div>
                                    <div class="ml-12 mr-12">
                                        <p class="font-semibold underline">Materai</p>
                                        <p>{{ formatPrice(DetailPayload.materai) }}</p>
                                    </div>
                                    <div class="ml-12">
                                        <p class="font-semibold underline">PPN</p>
                                        <p>{{ formatPrice(ppnNominal) }}</p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-5 mr-16">
                                    <hr class="h-3/4 border-x-[1px] border-opensimrs-300" />
                                    <div>
                                        <p class="font-semibold underline">Grand Total</p>
                                        <p class="font-bold text-lg">{{ formatPrice(DetailPayload.grandTotal) }}</p>
                                    </div>
                                </div>
                            </div>
                            <hr class="border-grey-200" />
                            <div class="flex justify-between text-sm">
                                <div class="flex gap-16">
                                    <div>
                                        <p class="font-semibold underline">Total Item</p>
                                        <p>{{ DetailPayload.totalItem || 0 }}</p>
                                    </div>
                                    <div>
                                        <p class="font-semibold underline">Petugas Penerima</p>
                                        <p>{{ DetailPayload.petugasPenerima || 'Nama Petugas' }}</p>
                                    </div>
                                    <div>
                                        <p class="font-semibold underline">Nama Petugas Pengirim</p>
                                        <p>{{ DetailPayload.petugasPengirim || 'Nama Petugas' }}</p>
                                    </div>
                                </div>
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
        </Card>
    </div>
</template>