<script setup lang="ts">
import type { MenuItem } from "primevue/menuitem";
import { computed, ref, type PropType } from "vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import MedicalRecord from "@/views/MedicalRecord/MedicalRecord.vue";

const editOrderDialog = ref(false);
const popupDialog = ref(false);
const dateFilter = ref<Date>(new Date());
const dataBreadCrumb = ref<MenuItem[]>([]);

const props = defineProps({
  pageType: {
    type: String,
    required: true,
  },
  dataBreadCrumb: {
    type: Array as PropType<MenuItem[]>,
    default: () => [],
  },
  formType: {
    type: String,
    default: "",
  },
  isDetail: {
    type: Boolean,
    required: false,
  },
  patientData: {
    type: Object as PropType<any>,
    required: true,
  },
});

const changeSection = (label: string, data: any = null) => {
  let tempData = { label: label };
  if (data) {
    tempData = { ...tempData, ...data };
  }
  if (dataBreadCrumb.value.length) {
    dataBreadCrumb.value[0] = tempData;
  } else {
    dataBreadCrumb.value.push(tempData);
  }
};

const emit = defineEmits(["back", "goToDetail", "goToEdit"]);

const dataTindakan = ref<any[]>([]);

const listTindakan = ref([
  { id: "1", value: "Fisio 1" },
  { id: "2", value: "Fidio 2" },
  { id: "3", value: "Fisio 3" },
]);
const myPushFunction = () => {
  dataTindakan.value.push({
    listTindakan: "",
    jumlah: 0,
    harga: 0,
  });
};

const editIdentitas = () => {
  popupDialog.value = false;
  changeSection("Edit Profil Pasien");
};
const deleteDataTindakan = (index: number) => {
  dataTindakan.value.splice(index, 1);
};

const medicalRecord = ref<typeof MedicalRecord>();
const openDialogRM = () => {
  medicalRecord.value?.showDialogRM();
};
</script>

