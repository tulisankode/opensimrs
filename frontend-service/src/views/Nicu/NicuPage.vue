<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useNicuStore } from "@/stores/rawatInap/nicu";
import { useAuthStore } from "@/stores/auth";
import { useModulFaskesStore } from "@/stores/modulFaskes";
import { hasPermission } from "@/utils/permissions";

const route = useRoute();
const router = useRouter();
const store = useNicuStore();
const auth = useAuthStore();
const modul = useModulFaskesStore();
const halaman = computed(() => route.path.split("/")[2] || "dashboard");
const izin = (sub: string, aksi = "READ") => hasPermission("NICU", sub, aksi);
const fitur = (kode: string) => modul.fitur(kode);
const submodul: Record<string, string> = { dashboard: "Dasbor", penerimaan: "Penerimaan", episode: "Episode", tempat: "Tempat", konfigurasi: "Konfigurasi", laporan: "Laporan" };
const judul = computed(() => ({ dashboard: "Dasbor NICU", penerimaan: "Penerimaan bayi", episode: "Episode NICU", tempat: "Tempat dan status alat", konfigurasi: "Konfigurasi formulir NICU", laporan: "Laporan operasional NICU" }[halaman.value] || "Episode NICU"));
const sibuk = ref(false);
const pesan = ref("");
const baris = ref<any[]>([]);
const ringkasan = ref<any[]>([]);
const sumber = ref<any[]>([]);
const unit = ref<any[]>([]);
const konfigurasi = ref<any[]>([]);
const detail = ref<any>(null);
const dokumen = ref<any[]>([]);
const histori = ref<any[]>([]);
const revisi = ref<any[]>([]);
const relasi = ref<any>(null);
const nomorHalaman = ref(1);
const unitFilter = ref("");
const dari = ref(new Date(Date.now() - 86400000).toISOString().slice(0, 10));
const sampai = ref(new Date().toISOString().slice(0, 10));
const pilihan = ref<any>(null);
const serahTerima = ref("");
const verifikasi = ref(false);
const sumberUuid = ref("");
const jenisTempat = ref("inkubator");
const statusAlat = ref("siap");
const unitUuid = ref("");
const jenisForm = ref("neonatal");
const fields = ref<any[]>([]);
const pengesahan = ref("");
const konfigurasiUuid = ref("");
const isian = ref<Record<string, any>>({});
const waktuCatat = ref("");
const dokumenKoreksi = ref<any>(null);
const alasan = ref("");
const perpindahanUuid = ref("");
const tempatTujuanUuid = ref("");
const tempatPilihan = ref<any[]>([]);
const transaksi = ref<any[]>([]);
const kunci = ref(crypto.randomUUID());
let generasi = 0;
const configAktif = computed(() => konfigurasi.value.find((k) => k.uuid === konfigurasiUuid.value));
const pilihanUnit = computed(() => [...new Map([...baris.value, ...ringkasan.value].filter((r) => r.unitUuid).map((r) => [r.unitUuid, { uuid: r.unitUuid, nama: r.namaUnit || r.lokasi || r.unitUuid }])).values()]);
const jenisDiizinkan = (jenis: string) => jenis === 'neonatal' ? fitur('nicu_data_neonatal') : jenis === 'observasi' ? fitur('nicu_observasi') : fitur('nicu_dokumentasi');
const camel = (kode: string) => kode.replace(/_([a-z])/g, (_, h) => h.toUpperCase());
const formatWaktu = (nilai: any) => nilai ? new Date(Number(nilai) * 1000).toLocaleString("id-ID") : "—";
const filter = () => ({ halaman: nomorHalaman.value, ...(unitFilter.value ? { unit_uuid: unitFilter.value } : {}) });
const periode = () => ({ ...filter(), dari: Math.floor(new Date(`${dari.value}T00:00:00`).getTime() / 1000), sampai: Math.floor(new Date(`${sampai.value}T23:59:59`).getTime() / 1000) });

