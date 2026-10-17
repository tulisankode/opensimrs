<script setup lang="ts">
import { ref, watch, onMounted, computed } from "vue";
import { utilsStore } from "@/stores/utils";
import { useLabRujukanStore } from "@/stores/datamasterLaboratorium/labRujukan";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import DialogDelete from "../../Layout/DialogDelete.vue";
import DialogLabRujukan from "./DialogLabRujukan.vue";
import NoData from "@/components/section/NoData.vue";

const labRujukanStore = useLabRujukanStore();
const storeUtils = utilsStore();
const labRujukanPayload = ref(<any[]>[]);
const searchQuery = ref<string>("");
const labRujukanProperties = ref({
  page: 1,
  page_size: 10,
  total: 0,
});
const handleSearchQuery = (searchValue: string) => {
  searchQuery.value = searchValue;
};

const fetchLabRujukan = async () => {
  storeUtils.setLoading(true);
  try {
    const response = await labRujukanStore.getApi(
      labRujukanProperties.value.page,
      labRujukanProperties.value.page_size,
      searchQuery.value
    );
    if (response && response.payload) {
      labRujukanProperties.value.total = response.payload.pagination.total;
      labRujukanPayload.value = response.payload.data;
    } else {
      labRujukanPayload.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch lab rujukan", error);
    labRujukanPayload.value = [];
  } finally {
    storeUtils.setLoading(false);
  }
};

const labRujukanDialogRef = ref();

const openAddDialog = () => {
  labRujukanDialogRef.value.resetForm();
  labRujukanDialogRef.value.visible = true;
  labRujukanDialogRef.value.editMode = false;
};

const editDialog = (item: any) => {
  labRujukanDialogRef.value.fillForm({
    code: item.code,
    name: item.name,
    alamat: item.alamat,
    telepon: item.telepon,
    kontakPerson: item.kontakPerson,
    status: item.status,
    id: item.uuid,
  });
  labRujukanDialogRef.value.visible = true;
};

const submitLabRujukan = async (payload: any) => {
  storeUtils.setLoading(true);
  try {
    let response;
    if (payload.id) {
      response = await labRujukanStore.putApi(payload.id, payload);
    } else {
      response = await labRujukanStore.postApi(payload);
    }

    if (response) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      searchQuery.value = "";
      await fetchLabRujukan();
      resetForm();
      labRujukanDialogRef.value.visible = false;
    }
  } catch (error) {
    console.error("Error submitting data", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const isDeleteDialogVisible = ref(false);
const dialogConfig = ref({
  method: "",
  title: "",
  data: {},
});

const deleteDialog = (method: string, title: string, data: any = null) => {
  dialogConfig.value = { method, title, data };
  isDeleteDialogVisible.value = true;
};

const confirmDelete = async (item: any) => {
  if (item) {
    storeUtils.setLoading(true);
    try {
      await labRujukanStore.deleteApi(item.uuid);
      fetchLabRujukan();
    } catch (error) {
      console.error("Failed to delete data", error);
    } finally {
      storeUtils.setLoading(false);
      isDeleteDialogVisible.value = false;
    }
  }
};

const hasData = computed(() => labRujukanPayload.value.length > 0);

const resetForm = () => {
  labRujukanDialogRef.value?.resetForm();
};

const handlePage = (event: any) => {
  labRujukanProperties.value.page = event.page + 1;
  labRujukanProperties.value.page_size = event.rows;
  fetchLabRujukan();
};

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
watch(searchQuery, (newValue) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetchLabRujukan();
  }, 500);
});

const onUpload = (event: any) => {
  const uploadedFiles = event.files[0];
  importExcel(uploadedFiles);
};

const importExcel = async (file: File) => {
  const dataUpload = new FormData();
  dataUpload.append("file", file);
  try {
    await labRujukanStore.importApi(dataUpload);
    fetchLabRujukan();
  } catch (error) {
    console.error("Error uploading file:", error);
  }
};

