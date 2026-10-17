<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  daftarMasterSetCssd,
  detailMasterSetCssd,
  gayaSetCssd,
  izinCssd,
  labelSetCssd,
  opsi,
  referensiPilihanCssd,
  simpanMasterSetCssd,
  tambahSetFisikCssd,
} from "@/stores/penunjang/cssd";
import { createLabelSetCssdPdf } from "@/utils/pdf/pdfCssd/cetakCssd";

// Master set: template jenis set (komposisi instrumen, metode & masa berlaku steril) + set fisik berbarcode yang
// dilacak satu per satu (mis. "Set Laparotomi 01", "02", ...). Barcode unik per faskes (KF-3).
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinCssd("Master Set & Mesin", aksi);

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(50);
const cari = ref("");
const metode = ref<Record<string, string>>({});

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarMasterSetCssd({ page: page.value, limit: limit.value, q: cari.value });
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
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

onMounted(async () => {
  const ref1 = await referensiPilihanCssd();
  metode.value = Object.fromEntries((ref1?.payload?.metode ?? []).map((m: any) => [m.kode, m.nama]));
  muat();
});

// ── Form master set + instrumen ───────────────────────────────────────────────
const dialog = ref(false);
const kosong = () => ({
  uuid: "",
  kodeSet: "",
  namaSet: "",
  metodeSterilisasiDefault: "autoklaf",
  masaBerlakuSterilJam: 168,
  statusAktif: true,
  kodeSetFisik: "",
  kodeBarcode: "",
  instrumen: [{ namaInstrumen: "", jumlah: 1, satuan: "pcs" }],
});
const form = ref<any>(kosong());
const galat = ref("");
const modeUbah = computed(() => !!form.value.uuid);
const buka = async (baris?: any) => {
  galat.value = "";
  if (baris) {
    const det = (await detailMasterSetCssd(baris.uuid))?.payload;
    form.value = { ...kosong(), ...det, instrumen: det?.instrumen?.length ? det.instrumen : kosong().instrumen };
  } else {
    form.value = kosong();
  }
  dialog.value = true;
};
const tambahBarisInstrumen = () => form.value.instrumen.push({ namaInstrumen: "", jumlah: 1, satuan: "pcs" });
const hapusBarisInstrumen = (i: number) => form.value.instrumen.splice(i, 1);

