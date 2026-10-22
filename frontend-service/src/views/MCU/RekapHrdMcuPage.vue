<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageToolbar from "@/components/Base/PageToolbar.vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDatePicker from "@/components/Base/CustomDatePicker.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import { rekapHrdMcu, daftarPerusahaanMcu, izinMcu, KESIMPULAN_MCU, tglIso, tglIndo, jenisKelamin, type Kesimpulan } from "@/stores/penunjang/mcu";
import { cetakRekapHrdMcu } from "@/utils/pdf/pdfMcu/cetakMcu";
import { eksporRekapHrdExcel } from "@/utils/excel/rekapHrdMcu";

// Rekap hasil MCU per perusahaan untuk HRD: kesimpulan per karyawan + temuan abnormal utama (IMT, tekanan darah,
// gula darah, kolesterol, visus/buta warna, radiologi), ringkasan statistik, cetak PDF & ekspor Excel.
const n = new Date();
const mulai = ref<Date>(new Date(n.getFullYear(), n.getMonth(), 1));
const selesai = ref<Date>(new Date());
const perusahaanUuid = ref("");
const perusahaan = ref<any[]>([]);
const data = ref<any>(null);
const memuat = ref(false);
const filter = ref<"semua" | "abnormal" | "unfit" | "belum">("semua");
const bolehCetak = computed(() => izinMcu("Laporan MCU", "CETAK LAPORAN"));

const muat = async () => {
  if (!perusahaanUuid.value) return;
  memuat.value = true;
  const res = await rekapHrdMcu({ perusahaan_uuid: perusahaanUuid.value, tanggal_mulai: tglIso(mulai.value), tanggal_selesai: tglIso(selesai.value) });
  data.value = res?.payload ?? null;
  memuat.value = false;
};
const adaAbnormal = (x: any) => Object.entries(x.temuan ?? {}).some(([k, v]) => k.endsWith("Abnormal") && v === true);
const baris = computed(() => {
  const semua = data.value?.peserta ?? [];
  if (filter.value === "abnormal") return semua.filter(adaAbnormal);
  if (filter.value === "unfit") return semua.filter((x: any) => x.kesimpulan === "unfit" || x.kesimpulan === "fit_catatan");
  if (filter.value === "belum") return semua.filter((x: any) => x.status !== "selesai");
  return semua;
});
const merah = (v: any) => (v === true ? "font-semibold text-[#B42318]" : "");

