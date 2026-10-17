<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  NOMOR_KUNJUNGAN_ANC,
  cariPasienPkm,
  daftarKunjunganPasienPkm,
  daftarPersalinanPkm,
  izinPkm,
  kohortIbuPkm,
  riwayatAncPkm,
  simpanAncPkm,
  simpanNifasPkm,
  simpanPersalinanPkm,
  waktuPkm,
} from "@/stores/programPuskesmas/programPuskesmas";

// Kohort ibu diturunkan dari pelayanan ANC/persalinan yang tersimpan (bukan form terpisah). Halaman ini
// menampilkan kohort dan menyediakan tiga pintu pencatatan pelayanan: ANC, Persalinan, dan Nifas.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinPkm("KIA", aksi);

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await kohortIbuPkm({ page: page.value, limit: limit.value, cari: cari.value });
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

// ── Pencarian pasien (dipakai ketiga dialog)
const buatPencarianPasien = () => {
  const kata = ref("");
  const hasil = ref<any[]>([]);
  const pasien = ref<any>(null);
  const cariPasien = async () => {
    const res = await cariPasienPkm(kata.value);
    hasil.value = res?.payload ?? [];
  };
  return { kata, hasil, pasien, cariPasien };
};

// ── Dialog ANC
const dialogAnc = ref(false);
const pA = buatPencarianPasien();
const kunjunganAnc = ref<any[]>([]);
const riwayatAnc = ref<any[]>([]);
const formAnc = ref({ rawatJalanUuid: "", nomorKunjungan: "", usiaKehamilanMinggu: null as number | null, risikoTinggi: false, catatan: "" });
const galatAnc = ref("");
const bukaAnc = () => {
  Object.assign(pA, buatPencarianPasien());
  kunjunganAnc.value = [];
  riwayatAnc.value = [];
  formAnc.value = { rawatJalanUuid: "", nomorKunjungan: "", usiaKehamilanMinggu: null, risikoTinggi: false, catatan: "" };
  galatAnc.value = "";
  dialogAnc.value = true;
};
const labelKunjungan = (k: any) => `${k.noReg} · ${waktuPkm(k.tanggalPeriksa, true)}`;
const pilihPasienAnc = async (p: any) => {
  pA.pasien.value = p;
  const [kunjungan, riwayat] = await Promise.all([daftarKunjunganPasienPkm(p.uuid, true), riwayatAncPkm(p.uuid)]);
  kunjunganAnc.value = (kunjungan?.payload ?? []).map((k: any) => ({ ...k, label: labelKunjungan(k) }));
  riwayatAnc.value = riwayat?.payload ?? [];
};
const simpanAnc = async () => {
  galatAnc.value = "";
  if (!pA.pasien.value) return (galatAnc.value = "Pilih pasien terlebih dahulu");
  if (!formAnc.value.rawatJalanUuid) return (galatAnc.value = "Pilih kunjungan rawat jalan kebidanan");
  if (!formAnc.value.nomorKunjungan) return (galatAnc.value = "Pilih nomor kunjungan K1–K6");
  storeUtils.setLoading(true);
  try {
    const res = await simpanAncPkm({
      patientUuid: pA.pasien.value.uuid,
      rawatJalanUuid: formAnc.value.rawatJalanUuid,
      nomorKunjungan: formAnc.value.nomorKunjungan,
      usiaKehamilanMinggu: formAnc.value.usiaKehamilanMinggu,
      risikoTinggi: formAnc.value.risikoTinggi,
      hasilPemeriksaan: { catatan: formAnc.value.catatan },
    });
    if (res?.payload) {
      dialogAnc.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Dialog Persalinan
const dialogPersalinan = ref(false);
const pP = buatPencarianPasien();
const kunjunganPersalinan = ref<any[]>([]);
const formPersalinan = ref({ rawatJalanUuid: "", birthDetailUuid: "", catatan: "" });
const galatPersalinan = ref("");
const bukaPersalinan = () => {
  Object.assign(pP, buatPencarianPasien());
  kunjunganPersalinan.value = [];
  formPersalinan.value = { rawatJalanUuid: "", birthDetailUuid: "", catatan: "" };
  galatPersalinan.value = "";
  dialogPersalinan.value = true;
};
const pilihPasienPersalinan = async (p: any) => {
  pP.pasien.value = p;
  const res = await daftarKunjunganPasienPkm(p.uuid, true);
  kunjunganPersalinan.value = (res?.payload ?? []).map((k: any) => ({ ...k, label: labelKunjungan(k) }));
};
const simpanPersalinan = async () => {
  galatPersalinan.value = "";
  if (!pP.pasien.value) return (galatPersalinan.value = "Pilih pasien terlebih dahulu");
  if (!formPersalinan.value.rawatJalanUuid) return (galatPersalinan.value = "Pilih kunjungan rawat jalan kebidanan");
  storeUtils.setLoading(true);
  try {
    const res = await simpanPersalinanPkm({
      patientUuid: pP.pasien.value.uuid,
      rawatJalanUuid: formPersalinan.value.rawatJalanUuid,
      birthDetailUuid: formPersalinan.value.birthDetailUuid || undefined,
      hasilPemeriksaan: { catatan: formPersalinan.value.catatan },
    });
    if (res?.payload) {
      dialogPersalinan.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Dialog Nifas
const dialogNifas = ref(false);
const pN = buatPencarianPasien();
const persalinanNifas = ref<any[]>([]);
const formNifas = ref({ kiaPersalinanUuid: "", kunjunganKe: 1, catatan: "" });
const galatNifas = ref("");
const bukaNifas = () => {
  Object.assign(pN, buatPencarianPasien());
  persalinanNifas.value = [];
  formNifas.value = { kiaPersalinanUuid: "", kunjunganKe: 1, catatan: "" };
  galatNifas.value = "";
  dialogNifas.value = true;
};
const pilihPasienNifas = async (p: any) => {
  pN.pasien.value = p;
  const res = await daftarPersalinanPkm({ patient_uuid: p.uuid, limit: 50 });
  persalinanNifas.value = (res?.payload?.data ?? []).map((r: any) => ({ ...r, label: `Persalinan ${waktuPkm(r.createdAt, true)}` }));
};
const simpanNifas = async () => {
  galatNifas.value = "";
  if (!pN.pasien.value) return (galatNifas.value = "Pilih pasien terlebih dahulu");
  if (!formNifas.value.kiaPersalinanUuid) return (galatNifas.value = "Pilih riwayat persalinan");
  storeUtils.setLoading(true);
  try {
    const res = await simpanNifasPkm({
      patientUuid: pN.pasien.value.uuid,
      kiaPersalinanUuid: formNifas.value.kiaPersalinanUuid,
      kunjunganKe: formNifas.value.kunjunganKe,
      hasilPemeriksaan: { catatan: formNifas.value.catatan },
    });
    if (res?.payload) {
      dialogNifas.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const opsiNomorKunjungan = computed(() => NOMOR_KUNJUNGAN_ANC.map((k) => ({ value: k, label: k })));
onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Kohort Ibu (KIA)</h1>
          <CustomTextfield v-model="cari" label="Cari ibu" prependIcon="PhMagnifyingGlass" placeholder="Nama / No. RM" :maxLength="100" @keydown.enter="cariData" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="ANC" @click="bukaAnc" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Persalinan" @click="bukaPersalinan" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Nifas" @click="bukaNifas" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 50rem">
          <Column header="No." headerClass="bg-opensimrs-50" class="w-[50px]">
            <template #body="{ index }">{{ (page - 1) * limit + index + 1 }}</template>
          </Column>
          <Column header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><b>{{ d.name }}</b> · {{ d.noRm }}</template>
          </Column>
          <Column header="Jumlah ANC" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.jumlahAnc }}</template>
          </Column>
          <Column header="Nomor Kunjungan Tercatat" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ (d.nomorKunjunganTercatat ?? []).join(", ") || "-" }}</template>
          </Column>
          <Column header="Persalinan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.jumlahPersalinan }}</template>
          </Column>
          <Column header="Risiko Tinggi" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span v-if="d.risikoTinggi" class="px-2 py-0.5 text-xs font-semibold rounded-full bg-danger-50 text-danger-300">Risiko Tinggi</span>
              <span v-else class="text-grey-300">-</span>
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

    <!-- Dialog ANC -->
    <CustomDialog v-model:visible="dialogAnc" width="720px">
      <template #header>Catat Pelayanan ANC</template>
      <template #body>
        <div class="flex flex-col gap-4 pt-4">
          <div>
            <div class="mb-1 text-sm font-semibold">Pasien</div>
            <div v-if="pA.pasien.value" class="flex items-center justify-between p-3 rounded-lg bg-opensimrs-50">
              <div class="text-sm"><b>{{ pA.pasien.value.name }}</b> · {{ pA.pasien.value.noRm }}</div>
              <CustomButton label="Ganti" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="pA.pasien.value = null" />
            </div>
            <div v-else class="flex flex-col gap-2">
              <div class="flex gap-2">
                <InputText v-model="pA.kata.value" placeholder="Cari nama / No. RM / NIK pasien terdaftar" class="text-sm grow" @keydown.enter="pA.cariPasien" />
                <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="pA.cariPasien" />
              </div>
              <div v-if="pA.hasil.value.length" class="overflow-auto border rounded-lg max-h-[160px] border-grey-75">
                <div v-for="p in pA.hasil.value" :key="p.uuid" class="flex justify-between px-3 py-2 text-sm border-b cursor-pointer border-grey-75 hover:bg-opensimrs-50" @click="pilihPasienAnc(p)">
                  <span><b>{{ p.name }}</b> · {{ p.noRm }}</span>
                </div>
              </div>
            </div>
          </div>
          <div v-if="riwayatAnc.length" class="text-xs text-grey-400">
            Riwayat K1–K6: {{ riwayatAnc.map((r) => `${r.nomorKunjungan} (${waktuPkm(r.createdAt, true)})`).join(", ") }}
          </div>
          <div v-if="pA.pasien.value" class="grid grid-cols-2 gap-4">
            <CustomSelect
              v-model="formAnc.rawatJalanUuid"
              label="Kunjungan Rawat Jalan Kebidanan"
              :options="kunjunganAnc"
              optionValue="uuid"
              optionLabel="label"
              :clearable="false"
              class="col-span-2"
            />
            <CustomSelect v-model="formAnc.nomorKunjungan" label="Nomor Kunjungan" :options="opsiNomorKunjungan" optionValue="value" optionLabel="label" :clearable="false" :showFilter="false" />
            <CustomTextfield v-model.number="formAnc.usiaKehamilanMinggu" label="Usia Kehamilan (minggu)" type="number" />
            <CustomSwitch v-model="formAnc.risikoTinggi" label="Risiko Tinggi" sideLabel="Tidak" sideLabelTrue="Ya" />
            <CustomTextArea v-model="formAnc.catatan" label="Hasil Pemeriksaan (catatan)" class="col-span-2" />
          </div>
          <div v-if="galatAnc" class="text-sm text-danger-300">{{ galatAnc }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogAnc = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanAnc" />
        </div>
      </template>
    </CustomDialog>

    <!-- Dialog Persalinan -->
    <CustomDialog v-model:visible="dialogPersalinan" width="640px">
      <template #header>Catat Pelayanan Persalinan</template>
      <template #body>
        <div class="flex flex-col gap-4 pt-4">
          <div>
            <div class="mb-1 text-sm font-semibold">Pasien</div>
            <div v-if="pP.pasien.value" class="flex items-center justify-between p-3 rounded-lg bg-opensimrs-50">
              <div class="text-sm"><b>{{ pP.pasien.value.name }}</b> · {{ pP.pasien.value.noRm }}</div>
              <CustomButton label="Ganti" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="pP.pasien.value = null" />
            </div>
            <div v-else class="flex flex-col gap-2">
              <div class="flex gap-2">
                <InputText v-model="pP.kata.value" placeholder="Cari nama / No. RM / NIK pasien terdaftar" class="text-sm grow" @keydown.enter="pP.cariPasien" />
                <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="pP.cariPasien" />
              </div>
              <div v-if="pP.hasil.value.length" class="overflow-auto border rounded-lg max-h-[160px] border-grey-75">
                <div v-for="p in pP.hasil.value" :key="p.uuid" class="flex justify-between px-3 py-2 text-sm border-b cursor-pointer border-grey-75 hover:bg-opensimrs-50" @click="pilihPasienPersalinan(p)">
                  <span><b>{{ p.name }}</b> · {{ p.noRm }}</span>
                </div>
              </div>
            </div>
          </div>
          <div v-if="pP.pasien.value" class="grid grid-cols-2 gap-4">
            <CustomSelect
              v-model="formPersalinan.rawatJalanUuid"
              label="Kunjungan Rawat Jalan Kebidanan"
              :options="kunjunganPersalinan"
              optionValue="uuid"
              optionLabel="label"
              :clearable="false"
              class="col-span-2"
            />
            <CustomTextfield v-model="formPersalinan.birthDetailUuid" label="UUID Data Kelahiran (opsional)" placeholder="Bila sudah tercatat di Rawat Inap/IGD" class="col-span-2" />
            <CustomTextArea v-model="formPersalinan.catatan" label="Hasil Pemeriksaan (catatan)" class="col-span-2" />
          </div>
          <div v-if="galatPersalinan" class="text-sm text-danger-300">{{ galatPersalinan }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogPersalinan = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanPersalinan" />
        </div>
      </template>
    </CustomDialog>

    <!-- Dialog Nifas -->
    <CustomDialog v-model:visible="dialogNifas" width="640px">
      <template #header>Catat Pelayanan Nifas</template>
      <template #body>
        <div class="flex flex-col gap-4 pt-4">
          <div>
            <div class="mb-1 text-sm font-semibold">Pasien</div>
            <div v-if="pN.pasien.value" class="flex items-center justify-between p-3 rounded-lg bg-opensimrs-50">
              <div class="text-sm"><b>{{ pN.pasien.value.name }}</b> · {{ pN.pasien.value.noRm }}</div>
              <CustomButton label="Ganti" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="pN.pasien.value = null" />
            </div>
            <div v-else class="flex flex-col gap-2">
              <div class="flex gap-2">
                <InputText v-model="pN.kata.value" placeholder="Cari nama / No. RM / NIK pasien terdaftar" class="text-sm grow" @keydown.enter="pN.cariPasien" />
                <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="pN.cariPasien" />
              </div>
              <div v-if="pN.hasil.value.length" class="overflow-auto border rounded-lg max-h-[160px] border-grey-75">
                <div v-for="p in pN.hasil.value" :key="p.uuid" class="flex justify-between px-3 py-2 text-sm border-b cursor-pointer border-grey-75 hover:bg-opensimrs-50" @click="pilihPasienNifas(p)">
                  <span><b>{{ p.name }}</b> · {{ p.noRm }}</span>
                </div>
              </div>
            </div>
          </div>
          <div v-if="pN.pasien.value" class="grid grid-cols-2 gap-4">
            <CustomSelect
              v-if="persalinanNifas.length"
              v-model="formNifas.kiaPersalinanUuid"
              label="Riwayat Persalinan"
              :options="persalinanNifas"
              optionValue="uuid"
              optionLabel="label"
              :clearable="false"
              class="col-span-2"
            />
            <div v-else class="col-span-2 text-sm text-grey-400">Pasien ini belum memiliki catatan persalinan.</div>
            <CustomTextfield v-model.number="formNifas.kunjunganKe" label="Kunjungan Nifas Ke-" type="number" />
            <CustomTextArea v-model="formNifas.catatan" label="Hasil Pemeriksaan (catatan)" class="col-span-2" />
          </div>
          <div v-if="galatNifas" class="text-sm text-danger-300">{{ galatNifas }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogNifas = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanNifas" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
