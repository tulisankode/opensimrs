<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { JENIS_KUNJUNGAN, izinKoding, keTanggalKoding, masterChecklist, rekapDpjp, simpanMasterChecklist } from "@/stores/penunjang/koding";

// Master item checklist kelengkapan rekam medis per faskes, serta rekap kelengkapan per DPJP per periode.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinKoding("Checklist", aksi);
const tab = ref("master");
const gantiTab = (v: string | number) => (tab.value = String(v));

// ── Master item checklist
const master = ref<any[]>([]);
const muatMaster = async () => {
  storeUtils.setLoading(true);
  try {
    master.value = (await masterChecklist())?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
const dialogMaster = ref(false);
const dipilih = ref<any>(null);
const kosongForm = () => ({ nama: "", berlakuKunjunganTipe: [] as string[], wajib: true, urutan: 0, status: true });
const form = ref(kosongForm());
const toggleJenisBerlaku = (v: string) => (form.value.berlakuKunjunganTipe = form.value.berlakuKunjunganTipe.includes(v) ? form.value.berlakuKunjunganTipe.filter((x) => x !== v) : [...form.value.berlakuKunjunganTipe, v]);
const bukaMaster = (d: any = null) => {
  dipilih.value = d;
  form.value = d ? { nama: d.nama, berlakuKunjunganTipe: d.berlakuKunjunganTipe ?? [], wajib: d.wajib, urutan: d.urutan, status: d.status } : kosongForm();
  dialogMaster.value = true;
};
const simpanMaster = async () => {
  if (!form.value.nama.trim()) return;
  storeUtils.setLoading(true);
  try {
    const res = await simpanMasterChecklist({ ...form.value, berlakuKunjunganTipe: form.value.berlakuKunjunganTipe.length ? form.value.berlakuKunjunganTipe : null }, dipilih.value?.uuid);
    if (res?.payload) {
      dialogMaster.value = false;
      muatMaster();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Rekap DPJP
const awalBulan = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};
const tglMulai = ref<Date | null>(awalBulan());
const tglSelesai = ref<Date | null>(new Date());
const rekap = ref<any[]>([]);
const muatRekap = async () => {
  storeUtils.setLoading(true);
  try {
    rekap.value = (await rekapDpjp({ periode_mulai: keTanggalKoding(tglMulai.value), periode_sampai: keTanggalKoding(tglSelesai.value ?? tglMulai.value), limit: 100 }))?.payload?.data ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(() => {
  muatMaster();
  muatRekap();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <h1 class="toolbar-heading text-opensimrs-300">Checklist Kelengkapan Rekam Medis</h1>
        </PageToolbar>
      </template>
      <template #content>
        <Tabs :value="tab" class="flex flex-col h-full" @update:value="gantiTab">
          <TabList>
            <Tab value="master">Master Item Checklist</Tab>
            <Tab value="rekap">Rekap per DPJP</Tab>
          </TabList>
          <TabPanels class="overflow-auto grow">
            <TabPanel value="master">
              <div class="flex justify-end mb-3">
                <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Item Checklist" @click="bukaMaster()" />
              </div>
              <NoData v-if="!master.length" />
              <DataTable v-else :value="master" stripedRows class="text-xs cursor-pointer" @rowClick="bukaMaster($event.data)">
                <Column field="urutan" header="Urutan" headerClass="bg-opensimrs-50" class="w-[80px]" />
                <Column field="nama" header="Nama Item" headerClass="bg-opensimrs-50" />
                <Column header="Berlaku Untuk" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ d.berlakuKunjunganTipe?.length ? d.berlakuKunjunganTipe.map((t: string) => JENIS_KUNJUNGAN[t as 'rj']).join(", ") : "Semua jenis" }}</template>
                </Column>
                <Column header="Wajib" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ d.wajib ? "Ya" : "Tidak" }}</template>
                </Column>
                <Column header="Status" headerClass="bg-opensimrs-50">
                  <template #body="{ data: d }">{{ d.status ? "Aktif" : "Nonaktif" }}</template>
                </Column>
              </DataTable>
            </TabPanel>

            <TabPanel value="rekap">
              <div class="flex justify-end gap-2 mb-3">
                <CustomDatePicker v-model="tglMulai" label="Periode mulai" class="toolbar-field--date" :maxDate="tglSelesai ?? undefined" />
                <CustomDatePicker v-model="tglSelesai" label="Periode sampai" class="toolbar-field--date" :minDate="tglMulai ?? undefined" />
                <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" @click="muatRekap" />
              </div>
              <NoData v-if="!rekap.length" />
              <DataTable v-else :value="rekap" stripedRows class="text-xs">
                <Column field="practitionerUuid" header="DPJP" headerClass="bg-opensimrs-50" />
                <Column field="jumlahKunjungan" header="Jumlah Kunjungan" headerClass="bg-opensimrs-50" />
                <Column field="jumlahLengkap" header="Lengkap" headerClass="bg-opensimrs-50" />
                <Column field="jumlahTidakLengkap" header="Tidak Lengkap" headerClass="bg-opensimrs-50" />
              </DataTable>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialogMaster" width="480px">
      <template #header>{{ dipilih ? "Ubah" : "Tambah" }} Item Checklist</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-3">
          <CustomTextfield v-model="form.nama" label="Nama Item" :maxLength="200" />
          <CustomTextfield v-model.number="form.urutan" type="number" label="Urutan" />
          <div>
            <div class="mb-1 text-sm text-grey-400">Berlaku untuk jenis kunjungan (kosongkan = semua)</div>
            <div class="flex gap-2">
              <CustomChip v-for="(l, kode) in JENIS_KUNJUNGAN" :key="kode" :label="l" :value="String(kode)" :isSelected="form.berlakuKunjunganTipe.includes(String(kode))" @selected="toggleJenisBerlaku" />
            </div>
          </div>
          <div class="flex items-center gap-2">
            <Checkbox v-model="form.wajib" binary inputId="wajib" />
            <label for="wajib" class="text-sm">Item wajib</label>
          </div>
          <div class="flex items-center gap-2">
            <Checkbox v-model="form.status" binary inputId="status" />
            <label for="status" class="text-sm">Aktif</label>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogMaster = false" />
          <CustomButton label="Simpan" @click="simpanMaster" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
