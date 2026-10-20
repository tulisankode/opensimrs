<script setup lang="ts">
import { computed, ref, watch, onMounted } from "vue";
import * as XLSX from "xlsx";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { bukaPdf } from "@/utils/pdf/bukaPdf";
import { epochHari, izinAkuntansi, laporanAkuntansi, rupiah, tanggalAk } from "@/stores/penunjang/akuntansi";

// Laporan keuangan dari jurnal final (KF-14/KF-15): neraca, laba rugi/laporan operasional, arus kas (langsung & tidak
// langsung), perubahan ekuitas, aging piutang per penjamin, aging utang per supplier. Ekspor Excel/PDF dibuat di
// klien dari data yang sama; permintaan data ekspor membawa ?ekspor= sehingga izin EKSPOR diperiksa & tercatat di
// Audit Trail. Format mengikuti struktur umum SAK; format resmi BLUD/RS swasta perlu disahkan bagian keuangan.
const storeUtils = utilsStore();
const bolehEkspor = izinAkuntansi("Laporan Keuangan", "EKSPOR");
const tab = ref("neraca");
const kini = new Date();
const dari = ref<Date | null>(new Date(kini.getFullYear(), 0, 1));
const sampai = ref<Date | null>(kini);
const hasil = ref<Record<string, any>>({});
const JUDUL: Record<string, string> = {
  neraca: "Neraca (Laporan Posisi Keuangan)",
  "laba-rugi": "Laba Rugi / Laporan Operasional",
  "arus-kas": "Arus Kas",
  "perubahan-ekuitas": "Perubahan Ekuitas",
  "aging-piutang": "Aging Piutang per Penjamin",
  "aging-utang": "Aging Utang per Supplier",
};
const PER_TANGGAL = ["neraca", "aging-piutang", "aging-utang"];
const parameter = () => (PER_TANGGAL.includes(tab.value) ? { per: epochHari(sampai.value) } : { dari: epochHari(dari.value), sampai: epochHari(sampai.value) });
const muat = async (ekspor?: string) => {
  storeUtils.setLoading(true);
  try {
    const r = await laporanAkuntansi(tab.value, { ...parameter(), ekspor });
    if (r?.payload) hasil.value = { ...hasil.value, [tab.value]: r.payload };
    return r?.payload;
  } finally {
    storeUtils.setLoading(false);
  }
};
watch(tab, () => muat());
const kini_ = computed(() => hasil.value[tab.value]);
const keterangan = computed(() => (PER_TANGGAL.includes(tab.value) ? `Per ${tanggalAk(epochHari(sampai.value))}` : `${tanggalAk(epochHari(dari.value))} s.d. ${tanggalAk(epochHari(sampai.value))}`));

