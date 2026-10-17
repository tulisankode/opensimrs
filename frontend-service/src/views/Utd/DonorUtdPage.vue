<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  GOLONGAN_DARAH_UTD,
  JENIS_KELAMIN_UTD,
  RHESUS_UTD,
  STATUS_AKTIF_DONOR_UTD,
  STATUS_SELEKSI_UTD,
  bolehLihatReaktifUtd,
  cetakHtmlUtd,
  daftarDonorUtd,
  detailDonorUtd,
  escHtml,
  gayaDonorUtd,
  gayaKantongUtd,
  gayaSeleksiUtd,
  golonganRhUtd,
  izinUtd,
  keTanggal,
  notifikasiDonorUtd,
  opsi,
  putuskanSeleksiUtd,
  riwayatDonorUtd,
  seleksiDonorUtd,
  simpanDonorUtd,
  tglIsoUtd,
  tglUtd,
  umurUtd,
  waktuUtd,
} from "@/stores/penunjang/utd";

// Rekrutmen & Seleksi Donor: pendaftaran & pencarian donor, kunjungan seleksi (kuesioner + Hb/TD/BB/nadi/suhu) dengan
// keputusan layak/tunda/tolak, riwayat seleksi, serta cetak kartu donor. Interval minimal antar-donor dihitung backend
// (permintaan "layak" dialihkan menjadi "tolak" bila belum cukup). Donor "ditahan" (mis. hasil uji saring) tidak dapat
// diseleksi; alasan & tindak lanjut notifikasi hanya ditampilkan bagi pemilik izin Lihat Hasil Reaktif.
const storeUtils = utilsStore();
const boleh = (aksi: string) => izinUtd("Donor", aksi);
const bolehReaktif = bolehLihatReaktifUtd();

// ── Daftar & filter
const data = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const cari = ref("");
const filterStatus = ref("");

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await daftarDonorUtd({ page: page.value, limit: limit.value, cari: cari.value.trim(), status_aktif: filterStatus.value });
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
  cari.value = "";
  filterStatus.value = "";
  cariData();
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muat();
};
onMounted(muat);

// ── Detail donor + riwayat seleksi
const detail = ref<any>(null);
const riwayat = ref<any[]>([]);
const dialogDetail = ref(false);
const muatDetail = async (uuid: string) => {
  const [d, r] = await Promise.all([detailDonorUtd(uuid), riwayatDonorUtd(uuid, { limit: 50 })]);
  if (d?.payload) detail.value = d.payload;
  riwayat.value = r?.payload?.data ?? [];
  return !!d?.payload;
};
const bukaDetail = async (uuid: string) => {
  storeUtils.setLoading(true);
  try {
    if (await muatDetail(uuid)) dialogDetail.value = true;
  } finally {
    storeUtils.setLoading(false);
  }
};
const ditahan = computed(() => detail.value?.statusAktif === "ditahan");
const perluNotifikasi = computed(() => bolehReaktif && detail.value?.perluNotifikasi && !detail.value?.notifikasiSelesai);
const tekanan = (r: any) => (r.tekananSistolik || r.tekananDiastolik ? `${r.tekananSistolik ?? "-"}/${r.tekananDiastolik ?? "-"}` : "-");

