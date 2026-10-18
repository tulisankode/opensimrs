<script setup lang="ts">
import { onMounted, ref } from "vue";
import * as XLSX from "xlsx";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import NoData from "@/components/section/NoData.vue";
import { utilsStore } from "@/stores/utils";
import { keTanggal } from "@/stores/penunjang/radiologi";
import {
  JENIS_KOREKSI,
  SUMBER_TRANSAKSI,
  epochAkhirHari,
  epochAwalHari,
  eksporLaundry,
  gayaKategori,
  izinLaundry,
  laporanLaundry,
  rekonsiliasiLaundry,
  waktuLaundry,
} from "@/stores/penunjang/laundry";

// Laporan Laundry: beban kg per ruangan, perputaran, selisih, koreksi, pemisahan kategori, rekonsiliasi buku stok,
// dan ekspor Excel (izin CETAK LAPORAN). Biaya per kg tidak disajikan selama sumber biaya belum dikonfigurasi.
const storeUtils = utilsStore();
const bolehEkspor = izinLaundry("Laporan Laundry", "CETAK LAPORAN");
const tglMulai = ref<Date | null>(new Date(Date.now() - 29 * 86400 * 1000));
const tglSelesai = ref<Date | null>(new Date());
const laporan = ref<any>(null);
const rekonsiliasi = ref<any[]>([]);
const filter = () => ({ dari: epochAwalHari(tglMulai.value), sampai: epochAkhirHari(tglSelesai.value) });

const muat = async () => {
  storeUtils.setLoading(true);
  try {
    const [l, r] = await Promise.all([laporanLaundry(filter()), rekonsiliasiLaundry(filter())]);
    laporan.value = l?.payload ?? null;
    rekonsiliasi.value = r?.payload ?? [];
  } finally {
    storeUtils.setLoading(false);
  }
};
onMounted(muat);

