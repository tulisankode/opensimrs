<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { formatPrice, epochToDate } from "@/utils/Helpers";
import { useTransactionHistoryStore } from "@/stores/farmasi/TransactionHistory";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { utilsStore } from "@/stores/utils";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomChip from "@/components/Base/CustomChip.vue";

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
  }
});

const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);

const updateVisibility = (value: any) => {
  emit("update:isDialogVisible", value);
};

// State Management
const TransactionHistoryStore = useTransactionHistoryStore();
const UseUtilsStore = utilsStore();
const TransactionHistoryAlkesDetailPayload = ref<any>({});

// Identitas & ringkasan klinis pasien (sebelumnya teks contoh: "dr. Anji", "H10.9 Conjuctivitis", lahir 2090)
const rekamMedisStore = useRekamMedisStore();
const ringkasanKlinis = ref<any>(null);
const pasienTrx = computed(() => TransactionHistoryAlkesDetailPayload.value?.patient ?? {});
const perempuanTrx = computed(() => /^(female|p|perempuan)$/i.test(String(pasienTrx.value.gender ?? "")));
const tglLahirTrx = computed(() => {
  const t = pasienTrx.value.birthDetail?.birthDate;
  return t ? new Date(t).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-";
});
const umurTrx = computed(() => {
  const b = pasienTrx.value.birthDetail;
  return b && b.ageYear !== undefined ? `${b.ageYear} Thn ${b.ageMonth ?? 0} Bln ${b.ageDay ?? 0} Hr` : "-";
});
watch(
  () => TransactionHistoryAlkesDetailPayload.value?.rekamMedisUuid,
  async (uuid) => {
    ringkasanKlinis.value = null;
    if (!uuid) return;
    try {
      ringkasanKlinis.value = (await rekamMedisStore.getRekamMedis({ rekamMedisUuid: uuid }))?.payload?.summary ?? null;
    } catch {
      ringkasanKlinis.value = null;
    }
  }
);

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
        TransactionHistoryAlkesDetailPayload.value = response.payload;
    } else {
        TransactionHistoryAlkesDetailPayload.value = {};
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    TransactionHistoryAlkesDetailPayload.value = {};
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

defineExpose({
  fetchTransactionHistoryDetail,
});
</script>

<template>
  <CustomDialog :visible="isDialogVisible" @update:visible="updateVisibility" width="1000px">
    <template #header>
      <div class="flex justify-between">
        <div class="flex">
          <p>
            Riwayat Alkes - {{ TransactionHistoryAlkesDetailPayload.noOrderAlkes }}
          </p>
          <CustomChip
            :label="TransactionHistoryAlkesDetailPayload.paymentMethod"
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
            Tgl. Order : {{ epochToDate(TransactionHistoryAlkesDetailPayload.orderDate, "date") }}</p>
        </div>
      </div>
    </template>
    <template #body>
      <div class="pt-5">
        <div class="flex flex-row">
          <div class="basis-1/4">
            <p class="font-bold text-MD">{{ pasienTrx.name ?? "-" }}</p>
            <p>{{ TransactionHistoryAlkesDetailPayload.noReg ?? "-" }}</p>
            <CustomButton class="w-24 h-5 text-sm">{{ TransactionHistoryAlkesDetailPayload.noRm ?? pasienTrx.noRm ?? "-" }}</CustomButton>
            <CustomChip
              :showCheckedIcon="false"
              :label="perempuanTrx ? 'Perempuan' : 'Laki-laki'"
              :bgColor="perempuanTrx ? 'bg-female-75' : 'bg-male-75'"
              :textColor="perempuanTrx ? 'text-female-300' : 'text-male-300'"
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
            <p class="">{{ tglLahirTrx }}</p>
          </div>
          <div class="mt-[20px] mr-[40px]">
            <p class="text-xs font-bold underline underline-offset-2">Umur</p>
            <p class="">{{ umurTrx }}</p>
          </div>
          <div class="mt-[20px] mr-[40px]">
            <p class="text-xs font-bold underline underline-offset-2">Alergi</p>
            <p class="">{{ ringkasanKlinis?.namaAlergi || (ringkasanKlinis ? "Tidak ada" : "-") }}</p>
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
                  <p>{{ ringkasanKlinis?.keluhanUtama || "-" }}</p>
                  <p
                    class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                  >
                    Dokter Pengirim
                    <span> </span>
                  </p>
                  <p>{{ TransactionHistoryAlkesDetailPayload.dokterOrder ?? TransactionHistoryAlkesDetailPayload.petugasOrder ?? "-" }}</p>
                </div>
                <div class="bg-mediumGrey-300 w-[1px] h-[85px] mr-[20px]"></div>
                <div class="mr-[40px]">
                  <p class="text-xs font-bold underline underline-offset-2">
                    Diagnosa Primer
                  </p>
                  <p class="">{{ ringkasanKlinis?.diagnosisPrimer?.split("~")[0] || "-" }}</p>
                  <p
                    class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                  >
                    Diagnosa Primer
                  </p>
                  <p class="">-</p>
                </div>
                <div class="mr-[40px]">
                  <p class="text-xs font-bold underline underline-offset-2">
                    Diagnosa Sekunder
                  </p>
                  <p class="">-</p>
                </div>
                <div class="mr-[40px]">
                  <p class="text-xs font-bold underline underline-offset-2">
                    Diagnosa Sekunder
                  </p>
                  <p class="">-</p>
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
        <div class="grid grid-cols-1" v-if="TransactionHistoryAlkesDetailPayload.itemType == 'alkes' && TransactionHistoryAlkesDetailPayload.statusType == 'resep'">
          <CustomAccordion no-border initial-state="0">
            <template #header>Status Verifikasi</template>
            <template #content>
              <div class="mt-[20px]">
                <DataTable
                  :value="TransactionHistoryAlkesDetailPayload.history"
                  class="text-xs"
                  scrollable
                  scrollHeight="flex"
                >
                  <!-- Step -->
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
                      <div class="text-sm">
                        {{ epochToDate(slotProps.data.date, "date") }}
                      </div>
                    </template>
                  </Column>

                  <!-- Jam -->
                  <Column header="Jam" headerClass="bg-opensimrs-50">
                    <template #body="slotProps">
                      <div class="text-sm">
                        {{ epochToDate(slotProps.data.date, "time") }}
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
         <div class="grid grid-cols-1" v-if="TransactionHistoryAlkesDetailPayload.itemType == 'alkes' && TransactionHistoryAlkesDetailPayload.statusType == 'retur'">
          <CustomAccordion no-border initial-state="0">
            <template #header>Status Retur</template>
            <template #content>
              <div class="mt-[20px]">
                <DataTable
                  :value="TransactionHistoryAlkesDetailPayload.history"
                  class="text-xs"
                  scrollable
                  scrollHeight="flex"
                >
                  <!-- Step -->
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
                      <div class="text-sm">
                        {{ epochToDate(slotProps.data.date, "date") }}
                      </div>
                    </template>
                  </Column>

                  <!-- Jam -->
                  <Column header="Jam" headerClass="bg-opensimrs-50">
                    <template #body="slotProps">
                      <div class="text-sm">
                        {{ epochToDate(slotProps.data.date, "time") }}
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
         <div class="grid grid-cols-1" v-if="TransactionHistoryAlkesDetailPayload.itemType == 'alkes' && TransactionHistoryAlkesDetailPayload.statusType == 'batal'">
          <CustomAccordion no-border initial-state="0">
            <template #header>Status Verifikasi & Batal</template>
            <template #content>
              <div class="mt-[20px]">
                <DataTable
                  :value="TransactionHistoryAlkesDetailPayload.history"
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
                      <div class="text-sm">
                        {{ epochToDate(slotProps.data.date, "date") }}
                      </div>
                    </template>
                  </Column>

                  <!-- Jam -->
                  <Column header="Jam" headerClass="bg-opensimrs-50">
                    <template #body="slotProps">
                      <div class="text-sm">
                        {{ epochToDate(slotProps.data.date, "time") }}
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
        <div class="grid grid-cols-1" v-if="TransactionHistoryAlkesDetailPayload.itemType == 'alkes' && TransactionHistoryAlkesDetailPayload.statusType == 'retur'">
          <CustomAccordion no-border initial-state="0">
            <template #header>Alasan Retur</template>
            <template #content>
              <div class="mt-[20px]">
                <p>{{ TransactionHistoryAlkesDetailPayload.alasanRetur }}</p>
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
        <div class="grid grid-cols-1" v-if="TransactionHistoryAlkesDetailPayload.itemType == 'alkes' && TransactionHistoryAlkesDetailPayload.statusType == 'batal'">
          <CustomAccordion no-border initial-state="0">
            <template #header>Alasan Batal</template>
            <template #content>
              <div class="mt-[20px]">
                <p>{{ TransactionHistoryAlkesDetailPayload.alasanBatal }}</p>
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
        <!-- Asesmen Medis -->
        <div class="grid grid-cols-1" v-if="TransactionHistoryAlkesDetailPayload.itemType == 'alkes' && TransactionHistoryAlkesDetailPayload.statusType == 'resep'">
          <CustomAccordion no-border initial-state="0">
            <template #header>Asesmen Medis</template>
            <template #content>
              <div v-for="(items, index) in TransactionHistoryAlkesDetailPayload.items" :key="index" class="mt-[20px]">
                <card class="bg-opensimrs-50">
                  <template #content>
                    <div class="flex justify-between">
                      <div class="flex">
                        <CustomButton class="text-sm h-7">0{{ index + 1 }}</CustomButton>
                        <p class="ml-2 text-base font-bold">{{ items.name }}</p>
                        <PhArrowRight
                          :size="20"
                          class="my-auto ml-2 text-success-300"
                          weight="bold"
                        />
                        <p class="ml-2 text-base font-bold">{{ items.qty }}</p>
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
                    <!-- Stok Alkes -->
                    <Column header="Stok Alkes">
                      <template #body="slotProps">
                        <div class="text-SM">{{ slotProps.data.jenisStok }}</div>
                      </template>
                    </Column>
                    <!-- Harga Satuan -->
                    <Column header="Harga Satuan">
                      <template #body="slotProps">
                        <div class="text-SM">{{ formatPrice(slotProps.data.hargaSatuan) }}</div>
                      </template>
                    </Column>
                    <!-- Total -->
                    <Column header="Total">
                      <template #body="slotProps">
                        <div class="text-SM">{{ formatPrice(slotProps.data.totalHarga) }}</div>
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
        <!-- Daftar Alkes -->
        <div class="grid grid-cols-1" v-if="TransactionHistoryAlkesDetailPayload.itemType == 'alkes' && TransactionHistoryAlkesDetailPayload.statusType == 'retur'">
          <CustomAccordion no-border initial-state="0">
            <template #header>Daftar Alkes</template>
            <template #content>
              <div v-for="(items, index) in TransactionHistoryAlkesDetailPayload.retur" :key="index" class="mt-[20px]">
                <card class="bg-opensimrs-50">
                  <template #content>
                    <div class="flex justify-between">
                      <div class="flex">
                        <CustomButton class="text-sm h-7">0{{ index + 1 }}</CustomButton>
                        <p class="ml-2 text-base font-bold">{{ items.name }}</p>
                        <PhArrowRight
                          :size="20"
                          class="my-auto ml-2 text-success-300"
                          weight="bold"
                        />
                        <p class="ml-2 text-base font-bold">{{ items.qty }}</p>
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
                    <Column header="Exp Date">
                      <template #body="slotProps">
                        <div class="text-SM">{{ slotProps.data.aturanPakai }}</div>
                      </template>
                    </Column>
                    <!-- Terima Retur -->
                    <Column header="Terima Retur">
                      <template #body="slotProps">
                        <div class="text-SM">{{ formatPrice(slotProps.data.hargaSatuan) }}</div>
                      </template>
                    </Column>
                    <!-- Harga Satuan -->
                    <Column header="Harga Satuan">
                      <template #body="slotProps">
                        <div class="text-SM">{{ slotProps.data.jasaResep }}</div>
                      </template>
                    </Column>
                    <!-- Total -->
                    <Column header="Total">
                      <template #body="slotProps">
                        <div class="text-SM">{{ formatPrice(slotProps.data.totalHarga) }}</div>
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
        <!-- Daftar Alkes -->
        <div class="grid grid-cols-1" v-if="TransactionHistoryAlkesDetailPayload.itemType == 'alkes' && TransactionHistoryAlkesDetailPayload.statusType == 'batal'">
          <CustomAccordion no-border initial-state="0">
            <template #header>Daftar Alkes</template>
            <template #content>
              <div v-for="(items, index) in TransactionHistoryAlkesDetailPayload.items" :key="index" class="mt-[20px]">
                <card class="bg-opensimrs-50">
                  <template #content>
                    <div class="flex justify-between">
                      <div class="flex">
                        <CustomButton class="text-sm h-7">0{{ index + 1 }}</CustomButton>
                        <p class="ml-2 text-base font-bold">{{ items.name }}</p>
                        <PhArrowRight
                          :size="20"
                          class="my-auto ml-2 text-success-300"
                          weight="bold"
                        />
                        <p class="ml-2 text-base font-bold">{{ items.qty }}</p>
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
                    <!-- Stok Alkes -->
                    <Column header="Stok Alkes">
                      <template #body="slotProps">
                        <div class="text-SM">{{ slotProps.data.jenisStok }}</div>
                      </template>
                    </Column>
                    <!-- Harga Satuan -->
                    <Column header="Harga Satuan">
                      <template #body="slotProps">
                        <div class="text-SM">{{ formatPrice(slotProps.data.hargaSatuan) }}</div>
                      </template>
                    </Column>
                    <!-- Total -->
                    <Column header="Total">
                      <template #body="slotProps">
                        <div class="text-SM">{{ formatPrice(slotProps.data.totalHarga) }}</div>
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

      <!-- Total Tagihan Alkes -->
      <div class="mt-4" v-if="TransactionHistoryAlkesDetailPayload.itemType == 'alkes' && TransactionHistoryAlkesDetailPayload.statusType == 'resep'">
        <card class="bg-opensimrs-50">
          <template #content>
            <div class="flex justify-between">
              <p class="text-base font-bold">Total Tagihan Alkes</p>
              <p class="text-base font-bold">{{ formatPrice(TransactionHistoryAlkesDetailPayload.grandTotal) }}</p>
            </div>
          </template>
        </card>
      </div>
      <!-- Total Retur -->
      <div class="mt-4" v-if="TransactionHistoryAlkesDetailPayload.itemType == 'alkes' && TransactionHistoryAlkesDetailPayload.statusType == 'retur'">
        <card class="bg-opensimrs-50">
          <template #content>
            <div class="flex justify-between">
              <p class="text-base font-bold">Total Retur</p>
              <p class="text-base font-bold">{{ formatPrice(TransactionHistoryAlkesDetailPayload.grandTotal) }}</p>
            </div>
          </template>
        </card>
      </div>
      <!-- Total Tagihan Batal -->
      <div class="mt-4" v-if="TransactionHistoryAlkesDetailPayload.itemType == 'alkes' && TransactionHistoryAlkesDetailPayload.statusType == 'batal'">
        <card class="bg-opensimrs-50">
          <template #content>
            <div class="flex justify-between">
              <p class="text-base font-bold">Total Tagihan Alkes</p>
              <p class="text-base font-bold">{{ formatPrice(TransactionHistoryAlkesDetailPayload.grandTotal) }}</p>
            </div>
          </template>
        </card>
      </div>
    </template>
  </CustomDialog>
</template>
