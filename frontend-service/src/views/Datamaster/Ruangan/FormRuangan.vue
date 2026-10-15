<script lang="ts" setup>
import { ref, watch,onMounted,computed } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { useKategoriRuanganStore } from "@/stores/datamaster/kategoriRuangan";
import { useRuanganStore } from "@/stores/datamaster/ruangan";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomChip from "@/components/Base/CustomChip.vue";

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


const kategoriRuanganStore = useKategoriRuanganStore();
const ruanganStore = useRuanganStore();
const kategoriRuanganPayload = ref<any[]>([]); 

const fetchKategoriRuangan = async () => {
  try {
    const response = await kategoriRuanganStore.getAktifApi();
    if (response && response.payload) {
      kategoriRuanganPayload.value = response.payload;
    } else {
      kategoriRuanganPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch kategori ruangan", error);
    kategoriRuanganPayload.value = [];
  }
};
onMounted(() => {
  fetchKategoriRuangan();
});
const optionsKelas = ref([
  { label: "kelas 1", value: 1 },
  { label: "kelas 2", value: 2 },
  { label: "kelas 3", value: 3 },
  { label: "VIP", value: 4 },
  { label: "VVIP", value: 5 },
]);

const schema = toTypedSchema(
  yup.object({
    code: yup.string().required("Kode Ruangan harus diisi"),
    name: yup.string().required("Nama Ruangan harus diisi"),
    kategoriRuanganUuid: yup.string().required("Kategori Ruangan harus dipilih"),
    noRoom: yup.number().required("Nomor Kamar harus diisi"),
    kelasRuangan: yup.number().required("Kelas Ruangan harus dipilih"),
    status: yup.bool().default(true),
  }).noUnknown()
);

const { errors, handleSubmit, defineField, resetForm, setValues } = useForm({
  validationSchema: schema,
});

const [code] = defineField("code");
const [name] = defineField("name");
const [kategoriRuanganUuid] = defineField("kategoriRuanganUuid");
const [noRoom] = defineField("noRoom");
const [kelasRuangan] = defineField("kelasRuangan");
const [status] = defineField("status");

const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);

const onSubmit = handleSubmit(async (values: any) => {
  try {
    if (method.value === "edit") {
      if (!props.payload || !props.payload.uuid) {
        throw new Error("UUID is missing for edit operation");
      }
      const uuid = props.payload.uuid;
      const response = await ruanganStore.putApi(uuid, values);
      console.log("Data updated successfully:", response);
      emit("data-updated");
    } else if (method.value === "add") {
      console.log("Adding new data with values:", values);
      const response = await ruanganStore.postApi(values);
      emit("data-updated");
    }
    closeDialog();
  } catch (error) {
    console.error("Failed to process the data:", error);
  }
});



const method = ref(props.method);
const title = ref(props.title);

const updateVisibility= (value: any) => {
  emit("update:isDialogVisible", value);
}

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

const kelasRuanganLabel = computed(() => {
  const selectedKelas = optionsKelas.value.find(option => option.value === props.payload.kelasRuangan);
  return selectedKelas ? selectedKelas.label : "";
});


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
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    width="600px"
    headerBg="bg-opensimrs-300"
  >
    <template #header>{{ title }} Ruangan</template>
    <template #body>
       <!-- Form Input -->
      <div  v-if="method !== 'detail'" class="grid grid-cols-12 gap-5 mt-5">
          <CustomTextfield
            label="Kode Ruangan"
            v-model="code"
            placeholder="Kode Ruangan"
            :invalid="!!errors.code"
            :invalidMessage="errors.code"
            class="col-span-4"
            :required="errors.code ? true : false"

          />
          <CustomTextfield
            label="Nama Ruangan"
            v-model="name"
            placeholder="Nama Ruangan"
            :invalid="!!errors.name"
            :invalidMessage="errors.name"
            class="col-span-8"
            :required="errors.name ? true : false"

          />
          <CustomSelect
            label="Kategori Ruangan"
            v-model="kategoriRuanganUuid"
            :options="kategoriRuanganPayload"
            optionValue="uuid"
            optionLabel="name"
            place-holder="Pilih Kategori Ruangan"
            class="col-span-8"
            :invalid="!!errors.kategoriRuanganUuid"
            :invalidMessage="errors.kategoriRuanganUuid"
            :required="errors.kategoriRuanganUuid ? true : false"

          />
          <CustomInputNumber
            label="Nomor Kamar"
            v-model="noRoom"
            :invalid="!!errors.noRoom"
            :invalidMessage="errors.noRoom"
            class="col-span-4"
            :required="errors.noRoom ? true : false"

          />
        <CustomSelect
          label="Kelas Ruangan"
          v-model="kelasRuangan"
          :options="optionsKelas"
          optionValue="value"
          optionLabel="label"
          place-holder="Pilih Kelas Ruangan"
          class="col-span-12"
          :invalid="!!errors.kelasRuangan"
          :invalidMessage="errors.kelasRuangan"
          :required="errors.kelasRuangan ? true : false"

        />

        <hr class="col-span-12 border-grey-200" />
        <CustomSwitch
          v-model="status"
          :show-label="true"
          label="Status"
          sideLabel="NON-AKTIF"
          sideLabelTrue="AKTIF"
          class="col-span-12"
        />
      </div>
      <!-- Detail Data -->
      <div v-if="method === 'detail'" class="flex flex-col gap-5 mt-5">
        <CustomInfoRow label="Kode Ruangan" :value="code" />
        <CustomInfoRow label="Nama Ruangan" :value="name" />
        <CustomInfoRow label="Kategori Ruangan" :value="payload.kategoriRuanganName" />
        <CustomInfoRow label="No. Kamar" :value="`${noRoom}`" />
        <CustomInfoRow label="Kelas Ruangan" :value="kelasRuanganLabel" />
        <hr class="border-grey-200" />
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
