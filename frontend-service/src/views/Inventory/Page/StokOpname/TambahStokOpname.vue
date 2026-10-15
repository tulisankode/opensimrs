<script lang="ts" setup>
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomMultiSelect from "@/components/Base/CustomMultiSelect.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import NoData from "@/components/section/NoData.vue";
import type { MenuItem } from "primevue/menuitem";
import { computed } from "vue";
import { ref, type PropType } from "vue";
import LayoutDialog from "../../Layout/LayoutDialog.vue";

const props = defineProps({
  pageType: {
    type: String,
    required: true,
  },
  dataBreadCrumb: {
    type: Array as PropType<MenuItem[]>,
    default: () => [],
  },
});

const emit = defineEmits(["kembali", "onSimpanDraft", "onSimpanAkhiriSO"]);

const jenisStok = ref([
  { id: 1, name: "Umum" },
  { id: 2, name: "BPJS" },
]);

const jenisStokSelected = ref([]);
const jenisItem = ref([
  { id: 1, name: "Obat" },
  { id: 2, name: "Alkes" },
]);

const jenisItemSelected = ref([]);

// State untuk data dan status
const isDataAvailable = ref(false);
const dataItems = ref([
  // Contoh data, ganti dengan data yang diambil dari API
  {
    id: 1,
    namaItem: "Obat 1",
    jenisStok: "Umum",
    jenisItem: "Obat",
    kategoriItem: "Medis",
    jenisObat: "Obat Keras",
    stokAwal: 900,
    stokMasuk: 900,
    stokKeluar: 900,
    stokSistem: 900,
    stokFisik: 0,
    selisih: 0,
    hargaDasar: 12000,
    hargaAkhir: 10000,
    expDate: "01-01-25",
  },
  {
    id: 2,
    namaItem: "Obat 2",
    jenisStok: "Umum",
    jenisItem: "Obat",
    kategoriItem: "Medis",
    stokAwal: 900,
    stokMasuk: 900,
    stokKeluar: 900,
    stokSistem: 900,
    stokFisik: 0,
    selisih: -1,
    hargaDasar: 600,
    hargaAkhir: 500,
    expDate: "01-01-25",
  },
]);

const selectedDataItem = ref<typeof dataItems.value>([]);
const rekonsilTitle = ref<string | null>(null);

const rekonsilDariMasterItem = () => {
  isDataAvailable.value = true;
  rekonsilTitle.value = "Rekonsil Dari Master Item";
  console.log("Data dari Master Item di-fetch");
};

const rekonsilDariStokItem = () => {
  isDataAvailable.value = true;
  rekonsilTitle.value = "Rekonsil Dari Stok Item";
  console.log("Data dari Stok Item di-fetch");
};



const onSubmitDraft = () => {
  const payload = {
    tglCutOff: "01-01-2024",
    noStokOpname: "1243",
    judul: "Judul Stok Opname",
    petugasStokOpname: "Nama Petugas",
    datas: dataItems.value,
    totalItem: dataItems.value.length,
    status: "DRAFT",
    jenisStok: "Umum",
    jenisItem: "Alkes",
    kategoriItem: "Medis",
  };

  console.log("Submitted with", payload);
  emit("onSimpanDraft", payload);
};

const onSubmitAkhiriSO = () => {
  const payload = {
    tglCutOff: "01-01-2024",
    noStokOpname: "1243",
    judul: "Judul Stok Opname",
    petugasStokOpname: "Nama Petugas",
    datas: dataItems.value,
    totalItem: dataItems.value.length,
    status: "SELESAI",
    jenisStok: "Umum",
    jenisItem: "Alkes",
    kategoriItem: "Medis",
  };
   console.log("Submitted with", payload);
  emit("onSimpanAkhiriSO", payload);
}

const isDialogVisible = ref(false);

