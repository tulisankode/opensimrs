<script lang="ts" setup>
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import type { MenuItem } from "primevue/menuitem";
import { onMounted, ref, type PropType } from "vue";
import { useForm, useFieldArray, ErrorMessage } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";

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

onMounted(() => {
  console.log(props.pageType);
});

const dataTindakan = ref<any[]>([]);

const tambahTindakan = toTypedSchema(
  yup.object({
    listTindakan: yup.string(),
    jumlah: yup.number(),
    harga: yup.number(),
  })
);

const { handleSubmit, resetForm, defineField } = useForm({
  validationSchema: tambahTindakan,
  initialValues: {
    listTindakan: "",
    jumlah: 0,
    harga: 0,
  },
});

const listTindakan = ref([
  { id: "1", value: "Fisio 1" },
  { id: "2", value: "Fidio 2" },
  { id: "3", value: "Fisio 3" },
]);

onMounted(() => {
  dataTindakan.value = [];
});

const deleteDataTindakan = (index: number) => {
  dataTindakan.value.splice(index, 1);
};

const myPushFunction = () => {
  dataTindakan.value.push({
    listTindakan: "",
    jumlah: 0,
    harga: 0,
  });
};

const dateFilter = ref<Date>(new Date());
</script>

<template>
  <CustomAccordion :openWithHeader="false" class="mt-[10px]" initialState="0">
    <template #header>
      <div class="flex justify-between w-full align-middle">
        <div class="flex">
          <span class="leading-10 text-opensimrs-300 text-heading">
            Order Fisio
          </span>
        </div>
      </div>
    </template>
    <template #content>
      <div class="pt-5 grid grid-cols-[20%_40%_40%]">
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
        <div>
          <CustomSelect
            label="Diagnosis Fisioterapi"
            place-holder="Pilih Diagnosis Fisioterapi"
            class="mr-[20px]"
            optionLabel=""
            optionValue=""
            :options="['Diagnosis 1', 'Diagnosis 2', 'Diagnosis 3']"
          />
        </div>
      </div>

      <div class="mt-[20px]">
        <div class="relative overflow-y-auto" style="max-height: 220px">
          <DataTable
            :pt="{ headerRow: 'text-SM', thead: 'z-0' }"
            :value="dataTindakan"
            scrollable
            scrollHeight="160px"
            tableStyle="min-width: 50rem"
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
                    <img src="@/assets/icons/delete.svg" alt="" width="14px" />
                  </CustomButton>
                </div>
              </template>
            </Column>
          </DataTable>
        </div>
      </div>
      <div
        class="flex items-center justify-center m-5 p-5 border border-dashed rounded-lg border-opensimrs-300 gap-2.5"
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
