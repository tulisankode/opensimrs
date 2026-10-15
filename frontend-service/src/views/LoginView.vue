<script setup lang="ts">
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { ref } from "vue";
import { useAuthStore } from "@/stores/auth";
import { utilsStore } from "@/stores/utils";
import { useRouter } from "vue-router";

import { useForm } from "vee-validate";
import { useSettingStore } from "@/stores/setting";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { logoFaskes } from "@/utils/tema";

const router = useRouter();
const authStore = useAuthStore();
const UseUtilsStore = utilsStore();
const settingStore = useSettingStore();

const schema = toTypedSchema(
  yup.object({
    username: yup.string().required("Username harus diisi"),
    password: yup.string().required("Password harus diisi"),
  })
);

const { errors, handleSubmit, defineField, resetForm, setValues } = useForm({
  validationSchema: schema,
});
const onSubmit = handleSubmit(async (values) => {
  UseUtilsStore.setLoading(true);
  try {
    await authStore.loginApi(values);
    const userData = JSON.parse(localStorage.getItem("user") ?? "");
    if (userData.faskesUuid) {
      await fetchSettingProfilFaskesData();
    }
    router.push("dashboard");
  } catch (error: any) {
    console.log(error.message);
  } finally {
    UseUtilsStore.setLoading(false);
  }
});
const [username] = defineField("username");
const [password] = defineField("password");

const device = ref(["iMac", "iPad", "MacBook"]);
const showPassword = ref(false);

const getImage = (image: string) => {
  const imgUrl = new URL(`../assets/images/Login/${image}.png`, import.meta.url)
    .href;
  return imgUrl;
};

const fetchSettingProfilFaskesData = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await settingStore.getProfilFaskesApi();
    if (response) {
      UseUtilsStore.setProfilFaskes(response);
    } else {
      console.error("Unexpected response Structure", response);
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
  }
};
</script>

<template>
  <div class="absolute top-0 bottom-0 left-0 right-0 overflow-auto login-bg">
    <div class="flex flex-col h-full md:flex-row">
      <div
        class="w-full md:w-1/3 pl-10 pr-10 xl:pr-[80px] 2xl:pr-[200px] bg-opensimrs-300/60 py-[5%] text-white flex flex-col justify-between"
      >
        <div>
          <img
            src="../assets/images/opensimrs-white.png"
            alt="Logo OpenSIMRS"
            class="h-[50px]"
          />
          <hr class="h-[1.5px] mt-[10px]" />
          <div class="">
            <div class="font-bold text-subTitle">Clinic</div>
            <div class="text-heading">Information</div>
            <div class="text-heading">System</div>
          </div>
        </div>
        <Carousel
          :value="device"
          circular
          :autoplayInterval="3000"
          :showNavigators="false"
        >
          <template #item="slotProps">
            <img
              :src="getImage(slotProps.data)"
              :alt="'Data' + slotProps.data"
              class="h-[250px] mx-auto"
            />
          </template>
        </Carousel>
      </div>
      <div class="flex-grow">
        <div class="flex justify-center h-full">
          <Card
            class="w-[400px] lg:w-[480px] xl:w-1/2 rounded-[20px] h-[484px] self-center mb-32 md:mb-0"
          >
            <template #title>
              <!-- Logo faskes terakhir yang login di perangkat ini (Setting › Logo & Warna) -->
              <img
                v-if="logoFaskes()"
                :src="logoFaskes()!"
                alt="Logo faskes"
                class="h-[144px] max-w-full mx-auto object-contain"
              />
              <img
                v-else
                src="../assets/images/opensimrs-square.png"
                alt=""
                class="h-[144px] mx-auto"
              />
            </template>
            <template #content>
              <form class="px-5" @keydown.enter="onSubmit">
                <CustomTextfield
                  v-model="username"
                  label="Username"
                  class="mb-[10px]"
                  placeholder="Username"
                  :invalid="errors.username ? true : false"
                  :invalidMessage="errors.username"
                ></CustomTextfield>
                <CustomTextfield
                  v-model="password"
                  label="Password"
                  placeholder="********"
                  :type="showPassword ? 'text' : 'password'"
                  :invalid="errors.password ? true : false"
                  :invalidMessage="errors.password"
                  :appendIcon="showPassword ? 'PhEyeSlash' : 'PhEye'"
                  @clickAppend="showPassword = !showPassword"
                ></CustomTextfield>
                <CustomButton
                  @click="onSubmit"
                  label="LOGIN"
                  full
                  class="mt-5"
                />
              </form>
            </template>
          </Card>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.login-bg {
  background: url("@/assets/images/loginBG.svg") no-repeat;
  background-size: cover;
}
</style>