<template>
 <CustomDialog v-model:visible="popupDialog" width="1000px">
      <template #header>
        <div class="flex justify-between">
          <div class="flex">
            <p>
              Detail Order Fisioterapi
              <CustomChip
                label="TUNAI"
                :showCheckedIcon="false"
                borderColor="border-opensimrs-300"
                bgColor="bg-opensimrs-50"
                textColor="text-opensimrs-300"
                customClass="h-6"
                class="ml-[5px]"
              />
            </p>
          </div>
          <div></div>
          <div class="flex ml-[470px]">
            <div class="bg-white w-[1px] h-[30px]"></div>
            <p class="text-sm ml-[10px] mt-[3px]">Tgl. Order : 3-10-2024</p>
          </div>
          <div></div>
        </div>
      </template>
      <template #body>
        <div>
          <div class="pt-5 mb-20">
            <div class="flex flex-row">
              <div class="basis-1/4">
                <p class="font-bold text-MD">Nama lengkap pasien</p>
                <p>REG1231235</p>
                <CustomButton class="w-24 h-5 text-sm">00-00-00</CustomButton>
                <CustomChip
                  :showCheckedIcon="false"
                  label="Laki-laki"
                  bgColor="bg-male-75"
                  textColor="text-male-300"
                  customClass="h-5 pr-[6px] border-none mr-[5px] ml-2"
                />
              </div>
              <div class="bg-mediumGrey-300 w-[1px] h-[85px] mr-[20px]"></div>
              <div class="mt-[20px] mr-[40px]">
                <p class="text-xs font-bold underline underline-offset-2">
                  Tgl. Lahir
                </p>
                <p class="">10 Januari 2090</p>
              </div>
              <div class="mt-[20px] mr-[40px]">
                <p class="text-xs font-bold underline underline-offset-2">
                  Umur
                </p>
                <p class="">24Thn 2Bln 1Hari</p>
              </div>
              <div class="mt-[20px] mr-[40px]">
                <p class="text-xs font-bold underline underline-offset-2">
                  Alergi
                </p>
                <p class="">Tidak Ada</p>
              </div>
            </div>

            <!-- Asesmen Medis -->
            <div class="grid grid-cols-1 mt-2">
              <CustomAccordion
                no-border
                :openWithHeader="false"
                initial-state="0"
              >
                <template #header>
                  <div class="flex justify-between w-full mt-5">
                    <div class="mt-4 basis-1/4">
                      <p class="font-bold text-MD">Asesmen Medis</p>
                    </div>
                    <div>
                      <CustomButton
                        @click="openDialogRM"
                        label="Rekam Medis"
                        class="mr-4"
                      />
                    </div>
                  </div>
                </template>
                <template #content>
                  <div class="flex flex-row mt-8">
                    <div class="basis-1/4">
                      <p class="text-xs font-bold underline underline-offset-2">
                        Keluhan Utama
                      </p>
                      <p>Sakit Mata</p>
                      <p
                        class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                      >
                        Dokter Pengirim
                        <span> </span>
                      </p>
                      <p>dr. Anji Sp. M</p>
                    </div>
                    <div
                      class="bg-mediumGrey-300 w-[1px] h-[85px] mr-[20px]"
                    ></div>
                    <div class="mr-[180px]">
                      <p class="text-xs font-bold underline underline-offset-2">
                        Diagnosa Primer
                      </p>
                      <p class="">H10.9 Conjuctivitis</p>
                      <p
                        class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                      >
                        Diagnosa Sekunder
                      </p>
                      <p class="">-</p>
                    </div>
                    <div class="mr-[80px]">
                      <p class="text-xs font-bold underline underline-offset-2">
                        Diagnosa Sekunder
                      </p>
                      <p class="">-</p>
                      <p
                        class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                      >
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

            <!-- Profil Pasien  -->

            <div class="grid grid-cols-1 mt-2">
              <CustomAccordion
                no-border
                :openWithHeader="false"
                initial-state="0"
              >
                <template #header>
                  <div class="flex justify-between w-full mt-5">
                    <div class="mt-4 basis-1/4">
                      <p class="font-bold text-MD">Profil Pasien</p>
                    </div>
                    <div>
                      <CustomButton
                        @click="editIdentitas"
                        label="Edit Data"
                        class="mr-4"
                      />
                    </div>
                  </div>
                </template>
                <template #content>
                  <div class="grid grid-cols-3 gap-4 mt-8">
                    <div class="">
                      <p class="text-xs font-bold underline underline-offset-2">
                        KTP
                      </p>
                      <p>1666666666666666</p>
                      <p
                        class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                      >
                        Provinsi
                        <span> </span>
                      </p>
                      <p>Jawa Timur</p>
                      <p
                        class="mt-3 text-xs font-bold underline underline-offset-2"
                      >
                        Kelurahahn / Desa
                      </p>
                      <p>Keputih</p>
                      <p
                        class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                      >
                        Alamat
                        <span> </span>
                      </p>
                      <p>Jl. Ijo Abang no. 17</p>
                    </div>

                    <div>
                      <p class="text-xs font-bold underline underline-offset-2">
                        No. Handphone
                      </p>
                      <p class="">080000000000</p>
                      <p
                        class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                      >
                        Kabupaten / Kota
                      </p>
                      <p class="">Surabaya</p>
                      <div class="flex flex-row mt-[10px]">
                        <div class="basis-1/4">
                          <p
                            class="text-xs font-bold underline underline-offset-2"
                          >
                            RT
                          </p>
                          <p>01</p>
                        </div>
                        <div class="basis-1/4">
                          <p
                            class="text-xs font-bold underline underline-offset-2"
                          >
                            RW
                          </p>
                          <p>02</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p class="text-xs font-bold underline underline-offset-2">
                        Agama
                      </p>
                      <p class="">Islam</p>
                      <p
                        class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                      >
                        Kecamatan
                      </p>
                      <p class="">Sukolilo</p>
                      <p
                        class="text-xs font-bold underline underline-offset-2 mt-[10px]"
                      >
                        Kode Pos
                      </p>
                      <p class="">12345</p>
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

            <!-- List Order Terapi -->
            <div class="grid grid-cols-1 mt-[20px]">
              <CustomAccordion
                no-border
                :openWithHeader="false"
                initial-state="0"
              >
                <template #header>
                  <div class="flex justify-between">
                    <div class="mt-2">
                      <p>List Order Terapi</p>
                    </div>
                    <div></div>
                    <div class="flex ml-[460px] mt-2">
                      <div class="bg-mediumGrey-300 w-[1px] h-[30px]"></div>
                      <p class="text-xs ml-[10px] mt-[3px]">
                        Tgl. Order : 3-10-2024
                      </p>
                    </div>
                    <CustomButton
                      @click="editOrderDialog = true"
                      label="Edit Order"
                      class="ml-[40px]"
                    />
                    <div></div>
                  </div>
                </template>
                <template #content>
                  <div class="mt-[20px]">
                    <card class="bg-opensimrs-50">
                      <template #content>
                        <div class="flex justify-between">
                          <div class="flex">
                            <p class="text-base font-bold text-opensimrs-300">
                              FISK82L
                            </p>
                            <div
                              class="bg-black w-[2px] h-[15px] ml-2 mt-1"
                            ></div>
                            <p class="ml-2 text-base font-bold">
                              Rincian Pemeriksaan & Biaya
                            </p>
                          </div>
                        </div>
                      </template>
                    </card>
                    <div class="pt-5 mt-[-20px]">
                      <DataTable
                        class="overflow-hidden rounded-[10px]"
                        scrollable
                        scrollHeight="flex"
                        :pt="{ headerRow: 'text-SM' }"
                      >
                        <Column
                          field="pemeriksaanName"
                          header="Nama Pemeriksaan"
                        >
                          <template #body="slotProps">
                            <div class="flex justify-between">
                              <div>
                                <p class="text-SM">
                                  {{ slotProps.data.pemeriksaanName }}
                                </p>
                              </div>
                            </div>
                          </template>
                        </Column>

                        <Column field="diagnosa" header="Diagnosis">
                          <template #body="slotProps">
                            <div>
                              <p class="text-sm">
                                {{ slotProps.data.diagnosa }}
                              </p>
                            </div>
                          </template>
                        </Column>

                        <!-- Harga -->
                        <Column field="harga">
                          <template #header>
                            <div class="font-bold text-end">Harga</div>
                          </template>
                          <template #body="slotProps">
                            <div class="text-SM text-end">
                              {{ slotProps.data.harga }}
                            </div>
                          </template>
                        </Column>
                      </DataTable>
                    </div>
                    <div class="mt-4">
                      <card class="bg-opensimrs-50">
                        <template #content>
                          <div class="grid grid-cols-3">
                            <div>
                              <p
                                class="text-xs font-bold underline underline-offset-2"
                              >
                                Dokter Pengirim
                              </p>
                              <p>dr. Anji Sp. M</p>
                            </div>
                            <div class="flex">
                              <div class="bg-black w-[1px] h-[30px] ml-2"></div>
                              <p class="mt-1 ml-4 text-base font-bold">
                                Total Tagihan Fisio
                              </p>
                            </div>
                            <div>
                              <p
                                class="flex justify-end mt-1 text-base font-bold"
                              >
                                RP. 0, 00
                              </p>
                            </div>
                          </div>
                        </template>
                      </card>
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
        </div>
        <Card class="absolute inset-x-0 bottom-0">
          <template #footer>
            <div class="flex justify-end">
              <CustomButton
                label="Validasi Order"
                backgroundColor="bg-opensimrs-300"
              />
            </div>
          </template>
        </Card>
      </template>
    </CustomDialog>

    <!-- Edit Order Dialog -->
    <CustomDialog
      v-model:visible="editOrderDialog"
      class="h-[600px]"
      width="800px"
    >
      <template #header>
        <div class="flex">
          <p>Edit Order Fisio</p>
        </div>
      </template>
      <template #body>
        <div class="pt-5 grid grid-cols-[25%_75%] gap-4">
          <div>
            <CustomDatePicker
              v-model="dateFilter"
              label="Tanggal"
              class="mr-[20px]"
            />
          </div>
          <div>
            <CustomSelect
              label="Jenis Fisioterapi"
              place-holder="Pilih Jenis Fisioterapi"
              class="mr-[20px]"
              optionLabel=""
              optionValue=""
              :options="['Jenis 1', 'Jenis 2', 'Jenis 3']"
            />
          </div>
        </div>
        <div>
          <CustomSelect
            label="Diagnosis"
            place-holder="Cari dan Pilih Diagnosis"
            class="w-full mt-4"
            optionLabel=""
            optionValue=""
            :options="['Diagnosis 1', 'Diagnosis 2', 'Diagnosis 3']"
            prependIcon="PhMagnifyingGlass"
          />
        </div>

        <!-- Data Tabel dialog -->
        <div class="mt-[20px]">
          <div class="relative overflow-y-auto" style="max-height: 220px">
            <DataTable
              :pt="{ headerRow: 'text-SM' }"
              :value="dataTindakan"
              scrollable
              scrollHeight="160px"
              class="overflow-hidden text-xs rounded-lg bg-opensimrs-50"
            >
              <Column
                headerClass="bg-opensimrs-50 font-semibold text-SM"
                class="w-[20px]"
              >
                <template #header>
                  <div class="flex items-center">No.</div>
                </template>
                <template #body="slotProps">
                  <div class="flex items-center justify-center">
                    {{ slotProps.index + 1 }}
                  </div>
                </template>
              </Column>

              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="font-semibold">List Tindakan</div>
                </template>
                <template #body="slotProps">
                  <CustomSelect
                    prepend-icon="PhMagnifyingGlass"
                    v-model="slotProps.data.listTindakan"
                    :options="listTindakan"
                    optionValue="value"
                    optionLabel="value"
                    label=""
                    place-holder="Cari & Pilih Tindakan"
                  />
                </template>
              </Column>
              <Column headerClass="bg-opensimrs-50 " class="w-[150px]">
                <template #header>
                  <div class="w-full font-semibold text-center">Jumlah</div>
                </template>
                <template #body="slotProps">
                  <CustomInputNumber
                    :show-label="false"
                    v-model="slotProps.data.jumlah"
                    :show-buttons="true"
                    class="text-center"
                  />
                </template>
              </Column>

              <Column headerClass="bg-opensimrs-50 " class="min-w-[150px]">
                <template #header>
                  <div class="w-full font-semibold text-center">Harga</div>
                </template>
                <template #body="slotProps">
                  <CustomInputNumber
                    v-model="slotProps.data.harga"
                    class=""
                    label=""
                  >
                    <template #prependText>
                      <div
                        class="flex items-center justify-center px-3 overflow-hidden font-semibold leading-7 text-white border-r text-MD bg-opensimrs-300 rounded-l-md"
                      >
                        Rp.
                      </div>
                    </template>
                  </CustomInputNumber>
                </template>
              </Column>

              <Column headerClass="bg-opensimrs-50">
                <template #header>
                  <div class="w-full font-semibold text-center">Action</div>
                </template>
                <template #body="slotProps">
                  <div class="flex items-center justify-center">
                    <CustomButton
                      label=""
                      background-color="bg-danger-300 rounded-lg"
                      @click="deleteDataTindakan(slotProps.index)"
                    >
                      <img
                        src="@/assets/icons/delete.svg"
                        alt=""
                        width="14px"
                      />
                    </CustomButton>
                  </div>
                </template>
              </Column>
            </DataTable>
          </div>
        </div>
        <div
          class="flex items-center justify-center mt-5 p-5 border border-dashed rounded-lg border-opensimrs-300 gap-2.5 mb-[70px]"
        >
          <CustomButton
            icon="PhPlus"
            label="Tambah Tindakan"
            borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300"
            backgroundColor="bg-white"
            @click="myPushFunction"
          />
        </div>
        <Card class="absolute inset-x-0 bottom-0">
          <template #footer>
            <div class="flex justify-end">
              <CustomButton
                label="Reset"
                class="mr-[10px]"
                outlined
                borderColor="border-grey-200"
                textColor="text-grey-300"
              />
              <CustomButton
                label="Batal Edit"
                class="mr-[10px]"
                outlined
                borderColor="border-opensimrs-300"
                textColor="text-opensimrs-300"
              />
              <CustomButton
                label="Simpan"
                class=""
                backgroundColor="bg-opensimrs-300"
              />
            </div>
          </template>
        </Card>
      </template>
    </CustomDialog>
</template>
