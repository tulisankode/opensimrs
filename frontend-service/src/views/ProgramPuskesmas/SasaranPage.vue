<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  JENIS_SASARAN,
  STATUS_SASARAN,
  cariKelurahanPkm,
  cariPasienPkm,
  daftarSasaranPkm,
  izinPkm,
  opsi,
  ringkasanSasaranPkm,
  simpanSasaranPkm,
  ubahSasaranPkm,
} from "@/stores/programPuskesmas/programPuskesmas";

// Daftar sasaran program (KF-15..KF-17) per jenis/periode/kelurahan, dengan status sudah/belum dilayani,
// serta ringkasan cakupan per kelurahan untuk periode yang sama (dipantau kepala puskesmas).
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinPkm("Sasaran Program", aksi);
const periodeDefault = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const filterJenis = ref("");
const filterPeriode = ref(periodeDefault());
const filterStatus = ref("");
const ringkasan = ref<any[]>([]);

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const [res, rk] = await Promise.all([
      daftarSasaranPkm({ page: page.value, limit: limit.value, jenis_sasaran: filterJenis.value, periode: filterPeriode.value, status: filterStatus.value }),
      ringkasanSasaranPkm(filterPeriode.value),
    ]);
    data.value = res?.payload?.data ?? [];
    total.value = res?.payload?.pagination?.total ?? 0;
    ringkasan.value = rk?.payload ?? [];
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

