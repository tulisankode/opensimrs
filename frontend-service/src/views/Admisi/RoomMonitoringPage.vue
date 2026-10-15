<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useForm, useFieldArray } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import { utilsStore } from "@/stores/utils";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import type { DataTableRowClickEvent } from "primevue/datatable";
import MonitoringBedCard from "./Section/MonitoringBedCard.vue";
import EmptyMonitoringBedCard from "./Section/EmptyMonitoringBedCard.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import { useMonitoringKamarStore } from "@/stores/admisi/monitoringKamar";
import { useKategoriRuanganStore } from "@/stores/datamaster/kategoriRuangan";
import { useLokasiStore } from "@/stores/datamaster/lokasi";


// NOTE Store
const storeUtils = utilsStore();
const emit = defineEmits(["search"]);
const monitoringKamarStore = useMonitoringKamarStore();
const kategoriRuanganStore = useKategoriRuanganStore();
const lokasiStore = useLokasiStore();
const bedData = ref<any[]>([]);
const filterRoomCategoryList = ref<any[]>([]);
const selectedFilterRoomCategory = ref<string[]>([]);
const onRoomCategorySelect = (uuid: string) => {
  if (selectedFilterRoomCategory.value.includes(uuid)) {
    selectedFilterRoomCategory.value = selectedFilterRoomCategory.value.filter(
      (item) => item != uuid
    );
  } else {
    selectedFilterRoomCategory.value.push(uuid);
  }
  searchData();
};

const properties = ref({
  page: 1,
  pageSize: 10,
  total: 0,
});
const itemsRoom = ref<any[]>([]);

const search = ref("");

interface Filter {
  q?: string;
  filterKategori?: string[];
}
const fetchData = async () => {
  storeUtils.setLoading(true);
  const filter = {
    page: properties.value.page ?? 1,
    limit: properties.value.pageSize ?? 10,
    q: search.value ?? "",
    filterKelas: "", 
    filterKategori: selectedFilterRoomCategory.value ?? [],
  };

  try {
    const response = await monitoringKamarStore.getMonitoringKamar(filter);
    if (response && response.payload) {
      properties.value.total = response.properties?.totalData ?? 0;
      itemsRoom.value = response.payload;
      itemsRoom.value.forEach((room) => {
      });
    } else {
      itemsRoom.value = [];
      properties.value.total = 0;
    }
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    storeUtils.setLoading(false);
  }
};
const fetchUtils = async () => {
  storeUtils.setLoading(true);
  try {
    const response = await kategoriRuanganStore.getAktifApi();
    if (response && response.payload) {
      filterRoomCategoryList.value = response.payload;
    } else filterRoomCategoryList.value = [];
  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    storeUtils.setLoading(false);
  }
};
const { values } = useForm();

const ruangStatus = computed(() => {
  const beds = values.bedData ?? [];
  const adaKosong = beds.some((bed: any) => bed.statusOperasionalRuangan !== 'Penuh');
  return adaKosong ? 'Tersedia' : 'Penuh';
});

const resetFilter = () => {
  search.value = "";
  selectedFilterRoomCategory.value = [];
  fetchData();
};

const timer = ref<any>();
const searchData = () => {
  if (timer.value) {
    clearTimeout(timer.value);
    timer.value = null;
  }
  timer.value = setTimeout(async () => {
    await fetchData();
  }, 800);
};

const roomSettingDialog = ref(false);
const itemsBedSetting = ref([{}]);

const openedRoomData = ref<any>({});
const itemsBed = ref<any[]>([]);

const fetchBedData = async (data: any) => {
  storeUtils.setLoading(true);
  try {
    openedRoomData.value = data;
    const response = await monitoringKamarStore.getDetailMonitoringKamar(
      data.uuid
    );
    if (response && response.payload) {
      bedData.value = response.payload; 
      return response.payload;
    } else {
      bedData.value = []; 
      return [];
    }
  } catch (error) {
    throw new Error(error as string);
  } finally {
    storeUtils.setLoading(false);
  }
};



