<script lang="ts" setup>
import { ref, onMounted } from "vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import FormTarifRuangan from "./FormTarifRuangan.vue";
import DialogDelete from "../../Layout/DialogDelete.vue";

const props = defineProps({
  payload: {
    type: Array,
    default: () => [],
  },
});

const products = ref();
const expandedRows = ref();
// Selected Row
const selectedData = ref();

const isTambahRuanganDialogVisible = ref(false);
const isDeleteDialogVisible = ref(false);
const dialogConfig = ref<any>({
  method: "add",
  title: "Tambah Data",
  data: null,
});
const FormRuanganDialog = (method: string, title: string, data: any = null) => {
  dialogConfig.value = { method, title, data };
  isTambahRuanganDialogVisible.value = true;
};

const deleteDialog = (method: string, title: string, data: any = null) => {
  dialogConfig.value = { method, title, data };
  isDeleteDialogVisible.value = true;
};
const emit = defineEmits(["deleteItem", "updated"]);

const confirmDelete = () => {
  if (dialogConfig.value.data) {
    emit("deleteItem", dialogConfig.value.data);
    isDeleteDialogVisible.value = false;
  }
};
</script>

<template>
  <DataTable
    v-model:expandedRows="expandedRows"
    :value="payload"
    tableStyle="min-width: 50rem"
    class="-m-4 text-xs"
    stripedRows
    dataKey="id"
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
    <Column
      expander
      style="width: 5rem"
      header-class="text-black bg-opensimrs-50"
    />
    <Column header="No." header-class="text-black bg-opensimrs-50">
      <template #body="slotProps">
        <div class="flex items-center justify-center">
          {{ slotProps.index + 1 }}
        </div>
      </template>
    </Column>
    <Column
      field="ruangan.name"
      header="Nama Ruangan"
      header-class="text-black bg-opensimrs-50"
    ></Column>
    <Column
      field="ruangan.kategoriKamar.name"
      header="Kategori Ruangan"
      header-class="text-black bg-opensimrs-50"
    >
    </Column>
    <Column
      field="ruangan.className"
      header="Kelas"
      header-class="text-black bg-opensimrs-50"
    >
    </Column>
    <Column header="pelayanan" header-class="text-black bg-opensimrs-50">
      <template #body="slotProps">
        <div v-for="items in slotProps.data.tagUnitPelayanan" :key="items">
          {{ items.unitPelayanan }}
        </div>
      </template>
    </Column>
    <Column
      field="metode_pembayaran"
      header="Metode Pembayaran"
      header-class="text-black bg-opensimrs-50"
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
    <Column field="status" header-class="text-black bg-opensimrs-50">
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
    <Column header-class="text-black bg-opensimrs-50">
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
            @click="FormRuanganDialog('edit', 'Edit Data Tarif Ruangan', slotProps.data)"
          >
            <img src="@/assets/icons/edit.svg" alt="" />
          </CustomButton>
          <CustomButton
            label=""
            background-color="bg-danger-300 rounded-lg"
            @click="
              deleteDialog(
                'delete',
                `${slotProps.data.code}-${slotProps.data.name}`,
                slotProps.data
              )
            "
            class="h-6 w-[26px] p-0"
          >
            <img src="@/assets/icons/delete.svg" alt="" />
          </CustomButton>
        </div>
      </template>
    </Column>
    <template #expansion="slotProps">
      <div class="p-3 -mx-3 -my-1.5 bg-opensimrs-50">
        <DataTable
          :value="slotProps.data.tagPenjamin"
          class="overflow-hidden rounded-lg bg-opensimrs-50"
        >
          <Column
            field="penjaminName"
            header="Jenis Pembayaran Bed"
            header-class="text-white bg-opensimrs-300"
          >
          </Column>
          <Column
            field="harga"
            header-class="font-semibold text-white bg-opensimrs-300 text-SM"
            bodyClass="text-end"
          >
            <template #header>
              <div class="w-full text-end">Harga Tarif</div>
            </template>
          </Column>
        </DataTable>
      </div>
    </template>
  </DataTable>
  <FormTarifRuangan
    v-model:isDialogVisible="isTambahRuanganDialogVisible"
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
