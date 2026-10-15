<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import {
  daftarPesertaMcu, pemeriksaanMcu, simpanStasiunMcu, simpanKesimpulanMcu, bukaKesimpulanMcu, referensiMcu, izinMcu,
  STATUS_PESERTA, KESIMPULAN_MCU, SISTEM_FISIK, JENIS_MCU, tglIso, tglIndo, jenisKelamin,
  type StatusPeserta, type Kesimpulan,
} from "@/stores/penunjang/mcu";
import { STATUS_ITEM_RAD, type StatusItemRad } from "@/stores/penunjang/radiologi";
import { cetakLaporanMcu, cetakSertifikatMcu } from "@/utils/pdf/pdfMcu/cetakMcu";

// Pemeriksaan MCU per stasiun: pilih peserta → isi form terstruktur tiap stasiun → kesimpulan dokter.
// Stasiun Laboratorium menampilkan hasil order lab (lab-service / LIS) dan input manual untuk item tanpa master lab.
const route = useRoute();
const bolehInput = computed(() => izinMcu("Pemeriksaan", "INPUT HASIL"));
const bolehKesimpulan = computed(() => izinMcu("Peserta", "KESIMPULAN"));
const bolehCetak = computed(() => izinMcu("Peserta", "CETAK"));
const tanggal = ref<Date>(new Date());
const cari = ref("");
const daftar = ref<any[]>([]);
const memuatDaftar = ref(false);
const detail = ref<any>(null);
const aktif = ref<string>("");
const form = ref<Record<string, any>>({});
const kesimpulan = ref<any>({ kesimpulan: null, catatan: "", saran: "", dokterPemeriksaUuid: null });
const dokter = ref<any[]>([]);
const menyimpan = ref(false);

const muatDaftar = async () => {
  memuatDaftar.value = true;
  const res = await daftarPesertaMcu({ tanggal: tglIso(tanggal.value), cari: cari.value, status: "terdaftar,proses,selesai", limit: 200 });
  daftar.value = res?.payload?.data ?? [];
  memuatDaftar.value = false;
};

const num = (v: any) => (v === undefined || v === null || v === "" ? null : Number(v));
// Bentuk awal form per stasiun (digabung dengan data tersimpan).
const awal = (kode: string, data: any, d: any) => {
  const x = data ?? {};
  switch (kode) {
    case "tanda_vital":
      return { sistole: num(x.sistole), diastole: num(x.diastole), nadi: num(x.nadi), respirasi: num(x.respirasi), suhu: num(x.suhu),
        beratBadan: num(x.beratBadan), tinggiBadan: num(x.tinggiBadan), lingkarPerut: num(x.lingkarPerut) };
    case "fisik":
      return {
        sistem: SISTEM_FISIK.map((s) => {
          const r = (x.sistem ?? []).find((y: any) => y.kode === s.kode);
          return { kode: s.kode, status: r?.status ?? "normal", catatan: r?.catatan ?? "" };
        }),
        catatan: x.catatan ?? "",
      };
    case "visus":
      return { od: "6/6", os: "6/6", odKoreksi: "", osKoreksi: "", kacamata: false, butaWarna: "Normal", kesan: "", ...x };
    case "laboratorium": {
      const tersimpan = x.hasil ?? [];
      // Hanya item lab yang tidak tercakup order Laboratorium (teks bebas / tanpa master) diisi manual di sini.
      const items = d.laboratorium?.manual ?? (d.items ?? []).filter((i: any) => i.jenis === "lab");
      return {
        hasil: items.map((i: any) => {
          const r = tersimpan.find((y: any) => (i.uuid && y.itemUuid === i.uuid) || y.nama === i.nama);
          return { itemUuid: i.uuid, nama: i.nama, satuan: i.satuan ?? "", nilaiRujukan: i.nilaiRujukan ?? "", nilai: r?.nilai ?? "", flag: r?.flag ?? "N" };
        }),
        kesan: x.kesan ?? "",
      };
    }
    case "anamnesis":
      return { keluhan: "", riwayatPenyakit: "", riwayatKeluarga: "", riwayatOperasi: "", obatRutin: "", alergi: "", merokok: "Tidak", alkohol: "Tidak",
        olahraga: "", riwayatPekerjaan: "", ...x };
    case "audiometri":
      return { kanan: "", kiri: "", hasil: "Normal", kesan: "", ...x };
    case "ekg":
      return { irama: "Sinus", frekuensi: null, hasil: "Normal", kesan: "", ...x };
    case "spirometri":
      return { fvc: null, fev: null, rasio: null, hasil: "Normal", kesan: "", ...x };
    case "gigi":
      return { karies: "", gigiHilang: "", kalkulus: "Tidak ada", gingiva: "Normal", kesan: "", ...x };
    case "radiologi":
      return { hasil: "", kesan: "", ...x };
    default:
      return { kesan: "", ...x };
  }
};

