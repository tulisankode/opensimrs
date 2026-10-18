<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import { laporanMcu, daftarPerusahaanMcu, daftarPaketMcu, izinMcu, JENIS_MCU, tglIso, tglIndo, rupiah, STATUS_PCARE_MCU, type StatusPcareMcu } from "@/stores/penunjang/mcu";
import { fiturAktif } from "@/stores/modulFaskes";

// Laporan MCU: rekap peserta per periode / perusahaan / paket, distribusi kesimpulan, pendapatan.
const n = new Date();
const mulai = ref<Date>(new Date(n.getFullYear(), n.getMonth(), 1));
const selesai = ref<Date>(new Date());
const perusahaanFilter = ref("");
const paketFilter = ref("");
const caraBayar = ref("");
const perusahaan = ref<any[]>([]);
const paket = ref<any[]>([]);
const data = ref<any>(null);
const memuat = ref(false);
const tab = ref("perusahaan");

const muat = async () => {
  memuat.value = true;
  const res = await laporanMcu({
    tanggal_mulai: tglIso(mulai.value), tanggal_selesai: tglIso(selesai.value),
    perusahaan_uuid: perusahaanFilter.value, paket_uuid: paketFilter.value, cara_bayar: caraBayar.value,
  });
  data.value = res?.payload ?? null;
  memuat.value = false;
};

const r = computed(() => data.value?.ringkasan ?? {});
// Distribusi kesimpulan: status kesehatan (baik/perhatian/kritis) + label & persentase, tidak hanya warna.
const distribusi = computed(() => {
  const total = (r.value.fit ?? 0) + (r.value.fitCatatan ?? 0) + (r.value.unfit ?? 0);
  return [
    { kode: "fit", label: "Fit", n: r.value.fit ?? 0, warna: "#12B76A", ikon: "PhCheckCircle" },
    { kode: "fit_catatan", label: "Fit dengan catatan", n: r.value.fitCatatan ?? 0, warna: "#F79009", ikon: "PhWarningCircle" },
    { kode: "unfit", label: "Unfit", n: r.value.unfit ?? 0, warna: "#D92D20", ikon: "PhXCircle" },
  ].map((d) => ({ ...d, persen: total ? Math.round((d.n / total) * 1000) / 10 : 0 }));
});
const totalKesimpulan = computed(() => distribusi.value.reduce((a, d) => a + d.n, 0));

const pcareAktif = computed(() => fiturAktif("mcu_pcare"));
// Rekap status pengiriman MCU PCare (STD-0020), hanya peserta berpenjamin BPJS sesuai filter rekap (KT-17).
const pcareRingkasan = computed(() => {
  const dasar: Record<string, number> = { belum: 0, mengirim: 0, terkirim: 0, gagal: 0, tidak_pasti: 0 };
  for (const p of data.value?.pcare ?? []) dasar[p.status] = p.jumlah;
  return dasar;
});
const tabel = computed(() => {
  if (!data.value) return [];
  if (tab.value === "perusahaan") return data.value.perPerusahaan;
  if (tab.value === "paket") return data.value.perPaket;
  return data.value.perTanggal;
});