const ekspor = async () => {
  const res = await eksporLaundry(filter());
  if (!res) return;
  const baris = (res.payload ?? []).map((x: any) => ({
    Waktu: waktuLaundry(x.waktuTransaksi),
    Lokasi: x.lokasiTipe === "laundry" ? "Stok bersih laundry" : x.namaRuangan,
    "Kode Linen": x.kodeLinen,
    "Jenis Linen": x.jenisLinen,
    Sumber: SUMBER_TRANSAKSI[x.sumberTipe] ?? x.sumberTipe,
    Arah: x.arah,
    Jumlah: Number(x.jumlah),
    Keterangan: x.alasan,
    Petugas: x.petugas,
  }));
  const buku = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(buku, XLSX.utils.json_to_sheet(baris), "Transaksi Linen");
  XLSX.utils.book_append_sheet(
    buku,
    XLSX.utils.json_to_sheet(
      rekonsiliasi.value.map((x) => ({
        Lokasi: x.lokasiTipe === "laundry" ? "Stok bersih laundry" : x.namaLokasi,
        "Jenis Linen": x.namaLinen,
        "Saldo Awal": Number(x.saldoAwal),
        Masuk: Number(x.masuk),
        Keluar: Number(x.keluar),
        Hilang: Number(x.hilang),
        Rusak: Number(x.rusak),
        Afkir: Number(x.afkir),
        "Saldo Akhir": Number(x.saldoAkhir),
      })),
    ),
    "Rekonsiliasi",
  );
  XLSX.writeFile(buku, `laporan-laundry-${keTanggal(tglMulai.value)}-${keTanggal(tglSelesai.value)}.xlsx`);
};
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden gap-3">
    <Card pt:body:class="pt-0" class="flex-none">
      <template #header>
        <PageToolbar>
          <h1 class="toolbar-heading text-opensimrs-300">Laporan Laundry</h1>
          <CustomDatePicker v-model="tglMulai" label="Tanggal mulai" class="toolbar-field--date" :maxDate="tglSelesai ?? undefined" />
          <CustomDatePicker v-model="tglSelesai" label="Tanggal selesai" class="toolbar-field--date" :minDate="tglMulai ?? undefined" />
          <CustomButton icon="PhArrowClockwise" label="Muat" @click="muat" />
          <CustomButton v-if="bolehEkspor" icon="PhFileXls" label="Ekspor Excel" @click="ekspor" />
        </PageToolbar>
      </template>
    </Card>

    <div v-if="laporan" class="grid grid-cols-2 gap-3 overflow-auto">
      <Card pt:body:class="pt-0">
        <template #header><div class="px-4 pt-4 font-semibold text-opensimrs-300">Beban Cucian per Ruangan</div></template>
        <template #content>
          <NoData v-if="!laporan.bebanKgPerRuangan?.length" />
          <DataTable v-else :value="laporan.bebanKgPerRuangan" class="text-xs" stripedRows>
            <Column field="namaRuangan" header="Ruangan" headerClass="bg-opensimrs-50" />
            <Column header="Berat (kg)" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ Number(d.beratKg).toFixed(2) }}</template></Column>
            <Column header="Unit" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ Number(d.jumlahUnit) }}</template></Column>
          </DataTable>
          <div class="mt-2 text-xs text-grey-400">{{ laporan.keteranganBiaya }}</div>
        </template>
      </Card>

      <Card pt:body:class="pt-0">
        <template #header><div class="px-4 pt-4 font-semibold text-opensimrs-300">Pemisahan Kategori</div></template>
        <template #content>
          <NoData v-if="!laporan.pemisahanKategori?.length" />
          <DataTable v-else :value="laporan.pemisahanKategori" class="text-xs" stripedRows>
            <Column header="Kategori" headerClass="bg-opensimrs-50">
              <template #body="{ data: d }"><span class="px-2 rounded" :class="[gayaKategori(d.kategori).bg, gayaKategori(d.kategori).text]">{{ gayaKategori(d.kategori).label }}</span></template>
            </Column>
            <Column header="Diterima" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ Number(d.jumlahDiterima) }}</template></Column>
            <Column header="Diproses Terpisah" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ Number(d.jumlahDiprosesTerpisah) }}</template></Column>
            <Column header="Belum Ada Catatan Proses" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ Number(d.belumTerlacak) }}</template></Column>
          </DataTable>
        </template>
      </Card>

      <Card pt:body:class="pt-0" class="col-span-2">
        <template #header><div class="px-4 pt-4 font-semibold text-opensimrs-300">Perputaran Linen Ruangan</div></template>
        <template #content>
          <NoData v-if="!laporan.perputaran?.length" />
          <DataTable v-else :value="laporan.perputaran" class="text-xs" stripedRows>
            <Column field="namaRuangan" header="Ruangan" headerClass="bg-opensimrs-50" />
            <Column field="namaLinen" header="Jenis Linen" headerClass="bg-opensimrs-50" />
            <Column header="Masuk (bersih)" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ Number(d.jumlahMasuk) }}</template></Column>
            <Column header="Keluar (kotor)" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ Number(d.jumlahKeluar) }}</template></Column>
            <Column header="Par Level" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.parLevel === null ? "-" : Number(d.parLevel) }}</template></Column>
            <Column header="Putaran" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.putaran ?? "-" }}</template></Column>
          </DataTable>
        </template>
      </Card>

      <Card pt:body:class="pt-0">
        <template #header><div class="px-4 pt-4 font-semibold text-opensimrs-300">Selisih Serah Terima & Distribusi</div></template>
        <template #content>
          <NoData v-if="!laporan.selisihPenerimaan?.length && !laporan.selisihDistribusi?.length" />
          <div v-for="(x, i) in laporan.selisihPenerimaan" :key="`p${i}`" class="text-xs py-1 border-b border-grey-50">
            Serah terima kotor {{ x.namaRuangan }} ({{ gayaKategori(x.kategori).label }}): diserahkan {{ Number(x.jumlahDiserahkan) }}, diterima {{ Number(x.jumlahDiterima) }}
          </div>
          <div v-for="(x, i) in laporan.selisihDistribusi" :key="`d${i}`" class="text-xs py-1 border-b border-grey-50">
            Distribusi ke {{ x.namaRuangan }} — {{ x.namaLinen }}: dikirim {{ Number(x.jumlahDikirim) }}, diterima {{ Number(x.jumlahDiterima) }}
          </div>
        </template>
      </Card>

      <Card pt:body:class="pt-0">
        <template #header><div class="px-4 pt-4 font-semibold text-opensimrs-300">Hilang, Rusak, Afkir</div></template>
        <template #content>
          <NoData v-if="!laporan.koreksi?.length" />
          <DataTable v-else :value="laporan.koreksi" class="text-xs" stripedRows>
            <Column header="Jenis" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ JENIS_KOREKSI[d.jenisKoreksi] ?? d.jenisKoreksi }}</template></Column>
            <Column header="Lokasi" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.lokasiTipe === "laundry" ? "Stok bersih laundry" : d.namaLokasi }}</template></Column>
            <Column header="Jumlah" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ Number(d.jumlah) }}</template></Column>
          </DataTable>
        </template>
      </Card>

      <Card pt:body:class="pt-0" class="col-span-2">
        <template #header><div class="px-4 pt-4 font-semibold text-opensimrs-300">Rekonsiliasi Buku Stok</div></template>
        <template #content>
          <NoData v-if="!rekonsiliasi.length" />
          <DataTable v-else :value="rekonsiliasi" class="text-xs" stripedRows>
            <Column header="Lokasi" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ d.lokasiTipe === "laundry" ? "Stok bersih laundry" : d.namaLokasi }}</template></Column>
            <Column field="namaLinen" header="Jenis Linen" headerClass="bg-opensimrs-50" />
            <Column header="Saldo Awal" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ Number(d.saldoAwal) }}</template></Column>
            <Column header="Masuk" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ Number(d.masuk) }}</template></Column>
            <Column header="Keluar" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ Number(d.keluar) }}</template></Column>
            <Column header="Hilang" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ Number(d.hilang) }}</template></Column>
            <Column header="Rusak" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ Number(d.rusak) }}</template></Column>
            <Column header="Afkir" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ Number(d.afkir) }}</template></Column>
            <Column header="Saldo Akhir" headerClass="bg-opensimrs-50"><template #body="{ data: d }">{{ Number(d.saldoAkhir) }}</template></Column>
          </DataTable>
        </template>
      </Card>
    </div>
  </div>
</template>
