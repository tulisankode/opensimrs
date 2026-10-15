<script lang="ts" setup>
import { ref, onBeforeMount, computed, watch, onBeforeUpdate } from "vue";
import { bagianTampil } from "@/stores/modulFaskes";
import { useForm, useFieldArray, ErrorMessage } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import SuratControlRawatJalan from "./SuratControlRawatJalan.vue";
import SuratPermohonanRawatInap from "./SuratPermohonanRawatInap.vue";
import SuratKeteranganSakit from "./SuratKeteranganSakit.vue";
import SuratKeteranganSehat from "./SuratKeteranganSehat.vue";
import SuratRujukan from "./SuratRujukan.vue";
import SuratKeteranganMeninggal from "./SuratKeteranganMeninggal.vue";
import SuratResepKacamata from "./SuratResepKacamata.vue";
import { useRekamMedisStore } from "@/stores/rekamMedis/rekamMedis";
import { useToast } from "primevue/usetoast";
import { generateSuratSehatPdf, generateSuratSakitPdf, generateSuratKontrolPdf, generateSuratMeninggalPdf, generateSuratRujukanPdf, generateSPRIPdf, generateSuratResepKacamata } from "@/components/RekamMedis/ListSuratKeterangan/PdfGenerator";

const props = defineProps({
  patientData: {
    type: Object,
    required: true,
  },
  rmType: {
    type: String,
    default: "rawat-jalan",
  },
  viewMode: {
    type: String,
    default: "current",
  },
  // Lokasi (poli) kunjungan: surat khusus spesialisasi (mis. resep kacamata) hanya di poli terkait.
  lokasiUuid: {
    type: String,
    default: null,
  },
});

const rekamMedisStore = useRekamMedisStore();
const toast = useToast();

const schema = toTypedSchema(
  yup.object({
    datas: yup.array().of(
      yup.object({
        file_uuid: yup.string(),
        namaSurat: yup.string().required("Nama surat harus diisi"),
        dataSurat: yup.object().default({}),
      })
    ),
  })
);

const { errors, handleSubmit, resetForm, setValues } = useForm({
  validationSchema: schema,
});

const { remove, push, fields, update } = useFieldArray("datas");

// jenis layanan surat mengikuti RM yang dibuka (sebelumnya selalu "rj")
const jenisAdmisi = computed(() =>
  props.rmType === "rawat-inap" ? "ri" : props.rmType === "igd" ? "igd" : props.rmType === "fisioterapi" ? "fisio" : "rj"
);

const onSubmit = handleSubmit(async (values) => {
  // hanya entri yang memiliki data surat (entri kosong membuat galat "reading 'noSurat'")
  const allSuratData = (values.datas ?? []).filter((surat: any) => surat?.dataSurat?.noSurat);

  if (!allSuratData || allSuratData.length === 0) {
    toast.add({
      severity: "warn",
      summary: "Peringatan",
      detail: "Tidak ada surat untuk disimpan.",
      life: 3000,
    });
    return;
  }
  const rekamMedisUuid = rekamMedisStore.openedRekamMedis?.rekam_medisUuid;
  if (!rekamMedisUuid) {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "rekamMedisUuid tidak ditemukan.",
      life: 3000,
    });
    return;
  }
  const apiPayloads = allSuratData.map((surat: any) => {
    const suratInfo = itemsSurat.value.find(item => item.name === surat.namaSurat);
    return {
      rekamMedisUuid: rekamMedisUuid,
      file: JSON.stringify(surat.dataSurat),
      fileType: suratInfo?.type,
      fileFormat: "json",
      admissionType: jenisAdmisi.value,
      nomorSurat: surat.dataSurat.noSurat,
    };
  });

  try {
    const promises = apiPayloads.map(payload => rekamMedisStore.createFiles(payload));
    await Promise.all(promises);

    toast.add({
      severity: "success",
      summary: "Berhasil",
      detail: "Semua surat berhasil disimpan!",
      life: 3000,
    });
    resetData();

  } catch (error) {
    console.error("Gagal menyimpan satu atau lebih surat:", error);
    toast.add({
      severity: "error",
      summary: "Gagal",
      detail: "Terjadi kesalahan saat menyimpan surat. Silakan coba lagi.",
      life: 3000,
    });
  }
});

