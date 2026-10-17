<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  KEPUTUSAN_RETENSI,
  OPSI_KEPUTUSAN_RETENSI,
  ajukanUsulanRetensi,
  daftarJenisBerkas,
  daftarRetensi,
  daftarUsulanRetensi,
  izinKoding,
  keputusanUsulanRetensi,
  simpanJenisBerkas,
  waktuKoding,
} from "@/stores/penunjang/koding";

// Retensi & pemusnahan berkas: master jenis berkas (masa retensi), daftar berkas yang memasuki tahap retensi, dan
// usulan pemusnahan beserta keputusannya (bukan pelaksanaan pemusnahan fisik).
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinKoding("Retensi", aksi);
const tab = ref("jenis");
const gantiTab = (v: string | number) => (tab.value = String(v));

// ── Jenis berkas
const jenisData = ref<any[]>([]);
const muatJenis = async () => {
  storeUtils.setLoading(true);
  try {
    jenisData.value = (await daftarJenisBerkas({ limit: 100 }))?.payload?.data ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
const dialogJenis = ref(false);
const jenisDipilih = ref<any>(null);
const formJenis = ref({ nama: "", masaRetensiAktifTahun: 5, masaRetensiInaktifTahun: 2, status: true });
const bukaJenis = (d: any = null) => {
  jenisDipilih.value = d;
  formJenis.value = d ? { nama: d.nama, masaRetensiAktifTahun: d.masaRetensiAktifTahun, masaRetensiInaktifTahun: d.masaRetensiInaktifTahun, status: d.status } : { nama: "", masaRetensiAktifTahun: 5, masaRetensiInaktifTahun: 2, status: true };
  dialogJenis.value = true;
};
const simpanJenis = async () => {
  if (!formJenis.value.nama.trim()) return;
  storeUtils.setLoading(true);
  try {
    const res = await simpanJenisBerkas(formJenis.value, jenisDipilih.value?.uuid);
    if (res?.payload) {
      dialogJenis.value = false;
      muatJenis();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Daftar retensi
const retensiData = ref<any[]>([]);
const filterJenisUuid = ref("");
const muatRetensi = async () => {
  storeUtils.setLoading(true);
  try {
    retensiData.value = (await daftarRetensi({ jenis_berkas_uuid: filterJenisUuid.value, limit: 100 }))?.payload?.data ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
const dialogUsulkan = ref(false);
const retensiDipilih = ref<any>(null);
const alasanUsulan = ref("");
const bukaUsulkan = (d: any) => {
  retensiDipilih.value = d;
  alasanUsulan.value = "";
  dialogUsulkan.value = true;
};
const simpanUsulan = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await ajukanUsulanRetensi({ noRm: retensiDipilih.value.noRm, jenisBerkasUuid: retensiDipilih.value.jenisBerkasUuid, alasan: alasanUsulan.value || undefined });
    if (res?.payload) {
      dialogUsulkan.value = false;
      muatRetensi();
      if (tab.value === "usulan") muatUsulan();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Usulan pemusnahan
const usulanData = ref<any[]>([]);
const filterStatusUsulan = ref("");
const muatUsulan = async () => {
  storeUtils.setLoading(true);
  try {
    usulanData.value = (await daftarUsulanRetensi({ status_keputusan: filterStatusUsulan.value, limit: 100 }))?.payload?.data ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
const dialogKeputusan = ref(false);
const usulanDipilih = ref<any>(null);
const formKeputusan = ref({ keputusan: "", alasan: "", beritaAcaraRef: "" });
const bukaKeputusan = (d: any) => {
  usulanDipilih.value = d;
  formKeputusan.value = { keputusan: "", alasan: "", beritaAcaraRef: "" };
  dialogKeputusan.value = true;
};
const simpanKeputusan = async () => {
  if (!formKeputusan.value.keputusan) return;
  storeUtils.setLoading(true);
  try {
    const res = await keputusanUsulanRetensi(usulanDipilih.value.uuid, formKeputusan.value as any);
    if (res?.payload) {
      dialogKeputusan.value = false;
      muatUsulan();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(() => {
  muatJenis();
  muatRetensi();
  muatUsulan();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <h1 class="toolbar-heading text-opensimrs-300">Retensi & Pemusnahan Berkas</h1>
        </PageToolbar>
      </template>
      <template #content>
        <Tabs :value="tab" class="flex flex-col h-full" @update:value="gantiTab">
          <TabList>
            <Tab value="jenis">Jenis Berkas</Tab>
            <Tab value="daftar">Daftar Retensi</Tab>
            <Tab value="usulan">Usulan Pemusnahan</Tab>
          </TabList>
          <TabPanels class="overflow-auto grow">
            <TabPanel value="jenis">
              <div class="flex justify-end mb-3">
                <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Jenis Berkas" @click="bukaJenis()" />
              </div>
              <NoData v-if="!jenisData.length" />
              <DataTable v-else :value="jenisData" stripedRows class="text-xs cursor-pointer" @rowClick="bukaJenis($event.data)">
                <Column field="nama" header="Nama Jenis Berkas" headerClass="bg-opensimrs-50" />
                <Column header="Retensi Aktif" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ d.masaRetensiAktifTahun }} tahun</template>
                </Column>
                <Column header="Retensi Inaktif" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ d.masaRetensiInaktifTahun }} tahun</template>
                </Column>
                <Column header="Status" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ d.status ? "Aktif" : "Nonaktif" }}</template>
                </Column>
              </DataTable>
            </TabPanel>

            <TabPanel value="daftar">
              <div class="flex justify-end gap-2 mb-3">
                <CustomSelect v-model="filterJenisUuid" label="Jenis Berkas" :options="jenisData" optionLabel="nama" optionValue="uuid" placeHolder="Semua jenis" />
                <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" @click="muatRetensi" />
              </div>
              <NoData v-if="!retensiData.length" />
              <DataTable v-else :value="retensiData" stripedRows class="text-xs">
                <Column field="noRm" header="No. RM" headerClass="bg-opensimrs-50" />
                <Column field="jenisBerkas" header="Jenis Berkas" headerClass="bg-opensimrs-50" />
                <Column header="Kunjungan Terakhir" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ waktuKoding(d.kunjunganTerakhir, true) }}</template>
                </Column>
                <Column header="" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }"><CustomButton v-if="boleh('CREATE')" label="Usulkan Pemusnahan" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaUsulkan(d)" /></template>
                </Column>
              </DataTable>
            </TabPanel>

            <TabPanel value="usulan">
              <div class="flex justify-end gap-2 mb-3">
                <CustomSelect
                  v-model="filterStatusUsulan"
                  label="Keputusan"
                  :options="[{ value: 'diusulkan', label: 'Diusulkan' }, ...Object.entries(KEPUTUSAN_RETENSI).map(([value, s]) => ({ value, label: s.label }))]"
                  optionLabel="label"
                  optionValue="value"
                  placeHolder="Semua"
                />
                <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" @click="muatUsulan" />
              </div>
              <NoData v-if="!usulanData.length" />
              <DataTable v-else :value="usulanData" stripedRows class="text-xs">
                <Column field="noRm" header="No. RM" headerClass="bg-opensimrs-50" />
                <Column field="jenisBerkas" header="Jenis Berkas" headerClass="bg-opensimrs-50" />
                <Column header="Diusulkan" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ waktuKoding(d.diusulkanAt, true) }} · {{ d.diusulkanOleh }}</template>
                </Column>
                <Column header="Keputusan" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">
                    <span v-if="!d.keputusan" class="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#D4D8DC] text-[#475467]">Diusulkan</span>
                    <span v-else class="px-2 py-0.5 rounded-full text-xs font-semibold" :class="[KEPUTUSAN_RETENSI[d.keputusan]?.bg, KEPUTUSAN_RETENSI[d.keputusan]?.text]">{{ KEPUTUSAN_RETENSI[d.keputusan]?.label }}</span>
                  </template>
                </Column>
                <Column header="" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }"><CustomButton v-if="!d.keputusan && boleh('UPDATE')" label="Keputusan" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaKeputusan(d)" /></template>
                </Column>
              </DataTable>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialogJenis" width="480px">
      <template #header>{{ jenisDipilih ? "Ubah" : "Tambah" }} Jenis Berkas</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-3">
          <CustomTextfield v-model="formJenis.nama" label="Nama Jenis Berkas" :maxLength="200" />
          <CustomTextfield v-model.number="formJenis.masaRetensiAktifTahun" type="number" label="Masa Retensi Aktif (tahun)" />
          <CustomTextfield v-model.number="formJenis.masaRetensiInaktifTahun" type="number" label="Masa Retensi Inaktif (tahun)" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogJenis = false" />
          <CustomButton label="Simpan" @click="simpanJenis" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogUsulkan" width="480px">
      <template #header>Usulkan Pemusnahan {{ retensiDipilih?.noRm }}</template>
      <template #body>
        <CustomTextArea v-model="alasanUsulan" label="Alasan (opsional)" class="mt-3" />
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogUsulkan = false" />
          <CustomButton label="Ajukan" @click="simpanUsulan" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogKeputusan" width="480px">
      <template #header>Keputusan Usulan {{ usulanDipilih?.noRm }}</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-3">
          <CustomSelect v-model="formKeputusan.keputusan" label="Keputusan" :options="OPSI_KEPUTUSAN_RETENSI" optionLabel="label" optionValue="value" />
          <CustomTextfield v-model="formKeputusan.beritaAcaraRef" label="Referensi Berita Acara (opsional)" :maxLength="200" />
          <CustomTextArea v-model="formKeputusan.alasan" label="Alasan/Catatan (opsional)" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogKeputusan = false" />
          <CustomButton label="Simpan Keputusan" @click="simpanKeputusan" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
