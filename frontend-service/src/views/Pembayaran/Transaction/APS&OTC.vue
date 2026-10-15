<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import { onBeforeRouteLeave, useRoute } from "vue-router";
import { utilsStore } from "@/stores/utils";
import { dateToEpoch } from "@/utils/Helpers";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import Paginator from 'primevue/paginator';
import TransactionApsOtc from "@/views/Pembayaran/layout/TransactionApsOtc.vue";
import type { DataTableRowClickEvent } from "primevue/datatable";
import type { MenuItem } from "primevue/menuitem";
import NoData from "@/components/section/NoData.vue";
import { useApsOtcTransaction as useApsOtcStore } from "@/stores/pembayaran/apsotc";


const today = new Date();
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(today.getDate() - 7);

const startDateFilter = ref<Date>(sevenDaysAgo);
const endDateFilter = ref<Date>(today);
const pageType = ref("");
const searchQuery = ref<string>("");
const selectedBillUuid = ref<string>();

const filterPoliList = ref([
    "APS",
    "OTC"
]);

const apsotcStore = useApsOtcStore();
const UseUtilsStore = utilsStore();
const apsotcPayload = ref<any[]>([]);
const apsotcProperties = ref({
    page: 1,
    page_size: 10,
    total: 0,
});

// State untuk Pencarian Dropdown
const searchResults = ref<any[]>([]);
const loadingSearch = ref(false);
const selectedPatientUuid = ref<string | null>(null);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

const hasData = computed(
    () => apsotcPayload.value && apsotcPayload.value.length > 0
);

watch(startDateFilter, (newDate) => {
    if (newDate) newDate.setHours(0, 0, 0, 0);
}, { immediate: true });

watch(endDateFilter, (newDate) => {
    if (newDate) newDate.setHours(23, 59, 59, 999);
}, { immediate: true });

const poliMapping: { [key: string]: string } = {
    "RAWAT JALAN": "RJ",
    "RAWAT INAP": "RI",
    "IGD": "IGD",
    "APS": "APS",
    "OTC": "OTC"
};

// Mapping untuk menampilkan nama layanan dari kode 
const reversePoliMapping: { [key: string]: string } = {
    "RJ": "RAWAT JALAN",
    "RI": "RAWAT INAP",
    "IGD": "IGD",
    "APS": "APS",
    "OTC": "OTC"
};

//  Fungsi untuk memecah string "IGD, RI, RJ" menjadi Array Object
const getServiceList = (rawServices: string) => {
    if (!rawServices) return [];
    return rawServices.split(',').map(item => {
        const code = item.trim(); // Hapus spasi (misal " RJ" jadi "RJ")
        return {
            code: code,
            label: reversePoliMapping[code] || code // Gunakan mapping, kalau tidak ada pakai code aslinya
        };
    });
};


const fetchApsotc = async () => {
    UseUtilsStore.setLoading(true);
    try {
        let statusForApi = '';
        if (selectedPayType.value === 'MenungguPembayaran') {
            statusForApi = 'PIUTANG';
        } else if (selectedPayType.value === 'Lunas') {
            statusForApi = 'LUNAS';
        }
        // Jika selectedPayType.value adalah 'Semua', statusForApi akan tetap string kosong ''
        const poliForApi = selectedFilterPoli.value.map(poli => poliMapping[poli] || poli);
        const paymentForApi = selectedPaymentMethod.value;

        const response = await apsotcStore.getApi(
            apsotcProperties.value.page,
            apsotcProperties.value.page_size,
            dateToEpoch(startDateFilter.value),
            dateToEpoch(endDateFilter.value),
            selectedPatientUuid.value || searchQuery.value,
            statusForApi,
            poliForApi,
            paymentForApi
        );

        const plainResponse = JSON.parse(JSON.stringify(response));
        if (plainResponse && plainResponse.payload && plainResponse.properties) {
            apsotcPayload.value = plainResponse.payload.map((item: any) => ({
                uuid: item.uuid,
                billCode: item.billCode,
                noRm: item.noRm,
                invoiceCode: item.invoiceCode,
                patientName: item.patientName,
                noReg: item.noReg,
                ageYear: item.ageYear,
                ageMonth: item.ageMonth,
                ageDay: item.ageDay,
                fullAddress: item.fullAddress,
                jenisKelamin: item.jenisKelamin,
                noHandphone: item.noHandphone,
                practitionerName: item.practitionerName,
                scheduleTime: item.scheduleTime,
                polyclinicName: item.polyclinicName,
                mainServiceCategory: item.serviceTypes, // e.g., "RJ", "RI"
                paymentType: item.paymentType,
                serviceTypeList: item.serviceTypeList // e.g., "Data Lengkap"
            }));

            const apiProperties = plainResponse.properties;
            apsotcProperties.value.page = apiProperties.page;
            apsotcProperties.value.page_size = apiProperties.pageSize;
            apsotcProperties.value.total = parseInt(apiProperties.totalData, 10) || 0;
        } else {
            apsotcPayload.value = [];
            apsotcProperties.value.total = 0;
        }
    } catch (error) {
        console.error("Failed to fetch data", error);
        apsotcPayload.value = [];
        apsotcProperties.value.total = 0;
    } finally {
        UseUtilsStore.setLoading(false);
    }
};

