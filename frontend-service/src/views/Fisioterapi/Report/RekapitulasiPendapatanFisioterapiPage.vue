<script setup lang="ts">
import { onMounted, ref } from "vue";
import NoData from "@/components/section/NoData.vue";
import KerangkaLaporan from "./KerangkaLaporan.vue";
import { apiFisio, labelJenis, rupiah, tglIndo, keIso } from "@/stores/penunjang/fisioterapi";

// Rekapitulasi Pendapatan Fisioterapi: nilai tindakan dari order tervalidasi (valid/terjadwal/selesai)
// menurut tanggal validasi (saat tagihan dikirim ke Pembayaran).
const awal = new Date();
const mulai = ref(new Date(awal.getFullYear(), awal.getMonth(), 1));
const selesai = ref(new Date());
const memuat = ref(false);
const data = ref<any>({ ringkasan: {}, perTindakan: [], perJenis: [], perHari: [], perCaraBayar: [] });

const muat = async () => {
  memuat.value = true;
  const r = await apiFisio.laporan("rekap-pendapatan", { tanggal_mulai: keIso(mulai.value), tanggal_selesai: keIso(selesai.value) });
  if (r) data.value = r.payload;
  memuat.value = false;
};
const lembar = () => [
  { nama: "Per Tindakan", baris: data.value.perTindakan.map((r: any) => ({ Tindakan: r.nama, Qty: r.qty, Pendapatan: r.nilai })) },
  { nama: "Per Jenis", baris: data.value.perJenis.map((r: any) => ({ "Jenis Fisioterapi": labelJenis(r.jenisFisio), Order: r.order, Pendapatan: r.nilai })) },
  { nama: "Per Hari", baris: data.value.perHari.map((r: any) => ({ Tanggal: r.tanggal, Order: r.order, Pendapatan: r.nilai })) },
  { nama: "Per Cara Bayar", baris: data.value.perCaraBayar.map((r: any) => ({ "Cara Bayar": r.caraBayar, Order: r.order, Pendapatan: r.nilai })) },
];
onMounted(muat);
</script>

<template>
  <KerangkaLaporan v-model:mulai="mulai" v-model:selesai="selesai" judul="Rekapitulasi Pendapatan Fisioterapi" :memuat="memuat" :lembar="lembar" @tampilkan="muat">
    <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div class="p-3 border rounded-lg border-grey-100">
        <div class="text-xs text-grey-400">Total Pendapatan</div>
        <div class="text-xl font-semibold text-opensimrs-400">{{ rupiah(data.ringkasan?.totalPendapatan) }}</div>
      </div>
      <div class="p-3 border rounded-lg border-grey-100">
        <div class="text-xs text-grey-400">Order Tervalidasi</div>
        <div class="text-xl font-semibold text-opensimrs-400">{{ data.ringkasan?.totalOrder ?? 0 }}</div>
      </div>
      <div class="p-3 border rounded-lg border-grey-100">
        <div class="text-xs text-grey-400">Pasien</div>
        <div class="text-xl font-semibold text-opensimrs-400">{{ data.ringkasan?.totalPasien ?? 0 }}</div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <section class="border rounded-lg border-grey-100">
        <h2 class="px-3 py-2 text-sm font-semibold border-b border-grey-100">Per Tindakan Terapi</h2>
        <DataTable :value="data.perTindakan" :loading="memuat" class="text-xs" stripedRows>
          <template #empty><NoData /></template>
          <Column field="nama" header="Tindakan" headerClass="bg-opensimrs-50" />
          <Column field="qty" header="Qty" headerClass="bg-opensimrs-50" />
          <Column header="Pendapatan" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><div class="text-right">{{ rupiah(r.nilai) }}</div></template></Column>
        </DataTable>
      </section>
      <section class="border rounded-lg border-grey-100">
        <h2 class="px-3 py-2 text-sm font-semibold border-b border-grey-100">Per Jenis Fisioterapi</h2>
        <DataTable :value="data.perJenis" class="text-xs" stripedRows>
          <Column header="Jenis" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ labelJenis(r.jenisFisio) }}</template></Column>
          <Column field="order" header="Order" headerClass="bg-opensimrs-50" />
          <Column header="Pendapatan" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><div class="text-right">{{ rupiah(r.nilai) }}</div></template></Column>
        </DataTable>
      </section>
      <section class="border rounded-lg border-grey-100">
        <h2 class="px-3 py-2 text-sm font-semibold border-b border-grey-100">Per Hari (tanggal validasi)</h2>
        <DataTable :value="data.perHari" class="text-xs" stripedRows>
          <template #empty><NoData /></template>
          <Column header="Tanggal" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ tglIndo(r.tanggal, true) }}</template></Column>
          <Column field="order" header="Order" headerClass="bg-opensimrs-50" />
          <Column header="Pendapatan" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><div class="text-right">{{ rupiah(r.nilai) }}</div></template></Column>
        </DataTable>
      </section>
      <section class="border rounded-lg border-grey-100">
        <h2 class="px-3 py-2 text-sm font-semibold border-b border-grey-100">Per Cara Bayar</h2>
        <DataTable :value="data.perCaraBayar" class="text-xs" stripedRows>
          <template #empty><NoData /></template>
          <Column header="Cara Bayar" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ r.caraBayar === "umum" ? "Tunai / Umum" : "Asuransi / Penjamin" }}</template></Column>
          <Column field="order" header="Order" headerClass="bg-opensimrs-50" />
          <Column header="Pendapatan" headerClass="bg-opensimrs-50"><template #body="{ data: r }"><div class="text-right">{{ rupiah(r.nilai) }}</div></template></Column>
        </DataTable>
      </section>
    </div>
    <p class="text-xs text-grey-400">Pendapatan = tarif tindakan × qty × jumlah sesi dari order yang sudah divalidasi (tagihan terkirim ke Pembayaran); order batal tidak dihitung.</p>
  </KerangkaLaporan>
</template>
