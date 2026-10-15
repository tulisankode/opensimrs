<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { useKategoriGigiStore } from "@/stores/datamaster/kategoriGigi";
import { useItemGigiStore } from "@/stores/datamaster/itemGigi";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDragDrop from "@/components/Base/CustomDragDrop.vue";
import NoData from "@/components/section/NoData.vue";

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

const kategoriGigiStore = useKategoriGigiStore();
const itemGigiStore = useItemGigiStore();
const kategoriGigiPayload = ref<any[]>([]);
const fetchKategoriGigi = async () => {
  try {
    const response = await kategoriGigiStore.getApi();
    if (response && response.payload) {
      kategoriGigiPayload.value = response.payload;
    } else {
      kategoriGigiPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch kategori ruangan", error);
    kategoriGigiPayload.value = [];
  }
};

onMounted(() => {
  fetchKategoriGigi();
});

const schema = toTypedSchema(
  yup
    .object({
      kategoriGigiUuid: yup.string().required("Kategori Gigi harus dipilih"),
      system: yup.string().required("Referensi sistem SATUSEHAT harus diisi"),
      code: yup.string().required("Kode SATUSEHAT harus diisi"),
      display: yup.string().required("Display SATUSEHAT harus diisi"),
      name: yup.string().required("Nama Gigi harus diisi"),
      image: yup.string().notRequired(),
      catatan: yup.string().notRequired(),
      status: yup.bool().default(true),
    })
    .noUnknown()
);

const { errors, handleSubmit, defineField, resetForm, setValues } = useForm({
  validationSchema: schema,
});

const [display] = defineField("display");
const [system] = defineField("system");
const [code] = defineField("code");
const [name] = defineField("name");
const [image] = defineField("image");
const [kategoriGigiUuid] = defineField("kategoriGigiUuid");
const [catatan] = defineField("catatan");
const [status] = defineField("status");

const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);