async function muat() {
  const versi = ++generasi;
  sibuk.value = true;
  pesan.value = "";
  try {
    if (!modul.aktif("nicu") || !izin(submodul[halaman.value] || "Episode")) return;
    const id = route.params.uuid as string | undefined;
    if (id) {
      const res = await store.baca(`episode/${id}`);
      if (versi !== generasi) return;
      detail.value = res?.payload ?? null;
      if (!detail.value) { pesan.value = "Episode belum dapat dimuat."; return; }
      if (detail.value.episode.status === "aktif") {
        const hasil = await store.baca(`episode/${id}/perpindahan`);
        if (versi !== generasi) return;
        transaksi.value = hasil?.payload ?? [];
      }
      if (izin("Dokumentasi")) {
        const hasil = await store.baca(`episode/${id}/dokumen`, filter());
        if (versi !== generasi) return;
        dokumen.value = hasil?.payload ?? [];
      }
      if (izin("Penempatan")) {
        const hasil = await store.baca(`episode/${id}/penempatan`, filter());
        if (versi !== generasi) return;
        histori.value = hasil?.payload ?? [];
      }
      if (izin("Konfigurasi")) {
        const hasil = await store.baca("konfigurasi", filter());
        if (versi !== generasi) return;
        konfigurasi.value = (hasil?.payload ?? []).filter((k: any) => k.status === "terbit" && jenisDiizinkan(k.jenis));
      }
      if (izin("Tempat")) {
        const hasil = await store.baca("tempat", filter());
        if (versi !== generasi) return;
        tempatPilihan.value = hasil?.payload ?? [];
      }
    } else {
      const path = halaman.value === "laporan" ? "laporan/operasional" : halaman.value;
      const res = await store.baca(path, ["laporan", "dashboard"].includes(halaman.value) ? periode() : filter());
      if (versi !== generasi) return;
      if (!res) { pesan.value = "Data belum dapat dimuat."; return; }
      baris.value = halaman.value === "dashboard" ? res.payload?.tempat ?? [] : res.payload ?? [];
      ringkasan.value = res.payload?.ringkasan ?? [];
      if (halaman.value === "tempat") {
        const hasil = await store.baca("sumber-tempat", filter());
        if (versi !== generasi) return;
        sumber.value = hasil?.payload ?? [];
      }
      if (halaman.value === "konfigurasi") {
        const hasil = await store.baca("unit", filter());
        if (versi !== generasi) return;
        unit.value = hasil?.payload ?? [];
      }
    }
  } finally { if (versi === generasi) sibuk.value = false; }
}

async function simpan(path: string, data: object) {
  if (sibuk.value) return;
  const versi = generasi;
  sibuk.value = true;
  try {
    const res = await store.simpan(path, data, kunci.value);
    if (versi !== generasi) return;
    if (res) {
      kunci.value = crypto.randomUUID();
      pilihan.value = null;
      dokumenKoreksi.value = null;
      serahTerima.value = "";
      verifikasi.value = false;
      isian.value = {};
      alasan.value = "";
      await muat();
      pesan.value = "Data NICU berhasil disimpan.";
    } else {
      await muat();
      pesan.value = "Penyimpanan belum terkonfirmasi. Periksa kondisi terbaru sebelum mencoba kembali.";
    }
  } finally { if (versi === generasi) sibuk.value = false; }
}

