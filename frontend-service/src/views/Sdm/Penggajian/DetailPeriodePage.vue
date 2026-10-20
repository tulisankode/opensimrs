<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import FormulirData, { type KolomGaji } from "./FormulirData.vue";
import KonfirmasiGaji from "./KonfirmasiGaji.vue";
import { bacaGaji, simpanGaji, izinGaji, nominalGaji, statusGaji, periodeGaji, kelasLencanaGaji, labelGaji, waktuGaji, tanggalGaji, masaGaji, jsonGaji, JENIS_KOMPONEN } from "@/stores/penunjang/penggajian";

// Rincian periode penggajian (STD-0041): ringkasan, alur hitung → ajukan → verifikasi → persetujuan → pembayaran → jurnal,
// hasil per pegawai beserta sumber komponennya, koreksi atas periode terkunci sebelumnya, slip administratif, dan riwayat.
const route = useRoute(), router = useRouter();
const data = ref<any>(null), hasil = ref<any[]>([]), riwayat = ref<any[]>([]), page = ref(1), total = ref(0), sibuk = ref(false), memuat = ref(false);
const uuid = computed(() => String(route.params.uuid));
const slipAdmin = ref<any>(null), rincianHasil = ref<any>(null), tampilBaca = ref(false);
const bukaSlip = async (pegawaiUuid: string) => { slipAdmin.value = (await bacaGaji(`/periode/${uuid.value}/slip/${pegawaiUuid}`))?.payload ?? null; };

interface Tindakan { aksi: string; label: string; sub: string; hak: string; status: string; ikon: string; pesan: string; alasan?: boolean; berisiko?: boolean }
const DAFTAR_TINDAKAN: Tindakan[] = [
  { aksi: "hitung", label: "Hitung ulang", sub: "periode", hak: "HITUNG", status: "draf", ikon: "PhCalculator", pesan: "Hasil dihitung ulang dari konfigurasi, penetapan komponen, profil, koreksi, dan jasa pelayanan terkini. Versi periode akan bertambah." },
  { aksi: "ajukan", label: "Ajukan verifikasi", sub: "periode", hak: "AJUKAN", status: "draf", ikon: "PhPaperPlaneTilt", pesan: "Periode diajukan ke verifikator. Pastikan tidak ada pengecualian dan hasil sudah dihitung dari sumber terbaru." },
  { aksi: "verifikasi", label: "Luluskan verifikasi", sub: "verifikasi", hak: "VALIDASI", status: "verifikasi", ikon: "PhCheckCircle", pesan: "Hasil periode dinyatakan sesuai dan diteruskan untuk persetujuan. Verifikator harus berbeda dari penghitung." },
  { aksi: "kembalikan", label: "Kembalikan ke draf", sub: "verifikasi", hak: "KEMBALIKAN", status: "verifikasi", ikon: "PhArrowCounterClockwise", pesan: "Periode dikembalikan ke draf untuk diperbaiki.", alasan: true, berisiko: true },
  { aksi: "setujui", label: "Catat persetujuan", sub: "persetujuan", hak: "SETUJUI", status: "menunggu_persetujuan", ikon: "PhSealCheck", pesan: "Persetujuan mengunci hasil periode. Setelah dikunci, perubahan hanya dapat dicatat sebagai koreksi pada periode berikutnya." },
  { aksi: "tolak", label: "Tolak dan koreksi", sub: "persetujuan", hak: "TOLAK", status: "menunggu_persetujuan", ikon: "PhXCircle", pesan: "Periode ditolak dan kembali ke draf untuk dikoreksi.", alasan: true, berisiko: true },
  { aksi: "batalkan", label: "Batalkan draf", sub: "periode", hak: "BATALKAN", status: "draf", ikon: "PhTrash", pesan: "Draf periode dihapus dan reservasi jasa pelayanan dilepas. Tindakan ini tidak dapat dibatalkan.", alasan: true, berisiko: true },
  { aksi: "jurnal/ulang", label: "Ulangi jurnal", sub: "pembayaran", hak: "ULANG JURNAL", status: "dibayar", ikon: "PhArrowsClockwise", pesan: "Sistem mencoba lagi mencatat jurnal pembayaran gaji ke Akuntansi." },
];
const tindakan = computed(() => DAFTAR_TINDAKAN.filter((a) => a.status === data.value?.status && izinGaji(a.sub, a.hak)));
const tindakanAktif = ref<Tindakan | null>(null), dialogTindakan = ref(false);
const bukaTindakan = (a: Tindakan) => { tindakanAktif.value = a; dialogTindakan.value = true; };