const findTransactionsForDropdown = async (filter: string) => {
    const filterText = filter || "";
    searchQuery.value = filterText;
    if (searchTimer) {
        clearTimeout(searchTimer);
    }

    if (!filterText) {
        searchResults.value = [];
        return;
    }

    searchTimer = setTimeout(async () => {
        loadingSearch.value = true;
        try {
            // Mengambil filter aktif saat ini
            let statusForApi = '';
            if (selectedPayType.value === 'MenungguPembayaran') {
                statusForApi = 'PIUTANG';
            } else if (selectedPayType.value === 'Lunas') {
                statusForApi = 'LUNAS';
            }
            const poliForApi = selectedFilterPoli.value.map(poli => poliMapping[poli] || poli);
            const paymentForApi = selectedPaymentMethod.value;

            // Memanggil API dengan limit kecil untuk dropdown
            const response = await apsotcStore.getApi(
                1,
                20,
                dateToEpoch(startDateFilter.value),
                dateToEpoch(endDateFilter.value),
                filterText,
                statusForApi,
                poliForApi,
                paymentForApi
            );

            const plainResponse = JSON.parse(JSON.stringify(response));
            if (plainResponse && Array.isArray(plainResponse.payload)) {
                searchResults.value = plainResponse.payload;
            } else {
                searchResults.value = [];
            }
        } catch (error) {
            console.error("Gagal mencari data dropdown:", error);
            searchResults.value = [];
        } finally {
            loadingSearch.value = false;
        }
    }, 500); // Jeda 500ms
};

const applyFilter = () => {
    apsotcProperties.value.page = 1;
    fetchApsotc();
};

const resetFilter = () => {
    const todayReset = new Date();
    const sevenDaysAgoReset = new Date();
    sevenDaysAgoReset.setDate(todayReset.getDate() - 7);

    startDateFilter.value = sevenDaysAgoReset;
    endDateFilter.value = todayReset;
    searchQuery.value = "";
    selectedPayType.value = "MenungguPembayaran";
    selectedFilterPoli.value = [];
    selectedPaymentMethod.value = [];
    selectedPatientUuid.value = null;
    searchResults.value = [];
    applyFilter();
};

const selectedPayType = ref<string>("Semua");
const onSelectPayType = (label: string) => {
    selectedPayType.value = label;
    applyFilter();
};

const selectedFilterPoli = ref<string[]>([]);
const onPoliSelect = (label: string) => {
    const index = selectedFilterPoli.value.indexOf(label);
    if (index > -1) {
        selectedFilterPoli.value.splice(index, 1);
    } else {
        selectedFilterPoli.value.push(label);
    }
    applyFilter();
};

const selectedPaymentMethod = ref<string[]>([]);
const onPaymentMethodSelect = (label: string) => {
    const index = selectedPaymentMethod.value.indexOf(label);
    if (index > -1) {
        // Jika sudah ada, hapus dari array
        selectedPaymentMethod.value.splice(index, 1);
    } else {
        // Jika belum ada, tambahkan ke array
        selectedPaymentMethod.value.push(label);
    }
    applyFilter();
};


const handlePage = (event: any) => {
    apsotcProperties.value.page = event.page + 1;
    apsotcProperties.value.page_size = event.rows;
    fetchApsotc();
};

const dataBreadCrumb = ref<MenuItem[]>([
    { label: 'APS & OTC' }
]);

const changeSection = (label: string) => {
    dataBreadCrumb.value.push({ label: label });
};

const dynamicOptionLabelKey = computed(() => {
    const query = searchQuery.value;
    const queryUC = query.toUpperCase();
    const addressKeywords = ["JL", "DS", "DSN", "RT", "RW", "NO", "GG", "BLOK"];
    const isAddressQuery = addressKeywords.some(keyword => queryUC.includes(keyword));

    // Pola untuk No. RM
    const isRmPattern = /^\d{2}-/.test(query);

    if (isRmPattern) {
        return 'noRm';
    }
    if (isAddressQuery) {
        return 'fullAddress';
    }
    return 'patientName';
});

const handlePatientSelection = (uuid: string) => {
    if (!uuid) return;
    selectedPatientUuid.value = uuid;
    apsotcProperties.value.page = 1; // Reset halaman ke 1
    fetchApsotc(); // Panggil fungsi fetch utama
};

