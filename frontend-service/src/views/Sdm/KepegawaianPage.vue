<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { epochTanggal, tanggalSarpras as tanggalSdm } from "@/stores/penunjang/sarpras";
import {
  JENJANG_PENDIDIKAN,
  STATUS_KEPEGAWAIAN,
  buatKepegawaian,
  calonKepegawaian,
  daftarKepegawaian,
  detailKepegawaian,
  hapusKepegawaian,
  hapusPendidikan,
  izinSdm,
  labelPerubahan,
  lepasAkun,
  referensiSdm,
  simpanPendidikan,
  tautkanAkun,
  ubahKepegawaian,
} from "@/stores/penunjang/sdm";

// Kepegawaian HR / SDM (STD-0035 fase 1): catatan kepegawaian tertaut pegawai aktif Data Master (tanpa membuat identitas
// baru), dengan status, unit kerja, jabatan, golongan, pendidikan, dan riwayat perubahan bertanggal berlaku. Perubahan
// dicatat sebagai potret baru; riwayat lama tidak ditimpa. Data pribadi Data Master (NIK, tanggal lahir) tidak ditampilkan.
const storeUtils = utilsStore();
const router = useRouter();
const boleh = (aksi: string) => izinSdm("Kepegawaian", aksi);
const bolehKredensial = () => izinSdm("Kredensial", "READ");
const opsi = (obj: Record<string, string>) => Object.entries(obj).map(([value, label]) => ({ value, label }));
const OPSI_STATUS = opsi(STATUS_KEPEGAWAIAN);
const OPSI_JENJANG = opsi(JENJANG_PENDIDIKAN);
const OPSI_AKTIF = [
  { value: "1", label: "Masih bekerja" },
  { value: "0", label: "Sudah berakhir" },
];

const referensi = ref<any>({ lokasi: [], fitur: {} });
const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");
const filterUnit = ref("");
const filterStatus = ref("");
const filterAktif = ref("1");

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarKepegawaian({
      page: page.value,
      limit: limit.value,
      cari: cari.value.trim(),
      unitUuid: filterUnit.value,
      statusKepegawaian: filterStatus.value,
      aktif: filterAktif.value,
    });
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

