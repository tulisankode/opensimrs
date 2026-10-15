<script setup lang="ts">
import { onMounted, ref } from "vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import NoData from "@/components/section/NoData.vue";
import KerangkaLaporan from "./KerangkaLaporan.vue";
import { apiFisio, JENIS_FISIO, rupiah, keIso } from "@/stores/penunjang/fisioterapi";

// Rekapitulasi Tindakan Terapi: jumlah tindakan yang dilakukan pada sesi hadir/selesai.
const awal = new Date();
const mulai = ref(new Date(awal.getFullYear(), awal.getMonth(), 1));
const selesai = ref(new Date());
const jenis = ref("");
const memuat = ref(false);
const data = ref<{ data: any[]; total: { jumlah: number; nilai: number } }>({ data: [], total: { jumlah: 0, nilai: 0 } });

const muat = async () => {
  memuat.value = true;
  const r = await apiFisio.laporan("rekap-tindakan", { tanggal_mulai: keIso(mulai.value), tanggal_selesai: keIso(selesai.value), jenis_fisio: jenis.value });
  if (r) data.value = r.payload;
  memuat.value = false;
};
const lembar = () => [
  {
    nama: "Rekap Tindakan Terapi",
    baris: [
      ...data.value.data.map((r, i) => ({ No: i + 1, Kode: r.kode, Tindakan: r.nama, Jumlah: r.jumlah, Sesi: r.sesi, Pasien: r.pasien, Nilai: r.nilai })),
      { No: "", Kode: "", Tindakan: "TOTAL", Jumlah: data.value.total.jumlah, Sesi: "", Pasien: "", Nilai: data.value.total.nilai },
    ],
  },
];
onMounted(muat);
</script>

<template>
  <KerangkaLaporan v-model:mulai="mulai" v-model:selesai="selesai" judul="Rekapitulasi Tindakan Terapi" :memuat="memuat" :lembar="lembar" @tampilkan="muat">
    <template #filter>
      <CustomSelect v-model="jenis" label="Jenis Fisioterapi" placeHolder="Semua jenis" :options="JENIS_FISIO" optionLabel="label" optionValue="value" clearable />
    </template>
    <div class="grid grid-cols-2 gap-3 md:grid-cols-3">
      <div class="p-3 border rounded-lg border-grey-100">
        <div class="text-xs text-grey-400">Total Tindakan Dilakukan</div>
        <div class="text-xl font-semibold text-opensimrs-400">{{ data.total.jumlah }}</div>
      </div>
      <div class="p-3 border rounded-lg border-grey-100">
        <div class="text-xs text-grey-400">Jenis Tindakan</div>
        <div class="text-xl font-semibold text-opensimrs-400">{{ data.data.length }}</div>
      </div>
      <div class="p-3 border rounded-lg border-grey-100">
        <div class="text-xs text-grey-400">Nilai Tindakan</div>
        <div class="text-xl font-semibold text-opensimrs-400">{{ rupiah(data.total.nilai) }}</div>
      </div>
    </div>
    <DataTable :value="data.data" :loading="memuat" class="text-xs" stripedRows>
      <template #empty><NoData /></template>
      <Column header="No." headerClass="bg-opensimrs-50"><template #body="{ index }">{{ index + 1 }}</template></Column>
      <Column field="kode" header="Kode" headerClass="bg-opensimrs-50" />
      <Column field="nama" header="Tindakan Terapi" headerClass="bg-opensimrs-50" footerClass="font-semibold">
        <template #footer>TOTAL</template>
      </Column>
      <Column field="jumlah" header="Jumlah" headerClass="bg-opensimrs-50" footerClass="font-semibold">
        <template #footer>{{ data.total.jumlah }}</template>
      </Column>
      <Column field="sesi" header="Sesi" headerClass="bg-opensimrs-50" />
      <Column field="pasien" header="Pasien" headerClass="bg-opensimrs-50" />
      <Column header="Nilai" headerClass="bg-opensimrs-50" footerClass="font-semibold">
        <template #body="{ data: r }"><div class="text-right">{{ rupiah(r.nilai) }}</div></template>
        <template #footer><div class="text-right">{{ rupiah(data.total.nilai) }}</div></template>
      </Column>
    </DataTable>
  </KerangkaLaporan>
</template>
