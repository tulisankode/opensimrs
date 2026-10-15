<script lang="ts" setup>
import { ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { useGeneralConsentStore } from "@/stores/datamaster/generalConsent";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomCkEditor from "@/components/Base/CustomCkEditor.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";

const props = defineProps({
  isDialogVisible: {
    default: false,
  },
  title: {
    type: String,
  },
  method: {
    type: String,
  },
  payload: {
    type: Object,
    default: () => ({}),
  },
});

const schema = toTypedSchema(
  yup
    .object({
      code: yup.string().required("Kode General Consent harus diisi"),
      name: yup.string().required("Nama General Consent harus diisi"),
      isiSurat: yup.string().required("Isi General consent harus diisi"),
      status: yup.bool().default(true),
    })
    .noUnknown()
);

const { errors, handleSubmit, defineField, resetForm, setValues } = useForm({
  validationSchema: schema,
});

const generalConsentStore = useGeneralConsentStore();

const [code] = defineField("code");
const [name] = defineField("name");
const [isiSurat] = defineField("isiSurat");
const [status] = defineField("status");

const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);

const onSubmit = handleSubmit(async (values: any) => {
  try {
    if (method.value === "edit") {
      if (!props.payload || !props.payload.uuid) {
        throw new Error("UUID is missing for edit operation");
      }
      const uuid = props.payload.uuid;
      const response = await generalConsentStore.putApi(uuid, values);
      console.log("Data updated successfully:", response);
      emit("data-updated");
    } else if (method.value === "add") {
      console.log("Adding new data with values:", values);
      const response = await generalConsentStore.postApi(values);
      emit("data-updated");
    }
    closeDialog();
  } catch (error) {
    console.error("Failed to process the data:", error);
  }
});

const method = ref(props.method);
const title = ref(props.title);

const updateVisibility = (value: any) => {
  emit("update:isDialogVisible", value);
};

const resetDialogMode = () => {
  method.value = props.method;
  title.value = props.title;
};

const handleEdit = () => {
  method.value = "edit";
  title.value = "Edit Data";
};

const closeDialog = () => {
  emit("update:isDialogVisible", false);
  resetDialogMode();
  resetForm();
};

watch(
  () => props.isDialogVisible,
  (newValue) => {
    if (newValue) {
      resetDialogMode();
      if (props.method !== "add" && props.payload) {
        setValues({
          ...props.payload,
        });
      }
    } else {
      resetForm();
      resetDialogMode();
    }
  }
);
</script>
<template>
  <CustomDialog
    width="1000px"
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    headerBg="bg-opensimrs-300"
  >
    <template #header>{{ title }}</template>
    <template #body>
      <!-- Form Input -->
      <div v-if="method !== 'detail'">
        <div class="grid grid-cols-12 gap-5 mt-5">
          <CustomTextfield
            v-model="code"
            label="Kode General Consent"
            placeholder="Kode General Consent"
            class="col-span-4"
            :invalid="!!errors.code"
            :invalidMessage="errors.code"
            :required="errors.code ? true : false"
          />

          <CustomTextfield
            label="Nama General Consent"
            v-model="name"
            placeholder="Nama General Consent"
            class="col-span-8"
            :invalid="!!errors.name"
            :invalidMessage="errors.name"
            :required="errors.name ? true : false"
          />
          <CustomAccordion
            initialState="0"
            class="col-span-12 mb-5 text-normal"
            noBorder
          >
            <template #header>
              <div class="-ml-4">Text Formating</div></template
            >
            <template #content>
              <div
                class="flex justify-between bg-opensimrs-50 mt-2.5 p-4 rounded-[10px] -m-4 gap-40"
              >
                <div class="w-1/2">
                  <div class="mb-2">
                    Field dinamis diharap menggunakan penanda

                    <span v-pre class="font-bold">{{}}</span>, contoh :
                    <hr class="border-grey-200 my-2.5" />
                  </div>
                  <div v-pre>Nama : {{ nama }}</div>
                  <div v-pre>Alamat : {{ alamat }}</div>
                  <div v-pre>No. Telepon : {{ telepon }}</div>
                </div>
                <div class="w-1/2">
                  <div class="">list data dinamis</div>
                  <hr class="border-grey-200 my-2.5" />
                  <div class="">
                    <ol class="grid grid-flow-col grid-rows-4 grid-cols-">
                      <li>1. nama</li>
                      <li>2. alamat</li>
                      <li>3. umur</li>
                      <li>4. tindakan</li>
                      <li>5. nama_wali</li>
                      <li>6. jenis_kelamin_wali</li>
                      <li>7. alamat_wali</li>
                      <li>8. hubungan_dengan_pasien</li>
                    </ol>
                  </div>
                </div>
              </div>
            </template>
            <template #collapseIcon>
              <CustomButton
                icon="PhCaretUp"
                backgroundColor="bg-transparent"
                textColor="text-opensimrs-300"
              />
            </template>
            <template #expandIcon>
              <CustomButton
                icon="PhCaretDown"
                backgroundColor="bg-transparent"
                textColor="text-opensimrs-300"
              />
            </template>
          </CustomAccordion>
        </div>
        <CustomCkEditor
          v-model="isiSurat"
          label="Isi General Consent"
          :invalid="!!errors.isiSurat"
          :invalidMessage="errors.isiSurat"
          :required="errors.isiSurat ? true : false"
          placeholder="Isi General Consent"
        />

        <hr class="col-span-12 my-5 border-grey-200" />
        <CustomSwitch v-model="status" label="Status" class="col-span-12" />
      </div>

      <!-- Detail Data -->
      <div v-if="method === 'detail'" class="flex flex-col gap-5 mt-5">
        <CustomInfoRow label="Kode General Consent" :value="code" />
        <CustomInfoRow label="Nama General Consent" :value="name" />
        <hr class="col-span-12 border-grey-200" />
        <div class="text-normal" v-html="payload.isiSurat"></div>
        <hr class="col-span-12 border-grey-200" />
        <CustomInfoRow label="Status">
          <template #value>
            <CustomChip
              :label="status ? 'AKTIF' : 'NON-AKTIF'"
              :textColor="status ? 'text-white' : 'text-[#80868d]'"
              :bgColor="status ? 'bg-opensimrs-300' : 'bg-white'"
              :borderColor="status ? 'border-none' : 'border-[#80868d]'"
              :icon-color="status ? 'white' : '#80868d'"
              customClass="text-xs font-semibold h-5 flex w-fit"
            />
          </template>
        </CustomInfoRow>
      </div>
    </template>
    <template #footer>
      <div class="w-full">
        <div class="mt-5 flex justify-end gap-2.5">
          <CustomButton
            v-if="method !== 'detail'"
            label="Batal"
            border-color="border-grey-200"
            background-color="bg-white"
            text-color="text-grey-300"
            @click="closeDialog"
          />
          <CustomButton
            v-if="method !== 'detail'"
            label="Simpan"
            @click="onSubmit"
          />
          <CustomButton
            v-if="method === 'detail'"
            label="Edit"
            @click="handleEdit"
          />
        </div>
      </div>
    </template>
  </CustomDialog>
</template>
