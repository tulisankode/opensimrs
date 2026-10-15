<script setup lang="ts">
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDragDrop from "@/components/Base/CustomDragDrop.vue";
import fileTerunggah from "@/assets/images/RekamMedis/UnggahBerkas/fileTerunggah.svg";
import RONTGENT from "@/assets/images/RekamMedis/UnggahBerkas/RONTGENT.svg";
import EKG from "@/assets/images/RekamMedis/UnggahBerkas/EKG.svg";
import GatalPadaKulit from "@/assets/images/RekamMedis/UnggahBerkas/Gatal Pada Kulit.svg";
import NamaFile from "@/assets/images/RekamMedis/UnggahBerkas/Nama File.svg";
import { onMounted, ref } from "vue";
import { computed } from "vue";
import DataTable from "primevue/datatable";
import { useForm, useFieldArray, ErrorMessage } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { utilsStore } from "@/stores/utils";
import { useRekamMedisPelayananStore } from "@/stores/rekamMedis/rekamMedisPelayanan";
import { epochToDate } from "@/utils/Helpers";
import CustomDialog from "@/components/Base/CustomDialog.vue";

// NOTE Store
const storeUtils = utilsStore();
const rekamMedisPelayananStore = useRekamMedisPelayananStore();

const props = defineProps({
  method: {
    type: String,
    default: "form",
  },
  clickIcon: {
    type: String,
    default: "list",
  },
  rmUuid: {
    type: String,
    default: "",
  },
  rmType: {
    type: String,
    default: "rawat-jalan",
  },
});

const uploadedFile = ref();
const listFiles = ref<any[]>([]);
const modeIcon = ref(props.clickIcon);
const toggleViewMode = () => {
  modeIcon.value = modeIcon.value === "list" ? "table" : "list";
};

const currentIcon = computed(() => {
  return modeIcon.value === "list" ? "PhListBullets" : "PhGridFour";
});
const listAction = ref([
  {
    label: "Edit",
    icon: "PhPencilSimple",
    color: "text-[#3D84E5]",
  },
  {
    label: "Delete",
    icon: "PhTrash",
    color: "text-danger-300",
  },
]);

const berkasInput = ref<InstanceType<typeof CustomDragDrop> | null>(null);

const fetchBerkasData = async () => {
  const responseBerkas = await rekamMedisPelayananStore.getAllFiles(
    props.rmUuid
  );
  if (responseBerkas && responseBerkas.payload) {
    listFiles.value = responseBerkas.payload;
  }
};

const uploadBerkas = async () => {
  if (uploadedFile.value) {
    try {
      storeUtils.setLoading(true);
      const response = await rekamMedisPelayananStore.uploadFile({
        rekamMedisUuid: props.rmUuid,
        file: uploadedFile.value,
        fileType: "berkas",
        fileFormat: berkasInput.value?.fileExtension ?? "",
        namaFile: berkasInput.value?.fileName ?? "",
        admissionType:
          props.rmType == "rawat-jalan"
            ? "rj"
            : props.rmType == "rawat-inap"
            ? "ri"
            : props.rmType == "igd"
            ? "igd"
            : "fisio",
      });
      if (response && response.payload) {
        berkasInput.value?.clearFile();
        await fetchBerkasData();
      }
    } catch (error) {
      console.error("Failed to post data", error);
    } finally {
      storeUtils.setLoading(false);
    }
  }
};

const editBerkasInput = ref<InstanceType<typeof CustomDragDrop> | null>(null);
const editedFileData = ref<any>({});
const editedFile = ref("");
const editBerkas = async () => {
  if (editedFile.value) {
    try {
      storeUtils.setLoading(true);
      const response = await rekamMedisPelayananStore.updateFile({
        file: editedFile.value,
        fileUuid: editedFileData.value?.uuid,
      });
      if (response) {
        editBerkasInput.value?.clearFile();
        isDialogEdit.value = false;
        await fetchBerkasData();
      }
    } catch (error) {
      console.error("Failed to post data", error);
    } finally {
      storeUtils.setLoading(false);
    }
  }
};

