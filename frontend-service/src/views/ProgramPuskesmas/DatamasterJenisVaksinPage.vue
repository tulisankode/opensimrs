<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomSwitch from "@/components/Base/CustomSwitch.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { KELOMPOK_SASARAN_VAKSIN, daftarJenisVaksinPkm, hapusJenisVaksinPkm, izinPkm, opsi, simpanJenisVaksinPkm } from "@/stores/programPuskesmas/programPuskesmas";

// Datamaster Jenis Vaksin & Jadwal: urutan dosis dan penanda "wajib dasar lengkap" dipakai menentukan status
// imunisasi dasar lengkap serta jadwal berikutnya (KF-11/KF-12). Jadwal Kemenkes resmi perlu dikonfirmasi
// tenaga klinis sebelum dipakai sebagai acuan final (lihat dokumen desain bagian 9).
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinPkm("Datamaster", aksi, "Jenis Vaksin & Jadwal");

const data = ref<any[]>([]);
const filterKelompok = ref<string[]>([]);
const toggle = (nilai: string) => {
  filterKelompok.value = filterKelompok.value.includes(nilai) ? filterKelompok.value.filter((x) => x !== nilai) : [...filterKelompok.value, nilai];
  muat();
};

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarJenisVaksinPkm({ kelompok_sasaran: filterKelompok.value[0] });
    data.value = res?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};

const dialog = ref(false);
const kosong = () => ({ uuid: "", kode: "", nama: "", kelompokSasaran: "bayi", urutanDosis: 1, intervalMinimalHari: null as number | null, usiaMinimalHari: null as number | null, wajibDasarLengkap: false, status: true });
const form = ref(kosong());
const galat = ref("");
const modeUbah = computed(() => !!form.value.uuid);
const buka = (baris?: any) => {
  galat.value = "";
  form.value = baris ? { ...kosong(), ...baris } : kosong();
  dialog.value = true;
};
const simpan = async () => {
  const f = form.value;
  if (!f.kode?.trim() || !f.nama?.trim()) return (galat.value = "Kode dan nama vaksin wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await simpanJenisVaksinPkm(
      {
        kode: f.kode,
        nama: f.nama,
        kelompokSasaran: f.kelompokSasaran,
        urutanDosis: f.urutanDosis,
        intervalMinimalHari: f.intervalMinimalHari,
        usiaMinimalHari: f.usiaMinimalHari,
        wajibDasarLengkap: f.wajibDasarLengkap,
        status: f.status,
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

const dialogHapus = ref(false);
const akanDihapus = ref<any>(null);
const konfirmasiHapus = (baris: any) => {
  akanDihapus.value = baris;
  dialogHapus.value = true;
};
const hapus = async () => {
  if (!akanDihapus.value) return;
  const res = await hapusJenisVaksinPkm(akanDihapus.value.uuid);
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
          <h1 class="toolbar-heading text-opensimrs-300">Jenis Vaksin & Jadwal</h1>
          <ToolbarFilterMenu :count="filterKelompok.length">
            <template #label>Kelompok Sasaran</template>
            <CustomChip
              v-for="(nama, kode) in KELOMPOK_SASARAN_VAKSIN"
              :key="kode"
              :label="nama"
              :value="String(kode)"
              :isSelected="filterKelompok.includes(String(kode))"
              @selected="toggle(String(kode))"
            />
          </ToolbarFilterMenu>
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Jenis Vaksin" @click="buka()" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 50rem">
          <Column field="kode" header="Kode" headerClass="bg-opensimrs-50" />
          <Column header="Nama Vaksin" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><b>{{ d.nama }}</b></template>
          </Column>
          <Column header="Kelompok Sasaran" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ KELOMPOK_SASARAN_VAKSIN[d.kelompokSasaran] ?? d.kelompokSasaran }}</template>
          </Column>
          <Column header="Urutan Dosis" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.urutanDosis }}</template>
          </Column>
          <Column header="Interval Minimal (hari)" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.intervalMinimalHari ?? "-" }}</template>
          </Column>
          <Column header="Wajib Dasar Lengkap" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.wajibDasarLengkap ? "Ya" : "Tidak" }}</template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span :class="d.status ? 'text-mint-400' : 'text-grey-300'">{{ d.status ? "Aktif" : "Nonaktif" }}</span>
            </template>
          </Column>
          <Column header="Aksi" headerClass="bg-opensimrs-50" class="w-[110px]">
            <template #body="{ data: d }">
              <div class="flex gap-2">
                <CustomButton v-if="boleh('UPDATE')" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="buka(d)" />
                <CustomButton v-if="boleh('DELETE')" icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="konfirmasiHapus(d)" />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialog" width="640px">
      <template #header>{{ modeUbah ? "Ubah" : "Tambah" }} Jenis Vaksin</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomTextfield v-model="form.kode" label="Kode" placeholder="mis. bcg" required :maxLength="30" :disabled="modeUbah" />
          <CustomTextfield v-model="form.nama" label="Nama Vaksin" placeholder="mis. BCG" required :maxLength="150" />
          <CustomSelect v-model="form.kelompokSasaran" label="Kelompok Sasaran" :options="opsi(KELOMPOK_SASARAN_VAKSIN)" optionValue="value" optionLabel="label" :clearable="false" :showFilter="false" />
          <CustomTextfield v-model.number="form.urutanDosis" label="Urutan Dosis" type="number" />
          <CustomTextfield v-model.number="form.intervalMinimalHari" label="Interval Minimal (hari, opsional)" type="number" />
          <CustomTextfield v-model.number="form.usiaMinimalHari" label="Usia Minimal (hari, opsional)" type="number" />
          <CustomSwitch v-model="form.wajibDasarLengkap" label="Termasuk Imunisasi Dasar Lengkap" sideLabel="Tidak" sideLabelTrue="Ya" />
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
      <template #header>Hapus Jenis Vaksin</template>
      <template #body>
        <div class="pt-4 text-normal">Hapus jenis vaksin <b>{{ akanDihapus?.nama }}</b>?</div>
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
