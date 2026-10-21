<script lang="ts" setup>
import { onMounted, ref, watch } from "vue";
import { formatPrice } from "@/utils/Helpers";
import { useDrugReturStore } from "@/stores/farmasi/DrugRetur";
import { utilsStore } from "@/stores/utils";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";

const props = defineProps({
  isDialogVisible: {
    default: false,
  },
  selectMedicine: {
    type: String,
  },
  payloadAlkes: {
    type: Object,
    default: () => ({}),
  },
});

function formatDate(date: any) {
  const parsedDate = new Date(date);
  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");

  return `${day}-${month}-${year}`;
}

function formatDate2(date: any) {
  const parsedDate = new Date(date);
  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const emit = defineEmits(["update:isDialogVisible", "close"]);

const updateVisibility = (value: any) => {
  emit("update:isDialogVisible", value);
};

const updateQtyAlkes = () => {
  totalRetur.value = 0;
  DrugReturAlkesDetailPayload.value.forEach((item) => {
    totalRetur.value += item.detail[0].qtyRetur * item.detail[0].price;
  });
};

// State Management
const alasan = ref("");
const totalRetur = ref(0);
const DrugReturStore = useDrugReturStore();
const UseUtilsStore = utilsStore();
const DrugReturAlkesDetailPayload = ref<any[]>([]);

// Fetch Drug Retur Detail
const fetchDrugReturDetail = async (uuid: string) => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await DrugReturStore.getApiDetailAlkes(uuid);

    if (response && response.payload) {
      DrugReturAlkesDetailPayload.value = response.payload;
    } else {
      DrugReturAlkesDetailPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    DrugReturAlkesDetailPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const assesmentMedisPayload = ref<any>([]);

const fetchAssesmentMedis = async (rekamMedisUuid: string) => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await DrugReturStore.getAssesmentMedis(rekamMedisUuid);

    assesmentMedisPayload.value = response.payload;
    console.log("fetchAssesmentMedis retur:", assesmentMedisPayload.value);
  } catch (error) {
    console.error("Failed to fetch data", error);
    assesmentMedisPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const onSubmit = async () => {
  const items: any[] = [];

  for (const item of DrugReturAlkesDetailPayload.value) {
    for (const detailItem of item.detail) {
      const newQtyRetur = detailItem.qtyRetur;
      const newExpDate = detailItem.expDate;
      const newOrderAlkes = detailItem.uuid;

      items.push({
        order_alkes_item_uuid: newOrderAlkes,
        qty_retur: newQtyRetur,
        expired_date: newExpDate,
      });
    }
  }

  try {
    const response = await DrugReturStore.createApi({
      jenis_retur: props.selectMedicine,
      order_alkes_uuid: props.payloadAlkes.uuid,
      alasan_retur: alasan.value,
      items: items.filter((i) => Number(i.qty_retur) > 0),
    });
    // dialog ditutup hanya bila retur tersimpan; galat (mis. melebihi sisa) ditampilkan apiHandler
    if (response) emit("update:isDialogVisible", false);
  } catch (error) {
    console.error("Error in API call:", error);
  }
};

defineExpose({
  fetchDrugReturDetail,
});

watch(
  [() => props.payloadAlkes?.rekamMedisUuid, () => props.isDialogVisible],
  ([uuid, visible]) => {
    if (visible && uuid) {
      fetchAssesmentMedis(uuid);
    }
  },
  { immediate: true }
);

onMounted(() => {
  alasan.value = "";
});
</script>

<template>
  <CustomDialog
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    width="1000px"
  >
    <template #header
      >Retur Alkes - {{ props.payloadAlkes.noOrderAlkes }}</template
    >
    <template #body>
      <div class="pt-5">
        <!-- Nama lengkap pasien -->
        <div class="flex flex-row">
          <div class="basis-1/4">
            <p class="font-bold text-MD">
              {{ props.payloadAlkes?.patient?.name || "-" }}
            </p>
            <p>{{ props.payloadAlkes?.noReg || "-" }}</p>
            <CustomButton class="w-24 h-5 text-sm">{{
              props.payloadAlkes?.noRm || "-"
            }}</CustomButton>
            <CustomChip
              :showCheckedIcon="false"
              :label="
                (props.payloadAlkes?.patient?.gender || '').toLowerCase() ===
                'male'
                  ? 'Laki-laki'
                  : (
                      props.payloadAlkes?.patient?.gender || ''
                    ).toLowerCase() === 'female'
                  ? 'Perempuan'
                  : '-'
              "
              :bgColor="
                (props.payloadAlkes?.patient?.gender || '').toLowerCase() ===
                'male'
                  ? 'bg-male-75'
                  : (
                      props.payloadAlkes?.patient?.gender || ''
                    ).toLowerCase() === 'female'
                  ? 'bg-female-75'
                  : 'bg-grey-100'
              "
              :textColor="
                (props.payloadAlkes?.patient?.gender || '').toLowerCase() ===
                'male'
                  ? 'text-male-300'
                  : (
                      props.payloadAlkes?.patient?.gender || ''
                    ).toLowerCase() === 'female'
                  ? 'text-female-300'
                  : 'text-grey-300'
              "
              customClass="h-5 pr-[6px] border-none mr-[5px] ml-2"
            />
            <!-- <CustomChip
              :showCheckedIcon="false"
              label="Perempuan"
              bgColor="bg-female-75"
              textColor="text-female-300"
              customClass="h-5 pr-[6px] border-none mr-[5px]"
            /> -->
          </div>
          <div class="bg-mediumGrey-300 w-[1px] h-[85px] mr-[20px]"></div>
          <div class="mt-[20px] mr-[40px]">
            <p class="text-xs font-bold underline underline-offset-2">
              Tgl. Lahir
            </p>
            <p class="">
              {{
                props.payloadAlkes?.patient?.birthDetail?.tanggalLahir || "-"
              }}
            </p>
          </div>
          <div class="mt-[20px] mr-[40px]">
            <p class="text-xs font-bold underline underline-offset-2">Umur</p>
            <p class="">
              {{ props.payloadAlkes?.patient?.birthDetail?.umur || "-" }}
            </p>
          </div>
        </div>
        <!-- Asesmen Medis -->
        <div class="grid grid-cols-1">
          <CustomAccordion no-border initial-state="0">
            <template #header>Asesmen Medis</template>
            <template #content>
              <div class="flex flex-row mt-[20px]">
                <div class="basis-1/4">
                  <p class="text-xs font-bold underline underline-offset-2">
                    Dokter Pengirim
                  </p>
                  <p>
                    {{
                      assesmentMedisPayload?.summary?.diagnosisDokter?.[0]
                        ?.petugas || "-"
                    }}
                  </p>
                  <p
                    class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                  >
                    Catatan <span> </span>
                  </p>
                  <p>-</p>
                </div>
                <div class="basis-1/4">
                  <p class="text-xs font-bold underline underline-offset-2">
                    Keluhan Utama
                  </p>
                  <p>
                    {{ assesmentMedisPayload?.summary?.keluhanUtama || "-" }}
                  </p>
                  <p
                    class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                  >
                    Alergi <span> </span>
                  </p>
                  <p>
                    {{ assesmentMedisPayload?.summary?.namaAlergi || "-" }}
                  </p>
                </div>
                <div class="bg-mediumGrey-300 w-[1px] h-[85px] mr-[20px]"></div>
                <div class="mr-[40px]">
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
                <div class="mr-[40px]">
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
      </div>

      <div class="grid grid-cols-1">
        <div
          v-for="(items, index) in DrugReturAlkesDetailPayload"
          :key="index"
          class="mt-[20px]"
        >
          <card class="bg-opensimrs-50">
            <template #content>
              <div class="flex justify-between">
                <div class="flex">
                  <CustomButton class="h-7 text-sm"
                    >0{{ index + 1 }}</CustomButton
                  >
                  <p class="ml-2 text-base font-bold">{{ items.name }}</p>
                  <PhArrowRight
                    :size="20"
                    class="my-auto ml-2 text-success-300"
                    weight="bold"
                  />
                  <p class="ml-2 text-base font-bold">
                    {{ items.availableQty }}
                  </p>
                </div>
              </div>
            </template>
          </card>
          <div class="pt-5 mt-[-20px]">
            <DataTable
              :value="items.detail"
              class="overflow-hidden rounded-[10px]"
              scrollable
              scrollHeight="flex"
              :pt="{ headerRow: 'text-SM' }"
            >
              <!-- Jenis Stok -->
              <Column header="Jenis Stok">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.jenisStok }}</div>
                </template>
              </Column>
              <!-- Exp Date -->
              <Column header="Exp. Date">
                <template #body="slotProps">
                  <div class="text-SM">
                    {{ formatDate(slotProps.data.expDate) }}
                  </div>
                </template>
              </Column>
              <!-- Terima Retur -->
              <Column header="Terima Retur">
                <template #body="slotProps">
                  <CustomInputNumber
                    v-model="slotProps.data.qtyRetur"
                    @update:model-value="updateQtyAlkes"
                    label=""
                    class="w-[100px]"
                  >
                  </CustomInputNumber>
                </template>
              </Column>
              <!-- Harga -->
              <Column header="Harga">
                <template #body="slotProps">
                  <div class="text-SM">
                    {{ formatPrice(slotProps.data.price) }}
                  </div>
                </template>
              </Column>
              <!-- Total -->
              <Column header="Total">
                <template #body="slotProps">
                  <div class="text-SM">
                    {{
                      formatPrice(
                        slotProps.data.qtyRetur * slotProps.data.price || 0
                      )
                    }}
                  </div>
                </template>
              </Column>
            </DataTable>
          </div>
        </div>
      </div>
      <!-- Total Retur -->
      <div class="mt-4">
        <card class="bg-opensimrs-50">
          <template #content>
            <div class="flex justify-between">
              <p class="text-base font-bold">Total Retur</p>
              <p class="text-base font-bold">{{ formatPrice(totalRetur) }}</p>
            </div>
          </template>
        </card>
      </div>
      <!-- Alasan Retur -->
      <div class="grid grid-cols-1">
        <div>
          <p class="mt-[20px] font-bold">Alasan Retur</p>
        </div>
        <div class="mt-[5px]">
          <CustomTextfield
            v-model="alasan"
            :showLabel="false"
            placeholder="Alasan Retur"
          />
        </div>
      </div>
      <hr class="mt-5 border-[1px] border-grey-200" />
      <div class="flex justify-end">
        <div class="mt-3">
          <p class="text-xs font-bold text-right underline underline-offset-2">
            Diretur Oleh
          </p>
          <p>Nama Petugas</p>
        </div>
        <div class="mt-3">
          <div class="bg-mediumGrey-300 w-[1px] h-[33px] ml-[20px] mt-1"></div>
        </div>
        <div class="mt-3">
          <CustomButton
            label="Batal"
            outlined
            borderColor="border-grey-300"
            textColor="text-grey-300"
            class="ml-[20px]"
          />
          <CustomButton label="Retur" class="ml-[10px]" @click="onSubmit" />
        </div>
      </div>
    </template>
  </CustomDialog>
</template>
