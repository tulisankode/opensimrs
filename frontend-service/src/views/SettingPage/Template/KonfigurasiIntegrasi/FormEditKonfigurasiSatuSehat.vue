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

const emit = defineEmits([
    "update:isEditKonfigurasiSatuSehat",
    "update:afterEditKonfigurasiSatuSehat",
]);

const props = defineProps({
    konfigurasiIntegrasiResponse: {
        type: Object,
        required: true,
    },
    isEditKonfigurasiSatuSehat: {
        type: Boolean,
        required: true,
    },
});

const settingStore = useSettingStore();
// const statusSatuSehat = ref(false);
// const statusSatuSehat = ref(false);

const schemaKonfigurasiSatuSehat: any = computed(() =>
    toTypedSchema(
        yup.object({
            statusSatuSehat: yup.boolean().required(),
            organizationId: yup.string().when("statusSatuSehat", {
                is: (value: boolean) => value === true,
                then: (schema) => schema.required("Wajib Diisi"),
                otherwise: (schema) => schema.notRequired(),
            }),
            clientSecret: yup.string().when("statusSatuSehat", {
                is: (value: boolean) => value === true,
                then: (schema) => schema.required("Wajib Diisi"),
                otherwise: (schema) => schema.notRequired(),
            }),
            clientId: yup.string().when("statusSatuSehat", {
                is: (value: boolean) => value === true,
                then: (schema) => schema.required("Wajib Diisi"),
                otherwise: (schema) => schema.notRequired(),
            }),
        })
    )
);

const {
    handleSubmit: handleSubmitKonfigurasiSatuSehat,
    defineField: defineFieldKonfigurasiSatuSehat,
    resetForm: resetKonfigurasiSatuSehatForm,
    errors: KonfigurasiSatuSehatErrors,
} = useForm({
    validationSchema: schemaKonfigurasiSatuSehat, // Pastikan ini sesuai dengan schema yang digunakan
    initialValues: {
        organizationId: props.konfigurasiIntegrasiResponse.organizationId,
        clientSecret: props.konfigurasiIntegrasiResponse.clientSecret,
        clientId: props.konfigurasiIntegrasiResponse.clientId,
        statusSatuSehat: props.konfigurasiIntegrasiResponse.statusSatuSehat,
    },
});

const [organizationId] = defineFieldKonfigurasiSatuSehat("organizationId");
const [clientId] = defineFieldKonfigurasiSatuSehat("clientId");
const [clientSecret] = defineFieldKonfigurasiSatuSehat("clientSecret");
const [statusSatuSehat] = defineFieldKonfigurasiSatuSehat("statusSatuSehat");

const resetForm = () => {
    resetKonfigurasiSatuSehatForm({
        values: {
            organizationId: "",
            clientId: "",
            clientSecret: "",
            statusSatuSehat: false,
        },
    });
};

const onSubmitKonfigurasiSatuSehat = handleSubmitKonfigurasiSatuSehat(
    async (values) => {
        try {
            const payload = {
                organizationId: values.organizationId,
                clientId: values.clientId,
                clientSecret: values.clientSecret,
                statusSatuSehat: values.statusSatuSehat, // Menambahkan statusSatuSehat ke payload
            };

            console.log("Payload to be sent:", payload);
            const response = await settingStore.putKonfigurasiSatuSehat(payload);

            if (response?.status === 200) {
                emit("update:isEditKonfigurasiSatuSehat", false);
                emit("update:afterEditKonfigurasiSatuSehat", {
                    ...props.konfigurasiIntegrasiResponse,
                    ...payload,
                });
            } else {
                console.error("Failed to update");
            }
        } catch (error) {
            console.error("Error during submission:", error);
        }
    }
);
</script>

<template>
    <GreenCard cardHeading="Konfigurasi SATUSEHAT" hrEnableCustomClass showButton labelButton="Batal Edit" outlined
        borderColor="border-opensimrs-300" textColor="text-opensimrs-300" :button-click-handler="() => emit('update:isEditKonfigurasiSatuSehat', false)
            ">
        <div class="grid grid-cols-2 gap-7 text-normal">
            <CustomTextfield label="Organization ID" class="border-[#C7CBD2]" placeholder="Organization ID"
                v-model:modelValue="organizationId" :invalid="statusSatuSehat && !!KonfigurasiSatuSehatErrors.organizationId
                    " :invalidMessage="KonfigurasiSatuSehatErrors.organizationId" :disabled="!statusSatuSehat" />
            <CustomTextfield label="Client Secret" class="border-[#C7CBD2]" placeholder="Client Secret"
                v-model:modelValue="clientSecret"
                :invalid="statusSatuSehat && !!KonfigurasiSatuSehatErrors.clientSecret"
                :invalidMessage="KonfigurasiSatuSehatErrors.clientSecret" :disabled="!statusSatuSehat" />

            <div class="grid">
                <CustomTextfield label="Client ID" class="border-[#C7CBD2]" placeholder="Client ID"
                    v-model:modelValue="clientId" :invalid="statusSatuSehat && !!KonfigurasiSatuSehatErrors.clientId"
                    :invalidMessage="KonfigurasiSatuSehatErrors.clientId" :disabled="!statusSatuSehat" />
            </div>
        </div>

        <hr class="border-[#D9DCE1] border-1 mt-7 mb-2" />

        <div class="flex items-center gap-2">
            <CustomSwitch v-model="statusSatuSehat" label="Status" />
            <!-- <div class="mt-2.5">{{ status === true ? "Aktif" : "Non-Aktif" }}</div> -->
        </div>

        <hr class="border-[#D9DCE1] border-1 mt-12 mb-5" />
        <div class="flex items-end justify-end gap-3">
            <CustomButton label="Reset" textColor="text-[#9DA4B1]" backgroundColor="bg-transparent"
                borderColor="border-2 border-[#9DA4B1]" @click="resetForm" />
            <CustomButton label="Simpan" @click="onSubmitKonfigurasiSatuSehat" />
        </div>
    </GreenCard>
</template>

<style lang="scss" scoped></style>
