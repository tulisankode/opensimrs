<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  OPSI_KATEGORI,
  buatBatchLaundry,
  buatPenerimaanLaundry,
  daftarBatchLaundry,
  daftarDistribusiLaundry,
  daftarPenerimaanLaundry,
  daftarPermintaanLaundry,
  gayaKategori,
  gayaSiklusUnit,
  gayaStatusUnit,
  izinLaundry,
  kirimDistribusiLaundry,
  konfirmasiDistribusiLaundry,
  konfirmasiPenerimaanLaundry,
  pindaiUnitLaundry,
  posisiUnit,
  referensiUnitLaundry,
  ubahTahapLaundry,
  unitDokumenLaundry,
  waktuLaundry,
} from "@/stores/penunjang/laundry";

// Pemindaian unit linen (STD-0030) di setiap titik alur: serah terima kotor, diterima laundry, masuk batch, selesai
// cuci, distribusi, dan diterima ruangan. Kode masuk dari scanner USB (keyboard wedge: ketik + Enter pada kolom yang
// selalu fokus) atau kamera peramban (BarcodeDetector, bila didukung). Daftar hasil pindai ditinjau dulu; kode ganda
// tidak dihitung dua kali, unit yang tidak sesuai tahap ditandai ditolak. Penyimpanan memakai endpoint alur yang sama
// dengan pencatatan jumlah, sehingga stok ruangan/laundry ikut bergerak tepat sebanyak unit yang berhasil.
type Titik = "serah_kotor" | "terima_kotor" | "masuk_batch" | "selesai_cuci" | "distribusi" | "terima_ruangan";
const storeUtils = utilsStore();
const TITIK: { value: Titik; label: string; izin: [string, string] }[] = [
  { value: "serah_kotor", label: "1. Serah terima linen kotor (ruangan)", izin: ["Penerimaan", "CREATE"] },
  { value: "terima_kotor", label: "2. Diterima laundry (konfirmasi kotor)", izin: ["Penerimaan", "KONFIRMASI"] },
  { value: "masuk_batch", label: "3. Masuk batch cuci", izin: ["Batch", "CREATE"] },
  { value: "selesai_cuci", label: "4. Selesai dicuci (stok bersih)", izin: ["Batch", "UPDATE"] },
  { value: "distribusi", label: "5. Distribusi ke ruangan", izin: ["Distribusi", "CREATE"] },
  { value: "terima_ruangan", label: "6. Diterima ruangan", izin: ["Distribusi", "KONFIRMASI"] },
];
const opsiTitik = computed(() => TITIK.filter((t) => izinLaundry(t.izin[0], t.izin[1])));
const titik = ref<Titik | "">("");

const ruangan = ref<any[]>([]);
const opsiRuangan = computed(() => ruangan.value.map((r) => ({ value: r.uuid, label: r.nama })));
const konteks = ref<any>({ ruanganUuid: "", kategori: "biasa", dokumenUuid: "", beratKg: null, permintaanUuid: "", alasan: "" });
const dokumen = ref<any[]>([]);
const permintaan = ref<any[]>([]);
const harapan = ref<any[]>([]);
const jumlahManual = ref<Record<string, number>>({});
const dokumenTerpilih = computed(() => dokumen.value.find((d) => d.uuid === konteks.value.dokumenUuid) ?? null);
const opsiDokumen = computed(() =>
  dokumen.value.map((d) => ({
    value: d.uuid,
    label:
      titik.value === "selesai_cuci"
        ? `${d.kode} · ${gayaKategori(d.kategori).label} · ${waktuLaundry(d.waktuMulai)}`
        : `${d.namaRuangan ?? "-"} · ${waktuLaundry(d.waktuSerah ?? d.waktuKirim)} · ${(d.rincian ?? []).map((r: any) => `${r.namaLinen} ${Number(r.jumlahDiserahkan ?? r.jumlahDikirim)}`).join(", ")}`,
  })),
);
const opsiPermintaan = computed(() =>
  permintaan.value
    .filter((p) => p.lokasiUuid === konteks.value.ruanganUuid && ["menunggu", "sebagian"].includes(p.status))
    .map((p) => ({ value: p.uuid, label: `${waktuLaundry(p.waktuPermintaan)} · ${(p.rincian ?? []).map((r: any) => `${r.namaLinen} ${Number(r.jumlahDiminta) - Number(r.jumlahTerpenuhi)}`).join(", ")}` })),
);
const butuhDokumen = computed(() => ["terima_kotor", "selesai_cuci", "terima_ruangan"].includes(titik.value));
const butuhRuangan = computed(() => ["serah_kotor", "distribusi"].includes(titik.value));

