<script lang="ts" setup>
import { ref, onMounted } from "vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import FormTarifTindakan from "./FormTarifTindakan.vue";
import DialogDelete from "../../Layout/DialogDelete.vue";
const props = defineProps({
  payload: {
    type: Array,
    default: () => [],
  },
});
// Selected Row
const metaKey = ref(true);
const selectedData = ref();

const onRowSelect = (event: any) => {
  selectedData.value = event.data;
  FormTindakanDialog("detail", "Detail Data Tarif Tindakan", selectedData.value);
};
const isTambahTindakanDialogVisible = ref(false);
const isDeleteDialogVisible = ref(false);
const dialogConfig = ref<any>({
  method: "add",
  title: "Tambah Data",
  data: null,
});
const FormTindakanDialog = (
  method: string,
  title: string,
  data: any = null
) => {
  dialogConfig.value = { method, title, data };
  isTambahTindakanDialogVisible.value = true;
};
const deleteDialog = (method: string, title: string, data: any = null) => {
  dialogConfig.value = { method, title, data };
  isDeleteDialogVisible.value = true;
};
const emit = defineEmits(["deleteItem","updated"]);

const confirmDelete = () => {
  if (dialogConfig.value.data) {
    emit("deleteItem", dialogConfig.value.data);
    isDeleteDialogVisible.value = false;
  }
};
</script>

<template>
  <!-- {{ payload }} -->
  <DataTable
    :value="payload"
    v-model:selection="selectedData"
    :metaKeySelection="metaKey"
    @rowClick="onRowSelect"
    selectionMode="single"
    tableStyle="min-width: 50rem"
    stripedRows
    class="-m-4 text-xs"
    scrollable
    scrollHeight="flex"
    :dt="{
      rowSelectedColor: '#000000',
      rowSelectedBackground: 'transparent',
      bodyCellSelectedBorderColor: 'transparent',
      bodyCellBorderColor: 'transparent',
      rowStripedBackground: '#F8F8F8',
    }"
  >
    <Column header="No." headerClass="bg-opensimrs-50">
      <template #body="slotProps">
        <div class="flex items-center justify-center">
          {{ slotProps.index + 1 }}
        </div>
      </template>
    </Column>
    <Column
      field="code"
      header="Kode Tarif"
      headerClass="bg-opensimrs-50"
    ></Column>
    <Column
      field="name"
      header="Nama Tarif"
      headerClass="bg-opensimrs-50"
    ></Column>
    <Column
      field="mode"
      header="Pilihan Tarif"
      headerClass="bg-opensimrs-50"
    ></Column>
    <Column field="pelayanan" header="Pelayanan" headerClass="bg-opensimrs-50">
      <template #body="slotProps">
        <div class="flex flex-wrap gap-2 text-nowrap">
          <div v-for="items in slotProps.data.tagUnitPelayanan" :key="items">
            <CustomChip
              :label="items.unitPelayanan"
              :showCheckedIcon="false"
              border-color="border-none"
              bg-color="bg-opensimrs-300"
              customClass="text-xs font-semibold cursor-auto h-5 bg-opensimrs-300 text-white pr-2 pl-3"
            />
          </div>
        </div>
      </template>
    </Column>
    <Column
      field="penjamin"
      header="Metode Pembayaran"
      headerClass="bg-opensimrs-50"
    >
      <template #body="slotProps">
        <div class="flex flex-wrap gap-2 text-nowrap">
          <div v-for="items in slotProps.data.tagPenjamin" :key="items">
            <CustomChip
              :label="items.penjaminName"
              :showCheckedIcon="false"
              border-color="border-none"
              bg-color="bg-opensimrs-300"
              customClass="text-xs font-semibold cursor-auto h-5 bg-opensimrs-300 text-white pr-2 pl-3"
            />
          </div>
        </div>
      </template>
    </Column>
    <Column header="Tarif Harga" headerClass="bg-opensimrs-50" class="w-[100px]">
      <template #body="slotProps">
        <div>Rp. {{ slotProps.data.grandTotal }}</div>
      </template>
    </Column>
    <Column field="status" headerClass="bg-opensimrs-50 text-center">
      <template #header>
        <div class="w-full font-semibold text-center">Status</div>
      </template>
      <template #body="slotProps">
        <div class="flex items-center justify-center min-w-[120px]">
          <CustomChip
            :label="slotProps.data.status ? 'AKTIF' : 'NON-AKTIF'"
            :textColor="slotProps.data.status ? 'text-white' : 'text-[#80868d]'"
            :bgColor="slotProps.data.status ? 'bg-opensimrs-300' : 'bg-white'"
            :borderColor="
              slotProps.data.status ? 'border-none' : 'border-[#80868d]'
            "
            :icon-color="slotProps.data.status ? 'white' : '#80868d'"
            customClass="text-xs font-semibold h-5 flex"
          />
        </div>
      </template>
    </Column>
    <Column headerClass="bg-opensimrs-50">
      <template #header="slotProps">
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
            background-color="bg-[#3D84E5] rounded-lg"
            class="h-6 w-[26px] p-0"
            @click="FormTindakanDialog('edit', 'Edit Data Tarif Tindakan', slotProps.data)"
          >
            <img src="@/assets/icons/edit.svg" alt="" />
          </CustomButton>
          <CustomButton
            label=""
            background-color="bg-danger-300 rounded-lg"
            class="h-6 w-[26px] p-0"
            @click="
              deleteDialog(
                'delete',
                `${slotProps.data.code}-${slotProps.data.name}`,
                slotProps.data
              )
            "
          >
            <img src="@/assets/icons/delete.svg" alt="" />
          </CustomButton>
        </div>
      </template>
    </Column>
  </DataTable>

  <FormTarifTindakan
    v-model:isDialogVisible="isTambahTindakanDialogVisible"
    :title="dialogConfig.title"
    :method="dialogConfig.method"
    :payload="dialogConfig.data"
    @data-updated="$emit('updated')"

  />
  <DialogDelete
    v-model:isDialogVisible="isDeleteDialogVisible"
    :title="dialogConfig.title"
    :itemToDelete="dialogConfig.data"
    @delete="confirmDelete"
  />
</template>
