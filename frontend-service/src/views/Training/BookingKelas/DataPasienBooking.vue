<script setup lang="ts">
import { ref } from "vue";
import * as yup from "yup";
import { toTypedSchema } from "@vee-validate/yup";
import { useForm } from "vee-validate";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomChip from "@/components/Base/CustomChip.vue";

const dataBreadCrumb = ref([{ label: "Daftar" }]);
const emit = defineEmits(["back"]);
const schema = toTypedSchema(
  yup
    .object({
      patientUuid: yup.string(),
      noRm: yup.string(),
      title: yup.string().required("Awalan/Gelar harus dipilih"),
      name: yup.string().required("Nama lengkap harus diisi"),
      identity: yup.string().required("Identitas harus dipilih"),
      noIdentity: yup.string().required("No identitas harus diisi"),
      birthDetail: yup
        .object({
          birthPlace: yup.string().required("Tempat lahir harus diisi"),
          birthDate: yup.date().required("Tanggal lahir harus dipilih"),
        })
        .noUnknown(),
      gender: yup.string().required("Jenis kelamin harus dipilih"),
      phone: yup.string().required("No. Handphone harus diisi"),
      religion: yup.string().required("Agama harus dipilih"),
      language: yup.string().required("Bahasa yang dikuasai harus dipilih"),
      maritialStatus: yup.string().required("Status pernikahan harus dipilih"),
      motherName: yup.string().required("Nama ibu kandung harus diisi"),
      address: yup
        .object({
          prov: yup.string().required("Provinsi harus dipilih"),
          city: yup.string().required("Kabupaten / Kota harus dipilih"),
          district: yup.string().required("Kecamatan harus dipilih"),
          rt: yup.string().required("RT harus diisi"),
          rw: yup.string().required("RW harus diisi"),
          fullAddress: yup.string().required("Alamat harus diisi"),
          country: yup.string().required("Negara harus diisi"),
          village: yup.string().required("Kelurahan / Desa harus dipilih"),
          postalCode: yup.string().required("Kode Pos harus dipilih"),
        })
        .noUnknown(),
    })
    .noUnknown()
);

const { errors, handleSubmit, defineField, resetForm, setValues } = useForm({
  validationSchema: schema,
});

const [noRm] = defineField("noRm");
const [title] = defineField("title");
const [name] = defineField("name");
const [identity] = defineField("identity");
const [noIdentity] = defineField("noIdentity");
const [birthDetailPlace] = defineField("birthDetail.birthPlace");
const [birthDetailDate] = defineField("birthDetail.birthDate");
const [gender] = defineField("gender");
const [phone] = defineField("phone");
const [religion] = defineField("religion");
const [language] = defineField("language");
const [maritialStatus] = defineField("maritialStatus");
const [motherName] = defineField("motherName");
const [addressProv] = defineField("address.prov");
const [addressCity] = defineField("address.city");
const [addressDistrict] = defineField("address.district");
const [addressRt] = defineField("address.rt");
const [addressRw] = defineField("address.rw");
const [addressFullAddress] = defineField("address.fullAddress");
const [addressCountry] = defineField("address.country");
const [addressVillage] = defineField("address.village");
const [addressPostalCode] = defineField("address.postalCode");

const onSubmit = handleSubmit((values: any) => {
  console.log(values);
});
const selectedDataPatient = ref<any>();

