<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { usePicuStore, type KonfigurasiPicu, type KolomPicu } from "@/stores/rawatInap/picu";
import { useAuthStore } from "@/stores/auth";
import { canAccessPermission } from "@/utils/permissions";
import { modulAktif, fiturAktif } from "@/stores/modulFaskes";

const route = useRoute();
const router = useRouter();
const api = usePicuStore();
const auth = useAuthStore();
const bagian = computed(() => route.path.split("/")[2] || "dashboard");
const boleh = (submodule: string, action = "READ") => canAccessPermission({ module: "PICU", submodule, action });
const namaJenis: Record<string, string> = { antropometri: "Antropometri", observasi: "Observasi", asesmen: "Asesmen", perkembangan: "Perkembangan", keperawatan: "Keperawatan", tindakan: "Tindakan", terapi: "Terapi", rencana: "Rencana" };
const menu = [
  { path: "dashboard", nama: "Dasbor", izin: "Dasbor", fitur: "dasbor" },
  { path: "penerimaan", nama: "Penerimaan", izin: "Episode", aksi: "CREATE", fitur: "episode" },
  { path: "episode", nama: "Episode", izin: "Episode", fitur: "episode" },
  { path: "konfigurasi", nama: "Konfigurasi", izin: "Konfigurasi", fitur: "konfigurasi" },
  { path: "laporan", nama: "Laporan", izin: "Laporan Operasional", fitur: "laporan" },
];
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
const mulai = ref(new Date().toISOString().slice(0, 10));
const selesai = ref(mulai.value);
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
const formatWaktu = (v: number | string) => new Date(Number(v) * 1000).toLocaleString("id-ID");
const nilaiDokumen = (d: any, kode: string) => d.isi[kode.replace(/_([a-z])/g, (_, c) => c.toUpperCase())];
const usiaSaatMasuk = computed(() => {
  if (!detail.value?.pasien.tanggalLahir) return "Tanggal lahir belum tersedia pada sumber.";
  const lahir = new Date(detail.value.pasien.tanggalLahir).getTime();
  const hari = Math.floor((Number(detail.value.episode.waktuMasuk) * 1000 - lahir) / 86400000);
  return hari >= 0 ? `${hari} hari saat masuk PICU` : "Tanggal lahir sumber perlu diperiksa.";
});
const periode = () => ({ mulai_at: Math.floor(new Date(`${mulai.value}T00:00:00`).getTime() / 1000), selesai_at: Math.floor(new Date(`${selesai.value}T23:59:59`).getTime() / 1000) });

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
    if (["dashboard", "laporan"].includes(bagian.value)) {
      const hasil = await api.get(bagian.value === "laporan" ? "laporan/operasional" : "dashboard", periode());
      if (g === generasi) ringkasan.value = hasil;
    } else if (bagian.value === "penerimaan") {
      const hasil = await api.get("penerimaan");
      if (g === generasi) calon.value = hasil;
    } else if (bagian.value === "episode") {
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
      } else {
        const hasil = await api.get("episode", { halaman: halaman.value });
        if (g === generasi) { episode.value = hasil.items; total.value = hasil.total; }
      }
    } else if (bagian.value === "konfigurasi") {
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
watch(pilihanCalon, () => { konfirmasiIdentitas.value = false; });
watch(sumberTransaksi, () => { transaksi.value = null; });
watch(formulirUuid, () => { if (!koreksiUuid.value) isi.value = Object.create(null); });
watch(() => [route.fullPath, auth.faskesUuid], () => { bersihkan(); muat(); }, { immediate: true });
onBeforeUnmount(bersihkan);
</script>

<template>
  <section class="flex flex-col gap-4 p-4 overflow-auto h-full bg-white rounded-lg">
    <h1 class="text-xl font-semibold">PICU / Intensif Anak</h1>
    <nav class="flex flex-wrap gap-4" aria-label="Menu PICU">
      <template v-for="m in menu" :key="m.path">
        <RouterLink v-if="boleh(m.izin, m.aksi) && fiturAktif(`picu_${m.fitur}`)" :to="`/picu/${m.path}`" class="underline">{{ m.nama }}</RouterLink>
      </template>
    </nav>
    <p v-if="gagal" role="alert" class="text-red-700">{{ gagal }}</p>
    <p v-if="pesan" role="status">{{ pesan }}</p>
    <p v-if="sibuk" role="status">Sedang memproses permintaan…</p>
    <button type="button" :disabled="sibuk" class="self-start underline" @click="muat">Muat ulang</button>

    <template v-if="bagian === 'dashboard' || bagian === 'laporan'">
      <form class="flex flex-wrap gap-3 items-end" @submit.prevent="muat">
        <label>Dari tanggal <input v-model="mulai" type="date" required /></label>
        <label>Sampai tanggal <input v-model="selesai" type="date" required /></label>
        <button :disabled="sibuk">Tampilkan</button>
      </form>
      <template v-if="ringkasan">
        <dl class="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div v-for="(label, k) in { kapasitas: 'Kapasitas', tersedia: 'Tersedia', terpakai: 'Terpakai', tidakOperasional: 'Tidak operasional', masuk: 'Masuk', transferKeluar: 'Transfer keluar', pulang: 'Pulang' }" :key="k" class="p-3 border rounded">
            <dt>{{ label }}</dt><dd class="text-lg font-semibold">{{ ringkasan[k] }}</dd>
          </div>
        </dl>
        <p>Kapasitas dan okupansi mengikuti keadaan tempat tidur sumber saat ini. Ringkasan masuk dan keluar mengikuti periode terpilih.</p>
        <table class="w-full text-left"><caption class="text-left font-semibold">Tempat tidur PICU</caption>
          <thead><tr><th>Kode</th><th>Lokasi</th><th>Status</th></tr></thead>
          <tbody><tr v-for="b in ringkasan.tempatTidur" :key="b.uuid"><td>{{ b.noBed }}</td><td>{{ b.lokasi }}</td><td>{{ b.status.replaceAll('_', ' ') }}</td></tr></tbody>
        </table>
      </template>
    </template>

    <form v-if="bagian === 'penerimaan'" class="flex flex-col gap-3" @submit.prevent="terima">
      <h2 class="font-semibold">Verifikasi penerimaan dari rawat inap</h2>
      <p>Selesaikan perpindahan dan penempatan melalui rawat inap terlebih dahulu.</p>
      <label>Pasien dan kunjungan
        <select v-model="pilihanCalon" required><option value="">Pilih penerimaan sumber</option>
          <option v-for="c in calon" :key="c.referensiPenerimaanUuid" :value="c.referensiPenerimaanUuid">{{ c.namaPasien }} · {{ c.noRm }} · {{ c.noReg }} · {{ c.noBed }}</option>
        </select>
      </label>
      <p v-if="!calon.length && !sibuk">Tidak ada perpindahan sumber yang dapat diterima.</p>
      <div v-if="calonTerpilih" class="p-3 border rounded">
        <p>{{ calonTerpilih.namaPasien }} · Nomor rekam medis {{ calonTerpilih.noRm }}</p>
        <p>Kunjungan {{ calonTerpilih.noReg }} · Tempat tidur {{ calonTerpilih.noBed }}</p>
        <label><input v-model="konfirmasiIdentitas" type="checkbox" required /> Identitas, kunjungan, dan tempat tidur telah saya periksa.</label>
      </div>
      <button :disabled="sibuk || !konfirmasiIdentitas">Terima di PICU</button>
    </form>

    <template v-if="bagian === 'episode' && !detail">
      <table class="w-full text-left"><caption class="text-left font-semibold">Daftar episode</caption>
        <thead><tr><th>Pasien</th><th>Nomor rekam medis</th><th>Tempat tidur</th><th>Status</th><th>Detail</th></tr></thead>
        <tbody><tr v-for="e in episode" :key="e.uuid"><td>{{ e.namaPasien }}</td><td>{{ e.noRm }}</td><td>{{ e.noBed }}</td><td>{{ e.status }}</td><td><RouterLink :to="`/picu/episode/${e.uuid}`" class="underline">Buka episode</RouterLink></td></tr></tbody>
      </table>
      <div class="flex gap-3"><button :disabled="halaman <= 1 || sibuk" @click="halaman--; muat()">Sebelumnya</button><span>Halaman {{ halaman }}</span><button :disabled="halaman * 25 >= total || sibuk" @click="halaman++; muat()">Berikutnya</button></div>
    </template>
    <template v-if="bagian === 'episode' && detail">
      <div class="p-3 border rounded bg-gray-50">
        <h2 class="font-semibold">{{ detail.pasien.namaPasien }} · {{ detail.pasien.noRm }}</h2>
        <p>Kunjungan {{ detail.pasien.noReg }} · Episode {{ detail.episode.uuid }} · {{ detail.episode.status }}</p>
        <p>Masuk {{ formatWaktu(detail.episode.waktuMasuk) }} · Versi {{ detail.episode.versi }}</p>
        <p>{{ usiaSaatMasuk }}</p>
      </div>
      <form v-if="boleh('Konfigurasi') && (detail.episode.status === 'aktif' || koreksiUuid)" class="flex flex-col gap-3 p-3 border rounded" @submit.prevent="catat">
        <h3 class="font-semibold">{{ koreksiUuid ? 'Revisi dokumentasi' : 'Catat dokumentasi' }}</h3>
        <label>Formulir <select v-model="formulirUuid" :disabled="!!koreksiUuid" required><option value="">Pilih formulir yang berlaku</option>
          <template v-for="k in konfigurasi" :key="k.uuid"><option v-if="k.status === 'berlaku' && boleh(namaJenis[k.jenis], koreksiUuid ? 'KOREKSI' : 'CREATE') && fiturAktif(k.jenis === 'antropometri' ? 'picu_antropometri' : k.jenis === 'observasi' ? 'picu_observasi' : 'picu_dokumentasi')" :value="k.uuid">{{ k.nama }} · {{ namaJenis[k.jenis] }}</option></template>
        </select></label>
        <p v-if="!konfigurasi.some(k => k.status === 'berlaku')">Konfigurasi dokumentasi perlu dilengkapi oleh pihak berwenang.</p>
        <template v-if="formulir">
          <label>Waktu catatan <input v-model="waktuCatatan" type="datetime-local" required /></label>
          <label v-for="k in formulir.definisi" :key="k.kode">{{ k.nama }} {{ k.satuan ? `(${k.satuan})` : '' }}
            <input v-if="k.tipe === 'angka'" v-model.number="isi[k.kode]" type="number" step="any" :required="k.wajib" />
            <textarea v-else v-model="isi[k.kode]" :required="k.wajib" maxlength="10000"></textarea>
          </label>
          <label v-if="koreksiUuid">Alasan koreksi <textarea v-model="alasanKoreksi" required maxlength="2000"></textarea></label>
          <button :disabled="sibuk">Simpan draf</button>
          <button v-if="koreksiUuid" type="button" @click="koreksiUuid = ''; isi = {}; alasanKoreksi = ''">Batalkan koreksi</button>
        </template>
      </form>
      <h3 class="font-semibold">Dokumentasi dan revisi</h3>
      <div class="flex gap-3"><button :disabled="halamanDokumentasi <= 1 || sibuk" @click="halamanDokumentasi--; muat()">Catatan sebelumnya</button><span>Halaman {{ halamanDokumentasi }}</span><button :disabled="!detail.dokumentasiBerikutnya || sibuk" @click="halamanDokumentasi++; muat()">Catatan berikutnya</button></div>
      <article v-for="d in detail.dokumentasi" :key="d.uuid" class="flex flex-col gap-2 p-3 border rounded">
        <h4>{{ d.namaFormulir }} · {{ d.status }} · {{ formatWaktu(d.waktuCatatan) }}</h4>
        <p>Pencatat {{ d.dibuatOleh }} · {{ formatWaktu(d.createdAt) }}</p>
        <p v-if="d.koreksiUuid">Revisi dari {{ d.koreksiUuid }} · {{ d.alasan }}</p>
        <dl><div v-for="k in d.definisi" :key="k.kode"><dt class="inline font-semibold">{{ k.nama }}: </dt><dd class="inline whitespace-pre-wrap">{{ nilaiDokumen(d, k.kode) }} {{ k.satuan }}</dd></div></dl>
        <button v-if="d.status === 'draf' && boleh(namaJenis[d.jenis], 'FINALISASI')" :disabled="sibuk" @click="simpan(`episode/${detail.episode.uuid}/dokumentasi/${d.uuid}/finalisasi`, {})">Finalisasi sesuai kewenangan</button>
        <button v-if="d.status === 'final' && boleh(namaJenis[d.jenis], 'KOREKSI') && !detail.dokumentasi.some((r: any) => r.koreksiUuid === d.uuid)" :disabled="sibuk" @click="koreksi(d)">Buat revisi</button>
      </article>
      <div v-if="boleh('Transaksi Sumber') && fiturAktif('picu_transaksi')" class="flex flex-col gap-2 p-3 border rounded">
        <h3 class="font-semibold">Order dan hasil pada modul sumber</h3>
        <p>Transaksi ditautkan melalui pasien dan kunjungan yang sama. Hasil pemeriksaan dibuka di modul sumber sesuai izin.</p>
        <label>Modul sumber <select v-model="sumberTransaksi"><option value="laboratorium">Laboratorium</option><option value="radiologi">Radiologi</option><option value="farmasi">Farmasi</option></select></label>
        <button :disabled="sibuk" @click="muatTransaksi">Muat referensi transaksi</button>
        <template v-if="transaksi"><p v-if="!transaksi.items.length">Belum ada transaksi terkait pada sumber ini.</p><p v-for="tr in transaksi.items" :key="tr.transaksiUuid">{{ tr.transaksiUuid }} · {{ tr.status }}</p><RouterLink :to="{ path: transaksi.rute, query: { noReg: detail.pasien.noReg } }" class="underline">Buka modul sumber</RouterLink></template>
      </div>
      <form v-if="detail.episode.status === 'aktif' && fiturAktif('picu_tempat_tidur') && (boleh('Episode', 'PINDAH') || boleh('Episode', 'TUTUP'))" class="flex flex-col gap-3 p-3 border rounded" @submit.prevent>
        <h3 class="font-semibold">Perpindahan atau penutupan</h3>
        <p>Selesaikan perpindahan atau pemulangan melalui modul sumber, kemudian tautkan hasilnya di sini.</p>
        <label>Perpindahan sumber <select v-model="referensiPindah"><option value="">Pilih perpindahan atau lanjutkan pemulangan</option><option v-for="p in calonPerpindahan" :key="p.uuid" :value="p.uuid">{{ p.lokasi }} · {{ p.tujuan }} · {{ formatWaktu(p.waktuPindah) }}</option></select></label>
        <label>Jenis keluar <select v-model="jenisKeluar"><option value="transfer">Transfer keluar PICU</option><option value="pulang">Pulang</option></select></label>
        <label>Alasan <textarea v-model="alasanPindah" required maxlength="2000"></textarea></label>
        <label><input v-model="tinjauTransisi" type="checkbox" /> Identitas episode dan hasil workflow sumber telah saya periksa.</label>
        <button v-if="boleh('Episode', 'PINDAH')" :disabled="sibuk || !tinjauTransisi || !alasanPindah" @click="pindah(false)">Tautkan perpindahan antartempat tidur PICU</button>
        <button v-if="boleh('Episode', 'TUTUP')" :disabled="sibuk || !tinjauTransisi || !alasanPindah" @click="pindah(true)">Tutup episode</button>
      </form>
      <h3 class="font-semibold">Riwayat episode</h3>
      <ol><li v-for="r in detail.riwayat" :key="r.uuid">{{ formatWaktu(r.createdAt) }} · {{ r.jenis }} · {{ r.alasan }} · {{ r.dibuatOleh }} · Asal {{ r.asalUuid || '-' }} → Tujuan {{ r.tujuanUuid || '-' }}</li></ol>
    </template>

    <template v-if="bagian === 'konfigurasi'">
      <p>Setiap konfigurasi adalah versi baru. Formulir yang berlaku dipertahankan untuk dokumentasi historis. Penetapan penggunaan harus merujuk keputusan pemilik proses klinis.</p>
      <form v-if="boleh('Tempat Tidur', 'KELOLA') && fiturAktif('picu_tempat_tidur')" class="flex flex-col gap-2 p-3 border rounded" @submit.prevent="simpan('tempat-tidur', { tempatTidurUuid: bedUuid })">
        <h2 class="font-semibold">Pemetaan tempat tidur PICU</h2>
        <label>Tempat tidur sumber <select v-model="bedUuid" required><option value="">Pilih tempat tidur</option><option v-for="b in bedSumber" :key="b.uuid" :value="b.uuid">{{ b.lokasi }} · {{ b.noBed }}</option></select></label>
        <button :disabled="sibuk">Tambahkan pemetaan</button>
        <p v-for="b in bedPicu" :key="b.uuid">{{ b.lokasi }} · {{ b.noBed }} · {{ b.status }}</p>
      </form>
      <form v-if="boleh('Konfigurasi', 'CREATE')" class="flex flex-col gap-3 p-3 border rounded" @submit.prevent="simpan('konfigurasi', { jenis: jenisKonfigurasi, nama: namaKonfigurasi, definisi: kolom })">
        <h2 class="font-semibold">Draf versi formulir baru</h2>
        <label>Jenis <select v-model="jenisKonfigurasi"><option v-for="(label, kode) in namaJenis" :key="kode" :value="kode">{{ label }}</option></select></label>
        <label>Nama formulir dan versi <input v-model="namaKonfigurasi" required maxlength="255" /></label>
        <fieldset v-for="(k, i) in kolom" :key="i" class="flex flex-wrap gap-2 p-2 border">
          <legend>Parameter {{ i + 1 }}</legend>
          <label>Kode <input v-model="k.kode" required pattern="[a-z][a-z0-9_]{0,49}" /></label>
          <label>Nama <input v-model="k.nama" required /></label>
          <label>Tipe <select v-model="k.tipe"><option value="angka">Angka</option><option value="teks">Teks</option></select></label>
          <label>Satuan <input v-model="k.satuan" maxlength="50" /></label>
          <label><input v-model="k.wajib" type="checkbox" /> Wajib</label>
          <button type="button" @click="kolom.splice(i, 1)">Hapus parameter draf</button>
        </fieldset>
        <button type="button" @click="kolom.push({ kode: '', nama: '', tipe: 'teks', satuan: '', wajib: false })">Tambah parameter</button>
        <button :disabled="sibuk || !kolom.length">Simpan draf konfigurasi</button>
      </form>
      <article v-for="k in konfigurasi" :key="k.uuid" class="flex flex-col gap-2 p-3 border rounded">
        <h3>{{ k.nama }} · {{ namaJenis[k.jenis] }} · {{ k.status }}</h3>
        <p v-for="c in k.definisi" :key="c.kode">{{ c.nama }} · {{ c.tipe }} · {{ c.satuan }} {{ c.wajib ? '· wajib' : '' }}</p>
        <p v-if="k.referensiPenetapan">Referensi penetapan: {{ k.referensiPenetapan }}</p>
        <form v-if="k.status === 'draf' && boleh('Konfigurasi', 'VALIDASI')" class="flex flex-col gap-2" @submit.prevent="simpan(`konfigurasi/${k.uuid}/pengesahan`, { referensiPenetapan: referensiPenetapan[k.uuid] })">
          <label>Referensi keputusan pemilik proses klinis <textarea v-model="referensiPenetapan[k.uuid]" required maxlength="2000"></textarea></label>
          <button :disabled="sibuk">Tetapkan versi sesuai kewenangan</button>
        </form>
      </article>
    </template>
  </section>
</template>

<style scoped>
input:not([type="checkbox"]), select, textarea { border: 1px solid #9ca3af; border-radius: 0.25rem; padding: 0.4rem; display: block; width: 100%; }
button { border: 1px solid #9ca3af; border-radius: 0.25rem; padding: 0.4rem 0.8rem; align-self: flex-start; }
button:disabled { opacity: 0.5; cursor: wait; }
th, td { padding: 0.5rem; border-bottom: 1px solid #e5e7eb; }
</style>
