<script lang="ts" setup>
import { computed, onMounted, ref, watch } from "vue";
import { formatPrice, formatStringDate } from "@/utils/Helpers";
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
  payloadObat: {
    type: Object,
    default: () => ({}),
  },
});

const userName = (() => {
  try {
    const raw = localStorage.getItem("user");
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed?.name ?? "-";
  } catch {
    return "-";
  }
})();

const birthDateDisplay = computed(() => {
  const iso = props.payloadObat?.patient?.birthDetail?.birthDate || "";
  if (!iso) return "-";
  const formatted = formatStringDate(iso, "date");
  if (!formatted) return "-";
  const [dd, mm, yyyy] = formatted.split("-");
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const monthName = months[Number(mm) - 1] || mm;
  return `${dd} ${monthName} ${yyyy}`;
});

const emit = defineEmits(["update:isDialogVisible", "close"]);

const updateVisibility = (value: any) => {
  emit("update:isDialogVisible", value);
};

const updateQtyObat = () => {
  totalRetur.value = 0;
  DrugReturObatDetailPayload.value.forEach((item) => {
    totalRetur.value += item.detail[0].qtyRetur * item.detail[0].price;
  });
};

// State Management
const alasan = ref("");
const totalRetur = ref(0);
const DrugReturStore = useDrugReturStore();
const UseUtilsStore = utilsStore();
const DrugReturObatDetailPayload = ref<any[]>([]);

// Fetch Drug Retur Detail
const fetchDrugReturDetail = async (uuid: string) => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await DrugReturStore.getApiDetailObat(uuid);

    if (response && response.payload) {
      DrugReturObatDetailPayload.value = response.payload;
    } else {
      DrugReturObatDetailPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    DrugReturObatDetailPayload.value = [];
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

  for (const item of props.payloadObat?.obat) {
    console.log("item:", item);
    const expired =
      Array.isArray(item.stokMedisUuides) && item.stokMedisUuides.length
        ? item.stokMedisUuides.expiredDate
        : "";
    if (item.qtyRetur && item.qtyRetur > 0) {
      items.push({
        order_obat_item_uuid: item.uuid,
        qty_retur: item.qtyRetur,
        expired_date: expired,
      });
    }
  }

  try {
    const response = await DrugReturStore.createApi({
      jenis_retur: props.selectMedicine,
      prescription_uuid: props.payloadObat.uuid,
      alasan_retur: alasan.value,
      items,
    });
    console.log("API Response:", response);
  } catch (error) {
    console.error("Error in API call:", error);
  }
  emit("update:isDialogVisible", false);
};

defineExpose({
  fetchDrugReturDetail,
});

watch(
  () => props.payloadObat?.rekamMedisUuid,
  (uuid) => {
    if (uuid) {
      fetchAssesmentMedis(uuid);
    }
  },
  { immediate: true }
);

watch(
  () => props.payloadObat?.obat,
  (list) => {
    if (Array.isArray(list)) {
      list.forEach((it: any) => {
        if (typeof it.qtyRetur !== "number") it.qtyRetur = 0;
      });
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
    <template #header>Retur Obat - {{ props.payloadObat.noResep }}</template>
    <template #body>
      <div>
        <div class="pt-5">
          <!-- Nama lengkap pasien -->
          <div class="flex flex-row">
            <div class="basis-1/4">
              <p class="font-bold text-MD">
                {{ props.payloadObat.patient.name }}
              </p>
              <p>{{ props.payloadObat.noReg }}</p>
              <CustomButton class="w-24 h-5 text-sm">{{
                props.payloadObat.noRm
              }}</CustomButton>
              <CustomChip
                :showCheckedIcon="false"
                :label="
                  (props.payloadObat?.patient?.gender || '').toLowerCase() ===
                  'male'
                    ? 'Laki-laki'
                    : (
                        props.payloadObat?.patient?.gender || ''
                      ).toLowerCase() === 'female'
                    ? 'Perempuan'
                    : '-'
                "
                :bgColor="
                  (props.payloadObat?.patient?.gender || '').toLowerCase() ===
                  'male'
                    ? 'bg-male-75'
                    : (
                        props.payloadObat?.patient?.gender || ''
                      ).toLowerCase() === 'female'
                    ? 'bg-female-75'
                    : 'bg-grey-100'
                "
                :textColor="
                  (props.payloadObat?.patient?.gender || '').toLowerCase() ===
                  'male'
                    ? 'text-male-300'
                    : (
                        props.payloadObat?.patient?.gender || ''
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
              <p class="">{{ birthDateDisplay }}</p>
            </div>
            <div class="mt-[20px] mr-[40px]">
              <p class="text-xs font-bold underline underline-offset-2">Umur</p>
              <p class="">
                {{ props.payloadObat.patient.birthDetail.ageYear }}Thn
                {{ props.payloadObat.patient.birthDetail.ageMonth }}Bln
                {{ props.payloadObat.patient.birthDetail.ageDay }}Hari
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
                  <div
                    class="bg-mediumGrey-300 w-[1px] h-[85px] mr-[20px]"
                  ></div>
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
            v-for="(items, index) in props.payloadObat.obat"
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
                    <p class="ml-2 text-base font-bold">
                      {{ items.itemMedis?.name || "-" }}
                    </p>
                    <PhArrowRight
                      :size="20"
                      class="my-auto ml-2 text-success-300"
                      weight="bold"
                    />
                    <p class="ml-2 text-base font-bold">
                      {{ items.medicationQty ?? "-" }}
                    </p>
                    <p class="ml-2 text-base font-bold">
                      {{ items.itemMedis?.satuanPenggunaan?.name || "-" }}
                    </p>
                  </div>
                </div>
              </template>
            </card>
            <div class="pt-5 mt-[-20px]">
              <DataTable
                :value="[items]"
                class="overflow-hidden rounded-[10px]"
                scrollable
                scrollHeight="flex"
                :pt="{ headerRow: 'text-SM' }"
              >
                <!-- Jenis Stok -->
                <Column header="Jenis Stok">
                  <template #body="slotProps">
                    <div class="text-SM">
                      {{ slotProps.data?.jenisStok?.name || "-" }}
                    </div>
                  </template>
                </Column>
                <!-- Exp Date -->
                <Column header="Exp. Date">
                  <template #body="slotProps">
                    <div class="text-SM">
                      {{ slotProps.data.stokMedisUuides?.expiredDate || "-" }}
                    </div>
                  </template>
                </Column>
                <!-- Terima Retur -->
                <Column header="Terima Retur">
                  <template #body="slotProps">
                    <CustomInputNumber
                      v-model="slotProps.data.qtyRetur"
                      @update:model-value="updateQtyObat"
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
                      {{
                        formatPrice(
                          slotProps.data?.hargaSatuan ??
                            slotProps.data?.total ??
                            0
                        )
                      }}
                    </div>
                  </template>
                </Column>
                <!-- Total -->
                <Column header="Total">
                  <template #body="slotProps">
                    <div class="text-SM">
                      {{
                        formatPrice(
                          (slotProps.data?.qtyRetur || 0) *
                            (slotProps.data?.hargaSatuan ??
                              slotProps.data?.total ??
                              0)
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
            <p
              class="text-xs font-bold text-right underline underline-offset-2"
            >
              Diretur Oleh
            </p>
            <p class="">{{ userName }}</p>
          </div>
          <div class="mt-3">
            <div
              class="bg-mediumGrey-300 w-[1px] h-[33px] ml-[20px] mt-1"
            ></div>
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
      </div>
    </template>
  </CustomDialog>
</template>