const unduhCsv = () => {
  if (!tabel.value.length) return;
  const kolom = ["peserta", "selesai", "batal", "fit", "fitCatatan", "unfit", "pendapatan"];
  const kunci = tab.value === "tanggal" ? "tanggal" : "nama";
  const baris = [[kunci, ...kolom].join(";"), ...tabel.value.map((x: any) => [x[kunci] ?? "", ...kolom.map((k) => x[k])].join(";"))];
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + baris.join("\n")], { type: "text/csv;charset=utf-8" }));
  a.download = `laporan-mcu-${tab.value}-${tglIso(mulai.value)}_${tglIso(selesai.value)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
};

onMounted(async () => {
  muat();
  const [pr, pk] = await Promise.all([daftarPerusahaanMcu({ limit: 500 }), daftarPaketMcu({ limit: 500 })]);
  perusahaan.value = pr?.payload?.data ?? [];
  paket.value = pk?.payload?.data ?? [];
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-hidden" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Laporan MCU</h1>
          <CustomDatePicker v-model="mulai" label="Tanggal mulai" class="toolbar-field--date" :max-date="selesai" />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker v-model="selesai" label="Tanggal selesai" class="toolbar-field--date" :min-date="mulai" />
          <CustomSelect v-model="perusahaanFilter" label="Perusahaan" optionLabel="nama" optionValue="uuid" :options="[{ uuid: '', nama: 'Semua perusahaan' }, ...perusahaan]" />
          <CustomSelect v-model="paketFilter" label="Paket" optionLabel="nama" optionValue="uuid" :options="[{ uuid: '', nama: 'Semua paket' }, ...paket]" />
          <CustomSelect
            v-model="caraBayar"
            label="Cara bayar"
            optionLabel="l"
            optionValue="v"
            :showFilter="false"
            :options="[{ v: '', l: 'Semua cara bayar' }, { v: 'perorangan', l: 'Perorangan' }, { v: 'korporasi', l: 'Korporasi' }]"
          />
          <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" @click="muat" />
        </PageToolbar>
      </template>
      <template #content>
        <div v-if="memuat && !data" class="p-6 text-sm text-grey-400">Memuat…</div>
        <div v-else-if="data" class="flex flex-col gap-4 p-4 text-sm">
          <div class="text-xs text-grey-400">Periode {{ tglIndo(data.periode.mulai) }} s.d. {{ tglIndo(data.periode.selesai) }}</div>

          <!-- Ringkasan -->
          <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div class="p-3 border rounded-lg border-grey-100">
              <div class="text-xs text-grey-400">Peserta (non-batal)</div>
              <div class="text-2xl font-semibold">{{ r.peserta }}</div>
              <div class="text-xs text-grey-400">{{ r.terdaftar }} terdaftar · {{ r.proses }} proses · {{ r.selesai }} selesai · {{ r.batal }} batal</div>
            </div>
            <div class="p-3 border rounded-lg border-grey-100">
              <div class="text-xs text-grey-400">Pendapatan</div>
              <div class="text-2xl font-semibold">{{ rupiah(r.pendapatan) }}</div>
              <div class="text-xs text-grey-400">Perorangan {{ rupiah(r.pendapatanPerorangan) }} · Korporasi {{ rupiah(r.pendapatanKorporasi) }}</div>
            </div>
            <div class="p-3 border rounded-lg border-grey-100">
              <div class="text-xs text-grey-400">Korporasi tertagih (invoice terbit/dibayar)</div>
              <div class="text-2xl font-semibold">{{ rupiah(r.korporasiTertagih) }}</div>
              <div class="text-xs text-grey-400">Lunas {{ rupiah(r.korporasiLunas) }} · pembayaran diterima periode ini {{ rupiah(r.korporasiDiterima) }}</div>
            </div>
            <div class="p-3 border rounded-lg border-grey-100">
              <div class="text-xs text-grey-400">Korporasi belum ditagih</div>
              <div class="text-2xl font-semibold">{{ rupiah(r.korporasiBelumDitagih) }}</div>
              <div class="text-xs text-grey-400">Belum masuk invoice / invoice draft</div>
            </div>
          </div>

          <!-- Distribusi kesimpulan -->
          <div class="p-3 border rounded-lg border-grey-100">
            <div class="mb-2 font-semibold">Distribusi Kesimpulan <span class="font-normal text-grey-400">({{ totalKesimpulan }} peserta selesai)</span></div>
            <div v-if="totalKesimpulan" class="flex w-full h-4 gap-[2px] overflow-hidden rounded" role="img" :aria-label="distribusi.map((d) => `${d.label} ${d.n}`).join(', ')">
              <div
                v-for="d in distribusi.filter((x) => x.n)"
                :key="d.kode"
                :style="{ width: d.persen + '%', background: d.warna }"
                :title="`${d.label}: ${d.n} peserta (${d.persen}%)`"
              />
            </div>
            <div v-else class="text-xs text-grey-400">Belum ada peserta dengan kesimpulan pada periode ini.</div>
            <div class="flex flex-wrap gap-6 mt-2">
              <div v-for="d in distribusi" :key="d.kode" class="flex items-center gap-2">
                <component :is="d.ikon" :size="18" weight="fill" :color="d.warna" aria-hidden="true" />
                <span>{{ d.label }}</span>
                <b>{{ d.n }}</b>
                <span class="text-grey-400">({{ d.persen }}%)</span>
              </div>
            </div>
          </div>

          <!-- MCU PCare (STD-0020) -->
          <div v-if="pcareAktif" class="p-3 border rounded-lg border-grey-100">
            <div class="mb-2 font-semibold">Status Pengiriman MCU PCare <span class="font-normal text-grey-400">(peserta berpenjamin BPJS)</span></div>
            <div class="flex flex-wrap gap-4">
              <div v-for="(s, kode) in STATUS_PCARE_MCU" :key="kode" class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded-full font-semibold" :class="[s.bg, s.text]">{{ s.label }}</span>
                <b>{{ pcareRingkasan[kode as StatusPcareMcu] ?? 0 }}</b>
              </div>
            </div>
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            <div class="p-3 border rounded-lg border-grey-100">
              <div class="mb-2 font-semibold">Jenis MCU</div>
              <table class="w-full text-xs">
                <tr v-for="j in data.perJenisMcu" :key="j.jenisMcu" class="border-t border-grey-100">
                  <td class="py-1.5">{{ JENIS_MCU[j.jenisMcu] ?? j.jenisMcu }}</td><td class="text-right">{{ j.peserta }}</td>
                </tr>
                <tr v-if="!data.perJenisMcu.length"><td class="py-2 text-grey-400">-</td></tr>
              </table>
            </div>
            <div class="p-3 border rounded-lg border-grey-100">
              <div class="mb-2 font-semibold">Status Gizi (IMT) Peserta</div>
              <table class="w-full text-xs">
                <tr v-for="k in data.kategoriImt" :key="k.kategori" class="border-t border-grey-100">
                  <td class="py-1.5">{{ k.kategori }}</td><td class="text-right">{{ k.jumlah }}</td>
                </tr>
                <tr v-if="!data.kategoriImt.length"><td class="py-2 text-grey-400">Belum ada data tanda vital</td></tr>
              </table>
            </div>
          </div>

          <!-- Rekap -->
          <div class="border rounded-lg border-grey-100">
            <div class="flex items-center justify-between px-3 pt-2">
              <div class="flex gap-1">
                <Button v-for="t in [['perusahaan', 'Per Perusahaan'], ['paket', 'Per Paket'], ['tanggal', 'Per Tanggal']]" :key="t[0]" size="small" :outlined="tab !== t[0]" :label="t[1]" @click="tab = t[0]" />
              </div>
              <Button v-if="izinMcu('Laporan MCU', 'CETAK LAPORAN')" size="small" text label="Unduh CSV" @click="unduhCsv" />
            </div>
            <DataTable :value="tabel" class="mt-2 text-xs" stripedRows>
              <template #empty><div class="py-4 text-center text-grey-400">Tidak ada data</div></template>
              <Column :header="tab === 'tanggal' ? 'Tanggal' : tab === 'paket' ? 'Paket' : 'Perusahaan'" headerClass="bg-opensimrs-50">
                <template #body="{ data: x }">{{ tab === "tanggal" ? tglIndo(x.tanggal) : x.nama }}</template>
              </Column>
              <Column header="Peserta" field="peserta" headerClass="bg-opensimrs-50" />
              <Column header="Selesai" field="selesai" headerClass="bg-opensimrs-50" />
              <Column header="Batal" field="batal" headerClass="bg-opensimrs-50" />
              <Column header="Fit" field="fit" headerClass="bg-opensimrs-50" />
              <Column header="Fit Catatan" field="fitCatatan" headerClass="bg-opensimrs-50" />
              <Column header="Unfit" field="unfit" headerClass="bg-opensimrs-50" />
              <Column header="Pendapatan" headerClass="bg-opensimrs-50">
                <template #body="{ data: x }">{{ rupiah(x.pendapatan) }}</template>
              </Column>
            </DataTable>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