// Daftar hasil pindai: diterima (dihitung & dikirim) dan ditolak (ditampilkan, tidak dihitung).
const daftar = ref<any[]>([]);
const ditolak = ref<any[]>([]);
const pesan = ref("");
const hasil = ref("");
const kode = ref("");
const masukan = ref<HTMLInputElement | null>(null);
const fokus = () => nextTick(() => masukan.value?.focus());

const reset = () => {
  daftar.value = [];
  ditolak.value = [];
  pesan.value = "";
  jumlahManual.value = {};
  konteks.value.alasan = "";
};

const muatDokumen = async () => {
  dokumen.value = [];
  harapan.value = [];
  konteks.value.dokumenUuid = "";
  if (titik.value === "terima_kotor") dokumen.value = (await daftarPenerimaanLaundry({ status: "menunggu_konfirmasi" }))?.payload ?? [];
  if (titik.value === "terima_ruangan") dokumen.value = (await daftarDistribusiLaundry({ status: "menunggu_konfirmasi" }))?.payload ?? [];
  if (titik.value === "selesai_cuci")
    dokumen.value = ((await daftarBatchLaundry({ status: "proses" }))?.payload ?? []).filter((b: any) => (b.tahapan ?? []).find((t: any) => t.tahap === "pengeringan")?.status === "selesai");
  if (titik.value === "distribusi" && izinLaundry("Permintaan Linen", "READ")) permintaan.value = (await daftarPermintaanLaundry())?.payload ?? [];
};
watch(titik, async () => {
  reset();
  hasil.value = "";
  await muatDokumen();
  fokus();
});
watch(
  () => konteks.value.dokumenUuid,
  async (uuid) => {
    reset();
    harapan.value = uuid ? ((await unitDokumenLaundry(uuid))?.payload ?? []) : [];
    for (const r of dokumenTerpilih.value?.rincian ?? []) jumlahManual.value[r.uuid] = Number(r.jumlahDiserahkan ?? r.jumlahDikirim ?? 0);
    fokus();
  },
);
onMounted(async () => {
  ruangan.value = (await referensiUnitLaundry())?.payload?.ruangan ?? [];
  if (opsiTitik.value.length === 1) titik.value = opsiTitik.value[0].value;
});

// Aturan posisi per titik (diperiksa ulang server dalam transaksi berkunci).
const alasanTolak = (u: any): string | null => {
  if (u.caraPencatatan !== "per_unit") return `jenis ${u.namaJenis} tidak dilacak per unit`;
  if (u.status !== "aktif") return `status ${gayaStatusUnit(u.status).label}`;
  const k = konteks.value;
  const posisi = `posisi ${posisiUnit(u)}`;
  switch (titik.value) {
    case "serah_kotor":
      return u.lokasiTipe === "ruangan" && u.lokasiUuid === k.ruanganUuid ? null : `${posisi}, bukan di ruangan terpilih`;
    case "terima_kotor":
    case "terima_ruangan":
      return harapan.value.some((h) => h.uuid === u.uuid) ? null : `${posisi}, bukan bagian dokumen terpilih`;
    case "masuk_batch": {
      if (u.lokasiTipe !== "kotor") return `${posisi}, belum di antrean cuci`;
      const kat = daftar.value[0]?.unit?.kategori;
      return kat && u.kategori !== kat ? `kategori ${gayaKategori(u.kategori).label} berbeda dari ${gayaKategori(kat).label} (batch terpisah)` : null;
    }
    case "selesai_cuci":
      return u.lokasiTipe === "batch" && u.dokumenUuid === k.dokumenUuid ? null : `${posisi}, bukan isi batch terpilih`;
    case "distribusi":
      return u.lokasiTipe === "laundry" ? null : `${posisi}, bukan stok bersih laundry`;
  }
  return "pilih titik alur terlebih dahulu";
};

