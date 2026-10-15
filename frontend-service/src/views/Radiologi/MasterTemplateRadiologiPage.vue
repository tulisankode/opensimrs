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
  MODALITAS_RAD,
  OPSI_MODALITAS,
  daftarPemeriksaanRad,
  daftarTemplateRad,
  hapusTemplateRad,
  simpanTemplateRad,
} from "@/stores/penunjang/radiologi";

// Datamaster Template Expertise: kalimat baku / bacaan normal (hasil + kesan) per pemeriksaan atau per modalitas.
// Dipilih dokter radiologi pada dialog expertise lalu disunting sesuai temuan.
const storeUtils = utilsStore();

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");
const filterModalitas = ref<string[]>([]);
const pemeriksaan = ref<any[]>([]);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarTemplateRad({ page: page.value, limit: limit.value, cari: cari.value, modalitas: filterModalitas.value });
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
const pilihModalitas = (kode: string) => {
  filterModalitas.value = filterModalitas.value.includes(kode) ? filterModalitas.value.filter((m) => m !== kode) : [...filterModalitas.value, kode];
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

// ── Form
const dialog = ref(false);
const kosong = () => ({ uuid: "", nama: "", lingkup: "pemeriksaan", pemeriksaanUuid: "", modalitas: "", hasil: "", kesan: "", status: true });
const form = ref(kosong());
const galat = ref("");
const modeUbah = computed(() => !!form.value.uuid);
const opsiPemeriksaan = computed(() => pemeriksaan.value.map((p) => ({ value: p.uuid, label: `${p.kode} — ${p.nama}` })));
const LINGKUP = [
  { value: "pemeriksaan", label: "Satu pemeriksaan" },
  { value: "modalitas", label: "Semua pemeriksaan satu modalitas" },
  { value: "umum", label: "Umum (semua pemeriksaan)" },
];
const buka = async (baris?: any) => {
  galat.value = "";
  if (!pemeriksaan.value.length) pemeriksaan.value = (await daftarPemeriksaanRad({ limit: 9999, status: "aktif" }))?.payload?.data ?? [];
  form.value = baris
    ? {
        ...kosong(),
        ...baris,
        lingkup: baris.pemeriksaanUuid ? "pemeriksaan" : baris.modalitas ? "modalitas" : "umum",
        pemeriksaanUuid: baris.pemeriksaanUuid ?? "",
        modalitas: baris.modalitas ?? "",
      }
    : kosong();
  dialog.value = true;
};
const simpan = async () => {
  const f = form.value;
  galat.value = "";
  if (!f.nama.trim() || !f.hasil.trim() || !f.kesan.trim()) return (galat.value = "Nama, hasil, dan kesan wajib diisi");
  if (f.lingkup === "pemeriksaan" && !f.pemeriksaanUuid) return (galat.value = "Pilih pemeriksaan");
  if (f.lingkup === "modalitas" && !f.modalitas) return (galat.value = "Pilih modalitas");
  storeUtils.setLoading(true);
  try {
    const res = await simpanTemplateRad(
      {
        nama: f.nama,
        pemeriksaanUuid: f.lingkup === "pemeriksaan" ? f.pemeriksaanUuid : null,
        modalitas: f.lingkup === "modalitas" ? f.modalitas : null,
        hasil: f.hasil,
        kesan: f.kesan,
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
  if (akanDihapus.value && (await hapusTemplateRad(akanDihapus.value.uuid))) {
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
          <h1 class="toolbar-heading text-opensimrs-300">Template Expertise</h1>
          <CustomTextfield v-model="cari" label="Cari template" prependIcon="PhMagnifyingGlass" placeholder="Nama / pemeriksaan / kesan" :maxLength="100" @keydown.enter="cariData" />
          <ToolbarFilterMenu :count="filterModalitas.length">
            <template #label>Modalitas</template>
            <CustomChip
              v-for="(nama, kode) in MODALITAS_RAD"
              :key="kode"
              :label="`${kode} — ${nama}`"
              :value="String(kode)"
              :isSelected="filterModalitas.includes(String(kode))"
              @selected="pilihModalitas"
            />
          </ToolbarFilterMenu>
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton icon="PhPlus" label="Template" @click="buka()" />
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
              <span v-else-if="d.modalitas">Semua {{ MODALITAS_RAD[d.modalitas] ?? d.modalitas }}</span>
              <span v-else class="text-grey-400">Umum</span>
            </template>
          </Column>
          <Column header="Kesan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><div class="max-w-[360px]">{{ d.kesan }}</div></template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span :class="d.status ? 'text-mint-400' : 'text-grey-300'">{{ d.status ? "Aktif" : "Nonaktif" }}</span>
            </template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[110px]">
            <template #body="{ data: d }">
              <div class="flex gap-2">
                <CustomButton icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="buka(d)" />
                <CustomButton icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="(akanDihapus = d), (dialogHapus = true)" />
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

    <CustomDialog v-model:visible="dialog" width="820px">
      <template #header>{{ modeUbah ? "Ubah" : "Tambah" }} Template Expertise</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomTextfield v-model="form.nama" label="Nama Template" placeholder="mis. Thorax PA — Normal" required class="col-span-2" :maxLength="200" />
          <CustomSelect v-model="form.lingkup" label="Berlaku untuk" :options="LINGKUP" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
          <CustomSelect
            v-if="form.lingkup === 'pemeriksaan'"
            v-model="form.pemeriksaanUuid"
            label="Pemeriksaan"
            placeHolder="Pilih pemeriksaan"
            :options="opsiPemeriksaan"
            optionValue="value"
            optionLabel="label"
            required
          />
          <CustomSelect
            v-else-if="form.lingkup === 'modalitas'"
            v-model="form.modalitas"
            label="Modalitas"
            :options="OPSI_MODALITAS"
            optionValue="value"
            optionLabel="label"
            required
          />
          <div v-else />
          <CustomTextArea v-model="form.hasil" label="Hasil / Uraian" placeholder="Uraian temuan normal; gunakan ... untuk isian ukuran" height="h-56" required class="col-span-2" />
          <CustomTextArea v-model="form.kesan" label="Kesan" placeholder="Kesimpulan" height="h-16" required class="col-span-2" />
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
        <div class="pt-4 text-normal">Hapus template <b>{{ akanDihapus?.nama }}</b>? Hasil expertise yang sudah tersimpan tidak berubah.</div>
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
