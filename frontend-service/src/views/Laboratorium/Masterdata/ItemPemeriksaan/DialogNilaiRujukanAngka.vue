<script setup lang="ts">
import { ref, defineEmits, defineProps, computed, watch } from "vue";
import { utilsStore } from "@/stores/utils";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import { useItemPemeriksaanStore } from "@/stores/datamasterLaboratorium/itemPemeriksaanLab";
import DialogDelete from "@/views/Laboratorium/Layout/DialogDelete.vue";

const props = defineProps<{
  isDialogVisible: boolean;
  method: {
    type: String;
  };
  payload: {
    uuid: string;
    [key: string]: any;
  };
}>();
const emit = defineEmits(["update:isDialogVisible", "close", "data-updated"]);

const updateVisibility = (value: any) => {
  emit("update:isDialogVisible", value);
};
const itemPemeriksaanStore = useItemPemeriksaanStore();
const itemPemeriksaanPayload = ref(<any>[]);
const UseUtilsStore = utilsStore();

// Fetch Data
const fetchNilaiRujukan = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const uuid = props.payload?.uuid;
    if (!uuid) throw new Error("UUID tidak tersedia di payload");
    const response = await itemPemeriksaanStore.getNilaiRujukanApi(uuid);
    itemPemeriksaanPayload.value = response.payload || [];
    resetForm();
  } catch (error) {
    console.error("Gagal fetch nilai rujukan:", error);
    itemPemeriksaanPayload.value = [];
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const tambahNilaiRujukan = ref(false);
const status = ref(true);
const uuid = ref("");
const umurBawahTahun = ref(0);
const umurBawahBulan = ref(0);
const umurBawahHari = ref(0);
const umurAtasTahun = ref(0);
const umurAtasBulan = ref(0);
const umurAtasHari = ref(0);
const jenisKelamin = ref("");
const batasBawahNilaiNormal = ref();
const batasAtasNilaiNormal = ref();
const kritisBawah = ref();
const kritisAtas = ref();
const optionJenisKelamin = ref([
  { label: "Laki-laki", value: "Male" },
  { label: "Perempuan", value: "Female" },
  { label: "General", value: "General" },
]);

const operator = ref("-");
const optionOperator = ref([
  { label: "(-) Sampai", value: "-" },
  { label: "(<) Kurang Dari", value: "<" },
  { label: "(≤) Kurang Dari / Sama Dengan", value: "<=" },
  { label: "(>) Lebih Dari", value: ">" },
  { label: "(≥) Lebih Dari / Sama Dengan", value: ">=" },
]);
const showBatasAtas = computed(
  () =>
    operator.value === "<" || operator.value === "<=" || operator.value === "-"
);
const showBatasBawah = computed(
  () =>
    operator.value === ">" || operator.value === ">=" || operator.value === "-"
);

const operatorKritisBawah = ref("<");
const optionOperatorKritisBawah = ref([
  { label: "(<) Kurang Dari", value: "<" },
  { label: "(≤) Kurang Dari / Sama Dengan", value: "<=" },
]);

const operatorKritisAtas = ref(">");
const optionOperatorKritisAtas = ref([
  { label: "(>) Lebih Dari", value: ">" },
  { label: "(≥) Lebih Dari / Sama Dengan", value: ">=" },
]);

const tampilan = computed(() => {
  if (operator.value === "-") {
    return `${batasBawahNilaiNormal.value} - ${batasAtasNilaiNormal.value}`;
  } else if (operator.value === "<") {
    return `< ${batasAtasNilaiNormal.value}`;
  } else if (operator.value === "<=") {
    return `≤ ${batasAtasNilaiNormal.value}`;
  } else if (operator.value === ">") {
    return `> ${batasBawahNilaiNormal.value}`;
  } else if (operator.value === ">=") {
    return `≥ ${batasBawahNilaiNormal.value}`;
  }
  return "";
});

// add Data
const simpanNilaiRujukan = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const payload = {
      itemPemeriksaanUuid: props.payload.uuid,
      jenisKelamin: jenisKelamin.value,
      umurBawahTahun: umurBawahTahun.value,
      umurBawahBulan: umurBawahBulan.value,
      umurBawahHari: umurBawahHari.value,
      umurAtasTahun: umurAtasTahun.value,
      umurAtasBulan: umurAtasBulan.value,
      umurAtasHari: umurAtasHari.value,
      batasBawahNilaiNormal: batasBawahNilaiNormal.value,
      batasAtasNilaiNormal: batasAtasNilaiNormal.value,
      kritisBawah: kritisBawah.value,
      kritisAtas: kritisAtas.value,
      operatorKritisBawah: operatorKritisBawah.value,
      operatorKritisAtas: operatorKritisAtas.value,
      operatorNilaiNormal: operator.value,
      status: status.value,
      tampilan: tampilan.value,
      uuid: uuid.value,
    };

    const response = await itemPemeriksaanStore.postNilaiRujukanApi(payload);
    if (response) {
      emit("data-updated");
      tambahNilaiRujukan.value = false;
      fetchNilaiRujukan();
      resetForm();
    }
  } catch (error) {
    console.error("Gagal simpan nilai rujukan:", error);
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

// Edit Data
const editNilaiRujukan = ref(false);
const selectedNilaiRujukan = ref<any>(null);
const openEditDialog = (data: any) => {
  editNilaiRujukan.value = true;
  selectedNilaiRujukan.value = data;
  jenisKelamin.value = data.jenisKelamin;
  umurBawahTahun.value = data.umurBawahTahun;
  umurBawahBulan.value = data.umurBawahBulan;
  umurBawahHari.value = data.umurBawahHari;
  umurAtasTahun.value = data.umurAtasTahun;
  umurAtasBulan.value = data.umurAtasBulan;
  umurAtasHari.value = data.umurAtasHari;
  batasBawahNilaiNormal.value = data.batasBawahNilaiNormal;
  batasAtasNilaiNormal.value = data.batasAtasNilaiNormal;
  kritisBawah.value = data.kritisBawah;
  kritisAtas.value = data.kritisAtas;
  operatorKritisBawah.value = data.operatorKritisBawah?.trim() || "";
  operatorKritisAtas.value = data.operatorKritisAtas?.trim() || "";
  operator.value = data.operatorNilaiNormal?.trim() || "";
  status.value = data.status;
  console.log("data", data);
};
const updateDataNilaiRujukan = async () => {
  UseUtilsStore.setLoading(true);
  try {
    const payload = {
      itemPemeriksaanUuid: props.payload.uuid,
      jenisKelamin: jenisKelamin.value,
      umurBawahTahun: umurBawahTahun.value,
      umurBawahBulan: umurBawahBulan.value,
      umurBawahHari: umurBawahHari.value,
      umurAtasTahun: umurAtasTahun.value,
      umurAtasBulan: umurAtasBulan.value,
      umurAtasHari: umurAtasHari.value,
      batasBawahNilaiNormal: batasBawahNilaiNormal.value,
      batasAtasNilaiNormal: batasAtasNilaiNormal.value,
      kritisBawah: kritisBawah.value,
      kritisAtas: kritisAtas.value,
      operatorKritisBawah: operatorKritisBawah.value,
      operatorKritisAtas: operatorKritisAtas.value,
      operatorNilaiNormal: operator.value,
      status: status.value,
      tampilan: tampilan.value,
    };

    const response = await itemPemeriksaanStore.putNilaiRujukanApi(
      selectedNilaiRujukan.value.uuid,
      payload
    );
    if (response) {
      emit("data-updated");
      editNilaiRujukan.value = false;
      fetchNilaiRujukan();
      resetForm();
    }
  } catch (error) {
    console.error("Gagal update nilai rujukan:", error);
  } finally {
    UseUtilsStore.setLoading(false);
  }
};

const resetForm = () => {
  jenisKelamin.value = "";
  umurBawahTahun.value = 0;
  umurBawahBulan.value = 0;
  umurBawahHari.value = 0;
  umurAtasTahun.value = 0;
  umurAtasBulan.value = 0;
  umurAtasHari.value = 0;
  batasBawahNilaiNormal.value = null;
  batasAtasNilaiNormal.value = null;
  kritisBawah.value = null;
  kritisAtas.value = null;
  operator.value = "-";
  operatorKritisBawah.value = "<";
  operatorKritisAtas.value = ">";
  status.value = true;
};

// Delete Data
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
    UseUtilsStore.setLoading(true);
    try {
      await itemPemeriksaanStore.deleteNilaiRujukanApi(item.uuid);
      fetchNilaiRujukan();
    } catch (error) {
      console.error("Failed to delete data", error);
    } finally {
      UseUtilsStore.setLoading(false);
      isDeleteDialogVisible.value = false;
    }
  }
};

