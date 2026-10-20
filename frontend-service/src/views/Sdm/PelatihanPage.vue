<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import NoData from "@/components/section/NoData.vue";
import { useAuthStore } from "@/stores/auth";
import CakupanPelatihan from "./CakupanPelatihan.vue";
import { bacaPelatihan, catatPelatihan, ubahPelatihan, hapusPelatihan, izinPelatihan as boleh, eksporPelatihan,
  epochHariPelatihan, tanggalFormPelatihan, tanggalJamForm, waktuPelatihan,
  KATEGORI_PELATIHAN, STATUS_PELATIHAN, KEHADIRAN_PELATIHAN, HASIL_PELATIHAN } from "@/stores/penunjang/pelatihan";

const route = useRoute(), router = useRouter(), auth = useAuthStore();
const tab = computed(() => route.path.includes("/katalog") ? "katalog" : route.path.includes("/rekap") ? "rekap" : route.path.includes("/pengaturan") ? "pengaturan" : "kegiatan");
const kegiatanUuid = computed(() => String(route.params.uuid ?? ""));
const tahun = ref(new Date().getFullYear()), cari = ref(""), page = ref(1), total = ref(0), memuat = ref(false), menyimpan = ref(false), galat = ref("");
const data = ref<any[]>([]), referensi = ref<any>({ unit: [], jenisPegawai: [] }), pegawai = ref<any[]>([]), katalog = ref<any[]>([]);
const detail = ref<any>(null), peserta = ref<any[]>([]), totalPeserta = ref(0), halamanPeserta = ref(1), kebijakan = ref<any>(null);
const filterUnit = ref(""), filterPegawai = ref(""), filterJenis = ref(""), filterStatus = ref(""), mulai = ref(""), selesai = ref("");
const jenisLaporan = ref("jam"), formatEkspor = ref(""), hariPeringatan = ref(""), statusPemenuhan = ref(""), waktuPenilaian = ref("");
const dialog = ref(""), form = ref<any>({}), pilihanPegawai = ref<string[]>([]), calonCari = ref("");
const sertifikatTersedia = ref<any[]>([]);
let urutan = 0;
const label: Record<string, string> = { terpenuhi: "Terpenuhi", belum_terpenuhi: "Belum terpenuhi", belum_ditetapkan: "Belum ditetapkan",
  terverifikasi: "Terverifikasi", belum_diverifikasi: "Belum diverifikasi", sertifikat_belum_sah: "Sertifikat belum sah", belum_menyelesaikan_pelatihan: "Belum menyelesaikan pelatihan",
  akan_kedaluwarsa: "Akan kedaluwarsa", kedaluwarsa: "Kedaluwarsa" };
const filterRekap = () => ({ tahun: tahun.value, unitUuid: filterUnit.value, pegawaiUuid: filterPegawai.value, jenisPegawai: filterJenis.value,
  statusPemenuhan: statusPemenuhan.value, hariPeringatan: hariPeringatan.value, waktuPenilaian: epochHariPelatihan(waktuPenilaian.value), kegiatanUuid: kegiatanUuid.value || undefined });
const parameterDaftar = () => ({ cari: cari.value, page: page.value, limit: 20, status: filterStatus.value,
  tanggalMulai: mulai.value ? new Date(mulai.value).getTime() / 1000 : null, tanggalSelesai: selesai.value ? new Date(selesai.value).getTime() / 1000 : null });

