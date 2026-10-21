<script setup lang="ts">
// Asisten Pengembang (F1): tombol mengambang samar di kanan bawah, hanya untuk superadmin saat Mode Pengembang aktif.
// Menangkap konteks halaman (modul/fitur katalog, izin, komponen, galat) dan mengubah kebutuhan Product/Engineer/QA
// menjadi permintaan SIMRS Studio yang membawa konteks asal itu. Tanpa AI pada F1; rancangan:
// docs/rancangan/STUDIO-ASISTEN-KONTEKS.md.
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import CustomButton from "@/components/Base/CustomButton.vue";
import { apiStudioGet, apiStudioPost } from "@/utils/apiHandler";
import { EVENT_STUDIO, isSuperadmin, studioAktif } from "@/stores/simrsStudio";
import { daftarModulKatalog, fiturUntukPath, modulUntukPath } from "@/stores/modulFaskes";
import { resolveRoutePermission } from "@/utils/permissions";
import { galatUntukHalaman, hapusGalatHalaman, panggilanUntukHalaman, pasangPenangkapGalat } from "@/utils/galatHalaman";

const route = useRoute();
const router = useRouter();

// ── Kapan tampil: superadmin + Mode Pengembang, halaman aplikasi berlogin (termasuk APM & layar antrean), bukan Studio.
const versiStatus = ref(0);
const segarkanStatus = () => versiStatus.value++;
// APM & layar antrean ikut: perangkat kiosk/TV memakai akun non-superadmin sehingga pasien tidak melihat tombol ini.
const DIKECUALIKAN = [/^\/studio(\/|$)/, /^\/login/];
const tampil = computed(() => {
  versiStatus.value; // dihitung ulang saat status Studio berubah
  return Boolean(route.meta.requiresAuth) && isSuperadmin() && studioAktif() && !DIKECUALIKAN.some((p) => p.test(route.path));
});
const terbuka = ref(false);
const tersembunyi = ref(false);
const pintasan = (e: KeyboardEvent) => {
  if (e.ctrlKey && e.shiftKey && e.key === ".") {
    e.preventDefault();
    if (tampil.value) terbuka.value = !terbuka.value;
  }
  if (e.key === "Escape" && terbuka.value) terbuka.value = false;
};
onMounted(() => {
  pasangPenangkapGalat();
  window.addEventListener(EVENT_STUDIO, segarkanStatus);
  window.addEventListener("keydown", pintasan);
  // Dialog PrimeVue dipasang langsung di <body> (Teleport): pantau anak body untuk konteks dialog.
  pengamatDialog = new MutationObserver(() => {
    if (tampil.value) bacaDialog();
  });
  pengamatDialog.observe(document.body, { childList: true });
  try {
    tersembunyi.value = sessionStorage.getItem("asisten_pengembang_sembunyi") === "1";
  } catch {
    /* penyimpanan sesi tidak tersedia */
  }
});
onBeforeUnmount(() => {
  window.removeEventListener(EVENT_STUDIO, segarkanStatus);
  window.removeEventListener("keydown", pintasan);
  pengamatDialog?.disconnect();
});
const sembunyikan = () => {
  tersembunyi.value = true;
  terbuka.value = false;
  try {
    sessionStorage.setItem("asisten_pengembang_sembunyi", "1");
  } catch {
    /* abaikan */
  }
};

// ── Konteks halaman
const modul = computed(() => modulUntukPath(route.path));
const fitur = computed(() => fiturUntukPath(route.path));
const izin = computed(() => resolveRoutePermission(route.path) as any);
const komponen = computed(() => {
  const nama = (c: any) => c?.__name ?? c?.name ?? null;
  return [...new Set([...route.matched.map((r) => nama(r.components?.default)), nama(route.meta.page)].filter(Boolean))] as string[];
});
// Path berkas komponen (__file, hanya di mode dev) agar audit tidak tertukar antar-halaman bernama sama (LaporanPage.vue).
const berkasKomponen = computed(() =>
  [...new Set([...route.matched.map((r) => (r.components?.default as any)?.__file), (route.meta.page as any)?.__file].filter((f) => typeof f === "string"))] as string[]);
// Dialog/drawer yang sedang terbuka (mis. Rekam Medis dari Rawat Jalan › Poli): rutenya tetap halaman induk, jadi judul
// & komponen dialog ikut konteks. Komponen dibaca dari instance Vue elemen dialog (__vueParentComponent, mode dev).
interface DialogTerbuka { judul: string; komponen: string[]; berkas: string[]; el: HTMLElement }
const dialog = ref<DialogTerbuka | null>(null);
const bacaDialog = () => {
  const daftar = [...document.querySelectorAll<HTMLElement>(".p-dialog, .p-drawer, .p-sidebar")]
    .filter((el) => !el.closest("[data-asisten-pengembang]") && el.getClientRects().length > 0);
  const el = daftar[daftar.length - 1];
  if (!el) {
    dialog.value = null;
    return;
  }
  const nama: string[] = [], berkas: string[] = [];
  let inst = (el as any).__vueParentComponent;
  for (let i = 0; inst && i < 12 && nama.length < 3; i++, inst = inst.parent) {
    const t = inst.type ?? {};
    const n = t.__name ?? t.name, f = t.__file;
    if (!n || (typeof f === "string" && f.includes("node_modules")) || komponen.value.includes(n)) continue;
    if (!f && /^(Dialog|Drawer|Sidebar|Portal|Teleport|BaseComponent)$/.test(n)) continue;
    if (!nama.includes(n)) nama.push(n);
    if (typeof f === "string") berkas.push(f);
  }
  // Teks header dialog sengaja tidak dibaca: header seperti Rekam Medis memuat nama/no. RM pasien.
  dialog.value = { judul: nama[0] ? `Dialog ${nama[0]}` : "Dialog terbuka", komponen: nama, berkas, el };
};
let pengamatDialog: MutationObserver | null = null;
const komponenAudit = computed(() => [...new Set([...(dialog.value?.komponen ?? []), ...komponen.value])]);
const berkasAudit = computed(() => [...new Set([...(dialog.value?.berkas ?? []), ...berkasKomponen.value])]);
const galat = computed(() => galatUntukHalaman(route.path));
const labelModul = computed(() =>
  [modul.value?.nama, fitur.value?.nama, dialog.value?.judul].filter(Boolean).join(" › ") || "Halaman tanpa modul katalog");