const showBedList = async (data: DataTableRowClickEvent) => {
  const fetched = await fetchBedData(data.data);


  itemsBed.value = Array.isArray(fetched)
  ? fetched.map((bed: any, idx: number) => {
      const status = bed.patient ? "Penuh" : "Tersedia";

      return {
        uuid: bed.uuid ?? null,
        bedName: bed.locationName ?? "",
        noBed: bed.noBed ?? "",
        type: bed.type ?? "",
        statusOperasionalRuangan: status,
        isAvailable: !bed.patient,
        patient: bed.patient ?? null,
        locationName: bed.locationName ?? "",
        lokasi_uuid: bed.lokasi_uuid ?? null,
      };
    })
  : [];
  replace(itemsBed.value);
};

const lokasiList = ref<any[]>([]);

const bedNameOptions = ref<any[]>([]); 

const bedDropdownOptions = computed(() => [
  { label: "Pilih Bed", value: "" },
  ...bedNameOptions.value,
]);


const loadBedNameOptions = async (partOfUuid: string) => {
  try {
    const res = await lokasiStore.getByPartOfApi(partOfUuid); 
    bedNameOptions.value = res?.payload?.map((item: any) => ({
      label: item.name ?? item.locationName,
      value: item.uuid,
    })) || [];
  } catch (error) {
    console.error(" Failed to load bed name options", error);
  }
};


const showBedForm = async (data: any) => {
  try {
    const partOfUuid = data.uuid; 

    const bedResponse = await lokasiStore.getByPartOfApi(partOfUuid);

    bedNameOptions.value = bedResponse?.payload?.map((bed: any) => ({
      label: bed.name,
      value: bed.uuid,
    })) || [];


    const fetchedData = await fetchBedData(data);

    if (Array.isArray(fetchedData)) {
      itemsBedSetting.value = fetchedData.length > 0 ? fetchedData : [{}];
    } else {
      itemsBedSetting.value = [{}];
    }

    itemsBedSetting.value = fetchedData.map((bed: any, index: number) => {
      const lokasi =
        bed.lokasi_uuid ??
        bed.lokasiUuid ??
        bed.location_uuid ??
        bed.locationUuid ??
        bed.uuid;
      
      const status = bed?.patient ? "Penuh" : "Tersedia";
      return {
        uuid: bed.uuid ?? "",
        bedName: bed.locationName ?? bed.name ?? "-",
        noBed: bed.noBed ?? "",
        bedType: bed.type ?? bed.bedType ?? "-",
        lokasi_uuid: lokasi,
        statusOperasionalRuangan: status,
      };
    });

    setValues({ bedData: [...itemsBedSetting.value] as any });
    roomSettingDialog.value = true;
  } catch (error) {
    console.error("Failed to fetch data", error);
  }
};

const schema = toTypedSchema(
  yup
    .object({
      bedData: yup.array().of(
        yup.object({
          uuid: yup.string().nullable(),
          noBed: yup.string().required("Nomor Bed harus diisi"),
          bedType: yup.string().required("Tipe Bed harus diisi"),
          statusOperasionalRuangan: yup.string().nullable(),
          lokasi_uuid: yup.string().required("Nama Bed harus diisi"),
        })
      ),
    })
    .noUnknown()
);

type BedData = {
  noBed: number;
  bedType: string;
  lokasi_uuid: string;
  bedName: string;
  statusOperasionalRuangan: string;
  uuid: string | null;
};


const onReset = () => {
  fields.value.forEach((item) => {
    const bed = item.value as BedData;

    bed.bedType = '';
    bed.lokasi_uuid = '';
    bed.bedName = '';
    bed.noBed = 1;
  });

  resetForm();
};

const { errors, handleSubmit, resetForm, setValues, defineField } = useForm({
  validationSchema: schema,
});

const onSubmit = handleSubmit(async (values) => {
  storeUtils.setLoading(true);
  try {
    const payload = (values.bedData ?? []).map((bed) => {
      return {
        uuid: bed.uuid ?? null, 
        no_bed: String(bed.noBed),  
        type: bed.bedType,
        status_operasional: bed.statusOperasionalRuangan || "Penuh",
        lokasi_uuid: bed.lokasi_uuid || undefined,
      };
    });
    await monitoringKamarStore.updateBed(
      openedRoomData.value.uuid,
      { beds: payload } 
    );
    await fetchData(); 
    const updatedBeds = await fetchBedData(openedRoomData.value);
    itemsBed.value = updatedBeds
    roomSettingDialog.value = false;
    resetForm();

  } catch (error) {
    console.error("Failed to fetch data", error);
  } finally {
    storeUtils.setLoading(false);
  }
});