// Baris laporan [label, nilai, gaya] untuk tampilan & ekspor (satu sumber).
type Baris = [string, string | null, "judul" | "sub" | "total" | ""];
const grup = (daftar: any[], hasilBaris: Baris[]) => {
  for (const g of daftar ?? []) {
    hasilBaris.push([g.nama, null, "sub"]);
    for (const a of g.akun) hasilBaris.push([`    ${a.kode} ${a.nama}`, a.nilai, ""]);
    hasilBaris.push([`Jumlah ${g.nama}`, g.total, "total"]);
  }
};
const baris = computed<Baris[]>(() => {
  const d = kini_.value;
  if (!d) return [];
  const b: Baris[] = [];
  if (tab.value === "neraca") {
    b.push(["ASET", null, "judul"]);
    grup(d.aset, b);
    b.push(["JUMLAH ASET", d.totalAset, "total"]);
    b.push(["KEWAJIBAN", null, "judul"]);
    grup(d.kewajiban, b);
    b.push(["JUMLAH KEWAJIBAN", d.totalKewajiban, "total"]);
    b.push(["EKUITAS", null, "judul"]);
    grup(d.ekuitas, b);
    b.push(["    Surplus/defisit tahun-tahun lalu", d.surplusTahunLalu, ""]);
    b.push(["    Surplus/defisit tahun berjalan", d.surplusTahunBerjalan, ""]);
    b.push(["JUMLAH EKUITAS", d.totalEkuitas, "total"]);
    b.push(["JUMLAH KEWAJIBAN & EKUITAS", String(Number(d.totalKewajiban) + Number(d.totalEkuitas)), "total"]);
  } else if (tab.value === "laba-rugi") {
    b.push(["PENDAPATAN", null, "judul"]);
    grup(d.pendapatan, b);
    b.push(["JUMLAH PENDAPATAN", d.totalPendapatan, "total"]);
    b.push(["BEBAN", null, "judul"]);
    grup(d.beban, b);
    b.push(["JUMLAH BEBAN", d.totalBeban, "total"]);
    b.push([Number(d.surplus) >= 0 ? "SURPLUS" : "DEFISIT", d.surplus, "total"]);
  } else if (tab.value === "arus-kas") {
    const l = d.langsung;
    b.push(["METODE LANGSUNG", null, "judul"]);
    for (const [k, nama] of [["operasi", "Aktivitas Operasi"], ["investasi", "Aktivitas Investasi"], ["pendanaan", "Aktivitas Pendanaan"]]) {
      b.push([nama, null, "sub"]);
      for (const a of l[k].akun) b.push([`    ${a.kode} ${a.nama}`, a.nilai, ""]);
      b.push([`Arus kas bersih ${nama.toLowerCase()}`, l[k].total, "total"]);
    }
    b.push(["Kenaikan (penurunan) kas", l.kenaikanKas, "total"]);
    const t = d.tidakLangsung;
    b.push(["METODE TIDAK LANGSUNG", null, "judul"]);
    b.push(["Surplus/defisit", t.operasi.surplus, ""]);
    for (const a of t.operasi.penyesuaian) b.push([`    Perubahan ${a.kode} ${a.nama}`, a.nilai, ""]);
    b.push(["Arus kas bersih aktivitas operasi", t.operasi.total, "total"]);
    for (const a of t.investasi.akun) b.push([`    ${a.kode} ${a.nama}`, a.nilai, ""]);
    b.push(["Arus kas bersih aktivitas investasi", t.investasi.total, "total"]);
    for (const a of t.pendanaan.akun) b.push([`    ${a.kode} ${a.nama}`, a.nilai, ""]);
    b.push(["Arus kas bersih aktivitas pendanaan", t.pendanaan.total, "total"]);
    b.push(["Kenaikan (penurunan) kas", t.kenaikanKas, "total"]);
    b.push(["Kas & setara kas awal", d.kasAwal, ""]);
    b.push(["Kas & setara kas akhir", d.kasAkhir, "total"]);
  } else if (tab.value === "perubahan-ekuitas") {
    for (const a of d.akun) b.push([`${a.kode} ${a.nama} — awal ${rupiah(a.saldoAwal)}, mutasi ${rupiah(a.mutasi)}`, a.saldoAkhir, ""]);
    const s = d.surplusAkumulasi;
    b.push([`Surplus akumulasi — awal ${rupiah(s.saldoAwal)}, surplus periode ${rupiah(s.mutasi)}`, s.saldoAkhir, ""]);
    b.push([`JUMLAH EKUITAS — awal ${rupiah(d.total.saldoAwal)}, perubahan ${rupiah(d.total.mutasi)}`, d.total.saldoAkhir, "total"]);
  }
  return b;
});
const aging = computed(() => tab.value.startsWith("aging"));