// Item Studio untuk modul halaman ini (aktif & riwayat).
const item = ref<any[]>([]);
const memuatItem = ref(false);
const muatItem = async () => {
  if (!modul.value) {
    item.value = [];
    return;
  }
  memuatItem.value = true;
  try {
    const semua = (await apiStudioGet("/item", true))?.payload ?? [];
    const kode = modul.value.kode, nama = String(modul.value.nama).toLowerCase();
    item.value = semua.filter((i: any) => i.modulAsal === kode || (i.modulTerdampak ?? []).some((m: string) => String(m).toLowerCase() === nama || String(m).toLowerCase() === kode));
  } finally {
    memuatItem.value = false;
  }
};
const itemAktif = computed(() => item.value.filter((i) => !["selesai", "dibatalkan"].includes(i.tahap)));
const itemSelesai = computed(() => item.value.filter((i) => i.tahap === "selesai"));
const nomor = (n: number) => `STD-${String(n).padStart(4, "0")}`;

// ── Cek konsistensi tampilan (QA): heuristik DOM di area konten, tanpa membaca isi data.
const cekTampilan = ref<Array<{ cek: string; lulus: boolean; rincian: string }>>([]);
const jalankanCek = () => {
  bacaDialog();
  // Dialog terbuka (mis. Rekam Medis) → yang dicek isi dialog itu, bukan halaman di belakangnya.
  const akar = (dialog.value?.el ?? document.querySelector("main") ?? document.body) as HTMLElement;
  const dalamAsisten = (el: Element) => Boolean(el.closest("[data-asisten-pengembang]"));
  const semua = (sel: string) => [...akar.querySelectorAll(sel)].filter((el) => !dalamAsisten(el));
  const tabelPolos = semua("table").filter((t) => !t.closest(".p-datatable"));
  const isianPolos = semua("select, input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file])")
    .filter((el) => !el.closest("[class*='p-']") && !/rounded/.test(el.getAttribute("class") ?? ""));
  const tombolPolos = semua("button").filter((b) => !(b.getAttribute("class") ?? "").trim());
  const labelUuid = semua("label").filter((l) => /\bUUID\b/i.test(l.textContent ?? ""));
  cekTampilan.value = [
    { cek: "Judul halaman (PageToolbar)", lulus: semua(".toolbar-heading").length > 0, rincian: "Halaman memakai PageToolbar dengan h1.toolbar-heading" },
    { cek: "Kartu halaman (Card)", lulus: semua(".p-card").length > 0, rincian: "Isi halaman dibungkus Card PrimeVue" },
    { cek: "Tabel standar (DataTable)", lulus: !tabelPolos.length, rincian: tabelPolos.length ? `${tabelPolos.length} <table> polos di luar DataTable` : "Semua tabel memakai DataTable" },
    { cek: "Isian bergaya OpenSIMRS", lulus: !isianPolos.length, rincian: isianPolos.length ? `${isianPolos.length} isian polos tanpa gaya (border p-2)` : "Isian memakai komponen/gaya standar" },
    { cek: "Tombol standar", lulus: !tombolPolos.length, rincian: tombolPolos.length ? `${tombolPolos.length} tombol tanpa gaya` : "Tombol memakai CustomButton/gaya standar" },
    { cek: "Tanpa isian UUID", lulus: !labelUuid.length, rincian: labelUuid.length ? `Label meminta UUID: ${labelUuid.map((l) => (l.textContent ?? "").trim().slice(0, 40)).join("; ")}` : "Tidak ada isian UUID" },
  ];
};