const simpan = async () => {
  const f = form.value;
  if (!f.kodeSet?.trim() || !f.namaSet?.trim()) return (galat.value = "Kode set dan nama set wajib diisi");
  const instrumen = f.instrumen.filter((i: any) => i.namaInstrumen?.trim());
  if (!instrumen.length) return (galat.value = "Minimal satu instrumen wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await simpanMasterSetCssd(
      {
        kodeSet: f.kodeSet,
        namaSet: f.namaSet,
        metodeSterilisasiDefault: f.metodeSterilisasiDefault,
        masaBerlakuSterilJam: f.masaBerlakuSterilJam,
        statusAktif: f.statusAktif,
        instrumen,
        ...(f.uuid ? {} : { kodeSetFisik: f.kodeSetFisik, kodeBarcode: f.kodeBarcode }),
      },
      f.uuid || undefined,
    );
    if (res) {
      dialog.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Set fisik (barcode) per master set ────────────────────────────────────────
const dialogSetFisik = ref(false);
const masterAktif = ref<any>(null);
const formSetFisik = ref({ kodeSetFisik: "", kodeBarcode: "" });
const galatSetFisik = ref("");
const bukaSetFisik = async (baris: any) => {
  const det = (await detailMasterSetCssd(baris.uuid))?.payload;
  masterAktif.value = det;
  formSetFisik.value = { kodeSetFisik: "", kodeBarcode: "" };
  galatSetFisik.value = "";
  dialogSetFisik.value = true;
};
const tambahSetFisik = async () => {
  if (!formSetFisik.value.kodeBarcode.trim()) return (galatSetFisik.value = "Kode barcode wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await tambahSetFisikCssd(masterAktif.value.uuid, formSetFisik.value);
    if (res) {
      formSetFisik.value = { kodeSetFisik: "", kodeBarcode: "" };
      const det = (await detailMasterSetCssd(masterAktif.value.uuid))?.payload;
      masterAktif.value = det;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const cetakLabel = async (setUuid?: string) => {
  const res = await labelSetCssd(masterAktif.value.uuid, setUuid);
  const label = (res?.payload?.label ?? []).map((l: any) => ({ kodeBarcode: l.kodeBarcode, kodeSetFisik: l.kodeSetFisik, namaSet: res?.payload?.namaSet }));
  if (label.length) createLabelSetCssdPdf(label, `Label ${masterAktif.value?.namaSet ?? ""}`);
};

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Master Set Instrumen</h1>
          <CustomTextfield v-model="cari" label="Cari master set" prependIcon="PhMagnifyingGlass" placeholder="Kode / nama set" :maxLength="100" @keydown.enter="cariData" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Master Set" @click="buka()" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 60rem">
          <Column field="kodeSet" header="Kode" headerClass="bg-opensimrs-50" />
          <Column header="Nama Set" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><i class="font-semibold">{{ d.namaSet }}</i></template>
          </Column>
          <Column header="Metode Default" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ metode[d.metodeSterilisasiDefault] ?? d.metodeSterilisasiDefault }}</template>
          </Column>
          <Column header="Masa Berlaku Steril" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.masaBerlakuSterilJam }} jam</template>
          </Column>
          <Column header="Instrumen" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.jumlahInstrumen }} jenis</template>
          </Column>
          <Column header="Set Fisik" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.jumlahSetFisik }} unit</template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span :class="d.statusAktif ? 'text-mint-400' : 'text-grey-300'">{{ d.statusAktif ? "Aktif" : "Nonaktif" }}</span>
            </template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[220px]">
            <template #body="{ data: d }">
              <div class="flex gap-2">
                <CustomButton label="Set Fisik" icon="PhTag" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaSetFisik(d)" />
                <CustomButton v-if="boleh('UPDATE')" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="buka(d)" />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[50, 100, 200]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <!-- Form master set -->
    <CustomDialog v-model:visible="dialog" width="760px">
      <template #header>{{ modeUbah ? "Ubah" : "Tambah" }} Master Set</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomTextfield v-model="form.kodeSet" label="Kode Set" placeholder="mis. LAPAROTOMI-01" required :maxLength="30" />
          <CustomTextfield v-model="form.namaSet" label="Nama Set" placeholder="mis. Set Laparotomi" required :maxLength="200" />
          <CustomSelect v-model="form.metodeSterilisasiDefault" label="Metode Sterilisasi Default" :options="opsi(metode)" optionValue="value" optionLabel="label" :clearable="false" :showFilter="false" />
          <CustomInputNumber v-model="form.masaBerlakuSterilJam" label="Masa Berlaku Steril (jam)" :min="1" :max="8760" />
          <template v-if="!modeUbah">
            <CustomTextfield v-model="form.kodeSetFisik" label="Kode Set Fisik (opsional)" placeholder="mis. Laparotomi 01" :maxLength="100" />
            <CustomTextfield v-model="form.kodeBarcode" label="Kode Barcode/QR Set Pertama (opsional)" placeholder="mis. CSSD-0001" :maxLength="100" />
          </template>
          <CustomSwitch v-model="form.statusAktif" label="Status" sideLabel="Nonaktif" sideLabelTrue="Aktif" />
        </div>
        <div class="flex items-center justify-between mt-4">
          <h3 class="text-sm font-semibold">Daftar Instrumen</h3>
          <CustomButton icon="PhPlus" label="Baris" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="tambahBarisInstrumen" />
        </div>
        <div v-for="(i, n) in form.instrumen" :key="n" class="grid items-end grid-cols-[1fr_120px_120px_40px] gap-2 mt-2">
          <CustomTextfield v-model="i.namaInstrumen" label="Nama Instrumen" :maxLength="200" />
          <CustomInputNumber v-model="i.jumlah" label="Jumlah" :min="1" />
          <CustomTextfield v-model="i.satuan" label="Satuan" :maxLength="30" />
          <CustomButton icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="hapusBarisInstrumen(n)" />
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

    <!-- Set fisik per master set -->
    <CustomDialog v-model:visible="dialogSetFisik" width="720px">
      <template #header>Set Fisik — {{ masterAktif?.namaSet }}</template>
      <template #body>
        <div v-if="masterAktif" class="flex flex-col gap-3 pt-4">
          <div class="grid items-end grid-cols-[1fr_1fr_120px] gap-2">
            <CustomTextfield v-model="formSetFisik.kodeSetFisik" label="Kode Set Fisik" placeholder="mis. Laparotomi 02" :maxLength="100" />
            <CustomTextfield v-model="formSetFisik.kodeBarcode" label="Kode Barcode/QR" placeholder="mis. CSSD-0002" required :maxLength="100" />
            <CustomButton v-if="boleh('CREATE')" label="Tambah" icon="PhPlus" @click="tambahSetFisik" />
          </div>
          <div v-if="galatSetFisik" class="text-sm text-danger-300">{{ galatSetFisik }}</div>
          <div class="flex justify-end">
            <CustomButton v-if="boleh('CETAK LABEL')" label="Cetak Semua Label" icon="PhTag" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cetakLabel()" />
          </div>
          <NoData v-if="!masterAktif.setFisik?.length" />
          <DataTable v-else :value="masterAktif.setFisik" stripedRows class="text-xs">
            <Column field="kodeSetFisik" header="Kode Set Fisik" headerClass="bg-opensimrs-50" />
            <Column field="kodeBarcode" header="Barcode/QR" headerClass="bg-opensimrs-50" />
            <Column header="Status" headerClass="bg-opensimrs-50">
              <template #body="{ data: d }">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaSetCssd(d.status)?.bg, gayaSetCssd(d.status)?.text]">{{ gayaSetCssd(d.status)?.label }}</span>
              </template>
            </Column>
            <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[100px]">
              <template #body="{ data: d }">
                <CustomButton v-if="boleh('CETAK LABEL')" icon="PhTag" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cetakLabel(d.uuid)" />
              </template>
            </Column>
          </DataTable>
        </div>
      </template>
      <template #footer>
        <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogSetFisik = false" />
      </template>
    </CustomDialog>
  </div>
</template>
