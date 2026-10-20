<script setup lang="ts">
import { onMounted, ref } from "vue";
import * as XLSX from "xlsx";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { epochHari, neracaSaldo, rupiah, tanggalAk } from "@/stores/penunjang/akuntansi";

// Neraca saldo (KF-11): saldo awal, mutasi debit/kredit, dan saldo akhir per akun rinci dari jurnal final. Total debit
// harus sama dengan total kredit; tanda "Tidak seimbang" menandakan masalah data yang harus diperiksa sebelum tutup buku.
const storeUtils = utilsStore();
const kini = new Date();
const dari = ref<Date | null>(new Date(kini.getFullYear(), kini.getMonth(), 1));
const sampai = ref<Date | null>(kini);
const hasil = ref<any>(null);
const KOLOM = [
  ["awalDebit", "Saldo Awal Debit"],
  ["awalKredit", "Saldo Awal Kredit"],
  ["mutasiDebit", "Mutasi Debit"],
  ["mutasiKredit", "Mutasi Kredit"],
  ["akhirDebit", "Saldo Akhir Debit"],
  ["akhirKredit", "Saldo Akhir Kredit"],
];
const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const r = await neracaSaldo({ dari: epochHari(dari.value), sampai: epochHari(sampai.value) });
    hasil.value = r?.payload ?? null;
  } finally {
    storeUtils.setLoading(false);
  }
};
const ekspor = () => {
  const h = hasil.value;
  if (!h) return;
  const baris = h.akun.map((a: any) => ({ Kode: a.kode, Akun: a.nama, ...Object.fromEntries(KOLOM.map(([k, l]) => [l, Number(a[k])])) }));
  baris.push({ Kode: "", Akun: "TOTAL", ...Object.fromEntries(KOLOM.map(([k, l]) => [l, Number(h.total[k])])) });
  const buku = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(buku, XLSX.utils.json_to_sheet(baris), "Neraca Saldo");
  XLSX.writeFile(buku, `neraca-saldo-${tanggalAk(h.dari)}-${tanggalAk(h.sampai)}.xlsx`);
};
onMounted(muat);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Neraca Saldo</h1>
          <CustomDatePicker v-model="dari" label="Dari" />
          <CustomDatePicker v-model="sampai" label="Sampai" />
          <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" @click="muat" />
          <CustomButton v-if="hasil" icon="PhFileXls" label="Excel" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="ekspor" />
          <span v-if="hasil" :class="['px-2 py-1 rounded-full text-xs', hasil.seimbang ? 'bg-[#ECFDF3] text-[#027A48]' : 'bg-[#FEE4E2] text-[#B42318]']">{{ hasil.seimbang ? "Seimbang" : "Tidak seimbang" }}</span>
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!hasil?.akun?.length" />
        <div v-else class="flex flex-col h-full gap-2">
          <DataTable :value="hasil.akun" stripedRows class="text-xs" scrollable scrollHeight="flex" tableStyle="min-width: 64rem">
            <Column header="Kode" field="kode" headerClass="bg-opensimrs-50" />
            <Column header="Akun" headerClass="bg-opensimrs-50"><template #body="{ data: a }"><span :class="a.aktif ? '' : 'text-grey-400'">{{ a.nama }}</span></template></Column>
            <Column v-for="[k, l] in KOLOM" :key="k" :header="l" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: a }">{{ rupiah(a[k]) }}</template></Column>
          </DataTable>
          <div class="grid grid-cols-6 gap-2 p-2 text-xs font-semibold text-right rounded-md bg-opensimrs-50">
            <div v-for="[k, l] in KOLOM" :key="k"><div class="font-normal text-grey-400">Total {{ l }}</div>{{ rupiah(hasil.total[k]) }}</div>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
