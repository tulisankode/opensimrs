<script lang="ts" setup>
import { ref, onMounted, type PropType } from "vue";
import { useForm, useFieldArray, ErrorMessage } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import CustomMultiSelect from "@/components/Base/CustomMultiSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import DialogTambahAlkesMultiple from "./DialogTambahAlkesMultiple.vue";
import DialogOrderAlkes from "@/components/RekamMedis/OrderAlkes/DialogOrderAlkes.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { useRoomPharmacyStore } from "@/stores/farmasi/RoomPharmacy";
import { epochToDate } from "@/utils/Helpers";
import DialogDetailOrderAlkes from "./DialogDetailOrderAlkes.vue";

// NOTE Store
const storeUtils = utilsStore();
const roomPharmacyStore = useRoomPharmacyStore();

const props = defineProps({
  method: {
    type: String,
    default: "form",
  },
  formDetail: {
    type: Array as () => Array<string>,
    default: () => ["ORDER", "PROSES", "SELESAI"],
  },
  rmType: {
    type: String,
    default: "rawat-jalan",
  },
  patientData: {
    type: Object,
  },
  rmUuid: {
    type: String,
    default: "",
  },
  rmDate: {
    type: String,
    default: "",
  },
});

const results = ref<any[]>([]);

const getStringStatus = (index: number) => {
  if (index == 0) return "Dibatalkan";
  else if (index == 1) return "Order Masuk";
  else if (index == 2) return "Sedang Disiapkan";
  else if (index == 3) return "Proses";
  else if (index == 4) return "Alkes Diserahkan";
  else if (index == 5) return "Dispense";
  else if (index == 6) return "Return";
};