onMounted(async () => {
  perusahaan.value = (await daftarPerusahaanMcu({ limit: 500 }))?.payload?.data ?? [];
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card pt:body:class="h-full pt-0 overflow-hidden" pt:content:class="h-full overflow-auto" class="h-full overflow-hidden">
      <template #header>
        <PageToolbar>
          <CustomButton icon="PhArrowClockwise" @click="muat" />
          <h1 class="toolbar-heading text-opensimrs-300">Rekap Hasil MCU (HRD)</h1>
          <CustomSelect v-model="perusahaanUuid" label="Perusahaan" place-holder="Pilih perusahaan" optionLabel="nama" optionValue="uuid" :options="perusahaan" />
          <CustomDatePicker v-model="mulai" label="Tanggal mulai" class="toolbar-field--date" :max-date="selesai" />
          <PhMinus :size="14" class="shrink-0 text-grey-300" aria-hidden="true" />
          <CustomDatePicker v-model="selesai" label="Tanggal selesai" class="toolbar-field--date" :min-date="mulai" />
          <CustomButton icon="PhMagnifyingGlass" label="Tampilkan" :disabled="!perusahaanUuid" @click="muat" />
          <template v-if="data && bolehCetak">
            <CustomButton icon="PhFilePdf" label="Cetak PDF" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="cetakRekapHrdMcu(data)" />
            <CustomButton icon="PhFileXls" label="Ekspor Excel" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="eksporRekapHrdExcel(data)" />
          </template>
        </PageToolbar>
      </template>
      <template #content>
        <div v-if="!perusahaanUuid" class="p-6 text-sm text-grey-400">Pilih perusahaan lalu klik Tampilkan.</div>
        <div v-else-if="memuat && !data" class="p-6 text-sm text-grey-400">Memuat…</div>
        <div v-else-if="data" class="flex flex-col gap-4 p-4 text-sm" data-uji="rekap-hrd">
          <div class="text-xs text-grey-400">{{ data.perusahaan.nama }} · periode {{ tglIndo(data.periode.mulai) }} s.d. {{ tglIndo(data.periode.selesai) }}</div>
          <div class="grid gap-3 md:grid-cols-3">
            <div class="p-3 border rounded-lg border-grey-100">
              <div class="text-xs text-grey-400">Peserta</div>
              <div class="text-2xl font-semibold">{{ data.ringkasan.total }}</div>
              <div class="text-xs text-grey-400">{{ data.ringkasan.selesai }} selesai · {{ data.ringkasan.belumSelesai }} belum selesai</div>
            </div>
            <div class="p-3 border rounded-lg border-grey-100">
              <div class="mb-1 text-xs text-grey-400">Kesimpulan (peserta selesai)</div>
              <div v-for="k in data.ringkasan.kesimpulan" :key="k.kode" class="flex justify-between">
                <span :class="[KESIMPULAN_MCU[k.kode as Kesimpulan].text]">{{ KESIMPULAN_MCU[k.kode as Kesimpulan].label }}</span>
                <span><b>{{ k.jumlah }}</b> <span class="text-grey-400">({{ k.persen }}%)</span></span>
              </div>
            </div>
            <div class="p-3 border rounded-lg border-grey-100">
              <div class="mb-1 text-xs text-grey-400">Status gizi (IMT)</div>
              <div v-for="k in data.ringkasan.imt" :key="k.kategori" class="flex justify-between"><span>{{ k.kategori }}</span><b>{{ k.jumlah }}</b></div>
              <div v-if="!data.ringkasan.imt.length" class="text-xs text-grey-400">Belum ada data</div>
            </div>
          </div>
          <div class="grid gap-3 md:grid-cols-2">
            <div class="p-3 border rounded-lg border-grey-100">
              <div class="mb-2 font-semibold">Temuan abnormal utama</div>
              <table class="w-full text-xs">
                <tbody>
                  <tr v-for="tm in data.ringkasan.temuan" :key="tm.kunci" class="border-t border-grey-100">
                    <td class="py-1.5">{{ tm.label }}</td>
                    <td class="text-right"><b>{{ tm.jumlah }}</b> / {{ tm.diperiksa }}</td>
                    <td class="w-32 pl-3"><ProgressBar :value="tm.persen" :showValue="false" style="height: 6px" /></td>
                    <td class="w-12 text-right">{{ tm.persen }}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="p-3 border rounded-lg border-grey-100">
              <div class="mb-2 font-semibold">Per bagian</div>
              <table class="w-full text-xs">
                <thead>
                  <tr class="text-grey-400"><td>Bagian</td><td class="text-right">Peserta</td><td class="text-right">Fit</td><td class="text-right">Catatan</td><td class="text-right">Unfit</td></tr>
                </thead>
                <tbody>
                  <tr v-for="b in data.ringkasan.perBagian" :key="b.bagian" class="border-t border-grey-100">
                    <td class="py-1.5">{{ b.bagian }}</td><td class="text-right">{{ b.peserta }}</td><td class="text-right">{{ b.fit }}</td><td class="text-right">{{ b.fitCatatan }}</td><td class="text-right">{{ b.unfit }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="border rounded-lg border-grey-100">
            <div class="flex flex-wrap items-center gap-2 px-3 pt-2 text-xs">
              <button v-for="[k, l] in [['semua', 'Semua'], ['abnormal', 'Ada temuan abnormal'], ['unfit', 'Fit dg catatan / Unfit'], ['belum', 'Belum selesai']]" :key="k" type="button"
                class="px-3 py-1 border rounded-full" :class="filter === k ? 'bg-opensimrs-300 text-white border-opensimrs-300' : 'border-grey-200'" @click="filter = k as any">{{ l }}</button>
              <span class="ml-auto text-grey-400">{{ baris.length }} peserta</span>
            </div>
            <DataTable :value="baris" class="mt-2 text-xs" stripedRows scrollable scrollHeight="480px" dataKey="uuid">
              <template #empty><div class="py-4 text-center text-grey-400">Tidak ada peserta</div></template>
              <Column header="Karyawan" headerClass="bg-opensimrs-50" frozen>
                <template #body="{ data: x }">
                  <div class="font-semibold">{{ x.nama }}</div>
                  <div class="text-grey-400">{{ x.nikKaryawan ?? "-" }} · {{ [x.bagian, x.jabatan].filter(Boolean).join(" / ") || "-" }}</div>
                  <div class="text-grey-400">{{ jenisKelamin(x.gender) }} · {{ x.umur ?? "-" }} th · {{ x.noMcu }}</div>
                </template>
              </Column>
              <Column header="Kesimpulan" headerClass="bg-opensimrs-50">
                <template #body="{ data: x }">
                  <span v-if="x.kesimpulan" class="px-2 py-0.5 rounded-full font-semibold whitespace-nowrap" :class="[KESIMPULAN_MCU[x.kesimpulan as Kesimpulan].bg, KESIMPULAN_MCU[x.kesimpulan as Kesimpulan].text]">
                    {{ KESIMPULAN_MCU[x.kesimpulan as Kesimpulan].label }}
                  </span>
                  <span v-else class="text-grey-400">Belum selesai</span>
                </template>
              </Column>
              <Column header="IMT" headerClass="bg-opensimrs-50">
                <template #body="{ data: x }"><div :class="merah(x.temuan.imtAbnormal)">{{ x.temuan.imt ?? "-" }}</div><div class="text-grey-400">{{ x.temuan.kategoriImt }}</div></template>
              </Column>
              <Column header="Tekanan Darah" headerClass="bg-opensimrs-50">
                <template #body="{ data: x }"><div :class="merah(x.temuan.tdAbnormal)">{{ x.temuan.tekananDarah ?? "-" }}</div><div class="text-grey-400">{{ x.temuan.kategoriTd }}</div></template>
              </Column>
              <Column header="Gula Darah" headerClass="bg-opensimrs-50">
                <template #body="{ data: x }"><span :class="merah(x.temuan.gulaAbnormal)">{{ x.temuan.gulaDarah ?? "-" }}</span></template>
              </Column>
              <Column header="Kolesterol" headerClass="bg-opensimrs-50">
                <template #body="{ data: x }"><span :class="merah(x.temuan.kolesterolAbnormal)">{{ x.temuan.kolesterol ?? "-" }}</span></template>
              </Column>
              <Column header="Visus" headerClass="bg-opensimrs-50">
                <template #body="{ data: x }"><div :class="merah(x.temuan.visusAbnormal)">{{ x.temuan.visus ?? "-" }}</div><div :class="merah(x.temuan.butaWarnaAbnormal)">{{ x.temuan.butaWarna }}</div></template>
              </Column>
              <Column header="Radiologi" headerClass="bg-opensimrs-50" class="max-w-[220px]">
                <template #body="{ data: x }"><span class="whitespace-normal" :class="merah(x.temuan.radiologiAbnormal)">{{ x.temuan.radiologi ?? "-" }}</span></template>
              </Column>
              <Column header="Catatan / Saran" headerClass="bg-opensimrs-50" class="max-w-[240px]">
                <template #body="{ data: x }"><div class="whitespace-normal">{{ x.catatanKesimpulan ?? "-" }}</div><div v-if="x.saran" class="text-grey-400 whitespace-normal">{{ x.saran }}</div></template>
              </Column>
            </DataTable>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
