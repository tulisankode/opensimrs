<script setup lang="ts">
import { onMounted, ref } from "vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomPaginator from "@/components/Base/CustomPaginator.vue";
import NoData from "@/components/section/NoData.vue";
import KerangkaLaporan from "./KerangkaLaporan.vue";
import { apiFisio, JENIS_FISIO, labelJenis, labelJam, labelGender, umur, tglIndo, keIso, SUMBER_ORDER } from "@/stores/penunjang/fisioterapi";

// Laporan Kunjungan & Rekap Kunjungan Fisioterapi (sesi hadir/selesai pada rentang tanggal).
const awal = new Date();
const mulai = ref(new Date(awal.getFullYear(), awal.getMonth(), 1));
const selesai = ref(new Date());
const jenis = ref("");
const cari = ref("");
const halaman = ref({ page: 1, limit: 20 });
const memuat = ref(false);
const data = ref<any>({ ringkasan: {}, rekapHarian: [], data: [], pagination: { total: 0 } });

const param = () => ({ tanggal_mulai: keIso(mulai.value), tanggal_selesai: keIso(selesai.value), jenis_fisio: jenis.value, cari: cari.value });
const muat = async () => {
  memuat.value = true;
  const r = await apiFisio.laporan("kunjungan", { ...param(), ...halaman.value });
  if (r) data.value = r.payload;
  memuat.value = false;
};
const tampilkan = () => {
  halaman.value.page = 1;
  muat();
};
const gantiHalaman = (e: { page: number; rows: number }) => {
  halaman.value = { page: e.page + 1, limit: e.rows };
  muat();
};

// Ekspor memuat seluruh baris (tanpa paginasi).
const lembar = async () => {
  const semua: any[] = (await apiFisio.laporan("kunjungan", { ...param(), limit: 9999 }))?.payload?.data ?? [];
  return [
  {
    nama: "Kunjungan",
    baris: semua.map((k, i) => ({
      No: i + 1, Tanggal: k.tanggal, Jam: labelJam(k.jamSlot), "No. RM": k.noRm, "Nama Pasien": k.namaPasien,
      "Jenis Kelamin": labelGender(k.gender), Umur: umur(k.tanggalLahir), "No. Order": k.noOrder, Asal: SUMBER_ORDER[k.sumber] ?? k.sumber,
      "Jenis Fisioterapi": labelJenis(k.jenisFisio), Sesi: `${k.sesiKe}/${k.jumlahSesi}`, Tindakan: k.tindakan, Diagnosis: k.diagnosis,
      "Fase Rehab": k.faseRehabilitasi, Terapis: k.terapis, Kunjungan: k.pasienBaru ? "Baru" : "Lama",
    })),
  },
  {
    nama: "Rekap Harian",
    baris: (data.value.rekapHarian ?? []).map((r: any) => ({ Tanggal: r.tanggal, Kunjungan: r.kunjungan, Pasien: r.pasien, Baru: r.baru, Lama: r.lama })),
  },
  ];
};

const KARTU = [
  ["totalKunjungan", "Total Kunjungan"],
  ["totalPasien", "Pasien"],
  ["kunjunganBaru", "Kunjungan Baru"],
  ["kunjunganLama", "Kunjungan Lama"],
  ["lakiLaki", "Laki-laki"],
  ["perempuan", "Perempuan"],
];
onMounted(muat);
</script>

