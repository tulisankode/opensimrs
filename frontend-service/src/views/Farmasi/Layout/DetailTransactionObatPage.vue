<script lang="ts" setup>
import { ref, watch } from "vue";
import { formatPrice, epochToDate } from "@/utils/Helpers";
import { useTransactionHistoryStore } from "@/stores/farmasi/TransactionHistory";
import { utilsStore } from "@/stores/utils";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import { useDrugReturStore } from "@/stores/farmasi/DrugRetur";

const props = defineProps({
  isDialogVisible: {
    default: false,
  },
  filterItem: {
    type: String,
    required: true,
  },
  filterStatus: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);

const updateVisibility = (value: any) => {
  emit("update:isDialogVisible", value);
};

// State Management
const TransactionHistoryStore = useTransactionHistoryStore();
const UseUtilsStore = utilsStore();
const TransactionHistoryObatDetailPayload = ref<any>({});

// Fetch Drug Retur Detail
const fetchTransactionHistoryDetail = async (uuid: string) => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await TransactionHistoryStore.getApiDetail({
      item_type: props.filterItem,
      status_type: props.filterStatus,
      uuid: uuid,
    });

    if (response && response.payload) {
      TransactionHistoryObatDetailPayload.value = response.payload;
    } else {
      TransactionHistoryObatDetailPayload.value = {};
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    TransactionHistoryObatDetailPayload.value = {};
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const DrugReturStore = useDrugReturStore();
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

defineExpose({
  fetchTransactionHistoryDetail,
});

watch(
  () => TransactionHistoryObatDetailPayload.value?.rekamMedisUuid,
  (uuid) => {
    if (uuid) {
      fetchAssesmentMedis(uuid);
    }
  },
  { immediate: true }
);
</script>

<template>
  <CustomDialog
    :visible="isDialogVisible"
    @update:visible="updateVisibility"
    width="1100px"
  >
    <template #header>
      <div class="flex justify-between items-center">
        <div class="flex">
          <p>
            Riwayat Resep - {{ TransactionHistoryObatDetailPayload.noResep }}
          </p>
          <CustomChip
            :label="TransactionHistoryObatDetailPayload.paymentMethod"
            :showCheckedIcon="false"
            borderColor="border-opensimrs-300"
            bgColor="bg-opensimrs-50"
            textColor="text-opensimrs-300"
            customClass="h-6"
            class="ml-[5px]"
          />
        </div>
        <div></div>
        <div class="flex ml-[470px]">
          <div class="bg-white w-[1px] h-[30px]"></div>
          <p class="text-sm ml-[15px] mt-[3px]">
            Tgl. Order :
            {{
              epochToDate(TransactionHistoryObatDetailPayload.orderDate, "date")
            }}
          </p>
        </div>
      </div>
    </template>
    <template #body>
      <div class="pt-5">
        <div class="flex flex-row">
          <div class="basis-1/4">
            <p class="font-bold text-MD">
              {{ TransactionHistoryObatDetailPayload.patient?.name }}
            </p>
            <p>{{ TransactionHistoryObatDetailPayload.noReg }}</p>
            <CustomButton class="w-24 h-5 text-sm">{{
              TransactionHistoryObatDetailPayload.noRm
            }}</CustomButton>
            <CustomChip
              :showCheckedIcon="false"
              :label="
                (
                  TransactionHistoryObatDetailPayload?.patient?.gender || ''
                ).toLowerCase() === 'male'
                  ? 'Laki-laki'
                  : (
                      TransactionHistoryObatDetailPayload?.patient?.gender || ''
                    ).toLowerCase() === 'female'
                  ? 'Perempuan'
                  : '-'
              "
              :bgColor="
                (
                  TransactionHistoryObatDetailPayload?.patient?.gender || ''
                ).toLowerCase() === 'male'
                  ? 'bg-male-75'
                  : (
                      TransactionHistoryObatDetailPayload?.patient?.gender || ''
                    ).toLowerCase() === 'female'
                  ? 'bg-female-75'
                  : 'bg-grey-100'
              "
              :textColor="
                (
                  TransactionHistoryObatDetailPayload?.patient?.gender || ''
                ).toLowerCase() === 'male'
                  ? 'text-male-300'
                  : (
                      TransactionHistoryObatDetailPayload?.patient?.gender || ''
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
                epochToDate(
                  TransactionHistoryObatDetailPayload.patient?.birthDetail
                    ?.birthDate,
                  "date"
                ) || "-"
              }}
            </p>
          </div>
          <div class="mt-[20px] mr-[40px]">
            <p class="text-xs font-bold underline underline-offset-2">Umur</p>
            <p class="">
              {{
                TransactionHistoryObatDetailPayload.patient?.birthDetail
                  ?.ageYear || "-"
              }}Thn
              {{
                TransactionHistoryObatDetailPayload.patient?.birthDetail
                  ?.ageMonth || "-"
              }}Bln
              {{
                TransactionHistoryObatDetailPayload.patient?.birthDetail
                  ?.ageDay || "-"
              }}Hari
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
                    Keluhan Utama
                  </p>
                  <p>
                    {{ assesmentMedisPayload?.summary?.keluhanUtama || "-" }}
                  </p>
                  <p
                    class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                  >
                    Dokter Pengirim
                  </p>
                  <p>
                    {{
                      assesmentMedisPayload?.summary?.diagnosisDokter?.[0]
                        ?.petugas || "-"
                    }}
                  </p>
                </div>
                <div class="basis-1/4">
                  <p
                    class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                  >
                    Alergi
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
        <!-- Status Verifikasi Resep -->
        <div
          class="grid grid-cols-1"
          v-if="
            TransactionHistoryObatDetailPayload.itemType == 'obat' &&
            TransactionHistoryObatDetailPayload.statusType == 'resep'
          "
        >
          <CustomAccordion no-border initial-state="0">
            <template #header>Status Verifikasi</template>
            <template #content>
              <div class="mt-[20px]">
                <DataTable
                  :value="TransactionHistoryObatDetailPayload.history"
                  class="text-xs"
                  scrollable
                  scrollHeight="flex"
                >
                  <!-- Resep -->
                  <Column header="Step" headerClass="bg-opensimrs-50">
                    <template #body="slotProps">
                      <p class="">{{ slotProps.index + 1 }}</p>
                    </template>
                  </Column>

                  <!-- Proses -->
                  <Column header="Proses" headerClass="bg-opensimrs-50">
                    <template #body="slotProps">
                      <div class="text-SM">
                        <p class="font-bold underline underline-offset-2">
                          {{ slotProps.data.status }}
                        </p>
                      </div>
                      <div class="">
                        <p>{{ slotProps.data.petugas }}</p>
                      </div>
                    </template>
                  </Column>

                  <!-- Tanggal -->
                  <Column header="Tanggal" headerClass="bg-opensimrs-50">
                    <template #body="slotProps">
                      <div>
                        <p class="text-sm">
                          {{ epochToDate(slotProps.data.date, "date") }}
                        </p>
                      </div>
                    </template>
                  </Column>

                  <!-- Jam -->
                  <Column header="Jam" headerClass="bg-opensimrs-50">
                    <template #body="slotProps">
                      <div class="">
                        <p class="text-sm">
                          {{ epochToDate(slotProps.data.date, "time") }}
                        </p>
                      </div>
                    </template>
                  </Column>
                </DataTable>
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
        <!-- Status Verifikasi Retur -->
        <div
          class="grid grid-cols-1"
          v-if="
            TransactionHistoryObatDetailPayload.itemType == 'obat' &&
            TransactionHistoryObatDetailPayload.statusType == 'retur'
          "
        >
          <CustomAccordion no-border initial-state="0">
            <template #header>Status Retur</template>
            <template #content>
              <div class="mt-[20px]">
                <DataTable
                  :value="TransactionHistoryObatDetailPayload.history"
                  class="text-xs"
                  scrollable
                  scrollHeight="flex"
                >
                  <!-- Resep -->
                  <Column header="Step" headerClass="bg-opensimrs-50">
                    <template #body="slotProps">
                      <p class="">{{ slotProps.index + 1 }}</p>
                    </template>
                  </Column>

                  <!-- Proses -->
                  <Column header="Proses" headerClass="bg-opensimrs-50">
                    <template #body="slotProps">
                      <div class="text-SM">
                        <p class="font-bold underline underline-offset-2">
                          {{ slotProps.data.status }}
                        </p>
                      </div>
                      <div class="">
                        <p>{{ slotProps.data.petugas }}</p>
                      </div>
                    </template>
                  </Column>

                  <!-- Tanggal -->
                  <Column header="Tanggal" headerClass="bg-opensimrs-50">
                    <template #body="slotProps">
                      <div>
                        <p class="text-sm">
                          {{ epochToDate(slotProps.data.date, "date") }}
                        </p>
                      </div>
                    </template>
                  </Column>

                  <!-- Jam -->
                  <Column header="Jam" headerClass="bg-opensimrs-50">
                    <template #body="slotProps">
                      <div class="">
                        <p class="text-sm">
                          {{ epochToDate(slotProps.data.date, "time") }}
                        </p>
                      </div>
                    </template>
                  </Column>
                </DataTable>
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
        <!-- Status Verifikasi Batal -->
        <div
          class="grid grid-cols-1"
          v-if="
            TransactionHistoryObatDetailPayload.itemType == 'obat' &&
            TransactionHistoryObatDetailPayload.statusType == 'batal'
          "
        >
          <CustomAccordion no-border initial-state="0">
            <template #header>Status Verifikasi & Batal</template>
            <template #content>
              <div class="mt-[20px]">
                <DataTable
                  :value="TransactionHistoryObatDetailPayload.history"
                  class="text-xs"
                  scrollable
                  scrollHeight="flex"
                >
                  <!-- Resep -->
                  <Column header="Step" headerClass="bg-opensimrs-50">
                    <template #body="slotProps">
                      <p class="">{{ slotProps.index + 1 }}</p>
                    </template>
                  </Column>

                  <!-- Proses -->
                  <Column header="Proses" headerClass="bg-opensimrs-50">
                    <template #body="slotProps">
                      <div class="text-SM">
                        <p class="font-bold underline underline-offset-2">
                          {{ slotProps.data.status }}
                        </p>
                      </div>
                      <div class="">
                        <p>{{ slotProps.data.petugas }}</p>
                      </div>
                    </template>
                  </Column>

                  <!-- Tanggal -->
                  <Column header="Tanggal" headerClass="bg-opensimrs-50">
                    <template #body="slotProps">
                      <div>
                        <p class="text-sm">
                          {{ epochToDate(slotProps.data.date, "date") }}
                        </p>
                      </div>
                    </template>
                  </Column>

                  <!-- Jam -->
                  <Column header="Jam" headerClass="bg-opensimrs-50">
                    <template #body="slotProps">
                      <div class="">
                        <p class="text-sm">
                          {{ epochToDate(slotProps.data.date, "time") }}
                        </p>
                      </div>
                    </template>
                  </Column>
                </DataTable>
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
        <!-- Alasan Retur -->
        <div
          class="grid grid-cols-1"
          v-if="
            TransactionHistoryObatDetailPayload.itemType == 'obat' &&
            TransactionHistoryObatDetailPayload.statusType == 'retur'
          "
        >
          <CustomAccordion no-border initial-state="0">
            <template #header>Alasan Retur</template>
            <template #content>
              <div class="mt-[20px]">
                <p>{{ TransactionHistoryObatDetailPayload.alasanRetur }}</p>
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
        <!-- Alasan Batal -->
        <div
          class="grid grid-cols-1"
          v-if="
            TransactionHistoryObatDetailPayload.itemType == 'obat' &&
            TransactionHistoryObatDetailPayload.statusType == 'batal'
          "
        >
          <CustomAccordion no-border initial-state="0">
            <template #header>Alasan Batal</template>
            <template #content>
              <div class="mt-[20px]">
                <p>{{ TransactionHistoryObatDetailPayload.alasanBatal }}</p>
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
        <!-- Asesmen Medis Resep -->
        <div
          class="grid grid-cols-1"
          v-if="
            TransactionHistoryObatDetailPayload.itemType == 'obat' &&
            TransactionHistoryObatDetailPayload.statusType == 'resep'
          "
        >
          <CustomAccordion no-border initial-state="0">
            <template #header>Asesmen Medis</template>
            <template #content>
              <div
                v-for="(
                  items, index
                ) in TransactionHistoryObatDetailPayload.items"
                :key="index"
                class="mt-[20px]"
              >
                <card class="bg-opensimrs-50">
                  <template #content>
                    <div class="flex justify-between">
                      <div class="flex">
                        <CustomButton class="text-sm h-7"
                          >0{{ index + 1 }}</CustomButton
                        >
                        <p class="ml-2 text-base font-bold">{{ items.name }}</p>
                        <PhArrowRight
                          :size="20"
                          class="my-auto ml-2 text-success-300"
                          weight="bold"
                        />
                        <p class="ml-2 text-base font-bold">{{ items.qty }}</p>
                      </div>
                      <div>
                        <CustomChip
                          v-if="items.isChronic == true"
                          :showCheckedIcon="false"
                          label="OBAT KRONIS"
                          borderColor="border-danger-300"
                          bgColor="bg-none"
                          textColor="text-danger-300"
                          customClass="h-5 border-danger-300"
                        />
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
                    <!-- Stok Obat -->
                    <Column header="Stok Obat">
                      <template #body="slotProps">
                        <div class="text-SM">
                          {{ slotProps.data.jenisStok }}
                        </div>
                      </template>
                    </Column>
                    <!-- Aturan & Cara Pakai -->
                    <Column header="Aturan & Cara Pakai">
                      <template #body="slotProps">
                        <div class="text-SM">
                          {{ slotProps.data.aturanPakai }}
                        </div>
                      </template>
                    </Column>
                    <!-- Satuan -->
                    <Column header="Satuan">
                      <template #body="slotProps">
                        <div class="text-SM">
                          {{ formatPrice(slotProps.data.hargaSatuan) }}
                        </div>
                      </template>
                    </Column>
                    <!-- Jasa Resep -->
                    <Column header="Jasa Resep">
                      <template #body="slotProps">
                        <div class="text-SM">
                          {{ slotProps.data.jasaResep }}
                        </div>
                      </template>
                    </Column>
                    <!-- Total -->
                    <Column header="Total">
                      <template #body="slotProps">
                        <div class="text-SM">
                          {{ formatPrice(slotProps.data.totalHarga) }}
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
        <!-- Daftar Resep / Obat Retur -->
        <div
          class="grid grid-cols-1"
          v-if="
            TransactionHistoryObatDetailPayload.itemType == 'obat' &&
            TransactionHistoryObatDetailPayload.statusType == 'retur'
          "
        >
          <CustomAccordion no-border initial-state="0">
            <template #header>Daftar Resep / Obat</template>
            <template #content>
              <div
                v-for="(
                  items, index
                ) in TransactionHistoryObatDetailPayload.retur"
                :key="index"
                class="mt-[20px]"
              >
                <card class="bg-opensimrs-50">
                  <template #content>
                    <div class="flex justify-between">
                      <div class="flex">
                        <CustomButton class="text-sm h-7"
                          >0{{ index + 1 }}</CustomButton
                        >
                        <p class="ml-2 text-base font-bold">{{ items.name }}</p>
                        <PhArrowRight
                          :size="20"
                          class="my-auto ml-2 text-success-300"
                          weight="bold"
                        />
                        <p class="ml-2 text-base font-bold">{{ items.qty }}</p>
                      </div>
                      <div>
                        <CustomChip
                          v-if="items.isChronic == true"
                          :showCheckedIcon="false"
                          label="OBAT KRONIS"
                          borderColor="border-danger-300"
                          bgColor="bg-none"
                          textColor="text-danger-300"
                          customClass="h-5 border-danger-300"
                        />
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
                    <!-- Stok Obat -->
                    <Column header="Stok Obat">
                      <template #body="slotProps">
                        <div class="text-SM">
                          {{ slotProps.data.jenisStok }}
                        </div>
                      </template>
                    </Column>
                    <!-- Aturan & Cara Pakai -->
                    <Column header="Aturan & Cara Pakai">
                      <template #body="slotProps">
                        <div class="text-SM">
                          {{ slotProps.data.aturanPakai }}
                        </div>
                      </template>
                    </Column>
                    <!-- Satuan -->
                    <Column header="Satuan">
                      <template #body="slotProps">
                        <div class="text-SM">
                          {{ formatPrice(slotProps.data.hargaSatuan) }}
                        </div>
                      </template>
                    </Column>
                    <!-- Jasa Resep -->
                    <Column header="Jasa Resep">
                      <template #body="slotProps">
                        <div class="text-SM">
                          {{ slotProps.data.jasaResep }}
                        </div>
                      </template>
                    </Column>
                    <!-- Total -->
                    <Column header="Total">
                      <template #body="slotProps">
                        <div class="text-SM">
                          {{ formatPrice(slotProps.data.totalHarga) }}
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
        <!-- Daftar Resep / Obat Batal -->
        <div
          class="grid grid-cols-1"
          v-if="
            TransactionHistoryObatDetailPayload.itemType == 'obat' &&
            TransactionHistoryObatDetailPayload.statusType == 'batal'
          "
        >
          <CustomAccordion no-border initial-state="0">
            <template #header>Daftar Resep / Obat</template>
            <template #content>
              <div
                v-for="(
                  items, index
                ) in TransactionHistoryObatDetailPayload.items"
                :key="index"
                class="mt-[20px]"
              >
                <card class="bg-opensimrs-50">
                  <template #content>
                    <div class="flex justify-between">
                      <div class="flex">
                        <CustomButton class="text-sm h-7"
                          >0{{ index + 1 }}</CustomButton
                        >
                        <p class="ml-2 text-base font-bold">{{ items.name }}</p>
                        <PhArrowRight
                          :size="20"
                          class="my-auto ml-2 text-success-300"
                          weight="bold"
                        />
                        <p class="ml-2 text-base font-bold">{{ items.qty }}</p>
                      </div>
                      <div>
                        <CustomChip
                          v-if="items.isChronic == true"
                          :showCheckedIcon="false"
                          label="OBAT KRONIS"
                          borderColor="border-danger-300"
                          bgColor="bg-none"
                          textColor="text-danger-300"
                          customClass="h-5 border-danger-300"
                        />
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
                    <!-- Stok Obat -->
                    <Column header="Stok Obat">
                      <template #body="slotProps">
                        <div class="text-SM">
                          {{ slotProps.data.jenisStok }}
                        </div>
                      </template>
                    </Column>
                    <!-- Aturan & Cara Pakai -->
                    <Column header="Aturan & Cara Pakai">
                      <template #body="slotProps">
                        <div class="text-SM">
                          {{ slotProps.data.aturanPakai }}
                        </div>
                      </template>
                    </Column>
                    <!-- Satuan -->
                    <Column header="Satuan">
                      <template #body="slotProps">
                        <div class="text-SM">
                          {{ formatPrice(slotProps.data.hargaSatuan) }}
                        </div>
                      </template>
                    </Column>
                    <!-- Jasa Resep -->
                    <Column header="Jasa Resep">
                      <template #body="slotProps">
                        <div class="text-SM">
                          {{ slotProps.data.jasaResep }}
                        </div>
                      </template>
                    </Column>
                    <!-- Total -->
                    <Column header="Total">
                      <template #body="slotProps">
                        <div class="text-SM">
                          {{ formatPrice(slotProps.data.totalHarga) }}
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
      </div>

      <!-- Total Tagihan Resep -->
      <div
        class="mt-4"
        v-if="
          TransactionHistoryObatDetailPayload.itemType == 'obat' &&
          TransactionHistoryObatDetailPayload.statusType == 'resep'
        "
      >
        <card class="bg-opensimrs-50">
          <template #content>
            <div class="flex justify-between">
              <p class="text-base font-bold">Total Tagihan Resep</p>
              <p class="text-base font-bold">
                {{
                  formatPrice(TransactionHistoryObatDetailPayload.grandTotal)
                }}
              </p>
            </div>
          </template>
        </card>
      </div>
      <!-- Total Tagihan Retur -->
      <div
        class="mt-4"
        v-if="
          TransactionHistoryObatDetailPayload.itemType == 'obat' &&
          TransactionHistoryObatDetailPayload.statusType == 'retur'
        "
      >
        <card class="bg-opensimrs-50">
          <template #content>
            <div class="flex justify-between">
              <p class="text-base font-bold">Total Retur</p>
              <p class="text-base font-bold">
                {{
                  formatPrice(TransactionHistoryObatDetailPayload.grandTotal)
                }}
              </p>
            </div>
          </template>
        </card>
      </div>
      <!-- Total Tagihan Batal -->
      <div
        class="mt-4"
        v-if="
          TransactionHistoryObatDetailPayload.itemType == 'obat' &&
          TransactionHistoryObatDetailPayload.statusType == 'batal'
        "
      >
        <card class="bg-opensimrs-50">
          <template #content>
            <div class="flex justify-between">
              <p class="text-base font-bold">Total Tagihan Resep</p>
              <p class="text-base font-bold">
                {{
                  formatPrice(TransactionHistoryObatDetailPayload.grandTotal)
                }}
              </p>
            </div>
          </template>
        </card>
      </div>
    </template>
  </CustomDialog>
</template>