const { remove, push, replace, fields } = useFieldArray("bedData");

onMounted(() => {
  fetchUtils();
  fetchData();
  loadBedNameOptions(""); 
});



function getByPartOfApi(partOfUuid: string) {
  throw new Error("Function not implemented.");
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card
      pt:body:class="h-full pt-0 overflow-auto"
      pt:content:class="h-full overflow-hidden"
      class="h-full overflow-hidden"
    >
      <template #header>
        <!-- Header satu baris (PageToolbar): komponen Base di dalamnya tampil ringkas tanpa label. -->
        <PageToolbar>
          <CustomButton @click="fetchData" icon="PhArrowClockwise" />
          <h1 class="toolbar-heading text-opensimrs-300">Monitoring Kamar</h1>
          <CustomTextfield
            v-model="search"
            @keydown.enter="fetchData"
            label="Cari Ruangan / Kamar"
            prependIcon="PhMagnifyingGlass"
            placeholder="Cari Ruangan / Kamar"
          />
          <ToolbarFilterMenu :count="selectedFilterRoomCategory.length">
            <template #label>Kategori Ruangan</template>
            <CustomChip
              v-for="(kategoriRuangan, index) in filterRoomCategoryList"
              :key="kategoriRuangan.uuid + index"
              :label="kategoriRuangan.name"
              :value="kategoriRuangan.uuid"
              :isSelected="
                selectedFilterRoomCategory.includes(
                  kategoriRuangan.uuid
                )
              "
              @selected="onRoomCategorySelect"
            />
          </ToolbarFilterMenu>
          <CustomButton
            @click="fetchData"
            icon="PhMagnifyingGlass"
            label="Cari"
          />
          <CustomButton
            @click="resetFilter"
            label="Reset"
            outlined
            borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300"
          />
        </PageToolbar>
      </template>
      <template #content>
        <div class="grid grid-cols-[40%_60%] gap-5 h-full mr-5">
          <div class="overflow-auto">
            <DataTable
              :value="itemsRoom"
              stripedRows
              scrollable
              scrollHeight="flex"
              :pt="{ headerRow: 'text-SM' }"
              @rowClick="showBedList"
            >
              <Column
                field="room"
                header="Ruangan"
                headerClass="bg-opensimrs-50"
                bodyClass="text-SM"
              >
                <template #body="{ data }">
                  <div class="flex">
                    <PhHospital
                      :size="20"
                      class="text-opensimrs-300"
                      weight="fill"
                    />
                    <span class="ml-1 leading-6">{{ data.name }}</span>
                  </div>
                  <div class="flex mt-[5px]">
                    <CustomChip
                      :showCheckedIcon="false"
                      :label="data.kategoriRuangan.name"
                      bgColor="bg-opensimrs-300"
                      textColor="text-white"
                      customClass="h-5 border-none"
                      class="mr-1"
                    />
                    <CustomChip
                      :showCheckedIcon="false"
                      :label="data.className"
                      bgColor="bg-opensimrs-300"
                      textColor="text-white"
                      customClass="h-5 border-none"
                      class=""
                    />
                  </div>
                </template>
              </Column>
              <Column
                    field="status"
                    headerClass="bg-opensimrs-50"
                    bodyClass="text-SM align-top"
                  >
                    <template #header>
                      <div class="w-full font-semibold text-center">Status</div>
                    </template>
                    <template #body="{ data }">
                      <div class="flex">
                        <CustomChip
                          :showCheckedIcon="false"
                          :label="(data.statusOperasionalRuangan ?? 'Penuh').toUpperCase()"
                          :bgColor="((data.statusOperasionalRuangan ?? 'Penuh').toLowerCase() === 'penuh'
                            ? 'bg-danger-300'
                            : 'bg-success-300')"
                          textColor="text-white"
                          customClass="h-5 pr-[9px] border-none"
                          class="mx-auto"
                        />
                      </div>
                    </template>
                  </Column>
              <Column
                field="action"
                headerClass="bg-opensimrs-50"
                bodyClass="text-SM"
                style="width: 100px"
              >
                <template #header>
                  <div class="w-full font-semibold text-center">Action</div>
                </template>
                <template #body="{ data }">
                  <PhGearSix
                    @click.stop="showBedForm(data)"
                    :size="24"
                    class="mx-auto cursor-pointer text-grey-300"
                    weight="fill"
                  />
                </template>
              </Column>
            </DataTable>
          </div>
          <div v-if="Object.keys(openedRoomData).length > 0" class="relative overflow-hidden">
          <div
            class="relative bg-opensimrs-50 h-[60px] rounded-t-[10px] px-5 flex items-center"
          >
            <PhHospital
              :size="40"
              class="text-opensimrs-300 mr-[10px]"
              weight="fill"
            />
            <span class="font-bold text-MD mr-[10px]">{{
              openedRoomData.name
            }}</span>
            <CustomChip
              :showCheckedIcon="false"
              :label="openedRoomData.kategoriRuangan.name"
              bgColor="bg-opensimrs-300"
              textColor="text-white"
              customClass="h-5 border-none"
              class="mr-1"
            />
            <CustomChip
              :showCheckedIcon="false"
              :label="openedRoomData.className"
              bgColor="bg-opensimrs-300"
              textColor="text-white"
              customClass="h-5 border-none"
              class=""
            />
          </div>

          <div
            v-if="itemsBed.length > 0"
            class="inset-0 top-[60px] border-[1px] overflow-auto rounded-b-[10px] py-[10px] px-5 grid grid-cols-2 gap-[10px] max-h-[300px]"
          >
            <div v-for="(bed, index) in itemsBed" :key="index" class="h-fit">
              <EmptyMonitoringBedCard
                v-if="bed.isAvailable"
                :bedData="bed"
                @click="() => {}"
              />
              <MonitoringBedCard v-else :bedData="bed" />
            </div>
          </div>
          <div
            v-else
            class="flex flex-col text-center border-dashed border-[1px] border-grey-300 h-full rounded-b-lg"
          >
            <div class="m-auto text-SM">
              <img
                src="../../assets/icons/no-data-icon-2.svg"
                alt="no data"
                class="mx-auto"
              />
              <div class="text-grey-200">Ruangan ini belum memiliki bed</div>
            </div>
          </div>
        </div>
          <div
            v-else
            class="flex flex-col text-center border-dashed border-[1px] border-grey-300 h-full rounded-lg"
          >
            <div class="m-auto text-SM">
              <img
                src="../../assets/icons/no-data-icon-2.svg"
                alt="no data"
                class="mx-auto"
              />
              <div class="text-grey-200">Silahkan Pilih Ruangan</div>
              <div class="text-grey-200">Terlebih Dahulu</div>
            </div>
          </div>
        </div>
      </template>
    </Card>
    <CustomDialog v-model:visible="roomSettingDialog" width="970px">
  <template #header> Setting Kamar </template>
  <template #body>
    <div class="mt-5"> 
      <DataTable
        :value="fields" 
        class="overflow-hidden rounded-[10px]"
        stripedRows
        scrollable
        scrollHeight="flex"
        :pt="{ headerRow: 'text-SM' }"
      >
        <Column
          field="no"
          headerClass="bg-opensimrs-300 text-white"
          bodyClass="text-SM"
          style="width: 60px"
        >
          <template #header>
            <div class="w-full font-semibold text-center text-nowrap">No.</div>
          </template>
          <template #body="{ index }">
            <div class="text-center">{{ index + 1 }}</div>
          </template>
        </Column>
        <Column
          field="bedType"
          headerClass="bg-opensimrs-300 text-white"
          bodyClass="text-SM align-top"
        >
          <template #header>
            <div class="w-full font-semibold text-center text-nowrap">Jenis Bed</div>
          </template>
          <template #body="{ data, index }">
            <CustomSelect
              v-model="data.value.bedType"
              :showLabel="false"
              placeHolder="Pilih Jenis Bed"
              class=""
              optionLabel=""
              optionValue=""
              :showFilter="false"
              :options="['Bed', 'Bed Cadangan', 'Box Bayi']"
              :invalid="!!(errors as any)[`bedData[${index}].bedType`]"
              :invalidMessage="(errors as any)[`bedData[${index}].bedType`]"
            />
          </template>
        </Column>
        <Column
          field="bedName"
          headerClass="bg-opensimrs-300 text-white"
          bodyClass="text-SM align-top"
        >
          <template #header>
            <div class="w-full font-semibold text-center text-nowrap">Nama Bed</div>
          </template>
          <template #body="{ data, index }">
            <div>
              <CustomSelect
                v-model="data.value.lokasi_uuid"
                :showLabel="false"
                placeHolder="Pilih Nama Bed"
                :options="bedDropdownOptions"
                optionLabel="label"
                optionValue="value"
                :showFilter="false"
                :invalid="!!(errors as any)[`bedData[${index}].lokasi_uuid`]"
                :invalidMessage="(errors as any)[`bedData[${index}].lokasi_uuid`]"
                @update:modelValue="(val) =>{ const selected = bedDropdownOptions.find(opt => opt.value === val); data.value.bedName = selected?.label ?? ''; }"
              />
            </div>
          </template> 
        </Column>
        <Column
          field="noBed"
          headerClass="bg-opensimrs-300 text-white"
          bodyClass="text-SM align-top"
          style="width: 100px"
        >
          <template #header>
            <div class="w-full font-semibold text-center text-nowrap">No. Bed</div>
          </template>
          <template #body="{ data, index }">
            <CustomTextfield
              v-model="data.value.noBed"
              :showLabel="false"
              class="w-full mr-[30px]"
              placeholder="0"
              :invalid="!!(errors as any)[`bedData[${index}].noBed`]"
              :invalidMessage="(errors as any)[`bedData[${index}].noBed`]"
            />
          </template>
        </Column>
        <Column
          field="status"
          headerClass="bg-opensimrs-300 text-white"
          bodyClass="text-SM align-top"
        >
          <template #header>
            <div class="w-full font-semibold text-center text-nowrap">Status Operasional</div>
          </template>
          <template #body="{ data }">
            <!-- <pre>{{ JSON.stringify(data, null, 2) }}</pre> -->
            <div class="flex">
              <CustomChip
                :showCheckedIcon="false"
                :label="data.value.statusOperasionalRuangan?.toUpperCase()"
                :bgColor="
                  data.value.statusOperasionalRuangan === 'Penuh'
                    ? 'bg-danger-300'
                    : 'bg-success-300'
                "
                textColor="text-white"
                customClass="h-5 pr-[9px] border-none"
                class="mx-auto"
              />
            </div>
          </template>
        </Column> 
        <Column
          field="action"
          headerClass="bg-opensimrs-300 text-white"
          bodyClass="text-SM  align-top"
          style="width: 100px"
        >
          <template #header>
            <div class="w-full font-semibold text-center text-nowrap">Action</div>
          </template>
          <template #body="{ index }">
            <div class="flex">
              <CustomButton
                @click="remove(index)"
                icon="PhTrash"
                label=""
                class="h-[30px] mx-auto mt-1"
                backgroundColor="bg-danger-300"
              />
            </div>
          </template>
          </Column>
            </DataTable>
            <div
              class="border-2 h-20 border-opensimrs-75 m-5 rounded-[10px] border-dashed flex"
            >
              <CustomButton
                @click="push({ noBed: 1, bedType: '', lokasi_uuid: '', statusOperasionalRuangan: 'Tersedia', uuid: null })"
                icon="PhPlus"
                label="Bed"
                outlined
                class="m-auto"
                borderColor="border-opensimrs-300"
                textColor="text-opensimrs-300"
              />
            </div>
            <hr class="border-grey-200 mb-[30px]" />
            <div class="font-semibold text-normal">
              Total Bed : {{ fields.length }}
            </div>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end">
            <CustomButton
              @click="onReset"
              label="Reset"
              outlined
              class="mr-[10px]"
              borderColor="border-grey-200"
              textColor="text-grey-300"
            />
            <CustomButton
              @click="onSubmit"
              label="Simpan"
              class=""
              backgroundColor="bg-opensimrs-300"
            />
          </div>
        </template>
      </CustomDialog>
  </div>
</template>
