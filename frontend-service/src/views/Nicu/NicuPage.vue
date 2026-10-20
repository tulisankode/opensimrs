<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useNicuStore } from "@/stores/rawatInap/nicu";
import { useAuthStore } from "@/stores/auth";
import { useModulFaskesStore } from "@/stores/modulFaskes";
import { hasPermission } from "@/utils/permissions";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import NoData from "@/components/section/NoData.vue";

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
// Pembantu tampilan: filter toolbar memakai komponen bersama (Date & null), state tetap string agar periode() tidak berubah.
const daftarStatusAlat = ["siap", "pembersihan", "pemeliharaan", "rusak"];
const daftarJenisForm = ["neonatal", "asesmen", "observasi", "keperawatan", "perkembangan", "tindakan", "terapi", "rencana"];
const tanggalLokal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dariTanggal = computed({ get: () => new Date(`${dari.value}T00:00:00`), set: (d: Date | null) => { if (d) dari.value = tanggalLokal(d); } });
const sampaiTanggal = computed({ get: () => new Date(`${sampai.value}T00:00:00`), set: (d: Date | null) => { if (d) sampai.value = tanggalLokal(d); } });
const unitPilih = computed({ get: () => unitFilter.value || null, set: (v: string | null) => { unitFilter.value = v ?? ""; } });
const aksesAda = computed(() => modul.aktif("nicu") && izin(submodul[halaman.value] || "Episode"));
const warnaLencana: Record<string, string> = {
  siap: "bg-success-50 text-success-400", aktif: "bg-success-50 text-success-400", terbit: "bg-success-50 text-success-400",
  pembersihan: "bg-info-50 text-info-400", pemeliharaan: "bg-warning-50 text-warning-400", draf: "bg-warning-50 text-warning-400",
  rusak: "bg-danger-50 text-danger-400",
};
const lencana = (status: string) => warnaLencana[status] ?? "bg-grey-50 text-grey-500";
const ringkasanAngka = (r: any) => [["Kapasitas", r.kapasitas], ["Alat siap", r.alatSiap], ["Terisi", r.terisi], ["Masuk", r.masuk], ["Pindah", r.pindah], ["Transfer", r.transfer], ["Pulang", r.pulang]];
const bukaPerpindahan = () => router.push("/rawat-inap/perpindahan-bangsal");
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
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" :disabled="sibuk" @click="nomorHalaman = 1; muat()" />
          <h1 class="toolbar-heading text-opensimrs-300">{{ judul }}</h1>
          <template v-if="aksesAda">
            <CustomSelect
              v-if="pilihanUnit.length"
              v-model="unitPilih"
              label="Unit"
              placeHolder="Semua unit"
              :options="pilihanUnit"
              optionLabel="nama"
              optionValue="uuid"
            />
            <template v-if="['dashboard', 'laporan'].includes(halaman)">
              <CustomDatePicker v-model="dariTanggal" label="Dari" />
              <CustomDatePicker v-model="sampaiTanggal" label="Sampai" />
            </template>
            <CustomButton
              v-if="halaman === 'laporan' && fitur('nicu_laporan') && izin('Laporan', 'EKSPOR')"
              label="Ekspor JSON"
              icon="PhDownloadSimple"
              :disabled="sibuk"
              @click="ekspor"
            />
          </template>
        </PageToolbar>
      </template>

      <template #content>
        <div v-if="!aksesAda" class="h-full p-4">
          <NoData title="Akses NICU tidak tersedia." />
        </div>
        <div v-else class="flex flex-col gap-4 p-4">
          <p
            role="status"
            :class="sibuk || pesan ? 'px-3 py-2 text-sm rounded-lg bg-opensimrs-50 text-opensimrs-300' : 'sr-only'"
          >{{ sibuk ? "Memuat data…" : pesan }}</p>

          <!-- Dasbor: ringkasan per unit -->
          <div v-if="halaman === 'dashboard' && fitur('nicu_dashboard') && ringkasan.length" class="flex flex-col gap-3">
            <div v-for="r in ringkasan" :key="r.unitUuid" class="p-4 border rounded-lg border-grey-75">
              <div class="mb-3 font-semibold">{{ r.namaUnit || "Unit NICU" }}</div>
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
                <div v-for="[label, nilai] in ringkasanAngka(r)" :key="label" class="p-3 text-center rounded-lg bg-grey-50">
                  <div class="text-2xl font-semibold">{{ nilai ?? 0 }}</div>
                  <div class="text-xs text-grey-400">{{ label }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Dasbor & Tempat: daftar tempat dan status alat -->
          <template v-if="['dashboard', 'tempat'].includes(halaman)">
            <div class="p-4 border rounded-lg border-grey-75">
              <div class="mb-3 font-semibold">Tempat NICU</div>
              <div v-if="!baris.length" class="h-48"><NoData title="Belum ada tempat NICU terdaftar." /></div>
              <DataTable v-else :value="baris" dataKey="uuid" class="text-sm" stripedRows>
                <Column header="Tempat" headerClass="bg-opensimrs-50">
                  <template #body="{ data: p }">
                    <div class="font-semibold">{{ p.kode }}</div>
                    <div class="text-xs text-grey-400">{{ p.lokasi }}</div>
                  </template>
                </Column>
                <Column header="Jenis" headerClass="bg-opensimrs-50">
                  <template #body="{ data: p }"><span class="capitalize">{{ p.jenis }}</span></template>
                </Column>
                <Column header="Status alat" headerClass="bg-opensimrs-50">
                  <template #body="{ data: p }">
                    <span class="px-2 py-0.5 text-xs font-semibold rounded-full capitalize" :class="lencana(p.statusAlat)">{{ p.statusAlat }}</span>
                  </template>
                </Column>
                <Column header="Hunian" headerClass="bg-opensimrs-50">
                  <template #body="{ data: p }">
                    <RouterLink
                      v-if="p.episodeUuid && izin('Episode')"
                      :to="`/nicu/episode/${p.episodeUuid}`"
                      class="font-semibold text-opensimrs-300 hover:underline"
                    >Episode aktif</RouterLink>
                    <span v-else class="text-grey-500">{{ p.pasienSumberUuid ? "Terisi pada rawat inap" : "Kosong" }}</span>
                  </template>
                </Column>
                <Column
                  v-if="halaman === 'tempat' && izin('Tempat', 'KELOLA') && fitur('nicu_penempatan')"
                  header="Ubah status alat"
                  headerClass="bg-opensimrs-50"
                >
                  <template #body="{ data: p }">
                    <select
                      :value="p.statusAlat"
                      :disabled="sibuk"
                      aria-label="Ubah status alat"
                      class="h-8 px-2 capitalize bg-white border rounded-lg border-grey-200 text-SM disabled:bg-grey-100"
                      @change="simpan(`tempat/${p.uuid}/status-alat`, { versi: p.versi, statusAlat: ($event.target as HTMLSelectElement).value })"
                    >
                      <option v-for="s in daftarStatusAlat" :key="s">{{ s }}</option>
                    </select>
                  </template>
                </Column>
              </DataTable>
            </div>

            <form
              v-if="halaman === 'tempat' && izin('Tempat', 'KELOLA') && fitur('nicu_penempatan')"
              class="p-4 border rounded-lg border-grey-75"
              @submit.prevent="tambahTempat"
            >
              <div class="mb-3 font-semibold">Daftarkan tempat NICU</div>
              <div class="grid items-end grid-cols-1 gap-3 md:grid-cols-4">
                <label class="flex flex-col">
                  <span class="block font-semibold mb-[5px] text-normal">Tempat rawat inap<span class="text-danger-300">*</span></span>
                  <select v-model="sumberUuid" required class="w-full h-10 px-3 bg-white border rounded-lg border-grey-200 text-SM">
                    <option value="">Pilih tempat</option>
                    <option v-for="s in sumber" :key="s.uuid" :value="s.uuid">{{ s.kode }} · {{ s.lokasi }}</option>
                  </select>
                </label>
                <label class="flex flex-col">
                  <span class="block font-semibold mb-[5px] text-normal">Jenis</span>
                  <select v-model="jenisTempat" class="w-full h-10 px-3 capitalize bg-white border rounded-lg border-grey-200 text-SM">
                    <option>inkubator</option>
                    <option>bed</option>
                  </select>
                </label>
                <label class="flex flex-col">
                  <span class="block font-semibold mb-[5px] text-normal">Status alat</span>
                  <select v-model="statusAlat" class="w-full h-10 px-3 capitalize bg-white border rounded-lg border-grey-200 text-SM">
                    <option v-for="s in daftarStatusAlat" :key="s">{{ s }}</option>
                  </select>
                </label>
                <CustomButton type="submit" label="Daftarkan tempat" icon="PhPlus" :disabled="sibuk" />
              </div>
            </form>
          </template>

          <!-- Penerimaan bayi -->
          <template v-if="halaman === 'penerimaan' && fitur('nicu_penerimaan')">
            <div class="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg bg-grey-50">
              <p class="text-sm text-grey-500">
                Pilih bayi dari transaksi perpindahan rawat inap yang telah berlaku. Identitas bayi tetap terpisah dari ibu.
              </p>
              <CustomButton
                label="Buka alur perpindahan rawat inap"
                icon="PhArrowsLeftRight"
                outlined
                textColor="text-opensimrs-300"
                borderColor="border-opensimrs-300"
                @click="bukaPerpindahan"
              />
            </div>
            <div class="p-4 border rounded-lg border-grey-75">
              <div class="mb-3 font-semibold">Bayi menunggu penerimaan</div>
              <div v-if="!baris.length" class="h-48"><NoData title="Belum ada bayi yang menunggu penerimaan." /></div>
              <DataTable v-else :value="baris" dataKey="perpindahanMasukUuid" class="text-sm" stripedRows>
                <Column header="Nama bayi" headerClass="bg-opensimrs-50">
                  <template #body="{ data: p }"><span class="font-semibold">{{ p.namaPasien }}</span></template>
                </Column>
                <Column field="noRm" header="No. RM" headerClass="bg-opensimrs-50" />
                <Column field="kode" header="Tempat tujuan" headerClass="bg-opensimrs-50" />
                <Column v-if="izin('Penerimaan', 'TERIMA')" header="Aksi" headerClass="bg-opensimrs-50">
                  <template #body="{ data: p }">
                    <CustomButton label="Verifikasi penerimaan" icon="PhCheckCircle" size="small" @click="pilihan = p; verifikasi = false" />
                  </template>
                </Column>
              </DataTable>
            </div>

            <form
              v-if="pilihan && izin('Penerimaan', 'TERIMA')"
              class="flex flex-col gap-3 p-4 border rounded-lg border-opensimrs-300"
              @submit.prevent="terima"
            >
              <div>
                <div class="font-semibold">Verifikasi penerimaan bayi</div>
                <div class="text-sm text-grey-500">{{ pilihan.namaPasien }} · RM {{ pilihan.noRm }} · {{ pilihan.kode }}</div>
              </div>
              <label class="flex items-center gap-2 text-sm">
                <input v-model="verifikasi" required type="checkbox" class="w-4 h-4 accent-opensimrs-300" />
                Identitas bayi telah dicocokkan dengan sumber serah terima.
              </label>
              <label class="flex flex-col">
                <span class="block font-semibold mb-[5px] text-normal">Serah terima masuk<span class="text-danger-300">*</span></span>
                <textarea v-model="serahTerima" required maxlength="5000" rows="4" class="w-full p-3 bg-white border rounded-lg border-grey-200 text-SM" />
              </label>
              <div class="flex justify-end gap-2">
                <CustomButton
                  label="Batal"
                  outlined
                  textColor="text-grey-500"
                  borderColor="border-grey-200"
                  @click="pilihan = null"
                />
                <CustomButton type="submit" label="Terima bayi ke NICU" icon="PhCheck" :disabled="sibuk" />
              </div>
            </form>
          </template>

          <!-- Daftar episode -->
          <div v-if="halaman === 'episode' && !route.params.uuid" class="p-4 border rounded-lg border-grey-75">
            <div class="mb-3 font-semibold">Episode NICU</div>
            <div v-if="!baris.length" class="h-48"><NoData title="Belum ada episode NICU." /></div>
            <DataTable v-else :value="baris" dataKey="uuid" class="text-sm" stripedRows>
              <Column header="Nama bayi" headerClass="bg-opensimrs-50">
                <template #body="{ data: e }"><span class="font-semibold">{{ e.namaPasien }}</span></template>
              </Column>
              <Column field="noRm" header="No. RM" headerClass="bg-opensimrs-50" />
              <Column header="Status" headerClass="bg-opensimrs-50">
                <template #body="{ data: e }">
                  <span class="px-2 py-0.5 text-xs font-semibold rounded-full capitalize" :class="lencana(e.status)">{{ e.status }}</span>
                </template>
              </Column>
              <Column header="Masuk" headerClass="bg-opensimrs-50">
                <template #body="{ data: e }">{{ formatWaktu(e.masukAt) }}</template>
              </Column>
              <Column header="Aksi" headerClass="bg-opensimrs-50">
                <template #body="{ data: e }">
                  <CustomButton label="Buka" icon="PhEye" size="small" @click="router.push(`/nicu/episode/${e.uuid}`)" />
                </template>
              </Column>
            </DataTable>
          </div>

          <!-- Detail episode -->
          <template v-if="detail">
            <div class="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 p-4 bg-white border rounded-lg border-grey-75">
              <div>
                <div class="font-semibold">{{ detail.pasien.nama }}</div>
                <div class="text-xs text-grey-400">RM {{ detail.pasien.noRm }}</div>
              </div>
              <span class="px-2 py-0.5 text-xs font-semibold rounded-full capitalize" :class="lencana(detail.episode.status)">{{ detail.episode.status }}</span>
            </div>

            <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div class="flex flex-col gap-3 p-4 border rounded-lg border-grey-75">
                <div class="font-semibold">Serah terima</div>
                <div>
                  <div class="text-xs text-grey-400">Serah terima masuk</div>
                  <div class="text-sm whitespace-pre-line">{{ detail.episode.serahTerimaMasuk || "—" }}</div>
                </div>
                <div v-if="detail.episode.serahTerimaKeluar">
                  <div class="text-xs text-grey-400">Serah terima keluar</div>
                  <div class="text-sm whitespace-pre-line">{{ detail.episode.serahTerimaKeluar }}</div>
                </div>
                <div v-if="izin('Identitas')" class="flex flex-col gap-2 pt-3 border-t border-grey-75">
                  <div>
                    <CustomButton
                      label="Lihat relasi dari registrasi bayi"
                      icon="PhUsers"
                      size="small"
                      outlined
                      textColor="text-opensimrs-300"
                      borderColor="border-opensimrs-300"
                      @click="lihatRelasi"
                    />
                  </div>
                  <p v-if="relasi" class="text-sm">
                    Ibu pada registrasi: <span class="font-semibold">{{ relasi.nameMom }}</span>
                    <span v-if="relasi.multipleBirth" class="ml-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-info-50 text-info-400">Kelahiran kembar</span>
                  </p>
                </div>
              </div>

              <div v-if="izin('Penempatan')" class="p-4 border rounded-lg border-grey-75">
                <div class="mb-3 font-semibold">Riwayat penempatan</div>
                <div v-if="!histori.length" class="text-sm text-grey-400">Belum ada riwayat penempatan.</div>
                <DataTable v-else :value="histori" dataKey="uuid" class="text-sm" stripedRows>
                  <Column field="kode" header="Tempat" headerClass="bg-opensimrs-50" />
                  <Column header="Mulai" headerClass="bg-opensimrs-50">
                    <template #body="{ data: h }">{{ formatWaktu(h.mulaiAt) }}</template>
                  </Column>
                  <Column header="Selesai" headerClass="bg-opensimrs-50">
                    <template #body="{ data: h }">{{ formatWaktu(h.selesaiAt) }}</template>
                  </Column>
                  <Column field="pencatat" header="Pencatat" headerClass="bg-opensimrs-50" />
                </DataTable>
              </div>
            </div>

            <div v-if="fitur('nicu_integrasi_order')" class="p-4 border rounded-lg border-grey-75">
              <div class="mb-3 font-semibold">Layanan terkait</div>
              <div class="flex flex-wrap gap-2">
                <RouterLink
                  v-if="hasPermission('Rawat Inap') && modul.aktif('rawat_inap')"
                  to="/rawat-inap/ruangan"
                  class="px-3 py-2 text-sm font-semibold border rounded-lg border-opensimrs-300 text-opensimrs-300 hover:bg-opensimrs-50"
                >Pelayanan rawat inap dan rekam medis</RouterLink>
                <RouterLink
                  v-if="hasPermission('Laboratorium') && modul.aktif('laboratorium')"
                  to="/laboratorium/order-lab"
                  class="px-3 py-2 text-sm font-semibold border rounded-lg border-opensimrs-300 text-opensimrs-300 hover:bg-opensimrs-50"
                >Order dan hasil laboratorium</RouterLink>
                <RouterLink
                  v-if="hasPermission('Radiologi') && modul.aktif('radiologi')"
                  to="/radiologi/order"
                  class="px-3 py-2 text-sm font-semibold border rounded-lg border-opensimrs-300 text-opensimrs-300 hover:bg-opensimrs-50"
                >Order dan hasil radiologi</RouterLink>
                <RouterLink
                  v-if="hasPermission('Farmasi') && modul.aktif('farmasi')"
                  to="/farmasi"
                  class="px-3 py-2 text-sm font-semibold border rounded-lg border-opensimrs-300 text-opensimrs-300 hover:bg-opensimrs-50"
                >Pelayanan farmasi</RouterLink>
              </div>
              <p class="mt-3 text-xs text-grey-400">Pilih rekam bayi yang sama pada modul sumber. Order, hasil, dan tagihan mengikuti modul pemilik layanan.</p>
            </div>

            <div v-if="izin('Dokumentasi') && fitur('nicu_dokumentasi')" class="flex flex-col gap-3 p-4 border rounded-lg border-grey-75">
              <div class="font-semibold">Dokumentasi neonatal</div>
              <div v-if="!dokumen.length" class="text-sm text-grey-400">Belum ada dokumentasi.</div>
              <article v-for="d in dokumen" :key="d.uuid" class="p-3 border rounded-lg border-grey-75">
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div class="font-semibold capitalize">{{ d.jenis }}</div>
                    <div class="text-xs text-grey-400">{{ formatWaktu(d.waktuPencatatan) }} · Pencatat {{ d.pencatat }} · Versi {{ d.versi }}</div>
                  </div>
                  <div class="flex gap-2">
                    <CustomButton
                      v-if="izin('Dokumentasi', 'KOREKSI') && detail.episode.status === 'aktif'"
                      label="Koreksi"
                      icon="PhPencilSimple"
                      size="small"
                      outlined
                      textColor="text-opensimrs-300"
                      borderColor="border-opensimrs-300"
                      @click="koreksi(d)"
                    />
                    <CustomButton
                      v-if="izin('Dokumentasi', 'RIWAYAT')"
                      label="Riwayat koreksi"
                      icon="PhClockCounterClockwise"
                      size="small"
                      outlined
                      textColor="text-grey-500"
                      borderColor="border-grey-200"
                      @click="lihatRevisi(d)"
                    />
                  </div>
                </div>
                <dl class="grid grid-cols-1 mt-3 text-sm gap-x-4 gap-y-1 sm:grid-cols-2">
                  <div v-for="f in d.definisi.fields" :key="f.kode" class="flex justify-between gap-3 py-1 border-b border-grey-75">
                    <dt class="text-grey-500">{{ f.nama }}</dt>
                    <dd class="font-semibold">{{ d.isi[camel(f.kode)] ?? "—" }} {{ f.satuan }}</dd>
                  </div>
                </dl>
              </article>
              <div v-if="revisi.length" class="flex flex-col gap-2">
                <div class="text-sm font-semibold">Riwayat koreksi</div>
                <article v-for="r in revisi" :key="r.uuid" class="p-3 text-sm rounded-lg bg-grey-50">
                  <div class="font-semibold">Revisi {{ r.nomorRevisi }} · {{ r.alasan }}</div>
                  <div class="text-xs text-grey-400">{{ r.pencatat }} · {{ formatWaktu(r.createdAt) }}</div>
                  <div class="mt-2 text-xs break-all"><span class="font-semibold">Sebelum:</span> {{ r.sebelum }}</div>
                  <div class="text-xs break-all"><span class="font-semibold">Sesudah:</span> {{ r.sesudah }}</div>
                </article>
              </div>
            </div>

            <form
              v-if="detail.episode.status === 'aktif' && fitur('nicu_dokumentasi') && (izin('Dokumentasi', 'CREATE') || dokumenKoreksi && izin('Dokumentasi', 'KOREKSI'))"
              class="flex flex-col gap-3 p-4 border rounded-lg"
              :class="dokumenKoreksi ? 'border-warning-300' : 'border-grey-75'"
              @submit.prevent="simpanDokumen"
            >
              <div class="font-semibold">{{ dokumenKoreksi ? "Koreksi dokumentasi" : "Tambah dokumentasi" }}</div>
              <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label class="flex flex-col">
                  <span class="block font-semibold mb-[5px] text-normal">Formulir terbit<span class="text-danger-300">*</span></span>
                  <select
                    v-model="konfigurasiUuid"
                    :disabled="!!dokumenKoreksi"
                    required
                    class="w-full h-10 px-3 bg-white border rounded-lg border-grey-200 text-SM disabled:bg-grey-100 disabled:text-grey-300"
                    @change="isian = {}"
                  >
                    <option value="">Pilih formulir</option>
                    <option v-for="k in konfigurasi" :key="k.uuid" :value="k.uuid">{{ k.jenis }} · {{ formatWaktu(k.createdAt) }}</option>
                  </select>
                </label>
                <label v-if="!dokumenKoreksi" class="flex flex-col">
                  <span class="block font-semibold mb-[5px] text-normal">Waktu pencatatan<span class="text-danger-300">*</span></span>
                  <input v-model="waktuCatat" required type="datetime-local" class="w-full h-10 px-3 bg-white border rounded-lg border-grey-200 text-SM" />
                </label>
              </div>
              <p v-if="!konfigurasi.length" class="px-3 py-2 text-sm rounded-lg bg-warning-50 text-warning-400">
                Belum ada formulir terbit yang dapat diakses. Hubungi pengelola konfigurasi.
              </p>
              <div v-if="configAktif?.definisi.fields?.length" class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <label v-for="f in configAktif?.definisi.fields ?? []" :key="f.kode" class="flex flex-col">
                  <span class="block font-semibold mb-[5px] text-normal">
                    {{ f.nama }} <span class="font-normal text-grey-400">({{ f.satuan || "tanpa satuan" }})</span><span v-if="f.wajib" class="text-danger-300">*</span>
                  </span>
                  <input
                    v-model="isian[camel(f.kode)]"
                    :type="f.tipe === 'angka' ? 'number' : 'text'"
                    step="any"
                    :required="f.wajib"
                    class="w-full h-10 px-3 bg-white border rounded-lg border-grey-200 text-SM"
                  />
                </label>
              </div>
              <label v-if="dokumenKoreksi" class="flex flex-col">
                <span class="block font-semibold mb-[5px] text-normal">Alasan koreksi<span class="text-danger-300">*</span></span>
                <textarea v-model="alasan" required maxlength="5000" rows="3" class="w-full p-3 bg-white border rounded-lg border-grey-200 text-SM" />
              </label>
              <div class="flex justify-end gap-2">
                <CustomButton
                  v-if="dokumenKoreksi"
                  label="Batal koreksi"
                  outlined
                  textColor="text-grey-500"
                  borderColor="border-grey-200"
                  @click="dokumenKoreksi = null; isian = {}"
                />
                <CustomButton type="submit" label="Simpan dokumentasi" icon="PhFloppyDisk" :disabled="sibuk || !configAktif" />
              </div>
            </form>

            <div v-if="detail.episode.status === 'aktif'" class="flex flex-col gap-4 p-4 border rounded-lg border-grey-75">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="font-semibold">Perpindahan dan penyelesaian episode</div>
                <CustomButton
                  label="Proses perpindahan melalui rawat inap terlebih dahulu"
                  icon="PhArrowsLeftRight"
                  size="small"
                  outlined
                  textColor="text-opensimrs-300"
                  borderColor="border-opensimrs-300"
                  @click="bukaPerpindahan"
                />
              </div>
              <label class="flex flex-col">
                <span class="block font-semibold mb-[5px] text-normal">Transaksi perpindahan rawat inap</span>
                <select
                  v-model="perpindahanUuid"
                  class="w-full h-10 px-3 bg-white border rounded-lg border-grey-200 text-SM"
                  @change="tempatTujuanUuid = transaksi.find(t => t.uuid === perpindahanUuid)?.tempatTujuanUuid || ''"
                >
                  <option value="">Pemulangan melalui rekam medis</option>
                  <option v-for="t in transaksi" :key="t.uuid" :value="t.uuid">Tujuan {{ t.kodeTujuan }} · {{ formatWaktu(t.waktuPindah) }}</option>
                </select>
              </label>
              <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <form
                  v-if="izin('Penempatan', 'PINDAH') && fitur('nicu_penempatan')"
                  class="flex flex-col gap-3 p-3 rounded-lg bg-grey-50"
                  @submit.prevent="simpan(`episode/${route.params.uuid}/penempatan`, { versi: detail.episode.versi, perpindahanUuid, tempatTujuanUuid })"
                >
                  <div class="text-sm font-semibold">Perpindahan tempat di NICU</div>
                  <label class="flex flex-col">
                    <span class="block font-semibold mb-[5px] text-normal">Tujuan NICU<span class="text-danger-300">*</span></span>
                    <select v-model="tempatTujuanUuid" required class="w-full h-10 px-3 bg-white border rounded-lg border-grey-200 text-SM">
                      <option value="">Pilih tempat</option>
                      <option v-for="p in tempatPilihan.filter(p => p.statusAlat === 'siap' && !p.episodeUuid)" :key="p.uuid" :value="p.uuid">{{ p.kode }} · {{ p.lokasi }}</option>
                    </select>
                  </label>
                  <div class="flex justify-end">
                    <CustomButton type="submit" label="Catat perpindahan tempat" icon="PhArrowsLeftRight" :disabled="sibuk || !perpindahanUuid" />
                  </div>
                </form>
                <form
                  v-if="izin('Penyelesaian', 'SELESAIKAN') && fitur('nicu_penyelesaian')"
                  class="flex flex-col gap-3 p-3 rounded-lg bg-grey-50"
                  @submit.prevent="simpan(`episode/${route.params.uuid}/penyelesaian`, { versi: detail.episode.versi, ...(perpindahanUuid ? { perpindahanKeluarUuid: perpindahanUuid } : {}), serahTerima })"
                >
                  <div class="text-sm font-semibold">Penyelesaian episode</div>
                  <p class="text-xs text-grey-500">
                    Untuk pemulangan, pilih pemulangan melalui rekam medis dan selesaikan prosesnya di rekam medis terlebih dahulu.
                  </p>
                  <label class="flex flex-col">
                    <span class="block font-semibold mb-[5px] text-normal">Serah terima keluar<span class="text-danger-300">*</span></span>
                    <textarea v-model="serahTerima" required maxlength="5000" rows="3" class="w-full p-3 bg-white border rounded-lg border-grey-200 text-SM" />
                  </label>
                  <div class="flex justify-end">
                    <CustomButton
                      type="submit"
                      label="Selesaikan episode NICU"
                      icon="PhCheckCircle"
                      backgroundColor="bg-danger-300"
                      :disabled="sibuk"
                    />
                  </div>
                </form>
              </div>
            </div>
          </template>

          <!-- Konfigurasi formulir -->
          <template v-if="halaman === 'konfigurasi' && fitur('nicu_konfigurasi')">
            <p class="p-4 text-sm rounded-lg bg-grey-50 text-grey-500">
              Field, satuan, serta kewajiban pengisian ditetapkan pemilik proses klinis. Formulir terbit dipertahankan sebagai versi tetap.
            </p>
            <label v-if="izin('Konfigurasi', 'TERBITKAN')" class="flex flex-col">
              <span class="block font-semibold mb-[5px] text-normal">Referensi pengesahan</span>
              <textarea
                v-model="pengesahan"
                rows="2"
                placeholder="Nomor/tanggal dokumen pengesahan, wajib diisi sebelum menerbitkan formulir draf"
                class="w-full p-3 bg-white border rounded-lg border-grey-200 text-SM"
              />
            </label>
            <div class="p-4 border rounded-lg border-grey-75">
              <div class="mb-3 font-semibold">Daftar formulir</div>
              <div v-if="!baris.length" class="h-48"><NoData title="Belum ada konfigurasi formulir." /></div>
              <div v-else class="flex flex-col gap-3">
                <article v-for="k in baris" :key="k.uuid" class="p-3 border rounded-lg border-grey-75">
                  <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div class="flex items-center gap-2">
                      <span class="font-semibold capitalize">{{ k.jenis }}</span>
                      <span class="px-2 py-0.5 text-xs font-semibold rounded-full capitalize" :class="lencana(k.status)">{{ k.status }}</span>
                      <span class="text-xs text-grey-400">{{ formatWaktu(k.createdAt) }}</span>
                    </div>
                    <CustomButton
                      v-if="k.status === 'draf' && izin('Konfigurasi', 'TERBITKAN')"
                      label="Terbitkan dengan referensi pengesahan"
                      icon="PhSealCheck"
                      size="small"
                      :disabled="sibuk || !pengesahan.trim()"
                      @click="simpan(`konfigurasi/${k.uuid}/penerbitan`, { versi: k.versi, referensiPengesahan: pengesahan })"
                    />
                  </div>
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="text-left bg-opensimrs-50">
                        <th class="px-2 py-1">Nama</th>
                        <th class="px-2 py-1">Tipe</th>
                        <th class="px-2 py-1">Satuan</th>
                        <th class="px-2 py-1">Kewajiban</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="f in k.definisi.fields" :key="f.kode" class="border-b border-grey-75">
                        <td class="px-2 py-1">{{ f.nama }}</td>
                        <td class="px-2 py-1 capitalize">{{ f.tipe }}</td>
                        <td class="px-2 py-1">{{ f.satuan || "—" }}</td>
                        <td class="px-2 py-1">{{ f.wajib ? "Wajib" : "Opsional" }}</td>
                      </tr>
                    </tbody>
                  </table>
                </article>
              </div>
            </div>

            <form v-if="izin('Konfigurasi', 'KELOLA')" class="flex flex-col gap-3 p-4 border rounded-lg border-grey-75" @submit.prevent="tambahKonfigurasi">
              <div class="font-semibold">Draf formulir baru</div>
              <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label class="flex flex-col">
                  <span class="block font-semibold mb-[5px] text-normal">Unit<span class="text-danger-300">*</span></span>
                  <select v-model="unitUuid" required class="w-full h-10 px-3 bg-white border rounded-lg border-grey-200 text-SM">
                    <option value="">Pilih unit</option>
                    <option v-for="u in unit" :key="u.uuid" :value="u.uuid">{{ u.nama }}</option>
                  </select>
                </label>
                <label class="flex flex-col">
                  <span class="block font-semibold mb-[5px] text-normal">Jenis formulir</span>
                  <select v-model="jenisForm" class="w-full h-10 px-3 capitalize bg-white border rounded-lg border-grey-200 text-SM">
                    <option v-for="j in daftarJenisForm" :key="j">{{ j }}</option>
                  </select>
                </label>
              </div>
              <div v-if="!fields.length" class="text-sm text-grey-400">Belum ada field. Tambahkan minimal satu field.</div>
              <div
                v-for="(f, i) in fields"
                :key="i"
                class="grid items-end grid-cols-1 gap-3 p-3 rounded-lg bg-grey-50 md:grid-cols-[1fr_1.5fr_8rem_1fr_auto_auto]"
              >
                <label class="flex flex-col">
                  <span class="block font-semibold mb-[5px] text-normal">Kode field<span class="text-danger-300">*</span></span>
                  <input v-model="f.kode" required pattern="[a-z][a-z0-9_]{0,49}" class="w-full h-10 px-3 bg-white border rounded-lg border-grey-200 text-SM" />
                </label>
                <label class="flex flex-col">
                  <span class="block font-semibold mb-[5px] text-normal">Nama<span class="text-danger-300">*</span></span>
                  <input v-model="f.nama" required class="w-full h-10 px-3 bg-white border rounded-lg border-grey-200 text-SM" />
                </label>
                <label class="flex flex-col">
                  <span class="block font-semibold mb-[5px] text-normal">Tipe</span>
                  <select v-model="f.tipe" class="w-full h-10 px-3 capitalize bg-white border rounded-lg border-grey-200 text-SM">
                    <option>angka</option>
                    <option>teks</option>
                  </select>
                </label>
                <label class="flex flex-col">
                  <span class="block font-semibold mb-[5px] text-normal">Satuan</span>
                  <input v-model="f.satuan" class="w-full h-10 px-3 bg-white border rounded-lg border-grey-200 text-SM" />
                </label>
                <label class="flex items-center h-10 gap-2 text-sm">
                  <input v-model="f.wajib" type="checkbox" class="w-4 h-4 accent-opensimrs-300" /> Wajib
                </label>
                <CustomButton
                  icon="PhTrash"
                  backgroundColor="bg-danger-300"
                  aria-label="Hapus field draf"
                  title="Hapus field draf"
                  @click="fields.splice(i, 1)"
                />
              </div>
              <div class="flex flex-wrap justify-between gap-2">
                <CustomButton
                  label="Tambah field"
                  icon="PhPlus"
                  outlined
                  textColor="text-opensimrs-300"
                  borderColor="border-opensimrs-300"
                  @click="fields.push({ kode: '', nama: '', tipe: 'angka', satuan: '', wajib: false })"
                />
                <CustomButton type="submit" label="Simpan draf baru" icon="PhFloppyDisk" :disabled="sibuk || !fields.length" />
              </div>
            </form>
          </template>

          <!-- Laporan operasional -->
          <template v-if="halaman === 'laporan' && fitur('nicu_laporan')">
            <p class="p-4 text-sm rounded-lg bg-grey-50 text-grey-500">
              Kapasitas dan hunian adalah kondisi saat laporan dibuka; pergerakan dihitung dalam periode pilihan.
            </p>
            <div class="p-4 border rounded-lg border-grey-75">
              <div class="mb-3 font-semibold">Ringkasan per unit</div>
              <div v-if="!baris.length" class="h-48"><NoData title="Belum ada data laporan pada periode ini." /></div>
              <DataTable v-else :value="baris" dataKey="unitUuid" class="text-sm" stripedRows>
                <Column field="namaUnit" header="Unit" headerClass="bg-opensimrs-50" />
                <Column field="kapasitas" header="Kapasitas" headerClass="bg-opensimrs-50" />
                <Column field="alatSiap" header="Siap" headerClass="bg-opensimrs-50" />
                <Column field="terisi" header="Terisi" headerClass="bg-opensimrs-50" />
                <Column field="masuk" header="Masuk" headerClass="bg-opensimrs-50" />
                <Column field="pindah" header="Pindah" headerClass="bg-opensimrs-50" />
                <Column field="transfer" header="Transfer" headerClass="bg-opensimrs-50" />
                <Column field="pulang" header="Pulang" headerClass="bg-opensimrs-50" />
              </DataTable>
            </div>
          </template>

          <!-- Paginasi sederhana (backend membatasi 50 baris per halaman) -->
          <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-grey-75">
            <span class="text-sm text-grey-400">Halaman {{ nomorHalaman }} · maksimal 50 baris per halaman</span>
            <div class="flex gap-2">
              <CustomButton
                label="Sebelumnya"
                icon="PhCaretLeft"
                outlined
                textColor="text-opensimrs-300"
                borderColor="border-opensimrs-300"
                :disabled="sibuk || nomorHalaman === 1"
                @click="nomorHalaman--; muat()"
              />
              <CustomButton
                label="Berikutnya"
                icon="PhCaretRight"
                iconPos="right"
                outlined
                textColor="text-opensimrs-300"
                borderColor="border-opensimrs-300"
                :disabled="sibuk"
                @click="nomorHalaman++; muat()"
              />
            </div>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