// ── Dialog tambah sasaran
const dialog = ref(false);
const kataPasien = ref("");
const hasilPasien = ref<any[]>([]);
const pasien = ref<any>(null);
const kataKelurahan = ref("");
const hasilKelurahan = ref<any[]>([]);
const form = ref({ jenisSasaran: "ibu_hamil", kelurahanCode: "", periode: periodeDefault(), keterangan: "" });
const galat = ref("");
const buka = () => {
  kataPasien.value = "";
  hasilPasien.value = [];
  pasien.value = null;
  kataKelurahan.value = "";
  hasilKelurahan.value = [];
  form.value = { jenisSasaran: "ibu_hamil", kelurahanCode: "", periode: periodeDefault(), keterangan: "" };
  galat.value = "";
  dialog.value = true;
};
const cariPasien = async () => {
  const res = await cariPasienPkm(kataPasien.value);
  hasilPasien.value = res?.payload ?? [];
};
const cariKelurahan = async () => {
  const res = await cariKelurahanPkm(kataKelurahan.value);
  hasilKelurahan.value = res?.payload ?? [];
};
const simpan = async () => {
  galat.value = "";
  if (!form.value.kelurahanCode) return (galat.value = "Pilih kelurahan sasaran");
  if (!/^\d{4}-\d{2}$/.test(form.value.periode)) return (galat.value = "Periode harus format YYYY-MM");
  storeUtils.setLoading(true);
  try {
    const res = await simpanSasaranPkm({
      jenisSasaran: form.value.jenisSasaran,
      patientUuid: pasien.value?.uuid ?? null,
      kelurahanCode: form.value.kelurahanCode,
      periode: form.value.periode,
      keterangan: form.value.keterangan || null,
    });
    if (res?.payload) {
      dialog.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

const tandaiDilayani = async (baris: any) => {
  const res = await ubahSasaranPkm(baris.uuid, { status: baris.status === "sudah_dilayani" ? "belum_dilayani" : "sudah_dilayani" });
  if (res?.payload) muat();
};

onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden gap-3">
    <Card v-if="ringkasan.length" pt:content:class="p-4">
      <template #content>
        <div class="mb-2 text-sm font-semibold">Ringkasan Cakupan — Periode {{ filterPeriode }}</div>
        <div class="flex flex-wrap gap-3">
          <div v-for="r in ringkasan" :key="`${r.kelurahanCode}-${r.jenisSasaran}`" class="px-3 py-2 text-xs rounded-lg bg-opensimrs-50">
            <b>{{ r.namaKelurahan }}</b> · {{ JENIS_SASARAN[r.jenisSasaran] ?? r.jenisSasaran }}: {{ r.jumlahDilayani }}/{{ r.jumlahSasaran }} dilayani
          </div>
        </div>
      </template>
    </Card>
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Sasaran Program</h1>
          <CustomSelect v-model="filterJenis" label="Jenis Sasaran" :options="opsi(JENIS_SASARAN)" optionValue="value" optionLabel="label" placeHolder="Semua" :showFilter="false" />
          <CustomTextfield v-model="filterPeriode" label="Periode (YYYY-MM)" placeholder="2026-01" :maxLength="7" />
          <CustomSelect v-model="filterStatus" label="Status" :options="opsi(STATUS_SASARAN)" optionValue="value" optionLabel="label" placeHolder="Semua" :showFilter="false" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Sasaran" @click="buka" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 50rem">
          <Column header="No." headerClass="bg-opensimrs-50" class="w-[50px]">
            <template #body="{ index }">{{ (page - 1) * limit + index + 1 }}</template>
          </Column>
          <Column header="Jenis Sasaran" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ JENIS_SASARAN[d.jenisSasaran] ?? d.jenisSasaran }}</template>
          </Column>
          <Column header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.namaPasien ? `${d.namaPasien} · ${d.noRm}` : "-" }}</template>
          </Column>
          <Column header="Kelurahan" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.namaKelurahan }}</template>
          </Column>
          <Column header="Periode" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.periode }}</template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-xs font-semibold" :class="d.status === 'sudah_dilayani' ? 'bg-mint-50 text-mint-400' : 'bg-danger-50 text-danger-300'">
                {{ STATUS_SASARAN[d.status] ?? d.status }}
              </span>
            </template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[140px]">
            <template #body="{ data: d }">
              <CustomButton
                v-if="boleh('UPDATE')"
                :label="d.status === 'sudah_dilayani' ? 'Tandai Belum' : 'Tandai Dilayani'"
                size="small"
                outlined
                borderColor="border-opensimrs-300"
                textColor="text-opensimrs-300"
                @click="tandaiDilayani(d)"
              />
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

    <CustomDialog v-model:visible="dialog" width="640px">
      <template #header>Tambah Sasaran Program</template>
      <template #body>
        <div class="flex flex-col gap-4 pt-4">
          <div class="grid grid-cols-2 gap-4">
            <CustomSelect v-model="form.jenisSasaran" label="Jenis Sasaran" :options="opsi(JENIS_SASARAN)" optionValue="value" optionLabel="label" :clearable="false" :showFilter="false" />
            <CustomTextfield v-model="form.periode" label="Periode (YYYY-MM)" placeholder="2026-01" :maxLength="7" required />
          </div>
          <div>
            <div class="mb-1 text-sm font-semibold">Kelurahan</div>
            <div v-if="hasilKelurahan.find((k) => k.code === form.kelurahanCode)" class="flex items-center justify-between p-3 rounded-lg bg-opensimrs-50">
              <span class="text-sm">{{ hasilKelurahan.find((k) => k.code === form.kelurahanCode)?.name }}</span>
              <CustomButton label="Ganti" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="form.kelurahanCode = ''" />
            </div>
            <div v-else class="flex flex-col gap-2">
              <div class="flex gap-2">
                <InputText v-model="kataKelurahan" placeholder="Cari nama kelurahan" class="text-sm grow" @keydown.enter="cariKelurahan" />
                <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariKelurahan" />
              </div>
              <div v-if="hasilKelurahan.length" class="overflow-auto border rounded-lg max-h-[140px] border-grey-75">
                <div v-for="k in hasilKelurahan" :key="k.code" class="px-3 py-2 text-sm border-b cursor-pointer border-grey-75 hover:bg-opensimrs-50" @click="form.kelurahanCode = k.code">
                  {{ k.name }}
                </div>
              </div>
            </div>
          </div>
          <div>
            <div class="mb-1 text-sm font-semibold">Pasien (opsional — kosongkan untuk sasaran agregat)</div>
            <div v-if="pasien" class="flex items-center justify-between p-3 rounded-lg bg-opensimrs-50">
              <span class="text-sm"><b>{{ pasien.name }}</b> · {{ pasien.noRm }}</span>
              <CustomButton label="Ganti" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="pasien = null" />
            </div>
            <div v-else class="flex gap-2">
              <InputText v-model="kataPasien" placeholder="Cari nama / No. RM pasien" class="text-sm grow" @keydown.enter="cariPasien" />
              <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariPasien" />
            </div>
            <div v-if="!pasien && hasilPasien.length" class="overflow-auto border rounded-lg max-h-[140px] border-grey-75 mt-2">
              <div v-for="p in hasilPasien" :key="p.uuid" class="px-3 py-2 text-sm border-b cursor-pointer border-grey-75 hover:bg-opensimrs-50" @click="pasien = p">
                <b>{{ p.name }}</b> · {{ p.noRm }}
              </div>
            </div>
          </div>
          <CustomTextfield v-model="form.keterangan" label="Keterangan (opsional)" />
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
  </div>
</template>