const onSubmit = handleSubmit(async (values: any) => {
  try {
    if (method.value === "edit") {
      if (!props.payload || !props.payload.uuid) {
        throw new Error("UUID is missing for edit operation");
      }
      const uuid = props.payload.uuid;
      const response = await itemGigiStore.putApi(uuid, values);
      console.log("Data updated successfully:", response);
      emit("data-updated");
    } else if (method.value === "add") {
      console.log("Adding new data with values:", values);
      const response = await itemGigiStore.postApi(values);
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

const itemGigiUpload = ref<InstanceType<typeof CustomDragDrop> | null>(null);
const clearItemGigiPreview = () => {
  image.value = "";
  if (itemGigiUpload.value) {
    itemGigiUpload.value.clearFile();
  }
};
</script>

<template>
  <CustomDialog
    :width="
      method === 'add'
        ? '800px'
        : method === 'edit'
        ? '800px'
        : method === 'detail'
        ? '600px'
        : '360px'
    "
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    headerBg="bg-opensimrs-300"
  >
    <template #header>{{ title }}</template>

    <!-- BODY CONTENT -->
    <template #body>
      <!-- Kondisi untuk 'add' dan 'edit' -->
      <div
        v-if="method === 'add' || method === 'edit'"
        class="flex flex-col gap-5 mt-5"
      >
        <div class="grid grid-cols-2 gap-5">
          <div
            class="flex grid flex-col gap-5 pb-5 pr-5 border-r border-opensimrs-300"
          >
            <CustomSelect
              label="Kategori Gigi"
              place-holder="Pilih Kategori Gigi"
              v-model="kategoriGigiUuid"
              :options="kategoriGigiPayload"
              optionValue="uuid"
              optionLabel="name"
              :invalid="!!errors.kategoriGigiUuid"
              :invalidMessage="errors.kategoriGigiUuid"
              :required="errors.kategoriGigiUuid ? true : false"
            />
            <CustomTextfield
              label="Referensi Sistem SATUSEHAT"
              v-model="system"
              placeholder="Masukkan Referensi sistem SATUSEHAT"
              :invalid="!!errors.system"
              :invalidMessage="errors.system"
              :required="errors.system ? true : false"
            />
            <CustomTextfield
              label="Code SATUSEHAT"
              v-model="code"
              placeholder="Masukkan Code SATUSEHAT"
              :invalid="!!errors.code"
              :invalidMessage="errors.code"
              :required="errors.code ? true : false"
            />
            <CustomTextfield
              label="Display SATUSEHAT"
              v-model="display"
              placeholder="Masukkan Display SATUSEHAT"
              :invalid="!!errors.display"
              :invalidMessage="errors.display"
              :required="errors.display ? true : false"
            />
            <CustomTextfield
              label="Nama Item Gigi"
              v-model="name"
              placeholder="Masukkan Nama Item Gigi"
              :invalid="!!errors.name"
              :invalidMessage="errors.name"
              :required="errors.name ? true : false"
            />
            <CustomTextArea
              label="Catatan"
              v-model="catatan"
              placeholder="Masukkan Catatan"
            />
          </div>

          <div>
            <div class="flex justify-between">
              <div class="font-semibold text-normal">Upload & Preview</div>
              <CustomButton
                v-if="image"
                label="Hapus Gambar"
                backgroundColor="bg-danger-50"
                textColor="text-danger-300"
                icon="PhTrash"
                @click="clearItemGigiPreview"
                size="small"
              />
            </div>
            <CustomDragDrop
              v-if="!image"
              v-model="image"
              :allowed-file-types="['image/png']"
              class="h-[400px]"
              ref="itemGigiUpload"
            />
            <div
              v-if="image"
              class="bg-opensimrs-300 h-[400px] flex items-center justify-center mt-5 rounded-md"
            >
              <img :src="image" />
            </div>
            <div v-if="errors.image" class="text-SM text-danger-300">
              {{ errors.image }}
            </div>
          </div>
        </div>
        <hr class="col-span-2 border-gray-200" />
        <!-- <CustomSwitch
          v-model="status"
          :show-label="true"
          label="Status"
          sideLabel="NON-AKTIF"
          sideLabelTrue="AKTIF"
          class="col-span-2"
        /> -->
      </div>

      <!-- Kondisi untuk 'preview' -->
      <div
        v-if="method === 'preview'"
        class="flex items-center justify-center w-full"
      >
        <div
          v-if="image"
          class="flex items-center justify-center mt-5 border-2 border-dashed rounded-md border-opensimrs-300 bg-opensimrs-50 w-fit h-fit"
        >
          <img :src="image" class="w-[80px] h-[80px] m-2.5" />
        </div>
        <div v-else class="mt-5">
          <NoData />
        </div>
      </div>

      <!-- Kondisi untuk 'detail' -->
      <div v-if="method === 'detail'" class="flex flex-col gap-5 mt-5">
        <CustomInfoRow
          label="Kategori Gigi"
          :value="payload.kategoriGigi.name"
        />
        <CustomInfoRow
          label="Referensi Sistem SATUSEHAT"
          :value="payload.system"
        />
        <CustomInfoRow label="Code SATUSEHAT" :value="payload.code" />
        <CustomInfoRow label="Display SATUSEHAT" :value="payload.display" />
        <CustomInfoRow label="Nama Item Gigi" :value="payload.name" />
        <CustomInfoRow
          label="Catatan"
          :value="
            payload.catatan && payload.catatan != '' ? payload.catatan : '-'
          "
        />
        <hr class="border-grey-200" />
        <!-- <CustomInfoRow label="Status" :value="payload.status">
          <template #value>
            <CustomChip
              :label="payload.status ? 'AKTIF' : 'NON-AKTIF'"
              :textColor="payload.status ? 'text-white' : 'text-[#80868d]'"
              :bgColor="payload.status ? 'bg-opensimrs-300' : 'bg-white'"
              :borderColor="payload.status ? 'border-none' : 'border-[#80868d]'"
              :icon-color="payload.status ? 'white' : '#80868d'"
              customClass="text-xs font-semibold h-5 flex w-fit"
            />
          </template>
        </CustomInfoRow> -->
        <CustomInfoRow label="Preview Gigi">
          <template #value>
            <div
              v-if="image"
              class="flex items-center justify-center border-2 border-dashed rounded-md border-opensimrs-300 bg-opensimrs-50 w-fit h-fit"
            >
              <img :src="image" class="w-[80px] h-[80px] m-2.5" />
            </div>
            <div v-else>-</div>
          </template>
        </CustomInfoRow>
      </div>
    </template>

    <!-- FOOTER -->
    <template #footer v-if="method !== 'preview'">
      <div class="flex justify-end space-x-3">
        <CustomButton
          v-if="method === 'add' || method === 'edit'"
          border-color="border-grey-200"
          text-color="text-grey-300"
          background-color="bg-transparent"
          label="Reset"
          @click="resetForm()"
        ></CustomButton>
        <CustomButton
          v-if="method === 'add' || method === 'edit'"
          label="Simpan"
          @click="onSubmit"
        ></CustomButton>
        <CustomButton
          v-if="method === 'detail'"
          label="Edit"
          @click="handleEdit"
        ></CustomButton>
      </div>
    </template>
  </CustomDialog>
</template>
