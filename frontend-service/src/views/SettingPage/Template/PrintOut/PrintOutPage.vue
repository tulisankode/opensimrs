<script setup lang="ts">
import MainHeaderSetting from '../MainHeaderSetting.vue';
import CustomButton from '@/components/Base/CustomButton.vue';
import Card from 'primevue/card';
import { computed, onMounted, ref } from 'vue';
import { useSettingStore } from '@/stores/setting';
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomDragDrop from '@/components/Base/CustomDragDrop.vue';
import defaultImage from '@/assets/icons/noPicture.svg'
import { utilsStore } from "@/stores/utils";

const useUtilsStore = utilsStore();

const printOutResponse = ref({
    header: "",
    background: "",
    footer: ""
})

const headerDefaultImage = ref(defaultImage);
const backgroundDefaultImage = ref(defaultImage);
const footerDefaultImage = ref(defaultImage);

const settingStore = useSettingStore()


const fetchPrintOutPData = async () => {
    useUtilsStore.setLoading(true);
    try {
        const response = await settingStore.getPrintOutApi();
        if (response && response.payload) {
            printOutResponse.value = response.payload
            // console.log('Data printOutResponse:', printOutResponse.value);
            useUtilsStore.setLoading(false);
        } else {
            console.error("Unexpected response Structure", response);
        }

    } catch (error) {
        console.error("Failed to fetch data", error);
    }
}

onMounted(() => {
    console.log(printOutResponse.value);
    fetchPrintOutPData();
});

const isEditPrintOut = ref(false);
const editPrintOut = () => {
    isEditPrintOut.value = !isEditPrintOut.value;
    // console.log(isEditPrintOut)
};

const schemaPrintOut = computed(() =>
    toTypedSchema(
        yup.object({
            header: yup.string().required("Harus Mengupload Foto"),
            background: yup.string(),
            footer: yup.string()
        })
    )
);

const { errors: printOutErrors, handleSubmit: handleSubmitPrintOut, defineField: defineFieldPrintOut, resetForm: resetPrintOutForm } = useForm({
    validationSchema: schemaPrintOut,
    initialValues: {
        header: printOutResponse.value.header,
        background: printOutResponse.value.background,
        footer: printOutResponse.value.footer
    },
});

const [header] = defineFieldPrintOut("header");
const [background] = defineFieldPrintOut("background");
const [footer] = defineFieldPrintOut("footer");

const onSubmitPrintOut = handleSubmitPrintOut(async (values) => {
    useUtilsStore.setLoading(true);
    try {
        //  console.log('bgWarna value before submission:', values.bgWarna);
        const payload = {
            header: values.header,
            background: values.background,
            footer: values.footer,

        };
        console.log('Payload to be sent:', payload);
        const response = await settingStore.putPrintOutApi(payload);
        useUtilsStore.setLoading(false);
        if (response) {
            await fetchPrintOutPData(); // Memanggil ulang data setelah simpan
            isEditPrintOut.value = false; // Kembali ke tampilan non-edit setelah menyimpan
           
        }
    } catch (error) {
        console.error("Error during submission:", error);
    }
})


const resetForm = () => {
    resetPrintOutForm({
        values: {
            header: '',
            background: '',
            footer: ''
        },
    });
};


const headerUpload = ref<InstanceType<typeof CustomDragDrop> | null>(null);
const backgroundUpload = ref<InstanceType<typeof CustomDragDrop> | null>(null);
const footerUpload = ref<InstanceType<typeof CustomDragDrop> | null>(null);


const clearHeaderPreview = () => {
    if (headerUpload.value) {
        headerUpload.value.clearFile();
    }
};

const clearBackgroundPreview = () => {
    if (backgroundUpload.value) {
        backgroundUpload.value.clearFile(); // Now this should work as expected
    }
};
const clearFooterPreview = () => {
    if (footerUpload.value) {
        footerUpload.value.clearFile(); // Now this should work as expected
    }
};

</script>



