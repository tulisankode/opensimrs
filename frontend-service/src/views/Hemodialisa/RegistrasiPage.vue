<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { JENIS_HD, cariPasien, daftarRegistrasi, izinHd, nonaktifRegistrasi, opsi, simpanRegistrasi } from "@/stores/penunjang/hemodialisa";

// Registrasi pasien HD akut/kronis (KF-1): satu registrasi aktif per pasien, kunjungan bawaan (No. Reg) opsional untuk
// penjamin & tagihan. Faskes selalu dari sesi login.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinHd("Registrasi & Jadwal", aksi);
const CARA_BAYAR = [{ value: 1, label: "Umum / pribadi" }, { value: 2, label: "Penjamin / asuransi" }];

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");
const status = ref("aktif");

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarRegistrasi({ page: page.value, limit: limit.value, cari: cari.value.trim(), status: status.value });
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
const form = ref<any>({});
const kataPasien = ref("");
const hasilPasien = ref<any[]>([]);
const galat = ref("");
const buka = (r: any = null) => {
  galat.value = "";
  kataPasien.value = "";
  hasilPasien.value = [];
  form.value = r
    ? { uuid: r.uuid, patientUuid: r.patientUuid, namaPasien: r.namaPasien, jenis: r.jenis, noReg: r.noReg ?? "", paymentMethod: r.paymentMethod ?? 1, catatan: r.catatan ?? "" }
    : { uuid: null, patientUuid: "", jenis: "kronis", noReg: "", paymentMethod: 1, catatan: "" };
  dialog.value = true;
};
const cariDataPasien = async () => {
  if (kataPasien.value.trim().length < 2) return;
  const res = await cariPasien(kataPasien.value.trim());
  hasilPasien.value = (res?.payload ?? []).map((p: any) => ({ ...p, label: `${p.nama} · ${p.noRm}${p.registrasiAktifUuid ? " (sudah terdaftar HD)" : ""}` }));
};
const simpan = async () => {
  const f = form.value;
  galat.value = "";
  if (!f.uuid && !f.patientUuid) return (galat.value = "Pilih pasien terlebih dahulu");
  const res = await simpanRegistrasi(
    f.uuid
      ? { jenis: f.jenis, noReg: f.noReg.trim() || undefined, paymentMethod: f.paymentMethod, catatan: f.catatan }
      : { patientUuid: f.patientUuid, jenis: f.jenis, noReg: f.noReg.trim() || undefined, paymentMethod: f.paymentMethod, catatan: f.catatan || undefined },
    f.uuid ?? undefined,
  );
  if (res?.payload) {
    dialog.value = false;
    muat();
  }
};

const dialogNonaktif = ref(false);
const aktif = ref<any>(null);
const alasan = ref("");
const simpanNonaktif = async () => {
  const res = await nonaktifRegistrasi(aktif.value.uuid, alasan.value.trim());
  if (res?.payload) {
    dialogNonaktif.value = false;
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
          <h1 class="toolbar-heading text-opensimrs-300">Registrasi HD</h1>
          <CustomTextfield v-model="cari" label="Cari" placeholder="Nama / No. RM / No. Reg HD" @keyup.enter="(page = 1), muat()" />
          <CustomSelect v-model="status" label="Status" :options="[{ value: 'aktif', label: 'Aktif' }, { value: 'nonaktif', label: 'Nonaktif' }]" optionValue="value" optionLabel="label" :showFilter="false" placeHolder="Semua" @update:modelValue="(page = 1), muat()" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="(page = 1), muat()" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Registrasi Baru" @click="buka()" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 50rem">
          <Column field="noRegHd" header="No. Reg HD" headerClass="bg-opensimrs-50" />
          <Column header="Pasien" headerClass="bg-opensimrs-50"><template #body="{ data: d }"><div class="font-semibold">{{ d.namaPasien }}</div><div class="text-grey-400">{{ d.noRm }}</div></template></Column>
          <Column header="Jenis" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ JENIS_HD[d.jenis] ?? d.jenis }}</template></Column>
          <Column header="Kunjungan" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.noReg || "-" }}</template></Column>
          <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.status }}<div v-if="d.alasanNonaktif" class="text-grey-400">{{ d.alasanNonaktif }}</div></template></Column>
          <Column header="" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div v-if="d.status === 'aktif'" class="flex gap-2">
                <CustomButton v-if="boleh('UPDATE')" label="Ubah" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="buka(d)" />
                <CustomButton v-if="boleh('BATAL')" label="Nonaktifkan" size="small" outlined borderColor="border-[#B42318]" textColor="text-[#B42318]" @click="(aktif = d), (alasan = ''), (dialogNonaktif = true)" />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end px-5 py-2.5"><CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" /></div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="620px">
      <template #header>{{ form.uuid ? "Ubah Registrasi HD" : "Registrasi HD Baru" }}</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <template v-if="!form.uuid">
            <CustomTextfield v-model="kataPasien" class="col-span-2" label="Cari pasien (nama / No. RM, min. 2 huruf)" @keyup.enter="cariDataPasien" />
            <CustomButton label="Cari Pasien" icon="PhMagnifyingGlass" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cariDataPasien" />
            <CustomSelect v-model="form.patientUuid" label="Pasien" :options="hasilPasien" optionValue="uuid" optionLabel="label" required />
          </template>
          <div v-else class="col-span-2 text-sm font-semibold">{{ form.namaPasien }}</div>
          <CustomSelect v-model="form.jenis" label="Jenis HD" :options="opsi(JENIS_HD)" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
          <CustomSelect v-model="form.paymentMethod" label="Cara bayar (bila tanpa kunjungan)" :options="CARA_BAYAR" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
          <CustomTextfield v-model="form.noReg" class="col-span-2" label="No. Reg kunjungan bawaan (opsional)" placeholder="Penjamin & tagihan mengikuti kunjungan ini" :maxLength="60" />
          <CustomTextfield v-model="form.catatan" class="col-span-2" label="Catatan (opsional)" :maxLength="1000" />
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

    <CustomDialog v-model:visible="dialogNonaktif" width="460px">
      <template #header>Nonaktifkan Registrasi</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4 text-sm">
          <div>{{ aktif?.namaPasien }} ({{ aktif?.noRegHd }}). Jadwal aktif harus dibatalkan terlebih dahulu.</div>
          <CustomTextfield v-model="alasan" label="Alasan" required :maxLength="500" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogNonaktif = false" />
          <CustomButton label="Nonaktifkan" backgroundColor="bg-[#B42318]" :disabled="!alasan.trim()" @click="simpanNonaktif" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
