<script lang="ts" setup>
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import { computed, onBeforeMount, ref, watch } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import { onMounted } from "vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import DialogDetailObat from "./DialogDetailObat.vue";
import DialogOrderObat from "@/components/RekamMedis/OrderObat/DialogOrderObat.vue";
import NoData from "@/components/section/NoData.vue";
import DialogCardObat from "@/components/RekamMedis/OrderObat/DialogCardObat.vue";
import { utilsStore } from "@/stores/utils";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { useDoctorPrescriptionStore } from "@/stores/farmasi/DoctorPrescription";
import { epochToDate } from "@/utils/Helpers";

// NOTE Store
const storeUtils = utilsStore();
const rekamMedisStore = useRekamMedisStore();
const doctorPrescriptionStore = useDoctorPrescriptionStore();

const props = defineProps({
  method: {
    type: String,
    default: "form",
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
  sessionUuid: {
    type: String,
    default: "",
  },
});

const dialogTambahOrder = ref({
  isVisible: false,
  title: "",
  type: "add",
  obatOrder: null as any | null,
});

const listOrder = ref<any[]>([]);

function handleTambahOrder(tipe: string) {
  dialogTambahOrder.value.isVisible = true;
  dialogTambahOrder.value.title =
    tipe == "add" ? "List Order Obat" : "Detail Obat";
  dialogTambahOrder.value.type = tipe;
}

const handleSubmitOrder = async () => {
  try {
    storeUtils.setLoading(true);
    const selectedDate = rekamMedisStore.openedRekamMedis.dates.filter(
      (date: any) => date.isSelected
    );
    const selectedSession = rekamMedisStore.openedRekamMedis.sessions.filter(
      (session: any) => session.isSelected
    );
    const result = await rekamMedisStore.getRekamMedis({
      rekamMedisUuid: rekamMedisStore.openedRekamMedis.meta.rekamMedisUuid,
      dateOrder: selectedDate.date,
      sessionOrder: selectedSession.order,
    });
    if (result && result.payload) {
      rekamMedisStore.setOpenedRekamMedisData(result.payload);
    }
  } catch (error) {
    console.error("Gagal update list obat:", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const resetOrderObat = () => {
  listOrder.value = [];
};

// Variabel inisialisasi dialog
const dialogCardObat = ref({
  isVisible: false,
  title: "",
  obatDetail: null as any | null,
});

const selectResult = async (resepData: any) => {
  try {
    storeUtils.setLoading(true);
    const result = await doctorPrescriptionStore.detailApi(resepData.uuid);
    if (result && result.payload) {
      if (resepData.orderStatus === 1 || resepData.orderStatus === 2) {
        handleTambahOrder("edit");
        dialogTambahOrder.value.obatOrder = result.payload;
      } else {
        dialogCardObat.value = {
          isVisible: true,
          title: "Detail Obat",
          obatDetail: { ...result.payload, lokasiName: result.payload.lokasiStokNama },
        };
      }
    }
  } catch (error) {
    console.error("Failed to get data", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const detailObats = ref<any[]>([]);
onMounted(() => {});

const dialogDetailData = ref({
  isVisible: false,
  title: "",
  detailObatData: null as any | null,
});

const setFormData = async () => {
  if (rekamMedisStore.openedRekamMedis.data.obatUuides?.length) {
    try {
      storeUtils.setLoading(true);
      const responseOrderObat =
        await doctorPrescriptionStore.getSomeOrderPrescription({
          uuides: rekamMedisStore.openedRekamMedis.data.obatUuides,
        });
      if (responseOrderObat && responseOrderObat.payload) {
        listOrder.value = responseOrderObat.payload;
      }
    } catch (error) {
      console.error("Failed to post data", error);
    } finally {
      storeUtils.setLoading(false);
    }
  } else resetOrderObat();
};

const getStringStatus = (index: number) => {
  if (index == 0) return "Dibatalkan";
  else if (index == 1) return "Request";
  else if (index == 2) return "Order Masuk";
  else if (index == 3) return "Sedang Disiapkan";
  else if (index == 4) return "Order Siap";
  else if (index == 5) return "Obat Diserahkan";
  else if (index == 6) return "Return";
};

onBeforeMount(() => {
  setFormData();
});

// NOTE Untuk merefresh form yang sedang dibuka jika ada perubahan data
const storedRMData = computed(() => rekamMedisStore.openedRekamMedis);
watch(storedRMData, (newRM) => {
  setFormData();
});

const handleDetail = async (resepData: any) => {
  try {
    storeUtils.setLoading(true);
    const result = await doctorPrescriptionStore.detailApi(resepData.uuid);
    if (result && result.payload) {
      dialogCardObat.value = {
        isVisible: true,
        title: "Detail Obat",
        obatDetail: { ...result.payload, lokasiName: result.payload.lokasiStokNama },
      };
    }
  } catch (error) {
    console.error("Failed to get data", error);
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

defineExpose({
  open,
  close,
});
</script>

<template>
  <CustomAccordion
    headerClass="bg-opensimrs-50"
    v-if="props.method === 'form'"
    ref="accordion"
  >
    <template #header>Order Obat</template>
    <template #content>
      <div class="pt-5">
        <div class="grid grid-cols-3 gap-3 pb-6" v-if="listOrder.length > 0">
          <div
            class="p-2.5 bg-white border border-gray-200 rounded-lg shadow-sm shadow-black/10 cursor-pointer"
            v-for="(result, index) in listOrder"
            :key="index"
            @click="selectResult(result)"
          >
            <!-- Header -->
            <div
              class="py-1 font-semibold text-center text-white bg-opensimrs-200 rounded-lg text-SM"
            >
              {{ result.noResep }}
            </div>
  
            <!-- Content -->
            <div class="grid grid-cols-2 pt-2.5">
              <!-- Left side -->
              <div>
                <div class="font-semibold underline text-XS">Penulis Resep</div>
                <div class="font-normal text-SM">{{ result.dokterOrder }}</div>
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
                  {{ epochToDate(result.orderDate, "date") }}
                </div>
                <div class="font-semibold underline text-XS">Jumlah Order</div>
                <div class="font-normal text-SM">
                  {{ result.jumlahObat }} Obat
                </div>
              </div>
            </div>
  
            <!-- Buttons -->
            <div class="flex items-end justify-between">
              <div class="flex space-x-2">
                <CustomChip
                  v-if="result.isRacikan"
                  :showCheckedIcon="false"
                  label="MENGANDUNG RACIKAN"
                  textColor="text-grass-300"
                  borderColor="border-grass-300"
                  bgColor="bg-grass-50"
                  customClass="h-5"
                />
                <CustomChip
                  v-if="result.isTakeaway"
                  :showCheckedIcon="false"
                  label="OBAT PULANG"
                  textColor="text-info-300"
                  borderColor="border-info-300"
                  bgColor="bg-info-50"
                  customClass="h-5"
                />
                <CustomChip
                  v-if="result.isChronic"
                  :showCheckedIcon="false"
                  label="OBAT KRONIS"
                  textColor="text-sunFlower-300"
                  borderColor="border-sunFlower-300"
                  bgColor="bg-sunFlower-50"
                  customClass="h-5"
                />
              </div>
  
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
          </div>
          <!-- Card End -->
        </div>
        <div v-else>
          <NoData />
        </div>
        <!-- TESS -->
        <div
          class="flex items-center justify-center p-5 border border-dashed rounded-lg border-opensimrs-300 gap-2.5 mt-6"
        >
          <CustomButton
            icon="PhPlus"
            label="Tambah Order"
            borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300"
            backgroundColor="bg-white"
            @click="handleTambahOrder('add')"
          />
        </div>
      </div>
      <DialogOrderObat
        v-model:is-dialog-visible="dialogTambahOrder.isVisible"
        :title="dialogTambahOrder.title"
        :rmType="rmType"
        :rmUuid="props.rmUuid"
        :patientData="patientData"
        :sessionUuid="props.sessionUuid"
        :type="dialogTambahOrder.type"
        :obatOrder="dialogTambahOrder.obatOrder"
        @submit-order="handleSubmitOrder"
      />
      <DialogCardObat
        v-model:is-dialog-visible="dialogCardObat.isVisible"
        :title="dialogCardObat.title"
        :obat-detail="dialogCardObat.obatDetail"
      />
    </template>
  </CustomAccordion>

  <!-- Ketika Method adalah Detail -->
  <CustomAccordion v-else headerClass="bg-opensimrs-50">
    <template #header>Obat</template>
    <template #content>
      <div class="pt-5">
        <CustomAccordion
          v-for="(result, index) in listOrder"
          :key="index"
          headerClass="bg-opensimrs-50"
        >
          <template #header>
            <div class="flex justify-between w-full">
              <div>{{ result.noResep }}</div>
              <div>Tgl. Order : {{ epochToDate(result.orderDate, "date") }}</div>
            </div>
          </template>
          <template #content>
            <div class="px-5 py-2.5">
              <div class="pt-5">
                <CustomInfoRow label="Petugas" :value="result.dokterOrder" />
              </div>
              <div class="pt-5">
                <CustomInfoRow
                  label="Jam Input"
                  :value="`${epochToDate(result.orderDate, 'time')}`"
                />
              </div>
            </div>
          </template>
          <template #footer>
            <div class="flex gap-3">
              <CustomButton
                label="Detail"
                textColor="text-white"
                backgroundColor="bg-opensimrs-300"
                @click="handleDetail(result)"
                icon="DetailIcon"
              />
            </div>
          </template>
        </CustomAccordion>
      </div>
      <DialogDetailObat
        v-model:is-dialog-visible="dialogDetailData.isVisible"
        :title="dialogDetailData.title"
        :obatDetail="dialogDetailData.detailObatData"
      />
      <DialogCardObat
        v-model:is-dialog-visible="dialogCardObat.isVisible"
        :title="dialogCardObat.title"
        :obat-detail="dialogCardObat.obatDetail"
      />
    </template>
  </CustomAccordion>
</template>
