<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import * as XLSX from "xlsx";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  JENIS_INDIKATOR,
  STATUS_CAPAIAN,
  STATUS_TINDAK_LANJUT,
  bulanIni,
  bulanMundur,
  capaianTeks,
  dasborIndikator,
  gayaCapaian,
  izinIndikator,
  labelPeriode,
  laporanIndikator,
  opsi,
  opsiBulan,
  opsiTriwulan,
  referensiIndikator,
  targetTeks,
  trenIndikator,
} from "@/stores/penunjang/mutu";

// Dasbor capaian Indikator Mutu (STD-0025): capaian bulanan/triwulanan setiap indikator aktif terhadap target & arah,
// kelengkapan data (data belum lengkap tidak dinyatakan tercapai), data yang menunggu validasi, dan penanda indikator
// tidak tercapai yang belum punya tindak lanjut. Klik baris → tren 12 bulan/8 triwulan + rincian per unit. Ekspor
// Excel 12 bulan terakhir (sampai periode terpilih) disusun di klien dari data backend (izin EKSPOR).
const storeUtils = utilsStore();
const router = useRouter();
const boleh = izinIndikator;

const jenisPeriode = ref<"bulanan" | "triwulan">("bulanan");
const periode = ref(bulanIni());
const filterJenis = ref("");
const filterUnit = ref("");
const unit = ref<any[]>([]);
const data = ref<any>(null);
const OPSI_JENIS_PERIODE = [
  { value: "bulanan", label: "Bulanan" },
  { value: "triwulan", label: "Triwulan" },
];
const OPSI_JENIS = opsi(JENIS_INDIKATOR);
const opsiPeriode = computed(() => (jenisPeriode.value === "triwulan" ? opsiTriwulan(8) : opsiBulan(24)));
const opsiUnit = computed(() => unit.value.map((u: any) => ({ value: u.uuid, label: u.nama })));

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const res = await dasborIndikator({ periode: periode.value, jenis: filterJenis.value, unitUuid: filterUnit.value });
    if (res?.payload) data.value = res.payload;
  } finally {
    storeUtils.setLoading(false);
  }
};
const gantiJenisPeriode = () => {
  periode.value = opsiPeriode.value[0].value;
  muat();
};
const r = computed(() => data.value?.ringkasan ?? {});
const kartu = computed(() => [
  { label: "Indikator aktif", nilai: r.value.totalIndikator ?? 0, warna: "text-opensimrs-300" },
  { label: "Tercapai", nilai: r.value.tercapai ?? 0, warna: "text-success-300" },
  { label: "Tidak tercapai", nilai: r.value.tidakTercapai ?? 0, warna: r.value.tidakTercapai ? "text-danger-300" : "text-success-300" },
  { label: "Data belum lengkap", nilai: r.value.belumLengkap ?? 0, warna: r.value.belumLengkap ? "text-warning-300" : "text-success-300" },
  { label: "Target belum ditetapkan", nilai: r.value.tanpaTarget ?? 0, warna: "text-grey-400" },
  { label: "Menunggu validasi", nilai: r.value.menungguValidasi ?? 0, warna: r.value.menungguValidasi ? "text-warning-300" : "text-success-300" },
  { label: "Perlu tindak lanjut", nilai: r.value.perluTindakLanjut ?? 0, warna: r.value.perluTindakLanjut ? "text-danger-300" : "text-success-300" },
]);