watch(
  () => props.isDialogVisible,
  (newVal) => {
    if (newVal) {
      fetchNilaiRujukan();
    }
  }
);
</script>

<template>
  <div>
    <CustomDialog
      :visible="isDialogVisible"
      width="1000px"
      @update:visible="updateVisibility"
    >
      <template #header>
        <div class="flex text-heading">Nilai Rujukan</div>
      </template>
      <template #body>
        <DataTable
          :value="itemPemeriksaanPayload"
          tableStyle="min-width: 50rem"
          stripedRows
          class="mt-5 text-xs"
          scrollable
          scrollHeight="flex"
        >
          <Column headerClass="bg-opensimrs-50 font-semibold text-SM">
            <template #header>
              <div class="w-full text-center">Id</div>
            </template>
            <template #body="slotProps">
              <div class="flex items-center justify-center">
                {{ slotProps.index + 1 }}
              </div>
            </template>
          </Column>
          <Column
            field="dataNilaiRujukan"
            header="Data Nilai Rujukan"
            headerClass="bg-opensimrs-50"
            class="w-[45%]"
          >
            <template #body="slotProps">
              <div class="flex">
                <div>
                  <div class="font-bold underline text-SM">Jenis Kelamin</div>
                  <div class="text-SM">{{ slotProps.data.jenisKelamin }}</div>
                  <div class="mt-1 font-bold underline text-SM">Umur Bawah</div>
                  <div class="text-SM">
                    {{ slotProps.data.umurBawahTahun }} thn,
                    {{ slotProps.data.umurBawahBulan }} bln,
                    {{ slotProps.data.umurBawahHari }} hr
                  </div>
                </div>
                <div class="ml-28">
                  <div class="font-bold underline text-SM">Jenis Input</div>
                  <div class="text-SM">Angka</div>
                  <div class="mt-1 font-bold underline text-SM">Umur Atas</div>
                  <div class="text-SM">
                    {{ slotProps.data.umurAtasTahun }} thn,
                    {{ slotProps.data.umurAtasBulan }} bln,
                    {{ slotProps.data.umurAtasHari }} hr
                  </div>
                </div>
              </div>
            </template>
          </Column>
          <Column
            field="rujukan"
            header="Rujukan"
            headerClass="bg-opensimrs-50"
            class=""
          >
            <template #body="slotProps">
              <div class="font-bold underline text-SM">Atas</div>
              <div class="text-SM">
                {{ slotProps.data.batasAtasNilaiNormal }}
              </div>
              <div class="mt-1 font-bold underline text-SM">Bawah</div>
              <div class="text-SM">
                {{ slotProps.data.batasBawahNilaiNormal }}
              </div>
            </template>
          </Column>
          <Column
            field="kritis"
            header="Kritis"
            headerClass="bg-opensimrs-50"
            class=""
          >
            <template #body="slotProps">
              <div class="font-bold underline text-SM">Atas</div>
              <div class="text-SM">{{ slotProps.data.kritisAtas }}</div>
              <div class="mt-1 font-bold underline text-SM">Bawah</div>
              <div class="text-SM">{{ slotProps.data.kritisBawah }}</div>
            </template>
          </Column>
          <Column
            field="tampilan"
            header="Tampilan"
            headerClass="bg-opensimrs-50"
            class=""
          >
            <template #body="slotProps">
              {{ slotProps.data.tampilan }}</template
            >
          </Column>

          <Column
            field="status"
            headerClass="bg-opensimrs-50 font-semibold text-SM"
          >
            <template #header>
              <div class="w-full text-center">Status</div>
            </template>
            <template #body="slotProps">
              <div class="flex justify-center items-center min-w-[120px]">
                <CustomChip
                  :label="
                    slotProps.data.status === true ? 'AKTIF' : 'NON-AKTIF'
                  "
                  :textColor="
                    slotProps.data.status === true
                      ? 'text-white'
                      : 'text-[#80868d]'
                  "
                  :bgColor="
                    slotProps.data.status === true
                      ? 'bg-opensimrs-300'
                      : 'bg-white'
                  "
                  :borderColor="
                    slotProps.data.status === true
                      ? 'border-none'
                      : 'border-[#80868d]'
                  "
                  :icon-color="
                    slotProps.data.status === true ? 'white' : '#80868d'
                  "
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
                  @click="openEditDialog(slotProps.data)"
                >
                  <img src="@/assets/icons/edit.svg" alt="" />
                </CustomButton>
                <CustomButton
                  label=""
                  background-color="bg-danger-300 rounded-lg"
                  class="h-6 w-[26px] p-0"
                  @click="
                    deleteDialog('delete', 'Nilai Rujukan', slotProps.data)
                  "
                >
                  <img src="@/assets/icons/delete.svg" alt="" />
                </CustomButton>
              </div>
            </template>
          </Column>
        </DataTable>
        <div class="flex flex-col gap-5 mt-5">
          <div
            class="flex items-center justify-center p-5 border border-dashed rounded-lg border-opensimrs-300"
          >
            <CustomButton
              icon="PhPlus"
              label="Nilai Rujukan"
              borderColor="border-opensimrs-300"
              textColor="text-opensimrs-300"
              backgroundColor="bg-white"
              @click="tambahNilaiRujukan = true"
            />
          </div>
        </div>
      </template>
    </CustomDialog>
  </div>

  <!-- Add nilai rujukan -->
  <CustomDialog v-model:visible="tambahNilaiRujukan" width="1000px">
    <template #header>
      <div class="flex text-heading">Nilai Rujukan - Angka</div>
    </template>
    <template #body>
      <CustomSelect
        v-model="jenisKelamin"
        label="Jenis Kelamin"
        placeHolder="Pilih Jenis Kelamin"
        class="mt-5 mb-5"
        optionLabel="label"
        optionValue="value"
        :showFilter="false"
        :options="optionJenisKelamin"
      />
      <div class="flex gap-10 mt-5">
        <div>
          <div class="font-bold underline text-normal">Umur Bawah</div>
          <div class="flex gap-3 mt-2">
            <CustomInputNumber
              v-model="umurBawahTahun"
              label="Tahun"
              type="number"
            />
            <CustomInputNumber
              v-model="umurBawahBulan"
              label="Bulan"
              type="number"
            />
            <CustomInputNumber
              v-model="umurBawahHari"
              label="Hari"
              type="number"
            />
          </div>
        </div>
        <div>
          <div class="font-bold underline text-normal">Umur Atas</div>
          <div class="flex gap-3 mt-2">
            <CustomInputNumber
              v-model="umurAtasTahun"
              label="Tahun"
              type="number"
            />
            <CustomInputNumber
              v-model="umurAtasBulan"
              label="Bulan"
              type="number"
            />
            <CustomInputNumber
              v-model="umurAtasHari"
              label="Hari"
              type="number"
            />
          </div>
        </div>
      </div>
      <div>
        <div class="mt-5 font-bold underline text-normal">Nilai Normal</div>
        <div class="flex gap-5 mt-3">
          <CustomInputNumber
            v-if="showBatasBawah"
            v-model="batasBawahNilaiNormal"
            label="Batas Bawah"
            type="number"
            placeholder="Batas Bawah"
            class="w-[33%]"
          />
          <CustomSelect
            v-model="operator"
            :showLabel="false"
            placeHolder="Pilih Operator"
            optionLabel="label"
            optionValue="value"
            :showFilter="false"
            :options="optionOperator"
            class="mt-[26px] w-[30%]"
          />
          <CustomInputNumber
            v-if="showBatasAtas"
            v-model="batasAtasNilaiNormal"
            label="Batas Atas"
            placeholder="Batas Atas"
            type="number"
            class="w-[33%]"
          />
        </div>
      </div>
      <div class="flex gap-8 mt-8">
        <div class="flex gap-2 w-[50%]">
          <CustomInputNumber
            v-model="kritisBawah"
            label="Kritis Bawah"
            placeholder="Kritis Bawah"
            type="number"
            class="w-[50%]"
          />
          <CustomSelect
            v-model="operatorKritisBawah"
            :showLabel="false"
            placeHolder="Pilih Operator"
            optionLabel="label"
            optionValue="value"
            :showFilter="false"
            :options="optionOperatorKritisBawah"
            class="mt-[26px] w-[50%]"
          />
        </div>
        <div class="flex gap-2 w-[50%]">
          <CustomInputNumber
            v-model="kritisAtas"
            label="Kritis Atas"
            placeholder="Kritis Atas"
            type="number"
            class="w-[50%]"
          />
          <CustomSelect
            v-model="operatorKritisAtas"
            :showLabel="false"
            placeHolder="Pilih Operator"
            optionLabel="label"
            optionValue="value"
            :showFilter="false"
            :options="optionOperatorKritisAtas"
            class="mt-[26px] w-[50%]"
          />
        </div>
      </div>
      <CustomTextfield
        label="Tampilan"
        placeholder="Tampilan"
        class="mt-5"
        :disabled="true"
        :modelValue="tampilan"
      />
      <hr class="mt-8 border border-slate-200" />

      <CustomSwitch
        v-model="status"
        class="mt-5"
        :show-label="true"
        label="Status"
        sideLabel="NON-AKTIF"
        sideLabelTrue="AKTIF"
      />
    </template>
    <template #footer>
      <div class="flex justify-end gap-2.5 mt-5">
        <CustomButton
          label="Reset"
          textColor="text-grey-300"
          backgroundColor="bg-transparent"
          borderColor="border-2 border-grey-200"
          @click="resetForm"
        />
        <CustomButton label="Simpan" @click="simpanNilaiRujukan" />
      </div>
    </template>
  </CustomDialog>

  <!-- Edit nilai rujukan -->
  <CustomDialog v-model:visible="editNilaiRujukan" width="1000px">
    <template #header>
      <div class="flex text-heading">Edit Nilai Rujukan - Angka</div>
    </template>
    <template #body>
      <CustomSelect
        v-model="jenisKelamin"
        label="Jenis Kelamin"
        placeHolder="Pilih Jenis Kelamin"
        class="mt-5 mb-5"
        optionLabel="label"
        optionValue="value"
        :showFilter="false"
        :options="optionJenisKelamin"
      />
      <div class="flex gap-10 mt-5">
        <div>
          <div class="font-bold underline text-normal">Umur Bawah</div>
          <div class="flex gap-3 mt-2">
            <CustomInputNumber
              v-model="umurBawahTahun"
              label="Tahun"
              type="number"
            />
            <CustomInputNumber
              v-model="umurBawahBulan"
              label="Bulan"
              type="number"
            />
            <CustomInputNumber
              v-model="umurBawahHari"
              label="Hari"
              type="number"
            />
          </div>
        </div>
        <div>
          <div class="font-bold underline text-normal">Umur Atas</div>
          <div class="flex gap-3 mt-2">
            <CustomInputNumber
              v-model="umurAtasTahun"
              label="Tahun"
              type="number"
            />
            <CustomInputNumber
              v-model="umurAtasBulan"
              label="Bulan"
              type="number"
            />
            <CustomInputNumber
              v-model="umurAtasHari"
              label="Hari"
              type="number"
            />
          </div>
        </div>
      </div>
      <div>
        <div class="mt-5 font-bold underline text-normal">Nilai Normal</div>
        <div class="flex gap-5 mt-3">
          <CustomInputNumber
            v-if="showBatasBawah"
            v-model="batasBawahNilaiNormal"
            label="Batas Bawah"
            type="number"
            placeholder="Batas Bawah"
            class="w-[33%]"
          />
          <CustomSelect
            v-model="operator"
            :showLabel="false"
            placeHolder="Pilih Operator"
            optionLabel="label"
            optionValue="value"
            :showFilter="false"
            :options="optionOperator"
            class="mt-[26px] w-[30%]"
          />
          <CustomInputNumber
            v-if="showBatasAtas"
            v-model="batasAtasNilaiNormal"
            label="Batas Atas"
            type="number"
            class="w-[33%]"
          />
        </div>
      </div>
      <div class="flex gap-8 mt-8">
        <div class="flex gap-2 w-[50%]">
          <CustomInputNumber
            v-model="kritisBawah"
            label="Kritis Bawah"
            type="number"
            class="w-[50%]"
          />
          <CustomSelect
            v-model="operatorKritisBawah"
            :showLabel="false"
            placeHolder="Pilih Operator"
            optionLabel="label"
            optionValue="value"
            :showFilter="false"
            :options="optionOperatorKritisBawah"
            class="mt-[26px] w-[50%]"
          />
        </div>
        <div class="flex gap-2 w-[50%]">
          <CustomInputNumber
            v-model="kritisAtas"
            label="Kritis Atas"
            type="number"
            class="w-[50%]"
          />
          <CustomSelect
            v-model="operatorKritisAtas"
            :showLabel="false"
            placeHolder="Pilih Operator"
            optionLabel="label"
            optionValue="value"
            :showFilter="false"
            :options="optionOperatorKritisAtas"
            class="mt-[26px] w-[50%]"
          />
        </div>
      </div>
      <CustomTextfield
        label="Tampilan"
        placeholder="Tampilan"
        class="mt-5"
        :disabled="true"
        :modelValue="tampilan"
      />
      <hr class="mt-8 border border-slate-200" />

      <CustomSwitch
        v-model="status"
        class="mt-5"
        :show-label="true"
        label="Status"
        sideLabel="NON-AKTIF"
        sideLabelTrue="AKTIF"
      />
    </template>
    <template #footer>
      <div class="flex justify-end gap-2.5 mt-5">
        <CustomButton
          label="Reset"
          textColor="text-grey-300"
          backgroundColor="bg-transparent"
          borderColor="border-2 border-grey-200"
        />
        <CustomButton label="Simpan" @click="updateDataNilaiRujukan" />
      </div>
    </template>
  </CustomDialog>
  <DialogDelete
    v-model:isDialogVisible="isDeleteDialogVisible"
    :title="dialogConfig.title"
    :itemToDelete="dialogConfig.data"
    @delete="confirmDelete"
  />
</template>
