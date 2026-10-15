<script setup lang="ts">
import { ref, onMounted, watch, computed } from "vue";
import { useMedicalItemStore } from "@/stores/datamasterFarmasi/MedicalItem";
import { useRoomPharmacyStore } from "@/stores/farmasi/RoomPharmacy";
import { formatPrice, epochToDate } from "@/utils/Helpers";
import { utilsStore } from "@/stores/utils";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import DialogAlkes from "./DialogAlkesPage.vue";
import DialogCancel from "./DialogCancelOrderPage.vue";
import DialogMoving from "./DialogMovingLocationPage.vue";
import { createOrderAlkesPdf } from "@/utils/pdf/pdfOrderAlkes";
import { useDrugReturStore } from "@/stores/farmasi/DrugRetur";

const props = defineProps({
  payloadDetail: {
    type: Object,
    default: () => ({}),
  },
});

watch(
  () => props.payloadDetail,
  (newVal) => {
    console.log("payloadDetail", newVal);
  },
  { immediate: true, deep: true }
);

const emit = defineEmits(["close", "nextPage1"]);

const closeDetail = () => {
  emit("close");
};

const cetakDialog = ref(false);

// State Management Medical Item
const MedicalItemStore = useMedicalItemStore();
const MedicalItemPayload = ref<any>({});

// Fetch MedicalItem
const fetchMedicalItem = async () => {
  const currentOrderUuid = props.payloadDetail?.uuid;
  if (!currentOrderUuid || !props.payloadDetail?.alkesItems) return;

  MedicalItemPayload.value = {};

  const promises = props.payloadDetail.alkesItems.map(async (item: any) => {
    const itemMedisUuid = item.itemMedisUuid;
    if (!itemMedisUuid) return;

    try {
      const response = await MedicalItemStore.getAvailableStockApi(
        itemMedisUuid
      );

      if (props.payloadDetail?.uuid !== currentOrderUuid) {
        return;
      }

      if (response && response.payload) {
        MedicalItemPayload.value[itemMedisUuid] = response.payload.filter(
          (data: any) => {
            return data.detailStok && data.harga && data.totalStok;
          }
        );
      } else {
        MedicalItemPayload.value[itemMedisUuid] = [];
      }
    } catch (error) {
      if (props.payloadDetail?.uuid !== currentOrderUuid) {
        return;
      }
      console.error(`Failed to fetch data for ${itemMedisUuid}`, error);
      MedicalItemPayload.value[itemMedisUuid] = [];
    }
  });

  await Promise.all(promises);
};

// State Management Detail Room Pharmacy
const RoomPharmacyStoreStore = useRoomPharmacyStore();
const RoomPharmacyIncomingDetail = ref<any>({});
const UseUtilsStore = utilsStore();

const totalTagihan = ref(0);
const updateStokAlkes = async (value: any, index: number) => {
  activedVerif.value = false;
  totalTagihan.value = 0;
  if (value) {
    props.payloadDetail.alkesItems[index].listAlkes[0].sisaStok =
      value.totalStok;
    props.payloadDetail.alkesItems[index].listAlkes[0].hargaSatuan =
      value.harga;
    props.payloadDetail.alkesItems[index].listAlkes[0].total =
      props.payloadDetail.alkesItems[index].qty * value.harga;
    for (let i = 0; i < props.payloadDetail.alkesItems.length; i++) {
      const item = props.payloadDetail.alkesItems[i];
      totalTagihan.value += item.listAlkes[0].total;
    }
  } else {
    props.payloadDetail.alkesItems[index].listAlkes[0].sisaStok = 0;
    props.payloadDetail.alkesItems[index].listAlkes[0].hargaSatuan = 0;
    props.payloadDetail.alkesItems[index].listAlkes[0].total = 0;
    for (let i = 0; i < props.payloadDetail.alkesItems.length; i++) {
      const item = props.payloadDetail.alkesItems[i];
      totalTagihan.value += item.listAlkes[0].total;
    }
  }
  try {
    const response = await RoomPharmacyStoreStore.updateAlkesApi(
      props.payloadDetail.alkesItems[index].uuid,
      {
        jenisStokUuid: value.detailStok.uuid,
      }
    );
  } catch (error) {
    console.error("Failed to process the data:", error);
  }
};

