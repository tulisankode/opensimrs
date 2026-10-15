<script setup lang="ts">
import { ref, computed } from "vue";
import MainHeaderSetting from "../MainHeaderSetting.vue";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Button from "primevue/button";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomButton from "@/components/Base/CustomButton.vue";

const permission = ref([
    {
        id: 1,
        namaPermission: "Admisi",
        kode: "ADM",
        kategori: "Main Menu",
        status: "AKTIF",
        subMenu: [
            { id: 1, namaSubMenu: "Rawat Jalan" },
            { id: 2, namaSubMenu: "Rawat Inap" },
            { id: 3, namaSubMenu: "IGD" },
            { id: 4, namaSubMenu: "SEP" },
            { id: 5, namaSubMenu: "Data Pasien" },
            { id: 6, namaSubMenu: "Monitoring Kamar" },
        ],
    },
    {
        id: 2,
        namaPermission: "Antrian",
        kode: "ANT",
        kategori: "Main Menu",
        status: "AKTIF",
        subMenu: [], // Add submenu items here if any
    },
]);

const expandedRows = ref<any[]>([]);
const totalRecords = ref(permission.value.length);

const isDialogVisible = ref(false);

const showDialog = () => {
    isDialogVisible.value = true;
};
const selectedKategori = ref();
const kategori = ref([
    { name: "Main Menu", code: "MAIN" },
    { name: "Sub Menu", code: "SUBM" },
]);

const status = ref();

// Computed property to check if the selected category is "Sub Menu"
const isSubMenuSelected = computed(() => {
    return selectedKategori.value === "SUBM";
});

const mainMenuOptions = ref([
    { label: "Admisi", value: "ADM" },
    { label: "Antrian", value: "ANT" }
]);

const selectedMainMenu = ref();
</script>

<template>
        <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto">
            <template #header>
                <MainHeaderSetting heading="Permission Menu" showButton labelButton="Menu" iconButton="PhPlus"
                    :button-click-handler="showDialog"/>
                <CustomDialog class="" v-model:visible="isDialogVisible" headerBg="bg-opensimrs-300" width="600px">
                    <template #header>
                            Tambah Menu
                    </template>
                    <template #body>
                        <div class="my-5 text-normal">
                            <div class="mb-2.5">
                                <CustomSelect label="Kategori" v-model="selectedKategori" :options="kategori"
                                    optionValue="code" optionLabel="name" :isLoading="false" :invalid="false"
                                    invalidMessage="Wajib diisi" :disabled="false" placeHolder="Pilih Kategori"
                                    customSelectClass="border-[#C7CBD2]" />
                            </div>

                            <!-- Conditionally display the "Cari Main Menu" dropdown -->
                            <div v-if="isSubMenuSelected" class="mb-2.5">
                                <CustomSelect label="Cari Main Menu" v-model="selectedMainMenu"
                                    :options="mainMenuOptions" optionValue="value" optionLabel="label"
                                    :isLoading="false" :invalid="false" invalidMessage="Wajib diisi" :disabled="false"
                                    placeHolder="Pilih Main Menu" customSelectClass="border-[#C7CBD2]" />
                            </div>

                            <div class="flex gap-7 ">
                                <div class="w-[200px]">
                                    <CustomTextfield label="Kode Menu" class="border-[#C7CBD2] "
                                        placeholder="Kode Menu" />
                                </div>
                                <div class="grow">
                                    <CustomTextfield label="Nama Menu" class="" placeholder="Nama Menu" />
                                </div>
                            </div>

                            <hr class="border-[#D9DCE1] border-1 my-5" />

                            <div class="flex flex-col">
                                <div class="font-semibold mb-[5px]">
                                    Status
                                </div>
                                <div class="flex items-center gap-2">
                                    <CustomSwitch v-model="status" label=""/>
                                    <div class="mt-2">{{ status === true ? "Aktif" : "Non-Aktif" }}</div>
                                </div>
                            </div>
                        </div>
                    </template>
                    <template #footer>

                        <div class="w-full">
                            <hr class="border-[#D9DCE1] border-1 -mx-5 mb-5  bg-slate-400" />
                            <div class="flex items-end justify-end gap-2.5 ">
                                <CustomButton label="Reset" textColor="text-[#9DA4B1]" backgroundColor="bg-transparent"
                                    borderColor="border-2 border-[#9DA4B1]" />
                                <CustomButton label="Simpan" />
                            </div>

                        </div>

                    </template>
                </CustomDialog>
            </template>

            <template #content>
                <DataTable :value="permission" responsiveLayout="scroll" dataKey="id" :expandedRows="expandedRows"
                    scrollable scrollHeight="flex" class="p-datatable-sm">
                    <Column expander style="width: 2em" header-class="text-black bg-opensimrs-50">
                    </Column>
                    <Column field="id" header="No" header-class="text-black bg-opensimrs-50"
                        class="w-10 p-5 text-center text-black text-SM" />
                    <Column field="namaPermission" header="Nama Permission" header-class="text-black bg-opensimrs-50 "
                        class="text-black text-SM" style="min-width: 500px" />
                    <Column field="kode" header="Kode" header-class="text-black bg-opensimrs-50"
                        class="text-black text-SM" style="min-width: 140px" />
                    <Column field="kategori" header="Kategori" header-class="text-black bg-opensimrs-50"
                        class="text-black text-SM" style="min-width: 110px" />
                    <Column field="status" header="Status" header-class="text-black bg-opensimrs-50" class="text-SM"
                        style="min-width: 100px">
                        <template #body="slotProps">
                            <CustomChip :label="slotProps.data.status" bg-color="bg-opensimrs-300"
                                border-color="border-transparent" text-color="text-white" icon-color="text-white" />
                        </template>
                    </Column>

                    <template #expansion="slotProps">
                        <div class="p-3 -mx-2 -my-1.5 bg-opensimrs-50">
                            <DataTable :value="slotProps.data.subMenu" class="overflow-hidden rounded-lg bg-opensimrs-50">
                                <Column field="id" header="No." header-class="text-white bg-opensimrs-300"
                                    class="w-10 p-5 text-center text-black text-SM"></Column>
                                <Column field="namaSubMenu" header="Nama Sub Menu"
                                    header-class="text-white bg-opensimrs-300" class="text-black text-SM"></Column>
                            </DataTable>
                        </div>
                    </template>
                </DataTable>
            </template>

            <template #footer>
                <hr class="border-[#D9DCE1] border-1  mt-16 mb-2" />
                <div class="flex justify-end gap-10 p-5">
                    <!-- Pagination -->
                    <div>
                        <CustomPaginator :rows="10" :totalRecords="totalRecords" />
                    </div>
                </div>
            </template>
        </Card>
</template>

<style>
.p-datatable-row-toggle-icon {
    @apply w-3 h-3 text-opensimrs-300;
}

.p-datatable-footer {
    display: flex;
    justify-content: space-between;
    border: none;
}
</style>