const nama = () => `${tab.value}-${keterangan.value.replace(/[^0-9A-Za-z]+/g, "-")}`;
const eksporExcel = async () => {
  const d = await muat("xlsx");
  if (!d) return;
  const isi = aging.value
    ? [...d.pihak, { nama: "TOTAL", ...d.total }].map((p: any) => ({ Pihak: p.nama, "0–30 hari": Number(p.b0_30), "31–60 hari": Number(p.b31_60), "61–90 hari": Number(p.b61_90), "> 90 hari": Number(p.b90), "Lebih bayar": Number(p.lebihBayar), Total: Number(p.total) }))
    : baris.value.map(([l, v]) => ({ Uraian: l, Nilai: v === null ? "" : Number(v) }));
  const buku = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(buku, XLSX.utils.json_to_sheet(isi), JUDUL[tab.value].slice(0, 31));
  XLSX.writeFile(buku, `${nama()}.xlsx`);
};
const eksporPdf = async () => {
  const d = await muat("pdf");
  if (!d) return;
  const body = aging.value
    ? [
        ["Pihak", "0–30", "31–60", "61–90", "> 90", "Lebih bayar", "Total"].map((t) => ({ text: t, bold: true })),
        ...[...d.pihak, { nama: "TOTAL", ...d.total }].map((p: any) => [p.nama, ...[p.b0_30, p.b31_60, p.b61_90, p.b90, p.lebihBayar, p.total].map((v) => ({ text: rupiah(v), alignment: "right" }))]),
      ]
    : baris.value.map(([l, v, g]) => [
        { text: l, bold: g === "judul" || g === "total", preserveLeadingSpaces: true },
        { text: v === null ? "" : rupiah(v), alignment: "right", bold: g === "total" },
      ]);
  await bukaPdf(
    {
      pageSize: "A4",
      content: [
        { text: JUDUL[tab.value], style: "judul" },
        { text: keterangan.value, margin: [0, 0, 0, 10] },
        { table: { headerRows: aging.value ? 1 : 0, widths: aging.value ? ["*", "auto", "auto", "auto", "auto", "auto", "auto"] : ["*", "auto"], body }, layout: "lightHorizontalLines", fontSize: 9 },
        { text: "Dihasilkan dari jurnal final OpenSIMRS. Format laporan perlu disahkan bagian keuangan.", fontSize: 7, margin: [0, 10, 0, 0], color: "#667085" },
      ],
      styles: { judul: { fontSize: 14, bold: true } },
      defaultStyle: { fontSize: 9 },
    },
    nama(),
  );
};
onMounted(() => muat());
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <h1 class="toolbar-heading text-opensimrs-300">Laporan Keuangan</h1>
          <CustomDatePicker v-if="!PER_TANGGAL.includes(tab)" v-model="dari" label="Dari" />
          <CustomDatePicker v-model="sampai" :label="PER_TANGGAL.includes(tab) ? 'Per tanggal' : 'Sampai'" />
          <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" @click="muat()" />
          <CustomButton v-if="bolehEkspor && kini_" icon="PhFileXls" label="Excel" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="eksporExcel" />
          <CustomButton v-if="bolehEkspor && kini_" icon="PhFilePdf" label="PDF" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="eksporPdf" />
        </PageToolbar>
      </template>
      <template #content>
        <Tabs v-model:value="tab">
          <TabList>
            <Tab v-for="(j, k) in JUDUL" :key="k" :value="k">{{ j }}</Tab>
          </TabList>
        </Tabs>
        <div class="pt-3">
          <div class="mb-2 text-sm"><b>{{ JUDUL[tab] }}</b> · {{ keterangan }}</div>
          <NoData v-if="!kini_" />
          <template v-else-if="aging">
            <DataTable :value="kini_.pihak" class="text-xs" stripedRows>
              <Column header="Pihak" field="nama" headerClass="bg-opensimrs-50" />
              <Column header="0–30 hari" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: p }">{{ rupiah(p.b0_30) }}</template></Column>
              <Column header="31–60 hari" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: p }">{{ rupiah(p.b31_60) }}</template></Column>
              <Column header="61–90 hari" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: p }">{{ rupiah(p.b61_90) }}</template></Column>
              <Column header="> 90 hari" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: p }">{{ rupiah(p.b90) }}</template></Column>
              <Column header="Lebih bayar" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: p }">{{ rupiah(p.lebihBayar) }}</template></Column>
              <Column header="Total" headerClass="bg-opensimrs-50" bodyClass="text-right font-semibold"><template #body="{ data: p }">{{ rupiah(p.total) }}</template></Column>
            </DataTable>
            <div class="mt-2 text-sm font-semibold text-right">Total {{ rupiah(kini_.total.total) }}</div>
            <div class="mt-1 text-xs text-grey-400">Umur dihitung dari tanggal jurnal (belum memakai jatuh tempo); pelunasan dicocokkan FIFO ke tagihan tertua per pihak.</div>
          </template>
          <template v-else>
            <table class="w-full max-w-3xl text-sm">
              <tbody>
                <tr v-for="(r, i) in baris" :key="i" :class="r[2] === 'judul' ? 'font-bold bg-opensimrs-50' : r[2] === 'total' ? 'font-semibold border-t border-grey-200' : r[2] === 'sub' ? 'font-semibold' : ''">
                  <td class="py-1 pl-2 whitespace-pre">{{ r[0] }}</td>
                  <td class="py-1 pr-2 text-right">{{ r[1] === null ? "" : rupiah(r[1]) }}</td>
                </tr>
              </tbody>
            </table>
            <div v-if="tab === 'neraca'" :class="['mt-2 text-xs', kini_.seimbang ? 'text-[#027A48]' : 'text-danger-300']">{{ kini_.seimbang ? "Aset = Kewajiban + Ekuitas" : "Neraca tidak seimbang — periksa jurnal" }}</div>
            <div v-if="tab === 'arus-kas'" :class="['mt-2 text-xs', kini_.cocok ? 'text-[#027A48]' : 'text-danger-300']">
              {{ kini_.cocok ? "Kedua metode cocok dengan mutasi akun kas & setara kas" : "Arus kas tidak cocok dengan mutasi kas — periksa penandaan akun kas" }}
            </div>
          </template>
        </div>
      </template>
    </Card>
  </div>
</template>