</script>
<template>
  <div class="relative w-full overflow-hidden">
    <Card class="h-min mb-[10px] absolute right-0 left-0">
      <template #content>
        <div class="flex justify-between">
          <CustomBreadCrumb
            :home="{
              label: 'Booking Kelas',
              home: true,
            }"
            :model="[
              {
                label: 'Cari Jadwal & Kelas',
              },
              ...dataBreadCrumb,
            ]"
            class="grow"
          />
          <CustomButton
            label="Kembali"
            icon="PhCaretLeft"
            @click="emit('back')"
            background-color="bg-white"
            border-color="border-opensimrs-300"
            text-color="text-opensimrs-300"
          />
        </div>
      </template>
    </Card>
    <div class="relative h-full overflow-auto top-[100px] pb-[180px]">
      <CustomAccordion noBorder initial-state="0">
        <template #header>
          <div class="flex justify-between w-full align-middle">
            <div class="flex">
              <span class="leading-10 text-opensimrs-300 text-heading">
                Jadwal Terpilih
              </span>
            </div>
          </div>
        </template>
        <template #content>
          <div class="pt-5 grid grid-cols-4">
            <div class="flex flex-col">
              <div class="font-semibold underline text-SM">Tanggal Kelas</div>
              <div class="font-normal text-normal">01-01-2024</div>
            </div>
            <div class="flex flex-col">
              <div class="font-semibold underline text-SM">Kelas</div>
              <div class="font-normal text-normal">Zumba</div>
            </div>
            <div class="flex flex-col">
              <div class="font-semibold underline text-SM">Sesi</div>
              <div class="font-normal text-normal">Sesi 1</div>
            </div>
            <div class="flex flex-col">
              <div class="font-semibold underline text-SM">Slot</div>
              <div class="font-normal text-normal">Slot 1</div>
            </div>
          </div>
        </template>
        <template #collapseIcon>
          <CustomButton
            icon="PhCaretUp"
            backgroundColor="bg-opensimrs-75"
            textColor="text-opensimrs-300"
          />
        </template>
        <template #expandIcon>
          <CustomButton
            icon="PhCaretDown"
            backgroundColor="bg-opensimrs-75"
            textColor="text-opensimrs-300"
        /></template>
      </CustomAccordion>
      <CustomAccordion noBorder initial-state="0" class="mb-2.5">
        <template #header>
          <div class="flex justify-between w-full align-middle">
            <div class="flex">
              <span class="leading-10 text-opensimrs-300 text-heading">
                Identitas Pasien
              </span>
            </div>
          </div>
        </template>
        <template #content>
          <div class="grid grid-cols-12 gap-5 pt-5 items-end">
            <CustomSelect
              v-model="selectedDataPatient"
              place-holder="Cari Nama/No. RM"
              label="Cari Nama/No.RM"
              class="border-r pr-5 border-grey-200 col-span-9"
            />
            <CustomTextfield
              v-model="noRm"
              label="No. RM"
              class="col-span-3"
              placeholder="No. RM"
              readOnly
            />
            <hr class="col-span-12" />
            <CustomSelect
              v-model="title"
              label="Awalan / Gelar"
              placeHolder="Pilih Awalan / Gelar"
              class="col-span-3"
              optionLabel=""
              optionValue=""
              :showFilter="false"
              :options="[
                'Tn. (Tuan)',
                'Ny. (Nyonya)',
                'Sdr. (Saudara)',
                'Nn. (Nona)',
                'An. (Anak)',
                'By. (Bayi)',
              ]"
              :invalid="!!errors.title"
              :invalidMessage="errors.title"
            />
            <CustomTextfield
              v-model="name"
              label="Nama Lengkap"
              class="col-span-4"
              placeholder="Nama Lengkap"
              :invalid="!!errors.name"
              :invalidMessage="errors.name"
            />
            <CustomSelect
              v-model="identity"
              label="Identitas"
              placeHolder="Pilih Identitas"
              class="col-span-2"
              optionLabel=""
              optionValue=""
              :showFilter="false"
              :options="['KTP', 'Passport', 'SIM', 'Lainya']"
              :invalid="!!errors.identity"
              :invalidMessage="errors.identity"
            />
            <CustomTextfield
              v-model="noIdentity"
              label=" "
              class="col-span-3"
              placeholder="KTP"
              :invalid="!!errors.noIdentity"
              :invalidMessage="errors.noIdentity"
            />
            <CustomTextfield
              v-model="birthDetailPlace"
              label="Tempat Lahir"
              class="col-span-3"
              placeholder="Tempat Lahir"
              :invalid="!!errors['birthDetail.birthPlace']"
              :invalidMessage="errors['birthDetail.birthPlace']"
            />
            <CustomDatePicker
              v-model="birthDetailDate"
              label="Tanggal Lahir"
              placeHolder="01-01-2024"
              class="col-span-3"
              :invalid="!!errors['birthDetail.birthDate']"
              :invalidMessage="errors['birthDetail.birthDate']"
            />
            <CustomTextfield
              label="Umur"
              class="col-span-3"
              placeholder="Umur"
            />
            <CustomSelect
              v-model="gender"
              label="Jenis Kelamin"
              placeHolder="Pilih Jenis Kelamin"
              class="col-span-3"
              optionLabel="label"
              optionValue="value"
              :showFilter="false"
              :options="[
                { label: 'Laki-laki', value: 'Male' },
                { label: 'Perempuan', value: 'Female' },
              ]"
              :invalid="!!errors.gender"
              :invalidMessage="errors.gender"
            />
            <CustomTextfield
              v-model="phone"
              label="No. Handphone"
              class="col-span-3"
              placeholder="08XX-XXXX-XXXX"
              :invalid="!!errors.phone"
              :invalidMessage="errors.phone"
            />
            <CustomSelect
              v-model="religion"
              label="Agama"
              placeHolder="Pilih Agama"
              class="col-span-3"
              optionLabel=""
              optionValue=""
              :showFilter="false"
              :options="[
                'Islam',
                'Kristen',
                'Katolik',
                'Hindu',
                'Buddha',
                'Konghucu',
                'Lain-lain',
              ]"
              :invalid="!!errors.religion"
              :invalidMessage="errors.religion"
            />
            <CustomSelect
              v-model="addressCountry"
              label="Negara"
              placeHolder="Pilih Negara"
              class="col-span-3"
              optionLabel=""
              optionValue=""
              :showFilter="false"
              :options="['Indonesia', 'Jepang', 'Amerika Serikat']"
              :invalid="!!errors['address.country']"
              :invalidMessage="errors['address.country']"
            />
            <CustomSelect
              v-model="language"
              label="Bahasa yang Dikuasai"
              placeHolder="Pilih Bahasa yang Dikuasai"
              class="col-span-3"
              optionLabel=""
              optionValue=""
              :showFilter="false"
              :options="['Bahasa Indonesia', 'Bahasa Inggris', 'Bahasa Jawa']"
              :invalid="!!errors.language"
              :invalidMessage="errors.language"
            />
            <CustomSelect
              v-model="maritialStatus"
              label="Status Pernikahan"
              placeHolder="Pilih Status Pernikahan"
              class="col-span-3"
              optionLabel=""
              optionValue=""
              :showFilter="false"
              :options="['Belum Kawin', 'Kawin', 'Cerai Hidup', 'Cerai Mati']"
              :invalid="!!errors.maritialStatus"
              :invalidMessage="errors.maritialStatus"
            />
            <CustomTextfield
              v-model="motherName"
              label="Nama Ibu Kandung"
              class="col-span-9"
              placeholder="Nama Ibu Kandung"
              :invalid="!!errors.motherName"
              :invalidMessage="errors.motherName"
            />
            <hr class="col-span-12" />
            <CustomSelect
              v-model="addressProv"
              label="Provinsi"
              placeHolder="Pilih Provinsi"
              class="col-span-3"
              optionLabel=""
              optionValue=""
              :showFilter="false"
              :options="['DKI Jakarta', 'Jawa Barat', 'Jawa Timur']"
              :invalid="!!errors['address.prov']"
              :invalidMessage="errors['address.prov']"
            />
            <CustomSelect
              v-model="addressCity"
              label="Kabupaten / Kota"
              placeHolder="Pilih Kabupaten / Kota"
              class="col-span-3"
              optionLabel=""
              optionValue=""
              :showFilter="false"
              :options="['Kota Jakarta Pusat', 'Kota Bandung', 'Kota Surabaya']"
              :invalid="!!errors['address.city']"
              :invalidMessage="errors['address.city']"
            />
            <CustomSelect
              v-model="addressDistrict"
              label="Kecamatan"
              placeHolder="Pilih Kecamatan"
              class="col-span-3"
              optionLabel=""
              optionValue=""
              :showFilter="false"
              :options="[
                'Kecamatan Gambir',
                'Kecamatan Cidadap',
                'Kecamatan Wonokromo',
              ]"
              :invalid="!!errors['address.district']"
              :invalidMessage="errors['address.district']"
            />
            <CustomSelect
              v-model="addressVillage"
              label="Kelurahan / Desa"
              placeHolder="Pilih Kelurahan / Desa"
              class="col-span-3"
              optionLabel=""
              optionValue=""
              :showFilter="false"
              :options="[
                'Kelurahan Menteng',
                'Desa Ciburial',
                'Kelurahan Dukuh Menanggal',
              ]"
              :invalid="!!errors['address.village']"
              :invalidMessage="errors['address.village']"
            />
            <div class="flex col-span-3 gap-2.5">
              <CustomTextfield
                v-model="addressRt"
                label="RT"
                class=""
                placeholder="0"
                :invalid="!!errors['address.rt']"
                :invalidMessage="errors['address.rt']"
              />
              <CustomTextfield
                v-model="addressRw"
                label="RW"
                class=""
                placeholder="0"
                :invalid="!!errors['address.rw']"
                :invalidMessage="errors['address.rw']"
              />
            </div>
            <CustomSelect
              v-model="addressPostalCode"
              label="Kode Pos"
              placeHolder="Pilih Kode Pos"
              class="col-span-3"
              optionLabel=""
              optionValue=""
              :showFilter="false"
              :options="['10110', '40115', '60241']"
              :invalid="!!errors['address.postalCode']"
              :invalidMessage="errors['address.postalCode']"
            />
            <CustomTextArea
              v-model="addressFullAddress"
              label="Alamat"
              class="col-span-6"
              placeholder="Alamat"
              height="h-10"
              :invalid="!!errors['address.fullAddress']"
              :invalidMessage="errors['address.fullAddress']"
            />
          </div>
        </template>
        <template #collapseIcon>
          <CustomButton
            icon="PhCaretUp"
            backgroundColor="bg-opensimrs-75"
            textColor="text-opensimrs-300"
          />
        </template>
        <template #expandIcon>
          <CustomButton
            icon="PhCaretDown"
            backgroundColor="bg-opensimrs-75"
            textColor="text-opensimrs-300"
          />
        </template>
      </CustomAccordion>

    </div>
     <Card class="h-min mt-[10px] absolute bottom-0 right-0 left-0">
      <template #content>
        <div class="flex justify-end gap-2.5">
            <CustomButton
            label="Reset"
            class="mr-[10px]"
            outlined
            borderColor="border-grey-200"
            textColor="text-grey-300"
            @click="resetForm"
          />
          <CustomButton
            label="Simpan"
            class=""
            backgroundColor="bg-opensimrs-300"
            @click="onSubmit"
          />
        </div>
      </template>
    </Card>
  </div>
</template>