// ── Formulir per peran → permintaan SIMRS Studio
type Peran = "product" | "engineer" | "qa";
const tab = ref<"konteks" | "audit" | Peran>("konteks");
const PERAN: Record<Peran, { judul: string; jenis: string[]; ket: string; pertanyaan: Array<{ kunci: "masalah" | "siapa" | "harapan" | "contoh"; label: string; contoh: string; wajib?: boolean }> }> = {
  product: {
    judul: "Product", jenis: ["fitur", "laporan", "modul"], ket: "Rumuskan kebutuhan pengguna di halaman ini menjadi permintaan fitur.",
    pertanyaan: [
      { kunci: "masalah", label: "Kebutuhan atau kesulitan pengguna", contoh: "Kepala ruangan tidak bisa melihat pegawai yang kurang istirahat sebelum menerbitkan jadwal", wajib: true },
      { kunci: "siapa", label: "Siapa yang terdampak & seberapa sering", contoh: "Kepala ruangan, setiap akhir bulan" },
      { kunci: "harapan", label: "Hasil yang diharapkan", contoh: "Ringkasan pelanggaran istirahat tampil di atas grid jadwal" },
      { kunci: "contoh", label: "Contoh kasus (data fiktif)", contoh: "Pegawai contoh dinas malam lalu pagi" },
    ],
  },
  engineer: {
    judul: "Engineer", jenis: ["perbaikan", "fitur"], ket: "Catat perubahan teknis untuk halaman ini: perilaku, kinerja, struktur, atau integrasi.",
    pertanyaan: [
      { kunci: "masalah", label: "Apa yang perlu diubah secara teknis", contoh: "Daftar jadwal memuat ulang seluruh unit setiap ganti filter", wajib: true },
      { kunci: "harapan", label: "Perilaku/hasil teknis yang diharapkan", contoh: "Hanya unit terpilih yang dimuat; dibatasi 50 baris per halaman" },
      { kunci: "contoh", label: "Berkas, endpoint, atau komponen terkait (opsional)", contoh: "penunjang-service/src/hr/jadwal-dinas/jadwal.js, JadwalDinasPage.vue" },
      { kunci: "siapa", label: "Dampak ke pengguna/modul lain (opsional)", contoh: "Penggajian membaca jadwal terbit" },
    ],
  },
  qa: {
    judul: "QA", jenis: ["perbaikan"], ket: "Laporkan masalah di halaman ini beserta galat yang tertangkap dan hasil cek tampilan.",
    pertanyaan: [
      { kunci: "masalah", label: "Apa yang terjadi", contoh: "Klik Simpan pola shift tidak menutup dialog dan muncul galat 500", wajib: true },
      { kunci: "contoh", label: "Langkah mengulang (data fiktif)", contoh: "1. Buka Pola Shift 2. Tambah pola P 07.00–14.00 3. Simpan" },
      { kunci: "harapan", label: "Yang seharusnya terjadi", contoh: "Pola tersimpan dan muncul di tabel" },
      { kunci: "siapa", label: "Siapa yang terdampak (opsional)", contoh: "Penyusun jadwal semua unit" },
    ],
  },
};
// ── Audit cepat (opsional, hanya bila diklik): pemeriksaan statis studio-service atas berkas halaman & backend-nya,
// ditambah pemeriksaan di peramban (katalog, izin, tampilan, galat). Lima aspek; temuan bisa dibawa ke permintaan.
type Tingkat = "tinggi" | "sedang" | "rendah";
interface TemuanAudit {
  aspek: string; tingkat: Tingkat; judul: string; rincian: string; bukti: Array<{ berkas: string; baris: number | null }>; jumlah?: number;
  dilaporkan?: Array<{ uuid: string; nomor: number }>;
}
const ASPEK = [
  { kode: "fungsional", nama: "Fungsional", ket: "Halaman ↔ endpoint, katalog, izin, alur & tampilan" },
  { kode: "query", nama: "Query", ket: "SQL: parameter, soft delete, batas baris, kolom" },
  { kode: "relasi", nama: "Relasi", ket: "Tabel dikenal, JOIN & soft delete, LEFT JOIN" },
  { kode: "logika", nama: "Logika", ket: "Galat ditelan, async, transaksi, waktu epoch" },
  { kode: "keamanan", nama: "Keamanan", ket: "Isolasi faskes, injeksi SQL, XSS, rahasia" },
];
const WARNA_TINGKAT: Record<Tingkat, string> = { tinggi: "bg-danger-50 text-danger-400", sedang: "bg-warning-50 text-warning-400", rendah: "bg-grey-50 text-grey-400" };
const hasilAudit = ref<Record<string, { temuan: TemuanAudit[]; berkas: { frontend: string[]; backend: string[] }; endpoint: any[]; waktu: number }>>({});
// Hasil per halaman, dan per dialog bila audit dijalankan saat dialog terbuka.
const kunciAudit = computed(() => `${route.path}${dialog.value ? `#${dialog.value.judul}` : ""}`);
const audit = computed(() => hasilAudit.value[kunciAudit.value] ?? null);
const memuatAudit = ref(false);
const VERSI_AUDIT_MIN = 4; // sama dengan VERSI_AUDIT di studio-service/src/audit.js
const versiAuditLama = ref(false);
const filterAspek = ref<string | null>(null);
const terpilih = ref<Set<string>>(new Set());
const kunciTemuan = (t: TemuanAudit) => `${t.aspek}|${t.judul}|${t.bukti[0]?.berkas ?? ""}`;
const temuanTampil = computed(() => (audit.value?.temuan ?? []).filter((t) => !filterAspek.value || t.aspek === filterAspek.value));
const hitung = (aspek: string, tingkat?: Tingkat) => (audit.value?.temuan ?? []).filter((t) => t.aspek === aspek && (!tingkat || t.tingkat === tingkat)).length;
const temuanDipilih = computed(() => (audit.value?.temuan ?? []).filter((t) => terpilih.value.has(kunciTemuan(t))));
const pendekkan = (berkas: string) => berkas.replace(/^frontend-service\/src\//, "fe:").replace(/^([\w-]+)-service\/src\//, "$1:");

const temuanPeramban = (): TemuanAudit[] => {
  const hasil: TemuanAudit[] = [];
  const t = (aspek: string, tingkat: Tingkat, judul: string, rincian: string) => hasil.push({ aspek, tingkat, judul, rincian, bukti: [] });
  if (!modul.value) t("fungsional", "rendah", "Halaman belum terpetakan ke modul katalog", "Rute ini tidak ada di katalog-modul.json: menu, aktivasi modul, dan konteks agen tidak mengenalinya");
  if (!izin.value) t("fungsional", "rendah", "Halaman tanpa entri izin rute", "Path tidak ada di permissionRouteRegistry (utils/permissions.ts): semua pengguna yang login bisa membukanya — abaikan bila memang halaman umum (mis. Dashboard)");
  else {
    // Halaman lintas modul memang lazim (Admisi › Rawat Inap: izin "Admisi", aktif bila modul Rawat Inap aktif). Yang
    // salah hanya bila nama modul izin tidak dikenal menu katalog mana pun → menu tidak pernah tampil bagi peran selain superadmin.
    const namaIzin = izin.value.module ?? izin.value.modul;
    const semuaMenu = new Set(daftarModulKatalog().flatMap((m) => m.menu ?? []));
    if (semuaMenu.size && namaIzin && !semuaMenu.has(namaIzin)) {
      t("fungsional", "sedang", "Modul izin tidak dikenal katalog", `Izin halaman memakai modul "${namaIzin}" yang tidak ada di menu katalog mana pun: menu bisa tidak tampil bagi peran selain superadmin`);
    }
  }
  for (const g of galat.value.filter((x) => x.jenis === "console")) t("logika", "sedang", "Galat JavaScript di halaman", `${g.pesan}${g.sumber ? ` (${g.sumber})` : ""}`);
  jalankanCek();
  for (const c of cekTampilan.value.filter((x) => !x.lulus)) t("fungsional", "rendah", `Tampilan: ${c.cek}`, c.rincian);
  return hasil;
};
const jalankanAudit = async () => {
  memuatAudit.value = true;
  try {
    bacaDialog();
    const halaman = route.path, kunci = kunciAudit.value;
    const endpoint = panggilanUntukHalaman(halaman).map((p) => ({ metode: p.metode, path: p.path, status: p.status }));
    const res = await apiStudioPost("/asisten/audit-cepat", { path: halaman, komponen: komponenAudit.value, berkasKomponen: berkasAudit.value, endpoint }, true);
    if (!res?.payload) return;
    // studio-service belum dijalankan ulang setelah pembaruan aturan audit → hasil memakai aturan lama (positif palsu).
    versiAuditLama.value = (res.payload.versi ?? 0) < VERSI_AUDIT_MIN;
    const urut: Record<Tingkat, number> = { tinggi: 0, sedang: 1, rendah: 2 };
    const temuan = [...temuanPeramban(), ...res.payload.temuan].sort((a, b) => urut[a.tingkat as Tingkat] - urut[b.tingkat as Tingkat]);
    hasilAudit.value = { ...hasilAudit.value, [kunci]: { ...res.payload, temuan } };
    // Pilihan awal: temuan tinggi yang belum dibawa permintaan aktif lain.
    terpilih.value = new Set(temuan.filter((x) => x.tingkat === "tinggi" && !x.dilaporkan?.length).map(kunciTemuan));
  } finally {
    memuatAudit.value = false;
  }
};
const alihTerpilih = (t: TemuanAudit) => {
  const s = new Set(terpilih.value);
  const k = kunciTemuan(t);
  if (s.has(k)) s.delete(k);
  else s.add(k);
  terpilih.value = s;
};
// Temuan terpilih → formulir Engineer (atau QA bila semuanya fungsional) yang sudah terisi.
const jadikanPermintaan = () => {
  const pilih = temuanDipilih.value;
  if (!pilih.length) return;
  const keQa = pilih.every((t) => t.aspek === "fungsional");
  tab.value = keQa ? "qa" : "engineer";
  const aspek = [...new Set(pilih.map((t) => ASPEK.find((a) => a.kode === t.aspek)?.nama ?? t.aspek))].join(", ");
  form.value = {
    ...form.value,
    judul: `Tindak lanjut audit ${modul.value?.nama ?? route.path}: ${pilih.length === 1 ? pilih[0].judul : `${pilih.length} temuan ${aspek.toLowerCase()}`}`.slice(0, 200),
    masalah: pilih.map((t) => `- [${t.aspek}/${t.tingkat}] ${t.judul}: ${t.rincian}`).join("\n"),
    contoh: pilih.flatMap((t) => t.bukti.map((b) => `${b.berkas}${b.baris ? `:${b.baris}` : ""}`)).slice(0, 15).join("\n"),
    harapan: "Setiap temuan diverifikasi di kode; yang benar diperbaiki, yang memang disengaja dijelaskan di PRD/desain.",
    jenis: "perbaikan",
    sertakanAudit: true,
  };
};

const form = ref({ judul: "", jenis: "fitur", prioritas: "P2", masalah: "", siapa: "", harapan: "", contoh: "", sertakanGalat: true, sertakanCek: true, sertakanAudit: true });
const pratinjau = ref(false);
const mengirim = ref(false);
const terkirim = ref<{ uuid: string; nomor: number } | null>(null);
watch(tab, (t) => {
  pratinjau.value = false;
  terkirim.value = null;
  if (t in PERAN) form.value.jenis = PERAN[t as Peran].jenis.includes(form.value.jenis) ? form.value.jenis : PERAN[t as Peran].jenis[0];
  if (t === "qa" && !cekTampilan.value.length) jalankanCek();
});
watch(() => route.path, () => {
  cekTampilan.value = [];
  terkirim.value = null;
  terpilih.value = new Set();
  filterAspek.value = null;
  if (terbuka.value) muatItem();
});
watch(terbuka, (b) => {
  if (b) muatItem();
});
const peranAktif = computed(() => (tab.value in PERAN ? PERAN[tab.value as Peran] : null));
const bisaPratinjau = computed(() => form.value.judul.trim().length >= 5 && form.value.masalah.trim().length >= 10);

const konteksAsal = computed(() => ({
  path: route.path,
  namaRute: typeof route.name === "string" ? route.name : null,
  modul: modul.value ? { kode: modul.value.kode, nama: modul.value.nama } : null,
  fitur: fitur.value ? { kode: fitur.value.kode, nama: fitur.value.nama } : null,
  izin: izin.value ? { modul: izin.value.module ?? izin.value.modul ?? null, submodul: izin.value.submodule ?? izin.value.submodul ?? null, aksi: [izin.value.action ?? izin.value.aksi ?? []].flat().join(",") || null } : null,
  komponen: komponenAudit.value,
  dialog: dialog.value ? { judul: dialog.value.judul, komponen: dialog.value.komponen } : null,
  galat: form.value.sertakanGalat ? galat.value.map((g) => ({ jenis: g.jenis, metode: g.metode, path: g.path, status: g.status, pesan: g.pesan, sumber: g.sumber, waktu: g.waktu })) : [],
  cekTampilan: form.value.sertakanCek && tab.value === "qa" ? cekTampilan.value : [],
  audit: form.value.sertakanAudit ? temuanDipilih.value.slice(0, 20).map((t) => ({ aspek: t.aspek, tingkat: t.tingkat, judul: t.judul, rincian: t.rincian, bukti: t.bukti.slice(0, 5) })) : [],
}));
const kirim = async () => {
  mengirim.value = true;
  try {
    const f = form.value;
    const res = await apiStudioPost("/item", {
      judul: f.judul.trim(), jenis: f.jenis, prioritas: f.prioritas,
      masalah: f.masalah.trim(), siapa: f.siapa.trim(), harapan: f.harapan.trim(), contoh: f.contoh.trim(),
      modulTerdampak: modul.value ? [modul.value.nama] : [],
      konteksAsal: konteksAsal.value,
    });
    if (res?.payload?.uuid) {
      terkirim.value = { uuid: res.payload.uuid, nomor: res.payload.nomor };
      form.value = { ...form.value, judul: "", masalah: "", siapa: "", harapan: "", contoh: "" };
      pratinjau.value = false;
      muatItem();
    }
  } finally {
    mengirim.value = false;
  }
};
const bukaItem = (uuid: string) => {
  terbuka.value = false;
  router.push(`/studio/item/${uuid}`);
};
const NAMA_JENIS: Record<string, string> = { fitur: "Fitur", perbaikan: "Perbaikan", laporan: "Laporan", modul: "Modul baru" };
</script>

<template>
  <div v-if="tampil && !tersembunyi" data-asisten-pengembang>
    <button
      type="button"
      class="fixed bottom-4 right-4 z-[20000] flex h-10 w-10 items-center justify-center rounded-full bg-opensimrs-300 text-white shadow-lg ring-2 ring-white transition-opacity duration-200 hover:opacity-100 focus-visible:opacity-100"
      :class="terbuka ? 'opacity-100' : 'opacity-35'"
      :title="`Asisten pengembang · ${labelModul} (Ctrl+Shift+.)`"
      :aria-label="`Asisten pengembang untuk ${labelModul}`"
      :aria-expanded="terbuka"
      @click="bacaDialog(); terbuka = !terbuka"
    >
      <PhFlask :size="20" weight="fill" aria-hidden="true" />
      <span v-if="galat.length || itemAktif.length" class="absolute right-0 top-0 h-2.5 w-2.5 rounded-full ring-2 ring-white" :class="galat.length ? 'bg-danger-300' : 'bg-warning-300'" aria-hidden="true" />
    </button>

    <Teleport to="body">
      <transition enter-from-class="opacity-0 translate-y-2" leave-to-class="opacity-0 translate-y-2" enter-active-class="transition duration-150" leave-active-class="transition duration-150">
        <aside
          v-if="terbuka"
          data-asisten-pengembang
          class="fixed bottom-16 right-4 z-[20001] flex h-[min(640px,calc(100vh-6rem))] w-[420px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-grey-75 bg-white shadow-2xl"
          role="dialog"
          aria-label="Asisten pengembang"
        >
          <header class="flex items-start justify-between gap-2 bg-opensimrs-300 px-4 py-3 text-white">
            <div class="min-w-0">
              <div class="flex items-center gap-2 text-SM font-semibold"><PhFlask :size="16" weight="fill" aria-hidden="true" /> Asisten Pengembang</div>
              <div class="truncate text-[11px] opacity-90">{{ labelModul }} · <code>{{ route.path }}</code></div>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <button type="button" class="rounded p-1 text-[11px] hover:bg-white/20" title="Sembunyikan sampai login ulang" @click="sembunyikan"><PhEyeSlash :size="16" aria-hidden="true" /></button>
              <button type="button" class="rounded p-1 hover:bg-white/20" aria-label="Tutup" @click="terbuka = false"><PhX :size="16" aria-hidden="true" /></button>
            </div>
          </header>
          <nav class="flex border-b border-grey-75 text-XS" role="tablist">
            <button
              v-for="t in [['konteks', 'Konteks'], ['audit', 'Audit'], ['product', 'Product'], ['engineer', 'Engineer'], ['qa', 'QA']]"
              :key="t[0]"
              type="button"
              role="tab"
              :aria-selected="tab === t[0]"
              class="flex-1 px-2 py-2 font-semibold"
              :class="tab === t[0] ? 'border-b-2 border-opensimrs-300 text-opensimrs-300' : 'text-grey-400 hover:text-grey-500'"
              @click="tab = t[0] as any"
            >
              {{ t[1] }}
            </button>
          </nav>

          <div class="min-h-0 flex-1 overflow-auto p-4 text-XS text-grey-500">
            <!-- Konteks -->
            <div v-if="tab === 'konteks'" class="flex flex-col gap-3">
              <dl class="grid grid-cols-[96px_1fr] gap-x-2 gap-y-1">
                <dt class="text-grey-400">Modul</dt><dd>{{ modul ? `${modul.nama} (${modul.kode})` : "-" }}</dd>
                <dt class="text-grey-400">Fitur</dt><dd>{{ fitur ? `${fitur.nama} (${fitur.kode})` : "-" }}</dd>
                <dt class="text-grey-400">Izin</dt><dd>{{ izin ? `${izin.module ?? izin.modul} › ${izin.submodule ?? izin.submodul ?? "-"}` : "-" }}</dd>
                <template v-if="dialog"><dt class="text-grey-400">Dialog</dt><dd>{{ dialog.judul }}</dd></template>
                <dt class="text-grey-400">Komponen</dt><dd class="break-all">{{ komponenAudit.join(", ") || "-" }}</dd>
              </dl>
              <section class="rounded-lg border border-grey-75 p-2">
                <div class="mb-1 flex items-center justify-between font-semibold">
                  <span>Galat di halaman ini ({{ galat.length }})</span>
                  <button v-if="galat.length" type="button" class="text-[11px] text-opensimrs-300 underline" @click="hapusGalatHalaman(route.path)">Bersihkan</button>
                </div>
                <div v-if="!galat.length" class="text-grey-400">Belum ada galat API atau console yang tertangkap.</div>
                <ul v-else class="flex flex-col gap-1">
                  <li v-for="(g, i) in galat" :key="i" class="rounded bg-danger-50 px-2 py-1 text-danger-400">
                    <span class="font-semibold">{{ g.jenis === "api" ? `${g.metode ?? ""} ${g.status ?? ""}` : "console" }}</span>
                    <span v-if="g.path" class="break-all"> {{ g.path }}</span> — {{ g.pesan }}
                  </li>
                </ul>
              </section>
              <section class="rounded-lg border border-grey-75 p-2">
                <div class="mb-1 font-semibold">Item SIMRS Studio untuk modul ini</div>
                <div v-if="!modul" class="text-grey-400">Halaman ini belum terpetakan ke modul katalog.</div>
                <div v-else-if="memuatItem" class="text-grey-400">Memuat…</div>
                <template v-else>
                  <div v-if="!itemAktif.length" class="text-grey-400">Tidak ada item aktif.</div>
                  <button v-for="i in itemAktif" :key="i.uuid" type="button" class="flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-left hover:bg-opensimrs-50" @click="bukaItem(i.uuid)">
                    <span class="min-w-0 truncate"><b>{{ nomor(i.nomor) }}</b> {{ i.judul }}</span>
                    <span class="shrink-0 rounded bg-opensimrs-50 px-1.5 text-[10px] font-semibold uppercase text-opensimrs-300">{{ i.tahap }}</span>
                  </button>
                  <div v-if="itemSelesai.length" class="mt-1 text-grey-400">Riwayat: {{ itemSelesai.map((i) => nomor(i.nomor)).join(", ") }}</div>
                </template>
              </section>
              <div class="text-[11px] text-grey-400">Konteks ini ikut ke permintaan yang dibuat dari tab Product, Engineer, atau QA dan dipakai agen di setiap tahap.</div>
            </div>

            <!-- Audit cepat (opsional) -->
            <div v-else-if="tab === 'audit'" class="flex flex-col gap-3">
              <p class="text-grey-400">
                Opsional. Memeriksa kode halaman ini dan backend yang melayaninya tanpa AI: fungsional, query, relasi, logika, dan keamanan.
                Hasil bersifat heuristik — tanda <i>perlu dicek</i> berarti verifikasi dulu di kode.
              </p>
              <p class="rounded-lg bg-info-50 p-2 text-[11px] text-info-400">
                Audit berjalan dengan sesi superadmin: status endpoint yang teramati tidak akan pernah 403, sehingga masalah hak akses
                peran lain tidak terlihat di sini. Uji hak akses dengan akun peran terkait.
              </p>
              <CustomButton :label="audit ? 'Audit ulang' : 'Jalankan audit'" icon="PhMagnifyingGlass" :disabled="memuatAudit || !komponen.length" @click="jalankanAudit" />
              <div v-if="memuatAudit" class="text-grey-400">Memeriksa berkas halaman & backend…</div>
              <template v-else-if="audit">
                <div v-if="versiAuditLama" class="rounded-lg bg-danger-50 p-2 text-danger-400">
                  studio-service masih menjalankan aturan audit lama, sehingga hasil ini bisa berisi positif palsu. Jalankan ulang
                  <code>npm run dev</code> (atau studio-service), lalu audit ulang sebelum membuat permintaan.
                </div>
                <div class="grid grid-cols-5 gap-1">
                  <button
                    v-for="a in ASPEK"
                    :key="a.kode"
                    type="button"
                    :title="a.ket"
                    class="flex flex-col items-center rounded-lg border px-1 py-1.5"
                    :class="filterAspek === a.kode ? 'border-opensimrs-300 bg-opensimrs-50' : 'border-grey-75'"
                    @click="filterAspek = filterAspek === a.kode ? null : a.kode"
                  >
                    <span class="text-[10px] font-semibold">{{ a.nama }}</span>
                    <span class="text-SM font-bold" :class="hitung(a.kode, 'tinggi') ? 'text-danger-300' : hitung(a.kode, 'sedang') ? 'text-warning-400' : hitung(a.kode) ? 'text-grey-500' : 'text-success-300'">{{ hitung(a.kode) }}</span>
                  </button>
                </div>
                <div class="text-[11px] text-grey-400">
                  {{ audit.berkas.frontend.length }} berkas frontend · {{ audit.berkas.backend.length }} berkas backend · {{ audit.endpoint.length }} endpoint
                  <span v-if="audit.endpoint.some((e) => !e.berkas.length)" class="text-warning-400">({{ audit.endpoint.filter((e) => !e.berkas.length).length }} tidak terlacak)</span>
                </div>
                <div v-if="!temuanTampil.length" class="rounded-lg bg-success-50 p-2 text-success-400">Tidak ada temuan{{ filterAspek ? " pada aspek ini" : "" }}.</div>
                <ul v-else class="flex flex-col gap-1.5">
                  <li v-for="t in temuanTampil" :key="kunciTemuan(t)" class="rounded-lg border border-grey-75 p-2">
                    <label class="flex cursor-pointer items-start gap-2">
                      <input type="checkbox" class="mt-0.5" :checked="terpilih.has(kunciTemuan(t))" @change="alihTerpilih(t)" />
                      <span class="min-w-0 flex-1">
                        <span class="flex flex-wrap items-center gap-1">
                          <span class="rounded px-1 text-[10px] font-semibold uppercase" :class="WARNA_TINGKAT[t.tingkat]">{{ t.tingkat }}</span>
                          <span class="rounded bg-opensimrs-50 px-1 text-[10px] text-opensimrs-300">{{ t.aspek }}</span>
                          <b>{{ t.judul }}</b><span v-if="(t.jumlah ?? 1) > 1" class="text-grey-400">×{{ t.jumlah }}</span>
                        </span>
                        <span v-if="t.dilaporkan?.length" class="mt-0.5 block text-[11px] text-info-400">
                          Sudah dilaporkan di
                          <button v-for="d in t.dilaporkan" :key="d.uuid" type="button" class="mr-1 underline" @click.prevent="bukaItem(d.uuid)">{{ nomor(d.nomor) }}</button>
                          — kode yang sama dipakai halaman lain; tidak perlu permintaan baru.
                        </span>
                        <span class="mt-0.5 block text-grey-400">{{ t.rincian }}</span>
                        <span v-if="t.bukti.length" class="mt-0.5 block break-all font-mono text-[10px] text-grey-400">
                          {{ t.bukti.map((b) => `${pendekkan(b.berkas)}${b.baris ? `:${b.baris}` : ""}`).join(" · ") }}
                        </span>
                      </span>
                    </label>
                  </li>
                </ul>
                <details class="text-[11px] text-grey-400">
                  <summary class="cursor-pointer">Berkas & endpoint yang diperiksa</summary>
                  <div class="mt-1 break-all font-mono">
                    <div v-for="b in [...audit.berkas.frontend, ...audit.berkas.backend]" :key="b">{{ b }}</div>
                    <div v-for="e in audit.endpoint" :key="`${e.metode} ${e.path}`" class="mt-0.5">
                      {{ e.metode ?? "" }} {{ e.path }}{{ e.status?.length ? ` [${e.status.join(",")}]` : "" }} → {{ e.berkas.length ? e.berkas.map(pendekkan).join(", ") : "tidak terlacak" }}
                    </div>
                  </div>
                </details>
              </template>
            </div>

            <!-- Product / Engineer / QA -->
            <div v-else-if="peranAktif" class="flex flex-col gap-3">
              <div v-if="terkirim" class="flex items-center justify-between gap-2 rounded-lg bg-success-50 p-2 text-success-400">
                <span>Permintaan <b>{{ nomor(terkirim.nomor) }}</b> terkirim ke SIMRS Studio.</span>
                <button type="button" class="underline" @click="bukaItem(terkirim.uuid)">Buka</button>
              </div>
              <p class="text-grey-400">{{ peranAktif.ket }}</p>

              <section v-if="tab === 'qa'" class="rounded-lg border border-grey-75 p-2">
                <div class="mb-1 flex items-center justify-between font-semibold">
                  <span>Cek konsistensi tampilan</span>
                  <button type="button" class="text-[11px] text-opensimrs-300 underline" @click="jalankanCek">Periksa ulang</button>
                </div>
                <ul class="flex flex-col gap-0.5">
                  <li v-for="c in cekTampilan" :key="c.cek" class="flex items-start gap-1.5">
                    <component :is="c.lulus ? 'PhCheckCircle' : 'PhXCircle'" :size="14" weight="fill" class="mt-0.5 shrink-0" :class="c.lulus ? 'text-success-300' : 'text-danger-300'" aria-hidden="true" />
                    <span><b>{{ c.cek }}</b><span class="text-grey-400"> — {{ c.rincian }}</span></span>
                  </li>
                </ul>
              </section>

              <template v-if="!pratinjau">
                <label class="flex flex-col gap-1">
                  <span class="font-semibold">Judul permintaan <span class="text-danger-300">*</span></span>
                  <input v-model="form.judul" maxlength="255" class="h-9 rounded-lg border border-grey-200 px-3" :placeholder="`Singkat & spesifik, mis. ${tab === 'qa' ? 'Simpan pola shift galat 500' : 'Ringkasan pelanggaran istirahat di Jadwal Dinas'}`" />
                </label>
                <div class="grid grid-cols-2 gap-2">
                  <label class="flex flex-col gap-1">
                    <span class="font-semibold">Jenis</span>
                    <select v-model="form.jenis" class="h-9 rounded-lg border border-grey-200 px-2">
                      <option v-for="j in peranAktif.jenis" :key="j" :value="j">{{ NAMA_JENIS[j] }}</option>
                    </select>
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="font-semibold">Prioritas</span>
                    <select v-model="form.prioritas" class="h-9 rounded-lg border border-grey-200 px-2">
                      <option value="P1">P1 — mendesak</option><option value="P2">P2 — normal</option><option value="P3">P3 — rendah</option>
                    </select>
                  </label>
                </div>
                <label v-for="q in peranAktif.pertanyaan" :key="q.kunci" class="flex flex-col gap-1">
                  <span class="font-semibold">{{ q.label }}<span v-if="q.wajib" class="text-danger-300"> *</span></span>
                  <textarea v-model="form[q.kunci]" rows="2" maxlength="4000" class="rounded-lg border border-grey-200 px-3 py-2" :placeholder="q.contoh" />
                </label>
                <label class="flex items-center gap-2"><input v-model="form.sertakanGalat" type="checkbox" /> Sertakan {{ galat.length }} galat halaman ini</label>
                <label v-if="tab === 'qa'" class="flex items-center gap-2"><input v-model="form.sertakanCek" type="checkbox" /> Sertakan hasil cek tampilan</label>
                <label v-if="temuanDipilih.length" class="flex items-center gap-2"><input v-model="form.sertakanAudit" type="checkbox" /> Sertakan {{ temuanDipilih.length }} temuan audit terpilih</label>
                <div class="text-[11px] text-grey-400">Gunakan data fiktif saja (NIK berawalan 9999, HP 080000000000, email @contoh.id).</div>
              </template>

              <div v-else class="flex flex-col gap-2 rounded-lg border border-grey-75 p-3">
                <div class="font-semibold">{{ form.judul }}</div>
                <div class="text-grey-400">{{ NAMA_JENIS[form.jenis] }} · {{ form.prioritas }} · modul {{ modul?.nama ?? "-" }}</div>
                <div v-for="q in peranAktif.pertanyaan.filter((x) => form[x.kunci].trim())" :key="q.kunci">
                  <div class="text-[11px] font-semibold text-grey-400">{{ q.label }}</div>
                  <div class="whitespace-pre-wrap">{{ form[q.kunci] }}</div>
                </div>
                <div class="text-[11px] text-grey-400">
                  Konteks asal: {{ route.path }}{{ konteksAsal.galat.length ? ` · ${konteksAsal.galat.length} galat` : "" }}{{ konteksAsal.cekTampilan.filter((c) => !c.lulus).length ? ` · ${konteksAsal.cekTampilan.filter((c) => !c.lulus).length} cek tampilan gagal` : "" }}
                </div>
              </div>
            </div>
          </div>

          <footer v-if="tab === 'audit' && audit" class="flex items-center justify-between gap-2 border-t border-grey-75 px-4 py-2 text-XS">
            <span class="text-grey-400">{{ temuanDipilih.length }} temuan dipilih</span>
            <CustomButton label="Jadikan permintaan" icon="PhArrowRight" :disabled="!temuanDipilih.length || versiAuditLama" :title="versiAuditLama ? 'Jalankan ulang studio-service lalu audit ulang' : undefined" @click="jadikanPermintaan" />
          </footer>
          <footer v-else-if="peranAktif" class="flex justify-end gap-2 border-t border-grey-75 px-4 py-2">
            <CustomButton v-if="pratinjau" label="Ubah" outlined text-color="text-opensimrs-300" border-color="border-opensimrs-300" :disabled="mengirim" @click="pratinjau = false" />
            <CustomButton v-if="!pratinjau" label="Pratinjau" icon="PhEye" :disabled="!bisaPratinjau" :title="bisaPratinjau ? undefined : 'Isi judul (≥5 karakter) dan kolom wajib (≥10 karakter)'" @click="pratinjau = true" />
            <CustomButton v-else label="Kirim ke SIMRS Studio" icon="PhPaperPlaneRight" :disabled="mengirim" @click="kirim" />
          </footer>
        </aside>
      </transition>
    </Teleport>
  </div>
</template>