const getClinicProfile = (): any => {
    const faskesProfileString = localStorage.getItem('faskes_profile');
    return faskesProfileString ? JSON.parse(faskesProfileString) : {};
};

const buatSurat = ref(false);
const tipePeriksa = ref();
const selectedSurat = ref<any[]>([]);
const cariSurat = ref("");
const itemsSurat = computed(() => {
  const allSurat = [
    { name: "Surat Kontrol Rawat Jalan", type: "surat_kontrol_rawat_jalan" },
    { name: "Surat Permohonan Rawat Inap (SPRI)", type: "surat_permohonan_rawat_inap" },
    { name: "Surat Keterangan Sakit", type: "surat_keterangan_sakit" },
    { name: "Surat Keterangan Sehat", type: "surat_keterangan_sehat" },
    { name: "Surat Rujukan", type: "surat_rujuk_keluar_faskes" },
    { name: "Surat Keterangan Meninggal", type: "surat_keterangan_meninggal" },
    { name: "Surat Resep Kacamata", type: "resep_kacamata" },
  ];
  if (props.rmType !== 'rawat-jalan') {
    return allSurat.filter(surat => surat.name !== 'Surat Resep Kacamata');
  }
  return allSurat.filter(surat => bagianTampil("rme_cetak_surat", surat.name, props.lokasiUuid));
});

onBeforeMount(() => {
  loadSuratFromServer();
});

const loadSuratFromServer = async () => {
  try {
    const rekamMedisUuid = rekamMedisStore.openedRekamMedis?.meta?.rekamMedisUuid;
    if (!rekamMedisUuid) {
      console.error("Gagal memuat surat: rekamMedisUuid tidak ditemukan.");
      return;
    }

    const response = await rekamMedisStore.getSurat({ rekamMedisUuid });
    const suratFromServer = response.payload;

    if (!Array.isArray(suratFromServer)) {
        console.error("Data yang diterima dari server bukan array:", suratFromServer);
        setValues({ datas: [] });
        return;
    }

    const formattedData = suratFromServer.map((surat: any) => {
      const suratInfo = itemsSurat.value.find(item => item.type === surat.fileType);

      let dataSuratParsed = surat.file;
      if (typeof surat.file === 'string') {
        try {
          dataSuratParsed = JSON.parse(surat.file);
        } catch (e) {
          console.warn(`Gagal parse JSON untuk surat ${surat.uuid}:`, surat.file, e);
          dataSuratParsed = {};
        }
      }

      return {
        file_uuid: surat.uuid,
        namaSurat: suratInfo ? suratInfo.name : 'Surat Tidak Dikenali',
        dataSurat: dataSuratParsed,
      };
    });

    setValues({
      datas: formattedData,
    });

  } catch (error) {
    console.error("Gagal memuat data surat dari server:", error);
    setValues({ datas: [] });
  }
};

const addToSelectedItems = async (itemName: string) => {
  if (!itemName) return;
  const selectedItemSurat = itemsSurat.value.find((s) => s.name === itemName);

  if (selectedItemSurat && selectedItemSurat.type) {
    try {
      const response = await rekamMedisStore.GenerateNS({ type: selectedItemSurat.type });
      const nomorSurat = response?.payload?.data;

      if (!nomorSurat) {
        console.error("API Error: 'nomorSurat' tidak ditemukan di response.data.", response);
        toast.add({ severity: "error", summary: "Error", detail: "Gagal mendapatkan nomor surat dari server.", life: 3000 });
        return;
      }

      selectedSurat.value.push({
        namaSurat: selectedItemSurat.name,
        nomorSurat: nomorSurat,
        dataSurat: { noSurat: nomorSurat },
      });

      cariSurat.value = "";

    } catch (error) {
      console.error("Gagal men-generate nomor surat:", error);
      toast.add({ severity: "error", summary: "Gagal", detail: "Terjadi kesalahan saat generate nomor surat.", life: 3000 });
    }
  }
};

