<script setup lang="ts">
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { ref } from "vue";
import { onMounted } from "vue";

const props = defineProps({
  isDialogVisible: {
    type: Boolean,
    default: false,
  },
});

const faktur = ref<any[]>([]);
const selectedFaktur = ref<any[]>([]);

const tglFaktur = ref(new Date());
const cariNoFaktur = ref("")

onMounted(() => {
});

const emit = defineEmits(["update:isDialogVisible", "close", "sendToTambahRetur"]);

const updateVisibility = (value: any) => {
  emit("update:isDialogVisible", value);
};

const closeDialog = () => {
  emit("update:isDialogVisible", false);
};

const sendToTambahRetur = (values: any) => {
  emit("sendToTambahRetur", values.data)
  closeDialog()
}
</script>

<template>
  <CustomDialog
    width="1000px"
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    headerBg="bg-opensimrs-300"
  >
    <template #header>Faktur Penerimaan </template>
    <template #body>
      <div class="flex items-center py-4">
        <div class="flex flex-col justify-center">
          <div class="font-semibold underline text-SM">Lokasi Gudang</div>
          <div class="font-normal text-normal">Gudang Farmasi</div>
        </div>
        <hr class="mx-10 min-h-16 border-[1px] border-opensimrs-300" />
        <div class="flex items-end gap-5">
          <CustomTextfield
            label="Cari No. Faktur"
            v-model="cariNoFaktur"
            prepend-icon="PhMagnifyingGlass"
            placeholder="Cari Berdasarkan No. Faktur"
            class="w-[360px]"
          />
          <CustomDatePicker label="Tgl. Faktur" v-model="tglFaktur" />
          <div class="flex gap-2.5">
            <CustomButton
              class="my-auto"
              label="Cari"
              icon="PhMagnifyingGlass"
            />
            <CustomButton
              label="Reset"
              class="my-auto bg-transparent"
              border-color="border-opensimrs-300 border-2"
              text-color="text-opensimrs-300"
            />
          </div>
        </div>
      </div>
      <DataTable
        v-model:selection="selectedFaktur"
        :value="faktur"
        @row-click="sendToTambahRetur"
        tableStyle="min-width: 50rem"
        scrollable
        scrollHeight="240px"
        :pt="{ headerRow: 'text-SM' }"
      >
        <Column headerClass="bg-opensimrs-50" class="w-[40px]">
          <template #header>
            <div class="w-full font-semibold text-center text-SM">No.</div>
          </template>
          <template #body="slotProps">
            <div class="w-full text-center text-SM">
              {{ slotProps.index + 1 }}
            </div>
          </template>
        </Column>
        <Column field="Nomor" headerClass="bg-opensimrs-50" class="w-[200px]">
          <template #header>
            <div class="font-semibold">Nomor</div>
          </template>
          <template #body="slotProps">
            <div class="font-semibold underline text-SM">No Penerimaan</div>
            <div class="text-SM">{{ slotProps.data.noPenerimaan }}</div>
            <div class="font-semibold underline text-SM">No Faktur</div>
            <div class="text-SM">{{ slotProps.data.noFaktur }}</div>
          </template>
        </Column>
        <Column field="Tanggal" headerClass="bg-opensimrs-50" class="w-[200px]">
          <template #header>
            <div class="font-semibold">Tanggal</div>
          </template>
          <template #body="slotProps">
            <div class="font-semibold underline text-SM">Tgl Penerimaan</div>
            <div class="text-SM">{{ slotProps.data.tglPenerimaan }}</div>
            <div class="font-semibold underline text-SM">Tgl Faktur</div>
            <div class="text-SM">{{ slotProps.data.tglFaktur }}</div>
          </template>
        </Column>
        <Column field="Supplier" headerClass="bg-opensimrs-50" class="w-[200px]">
          <template #header>
            <div class="font-semibold">Supplier</div>
          </template>
          <template #body="slotProps">
            <div class="text-SM">{{ slotProps.data.supplier }}</div>
          </template>
        </Column>
      </DataTable>
      <!-- <div>   </div> UNTUK TABEL -->
    </template>
    <template #footer>
      <div class="flex justify-end">
        <Paginator
          :rows="10"
          :totalRecords="120"
          :rowsPerPageOptions="[10, 20, 30]"
          template="FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink RowsPerPageDropdown"
          currentPageReportTemplate="{currentPage}"
        >
          <template #start="slotProps">Total Data: 0</template>
        </Paginator>
      </div>
    </template>
  </CustomDialog>
</template>