onMounted(async () => {
  await fetchLabRujukan();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card
      pt:body:class="h-full pt-0 overflow-auto"
      pt:content:class="h-full overflow-hidden"
      class="h-full overflow-hidden"
    >
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="fetchLabRujukan" />
          <CustomBreadCrumb :home="{ label: 'Datamaster', home: true }" />
          <PhCaretRight :size="16" weight="bold" class="shrink-0 text-opensimrs-300" aria-hidden="true" />
          <h1 class="toolbar-heading text-opensimrs-300">Laboratorium Rujukan</h1>
          <CustomTextfield
            v-model="searchQuery"
            label="Cari Laboratorium Rujukan"
            prependIcon="PhMagnifyingGlass"
            placeholder="Cari Laboratorium Rujukan"
          />
          <CustomButton @click="openAddDialog" icon="PhPlus" label="Data" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!hasData" />
        <DataTable
          :value="labRujukanPayload"
          tableStyle="min-width: 50rem"
          stripedRows
          class="text-xs"
          scrollable
          scrollHeight="flex"
        >
          <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
            <template #header>
              <div class="w-full text-center">No.</div>
            </template>
            <template #body="slotProps">
              <div class="flex items-center justify-center">
                {{
                  (labRujukanProperties.page - 1) * labRujukanProperties.page_size +
                  slotProps.index +
                  1
                }}
              </div>
            </template>
          </Column>
          <Column field="code" header="Kode" headerClass="bg-opensimrs-50" class="w-[12%]">
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.code }}</div>
            </template>
          </Column>
          <Column field="name" header="Nama" headerClass="bg-opensimrs-50" class="w-[25%]">
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.name }}</div>
            </template>
          </Column>
          <Column field="alamat" header="Alamat" headerClass="bg-opensimrs-50" class="w-[23%]">
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.alamat || "-" }}</div>
            </template>
          </Column>
          <Column field="telepon" header="Telepon" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.telepon || "-" }}</div>
            </template>
          </Column>
          <Column field="kontakPerson" header="Kontak Person" headerClass="bg-opensimrs-50">
            <template #body="slotProps">
              <div class="text-SM">{{ slotProps.data.kontakPerson || "-" }}</div>
            </template>
          </Column>

          <Column field="status" headerClass="bg-opensimrs-50 font-semibold text-SM">
            <template #header>
              <div class="w-full text-center">Status</div>
            </template>
            <template #body="slotProps">
              <div class="flex justify-center items-center min-w-[120px]">
                <CustomChip
                  :label="slotProps.data.status === true ? 'AKTIF' : 'NON-AKTIF'"
                  :textColor="slotProps.data.status === true ? 'text-white' : 'text-[#80868d]'"
                  :bgColor="slotProps.data.status === true ? 'bg-opensimrs-300' : 'bg-white'"
                  :borderColor="slotProps.data.status === true ? 'border-none' : 'border-[#80868d]'"
                  :icon-color="slotProps.data.status === true ? 'white' : '#80868d'"
                  customClass="text-xs font-semibold h-5 flex"
                />
              </div>
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50">
            <template #header>
              <div class="w-full font-semibold text-center text-SM">Action</div>
            </template>
            <template #body="slotProps">
              <div class="flex items-center gap-2.5 justify-center">
                <CustomButton
                  label=""
                  background-color="bg-[#3D84E5] rounded-lg"
                  @click="editDialog(slotProps.data)"
                  class="h-6 w-[26px] p-0"
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
      </template>
      <template #footer>
        <div class="flex justify-between px-5 py-2.5">
          <div class="flex items-center gap-2.5">
            <FileUpload
              mode="basic"
              accept=".xls,.xlsx"
              :maxFileSize="1000000"
              label="Import"
              chooseLabel="Import"
              auto
              class="bg-opensimrs-300 rounded-[10px] h-10 text-white border-opensimrs-300"
              @select="onUpload"
              custom-upload
              name="dems[]"
            >
              <template #chooseicon>
                <img src="@/assets/icons/File Import.svg" alt="" />
              </template>
            </FileUpload>
          </div>
          <CustomPaginator
            :rows="labRujukanProperties.page_size"
            :totalRecords="labRujukanProperties.total"
            :rowsPerPageOptions="[10, 20, 30]"
            @page="handlePage"
          />
        </div>
      </template>
    </Card>

    <DialogLabRujukan
      ref="labRujukanDialogRef"
      @submit="submitLabRujukan"
      @reset="resetForm"
    />

    <DialogDelete
      v-model:isDialogVisible="isDeleteDialogVisible"
      :title="dialogConfig.title"
      :itemToDelete="dialogConfig.data"
      @delete="confirmDelete"
    />
  </div>
</template>