const muat = async () => {
  memuat.value = true;
  try {
    data.value = (await bacaGaji(`/periode/${uuid.value}`))?.payload ?? null;
    if (!data.value) return;
    const r = await bacaGaji(`/periode/${uuid.value}/hasil`, { page: page.value });
    hasil.value = r?.payload?.data ?? []; total.value = r?.payload?.pagination?.total ?? 0;
    riwayat.value = (await bacaGaji(`/periode/${uuid.value}/riwayat`, { limit: 200 }))?.payload?.data ?? [];
    if (data.value.status === "draf" && izinGaji("periode", "KOREKSI")) muatPilihanKoreksi();
  } finally { memuat.value = false; }
};
const gantiHalaman = (e: { page: number }) => { page.value = e.page + 1; muat(); };
const jalankan = async ({ alasan }: { alasan: string }) => {
  const a = tindakanAktif.value;
  if (sibuk.value || !a) return;
  sibuk.value = true;
  try {
    const r = await simpanGaji(`/periode/${uuid.value}/${a.aksi}`, { versi: data.value.versi, hashHitung: data.value.hashHitung, alasan: a.alasan ? alasan : undefined });
    if (!r) return;
    dialogTindakan.value = false;
    if (a.aksi === "batalkan") { await router.push("/sdm/penggajian/periode"); return; }
    await muat();
  } finally { sibuk.value = false; }
};

// ── Pembayaran: versi diambil dari periode yang sedang dibuka (bukan diketik).
const kolomBayar: KolomGaji[] = [
  { nama: "tanggalBayar", label: "Tanggal pembayaran", jenis: "tanggal", bantuan: "Tidak boleh sebelum awal bulan periode atau sesudah hari ini." },
  { nama: "metodeBayar", label: "Metode pembayaran", pilihan: [{ value: "TRANSFER", label: "Transfer bank" }] },
  { nama: "referensiBayar", label: "Referensi pembayaran", maks: 255, lebar: true, contoh: "mis. nomor batch transfer bank" },
];

