<script setup lang="ts">
import { ref, computed, onBeforeMount } from "vue";
import { useForm, useFieldArray, ErrorMessage } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomTextfield from "../Base/CustomTextfield.vue";
import CustomSelect from "../Base/CustomSelect.vue";
import CustomButton from "../Base/CustomButton.vue";
import CustomInputNumber from "../Base/CustomInputNumber.vue";

const schema = toTypedSchema(
  yup.object({
    datas: yup.array().of(
      yup.object({
        jenisPembayaran: yup.string().required("Jenis pembayaran harus diisi"),
        harga: yup
          .string()
          .required("Harga bed harus diisi")
          .matches(/^\d+$/, "Harga harus berupa angka"),
      })
    ),
  })
);

const { errors, handleSubmit, resetForm, setValues } = useForm({
  validationSchema: schema,

  initialValues: {
    datas: [{ jenisPembayaran: "", harga: "" }],
  },
});

const { remove, push, fields } = useFieldArray("datas");

const myPushFunction = () => {
  push({ jenisPembayaran: "", harga: "" });
};

const onSubmit = handleSubmit((values) => {
  console.log("Submitted with", values);
});

onBeforeMount(async () => {
  setValues({
    datas: [{ jenisPembayaran: "tunai", harga: "30000" }],
  });
});

const jenisBayarOptions = ref([
  { label: "Tunai", value: "tunai" },
  { label: "BPJS", value: "bpjs" },
]);
</script>

<template>
  <div>
    <DataTable
      :value="fields"
      tableStyle="min-width: 50rem"
      class="overflow-hidden text-xs rounded-lg bg-opensimrs-50"
    >
      <Column headerClass="bg-opensimrs-300 text-white" class="w-1/2">
        <template #header>
          <div>Jenis Pembayaran Bed</div>
        </template>
        <template #body="slotProps">
          <CustomSelect
            v-model="slotProps.data.value.jenisPembayaran"
            :options="jenisBayarOptions"
            optionValue="value"
            optionLabel="label"
            label=""
            place-holder="Jenis Pembayaran Lain"
            :invalid="!slotProps.data.value.jenisPembayaran"
          />
          <ErrorMessage
            :name="`datas[${slotProps.index}].jenisPembayaran`"
            class="text-danger-300"
          />
        </template>
      </Column>
      <Column headerClass="bg-opensimrs-300 text-white">
        <template #header>
          <div class="w-full font-semibold text-end">Harga Bed</div>
        </template>
        <template #body="slotProps">
          <CustomInputNumber
            v-model="slotProps.data.value.harga"
            label=""
            align-number="text-end"
            :invalid="!slotProps.data.value.harga"
          >
            <template #prependText>
              <div
                class="flex items-center justify-center px-3 overflow-hidden font-semibold leading-7 text-white border-r text-MD text-opensimrs-300 bg-opensimrs-300 rounded-l-md"
              >
                Rp.
              </div>
            </template>
          </CustomInputNumber>
          <ErrorMessage
            :name="`datas[${slotProps.index}].harga`"
            class="text-danger-300"
          />
        </template>
      </Column>
      <Column headerClass="bg-opensimrs-300 text-white">
        <template #header>
          <div class="w-full font-semibold text-center">Action</div>
        </template>
        <template #body="slotProps">
          <div class="flex items-center justify-center">
            <CustomButton
              label=""
              background-color="bg-danger-300 rounded-lg"
              @click="remove(slotProps.index)"
            >
              <img src="@/assets/icons/delete.svg" alt="" width="15px" />
            </CustomButton>
          </div>
        </template>
      </Column>
    </DataTable>
    <div
      class="flex items-center justify-center p-5 m-5 border border-dashed rounded-lg border-opensimrs-300"
    >
      <CustomButton
        icon="PhPlus"
        label="Jenis Pembayaran"
        borderColor="border-opensimrs-300"
        textColor="text-opensimrs-300"
        backgroundColor="bg-white"
        @click="myPushFunction"
      />
    </div>
    <!-- <CustomButton label="Simpan" @click="onSubmit" /> -->
  </div>
</template>