// ── Catat kepegawaian baru (pegawai Data Master yang belum punya catatan)
const dialogBaru = ref(false);
const calon = ref<any[]>([]);
const formBaru = ref<any>({});
const galatBaru = ref("");
const bukaBaru = async () => {
  galatBaru.value = "";
  formBaru.value = { pegawaiUuid: "", statusKepegawaian: "tetap", unitUuid: "", jabatan: "", golongan: "", tanggalMulai: null, nomorSk: "", catatan: "" };
  const r = await calonKepegawaian();
  calon.value = r?.payload ?? [];
  dialogBaru.value = true;
};
const simpanBaru = async () => {
  const f = formBaru.value;
  galatBaru.value = "";
  if (!f.pegawaiUuid || !f.statusKepegawaian || !f.tanggalMulai) return (galatBaru.value = "Pegawai, status kepegawaian, dan tanggal mulai (TMT) wajib diisi");
  storeUtils.setLoading(true);
  try {
    const res = await buatKepegawaian({
      pegawaiUuid: f.pegawaiUuid,
      statusKepegawaian: f.statusKepegawaian,
      unitUuid: f.unitUuid || null,
      jabatan: f.jabatan.trim(),
      golongan: f.golongan.trim(),
      tanggalMulai: epochTanggal(f.tanggalMulai),
      nomorSk: f.nomorSk.trim(),
      catatan: f.catatan.trim(),
    });
    if (res) {
      dialogBaru.value = false;
      await muat();
      if (res.payload?.uuid) bukaDetail(res.payload.uuid);
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Detail
const dialogDetail = ref(false);
const detail = ref<any>(null);
const bukaDetail = async (uuid: string) => {
  const res = await detailKepegawaian(uuid);
  if (res?.payload) {
    detail.value = res.payload;
    dialogDetail.value = true;
  }
};
const muatUlangDetail = async () => {
  await bukaDetail(detail.value.uuid);
  muat();
};

// Perubahan bertanggal berlaku (status/unit/jabatan/golongan), akhiri, aktifkan kembali.
const dialogUbah = ref(false);
const modeUbah = ref<"ubah" | "akhiri" | "aktifkan">("ubah");
const formUbah = ref<any>({});
const galatUbah = ref("");
const bukaUbah = (mode: "ubah" | "akhiri" | "aktifkan") => {
  const d = detail.value;
  modeUbah.value = mode;
  galatUbah.value = "";
  formUbah.value = {
    statusKepegawaian: d.statusKepegawaian,
    unitUuid: d.unitUuid ?? "",
    jabatan: d.jabatan ?? "",
    golongan: d.golongan ?? "",
    tanggal: null,
    nomorSk: "",
    catatan: "",
  };
  dialogUbah.value = true;
};
const simpanUbah = async () => {
  const f = formUbah.value;
  galatUbah.value = "";
  if (!f.tanggal) return (galatUbah.value = modeUbah.value === "akhiri" ? "Tanggal berakhir wajib diisi" : "Tanggal berlaku wajib diisi");
  let isi: Record<string, any>;
  if (modeUbah.value === "akhiri") isi = { tanggalSelesai: epochTanggal(f.tanggal) };
  else {
    isi = {
      statusKepegawaian: f.statusKepegawaian,
      unitUuid: f.unitUuid || null,
      jabatan: f.jabatan.trim() || null,
      golongan: f.golongan.trim() || null,
      tanggalBerlaku: epochTanggal(f.tanggal),
      nomorSk: f.nomorSk.trim(),
      catatan: f.catatan.trim(),
    };
    if (modeUbah.value === "aktifkan") isi.tanggalSelesai = null;
  }
  storeUtils.setLoading(true);
  try {
    if (await ubahKepegawaian(detail.value.uuid, isi)) {
      dialogUbah.value = false;
      await muatUlangDetail();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const hapus = async () => {
  if (!confirm("Hapus catatan kepegawaian ini (koreksi salah input)? Data pegawai di Data Master tidak terhapus.")) return;
  if (await hapusKepegawaian(detail.value.uuid)) {
    dialogDetail.value = false;
    muat();
  }
};

// Pendidikan
const dialogPendidikan = ref(false);
const formPendidikan = ref<any>({});
const galatPendidikan = ref("");
const bukaPendidikan = (p?: any) => {
  galatPendidikan.value = "";
  formPendidikan.value = p
    ? { uuid: p.uuid, jenjang: p.jenjang, institusi: p.institusi ?? "", bidangStudi: p.bidangStudi ?? "", tahunLulus: p.tahunLulus ? String(p.tahunLulus) : "" }
    : { jenjang: "", institusi: "", bidangStudi: "", tahunLulus: "" };
  dialogPendidikan.value = true;
};
const simpanFormPendidikan = async () => {
  const f = formPendidikan.value;
  galatPendidikan.value = "";
  if (!f.jenjang || !f.institusi.trim()) return (galatPendidikan.value = "Jenjang dan institusi wajib diisi");
  if (f.tahunLulus && !/^\d{4}$/.test(f.tahunLulus.trim())) return (galatPendidikan.value = "Tahun lulus harus 4 digit angka");
  const isi = { jenjang: f.jenjang, institusi: f.institusi.trim(), bidangStudi: f.bidangStudi.trim(), tahunLulus: f.tahunLulus.trim() ? Number(f.tahunLulus) : null };
  if (await simpanPendidikan(detail.value.uuid, isi, f.uuid)) {
    dialogPendidikan.value = false;
    await bukaDetail(detail.value.uuid);
  }
};
const hapusFormPendidikan = async (p: any) => {
  if (!confirm(`Hapus riwayat pendidikan ${JENJANG_PENDIDIKAN[p.jenjang] ?? p.jenjang} ${p.institusi}?`)) return;
  if (await hapusPendidikan(detail.value.uuid, p.uuid)) await bukaDetail(detail.value.uuid);
};

// Tautan akun login
const usernameAkun = ref("");
const tautkan = async () => {
  if (!usernameAkun.value.trim()) return alert("Username wajib diisi");
  if (await tautkanAkun(detail.value.uuid, usernameAkun.value.trim())) {
    usernameAkun.value = "";
    await bukaDetail(detail.value.uuid);
  }
};
const lepas = async (a: any) => {
  if (!confirm(`Lepas tautan akun ${a.username}?`)) return;
  if (await lepasAkun(detail.value.uuid, a.uuid)) await bukaDetail(detail.value.uuid);
};
const lihatKredensial = () => {
  dialogDetail.value = false;
  router.push({ path: "/sdm/kredensial", query: { pegawai: detail.value.pegawaiUuid } });
};

onMounted(async () => {
  const r = await referensiSdm();
  if (r?.payload) referensi.value = r.payload;
  muat();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Data Kepegawaian</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nama / jabatan / golongan" :maxLength="100" @keydown.enter="cariData" />
          <CustomSelect v-model="filterUnit" label="Unit Kerja" placeHolder="Semua" :options="referensi.lokasi" optionValue="uuid" optionLabel="nama" @update:modelValue="cariData" />
          <CustomSelect v-model="filterStatus" label="Status" placeHolder="Semua" :options="OPSI_STATUS" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomSelect v-model="filterAktif" label="Keaktifan" placeHolder="Semua" :options="OPSI_AKTIF" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="cariData" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Catat Kepegawaian" @click="bukaBaru" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable v-else :value="data" stripedRows class="text-xs cursor-pointer" scrollable scrollHeight="flex" tableStyle="min-width: 56rem" @rowClick="bukaDetail($event.data.uuid)">
          <Column header="Pegawai" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="font-semibold">{{ d.namaPegawai || "-" }}</span>
              <span v-if="d.pegawaiAktif === false" class="ml-1 text-[10px] text-danger-300">(nonaktif di Data Master)</span>
            </template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ STATUS_KEPEGAWAIAN[d.statusKepegawaian] ?? d.statusKepegawaian }}</template></Column>
          <Column header="Unit Kerja" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.namaUnit || "-" }}</template></Column>
          <Column header="Jabatan" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.jabatan || "-" }}</template></Column>
          <Column header="Golongan" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.golongan || "-" }}</template></Column>
          <Column header="TMT" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ tanggalSdm(d.tanggalMulai) }}</template></Column>
          <Column header="Berakhir" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.tanggalSelesai ? tanggalSdm(d.tanggalSelesai) : "-" }}</template></Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <!-- Catat kepegawaian baru -->
    <CustomDialog v-model:visible="dialogBaru" width="680px">
      <template #header>Catat Kepegawaian</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomSelect v-model="formBaru.pegawaiUuid" label="Pegawai (Data Master, aktif, belum tercatat)" :options="calon" optionValue="pegawaiUuid" optionLabel="namaPegawai" class="col-span-2" required />
          <div v-if="!calon.length" class="col-span-2 text-xs text-grey-400">Semua pegawai aktif sudah memiliki catatan kepegawaian. Tambahkan pegawai baru di Data Master › Pegawai.</div>
          <CustomSelect v-model="formBaru.statusKepegawaian" label="Status Kepegawaian" :options="OPSI_STATUS" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" required />
          <CustomDatePicker v-model="formBaru.tanggalMulai" label="Tanggal Mulai Tugas (TMT)" />
          <CustomSelect v-model="formBaru.unitUuid" label="Unit Kerja" placeHolder="Belum ditetapkan" :options="referensi.lokasi" optionValue="uuid" optionLabel="nama" />
          <CustomTextfield v-model="formBaru.jabatan" label="Jabatan" :maxLength="150" />
          <CustomTextfield v-model="formBaru.golongan" label="Golongan / Pangkat" :maxLength="50" />
          <CustomTextfield v-model="formBaru.nomorSk" label="Nomor SK (opsional)" :maxLength="100" />
          <CustomTextArea v-model="formBaru.catatan" label="Catatan" class="col-span-2" />
        </div>
        <div v-if="galatBaru" class="mt-3 text-sm text-danger-300">{{ galatBaru }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogBaru = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanBaru" />
        </div>
      </template>
    </CustomDialog>

    <!-- Detail -->
    <CustomDialog v-model:visible="dialogDetail" width="860px">
      <template #header>{{ detail?.namaPegawai }}</template>
      <template #body>
        <div v-if="detail" class="flex flex-col gap-5 pt-4 text-sm">
          <div class="grid grid-cols-2 gap-x-6 gap-y-1">
            <div><span class="text-grey-400">Status:</span> {{ STATUS_KEPEGAWAIAN[detail.statusKepegawaian] ?? detail.statusKepegawaian }}</div>
            <div><span class="text-grey-400">Unit kerja:</span> {{ detail.namaUnit || "-" }}</div>
            <div><span class="text-grey-400">Jabatan:</span> {{ detail.jabatan || "-" }}</div>
            <div><span class="text-grey-400">Golongan:</span> {{ detail.golongan || "-" }}</div>
            <div><span class="text-grey-400">TMT:</span> {{ tanggalSdm(detail.tanggalMulai) }}</div>
            <div>
              <span class="text-grey-400">Berakhir:</span> {{ detail.tanggalSelesai ? tanggalSdm(detail.tanggalSelesai) : "Masih bekerja" }}
            </div>
            <div v-if="detail.pegawaiAktif === false" class="col-span-2 text-danger-300">Pegawai ini berstatus nonaktif di Data Master.</div>
          </div>
          <div class="flex flex-wrap gap-2">
            <template v-if="boleh('UPDATE')">
              <CustomButton v-if="!detail.tanggalSelesai" label="Catat Perubahan" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaUbah('ubah')" />
              <CustomButton v-if="!detail.tanggalSelesai" label="Akhiri Kepegawaian" icon="PhSignOut" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="bukaUbah('akhiri')" />
              <CustomButton v-else label="Aktifkan Kembali" icon="PhArrowCounterClockwise" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaUbah('aktifkan')" />
            </template>
            <CustomButton v-if="bolehKredensial() && referensi.fitur?.sdmKredensial !== false" label="Lihat Kredensial" icon="PhIdentificationCard" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="lihatKredensial" />
            <CustomButton v-if="boleh('DELETE')" label="Hapus" icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="hapus" />
          </div>

          <div>
            <h3 class="mb-1 font-semibold">Riwayat Kepegawaian</h3>
            <DataTable :value="detail.riwayat" class="text-xs" stripedRows>
              <Column header="Berlaku" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ tanggalSdm(r.tanggalMulai) }} – {{ r.tanggalSelesai ? tanggalSdm(r.tanggalSelesai) : "sekarang" }}</template></Column>
              <Column header="Perubahan" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ labelPerubahan(r.jenisPerubahan) }}</template></Column>
              <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ STATUS_KEPEGAWAIAN[r.statusKepegawaian] ?? r.statusKepegawaian ?? "-" }}</template></Column>
              <Column header="Unit" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ r.namaUnit || "-" }}</template></Column>
              <Column header="Jabatan" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ r.jabatan || "-" }}</template></Column>
              <Column header="Golongan" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ r.golongan || "-" }}</template></Column>
              <Column header="SK / Catatan" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ [r.nomorSk, r.catatan].filter(Boolean).join(" · ") || "-" }}</template></Column>
              <Column header="Dicatat" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ r.dicatatOleh || "-" }}</template></Column>
            </DataTable>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <h3 class="font-semibold">Pendidikan</h3>
              <CustomButton v-if="boleh('UPDATE')" label="Tambah" icon="PhPlus" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaPendidikan()" />
            </div>
            <div v-if="!detail.pendidikan.length" class="text-xs text-grey-400">Belum ada riwayat pendidikan.</div>
            <div v-for="p in detail.pendidikan" :key="p.uuid" class="flex items-center justify-between py-1 text-xs border-b border-grey-100">
              <span>
                <span class="font-semibold">{{ JENJANG_PENDIDIKAN[p.jenjang] ?? p.jenjang }}</span> · {{ p.institusi }}<span v-if="p.bidangStudi"> · {{ p.bidangStudi }}</span><span v-if="p.tahunLulus"> · lulus {{ p.tahunLulus }}</span>
              </span>
              <span v-if="boleh('UPDATE')" class="flex gap-2">
                <CustomButton label="Ubah" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaPendidikan(p)" />
                <CustomButton label="Hapus" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="hapusFormPendidikan(p)" />
              </span>
            </div>
          </div>

          <div>
            <h3 class="mb-1 font-semibold">Akun Login Tertaut</h3>
            <div v-if="!detail.akun.length" class="text-xs text-grey-400">Belum ada akun tertaut (dipakai layanan mandiri pegawai pada fase berikutnya).</div>
            <div v-for="a in detail.akun" :key="a.uuid" class="flex items-center justify-between py-1 text-xs border-b border-grey-100">
              <span><span class="font-semibold">{{ a.username }}</span> · ditautkan oleh {{ a.ditautkanOleh || "-" }}</span>
              <CustomButton v-if="boleh('TAUTKAN AKUN')" label="Lepas" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="lepas(a)" />
            </div>
            <div v-if="boleh('TAUTKAN AKUN') && !detail.akun.length" class="flex items-end gap-2 mt-2">
              <CustomTextfield v-model="usernameAkun" label="Username akun (faskes ini)" class="grow" :maxLength="120" />
              <CustomButton label="Tautkan" icon="PhLink" size="small" @click="tautkan" />
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogDetail = false" />
        </div>
      </template>
    </CustomDialog>

    <!-- Perubahan / akhiri / aktifkan kembali -->
    <CustomDialog v-model:visible="dialogUbah" width="640px">
      <template #header>{{ { ubah: "Catat Perubahan Kepegawaian", akhiri: "Akhiri Kepegawaian", aktifkan: "Aktifkan Kembali Kepegawaian" }[modeUbah] }}</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <template v-if="modeUbah !== 'akhiri'">
            <CustomSelect v-model="formUbah.statusKepegawaian" label="Status Kepegawaian" :options="OPSI_STATUS" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
            <CustomSelect v-model="formUbah.unitUuid" label="Unit Kerja" placeHolder="Belum ditetapkan" :options="referensi.lokasi" optionValue="uuid" optionLabel="nama" />
            <CustomTextfield v-model="formUbah.jabatan" label="Jabatan" :maxLength="150" />
            <CustomTextfield v-model="formUbah.golongan" label="Golongan / Pangkat" :maxLength="50" />
            <CustomDatePicker v-model="formUbah.tanggal" label="Tanggal Berlaku" />
            <CustomTextfield v-model="formUbah.nomorSk" label="Nomor SK (opsional)" :maxLength="100" />
            <CustomTextArea v-model="formUbah.catatan" label="Catatan" class="col-span-2" />
            <div class="col-span-2 text-xs text-grey-400">Riwayat sebelumnya ditutup pada tanggal berlaku dan tetap tersimpan; perubahan dicatat sebagai riwayat baru.</div>
          </template>
          <template v-else>
            <CustomDatePicker v-model="formUbah.tanggal" label="Tanggal Berakhir" class="col-span-2" />
            <div class="col-span-2 text-xs text-grey-400">Riwayat terakhir ditutup pada tanggal ini. Data pegawai di Data Master tidak diubah.</div>
          </template>
        </div>
        <div v-if="galatUbah" class="mt-3 text-sm text-danger-300">{{ galatUbah }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogUbah = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanUbah" />
        </div>
      </template>
    </CustomDialog>

    <!-- Pendidikan -->
    <CustomDialog v-model:visible="dialogPendidikan" width="560px">
      <template #header>{{ formPendidikan.uuid ? "Ubah" : "Tambah" }} Riwayat Pendidikan</template>
      <template #body>
        <div class="grid grid-cols-2 gap-4 pt-4">
          <CustomSelect v-model="formPendidikan.jenjang" label="Jenjang" :options="OPSI_JENJANG" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" required />
          <CustomTextfield v-model="formPendidikan.tahunLulus" label="Tahun Lulus" placeholder="mis. 2015" :maxLength="4" />
          <CustomTextfield v-model="formPendidikan.institusi" label="Institusi" :maxLength="255" class="col-span-2" />
          <CustomTextfield v-model="formPendidikan.bidangStudi" label="Bidang Studi" :maxLength="150" class="col-span-2" />
        </div>
        <div v-if="galatPendidikan" class="mt-3 text-sm text-danger-300">{{ galatPendidikan }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogPendidikan = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanFormPendidikan" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