const removeFromSelectedItems = (index: number) => {
  selectedSurat.value.splice(index, 1);
  handleRef.value.splice(index, 1);
};

const handleDeleteSurat = async (index: number) => {
  const suratToDelete = fields.value[index].value as { file_uuid?: string };
  const fileUuid = suratToDelete?.file_uuid;

  if (!fileUuid) {
    console.warn("file_uuid tidak ditemukan. Menghapus dari UI saja.");
    remove(index);
    toast.add({ severity: "info", summary: "Info", detail: "Surat dihapus dari tampilan.", life: 3000 });
    return;
  }

  try {
    await rekamMedisStore.deleteFiles({ file_uuid: fileUuid });
    remove(index);
    toast.add({ severity: "success", summary: "Berhasil", detail: "Surat berhasil dihapus.", life: 3000 });
  } catch (error) {
    console.error(`Gagal menghapus file dengan UUID ${fileUuid}:`, error);
    toast.add({ severity: "error", summary: "Gagal", detail: "Gagal menghapus surat dari server.", life: 3000 });
  }
};

const handleCetakSurat = async (fileUuid: string) => {
  if (!fileUuid) {
    toast.add({
      severity: "warn",
      summary: "Peringatan",
      detail: "File UUID tidak ditemukan, tidak bisa mencetak.",
      life: 3000,
    });
    return;
  }

  try {
    const response = await rekamMedisStore.downloadSurat({ uuid: fileUuid });

    if (response && response.data) {
      const blob = new Blob([response.data], { type: "application/pdf" });
      const fileURL = window.URL.createObjectURL(blob);
      window.open(fileURL, "_blank");

      setTimeout(() => window.URL.revokeObjectURL(fileURL), 100);
    } else {
      throw new Error("Response data tidak valid.");
    }
  } catch (error) {
    console.error("Gagal mencetak surat:", error);
    toast.add({
      severity: "error",
      summary: "Gagal Cetak",
      detail: "Terjadi kesalahan saat mengunduh file surat.",
      life: 3000,
    });
  }
};


watch(buatSurat, (newValue) => {
  if (!newValue) {
    cariSurat.value = "";
    selectedSurat.value = [];
    handleRef.value = [];
  }
});

const resetData = () => {
  resetForm({
    values: {
      datas: [],
    },
  });
  selectedSurat.value = [];
  cariSurat.value = "";
  loadSuratFromServer();
};

const handleRef = ref<any[]>([]);

onBeforeUpdate(() => {
  handleRef.value = [];
});