const pilih = async (uuid: string, tetapTab = false) => {
  const res = await pemeriksaanMcu(uuid);
  if (!res) return;
  const d = res.payload;
  detail.value = d;
  const f: Record<string, any> = {};
  for (const s of d.stasiun) f[s.kode] = awal(s.kode, s.data, d);
  form.value = f;
  kesimpulan.value = {
    kesimpulan: d.kesimpulan ?? null, catatan: d.catatanKesimpulan ?? "", saran: d.saran ?? "",
    dokterPemeriksaUuid: d.dokterPemeriksaUuid ?? null,
  };
  if (!tetapTab || !d.stasiun.some((s: any) => s.kode === aktif.value)) {
    aktif.value = d.stasiun.find((s: any) => s.status !== "selesai")?.kode ?? d.stasiun[0]?.kode;
  }
};

const imt = computed(() => {
  const tv = form.value.tanda_vital;
  if (!tv?.beratBadan || !tv?.tinggiBadan) return null;
  const n = Math.round((tv.beratBadan / (tv.tinggiBadan / 100) ** 2) * 10) / 10;
  const kat = n < 18.5 ? "Berat badan kurang" : n < 23 ? "Normal" : n < 25 ? "Berat badan lebih" : n < 30 ? "Obesitas I" : "Obesitas II";
  return { n, kat };
});
const stasiunAktif = computed(() => detail.value?.stasiun?.find((s: any) => s.kode === aktif.value));
const terkunci = computed(() => detail.value?.status === "selesai" || detail.value?.status === "batal");
const belumSelesai = computed(() => (detail.value?.stasiun ?? []).filter((s: any) => s.kode !== "kesimpulan" && s.status !== "selesai"));

const simpanStasiun = async (status: "selesai" | "belum" = "selesai") => {
  menyimpan.value = true;
  const res = await simpanStasiunMcu(detail.value.uuid, aktif.value, form.value[aktif.value], status);
  menyimpan.value = false;
  if (res) {
    await pilih(detail.value.uuid, status === "belum");
    muatDaftar();
  }
};
const simpanKesimpulan = async () => {
  let paksa = false;
  if (belumSelesai.value.length) {
    if (!window.confirm(`Stasiun belum selesai: ${belumSelesai.value.map((s: any) => s.nama).join(", ")}.\nTetap simpan kesimpulan (hasil menyusul)?`)) return;
    paksa = true;
  }
  menyimpan.value = true;
  const res = await simpanKesimpulanMcu(detail.value.uuid, { ...kesimpulan.value, paksa });
  menyimpan.value = false;
  if (res) {
    await pilih(detail.value.uuid, true);
    muatDaftar();
  }
};
const bukaKembali = async () => {
  if (!window.confirm("Buka kembali MCU ini untuk koreksi? Kesimpulan akan dihapus.")) return;
  if (await bukaKesimpulanMcu(detail.value.uuid)) {
    await pilih(detail.value.uuid, true);
    muatDaftar();
  }
};

const OPSI_YA = ["Tidak", "Ya", "Berhenti"];
const OPSI_BUTA_WARNA = ["Normal", "Buta warna parsial", "Buta warna total"];
const OPSI_HASIL = ["Normal", "Abnormal"];
const OPSI_AUDIO = ["Normal", "Tuli konduktif", "Tuli sensorineural", "Tuli campuran", "Noise induced hearing loss (NIHL)"];
const OPSI_SPIRO = ["Normal", "Restriksi", "Obstruksi", "Campuran (restriksi & obstruksi)"];
const OPSI_FLAG = [{ v: "N", l: "Normal" }, { v: "H", l: "Tinggi" }, { v: "L", l: "Rendah" }, { v: "A", l: "Abnormal" }];