<template>
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto">
        <template #header>
            <MainHeaderSetting v-if="!isEditPrintOut" heading="Print Out" showButton labelButton="Edit"
                :buttonClickHandler="editPrintOut" />
            <MainHeaderSetting v-else-if="isEditPrintOut" heading="Print Out" showButton labelButton="Batal Edit"
                :buttonClickHandler="editPrintOut" outlined borderColor="border-opensimrs-300"
                textColor="text-opensimrs-300" />

            <div class="ml-5 mr-7 mt-2.5">
                <div class="text-sm font-semibold font-poppins">Pengaturan Cetak Print</div>
                <div class="py-2.5">
                    <div class="text-SM text-[#858D9D]">
                        Gambar ini akan ditampilkan saat cetak Print Out PDF
                    </div>
                    <ul class="list-disc list-inside text-SM ml-[6px] text-[#858D9D]">
                        <li>Ukuran gambar Header dan Footer yang disarankan adalah 793x1192.</li>
                    </ul>
                </div>
            </div>
        </template>

        <template #content v-if="!isEditPrintOut">
            <div class="py-5 flex flex-col gap-2.5">
                <div class="text-sm font-semibold font-poppins text-opensimrs-300">Preview Header</div>
                <Card class="border border-dashed border-[#d3e1e1] bg-[#eff8f6]">
                    <template #content>
                        <div class="flex items-center justify-center min-h-[200px]">
                            <img :src="printOutResponse.header ? printOutResponse.header : headerDefaultImage" alt="">
                        </div>
                    </template>

                </Card>
            </div>

            <div class="text-sm font-semibold font-poppins text-opensimrs-300 py-2.5 flex flex-col gap-2.5">
                <div>Preview Gambar</div>
                <Card class="border border-dashed border-[#d3e1e1] bg-[#eff8f6]">
                    <template #content>
                        <div class="flex items-center justify-center min-h-[600px]">
                            <img :src="printOutResponse.background ? printOutResponse.background : backgroundDefaultImage"
                                alt="">
                        </div>
                    </template>
                </Card>
            </div>


            <div class="text-sm font-semibold font-poppins text-opensimrs-300 py-2.5 flex flex-col gap-2.5">
                <div> Preview Footer</div>
                <Card class=" border border-dashed border-[#d3e1e1] bg-[#eff8f6]">
                    <template #content>
                        <div class="flex items-center justify-center min-h-[200px]">
                            <img :src="printOutResponse.footer ? printOutResponse.footer : footerDefaultImage" alt="">
                        </div>
                    </template>
                </Card>
            </div>
        </template>

        <template #content v-else>
            <div class="text-sm font-poppins text-opensimrs-300 py-5 flex flex-col gap-2.5">
                <div class="flex items-center justify-between ">
                    <div class="font-semibold"> Preview Header</div>
                    <CustomButton label="Hapus Gambar" backgroundColor="bg-danger-50" textColor="text-danger-300"
                        icon="PhTrash" @click="clearHeaderPreview" />
                </div>
                <div>
                    <CustomDragDrop v-model="header" class="h-auto text-center bg-opensimrs-50"
                        :allowed-file-types="['image/png', 'image/jpeg', 'application/pdf']" ref="headerUpload" />
                </div>

                <div class="flex items-center justify-between ">
                    <div class="font-semibold"> Preview Gambar</div>
                    <CustomButton label="Hapus Gambar" backgroundColor="bg-danger-50" textColor="text-danger-300"
                        icon="PhTrash"  @click="clearBackgroundPreview" />
                </div>
                <div class="">
                    <CustomDragDrop v-model="background" class="text-center min-h-[600px] bg-opensimrs-50"
                        :allowed-file-types="['image/png', 'image/jpeg', 'application/pdf']" ref="backgroundUpload"/>
                </div>

                <div class="flex items-center justify-between ">
                    <div class="font-semibold"> Preview Footer</div>
                    <CustomButton label="Hapus Gambar" backgroundColor="bg-danger-50" textColor="text-danger-300"
                        icon="PhTrash" @click="clearFooterPreview"  />
                </div>
                <div>
                    <CustomDragDrop v-model="footer" class="h-auto bg-opensimrs-50"
                        :allowed-file-types="['image/png', 'image/jpeg', 'application/pdf']"  ref="footerUpload"/>
                </div>
            </div>

        </template>

        <template #footer v-if="isEditPrintOut">
            <div class="w-full">
                <hr class="border-[#D9DCE1] border-1 -mx-5 mb-5  bg-slate-400" />
                <div class="flex items-end justify-end gap-2.5 ">
                    <CustomButton label="Reset" textColor="text-[#9DA4B1]" backgroundColor="bg-transparent"
                        borderColor="border-2 border-[#9DA4B1]" @click="resetForm" />
                    <CustomButton label="Simpan" @click="onSubmitPrintOut" />
                </div>
            </div>
        </template>
    </Card>
</template>