const openedAlkesData = ref<any>({});
const detailOrderAlkesData = ref<any>({});
const showDialogDetail = async (alkesData: any) => {
  try {
    storeUtils.setLoading(true);
    openedAlkesData.value = alkesData;
    const response = await roomPharmacyStore.detailApi(alkesData.uuid);
    if (response && response.payload) {
      detailOrderAlkesData.value = response.payload;
      dialogDetailOrder.value.isVisible = true;
      dialogDetailOrder.value.title = "Detail Order Alkes";
    }
  } catch (error) {
    console.error(error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const accordion = ref<HTMLCanvasElement | null>(null);
const open = () => {
  if (accordion.value) {
    (accordion.value as any).open();
  }
};
const close = () => {
  if (accordion.value) {
    (accordion.value as any).close();
  }
};

const dialogTambahOrder = ref({
  isVisible: false,
  title: "",
});
const dialogDetailOrder = ref({
  isVisible: false,
  title: "",
});

function handleTambahOrder() {
  dialogTambahOrder.value.isVisible = true;
  dialogTambahOrder.value.title = "Order Alkes";
}

// terima payload dari file DialogOrderAlkes
const handleSubmitOrder = async (payload: any) => {
  try {
    storeUtils.setLoading(true);
    await getListOrderAlkes();
  } catch (error) {
    console.error(error);
  } finally {
    storeUtils.setLoading(false);
  }
};
const resetOrderAlkes = () => {
  results.value = [];
};

const getListOrderAlkes = async () => {
  if (props.rmUuid && props.rmDate) {
    const response = await roomPharmacyStore.geInOneDate({
      rekamMedisUuid: props.rmUuid,
      rekamMedisDate: props.rmDate,
    });
    if (response && response.payload) {
      const detailedResults = await Promise.all(
        response.payload.map(async (item: any) => {
          try {
            const detailRes = await roomPharmacyStore.detailApi(item.uuid);
            return {
              ...item, 
              ...detailRes.payload 
            };
          } catch (e) {
            return item;
          }
        })
      );
      results.value = detailedResults;
    }
  }
};

onMounted(async () => {
  try {
    storeUtils.setLoading(true);
    await getListOrderAlkes();
  } catch (error) {
    console.error(error);
  } finally {
    storeUtils.setLoading(false);
  }
});
</script>

<template>
  <CustomAccordion
    headerClass="bg-opensimrs-50"
    v-if="props.method === 'form'"
    ref="accordion"
  >
    <template #header>Order Alkes</template>
    <template #content>
      <div class="grid grid-cols-3 gap-3 py-6" v-if="results.length > 0">
        <div
          @click="showDialogDetail(result)"
          class="p-2.5 bg-white border border-gray-200 rounded-lg shadow-sm shadow-black/10 cursor-pointer"
          v-for="(result, index) in results"
          :key="index"
        >
          <!-- Header -->
          <div
            class="py-1 font-semibold text-center text-white bg-opensimrs-200 rounded-lg text-SM"
          >
            {{ result.noOrderAlkes }}
          </div>

          <!-- Content -->
          <div class="grid grid-cols-2 pt-2.5">
            <!-- Left side -->
            <div>
              <div class="font-semibold underline text-XS">Pengorder Alkes</div>
              <div class="font-normal text-SM">{{ result.petugasOrder }}</div>
              <div class="font-semibold underline text-XS">
                Lokasi Tujuan Order
              </div>
              <div class="font-normal text-SM">
                {{ result.lokasiStok }}
              </div>
            </div>

            <!-- Right side -->
            <div class="text-end">
              <div class="font-semibold underline text-XS">Tgl. Order</div>
              <div class="font-normal text-SM">
                {{ epochToDate(result.createdAt, "date") }}
              </div>
              <div class="font-semibold underline text-XS">Jumlah Order</div>
              <div class="font-normal text-SM">
                {{ result.jumlahItem }} Item
              </div>
            </div>
          </div>

          <!-- Buttons -->
          <div class="flex flex-col items-end justify-start gap-0.5">
            <div class="font-semibold underline text-XS">Status</div>
            <CustomChip
              :showCheckedIcon="false"
              :label="getStringStatus(result.orderStatus)"
              bgColor="bg-opensimrs-300"
              textColor="text-white"
              customClass="h-5 border-none"
            />
          </div>
        </div>
        <!-- Card End -->
      </div>
      <div v-else class="py-5">
        <NoData />
      </div>
      <div
        class="flex items-center justify-center p-5 m-5 border border-dashed rounded-lg border-opensimrs-300 gap-2.5"
      >
        <CustomButton
          icon="PhPlus"
          label="Tambah Order"
          borderColor="border-opensimrs-300"
          textColor="text-opensimrs-300"
          backgroundColor="bg-white"
          @click="handleTambahOrder"
        />
      </div>
      <DialogOrderAlkes
        v-model:is-dialog-visible="dialogTambahOrder.isVisible"
        :title="dialogTambahOrder.title"
        :rmType="rmType"
        :patientData="patientData"
        :rmUuid="rmUuid"
        :rmDate="rmDate"
        @submit-order="handleSubmitOrder"
      />
      <DialogDetailOrderAlkes
        v-model:is-dialog-visible="dialogDetailOrder.isVisible"
        :title="dialogDetailOrder.title"
        :alkesData="openedAlkesData"
        :dataDetail="detailOrderAlkesData"
      />
    </template>
  </CustomAccordion>

  <CustomAccordion v-else headerClass="bg-opensimrs-50">
    <template #header>Alkes</template>
    <template #content>
      <div class="flex flex-col gap-2.5 pt-5">
        <CustomAccordion
          v-for="(result, index) in results"
          :key="index"
          headerClass="bg-opensimrs-50"
        >
          <template #header>
            <div class="flex justify-between w-full">
              <div class="flex justify-start gap-2.5 items-center">
                <div>{{ result.noOrderAlkes }}</div>
                <CustomChip
                  :showCheckedIcon="false"
                  :label="getStringStatus(result.orderStatus)"
                  bgColor="bg-opensimrs-300"
                  textColor="text-white"
                  customClass="h-5 border-none"
                />
              </div>
              <div class="mr-5">
                Tgl. Order : {{ epochToDate(result.createdAt, "date") }}
              </div>
            </div>
          </template>
          <template #content>
            <div class="pt-5">
              <CustomInfoRow
                class="mb-5"
                label="Lokasi Tujuan Order"
                :value="result.lokasiStok"
              />
              
              <DataTable 
                class="text-xs" 
                :value="result.alkesItems" 
              >
                <Column
                  headerClass="bg-opensimrs-50 font-semibold text-SM"
                  class="w-2 text-center"
                >
                  <template #header>
                    <div class="text-center">No.</div>
                  </template>
                  <template #body="slotProps">
                    <div class="flex items-center justify-center">
                      {{ slotProps.index + 1 }}
                    </div>
                  </template>
                </Column>

                <Column
                  headerClass="bg-opensimrs-50"
                  class="max-w-[300px] text-left"
                >
                  <template #header>
                    <div class="w-full font-semibold text-left">
                      List Tindakan
                    </div>
                  </template>
                  <template #body="slotProps">
                    <div>
                      {{ slotProps.data.itemMedis?.name || '-' }}
                    </div>
                  </template>
                </Column>

                <Column headerClass="bg-opensimrs-50" class="w-auto text-center">
                  <template #header>
                    <div class="w-full font-semibold">Jumlah</div>
                  </template>
                  <template #body="slotProps">
                    {{ slotProps.data.qty }}
                  </template>
                </Column>
                <Column headerClass="bg-opensimrs-50" class="w-auto text-center">
                  <template #header>
                    <div class="w-full font-semibold">Satuan</div>
                  </template>
                  <template #body="slotProps">
                     {{ slotProps.data.itemMedis?.satuanPenggunaan?.name || '-' }}
                  </template>
                </Column>
                <Column headerClass="bg-opensimrs-50" class="w-auto text-center">
                  <template #header>
                    <div class="w-full font-semibold">Harga</div>
                  </template>
                  <template #body="slotProps">
                     {{ slotProps.data.hargaSatuan }}
                  </template>
                </Column>

                </DataTable>
              <CustomInfoRow
                class="mt-5"
                label="Petugas"
                :value="result.petugasOrder"
              />
              <CustomInfoRow
                class="mt-5"
                label="Jam Input"
                :value="String(epochToDate(result.updatedAt, 'time'))"
              />
            </div>
          </template>
        </CustomAccordion>
      </div>
    </template>
  </CustomAccordion>
</template>
