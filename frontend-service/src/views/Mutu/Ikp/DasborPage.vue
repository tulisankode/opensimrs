<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import * as XLSX from "xlsx";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import { utilsStore } from "@/stores/utils";
import {
  GRADE_IKP,
  JENIS_INSIDEN,
  SINGKAT_JENIS,
  STATUS_LAPORAN_IKP,
  STATUS_TL_IKP,
  URUTAN_GRADE,
  bulanIni,
  bulanMundur,
  dasborIkp,
  eksporIkp,
  gayaGrade,
  izinIkp,
  jamTeks,
  labelPeriode,
  opsiBulan,
  referensiIkp,
  waktuIkp,
} from "@/stores/penunjang/mutu";

// Dasbor & tren Insiden Keselamatan Pasien (STD-0026, izin DASBOR): jumlah per jenis/grade/unit/kelompok/status,
// ketepatan waktu pelaporan (sasaran 2 × 24 jam), tren bulanan, status investigasi & tindak lanjut, serta daftar
// pengingat batas waktu di dalam aplikasi. Tanpa identitas pelapor & data pasien. Ekspor Excel = rekap internal
// (izin EKSPOR); format pelaporan nasional belum disediakan karena spesifikasi resminya belum ditetapkan.
const storeUtils = utilsStore();
const router = useRouter();
const OPSI_BULAN = opsiBulan(36);
const sampai = ref(bulanIni());
const dari = ref(bulanMundur(bulanIni(), 12));
const unitUuid = ref("");
const referensi = ref<any>({ unit: [], kategoriInsiden: [] });
const opsiUnit = computed(() => (referensi.value.unit ?? []).map((u: any) => ({ value: u.uuid, label: u.nama })));
const d = ref<any>(null);
const galat = ref("");

const muat = async () => {
  galat.value = "";
  if (dari.value > sampai.value) return (galat.value = "Bulan awal tidak boleh setelah bulan akhir");
  storeUtils.setLoading(true);
  try {
    const res = await dasborIkp({ dari: dari.value, sampai: sampai.value, unitUuid: unitUuid.value });
    d.value = res?.payload ?? null;
  } finally {
    storeUtils.setLoading(false);
  }
};
const jumlah = (daftar: any[], kunci: string) => (daftar ?? []).find((x: any) => x.kunci === kunci)?.jumlah ?? 0;
const maks = (daftar: any[]) => Math.max(1, ...(daftar ?? []).map((x: any) => Number(x.jumlah ?? x.total) || 0));
const lebar = (n: number, m: number) => `${Math.round((n / m) * 100)}%`;
const namaKategori = (k: string) => (k === "tanpa_kategori" ? "Tanpa kelompok" : (referensi.value.kategoriInsiden ?? []).find((x: any) => x.kode === k)?.nama ?? k);
const ringkasTl = computed(() => {
  const t = d.value?.tindakLanjut ?? [];
  return { total: t.reduce((s: number, x: any) => s + x.jumlah, 0), terlambat: t.reduce((s: number, x: any) => s + x.terlambat, 0), per: t };
});
const ringkasInv = computed(() => {
  const i = d.value?.investigasi ?? [];
  const n = (f: (x: any) => boolean) => i.filter(f).reduce((s: number, x: any) => s + x.jumlah, 0);
  return {
    belum: n((x) => x.status === "belum"),
    berjalan: n((x) => x.status === "berjalan"),
    selesai: n((x) => x.status === "selesai"),
    rca: n((x) => x.jenis === "rca"),
    terlambat: i.reduce((s: number, x: any) => s + x.terlambat, 0),
  };
});
const PERHATIAN: Record<string, string> = {
  belum_diterima: "Belum diterima unit",
  investigasi_mendekati: "Investigasi mendekati batas",
  investigasi_terlambat: "Investigasi lewat batas",
  tindak_lanjut_terlambat: "Tindak lanjut lewat tenggat",
};

