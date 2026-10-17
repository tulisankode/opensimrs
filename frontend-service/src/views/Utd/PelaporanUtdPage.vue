<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import {
  ALASAN_MUSNAH_UTD,
  JENIS_KOMPONEN_UTD,
  JENIS_LAPORAN_UTD,
  PARAMETER_IMLTD,
  STATUS_DISTRIBUSI_UTD,
  bentukLaporanUtd,
  bolehLihatReaktifUtd,
  cetakHtmlUtd,
  escHtml,
  izinUtd,
  keTanggal,
  laporanUtd,
  riwayatLaporanUtd,
  waktuUtd,
} from "@/stores/penunjang/utd";

// Pelaporan UTD per periode: rekap donor (kunjungan seleksi), produksi (aftap, volume, reaksi, komponen per jenis),
// uji saring IMLTD (hanya dengan izin Lihat Hasil Reaktif), distribusi per status & pemusnahan per alasan, atau
// gabungan bulanan. "Tampilkan" hanya membaca; "Bentuk & Cetak" mencatat jejak pembentukan laporan di backend lalu
// mencetaknya.
const storeUtils = utilsStore();
const bolehCetak = izinUtd("Laporan UTD", "CETAK LAPORAN");
const bolehReaktif = bolehLihatReaktifUtd();

const awalBulan = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};
const tglMulai = ref<Date | null>(awalBulan());
const tglSelesai = ref<Date | null>(new Date());
const jenis = ref("bulanan");
const opsiJenis = computed(() =>
  Object.entries(JENIS_LAPORAN_UTD)
    .filter(([k]) => bolehReaktif || k !== "uji_saring")
    .map(([value, label]) => ({ value, label })),
);

const hasil = ref<any>(null);
const riwayat = ref<any[]>([]);

