<script lang="ts" setup>
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";

import Card from "primevue/card";
import type { MenuItem } from "primevue/menuitem";
import { computed, onMounted, ref, type PropType } from "vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";

const props = defineProps({
  pageType: {
    type: String,
    required: true,
  },
  dataBreadCrumb: {
    type: Array as PropType<MenuItem[]>,
    default: () => [],
  },
  detailData: {
    type: Object,
  },
});

const emit = defineEmits(["kembali", "diterima"]);

</script>

<template>
  <!-- {{ detailData }} -->
  <Card pt:body:class="h-full pt-0" pt:content:class="h-full">
    <template #header>
      <CustomAccordion :openWithHeader="false" noBorder initialState="0">
        <template #header>
          <div class="flex items-center justify-between w-full align-middle">
            <div class="flex items-center">
              <CustomButton icon="PhArrowClockwise" class="mr-5" />
              <CustomBreadCrumb
                :home="{
                  label: 'Stok Opname',
                  home: true,
                }"
                :model="[
                  {
                    noStokOpname: detailData?.noStokOpname,
                  },
                ]"
              >
                <template #customItem="{ item }">
                  <div class="flex">
                    <div
                      v-if="item.noStokOpname"
                      class="rounded-lg bg-opensimrs-300 px-[10px] text-white mr-[10px]"
                    >
                      SO{{ item.noStokOpname }}
                    </div>
                    <span
                      :class="{
                        'text-opensimrs-300': item.home,
                        'text-grey-400': !item.home,
                      }"
                    >
                      {{ item.label }}
                    </span>
                  </div>
                </template>
                pkpkpk
              </CustomBreadCrumb>
              <CustomChip
                :showCheckedIcon="false"
                :label="detailData?.status"
                bgColor="bg-mint-75"
                textColor="text-mint-400"
                customClass="h-5 pr-[6px] border-none mr-[5px]"
              />
            </div>
            <CustomButton
              @click="emit('kembali')"
              icon="PhCaretLeft"
              label="Kembali"
              class="mr-[10px]"
              outlined
              borderColor="border-opensimrs-300"
              textColor="text-opensimrs-300"
            />
          </div>
        </template>
        <template #content>
          <div class="grid grid-cols-6 py-2.5">
            <div>
              <div class="font-semibold underline text-SM">No. Stok Opname</div>
              <div class="font-normal text-normal">
                SO{{ detailData?.noStokOpname }}
              </div>
            </div>
            <div>
              <div class="font-semibold underline text-SM">Tgl. Cut Off</div>
              <div class="font-normal text-normal">
                {{ detailData?.tglCutOff }}
              </div>
            </div>
            <div>
              <div class="font-semibold underline text-SM">
                Judul Stok Opname
              </div>
              <div class="font-normal text-normal">
                {{ detailData?.judul }}
              </div>
            </div>
            <div>
              <div class="font-semibold underline text-SM">Jenis Stok</div>
              <div class="font-normal text-normal">
                {{ detailData?.jenisStok }}
              </div>
            </div>
            <div>
              <div class="font-semibold underline text-SM">Kategori Item</div>
              <div class="font-normal text-normal">
                {{ detailData?.kategoriItem }}
              </div>
            </div>
            <div>
              <div class="font-semibold underline text-SM">Jenis Item</div>
              <div class="font-normal text-normal">
                {{ detailData?.jenisItem }}
              </div>
            </div>
          </div>

          <hr class="border-grey-200" />
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
      <div class="flex flex-col gap-5">
        <div class="flex items-end gap-7">
          <CustomTextfield
            label="Cari Nama Item / Kode Item"
            class="grow"
            placeholder="Masukkan judul Stok Opname"
          />
          <CustomSelect
            label="Jenis Item"
            placeHolder="Pilih Jenis Item"
            optionValue="code"
            optionLabel="name"
            :isLoading="false"
            class="w-[200px]"
          />
          <div class="flex gap-2.5">
            <CustomButton icon="PhMagnifyingGlass" label="Cari" />
            <CustomButton
              label="Reset"
              outlined
              borderColor="border-opensimrs-300"
              textColor="text-opensimrs-300"
            />
          </div>
        </div>
        <DataTable
          selectionMode="multiple"
          :value="detailData?.datas"
          tableStyle="min-width: 50rem"
          scrollable
          :pt="{ headerRow: 'text-SM' }"
        >
          <Column headerClass="bg-opensimrs-50" class="w-[40px]">
            <template #header>
              <div class="font-semibold">No</div>
            </template>
            <template #body="slotProps">
              <div>
                <div class="text-SM">{{ slotProps.index + 1 }}</div>
              </div>
            </template>
          </Column>
          <Column field="noPembelian" headerClass="bg-opensimrs-50">
            <template #header>
              <div class="font-semibold">Nama Item</div>
            </template>
            <template #body="slotProps">
              <div>
                <div class="text-SM">{{ slotProps.data.namaItem }}</div>
                <CustomChip
                  :showCheckedIcon="false"
                  :label="slotProps.data.kategoriItem"
                  bgColor="bg-opensimrs-300"
                  textColor="text-white"
                  customClass="h-5 pr-[6px] border-none mr-[5px]"
                />
                <CustomChip
                  :showCheckedIcon="false"
                  :label="slotProps.data.jenisStok"
                  bgColor="bg-opensimrs-300"
                  textColor="text-white"
                  customClass="h-5 pr-[6px] border-none mr-[5px]"
                />
                <CustomChip
                  :showCheckedIcon="false"
                  :label="slotProps.data.jenisItem"
                  bgColor="bg-opensimrs-300"
                  textColor="text-white"
                  customClass="h-5 pr-[6px] border-none mr-[5px]"
                />
                <CustomChip
                  v-if="slotProps.data.jenisObat"
                  :showCheckedIcon="false"
                  :label="slotProps.data.jenisObat"
                  bgColor="bg-opensimrs-300"
                  textColor="text-white"
                  customClass="h-5 pr-[6px] border-none mr-[5px]"
                />
              </div>
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50">
            <template #header>
              <div class="w-full font-semibold">Stok Awal</div>
            </template>
            <template #body="slotProps">
              <div class="font-normal text-SM">
                {{ slotProps.data.stokAwal }}
              </div>
              <div class="font-normal text-[8px] text-opensimrs-300">Tablet</div>
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50">
            <template #header>
              <div class="w-full font-semibold">Stok Masuk</div>
            </template>
            <template #body="slotProps">
              <div class="font-normal text-SM">
                {{ slotProps.data.stokMasuk }}
              </div>
              <div class="font-normal text-[8px] text-opensimrs-300">Tablet</div>
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50">
            <template #header>
              <div class="w-full font-semibold">Stok Keluar</div>
            </template>
            <template #body="slotProps">
              <div class="font-normal text-SM">
                {{ slotProps.data.stokKeluar }}
              </div>
              <div class="font-normal text-[8px] text-opensimrs-300">Tablet</div>
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50">
            <template #header>
              <div class="w-full font-semibold">Stok Sistem</div>
            </template>
            <template #body="slotProps">
              <div class="font-normal text-SM">
                {{ slotProps.data.stokSistem }}
              </div>
              <div class="font-normal text-[8px] text-opensimrs-300">Tablet</div>
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50" class="w-[100px]">
            <template #header>
              <div class="font-semibold">Stok Fisik</div>
            </template>
            <template #body="slotProps">
              <div class="font-normal text-SM">
                {{ slotProps.data.stokFisik }}
              </div>
              <div class="font-normal text-[8px] text-opensimrs-300">Tablet</div>
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50">
            <template #header>
              <div class="w-full font-semibold">Selisih</div>
            </template>
            <template #body="slotProps">
              <div class="flex gap-1 ustify-between i">
                <div class="flex flex-col">
                  <div class="text-SM">
                    {{ Math.abs(slotProps.data.selisih) }}
                  </div>
                  <div class="font-normal text-[8px] text-opensimrs-300">
                    Tablet
                  </div>
                </div>

                <!-- Conditionally render PhArrowCircleDown or PhArrowCircleUp based on mutasiStok value -->
                <PhArrowCircleDown
                  v-if="slotProps.data.selisih < 0"
                  :size="18"
                  color="#E9594C"
                  weight="fill"
                />
                <PhArrowCircleUp
                  v-else
                  :size="18"
                  color="#E89F29"
                  weight="fill"
                />
              </div>
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50">
            <template #header>
              <div class="w-full font-semibold">Exp. Date</div>
            </template>
            <template #body="slotProps">
              <div class="font-normal text-SM">
                {{ slotProps.data.expDate }}
              </div>
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50">
            <template #header>
              <div class="w-full font-semibold">Harga Dasar</div>
            </template>
            <template #body="slotProps">
              <div class="font-normal text-SM">
                Rp {{ slotProps.data.hargaDasar }}
              </div>
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50">
            <template #header>
              <div class="w-full font-semibold">Harga Akhir</div>
            </template>
            <template #body="slotProps">
              <div class="font-normal text-SM">
                Rp {{ slotProps.data.hargaAkhir }}
              </div>
            </template>
          </Column>
        </DataTable>
        <div class="flex justify-end">
          <Paginator
            :rows="10"
            :totalRecords="120"
            :rowsPerPageOptions="[10, 20, 30]"
            template="FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink RowsPerPageDropdown"
            currentPageReportTemplate="{currentPage}"
          >
            <template #start="slotProps">Total Data: 0</template>
          </Paginator>
        </div>
      </div>
    </template>
    <template #footer>
      <hr class="pt-5 border-grey-200" />
      <div class="flex gap-5">
         <CustomButton
          label="Cetak"
          class="my-auto bg-opensimrs-300"
          icon="PhPrinter"
        />
        <div>
          <div class="font-semibold underline text-SM">Total Item SO</div>
          <div class="font-normal text-normal">0 item</div>
        </div>
        <div>
          <div class="font-semibold underline text-SM">Tgl. Selesai SO</div>
          <div class="font-normal text-normal">01-01-2024</div>
        </div>
        <div>
          <div class="font-semibold underline text-SM">Petugas SO</div>
          <div class="font-normal text-normal">Nama Petugas</div>
        </div>
      </div>
    </template>
  </Card>
</template>