const terakhir = new Map<string, number>();
const pindai = async (mentah?: string) => {
  const nilai = String(mentah ?? kode.value).trim().toUpperCase();
  kode.value = "";
  fokus();
  if (!nilai) return;
  if (!titik.value || (butuhRuangan.value && !konteks.value.ruanganUuid) || (butuhDokumen.value && !konteks.value.dokumenUuid)) {
    pesan.value = "Lengkapi titik alur dan ruangan/dokumen sebelum memindai.";
    return;
  }
  if (daftar.value.some((x) => x.kode === nilai || x.unit.kodeUnit === nilai)) {
    pesan.value = `Kode ${nilai} sudah ada di daftar (tidak dihitung dua kali).`;
    return;
  }
  const u = (await pindaiUnitLaundry(nilai))?.payload;
  if (!u) {
    ditolak.value.unshift({ kode: nilai, alasan: "kode tidak dikenal pada faskes ini" });
    pesan.value = `Kode ${nilai} ditolak.`;
    return;
  }
  const tolak = alasanTolak(u);
  if (tolak) {
    ditolak.value.unshift({ kode: nilai, alasan: tolak });
    pesan.value = `Unit ${u.kodeUnit} ditolak: ${tolak}.`;
    return;
  }
  daftar.value.unshift({ kode: nilai, unit: u });
  pesan.value = `${u.kodeUnit} ditambahkan.`;
};
const hapus = (x: any) => (daftar.value = daftar.value.filter((y) => y !== x));

// ── Kamera peramban (BarcodeDetector). Peramban tanpa dukungan tetap dapat memakai scanner USB/ketik manual.
const video = ref<HTMLVideoElement | null>(null);
const kameraAktif = ref(false);
let aliran: MediaStream | null = null;
let bingkai = 0;
const nyalakanKamera = async () => {
  const Detektor = (window as any).BarcodeDetector;
  if (!Detektor || !navigator.mediaDevices?.getUserMedia) {
    pesan.value = "Peramban ini belum mendukung pemindaian kamera. Gunakan scanner USB atau ketik kode.";
    return;
  }
  try {
    aliran = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
    kameraAktif.value = true;
    await nextTick();
    if (!video.value) return;
    video.value.srcObject = aliran;
    await video.value.play();
    const detektor = new Detektor({ formats: ["qr_code", "code_128", "code_39"] });
    const periksa = async () => {
      if (!kameraAktif.value || !video.value) return;
      try {
        const [kode1] = await detektor.detect(video.value);
        const nilai = String(kode1?.rawValue ?? "").trim().toUpperCase();
        // Kode yang sama diabaikan 3 detik agar satu label tidak terbaca berulang.
        if (nilai && Date.now() - (terakhir.get(nilai) ?? 0) > 3000) {
          terakhir.set(nilai, Date.now());
          await pindai(nilai);
        }
      } catch {
        /* bingkai belum siap — dicoba lagi */
      }
      bingkai = requestAnimationFrame(periksa);
    };
    bingkai = requestAnimationFrame(periksa);
  } catch {
    kameraAktif.value = false;
    pesan.value = "Kamera tidak dapat dibuka. Periksa izin kamera atau gunakan scanner USB.";
  }
};
const matikanKamera = () => {
  kameraAktif.value = false;
  cancelAnimationFrame(bingkai);
  aliran?.getTracks().forEach((t) => t.stop());
  aliran = null;
};
onUnmounted(matikanKamera);