const periode = () => ({ awal: keTanggal(tglMulai.value), akhir: keTanggal(tglSelesai.value ?? tglMulai.value) });
const muat = async () => {
  const { awal, akhir } = periode();
  if (!awal) return;
  storeUtils.setLoading(true);
  try {
    const [l, r] = await Promise.all([laporanUtd(jenis.value, awal, akhir), riwayatLaporanUtd()]);
    hasil.value = l?.payload ?? null;
    riwayat.value = r?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
onMounted(muat);

const donor = computed(() => hasil.value?.donor ?? null);
const produksi = computed(() => hasil.value?.produksi ?? null);
const ujiSaring = computed(() => hasil.value?.ujiSaring ?? null);
const perStatusDistribusi = computed<any[]>(() => hasil.value?.perStatusDistribusi ?? []);
const perAlasanPemusnahan = computed<any[]>(() => hasil.value?.perAlasanPemusnahan ?? []);
const adaDistribusi = computed(() => ["distribusi", "pemusnahan", "bulanan"].includes(hasil.value?.jenis));
const parameterUjiSaring = computed(() =>
  Object.entries(PARAMETER_IMLTD).map(([kode, nama]) => ({
    nama,
    reaktif: ujiSaring.value?.[`${kode}Reaktif`] ?? 0,
    nonReaktif: ujiSaring.value?.[`${kode}NonReaktif`] ?? 0,
  })),
);

// ── Bentuk (tercatat di utd_pelaporan_log) & cetak
const tabel = (judul: string, baris: [string, unknown][]) =>
  `<h2>${escHtml(judul)}</h2><table>${baris.map(([k, v]) => `<tr><th>${escHtml(k)}</th><td>${escHtml(v)}</td></tr>`).join("")}</table>`;
const bentukDanCetak = async () => {
  const { awal, akhir } = periode();
  if (!awal) return;
  storeUtils.setLoading(true);
  try {
    const res = await bentukLaporanUtd(jenis.value, awal, akhir);
    const p = res?.payload;
    if (!p) return;
    hasil.value = p;
    riwayat.value = (await riwayatLaporanUtd())?.payload ?? riwayat.value;
    let isi = `<h1>Laporan UTD — ${escHtml(JENIS_LAPORAN_UTD[p.jenis] ?? p.jenis)}</h1>
      <div class="muted">Periode ${escHtml(p.periodeAwal)} s.d. ${escHtml(p.periodeAkhir)} · dibentuk ${escHtml(waktuUtd(p.log?.createdAt))} oleh ${escHtml(p.log?.dibuatOleh ?? "-")}</div>`;
    if (p.donor)
      isi += tabel("Donor", [
        ["Jumlah donor", p.donor.jumlahDonor],
        ["Kunjungan seleksi", p.donor.jumlahKunjungan],
        ["Layak", p.donor.layak],
        ["Tunda", p.donor.tunda],
        ["Tolak", p.donor.tolak],
        ["Dalam proses", p.donor.proses],
      ]);
    if (p.produksi)
      isi += tabel("Produksi", [
        ["Jumlah aftap", p.produksi.jumlahAftap],
        ["Total volume (mL)", p.produksi.totalVolumeMl],
        ["Aftap dengan reaksi donor", p.produksi.jumlahReaksi],
        ...((p.produksi.perJenisKomponen ?? []).map((k: any) => [`Komponen ${JENIS_KOMPONEN_UTD[k.jenisKomponen] ?? k.jenisKomponen}`, k.jumlah]) as [string, unknown][]),
      ]);
    if (p.ujiSaring)
      isi += tabel("Uji Saring IMLTD", [
        ["Kantong diperiksa", p.ujiSaring.jumlahDiperiksa],
        ["Non-reaktif", p.ujiSaring.jumlahNonReaktif],
        ["Reaktif", p.ujiSaring.jumlahReaktif],
        ["Menunggu hasil", p.ujiSaring.jumlahPending],
        ...(Object.entries(PARAMETER_IMLTD).map(([k, n]) => [`${n} reaktif / non-reaktif`, `${p.ujiSaring[`${k}Reaktif`] ?? 0} / ${p.ujiSaring[`${k}NonReaktif`] ?? 0}`]) as [string, unknown][]),
      ]);
    if (p.perStatusDistribusi) isi += tabel("Distribusi per Status", p.perStatusDistribusi.map((d: any) => [STATUS_DISTRIBUSI_UTD[d.status]?.label ?? d.status, d.jumlah]));
    if (p.perAlasanPemusnahan) isi += tabel("Pemusnahan per Alasan", p.perAlasanPemusnahan.map((d: any) => [ALASAN_MUSNAH_UTD[d.alasan] ?? d.alasan, d.jumlah]));
    if (p.ujiSaringDisembunyikan) isi += `<p class="muted">Bagian uji saring IMLTD tidak disertakan (memerlukan izin Lihat Hasil Reaktif).</p>`;
    cetakHtmlUtd(`Laporan UTD ${p.periodeAwal} - ${p.periodeAkhir}`, isi);
  } finally {
    storeUtils.setLoading(false);
  }
};
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Pelaporan UTD</h1>
          <CustomSelect v-model="jenis" label="Jenis Laporan" :options="opsiJenis" optionValue="value" optionLabel="label" :showFilter="false" :clearable="false" class="w-[200px]" />
          <CustomDatePicker v-model="tglMulai" label="Periode awal" class="toolbar-field--date" :maxDate="tglSelesai ?? undefined" />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker v-model="tglSelesai" label="Periode akhir" class="toolbar-field--date" :minDate="tglMulai ?? undefined" />
          <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" @click="muat" />
          <CustomButton v-if="bolehCetak" icon="PhPrinter" label="Bentuk & Cetak" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="bentukDanCetak" />
        </PageToolbar>
      </template>
      <template #content>
        <div class="flex flex-col gap-5">
          <NoData v-if="!hasil" />
          <template v-else>
            <section v-if="donor">
              <h3 class="mb-2 text-sm font-semibold">Donor</h3>
              <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                <div class="p-3 border rounded-lg border-grey-75">
                  <div class="text-xs text-grey-400">Jumlah Donor</div>
                  <div class="text-lg font-semibold text-opensimrs-300">{{ donor.jumlahDonor ?? 0 }}</div>
                </div>
                <div class="p-3 border rounded-lg border-grey-75">
                  <div class="text-xs text-grey-400">Kunjungan Seleksi</div>
                  <div class="text-lg font-semibold">{{ donor.jumlahKunjungan ?? 0 }}</div>
                </div>
                <div class="p-3 border rounded-lg border-grey-75">
                  <div class="text-xs text-grey-400">Layak</div>
                  <div class="text-lg font-semibold text-mint-400">{{ donor.layak ?? 0 }}</div>
                </div>
                <div class="p-3 border rounded-lg border-grey-75">
                  <div class="text-xs text-grey-400">Tunda</div>
                  <div class="text-lg font-semibold">{{ donor.tunda ?? 0 }}</div>
                </div>
                <div class="p-3 border rounded-lg border-grey-75">
                  <div class="text-xs text-grey-400">Tolak</div>
                  <div class="text-lg font-semibold text-danger-300">{{ donor.tolak ?? 0 }}</div>
                </div>
                <div class="p-3 border rounded-lg border-grey-75">
                  <div class="text-xs text-grey-400">Dalam Proses</div>
                  <div class="text-lg font-semibold">{{ donor.proses ?? 0 }}</div>
                </div>
              </div>
            </section>

            <section v-if="produksi">
              <h3 class="mb-2 text-sm font-semibold">Produksi</h3>
              <div class="grid grid-cols-3 gap-3 mb-3 max-w-[760px]">
                <div class="p-3 border rounded-lg border-grey-75">
                  <div class="text-xs text-grey-400">Jumlah Aftap</div>
                  <div class="text-lg font-semibold text-opensimrs-300">{{ produksi.jumlahAftap ?? 0 }}</div>
                </div>
                <div class="p-3 border rounded-lg border-grey-75">
                  <div class="text-xs text-grey-400">Total Volume</div>
                  <div class="text-lg font-semibold">{{ produksi.totalVolumeMl ?? 0 }} mL</div>
                </div>
                <div class="p-3 border rounded-lg border-grey-75">
                  <div class="text-xs text-grey-400">Aftap dengan Reaksi Donor</div>
                  <div class="text-lg font-semibold">{{ produksi.jumlahReaksi ?? 0 }}</div>
                </div>
              </div>
              <NoData v-if="!produksi.perJenisKomponen?.length" />
              <DataTable v-else :value="produksi.perJenisKomponen" stripedRows class="text-xs max-w-[560px]">
                <Column header="Komponen" headerClass="bg-opensimrs-50">
                  <template #body="{ data: k }">{{ JENIS_KOMPONEN_UTD[k.jenisKomponen] ?? k.jenisKomponen }}</template>
                </Column>
                <Column field="jumlah" header="Jumlah Diolah" headerClass="bg-opensimrs-50" />
              </DataTable>
            </section>

            <section v-if="ujiSaring">
              <h3 class="mb-2 text-sm font-semibold">Uji Saring IMLTD</h3>
              <div class="grid grid-cols-4 gap-3 mb-3 max-w-[900px]">
                <div class="p-3 border rounded-lg border-grey-75">
                  <div class="text-xs text-grey-400">Kantong Diperiksa</div>
                  <div class="text-lg font-semibold">{{ ujiSaring.jumlahDiperiksa ?? 0 }}</div>
                </div>
                <div class="p-3 border rounded-lg border-grey-75">
                  <div class="text-xs text-grey-400">Non-Reaktif</div>
                  <div class="text-lg font-semibold text-mint-400">{{ ujiSaring.jumlahNonReaktif ?? 0 }}</div>
                </div>
                <div class="p-3 border rounded-lg border-grey-75">
                  <div class="text-xs text-grey-400">Reaktif</div>
                  <div class="text-lg font-semibold text-danger-300">{{ ujiSaring.jumlahReaktif ?? 0 }}</div>
                </div>
                <div class="p-3 border rounded-lg border-grey-75">
                  <div class="text-xs text-grey-400">Menunggu Hasil</div>
                  <div class="text-lg font-semibold">{{ ujiSaring.jumlahPending ?? 0 }}</div>
                </div>
              </div>
              <DataTable :value="parameterUjiSaring" stripedRows class="text-xs max-w-[560px]">
                <Column field="nama" header="Parameter" headerClass="bg-opensimrs-50" />
                <Column field="reaktif" header="Reaktif" headerClass="bg-opensimrs-50" />
                <Column field="nonReaktif" header="Non-Reaktif" headerClass="bg-opensimrs-50" />
              </DataTable>
            </section>
            <div v-if="hasil.ujiSaringDisembunyikan" class="text-xs text-grey-400">
              Bagian uji saring IMLTD tidak ditampilkan karena memerlukan izin Lihat Hasil Reaktif.
            </div>

            <section v-if="adaDistribusi" class="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div>
                <h3 class="mb-2 text-sm font-semibold">Distribusi per Status</h3>
                <NoData v-if="!perStatusDistribusi.length" />
                <DataTable v-else :value="perStatusDistribusi" stripedRows class="text-xs">
                  <Column header="Status" headerClass="bg-opensimrs-50">
                    <template #body="{ data: d }">{{ STATUS_DISTRIBUSI_UTD[d.status]?.label ?? d.status }}</template>
                  </Column>
                  <Column field="jumlah" header="Jumlah Komponen" headerClass="bg-opensimrs-50" />
                </DataTable>
              </div>
              <div>
                <h3 class="mb-2 text-sm font-semibold">Pemusnahan per Alasan</h3>
                <NoData v-if="!perAlasanPemusnahan.length" />
                <DataTable v-else :value="perAlasanPemusnahan" stripedRows class="text-xs">
                  <Column header="Alasan" headerClass="bg-opensimrs-50">
                    <template #body="{ data: d }">{{ ALASAN_MUSNAH_UTD[d.alasan] ?? d.alasan }}</template>
                  </Column>
                  <Column field="jumlah" header="Jumlah" headerClass="bg-opensimrs-50" />
                </DataTable>
              </div>
            </section>
          </template>

          <section>
            <h3 class="mb-2 text-sm font-semibold">Riwayat Pembentukan Laporan (100 terakhir)</h3>
            <NoData v-if="!riwayat.length" />
            <DataTable v-else :value="riwayat" stripedRows class="text-xs" paginator :rows="10">
              <Column header="Waktu" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ waktuUtd(r.createdAt) }}</template>
              </Column>
              <Column header="Jenis" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ JENIS_LAPORAN_UTD[r.jenisLaporan] ?? r.jenisLaporan }}</template>
              </Column>
              <Column header="Periode" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ r.parameter?.periodeAwal ?? waktuUtd(r.periodeAwal, true) }} s.d. {{ r.parameter?.periodeAkhir ?? waktuUtd(r.periodeAkhir, true) }}</template>
              </Column>
              <Column header="Oleh" headerClass="bg-opensimrs-50">
                <template #body="{ data: r }">{{ r.dibuatOleh ?? "-" }}</template>
              </Column>
            </DataTable>
          </section>
        </div>
      </template>
    </Card>
  </div>
</template>