const muat = async () => {
  const nomor = ++urutan;
  memuat.value = true; galat.value = "";
  try {
    const r = await bacaPelatihan("/referensi");
    if (nomor !== urutan) return;
    referensi.value = r?.payload ?? { unit: [], jenisPegawai: [] };
    const kb = await bacaPelatihan("/kebijakan", { tahun: tahun.value });
    if (nomor !== urutan) return;
    kebijakan.value = kb?.payload ?? null;
    if (tab.value === "rekap" && boleh("BACA REKAP")) {
      const path = jenisLaporan.value === "jam" ? "/rekap" : `/rekap/${jenisLaporan.value}`;
      const res = await bacaPelatihan(path, { ...filterRekap(), page: page.value, limit: 20 });
      if (nomor !== urutan) return;
      data.value = res?.payload?.data ?? []; total.value = res?.payload?.pagination?.total ?? 0;
    } else if (tab.value === "pengaturan") {
      isiKebijakan();
    } else if (boleh("READ")) {
      if (kegiatanUuid.value) {
        const [g, p] = await Promise.all([bacaPelatihan(`/kegiatan/${kegiatanUuid.value}`), bacaPelatihan(`/kegiatan/${kegiatanUuid.value}/peserta`, { page: halamanPeserta.value, limit: 30 })]);
        if (nomor !== urutan) return;
        detail.value = g?.payload ?? null; peserta.value = p?.payload?.data ?? []; totalPeserta.value = p?.payload?.pagination?.total ?? 0;
      } else {
        const res = await bacaPelatihan(`/${tab.value}`, parameterDaftar());
        if (nomor !== urutan) return;
        data.value = res?.payload?.data ?? []; total.value = res?.payload?.pagination?.total ?? 0;
      }
    }
  } finally { if (nomor === urutan) memuat.value = false; }
};
const isiKebijakan = () => {
  const b = kebijakan.value;
  form.value = { tahun: tahun.value, zonaWaktu: b?.zonaWaktu ?? "", dasarJam: b?.dasarJam ?? "", aturanSebagian: b?.aturanSebagian ?? "",
    prioritasTarget: b?.prioritasTarget ?? "", dasarCakupan: b?.dasarCakupan ?? "",
    hariPeringatan: b?.hariPeringatan ?? "", izinkanEksporKosong: b?.izinkanEksporKosong ?? false, syaratSertifikat: b?.syaratSertifikat ?? false,
    target: (b?.target ?? []).map((t: any) => ({ ...t })), kebijakanSebelumnyaUuid: b?.uuid ?? null };
};
const muatPegawai = async () => {
  const nomor = urutan;
  const r = await bacaPelatihan("/pegawai", { cari: calonCari.value, limit: 200 });
  if (nomor !== urutan) return;
  pegawai.value = r?.payload?.data ?? [];
};
const bukaKatalog = async (row?: any) => {
  const nomor = urutan;
  galat.value = ""; await muatPegawai();
  const d = row ? (await bacaPelatihan(`/katalog/${row.uuid}`))?.payload : null;
  if (nomor !== urutan) return;
  if (row && !d) return;
  form.value = d ? { ...d, cakupan: d.cakupan.map((c: any) => ({ ...c, mulaiBerlaku: tanggalFormPelatihan(c.mulaiBerlaku), akhirBerlaku: tanggalFormPelatihan(c.akhirBerlaku) })) }
    : { kode: "", nama: "", kategori: "internal", wajib: false, jam: "", masaBerlakuTahun: "", keterangan: "", cakupan: [] };
  dialog.value = "katalog";
};
const bukaKegiatan = async (row?: any) => {
  const nomor = urutan;
  galat.value = "";
  const res = await bacaPelatihan("/katalog", { limit: 9999 });
  if (nomor !== urutan) return;
  katalog.value = res?.payload?.data ?? [];
  form.value = row ? { ...row, jadwalMulai: tanggalJamForm(row.jadwalMulai), jadwalSelesai: tanggalJamForm(row.jadwalSelesai) }
    : { katalogUuid: "", kebijakanUuid: kebijakan.value?.uuid ?? "", jadwalMulai: "", jadwalSelesai: "", lokasi: "", penyelenggara: "", kapasitas: "", keterangan: "" };
  dialog.value = "kegiatan";
};
const bukaPeserta = async () => { const nomor = urutan; pilihanPegawai.value = []; calonCari.value = ""; await muatPegawai(); if (nomor === urutan) dialog.value = "peserta"; };
const muatKebijakanKegiatan = async () => {
  const nomor = urutan, r = await bacaPelatihan("/kebijakan", { tahun: tahun.value });
  if (nomor !== urutan || dialog.value !== "kegiatan") return;
  kebijakan.value = r?.payload ?? null; form.value.kebijakanUuid = kebijakan.value?.uuid ?? "";
};
const bukaHasil = (p: any) => { form.value = { ...p }; dialog.value = "hasil"; galat.value = ""; };
const bukaSertifikat = async (p: any) => {
  const nomor = urutan;
  const res = await bacaPelatihan(`/pegawai/${p.pegawaiUuid}/sertifikat`);
  if (nomor !== urutan) return;
  sertifikatTersedia.value = res?.payload ?? [];
  form.value = { ...p, mode: "baru", nomor: "", penerbit: detail.value?.penyelenggara ?? "", tanggalMulai: tanggalFormPelatihan(detail.value?.jadwalSelesai), tanggalBerakhir: "", berkas: null, tautanUuid: "" };
  dialog.value = "sertifikat"; galat.value = "";
};
const unggah = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) { form.value.berkas = null; return; }
  const maksMb = Number(referensi.value.maksBerkasMb ?? 10);
  if (file.size > maksMb * 1024 * 1024) { galat.value = `Berkas maksimal ${maksMb} MB.`; return; }
  const reader = new FileReader();
  const nomor = urutan, pesertaUuid = form.value.uuid;
  reader.onload = () => { if (nomor === urutan && form.value.uuid === pesertaUuid && dialog.value === "sertifikat") form.value.berkas = { namaBerkas: file.name, tipeMime: file.type, dataBase64: String(reader.result).split(",")[1] }; };
  reader.readAsDataURL(file);
};
const simpan = async () => {
  if (menyimpan.value) return;
  menyimpan.value = true; galat.value = "";
  try {
    const f = form.value; let res;
    if (dialog.value === "katalog") {
      const data = { kode: f.kode, nama: f.nama, kategori: f.kategori, wajib: f.wajib, jam: f.jam, keterangan: f.keterangan, versi: f.versi,
        masaBerlakuTahun: f.masaBerlakuTahun || null, cakupan: f.cakupan.map((c: any) => ({ jenisCakupan: c.jenisCakupan, referensiUuid: c.referensiUuid,
          mulaiBerlaku: epochHariPelatihan(c.mulaiBerlaku), akhirBerlaku: epochHariPelatihan(c.akhirBerlaku) })) };
      res = f.uuid ? await ubahPelatihan(`/katalog/${f.uuid}`, data) : await catatPelatihan("/katalog", data);
    } else if (dialog.value === "kegiatan") {
      const data = { katalogUuid: f.katalogUuid, kebijakanUuid: f.kebijakanUuid, versi: f.versi, lokasi: f.lokasi, penyelenggara: f.penyelenggara,
        keterangan: f.keterangan, kapasitas: f.kapasitas || null, jadwalMulai: new Date(f.jadwalMulai).getTime() / 1000, jadwalSelesai: new Date(f.jadwalSelesai).getTime() / 1000 };
      res = f.uuid ? await ubahPelatihan(`/kegiatan/${f.uuid}`, data) : await catatPelatihan("/kegiatan", data);
    } else if (dialog.value === "peserta") {
      res = await catatPelatihan(`/kegiatan/${kegiatanUuid.value}/peserta`, { pegawaiUuids: pilihanPegawai.value, versi: detail.value.versi });
    } else if (dialog.value === "hasil") {
      res = await ubahPelatihan(`/kegiatan/${kegiatanUuid.value}/peserta/${f.uuid}/hasil`, { versi: f.versi, kehadiran: f.kehadiran, hasil: f.hasil, jamHadir: f.jamHadir });
    } else if (dialog.value === "sertifikat") {
      res = await catatPelatihan(`/kegiatan/${kegiatanUuid.value}/peserta/${f.uuid}/sertifikat`, { versi: f.versi,
        ...(f.mode === "tautan" ? { kredensialUuid: f.tautanUuid } : { sertifikat: { nomor: f.nomor, penerbit: f.penerbit, tanggalMulai: epochHariPelatihan(f.tanggalMulai), tanggalBerakhir: epochHariPelatihan(f.tanggalBerakhir), berkas: f.berkas } }) });
    } else if (tab.value === "pengaturan") {
      res = await catatPelatihan("/kebijakan", { ...f, tahun: tahun.value });
    }
    if (res) { dialog.value = ""; await muat(); }
    else galat.value = "Penyimpanan gagal. Periksa pesan validasi. Jika data berubah, tutup formulir dan muat ulang.";
  } finally { menyimpan.value = false; }
};
const tindakan = async (jenis: string, p?: any, status?: string) => {
  const alasan = ["koreksi", "buka-kembali", "hapus", "batal-peserta"].includes(jenis) || status === "dibatalkan" ? window.prompt("Alasan koreksi atau pembatalan:") : null;
  if ((["koreksi", "buka-kembali", "hapus", "batal-peserta"].includes(jenis) || status === "dibatalkan") && !alasan?.trim()) return;
  if (jenis === "verifikasi" && !window.confirm(`Verifikasi hasil ${p.namaPegawai}? Jam akan dihitung sesuai kebijakan kegiatan.`)) return;
  menyimpan.value = true;
  try {
    const path = `/kegiatan/${kegiatanUuid.value}`, d = detail.value;
    if (jenis === "status") await catatPelatihan(`${path}/status`, { versi: d.versi, status, alasan });
    else if (jenis === "hapus") { const r = await hapusPelatihan(path, { versi: d.versi, alasan }); if (r) { await router.push("/sdm/pelatihan/kegiatan"); return; } }
    else if (jenis === "buka-kembali") await catatPelatihan(`${path}/buka-kembali`, { versi: d.versi, alasan });
    else if (jenis === "batal-peserta") await hapusPelatihan(`${path}/peserta/${p.uuid}`, { versi: p.versi, alasan });
    else await catatPelatihan(`${path}/peserta/${p.uuid}/${jenis}`, { versi: p.versi, alasan });
    await muat();
  } finally { menyimpan.value = false; }
};
const hapusEntriKatalog = async (row: any) => {
  const alasan = window.prompt(`Alasan menghapus katalog ${row.nama}:`);
  if (alasan?.trim()) { await hapusPelatihan(`/katalog/${row.uuid}`, { versi: row.versi, alasan }); await muat(); }
};
const ekspor = async (jenis = jenisLaporan.value) => {
  if (!formatEkspor.value) { galat.value = "Pilih format ekspor."; return; }
  menyimpan.value = true;
  try {
    const r = await catatPelatihan("/ekspor", { ...filterRekap(), jenisLaporan: jenis, format: formatEkspor.value });
    if (r?.payload) await eksporPelatihan(r.payload, jenis);
  } catch { galat.value = "Berkas ekspor gagal dibuat. Coba lagi atau pilih format lain."; }
  finally { menyimpan.value = false; }
};
const cariUlang = () => { page.value = 1; muat(); };
const gantiHalaman = (e: { page: number }) => { page.value = e.page + 1; muat(); };
watch(() => [route.path, auth.faskesUuid], () => {
  ++urutan; data.value = []; peserta.value = []; pegawai.value = []; katalog.value = []; sertifikatTersedia.value = []; detail.value = null; kebijakan.value = null;
  referensi.value = { unit: [], jenisPegawai: [] }; form.value = {}; dialog.value = ""; pilihanPegawai.value = [];
  filterUnit.value = ""; filterPegawai.value = ""; filterJenis.value = ""; cari.value = ""; calonCari.value = ""; page.value = 1; halamanPeserta.value = 1;
  muat();
}, { immediate: true });
onBeforeUnmount(() => { ++urutan; });