const showDetail = (event: DataTableRowClickEvent) => {
    selectedBillUuid.value = event.data.uuid; // Simpan UUID
    changeSection("Detail Tagihan");
};

onMounted(() => {
    fetchApsotc();
});
</script>


<template>
    <div class="flex flex-col h-full overflow-hidden">
        <Card v-if="dataBreadCrumb.length === 1" pt:body:class="h-full pt-0 overflow-auto"
            pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
            <template #header>
                <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
                <PageToolbar>
                  <CustomButton icon="PhArrowClockwise" @click="fetchApsotc" />
                  <CustomBreadCrumb :model="dataBreadCrumb" :home="{ label: 'Transaksi', home: true }" />
                  <CustomSelect v-model="selectedPatientUuid" label="Pencarian" prependIcon="PhMagnifyingGlass"
                    place-holder="Cari Nama / Alamat / No. RM" :options="searchResults"
                    :optionLabel="dynamicOptionLabelKey" optionValue="uuid" :loading="loadingSearch"
                    @filter="findTransactionsForDropdown" @update:model-value="handlePatientSelection" />
                  <CustomDatePicker v-model="startDateFilter" label="Tanggal mulai" class="toolbar-field--date"
                    :maxDate="endDateFilter" />
                  <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
                  <CustomDatePicker v-model="endDateFilter" label="Tanggal selesai" class="toolbar-field--date"
                    :minDate="startDateFilter" :maxDate="today" />
                  <ToolbarFilterMenu :count="selectedFilterPoli.length">
                    <template #label>Pelayanan</template>
                    <CustomChip v-for="(poli, index) in filterPoliList" :key="poli + index" :label="poli"
                      :isSelected="selectedFilterPoli.includes(poli)" @selected="onPoliSelect" />
                  </ToolbarFilterMenu>
                  <ToolbarFilterMenu :count="selectedPaymentMethod.length">
                    <template #label>Pembayaran</template>
                    <CustomChip label="TUNAI" :isSelected="selectedPaymentMethod.includes('TUNAI')"
                      @selected="onPaymentMethodSelect" />
                    <CustomChip label="ASURANSI" :isSelected="selectedPaymentMethod.includes('ASURANSI')"
                      @selected="onPaymentMethodSelect" />
                  </ToolbarFilterMenu>
                  <!-- Status pembayaran -->
                  <div class="flex items-center gap-1 shrink-0" role="group" aria-label="Status pembayaran">
                    <CustomButton @click="onSelectPayType('Semua')" icon="PhListBullets"
                      v-tooltip.bottom="'Semua status'" aria-label="Semua status"
                      :outlined="selectedPayType != 'Semua'" borderColor="border-opensimrs-300"
                      :textColor="selectedPayType != 'Semua' ? 'text-opensimrs-300' : 'text-white'"
                      :backgroundColor="selectedPayType != 'Semua' ? 'bg-transparent' : 'bg-opensimrs-300'" />
                    <CustomButton @click="onSelectPayType('MenungguPembayaran')" label="Menunggu"
                      :outlined="selectedPayType != 'MenungguPembayaran'" borderColor="border-opensimrs-300"
                      :textColor="selectedPayType != 'MenungguPembayaran' ? 'text-opensimrs-300' : 'text-white'"
                      :backgroundColor="selectedPayType != 'MenungguPembayaran' ? 'bg-transparent' : 'bg-opensimrs-300'"
                      class="font-semibold" />
                    <CustomButton @click="onSelectPayType('Lunas')" label="Lunas"
                      :outlined="selectedPayType != 'Lunas'" borderColor="border-opensimrs-300"
                      :textColor="selectedPayType != 'Lunas' ? 'text-opensimrs-300' : 'text-white'"
                      :backgroundColor="selectedPayType != 'Lunas' ? 'bg-transparent' : 'bg-opensimrs-300'"
                      class="font-semibold" />
                  </div>
                  <CustomButton @click="applyFilter" icon="PhMagnifyingGlass" label="Cari" />
                  <CustomButton @click="resetFilter" label="Reset" outlined borderColor="border-opensimrs-300"
                    textColor="text-opensimrs-300" />
                </PageToolbar>
            </template>
            <template #content>
                <NoData v-if="!hasData" />
                <DataTable v-else :value="apsotcPayload" tableStyle="min-width: 50rem" scrollable scrollHeight="flex"
                    :pt="{ headerRow: 'text-SM' }" @rowClick="showDetail">
                    <Column field="nomor" headerClass="bg-opensimrs-50">
                        <template #header>
                            <div class="w-full font-semibold text-center">Nomor</div>
                        </template>
                        <template #body="slotProps">
                            <div class="text-center">
                                <div class="text-SM">{{ slotProps.data.billCode }}</div>
                                <div class="text-SM">{{ slotProps.data.noReg }}</div>
                                <div class="text-SM">{{ slotProps.data.invoiceCode }}</div>
                            </div>
                        </template>
                    </Column>
                    <Column field="pasien" header="Pasien" headerClass="bg-opensimrs-50">
                        <template #body="slotProps">
                            <div class="text-SM">
                                <span class="font-semibold">{{ slotProps.data.patientName }}</span>
                                <span class="text-grey-300">
                                    ({{ slotProps.data.ageYear }}Th
                                    {{ slotProps.data.ageMonth }}Bln
                                    {{ slotProps.data.ageDay }}Hr)
                                </span>
                            </div>
                            <div class="text-XS">{{ slotProps.data.fullAddress }}</div>
                            <div class="flex flex-wrap">
                                <CustomChip :showCheckedIcon="false"
                                    :label="['Perempuan', 'Female'].includes((slotProps.data.jenisKelamin || '').toString().trim()) ? 'Perempuan' : 'Laki-laki'"
                                    :bgColor="['Perempuan', 'Female'].includes((slotProps.data.jenisKelamin || '').toString().trim()) ? 'bg-female-75' : 'bg-male-75'"
                                    :textColor="['Perempuan', 'Female'].includes((slotProps.data.jenisKelamin || '').toString().trim()) ? 'text-female-300' : 'text-male-300'"
                                    customClass="h-5 pr-[6px] border-none mr-[5px]" />
                                <CustomChip :showCheckedIcon="false" :label="slotProps.data.noHandphone"
                                    bgColor="bg-opensimrs-50" textColor="text-opensimrs-300"
                                    customClass="h-5 pr-[6px] border-none mr-[5px]" />
                            </div>
                        </template>
                    </Column>
                    <Column field="keperawatan" header="Keperawatan" headerClass="bg-opensimrs-50">
                        <template #body="slotProps">
                            <div class="text-SM">{{ slotProps.data.practitionerName }} <span
                                    v-if="slotProps.data.scheduleTime" class="text-opensimrs-300">|</span> {{
                                        slotProps.data.scheduleTime }}</div>

                            <div class="flex flex-wrap mt-1">
                                <CustomChip v-for="(service, index) in getServiceList(slotProps.data.mainServiceCategory)"
                                    :key="index" :label="service.label" :showCheckedIcon="false"
                                    customClass="h-5 pr-[5px] mr-[5px]" />
                                <!-- <CustomChip :showCheckedIcon="false"
                                    :label="reversePoliMapping[slotProps.data.mainServiceCategory] || slotProps.data.mainServiceCategory"
                                    customClass="h-5 pr-[5px] mr-[5px]" /> -->
                                <!-- <CustomChip :showCheckedIcon="false"
                                    :label="reversePoliMapping[slotProps.data.serviceTypeList] || slotProps.data.serviceTypeList"
                                    customClass="h-5 pr-[5px] mr-[5px]" /> -->
                                <!-- <CustomChip v-if="slotProps.data.completenessStatus === 'Data Lengkap'"
                                    :showCheckedIcon="false" label="Data Lengkap" customClass="h-5 pr-[5px] mr-[5px]" /> -->
                                <CustomChip v-if="slotProps.data.polyclinicName" :showCheckedIcon="false"
                                    :label="slotProps.data.polyclinicName" customClass="h-5 pr-[5px] mr-[5px]" />
                                <CustomChip :showCheckedIcon="false" :label="slotProps.data.paymentType" :bgColor="slotProps.data.paymentType == 'TUNAI'
                                    ? 'bg-opensimrs-50'
                                    : 'bg-warning-50'
                                    " :textColor="slotProps.data.paymentType == 'TUNAI'
                                        ? 'text-opensimrs-300'
                                        : 'text-warning-300'
                                        " :borderColor="slotProps.data.paymentType == 'TUNAI'
                                            ? 'border-opensimrs-300'
                                            : 'border-warning-300'
                                            " customClass="h-5 pr-[6px] mr-[5px]" />
                            </div>

                        </template>
                    </Column>
                </DataTable>
            </template>
            <template #footer>
                <div class="flex justify-end">
                    <Paginator :first="(apsotcProperties.page - 1) * apsotcProperties.page_size"
                        :rows="apsotcProperties.page_size" :totalRecords="apsotcProperties.total"
                        :rowsPerPageOptions="[10, 20, 30]" @page="handlePage"
                        template="FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink RowsPerPageDropdown"
                        currentPageReportTemplate="{currentPage}">
                        <template #start>
                            <span class="font-md mr-4">Total Data: {{ apsotcProperties.total }}</span>
                        </template>
                    </Paginator>
                </div>
            </template>
        </Card>
        <TransactionApsOtc v-else :bill-uuid="selectedBillUuid" :dataBreadCrumb="dataBreadCrumb" :pageType="pageType"
            @back="dataBreadCrumb.pop()" />
    </div>
</template>