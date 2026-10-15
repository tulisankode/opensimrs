<script lang="ts" setup>
import { ref } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { computed } from "vue";
import GreenCard from "../GreenCard.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { useSettingStore } from "@/stores/setting";

const showPasswordLama = ref(false);
const showPasswordBaru = ref(false);
const showVerifikasiPasswordBaru = ref(false);

const settingStore = useSettingStore();

const props = defineProps({
    profilAkunResponse: {
        type: Object,
        required: true,
    },
    isEditUsernamePassword: {
        type: Boolean,
        required: true,
    },
});
const schemaUsernamePassword = computed(() =>
    toTypedSchema(
        yup.object({
            password: yup.string().required("Password Lama diperlukan"),
            passwordBaru: yup
                .string()
                .min(8, "Password minimal 8 karakter")
                .matches(
                    /[A-Z]/,
                    "Password harus mengandung setidaknya satu huruf besar"
                ).required("Masukkan Password Baru")
                .matches(
                    /[a-z]/,
                    "Password harus mengandung setidaknya satu huruf kecil"
                )
                .matches(/\d/, "Password harus mengandung setidaknya satu angka")
                .matches(
                    /[!@#$%^&*(),.?":{}|<>]/,
                    "Password harus mengandung setidaknya satu simbol khusus"
                ),
            verifikasiPasswordBaru: yup
                .string()
                .min(8, "Password minimal 8 digit")
                .matches(
                    /[A-Z]/,
                    "Password harus mengandung setidaknya satu huruf besar"
                )
                .matches(
                    /[a-z]/,
                    "Password harus mengandung setidaknya satu huruf kecil"
                )
                .matches(/\d/, "Password harus mengandung setidaknya satu angka")
                .matches(
                    /[!@#$%^&*(),.?":{}|<>]/,
                    "Password harus mengandung setidaknya satu simbol khusus"
                )
                .oneOf([yup.ref("passwordBaru")], "Password tidak sama").required("Sesuaikan dengan Password Baru")
        })
    )
);

const {
    errors: usernamePasswordErrors,
    handleSubmit: handleSubmitUsernamePassword,
    defineField: defineFieldUsernamePassword, resetForm: resetUsernamePasswordForm 
} = useForm({
    validationSchema: schemaUsernamePassword,

});

const [password] = defineFieldUsernamePassword("password");
const [passwordBaru] = defineFieldUsernamePassword("passwordBaru");
const [verifikasiPasswordBaru] = defineFieldUsernamePassword(
    "verifikasiPasswordBaru"
);

const emit = defineEmits([
    "update:isEditUsernamePassword",
    "update:afterEditUsernamePassword",
]);

const resetForm = () => {
    resetUsernamePasswordForm({
        values: {
            password: '',
            passwordBaru: '',
            verifikasiPasswordBaru: '',
            
        },
    });
};


const onSubmitUsernamePassword = handleSubmitUsernamePassword(
    async (values) => {
        try {
        
                const payload = {
                    oldPassword: values.password,
                    password: values.passwordBaru,
                    name: props.profilAkunResponse.name,
                    awalanGelar: props.profilAkunResponse.awalanGelar,
                    akhiranGelar: props.profilAkunResponse.akhiranGelar,
                    phone: props.profilAkunResponse.phone,
                    photo: props.profilAkunResponse.photo,
                };
                const response = await settingStore.putProfilAkunApi(payload);
                if (response?.status === 200) {
                    emit("update:isEditUsernamePassword", false);
                    emit("update:afterEditUsernamePassword", {
                        ...props.profilAkunResponse,
                        ...payload,
                    });
                } else {
                    console.error("Failed to update profile:");
                }

                console.log("Submitted with", values);
        } catch (error) {
            console.error("Error during submission:", error);
        }
    }
);
</script>

<template>
    <GreenCard cardHeading="Username & Password" hrEnableCustomClass showButton labelButton="Batal Edit"
        :button-click-handler="() => emit('update:isEditUsernamePassword', false)" outlined
        borderColor="border-opensimrs-300" textColor="text-opensimrs-300">
        <div class="grid grid-cols-2 gap-7">
            <div class="flex flex-col mt-2">
                <div class="text-sm underline">Username</div>
                <div class="font-bold text-heading">{{ profilAkunResponse.username }}</div>
            </div>
            <div class="mb-4">
                <CustomTextfield label="Password Lama" class="w-full" placeholder="************" v-model="password"
                    :type="showPasswordLama ? 'text' : 'password'"
                    :appendIcon="showPasswordLama ? 'PhEye' : 'PhEyeSlash'"
                    @clickAppend="showPasswordLama = !showPasswordLama" :invalid="!!usernamePasswordErrors.password"
                    :invalidMessage="usernamePasswordErrors.password" />
            </div>
            <div class="mb-4">
                <CustomTextfield label="Password Baru" class="w-full" placeholder="************" v-model="passwordBaru"
                    :invalid="!!usernamePasswordErrors.passwordBaru"
                    :invalidMessage="usernamePasswordErrors.passwordBaru" :type="showPasswordBaru ? 'text' : 'password'"
                    :appendIcon="showPasswordBaru ? 'PhEye' : 'PhEyeSlash'"
                    @clickAppend="showPasswordBaru = !showPasswordBaru" />
            </div>
            <div class="mb-4">
                <CustomTextfield label="Verifikasi Password Baru" class="w-full" placeholder="************"
                    v-model="verifikasiPasswordBaru" :invalid="!!usernamePasswordErrors.verifikasiPasswordBaru"
                    :invalidMessage="usernamePasswordErrors.verifikasiPasswordBaru"
                    :type="showVerifikasiPasswordBaru ? 'text' : 'password'"
                    :appendIcon="showVerifikasiPasswordBaru ? 'PhEye' : 'PhEyeSlash'" @clickAppend="
                        showVerifikasiPasswordBaru = !showVerifikasiPasswordBaru
                        " />
            </div>
        </div>
        <hr class="border-[#D9DCE1] border-1 mt-5" />
        <div class="flex items-end justify-end gap-3 py-2.5">
            <CustomButton label="Reset" textColor="text-[#9DA4B1]" backgroundColor="bg-transparent"
                borderColor="border-2 border-[#9DA4B1]" @click="resetForm" />
            <CustomButton label="Simpan" @click="onSubmitUsernamePassword" />
        </div>
    </GreenCard>
</template>
