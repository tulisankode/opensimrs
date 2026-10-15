<script lang="ts" setup>
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import { useForm, useFieldArray } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { ref, computed } from "vue";
import DataTable from "primevue/datatable";
import Column from "primevue/column";

const props = defineProps({
  isDialogVisible: { type: Boolean, default: false },
  kategoriItem: { type: String, default: "" },
  jenisStok: { type: String, default: "" },
  jenisItem: { type: String, default: "" },
  availableItems: { type: Array as () => any[], default: () => [] },
});

const emit = defineEmits(["update:isDialogVisible", "add-items"]);

function updateVisibility(value: boolean) {
  emit("update:isDialogVisible", value);
}

interface DialogItem {
  uuid: string;
  name: string;
}

// Validation schema for the form
const tambahPermintaanMultipleSchema = toTypedSchema(
  yup.object({
    datas: yup.array().of(
      yup.object({
        uuid: yup.string(),
        name: yup.string(),
      })
    ),
  })
);

// Vee-validate form setup
const { handleSubmit, resetForm } = useForm({
  validationSchema: tambahPermintaanMultipleSchema,
  initialValues: { datas: [] },
});

const { remove, push, fields } = useFieldArray<DialogItem>("datas");

const selectedItem = ref<any>(null);

// Function to add selected item to the data table
function addItemToDataTable() {
  if (selectedItem.value) {
    const isExist = fields.value.some(field => field.value.uuid === selectedItem.value!.uuid);
    if (!isExist) {
      push({
        uuid: selectedItem.value.uuid,
        name: selectedItem.value.nama,
      });
    }
    selectedItem.value = null;
  }
}

// Form submission handler
const onSubmit = handleSubmit((values) => {
  if (values.datas) {
    emit("add-items", values.datas);
  }
  resetForm();
  updateVisibility(false);
});

// Computed properties for display
const displayKategori = computed(() => props.kategoriItem || "-");
const displayJenisStok = computed(() => props.jenisStok || "-");
const displayJenisItem = computed(() => props.jenisItem || "-");
</script>

<template>
  <CustomDialog width="800px" :visible="isDialogVisible" headerBg="bg-opensimrs-300" @update:visible="updateVisibility">
    <template #header> Tambah Item Multiple </template>
    <template #body>
      <div class="flex flex-col gap-5 mt-5">
        <div class="grid grid-cols-3 p-4 border rounded-lg">
          <div>
            <p class="font-semibold underline">Kategori Item</p>
            <p class="capitalize">{{ displayKategori }}</p>
          </div>
          <div>
            <p class="font-semibold underline">Jenis Stok</p>
            <p>{{ displayJenisStok }}</p>
          </div>
          <div>
            <p class="font-semibold underline">Jenis Item</p>
            <p class="capitalize">{{ displayJenisItem }}</p>
          </div>
        </div>

        <div class="flex items-end w-full gap-5">
          <CustomSelect prepend-icon="PhMagnifyingGlass" label="Cari Item" place-holder="Cari & Pilih Item" class="grow"
            :options="props.availableItems" optionLabel="nama" v-model="selectedItem" :return-object="true" />
          <CustomButton @click="addItemToDataTable">
            <PhPlus :size="16" />
          </CustomButton>
        </div>
        <DataTable :value="fields" stripedRows class="text-xs" scrollable scrollHeight="200px">
          <Column headerClass="bg-opensimrs-50" class="w-16"><template #header>No.</template><template
              #body="slotProps">{{ slotProps.index + 1 }}</template></Column>
          <Column field="value.name" header="Nama Obat" headerClass="bg-opensimrs-50"></Column>
          <Column header="Sisa Stok" headerClass="bg-opensimrs-50"><template #body>0</template></Column>
          <Column header="Stok Tujuan" headerClass="bg-opensimrs-50"><template #body>3000</template></Column>
          <Column header="Action" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="flex justify-center">
                <CustomButton background-color="bg-danger-300 rounded-lg" class="h-6 w-6 p-0"
                  @click="remove(slotProps.index)">
                  <PhTrash :size="15" weight="fill" class="text-white" />
                </CustomButton>
              </div>
            </template>
          </Column>
        </DataTable>
        <hr class="border-grey-200" />
        <div class="font-semibold">
          Total Item Terpilih : {{ fields.length }}
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2.5">
        <CustomButton label="Hapus Semua" outlined borderColor="border-danger-300" textColor="text-danger-300"
          @click="resetForm" />
        <CustomButton label="Ambil Item" @click="onSubmit" />
      </div>
    </template>
  </CustomDialog>
</template>