<script setup lang="ts">
import { onMounted, ref } from "vue";
import * as XLSX from "xlsx";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import DetailJurnalDialog from "./DetailJurnalDialog.vue";
import { bukuBesar, daftarAkun, epochHari, rupiah, tanggalAk } from "@/stores/penunjang/akuntansi";

// Buku besar per akun (KF-11): saldo awal, mutasi jurnal final dengan saldo berjalan, dan saldo akhir. Setiap baris
// tertelusur ke jurnal dan dokumen sumbernya (klik baris untuk detail jurnal).
const storeUtils = utilsStore();
const kini = new Date();
const akun = ref<any[]>([]);
const akunUuid = ref("");
const dari = ref<Date | null>(new Date(kini.getFullYear(), kini.getMonth(), 1));
const sampai = ref<Date | null>(kini);
const hasil = ref<any>(null);
const muat = async () => {
  if (!akunUuid.value) return;
  storeUtils.setLoading(true);
  try {
    const r = await bukuBesar({ akunUuid: akunUuid.value, dari: epochHari(dari.value), sampai: epochHari(sampai.value) });
    hasil.value = r?.payload ?? null;
  } finally {
    storeUtils.setLoading(false);
  }
};
const ekspor = () => {
  const h = hasil.value;
  if (!h) return;
  const baris = [
    { Tanggal: "", Nomor: "", Uraian: "Saldo awal", Sumber: "", Debit: "", Kredit: "", Saldo: Number(h.saldoAwal) },
    ...h.mutasi.map((m: any) => ({ Tanggal: tanggalAk(m.tanggal), Nomor: m.nomor, Uraian: m.uraian, Sumber: m.sumberNomor ?? "", Debit: Number(m.debit), Kredit: Number(m.kredit), Saldo: Number(m.saldo) })),
    { Tanggal: "", Nomor: "", Uraian: "Saldo akhir", Sumber: "", Debit: Number(h.totalDebit), Kredit: Number(h.totalKredit), Saldo: Number(h.saldoAkhir) },
  ];
  const buku = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(buku, XLSX.utils.json_to_sheet(baris), "Buku Besar");
  XLSX.writeFile(buku, `buku-besar-${h.akun.kode}.xlsx`);
};
const detailUuid = ref<string | null>(null);
const dialog = ref(false);
const bukaJurnal = (uuid: string) => {
  detailUuid.value = uuid;
  dialog.value = true;
};
onMounted(async () => {
  const r = await daftarAkun();
  akun.value = (r?.payload ?? []).filter((a: any) => a.jenis === "rinci").map((a: any) => ({ ...a, label: `${a.kode} — ${a.nama}` }));
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-auto" pt:content:class="h-full overflow-hidden" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <h1 class="toolbar-heading text-opensimrs-300">Buku Besar</h1>
          <CustomSelect v-model="akunUuid" label="Akun" :options="akun" optionValue="uuid" optionLabel="label" class="w-80" @update:modelValue="muat" />
          <CustomDatePicker v-model="dari" label="Dari" />
          <CustomDatePicker v-model="sampai" label="Sampai" />
          <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" @click="muat" />
          <CustomButton v-if="hasil" icon="PhFileXls" label="Excel" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="ekspor" />
        </PageToolbar>
      </template>
      <template #content>
        <NoData v-if="!hasil" />
        <div v-else class="flex flex-col h-full gap-2">
          <div class="flex gap-6 text-sm">
            <span><span class="text-grey-400">Saldo awal:</span> <b>{{ rupiah(hasil.saldoAwal) }}</b></span>
            <span><span class="text-grey-400">Debit:</span> {{ rupiah(hasil.totalDebit) }}</span>
            <span><span class="text-grey-400">Kredit:</span> {{ rupiah(hasil.totalKredit) }}</span>
            <span><span class="text-grey-400">Saldo akhir:</span> <b>{{ rupiah(hasil.saldoAkhir) }}</b> (normal {{ hasil.akun.saldoNormal }})</span>
          </div>
          <DataTable :value="hasil.mutasi" stripedRows class="text-xs cursor-pointer" scrollable scrollHeight="flex" @rowClick="bukaJurnal($event.data.jurnalUuid)">
            <Column header="Tanggal" headerClass="bg-opensimrs-50"><template #body="{ data: m }">{{ tanggalAk(m.tanggal) }}</template></Column>
            <Column header="Nomor" field="nomor" headerClass="bg-opensimrs-50" />
            <Column header="Uraian" headerClass="bg-opensimrs-50"><template #body="{ data: m }">{{ m.uraian }}<span v-if="m.uraianBaris" class="text-grey-400"> · {{ m.uraianBaris }}</span></template></Column>
            <Column header="Dokumen Sumber" headerClass="bg-opensimrs-50"><template #body="{ data: m }">{{ m.sumberNomor || "-" }}</template></Column>
            <Column header="Debit" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: m }">{{ Number(m.debit) ? rupiah(m.debit) : "" }}</template></Column>
            <Column header="Kredit" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: m }">{{ Number(m.kredit) ? rupiah(m.kredit) : "" }}</template></Column>
            <Column header="Saldo" headerClass="bg-opensimrs-50" bodyClass="text-right"><template #body="{ data: m }">{{ rupiah(m.saldo) }}</template></Column>
          </DataTable>
        </div>
      </template>
    </Card>
    <DetailJurnalDialog v-model:visible="dialog" :uuid="detailUuid" modePersetujuan />
  </div>
</template>