// ── Tampilan: bagian aktif, menu, pilihan filter, lencana, dan adaptor nilai komponen Base.
// Bagian mengikuti urutan pemeriksaan lama (pengaturan → rekap → detail kegiatan → daftar katalog/kegiatan).
const bagian = computed(() => tab.value === "pengaturan" && boleh("KELOLA KEBIJAKAN") ? "pengaturan"
  : tab.value === "rekap" && boleh("BACA REKAP") ? "rekap"
  : kegiatanUuid.value && detail.value && boleh("READ") ? "detail"
  : boleh("READ") && ["katalog", "kegiatan"].includes(tab.value) ? "daftar" : "");
const menuPelatihan = computed(() => [
  { kode: "kegiatan", label: "Kegiatan", ke: "/sdm/pelatihan/kegiatan", izin: "READ" },
  { kode: "katalog", label: "Katalog", ke: "/sdm/pelatihan/katalog", izin: "READ" },
  { kode: "rekap", label: "Rekap dan akreditasi", ke: "/sdm/pelatihan/rekap", izin: "BACA REKAP" },
  { kode: "pengaturan", label: "Pengaturan", ke: "/sdm/pelatihan/pengaturan", izin: "KELOLA KEBIJAKAN" },
].filter((m) => boleh(m.izin)));
const opsi = (obj: Record<string, string>) => Object.entries(obj).map(([value, label]) => ({ value, label }));
const OPSI_STATUS = opsi(STATUS_PELATIHAN);
const OPSI_JENIS_LAPORAN = opsi({ jam: "Jam tahunan dan target", wajib: "Pelatihan wajib belum terpenuhi", sertifikat: "Sertifikat mendekati kedaluwarsa" });
const OPSI_PEMENUHAN = opsi({ terpenuhi: "Terpenuhi", belum_terpenuhi: "Belum terpenuhi", belum_ditetapkan: "Belum ditetapkan" });
const OPSI_FORMAT = opsi({ xlsx: "Excel", pdf: "PDF" });
const HIJAU = "bg-success-50 text-success-400", KUNING = "bg-warning-50 text-warning-400", MERAH = "bg-danger-50 text-danger-400", ABU = "bg-grey-75 text-grey-500";
const WARNA: Record<string, string> = { rencana: ABU, terjadwal: "bg-info-50 text-info-400", berlangsung: KUNING, selesai: HIJAU, dibatalkan: MERAH,
  terpenuhi: HIJAU, belum_terpenuhi: MERAH, belum_ditetapkan: ABU, terverifikasi: HIJAU, belum_diverifikasi: KUNING,
  sertifikat_belum_sah: KUNING, belum_menyelesaikan_pelatihan: MERAH, akan_kedaluwarsa: KUNING, kedaluwarsa: MERAH,
  belum_dicatat: ABU, hadir: HIJAU, sebagian: KUNING, tidak_hadir: MERAH, belum_dinilai: ABU, lulus: HIJAU, tidak_lulus: MERAH };
