<script setup lang="ts">
import { ref, onMounted, watch, computed } from "vue";
import { useRoomPharmacyStore } from "@/stores/farmasi/RoomPharmacy";
import { usePegawaiStore } from "@/stores/datamaster/pegawai";
import { formatPrice, epochToDate } from "@/utils/Helpers";
import { utilsStore } from "@/stores/utils";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import { useDrugReturStore } from "@/stores/farmasi/DrugRetur";

const props = defineProps({
  payloadDetail3: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(["close", "previous"]);

const cetakDialog = ref(false);

// State Management Employee
const employeeStore = usePegawaiStore();
const employeePayload = ref<any[]>([]);
const officerName = ref("");
const isGivenBy = ref("");

// Fetch Employee
const fetchEmployee = async () => {
  try {
    const response = await employeeStore.getAktifApi();
    if (response && response.payload) {
      employeePayload.value = response.payload;
    } else {
      employeePayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data pegawai", error);
    employeePayload.value = [];
  }
};

// State Management Detail Room Pharmacy
const RoomPharmacyStoreStore = useRoomPharmacyStore();
const UseUtilsStore = utilsStore();

const handover = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await RoomPharmacyStoreStore.verify3Api({
      uuid: props.payloadDetail3.uuid,
      penerima: officerName.value,
    });
  } catch (error) {
    console.error("Failed to process the data:", error);
  } finally {
    UseUtilsStore.setLoading(false);
    emit("close");
  }
};

const previous = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await RoomPharmacyStoreStore.previousApi({
      uuid: props.payloadDetail3.uuid,
    });
  } catch (error) {
    console.error("Failed to process the data:", error);
  } finally {
    UseUtilsStore.setLoading(false);
    emit("previous", props.payloadDetail3.uuid);
  }
};

const DrugReturStore = useDrugReturStore();
const assesmentMedisPayload = ref<any>([]);

const fetchAssesmentMedis = async (rekamMedisUuid: string) => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await DrugReturStore.getAssesmentMedis(
      props.payloadDetail3.rekamMedisUuid
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

watch(
  () => props.payloadDetail3.rekamMedisUuid,
  () => {
    fetchAssesmentMedis(props.payloadDetail3.rekamMedisUuid);
  },
  { immediate: true }
);

onMounted(() => {
  fetchEmployee();
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
              {{ payloadDetail3.noOrderAlkes }}
            </p>
            <CustomChip
              :label="payloadDetail3.paymentMethod"
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
              Tgl. Order : {{ epochToDate(payloadDetail3.createdAt, "date") }}
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
              {{ payloadDetail3.patient.name || "-" }}
            </p>
            <p>{{ payloadDetail3.noReg || "-" }}</p>
            <CustomButton class="w-24 h-5 text-sm">{{
              payloadDetail3.noRm || "-"
            }}</CustomButton>
            <CustomChip
              :showCheckedIcon="false"
              label="Laki-laki"
              bgColor="bg-male-75"
              textColor="text-male-300"
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
          <div class="bg-mediumGrey-300 w-[1px] h-[70px] mr-[20px]"></div>
          <div class="basis-1/4">
            <p class="text-xs font-bold underline underline-offset-2 mt-[15px]">
              Tgl. Lahir
            </p>
            <p class="">
              {{ payloadDetail3.patient.birthDetail.tanggalLahir || "-" }}
            </p>
          </div>
          <div class="basis-1/4">
            <p class="text-xs font-bold underline underline-offset-2 mt-[15px]">
              Umur
            </p>
            <p class="">{{ payloadDetail3.patient.birthDetail.umur || "-" }}</p>
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
              <div v-for="(items, index) in payloadDetail3.alkesItems">
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
                        <div class="text-sm">
                          {{ slotProps.data.stokAlkes }}
                        </div>
                      </template>
                    </Column>
                    <!-- Harga Satuan -->
                    <Column field="harga" header="Harga Satuan">
                      <template #body="slotProps">
                        <div>
                          <p class="text-sm">
                            {{ formatPrice(slotProps.data.hargaSatuan) }}
                          </p>
                        </div>
                      </template>
                    </Column>
                    <!-- Sub. Total -->
                    <Column field="total" header="Sub. Total">
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
                  <p class="">{{ payloadDetail3.petugasOrder }}</p>
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
                    {{ formatPrice(payloadDetail3.hargaTotal) }}
                  </p>
                </div>
              </div>
            </template>
          </card>
        </div>
        <hr class="mt-[20px] border-[1px] border-grey-200" />
        <!-- Edukasi Pemberian Obat -->
        <div class="grid grid-cols-1">
          <CustomAccordion no-border initial-state="0">
            <template #header>Pemberian Alkes</template>
            <template #content>
              <div class="grid grid-cols-2 gap-6">
                <div class="mt-[20px]">
                  <CustomSelect
                    v-model="isGivenBy"
                    place-holder="Nama Petugas"
                    label="Diberikan Oleh"
                    optionLabel="name"
                    optionValue="uuid"
                    :options="employeePayload"
                  />
                </div>
                <div class="mt-[20px]">
                  <CustomTextfield
                    v-model="officerName"
                    label="Diterima Oleh"
                    placeholder="Input Nama Petugas"
                  />
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
        <hr class="mt-[10px] border-[1px] border-grey-200" />
        <!-- Serahkan -->
        <div class="grid grid-cols-[50%,50%]">
          <div class="flex">
            <div class="mt-[20px]">
              <CustomButton
                @click="previous"
                label="Batal Penyerahan"
                backgroundColor="bg-danger-300"
                borderColor="border-danger-300"
                textColor="text-white"
              />
            </div>
            <div class="mt-[20px] ml-[10px]">
              <CustomButton @click="cetakDialog = true">
                <div class="flex gap-2 items-center">
                  <PhPrinter :size="18" color="#ffffff" weight="fill" />
                  <div class="text-sm">Cetak</div>
                </div>
              </CustomButton>
            </div>
          </div>
          <div class="flex justify-end">
            <div class="mt-[20px]">
              <CustomButton
                v-if="officerName == ''"
                disabled
                label="Serahkan"
              />
              <CustomButton v-else label="Serahkan" @click="handover" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <!-- Cetak Dialog -->
  <CustomDialog v-model:visible="cetakDialog" width="435px">
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
</template>
