import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { usePicuStore, type KonfigurasiPicu, type KolomPicu } from "@/stores/rawatInap/picu";
import { useAuthStore } from "@/stores/auth";
import { canAccessPermission } from "@/utils/permissions";
import { modulAktif, fiturAktif } from "@/stores/modulFaskes";

// Bagian halaman PICU. "detail" = /picu/episode/:episodeUuid, selebihnya mengikuti segmen kedua path.
export type BagianPicu = "dashboard" | "laporan" | "penerimaan" | "episode" | "detail" | "konfigurasi";

export const namaJenis: Record<string, string> = { antropometri: "Antropometri", observasi: "Observasi", asesmen: "Asesmen", perkembangan: "Perkembangan", keperawatan: "Keperawatan", tindakan: "Tindakan", terapi: "Terapi", rencana: "Rencana" };
export const bolehPicu = (submodule: string, action = "READ") => canAccessPermission({ module: "PICU", submodule, action });
export const formatWaktu = (v: number | string) => new Date(Number(v) * 1000).toLocaleString("id-ID");
export const nilaiDokumen = (d: any, kode: string) => d.isi[kode.replace(/_([a-z])/g, (_, c) => c.toUpperCase())];

// Status dan logika bersama semua halaman PICU. Setiap halaman memakai instans sendiri dengan bagian yang tetap;
// data klinis hanya berada di memori halaman dan dibersihkan saat rute/faskes berganti atau halaman ditinggalkan.
export function usePicu(bagian: BagianPicu) {
  const route = useRoute();
  const router = useRouter();
  const api = usePicuStore();
  const auth = useAuthStore();
  const boleh = bolehPicu;
  const bagianRute = () => (route.params.episodeUuid ? "detail" : route.path.split("/")[2] || "dashboard");
  const sibuk = ref(false);
  const pesan = ref("");
  const gagal = ref("");
  const ringkasan = ref<any>(null);
  const episode = ref<any[]>([]);
  const calon = ref<any[]>([]);
  const pilihanCalon = ref("");
  const konfirmasiIdentitas = ref(false);
  const calonTerpilih = computed(() => calon.value.find((c) => c.referensiPenerimaanUuid === pilihanCalon.value));
  const detail = ref<any>(null);
  const konfigurasi = ref<KonfigurasiPicu[]>([]);
  const bedSumber = ref<any[]>([]);
  const bedPicu = ref<any[]>([]);
  const bedUuid = ref("");
  const halaman = ref(1);
  const halamanDokumentasi = ref(1);
  const total = ref(0);
  const mulai = ref<Date>(new Date());
  const selesai = ref<Date>(new Date());
  const formulirUuid = ref("");
  const formulir = computed(() => konfigurasi.value.find((k) => k.uuid === formulirUuid.value));
  const isi = ref<Record<string, string | number>>(Object.create(null));
  const waktuCatatan = ref("");
  const koreksiUuid = ref("");
  const alasanKoreksi = ref("");
  const jenisKonfigurasi = ref("observasi");
  const namaKonfigurasi = ref("");
  const kolom = ref<KolomPicu[]>([]);
  const referensiPenetapan = ref<Record<string, string>>({});
  const referensiPindah = ref("");
  const calonPerpindahan = ref<any[]>([]);
  const alasanPindah = ref("");
  const jenisKeluar = ref("transfer");
  const sumberTransaksi = ref("laboratorium");
  const transaksi = ref<any>(null);
  const tinjauTransisi = ref(false);
  let generasi = 0;
  let permintaan: { path: string; isi: string; kunci: string } | null = null;
  const usiaSaatMasuk = computed(() => {
    if (!detail.value?.pasien.tanggalLahir) return "Tanggal lahir belum tersedia pada sumber.";
    const lahir = new Date(detail.value.pasien.tanggalLahir).getTime();
    const hari = Math.floor((Number(detail.value.episode.waktuMasuk) * 1000 - lahir) / 86400000);
    return hari >= 0 ? `${hari} hari saat masuk PICU` : "Tanggal lahir sumber perlu diperiksa.";
  });
  // Periode dari awal hari "mulai" sampai akhir hari "selesai" (waktu lokal), dalam epoch detik.
  const periode = () => {
    const awal = new Date(mulai.value); awal.setHours(0, 0, 0, 0);
    const akhir = new Date(selesai.value); akhir.setHours(23, 59, 59, 0);
    return { mulai_at: Math.floor(awal.getTime() / 1000), selesai_at: Math.floor(akhir.getTime() / 1000) };
  };

  function bersihkan() {
    generasi++;
    ringkasan.value = null; episode.value = []; calon.value = []; detail.value = null; transaksi.value = null; calonPerpindahan.value = [];
    konfigurasi.value = []; bedSumber.value = []; bedPicu.value = []; pilihanCalon.value = "";
    isi.value = Object.create(null); formulirUuid.value = ""; koreksiUuid.value = ""; alasanKoreksi.value = "";
    waktuCatatan.value = ""; referensiPindah.value = ""; alasanPindah.value = ""; konfirmasiIdentitas.value = false;
    kolom.value = []; namaKonfigurasi.value = ""; referensiPenetapan.value = {}; bedUuid.value = "";
    tinjauTransisi.value = false; jenisKeluar.value = "transfer"; halaman.value = 1; halamanDokumentasi.value = 1;
    permintaan = null; pesan.value = ""; gagal.value = "";
  }
  async function muat() {
    const g = ++generasi;
    gagal.value = ""; sibuk.value = true;
    try {
      if (!modulAktif("picu")) throw new Error("Modul PICU tidak aktif.");
      if (["dashboard", "laporan"].includes(bagian)) {
        const hasil = await api.get(bagian === "laporan" ? "laporan/operasional" : "dashboard", periode());
        if (g === generasi) ringkasan.value = hasil;
      } else if (bagian === "penerimaan") {
        const hasil = await api.get("penerimaan");
        if (g === generasi) calon.value = hasil;
      } else if (bagian === "detail") {
        if (route.params.episodeUuid) {
          const hasil = await api.get(`episode/${route.params.episodeUuid}`, { halaman_dokumentasi: halamanDokumentasi.value });
          if (g === generasi) detail.value = hasil;
          if (fiturAktif("picu_tempat_tidur") && (boleh("Episode", "PINDAH") || boleh("Episode", "TUTUP"))) {
            const p = await api.get(`episode/${route.params.episodeUuid}/perpindahan`);
            if (g === generasi) calonPerpindahan.value = p;
          }
          if (boleh("Konfigurasi")) {
            const k = await api.get("konfigurasi");
            if (g === generasi) konfigurasi.value = k;
          }
        }
      } else if (bagian === "episode") {
        const hasil = await api.get("episode", { halaman: halaman.value });
        if (g === generasi) { episode.value = hasil.items; total.value = hasil.total; }
      } else if (bagian === "konfigurasi") {
        const hasil = await api.get("konfigurasi");
        if (g === generasi) konfigurasi.value = hasil;
        if (boleh("Tempat Tidur", "KELOLA")) {
          const [s, p] = await Promise.all([api.get("tempat-tidur/sumber"), api.get("tempat-tidur")]);
          if (g === generasi) { bedSumber.value = s; bedPicu.value = p; }
        }
      }
    } catch (e: any) { if (g === generasi) gagal.value = e.message; }
    finally { if (g === generasi) sibuk.value = false; }
  }
  async function simpan(path: string, data: object, setelah?: (hasil: any) => void) {
    if (sibuk.value) return;
    const g = generasi;
    sibuk.value = true; gagal.value = ""; pesan.value = "";
    const serialized = JSON.stringify(data);
    if (!permintaan || permintaan.path !== path || permintaan.isi !== serialized) permintaan = { path, isi: serialized, kunci: crypto.randomUUID() };
    try {
      const hasil = await api.post(path, data, permintaan.kunci);
      if (g !== generasi) return;
      permintaan = null; pesan.value = "Perubahan berhasil tersimpan.";
      setelah?.(hasil);
      await muat();
    } catch (e: any) { if (g === generasi) gagal.value = e.message; }
    finally { if (g === generasi) sibuk.value = false; }
  }
  function terima() {
    const c = calonTerpilih.value;
    if (!c || !konfirmasiIdentitas.value) return;
    simpan("episode", { pasienUuid: c.pasienUuid, kunjunganUuid: c.kunjunganUuid, tempatTidurUuid: c.tempatTidurUuid,
      referensiPenerimaanUuid: c.referensiPenerimaanUuid, sumberPenerimaan: "rawat_inap" }, (hasil) => router.push(`/picu/episode/${hasil.uuid}`));
  }
  function catat() {
    if (!detail.value || !formulir.value) return;
    const data: any = { konfigurasiUuid: formulirUuid.value, waktuCatatan: Math.floor(new Date(waktuCatatan.value).getTime() / 1000), isi: isi.value };
    if (koreksiUuid.value) { data.koreksiUuid = koreksiUuid.value; data.alasan = alasanKoreksi.value; }
    simpan(`episode/${detail.value.episode.uuid}/dokumentasi`, data, () => { isi.value = Object.create(null); koreksiUuid.value = ""; alasanKoreksi.value = ""; });
  }
  function koreksi(d: any) {
    formulirUuid.value = d.konfigurasiUuid;
    koreksiUuid.value = d.uuid;
    isi.value = Object.fromEntries(d.definisi.map((k: KolomPicu) => [k.kode, nilaiDokumen(d, k.kode)]));
    const dt = new Date(Number(d.waktuCatatan) * 1000);
    waktuCatatan.value = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  function batalKoreksi() { koreksiUuid.value = ""; isi.value = {}; alasanKoreksi.value = ""; }
  function pindah(tutup: boolean) {
    if (!detail.value || !tinjauTransisi.value) return;
    const data: any = { versi: detail.value.episode.versi, alasan: alasanPindah.value };
    if (referensiPindah.value) data.referensiUuid = referensiPindah.value;
    if (tutup) data.jenisKeluar = jenisKeluar.value;
    simpan(`episode/${detail.value.episode.uuid}/${tutup ? "penutupan" : "perpindahan"}`, data, () => { tinjauTransisi.value = false; });
  }
  async function muatTransaksi() {
    const g = generasi;
    const sumber = sumberTransaksi.value;
    transaksi.value = null; gagal.value = "";
    try {
      const hasil = await api.get(`episode/${detail.value.episode.uuid}/transaksi`, { sumber });
      if (g === generasi && sumber === sumberTransaksi.value) transaksi.value = hasil;
    } catch (e: any) { if (g === generasi) gagal.value = e.message; }
  }
  function gantiHalaman(langkah: number) { halaman.value += langkah; muat(); }
  function gantiHalamanDokumentasi(langkah: number) { halamanDokumentasi.value += langkah; muat(); }
  watch(pilihanCalon, () => { konfirmasiIdentitas.value = false; });
  watch(sumberTransaksi, () => { transaksi.value = null; });
  watch(formulirUuid, () => { if (!koreksiUuid.value) isi.value = Object.create(null); });
  // Hanya muat ulang bila rute aktif masih milik bagian ini (halaman lama tidak ikut memuat saat berpindah bagian).
  watch(() => [route.fullPath, auth.faskesUuid], () => { if (bagianRute() !== bagian) return; bersihkan(); muat(); }, { immediate: true });
  onBeforeUnmount(bersihkan);

  return {
    boleh, fiturAktif, namaJenis, formatWaktu, nilaiDokumen,
    sibuk, pesan, gagal, ringkasan, episode, calon, pilihanCalon, konfirmasiIdentitas, calonTerpilih, detail, konfigurasi,
    bedSumber, bedPicu, bedUuid, halaman, halamanDokumentasi, total, mulai, selesai, formulirUuid, formulir, isi, waktuCatatan,
    koreksiUuid, alasanKoreksi, jenisKonfigurasi, namaKonfigurasi, kolom, referensiPenetapan, referensiPindah, calonPerpindahan,
    alasanPindah, jenisKeluar, sumberTransaksi, transaksi, tinjauTransisi, usiaSaatMasuk,
    muat, simpan, terima, catat, koreksi, batalKoreksi, pindah, muatTransaksi, gantiHalaman, gantiHalamanDokumentasi,
  };
}
