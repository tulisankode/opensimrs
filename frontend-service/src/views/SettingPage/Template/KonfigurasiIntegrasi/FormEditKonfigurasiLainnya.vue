<script setup lang="ts">
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { ref } from "vue";
import GreenCard from "../GreenCard.vue";
import { useSettingStore } from "@/stores/setting";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { computed } from "vue";

const emit = defineEmits(['update:isEditKonfigurasiLainnya', 'update:afterEditKonfigurasiLainnya']);


const props = defineProps({
    konfigurasiIntegrasiResponse: {
        type: Object,
        required: true,
    },
    isEditKonfigurasiLainnya: {
        type: Boolean,
        required: true,
    },
});

const settingStore = useSettingStore();
const schemaKonfigurasiLainnya = computed(() =>
    toTypedSchema(
        yup.object({
            apiKeyPost: yup.string(),
            method: yup.string(),
            endpoint: yup.string(),
            header: yup.string(),
            request: yup.string(),
            response: yup.string(),
            statusLainnya: yup.bool().default(false) // Mengubah tipe statusLainnya menjadi boolean
        })
    )
);

const {
    handleSubmit: handleSubmitKonfigurasiLainnya,
    defineField: defineFieldKonfigurasiLainnya,
    resetForm: resetKonfigurasiLainnyaForm
} = useForm({
    validationSchema: schemaKonfigurasiLainnya,
    initialValues: {
        apiKeyPost: props.konfigurasiIntegrasiResponse.apiKeyPost,
        method: props.konfigurasiIntegrasiResponse.method,
        endpoint: props.konfigurasiIntegrasiResponse.endpoint,
        header: props.konfigurasiIntegrasiResponse.header,
        request: props.konfigurasiIntegrasiResponse.request,
        response: props.konfigurasiIntegrasiResponse.response,
        statusLainnya: props.konfigurasiIntegrasiResponse.statusLainnya,
    },
});

const [apiKeyPost] = defineFieldKonfigurasiLainnya("apiKeyPost");
const [method] = defineFieldKonfigurasiLainnya("method");
const [endpoint] = defineFieldKonfigurasiLainnya("endpoint");
const [header] = defineFieldKonfigurasiLainnya("header");
const [request] = defineFieldKonfigurasiLainnya("request");
const [response] = defineFieldKonfigurasiLainnya("response");
const [statusLainnya] = defineFieldKonfigurasiLainnya("statusLainnya"); // Boolean field

const resetForm = () => {
    resetKonfigurasiLainnyaForm({
        values: {
            apiKeyPost: '',
            method: '',
            endpoint: '',
            header: '',
            request: '',
            response: '',
            statusLainnya: false,
        },
    });
};

const onSubmitKonfigurasiLainnya = handleSubmitKonfigurasiLainnya(async (values) => {
    try {
        const payload = {
            apiKeyPost: values.apiKeyPost,
            method: values.method,
            endpoint: values.endpoint,
            header: values.header,
            request: values.request,
            response: values.response,
            statusLainnya: values.statusLainnya,
        };

        console.log("Payload to be sent:", payload);
        const response = await settingStore.putKonfigurasiLainnya(payload);

        if (response?.status === 200) {
            emit('update:isEditKonfigurasiLainnya', false);
            emit('update:afterEditKonfigurasiLainnya', { ...props.konfigurasiIntegrasiResponse, ...payload });
        } else {
            console.error("Failed to update");
        }
    } catch (error) {
        console.error("Error during submission:", error);
    }
});

</script>

<template>
    <GreenCard cardHeading="Konfigurasi Lainnya" hr-enable-custom-class showButton labelButton="Batal Edit" outlined
        borderColor="border-opensimrs-300" textColor="text-opensimrs-300"
        :button-click-handler="() => emit('update:isEditKonfigurasiLainnya', false)">

        <div class="grid grid-cols-2 gap-7 text-normal">
            <CustomTextfield label="API Key Post" class="border-[#C7CBD2]" placeholder="API Key Post"
                v-model:modelValue="apiKeyPost" />
            <CustomTextfield label="Metode" class="border-[#C7CBD2]" placeholder="Pilih Metode"
                v-model:modelValue="method" />
            <CustomTextfield label="URL End Point" class="border-[#C7CBD2]" placeholder="URL End Point"
                v-model:modelValue="endpoint" />
            <CustomTextfield label="Header" class="border-[#C7CBD2]" placeholder="Header" v-model:modelValue="header" />
            <CustomTextfield label="Request" class="border-[#C7CBD2]" placeholder="Insert Payload Here ..."
                v-model:modelValue="request" />
            <CustomTextfield label="Response" class="border-[#C7CBD2]" placeholder="Insert Payload Here ..."
                v-model:modelValue="response" />
        </div>

        <!-- Garis Pertama -->
        <hr class="border-[#D9DCE1] border-1 mt-7 mb-2" />
        <CustomSwitch v-model:modelValue="statusLainnya" label="Status" />


        <hr class="border-[#D9DCE1] border-1 mt-12 mb-5" />

        <!-- Setelah garis ada Button -->
        <div class="flex items-end justify-end gap-3">
            <CustomButton label="Reset" textColor="text-[#9DA4B1]" backgroundColor="bg-transparent"
                borderColor="border-2 border-[#9DA4B1]" @click="resetForm" />
            <CustomButton label="Simpan" @click="onSubmitKonfigurasiLainnya" />
        </div>

    </GreenCard>
</template>

<style lang="scss" scoped></style>