// ── Koreksi: hasil terkunci dari periode bulan sebelumnya dan komponen dipilih dari daftar.
const hasilAsal = ref<any[]>([]), komponen = ref<any[]>([]), periodeAsal = ref<any>(null);
const muatPilihanKoreksi = async () => {
  const d = data.value, tahun = d.bulan === 1 ? d.tahun - 1 : d.tahun, bulan = d.bulan === 1 ? 12 : d.bulan - 1;
  const daftar = (await bacaGaji("/periode", { tahun, bulan, limit: 200 }))?.payload?.data ?? [];
  periodeAsal.value = daftar.find((p: any) => p.terkunciPada) ?? null;
  hasilAsal.value = periodeAsal.value ? (await bacaGaji(`/periode/${periodeAsal.value.uuid}/hasil`, { limit: 200 }))?.payload?.data ?? [] : [];
  if (izinGaji("komponen")) komponen.value = (await bacaGaji("/komponen", { limit: 200 }))?.payload?.data ?? [];
};
// Komponen yang dapat dikoreksi = komponen pada rincian hasil terkunci (komponen_uuid); nama dilengkapi dari daftar
// Komponen bila pengguna berizin membacanya.
const komponenKoreksi = computed(() => {
  const nama = new Map(komponen.value.map((k) => [k.uuid, k]));
  const unik = new Map<string, any>();
  for (const h of hasilAsal.value) for (const r of h.rincian ?? []) if (r.komponenUuid && !unik.has(r.komponenUuid)) unik.set(r.komponenUuid, r);
  return [...unik.values()].map((r) => {
    const k = nama.get(r.komponenUuid);
    return { value: r.komponenUuid, label: `${r.kode}${k ? ` — ${k.nama}` : ""} (${JENIS_KOMPONEN[r.jenis] ?? r.jenis})` };
  });
});
const kolomKoreksi = computed<KolomGaji[]>(() => [
  { nama: "hasilAsalUuid", label: `Pegawai pada hasil terkunci ${periodeAsal.value ? periodeGaji(periodeAsal.value.tahun, periodeAsal.value.bulan) : "bulan sebelumnya"}`, lebar: true,
    pilihan: hasilAsal.value.map((h) => ({ value: h.uuid, label: `${h.nama || "Pegawai tanpa nama"} · ${h.unit || "Tanpa unit"} · bersih ${nominalGaji(h.bersih)}` })),
    bantuan: periodeAsal.value ? undefined : "Tidak ditemukan periode bulan sebelumnya yang sudah terkunci; koreksi belum dapat dicatat." },
  { nama: "komponenUuid", label: "Komponen koreksi", lebar: true, pilihan: komponenKoreksi.value,
    bantuan: komponenKoreksi.value.length ? undefined : "Hasil terkunci bulan sebelumnya belum memuat komponen yang dapat dikoreksi." },
  { nama: "nilai", label: "Nominal koreksi (bertanda)", jenis: "nominal", contoh: "mis. -150000.00 atau 250000.00", bantuan: "Gunakan tanda minus untuk mengurangi. Tidak boleh nol." },
  { nama: "alasan", label: "Alasan koreksi", jenis: "area", maks: 1000 },
]);

const SUMBER: Record<string, string> = { hr_gaji_komponen_pegawai: "Penetapan komponen", hr_gaji_koreksi: "Koreksi periode sebelumnya", remunerasi_rincian: "Jasa pelayanan (Remunerasi)", hr_gaji_konfigurasi: "Aturan konfigurasi" };
const AKSI: Record<string, string> = { buat_periode: "Periode dibuka", hitung_periode: "Dihitung", ajukan: "Diajukan verifikasi", verifikasi: "Verifikasi lulus", kembalikan: "Dikembalikan ke draf",
  setujui: "Disetujui dan dikunci", tolak: "Ditolak", bayar_periode: "Pembayaran dicatat", kirim_jurnal: "Pencatatan jurnal", koreksi_periode: "Koreksi dicatat", batalkan_periode: "Draf dibatalkan",
  ekspor_bank: "Ekspor bank dibuat", baca_penggajian: "Data dibaca", akses_ditolak: "Akses ditolak" };