// ── Tren per indikator
const dialogTren = ref(false);
const tren = ref<any>(null);
const pilih = ref<any>(null);
const bukaTren = async (ind: any) => {
  pilih.value = ind;
  storeUtils.setLoading(true);
  try {
    const triwulan = jenisPeriode.value === "triwulan";
    const sampai = triwulan ? `${periode.value.slice(0, 4)}-${String(Number(periode.value.slice(-1)) * 3).padStart(2, "0")}` : periode.value;
    const res = await trenIndikator(ind.uuid, { dari: bulanMundur(sampai, triwulan ? 24 : 12), sampai, per: triwulan ? "triwulan" : "bulan", unitUuid: filterUnit.value });
    if (res?.payload) {
      tren.value = res.payload;
      dialogTren.value = true;
    }
  } finally {
    storeUtils.setLoading(false);
  }
};
const WARNA_UNIT = ["#7F56D9", "#F79009", "#12B76A", "#F04438", "#667085", "#0BA5EC"];
const dataGrafik = computed(() => {
  const t = tren.value;
  if (!t) return { labels: [], datasets: [] };
  const labels = t.deret.map((d: any) => labelPeriode(d.periode));
  const target = t.indikator.targetNilai === null || t.indikator.targetNilai === undefined ? null : Number(t.indikator.targetNilai);
  return {
    labels,
    datasets: [
      { label: "Capaian (tervalidasi)", data: t.deret.map((d: any) => d.capaian), borderColor: "#175CD3", backgroundColor: "#175CD3", tension: 0.2, spanGaps: true },
      ...(target === null ? [] : [{ label: `Target (${targetTeks(target, t.indikator.arah, t.indikator.satuan)})`, data: labels.map(() => target), borderColor: "#B42318", borderDash: [6, 4], pointRadius: 0 }]),
      ...(t.perUnit.length > 1
        ? t.perUnit.slice(0, WARNA_UNIT.length).map((u: any, i: number) => ({ label: u.unitNama, data: u.deret.map((d: any) => d.capaian), borderColor: WARNA_UNIT[i], backgroundColor: WARNA_UNIT[i], borderWidth: 1, tension: 0.2, spanGaps: true }))
        : []),
    ],
  };
});
const opsiGrafik = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } };
const catatTindakLanjut = (ind: any) => router.push({ path: "/mutu/indikator/tindak-lanjut", query: { indikator: ind.uuid, periode: data.value?.periode?.kode, baru: 1 } });

// ── Ekspor Excel
const ekspor = async () => {
  const triwulan = jenisPeriode.value === "triwulan";
  const sampai = triwulan ? `${periode.value.slice(0, 4)}-${String(Number(periode.value.slice(-1)) * 3).padStart(2, "0")}` : periode.value;
  const dari = bulanMundur(sampai, 12);
  storeUtils.setLoading(true);
  try {
    const res = await laporanIndikator({ dari, sampai, jenis: filterJenis.value, unitUuid: filterUnit.value });
    const p = res?.payload;
    if (!p) return;
    const baris = (x: any) => ({
      Periode: labelPeriode(x.periode),
      Kode: x.kode,
      Indikator: x.judul,
      ...(x.unitNama !== undefined ? { Unit: x.unitNama } : { Jenis: JENIS_INDIKATOR[x.jenis] ?? x.jenis }),
      Target: targetTeks(x.targetNilai, x.arah, x.satuan),
      Numerator: x.numerator,
      Denominator: x.denominator,
      Capaian: capaianTeks(x.capaian, x.satuan),
      "Hari/Bulan Terisi": `${x.terisi}/${x.diharapkan}`,
      Status: STATUS_CAPAIAN[x.status]?.label ?? x.status,
    });
    const buku = XLSX.utils.book_new();
    const lembar = (isi: any[], nama: string) => XLSX.utils.book_append_sheet(buku, XLSX.utils.json_to_sheet(isi.length ? isi : [{ Keterangan: "Tidak ada data" }]), nama);
    lembar(p.capaian.map(baris), "Capaian");
    lembar(p.capaianUnit.map(baris), "Capaian per Unit");
    lembar(
      p.tindakLanjut.map((t: any) => ({
        Periode: labelPeriode(t.periode),
        Kode: t.kode,
        Indikator: t.judul,
        Unit: t.unitNama || "Tingkat faskes",
        Capaian: t.capaian,
        Target: t.targetNilai,
        Analisis: t.analisis,
        Rencana: t.rencana,
        "Penanggung Jawab": t.penanggungJawab,
        Tenggat: t.tenggat ? new Date(t.tenggat * 1000).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" }) : "",
        Status: STATUS_TINDAK_LANJUT[t.status]?.label ?? t.status,
        "Hasil Evaluasi": t.hasilEvaluasi ?? "",
      })),
      "Tindak Lanjut",
    );
    XLSX.writeFile(buku, `indikator-mutu-${p.dari}-sd-${p.sampai}.xlsx`);
  } finally {
    storeUtils.setLoading(false);
  }
};