// Incoming Detail
const IncomingDetail = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await RoomPharmacyStoreStore.detailApi(
      props.payloadDetail.uuid
    );
    console.log("Detail Incoming:", response);
    if (response && response.payload) {
      Object.assign(props.payloadDetail, response.payload);
      if (props.payloadDetail.alkesItems) {
        props.payloadDetail.alkesItems.forEach((element: any) => {
          element.listAlkes = [
            {
              stokAlkes: "",
              sisaStok: 0,
              hargaSatuan: 0,
              total: 0,
            },
          ];
        });
      }
      console.log("Detail Incoming after addOn:", props.payloadDetail);
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    // RoomPharmacyIncomingDetail.value = {};
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const DrugReturStore = useDrugReturStore();
const assesmentMedisPayload = ref<any>([]);

const fetchAssesmentMedis = async (rekamMedisUuid: string) => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await DrugReturStore.getAssesmentMedis(
      props.payloadDetail.rekamMedisUuid
    );

    assesmentMedisPayload.value = response.payload;
    console.log("fetchAssesmentMedis retur:", assesmentMedisPayload.value);
  } catch (error) {
    console.error("Failed to fetch data", error);
    assesmentMedisPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// Verify
const activedVerif = ref(false);
const verify = async () => {
  props.payloadDetail.alkesItems.forEach((item: any) => {
    if (item.listAlkes && item.listAlkes.length > 0) {
      item.listAlkes.forEach((alkes: any) => {
        if (alkes.stokAlkes == "" || !alkes.stokAlkes) {
          activedVerif.value = true;
        } else {
          activedVerif.value = false;
        }
      });
    }
  });
  if (!activedVerif.value) {
    UseUtilsStore.setLoading(true);
    try {
      const response = await RoomPharmacyStoreStore.verifyApi({
        uuid: props.payloadDetail.uuid,
        items: props.payloadDetail.alkesItems.map((item: any) => ({
          item_uuid: item.itemMedisUuid,
          jenis_stok_uuid: item.listAlkes[0].stokAlkes.detailStok.uuid,
        })),
      });
    } catch (error) {
      console.error("Failed to process the data:", error);
    } finally {
      UseUtilsStore.setLoading(false);
      emit("nextPage1", props.payloadDetail.uuid);
    }
  }
};

// Edit Dialog Config
const editDialog = ref(false);
const editDialogConfig = ref<any>({
  data: {},
});

const openEditDialog = (data: any = {}) => {
  editDialogConfig.value = { data };
  editDialog.value = true;
};

// Cancel Dialog Config
const cancelDialog = ref(false);
const cancelDialogConfig = ref<any>({
  data: {},
});

const openCancelDialog = (data: any = {}) => {
  cancelDialogConfig.value = { data };
  cancelDialog.value = true;
};

// Moving Location Dialog Config
const movingLocationDialog = ref(false);
const movingLocationDialogConfig = ref<any>({
  data: {},
});

const openMovingLocationDialog = (data: any = {}) => {
  console.log("[DetailRoomPharmacy] openMovingLocationDialog payload:", data);
  movingLocationDialogConfig.value = { data };
  movingLocationDialog.value = true;
};

watch(
  () => props.payloadDetail.alkesItems,
  () => {
    if (props.payloadDetail.alkesItems?.length) {
      fetchMedicalItem();
    }
  },
  { immediate: true }
);

console.log("payloadDetail", props.payloadDetail);

const printOrderAlkes = () => {
  createOrderAlkesPdf(props.payloadDetail);
};

// onMounted(() => {
//   fetchMedicalItem();
// });

watch(
  () => props.payloadDetail.rekamMedisUuid,
  () => {
    fetchAssesmentMedis(props.payloadDetail.rekamMedisUuid);
  },
  { immediate: true }
);

onMounted(() => {
  IncomingDetail();
});
</script>

<template>
  <div class="col-span-2">
    <div class="mt-[10px] p-3 bg-opensimrs-75">
      <!-- Title -->
      <div class="mt-[10px] p-4 rounded-t-lg bg-opensimrs-300 shadow-md h-[60px]">
        <div class="grid grid-cols-2 gap-2">
          <div class="flex">
            <p class="font-bold text-white font-poppins">
              {{ payloadDetail.noOrderAlkes }}
            </p>
            <CustomChip
              :label="payloadDetail.paymentMethod"
              :showCheckedIcon="false"
              borderColor="border-opensimrs-300"
              bgColor="bg-opensimrs-50"
              textColor="text-opensimrs-300"
              customClass="h-5"
              class="ml-[5px] mt-[2px]"
            />
          </div>
          <div class="flex justify-end">
            <div class="bg-white w-[0.5px] h-[30px] mr-[20px]"></div>
            <p
              class="text-sm font-bold text-white font-poppins mt-[5px] mr-[20px]"
            >
              Tgl. Order : {{ epochToDate(payloadDetail.createdAt, "date") }}
            </p>
            <CustomButton
              background-color="bg-white"
              size="small"
              class="w-[30px] h-[30px] rounded-full p-0"
              @click="emit('close')"
            >
              <img src="@/assets/icons/x-bold.svg" alt="" width="" />
            </CustomButton>
          </div>
        </div>
      </div>
      <!-- Body -->
      <div class="p-4 bg-white rounded-b-lg shadow-md">
        <div class="flex flex-row">
          <div class="basis-1/2">
            <p class="font-bold text-MD">
              {{ payloadDetail.patient.name || "-" }}
            </p>
            <p>{{ payloadDetail.noReg }}</p>
            <CustomButton class="w-24 h-5 text-sm">{{
              payloadDetail.noRm
            }}</CustomButton>
            <CustomChip
              :showCheckedIcon="false"
              label="Laki-laki"
              bgColor="bg-male-75"
              textColor="text-male-300"
              customClass="h-5 pr-[6px] border-none mr-[5px] ml-2"
            /><!-- Bilang ke Nafisa kurang data gender -->
            <!-- <CustomChip
              :showCheckedIcon="false"
              label="Perempuan"
              bgColor="bg-female-75"
              textColor="text-female-300"
              customClass="h-5 pr-[6px] border-none mr-[5px]"
            /> -->
          </div>
          <div class="bg-mediumGrey-300 w-[1px] h-[70px] mr-[20px]"></div>
          <div class="basis-1/4">
            <p class="text-xs font-bold underline underline-offset-2 mt-[15px]">
              Tgl. Lahir
            </p>
            <p class="">{{ payloadDetail.patient.birthDetail.tanggalLahir }}</p>
          </div>
          <div class="basis-1/4">
            <p class="text-xs font-bold underline underline-offset-2 mt-[15px]">
              Umur
            </p>
            <p class="">{{ payloadDetail.patient.birthDetail.umur }}</p>
          </div>
        </div>
        <!-- Asesmen Medis -->
        <div class="grid grid-cols-1">
          <CustomAccordion no-border initial-state="0">
            <template #header>
              <div class="">Asesmen Medis</div>
            </template>
            <template #content>
              <div class="flex flex-row mt-[20px]">
                <div class="basis-1/2">
                  <div class="grid grid-cols-2">
                    <div>
                      <p class="text-xs font-bold underline underline-offset-2">
                        Keluhan Utama
                      </p>
                      <p>
                        {{
                          assesmentMedisPayload?.summary?.keluhanUtama || "-"
                        }}
                      </p>
                    </div>
                    <div>
                      <p class="text-xs font-bold underline underline-offset-2">
                        Alergi
                      </p>
                      <p>
                        {{ assesmentMedisPayload?.summary?.namaAlergi || "-" }}
                      </p>
                    </div>
                    <div>
                      <p
                        class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                      >
                        Dokter Pengirim
                        <span>
                          <CustomButton
                            class="h-[20px] w-[40px] text-xs ml-[10px]"
                            outlined
                            borderColor="border-grey-300"
                            textColor="text-grey-300"
                            >Poli</CustomButton
                          >
                        </span>
                      </p>
                      <p>
                        {{
                          assesmentMedisPayload?.summary?.diagnosisDokter?.[0]
                            ?.petugas || "-"
                        }}
                      </p>
                    </div>
                  </div>
                </div>
                <div class="bg-mediumGrey-300 w-[1px] h-[85px] mr-[20px]"></div>
                <div class="basis-1/4">
                  <p class="text-xs font-bold underline underline-offset-2">
                    Diagnosa Primer
                  </p>
                  <p class="">
                    {{
                      assesmentMedisPayload?.summary?.diagnosisDokter?.[0]
                        ?.diagnosis || "-"
                    }}
                  </p>
                </div>
                <div class="basis-1/4">
                  <p class="text-xs font-bold underline underline-offset-2">
                    Diferensial
                  </p>
                  <p class="">
                    {{
                      assesmentMedisPayload?.summary?.diagnosisDokter?.[0]
                        ?.diferensial || "-"
                    }}
                  </p>
                </div>
              </div>
            </template>
            <template #collapseIcon>
              <CustomButton
                icon="PhCaretUp"
                backgroundColor="bg-transparent"
                textColor="text-opensimrs-300"
              />
            </template>
            <template #expandIcon>
              <CustomButton
                icon="PhCaretDown"
                backgroundColor="bg-transparent"
                textColor="text-opensimrs-300"
              />
            </template>
          </CustomAccordion>
        </div>
        <!-- List Alkes -->
        <div class="grid grid-cols-1">
          <CustomAccordion no-border initial-state="0">
            <template #header>List Alkes</template>
            <template #content>
              <div
                v-for="(items, index) in payloadDetail.alkesItems"
                :key="items.uuid || index"
              >
                <div class="mt-[20px] p-4 rounded-t-lg bg-opensimrs-50 shadow-md">
                  <div class="grid grid-cols-2 gap-2">
                    <div class="flex">
                      <CustomButton class="h-7 text-sm">{{
                        index + 1
                      }}</CustomButton>
                      <p class="my-auto ml-2 text-sm font-bold">
                        {{ items?.itemMedis?.name || "-" }}
                      </p>
                      <PhArrowRight
                        :size="20"
                        class="my-auto ml-2 text-success-300"
                        weight="bold"
                      />
                      <p class="my-auto ml-2 text-sm font-bold">
                        {{ items.qty }} Pcs
                      </p>
                    </div>
                    <div class="flex justify-end">
                      <CustomButton
                        label=""
                        background-color="bg-[#3D84E5] rounded-lg"
                        class="h-6 w-[26px] p-0"
                        @click="openEditDialog(items)"
                      >
                        <img src="@/assets/icons/edit.svg" alt="" />
                      </CustomButton>
                    </div>
                  </div>
                </div>
                <div
                  class="h-[140px] p-4 overflow-auto bg-white rounded-b-lg shadow-md"
                >
                  <DataTable
                    :value="items.listAlkes"
                    :pt="{ headerRow: 'text-SM' }"
                  >
                    <!-- Stok Alkes -->
                    <Column header="Stok Alkes">
                      <template #body="slotProps">
                        <div class="">
                          <CustomSelect
                            :key="`${payloadDetail.uuid}-${items.itemMedisUuid}`"
                            v-model="slotProps.data.stokAlkes"
                            @update:model-value="
                              (val) => updateStokAlkes(val, index)
                            "
                            :show-label="false"
                            place-holder="Pilih Stok"
                            optionLabel="detailStok.name"
                            optionValue=""
                            :options="
                              MedicalItemPayload[items.itemMedisUuid] || []
                            "
                          />
                        </div>
                      </template>
                    </Column>
                    <!-- Sisa Stok -->
                    <Column header="Sisa Stok">
                      <template #body="slotProps">
                        <div>
                          <p class="text-sm">{{ slotProps.data.sisaStok }}</p>
                        </div>
                      </template>
                    </Column>
                    <!-- Harga Satuan -->
                    <Column header="Harga Satuan">
                      <template #body="slotProps">
                        <div>
                          <p class="text-sm">
                            {{ formatPrice(slotProps.data.hargaSatuan) }}
                          </p>
                        </div>
                      </template>
                    </Column>
                    <!-- Total -->
                    <Column header="Sub. Total">
                      <template #body="slotProps">
                        <div class="text-sm">
                          {{ formatPrice(slotProps.data.total) }}
                        </div>
                      </template>
                    </Column>
                  </DataTable>
                </div>
              </div>
            </template>
            <template #collapseIcon>
              <CustomButton
                icon="PhCaretUp"
                backgroundColor="bg-transparent"
                textColor="text-opensimrs-300"
              />
            </template>
            <template #expandIcon>
              <CustomButton
                icon="PhCaretDown"
                backgroundColor="bg-transparent"
                textColor="text-opensimrs-300"
              />
            </template>
          </CustomAccordion>
        </div>
        <!-- Petugas Order -->
        <div class="grid grid-cols-1">
          <card class="bg-opensimrs-50">
            <template #content>
              <div class="flex flex-row">
                <div class="basis-1/4">
                  <p class="text-xs font-bold underline underline-offset-2">
                    Petugas Order
                  </p>
                  <p class="">{{ payloadDetail.petugasOrder }}</p>
                </div>
                <div class="basis-1/2">
                  <div class="flex">
                    <div
                      class="bg-opensimrs-300 w-[1px] h-[40px] mr-[20px]"
                    ></div>
                    <p class="font-bold mt-[7px]">Total Tagihan Order</p>
                  </div>
                </div>
                <div class="basis-1/4">
                  <p class="text-base font-bold text-right mt-[7px]">
                    {{ formatPrice(totalTagihan) }}
                  </p>
                </div>
              </div>
            </template>
          </card>
        </div>
        <hr class="mt-5 border-[1px] border-grey-200" />
        <!-- Verifikasi -->
        <div class="flex justify-between items-center py-5">
          <div class="flex gap-2">
            <CustomButton
              label="Batal Order"
              backgroundColor="bg-danger-300"
              borderColor="border-danger-300"
              textColor="text-white"
              @click="openCancelDialog(payloadDetail)"
            />
            <CustomButton
              label="Pindah Lokasi Order"
              class=""
              @click="openMovingLocationDialog(payloadDetail)"
            />
            <CustomButton @click="printOrderAlkes">
              <div class="flex gap-2 items-center">
                <PhPrinter :size="18" color="#ffffff" weight="fill" />
                <div class="text-sm">Cetak</div>
              </div>
            </CustomButton>
          </div>
          <CustomButton
            :disabled="activedVerif"
            @click="verify"
            label="Verifikasi"
            class=""
          />
        </div>
      </div>
    </div>
  </div>

  <!-- Cetak Dialog -->
  <CustomDialog v-model:visible="cetakDialog" width="500px">
    <template #header>Cetak</template>
    <template #body>
      <div class="flex gap-3 mt-[20px]">
        <CustomButton>
          <div class="flex gap-2 items-center">
            <PhPrinter :size="18" colorc="#ffffff" weight="fill" />
            <div class="text-sm">E-Tiket</div>
          </div>
        </CustomButton>
        <CustomButton>
          <div class="flex gap-2 items-center">
            <PhPrinter :size="18" colorc="#ffffff" weight="fill" />
            <div class="text-sm">E-Resep</div>
          </div>
        </CustomButton>
        <CustomButton>
          <div class="flex gap-2 items-center">
            <PhPrinter :size="18" colorc="#ffffff" weight="fill" />
            <div class="text-sm">Salinan E-Resep</div>
          </div>
        </CustomButton>
      </div>
    </template>
  </CustomDialog>
  <DialogAlkes
    v-model:isDialogVisible="editDialog"
    :payloadEdit="editDialogConfig.data"
    @data-updated="IncomingDetail"
  />
  <DialogCancel
    v-model:isDialogVisible="cancelDialog"
    :payloadCancel="cancelDialogConfig.data"
    @data-updated="closeDetail"
  />
  <DialogMoving
    v-model:isDialogVisible="movingLocationDialog"
    :payloadMoving="movingLocationDialogConfig.data"
    @data-updated="closeDetail"
  />
</template>
