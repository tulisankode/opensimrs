<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import ToolbarFilterMenu from "@/components/Base/ToolbarFilterMenu.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomTextArea from "@/components/Base/CustomTextArea.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import ParameterPacu from "./Komponen/ParameterPacu.vue";
import { contohProtokolPacu, type BarisProtokol } from "./Komponen/contohProtokolPacu";
import { apiPenunjangGet, apiPenunjangPost } from "@/utils/apiHandler";
import { izinOk, keTanggalOk, waktuOk } from "@/stores/penunjang/kamarOperasi";
import { useAuthStore } from "@/stores/auth";
import { utilsStore } from "@/stores/utils";

// PACU / Recovery Room (STD-0047): episode pemulihan pascaanestesi yang tertaut ke jadwal operasi & kunjungan asal.
// Alur: jadwal (tindakan dilakukan + laporan anestesi) → episode menunggu masuk → kedatangan + serah terima masuk →
// pemantauan berkala sesuai protokol faskes → asesmen kesiapan pindah (keputusan petugas berwenang, bukan otomatis
// dari skor) → serah terima ke unit tujuan & penerimaan → selesai (biaya PACU idempoten bila protokol mengaktifkannya).
// Parameter, kriteria, interval, dan isi serah terima berasal dari snapshot protokol yang dipakai episode.
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const storeUtils = utilsStore();
const dasar = "/kamar-operasi/pacu";
const boleh = (sub: string, aksi = "READ") => izinOk(`${sub} PACU`, aksi);

type Gaya = { label: string; bg: string; text: string };
const STATUS: Record<string, Gaya> = {
  menunggu_masuk: { label: "Menunggu masuk", bg: "bg-[#FEF0C7]", text: "text-[#B54708]" },
  berada_di_pacu: { label: "Berada di PACU", bg: "bg-[#D1E9FF]", text: "text-[#175CD3]" },
  dalam_pemantauan: { label: "Dalam pemantauan", bg: "bg-[#E0EAFF]", text: "text-[#3538CD]" },
  siap_dipindahkan: { label: "Siap dipindahkan", bg: "bg-[#D1FADF]", text: "text-[#027A48]" },
  selesai: { label: "Selesai", bg: "bg-[#F2F4F7]", text: "text-[#344054]" },
};
const STATUS_AKTIF = ["menunggu_masuk", "berada_di_pacu", "dalam_pemantauan", "siap_dipindahkan"];
const STATUS_BIAYA: Record<string, string> = { tertunda: "Tertunda", terkirim: "Terkirim", gagal: "Gagal", perlu_rekonsiliasi: "Perlu rekonsiliasi" };
const NAMA_CATATAN: Record<string, string> = {
  pemantauan: "Pemantauan",
  asesmen: "Asesmen kesiapan pindah",
  intervensi: "Obat / intervensi",
  serah_terima_masuk: "Serah terima masuk",
  serah_terima_keluar: "Serah terima keluar",
};
const NAMA_AKSI_RIWAYAT: Record<string, string> = {
  buat: "Episode dibuat",
  kedatangan: "Kedatangan",
  mulai_pemantauan: "Mulai pemantauan",
  pemantauan: "Pemantauan",
  asesmen: "Asesmen",
  intervensi: "Intervensi",
  serah_terima: "Serah terima",
  terima: "Serah terima diterima",
  terima_serah_terima: "Serah terima diterima",
  batalkan_serah_terima: "Serah terima dibatalkan",
  selesaikan: "Episode selesai",
  koreksi: "Koreksi",
  koreksi_catatan: "Koreksi catatan",
  tambah: "Catatan ditambahkan",
  buat_biaya: "Biaya dibentuk",
  kirim_biaya: "Pengiriman biaya",
  buat_versi: "Versi protokol dibuat",
  aktifkan: "Protokol diaktifkan",
};
// Kunci objek dinamis (nilai parameter) dikonversi ke camelCase oleh axios; kembalikan ke kode protokol (snake_case).
const keSnake = (k: string) => k.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
const snakeKunci = (o: Record<string, any> | null | undefined) => Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [keSnake(k), v]));
const keEpoch = (d: Date | null) => (d ? Math.floor(d.getTime() / 1000) : null);
const dariEpoch = (n: any) => (Number(n) ? new Date(Number(n) * 1000) : null);
const tampil = (v: any) => (typeof v === "boolean" ? (v ? "Ya" : "Tidak") : v === null || v === undefined || v === "" ? "-" : String(v));
let generasi = 0;

// ── Referensi
const protokol = ref<any[]>([]);
const petugas = ref<any[]>([]);
const unit = ref<any[]>([]);
const namaUnit = (uuid?: string | null) => unit.value.find((u) => u.uuid === uuid)?.nama ?? "-";
const namaPetugas = (uuid?: string | null) => petugas.value.find((p) => p.uuid === uuid)?.nama ?? uuid ?? "-";
const muatProtokol = async () => {
  if (!boleh("Protokol")) return;
  const nomor = generasi;
  const r = await apiPenunjangGet(`${dasar}/protokol`);
  if (nomor === generasi) protokol.value = r?.payload ?? [];
};
const muatReferensi = async () => {
  const nomor = generasi;
  if (!boleh("Episode")) return;
  const [p, u] = await Promise.all([apiPenunjangGet(`${dasar}/referensi/petugas`), apiPenunjangGet(`${dasar}/referensi/unit`)]);
  if (nomor !== generasi) return;
  petugas.value = p?.payload ?? [];
  unit.value = u?.payload ?? [];
  await muatProtokol();
};

// ── Antrean
const antrean = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const tglMulai = ref<Date | null>(null);
const tglSelesai = ref<Date | null>(null);
const filterStatus = ref<string[]>([...STATUS_AKTIF]);
const toggleStatus = (nilai: string) => {
  filterStatus.value = filterStatus.value.includes(nilai) ? filterStatus.value.filter((x) => x !== nilai) : [...filterStatus.value, nilai];
};
const muatAntrean = async () => {
  if (!boleh("Episode")) return;
  const nomor = ++generasi;
  storeUtils.setLoading(true);
  try {
    const q = new URLSearchParams({ page: String(page.value), limit: String(limit.value) });
    if (filterStatus.value.length) q.set("status", filterStatus.value.join(","));
    if (tglMulai.value) q.set("tanggal_mulai", keTanggalOk(tglMulai.value));
    if (tglSelesai.value) q.set("tanggal_selesai", keTanggalOk(tglSelesai.value));
    const r = await apiPenunjangGet(`${dasar}?${q.toString()}`);
    if (nomor !== generasi) return;
    antrean.value = r?.payload?.data ?? [];
    total.value = r?.payload?.pagination?.total ?? 0;
  } finally {
    storeUtils.setLoading(false);
  }
};
const cari = () => {
  page.value = 1;
  muatAntrean();
};
const reset = () => {
  tglMulai.value = null;
  tglSelesai.value = null;
  filterStatus.value = [...STATUS_AKTIF];
  cari();
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  page.value = e.page + 1;
  limit.value = e.rows;
  muatAntrean();
};

