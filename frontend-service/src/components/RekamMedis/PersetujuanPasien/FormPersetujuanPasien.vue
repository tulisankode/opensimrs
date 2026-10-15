<script setup lang="ts">
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomRadio from "@/components/Base/CustomRadio.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import { onMounted, ref } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomInfoRow from "@/components/Base/CustomInfoRow.vue";
import { utilsStore } from "@/stores/utils";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { usePraktisiStore } from "@/stores/datamaster/praktisi";
import { dateToEpoch } from "@/utils/Helpers";
import { createSuratPersetujuanTindakan } from "@/utils/pdf/RekamMedis";


// NOTE Store
const storeUtils = utilsStore();
const rekamMedisStore = useRekamMedisStore();
const praktisiStore = usePraktisiStore();

const props = defineProps({
  method: {
    type: String,
    default: "form",
  },
  rmUuid: {
    type: String,
    default: "",
  },
  listPersetujuanPasien: {
    type: Array,
    default: () => [],
  },
  patientData: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["dataDeleted"]);

const currentMethod = ref(props.method);

const dokterPelaksanas = ref<any[]>([]);
const fetchPraktisi = async () => {
  // FIXME Masih menggunakan api biasa dan filter by FE
  const responseDpjp = await praktisiStore.getApi({
    limit: 9999,
    isDoctor: true,
  });
  if (responseDpjp && responseDpjp.payload) {
    dokterPelaksanas.value = responseDpjp.payload.filter(
      (praktisi: any) => praktisi.status
    );
  }
};

const genders = ref([
  { id: 1, value: "Laki-Laki" },
  { id: 2, value: "Perempuan" },
]);

const hubunganKeluargas = ref([
  { id: 1, value: "Kepala Keluarga" },
  { id: 2, value: "Mertua" },
  { id: 3, value: "Menantu" },
  { id: 4, value: "Keponakan" },
  { id: 5, value: "Sepupu" },
  { id: 6, value: "Teman" },
  { id: 7, value: "Kerabat" },
  { id: 8, value: "Asisten Rumah Tangga" },
  { id: 9, value: "Suami" },
  { id: 10, value: "Istri" },
  { id: 11, value: "Ayah" },
  { id: 12, value: "Ibu" },
  { id: 13, value: "Anak" },
  { id: 14, value: "Kakak" },
  { id: 15, value: "Adik" },
  { id: 16, value: "Cucu" },
  { id: 17, value: "Kakek" },
  { id: 18, value: "Nenek" },
  { id: 19, value: "Lainnya" },
  { id: 20, value: "Family Lain" },
]);
const schema = yup.object({
  dokterUuid: yup.string().required("Dokter harus dipilih"),
  pemberiInformasi: yup.string().required("Pemberi informasi harus diisi"),
  penerima: yup.string().required("Penerima harus dipilih"),
  namaKeluarga: yup.string().when("penerima", {
    is: "keluarga",
    then: (schema) => schema.required("Nama keluarga/ wali harus diisi"),
  }),
  hubunganKeluarga: yup.string().when("penerima", {
    is: "keluarga",
    then: (schema) => schema.required("Hubungan dengan keluarga harus dipilih"),
  }),
  noHp: yup.string().when("penerima", {
    is: "keluarga",
    then: (schema) => schema.required("No. Handphone harus diisi"),
  }),
  alamat: yup.string().when("penerima", {
    is: "keluarga",
    then: (schema) => schema.required("Alamat harus diisi"),
  }),
  gender: yup.string().when("penerima", {
    is: "keluarga",
    then: (schema) => schema.required("Jenis kelamin harus dipilih"),
  }),
  diagnosis: yup.string().required("Diagnosis (WD & DD) harus diisi"),
  tindakanKedokteran: yup.string().required("Tindakan kedokteran harus diisi"),
  tatacaraTindakan: yup.string().required("Tatacara tindakan harus diisi"),
  risikoTindakan: yup.string().required("Risiko tindakan harus diisi"),
  prognosis: yup.string().required("Prognosis harus diisi"),
  lainnya: yup.string().required("Lain-lain harus diisi"),
  dasarDiagnosis: yup.string().required("Dasar diagnosis harus diisi"),
  indikasiTindakan: yup.string().required("Indikasi tindakan harus diisi"),
  tujuanTindakan: yup.string().required("Tujuan tindakan harus diisi"),
  komplikasi: yup.string().required("Komplikasi harus diisi"),
  alaternatif: yup.string().required("Alternatif & Risiko harus diisi"),
  persetujuan: yup.string().required("Persetujuan harus dipilih"),
  tglPersetujuan: yup.date().required("Tanggal Persetujuan harus dipilih"),
  saksi1: yup.string().required("Saksi 1 harus diisi"),
  saksi2: yup.string().required("Saksi 2 harus diisi"),
});

const { errors, handleSubmit, resetForm, defineField } = useForm({
  validationSchema: schema,
});

const [dokterUuid] = defineField("dokterUuid");
const [pemberiInformasi] = defineField("pemberiInformasi");
const [penerima] = defineField("penerima");
const [namaKeluarga] = defineField("namaKeluarga");
const [hubunganKeluarga] = defineField("hubunganKeluarga");
const [noHp] = defineField("noHp");
const [alamat] = defineField("alamat");
const [gender] = defineField("gender");
const [diagnosis] = defineField("diagnosis");
const [tindakanKedokteran] = defineField("tindakanKedokteran");
const [tatacaraTindakan] = defineField("tatacaraTindakan");
const [risikoTindakan] = defineField("risikoTindakan");
const [prognosis] = defineField("prognosis");
const [lainnya] = defineField("lainnya");
const [dasarDiagnosis] = defineField("dasarDiagnosis");
const [indikasiTindakan] = defineField("indikasiTindakan");
const [tujuanTindakan] = defineField("tujuanTindakan");
const [komplikasi] = defineField("komplikasi");
const [alaternatif] = defineField("alaternatif");
const [persetujuan] = defineField("persetujuan");
const [tglPersetujuan] = defineField("tglPersetujuan");
const [saksi1] = defineField("saksi1");
const [saksi2] = defineField("saksi2");


const onSubmit = handleSubmit(async (values) => {
  values.tglPersetujuan = dateToEpoch(values.tglPersetujuan);
  try {
    storeUtils.setLoading(true);
    const response = await rekamMedisStore.postInformConsent({
      rekamMedisUuid: props.rmUuid,
      ...values,
    });
    if (response && response.payload) {
      rekamMedisStore.setAsesmentRekamMedisData(response.payload);
      resetForm();
    }
  } catch (error) {
    console.error("Failed to post data", error);
  } finally {
    storeUtils.setLoading(false);
  }
});

const handleCetakSurat = (fileUuid: string) => {
  console.log("Cetak surat:", fileUuid);
};

const handleDeleteSurat = async (uuid: string) => {
  try {
    storeUtils.setLoading(true);
    const response = await rekamMedisStore.deleteInformConsent({ uuid: uuid });
    
    if (response) {
      emit("dataDeleted");
    }
  } catch (error) {
    console.error("Gagal menghapus surat:", error);
  } finally {
    storeUtils.setLoading(false);
  }
};

const onEditClick = () => {
  currentMethod.value = "form";
};

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

const showDocument = async (data: any) => {
  const dataPraktisi = dokterPelaksanas.value.find(
    (dataDokter) => (dataDokter.uuid = data.dokterUuid)
  );
  if (dataPraktisi) {
    data.dokterUuid = dataPraktisi;
  }
  await createSuratPersetujuanTindakan({
    data: { documentData: data, patientData: props.patientData },
    type: data.persetujuan ? "Persetujuan" : "Penolakan",
  });
};

onMounted(() => {
  fetchPraktisi();
});

defineExpose({
  open,
  close,
});
</script>

<template>
  <CustomAccordion
    headerClass="bg-opensimrs-50"
    v-if="currentMethod === 'form'"
    ref="accordion"
  >
    <template #header>Persetujuan Pasien</template>
    <template #content>
      <div class="flex flex-col gap-5 p-5">
        <div class="grid grid-cols-2 gap-[30px]">
          <div>
            <CustomSelect
              label="Dokter Pelaksana Tindakan"
              v-model:model-value="dokterUuid"
              placeHolder="Pilih Dokter Pelaksana Tindakan"
              :options="dokterPelaksanas"
              optionLabel="pegawai.name"
              optionValue="uuid"
              :isLoading="false"
              customSelectClass="border-[#C7CBD2]"
              :invalid="!!errors.dokterUuid"
              :invalidMessage="errors.dokterUuid"
            >
            </CustomSelect>
          </div>
          <div>
            <CustomTextfield
              label="Pemberi Informasi"
              v-model:model-value="pemberiInformasi"
              placeholder="Pemberi Informasi"
              :invalid="!!errors.pemberiInformasi"
              :invalidMessage="errors.pemberiInformasi"
            />
          </div>
        </div>
        <!-- <hr class="my-6 border-gray-200 border-1" /> -->
        <div class="flex gap-[30px] items-center">
          <div class="min-w-[300px]">
            <label class="font-semibold text-normal">Penerima Informasi</label>
            <div class="flex gap-5">
              <CustomRadio
                v-model="penerima"
                value="pasien"
                sideLabel="Pasien"
                :invalid="!!errors.penerima"
                :invalidMessage="errors.penerima"
              />
              <CustomRadio
                v-model="penerima"
                value="keluarga"
                sideLabel="Keluarga / Wali"
                label=""
                :invalid="!!errors.penerima"
                :invalidMessage="errors.penerima"
              />
            </div>
          </div>
          <div class="grow">
            <CustomTextfield
              label="Nama keluarga / Wali"
              placeholder="Nama Keluarga / Wali"
              v-model:model-value="namaKeluarga"
              :invalid="!!errors.namaKeluarga"
              :invalidMessage="errors.namaKeluarga"
              :disabled="penerima === 'pasien'"
            />
          </div>
          
          <div class="w-[200px]">
            <CustomSelect
              label="Jenis Kelamin"
              placeHolder="Pilih Jenis Kelamin"
              v-model:model-value="gender"
              :options="genders"
              optionValue="value"
              optionLabel="value"
              :isLoading="false"
              :invalid="!!errors.gender"
              :invalidMessage="errors.gender"
              :disabled="penerima === 'pasien'"
            />
          </div>
          
          <div class="grow">
            <CustomSelect
              label="Hubungan dengan Keluarga"
              v-model:model-value="hubunganKeluarga"
              placeHolder="Pilih Hubungan dengan Keluarga"
              :options="hubunganKeluargas"
              optionValue="value"
              optionLabel="value"
              :isLoading="false"
              :invalid="!!errors.hubunganKeluarga"
              :invalidMessage="errors.hubunganKeluarga"
              :disabled="penerima === 'pasien'"
            />
          </div>
        </div>

        <div class="flex gap-[30px]">
          <div class="w-[300px]">
            <CustomTextfield
              label="No. Handphone"
              class="w-full"
              placeholder="08xx-xxxx-xxxx"
              v-model="noHp"
              type="number"
              :invalid="!!errors.noHp"
              :invalidMessage="errors.noHp"
              :disabled="penerima === 'pasien'"
            />
          </div>
          <div class="grow">
            <CustomTextfield
              label="Alamat"
              placeholder="Alamat"
              v-model:model-value="alamat"
              :isLoading="false"
              :invalid="!!errors.alamat"
              :invalidMessage="errors.alamat"
              :disabled="penerima === 'pasien'"
            />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-[30px]">
          <div>
            <CustomTextArea
              label="Diagnosis (WD & DD)"
              placeholder="Diagnosis (WD & DD)"
              v-model:model-value="diagnosis"
              :invalid="!!errors.diagnosis"
              :invalidMessage="errors.diagnosis"
            />
          </div>
          <div>
            <CustomTextArea
              label="Dasar Diagnosis"
              placeholder="Dasar Diagnosis"
              v-model:model-value="dasarDiagnosis"
              :invalid="!!errors.dasarDiagnosis"
              :invalidMessage="errors.dasarDiagnosis"
            />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-[30px]">
          <div>
            <CustomTextArea
              label="Tindakan Kedokteran"
              placeholder="Tindakan Kedokteran"
              v-model:model-value="tindakanKedokteran"
              :invalid="!!errors.tindakanKedokteran"
              :invalidMessage="errors.tindakanKedokteran"
            />
          </div>
          <div>
            <CustomTextArea
              label="Indikasi Tindakan"
              placeholder="Indikasi Tindakan"
              v-model:model-value="indikasiTindakan"
              :invalid="!!errors.indikasiTindakan"
              :invalidMessage="errors.indikasiTindakan"
            />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-[30px]">
          <div>
            <CustomTextArea
              label="Tatacara Tindakan"
              placeholder="Tatacara Tindakan"
              v-model:model-value="tatacaraTindakan"
              :invalid="!!errors.tatacaraTindakan"
              :invalidMessage="errors.tatacaraTindakan"
            />
          </div>
          <div>
            <CustomTextArea
              label="Tujuan Tindakan"
              placeholder="Tujuan Tindakan"
              v-model:model-value="tujuanTindakan"
              :invalid="!!errors.tujuanTindakan"
              :invalidMessage="errors.tujuanTindakan"
            />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-[30px]">
          <div>
            <CustomTextArea
              label="Risiko Tindakan"
              placeholder="Risiko Tindakan"
              v-model:model-value="risikoTindakan"
              :invalid="!!errors.risikoTindakan"
              :invalidMessage="errors.risikoTindakan"
            />
          </div>
          <div>
            <CustomTextArea
              label="Komplikasi"
              placeholder="Komplikasi"
              v-model:model-value="komplikasi"
              :invalid="!!errors.komplikasi"
              :invalidMessage="errors.komplikasi"
            />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-[30px]">
          <div>
            <CustomTextArea
              label="Prognosis"
              placeholder="Prognosis"
              v-model:model-value="prognosis"
              :invalid="!!errors.prognosis"
              :invalidMessage="errors.prognosis"
            />
          </div>
          <div>
            <CustomTextArea
              label="Alternatif & Risiko"
              placeholder="Alternatif & Risiko"
              v-model:model-value="alaternatif"
              :invalid="!!errors.alaternatif"
              :invalidMessage="errors.alaternatif"
            />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-[30px]">
          <div>
            <CustomTextArea
              label="Lain-lain"
              placeholder="Lain-lain"
              v-model:model-value="lainnya"
              :invalid="!!errors.lainnya"
              :invalidMessage="errors.lainnya"
            />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-[30px] items-center">
          <div class="grid grid-cols-2 gap-[30px]">
            <div>
              <label class="font-semibold text-normal mb-[5px] inline-block">
                Persetujuan Tindakan Kedokteran
              </label>
              <div class="grid grid-cols-2 gap-5">
                <CustomRadio
                  v-model="persetujuan"
                  :value="true"
                  sideLabel="Setuju"
                  label=""
                  :invalid="!!errors.persetujuan"
                  :invalidMessage="errors.persetujuan"
                />
                <CustomRadio
                  v-model="persetujuan"
                  :value="false"
                  sideLabel="Tidak Setuju"
                  label=""
                  :invalid="!!errors.persetujuan"
                  :invalidMessage="errors.persetujuan"
                />
              </div>
            </div>
            <CustomDatePicker
              label="Tanggal Persetujuan"
              v-model="tglPersetujuan"
              place-holder="Masukkan Tangggal"
              :invalid="!!errors.tglPersetujuan"
              :invalidMessage="errors.tglPersetujuan"
              :max-date="new Date()"
            />
          </div>
          <div class="grid grid-cols-2 gap-[30px]">
            <CustomTextfield
              label="Nama Saksi 1"
              placeholder="Nama Saksi 1"
              v-model:model-value="saksi1"
              :invalid="!!errors.saksi1"
              :invalidMessage="errors.saksi1"
            />
            <CustomTextfield
              label="Nama Saksi 2"
              placeholder="Nama Saksi 2"
              v-model:model-value="saksi2"
              :invalid="!!errors.saksi2"
              :invalidMessage="errors.saksi2"
            />
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex items-end justify-end gap-3">
        <CustomButton
          v-if="currentMethod == 'form'"
          label="Reset"
          textColor="text-[#9DA4B1]"
          backgroundColor="bg-transparent"
          borderColor="border-2 border-[#9DA4B1]"
          @click="resetForm"
        />
        <CustomButton
          v-if="currentMethod == 'form'"
          label="Simpan"
          @click="onSubmit"
        />
      </div>
    </template>
  </CustomAccordion>

  <CustomAccordion v-else headerClass="bg-opensimrs-50">
    <template #header>Inform Consent</template>
    <template #content>
      <div class="pt-5">
        <DataTable :value="listPersetujuanPasien" class="text-xs">
          <Column
            headerClass="bg-opensimrs-50 font-semibold text-SM"
            class="w-2 text-center"
          >
            <template #header>
              <div class="text-center">No.</div>
            </template>
            <template #body="slotProps">
              <div class="flex items-center justify-center">
                {{ slotProps.index + 1 }}
              </div>
            </template>
          </Column>

          <Column headerClass="bg-opensimrs-50" class="max-w-[300px] text-left">
            <template #header>
              <div class="w-full font-semibold text-left">Nama Surat</div>
            </template>
            <template #body="{ data }">
              <div>
                Surat {{ data.persetujuan ? "Persetujuan" : "Penolakan" }}
              </div>
            </template>
          </Column>
          <Column headerClass="bg-opensimrs-50" class="w-auto text-center">
            <template #header>
              <div class="w-full font-semibold">Action</div>
            </template>
            <template #body="slotProps">
              <div class="flex items-center justify-center gap-2">
                <CustomButton
                  @click="showDocument(slotProps.data)"
                  backgroundColor="bg-opensimrs-300 rounded-lg"
                  class="h-6"
                >
                  <div class="flex items-center gap-1">
                    <PhPrinter :size="18" color="#ffffff" weight="fill" />
                    <div class="text-SM">Cetak</div>
                  </div>
                </CustomButton>
                <CustomButton
                  label=""
                  backgroundColor="bg-danger-300 rounded-lg"
                  class="h-6 w-[26px] p-0"
                  @click="handleDeleteSurat(slotProps.data.uuid)"
                >
                  <img src="@/assets/icons/delete.svg" alt="Hapus" />
                </CustomButton>
              </div>
            </template>
          </Column>
        </DataTable>
      </div>
    </template>
  </CustomAccordion>
</template>