// ── Ekspor Excel rekap internal
const ekspor = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await eksporIkp({ dari: dari.value, sampai: sampai.value, unitUuid: unitUuid.value });
    const baris = res?.payload?.baris;
    if (!baris) return;
    const label = (daftar: any[], k?: string | null) => (daftar ?? []).find((x: any) => x.kode === k)?.nama ?? k ?? "";
    const buku = XLSX.utils.book_new();
    const lembar = (isi: any[], nama: string) => XLSX.utils.book_append_sheet(buku, XLSX.utils.json_to_sheet(isi.length ? isi : [{ Keterangan: "Tidak ada data" }]), nama);
    lembar(
      baris.map((b: any) => ({
        Nomor: b.nomor,
        "Waktu Kejadian (WIB)": waktuIkp(b.waktuKejadian),
        "Waktu Diketahui (WIB)": waktuIkp(b.waktuDiketahui),
        "Waktu Lapor (WIB)": waktuIkp(b.waktuLapor),
        "Lapor Terlambat": b.terlambatLapor ? "Ya" : "Tidak",
        Jenis: SINGKAT_JENIS[b.jenisInsiden] ?? b.jenisInsiden,
        Kelompok: label(referensi.value.kategoriInsiden, b.kategoriInsiden),
        Layanan: label(referensi.value.layanan, b.layanan),
        Unit: b.unitNama ?? "",
        Akibat: label(referensi.value.akibat, b.akibat),
        Grade: b.grade ? gayaGrade(b.grade).label : "Belum",
        Skor: b.skor ?? "",
        Status: STATUS_LAPORAN_IKP[b.status]?.label ?? b.status,
        Investigasi: b.jenisInvestigasi === "rca" ? "RCA" : b.jenisInvestigasi === "sederhana" ? "Sederhana" : "",
        "Status Investigasi": b.statusInvestigasi ?? "",
        "Tindak Lanjut": b.jumlahTindakLanjut,
        "Tindak Lanjut Terverifikasi": b.tindakLanjutTerverifikasi,
        Pelapor: b.anonim ? "Anonim" : "Tercatat",
      })),
      "Laporan",
    );
    // Rekap jenis × grade (internal).
    lembar(
      Object.keys(JENIS_INSIDEN).map((j) => ({
        Jenis: SINGKAT_JENIS[j],
        ...Object.fromEntries([...URUTAN_GRADE, "belum"].map((g) => [g === "belum" ? "Belum digrading" : GRADE_IKP[g].label, baris.filter((b: any) => b.jenisInsiden === j && (b.grade ?? "belum") === g).length])),
        Total: baris.filter((b: any) => b.jenisInsiden === j).length,
      })),
      "Jenis x Grade",
    );
    lembar((d.value?.trenJenis ?? []).map((t: any) => ({ Bulan: labelPeriode(t.bulan), ...Object.fromEntries(Object.keys(JENIS_INSIDEN).map((j) => [SINGKAT_JENIS[j], t[j]])), Total: t.total })), "Tren");
    XLSX.writeFile(buku, `rekap-ikp-${dari.value}-sd-${sampai.value}.xlsx`);
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(async () => {
  const r = await referensiIkp();
  if (r?.payload) referensi.value = r.payload;
  muat();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Dasbor Insiden Keselamatan Pasien</h1>
          <CustomSelect v-model="dari" label="Dari" :options="OPSI_BULAN" optionValue="value" optionLabel="label" :clearable="false" @update:modelValue="muat" />
          <CustomSelect v-model="sampai" label="Sampai" :options="OPSI_BULAN" optionValue="value" optionLabel="label" :clearable="false" @update:modelValue="muat" />
          <CustomSelect v-model="unitUuid" label="Unit" placeHolder="Semua" :options="opsiUnit" optionValue="value" optionLabel="label" @update:modelValue="muat" />
          <CustomButton v-if="izinIkp('EKSPOR')" icon="PhFileXls" label="Ekspor Excel" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="ekspor" />
        </PageToolbar>
      </template>
      <template #content>
        <div v-if="galat" class="mb-3 text-sm text-danger-300">{{ galat }}</div>
        <div v-if="d" class="flex flex-col gap-4 text-sm">
          <div class="grid grid-cols-6 gap-3">
            <div class="p-3 border rounded-lg border-grey-75"><div class="text-xs text-grey-400">Total Laporan</div><div class="text-lg font-semibold text-opensimrs-300">{{ d.ringkasan.total }}</div></div>
            <div class="p-3 border rounded-lg border-grey-75"><div class="text-xs text-grey-400">Sentinel</div><div class="text-lg font-semibold text-[#B42318]">{{ d.ringkasan.sentinel }}</div></div>
            <div class="p-3 border rounded-lg border-grey-75"><div class="text-xs text-grey-400">Risiko Kuning/Merah</div><div class="text-lg font-semibold text-[#B54708]">{{ d.ringkasan.risikoTinggi }}</div></div>
            <div class="p-3 border rounded-lg border-grey-75"><div class="text-xs text-grey-400">Belum Digrading</div><div class="text-lg font-semibold">{{ d.ringkasan.belumDigrading }}</div></div>
            <div class="p-3 border rounded-lg border-grey-75">
              <div class="text-xs text-grey-400">Tepat Waktu (≤ {{ d.ringkasan.tenggatLaporJam }} jam)</div>
              <div class="text-lg font-semibold">{{ d.ringkasan.persenTepatWaktu === null ? "-" : `${d.ringkasan.persenTepatWaktu.toLocaleString("id-ID")}%` }}</div>
              <div class="text-xs text-grey-400">{{ d.ringkasan.terlambatLapor }} terlambat</div>
            </div>
            <div class="p-3 border rounded-lg border-grey-75"><div class="text-xs text-grey-400">Median Waktu Lapor</div><div class="text-lg font-semibold">{{ jamTeks(d.ringkasan.medianJamPelaporan) }}</div></div>
          </div>
          <div v-if="!d.pengingatLengkap" class="p-2 text-xs rounded bg-[#FEF0C7] text-[#B54708]">
            Konfigurasi pengingat (penerima & kanal) belum lengkap — sistem tidak mengirim pengingat otomatis dan tidak menetapkan penerima sendiri. Pantau daftar "Perlu Perhatian" di bawah.
          </div>

          <div class="grid grid-cols-3 gap-4">
            <div class="p-3 border rounded-lg border-grey-75">
              <div class="mb-2 font-semibold">Per Jenis</div>
              <div v-for="(nama, k) in SINGKAT_JENIS" :key="k" class="flex items-center gap-2 py-0.5 text-xs">
                <span class="w-16">{{ nama }}</span>
                <div class="h-3 rounded bg-opensimrs-300" :style="{ width: lebar(jumlah(d.perJenis, String(k)), maks(d.perJenis)) }"></div>
                <span>{{ jumlah(d.perJenis, String(k)) }}</span>
              </div>
            </div>
            <div class="p-3 border rounded-lg border-grey-75">
              <div class="mb-2 font-semibold">Per Grade</div>
              <div v-for="g in [...URUTAN_GRADE, 'belum']" :key="g" class="flex items-center gap-2 py-0.5 text-xs">
                <span class="w-24">{{ gayaGrade(g === "belum" ? null : g).label }}</span>
                <div class="h-3 rounded" :class="gayaGrade(g === 'belum' ? null : g).sel || 'bg-grey-200'" :style="{ width: lebar(jumlah(d.perGrade, g), maks(d.perGrade)) }"></div>
                <span>{{ jumlah(d.perGrade, g) }}</span>
              </div>
            </div>
            <div class="p-3 border rounded-lg border-grey-75">
              <div class="mb-2 font-semibold">Per Status</div>
              <div v-for="(s, k) in STATUS_LAPORAN_IKP" :key="k" class="flex items-center gap-2 py-0.5 text-xs">
                <span class="w-28">{{ s.label }}</span>
                <div class="h-3 rounded bg-opensimrs-300" :style="{ width: lebar(jumlah(d.perStatus, String(k)), maks(d.perStatus)) }"></div>
                <span>{{ jumlah(d.perStatus, String(k)) }}</span>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="p-3 border rounded-lg border-grey-75">
              <div class="mb-2 font-semibold">Per Unit</div>
              <div v-if="!d.perUnit.length" class="text-xs text-grey-400">Tidak ada data.</div>
              <div v-for="u in d.perUnit" :key="u.kunci" class="flex items-center gap-2 py-0.5 text-xs">
                <span class="truncate w-40">{{ u.nama || "-" }}</span>
                <div class="h-3 rounded bg-opensimrs-300" :style="{ width: lebar(u.jumlah, maks(d.perUnit)) }"></div>
                <span>{{ u.jumlah }}<template v-if="u.risikoTinggi"> ({{ u.risikoTinggi }} risiko tinggi)</template></span>
              </div>
            </div>
            <div class="p-3 border rounded-lg border-grey-75">
              <div class="mb-2 font-semibold">Per Kelompok Insiden</div>
              <div v-if="!d.perKategori.length" class="text-xs text-grey-400">Tidak ada data.</div>
              <div v-for="k in d.perKategori" :key="k.kunci" class="flex items-center gap-2 py-0.5 text-xs">
                <span class="truncate w-40">{{ namaKategori(k.kunci) }}</span>
                <div class="h-3 rounded bg-opensimrs-300" :style="{ width: lebar(k.jumlah, maks(d.perKategori)) }"></div>
                <span>{{ k.jumlah }}</span>
              </div>
            </div>
          </div>

          <div class="p-3 border rounded-lg border-grey-75">
            <div class="mb-2 font-semibold">Tren Bulanan per Jenis</div>
            <DataTable :value="d.trenJenis" class="text-xs" scrollable>
              <Column header="Bulan"><template #body="{ data: t }">{{ labelPeriode(t.bulan) }}</template></Column>
              <Column v-for="(nama, k) in SINGKAT_JENIS" :key="k" :header="nama"><template #body="{ data: t }">{{ t[k] }}</template></Column>
              <Column header="Total">
                <template #body="{ data: t }">
                  <div class="flex items-center gap-2"><div class="h-2 rounded bg-opensimrs-300" :style="{ width: `${Math.round((t.total / maks(d.trenJenis)) * 80)}px` }"></div>{{ t.total }}</div>
                </template>
              </Column>
              <Column header="Kuning/Merah">
                <template #body="{ data: t }">{{ (d.trenGrade.find((g: any) => g.bulan === t.bulan)?.kuning ?? 0) + (d.trenGrade.find((g: any) => g.bulan === t.bulan)?.merah ?? 0) }}</template>
              </Column>
            </DataTable>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="p-3 border rounded-lg border-grey-75">
              <div class="mb-2 font-semibold">Investigasi (laporan tergrading)</div>
              <div class="text-xs">Belum dimulai: {{ ringkasInv.belum }} · Berjalan: {{ ringkasInv.berjalan }} · Selesai: {{ ringkasInv.selesai }} · RCA: {{ ringkasInv.rca }}</div>
              <div class="text-xs" :class="ringkasInv.terlambat ? 'text-danger-300 font-semibold' : ''">Lewat batas waktu: {{ ringkasInv.terlambat }}</div>
            </div>
            <div class="p-3 border rounded-lg border-grey-75">
              <div class="mb-2 font-semibold">Tindak Lanjut</div>
              <div class="text-xs">
                Total {{ ringkasTl.total }} ·
                <template v-for="(s, k) in STATUS_TL_IKP" :key="k">{{ s.label }}: {{ ringkasTl.per.find((x: any) => x.status === k)?.jumlah ?? 0 }} · </template>
              </div>
              <div class="text-xs" :class="ringkasTl.terlambat ? 'text-danger-300 font-semibold' : ''">Lewat tenggat: {{ ringkasTl.terlambat }}</div>
            </div>
          </div>

          <div class="p-3 border rounded-lg border-grey-75">
            <div class="mb-2 font-semibold">Perlu Perhatian (batas waktu)</div>
            <div v-if="!d.perhatian.length" class="text-xs text-grey-400">Tidak ada laporan yang mendekati atau melewati batas waktu.</div>
            <div v-for="(p, i) in d.perhatian" :key="i" class="flex gap-3 py-0.5 text-xs">
              <a class="cursor-pointer text-opensimrs-300" @click="router.push({ path: '/mutu/ikp', query: { laporan: p.uuid } })">{{ p.nomor }}</a>
              <span>{{ p.unitNama || "-" }}</span>
              <span :class="p.jenis.endsWith('terlambat') ? 'text-danger-300' : 'text-[#B54708]'">{{ PERHATIAN[p.jenis] ?? p.jenis }}</span>
              <span class="text-grey-400">{{ waktuIkp(p.batas) }}</span>
            </div>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