// ── Episode baru dari jadwal operasi
const dialogBaru = ref(false);
const tanggalJadwal = ref<Date | null>(new Date());
const jadwalSumber = ref<any[]>([]);
const jadwalUuid = ref("");
const protokolUuid = ref("");
const protokolAktif = computed(() => protokol.value.filter((p) => p.aktif).map((p) => ({ ...p, labelPilihan: `${p.definisi?.nama} — versi ${p.nomorVersi}` })));
const jadwalTerpilih = computed(() => jadwalSumber.value.find((j) => j.uuid === jadwalUuid.value) ?? null);
const opsiJadwal = computed(() =>
  jadwalSumber.value.map((j) => ({ ...j, labelPilihan: `${waktuOk(j.waktuMulai)} · ${j.namaPasien} · ${j.noReg ?? j.noRm ?? "-"} · ${j.ruangNama}${j.episodeUuid ? " (episode sudah ada)" : ""}` })),
);
const muatJadwalSumber = async (uuid?: string) => {
  const q = new URLSearchParams();
  if (uuid) q.set("jadwal_uuid", uuid);
  else if (tanggalJadwal.value) q.set("tanggal", keTanggalOk(tanggalJadwal.value));
  const r = await apiPenunjangGet(`${dasar}/referensi/jadwal?${q.toString()}`);
  jadwalSumber.value = r?.payload ?? [];
};
const bukaBaru = async (uuid?: string) => {
  jadwalUuid.value = "";
  protokolUuid.value = protokolAktif.value.length === 1 ? protokolAktif.value[0].uuid : "";
  await muatJadwalSumber(uuid);
  if (uuid) {
    const j = jadwalSumber.value.find((x) => x.uuid === uuid);
    // Jadwal sudah punya episode: langsung buka episodenya (tidak membuat episode ganda).
    if (j?.episodeUuid) return router.push(`${dasar}/${j.episodeUuid}`);
    if (!boleh("Episode", "CREATE")) return;
    if (j) jadwalUuid.value = j.uuid;
  }
  dialogBaru.value = true;
};
const buat = async () => {
  if (!jadwalUuid.value || !protokolUuid.value) return;
  if (jadwalTerpilih.value?.episodeUuid) return router.push(`${dasar}/${jadwalTerpilih.value.episodeUuid}`);
  storeUtils.setLoading(true);
  try {
    const r = await apiPenunjangPost(dasar, { jadwalOperasiUuid: jadwalUuid.value, protokolUuid: protokolUuid.value });
    if (r?.payload) {
      dialogBaru.value = false;
      await router.push(`${dasar}/${r.payload.uuid}`);
    }
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Protokol (versi berkala; versi yang sudah dipakai episode tersimpan sebagai snapshot)
const dialogProtokol = ref(false);
const kodeProtokol = ref("");
const namaProtokol = ref("");
const intervalMenit = ref<string | null>(null);
const parameter = ref<BarisProtokol[]>([]);
const kriteria = ref<BarisProtokol[]>([]);
const format = ref<BarisProtokol[]>([]);
const biayaAktif = ref(false);
const termasukPaket = ref(false);
const layananUuid = ref("");
const namaBiaya = ref("");
const tarif = ref<string | null>(null);
const kelompokDefinisi = [
  { nama: "Parameter pemantauan", daftar: parameter },
  { nama: "Kriteria kesiapan pindah", daftar: kriteria },
  { nama: "Isi serah terima", daftar: format },
];
const TIPE = [
  { kode: "angka", nama: "Angka" },
  { kode: "teks", nama: "Teks" },
  { kode: "pilihan", nama: "Pilihan" },
  { kode: "boolean", nama: "Ya / tidak" },
];
const barisBaru = (): BarisProtokol => ({ kode: "", nama: "", tipe: "teks", wajib: true, satuan: "", pilihanTeks: "" });
const keBaris = (daftar: any[]): BarisProtokol[] =>
  (daftar ?? []).map((p) => ({ kode: p.kode, nama: p.nama, tipe: p.tipe, wajib: !!p.wajib, satuan: p.satuan ?? "", pilihanTeks: (p.pilihan ?? []).join(", ") }));
const daftarDefinisi = (daftar: BarisProtokol[]) =>
  daftar.map((p) => ({
    kode: p.kode.trim(),
    nama: p.nama.trim(),
    tipe: p.tipe,
    wajib: p.wajib,
    ...(p.tipe === "angka" ? { satuan: p.satuan.trim() } : {}),
    ...(p.tipe === "pilihan" ? { pilihan: p.pilihanTeks.split(",").map((s) => s.trim()).filter(Boolean) } : {}),
  }));
const kosongkanProtokol = () => {
  kodeProtokol.value = "";
  namaProtokol.value = "";
  intervalMenit.value = null;
  parameter.value = [];
  kriteria.value = [];
  format.value = [];
  biayaAktif.value = false;
  termasukPaket.value = false;
  layananUuid.value = "";
  namaBiaya.value = "";
  tarif.value = null;
};
const isiContoh = () => {
  const c = contohProtokolPacu();
  kodeProtokol.value = c.kode;
  namaProtokol.value = c.nama;
  parameter.value = c.parameter;
  kriteria.value = c.kriteria;
  format.value = c.format;
};
const salinProtokol = (p: any) => {
  const d = p.definisi ?? {};
  kodeProtokol.value = p.kode;
  namaProtokol.value = d.nama ?? "";
  intervalMenit.value = d.intervalPemantauanDetik ? String(Math.round(d.intervalPemantauanDetik / 60)) : null;
  parameter.value = keBaris(d.parameter);
  kriteria.value = keBaris(d.kriteriaPindah);
  format.value = keBaris(d.formatSerahTerima);
  biayaAktif.value = !!d.biaya?.aktif;
  termasukPaket.value = !!d.biaya?.termasukPaket;
  layananUuid.value = d.biaya?.layananUuid ?? "";
  namaBiaya.value = d.biaya?.nama ?? "";
  tarif.value = d.biaya?.tarif ? String(d.biaya.tarif) : null;
};
const bukaProtokol = async () => {
  await muatProtokol();
  dialogProtokol.value = true;
};
const simpanProtokol = async () => {
  storeUtils.setLoading(true);
  try {
    const r = await apiPenunjangPost(`${dasar}/protokol`, {
      kode: kodeProtokol.value.trim(),
      definisi: {
        nama: namaProtokol.value,
        intervalPemantauanDetik: intervalMenit.value ? Math.round(Number(intervalMenit.value) * 60) : null,
        parameter: daftarDefinisi(parameter.value),
        kriteriaPindah: daftarDefinisi(kriteria.value),
        formatSerahTerima: daftarDefinisi(format.value),
        biaya: biayaAktif.value
          ? { aktif: true, termasukPaket: termasukPaket.value, ...(termasukPaket.value ? {} : { layananUuid: layananUuid.value, nama: namaBiaya.value, tarif: Number(tarif.value) }) }
          : { aktif: false },
      },
    });
    if (r?.payload) {
      kosongkanProtokol();
      await muatProtokol();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const aktifkanProtokol = async (p: any) => {
  storeUtils.setLoading(true);
  try {
    if ((await apiPenunjangPost(`${dasar}/protokol/${p.uuid}/aktifkan`, { versi: p.versi }))?.payload) await muatProtokol();
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Detail episode
const episode = ref<any>(null);
const daftarCatatan = ref<any[]>([]);
const riwayat = ref<any[]>([]);
const biaya = ref<any[]>([]);
const tab = ref("pemantauan");
const snapshot = computed(() => episode.value?.protokolSnapshot ?? {});
const pemantauan = computed(() => daftarCatatan.value.filter((c) => c.jenis === "pemantauan"));
const catatanLain = computed(() => daftarCatatan.value.filter((c) => c.jenis !== "pemantauan"));
const serahTerimaTerbuka = computed(() => daftarCatatan.value.filter((c) => c.jenis === "serah_terima_keluar" && !c.data?.dibatalkan && !c.data?.penerima));
const intervalLabel = computed(() => (snapshot.value.intervalPemantauanDetik ? `${Math.round(snapshot.value.intervalPemantauanDetik / 60)} menit` : "-"));
const pemantauanBerikut = computed(() => {
  const t = Number(pemantauan.value[pemantauan.value.length - 1]?.waktuKejadian ?? episode.value?.waktuMulaiPemantauan ?? 0);
  return t && snapshot.value.intervalPemantauanDetik && ["dalam_pemantauan", "siap_dipindahkan"].includes(episode.value?.status)
    ? t + Number(snapshot.value.intervalPemantauanDetik)
    : null;
});
const muatDetail = async () => {
  const id = String(route.params.uuid ?? "");
  if (!id) return;
  const nomor = ++generasi;
  episode.value = null;
  daftarCatatan.value = [];
  riwayat.value = [];
  biaya.value = [];
  storeUtils.setLoading(true);
  try {
    const r = await apiPenunjangGet(`${dasar}/${id}`);
    if (nomor !== generasi) return;
    episode.value = r?.payload ?? null;
    if (!episode.value) return;
    const kelompok = [
      ["pemantauan", "Pemantauan"],
      ["asesmen", "Asesmen"],
      ["intervensi", "Intervensi"],
      ["serah-terima", "Serah Terima"],
    ].filter(([, sub]) => boleh(sub));
    const hasil = await Promise.all(kelompok.map(([path]) => apiPenunjangGet(`${dasar}/${id}/${path}?limit=9999`)));
    const [b, h] = await Promise.all([
      boleh("Biaya") ? apiPenunjangGet(`${dasar}/${id}/biaya?limit=100`) : null,
      boleh("Riwayat") ? apiPenunjangGet(`${dasar}/${id}/riwayat?limit=200`) : null,
    ]);
    if (nomor !== generasi) return;
    daftarCatatan.value = hasil
      .flatMap((c) => c?.payload?.data ?? [])
      .sort((a, z) => Number(a.waktuKejadian) - Number(z.waktuKejadian));
    biaya.value = b?.payload ?? [];
    riwayat.value = h?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};

const rincianCatatan = (c: any) => {
  const d = c.data ?? {};
  const baris: Array<{ nama: string; nilai: string }> = [];
  const tambah = (nama: string, nilai: any) => baris.push({ nama, nilai: tampil(nilai) });
  const definisi = c.jenis === "asesmen" ? snapshot.value.kriteriaPindah : c.jenis.startsWith("serah_terima") ? snapshot.value.formatSerahTerima : [];
  const nilai = snakeKunci(c.jenis === "asesmen" ? d.hasilKriteria : d.isi);
  for (const x of definisi ?? []) tambah(x.nama + (x.satuan ? ` (${x.satuan})` : ""), nilai[x.kode]);
  if (c.jenis === "asesmen") {
    tambah("Keputusan", d.keputusan === "siap" ? "Siap dipindahkan" : "Belum siap");
    tambah("Hasil asesmen", d.hasilAsesmen);
    tambah("Alasan", d.alasan);
    if (d.unitTujuanUuid) tambah("Unit tujuan", namaUnit(d.unitTujuanUuid));
  }
  if (c.jenis === "intervensi") {
    tambah("Jenis", { obat: "Obat", bhp: "BHP", tindakan: "Tindakan" }[d.jenis as string] ?? d.jenis);
    tambah("Nama", d.rincian?.nama);
    if (d.rincian?.dosis) tambah("Dosis", `${d.rincian.dosis} ${d.rincian.satuan ?? ""}`.trim());
    if (d.rincian?.rute) tambah("Rute", d.rincian.rute);
    tambah("Pelaksana", namaPetugas(d.pelaksanaUuid));
  }
  if (c.jenis === "serah_terima_masuk") tambah("Penyerah (tim OK)", namaPetugas(d.penyerahUuid));
  if (c.jenis === "serah_terima_keluar") {
    tambah("Unit tujuan", namaUnit(d.unitTujuanUuid));
    tambah("Penyerah", d.penyerah);
    tambah("Penerima", d.penerima ?? "Belum diterima");
    if (d.waktuTerima) tambah("Waktu diterima", waktuOk(d.waktuTerima));
    if (d.dibatalkan) tambah("Status", "Dibatalkan oleh asesmen baru");
  }
  if (d.catatan) tambah("Catatan", d.catatan);
  return baris;
};
const ABAIKAN_RIWAYAT = ["versi", "updatedAt", "updatedBy", "createdAt", "createdBy", "id"];
const perubahanRiwayat = (h: any) => {
  const lama = h.nilaiSebelum ?? {};
  const baru = h.nilaiSesudah ?? {};
  const kunci = [...new Set([...Object.keys(lama), ...Object.keys(baru)])].filter((k) => !ABAIKAN_RIWAYAT.includes(k));
  return kunci
    .filter((k) => JSON.stringify(lama[k]) !== JSON.stringify(baru[k]))
    .map((k) => `${keSnake(k)}: ${h.nilaiSebelum ? `${JSON.stringify(lama[k] ?? null)} → ` : ""}${JSON.stringify(baru[k] ?? null)}`);
};

// ── Aksi klinis (satu dialog, isian menyesuaikan aksi)
type KodeAksi = "kedatangan" | "mulai-pemantauan" | "pemantauan" | "asesmen" | "intervensi" | "serah-terima" | "terima" | "selesaikan" | "koreksi" | "koreksi-catatan";
const LABEL_AKSI: Record<KodeAksi, string> = {
  kedatangan: "Catat Kedatangan",
  "mulai-pemantauan": "Mulai Pemantauan",
  pemantauan: "Catat Pemantauan",
  asesmen: "Asesmen Kesiapan Pindah",
  intervensi: "Obat / Intervensi",
  "serah-terima": "Serahkan ke Unit Tujuan",
  terima: "Terima Serah Terima",
  selesaikan: "Selesaikan Episode",
  koreksi: "Koreksi Waktu",
  "koreksi-catatan": "Koreksi Catatan",
};
const daftarAksi = computed(() => {
  const e = episode.value;
  if (!e) return [] as Array<{ kode: KodeAksi; icon: string; utama?: boolean }>;
  const s = e.status;
  const a: Array<{ kode: KodeAksi; icon: string; utama?: boolean }> = [];
  if (s === "menunggu_masuk" && boleh("Episode", "TERIMA") && boleh("Serah Terima", "CREATE")) a.push({ kode: "kedatangan", icon: "PhSignIn", utama: true });
  if (s === "berada_di_pacu" && boleh("Episode", "UPDATE")) a.push({ kode: "mulai-pemantauan", icon: "PhPlay", utama: true });
  if (["dalam_pemantauan", "siap_dipindahkan"].includes(s)) {
    if (boleh("Pemantauan", "CREATE")) a.push({ kode: "pemantauan", icon: "PhHeartbeat", utama: s === "dalam_pemantauan" });
    if (boleh("Intervensi", "CREATE")) a.push({ kode: "intervensi", icon: "PhPill" });
    if (boleh("Asesmen", "VALIDASI")) a.push({ kode: "asesmen", icon: "PhStethoscope" });
  }
  if (s === "siap_dipindahkan") {
    const adaKeluar = daftarCatatan.value.some((c) => c.jenis === "serah_terima_keluar" && !c.data?.dibatalkan);
    if (!adaKeluar && boleh("Serah Terima", "CREATE")) a.push({ kode: "serah-terima", icon: "PhArrowsLeftRight", utama: true });
    if (serahTerimaTerbuka.value.length && boleh("Serah Terima", "TERIMA")) a.push({ kode: "terima", icon: "PhHandshake", utama: true });
    if (boleh("Episode", "SELESAIKAN")) a.push({ kode: "selesaikan", icon: "PhCheckCircle" });
  }
  if (boleh("Koreksi", "UPDATE") && (e.waktuTiba || e.waktuMulaiPemantauan || e.waktuKeluar)) a.push({ kode: "koreksi", icon: "PhPencilSimple" });
  return a;
});

const dialogAksi = ref(false);
const aksi = ref<KodeAksi | "">("");
const waktu = ref<Date | null>(new Date());
const nilai = ref<Record<string, any>>({});
const hasilKriteria = ref<Record<string, any>>({});
const catatan = ref<string | null>("");
const hasilAsesmen = ref<string | null>("");
const keputusan = ref("belum_siap");
const unitTujuan = ref("");
const petugasUuid = ref("");
const jenisIntervensi = ref("tindakan");
const rincian = ref({ nama: "", dosis: "", satuan: "", rute: "" });
const alasan = ref<string | null>("");
const serahUuid = ref("");
const kolomKoreksi = ref("waktu_tiba");
const catatanDikoreksi = ref<any>(null);
const galatAksi = ref("");
const KOLOM_WAKTU = [
  { kode: "waktu_tiba", nama: "Waktu tiba", kunci: "waktuTiba" },
  { kode: "waktu_mulai_pemantauan", nama: "Mulai pemantauan", kunci: "waktuMulaiPemantauan" },
  { kode: "waktu_keluar", nama: "Waktu keluar", kunci: "waktuKeluar" },
];
const kolomKoreksiTersedia = computed(() => KOLOM_WAKTU.filter((k) => episode.value?.[k.kunci]));
const awalBoolean = (definisi: any[]) => Object.fromEntries((definisi ?? []).filter((p) => p.tipe === "boolean").map((p) => [p.kode, false]));
const bukaAksi = (kode: KodeAksi, c: any = null) => {
  aksi.value = kode;
  galatAksi.value = "";
  waktu.value = new Date();
  catatan.value = "";
  hasilAsesmen.value = "";
  alasan.value = "";
  keputusan.value = "belum_siap";
  petugasUuid.value = "";
  jenisIntervensi.value = "tindakan";
  rincian.value = { nama: "", dosis: "", satuan: "", rute: "" };
  unitTujuan.value = episode.value?.unitTujuanUuid ?? "";
  serahUuid.value = serahTerimaTerbuka.value.length === 1 ? serahTerimaTerbuka.value[0].uuid : "";
  catatanDikoreksi.value = c;
  nilai.value = awalBoolean(kode === "pemantauan" ? snapshot.value.parameter : snapshot.value.formatSerahTerima);
  hasilKriteria.value = awalBoolean(snapshot.value.kriteriaPindah);
  if (kode === "koreksi") {
    kolomKoreksi.value = kolomKoreksiTersedia.value[0]?.kode ?? "waktu_tiba";
    waktu.value = dariEpoch(episode.value?.[KOLOM_WAKTU.find((k) => k.kode === kolomKoreksi.value)?.kunci ?? ""]);
  }
  if (kode === "koreksi-catatan" && c) {
    const d = c.data ?? {};
    waktu.value = dariEpoch(c.waktuKejadian);
    nilai.value = snakeKunci(d.nilaiParameter);
    hasilKriteria.value = snakeKunci(d.hasilKriteria);
    catatan.value = d.catatan ?? "";
    hasilAsesmen.value = d.hasilAsesmen ?? "";
    rincian.value = { nama: "", dosis: "", satuan: "", rute: "", ...(d.rincian ?? {}) };
    jenisIntervensi.value = d.jenis ?? "tindakan";
  }
  dialogAksi.value = true;
};
watch(kolomKoreksi, (k) => {
  if (aksi.value === "koreksi") waktu.value = dariEpoch(episode.value?.[KOLOM_WAKTU.find((x) => x.kode === k)?.kunci ?? ""]);
});

const simpanAksi = async () => {
  if (!episode.value || !aksi.value) return;
  const t = keEpoch(waktu.value);
  if (!t && aksi.value !== "terima") return (galatAksi.value = "Waktu kejadian wajib diisi");
  const b: Record<string, any> = { versi: episode.value.versi };
  let path: string = aksi.value;
  switch (aksi.value) {
    case "kedatangan":
      Object.assign(b, { waktuTiba: t, serahTerimaMasuk: { penyerahUuid: petugasUuid.value, isi: nilai.value } });
      break;
    case "mulai-pemantauan":
      b.waktuMulaiPemantauan = t;
      break;
    case "pemantauan":
      Object.assign(b, { waktuUkur: t, nilaiParameter: nilai.value, catatan: catatan.value || null });
      break;
    case "asesmen":
      Object.assign(b, {
        waktuAsesmen: t,
        hasilAsesmen: hasilAsesmen.value,
        hasilKriteria: hasilKriteria.value,
        keputusan: keputusan.value,
        alasan: alasan.value,
        unitTujuanUuid: keputusan.value === "siap" ? unitTujuan.value : null,
      });
      break;
    case "intervensi":
      Object.assign(b, { waktuTindakan: t, jenis: jenisIntervensi.value, pelaksanaUuid: petugasUuid.value, rincian: rincian.value, catatan: catatan.value || null });
      break;
    case "serah-terima":
      Object.assign(b, { waktuSerah: t, unitTujuanUuid: unitTujuan.value, isi: nilai.value });
      break;
    case "terima":
      path = `serah-terima/${serahUuid.value}/terima`;
      b.waktuTerima = t;
      break;
    case "selesaikan":
      b.waktuKeluar = t;
      break;
    case "koreksi":
      Object.assign(b, { jenisEntitas: "episode", alasan: alasan.value, perubahan: { [kolomKoreksi.value]: t } });
      break;
    case "koreksi-catatan": {
      path = "koreksi";
      const c = catatanDikoreksi.value;
      const perubahan =
        c.jenis === "pemantauan"
          ? { nilaiParameter: nilai.value, catatan: catatan.value || null, waktuKejadian: t }
          : c.jenis === "asesmen"
            ? { hasilAsesmen: hasilAsesmen.value, hasilKriteria: hasilKriteria.value }
            : { rincian: rincian.value, catatan: catatan.value || null, waktuKejadian: t };
      Object.assign(b, { jenisEntitas: "catatan", entitasUuid: c.uuid, versiCatatan: c.versi, alasan: alasan.value, perubahan });
      break;
    }
  }
  const episodeUuid = episode.value.uuid;
  storeUtils.setLoading(true);
  try {
    const r = await apiPenunjangPost(`${dasar}/${episodeUuid}/${path}`, b);
    if (r?.payload) {
      dialogAksi.value = false;
      if (r.payload.biaya?.statusKirim === "perlu_rekonsiliasi") tab.value = "biaya";
      if (episodeUuid === episode.value?.uuid) await muatDetail();
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const kirimBiaya = async (b: any) => {
  if (!episode.value) return;
  storeUtils.setLoading(true);
  try {
    await apiPenunjangPost(`${dasar}/${episode.value.uuid}/biaya/kirim-ulang`, { biayaUuid: b.uuid });
    await muatDetail();
  } finally {
    storeUtils.setLoading(false);
  }
};

// ── Siklus halaman
const muatHalaman = async () => {
  if (route.params.uuid) return muatDetail();
  await muatAntrean();
  if (route.query.jadwal) {
    const uuid = String(route.query.jadwal);
    await router.replace({ path: dasar });
    await bukaBaru(uuid);
  }
};
const bersihkan = () => {
  generasi++;
  episode.value = null;
  antrean.value = [];
  daftarCatatan.value = [];
  riwayat.value = [];
  biaya.value = [];
  protokol.value = [];
  petugas.value = [];
  unit.value = [];
  jadwalSumber.value = [];
  dialogAksi.value = false;
  dialogBaru.value = false;
  dialogProtokol.value = false;
  kosongkanProtokol();
};
// Ganti faskes / akun: buang seluruh data faskes sebelumnya lalu kembali ke antrean.
watch(
  () => auth.faskesUuid,
  async (baru, lama) => {
    if (baru === lama) return;
    bersihkan();
    if (route.params.uuid) await router.replace(dasar);
    if (baru) {
      await muatReferensi();
      await muatHalaman();
    }
  },
);
watch(
  () => route.params.uuid,
  () => {
    dialogAksi.value = false;
    tab.value = "pemantauan";
    muatHalaman();
  },
);
onMounted(async () => {
  await muatReferensi();
  await muatHalaman();
});
onBeforeUnmount(bersihkan);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- ── Antrean PACU ─────────────────────────────────────────── -->
    <Card v-if="!route.params.uuid" pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muatAntrean" />
          <h1 class="toolbar-heading text-opensimrs-300">PACU / Recovery Room</h1>
          <CustomDatePicker v-model="tglMulai" label="Tanggal mulai" class="toolbar-field--date" :maxDate="tglSelesai ?? undefined" />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker v-model="tglSelesai" label="Tanggal selesai" class="toolbar-field--date" :minDate="tglMulai ?? undefined" />
          <ToolbarFilterMenu :count="filterStatus.length">
            <template #label>Status</template>
            <CustomChip v-for="(s, kode) in STATUS" :key="kode" :label="s.label" :value="String(kode)" :isSelected="filterStatus.includes(String(kode))" @selected="toggleStatus" />
          </ToolbarFilterMenu>
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="cari" />
          <CustomButton label="Reset" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="reset" />
          <CustomButton v-if="boleh('Protokol')" label="Protokol" icon="PhSlidersHorizontal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaProtokol" />
          <CustomButton v-if="boleh('Episode', 'CREATE')" label="Episode Baru" icon="PhPlus" @click="bukaBaru()" />
        </PageToolbar>
      </template>
      <template #content>
        <div v-if="!boleh('Episode')" class="p-6 text-sm text-grey-400">Anda tidak memiliki izin Kamar Operasi › Episode PACU › READ.</div>
        <NoData v-else-if="!antrean.length" />
        <DataTable v-else :value="antrean" stripedRows class="text-xs cursor-pointer" scrollable scrollHeight="flex" tableStyle="min-width: 60rem" @rowClick="router.push(`${dasar}/${$event.data.uuid}`)">
          <Column header="Pasien" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <div class="font-semibold">{{ d.namaPasien }}</div>
              <div class="text-grey-400">{{ d.noRm ?? "-" }} · {{ d.noReg ?? "-" }}</div>
            </template>
          </Column>
          <Column header="Status" headerClass="bg-opensimrs-50">
            <template #body="{ data: d }">
              <span class="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap" :class="[STATUS[d.status]?.bg, STATUS[d.status]?.text]">{{ STATUS[d.status]?.label ?? d.status }}</span>
            </template>
          </Column>
          <Column header="Tiba" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ waktuOk(d.waktuTiba) }}</template></Column>
          <Column header="Mulai Pemantauan" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ waktuOk(d.waktuMulaiPemantauan) }}</template></Column>
          <Column header="Siap Pindah" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ waktuOk(d.waktuSiapPindah) }}</template></Column>
          <Column header="Unit Tujuan" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.unitTujuanNama ?? "-" }}</template></Column>
          <Column header="Keluar" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ waktuOk(d.waktuKeluar) }}</template></Column>
        </DataTable>
      </template>
      <template #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :rows="limit" :totalRecords="total" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <!-- ── Detail episode ───────────────────────────────────────── -->
    <Card v-else pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowLeft" label="Antrean" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="router.push(dasar)" />
          <CustomButton icon="PhArrowClockwise" @click="muatDetail" />
          <h1 class="toolbar-heading text-opensimrs-300">Episode PACU</h1>
          <span v-if="episode" class="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap" :class="[STATUS[episode.status]?.bg, STATUS[episode.status]?.text]">
            {{ STATUS[episode.status]?.label ?? episode.status }}
          </span>
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!episode" />
        <div v-else class="flex flex-col gap-4 pb-4">
          <div class="grid grid-cols-4 gap-x-6 gap-y-2 p-3 text-sm rounded-lg bg-opensimrs-50">
            <div><div class="text-xs text-grey-400">Pasien</div><div class="font-semibold">{{ episode.konteks.namaPasien }}</div></div>
            <div><div class="text-xs text-grey-400">No. RM · No. Reg</div><div>{{ episode.konteks.noRm ?? "-" }} · {{ episode.konteks.noReg ?? "-" }}</div></div>
            <div><div class="text-xs text-grey-400">Operasi</div><div>{{ waktuOk(episode.konteks.waktuOperasi) }} · {{ episode.konteks.ruangNama }}</div></div>
            <div><div class="text-xs text-grey-400">Tindakan dilakukan</div><div>{{ episode.konteks.tindakanDilakukan ?? "-" }}</div></div>
            <div><div class="text-xs text-grey-400">Anestesi</div><div>{{ episode.konteks.jenisAnestesi ?? "-" }}</div></div>
            <div>
              <div class="text-xs text-grey-400">Aldrete (laporan anestesi)</div>
              <div>Masuk {{ tampil(episode.konteks.aldreteMasuk) }} · Keluar {{ tampil(episode.konteks.aldreteKeluar) }}</div>
            </div>
            <div>
              <div class="text-xs text-grey-400">Protokol</div>
              <div>{{ snapshot.nama }} · versi {{ episode.konteks.protokolVersi ?? "-" }}</div>
            </div>
            <div><div class="text-xs text-grey-400">Interval pemantauan · Unit tujuan</div><div>{{ intervalLabel }} · {{ namaUnit(episode.unitTujuanUuid) }}</div></div>
          </div>

          <div class="grid grid-cols-4 gap-3 text-sm">
            <div v-for="t in [
              { nama: 'Tiba di PACU', nilai: episode.waktuTiba },
              { nama: 'Mulai pemantauan', nilai: episode.waktuMulaiPemantauan },
              { nama: 'Siap pindah', nilai: episode.waktuSiapPindah },
              { nama: 'Keluar PACU', nilai: episode.waktuKeluar },
            ]" :key="t.nama" class="p-3 border rounded-lg border-grey-75" :class="{ 'border-opensimrs-300': t.nilai }">
              <div class="text-xs text-grey-400">{{ t.nama }}</div>
              <div class="font-semibold">{{ waktuOk(t.nilai) }}</div>
            </div>
          </div>
          <div v-if="pemantauanBerikut" class="text-sm" :class="pemantauanBerikut < Date.now() / 1000 ? 'text-danger-300 font-semibold' : 'text-grey-500'">
            Pemantauan berikutnya sesuai protokol: {{ waktuOk(pemantauanBerikut) }}{{ pemantauanBerikut < Date.now() / 1000 ? " (terlewat)" : "" }}
          </div>

          <div v-if="daftarAksi.length" class="flex flex-wrap gap-2">
            <template v-for="a in daftarAksi" :key="a.kode">
              <CustomButton v-if="a.utama" :label="LABEL_AKSI[a.kode]" :icon="a.icon" @click="bukaAksi(a.kode)" />
              <CustomButton v-else :label="LABEL_AKSI[a.kode]" :icon="a.icon" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaAksi(a.kode)" />
            </template>
          </div>

          <Tabs v-model:value="tab">
            <TabList>
              <Tab value="pemantauan">Pemantauan ({{ pemantauan.length }})</Tab>
              <Tab value="catatan">Asesmen, Intervensi & Serah Terima ({{ catatanLain.length }})</Tab>
              <Tab v-if="boleh('Biaya')" value="biaya">Biaya</Tab>
              <Tab v-if="boleh('Riwayat')" value="riwayat">Riwayat</Tab>
            </TabList>
            <TabPanels>
              <TabPanel value="pemantauan">
                <NoData v-if="!pemantauan.length" />
                <DataTable v-else :value="[...pemantauan].reverse()" stripedRows class="text-xs" scrollable tableStyle="min-width: 50rem">
                  <Column header="Waktu" headerClass="bg-opensimrs-50"><template #body="{ data: c }">{{ waktuOk(c.waktuKejadian) }}</template></Column>
                  <Column v-for="p in snapshot.parameter ?? []" :key="p.kode" :header="p.nama + (p.satuan ? ` (${p.satuan})` : '')" headerClass="bg-opensimrs-50">
                    <template #body="{ data: c }">{{ tampil(snakeKunci(c.data?.nilaiParameter)[p.kode]) }}</template>
                  </Column>
                  <Column header="Catatan" headerClass="bg-opensimrs-50"><template #body="{ data: c }">{{ c.data?.catatan ?? "" }}</template></Column>
                  <Column header="Pencatat" headerClass="bg-opensimrs-50"><template #body="{ data: c }">{{ c.createdBy }}</template></Column>
                  <Column header="" headerClass="bg-opensimrs-50">
                    <template #body="{ data: c }">
                      <CustomButton v-if="boleh('Koreksi', 'UPDATE')" label="Koreksi" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaAksi('koreksi-catatan', c)" />
                    </template>
                  </Column>
                </DataTable>
              </TabPanel>
              <TabPanel value="catatan">
                <NoData v-if="!catatanLain.length" />
                <div v-else class="flex flex-col gap-3">
                  <div v-for="c in [...catatanLain].reverse()" :key="c.uuid" class="p-3 border rounded-lg border-grey-75" :class="{ 'opacity-60': c.data?.dibatalkan }">
                    <div class="flex items-center justify-between gap-2 mb-2">
                      <div class="text-sm font-semibold text-opensimrs-300">{{ NAMA_CATATAN[c.jenis] ?? c.jenis }} · {{ waktuOk(c.waktuKejadian) }}</div>
                      <div class="flex items-center gap-2 text-xs text-grey-400">
                        {{ c.createdBy }}
                        <CustomButton
                          v-if="boleh('Koreksi', 'UPDATE') && ['asesmen', 'intervensi'].includes(c.jenis)"
                          label="Koreksi"
                          size="small"
                          outlined
                          borderColor="border-opensimrs-300"
                          textColor="text-opensimrs-300"
                          @click="bukaAksi('koreksi-catatan', c)"
                        />
                      </div>
                    </div>
                    <dl class="grid grid-cols-[220px_1fr] gap-x-4 gap-y-1 text-xs">
                      <template v-for="(baris, i) in rincianCatatan(c)" :key="i">
                        <dt class="text-grey-400">{{ baris.nama }}</dt>
                        <dd>{{ baris.nilai }}</dd>
                      </template>
                    </dl>
                  </div>
                </div>
              </TabPanel>
              <TabPanel v-if="boleh('Biaya')" value="biaya">
                <div v-if="!biaya.length" class="text-sm text-grey-400">
                  Tidak ada biaya PACU terpisah untuk episode ini (biaya nonaktif, termasuk paket operasi, atau episode belum selesai).
                </div>
                <DataTable v-else :value="biaya" stripedRows class="text-xs">
                  <Column header="Layanan" headerClass="bg-opensimrs-50"><template #body="{ data: b }">{{ b.konfigurasiSnapshot?.nama }}</template></Column>
                  <Column header="Tarif" headerClass="bg-opensimrs-50"><template #body="{ data: b }">{{ Number(b.konfigurasiSnapshot?.tarif ?? 0).toLocaleString("id-ID") }}</template></Column>
                  <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: b }">{{ STATUS_BIAYA[b.statusKirim] ?? b.statusKirim }}</template></Column>
                  <Column header="Percobaan" headerClass="bg-opensimrs-50" field="jumlahPercobaan" />
                  <Column header="Keterangan" headerClass="bg-opensimrs-50"><template #body="{ data: b }">{{ b.kesalahanTerakhir ?? b.referensiTagihan ?? "-" }}</template></Column>
                  <Column header="" headerClass="bg-opensimrs-50">
                    <template #body="{ data: b }">
                      <CustomButton v-if="b.statusKirim !== 'terkirim' && boleh('Biaya', 'KIRIM')" label="Kirim Ulang" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="kirimBiaya(b)" />
                    </template>
                  </Column>
                </DataTable>
              </TabPanel>
              <TabPanel v-if="boleh('Riwayat')" value="riwayat">
                <NoData v-if="!riwayat.length" />
                <DataTable v-else :value="riwayat" stripedRows class="text-xs">
                  <Column header="Waktu" headerClass="bg-opensimrs-50"><template #body="{ data: h }">{{ waktuOk(h.createdAt) }}</template></Column>
                  <Column header="Petugas" headerClass="bg-opensimrs-50" field="createdBy" />
                  <Column header="Aksi" headerClass="bg-opensimrs-50"><template #body="{ data: h }">{{ NAMA_AKSI_RIWAYAT[h.aksi] ?? h.aksi }}</template></Column>
                  <Column header="Alasan" headerClass="bg-opensimrs-50"><template #body="{ data: h }">{{ h.alasan ?? "-" }}</template></Column>
                  <Column header="Perubahan" headerClass="bg-opensimrs-50">
                    <template #body="{ data: h }">
                      <div v-for="(p, i) in perubahanRiwayat(h).slice(0, 6)" :key="i" class="break-all">{{ p }}</div>
                    </template>
                  </Column>
                </DataTable>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </div>
      </template>
    </Card>

    <!-- ── Dialog episode baru ──────────────────────────────────── -->
    <CustomDialog v-model:visible="dialogBaru" width="720px">
      <template #header>Episode PACU Baru</template>
      <template #body>
        <div class="flex flex-col gap-3 pt-4">
          <div class="grid grid-cols-[200px_1fr] gap-3 items-end">
            <CustomDatePicker v-model="tanggalJadwal" label="Tanggal operasi" @update:modelValue="jadwalUuid = ''; muatJadwalSumber()" />
            <CustomSelect v-model="jadwalUuid" label="Jadwal operasi" required showFilter :filterFields="['labelPilihan']" :options="opsiJadwal" optionLabel="labelPilihan" optionValue="uuid" />
          </div>
          <div v-if="!jadwalSumber.length" class="text-xs text-grey-400">
            Belum ada jadwal yang memenuhi syarat pada tanggal ini. Syarat: jadwal tidak batal, laporan operasi mencatat tindakan dilakukan, dan laporan anestesi tersedia.
          </div>
          <div v-if="jadwalTerpilih" class="grid grid-cols-2 gap-x-6 gap-y-1 p-3 text-sm rounded-lg bg-opensimrs-50">
            <div><span class="text-grey-400">Pasien:</span> {{ jadwalTerpilih.namaPasien }}</div>
            <div><span class="text-grey-400">No. RM/Reg:</span> {{ jadwalTerpilih.noRm ?? "-" }} · {{ jadwalTerpilih.noReg ?? "-" }}</div>
            <div class="col-span-2"><span class="text-grey-400">Tindakan:</span> {{ jadwalTerpilih.tindakanDilakukan }}</div>
            <div><span class="text-grey-400">Anestesi:</span> {{ jadwalTerpilih.jenisAnestesi ?? "-" }}</div>
            <div><span class="text-grey-400">Aldrete masuk:</span> {{ tampil(jadwalTerpilih.aldreteMasuk) }}</div>
            <div v-if="jadwalTerpilih.episodeUuid" class="col-span-2 font-semibold text-warning-400">Jadwal ini sudah memiliki episode PACU — tombol di bawah membuka episode tersebut.</div>
          </div>
          <CustomSelect v-model="protokolUuid" label="Protokol PACU (aktif)" required :options="protokolAktif" optionLabel="labelPilihan" optionValue="uuid" />
          <div v-if="!protokolAktif.length" class="text-xs text-danger-300">
            Belum ada protokol PACU aktif. Susun dan aktifkan protokol melalui tombol Protokol (perlu disahkan komite medik).
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogBaru = false" />
          <CustomButton
            :label="jadwalTerpilih?.episodeUuid ? 'Buka Episode' : 'Buat Episode'"
            :disabled="!jadwalUuid || (!protokolUuid && !jadwalTerpilih?.episodeUuid)"
            @click="buat"
          />
        </div>
      </template>
    </CustomDialog>

    <!-- ── Dialog aksi klinis ───────────────────────────────────── -->
    <CustomDialog v-model:visible="dialogAksi" width="760px">
      <template #header>{{ aksi ? LABEL_AKSI[aksi] : "" }}</template>
      <template #body>
        <div v-if="episode && aksi" class="flex flex-col gap-3 pt-4">
          <div class="grid grid-cols-2 gap-3">
            <CustomSelect v-if="aksi === 'koreksi'" v-model="kolomKoreksi" label="Waktu yang dikoreksi" :options="kolomKoreksiTersedia" optionLabel="nama" optionValue="kode" />
            <CustomDatePicker
              v-if="!(aksi === 'koreksi-catatan' && catatanDikoreksi?.jenis === 'asesmen')"
              v-model="waktu"
              :label="aksi === 'terima' ? 'Waktu diterima' : aksi === 'selesaikan' ? 'Waktu keluar PACU' : aksi === 'koreksi' ? 'Waktu yang benar' : 'Waktu kejadian'"
              showTime
              required
            />
            <CustomSelect
              v-if="aksi === 'kedatangan' || aksi === 'intervensi'"
              v-model="petugasUuid"
              :label="aksi === 'kedatangan' ? 'Petugas penyerah (tim Kamar Operasi)' : 'Pelaksana'"
              required
              showFilter
              :filterFields="['nama']"
              :options="petugas"
              optionLabel="nama"
              optionValue="uuid"
            />
          </div>

          <template v-if="aksi === 'kedatangan' || aksi === 'serah-terima'">
            <div class="text-sm font-semibold text-opensimrs-300">{{ aksi === "kedatangan" ? "Serah terima masuk dari Kamar Operasi" : "Isi serah terima ke unit tujuan" }}</div>
            <CustomSelect v-if="aksi === 'serah-terima'" v-model="unitTujuan" label="Unit tujuan (sesuai keputusan asesmen)" :options="unit" optionLabel="nama" optionValue="uuid" disabled />
            <ParameterPacu v-model="nilai" :definisi="snapshot.formatSerahTerima ?? []" />
          </template>

          <ParameterPacu v-if="aksi === 'pemantauan' || (aksi === 'koreksi-catatan' && catatanDikoreksi?.jenis === 'pemantauan')" v-model="nilai" :definisi="snapshot.parameter ?? []" />

          <template v-if="aksi === 'asesmen' || (aksi === 'koreksi-catatan' && catatanDikoreksi?.jenis === 'asesmen')">
            <div class="text-sm font-semibold text-opensimrs-300">Kriteria kesiapan pindah (protokol faskes)</div>
            <ParameterPacu v-model="hasilKriteria" :definisi="snapshot.kriteriaPindah ?? []" />
            <CustomTextArea v-model="hasilAsesmen" label="Hasil asesmen pascaanestesi" required />
            <div v-if="aksi === 'asesmen'" class="grid grid-cols-2 gap-3">
              <CustomSelect
                v-model="keputusan"
                label="Keputusan"
                :options="[{ kode: 'belum_siap', nama: 'Belum siap — lanjut pemantauan' }, { kode: 'siap', nama: 'Siap dipindahkan' }]"
                optionLabel="nama"
                optionValue="kode"
              />
              <CustomSelect v-if="keputusan === 'siap'" v-model="unitTujuan" label="Unit tujuan" required showFilter :filterFields="['nama']" :options="unit" optionLabel="nama" optionValue="uuid" />
            </div>
            <div v-if="aksi === 'asesmen'" class="text-xs text-grey-400">
              Kesiapan pindah adalah keputusan petugas berwenang; skor pemulihan tidak mengubah status secara otomatis.
            </div>
          </template>

          <template v-if="aksi === 'intervensi' || (aksi === 'koreksi-catatan' && catatanDikoreksi?.jenis === 'intervensi')">
            <div class="grid grid-cols-2 gap-3">
              <CustomSelect
                v-model="jenisIntervensi"
                label="Jenis"
                :disabled="aksi === 'koreksi-catatan'"
                :options="[{ kode: 'tindakan', nama: 'Tindakan' }, { kode: 'obat', nama: 'Obat' }, { kode: 'bhp', nama: 'BHP' }]"
                optionLabel="nama"
                optionValue="kode"
              />
              <CustomTextfield v-model="rincian.nama" label="Nama obat / BHP / tindakan" required />
              <template v-if="jenisIntervensi === 'obat'">
                <CustomTextfield v-model="rincian.dosis" label="Dosis" required />
                <CustomTextfield v-model="rincian.satuan" label="Satuan" required />
                <CustomTextfield v-model="rincian.rute" label="Rute pemberian" required />
              </template>
            </div>
            <div class="text-xs text-grey-400">Dokumentasi pemberian/pemakaian saja: tidak membentuk resep, order farmasi, atau mengurangi stok.</div>
          </template>

          <CustomTextArea v-if="['pemantauan', 'intervensi'].includes(aksi) || (aksi === 'koreksi-catatan' && catatanDikoreksi?.jenis !== 'asesmen')" v-model="catatan" label="Catatan" />

          <template v-if="aksi === 'terima'">
            <CustomSelect
              v-model="serahUuid"
              label="Serah terima yang diterima"
              required
              :options="serahTerimaTerbuka.map((c: any) => ({ ...c, labelPilihan: `${waktuOk(c.waktuKejadian)} · ${namaUnit(c.data?.unitTujuanUuid)} · ${c.data?.penyerah}` }))"
              optionLabel="labelPilihan"
              optionValue="uuid"
            />
            <div class="text-xs text-grey-400">Penerima dicatat memakai identitas akun Anda.</div>
          </template>

          <div v-if="aksi === 'selesaikan'" class="text-xs text-grey-400">
            Episode hanya dapat diselesaikan setelah serah terima keluar diterima unit tujuan. Biaya PACU (bila diaktifkan protokol) dikirim satu kali dengan referensi tetap.
          </div>

          <CustomTextArea v-if="['asesmen', 'koreksi', 'koreksi-catatan'].includes(aksi)" v-model="alasan" :label="aksi === 'asesmen' ? 'Alasan keputusan' : 'Alasan koreksi'" required />
          <div v-if="galatAksi" class="text-sm text-danger-300">{{ galatAksi }}</div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Batal" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogAksi = false" />
          <CustomButton label="Simpan" icon="PhFloppyDisk" @click="simpanAksi" />
        </div>
      </template>
    </CustomDialog>

    <!-- ── Dialog protokol ──────────────────────────────────────── -->
    <CustomDialog v-model:visible="dialogProtokol" width="1040px">
      <template #header>Protokol PACU Faskes</template>
      <template #body>
        <div class="flex flex-col gap-4 pt-4">
          <div class="p-3 text-xs rounded-lg bg-warning-50 text-warning-400">
            Parameter, pilihan, interval, kriteria pindah, dan isi serah terima ditetapkan rumah sakit dan <b>perlu disahkan komite medik</b> sebelum versi diaktifkan.
            Versi baru berlaku untuk episode baru; episode berjalan tetap memakai versi (snapshot) saat episode dibuat.
          </div>
          <NoData v-if="!protokol.length" />
          <DataTable v-else :value="protokol" stripedRows class="text-xs">
            <Column header="Kode" headerClass="bg-opensimrs-50" field="kode" />
            <Column header="Nama" headerClass="bg-opensimrs-50"><template #body="{ data: p }">{{ p.definisi?.nama }}</template></Column>
            <Column header="Versi" headerClass="bg-opensimrs-50" field="nomorVersi" />
            <Column header="Interval" headerClass="bg-opensimrs-50">
              <template #body="{ data: p }">{{ p.definisi?.intervalPemantauanDetik ? `${Math.round(p.definisi.intervalPemantauanDetik / 60)} menit` : "-" }}</template>
            </Column>
            <Column header="Biaya" headerClass="bg-opensimrs-50">
              <template #body="{ data: p }">{{ !p.definisi?.biaya?.aktif ? "Nonaktif" : p.definisi.biaya.termasukPaket ? "Termasuk paket operasi" : `${p.definisi.biaya.nama} · ${Number(p.definisi.biaya.tarif).toLocaleString("id-ID")}` }}</template>
            </Column>
            <Column header="Status" headerClass="bg-opensimrs-50"><template #body="{ data: p }">{{ p.aktif ? "Aktif" : "Nonaktif" }}</template></Column>
            <Column header="" headerClass="bg-opensimrs-50">
              <template #body="{ data: p }">
                <div class="flex gap-2">
                  <CustomButton v-if="boleh('Protokol', 'CREATE')" label="Salin ke Draf" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="salinProtokol(p)" />
                  <CustomButton v-if="!p.aktif && boleh('Protokol', 'VALIDASI')" label="Aktifkan" size="small" @click="aktifkanProtokol(p)" />
                </div>
              </template>
            </Column>
          </DataTable>

          <template v-if="boleh('Protokol', 'CREATE')">
            <div class="flex items-center justify-between">
              <div class="font-semibold text-opensimrs-300">Susun versi protokol baru</div>
              <div class="flex gap-2">
                <CustomButton label="Isi Contoh" icon="PhListPlus" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="isiContoh" />
                <CustomButton label="Kosongkan" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="kosongkanProtokol" />
              </div>
            </div>
            <div class="grid grid-cols-3 gap-3">
              <CustomTextfield v-model="kodeProtokol" label="Kode protokol (huruf kecil/angka/_)" required />
              <CustomTextfield v-model="namaProtokol" label="Nama protokol" required />
              <CustomTextfield v-model="intervalMenit" label="Interval pemantauan (menit)" type="number" required />
            </div>
            <div v-for="g in kelompokDefinisi" :key="g.nama" class="flex flex-col gap-2 p-3 border rounded-lg border-grey-75">
              <div class="flex items-center justify-between">
                <div class="text-sm font-semibold">{{ g.nama }}</div>
                <CustomButton label="Tambah" icon="PhPlus" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="g.daftar.value.push(barisBaru())" />
              </div>
              <div v-if="!g.daftar.value.length" class="text-xs text-grey-400">Minimal satu baris wajib diisi.</div>
              <div v-for="(p, i) in g.daftar.value" :key="i" class="grid grid-cols-[1fr_1.6fr_130px_1fr_80px_auto] gap-2 items-end">
                <CustomTextfield v-model="p.kode" label="Kode" />
                <CustomTextfield v-model="p.nama" label="Nama" />
                <CustomSelect v-model="p.tipe" label="Tipe" :options="TIPE" optionLabel="nama" optionValue="kode" />
                <CustomTextfield v-if="p.tipe === 'angka'" v-model="p.satuan" label="Satuan" />
                <CustomTextfield v-else-if="p.tipe === 'pilihan'" v-model="p.pilihanTeks" label="Pilihan (pisahkan koma)" />
                <div v-else />
                <label class="flex items-center gap-2 pb-2 text-xs"><Checkbox v-model="p.wajib" binary />Wajib</label>
                <CustomButton icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="g.daftar.value.splice(i, 1)" />
              </div>
            </div>
            <div class="flex flex-col gap-2 p-3 border rounded-lg border-grey-75">
              <label class="flex items-center gap-2 text-sm font-semibold"><Checkbox v-model="biayaAktif" binary />Tagihkan biaya PACU</label>
              <template v-if="biayaAktif">
                <label class="flex items-center gap-2 text-xs"><Checkbox v-model="termasukPaket" binary />Sudah termasuk paket operasi (tidak ditagihkan terpisah)</label>
                <div v-if="!termasukPaket" class="grid grid-cols-3 gap-3">
                  <CustomTextfield v-model="layananUuid" label="Kode/referensi layanan tarif" required />
                  <CustomTextfield v-model="namaBiaya" label="Nama item tagihan" required />
                  <CustomTextfield v-model="tarif" label="Tarif (Rp)" type="number" required />
                </div>
              </template>
            </div>
          </template>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogProtokol = false" />
          <CustomButton v-if="boleh('Protokol', 'CREATE')" label="Simpan Versi Baru" icon="PhFloppyDisk" @click="simpanProtokol" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