// ── Ringkasan & simpan
const perJenis = computed(() => {
  const m = new Map<string, { jenisLinenUuid: string; namaJenis: string; kode: string[] }>();
  for (const x of daftar.value) {
    const g = m.get(x.unit.jenisLinenUuid) ?? { jenisLinenUuid: x.unit.jenisLinenUuid, namaJenis: x.unit.namaJenis, kode: [] };
    g.kode.push(x.unit.kodeUnit);
    m.set(x.unit.jenisLinenUuid, g);
  }
  return [...m.values()];
});
const kurang = computed(() => (["terima_kotor", "selesai_cuci", "terima_ruangan"].includes(titik.value) ? harapan.value.filter((h) => !daftar.value.some((x) => x.unit.uuid === h.uuid)) : []));
const rincianTanpaUnit = computed(() => (dokumenTerpilih.value?.rincian ?? []).filter((r: any) => !harapan.value.some((h) => h.rincianUuid === r.uuid)));
const bisaSimpan = computed(() => {
  if (titik.value === "terima_kotor" || titik.value === "terima_ruangan") return !!konteks.value.dokumenUuid && (!kurang.value.length || !!konteks.value.alasan.trim());
  if (titik.value === "selesai_cuci") return !!konteks.value.dokumenUuid && !kurang.value.length && daftar.value.length > 0;
  if (titik.value === "masuk_batch") return daftar.value.length > 0 && Number(konteks.value.beratKg) > 0;
  return daftar.value.length > 0;
});

const konfirmasiRincian = () =>
  (dokumenTerpilih.value?.rincian ?? []).map((r: any) => {
    const punyaUnit = harapan.value.some((h) => h.rincianUuid === r.uuid);
    if (!punyaUnit) {
      const n = Number(jumlahManual.value[r.uuid] ?? 0);
      return { uuid: r.uuid, jumlahDiterima: n, alasanSelisih: n !== Number(r.jumlahDiserahkan ?? r.jumlahDikirim) ? konteks.value.alasan || undefined : undefined };
    }
    const kodeR = daftar.value.filter((x) => x.unit.rincianUuid === r.uuid).map((x) => x.unit.kodeUnit);
    const total = harapan.value.filter((h) => h.rincianUuid === r.uuid).length;
    return { uuid: r.uuid, kodeUnit: kodeR, alasanSelisih: kodeR.length !== total ? konteks.value.alasan || undefined : undefined };
  });