const warna = (kode: string) => WARNA[kode] ?? ABU;
const kelasLencana = "inline-block px-2 py-0.5 text-xs font-semibold rounded-full whitespace-nowrap";
// Formulir tetap memakai elemen native bergaya OpenSIMRS agar validasi bawaan (required/min/max/step/maxlength) berlaku.
const kelasLabel = "block font-semibold mb-[5px] text-normal";
const kelasInput = "w-full h-10 px-3 bg-white border rounded-lg border-grey-200 text-SM disabled:bg-grey-100";
const kelasArea = "w-full p-3 bg-white border rounded-lg border-grey-200 text-SM";
const kelasCentang = "w-4 h-4 accent-opensimrs-300";
const kelasTombolSimpan = "h-10 px-4 font-semibold text-white rounded-[10px] bg-opensimrs-300 disabled:bg-grey-200 disabled:text-grey-400";
// Adaptor nilai: logika muat/simpan tetap memakai string datetime-local/date dan angka tahun seperti semula.
const tahunTeks = computed({
  get: () => (tahun.value == null ? "" : String(tahun.value)),
  set: (v: string | null) => { tahun.value = (v === "" || v == null ? "" : Number(v)) as any; },
});
const keJamLokal = (d: Date | null | undefined) => (d ? tanggalJamForm(d.getTime() / 1000) : "");
const mulaiTanggal = computed({ get: () => (mulai.value ? new Date(mulai.value) : null), set: (d: Date | null | undefined) => { mulai.value = keJamLokal(d); } });
const selesaiTanggal = computed({ get: () => (selesai.value ? new Date(selesai.value) : null), set: (d: Date | null | undefined) => { selesai.value = keJamLokal(d); } });
const penilaianTanggal = computed({
  get: () => (waktuPenilaian.value ? new Date(`${waktuPenilaian.value}T00:00:00`) : null),
  set: (d: Date | null | undefined) => {
    waktuPenilaian.value = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";
  },
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" :disabled="memuat" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Pelatihan SDM</h1>
          <template v-if="bagian === 'daftar'">
            <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" :placeholder="tab === 'katalog' ? 'Kode / nama pelatihan' : 'Nama pelatihan'" :maxLength="100" @keydown.enter="cariUlang" />
            <template v-if="tab === 'kegiatan'">
              <CustomSelect v-model="filterStatus" label="Status" placeHolder="Semua status" :options="OPSI_STATUS" optionValue="value" optionLabel="label" :showFilter="false" />
              <CustomDatePicker v-model="mulaiTanggal" label="Selesai sejak" showTime />
              <CustomDatePicker v-model="selesaiTanggal" label="Selesai sampai" showTime />
            </template>
            <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cariUlang" />
            <CustomButton v-if="tab === 'katalog' && boleh('KELOLA KATALOG')" icon="PhPlus" label="Tambah Katalog" @click="bukaKatalog()" />
            <CustomButton v-if="tab === 'kegiatan' && boleh('KELOLA KEGIATAN')" icon="PhPlus" label="Rencana Kegiatan" @click="bukaKegiatan()" />
          </template>
          <template v-else-if="bagian === 'rekap'">
            <CustomTextfield v-model="tahunTeks" label="Tahun" type="number" :maxLength="4" />
            <CustomSelect v-model="jenisLaporan" label="Jenis laporan" :options="OPSI_JENIS_LAPORAN" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" />
            <CustomSelect v-model="filterUnit" label="Unit" placeHolder="Semua unit" :options="referensi.unit" optionValue="uuid" optionLabel="nama" />
            <CustomSelect v-model="filterJenis" label="Jenis pegawai" placeHolder="Semua jenis" :options="referensi.jenisPegawai" optionValue="uuid" optionLabel="nama" />
            <CustomSelect v-if="jenisLaporan === 'jam'" v-model="statusPemenuhan" label="Pemenuhan target" placeHolder="Semua status" :options="OPSI_PEMENUHAN" optionValue="value" optionLabel="label" :showFilter="false" />
            <CustomTextfield v-if="jenisLaporan === 'sertifikat'" v-model="hariPeringatan" label="Hari peringatan" type="number" placeholder="Mengikuti kebijakan" :maxLength="4" />
            <CustomDatePicker v-if="jenisLaporan === 'wajib'" v-model="penilaianTanggal" label="Tanggal penilaian (WIB)" />
            <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" @click="cariUlang" />
          </template>
          <template v-else-if="bagian === 'detail'">
            <CustomButton icon="PhArrowLeft" label="Kembali" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="router.push('/sdm/pelatihan/kegiatan')" />
            <CustomButton v-if="boleh('KELOLA PESERTA') && !['selesai', 'dibatalkan'].includes(detail.status)" icon="PhUserPlus" label="Daftarkan Peserta" @click="bukaPeserta" />
          </template>
        </PageToolbar>
      </template>

      <template #content>
        <div class="flex flex-col gap-4 pt-4">
          <nav v-if="menuPelatihan.length" class="flex flex-wrap gap-1 border-b border-grey-100" aria-label="Bagian pelatihan">
            <RouterLink
              v-for="m in menuPelatihan"
              :key="m.kode"
              :to="m.ke"
              class="px-4 py-2 -mb-px text-sm font-semibold border-b-2"
              :class="tab === m.kode ? 'border-opensimrs-300 text-opensimrs-300' : 'border-transparent text-grey-400 hover:text-opensimrs-300'"
            >
              {{ m.label }}
            </RouterLink>
          </nav>
          <div v-if="galat" role="alert" class="px-3 py-2 text-sm rounded-lg bg-danger-50 text-danger-400">{{ galat }}</div>
          <div v-if="memuat" role="status" class="py-10 text-sm text-center text-grey-400">Memuat data pelatihan…</div>

          <!-- Pengaturan kebijakan -->
          <div v-else-if="bagian === 'pengaturan'" class="flex flex-col gap-4">
            <div class="px-3 py-2 text-xs rounded-lg bg-info-50 text-info-400">
              Kebijakan disimpan sebagai versi baru. Kegiatan yang sudah ada tetap memakai kebijakan sebelumnya. Tidak ada target jam bawaan.
            </div>
            <label class="flex flex-col w-40">
              <span :class="kelasLabel">Tahun kebijakan</span>
              <input v-model.number="tahun" :class="kelasInput" type="number" min="2000" max="2200" @change="muat" />
            </label>
            <form class="flex flex-col gap-4" @submit.prevent="simpan">
              <div class="p-4 border rounded-lg border-grey-75">
                <div class="mb-3 font-semibold">Kebijakan pelatihan</div>
                <div class="grid items-end grid-cols-1 gap-4 md:grid-cols-3">
                  <label class="flex flex-col">
                    <span :class="kelasLabel">Zona waktu tahun kegiatan<span class="text-danger-300">*</span></span>
                    <select v-model="form.zonaWaktu" :class="kelasInput" required><option value="" disabled>Pilih zona waktu</option><option>Asia/Jakarta</option><option>Asia/Makassar</option><option>Asia/Jayapura</option></select>
                  </label>
                  <label class="flex flex-col">
                    <span :class="kelasLabel">Dasar pengakuan jam<span class="text-danger-300">*</span></span>
                    <select v-model="form.dasarJam" :class="kelasInput" required><option value="" disabled>Pilih dasar</option><option value="hadir">Peserta hadir</option><option value="lulus">Peserta lulus</option></select>
                  </label>
                  <label class="flex flex-col">
                    <span :class="kelasLabel">Kehadiran sebagian<span class="text-danger-300">*</span></span>
                    <select v-model="form.aturanSebagian" :class="kelasInput" required><option value="" disabled>Pilih aturan</option><option value="tidak_dihitung">Tidak dihitung</option><option value="jam_hadir">Berdasarkan jam hadir</option></select>
                  </label>
                  <label class="flex flex-col">
                    <span :class="kelasLabel">Hari peringatan sertifikat<span class="text-danger-300">*</span></span>
                    <input v-model="form.hariPeringatan" :class="kelasInput" type="number" min="0" max="3650" required />
                  </label>
                  <label class="flex flex-col">
                    <span :class="kelasLabel">Aturan target<span class="text-danger-300">*</span></span>
                    <select v-model="form.prioritasTarget" :class="kelasInput" required><option value="" disabled>Pilih aturan target</option><option value="pegawai_unit_jenis_semua">Pegawai → unit → jenis pegawai → semua</option><option value="hanya_semua">Satu target seluruh pegawai</option></select>
                  </label>
                  <label class="flex flex-col md:col-span-2">
                    <span :class="kelasLabel">Cakupan laporan historis<span class="text-danger-300">*</span></span>
                    <select v-model="form.dasarCakupan" :class="kelasInput" required><option value="" disabled>Pilih dasar cakupan</option><option value="saat_laporan">Unit dan jenis pegawai saat laporan dibuat</option></select>
                  </label>
                </div>
                <div class="flex flex-col gap-2 mt-4 text-sm">
                  <label class="flex items-center gap-2"><input v-model="form.syaratSertifikat" :class="kelasCentang" type="checkbox" /> Pemenuhan pelatihan wajib mensyaratkan sertifikat aktif yang terverifikasi</label>
                  <label class="flex items-center gap-2"><input v-model="form.izinkanEksporKosong" :class="kelasCentang" type="checkbox" /> Izinkan ekspor laporan kosong</label>
                </div>
                <p class="mt-3 text-xs text-grey-400">Pilih aturan target dan dasar cakupan secara eksplisit sebelum menyimpan kebijakan faskes.</p>
              </div>
              <div class="p-4 border rounded-lg border-grey-75">
                <div class="mb-3 font-semibold">Target jam pelatihan</div>
                <div v-if="boleh('READ')" class="flex items-end gap-2 mb-3">
                  <CustomTextfield v-model="calonCari" label="Cari pegawai untuk target" prependIcon="PhMagnifyingGlass" class="grow" :maxLength="100" @keydown.enter.prevent="muatPegawai" />
                  <CustomButton icon="PhMagnifyingGlass" label="Muat pilihan pegawai" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="muatPegawai" />
                </div>
                <CakupanPelatihan v-model="form.target" :referensi="referensi" :pegawai="pegawai" target />
              </div>
              <div class="flex justify-end">
                <button type="submit" :class="kelasTombolSimpan" :disabled="menyimpan">Simpan versi kebijakan</button>
              </div>
            </form>
          </div>

          <!-- Rekap dan akreditasi -->
          <template v-else-if="bagian === 'rekap'">
            <div class="flex flex-wrap items-end justify-between gap-3">
              <div class="flex flex-col gap-1 text-xs text-grey-400">
                <p>Unit dan jenis pegawai mengikuti kepegawaian saat laporan dibuat. Jam hanya berasal dari hasil terverifikasi pada kegiatan selesai.</p>
                <p v-if="!kebijakan" class="text-warning-400">Kebijakan tahun ini belum ditetapkan. Target dan pemenuhan wajib belum dapat dinilai.</p>
              </div>
              <div v-if="boleh('EKSPOR')" class="flex items-end gap-2">
                <CustomSelect v-model="formatEkspor" label="Format ekspor" placeHolder="Pilih format ekspor" :options="OPSI_FORMAT" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" class="w-48" />
                <CustomButton icon="PhExport" label="Ekspor" :disabled="menyimpan" @click="ekspor()" />
              </div>
            </div>
            <NoData v-if="!data.length" title="Tidak ada data sesuai filter" class="min-h-[240px]" />
            <DataTable v-else :value="data" stripedRows class="text-xs" scrollable tableStyle="min-width: 48rem">
              <Column field="namaPegawai" header="Pegawai" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><span class="font-semibold">{{ r.namaPegawai }}</span></template></Column>
              <template v-if="jenisLaporan === 'jam'">
                <Column field="jamTercatat" header="Jam tercatat" headerClass="bg-opensimrs-50" />
                <Column field="targetJam" header="Target" headerClass="bg-opensimrs-50" />
                <Column field="kekuranganJam" header="Kekurangan" headerClass="bg-opensimrs-50" />
                <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><span :class="[kelasLencana, warna(r.statusPemenuhan)]">{{ label[r.statusPemenuhan] }}</span></template></Column>
                <Column header="Sumber jam" headerClass="bg-opensimrs-50">
                  <template #body="{ data: r }">
                    <details>
                      <summary class="cursor-pointer text-opensimrs-300">{{ r.sumber.length }} kegiatan</summary>
                      <div v-for="s in r.sumber" :key="s.uuid" class="mt-1">{{ s.namaPelatihan }}: {{ s.jamDiakui }} jam</div>
                    </details>
                  </template>
                </Column>
              </template>
              <template v-else-if="jenisLaporan === 'wajib'">
                <Column field="namaPelatihan" header="Pelatihan wajib" headerClass="bg-opensimrs-50" />
                <Column header="Keterangan" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><span :class="[kelasLencana, warna(r.alasan)]">{{ label[r.alasan] }}</span></template></Column>
              </template>
              <template v-else>
                <Column field="namaPelatihan" header="Pelatihan" headerClass="bg-opensimrs-50" />
                <Column field="nomor" header="Nomor sertifikat" headerClass="bg-opensimrs-50" />
                <Column header="Akhir berlaku" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ tanggalFormPelatihan(r.tanggalBerakhir) }}</template></Column>
                <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><span :class="[kelasLencana, warna(r.statusMasaBerlaku)]">{{ label[r.statusMasaBerlaku] }}</span></template></Column>
                <Column field="sisaHari" header="Sisa hari" headerClass="bg-opensimrs-50" />
              </template>
            </DataTable>
          </template>

          <!-- Detail kegiatan, peserta, hasil, dan sertifikat -->
          <template v-else-if="bagian === 'detail'">
            <div class="p-4 border rounded-lg border-grey-75">
              <div class="flex flex-wrap items-center gap-2 mb-3">
                <h2 class="text-base font-semibold">{{ detail.namaPelatihan }}</h2>
                <span :class="[kelasLencana, warna(detail.status)]">{{ STATUS_PELATIHAN[detail.status] }}</span>
              </div>
              <div class="grid grid-cols-1 text-sm gap-x-6 gap-y-1 md:grid-cols-2">
                <div><span class="text-grey-400">Jadwal:</span> {{ waktuPelatihan(detail.jadwalMulai) }} – {{ waktuPelatihan(detail.jadwalSelesai) }}</div>
                <div><span class="text-grey-400">Jumlah jam:</span> {{ detail.jam }} jam</div>
                <div><span class="text-grey-400">Lokasi:</span> {{ detail.lokasi || 'Lokasi belum diisi' }}</div>
                <div><span class="text-grey-400">Penyelenggara:</span> {{ detail.penyelenggara || 'Penyelenggara belum diisi' }}</div>
                <div><span class="text-grey-400">Kapasitas:</span> {{ detail.kapasitas ?? 'tidak dibatasi' }}</div>
                <div v-if="detail.keterangan" class="md:col-span-2"><span class="text-grey-400">Keterangan:</span> {{ detail.keterangan }}</div>
              </div>
              <div class="flex flex-wrap gap-2 mt-4">
                <template v-if="boleh('KELOLA KEGIATAN') && !['selesai', 'dibatalkan'].includes(detail.status)">
                  <CustomButton label="Ubah kegiatan" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaKegiatan(detail)" />
                  <CustomButton v-if="detail.status === 'rencana'" label="Tetapkan jadwal" icon="PhCalendarCheck" size="small" @click="tindakan('status', null, 'terjadwal')" />
                  <CustomButton v-if="detail.status === 'terjadwal'" label="Mulai kegiatan" icon="PhPlay" size="small" @click="tindakan('status', null, 'berlangsung')" />
                  <CustomButton v-if="detail.status === 'berlangsung'" label="Selesaikan kegiatan" icon="PhCheckCircle" size="small" @click="tindakan('status', null, 'selesai')" />
                  <CustomButton label="Batalkan kegiatan" icon="PhXCircle" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="tindakan('status', null, 'dibatalkan')" />
                  <CustomButton label="Hapus kegiatan" icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="tindakan('hapus')" />
                </template>
                <CustomButton v-if="boleh('VERIFIKASI HASIL') && detail.status === 'selesai'" label="Buka kembali untuk koreksi" icon="PhArrowCounterClockwise" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="tindakan('buka-kembali')" />
              </div>
            </div>

            <div class="flex flex-wrap items-end justify-between gap-3">
              <h3 class="font-semibold">Peserta dan hasil</h3>
              <div v-if="boleh('BACA REKAP') && boleh('EKSPOR')" class="flex items-end gap-2">
                <CustomSelect v-model="formatEkspor" label="Format ekspor" placeHolder="Pilih format" :options="OPSI_FORMAT" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" class="w-40" />
                <CustomButton icon="PhExport" label="Ekspor peserta" :disabled="menyimpan" @click="ekspor('peserta')" />
              </div>
            </div>
            <NoData v-if="!peserta.length" title="Belum ada peserta terdaftar" class="min-h-[200px]" />
            <DataTable v-else :value="peserta" stripedRows class="text-xs" scrollable tableStyle="min-width: 64rem">
              <Column field="namaPegawai" header="Pegawai" headerClass="bg-opensimrs-50"><template #body="{ data: p }"><span class="font-semibold">{{ p.namaPegawai }}</span></template></Column>
              <Column header="Kehadiran" headerClass="bg-opensimrs-50"><template #body="{ data: p }"><span :class="[kelasLencana, warna(p.kehadiran)]">{{ KEHADIRAN_PELATIHAN[p.kehadiran as keyof typeof KEHADIRAN_PELATIHAN] }}</span></template></Column>
              <Column header="Hasil" headerClass="bg-opensimrs-50"><template #body="{ data: p }"><span :class="[kelasLencana, warna(p.hasil)]">{{ HASIL_PELATIHAN[p.hasil as keyof typeof HASIL_PELATIHAN] }}</span></template></Column>
              <Column field="jamHadir" header="Jam hadir" headerClass="bg-opensimrs-50" />
              <Column field="jamDiakui" header="Jam diakui" headerClass="bg-opensimrs-50" />
              <Column header="Verifikasi" headerClass="bg-opensimrs-50"><template #body="{ data: p }"><span :class="[kelasLencana, warna(p.statusVerifikasi)]">{{ label[p.statusVerifikasi] }}</span></template></Column>
              <Column header="Sertifikat" headerClass="bg-opensimrs-50">
                <template #body="{ data: p }">{{ p.nomorSertifikat || 'Belum tercatat' }}<span v-if="p.kredensialUuid" class="text-grey-400"> · {{ p.statusSertifikat === 'dicabut' ? 'Dicabut' : label[p.verifikasiSertifikat] ?? 'Tidak aktif' }}</span></template>
              </Column>
              <Column header="Aksi" headerClass="bg-opensimrs-50">
                <template #body="{ data: p }">
                  <div class="flex flex-wrap gap-2">
                    <CustomButton v-if="boleh('CATAT HASIL') && detail.status === 'berlangsung' && p.statusVerifikasi !== 'terverifikasi'" label="Catat hasil" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaHasil(p)" />
                    <CustomButton v-if="boleh('VERIFIKASI HASIL') && detail.status === 'berlangsung' && p.statusVerifikasi !== 'terverifikasi'" label="Verifikasi" size="small" @click="tindakan('verifikasi', p)" />
                    <CustomButton v-if="boleh('VERIFIKASI HASIL') && detail.status === 'berlangsung' && p.statusVerifikasi === 'terverifikasi'" label="Koreksi" size="small" outlined borderColor="border-warning-300" textColor="text-warning-400" @click="tindakan('koreksi', p)" />
                    <CustomButton v-if="boleh('KELOLA SERTIFIKAT') && p.statusVerifikasi === 'terverifikasi' && p.hasil === 'lulus' && !p.kredensialUuid && detail.status !== 'dibatalkan'" label="Catat sertifikat" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaSertifikat(p)" />
                    <CustomButton v-if="boleh('KELOLA PESERTA') && !['selesai', 'dibatalkan'].includes(detail.status) && p.statusVerifikasi !== 'terverifikasi' && !p.kredensialUuid" label="Batalkan peserta" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="tindakan('batal-peserta', p)" />
                  </div>
                </template>
              </Column>
            </DataTable>
          </template>

          <!-- Daftar katalog / kegiatan -->
          <template v-else-if="bagian === 'daftar'">
            <NoData v-if="!data.length" title="Tidak ada data sesuai filter" class="min-h-[240px]" />
            <DataTable v-else :value="data" stripedRows class="text-xs" scrollable tableStyle="min-width: 48rem">
              <Column :field="tab === 'katalog' ? 'nama' : 'namaPelatihan'" header="Pelatihan" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }"><span class="font-semibold">{{ tab === 'katalog' ? r.nama : r.namaPelatihan }}</span><span v-if="tab === 'katalog' && r.kode" class="ml-1 text-grey-400">({{ r.kode }})</span></template>
              </Column>
              <Column field="kategori" header="Kategori" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ KATEGORI_PELATIHAN[r.kategori as keyof typeof KATEGORI_PELATIHAN] ?? r.kategori }}</template></Column>
              <Column field="jam" header="Jam" headerClass="bg-opensimrs-50" />
              <template v-if="tab === 'katalog'">
                <Column header="Wajib" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><span :class="[kelasLencana, r.wajib ? 'bg-opensimrs-50 text-opensimrs-300' : ABU]">{{ r.wajib ? 'Ya' : 'Tidak' }}</span></template></Column>
                <Column field="masaBerlakuTahun" header="Masa berlaku (tahun)" headerClass="bg-opensimrs-50" />
              </template>
              <template v-else>
                <Column header="Jadwal" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ waktuPelatihan(r.jadwalMulai) }}</template></Column>
                <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><span :class="[kelasLencana, warna(r.status)]">{{ STATUS_PELATIHAN[r.status] }}</span></template></Column>
              </template>
              <Column header="Aksi" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">
                  <div class="flex gap-2">
                    <template v-if="tab === 'katalog' && boleh('KELOLA KATALOG')">
                      <CustomButton label="Ubah" icon="PhPencilSimple" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaKatalog(r)" />
                      <CustomButton label="Hapus" icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="hapusEntriKatalog(r)" />
                    </template>
                    <RouterLink v-if="tab === 'kegiatan'" :to="`/sdm/pelatihan/kegiatan/${r.uuid}`" class="inline-flex items-center h-6 px-2 text-xs font-semibold border-2 rounded-[10px] border-opensimrs-300 text-opensimrs-300">Peserta dan hasil</RouterLink>
                  </div>
                </template>
              </Column>
            </DataTable>
          </template>
        </div>
      </template>

      <template v-if="!memuat && ['daftar', 'rekap', 'detail'].includes(bagian)" #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator v-if="bagian === 'detail'" :totalRecords="totalPeserta" :rows="30" :rowsPerPageOptions="[30]" :first="(halamanPeserta - 1) * 30" @page="(e: any) => { halamanPeserta = e.page + 1; muat(); }" />
          <CustomPaginator v-else :totalRecords="total" :rows="20" :rowsPerPageOptions="[20]" :first="(page - 1) * 20" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <CustomDialog :visible="!!dialog" width="800px" @update:visible="(v: boolean) => { if (!v) dialog = ''; }">
      <template #header>{{ { katalog: 'Katalog Pelatihan', kegiatan: 'Rencana Kegiatan', peserta: 'Pendaftaran Peserta', hasil: 'Kehadiran dan Hasil', sertifikat: 'Sertifikat Pelatihan' }[dialog] }}</template>
      <template #body>
        <form id="form-pelatihan" class="flex flex-col gap-4 pt-4 text-sm" @submit.prevent="simpan">
          <template v-if="dialog === 'katalog'">
            <div class="grid items-end grid-cols-1 gap-4 md:grid-cols-2">
              <label class="flex flex-col"><span :class="kelasLabel">Kode<span class="text-danger-300">*</span></span><input v-model="form.kode" :class="kelasInput" required maxlength="60" /></label>
              <label class="flex flex-col"><span :class="kelasLabel">Nama<span class="text-danger-300">*</span></span><input v-model="form.nama" :class="kelasInput" required maxlength="255" /></label>
              <label class="flex flex-col"><span :class="kelasLabel">Kategori</span><select v-model="form.kategori" :class="kelasInput"><option v-for="(nama, kode) in KATEGORI_PELATIHAN" :key="kode" :value="kode">{{ nama }}</option></select></label>
              <label class="flex flex-col"><span :class="kelasLabel">Jumlah jam<span class="text-danger-300">*</span></span><input v-model="form.jam" :class="kelasInput" type="number" min="0.01" max="999999.99" step="0.01" required /></label>
              <label class="flex flex-col"><span :class="kelasLabel">Masa berlaku (tahun, kosong untuk tanpa kedaluwarsa)</span><input v-model="form.masaBerlakuTahun" :class="kelasInput" type="number" min="1" max="100" /></label>
              <label class="flex items-center h-10 gap-2"><input v-model="form.wajib" :class="kelasCentang" type="checkbox" />Pelatihan wajib</label>
            </div>
            <label class="flex flex-col"><span :class="kelasLabel">Keterangan</span><textarea v-model="form.keterangan" :class="kelasArea" rows="3" maxlength="5000" /></label>
            <div class="p-4 border rounded-lg border-grey-75">
              <div class="mb-3 font-semibold">Cakupan pelatihan</div>
              <div class="flex items-end gap-2 mb-3">
                <CustomTextfield v-model="calonCari" label="Cari pegawai untuk cakupan" prependIcon="PhMagnifyingGlass" class="grow" :maxLength="100" @keydown.enter.prevent="muatPegawai" />
                <CustomButton icon="PhMagnifyingGlass" label="Cari pegawai" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="muatPegawai" />
              </div>
              <CakupanPelatihan v-model="form.cakupan" :referensi="referensi" :pegawai="pegawai" />
            </div>
          </template>
          <template v-if="dialog === 'kegiatan'">
            <div class="grid items-end grid-cols-1 gap-4 md:grid-cols-2">
              <label v-if="!form.uuid" class="flex flex-col md:col-span-2">
                <span :class="kelasLabel">Katalog<span class="text-danger-300">*</span></span>
                <select v-model="form.katalogUuid" :class="kelasInput" required><option value="" disabled>Pilih pelatihan</option><option v-for="k in katalog" :key="k.uuid" :value="k.uuid">{{ k.nama }} · {{ k.jam }} jam</option></select>
              </label>
              <template v-if="!form.uuid">
                <label class="flex flex-col"><span :class="kelasLabel">Tahun kebijakan</span><input v-model.number="tahun" :class="kelasInput" type="number" min="2000" max="2200" @change="muatKebijakanKegiatan" /></label>
                <p v-if="!kebijakan" class="flex items-center h-10 px-3 text-xs rounded-lg bg-warning-50 text-warning-400">Tetapkan kebijakan tahun kegiatan di Pengaturan dahulu.</p>
                <p v-else class="flex items-center h-10 px-3 text-xs rounded-lg bg-info-50 text-info-400">Kebijakan versi {{ kebijakan.versi }} · {{ kebijakan.zonaWaktu }}</p>
              </template>
              <p class="text-xs md:col-span-2 text-grey-400">Jadwal diisi sesuai zona waktu perangkat: {{ Intl.DateTimeFormat().resolvedOptions().timeZone }}.</p>
              <label class="flex flex-col"><span :class="kelasLabel">Jadwal mulai<span class="text-danger-300">*</span></span><input v-model="form.jadwalMulai" :class="kelasInput" type="datetime-local" required /></label>
              <label class="flex flex-col"><span :class="kelasLabel">Jadwal selesai<span class="text-danger-300">*</span></span><input v-model="form.jadwalSelesai" :class="kelasInput" type="datetime-local" required /></label>
              <label class="flex flex-col"><span :class="kelasLabel">Lokasi</span><input v-model="form.lokasi" :class="kelasInput" maxlength="255" /></label>
              <label class="flex flex-col"><span :class="kelasLabel">Penyelenggara</span><input v-model="form.penyelenggara" :class="kelasInput" maxlength="255" /></label>
              <label class="flex flex-col"><span :class="kelasLabel">Kapasitas, opsional</span><input v-model="form.kapasitas" :class="kelasInput" type="number" min="1" max="100000" /></label>
            </div>
            <label class="flex flex-col"><span :class="kelasLabel">Keterangan</span><textarea v-model="form.keterangan" :class="kelasArea" rows="3" maxlength="5000" /></label>
          </template>
          <template v-if="dialog === 'peserta'">
            <div class="flex items-end gap-2">
              <CustomTextfield v-model="calonCari" label="Cari pegawai tertaut" prependIcon="PhMagnifyingGlass" class="grow" :maxLength="100" @keydown.enter.prevent="muatPegawai" />
              <CustomButton icon="PhMagnifyingGlass" label="Cari pegawai" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="muatPegawai" />
            </div>
            <p class="text-xs text-grey-400">Menampilkan maksimal 200 hasil pencarian. Semua pilihan didaftarkan dalam satu transaksi.</p>
            <div class="flex flex-col overflow-auto border divide-y rounded-lg max-h-72 border-grey-75 divide-grey-75">
              <div v-if="!pegawai.length" class="px-3 py-4 text-xs text-center text-grey-400">Tidak ada pegawai sesuai pencarian.</div>
              <label v-for="p in pegawai" :key="p.uuid" class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-grey-50"><input v-model="pilihanPegawai" :class="kelasCentang" type="checkbox" :value="p.uuid" />{{ p.namaPegawai }}</label>
            </div>
            <p class="font-semibold">{{ pilihanPegawai.length }} pegawai dipilih.</p>
          </template>
          <template v-if="dialog === 'hasil'">
            <p class="px-3 py-2 rounded-lg bg-grey-50"><span class="font-semibold">{{ form.namaPegawai }}</span> · {{ detail.jam }} jam kegiatan</p>
            <div class="grid items-end grid-cols-1 gap-4 md:grid-cols-3">
              <label class="flex flex-col"><span :class="kelasLabel">Kehadiran</span><select v-model="form.kehadiran" :class="kelasInput" @change="form.jamHadir = form.kehadiran === 'hadir' ? detail.jam : 0"><option v-for="(nama, kode) in KEHADIRAN_PELATIHAN" :key="kode" :value="kode">{{ nama }}</option></select></label>
              <label class="flex flex-col"><span :class="kelasLabel">Hasil</span><select v-model="form.hasil" :class="kelasInput"><option v-for="(nama, kode) in HASIL_PELATIHAN" :key="kode" :value="kode">{{ nama }}</option></select></label>
              <label class="flex flex-col"><span :class="kelasLabel">Jam hadir<span class="text-danger-300">*</span></span><input v-model="form.jamHadir" :class="kelasInput" type="number" min="0" :max="detail.jam" step="0.01" required /></label>
            </div>
            <p class="text-xs text-grey-400">Jam diakui dihitung server setelah hasil diverifikasi.</p>
          </template>
          <template v-if="dialog === 'sertifikat'">
            <p class="px-3 py-2 text-xs rounded-lg bg-info-50 text-info-400"><span class="font-semibold">{{ form.namaPegawai }}</span> · Data disimpan di kredensial bersama dan tersedia di Mutu sesuai izinnya. Verifikasi keaslian sertifikat dilakukan melalui kredensial bersama.</p>
            <label class="flex flex-col"><span :class="kelasLabel">Pencatatan</span><select v-model="form.mode" :class="kelasInput"><option value="baru">Sertifikat baru</option><option value="tautan">Tautkan kredensial yang sudah ada</option></select></label>
            <label v-if="form.mode === 'tautan'" class="flex flex-col">
              <span :class="kelasLabel">Sertifikat yang sudah tercatat<span class="text-danger-300">*</span></span>
              <select v-model="form.tautanUuid" :class="kelasInput" required><option value="" disabled>Pilih sertifikat pegawai</option><option v-for="s in sertifikatTersedia" :key="s.uuid" :value="s.uuid">{{ s.nomor || 'Tanpa nomor' }} · {{ s.penerbit || 'Penerbit belum diisi' }} · {{ tanggalFormPelatihan(s.tanggalBerakhir) || 'Tanpa kedaluwarsa' }}</option></select>
            </label>
            <div v-else class="grid items-end grid-cols-1 gap-4 md:grid-cols-2">
              <label class="flex flex-col"><span :class="kelasLabel">Nomor sertifikat<span class="text-danger-300">*</span></span><input v-model="form.nomor" :class="kelasInput" maxlength="100" required /></label>
              <label class="flex flex-col"><span :class="kelasLabel">Penerbit<span class="text-danger-300">*</span></span><input v-model="form.penerbit" :class="kelasInput" maxlength="255" required /></label>
              <label class="flex flex-col"><span :class="kelasLabel">Tanggal mulai (WIB)<span class="text-danger-300">*</span></span><input v-model="form.tanggalMulai" :class="kelasInput" type="date" required /></label>
              <label class="flex flex-col"><span :class="kelasLabel">Akhir berlaku (WIB, kosong mengikuti katalog)</span><input v-model="form.tanggalBerakhir" :class="kelasInput" type="date" /></label>
              <label class="flex flex-col md:col-span-2">
                <span :class="kelasLabel">Berkas, opsional (PDF/JPG/PNG)</span>
                <input type="file" accept="application/pdf,image/jpeg,image/png" class="w-full p-2 bg-white border rounded-lg border-grey-200 text-SM file:mr-3 file:rounded-md file:border-0 file:bg-opensimrs-50 file:px-3 file:py-1 file:text-opensimrs-300 file:font-semibold" @change="unggah" />
              </label>
            </div>
          </template>
          <div v-if="galat" class="px-3 py-2 rounded-lg bg-danger-50 text-danger-400" role="alert">{{ galat }}</div>
        </form>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialog = ''" />
          <button :class="kelasTombolSimpan" type="submit" form="form-pelatihan" :disabled="menyimpan">Simpan</button>
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
