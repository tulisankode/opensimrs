<script setup lang="ts">
import { ref, computed, onBeforeMount } from "vue";
import { useForm, useFieldArray, ErrorMessage } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomButton from "../Base/CustomButton.vue";
import CustomSelect from "../Base/CustomSelect.vue";
import CustomInputNumber from "../Base/CustomInputNumber.vue";
const schema = toTypedSchema(
  yup.object({
    listKomponenTarif: yup.array().of(
      yup.object({
        tarifKomponenUuid: yup
          .string()
          .required("Jenis pembayaran harus diisi"),
        tarifPerKomponen: yup.number().required("Harga bed harus diisi"),
      })
    ),
  })
);
const { errors, handleSubmit, resetForm, setValues } = useForm({
  validationSchema: schema,

  initialValues: {
    listKomponenTarif: [{ tarifKomponenUuid: "", tarifPerKomponen: 0 }],
  },
});

const { remove, push, fields } = useFieldArray("listKomponenTarif");

const handlePushTarif = () => {
  push({ tarifKomponenUuid: "", tarifPerKomponen: 0 });
};
const emit = defineEmits(["update:listKomponenTarif"]);

const onSubmit = handleSubmit((values) => {
  console.log("Submitted with", values);
  emit("update:listKomponenTarif", values);
});

const tindakanPayload = ref([
  { name: "Pemeriksaan Gigi", uuid: "9876543" },
  { name: "Pemeriksaan Dokter Spesialis", uuid: "12345678" },
]);

defineExpose({
  onSubmit,
});
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <DataTable
      :value="fields"
      tableStyle="min-width: 50rem"
      class="overflow-hidden text-xs rounded-lg bg-opensimrs-50"
    >
      <Column headerClass="bg-opensimrs-300 text-white" class="w-8/12">
        <template #header>
          <div>Komponen Tarif</div>
        </template>
        <template #body="slotProps">
          <CustomSelect
            v-model="slotProps.data.value.tarifKomponenUuid"
            label=""
            place-holder="Pilih Tindakan"
            :options="tindakanPayload"
            option-label="name"
            optionValue="uuid"
          />
        </template>
      </Column>
      <Column headerClass="bg-opensimrs-300 text-white">
        <template #header>
          <div class="w-full font-semibold text-end">Rupiah (Rp)</div>
        </template>
        <template #body="slotProps">
          <CustomInputNumber
            v-model="slotProps.data.value.tarifPerKomponen"
            label=""
            align-number="text-end"
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
      <Column header="Action" headerClass="bg-opensimrs-300 text-white">
        <template #body="slotProps">
          <CustomButton
            label=""
            background-color="bg-danger-300 rounded-lg"
            class="h-6 w-[26px] p-0"
            @click="remove(slotProps.index)"
          >
            <img src="@/assets/icons/delete.svg" alt="" />
          </CustomButton>
        </template>
      </Column>
    </DataTable>
    <div class="flex flex-col gap-5 p-5">
      <div
        class="flex items-center justify-center p-5 border border-dashed rounded-lg border-opensimrs-300"
      >
        <CustomButton
          icon="PhPlus"
          label="Tindakan"
          borderColor="border-opensimrs-300"
          textColor="text-opensimrs-300"
          backgroundColor="bg-white"
          @click="handlePushTarif"
        />
      </div>
    </div>
    <!-- <CustomButton label="Submit" @click="onSubmit" /> -->
  </div>
</template>