const submitChildForm = async () => {
  try {
    const submissionPromises = handleRef.value.map(comp => {  if (comp && typeof comp.submitForm === 'function') { return comp.submitForm(); } console.warn("Komponen anak tidak memiliki fungsi submitForm:", comp); return Promise.resolve(null); });
    const hasilForm = await Promise.all(submissionPromises);
    // form yang gagal validasi mengembalikan undefined: hentikan agar pesan kolom wajib terlihat
    if (hasilForm.some((data) => !data)) {
      toast.add({ severity: "warn", summary: "Data surat belum lengkap", detail: "Periksa kolom yang ditandai merah.", life: 4000 });
      return;
    }
    const allFormsData = hasilForm.filter((data: any) => data && data.noSurat);
    const uniqueFormsDataMap = new Map(); allFormsData.forEach(item => { if (item.noSurat) { uniqueFormsDataMap.set(item.noSurat, item); } }); const uniqueFormsData = Array.from(uniqueFormsDataMap.values());
    const rekamMedisUuid = rekamMedisStore.openedRekamMedis?.meta?.rekamMedisUuid; if (!rekamMedisUuid) { toast.add({ severity: "error", summary: "Error", detail: "rekamMedisUuid tidak ditemukan.", life: 3000 }); return; }
    const clinicProfileData = getClinicProfile();
    const rekamMedisData = rekamMedisStore.openedRekamMedis;
    const apiPayloadsPromises = uniqueFormsData.map(async (formData: any) => {
      const originalSurat = selectedSurat.value.find(s => s.nomorSurat === formData.noSurat); if (!originalSurat) { console.warn(`Info originalSurat tidak ditemukan untuk noSurat: ${formData.noSurat}`); return null; } const suratInfo = itemsSurat.value.find(item => item.name === originalSurat.namaSurat); if (!suratInfo) { console.warn(`Info surat (itemsSurat) tidak ditemukan untuk nama: ${originalSurat.namaSurat}`); return null; }
      let fileBase64: string | null = null;

      try {
        switch (suratInfo.name) {
          case 'Surat Keterangan Sehat':
            fileBase64 = await generateSuratSehatPdf(formData, clinicProfileData, props.patientData, rekamMedisData);
            break;
          case 'Surat Keterangan Sakit':
            fileBase64 = await generateSuratSakitPdf(formData, clinicProfileData, props.patientData);
            break;
          case 'Surat Kontrol Rawat Jalan':
            fileBase64 = await generateSuratKontrolPdf(formData, clinicProfileData, props.patientData, rekamMedisData);
            break;
          case 'Surat Keterangan Meninggal':
            fileBase64 = await generateSuratMeninggalPdf(formData, clinicProfileData, props.patientData, rekamMedisData);
            break;
          case 'Surat Rujukan':
            fileBase64 = await generateSuratRujukanPdf(formData, clinicProfileData, props.patientData, rekamMedisData);
            break;
          case 'Surat Permohonan Rawat Inap (SPRI)':
            fileBase64 = await generateSPRIPdf(formData, clinicProfileData, props.patientData);
            break;
          case 'Surat Resep Kacamata':
            fileBase64 = await generateSuratResepKacamata(formData, clinicProfileData, props.patientData);
          break;
          default: 
             console.warn(`Tidak ada generator PDF untuk: ${suratInfo.name}`); return null;
        }
      } catch (pdfError) { console.error(`Gagal generate PDF untuk ${suratInfo.name}:`, pdfError); toast.add({ severity: "error", summary: "Gagal PDF", detail: `Gagal membuat PDF untuk ${suratInfo.name}.`, life: 3000 }); return null; }

      if (fileBase64) {
        const payload: any = {
          rekam_medis_uuid: rekamMedisUuid,
          file: fileBase64,
          file_type: suratInfo.type,       
          file_format: "pdf",            
          admission_type: jenisAdmisi.value,
          nomor_surat: formData.noSurat, 
        };
        if (suratInfo.name === 'Surat Permohonan Rawat Inap (SPRI)' && formData.practitioner_uuid) {
          payload.practitioner_uuid = formData.practitioner_uuid;
          payload.lokasi_uuid = formData.lokasi_uuid;
          payload.tanggal_daftar = formData.tanggal_daftar;
        }

        return payload;
      } else {
        return null;
      }
    });

    const apiPayloads = (await Promise.all(apiPayloadsPromises)).filter(payload => payload !== null);

    if (apiPayloads.length === 0) {if(uniqueFormsData.length > 0) { throw new Error("Gagal membentuk payload untuk dikirim ke server."); } else { toast.add({ severity: "info", summary: "Info", detail: "Tidak ada surat baru untuk disimpan.", life: 3000 }); buatSurat.value = false; return; } }

    await rekamMedisStore.createFiles(apiPayloads as any);

    toast.add({ severity: "success", summary: "Berhasil", detail: "Surat baru berhasil disimpan!", life: 3000 });
    await loadSuratFromServer();
    buatSurat.value = false;

  } catch (error) { console.error("Gagal menyimpan surat:", error); toast.add({ severity: "error", summary: "Gagal", detail: (error instanceof Error) ? error.message : "Proses simpan gagal. Pastikan semua kolom wajib diisi.", life: 3000 }); }
};