onMounted(async () => {
  await muatDaftar();
  dokter.value = (await referensiMcu())?.payload?.dokter ?? [];
  const q = route.query.peserta;
  if (typeof q === "string" && q) pilih(q);
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-hidden" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muatDaftar" />
          <h1 class="toolbar-heading text-opensimrs-300">Pemeriksaan Stasiun MCU</h1>
          <CustomDatePicker v-model="tanggal" label="Tanggal" class="toolbar-field--date" @update:modelValue="muatDaftar" />
          <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nama / No. RM / No. MCU" @keydown.enter="muatDaftar" />
          <CustomButton icon="PhMagnifyingGlass" label="Cari" @click="muatDaftar" />
        </PageToolbar>
      </template>
      <template #content>
        <div class="grid grid-cols-[280px,1fr] h-full overflow-hidden">
          <!-- Daftar peserta -->
          <div class="overflow-auto border-r border-grey-100">
            <div v-if="memuatDaftar" class="p-4 text-xs text-grey-400">Memuat…</div>
            <div v-else-if="!daftar.length" class="p-4 text-xs text-grey-400">Tidak ada peserta pada tanggal ini</div>
            <button
              v-for="p in daftar"
              :key="p.uuid"
              type="button"
              class="w-full px-3 py-2 text-left border-b border-grey-100 hover:bg-opensimrs-50"
              :class="{ 'bg-opensimrs-50 border-l-4 border-l-opensimrs-300': detail?.uuid === p.uuid }"
              @click="pilih(p.uuid)"
            >
              <div class="flex justify-between gap-2 text-xs">
                <span class="font-semibold truncate">{{ p.namaPasien }}</span>
                <span class="px-1.5 rounded-full shrink-0" :class="[STATUS_PESERTA[p.status as StatusPeserta]?.bg, STATUS_PESERTA[p.status as StatusPeserta]?.text]">
                  {{ STATUS_PESERTA[p.status as StatusPeserta]?.label }}
                </span>
              </div>
              <div class="text-[11px] text-grey-400">{{ p.noMcu }} · {{ p.noRm }}</div>
              <div class="text-[11px] text-grey-400 truncate">{{ p.namaPerusahaan ?? "Perorangan" }} · {{ p.namaPaket }}</div>
              <ProgressBar class="mt-1" :value="Math.round((p.stasiunSelesai / Math.max(p.stasiunTotal, 1)) * 100)" :showValue="false" style="height: 4px" />
            </button>
          </div>

          <!-- Form stasiun -->
          <div class="flex flex-col overflow-hidden">
            <div v-if="!detail" class="flex items-center justify-center h-full text-sm text-grey-400">Pilih peserta di sebelah kiri</div>
            <template v-else>
              <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-grey-100">
                <div class="text-sm">
                  <div class="font-semibold">{{ detail.namaPasien }} <span class="font-normal text-grey-400">({{ detail.noRm }})</span></div>
                  <div class="text-xs text-grey-400">
                    {{ jenisKelamin(detail.gender) }} · {{ detail.umur ?? "-" }} th · {{ detail.noMcu }} · {{ tglIndo(detail.tanggal) }} ·
                    {{ detail.namaPaket }} · {{ detail.namaPerusahaan ?? "Perorangan" }} · {{ JENIS_MCU[detail.jenisMcu] }}
                  </div>
                </div>
                <div class="flex gap-2">
                  <template v-if="bolehCetak">
                    <Button size="small" outlined label="Laporan Hasil" @click="cetakLaporanMcu(detail)"><PhPrinter :size="16" class="mr-1" />Laporan Hasil</Button>
                    <Button size="small" outlined :disabled="detail.status !== 'selesai'" @click="cetakSertifikatMcu(detail)"><PhCertificate :size="16" class="mr-1" />Surat Keterangan</Button>
                  </template>
                </div>
              </div>

              <!-- Langkah stasiun -->
              <div class="flex gap-1 px-4 py-2 overflow-x-auto border-b border-grey-100">
                <button
                  v-for="(s, i) in detail.stasiun"
                  :key="s.kode"
                  type="button"
                  class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border whitespace-nowrap"
                  :class="aktif === s.kode ? 'bg-opensimrs-300 text-white border-opensimrs-300' : s.status === 'selesai' ? 'border-[#6CE9A6] text-[#027A48] bg-[#ECFDF3]' : 'border-grey-200 text-grey-400'"
                  @click="aktif = s.kode"
                >
                  <PhCheckCircle v-if="s.status === 'selesai'" :size="14" weight="fill" />
                  <span v-else>{{ i + 1 }}.</span>
                  {{ s.nama }}
                </button>
              </div>

              <div class="flex-1 p-4 overflow-auto text-sm">
                <fieldset :disabled="(terkunci || !bolehInput) && aktif !== 'kesimpulan'" class="contents">
                  <!-- Anamnesis -->
                  <div v-if="aktif === 'anamnesis'" class="grid grid-cols-2 gap-3">
                    <label class="flex flex-col col-span-2 gap-1">Keluhan saat ini<TextArea v-model="form.anamnesis.keluhan" rows="2" autoResize /></label>
                    <label class="flex flex-col gap-1">Riwayat penyakit dahulu<TextArea v-model="form.anamnesis.riwayatPenyakit" rows="2" autoResize /></label>
                    <label class="flex flex-col gap-1">Riwayat penyakit keluarga<TextArea v-model="form.anamnesis.riwayatKeluarga" rows="2" autoResize /></label>
                    <label class="flex flex-col gap-1">Riwayat operasi / rawat inap<InputText v-model="form.anamnesis.riwayatOperasi" /></label>
                    <label class="flex flex-col gap-1">Obat rutin<InputText v-model="form.anamnesis.obatRutin" /></label>
                    <label class="flex flex-col gap-1">Alergi<InputText v-model="form.anamnesis.alergi" /></label>
                    <label class="flex flex-col gap-1">Olahraga<InputText v-model="form.anamnesis.olahraga" placeholder="mis. 2x/minggu" /></label>
                    <label class="flex flex-col gap-1">Merokok<Select v-model="form.anamnesis.merokok" :options="OPSI_YA" /></label>
                    <label class="flex flex-col gap-1">Alkohol<Select v-model="form.anamnesis.alkohol" :options="OPSI_YA" /></label>
                    <label class="flex flex-col col-span-2 gap-1">Riwayat pekerjaan & paparan (bising, debu, kimia, dll.)<TextArea v-model="form.anamnesis.riwayatPekerjaan" rows="2" autoResize /></label>
                  </div>

                  <!-- Tanda vital -->
                  <div v-else-if="aktif === 'tanda_vital'" class="grid grid-cols-4 gap-3">
                    <label class="flex flex-col gap-1">Sistole (mmHg)<InputNumber v-model="form.tanda_vital.sistole" :min="0" /></label>
                    <label class="flex flex-col gap-1">Diastole (mmHg)<InputNumber v-model="form.tanda_vital.diastole" :min="0" /></label>
                    <label class="flex flex-col gap-1">Nadi (x/menit)<InputNumber v-model="form.tanda_vital.nadi" :min="0" /></label>
                    <label class="flex flex-col gap-1">Respirasi (x/menit)<InputNumber v-model="form.tanda_vital.respirasi" :min="0" /></label>
                    <label class="flex flex-col gap-1">Suhu (°C)<InputNumber v-model="form.tanda_vital.suhu" :minFractionDigits="0" :maxFractionDigits="1" /></label>
                    <label class="flex flex-col gap-1">Berat badan (kg)<InputNumber v-model="form.tanda_vital.beratBadan" :maxFractionDigits="1" /></label>
                    <label class="flex flex-col gap-1">Tinggi badan (cm)<InputNumber v-model="form.tanda_vital.tinggiBadan" :maxFractionDigits="1" /></label>
                    <label class="flex flex-col gap-1">Lingkar perut (cm)<InputNumber v-model="form.tanda_vital.lingkarPerut" :maxFractionDigits="1" /></label>
                    <div class="col-span-4 p-3 rounded bg-opensimrs-50">
                      IMT: <b>{{ imt ? `${imt.n} kg/m²` : "-" }}</b> <span v-if="imt">({{ imt.kat }})</span>
                      <span v-if="form.tanda_vital.sistole >= 140 || form.tanda_vital.diastole >= 90" class="ml-3 font-semibold text-danger-300">Tekanan darah tinggi</span>
                    </div>
                  </div>

                  <!-- Fisik -->
                  <div v-else-if="aktif === 'fisik'" class="flex flex-col gap-2">
                    <div v-for="s in form.fisik.sistem" :key="s.kode" class="grid grid-cols-[220px,200px,1fr] items-center gap-3">
                      <span>{{ SISTEM_FISIK.find((x) => x.kode === s.kode)?.nama }}</span>
                      <div class="flex gap-3">
                        <label class="flex items-center gap-1"><RadioButton v-model="s.status" value="normal" /> Normal</label>
                        <label class="flex items-center gap-1"><RadioButton v-model="s.status" value="abnormal" /> Abnormal</label>
                      </div>
                      <InputText v-model="s.catatan" :placeholder="s.status === 'abnormal' ? 'Uraikan temuan' : 'Catatan (opsional)'" :invalid="s.status === 'abnormal' && !s.catatan" />
                    </div>
                    <label class="flex flex-col gap-1 mt-2">Catatan pemeriksaan fisik<TextArea v-model="form.fisik.catatan" rows="2" autoResize /></label>
                  </div>

                  <!-- Visus -->
                  <div v-else-if="aktif === 'visus'" class="grid grid-cols-4 gap-3">
                    <label class="flex flex-col gap-1">Visus OD (kanan)<InputText v-model="form.visus.od" placeholder="6/6" /></label>
                    <label class="flex flex-col gap-1">Koreksi OD<InputText v-model="form.visus.odKoreksi" placeholder="mis. S -1.00" /></label>
                    <label class="flex flex-col gap-1">Visus OS (kiri)<InputText v-model="form.visus.os" placeholder="6/6" /></label>
                    <label class="flex flex-col gap-1">Koreksi OS<InputText v-model="form.visus.osKoreksi" /></label>
                    <label class="flex items-center gap-2"><Checkbox v-model="form.visus.kacamata" binary /> Memakai kacamata</label>
                    <label class="flex flex-col col-span-3 gap-1">Tes buta warna (Ishihara)<Select v-model="form.visus.butaWarna" :options="OPSI_BUTA_WARNA" /></label>
                    <label class="flex flex-col col-span-4 gap-1">Kesan<InputText v-model="form.visus.kesan" /></label>
                  </div>

                  <!-- Audiometri -->
                  <div v-else-if="aktif === 'audiometri'" class="grid grid-cols-2 gap-3">
                    <label class="flex flex-col gap-1">Telinga kanan (AD) — ambang rata-rata<InputText v-model="form.audiometri.kanan" placeholder="mis. 20 dB" /></label>
                    <label class="flex flex-col gap-1">Telinga kiri (AS) — ambang rata-rata<InputText v-model="form.audiometri.kiri" placeholder="mis. 20 dB" /></label>
                    <label class="flex flex-col gap-1">Hasil<Select v-model="form.audiometri.hasil" :options="OPSI_AUDIO" /></label>
                    <label class="flex flex-col gap-1">Kesan<InputText v-model="form.audiometri.kesan" /></label>
                  </div>

                  <!-- Laboratorium -->
                  <div v-else-if="aktif === 'laboratorium'" class="flex flex-col gap-3" data-uji="stasiun-lab">
                    <template v-if="detail.laboratorium?.noOrder">
                      <div class="flex flex-wrap items-center gap-2 text-xs">
                        <span class="font-semibold">Order Laboratorium {{ detail.laboratorium.noOrder }}</span>
                        <span class="px-2 py-0.5 rounded-full" :class="detail.laboratorium.batal ? 'bg-[#FDE2E1] text-[#B42318]' : detail.laboratorium.lengkap ? 'bg-[#D1FADF] text-[#027A48]' : 'bg-[#FEF0C7] text-[#B54708]'">
                          {{ detail.laboratorium.batal ? "Dibatalkan" : `${detail.laboratorium.statusLabel} · ${detail.laboratorium.terisi}/${detail.laboratorium.total} hasil` }}
                        </span>
                        <span class="text-grey-400">{{ detail.laboratorium.pemeriksaan?.join(", ") }}</span>
                        <span v-if="detail.laboratorium.dokterLab" class="text-grey-400">· Penanggung jawab: {{ detail.laboratorium.dokterLab }}</span>
                        <Button text size="small" class="ml-auto" @click="pilih(detail.uuid, true)"><PhArrowClockwise :size="14" class="mr-1" />Muat ulang hasil</Button>
                      </div>
                      <div v-if="!detail.laboratorium.batal" class="text-xs text-grey-400">
                        Hasil diisi analis di modul Laboratorium (atau diterima dari LIS) dan tampil otomatis di sini. Tidak ada tagihan lab terpisah — sudah termasuk harga paket.
                      </div>
                      <table v-if="!detail.laboratorium.batal" class="w-full text-xs border border-grey-100">
                        <thead class="bg-opensimrs-50">
                          <tr><th class="p-2 text-left">Pemeriksaan</th><th class="p-2 text-left w-32">Hasil</th><th class="p-2 text-left">Satuan</th><th class="p-2 text-left">Nilai Rujukan</th><th class="p-2 text-left w-28">Flag</th></tr>
                        </thead>
                        <tbody>
                          <template v-for="(h, i) in detail.laboratorium.hasil" :key="h.uuid">
                            <tr v-if="i === 0 || detail.laboratorium.hasil[i - 1].kelompok !== h.kelompok" class="bg-grey-50">
                              <td colspan="5" class="px-2 py-1 font-semibold text-opensimrs-400">{{ h.kelompok }}</td>
                            </tr>
                            <tr class="border-t border-grey-100">
                              <td class="p-2 pl-4">{{ h.nama }}</td>
                              <td class="p-2" :class="{ 'font-bold text-danger-300': h.abnormal }">{{ h.hasil ?? "—" }}</td>
                              <td class="p-2">{{ h.satuan || "-" }}</td>
                              <td class="p-2">{{ h.nilaiRujukan || "-" }}</td>
                              <td class="p-2" :class="{ 'font-semibold text-danger-300': h.abnormal }">{{ h.hasil === null ? "Menunggu" : h.labelFlag ?? "-" }}</td>
                            </tr>
                          </template>
                        </tbody>
                      </table>
                      <div v-if="detail.laboratorium.catatanAnalis" class="text-xs"><b>Catatan analis:</b> {{ detail.laboratorium.catatanAnalis }}</div>
                    </template>
                    <div v-else-if="(detail.items ?? []).some((i: any) => i.jenis === 'lab') && !form.laboratorium.hasil.length" class="p-3 rounded bg-[#FEF0C7] text-[#B54708] text-xs">Belum ada order laboratorium untuk peserta ini.</div>

                    <template v-if="form.laboratorium.hasil.length">
                      <div class="text-xs font-semibold">
                        {{ detail.laboratorium?.noOrder && !detail.laboratorium.batal ? "Pemeriksaan lain (tidak tersedia di master Laboratorium) — isi manual" : "Hasil laboratorium (isi manual)" }}
                      </div>
                      <table class="w-full text-xs border border-grey-100">
                        <thead class="bg-opensimrs-50">
                          <tr><th class="p-2 text-left">Pemeriksaan</th><th class="p-2 text-left w-36">Hasil</th><th class="p-2 text-left">Satuan</th><th class="p-2 text-left">Nilai Rujukan</th><th class="p-2 text-left w-32">Keterangan</th></tr>
                        </thead>
                        <tbody>
                          <tr v-for="h in form.laboratorium.hasil" :key="h.nama" class="border-t border-grey-100">
                            <td class="p-2">{{ h.nama }}</td>
                            <td class="p-1"><InputText v-model="h.nilai" size="small" class="w-full" :class="{ 'font-bold text-danger-300': h.flag !== 'N' }" /></td>
                            <td class="p-2">{{ h.satuan || "-" }}</td>
                            <td class="p-2">{{ h.nilaiRujukan || "-" }}</td>
                            <td class="p-1"><Select v-model="h.flag" :options="OPSI_FLAG" optionLabel="l" optionValue="v" size="small" class="w-full" /></td>
                          </tr>
                        </tbody>
                      </table>
                    </template>
                    <label class="flex flex-col gap-1">Kesan laboratorium (dokter MCU)<TextArea v-model="form.laboratorium.kesan" rows="2" autoResize /></label>
                  </div>

                  <!-- Radiologi -->
                  <div v-else-if="aktif === 'radiologi'" class="flex flex-col gap-3">
                    <div v-if="!detail.radiologi" class="p-3 rounded bg-[#FEF0C7] text-[#B54708] text-xs">
                      Tidak ada order radiologi untuk peserta ini (paket tanpa master radiologi). Isi catatan hasil eksternal di bawah bila ada.
                    </div>
                    <template v-else>
                      <div class="text-xs text-grey-400">
                        Order {{ detail.radiologi.noOrder }} — status {{ detail.radiologi.status }}. Hasil diisi oleh unit Radiologi dan tampil otomatis di sini.
                      </div>
                      <div v-for="i in detail.radiologi.items" :key="i.uuid" class="p-3 border rounded border-grey-100">
                        <div class="flex items-center justify-between">
                          <b>{{ i.nama }} <span class="font-normal text-grey-400">({{ i.modalitas }})</span></b>
                          <span class="px-2 py-0.5 rounded-full text-xs" :class="[STATUS_ITEM_RAD[i.status as StatusItemRad]?.bg, STATUS_ITEM_RAD[i.status as StatusItemRad]?.text]">
                            {{ STATUS_ITEM_RAD[i.status as StatusItemRad]?.label ?? i.status }}
                          </span>
                        </div>
                        <div v-if="i.hasil" class="mt-2 whitespace-pre-line">{{ i.hasil }}</div>
                        <div v-if="i.kesan" class="mt-1"><b>Kesan:</b> {{ i.kesan }}</div>
                        <div v-if="i.dokterRadiologi" class="mt-1 text-xs text-grey-400">Radiolog: {{ i.dokterRadiologi }}</div>
                        <div v-if="!i.hasil && !i.kesan" class="mt-1 text-xs text-grey-400">Hasil belum tersedia.</div>
                      </div>
                    </template>
                    <div class="flex items-center gap-4">
                      <span>Kesimpulan radiologi (untuk rekap HRD):</span>
                      <label class="flex items-center gap-1"><RadioButton v-model="form.radiologi.hasil" value="Normal" /> Normal</label>
                      <label class="flex items-center gap-1"><RadioButton v-model="form.radiologi.hasil" value="Abnormal" /> Abnormal</label>
                    </div>
                    <label class="flex flex-col gap-1">Catatan dokter MCU atas hasil radiologi<TextArea v-model="form.radiologi.kesan" rows="2" autoResize /></label>
                  </div>

                  <!-- EKG -->
                  <div v-else-if="aktif === 'ekg'" class="grid grid-cols-3 gap-3">
                    <label class="flex flex-col gap-1">Irama<InputText v-model="form.ekg.irama" /></label>
                    <label class="flex flex-col gap-1">Frekuensi (x/menit)<InputNumber v-model="form.ekg.frekuensi" :min="0" /></label>
                    <label class="flex flex-col gap-1">Hasil<Select v-model="form.ekg.hasil" :options="OPSI_HASIL" /></label>
                    <label class="flex flex-col col-span-3 gap-1">Kesan / interpretasi<TextArea v-model="form.ekg.kesan" rows="2" autoResize /></label>
                  </div>

                  <!-- Spirometri -->
                  <div v-else-if="aktif === 'spirometri'" class="grid grid-cols-3 gap-3">
                    <label class="flex flex-col gap-1">FVC (% prediksi)<InputNumber v-model="form.spirometri.fvc" :maxFractionDigits="1" /></label>
                    <label class="flex flex-col gap-1">FEV1 (% prediksi)<InputNumber v-model="form.spirometri.fev" :maxFractionDigits="1" /></label>
                    <label class="flex flex-col gap-1">FEV1/FVC (%)<InputNumber v-model="form.spirometri.rasio" :maxFractionDigits="1" /></label>
                    <label class="flex flex-col gap-1">Hasil<Select v-model="form.spirometri.hasil" :options="OPSI_SPIRO" /></label>
                    <label class="flex flex-col col-span-2 gap-1">Kesan<InputText v-model="form.spirometri.kesan" /></label>
                  </div>

                  <!-- Gigi -->
                  <div v-else-if="aktif === 'gigi'" class="grid grid-cols-2 gap-3">
                    <label class="flex flex-col gap-1">Karies (elemen)<InputText v-model="form.gigi.karies" placeholder="mis. 36, 46" /></label>
                    <label class="flex flex-col gap-1">Gigi hilang (elemen)<InputText v-model="form.gigi.gigiHilang" /></label>
                    <label class="flex flex-col gap-1">Kalkulus<InputText v-model="form.gigi.kalkulus" /></label>
                    <label class="flex flex-col gap-1">Gingiva<InputText v-model="form.gigi.gingiva" /></label>
                    <label class="flex flex-col col-span-2 gap-1">Kesan<InputText v-model="form.gigi.kesan" /></label>
                  </div>
                </fieldset>

                <!-- Kesimpulan -->
                <div v-if="aktif === 'kesimpulan'" class="flex flex-col gap-3">
                  <div class="grid grid-cols-3 gap-2">
                    <div v-for="s in detail.stasiun.filter((x: any) => x.kode !== 'kesimpulan')" :key="s.kode" class="flex items-center gap-2 text-xs">
                      <PhCheckCircle v-if="s.status === 'selesai'" :size="16" weight="fill" class="text-[#12B76A]" />
                      <PhCircle v-else :size="16" class="text-grey-300" />
                      {{ s.nama }}
                    </div>
                  </div>
                  <div class="flex gap-3 mt-2">
                    <label
                      v-for="(k, kode) in KESIMPULAN_MCU"
                      :key="kode"
                      class="flex items-center flex-1 gap-2 p-3 border rounded cursor-pointer"
                      :class="kesimpulan.kesimpulan === kode ? [k.bg, k.text, 'font-semibold'] : 'border-grey-200'"
                    >
                      <RadioButton v-model="kesimpulan.kesimpulan" :value="kode" :disabled="terkunci" /> {{ k.label }}
                    </label>
                  </div>
                  <label class="flex flex-col gap-1">Catatan / temuan bermakna
                    <TextArea v-model="kesimpulan.catatan" rows="3" autoResize :disabled="terkunci" placeholder="mis. Hipertensi grade 1, dislipidemia" />
                  </label>
                  <label class="flex flex-col gap-1">Saran / rekomendasi
                    <TextArea v-model="kesimpulan.saran" rows="3" autoResize :disabled="terkunci" placeholder="mis. Diet rendah garam, kontrol tekanan darah ke dokter" />
                  </label>
                  <label class="flex flex-col gap-1 max-w-[420px]">Dokter pemeriksa *
                    <Select v-model="kesimpulan.dokterPemeriksaUuid" :options="dokter" optionLabel="nama" optionValue="uuid" filter :disabled="terkunci" placeholder="Pilih dokter" />
                  </label>
                </div>
              </div>

              <div class="flex items-center justify-between gap-2 px-4 py-3 border-t border-grey-100">
                <span class="text-xs text-grey-400">
                  <template v-if="stasiunAktif?.petugas">Terakhir disimpan oleh {{ stasiunAktif.petugas }}</template>
                </span>
                <div class="flex gap-2">
                  <template v-if="aktif === 'kesimpulan'">
                    <span v-if="!bolehKesimpulan" class="text-xs text-grey-400">Anda tidak memiliki hak menyimpan kesimpulan.</span>
                    <CustomButton v-else-if="detail.status === 'selesai'" label="Buka Kembali" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bukaKembali" />
                    <CustomButton
                      v-else
                      label="Simpan Kesimpulan"
                      :loading="menyimpan"
                      :disabled="!kesimpulan.kesimpulan || !kesimpulan.dokterPemeriksaUuid || detail.status === 'batal'"
                      @click="simpanKesimpulan"
                    />
                  </template>
                  <span v-else-if="!bolehInput" class="text-xs text-grey-400">Anda hanya memiliki hak melihat hasil pemeriksaan.</span>
                  <template v-else-if="!terkunci">
                    <CustomButton label="Simpan Draft" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" :loading="menyimpan" @click="simpanStasiun('belum')" />
                    <CustomButton label="Simpan & Selesai" :loading="menyimpan" @click="simpanStasiun('selesai')" />
                  </template>
                  <span v-else class="text-xs text-grey-400">MCU sudah selesai — buka kembali di stasiun Kesimpulan untuk koreksi.</span>
                </div>
              </div>
            </template>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