const simpan = async () => {
  const k = konteks.value;
  const kodeSemua = daftar.value.map((x) => x.unit.kodeUnit);
  storeUtils.setLoading(true);
  try {
    let res: any;
    if (titik.value === "serah_kotor")
      res = await buatPenerimaanLaundry({ lokasiUuid: k.ruanganUuid, rincian: perJenis.value.map((g) => ({ jenisLinenUuid: g.jenisLinenUuid, kategori: k.kategori, kodeUnit: g.kode })) });
    if (titik.value === "terima_kotor") res = await konfirmasiPenerimaanLaundry(k.dokumenUuid, konfirmasiRincian());
    if (titik.value === "masuk_batch") res = await buatBatchLaundry({ beratKg: k.beratKg, kodeUnit: kodeSemua });
    if (titik.value === "selesai_cuci") res = await ubahTahapLaundry(k.dokumenUuid, "setrika_lipat", "selesai", undefined, kodeSemua);
    if (titik.value === "distribusi")
      res = await kirimDistribusiLaundry({ lokasiTujuanUuid: k.ruanganUuid, permintaanUuid: k.permintaanUuid || undefined, rincian: perJenis.value.map((g) => ({ jenisLinenUuid: g.jenisLinenUuid, kodeUnit: g.kode })) });
    if (titik.value === "terima_ruangan") res = await konfirmasiDistribusiLaundry(k.dokumenUuid, konfirmasiRincian());
    if (res) {
      const peringatan = res.payload?.unitPeringatan ?? [];
      hasil.value = `${res.message}. ${kodeSemua.length} unit tercatat${peringatan.length ? `; perhatikan umur pakai: ${peringatan.map((p: any) => `${p.kodeUnit} (${p.siklusCuci}${p.batasSiklus ? `/${p.batasSiklus}` : ""})`).join(", ")}` : ""}.`;
      reset();
      await muatDokumen();
    }
  } finally {
    storeUtils.setLoading(false);
    fokus();
  }
};
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <h1 class="toolbar-heading text-opensimrs-300">Pemindaian Unit Linen</h1>
          <CustomSelect v-model="titik" label="Titik alur" :options="opsiTitik" optionValue="value" optionLabel="label" placeHolder="Pilih titik alur" :clearable="false" class="min-w-[320px]" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!opsiTitik.length" />
        <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2">
          <div class="flex flex-col gap-3">
            <template v-if="butuhRuangan">
              <CustomSelect v-model="konteks.ruanganUuid" :label="titik === 'distribusi' ? 'Ruangan Tujuan' : 'Ruangan Asal'" :options="opsiRuangan" optionValue="value" optionLabel="label" placeHolder="Pilih ruangan" @update:modelValue="reset" />
              <CustomSelect v-if="titik === 'serah_kotor'" v-model="konteks.kategori" label="Kategori Linen Kotor" :options="OPSI_KATEGORI" optionValue="value" optionLabel="label" :clearable="false" :showFilter="false" />
              <CustomSelect v-if="titik === 'distribusi' && opsiPermintaan.length" v-model="konteks.permintaanUuid" label="Permintaan Ruangan (opsional)" :options="[{ value: '', label: 'Tanpa permintaan' }, ...opsiPermintaan]" optionValue="value" optionLabel="label" />
            </template>
            <template v-if="butuhDokumen">
              <CustomSelect
                v-model="konteks.dokumenUuid"
                :label="titik === 'selesai_cuci' ? 'Batch (pengeringan selesai)' : titik === 'terima_kotor' ? 'Serah Terima Menunggu Konfirmasi' : 'Distribusi Menunggu Konfirmasi'"
                :options="opsiDokumen"
                optionValue="value"
                optionLabel="label"
                placeHolder="Pilih dokumen"
              />
              <div v-if="konteks.dokumenUuid" class="text-xs text-grey-400">Unit diharapkan: {{ harapan.length }} · sudah dipindai: {{ daftar.length }}</div>
            </template>
            <CustomInputNumber v-if="titik === 'masuk_batch'" v-model="konteks.beratKg" label="Berat Cucian (kg)" :min="0" :maxFractionDigits="3" />

            <form class="flex flex-col gap-1" @submit.prevent="pindai()">
              <label class="font-semibold text-normal">Kode Unit (scanner USB / ketik lalu Enter)</label>
              <div class="flex gap-2">
                <input
                  ref="masukan"
                  v-model="kode"
                  autofocus
                  autocomplete="off"
                  class="flex-1 rounded-md border border-grey-200 px-3 py-2 text-sm focus:outline-none focus:border-opensimrs-300"
                  placeholder="Pindai QR/barcode"
                  aria-label="Kode unit linen"
                />
                <CustomButton icon="PhPlus" label="Tambah" @click="pindai()" />
              </div>
            </form>
            <div class="flex gap-2">
              <CustomButton
                :icon="kameraAktif ? 'PhCameraSlash' : 'PhCamera'"
                :label="kameraAktif ? 'Matikan Kamera' : 'Pindai dengan Kamera'"
                outlined
                borderColor="border-opensimrs-300"
                textColor="text-opensimrs-300"
                @click="kameraAktif ? matikanKamera() : nyalakanKamera()"
              />
            </div>
            <video v-show="kameraAktif" ref="video" class="w-full max-h-64 rounded bg-black" playsinline muted />
            <div v-if="pesan" class="text-sm text-grey-400" role="status">{{ pesan }}</div>
            <div v-if="hasil" class="text-sm text-mint-400 font-semibold" role="status">{{ hasil }}</div>
          </div>

          <div class="lg:col-span-2 flex flex-col gap-3">
            <div class="flex items-center gap-3">
              <div class="text-base font-semibold text-opensimrs-300">Hasil pindai: {{ daftar.length }} unit</div>
              <span v-for="g in perJenis" :key="g.jenisLinenUuid" class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#D1E9FF] text-[#175CD3]">{{ g.namaJenis }}: {{ g.kode.length }}</span>
            </div>
            <DataTable :value="daftar" class="text-xs" stripedRows scrollable scrollHeight="320px">
              <Column header="Kode" headerClass="bg-opensimrs-50"><template #body="{ data: d }"><span class="font-semibold">{{ d.unit.kodeUnit }}</span></template></Column>
              <Column header="Jenis" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.unit.namaJenis }}</template></Column>
              <Column header="Posisi Sekarang" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ posisiUnit(d.unit) }}</template></Column>
              <Column header="Siklus" headerClass="bg-opensimrs-50">
                <template #body="{ data: d }">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaSiklusUnit(d.unit.statusSiklus).bg, gayaSiklusUnit(d.unit.statusSiklus).text]">{{ d.unit.siklusCuci }}{{ d.unit.batasSiklus ? ` / ${d.unit.batasSiklus}` : "" }}</span>
                </template>
              </Column>
              <Column header="" headerClass="bg-opensimrs-50" class="w-[60px]">
                <template #body="{ data: d }"><CustomButton icon="PhTrash" size="small" outlined borderColor="border-danger-300" textColor="text-danger-300" @click="hapus(d)" /></template>
              </Column>
            </DataTable>

            <div v-if="kurang.length" class="text-xs">
              <div class="font-semibold text-danger-300">Belum dipindai ({{ kurang.length }}): {{ kurang.map((u) => u.kodeUnit).join(", ") }}</div>
              <div v-if="titik === 'selesai_cuci'" class="text-grey-400">Seluruh isi batch harus dipindai sebelum diselesaikan.</div>
              <div v-else-if="titik === 'terima_kotor'" class="text-grey-400">Unit yang tidak dipindai kembali tercatat di ruangan asal (selisih wajib beralasan).</div>
              <div v-else class="text-grey-400">Unit yang tidak dipindai akan ditandai hilang beralasan.</div>
            </div>
            <div v-if="rincianTanpaUnit.length && (titik === 'terima_kotor' || titik === 'terima_ruangan')" class="flex flex-col gap-2">
              <div class="text-xs font-semibold">Linen per jumlah pada dokumen ini</div>
              <div v-for="r in rincianTanpaUnit" :key="r.uuid" class="flex items-center gap-3 text-xs">
                <span class="w-48">{{ r.namaLinen }} (dikirim {{ Number(r.jumlahDiserahkan ?? r.jumlahDikirim) }})</span>
                <CustomInputNumber v-model="jumlahManual[r.uuid]" :showLabel="false" :min="0" :max="Number(r.jumlahDiserahkan ?? r.jumlahDikirim)" />
              </div>
            </div>
            <CustomTextfield v-if="titik === 'terima_kotor' || titik === 'terima_ruangan'" v-model="konteks.alasan" label="Alasan selisih (wajib bila ada yang tidak diterima)" :maxLength="500" />

            <div v-if="ditolak.length" class="text-xs">
              <div class="font-semibold text-danger-300 mb-1">Ditolak (tidak dihitung): {{ ditolak.length }}</div>
              <div v-for="(t, i) in ditolak.slice(0, 20)" :key="i" class="text-danger-300">{{ t.kode }} — {{ t.alasan }}</div>
            </div>

            <div class="flex justify-end gap-2">
              <CustomButton label="Kosongkan" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="reset" />
              <CustomButton label="Simpan & Konfirmasi" icon="PhCheck" :disabled="!bisaSimpan" @click="simpan" />
            </div>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
