<script setup lang="ts">
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomChip from "@/components/Base/CustomChip.vue";

const props = defineProps({
    isDialogVisible: {
        type: Boolean,
        default: false,
    },
    data: {
        type: Object,
        default: () => ({}),
    },
});

const emit = defineEmits(["update:isDialogVisible", "edit"]);

const updateVisibility = (value: boolean) => {
    emit("update:isDialogVisible", value);
};

const closeDialog = () => {
    emit("update:isDialogVisible", false);
};

const handleEdit = () => {
    emit("edit", props.data);
};
</script>

<template>
    <CustomDialog 
        :visible="isDialogVisible" 
        @update:visible="updateVisibility" 
        width="750px" 
        headerBg="bg-opensimrs-300"
        headerTextColor="text-white"
    >
        <template #header>
            <div class="flex justify-between w-full items-center">
                <p class="font-semibold text-lg">Detail Data Supplier</p>
            </div>
        </template>

        <template #body>
            <div class="grid grid-cols-[25%,75%] gap-y-6 text-sm py-6 items-center">
                <div class="font-bold">Kode Supplier</div>
                <div>: {{ data.code || '-' }}</div>

                <div class="font-bold">Nama Supplier</div>
                <div>: {{ data.name || '-' }}</div>

                <div class="font-bold">Provinsi</div>
                <div>: {{ data.provinsi || '-' }}</div>

                <div class="font-bold">Kab.Kota</div>
                <div>: {{ data.kabupaten || '-' }}</div>

                <div class="font-bold">Kecamatan</div>
                <div>: {{ data.kecamatan || '-' }}</div>

                <div class="font-bold">Kel/Desa</div>
                <div>: {{ data.kelurahan || '-' }}</div>

                <div class="font-bold">Alamat</div>
                <div>: {{ data.alamat || '-' }}</div>

                <div class="font-bold">No. Telepon</div>
                <div>: {{ data.noTlp || '-' }}</div>

                <div class="font-bold">Kategori Item</div>
                <div class="flex flex-wrap gap-2 items-center">
                    :
                    <template v-if="data.kategoriItem && data.kategoriItem.length">
                        <CustomChip 
                            v-for="(item, index) in data.kategoriItem" 
                            :key="index" 
                            :label="item.toUpperCase()"
                            :showCheckedIcon="false" 
                            borderColor="border-opensimrs-300" 
                            bgColor="bg-opensimrs-300"
                            textColor="text-white" 
                            customClass="h-6 text-xs font-semibold px-2" 
                        />
                    </template>
                    <span v-else>-</span>
                </div>

                <div class="font-bold">Status</div>
                <div class="flex items-center">
                    :
                    <CustomChip 
                        :label="data.status ? 'AKTIF' : 'NON-AKTIF'"
                        :textColor="data.status ? 'text-white' : 'text-[#80868d]'"
                        :bgColor="data.status ? 'bg-opensimrs-300' : 'bg-white'"
                        :borderColor="data.status ? 'border-none' : 'border-[#80868d]'"
                        :icon-color="data.status ? 'white' : '#80868d'"
                        customClass="ml-1 text-xs font-semibold h-6 flex px-2" 
                    />
                </div>
            </div>
        </template>

        <template #footer>
            <div class="w-full flex justify-end mt-6">
                <CustomButton 
                    label="Edit" 
                    backgroundColor="bg-opensimrs-300" 
                    textColor="text-white" 
                    class="w-[100px]"
                    @click="handleEdit" 
                />
            </div>
        </template>
    </CustomDialog>
</template>