onMounted(async () => {
  const res = await referensiIndikator();
  unit.value = res?.payload?.unit ?? [];
  muat();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Capaian Indikator Mutu</h1>
          <CustomSelect v-model="jenisPeriode" label="Periode" :options="OPSI_JENIS_PERIODE" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" @update:modelValue="gantiJenisPeriode" />
          <CustomSelect v-model="periode" :label="jenisPeriode === 'triwulan' ? 'Triwulan' : 'Bulan'" :options="opsiPeriode" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" @update:modelValue="muat" />
          <CustomSelect v-model="filterJenis" label="Jenis" placeHolder="Semua" :options="OPSI_JENIS" optionValue="value" optionLabel="label" :showFilter="false" @update:modelValue="muat" />
          <CustomSelect v-model="filterUnit" label="Unit" placeHolder="Semua unit" :options="opsiUnit" optionValue="value" optionLabel="label" @update:modelValue="muat" />
          <CustomButton v-if="boleh('EKSPOR')" icon="PhFileXls" label="Ekspor Excel" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="ekspor" />
        </PageToolbar>
      </template>
      <template #content>
        <div v-if="data" class="flex flex-col gap-5 pb-4">
          <div class="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            <div v-for="k in kartu" :key="k.label" class="p-3 border rounded-lg border-grey-100">
              <div class="text-xs text-grey-400">{{ k.label }}</div>
              <div class="text-2xl font-bold" :class="k.warna">{{ k.nilai }}</div>
            </div>
          </div>
          <div v-if="!data.indikator.length" class="p-4 text-sm border rounded-lg text-grey-400 border-grey-100">
            Belum ada indikator aktif. Tambahkan indikator atau pasang set INM bawaan di menu
            <button class="underline text-opensimrs-300" @click="router.push('/mutu/indikator/master')">Master Indikator</button>.
          </div>
          <DataTable v-else :value="data.indikator" stripedRows class="text-xs cursor-pointer" tableStyle="min-width: 64rem" @rowClick="bukaTren($event.data)">
            <Column header="Indikator" headerClass="bg-opensimrs-50">
              <template #body="{ data: d }">
                <div class="font-semibold">{{ d.kode }} <span class="font-normal text-grey-400">{{ JENIS_INDIKATOR[d.jenis] }}</span></div>
                <div>{{ d.judul }}</div>
              </template>
            </Column>
            <Column header="Target" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ targetTeks(d.targetNilai, d.arah, d.satuan) }}</template></Column>
            <Column header="Capaian" headerClass="bg-opensimrs-50">
              <template #body="{ data: d }">
                <div class="text-sm font-bold">{{ capaianTeks(d.capaian, d.satuan) }}</div>
                <div class="text-grey-400">{{ d.numerator }} / {{ d.denominator }}</div>
              </template>
            </Column>
            <Column header="Kelengkapan" headerClass="bg-opensimrs-50">
              <template #body="{ data: d }">
                {{ d.terisi }}/{{ d.diharapkan }} {{ d.frekuensi === "harian" ? "hari" : "bulan" }}
                <div v-if="!d.lengkap" class="text-[10px] text-warning-300">belum lengkap</div>
              </template>
            </Column>
            <Column header="Status" headerClass="bg-opensimrs-50">
              <template #body="{ data: d }">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap" :class="[gayaCapaian(d.status).bg, gayaCapaian(d.status).text]">{{ gayaCapaian(d.status).label }}</span>
              </template>
            </Column>
            <Column header="Menunggu" headerClass="bg-opensimrs-50">
              <template #body="{ data: d }">
                <span v-if="d.menungguValidasi" class="text-warning-300">{{ d.menungguValidasi }} validasi</span>
                <span v-if="d.draf" class="block text-grey-400">{{ d.draf }} draf</span>
                <span v-if="!d.menungguValidasi && !d.draf">-</span>
              </template>
            </Column>
            <Column header="Tindak Lanjut" headerClass="bg-opensimrs-50">
              <template #body="{ data: d }">
                <span v-if="d.jumlahTindakLanjut">{{ d.jumlahTindakLanjut }} dicatat</span>
                <span v-else-if="d.perluTindakLanjut" class="font-semibold text-danger-300">Perlu dicatat</span>
                <span v-else>-</span>
              </template>
            </Column>
          </DataTable>
          <div class="text-[11px] text-grey-400">
            Capaian dihitung dari data tervalidasi: Σ numerator ÷ Σ denominator (× 100 untuk persen) pada {{ labelPeriode(data.periode?.kode) }}. Indikator dengan data belum lengkap atau tanpa target tidak dinyatakan tercapai/tidak tercapai.
          </div>
        </div>
      </template>
    </Card>

    <CustomDialog v-model:visible="dialogTren" width="900px">
      <template #header>Tren {{ pilih?.kode }} — {{ pilih?.judul }}</template>
      <template #body>
        <div v-if="tren" class="flex flex-col gap-4 pt-4 text-sm">
          <div class="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <div class="col-span-2"><span class="text-grey-400">Definisi:</span> {{ tren.indikator.definisiOperasional }}</div>
            <div><span class="text-grey-400">Numerator:</span> {{ tren.indikator.definisiNumerator }}</div>
            <div><span class="text-grey-400">Denominator:</span> {{ tren.indikator.definisiDenominator }}</div>
            <div><span class="text-grey-400">Target:</span> {{ targetTeks(tren.indikator.targetNilai, tren.indikator.arah, tren.indikator.satuan) }}</div>
            <div v-if="tren.indikator.regulasiAcuan"><span class="text-grey-400">Acuan:</span> {{ tren.indikator.regulasiAcuan }}</div>
          </div>
          <div v-if="tren.deret.some((d: any) => d.capaian !== null)" class="h-[260px]"><Chart type="line" :data="dataGrafik" :options="opsiGrafik" class="h-full" /></div>
          <NoData v-else />
          <DataTable :value="tren.deret" class="text-xs" size="small">
            <Column header="Periode" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ labelPeriode(d.periode) }}</template></Column>
            <Column header="Num / Den" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.numerator }} / {{ d.denominator }}</template></Column>
            <Column header="Capaian" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ capaianTeks(d.capaian, tren.indikator.satuan) }}</template></Column>
            <Column header="Terisi" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.terisi }}/{{ d.diharapkan }}</template></Column>
            <Column header="Status" headerClass="bg-opensimrs-50">
              <template #body="{ data: d }"><span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="[gayaCapaian(d.status).bg, gayaCapaian(d.status).text]">{{ gayaCapaian(d.status).label }}</span></template>
            </Column>
          </DataTable>
          <div v-if="pilih?.unit?.length">
            <h3 class="mb-1 font-semibold">Rincian per Unit — {{ labelPeriode(data?.periode?.kode) }}</h3>
            <div v-for="u in pilih.unit" :key="u.unitUuid ?? '-'" class="flex justify-between py-0.5 text-xs border-b border-grey-100">
              <span>{{ u.unitNama }}</span>
              <span>{{ u.numerator }} / {{ u.denominator }} · <b>{{ capaianTeks(u.capaian, pilih.satuan) }}</b> · {{ gayaCapaian(u.status).label }}</span>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <CustomButton v-if="boleh('READ')" label="Lihat Data" icon="PhClipboardText" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="router.push({ path: '/mutu/indikator/data', query: { indikator: pilih.uuid } })" />
          <CustomButton v-if="boleh('TINDAK LANJUT')" label="Catat Tindak Lanjut" icon="PhNotePencil" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="catatTindakLanjut(pilih)" />
          <CustomButton label="Tutup" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="dialogTren = false" />
        </div>
      </template>
    </CustomDialog>
  </div>
</template>
