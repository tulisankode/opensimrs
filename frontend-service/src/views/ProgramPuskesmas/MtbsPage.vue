<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { cariPasienPkm, daftarKunjunganPasienPkm, daftarMtbsPkm, hapusMtbsPkm, izinPkm, simpanMtbsPkm, waktuPkm } from "@/stores/programPuskesmas/programPuskesmas";

// Klasifikasi MTBS (balita 2 bl–5 th) / MTBM (bayi muda <2 bl). Acuan bagan klinis resmi belum ditetapkan
// (lihat dokumen desain bagian 9) — temuan & klasifikasi dicatat bebas untuk ditinjau tenaga klinis, bukan
// algoritme klasifikasi otomatis baku.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinPkm("MTBS/MTBM", aksi);
const JENIS_FORM: Record<string, string> = { mtbs: "MTBS (Balita 2 bl–5 th)", mtbm: "MTBM (Bayi Muda <2 bl)" };
const RINGKASAN: Record<string, string> = { hijau: "Hijau", kuning: "Kuning", merah: "Merah" };

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const filterJenis = ref<string[]>([]);
const cariData = () => {
  page.value = 1;
  muat();
};
const toggle = (nilai: string) => {
  filterJenis.value = filterJenis.value.includes(nilai) ? filterJenis.value.filter((x) => x !== nilai) : [...filterJenis.value, nilai];
  cariData();
};

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarMtbsPkm({ page: page.value, limit: limit.value, jenis_form: filterJenis.value[0] });
    data.value = res?.payload?.data ?? [];
    total.value = res?.payload?.pagination?.total ?? 0;
  } finally {
    storeUtils.setLoading(false);
  }
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};

