<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useReturnReceipteStore } from "@/stores/inventory/returnReceipt";
import { utilsStore } from "@/stores/utils";
import { epochToDate } from "@/utils/Helpers";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import { PhCaretRight } from "@phosphor-icons/vue";
import { usePenerimaanReturUnitStore } from "@/stores/stok/PenerimaanReturUnit";

const props = defineProps({
  selectedData: {
    type: Object,
    default: () => ({}),
  },
});

// State Management
const UseReturnReceipteStore = usePenerimaanReturUnitStore();
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
      console.log("DetailPayload.value", DetailPayload.value);
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
  <div class="flex flex-col h-full">
    <Card
      pt:body:class="flex overflow-hidden flex-col flex-1 pt-0"
      pt:content:class="flex overflow-hidden flex-col flex-1"
      class="flex overflow-hidden flex-col h-full"
    >
      <template #header>
        <CustomAccordion :openWithHeader="false" noBorder initial-state="0">
          <template #header>
            <div class="flex justify-between w-full align-middle">
              <div class="flex">
                <CustomButton
                  icon="PhArrowClockwise"
                  @click="fetchDetail"
                  class="mr-5"
                  title="Refresh"
                />
                <CustomBreadCrumb
                  :home="{
                    label: 'Penerimaan Barang',
                    home: true,
                  }"
                />
                <PhCaretRight
                  :size="25"
                  weight="bold"
                  class="ml-[10px] mt-[8px] text-opensimrs-300"
                />
                <div class="">
                  <p
                    class="font-semibold text-heading text-grey-400 ml-[10px] mt-[5px]"
                  >
                    Penerimaan Retur
                  </p>
                </div>
                <PhCaretRight
                  :size="25"
                  weight="bold"
                  class="ml-[10px] mt-[8px] text-opensimrs-300"
                />
                <div class="px-2 space-x-2">
                  <CustomButton :label="DetailPayload.noRetur" />
                </div>
              </div>
              <CustomButton
                @click="emit('back')"
                icon="PhCaretLeft"
                label="Kembali"
                class="mr-[10px]"
              />
            </div>
          </template>
          <template #content>
            <div class="py-3">
              <div class="grid grid-cols-4 gap-6">
                <!-- Row 1 -->
                <div class="flex flex-col min-w-0">
                  <div class="text-sm font-bold underline">Tgl. Retur</div>
                  <div>
                    {{
                      DetailPayload.tanggalRetur
                        ? epochToDate(DetailPayload.tanggalRetur / 1000, "date")
                        : "-"
                    }}
                  </div>
                </div>
                <div class="flex flex-col min-w-0">
                  <div class="text-sm font-bold underline">Kategori Item</div>
                  <div>{{ DetailPayload.kategoriItem || "-" }}</div>
                </div>
                <div class="flex flex-col min-w-0">
                  <div class="text-sm font-bold underline">Jenis Stok</div>
                  <div>{{ DetailPayload.jenisStok || "-" }}</div>
                </div>
                <div class="flex flex-col min-w-0">
                  <div class="text-sm font-bold underline">Jenis Item</div>
                  <div>{{ DetailPayload.jenisItem || "-" }}</div>
                </div>
                <!-- Row 2 -->
                <div class="flex flex-col min-w-0">
                  <div class="text-sm font-bold underline">Asal Retur</div>
                  <div>{{ DetailPayload.lokasiStokAwal?.name || "-" }}</div>
                </div>
                <div class="flex flex-col min-w-0">
                  <div class="text-sm font-bold underline">Tujuan Retur</div>
                  <div>
                    {{ DetailPayload.lokasiStokTujuan?.name || "-" }}
                  </div>
                </div>
                <div class="flex flex-col min-w-0">
                  <div class="text-sm font-bold underline">Petugas Retur</div>
                  <div>
                    {{ DetailPayload.petugasRetur || "-" }}
                  </div>
                </div>
                <div class="flex flex-col min-w-0">
                  <div class="text-sm font-bold underline">Catatan</div>
                  <div>{{ DetailPayload.catatan || "-" }}</div>
                </div>
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
            />
          </template>
        </CustomAccordion>
      </template>
      <template #content>
        <div class="flex overflow-auto flex-col flex-1 min-h-0">
          <div class="flex-none">
            <DataTable
              :value="DetailPayload.items"
              stripedRows
              scrollable
              class="h-full text-xs"
            >
              <Column headerClass="bg-opensimrs-50" header="No">
                <template #body="slotProps">
                  {{ slotProps.index + 1 }}
                </template>
              </Column>
              <Column
                headerClass="bg-opensimrs-50"
                header="Nama Item"
                field="name"
              >
              </Column>
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="flex justify-center w-full font-semibold">
                    Retur
                  </div>
                </template>
                <template #body="slotProps">
                  <div class="flex justify-center w-full">
                    {{ slotProps.data.qty }}
                  </div>
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="flex justify-center w-full font-semibold">
                    Penerimaan
                  </div>
                </template>
                <template #body="slotProps">
                  <div class="flex justify-center w-full">
                    {{ slotProps.data.qtyTerima }}
                  </div>
                </template>
              </Column>
            </DataTable>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-between py-2 border-t border-grey-200">
          <div class="flex gap-10">
            <div>
              <div class="underline">Total Item</div>
              <div>{{ totalItem }}</div>
            </div>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