<template>
  <KerangkaLaporan
    v-model:mulai="mulai"
    v-model:selesai="selesai"
    judul="Kunjungan Fisioterapi"
    :memuat="memuat"
    :lembar="lembar"
    @tampilkan="tampilkan"
  >
    <template #filter>
      <CustomSelect v-model="jenis" label="Jenis Fisioterapi" placeHolder="Semua jenis" :options="JENIS_FISIO" optionLabel="label" optionValue="value" clearable />
      <CustomTextfield v-model="cari" label="Cari" prependIcon="PhMagnifyingGlass" placeholder="Nama / No. RM" @keydown.enter="tampilkan" />
    </template>

    <div class="grid grid-cols-2 gap-3 md:grid-cols-6">
      <div v-for="[k, l] in KARTU" :key="k" class="p-3 border rounded-lg border-grey-100">
        <div class="text-xs text-grey-400">{{ l }}</div>
        <div class="text-xl font-semibold text-opensimrs-400">{{ data.ringkasan?.[k] ?? 0 }}</div>
      </div>
    </div>

    <section class="border rounded-lg border-grey-100">
      <h2 class="px-3 py-2 text-sm font-semibold border-b border-grey-100">Rekap Kunjungan per Hari</h2>
      <DataTable :value="data.rekapHarian" class="text-xs" stripedRows>
        <template #empty><NoData /></template>
        <Column header="Tanggal" headerClass="bg-opensimrs-50"><template #body="{ data: r }">{{ tglIndo(r.tanggal, true) }}</template></Column>
        <Column field="kunjungan" header="Kunjungan" headerClass="bg-opensimrs-50" />
        <Column field="pasien" header="Pasien" headerClass="bg-opensimrs-50" />
        <Column field="baru" header="Baru" headerClass="bg-opensimrs-50" />
        <Column field="lama" header="Lama" headerClass="bg-opensimrs-50" />
      </DataTable>
    </section>

    <section class="border rounded-lg border-grey-100">
      <h2 class="px-3 py-2 text-sm font-semibold border-b border-grey-100">Detail Kunjungan</h2>
      <DataTable :value="data.data" :loading="memuat" class="text-xs" stripedRows scrollable>
        <template #empty><NoData /></template>
        <Column header="No." headerClass="bg-opensimrs-50"><template #body="{ index }">{{ (halaman.page - 1) * halaman.limit + index + 1 }}</template></Column>
        <Column header="Tanggal" headerClass="bg-opensimrs-50">
          <template #body="{ data: k }">{{ tglIndo(k.tanggal) }}<div class="text-grey-400">{{ labelJam(k.jamSlot) }}</div></template>
        </Column>
        <Column header="Pasien" headerClass="bg-opensimrs-50">
          <template #body="{ data: k }">
            <div class="font-semibold">{{ k.namaPasien }}</div>
            <div class="text-grey-400">{{ k.noRm }} · {{ labelGender(k.gender) }} · {{ umur(k.tanggalLahir) }}</div>
          </template>
        </Column>
        <Column header="Order" headerClass="bg-opensimrs-50">
          <template #body="{ data: k }">{{ k.noOrder }}<div class="text-grey-400">{{ SUMBER_ORDER[k.sumber] ?? k.sumber }}</div></template>
        </Column>
        <Column header="Jenis" headerClass="bg-opensimrs-50"><template #body="{ data: k }">{{ labelJenis(k.jenisFisio) }}</template></Column>
        <Column header="Sesi" headerClass="bg-opensimrs-50"><template #body="{ data: k }">{{ k.sesiKe }}/{{ k.jumlahSesi }}</template></Column>
        <Column field="tindakan" header="Tindakan" headerClass="bg-opensimrs-50" class="max-w-[220px]" />
        <Column header="Fase" headerClass="bg-opensimrs-50"><template #body="{ data: k }">{{ k.faseRehabilitasi ?? "-" }}</template></Column>
        <Column field="terapis" header="Terapis" headerClass="bg-opensimrs-50" />
        <Column header="Kunjungan" headerClass="bg-opensimrs-50">
          <template #body="{ data: k }">
            <span class="px-1.5 rounded" :class="k.pasienBaru ? 'bg-success-50 text-success-400' : 'bg-grey-75'">{{ k.pasienBaru ? "Baru" : "Lama" }}</span>
          </template>
        </Column>
      </DataTable>
      <div class="flex justify-end px-3 py-2">
        <CustomPaginator :rows="halaman.limit" :totalRecords="data.pagination?.total ?? 0" :rowsPerPageOptions="[20, 50, 100]" @page="gantiHalaman" />
      </div>
    </section>
  </KerangkaLaporan>
</template>