const dialog = ref(false);
const kataPasien = ref("");
const hasilPasien = ref<any[]>([]);
const pasien = ref<any>(null);
const kunjungan = ref<any[]>([]);
const form = ref({ jenisForm: "mtbs", rawatJalanUuid: "", temuan: "", ringkasan: "hijau" });
const galat = ref("");
const buka = () => {
  kataPasien.value = "";
  hasilPasien.value = [];
  pasien.value = null;
  kunjungan.value = [];
  form.value = { jenisForm: "mtbs", rawatJalanUuid: "", temuan: "", ringkasan: "hijau" };
  galat.value = "";
  dialog.value = true;
};
const cariPasien = async () => {
  const res = await cariPasienPkm(kataPasien.value);
  hasilPasien.value = res?.payload ?? [];
};
const pilihPasien = async (p: any) => {
  pasien.value = p;
  const res = await daftarKunjunganPasienPkm(p.uuid);
  kunjungan.value = (res?.payload ?? []).map((k: any) => ({ ...k, label: `${k.noReg} · ${waktuPkm(k.tanggalPeriksa, true)}` }));
};
const simpan = async () => {
  galat.value = "";
  if (!pasien.value) return (galat.value = "Pilih pasien terlebih dahulu");
  if (!form.value.rawatJalanUuid) return (galat.value = "Pilih kunjungan rawat jalan");
  storeUtils.setLoading(true);
  try {
    const res = await simpanMtbsPkm({
      patientUuid: pasien.value.uuid,
      rawatJalanUuid: form.value.rawatJalanUuid,
      jenisForm: form.value.jenisForm,
      temuan: { catatan: form.value.temuan },
      klasifikasi: { ringkasan: form.value.ringkasan },
    });
    if (res?.payload) {
      dialog.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const dialogHapus = ref(false);
const akanDihapus = ref<any>(null);
const konfirmasiHapus = (baris: any) => {
  akanDihapus.value = baris;
  dialogHapus.value = true;
};
const hapus = async () => {
  if (!akanDihapus.value) return;
  const res = await hapusMtbsPkm(akanDihapus.value.uuid);
  if (res) {
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
          <h1 class="toolbar-heading text-opensimrs-300">MTBS / MTBM</h1>
          <ToolbarFilterMenu :count="filterJenis.length">
            <template #label>Jenis Form</template>
            <CustomChip v-for="(nama, kode) in JENIS_FORM" :key="kode" :label="nama" :value="String(kode)" :isSelected="filterJenis.includes(String(kode))" @selected="toggle(String(kode))" />
          </ToolbarFilterMenu>
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Klasifikasi Baru" @click="buka" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 50rem">
          <Column header="No." headerClass="bg-opensimrs-50" class="w-[50px]">
            <template #body="{ index }">{{ (page - 1) * limit + index + 1 }}</template>
          </Column>
          <Column header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><b>{{ d.namaPasien }}</b> · {{ d.noRm }}</template>
          </Column>
          <Column header="Jenis Form" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ JENIS_FORM[d.jenisForm] ?? d.jenisForm }}</template>
          </Column>
          <Column header="Ringkasan Klasifikasi" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ RINGKASAN[d.klasifikasi?.ringkasan] ?? "-" }}</template>
          </Column>
          <Column header="Tanggal" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ waktuPkm(d.createdAt) }}</template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[70px]">
            <template #body="{ data: d }">
              <CustomButton v-if="boleh('DELETE')" icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="konfirmasiHapus(d)" />
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

    <CustomDialog v-model:visible="dialog" width="680px">
      <template #header>Catat Klasifikasi MTBS/MTBM</template>
      <template #body>
        <div class="flex flex-col gap-4 pt-4">
          <div>
            <div class="mb-1 text-sm font-semibold">Pasien</div>
            <div v-if="pasien" class="flex items-center justify-between p-3 rounded-lg bg-opensimrs-50">
              <div class="text-sm"><b>{{ pasien.name }}</b> · {{ pasien.noRm }}</div>
              <CustomButton label="Ganti" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="pasien = null" />
            </div>
            <div v-else class="flex flex-col gap-2">
              <div class="flex gap-2">
                <InputText v-model="kataPasien" placeholder="Cari nama / No. RM / NIK pasien terdaftar" class="text-sm grow" @keydown.enter="cariPasien" />
                <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariPasien" />
              </div>
              <div v-if="hasilPasien.length" class="overflow-auto border rounded-lg max-h-[160px] border-grey-75">
                <div v-for="p in hasilPasien" :key="p.uuid" class="flex justify-between px-3 py-2 text-sm border-b cursor-pointer border-grey-75 hover:bg-opensimrs-50" @click="pilihPasien(p)">
                  <span><b>{{ p.name }}</b> · {{ p.noRm }}</span>
                </div>
              </div>
            </div>
          </div>
          <div v-if="pasien" class="grid grid-cols-2 gap-4">
            <CustomSelect v-model="form.jenisForm" label="Jenis Form" :options="Object.entries(JENIS_FORM).map(([value, label]) => ({ value, label }))" optionValue="value" optionLabel="label" :clearable="false" :showFilter="false" />
            <CustomSelect v-model="form.rawatJalanUuid" label="Kunjungan Rawat Jalan" :options="kunjungan" optionValue="uuid" optionLabel="label" :clearable="false" />
            <CustomTextArea v-model="form.temuan" label="Temuan" placeholder="Keluhan & hasil pemeriksaan" class="col-span-2" />
            <CustomSelect
              v-model="form.ringkasan"
              label="Ringkasan Klasifikasi"
              :options="Object.entries(RINGKASAN).map(([value, label]) => ({ value, label }))"
              optionValue="value"
              optionLabel="label"
              :clearable="false"
              :showFilter="false"
            />
          </div>
          <div class="text-xs text-grey-400">Klasifikasi akhir perlu ditinjau tenaga klinis sebelum dipakai sebagai keputusan tindak lanjut (bagan MTBS/MTBM resmi belum ditetapkan di sistem).</div>
          <div v-if="galat" class="text-sm text-danger-300">{{ galat }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpan" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogHapus" width="420px" headerBg="bg-danger-300">
      <template #header>Hapus Klasifikasi</template>
      <template #body>
        <div class="pt-4 text-normal">Hapus klasifikasi <b>{{ akanDihapus?.namaPasien }}</b>?</div>
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
