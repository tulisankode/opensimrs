<script setup lang="ts">
import { ref } from "vue";
import CustomTextfield from "../Base/CustomTextfield.vue";
import CustomAutoComplete from "../Base/CustomAutoComplete.vue";
import CustomSwitch from "../Base/CustomSwitch.vue";
import CustomButton from "../Base/CustomButton.vue";
import CustomSelect from "../Base/CustomSelect.vue";
import CustomInputNumber from "../Base/CustomInputNumber.vue";
const data = ref([{ komponenTarif: "", rupiah: "", action: "" }]);
const addRow = () => {
  data.value.push({
    komponenTarif: "",
    rupiah: "",
    action: "",
  });
};
</script>

<template>
  <Card
    pt:root:class="border rounded-lg shadow border-opensimrs-300 shadow-inherit"
    pt:body:class="h-full p-5"
  >
    <template #content>
      <div class="flex flex-col gap-5">
        <div class="flex items-end">
          <CustomButton label="1" class="w-10 h-10" />
          <CustomSelect label=""  class="grow ml-2.5 mr-[30px]"/>
          <CustomButton
            background-color="bg-danger-300 rounded-lg"
          >
            <img src="@/assets/icons/delete.svg" alt="" width="15px" />Hapus
          </CustomButton>
        </div>
        <DataTable
          :value="data"
          tableStyle="min-width: 50rem"
          class="overflow-hidden text-xs rounded-lg bg-opensimrs-50"
        >
          <Column headerClass="bg-opensimrs-300 text-white" class="w-4/6">
            <template #header>
              <div>Komponen Tarif</div>
            </template>
            <template #body>
              <CustomSelect label="" place-holder="Pilih Komponen Tarif" />
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-300 ">
            <template #header>
              <div class="w-full text-xs font-semibold text-white text-end">
                Rupiah (Rp)
              </div>
            </template>
            <template #body>
              <CustomInputNumber label="" align-number="text-end">
                <template #prependText>
                  <div
                    class="flex items-center justify-center px-3 overflow-hidden font-semibold leading-7 text-white border-r text-MD text-opensimrs-300 bg-opensimrs-300 rounded-l-md"
                  >
                    Rp.
                  </div>
                </template>
              </CustomInputNumber>
            </template>
          </Column>
          <Column header="Action" headerClass="bg-opensimrs-300 text-white">
            <template #body="slotProps">
              <CustomButton
                label=""
                background-color="bg-danger-300 rounded-lg"
              >
                <img src="@/assets/icons/delete.svg" alt="" width="15px" />
              </CustomButton>
            </template>
          </Column>
        </DataTable>
        <div
          class="flex items-center justify-center p-5 border border-dashed rounded-lg border-opensimrs-300"
        >
          <CustomButton
            icon="PhPlus"
            label="Komponen Tarif"
            borderColor="border-opensimrs-300"
            textColor="text-opensimrs-300"
            backgroundColor="bg-white"
            @click="addRow"
          />
        </div>
      </div>
    </template>
  </Card>
</template>