function terima() {
  if (!pilihan.value) return;
  const p = pilihan.value;
  return simpan("episode", { rawatInapUuid: p.rawatInapUuid, pasienUuid: p.pasienUuid, perpindahanMasukUuid: p.perpindahanMasukUuid,
    tempatUuid: p.tempatUuid, verifikasiIdentitas: verifikasi.value, serahTerima: serahTerima.value });
}
function tambahTempat() {
  const p = sumber.value.find((s) => s.uuid === sumberUuid.value);
  if (p) return simpan("tempat", { unitUuid: p.unitUuid, roomMonitoringUuid: p.uuid, jenis: jenisTempat.value, statusAlat: statusAlat.value });
}
function tambahKonfigurasi() {
  return simpan("konfigurasi", { unitUuid: unitUuid.value, jenis: jenisForm.value, definisi: { fields: fields.value } });
}
function simpanDokumen() {
  const isi = Object.fromEntries((configAktif.value?.definisi?.fields ?? []).filter((f: any) => isian.value[camel(f.kode)] !== undefined && isian.value[camel(f.kode)] !== "").map((f: any) => [f.kode, f.tipe === "angka" ? Number(isian.value[camel(f.kode)]) : isian.value[camel(f.kode)]]));
  if (dokumenKoreksi.value) return simpan(`dokumen/${dokumenKoreksi.value.uuid}/koreksi`, { versi: dokumenKoreksi.value.versi, isi, alasan: alasan.value });
  return simpan(`episode/${route.params.uuid}/dokumen`, { konfigurasiVersiUuid: konfigurasiUuid.value, waktuPencatatan: Math.floor(new Date(waktuCatat.value).getTime() / 1000), isi });
}
function koreksi(d: any) {
  dokumenKoreksi.value = d;
  if (!konfigurasi.value.some((k) => k.uuid === d.konfigurasiVersiUuid)) konfigurasi.value.push({ uuid: d.konfigurasiVersiUuid, jenis: d.jenis, definisi: d.definisi });
  konfigurasiUuid.value = d.konfigurasiVersiUuid;
  isian.value = { ...d.isi };
  alasan.value = "";
}
async function lihatRevisi(d: any) {
  const versi = generasi;
  const res = await store.baca(`dokumen/${d.uuid}/revisi`, filter());
  if (versi === generasi) revisi.value = res?.payload ?? [];
}
async function lihatRelasi() {
  const versi = generasi;
  const res = await store.baca(`episode/${route.params.uuid}/identitas`);
  if (versi === generasi) relasi.value = res?.payload?.registrasiBayi ?? { nameMom: "Relasi belum tercatat; verifikasi melalui pendaftaran." };
}
async function ekspor() {
  if (sibuk.value) return;
  sibuk.value = true;
  const versi = generasi;
  try {
    const res = await store.simpan("laporan/ekspor", periode(), kunci.value);
    if (!res || versi !== generasi) return;
    kunci.value = crypto.randomUUID();
    const url = URL.createObjectURL(new Blob([JSON.stringify(res.payload, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "laporan-nicu.json"; a.click(); URL.revokeObjectURL(url);
  } finally { if (versi === generasi) sibuk.value = false; }
}
watch([() => route.fullPath, () => auth.getFaskesUuid], () => {
  ++generasi;
  baris.value = []; ringkasan.value = []; sumber.value = []; unit.value = []; konfigurasi.value = [];
  detail.value = null; dokumen.value = []; histori.value = []; revisi.value = []; relasi.value = null;
  pilihan.value = null; dokumenKoreksi.value = null; isian.value = {}; tempatPilihan.value = [];
  transaksi.value = [];
  serahTerima.value = ""; verifikasi.value = false; alasan.value = ""; pengesahan.value = "";
  perpindahanUuid.value = ""; tempatTujuanUuid.value = ""; konfigurasiUuid.value = "";
  nomorHalaman.value = 1; unitFilter.value = ""; kunci.value = crypto.randomUUID();
  muat();
}, { immediate: true });
onBeforeUnmount(() => {
  ++generasi;
  detail.value = null; baris.value = []; dokumen.value = []; histori.value = []; revisi.value = [];
  relasi.value = null; pilihan.value = null; isian.value = {}; serahTerima.value = "";
});
</script>

<template>
  <section class="p-4 space-y-4 bg-white rounded-lg">
    <h1 class="text-xl font-semibold">{{ judul }}</h1>
    <p v-if="!modul.aktif('nicu') || !izin(submodul[halaman] || 'Episode')">Akses NICU tidak tersedia.</p>
    <template v-else>
      <div class="flex flex-wrap items-end gap-3">
        <label v-if="pilihanUnit.length">Unit<select v-model="unitFilter" class="block p-2 border rounded"><option value="">Semua unit</option><option v-for="u in pilihanUnit" :key="u.uuid" :value="u.uuid">{{ u.nama }}</option></select></label>
        <template v-if="['dashboard', 'laporan'].includes(halaman)">
          <label>Dari<input v-model="dari" type="date" class="block p-2 border rounded" /></label>
          <label>Sampai<input v-model="sampai" type="date" class="block p-2 border rounded" /></label>
        </template>
        <button :disabled="sibuk" class="p-2 border rounded" @click="nomorHalaman = 1; muat()">Muat ulang</button>
      </div>
      <p role="status">{{ sibuk ? 'Memuat data…' : pesan }}</p>

      <template v-if="halaman === 'dashboard' && fitur('nicu_dashboard')">
        <div v-for="r in ringkasan" :key="r.unitUuid" class="p-3 border rounded">
          Kapasitas {{ r.kapasitas }} · Alat siap {{ r.alatSiap }} · Terisi {{ r.terisi }} · Masuk {{ r.masuk }} · Pindah {{ r.pindah }} · Transfer {{ r.transfer }} · Pulang {{ r.pulang }}
        </div>
      </template>
      <template v-if="['dashboard', 'tempat'].includes(halaman)">
        <table class="w-full text-left"><thead><tr><th>Tempat</th><th>Jenis</th><th>Status alat</th><th>Hunian</th></tr></thead>
          <tbody><tr v-for="p in baris" :key="p.uuid" class="border-b">
            <td class="p-2">{{ p.kode }} · {{ p.lokasi }}</td><td>{{ p.jenis }}</td><td>{{ p.statusAlat }}</td>
            <td><RouterLink v-if="p.episodeUuid && izin('Episode')" :to="`/nicu/episode/${p.episodeUuid}`">Episode aktif</RouterLink><span v-else>{{ p.pasienSumberUuid ? 'Terisi pada rawat inap' : 'Kosong' }}</span></td>
            <td v-if="halaman === 'tempat' && izin('Tempat', 'KELOLA') && fitur('nicu_penempatan')">
              <select :value="p.statusAlat" :disabled="sibuk" aria-label="Ubah status alat" @change="simpan(`tempat/${p.uuid}/status-alat`, { versi: p.versi, statusAlat: ($event.target as HTMLSelectElement).value })">
                <option v-for="s in ['siap', 'pembersihan', 'pemeliharaan', 'rusak']" :key="s">{{ s }}</option>
              </select>
            </td>
          </tr></tbody>
        </table>
        <form v-if="halaman === 'tempat' && izin('Tempat', 'KELOLA') && fitur('nicu_penempatan')" class="flex flex-wrap gap-3" @submit.prevent="tambahTempat">
          <label>Tempat rawat inap<select v-model="sumberUuid" required class="block p-2 border"><option value="">Pilih tempat</option><option v-for="s in sumber" :key="s.uuid" :value="s.uuid">{{ s.kode }} · {{ s.lokasi }}</option></select></label>
          <label>Jenis<select v-model="jenisTempat" class="block p-2 border"><option>inkubator</option><option>bed</option></select></label>
          <label>Status alat<select v-model="statusAlat" class="block p-2 border"><option v-for="s in ['siap', 'pembersihan', 'pemeliharaan', 'rusak']" :key="s">{{ s }}</option></select></label>
          <button :disabled="sibuk" class="p-2 border rounded">Daftarkan tempat</button>
        </form>
      </template>

      <template v-if="halaman === 'penerimaan' && fitur('nicu_penerimaan')">
        <p>Pilih bayi dari transaksi perpindahan rawat inap yang telah berlaku. Identitas bayi tetap terpisah dari ibu.</p>
        <RouterLink to="/rawat-inap/perpindahan-bangsal">Buka alur perpindahan rawat inap</RouterLink>
        <div v-for="p in baris" :key="p.perpindahanMasukUuid" class="p-3 border rounded">
          {{ p.namaPasien }} · RM {{ p.noRm }} · {{ p.kode }}
          <button v-if="izin('Penerimaan', 'TERIMA')" class="ml-3 underline" @click="pilihan = p; verifikasi = false">Verifikasi penerimaan</button>
        </div>
        <form v-if="pilihan && izin('Penerimaan', 'TERIMA')" class="p-3 space-y-3 border rounded" @submit.prevent="terima">
          <p class="font-semibold">{{ pilihan.namaPasien }} · RM {{ pilihan.noRm }} · {{ pilihan.kode }}</p>
          <label class="block"><input v-model="verifikasi" required type="checkbox" /> Identitas bayi telah dicocokkan dengan sumber serah terima.</label>
          <label class="block">Serah terima masuk<textarea v-model="serahTerima" required maxlength="5000" class="block w-full p-2 border" /></label>
          <button :disabled="sibuk" class="p-2 border rounded">Terima bayi ke NICU</button>
        </form>
      </template>

      <template v-if="halaman === 'episode' && !route.params.uuid">
        <div v-for="e in baris" :key="e.uuid" class="p-3 border rounded"><RouterLink :to="`/nicu/episode/${e.uuid}`">{{ e.namaPasien }} · RM {{ e.noRm }} · {{ e.status }} · {{ formatWaktu(e.masukAt) }}</RouterLink></div>
      </template>
      <template v-if="detail">
        <div class="sticky top-0 p-3 font-semibold bg-white border rounded">{{ detail.pasien.nama }} · RM {{ detail.pasien.noRm }} · {{ detail.episode.status }}</div>
        <button v-if="izin('Identitas')" class="underline" @click="lihatRelasi">Lihat relasi dari registrasi bayi</button>
        <p v-if="relasi">Ibu pada registrasi: {{ relasi.nameMom }} <span v-if="relasi.multipleBirth">· Kelahiran kembar</span></p>
        <p>Serah terima masuk: {{ detail.episode.serahTerimaMasuk }}</p>
        <p v-if="detail.episode.serahTerimaKeluar">Serah terima keluar: {{ detail.episode.serahTerimaKeluar }}</p>
        <div v-if="izin('Penempatan')"><h2 class="font-semibold">Riwayat penempatan</h2><p v-for="h in histori" :key="h.uuid">{{ h.kode }} · {{ formatWaktu(h.mulaiAt) }} – {{ formatWaktu(h.selesaiAt) }} · Pencatat {{ h.pencatat }}</p></div>
        <div v-if="fitur('nicu_integrasi_order')" class="flex flex-wrap gap-3">
          <RouterLink v-if="hasPermission('Rawat Inap') && modul.aktif('rawat_inap')" to="/rawat-inap/ruangan">Pelayanan rawat inap dan rekam medis</RouterLink>
          <RouterLink v-if="hasPermission('Laboratorium') && modul.aktif('laboratorium')" to="/laboratorium/order-lab">Order dan hasil laboratorium</RouterLink>
          <RouterLink v-if="hasPermission('Radiologi') && modul.aktif('radiologi')" to="/radiologi/order">Order dan hasil radiologi</RouterLink>
          <RouterLink v-if="hasPermission('Farmasi') && modul.aktif('farmasi')" to="/farmasi">Pelayanan farmasi</RouterLink>
          <p class="w-full">Pilih rekam bayi yang sama pada modul sumber. Order, hasil, dan tagihan mengikuti modul pemilik layanan.</p>
        </div>
        <div v-if="izin('Dokumentasi') && fitur('nicu_dokumentasi')" class="space-y-3">
          <h2 class="font-semibold">Dokumentasi neonatal</h2>
          <article v-for="d in dokumen" :key="d.uuid" class="p-3 border rounded">
            <p>{{ d.jenis }} · {{ formatWaktu(d.waktuPencatatan) }} · Pencatat {{ d.pencatat }} · Versi {{ d.versi }}</p>
            <dl v-for="f in d.definisi.fields" :key="f.kode" class="flex gap-3"><dt>{{ f.nama }}</dt><dd>{{ d.isi[camel(f.kode)] ?? '—' }} {{ f.satuan }}</dd></dl>
            <button v-if="izin('Dokumentasi', 'KOREKSI') && detail.episode.status === 'aktif'" class="mr-3 underline" @click="koreksi(d)">Koreksi</button>
            <button v-if="izin('Dokumentasi', 'RIWAYAT')" class="underline" @click="lihatRevisi(d)">Riwayat koreksi</button>
          </article>
          <article v-for="r in revisi" :key="r.uuid" class="p-3 border"><p>Revisi {{ r.nomorRevisi }} · {{ r.alasan }} · {{ r.pencatat }} · {{ formatWaktu(r.createdAt) }}</p><p>Sebelum: {{ r.sebelum }}</p><p>Sesudah: {{ r.sesudah }}</p></article>
        </div>
        <form v-if="detail.episode.status === 'aktif' && fitur('nicu_dokumentasi') && (izin('Dokumentasi', 'CREATE') || dokumenKoreksi && izin('Dokumentasi', 'KOREKSI'))" class="p-3 space-y-3 border rounded" @submit.prevent="simpanDokumen">
          <h2>{{ dokumenKoreksi ? 'Koreksi dokumentasi' : 'Tambah dokumentasi' }}</h2>
          <label>Formulir terbit<select v-model="konfigurasiUuid" :disabled="!!dokumenKoreksi" required class="block p-2 border" @change="isian = {}"><option value="">Pilih formulir</option><option v-for="k in konfigurasi" :key="k.uuid" :value="k.uuid">{{ k.jenis }} · {{ formatWaktu(k.createdAt) }}</option></select></label>
          <p v-if="!konfigurasi.length">Belum ada formulir terbit yang dapat diakses. Hubungi pengelola konfigurasi.</p>
          <label v-if="!dokumenKoreksi">Waktu pencatatan<input v-model="waktuCatat" required type="datetime-local" class="block p-2 border" /></label>
          <label v-for="f in configAktif?.definisi.fields ?? []" :key="f.kode" class="block">{{ f.nama }} ({{ f.satuan || 'tanpa satuan' }})<input v-model="isian[camel(f.kode)]" :type="f.tipe === 'angka' ? 'number' : 'text'" step="any" :required="f.wajib" class="block p-2 border" /></label>
          <label v-if="dokumenKoreksi">Alasan koreksi<textarea v-model="alasan" required maxlength="5000" class="block w-full border" /></label>
          <button :disabled="sibuk || !configAktif" class="p-2 border rounded">Simpan dokumentasi</button>
          <button v-if="dokumenKoreksi" type="button" class="ml-3 underline" @click="dokumenKoreksi = null; isian = {}">Batal koreksi</button>
        </form>
        <template v-if="detail.episode.status === 'aktif'">
          <RouterLink to="/rawat-inap/perpindahan-bangsal">Proses perpindahan melalui rawat inap terlebih dahulu</RouterLink>
          <label class="block">Transaksi perpindahan rawat inap<select v-model="perpindahanUuid" class="block w-full p-2 border" @change="tempatTujuanUuid = transaksi.find(t => t.uuid === perpindahanUuid)?.tempatTujuanUuid || ''"><option value="">Pemulangan melalui rekam medis</option><option v-for="t in transaksi" :key="t.uuid" :value="t.uuid">Tujuan {{ t.kodeTujuan }} · {{ formatWaktu(t.waktuPindah) }}</option></select></label>
          <form v-if="izin('Penempatan', 'PINDAH') && fitur('nicu_penempatan')" class="flex flex-wrap gap-3" @submit.prevent="simpan(`episode/${route.params.uuid}/penempatan`, { versi: detail.episode.versi, perpindahanUuid, tempatTujuanUuid })">
            <label>Tujuan NICU<select v-model="tempatTujuanUuid" required class="block p-2 border"><option value="">Pilih tempat</option><option v-for="p in tempatPilihan.filter(p => p.statusAlat === 'siap' && !p.episodeUuid)" :key="p.uuid" :value="p.uuid">{{ p.kode }} · {{ p.lokasi }}</option></select></label>
            <button :disabled="sibuk || !perpindahanUuid" class="p-2 border rounded">Catat perpindahan tempat</button>
          </form>
          <form v-if="izin('Penyelesaian', 'SELESAIKAN') && fitur('nicu_penyelesaian')" class="space-y-3" @submit.prevent="simpan(`episode/${route.params.uuid}/penyelesaian`, { versi: detail.episode.versi, ...(perpindahanUuid ? { perpindahanKeluarUuid: perpindahanUuid } : {}), serahTerima })">
            <p>Untuk pemulangan, pilih pemulangan melalui rekam medis dan selesaikan prosesnya di rekam medis terlebih dahulu.</p>
            <label>Serah terima keluar<textarea v-model="serahTerima" required maxlength="5000" class="block w-full p-2 border" /></label>
            <button :disabled="sibuk" class="p-2 border rounded">Selesaikan episode NICU</button>
          </form>
        </template>
      </template>

      <template v-if="halaman === 'konfigurasi' && fitur('nicu_konfigurasi')">
        <p>Field, satuan, serta kewajiban pengisian ditetapkan pemilik proses klinis. Formulir terbit dipertahankan sebagai versi tetap.</p>
        <label v-if="izin('Konfigurasi', 'TERBITKAN')">Referensi pengesahan<textarea v-model="pengesahan" class="block w-full p-2 border" /></label>
        <div v-for="k in baris" :key="k.uuid" class="p-3 border rounded"><p>{{ k.jenis }} · {{ k.status }} · {{ formatWaktu(k.createdAt) }}</p><p v-for="f in k.definisi.fields" :key="f.kode">{{ f.nama }} · {{ f.tipe }} · {{ f.satuan }} · {{ f.wajib ? 'Wajib' : 'Opsional' }}</p>
          <button v-if="k.status === 'draf' && izin('Konfigurasi', 'TERBITKAN')" :disabled="sibuk || !pengesahan.trim()" class="underline" @click="simpan(`konfigurasi/${k.uuid}/penerbitan`, { versi: k.versi, referensiPengesahan: pengesahan })">Terbitkan dengan referensi pengesahan</button>
        </div>
        <form v-if="izin('Konfigurasi', 'KELOLA')" class="space-y-3" @submit.prevent="tambahKonfigurasi">
          <label>Unit<select v-model="unitUuid" required class="block p-2 border"><option value="">Pilih unit</option><option v-for="u in unit" :key="u.uuid" :value="u.uuid">{{ u.nama }}</option></select></label>
          <label>Jenis formulir<select v-model="jenisForm" class="block p-2 border"><option v-for="j in ['neonatal', 'asesmen', 'observasi', 'keperawatan', 'perkembangan', 'tindakan', 'terapi', 'rencana']" :key="j">{{ j }}</option></select></label>
          <div v-for="(f, i) in fields" :key="i" class="flex flex-wrap gap-2">
            <label>Kode field<input v-model="f.kode" required pattern="[a-z][a-z0-9_]{0,49}" class="block p-2 border" /></label>
            <label>Nama<input v-model="f.nama" required class="block p-2 border" /></label>
            <label>Tipe<select v-model="f.tipe" class="block p-2 border"><option>angka</option><option>teks</option></select></label>
            <label>Satuan<input v-model="f.satuan" class="block p-2 border" /></label>
            <label><input v-model="f.wajib" type="checkbox" /> Wajib</label>
            <button type="button" @click="fields.splice(i, 1)">Hapus field draf</button>
          </div>
          <button type="button" class="mr-3 underline" @click="fields.push({ kode: '', nama: '', tipe: 'angka', satuan: '', wajib: false })">Tambah field</button>
          <button :disabled="sibuk || !fields.length" class="p-2 border rounded">Simpan draf baru</button>
        </form>
      </template>

      <template v-if="halaman === 'laporan' && fitur('nicu_laporan')">
        <p>Kapasitas dan hunian adalah kondisi saat laporan dibuka; pergerakan dihitung dalam periode pilihan.</p>
        <table class="w-full text-left"><thead><tr><th>Unit</th><th>Kapasitas</th><th>Siap</th><th>Terisi</th><th>Masuk</th><th>Pindah</th><th>Transfer</th><th>Pulang</th></tr></thead><tbody><tr v-for="r in baris" :key="r.unitUuid"><td>{{ r.namaUnit }}</td><td>{{ r.kapasitas }}</td><td>{{ r.alatSiap }}</td><td>{{ r.terisi }}</td><td>{{ r.masuk }}</td><td>{{ r.pindah }}</td><td>{{ r.transfer }}</td><td>{{ r.pulang }}</td></tr></tbody></table>
        <button v-if="izin('Laporan', 'EKSPOR')" :disabled="sibuk" class="p-2 border rounded" @click="ekspor">Ekspor halaman laporan (JSON)</button>
      </template>
      <div class="flex gap-3"><button :disabled="sibuk || nomorHalaman === 1" @click="nomorHalaman--; muat()">Sebelumnya</button><span>Halaman {{ nomorHalaman }} · Maksimal 50 baris</span><button :disabled="sibuk" @click="nomorHalaman++; muat()">Berikutnya</button></div>
    </template>
  </section>
</template>
