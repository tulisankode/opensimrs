<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  ICDO_MORFOLOGI_PA,
  ICDO_TOPOGRAFI_PA,
  JENIS_PA,
  OPSI_JENIS_PA,
  daftarPemeriksaanPa,
  daftarTemplatePa,
  hapusTemplatePa,
  simpanTemplatePa,
  izinPa,
} from "@/stores/penunjang/patologi";

// Datamaster Template Laporan PA: kasus normal/umum (mis. Pap smear NILM, appendisitis akut, fibroadenoma mammae)
// berisi makroskopis, mikroskopis, kesimpulan/diagnosis + ICD-O/ICD-10 & komentar. Dipilih saat mengisi laporan
// (Pemeriksaan & Diagnosis) lalu disunting sesuai temuan. Gunakan "..." untuk isian ukuran/lokasi.
const storeUtils = utilsStore();
// Hak akses (Patologi Anatomi › Datamaster › Template Laporan PA): CREATE / UPDATE / DELETE.
const boleh = (aksi: string) => izinPa("Datamaster", aksi, "Template Laporan PA");

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");
const filterJenis = ref<string[]>([]);
const pemeriksaan = ref<any[]>([]);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarTemplatePa({ page: page.value, limit: limit.value, cari: cari.value, jenis: filterJenis.value });
    data.value = res?.payload?.data ?? [];
    total.value = res?.payload?.pagination?.total ?? 0;
  } finally {
    storeUtils.setLoading(false);
  }
};
const cariData = () => {
  page.value = 1;
  muat();
};
const pilihJenis = (j: string) => {
  filterJenis.value = filterJenis.value.includes(j) ? filterJenis.value.filter((x) => x !== j) : [...filterJenis.value, j];
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

const dialog = ref(false);
const kosong = () => ({
  uuid: "",
  nama: "",
  lingkup: "jenis",
  pemeriksaanUuid: "",
  jenis: "histopatologi",
  makroskopis: "",
  mikroskopis: "",
  diagnosis: "",
  icdOTopografi: "",
  icdOMorfologi: "",
  icd10: "",
  komentar: "",
  status: true,
});
const form = ref<any>(kosong());
const galat = ref("");
const modeUbah = computed(() => !!form.value.uuid);
const opsiPemeriksaan = computed(() => pemeriksaan.value.map((p) => ({ value: p.uuid, label: `${p.kode} — ${p.nama}` })));
const LINGKUP = [
  { value: "jenis", label: "Satu jenis pemeriksaan" },
  { value: "pemeriksaan", label: "Satu pemeriksaan" },
  { value: "umum", label: "Umum (semua pemeriksaan)" },
];
const buka = async (baris?: any) => {
  galat.value = "";
  if (!pemeriksaan.value.length) pemeriksaan.value = (await daftarPemeriksaanPa({ limit: 9999, status: "aktif" }))?.payload?.data ?? [];
  form.value = baris
    ? {
        ...kosong(),
        ...Object.fromEntries(Object.entries(baris).map(([k, v]) => [k, v ?? ""])),
        lingkup: baris.pemeriksaanUuid ? "pemeriksaan" : baris.jenis ? "jenis" : "umum",
        jenis: baris.jenis ?? "histopatologi",
        status: baris.status,
      }
    : kosong();
  dialog.value = true;
};
const simpan = async () => {
  const f = form.value;
  galat.value = "";
  if (!f.nama.trim() || !f.diagnosis.trim()) return (galat.value = "Nama dan diagnosis wajib diisi");
  if (f.lingkup === "pemeriksaan" && !f.pemeriksaanUuid) return (galat.value = "Pilih pemeriksaan");
  storeUtils.setLoading(true);
  try {
    const res = await simpanTemplatePa(
      {
        nama: f.nama,
        pemeriksaanUuid: f.lingkup === "pemeriksaan" ? f.pemeriksaanUuid : null,
        jenis: f.lingkup === "jenis" ? f.jenis : null,
        makroskopis: f.makroskopis,
        mikroskopis: f.mikroskopis,
        diagnosis: f.diagnosis,
        icdOTopografi: f.icdOTopografi,
        icdOMorfologi: f.icdOMorfologi,
        icd10: f.icd10,
        komentar: f.komentar,
        status: f.status,
      },
      f.uuid || undefined
    );
    if (res) {
      dialog.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const dialogHapus = ref(false);
const akanDihapus = ref<any>(null);
const hapus = async () => {
  if (akanDihapus.value && (await hapusTemplatePa(akanDihapus.value.uuid))) {
    dialogHapus.value = false;
    muat();
  }
};

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Template Laporan PA</h1>
          <CustomTextfield v-model="cari" label="Cari template" prependIcon="PhMagnifyingGlass" placeholder="Nama / pemeriksaan / diagnosis" :maxLength="100" @keydown.enter="cariData" />
          <ToolbarFilterMenu :count="filterJenis.length">
            <template #label>Jenis</template>
            <CustomChip v-for="(j, kode) in JENIS_PA" :key="kode" :label="j.label" :value="String(kode)" :isSelected="filterJenis.includes(String(kode))" @selected="pilihJenis" />
          </ToolbarFilterMenu>
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Template" @click="buka()" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 56rem">
          <Column header="Nama Template" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><div class="font-semibold">{{ d.nama }}</div></template>
          </Column>
          <Column header="Berlaku untuk" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span v-if="d.pemeriksaanUuid">{{ d.pemeriksaanNama }} <span class="text-grey-400">· {{ d.pemeriksaanKode }}</span></span>
              <span v-else-if="d.jenis">Semua {{ JENIS_PA[d.jenis as keyof typeof JENIS_PA]?.label ?? d.jenis }}</span>
              <span v-else class="text-grey-400">Umum</span>
            </template>
          </Column>
          <Column header="Kesimpulan / Diagnosis" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><div class="max-w-[380px] line-clamp-2 whitespace-pre-line">{{ d.diagnosis }}</div></template>
          </Column>
          <Column header="Kode" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div>{{ [d.icdOTopografi, d.icdOMorfologi].filter(Boolean).join(" · ") || "-" }}</div>
              <div class="text-grey-400">{{ d.icd10 ? `ICD-10 ${d.icd10}` : "" }}</div>
            </template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><span :class="d.status ? 'text-mint-400' : 'text-grey-300'">{{ d.status ? "Aktif" : "Nonaktif" }}</span></template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[110px]">
            <template #body="{ data: d }">
              <div class="flex gap-2">
                <CustomButton v-if="boleh('UPDATE')" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="buka(d)" />
                <CustomButton v-if="boleh('DELETE')" icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="(akanDihapus = d), (dialogHapus = true)" />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="900px">
      <template #header>{{ modeUbah ? "Ubah" : "Tambah" }} Template Laporan PA</template>
      <template #body>
        <div class="grid grid-cols-3 gap-4 pt-4">
          <CustomTextfield v-model="form.nama" label="Nama Template" placeholder="mis. Pap Smear — NILM" required class="col-span-3" :maxLength="200" />
          <CustomSelect v-model="form.lingkup" label="Berlaku untuk" :options="LINGKUP" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
          <CustomSelect
            v-if="form.lingkup === 'pemeriksaan'"
            v-model="form.pemeriksaanUuid"
            label="Pemeriksaan"
            placeHolder="Pilih pemeriksaan"
            :options="opsiPemeriksaan"
            optionValue="value"
            optionLabel="label"
            class="col-span-2"
            required
          />
          <CustomSelect
            v-else-if="form.lingkup === 'jenis'"
            v-model="form.jenis"
            label="Jenis pemeriksaan"
            :options="OPSI_JENIS_PA"
            optionValue="value"
            optionLabel="label"
            :showFilter="false"
            :clearable="false"
            class="col-span-2"
          />
          <div v-else class="col-span-2" />
          <CustomTextArea v-model="form.makroskopis" label="Makroskopis" placeholder="Gunakan ... untuk isian ukuran/jumlah" height="h-24" class="col-span-3" />
          <CustomTextArea v-model="form.mikroskopis" label="Mikroskopis" height="h-32" class="col-span-3" />
          <CustomTextArea v-model="form.diagnosis" label="Kesimpulan / Diagnosis" height="h-20" required class="col-span-3" />
          <label class="flex flex-col gap-1 text-sm font-semibold">
            ICD-O Topografi
            <InputText v-model="form.icdOTopografi" list="tpl-icdo-topo" placeholder="mis. C53.9" maxlength="20" class="text-sm font-normal" />
            <datalist id="tpl-icdo-topo"><option v-for="[k, n] in ICDO_TOPOGRAFI_PA" :key="k" :value="k">{{ n }}</option></datalist>
          </label>
          <label class="flex flex-col gap-1 text-sm font-semibold">
            ICD-O Morfologi
            <InputText v-model="form.icdOMorfologi" list="tpl-icdo-morf" placeholder="mis. 9010/0" maxlength="20" class="text-sm font-normal" />
            <datalist id="tpl-icdo-morf"><option v-for="[k, n] in ICDO_MORFOLOGI_PA" :key="k" :value="k">{{ n }}</option></datalist>
          </label>
          <CustomTextfield v-model="form.icd10" label="ICD-10" placeholder="mis. D24" :maxLength="20" />
          <CustomTextArea v-model="form.komentar" label="Komentar / saran" height="h-16" class="col-span-2" />
          <CustomSwitch v-model="form.status" label="Status" sideLabel="Nonaktif" sideLabelTrue="Aktif" />
        </div>
        <div v-if="galat" class="mt-3 text-sm text-danger-300">{{ galat }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpan" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogHapus" width="420px" headerBg="bg-danger-300">
      <template #header>Hapus Template</template>
      <template #body>
        <div class="pt-4 text-normal">Hapus template <b>{{ akanDihapus?.nama }}</b>? Laporan yang sudah tersimpan tidak berubah.</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogHapus = false" />
          <CustomButton label="Hapus" icon="PhTrash" backgroundColor="bg-danger-300" @click="hapus" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
