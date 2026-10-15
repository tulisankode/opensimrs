<script lang="ts" setup>
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import { useForm, useFieldArray, ErrorMessage } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { computed, ref, type PropType } from "vue";

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
  },
  obatToEdit: Object,
  index: {
    type: Number,
    default: null,
  },
  dataAlkes: {
    type: Array as PropType<any>,
    default: () => [],
  },
});

const emit = defineEmits(["update:isDialogVisible", "add-alkes"]);

function updateVisibility(value: boolean) {
  emit("update:isDialogVisible", value);
}

const tambahAlkesMultipleSchema = toTypedSchema(
  yup.object({
    datas: yup.array().of(
      yup.object({
        listAlkes: yup.mixed<any>().required("List tindakan harus diisi"),
      })
    ),
  })
);

const { errors, handleSubmit, resetForm, defineField } = useForm({
  validationSchema: tambahAlkesMultipleSchema,
  initialValues: {
    datas: [],
  },
});

const { remove, push, fields } = useFieldArray("datas");

const filteredOptions = computed(() => {
  const selectedUuids = fields.value.map((field) => (field.value as any).listAlkes?.uuid);
  return props.dataAlkes.filter((option: any) => {
    return !selectedUuids.includes(option.uuid);
  });
});

// const listAlkes = ref([
//   { id: "1", value: "Kasa" },
//   { id: "2", value: "Perban" },
//   { id: "2", value: "Pil" },
// ]);

const selectedItem = ref("");

function addItemToDataTable() {
  if (selectedItem.value) {
    push({
      listAlkes: selectedItem.value,
    });
    selectedItem.value = "";
  }
}

const onSubmitTambahAlkesMultiple = handleSubmit((values: any) => {
  emit("add-alkes", values.datas);
  console.log(values.datas);
  resetForm();
  emit("update:isDialogVisible", false);
});
</script>

<template>
  <CustomDialog
    width="800px"
    class=""
    :visible="isDialogVisible"
    headerBg="bg-opensimrs-300"
    @update:visible="updateVisibility"
  >
    <template #header> {{ title }} </template>
    <template #body>
      <div class="flex flex-col gap-5 mt-5">
        <div class="flex items-end w-full gap-5">
          <CustomSelect
            prepend-icon="PhMagnifyingGlass"
            label="Cari Item"
            place-holder="Cari Item"
            class="grow"
            :options="filteredOptions" 
            optionLabel="name"
            optionValue=""
            dataKey="uuid"
            v-model="selectedItem"
          >
            <template #customOptions="{ option }">
              {{ option.name }} 
              {{ option.bentukSediaan?.name }}
              {{ option.manufacture ? `- ${option.manufacture.name}` : "" }}
            </template>
          </CustomSelect>
          <CustomButton @click="addItemToDataTable">
            <PhPlus :size="16" />
          </CustomButton>
        </div>
        <DataTable
          tableStyle="min-width: 40rem"
          :value="fields"
          stripedRows
          class="text-xs"
          scrollable
          scrollHeight="flex"
        >
          <Column headerClass="bg-opensimrs-50">
            <template #header>
              <div class="w-full font-semibold text-center">No.</div>
            </template>
            <template #body="slotProps">
              <div class="flex items-center justify-center">
                {{ slotProps.index + 1 }}
              </div>
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50" class="w-[70%]">
            <template #header>
              <div class="font-semibold">Nama Alkes</div>
            </template>
            <template #body="slotProps">
              {{ slotProps.data.value.listAlkes?.name }}
            </template>
          </Column>
          <!-- <Column headerClass="bg-opensimrs-50" class="w-[300px]">
            <template #header>
              <div class="font-semibold">Sisa Stok</div>
            </template>
            <template #body="slotProps">
              {{ slotProps.data.listAlkes?.sisaStok ?? " Statis" }}
            </template>
          </Column> -->
          <Column headerClass="bg-opensimrs-50">
            <template #header>
              <div
                class="flex items-center justify-center w-full font-semibold text-SM"
              >
                Action
              </div>
            </template>
            <template #body="slotProps">
              <div class="flex items-center gap-2.5 justify-center">
                <CustomButton
                  label=""
                  background-color="bg-danger-300 rounded-lg"
                  class="h-6 w-[26px] p-0"
                  @click="remove(slotProps.index)"
                >
                  <img src="@/assets/icons/delete.svg" alt="" />
                </CustomButton>
              </div>
            </template>
          </Column>
        </DataTable>
        <hr class="border-grey-200" />
        <div class="font-semibold text-MD">
          Total Item Terpilih : {{ fields.length }}
        </div>
      </div>
    </template>
    <template #footer>
      <div class="w-full">
        <hr class="-mx-5 border-grey-200" />
        <div class="mt-5 flex justify-end gap-2.5">
          <CustomButton
            label="Hapus Semua"
            border-color=" border-2 border-danger-300"
            background-color="bg-white"
            text-color="text-danger-300"
            @click="resetForm"
          >
          </CustomButton>
          <CustomButton label="Ambil Item" @click="onSubmitTambahAlkesMultiple">
          </CustomButton>
        </div>
      </div>
    </template>
  </CustomDialog>
</template>