const dialogConfig = ref({
  title: "",
  buttonFooterLeft: "",
  buttonFooterRight: "",
  message: "",
});
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
                  label: 'Stok Opname', // Selalu tampilkan 'Pengadaan Barang'
                  home: true,
                }"
                :model="[
                  ...dataBreadCrumb, // Model lainnya tetap dari dataBreadCrumb
                ]"
                class=""
              />

              <div v-if="isDataAvailable" class="flex">
                <hr class="h-6 mx-2.5 border-2 border-opensimrs-300" />
                <div class="font-semibold text-opensimrs-300 text-MD">
                  Tgl. Cut off : 01-01-2024
                </div>
              </div>
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
          <div class="flex gap-7 py-2.5">
            <CustomTextfield
              label="Judul Stok Opname"
              class="w-[350px]"
              placeholder="Masukkan judul Stok Opname"
            />
            <CustomMultiSelect
              class="w-[350px]"
              label="Jenis Stok"
              :options="jenisStok"
              placeholder="Pilih Kategori Item"
              v-model:modelValue="jenisStokSelected"
              optionValue="id"
              optionLabel="name"
            />
            <CustomSelect
              label="Kategori Item"
              placeHolder="Pilih Kategori Item"
              optionValue="code"
              optionLabel="name"
              :isLoading="false"
              class="grow"
            />
            <CustomMultiSelect
              class="w-[350px]"
              label="Jenis Item"
              :options="jenisItem"
              placeholder="Pilih Jenis Item"
              v-model:modelValue="jenisItemSelected"
              optionValue="id"
              optionLabel="name"
            />
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
      <div class="flex flex-col h-full">
        <div class="flex items-center justify-between pb-2.5">
          <div class="flex gap-2.5">
            <div class="font-semibold text-MD text-opensimrs-300">
              Daftar Item Stok Opname
            </div>
            <div
              v-if="rekonsilTitle"
              class="font-semibold text-grey-300 text-MD"
            >
              ({{ rekonsilTitle }})
            </div>
          </div>
          <div v-if="!isDataAvailable">
            <CustomButton
              label="Rekonsil Dari Master Item"
              class="mr-[10px]"
              @click="rekonsilDariMasterItem"
            />
            <CustomButton
              label="Rekonsil Dari Stok Item"
              @click="rekonsilDariStokItem"
            />
          </div>
          <div v-else>
            <CustomButton
              icon="PhDownloadSimple"
              label="Kartu Stok"
              class="mr-[10px]"
            />
            <CustomButton
              icon="PhUploadSimple"
              label="Import Excel"
              class="mr-[10px]"
            />

            <!-- <hr class="pt-5 border-grey-200" /> -->
            <CustomButton
              v-if="selectedDataItem.length > 0"
              icon="PhTrash"
              label="Hapus Item"
              class="bg-danger-300"
            />
          </div>
        </div>
        <hr class="py-2 border-grey-200" />
        <div v-if="isDataAvailable" class="flex flex-col gap-5">
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
            :rowClass="
              (data) => ({
                'bg-danger-50': selectedDataItem.includes(data),
              })
            "
            dataKey="id"
            selectionMode="multiple"
            v-model:selection="selectedDataItem"
            :value="dataItems"
            tableStyle="min-width: 50rem"
            scrollable
            scrollHeight="250px"
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
                <div class="font-normal text-[8px] text-opensimrs-300">
                  Tablet
                </div>
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
                <div class="font-normal text-[8px] text-opensimrs-300">
                  Tablet
                </div>
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
                <div class="font-normal text-[8px] text-opensimrs-300">
                  Tablet
                </div>
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
                <div class="font-normal text-[8px] text-opensimrs-300">
                  Tablet
                </div>
              </template>
            </Column>
            <Column headerClass="bg-opensimrs-50" class="w-[130px]">
              <template #header>
                <div class="w-full font-semibold text-center">Stok Fisik</div>
              </template>
              <template #body="slotProps">
                <CustomInputNumber
                  label=""
                  v-model:modelValue="slotProps.data.stokFisik"
                  disabled
                >
                  <template #appendText>
                    <div class="flex items-center justify-center px-2 text-XS">
                      Tablet
                    </div>
                  </template>
                </CustomInputNumber>
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
            <Column
              header="Action"
              body-class="text-center"
              selectionMode="multiple"
              headerStyle="width: 3rem"
              headerClass="bg-opensimrs-50"
              class="custom-checkbox"
            >
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

        <NoData v-else />
      </div>
       <LayoutDialog
        v-model:isDialogVisible="isDialogVisible"
        :buttonFooterLeft="dialogConfig.buttonFooterLeft"
        :buttonFooterRight="dialogConfig.buttonFooterRight"
        :message="dialogConfig.message"

        :title="dialogConfig.title"
      />
    </template>
    <template #footer>
      <hr class="pt-5 border-grey-200" />
      <div class="flex justify-between">
        <div
          :class="`grid gap-7 ${
            isDataAvailable ? 'grid-cols-3' : 'grid-cols-2'
          }`"
        >
          <div>
            <div class="font-semibold underline text-SM">Total Item SO</div>
            <div class="font-normal text-normal">0 item</div>
          </div>
          <div>
            <div class="font-semibold underline text-SM">Tgl. Selesai SO</div>
            <div class="font-normal text-normal">01-01-2024</div>
          </div>
          <div v-if="isDataAvailable">
            <div class="font-semibold underline text-SM">Petugas SO</div>
            <div class="font-normal text-normal">Nama Petugas</div>
          </div>
        </div>
        <div>
          <CustomButton
            label="Simpan (Draft)"
            class="my-auto mr-2 bg-warning-300"
            :disabled="!isDataAvailable"
            @click="onSubmitDraft"
          />
          <CustomButton
            label="Simpan & Akhiri SO"
            class="my-auto bg-opensimrs-300"
             :disabled="!isDataAvailable"
             @click ="onSubmitAkhiriSO"
          />
        </div>
      </div>
    </template>
  </Card>
</template>

<style>
.custom-checkbox .p-checkbox-checked .p-checkbox-box {
  @apply border-danger-300 bg-danger-300; /* Kelas Tailwind untuk border dan warna latar */
}

.custom-checkbox .p-checkbox-checked .p-checkbox-box .p-checkbox-icon {
  @apply text-white; /* Kelas Tailwind untuk warna tanda centang */
}
</style>