const deleteBerkas = async (uuid: string) => {
  try {
    storeUtils.setLoading(true);
    const response = await rekamMedisPelayananStore.deleteFile(props.rmUuid, {
      fileUuid: uuid,
    });
    await fetchBerkasData();
  } catch (error) {
    console.error("Failed to post data", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const isDialogEdit = ref<boolean>(false);
const showDialogEdit = (editedData: any) => {
  isDialogEdit.value = true;
  editedFileData.value = editedData;
};

onMounted(async () => {
  await fetchBerkasData();
  // Mengatur nilai awal dari form
});

const accordion = ref<HTMLCanvasElement | null>(null);
const open = () => {
  if (accordion.value) {
    (accordion.value as any).open();
  }
};
const close = () => {
  if (accordion.value) {
    (accordion.value as any).close();
  }
};

defineExpose({
  open,
  close,
});
</script>

<template>
  <CustomAccordion headerClass="bg-opensimrs-50" ref="accordion">
    <template #header>Unggah Berkas</template>
    <template #content>
      <div class="flex py-5 gap-2.5">
        <div class="">
          <CustomDragDrop
            v-model="uploadedFile"
            class="h-[400px] w-[300px]"
            :allowed-file-types="['image/png', 'image/jpeg', 'application/pdf']"
            icon-button="PhMagnifyingGlass"
            ref="berkasInput"
            returnObject
          />
          <CustomButton
            label="Upload File"
            full
            @click="uploadBerkas"
            class="mt-5"
          />
        </div>
        <div class="min-h-[400px] px-5 grow py-5">
          <div class="flex justify-between">
            <div class="py-1.5 flex gap-2.5">
              <div><img :src="fileTerunggah" alt="" /></div>
              <div class="font-semibold text-grey-400 text-MD">
                File Terunggah
              </div>
            </div>
            <div class="">
              <CustomButton
                :icon="currentIcon"
                show-icon
                background-color="bg-transparent"
                text-color="text-opensimrs-300"
                @click="toggleViewMode"
              />
            </div>
          </div>
          <hr class="border-1 border-grey-100 my-2.5" />
          <div class="">
            <div
              class="py-2.5 grid grid-cols-4 gap-6"
              v-if="modeIcon == 'list'"
            >
              <div
                v-for="(berkas, index) in listFiles"
                :key="`berkas-${index}`"
              >
                <div><img :src="berkas.file" alt="" class="h-[230px]" /></div>
                <div class="flex items-center justify-between">
                  <div class="p-2.5 font-normal text-SM text-grey-600">
                    {{ berkas.namaFile ?? "-" }}
                  </div>
                  <div>
                    <SpeedDial :model="listAction" direction="down">
                      <template #button="{ toggleCallback }">
                        <CustomButton
                          @click="toggleCallback"
                          icon="PhDotsThreeVertical"
                          show-icon
                          background-color="bg-transparent"
                          text-color="text-opensimrs-300"
                        />
                      </template>
                      <template #item="{ item }">
                        <component
                          @click="
                            item.label == 'Edit'
                              ? showDialogEdit(berkas)
                              : deleteBerkas(berkas.uuid)
                          "
                          :is="item.icon"
                          :size="26"
                          weight="fill"
                          :class="`cursor-pointer ${item.color}`"
                        />
                      </template>
                    </SpeedDial>
                  </div>
                </div>
              </div>
            </div>
            <div v-else>
              <DataTable
                :value="listFiles"
                tableStyle="min-width: 50rem"
                class="text-xs rounded-lg bg-opensimrs-50"
              >
                <Column headerClass="bg-opensimrs-50" class="w-1/2">
                  <template #header>
                    <div class="font-semibold">Nama File</div>
                  </template>
                  <template #body="slotProps">
                    {{ slotProps.data?.namaFile ?? "-" }}
                    <ErrorMessage
                      :name="`datas[${slotProps.index}].jenisPembayaran`"
                      class="text-danger-300"
                    />
                  </template>
                </Column>

                <Column headerClass="bg-opensimrs-50 " class="w-[150px]">
                  <template #header>
                    <div class="w-full font-semibold text-center">
                      Tipe File
                    </div>
                  </template>
                  <template #body="slotProps">
                    <div class="w-full text-center">
                      {{ slotProps.data?.fileType }}
                    </div>
                  </template>
                </Column>
                <Column headerClass="bg-opensimrs-50">
                  <template #header>
                    <div class="w-full font-semibold text-center">
                      Tanggal Upload
                    </div>
                  </template>
                  <template #body="slotProps">
                    <div class="w-full text-center">
                      {{ epochToDate(slotProps.data?.createdAt, "date") }}
                    </div>
                  </template>
                </Column>

                <Column headerClass="bg-opensimrs-50">
                  <template #header>
                    <div class="w-full font-semibold text-center">Action</div>
                  </template>
                  <template #body="{ data }">
                    <div class="flex items-center justify-center gap-2.5">
                      <CustomButton
                        label=""
                        background-color="bg-[#3D84E5] rounded-lg"
                        class="h-6 w-[26px] p-0"
                        @click="showDialogEdit(data)"
                      >
                        <img src="@/assets/icons/edit.svg" alt="" />
                      </CustomButton>
                      <CustomButton
                        label=""
                        background-color="bg-danger-300 rounded-lg"
                        class="h-6 w-[26px] p-0"
                        @click="deleteBerkas(data?.uuid)"
                      >
                        <img src="@/assets/icons/delete.svg" alt="" />
                      </CustomButton>
                    </div>
                  </template>
                </Column>
              </DataTable>
            </div>
          </div>
        </div>

        <CustomDialog
          width="600px"
          :visible="isDialogEdit"
          @update:visible="isDialogEdit = false"
          headerBg="bg-opensimrs-300"
        >
          <template #header>
            Edit Data Berkas ({{ editedFileData.namaFile }})
          </template>
          <template #body>
            <div class="pt-5">
              <CustomDragDrop
                v-model="editedFile"
                class="h-[400px] w-[300px] mx-auto"
                :allowed-file-types="[
                  'image/png',
                  'image/jpeg',
                  'application/pdf',
                ]"
                icon-button="PhMagnifyingGlass"
                ref="editBerkasInput"
                returnObject
              />
              <CustomButton
                label="Upload File"
                full
                @click="editBerkas"
                class="mt-5"
              />
            </div>
          </template>
        </CustomDialog>
      </div>
    </template>
  </CustomAccordion>
</template>
