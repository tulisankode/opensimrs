<script setup lang="ts">
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import Card from "primevue/card";
import type { MenuItem } from "primevue/menuitem";
import type { PropType } from "vue";

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

const emit = defineEmits(["kembali"]);
</script>

<template>
  <Card pt:body:class="h-full pt-0" pt:content:class="h-full">
    <template #header>
      <CustomAccordion :openWithHeader="false" noBorder initialState="0">
        <template #header>
          <div class="flex items-center justify-between w-full align-middle">
            <div class="flex items-center">
              <CustomButton icon="PhArrowClockwise" class="mr-5" />
              <CustomBreadCrumb
                :home="{
                  label: 'Pengeluaran Barang',
                  home: true,
                }"
                :model="[
                  {
                    label: 'Penerimaan Unit',
                  },
                  {
                    noRetur: detailData?.noRetur,
                  },
                ]"
              >
                <template #customItem="{ item }">
                  <div class="flex">
                    <div
                      v-if="item.noRetur"
                      class="rounded-lg bg-opensimrs-300 px-[10px] text-white mr-[10px]"
                    >
                      {{ item.noRetur }}
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
              </CustomBreadCrumb>
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
          <div class="grid grid-rows-2 gap-2.5 pt-2.5">
            <div class="grid grid-cols-4">
              <div>
                <div class="font-semibold underline text-SM">Tanggal Retur</div>
                <div class="font-normal text-normal">
                  {{ detailData?.tanggalRetur }}
                </div>
              </div>
              <div>
                <div class="font-semibold underline text-SM">Kategori Item</div>
                <div class="font-normal text-normal">
                  {{ detailData?.kategoriItem }}
                </div>
              </div>
              <div>
                <div class="font-semibold underline text-SM">Jenis Stok</div>
                <div class="font-normal text-normal">
                  {{ detailData?.jenisStok }}
                </div>
              </div>
              <div>
                <div class="font-semibold underline text-SM">Jenis Item</div>
                <div class="font-normal text-normal">
                  {{ detailData?.jenisItem }}
                </div>
              </div>
            </div>
            <div class="grid grid-cols-4">
              <div>
                <div class="font-semibold underline text-SM">Asal Retur</div>
                <div class="font-normal text-normal">
                  {{ detailData?.asalRetur }}
                </div>
              </div>
              <div>
                <div class="font-semibold underline text-SM">Tujuan Retur</div>
                <div class="font-normal text-normal">
                  {{ detailData?.tujuanRetur }}
                </div>
              </div>
              <div>
                <div class="font-semibold underline text-SM">Petugas Retur</div>
                <div class="font-normal text-normal">
                  {{ detailData?.petugasRetur }}
                </div>
              </div>
              <div>
                <div class="font-semibold underline text-SM">Catatan</div>
                <div class="font-normal text-normal">
                  {{ detailData?.catatan }}
                </div>
              </div>
            </div>
          </div>
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
      <DataTable
        :value="detailData?.datas"
        scrollable
        scrollHeight="300px"
        :pt="{ headerRow: 'text-SM' }"
      >
        <Column headerClass="bg-opensimrs-50">
          <template #header>
            <div class="font-semibold text-SM">No.</div>
          </template>
          <template #body="slotProps">
            <div class="w-full text-center text-SM">
              {{ slotProps.index + 1 }}
            </div>
          </template>
        </Column>
        <Column
          header="Nama Item"
          headerClass="bg-opensimrs-50 text-SM"
          class="w-1/2"
        >
          <template #body="slotProps">
            <div class="text-SM">{{ slotProps.data.namaItems }}</div>
          </template>
        </Column>
        <Column headerClass="bg-opensimrs-50" class="min-w-[120px]">
          <template #header>
            <div class="w-full font-semibold text-center text-SM">Min Stok</div>
          </template>
          <template #body="slotProps">
            <div class="text-center text-SM">
              {{ slotProps.data.minStok }}
            </div>
          </template>
        </Column>
        <Column headerClass="bg-opensimrs-50" class="min-w-[120px]">
          <template #header>
            <div class="w-full font-semibold text-center text-SM">Max Stok</div>
          </template>
          <template #body="slotProps">
            <div class="text-center text-SM">
              {{ slotProps.data.maxStok }}
            </div>
          </template>
        </Column>
        <Column headerClass="bg-opensimrs-50" class="min-w-[120px]">
          <template #header>
            <div class="w-full font-semibold text-center text-SM">Retur</div>
          </template>
          <template #body="slotProps">
            <div class="text-center text-SM">
              {{ slotProps.data.retur }} Box
            </div>
          </template>
        </Column>
        <Column headerClass="bg-opensimrs-50" class="min-w-[120px]">
          <template #header>
            <div class="w-full font-semibold text-center text-SM">
              Penerimaan
            </div>
          </template>
          <template #body="slotProps">
            <div class="text-center text-SM">
              {{ slotProps.data.penerimaan }} Box
            </div>
          </template>
        </Column>
      </DataTable>
    </template>
    <template #footer>
        <hr class="py-2 border-grey-200" />
      <div>
        <div class="font-semibold underline text-SM">Total Item</div>
        <div class="font-normal text-normal">
          {{ detailData?.datas.length }} item
        </div>
      </div>
    </template>
  </Card>
</template>
