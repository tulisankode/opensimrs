<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { batalkanPeminjaman, buatPeminjaman, daftarPeminjaman, izinKoding, kembalikanPeminjaman, waktuKoding } from "@/stores/penunjang/koding";

// Peminjaman & pengembalian berkas rekam medis fisik. Satu no_rm hanya boleh punya satu peminjaman aktif.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinKoding("Peminjaman", aksi);

const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cariNoRm = ref("");
const filterStatus = ref("");
const filterJatuhTempo = ref("");

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarPeminjaman({ page: page.value, limit: limit.value, no_rm: cariNoRm.value, status: filterStatus.value, jatuh_tempo: filterJatuhTempo.value });
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
const reset = () => {
  cariNoRm.value = "";
  filterStatus.value = "";
  filterJatuhTempo.value = "";
  cariData();
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};
const terlambat = (d: any) => !d.waktuKembali && Number(d.rencanaKembali) < Math.floor(Date.now() / 1000);

// ── Peminjaman baru
const dialogBaru = ref(false);
const kosongForm = () => ({ noRm: "", peminjam: "", unit: "", keperluan: "", rencanaKembali: new Date(Date.now() + 7 * 86400000) as Date | null, catatan: "" });
const form = ref(kosongForm());
const galat = ref("");
const bukaBaru = () => {
  form.value = kosongForm();
  galat.value = "";
  dialogBaru.value = true;
};
const simpanBaru = async () => {
  galat.value = "";
  if (!form.value.noRm.trim()) return (galat.value = "No. RM wajib diisi");
  if (!form.value.peminjam.trim()) return (galat.value = "Nama peminjam wajib diisi");
  if (!form.value.rencanaKembali) return (galat.value = "Rencana tanggal kembali wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await buatPeminjaman({
      noRm: form.value.noRm.trim(),
      peminjam: form.value.peminjam.trim(),
      unit: form.value.unit.trim() || undefined,
      keperluan: form.value.keperluan.trim() || undefined,
      catatan: form.value.catatan.trim() || undefined,
      rencanaKembali: Math.floor(form.value.rencanaKembali.getTime() / 1000),
    });
    if (res?.payload) {
      dialogBaru.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Pengembalian
const dialogKembali = ref(false);
const dipilih = ref<any>(null);
const kondisiKembali = ref("");
const bukaKembali = (d: any) => {
  dipilih.value = d;
  kondisiKembali.value = "";
  dialogKembali.value = true;
};
const simpanKembali = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await kembalikanPeminjaman(dipilih.value.uuid, { kondisiKembali: kondisiKembali.value || undefined });
    if (res?.payload) {
      dialogKembali.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Pembatalan (koreksi salah catat)
const dialogBatal = ref(false);
const alasanBatal = ref("");
const bukaBatal = (d: any) => {
  dipilih.value = d;
  alasanBatal.value = "";
  dialogBatal.value = true;
};
const simpanBatal = async () => {
  if (!alasanBatal.value.trim()) return;
  storeUtils.setLoading(true);
  try {
    const res = await batalkanPeminjaman(dipilih.value.uuid, alasanBatal.value.trim());
    if (res?.payload) {
      dialogBatal.value = false;
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
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
          <h1 class="toolbar-heading text-opensimrs-300">Peminjaman Berkas Rekam Medis</h1>
          <CustomTextfield v-model="cariNoRm" label="No. RM" prependIcon="PhMagnifyingGlass" placeholder="Cari No. RM" :maxLength="50" @keydown.enter="cariData" />
          <ToolbarFilterMenu :count="filterStatus ? 1 : 0">
            <template #label>Status</template>
            <CustomChip label="Aktif" value="aktif" :isSelected="filterStatus === 'aktif'" @selected="filterStatus = filterStatus === 'aktif' ? '' : 'aktif'" />
            <CustomChip label="Selesai" value="selesai" :isSelected="filterStatus === 'selesai'" @selected="filterStatus = filterStatus === 'selesai' ? '' : 'selesai'" />
          </ToolbarFilterMenu>
          <ToolbarFilterMenu :count="filterJatuhTempo ? 1 : 0">
            <template #label>Tenggat</template>
            <CustomChip label="H-1" value="h1" :isSelected="filterJatuhTempo === 'h1'" @selected="filterJatuhTempo = filterJatuhTempo === 'h1' ? '' : 'h1'" />
            <CustomChip label="Terlambat" value="terlambat" :isSelected="filterJatuhTempo === 'terlambat'" @selected="filterJatuhTempo = filterJatuhTempo === 'terlambat' ? '' : 'terlambat'" />
          </ToolbarFilterMenu>
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="reset" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Peminjaman Baru" @click="bukaBaru" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 64rem">
          <Column header="No. RM" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.noRm }}</div>
              <div v-if="terlambat(d)" class="font-semibold text-danger-300">Terlambat</div>
            </template>
          </Column>
          <Column header="Peminjam" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div>{{ d.peminjam }}</div>
              <div class="text-grey-400">{{ d.unit ?? "-" }} · {{ d.keperluan ?? "-" }}</div>
            </template>
          </Column>
          <Column header="Waktu Pinjam" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ waktuKoding(d.waktuPinjam) }}</template>
          </Column>
          <Column header="Rencana Kembali" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ waktuKoding(d.rencanaKembali, true) }}</template>
          </Column>
          <Column header="Pengembalian" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div v-if="d.waktuKembali">{{ waktuKoding(d.waktuKembali) }}</div>
              <div v-if="d.kondisiKembali" class="text-grey-400">{{ d.kondisiKembali }}</div>
              <span v-if="!d.waktuKembali" class="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#FEF0C7] text-[#B54708]">Masih dipinjam</span>
            </template>
          </Column>
          <Column header="" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="flex gap-2">
                <CustomButton v-if="!d.waktuKembali && boleh('UPDATE')" label="Kembalikan" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaKembali(d)" />
                <CustomButton v-if="boleh('HAPUS')" icon="PhTrash" backgroundColor="bg-danger-300" @click="bukaBatal(d)" />
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

    <CustomDialog v-model:visible="dialogBaru" width="520px">
      <template #header>Peminjaman Berkas Baru</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-3">
          <CustomTextfield v-model="form.noRm" label="No. RM" :maxLength="50" />
          <CustomTextfield v-model="form.peminjam" label="Peminjam" :maxLength="200" />
          <CustomTextfield v-model="form.unit" label="Unit" :maxLength="200" />
          <CustomTextfield v-model="form.keperluan" label="Keperluan" :maxLength="200" />
          <CustomDatePicker v-model="form.rencanaKembali" label="Rencana Tanggal Kembali" showTime />
          <CustomTextArea v-model="form.catatan" label="Catatan (opsional)" />
          <div v-if="galat" class="text-sm text-danger-300">{{ galat }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogBaru = false" />
          <CustomButton label="Simpan" @click="simpanBaru" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogKembali" width="480px">
      <template #header>Pengembalian Berkas {{ dipilih?.noRm }}</template>
      <template #body>
        <CustomTextArea v-model="kondisiKembali" label="Kondisi Kembali (opsional)" class="mt-3" />
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogKembali = false" />
          <CustomButton label="Simpan Pengembalian" @click="simpanKembali" />
        </div>
      </template>
    </CustomDialog>

    <CustomDialog v-model:visible="dialogBatal" width="480px">
      <template #header>Batalkan Peminjaman {{ dipilih?.noRm }}</template>
      <template #body>
        <CustomTextArea v-model="alasanBatal" label="Alasan Pembatalan" class="mt-3" />
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Kembali" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogBatal = false" />
          <CustomButton label="Batalkan" backgroundColor="bg-danger-300" @click="simpanBatal" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