const updateSuratData = (index: number, dataFromChild: any) => {
  if (selectedSurat.value[index]) {
    selectedSurat.value[index].dataSurat = { ...selectedSurat.value[index].dataSurat, ...dataFromChild };
  }
};

const accordion = ref<InstanceType<typeof CustomAccordion> | null>(null); 
const open = () => {
  accordion.value?.open();
};
const close = () => {
  accordion.value?.close();
};

const setItemRef = (el: any) => {
  if (el) {
     handleRef.value.push(el);
  }
};

defineExpose({
  open,
  close,
});
</script>

<template>
  <CustomAccordion headerClass="bg-opensimrs-50" ref="accordion">
    <template #header>List Surat Keterangan</template>
    <template #content>
      <!-- Tabel untuk menampilkan surat yang sudah ada -->
      <DataTable
        :value="fields"
        stripedRows
        class="pt-5 text-xs"
        scrollable
        scrollHeight="flex"
      >
        <Column headerClass="bg-opensimrs-50" style="width: 50px;">
          <template #header>
            <div class="w-full font-semibold text-center">No.</div>
          </template>
          <template #body="slotProps">
            <div class="flex items-center justify-center">
              {{ slotProps.index + 1 }}
            </div>
          </template>
        </Column>
        <Column
          field="value.namaSurat"
          header="Nama Surat"
          headerClass="bg-opensimrs-50"
          class="w-full"
        >
        </Column>
         <Column headerClass="bg-opensimrs-50" style="width: 150px;">
          <template #header>
            <div
              class="flex items-center justify-center w-full font-semibold text-SM"
            >
              Aksi
            </div>
          </template>
          <template #body="slotProps">
            <div class="flex items-center gap-2.5 justify-center">
             <!-- Tombol Cetak (jika perlu cetak PDF yg sudah disimpan) -->
             <CustomButton
                @click="handleCetakSurat(slotProps.data.value.file_uuid)"
                background-color="bg-opensimrs-300 rounded-lg"
                class="h-6"
              >
                <div class="flex items-center gap-1">
                  <PhPrinter :size="18" color="#ffffff" weight="fill" />
                  <div class="text-SM">Cetak</div>
                </div>
              </CustomButton>

              <!-- Tombol Hapus -->
              <CustomButton
                v-if="viewMode != 'history'"
                label=""
                background-color="bg-danger-300 rounded-lg"
                class="h-6 w-[26px] p-0"
                @click="handleDeleteSurat(slotProps.index)"
              >
                <img src="@/assets/icons/delete.svg" alt="Hapus" />
              </CustomButton>
            </div>
          </template>
        </Column>
      </DataTable>

      <!-- Tombol Buat Surat -->
      <div
        v-if="viewMode != 'history'"
        class="flex items-center justify-center p-5 m-5 border border-dashed rounded-lg border-opensimrs-300 gap-2.5"
      >
        <CustomButton
          icon="PhPlus"
          label="Buat Surat"
          borderColor="border-opensimrs-300"
          textColor="text-opensimrs-300"
          backgroundColor="bg-white"
          @click="buatSurat = true"
        />
      </div>

      <!-- Dialog Buat Surat -->
      <CustomDialog
        width="1000px"
        v-model:visible="buatSurat"
        headerBg="bg-opensimrs-300"
      >
        <template #header>Buat Surat</template>
        <template #body>
          <div class="flex flex-col gap-5 mt-5 overflow-hidden h-full">
            <!-- Input Cari & Buat -->
            <div class="flex items-end w-full gap-5">
              <CustomSelect
                label="Cari Surat"
                v-model="cariSurat"
                :options="itemsSurat"
                option-label="name"
                option-value="name"
                place-holder="Cari & Pilih Surat"
                class="grow"
                :show-clear="true"
              />
              <CustomButton
                label="Buat"
                icon="PhPlus"
                :disabled="!cariSurat"
                @click="addToSelectedItems(cariSurat)"
              />
            </div>

            <!-- Area untuk menampilkan form surat yang dipilih -->
            <div class="flex flex-col gap-5 overflow-y-auto h-[40vh] px-1 py-1">
              <NoData
                v-if="selectedSurat.length === 0"
                title="Silahkan Pilih Surat Terlebih Dahulu"
              />

              <!-- Gunakan v-for untuk render komponen surat yang dipilih -->
              <div v-for="(surat, index) in selectedSurat" :key="surat.nomorSurat">
                  <!-- Gunakan :ref dengan fungsi untuk menangkap referensi -->
                  <SuratControlRawatJalan
                    v-if="surat.namaSurat === 'Surat Kontrol Rawat Jalan'"
                    :nomor-surat="surat.nomorSurat" @onDelete="() => removeFromSelectedItems(index)"
                    @update:dataSurat="(data) => updateSuratData(index, data)"
                    :ref="setItemRef"
                  />
                  <SuratPermohonanRawatInap
                    v-if="surat.namaSurat === 'Surat Permohonan Rawat Inap (SPRI)'"
                    :nomor-surat="surat.nomorSurat" @onDelete="() => removeFromSelectedItems(index)"
                    @update:dataSurat="(data) => updateSuratData(index, data)"
                    :ref="setItemRef"
                  />
                  <SuratKeteranganSakit
                    v-if="surat.namaSurat === 'Surat Keterangan Sakit'"
                    :nomor-surat="surat.nomorSurat" @onDelete="() => removeFromSelectedItems(index)"
                    @update:dataSurat="(data) => updateSuratData(index, data)"
                    :ref="setItemRef"
                  />
                  <SuratKeteranganSehat
                    v-if="surat.namaSurat === 'Surat Keterangan Sehat'"
                    :nomor-surat="surat.nomorSurat" @onDelete="() => removeFromSelectedItems(index)"
                    @update:dataSurat="(data) => updateSuratData(index, data)"
                    :ref="setItemRef"
                  />
                  <SuratRujukan
                    v-if="surat.namaSurat === 'Surat Rujukan'"
                    :nomor-surat="surat.nomorSurat" @onDelete="() => removeFromSelectedItems(index)"
                    @update:dataSurat="(data) => updateSuratData(index, data)"
                    :ref="setItemRef"
                  />
                  <SuratKeteranganMeninggal
                    v-if="surat.namaSurat === 'Surat Keterangan Meninggal'"
                    :nomor-surat="surat.nomorSurat" @onDelete="() => removeFromSelectedItems(index)"
                    @update:dataSurat="(data) => updateSuratData(index, data)"
                    :ref="setItemRef"
                  />
                  <SuratResepKacamata
                    v-if="surat.namaSurat === 'Surat Resep Kacamata'"
                    :nomor-surat="surat.nomorSurat" @onDelete="() => removeFromSelectedItems(index)"
                    @update:dataSurat="(data) => updateSuratData(index, data)"
                    :ref="setItemRef"
                  />
              </div>
            </div>
          </div>
        </template>
        <template #footer>
          <!-- Tombol Batal & Simpan di Dialog -->
          <div class="w-full">
            <div class="mt-5 flex justify-end gap-2.5">
              <CustomButton
                label="Batal"
                borderColor="border-2 border-[#9DA4B1]"
                backgroundColor="bg-white"
                textColor="text-grey-300"
                @click="buatSurat = false"
              />
              <CustomButton label="Simpan" @click="submitChildForm" />
            </div>
          </div>
        </template>
      </CustomDialog>
    </template>
    <template #footer>
     <!-- Tombol Simpan & Reset di Accordion Utama -->
     <!-- Mungkin tidak perlu tombol simpan di sini jika penyimpanan hanya terjadi via dialog? -->
     <!-- Hapus jika tidak diperlukan -->
      <!-- <div class="flex items-end justify-end gap-3">
        <CustomButton
          @click="resetData"
          label="Reset"
          textColor="text-[#9DA4B1]"
          backgroundColor="bg-transparent"
          borderColor="border-2 border-[#9DA4B1]"
        />
        <CustomButton label="Simpan" @click="onSubmit" />
      </div> -->
    </template>
  </CustomAccordion>
</template>