const riwayatTampil = computed(() => riwayat.value.filter((r) => tampilBaca.value || r.aksi !== "baca_penggajian"));
const bolehSlip = computed(() => data.value?.status === "dibayar" && data.value?.jurnal?.status === "tercatat" && izinGaji("administratif"));
onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" :disabled="memuat" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Rincian Periode Penggajian</h1>
          <CustomButton icon="PhArrowLeft" label="Kembali" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="router.push('/sdm/penggajian/periode')" />
          <template v-if="data">
            <CustomButton
              v-for="a in tindakan"
              :key="a.aksi"
              :label="a.label"
              :icon="a.ikon"
              :disabled="sibuk"
              :outlined="a.berisiko"
              :borderColor="a.berisiko ? 'border-danger-300' : undefined"
              :textColor="a.berisiko ? 'text-danger-300' : undefined"
              @click="bukaTindakan(a)"
            />
            <CustomButton v-if="data.terkunciPada && (izinGaji('rekap') || izinGaji('ekspor', 'EKSPOR'))" label="Rekap & ekspor" icon="PhTable" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="router.push({ path: '/sdm/penggajian/rekap', query: { periode: uuid } })" />
            <FormulirData v-if="data.status === 'disetujui'" :key="`bayar-${data.versi}`" judul="Catat Pembayaran Gaji" label-tombol="Catat pembayaran" ikon="PhMoney" :path="`/periode/${uuid}/bayar`" :boleh="izinGaji('pembayaran', 'BAYAR')"
              :kolom="kolomBayar" :tambahan="{ versi: data.versi }" keterangan="Catat setelah transfer benar-benar dilakukan. Sistem tidak mengirim perintah pembayaran ke bank; jurnal pembayaran dicatat otomatis ke Akuntansi." @tersimpan="muat" />
            <FormulirData v-if="data.status === 'draf'" :key="`koreksi-${data.versi}`" judul="Koreksi Hasil Periode Sebelumnya" label-tombol="Catat koreksi" ikon="PhPencilSimpleLine" garis :path="`/periode/${uuid}/koreksi`" :boleh="izinGaji('periode', 'KOREKSI')"
              :kolom="kolomKoreksi" :tambahan="{ versi: data.versi }" keterangan="Koreksi hanya untuk hasil terkunci bulan tepat sebelum periode ini. Setelah dicatat, hitung ulang periode." @tersimpan="muat" />
          </template>
        </PageToolbar>
      </template>

      <template #content>
        <NoData v-if="!data" :title="memuat ? 'Memuat periode…' : 'Periode tidak ditemukan'" class="min-h-[240px]" />
        <div v-else class="flex flex-col gap-4 pt-4 text-sm">
          <div class="p-4 border rounded-lg border-grey-75">
            <div class="flex flex-wrap items-center gap-2 mb-3">
              <h2 class="text-base font-semibold">{{ periodeGaji(data.tahun, data.bulan) }}</h2>
              <span :class="kelasLencanaGaji(data.status)">{{ statusGaji[data.status] ?? data.status }}</span>
              <span class="text-xs text-grey-400">versi {{ data.versi }}</span>
            </div>
            <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div class="p-3 rounded-lg bg-grey-50"><div class="text-xs text-grey-400">Bruto</div><div class="font-semibold">{{ nominalGaji(data.bruto) }}</div></div>
              <div class="p-3 rounded-lg bg-grey-50"><div class="text-xs text-grey-400">Potongan</div><div class="font-semibold">{{ nominalGaji(data.potongan) }}</div></div>
              <div class="p-3 rounded-lg bg-grey-50"><div class="text-xs text-grey-400">Iuran pemberi kerja</div><div class="font-semibold">{{ nominalGaji(data.iuranPemberiKerja) }}</div></div>
              <div class="p-3 rounded-lg bg-opensimrs-50"><div class="text-xs text-grey-400">Bersih</div><div class="font-semibold text-opensimrs-300">{{ nominalGaji(data.bersih) }}</div></div>
            </div>
            <div class="grid grid-cols-1 mt-3 gap-x-6 gap-y-1 md:grid-cols-2">
              <div><span class="text-grey-400">Pegawai:</span> {{ data.jumlahPegawai ?? 0 }} · <span :class="data.jumlahPengecualian > 0 ? 'font-semibold text-danger-400' : ''">{{ data.jumlahPengecualian ?? 0 }} pengecualian</span></div>
              <div v-if="data.ringkasan?.kehadiran"><span class="text-grey-400">Kehadiran:</span> {{ data.ringkasan.kehadiran.alasan }}</div>
              <div v-if="data.terkunciPada"><span class="text-grey-400">Dikunci:</span> {{ waktuGaji(data.terkunciPada) }}</div>
              <div v-if="data.tanggalBayar"><span class="text-grey-400">Dibayar:</span> {{ tanggalGaji(data.tanggalBayar) }} · {{ data.metodeBayar === "TRANSFER" ? "Transfer bank" : data.metodeBayar }} · {{ data.referensiBayar }}</div>
            </div>
            <div v-if="data.jurnal" class="flex flex-wrap items-center gap-2 mt-3" role="status">
              <span class="text-grey-400">Jurnal pembayaran:</span>
              <span :class="kelasLencanaGaji(data.jurnal.status)">{{ labelGaji(data.jurnal.status) }}</span>
              <span v-if="data.jurnal.percobaan" class="text-xs text-grey-400">{{ data.jurnal.percobaan }} kali percobaan</span>
              <span v-if="data.jurnal.alasan" class="text-xs text-danger-400">{{ data.jurnal.alasan }}</span>
            </div>
            <p v-if="data.status === 'dibayar' && data.jurnal?.status !== 'tercatat'" class="px-3 py-2 mt-3 text-xs rounded-lg bg-warning-50 text-warning-400">Pembayaran tercatat. Slip resmi menunggu jurnal berhasil dicatat.</p>
            <details v-if="data.konfigurasi" class="mt-3">
              <summary class="font-semibold cursor-pointer text-opensimrs-300">Konfigurasi versi {{ data.konfigurasi.versi }} yang digunakan · {{ masaGaji(data.konfigurasi) }}</summary>
              <div class="mt-2 text-xs"><span class="text-grey-400">Sumber ketentuan:</span> {{ data.konfigurasi.dasarAturan }}</div>
              <pre class="p-3 mt-2 overflow-auto text-xs whitespace-pre-wrap rounded-lg bg-grey-50 max-h-80">{{ jsonGaji({ kebijakan: data.konfigurasi.kebijakan, aturan: data.konfigurasi.aturan }) }}</pre>
            </details>
          </div>

          <h3 class="font-semibold">Hasil per pegawai</h3>
          <NoData v-if="!hasil.length" title="Belum ada hasil penghitungan" class="min-h-[200px]" />
          <DataTable v-else :value="hasil" stripedRows class="text-xs" scrollable tableStyle="min-width: 64rem">
            <Column header="Pegawai" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><span class="font-semibold">{{ r.nama || "Pegawai tanpa nama" }}</span><div class="text-grey-400">{{ r.unit || "Tanpa unit" }}</div></template></Column>
            <Column header="Kelengkapan" headerClass="bg-opensimrs-50">
              <template #body="{ data: r }"><span :class="kelasLencanaGaji(r.statusKelengkapan)">{{ labelGaji(r.statusKelengkapan) }}</span><div v-if="r.alasan" class="mt-1 text-danger-400">{{ r.alasan }}</div></template>
            </Column>
            <Column header="Bruto" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ nominalGaji(r.bruto) }}</template></Column>
            <Column header="Potongan" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ nominalGaji(r.potongan) }}</template></Column>
            <Column header="Iuran pemberi kerja" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ nominalGaji(r.iuranPemberiKerja) }}</template></Column>
            <Column header="Bersih" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><span class="font-semibold">{{ nominalGaji(r.bersih) }}</span></template></Column>
            <Column header="Aksi" headerClass="bg-opensimrs-50">
              <template #body="{ data: r }">
                <div class="flex flex-wrap gap-2">
                  <CustomButton label="Rincian" icon="PhListBullets" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="rincianHasil = r" />
                  <CustomButton v-if="bolehSlip" label="Slip" icon="PhReceipt" size="small" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaSlip(r.kepegawaianUuid)" />
                </div>
              </template>
            </Column>
          </DataTable>

          <details class="p-4 border rounded-lg border-grey-75">
            <summary class="font-semibold cursor-pointer">Riwayat tindakan ({{ riwayatTampil.length }})</summary>
            <label class="flex items-center gap-2 mt-3 text-xs"><input v-model="tampilBaca" type="checkbox" class="w-4 h-4 accent-opensimrs-300" />Tampilkan juga catatan pembacaan data</label>
            <NoData v-if="!riwayatTampil.length" title="Belum ada riwayat" class="min-h-[120px]" />
            <DataTable v-else :value="riwayatTampil" stripedRows class="mt-3 text-xs" scrollable tableStyle="min-width: 40rem">
              <Column header="Waktu" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ waktuGaji(r.waktu) }}</template></Column>
              <Column field="pengguna" header="Pengguna" headerClass="bg-opensimrs-50" />
              <Column header="Tindakan" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ AKSI[r.aksi] ?? labelGaji(r.aksi) }}</template></Column>
              <Column header="Alasan" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ r.alasan || "-" }}</template></Column>
            </DataTable>
          </details>
        </div>
      </template>

      <template v-if="data && hasil.length" #footer>
        <div class="flex justify-end px-5 py-2.5">
          <CustomPaginator :totalRecords="total" :rows="20" :rowsPerPageOptions="[20]" @page="gantiHalaman" />
        </div>
      </template>
    </Card>

    <KonfirmasiGaji
      v-model:visible="dialogTindakan"
      :judul="tindakanAktif?.label ?? ''"
      :pesan="tindakanAktif?.pesan"
      :labelSetuju="tindakanAktif?.label"
      :berisiko="tindakanAktif?.berisiko"
      :sibuk="sibuk"
      :alasan="tindakanAktif?.alasan ? { label: 'Alasan tindakan', wajib: true } : undefined"
      @setuju="jalankan"
    >
      <p v-if="data" class="px-3 py-2 text-xs rounded-lg bg-grey-50">Periode {{ periodeGaji(data.tahun, data.bulan) }} · versi {{ data.versi }} · bersih {{ nominalGaji(data.bersih) }}</p>
    </KonfirmasiGaji>

    <CustomDialog :visible="!!rincianHasil" width="760px" @update:visible="(v: boolean) => { if (!v) rincianHasil = null; }">
      <template #header>Rincian Komponen · {{ rincianHasil?.nama || "Pegawai" }}</template>
      <template #body>
        <div v-if="rincianHasil" class="pt-4">
          <NoData v-if="!rincianHasil.rincian?.length" title="Tidak ada rincian komponen" class="min-h-[120px]" />
          <DataTable v-else :value="rincianHasil.rincian" stripedRows class="text-xs" scrollable>
            <Column header="Komponen" headerClass="bg-opensimrs-50"><template #body="{ data: c }"><span class="font-semibold">{{ c.kode }}</span></template></Column>
            <Column header="Jenis" headerClass="bg-opensimrs-50"><template #body="{ data: c }">{{ JENIS_KOMPONEN[c.jenis] ?? c.jenis }}</template></Column>
            <Column header="Nominal" headerClass="bg-opensimrs-50"><template #body="{ data: c }">{{ nominalGaji(c.nilai) }}</template></Column>
            <Column header="Sumber" headerClass="bg-opensimrs-50"><template #body="{ data: c }">{{ SUMBER[c.sumberTabel] ?? c.sumberTabel }}</template></Column>
          </DataTable>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end"><CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="rincianHasil = null" /></div>
      </template>
    </CustomDialog>

    <CustomDialog :visible="!!slipAdmin" width="640px" @update:visible="(v: boolean) => { if (!v) slipAdmin = null; }">
      <template #header>Slip Administratif · {{ slipAdmin?.nama || "Pegawai" }}</template>
      <template #body>
        <div v-if="slipAdmin" class="flex flex-col gap-3 pt-4 text-sm">
          <p>{{ periodeGaji(slipAdmin.tahun, slipAdmin.bulan) }} · {{ slipAdmin.unit || "Tanpa unit" }} · dibayar {{ tanggalGaji(slipAdmin.tanggalBayar) }}</p>
          <DataTable :value="slipAdmin.rincian" stripedRows class="text-xs">
            <Column header="Komponen" headerClass="bg-opensimrs-50"><template #body="{ data: c }">{{ c.kode }}</template></Column>
            <Column header="Jenis" headerClass="bg-opensimrs-50"><template #body="{ data: c }">{{ JENIS_KOMPONEN[c.jenis] ?? c.jenis }}</template></Column>
            <Column header="Nominal" headerClass="bg-opensimrs-50"><template #body="{ data: c }">{{ nominalGaji(c.nilai) }}</template></Column>
          </DataTable>
          <div class="flex justify-between font-semibold"><span>Bersih</span><span>{{ nominalGaji(slipAdmin.bersih) }}</span></div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end"><CustomButton label="Tutup slip" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="slipAdmin = null" /></div>
      </template>
    </CustomDialog>
  </div>
</template>
