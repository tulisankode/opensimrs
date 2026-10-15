<script setup lang="ts">
import { ref, onMounted, computed } from "vue"; 
import { useReturnReceipteStore } from "@/stores/inventory/returnReceipt";
import { utilsStore } from "@/stores/utils";
import { epochToDate} from "@/utils/Helpers";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import { PhCaretRight } from "@phosphor-icons/vue";

const props = defineProps({
  selectedData: {
    type: Object,
    default: () => ({}),
  },
});


// State Management
const UseReturnReceipteStore = useReturnReceipteStore();
const UseUtilsStore = utilsStore();
const DetailPayload = ref<any>({});

const emit = defineEmits(["back"]);

// Fetch Detail
const fetchDetail = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await UseReturnReceipteStore.getDetailApi(
      props.selectedData.uuid
    );
    if (response && response.payload) {
      DetailPayload.value = response.payload;
    } else {
      DetailPayload.value = {};
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// Data Payload Total Item
const totalItem = computed(() => DetailPayload.value?.totalItem || 0);

onMounted(() => {
  fetchDetail();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 pb-0 overflow-auto" pt:content:class="h-full overflow-hidden"
      class="h-full overflow-hidden overflow-y-auto">
      <template #header>
        <CustomAccordion :openWithHeader="false" noBorder initialState="0">
          <template #header>
            <div class="flex justify-between w-full align-middle">
              <div class="flex items-center">
                <CustomButton icon="PhArrowClockwise" class="mr-5" @click="fetchDetail" />
                <CustomBreadCrumb :home="{
                  label: 'Penerimaan Barang',
                  home: true,
                }" />
                <PhCaretRight :size="25" weight="bold" class="ml-[10px] mt-[8px] text-opensimrs-300" />
                <div class="">
                  <p class="font-semibold text-heading text-grey-400 ml-[10px] mt-[5px]">
                    Penerimaan Retur Unit
                  </p>
                </div>
                <PhCaretRight :size="25" weight="bold" class="ml-[10px] mt-[8px] text-grey-300" />
                <div class="ml-[10px] mt-[5px]">
                  <CustomChip :label="DetailPayload.noRetur || '...'" :showCheckedIcon="false"
                    borderColor="border-opensimrs-300" bgColor="bg-opensimrs-300" textColor="text-white" />
                </div>
              </div>
              <div class="flex">
                <CustomButton @click="emit('back')" icon="PhCaretLeft" label="Kembali" class="mr-[10px]" outlined
                  borderColor="border-opensimrs-300" textColor="text-opensimrs-300" />
              </div>
            </div>
          </template>
          <template #content>
            <div class="grid grid-cols-4 gap-4 mt-[20px]">
              <div>
                <p class="text-xs font-bold underline underline-offset-2">Tgl. Retur</p>
                <p>{{ DetailPayload.tanggalRetur ? epochToDate(DetailPayload.tanggalRetur / 1000, "date") : '-' }}</p>
              </div>
              <div>
                <p class="text-xs font-bold underline underline-offset-2">Kategori Item</p>
                <p>{{ DetailPayload.kategoriItem || '-' }}</p>
              </div>
              <div>
                <p class="text-xs font-bold underline underline-offset-2">Jenis Stok</p>
                <p>{{ DetailPayload.jenisStok || '-' }}</p>
              </div>
              <div>
                <p class="text-xs font-bold underline underline-offset-2">
                  Jenis Item
                </p>
                <p>{{ DetailPayload.jenisItem || '-' }}</p>
              </div>
              <div>
                <p class="text-xs font-bold underline underline-offset-2">
                  Asal Retur
                </p>
                <p>{{ DetailPayload.lokasiStokAwal?.name || '-' }}</p>
              </div>
              <div>
                <p class="text-xs font-bold underline underline-offset-2">
                  Tujuan Retur
                </p>
                <p>{{ DetailPayload.lokasiStokTujuan?.name || '-' }}</p>
              </div>
              <div>
                <p class="text-xs font-bold underline underline-offset-2">
                  Petugas Retur
                </p>
                <p>{{ DetailPayload.petugasRetur || '-' }}</p>
              </div>
              <div>
                <p class="text-xs font-bold underline underline-offset-2">
                  Catatan
                </p>
                <p>{{ DetailPayload.catatan || '-' }}</p>
              </div>
            </div>
            <hr class="mt-5 border-1 border-grey-200" />

            <div class="mt-[20px] h-[400px]">
              <DataTable :value="DetailPayload.items" scrollable scrollHeight="flex" :pt="{ headerRow: 'text-SM' }">
                <Column headerClass="bg-opensimrs-50 w-[50px]" class="w-[50px]">
                  <template #header>
                    <div class="w-full font-semibold text-center">No.</div>
                  </template>
                  <template #body="slotProps">
                    <div class="text-sm text-center">{{ slotProps.index + 1 }}</div>
                  </template>
                </Column>
                <Column header="Nama Item" headerClass="bg-opensimrs-50 font-semibold">
                  <template #body="slotProps">
                    <div class="text-sm">{{ slotProps.data.name || '-' }}</div>
                  </template>
                </Column>
                <Column header="Retur" headerClass="bg-opensimrs-50 font-semibold w-[150px]" class="w-[150px]">
                  <template #body="slotProps">
                    <div class="text-sm text-left">{{ slotProps.data.qty || '-' }}</div>
                  </template>
                </Column>
                <Column header="Penerimaan" headerClass="bg-opensimrs-50 font-semibold w-[150px]" class="w-[150px]">
                  <template #body="slotProps">
                    <div class="text-sm text-left">{{ slotProps.data.qtyTerima || '-' }}</div>
                  </template>
                </Column>
              </DataTable>
            </div>
          </template>

          <template #footer>
            <div class="flex p-4">
              <div>
                <p class="font-bold underline underline-offset-2">Total Item</p>
                <p>{{ totalItem }} item</p>
              </div>
            </div>
          </template>

          <template #collapseIcon>
            <CustomButton icon="PhCaretUp" backgroundColor="bg-opensimrs-75" textColor="text-opensimrs-300" />
          </template>
          <template #expandIcon>
            <CustomButton icon="PhCaretDown" backgroundColor="bg-opensimrs-75" textColor="text-opensimrs-300" />
          </template>
        </CustomAccordion>
      </template>
    </Card>
  </div>
</template>
