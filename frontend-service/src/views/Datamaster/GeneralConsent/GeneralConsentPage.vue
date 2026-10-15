<script lang="ts" setup>
import { ref, onMounted, computed, watch } from "vue";
import { useGeneralConsentStore } from "@/stores/datamaster/generalConsent";
import * as XLSX from "xlsx-js-style";
import { utilsStore } from "@/stores/utils";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import FormGeneralConsent from "./FormGeneralConsent.vue";
import DialogDelete from "../Layout/DialogDelete.vue";
import HeaderFilter from "../Layout/HeaderFilter.vue";
import NoData from "@/components/section/NoData.vue";
import FooterPaginator from "../Layout/FooterPaginator.vue";
// State Management
const generalConsentStore = useGeneralConsentStore();
const UseUtilsStore = utilsStore();
const generalConsentPayload = ref<any[]>([]);
const generalConsentProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});

// Search Query
const searchQuery = ref<string>("");

// Fetch generalConsent Data from API
const fetchGeneralConsentData = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const response = await generalConsentStore.getApi(
      generalConsentProperties.value.page,
      generalConsentProperties.value.page_size,
      searchQuery.value
    );

    if (response && response.payload) {
      generalConsentProperties.value.total = response.properties.total;
      generalConsentPayload.value = response.payload;
    } else {
      generalConsentPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
    generalConsentPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, (newValue) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetchGeneralConsentData();
  }, 500);
});

onMounted(() => {
  fetchGeneralConsentData();
});

// Handle Pagination
const handlePage = (event: any) => {
  generalConsentProperties.value.page = event.page + 1;
  generalConsentProperties.value.page_size = event.rows;
  fetchGeneralConsentData();
};

// Check if Data Exists
const hasData = computed(
  () => generalConsentPayload.value && generalConsentPayload.value.length > 0
);

// Selected Row
const metaKey = ref(true);
const selectedData = ref();

const onRowSelect = (event: any) => {
  selectedData.value = event.data;
  openDialog("detail", "Detail Data General Consent", selectedData.value);
};

// Dialog Management
const isTambahDataDialogVisible = ref(false);
const isDeleteDialogVisible = ref(false);

const dialogConfig = ref<any>({
  method: "add",
  title: "Tambah Data",
  data: null,
});

const openDialog = (method: string, title: string, data: any = null) => {
  dialogConfig.value = { method, title, data };
  isTambahDataDialogVisible.value = true;
};

const deleteDialog = (method: string, title: string, data: any = null) => {
  dialogConfig.value = { method, title, data };
  isDeleteDialogVisible.value = true;
};

const confirmDelete = async (item: any) => {
  if (item) {
    UseUtilsStore.setLoading(true);
    try {
      await generalConsentStore.deleteApi(item.uuid);
      fetchGeneralConsentData();
    } catch (error) {
      console.error("Failed to delete data", error);
    } finally {
      UseUtilsStore.setLoading(false);
      isDeleteDialogVisible.value = false;
    }
  }
};
</script>

<template>
  <Card
    pt:body:class="h-full pt-0 overflow-auto"
    pt:content:class="h-full overflow-auto"
    class=""
  >
    <template #header>
      <HeaderFilter
        page-type="general"
        @update:valueSearch="searchQuery = $event"
        @tambah-data="openDialog('add', 'Tambah Data General Consent')"
        @reload-data="fetchGeneralConsentData()"
      />
    </template>

    <template #content>
      <NoData v-if="!hasData" />
      <DataTable
        v-else
        :value="generalConsentPayload"
        v-model:selection="selectedData"
        :metaKeySelection="metaKey"
        @rowClick="onRowSelect"
        selectionMode="single"
        tableStyle="min-width: 50rem"
        stripedRows
        class="text-xs"
        :dt="{
          rowSelectedColor: '#000000',
          rowSelectedBackground: 'transparent',
          bodyCellSelectedBorderColor: 'transparent',
          bodyCellBorderColor: 'transparent',
          rowStripedBackground: '#F8F8F8',
        }"
      >
        <Column headerClass="bg-opensimrs-50">
          <template #header>
            <div class="w-full font-semibold text-center">No.</div>
          </template>
          <template #body="slotProps">
            <div class="flex items-center justify-center">
              {{
                (generalConsentProperties.page - 1) *
                  generalConsentProperties.page_size +
                slotProps.index +
                1
              }}
            </div>
          </template>
        </Column>
        <Column
          field="code"
          header="Kode General Consent"
          headerClass="bg-opensimrs-50"
        ></Column>
        <Column
          field="name"
          header="Nama General Consent"
          headerClass="bg-opensimrs-50"
          class="w-1/2"
        ></Column>
        <Column field="status" headerClass="bg-opensimrs-50">
          <template #header>
            <div class="w-full h-full font-semibold text-center text-SM">
              Status
            </div>
          </template>
          <template #body="slotProps">
            <div class="flex justify-center items-center min-w-[120px]">
              <CustomChip
                :label="slotProps.data.status ? 'AKTIF' : 'NON-AKTIF'"
                :textColor="
                  slotProps.data.status ? 'text-white' : 'text-[#80868d]'
                "
                :bgColor="slotProps.data.status ? 'bg-opensimrs-300' : 'bg-white'"
                :borderColor="
                  slotProps.data.status ? 'border-none' : 'border-[#80868d]'
                "
                :icon-color="slotProps.data.status ? 'white' : '#80868d'"
                customClass="text-xs font-semibold h-5 flex"
              />
            </div>
          </template>
        </Column>
        <Column headerClass="bg-opensimrs-50">
          <template #header="slotProps">
            <div class="w-full font-semibold text-center text-SM">Action</div>
          </template>
          <template #body="slotProps">
            <div class="flex items-center gap-2.5 justify-center">
              <CustomButton
                label=""
                background-color="bg-[#3D84E5] rounded-lg"
                class="h-6 w-[26px] p-0"
                @click="
                  openDialog(
                    'edit',
                    'Edit Data General Consent',
                    slotProps.data
                  )
                "
              >
                <img src="@/assets/icons/edit.svg" alt="" />
              </CustomButton>
              <CustomButton
                label=""
                background-color="bg-danger-300 rounded-lg"
                class="h-6 w-[26px] p-0"
                @click="
                  deleteDialog(
                    'delete',
                    `${slotProps.data.code}-${slotProps.data.name}`,
                    slotProps.data
                  )
                "
              >
                <img src="@/assets/icons/delete.svg" alt="" />
              </CustomButton>
            </div>
          </template>
        </Column>
      </DataTable>
      <FormGeneralConsent
        v-model:isDialogVisible="isTambahDataDialogVisible"
        :title="dialogConfig.title"
        :method="dialogConfig.method"
        :payload="dialogConfig.data"
        @data-updated="fetchGeneralConsentData"
      />
      <DialogDelete
        v-model:isDialogVisible="isDeleteDialogVisible"
        :title="dialogConfig.title"
        :itemToDelete="dialogConfig.data"
        @delete="confirmDelete"
      />
    </template>

    <template #footer>
      <FooterPaginator
        :rows="generalConsentProperties.page_size"
        :totalRecords="generalConsentProperties.total"
        @page="handlePage"
        :showExport="false"
        :showImport="false"
        :showDownload="false"
      />
    </template>
  </Card>
</template>