// ── Form donor (baru / ubah)
const dialogForm = ref(false);
const modeUbah = ref(false);
const kosong = () => ({
  nama: "",
  nik: "",
  tanggalLahir: null as Date | null,
  jenisKelamin: "",
  golonganDarah: "",
  rhesus: "",
  telepon: "",
  alamat: "",
});
const form = ref(kosong());
const galatForm = ref("");
const bukaBaru = () => {
  modeUbah.value = false;
  form.value = kosong();
  galatForm.value = "";
  dialogForm.value = true;
};
const bukaUbah = () => {
  const d = detail.value;
  const iso = tglIsoUtd(d.tanggalLahir);
  modeUbah.value = true;
  galatForm.value = "";
  form.value = {
    nama: d.nama ?? "",
    nik: d.nik ?? "",
    tanggalLahir: iso ? new Date(`${iso}T00:00:00`) : null,
    jenisKelamin: d.jenisKelamin ?? "",
    golonganDarah: d.golonganDarah ?? "",
    rhesus: d.rhesus ?? "",
    telepon: d.telepon ?? "",
    alamat: d.alamat ?? "",
  };
  dialogForm.value = true;
};
const simpanForm = async () => {
  const f = form.value;
  galatForm.value = "";
  if (!f.nama.trim()) return (galatForm.value = "Nama donor wajib diisi");
  if (f.nik.trim() && !/^\d{16}$/.test(f.nik.trim())) return (galatForm.value = "NIK harus 16 digit angka");
  storeUtils.setLoading(true);
  try {
    const isi = {
      nama: f.nama.trim(),
      nik: f.nik.trim() || null,
      tanggalLahir: f.tanggalLahir ? keTanggal(f.tanggalLahir) : null,
      jenisKelamin: f.jenisKelamin || null,
      golonganDarah: f.golonganDarah || null,
      rhesus: f.rhesus || null,
      telepon: f.telepon.trim() || null,
      alamat: f.alamat.trim() || null,
    };
    const res = await simpanDonorUtd(isi, modeUbah.value ? detail.value.uuid : undefined);
    if (res?.payload) {
      dialogForm.value = false;
      muat();
      await muatDetail(res.payload.uuid);
      dialogDetail.value = true;
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Kunjungan seleksi (kuesioner + pemeriksaan + keputusan)
// Daftar pertanyaan kuesioner dasar; jawaban disimpan apa adanya di kolom JSONB kuesioner.
const PERTANYAAN = [
  { kunci: "merasaSehat", teks: "Merasa sehat hari ini" },
  { kunci: "tidurCukup", teks: "Tidur cukup semalam (± 5 jam atau lebih)" },
  { kunci: "sudahMakan", teks: "Sudah makan dalam 4 jam terakhir" },
  { kunci: "minumObat", teks: "Sedang minum obat (antibiotik/pengencer darah, dsb.)" },
  { kunci: "penyakitBerat", teks: "Riwayat penyakit jantung, paru, hepatitis, HIV, atau kejang" },
  { kunci: "tatoTindik", teks: "Ditato/ditindik/akupunktur dalam 6 bulan terakhir" },
  { kunci: "transfusi", teks: "Menerima transfusi darah dalam 12 bulan terakhir" },
  { kunci: "hamilMenyusui", teks: "Sedang hamil/menyusui/haid (khusus perempuan)" },
];
const dialogSeleksi = ref(false);
const kosongSeleksi = () => ({
  kuesioner: Object.fromEntries(PERTANYAAN.map((p) => [p.kunci, false])) as Record<string, boolean>,
  catatanKuesioner: "",
  hb: 0,
  tekananSistolik: 0,
  tekananDiastolik: 0,
  beratBadan: 0,
  nadi: 0,
  suhu: 0,
  status: "proses",
  alasan: "",
});
const formSeleksi = ref(kosongSeleksi());
const galatSeleksi = ref("");
const bukaSeleksi = () => {
  formSeleksi.value = kosongSeleksi();
  galatSeleksi.value = "";
  dialogSeleksi.value = true;
};
const angka = (n: number) => (n > 0 ? n : null);
const simpanSeleksi = async () => {
  const f = formSeleksi.value;
  galatSeleksi.value = "";
  if (["tunda", "tolak"].includes(f.status) && !f.alasan.trim()) return (galatSeleksi.value = "Alasan wajib diisi untuk keputusan tunda/tolak");
  if (f.status === "layak" && (!f.hb || !f.tekananSistolik || !f.tekananDiastolik || !f.beratBadan))
    return (galatSeleksi.value = "Hb, tekanan darah, dan berat badan wajib diisi sebelum menyatakan layak");
  storeUtils.setLoading(true);
  try {
    const res = await seleksiDonorUtd(detail.value.uuid, {
      kuesioner: { ...f.kuesioner, catatan: f.catatanKuesioner.trim() || undefined },
      hb: angka(f.hb),
      tekananSistolik: angka(f.tekananSistolik),
      tekananDiastolik: angka(f.tekananDiastolik),
      beratBadan: angka(f.beratBadan),
      nadi: angka(f.nadi),
      suhu: angka(f.suhu),
      status: f.status,
      alasan: f.alasan.trim() || null,
    });
    if (res?.payload) {
      dialogSeleksi.value = false;
      await muatDetail(detail.value.uuid);
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Putuskan kunjungan seleksi yang masih "proses"
const dialogPutus = ref(false);
const riwayatDipilih = ref<any>(null);
const formPutus = ref({ status: "layak", alasan: "" });
const galatPutus = ref("");
const OPSI_KEPUTUSAN = opsi({ layak: "Layak", tunda: "Tunda", tolak: "Tolak" });
const OPSI_STATUS_SELEKSI = Object.entries(STATUS_SELEKSI_UTD).map(([value, g]) => ({ value, label: g.label }));
const bukaPutus = (r: any) => {
  riwayatDipilih.value = r;
  formPutus.value = { status: "layak", alasan: "" };
  galatPutus.value = "";
  dialogPutus.value = true;
};
const simpanPutus = async () => {
  const f = formPutus.value;
  galatPutus.value = "";
  if (f.status !== "layak" && !f.alasan.trim()) return (galatPutus.value = "Alasan wajib diisi untuk keputusan tunda/tolak");
  storeUtils.setLoading(true);
  try {
    const res = await putuskanSeleksiUtd(detail.value.uuid, riwayatDipilih.value.uuid, { status: f.status, alasan: f.alasan.trim() || null });
    if (res?.payload) {
      dialogPutus.value = false;
      await muatDetail(detail.value.uuid);
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Notifikasi/konseling donor (hasil uji saring)
const dialogNotif = ref(false);
const catatanNotif = ref("");
const simpanNotif = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await notifikasiDonorUtd(detail.value.uuid, catatanNotif.value.trim() || undefined);
    if (res?.payload) {
      dialogNotif.value = false;
      detail.value = { ...detail.value, ...res.payload };
      muat();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Kartu donor (cetak di peramban; backend tidak menyediakan endpoint cetak)
const cetakKartu = () => {
  const d = detail.value;
  const terakhir = riwayat.value.find((r: any) => r.status === "layak");
  cetakHtmlUtd(
    `Kartu Donor ${d.noDonor}`,
    `<div class="kartu">
      <h1>KARTU DONOR DARAH</h1>
      <div class="muted">UTD / UPTD Produksi Darah</div>
      <table style="margin-top:10px">
        <tr><th>No. Donor</th><td><b>${escHtml(d.noDonor)}</b></td></tr>
        <tr><th>Nama</th><td>${escHtml(d.nama)}</td></tr>
        <tr><th>Tanggal Lahir</th><td>${escHtml(tglUtd(d.tanggalLahir))}</td></tr>
        <tr><th>Jenis Kelamin</th><td>${escHtml(JENIS_KELAMIN_UTD[d.jenisKelamin] ?? "-")}</td></tr>
        <tr><th>Golongan Darah</th><td style="font-size:18px"><b>${escHtml(golonganRhUtd(d.golonganDarah, d.rhesus))}</b></td></tr>
        <tr><th>Jumlah Donor</th><td>${escHtml(d.jumlahAftap ?? 0)} kali</td></tr>
        <tr><th>Donor Terakhir</th><td>${escHtml(waktuUtd(d.aftapTerakhir?.createdAt, true))}</td></tr>
        <tr><th>Seleksi Layak Terakhir</th><td>${escHtml(waktuUtd(terakhir?.createdAt, true))}</td></tr>
      </table>
    </div>`,
  );
};
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Donor & Seleksi</h1>
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="No. Donor / NIK / Nama" :maxLength="100" @keydown.enter="cariData" />
          <ToolbarFilterMenu :count="filterStatus ? 1 : 0">
            <template #label>Status</template>
            <CustomChip
              v-for="(s, kode) in STATUS_AKTIF_DONOR_UTD"
              :key="kode"
              :label="s.label"
              :value="String(kode)"
              :isSelected="filterStatus === String(kode)"
              @selected="filterStatus = filterStatus === $event ? '' : $event"
            />
          </ToolbarFilterMenu>
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariData" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="reset" />
          <CustomButton v-if="boleh('CREATE')" icon="PhPlus" label="Donor" @click="bukaBaru" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!data.length" />
        <DataTable
          v-else
          :value="data"
          stripedRows
          class="text-xs cursor-pointer"
          scrollable
          scrollHeight="flex"
          tableStyle="min-width: 56rem"
          @rowClick="bukaDetail($event.data.uuid)"
        >
          <Column header="No. Donor" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.noDonor }}</div>
              <div class="text-grey-400">Terdaftar {{ waktuUtd(d.createdAt, true) }}</div>
            </template>
          </Column>
          <Column header="Donor" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.nama }}</div>
              <div class="text-grey-400">NIK {{ d.nik ?? "-" }}</div>
            </template>
          </Column>
          <Column header="JK / Umur" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.jenisKelamin ?? "-" }} · {{ umurUtd(tglIsoUtd(d.tanggalLahir) || null) }}</template>
          </Column>
          <Column header="Gol." headerClass="bg-opensimrs-50">
            <template #body="{ data: d }"><b>{{ golonganRhUtd(d.golonganDarah, d.rhesus) }}</b></template>
          </Column>
          <Column header="Telepon" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">{{ d.telepon ?? "-" }}</template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaDonorUtd(d.statusAktif)?.bg, gayaDonorUtd(d.statusAktif)?.text]">
                {{ gayaDonorUtd(d.statusAktif)?.label ?? d.statusAktif }}
              </span>
              <span
                v-if="bolehReaktif && d.perluNotifikasi && !d.notifikasiSelesai"
                class="px-1.5 ml-1 rounded text-[10px] font-semibold bg-[#FDE2E1] text-[#B42318]"
              >Perlu notifikasi</span>
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

    <!-- Detail donor -->
    <CustomDialog v-model:visible="dialogDetail" width="900px">
      <template #header>Donor {{ detail?.noDonor }}</template>
      <template #body>
        <div v-if="detail" class="flex flex-col gap-4 pt-4 text-sm">
          <div class="grid grid-cols-2 gap-x-6 gap-y-1">
            <div><span class="text-grey-400">Nama:</span> <b>{{ detail.nama }}</b></div>
            <div>
              <span class="text-grey-400">Status:</span>
              <span class="px-2 py-0.5 ml-1 rounded-full text-xs font-semibold" :class="[gayaDonorUtd(detail.statusAktif)?.bg, gayaDonorUtd(detail.statusAktif)?.text]">
                {{ gayaDonorUtd(detail.statusAktif)?.label ?? detail.statusAktif }}
              </span>
            </div>
            <div><span class="text-grey-400">NIK:</span> {{ detail.nik ?? "-" }}</div>
            <div><span class="text-grey-400">Golongan darah:</span> <b>{{ golonganRhUtd(detail.golonganDarah, detail.rhesus) }}</b></div>
            <div><span class="text-grey-400">Tanggal lahir:</span> {{ tglUtd(detail.tanggalLahir) }} ({{ umurUtd(tglIsoUtd(detail.tanggalLahir) || null) }})</div>
            <div><span class="text-grey-400">Jenis kelamin:</span> {{ JENIS_KELAMIN_UTD[detail.jenisKelamin] ?? "-" }}</div>
            <div><span class="text-grey-400">Telepon:</span> {{ detail.telepon ?? "-" }}</div>
            <div><span class="text-grey-400">Jumlah donor (aftap):</span> {{ detail.jumlahAftap ?? 0 }} kali</div>
            <div class="col-span-2"><span class="text-grey-400">Alamat:</span> {{ detail.alamat ?? "-" }}</div>
            <div v-if="detail.aftapTerakhir" class="col-span-2">
              <span class="text-grey-400">Aftap terakhir:</span> {{ detail.aftapTerakhir.noKantong }} · {{ waktuUtd(detail.aftapTerakhir.createdAt) }}
              <span
                class="px-2 py-0.5 ml-1 rounded-full text-[10px] font-semibold"
                :class="[gayaKantongUtd(detail.aftapTerakhir.statusKantong, bolehReaktif)?.bg, gayaKantongUtd(detail.aftapTerakhir.statusKantong, bolehReaktif)?.text]"
              >
                {{ gayaKantongUtd(detail.aftapTerakhir.statusKantong, bolehReaktif)?.label }}
              </span>
            </div>
          </div>

          <div v-if="ditahan" class="px-3 py-2 rounded-lg bg-[#FDE2E1] text-[#B42318]">
            Donor ditahan; seleksi baru memerlukan tinjauan petugas berwenang.
            <template v-if="bolehReaktif">
              <div v-if="detail.alasanDitahan">Alasan: {{ detail.alasanDitahan }}</div>
              <div v-if="detail.pernahReaktif">Riwayat hasil uji saring reaktif tercatat pada donor ini.</div>
              <div v-if="detail.notifikasiSelesai">
                Notifikasi/konseling selesai {{ waktuUtd(detail.notifikasiPada) }}{{ detail.catatanNotifikasi ? ` — ${detail.catatanNotifikasi}` : "" }}
              </div>
            </template>
          </div>

          <div>
            <h3 class="mb-1 font-semibold">Riwayat Kunjungan Seleksi</h3>
            <NoData v-if="!riwayat.length" />
            <DataTable v-else :value="riwayat" stripedRows class="text-xs">
              <Column header="Waktu" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ waktuUtd(r.createdAt) }}</template>
              </Column>
              <Column header="Hb (g/dL)" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ r.hb ?? "-" }}</template>
              </Column>
              <Column header="TD (mmHg)" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ tekanan(r) }}</template>
              </Column>
              <Column header="BB (kg)" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ r.beratBadan ?? "-" }}</template>
              </Column>
              <Column header="Nadi / Suhu" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ r.nadi ?? "-" }} / {{ r.suhu ?? "-" }}</template>
              </Column>
              <Column header="Keputusan" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaSeleksiUtd(r.status)?.bg, gayaSeleksiUtd(r.status)?.text]">
                    {{ gayaSeleksiUtd(r.status)?.label ?? r.status }}
                  </span>
                  <div v-if="r.alasan" class="text-grey-400">{{ r.alasan }}</div>
                  <div v-if="r.tanggalLayakBerikutnya" class="text-grey-400">Layak lagi mulai {{ tglUtd(r.tanggalLayakBerikutnya) }}</div>
                </template>
              </Column>
              <Column header="" headerClass="bg-opensimrs-50" class="w-[100px]">
                <template #body="{ data: r }">
                  <CustomButton v-if="r.status === 'proses' && boleh('SELEKSI')" label="Putuskan" size="small" @click="bukaPutus(r)" />
                </template>
              </Column>
            </DataTable>
          </div>
        </div>
      </template>
      <template #footer>
        <div v-if="detail" class="flex flex-wrap justify-end gap-2">
          <CustomButton v-if="perluNotifikasi" label="Notifikasi Selesai" icon="PhChatCircleText" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="(catatanNotif = ''), (dialogNotif = true)" />
          <CustomButton v-if="boleh('CETAK KARTU')" label="Cetak Kartu" icon="PhPrinter" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cetakKartu" />
          <CustomButton v-if="boleh('UPDATE')" label="Ubah Data" icon="PhPencilSimple" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaUbah" />
          <CustomButton v-if="boleh('SELEKSI') && !ditahan" label="Seleksi Baru" icon="PhClipboardText" @click="bukaSeleksi" />
        </div>
      </template>
    </CustomDialog>

    <!-- Form donor -->
    <CustomDialog v-model:visible="dialogForm" width="760px">
      <template #header>{{ modeUbah ? `Ubah Donor ${detail?.noDonor}` : "Pendaftaran Donor Baru" }}</template>
      <template #body>
        <div class="grid grid-cols-3 gap-4 pt-4">
          <CustomTextfield v-model="form.nama" label="Nama Lengkap" placeholder="mis. Donor Contoh" class="col-span-2" required :maxLength="200" />
          <CustomTextfield v-model="form.nik" label="NIK" placeholder="9999xxxxxxxxxxxx" :maxLength="16" />
          <CustomDatePicker v-model="form.tanggalLahir" label="Tanggal Lahir" :maxDate="new Date()" />
          <CustomSelect v-model="form.jenisKelamin" label="Jenis Kelamin" placeHolder="Pilih" :options="opsi(JENIS_KELAMIN_UTD)" optionValue="value" optionLabel="label" :showFilter="false" />
          <CustomTextfield v-model="form.telepon" label="Telepon" placeholder="080000000000" :maxLength="20" />
          <CustomSelect v-model="form.golonganDarah" label="Golongan Darah" placeHolder="Belum diketahui" :options="opsi(GOLONGAN_DARAH_UTD)" optionValue="value" optionLabel="label" :showFilter="false" />
          <CustomSelect v-model="form.rhesus" label="Rhesus" placeHolder="Belum diketahui" :options="opsi(RHESUS_UTD)" optionValue="value" optionLabel="label" :showFilter="false" />
          <div></div>
          <CustomTextArea v-model="form.alamat" label="Alamat" placeholder="mis. Jl. Contoh No. 1" class="col-span-3" />
        </div>
        <div class="mt-2 text-xs text-grey-400">Golongan darah boleh dikosongkan; akan diisi otomatis dari aftap pertama.</div>
        <div v-if="galatForm" class="mt-3 text-sm text-danger-300">{{ galatForm }}</div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogForm = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanForm" />
        </div>
      </template>
    </CustomDialog>

    <!-- Kunjungan seleksi -->
    <CustomDialog v-model:visible="dialogSeleksi" width="860px">
      <template #header>Seleksi Donor — {{ detail?.nama }} ({{ detail?.noDonor }})</template>
      <template #body>
        <div class="flex flex-col gap-4 pt-4">
          <div>
            <h3 class="mb-2 text-sm font-semibold">Kuesioner</h3>
            <div class="grid grid-cols-2 gap-2">
              <div v-for="p in PERTANYAAN" :key="p.kunci" class="flex items-start gap-2">
                <Checkbox v-model="formSeleksi.kuesioner[p.kunci]" binary :inputId="`utd-k-${p.kunci}`" />
                <label :for="`utd-k-${p.kunci}`" class="text-sm">{{ p.teks }}</label>
              </div>
            </div>
            <CustomTextArea v-model="formSeleksi.catatanKuesioner" label="Catatan kuesioner" placeholder="Jawaban/keterangan tambahan" class="mt-2" />
          </div>
          <div>
            <h3 class="mb-2 text-sm font-semibold">Pemeriksaan</h3>
            <div class="grid grid-cols-3 gap-4">
              <CustomInputNumber v-model="formSeleksi.hb" label="Hb (g/dL)" :min="0" :max="25" :minFractionDigits="0" :maxFractionDigits="1" />
              <CustomInputNumber v-model="formSeleksi.tekananSistolik" label="Sistolik (mmHg)" :min="0" :max="300" />
              <CustomInputNumber v-model="formSeleksi.tekananDiastolik" label="Diastolik (mmHg)" :min="0" :max="200" />
              <CustomInputNumber v-model="formSeleksi.beratBadan" label="Berat Badan (kg)" :min="0" :max="300" :minFractionDigits="0" :maxFractionDigits="1" />
              <CustomInputNumber v-model="formSeleksi.nadi" label="Nadi (x/menit)" :min="0" :max="250" />
              <CustomInputNumber v-model="formSeleksi.suhu" label="Suhu (°C)" :min="0" :max="45" :minFractionDigits="0" :maxFractionDigits="1" />
            </div>
          </div>
          <div class="grid grid-cols-3 gap-4">
            <CustomSelect v-model="formSeleksi.status" label="Keputusan" :options="OPSI_STATUS_SELEKSI" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
            <CustomTextArea v-model="formSeleksi.alasan" label="Alasan / catatan keputusan" placeholder="Wajib untuk tunda/tolak" class="col-span-2" :required="['tunda', 'tolak'].includes(formSeleksi.status)" />
          </div>
          <div class="text-xs text-grey-400">
            Pilih "Dalam Proses" bila keputusan ditetapkan kemudian (mis. oleh dokter). Keputusan "Layak" diperiksa sistem terhadap interval
            minimal antar-donor di Pengaturan UTD dan otomatis menjadi "Tolak" bila belum cukup.
          </div>
          <div v-if="galatSeleksi" class="text-sm text-danger-300">{{ galatSeleksi }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogSeleksi = false" />
          <CustomButton label="Simpan Seleksi" icon="PhFloppyDisk" @click="simpanSeleksi" />
        </div>
      </template>
    </CustomDialog>

    <!-- Putuskan seleksi -->
    <CustomDialog v-model:visible="dialogPutus" width="460px">
      <template #header>Keputusan Seleksi {{ waktuUtd(riwayatDipilih?.createdAt) }}</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <div class="text-sm text-grey-400">
            Hb {{ riwayatDipilih?.hb ?? "-" }} · TD {{ riwayatDipilih ? tekanan(riwayatDipilih) : "-" }} · BB {{ riwayatDipilih?.beratBadan ?? "-" }}
          </div>
          <CustomSelect v-model="formPutus.status" label="Keputusan" :options="OPSI_KEPUTUSAN" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" required />
          <CustomTextArea v-model="formPutus.alasan" label="Alasan" placeholder="Wajib untuk tunda/tolak" :required="formPutus.status !== 'layak'" />
          <div v-if="galatPutus" class="text-sm text-danger-300">{{ galatPutus }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Kembali" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogPutus = false" />
          <CustomButton label="Simpan" @click="simpanPutus" />
        </div>
      </template>
    </CustomDialog>

    <!-- Notifikasi selesai -->
    <CustomDialog v-model:visible="dialogNotif" width="460px" headerBg="bg-danger-300">
      <template #header>Notifikasi/Konseling Donor {{ detail?.noDonor }}</template>
      <template #body>
        <div class="flex flex-col gap-2 pt-4">
          <div class="text-sm text-grey-400">Tandai bahwa donor telah dihubungi dan mendapat konseling/rujukan atas hasil uji saring.</div>
          <CustomTextArea v-model="catatanNotif" label="Catatan (opsional)" placeholder="mis. dirujuk ke layanan konseling" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Kembali" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogNotif = false" />
          <CustomButton label="Simpan" backgroundColor="bg-danger-300" @click="simpanNotif" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
